import type { CurrentCuInput } from '../conversational-focus/conversational-focus.types';
import type { CanonicalCuFocusSemanticPayload } from '../conversational-focus/durable-focus-payload.types';
import { DEEPSEEK_FLASH_MODEL, DEEPSEEK_JSON_OUTPUT_INSTRUCTION } from '../model-router/providers/deepseek/deepseek-client';
import { DeepSeekThreadContinuityProvider } from './deepseek-thread-continuity.provider';
import { THREAD_CONTINUITY_PROMPT_VERSION, type ThreadContinuityDeepSeekConfig } from './thread-continuity-provider.config';
import { THREAD_CONTINUITY_SCHEMA_VERSION, ThreadContinuityProviderError, type ThreadContinuityResolutionRequest } from './thread-continuity-provider.types';
import { THREAD_CONTINUITY_DECISIONS } from './thread-continuity.types';

// S8A-03 (D1): the Thread Continuity adapter's transport, request shape and failure classification on DeepSeek Flash.
// Its parsers and the deterministic validator are covered by `thread-continuity-evaluator.service.spec.ts`.

const CU = '11111111-2222-4333-8444-555555555555';
const PRIOR_CU = '11111111-2222-4333-8444-666666666666';
const HANDLE = '5ef8538d-ddda-5e11-b7d9-052be85de59a';
const TEXT = 'عايز أرجع لأحمد بتاع الشغل.';
const threadId = (n: number) => `${n.toString(16).padStart(8, '0')}-0000-5000-8000-000000000000`;

const CONFIG: ThreadContinuityDeepSeekConfig = {
  provider: 'DEEPSEEK', model: DEEPSEEK_FLASH_MODEL, apiKey: 'test-key', timeoutMs: 8_000, maxOutputTokens: 1_024,
  maxRetries: 0, promptVersion: THREAD_CONTINUITY_PROMPT_VERSION, schemaVersion: 1,
};

const currentCu: CurrentCuInput = { cuId: CU, sourceTurnId: '77777777-7777-4777-8777-777777777777', sourceRole: 'USER', committedText: TEXT, ordinalWithinTurn: 0 };
const semantics: CanonicalCuFocusSemanticPayload = {
  unit_id: CU, functions: ['REQUEST'], sequence_position: 'INITIATING', target_cu_id: null, claim_attributions: [],
  references: [{ reference_index: 0, anchor_text: 'أحمد', anchor_occurrence: 1, span_start: 11, span_end: 15, state: 'RESOLVED', resolved_handle_id: HANDLE, creates_handle: true, candidate_handle_ids: [] }],
  attention: { kind: 'START_NEW_FOCUS', reason: 'DIRECT_SUBJECT', emerging_focus_id: '4ef8538d-ddda-5e11-b7d9-052be85de59a', creates_focus: true, grounding_reference_index: 0 },
};
const REQUEST: ThreadContinuityResolutionRequest = {
  schemaVersion: THREAD_CONTINUITY_SCHEMA_VERSION,
  currentCu,
  currentFocusSemantics: semantics,
  currentFocusGrounding: { emergingFocusId: '4ef8538d-ddda-5e11-b7d9-052be85de59a', groundingSurfaces: [{ cuId: CU, exactSurface: 'أحمد', committedCuText: TEXT }] },
  candidates: [1, 2].map((n) => ({
    threadId: threadId(n),
    identityEvidence: [{ sessionId: '88888888-8888-4888-8888-888888888888', cuId: PRIOR_CU, exactSurface: 'أحمد', committedCuText: 'أحمد نفسه بدأ يقلقني <tag>.', sourceRole: 'USER' as const }],
  })),
};
const SCREENING = JSON.stringify({ possibleSameThreadIds: [threadId(1)] });
const RESOLUTION = JSON.stringify({ decision: 'BIND_EXISTING', threadId: threadId(1), candidateThreadIds: [], currentEvidenceReferenceIndexes: [0], priorEvidenceRefs: [{ cuId: PRIOR_CU, exactSurface: 'أحمد' }] });

const completion = (content: string | null, finishReason = 'stop') => ({ choices: [{ finish_reason: finishReason, message: { content } }] });
const clientOf = (create: jest.Mock) => ({ chat: { completions: { create } } });
const returning = (response: unknown) => { const create = jest.fn().mockResolvedValue(response); return { create, client: clientOf(create) }; };
const throwing = (error: unknown) => { const create = jest.fn().mockRejectedValue(error); return { create, client: clientOf(create) }; };
const systemOf = (create: jest.Mock): string => create.mock.calls[0][0].messages[0].content;
const schemaOf = (create: jest.Mock): Record<string, any> => JSON.parse(systemOf(create).split('\n').pop() as string);
const code = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ThreadContinuityProviderError) return error.code;
    throw error;
  }
  throw new Error('expected a provider rejection');
};

describe('DeepSeekThreadContinuityProvider request shaping', () => {
  it('screens with one DeepSeek Flash JSON Output call: closed schema, untrusted-data envelope, no thinking, no SDK retries', async () => {
    const { create, client } = returning(completion(SCREENING));
    await expect(new DeepSeekThreadContinuityProvider(CONFIG, client).screen(REQUEST)).resolves.toEqual({ possibleSameThreadIds: [threadId(1)] });
    expect(create).toHaveBeenCalledTimes(1);
    const [body, options] = create.mock.calls[0];
    expect(options).toEqual({ timeout: 8_000, maxRetries: 0, signal: expect.any(AbortSignal) });
    expect(Object.keys(body).sort()).toEqual(['max_tokens', 'messages', 'model', 'response_format', 'stream', 'thinking']);
    expect(body).toMatchObject({ model: 'deepseek-flash', max_tokens: 1_024, stream: false, response_format: { type: 'json_object' }, thinking: { type: 'disabled' } });
    expect(body.messages.map((message: { role: string }) => message.role)).toEqual(['system', 'user']);
    expect(systemOf(create)).toContain(DEEPSEEK_JSON_OUTPUT_INSTRUCTION);
    expect(schemaOf(create)).toEqual({
      type: 'object', additionalProperties: false, required: ['possibleSameThreadIds'],
      properties: { possibleSameThreadIds: { type: 'array', maxItems: 2, items: { type: 'string' } } },
    });
    const user = body.messages[1].content as string;
    expect(user).toMatch(/^<thread_continuity_source>.*<\/thread_continuity_source>$/su);
    expect(user).toContain('\\u003ctag\\u003e');
    expect(user).not.toContain('<tag>');
    expect(JSON.stringify(body)).not.toContain('test-key');
  });

  it('resolves with the closed five-key resolution schema and accepts only its exact shape', async () => {
    const { create, client } = returning(completion(RESOLUTION));
    await expect(new DeepSeekThreadContinuityProvider(CONFIG, client).resolve(REQUEST)).resolves.toEqual(JSON.parse(RESOLUTION));
    const schema = schemaOf(create);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['decision', 'threadId', 'candidateThreadIds', 'currentEvidenceReferenceIndexes', 'priorEvidenceRefs']);
    expect(schema.properties.decision.enum).toEqual([...THREAD_CONTINUITY_DECISIONS]);
    expect(JSON.stringify(schema)).not.toMatch(/score|confidence|rationale|rank|home|spatial|relation/iu);
  });

  it('refuses to call the provider for a structurally invalid request', async () => {
    const { create, client } = returning(completion(SCREENING));
    const provider = new DeepSeekThreadContinuityProvider(CONFIG, client);
    expect(await code(provider.screen({ ...REQUEST, schemaVersion: 2 as never }))).toBe('INVALID_STRUCTURED_OUTPUT');
    expect(await code(provider.resolve({ ...REQUEST, currentCu: { ...currentCu, committedText: '' } }))).toBe('INVALID_STRUCTURED_OUTPUT');
    expect(await code(provider.resolve({ ...REQUEST, currentFocusSemantics: { ...semantics, unit_id: PRIOR_CU } }))).toBe('INVALID_STRUCTURED_OUTPUT');
    expect(create).not.toHaveBeenCalled();
  });
});

describe('DeepSeekThreadContinuityProvider completion envelope and failures', () => {
  it('parses only one complete stop answer; truncated, empty or multi-choice completions are invalid output', async () => {
    for (const response of [
      completion(SCREENING, 'length'),
      completion(SCREENING, 'content_filter'),
      completion(''),
      completion(null),
      { choices: [] },
      { choices: [completion(SCREENING).choices[0], completion(SCREENING).choices[0]] },
      {},
    ]) {
      expect(await code(new DeepSeekThreadContinuityProvider(CONFIG, returning(response).client).screen(REQUEST))).toBe('INVALID_STRUCTURED_OUTPUT');
      expect(await code(new DeepSeekThreadContinuityProvider(CONFIG, returning(response).client).resolve(REQUEST))).toBe('INVALID_STRUCTURED_OUTPUT');
    }
  });

  it('classifies insufficient_system_resource, rate limiting and gateway failures as unavailable', async () => {
    expect(await code(new DeepSeekThreadContinuityProvider(CONFIG, returning(completion(SCREENING, 'insufficient_system_resource')).client).screen(REQUEST))).toBe('UNAVAILABLE');
    for (const error of [
      Object.assign(new Error('rate'), { status: 429 }),
      Object.assign(new Error('gateway'), { status: 502 }),
      Object.assign(new Error('busy'), { status: 503 }),
      Object.assign(new Error('socket'), { name: 'APIConnectionError' }),
    ]) {
      expect(await code(new DeepSeekThreadContinuityProvider(CONFIG, throwing(error).client).resolve(REQUEST))).toBe('UNAVAILABLE');
    }
  });

  it('classifies timeouts and everything else without retrying or inventing a proposal', async () => {
    const timeout = throwing(Object.assign(new Error('timed out'), { name: 'APIConnectionTimeoutError' }));
    expect(await code(new DeepSeekThreadContinuityProvider(CONFIG, timeout.client).screen(REQUEST))).toBe('TIMEOUT');
    expect(timeout.create).toHaveBeenCalledTimes(1);
    const hanging = jest.fn((_body, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    expect(await code(new DeepSeekThreadContinuityProvider({ ...CONFIG, timeoutMs: 10 }, clientOf(hanging)).resolve(REQUEST))).toBe('TIMEOUT');
    expect(hanging).toHaveBeenCalledTimes(1);
    const generic = throwing(Object.assign(new Error('bad request'), { status: 400 }));
    expect(await code(new DeepSeekThreadContinuityProvider(CONFIG, generic.client).resolve(REQUEST))).toBe('PROVIDER_ERROR');
    expect(generic.create).toHaveBeenCalledTimes(1);
  });
});
