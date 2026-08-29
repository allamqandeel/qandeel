import { Injectable } from '@nestjs/common';
import { HimCrossContextForegroundRepository } from './him-cross-context-foreground.repository';
import { HimSituationStressConsumptionService } from './him-situation-stress-consumption.service';
import { HimDecisionAttentionConsumptionService } from './him-decision-attention-consumption.service';
import { HimGoalMotivationConsumptionService } from './him-goal-motivation-consumption.service';
import { HimRelationshipCommunicationConsumptionService } from './him-relationship-communication-consumption.service';
import { HIM_UUID } from './him-contextual-current-projection';
import {
  HIM_CROSS_CONTEXT_FOREGROUND_V3_SLOTS,
  type HimCrossContextForegroundEnvelopeRow,
  type HimCrossContextForegroundGuidance,
} from './him-cross-context-foreground.types';

// QHIA-009: the narrow cross-context foreground aggregation boundary, extended
// by QHIA-010 and QHIA-011 to the fixed four-slot v3 contract.
//
// One repository call - and therefore exactly ONE external Data API request -
// carries ALL FOUR already-approved foreground channels for the turn. This
// service does exactly four things: it issues that one request, it validates
// the outer TRANSPORT envelope, it partitions the rows by their frozen slot
// label, and it hands each row to the SAME semantic consumer that owns it.
//
// It decides NOTHING about meaning. It never inspects a metric key, a numeric
// value, an ordinal, a semantic type, a binding state, a directive, or a
// guidance state; it never combines, scores, ranks, prioritises, correlates, or
// prefers a channel; it never repairs, defaults, or substitutes malformed child
// data; and it holds no threshold, wording, relevance rule, or measurement
// authority. Stress meaning stays inside QHIA-007, Attention meaning inside
// QHIA-008, Motivation meaning inside QHIA-010, and Communication meaning
// inside QHIA-011 - there is deliberately no shared switch, no generic
// metric-to-behaviour mapper, and no place for a slot to acquire meaning by
// accident.
//
// Fail-closed, atomically. A malformed envelope - not an array, not exactly
// four rows, a duplicate/missing/unknown slot, or a slot out of its frozen
// transport order - rejects, and so does a child consumer that refuses its own
// malformed row. There is no partial result and no per-child recovery: this is
// an OPTIONAL foreground enrichment whose caller degrades by omitting ALL FOUR
// guidance fields, never by retrying, never by falling back to the aggregate-v1
// or aggregate-v2 endpoints or to the direct
// QHIA-007/QHIA-008/QHIA-010/QHIA-011 requests, and never by inventing a NONE
// answer the authorities did not give.
@Injectable()
export class HimCrossContextForegroundAggregationService {
  constructor(
    private readonly repository: HimCrossContextForegroundRepository,
    private readonly situationStress: HimSituationStressConsumptionService,
    private readonly decisionAttention: HimDecisionAttentionConsumptionService,
    private readonly goalMotivation: HimGoalMotivationConsumptionService,
    private readonly relationshipCommunication: HimRelationshipCommunicationConsumptionService,
  ) {}

  async read(userId: string, token: string, sessionId: string): Promise<HimCrossContextForegroundGuidance> {
    if (typeof userId !== 'string' || !HIM_UUID.test(userId)) throw new Error('INVALID_CROSS_CONTEXT_FOREGROUND_REQUEST');
    if (typeof sessionId !== 'string' || !HIM_UUID.test(sessionId)) throw new Error('INVALID_CROSS_CONTEXT_FOREGROUND_REQUEST');

    const rows = await this.repository.readSessionCrossContextForeground(token, userId, sessionId);
    const [situationRow, decisionRow, goalRow, relationshipRow] = this.partition(rows);
    // Each raw row goes to its existing owner verbatim. The aggregate reads
    // none of them, and a child rejection propagates unchanged.
    return {
      contractVersion: 3,
      situationStress: this.situationStress.consumeSourceRows([situationRow]),
      decisionAttention: this.decisionAttention.consumeSourceRows([decisionRow]),
      goalMotivation: this.goalMotivation.consumeSourceRows([goalRow]),
      relationshipCommunication: this.relationshipCommunication.consumeSourceRows([relationshipRow]),
    };
  }

  // Outer TRANSPORT validation only. The aggregate always answers with exactly
  // the frozen slots, exactly once each, in exactly their frozen transport
  // order, because migration 0060 wraps the frozen three-slot v2 aggregate and
  // one authority that each always return their exact rows. Anything else - a
  // non-array payload, the wrong row count, a duplicate slot, a missing slot,
  // an unknown slot, or a reordered envelope - is an integrity breach of the
  // transport, never a partially usable answer and never something to sort,
  // pad, or repair.
  private partition(rows: HimCrossContextForegroundEnvelopeRow[]): HimCrossContextForegroundEnvelopeRow[] {
    if (!Array.isArray(rows) || rows.length !== HIM_CROSS_CONTEXT_FOREGROUND_V3_SLOTS.length)
      throw new Error('INTEGRITY_FAILURE');
    return HIM_CROSS_CONTEXT_FOREGROUND_V3_SLOTS.map(({ order, slot }, index) => {
      const row = rows[index];
      if (row === null || typeof row !== 'object') throw new Error('INTEGRITY_FAILURE');
      if (row.foreground_slot !== slot || row.foreground_slot_order !== order) throw new Error('INTEGRITY_FAILURE');
      return row;
    });
  }
}
