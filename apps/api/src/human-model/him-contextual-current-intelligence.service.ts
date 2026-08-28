import { Injectable } from '@nestjs/common';
import { HimRepository } from './him.repository';
import {
  HIM_CONTEXT_KINDS,
  HIM_OWNERS,
  MAX_HIM_CONTEXT_ID_LENGTH,
  type HimContextKind,
  type HimMetricDefinition,
} from './him.types';
import {
  HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS,
  type HimCanonicalLatestSourceRow,
  type HimContextualCurrentIntelligence,
  type HimContextualCurrentMetric,
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

// QHIA-003: read-only cross-family current-intelligence projection for one
// EXPLICITLY supplied exact owned context. Context relevance to a live
// conversation is decided by a separate, later, server-owned binding
// authority - never here, never from user text, never by an LLM, and never by
// a most-recent/only-target fallback. Ownership and existence remain enforced
// by the canonical database authorities this service reuses:
// rpc/read_him_latest_measurement_v1 (the single canonical latest authority,
// migration 0052) and public.him_active_structured_binding_id (the existing
// ACTIVE-binding resolver, migration 0050). No raw-history fallback exists on
// any path, and no Trend, provider, or orchestrator dependency is present.
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
    // Promise.all preserves the frozen slot order positionally, so repository
    // completion order can never reorder the projection.
    const metrics = await Promise.all(
      slots.map((metricKey) => this.projectSlot(userId, token, metricKey, kind, contextId)),
    );

    const knownMetricCount = metrics.filter((metric) => metric.knowledgeState === 'KNOWN').length;
    const unknownMetricCount = metrics.length - knownMetricCount;
    if (metrics.length !== slots.length) throw new Error('INTEGRITY_FAILURE');
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

  private async projectSlot(
    userId: string,
    token: string,
    metricKey: string,
    kind: HimRuntimeCurrentIntelligenceContextKind,
    contextId: string,
  ): Promise<HimContextualCurrentMetric> {
    // The persisted exact definition remains the context-eligibility
    // authority; the static runtime slot never overrides it.
    const definition = await this.repository.getDefinition(token, metricKey, 1);
    if (!definition) throw new Error('INTEGRITY_FAILURE');
    this.validateDefinition(definition, metricKey, kind);

    const row = await this.repository.getLatestCurrentIntelligenceSource(token, userId, metricKey, 1, kind, contextId);
    if (row === undefined) {
      // The generic canonical latest surface cannot safely distinguish "no
      // event ever" from "newest event has no usable current calculated
      // snapshot", and it never falls back to an older event. Do not guess.
      return this.unknown(definition, 'NO_CANONICAL_CURRENT_VALUE');
    }
    this.validateSourceRow(row, definition, kind, contextId);

    if (row.validity_status === 'INVALIDATED') return this.unknown(definition, 'LATEST_VALUE_INVALIDATED');
    if (row.value_state === 'UNASSESSED') return this.unknown(definition, 'LATEST_VALUE_UNASSESSED');

    // ASSESSED: the canonical latest row may legitimately carry a historical
    // binding fallback after a binding transition (migration 0050), so an
    // assessed value is not KNOWN until it matches the current ACTIVE binding.
    if (!('canonical_binding_id' in row)) throw new Error('INTEGRITY_FAILURE');
    if (row.canonical_binding_id === null || !UUID.test(row.canonical_binding_id)) throw new Error('INTEGRITY_FAILURE');
    if (
      row.numeric_value === null || !Number.isSafeInteger(row.numeric_value) ||
      row.numeric_value < HIM_V1_STRUCTURED_SCALE_MIN || row.numeric_value > HIM_V1_STRUCTURED_SCALE_MAX
    ) throw new Error('INTEGRITY_FAILURE');

    const activeBindingId = await this.repository.getActiveStructuredBindingId(token, metricKey, 1, kind);
    if (activeBindingId !== null && (typeof activeBindingId !== 'string' || !UUID.test(activeBindingId)))
      throw new Error('INTEGRITY_FAILURE');
    // A calibrated runtime route must carry an ACTIVE canonical binding.
    if (activeBindingId === null) throw new Error('INTEGRITY_FAILURE');
    if (row.canonical_binding_id !== activeBindingId) return this.unknown(definition, 'INCOMPATIBLE_ACTIVE_BINDING');

    return {
      ...this.identity(definition),
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

  private validateDefinition(
    definition: HimMetricDefinition,
    metricKey: string,
    kind: HimRuntimeCurrentIntelligenceContextKind,
  ): void {
    if (definition.metricKey !== metricKey || definition.definitionVersion !== 1) throw new Error('INTEGRITY_FAILURE');
    if (definition.calculationStatus !== 'CALIBRATED') throw new Error('INTEGRITY_FAILURE');
    if (!Array.isArray(definition.validContextKinds) || !definition.validContextKinds.includes(kind))
      throw new Error('INTEGRITY_FAILURE');
    if (!HIM_OWNERS.includes(definition.hifOwner)) throw new Error('INTEGRITY_FAILURE');
    // Semantic mapping is preserved exactly, never coerced: an UNRESOLVED
    // mapping keeps semanticType null (unresolved HBS/HRS/HGS metrics are
    // never forced to STATE), and a RESOLVED mapping keeps its exact persisted
    // type (hgs.purpose-alignment stays RESOLVED / ALIGNMENT).
    if (definition.semanticMappingStatus === 'RESOLVED') {
      if (definition.semanticType === null) throw new Error('INTEGRITY_FAILURE');
    } else if (definition.semanticMappingStatus === 'UNRESOLVED') {
      if (definition.semanticType !== null) throw new Error('INTEGRITY_FAILURE');
    } else {
      throw new Error('INTEGRITY_FAILURE');
    }
  }

  private validateSourceRow(
    row: HimCanonicalLatestSourceRow,
    definition: HimMetricDefinition,
    kind: HimRuntimeCurrentIntelligenceContextKind,
    contextId: string,
  ): void {
    if (row.metric_key !== definition.metricKey || row.definition_version !== definition.definitionVersion)
      throw new Error('INTEGRITY_FAILURE');
    if (row.context_kind !== kind || row.context_id !== contextId) throw new Error('INTEGRITY_FAILURE');
    if (row.semantic_mapping_status !== definition.semanticMappingStatus || row.semantic_type !== definition.semanticType)
      throw new Error('INTEGRITY_FAILURE');
    if (row.validity_status !== 'VALID' && row.validity_status !== 'INVALIDATED') throw new Error('INTEGRITY_FAILURE');
    if (row.value_state !== 'ASSESSED' && row.value_state !== 'UNASSESSED') throw new Error('INTEGRITY_FAILURE');
    if (row.value_state === 'UNASSESSED' && row.numeric_value !== null) throw new Error('INTEGRITY_FAILURE');
    if (row.confidence_state !== 'UNASSESSED' || row.confidence_reference !== null) throw new Error('INTEGRITY_FAILURE');
  }

  private unknown(
    definition: HimMetricDefinition,
    unknownReason: HimContextualCurrentUnknownReason,
  ): HimContextualCurrentMetric {
    // UNKNOWN stays UNKNOWN: no zero, midpoint, older value, sibling metric,
    // family average, or inferred substitute - and no fragment of an unusable
    // stored value (numeric, binding, timestamp, or window) leaks through.
    return {
      ...this.identity(definition),
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

  private identity(definition: HimMetricDefinition): Pick<
    HimContextualCurrentMetric,
    'metricKey' | 'definitionVersion' | 'hifOwner' | 'semanticMappingStatus' | 'semanticType'
  > {
    return {
      metricKey: definition.metricKey,
      definitionVersion: 1,
      hifOwner: definition.hifOwner,
      semanticMappingStatus: definition.semanticMappingStatus,
      semanticType: definition.semanticType,
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
