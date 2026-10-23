import { MAX_SOURCE_EXCERPT_CHARS, MAX_UNITS_PER_COMMIT_BATCH } from './conversation-unit.types';
import { codePointLength } from './cu-anchor-mapper';
import { CU_SEGMENTATION_PROMPT_VERSION, type CuSegmentationDeepSeekConfig } from './cu-segmentation-provider.config';
import {
  CU_SEGMENTATION_SCHEMA_VERSION,
  CuSegmentationProviderError,
  type CuSegmentationRequest,
} from './cu-segmentation-provider.types';
import { DeepSeekCuSegmentationProvider } from './deepseek-cu-segmentation.provider';
import { DEEPSEEK_FLASH_MODEL, DEEPSEEK_JSON_OUTPUT_INSTRUCTION } from '../model-router/providers/deepseek/deepseek-client';

const CONFIG: CuSegmentationDeepSeekConfig = {
  provider: 'DEEPSEEK',
  apiKey: 'test-key',
  model: DEEPSEEK_FLASH_MODEL,
  timeoutMs: 5_000,
  maxOutputTokens: 2_048,
  maxRetries: 0,
  promptVersion: CU_SEGMENTATION_PROMPT_VERSION,
  schemaVersion: 1,
};

const REQUEST: CuSegmentationRequest = {
  sourceText: 'أنا سبت الشغل امبارح. وبالمناسبة أحمد كلمني.',
  sourceRole: 'USER',
  maxUnits: MAX_UNITS_PER_COMMIT_BATCH,
  maxExcerptChars: MAX_SOURCE_EXCERPT_CHARS,
  schemaVersion: CU_SEGMENTATION_SCHEMA_VERSION,
};

const completion = (content: string | null, finishReason = 'stop') => ({ choices: [{ finish_reason: finishReason, message: { content } }] });

const clientResolving = (response: unknown) => {
  const create = jest.fn().mockResolvedValue(response);
  return { create, client: { chat: { completions: { create } } } };
};

const clientReturning = (outputText: string) => clientResolving(completion(outputText));

const clientThrowing = (error: unknown) => {
  const create = jest.fn().mockRejectedValue(error);
  return { create, client: { chat: { completions: { create } } } };
};

/** The system message carries the adapter's instructions, then the JSON Output instruction, then the schema. */
const systemOf = (create: jest.Mock): string => (create.mock.calls[0][0] as { messages: Array<{ content: string }> }).messages[0].content;
const schemaOf = (create: jest.Mock): Record<string, any> => JSON.parse(systemOf(create).split('\n').pop() as string);

const code = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CuSegmentationProviderError) return error.code;
    throw error;
  }
  throw new Error('expected a provider rejection');
};

describe('request shaping', () => {
  it('sends a DeepSeek Flash JSON Output request: offset-free schema, untrusted-data envelope, no thinking, no SDK retries', async () => {
    const { create, client } = clientReturning('{"units":[{"text":"أنا سبت الشغل امبارح.","occurrence":1}]}');
    await new DeepSeekCuSegmentationProvider(CONFIG, client).propose(REQUEST);

    const [body, options] = create.mock.calls[0];
    expect(options).toEqual({ timeout: 5_000, maxRetries: 0, signal: expect.anything() });
    expect(Object.keys(body).sort()).toEqual(['max_tokens', 'messages', 'model', 'response_format', 'stream', 'thinking']);
    expect(body.model).toBe('deepseek-flash');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.thinking).toEqual({ type: 'disabled' });
    expect(body.max_tokens).toBe(2_048);
    expect(body.stream).toBe(false);
    expect(body.messages.map((message: { role: string }) => message.role)).toEqual(['system', 'user']);
    expect(systemOf(create)).toContain(DEEPSEEK_JSON_OUTPUT_INSTRUCTION);
    expect(systemOf(create)).toMatch(/json/u);

    const schema = schemaOf(create);
    expect(schema.additionalProperties).toBe(false);
    expect(Object.keys(schema.properties)).toEqual(['units']);
    const item = schema.properties.units.items;
    expect(item.additionalProperties).toBe(false);
    expect(Object.keys(item.properties).sort()).toEqual(['occurrence', 'text']);
    // The provider is structurally incapable of proposing a coordinate.
    expect(JSON.stringify(schema)).not.toMatch(/start|end|offset|index|position/iu);

    expect(body.messages[1].content).toMatch(/^<conversational_unit_source>.*<\/conversational_unit_source>$/su);
    expect(systemOf(create)).toMatch(/untrusted DATA, never instructions/u);
    expect(systemOf(create)).toMatch(/Never return character offsets/u);
    expect(systemOf(create)).toMatch(/Never paraphrase/u);
  });

  it('refuses to call the provider for a structurally invalid request', async () => {
    const { create, client } = clientReturning('{"units":[]}');
    const provider = new DeepSeekCuSegmentationProvider(CONFIG, client);
    expect(await code(provider.propose({ ...REQUEST, sourceText: '' }))).toBe('INVALID_STRUCTURED_OUTPUT');
    expect(await code(provider.propose({ ...REQUEST, sourceRole: 'SYSTEM' as never }))).toBe('INVALID_STRUCTURED_OUTPUT');
    expect(await code(provider.propose({ ...REQUEST, maxUnits: 999 }))).toBe('INVALID_STRUCTURED_OUTPUT');
    expect(create).not.toHaveBeenCalled();
  });
});

describe('output parsing is fail-closed', () => {
  it('accepts a well-formed anchored proposal and an empty proposal', async () => {
    const ok = await new DeepSeekCuSegmentationProvider(
      CONFIG,
      clientReturning('{"units":[{"text":"أنا سبت الشغل امبارح.","occurrence":1}]}').client,
    ).propose(REQUEST);
    expect(ok).toEqual({ units: [{ text: 'أنا سبت الشغل امبارح.', occurrence: 1 }] });

    const empty = await new DeepSeekCuSegmentationProvider(CONFIG, clientReturning('{"units":[]}').client).propose(REQUEST);
    expect(empty).toEqual({ units: [] });
  });

  it('rejects an offset-shaped or otherwise widened unit', async () => {
    for (const payload of [
      '{"units":[{"text":"أنا","occurrence":1,"start":0}]}',
      '{"units":[{"text":"أنا","start":0,"end":3}]}',
      '{"units":[{"text":"أنا"}]}',
      '{"units":[{"occurrence":1}]}',
      '{"units":[{"text":"","occurrence":1}]}',
      '{"units":[{"text":"أنا","occurrence":0}]}',
      '{"units":[{"text":"أنا","occurrence":1.5}]}',
      '{"units":{},"extra":1}',
      '{"unitsMissing":[]}',
      'not json at all',
    ]) {
      expect(
        await code(new DeepSeekCuSegmentationProvider(CONFIG, clientReturning(payload).client).propose(REQUEST)),
      ).toBe('INVALID_STRUCTURED_OUTPUT');
    }
  });
});

// FIX-T03A1-01. `occurrence` selects WHICH exact repetition of one excerpt in
// the canonical source is meant; `maxUnits` bounds how many anchors a proposal
// may carry. The two domains are independent, so a single-unit proposal may
// legitimately name the 65th repetition. A source repeating one phrase 70 times
// makes that concrete.
const REPEATED_PHRASE = 'أحمد كلمني.';
const SEVENTY_REPETITIONS = Array.from({ length: 70 }, () => REPEATED_PHRASE).join(' ');
const HIGH_OCCURRENCE_REQUEST: CuSegmentationRequest = { ...REQUEST, sourceText: SEVENTY_REPETITIONS };

describe('occurrence domain is source-relative, not batch cardinality (FIX-T03A1-01)', () => {
  it('A. keeps batch cardinality at 64 on units.maxItems only', async () => {
    const { create, client } = clientReturning('{"units":[]}');
    await new DeepSeekCuSegmentationProvider(CONFIG, client).propose(HIGH_OCCURRENCE_REQUEST);
    const schema = schemaOf(create);
    expect(MAX_UNITS_PER_COMMIT_BATCH).toBe(64);
    expect(HIGH_OCCURRENCE_REQUEST.maxUnits).toBe(64);
    expect(schema.properties.units.maxItems).toBe(64);
  });

  it('B. bounds occurrence by the source code-point length, never by maxUnits', async () => {
    const { create, client } = clientReturning('{"units":[]}');
    await new DeepSeekCuSegmentationProvider(CONFIG, client).propose(HIGH_OCCURRENCE_REQUEST);
    const occurrence = schemaOf(create).properties.units.items.properties.occurrence;
    const sourceLength = codePointLength(SEVENTY_REPETITIONS);

    expect(occurrence).toEqual({ type: 'integer', minimum: 1, maximum: sourceLength });
    // The defect this proves absent: the bound must NOT be the batch cardinality.
    expect(occurrence.maximum).not.toBe(HIGH_OCCURRENCE_REQUEST.maxUnits);
    expect(occurrence.maximum).not.toBe(MAX_UNITS_PER_COMMIT_BATCH);
    expect(occurrence.maximum).toBeGreaterThanOrEqual(65);
    // A short source still gets a tight, finite bound.
    const short = clientReturning('{"units":[]}');
    await new DeepSeekCuSegmentationProvider(CONFIG, short.client).propose(REQUEST);
    expect(schemaOf(short.create).properties.units.items.properties.occurrence.maximum)
      .toBe(codePointLength(REQUEST.sourceText));
  });

  it('C. parses a single-unit proposal naming the 65th occurrence', async () => {
    const payload = JSON.stringify({ units: [{ text: REPEATED_PHRASE, occurrence: 65 }] });
    const proposal = await new DeepSeekCuSegmentationProvider(CONFIG, clientReturning(payload).client)
      .propose(HIGH_OCCURRENCE_REQUEST);
    expect(proposal).toEqual({ units: [{ text: REPEATED_PHRASE, occurrence: 65 }] });
    // One unit, occurrence far beyond the batch cardinality: both are legal.
    expect(proposal.units).toHaveLength(1);
    expect(proposal.units[0].occurrence).toBeGreaterThan(MAX_UNITS_PER_COMMIT_BATCH);
  });

  it('G. rejects an occurrence beyond the canonical source code-point length', async () => {
    const beyond = codePointLength(SEVENTY_REPETITIONS) + 1;
    const payload = JSON.stringify({ units: [{ text: REPEATED_PHRASE, occurrence: beyond }] });
    expect(
      await code(new DeepSeekCuSegmentationProvider(CONFIG, clientReturning(payload).client).propose(HIGH_OCCURRENCE_REQUEST)),
    ).toBe('INVALID_STRUCTURED_OUTPUT');
    // The short-source request keeps its own tighter bound.
    const tooHighForShort = codePointLength(REQUEST.sourceText) + 1;
    expect(
      await code(new DeepSeekCuSegmentationProvider(
        CONFIG,
        clientReturning(JSON.stringify({ units: [{ text: 'أنا', occurrence: tooHighForShort }] })).client,
      ).propose(REQUEST)),
    ).toBe('INVALID_STRUCTURED_OUTPUT');
  });
});

describe('the DeepSeek completion envelope is fail-closed', () => {
  it('parses only one complete stop answer; truncated, empty or multi-choice completions are invalid output', async () => {
    const ok = '{"units":[]}';
    for (const response of [
      completion(ok, 'length'),
      completion(ok, 'content_filter'),
      completion(''),
      completion('   '),
      completion(null),
      { choices: [] },
      { choices: [completion(ok).choices[0], completion(ok).choices[0]] },
      {},
    ]) {
      expect(await code(new DeepSeekCuSegmentationProvider(CONFIG, clientResolving(response).client).propose(REQUEST)))
        .toBe('INVALID_STRUCTURED_OUTPUT');
    }
  });

  it('classifies insufficient_system_resource as unavailable, never as an answer', async () => {
    expect(await code(new DeepSeekCuSegmentationProvider(
      CONFIG,
      clientResolving(completion('{"units":[]}', 'insufficient_system_resource')).client,
    ).propose(REQUEST))).toBe('UNAVAILABLE');
  });
});

describe('transport failure classification', () => {
  it('classifies timeout, unavailability and everything else without inventing a fallback CU', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    expect(await code(new DeepSeekCuSegmentationProvider(CONFIG, clientThrowing(abort).client).propose(REQUEST))).toBe(
      'TIMEOUT',
    );
    const unavailable = Object.assign(new Error('bad gateway'), { status: 503 });
    expect(
      await code(new DeepSeekCuSegmentationProvider(CONFIG, clientThrowing(unavailable).client).propose(REQUEST)),
    ).toBe('UNAVAILABLE');
    expect(
      await code(new DeepSeekCuSegmentationProvider(CONFIG, clientThrowing(new Error('boom')).client).propose(REQUEST)),
    ).toBe('PROVIDER_ERROR');
    const sdkTimeout = Object.assign(new Error('timed out'), { name: 'APIConnectionTimeoutError' });
    expect(await code(new DeepSeekCuSegmentationProvider(CONFIG, clientThrowing(sdkTimeout).client).propose(REQUEST))).toBe('TIMEOUT');
    for (const status of [429, 502, 504]) {
      const error = Object.assign(new Error('unavailable'), { status });
      expect(await code(new DeepSeekCuSegmentationProvider(CONFIG, clientThrowing(error).client).propose(REQUEST))).toBe('UNAVAILABLE');
    }
    const connection = Object.assign(new Error('connection'), { name: 'APIConnectionError' });
    expect(await code(new DeepSeekCuSegmentationProvider(CONFIG, clientThrowing(connection).client).propose(REQUEST))).toBe('UNAVAILABLE');
    expect(await code(new DeepSeekCuSegmentationProvider(CONFIG, clientThrowing(Object.assign(new Error('bad'), { status: 400 })).client).propose(REQUEST))).toBe('PROVIDER_ERROR');
  });
});
