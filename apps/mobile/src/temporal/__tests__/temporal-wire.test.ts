import {
  decodeCommittedUnitsEvent,
  decodeCommittedUnitsPage,
  decodeCommittedUnitsResponse,
  decodeLiveFocusEventsPage,
  decodeLiveFocusEventsResponse,
  decodeLiveFocusTransitionEvent,
  decodeLiveFocusWireValue,
  decodeSessionTemporalSnapshot,
} from '../temporal-wire';

const VALID = Object.freeze({
  type: 'CONVERSATIONAL_UNITS_COMMITTED',
  version: 1,
  sessionId: 'session-1',
  batchId: 'batch-1',
  sourceTurnId: 'turn-1',
  firstSp: 20,
  lastSp: 23,
  unitCount: 4,
});

const event = (overrides: Record<string, unknown> = {}) => ({ ...VALID, ...overrides });

describe('committed-CU wire validation', () => {
  it('decodes a valid multi-Moment delivery event', () => {
    const decoded = decodeCommittedUnitsEvent(event());
    expect(decoded).toEqual({ ok: true, value: VALID });
  });

  it('decodes a single-Moment delivery event', () => {
    const decoded = decodeCommittedUnitsEvent(event({ firstSp: 1, lastSp: 1, unitCount: 1 }));
    expect(decoded.ok).toBe(true);
  });

  it('rejects an unknown key rather than ignoring it', () => {
    const decoded = decodeCommittedUnitsEvent({ ...VALID, liveFocus: { kind: 'NONE' } });
    expect(decoded).toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
  });

  it('rejects a missing key, a non-object and a null payload', () => {
    const { unitCount: _dropped, ...withoutCount } = VALID;
    for (const payload of [withoutCount, 'CONVERSATIONAL_UNITS_COMMITTED', 42, null, undefined, [VALID]]) {
      expect(decodeCommittedUnitsEvent(payload)).toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
    }
  });

  it('rejects a foreign type and an unsupported version', () => {
    expect(decodeCommittedUnitsEvent(event({ type: 'LIVE_HEAD_ADVANCED' }))).toMatchObject({ ok: false, reason: 'UNKNOWN_TYPE' });
    expect(decodeCommittedUnitsEvent(event({ type: 'WORLD_TRUTH_UPDATED' }))).toMatchObject({ ok: false, reason: 'UNKNOWN_TYPE' });
    for (const version of [0, 2, '1', null]) {
      expect(decodeCommittedUnitsEvent(event({ version }))).toMatchObject({ ok: false, reason: 'UNSUPPORTED_VERSION' });
    }
  });

  it('rejects a malformed Session Position: zero, negative, fractional or non-numeric', () => {
    for (const firstSp of [0, -1, 1.5, '20', null, Number.NaN, Number.MAX_SAFE_INTEGER + 2]) {
      expect(decodeCommittedUnitsEvent(event({ firstSp }))).toMatchObject({ ok: false, reason: 'INVALID_SESSION_POSITION' });
    }
    for (const lastSp of [0, -3, 23.5, '23', null]) {
      expect(decodeCommittedUnitsEvent(event({ lastSp }))).toMatchObject({ ok: false, reason: 'INVALID_SESSION_POSITION' });
    }
  });

  it('rejects an inverted range and a unit count that disagrees with it', () => {
    expect(decodeCommittedUnitsEvent(event({ firstSp: 23, lastSp: 20, unitCount: 4 }))).toMatchObject({ ok: false, reason: 'INVALID_RANGE' });
    for (const unitCount of [3, 5, 0, -4, 4.5, '4', null]) {
      expect(decodeCommittedUnitsEvent(event({ unitCount }))).toMatchObject({ ok: false, reason: 'UNIT_COUNT_MISMATCH' });
    }
  });

  it('rejects an empty or non-string identity', () => {
    for (const key of ['sessionId', 'batchId', 'sourceTurnId']) {
      expect(decodeCommittedUnitsEvent(event({ [key]: '' }))).toMatchObject({ ok: false, reason: 'INVALID_IDENTITY' });
      expect(decodeCommittedUnitsEvent(event({ [key]: 7 }))).toMatchObject({ ok: false, reason: 'INVALID_IDENTITY' });
    }
  });
});

const NONE = { kind: 'NONE' };
const EMERGING = { kind: 'EMERGING', emergingFocusId: '4ef8538d-ddda-5e11-b7d9-052be85de59a' };
const THREAD = { kind: 'THREAD', threadId: 'afc4fd81-fe54-5738-9545-e1053044d919' };
const snapshot = (overrides: Record<string, unknown> = {}) => ({ sessionId: 'session-1', liveHead: 12, liveFocus: NONE, liveFocusAtSp: null, ...overrides });

describe('Session live snapshot validation (LH + LF)', () => {
  it('accepts an established Live Head with each LF kind, and the technical absence sentinel with NONE', () => {
    expect(decodeSessionTemporalSnapshot(snapshot())).toEqual({ ok: true, value: snapshot() });
    expect(decodeSessionTemporalSnapshot(snapshot({ liveFocus: EMERGING, liveFocusAtSp: 12 }))).toEqual({ ok: true, value: snapshot({ liveFocus: EMERGING, liveFocusAtSp: 12 }) });
    expect(decodeSessionTemporalSnapshot(snapshot({ liveFocus: THREAD, liveFocusAtSp: 3 }))).toEqual({ ok: true, value: snapshot({ liveFocus: THREAD, liveFocusAtSp: 3 }) });
    // A departure to NONE is itself anchored at the SP where it became effective.
    expect(decodeSessionTemporalSnapshot(snapshot({ liveFocusAtSp: 5 }))).toEqual({ ok: true, value: snapshot({ liveFocusAtSp: 5 }) });
    expect(decodeSessionTemporalSnapshot(snapshot({ liveHead: null }))).toEqual({ ok: true, value: snapshot({ liveHead: null }) });
  });

  it('rejects zero, negative and non-integer Live Head values', () => {
    for (const liveHead of [0, -1, 0.5, '12', undefined, Number.NaN]) {
      expect(decodeSessionTemporalSnapshot(snapshot({ liveHead }))).toMatchObject({ ok: false, reason: 'INVALID_LIVE_HEAD' });
    }
  });

  it('rejects an unknown key, a missing LF key and a missing identity', () => {
    expect(decodeSessionTemporalSnapshot(snapshot({ liveFocusLabel: 'Ahmed' }))).toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
    const { liveFocus: _dropped, ...withoutFocus } = snapshot();
    expect(decodeSessionTemporalSnapshot(withoutFocus)).toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
    expect(decodeSessionTemporalSnapshot({ liveHead: 3 })).toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
    expect(decodeSessionTemporalSnapshot(snapshot({ sessionId: '' }))).toMatchObject({ ok: false, reason: 'INVALID_IDENTITY' });
  });

  it('no LF before the first SP, no LF beyond the Live Head, no non-NONE LF without its SP', () => {
    expect(decodeSessionTemporalSnapshot(snapshot({ liveHead: null, liveFocus: EMERGING, liveFocusAtSp: null }))).toMatchObject({ ok: false, reason: 'INVALID_LIVE_FOCUS' });
    expect(decodeSessionTemporalSnapshot(snapshot({ liveHead: null, liveFocusAtSp: 1 }))).toMatchObject({ ok: false, reason: 'INVALID_LIVE_FOCUS' });
    expect(decodeSessionTemporalSnapshot(snapshot({ liveFocus: THREAD, liveFocusAtSp: 13 }))).toMatchObject({ ok: false, reason: 'INVALID_LIVE_FOCUS' });
    expect(decodeSessionTemporalSnapshot(snapshot({ liveFocus: THREAD, liveFocusAtSp: null }))).toMatchObject({ ok: false, reason: 'INVALID_LIVE_FOCUS' });
    for (const liveFocusAtSp of [0, -1, 1.5, '3']) {
      expect(decodeSessionTemporalSnapshot(snapshot({ liveFocus: THREAD, liveFocusAtSp }))).toMatchObject({ ok: false, reason: 'INVALID_SESSION_POSITION' });
    }
  });
});

describe('Live Focus wire value validation', () => {
  it('accepts exactly the three closed kinds with exactly their own keys', () => {
    expect(decodeLiveFocusWireValue(NONE)).toEqual({ ok: true, value: NONE });
    expect(decodeLiveFocusWireValue(EMERGING)).toEqual({ ok: true, value: EMERGING });
    expect(decodeLiveFocusWireValue(THREAD)).toEqual({ ok: true, value: THREAD });
  });

  it('rejects a fourth kind, the kernel vocabulary, a label, a Home, a confidence and a missing reference', () => {
    for (const value of [{ kind: 'READING', readingId: 'r' }, { kind: 'EMERGING_FOCUS', emergingFocusId: 'f' }, { kind: 'ESTABLISHED_THREAD', threadId: 't' }, { kind: 1 }, null, 'NONE']) {
      expect(decodeLiveFocusWireValue(value)).toMatchObject({ ok: false, reason: 'INVALID_LIVE_FOCUS' });
    }
    for (const value of [{ ...NONE, label: 'x' }, { ...THREAD, home: { x: 0, y: 0 } }, { ...THREAD, confidence: 0.9 }, { ...EMERGING, threadId: 't' }, { kind: 'THREAD' }]) {
      expect(decodeLiveFocusWireValue(value)).toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
    }
    for (const value of [{ kind: 'THREAD', threadId: '' }, { kind: 'EMERGING', emergingFocusId: 7 }]) {
      expect(decodeLiveFocusWireValue(value)).toMatchObject({ ok: false, reason: 'INVALID_IDENTITY' });
    }
  });
});

describe('LIVE_FOCUS_TRANSITION wire validation', () => {
  const transition = (overrides: Record<string, unknown> = {}) => ({ type: 'LIVE_FOCUS_TRANSITION', version: 1, sessionId: 'session-1', atSp: 4, value: THREAD, ...overrides });

  it('decodes a valid transition for each kind', () => {
    expect(decodeLiveFocusTransitionEvent(transition())).toEqual({ ok: true, value: transition() });
    expect(decodeLiveFocusTransitionEvent(transition({ value: NONE })).ok).toBe(true);
    expect(decodeLiveFocusTransitionEvent(transition({ value: EMERGING })).ok).toBe(true);
  });

  it('rejects an unknown key, a foreign type, an unsupported version, a bad SP and a bad value', () => {
    expect(decodeLiveFocusTransitionEvent(transition({ sameSpEventSequence: 3 }))).toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
    expect(decodeLiveFocusTransitionEvent(transition({ type: 'CONVERSATIONAL_UNITS_COMMITTED' }))).toMatchObject({ ok: false, reason: 'UNKNOWN_TYPE' });
    expect(decodeLiveFocusTransitionEvent(transition({ version: 2 }))).toMatchObject({ ok: false, reason: 'UNSUPPORTED_VERSION' });
    for (const atSp of [0, -1, 1.5, '4', null]) {
      expect(decodeLiveFocusTransitionEvent(transition({ atSp }))).toMatchObject({ ok: false, reason: 'INVALID_SESSION_POSITION' });
    }
    expect(decodeLiveFocusTransitionEvent(transition({ value: { ...THREAD, label: 'Ahmed' } }))).toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
    expect(decodeLiveFocusTransitionEvent(transition({ sessionId: '' }))).toMatchObject({ ok: false, reason: 'INVALID_IDENTITY' });
  });

  it('decodes an ascending page, refuses two transitions at one SP or a descending page, and binds the envelope Session', () => {
    const first = transition({ atSp: 1, value: EMERGING });
    const second = transition({ atSp: 2, value: THREAD });
    expect(decodeLiveFocusEventsPage([first, second])).toEqual({ ok: true, value: [first, second] });
    expect(decodeLiveFocusEventsPage([])).toEqual({ ok: true, value: [] });
    expect(decodeLiveFocusEventsPage([second, first])).toMatchObject({ ok: false, reason: 'INVALID_RANGE' });
    expect(decodeLiveFocusEventsPage([first, transition({ atSp: 1, value: NONE })])).toMatchObject({ ok: false, reason: 'INVALID_RANGE' });
    expect(decodeLiveFocusEventsPage([first, transition({ atSp: 2, version: 0 })])).toMatchObject({ ok: false, reason: 'UNSUPPORTED_VERSION' });
    expect(decodeLiveFocusEventsResponse({ sessionId: 'session-1', events: [first, second] })).toEqual({ ok: true, value: { sessionId: 'session-1', events: [first, second] } });
    expect(decodeLiveFocusEventsResponse({ sessionId: 'session-9', events: [] })).toEqual({ ok: true, value: { sessionId: 'session-9', events: [] } });
    expect(decodeLiveFocusEventsResponse({ sessionId: 'session-2', events: [first] })).toMatchObject({ ok: false, reason: 'INVALID_IDENTITY' });
    expect(decodeLiveFocusEventsResponse({ sessionId: 'session-1', events: [first], liveFocus: NONE })).toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
  });
});

describe('committed-CU catch-up page validation', () => {
  const first = event({ batchId: 'batch-a', firstSp: 1, lastSp: 2, unitCount: 2 });
  const second = event({ batchId: 'batch-b', firstSp: 3, lastSp: 3, unitCount: 1 });

  it('preserves ascending Session Position order', () => {
    const decoded = decodeCommittedUnitsPage([first, second]);
    expect(decoded.ok).toBe(true);
    expect(decoded.ok && decoded.value.map((entry) => entry.firstSp)).toEqual([1, 3]);
  });

  it('accepts an empty page', () => {
    expect(decodeCommittedUnitsPage([])).toEqual({ ok: true, value: [] });
  });

  it('rejects an out-of-order or overlapping page instead of silently re-sorting it', () => {
    expect(decodeCommittedUnitsPage([second, first])).toMatchObject({ ok: false, reason: 'INVALID_RANGE' });
    expect(decodeCommittedUnitsPage([first, event({ batchId: 'batch-c', firstSp: 2, lastSp: 4, unitCount: 3 })]))
      .toMatchObject({ ok: false, reason: 'INVALID_RANGE' });
  });

  it('rejects a page carrying one malformed entry', () => {
    const decoded = decodeCommittedUnitsPage([first, event({ batchId: 'batch-b', firstSp: 3, lastSp: 3, unitCount: 9 })]);
    expect(decoded).toMatchObject({ ok: false, reason: 'UNIT_COUNT_MISMATCH' });
    expect(decoded.ok === false && decoded.detail).toContain('events[1]');
  });

  it('rejects a response envelope whose events belong to another Session', () => {
    expect(decodeCommittedUnitsResponse({ sessionId: 'session-1', events: [first] })).toMatchObject({ ok: true });
    expect(decodeCommittedUnitsResponse({ sessionId: 'session-2', events: [first] }))
      .toMatchObject({ ok: false, reason: 'INVALID_IDENTITY' });
    expect(decodeCommittedUnitsResponse({ sessionId: 'session-1', events: [first], liveHead: 2 }))
      .toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
    expect(decodeCommittedUnitsResponse({ sessionId: 'session-1', events: {} }))
      .toMatchObject({ ok: false, reason: 'MALFORMED_SHAPE' });
  });

  // FIX-T03A2-02: the envelope's Session identity SURVIVES decoding, so the
  // transport can bind it to the Session the caller actually requested. An
  // empty page carries no event whose Session could disagree with it.
  it('returns the envelope Session identity alongside the decoded events', () => {
    const decoded = decodeCommittedUnitsResponse({ sessionId: 'session-1', events: [first, second] });
    expect(decoded).toEqual({ ok: true, value: { sessionId: 'session-1', events: [first, second] } });
    const empty = decodeCommittedUnitsResponse({ sessionId: 'session-9', events: [] });
    expect(empty).toEqual({ ok: true, value: { sessionId: 'session-9', events: [] } });
  });
});
