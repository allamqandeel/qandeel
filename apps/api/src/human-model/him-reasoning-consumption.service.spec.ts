import { HimReasoningConsumptionService } from './him-reasoning-consumption.service';
import type { HimIntelligenceSnapshot, HimIntelligenceSnapshotMetric } from './him-intelligence-snapshot.types';

const service = new HimReasoningConsumptionService();
const contextId = '00000000-0000-4000-8000-000000000010';
const generatedAt = '2026-08-24T12:00:00.000Z';

const known = (metricKey = 'hse.stress', ordinalCategory: HimIntelligenceSnapshotMetric['ordinalCategory'] = 'MODERATE'): HimIntelligenceSnapshotMetric => ({
  metricKey, definitionVersion: 1, semanticType: 'STATE', valueState: 'ASSESSED', unassessedReason: null,
  ordinalCategory, scaleReference: `scale-${metricKey}`, scaleVersion: 1, observedAt: '2026-08-24T10:00:00.000Z',
  freshnessState: 'UNASSESSED', freshnessReference: null, confidenceState: 'UNASSESSED', confidenceReference: null,
  validityStatus: 'VALID', measurementEventId: `event-${metricKey}`, measurementObservationId: `observation-${metricKey}`,
  calculationResultId: `result-${metricKey}`, canonicalBindingId: `binding-${metricKey}`,
  instrumentId: `instrument-${metricKey}`, instrumentVersion: 1, modelId: `model-${metricKey}`, modelVersion: 1,
});
const unknown = (metricKey: string, reason: NonNullable<HimIntelligenceSnapshotMetric['unassessedReason']>): HimIntelligenceSnapshotMetric => {
  if (reason === 'NO_MEASUREMENT_EVENT') return {
    ...known(metricKey), valueState: 'UNASSESSED', unassessedReason: reason, ordinalCategory: null, scaleReference: null,
    scaleVersion: null, observedAt: null, validityStatus: null, measurementEventId: null, measurementObservationId: null,
    calculationResultId: null, canonicalBindingId: null, instrumentId: null, instrumentVersion: null, modelId: null, modelVersion: null,
  };
  const metric = { ...known(metricKey), valueState: 'UNASSESSED' as const, unassessedReason: reason, ordinalCategory: null };
  return reason === 'LATEST_EVENT_INVALIDATED' ? { ...metric, validityStatus: 'INVALIDATED' } : metric;
};
const snapshot = (metrics: HimIntelligenceSnapshotMetric[], kind: HimIntelligenceSnapshot['contextKind'] = 'SITUATION'): HimIntelligenceSnapshot => {
  const assessedMetricCount = metrics.filter((metric) => metric.valueState === 'ASSESSED').length;
  return {
    snapshotContractVersion: 1, contextKind: kind, contextId, generatedAt,
    coverageState: assessedMetricCount === metrics.length ? 'FULL' : assessedMetricCount === 0 ? 'EMPTY' : 'PARTIAL',
    eligibleMetricCount: metrics.length, assessedMetricCount, unassessedMetricCount: metrics.length - assessedMetricCount, metrics,
  };
};

describe('HIM Reasoning Consumption Bridge v1', () => {
  it.each([
    [[known('hse.stress')], 'FULL'],
    [[known('hse.stress'), unknown('hse.attention', 'NO_MEASUREMENT_EVENT')], 'PARTIAL'],
    [[unknown('hse.stress', 'NO_MEASUREMENT_EVENT')], 'EMPTY'],
  ] as const)('preserves %s snapshot coverage as %s', (metrics, coverage) => {
    expect(service.transform(snapshot([...metrics]))).toMatchObject({ source: 'HIM_INTELLIGENCE_SNAPSHOT', coverageState: coverage });
  });

  it.each([
    ['NO_MEASUREMENT_EVENT', 'NO_MEASUREMENT'],
    ['LATEST_EVENT_UNASSESSED', 'LATEST_MEASUREMENT_UNASSESSED'],
    ['LATEST_EVENT_INVALIDATED', 'LATEST_MEASUREMENT_INVALIDATED'],
    ['INCOMPATIBLE_ACTIVE_BINDING', 'INCOMPATIBLE_ACTIVE_BINDING'],
  ] as const)('normalizes %s exactly', (input, output) => {
    expect(service.transform(snapshot([unknown('hse.stress', input)])).metrics[0]).toMatchObject({ knowledgeState: 'UNKNOWN', unknownReason: output, ordinalCategory: null, observationQualifier: null });
  });

  it.each(['VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'] as const)('copies %s as a latest known ordinal category', (category) => {
    expect(service.transform(snapshot([known('hse.stress', category)])).metrics[0]).toMatchObject({ knowledgeState: 'KNOWN', ordinalCategory: category, observationQualifier: 'LATEST_KNOWN' });
  });

  it('preserves context, generation time, counts, freshness, confidence, and provenance', () => {
    const input = snapshot([known()]);
    const output = service.transform(input);
    expect(output).toMatchObject({ sourceSnapshotContractVersion: 1, contextKind: 'SITUATION', contextId, generatedAt, eligibleMetricCount: 1, assessedMetricCount: 1, unassessedMetricCount: 0 });
    expect(output.metrics[0]).toEqual(expect.objectContaining({ freshnessState: 'UNASSESSED', freshnessReference: null, confidenceState: 'UNASSESSED', confidenceReference: null, measurementEventId: 'event-hse.stress', measurementObservationId: 'observation-hse.stress', calculationResultId: 'result-hse.stress', canonicalBindingId: 'binding-hse.stress', instrumentId: 'instrument-hse.stress', instrumentVersion: 1, modelId: 'model-hse.stress', modelVersion: 1 }));
  });

  it('rejects duplicate metrics and coverage/count mismatches', () => {
    expect(() => service.transform(snapshot([known(), known()]))).toThrow('INTEGRITY_FAILURE');
    expect(() => service.transform({ ...snapshot([known()]), coverageState: 'EMPTY' })).toThrow('INTEGRITY_FAILURE');
    expect(() => service.transform({ ...snapshot([known()]), assessedMetricCount: 0 })).toThrow('INTEGRITY_FAILURE');
  });

  it('rejects known values without observedAt or ordinalCategory', () => {
    expect(() => service.transform(snapshot([{ ...known(), observedAt: null }]))).toThrow('INTEGRITY_FAILURE');
    expect(() => service.transform(snapshot([{ ...known(), ordinalCategory: null }]))).toThrow('INTEGRITY_FAILURE');
  });

  it('rejects unknown values with an ordinal category', () => {
    expect(() => service.transform(snapshot([{ ...unknown('hse.stress', 'NO_MEASUREMENT_EVENT'), ordinalCategory: 'LOW' }]))).toThrow('INTEGRITY_FAILURE');
  });

  it('rejects unsupported contract versions and contexts', () => {
    expect(() => service.transform({ ...snapshot([known()]), snapshotContractVersion: 2 } as unknown as HimIntelligenceSnapshot)).toThrow('INTEGRITY_FAILURE');
    expect(() => service.transform({ ...snapshot([known()]), contextKind: 'GLOBAL' } as unknown as HimIntelligenceSnapshot)).toThrow('INTEGRITY_FAILURE');
  });

  it('rejects freshness, confidence, and provenance contradictions', () => {
    expect(() => service.transform(snapshot([{ ...known(), freshnessState: 'ASSESSED' } as unknown as HimIntelligenceSnapshotMetric]))).toThrow('INTEGRITY_FAILURE');
    expect(() => service.transform(snapshot([{ ...known(), confidenceReference: 'invented' } as unknown as HimIntelligenceSnapshotMetric]))).toThrow('INTEGRITY_FAILURE');
    expect(() => service.transform(snapshot([{ ...known(), calculationResultId: null }]))).toThrow('INTEGRITY_FAILURE');
    expect(() => service.transform(snapshot([{ ...unknown('hse.stress', 'NO_MEASUREMENT_EVENT'), modelId: 'contradiction' }]))).toThrow('INTEGRITY_FAILURE');
    expect(() => service.transform(snapshot([{ ...unknown('hse.stress', 'LATEST_EVENT_UNASSESSED'), calculationResultId: null }]))).toThrow('INTEGRITY_FAILURE');
  });

  it('is a synchronous pure transform with no repository or database dependency', () => {
    expect(HimReasoningConsumptionService.length).toBe(0);
    expect(service.transform(snapshot([known()]))).not.toBeInstanceOf(Promise);
  });
});
