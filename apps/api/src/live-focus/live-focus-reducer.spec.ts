import type { CanonicalCuFocusSemanticPayload } from '../conversational-focus/durable-focus-payload.types';
import type { AttentionKind, AttentionReason, ConversationalFunction } from '../conversational-focus/conversational-focus.types';
import { reduceLiveFocus } from './live-focus-reducer';
import {
  LIVE_FOCUS_KINDS,
  LIVE_FOCUS_NONE,
  LIVE_FOCUS_REDUCER_VERSION,
  LIVE_FOCUS_TRANSITION_REASONS,
  liveFocusEquals,
  LiveFocusRejectedError,
  type CurrentThreadLayerResult,
  type EffectiveLiveFocus,
  type LiveFocusReductionInput,
} from './live-focus.types';

const F_A = 'aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa';
const F_B = 'bbbbbbbb-bbbb-5bbb-8bbb-bbbbbbbbbbbb';
const T_A = '11111111-1111-5111-8111-111111111111';
const T_B = '22222222-2222-5222-8222-222222222222';
const CU_PRIOR_A = 'cccccccc-cccc-5ccc-8ccc-cccccccccccc';
const CU_PRIOR_B = 'dddddddd-dddd-5ddd-8ddd-dddddddddddd';
const CU_PRIOR_NONE = 'eeeeeeee-eeee-5eee-8eee-eeeeeeeeeeee';
const CU_NOW = 'ffffffff-ffff-5fff-8fff-ffffffffffff';

interface BundleOptions {
  readonly kind?: AttentionKind;
  readonly reason?: AttentionReason;
  readonly focus?: string | null;
  readonly functions?: readonly ConversationalFunction[];
  readonly target?: string | null;
}
function bundle(unitId: string, options: BundleOptions = {}): CanonicalCuFocusSemanticPayload {
  const kind = options.kind ?? 'NO_INDEPENDENT_FOCUS';
  const focus = options.focus ?? (kind === 'NO_INDEPENDENT_FOCUS' ? null : F_A);
  return {
    unit_id: unitId,
    functions: options.functions ?? ['INFORM_REPORT'],
    sequence_position: 'UNMARKED',
    target_cu_id: options.target ?? null,
    references: [],
    claim_attributions: [],
    attention: {
      kind,
      reason: options.reason ?? (kind === 'NO_INDEPENDENT_FOCUS' ? 'INCIDENTAL_OR_SUBORDINATE' : 'DIRECT_SUBJECT'),
      emerging_focus_id: focus,
      creates_focus: kind === 'START_NEW_FOCUS',
      grounding_reference_index: kind === 'START_NEW_FOCUS' ? 0 : null,
    },
  };
}
const EMERGING = (focus: string): EffectiveLiveFocus => ({ kind: 'EMERGING', emergingFocusId: focus });
const THREAD = (thread: string): EffectiveLiveFocus => ({ kind: 'THREAD', threadId: thread });
const layer = (outcome: CurrentThreadLayerResult['outcome'], focus: string | null = F_A, thread: string | null = null): CurrentThreadLayerResult => ({ outcome, emergingFocusId: focus, threadId: thread });
const history = new Map<string, CanonicalCuFocusSemanticPayload>([
  [CU_PRIOR_A, bundle(CU_PRIOR_A, { kind: 'START_NEW_FOCUS', focus: F_A })],
  [CU_PRIOR_B, bundle(CU_PRIOR_B, { kind: 'START_NEW_FOCUS', focus: F_B })],
  [CU_PRIOR_NONE, bundle(CU_PRIOR_NONE)],
]);
function input(overrides: Partial<LiveFocusReductionInput> = {}): LiveFocusReductionInput {
  return {
    currentFocusSemantics: bundle(CU_NOW),
    currentThreadLayer: layer('NO_THREAD_ACTION', null),
    priorLiveFocus: LIVE_FOCUS_NONE,
    semanticsByCuId: history,
    focusThreadBindings: new Map(),
    // The lifecycle state of the prior LF's Thread after this CU (null when the prior is not a Thread).
    priorThreadLifecycleState: overrides.priorLiveFocus?.kind === 'THREAD' ? 'ACTIVE' : null,
    ...overrides,
  };
}
const expectRejected = (run: () => unknown, reason: LiveFocusRejectedError['reason']) => {
  try { run(); } catch (error) {
    expect(error).toBeInstanceOf(LiveFocusRejectedError);
    expect((error as LiveFocusRejectedError).reason).toBe(reason);
    return;
  }
  throw new Error(`expected ${reason}`);
};

describe('the frozen LF domain (cases 1-2)', () => {
  it('1. exactly three kinds, five reasons, one reducer identity; nothing graded is representable', () => {
    expect([...LIVE_FOCUS_KINDS]).toEqual(['NONE', 'EMERGING', 'THREAD']);
    expect([...LIVE_FOCUS_TRANSITION_REASONS]).toEqual(['NEW_INDEPENDENT_FOCUS', 'THREAD_PROMOTION', 'RETURN_TO_THREAD', 'FOCUS_REPLACEMENT', 'STABLE_DEPARTURE_NO_REPLACEMENT']);
    expect(LIVE_FOCUS_REDUCER_VERSION).toBe('live-focus-reducer-v1');
    expect(Object.isFrozen(LIVE_FOCUS_KINDS) && Object.isFrozen(LIVE_FOCUS_TRANSITION_REASONS) && Object.isFrozen(LIVE_FOCUS_NONE)).toBe(true);
    expect(liveFocusEquals(EMERGING(F_A), EMERGING(F_A))).toBe(true);
    expect(liveFocusEquals(EMERGING(F_A), EMERGING(F_B))).toBe(false);
    expect(liveFocusEquals(EMERGING(F_A), THREAD(F_A))).toBe(false);
    expect(liveFocusEquals(LIVE_FOCUS_NONE, { kind: 'NONE' })).toBe(true);
  });

  it('2. the reducer reads no timer, Map, camera, inspection, confidence or importance: the input is exactly six keys', () => {
    const keys = Object.keys(input()).sort();
    expect(keys).toEqual(['currentFocusSemantics', 'currentThreadLayer', 'focusThreadBindings', 'priorLiveFocus', 'priorThreadLifecycleState', 'semanticsByCuId']);
    for (const forbidden of ['timestamp', 'elapsedMs', 'turnCount', 'mapState', 'camera', 'inspection', 'confidence', 'importance', 'similarity', 'home']) {
      expect(keys.includes(forbidden)).toBe(false);
    }
  });
});

describe('LF-01 / LF-02 / LF-03: focus-bearing and quiet CUs (cases 3-16)', () => {
  it('3. no prior LF + no independent focus -> NONE, unchanged, no transition', () => {
    const reduction = reduceLiveFocus(input());
    expect(reduction).toEqual({ effective: { kind: 'NONE' }, transition: null });
    expect(Object.isFrozen(reduction)).toBe(true);
  });

  it('4. the first Emerging Focus -> EMERGING with NEW_INDEPENDENT_FOCUS', () => {
    const reduction = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'START_NEW_FOCUS' }), currentThreadLayer: layer('NO_THREAD_ACTION') }));
    expect(reduction.effective).toEqual(EMERGING(F_A));
    expect(reduction.transition).toEqual({ from: { kind: 'NONE' }, to: EMERGING(F_A), reasonCode: 'NEW_INDEPENDENT_FOCUS' });
  });

  it('5. continued attention on the same Emerging Focus -> no transition', () => {
    const reduction = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'ATTEND_EXISTING_FOCUS' }), currentThreadLayer: layer('NO_THREAD_ACTION'), priorLiveFocus: EMERGING(F_A) }));
    expect(reduction).toEqual({ effective: EMERGING(F_A), transition: null });
  });

  it('6. Emerging A -> Emerging B is a FOCUS_REPLACEMENT', () => {
    const reduction = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'START_NEW_FOCUS', focus: F_B }), currentThreadLayer: layer('NO_THREAD_ACTION', F_B), priorLiveFocus: EMERGING(F_A) }));
    expect(reduction.transition).toEqual({ from: EMERGING(F_A), to: EMERGING(F_B), reasonCode: 'FOCUS_REPLACEMENT' });
  });

  it('7. the same-Moment rule: a new Thread established NOW makes the effective LF the Thread at THIS CU', () => {
    const fromNone = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'START_NEW_FOCUS' }), currentThreadLayer: layer('ESTABLISH_NEW', F_A, T_A), focusThreadBindings: new Map([[F_A, T_A]]) }));
    expect(fromNone.effective).toEqual(THREAD(T_A));
    expect(fromNone.transition?.reasonCode).toBe('NEW_INDEPENDENT_FOCUS');
    const fromOwnEmerging = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'ATTEND_EXISTING_FOCUS' }), currentThreadLayer: layer('ESTABLISH_NEW', F_A, T_A), priorLiveFocus: EMERGING(F_A), focusThreadBindings: new Map([[F_A, T_A]]) }));
    expect(fromOwnEmerging.transition).toEqual({ from: EMERGING(F_A), to: THREAD(T_A), reasonCode: 'THREAD_PROMOTION' });
  });

  it('8. a later promotion of the current Emerging Focus (Session continuity binding) is a THREAD_PROMOTION too', () => {
    const reduction = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'ATTEND_EXISTING_FOCUS' }), currentThreadLayer: layer('ACTIVATE_EXISTING_IN_SESSION', F_A, T_A), priorLiveFocus: EMERGING(F_A), focusThreadBindings: new Map([[F_A, T_A]]) }));
    expect(reduction.transition).toEqual({ from: EMERGING(F_A), to: THREAD(T_A), reasonCode: 'THREAD_PROMOTION' });
  });

  it('9. attending an existing Thread keeps THREAD unchanged; attending it from elsewhere is a RETURN_TO_THREAD', () => {
    const same = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'ATTEND_EXISTING_FOCUS' }), currentThreadLayer: layer('ATTEND_EXISTING', F_A, T_A), priorLiveFocus: THREAD(T_A), focusThreadBindings: new Map([[F_A, T_A]]) }));
    expect(same).toEqual({ effective: THREAD(T_A), transition: null });
    const back = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'ATTEND_EXISTING_FOCUS' }), currentThreadLayer: layer('ATTEND_EXISTING', F_A, T_A), priorLiveFocus: EMERGING(F_B), focusThreadBindings: new Map([[F_A, T_A]]) }));
    expect(back.transition).toEqual({ from: EMERGING(F_B), to: THREAD(T_A), reasonCode: 'RETURN_TO_THREAD' });
  });

  it('10. LF-03: a return to a Dormant (REOPEN_EXISTING) or Reopened Thread is the SAME canonical Thread id', () => {
    const reopened = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'ATTEND_EXISTING_FOCUS' }), currentThreadLayer: layer('REOPEN_EXISTING', F_A, T_A), priorLiveFocus: THREAD(T_B), focusThreadBindings: new Map([[F_A, T_A], [F_B, T_B]]) }));
    expect(reopened.transition).toEqual({ from: THREAD(T_B), to: THREAD(T_A), reasonCode: 'RETURN_TO_THREAD' });
    const fromNone = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'ATTEND_EXISTING_FOCUS' }), currentThreadLayer: layer('REOPEN_EXISTING', F_A, T_A), focusThreadBindings: new Map([[F_A, T_A]]) }));
    expect(fromNone.transition).toEqual({ from: { kind: 'NONE' }, to: THREAD(T_A), reasonCode: 'NEW_INDEPENDENT_FOCUS' });
  });

  it('11. ambiguous cross-Session identity never erases the real current Emerging Focus', () => {
    const fromNone = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'START_NEW_FOCUS' }), currentThreadLayer: layer('IDENTITY_AMBIGUOUS') }));
    expect(fromNone.effective).toEqual(EMERGING(F_A));
    const fromThread = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'START_NEW_FOCUS' }), currentThreadLayer: layer('IDENTITY_AMBIGUOUS'), priorLiveFocus: THREAD(T_B), focusThreadBindings: new Map([[F_B, T_B]]) }));
    expect(fromThread.transition).toEqual({ from: THREAD(T_B), to: EMERGING(F_A), reasonCode: 'FOCUS_REPLACEMENT' });
  });

  it('12. Thread A -> Thread B: a RETURN_TO_THREAD when B already existed, a FOCUS_REPLACEMENT when B is established now', () => {
    const existing = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'ATTEND_EXISTING_FOCUS', focus: F_B }), currentThreadLayer: layer('ATTEND_EXISTING', F_B, T_B), priorLiveFocus: THREAD(T_A), focusThreadBindings: new Map([[F_A, T_A], [F_B, T_B]]) }));
    expect(existing.transition).toEqual({ from: THREAD(T_A), to: THREAD(T_B), reasonCode: 'RETURN_TO_THREAD' });
    const established = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'START_NEW_FOCUS', focus: F_B }), currentThreadLayer: layer('ESTABLISH_NEW', F_B, T_B), priorLiveFocus: THREAD(T_A), focusThreadBindings: new Map([[F_A, T_A], [F_B, T_B]]) }));
    expect(established.transition).toEqual({ from: THREAD(T_A), to: THREAD(T_B), reasonCode: 'FOCUS_REPLACEMENT' });
    const continuity = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'START_NEW_FOCUS', focus: F_B }), currentThreadLayer: layer('ACTIVATE_EXISTING_IN_SESSION', F_B, T_B), priorLiveFocus: THREAD(T_A), focusThreadBindings: new Map([[F_A, T_A], [F_B, T_B]]) }));
    expect(continuity.transition).toEqual({ from: THREAD(T_A), to: THREAD(T_B), reasonCode: 'RETURN_TO_THREAD' });
  });

  it('13. Thread -> Emerging is a FOCUS_REPLACEMENT', () => {
    const reduction = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'START_NEW_FOCUS', focus: F_B }), currentThreadLayer: layer('NO_THREAD_ACTION', F_B), priorLiveFocus: THREAD(T_A), focusThreadBindings: new Map([[F_A, T_A]]) }));
    expect(reduction.transition).toEqual({ from: THREAD(T_A), to: EMERGING(F_B), reasonCode: 'FOCUS_REPLACEMENT' });
  });

  it('14. LF-02: a brief interruption, an acknowledgement and an unresolved-attention CU all retain the prior LF', () => {
    for (const prior of [EMERGING(F_A), THREAD(T_A)]) {
      for (const options of [
        { reason: 'INCIDENTAL_OR_SUBORDINATE' as const },
        { reason: 'INCIDENTAL_OR_SUBORDINATE' as const, functions: ['ACKNOWLEDGE'] as const },
        { reason: 'UNRESOLVED_ATTENTION' as const, functions: ['FUNCTION_UNRESOLVED'] as const },
        { reason: 'INCIDENTAL_OR_SUBORDINATE' as const, functions: ['ASK', 'ELABORATE'] as const },
      ]) {
        const reduction = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, options), priorLiveFocus: prior, focusThreadBindings: new Map([[F_A, T_A]]) }));
        expect(reduction).toEqual({ effective: prior, transition: null });
      }
    }
  });

  it('15. a local clarification or correction retains the prior LF even when it carries FOCUS_SHIFT', () => {
    for (const prior of [EMERGING(F_A), THREAD(T_A)]) {
      const reduction = reduceLiveFocus(input({
        currentFocusSemantics: bundle(CU_NOW, { reason: 'LOCAL_CLARIFICATION_OR_CORRECTION', functions: ['CLARIFY', 'FOCUS_SHIFT'] }),
        priorLiveFocus: prior, focusThreadBindings: new Map([[F_A, T_A]]),
      }));
      expect(reduction).toEqual({ effective: prior, transition: null });
    }
  });

  it('16. the reducer is deterministic and its output frozen', () => {
    const a = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'START_NEW_FOCUS' }), currentThreadLayer: layer('ESTABLISH_NEW', F_A, T_A), focusThreadBindings: new Map([[F_A, T_A]]) }));
    const b = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'START_NEW_FOCUS' }), currentThreadLayer: layer('ESTABLISH_NEW', F_A, T_A), focusThreadBindings: new Map([[F_A, T_A]]) }));
    expect(a).toEqual(b);
    expect(Object.isFrozen(a) && Object.isFrozen(a.transition)).toBe(true);
  });
});

describe('LF-04: the conservative departure (cases 17-22)', () => {
  it('17. an explicit FOCUS_SHIFT with no replacement focus and no anchor clears an Emerging LF, and a Thread LF only when its frozen lifecycle is already DORMANT', () => {
    const emerging = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { functions: ['FOCUS_SHIFT'] }), priorLiveFocus: EMERGING(F_A) }));
    expect(emerging.transition).toEqual({ from: EMERGING(F_A), to: { kind: 'NONE' }, reasonCode: 'STABLE_DEPARTURE_NO_REPLACEMENT' });
    const dormant = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { functions: ['FOCUS_SHIFT'] }), priorLiveFocus: THREAD(T_A), focusThreadBindings: new Map([[F_A, T_A]]), priorThreadLifecycleState: 'DORMANT' }));
    expect(dormant.transition).toEqual({ from: THREAD(T_A), to: { kind: 'NONE' }, reasonCode: 'STABLE_DEPARTURE_NO_REPLACEMENT' });
  });

  it('18. a FOCUS_SHIFT whose canonical target anchors back to the prior LF does NOT clear it', () => {
    const emerging = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { functions: ['FOCUS_SHIFT'], target: CU_PRIOR_A }), priorLiveFocus: EMERGING(F_A) }));
    expect(emerging).toEqual({ effective: EMERGING(F_A), transition: null });
    const thread = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { functions: ['FOCUS_SHIFT'], target: CU_PRIOR_A }), priorLiveFocus: THREAD(T_A), focusThreadBindings: new Map([[F_A, T_A]]) }));
    expect(thread).toEqual({ effective: THREAD(T_A), transition: null });
  });

  it('19. a FOCUS_SHIFT whose target anchors ELSEWHERE, or to a CU without focus, still departs', () => {
    for (const target of [CU_PRIOR_B, CU_PRIOR_NONE]) {
      const reduction = reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { functions: ['FOCUS_SHIFT'], target }), priorLiveFocus: EMERGING(F_A) }));
      expect(reduction.effective).toEqual({ kind: 'NONE' });
      expect(reduction.transition?.reasonCode).toBe('STABLE_DEPARTURE_NO_REPLACEMENT');
    }
  });

  it('20. a FOCUS_SHIFT over NONE, or a quiet CU without FOCUS_SHIFT, never produces a departure transition', () => {
    expect(reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { functions: ['FOCUS_SHIFT'] }) }))).toEqual({ effective: { kind: 'NONE' }, transition: null });
    expect(reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { functions: ['INFORM_REPORT'] }), priorLiveFocus: EMERGING(F_A) }))).toEqual({ effective: EMERGING(F_A), transition: null });
    // Two consecutive quiet CUs are still two quiet CUs: nothing counts them.
    const first = reduceLiveFocus(input({ priorLiveFocus: EMERGING(F_A) }));
    const second = reduceLiveFocus(input({ priorLiveFocus: first.effective }));
    expect(second).toEqual({ effective: EMERGING(F_A), transition: null });
  });

  it('21. an unknown departure target fails closed instead of clearing LF', () => {
    expectRejected(() => reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { functions: ['FOCUS_SHIFT'], target: '99999999-9999-5999-8999-999999999999' }), priorLiveFocus: EMERGING(F_A) })), 'LIVE_FOCUS_CONTEXT_NOT_CLOSED');
  });

  it('22. a contradictory Thread-layer result or a malformed input fails closed, never "unchanged"', () => {
    expectRejected(() => reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'START_NEW_FOCUS' }), currentThreadLayer: layer('ESTABLISH_NEW', F_B, T_A) })), 'THREAD_LAYER_MISMATCH');
    expectRejected(() => reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'START_NEW_FOCUS' }), currentThreadLayer: layer('ESTABLISH_NEW', F_A, null) })), 'THREAD_LAYER_MISMATCH');
    expectRejected(() => reduceLiveFocus(input({ priorLiveFocus: { kind: 'READING', id: 'r' } as never })), 'INVALID_LIVE_FOCUS_INPUT');
    expectRejected(() => reduceLiveFocus(input({ semanticsByCuId: {} as never })), 'INVALID_LIVE_FOCUS_INPUT');
    expectRejected(() => reduceLiveFocus(input({ currentFocusSemantics: { unit_id: CU_NOW } as never })), 'INVALID_LIVE_FOCUS_INPUT');
    expectRejected(() => reduceLiveFocus(null as never), 'INVALID_LIVE_FOCUS_INPUT');
    expectRejected(() => reduceLiveFocus(input({ priorLiveFocus: THREAD(T_A), priorThreadLifecycleState: 'CLOSED' as never })), 'INVALID_LIVE_FOCUS_INPUT');
  });
});

describe('R1-01: the B3 -> D same-Moment lifecycle / Live-Focus closure (cases 23-25)', () => {
  const departure = bundle(CU_NOW, { functions: ['INFORM_REPORT', 'FOCUS_SHIFT'] });

  it('23. a NO_INDEPENDENT_FOCUS + FOCUS_SHIFT CU never departs a Thread the frozen lifecycle leaves ACTIVE or REOPENED: LF stays, no transition', () => {
    for (const state of ['ACTIVE', 'REOPENED'] as const) {
      const reduction = reduceLiveFocus(input({ currentFocusSemantics: departure, priorLiveFocus: THREAD(T_A), focusThreadBindings: new Map([[F_A, T_A]]), priorThreadLifecycleState: state }));
      expect(reduction).toEqual({ effective: THREAD(T_A), transition: null });
    }
    // The contradictory pair "LF = NONE with reason STABLE_DEPARTURE_NO_REPLACEMENT" + "Thread T ACTIVE" is unrepresentable through the reducer.
    const contradiction = reduceLiveFocus(input({ currentFocusSemantics: departure, priorLiveFocus: THREAD(T_A), focusThreadBindings: new Map([[F_A, T_A]]), priorThreadLifecycleState: 'ACTIVE' }));
    expect(contradiction.transition?.reasonCode).toBeUndefined();
  });

  it('24. the departure is exactly as stable as the frozen lifecycle: DORMANT after this Moment departs; an Emerging prior (no lifecycle) departs', () => {
    expect(reduceLiveFocus(input({ currentFocusSemantics: departure, priorLiveFocus: THREAD(T_A), focusThreadBindings: new Map([[F_A, T_A]]), priorThreadLifecycleState: 'DORMANT' })).effective).toEqual({ kind: 'NONE' });
    expect(reduceLiveFocus(input({ currentFocusSemantics: departure, priorLiveFocus: EMERGING(F_A), priorThreadLifecycleState: null })).effective).toEqual({ kind: 'NONE' });
    // The neighbouring rules are untouched by the closure: quiet, anchored, clarification, replacement, return, promotion.
    expect(reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW), priorLiveFocus: THREAD(T_A), priorThreadLifecycleState: 'ACTIVE' }))).toEqual({ effective: THREAD(T_A), transition: null });
    expect(reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { functions: ['FOCUS_SHIFT'], target: CU_PRIOR_A }), priorLiveFocus: THREAD(T_A), focusThreadBindings: new Map([[F_A, T_A]]), priorThreadLifecycleState: 'DORMANT' }))).toEqual({ effective: THREAD(T_A), transition: null });
    expect(reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { reason: 'LOCAL_CLARIFICATION_OR_CORRECTION', functions: ['CLARIFY', 'FOCUS_SHIFT'] }), priorLiveFocus: THREAD(T_A), priorThreadLifecycleState: 'DORMANT' }))).toEqual({ effective: THREAD(T_A), transition: null });
    expect(reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'START_NEW_FOCUS', focus: F_B }), currentThreadLayer: layer('ESTABLISH_NEW', F_B, T_B), priorLiveFocus: THREAD(T_A), focusThreadBindings: new Map([[F_A, T_A], [F_B, T_B]]), priorThreadLifecycleState: 'DORMANT' })).transition?.reasonCode).toBe('FOCUS_REPLACEMENT');
    expect(reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'ATTEND_EXISTING_FOCUS' }), currentThreadLayer: layer('REOPEN_EXISTING', F_A, T_A), priorLiveFocus: THREAD(T_B), focusThreadBindings: new Map([[F_A, T_A], [F_B, T_B]]), priorThreadLifecycleState: 'DORMANT' })).transition?.reasonCode).toBe('RETURN_TO_THREAD');
    expect(reduceLiveFocus(input({ currentFocusSemantics: bundle(CU_NOW, { kind: 'ATTEND_EXISTING_FOCUS' }), currentThreadLayer: layer('ESTABLISH_NEW', F_A, T_A), priorLiveFocus: EMERGING(F_A), focusThreadBindings: new Map([[F_A, T_A]]) })).transition?.reasonCode).toBe('THREAD_PROMOTION');
  });

  it('25. a Thread LF whose lifecycle state is unknown fails closed instead of departing', () => {
    expectRejected(() => reduceLiveFocus(input({ currentFocusSemantics: departure, priorLiveFocus: THREAD(T_A), focusThreadBindings: new Map([[F_A, T_A]]), priorThreadLifecycleState: null })), 'LIVE_FOCUS_CONTEXT_NOT_CLOSED');
  });
});
