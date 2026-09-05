import { RFC4122_URL_NAMESPACE, uuidV5 } from '../runtime-identity/uuid-v5';
import {
  canonicalizePreparedLiveFocusDecision,
  canonicalizePreparedLiveFocusSequence,
  durableLiveFocusTransitionId,
  LIVE_FOCUS_TRANSITION_NAMESPACE,
  type PreparedLiveFocusDecision,
} from './durable-live-focus-canonicalizer';
import { LiveFocusCanonicalizationError } from './durable-live-focus-payload.types';
import { LIVE_FOCUS_NONE, type EffectiveLiveFocus, type LiveFocusReduction } from './live-focus.types';

const SESSION = '33333333-3333-4333-8333-333333333333';
const CU = '11111111-2222-4333-8444-555555555555';
const FOCUS = '4ef8538d-ddda-5e11-b7d9-052be85de59a';
const THREAD = 'afc4fd81-fe54-5738-9545-e1053044d919';
const EMERGING: EffectiveLiveFocus = { kind: 'EMERGING', emergingFocusId: FOCUS };
const THREAD_VALUE: EffectiveLiveFocus = { kind: 'THREAD', threadId: THREAD };
const decision = (reduction: LiveFocusReduction, cuId = CU): PreparedLiveFocusDecision => ({ cuId, reduction });
const failure = (run: () => unknown) => {
  try { run(); } catch (error) {
    expect(error).toBeInstanceOf(LiveFocusCanonicalizationError);
    return (error as LiveFocusCanonicalizationError).reason;
  }
  throw new Error('expected a canonicalization failure');
};

describe('deterministic LF identity (cases 23-25)', () => {
  it('23. the namespace re-derives from its documented URI and the three vectors reproduce byte-for-byte what migration 0071 pins', () => {
    expect(LIVE_FOCUS_TRANSITION_NAMESPACE).toBe('14cd67f4-be9d-54f6-b735-cbe38a7cb311');
    expect(LIVE_FOCUS_TRANSITION_NAMESPACE).toBe(uuidV5(RFC4122_URL_NAMESPACE, 'https://qandeel.app/runtime/live-focus-transition/v1'));
    expect(durableLiveFocusTransitionId(SESSION, CU, LIVE_FOCUS_NONE)).toBe('31ae1e67-d4f8-541a-8188-f9db29f6cc20');
    expect(durableLiveFocusTransitionId(SESSION, CU, EMERGING)).toBe('ebf823d1-1081-5ae2-94ac-aa69b9d62ccc');
    expect(durableLiveFocusTransitionId(SESSION, CU, THREAD_VALUE)).toBe('12ac4f9b-1865-5bfd-8c5e-cebb1e178b98');
  });

  it('24. the identity is a function of Session, CU, kind and reference alone: a different reference or kind is a different identity', () => {
    expect(durableLiveFocusTransitionId(SESSION, CU, EMERGING)).not.toBe(durableLiveFocusTransitionId(SESSION, CU, { kind: 'EMERGING', emergingFocusId: THREAD }));
    expect(durableLiveFocusTransitionId(SESSION, CU, { kind: 'THREAD', threadId: FOCUS })).not.toBe(durableLiveFocusTransitionId(SESSION, CU, EMERGING));
    expect(durableLiveFocusTransitionId(SESSION, CU, EMERGING)).toBe(durableLiveFocusTransitionId(SESSION, CU, EMERGING));
  });

  it('25. no random identity, no non-UUID identity', () => {
    expect(failure(() => durableLiveFocusTransitionId('session-1', CU, EMERGING))).toBe('INVALID_DURABLE_IDENTITY');
    expect(failure(() => durableLiveFocusTransitionId(SESSION, CU, { kind: 'EMERGING', emergingFocusId: 'prepared:focus:1' }))).toBe('INVALID_DURABLE_IDENTITY');
  });
});

describe('prepared -> canonical LF payload (cases 26-32)', () => {
  it('26. an unchanged LF canonicalizes to exactly six keys with no reason and no identity', () => {
    const payload = canonicalizePreparedLiveFocusDecision(decision({ effective: EMERGING, transition: null }), { sessionId: SESSION });
    expect(payload).toEqual({ unit_id: CU, effective_kind: 'EMERGING', effective_ref: FOCUS, transition: false, reason_code: null, transition_event_id: null });
    expect(Object.keys(payload).sort()).toEqual(['effective_kind', 'effective_ref', 'reason_code', 'transition', 'transition_event_id', 'unit_id']);
    expect(Object.isFrozen(payload)).toBe(true);
  });

  it('27. a transition canonicalizes with its frozen reason and the derived identity, and NONE carries no reference', () => {
    const toThread = canonicalizePreparedLiveFocusDecision(decision({ effective: THREAD_VALUE, transition: { from: EMERGING, to: THREAD_VALUE, reasonCode: 'THREAD_PROMOTION' } }), { sessionId: SESSION });
    expect(toThread).toEqual({ unit_id: CU, effective_kind: 'THREAD', effective_ref: THREAD, transition: true, reason_code: 'THREAD_PROMOTION', transition_event_id: '12ac4f9b-1865-5bfd-8c5e-cebb1e178b98' });
    const toNone = canonicalizePreparedLiveFocusDecision(decision({ effective: LIVE_FOCUS_NONE, transition: { from: THREAD_VALUE, to: LIVE_FOCUS_NONE, reasonCode: 'STABLE_DEPARTURE_NO_REPLACEMENT' } }), { sessionId: SESSION });
    expect(toNone).toEqual({ unit_id: CU, effective_kind: 'NONE', effective_ref: null, transition: true, reason_code: 'STABLE_DEPARTURE_NO_REPLACEMENT', transition_event_id: '31ae1e67-d4f8-541a-8188-f9db29f6cc20' });
  });

  it('28. the payload carries no from value, no SP, no sequence, no label and no timestamp', () => {
    const payload = canonicalizePreparedLiveFocusDecision(decision({ effective: THREAD_VALUE, transition: { from: LIVE_FOCUS_NONE, to: THREAD_VALUE, reasonCode: 'NEW_INDEPENDENT_FOCUS' } }), { sessionId: SESSION });
    const wire = JSON.stringify(payload);
    for (const forbidden of ['from', 'session_position', 'same_sp', 'sequence', 'label', 'name', 'home', 'created_at', 'timestamp', 'confidence', 'importance']) {
      expect(wire.includes(`"${forbidden}`)).toBe(false);
    }
  });

  it('29. a transition that contradicts its effective value, repeats from == to, or carries a reason of the wrong shape is refused', () => {
    expect(failure(() => canonicalizePreparedLiveFocusDecision(decision({ effective: EMERGING, transition: { from: LIVE_FOCUS_NONE, to: THREAD_VALUE, reasonCode: 'NEW_INDEPENDENT_FOCUS' } }), { sessionId: SESSION }))).toBe('INVALID_TRANSITION_SHAPE');
    expect(failure(() => canonicalizePreparedLiveFocusDecision(decision({ effective: EMERGING, transition: { from: EMERGING, to: EMERGING, reasonCode: 'FOCUS_REPLACEMENT' } }), { sessionId: SESSION }))).toBe('INVALID_TRANSITION_SHAPE');
    expect(failure(() => canonicalizePreparedLiveFocusDecision(decision({ effective: EMERGING, transition: { from: LIVE_FOCUS_NONE, to: EMERGING, reasonCode: 'FOCUS_REPLACEMENT' } }), { sessionId: SESSION }))).toBe('INVALID_TRANSITION_SHAPE');
    expect(failure(() => canonicalizePreparedLiveFocusDecision(decision({ effective: LIVE_FOCUS_NONE, transition: { from: EMERGING, to: LIVE_FOCUS_NONE, reasonCode: 'FOCUS_REPLACEMENT' } }), { sessionId: SESSION }))).toBe('INVALID_TRANSITION_SHAPE');
    expect(failure(() => canonicalizePreparedLiveFocusDecision(decision({ effective: EMERGING, transition: { from: THREAD_VALUE, to: EMERGING, reasonCode: 'THREAD_PROMOTION' } }), { sessionId: SESSION }))).toBe('INVALID_TRANSITION_SHAPE');
    expect(failure(() => canonicalizePreparedLiveFocusDecision(decision({ effective: THREAD_VALUE, transition: { from: THREAD_VALUE, to: { kind: 'THREAD', threadId: FOCUS }, reasonCode: 'THREAD_PROMOTION' } }), { sessionId: SESSION }))).toBe('INVALID_TRANSITION_SHAPE');
    expect(failure(() => canonicalizePreparedLiveFocusDecision(decision({ effective: EMERGING, transition: { from: LIVE_FOCUS_NONE, to: EMERGING, reasonCode: 'BEST_MATCH' as never } }), { sessionId: SESSION }))).toBe('INVALID_TRANSITION_SHAPE');
  });

  it('30. a value outside the closed domain, or a non-UUID reference, is refused', () => {
    expect(failure(() => canonicalizePreparedLiveFocusDecision(decision({ effective: { kind: 'READING', id: 'r' } as never, transition: null }), { sessionId: SESSION }))).toBe('INVALID_LIVE_FOCUS_SHAPE');
    expect(failure(() => canonicalizePreparedLiveFocusDecision(decision({ effective: { kind: 'EMERGING', emergingFocusId: 'focus-1' }, transition: null }), { sessionId: SESSION }))).toBe('INVALID_DURABLE_IDENTITY');
    expect(failure(() => canonicalizePreparedLiveFocusDecision(decision({ effective: EMERGING, transition: null }, 'cu-1'), { sessionId: SESSION }))).toBe('INVALID_CANONICAL_UNIT_ID');
    expect(failure(() => canonicalizePreparedLiveFocusDecision(decision({ effective: EMERGING, transition: null }), { sessionId: 'session' }))).toBe('INVALID_DURABLE_IDENTITY');
  });

  it('31. a sequence keeps one payload per CU in order, and a prepared identity never survives into it', () => {
    const other = '22222222-2222-4222-8222-222222222222';
    const sequence = canonicalizePreparedLiveFocusSequence([
      decision({ effective: EMERGING, transition: { from: LIVE_FOCUS_NONE, to: EMERGING, reasonCode: 'NEW_INDEPENDENT_FOCUS' } }),
      decision({ effective: EMERGING, transition: null }, other),
    ], { sessionId: SESSION });
    expect(sequence.units.map((unit) => [unit.unit_id, unit.transition])).toEqual([[CU, true], [other, false]]);
    expect(Object.isFrozen(sequence) && Object.isFrozen(sequence.units)).toBe(true);
    expect(failure(() => canonicalizePreparedLiveFocusSequence([decision({ effective: { kind: 'EMERGING', emergingFocusId: 'prepared:focus:1' }, transition: null })], { sessionId: SESSION }))).toBe('INVALID_DURABLE_IDENTITY');
  });

  it('32. the same prepared decision canonicalizes identically on every retry', () => {
    const prepared = decision({ effective: THREAD_VALUE, transition: { from: EMERGING, to: THREAD_VALUE, reasonCode: 'THREAD_PROMOTION' } });
    expect(canonicalizePreparedLiveFocusDecision(prepared, { sessionId: SESSION })).toEqual(canonicalizePreparedLiveFocusDecision(prepared, { sessionId: SESSION }));
  });
});
