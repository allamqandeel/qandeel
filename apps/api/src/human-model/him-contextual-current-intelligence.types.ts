// QHIA-003 Cross-Family Contextual Current Intelligence v1.
//
// Read-only Runtime Consumption infrastructure: a deterministic typed
// projection of the canonical current HIM intelligence for one explicitly
// supplied exact owned context, across HSE/HBS/HRS/HGS. This boundary decides
// nothing about which context is relevant to a conversation, performs no
// provider/orchestrator work, derives no trend/freshness/valence/score, and
// creates no new database authority.
import type {
  HimCalculationStatus,
  HimContextKind,
  HimOwner,
  HimSemanticMappingStatus,
  HimSemanticType,
  HimValidityStatus,
  HimValueState,
} from './him.types';

export type HimRuntimeCurrentIntelligenceContextKind = Extract<
  HimContextKind,
  'CONVERSATION_SESSION' | 'SITUATION' | 'GOAL' | 'DECISION' | 'RELATIONSHIP'
>;

// The frozen QHIA-002/QHIA-003 Runtime availability contract, in exact
// deterministic slot order. This is an APPLICATION runtime availability
// contract layered on top of the persisted definition authority - it never
// replaces persisted valid_context_kinds, and the service fails closed when
// the persisted definition disagrees with a slot. GLOBAL is deliberately
// absent: none of the 17 canonical v1 metrics is approved as a global runtime
// trait. The union of these arrays is exactly the 17 canonical metric keys.
export const HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS = Object.freeze<
  Record<HimRuntimeCurrentIntelligenceContextKind, readonly string[]>
>({
  CONVERSATION_SESSION: ['hse.stress', 'hse.energy', 'hse.attention', 'hbs.reflection'],
  SITUATION: [
    'hse.stress', 'hse.motivation', 'hse.self-confidence', 'hse.attention',
    'hbs.avoidance', 'hbs.consistency', 'hbs.initiative', 'hbs.reflection',
    'hgs.self-awareness', 'hgs.resilience', 'hgs.habit-strength',
  ],
  GOAL: [
    'hse.motivation', 'hbs.avoidance', 'hbs.consistency', 'hbs.initiative',
    'hgs.self-awareness', 'hgs.resilience', 'hgs.purpose-alignment', 'hgs.habit-strength',
  ],
  DECISION: ['hse.self-confidence', 'hse.attention'],
  RELATIONSHIP: ['hrs.relationship-trust', 'hrs.communication', 'hrs.repair', 'hrs.emotional-safety'],
});

export type HimContextualCurrentUnknownReason =
  | 'NO_CANONICAL_CURRENT_VALUE'
  | 'LATEST_VALUE_UNASSESSED'
  | 'LATEST_VALUE_INVALIDATED'
  | 'INCOMPATIBLE_ACTIVE_BINDING';

export interface HimContextualCurrentMetric {
  metricKey: string;
  definitionVersion: 1;
  hifOwner: HimOwner;
  semanticMappingStatus: HimSemanticMappingStatus;
  semanticType: HimSemanticType | null;
  knowledgeState: 'KNOWN' | 'UNKNOWN';
  numericValue: number | null;
  unknownReason: HimContextualCurrentUnknownReason | null;
  // Audit provenance of a KNOWN value only: the ACTIVE canonical binding the
  // value was verified against. UNKNOWN never exposes a binding or any other
  // fragment of an unusable stored value.
  canonicalBindingId: string | null;
  observedAt: string | null;
  temporalWindowStart: string | null;
  temporalWindowEnd: string | null;
  freshnessState: 'UNASSESSED';
  freshnessReference: null;
  confidenceState: 'UNASSESSED';
  confidenceReference: null;
}

export interface HimContextualCurrentIntelligence {
  contractVersion: 1;
  source: 'HIM_CANONICAL_LATEST_MEASUREMENT';
  contextKind: HimRuntimeCurrentIntelligenceContextKind;
  contextId: string;
  coverageState: 'FULL' | 'PARTIAL' | 'EMPTY';
  eligibleMetricCount: number;
  knownMetricCount: number;
  unknownMetricCount: number;
  metrics: HimContextualCurrentMetric[];
}

// QHIA-004: one batch source row per requested slot from the single
// latency-bounded transport RPC (rpc/read_him_contextual_current_intelligence
// _batch_v1, migration 0054). The database function DELEGATES every per-slot
// current-value read to the canonical latest authority (migration 0052) and
// every binding identity to the existing ACTIVE-binding resolver (migration
// 0050), and reads the exact persisted definition rows only for the metadata
// below - it is transport aggregation, never a second currentness authority.
// slot_order is the 1-based input array ordinal. When no canonical current
// row exists for a slot, has_canonical_current_value is false and every
// source/current field is null while the requested/definition metadata stays
// present.
export interface HimContextualCurrentBatchSourceRow {
  slot_order: number;
  metric_key: string;
  definition_version: number;
  hif_owner: HimOwner;
  semantic_mapping_status: HimSemanticMappingStatus;
  semantic_type: HimSemanticType | null;
  calculation_status: HimCalculationStatus;
  valid_context_kinds: HimContextKind[];
  context_kind: HimContextKind;
  context_id: string;
  has_canonical_current_value: boolean;
  source_metric_key: string | null;
  source_definition_version: number | null;
  source_semantic_mapping_status: HimSemanticMappingStatus | null;
  source_semantic_type: HimSemanticType | null;
  source_context_kind: HimContextKind | null;
  source_context_id: string | null;
  value_state: HimValueState | null;
  numeric_value: number | null;
  validity_status: HimValidityStatus | null;
  confidence_state: 'UNASSESSED' | null;
  confidence_reference: string | null;
  observed_at: string | null;
  temporal_window_start: string | null;
  temporal_window_end: string | null;
  canonical_binding_id: string | null;
  active_binding_id: string | null;
}

// QHIA-004: the distinct typed result of a validated SELECTIVE subset read.
// A subset deliberately does not reuse eligibleMetricCount - that field
// belongs to the full-context contract above and always means the complete
// frozen slot array for the context. requestedMetricCount counts exactly the
// validated, canonically reordered subset this result answers for. The
// metric-level contract is identical to the full-context one.
export interface HimContextualCurrentSelection {
  contractVersion: 1;
  source: 'HIM_CANONICAL_LATEST_MEASUREMENT';
  contextKind: HimRuntimeCurrentIntelligenceContextKind;
  contextId: string;
  coverageState: 'FULL' | 'PARTIAL' | 'EMPTY';
  requestedMetricCount: number;
  knownMetricCount: number;
  unknownMetricCount: number;
  metrics: HimContextualCurrentMetric[];
}
