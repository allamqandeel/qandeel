import { Injectable } from '@nestjs/common';
import { HimSituationStressRepository } from './him-situation-stress.repository';
import { HIM_UUID, projectHimContextualCurrentSlot } from './him-contextual-current-projection';
import type { HimContextualCurrentMetric } from './him-contextual-current-intelligence.types';
import {
  HIM_SITUATION_STRESS_BINDING_STATES,
  HIM_SITUATION_STRESS_CONTEXT_KIND,
  HIM_SITUATION_STRESS_DEFINITION_VERSION,
  HIM_SITUATION_STRESS_HIF_OWNER,
  HIM_SITUATION_STRESS_METRIC_KEY,
  HIM_SITUATION_STRESS_SEMANTIC_MAPPING_STATUS,
  HIM_SITUATION_STRESS_SEMANTIC_TYPE,
  type HimSituationStressBindingState,
  type HimSituationStressDirective,
  type HimSituationStressGuidance,
  type HimSituationStressSourceRow,
} from './him-situation-stress-consumption.types';

// The exact source columns an UNBOUND answer must leave empty. A no-effect
// result that still carries any metric fragment is a malformed contract, never
// a partially usable value.
const UNBOUND_NULL_COLUMNS = Object.freeze([
  'binding_context_id', 'slot_order', 'metric_key', 'definition_version', 'hif_owner',
  'semantic_mapping_status', 'semantic_type', 'calculation_status', 'valid_context_kinds',
  'context_kind', 'context_id', 'has_canonical_current_value',
  'source_metric_key', 'source_definition_version', 'source_semantic_mapping_status',
  'source_semantic_type', 'source_context_kind', 'source_context_id',
  'value_state', 'numeric_value', 'validity_status', 'confidence_state', 'confidence_reference',
  'observed_at', 'temporal_window_start', 'temporal_window_end',
  'canonical_binding_id', 'active_binding_id',
] as const);

// QHIA-007: the narrow Situation-stress consumption boundary.
//
// One repository call - and therefore exactly ONE external Data API request -
// resolves the authoritative relevance binding and the authoritative current
// intelligence together, server-side. This service performs no relevance
// inference, never auto-binds a Situation, never selects a "latest", "first",
// or "only" Situation when nothing is bound, reads no target text, calls no
// LLM, adds no Trend or history, writes nothing, and caches nothing across
// turns.
//
// Every failure mode - malformed RPC shape, missing binding, unknown current
// intelligence, invalid metric identity/version, unexpected scale value,
// incompatible ACTIVE measurement binding, or repository error - resolves to
// NO Situation-stress guidance. A repository/transport failure propagates as a
// rejection so the caller's own degradation path (and its telemetry) sees it;
// every authoritative-but-unusable answer resolves to bounded NONE guidance.
@Injectable()
export class HimSituationStressConsumptionService {
  constructor(private readonly repository: HimSituationStressRepository) {}

  async read(userId: string, token: string, sessionId: string): Promise<HimSituationStressGuidance> {
    if (typeof userId !== 'string' || !HIM_UUID.test(userId)) throw new Error('INVALID_SITUATION_STRESS_REQUEST');
    if (typeof sessionId !== 'string' || !HIM_UUID.test(sessionId)) throw new Error('INVALID_SITUATION_STRESS_REQUEST');

    const rows = await this.repository.readSessionSituationStress(token, userId, sessionId);
    return this.consumeSourceRows(rows);
  }

  // The PURE Situation-stress consumption boundary: raw migration-0056 rows in,
  // bounded guidance out, no transport of any kind.
  //
  // This is an EXTRACTION, not a new rule. Every validation and every mapping
  // below is the frozen QHIA-007 logic moved here verbatim so that the
  // QHIA-009 aggregate, which receives the SAME nested row shape over one
  // shared request instead of a dedicated one, reuses this exact semantic
  // authority instead of growing a second, divergent copy. read(...) above is
  // its only other caller and its behaviour is unchanged.
  consumeSourceRows(rows: HimSituationStressSourceRow[]): HimSituationStressGuidance {
    // The composition always answers with exactly one row - unbound or bound.
    // Zero rows, several rows, or a non-array payload is an integrity breach,
    // never a silently repaired absence.
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('INTEGRITY_FAILURE');
    const row = rows[0];
    if (row === null || typeof row !== 'object') throw new Error('INTEGRITY_FAILURE');
    if (!HIM_SITUATION_STRESS_BINDING_STATES.includes(row.binding_state as HimSituationStressBindingState))
      throw new Error('INTEGRITY_FAILURE');

    if (row.binding_state === 'NO_ACTIVE_SITUATION') {
      // No ACTIVE Situation relevance binding exists for this exact owned
      // session: the deterministic no-effect answer. Absent relevance stays
      // absent.
      for (const column of UNBOUND_NULL_COLUMNS) {
        if ((row as unknown as Record<string, unknown>)[column] !== null) throw new Error('INTEGRITY_FAILURE');
      }
      return this.guidance('NONE', 'DEFAULT');
    }

    return this.map(this.projectBoundSlot(row));
  }

  // The bound route reuses the SHARED frozen QHIA-004 per-row projection
  // rather than a second, semantically divergent copy of current-intelligence
  // validation. The expected identity is the Situation the server-side
  // QHIA-006 authority resolved, so the projection proves the delegated
  // canonical read answered for exactly that authoritatively relevant target.
  private projectBoundSlot(row: HimSituationStressSourceRow): HimContextualCurrentMetric {
    const boundSituationId = row.binding_context_id;
    if (typeof boundSituationId !== 'string' || !HIM_UUID.test(boundSituationId)) throw new Error('INTEGRITY_FAILURE');
    if (row.metric_key !== HIM_SITUATION_STRESS_METRIC_KEY) throw new Error('INTEGRITY_FAILURE');
    if (row.definition_version !== HIM_SITUATION_STRESS_DEFINITION_VERSION) throw new Error('INTEGRITY_FAILURE');
    if (row.hif_owner !== HIM_SITUATION_STRESS_HIF_OWNER) throw new Error('INTEGRITY_FAILURE');
    const metric = projectHimContextualCurrentSlot(
      row,
      HIM_SITUATION_STRESS_METRIC_KEY,
      1,
      HIM_SITUATION_STRESS_CONTEXT_KIND,
      boundSituationId,
    );
    if (metric.metricKey !== HIM_SITUATION_STRESS_METRIC_KEY || metric.definitionVersion !== 1)
      throw new Error('INTEGRITY_FAILURE');
    // The exact frozen SEMANTIC identity, enforced here and only here. The
    // shared QHIA-004 projection is generic on purpose: for a RESOLVED
    // definition it only requires semanticType to be non-null, because
    // hgs.purpose-alignment is legitimately RESOLVED / ALIGNMENT and several
    // HBS/HRS metrics are legitimately UNRESOLVED with a null type. That is
    // correct for a projection which reports a value; it is NOT sufficient for
    // a consumer which assigns behavioural meaning to that value's ordinal.
    //
    // A row that is internally coherent - matching definition and source
    // semantic metadata, a valid ACTIVE canonical binding, a KNOWN 4 or 5 -
    // but carries any semantic reading other than RESOLVED / STATE is a
    // different quantity under the hse.stress@1 name. It fails closed rather
    // than being mapped, so drift can never silently become interaction
    // guidance.
    if (
      metric.semanticMappingStatus !== HIM_SITUATION_STRESS_SEMANTIC_MAPPING_STATUS ||
      metric.semanticType !== HIM_SITUATION_STRESS_SEMANTIC_TYPE
    ) throw new Error('INTEGRITY_FAILURE');
    return metric;
  }

  // The frozen bounded mapping. The canonical structured ordinal is 1-5.
  // 4 (HIGH) and 5 (VERY_HIGH) request the SAME single bounded reduction -
  // reduce cognitive load, reduce steering pressure, calmer pacing - so 5
  // never amplifies 4. 1, 2, and 3 add nothing, and any valid UNKNOWN adds
  // nothing: there is no upshift and no favorable-value effect of any kind.
  private map(metric: HimContextualCurrentMetric): HimSituationStressGuidance {
    if (metric.knowledgeState === 'UNKNOWN') return this.guidance('NONE', 'DEFAULT');
    if (metric.numericValue === 4 || metric.numericValue === 5) {
      return this.guidance('ACTIVE', 'REDUCE_INTERACTION_BURDEN');
    }
    return this.guidance('NONE', 'DEFAULT');
  }

  private guidance(
    guidanceState: 'NONE' | 'ACTIVE',
    directive: HimSituationStressDirective,
  ): HimSituationStressGuidance {
    return { contractVersion: 1, guidanceState, directive };
  }
}
