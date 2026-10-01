// AI-COST-01 - the deterministic cost / Credit simulator.
//
// A pure function of frozen inputs: normalized usage, versioned Price Cards, an optional Credit Policy and a label.
// It reads no database, scrapes no website, holds no balance and writes nothing, so the same scenario always yields
// the same answer - and that answer equals what migration 0135 stores for the same inputs (the real-PostgreSQL
// verifier proves it digit for digit). Use it to compare provider / model candidates and workload scenarios before any
// economy decision; it decides none.
//
// It follows the database's rules exactly:
//   * usage that is not COMPLETE is USAGE_UNKNOWN - never rated as if the missing part were zero;
//   * every reported kind needs exactly one Price Card effective at the event instant, or the call is UNPRICED;
//   * kinds priced in different currencies are UNPRICED (MIXED_CURRENCY) - never summed;
//   * Credits are computed only when a policy is supplied and the cost is RATED in the policy's currency; otherwise
//     the answer says why - never "0 Credits".

import {
  addExact,
  exactInteger,
  formatExact,
  formatExactAtScale,
  multiplyExact,
  parseExactDecimal,
  roundExact,
  shiftExact,
  type ExactDecimal,
  type ExactRoundingMode,
} from './exact-decimal';
import { AI_COMPLETE_USAGE_KINDS, AI_MODEL_IDENTITY, AI_USAGE_KINDS, type AiProvider, type AiUsageKind } from './ai-usage.types';

export interface SimulationPriceCard {
  readonly usageKind: AiUsageKind;
  /** A plain decimal string, never a number. */
  readonly unitPrice: string;
  readonly priceBasisUnits: 1 | 1000 | 1000000;
  readonly currency: string;
  readonly effectiveFrom: string;
  readonly effectiveTo?: string | null;
  /** Where the price came from (a provider page and date, or `TEST_ONLY` for a synthetic fixture). */
  readonly source: string;
}

export interface SimulationCreditPolicy {
  readonly policyKey: string;
  readonly policyVersion: number;
  readonly costCurrency: string;
  /** A plain decimal string, never a number. */
  readonly creditsPerCostUnit: string;
  readonly creditScale: number;
  readonly roundingMode: ExactRoundingMode;
}

export interface AiCostSimulationScenario {
  readonly scenarioLabel: string;
  readonly provider: string;
  readonly model: string;
  readonly eventAt: string;
  readonly usage:
    | { readonly completeness: 'COMPLETE' | 'INCOMPLETE'; readonly quantities: Readonly<Partial<Record<AiUsageKind, number>>> }
    | { readonly completeness: 'ABSENT' };
  readonly priceCards: readonly SimulationPriceCard[];
  readonly creditPolicy?: SimulationCreditPolicy;
}

export interface AiCostSimulationComponent {
  readonly usageKind: AiUsageKind;
  readonly quantity: number;
  readonly unitPrice: string;
  readonly priceBasisUnits: number;
  readonly currency: string;
  readonly amount: string;
}

export type AiCostSimulationCredit =
  | { readonly state: 'CREDIT_POLICY_NOT_SUPPLIED' }
  | { readonly state: 'NOT_COMPUTABLE'; readonly reason: 'COST_NOT_RATED' | 'CURRENCY_MISMATCH' }
  | { readonly state: 'SIMULATED'; readonly policyKey: string; readonly policyVersion: number; readonly credits: string };

export interface AiCostSimulationResult {
  readonly scenarioLabel: string;
  readonly provider: string;
  readonly model: string;
  readonly eventAt: string;
  readonly usageCompleteness: 'COMPLETE' | 'INCOMPLETE' | 'ABSENT';
  readonly usageBreakdown: readonly { readonly usageKind: AiUsageKind; readonly quantity: number }[];
  readonly pricingState: 'RATED' | 'UNPRICED' | 'USAGE_UNKNOWN';
  readonly unpricedReason?: 'NO_EFFECTIVE_PRICE_CARD' | 'MIXED_CURRENCY';
  readonly unpricedUsageKinds?: readonly AiUsageKind[];
  readonly components: readonly AiCostSimulationComponent[];
  readonly currency?: string;
  readonly ratedCost?: string;
  readonly credit: AiCostSimulationCredit;
}

const BASIS_EXPONENT = { 1: 0, 1000: 3, 1000000: 6 } as const;

function instant(value: string, field: string): number {
  const at = Date.parse(value);
  if (typeof value !== 'string' || !Number.isFinite(at)) throw new RangeError(`${field} is not an instant.`);
  return at;
}

/** One component amount: quantity x unit price x 10^-basis, exactly (migration 0135 `ai_rated_component_amount_v1`). */
export function ratedComponentAmount(quantity: number, unitPrice: string, priceBasisUnits: 1 | 1000 | 1000000): ExactDecimal {
  const exponent = BASIS_EXPONENT[priceBasisUnits];
  if (exponent === undefined) throw new RangeError('The price basis is 1, 1000 or 1000000 units.');
  return shiftExact(multiplyExact(exactInteger(quantity), parseExactDecimal(unitPrice)), exponent);
}

/** The Credit formula family v1 (migration 0135 `ai_credits_for_rated_cost_v1`). */
export function creditsForRatedCost(ratedCost: string, policy: SimulationCreditPolicy): string {
  const rate = parseExactDecimal(policy.creditsPerCostUnit);
  const amount = parseExactDecimal(ratedCost);
  if (amount.units < 0n || rate.units <= 0n || !Number.isSafeInteger(policy.creditScale) || policy.creditScale < 0 || policy.creditScale > 6) {
    throw new RangeError('INVALID_CREDIT_POLICY_INPUT');
  }
  return formatExactAtScale(roundExact(multiplyExact(amount, rate), policy.creditScale, policy.roundingMode), policy.creditScale);
}

export function simulateAiCost(scenario: AiCostSimulationScenario): AiCostSimulationResult {
  if (!AI_MODEL_IDENTITY.test(scenario.model) || !AI_MODEL_IDENTITY.test(scenario.provider)) throw new RangeError('Invalid provider or model identity.');
  const eventAt = instant(scenario.eventAt, 'eventAt');
  const usage = scenario.usage;
  const quantities = usage.completeness === 'ABSENT' ? {} : usage.quantities;
  const kinds = (Object.keys(quantities) as AiUsageKind[]).sort();
  for (const kind of kinds) {
    if (!(AI_USAGE_KINDS as readonly string[]).includes(kind)) throw new RangeError(`Unknown usage kind ${kind}.`);
    const quantity = quantities[kind];
    if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < 0) throw new RangeError(`${kind} is not a whole non-negative quantity.`);
  }
  if ((usage.completeness === 'ABSENT') !== (kinds.length === 0)) throw new RangeError('ABSENT usage carries no quantity, and reported usage carries one.');
  const known = AI_COMPLETE_USAGE_KINDS[scenario.provider as AiProvider];
  if (known && usage.completeness === 'COMPLETE' && kinds.join() !== [...known].sort().join()) {
    throw new RangeError(`COMPLETE ${scenario.provider} usage carries exactly ${known.join(', ')}.`);
  }
  const breakdown = kinds.map((usageKind) => ({ usageKind, quantity: quantities[usageKind] as number }));
  const base = {
    scenarioLabel: scenario.scenarioLabel, provider: scenario.provider, model: scenario.model, eventAt: scenario.eventAt,
    usageCompleteness: usage.completeness, usageBreakdown: breakdown,
  };
  const noCredit = (reason: 'COST_NOT_RATED'): AiCostSimulationCredit =>
    (scenario.creditPolicy ? { state: 'NOT_COMPUTABLE', reason } : { state: 'CREDIT_POLICY_NOT_SUPPLIED' });

  if (usage.completeness !== 'COMPLETE') {
    return { ...base, pricingState: 'USAGE_UNKNOWN', components: [], credit: noCredit('COST_NOT_RATED') };
  }

  const components: AiCostSimulationComponent[] = [];
  const unpriced: AiUsageKind[] = [];
  for (const { usageKind, quantity } of breakdown) {
    const effective = scenario.priceCards.filter((card) => card.usageKind === usageKind
      && instant(card.effectiveFrom, 'effectiveFrom') <= eventAt
      && (card.effectiveTo == null || eventAt < instant(card.effectiveTo, 'effectiveTo')));
    if (effective.length > 1) throw new RangeError(`Overlapping price windows for ${usageKind}.`);
    const card = effective[0];
    if (!card) {
      unpriced.push(usageKind);
      continue;
    }
    if (!/^[A-Z]{3}$/u.test(card.currency)) throw new RangeError('A currency is three capital letters.');
    components.push({
      usageKind, quantity, unitPrice: formatExact(parseExactDecimal(card.unitPrice)), priceBasisUnits: card.priceBasisUnits,
      currency: card.currency, amount: formatExact(ratedComponentAmount(quantity, card.unitPrice, card.priceBasisUnits)),
    });
  }
  if (unpriced.length > 0) {
    return { ...base, pricingState: 'UNPRICED', unpricedReason: 'NO_EFFECTIVE_PRICE_CARD', unpricedUsageKinds: unpriced, components: [], credit: noCredit('COST_NOT_RATED') };
  }
  const currencies = new Set(components.map((component) => component.currency));
  if (currencies.size !== 1) {
    return { ...base, pricingState: 'UNPRICED', unpricedReason: 'MIXED_CURRENCY', components: [], credit: noCredit('COST_NOT_RATED') };
  }
  const [currency] = currencies;
  const ratedCost = formatExact(components.reduce((total, component) => addExact(total, parseExactDecimal(component.amount)), exactInteger(0)));
  const policy = scenario.creditPolicy;
  const credit: AiCostSimulationCredit = !policy
    ? { state: 'CREDIT_POLICY_NOT_SUPPLIED' }
    : policy.costCurrency !== currency
      ? { state: 'NOT_COMPUTABLE', reason: 'CURRENCY_MISMATCH' }
      : { state: 'SIMULATED', policyKey: policy.policyKey, policyVersion: policy.policyVersion, credits: creditsForRatedCost(ratedCost, policy) };
  return { ...base, pricingState: 'RATED', components, currency, ratedCost, credit };
}
