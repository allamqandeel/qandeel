/**
 * T-03A2 - the shared server/client temporal wire contract.
 *
 * Stage 6 freezes `ONE COMMITTED CU = ONE MOMENT`, `SP(m)` as the per-Session
 * ordinal of a committed CU, and `LH` as the greatest committed CU SP in the
 * current Session. These declarations are the ONLY shape in which that truth
 * crosses the server/client boundary in T-03A2.
 *
 * Deliberately absent, and owned by later tasks: Live Focus, Emerging Focus,
 * Thread identity/lifecycle, Reading, Evidence, Memory, Question, Confidence,
 * K(TC)/V, KF/VF/VT, Timeline windows, Map geometry, Preview and RH. Also
 * absent: committed text, analysis, and any timestamp - a timestamp is never
 * SP, so no time field exists here to be mistaken for temporal authority.
 *
 * The internal server-side `same_sp_event_sequence` is NOT part of this wire
 * contract and never becomes a client-visible value or a transport cursor.
 */

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
 * Authoritative current Session temporal truth.
 *
 * `liveHead` is `null` when no user-addressable committed CU exists yet in the
 * Session. `null` is a technical absence: it is not SP(0), not PRE_FIRST_SP as
 * a Product state, not a Moment and not a temporal mode. Zero is never sent.
 */
export interface SessionTemporalSnapshot {
  readonly sessionId: string;
  readonly liveHead: number | null;
}

/**
 * The temporal delivery attached to a completed conversational exchange.
 *
 * `committedEvents` carries the events created or replayed for that exchange,
 * ordered by Session Position. `liveHead` is authoritative after the atomic
 * USER -> ASSISTANT establishment.
 */
export interface ConversationTemporalDelivery {
  readonly liveHead: number | null;
  readonly committedEvents: readonly ConversationalUnitsCommittedWireEvent[];
}
