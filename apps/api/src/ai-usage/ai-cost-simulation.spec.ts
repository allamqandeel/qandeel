import { creditsForRatedCost, ratedComponentAmount, simulateAiCost, type AiCostSimulationScenario, type SimulationPriceCard } from './ai-cost-simulation';
import { formatExact } from './exact-decimal';

// Every price below is a SYNTHETIC TEST_ONLY fixture. None is a provider's price, and none is used in production.
const card = (usageKind: SimulationPriceCard['usageKind'], unitPrice: string, extra: Partial<SimulationPriceCard> = {}): SimulationPriceCard =>
  ({ usageKind, unitPrice, priceBasisUnits: 1000000, currency: 'USD', effectiveFrom: '2026-01-01T00:00:00Z', source: 'TEST_ONLY synthetic fixture', ...extra });
const CARDS = [card('INPUT_TOKEN', '0.15'), card('CACHE_READ_INPUT_TOKEN', '0.015'), card('CACHE_WRITE_INPUT_TOKEN', '0.1875'), card('OUTPUT_TOKEN', '0.6')];
const scenario = (extra: Partial<AiCostSimulationScenario> = {}): AiCostSimulationScenario => ({
  scenarioLabel: 'TEST_ONLY four-kind fixture', provider: 'TEST_PROVIDER', model: 'test-model', eventAt: '2026-06-01T00:00:00Z',
  usage: { completeness: 'COMPLETE', quantities: { INPUT_TOKEN: 1234, CACHE_READ_INPUT_TOKEN: 5000, CACHE_WRITE_INPUT_TOKEN: 100, OUTPUT_TOKEN: 789 } },
  priceCards: CARDS, ...extra,
});
const POLICY = { policyKey: 'test_policy', policyVersion: 1, costCurrency: 'USD', creditsPerCostUnit: '1000', creditScale: 2, roundingMode: 'CEILING' } as const;

describe('AI-COST-01 cost simulator', () => {
  it('prices each kind independently and sums sub-cent components exactly', () => {
    const result = simulateAiCost(scenario());
    expect(result.pricingState).toBe('RATED');
    expect(result.components.map((c) => [c.usageKind, c.amount])).toEqual([
      ['CACHE_READ_INPUT_TOKEN', '0.000075'], ['CACHE_WRITE_INPUT_TOKEN', '0.00001875'], ['INPUT_TOKEN', '0.0001851'], ['OUTPUT_TOKEN', '0.0004734'],
    ]);
    expect(result.ratedCost).toBe('0.00075225');
    expect(result.currency).toBe('USD');
  });

  it('applies the price basis exactly (per 1, per 1 000, per 1 000 000)', () => {
    expect(formatExact(ratedComponentAmount(3, '0.5', 1))).toBe('1.5');
    expect(formatExact(ratedComponentAmount(1234, '0.002', 1000))).toBe('0.002468');
    expect(formatExact(ratedComponentAmount(1, '0.15', 1000000))).toBe('0.00000015');
    expect(() => ratedComponentAmount(1, '1', 100 as never)).toThrow(RangeError);
  });

  it('is deterministic: the same frozen inputs always give the same answer', () => {
    expect(JSON.stringify(simulateAiCost(scenario({ creditPolicy: POLICY })))).toBe(JSON.stringify(simulateAiCost(scenario({ creditPolicy: POLICY }))));
  });

  it('no Credit Policy means no Credits - never 0 Credits', () => {
    expect(simulateAiCost(scenario()).credit).toEqual({ state: 'CREDIT_POLICY_NOT_SUPPLIED' });
  });

  it('a supplied policy converts the exact rated cost, with its own rounding', () => {
    expect(simulateAiCost(scenario({ creditPolicy: POLICY })).credit).toEqual({ state: 'SIMULATED', policyKey: 'test_policy', policyVersion: 1, credits: '0.76' });
    expect(creditsForRatedCost('0.00075225', { ...POLICY, roundingMode: 'HALF_UP' })).toBe('0.75');
    expect(creditsForRatedCost('0.00075225', { ...POLICY, roundingMode: 'FLOOR' })).toBe('0.75');
    expect(creditsForRatedCost('0.00075225', { ...POLICY, creditScale: 0 })).toBe('1');
    expect(creditsForRatedCost('2', { ...POLICY, creditScale: 3 })).toBe('2000.000');
    expect(() => creditsForRatedCost('1', { ...POLICY, creditsPerCostUnit: '0' })).toThrow('INVALID_CREDIT_POLICY_INPUT');
    expect(simulateAiCost(scenario({ creditPolicy: { ...POLICY, costCurrency: 'EUR' } })).credit).toEqual({ state: 'NOT_COMPUTABLE', reason: 'CURRENCY_MISMATCH' });
  });

  it('missing price is UNPRICED, never $0', () => {
    const result = simulateAiCost(scenario({ priceCards: CARDS.filter((c) => c.usageKind !== 'CACHE_WRITE_INPUT_TOKEN'), creditPolicy: POLICY }));
    expect(result).toMatchObject({ pricingState: 'UNPRICED', unpricedReason: 'NO_EFFECTIVE_PRICE_CARD', unpricedUsageKinds: ['CACHE_WRITE_INPUT_TOKEN'] });
    expect(result.ratedCost).toBeUndefined();
    expect(result.credit).toEqual({ state: 'NOT_COMPUTABLE', reason: 'COST_NOT_RATED' });
  });

  it('missing or partial usage is USAGE_UNKNOWN, never zero', () => {
    expect(simulateAiCost(scenario({ usage: { completeness: 'ABSENT' } }))).toMatchObject({ pricingState: 'USAGE_UNKNOWN', components: [] });
    expect(simulateAiCost(scenario({ usage: { completeness: 'INCOMPLETE', quantities: { OUTPUT_TOKEN: 3 } } }))).toMatchObject({ pricingState: 'USAGE_UNKNOWN' });
  });

  it('selects the card effective at the event instant, never today\'s', () => {
    const versioned = [...CARDS.filter((c) => c.usageKind !== 'OUTPUT_TOKEN'),
      card('OUTPUT_TOKEN', '0.6', { effectiveTo: '2026-07-01T00:00:00Z' }), card('OUTPUT_TOKEN', '0.9', { effectiveFrom: '2026-07-01T00:00:00Z' })];
    expect(simulateAiCost(scenario({ priceCards: versioned })).ratedCost).toBe('0.00075225');
    expect(simulateAiCost(scenario({ priceCards: versioned, eventAt: '2026-07-01T00:00:00Z' })).ratedCost).toBe('0.00098895');
    expect(simulateAiCost(scenario({ priceCards: versioned, eventAt: '2025-12-31T23:59:59Z' })).pricingState).toBe('UNPRICED');
  });

  it('refuses overlapping windows, mixed currencies and invalid inputs', () => {
    expect(() => simulateAiCost(scenario({ priceCards: [...CARDS, card('INPUT_TOKEN', '9')] }))).toThrow(/Overlapping/u);
    expect(simulateAiCost(scenario({ priceCards: [...CARDS.slice(0, 3), card('OUTPUT_TOKEN', '0.6', { currency: 'EUR' })] })))
      .toMatchObject({ pricingState: 'UNPRICED', unpricedReason: 'MIXED_CURRENCY' });
    expect(() => simulateAiCost(scenario({ usage: { completeness: 'COMPLETE', quantities: { INPUT_TOKEN: 1.5 } } }))).toThrow(RangeError);
    expect(() => simulateAiCost(scenario({ provider: 'OPENAI', usage: { completeness: 'COMPLETE', quantities: { INPUT_TOKEN: 1, OUTPUT_TOKEN: 1 } } }))).toThrow(/COMPLETE OPENAI/u);
    expect(() => simulateAiCost(scenario({ priceCards: [card('INPUT_TOKEN', '0.1e1')] }))).toThrow(RangeError);
  });

  it('can compare an unregistered candidate provider without any architecture change', () => {
    const candidate = simulateAiCost({ scenarioLabel: 'TEST_ONLY candidate', provider: 'CANDIDATE_X', model: 'candidate-1', eventAt: '2026-06-01T00:00:00Z',
      usage: { completeness: 'COMPLETE', quantities: { INPUT_TOKEN: 1000, OUTPUT_TOKEN: 1000 } },
      priceCards: [card('INPUT_TOKEN', '0.1'), card('OUTPUT_TOKEN', '0.2')] });
    expect(candidate).toMatchObject({ pricingState: 'RATED', ratedCost: '0.0003' });
  });

  it('touches nothing: it is a pure function of its inputs', () => {
    const input = scenario({ creditPolicy: POLICY });
    const frozen = JSON.stringify(input);
    simulateAiCost(input);
    expect(JSON.stringify(input)).toBe(frozen);
  });
});
