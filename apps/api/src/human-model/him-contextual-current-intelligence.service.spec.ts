import { HimContextualCurrentIntelligenceService } from './him-contextual-current-intelligence.service';
import {
  HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS,
  type HimContextualCurrentBatchSourceRow,
  type HimRuntimeCurrentIntelligenceContextKind,
} from './him-contextual-current-intelligence.types';
import { CANONICAL_HIM_V1_METRICS } from './initial-him-metrics.catalog';
import { HimRepository } from './him.repository';
import type { MemoryDataApiService } from '../memory/memory-data-api.service';
import type { HimMetricDefinition } from './him.types';

const SUPPORTED_KINDS = Object.keys(HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS) as HimRuntimeCurrentIntelligenceContextKind[];
const BATCH_RPC = 'rpc/read_him_contextual_current_intelligence_batch_v1';
const definitionFor = (metricKey: string): HimMetricDefinition => {
  const definition = CANONICAL_HIM_V1_METRICS.find((entry) => entry.metricKey === metricKey && entry.definitionVersion === 1);
  if (!definition) throw new Error(`fixture: unknown canonical metric ${metricKey}`);
  return definition;
};
const CONTEXT_IDS: Record<HimRuntimeCurrentIntelligenceContextKind, string> = {
  CONVERSATION_SESSION: '20000000-0000-4000-8000-000000000001',
  SITUATION: 'situation:exact-owned-target-1',
  GOAL: '30000000-0000-4000-8000-000000000003',
  DECISION: '40000000-0000-4000-8000-000000000004',
  RELATIONSHIP: '50000000-0000-4000-8000-000000000005',
};
const bindingFor = (metricKey: string, kind: string): string => {
  const slot = Math.abs([...`${metricKey}|${kind}`].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 7));
  return `b0000000-0000-4000-8000-${String(slot % 1_000_000_000_000).padStart(12, '0')}`;
};

interface Harness {
  // A slot key present in `rows` means the canonical latest authority
  // returned a current row for it (partial fields override the well-formed
  // present-source defaults); an absent slot key means zero canonical rows.
  rows?: Record<string, Partial<HimContextualCurrentBatchSourceRow>>;
  active?: Record<string, string | null>;
  mutateBatch?: (rows: HimContextualCurrentBatchSourceRow[]) => unknown;
}
const batchRowFor = (
  metricKey: string,
  index: number,
  kind: HimRuntimeCurrentIntelligenceContextKind,
  contextId: string,
  harness: Harness,
): HimContextualCurrentBatchSourceRow => {
  const definition = definitionFor(metricKey);
  const active = harness.active && `${metricKey}|${kind}` in harness.active
    ? harness.active[`${metricKey}|${kind}`] : bindingFor(metricKey, kind);
  const base: HimContextualCurrentBatchSourceRow = {
    slot_order: index + 1, metric_key: metricKey, definition_version: 1,
    hif_owner: definition.hifOwner, semantic_mapping_status: definition.semanticMappingStatus,
    semantic_type: definition.semanticType, calculation_status: definition.calculationStatus,
    valid_context_kinds: [...definition.validContextKinds],
    context_kind: kind, context_id: contextId,
    has_canonical_current_value: false,
    source_metric_key: null, source_definition_version: null, source_semantic_mapping_status: null,
    source_semantic_type: null, source_context_kind: null, source_context_id: null,
    value_state: null, numeric_value: null, validity_status: null,
    confidence_state: null, confidence_reference: null,
    observed_at: null, temporal_window_start: null, temporal_window_end: null,
    canonical_binding_id: null, active_binding_id: active,
  };
  const source = harness.rows?.[`${metricKey}|${kind}`];
  if (source === undefined) return base;
  return {
    ...base,
    has_canonical_current_value: true,
    source_metric_key: metricKey, source_definition_version: 1,
    source_semantic_mapping_status: definition.semanticMappingStatus, source_semantic_type: definition.semanticType,
    source_context_kind: kind, source_context_id: contextId,
    value_state: 'ASSESSED', numeric_value: 3, validity_status: 'VALID',
    confidence_state: 'UNASSESSED', confidence_reference: null,
    observed_at: '2026-08-27T00:00:00.000Z', temporal_window_start: null, temporal_window_end: null,
    canonical_binding_id: bindingFor(metricKey, kind),
    ...source,
  };
};
const build = (harness: Harness = {}) => {
  const repository = {
    // The ONLY sanctioned repository surface on the QHIA-004 path: one batch
    // call per contextual read. The mock synthesizes exactly what migration
    // 0054 returns - one row per requested slot in input-ordinal order - and
    // mutateBatch lets integrity tests hand the service a malformed batch.
    readContextualCurrentIntelligenceBatch: jest.fn(
      async (
        _token: string, _userId: string, kind: string, contextId: string,
        metricKeys: readonly string[], definitionVersions: readonly number[],
      ) => {
        expect(definitionVersions).toEqual(metricKeys.map(() => 1));
        const rows = metricKeys.map((metricKey, index) =>
          batchRowFor(metricKey, index, kind as HimRuntimeCurrentIntelligenceContextKind, contextId, harness));
        return (harness.mutateBatch ? harness.mutateBatch(rows) : rows) as HimContextualCurrentBatchSourceRow[];
      }),
    getDefinition: jest.fn(async () => { throw new Error('FORBIDDEN_PER_SLOT_DEFINITION_CALL'); }),
    getLatest: jest.fn(async () => { throw new Error('FORBIDDEN_UNTYPED_LATEST_CALL'); }),
    history: jest.fn(async () => { throw new Error('FORBIDDEN_HISTORY_FALLBACK'); }),
    listForContext: jest.fn(async () => { throw new Error('FORBIDDEN_CONTEXT_LIST_FALLBACK'); }),
    readTrendSource: jest.fn(async () => { throw new Error('FORBIDDEN_TREND_CALL'); }),
    readIntelligenceSnapshot: jest.fn(async () => { throw new Error('FORBIDDEN_SNAPSHOT_CALL'); }),
  };
  return { repository, service: new HimContextualCurrentIntelligenceService(repository as unknown as HimRepository) };
};
const read = (harness: Harness, kind: HimRuntimeCurrentIntelligenceContextKind) => {
  const { repository, service } = build(harness);
  return { repository, result: service.getCurrentIntelligence('user-1', 'token', kind, CONTEXT_IDS[kind]) };
};
const readSelection = (harness: Harness, kind: HimRuntimeCurrentIntelligenceContextKind, requested: readonly string[]) => {
  const { repository, service } = build(harness);
  return { repository, result: service.getCurrentSelection('user-1', 'token', kind, CONTEXT_IDS[kind], requested) };
};
const knownRows = (kind: HimRuntimeCurrentIntelligenceContextKind): Record<string, Partial<HimContextualCurrentBatchSourceRow>> =>
  Object.fromEntries(HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS[kind].map((metricKey) => [`${metricKey}|${kind}`, {}]));

describe('HIM Contextual Current Intelligence v1 (QHIA-003 semantics over QHIA-004 batch transport)', () => {
  describe('frozen runtime slot contract', () => {
    it('freezes the exact slot arrays and their deterministic order', () => {
      expect(HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS.CONVERSATION_SESSION)
        .toEqual(['hse.stress', 'hse.energy', 'hse.attention', 'hbs.reflection']);
      expect(HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS.SITUATION).toEqual([
        'hse.stress', 'hse.motivation', 'hse.self-confidence', 'hse.attention',
        'hbs.avoidance', 'hbs.consistency', 'hbs.initiative', 'hbs.reflection',
        'hgs.self-awareness', 'hgs.resilience', 'hgs.habit-strength',
      ]);
      expect(HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS.GOAL).toEqual([
        'hse.motivation', 'hbs.avoidance', 'hbs.consistency', 'hbs.initiative',
        'hgs.self-awareness', 'hgs.resilience', 'hgs.purpose-alignment', 'hgs.habit-strength',
      ]);
      expect(HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS.DECISION).toEqual(['hse.self-confidence', 'hse.attention']);
      expect(HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS.RELATIONSHIP)
        .toEqual(['hrs.relationship-trust', 'hrs.communication', 'hrs.repair', 'hrs.emotional-safety']);
      expect(Object.keys(HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS).sort())
        .toEqual(['CONVERSATION_SESSION', 'DECISION', 'GOAL', 'RELATIONSHIP', 'SITUATION']);
    });

    it('unions to exactly the 17 unique canonical metric keys with no extra metric', () => {
      const union = Object.values(HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS).flat();
      const unique = [...new Set(union)];
      expect(unique).toHaveLength(17);
      expect([...unique].sort()).toEqual(CANONICAL_HIM_V1_METRICS.map((definition) => definition.metricKey).sort());
    });

    it('leaks no metric into a context its persisted definition does not approve', () => {
      for (const kind of SUPPORTED_KINDS) {
        for (const metricKey of HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS[kind]) {
          expect(definitionFor(metricKey).validContextKinds).toContain(kind);
        }
      }
      for (const definition of CANONICAL_HIM_V1_METRICS) {
        for (const kind of SUPPORTED_KINDS) {
          if (!definition.validContextKinds.includes(kind)) {
            expect(HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS[kind]).not.toContain(definition.metricKey);
          }
        }
      }
    });

    it('rejects GLOBAL and unknown context kinds without any repository work', async () => {
      const { repository, service } = build();
      await expect(service.getCurrentIntelligence('user-1', 'token', 'GLOBAL', 'GLOBAL')).rejects.toThrow('UNSUPPORTED_CONTEXT');
      await expect(service.getCurrentIntelligence('user-1', 'token', 'PROJECT' as never, CONTEXT_IDS.GOAL)).rejects.toThrow('UNSUPPORTED_CONTEXT');
      await expect(service.getCurrentSelection('user-1', 'token', 'GLOBAL', 'GLOBAL', ['hse.stress'])).rejects.toThrow('UNSUPPORTED_CONTEXT');
      expect(repository.readContextualCurrentIntelligenceBatch).not.toHaveBeenCalled();
      expect(repository.getDefinition).not.toHaveBeenCalled();
    });

    it('rejects structurally invalid context identities fail-closed', async () => {
      const { service, repository } = build();
      await expect(service.getCurrentIntelligence('user-1', 'token', 'GOAL', 'not-a-uuid')).rejects.toThrow('INVALID_OR_UNOWNED_CONTEXT');
      await expect(service.getCurrentIntelligence('user-1', 'token', 'CONVERSATION_SESSION', 'GLOBAL')).rejects.toThrow('INVALID_OR_UNOWNED_CONTEXT');
      await expect(service.getCurrentIntelligence('user-1', 'token', 'SITUATION', '')).rejects.toThrow('INVALID_OR_UNOWNED_CONTEXT');
      await expect(service.getCurrentIntelligence('user-1', 'token', 'SITUATION', ` ${CONTEXT_IDS.SITUATION}`)).rejects.toThrow('INVALID_OR_UNOWNED_CONTEXT');
      await expect(service.getCurrentSelection('user-1', 'token', 'GOAL', 'not-a-uuid', ['hse.motivation'])).rejects.toThrow('INVALID_OR_UNOWNED_CONTEXT');
      expect(repository.readContextualCurrentIntelligenceBatch).not.toHaveBeenCalled();
    });
  });

  describe('definition metadata integrity — fail closed', () => {
    // The batch transport returns the exact persisted definition metadata per
    // slot; the projection re-validates it and fails closed on any deviation,
    // exactly as the per-slot QHIA-003 path did.
    const METADATA_MUTATIONS: ReadonlyArray<readonly [string, Partial<HimContextualCurrentBatchSourceRow>]> = [
      ['wrong definition version', { definition_version: 2, source_definition_version: 2 }],
      ['non-CALIBRATED definition metadata', { calculation_status: 'UNCALIBRATED' }],
      ['context absent from persisted valid contexts', { valid_context_kinds: ['SITUATION'] }],
      ['unknown HIF owner', { hif_owner: 'HXX' as never }],
      ['incoherent RESOLVED mapping with null type', { semantic_mapping_status: 'RESOLVED', semantic_type: null, source_semantic_mapping_status: 'RESOLVED', source_semantic_type: null }],
      ['incoherent UNRESOLVED mapping with a type', { semantic_mapping_status: 'UNRESOLVED', semantic_type: 'STATE', source_semantic_mapping_status: 'UNRESOLVED', source_semantic_type: 'STATE' }],
      ['unknown semantic mapping status', { semantic_mapping_status: 'PENDING' as never, source_semantic_mapping_status: 'PENDING' as never }],
    ];
    it.each(METADATA_MUTATIONS)('%s fails closed', async (_label, overrides) => {
      const { result } = read({
        rows: knownRows('DECISION'),
        mutateBatch: (rows) => rows.map((row) => (row.metric_key === 'hse.attention' ? { ...row, ...overrides } : row)),
      }, 'DECISION');
      await expect(result).rejects.toThrow('INTEGRITY_FAILURE');
    });

    it('fails closed when the source row disagrees with the requested metric, version, or context', async () => {
      const SOURCE_MUTATIONS: ReadonlyArray<Partial<HimContextualCurrentBatchSourceRow>> = [
        { source_metric_key: 'hse.attention' }, { source_definition_version: 2 },
        { source_context_kind: 'SITUATION' }, { source_context_id: 'situation:other' },
        { source_semantic_type: 'TRAIT' }, { source_semantic_mapping_status: 'UNRESOLVED' },
      ];
      for (const overrides of SOURCE_MUTATIONS) {
        const rows = { ...knownRows('DECISION'), ['hse.self-confidence|DECISION']: overrides };
        await expect(read({ rows }, 'DECISION').result).rejects.toThrow('INTEGRITY_FAILURE');
      }
    });

    it('preserves unresolved semantic mapping with null type for HBS and HRS metrics', async () => {
      const session = await read({ rows: knownRows('CONVERSATION_SESSION') }, 'CONVERSATION_SESSION').result;
      expect(session.metrics.find((metric) => metric.metricKey === 'hbs.reflection')).toMatchObject({
        hifOwner: 'HBS', semanticMappingStatus: 'UNRESOLVED', semanticType: null, knowledgeState: 'KNOWN',
      });
      const relationship = await read({ rows: knownRows('RELATIONSHIP') }, 'RELATIONSHIP').result;
      for (const metric of relationship.metrics) {
        expect(metric).toMatchObject({ hifOwner: 'HRS', semanticMappingStatus: 'UNRESOLVED', semanticType: null });
      }
    });

    it('preserves hgs.purpose-alignment as RESOLVED / ALIGNMENT and never forces STATE', async () => {
      const goal = await read({ rows: knownRows('GOAL') }, 'GOAL').result;
      expect(goal.metrics.find((metric) => metric.metricKey === 'hgs.purpose-alignment')).toMatchObject({
        hifOwner: 'HGS', semanticMappingStatus: 'RESOLVED', semanticType: 'ALIGNMENT', knowledgeState: 'KNOWN',
      });
      expect(goal.metrics.filter((metric) => metric.semanticType === 'STATE')).toHaveLength(1); // hse.motivation only
    });
  });

  describe('canonical current classification', () => {
    it('classifies a missing canonical latest row as NO_CANONICAL_CURRENT_VALUE with no history fallback', async () => {
      const { repository, result } = read({ rows: {} }, 'DECISION');
      const intelligence = await result;
      expect(intelligence.coverageState).toBe('EMPTY');
      for (const metric of intelligence.metrics) {
        expect(metric).toMatchObject({
          knowledgeState: 'UNKNOWN', numericValue: null, unknownReason: 'NO_CANONICAL_CURRENT_VALUE',
          canonicalBindingId: null, observedAt: null, temporalWindowStart: null, temporalWindowEnd: null,
        });
      }
      expect(repository.history).not.toHaveBeenCalled();
      expect(repository.listForContext).not.toHaveBeenCalled();
      expect(repository.getLatest).not.toHaveBeenCalled();
      expect(repository.readIntelligenceSnapshot).not.toHaveBeenCalled();
    });

    it('classifies UNASSESSED as UNKNOWN/null without zero or midpoint substitution', async () => {
      const rows = { ...knownRows('DECISION'), ['hse.attention|DECISION']: { value_state: 'UNASSESSED', numeric_value: null } as Partial<HimContextualCurrentBatchSourceRow> };
      const intelligence = await read({ rows }, 'DECISION').result;
      expect(intelligence.metrics[1]).toMatchObject({
        metricKey: 'hse.attention', knowledgeState: 'UNKNOWN', numericValue: null, unknownReason: 'LATEST_VALUE_UNASSESSED',
      });
      expect(intelligence.coverageState).toBe('PARTIAL');
    });

    it('classifies INVALIDATED as UNKNOWN/null and never exposes the stored numeric value', async () => {
      const rows = { ...knownRows('DECISION'), ['hse.self-confidence|DECISION']: { validity_status: 'INVALIDATED', numeric_value: 5 } as Partial<HimContextualCurrentBatchSourceRow> };
      const intelligence = await read({ rows }, 'DECISION').result;
      expect(intelligence.metrics[0]).toMatchObject({
        metricKey: 'hse.self-confidence', knowledgeState: 'UNKNOWN', numericValue: null, unknownReason: 'LATEST_VALUE_INVALIDATED',
        canonicalBindingId: null, observedAt: null,
      });
    });

    it('treats an assessed row as KNOWN only with the matching current ACTIVE binding', async () => {
      const intelligence = await read({ rows: knownRows('DECISION') }, 'DECISION').result;
      expect(intelligence.coverageState).toBe('FULL');
      expect(intelligence.metrics[0]).toMatchObject({
        metricKey: 'hse.self-confidence', knowledgeState: 'KNOWN', numericValue: 3, unknownReason: null,
        canonicalBindingId: bindingFor('hse.self-confidence', 'DECISION'), observedAt: '2026-08-27T00:00:00.000Z',
      });
    });

    it('classifies a retired/mismatched binding as UNKNOWN INCOMPATIBLE_ACTIVE_BINDING with numeric null', async () => {
      const rows = { ...knownRows('DECISION'), ['hse.attention|DECISION']: { canonical_binding_id: 'b9999999-0000-4000-8000-000000000999', numeric_value: 4 } as Partial<HimContextualCurrentBatchSourceRow> };
      const intelligence = await read({ rows }, 'DECISION').result;
      expect(intelligence.metrics[1]).toMatchObject({
        metricKey: 'hse.attention', knowledgeState: 'UNKNOWN', numericValue: null,
        unknownReason: 'INCOMPATIBLE_ACTIVE_BINDING', canonicalBindingId: null,
      });
      expect(intelligence.coverageState).toBe('PARTIAL');
    });

    it('fails closed when a calibrated runtime route has no ACTIVE binding on an ASSESSED row', async () => {
      const { result } = read({ rows: knownRows('DECISION'), active: { ['hse.attention|DECISION']: null } }, 'DECISION');
      await expect(result).rejects.toThrow('INTEGRITY_FAILURE');
    });

    it('keeps no-row and UNASSESSED/INVALIDATED semantics unchanged by whatever ACTIVE binding id the batch row carries', async () => {
      // QHIA-004 must not strengthen or weaken the UNKNOWN paths merely
      // because the one-roundtrip row happens to carry active_binding_id: the
      // per-slot path never consulted the resolver on these routes.
      const absent = await read({ rows: {}, active: { ['hse.attention|DECISION']: null, ['hse.self-confidence|DECISION']: null } }, 'DECISION').result;
      expect(absent.metrics.map((metric) => metric.unknownReason))
        .toEqual(['NO_CANONICAL_CURRENT_VALUE', 'NO_CANONICAL_CURRENT_VALUE']);
      const invalidated = await read({
        rows: { ...knownRows('DECISION'), ['hse.attention|DECISION']: { validity_status: 'INVALIDATED' } as Partial<HimContextualCurrentBatchSourceRow> },
        active: { ['hse.attention|DECISION']: null },
      }, 'DECISION').result;
      expect(invalidated.metrics[1]).toMatchObject({ knowledgeState: 'UNKNOWN', unknownReason: 'LATEST_VALUE_INVALIDATED' });
      const unassessed = await read({
        rows: { ...knownRows('DECISION'), ['hse.attention|DECISION']: { value_state: 'UNASSESSED', numeric_value: null } as Partial<HimContextualCurrentBatchSourceRow> },
        active: { ['hse.attention|DECISION']: null },
      }, 'DECISION').result;
      expect(unassessed.metrics[1]).toMatchObject({ knowledgeState: 'UNKNOWN', unknownReason: 'LATEST_VALUE_UNASSESSED' });
    });

    it('fails closed on malformed assessed rows instead of coercing them', async () => {
      const MALFORMED: ReadonlyArray<Partial<HimContextualCurrentBatchSourceRow>> = [
        { numeric_value: null }, { numeric_value: 0 }, { numeric_value: 6 }, { numeric_value: 3.5 },
        { canonical_binding_id: null }, { canonical_binding_id: 'not-a-uuid' },
        { confidence_state: 'ASSESSED' as never }, { confidence_reference: 'ref' as never },
        { validity_status: 'EXPIRED' as never }, { value_state: 'PENDING' as never },
        { value_state: 'UNASSESSED', numeric_value: 2 },
        { active_binding_id: 'not-a-uuid' },
      ];
      for (const overrides of MALFORMED) {
        const rows = { ...knownRows('DECISION'), ['hse.self-confidence|DECISION']: overrides };
        await expect(read({ rows }, 'DECISION').result).rejects.toThrow('INTEGRITY_FAILURE');
      }
    });

    it('fails closed on malformed source-present/source-absent combinations', async () => {
      // An absent-source slot row that still leaks any source or current
      // fragment is malformed transport, never a value to salvage.
      const LEAKS: ReadonlyArray<Partial<HimContextualCurrentBatchSourceRow>> = [
        { numeric_value: 3 }, { source_metric_key: 'hse.attention' }, { value_state: 'ASSESSED' },
        { canonical_binding_id: bindingFor('hse.attention', 'DECISION') }, { observed_at: '2026-08-27T00:00:00.000Z' },
        { validity_status: 'VALID' }, { confidence_state: 'UNASSESSED' },
      ];
      for (const leak of LEAKS) {
        const { result } = read({
          rows: { ['hse.self-confidence|DECISION']: {} },
          mutateBatch: (rows) => rows.map((row) => (row.metric_key === 'hse.attention' ? { ...row, ...leak } : row)),
        }, 'DECISION');
        await expect(result).rejects.toThrow('INTEGRITY_FAILURE');
      }
      const { result: nonBoolean } = read({
        rows: knownRows('DECISION'),
        mutateBatch: (rows) => rows.map((row) => ({ ...row, has_canonical_current_value: 'yes' as never })),
      }, 'DECISION');
      await expect(nonBoolean).rejects.toThrow('INTEGRITY_FAILURE');
    });

    it('keeps FULL/PARTIAL/EMPTY coverage and counts exact and internally coherent', async () => {
      for (const kind of SUPPORTED_KINDS) {
        const slots = HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS[kind];
        const full = await read({ rows: knownRows(kind) }, kind).result;
        expect(full).toMatchObject({ coverageState: 'FULL', eligibleMetricCount: slots.length, knownMetricCount: slots.length, unknownMetricCount: 0 });
        expect(full.metrics.map((metric) => metric.metricKey)).toEqual([...slots]);
        const empty = await read({ rows: {} }, kind).result;
        expect(empty).toMatchObject({ coverageState: 'EMPTY', eligibleMetricCount: slots.length, knownMetricCount: 0, unknownMetricCount: slots.length });
        const partialRows = knownRows(kind);
        delete partialRows[`${slots[0]}|${kind}`];
        const partial = await read({ rows: partialRows }, kind).result;
        expect(partial).toMatchObject({ coverageState: 'PARTIAL', knownMetricCount: slots.length - 1, unknownMetricCount: 1 });
        expect(partial.metrics.map((metric) => metric.metricKey)).toEqual([...slots]);
      }
    });
  });

  describe('batch transport integrity — exact order and cardinality, never repaired', () => {
    const BATCH_MUTATIONS: ReadonlyArray<readonly [string, (rows: HimContextualCurrentBatchSourceRow[]) => unknown]> = [
      ['a missing slot row', (rows) => rows.slice(0, -1)],
      ['an extra slot row', (rows) => [...rows, { ...rows[rows.length - 1], slot_order: rows.length + 1 }]],
      ['a duplicated slot row', (rows) => rows.map((row, index) => (index === 1 ? { ...rows[0] } : row))],
      ['a duplicated slot order', (rows) => rows.map((row, index) => (index === 1 ? { ...row, slot_order: 1 } : row))],
      ['reordered rows', (rows) => [...rows].reverse()],
      ['a wrong slot order value', (rows) => rows.map((row, index) => (index === 0 ? { ...row, slot_order: 99 } : row))],
      ['a wrong metric identity', (rows) => rows.map((row, index) => (index === 0 ? { ...row, metric_key: 'hse.energy' } : row))],
      ['a wrong requested context kind', (rows) => rows.map((row) => ({ ...row, context_kind: 'GOAL' as never }))],
      ['a wrong requested context id', (rows) => rows.map((row) => ({ ...row, context_id: 'other-context' }))],
      ['a non-object row', (rows) => rows.map((row, index) => (index === 0 ? null : row))],
      ['a non-array batch', () => ({ rows: true })],
    ];
    it.each(BATCH_MUTATIONS)('%s fails closed as INTEGRITY_FAILURE', async (_label, mutateBatch) => {
      const { result } = read({ rows: knownRows('DECISION'), mutateBatch }, 'DECISION');
      await expect(result).rejects.toThrow('INTEGRITY_FAILURE');
    });

    it('never reorders a malformed batch into correctness even when every row is individually valid', async () => {
      // Both rows are well-formed; only their transport order is wrong. The
      // service must fail closed, not sort by slot_order.
      const { result } = read({
        rows: knownRows('DECISION'),
        mutateBatch: (rows) => [rows[1], rows[0]],
      }, 'DECISION');
      await expect(result).rejects.toThrow('INTEGRITY_FAILURE');
    });
  });

  describe('selective subset reads (QHIA-004)', () => {
    it('rejects an empty, duplicated, unknown, or off-context selection fail-closed', async () => {
      const cases: ReadonlyArray<readonly [HimRuntimeCurrentIntelligenceContextKind, readonly string[]]> = [
        ['CONVERSATION_SESSION', []],
        ['CONVERSATION_SESSION', ['hse.stress', 'hse.stress']],
        ['CONVERSATION_SESSION', ['hse.motivation']],
        ['CONVERSATION_SESSION', ['hrs.relationship-trust']],
        ['SITUATION', ['hrs.communication']],
        ['RELATIONSHIP', ['hbs.avoidance']],
        ['GOAL', ['hse.stress']],
        ['DECISION', ['hgs.purpose-alignment']],
        ['GOAL', ['not.a-canonical-metric']],
        ['GOAL', ['hse.motivation', 'hse.motivation']],
      ];
      for (const [kind, requested] of cases) {
        const { repository, result } = readSelection({ rows: knownRows(kind) }, kind, requested);
        await expect(result).rejects.toThrow('INVALID_METRIC_SELECTION');
        expect(repository.readContextualCurrentIntelligenceBatch).not.toHaveBeenCalled();
      }
    });

    it('canonicalizes arbitrary caller order into the frozen slot order before the one batch request', async () => {
      const { repository, result } = readSelection({ rows: knownRows('CONVERSATION_SESSION') }, 'CONVERSATION_SESSION', ['hbs.reflection', 'hse.stress']);
      const selection = await result;
      expect(repository.readContextualCurrentIntelligenceBatch).toHaveBeenCalledTimes(1);
      expect(repository.readContextualCurrentIntelligenceBatch).toHaveBeenCalledWith(
        'token', 'user-1', 'CONVERSATION_SESSION', CONTEXT_IDS.CONVERSATION_SESSION,
        ['hse.stress', 'hbs.reflection'], [1, 1],
      );
      expect(selection.metrics.map((metric) => metric.metricKey)).toEqual(['hse.stress', 'hbs.reflection']);
      expect(selection).toMatchObject({
        contractVersion: 1, source: 'HIM_CANONICAL_LATEST_MEASUREMENT',
        contextKind: 'CONVERSATION_SESSION', contextId: CONTEXT_IDS.CONVERSATION_SESSION,
        coverageState: 'FULL', requestedMetricCount: 2, knownMetricCount: 2, unknownMetricCount: 0,
      });
    });

    it('answers a single-metric selection with one batch call and the full metric contract', async () => {
      const { repository, result } = readSelection({ rows: knownRows('GOAL') }, 'GOAL', ['hgs.resilience']);
      const selection = await result;
      expect(repository.readContextualCurrentIntelligenceBatch).toHaveBeenCalledTimes(1);
      expect(selection.requestedMetricCount).toBe(1);
      expect(selection.coverageState).toBe('FULL');
      expect(selection.metrics[0]).toMatchObject({
        metricKey: 'hgs.resilience', knowledgeState: 'KNOWN', numericValue: 3,
        canonicalBindingId: bindingFor('hgs.resilience', 'GOAL'),
      });
    });

    it('produces PARTIAL and EMPTY subset coverage from mixed and absent canonical rows', async () => {
      const mixed = await readSelection(
        { rows: { ['hse.motivation|GOAL']: {} } }, 'GOAL', ['hbs.avoidance', 'hse.motivation'],
      ).result;
      expect(mixed).toMatchObject({ coverageState: 'PARTIAL', requestedMetricCount: 2, knownMetricCount: 1, unknownMetricCount: 1 });
      expect(mixed.metrics.map((metric) => metric.metricKey)).toEqual(['hse.motivation', 'hbs.avoidance']);
      expect(mixed.metrics[1]).toMatchObject({ knowledgeState: 'UNKNOWN', unknownReason: 'NO_CANONICAL_CURRENT_VALUE' });
      const empty = await readSelection({ rows: {} }, 'DECISION', ['hse.attention']).result;
      expect(empty).toMatchObject({ coverageState: 'EMPTY', requestedMetricCount: 1, knownMetricCount: 0, unknownMetricCount: 1 });
    });

    it('keeps the subset contract distinct: requestedMetricCount for selections, eligibleMetricCount for full reads', async () => {
      const selection = await readSelection({ rows: knownRows('DECISION') }, 'DECISION', ['hse.attention']).result;
      expect(selection.requestedMetricCount).toBe(1);
      expect('eligibleMetricCount' in selection).toBe(false);
      const full = await read({ rows: knownRows('DECISION') }, 'DECISION').result;
      expect(full.eligibleMetricCount).toBe(2);
      expect('requestedMetricCount' in full).toBe(false);
    });

    it('a full-width selection equals the full-context read metric for metric', async () => {
      const selection = await readSelection(
        { rows: knownRows('CONVERSATION_SESSION') }, 'CONVERSATION_SESSION',
        ['hbs.reflection', 'hse.attention', 'hse.energy', 'hse.stress'],
      ).result;
      const full = await read({ rows: knownRows('CONVERSATION_SESSION') }, 'CONVERSATION_SESSION').result;
      expect(JSON.stringify(selection.metrics)).toBe(JSON.stringify(full.metrics));
      expect(selection.requestedMetricCount).toBe(full.eligibleMetricCount);
    });

    it('applies the same batch-row integrity discipline to subset reads', async () => {
      const { result } = readSelection({
        rows: knownRows('CONVERSATION_SESSION'),
        mutateBatch: (rows) => [...rows].reverse(),
      }, 'CONVERSATION_SESSION', ['hse.stress', 'hbs.reflection']);
      await expect(result).rejects.toThrow('INTEGRITY_FAILURE');
    });
  });

  describe('structural latency invariant — exactly one Data API request', () => {
    // Real HimRepository over a mocked MemoryDataApiService: the whole
    // service path, full or subset, costs exactly ONE HTTP-level request
    // independent of the requested metric count, and no per-slot definition,
    // canonical-latest, binding, history, Trend, or Snapshot request exists.
    const buildTransport = () => {
      const request = jest.fn(async (_token: string, path: string, init?: RequestInit) => {
        expect(path).toBe(BATCH_RPC);
        const body = JSON.parse(String(init?.body)) as {
          p_user_id: string; p_context_kind: HimRuntimeCurrentIntelligenceContextKind;
          p_context_id: string; p_metric_keys: string[]; p_definition_versions: number[];
        };
        expect(body.p_definition_versions).toEqual(body.p_metric_keys.map(() => 1));
        const harness: Harness = { rows: Object.fromEntries(body.p_metric_keys.map((metricKey) => [`${metricKey}|${body.p_context_kind}`, {}])) };
        return body.p_metric_keys.map((metricKey, index) =>
          batchRowFor(metricKey, index, body.p_context_kind, body.p_context_id, harness));
      });
      const repository = new HimRepository({ request } as unknown as MemoryDataApiService);
      return { request, repository, service: new HimContextualCurrentIntelligenceService(repository) };
    };

    it('the repository batch method performs exactly one Data API request with the exact RPC body', async () => {
      const { request, repository } = buildTransport();
      const rows = await repository.readContextualCurrentIntelligenceBatch(
        'token', 'user-1', 'DECISION', CONTEXT_IDS.DECISION, ['hse.self-confidence', 'hse.attention'], [1, 1],
      );
      expect(request).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledWith('token', BATCH_RPC, {
        method: 'POST',
        body: JSON.stringify({
          p_user_id: 'user-1', p_context_kind: 'DECISION', p_context_id: CONTEXT_IDS.DECISION,
          p_metric_keys: ['hse.self-confidence', 'hse.attention'], p_definition_versions: [1, 1],
        }),
      });
      expect(rows.map((row) => row.slot_order)).toEqual([1, 2]);
    });

    it.each(SUPPORTED_KINDS.map((kind) => [kind, HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS[kind].length] as const))(
      'a full %s read (%d slots) is exactly one HTTP request', async (kind, slotCount) => {
        const { request, service } = buildTransport();
        const intelligence = await service.getCurrentIntelligence('user-1', 'token', kind, CONTEXT_IDS[kind]);
        expect(request).toHaveBeenCalledTimes(1);
        expect(request.mock.calls[0][1]).toBe(BATCH_RPC);
        expect(intelligence.metrics).toHaveLength(slotCount);
        expect(intelligence.coverageState).toBe('FULL');
      });

    it('a subset of 1 and a subset of N each cost exactly one HTTP request', async () => {
      const one = buildTransport();
      await one.service.getCurrentSelection('user-1', 'token', 'SITUATION', CONTEXT_IDS.SITUATION, ['hbs.reflection']);
      expect(one.request).toHaveBeenCalledTimes(1);
      const many = buildTransport();
      await many.service.getCurrentSelection('user-1', 'token', 'SITUATION', CONTEXT_IDS.SITUATION,
        ['hgs.habit-strength', 'hse.stress', 'hbs.avoidance']);
      expect(many.request).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(many.request.mock.calls[0][2]?.body)).p_metric_keys)
        .toEqual(['hse.stress', 'hbs.avoidance', 'hgs.habit-strength']);
      // Every request that occurred targeted the one batch RPC - nothing
      // per-slot, no definition, latest, binding, history, Trend, or Snapshot
      // path was requested at all.
      for (const call of [...one.request.mock.calls, ...many.request.mock.calls]) expect(call[1]).toBe(BATCH_RPC);
    });

    it('the N+1 per-slot repository helpers are gone and the batch path calls no other repository surface', async () => {
      const prototype = HimRepository.prototype as unknown as Record<string, unknown>;
      expect(prototype['getLatestCurrentIntelligenceSource']).toBeUndefined();
      expect(prototype['getActiveStructuredBindingId']).toBeUndefined();
      // The older generic canonical read APIs remain, unchanged, for their
      // own callers - they are simply not on this path.
      expect(typeof prototype['getLatest']).toBe('function');
      expect(typeof prototype['getDefinition']).toBe('function');
      const { repository, result } = read({ rows: knownRows('SITUATION') }, 'SITUATION');
      await result;
      expect(repository.readContextualCurrentIntelligenceBatch).toHaveBeenCalledTimes(1);
      expect(repository.getDefinition).not.toHaveBeenCalled();
      expect(repository.getLatest).not.toHaveBeenCalled();
      expect(repository.readTrendSource).not.toHaveBeenCalled();
      expect(repository.readIntelligenceSnapshot).not.toHaveBeenCalled();
      expect(repository.history).not.toHaveBeenCalled();
      expect(repository.listForContext).not.toHaveBeenCalled();
    });
  });

  describe('temporal and authority non-inference', () => {
    it('preserves temporal windows as source facts only', async () => {
      const rows = {
        ...knownRows('SITUATION'),
        ['hbs.avoidance|SITUATION']: {
          temporal_window_start: '2026-08-20T00:00:00.000Z', temporal_window_end: '2026-08-27T00:00:00.000Z',
        } as Partial<HimContextualCurrentBatchSourceRow>,
      };
      const intelligence = await read({ rows }, 'SITUATION').result;
      expect(intelligence.metrics.find((metric) => metric.metricKey === 'hbs.avoidance')).toMatchObject({
        knowledgeState: 'KNOWN',
        temporalWindowStart: '2026-08-20T00:00:00.000Z', temporalWindowEnd: '2026-08-27T00:00:00.000Z',
        freshnessState: 'UNASSESSED', freshnessReference: null,
      });
      expect(intelligence.metrics.find((metric) => metric.metricKey === 'hbs.reflection')).toMatchObject({
        knowledgeState: 'KNOWN', temporalWindowStart: null, temporalWindowEnd: null,
      });
    });

    it('derives no freshness or trend from observedAt: only the preserved fact differs', async () => {
      const early = await read({ rows: knownRows('DECISION') }, 'DECISION').result;
      const lateRows = Object.fromEntries(Object.entries(knownRows('DECISION')).map(([slot]) => [
        slot, { observed_at: '2020-01-01T00:00:00.000Z' } as Partial<HimContextualCurrentBatchSourceRow>,
      ]));
      const late = await read({ rows: lateRows }, 'DECISION').result;
      expect(JSON.stringify({ ...late, metrics: late.metrics.map((metric) => ({ ...metric, observedAt: null })) }))
        .toBe(JSON.stringify({ ...early, metrics: early.metrics.map((metric) => ({ ...metric, observedAt: null })) }));
      expect(JSON.stringify(late)).not.toMatch(/freshness":"(?!UNASSESSED)|trend|decay|improv|worsen|readiness|score|driver|directive|recommendation|question/iu);
    });

    it('depends only on the repository and emits no behavioral decision surface', () => {
      expect(HimContextualCurrentIntelligenceService.length).toBe(1);
      const prototype = Object.getOwnPropertyNames(HimContextualCurrentIntelligenceService.prototype);
      expect(prototype).not.toEqual(expect.arrayContaining(['derive', 'project', 'ground', 'recommend', 'ask']));
    });
  });

  describe('determinism', () => {
    it('produces byte-equivalent output for identical source facts', async () => {
      const first = await read({ rows: knownRows('GOAL') }, 'GOAL').result;
      const second = await read({ rows: knownRows('GOAL') }, 'GOAL').result;
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
      const firstSelection = await readSelection({ rows: knownRows('GOAL') }, 'GOAL', ['hgs.resilience', 'hse.motivation']).result;
      const secondSelection = await readSelection({ rows: knownRows('GOAL') }, 'GOAL', ['hse.motivation', 'hgs.resilience']).result;
      expect(JSON.stringify(secondSelection)).toBe(JSON.stringify(firstSelection));
    });
  });
});
