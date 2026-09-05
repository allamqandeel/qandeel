/**
 * T-03A2 - the shared server/client temporal wire contract, extended
 * ADDITIVELY by T-03D with the authoritative current Live Focus.
 *
 * Stage 6 freezes `ONE COMMITTED CU = ONE MOMENT`, `SP(m)` as the per-Session
 * ordinal of a committed CU, and `LH` as the greatest committed CU SP in the
 * current Session. These declarations are the ONLY shape in which that truth
 * crosses the server/client boundary.
 *
 * Deliberately absent, and owned by later tasks: Reading, Evidence, Memory,
 * Question, Confidence, K(TC)/V, KF/VF/VT, Timeline windows, Map geometry,
 * Preview and RH. Also absent: committed text, analysis, and any timestamp - a
 * timestamp is never SP, so no time field exists here to be mistaken for
 * temporal authority. Effective Live Focus crosses only as the closed
 * reference identity declared in `live-focus.d.ts`: no Thread name, Home
 * location, direction, spatial hint, future object count or analytical
 * content.
 *
 * The internal server-side `same_sp_event_sequence` is NOT part of this wire
 * contract and never becomes a client-visible value or a transport cursor.
 */

import type { LiveFocusTransitionWireEvent, LiveFocusWireValue } from './live-focus';

/** The frozen wire type of the committed-CU advancement event. */
export type ConversationalUnitsCommittedType = 'CONVERSATIONAL_UNITS_COMMITTED';

/**
 * One durable committed-CU advancement, delivered per NON-ZERO commitment
 * batch. A zero-CU batch is a valid committed evaluation batch that allocates
 * no SP and therefore produces no event at all.
 *
 * The block may cover several Moments (`firstSp=20, lastSp=23, unitCount=4`).
 * Each Moment stays independently addressable by its own SP in the durable
 * committed-CU rows; the delivery event does not enumerate them.
 */
export interface ConversationalUnitsCommittedWireEvent {
  readonly type: ConversationalUnitsCommittedType;
  readonly version: 1;
  readonly sessionId: string;
  readonly batchId: string;
  readonly sourceTurnId: string;
  /** First allocated Session Position of the block. Always >= 1. */
  readonly firstSp: number;
  /** Last allocated Session Position of the block. Always >= firstSp. */
  readonly lastSp: number;
  /** Always exactly `lastSp - firstSp + 1`. */
  readonly unitCount: number;
}

/**
 * Authoritative current Session live truth.
 *
 * `liveHead` is `null` when no user-addressable committed CU exists yet in the
 * Session. `null` is a technical absence: it is not SP(0), not PRE_FIRST_SP as
 * a Product state, not a Moment and not a temporal mode. Zero is never sent.
 *
 * `liveFocus` is the authoritative current effective Live Focus, so a client
 * never has to replay every transition merely to know current Live state.
 * When `liveHead` is `null`, `liveFocus` is `NONE`: no Emerging Focus or
 * Thread LF exists before the first committed SP. `liveFocusAtSp` is the
 * Session Position at which the current value became effective (`null` for
 * NONE with no transition yet) so the client mirror can order later catch-up
 * transitions against the snapshot; it is an SP, never a timestamp and never
 * the internal same-SP sequence.
 */
export interface SessionTemporalSnapshot {
  readonly sessionId: string;
  readonly liveHead: number | null;
  readonly liveFocus: LiveFocusWireValue;
  readonly liveFocusAtSp: number | null;
}

/**
 * The temporal delivery attached to a completed conversational exchange.
 *
 * `committedEvents` carries the events created or replayed for that exchange,
 * ordered by Session Position. `liveHead` is authoritative after the atomic
 * USER -> ASSISTANT establishment. These two LH fields are frozen by T-03A2
 * and are never removed or reinterpreted.
 */
export interface ConversationTemporalDelivery {
  readonly liveHead: number | null;
  readonly committedEvents: readonly ConversationalUnitsCommittedWireEvent[];
}

/**
 * T-03D: the live delivery attached to a completed conversational exchange -
 * the T-03A2 temporal delivery extended ADDITIVELY with the authoritative
 * current Live Focus and the LF transitions created or replayed for that
 * exchange, ordered by `atSp`. A zero-CU exchange carries no transition and
 * leaves `liveFocus` at the prior current LF. The internal same-SP sequence
 * never appears here.
 */
export interface ConversationLiveDelivery extends ConversationTemporalDelivery {
  readonly liveFocus: LiveFocusWireValue;
  readonly liveFocusTransitions: readonly LiveFocusTransitionWireEvent[];
}
