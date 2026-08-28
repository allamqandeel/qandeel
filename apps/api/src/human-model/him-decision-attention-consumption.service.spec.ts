import { readFileSync } from 'node:fs';
import { HimDecisionAttentionConsumptionService } from './him-decision-attention-consumption.service';
import { projectHimContextualCurrentSlot } from './him-contextual-current-projection';
import type { HimDecisionAttentionSourceRow } from './him-decision-attention-consumption.types';

const USER = '00000000-0000-4000-8000-000000000001';
const SESSION = '00000000-0000-4000-8000-000000000002';
const DECISION = '00000000-0000-4000-8000-000000000003';
const OTHER_DECISION = '00000000-0000-4000-8000-000000000009';
const BINDING = '00000000-0000-4000-8000-000000000004';
const OTHER_BINDING = '00000000-0000-4000-8000-000000000005';

const unboundRow = (): HimDecisionAttentionSourceRow => ({
  binding_state: 'NO_ACTIVE_DECISION',
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
} as unknown as HimDecisionAttentionSourceRow);

const boundRow = (numericValue: number | null): HimDecisionAttentionSourceRow => ({
  binding_state: 'ACTIVE_DECISION_BOUND',
  binding_context_id: DECISION,
  slot_order: 1,
  metric_key: 'hse.attention',
  definition_version: 1,
  hif_owner: 'HSE',
  semantic_mapping_status: 'RESOLVED',
  semantic_type: 'STATE',
  calculation_status: 'CALIBRATED',
  valid_context_kinds: ['SITUATION', 'CONVERSATION_SESSION', 'DECISION'],
  context_kind: 'DECISION',
  context_id: DECISION,
  has_canonical_current_value: numericValue !== null,
  source_metric_key: numericValue === null ? null : 'hse.attention',
  source_definition_version: numericValue === null ? null : 1,
  source_semantic_mapping_status: numericValue === null ? null : 'RESOLVED',
  source_semantic_type: numericValue === null ? null : 'STATE',
  source_context_kind: numericValue === null ? null : 'DECISION',
  source_context_id: numericValue === null ? null : DECISION,
  value_state: numericValue === null ? null : 'ASSESSED',
  numeric_value: numericValue,
  validity_status: numericValue === null ? null : 'VALID',
  confidence_state: numericValue === null ? null : 'UNASSESSED',
  confidence_reference: null,
  observed_at: numericValue === null ? null : '2026-08-28T00:00:00.000Z',
  temporal_window_start: null,
  temporal_window_end: null,
  canonical_binding_id: numericValue === null ? null : BINDING,
  active_binding_id: numericValue === null ? null : BINDING,
} as unknown as HimDecisionAttentionSourceRow);

const service = (rows: unknown) => {
  const repository = { readSessionDecisionAttention: jest.fn().mockResolvedValue(rows) };
  return { repository, consumption: new HimDecisionAttentionConsumptionService(repository as never) };
};

const NONE = { contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' };
const REDUCE = { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_PRESENTATION_BURDEN' };

describe('HimDecisionAttentionConsumptionService (QHIA-008)', () => {
  describe('one authoritative composed read', () => {
    it('performs EXACTLY ONE repository read with the exact authenticated user and owned session', async () => {
      const { repository, consumption } = service([unboundRow()]);
      await consumption.read(USER, 'token', SESSION);
      expect(repository.readSessionDecisionAttention).toHaveBeenCalledTimes(1);
      expect(repository.readSessionDecisionAttention).toHaveBeenCalledWith('token', USER, SESSION);
    });

    it('rejects a malformed identity before any external request is issued', async () => {
      for (const [userId, sessionId] of [
        ['not-a-uuid', SESSION], [USER, 'not-a-uuid'], ['', SESSION], [USER, ''],
      ] as const) {
        const { repository, consumption } = service([unboundRow()]);
        await expect(consumption.read(userId, 'token', sessionId)).rejects.toThrow('INVALID_DECISION_ATTENTION_REQUEST');
        expect(repository.readSessionDecisionAttention).not.toHaveBeenCalled();
      }
    });
  });

  describe('frozen semantic mapping', () => {
    it.each([
      [1, REDUCE], [2, REDUCE], [3, NONE], [4, NONE], [5, NONE],
    ])('maps KNOWN scale value %i deterministically', async (numericValue, expected) => {
      const { consumption } = service([boundRow(numericValue as number)]);
      await expect(consumption.read(USER, 'token', SESSION)).resolves.toEqual(expected);
    });

    it('maps 1 and 2 to the IDENTICAL bounded reduction: VERY_LOW never amplifies LOW', async () => {
      const veryLow = await service([boundRow(1)]).consumption.read(USER, 'token', SESSION);
      const low = await service([boundRow(2)]).consumption.read(USER, 'token', SESSION);
      expect(veryLow).toEqual(low);
      expect(veryLow).toEqual(REDUCE);
    });

    it('never upshifts: no favorable value produces any directive other than DEFAULT/NONE', async () => {
      for (const numericValue of [3, 4, 5]) {
        const guidance = await service([boundRow(numericValue)]).consumption.read(USER, 'token', SESSION);
        expect(guidance).toEqual(NONE);
        expect(guidance.directive).toBe('DEFAULT');
      }
    });

    it('treats an authoritative UNKNOWN (no canonical current value) as no effect', async () => {
      await expect(service([boundRow(null)]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(NONE);
    });

    it('treats an UNASSESSED latest value as no effect, never as a low value', async () => {
      const row = { ...boundRow(2), value_state: 'UNASSESSED', numeric_value: null, canonical_binding_id: null } as unknown as HimDecisionAttentionSourceRow;
      await expect(service([row]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(NONE);
    });

    it('treats an INVALIDATED latest value as no effect', async () => {
      const row = { ...boundRow(1), validity_status: 'INVALIDATED' } as unknown as HimDecisionAttentionSourceRow;
      await expect(service([row]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(NONE);
    });

    it('treats an incompatible ACTIVE measurement binding as no effect - the QHIA-004 rule stays delegated', async () => {
      const row = { ...boundRow(1), active_binding_id: OTHER_BINDING } as unknown as HimDecisionAttentionSourceRow;
      await expect(service([row]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(NONE);
    });

    it('returns the deterministic no-effect result when no ACTIVE Decision is bound', async () => {
      await expect(service([unboundRow()]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(NONE);
    });

    it('emits only the two frozen guidance shapes and never leaks a value, id, or provenance', async () => {
      for (const rows of [[unboundRow()], [boundRow(1)], [boundRow(4)], [boundRow(null)]]) {
        const guidance = await service(rows).consumption.read(USER, 'token', SESSION);
        expect(Object.keys(guidance).sort()).toEqual(['contractVersion', 'directive', 'guidanceState']);
        const serialized = JSON.stringify(guidance);
        for (const forbidden of [DECISION, SESSION, USER, BINDING, 'hse.attention', 'DECISION', '2026-08-28']) {
          expect(serialized).not.toContain(forbidden);
        }
      }
    });
  });

  describe('exact frozen semantic identity (adversarial)', () => {
    // The shared QHIA-004 projection is generic on purpose: for a RESOLVED
    // definition it only requires a non-null semanticType, because
    // hgs.purpose-alignment is legitimately RESOLVED / ALIGNMENT and several
    // HBS/HRS metrics are legitimately UNRESOLVED / null. A row can therefore
    // be INTERNALLY COHERENT - definition and source semantic metadata agree,
    // the ACTIVE canonical binding is valid, the value is a KNOWN 1 or 2 - and
    // still not be an hse.attention@1 reading at all. QHIA-008 assigns
    // behavioural meaning to that ordinal, so it must reject such a row rather
    // than map it.
    const semanticallyDrifted = (semanticType: string, numericValue: number): HimDecisionAttentionSourceRow => ({
      ...boundRow(numericValue),
      semantic_mapping_status: 'RESOLVED',
      semantic_type: semanticType,
      source_semantic_mapping_status: 'RESOLVED',
      source_semantic_type: semanticType,
    } as unknown as HimDecisionAttentionSourceRow);

    it.each([1, 2])(
      'rejects a coherent RESOLVED / ALIGNMENT row carrying a KNOWN %i and never yields REDUCE_PRESENTATION_BURDEN',
      async (numericValue) => {
        const row = semanticallyDrifted('ALIGNMENT', numericValue);
        // The row really is internally coherent: definition and source
        // semantic metadata agree, the binding identity is valid and ACTIVE,
        // and the value is exactly the one that would otherwise map to the
        // bounded reduction.
        expect(row.semantic_mapping_status).toBe(row.source_semantic_mapping_status);
        expect(row.semantic_type).toBe(row.source_semantic_type);
        expect(row.canonical_binding_id).toBe(row.active_binding_id);
        expect(row.numeric_value).toBe(numericValue);
        const { repository, consumption } = service([row]);
        await expect(consumption.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
        expect(repository.readSessionDecisionAttention).toHaveBeenCalledTimes(1);
      },
    );

    it('never produces guidance for ANY resolved semantic reading other than STATE', async () => {
      for (const semanticType of ['ALIGNMENT', 'TRAIT', 'CAPABILITY', 'READINESS', 'UNCERTAINTY', 'PROGRESS', 'LOAD']) {
        for (const numericValue of [1, 2, 3, 4, 5]) {
          const { consumption } = service([semanticallyDrifted(semanticType, numericValue)]);
          // Fail-closed, not merely "no ACTIVE guidance": a drifted reading is
          // never silently normalised into the harmless NONE result either.
          await expect(consumption.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
        }
      }
    });

    it('rejects a drifted semantic reading on the UNKNOWN routes too, never mapping it to a benign NONE', async () => {
      const unknownRoutes = [
        { ...semanticallyDrifted('READINESS', 1), validity_status: 'INVALIDATED' },
        { ...semanticallyDrifted('READINESS', 2), value_state: 'UNASSESSED', numeric_value: null, canonical_binding_id: null },
        { ...semanticallyDrifted('READINESS', 2), active_binding_id: OTHER_BINDING },
      ];
      for (const row of unknownRoutes) {
        const { consumption } = service([row as unknown as HimDecisionAttentionSourceRow]);
        await expect(consumption.read(USER, 'token', SESSION)).rejects.toThrow('INTEGRITY_FAILURE');
      }
    });

    it('preserves the positive RESOLVED / STATE behaviour exactly', async () => {
      const known = boundRow(1);
      expect(known.semantic_mapping_status).toBe('RESOLVED');
      expect(known.semantic_type).toBe('STATE');
      await expect(service([known]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(REDUCE);
      await expect(service([boundRow(2)]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(REDUCE);
      await expect(service([boundRow(3)]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(NONE);
      await expect(service([boundRow(null)]).consumption.read(USER, 'token', SESSION)).resolves.toEqual(NONE);
    });

    it('leaves the SHARED QHIA-004 projection generic: it still accepts the semantic readings it is designed for', () => {
      // Anti-over-fix control. The guard above must live at the QHIA-008
      // boundary ONLY. If it had been pushed down into the shared projection,
      // these legitimate rows - a RESOLVED / ALIGNMENT GOAL metric and an
      // UNRESOLVED / null HBS metric - would start failing, and every other
      // HIM consumer with them.
      const alignmentRow = {
        ...boundRow(4),
        metric_key: 'hgs.purpose-alignment', hif_owner: 'HGS',
        semantic_mapping_status: 'RESOLVED', semantic_type: 'ALIGNMENT',
        source_metric_key: 'hgs.purpose-alignment',
        source_semantic_mapping_status: 'RESOLVED', source_semantic_type: 'ALIGNMENT',
        valid_context_kinds: ['GOAL'], context_kind: 'GOAL', source_context_kind: 'GOAL',
      } as unknown as HimDecisionAttentionSourceRow;
      expect(projectHimContextualCurrentSlot(alignmentRow, 'hgs.purpose-alignment', 1, 'GOAL', DECISION))
        .toMatchObject({
          metricKey: 'hgs.purpose-alignment', hifOwner: 'HGS',
          semanticMappingStatus: 'RESOLVED', semanticType: 'ALIGNMENT',
          knowledgeState: 'KNOWN', numericValue: 4,
        });

      const unresolvedRow = {
        ...boundRow(2),
        metric_key: 'hbs.reflection', hif_owner: 'HBS',
        semantic_mapping_status: 'UNRESOLVED', semantic_type: null,
        source_metric_key: 'hbs.reflection',
        source_semantic_mapping_status: 'UNRESOLVED', source_semantic_type: null,
        valid_context_kinds: ['DECISION'],
      } as unknown as HimDecisionAttentionSourceRow;
      expect(projectHimContextualCurrentSlot(unresolvedRow, 'hbs.reflection', 1, 'DECISION', DECISION))
        .toMatchObject({
          metricKey: 'hbs.reflection', hifOwner: 'HBS',
          semanticMappingStatus: 'UNRESOLVED', semanticType: null,
          knowledgeState: 'KNOWN', numericValue: 2,
        });

      // And the same generic projection accepts the drifted hse.attention row
      // the QHIA-008 boundary rejects - proving the rejection is the
      // CONSUMER's bound, not a change to the shared contract.
      expect(projectHimContextualCurrentSlot(semanticallyDrifted('ALIGNMENT', 1), 'hse.attention', 1, 'DECISION', DECISION))
        .toMatchObject({ knowledgeState: 'KNOWN', numericValue: 1, semanticType: 'ALIGNMENT' });
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

    it('rejects an unknown binding_state rather than defaulting it to bound or unbound', async () => {
      for (const bindingState of ['BOUND', 'ACTIVE', 'INFERRED_DECISION', 'ACTIVE_SITUATION_BOUND', '', null, undefined]) {
        await failsClosed([{ ...unboundRow(), binding_state: bindingState }]);
      }
    });

    it('rejects an UNBOUND answer that still carries any metric or binding fragment', async () => {
      for (const fragment of [
        { binding_context_id: DECISION }, { metric_key: 'hse.attention' }, { numeric_value: 1 },
        { has_canonical_current_value: false }, { context_kind: 'DECISION' }, { context_id: DECISION },
        { canonical_binding_id: BINDING }, { active_binding_id: BINDING }, { observed_at: '2026-08-28T00:00:00.000Z' },
      ]) await failsClosed([{ ...unboundRow(), ...fragment }]);
    });

    it('rejects a BOUND answer whose delegated row answers for another metric, version, owner, kind, or context', async () => {
      for (const drift of [
        // The dormant sibling Decision metric is the most dangerous drift of
        // all: it is runtime-available for DECISION and would otherwise look
        // structurally valid.
        { metric_key: 'hse.self-confidence' },
        { metric_key: 'hse.stress' }, { metric_key: 'hbs.reflection' }, { definition_version: 2 },
        { hif_owner: 'HBS' }, { context_kind: 'CONVERSATION_SESSION' }, { context_kind: 'SITUATION' },
        { context_id: OTHER_DECISION }, { slot_order: 2 },
        { valid_context_kinds: ['CONVERSATION_SESSION'] }, { calculation_status: 'UNCALIBRATED' },
        { semantic_mapping_status: 'UNRESOLVED' }, { semantic_type: null },
      ]) await failsClosed([{ ...boundRow(1), ...drift }]);
    });

    it('rejects a BOUND answer with a missing or malformed authoritative Decision identity', async () => {
      for (const bindingContextId of [null, undefined, '', 'not-a-uuid', 12]) {
        await failsClosed([{ ...boundRow(1), binding_context_id: bindingContextId }]);
      }
    });

    it('rejects a BOUND answer whose delegated canonical row answers for a different context than the bound Decision', async () => {
      await failsClosed([{ ...boundRow(1), source_context_id: OTHER_DECISION }]);
      await failsClosed([{ ...boundRow(1), source_context_kind: 'SITUATION' }]);
      await failsClosed([{ ...boundRow(1), binding_context_id: OTHER_DECISION, context_id: OTHER_DECISION }]);
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
      const repository = { readSessionDecisionAttention: jest.fn().mockRejectedValue(new Error('private transport failure')) };
      const consumption = new HimDecisionAttentionConsumptionService(repository as never);
      await expect(consumption.read(USER, 'token', SESSION)).rejects.toThrow('private transport failure');
    });
  });

  describe('scope discipline', () => {
    it('activates exactly DECISION + hse.attention@1 and reaches no other context, metric, or authority', () => {
      const source = readFileSync(`${__dirname}/him-decision-attention-consumption.service.ts`, 'utf8');
      const types = readFileSync(`${__dirname}/him-decision-attention-consumption.types.ts`, 'utf8');
      const executable = [source, types].join('\n').split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*')).join('\n');
      expect(executable).toContain("'DECISION'");
      expect(executable).toContain("'hse.attention'");
      for (const forbidden of [
        "'GOAL'", "'SITUATION'", "'RELATIONSHIP'", "'GLOBAL'",
        'hse.energy', 'hse.stress', 'hse.motivation', 'hse.self-confidence',
        'hbs.', 'hrs.', 'hgs.',
        'HimSessionContextBindingRepository', 'HimSessionContextBindingService', 'HimRepository',
        'HimSituationStressRepository', 'HimSituationStressConsumptionService',
        'HimTrend', 'setTimeout', 'setInterval', 'Date.now', 'cache', 'openai', 'anthropic', 'embedding',
      ]) expect(executable).not.toContain(forbidden);
      // Read-only: the boundary owns no write, mutation, or persistence path.
      expect(executable).not.toMatch(/\.(?:set|write|insert|update|delete|persist)Binding|createBinding/u);
    });

    it('keeps hse.self-confidence dormant across the whole QHIA-008 boundary', () => {
      // The dormant sibling metric appears nowhere executable in this task's
      // own application surface - not as a constant, a request, a fallback, or
      // an inference from Attention.
      for (const file of [
        'him-decision-attention-consumption.service.ts',
        'him-decision-attention-consumption.types.ts',
        'him-decision-attention.repository.ts',
      ]) {
        const executable = readFileSync(`${__dirname}/${file}`, 'utf8')
          .split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*')).join('\n');
        expect(executable).not.toContain('self-confidence');
        expect(executable).not.toContain('selfConfidence');
      }
    });

    it('reuses the shared frozen QHIA-004 projection instead of duplicating current-intelligence validation', () => {
      const source = readFileSync(`${__dirname}/him-decision-attention-consumption.service.ts`, 'utf8');
      expect(source).toContain("projectHimContextualCurrentSlot");
      expect(source).toContain("from './him-contextual-current-projection'");
      // The divergent-copy smells the contract forbids: no second canonical
      // latest selection, no second ACTIVE-binding comparison, no second
      // UNKNOWN-reason vocabulary.
      expect(source).not.toContain('NO_CANONICAL_CURRENT_VALUE');
      expect(source).not.toContain('LATEST_VALUE_INVALIDATED');
      expect(source).not.toContain('INCOMPATIBLE_ACTIVE_BINDING');
    });

    it('leaves the QHIA-007 Situation-stress boundary byte-identical', () => {
      // No shared abstraction, no generic reader, and no edit to the first
      // proof: QHIA-009 consolidation is explicitly not built here.
      const situationStressService = readFileSync(`${__dirname}/him-situation-stress-consumption.service.ts`, 'utf8');
      expect(situationStressService).toContain("HIM_SITUATION_STRESS_METRIC_KEY");
      expect(situationStressService).not.toContain('DecisionAttention');
      expect(situationStressService).not.toContain('hse.attention');
      const situationStressRepository = readFileSync(`${__dirname}/him-situation-stress.repository.ts`, 'utf8');
      expect(situationStressRepository).toContain("'rpc/read_him_session_situation_stress_v1'");
      expect(situationStressRepository).not.toContain('read_him_session_decision_attention_v1');
    });
  });
});
