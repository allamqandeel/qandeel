import { AiProviderCallAccounting, type AiProviderCallBeginRecord } from './ai-provider-call-accounting';
import { accountedAnthropicMessagesClient, accountedOpenAIResponsesClient } from './accounted-provider-clients';
import { currentAiUsageAttribution, runWithAiUsageAttribution } from './ai-usage-attribution';
import { OpenAIModelRouter } from '../model-router/providers/openai/openai-model-router';
import { ClaudeModelRouter } from '../model-router/providers/anthropic/claude-model-router';
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

const openAIConfig = { apiKey: 'k', resolveModel: (path: 'FAST' | 'DEEP') => ({ model: path === 'FAST' ? 'gpt-fast' : 'gpt-deep', reasoningEffort: 'none' as const }), maxOutputTokens: 10, timeoutMs: 1000, maxRetries: 0 as const };

describe('AI-COST-01 Model Router integration', () => {
  it('every reply attempt is one accounted CONVERSATION_REPLY call carrying its FAST / DEEP path', async () => {
    const l = ledger();
    const create = jest.fn(async () => ({ output_text: 'hi', usage: { input_tokens: 5, input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 }, output_tokens: 1 } }));
    const router = new OpenAIModelRouter(openAIConfig as never, accountedOpenAIResponsesClient({ responses: { create } }, 'CONVERSATION_REPLY', l.accounting) as never);
    const result = await runWithAiUsageAttribution({ userId: USER }, () => router.generate(request('DEEP')));
    expect(result.content).toBe('hi');
    expect(l.begun).toEqual([expect.objectContaining({ featureFamily: 'CONVERSATION_REPLY', processingPath: 'DEEP', requestedModel: 'gpt-deep', provider: 'OPENAI' })]);
  });

  it('a reply whose accounting intent cannot be written fails through the existing bounded provider failure, with no provider call', async () => {
    const l = ledger(true);
    const create = jest.fn();
    const router = new OpenAIModelRouter(openAIConfig as never, accountedOpenAIResponsesClient({ responses: { create } }, 'CONVERSATION_REPLY', l.accounting) as never);
    await expect(runWithAiUsageAttribution({ userId: USER }, () => router.generate(request('FAST')))).rejects.toBeInstanceOf(ModelRouterProviderError);
    expect(create).not.toHaveBeenCalled();
  });

  it('a reply with no reported usage is no longer turned into zero tokens', async () => {
    const router = new OpenAIModelRouter(openAIConfig as never, { responses: { create: async () => ({ output_text: 'hi' }) } } as never);
    expect((await router.generate(request('FAST'))).usage).toEqual({ inputTokens: null, outputTokens: null });
  });

  it('Claude: the same boundary, the same path attribution', async () => {
    const l = ledger();
    const config = { apiKey: 'k', resolveModel: () => ({ model: 'claude-x' }), maxOutputTokens: 10, timeoutMs: 1000, maxRetries: 0 as const };
    const message = { content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 2, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } };
    const router = new ClaudeModelRouter(config as never, accountedAnthropicMessagesClient({ messages: { create: async () => message } }, 'CONVERSATION_REPLY', l.accounting) as never);
    await runWithAiUsageAttribution({ userId: USER }, () => router.generate(request('FAST')));
    expect(l.begun[0]).toMatchObject({ provider: 'ANTHROPIC', processingPath: 'FAST', requestedModel: 'claude-x' });
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
