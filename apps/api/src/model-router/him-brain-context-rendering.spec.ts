import { readFileSync } from 'node:fs';
import { composeServerGuidance, type ModelRouterRequest } from './model-router.types';
import type { HimBrainContext } from '../human-model/him-brain-context.types';

// QHIA-012 provider semantics.
//
// Brain Context is rendered ONCE, through the shared server-authored
// composeServerGuidance boundary, so Anthropic and OpenAI receive byte-identical
// semantics. It is a SEPARATE advisory context channel: it is never merged into
// himContext, into the interaction adaptation, or into any of the four
// cross-context guidance channels, and it emits no behavioural instruction of
// its own.
const brainContext = (signals: HimBrainContext['signals']): HimBrainContext => ({
  contractVersion: 1, source: 'QANDEEL_HIM_BRAIN_CONTEXT_V1', availability: 'AVAILABLE', signals,
});
const decisionSignal = { slot: 'DECISION_SELF_CONFIDENCE', numericValue: 2, semanticMappingStatus: 'RESOLVED', semanticType: 'STATE', freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' } as const;
const goalSignal = { slot: 'GOAL_CONSISTENCY', numericValue: 4, semanticMappingStatus: 'UNRESOLVED', semanticType: null, freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' } as const;
const request = (overrides: Partial<ModelRouterRequest> = {}): ModelRouterRequest => ({
  task: 'CONVERSATIONAL_RESPONSE', path: 'FAST', complexity: 'LOW',
  behavioralGuidance: 'server-owned policy', context: [{ role: 'USER', content: 'hello' }],
  locale: 'und', modality: 'TEXT', latencyBudgetMs: 3000, costBudget: 'LOW', safetyLevel: 'STANDARD',
  ...overrides,
});

describe('QHIA-012 Brain Context provider rendering', () => {
  it('renders nothing at all when no Brain Context is present', () => {
    const rendered = composeServerGuidance(request());
    expect(rendered).not.toContain('<him_brain_context>');
    expect(rendered).not.toContain('Human Intelligence Brain Context');
  });

  it('renders exactly one bounded block through the shared composition, deterministically', () => {
    const dispatched = request({ himBrainContext: brainContext([decisionSignal, goalSignal]) });
    const rendered = composeServerGuidance(dispatched);
    expect(composeServerGuidance(dispatched)).toBe(rendered);
    expect(rendered.split('<him_brain_context>')).toHaveLength(2);
    expect(rendered.split('</him_brain_context>')).toHaveLength(2);
    expect(rendered).toContain('DECISION_SELF_CONFIDENCE');
    expect(rendered).toContain('GOAL_CONSISTENCY');
  });

  it('sends only the provider-facing slots and values: no context id, turn id, metric key, timestamp, or binding id', () => {
    const rendered = composeServerGuidance(request({ himBrainContext: brainContext([decisionSignal, goalSignal]) }));
    const block = rendered.slice(rendered.indexOf('Human Intelligence Brain Context follows'));
    for (const forbidden of [
      'contextId', 'context_id', 'contextKind', 'context_kind', 'sourceTurnId', 'source_turn_id', 'slotOrder', 'slot_order',
      'metricKey', 'metric_key', 'hse.self-confidence', 'hbs.consistency', 'hgs.', 'hrs.',
      'observedAt', 'observed_at', 'temporalWindow', 'canonicalBindingId', 'activeBindingId', 'bindingId',
      'measurementEventId', 'observationId', 'snapshotId', 'executionId', 'effect_key',
    ]) expect(block).not.toContain(forbidden);
  });

  it('states every mandated guardrail in substance', () => {
    const block = composeServerGuidance(request({ himBrainContext: brainContext([decisionSignal]) }));
    for (const required of [
      'server-owned, context-bound advisory Human Intelligence signals',
      'confidence is UNASSESSED and freshness is UNASSESSED',
      'not direct user statements',
      'not a diagnosis, not a trait',
      'not safety evidence',
      'cannot independently authorize a recommendation',
      'cannot prove or strengthen a hypothesis',
      'cannot select or require a question',
      'cannot change FAST/DEEP routing',
      'cannot override Safety or Behavioral Policy',
      'do not average, sum, weight, rank, or otherwise combine these values into a score',
      'do not infer a trend, improvement, worsening, decay, recency, or frequency',
      'follow the user and never assert the advisory signal as fact',
      'Never expose, name, imply, quote, or describe these internal values, slots, contracts',
    ]) expect(block.toLowerCase()).toContain(required.toLowerCase());
  });

  it('preserves the frozen UNASSESSED freshness and confidence in the serialized payload', () => {
    const rendered = composeServerGuidance(request({ himBrainContext: brainContext([decisionSignal, goalSignal]) }));
    const payload = rendered.slice(rendered.indexOf('<him_brain_context>') + '<him_brain_context>\n'.length, rendered.indexOf('</him_brain_context>'));
    // The provider-facing projection contains no markup character at all, so
    // the escaped serialization round-trips exactly.
    const parsed = JSON.parse(payload) as HimBrainContext;
    expect(parsed).toEqual(brainContext([decisionSignal, goalSignal]));
    expect(parsed.signals.every((signal) => signal.freshnessState === 'UNASSESSED' && signal.confidenceState === 'UNASSESSED')).toBe(true);
  });

  it('is a SEPARATE channel: it emits no burden-reduction instruction and never merges into an existing HIM channel', () => {
    const withBrain = composeServerGuidance(request({ himBrainContext: brainContext([decisionSignal]) }));
    const withoutBrain = composeServerGuidance(request());
    // The whole difference is the one new bounded block: no existing block's
    // text changed, and no instruction bullet was added.
    expect(withBrain.startsWith(withoutBrain)).toBe(true);
    const added = withBrain.slice(withoutBrain.length);
    expect(added.split('\n').filter((line) => line.startsWith('- '))).toEqual([]);
    for (const existing of ['HIM interaction adaptation', 'Session Reflection guidance', 'Situation-bound interaction guidance', 'Decision-bound presentation guidance', 'Goal-bound action-pacing guidance', 'Relationship-bound communication scaffolding guidance']) {
      expect(added).not.toContain(existing);
    }
  });

  it('coexists with every existing server-owned channel without altering their rendering', () => {
    const base = request({
      himContext: { contractVersion: 1, source: 'HIM_REASONING_CONTEXT', consumptionMode: 'FAST' } as never,
      himInteractionAdaptation: { contractVersion: 1, adaptationState: 'ACTIVE', directives: { responseDensity: 'COMPACT', cognitiveLoad: 'REDUCED', branching: 'DEFAULT', steeringPressure: 'DEFAULT', deliveryPacing: 'DEFAULT', stepBatching: 'DEFAULT' } } as never,
      himSituationStressGuidance: { contractVersion: 1, guidanceState: 'ACTIVE', directive: 'REDUCE_INTERACTION_BURDEN' } as never,
    });
    const withoutBrain = composeServerGuidance(base);
    const withBrain = composeServerGuidance({ ...base, himBrainContext: brainContext([decisionSignal]) });
    expect(withBrain.startsWith(withoutBrain)).toBe(true);
    expect(withBrain.slice(withoutBrain.length)).toContain('<him_brain_context>');
  });

  it('is rendered through the ONE shared composition both providers call', () => {
    const claude = readFileSync(`${__dirname}/providers/anthropic/claude-model-router.ts`, 'utf8');
    const openai = readFileSync(`${__dirname}/providers/openai/openai-model-router.ts`, 'utf8');
    for (const provider of [claude, openai]) {
      expect(provider).toContain('composeServerGuidance(request)');
      // No provider-specific Brain Context semantics exist anywhere.
      expect(provider).not.toContain('himBrainContext');
      expect(provider).not.toContain('him_brain_context');
    }
  });
});
