import type { HimContextualCurrentBatchSourceRow } from './him-contextual-current-intelligence.types';

// QHIA-012 Background Human Intelligence -> Brain Context Bridge v1.
//
// The first Human Intelligence channel that is NOT computed inside the turn
// that uses it. Eight context-bound canonical current readings are materialized
// ONCE in the post-response BACKGROUND path of a completed turn, into one small
// typed durable result; the NEXT foreground turn may consume that
// already-computed materialization through exactly ONE optional read, and may
// NEVER wait for it. If it is not already available when the existing
// foreground barrier closes, the turn proceeds without it - always.
//
// Brain Context is ADVISORY CONTEXT and nothing else. It is not a direct user
// statement, not a diagnosis, not a trait, not a wellbeing / capacity /
// readiness / risk assessment, and not safety evidence. It cannot independently
// authorize a Recommendation, cannot prove or strengthen a Hypothesis, cannot
// select or require a Question, cannot change FAST/DEEP routing, and cannot
// override Safety or the Behavioral Policy.
//
// QHIA-006 remains the ONLY relevance authority: a signal exists only because
// the authenticated user explicitly bound that exact context to that exact
// conversation session, and it survives into a turn only while that exact
// binding is still ACTIVE and still points at that exact context.

// ---------------------------------------------------------------------------
// The FROZEN eight-slot Brain Context registry, in exactly this order.
// ---------------------------------------------------------------------------
//
// Deliberately EXCLUDED, and not to be added here:
//
//   * hse.stress, hse.attention, hse.motivation and hrs.communication already
//     have their own dedicated foreground consumption (QHIA-007/008/010/011).
//     Duplicating them into Brain Context would give one reading two competing
//     provider channels in the same turn.
//   * hse.energy and hbs.reflection belong to other already-shipped surfaces.
//   * every HRS relationship metric - Trust, Repair, Emotional Safety and
//     Communication - stays out entirely: relationship intelligence is not
//     background-materializable advisory context in this task.
//   * GLOBAL and CONVERSATION_SESSION are not Brain Context kinds.
//
// There is no ninth slot, and there is no way for a caller to request one: the
// registry is not a parameter anywhere in this feature - not in the background
// source RPC, not in the durable payload command, and not in the foreground
// read.
export const HIM_BRAIN_CONTEXT_DEFINITION_VERSION = 1 as const;
export const HIM_BRAIN_CONTEXT_MAX_SIGNALS = 8 as const;

export const HIM_BRAIN_CONTEXT_REGISTRY = Object.freeze([
  Object.freeze({ slotOrder: 1, slot: 'DECISION_SELF_CONFIDENCE', contextKind: 'DECISION', metricKey: 'hse.self-confidence' }),
  Object.freeze({ slotOrder: 2, slot: 'SITUATION_AVOIDANCE_FREQUENCY', contextKind: 'SITUATION', metricKey: 'hbs.avoidance' }),
  Object.freeze({ slotOrder: 3, slot: 'SITUATION_SELF_AWARENESS', contextKind: 'SITUATION', metricKey: 'hgs.self-awareness' }),
  Object.freeze({ slotOrder: 4, slot: 'SITUATION_RESILIENCE', contextKind: 'SITUATION', metricKey: 'hgs.resilience' }),
  Object.freeze({ slotOrder: 5, slot: 'GOAL_CONSISTENCY', contextKind: 'GOAL', metricKey: 'hbs.consistency' }),
  Object.freeze({ slotOrder: 6, slot: 'GOAL_INITIATIVE', contextKind: 'GOAL', metricKey: 'hbs.initiative' }),
  Object.freeze({ slotOrder: 7, slot: 'GOAL_PURPOSE_ALIGNMENT', contextKind: 'GOAL', metricKey: 'hgs.purpose-alignment' }),
  Object.freeze({ slotOrder: 8, slot: 'GOAL_HABIT_STRENGTH', contextKind: 'GOAL', metricKey: 'hgs.habit-strength' }),
] as const);

export type HimBrainContextSlot = (typeof HIM_BRAIN_CONTEXT_REGISTRY)[number]['slot'];
export type HimBrainContextContextKind = (typeof HIM_BRAIN_CONTEXT_REGISTRY)[number]['contextKind'];
export type HimBrainContextRegistryEntry = (typeof HIM_BRAIN_CONTEXT_REGISTRY)[number];

/** The exact frozen registry entry for a slot ordinal, or undefined. Identity lookup only - it decides nothing. */
export function himBrainContextRegistryEntry(slotOrder: unknown): HimBrainContextRegistryEntry | undefined {
  if (typeof slotOrder !== 'number' || !Number.isSafeInteger(slotOrder)) return undefined;
  return HIM_BRAIN_CONTEXT_REGISTRY.find((entry) => entry.slotOrder === slotOrder);
}

// The existing v1 structured scale contract. A canonical current numeric value
// is an integer in [1, 5]. Structural bound only - never a semantic
// interpretation, normalization, valence, or cross-metric arithmetic.
export type HimBrainContextNumericValue = 1 | 2 | 3 | 4 | 5;

// ---------------------------------------------------------------------------
// Background source transport (service-role, migration 0061).
// ---------------------------------------------------------------------------
//
// One row per frozen slot whose context kind has an exact ACTIVE QHIA-006
// binding, from the ONE execution-bound source RPC. The row is deliberately
// QHIA-004-COMPATIBLE so the shared projectHimContextualCurrentSlot(...)
// projection - not a second copy of it - decides KNOWN vs UNKNOWN.
export interface HimBrainContextSourceRow extends HimContextualCurrentBatchSourceRow {
  brain_slot_order: number;
  brain_slot: string;
}

// ---------------------------------------------------------------------------
// The durable materialization payload (background -> durable ledger -> next turn).
// ---------------------------------------------------------------------------
//
// Minimal and bounded ON PURPOSE. The eight frozen slot labels carry the whole
// provider-safe semantic identity, so the payload deliberately holds NO metric
// key, NO measurement event / observation / snapshot / canonical-binding /
// active-binding identity, NO timestamp, NO observedAt, NO temporal window, NO
// confidence or freshness reference, NO transcript, NO Memory, NO Hypothesis,
// NO provider payload, NO target label and NO arbitrary text.
//
// contextId IS retained: it is the exact identity the next turn revalidates
// against the CURRENT ACTIVE binding, and it never reaches a provider.
export interface HimBrainContextDurableSignal {
  slotOrder: number;
  slot: HimBrainContextSlot;
  contextKind: HimBrainContextContextKind;
  contextId: string;
  numericValue: HimBrainContextNumericValue;
  semanticMappingStatus: 'RESOLVED' | 'UNRESOLVED';
  semanticType: string | null;
  freshnessState: 'UNASSESSED';
  confidenceState: 'UNASSESSED';
}

export const HIM_BRAIN_CONTEXT_MATERIALIZATION_SOURCE = 'QANDEEL_HIM_BRAIN_CONTEXT_MATERIALIZATION_V1' as const;

export interface HimBrainContextDurablePayload {
  contractVersion: 1;
  source: typeof HIM_BRAIN_CONTEXT_MATERIALIZATION_SOURCE;
  sourceTurnId: string;
  signals: HimBrainContextDurableSignal[];
}

// ---------------------------------------------------------------------------
// Foreground transport (authenticated, migration 0061).
// ---------------------------------------------------------------------------
//
// Zero to eight rows, already selected from the IMMEDIATELY preceding canonical
// USER turn's durable materialization and already revalidated against the
// CURRENT ACTIVE QHIA-006 binding, server-side, in ONE request. The foreground
// application performs no relevance read of its own and rereads no metric.
export interface HimBrainContextForegroundRow {
  slot_order: number;
  slot: string;
  context_kind: string;
  context_id: string;
  numeric_value: number;
  semantic_mapping_status: string;
  semantic_type: string | null;
  freshness_state: string;
  confidence_state: string;
}

// ---------------------------------------------------------------------------
// The provider-facing contract.
// ---------------------------------------------------------------------------
//
// Everything that could identify a database row, a context, a turn, a metric,
// or a moment in time is STRIPPED here and never reaches a provider: no
// contextId, no sourceTurnId, no slot ordinal, no metric key, no timestamp, no
// binding identity, no effect identity. Freshness and confidence stay exactly
// UNASSESSED - this channel derives neither, ever.
//
// Absence is expressed by the ABSENCE of the whole object: there is no EMPTY
// availability state, because sending an empty block merely to prove the
// feature ran would be noise the provider must then reason about.
export interface HimBrainContext {
  contractVersion: 1;
  source: 'QANDEEL_HIM_BRAIN_CONTEXT_V1';
  availability: 'AVAILABLE';
  signals: ReadonlyArray<{
    slot: HimBrainContextSlot;
    numericValue: HimBrainContextNumericValue;
    semanticMappingStatus: 'RESOLVED' | 'UNRESOLVED';
    semanticType: string | null;
    freshnessState: 'UNASSESSED';
    confidenceState: 'UNASSESSED';
  }>;
}
