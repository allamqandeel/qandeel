// S8B-04 CP2 (Fast Voice Path, D-S2): the streamed VOICE NOTE reply. A fake streaming client only: no network, no
// DeepSeek call, no paid call.
import { ModelRouterProviderError, composeServerGuidance, type ModelRouterRequest } from '../../model-router.types';
import { releaseModelOutput } from '../../model-output-release-guard';
import { stripSpeechMarkup } from '../../../speech-rendering/speech-markup';
import { DeepSeekModelRouter } from './deepseek-model-router';
import { DEEPSEEK_MAX_OUTPUT_TOKENS, type DeepSeekModelRouterConfig } from './deepseek-model-router.config';
import { resolveDeepSeekModel } from '../../model-profile.registry';
import { accountedDeepSeekStreamingChatCompletions } from '../../../ai-usage/accounted-provider-clients';
import {
  AiProviderCallAccounting,
  type AiProviderCallBeginRecord,
  type AiProviderCallSettleRecord,
} from '../../../ai-usage/ai-provider-call-accounting';
import { runWithAiUsageAttribution } from '../../../ai-usage/ai-usage-attribution';

const USER = '11111111-1111-4111-8111-111111111111';
const ECHO = 'Keep ordinary conversation concise and never lecture the person about anything at all.';
const REPLY = '[[speech:JOY]]\nأهلًا بك! سعيد أنك كتبت لي اليوم. كيف كان يومك؟ أخبرني بما حدث.';
const USAGE = { prompt_tokens: 40, prompt_cache_hit_tokens: 10, prompt_cache_miss_tokens: 30, completion_tokens: 12 };

const request = (path: 'FAST' | 'DEEP' = 'FAST', latencyBudgetMs = 3_000): ModelRouterRequest => ({
  task: 'CONVERSATIONAL_RESPONSE', path, complexity: path === 'FAST' ? 'LOW' : 'HIGH',
  behavioralGuidance: `You are Qandeel. ${ECHO}`,
  context: [
    { role: 'USER', content: 'first' },
    { role: 'ASSISTANT', content: 'second' },
    { role: 'USER', content: 'third' },
  ],
  locale: 'ar', modality: 'TEXT', latencyBudgetMs,
  costBudget: 'LOW', safetyLevel: 'STANDARD',
});

const config: DeepSeekModelRouterConfig = {
  apiKey: 'test-only', resolveModel: resolveDeepSeekModel, maxOutputTokens: DEEPSEEK_MAX_OUTPUT_TOKENS,
  timeoutMs: 25_000, maxRetries: 0,
};

function chunks(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

type Chunk = Record<string, unknown>;
const contentChunk = (content: string): Chunk => ({ choices: [{ index: 0, delta: { content }, finish_reason: null }] });
const reasoningChunk = (reasoning: string): Chunk => ({ choices: [{ index: 0, delta: { content: null, reasoning_content: reasoning }, finish_reason: null }] });
const finishChunk = (finish_reason: string): Chunk => ({ choices: [{ index: 0, delta: {}, finish_reason }] });
const usageChunk = (usage: unknown = USAGE): Chunk => ({ choices: [], usage });

/** The chunks DeepSeek would stream for this reply: content in small deltas, the finish, then the usage chunk. */
const streamOf = (text: string, size = 3, finish = 'stop', usage: unknown = USAGE): Chunk[] =>
  [...chunks(text, size).map(contentChunk), finishChunk(finish), usageChunk(usage)];

interface Script {
  readonly chunks: readonly Chunk[];
  /** Thrown after this many chunks were yielded. */
  readonly failAfter?: number;
  /** After this many chunks, wait until the request's signal aborts (then fail as the SDK does). */
  readonly hangAfter?: number;
}

function harness(script: Script) {
  const events: string[] = [];
  const begun: AiProviderCallBeginRecord[] = [];
  const settled: AiProviderCallSettleRecord[] = [];
  const accounting = new AiProviderCallAccounting({
    begin: async (record) => { begun.push(record); },
    settle: async (record) => { settled.push(record); },
  });
  const track = jest.spyOn(accounting, 'track');
  const create = jest.fn(async (_body: Record<string, unknown>, options: { signal: AbortSignal; timeout?: number }) => {
    async function* generate(): AsyncGenerator<Chunk> {
      let index = 0;
      for (const chunk of script.chunks) {
        if (script.failAfter === index) throw new Error('stream broke');
        if (script.hangAfter === index) {
          await new Promise((_resolve, reject) => {
            if (options.signal.aborted) reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
            options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
          });
        }
        events.push(`chunk:${index}`);
        yield chunk;
        index += 1;
      }
      events.push('end');
    }
    return generate();
  });
  const streaming = accountedDeepSeekStreamingChatCompletions({ chat: { completions: { create } } }, 'CONVERSATION_REPLY', accounting);
  const unusedCreate = jest.fn();
  const router = new DeepSeekModelRouter(config, { chat: { completions: { create: unusedCreate } } }, undefined, streaming);
  const pieces: string[] = [];
  const run = (options: { safetyGuided?: boolean; signal?: AbortSignal; onRelease?: (piece: string) => void } = {}, req = request()) =>
    runWithAiUsageAttribution({ userId: USER }, () => router.stream(req, {
      safetyGuided: options.safetyGuided ?? false,
      signal: options.signal,
      onRelease: (piece) => {
        events.push(`release:${piece}`);
        pieces.push(piece);
        options.onRelease?.(piece);
      },
    }));
  return { run, create, unusedCreate, events, pieces, begun, settled, track };
}

/** What the non-streaming path stores for this full candidate (the whole-candidate guard, then the markup parser). */
function stored(raw: string, guidance = composeServerGuidance(request())): string {
  const parsed = stripSpeechMarkup(releaseModelOutput(raw, guidance), { safetyGuided: false });
  if (parsed.kind !== 'OK') throw new Error('malformed');
  return parsed.text;
}

describe('DeepSeekModelRouter.stream (S8B-04 CP2, D-S2)', () => {
  it('sends the generate request plus stream: true and the usage chunk, through ONE accounted attempt', async () => {
    const h = harness({ chunks: streamOf(REPLY) });
    await h.run();
    expect(h.create).toHaveBeenCalledTimes(1);
    expect(h.unusedCreate).not.toHaveBeenCalled();
    const [body, options] = h.create.mock.calls[0];
    expect(body).toEqual({
      model: 'deepseek-flash',
      messages: [
        { role: 'system', content: composeServerGuidance(request()) },
        { role: 'user', content: 'first' },
        { role: 'assistant', content: 'second' },
        { role: 'user', content: 'third' },
      ],
      max_tokens: 1024,
      thinking: { type: 'disabled' },
      stream: true,
      stream_options: { include_usage: true },
    });
    expect(options).toEqual({ timeout: 3_000, maxRetries: 0, signal: expect.any(AbortSignal) });
    expect(h.track).toHaveBeenCalledTimes(1);
    expect(h.begun).toEqual([expect.objectContaining({ provider: 'DEEPSEEK', requestedModel: 'deepseek-flash', featureFamily: 'CONVERSATION_REPLY', processingPath: 'FAST' })]);
    expect(h.settled).toEqual([expect.objectContaining({ outcome: 'SUCCEEDED' })]);
  });

  it('DEEP: the same model, thinking and budget resolution as generate', async () => {
    const h = harness({ chunks: streamOf(REPLY) });
    await h.run({}, request('DEEP', 25_000));
    const [body, options] = h.create.mock.calls[0];
    expect(body).toMatchObject({ model: 'deepseek-flash', thinking: { type: 'enabled' }, reasoning_effort: 'low', max_tokens: 2800, stream: true });
    expect(options.timeout).toBe(25_000);
  });

  it('releases pieces before the stream ends, and released + tail is exactly what the non-streaming path stores', async () => {
    const h = harness({ chunks: streamOf(REPLY) });
    const result = await h.run();
    expect(result.kind).toBe('COMPLETE');
    if (result.kind !== 'COMPLETE') return;
    expect(result.text).toBe(stored(REPLY));
    expect(h.pieces.join('') + result.tail).toBe(result.text);
    expect(result.expression).toBe('JOY');
    expect(result.routingMetadata).toEqual({ path: 'FAST' });
    expect(h.pieces.length).toBeGreaterThan(0);
    const firstRelease = h.events.findIndex((event) => event.startsWith('release:'));
    expect(firstRelease).toBeGreaterThanOrEqual(0);
    expect(firstRelease).toBeLessThan(h.events.indexOf('end'));
    for (const piece of h.pieces) expect(piece).not.toMatch(/\[\[|\]\]/u);
  });

  it('reads the usage from the final chunk; an unreported usage stays unknown, never zero', async () => {
    const h = harness({ chunks: streamOf(REPLY) });
    await expect(h.run()).resolves.toMatchObject({ usage: { inputTokens: 40, outputTokens: 12 } });
    expect(h.settled[0]).toMatchObject({ usage: { completeness: 'COMPLETE', quantities: { INPUT_TOKEN: 30, CACHE_READ_INPUT_TOKEN: 10, OUTPUT_TOKEN: 12 } } });

    const none = harness({ chunks: [...chunks(REPLY, 5).map(contentChunk), finishChunk('stop')] });
    await expect(none.run()).resolves.toMatchObject({ kind: 'COMPLETE', usage: { inputTokens: null, outputTokens: null } });
    expect(none.settled[0]).toMatchObject({ outcome: 'SUCCEEDED', usage: { completeness: 'ABSENT' } });
  });

  it('never reads the reasoning trace into the reply', async () => {
    const h = harness({ chunks: [reasoningChunk('PRIVATE CHAIN OF THOUGHT. '), reasoningChunk('MORE PRIVATE.'), ...streamOf(REPLY)] });
    const result = await h.run({}, request('DEEP', 25_000));
    expect(result.kind).toBe('COMPLETE');
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    expect(h.pieces.join('')).not.toContain('PRIVATE');
    if (result.kind === 'COMPLETE') expect(result.text).toBe(stored(REPLY));
  });

  it('a guidance echo after a release is WITHHELD_TAIL; with nothing released it throws', async () => {
    const leaked = `أهلًا بك! ${ECHO} تمام.`;
    const h = harness({ chunks: streamOf(leaked) });
    const result = await h.run();
    expect(result).toMatchObject({ kind: 'WITHHELD_TAIL', reason: 'GUIDANCE_ECHO', released: 'أهلًا بك!' });
    expect(h.pieces.join('')).toBe('أهلًا بك!');
    expect(h.pieces.join('')).not.toContain('Keep ordinary');

    const whole = harness({ chunks: streamOf(`${ECHO} تمام.`) });
    await expect(whole.run()).rejects.toBeInstanceOf(ModelRouterProviderError);
    expect(whole.pieces).toEqual([]);
  });

  it('a truncated stream after a release is WITHHELD_TAIL TRUNCATED; before any release it throws', async () => {
    const h = harness({ chunks: streamOf(REPLY, 3, 'length') });
    const result = await h.run();
    expect(result).toMatchObject({ kind: 'WITHHELD_TAIL', reason: 'TRUNCATED', usage: { inputTokens: 40, outputTokens: 12 } });
    if (result.kind === 'WITHHELD_TAIL') expect(result.released).toBe(h.pieces.join(''));
    expect(h.pieces.length).toBeGreaterThan(0);

    const early = harness({ chunks: streamOf('أهلًا', 3, 'length') });
    await expect(early.run()).rejects.toBeInstanceOf(ModelRouterProviderError);
    const unfinished = harness({ chunks: chunks('أهلًا', 2).map(contentChunk) });
    await expect(unfinished.run()).rejects.toBeInstanceOf(ModelRouterProviderError);
  });

  it('a provider failure mid-stream after a release is WITHHELD_TAIL PROVIDER_FAILED, settled FAILED with unknown usage', async () => {
    const h = harness({ chunks: streamOf(REPLY, 3), failAfter: 12 });
    const result = await h.run();
    expect(result).toMatchObject({ kind: 'WITHHELD_TAIL', reason: 'PROVIDER_FAILED', usage: { inputTokens: null, outputTokens: null } });
    if (result.kind === 'WITHHELD_TAIL') expect(result.released).toBe(h.pieces.join(''));
    expect(h.pieces.length).toBeGreaterThan(0);
    expect(h.track).toHaveBeenCalledTimes(1);
    expect(h.settled).toEqual([expect.objectContaining({ outcome: 'FAILED', usage: { completeness: 'ABSENT' } })]);
  });

  it('a provider failure before any release throws ModelRouterProviderError', async () => {
    const broken = harness({ chunks: streamOf(REPLY, 3), failAfter: 2 });
    await expect(broken.run()).rejects.toEqual(new ModelRouterProviderError());
    expect(broken.pieces).toEqual([]);
    expect(broken.settled).toEqual([expect.objectContaining({ outcome: 'FAILED' })]);

    const refused = harness({ chunks: [] });
    refused.create.mockRejectedValueOnce(Object.assign(new Error('402 Insufficient Balance'), { status: 402 }));
    await expect(refused.run()).rejects.toBeInstanceOf(ModelRouterProviderError);
    expect(refused.create).toHaveBeenCalledTimes(1);
  });

  it('an external abort stops the stream: after a release it is WITHHELD_TAIL PROVIDER_FAILED', async () => {
    const external = new AbortController();
    const h = harness({ chunks: streamOf(REPLY, 3), hangAfter: 12 });
    const result = await h.run({ signal: external.signal, onRelease: () => external.abort() });
    expect(result).toMatchObject({ kind: 'WITHHELD_TAIL', reason: 'PROVIDER_FAILED' });
    expect(h.create.mock.calls[0][1].signal.aborted).toBe(true);
    expect(h.events).not.toContain('end');
  });

  it('an already-aborted signal never reaches the provider', async () => {
    const external = new AbortController();
    external.abort();
    const h = harness({ chunks: streamOf(REPLY) });
    await expect(h.run({ signal: external.signal })).rejects.toBeInstanceOf(ModelRouterProviderError);
    expect(h.create).not.toHaveBeenCalled();
    expect(h.settled).toEqual([expect.objectContaining({ outcome: 'CANCELLED_BEFORE_PROVIDER' })]);
  });

  it('the latency budget aborts a hanging stream', async () => {
    const h = harness({ chunks: streamOf(REPLY, 3), hangAfter: 0 });
    await expect(h.run({}, request('FAST', 20))).rejects.toBeInstanceOf(ModelRouterProviderError);
    expect(h.create.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('an onRelease that throws ends the stream as a provider failure after release', async () => {
    const h = harness({ chunks: streamOf(REPLY, 3) });
    const result = await h.run({ onRelease: () => { throw new Error('playback refused'); } });
    expect(result).toMatchObject({ kind: 'WITHHELD_TAIL', reason: 'PROVIDER_FAILED' });
    expect(h.pieces).toHaveLength(1);
    expect(h.events).not.toContain('end');
    expect(h.settled).toEqual([expect.objectContaining({ outcome: 'FAILED' })]);
  });

  it('a GUIDED turn releases nothing early: the whole reply comes back as the tail, CALM', async () => {
    const h = harness({ chunks: streamOf(REPLY) });
    const result = await h.run({ safetyGuided: true });
    expect(h.pieces).toEqual([]);
    expect(result).toMatchObject({ kind: 'COMPLETE', expression: 'CALM' });
    if (result.kind === 'COMPLETE') expect(result.tail).toBe(result.text);
  });

  it('without a streaming client it fails exactly as a failed generation', async () => {
    const router = new DeepSeekModelRouter(config, { chat: { completions: { create: jest.fn() } } });
    await expect(router.stream(request(), { safetyGuided: false, onRelease: jest.fn() })).rejects.toBeInstanceOf(ModelRouterProviderError);
  });
});
