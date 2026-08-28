import { HimContextualCurrentIntelligenceService } from './him-contextual-current-intelligence.service';
import {
  HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS,
  type HimCanonicalLatestSourceRow,
  type HimRuntimeCurrentIntelligenceContextKind,
} from './him-contextual-current-intelligence.types';
import { CANONICAL_HIM_V1_METRICS } from './initial-him-metrics.catalog';
import type { HimRepository } from './him.repository';
import type { HimMetricDefinition } from './him.types';

const SUPPORTED_KINDS = Object.keys(HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS) as HimRuntimeCurrentIntelligenceContextKind[];
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
const sourceRow = (
  metricKey: string,
  kind: HimRuntimeCurrentIntelligenceContextKind,
  overrides: Partial<HimCanonicalLatestSourceRow> = {},
): HimCanonicalLatestSourceRow => {
  const definition = definitionFor(metricKey);
  return {
    id: `row-${metricKey}`, user_id: 'user-1', metric_key: metricKey, definition_version: 1,
    semantic_mapping_status: definition.semanticMappingStatus, semantic_type: definition.semanticType,
    value_state: 'ASSESSED', numeric_value: 3, confidence_state: 'UNASSESSED', confidence_reference: null,
    supporting_evidence_ids: [], contradicting_evidence_ids: [], source_engines: ['QANDEEL_HIM_RUNTIME'],
    context_kind: kind, context_id: CONTEXT_IDS[kind], scope: `${kind}:${CONTEXT_IDS[kind]}`,
    observed_at: '2026-08-27T00:00:00.000Z', temporal_window_start: null, temporal_window_end: null,
    validity_status: 'VALID', snapshot_version: 1, descriptive_update_reason: 'canonical calculation',
    descriptive_update_reference_ids: [], canonical_provenance: 'QANDEEL_HIM_RUNTIME_FOUNDATION_V1',
    created_at: '2026-08-27T00:00:00.000Z', canonical_binding_id: bindingFor(metricKey, kind), ...overrides,
  };
};

interface Harness {
  definitions?: (metricKey: string) => HimMetricDefinition | undefined;
  rows?: Record<string, HimCanonicalLatestSourceRow | undefined>;
  active?: Record<string, string | null>;
  latestDelaysReversed?: boolean;
}
const build = (harness: Harness = {}) => {
  const repository = {
    getDefinition: jest.fn(async (_token: string, metricKey: string, version: number) =>
      version === 1 ? (harness.definitions ? harness.definitions(metricKey) : definitionFor(metricKey)) : undefined),
    getLatestCurrentIntelligenceSource: jest.fn(
      (_token: string, _userId: string, metricKey: string, _version: number, kind: string, _contextId: string) => {
        const value = harness.rows?.[`${metricKey}|${kind}`];
        if (!harness.latestDelaysReversed) return Promise.resolve(value);
        // Force reverse completion order: earlier slots resolve last.
        const slots = HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS[kind as HimRuntimeCurrentIntelligenceContextKind];
        let chain: Promise<typeof value> = Promise.resolve(value);
        for (let depth = 0; depth < slots.length - slots.indexOf(metricKey); depth += 1) chain = chain.then((v) => v);
        return chain;
      }),
    getActiveStructuredBindingId: jest.fn(async (_token: string, metricKey: string, _version: number, kind: string) =>
      harness.active && `${metricKey}|${kind}` in harness.active ? harness.active[`${metricKey}|${kind}`] : bindingFor(metricKey, kind)),
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
const knownRows = (kind: HimRuntimeCurrentIntelligenceContextKind): Record<string, HimCanonicalLatestSourceRow> =>
  Object.fromEntries(HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS[kind].map((metricKey) => [`${metricKey}|${kind}`, sourceRow(metricKey, kind)]));

describe('HIM Contextual Current Intelligence v1 (QHIA-003)', () => {
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
      expect(repository.getDefinition).not.toHaveBeenCalled();
      expect(repository.getLatestCurrentIntelligenceSource).not.toHaveBeenCalled();
    });

    it('rejects structurally invalid context identities fail-closed', async () => {
      const { service } = build();
      await expect(service.getCurrentIntelligence('user-1', 'token', 'GOAL', 'not-a-uuid')).rejects.toThrow('INVALID_OR_UNOWNED_CONTEXT');
      await expect(service.getCurrentIntelligence('user-1', 'token', 'CONVERSATION_SESSION', 'GLOBAL')).rejects.toThrow('INVALID_OR_UNOWNED_CONTEXT');
      await expect(service.getCurrentIntelligence('user-1', 'token', 'SITUATION', '')).rejects.toThrow('INVALID_OR_UNOWNED_CONTEXT');
      await expect(service.getCurrentIntelligence('user-1', 'token', 'SITUATION', ` ${CONTEXT_IDS.SITUATION}`)).rejects.toThrow('INVALID_OR_UNOWNED_CONTEXT');
    });
  });

  describe('definition integrity — fail closed', () => {
    const DEFINITION_MUTATIONS: ReadonlyArray<readonly [string, (definition: HimMetricDefinition) => HimMetricDefinition | undefined]> = [
      ['missing persisted definition', () => undefined],
      ['wrong definition version', (definition) => ({ ...definition, definitionVersion: 2 })],
      ['non-CALIBRATED definition', (definition) => ({ ...definition, calculationStatus: 'UNCALIBRATED' })],
      ['context absent from persisted valid contexts', (definition) => ({ ...definition, validContextKinds: definition.validContextKinds.filter((kind) => kind !== 'DECISION') })],
      ['incoherent RESOLVED mapping with null type', (definition) => ({ ...definition, semanticMappingStatus: 'RESOLVED', semanticType: null })],
      ['incoherent UNRESOLVED mapping with a type', (definition) => ({ ...definition, semanticMappingStatus: 'UNRESOLVED', semanticType: 'STATE' })],
    ];
    it.each(DEFINITION_MUTATIONS)('%s fails closed', async (_label, mutate) => {
      const { result } = read({
        definitions: (metricKey) => (metricKey === 'hse.attention' ? mutate(definitionFor(metricKey)) : definitionFor(metricKey)),
        rows: knownRows('DECISION'),
      }, 'DECISION');
      await expect(result).rejects.toThrow('INTEGRITY_FAILURE');
    });

    it('fails closed when the source row disagrees with the requested metric, version, or context', async () => {
      for (const overrides of [
        { metric_key: 'hse.attention' }, { definition_version: 2 },
        { context_kind: 'SITUATION' as const }, { context_id: 'situation:other' },
        { semantic_type: 'TRAIT' as const }, { semantic_mapping_status: 'UNRESOLVED' as const },
      ]) {
        const rows = { ...knownRows('DECISION'), ['hse.self-confidence|DECISION']: sourceRow('hse.self-confidence', 'DECISION', overrides as Partial<HimCanonicalLatestSourceRow>) };
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
      const rows = { ...knownRows('DECISION'), ['hse.attention|DECISION']: sourceRow('hse.attention', 'DECISION', { value_state: 'UNASSESSED', numeric_value: null }) };
      const intelligence = await read({ rows }, 'DECISION').result;
      expect(intelligence.metrics[1]).toMatchObject({
        metricKey: 'hse.attention', knowledgeState: 'UNKNOWN', numericValue: null, unknownReason: 'LATEST_VALUE_UNASSESSED',
      });
      expect(intelligence.coverageState).toBe('PARTIAL');
    });

    it('classifies INVALIDATED as UNKNOWN/null and never exposes the stored numeric value', async () => {
      const rows = { ...knownRows('DECISION'), ['hse.self-confidence|DECISION']: sourceRow('hse.self-confidence', 'DECISION', { validity_status: 'INVALIDATED', numeric_value: 5 }) };
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
      const rows = { ...knownRows('DECISION'), ['hse.attention|DECISION']: sourceRow('hse.attention', 'DECISION', { canonical_binding_id: 'b9999999-0000-4000-8000-000000000999', numeric_value: 4 }) };
      const intelligence = await read({ rows }, 'DECISION').result;
      expect(intelligence.metrics[1]).toMatchObject({
        metricKey: 'hse.attention', knowledgeState: 'UNKNOWN', numericValue: null,
        unknownReason: 'INCOMPATIBLE_ACTIVE_BINDING', canonicalBindingId: null,
      });
      expect(intelligence.coverageState).toBe('PARTIAL');
    });

    it('fails closed when a calibrated runtime route has no ACTIVE binding', async () => {
      const { result } = read({ rows: knownRows('DECISION'), active: { ['hse.attention|DECISION']: null } }, 'DECISION');
      await expect(result).rejects.toThrow('INTEGRITY_FAILURE');
    });

    it('fails closed on malformed assessed rows instead of coercing them', async () => {
      for (const overrides of [
        { numeric_value: null }, { numeric_value: 0 }, { numeric_value: 6 }, { numeric_value: 3.5 },
        { canonical_binding_id: null }, { canonical_binding_id: 'not-a-uuid' },
        { confidence_state: 'ASSESSED' as never }, { confidence_reference: 'ref' as never },
        { validity_status: 'EXPIRED' as never }, { value_state: 'PENDING' as never },
        { value_state: 'UNASSESSED' as const, numeric_value: 2 },
      ]) {
        const rows = { ...knownRows('DECISION'), ['hse.self-confidence|DECISION']: sourceRow('hse.self-confidence', 'DECISION', overrides as Partial<HimCanonicalLatestSourceRow>) };
        await expect(read({ rows }, 'DECISION').result).rejects.toThrow('INTEGRITY_FAILURE');
      }
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

  describe('temporal and authority non-inference', () => {
    it('preserves temporal windows as source facts only', async () => {
      const rows = {
        ...knownRows('SITUATION'),
        ['hbs.avoidance|SITUATION']: sourceRow('hbs.avoidance', 'SITUATION', {
          temporal_window_start: '2026-08-20T00:00:00.000Z', temporal_window_end: '2026-08-27T00:00:00.000Z',
        }),
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
      const lateRows = Object.fromEntries(Object.entries(knownRows('DECISION')).map(([slot, row]) => [
        slot, { ...row!, observed_at: '2020-01-01T00:00:00.000Z', created_at: '2020-01-01T00:00:00.000Z' },
      ]));
      const late = await read({ rows: lateRows }, 'DECISION').result;
      expect(JSON.stringify({ ...late, metrics: late.metrics.map((metric) => ({ ...metric, observedAt: null })) }))
        .toBe(JSON.stringify({ ...early, metrics: early.metrics.map((metric) => ({ ...metric, observedAt: null })) }));
      expect(JSON.stringify(late)).not.toMatch(/freshness":"(?!UNASSESSED)|trend|decay|improv|worsen|readiness|score|driver|directive|recommendation|question/iu);
    });

    it('calls no Trend, snapshot, history, or untyped-latest repository surface', async () => {
      const { repository, result } = read({ rows: knownRows('SITUATION') }, 'SITUATION');
      await result;
      expect(repository.readTrendSource).not.toHaveBeenCalled();
      expect(repository.readIntelligenceSnapshot).not.toHaveBeenCalled();
      expect(repository.history).not.toHaveBeenCalled();
      expect(repository.listForContext).not.toHaveBeenCalled();
      expect(repository.getLatest).not.toHaveBeenCalled();
      expect(repository.getLatestCurrentIntelligenceSource).toHaveBeenCalledTimes(HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS.SITUATION.length);
    });

    it('depends only on the repository and emits no behavioral decision surface', () => {
      expect(HimContextualCurrentIntelligenceService.length).toBe(1);
      const prototype = Object.getOwnPropertyNames(HimContextualCurrentIntelligenceService.prototype);
      expect(prototype).not.toEqual(expect.arrayContaining(['derive', 'project', 'ground', 'recommend', 'ask']));
    });
  });

  describe('determinism', () => {
    it('keeps the frozen slot order when repository completion order is reversed', async () => {
      const intelligence = await read({ rows: knownRows('SITUATION'), latestDelaysReversed: true }, 'SITUATION').result;
      expect(intelligence.metrics.map((metric) => metric.metricKey)).toEqual([...HIM_RUNTIME_CURRENT_INTELLIGENCE_SLOTS.SITUATION]);
    });

    it('produces byte-equivalent output for identical source facts', async () => {
      const first = await read({ rows: knownRows('GOAL') }, 'GOAL').result;
      const second = await read({ rows: knownRows('GOAL') }, 'GOAL').result;
      expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    });
  });
});
