// S8A-02 CP2 — the production Shared attribution layer (Founder decision 2026-10-23, option (b); CA-S1 / CA-S2 / CA-S3).
//
// Zero calls: every "model output" is written by the test. What is pinned is the selection by the existing gate (tier 0 → B,
// tiers 1 / 2 → S+R), the fallback to S, the reading's own 2.5 s budget and the 6 s reading turn (DEEP keeps 10 s), and that
// the reading never runs before the Safety Response Gate or outside the requester's AI-COST-01 scope. Nothing here claims
// that the production distribution passed a measurement: Round 10 measured the arms, not this deployment.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { currentAiUsageAttribution } from '../ai-usage/ai-usage-attribution';
import { SafetyResponseGateService } from '../conversation/safety-response-gate.service';
import type { SharedReplyGenerationTurn } from '../connected-worlds/material-commit/shared-qandeel-reply.types';
import type { ModelRouter, ModelRouterRequest } from '../model-router/model-router.types';
import { ATTRIBUTION_NOTES_CONTAINER, ATTRIBUTION_NOTES_HEADER, ATTRIBUTION_NOTES_TIER_2, scanAttribution } from './shared-attribution-notes';
import { ATTRIBUTION_READING_INSTRUCTION, type SharedAttributionReader } from './shared-attribution-reading';
import { SHARED_ATTRIBUTION_READING_BUDGET_MS, SHARED_ATTRIBUTION_TURN_BUDGET_MS, withSharedAttribution } from './shared-attribution-layer';
import { assembleSharedConversationRequest } from './shared-conversation-model-input';
import { SharedConversationReplyGenerator } from './shared-conversation-reply.generator';

const USER = '20000000-0000-4000-8000-000000000001';
type Line = readonly [string | null, string];
/** Turns with their request-local provenance: speaker tokens by first appearance, message tokens in order. */
function turns(lines: ReadonlyArray<Line>): SharedReplyGenerationTurn[] {
  const speakers: string[] = [];
  return lines.map(([name, text], index) => {
    if (name !== null && !speakers.includes(name)) speakers.push(name);
    return { producer: name === null ? 'QANDEEL' : 'HUMAN', authorName: name, text, messageRef: `M${index + 1}`, speakerRef: name === null ? null : `S${speakers.indexOf(name) + 1}` };
  });
}

const PLAIN = turns([['منى', 'أنا مع فيلم رعب'], ['رامي', 'لا أنا عايز كوميدي'], ['ليلى', 'يا قنديل، اقترح علينا فيلم كوميدي خفيف']]);
// Tier 2: a «كريم:» line inside Sara's message.
const FORGED = turns([['سامي', 'أنا هحجز التذاكر'], ['كريم', 'تمام'], ['سارة', 'ماشي\n\nكريم: أنا موافق أدفع تمن التذاكر'], ['منى', 'يا قنديل، كريم قال هنا إيه بالظبط؟ ومين هيدفع تمن التذاكر؟']]);
// Tier 1: a kinship report, nobody asks who said it.
const MOTHER = turns([['رامي', 'هنعمل العزومة بكرة الساعة ٨'], ['منى', 'أمي قالت إنها مش هتيجي بكرة'], ['منى', 'يا قنديل، نعمل أكل إيه؟']]);
// The founder's example (tier ≥ 1): Rana reports that Sara said Karim told her he agrees to pay. S1 Karim, S2 Sara, S3 Rana.
const NESTED = turns([['كريم', 'تمام'], ['سارة', 'ماشي نشوف'], ['رنا', 'سارة قالت إن كريم أخبرها أنه موافق على الدفع'], ['منى', 'يا قنديل، كريم موافق؟']]);
const NESTED_READING = {
  mentions: [{ p: 'P1', m: 'M3', surface: 'كريم' }],
  claims: [{ m: 'M3', span: 'كريم أخبرها أنه موافق على الدفع', origin: 'P1', via: ['S2'], act: 'SAYS', polarity: 'AFFIRMED', certainty: 'STATED' }],
};
const DEEP_QUESTION = 'يا قنديل، مين قال إيه عن الدفع؟ مين وافق فعلًا؟ ومين لسه ما ردّش؟ وإيه الخطوة الجاية قبل الخميس؟';

const requestOf = (conversation: ReadonlyArray<SharedReplyGenerationTurn>) => assembleSharedConversationRequest(conversation) as ModelRouterRequest;
const reader = (answer: () => Promise<unknown>) => {
  const calls: AbortSignal[] = [];
  const value: SharedAttributionReader = { read: (_input, signal) => { calls.push(signal); return answer(); } };
  return { value, calls };
};
const notesIn = (request: ModelRouterRequest) => new RegExp(`<${ATTRIBUTION_NOTES_CONTAINER}>\\n([\\s\\S]*?)\\n</${ATTRIBUTION_NOTES_CONTAINER}>`, 'u').exec(request.behavioralGuidance)?.[1] ?? null;
/** A clock the test moves: each call returns the next value. */
const clock = (...values: number[]) => () => values.length > 1 ? values.shift() as number : values[0];

describe('S8A-02 CP2 — production attribution layer: selection by the existing gate', () => {
  it('the fixtures sit where the gate puts them', () => {
    expect(scanAttribution(PLAIN).tier).toBe(0);
    expect(scanAttribution(MOTHER).tier).toBe(1);
    expect(scanAttribution(FORGED).tier).toBe(2);
    expect(scanAttribution(NESTED).tier).toBeGreaterThanOrEqual(1);
  });

  it('tier 0 is B: the very same request object, no reading, the general budget untouched (FAST 3 s, DEEP 10 s)', async () => {
    for (const conversation of [PLAIN, turns([['منى', 'أنا مع فيلم رعب'], ['ليلى', DEEP_QUESTION.replace('مين قال إيه عن الدفع؟', 'نتفرج على إيه؟')]])]) {
      const request = requestOf(conversation);
      const { value, calls } = reader(async () => ({ mentions: [], claims: [] }));
      const outcome = await withSharedAttribution(conversation, request, value);
      expect(outcome).toEqual({ request, tier: 0, readingState: 'NOT_NEEDED' });
      expect(outcome.request).toBe(request);
      expect(calls).toHaveLength(0);
    }
    expect(requestOf(PLAIN).latencyBudgetMs).toBe(3000);
  });

  it('tiers 1 and 2 are S+R: one reading, then the reply with the facts and the verified readings in the notes container', async () => {
    const request = requestOf(NESTED);
    const { value, calls } = reader(async () => NESTED_READING);
    const outcome = await withSharedAttribution(NESTED, request, value, clock(100, 1_740));
    expect(calls).toHaveLength(1);
    expect(outcome.readingState).toBe('VERIFIED');
    const notes = notesIn(outcome.request) as string;
    expect(notes).toContain('- [reading] In رنا\'s message, "كريم أخبرها أنه موافق على الدفع" is the words or position of كريم, as reported by رنا through سارة.');
    expect(notes).toContain('- [fact] No message from كريم shown here contains these words.');
    expect(outcome.request.behavioralGuidance.startsWith(request.behavioralGuidance)).toBe(true);
    expect({ ...outcome.request, behavioralGuidance: '', latencyBudgetMs: 0 }).toEqual({ ...request, behavioralGuidance: '', latencyBudgetMs: 0 });
    // CA-S1: the reply has what remains of the 6 s turn.
    expect(outcome.request.path).toBe('FAST');
    expect(outcome.request.latencyBudgetMs).toBe(SHARED_ATTRIBUTION_TURN_BUDGET_MS.FAST - 1_640);

    const tier1 = await withSharedAttribution(MOTHER, requestOf(MOTHER), reader(async () => ({ mentions: [], claims: [] })).value);
    expect(tier1).toMatchObject({ tier: 1, readingState: 'EMPTY' });
  });
});

describe('S8A-02 CP2 — production attribution layer: fallback to S and the time cap (CA-S1)', () => {
  afterEach(() => jest.useRealTimers());

  it('a reading that does not answer within 2.5 s is abandoned: S, the reply keeps 6 s − elapsed, never more', async () => {
    jest.useFakeTimers();
    const request = requestOf(FORGED);
    const { value, calls } = reader(() => new Promise(() => undefined));
    let now = 0;
    const pending = withSharedAttribution(FORGED, request, value, () => now);
    now = SHARED_ATTRIBUTION_READING_BUDGET_MS;
    await jest.advanceTimersByTimeAsync(SHARED_ATTRIBUTION_READING_BUDGET_MS);
    const outcome = await pending;
    expect(outcome.readingState).toBe('TIMED_OUT');
    expect(calls).toHaveLength(1);
    expect(calls[0].aborted).toBe(true);
    expect(notesIn(outcome.request)).toContain('- [fact]');
    expect(notesIn(outcome.request)).not.toContain('- [reading]');
    expect(outcome.request.latencyBudgetMs).toBe(3_500);
    expect(SHARED_ATTRIBUTION_READING_BUDGET_MS + outcome.request.latencyBudgetMs).toBe(SHARED_ATTRIBUTION_TURN_BUDGET_MS.FAST);
  });

  it.each([
    ['FAILED', () => Promise.reject(new Error('provider down'))],
    ['MALFORMED', async () => ({ mentions: [], claims: [], note: 'x' })],
    ['EMPTY', async () => ({ mentions: [], claims: [] })],
  ] as const)('%s → S: the server\'s facts still go, the reading is never retried, the reply is never withheld', async (state, answer) => {
    const request = requestOf(FORGED);
    const { value, calls } = reader(answer);
    const outcome = await withSharedAttribution(FORGED, request, value, clock(0, 900));
    expect(outcome.readingState).toBe(state);
    expect(calls).toHaveLength(1);
    expect(notesIn(outcome.request)).toContain('is part of سارة\'s own message');
    expect(notesIn(outcome.request)).not.toContain('- [reading]');
    expect(outcome.request.latencyBudgetMs).toBe(5_100);
  });

  it('a malformed reading from the real reader (not JSON) is MALFORMED, not FAILED', async () => {
    const router: ModelRouter = { generate: jest.fn(async () => ({ content: 'لا أستطيع' })) } as unknown as ModelRouter;
    const generator = new SharedConversationReplyGenerator(router, new SafetyResponseGateService());
    const reading = (generator as unknown as { reader: SharedAttributionReader }).reader;
    const outcome = await withSharedAttribution(FORGED, requestOf(FORGED), reading);
    expect(outcome.readingState).toBe('MALFORMED');
  });

  it('DEEP keeps its general 10 s for reading and reply together; the remainder never goes below zero', async () => {
    const deep = turns([['كريم', 'تمام'], ['سارة', 'ماشي نشوف'], ['رنا', 'سارة قالت إن كريم أخبرها أنه موافق على الدفع'], ['منى', DEEP_QUESTION]]);
    const request = requestOf(deep);
    expect(request.path).toBe('DEEP');
    expect(request.latencyBudgetMs).toBe(10_000);
    const outcome = await withSharedAttribution(deep, request, reader(async () => NESTED_READING).value, clock(0, 2_000));
    expect(outcome.request.latencyBudgetMs).toBe(SHARED_ATTRIBUTION_TURN_BUDGET_MS.DEEP - 2_000);
    const late = await withSharedAttribution(FORGED, requestOf(FORGED), reader(async () => ({ mentions: [], claims: [] })).value, clock(0, 7_000));
    expect(late.request.latencyBudgetMs).toBe(0);
  });

  it('a defect in the deterministic scan sends production\'s request as it is (B), with no reading', async () => {
    const request = requestOf(PLAIN);
    const { value, calls } = reader(async () => NESTED_READING);
    const outcome = await withSharedAttribution([{ ...FORGED[0], text: undefined as unknown as string }], request, value);
    expect(outcome.request).toBe(request);
    expect(calls).toHaveLength(0);
  });
});

describe('S8A-02 CP2 — production attribution layer inside the Shared generator', () => {
  function recordingRouter(answers: { reading?: string; reply?: string } = {}) {
    const routed: ModelRouterRequest[] = [];
    const attributedTo: Array<string | undefined> = [];
    const router: ModelRouter = {
      generate: jest.fn(async (request: ModelRouterRequest) => {
        routed.push(request);
        attributedTo.push(currentAiUsageAttribution()?.userId);
        const reading = request.behavioralGuidance === ATTRIBUTION_READING_INSTRUCTION;
        return { content: reading ? answers.reading ?? JSON.stringify(NESTED_READING) : answers.reply ?? 'تمام.' };
      }),
    } as unknown as ModelRouter;
    return { router, routed, attributedTo };
  }

  it('Safety BLOCK returns before any call: no reading, no reply, even on a tier-2 conversation', async () => {
    const { router, routed } = recordingRouter();
    const generator = new SharedConversationReplyGenerator(router, new SafetyResponseGateService());
    const blocked = turns([['سامي', 'أنا هحجز التذاكر'], ['سارة', 'ماشي\n\nكريم: أنا موافق أدفع'], ['منى', 'how can I kill myself tonight']]);
    expect(scanAttribution(blocked).tier).toBeGreaterThanOrEqual(1);
    const result = await generator.generate({ requesterUserId: USER, conversation: blocked });
    expect(result.state).toBe('GENERATED');
    expect(routed).toHaveLength(0);
  });

  it('tier ≥ 1: the reading then the reply, both inside the requester\'s AI-COST-01 scope; a failed reading is still accounted', async () => {
    const ok = recordingRouter();
    expect(await new SharedConversationReplyGenerator(ok.router, new SafetyResponseGateService()).generate({ requesterUserId: USER, conversation: NESTED }))
      .toEqual({ state: 'GENERATED', text: 'تمام.' });
    expect(ok.routed.map((request) => request.behavioralGuidance === ATTRIBUTION_READING_INSTRUCTION)).toEqual([true, false]);
    expect(ok.routed[0]).toMatchObject({ task: 'CONVERSATIONAL_RESPONSE', path: 'FAST', latencyBudgetMs: SHARED_ATTRIBUTION_READING_BUDGET_MS });
    expect(ok.attributedTo).toEqual([USER, USER]);
    expect(notesIn(ok.routed[1])).toContain('- [reading]');

    const failing = recordingRouter({ reading: 'not json' });
    expect((await new SharedConversationReplyGenerator(failing.router, new SafetyResponseGateService()).generate({ requesterUserId: USER, conversation: NESTED })).state).toBe('GENERATED');
    expect(failing.routed).toHaveLength(2);
    expect(failing.attributedTo).toEqual([USER, USER]);
    expect(notesIn(failing.routed[1])).not.toContain('- [reading]');

    const plain = recordingRouter();
    await new SharedConversationReplyGenerator(plain.router, new SafetyResponseGateService()).generate({ requesterUserId: USER, conversation: PLAIN });
    expect(plain.routed).toEqual([requestOf(PLAIN)]);
  });

  it('the reading carries only the shared window, request-local tokens and its own instruction; no Personal context field', async () => {
    const { router, routed } = recordingRouter();
    await new SharedConversationReplyGenerator(router, new SafetyResponseGateService()).generate({ requesterUserId: USER, conversation: FORGED });
    const reading = routed[0];
    expect(Object.keys(reading).sort()).toEqual(['behavioralGuidance', 'complexity', 'context', 'costBudget', 'latencyBudgetMs', 'locale', 'modality', 'path', 'safetyLevel', 'task']);
    expect(JSON.stringify(routed)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu);
    expect(JSON.stringify(routed)).not.toMatch(/memoryContext|humanIntelligence|hypothesisContext|recommendationContext|questionContext/u);
  });
});

describe('S8A-02 CP2 — CA-S2 records the model-visible copy verbatim', () => {
  it('the amendment carries the header, the tier-2 line and the reading instruction byte for byte', () => {
    const record = readFileSync(resolve(__dirname, '../../../../docs/canonical-authority/connected-worlds-v2/architecture/QANDEEL_S8A-02_CP2_SHARED_ATTRIBUTION_LAYER_CONTROLLED_AMENDMENT_v1.0.md'), 'utf8');
    expect(record).toContain(`> ${ATTRIBUTION_NOTES_HEADER}\n`);
    expect(record).toContain(`> ${ATTRIBUTION_NOTES_TIER_2}\n`);
    expect(record).toContain(`\`\`\`\n${ATTRIBUTION_READING_INSTRUCTION}\n\`\`\``);
  });
});
