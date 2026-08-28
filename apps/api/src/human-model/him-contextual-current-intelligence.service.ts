import { Injectable } from '@nestjs/common';
import { HimRepository } from './him.repository';
import {
  HIM_CONTEXT_KINDS,
  MAX_HIM_CONTEXT_ID_LENGTH,
  type HimContextKind,
} from './him.types';
import { HIM_UUID, projectHimContextualCurrentSlot } from './him-contextual-current-projection';
import {
  HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS,
  type HimContextualCurrentIntelligence,
  type HimContextualCurrentMetric,
  type HimContextualCurrentSelection,
  type HimRuntimeCurrentIntelligenceContextKind,
} from './him-contextual-current-intelligence.types';

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
//
// The per-row typed validation lives in the shared
// him-contextual-current-projection module: it is the SAME frozen QHIA-004
// projection this service has always applied, extracted so a second consumer
// of the identical batch row shape reuses it instead of duplicating it.
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
    return rows.map((row, index) => projectHimContextualCurrentSlot(row, orderedKeys[index], index + 1, kind, contextId));
  }

  private validateContextIdentity(kind: HimRuntimeCurrentIntelligenceContextKind, contextId: string): void {
    if (!HIM_CONTEXT_KINDS.includes(kind)) throw new Error('UNSUPPORTED_CONTEXT');
    if (
      typeof contextId !== 'string' || contextId.length === 0 || contextId.trim() !== contextId ||
      contextId.length > MAX_HIM_CONTEXT_ID_LENGTH || contextId === 'GLOBAL' ||
      (kind !== 'SITUATION' && !HIM_UUID.test(contextId))
    ) throw new Error('INVALID_OR_UNOWNED_CONTEXT');
  }
}
