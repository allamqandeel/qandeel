import type { TelemetryService } from '../observability/telemetry.service';
import { POST_RESPONSE_PROVIDER_CALL_BUDGET_V1, POST_RESPONSE_PROVIDER_EFFECTS_V1 } from './post-response-provider-budget';
import { PostResponseProviderBudgetService } from './post-response-provider-budget.service';
import type { IntelligenceEffectState } from './post-response-intelligence.types';

const effect = (effect_key: string, state: 'CLAIMED' | 'COMPLETED'): IntelligenceEffectState =>
  ({ effect_key, state, result_code: null, result_reference: null, result_payload: null }) as IntelligenceEffectState;

const withTelemetry = () => {
  const telemetry = { recordPostResponseProviderBudget: jest.fn() } as unknown as jest.Mocked<TelemetryService>;
  return { telemetry, service: new PostResponseProviderBudgetService(telemetry) };
};

describe('PostResponseProviderBudgetService', () => {
  it('opens a budget whose spent slots come from the durable effect ledger alone', () => {
    const { service } = withTelemetry();
    expect(service.open([], 'FAST').spent).toBe(0);
    expect(service.open([effect('MEMORY_WRITE', 'COMPLETED'), effect('CONFIDENCE_BATCH', 'COMPLETED')], 'FAST').spent).toBe(0);
    expect(service.open([effect('ASSOCIATION_PROVIDER', 'COMPLETED')], 'FAST').spent).toBe(1);
    expect(service.open([effect('ASSOCIATION_PROVIDER', 'COMPLETED'), effect('INTENT_PROVIDER', 'COMPLETED')], 'DEEP').spent).toBe(2);
    const all = service.open(POST_RESPONSE_PROVIDER_EFFECTS_V1.map((key) => effect(key, 'COMPLETED')), 'DEEP');
    expect(all.spent).toBe(POST_RESPONSE_PROVIDER_CALL_BUDGET_V1);
    expect(all.remaining).toBe(0);
  });

  it('re-derives the same spent set on every reopening, so no delivery resets the budget', () => {
    const { service } = withTelemetry();
    const durable = [effect('ASSOCIATION_PROVIDER', 'COMPLETED'), effect('INTENT_PROVIDER', 'CLAIMED')];
    const opened = ['delivery', 'duplicate', 'reclaim', 'redispatch', 'restart'].map(() => service.open(durable, 'FAST'));
    for (const budget of opened) {
      expect(budget.spent).toBe(2);
      expect(budget.authorize('CANDIDATE_PROVIDER')).toBe('AUTHORIZED');
      expect(budget.authorize('ASSOCIATION_PROVIDER')).toBe('EXHAUSTED');
    }
    // Each opened budget is independent local state: spending one never mutates another.
    opened[0].spend('CANDIDATE_PROVIDER');
    expect(opened[0].spent).toBe(3);
    expect(opened[1].spent).toBe(2);
  });

  it('binds the bounded telemetry surface with the execution processing path', () => {
    const { telemetry, service } = withTelemetry();
    const budget = service.open([], 'DEEP');
    budget.spend('INTENT_PROVIDER');
    budget.recover('INTENT_PROVIDER');
    budget.authorize('INTENT_PROVIDER');
    expect(telemetry.recordPostResponseProviderBudget.mock.calls).toEqual([
      ['INTENT_PROVIDER', 'AUTHORIZED', 'DEEP'],
      ['INTENT_PROVIDER', 'RECOVERED', 'DEEP'],
      ['INTENT_PROVIDER', 'EXHAUSTED', 'DEEP'],
    ]);
  });

  it('passes a null processing path straight through for the telemetry boundary to drop', () => {
    const { telemetry, service } = withTelemetry();
    service.open([], null).spend('ASSOCIATION_PROVIDER');
    expect(telemetry.recordPostResponseProviderBudget).toHaveBeenCalledWith('ASSOCIATION_PROVIDER', 'AUTHORIZED', null);
  });

  it('works without a telemetry dependency and stays fail-soft when one throws', () => {
    const withoutTelemetry = new PostResponseProviderBudgetService().open([], 'FAST');
    expect(() => withoutTelemetry.spend('CANDIDATE_PROVIDER')).not.toThrow();
    expect(withoutTelemetry.spent).toBe(1);

    const throwing = new PostResponseProviderBudgetService(
      { recordPostResponseProviderBudget: () => { throw new Error('meter down'); } } as unknown as TelemetryService,
    ).open([], 'FAST');
    expect(() => throwing.spend('CANDIDATE_PROVIDER')).not.toThrow();
    expect(throwing.spent).toBe(1);
    expect(throwing.authorize('CANDIDATE_PROVIDER')).toBe('EXHAUSTED');
  });
});
