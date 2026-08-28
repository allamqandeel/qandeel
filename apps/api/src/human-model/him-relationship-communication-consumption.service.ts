import { Injectable } from '@nestjs/common';
import { HimRelationshipCommunicationRepository } from './him-relationship-communication.repository';
import { HIM_UUID, projectHimContextualCurrentSlot } from './him-contextual-current-projection';
import type { HimContextualCurrentMetric } from './him-contextual-current-intelligence.types';
import {
  HIM_RELATIONSHIP_COMMUNICATION_BINDING_STATES,
  HIM_RELATIONSHIP_COMMUNICATION_CONTEXT_KIND,
  HIM_RELATIONSHIP_COMMUNICATION_DEFINITION_VERSION,
  HIM_RELATIONSHIP_COMMUNICATION_HIF_OWNER,
  HIM_RELATIONSHIP_COMMUNICATION_METRIC_KEY,
  HIM_RELATIONSHIP_COMMUNICATION_SEMANTIC_MAPPING_STATUS,
  HIM_RELATIONSHIP_COMMUNICATION_SEMANTIC_TYPE,
  type HimRelationshipCommunicationBindingState,
  type HimRelationshipCommunicationDirective,
  type HimRelationshipCommunicationGuidance,
  type HimRelationshipCommunicationSourceRow,
} from './him-relationship-communication-consumption.types';

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

// QHIA-011: the narrow Relationship-communication consumption boundary.
//
// One repository call - and therefore exactly ONE external Data API request -
// resolves the authoritative relevance binding and the authoritative current
// intelligence together, server-side. This service performs no relevance
// inference, never auto-binds a relationship, never selects a "latest",
// "first", "only", "most recently measured", "highest", or "lowest"
// relationship when nothing is bound, never matches a relationship by display
// label or by a person's name, reads no target text, calls no LLM, builds no
// social graph, adds no Trend or history, writes nothing, and caches nothing
// across turns. It requests exactly one metric in exactly one context: the
// sibling HRS metrics stay dormant.
//
// Every failure mode - malformed RPC shape, missing binding, unknown current
// intelligence, invalid metric identity/version, semantic drift away from the
// canonical HRS / UNRESOLVED / null reading, unexpected scale value,
// incompatible ACTIVE measurement binding, or repository error - resolves to NO
// Relationship-communication guidance. A repository/transport failure
// propagates as a rejection so the caller's own degradation path (and its
// telemetry) sees it; every authoritative-but-unusable answer resolves to
// bounded NONE guidance.
@Injectable()
export class HimRelationshipCommunicationConsumptionService {
  constructor(private readonly repository: HimRelationshipCommunicationRepository) {}

  async read(userId: string, token: string, sessionId: string): Promise<HimRelationshipCommunicationGuidance> {
    if (typeof userId !== 'string' || !HIM_UUID.test(userId)) throw new Error('INVALID_RELATIONSHIP_COMMUNICATION_REQUEST');
    if (typeof sessionId !== 'string' || !HIM_UUID.test(sessionId)) throw new Error('INVALID_RELATIONSHIP_COMMUNICATION_REQUEST');

    const rows = await this.repository.readSessionRelationshipCommunication(token, userId, sessionId);
    return this.consumeSourceRows(rows);
  }

  // The PURE Relationship-communication consumption boundary: raw
  // migration-0060 rows in, bounded guidance out, no transport of any kind.
  //
  // It is the single semantic owner of Relationship Communication meaning.
  // read(...) above and the cross-context aggregate - which receives the SAME
  // nested row shape over one shared request instead of a dedicated one - are
  // its only callers, and both reach exactly this authority rather than a
  // second, divergent copy.
  consumeSourceRows(rows: HimRelationshipCommunicationSourceRow[]): HimRelationshipCommunicationGuidance {
    // The composition always answers with exactly one row - unbound or bound.
    // Zero rows, several rows, or a non-array payload is an integrity breach,
    // never a silently repaired absence.
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error('INTEGRITY_FAILURE');
    const row = rows[0];
    if (row === null || typeof row !== 'object') throw new Error('INTEGRITY_FAILURE');
    if (!HIM_RELATIONSHIP_COMMUNICATION_BINDING_STATES.includes(row.binding_state as HimRelationshipCommunicationBindingState))
      throw new Error('INTEGRITY_FAILURE');

    if (row.binding_state === 'NO_ACTIVE_RELATIONSHIP') {
      // No ACTIVE relationship relevance binding exists for this exact owned
      // session: the deterministic no-effect answer. Absent relevance stays
      // absent.
      for (const column of UNBOUND_NULL_COLUMNS) {
        if ((row as unknown as Record<string, unknown>)[column] !== null) throw new Error('INTEGRITY_FAILURE');
      }
      return this.guidance('NONE', 'DEFAULT');
    }

    return this.map(this.projectBoundSlot(row));
  }

  // The bound route reuses the SHARED frozen QHIA-004 per-row projection rather
  // than a second, semantically divergent copy of current-intelligence
  // validation. The expected identity is the relationship the server-side
  // QHIA-006 authority resolved, so the projection proves the delegated
  // canonical read answered for exactly that authoritatively relevant target.
  private projectBoundSlot(row: HimRelationshipCommunicationSourceRow): HimContextualCurrentMetric {
    const boundRelationshipId = row.binding_context_id;
    if (typeof boundRelationshipId !== 'string' || !HIM_UUID.test(boundRelationshipId)) throw new Error('INTEGRITY_FAILURE');
    if (row.metric_key !== HIM_RELATIONSHIP_COMMUNICATION_METRIC_KEY) throw new Error('INTEGRITY_FAILURE');
    if (row.definition_version !== HIM_RELATIONSHIP_COMMUNICATION_DEFINITION_VERSION) throw new Error('INTEGRITY_FAILURE');
    if (row.hif_owner !== HIM_RELATIONSHIP_COMMUNICATION_HIF_OWNER) throw new Error('INTEGRITY_FAILURE');
    const metric = projectHimContextualCurrentSlot(
      row,
      HIM_RELATIONSHIP_COMMUNICATION_METRIC_KEY,
      1,
      HIM_RELATIONSHIP_COMMUNICATION_CONTEXT_KIND,
      boundRelationshipId,
    );
    if (metric.metricKey !== HIM_RELATIONSHIP_COMMUNICATION_METRIC_KEY || metric.definitionVersion !== 1)
      throw new Error('INTEGRITY_FAILURE');
    // The exact frozen SEMANTIC identity, enforced here and only here. The
    // shared QHIA-004 projection is generic on purpose: it accepts an
    // UNRESOLVED definition with a null type AND a RESOLVED definition with any
    // non-null type, because both are legitimate somewhere in the canonical
    // 17. That is correct for a projection which reports a value; it is NOT
    // sufficient for a consumer which assigns behavioural meaning to that
    // value's ordinal.
    //
    // For this metric the expected canonical identity is UNRESOLVED with a NULL
    // semantic type, and that is ACCEPTED here rather than treated as a defect.
    // What fails closed is drift AWAY from it: a row that is internally
    // coherent - matching definition and source semantic metadata, a valid
    // ACTIVE canonical binding, a KNOWN 1 or 2 - but that has acquired a
    // RESOLVED mapping or any semantic type at all is a different quantity
    // under the hrs.communication@1 name, and exactly the drift that must never
    // silently become communication-scaffolding guidance.
    if (
      metric.semanticMappingStatus !== HIM_RELATIONSHIP_COMMUNICATION_SEMANTIC_MAPPING_STATUS ||
      metric.semanticType !== HIM_RELATIONSHIP_COMMUNICATION_SEMANTIC_TYPE
    ) throw new Error('INTEGRITY_FAILURE');
    return metric;
  }

  // The frozen bounded mapping. The canonical structured ordinal is 1-5.
  // 1 (VERY_LOW) and 2 (LOW) request the SAME single bounded scaffolding -
  // explicit rather than implied wording, one main point at a time, clarity
  // rather than forced agreement - so 1 never amplifies 2. 3, 4, and 5 add
  // nothing, and any valid UNKNOWN adds nothing: there is no arithmetic, no
  // severity stacking, no trend, no baseline, no decay, no confidence
  // inference, no sibling-HRS inference, no upshift, and no favorable-value
  // effect of any kind.
  private map(metric: HimContextualCurrentMetric): HimRelationshipCommunicationGuidance {
    if (metric.knowledgeState === 'UNKNOWN') return this.guidance('NONE', 'DEFAULT');
    if (metric.numericValue === 1 || metric.numericValue === 2) {
      return this.guidance('ACTIVE', 'STRUCTURE_RELATIONSHIP_COMMUNICATION');
    }
    return this.guidance('NONE', 'DEFAULT');
  }

  private guidance(
    guidanceState: 'NONE' | 'ACTIVE',
    directive: HimRelationshipCommunicationDirective,
  ): HimRelationshipCommunicationGuidance {
    return { contractVersion: 1, guidanceState, directive };
  }
}
