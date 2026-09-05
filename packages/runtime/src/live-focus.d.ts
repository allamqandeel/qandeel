/**
 * T-03D - the shared server/client Live Focus wire contract.
 *
 * Stage 6.5 v3 freezes effective Live Focus (`LF`) as CURRENT LIVE
 * CONVERSATIONAL ATTENTION ONLY, with exactly three values:
 * `NONE | EMERGING(emerging_focus_id) | THREAD(thread_id)`. These
 * declarations are the ONLY shape in which that truth crosses the
 * server/client boundary.
 *
 * The wire carries canonical LF reference identity and the Session Position
 * at which it became effective, and NOTHING else: no label or name, no Home
 * coordinate, no direction or spatial hint, no relation count, no confidence
 * or importance, no committed text, no analytical content, no future object
 * count, no K(TC) projection and no locatability. T-03C / T-04 / T-07 later
 * decide what is locatable or renderable at `K(TC)`; nothing is precomputed
 * here. The internal server-side `same_sp_event_sequence` is NOT part of
 * this contract and never becomes a client-visible value or a transport
 * cursor.
 */

/** The frozen wire type of the passive Live Focus transition event. */
export type LiveFocusTransitionType = 'LIVE_FOCUS_TRANSITION';

export type LiveFocusWireValue =
  | { readonly kind: 'NONE' }
  | { readonly kind: 'EMERGING'; readonly emergingFocusId: string }
  | { readonly kind: 'THREAD'; readonly threadId: string };

/**
 * One durable effective-LF transition, delivered once per committed CU whose
 * LF differs from the prior effective LF, anchored at that CU's Session
 * Position. An unchanged LF produces no event. Exactly one LF transition
 * exists per Session Position.
 */
export interface LiveFocusTransitionWireEvent {
  readonly type: LiveFocusTransitionType;
  readonly version: 1;
  readonly sessionId: string;
  /** The committed Session Position at which the value became effective. Always >= 1. */
  readonly atSp: number;
  readonly value: LiveFocusWireValue;
}
