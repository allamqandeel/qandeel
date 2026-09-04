/**
 * T-03A2 — runtime validation of the server temporal wire.
 *
 * A TypeScript interface is a compile-time claim about a value the client did
 * not produce. Delivered JSON is untrusted at runtime, so every field is
 * checked here against its exact shape and bounds before it can influence
 * canonical client state: exact keys (allowlist, never a blacklist), the frozen
 * type and version, safe-integer Session Positions, `firstSp >= 1`,
 * `lastSp >= firstSp`, and `unitCount === lastSp - firstSp + 1`.
 *
 * `liveHead` accepts `null` — the technical absence of any user-addressable
 * committed Session Position — and rejects `0`, negatives and non-integers. The
 * server never sends a zero sentinel, and the client never invents one.
 *
 * The shape rules are the T-02 kernel's own (`exactShapeIssue`,
 * `isSessionPosition`), so there is exactly one definition of "exact shape" on
 * the client.
 */
import type { ConversationalUnitsCommittedWireEvent, SessionTemporalSnapshot } from '@qandeel/runtime';
import { exactShapeIssue, isPlainRecord, isSessionPosition } from '../state';

export const CONVERSATIONAL_UNITS_COMMITTED = 'CONVERSATIONAL_UNITS_COMMITTED';
export const CONVERSATIONAL_UNITS_COMMITTED_VERSION = 1;

export type WireRejectionReason =
  | 'MALFORMED_SHAPE'
  | 'UNKNOWN_TYPE'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_IDENTITY'
  | 'INVALID_SESSION_POSITION'
  | 'INVALID_RANGE'
  | 'UNIT_COUNT_MISMATCH'
  | 'INVALID_LIVE_HEAD';

export type WireDecode<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: WireRejectionReason; readonly detail: string };

const EVENT_KEYS = ['type', 'version', 'sessionId', 'batchId', 'sourceTurnId', 'firstSp', 'lastSp', 'unitCount'] as const;
const SNAPSHOT_KEYS = ['sessionId', 'liveHead'] as const;

function reject(reason: WireRejectionReason, detail: string): WireDecode<never> {
  return { ok: false, reason, detail };
}

function isIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

/** Decodes one `CONVERSATIONAL_UNITS_COMMITTED` delivery event. */
export function decodeCommittedUnitsEvent(raw: unknown): WireDecode<ConversationalUnitsCommittedWireEvent> {
  const issue = exactShapeIssue(raw, 'event', EVENT_KEYS);
  if (issue) return reject('MALFORMED_SHAPE', issue);
  const candidate = raw as Record<(typeof EVENT_KEYS)[number], unknown>;

  if (candidate.type !== CONVERSATIONAL_UNITS_COMMITTED) {
    return reject('UNKNOWN_TYPE', `event.type: expected ${CONVERSATIONAL_UNITS_COMMITTED}, got ${String(candidate.type)}`);
  }
  if (candidate.version !== CONVERSATIONAL_UNITS_COMMITTED_VERSION) {
    return reject('UNSUPPORTED_VERSION', `event.version: expected ${CONVERSATIONAL_UNITS_COMMITTED_VERSION}, got ${String(candidate.version)}`);
  }
  const { sessionId, batchId, sourceTurnId } = candidate;
  if (!isIdentity(sessionId)) return reject('INVALID_IDENTITY', 'event.sessionId: must be a non-empty identity string');
  if (!isIdentity(batchId)) return reject('INVALID_IDENTITY', 'event.batchId: must be a non-empty identity string');
  if (!isIdentity(sourceTurnId)) return reject('INVALID_IDENTITY', 'event.sourceTurnId: must be a non-empty identity string');
  // Safe integers, not merely integers: a value beyond 2^53-1 has already lost
  // precision, so it can never be a trustworthy Session Position.
  if (!isSessionPosition(candidate.firstSp) || !Number.isSafeInteger(candidate.firstSp)) {
    return reject('INVALID_SESSION_POSITION', `event.firstSp: must be a safe-integer Session Position >= 1, got ${String(candidate.firstSp)}`);
  }
  if (!isSessionPosition(candidate.lastSp) || !Number.isSafeInteger(candidate.lastSp)) {
    return reject('INVALID_SESSION_POSITION', `event.lastSp: must be a safe-integer Session Position >= 1, got ${String(candidate.lastSp)}`);
  }
  if (candidate.lastSp < candidate.firstSp) {
    return reject('INVALID_RANGE', `event: lastSp ${candidate.lastSp} precedes firstSp ${candidate.firstSp}`);
  }
  if (
    typeof candidate.unitCount !== 'number'
    || !Number.isSafeInteger(candidate.unitCount)
    || candidate.unitCount !== candidate.lastSp - candidate.firstSp + 1
  ) {
    return reject('UNIT_COUNT_MISMATCH', `event.unitCount: must equal lastSp - firstSp + 1, got ${String(candidate.unitCount)}`);
  }
  return {
    ok: true,
    value: {
      type: CONVERSATIONAL_UNITS_COMMITTED,
      version: CONVERSATIONAL_UNITS_COMMITTED_VERSION,
      sessionId,
      batchId,
      sourceTurnId,
      firstSp: candidate.firstSp,
      lastSp: candidate.lastSp,
      unitCount: candidate.unitCount,
    },
  };
}

/** Decodes the authoritative `{ sessionId, liveHead }` Session temporal snapshot. */
export function decodeSessionTemporalSnapshot(raw: unknown): WireDecode<SessionTemporalSnapshot> {
  const issue = exactShapeIssue(raw, 'snapshot', SNAPSHOT_KEYS);
  if (issue) return reject('MALFORMED_SHAPE', issue);
  const candidate = raw as Record<(typeof SNAPSHOT_KEYS)[number], unknown>;
  if (!isIdentity(candidate.sessionId)) {
    return reject('INVALID_IDENTITY', 'snapshot.sessionId: must be a non-empty identity string');
  }
  if (candidate.liveHead !== null && (!isSessionPosition(candidate.liveHead) || !Number.isSafeInteger(candidate.liveHead))) {
    return reject('INVALID_LIVE_HEAD', `snapshot.liveHead: must be null or a safe-integer Session Position >= 1, got ${String(candidate.liveHead)}`);
  }
  return { ok: true, value: { sessionId: candidate.sessionId, liveHead: candidate.liveHead } };
}

/**
 * Decodes an ordered committed-CU catch-up page.
 *
 * Ascending `firstSp` order is part of the contract, so a page that arrives out
 * of order is REJECTED rather than silently re-sorted: reordering delivered
 * truth would hide a real transport or server defect.
 */
export function decodeCommittedUnitsPage(raw: unknown): WireDecode<readonly ConversationalUnitsCommittedWireEvent[]> {
  if (!Array.isArray(raw)) return reject('MALFORMED_SHAPE', 'events: must be an array');
  const decoded: ConversationalUnitsCommittedWireEvent[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const result = decodeCommittedUnitsEvent(raw[index]);
    if (!result.ok) return reject(result.reason, `events[${index}] ${result.detail}`);
    const previous = decoded[decoded.length - 1];
    if (previous && result.value.firstSp <= previous.lastSp) {
      return reject('INVALID_RANGE', `events[${index}]: delivery events must ascend by Session Position`);
    }
    decoded.push(result.value);
  }
  return { ok: true, value: decoded };
}

/** The decoded catch-up envelope. The Session identity SURVIVES decoding. */
export interface CommittedUnitsResponse {
  readonly sessionId: string;
  readonly events: readonly ConversationalUnitsCommittedWireEvent[];
}

/**
 * The transport envelope of the catch-up route: `{ sessionId, events }`.
 *
 * FIX-T03A2-02: the envelope's own Session identity is RETURNED rather than
 * discarded, so the transport can bind it to the Session the caller actually
 * requested. Without that, an empty page carries no event whose Session could
 * disagree with the envelope, and a foreign-Session envelope would decode
 * cleanly.
 */
export function decodeCommittedUnitsResponse(raw: unknown): WireDecode<CommittedUnitsResponse> {
  const issue = exactShapeIssue(raw, 'response', ['sessionId', 'events']);
  if (issue) return reject('MALFORMED_SHAPE', issue);
  const candidate = raw as { sessionId: unknown; events: unknown };
  const { sessionId } = candidate;
  if (!isIdentity(sessionId)) {
    return reject('INVALID_IDENTITY', 'response.sessionId: must be a non-empty identity string');
  }
  const page = decodeCommittedUnitsPage(candidate.events);
  if (!page.ok) return page;
  const foreign = page.value.find((event) => event.sessionId !== sessionId);
  if (foreign) {
    return reject('INVALID_IDENTITY', `response.events: event ${foreign.batchId} belongs to another Session`);
  }
  return { ok: true, value: { sessionId, events: page.value } };
}

/** Narrow guard for callers that only need to know whether a payload is an object. */
export { isPlainRecord };
