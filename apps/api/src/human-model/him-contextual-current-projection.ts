import { HIM_OWNERS } from './him.types';
import type {
  HimContextualCurrentBatchSourceRow,
  HimContextualCurrentMetric,
  HimContextualCurrentUnknownReason,
  HimRuntimeCurrentIntelligenceContextKind,
} from './him-contextual-current-intelligence.types';

// The single shared QHIA-003/QHIA-004 typed projection of ONE canonical batch
// source row into ONE validated current-intelligence metric.
//
// This module is a pure EXTRACTION of the validation that already lived inside
// HimContextualCurrentIntelligenceService, moved here unchanged so that a
// second consumer of the same batch row shape (QHIA-007's composed
// Situation-stress read) reuses the exact same fail-closed semantics instead
// of growing a divergent second copy. There is no behavioural change and no
// new authority: every rule below is the frozen QHIA-004 rule.
//
// It decides nothing about relevance, context selection, guidance, trend,
// freshness, valence, or behaviour - it validates a transport row and returns
// KNOWN or UNKNOWN.
export const HIM_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// The existing v1 structured scale contract: every canonical v1 metric scale
// is a five-point structured scale, so a canonical current numeric value is an
// integer in [1, 5]. This is a structural integrity bound only - never a
// semantic interpretation, normalization, valence, or cross-metric arithmetic.
export const HIM_V1_STRUCTURED_SCALE_MIN = 1;
export const HIM_V1_STRUCTURED_SCALE_MAX = 5;

export function projectHimContextualCurrentSlot(
  row: HimContextualCurrentBatchSourceRow,
  expectedMetricKey: string,
  expectedSlotOrder: number,
  kind: HimRuntimeCurrentIntelligenceContextKind,
  contextId: string,
): HimContextualCurrentMetric {
  if (row === null || typeof row !== 'object') throw new Error('INTEGRITY_FAILURE');
  // Transport integrity: the row must answer for exactly this slot of
  // exactly this request - 1-based input ordinal, exact metric identity,
  // exact context identity. Anything else fails closed.
  if (row.slot_order !== expectedSlotOrder || row.metric_key !== expectedMetricKey) throw new Error('INTEGRITY_FAILURE');
  if (row.definition_version !== 1) throw new Error('INTEGRITY_FAILURE');
  if (row.context_kind !== kind || row.context_id !== contextId) throw new Error('INTEGRITY_FAILURE');
  // The persisted exact definition remains the metadata and
  // context-eligibility authority; the batch transport returns its exact
  // row and the static runtime slot never overrides it.
  validateDefinitionMetadata(row, kind);

  if (row.has_canonical_current_value !== true && row.has_canonical_current_value !== false) throw new Error('INTEGRITY_FAILURE');
  if (!row.has_canonical_current_value) {
    // The canonical latest authority returned zero rows: it cannot safely
    // distinguish "no event ever" from "newest event has no usable current
    // calculated snapshot", and it never falls back to an older event. Do
    // not guess - and fail closed on a malformed absent-source row that
    // still carries source or current-value fragments.
    if (
      row.source_metric_key !== null || row.source_definition_version !== null ||
      row.source_semantic_mapping_status !== null || row.source_semantic_type !== null ||
      row.source_context_kind !== null || row.source_context_id !== null ||
      row.value_state !== null || row.numeric_value !== null || row.validity_status !== null ||
      row.confidence_state !== null || row.confidence_reference !== null ||
      row.observed_at !== null || row.temporal_window_start !== null || row.temporal_window_end !== null ||
      row.canonical_binding_id !== null
    ) throw new Error('INTEGRITY_FAILURE');
    return unknown(row, 'NO_CANONICAL_CURRENT_VALUE');
  }
  validateSourceRow(row, kind, contextId);

  if (row.validity_status === 'INVALIDATED') return unknown(row, 'LATEST_VALUE_INVALIDATED');
  if (row.value_state === 'UNASSESSED') return unknown(row, 'LATEST_VALUE_UNASSESSED');

  // ASSESSED: the canonical latest row may legitimately carry a historical
  // binding fallback after a binding transition (migration 0050), so an
  // assessed value is not KNOWN until it matches the current ACTIVE binding.
  if (row.canonical_binding_id === null || !HIM_UUID.test(row.canonical_binding_id)) throw new Error('INTEGRITY_FAILURE');
  if (
    row.numeric_value === null || !Number.isSafeInteger(row.numeric_value) ||
    row.numeric_value < HIM_V1_STRUCTURED_SCALE_MIN || row.numeric_value > HIM_V1_STRUCTURED_SCALE_MAX
  ) throw new Error('INTEGRITY_FAILURE');

  // The batch row's ACTIVE binding identity comes from the existing
  // migration-0050 resolver inside the transport RPC. It is consulted ONLY
  // on this ASSESSED route - its mere presence on the batch row never
  // strengthens or weakens the no-row/UNASSESSED/INVALIDATED paths above.
  const activeBindingId = row.active_binding_id;
  if (activeBindingId !== null && (typeof activeBindingId !== 'string' || !HIM_UUID.test(activeBindingId)))
    throw new Error('INTEGRITY_FAILURE');
  // A calibrated runtime route must carry an ACTIVE canonical binding.
  if (activeBindingId === null) throw new Error('INTEGRITY_FAILURE');
  if (row.canonical_binding_id !== activeBindingId) return unknown(row, 'INCOMPATIBLE_ACTIVE_BINDING');

  return {
    ...identity(row),
    knowledgeState: 'KNOWN',
    numericValue: row.numeric_value,
    unknownReason: null,
    canonicalBindingId: row.canonical_binding_id,
    // Observed/time-window values are preserved as source facts only: this
    // projection derives no freshness, decay, trend, improvement, worsening,
    // readiness, valence, diagnosis, recommendation, question, or behavior.
    observedAt: row.observed_at,
    temporalWindowStart: row.temporal_window_start,
    temporalWindowEnd: row.temporal_window_end,
    freshnessState: 'UNASSESSED',
    freshnessReference: null,
    confidenceState: 'UNASSESSED',
    confidenceReference: null,
  };
}

function validateDefinitionMetadata(
  row: HimContextualCurrentBatchSourceRow,
  kind: HimRuntimeCurrentIntelligenceContextKind,
): void {
  if (row.calculation_status !== 'CALIBRATED') throw new Error('INTEGRITY_FAILURE');
  if (!Array.isArray(row.valid_context_kinds) || !row.valid_context_kinds.includes(kind))
    throw new Error('INTEGRITY_FAILURE');
  if (!HIM_OWNERS.includes(row.hif_owner)) throw new Error('INTEGRITY_FAILURE');
  // Semantic mapping is preserved exactly, never coerced: an UNRESOLVED
  // mapping keeps semanticType null (unresolved HBS/HRS/HGS metrics are
  // never forced to STATE), and a RESOLVED mapping keeps its exact persisted
  // type (hgs.purpose-alignment stays RESOLVED / ALIGNMENT).
  if (row.semantic_mapping_status === 'RESOLVED') {
    if (row.semantic_type === null) throw new Error('INTEGRITY_FAILURE');
  } else if (row.semantic_mapping_status === 'UNRESOLVED') {
    if (row.semantic_type !== null) throw new Error('INTEGRITY_FAILURE');
  } else {
    throw new Error('INTEGRITY_FAILURE');
  }
}

function validateSourceRow(
  row: HimContextualCurrentBatchSourceRow,
  kind: HimRuntimeCurrentIntelligenceContextKind,
  contextId: string,
): void {
  if (row.source_metric_key !== row.metric_key || row.source_definition_version !== row.definition_version)
    throw new Error('INTEGRITY_FAILURE');
  if (row.source_context_kind !== kind || row.source_context_id !== contextId) throw new Error('INTEGRITY_FAILURE');
  if (row.source_semantic_mapping_status !== row.semantic_mapping_status || row.source_semantic_type !== row.semantic_type)
    throw new Error('INTEGRITY_FAILURE');
  if (row.validity_status !== 'VALID' && row.validity_status !== 'INVALIDATED') throw new Error('INTEGRITY_FAILURE');
  if (row.value_state !== 'ASSESSED' && row.value_state !== 'UNASSESSED') throw new Error('INTEGRITY_FAILURE');
  if (row.value_state === 'UNASSESSED' && row.numeric_value !== null) throw new Error('INTEGRITY_FAILURE');
  if (row.confidence_state !== 'UNASSESSED' || row.confidence_reference !== null) throw new Error('INTEGRITY_FAILURE');
}

function unknown(
  row: HimContextualCurrentBatchSourceRow,
  unknownReason: HimContextualCurrentUnknownReason,
): HimContextualCurrentMetric {
  // UNKNOWN stays UNKNOWN: no zero, midpoint, older value, sibling metric,
  // family average, or inferred substitute - and no fragment of an unusable
  // stored value (numeric, binding, timestamp, or window) leaks through.
  return {
    ...identity(row),
    knowledgeState: 'UNKNOWN',
    numericValue: null,
    unknownReason,
    canonicalBindingId: null,
    observedAt: null,
    temporalWindowStart: null,
    temporalWindowEnd: null,
    freshnessState: 'UNASSESSED',
    freshnessReference: null,
    confidenceState: 'UNASSESSED',
    confidenceReference: null,
  };
}

function identity(row: HimContextualCurrentBatchSourceRow): Pick<
  HimContextualCurrentMetric,
  'metricKey' | 'definitionVersion' | 'hifOwner' | 'semanticMappingStatus' | 'semanticType'
> {
  return {
    metricKey: row.metric_key,
    definitionVersion: 1,
    hifOwner: row.hif_owner,
    semanticMappingStatus: row.semantic_mapping_status,
    semanticType: row.semantic_type,
  };
}
