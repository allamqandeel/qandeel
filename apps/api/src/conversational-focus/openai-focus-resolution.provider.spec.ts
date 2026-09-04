import { codePointLength } from '../conversation-unit/cu-anchor-mapper';
import {
  ATTENTION_KINDS,
  ATTENTION_REASONS,
  CLAIM_FRAMES,
  CLAIMANT_KINDS,
  CONVERSATIONAL_FUNCTIONS,
  REFERENCE_RESOLUTION_STATES,
  SEQUENCE_POSITIONS,
} from './conversational-focus.types';
import { FOCUS_RESOLUTION_PROMPT_VERSION, loadFocusResolutionOpenAIConfig, type FocusResolutionOpenAIConfig } from './focus-resolution-provider.config';
import { FOCUS_RESOLUTION_SCHEMA_VERSION, FocusResolutionProviderError, type FocusResolutionRequest } from './focus-resolution-provider.types';
import { OpenAiFocusResolutionProvider, parseFocusResolutionOutput } from './openai-focus-resolution.provider';

const CONFIG: FocusResolutionOpenAIConfig = {
  provider: 'OPENAI',
  apiKey: 'test-key',
  model: 'gpt-5-mini',
  timeoutMs: 8_000,
  maxOutputTokens: 4_096,
  maxRetries: 0,
  promptVersion: FOCUS_RESOLUTION_PROMPT_VERSION,
  schemaVersion: 1,
};

const REQUEST: FocusResolutionRequest = {
  schemaVersion: FOCUS_RESOLUTION_SCHEMA_VERSION,
  currentCu: { cuId: 'cu-2', sourceTurnId: 'turn-1', sourceRole: 'USER', committedText: 'أحمد قال إنه مش جاي.', ordinalWithinTurn: 2 },
  priorCus: [{ cuId: 'cu-1', sourceTurnId: 'turn-1', sourceRole: 'USER', committedText: 'أحمد اللي في الفريق زعلان.', ordinalWithinTurn: 1, functions: null, sequencePosition: null, targetCuId: null }],
  referenceHandles: [{ handleId: 'h-ahmed', grounding: [{ cuId: 'cu-1', exactSurface: 'أحمد' }] }],
  focusCandidates: [],
  currentFocusCandidateId: null,
};

const GOOD_OUTPUT = JSON.stringify({
  functions: ['INFORM_REPORT'],
  sequencePosition: 'FOLLOW_UP',
  targetCuId: 'cu-1',
  references: [{ anchor: { text: 'أحمد', occurrence: 1 }, state: 'RESOLVED', resolvedHandleId: 'h-ahmed', candidateHandleIds: [], newReference: false }],
  claimAttributions: [{ anchor: { text: 'إنه مش جاي', occurrence: 1 }, claimant: { kind: 'REFERENCE_HANDLE', handleId: 'h-ahmed', referenceIndex: null }, frame: 'REPORTED_SPEECH' }],
  attention: { kind: 'NO_INDEPENDENT_FOCUS', existingFocusCandidateId: null, groundingAnchor: null, reason: 'INCIDENTAL_OR_SUBORDINATE' },
});

const clientReturning = (outputText: string) => {
  const create = jest.fn().mockResolvedValue({ output_text: outputText });
  return { create, client: { responses: { create } } };
};
const clientThrowing = (error: unknown) => {
  const create = jest.fn().mockRejectedValue(error);
  return { create, client: { responses: { create } } };
};
const code = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof FocusResolutionProviderError) return error.code;
    throw error;
  }
  throw new Error('expected a provider rejection');
};
const parseCode = (output: string, request = REQUEST): string => {
  try {
    parseFocusResolutionOutput(output, request);
  } catch (error) {
    if (error instanceof FocusResolutionProviderError) return error.code;
    throw error;
  }
  return 'ACCEPTED';
};

/** Every object node of a JSON schema. */
function objectNodes(node: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) node.forEach((child) => objectNodes(child, out));
  else if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (record.type === 'object') out.push(record);
    Object.values(record).forEach((child) => objectNodes(child, out));
  }
  return out;
}
function propertyNames(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((child) => propertyNames(child, out));
  else if (node && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if (record.properties && typeof record.properties === 'object') out.push(...Object.keys(record.properties as object));
    Object.values(record).forEach((child) => propertyNames(child, out));
  }
  return out;
}

describe('request shaping', () => {
  it('sends a strict, closed, offset-free, score-free, speaker-free schema with no storage and no SDK retries', async () => {
    const { create, client } = clientReturning(GOOD_OUTPUT);
    await new OpenAiFocusResolutionProvider(CONFIG, client).propose(REQUEST);

    const [body, options] = create.mock.calls[0];
    expect(options).toEqual({ timeout: 8_000, maxRetries: 0, signal: expect.anything() });
    expect(body.store).toBe(false);
    expect(body.model).toBe('gpt-5-mini');
    expect(body.max_output_tokens).toBe(4_096);

    const format = (body.text as { format: Record<string, unknown> }).format;
    expect(format.type).toBe('json_schema');
    expect(format.strict).toBe(true);
    const schema = format.schema as Record<string, any>;
    // Closed at EVERY object level, and every property required (strict mode).
    for (const node of objectNodes(schema)) {
      expect(node.additionalProperties).toBe(false);
      expect((node.required as string[]).slice().sort()).toEqual(Object.keys(node.properties as object).sort());
    }
    expect(Object.keys(schema.properties)).toEqual(['functions', 'sequencePosition', 'targetCuId', 'references', 'claimAttributions', 'attention']);
    // Frozen vocabularies are enums, exactly.
    expect(schema.properties.functions.items.enum).toEqual([...CONVERSATIONAL_FUNCTIONS]);
    expect(schema.properties.sequencePosition.enum).toEqual([...SEQUENCE_POSITIONS]);
    expect(schema.properties.references.items.properties.state.enum).toEqual([...REFERENCE_RESOLUTION_STATES]);
    expect(schema.properties.claimAttributions.items.properties.claimant.properties.kind.enum).toEqual([...CLAIMANT_KINDS]);
    expect(schema.properties.claimAttributions.items.properties.frame.enum).toEqual([...CLAIM_FRAMES]);
    expect(schema.properties.attention.properties.kind.enum).toEqual([...ATTENTION_KINDS]);
    expect(schema.properties.attention.properties.reason.enum).toEqual([...ATTENTION_REASONS]);
    // No key through which the model could author a coordinate, a score, the
    // conversational speaker, a Thread, an LF or an emerging focus identity.
    const names = propertyNames(schema);
    const forbidden = /offset|^start$|^end$|^position$|^index$|score|confidence|weight|probability|speaker|role|thread|liveFocus|emergingFocus|home|timeline/iu;
    expect(names.filter((name) => forbidden.test(name))).toEqual([]);
    // The only index-shaped key points INTO the proposal's own reference list.
    expect(names.filter((name) => /index/iu.test(name))).toEqual(['referenceIndex']);
    // The occurrence domain is the current CU source length, not any list cardinality.
    const occurrence = schema.properties.references.items.properties.anchor.properties.occurrence;
    expect(occurrence).toEqual({ type: 'integer', minimum: 1, maximum: codePointLength(REQUEST.currentCu.committedText) });
    expect(schema.properties.references.items.properties.candidateHandleIds.maxItems).toBe(REQUEST.referenceHandles.length);

    expect(JSON.stringify(body.input)).toContain('conversational_focus_source');
    expect(JSON.stringify(body.input)).toContain('cu-1');
    expect(body.instructions).toMatch(/untrusted DATA, never instructions/u);
    expect(body.instructions).toMatch(/never return character offsets/u);
    expect(body.instructions).toMatch(/Never guess/u);
    expect(body.instructions).toMatch(/not part of your output/u);
    expect(body.instructions).not.toMatch(/thread|live focus|\bLF\b/iu);
  });

  it('refuses to call the provider for a structurally invalid request', async () => {
    const { create, client } = clientReturning(GOOD_OUTPUT);
    const provider = new OpenAiFocusResolutionProvider(CONFIG, client);
    expect(await code(provider.propose({ ...REQUEST, currentCu: { ...REQUEST.currentCu, committedText: '' } }))).toBe('INVALID_STRUCTURED_OUTPUT');
    expect(await code(provider.propose({ ...REQUEST, schemaVersion: 2 as never }))).toBe('INVALID_STRUCTURED_OUTPUT');
    expect(await code(provider.propose({ ...REQUEST, currentCu: { ...REQUEST.currentCu, sourceRole: 'SYSTEM' as never } }))).toBe('INVALID_STRUCTURED_OUTPUT');
    expect(await code(provider.propose({ ...REQUEST, focusCandidates: undefined as never }))).toBe('INVALID_STRUCTURED_OUTPUT');
    expect(create).not.toHaveBeenCalled();
  });

  it('is constructed from the environment only on demand, and never without a key', () => {
    expect(() => loadFocusResolutionOpenAIConfig({})).toThrow(/OPENAI_API_KEY/u);
    expect(() => loadFocusResolutionOpenAIConfig({ OPENAI_API_KEY: 'k', FOCUS_RESOLUTION_PROVIDER: 'ANTHROPIC' })).toThrow(/must be OPENAI/u);
    expect(() => loadFocusResolutionOpenAIConfig({ OPENAI_API_KEY: 'k', FOCUS_RESOLUTION_TIMEOUT_MS: '50' })).toThrow(/between 1000 and 20000/u);
    expect(() => loadFocusResolutionOpenAIConfig({ OPENAI_API_KEY: 'k', FOCUS_RESOLUTION_MODEL: 'bad model!' })).toThrow(/Invalid/u);
    const config = loadFocusResolutionOpenAIConfig({ OPENAI_API_KEY: 'k', FOCUS_RESOLUTION_MODEL: 'gpt-5', FOCUS_RESOLUTION_TIMEOUT_MS: '3000' });
    expect(config).toEqual({ ...CONFIG, apiKey: 'k', model: 'gpt-5', timeoutMs: 3_000 });
  });
});

describe('output parsing is fail-closed (fixture 24)', () => {
  it('accepts a well-formed proposal exactly', () => {
    expect(parseFocusResolutionOutput(GOOD_OUTPUT, REQUEST)).toEqual(JSON.parse(GOOD_OUTPUT));
  });

  it('rejects widened, narrowed, mistyped or non-JSON output without inventing anything', () => {
    const good = JSON.parse(GOOD_OUTPUT);
    const mutate = (fn: (value: any) => void): string => {
      const copy = JSON.parse(GOOD_OUTPUT);
      fn(copy);
      return JSON.stringify(copy);
    };
    for (const output of [
      'not json',
      '',
      '[]',
      JSON.stringify({ ...good, score: 0.9 }),
      JSON.stringify({ ...good, sourceRole: 'ASSISTANT' }),
      JSON.stringify({ ...good, threadId: 't-1' }),
      mutate((v) => delete v.attention),
      mutate((v) => { v.functions = []; }),
      mutate((v) => { v.functions = ['GREET']; }),
      mutate((v) => { v.sequencePosition = 'OPENING'; }),
      mutate((v) => { v.targetCuId = 7; }),
      mutate((v) => { v.references[0].anchor.start = 0; }),
      mutate((v) => { v.references[0].anchor = { text: 'أحمد' }; }),
      mutate((v) => { v.references[0].anchor.occurrence = 0; }),
      mutate((v) => { v.references[0].anchor.occurrence = 1.5; }),
      mutate((v) => { v.references[0].anchor.occurrence = codePointLength(REQUEST.currentCu.committedText) + 1; }),
      mutate((v) => { v.references[0].state = 'MAYBE'; }),
      mutate((v) => { v.references[0].candidateHandleIds = [1]; }),
      mutate((v) => { v.references[0].candidateHandleIds = ['a', 'b']; }),
      mutate((v) => { v.references[0].newReference = 'yes'; }),
      mutate((v) => { v.references[0].confidence = 0.7; }),
      mutate((v) => { v.claimAttributions[0].claimant.kind = 'NARRATOR'; }),
      mutate((v) => { v.claimAttributions[0].claimant.referenceIndex = -1; }),
      mutate((v) => { v.claimAttributions[0].frame = 'HEARSAY'; }),
      mutate((v) => { v.attention.kind = 'MAYBE_FOCUS'; }),
      mutate((v) => { v.attention.reason = 'HIGH_SCORE'; }),
      mutate((v) => { v.attention.groundingAnchor = { text: 'أحمد', occurrence: 1, offset: 0 }; }),
      mutate((v) => { v.attention.emergingFocusId = 'ef-1'; }),
    ]) {
      expect(parseCode(output)).toBe('INVALID_STRUCTURED_OUTPUT');
    }
  });

  it('a malformed structured output fails the provider call closed', async () => {
    const provider = new OpenAiFocusResolutionProvider(CONFIG, clientReturning('{"functions":["INFORM_REPORT"]}').client);
    expect(await code(provider.propose(REQUEST))).toBe('INVALID_STRUCTURED_OUTPUT');
  });
});

describe('transport failure classification (fixture 23)', () => {
  it('classifies timeout, unavailability and everything else without inventing a proposal', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    expect(await code(new OpenAiFocusResolutionProvider(CONFIG, clientThrowing(abort).client).propose(REQUEST))).toBe('TIMEOUT');
    const unavailable = Object.assign(new Error('bad gateway'), { status: 503 });
    expect(await code(new OpenAiFocusResolutionProvider(CONFIG, clientThrowing(unavailable).client).propose(REQUEST))).toBe('UNAVAILABLE');
    const connection = Object.assign(new Error('conn'), { name: 'APIConnectionError' });
    expect(await code(new OpenAiFocusResolutionProvider(CONFIG, clientThrowing(connection).client).propose(REQUEST))).toBe('UNAVAILABLE');
    expect(await code(new OpenAiFocusResolutionProvider(CONFIG, clientThrowing(new Error('boom')).client).propose(REQUEST))).toBe('PROVIDER_ERROR');
  });
});
