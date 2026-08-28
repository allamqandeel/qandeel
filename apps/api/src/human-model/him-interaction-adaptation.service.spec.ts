import { HimInteractionAdaptationService } from './him-interaction-adaptation.service';
import type { HimInteractionAdaptation } from './him-interaction-adaptation.types';
import type { HimReasoningContext, HimReasoningMetric } from './him-reasoning-consumption.types';

const service = new HimInteractionAdaptationService();
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
  ...known(metricKey), knowledgeState: 'UNKNOWN', unknownReason: 'NO_MEASUREMENT',
  ordinalCategory: null, observationQualifier: null, validityStatus: null,
});
const reasoning = (metrics: HimReasoningMetric[], overrides: Partial<HimReasoningContext> = {}): HimReasoningContext => {
  const assessedMetricCount = metrics.filter((metric) => metric.knowledgeState === 'KNOWN').length;
  return {
    source: 'HIM_INTELLIGENCE_SNAPSHOT', sourceSnapshotContractVersion: 1,
    contextKind: 'CONVERSATION_SESSION', contextId, generatedAt: '2026-08-24T01:00:00.000Z',
    coverageState: assessedMetricCount === metrics.length ? 'FULL' : assessedMetricCount === 0 ? 'EMPTY' : 'PARTIAL',
    eligibleMetricCount: metrics.length, assessedMetricCount,
    unassessedMetricCount: metrics.length - assessedMetricCount, metrics, ...overrides,
  };
};
const session = (
  stress: HimReasoningMetric['ordinalCategory'] | 'UNKNOWN' = 'UNKNOWN',
  energy: HimReasoningMetric['ordinalCategory'] | 'UNKNOWN' = 'UNKNOWN',
  attention: HimReasoningMetric['ordinalCategory'] | 'UNKNOWN' = 'UNKNOWN',
): HimReasoningContext => reasoning([
  stress === 'UNKNOWN' ? unknown('hse.stress') : known('hse.stress', stress),
  energy === 'UNKNOWN' ? unknown('hse.energy') : known('hse.energy', energy),
  attention === 'UNKNOWN' ? unknown('hse.attention') : known('hse.attention', attention),
]);
const DEFAULT_DIRECTIVES: HimInteractionAdaptation['directives'] = {
  responseDensity: 'DEFAULT', cognitiveLoad: 'DEFAULT', branching: 'DEFAULT',
  steeringPressure: 'DEFAULT', deliveryPacing: 'DEFAULT', stepBatching: 'DEFAULT',
};
const none: HimInteractionAdaptation = {
  contractVersion: 1, source: 'HIM_REASONING_CONTEXT', sourceSnapshotContractVersion: 1,
  contextKind: 'CONVERSATION_SESSION', contextId,
  adaptationState: 'NONE', directives: DEFAULT_DIRECTIVES, drivers: [],
};

describe('HIM Interaction Adaptation v1 (QHIA-001)', () => {
  describe('stress policy', () => {
    it.each(['HIGH', 'VERY_HIGH'] as const)('activates the stress driver for KNOWN %s with exactly its burden reductions', (ordinal) => {
      expect(service.derive(session(ordinal))).toEqual({
        ...none, adaptationState: 'ACTIVE', drivers: ['STRESS_HIGH_OR_VERY_HIGH'],
        directives: { ...DEFAULT_DIRECTIVES, cognitiveLoad: 'REDUCED', steeringPressure: 'REDUCED', deliveryPacing: 'CALMER' },
      });
    });

    it.each(['VERY_LOW', 'LOW', 'MODERATE'] as const)('derives no adaptation for KNOWN stress %s', (ordinal) => {
      expect(service.derive(session(ordinal))).toEqual(none);
    });
  });

  describe('energy policy', () => {
    it.each(['VERY_LOW', 'LOW'] as const)('activates the energy driver for KNOWN %s with exactly its burden reductions', (ordinal) => {
      expect(service.derive(session('UNKNOWN', ordinal))).toEqual({
        ...none, adaptationState: 'ACTIVE', drivers: ['ENERGY_LOW_OR_VERY_LOW'],
        directives: { ...DEFAULT_DIRECTIVES, responseDensity: 'COMPACT', stepBatching: 'ONE_AT_A_TIME' },
      });
    });

    it.each(['MODERATE', 'HIGH', 'VERY_HIGH'] as const)('derives no adaptation and never increases burden for KNOWN energy %s', (ordinal) => {
      expect(service.derive(session('UNKNOWN', ordinal))).toEqual(none);
    });
  });

  describe('attention policy', () => {
    it.each(['VERY_LOW', 'LOW'] as const)('activates the attention driver for KNOWN %s with exactly its burden reductions', (ordinal) => {
      expect(service.derive(session('UNKNOWN', 'UNKNOWN', ordinal))).toEqual({
        ...none, adaptationState: 'ACTIVE', drivers: ['ATTENTION_LOW_OR_VERY_LOW'],
        directives: { ...DEFAULT_DIRECTIVES, cognitiveLoad: 'REDUCED', branching: 'SINGLE_TRACK', stepBatching: 'ONE_AT_A_TIME' },
      });
    });

    it.each(['MODERATE', 'HIGH', 'VERY_HIGH'] as const)('derives no adaptation and never increases burden for KNOWN attention %s', (ordinal) => {
      expect(service.derive(session('UNKNOWN', 'UNKNOWN', ordinal))).toEqual(none);
    });
  });

  describe('UNKNOWN semantics', () => {
    it('derives NONE for all-UNKNOWN (EMPTY) with no zero/moderate/older fallback', () => {
      const result = service.derive(session());
      expect(result).toEqual(none);
      expect(JSON.stringify(result)).not.toMatch(/MODERATE|LATEST_KNOWN|observedAt/u);
    });

    it('keeps FULL, PARTIAL, and EMPTY coverage coherent while each UNKNOWN contributes no driver', () => {
      expect(service.derive(session('MODERATE', 'MODERATE', 'MODERATE'))).toEqual(none); // FULL
      expect(service.derive(session('HIGH', 'UNKNOWN', 'UNKNOWN'))).toMatchObject({ drivers: ['STRESS_HIGH_OR_VERY_HIGH'] }); // PARTIAL
      expect(service.derive(session('UNKNOWN', 'HIGH', 'UNKNOWN'))).toEqual(none); // PARTIAL, favorable energy
      expect(service.derive(session())).toEqual(none); // EMPTY
    });

    it.each([
      ['stress', session('UNKNOWN', 'LOW', 'LOW'), ['ENERGY_LOW_OR_VERY_LOW', 'ATTENTION_LOW_OR_VERY_LOW']],
      ['energy', session('HIGH', 'UNKNOWN', 'LOW'), ['STRESS_HIGH_OR_VERY_HIGH', 'ATTENTION_LOW_OR_VERY_LOW']],
      ['attention', session('HIGH', 'LOW', 'UNKNOWN'), ['STRESS_HIGH_OR_VERY_HIGH', 'ENERGY_LOW_OR_VERY_LOW']],
    ] as const)('an UNKNOWN %s never substitutes a default and never blocks the other drivers', (_metric, context, drivers) => {
      expect(service.derive(context).drivers).toEqual([...drivers]);
    });
  });

  describe('combination semantics', () => {
    const single = {
      stress: service.derive(session('HIGH')),
      energy: service.derive(session('UNKNOWN', 'LOW')),
      attention: service.derive(session('UNKNOWN', 'UNKNOWN', 'LOW')),
    };
    const union = (...adaptations: HimInteractionAdaptation[]): HimInteractionAdaptation['directives'] => {
      const combined = { ...DEFAULT_DIRECTIVES };
      for (const adaptation of adaptations) for (const key of Object.keys(combined) as Array<keyof typeof combined>) {
        if (adaptation.directives[key] !== 'DEFAULT') combined[key] = adaptation.directives[key] as never;
      }
      return combined;
    };

    it.each([
      ['high stress + low energy', session('HIGH', 'LOW'), ['STRESS_HIGH_OR_VERY_HIGH', 'ENERGY_LOW_OR_VERY_LOW'], [single.stress, single.energy]],
      ['high stress + low attention', session('VERY_HIGH', 'UNKNOWN', 'VERY_LOW'), ['STRESS_HIGH_OR_VERY_HIGH', 'ATTENTION_LOW_OR_VERY_LOW'], [single.stress, single.attention]],
      ['low energy + low attention', session('MODERATE', 'VERY_LOW', 'LOW'), ['ENERGY_LOW_OR_VERY_LOW', 'ATTENTION_LOW_OR_VERY_LOW'], [single.energy, single.attention]],
      ['all three burden signals', session('HIGH', 'LOW', 'VERY_LOW'), ['STRESS_HIGH_OR_VERY_HIGH', 'ENERGY_LOW_OR_VERY_LOW', 'ATTENTION_LOW_OR_VERY_LOW'], [single.stress, single.energy, single.attention]],
    ] as const)('%s combines by monotonic union with no cancellation', (_label, context, drivers, parts) => {
      const result = service.derive(context);
      expect(result.adaptationState).toBe('ACTIVE');
      expect(result.drivers).toEqual([...drivers]);
      expect(result.directives).toEqual(union(...(parts as unknown as HimInteractionAdaptation[])));
      // Monotonic: every single-driver burden reduction survives in the union.
      for (const part of parts as unknown as HimInteractionAdaptation[]) {
        for (const key of Object.keys(DEFAULT_DIRECTIVES) as Array<keyof typeof DEFAULT_DIRECTIVES>) {
          if (part.directives[key] !== 'DEFAULT') expect(result.directives[key]).toBe(part.directives[key]);
        }
      }
    });

    it('keeps the canonical stress, energy, attention driver order independent of metric traversal order', () => {
      const reversed = reasoning([known('hse.attention', 'LOW'), known('hse.energy', 'LOW'), known('hse.stress', 'HIGH')]);
      expect(service.derive(reversed).drivers).toEqual(['STRESS_HIGH_OR_VERY_HIGH', 'ENERGY_LOW_OR_VERY_LOW', 'ATTENTION_LOW_OR_VERY_LOW']);
      expect(service.derive(reversed)).toEqual(service.derive(session('HIGH', 'LOW', 'LOW')));
    });

    it('reports NONE with all-DEFAULT directives and empty drivers when nothing activates', () => {
      expect(service.derive(session('MODERATE', 'VERY_HIGH', 'HIGH'))).toEqual(none);
    });
  });

  describe('integrity and eligibility leakage', () => {
    it.each([
      ['wrong context kind', session().metrics, { contextKind: 'GOAL' } as never],
      ['wrong source', session().metrics, { source: 'HIM_TREND' } as never],
      ['wrong snapshot contract version', session().metrics, { sourceSnapshotContractVersion: 2 } as never],
      ['malformed eligible count', session().metrics, { eligibleMetricCount: 4 } as never],
      ['malformed assessed count', session().metrics, { assessedMetricCount: 1 } as never],
      ['malformed unassessed count', session().metrics, { unassessedMetricCount: 1 } as never],
      ['coverage mismatch', session().metrics, { coverageState: 'FULL' } as never],
    ] as const)('fails closed for %s', (_label, metrics, overrides) => {
      expect(() => service.derive(reasoning([...metrics], overrides))).toThrow('INTEGRITY_FAILURE');
    });

    it.each([
      ['duplicate slot', [unknown('hse.stress'), unknown('hse.stress'), unknown('hse.attention')]],
      ['missing slot', [unknown('hse.stress'), unknown('hse.energy')]],
      ['extra slot', [unknown('hse.stress'), unknown('hse.energy'), unknown('hse.attention'), unknown('hse.motivation')]],
      ['cross-context hse.motivation', [unknown('hse.stress'), unknown('hse.energy'), unknown('hse.motivation')]],
      ['cross-context hse.self-confidence', [unknown('hse.stress'), unknown('hse.energy'), unknown('hse.self-confidence')]],
      ['HBS metric', [unknown('hse.stress'), unknown('hse.energy'), unknown('hbs.consistency')]],
      ['HRS metric', [unknown('hse.stress'), unknown('hse.energy'), unknown('hrs.communication')]],
      ['HGS purpose-alignment', [unknown('hse.stress'), unknown('hse.energy'), unknown('hgs.purpose-alignment')]],
    ] as const)('fails closed on %s and never silently ignores it', (_label, metrics) => {
      expect(() => service.derive(reasoning([...metrics]))).toThrow('INTEGRITY_FAILURE');
    });

    it.each([
      ['KNOWN with null ordinal', { ...known('hse.stress'), ordinalCategory: null }],
      ['KNOWN with invalid ordinal', { ...known('hse.stress'), ordinalCategory: 'EXTREME' as never }],
      ['KNOWN with an unknown reason', { ...known('hse.stress'), unknownReason: 'NO_MEASUREMENT' as never }],
      ['UNKNOWN with a non-null ordinal', { ...unknown('hse.stress'), ordinalCategory: 'LOW' as never }],
      ['UNKNOWN without an unknown reason', { ...unknown('hse.stress'), unknownReason: null as never }],
      ['non-v1 definition version', { ...known('hse.stress'), definitionVersion: 2 as never }],
      ['non-STATE semantic type', { ...known('hse.stress'), semanticType: 'TRAIT' as never }],
      ['assessed freshness', { ...known('hse.stress'), freshnessState: 'ASSESSED' as never }],
      ['freshness reference', { ...known('hse.stress'), freshnessReference: 'ref' as never }],
      ['assessed confidence', { ...known('hse.stress'), confidenceState: 'ASSESSED' as never }],
      ['confidence reference', { ...known('hse.stress'), confidenceReference: 'ref' as never }],
      ['invalid knowledge state', { ...known('hse.stress'), knowledgeState: 'ESTIMATED' as never }],
    ] as const)('fails closed for %s without coercion or recovery', (_label, stress) => {
      expect(() => service.derive(reasoning([stress, unknown('hse.energy'), unknown('hse.attention')]))).toThrow('INTEGRITY_FAILURE');
    });
  });

  describe('temporal non-inference', () => {
    it('derives byte-identical adaptations for contexts differing only in timestamps and provenance identifiers', () => {
      const base = session('HIGH', 'LOW', 'UNKNOWN');
      const shifted = reasoning(base.metrics.map((metric) => (metric.knowledgeState === 'KNOWN' ? {
        ...metric, observedAt: '2020-01-01T00:00:00.000Z',
        measurementEventId: `other-event-${metric.metricKey}`, measurementObservationId: `other-observation-${metric.metricKey}`,
        calculationResultId: `other-result-${metric.metricKey}`, canonicalBindingId: `other-binding-${metric.metricKey}`,
        instrumentId: `other-instrument-${metric.metricKey}`, modelId: `other-model-${metric.metricKey}`,
      } : metric)), { generatedAt: '2019-01-01T00:00:00.000Z' });
      expect(JSON.stringify(service.derive(shifted))).toBe(JSON.stringify(service.derive(base)));
    });

    it('produces no trend, recency, decay, or duration signal in the output', () => {
      const serialized = JSON.stringify(service.derive(session('VERY_HIGH', 'VERY_LOW', 'VERY_LOW')));
      expect(serialized).not.toMatch(/trend|observedAt|generatedAt|fresh|recen|decay|duration|score|average|probability|confidence/iu);
    });
  });

  describe('purity and determinism', () => {
    it('is pure, dependency-free, non-mutating, and byte-for-byte repeatable', () => {
      const input = session('HIGH', 'LOW', 'LOW');
      const before = JSON.stringify(input);
      expect(HimInteractionAdaptationService.length).toBe(0);
      const first = service.derive(input);
      expect(first).not.toBeInstanceOf(Promise);
      expect(JSON.stringify(service.derive(input))).toBe(JSON.stringify(first));
      expect(JSON.stringify(input)).toBe(before);
    });
  });
});
