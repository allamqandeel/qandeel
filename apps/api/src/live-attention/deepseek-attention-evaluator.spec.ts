import { DeepSeekAttentionEvaluator, attentionData, parseAttentionAnswer } from './deepseek-attention-evaluator';
import type { AttentionEvaluationInput } from './provisional-attention.types';

const input = (over: Partial<AttentionEvaluationInput> = {}): AttentionEvaluationInput => ({
  track: 'USER', priorText: 'earlier words', carryRequired: false, contextCarry: null, openSubjects: [], foldedSubjects: [],
  threads: [{ id: 't-1', name: 'work' }], newEvidence: [{ seq: 3, text: 'one' }, { seq: 4, text: 'two' }], ...over,
});
const dev = (over: Record<string, unknown> = {}) => ({
  op: 'SET', subjectKey: 'new-job', label: 'a new job', kind: 'PLAN', confidence: 'HIGH', threadRef: null, dependsOnSeq: 3, ...over,
});
const answer = (developments: unknown[], contextCarry: unknown = null) => JSON.stringify({ developments, contextCarry });

describe('INTEL-LIVE-01 CP1: the attention answer parser (fail-closed)', () => {
  it('accepts exactly the schema and returns developments in evidence order, then model order', () => {
    const parsed = parseAttentionAnswer(answer([dev({ dependsOnSeq: 4, subjectKey: 'b' }), dev({ subjectKey: 'a' }), dev({ dependsOnSeq: 4, subjectKey: 'c' })]), input());
    expect(parsed!.developments.map((d) => d.subjectKey)).toEqual(['a', 'b', 'c']);
  });

  it('an empty developments array is NONE, not a refusal', () => {
    expect(parseAttentionAnswer(answer([]), input())).toEqual({ developments: [], contextCarry: null });
  });

  it.each([
    ['extra top-level key', JSON.stringify({ developments: [], contextCarry: null, note: 'x' })],
    ['missing contextCarry', JSON.stringify({ developments: [] })],
    ['not JSON', 'developments: none'],
    ['an unknown evidence seq', answer([dev({ dependsOnSeq: 9 })])],
    ['an invented thread id', answer([dev({ threadRef: 't-404' })])],
    ['an unknown kind', answer([dev({ kind: 'MOOD' })])],
    ['a malformed key', answer([dev({ subjectKey: 'Bad Key' })])],
    ['a label over 40 characters', answer([dev({ label: 'x'.repeat(41) })])],
    ['an extra development field', answer([{ ...dev(), why: 'because' }])],
    ['a carry over 80 words', answer([], Array.from({ length: 81 }, () => 'w').join(' '))],
  ])('refuses %s', (_name, raw) => {
    expect(parseAttentionAnswer(raw, input())).toBeNull();
  });

  it('accepts a thread reference only to one of the offered threads, and a bounded carry', () => {
    const parsed = parseAttentionAnswer(answer([dev({ threadRef: 't-1' })], '  the  manager  is Ahmed '), input());
    expect(parsed!.developments[0]!.threadRef).toBe('t-1');
    expect(parsed!.contextCarry).toBe('the manager is Ahmed');
  });
});

describe('INTEL-LIVE-01 CP1: the DeepSeek attention evaluator', () => {
  const client = (create: jest.Mock) => ({ chat: { completions: { create } } }) as never;

  it('keeps the prefix-stable data order: what grows append-only first, the new evidence last', () => {
    const data = attentionData(input());
    const order = ['speaker', 'priorText', 'contextCarry', 'threads', 'foldedSubjects', 'openSubjects', 'carryRequired', 'newEvidence']
      .map((key) => data.indexOf(`"${key}"`));
    expect(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1]!))).toBe(true);
  });

  it('returns DEVELOPMENTS with usage from one call, no retries, under its timeout', async () => {
    const create = jest.fn().mockResolvedValue({
      choices: [{ message: { content: answer([dev()]) }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 1_200, prompt_cache_hit_tokens: 1_000, completion_tokens: 40 },
    });
    const result = await new DeepSeekAttentionEvaluator({ timeoutMs: 4_000 }, client(create)).evaluate(input(), new AbortController().signal);
    expect(result.kind).toBe('DEVELOPMENTS');
    expect(result.usage).toEqual({ promptTokens: 1_200, cacheHitTokens: 1_000, completionTokens: 40 });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][1]).toMatchObject({ timeout: 4_000, maxRetries: 0 });
  });

  it('a malformed answer is REFUSED; a transport failure is PROVIDER_FAILED; an abort is TIMEOUT; it never throws', async () => {
    const refused = jest.fn().mockResolvedValue({ choices: [{ message: { content: '{"x":1}' }, finish_reason: 'stop' }] });
    expect((await new DeepSeekAttentionEvaluator({ timeoutMs: 4_000 }, client(refused)).evaluate(input(), new AbortController().signal)).kind).toBe('REFUSED');
    const failed = jest.fn().mockRejectedValue(new Error('socket'));
    expect((await new DeepSeekAttentionEvaluator({ timeoutMs: 4_000 }, client(failed)).evaluate(input(), new AbortController().signal)).kind).toBe('PROVIDER_FAILED');
    const controller = new AbortController();
    const hanging = jest.fn().mockImplementation((_body, options: { signal: AbortSignal }) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const pending = new DeepSeekAttentionEvaluator({ timeoutMs: 4_000 }, client(hanging)).evaluate(input(), controller.signal);
    controller.abort();
    expect((await pending).kind).toBe('TIMEOUT');
  });
});
