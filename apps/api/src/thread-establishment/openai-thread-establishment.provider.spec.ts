import { codePointLength } from '../conversation-unit/cu-anchor-mapper';
import { OpenAiThreadEstablishmentProvider, parseThreadEstablishmentOutput } from './openai-thread-establishment.provider';
import { loadThreadEstablishmentOpenAIConfig, THREAD_ESTABLISHMENT_PROMPT_VERSION, type ThreadEstablishmentOpenAIConfig } from './thread-establishment-provider.config';
import { THREAD_ESTABLISHMENT_SCHEMA_VERSION, ThreadEstablishmentProviderError, type ThreadEstablishmentRequest } from './thread-establishment-provider.types';
import { THREAD_ESTABLISHMENT_DECISIONS, THREAD_ESTABLISHMENT_PATHS } from './thread-establishment.types';

const F_AHMED = '3f2a9c1e-7b4d-5a6e-8c9f-0a1b2c3d4e5f';

const CONFIG: ThreadEstablishmentOpenAIConfig = {
  provider: 'OPENAI',
  apiKey: 'test-key',
  model: 'gpt-5-mini',
  timeoutMs: 8_000,
  maxOutputTokens: 1_024,
  maxRetries: 0,
  promptVersion: THREAD_ESTABLISHMENT_PROMPT_VERSION,
  schemaVersion: 1,
};

const REQUEST: ThreadEstablishmentRequest = {
  schemaVersion: THREAD_ESTABLISHMENT_SCHEMA_VERSION,
  currentCu: { cuId: 'cu-2', sourceTurnId: 'turn-1', sourceRole: 'USER', committedText: 'عايز نتكلم عن أحمد تحديدًا.', ordinalWithinTurn: 2 },
  currentFocusSemantics: {
    unit_id: 'cu-2',
    functions: ['REQUEST', 'FOCUS_SHIFT'],
    sequence_position: 'FOLLOW_UP',
    target_cu_id: 'cu-1',
    references: [],
    claim_attributions: [],
    attention: { kind: 'START_NEW_FOCUS', reason: 'EXPLICIT_FOCUS_SHIFT', emerging_focus_id: F_AHMED, creates_focus: true, grounding_reference_index: 0 },
  },
  priorCus: [{ cuId: 'cu-1', sourceTurnId: 'turn-1', sourceRole: 'USER', committedText: 'أحمد اللي في الفريق زعلان.', ordinalWithinTurn: 1, functions: null, sequencePosition: null, targetCuId: null }],
  focusAttentionHistory: [{ cuId: 'cu-1', attentionKind: 'NO_INDEPENDENT_FOCUS', attentionReason: 'INCIDENTAL_OR_SUBORDINATE', emergingFocusId: null }],
};

const GOOD_OUTPUT = JSON.stringify({
  decision: 'ESTABLISH_THREAD',
  path: 'TE-01',
  evidenceCuIds: ['cu-2'],
  explicitSelectionAnchor: { text: 'عايز نتكلم عن أحمد تحديدًا', occurrence: 1 },
});
const NO_OUTPUT = JSON.stringify({ decision: 'NO_ESTABLISHMENT', path: null, evidenceCuIds: [], explicitSelectionAnchor: null });

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
    if (error instanceof ThreadEstablishmentProviderError) return error.code;
    throw error;
  }
  throw new Error('expected a provider rejection');
};
const parseCode = (output: string, request = REQUEST): string => {
  try {
    parseThreadEstablishmentOutput(output, request);
  } catch (error) {
    if (error instanceof ThreadEstablishmentProviderError) return error.code;
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
  it('sends a strict, closed schema with exactly four keys and no channel for a score, Thread id, Home, LF or offset (fixtures 22/24/46)', async () => {
    const { create, client } = clientReturning(GOOD_OUTPUT);
    await new OpenAiThreadEstablishmentProvider(CONFIG, client).propose(REQUEST);

    const [body, options] = create.mock.calls[0];
    expect(options).toEqual({ timeout: 8_000, maxRetries: 0, signal: expect.anything() });
    expect(body.store).toBe(false);
    expect(body.model).toBe('gpt-5-mini');
    expect(body.max_output_tokens).toBe(1_024);

    const format = (body.text as { format: Record<string, unknown> }).format;
    expect(format.type).toBe('json_schema');
    expect(format.name).toBe('thread_establishment_evidence_path_v1');
    expect(format.strict).toBe(true);
    const schema = format.schema as Record<string, any>;
    // Closed at EVERY object level, and every property required (strict mode).
    for (const node of objectNodes(schema)) {
      expect(node.additionalProperties).toBe(false);
      expect((node.required as string[]).slice().sort()).toEqual(Object.keys(node.properties as object).sort());
    }
    expect(Object.keys(schema.properties)).toEqual(['decision', 'path', 'evidenceCuIds', 'explicitSelectionAnchor']);
    expect(schema.properties.decision.enum).toEqual([...THREAD_ESTABLISHMENT_DECISIONS]);
    expect(schema.properties.path.anyOf[0].enum).toEqual([...THREAD_ESTABLISHMENT_PATHS]);
    expect(schema.properties.path.anyOf[1]).toEqual({ type: 'null' });
    expect(schema.properties.evidenceCuIds).toEqual({ type: 'array', maxItems: REQUEST.priorCus.length + 1, items: { type: 'string' } });
    // Property names: exactly the four keys plus the anchor's two.
    expect(propertyNames(schema).sort()).toEqual(['decision', 'evidenceCuIds', 'explicitSelectionAnchor', 'occurrence', 'path', 'text']);
    const forbidden = /offset|^start$|^end$|position|index|score|confidence|weight|probability|rank|importance|similarity|embedding|thread|home|spatial|^x$|^y$|angle|distance|region|territory|placement|parent|origin|neighbo|lf|liveFocus|reading|rationale|reason|explanation|timestamp|sp$/iu;
    expect(propertyNames(schema).filter((name) => forbidden.test(name))).toEqual([]);
    // The occurrence domain is the current CU source length, not any list cardinality.
    expect(schema.properties.explicitSelectionAnchor.anyOf[0].properties.occurrence).toEqual({ type: 'integer', minimum: 1, maximum: codePointLength(REQUEST.currentCu.committedText) });

    expect(JSON.stringify(body.input)).toContain('thread_establishment_source');
    expect(JSON.stringify(body.input)).toContain('cu-1');
    expect(JSON.stringify(body.input)).not.toContain('establishedFocusIds');
    expect(body.instructions).toMatch(/untrusted DATA, never instructions/u);
    expect(body.instructions).toMatch(/never return character offsets/u);
    expect(body.instructions).toMatch(/Never guess/u);
    expect(body.instructions).toMatch(/TE-01[\s\S]*TE-02[\s\S]*TE-03/u);
    expect(body.instructions).toMatch(/never propose TE-01 for an ASSISTANT unit/u);
    expect(body.instructions).toMatch(/at least one USER unit/u);
    expect(body.instructions).not.toMatch(/live focus|\bLF\b|home anchor|spatial|timeline|reading count/iu);
  });

  it('refuses to call the provider for a structurally invalid request', async () => {
    const { create, client } = clientReturning(GOOD_OUTPUT);
    const provider = new OpenAiThreadEstablishmentProvider(CONFIG, client);
    expect(await code(provider.propose({ ...REQUEST, currentCu: { ...REQUEST.currentCu, committedText: '' } }))).toBe('INVALID_STRUCTURED_OUTPUT');
    expect(await code(provider.propose({ ...REQUEST, schemaVersion: 2 as never }))).toBe('INVALID_STRUCTURED_OUTPUT');
    expect(await code(provider.propose({ ...REQUEST, currentCu: { ...REQUEST.currentCu, sourceRole: 'SYSTEM' as never } }))).toBe('INVALID_STRUCTURED_OUTPUT');
    expect(await code(provider.propose({ ...REQUEST, currentFocusSemantics: { ...REQUEST.currentFocusSemantics, unit_id: 'cu-9' } }))).toBe('INVALID_STRUCTURED_OUTPUT');
    expect(await code(provider.propose({ ...REQUEST, focusAttentionHistory: undefined as never }))).toBe('INVALID_STRUCTURED_OUTPUT');
    expect(create).not.toHaveBeenCalled();
  });

  it('is constructed from the environment only on demand, and never without a key', () => {
    expect(() => loadThreadEstablishmentOpenAIConfig({})).toThrow(/OPENAI_API_KEY/u);
    expect(() => loadThreadEstablishmentOpenAIConfig({ OPENAI_API_KEY: 'k', THREAD_ESTABLISHMENT_PROVIDER: 'ANTHROPIC' })).toThrow(/must be OPENAI/u);
    expect(() => loadThreadEstablishmentOpenAIConfig({ OPENAI_API_KEY: 'k', THREAD_ESTABLISHMENT_TIMEOUT_MS: '50' })).toThrow(/between 1000 and 20000/u);
    expect(() => loadThreadEstablishmentOpenAIConfig({ OPENAI_API_KEY: 'k', THREAD_ESTABLISHMENT_MODEL: 'bad model!' })).toThrow(/Invalid/u);
    const config = loadThreadEstablishmentOpenAIConfig({ OPENAI_API_KEY: 'k', THREAD_ESTABLISHMENT_MODEL: 'gpt-5', THREAD_ESTABLISHMENT_TIMEOUT_MS: '3000' });
    expect(config).toEqual({ ...CONFIG, apiKey: 'k', model: 'gpt-5', timeoutMs: 3_000 });
    expect(loadThreadEstablishmentOpenAIConfig({ OPENAI_API_KEY: 'k' }).model).toBe('gpt-5-mini');
  });
});

describe('output parsing is fail-closed (fixtures 40/41/46)', () => {
  it('accepts well-formed proposals exactly', () => {
    expect(parseThreadEstablishmentOutput(GOOD_OUTPUT, REQUEST)).toEqual(JSON.parse(GOOD_OUTPUT));
    expect(parseThreadEstablishmentOutput(NO_OUTPUT, REQUEST)).toEqual(JSON.parse(NO_OUTPUT));
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
      JSON.stringify({ ...good, confidence: 0.9 }),
      JSON.stringify({ ...good, rationale: 'because' }),
      JSON.stringify({ ...good, threadId: 't-1' }),
      JSON.stringify({ ...good, homeAnchorId: 'h-1' }),
      JSON.stringify({ ...good, canonicalSpatialAddress: { x: 1, y: 2 } }),
      JSON.stringify({ ...good, liveFocus: F_AHMED }),
      JSON.stringify({ ...good, similarity: 0.8 }),
      mutate((v) => delete v.path),
      mutate((v) => { v.decision = 'MAYBE'; }),
      mutate((v) => { v.path = 'TE-04'; }),
      mutate((v) => { v.path = 1; }),
      mutate((v) => { v.evidenceCuIds = 'cu-2'; }),
      mutate((v) => { v.evidenceCuIds = [2]; }),
      mutate((v) => { v.evidenceCuIds = ['']; }),
      mutate((v) => { v.evidenceCuIds = ['cu-1', 'cu-2', 'cu-3']; }),
      mutate((v) => { v.explicitSelectionAnchor = { text: 'أحمد' }; }),
      mutate((v) => { v.explicitSelectionAnchor.start = 0; }),
      mutate((v) => { v.explicitSelectionAnchor.occurrence = 0; }),
      mutate((v) => { v.explicitSelectionAnchor.occurrence = 1.5; }),
      mutate((v) => { v.explicitSelectionAnchor.occurrence = codePointLength(REQUEST.currentCu.committedText) + 1; }),
      mutate((v) => { v.explicitSelectionAnchor.text = ''; }),
    ]) {
      expect(parseCode(output)).toBe('INVALID_STRUCTURED_OUTPUT');
    }
  });

  it('a malformed structured output fails the provider call closed', async () => {
    const provider = new OpenAiThreadEstablishmentProvider(CONFIG, clientReturning('{"decision":"ESTABLISH_THREAD"}').client);
    expect(await code(provider.propose(REQUEST))).toBe('INVALID_STRUCTURED_OUTPUT');
  });
});

describe('transport failure classification (fixture 45)', () => {
  it('classifies timeout, unavailability and everything else without inventing a proposal', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    expect(await code(new OpenAiThreadEstablishmentProvider(CONFIG, clientThrowing(abort).client).propose(REQUEST))).toBe('TIMEOUT');
    const unavailable = Object.assign(new Error('bad gateway'), { status: 503 });
    expect(await code(new OpenAiThreadEstablishmentProvider(CONFIG, clientThrowing(unavailable).client).propose(REQUEST))).toBe('UNAVAILABLE');
    const connection = Object.assign(new Error('conn'), { name: 'APIConnectionError' });
    expect(await code(new OpenAiThreadEstablishmentProvider(CONFIG, clientThrowing(connection).client).propose(REQUEST))).toBe('UNAVAILABLE');
    expect(await code(new OpenAiThreadEstablishmentProvider(CONFIG, clientThrowing(new Error('boom')).client).propose(REQUEST))).toBe('PROVIDER_ERROR');
  });
});
