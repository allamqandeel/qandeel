import type { HimContextKind } from './him.types';

export const HIM_MODEL_LIFECYCLES = ['DRAFT', 'VALIDATED', 'CALIBRATED', 'RETIRED'] as const;
export type HimModelLifecycle = (typeof HIM_MODEL_LIFECYCLES)[number];
export const HIM_MODEL_ENVIRONMENTS = ['PRODUCTION', 'TEST_ONLY'] as const;
export type HimModelEnvironment = (typeof HIM_MODEL_ENVIRONMENTS)[number];
export const HIM_MISSING_BEHAVIORS = ['UNASSESSED'] as const;
export const HIM_CONTRADICTION_BEHAVIORS = ['UNASSESSED_PRESERVE_CONFLICT'] as const;
export const HIM_CONFIDENCE_CONTRACTS = ['UNRESOLVED_METRIC_CONFIDENCE'] as const;
export const HIM_RESULT_STATES = ['ASSESSED', 'UNASSESSED'] as const;
export const HIM_CONTRADICTION_STATES = ['NONE', 'PRESENT_UNRESOLVED'] as const;
export const MAX_HIM_CALCULATION_REFS = 32;

export interface HimCalculationModel {
  modelId: string; modelVersion: number; targetMetricKey: string; targetDefinitionVersion: number;
  lifecycle: HimModelLifecycle; environment: HimModelEnvironment; canonicalOwner: string; canonicalSource: string;
  methodType: string; scaleContractReference: string; requiredInputKeys: string[];
  requiredEvidenceContract: string; supportedContextKinds: HimContextKind[];
  missingDataBehavior: 'UNASSESSED'; contradictionBehavior: 'UNASSESSED_PRESERVE_CONFLICT';
  confidenceContract: 'UNRESOLVED_METRIC_CONFIDENCE'; implementationId: string;
  createdAt: string; versionedAt: string; retiredAt?: string; supersededBy?: string;
}
export interface HimExactContext { kind: HimContextKind; id: string; }
export interface HimMetricCalculationInput {
  metricKey: string; definitionVersion: number; modelId: string; modelVersion: number; context: HimExactContext;
  inputs: Readonly<Record<string, unknown>>; supportingEvidenceRefs: string[]; contradictoryEvidenceRefs: string[];
  provenance: string; traceId: string; updateReason: string;
}
export interface HimMetricCalculationResult {
  metricKey: string; definitionVersion: number; modelId: string; modelVersion: number; context: HimExactContext;
  resultState: 'ASSESSED' | 'UNASSESSED'; numericValue: number | null; missingInputKeys: string[];
  contradictionState: 'NONE' | 'PRESENT_UNRESOLVED'; supportingEvidenceRefs: string[]; contradictoryEvidenceRefs: string[];
  calculatedAt: string; provenance: string; confidenceState: 'UNASSESSED'; confidenceReference: null;
  traceId: string; updateReason: string;
}
export interface HimMetricCalculator { calculate(input: HimMetricCalculationInput): Promise<HimMetricCalculationResult>; }
export interface HimCalibrationEvaluation {
  evaluationId: string; userId: string; modelId: string; modelVersion: number; metricKey: string; definitionVersion: number;
  context: HimExactContext; calculationResultId: string; referenceOutcome: Readonly<Record<string, unknown>>;
  comparisonStatus: 'RECORDED_NOT_EVALUATED'; biasState: 'UNASSESSED'; confidenceCalibrationState: 'UNASSESSED';
  evaluatedAt: string; provenance: string; evaluatorId: string; evaluatorVersion: number;
}
export interface HimCalibrationApproval {
  approvalId: string; modelId: string; modelVersion: number; authorityId: string; authorityVersion: number;
  approvedAt: string; canonicalSource: string;
}

