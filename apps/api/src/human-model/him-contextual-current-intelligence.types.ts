// QHIA-003 Cross-Family Contextual Current Intelligence v1.
//
// Read-only Runtime Consumption infrastructure: a deterministic typed
// projection of the canonical current HIM intelligence for one explicitly
// supplied exact owned context, across HSE/HBS/HRS/HGS. This boundary decides
// nothing about which context is relevant to a conversation, performs no
// provider/orchestrator work, derives no trend/freshness/valence/score, and
// creates no new database authority.
import type {
  HimContextKind,
  HimMetricSnapshot,
  HimOwner,
  HimSemanticMappingStatus,
  HimSemanticType,
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

// Narrow source-row type around the SAME canonical latest read authority
// (rpc/read_him_latest_measurement_v1, migration 0052). That RPC returns
// SETOF public.him_metric_snapshots, whose physical rows carry the 0012
// calculation-provenance columns that the domain HimMetricSnapshot type does
// not expose. This adds typed access to the canonical binding identity only;
// it is NOT a second latest-read authority and never widens into a raw
// snapshot dump.
export interface HimCanonicalLatestSourceRow extends HimMetricSnapshot {
  canonical_binding_id: string | null;
}
