import { AiProviderCallAccounting, type AiProviderCallBeginRecord } from './ai-provider-call-accounting';
import { accountedDeepSeekChatCompletionsClient } from './accounted-provider-clients';
import { currentAiUsageAttribution, runWithAiUsageAttribution } from './ai-usage-attribution';
import { DeepSeekModelRouter } from '../model-router/providers/deepseek/deepseek-model-router';
import { ModelRouterProviderError, type ModelRouterRequest } from '../model-router/model-router.types';
import { withPostResponseAiUsageAttribution } from '../post-response-intelligence/post-response-intelligence-consumer.service';

const USER = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';
const TURN = '33333333-3333-4333-8333-333333333333';

const request = (path: 'FAST' | 'DEEP'): ModelRouterRequest => ({
  task: 'CONVERSATIONAL_RESPONSE', path, complexity: path === 'FAST' ? 'LOW' : 'HIGH', behavioralGuidance: 'Be brief.',
  context: [{ role: 'USER', content: 'hello' }], locale: 'en', modality: 'TEXT', latencyBudgetMs: 5000, costBudget: 'LOW', safetyLevel: 'STANDARD',
});

function ledger(fail = false) {
  const begun: AiProviderCallBeginRecord[] = [];
  const settled: unknown[] = [];
  return { begun, settled, accounting: new AiProviderCallAccounting({
    begin: async (record) => { if (fail) throw new Error('down'); begun.push(record); },
    settle: async (record) => { settled.push(record); },
  }) };
}

const deepSeekConfig = { apiKey: 'k', resolveModel: () => ({ model: 'deepseek-flash' }), maxOutputTokens: { FAST: 10, DEEP: 10 }, timeoutMs: 1000, maxRetries: 0 as const };
const reply = (usage?: unknown) => ({ choices: [{ finish_reason: 'stop', message: { content: 'hi' } }], ...(usage ? { usage } : {}) });

describe('AI-COST-01 Model Router integration', () => {
  it('every reply attempt is one accounted CONVERSATION_REPLY call carrying its FAST / DEEP path', async () => {
    const l = ledger();
    const create = jest.fn(async () => reply({ prompt_tokens: 5, prompt_cache_hit_tokens: 0, prompt_cache_miss_tokens: 5, completion_tokens: 1 }));
    const router = new DeepSeekModelRouter(deepSeekConfig as never, accountedDeepSeekChatCompletionsClient({ chat: { completions: { create } } }, 'CONVERSATION_REPLY', l.accounting) as never);
    const result = await runWithAiUsageAttribution({ userId: USER }, () => router.generate(request('DEEP')));
    expect(result.content).toBe('hi');
    expect(l.begun).toEqual([expect.objectContaining({ featureFamily: 'CONVERSATION_REPLY', processingPath: 'DEEP', requestedModel: 'deepseek-flash', provider: 'DEEPSEEK' })]);
  });

  it('a reply whose accounting intent cannot be written fails through the existing bounded provider failure, with no provider call', async () => {
    const l = ledger(true);
    const create = jest.fn();
    const router = new DeepSeekModelRouter(deepSeekConfig as never, accountedDeepSeekChatCompletionsClient({ chat: { completions: { create } } }, 'CONVERSATION_REPLY', l.accounting) as never);
    await expect(runWithAiUsageAttribution({ userId: USER }, () => router.generate(request('FAST')))).rejects.toBeInstanceOf(ModelRouterProviderError);
    expect(create).not.toHaveBeenCalled();
  });

  it('a reply with no reported usage is no longer turned into zero tokens', async () => {
    const router = new DeepSeekModelRouter(deepSeekConfig as never, { chat: { completions: { create: async () => reply() } } } as never);
    expect((await router.generate(request('FAST'))).usage).toEqual({ inputTokens: null, outputTokens: null });
  });

  it('S8A-03 (D1): the FAST path is attributed the same way, through the same one boundary', async () => {
    const l = ledger();
    const router = new DeepSeekModelRouter(deepSeekConfig as never, accountedDeepSeekChatCompletionsClient({ chat: { completions: { create: async () => reply() } } }, 'CONVERSATION_REPLY', l.accounting) as never);
    await runWithAiUsageAttribution({ userId: USER }, () => router.generate(request('FAST')));
    expect(l.begun[0]).toMatchObject({ provider: 'DEEPSEEK', processingPath: 'FAST', requestedModel: 'deepseek-flash' });
  });
});

describe('AI-COST-01 post-response attribution', () => {
  const envelope = (extra: Record<string, unknown> = {}) => JSON.stringify({
    event_id: 'e', event_type: 'ConversationTurnCompleted', subject_user_id: USER, subject_session_id: SESSION, subject_turn_id: TURN,
    payload: { processing_path: 'FAST' }, ...extra,
  });

  it('charges the delivery to the event subject, with its session, turn and path', async () => {
    const seen = await withPostResponseAiUsageAttribution(envelope(), async () => currentAiUsageAttribution());
    expect(seen).toEqual({ userId: USER, sessionId: SESSION, sourceTurnId: TURN, processingPath: 'FAST' });
  });

  it('an envelope with no valid subject opens no scope, so any provider attempt it reached would be refused', async () => {
    for (const raw of ['not json', envelope({ subject_user_id: 'someone' }), envelope({ subject_turn_id: null }), JSON.stringify(null)]) {
      await expect(withPostResponseAiUsageAttribution(raw, async () => currentAiUsageAttribution())).resolves.toBeUndefined();
    }
  });

  it('an unrecognized path is simply not attributed', async () => {
    const seen = await withPostResponseAiUsageAttribution(envelope({ payload: { processing_path: 'TURBO' } }), async () => currentAiUsageAttribution());
    expect(seen?.processingPath).toBeUndefined();
  });
});
