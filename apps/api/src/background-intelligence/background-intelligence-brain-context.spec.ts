import { readFileSync } from 'node:fs';
import { BackgroundIntelligenceAuthorityService, BackgroundIntelligenceExecutionContext } from './background-intelligence-authority.service';
import { BackgroundIntelligenceContextFactory } from './background-intelligence-context.factory';
import { BackgroundIntelligenceEnrichmentService } from './background-intelligence-enrichment.service';
import type { BackgroundIntelligenceDataApiService } from './background-intelligence-data-api.service';
import { MemoryWriteEvaluatorService } from '../memory/memory-write-evaluator.service';
import { HimReasoningConsumptionService } from '../human-model/him-reasoning-consumption.service';
import { HypothesisGenerationTriggerClassificationService } from '../hypothesis/hypothesis-generation-trigger-classification.service';
import { HIM_BRAIN_CONTEXT_REGISTRY, type HimBrainContextSourceRow } from '../human-model/him-brain-context.types';
import type { RuntimeEventEnvelope } from '../runtime-events/runtime-event.types';

// QHIA-012 background materialization contract.
//
// The materializer reads the ONE execution-bound source RPC, projects every
// returned row through the SHARED frozen QHIA-004 projection, and produces the
// small bounded typed durable result. It calls no LLM, no model router, no
// provider, no reranker and no embedding, parses no user text, and never
// substitutes an UNKNOWN, an older value, a sibling metric, or an inferred
// freshness/confidence.
const ids = {
  event: '10000000-0000-4000-8000-000000000001',
  user: '10000000-0000-4000-8000-000000000002',
  session: '10000000-0000-4000-8000-000000000003',
  turn: '10000000-0000-4000-8000-000000000004',
  execution: '10000000-0000-4000-8000-000000000005',
  decisionContext: '10000000-0000-4000-8000-0000000000d1',
  goalContext: '10000000-0000-4000-8000-0000000000c1',
  binding: '10000000-0000-4000-8000-0000000000b1',
};
const event: RuntimeEventEnvelope = {
  event_id: ids.event, event_type: 'ConversationTurnCompleted', event_version: '2.0',
  occurred_at: '2026-01-01T00:00:00Z', producer: 'conversation-service',
  subject_user_id: ids.user, subject_session_id: ids.session, subject_turn_id: ids.turn,
  correlation_id: null, causation_id: null, classification: 'SENSITIVE',
  schema_ref: 'qandeel.runtime.conversation-turn-completed.v2',
  payload: {
    user_id: ids.user, session_id: ids.session, source_turn_id: ids.turn, terminal_status: 'COMPLETED',
    processing_path: 'FAST', routing_reason: 'FAST_DEFAULT', orchestration_id: null, safety_disposition: 'ALLOW',
  },
  contains_content: false, retention_class: 'OPERATIONAL_EVENT_V1',
};

async function issuedContext(): Promise<BackgroundIntelligenceExecutionContext> {
  const ownership = {
    findSession: jest.fn().mockResolvedValue({ id: ids.session, status: 'ACTIVE', channel: 'TEXT' }),
    findSourceTurn: jest.fn().mockResolvedValue({ id: ids.turn, session_id: ids.session, role: 'USER', status: 'COMPLETED', source_turn_id: null }),
    findCompletedAssistant: jest.fn().mockResolvedValue({ id: 'a', session_id: ids.session, role: 'ASSISTANT', status: 'COMPLETED', source_turn_id: ids.turn }),
  } as unknown as BackgroundIntelligenceDataApiService;
  const result = await new BackgroundIntelligenceAuthorityService(new BackgroundIntelligenceContextFactory(), ownership).authorize(event);
  if (!result.context) throw new Error('authority failed');
  return result.context;
}

// One canonical QHIA-004-compatible source row for a frozen Brain slot.
const sourceRow = (slotOrder: number, contextId: string, overrides: Partial<HimBrainContextSourceRow> = {}): HimBrainContextSourceRow => {
  const entry = HIM_BRAIN_CONTEXT_REGISTRY.find((candidate) => candidate.slotOrder === slotOrder)!;
  const resolved = entry.metricKey === 'hgs.purpose-alignment';
  return {
    brain_slot_order: slotOrder, brain_slot: entry.slot,
    slot_order: slotOrder, metric_key: entry.metricKey, definition_version: 1,
    hif_owner: entry.metricKey.startsWith('hse.') ? 'HSE' : entry.metricKey.startsWith('hbs.') ? 'HBS' : 'HGS',
    semantic_mapping_status: resolved ? 'RESOLVED' : 'UNRESOLVED',
    semantic_type: resolved ? 'ALIGNMENT' : null,
    calculation_status: 'CALIBRATED',
    valid_context_kinds: [entry.contextKind],
    context_kind: entry.contextKind, context_id: contextId,
    has_canonical_current_value: true,
    source_metric_key: entry.metricKey, source_definition_version: 1,
    source_semantic_mapping_status: resolved ? 'RESOLVED' : 'UNRESOLVED',
    source_semantic_type: resolved ? 'ALIGNMENT' : null,
    source_context_kind: entry.contextKind, source_context_id: contextId,
    value_state: 'ASSESSED', numeric_value: 2, validity_status: 'VALID',
    confidence_state: 'UNASSESSED', confidence_reference: null,
    observed_at: '2026-01-01T00:00:00Z', temporal_window_start: null, temporal_window_end: null,
    canonical_binding_id: ids.binding, active_binding_id: ids.binding,
    ...overrides,
  };
};
// The exact absent-source shape the canonical latest authority produces when the
// newest measurement event has no usable current calculated snapshot.
const unknownRow = (slotOrder: number, contextId: string): HimBrainContextSourceRow => sourceRow(slotOrder, contextId, {
  has_canonical_current_value: false,
  source_metric_key: null, source_definition_version: null, source_semantic_mapping_status: null,
  source_semantic_type: null, source_context_kind: null, source_context_id: null,
  value_state: null, numeric_value: null, validity_status: null,
  confidence_state: null, confidence_reference: null,
  observed_at: null, temporal_window_start: null, temporal_window_end: null, canonical_binding_id: null,
});

const setup = (rows: unknown) => {
  const data = {
    readHimBrainContextSource: jest.fn().mockResolvedValue(rows),
    readCanonicalSourceTurn: jest.fn(), listActiveMemories: jest.fn().mockResolvedValue([]), createMemory: jest.fn(),
    listActiveHypotheses: jest.fn().mockResolvedValue([]), findHypothesis: jest.fn(), createSystemHypothesis: jest.fn(),
    attachHypothesisEvidence: jest.fn(), linkCompetingHypotheses: jest.fn(), createConfidenceEvaluation: jest.fn(),
    readHimConversationSnapshot: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<BackgroundIntelligenceDataApiService>;
  return {
    data,
    service: new BackgroundIntelligenceEnrichmentService(
      data, new MemoryWriteEvaluatorService(), new HypothesisGenerationTriggerClassificationService(), new HimReasoningConsumptionService(),
    ),
  };
};

describe('BackgroundIntelligenceEnrichmentService.readHimBrainContextMaterialization (QHIA-012)', () => {
  it('requires an authority-issued execution context before any source request', async () => {
    const { service, data } = setup([]);
    const pre = new BackgroundIntelligenceContextFactory().create(event);
    const valid = await issuedContext();
    for (const forged of [pre, { ...valid }, Object.create(BackgroundIntelligenceExecutionContext.prototype)]) {
      await expect(service.readHimBrainContextMaterialization(forged as never, ids.execution)).rejects.toThrow('BACKGROUND_INTELLIGENCE_AUTHORITY_REQUIRED');
    }
    expect(data.readHimBrainContextSource).not.toHaveBeenCalled();
  });

  it('requires a canonical execution identity before any source request', async () => {
    const { service, data } = setup([]);
    const valid = await issuedContext();
    await expect(service.readHimBrainContextMaterialization(valid, 'not-a-uuid')).rejects.toThrow('BACKGROUND_HIM_BRAIN_CONTEXT_EXECUTION_REQUIRED');
    expect(data.readHimBrainContextSource).not.toHaveBeenCalled();
  });

  it('issues exactly ONE source request carrying only the execution identity: no per-slot fan-out', async () => {
    const { service, data } = setup([sourceRow(1, ids.decisionContext)]);
    const valid = await issuedContext();
    await service.readHimBrainContextMaterialization(valid, ids.execution);
    expect(data.readHimBrainContextSource).toHaveBeenCalledTimes(1);
    expect(data.readHimBrainContextSource).toHaveBeenCalledWith(valid, ids.execution);
  });

  it('materializes only KNOWN canonical signals and binds them to the exact execution source turn', async () => {
    const { service } = setup([sourceRow(1, ids.decisionContext), sourceRow(5, ids.goalContext), sourceRow(7, ids.goalContext)]);
    const valid = await issuedContext();
    const result = await service.readHimBrainContextMaterialization(valid, ids.execution);
    expect(result.code).toBe('HIM_BRAIN_CONTEXT_MATERIALIZED');
    if (result.code !== 'HIM_BRAIN_CONTEXT_MATERIALIZED') throw new Error('expected a materialized result');
    expect(result.payload).toEqual({
      contractVersion: 1,
      source: 'QANDEEL_HIM_BRAIN_CONTEXT_MATERIALIZATION_V1',
      sourceTurnId: ids.turn,
      signals: [
        { slotOrder: 1, slot: 'DECISION_SELF_CONFIDENCE', contextKind: 'DECISION', contextId: ids.decisionContext, numericValue: 2, semanticMappingStatus: 'UNRESOLVED', semanticType: null, freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' },
        { slotOrder: 5, slot: 'GOAL_CONSISTENCY', contextKind: 'GOAL', contextId: ids.goalContext, numericValue: 2, semanticMappingStatus: 'UNRESOLVED', semanticType: null, freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' },
        { slotOrder: 7, slot: 'GOAL_PURPOSE_ALIGNMENT', contextKind: 'GOAL', contextId: ids.goalContext, numericValue: 2, semanticMappingStatus: 'RESOLVED', semanticType: 'ALIGNMENT', freshnessState: 'UNASSESSED', confidenceState: 'UNASSESSED' },
      ],
    });
    // Nothing beyond the bounded contract is persisted.
    const serialized = JSON.stringify(result.payload);
    for (const forbidden of ['hse.self-confidence', 'hbs.consistency', 'metricKey', 'observedAt', 'observed_at', 'canonicalBindingId', 'activeBindingId', ids.binding, 'temporal', 'hifOwner']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('UNKNOWN stays ABSENT: an unusable slot is omitted, never substituted with an older or default value', async () => {
    const { service } = setup([unknownRow(1, ids.decisionContext), sourceRow(5, ids.goalContext)]);
    const result = await service.readHimBrainContextMaterialization(await issuedContext(), ids.execution);
    if (result.code !== 'HIM_BRAIN_CONTEXT_MATERIALIZED') throw new Error('expected a materialized result');
    expect(result.payload.signals.map((signal) => signal.slot)).toEqual(['GOAL_CONSISTENCY']);
  });

  it('returns the authoritative NO_HIM_BRAIN_CONTEXT when nothing is bound or nothing is KNOWN', async () => {
    await expect(setup([]).service.readHimBrainContextMaterialization(await issuedContext(), ids.execution))
      .resolves.toEqual({ code: 'NO_HIM_BRAIN_CONTEXT' });
    await expect(setup([unknownRow(1, ids.decisionContext)]).service.readHimBrainContextMaterialization(await issuedContext(), ids.execution))
      .resolves.toEqual({ code: 'NO_HIM_BRAIN_CONTEXT' });
  });

  it('accepts the whole frozen registry at once and never more than eight signals', async () => {
    const rows = HIM_BRAIN_CONTEXT_REGISTRY.map((entry) => sourceRow(
      entry.slotOrder, entry.contextKind === 'DECISION' ? ids.decisionContext : ids.goalContext,
    ));
    const result = await setup(rows).service.readHimBrainContextMaterialization(await issuedContext(), ids.execution);
    if (result.code !== 'HIM_BRAIN_CONTEXT_MATERIALIZED') throw new Error('expected a materialized result');
    expect(result.payload.signals).toHaveLength(8);
    expect(result.payload.signals.map((signal) => signal.slotOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('fails closed on every malformed source shape rather than materializing a partial result', async () => {
    const valid = await issuedContext();
    const rejected: Array<[string, unknown]> = [
      ['a non-array payload', {}],
      ['more than eight rows', [...Array(9)].map((_value, index) => sourceRow(((index % 8) + 1), ids.goalContext))],
      ['a null row', [null]],
      ['an unknown slot ordinal', [sourceRow(1, ids.decisionContext, { brain_slot_order: 9 })]],
      ['a registry order inversion', [sourceRow(5, ids.goalContext), sourceRow(1, ids.decisionContext)]],
      ['a duplicated slot', [sourceRow(1, ids.decisionContext), sourceRow(1, ids.decisionContext)]],
      ['a slot label that does not match its ordinal', [sourceRow(1, ids.decisionContext, { brain_slot: 'GOAL_CONSISTENCY' })]],
      ['a context kind that does not match its slot', [sourceRow(1, ids.decisionContext, { context_kind: 'GOAL' })]],
      ['a non-UUID context identity', [sourceRow(1, 'not-a-uuid')]],
      ['a definition-metadata drift', [sourceRow(1, ids.decisionContext, { calculation_status: 'UNCALIBRATED' })]],
      ['a metric identity drift', [sourceRow(1, ids.decisionContext, { metric_key: 'hse.stress' })]],
    ];
    const survived: string[] = [];
    for (const [label, rows] of rejected) {
      try {
        await setup(rows).service.readHimBrainContextMaterialization(valid, ids.execution);
        survived.push(label);
      } catch { /* expected */ }
    }
    expect(survived).toEqual([]);
  });

  it('propagates a source transport failure instead of degrading to a false NO_HIM_BRAIN_CONTEXT', async () => {
    const data = { readHimBrainContextSource: jest.fn().mockRejectedValue(new Error('BACKGROUND_INTELLIGENCE_DATABASE_UNAVAILABLE')) } as unknown as jest.Mocked<BackgroundIntelligenceDataApiService>;
    const service = new BackgroundIntelligenceEnrichmentService(
      data, new MemoryWriteEvaluatorService(), new HypothesisGenerationTriggerClassificationService(), new HimReasoningConsumptionService(),
    );
    await expect(service.readHimBrainContextMaterialization(await issuedContext(), ids.execution))
      .rejects.toThrow('BACKGROUND_INTELLIGENCE_DATABASE_UNAVAILABLE');
  });

  it('reuses the SHARED QHIA-004 projection and invokes no model, provider, or text interpretation', () => {
    const source = readFileSync(`${__dirname}/background-intelligence-enrichment.service.ts`, 'utf8');
    const start = source.indexOf('async readHimBrainContextMaterialization(');
    const end = source.indexOf('async readCanonicalSourceTurn(', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const method = source.slice(start, end);
    expect(method).toContain('projectHimContextualCurrentSlot(');
    // The negatives run on EXECUTABLE source only: the method's own prose
    // legitimately names the shapes it documents the absence of, exactly as the
    // database contracts do.
    const executable = method.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n').toLowerCase();
    for (const forbidden of [
      'generator', 'generate(', 'modelrouter', 'router', 'provider', 'embedding', 'rerank', 'llm', 'openai', 'anthropic',
      'classifier', 'evaluator', 'content', 'transcript', 'statement',
    ]) expect(executable).not.toContain(forbidden);
  });

  it('sends only the execution identity over the service-role transport and reaches no generic HIM read', () => {
    const source = readFileSync(`${__dirname}/background-intelligence-data-api.service.ts`, 'utf8');
    const start = source.indexOf('async readHimBrainContextSource(');
    const method = source.slice(start, source.indexOf('private async request<T>', start));
    expect(method).toContain("'rpc/background_read_him_brain_context_source_v1'");
    expect(method).toContain('p_execution_id:executionId');
    for (const forbidden of [
      'p_user_id', 'p_session_id', 'p_context_kind', 'p_context_id', 'p_metric_key', 'p_metric_keys',
      'p_definition_version', 'p_slot', 'read_him_latest_measurement', 'read_him_contextual_current_intelligence_batch',
      'read_him_session_context_bindings',
    ]) expect(method).not.toContain(forbidden);
  });
});
