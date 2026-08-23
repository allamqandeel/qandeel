import type { HimSnapshotCoverageState, HimSnapshotOrdinalCategory } from './him-intelligence-snapshot.types';
import type { HimReasoningKnowledgeState, HimReasoningUnknownReason } from './him-reasoning-consumption.types';
import type { HimValidityStatus } from './him.types';

export interface HimFastModelMetric {
  metricKey: string;
  knowledgeState: HimReasoningKnowledgeState;
  ordinalCategory: HimSnapshotOrdinalCategory | null;
}

export interface HimDeepModelMetric extends HimFastModelMetric {
  unknownReason: HimReasoningUnknownReason | null;
  observationQualifier: 'LATEST_KNOWN' | null;
  observedAt: string | null;
  freshnessState: 'UNASSESSED';
  confidenceState: 'UNASSESSED';
  validityStatus: HimValidityStatus | null;
}

interface HimModelContextBase {
  contractVersion: 1;
  source: 'HIM_REASONING_CONTEXT';
  sourceSnapshotContractVersion: 1;
  contextKind: 'CONVERSATION_SESSION';
  contextId: string;
  coverageState: HimSnapshotCoverageState;
  eligibleMetricCount: number;
  knownMetricCount: number;
  unknownMetricCount: number;
  freshnessPolicy: 'UNASSESSED';
  confidencePolicy: 'UNASSESSED';
}

export interface HimFastModelContext extends HimModelContextBase {
  consumptionMode: 'FAST';
  metrics: HimFastModelMetric[];
}

export interface HimDeepModelContext extends HimModelContextBase {
  consumptionMode: 'DEEP';
  metrics: HimDeepModelMetric[];
}

export type HimModelContext = HimFastModelContext | HimDeepModelContext;
