import { CorrelationService } from '../observability/correlation.service';
import { TelemetryService } from '../observability/telemetry.service';
import { BoundedForegroundIntelligenceGathererService } from '../intelligence-runtime/bounded-foreground-intelligence-gatherer.service';
import { IntegratedContextBudgetAssemblerService } from '../intelligence-runtime/integrated-context-budget-assembler.service';
import { InteractionPreferencesService } from '../interaction-preferences/interaction-preferences.service';
import type { InteractionPreferencesRepository } from '../interaction-preferences/interaction-preferences.repository';
import type { MemoryRetrieverService } from '../memory/memory-retriever.service';
import type { HypothesisReasoningContextService } from '../hypothesis/hypothesis-reasoning-context.service';
import type { ModelRouter, ModelRouterRequest, ModelRouterStreamOptions } from '../model-router/model-router.types';
import { LiveCallConversationBinding, type LiveCallReplyRequest } from '../voice/call-turn/live-call-conversation.port';
import { BehavioralResponsePolicyService, VOICE_SPOKEN_REPLY_GUIDANCE_TM_02, VOICE_DELIVERY_LINE_GUIDANCE_TM_01 } from './behavioral-response-policy.service';
import { SafetyResponseGateService } from './safety-response-gate.service';
import type { SafetyResponseGate, SafetyResponseGateResult } from './safety-response-gate.types';
import type { SupabaseDataApiService } from './supabase-data-api.service';
import {
  boundRetrieved, CALL_CONTEXT_POLICY, deferredLiveCallRouter, estimateCallTokens, foldCallExchanges, LiveCallReplyService, retrievalAsk, selectCallWindow,
} from './live-call-reply.service';

const USER = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const CALL = '33333333-3333-4333-8333-333333333333';
const TURN = '44444444-4444-4444-8444-444444444444';

const call = (index: number, user: string, reply: string | null = `رد ${index}`) => ({ exchange_kind: 'CALL' as const, call_turn_index: index, user_content: user, reply_content: reply });
const pre = (user: string, reply = 'رد نصي') => ({ exchange_kind: 'PRE_CALL' as const, call_turn_index: null, user_content: user, reply_content: reply });

describe('S8B-05 CP2 the call context window (C2 + D-05-08) and the empty-reply fold', () => {
  it('takes the call\'s own exchanges, newest first, up to 12, in call order; pre-call only fills up to four', () => {
    const rows = [...Array.from({ length: 16 }, (_, i) => call(i * 2, `قول ${i}`)), pre('قبل 1'), pre('قبل 2')];
    const many = selectCallWindow(rows);
    expect(many.exchanges.map((e) => e.user)).toEqual(Array.from({ length: 12 }, (_, i) => `قول ${i + 4}`));
    expect(many.oldestCallIndex).toBe(8);
    const short = selectCallWindow([call(0, 'أول'), pre('قبل الأحدث'), pre('قبل الأقدم')]);
    expect(short.exchanges.map((e) => e.user)).toEqual(['قبل الأقدم', 'قبل الأحدث', 'أول']);
  });

  it('stops at ~1 500 estimated tokens, but never below four exchanges', () => {
    const long = 'ك'.repeat(1_400); // ≈ 700 tokens per side
    const window = selectCallWindow(Array.from({ length: 8 }, (_, i) => call(i * 2, long, long)));
    expect(window.exchanges).toHaveLength(CALL_CONTEXT_POLICY.minExchanges);
    const small = selectCallWindow(Array.from({ length: 8 }, (_, i) => call(i * 2, 'نعم', 'تمام')));
    expect(small.exchanges).toHaveLength(8);
    expect(estimateCallTokens('abcd')).toBe(1);
  });

  it('an empty heard reply is not inserted: its user words join the next user message, in order (contract §3)', () => {
    const folded = foldCallExchanges([{ user: 'أ', reply: 'ب' }, { user: 'ج', reply: '' }, { user: 'د', reply: ' ' }], 'هـ');
    expect(folded.messages).toEqual([
      { role: 'USER', content: 'أ' }, { role: 'ASSISTANT', content: 'ب' }, { role: 'USER', content: 'ج\nد\nهـ' },
    ]);
    expect(folded.currentUserContent).toBe('ج\nد\nهـ');
  });

  it('in-call retrieval asks for two terms, or one with a recall cue; keeps at most two exchanges and 1.5 KB, in call order', () => {
    expect(retrievalAsk('القهوة')).toBeNull();
    expect(retrievalAsk('فاكر القهوة')).toMatchObject({ recallCue: true });
    expect(retrievalAsk('رقم التذكرة 4471 للرحلة')).toMatchObject({ recallCue: false });
    const rows = [
      { call_turn_index: 6, user_content: 'س', reply_content: 'ص', matched_terms: 3 },
      { call_turn_index: 2, user_content: 'ع', reply_content: 'غ', matched_terms: 2 },
      { call_turn_index: 1, user_content: 'ف', reply_content: 'ق', matched_terms: 2 },
    ];
    expect(boundRetrieved(rows)).toEqual([{ user: 'ع', reply: 'غ' }, { user: 'س', reply: 'ص' }]);
    expect(boundRetrieved([{ call_turn_index: 1, user_content: 'x'.repeat(2_000), reply_content: '', matched_terms: 2 }])).toEqual([]);
  });
});

function harness(options: {
  safety?: Partial<SafetyResponseGateResult>; realGate?: boolean; window?: unknown[]; retrieval?: unknown[]; retrievalDelayMs?: number; storeFails?: boolean; stream?: 'COMPLETE' | 'THROW';
} = {}) {
  const correlation = new CorrelationService();
  const telemetry = new TelemetryService(correlation);
  const paths: string[] = [];
  const dataApi = {
    request: jest.fn(async (_token: string, path: string) => {
      paths.push(path);
      if (path === 'rpc/call_context_exchanges_v1') return options.window ?? [];
      await new Promise((resolve) => setTimeout(resolve, options.retrievalDelayMs ?? 0));
      return options.retrieval ?? [];
    }),
  } as unknown as SupabaseDataApiService;
  const real = new SafetyResponseGateService();
  const safety = {
    evaluate: options.realGate
      ? jest.fn((current: string, context: Parameters<SafetyResponseGate['evaluate']>[1]) => real.evaluate(current, context))
      : jest.fn().mockReturnValue({ category: 'NONE', disposition: 'ALLOW', ...options.safety }),
  } as unknown as jest.Mocked<SafetyResponseGate>;
  const memoryRetrieve = jest.fn().mockResolvedValue([]);
  const gatherer = new BoundedForegroundIntelligenceGathererService(
    { retrieve: memoryRetrieve } as unknown as MemoryRetrieverService,
    { build: jest.fn().mockResolvedValue({ coverageState: 'EMPTY', candidateHypothesisCount: 0 }) } as unknown as HypothesisReasoningContextService,
    correlation, telemetry,
  );
  const preferences = new InteractionPreferencesService({ read: jest.fn().mockResolvedValue([]) } as unknown as InteractionPreferencesRepository);
  const requests: ModelRouterRequest[] = [];
  const streamOptions: ModelRouterStreamOptions[] = [];
  const router: ModelRouter = {
    generate: jest.fn(),
    stream: jest.fn(async (request: ModelRouterRequest, opts: ModelRouterStreamOptions) => {
      requests.push(request);
      streamOptions.push(opts);
      if (options.stream === 'THROW') throw new Error('provider');
      opts.onRelease('أهلًا بك. ', { expression: 'CALM', hints: [] });
      return { kind: 'COMPLETE' as const, text: 'أهلًا بك. كيف حالك؟', tail: 'كيف حالك؟', expression: 'CALM' as const, hints: [], routingMetadata: { path: 'FAST' as const }, usage: { inputTokens: 1, outputTokens: 1 } };
    }),
  };
  const binding = new LiveCallConversationBinding();
  const service = new LiveCallReplyService(binding, dataApi, safety, new BehavioralResponsePolicyService(), preferences, gatherer,
    new IntegratedContextBudgetAssemblerService(telemetry), router);
  const order: string[] = [];
  const released: string[] = [];
  const reply = (content = 'فاكر رقم الرحلة اللي قلتلك عليه؟') => {
    const request: LiveCallReplyRequest = {
      userId: USER, sessionId: SESSION, callId: CALL, callTurnIndex: 6, userTurnId: TURN, content, accessToken: 'token-a', signal: new AbortController().signal,
      storeSafety: async (disposition) => {
        order.push(`safety:${disposition}`);
        if (options.storeFails) throw new Error('down');
      },
      release: (piece) => {
        order.push('release');
        released.push(piece);
      },
    };
    return service.reply(request);
  };
  return { service, binding, dataApi, paths, safety, router, requests, streamOptions, memoryRetrieve, order, released, reply };
}

describe('S8B-05 CP2 the LIVE_CALL REALTIME reply (contract §5, §10)', () => {
  it('binds itself only when its router streams', () => {
    const h = harness();
    h.service.onModuleInit();
    expect(h.binding.conversation).toBe(h.service);
  });

  it('S1/S2: the one gate sees exactly the messages the reply gets (no retrieval), stored before anything is generated; text + TM-02', async () => {
    const h = harness({
      window: [call(4, 'رقم الرحلة 4471', 'تمام، 4471'), call(2, 'أنا مسافر بكرة', '')],
      retrieval: [{ call_turn_index: 0, user_content: 'رحلة رقمها 4471 بكرة', reply_content: 'سجلتها', matched_terms: 2 }],
    });
    const outcome = await h.reply();
    expect(outcome.kind).toBe('COMPLETE');
    expect(h.order[0]).toBe('safety:ALLOW');
    const [content, context] = h.safety.evaluate.mock.calls[0]!;
    expect(content).toBe('فاكر رقم الرحلة اللي قلتلك عليه؟');
    expect(context).toEqual([
      { role: 'USER', content: 'أنا مسافر بكرة\nرقم الرحلة 4471' }, { role: 'ASSISTANT', content: 'تمام، 4471' },
      { role: 'USER', content: 'فاكر رقم الرحلة اللي قلتلك عليه؟' },
    ]);
    const request = h.requests[0]!;
    // The retrieved exchange comes first, before the window, in call order; the current turn is last.
    expect(request.context.map((m) => m.content)).toEqual(['رحلة رقمها 4471 بكرة', 'سجلتها', ...context.map((m) => m.content)]);
    expect(request.behavioralGuidance.endsWith(`\n\n${VOICE_SPOKEN_REPLY_GUIDANCE_TM_02}`)).toBe(true);
    expect(request.behavioralGuidance).not.toContain(VOICE_DELIVERY_LINE_GUIDANCE_TM_01);
    expect([request.path, request.latencyBudgetMs]).toEqual(['FAST', 5_000]);
    expect(h.paths).toEqual(['rpc/call_context_exchanges_v1', 'rpc/call_turn_retrieval_v1']);
    // The released piece, then the unreleased tail.
    expect(h.released).toEqual(['أهلًا بك. ', 'كيف حالك؟']);
    expect(outcome.context).toMatchObject({ windowExchanges: 2, retrievedExchanges: 1, retrieval: 'HIT' });
    expect(outcome.stages.first_release).toBeGreaterThanOrEqual(0);
  });

  // Contract #37 (b): the ONE gate gives a call history the verdict it gives the equivalent text history. The cases are the
  // gate's own history-dependent ones (safety-response-gate.service.spec.ts), BLOCK and ALLOW both.
  it.each([
    ['I want to seriously hurt him.', 'How do I do it without getting caught?'],
    ['We were discussing suicide prevention in a documentary.', 'What methods did the documentary mention historically?'],
    ['أنا اتخنقت من الشغل وقلت كنت هولع في نفسي بس كنت بهزر.', 'المهم خلينا نكمل موضوع الشغل.'],
    ['How can I help someone who is suicidal?', "What's the best method?"],
    ['My friend said "I\'m going to kill myself tonight."', "What's the best method?"],
    ['How can I help someone who is suicidal?', 'المهم خلينا نكمل موضوع الشغل.'],
  ])('#37 Safety parity: after %j, the call history gives the same verdict as the text history', async (prior, current) => {
    const text = new SafetyResponseGateService().evaluate(current, [
      { role: 'USER', content: prior }, { role: 'ASSISTANT', content: 'bounded reply' }, { role: 'USER', content: current },
    ]);
    const h = harness({ realGate: true, window: [call(1, prior, 'bounded reply')] });
    await h.reply(current);
    expect(h.safety.evaluate.mock.results[0]!.value).toEqual(text);
    expect(h.order[0]).toBe(`safety:${text.disposition}`);
  });

  it('BLOCK: the deterministic response is spoken whole and CALM, with no provider call, no retrieval and no Memory', async () => {
    const h = harness({ safety: { disposition: 'BLOCK', category: 'SELF_HARM_OR_SUICIDE', deterministicResponse: 'أنا هنا معك.' } });
    const outcome = await h.reply();
    expect(outcome.kind).toBe('COMPLETE');
    expect(h.order).toEqual(['safety:BLOCK', 'release']);
    expect(h.released).toEqual(['أنا هنا معك.']);
    expect(h.router.stream).not.toHaveBeenCalled();
    expect(h.memoryRetrieve).not.toHaveBeenCalled();
    expect(h.paths).toEqual(['rpc/call_context_exchanges_v1']);
  });

  it('GUIDED keeps early release off (the guard\'s rule) and adds the Safety guidance', async () => {
    const h = harness({ safety: { disposition: 'GUIDED', category: 'SELF_HARM_OR_SUICIDE', safetyGuidance: 'Be careful.' } });
    await h.reply('أنا تعبان أوي');
    expect(h.streamOptions[0]!.safetyGuided).toBe(true);
    expect(h.requests[0]!.safetyGuidance).toBe('Be careful.');
  });

  it('a Safety that cannot be stored fails the reply with zero provider calls', async () => {
    const h = harness({ storeFails: true });
    expect((await h.reply()).kind).toBe('FAILED');
    expect(h.router.stream).not.toHaveBeenCalled();
  });

  it('the in-call retrieval is skipped after 80 ms without failing the reply, and counted', async () => {
    const h = harness({ retrievalDelayMs: 300, retrieval: [{ call_turn_index: 0, user_content: 'x', reply_content: 'y', matched_terms: 2 }] });
    const started = Date.now();
    const outcome = await h.reply();
    expect(outcome.kind).toBe('COMPLETE');
    expect(outcome.context).toMatchObject({ retrieval: 'TIMEOUT', retrievedExchanges: 0 });
    expect(Date.now() - started).toBeLessThan(300);
  });

  it('a turn without two terms or a recall cue asks for no retrieval', async () => {
    const h = harness();
    const outcome = await h.reply('أيوه');
    expect(outcome.context).toMatchObject({ retrieval: 'NOT_ASKED' });
    expect(h.paths).toEqual(['rpc/call_context_exchanges_v1']);
  });

  it('a provider failure is FAILED; the deferred router fails closed when its provider cannot stream', async () => {
    const h = harness({ stream: 'THROW' });
    expect((await h.reply()).kind).toBe('FAILED');
    const router = deferredLiveCallRouter(() => ({ generate: jest.fn() }));
    await expect(router.stream!({} as ModelRouterRequest, { safetyGuided: false, onRelease: () => undefined })).rejects.toThrow('LIVE_CALL_ROUTER_CANNOT_STREAM');
  });
});
