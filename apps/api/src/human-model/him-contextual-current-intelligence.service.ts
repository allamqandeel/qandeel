import { Injectable } from '@nestjs/common';
import { HimRepository } from './him.repository';
import {
  HIM_CONTEXT_KINDS,
  HIM_OWNERS,
  MAX_HIM_CONTEXT_ID_LENGTH,
  type HimContextKind,
} from './him.types';
import {
  HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS,
  type HimContextualCurrentBatchSourceRow,
  type HimContextualCurrentIntelligence,
  type HimContextualCurrentMetric,
  type HimContextualCurrentSelection,
  type HimContextualCurrentUnknownReason,
  type HimRuntimeCurrentIntelligenceContextKind,
} from './him-contextual-current-intelligence.types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// The existing v1 structured scale contract: every canonical v1 metric scale
// is a five-point structured scale, so a canonical current numeric value is an
// integer in [1, 5]. This is a structural integrity bound only - never a
// semantic interpretation, normalization, valence, or cross-metric arithmetic.
const HIM_V1_STRUCTURED_SCALE_MIN = 1;
const HIM_V1_STRUCTURED_SCALE_MAX = 5;

// QHIA-003/QHIA-004: read-only cross-family current-intelligence projection
// for one EXPLICITLY supplied exact owned context. Context relevance to a live
// conversation is decided by a separate, later, server-owned binding
// authority - never here, never from user text, never by an LLM, and never by
// a most-recent/only-target fallback. Ownership and existence remain enforced
// by the canonical database authorities this service reuses through ONE
// latency-bounded transport request (rpc/read_him_contextual_current
// _intelligence_batch_v1, migration 0054), which internally delegates every
// per-slot current-value read to rpc/read_him_latest_measurement_v1 (the
// single canonical latest authority, migration 0052) and every binding
// identity to public.him_active_structured_binding_id (the existing
// ACTIVE-binding resolver, migration 0050). A full contextual read or a
// validated subset read is exactly one Data API HTTP request, independent of
// the requested metric count - no per-slot definition, latest, or binding
// request exists on this path. No raw-history fallback exists on any path, no
// cache or staleness policy is introduced, and no Trend, provider, or
// orchestrator dependency is present.
@Injectable()
export class HimContextualCurrentIntelligenceService {
  constructor(private readonly repository: HimRepository) {}

  async getCurrentIntelligence(
    userId: string,
    token: string,
    contextKind: HimContextKind,
    contextId: string,
  ): Promise<HimContextualCurrentIntelligence> {
    if (!(contextKind in HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS)) throw new Error('UNSUPPORTED_CONTEXT');
    const kind = contextKind as HimRuntimeCurrentIntelligenceContextKind;
    this.validateContextIdentity(kind, contextId);

    const slots = HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS[kind];
    const metrics = await this.projectBatch(userId, token, kind, contextId, slots);
    const knownMetricCount = metrics.filter((metric) => metric.knowledgeState === 'KNOWN').length;
    const unknownMetricCount = metrics.length - knownMetricCount;
    return {
      contractVersion: 1,
      source: 'HIM_CANONICAL_LATEST_MEASUREMENT',
      contextKind: kind,
      contextId,
      coverageState: knownMetricCount === metrics.length ? 'FULL' : knownMetricCount === 0 ? 'EMPTY' : 'PARTIAL',
      eligibleMetricCount: metrics.length,
      knownMetricCount,
      unknownMetricCount,
      metrics,
    };
  }

  // QHIA-004: the latency-safe SELECTIVE subset read. The caller names which
  // frozen-slot metrics it needs; caller order is NEVER semantic authority -
  // after fail-closed validation the subset is reordered into the frozen
  // canonical slot order for the context, and one metric, two metrics, or the
  // full context all cost exactly one repository batch call and one Data API
  // request.
  async getCurrentSelection(
    userId: string,
    token: string,
    contextKind: HimContextKind,
    contextId: string,
    requestedMetricKeys: readonly string[],
  ): Promise<HimContextualCurrentSelection> {
    if (!(contextKind in HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS)) throw new Error('UNSUPPORTED_CONTEXT');
    const kind = contextKind as HimRuntimeCurrentIntelligenceContextKind;
    this.validateContextIdentity(kind, contextId);

    const slots = HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS[kind];
    if (!Array.isArray(requestedMetricKeys) || requestedMetricKeys.length === 0) throw new Error('INVALID_METRIC_SELECTION');
    const requested = new Set<string>();
    for (const metricKey of requestedMetricKeys) {
      // Duplicates and any metric outside the frozen QHIA-003 slot set for
      // this exact context fail closed: no HRS in a session, no HBS avoidance
      // in a relationship, no motivation in a conversation session, and no
      // other context leakage - the persisted definition authority is
      // re-verified per row by the batch transport underneath.
      if (typeof metricKey !== 'string' || requested.has(metricKey) || !slots.includes(metricKey)) {
        throw new Error('INVALID_METRIC_SELECTION');
      }
      requested.add(metricKey);
    }
    const orderedKeys = slots.filter((metricKey) => requested.has(metricKey));
    const metrics = await this.projectBatch(userId, token, kind, contextId, orderedKeys);
    const knownMetricCount = metrics.filter((metric) => metric.knowledgeState === 'KNOWN').length;
    const unknownMetricCount = metrics.length - knownMetricCount;
    return {
      contractVersion: 1,
      source: 'HIM_CANONICAL_LATEST_MEASUREMENT',
      contextKind: kind,
      contextId,
      coverageState: knownMetricCount === metrics.length ? 'FULL' : knownMetricCount === 0 ? 'EMPTY' : 'PARTIAL',
      requestedMetricCount: metrics.length,
      knownMetricCount,
      unknownMetricCount,
      metrics,
    };
  }

  // Exactly ONE repository batch call - and therefore exactly one Data API
  // HTTP request - per full or subset contextual read, independent of the
  // requested metric count. The returned rows must arrive in the exact
  // requested order and cardinality: malformed batches are never silently
  // sorted, deduplicated, or repaired into correctness.
  private async projectBatch(
    userId: string,
    token: string,
    kind: HimRuntimeCurrentIntelligenceContextKind,
    contextId: string,
    orderedKeys: readonly string[],
  ): Promise<HimContextualCurrentMetric[]> {
    const rows = await this.repository.readContextualCurrentIntelligenceBatch(
      token, userId, kind, contextId, orderedKeys, orderedKeys.map(() => 1),
    );
    if (!Array.isArray(rows) || rows.length !== orderedKeys.length) throw new Error('INTEGRITY_FAILURE');
    return rows.map((row, index) => this.projectSlot(row, orderedKeys[index], index + 1, kind, contextId));
  }

  private projectSlot(
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
    this.validateDefinitionMetadata(row, kind);

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
      return this.unknown(row, 'NO_CANONICAL_CURRENT_VALUE');
    }
    this.validateSourceRow(row, kind, contextId);

    if (row.validity_status === 'INVALIDATED') return this.unknown(row, 'LATEST_VALUE_INVALIDATED');
    if (row.value_state === 'UNASSESSED') return this.unknown(row, 'LATEST_VALUE_UNASSESSED');

    // ASSESSED: the canonical latest row may legitimately carry a historical
    // binding fallback after a binding transition (migration 0050), so an
    // assessed value is not KNOWN until it matches the current ACTIVE binding.
    if (row.canonical_binding_id === null || !UUID.test(row.canonical_binding_id)) throw new Error('INTEGRITY_FAILURE');
    if (
      row.numeric_value === null || !Number.isSafeInteger(row.numeric_value) ||
      row.numeric_value < HIM_V1_STRUCTURED_SCALE_MIN || row.numeric_value > HIM_V1_STRUCTURED_SCALE_MAX
    ) throw new Error('INTEGRITY_FAILURE');

    // The batch row's ACTIVE binding identity comes from the existing
    // migration-0050 resolver inside the transport RPC. It is consulted ONLY
    // on this ASSESSED route - its mere presence on the batch row never
    // strengthens or weakens the no-row/UNASSESSED/INVALIDATED paths above.
    const activeBindingId = row.active_binding_id;
    if (activeBindingId !== null && (typeof activeBindingId !== 'string' || !UUID.test(activeBindingId)))
      throw new Error('INTEGRITY_FAILURE');
    // A calibrated runtime route must carry an ACTIVE canonical binding.
    if (activeBindingId === null) throw new Error('INTEGRITY_FAILURE');
    if (row.canonical_binding_id !== activeBindingId) return this.unknown(row, 'INCOMPATIBLE_ACTIVE_BINDING');

    return {
      ...this.identity(row),
      knowledgeState: 'KNOWN',
      numericValue: row.numeric_value,
      unknownReason: null,
      canonicalBindingId: row.canonical_binding_id,
      // Observed/time-window values are preserved as source facts only: this
      // service derives no freshness, decay, trend, improvement, worsening,
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

  private validateDefinitionMetadata(
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

  private validateSourceRow(
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

  private unknown(
    row: HimContextualCurrentBatchSourceRow,
    unknownReason: HimContextualCurrentUnknownReason,
  ): HimContextualCurrentMetric {
    // UNKNOWN stays UNKNOWN: no zero, midpoint, older value, sibling metric,
    // family average, or inferred substitute - and no fragment of an unusable
    // stored value (numeric, binding, timestamp, or window) leaks through.
    return {
      ...this.identity(row),
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

  private identity(row: HimContextualCurrentBatchSourceRow): Pick<
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

  private validateContextIdentity(kind: HimRuntimeCurrentIntelligenceContextKind, contextId: string): void {
    if (!HIM_CONTEXT_KINDS.includes(kind)) throw new Error('UNSUPPORTED_CONTEXT');
    if (
      typeof contextId !== 'string' || contextId.length === 0 || contextId.trim() !== contextId ||
      contextId.length > MAX_HIM_CONTEXT_ID_LENGTH || contextId === 'GLOBAL' ||
      (kind !== 'SITUATION' && !UUID.test(contextId))
    ) throw new Error('INVALID_OR_UNOWNED_CONTEXT');
  }
}
