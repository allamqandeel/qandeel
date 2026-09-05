// T-03D (D-01) - the deterministic effective Live Focus reducer.
//
// There is NO LF model, NO LF provider and NO LF prompt. Effective LF is a
// pure function of already-canonical material:
//
//   - the current CU's canonical B1 attention (kind / reason / focus), its
//     canonical functions and its canonical target_cu_id;
//   - the current CU's FINAL Thread-layer result (outcome, Thread);
//   - the prior effective LF;
//   - the canonical B1 bundles of the visible prior CUs (target closure);
//   - the Session focus -> Thread bindings visible to this CU.
//
// No timer. No wall-clock duration. No turn count. No "two quiet CUs". No
// importance / confidence. No Map, camera or inspection state. No analytical
// or background activity: none of them is reachable from the inputs of this
// module, so none of them can move LF.
//
// THE RULES (task sections 3 and 4):
//
//   LF-01 / LF-03  a focus-bearing CU (START_NEW_FOCUS / ATTEND_EXISTING_FOCUS
//     with a stable emerging_focus_id):
//       the FINAL Thread layer binds the focus to a Thread (ESTABLISH_NEW,
//       ATTEND_EXISTING, ACTIVATE_EXISTING_IN_SESSION, REOPEN_EXISTING)
//                                                   -> THREAD(thread_id)
//         including the frozen same-Moment rule: an Emerging Focus
//         established NOW makes the effective LF at THIS SAME SP the new
//         Thread; earlier SPs remain Emerging history
//       otherwise (NO_THREAD_ACTION, IDENTITY_AMBIGUOUS)
//                                                   -> EMERGING(focus)
//         cross-Session identity ambiguity never erases the real current
//         Emerging Focus
//   LF-02  a NO_INDEPENDENT_FOCUS CU keeps the prior LF: a brief interruption,
//     an acknowledgement, a locally anchored clarification and every other
//     non-replacement CU changes nothing
//   LF-04  conservative departure: a NO_INDEPENDENT_FOCUS CU clears a
//     non-NONE prior LF only when ALL hold - the canonical functions include
//     FOCUS_SHIFT; B1 gives no replacement focus (it is NO_INDEPENDENT_FOCUS);
//     the attention reason is not LOCAL_CLARIFICATION_OR_CORRECTION; and the
//     canonical target_cu_id, if present, does NOT anchor the CU back to the
//     prior LF (a target CU attending the prior Emerging Focus, or attending
//     a focus bound to the prior Thread, anchors it)      -> NONE
//
// Migration 0071 mirrors this reducer in SQL
// (`derive_conversation_effective_live_focus_v1`) and refuses any payload
// that differs, so the application can never author an LF value.

import type { CanonicalCuFocusSemanticPayload } from '../conversational-focus/durable-focus-payload.types';
import {
  LIVE_FOCUS_KINDS,
  LIVE_FOCUS_NONE,
  liveFocusEquals,
  LiveFocusRejectedError,
  type EffectiveLiveFocus,
  type LiveFocusReduction,
  type LiveFocusReductionInput,
  type LiveFocusTransitionReason,
} from './live-focus.types';

const BOUND_OUTCOMES = Object.freeze(['ESTABLISH_NEW', 'ATTEND_EXISTING', 'ACTIVATE_EXISTING_IN_SESSION', 'REOPEN_EXISTING'] as const);
const FOCUS_BEARING = Object.freeze(['START_NEW_FOCUS', 'ATTEND_EXISTING_FOCUS'] as const);

const isFocusBearing = (bundle: CanonicalCuFocusSemanticPayload): boolean =>
  (FOCUS_BEARING as readonly string[]).includes(bundle.attention.kind) && bundle.attention.emerging_focus_id !== null;

/**
 * Reduces ONE committed CU to its effective LF and its transition (if any).
 * Deterministic: the same input always yields the same output.
 */
export function reduceLiveFocus(input: LiveFocusReductionInput): LiveFocusReduction {
  assertInput(input);
  const { currentFocusSemantics: current, currentThreadLayer: layer, priorLiveFocus: prior, semanticsByCuId, focusThreadBindings } = input;

  let effective: EffectiveLiveFocus;
  if (isFocusBearing(current)) {
    const focusId = current.attention.emerging_focus_id as string;
    if (layer.emergingFocusId !== focusId) throw new LiveFocusRejectedError('THREAD_LAYER_MISMATCH');
    if ((BOUND_OUTCOMES as readonly string[]).includes(layer.outcome)) {
      if (layer.threadId === null) throw new LiveFocusRejectedError('THREAD_LAYER_MISMATCH');
      effective = { kind: 'THREAD', threadId: layer.threadId };
    } else {
      effective = { kind: 'EMERGING', emergingFocusId: focusId };
    }
  } else {
    effective = prior;
    if (
      prior.kind !== 'NONE'
      && current.functions.includes('FOCUS_SHIFT')
      && current.attention.reason !== 'LOCAL_CLARIFICATION_OR_CORRECTION'
      && !anchoredToPrior(current, prior, semanticsByCuId, focusThreadBindings)
    ) {
      effective = LIVE_FOCUS_NONE;
    }
  }

  if (liveFocusEquals(effective, prior)) return Object.freeze({ effective, transition: null });
  const reasonCode = reasonOf(prior, effective, current, layer.outcome);
  return Object.freeze({ effective, transition: Object.freeze({ from: prior, to: effective, reasonCode }) });
}

/** The canonical target CU anchors the current CU to the prior LF (a local return, never a departure). */
function anchoredToPrior(
  current: CanonicalCuFocusSemanticPayload,
  prior: EffectiveLiveFocus,
  semanticsByCuId: ReadonlyMap<string, CanonicalCuFocusSemanticPayload>,
  focusThreadBindings: ReadonlyMap<string, string>,
): boolean {
  if (current.target_cu_id === null) return false;
  const target = semanticsByCuId.get(current.target_cu_id);
  if (target === undefined) throw new LiveFocusRejectedError('LIVE_FOCUS_CONTEXT_NOT_CLOSED');
  if (!isFocusBearing(target)) return false;
  const targetFocus = target.attention.emerging_focus_id as string;
  if (prior.kind === 'EMERGING') return targetFocus === prior.emergingFocusId;
  if (prior.kind === 'THREAD') return focusThreadBindings.get(targetFocus) === prior.threadId;
  return false;
}

function reasonOf(
  prior: EffectiveLiveFocus,
  effective: EffectiveLiveFocus,
  current: CanonicalCuFocusSemanticPayload,
  outcome: LiveFocusReductionInput['currentThreadLayer']['outcome'],
): LiveFocusTransitionReason {
  if (effective.kind === 'NONE') return 'STABLE_DEPARTURE_NO_REPLACEMENT';
  if (prior.kind === 'NONE') return 'NEW_INDEPENDENT_FOCUS';
  if (effective.kind === 'THREAD') {
    if (prior.kind === 'EMERGING' && prior.emergingFocusId === current.attention.emerging_focus_id) return 'THREAD_PROMOTION';
    if (outcome === 'ESTABLISH_NEW') return 'FOCUS_REPLACEMENT';
    return 'RETURN_TO_THREAD';
  }
  return 'FOCUS_REPLACEMENT';
}

function assertInput(input: LiveFocusReductionInput): void {
  const invalid = () => new LiveFocusRejectedError('INVALID_LIVE_FOCUS_INPUT');
  if (!input || typeof input !== 'object') throw invalid();
  const { currentFocusSemantics, currentThreadLayer, priorLiveFocus, semanticsByCuId, focusThreadBindings } = input;
  if (!currentFocusSemantics || typeof currentFocusSemantics !== 'object' || !currentFocusSemantics.attention || !Array.isArray(currentFocusSemantics.functions)) throw invalid();
  if (!currentThreadLayer || typeof currentThreadLayer !== 'object' || typeof currentThreadLayer.outcome !== 'string') throw invalid();
  if (!priorLiveFocus || typeof priorLiveFocus !== 'object' || !(LIVE_FOCUS_KINDS as readonly string[]).includes(priorLiveFocus.kind)) throw invalid();
  if (priorLiveFocus.kind === 'EMERGING' && (typeof priorLiveFocus.emergingFocusId !== 'string' || priorLiveFocus.emergingFocusId.length === 0)) throw invalid();
  if (priorLiveFocus.kind === 'THREAD' && (typeof priorLiveFocus.threadId !== 'string' || priorLiveFocus.threadId.length === 0)) throw invalid();
  if (!(semanticsByCuId instanceof Map) || !(focusThreadBindings instanceof Map)) throw invalid();
}
