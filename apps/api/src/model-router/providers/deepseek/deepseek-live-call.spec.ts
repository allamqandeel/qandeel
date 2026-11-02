// S8B-05 CP2 (contract §5, REALTIME): the live call's reply router. A fake streaming client only: no network, no DeepSeek
// call, no paid call.
import { ModelRouterProviderError, type ModelRouterRequest } from '../../model-router.types';
import { DeepSeekModelRouter } from './deepseek-model-router';
import { DEEPSEEK_LIVE_CALL, loadDeepSeekLiveCallConfig, type DeepSeekModelRouterConfig } from './deepseek-model-router.config';
import { createDeepSeekClient } from './deepseek-client';
import { accountedDeepSeekStreamingChatCompletions } from '../../../ai-usage/accounted-provider-clients';
import { AiProviderCallAccounting, type AiProviderCallSettleRecord } from '../../../ai-usage/ai-provider-call-accounting';
import { runWithAiUsageAttribution } from '../../../ai-usage/ai-usage-attribution';

const USER = '11111111-1111-4111-8111-111111111111';
const ENV = { NODE_ENV: 'development', DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'test-only' } as NodeJS.ProcessEnv;

const request = (): ModelRouterRequest => ({
  task: 'CONVERSATIONAL_RESPONSE', path: 'FAST', complexity: 'LOW', behavioralGuidance: 'You are Qandeel.',
  context: [{ role: 'USER', content: 'مرحبا' }], locale: 'ar', modality: 'TEXT', latencyBudgetMs: 5_000, costBudget: 'LOW', safetyLevel: 'STANDARD',
});

type Chunk = Record<string, unknown>;
const content = (text: string): Chunk => ({ choices: [{ index: 0, delta: { content: text }, finish_reason: null }] });
const STOP: Chunk[] = [{ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }, { choices: [], usage: { prompt_tokens: 9, completion_tokens: 4 } }];

function harness(firstDelayMs: number | 'NEVER', firstTokenTimeoutMs = 60) {
  const settled: AiProviderCallSettleRecord[] = [];
  const accounting = new AiProviderCallAccounting({ begin: async () => undefined, settle: async (record) => { settled.push(record); } });
  const create = jest.fn(async (_body: Record<string, unknown>, options: { signal: AbortSignal }) => {
    async function* generate(): AsyncGenerator<Chunk> {
      await new Promise<void>((resolve, reject) => {
        const abort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        if (options.signal.aborted) return abort();
        options.signal.addEventListener('abort', abort);
        if (firstDelayMs !== 'NEVER') setTimeout(resolve, firstDelayMs);
      });
      yield content('أهلًا بك، كيف حالك اليوم؟ ');
      yield content('أنا هنا.');
      for (const chunk of STOP) yield chunk;
    }
    return generate();
  });
  const config: DeepSeekModelRouterConfig = { ...loadDeepSeekLiveCallConfig(ENV), firstTokenTimeoutMs };
  const router = new DeepSeekModelRouter(config, { chat: { completions: { create: jest.fn() } } }, undefined,
    accountedDeepSeekStreamingChatCompletions({ chat: { completions: { create } } }, 'CONVERSATION_REPLY', accounting));
  const run = () => runWithAiUsageAttribution({ userId: USER }, () => router.stream(request(), { safetyGuided: false, onRelease: () => undefined }));
  return { run, create, settled };
}

describe('S8B-05 CP2 the live call REALTIME router (DeepSeek Flash, VA-1 / VA-4)', () => {
  it('is FAST without thinking, max_tokens 160, 5 000 ms whole and 2 000 ms to the first token, behind the same gate', () => {
    expect(DEEPSEEK_LIVE_CALL).toEqual({ maxOutputTokens: 160, timeoutMs: 5_000, firstTokenTimeoutMs: 2_000 });
    const config = loadDeepSeekLiveCallConfig(ENV);
    expect(config.resolveModel('DEEP')).toEqual({ model: 'deepseek-flash', thinking: 'disabled' });
    expect(config.maxOutputTokens).toEqual({ FAST: 160, DEEP: 160 });
    expect([config.timeoutMs, config.firstTokenTimeoutMs, config.maxRetries]).toEqual([5_000, 2_000, 0]);
    expect(() => loadDeepSeekLiveCallConfig({ ...ENV, NODE_ENV: 'production' })).toThrow('qualification-only');
    expect(() => loadDeepSeekLiveCallConfig({ ...ENV, DEEPSEEK_QUALIFICATION_MODE: '' })).toThrow('SYNTHETIC_ONLY');
  });

  it('sends max_tokens 160 with thinking disabled, and a first token inside its budget completes', async () => {
    const h = harness(10);
    const result = await h.run();
    expect(result.kind).toBe('COMPLETE');
    const [body, options] = h.create.mock.calls[0]!;
    expect(body).toMatchObject({ model: 'deepseek-flash', max_tokens: 160, thinking: { type: 'disabled' }, stream: true });
    expect(options).toMatchObject({ timeout: 5_000, maxRetries: 0 });
    expect(h.settled).toEqual([expect.objectContaining({ outcome: 'SUCCEEDED' })]);
  });

  it('no first token within the budget aborts the stream: nothing released, the reply fails, the ledger row is settled once', async () => {
    const h = harness('NEVER', 40);
    const started = Date.now();
    await expect(h.run()).rejects.toBeInstanceOf(ModelRouterProviderError);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(h.settled).toHaveLength(1);
    expect(h.settled[0]!.outcome).not.toBe('SUCCEEDED');
  });

  it('the client takes the call\'s own keep-alive fetch (L1) and otherwise the SDK default', async () => {
    const seen: string[] = [];
    const own = (async (input: string | URL | Request) => {
      seen.push(String(input));
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'x' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const client = createDeepSeekClient({ apiKey: 'test-only', timeoutMs: 1_000 }, own);
    await client.chat.completions.create({ model: 'deepseek-flash', messages: [{ role: 'user', content: 'x' }] });
    expect(seen).toEqual(['https://api.deepseek.com/chat/completions']);
  });
});
