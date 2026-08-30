import { INTELLIGENCE_EFFECTS } from './post-response-intelligence.types';
import type { IntelligenceEffect } from './post-response-intelligence.types';
import {
  POST_RESPONSE_PROVIDER_BUDGET_DECISIONS,
  POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_OUTCOME,
  POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_STAGE,
  POST_RESPONSE_PROVIDER_BUDGET_POLICY_VERSION,
  POST_RESPONSE_PROVIDER_CALL_BUDGET_V1,
  POST_RESPONSE_EFFECT_PROVIDER_CLASSIFICATION_V1,
  POST_RESPONSE_PROVIDER_EFFECTS_V1,
  PostResponseProviderBudget,
  isPostResponseProviderEffect,
  reconstructSpentProviderSlots,
  type PostResponseProviderEffect,
} from './post-response-provider-budget';

const open = (spent: readonly PostResponseProviderEffect[] = []) => {
  const recorded: Array<[string, string]> = [];
  const budget = new PostResponseProviderBudget(new Set(spent), (effect, decision) => { recorded.push([effect, decision]); });
  return { budget, recorded };
};

describe('QIR-005 post-response provider budget contract', () => {
  it('freezes exactly three provider-backed effects and a hard budget equal to the registry size', () => {
    expect(POST_RESPONSE_PROVIDER_EFFECTS_V1).toEqual(['ASSOCIATION_PROVIDER', 'INTENT_PROVIDER', 'CANDIDATE_PROVIDER']);
    expect(POST_RESPONSE_PROVIDER_CALL_BUDGET_V1).toBe(3);
    expect(POST_RESPONSE_PROVIDER_CALL_BUDGET_V1).toBe(POST_RESPONSE_PROVIDER_EFFECTS_V1.length);
    expect(new Set(POST_RESPONSE_PROVIDER_EFFECTS_V1).size).toBe(POST_RESPONSE_PROVIDER_EFFECTS_V1.length);
    expect(POST_RESPONSE_PROVIDER_BUDGET_POLICY_VERSION).toBe('1');
    expect(POST_RESPONSE_PROVIDER_BUDGET_DECISIONS).toEqual(['AUTHORIZED', 'RECOVERED', 'EXHAUSTED']);
  });

  it('is a strict subset of the canonical effect registry and excludes every non-provider effect', () => {
    for (const effect of POST_RESPONSE_PROVIDER_EFFECTS_V1) {
      expect(INTELLIGENCE_EFFECTS as readonly string[]).toContain(effect);
    }
    // Membership is explicit, never inferred: these are the canonical effects
    // that cross NO provider boundary and must never consume a slot.
    for (const effect of ['MEMORY_WRITE', 'HYPOTHESIS_UPDATE_BATCH', 'HYPOTHESIS_PERSISTENCE', 'CONFIDENCE_BATCH', 'HIM_BRAIN_CONTEXT_MATERIALIZATION']) {
      expect(isPostResponseProviderEffect(effect)).toBe(false);
    }
    // Nothing is matched by name shape: a plausible future effect name that is
    // not in the frozen registry is not provider-backed.
    for (const effect of ['QUESTION_PROVIDER', 'RECOMMENDATION_PROVIDER', 'ASSOCIATION_PROVIDER_V2', 'association_provider', '']) {
      expect(isPostResponseProviderEffect(effect)).toBe(false);
    }
    expect(POST_RESPONSE_PROVIDER_EFFECTS_V1.every(isPostResponseProviderEffect)).toBe(true);
  });

  it('reconstructs spent slots from durable effect state alone', () => {
    const completed = (effect_key: IntelligenceEffect) => ({ effect_key, state: 'COMPLETED' as const });
    expect(reconstructSpentProviderSlots([]).size).toBe(0);
    expect(reconstructSpentProviderSlots([completed('ASSOCIATION_PROVIDER')]).size).toBe(1);
    expect(reconstructSpentProviderSlots([completed('ASSOCIATION_PROVIDER'), completed('INTENT_PROVIDER')]).size).toBe(2);
    expect(reconstructSpentProviderSlots(POST_RESPONSE_PROVIDER_EFFECTS_V1.map(completed)).size).toBe(POST_RESPONSE_PROVIDER_CALL_BUDGET_V1);
    // Non-provider effects never consume a slot, however many of them exist.
    expect(reconstructSpentProviderSlots([
      completed('MEMORY_WRITE'), completed('HYPOTHESIS_UPDATE_BATCH'), completed('HYPOTHESIS_PERSISTENCE'),
      completed('CONFIDENCE_BATCH'), completed('HIM_BRAIN_CONTEXT_MATERIALIZATION'),
    ]).size).toBe(0);
    // A duplicated row cannot double-count: a slot is per EFFECT.
    expect(reconstructSpentProviderSlots([completed('INTENT_PROVIDER'), completed('INTENT_PROVIDER')]).size).toBe(1);
  });

  it('counts a CLAIMED provider effect as permanently spent, exactly like a COMPLETED one', () => {
    for (const effect of POST_RESPONSE_PROVIDER_EFFECTS_V1) {
      expect(reconstructSpentProviderSlots([{ effect_key: effect, state: 'CLAIMED' }]).has(effect)).toBe(true);
      expect(reconstructSpentProviderSlots([{ effect_key: effect, state: 'COMPLETED' }]).has(effect)).toBe(true);
    }
    const mixed = reconstructSpentProviderSlots([
      { effect_key: 'ASSOCIATION_PROVIDER', state: 'COMPLETED' },
      { effect_key: 'INTENT_PROVIDER', state: 'CLAIMED' },
    ]);
    expect([...mixed].sort()).toEqual(['ASSOCIATION_PROVIDER', 'INTENT_PROVIDER']);
    // An unrecognised durable state is not evidence of a spend.
    expect(reconstructSpentProviderSlots([{ effect_key: 'INTENT_PROVIDER', state: 'PENDING' as never }]).size).toBe(0);
  });

  it('authorizes fresh work only while a slot remains, and spends only on an explicit spend', () => {
    const { budget, recorded } = open();
    expect(budget.spent).toBe(0);
    expect(budget.remaining).toBe(POST_RESPONSE_PROVIDER_CALL_BUDGET_V1);
    // Authorization alone is not a spend: a mere intention to call a provider,
    // or a failed durable claim, must consume nothing.
    expect(budget.authorize('ASSOCIATION_PROVIDER')).toBe('AUTHORIZED');
    expect(budget.authorize('ASSOCIATION_PROVIDER')).toBe('AUTHORIZED');
    expect(budget.spent).toBe(0);
    expect(recorded).toEqual([]);
    budget.spend('ASSOCIATION_PROVIDER');
    expect(budget.spent).toBe(1);
    expect(budget.remaining).toBe(2);
    expect(budget.isSpent('ASSOCIATION_PROVIDER')).toBe(true);
    expect(recorded).toEqual([['ASSOCIATION_PROVIDER', 'AUTHORIZED']]);
  });

  it('refuses a second authorization of an already spent effect - local duplicate consumption', () => {
    const { budget, recorded } = open();
    budget.spend('INTENT_PROVIDER');
    expect(budget.authorize('INTENT_PROVIDER')).toBe('EXHAUSTED');
    expect(budget.spent).toBe(1);
    expect(recorded).toEqual([['INTENT_PROVIDER', 'AUTHORIZED'], ['INTENT_PROVIDER', 'EXHAUSTED']]);
    // A repeated spend is idempotent and never double-counts or re-emits.
    budget.spend('INTENT_PROVIDER');
    expect(budget.spent).toBe(1);
    expect(recorded.filter(([, decision]) => decision === 'AUTHORIZED')).toHaveLength(1);
  });

  it('refuses every further authorization once all three slots are spent, and never raises the cap', () => {
    const { budget, recorded } = open(POST_RESPONSE_PROVIDER_EFFECTS_V1);
    expect(budget.spent).toBe(POST_RESPONSE_PROVIDER_CALL_BUDGET_V1);
    expect(budget.remaining).toBe(0);
    for (const effect of POST_RESPONSE_PROVIDER_EFFECTS_V1) expect(budget.authorize(effect)).toBe('EXHAUSTED');
    expect(recorded).toEqual(POST_RESPONSE_PROVIDER_EFFECTS_V1.map((effect) => [effect, 'EXHAUSTED']));
    expect(budget.spent).toBe(POST_RESPONSE_PROVIDER_CALL_BUDGET_V1);
    expect(budget.remaining).toBe(0);
  });

  it('never refunds a spent slot and never resets across reopenings of the same durable execution', () => {
    const durable: readonly { effect_key: IntelligenceEffect; state: 'CLAIMED' | 'COMPLETED' }[] = [
      { effect_key: 'ASSOCIATION_PROVIDER', state: 'COMPLETED' },
      { effect_key: 'INTENT_PROVIDER', state: 'CLAIMED' },
    ];
    // Reopening the budget models a duplicate delivery, a reclaim, a redispatch
    // or a process restart. The durable ledger is the only input, so the spent
    // set is identical every time.
    for (const _delivery of ['first', 'duplicate', 'reclaim', 'restart']) {
      const budget = new PostResponseProviderBudget(reconstructSpentProviderSlots(durable), () => undefined);
      expect(budget.spent).toBe(2);
      expect(budget.remaining).toBe(1);
      expect(budget.authorize('ASSOCIATION_PROVIDER')).toBe('EXHAUSTED');
      expect(budget.authorize('INTENT_PROVIDER')).toBe('EXHAUSTED');
      expect(budget.authorize('CANDIDATE_PROVIDER')).toBe('AUTHORIZED');
    }
  });

  it('records RECOVERED for durable reuse without spending or freeing a slot', () => {
    const { budget, recorded } = open(['CANDIDATE_PROVIDER']);
    budget.recover('CANDIDATE_PROVIDER');
    expect(recorded).toEqual([['CANDIDATE_PROVIDER', 'RECOVERED']]);
    expect(budget.spent).toBe(1);
    expect(budget.remaining).toBe(2);
    expect(budget.authorize('CANDIDATE_PROVIDER')).toBe('EXHAUSTED');
  });

  it('is fail-soft: a throwing telemetry recorder never changes a budget decision', () => {
    const budget = new PostResponseProviderBudget(new Set(), () => { throw new Error('meter down'); });
    expect(() => budget.spend('ASSOCIATION_PROVIDER')).not.toThrow();
    expect(budget.spent).toBe(1);
    expect(() => budget.recover('ASSOCIATION_PROVIDER')).not.toThrow();
    expect(() => budget.authorize('ASSOCIATION_PROVIDER')).not.toThrow();
    expect(budget.authorize('ASSOCIATION_PROVIDER')).toBe('EXHAUSTED');
    expect(budget.authorize('INTENT_PROVIDER')).toBe('AUTHORIZED');
  });

  it('carries a deterministic terminal exhaustion identity inside the frozen durable outcome domain', () => {
    // Migration 0022 froze the executions.outcome_code domain and QIR-005 adds no
    // migration, so the exhaustion outcome must be one of the existing codes and
    // the provider-budget identity is carried by the dedicated stage.
    const MIGRATION_0022_OUTCOME_CODES = ['COMPLETED', 'SAFETY_SKIPPED', 'NOT_ELIGIBLE', 'INTENT_NOT_AUTHORIZED', 'ASSEMBLY_NOT_READY',
      'AUTHORITY_REJECTED', 'CANONICAL_MISMATCH', 'LEGACY_UNSUPPORTED', 'POISON_EVENT', 'MAX_ATTEMPTS', 'INDETERMINATE_EFFECT', 'EXECUTION_FAILED'];
    expect(MIGRATION_0022_OUTCOME_CODES).toContain(POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_OUTCOME);
    expect(POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_STAGE).toBe('PROVIDER_BUDGET');
    // The stage survives the migration-0022 `left(p_stage,64)` truncation intact.
    expect(POST_RESPONSE_PROVIDER_BUDGET_EXHAUSTED_STAGE.length).toBeLessThanOrEqual(64);
  });
});

// QIR-005 Fix 01: the provider/non-provider classification is EXHAUSTIVE over
// the CURRENT canonical effect union, so a future durable effect cannot enter
// INTELLIGENCE_EFFECTS without an explicit provider-ownership decision.
describe('QIR-005 Fix 01 exhaustive provider classification', () => {
  const entries = Object.entries(POST_RESPONSE_EFFECT_PROVIDER_CLASSIFICATION_V1) as ReadonlyArray<[string, string]>;
  const classifiedAs = (value: string) => entries.filter(([, classification]) => classification === value).map(([effect]) => effect);
  const CANONICAL_NON_PROVIDER_EFFECTS = ['MEMORY_WRITE', 'HYPOTHESIS_UPDATE_BATCH', 'HYPOTHESIS_PERSISTENCE', 'CONFIDENCE_BATCH', 'HIM_BRAIN_CONTEXT_MATERIALIZATION'];

  it('1+4 - every current IntelligenceEffect has exactly one explicit classification and none is unclassified', () => {
    const keys = entries.map(([effect]) => effect);
    expect(new Set(keys).size).toBe(keys.length);
    expect([...keys].sort()).toEqual([...INTELLIGENCE_EFFECTS].sort());
    expect(keys).toHaveLength(INTELLIGENCE_EFFECTS.length);
    for (const effect of INTELLIGENCE_EFFECTS) {
      const classification: string | undefined = POST_RESPONSE_EFFECT_PROVIDER_CLASSIFICATION_V1[effect];
      expect(classification).toBeDefined();
      expect(['PROVIDER', 'NON_PROVIDER']).toContain(classification);
    }
    // Totality holds in BOTH directions: nothing is classified that is not a
    // canonical durable effect.
    for (const key of keys) expect(INTELLIGENCE_EFFECTS as readonly string[]).toContain(key);
  });

  it('2 - the effects classified PROVIDER are exactly the frozen v1 provider-backed registry', () => {
    expect(classifiedAs('PROVIDER').sort()).toEqual([...POST_RESPONSE_PROVIDER_EFFECTS_V1].sort());
    expect(classifiedAs('PROVIDER')).toHaveLength(POST_RESPONSE_PROVIDER_EFFECTS_V1.length);
    // Both directions, so neither set can drift past the other.
    for (const effect of POST_RESPONSE_PROVIDER_EFFECTS_V1) expect(POST_RESPONSE_EFFECT_PROVIDER_CLASSIFICATION_V1[effect]).toBe('PROVIDER');
    for (const effect of classifiedAs('PROVIDER')) expect(isPostResponseProviderEffect(effect)).toBe(true);
  });

  it('3 - the effects classified NON_PROVIDER contain the five canonical non-provider durable effects', () => {
    const nonProvider = classifiedAs('NON_PROVIDER');
    for (const effect of CANONICAL_NON_PROVIDER_EFFECTS) {
      expect(nonProvider).toContain(effect);
      expect(isPostResponseProviderEffect(effect)).toBe(false);
    }
    // Partition: PROVIDER and NON_PROVIDER are disjoint and together cover the union.
    expect(nonProvider.filter((effect) => classifiedAs('PROVIDER').includes(effect))).toEqual([]);
    expect(nonProvider.length + classifiedAs('PROVIDER').length).toBe(INTELLIGENCE_EFFECTS.length);
  });

  it('5 - classification is an exact keyed decision, never inferred from the effect name', () => {
    const lookup = POST_RESPONSE_EFFECT_PROVIDER_CLASSIFICATION_V1 as Record<string, string | undefined>;
    // A plausible provider-suffixed name that is not a canonical effect gets NO
    // classification at all and NO registry membership: nothing is derived from
    // the `_PROVIDER` suffix or any other string pattern.
    for (const name of ['QUESTION_PROVIDER', 'RECOMMENDATION_PROVIDER', 'ASSOCIATION_PROVIDER_V2', 'association_provider', 'MEMORY_WRITE_PROVIDER', '']) {
      expect(lookup[name]).toBeUndefined();
      expect(isPostResponseProviderEffect(name)).toBe(false);
    }
    // And a canonical effect's classification is the recorded decision, not its
    // spelling: HYPOTHESIS_UPDATE_BATCH runs a managed database command that
    // calls no provider, and it is NON_PROVIDER because that is what is written.
    expect(lookup.HYPOTHESIS_UPDATE_BATCH).toBe('NON_PROVIDER');
    expect(lookup.HIM_BRAIN_CONTEXT_MATERIALIZATION).toBe('NON_PROVIDER');
  });

  it('6 - the runtime registry, cap and budget behaviour are unchanged by the classification', () => {
    expect(POST_RESPONSE_PROVIDER_EFFECTS_V1).toEqual(['ASSOCIATION_PROVIDER', 'INTENT_PROVIDER', 'CANDIDATE_PROVIDER']);
    expect(POST_RESPONSE_PROVIDER_CALL_BUDGET_V1).toBe(3);
    expect(POST_RESPONSE_PROVIDER_CALL_BUDGET_V1).toBe(classifiedAs('PROVIDER').length);
    // The classification plans no work and changes no decision: a fresh budget
    // still authorizes exactly the three registered slots and nothing else.
    const { budget } = open();
    for (const effect of POST_RESPONSE_PROVIDER_EFFECTS_V1) {
      expect(budget.authorize(effect)).toBe('AUTHORIZED');
      budget.spend(effect);
    }
    expect(budget.spent).toBe(POST_RESPONSE_PROVIDER_CALL_BUDGET_V1);
    expect(budget.remaining).toBe(0);
    for (const effect of POST_RESPONSE_PROVIDER_EFFECTS_V1) expect(budget.authorize(effect)).toBe('EXHAUSTED');
  });
});
