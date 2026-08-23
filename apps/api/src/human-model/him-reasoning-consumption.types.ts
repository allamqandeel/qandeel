import type {
  HimSnapshotContextKind,
  HimSnapshotCoverageState,
  HimSnapshotOrdinalCategory,
} from './him-intelligence-snapshot.types';
import type { HimValidityStatus } from './him.types';

export type HimReasoningKnowledgeState = 'KNOWN' | 'UNKNOWN';
export type HimReasoningUnknownReason =
  | 'NO_MEASUREMENT'
  | 'LATEST_MEASUREMENT_UNASSESSED'
  | 'LATEST_MEASUREMENT_INVALIDATED'
  | 'INCOMPATIBLE_ACTIVE_BINDING';

export interface HimReasoningMetric {
  metricKey: string;
  definitionVersion: 1;
  semanticType: 'STATE';
  knowledgeState: HimReasoningKnowledgeState;
  unknownReason: HimReasoningUnknownReason | null;
  ordinalCategory: HimSnapshotOrdinalCategory | null;
  observationQualifier: 'LATEST_KNOWN' | null;
  scaleReference: string | null;
  scaleVersion: number | null;
  observedAt: string | null;
  freshnessState: 'UNASSESSED';
  freshnessReference: null;
  confidenceState: 'UNASSESSED';
  confidenceReference: null;
  validityStatus: HimValidityStatus | null;
  measurementEventId: string | null;
  measurementObservationId: string | null;
  calculationResultId: string | null;
  canonicalBindingId: string | null;
  instrumentId: string | null;
  instrumentVersion: number | null;
  modelId: string | null;
  modelVersion: number | null;
}

export interface HimReasoningContext {
  source: 'HIM_INTELLIGENCE_SNAPSHOT';
  sourceSnapshotContractVersion: 1;
  contextKind: HimSnapshotContextKind;
  contextId: string;
  generatedAt: string;
  coverageState: HimSnapshotCoverageState;
  eligibleMetricCount: number;
  assessedMetricCount: number;
  unassessedMetricCount: number;
  metrics: HimReasoningMetric[];
}
