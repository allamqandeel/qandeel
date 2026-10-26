import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { SharedWorldPermissionsRepository, type SharedPermissionRow } from './shared-world-permissions.repository';
import { SharedWorldRepository } from './shared-world.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const AUDIENCE_REF = /^sha256:[0-9a-f]{64}$/u;

/**
 * Why a permission ended, in the Copy Gate's CG-5 vocabulary. CG-5 has one text for an ending by time; the database's
 * other two endings that can reach this read (an item no longer eligible, a World no longer open) take that same text.
 */
export type SharedPermissionEnding = 'LEFT' | 'CORRECTED' | 'FORGOTTEN' | 'TURNED_OFF' | 'NO_LONGER_CURRENT';
const ENDINGS: Readonly<Record<string, SharedPermissionEnding>> = {
  LEFT: 'LEFT', CORRECTED: 'CORRECTED', FORGOTTEN: 'FORGOTTEN', TURNED_OFF: 'TURNED_OFF',
  EXPIRED: 'NO_LONGER_CURRENT', INELIGIBLE: 'NO_LONGER_CURRENT', WORLD_CLOSED: 'NO_LONGER_CURRENT',
};

export interface SharedPermissionRequestView { readonly requestId: string; readonly itemId: string; readonly text: string }
export interface SharedPermissionItemView { readonly itemId: string; readonly text: string }
export interface SharedPermissionReconfirmView extends SharedPermissionItemView { readonly newMembers: readonly string[] }
export interface SharedPermissionEndedView { readonly itemId: string; readonly text: string | null; readonly reason: SharedPermissionEnding }
export type SharedPermissionsView =
  | {
    readonly outcome: 'READ';
    /** The opaque reference of the audience these names are; null when there is nothing to answer. */
    readonly audienceRef: string | null;
    /** The other current members, by name, in join order (CG-1 / CG-4 {members}). */
    readonly members: readonly string[];
    readonly requests: readonly SharedPermissionRequestView[];
    readonly allowed: readonly SharedPermissionItemView[];
    readonly reconfirm: readonly SharedPermissionReconfirmView[];
    readonly declined: readonly SharedPermissionItemView[];
    readonly ended: readonly SharedPermissionEndedView[];
  }
  | { readonly outcome: 'UNAVAILABLE' };
export type SharedPermissionAnswerView = { readonly outcome: 'ALLOWED' | 'DECLINED' | 'AUDIENCE_CHANGED' | 'UNAVAILABLE' };
export type SharedPermissionAllowView = { readonly outcome: 'ALLOWED' | 'AUDIENCE_CHANGED' | 'UNAVAILABLE' };
export type SharedPermissionWithdrawView = { readonly outcome: 'WITHDRAWN' | 'UNAVAILABLE' };

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException('Shared World is unavailable.'); };
/** Exactly these keys; `commandId` always a UUID. */
function commandOf(body: unknown, keys: readonly string[]): Record<string, unknown> {
  const value = record(body);
  if (Object.keys(value).some((key) => !keys.includes(key)) || typeof value.commandId !== 'string' || !UUID.test(value.commandId)) invalid();
  return value;
}
const names = (value: unknown): string[] | null => (Array.isArray(value) && value.every((n) => typeof n === 'string' && n.trim().length > 0)
  ? value as string[] : null);
const text = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

/**
 * S8A-04 CP3-C — «ما سمحت به هنا» / "What you've allowed here" and the private request (Copy Gate CG-1 – CG-5, approved
 * 6/6 on 2026-10-25; the CP3-C authorization §3 – §4). Every operation is the caller's own, on their own token: the entry
 * verdict first, then migration 0177's owner read and commands, which derive the owner from `auth.uid()`, check the
 * World, the membership episode, the item and the audience, and write only the owner's own consent. No route takes or
 * returns a user id: other members are names, the audience the owner answered about is an opaque reference, and a stale
 * reference writes nothing. No act here produces Activity, a notification, a message or a log line.
 */
@Injectable()
export class SharedWorldPermissionsService {
  constructor(
    private readonly permissions: SharedWorldPermissionsRepository,
    private readonly shared: SharedWorldRepository,
  ) {}

  read(token: string, worldId: string): Promise<SharedPermissionsView> {
    if (!UUID.test(worldId)) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    return this.guard(async () => {
      if (!(await this.allowed(token, worldId))) return { outcome: 'UNAVAILABLE' };
      return this.decode(await this.permissions.list(token, worldId));
    });
  }

  /** CG-1 / CG-2: Allow (over the audience the owner was shown) or No. The request must be this World's open request. */
  async answer(token: string, worldId: string, requestId: string, body: unknown): Promise<SharedPermissionAnswerView> {
    const value = commandOf(body, ['commandId', 'decision', 'audienceRef']);
    const decision = value.decision;
    if (decision === 'ALLOW') {
      if (typeof value.audienceRef !== 'string' || !AUDIENCE_REF.test(value.audienceRef)) invalid();
    } else if (decision !== 'DECLINE' || 'audienceRef' in value) invalid();
    if (!UUID.test(worldId) || !UUID.test(requestId)) return { outcome: 'UNAVAILABLE' };
    return this.guard(async () => {
      if (!(await this.allowed(token, worldId))) return { outcome: 'UNAVAILABLE' };
      const view = this.decode(await this.permissions.list(token, worldId));
      if (view.outcome !== 'READ' || !view.requests.some((r) => r.requestId === requestId)) return { outcome: 'UNAVAILABLE' };
      const [row] = await this.permissions.answer(token, value.commandId as string, requestId, decision as 'ALLOW' | 'DECLINE',
        decision === 'ALLOW' ? value.audienceRef as string : null);
      if (row?.outcome === 'ALLOWED' || row?.outcome === 'DECLINED' || row?.outcome === 'AUDIENCE_CHANGED' || row?.outcome === 'UNAVAILABLE') {
        return { outcome: row.outcome };
      }
      return unavailable();
    });
  }

  /** CG-4 «اسمح الآن» and CG-3 «اسمح للجميع»: allow again an item already decided about here, over the audience shown. */
  async allow(token: string, worldId: string, itemId: string, body: unknown): Promise<SharedPermissionAllowView> {
    const value = commandOf(body, ['commandId', 'audienceRef']);
    if (typeof value.audienceRef !== 'string' || !AUDIENCE_REF.test(value.audienceRef)) invalid();
    if (!UUID.test(worldId) || !UUID.test(itemId)) return { outcome: 'UNAVAILABLE' };
    return this.guard(async () => {
      if (!(await this.allowed(token, worldId))) return { outcome: 'UNAVAILABLE' };
      const [row] = await this.permissions.allow(token, value.commandId as string, worldId, itemId, value.audienceRef as string);
      if (row?.outcome === 'ALLOWED' || row?.outcome === 'AUDIENCE_CHANGED' || row?.outcome === 'UNAVAILABLE') return { outcome: row.outcome };
      return unavailable();
    });
  }

  /** CG-4 «اسحب» and CG-3 «أوقف استخدامها»: both grants end, for the future only. */
  async withdraw(token: string, worldId: string, itemId: string, body: unknown): Promise<SharedPermissionWithdrawView> {
    const { commandId } = commandOf(body, ['commandId']);
    if (!UUID.test(worldId) || !UUID.test(itemId)) return { outcome: 'UNAVAILABLE' };
    return this.guard(async () => {
      if (!(await this.allowed(token, worldId))) return { outcome: 'UNAVAILABLE' };
      const [row] = await this.permissions.withdraw(token, commandId as string, worldId, itemId);
      if (row?.outcome === 'REVOKED') return { outcome: 'WITHDRAWN' };
      if (row?.outcome === 'UNAVAILABLE') return { outcome: 'UNAVAILABLE' };
      return unavailable();
    });
  }

  /**
   * Strict: every row of one read names the same audience (reference and names). A member the World cannot name makes
   * the whole read UNAVAILABLE — consent is never asked over an audience the owner cannot be shown.
   */
  private decode(rows: readonly SharedPermissionRow[]): SharedPermissionsView {
    const out = { requests: [] as SharedPermissionRequestView[], allowed: [] as SharedPermissionItemView[],
      reconfirm: [] as SharedPermissionReconfirmView[], declined: [] as SharedPermissionItemView[], ended: [] as SharedPermissionEndedView[] };
    const first = rows[0];
    const members = first ? names(first.member_names) : [];
    const audienceRef = first ? first.audience_ref : null;
    if (members === null || (audienceRef !== null && (typeof audienceRef !== 'string' || !AUDIENCE_REF.test(audienceRef)))) return unavailable();
    for (const row of rows) {
      if (!row || typeof row.memory_id !== 'string' || !UUID.test(row.memory_id) || row.audience_ref !== audienceRef
          || JSON.stringify(names(row.member_names)) !== JSON.stringify(members)) return unavailable();
      const words = text(row.content);
      switch (row.section) {
        case 'REQUEST':
          if (words === null || typeof row.request_id !== 'string' || !UUID.test(row.request_id)) return unavailable();
          out.requests.push({ requestId: row.request_id, itemId: row.memory_id, text: words });
          break;
        case 'ALLOWED':
        case 'DECLINED':
          if (words === null) return unavailable();
          out[row.section === 'ALLOWED' ? 'allowed' : 'declined'].push({ itemId: row.memory_id, text: words });
          break;
        case 'NEEDS_RECONFIRMATION': {
          const newMembers = names(row.new_member_names);
          if (words === null || newMembers === null || newMembers.length === 0) return unavailable();
          out.reconfirm.push({ itemId: row.memory_id, text: words, newMembers });
          break;
        }
        case 'ENDED': {
          const reason = typeof row.ended_reason === 'string' ? ENDINGS[row.ended_reason] : undefined;
          if (!reason) return unavailable();
          out.ended.push({ itemId: row.memory_id, text: words, reason });
          break;
        }
        default:
          return unavailable();
      }
    }
    return { outcome: 'READ', audienceRef, members, ...out };
  }

  private async allowed(token: string, worldId: string): Promise<boolean> {
    const [verdict] = await this.shared.resolveEntry(token, worldId);
    return verdict?.outcome === 'ALLOW' && verdict.world_id === worldId;
  }

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      // A request the database itself refuses as malformed (22023 → 400): the client's own contradiction.
      if (error instanceof DataApiError && error.status === 400) return invalid();
      return unavailable();
    }
  }
}
