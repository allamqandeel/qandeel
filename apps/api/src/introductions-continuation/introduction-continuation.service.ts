import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError, readDataApiUpstreamIdentity } from '../conversation/supabase-data-api.service';
import { IntroductionContinuationRepository } from './introduction-continuation.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException({ outcome: 'UNAVAILABLE' }); };
const objectOf = (body: unknown): Record<string, unknown> =>
  (body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {});
const onlyKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean =>
  Object.keys(value).every((key) => allowed.includes(key));
const keysAre = (row: unknown, keys: readonly string[]): row is Record<string, unknown> =>
  !!row && typeof row === 'object' && !Array.isArray(row)
  && Object.keys(row).length === keys.length && keys.every((key) => key in (row as Record<string, unknown>));

/** The system completion is attempted right after an approval, at these delays, and again on every read (condition 3). */
export const COMPLETION_ATTEMPT_DELAYS_MS = [0, 250, 750] as const;

export type SuccessView =
  | { readonly outcome: 'UNAVAILABLE' | 'ENDED' | 'NO_TRANSITION' | 'COMPLETED' }
  | { readonly outcome: 'TRANSITION'; readonly versionId: string; readonly myState: 'NONE' | 'APPROVED' | 'WITHDRAWN'; readonly expectedEventId: string | null };

const ENTRY_CHANNELS = ['CONVERSATIONAL_ENTRY', 'MANUAL_MY_WORLD_ENTRY'];

/**
 * S6-06 — SUCCESS and post-Introduction reactivation for the reader alone.
 *
 * Two humans decide and the system executes: an approval commits in its own database transaction, and only after it
 * has committed does this service run the system completion - a separate transaction that takes no actor - at a few
 * short delays, and again on every read. A failed or not-yet-possible completion leaves both approvals exactly as they
 * were (0163), so retrying is always safe, and one terminal commit is all there can ever be. Nothing about the other
 * human's decision is ever returned: the completion answers COMPLETED or PENDING only.
 */
@Injectable()
export class IntroductionContinuationService {
  /** The pause between completion attempts; a spec replaces it to run without waiting. */
  delay: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => { setTimeout(resolve, ms).unref(); });

  constructor(private readonly repository: IntroductionContinuationRepository) {}

  async readSuccess(token: string, worldId: string): Promise<SuccessView> {
    if (!isUuid(worldId)) return { outcome: 'UNAVAILABLE' };
    const world = worldId.toLowerCase();
    const rows = await this.guard(() => this.repository.readSuccess(token, world));
    if (!Array.isArray(rows)) return unavailable();
    if (rows.length === 0) return { outcome: 'UNAVAILABLE' };
    const row = rows[0];
    if (rows.length !== 1 || !keysAre(row, ['introduction_state', 'transition_version_id', 'my_approval_state', 'my_current_event_id'])) return unavailable();
    if (row.introduction_state === 'SHARED_WORLD') return { outcome: 'COMPLETED' };
    if (row.introduction_state === 'ENDED') return { outcome: 'ENDED' };
    if (row.introduction_state !== 'ACTIVE') return unavailable();
    if (row.transition_version_id === null) return { outcome: 'NO_TRANSITION' };
    if (!isUuid(row.transition_version_id) || !['NONE', 'APPROVED', 'WITHDRAWN'].includes(String(row.my_approval_state))
        || (row.my_current_event_id !== null && !isUuid(row.my_current_event_id))) return unavailable();
    // The reader approves: the system tries once more now - the gates may allow it since the last attempt.
    if (row.my_approval_state === 'APPROVED' && (await this.attemptOnce(token, world)) === 'COMPLETED') return { outcome: 'COMPLETED' };
    return {
      outcome: 'TRANSITION', versionId: row.transition_version_id,
      myState: row.my_approval_state as 'NONE' | 'APPROVED' | 'WITHDRAWN', expectedEventId: row.my_current_event_id,
    };
  }

  async approve(token: string, worldId: string, body: unknown): Promise<{ outcome: string; eventId?: string }> {
    const value = objectOf(body);
    if (!onlyKeys(value, ['commandId', 'versionId', 'expectedEventId']) || !isUuid(value.commandId) || !isUuid(value.versionId)
        || !(value.expectedEventId === null || value.expectedEventId === undefined || isUuid(value.expectedEventId))) return invalid();
    if (!isUuid(worldId)) return { outcome: 'UNAVAILABLE' };
    const world = worldId.toLowerCase();
    const rows = await this.guard(() => this.repository.approve(token, (value.commandId as string).toLowerCase(), world,
      (value.versionId as string).toLowerCase(), value.expectedEventId ? (value.expectedEventId as string).toLowerCase() : null));
    const answer = this.approvalAnswer(rows, ['APPROVED', 'CHANGED', 'NOT_AVAILABLE_NOW', 'COMMAND_CONFLICT', 'UNAVAILABLE']);
    if (answer.outcome !== 'APPROVED') return answer;
    // The approval is committed. Now, and only now, the system completion - in its own transaction(s).
    for (const ms of COMPLETION_ATTEMPT_DELAYS_MS) {
      if (ms > 0) await this.delay(ms);
      if ((await this.attemptOnce(token, world)) === 'COMPLETED') return { outcome: 'COMPLETED' };
    }
    return answer;
  }

  async withdraw(token: string, worldId: string, body: unknown): Promise<{ outcome: string; eventId?: string }> {
    const value = objectOf(body);
    if (!onlyKeys(value, ['commandId', 'versionId', 'expectedEventId']) || !isUuid(value.commandId) || !isUuid(value.versionId)
        || !isUuid(value.expectedEventId)) return invalid();
    if (!isUuid(worldId)) return { outcome: 'UNAVAILABLE' };
    const rows = await this.guard(() => this.repository.withdraw(token, (value.commandId as string).toLowerCase(), worldId.toLowerCase(),
      (value.versionId as string).toLowerCase(), (value.expectedEventId as string).toLowerCase()));
    return this.approvalAnswer(rows, ['WITHDRAWN', 'CHANGED', 'COMMAND_CONFLICT', 'UNAVAILABLE']);
  }

  async readParticipation(token: string): Promise<{ outcome: 'READY'; state: string; pauseReason: string | null; expectedEventId: string | null }> {
    const rows = await this.guard(() => this.repository.readParticipation(token));
    if (!Array.isArray(rows) || rows.length !== 1) return unavailable();
    const row = rows[0];
    if (typeof row.participation_state !== 'string' || !(row.pause_reason === null || typeof row.pause_reason === 'string')
        || !(row.participation_event_id === null || isUuid(row.participation_event_id))) return unavailable();
    // Only the reader's own participation: no grant, profile, requirement or authority identity leaves this service.
    return { outcome: 'READY', state: row.participation_state, pauseReason: row.pause_reason, expectedEventId: row.participation_event_id };
  }

  async reactivate(token: string, body: unknown): Promise<{ outcome: string; state?: string }> {
    const value = objectOf(body);
    const channel = value.entryChannel ?? null;
    if (!onlyKeys(value, ['commandId', 'expectedEventId', 'entryChannel']) || !isUuid(value.commandId) || !isUuid(value.expectedEventId)
        || !(channel === null || (typeof channel === 'string' && ENTRY_CHANNELS.includes(channel)))) return invalid();
    const rows = await this.guard(() => this.repository.reactivate(token, (value.commandId as string).toLowerCase(),
      (value.expectedEventId as string).toLowerCase(), channel as string | null));
    if (!Array.isArray(rows) || rows.length !== 1 || !keysAre(rows[0], ['outcome', 'participation_state'])) return unavailable();
    const { outcome, participation_state: state } = rows[0] as { outcome: string; participation_state: string | null };
    if (!['REACTIVATED', 'CHANGED', 'NOT_ELIGIBLE', 'NOT_AVAILABLE_NOW', 'COMMAND_CONFLICT', 'UNAVAILABLE'].includes(outcome)) return unavailable();
    return outcome === 'REACTIVATED' && typeof state === 'string' ? { outcome, state } : { outcome };
  }

  /** One system completion attempt. A transport failure is just another PENDING: the next read or retry tries again. */
  private async attemptOnce(token: string, world: string): Promise<'COMPLETED' | 'PENDING'> {
    try {
      const rows = await this.repository.complete(token, world);
      return Array.isArray(rows) && rows.length === 1 && rows[0].outcome === 'COMPLETED' ? 'COMPLETED' : 'PENDING';
    } catch {
      return 'PENDING';
    }
  }

  private approvalAnswer(rows: unknown, allowed: readonly string[]): { outcome: string; eventId?: string } {
    if (!Array.isArray(rows) || rows.length !== 1 || !keysAre(rows[0], ['outcome', 'approval_event_id'])) return unavailable();
    const row = rows[0] as { outcome: string; approval_event_id: string | null };
    if (!allowed.includes(row.outcome)) return unavailable();
    return isUuid(row.approval_event_id) ? { outcome: row.outcome, eventId: row.approval_event_id } : { outcome: row.outcome };
  }

  private async guard<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof DataApiError && error.status === 400 && readDataApiUpstreamIdentity(error).databaseCode === '22023') return invalid();
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      return unavailable();
    }
  }
}
