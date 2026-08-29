import { readFileSync } from 'node:fs';
import { HimBrainContextService } from './him-brain-context.service';
import { HIM_BRAIN_CONTEXT_REGISTRY, type HimBrainContextForegroundRow } from './him-brain-context.types';

// QHIA-012 foreground consumption contract.
//
// This boundary owns Brain Context MEANING for the foreground: it validates the
// migration-0061 transport fail-closed, strips every internal identity, and
// returns provider-safe advisory context or nothing at all. It never rereads a
// metric, never re-resolves relevance, never substitutes an older value, and
// never derives freshness, confidence, or a trend.
const USER = '00000000-0000-4000-8000-000000000001';
const SESSION = '00000000-0000-4000-8000-000000000002';
const TURN = '00000000-0000-4000-8000-000000000003';
const DECISION_CONTEXT = '00000000-0000-4000-8000-0000000000d1';
const SITUATION_CONTEXT = '00000000-0000-4000-8000-0000000000a1';
const GOAL_CONTEXT = '00000000-0000-4000-8000-0000000000c1';

const row = (overrides: Partial<HimBrainContextForegroundRow> = {}): HimBrainContextForegroundRow => ({
  slot_order: 1,
  slot: 'DECISION_SELF_CONFIDENCE',
  context_kind: 'DECISION',
  context_id: DECISION_CONTEXT,
  numeric_value: 2,
  semantic_mapping_status: 'RESOLVED',
  semantic_type: 'STATE',
  freshness_state: 'UNASSESSED',
  confidence_state: 'UNASSESSED',
  ...overrides,
});
const alignmentRow = (): HimBrainContextForegroundRow => row({
  slot_order: 7, slot: 'GOAL_PURPOSE_ALIGNMENT', context_kind: 'GOAL', context_id: GOAL_CONTEXT,
  numeric_value: 4, semantic_mapping_status: 'RESOLVED', semantic_type: 'ALIGNMENT',
});
const unresolvedRow = (): HimBrainContextForegroundRow => row({
  slot_order: 2, slot: 'SITUATION_AVOIDANCE_FREQUENCY', context_kind: 'SITUATION', context_id: SITUATION_CONTEXT,
  numeric_value: 5, semantic_mapping_status: 'UNRESOLVED', semantic_type: null,
});
const service = (rows: unknown) => new HimBrainContextService({
  readBrainContextForTurn: jest.fn().mockResolvedValue(rows),
} as never);

describe('HimBrainContextService', () => {
  it('exposes the frozen EIGHT-slot registry, in exactly the frozen order, with each slot pinned to one context kind', () => {
    expect(HIM_BRAIN_CONTEXT_REGISTRY).toHaveLength(8);
    expect(HIM_BRAIN_CONTEXT_REGISTRY.map((entry) => [entry.slotOrder, entry.slot, entry.contextKind, entry.metricKey])).toEqual([
      [1, 'DECISION_SELF_CONFIDENCE', 'DECISION', 'hse.self-confidence'],
      [2, 'SITUATION_AVOIDANCE_FREQUENCY', 'SITUATION', 'hbs.avoidance'],
      [3, 'SITUATION_SELF_AWARENESS', 'SITUATION', 'hgs.self-awareness'],
      [4, 'SITUATION_RESILIENCE', 'SITUATION', 'hgs.resilience'],
      [5, 'GOAL_CONSISTENCY', 'GOAL', 'hbs.consistency'],
      [6, 'GOAL_INITIATIVE', 'GOAL', 'hbs.initiative'],
      [7, 'GOAL_PURPOSE_ALIGNMENT', 'GOAL', 'hgs.purpose-alignment'],
      [8, 'GOAL_HABIT_STRENGTH', 'GOAL', 'hgs.habit-strength'],
    ]);
    // The four metrics that already have their own dedicated foreground
    // consumption, every HRS metric, and every other excluded metric stay out.
    const metrics = HIM_BRAIN_CONTEXT_REGISTRY.map((entry) => entry.metricKey);
    for (const excluded of ['hse.stress', 'hse.attention', 'hse.motivation', 'hse.energy', 'hbs.reflection', 'hrs.communication', 'hrs.relationship-trust', 'hrs.repair', 'hrs.emotional-safety']) {
      expect(metrics).not.toContain(excluded);
    }
    expect(HIM_BRAIN_CONTEXT_REGISTRY.map((entry) => entry.contextKind).every((kind) => ['DECISION', 'SITUATION', 'GOAL'].includes(kind))).toBe(true);
  });

  it('issues exactly one transport request and returns provider-safe advisory context', async () => {
    const readBrainContextForTurn = jest.fn().mockResolvedValue([row(), alignmentRow()]);
    const instance = new HimBrainContextService({ readBrainContextForTurn } as never);
    const context = await instance.read(USER, 'token', SESSION, TURN);
    expect(readBrainContextForTurn).toHaveBeenCalledTimes(1);
    expect(readBrainContextForTurn).toHaveBeenCalledWith('token', USER, SESSION, TURN);
    expect(context).toEqual({
      contractVersion: 1,
      source: 'QANDEEL_HIM_BRAIN_CONTEXT_V1',
      availability: 'AVAILABLE',
      signals: [
        { slot: 'DECISION_SELF_CONFIDENCE', numericValue: 2, semanticMappingStatus: 'RESOLVED', semanticType: 'STATE', freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' },
        { slot: 'GOAL_PURPOSE_ALIGNMENT', numericValue: 4, semanticMappingStatus: 'RESOLVED', semanticType: 'ALIGNMENT', freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' },
      ],
    });
  });

  it('STRIPS every internal identity: no context id, no source turn id, no slot ordinal, no metric key, no timestamp', async () => {
    const context = await service([row(), unresolvedRow(), alignmentRow()]).read(USER, 'token', SESSION, TURN);
    const serialized = JSON.stringify(context);
    for (const forbidden of [
      DECISION_CONTEXT, SITUATION_CONTEXT, GOAL_CONTEXT, TURN, SESSION, USER,
      'contextId', 'context_id', 'contextKind', 'context_kind', 'sourceTurnId', 'slotOrder', 'slot_order',
      'metricKey', 'metric_key', 'hse.self-confidence', 'hgs.purpose-alignment', 'observedAt', 'observed_at',
      'canonicalBindingId', 'activeBindingId', 'temporalWindow',
    ]) expect(serialized).not.toContain(forbidden);
  });

  it('returns undefined for zero surviving signals rather than an EMPTY block', async () => {
    await expect(service([]).read(USER, 'token', SESSION, TURN)).resolves.toBeUndefined();
    expect(service([]).consumeSourceRows([])).toBeUndefined();
  });

  it('preserves the exact persisted semantic mapping in both directions and coerces neither', () => {
    const instance = service([]);
    expect(instance.consumeSourceRows([unresolvedRow()])?.signals[0]).toMatchObject({ semanticMappingStatus: 'UNRESOLVED', semanticType: null });
    expect(instance.consumeSourceRows([alignmentRow()])?.signals[0]).toMatchObject({ semanticMappingStatus: 'RESOLVED', semanticType: 'ALIGNMENT' });
  });

  it('accepts the whole frozen registry at once and preserves fixed registry order', () => {
    const rows = HIM_BRAIN_CONTEXT_REGISTRY.map((entry) => row({
      slot_order: entry.slotOrder, slot: entry.slot, context_kind: entry.contextKind,
      context_id: DECISION_CONTEXT, numeric_value: 3, semantic_mapping_status: 'UNRESOLVED', semantic_type: null,
    }));
    const context = service([]).consumeSourceRows(rows);
    expect(context?.signals).toHaveLength(8);
    expect(context?.signals.map((signal) => signal.slot)).toEqual(HIM_BRAIN_CONTEXT_REGISTRY.map((entry) => entry.slot));
  });

  it('fails closed on every malformed transport shape rather than silently dropping a signal', () => {
    const instance = service([]);
    const rejected: Array<[string, unknown]> = [
      ['a non-array payload', {}],
      ['more than eight rows', [...Array(9)].map((_value, index) => row({ slot_order: index + 1 }))],
      ['a null row', [null]],
      ['an unknown slot ordinal', [row({ slot_order: 9, slot: 'DECISION_SELF_CONFIDENCE' })]],
      ['a non-numeric slot ordinal', [row({ slot_order: '1' as never })]],
      ['a duplicated slot', [row(), row()]],
      ['a registry order inversion', [alignmentRow(), row()]],
      ['a slot label that does not match its ordinal', [row({ slot: 'GOAL_CONSISTENCY' })]],
      ['a context kind that does not match its slot', [row({ context_kind: 'GOAL' })]],
      ['a non-UUID context identity', [row({ context_id: 'not-a-uuid' })]],
      ['a numeric value below the v1 structured scale', [row({ numeric_value: 0 })]],
      ['a numeric value above the v1 structured scale', [row({ numeric_value: 6 })]],
      ['a fractional numeric value', [row({ numeric_value: 2.5 })]],
      ['a RESOLVED mapping with a null semantic type', [row({ semantic_mapping_status: 'RESOLVED', semantic_type: null })]],
      ['an UNRESOLVED mapping carrying a semantic type', [row({ semantic_mapping_status: 'UNRESOLVED', semantic_type: 'STATE' })]],
      ['an unknown semantic mapping status', [row({ semantic_mapping_status: 'PARTIAL' })]],
      ['an assessed freshness state', [row({ freshness_state: 'FRESH' })]],
      ['an assessed confidence state', [row({ confidence_state: 'HIGH' })]],
    ];
    const survived = rejected
      .filter(([, rows]) => {
        try { instance.consumeSourceRows(rows as never); return true; } catch { return false; }
      })
      .map(([label]) => label);
    expect(survived).toEqual([]);
  });

  it('rejects a malformed request identity before any transport request is issued', async () => {
    const readBrainContextForTurn = jest.fn();
    const instance = new HimBrainContextService({ readBrainContextForTurn } as never);
    await expect(instance.read('not-a-uuid', 'token', SESSION, TURN)).rejects.toThrow('INVALID_BRAIN_CONTEXT_REQUEST');
    await expect(instance.read(USER, 'token', 'not-a-uuid', TURN)).rejects.toThrow('INVALID_BRAIN_CONTEXT_REQUEST');
    await expect(instance.read(USER, 'token', SESSION, 'not-a-uuid')).rejects.toThrow('INVALID_BRAIN_CONTEXT_REQUEST');
    expect(readBrainContextForTurn).not.toHaveBeenCalled();
  });

  it('propagates a transport rejection so the caller degrades visibly rather than inventing an empty answer', async () => {
    const instance = new HimBrainContextService({
      readBrainContextForTurn: jest.fn().mockRejectedValue(new Error('transport failure')),
    } as never);
    await expect(instance.read(USER, 'token', SESSION, TURN)).rejects.toThrow('transport failure');
  });

  it('performs no metric, relevance, currentness, or provider work of its own', () => {
    const source = readFileSync(`${__dirname}/him-brain-context.service.ts`, 'utf8');
    const executable = source.split('\n').filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*')).join('\n');
    for (const forbidden of [
      'rpc/', 'readSessionContextBindings', 'HimSessionContextBindingRepository', 'HimRepository',
      'readContextualCurrentIntelligenceBatch', 'read_him_latest_measurement', 'ModelRouter',
      'embedding', 'observedAt', 'observed_at', 'freshnessReference', 'confidenceReference',
      'temporal_window', 'trend', 'average', 'Math.',
    ]) expect(executable).not.toContain(forbidden);
    expect(HimBrainContextService.length).toBe(1);
  });
});
