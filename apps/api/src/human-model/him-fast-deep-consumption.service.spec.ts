import { HimFastDeepConsumptionService } from './him-fast-deep-consumption.service';
import type { HimReasoningContext, HimReasoningMetric } from './him-reasoning-consumption.types';

const policy = new HimFastDeepConsumptionService();
const contextId = '20000000-0000-4000-8000-000000000001';
const known = (metricKey: string, ordinalCategory: HimReasoningMetric['ordinalCategory'] = 'MODERATE'): HimReasoningMetric => ({
  metricKey, definitionVersion: 1, semanticType: 'STATE', knowledgeState: 'KNOWN', unknownReason: null,
  ordinalCategory, observationQualifier: 'LATEST_KNOWN', scaleReference: `scale-${metricKey}`, scaleVersion: 1,
  observedAt: '2026-08-24T00:00:00.000Z', freshnessState: 'UNASSESSED', freshnessReference: null,
  confidenceState: 'UNASSESSED', confidenceReference: null, validityStatus: 'VALID',
  measurementEventId: `event-${metricKey}`, measurementObservationId: `observation-${metricKey}`,
  calculationResultId: `result-${metricKey}`, canonicalBindingId: `binding-${metricKey}`,
  instrumentId: `instrument-${metricKey}`, instrumentVersion: 1, modelId: `model-${metricKey}`, modelVersion: 1,
});
const unknown = (metricKey: string): HimReasoningMetric => ({
  ...known(metricKey), knowledgeState: 'UNKNOWN', unknownReason: 'LATEST_MEASUREMENT_UNASSESSED',
  ordinalCategory: null, observationQualifier: null, validityStatus: null,
});
const reasoning = (metrics: HimReasoningMetric[]): HimReasoningContext => {
  const assessedMetricCount = metrics.filter((metric) => metric.knowledgeState === 'KNOWN').length;
  return {
    source: 'HIM_INTELLIGENCE_SNAPSHOT', sourceSnapshotContractVersion: 1,
    contextKind: 'CONVERSATION_SESSION', contextId, generatedAt: '2026-08-24T01:00:00.000Z',
    coverageState: assessedMetricCount === metrics.length ? 'FULL' : assessedMetricCount === 0 ? 'EMPTY' : 'PARTIAL',
    eligibleMetricCount: metrics.length, assessedMetricCount,
    unassessedMetricCount: metrics.length - assessedMetricCount, metrics,
  };
};
const fixtures = {
  FULL: reasoning([known('hse.stress'), known('hse.energy')]),
  PARTIAL: reasoning([known('hse.stress'), unknown('hse.energy')]),
  EMPTY: reasoning([unknown('hse.stress'), unknown('hse.energy')]),
};

describe('FAST/DEEP HIM Consumption Policy v1', () => {
  it.each(['FULL', 'PARTIAL', 'EMPTY'] as const)('projects FAST %s with every eligible slot', (coverage) => {
    const result = policy.project('FAST', fixtures[coverage]);
    expect(result).toMatchObject({ contractVersion: 1, source: 'HIM_REASONING_CONTEXT', consumptionMode: 'FAST', contextKind: 'CONVERSATION_SESSION', contextId, coverageState: coverage, eligibleMetricCount: 2 });
    expect(result.metrics.map((metric) => metric.metricKey)).toEqual(['hse.stress', 'hse.energy']);
  });

  it.each(['FULL', 'PARTIAL', 'EMPTY'] as const)('projects DEEP %s with every eligible slot', (coverage) => {
    const result = policy.project('DEEP', fixtures[coverage]);
    expect(result).toMatchObject({ contractVersion: 1, source: 'HIM_REASONING_CONTEXT', consumptionMode: 'DEEP', contextKind: 'CONVERSATION_SESSION', contextId, coverageState: coverage, eligibleMetricCount: 2 });
    expect(result.metrics.map((metric) => metric.metricKey)).toEqual(['hse.stress', 'hse.energy']);
  });

  it('FAST exposes only key, knowledge state, and ordinal category', () => {
    const result = policy.project('FAST', fixtures.PARTIAL);
    expect(Object.keys(result.metrics[0])).toEqual(['metricKey', 'knowledgeState', 'ordinalCategory']);
    expect(result.metrics[1]).toEqual({ metricKey: 'hse.energy', knowledgeState: 'UNKNOWN', ordinalCategory: null });
    for (const forbidden of ['unknownReason', 'observedAt', 'validityStatus', 'observationQualifier', 'measurementEventId', 'scaleReference', 'instrumentId', 'modelId'])
      expect(result.metrics[0]).not.toHaveProperty(forbidden);
  });

  it('DEEP preserves semantic metadata and omits all audit provenance', () => {
    const result = policy.project('DEEP', fixtures.PARTIAL);
    expect(result.metrics[0]).toEqual({
      metricKey: 'hse.stress', knowledgeState: 'KNOWN', unknownReason: null, ordinalCategory: 'MODERATE',
      observationQualifier: 'LATEST_KNOWN', observedAt: '2026-08-24T00:00:00.000Z',
      freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED', validityStatus: 'VALID',
    });
    expect(result.metrics[1]).toMatchObject({ knowledgeState: 'UNKNOWN', unknownReason: 'LATEST_MEASUREMENT_UNASSESSED', ordinalCategory: null });
    for (const forbidden of ['measurementEventId', 'measurementObservationId', 'calculationResultId', 'canonicalBindingId', 'scaleReference', 'scaleVersion', 'instrumentId', 'instrumentVersion', 'modelId', 'modelVersion'])
      expect(result.metrics[0]).not.toHaveProperty(forbidden);
  });

  it.each(['VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'] as const)('preserves the KNOWN %s ordinal category', (category) => {
    expect(policy.project('FAST', reasoning([known('hse.stress', category)])).metrics[0].ordinalCategory).toBe(category);
    expect(policy.project('DEEP', reasoning([known('hse.stress', category)])).metrics[0].ordinalCategory).toBe(category);
  });

  it('preserves exact context identity and global unresolved freshness/confidence policies', () => {
    expect(policy.project('FAST', fixtures.PARTIAL)).toMatchObject({ contextId, freshnessPolicy: 'UNASSESSED', confidencePolicy: 'UNASSESSED', knownMetricCount: 1, unknownMetricCount: 1 });
  });

  it('fails closed for unsupported context, duplicate keys, and coverage mismatch', () => {
    expect(() => policy.project('FAST', { ...fixtures.FULL, contextKind: 'GOAL' } as unknown as HimReasoningContext)).toThrow('INTEGRITY_FAILURE');
    expect(() => policy.project('FAST', { ...fixtures.FULL, sourceSnapshotContractVersion: 2 } as unknown as HimReasoningContext)).toThrow('INTEGRITY_FAILURE');
    expect(() => policy.project('FAST', reasoning([known('hse.stress'), known('hse.stress')]))).toThrow('INTEGRITY_FAILURE');
    expect(() => policy.project('FAST', { ...fixtures.PARTIAL, coverageState: 'FULL' })).toThrow('INTEGRITY_FAILURE');
  });

  it('fails closed for an unsupported path and malformed knowledge/freshness/confidence state', () => {
    expect(() => policy.project('BALANCED' as never, fixtures.FULL)).toThrow('INTEGRITY_FAILURE');
    expect(() => policy.project('FAST', reasoning([{ ...known('hse.stress'), ordinalCategory: null }]))).toThrow('INTEGRITY_FAILURE');
    expect(() => policy.project('FAST', reasoning([{ ...unknown('hse.stress'), ordinalCategory: 'LOW' }]))).toThrow('INTEGRITY_FAILURE');
    expect(() => policy.project('FAST', reasoning([{ ...known('hse.stress'), freshnessState: 'ASSESSED' } as unknown as HimReasoningMetric]))).toThrow('INTEGRITY_FAILURE');
    expect(() => policy.project('FAST', reasoning([{ ...known('hse.stress'), confidenceState: 'ASSESSED' } as unknown as HimReasoningMetric]))).toThrow('INTEGRITY_FAILURE');
  });

  it('is pure, dependency-free, and does not mutate canonical reasoning input', () => {
    const input = fixtures.PARTIAL;
    const before = JSON.stringify(input);
    expect(HimFastDeepConsumptionService.length).toBe(0);
    expect(policy.project('DEEP', input)).not.toBeInstanceOf(Promise);
    expect(JSON.stringify(input)).toBe(before);
  });
});
