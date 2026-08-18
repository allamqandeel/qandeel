export const HIM_SEMANTIC_TYPES = ['STATE', 'TRAIT', 'CAPABILITY', 'READINESS', 'ALIGNMENT', 'UNCERTAINTY', 'PROGRESS', 'LOAD'] as const;
export type HimSemanticType = (typeof HIM_SEMANTIC_TYPES)[number];

export const HIM_CONTEXT_KINDS = ['GLOBAL', 'RELATIONSHIP', 'DECISION', 'GOAL', 'CONVERSATION_SESSION', 'SITUATION'] as const;
export type HimContextKind = (typeof HIM_CONTEXT_KINDS)[number];

export const HIM_VALIDITY_STATUSES = ['VALID', 'INVALIDATED'] as const;
export type HimValidityStatus = (typeof HIM_VALIDITY_STATUSES)[number];
export const HIM_VALUE_STATES = ['UNASSESSED', 'ASSESSED'] as const;
export type HimValueState = (typeof HIM_VALUE_STATES)[number];

export const MAX_HIM_CONTEXT_ID_LENGTH = 128;
export const MAX_HIM_EVIDENCE_PER_ROLE = 32;
export const MAX_HIM_DEPENDENCIES = 32;
export const HIM_CANONICAL_SOURCE_ENGINE = 'QANDEEL_HIM_RUNTIME' as const;
export const HIM_CANONICAL_PROVENANCE = 'QANDEEL_HIM_RUNTIME_FOUNDATION_V1' as const;

export interface HimMetricDefinition {
  metricKey: string;
  canonicalName: string;
  canonicalDefinition: string;
  canonicalSource: string;
  semanticType: HimSemanticType;
  definitionVersion: number;
  scaleReference: string;
  validContextKinds: HimContextKind[];
  requiredInputContract: string;
  confidenceRequirementReference: string;
  consumers: string[];
  sourceMetadata: string[];
  dependencyIds: string[];
}

export interface HimMetricSnapshot {
  id: string; user_id: string; metric_key: string; definition_version: number;
  semantic_type: HimSemanticType; value_state: HimValueState; numeric_value: number | null;
  confidence_state: 'UNASSESSED'; confidence_reference: null;
  supporting_evidence_ids: string[]; contradicting_evidence_ids: string[]; source_engines: string[];
  context_kind: HimContextKind; context_id: string; scope: string;
  observed_at: string; temporal_window_start: string | null; temporal_window_end: string | null;
  validity_status: HimValidityStatus; snapshot_version: number;
  descriptive_update_reason: string; descriptive_update_reference_ids: string[];
  canonical_provenance: typeof HIM_CANONICAL_PROVENANCE; created_at: string;
}

export interface CreateHimMetricObservation {
  id: string; metricKey: string; definitionVersion: number; valueState: HimValueState;
  numericValue?: number; supportingEvidenceIds?: string[]; contradictingEvidenceIds?: string[];
  contextKind: HimContextKind; contextId: string; scope: string;
  temporalWindowStart?: string; temporalWindowEnd?: string; validityStatus: HimValidityStatus;
  descriptiveUpdateReason: string; descriptiveUpdateReferenceIds?: string[];
}
