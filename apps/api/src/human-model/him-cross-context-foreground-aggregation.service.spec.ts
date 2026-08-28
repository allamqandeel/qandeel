import { readFileSync } from 'node:fs';
import { HimCrossContextForegroundAggregationService } from './him-cross-context-foreground-aggregation.service';
import { HimSituationStressConsumptionService } from './him-situation-stress-consumption.service';
import { HimDecisionAttentionConsumptionService } from './him-decision-attention-consumption.service';
import { HimGoalMotivationConsumptionService } from './him-goal-motivation-consumption.service';
import { HimRelationshipCommunicationConsumptionService } from './him-relationship-communication-consumption.service';
import type { HimSituationStressSourceRow } from './him-situation-stress-consumption.types';
import type { HimDecisionAttentionSourceRow } from './him-decision-attention-consumption.types';
import type { HimGoalMotivationSourceRow } from './him-goal-motivation-consumption.types';
import type { HimRelationshipCommunicationSourceRow } from './him-relationship-communication-consumption.types';
import type { HimCrossContextForegroundEnvelopeRow } from './him-cross-context-foreground.types';

const USER = '00000000-0000-4000-8000-000000000001';
const SESSION = '00000000-0000-4000-8000-000000000002';
const SITUATION = '00000000-0000-4000-8000-000000000003';
const DECISION = '00000000-0000-4000-8000-000000000004';
const BINDING = '00000000-0000-4000-8000-000000000005';
const OTHER_BINDING = '00000000-0000-4000-8000-000000000006';
const GOAL = '00000000-0000-4000-8000-000000000007';
const RELATIONSHIP = '00000000-0000-4000-8000-000000000008';

// The four nested authority shapes, exactly as migrations 0056, 0057, 0059 and
// 0060 return them. The aggregate preserves them verbatim under the outer
// transport discriminator, so the same fixtures drive both the aggregate path
// and the direct-authority parity baseline.
const unboundRow = (bindingState: string): Record<string, unknown> => ({
  binding_state: bindingState,
  binding_context_id: null,
  slot_order: null, metric_key: null, definition_version: null, hif_owner: null,
  semantic_mapping_status: null, semantic_type: null, calculation_status: null, valid_context_kinds: null,
  context_kind: null, context_id: null, has_canonical_current_value: null,
  source_metric_key: null, source_definition_version: null, source_semantic_mapping_status: null,
  source_semantic_type: null, source_context_kind: null, source_context_id: null,
  value_state: null, numeric_value: null, validity_status: null,
  confidence_state: null, confidence_reference: null,
  observed_at: null, temporal_window_start: null, temporal_window_end: null,
  canonical_binding_id: null, active_binding_id: null,
});

const boundRow = (
  bindingState: string, contextKind: string, contextId: string, metricKey: string, numericValue: number | null,
  validContextKinds: string[] = ['SITUATION', 'CONVERSATION_SESSION', 'DECISION'],
  owner = 'HSE', semanticMappingStatus: string | null = 'RESOLVED', semanticType: string | null = 'STATE',
): Record<string, unknown> => ({
  binding_state: bindingState,
  binding_context_id: contextId,
  slot_order: 1,
  metric_key: metricKey,
  definition_version: 1,
  hif_owner: owner,
  semantic_mapping_status: semanticMappingStatus,
  semantic_type: semanticType,
  calculation_status: 'CALIBRATED',
  valid_context_kinds: validContextKinds,
  context_kind: contextKind,
  context_id: contextId,
  has_canonical_current_value: numericValue !== null,
  source_metric_key: numericValue === null ? null : metricKey,
  source_definition_version: numericValue === null ? null : 1,
  source_semantic_mapping_status: numericValue === null ? null : semanticMappingStatus,
  source_semantic_type: numericValue === null ? null : semanticType,
  source_context_kind: numericValue === null ? null : contextKind,
  source_context_id: numericValue === null ? null : contextId,
  value_state: numericValue === null ? null : 'ASSESSED',
  numeric_value: numericValue,
  validity_status: numericValue === null ? null : 'VALID',
  confidence_state: numericValue === null ? null : 'UNASSESSED',
  confidence_reference: null,
  observed_at: numericValue === null ? null : '2026-08-29T00:00:00.000Z',
  temporal_window_start: null,
  temporal_window_end: null,
  canonical_binding_id: numericValue === null ? null : BINDING,
  active_binding_id: numericValue === null ? null : BINDING,
});

const situationUnbound = () => unboundRow('NO_ACTIVE_SITUATION');
const situationBound = (numericValue: number | null) => boundRow('ACTIVE_SITUATION_BOUND', 'SITUATION', SITUATION, 'hse.stress', numericValue);
const decisionUnbound = () => unboundRow('NO_ACTIVE_DECISION');
const decisionBound = (numericValue: number | null) => boundRow('ACTIVE_DECISION_BOUND', 'DECISION', DECISION, 'hse.attention', numericValue);
const goalUnbound = () => unboundRow('NO_ACTIVE_GOAL');
const goalBound = (numericValue: number | null) => boundRow('ACTIVE_GOAL_BOUND', 'GOAL', GOAL, 'hse.motivation', numericValue, ['SITUATION', 'GOAL']);
const relationshipUnbound = () => unboundRow('NO_ACTIVE_RELATIONSHIP');
// The HRS channel carries the canonical identity QHIA-011 consumes: HRS-owned,
// Foundation mapping UNRESOLVED, semantic type NULL. It is deliberately unlike
// the three HSE channels beside it, which is exactly why a transport layer that
// "understood" any channel would be dangerous here.
const relationshipBound = (numericValue: number | null) => boundRow(
  'ACTIVE_RELATIONSHIP_BOUND', 'RELATIONSHIP', RELATIONSHIP, 'hrs.communication', numericValue,
  ['RELATIONSHIP'], 'HRS', 'UNRESOLVED', null,
);

const SITUATION_SLOT = { foreground_slot_order: 1, foreground_slot: 'SITUATION_STRESS' };
const DECISION_SLOT = { foreground_slot_order: 2, foreground_slot: 'DECISION_ATTENTION' };
const GOAL_SLOT = { foreground_slot_order: 3, foreground_slot: 'GOAL_MOTIVATION' };
const RELATIONSHIP_SLOT = { foreground_slot_order: 4, foreground_slot: 'RELATIONSHIP_COMMUNICATION' };

const envelope = (
  situation: Record<string, unknown>, decision: Record<string, unknown>,
  goal: Record<string, unknown>, relationship: Record<string, unknown>,
): unknown[] => [
  { ...SITUATION_SLOT, ...situation },
  { ...DECISION_SLOT, ...decision },
  { ...GOAL_SLOT, ...goal },
  { ...RELATIONSHIP_SLOT, ...relationship },
];

const aggregate = (rows: unknown) => {
  const repository = { readSessionCrossContextForeground: jest.fn().mockResolvedValue(rows) };
  const situationStress = new HimSituationStressConsumptionService({ readSessionSituationStress: jest.fn() } as never);
  const decisionAttention = new HimDecisionAttentionConsumptionService({ readSessionDecisionAttention: jest.fn() } as never);
  const goalMotivation = new HimGoalMotivationConsumptionService({ readSessionGoalMotivation: jest.fn() } as never);
  const relationshipCommunication = new HimRelationshipCommunicationConsumptionService({ readSessionRelationshipCommunication: jest.fn() } as never);
  const situationConsume = jest.spyOn(situationStress, 'consumeSourceRows');
  const decisionConsume = jest.spyOn(decisionAttention, 'consumeSourceRows');
  const goalConsume = jest.spyOn(goalMotivation, 'consumeSourceRows');
  const relationshipConsume = jest.spyOn(relationshipCommunication, 'consumeSourceRows');
  return {
    repository, situationStress, decisionAttention, goalMotivation, relationshipCommunication,
    situationConsume, decisionConsume, goalConsume, relationshipConsume,
    service: new HimCrossContextForegroundAggregationService(repository as never, situationStress, decisionAttention, goalMotivation, relationshipCommunication),
  };
};

// The parity baseline: the EXISTING direct QHIA-007, QHIA-008, QHIA-010 and
// QHIA-011 boundaries, each over its own direct repository. Anything the
// aggregate returns must equal this, fact for fact.
const directBaseline = async (
  situation: Record<string, unknown>, decision: Record<string, unknown>,
  goal: Record<string, unknown>, relationship: Record<string, unknown>,
) => ({
  contractVersion: 3 as const,
  situationStress: await new HimSituationStressConsumptionService(
    { readSessionSituationStress: jest.fn().mockResolvedValue([situation]) } as never,
  ).read(USER, 'token', SESSION),
  decisionAttention: await new HimDecisionAttentionConsumptionService(
    { readSessionDecisionAttention: jest.fn().mockResolvedValue([decision]) } as never,
  ).read(USER, 'token', SESSION),
  goalMotivation: await new HimGoalMotivationConsumptionService(
    { readSessionGoalMotivation: jest.fn().mockResolvedValue([goal]) } as never,
  ).read(USER, 'token', SESSION),
  relationshipCommunication: await new HimRelationshipCommunicationConsumptionService(
    { readSessionRelationshipCommunication: jest.fn().mockResolvedValue([relationship]) } as never,
  ).read(USER, 'token', SESSION),
});

const NONE_STRESS = { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' };
const REDUCE_STRESS = { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_INTERACTION_BURDEN' };
const NONE_ATTENTION = { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' };
const REDUCE_ATTENTION = { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_PRESENTATION_BURDEN' };
const NONE_MOTIVATION = { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' };
const REDUCE_MOTIVATION = { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_GOAL_ACTION_BURDEN' };
const NONE_COMMUNICATION = { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' };
const STRUCTURE_COMMUNICATION = { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'STRUCTURE_RELATIONSHIP_COMMUNICATION' };

describe('HimCrossContextForegroundAggregationService (QHIA-009 transport, QHIA-011 v3 envelope)', () => {
  describe('one aggregate transport read', () => {
    it('performs EXACTLY ONE repository read with the exact authenticated user and owned session', async () => {
      const { repository, service } = aggregate(envelope(situationUnbound(), decisionUnbound(), goalUnbound(), relationshipUnbound()));
      await service.read(USER, 'token', SESSION);
      expect(repository.readSessionCrossContextForeground).toHaveBeenCalledTimes(1);
      expect(repository.readSessionCrossContextForeground).toHaveBeenCalledWith('token', USER, SESSION);
    });

    it('rejects a malformed identity before any external request is issued', async () => {
      for (const [userId, sessionId] of [
        ['not-a-uuid', SESSION], [USER, 'not-a-uuid'], ['', SESSION], [USER, ''],
      ] as const) {
        const { repository, service } = aggregate(envelope(situationUnbound(), decisionUnbound(), goalUnbound(), relationshipUnbound()));
        await expect(service.read(userId, 'token', sessionId)).rejects.toThrow('INVALID_CROSS_CONTEXT_FOREGROUND_REQUEST');
        expect(repository.readSessionCrossContextForeground).not.toHaveBeenCalled();
      }
    });

    it('propagates a rejected aggregate read atomically: no second request, no direct 007/008/010/011 fallback, no invented NONE', async () => {
      const repository = { readSessionCrossContextForeground: jest.fn().mockRejectedValue(new Error('transport failure')) };
      const situationStress = new HimSituationStressConsumptionService({ readSessionSituationStress: jest.fn() } as never);
      const decisionAttention = new HimDecisionAttentionConsumptionService({ readSessionDecisionAttention: jest.fn() } as never);
      const goalMotivation = new HimGoalMotivationConsumptionService({ readSessionGoalMotivation: jest.fn() } as never);
      const relationshipCommunication = new HimRelationshipCommunicationConsumptionService({ readSessionRelationshipCommunication: jest.fn() } as never);
      const situationRead = jest.spyOn(situationStress, 'read');
      const decisionRead = jest.spyOn(decisionAttention, 'read');
      const goalRead = jest.spyOn(goalMotivation, 'read');
      const relationshipRead = jest.spyOn(relationshipCommunication, 'read');
      const service = new HimCrossContextForegroundAggregationService(repository as never, situationStress, decisionAttention, goalMotivation, relationshipCommunication);
      await expect(service.read(USER, 'token', SESSION)).rejects.toThrow('transport failure');
      expect(repository.readSessionCrossContextForeground).toHaveBeenCalledTimes(1);
      expect(situationRead).not.toHaveBeenCalled();
      expect(decisionRead).not.toHaveBeenCalled();
      expect(goalRead).not.toHaveBeenCalled();
      expect(relationshipRead).not.toHaveBeenCalled();
    });
  });

  describe('outer transport envelope validation', () => {
    const malformedEnvelopes: Array<[string, unknown]> = [
      ['a non-array payload', null],
      ['an object payload', {}],
      ['zero rows', []],
      ['one row', [{ ...SITUATION_SLOT, ...situationUnbound() }]],
      ['the retired three-row v2 envelope', [
        { ...SITUATION_SLOT, ...situationUnbound() },
        { ...DECISION_SLOT, ...decisionUnbound() },
        { ...GOAL_SLOT, ...goalUnbound() },
      ]],
      ['the retired two-row v1 envelope', [
        { ...SITUATION_SLOT, ...situationUnbound() },
        { ...DECISION_SLOT, ...decisionUnbound() },
      ]],
      ['five rows', [
        { ...SITUATION_SLOT, ...situationUnbound() },
        { ...DECISION_SLOT, ...decisionUnbound() },
        { ...GOAL_SLOT, ...goalUnbound() },
        { ...RELATIONSHIP_SLOT, ...relationshipUnbound() },
        { foreground_slot_order: 5, foreground_slot: 'RELATIONSHIP_TRUST', ...relationshipUnbound() },
      ]],
      ['a duplicated slot', [
        { ...SITUATION_SLOT, ...situationUnbound() },
        { ...SITUATION_SLOT, ...situationUnbound() },
        { ...GOAL_SLOT, ...goalUnbound() },
        { ...RELATIONSHIP_SLOT, ...relationshipUnbound() },
      ]],
      ['a missing slot', [
        { ...SITUATION_SLOT, ...situationUnbound() },
        { ...DECISION_SLOT, ...decisionUnbound() },
        { ...GOAL_SLOT, ...goalUnbound() },
        { foreground_slot_order: 4, foreground_slot: null, ...relationshipUnbound() },
      ]],
      ['an unknown slot label', [
        { ...SITUATION_SLOT, ...situationUnbound() },
        { ...DECISION_SLOT, ...decisionUnbound() },
        { ...GOAL_SLOT, ...goalUnbound() },
        { foreground_slot_order: 4, foreground_slot: 'RELATIONSHIP_TRUST', ...relationshipUnbound() },
      ]],
      ['a reordered envelope', [
        { ...RELATIONSHIP_SLOT, ...relationshipUnbound() },
        { ...SITUATION_SLOT, ...situationUnbound() },
        { ...DECISION_SLOT, ...decisionUnbound() },
        { ...GOAL_SLOT, ...goalUnbound() },
      ]],
      ['a slot order that disagrees with its label', [
        { foreground_slot_order: 4, foreground_slot: 'SITUATION_STRESS', ...situationUnbound() },
        { ...DECISION_SLOT, ...decisionUnbound() },
        { ...GOAL_SLOT, ...goalUnbound() },
        { foreground_slot_order: 1, foreground_slot: 'RELATIONSHIP_COMMUNICATION', ...relationshipUnbound() },
      ]],
      ['a null row', [null, { ...DECISION_SLOT, ...decisionUnbound() }, { ...GOAL_SLOT, ...goalUnbound() }, { ...RELATIONSHIP_SLOT, ...relationshipUnbound() }]],
      ['a non-object row', ['SITUATION_STRESS', { ...DECISION_SLOT, ...decisionUnbound() }, { ...GOAL_SLOT, ...goalUnbound() }, { ...RELATIONSHIP_SLOT, ...relationshipUnbound() }]],
    ];

    it.each(malformedEnvelopes)('fails closed on %s and consumes nothing', async (_label, rows) => {
      const { service, situationConsume, decisionConsume, goalConsume, relationshipConsume } = aggregate(rows);
      await expect(service.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
      expect(situationConsume).not.toHaveBeenCalled();
      expect(decisionConsume).not.toHaveBeenCalled();
      expect(goalConsume).not.toHaveBeenCalled();
      expect(relationshipConsume).not.toHaveBeenCalled();
    });

    it('never sorts, pads, or repairs a broken envelope into a usable one', async () => {
      const { service } = aggregate([
        { ...DECISION_SLOT, ...decisionBound(1) },
        { ...GOAL_SLOT, ...goalBound(1) },
        { ...RELATIONSHIP_SLOT, ...relationshipBound(1) },
        { ...SITUATION_SLOT, ...situationBound(5) },
      ]);
      // Every row is individually valid and all four frozen slots are present:
      // only the transport order is wrong. A layer that reordered here would be
      // repairing transport, so it fails closed instead.
      await expect(service.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
    });
  });

  describe('deterministic partition into the four existing semantic consumers', () => {
    it('hands each raw row to its own existing consumer, verbatim and exactly once', async () => {
      const situationRow = situationBound(4);
      const decisionRow = decisionBound(1);
      const goalRow = goalBound(2);
      const relationshipRow = relationshipBound(2);
      const { service, situationConsume, decisionConsume, goalConsume, relationshipConsume } = aggregate(envelope(situationRow, decisionRow, goalRow, relationshipRow));
      await service.read(USER, 'token', SESSION);
      expect(situationConsume).toHaveBeenCalledTimes(1);
      expect(decisionConsume).toHaveBeenCalledTimes(1);
      expect(goalConsume).toHaveBeenCalledTimes(1);
      expect(relationshipConsume).toHaveBeenCalledTimes(1);
      expect(situationConsume).toHaveBeenCalledWith([{ ...SITUATION_SLOT, ...situationRow }]);
      expect(decisionConsume).toHaveBeenCalledWith([{ ...DECISION_SLOT, ...decisionRow }]);
      expect(goalConsume).toHaveBeenCalledWith([{ ...GOAL_SLOT, ...goalRow }]);
      expect(relationshipConsume).toHaveBeenCalledWith([{ ...RELATIONSHIP_SLOT, ...relationshipRow }]);
      // No row ever reaches another channel's consumer: partitioning is by
      // frozen slot label, never by content.
      expect(situationConsume.mock.calls[0][0][0].metric_key).toBe('hse.stress');
      expect(decisionConsume.mock.calls[0][0][0].metric_key).toBe('hse.attention');
      expect(goalConsume.mock.calls[0][0][0].metric_key).toBe('hse.motivation');
      expect(relationshipConsume.mock.calls[0][0][0].metric_key).toBe('hrs.communication');
    });

    it('returns the four existing guidance contracts side by side with no combined, scored, or ranked field', async () => {
      const { service } = aggregate(envelope(situationBound(5), decisionBound(2), goalBound(1), relationshipBound(1)));
      const result = await service.read(USER, 'token', SESSION);
      expect(Object.keys(result).sort()).toEqual(['contractVersion', 'decisionAttention', 'goalMotivation', 'relationshipCommunication', 'situationStress']);
      expect(result).toEqual({
        contractVersion: 3,
        situationStress: REDUCE_STRESS,
        decisionAttention: REDUCE_ATTENTION,
        goalMotivation: REDUCE_MOTIVATION,
        relationshipCommunication: STRUCTURE_COMMUNICATION,
      });
    });
  });

  describe('semantic parity with the direct QHIA-007, QHIA-008, QHIA-010 and QHIA-011 authorities', () => {
    type Row = Record<string, unknown>;
    const parityCases: Array<[string, () => Row, () => Row, () => Row, () => Row, Row, Row, Row, Row]> = [
      ['all four ACTIVE', () => situationBound(4), () => decisionBound(2), () => goalBound(1), () => relationshipBound(1), REDUCE_STRESS, REDUCE_ATTENTION, REDUCE_MOTIVATION, STRUCTURE_COMMUNICATION],
      ['Situation ACTIVE + Relationship ACTIVE', () => situationBound(5), () => decisionBound(3), () => goalBound(4), () => relationshipBound(2), REDUCE_STRESS, NONE_ATTENTION, NONE_MOTIVATION, STRUCTURE_COMMUNICATION],
      ['Decision ACTIVE + Relationship ACTIVE', () => situationBound(2), () => decisionBound(1), () => goalBound(3), () => relationshipBound(1), NONE_STRESS, REDUCE_ATTENTION, NONE_MOTIVATION, STRUCTURE_COMMUNICATION],
      ['Goal ACTIVE + Relationship ACTIVE', () => situationBound(1), () => decisionBound(5), () => goalBound(2), () => relationshipBound(2), NONE_STRESS, NONE_ATTENTION, REDUCE_MOTIVATION, STRUCTURE_COMMUNICATION],
      ['Relationship ACTIVE alone', situationUnbound, decisionUnbound, goalUnbound, () => relationshipBound(1), NONE_STRESS, NONE_ATTENTION, NONE_MOTIVATION, STRUCTURE_COMMUNICATION],
      ['all NONE (mid scale)', () => situationBound(1), () => decisionBound(5), () => goalBound(3), () => relationshipBound(4), NONE_STRESS, NONE_ATTENTION, NONE_MOTIVATION, NONE_COMMUNICATION],
      ['Relationship unbound while others bound', () => situationBound(4), () => decisionBound(1), () => goalBound(1), relationshipUnbound, REDUCE_STRESS, REDUCE_ATTENTION, REDUCE_MOTIVATION, NONE_COMMUNICATION],
      ['all four unbound', situationUnbound, decisionUnbound, goalUnbound, relationshipUnbound, NONE_STRESS, NONE_ATTENTION, NONE_MOTIVATION, NONE_COMMUNICATION],
      ['all bound but UNKNOWN (no canonical current value)', () => situationBound(null), () => decisionBound(null), () => goalBound(null), () => relationshipBound(null), NONE_STRESS, NONE_ATTENTION, NONE_MOTIVATION, NONE_COMMUNICATION],
    ];

    it.each(parityCases)('equals the direct authorities for %s', async (_label, situation, decision, goal, relationship, expectedStress, expectedAttention, expectedMotivation, expectedCommunication) => {
      const situationRow = situation();
      const decisionRow = decision();
      const goalRow = goal();
      const relationshipRow = relationship();
      const { service } = aggregate(envelope(situationRow, decisionRow, goalRow, relationshipRow));
      const aggregated = await service.read(USER, 'token', SESSION);
      expect(aggregated).toEqual(await directBaseline(situationRow, decisionRow, goalRow, relationshipRow));
      expect(aggregated.situationStress).toEqual(expectedStress);
      expect(aggregated.decisionAttention).toEqual(expectedAttention);
      expect(aggregated.goalMotivation).toEqual(expectedMotivation);
      expect(aggregated.relationshipCommunication).toEqual(expectedCommunication);
    });

    it('equals the direct authorities for an UNKNOWN caused by an incompatible ACTIVE measurement binding', async () => {
      const situationRow = { ...situationBound(5), active_binding_id: OTHER_BINDING };
      const decisionRow = { ...decisionBound(1), active_binding_id: OTHER_BINDING };
      const goalRow = { ...goalBound(1), active_binding_id: OTHER_BINDING };
      const relationshipRow = { ...relationshipBound(1), active_binding_id: OTHER_BINDING };
      const { service } = aggregate(envelope(situationRow, decisionRow, goalRow, relationshipRow));
      const aggregated = await service.read(USER, 'token', SESSION);
      expect(aggregated).toEqual(await directBaseline(situationRow, decisionRow, goalRow, relationshipRow));
      expect(aggregated).toEqual({
        contractVersion: 3,
        situationStress: NONE_STRESS,
        decisionAttention: NONE_ATTENTION,
        goalMotivation: NONE_MOTIVATION,
        relationshipCommunication: NONE_COMMUNICATION,
      });
    });

    const unusableValueCases: Array<[string, Record<string, unknown>]> = [
      ['an INVALIDATED latest value', { validity_status: 'INVALIDATED' }],
      ['an UNASSESSED latest value', { value_state: 'UNASSESSED', numeric_value: null }],
    ];

    it.each(unusableValueCases)('equals the direct authorities for %s', async (_label, override) => {
      const situationRow = { ...situationBound(4), ...override };
      const decisionRow = { ...decisionBound(2), ...override };
      const goalRow = { ...goalBound(1), ...override };
      const relationshipRow = { ...relationshipBound(1), ...override };
      const { service } = aggregate(envelope(situationRow, decisionRow, goalRow, relationshipRow));
      expect(await service.read(USER, 'token', SESSION)).toEqual(await directBaseline(situationRow, decisionRow, goalRow, relationshipRow));
    });

    it('leaves the three existing channels byte-identical to what the frozen three-slot contract produced', async () => {
      // QHIA-011 changed the envelope, never the QHIA-007/QHIA-008/QHIA-010
      // meaning: the three existing guidance contracts are exactly what the
      // direct authorities return for the same rows, whatever the Relationship
      // channel says.
      for (const relationshipRow of [relationshipUnbound(), relationshipBound(1), relationshipBound(4), relationshipBound(null)]) {
        const situationRow = situationBound(4);
        const decisionRow = decisionBound(2);
        const goalRow = goalBound(1);
        const { service } = aggregate(envelope(situationRow, decisionRow, goalRow, relationshipRow));
        const aggregated = await service.read(USER, 'token', SESSION);
        expect(aggregated.situationStress).toEqual(REDUCE_STRESS);
        expect(aggregated.decisionAttention).toEqual(REDUCE_ATTENTION);
        expect(aggregated.goalMotivation).toEqual(REDUCE_MOTIVATION);
      }
    });

    it('never lets one family\'s semantics reach another: HSE stays RESOLVED/STATE and HRS stays UNRESOLVED/null', async () => {
      // The four rows carry genuinely different semantic identities under one
      // transport. Each consumer enforces its own, and the aggregate enforces
      // none - which is what stops an HSE rule from ever being applied to the
      // HRS reading or the reverse.
      const { service } = aggregate(envelope(situationBound(4), decisionBound(1), goalBound(1), relationshipBound(1)));
      await expect(service.read(USER, 'token', SESSION)).resolves.toEqual({
        contractVersion: 3,
        situationStress: REDUCE_STRESS,
        decisionAttention: REDUCE_ATTENTION,
        goalMotivation: REDUCE_MOTIVATION,
        relationshipCommunication: STRUCTURE_COMMUNICATION,
      });
      // Giving the HRS channel the HSE identity, or an HSE channel the HRS
      // identity, fails closed on both sides.
      const hseShapedRelationship = { ...relationshipBound(1), semantic_mapping_status: 'RESOLVED', semantic_type: 'STATE', source_semantic_mapping_status: 'RESOLVED', source_semantic_type: 'STATE' };
      await expect(aggregate(envelope(situationBound(4), decisionBound(1), goalBound(1), hseShapedRelationship)).service.read(USER, 'token', SESSION))
        .rejects.toThrow('INTEGRITY_FAILURE');
      const hrsShapedGoal = { ...goalBound(1), semantic_mapping_status: 'UNRESOLVED', semantic_type: null, source_semantic_mapping_status: 'UNRESOLVED', source_semantic_type: null };
      await expect(aggregate(envelope(situationBound(4), decisionBound(1), hrsShapedGoal, relationshipBound(1))).service.read(USER, 'token', SESSION))
        .rejects.toThrow('INTEGRITY_FAILURE');
    });
  });

  describe('malformed child data is never repaired by the aggregate layer', () => {
    const situationDrift: Array<[string, Record<string, unknown>]> = [
      ['a drifted semantic type', { semantic_type: 'ALIGNMENT', source_semantic_type: 'ALIGNMENT' }],
      ['a drifted semantic mapping status', { semantic_mapping_status: 'UNRESOLVED', semantic_type: null, source_semantic_mapping_status: 'UNRESOLVED', source_semantic_type: null }],
      ['a foreign metric identity', { metric_key: 'hse.attention', source_metric_key: 'hse.attention' }],
      ['a drifted definition version', { definition_version: 2 }],
      ['a drifted HIF owner', { hif_owner: 'HBS' }],
      ['an unbound state carrying a metric fragment', { binding_state: 'NO_ACTIVE_SITUATION', metric_key: 'hse.stress' }],
      ['an unknown binding state', { binding_state: 'MAYBE_BOUND' }],
      ['an out-of-scale ordinal', { numeric_value: 6 }],
    ];

    it.each(situationDrift)('rejects %s in the Situation row exactly as the direct QHIA-007 authority does', async (_label, override) => {
      const situationRow = { ...situationBound(4), ...override };
      const { service } = aggregate(envelope(situationRow, decisionBound(1), goalBound(1), relationshipBound(1)));
      await expect(service.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
      await expect(new HimSituationStressConsumptionService(
        { readSessionSituationStress: jest.fn().mockResolvedValue([situationRow]) } as never,
      ).read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
    });

    const decisionDrift: Array<[string, Record<string, unknown>]> = [
      ['a drifted semantic type', { semantic_type: 'READINESS', source_semantic_type: 'READINESS' }],
      ['a foreign metric identity', { metric_key: 'hse.self-confidence', source_metric_key: 'hse.self-confidence' }],
      ['a drifted definition version', { definition_version: 2 }],
      ['an unbound state carrying a metric fragment', { binding_state: 'NO_ACTIVE_DECISION', numeric_value: 1 }],
      ['an unknown binding state', { binding_state: 'ACTIVE_SITUATION_BOUND' }],
      ['an out-of-scale ordinal', { numeric_value: 0 }],
    ];

    it.each(decisionDrift)('rejects %s in the Decision row exactly as the direct QHIA-008 authority does', async (_label, override) => {
      const decisionRow = { ...decisionBound(1), ...override };
      const { service } = aggregate(envelope(situationBound(4), decisionRow, goalBound(1), relationshipBound(1)));
      await expect(service.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
      await expect(new HimDecisionAttentionConsumptionService(
        { readSessionDecisionAttention: jest.fn().mockResolvedValue([decisionRow]) } as never,
      ).read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
    });

    const goalDrift: Array<[string, Record<string, unknown>]> = [
      ['a drifted semantic type', { semantic_type: 'READINESS', source_semantic_type: 'READINESS' }],
      ['a drifted semantic mapping status', { semantic_mapping_status: 'UNRESOLVED', semantic_type: null, source_semantic_mapping_status: 'UNRESOLVED', source_semantic_type: null }],
      ['a foreign metric identity', { metric_key: 'hse.stress', source_metric_key: 'hse.stress' }],
      ['a drifted definition version', { definition_version: 2 }],
      ['a drifted HIF owner', { hif_owner: 'HGS' }],
      ['a drifted context kind', { context_kind: 'SITUATION', source_context_kind: 'SITUATION' }],
      ['an unbound state carrying a metric fragment', { binding_state: 'NO_ACTIVE_GOAL', numeric_value: 1 }],
      ['an unknown binding state', { binding_state: 'ACTIVE_DECISION_BOUND' }],
      ['an out-of-scale ordinal', { numeric_value: 6 }],
    ];

    it.each(goalDrift)('rejects %s in the Goal row exactly as the direct QHIA-010 authority does', async (_label, override) => {
      const goalRow = { ...goalBound(1), ...override };
      const { service } = aggregate(envelope(situationBound(4), decisionBound(1), goalRow, relationshipBound(1)));
      await expect(service.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
      await expect(new HimGoalMotivationConsumptionService(
        { readSessionGoalMotivation: jest.fn().mockResolvedValue([goalRow]) } as never,
      ).read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
    });

    const relationshipDrift: Array<[string, Record<string, unknown>]> = [
      ['a resolved semantic mapping', { semantic_mapping_status: 'RESOLVED', semantic_type: 'STATE', source_semantic_mapping_status: 'RESOLVED', source_semantic_type: 'STATE' }],
      ['a non-null semantic type', { semantic_type: 'CAPABILITY', source_semantic_type: 'CAPABILITY' }],
      ['a sibling HRS metric identity', { metric_key: 'hrs.relationship-trust', source_metric_key: 'hrs.relationship-trust' }],
      ['a second sibling HRS metric identity', { metric_key: 'hrs.emotional-safety', source_metric_key: 'hrs.emotional-safety' }],
      ['a drifted definition version', { definition_version: 2 }],
      ['a drifted HIF owner', { hif_owner: 'HSE' }],
      ['a drifted context kind', { context_kind: 'SITUATION', source_context_kind: 'SITUATION' }],
      ['an unbound state carrying a metric fragment', { binding_state: 'NO_ACTIVE_RELATIONSHIP', numeric_value: 1 }],
      ['an unknown binding state', { binding_state: 'ACTIVE_GOAL_BOUND' }],
      ['an out-of-scale ordinal', { numeric_value: 6 }],
    ];

    it.each(relationshipDrift)('rejects %s in the Relationship row exactly as the direct QHIA-011 authority does', async (_label, override) => {
      const relationshipRow = { ...relationshipBound(1), ...override };
      const { service } = aggregate(envelope(situationBound(4), decisionBound(1), goalBound(1), relationshipRow));
      await expect(service.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
      await expect(new HimRelationshipCommunicationConsumptionService(
        { readSessionRelationshipCommunication: jest.fn().mockResolvedValue([relationshipRow]) } as never,
      ).read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
    });

    it('fails the WHOLE aggregate when only the Relationship child rejects: there is no partial first-three result', async () => {
      const { service } = aggregate(envelope(situationBound(4), decisionBound(1), goalBound(1), { ...relationshipBound(1), semantic_mapping_status: 'RESOLVED', semantic_type: 'CAPABILITY', source_semantic_mapping_status: 'RESOLVED', source_semantic_type: 'CAPABILITY' }));
      await expect(service.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
    });

    it('fails the WHOLE aggregate when only one existing child rejects: there is no partial result', async () => {
      const { service } = aggregate(envelope(situationBound(4), { ...decisionBound(1), semantic_type: 'LOAD', source_semantic_type: 'LOAD' }, goalBound(1), relationshipBound(1)));
      await expect(service.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
    });

    it('never swaps a rejected channel for another channel or for a fabricated NONE', async () => {
      const { service } = aggregate(envelope({ ...situationBound(4), binding_state: 'ACTIVE_RELATIONSHIP_BOUND' }, decisionBound(1), goalBound(1), relationshipBound(1)));
      await expect(service.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
    });
  });

  describe('the aggregate abstracts transport, never meaning', () => {
    it('depends on exactly the aggregate repository and the four existing consumers, and exposes exactly one public method', () => {
      expect(HimCrossContextForegroundAggregationService.length).toBe(5);
      const methods = Object.getOwnPropertyNames(HimCrossContextForegroundAggregationService.prototype)
        .filter((name) => name !== 'constructor' && !name.startsWith('_'));
      expect(methods).toEqual(['read', 'partition']);
    });

    it('names no metric, no context kind, no ordinal, no threshold, and no directive in its source', () => {
      const source = readFileSync(`${__dirname}/him-cross-context-foreground-aggregation.service.ts`, 'utf8');
      // Structural proof: exactly one external read is reachable from this
      // service, and no generic metric-to-behaviour mapper can hide in it.
      expect([...source.matchAll(/this\.repository\.readSessionCrossContextForeground/gu)]).toHaveLength(1);
      // The negatives run on EXECUTABLE source only: the file's own prose
      // legitimately names the meanings it must never hold, in order to
      // document that it does not hold them.
      const executable = source.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
      for (const forbidden of [
        'hse.stress', 'hse.attention', 'hse.motivation', 'hse.self-confidence', 'hrs.communication', 'hrs.relationship-trust',
        'SITUATION\'', 'DECISION\'', 'GOAL\'', 'RELATIONSHIP\'',
        'numericValue', 'numeric_value', 'semanticType', 'semantic_type', 'binding_state', 'knowledgeState',
        'guidanceState', 'directive', 'REDUCE_INTERACTION_BURDEN', 'REDUCE_PRESENTATION_BURDEN', 'REDUCE_GOAL_ACTION_BURDEN',
        'STRUCTURE_RELATIONSHIP_COMMUNICATION',
        'projectHimContextualCurrentSlot', 'score', 'rank', 'priority', 'combine', 'cache',
        'readSessionSituationStress', 'readSessionDecisionAttention', 'readSessionGoalMotivation', 'readSessionRelationshipCommunication',
        'HimSessionContextBindingRepository',
      ]) expect(executable).not.toContain(forbidden);
      // Delegation, not duplication: the four existing pure consumers are the
      // only semantic authorities this service can reach.
      expect([...executable.matchAll(/consumeSourceRows/gu)]).toHaveLength(4);
      expect(executable).not.toContain('.read(');
    });

    it('reads no channel content to decide the partition: only the frozen slot label and order', async () => {
      // Rows carry other channels' content under the correct slot labels. The
      // aggregate still routes strictly by label - and the child consumers,
      // which do own meaning, reject the mismatch.
      const { service, situationConsume, decisionConsume, goalConsume, relationshipConsume } = aggregate([
        { ...SITUATION_SLOT, ...relationshipBound(1) },
        { ...DECISION_SLOT, ...situationBound(4) },
        { ...GOAL_SLOT, ...decisionBound(1) },
        { ...RELATIONSHIP_SLOT, ...goalBound(1) },
      ]);
      await expect(service.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
      expect(situationConsume).toHaveBeenCalledTimes(1);
      expect(situationConsume.mock.calls[0][0][0].metric_key).toBe('hrs.communication');
      expect(decisionConsume).not.toHaveBeenCalled();
      expect(goalConsume).not.toHaveBeenCalled();
      expect(relationshipConsume).not.toHaveBeenCalled();
    });

    it('caches nothing across calls: every read issues its own aggregate request', async () => {
      const rows = envelope(situationBound(4), decisionBound(1), goalBound(1), relationshipBound(1));
      const { repository, service } = aggregate(rows);
      const first = await service.read(USER, 'token', SESSION);
      repository.readSessionCrossContextForeground.mockResolvedValue(envelope(situationUnbound(), decisionUnbound(), goalUnbound(), relationshipUnbound()) as HimCrossContextForegroundEnvelopeRow[]);
      const second = await service.read(USER, 'token', SESSION);
      expect(repository.readSessionCrossContextForeground).toHaveBeenCalledTimes(2);
      expect(first).toEqual({ contractVersion: 3, situationStress: REDUCE_STRESS, decisionAttention: REDUCE_ATTENTION, goalMotivation: REDUCE_MOTIVATION, relationshipCommunication: STRUCTURE_COMMUNICATION });
      expect(second).toEqual({ contractVersion: 3, situationStress: NONE_STRESS, decisionAttention: NONE_ATTENTION, goalMotivation: NONE_MOTIVATION, relationshipCommunication: NONE_COMMUNICATION });
    });
  });

  describe('the existing direct QHIA-007 / QHIA-008 / QHIA-010 / QHIA-011 boundaries stay independently correct', () => {
    it('keeps read(...) behaviour identical to the extracted pure consumer for every channel', async () => {
      const situationRows = [situationBound(4) as unknown as HimSituationStressSourceRow];
      const decisionRows = [decisionBound(2) as unknown as HimDecisionAttentionSourceRow];
      const goalRows = [goalBound(1) as unknown as HimGoalMotivationSourceRow];
      const relationshipRows = [relationshipBound(1) as unknown as HimRelationshipCommunicationSourceRow];
      const situationRepository = { readSessionSituationStress: jest.fn().mockResolvedValue(situationRows) };
      const decisionRepository = { readSessionDecisionAttention: jest.fn().mockResolvedValue(decisionRows) };
      const goalRepository = { readSessionGoalMotivation: jest.fn().mockResolvedValue(goalRows) };
      const relationshipRepository = { readSessionRelationshipCommunication: jest.fn().mockResolvedValue(relationshipRows) };
      const situationService = new HimSituationStressConsumptionService(situationRepository as never);
      const decisionService = new HimDecisionAttentionConsumptionService(decisionRepository as never);
      const goalService = new HimGoalMotivationConsumptionService(goalRepository as never);
      const relationshipService = new HimRelationshipCommunicationConsumptionService(relationshipRepository as never);
      // read(...) still performs its own single direct request and returns
      // exactly what the extracted pure method returns for the same rows.
      expect(await situationService.read(USER, 'token', SESSION)).toEqual(situationService.consumeSourceRows(situationRows));
      expect(await decisionService.read(USER, 'token', SESSION)).toEqual(decisionService.consumeSourceRows(decisionRows));
      expect(await goalService.read(USER, 'token', SESSION)).toEqual(goalService.consumeSourceRows(goalRows));
      expect(await relationshipService.read(USER, 'token', SESSION)).toEqual(relationshipService.consumeSourceRows(relationshipRows));
      expect(situationRepository.readSessionSituationStress).toHaveBeenCalledTimes(1);
      expect(situationRepository.readSessionSituationStress).toHaveBeenCalledWith('token', USER, SESSION);
      expect(decisionRepository.readSessionDecisionAttention).toHaveBeenCalledTimes(1);
      expect(decisionRepository.readSessionDecisionAttention).toHaveBeenCalledWith('token', USER, SESSION);
      expect(goalRepository.readSessionGoalMotivation).toHaveBeenCalledTimes(1);
      expect(goalRepository.readSessionGoalMotivation).toHaveBeenCalledWith('token', USER, SESSION);
      expect(relationshipRepository.readSessionRelationshipCommunication).toHaveBeenCalledTimes(1);
      expect(relationshipRepository.readSessionRelationshipCommunication).toHaveBeenCalledWith('token', USER, SESSION);
    });
  });
});
