// T-03D - Effective Live Focus: the frozen LF vocabulary and the reducer
// boundary types.
//
// This directory is canonical Product task T-03D, one Architecture-sized
// task: effective Live Focus, the FINAL same-SP semantic chain and the
// production authority cutover. It holds NO provider, NO model, NO prompt and
// NO configuration: effective LF is a deterministic reduction (D-01).
//
// Frozen Live Focus constitution (Stage 6.5 v3 SDM-04, LF-01 .. LF-04):
//
//   LF = CURRENT LIVE CONVERSATIONAL ATTENTION ONLY.
//   LF = NONE | EMERGING(emerging_focus_id) | THREAD(thread_id).
//
// It is NOT importance, rank, confidence, analytical strength, centrality,
// permanent priority, Inspected Focus, the latest Map click, the current
// viewport or an explicit user-owned Context Activation. Only an Emerging
// Focus and an Established Thread may be direct LF values; a Reading,
// Hypothesis, Memory, Question, Information Gap, Material, Evidence edge,
// Confidence object, Map region or inspection reference never is. Map
// navigation never changes LF. LF changes passively when committed
// conversation changes attention, and wall-clock passage never clears it.

import type { CanonicalCuFocusSemanticPayload } from '../conversational-focus/durable-focus-payload.types';
import type { ThreadLayerOutcome } from '../thread-lifecycle/durable-thread-lifecycle-payload.types';
import type { ThreadLifecycleState } from '../thread-lifecycle/thread-lifecycle.types';

/** The closed LF value domain. Exactly three kinds; nothing else is representable. */
export const LIVE_FOCUS_KINDS = Object.freeze(['NONE', 'EMERGING', 'THREAD'] as const);
export type LiveFocusKind = (typeof LIVE_FOCUS_KINDS)[number];

export type EffectiveLiveFocus =
  | { readonly kind: 'NONE' }
  | { readonly kind: 'EMERGING'; readonly emergingFocusId: string }
  | { readonly kind: 'THREAD'; readonly threadId: string };

export const LIVE_FOCUS_NONE: EffectiveLiveFocus = Object.freeze({ kind: 'NONE' } as const);

/** The closed, deterministic reasons of an LF transition. No model, no timer, no importance. */
export const LIVE_FOCUS_TRANSITION_REASONS = Object.freeze([
  'NEW_INDEPENDENT_FOCUS',
  'THREAD_PROMOTION',
  'RETURN_TO_THREAD',
  'FOCUS_REPLACEMENT',
  'STABLE_DEPARTURE_NO_REPLACEMENT',
] as const);
export type LiveFocusTransitionReason = (typeof LIVE_FOCUS_TRANSITION_REASONS)[number];

/** The reducer identity recorded on every technical LF capture batch. */
export const LIVE_FOCUS_REDUCER_VERSION = 'live-focus-reducer-v1';

/** Deterministic value equality over the closed domain. */
export function liveFocusEquals(a: EffectiveLiveFocus, b: EffectiveLiveFocus): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'EMERGING' && b.kind === 'EMERGING') return a.emergingFocusId === b.emergingFocusId;
  if (a.kind === 'THREAD' && b.kind === 'THREAD') return a.threadId === b.threadId;
  return true;
}

/** The reference identity of a value, or null for NONE (the only channel a value crosses a boundary by). */
export function liveFocusRef(value: EffectiveLiveFocus): string | null {
  if (value.kind === 'EMERGING') return value.emergingFocusId;
  if (value.kind === 'THREAD') return value.threadId;
  return null;
}

export function liveFocusFromParts(kind: LiveFocusKind, ref: string | null): EffectiveLiveFocus {
  if (kind === 'NONE') {
    if (ref !== null) throw new LiveFocusRejectedError('INVALID_LIVE_FOCUS_VALUE');
    return LIVE_FOCUS_NONE;
  }
  if (typeof ref !== 'string' || ref.length === 0) throw new LiveFocusRejectedError('INVALID_LIVE_FOCUS_VALUE');
  return kind === 'EMERGING' ? { kind: 'EMERGING', emergingFocusId: ref } : { kind: 'THREAD', threadId: ref };
}

/**
 * The FINAL Thread-layer result of the current CU, exactly as the T-03B3
 * decision names it: the closed outcome, the bound / established Thread for
 * the four binding-bearing outcomes, and the CU's stable focus.
 */
export interface CurrentThreadLayerResult {
  readonly outcome: ThreadLayerOutcome;
  readonly emergingFocusId: string | null;
  readonly threadId: string | null;
}

/**
 * Everything the reducer may legitimately read for ONE committed CU (D-01).
 * No timestamp, Map state, camera, inspection, analytical object, confidence,
 * similarity, Home coordinate, Thread importance or future CU is
 * representable here.
 */
export interface LiveFocusReductionInput {
  /** The canonical B1 bundle of the current CU. */
  readonly currentFocusSemantics: CanonicalCuFocusSemanticPayload;
  /** The FINAL Thread-layer result of the current CU (after B2 / B3). */
  readonly currentThreadLayer: CurrentThreadLayerResult;
  /** The effective LF before this CU: the authoritative current LF, then each earlier same-exchange CU's LF. */
  readonly priorLiveFocus: EffectiveLiveFocus;
  /** cu_id -> canonical B1 bundle of every prior CU this decision may see (for canonical target_cu_id closure). */
  readonly semanticsByCuId: ReadonlyMap<string, CanonicalCuFocusSemanticPayload>;
  /** stable emerging_focus_id -> canonical thread_id for every Session binding visible to this CU. */
  readonly focusThreadBindings: ReadonlyMap<string, string>;
  /**
   * R1-01 (B3 -> D same-Moment closure): the frozen Session lifecycle state of
   * the prior LF's Thread AFTER this CU's FINAL Thread-layer result (its own
   * lifecycle transitions applied), or `null` when the prior LF is not a
   * Thread. A departure to NONE from a THREAD prior is admissible only when
   * this state is DORMANT; an ACTIVE / REOPENED Thread keeps the LF.
   */
  readonly priorThreadLifecycleState: ThreadLifecycleState | null;
}

/** One prepared (in-memory) LF transition of ONE CU. */
export interface PreparedLiveFocusTransition {
  readonly from: EffectiveLiveFocus;
  readonly to: EffectiveLiveFocus;
  readonly reasonCode: LiveFocusTransitionReason;
}

/** The reduction of ONE CU: its effective LF and its transition, if any. */
export interface LiveFocusReduction {
  readonly effective: EffectiveLiveFocus;
  readonly transition: PreparedLiveFocusTransition | null;
}

/**
 * Every reason the reducer can refuse an input. All FAIL-CLOSED: a malformed
 * or contradictory input is never treated as "LF unchanged" and never as NONE.
 */
export type LiveFocusRejectionReason =
  | 'INVALID_LIVE_FOCUS_INPUT'
  | 'INVALID_LIVE_FOCUS_VALUE'
  /** The FINAL Thread-layer result does not name the CU's own stable focus, or binds without a Thread. */
  | 'THREAD_LAYER_MISMATCH'
  /** A canonical target CU of a departure candidate is not in the visible history. */
  | 'LIVE_FOCUS_CONTEXT_NOT_CLOSED';

export class LiveFocusRejectedError extends Error {
  constructor(readonly reason: LiveFocusRejectionReason) {
    super(`Live Focus reduction was rejected: ${reason}.`);
    this.name = 'LiveFocusRejectedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
