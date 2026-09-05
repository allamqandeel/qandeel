/**
 * T-03A2 — runtime validation of the server temporal wire, extended
 * additively by T-03D with the authoritative Live Focus.
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
 * Live Focus crosses the wire as the closed reference identity only:
 * `NONE | EMERGING(emergingFocusId) | THREAD(threadId)`. No label, name, Home,
 * direction, relation count, confidence, importance, content or same-SP
 * sequence is accepted; an extra key is a malformed shape. When `liveHead` is
 * `null`, `liveFocus` must be `NONE`: no LF exists before the first SP.
 *
 * The shape rules are the T-02 kernel's own (`exactShapeIssue`,
 * `isSessionPosition`), so there is exactly one definition of "exact shape" on
 * the client.
 */
import type { ConversationalUnitsCommittedWireEvent, LiveFocusTransitionWireEvent, LiveFocusWireValue, SessionTemporalSnapshot } from '@qandeel/runtime';
import { exactShapeIssue, isPlainRecord, isSessionPosition } from '../state';

export const CONVERSATIONAL_UNITS_COMMITTED = 'CONVERSATIONAL_UNITS_COMMITTED';
export const CONVERSATIONAL_UNITS_COMMITTED_VERSION = 1;
export const LIVE_FOCUS_TRANSITION = 'LIVE_FOCUS_TRANSITION';
export const LIVE_FOCUS_TRANSITION_VERSION = 1;

export type WireRejectionReason =
  | 'MALFORMED_SHAPE'
  | 'UNKNOWN_TYPE'
  | 'UNSUPPORTED_VERSION'
  | 'INVALID_IDENTITY'
  | 'INVALID_SESSION_POSITION'
  | 'INVALID_RANGE'
  | 'UNIT_COUNT_MISMATCH'
  | 'INVALID_LIVE_HEAD'
  | 'INVALID_LIVE_FOCUS';

export type WireDecode<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: WireRejectionReason; readonly detail: string };

const EVENT_KEYS = ['type', 'version', 'sessionId', 'batchId', 'sourceTurnId', 'firstSp', 'lastSp', 'unitCount'] as const;
const SNAPSHOT_KEYS = ['sessionId', 'liveHead', 'liveFocus', 'liveFocusAtSp'] as const;
const LIVE_FOCUS_EVENT_KEYS = ['type', 'version', 'sessionId', 'atSp', 'value'] as const;

function reject(reason: WireRejectionReason, detail: string): WireDecode<never> {
  return { ok: false, reason, detail };
}

function isIdentity(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

function isSafeSessionPosition(value: unknown): value is number {
  return isSessionPosition(value) && Number.isSafeInteger(value);
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
  if (!isSafeSessionPosition(candidate.firstSp)) {
    return reject('INVALID_SESSION_POSITION', `event.firstSp: must be a safe-integer Session Position >= 1, got ${String(candidate.firstSp)}`);
  }
  if (!isSafeSessionPosition(candidate.lastSp)) {
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

/**
 * Decodes one wire Live Focus value: exactly the three closed kinds, each with
 * exactly its own keys. Anything else - a fourth kind, a label, a Home, a
 * confidence, a sequence - is a malformed shape, never a fourth LF value.
 */
export function decodeLiveFocusWireValue(raw: unknown, path = 'liveFocus'): WireDecode<LiveFocusWireValue> {
  if (!isPlainRecord(raw)) return reject('INVALID_LIVE_FOCUS', `${path}: must be a plain object`);
  switch (raw.kind) {
    case 'NONE': {
      const issue = exactShapeIssue(raw, path, ['kind']);
      return issue ? reject('MALFORMED_SHAPE', issue) : { ok: true, value: { kind: 'NONE' } };
    }
    case 'EMERGING': {
      const issue = exactShapeIssue(raw, path, ['kind', 'emergingFocusId']);
      if (issue) return reject('MALFORMED_SHAPE', issue);
      if (!isIdentity(raw.emergingFocusId)) return reject('INVALID_IDENTITY', `${path}.emergingFocusId: must be a non-empty identity string`);
      return { ok: true, value: { kind: 'EMERGING', emergingFocusId: raw.emergingFocusId } };
    }
    case 'THREAD': {
      const issue = exactShapeIssue(raw, path, ['kind', 'threadId']);
      if (issue) return reject('MALFORMED_SHAPE', issue);
      if (!isIdentity(raw.threadId)) return reject('INVALID_IDENTITY', `${path}.threadId: must be a non-empty identity string`);
      return { ok: true, value: { kind: 'THREAD', threadId: raw.threadId } };
    }
    default:
      return reject('INVALID_LIVE_FOCUS', `${path}.kind: must be NONE, EMERGING or THREAD, got ${String(raw.kind)}`);
  }
}

/** Decodes one `LIVE_FOCUS_TRANSITION` delivery event. */
export function decodeLiveFocusTransitionEvent(raw: unknown): WireDecode<LiveFocusTransitionWireEvent> {
  const issue = exactShapeIssue(raw, 'event', LIVE_FOCUS_EVENT_KEYS);
  if (issue) return reject('MALFORMED_SHAPE', issue);
  const candidate = raw as Record<(typeof LIVE_FOCUS_EVENT_KEYS)[number], unknown>;
  if (candidate.type !== LIVE_FOCUS_TRANSITION) {
    return reject('UNKNOWN_TYPE', `event.type: expected ${LIVE_FOCUS_TRANSITION}, got ${String(candidate.type)}`);
  }
  if (candidate.version !== LIVE_FOCUS_TRANSITION_VERSION) {
    return reject('UNSUPPORTED_VERSION', `event.version: expected ${LIVE_FOCUS_TRANSITION_VERSION}, got ${String(candidate.version)}`);
  }
  if (!isIdentity(candidate.sessionId)) return reject('INVALID_IDENTITY', 'event.sessionId: must be a non-empty identity string');
  if (!isSafeSessionPosition(candidate.atSp)) {
    return reject('INVALID_SESSION_POSITION', `event.atSp: must be a safe-integer Session Position >= 1, got ${String(candidate.atSp)}`);
  }
  const value = decodeLiveFocusWireValue(candidate.value, 'event.value');
  if (!value.ok) return value;
  return {
    ok: true,
    value: { type: LIVE_FOCUS_TRANSITION, version: LIVE_FOCUS_TRANSITION_VERSION, sessionId: candidate.sessionId, atSp: candidate.atSp, value: value.value },
  };
}

/**
 * Decodes the authoritative `{ sessionId, liveHead, liveFocus, liveFocusAtSp }`
 * Session live snapshot. `liveHead = null` forces `liveFocus = NONE` and
 * `liveFocusAtSp = null`; an LF anchored beyond the Live Head is refused.
 */
export function decodeSessionTemporalSnapshot(raw: unknown): WireDecode<SessionTemporalSnapshot> {
  const issue = exactShapeIssue(raw, 'snapshot', SNAPSHOT_KEYS);
  if (issue) return reject('MALFORMED_SHAPE', issue);
  const candidate = raw as Record<(typeof SNAPSHOT_KEYS)[number], unknown>;
  if (!isIdentity(candidate.sessionId)) {
    return reject('INVALID_IDENTITY', 'snapshot.sessionId: must be a non-empty identity string');
  }
  if (candidate.liveHead !== null && !isSafeSessionPosition(candidate.liveHead)) {
    return reject('INVALID_LIVE_HEAD', `snapshot.liveHead: must be null or a safe-integer Session Position >= 1, got ${String(candidate.liveHead)}`);
  }
  const liveFocus = decodeLiveFocusWireValue(candidate.liveFocus, 'snapshot.liveFocus');
  if (!liveFocus.ok) return liveFocus;
  if (candidate.liveFocusAtSp !== null && !isSafeSessionPosition(candidate.liveFocusAtSp)) {
    return reject('INVALID_SESSION_POSITION', `snapshot.liveFocusAtSp: must be null or a safe-integer Session Position >= 1, got ${String(candidate.liveFocusAtSp)}`);
  }
  const liveHead = candidate.liveHead as number | null;
  const liveFocusAtSp = candidate.liveFocusAtSp as number | null;
  if (liveHead === null && (liveFocus.value.kind !== 'NONE' || liveFocusAtSp !== null)) {
    return reject('INVALID_LIVE_FOCUS', 'snapshot.liveFocus: no Live Focus exists before the first committed Session Position');
  }
  if (liveFocus.value.kind !== 'NONE' && liveFocusAtSp === null) {
    return reject('INVALID_LIVE_FOCUS', 'snapshot.liveFocusAtSp: a non-NONE Live Focus became effective at a committed Session Position');
  }
  if (liveHead !== null && liveFocusAtSp !== null && liveFocusAtSp > liveHead) {
    return reject('INVALID_LIVE_FOCUS', `snapshot.liveFocusAtSp: ${liveFocusAtSp} lies beyond the Live Head ${liveHead}`);
  }
  return { ok: true, value: { sessionId: candidate.sessionId, liveHead, liveFocus: liveFocus.value, liveFocusAtSp } };
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

/** Decodes an ordered LF transition catch-up page: strictly ascending `atSp`, exactly one transition per SP. */
export function decodeLiveFocusEventsPage(raw: unknown): WireDecode<readonly LiveFocusTransitionWireEvent[]> {
  if (!Array.isArray(raw)) return reject('MALFORMED_SHAPE', 'events: must be an array');
  const decoded: LiveFocusTransitionWireEvent[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const result = decodeLiveFocusTransitionEvent(raw[index]);
    if (!result.ok) return reject(result.reason, `events[${index}] ${result.detail}`);
    const previous = decoded[decoded.length - 1];
    if (previous && result.value.atSp <= previous.atSp) {
      return reject('INVALID_RANGE', `events[${index}]: Live Focus transitions must ascend by Session Position`);
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

/** The decoded LF catch-up envelope. The Session identity SURVIVES decoding, exactly as for committed units. */
export interface LiveFocusEventsResponse {
  readonly sessionId: string;
  readonly events: readonly LiveFocusTransitionWireEvent[];
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

/** The LF catch-up envelope, under the same FIX-T03A2-02 rule: the Session identity survives, and a foreign event is refused. */
export function decodeLiveFocusEventsResponse(raw: unknown): WireDecode<LiveFocusEventsResponse> {
  const issue = exactShapeIssue(raw, 'response', ['sessionId', 'events']);
  if (issue) return reject('MALFORMED_SHAPE', issue);
  const candidate = raw as { sessionId: unknown; events: unknown };
  const { sessionId } = candidate;
  if (!isIdentity(sessionId)) {
    return reject('INVALID_IDENTITY', 'response.sessionId: must be a non-empty identity string');
  }
  const page = decodeLiveFocusEventsPage(candidate.events);
  if (!page.ok) return page;
  const foreign = page.value.find((event) => event.sessionId !== sessionId);
  if (foreign) {
    return reject('INVALID_IDENTITY', `response.events: the transition at SP ${foreign.atSp} belongs to another Session`);
  }
  return { ok: true, value: { sessionId, events: page.value } };
}

/** Narrow guard for callers that only need to know whether a payload is an object. */
export { isPlainRecord };
