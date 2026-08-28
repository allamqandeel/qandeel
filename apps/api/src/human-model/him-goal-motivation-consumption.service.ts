import { Injectable } from '@nestjs/common';
import { HimGoalMotivationRepository } from './him-goal-motivation.repository';
import { HIM_UUID, projectHimContextualCurrentSlot } from './him-contextual-current-projection';
import type { HimContextualCurrentMetric } from './him-contextual-current-intelligence.types';
import {
  HIM_GOAL_MOTIVATION_BINDING_STATES,
  HIM_GOAL_MOTIVATION_CONTEXT_KIND,
  HIM_GOAL_MOTIVATION_DEFINITION_VERSION,
  HIM_GOAL_MOTIVATION_HIF_OWNER,
  HIM_GOAL_MOTIVATION_METRIC_KEY,
  HIM_GOAL_MOTIVATION_SEMANTIC_MAPPING_STATUS,
  HIM_GOAL_MOTIVATION_SEMANTIC_TYPE,
  type HimGoalMotivationBindingState,
  type HimGoalMotivationDirective,
  type HimGoalMotivationGuidance,
  type HimGoalMotivationSourceRow,
} from './him-goal-motivation-consumption.types';

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

// QHIA-010: the narrow Goal-motivation consumption boundary.
//
// One repository call - and therefore exactly ONE external Data API request -
// resolves the authoritative relevance binding and the authoritative current
// intelligence together, server-side. This service performs no relevance
// inference, never auto-binds a Goal, never selects a "latest", "first",
// "only", "most recently measured", "highest", or "lowest" Goal when nothing is
// bound, reads no target text, calls no LLM, adds no Trend or history, writes
// nothing, and caches nothing across turns. It requests exactly one metric in
// exactly one context: Situation-bound Motivation stays dormant.
//
// Every failure mode - malformed RPC shape, missing binding, unknown current
// intelligence, invalid metric identity/version, semantic drift away from the
// canonical HSE / RESOLVED / STATE reading, unexpected scale value, incompatible
// ACTIVE measurement binding, or repository error - resolves to NO Goal-motivation
// guidance. A repository/transport failure propagates as a rejection so the
// caller's own degradation path (and its telemetry) sees it; every
// authoritative-but-unusable answer resolves to bounded NONE guidance.
@Injectable()
export class HimGoalMotivationConsumptionService {
  constructor(private readonly repository: HimGoalMotivationRepository) {}

  async read(userId: string, token: string, sessionId: string): Promise<HimGoalMotivationGuidance> {
    if (typeof userId !== 'string' || !HIM_UUID.test(userId)) throw new Error('INVALID_GOAL_MOTIVATION_REQUEST');
    if (typeof sessionId !== 'string' || !HIM_UUID.test(sessionId)) throw new Error('INVALID_GOAL_MOTIVATION_REQUEST');

    const rows = await this.repository.readSessionGoalMotivation(token, userId, sessionId);
    return this.consumeSourceRows(rows);
  }

  // The PURE Goal-motivation consumption boundary: raw migration-0059 rows in,
  // bounded guidance out, no transport of any kind.
  //
  // It is the single semantic owner of Goal Motivation meaning. read(...) above
  // and the QHIA-009/QHIA-010 aggregate - which receives the SAME nested row
  // shape over one shared request instead of a dedicated one - are its only
  // callers, and both reach exactly this authority rather than a second,
  // divergent copy.
  consumeSourceRows(rows: HimGoalMotivationSourceRow[]): HimGoalMotivationGuidance {
    // The composition always answers with exactly one row - unbound or bound.
    // Zero rows, several rows, or a non-array payload is an integrity breach,
    // never a silently repaired absence.
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('INTEGRITY_FAILURE');
    const row = rows[0];
    if (row === null || typeof row !== 'object') throw new Error('INTEGRITY_FAILURE');
    if (!HIM_GOAL_MOTIVATION_BINDING_STATES.includes(row.binding_state as HimGoalMotivationBindingState))
      throw new Error('INTEGRITY_FAILURE');

    if (row.binding_state === 'NO_ACTIVE_GOAL') {
      // No ACTIVE Goal relevance binding exists for this exact owned session:
      // the deterministic no-effect answer. Absent relevance stays absent.
      for (const column of UNBOUND_NULL_COLUMNS) {
        if ((row as unknown as Record<string, unknown>)[column] !== null) throw new Error('INTEGRITY_FAILURE');
      }
      return this.guidance('NONE', 'DEFAULT');
    }

    return this.map(this.projectBoundSlot(row));
  }

  // The bound route reuses the SHARED frozen QHIA-004 per-row projection rather
  // than a second, semantically divergent copy of current-intelligence
  // validation. The expected identity is the Goal the server-side QHIA-006
  // authority resolved, so the projection proves the delegated canonical read
  // answered for exactly that authoritatively relevant target.
  private projectBoundSlot(row: HimGoalMotivationSourceRow): HimContextualCurrentMetric {
    const boundGoalId = row.binding_context_id;
    if (typeof boundGoalId !== 'string' || !HIM_UUID.test(boundGoalId)) throw new Error('INTEGRITY_FAILURE');
    if (row.metric_key !== HIM_GOAL_MOTIVATION_METRIC_KEY) throw new Error('INTEGRITY_FAILURE');
    if (row.definition_version !== HIM_GOAL_MOTIVATION_DEFINITION_VERSION) throw new Error('INTEGRITY_FAILURE');
    if (row.hif_owner !== HIM_GOAL_MOTIVATION_HIF_OWNER) throw new Error('INTEGRITY_FAILURE');
    const metric = projectHimContextualCurrentSlot(
      row,
      HIM_GOAL_MOTIVATION_METRIC_KEY,
      1,
      HIM_GOAL_MOTIVATION_CONTEXT_KIND,
      boundGoalId,
    );
    if (metric.metricKey !== HIM_GOAL_MOTIVATION_METRIC_KEY || metric.definitionVersion !== 1)
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
    // semantic metadata, a valid ACTIVE canonical binding, a KNOWN 1 or 2 - but
    // carries any semantic reading other than RESOLVED / STATE is a different
    // quantity under the hse.motivation@1 name. Canonical Motivation is
    // explicitly a STATE and explicitly NOT readiness or ability, so a coherent
    // RESOLVED / READINESS or RESOLVED / CAPABILITY row carrying a low ordinal
    // is exactly the drift that must never silently become action-pacing
    // guidance. It fails closed rather than being mapped.
    if (
      metric.semanticMappingStatus !== HIM_GOAL_MOTIVATION_SEMANTIC_MAPPING_STATUS ||
      metric.semanticType !== HIM_GOAL_MOTIVATION_SEMANTIC_TYPE
    ) throw new Error('INTEGRITY_FAILURE');
    return metric;
  }

  // The frozen bounded mapping. The canonical structured ordinal is 1-5.
  // 1 (VERY_LOW) and 2 (LOW) request the SAME single bounded reduction - keep
  // the immediate action small and bounded, reduce steering pressure, one step
  // at a time - so 1 never amplifies 2. 3, 4, and 5 add nothing, and any valid
  // UNKNOWN adds nothing: there is no arithmetic, no severity stacking, no
  // trend, no baseline, no decay, no confidence inference, no upshift, and no
  // favorable-value effect of any kind.
  private map(metric: HimContextualCurrentMetric): HimGoalMotivationGuidance {
    if (metric.knowledgeState === 'UNKNOWN') return this.guidance('NONE', 'DEFAULT');
    if (metric.numericValue === 1 || metric.numericValue === 2) {
      return this.guidance('ACTIVE', 'REDUCE_GOAL_ACTION_BURDEN');
    }
    return this.guidance('NONE', 'DEFAULT');
  }

  private guidance(
    guidanceState: 'NONE' | 'ACTIVE',
    directive: HimGoalMotivationDirective,
  ): HimGoalMotivationGuidance {
    return { contractVersion: 1, guidanceState, directive };
  }
}
