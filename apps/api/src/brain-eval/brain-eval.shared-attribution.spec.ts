import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decideFastDeepRoute } from '../intelligence-runtime/fast-deep-runtime-decision-policy-v2';
import { HISTORY_BUDGET_BYTES } from '../intelligence-runtime/integrated-context-budget-contract';
import { resolveDeepSeekModel } from '../model-router/model-profile.registry';
import type { ModelRouterContextMessage, ModelRouterRequest } from '../model-router/model-router.types';
import { DeepSeekModelRouter } from '../model-router/providers/deepseek/deepseek-model-router';
import { DEEPSEEK_MAX_OUTPUT_TOKENS, type DeepSeekModelRouterConfig } from '../model-router/providers/deepseek/deepseek-model-router.config';
import {
  UNNAMED_PARTICIPANT, assembleSharedConversationRequest, boundedSharedContext, mergeConsecutiveSameRole, separatedSharedContext,
  type SharedConversationTurn,
} from '../shared-world/shared-conversation-model-input';
import {
  assertGuidanceMatchesLabel, currentMessageOf, deepSeekEvaluationRequest, inconclusiveCaseIds, plannedAttempts, runDeepSeekEvaluation,
} from './brain-eval.deepseek';
import {
  QUOTED_SPEAKER_CASE_ID, QUOTED_SPEAKER_CONVERSATION, QUOTED_SPEAKER_COUNTERFACTUAL, SHARED_ATTRIBUTION_PROBE_SUITE, SHARED_ATTRIBUTION_SUITE,
  SHARED_IDENTITY_HAZARDS,
} from './brain-eval.shared-attribution.suite';
import { DEEPSEEK_EVALUATION_SUITES, resolveDeepSeekEvaluationSuite } from './brain-eval.suites';
import type { BrainEvaluationCase } from './brain-eval.types';
import { validateGoldenFocusedSuite, validateGoldenPathPairSuite } from './brain-eval.validation';

// S8A-02 — Shared attribution, free verification (Product Owner Shared Attribution Engineering Decision D1 / D3, 2026-10-21).
// No provider is reached: the DeepSeek adapter below is given a recording client, so the request body it WOULD send is
// captured without a network. Nothing here authorizes a paid run.

/** The production function before the S8A-02 split, verbatim (commit d7885652), as the reference production must still match. */
function boundedSharedContextBeforeSplit(conversation: ReadonlyArray<SharedConversationTurn>): ModelRouterContextMessage[] {
  const bytes = (text: string) => Buffer.byteLength(text, 'utf8');
  const render = (turn: SharedConversationTurn): ModelRouterContextMessage => turn.producer === 'QANDEEL'
    ? { role: 'ASSISTANT', content: turn.text }
    : { role: 'USER', content: `${turn.authorName ?? UNNAMED_PARTICIPANT}: ${turn.text}` };
  const current = conversation.at(-1);
  if (current === undefined || current.producer !== 'HUMAN') return [];
  const kept: SharedConversationTurn[] = [current];
  let used = 0;
  for (let index = conversation.length - 2; index >= 0; index -= 1) {
    const size = bytes(render(conversation[index]).content);
    if (used + size > HISTORY_BUDGET_BYTES) break;
    used += size;
    kept.unshift(conversation[index]);
  }
  const merged: ModelRouterContextMessage[] = [];
  for (const message of kept.map(render)) {
    const last = merged.at(-1);
    if (last !== undefined && last.role === message.role) merged[merged.length - 1] = { role: last.role, content: `${last.content}\n\n${message.content}` };
    else merged.push(message);
  }
  while (merged.length > 0 && merged[0].role === 'ASSISTANT') merged.shift();
  return merged;
}

const human = (authorName: string | null, text: string): SharedConversationTurn => ({ producer: 'HUMAN', authorName, text });
const qandeel = (text: string): SharedConversationTurn => ({ producer: 'QANDEEL', authorName: null, text });

// Edge inputs beside the suites: leading and consecutive QANDEEL turns, missing Names, a history over the budget, a QANDEEL
// turn last (nothing to answer), and an empty conversation.
const EDGE_CONVERSATIONS: ReadonlyArray<ReadonlyArray<SharedConversationTurn>> = [
  [qandeel('Welcome.'), qandeel('Again.'), human('Bassem', 'Hello'), human(null, 'and me'), qandeel('Hi both.'), qandeel('Still here.'), human('Amal', 'كيف حالك؟')],
  [human(null, 'one'), human(null, 'two'), human('سارة', 'three')],
  [...Array.from({ length: 40 }, (_, index) => human(index % 3 === 0 ? 'منى' : index % 3 === 1 ? 'رامي' : null, `${index}: ${'كلام طويل جدًا '.repeat(40)}`)), human('ليلى', 'آخر رسالة')],
  [human('سارة', 'hi'), qandeel('hello')],
  [],
];

const sharedCases = (): BrainEvaluationCase[] => {
  const seen = new Map<string, BrainEvaluationCase>();
  for (const suite of Object.values(DEEPSEEK_EVALUATION_SUITES)) for (const testCase of suite.cases) if (testCase.world?.kind === 'SHARED') seen.set(testCase.id, testCase);
  return [...seen.values()];
};
const conversationOf = (testCase: BrainEvaluationCase): ReadonlyArray<SharedConversationTurn> => {
  if (testCase.world?.kind !== 'SHARED') throw new Error(`${testCase.id} is not Shared.`);
  return testCase.world.conversation;
};
const ALL_CONVERSATIONS = [
  ...sharedCases().map(conversationOf), ...EDGE_CONVERSATIONS,
  ...SHARED_IDENTITY_HAZARDS.flatMap((hazard) => [hazard.first, hazard.second]),
];

const config: DeepSeekModelRouterConfig = { apiKey: 'test-only', resolveModel: resolveDeepSeekModel, maxOutputTokens: DEEPSEEK_MAX_OUTPUT_TOKENS, timeoutMs: 20_000, maxRetries: 0 };
/** The exact body the production DeepSeek adapter would send for this request, captured by a recording client. */
async function deepSeekBody(request: ModelRouterRequest): Promise<{ model: string; messages: Array<{ role: string; content: string }>; [key: string]: unknown }> {
  const create = jest.fn().mockResolvedValue({ choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'تمام.' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
  await new DeepSeekModelRouter(config, { chat: { completions: { create } } }).generate(request);
  expect(create).toHaveBeenCalledTimes(1);
  return create.mock.calls[0][0];
}
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;

describe('S8A-02 Shared attribution — the separated candidate (a-1) against production (zero calls)', () => {
  // RE-ANCHORED by S8A-02 CP1 (2026-10-22; Trusted Speaker & Message Provenance): production now sends the separated
  // context. The merged arm keeps the exact pre-split bytes, so every earlier merged run stays reproducible.
  it('keeps the merged arm byte-identical to the pre-split function, and production sends the separated context', () => {
    expect(ALL_CONVERSATIONS.length).toBeGreaterThan(25);
    for (const conversation of ALL_CONVERSATIONS) expect(boundedSharedContext(conversation)).toEqual(boundedSharedContextBeforeSplit(conversation));
    for (const conversation of ALL_CONVERSATIONS) {
      const request = assembleSharedConversationRequest(conversation);
      if (request !== null) expect(request.context).toEqual(separatedSharedContext(conversation));
    }
  });

  it('differs from production only in message boundaries: merging the separated context gives production\'s context', () => {
    for (const conversation of ALL_CONVERSATIONS) {
      expect(mergeConsecutiveSameRole(separatedSharedContext(conversation))).toEqual(boundedSharedContext(conversation));
    }
  });

  it('keeps every kept turn in order, one message each, with the same visible Name prefix and no identifier', () => {
    for (const conversation of ALL_CONVERSATIONS) {
      const separated = separatedSharedContext(conversation);
      if (separated.length === 0) continue;
      // The kept turns are a suffix of the conversation (the history budget drops the oldest), minus leading QANDEEL turns.
      const rendered = conversation.map((turn) => turn.producer === 'QANDEEL'
        ? { role: 'ASSISTANT', content: turn.text }
        : { role: 'USER', content: `${turn.authorName ?? UNNAMED_PARTICIPANT}: ${turn.text}` });
      const start = rendered.length - separated.length;
      expect(rendered.slice(start)).toEqual(separated);
      expect(separated[0].role).toBe('USER');
      expect(separated.at(-1)).toEqual(rendered.at(-1));
      expect(JSON.stringify(separated)).not.toMatch(UUID);
    }
  });

  it('keeps the frozen history budget: the same turns are kept in both representations, and one over-budget conversation is trimmed', () => {
    const long = EDGE_CONVERSATIONS[2];
    const separated = separatedSharedContext(long);
    expect(separated.length).toBeLessThan(long.length);
    const historyBytes = separated.slice(0, -1).reduce((sum, message) => sum + Buffer.byteLength(message.content, 'utf8'), 0);
    expect(historyBytes).toBeLessThanOrEqual(HISTORY_BUDGET_BYTES);
    for (const conversation of ALL_CONVERSATIONS) {
      const joined = (messages: ReadonlyArray<ModelRouterContextMessage>) => messages.map((message) => message.content).join('\n\n');
      expect(joined(separatedSharedContext(conversation))).toBe(joined(boundedSharedContext(conversation)));
    }
  });

  it('sends DeepSeek the same body in both arms except where a provider message ends (captured from the real adapter)', async () => {
    for (const testCase of sharedCases()) {
      const merged = await deepSeekBody(deepSeekEvaluationRequest(testCase, 'shared-merged'));
      const separated = await deepSeekBody(deepSeekEvaluationRequest(testCase, 'shared-separated'));
      const { messages: mergedMessages, ...mergedRest } = merged;
      const { messages: separatedMessages, ...separatedRest } = separated;
      expect(separatedRest).toEqual(mergedRest);
      expect(separatedMessages[0]).toEqual(mergedMessages[0]);
      expect(separatedMessages[0].role).toBe('system');
      const asContext = (messages: ReadonlyArray<{ role: string; content: string }>) => messages.slice(1)
        .map((message) => ({ role: message.role === 'user' ? 'USER' : 'ASSISTANT', content: message.content }) as ModelRouterContextMessage);
      expect(mergeConsecutiveSameRole(asContext(separatedMessages))).toEqual(asContext(mergedMessages));
      expect(separatedMessages.every((message) => Object.keys(message).sort().join() === 'content,role')).toBe(true);
      expect(JSON.stringify(separated)).not.toMatch(UUID);
      // RE-ANCHORED by S8A-02 CP1 (2026-10-22): the separated arm is exactly what production sends for this conversation, and
      // the merged arm is still the pre-split context.
      expect(deepSeekEvaluationRequest(testCase, 'shared-separated')).toEqual(deepSeekEvaluationRequest(testCase));
      expect(deepSeekEvaluationRequest(testCase, 'shared-merged').context).toEqual(boundedSharedContextBeforeSplit(conversationOf(testCase)));
    }
  });

  it('refuses a representation label on a case that is not Shared, and pins both labels to the core v3.1 guidance', () => {
    const personal = resolveDeepSeekEvaluationSuite('golden-round3-personality').cases[0];
    expect(() => assertGuidanceMatchesLabel([personal], 'shared-separated')).toThrow('not a Shared case');
    expect(() => assertGuidanceMatchesLabel(SHARED_ATTRIBUTION_SUITE, 'shared-merged')).not.toThrow();
    expect(() => assertGuidanceMatchesLabel(SHARED_ATTRIBUTION_SUITE, 'shared-separated')).not.toThrow();
    expect(() => assertGuidanceMatchesLabel(SHARED_ATTRIBUTION_SUITE, 'core-v3')).toThrow('NOT RUN');
  });
});

describe('S8A-02 Shared attribution — the probe and the attribution suites (zero calls)', () => {
  it('the probe is one conversation on FAST and on DEEP, separated only, two attempts in round 4', () => {
    const probe = resolveDeepSeekEvaluationSuite('shared-attribution-probe');
    expect(probe).toMatchObject({ round: 4, repeats: 1, labels: ['shared-separated'], comparison: 'PATHS' });
    expect(validateGoldenPathPairSuite(SHARED_ATTRIBUTION_PROBE_SUITE)).toMatchObject({ caseCount: 2, fastCount: 1, deepCount: 1 });
    expect(plannedAttempts(probe.cases, probe.repeats)).toBe(2);
    for (const testCase of SHARED_ATTRIBUTION_PROBE_SUITE) {
      const pairs = deepSeekEvaluationRequest(testCase, 'shared-separated').context.filter((message, index, all) => index > 0 && all[index - 1].role === message.role).length;
      expect(pairs).toBe(4);
    }
  });

  it('Part T holds ten conversations of 3-4 people, all routed FAST by production, nine of them one merged message', () => {
    expect(validateGoldenFocusedSuite(SHARED_ATTRIBUTION_SUITE)).toMatchObject({ caseCount: 10, fastCount: 10, deepCount: 0 });
    let singleMerged = 0;
    for (const testCase of SHARED_ATTRIBUTION_SUITE) {
      const people = new Set(conversationOf(testCase).filter((turn) => turn.producer === 'HUMAN').map((turn) => turn.authorName));
      expect([testCase.id, people.size >= 3 && people.size <= 4]).toEqual([testCase.id, true]);
      expect([testCase.id, decideFastDeepRoute(currentMessageOf(testCase)).path]).toEqual([testCase.id, 'FAST']);
      expect(testCase.reviewNotes.some((note) => note.startsWith('FAIL if '))).toBe(true);
      if (deepSeekEvaluationRequest(testCase, 'shared-merged').context.length === 1) singleMerged += 1;
    }
    expect(singleMerged).toBe(9);
    const full = ['shared-attribution', 'shared-attribution-language'].map((name) => resolveDeepSeekEvaluationSuite(name));
    expect(full.map((suite) => [suite.round, plannedAttempts(suite.cases, suite.repeats) * suite.labels.length])).toEqual([[5, 60], [6, 36]]);
    // Five categories, two conversations each (the quoted-speaker case is one of the two ambiguity cases).
    const categories = ['who-said-what', 'no-transfer', 'preferences-decisions|opinions', 'correction', 'ambiguous|unstated'];
    for (const category of categories) {
      expect([category, SHARED_ATTRIBUTION_SUITE.filter((testCase) => new RegExp(category, 'u').test(testCase.id)).length]).toEqual([category, 2]);
    }
  });

  it('the quoted-speaker case (D2): merged, Sara quoting Karim is byte-identical to Karim speaking; separated, the quote stays inside Sara\'s message', () => {
    const testCase = SHARED_ATTRIBUTION_SUITE.find((entry) => entry.id === QUOTED_SPEAKER_CASE_ID)!;
    expect(conversationOf(testCase)).toEqual(QUOTED_SPEAKER_CONVERSATION);
    expect(deepSeekEvaluationRequest(testCase, 'shared-merged').context).toEqual(boundedSharedContext(QUOTED_SPEAKER_COUNTERFACTUAL));
    const separated = deepSeekEvaluationRequest(testCase, 'shared-separated').context;
    expect(separated).not.toEqual(separatedSharedContext(QUOTED_SPEAKER_COUNTERFACTUAL));
    expect(separated.map((message) => message.content.split(':')[0])).toEqual(['سامي', 'كريم', 'سارة', 'منى']);
    expect(separated[1].content).toBe('كريم: تمام');
    expect(separated[2].content).toContain('\n\nكريم: أنا موافق أدفع تمن التذاكر\n\n');
  });

  it('the D3 stop rule stops a run, sending nothing more, once more than 2 of 10 conversations cannot reach 2 replies', async () => {
    const generate = jest.fn().mockRejectedValue(new Error('timeout'));
    const results = await runDeepSeekEvaluation(SHARED_ATTRIBUTION_SUITE, 'shared-separated', {
      router: { generate }, attribute: (_key, work) => work(),
      stopWhen: (sofar) => (inconclusiveCaseIds(SHARED_ATTRIBUTION_SUITE, sofar, 3, 2).length > 2 ? 'stop' : null),
    }, 3);
    // Repeat 1: ten failures, none INCONCLUSIVE yet; repeat 2: the third case's second failure makes three.
    expect(results).toHaveLength(13);
    expect(generate).toHaveBeenCalledTimes(13);
    expect(inconclusiveCaseIds(SHARED_ATTRIBUTION_SUITE, results, 3, 2)).toEqual(SHARED_ATTRIBUTION_SUITE.slice(0, 3).map((testCase) => testCase.id));
    expect(resolveDeepSeekEvaluationSuite('shared-attribution').stopWhenInconclusiveExceeds).toBe(2);
  });
});

describe('S8A-02 Shared attribution — the identity hazards (QAN-BL-AI-06 / AI-07 / AI-08; free, never sent)', () => {
  it('the read the model input comes from carries a Name and no per-author key (0139)', () => {
    const migration = readFileSync(resolve(__dirname, '../../../../database/migrations/0139_shared_world_conversation_material_v1.sql'), 'utf8');
    expect(migration).toContain('RETURNS TABLE (material_id uuid, material_kind text, producer_kind text, established_at timestamptz, is_self boolean,\n                 author_name text, text_body text, can_delete boolean)');
    expect(Object.keys(human('سارة', 'x')).sort()).toEqual(['authorName', 'producer', 'text']);
  });

  it('two people with one Name, people without a Name, and the person a QANDEEL reply answered reach the model as identical bytes, in BOTH representations', () => {
    for (const hazard of SHARED_IDENTITY_HAZARDS.filter((entry) => entry.finding !== 'quotation of another person')) {
      expect(separatedSharedContext(hazard.first)).toEqual(separatedSharedContext(hazard.second));
      expect(boundedSharedContext(hazard.first)).toEqual(boundedSharedContext(hazard.second));
    }
    const missing = SHARED_IDENTITY_HAZARDS.find((entry) => entry.id === 'missing-names')!;
    expect(separatedSharedContext(missing.second).slice(0, 2).map((message) => message.content.split(':')[0])).toEqual([UNNAMED_PARTICIPANT, UNNAMED_PARTICIPANT]);
  });

  it('a message quoting another person on its own line is byte-identical to that person speaking when merged, and distinguishable only when separated', () => {
    const quote = SHARED_IDENTITY_HAZARDS.find((entry) => entry.id === 'quoted-speaker-line')!;
    expect(boundedSharedContext(quote.first)).toEqual(boundedSharedContext(quote.second));
    expect(separatedSharedContext(quote.first)).not.toEqual(separatedSharedContext(quote.second));
    expect(separatedSharedContext(quote.first)).toHaveLength(2);
    expect(separatedSharedContext(quote.second)).toHaveLength(3);
    // Separated, the quoted line still sits inside Sara's one message as text a model could read as a speaker line.
    expect(separatedSharedContext(quote.first)[0].content).toBe('سارة: تمام\n\nكريم: أنا موافق');
  });
});
