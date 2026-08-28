import { HimSessionReflectionConsumptionService } from './him-session-reflection-consumption.service';
import type {
  HimContextualCurrentMetric,
  HimContextualCurrentSelection,
  HimContextualCurrentUnknownReason,
} from './him-contextual-current-intelligence.types';

const sessionId = '20000000-0000-4000-8000-000000000001';
const bindingId = '40000000-0000-4000-8000-000000000004';

const knownMetric = (numericValue: number): HimContextualCurrentMetric => ({
  metricKey: 'hbs.reflection', definitionVersion: 1, hifOwner: 'HBS',
  semanticMappingStatus: 'UNRESOLVED', semanticType: null,
  knowledgeState: 'KNOWN', numericValue, unknownReason: null,
  canonicalBindingId: bindingId, observedAt: '2026-08-27T00:00:00.000Z',
  temporalWindowStart: null, temporalWindowEnd: null,
  freshnessState: 'UNASSESSED', freshnessReference: null,
  confidenceState: 'UNASSESSED', confidenceReference: null,
});

const unknownMetric = (unknownReason: HimContextualCurrentUnknownReason): HimContextualCurrentMetric => ({
  ...knownMetric(1), knowledgeState: 'UNKNOWN', numericValue: null, unknownReason,
  canonicalBindingId: null, observedAt: null,
});

const selectionOf = (metric: HimContextualCurrentMetric): HimContextualCurrentSelection => ({
  contractVersion: 1, source: 'HIM_CANONICAL_LATEST_MEASUREMENT',
  contextKind: 'CONVERSATION_SESSION', contextId: sessionId,
  coverageState: metric.knowledgeState === 'KNOWN' ? 'FULL' : 'EMPTY',
  requestedMetricCount: 1,
  knownMetricCount: metric.knowledgeState === 'KNOWN' ? 1 : 0,
  unknownMetricCount: metric.knowledgeState === 'KNOWN' ? 0 : 1,
  metrics: [metric],
});

const known = (numericValue: number): HimContextualCurrentSelection => selectionOf(knownMetric(numericValue));
const unknown = (reason: HimContextualCurrentUnknownReason): HimContextualCurrentSelection => selectionOf(unknownMetric(reason));

describe('HimSessionReflectionConsumptionService (QHIA-005)', () => {
  const service = new HimSessionReflectionConsumptionService();

  describe('frozen deterministic mapping across the canonical structured ordinal', () => {
    it.each([
      [1, 'ACTIVE', 'GENTLE_REFLECTION_INVITATION'],
      [2, 'ACTIVE', 'GENTLE_REFLECTION_INVITATION'],
      [3, 'NONE', 'DEFAULT'],
      [4, 'ACTIVE', 'AVOID_REDUNDANT_REFLECTION'],
      [5, 'ACTIVE', 'AVOID_REDUNDANT_REFLECTION'],
    ] as const)('maps KNOWN %i to %s / %s', (numericValue, guidanceState, directive) => {
      expect(service.consume(known(numericValue))).toEqual({ contractVersion: 1, guidanceState, directive });
    });

    it.each([
      'NO_CANONICAL_CURRENT_VALUE',
      'LATEST_VALUE_UNASSESSED',
      'LATEST_VALUE_INVALIDATED',
      'INCOMPATIBLE_ACTIVE_BINDING',
    ] as const)('maps every valid QHIA-004 UNKNOWN reason (%s) to NONE / DEFAULT with no substitution', (reason) => {
      expect(service.consume(unknown(reason))).toEqual({ contractVersion: 1, guidanceState: 'NONE', directive: 'DEFAULT' });
    });

    it('is deterministic for repeated identical input', () => {
      const first = service.consume(known(4));
      expect(service.consume(known(4))).toEqual(first);
      expect(service.consume(known(4))).toEqual(first);
    });

    it('produces byte-identical guidance when only observedAt differs: no temporal, Trend, or recency inference', () => {
      const early = { ...known(2), metrics: [{ ...knownMetric(2), observedAt: '2020-01-01T00:00:00.000Z' }] };
      const late = { ...known(2), metrics: [{ ...knownMetric(2), observedAt: '2026-08-28T23:59:59.999Z' }] };
      const nullObserved = { ...known(2), metrics: [{ ...knownMetric(2), observedAt: null }] };
      const reference = JSON.stringify(service.consume(known(2)));
      expect(JSON.stringify(service.consume(early))).toBe(reference);
      expect(JSON.stringify(service.consume(late))).toBe(reference);
      expect(JSON.stringify(service.consume(nullObserved))).toBe(reference);
    });

    it('exposes no numeric value, metric key, context id, binding, or timestamp in the guidance output', () => {
      for (const numericValue of [1, 2, 3, 4, 5]) {
        const serialized = JSON.stringify(service.consume(known(numericValue)));
        expect(serialized).not.toMatch(/hbs\.|numericValue|observedAt|canonicalBinding|temporalWindow|0000-4000/u);
        expect(Object.keys(service.consume(known(numericValue)))).toEqual(['contractVersion', 'guidanceState', 'directive']);
      }
    });
  });

  describe('fail-closed integrity validation', () => {
    const rejects = (selection: HimContextualCurrentSelection) =>
      expect(() => service.consume(selection)).toThrow('INTEGRITY_FAILURE');

    it('rejects a wrong context kind: SITUATION Reflection is not activated by this task', () => {
      rejects({ ...known(2), contextKind: 'SITUATION' as never });
      rejects({ ...known(2), contextKind: 'GOAL' as never });
      rejects({ ...known(2), contextKind: 'RELATIONSHIP' as never });
    });

    it('rejects a missing or non-UUID context id', () => {
      rejects({ ...known(2), contextId: '' });
      rejects({ ...known(2), contextId: 'not-a-uuid' });
      rejects({ ...known(2), contextId: 'GLOBAL' });
    });

    it('rejects any sibling metric: no HSE/HRS/HGS or other HBS metric is consumable here', () => {
      for (const metricKey of ['hse.stress', 'hse.energy', 'hse.attention', 'hbs.avoidance', 'hbs.consistency', 'hrs.communication', 'hgs.self-awareness']) {
        rejects({ ...known(2), metrics: [{ ...knownMetric(2), metricKey }] });
      }
    });

    it('rejects a wrong definition version, owner, or semantic mapping', () => {
      rejects({ ...known(2), metrics: [{ ...knownMetric(2), definitionVersion: 2 as never }] });
      rejects({ ...known(2), metrics: [{ ...knownMetric(2), hifOwner: 'HSE' as never }] });
      rejects({ ...known(2), metrics: [{ ...knownMetric(2), semanticMappingStatus: 'RESOLVED' as never }] });
      rejects({ ...known(2), metrics: [{ ...knownMetric(2), semanticType: 'STATE' as never }] });
    });

    it('rejects a wrong contract version or source', () => {
      rejects({ ...known(2), contractVersion: 2 as never });
      rejects({ ...known(2), source: 'HIM_INTELLIGENCE_SNAPSHOT' as never });
    });

    it('rejects a wrong requested metric count and a missing or extra metric', () => {
      rejects({ ...known(2), requestedMetricCount: 2 as never });
      rejects({ ...known(2), requestedMetricCount: 0 as never });
      rejects({ ...known(2), metrics: [] });
      rejects({ ...known(2), metrics: [knownMetric(2), knownMetric(2)] });
    });

    it('rejects known/unknown count and coverage incoherence', () => {
      rejects({ ...known(2), knownMetricCount: 0, unknownMetricCount: 1 });
      rejects({ ...known(2), knownMetricCount: 2, unknownMetricCount: -1 });
      rejects({ ...known(2), coverageState: 'EMPTY' });
      rejects({ ...known(2), coverageState: 'PARTIAL' });
      rejects({ ...unknown('NO_CANONICAL_CURRENT_VALUE'), coverageState: 'FULL' });
      rejects({ ...unknown('NO_CANONICAL_CURRENT_VALUE'), knownMetricCount: 1, unknownMetricCount: 0 });
    });

    it('rejects KNOWN without a usable integer 1-5 numeric value', () => {
      rejects({ ...known(2), metrics: [{ ...knownMetric(2), numericValue: null }] });
      rejects(selectionOf({ ...knownMetric(0) }));
      rejects(selectionOf({ ...knownMetric(6) }));
      rejects(selectionOf({ ...knownMetric(2.5) }));
      rejects(selectionOf({ ...knownMetric(Number.NaN) }));
    });

    it('rejects KNOWN carrying an unknown reason and UNKNOWN carrying a numeric value', () => {
      rejects(selectionOf({ ...knownMetric(2), unknownReason: 'NO_CANONICAL_CURRENT_VALUE' }));
      rejects(selectionOf({ ...unknownMetric('LATEST_VALUE_UNASSESSED'), numericValue: 3 }));
    });

    it('rejects UNKNOWN with a missing or non-QHIA-004 unknown reason', () => {
      rejects(selectionOf({ ...unknownMetric('NO_CANONICAL_CURRENT_VALUE'), unknownReason: null }));
      rejects(selectionOf({ ...unknownMetric('NO_CANONICAL_CURRENT_VALUE'), unknownReason: 'SOMETHING_ELSE' as never }));
    });

    it('rejects a knowledge state outside KNOWN/UNKNOWN', () => {
      rejects(selectionOf({ ...knownMetric(2), knowledgeState: 'ASSESSED' as never }));
    });

    it('rejects malformed freshness/confidence and any non-null temporal window', () => {
      rejects(selectionOf({ ...knownMetric(2), freshnessState: 'FRESH' as never }));
      rejects(selectionOf({ ...knownMetric(2), freshnessReference: 'reference' as never }));
      rejects(selectionOf({ ...knownMetric(2), confidenceState: 'HIGH' as never }));
      rejects(selectionOf({ ...knownMetric(2), confidenceReference: 'reference' as never }));
      rejects(selectionOf({ ...knownMetric(2), temporalWindowStart: '2026-08-01T00:00:00.000Z' }));
      rejects(selectionOf({ ...knownMetric(2), temporalWindowEnd: '2026-08-28T00:00:00.000Z' }));
    });

    it('never reinterprets a malformed binding or timestamp', () => {
      rejects(selectionOf({ ...knownMetric(2), canonicalBindingId: null }));
      rejects(selectionOf({ ...knownMetric(2), canonicalBindingId: 'not-a-uuid' }));
      rejects(selectionOf({ ...knownMetric(2), observedAt: 42 as never }));
      rejects(selectionOf({ ...unknownMetric('LATEST_VALUE_INVALIDATED'), canonicalBindingId: bindingId }));
      rejects(selectionOf({ ...unknownMetric('LATEST_VALUE_INVALIDATED'), observedAt: '2026-08-27T00:00:00.000Z' }));
    });

    it('rejects a non-object selection or metric', () => {
      rejects(null as never);
      rejects({ ...known(2), metrics: [null as never] });
    });
  });
});
