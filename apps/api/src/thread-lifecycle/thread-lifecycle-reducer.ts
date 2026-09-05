// T-03B3 (B3-05) - the deterministic Session-local lifecycle reducer.
//
// There is NO lifecycle model, NO lifecycle provider and NO lifecycle prompt.
// Transitions are a pure function of already-canonical material:
//
//   - the current CU's canonical B1 functions and attention (kind / reason /
//     focus) and its canonical target_cu_id;
//   - the canonical Session focus -> Thread bindings visible to this CU;
//   - the then-valid Session lifecycle state of every bound Thread;
//   - the immediately preceding committed CU's canonical B1 bundle.
//
// No timer. No wall-clock duration. No importance / confidence. No Reading,
// no analytical or background activity: none of them is reachable from the
// inputs of this module, so none of them can make a Thread Active, Dormant
// or Reopened.
//
// THE RULES (task section 10), in the order they are applied per Thread:
//
//   own Thread T (the CU's attention focus is bound to T):
//     DORMANT  -> REOPENED   GENUINE_RETURN         (10.1, USER or ASSISTANT)
//     REOPENED -> ACTIVE     CONTINUED_ANCHORING    (10.2, the CU is anchored by construction)
//   every OTHER Thread T that is ACTIVE or REOPENED:
//     explicit stable departure (10.3): the CU carries FOCUS_SHIFT and its
//       independent attention is a focus not bound to T and is not a local
//       clarification anchored to T                 -> DORMANT  EXPLICIT_FOCUS_SHIFT
//     else T is REOPENED and the CU is meaningfully anchored to T (attention
//       on T, or canonical target_cu_id closing to a CU bound to T)
//                                                    -> ACTIVE   CONTINUED_ANCHORING
//     else sustained departure (10.4): the CU AND the immediately preceding
//       committed CU both carry independent attention away from T, neither a
//       local clarification of T, neither anchored to T through its target
//                                                    -> DORMANT  SUSTAINED_DEPARTURE
//       at the CURRENT CU only; dormancy is never backdated to the previous CU
//
// What never causes Dormancy (10.5): one NO_INDEPENDENT_FOCUS CU, one brief
// interruption, one local clarification, one correction anchored to T,
// background analysis, elapsed time, or any judgment without canonical B1
// evidence. Incidental mention alone never makes a Reopened Thread Active.
//
// Migration 0070 mirrors this reducer in SQL
// (`derive_conversation_thread_lifecycle_transitions_v1`) and refuses any
// payload that differs, so the application can never author a transition.

import type { CanonicalCuFocusSemanticPayload } from '../conversational-focus/durable-focus-payload.types';
import { compareThreadIdText } from './thread-continuity.types';
import {
  THREAD_LIFECYCLE_STATES,
  ThreadLifecycleRejectedError,
  type PreparedThreadLifecycleTransition,
  type ThreadLifecycleState,
} from './thread-lifecycle.types';

/** Everything the reducer may legitimately read for ONE committed CU. */
export interface ThreadLifecycleReductionInput {
  /** The canonical B1 bundle of the current CU. */
  readonly currentFocusSemantics: CanonicalCuFocusSemanticPayload;
  /** The canonical B1 bundle of the immediately preceding committed CU of the Session, or null at the first CU. */
  readonly previousFocusSemantics: CanonicalCuFocusSemanticPayload | null;
  /**
   * stable emerging_focus_id -> canonical thread_id for EVERY Session binding
   * visible to this CU: the authoritative prior bindings, the bindings made by
   * earlier CUs of the same exchange, and - when this CU itself creates one -
   * its own new binding.
   */
  readonly focusThreadBindings: ReadonlyMap<string, string>;
  /**
   * thread_id -> then-valid Session lifecycle state for every Thread bound
   * strictly BEFORE this CU. A Thread first bound at this CU is deliberately
   * absent: its ACTIVE baseline is the binding itself and never a transition.
   */
  readonly threadStates: ReadonlyMap<string, ThreadLifecycleState>;
  /** cu_id -> canonical B1 bundle of every prior CU this decision may see (for canonical target_cu_id closure). */
  readonly semanticsByCuId: ReadonlyMap<string, CanonicalCuFocusSemanticPayload>;
}

const isFocusBearing = (bundle: CanonicalCuFocusSemanticPayload): boolean =>
  bundle.attention.kind !== 'NO_INDEPENDENT_FOCUS' && bundle.attention.emerging_focus_id !== null;

/**
 * Reduces ONE committed CU to its lifecycle transitions, in canonical
 * (textual Thread id) order. Every transition is legal by construction and
 * carries its derived `fromState`.
 */
export function reduceThreadLifecycle(input: ThreadLifecycleReductionInput): readonly PreparedThreadLifecycleTransition[] {
  assertInput(input);
  const { currentFocusSemantics: current, previousFocusSemantics: previous, focusThreadBindings, threadStates, semanticsByCuId } = input;

  const focusesOf = new Map<string, Set<string>>();
  for (const [focusId, threadId] of focusThreadBindings) {
    const focuses = focusesOf.get(threadId) ?? new Set<string>();
    focuses.add(focusId);
    focusesOf.set(threadId, focuses);
  }
  for (const threadId of threadStates.keys()) {
    if (!focusesOf.has(threadId)) throw new ThreadLifecycleRejectedError('LIFECYCLE_CONTEXT_NOT_CLOSED');
  }

  const attentionOn = (bundle: CanonicalCuFocusSemanticPayload, threadId: string): boolean =>
    isFocusBearing(bundle) && (focusesOf.get(threadId)?.has(bundle.attention.emerging_focus_id as string) ?? false);
  const targetsThread = (bundle: CanonicalCuFocusSemanticPayload, threadId: string): boolean => {
    if (bundle.target_cu_id === null) return false;
    const target = semanticsByCuId.get(bundle.target_cu_id);
    return target !== undefined && attentionOn(target, threadId);
  };
  const anchoredTo = (bundle: CanonicalCuFocusSemanticPayload, threadId: string): boolean =>
    attentionOn(bundle, threadId) || targetsThread(bundle, threadId);
  const localClarificationOf = (bundle: CanonicalCuFocusSemanticPayload, threadId: string): boolean =>
    bundle.attention.reason === 'LOCAL_CLARIFICATION_OR_CORRECTION' && anchoredTo(bundle, threadId);
  const awayFrom = (bundle: CanonicalCuFocusSemanticPayload, threadId: string): boolean =>
    isFocusBearing(bundle) && !attentionOn(bundle, threadId) && !localClarificationOf(bundle, threadId);
  const explicitShift = (bundle: CanonicalCuFocusSemanticPayload, threadId: string): boolean =>
    awayFrom(bundle, threadId) && bundle.functions.includes('FOCUS_SHIFT');

  const ownThreadId = isFocusBearing(current) ? (focusThreadBindings.get(current.attention.emerging_focus_id as string) ?? null) : null;

  const transitions: PreparedThreadLifecycleTransition[] = [];
  for (const threadId of [...threadStates.keys()].sort(compareThreadIdText)) {
    const state = threadStates.get(threadId) as ThreadLifecycleState;
    if (threadId === ownThreadId) {
      if (state === 'DORMANT') transitions.push({ threadId, fromState: 'DORMANT', toState: 'REOPENED', reasonCode: 'GENUINE_RETURN' });
      else if (state === 'REOPENED') transitions.push({ threadId, fromState: 'REOPENED', toState: 'ACTIVE', reasonCode: 'CONTINUED_ANCHORING' });
      continue;
    }
    if (state === 'DORMANT') continue;
    if (explicitShift(current, threadId)) {
      transitions.push({ threadId, fromState: state, toState: 'DORMANT', reasonCode: 'EXPLICIT_FOCUS_SHIFT' });
    } else if (state === 'REOPENED' && anchoredTo(current, threadId)) {
      transitions.push({ threadId, fromState: 'REOPENED', toState: 'ACTIVE', reasonCode: 'CONTINUED_ANCHORING' });
    } else if (
      awayFrom(current, threadId) && !targetsThread(current, threadId)
      && previous !== null && awayFrom(previous, threadId) && !targetsThread(previous, threadId)
    ) {
      transitions.push({ threadId, fromState: state, toState: 'DORMANT', reasonCode: 'SUSTAINED_DEPARTURE' });
    }
  }
  return Object.freeze(transitions.map((transition) => Object.freeze(transition)));
}

function assertInput(input: ThreadLifecycleReductionInput): void {
  const invalid = () => new ThreadLifecycleRejectedError('INVALID_LIFECYCLE_INPUT');
  if (!input || typeof input !== 'object') throw invalid();
  const { currentFocusSemantics, previousFocusSemantics, focusThreadBindings, threadStates, semanticsByCuId } = input;
  if (!currentFocusSemantics || typeof currentFocusSemantics !== 'object' || !currentFocusSemantics.attention || !Array.isArray(currentFocusSemantics.functions)) throw invalid();
  if (previousFocusSemantics !== null && (!previousFocusSemantics || typeof previousFocusSemantics !== 'object' || !previousFocusSemantics.attention)) throw invalid();
  if (!(focusThreadBindings instanceof Map) || !(threadStates instanceof Map) || !(semanticsByCuId instanceof Map)) throw invalid();
  for (const state of threadStates.values()) {
    if (!(THREAD_LIFECYCLE_STATES as readonly string[]).includes(state)) throw new ThreadLifecycleRejectedError('INVALID_LIFECYCLE_STATE');
  }
  if (isFocusBearing(currentFocusSemantics)) {
    const own = focusThreadBindings.get(currentFocusSemantics.attention.emerging_focus_id as string);
    // A Thread bound to the current focus must have a state unless it is being bound at this very CU
    // (then its baseline is the binding). Either is legitimate; nothing else is checked here.
    void own;
  }
}
