import type { CanonicalCuFocusSemanticPayload } from '../conversational-focus/durable-focus-payload.types';
import { reduceThreadLifecycle, type ThreadLifecycleReductionInput } from './thread-lifecycle-reducer';
import { ThreadLifecycleRejectedError, type ThreadLifecycleState } from './thread-lifecycle.types';

const T_AHMED = '11111111-1111-4111-8111-111111111111';
const T_WORK = '22222222-2222-4222-8222-222222222222';
const T_MANAGER = '33333333-3333-4333-8333-333333333333';
const F_AHMED = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const F_WORK = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const F_MANAGER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CU_PRIOR = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const bundle = (overrides: Partial<CanonicalCuFocusSemanticPayload> & { attention?: Partial<CanonicalCuFocusSemanticPayload['attention']> } = {}): CanonicalCuFocusSemanticPayload => ({
  unit_id: overrides.unit_id ?? 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  functions: overrides.functions ?? ['INFORM_REPORT'],
  sequence_position: overrides.sequence_position ?? 'UNMARKED',
  target_cu_id: overrides.target_cu_id ?? null,
  references: overrides.references ?? [],
  claim_attributions: overrides.claim_attributions ?? [],
  attention: {
    kind: 'NO_INDEPENDENT_FOCUS', reason: 'INCIDENTAL_OR_SUBORDINATE', emerging_focus_id: null, creates_focus: false, grounding_reference_index: null,
    ...(overrides.attention ?? {}),
  },
});
const attend = (focus: string, reason: CanonicalCuFocusSemanticPayload['attention']['reason'] = 'DIRECT_SUBJECT', extra: Partial<CanonicalCuFocusSemanticPayload> = {}) =>
  bundle({ ...extra, attention: { kind: 'ATTEND_EXISTING_FOCUS', reason, emerging_focus_id: focus, creates_focus: false, grounding_reference_index: null } });
const noFocus = (extra: Partial<CanonicalCuFocusSemanticPayload> = {}) => bundle(extra);

const bindings = new Map([[F_AHMED, T_AHMED], [F_WORK, T_WORK], [F_MANAGER, T_MANAGER]]);
const input = (overrides: Partial<ThreadLifecycleReductionInput> & { states?: Record<string, ThreadLifecycleState> }): ThreadLifecycleReductionInput => ({
  currentFocusSemantics: overrides.currentFocusSemantics ?? attend(F_WORK),
  previousFocusSemantics: overrides.previousFocusSemantics ?? null,
  focusThreadBindings: overrides.focusThreadBindings ?? bindings,
  threadStates: new Map(Object.entries(overrides.states ?? { [T_AHMED]: 'ACTIVE', [T_WORK]: 'ACTIVE', [T_MANAGER]: 'ACTIVE' })),
  semanticsByCuId: overrides.semanticsByCuId ?? new Map(),
});
const compact = (transitions: ReturnType<typeof reduceThreadLifecycle>) => transitions.map((t) => [t.threadId, t.fromState, t.toState, t.reasonCode]);

describe('the deterministic lifecycle reducer (cases 1-20)', () => {
  it('1. a brief local clarification anchored to an ACTIVE Thread keeps it ACTIVE and moves nothing else', () => {
    const clarification = attend(F_AHMED, 'LOCAL_CLARIFICATION_OR_CORRECTION');
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: clarification, previousFocusSemantics: attend(F_AHMED), states: { [T_AHMED]: 'ACTIVE' } })))).toEqual([]);
  });

  it('2. an explicit FOCUS_SHIFT away from an ACTIVE Thread makes it DORMANT at this CU', () => {
    const shift = attend(F_WORK, 'EXPLICIT_FOCUS_SHIFT', { functions: ['REQUEST', 'FOCUS_SHIFT'] });
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: shift, states: { [T_AHMED]: 'ACTIVE', [T_WORK]: 'ACTIVE' } }))))
      .toEqual([[T_AHMED, 'ACTIVE', 'DORMANT', 'EXPLICIT_FOCUS_SHIFT']]);
  });

  it('3. an explicit shift even wins over a canonical target link into the departed Thread', () => {
    const shift = attend(F_WORK, 'EXPLICIT_FOCUS_SHIFT', { functions: ['REQUEST', 'FOCUS_SHIFT'], target_cu_id: CU_PRIOR });
    const semantics = new Map([[CU_PRIOR, attend(F_AHMED)]]);
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: shift, semanticsByCuId: semantics, states: { [T_AHMED]: 'REOPENED', [T_WORK]: 'ACTIVE' } }))))
      .toEqual([[T_AHMED, 'REOPENED', 'DORMANT', 'EXPLICIT_FOCUS_SHIFT']]);
  });

  it('4. ONE independent CU elsewhere never makes a Thread Dormant (first-away is not sustained)', () => {
    const two = { [T_AHMED]: 'ACTIVE' as const, [T_WORK]: 'ACTIVE' as const };
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: attend(F_WORK), previousFocusSemantics: attend(F_AHMED), states: two })))).toEqual([]);
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: attend(F_WORK), previousFocusSemantics: null, states: two })))).toEqual([]);
  });

  it('5. the SECOND consecutive independent CU elsewhere makes the Thread Dormant, at the current CU only', () => {
    const transitions = reduceThreadLifecycle(input({ currentFocusSemantics: attend(F_WORK), previousFocusSemantics: attend(F_WORK), states: { [T_AHMED]: 'ACTIVE', [T_WORK]: 'ACTIVE' } }));
    expect(compact(transitions)).toEqual([[T_AHMED, 'ACTIVE', 'DORMANT', 'SUSTAINED_DEPARTURE']]);
    // Never backdated: the reducer of the PREVIOUS CU produced nothing (case 4).
  });

  it('6. the two away CUs need not bind to the same other Thread; they only prove departure', () => {
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: attend(F_MANAGER), previousFocusSemantics: attend(F_WORK), states: { [T_AHMED]: 'ACTIVE', [T_WORK]: 'ACTIVE', [T_MANAGER]: 'ACTIVE' } }))))
      .toEqual([[T_AHMED, 'ACTIVE', 'DORMANT', 'SUSTAINED_DEPARTURE']]);
  });

  it('7. a NO_INDEPENDENT_FOCUS CU is never "away": it neither counts nor continues a departure', () => {
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: noFocus(), previousFocusSemantics: attend(F_WORK) })))).toEqual([]);
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: attend(F_WORK), previousFocusSemantics: noFocus() })))).toEqual([]);
  });

  it('8. a local clarification anchored to the Thread (through its target) is not a departure', () => {
    const clarification = attend(F_WORK, 'LOCAL_CLARIFICATION_OR_CORRECTION', { target_cu_id: CU_PRIOR });
    const semantics = new Map([[CU_PRIOR, attend(F_AHMED)]]);
    const two = { [T_AHMED]: 'ACTIVE' as const, [T_WORK]: 'ACTIVE' as const };
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: clarification, previousFocusSemantics: attend(F_WORK), semanticsByCuId: semantics, states: two })))).toEqual([]);
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: attend(F_WORK), previousFocusSemantics: clarification, semanticsByCuId: semantics, states: two })))).toEqual([]);
  });

  it('9. a canonical target link into the Thread anchors the CU: no sustained departure through it', () => {
    const responding = attend(F_WORK, 'DIRECT_SUBJECT', { target_cu_id: CU_PRIOR });
    const semantics = new Map([[CU_PRIOR, attend(F_AHMED)]]);
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: responding, previousFocusSemantics: attend(F_WORK), semanticsByCuId: semantics, states: { [T_AHMED]: 'ACTIVE', [T_WORK]: 'ACTIVE' } })))).toEqual([]);
  });

  it('10. a genuine return to a DORMANT Thread reopens it - USER or ASSISTANT alike', () => {
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: attend(F_AHMED), states: { [T_AHMED]: 'DORMANT', [T_WORK]: 'ACTIVE' } }))))
      .toEqual([[T_AHMED, 'DORMANT', 'REOPENED', 'GENUINE_RETURN']]);
    const clarification = attend(F_AHMED, 'LOCAL_CLARIFICATION_OR_CORRECTION');
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: clarification, states: { [T_AHMED]: 'DORMANT' } }))))
      .toEqual([[T_AHMED, 'DORMANT', 'REOPENED', 'GENUINE_RETURN']]);
  });

  it('11. the next CU anchored to a REOPENED Thread continues it to ACTIVE', () => {
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: attend(F_AHMED), states: { [T_AHMED]: 'REOPENED' } }))))
      .toEqual([[T_AHMED, 'REOPENED', 'ACTIVE', 'CONTINUED_ANCHORING']]);
    const responding = noFocus({ target_cu_id: CU_PRIOR });
    const semantics = new Map([[CU_PRIOR, attend(F_AHMED)]]);
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: responding, semanticsByCuId: semantics, states: { [T_AHMED]: 'REOPENED' } }))))
      .toEqual([[T_AHMED, 'REOPENED', 'ACTIVE', 'CONTINUED_ANCHORING']]);
  });

  it('12. an incidental mention alone never makes a REOPENED Thread ACTIVE', () => {
    // No attention on the Thread, no canonical target into it: REOPENED stays.
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: noFocus(), states: { [T_AHMED]: 'REOPENED' } })))).toEqual([]);
  });

  it('13. REOPENED -> DORMANT on a genuine departure, explicit or sustained', () => {
    const shift = attend(F_WORK, 'EXPLICIT_FOCUS_SHIFT', { functions: ['FOCUS_SHIFT'] });
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: shift, states: { [T_AHMED]: 'REOPENED', [T_WORK]: 'ACTIVE' } }))))
      .toEqual([[T_AHMED, 'REOPENED', 'DORMANT', 'EXPLICIT_FOCUS_SHIFT']]);
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: attend(F_WORK), previousFocusSemantics: attend(F_WORK), states: { [T_AHMED]: 'REOPENED', [T_WORK]: 'ACTIVE' } }))))
      .toEqual([[T_AHMED, 'REOPENED', 'DORMANT', 'SUSTAINED_DEPARTURE']]);
  });

  it('14. a DORMANT Thread that is not returned to stays DORMANT whatever else happens', () => {
    const shift = attend(F_WORK, 'EXPLICIT_FOCUS_SHIFT', { functions: ['FOCUS_SHIFT'] });
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: shift, previousFocusSemantics: attend(F_WORK), states: { [T_AHMED]: 'DORMANT', [T_MANAGER]: 'DORMANT', [T_WORK]: 'ACTIVE' } })))).toEqual([]);
  });

  it('15. several transitions at one CU are returned in canonical Thread order, never a ranking', () => {
    const shift = attend(F_WORK, 'EXPLICIT_FOCUS_SHIFT', { functions: ['FOCUS_SHIFT'] });
    const transitions = reduceThreadLifecycle(input({ currentFocusSemantics: shift, states: { [T_MANAGER]: 'ACTIVE', [T_AHMED]: 'REOPENED', [T_WORK]: 'DORMANT' } }));
    expect(compact(transitions)).toEqual([
      [T_AHMED, 'REOPENED', 'DORMANT', 'EXPLICIT_FOCUS_SHIFT'],
      [T_WORK, 'DORMANT', 'REOPENED', 'GENUINE_RETURN'],
      [T_MANAGER, 'ACTIVE', 'DORMANT', 'EXPLICIT_FOCUS_SHIFT'],
    ]);
    expect([...transitions].map((t) => t.threadId)).toEqual([T_AHMED, T_WORK, T_MANAGER]);
  });

  it('16. a Thread bound at THIS CU is a binding, never a state: its ACTIVE baseline costs no transition', () => {
    const newBindings = new Map([[F_AHMED, T_AHMED]]);
    expect(compact(reduceThreadLifecycle(input({ currentFocusSemantics: attend(F_AHMED), focusThreadBindings: newBindings, states: {} })))).toEqual([]);
  });

  it('17. every transition is legal by construction and self-transitions are impossible', () => {
    for (const state of ['ACTIVE', 'DORMANT', 'REOPENED'] as const) {
      for (const current of [attend(F_AHMED), attend(F_WORK), attend(F_WORK, 'EXPLICIT_FOCUS_SHIFT', { functions: ['FOCUS_SHIFT'] }), noFocus()]) {
        for (const transition of reduceThreadLifecycle(input({ currentFocusSemantics: current, previousFocusSemantics: attend(F_WORK), states: { [T_AHMED]: state, [T_WORK]: 'ACTIVE' } }))) {
          expect(transition.fromState).not.toBe(transition.toState);
          expect([['ACTIVE', 'DORMANT'], ['REOPENED', 'DORMANT'], ['DORMANT', 'REOPENED'], ['REOPENED', 'ACTIVE']]).toContainEqual([transition.fromState, transition.toState]);
        }
      }
    }
  });

  it('18. no timer, duration, timestamp, importance, confidence or analytical input is representable', () => {
    const shape = input({});
    expect(Object.keys(shape).sort()).toEqual(['currentFocusSemantics', 'focusThreadBindings', 'previousFocusSemantics', 'semanticsByCuId', 'threadStates']);
    const wire = JSON.stringify({ ...shape, focusThreadBindings: [...shape.focusThreadBindings], threadStates: [...shape.threadStates] });
    for (const forbidden of ['time', 'duration', 'created_at', 'importance', 'confidence', 'reading', 'hypothesis', 'score']) {
      expect(wire.toLowerCase().includes(forbidden)).toBe(false);
    }
  });

  it('19. the reducer is pure and deterministic: the same input reduces identically and mutates nothing', () => {
    const shape = input({ currentFocusSemantics: attend(F_WORK), previousFocusSemantics: attend(F_WORK) });
    const before = JSON.stringify({ ...shape, focusThreadBindings: [...shape.focusThreadBindings], threadStates: [...shape.threadStates] });
    const first = reduceThreadLifecycle(shape);
    const second = reduceThreadLifecycle(shape);
    expect(first).toEqual(second);
    expect(JSON.stringify({ ...shape, focusThreadBindings: [...shape.focusThreadBindings], threadStates: [...shape.threadStates] })).toBe(before);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it('20. a malformed lifecycle context fails closed rather than reducing to "no transition"', () => {
    const orphan = input({ states: { [T_AHMED]: 'ACTIVE', ['99999999-9999-4999-8999-999999999999']: 'ACTIVE' } });
    expect(() => reduceThreadLifecycle(orphan)).toThrow(ThreadLifecycleRejectedError);
    try { reduceThreadLifecycle(orphan); } catch (error) { expect((error as ThreadLifecycleRejectedError).reason).toBe('LIFECYCLE_CONTEXT_NOT_CLOSED'); }
    const badState = { ...input({}), threadStates: new Map([[T_AHMED, 'PAUSED' as ThreadLifecycleState]]) };
    expect(() => reduceThreadLifecycle(badState)).toThrow(ThreadLifecycleRejectedError);
    expect(() => reduceThreadLifecycle({ ...input({}), currentFocusSemantics: null as unknown as CanonicalCuFocusSemanticPayload })).toThrow(ThreadLifecycleRejectedError);
  });
});
