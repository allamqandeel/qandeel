/**
 * S6-06 (CP2) — the client for continuing an Introduction as a Shared World (SUCCESS) and for resuming Introductions
 * afterwards (CP1, migration 0163):
 *
 *   GET  /introductions/worlds/:worldId/success              — TRANSITION { versionId, myState, expectedEventId } | NO_TRANSITION | ENDED | COMPLETED | UNAVAILABLE
 *   POST /introductions/worlds/:worldId/success/approval     — APPROVED | COMPLETED | CHANGED | NOT_AVAILABLE_NOW | COMMAND_CONFLICT | UNAVAILABLE
 *   POST /introductions/worlds/:worldId/success/withdrawal   — WITHDRAWN | CHANGED | COMMAND_CONFLICT | UNAVAILABLE
 *   GET  /introductions/participation                        — the reader's own participation state
 *   POST /introductions/participation/resume                 — REACTIVATED | CHANGED | NOT_ELIGIBLE | NOT_AVAILABLE_NOW | COMMAND_CONFLICT | UNAVAILABLE
 *
 * Nothing about the other person's decision ever comes back: the reader's own approval state, and COMPLETED, only.
 * No route prepares a transition (Stage 8A); in production no transition exists, so the SUCCESS card is never drawn,
 * and every resume answers NOT_AVAILABLE_NOW (CW2-08).
 *
 * A transport and nothing else: the AC-01 seam's credential, no user id, no state, no retry, no persistence; strict
 * decoding (an extra field or an unknown word makes the answer unusable).
 */
import type { RuntimeHttpFetch } from './conversation/conversation-session-api';

export type IntroductionSuccessRead =
  | { readonly kind: 'TRANSITION'; readonly versionId: string; readonly myState: 'NONE' | 'APPROVED' | 'WITHDRAWN'; readonly expectedEventId: string | null }
  | { readonly kind: 'NO_TRANSITION' | 'ENDED' | 'COMPLETED' | 'UNAVAILABLE' | 'FAILED' | 'OFFLINE' };
/** FAILED / OFFLINE: not known; asking again with the SAME command id is safe. */
export type IntroductionSuccessResult =
  | { readonly kind: 'APPROVED' | 'WITHDRAWN'; readonly eventId: string }
  | { readonly kind: 'COMPLETED' | 'CHANGED' | 'NOT_AVAILABLE_NOW' | 'COMMAND_CONFLICT' | 'UNAVAILABLE' | 'INVALID' | 'FAILED' | 'OFFLINE' };

export type IntroductionPauseReason = 'USER_PAUSED' | 'ACTIVE_INTRODUCTION' | 'POST_INTRODUCTION' | 'POST_SUCCESS' | 'SYSTEM_POLICY';
export type IntroductionParticipation =
  | { readonly state: 'ACTIVE'; readonly pauseReason: null; readonly expectedEventId: string }
  | { readonly state: 'PAUSED'; readonly pauseReason: IntroductionPauseReason; readonly expectedEventId: string }
  /** `expectedEventId` null: the reader never took part at all (absence is OFF). */
  | { readonly state: 'OFF'; readonly pauseReason: null; readonly expectedEventId: string | null };
export type IntroductionParticipationRead =
  | { readonly kind: 'READY'; readonly participation: IntroductionParticipation }
  | { readonly kind: 'FAILED' | 'OFFLINE' };
export type IntroductionResumeResult =
  | { readonly kind: 'REACTIVATED' }
  | { readonly kind: 'CHANGED' | 'NOT_ELIGIBLE' | 'NOT_AVAILABLE_NOW' | 'COMMAND_CONFLICT' | 'UNAVAILABLE' | 'INVALID' | 'FAILED' | 'OFFLINE' };

export interface IntroductionContinuationApiConfig {
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const REASONS: readonly IntroductionPauseReason[] = ['USER_PAUSED', 'ACTIVE_INTRODUCTION', 'POST_INTRODUCTION', 'POST_SUCCESS', 'SYSTEM_POLICY'];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
};
function bareOutcome<T extends string>(body: unknown, allowed: readonly T[]): T | null {
  if (!isRecord(body) || !hasExactly(body, ['outcome'])) return null;
  return allowed.find((word) => word === body.outcome) ?? null;
}

/** The reader's participation, coherent with the frozen lifecycle (a reason exactly when PAUSED), or `null`. */
export function decodeIntroductionParticipation(body: unknown): IntroductionParticipation | null {
  if (!isRecord(body) || !hasExactly(body, ['outcome', 'state', 'pauseReason', 'expectedEventId']) || body.outcome !== 'READY') return null;
  const { state, pauseReason, expectedEventId } = body;
  if (!(expectedEventId === null || isUuid(expectedEventId))) return null;
  const event = expectedEventId === null ? null : expectedEventId.toLowerCase();
  if (state === 'PAUSED') {
    return REASONS.includes(pauseReason as IntroductionPauseReason) && event !== null
      ? Object.freeze({ state, pauseReason: pauseReason as IntroductionPauseReason, expectedEventId: event }) : null;
  }
  if (pauseReason !== null) return null;
  if (state === 'ACTIVE') return event === null ? null : Object.freeze({ state, pauseReason: null, expectedEventId: event });
  return state === 'OFF' ? Object.freeze({ state, pauseReason: null, expectedEventId: event }) : null;
}

type Exchange = { readonly kind: 'OK'; readonly body: unknown } | { readonly kind: 'STATUS'; readonly status: number } | { readonly kind: 'NETWORK' };

export class IntroductionContinuationApiClient {
  constructor(private readonly config: IntroductionContinuationApiConfig) {}

  async success(worldId: string): Promise<IntroductionSuccessRead> {
    const answer = await this.exchange('GET', `${this.world(worldId)}/success`);
    if (answer.kind === 'NETWORK') return { kind: 'OFFLINE' };
    if (answer.kind !== 'OK') return { kind: 'FAILED' };
    const body = answer.body;
    if (isRecord(body) && hasExactly(body, ['outcome', 'versionId', 'myState', 'expectedEventId']) && body.outcome === 'TRANSITION'
        && isUuid(body.versionId) && (body.myState === 'NONE' || body.myState === 'APPROVED' || body.myState === 'WITHDRAWN')
        && (body.expectedEventId === null || isUuid(body.expectedEventId))
        // Approved or withdrawn always rests on the reader's own current act.
        && (body.myState === 'NONE' || body.expectedEventId !== null)) {
      return { kind: 'TRANSITION', versionId: body.versionId.toLowerCase(), myState: body.myState,
        expectedEventId: body.expectedEventId === null ? null : (body.expectedEventId as string).toLowerCase() };
    }
    return { kind: bareOutcome(body, ['NO_TRANSITION', 'ENDED', 'COMPLETED', 'UNAVAILABLE'] as const) ?? 'FAILED' };
  }

  async approve(worldId: string, commandId: string, versionId: string, expectedEventId: string | null): Promise<IntroductionSuccessResult> {
    const answer = await this.exchange('POST', `${this.world(worldId)}/success/approval`, { commandId, versionId, expectedEventId });
    return this.decided(answer, 'APPROVED', ['COMPLETED', 'CHANGED', 'NOT_AVAILABLE_NOW', 'COMMAND_CONFLICT', 'UNAVAILABLE']);
  }

  async withdraw(worldId: string, commandId: string, versionId: string, expectedEventId: string): Promise<IntroductionSuccessResult> {
    const answer = await this.exchange('POST', `${this.world(worldId)}/success/withdrawal`, { commandId, versionId, expectedEventId });
    return this.decided(answer, 'WITHDRAWN', ['CHANGED', 'COMMAND_CONFLICT', 'UNAVAILABLE']);
  }

  async participation(): Promise<IntroductionParticipationRead> {
    const answer = await this.exchange('GET', '/introductions/participation');
    if (answer.kind === 'NETWORK') return { kind: 'OFFLINE' };
    if (answer.kind !== 'OK') return { kind: 'FAILED' };
    const participation = decodeIntroductionParticipation(answer.body);
    return participation === null ? { kind: 'FAILED' } : { kind: 'READY', participation };
  }

  /** One explicit resume (RESUME after a post-Introduction pause) or turn-on (ACTIVATE from OFF), as the server decides. */
  async resume(commandId: string, expectedEventId: string, entryChannel: 'MANUAL_MY_WORLD_ENTRY' | null): Promise<IntroductionResumeResult> {
    const answer = await this.exchange('POST', '/introductions/participation/resume', { commandId, expectedEventId, entryChannel });
    if (answer.kind === 'NETWORK') return { kind: 'OFFLINE' };
    if (answer.kind === 'STATUS') return { kind: answer.status === 400 ? 'INVALID' : 'FAILED' };
    const body = answer.body;
    if (isRecord(body) && hasExactly(body, ['outcome', 'state']) && body.outcome === 'REACTIVATED' && typeof body.state === 'string') return { kind: 'REACTIVATED' };
    return { kind: bareOutcome(body, ['CHANGED', 'NOT_ELIGIBLE', 'NOT_AVAILABLE_NOW', 'COMMAND_CONFLICT', 'UNAVAILABLE'] as const) ?? 'FAILED' };
  }

  private decided(answer: Exchange, act: 'APPROVED' | 'WITHDRAWN',
    allowed: readonly ('COMPLETED' | 'CHANGED' | 'NOT_AVAILABLE_NOW' | 'COMMAND_CONFLICT' | 'UNAVAILABLE')[]): IntroductionSuccessResult {
    if (answer.kind === 'NETWORK') return { kind: 'OFFLINE' };
    if (answer.kind === 'STATUS') return { kind: answer.status === 400 ? 'INVALID' : 'FAILED' };
    const body = answer.body;
    if (isRecord(body) && hasExactly(body, ['outcome', 'eventId']) && body.outcome === act && isUuid(body.eventId)) return { kind: act, eventId: body.eventId.toLowerCase() };
    // The service answers the other words without an event; anything else is doubtful.
    if (isRecord(body) && hasExactly(body, ['outcome', 'eventId']) && allowed.includes(body.outcome as never) && isUuid(body.eventId)) return { kind: body.outcome as (typeof allowed)[number] };
    return { kind: bareOutcome(body, allowed) ?? 'FAILED' };
  }

  private world(worldId: string): string {
    return `/introductions/worlds/${encodeURIComponent(worldId)}`;
  }

  private async exchange(method: 'GET' | 'POST', path: string, payload?: unknown): Promise<Exchange> {
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: payload === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
      });
      if (!response.ok) return { kind: 'STATUS', status: response.status };
      return { kind: 'OK', body: (await response.json()) as unknown };
    } catch {
      return { kind: 'NETWORK' };
    }
  }
}
