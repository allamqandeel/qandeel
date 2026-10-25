/**
 * S8A-04 CP3-C — the owner's permissions for their own knowledge in ONE Shared World, on the S4-01 Shared transport
 * (`SharedWorldApiClient.permissions` and the three commands).
 *
 *   GET  /shared/worlds/:worldId/permissions                             — the reader's OWN request, items and endings
 *   POST /shared/worlds/:worldId/permissions/requests/:requestId/answer  — { commandId, decision, audienceRef? }
 *   POST /shared/worlds/:worldId/permissions/items/:itemId/allow         — { commandId, audienceRef }
 *   POST /shared/worlds/:worldId/permissions/items/:itemId/withdraw      — { commandId }
 *
 * Decoders only, strict: the other members arrive as names and the audience as an opaque reference — no user id is ever
 * received or sent. Anything else is no answer.
 */

/** Why a permission ended, in the Copy Gate's CG-5 vocabulary. */
export type SharedPermissionEnding = 'LEFT' | 'CORRECTED' | 'FORGOTTEN' | 'TURNED_OFF' | 'NO_LONGER_CURRENT';
export interface SharedPermissionRequest { readonly requestId: string; readonly itemId: string; readonly text: string }
export interface SharedPermissionItem { readonly itemId: string; readonly text: string }
export interface SharedPermissionReconfirm extends SharedPermissionItem { readonly newMembers: readonly string[] }
export interface SharedPermissionEnded { readonly itemId: string; readonly text: string | null; readonly reason: SharedPermissionEnding }
export interface SharedPermissions {
  /** The opaque reference of the audience `members` names; null when there is nothing to answer. */
  readonly audienceRef: string | null;
  /** The other current members, by name, in join order. */
  readonly members: readonly string[];
  readonly requests: readonly SharedPermissionRequest[];
  readonly allowed: readonly SharedPermissionItem[];
  readonly reconfirm: readonly SharedPermissionReconfirm[];
  readonly declined: readonly SharedPermissionItem[];
  readonly ended: readonly SharedPermissionEnded[];
}
export type SharedPermissionsResult =
  | { readonly kind: 'READ'; readonly permissions: SharedPermissions }
  /** Not this reader's World now — one neutral answer that reveals nothing. */
  | { readonly kind: 'DENIED' }
  | { readonly kind: 'UNAVAILABLE' };
export type SharedPermissionAnswerResult = { readonly kind: 'ALLOWED' | 'DECLINED' | 'AUDIENCE_CHANGED' | 'REFUSED' | 'UNAVAILABLE' };
export type SharedPermissionAllowResult = { readonly kind: 'ALLOWED' | 'AUDIENCE_CHANGED' | 'REFUSED' | 'UNAVAILABLE' };
export type SharedPermissionWithdrawResult = { readonly kind: 'WITHDRAWN' | 'REFUSED' | 'UNAVAILABLE' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const AUDIENCE_REF = /^sha256:[0-9a-f]{64}$/u;
const ENDINGS: readonly SharedPermissionEnding[] = ['LEFT', 'CORRECTED', 'FORGOTTEN', 'TURNED_OFF', 'NO_LONGER_CURRENT'];
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isNames = (value: unknown): value is string[] => Array.isArray(value) && value.every((name) => typeof name === 'string' && name.trim().length > 0);
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
};
function listOf<T>(value: unknown, item: (entry: Record<string, unknown>) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const entry of value) {
    const decoded = isRecord(entry) ? item(entry) : null;
    if (decoded === null) return null;
    out.push(decoded);
  }
  return out;
}
const itemOf = (e: Record<string, unknown>): SharedPermissionItem | null => (hasExactly(e, ['itemId', 'text']) && isUuid(e.itemId) && isText(e.text)
  ? Object.freeze({ itemId: e.itemId, text: e.text }) : null);

/** The reader's permissions in one World, strictly: exactly the READ view, or one neutral denial. */
export function decodeSharedPermissions(body: unknown): SharedPermissionsResult {
  if (!isRecord(body)) return { kind: 'UNAVAILABLE' };
  if (hasExactly(body, ['outcome']) && body.outcome === 'UNAVAILABLE') return { kind: 'DENIED' };
  if (body.outcome !== 'READ' || !hasExactly(body, ['outcome', 'audienceRef', 'members', 'requests', 'allowed', 'reconfirm', 'declined', 'ended'])
    || !(body.audienceRef === null || (typeof body.audienceRef === 'string' && AUDIENCE_REF.test(body.audienceRef))) || !isNames(body.members)) {
    return { kind: 'UNAVAILABLE' };
  }
  const requests = listOf(body.requests, (e) => (hasExactly(e, ['requestId', 'itemId', 'text']) && isUuid(e.requestId) && isUuid(e.itemId) && isText(e.text)
    ? Object.freeze({ requestId: e.requestId, itemId: e.itemId, text: e.text }) : null));
  const allowed = listOf(body.allowed, itemOf);
  const declined = listOf(body.declined, itemOf);
  const reconfirm = listOf(body.reconfirm, (e) => (hasExactly(e, ['itemId', 'text', 'newMembers']) && isUuid(e.itemId) && isText(e.text)
    && isNames(e.newMembers) && e.newMembers.length > 0 ? Object.freeze({ itemId: e.itemId, text: e.text, newMembers: Object.freeze([...e.newMembers]) }) : null));
  const ended = listOf(body.ended, (e) => (hasExactly(e, ['itemId', 'text', 'reason']) && isUuid(e.itemId) && (e.text === null || isText(e.text))
    && ENDINGS.includes(e.reason as SharedPermissionEnding) ? Object.freeze({ itemId: e.itemId, text: e.text as string | null, reason: e.reason as SharedPermissionEnding }) : null));
  if (requests === null || allowed === null || declined === null || reconfirm === null || ended === null) return { kind: 'UNAVAILABLE' };
  // Anything to answer needs the audience it is answered about.
  if (body.audienceRef === null && (requests.length > 0 || declined.length > 0 || reconfirm.length > 0)) return { kind: 'UNAVAILABLE' };
  return {
    kind: 'READ',
    permissions: Object.freeze({
      audienceRef: body.audienceRef as string | null, members: Object.freeze([...body.members]), requests: Object.freeze(requests),
      allowed: Object.freeze(allowed), reconfirm: Object.freeze(reconfirm), declined: Object.freeze(declined), ended: Object.freeze(ended),
    }),
  };
}

/** One command's word. UNAVAILABLE from the server (nothing to act on) is REFUSED; no word at all is UNAVAILABLE. */
export function decodeSharedPermissionAnswer(outcome: string | null): SharedPermissionAnswerResult {
  if (outcome === 'ALLOWED' || outcome === 'DECLINED' || outcome === 'AUDIENCE_CHANGED') return { kind: outcome };
  return { kind: outcome === 'UNAVAILABLE' ? 'REFUSED' : 'UNAVAILABLE' };
}
export function decodeSharedPermissionAllow(outcome: string | null): SharedPermissionAllowResult {
  if (outcome === 'ALLOWED' || outcome === 'AUDIENCE_CHANGED') return { kind: outcome };
  return { kind: outcome === 'UNAVAILABLE' ? 'REFUSED' : 'UNAVAILABLE' };
}
export function decodeSharedPermissionWithdraw(outcome: string | null): SharedPermissionWithdrawResult {
  if (outcome === 'WITHDRAWN') return { kind: 'WITHDRAWN' };
  return { kind: outcome === 'UNAVAILABLE' ? 'REFUSED' : 'UNAVAILABLE' };
}

/** The answer's exact body: Allow carries the opaque reference of the members the reader was shown; No carries none. */
export function sharedPermissionAnswerBody(commandId: string, decision: 'ALLOW' | 'DECLINE', ref: string | null): Readonly<Record<string, string | null>> {
  return decision === 'ALLOW' ? { commandId, decision, audienceRef: ref } : { commandId, decision };
}
/** Allow now / allow for everyone: the exact body, over the opaque reference of the members the reader was shown. */
export function sharedPermissionAllowBody(commandId: string, ref: string): Readonly<Record<string, string>> {
  return { commandId, audienceRef: ref };
}
