import { readFileSync } from 'node:fs';
import { HimRelationshipCommunicationConsumptionService } from './him-relationship-communication-consumption.service';
import { projectHimContextualCurrentSlot } from './him-contextual-current-projection';
import type { HimRelationshipCommunicationSourceRow } from './him-relationship-communication-consumption.types';

const USER = '00000000-0000-4000-8000-000000000001';
const SESSION = '00000000-0000-4000-8000-000000000002';
const RELATIONSHIP = '00000000-0000-4000-8000-000000000003';
const OTHER_RELATIONSHIP = '00000000-0000-4000-8000-000000000009';
const BINDING = '00000000-0000-4000-8000-000000000004';
const OTHER_BINDING = '00000000-0000-4000-8000-000000000005';

const unboundRow = (): HimRelationshipCommunicationSourceRow => ({
  binding_state: 'NO_ACTIVE_RELATIONSHIP',
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
} as unknown as HimRelationshipCommunicationSourceRow);

const boundRow = (numericValue: number | null): HimRelationshipCommunicationSourceRow => ({
  binding_state: 'ACTIVE_RELATIONSHIP_BOUND',
  binding_context_id: RELATIONSHIP,
  slot_order: 1,
  metric_key: 'hrs.communication',
  definition_version: 1,
  hif_owner: 'HRS',
  // The EXPECTED canonical identity of hrs.communication@1: the Foundation
  // semantic mapping is UNRESOLVED and the semantic type is NULL. This is the
  // valid persisted state, not a defect, and the consumer must accept it.
  semantic_mapping_status: 'UNRESOLVED',
  semantic_type: null,
  calculation_status: 'CALIBRATED',
  valid_context_kinds: ['RELATIONSHIP'],
  context_kind: 'RELATIONSHIP',
  context_id: RELATIONSHIP,
  has_canonical_current_value: numericValue !== null,
  source_metric_key: numericValue === null ? null : 'hrs.communication',
  source_definition_version: numericValue === null ? null : 1,
  source_semantic_mapping_status: numericValue === null ? null : 'UNRESOLVED',
  source_semantic_type: null,
  source_context_kind: numericValue === null ? null : 'RELATIONSHIP',
  source_context_id: numericValue === null ? null : RELATIONSHIP,
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
} as unknown as HimRelationshipCommunicationSourceRow);

const service = (rows: unknown) => {
  const repository = { readSessionRelationshipCommunication: jest.fn().mockResolvedValue(rows) };
  return { repository, consumption: new HimRelationshipCommunicationConsumptionService(repository as never) };
};

const NONE = { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' };
const STRUCTURE = { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'STRUCTURE_RELATIONSHIP_COMMUNICATION' };

describe('HimRelationshipCommunicationConsumptionService (QHIA-011)', () => {
  describe('one authoritative composed read', () => {
    it('performs EXACTLY ONE repository read with the exact authenticated user and owned session', async () => {
      const { repository, consumption } = service([unboundRow()]);
      await consumption.read(USER, 'token', SESSION);
      expect(repository.readSessionRelationshipCommunication).toHaveBeenCalledTimes(1);
      expect(repository.readSessionRelationshipCommunication).toHaveBeenCalledWith('token', USER, SESSION);
    });

    it('rejects a malformed identity before any external request is issued', async () => {
      for (const [userId, sessionId] of [
        ['not-a-uuid', SESSION], [USER, 'not-a-uuid'], ['', SESSION], [USER, ''],
      ] as const) {
        const { repository, consumption } = service([unboundRow()]);
        await expect(consumption.read(userId, 'token', sessionId)).rejects.toThrow('INVALID_RELATIONSHIP_COMMUNICATION_REQUEST');
        expect(repository.readSessionRelationshipCommunication).not.toHaveBeenCalled();
      }
    });
  });

  describe('frozen semantic mapping', () => {
    it.each([
      [1, STRUCTURE], [2, STRUCTURE], [3, NONE], [4, NONE], [5, NONE],
    ])('maps KNOWN scale value %i deterministically', async (numericValue, expected) => {
      const { consumption } = service([boundRow(numericValue as number)]);
      await expect(consumption.read(USER, 'token', SESSION)).resolves.toEqual(expected);
    });

    it('maps 1 and 2 to the IDENTICAL bounded directive: VERY_LOW never amplifies LOW', async () => {
      const veryLow = await service([boundRow(1)]).consumption.read(USER, 'token', SESSION);
      const low = await service([boundRow(2)]).consumption.read(USER, 'token', SESSION);
      expect(veryLow).toEqual(low);
      expect(veryLow).toEqual(STRUCTURE);
    });

    it('never upshifts: no favorable value produces any directive other than DEFAULT/NONE', async () => {
      for (const numericValue of [3, 4, 5]) {
        const guidance = await service([boundRow(numericValue)]).consumption.read(USER, 'token', SESSION);
        expect(guidance).toEqual(NONE);
        expect(guidance.directive).toBe('DEFAULT');
      }
    });

    it('exposes exactly one non-default directive: there is no second, stronger, or opposite direction', () => {
      const types = readFileSync(`${__dirname}/him-relationship-communication-consumption.types.ts`, 'utf8');
      const directiveLine = types.split('\n').find((line) => line.startsWith('export type HimRelationshipCommunicationDirective'));
      expect(directiveLine).toBe("export type HimRelationshipCommunicationDirective = 'DEFAULT' | 'STRUCTURE_RELATIONSHIP_COMMUNICATION';");
    });

    it('treats an authoritative UNKNOWN (no canonical current value) as no effect', async () => {
      await expect(service([boundRow(null)]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(NONE);
    });

    it('treats an UNASSESSED latest value as no effect, never as a low value', async () => {
      // TOO_TOPIC_DEPENDENT_TO_RATE, INSUFFICIENT_BASIS_TO_JUDGE and NOT_SURE
      // all reach the consumer as an UNASSESSED canonical value. None of them
      // may ever be coerced into 1, 2, 3, zero, or an inferred midpoint.
      const row = { ...boundRow(2), value_state: 'UNASSESSED', numeric_value: null, canonical_binding_id: null } as unknown as HimRelationshipCommunicationSourceRow;
      await expect(service([row]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(NONE);
    });

    it('treats an INVALIDATED latest value as no effect', async () => {
      const row = { ...boundRow(1), validity_status: 'INVALIDATED' } as unknown as HimRelationshipCommunicationSourceRow;
      await expect(service([row]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(NONE);
    });

    it('treats an incompatible ACTIVE measurement binding as no effect - the QHIA-004 rule stays delegated', async () => {
      const row = { ...boundRow(1), active_binding_id: OTHER_BINDING } as unknown as HimRelationshipCommunicationSourceRow;
      await expect(service([row]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(NONE);
    });

    it('returns the deterministic no-effect result when no ACTIVE Relationship is bound', async () => {
      await expect(service([unboundRow()]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(NONE);
    });

    it('performs no arithmetic, severity stacking, trend, baseline, decay, or confidence inference', async () => {
      const { consumption } = service([boundRow(1)]);
      const first = await consumption.read(USER, 'token', SESSION);
      const second = await consumption.read(USER, 'token', SESSION);
      expect(first).toEqual(second);
      expect(first).toEqual(STRUCTURE);
      const source = readFileSync(`${__dirname}/him-relationship-communication-consumption.service.ts`, 'utf8');
      const executable = source.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
      for (const forbidden of ['+', '*', 'Math.', 'reduce(', 'average', 'trend', 'baseline', 'decay', 'previous', 'history']) {
        expect(executable).not.toContain(forbidden);
      }
    });

    it('emits only the two frozen guidance shapes and never leaks a value, id, relationship label, or provenance', async () => {
      for (const rows of [[unboundRow()], [boundRow(1)], [boundRow(4)], [boundRow(null)]]) {
        const guidance = await service(rows).consumption.read(USER, 'token', SESSION);
        expect(Object.keys(guidance).sort()).toEqual(['contractVersion', 'directive', 'guidanceState']);
        const serialized = JSON.stringify(guidance);
        for (const forbidden of [RELATIONSHIP, SESSION, USER, BINDING, 'hrs.communication', 'RELATIONSHIP_BOUND', 'VERY_LOW', '2026-08-29']) {
          expect(serialized).not.toContain(forbidden);
        }
      }
    });
  });

  describe('exact frozen semantic identity (adversarial)', () => {
    // The shared QHIA-004 projection is generic on purpose: it accepts an
    // UNRESOLVED definition with a null semanticType AND a RESOLVED definition
    // with ANY non-null semanticType, because both are legitimate somewhere in
    // the canonical 17. A row can therefore be INTERNALLY COHERENT - definition
    // and source semantic metadata agree, the ACTIVE canonical binding is
    // valid, the value is a KNOWN 1 or 2 - and still not be an
    // hrs.communication@1 reading at all. Canonical Communication carries NO
    // Foundation semantic type, so a coherent RESOLVED / STATE or
    // RESOLVED / CAPABILITY row carrying a low ordinal is precisely the drift
    // that must never become communication-scaffolding guidance.
    const semanticallyDrifted = (semanticType: string, numericValue: number): HimRelationshipCommunicationSourceRow => ({
      ...boundRow(numericValue),
      semantic_mapping_status: 'RESOLVED',
      semantic_type: semanticType,
      source_semantic_mapping_status: numericValue === null ? null : 'RESOLVED',
      source_semantic_type: semanticType,
    } as unknown as HimRelationshipCommunicationSourceRow);

    it.each([
      ['STATE', 1], ['STATE', 2],
      ['ALIGNMENT', 1], ['ALIGNMENT', 2],
      ['TRAIT', 1], ['TRAIT', 2],
      ['READINESS', 1], ['READINESS', 2],
      ['CAPABILITY', 1], ['CAPABILITY', 2],
      ['UNCERTAINTY', 1], ['UNCERTAINTY', 2],
      ['PROGRESS', 1], ['PROGRESS', 2],
      ['LOAD', 1], ['LOAD', 2],
    ])(
      'rejects a coherent RESOLVED / %s row carrying a KNOWN %i and never yields STRUCTURE_RELATIONSHIP_COMMUNICATION',
      async (semanticType, numericValue) => {
        const row = semanticallyDrifted(semanticType as string, numericValue as number);
        // The row really is internally coherent: definition and source semantic
        // metadata agree, the binding identity is valid and ACTIVE, and the
        // value is exactly the one that would otherwise map to the bounded
        // scaffolding.
        expect(row.semantic_mapping_status).toBe(row.source_semantic_mapping_status);
        expect(row.semantic_type).toBe(row.source_semantic_type);
        expect(row.canonical_binding_id).toBe(row.active_binding_id);
        expect(row.numeric_value).toBe(numericValue);
        const { repository, consumption } = service([row]);
        await expect(consumption.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
        expect(repository.readSessionRelationshipCommunication).toHaveBeenCalledTimes(1);
      },
    );

    it('never produces guidance for ANY resolved semantic reading, at any scale value', async () => {
      for (const semanticType of ['STATE', 'ALIGNMENT', 'TRAIT', 'CAPABILITY', 'READINESS', 'UNCERTAINTY', 'PROGRESS', 'LOAD']) {
        for (const numericValue of [1, 2, 3, 4, 5]) {
          const { consumption } = service([semanticallyDrifted(semanticType, numericValue)]);
          // Fail-closed, not merely "no ACTIVE guidance": a drifted reading is
          // never silently normalised into the harmless NONE result either.
          await expect(consumption.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
        }
      }
    });

    it('rejects a non-null semantic type even while the mapping status still says UNRESOLVED', async () => {
      // The shared projection already rejects this incoherent pair; the point
      // here is that the QHIA-011 boundary never sees a typed reading either
      // way.
      const row = { ...boundRow(1), semantic_type: 'STATE' } as unknown as HimRelationshipCommunicationSourceRow;
      await expect(service([row]).consumption.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
    });

    it('rejects a drifted semantic reading on the UNKNOWN routes too, never mapping it to a benign NONE', async () => {
      const unknownRoutes = [
        { ...semanticallyDrifted('STATE', 1), validity_status: 'INVALIDATED' },
        { ...semanticallyDrifted('CAPABILITY', 2), value_state: 'UNASSESSED', numeric_value: null, canonical_binding_id: null },
        { ...semanticallyDrifted('READINESS', 2), active_binding_id: OTHER_BINDING },
      ];
      for (const row of unknownRoutes) {
        const { consumption } = service([row as unknown as HimRelationshipCommunicationSourceRow]);
        await expect(consumption.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
      }
    });

    it('ACCEPTS the expected canonical HRS / UNRESOLVED / NULL identity: it is valid, not a defect', async () => {
      const known = boundRow(1);
      expect(known.hif_owner).toBe('HRS');
      expect(known.semantic_mapping_status).toBe('UNRESOLVED');
      expect(known.semantic_type).toBeNull();
      await expect(service([known]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(STRUCTURE);
      await expect(service([boundRow(2)]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(STRUCTURE);
      await expect(service([boundRow(3)]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(NONE);
      await expect(service([boundRow(null)]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(NONE);
    });

    it('leaves the SHARED QHIA-004 projection generic: it still accepts the semantic readings it is designed for', () => {
      // Anti-over-fix control. The guard above must live at the QHIA-011
      // boundary ONLY. If it had been pushed down into the shared projection,
      // these legitimate rows - a RESOLVED / ALIGNMENT GOAL metric and a
      // RESOLVED / STATE HSE metric - would start failing, and every other HIM
      // consumer with them.
      const alignmentRow = {
        ...boundRow(4),
        metric_key: 'hgs.purpose-alignment', hif_owner: 'HGS',
        semantic_mapping_status: 'RESOLVED', semantic_type: 'ALIGNMENT',
        source_metric_key: 'hgs.purpose-alignment',
        source_semantic_mapping_status: 'RESOLVED', source_semantic_type: 'ALIGNMENT',
        valid_context_kinds: ['GOAL'], context_kind: 'GOAL', source_context_kind: 'GOAL',
      } as unknown as HimRelationshipCommunicationSourceRow;
      expect(projectHimContextualCurrentSlot(alignmentRow, 'hgs.purpose-alignment', 1, 'GOAL', RELATIONSHIP))
        .toMatchObject({
          metricKey: 'hgs.purpose-alignment', hifOwner: 'HGS',
          semanticMappingStatus: 'RESOLVED', semanticType: 'ALIGNMENT',
          knowledgeState: 'KNOWN', numericValue: 4,
        });

      const stateRow = {
        ...boundRow(2),
        metric_key: 'hse.stress', hif_owner: 'HSE',
        semantic_mapping_status: 'RESOLVED', semantic_type: 'STATE',
        source_metric_key: 'hse.stress',
        source_semantic_mapping_status: 'RESOLVED', source_semantic_type: 'STATE',
        valid_context_kinds: ['SITUATION'], context_kind: 'SITUATION', source_context_kind: 'SITUATION',
      } as unknown as HimRelationshipCommunicationSourceRow;
      expect(projectHimContextualCurrentSlot(stateRow, 'hse.stress', 1, 'SITUATION', RELATIONSHIP))
        .toMatchObject({
          metricKey: 'hse.stress', hifOwner: 'HSE',
          semanticMappingStatus: 'RESOLVED', semanticType: 'STATE',
          knowledgeState: 'KNOWN', numericValue: 2,
        });

      // And the same generic projection accepts the drifted hrs.communication
      // row the QHIA-011 boundary rejects - proving the rejection is the
      // CONSUMER's bound, not a change to the shared contract.
      expect(projectHimContextualCurrentSlot(semanticallyDrifted('STATE', 1), 'hrs.communication', 1, 'RELATIONSHIP', RELATIONSHIP))
        .toMatchObject({ knowledgeState: 'KNOWN', numericValue: 1, semanticType: 'STATE' });
    });
  });

  describe('fail-closed integrity', () => {
    const failsClosed = async (rows: unknown) => {
      const { consumption } = service(rows);
      await expect(consumption.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
    };

    it('rejects a non-array, empty, or multi-row payload: the composition always answers with exactly one row', async () => {
      await failsClosed(undefined);
      await failsClosed(null);
      await failsClosed([]);
      await failsClosed([unboundRow(), unboundRow()]);
      await failsClosed([boundRow(1), boundRow(1)]);
      await failsClosed([null]);
    });

    it('rejects an unknown or malformed binding_state rather than defaulting it to bound or unbound', async () => {
      for (const bindingState of ['BOUND', 'ACTIVE', 'INFERRED_RELATIONSHIP', 'ACTIVE_SITUATION_BOUND', 'ACTIVE_DECISION_BOUND', 'ACTIVE_GOAL_BOUND', 'NO_ACTIVE_GOAL', '', null, undefined]) {
        await failsClosed([{ ...unboundRow(), binding_state: bindingState }]);
      }
    });

    it('rejects an UNBOUND answer that still carries any metric or binding fragment', async () => {
      for (const fragment of [
        { binding_context_id: RELATIONSHIP }, { metric_key: 'hrs.communication' }, { numeric_value: 1 },
        { has_canonical_current_value: false }, { context_kind: 'RELATIONSHIP' }, { context_id: RELATIONSHIP },
        { canonical_binding_id: BINDING }, { active_binding_id: BINDING }, { observed_at: '2026-08-29T00:00:00.000Z' },
      ]) await failsClosed([{ ...unboundRow(), ...fragment }]);
    });

    it('rejects a BOUND answer whose delegated row answers for another metric, version, owner, kind, or context', async () => {
      for (const drift of [
        // The three sibling HRS metrics of the SAME context kind are the most
        // dangerous drift of all: each is measurement-valid on exactly this
        // relationship, so the row would otherwise look structurally perfect.
        { metric_key: 'hrs.relationship-trust', source_metric_key: 'hrs.relationship-trust' },
        { metric_key: 'hrs.repair', source_metric_key: 'hrs.repair' },
        { metric_key: 'hrs.emotional-safety', source_metric_key: 'hrs.emotional-safety' },
        { metric_key: 'hse.stress' }, { metric_key: 'hse.motivation' },
        { definition_version: 2 }, { hif_owner: 'HSE' }, { hif_owner: 'HBS' }, { hif_owner: 'HGS' },
        { context_kind: 'SITUATION', source_context_kind: 'SITUATION' },
        { context_kind: 'CONVERSATION_SESSION' }, { context_kind: 'DECISION' }, { context_kind: 'GOAL' },
        { context_id: OTHER_RELATIONSHIP }, { slot_order: 2 },
        { valid_context_kinds: ['SITUATION'] }, { calculation_status: 'UNCALIBRATED' },
        { semantic_mapping_status: 'RESOLVED', semantic_type: 'STATE', source_semantic_mapping_status: 'RESOLVED', source_semantic_type: 'STATE' },
      ]) await failsClosed([{ ...boundRow(1), ...drift }]);
    });

    it('rejects a BOUND answer with a missing or malformed authoritative Relationship identity', async () => {
      for (const bindingContextId of [null, undefined, '', 'not-a-uuid', 12]) {
        await failsClosed([{ ...boundRow(1), binding_context_id: bindingContextId }]);
      }
    });

    it('rejects a BOUND answer whose delegated canonical row answers for a different Relationship than the bound one', async () => {
      await failsClosed([{ ...boundRow(1), source_context_id: OTHER_RELATIONSHIP }]);
      await failsClosed([{ ...boundRow(1), source_context_kind: 'SITUATION' }]);
      await failsClosed([{ ...boundRow(1), binding_context_id: OTHER_RELATIONSHIP, context_id: OTHER_RELATIONSHIP }]);
    });

    it('rejects an out-of-scale, fractional, or absent KNOWN value rather than clamping it', async () => {
      for (const numericValue of [0, 6, -1, 1.5, null, '1']) {
        await failsClosed([{ ...boundRow(1), numeric_value: numericValue }]);
      }
    });

    it('rejects an ASSESSED row that carries no ACTIVE canonical binding identity', async () => {
      await failsClosed([{ ...boundRow(1), active_binding_id: null }]);
      await failsClosed([{ ...boundRow(1), canonical_binding_id: null }]);
      await failsClosed([{ ...boundRow(1), canonical_binding_id: 'not-a-uuid' }]);
    });

    it('propagates a repository failure so the caller degrades it and telemetry stays honest', async () => {
      const repository = { readSessionRelationshipCommunication: jest.fn().mockRejectedValue(new Error('private transport failure')) };
      const consumption = new HimRelationshipCommunicationConsumptionService(repository as never);
      await expect(consumption.read(USER, 'token', SESSION)).rejects.toThrow('private transport failure');
    });
  });

  describe('scope discipline', () => {
    it('activates exactly RELATIONSHIP + hrs.communication@1 and reaches no other context, metric, or authority', () => {
      const source = readFileSync(`${__dirname}/him-relationship-communication-consumption.service.ts`, 'utf8');
      const types = readFileSync(`${__dirname}/him-relationship-communication-consumption.types.ts`, 'utf8');
      const executable = [source, types].join('\n').split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*')).join('\n');
      expect(executable).toContain("'RELATIONSHIP'");
      expect(executable).toContain("'hrs.communication'");
      for (const forbidden of [
        "'SITUATION'", "'DECISION'", "'GOAL'", "'GLOBAL'", "'CONVERSATION_SESSION'",
        'hrs.relationship-trust', 'hrs.repair', 'hrs.emotional-safety',
        'hse.', 'hbs.', 'hgs.',
        'HimSessionContextBindingRepository', 'HimSessionContextBindingService', 'HimRepository',
        'HimSituationStressRepository', 'HimSituationStressConsumptionService',
        'HimDecisionAttentionRepository', 'HimDecisionAttentionConsumptionService',
        'HimGoalMotivationRepository', 'HimGoalMotivationConsumptionService',
        'HimTrend', 'setTimeout', 'setInterval', 'Date.now', 'cache', 'openai', 'anthropic', 'embedding',
      ]) expect(executable).not.toContain(forbidden);
      // Read-only: the boundary owns no write, mutation, or persistence path.
      expect(executable).not.toMatch(/\.(?:set|write|insert|update|delete|persist)Binding|createBinding/u);
    });

    it('keeps the three sibling HRS metrics dormant across the whole QHIA-011 boundary', () => {
      // The other three valid metrics of this same context kind appear nowhere
      // executable in this task's own application surface - not as a constant,
      // a request, a fallback, or an inference from the Communication reading.
      for (const file of [
        'him-relationship-communication-consumption.service.ts',
        'him-relationship-communication-consumption.types.ts',
        'him-relationship-communication.repository.ts',
      ]) {
        const executable = readFileSync(`${__dirname}/${file}`, 'utf8')
          .split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*')).join('\n');
        for (const forbidden of ['relationship-trust', 'hrs.repair', 'emotional-safety', 'relationshipTrust', 'emotionalSafety']) {
          expect(executable).not.toContain(forbidden);
        }
      }
    });

    it('reuses the shared frozen QHIA-004 projection instead of duplicating current-intelligence validation', () => {
      const source = readFileSync(`${__dirname}/him-relationship-communication-consumption.service.ts`, 'utf8');
      expect(source).toContain('projectHimContextualCurrentSlot');
      expect(source).toContain("from './him-contextual-current-projection'");
      // The divergent-copy smells the contract forbids: no second canonical
      // latest selection, no second ACTIVE-binding comparison, no second
      // UNKNOWN-reason vocabulary.
      expect(source).not.toContain('NO_CANONICAL_CURRENT_VALUE');
      expect(source).not.toContain('LATEST_VALUE_INVALIDATED');
      expect(source).not.toContain('INCOMPATIBLE_ACTIVE_BINDING');
      // And the shared projection itself is untouched by this task: it gained
      // no Relationship-specific rule, no Communication metric identity, and no
      // consumer-level semantic bound. The negatives run on EXECUTABLE source
      // only, exactly as the repository's other source-scanning guards do - the
      // projection's own prose legitimately explains the semantic readings it
      // deliberately does NOT constrain.
      const projectionExecutable = readFileSync(`${__dirname}/him-contextual-current-projection.ts`, 'utf8')
        .split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*')).join('\n');
      for (const forbidden of ['hrs.communication', 'RelationshipCommunication', 'STRUCTURE_RELATIONSHIP_COMMUNICATION', "'RELATIONSHIP'", 'HRS']) {
        expect(projectionExecutable).not.toContain(forbidden);
      }
    });

    it('leaves the QHIA-007, QHIA-008 and QHIA-010 boundaries byte-identical', () => {
      // No shared abstraction and no edit to the three proven consumers:
      // QHIA-011 adds a fourth narrow boundary beside them.
      for (const [file, marker] of [
        ['him-situation-stress-consumption.service.ts', 'HIM_SITUATION_STRESS_METRIC_KEY'],
        ['him-decision-attention-consumption.service.ts', 'HIM_DECISION_ATTENTION_METRIC_KEY'],
        ['him-goal-motivation-consumption.service.ts', 'HIM_GOAL_MOTIVATION_METRIC_KEY'],
      ] as const) {
        const source = readFileSync(`${__dirname}/${file}`, 'utf8');
        expect(source).toContain(marker);
        expect(source).not.toContain('RelationshipCommunication');
        expect(source).not.toContain('hrs.communication');
      }
      const repository = readFileSync(`${__dirname}/him-relationship-communication.repository.ts`, 'utf8');
      expect(repository).toContain("'rpc/read_him_session_relationship_communication_v1'");
    });
  });
});
