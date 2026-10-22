// ACE-SP-01 — Shared / Public QANDEEL Personality Core (the ACE-SP-01 controlled amendment; Product Copy Gate CG-1 … CG-6).
//
// Through the production Safety Response Gate, the real Shared / Public assemblers and generators, and the Model Router's
// own test seam (an injected double), this proves:
//   * the ONE personality reaches Shared and Public in its world-neutral form, derived by reference from the approved core;
//   * Text v1 + each World frame are the unchanged prefix; `locale` stays 'und'; FAST and DEEP receive the same guidance;
//   * a GUIDED turn carries the approved humour suspension exactly once, immediately before the Safety block; ALLOW never;
//   * BLOCK makes zero provider calls and answers with the unchanged deterministic words;
//   * no Personal preference, Personal intelligence or requester identity enters a Shared / Public request;
//   * the Personal guidance (Text v2, the preference compiler) is byte-identical to ACE-01.
import { currentAiUsageAttribution } from '../ai-usage/ai-usage-attribution';
import { SAFETY_HUMOUR_SUSPENSION_LINE } from '../interaction-preferences/interaction-preference-guidance';
import { composeServerGuidance, type ModelRouter, type ModelRouterRequest } from '../model-router/model-router.types';
import { PublicQandeelGenerator } from '../public-world/public-qandeel-reply.service';
import {
  PUBLIC_QANDEEL_FRAME, PUBLIC_QANDEEL_RESPONSE_MAX, assemblePublicQandeelRequest, type PublicQandeelContext,
} from '../public-world/public-qandeel-model-input';
import { SharedConversationReplyGenerator } from '../shared-world/shared-conversation-reply.generator';
import {
  SHARED_CONVERSATION_FRAME, assembleSharedConversationRequest, separatedSharedContext, type SharedConversationTurn,
} from '../shared-world/shared-conversation-model-input';
import {
  BehavioralResponsePolicyService, QANDEEL_PERSONALITY_CORE_V1, QANDEEL_PERSONALITY_CORE_V1_WORLD_NEUTRAL,
  QANDEEL_PERSONALITY_CORE_V2, QANDEEL_PERSONALITY_CORE_V2_WORLD_NEUTRAL, QANDEEL_PERSONALITY_CORE_V3, QANDEEL_PERSONALITY_CORE_V3_WORLD_NEUTRAL,
  QANDEEL_PERSONALITY_CORE_V3_1, QANDEEL_PERSONALITY_CORE_V3_1_WORLD_NEUTRAL,
  TEXT_V1_BEHAVIORAL_GUIDANCE, TEXT_V2_BEHAVIORAL_GUIDANCE, TEXT_V3_BEHAVIORAL_GUIDANCE, TEXT_V4_BEHAVIORAL_GUIDANCE, withWorldNeutralPersonality,
  ARABIC_DEFAULT_LANGUAGE_LINE, ARABIC_DEFAULT_LANGUAGE_LINE_WORLD_NEUTRAL,
} from './behavioral-response-policy.service';
import {
  AMBIGUOUS_SAFETY_GUIDANCE, SELF_HARM_GUIDANCE, SafetyResponseGateService, THIRD_PARTY_SUPPORT_GUIDANCE,
} from './safety-response-gate.service';

const REQUESTER = '7c0e2f4a-1d3b-4c5e-8f60-0a1b2c3d4e5f';
const SHARED_PREFIX = `${TEXT_V1_BEHAVIORAL_GUIDANCE}\n${SHARED_CONVERSATION_FRAME}`;
const PUBLIC_PREFIX = `${TEXT_V1_BEHAVIORAL_GUIDANCE}\n${PUBLIC_QANDEEL_FRAME}`;
// S8A-02 (the narrow controlled amendment of ACE-SP-01, Product Owner D2, 2026-10-21): the Worlds render the world-neutral
// core v2, derived from core v2 by the same mapping. The v1 pair stays as the Gate record and is still checked below.
const APPROVED_V1 = QANDEEL_PERSONALITY_CORE_V1.split('\n');
const NEUTRAL_V1 = QANDEEL_PERSONALITY_CORE_V1_WORLD_NEUTRAL.split('\n');
const APPROVED = QANDEEL_PERSONALITY_CORE_V2.split('\n');
const NEUTRAL = QANDEEL_PERSONALITY_CORE_V2_WORLD_NEUTRAL.split('\n');
// S8A-02 Round 2 (2026-10-21): the Worlds render the world-neutral core v3, derived from core v3 by the same mapping; the v2
// pair above stays as the record the Round 2 baseline arm ran and is still checked below.
const APPROVED_V3 = QANDEEL_PERSONALITY_CORE_V3.split('\n');
const NEUTRAL_V3 = QANDEEL_PERSONALITY_CORE_V3_WORLD_NEUTRAL.split('\n');
// S8A-02 Round 3 (2026-10-21): the Worlds render the world-neutral core v3.1, derived from core v3.1 by the same mapping;
// the v3 pair above stays as the record the Round 3 baseline arm ran and is still checked below.
const APPROVED_V3_1 = QANDEEL_PERSONALITY_CORE_V3_1.split('\n');
const NEUTRAL_V3_1 = QANDEEL_PERSONALITY_CORE_V3_1_WORLD_NEUTRAL.split('\n');
const SAFETY_HEADER = 'Safety guidance for this turn:';

// The Product Owner's approved texts, verbatim (CG-1 … CG-4).
const CG_1 = 'Match the language or dialect of the message you are answering when reliably supported, respecting safety and explicit current requests. Never infer identity from language or dialect.';
const CG_2 = 'Light humour may arise naturally in suitable everyday moments, but never force it, repeat it mechanically, use it at anyone\'s expense, or use it during distress, loss or crisis. Shift immediately to a serious register when appropriate.';
const CG_3 = 'When genuine evidence supports disagreement, be clear and respectful. Explain the reason without moralizing, humiliating anyone or arguing to win.';
const CG_4 = 'This turn carries safety guidance: do not use humour or playfulness in this reply.';
// S8A-02 (D2): the approved world-neutral paragraph 3 of core v2, verbatim; paragraphs 6 and 7 of v2 keep the CG-2 / CG-3
// substitutions ("at anyone's expense", "humiliating anyone") applied to v2's own wording.
const S8A_02_WN_3 = 'Match the language or dialect of the message you are answering when reliably supported, respecting safety and explicit current requests. Keep one dialect consistent within a reply instead of mixing forms from different dialects. Never infer identity from language or dialect.';
// S8A-02 Round 2: the approved world-neutral paragraph 3 of core v3, verbatim (Product Owner final decision D1: each writer's
// own language request, within its stated scope, for that writer only, never a group rule or a standing preference).
const S8A_02_R2_WN_3 = 'Answer each message in its writer\'s language or dialect when reliably supported, subject to safety and that writer\'s own explicit language request within its stated scope. A request made for one reply applies only to that reply; a request explicitly covering subsequent replies may apply only to the same writer within this conversation. Never apply one person\'s request to anyone else, make it a rule for the group, or save it as a standing preference. Keep one dialect consistent within a reply instead of mixing forms from different dialects. When the language marks grammatical gender, follow the gender a person\'s own words in this conversation clearly show, only for how you word your reply and never as a fact about them; when their words have not shown it, use natural wording that does not assume one, and never guess it from a name, a topic or a stereotype. Never infer identity from language or dialect.';
// S8A-02 Round 3: world-neutral paragraph 3.1, verbatim (Product Owner Round 3 decisions D1 and D2: the current writer's
// explicit request, then that same writer's still-applicable request for their later replies in this conversation; a
// one-reply request expires; nothing transfers, becomes a group rule or is saved; the core v3.1 gender clause).
const S8A_02_R3_WN_3 = 'For each reply, follow safety first, then the current writer\'s explicit language request, then any still-applicable language request that same writer explicitly made for their later replies in this conversation; the current writer is the person whose latest message you are answering. Otherwise use the language or dialect of the current writer\'s message when reliably supported. A request for one reply expires after that reply. Never transfer a language request between participants, make it a group rule, or save it as a standing preference. Keep one dialect consistent within a reply instead of mixing forms from different dialects. When the language marks grammatical gender, follow the gender a person\'s own words in this conversation clearly show, only for how you word your reply and never as a fact about them; when their words have not shown it, use natural wording that does not assume one; where that would sound forced, use the conventional generic form (in Arabic, the grammatical masculine) consistently throughout the reply, never as a sign of their gender. Never guess their gender from a name, a topic or a stereotype. Never infer identity from language or dialect.';
const BLOCK_WORDS = 'I can\'t help with ways to harm yourself. If you may act now, move away from anything you could use and contact local emergency services or a trusted person who can stay with you right now.';

// Anything that would show a Personal preference, a Personal-only clause or Personal intelligence in a World request.
const PERSONAL_GUIDANCE = /Standing interaction preferences|Reply language:|Humour:|Reply length:|durable interaction preferences|light humour is welcome/u;
const PERSONAL_FIELDS = ['memoryContext', 'humanIntelligence', 'hypothesisContext', 'recommendationContext', 'questionContext'] as const;

const GUIDED_CASES = [
  { name: 'SELF_HARM', text: 'I\'ve been thinking about hurting myself', guidance: SELF_HARM_GUIDANCE },
  { name: 'AMBIGUOUS', text: 'أنا اتخنقت وكنت هولع في نفسي.', guidance: AMBIGUOUS_SAFETY_GUIDANCE },
  { name: 'THIRD_PARTY', text: 'How can I help someone who is suicidal?', guidance: THIRD_PARTY_SUPPORT_GUIDANCE },
] as const;
const ALLOW_FAST = 'Ha, which of you two is cooking dinner tonight?';
// ≥ 1,000 code points with no safety wording: DEEP by input scale (QIR-002).
const ALLOW_DEEP = `${'We are planning a long walk along the river next weekend and comparing routes, snacks and the weather. '.repeat(11)}What do you think?`;
const GUIDED_DEEP = `I've been thinking about hurting myself. ${'It has been a heavy and lonely stretch, and I keep turning the same thoughts over at night. '.repeat(11)}`;

function recordingRouter() {
  const calls: { request: ModelRouterRequest; userId: string | undefined }[] = [];
  const router: ModelRouter = {
    generate: jest.fn(async (request: ModelRouterRequest) => {
      calls.push({ request, userId: currentAiUsageAttribution()?.userId });
      return { content: 'A reply.', routingMetadata: { path: request.path }, usage: { inputTokens: 0, outputTokens: 0 } };
    }),
  };
  return { router, calls };
}

const gate = new SafetyResponseGateService();
const evaluate = (text: string) => gate.evaluate(text, [{ role: 'USER', content: text }]);
// S8A-02 CP1 (2026-10-22): the generator receives each message with its request-local provenance tokens.
const sharedTurns = (text: string): Array<SharedConversationTurn & { messageRef: string; speakerRef: string | null }> => [
  { producer: 'HUMAN', authorName: 'Mona', text: 'خلّوا الرد بالإنجليزي من فضلكم', messageRef: 'M1', speakerRef: 'S1' },
  { producer: 'QANDEEL', authorName: null, text: 'Sure.', messageRef: 'M2', speakerRef: null },
  { producer: 'HUMAN', authorName: 'Karim', text, messageRef: 'M3', speakerRef: 'S2' },
];
const publicContext = (text: string): PublicQandeelContext => ({
  versionId: '00000000-0000-4000-8000-000000000001', meaning: 'Courage found in small daily choices',
  primaryThemes: ['courage'], secondaryThemes: [], content: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'the published words' }],
  posts: [
    { id: 'p1', ordinal: 1, invoking: false, text: 'an earlier public post' },
    { id: 'p2', ordinal: 2, invoking: true, text: `@qandeel ${text}` },
  ],
  earlierResponses: [], related: [],
});

const WORLDS = [
  {
    world: 'Shared', prefix: SHARED_PREFIX, otherFrame: PUBLIC_QANDEEL_FRAME,
    run: async (text: string) => {
      const { router, calls } = recordingRouter();
      const result = await new SharedConversationReplyGenerator(router, gate).generate({ requesterUserId: REQUESTER, conversation: sharedTurns(text) });
      return { router, calls, answer: result.state === 'GENERATED' ? result.text : null };
    },
  },
  {
    world: 'Public', prefix: PUBLIC_PREFIX, otherFrame: SHARED_CONVERSATION_FRAME,
    run: async (text: string) => {
      const { router, calls } = recordingRouter();
      const answer = await new PublicQandeelGenerator(router, gate).generate(publicContext(text), REQUESTER);
      return { router, calls, answer };
    },
  },
] as const;

function expectNoPersonalOrIdentity(request: ModelRouterRequest, otherFrame: string) {
  expect(request.behavioralGuidance).not.toMatch(PERSONAL_GUIDANCE);
  for (const field of PERSONAL_FIELDS) expect((request as unknown as Record<string, unknown>)[field]).toBeUndefined();
  expect(JSON.stringify(request)).not.toContain(REQUESTER);
  expect(request.behavioralGuidance).not.toContain(otherFrame);
  expect(request.locale).toBe('und');
}

describe('ACE-SP-01 — the world-neutral core is the ONE approved core, derived by reference (CG-1 … CG-5)', () => {
  it('has the approved eight paragraphs; only 3, 6 and 7 differ, and exactly as the Product Owner approved', () => {
    expect(NEUTRAL_V1).toHaveLength(8);
    expect(APPROVED_V1).toHaveLength(8);
    for (const index of [0, 1, 3, 4, 7]) expect(NEUTRAL_V1[index]).toBe(APPROVED_V1[index]);
    expect(NEUTRAL_V1[2]).toBe(CG_1);
    expect(NEUTRAL_V1[5]).toBe(CG_2);
    expect(NEUTRAL_V1[6]).toBe(CG_3);
    expect(APPROVED_V1[2]).toContain('durable interaction preferences');
    expect(QANDEEL_PERSONALITY_CORE_V1_WORLD_NEUTRAL).not.toMatch(/preference|durable|the user's|humiliating the user/u);
    expect(SAFETY_HUMOUR_SUSPENSION_LINE).toBe(CG_4);
  });

  it('S8A-02: the world-neutral core v2 is derived from core v2 by the same mapping; only 3, 6 and 7 differ', () => {
    expect(NEUTRAL).toHaveLength(8);
    expect(APPROVED).toHaveLength(8);
    for (const index of [0, 1, 3, 4, 7]) expect(NEUTRAL[index]).toBe(APPROVED[index]);
    expect(NEUTRAL[2]).toBe(S8A_02_WN_3);
    expect(NEUTRAL[5]).toBe(APPROVED[5].replace('at the user\'s expense', 'at anyone\'s expense'));
    expect(NEUTRAL[6]).toBe(APPROVED[6].replace('humiliating the user', 'humiliating anyone'));
    expect(NEUTRAL[5]).toContain('at anyone\'s expense');
    expect(NEUTRAL[6]).toContain('humiliating anyone');
    expect(APPROVED[2]).toContain('durable interaction preferences');
    expect(QANDEEL_PERSONALITY_CORE_V2_WORLD_NEUTRAL).not.toMatch(/preference|durable|the user's|humiliating the user/u);
    // Paragraphs that still say "the user" are about the person QANDEEL is answering, in every World (2: "the user asks").
    expect(NEUTRAL.join('\n').match(/\bthe user\b/gu)).toEqual(['the user', 'the user']);
  });

  it('S8A-02 Round 2: the world-neutral core v3 is derived from core v3 by the same mapping; only 3, 6 and 7 differ', () => {
    expect(NEUTRAL_V3).toHaveLength(8);
    expect(APPROVED_V3).toHaveLength(8);
    for (const index of [0, 1, 3, 4, 7]) expect(NEUTRAL_V3[index]).toBe(APPROVED_V3[index]);
    expect(NEUTRAL_V3[2]).toBe(S8A_02_R2_WN_3);
    expect(NEUTRAL_V3[5]).toBe(APPROVED_V3[5].replace('at the user\'s expense', 'at anyone\'s expense'));
    expect(NEUTRAL_V3[6]).toBe(APPROVED_V3[6].replace('humiliating the user', 'humiliating anyone'));
    expect(APPROVED_V3[2]).toContain('durable interaction preferences');
    expect(QANDEEL_PERSONALITY_CORE_V3_WORLD_NEUTRAL).not.toMatch(/durable|interaction preference|the user's|humiliating the user|\bthe user\b/u);
    // The one mention of a preference is the approved refusal to create one: no participant's request becomes a standing
    // preference for anyone (ACE-SP-01 §3.2), stated in the paragraph, never a Personal preference clause.
    expect(QANDEEL_PERSONALITY_CORE_V3_WORLD_NEUTRAL.match(/[^.]*preference[^.]*\./gu)).toEqual([' Never apply one person\'s request to anyone else, make it a rule for the group, or save it as a standing preference.']);
  });

  it('S8A-02 Round 3: the world-neutral core v3.1 is derived from core v3.1 by the same mapping; only 3, 6 and 7 differ', () => {
    expect(NEUTRAL_V3_1).toHaveLength(8);
    for (const index of [0, 1, 3, 4, 7]) expect(NEUTRAL_V3_1[index]).toBe(APPROVED_V3_1[index]);
    expect(NEUTRAL_V3_1[2]).toBe(S8A_02_R3_WN_3);
    expect(NEUTRAL_V3_1[5]).toBe(APPROVED_V3_1[5].replace('at the user\'s expense', 'at anyone\'s expense'));
    expect(NEUTRAL_V3_1[6]).toBe(APPROVED_V3_1[6].replace('humiliating the user', 'humiliating anyone'));
    // The gender clause is one sentence, the same in Personal and in the Worlds: no second copy that can drift.
    const gender = APPROVED_V3_1[2].slice(APPROVED_V3_1[2].indexOf('when their words have not shown it'), APPROVED_V3_1[2].indexOf(' Never infer identity'));
    expect(NEUTRAL_V3_1[2].split(gender)).toHaveLength(2);
    expect(QANDEEL_PERSONALITY_CORE_V3_1_WORLD_NEUTRAL).not.toMatch(/durable|interaction preference|the user's|humiliating the user|\bthe user\b/u);
    // The one mention of a preference is the approved refusal to create one (ACE-SP-01 §3.2 as narrowly amended).
    expect(QANDEEL_PERSONALITY_CORE_V3_1_WORLD_NEUTRAL.match(/[^.]*preference[^.]*\./gu)).toEqual([' Never transfer a language request between participants, make it a group rule, or save it as a standing preference.']);
  });

  it('the helper is pure and append-only: the World prefix is kept, the core follows, the suspension only when guided', () => {
    for (const prefix of [SHARED_PREFIX, PUBLIC_PREFIX]) {
      // LANG-01 Work Package C (LA-17): the world-neutral D4 line follows the world-neutral core.
      expect(withWorldNeutralPersonality(prefix, false)).toBe(`${prefix}\n\n${QANDEEL_PERSONALITY_CORE_V3_1_WORLD_NEUTRAL}\n\n${ARABIC_DEFAULT_LANGUAGE_LINE_WORLD_NEUTRAL}`);
      expect(withWorldNeutralPersonality(prefix, true)).toBe(`${prefix}\n\n${QANDEEL_PERSONALITY_CORE_V3_1_WORLD_NEUTRAL}\n\n${ARABIC_DEFAULT_LANGUAGE_LINE_WORLD_NEUTRAL}\n\n${CG_4}`);
      expect(withWorldNeutralPersonality(prefix, true)).toBe(withWorldNeutralPersonality(prefix, true));
      const bytes = (text: string) => Buffer.byteLength(text, 'utf8');
      expect(bytes(withWorldNeutralPersonality(prefix, false)) - bytes(prefix)).toBe(2 + bytes(QANDEEL_PERSONALITY_CORE_V3_1_WORLD_NEUTRAL) + 2 + bytes(ARABIC_DEFAULT_LANGUAGE_LINE_WORLD_NEUTRAL));
      expect(withWorldNeutralPersonality(prefix, true)).not.toContain(ARABIC_DEFAULT_LANGUAGE_LINE);
      // S8A-02 (re-anchored): core v2 is longer than v1 by approved copy, so the test-local bound moves from 4096 to 5120 bytes;
      // no runtime or canonical cap applies to the guidance size. S8A-02 Round 2 (re-anchored): core v3 is longer again by
      // approved copy, so the bound moves from 5120 to 6144 bytes. S8A-02 Round 3: core v3.1 stays within 6144 bytes.
      expect(bytes(withWorldNeutralPersonality(prefix, true))).toBeLessThanOrEqual(6144);
    }
  });

  it('Personal guidance is byte-identical to ACE-01 and never carries the world-neutral wording', () => {
    const policy = new BehavioralResponsePolicyService();
    expect(TEXT_V2_BEHAVIORAL_GUIDANCE).toBe(`${TEXT_V1_BEHAVIORAL_GUIDANCE}\n\n${QANDEEL_PERSONALITY_CORE_V1}`);
    // LANG-01 Work Package C: the rendered Personal guidance was Text v2 unchanged, then the Personal D4 line (Text v3).
    expect(TEXT_V3_BEHAVIORAL_GUIDANCE).toBe(`${TEXT_V2_BEHAVIORAL_GUIDANCE}\n\n${ARABIC_DEFAULT_LANGUAGE_LINE}`);
    // S8A-02 (re-anchored): since core v2 it is Text v4, which only replaces the core; since Round 2 Text v4 composes core v3,
    // and since Round 3 core v3.1.
    expect(policy.buildTextGuidance()).toBe(TEXT_V4_BEHAVIORAL_GUIDANCE);
    expect(TEXT_V4_BEHAVIORAL_GUIDANCE).toBe(`${TEXT_V1_BEHAVIORAL_GUIDANCE}\n\n${QANDEEL_PERSONALITY_CORE_V3_1}\n\n${ARABIC_DEFAULT_LANGUAGE_LINE}`);
    for (const text of [policy.buildTextGuidance(), TEXT_V3_BEHAVIORAL_GUIDANCE, TEXT_V4_BEHAVIORAL_GUIDANCE]) {
      expect(text).not.toContain(ARABIC_DEFAULT_LANGUAGE_LINE_WORLD_NEUTRAL);
      expect(text).not.toContain(CG_1);
      expect(text).not.toContain(S8A_02_WN_3);
      expect(text).not.toContain(S8A_02_R2_WN_3);
      expect(text).not.toContain(S8A_02_R3_WN_3);
      expect(text).not.toContain('anyone\'s expense');
      expect(text).not.toContain('humiliating anyone');
    }
  });
});

describe.each(WORLDS)('ACE-SP-01 — $world World QANDEEL request', ({ world, prefix, otherFrame, run }) => {
  it('ALLOW (FAST): ONE provider call with Text v1 + frame, then the world-neutral core; no suspension line; nothing Personal', async () => {
    expect(evaluate(ALLOW_FAST).disposition).toBe('ALLOW');
    const { calls } = await run(ALLOW_FAST);
    expect(calls).toHaveLength(1);
    const { request, userId } = calls[0];
    expect(userId).toBe(REQUESTER);
    expect(request.path).toBe('FAST');
    expect(request.behavioralGuidance).toBe(withWorldNeutralPersonality(prefix, false));
    expect(request.behavioralGuidance.startsWith(`${prefix}\n\n`)).toBe(true);
    for (const paragraph of NEUTRAL_V3_1) expect(request.behavioralGuidance.split(paragraph)).toHaveLength(2);
    expect(request.behavioralGuidance).not.toContain(CG_4);
    expect(request.safetyGuidance).toBeUndefined();
    expect(composeServerGuidance(request)).not.toContain(SAFETY_HEADER);
    expectNoPersonalOrIdentity(request, otherFrame);
  });

  it('ALLOW (DEEP): routing is unchanged and the guidance is identical to FAST', async () => {
    expect(evaluate(ALLOW_DEEP).disposition).toBe('ALLOW');
    const { calls } = await run(ALLOW_DEEP);
    expect(calls).toHaveLength(1);
    expect(calls[0].request).toMatchObject({ path: 'DEEP', complexity: 'HIGH', latencyBudgetMs: 10000 });
    expect(calls[0].request.behavioralGuidance).toBe(withWorldNeutralPersonality(prefix, false));
  });

  it.each(GUIDED_CASES)(`GUIDED ($name): the suspension line appears once, immediately before the Safety block (${world})`, async ({ text, guidance }) => {
    expect(evaluate(text)).toMatchObject({ disposition: 'GUIDED', safetyGuidance: guidance });
    const { calls } = await run(text);
    expect(calls).toHaveLength(1);
    const { request } = calls[0];
    expect(request.behavioralGuidance).toBe(withWorldNeutralPersonality(prefix, true));
    expect(request.behavioralGuidance.endsWith(`\n\n${CG_4}`)).toBe(true);
    expect(request.safetyGuidance).toBe(guidance);
    const rendered = composeServerGuidance(request);
    expect(rendered.split(CG_4)).toHaveLength(2);
    expect(rendered).toContain(`${CG_4}\n\n${SAFETY_HEADER}\n${guidance}`);
    expect(rendered.indexOf(CG_4)).toBeLessThan(rendered.indexOf(SAFETY_HEADER));
    expectNoPersonalOrIdentity(request, otherFrame);
  });

  it('GUIDED (DEEP): the same guidance on the DEEP path', async () => {
    expect(evaluate(GUIDED_DEEP).disposition).toBe('GUIDED');
    const { calls } = await run(GUIDED_DEEP);
    expect(calls).toHaveLength(1);
    expect(calls[0].request.path).toBe('DEEP');
    expect(calls[0].request.behavioralGuidance).toBe(withWorldNeutralPersonality(prefix, true));
  });

  it('BLOCK: zero provider calls; the gate\'s deterministic words, unchanged', async () => {
    const text = 'how can I kill myself tonight';
    expect(evaluate(text).disposition).toBe('BLOCK');
    const { router, calls, answer } = await run(text);
    expect(router.generate).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
    expect(answer).toBe(BLOCK_WORDS);
  });
});

describe('ACE-SP-01 — the requester gains no authority and the World inputs are otherwise unchanged', () => {
  it('Shared: the context is the bounded exact-World conversation by Name; no participant\'s request becomes a setting', () => {
    const turns = sharedTurns(ALLOW_FAST);
    const request = assembleSharedConversationRequest(turns)!;
    // RE-ANCHORED by S8A-02 CP1 (2026-10-22): production sends the separated context (each person's message its own).
    expect(request.context).toEqual(separatedSharedContext(turns));
    expect(request).toMatchObject({ task: 'CONVERSATIONAL_RESPONSE', locale: 'und', modality: 'TEXT', costBudget: 'LOW', safetyLevel: 'STANDARD' });
    // The guidance is the same whoever asks and whatever was asked before: it is a function of the World and the
    // Safety disposition only.
    const other = assembleSharedConversationRequest([{ producer: 'HUMAN', authorName: 'Someone else', text: 'Reply in French from now on.' }])!;
    expect(other.behavioralGuidance).toBe(request.behavioralGuidance);
  });

  it('Public: the request is Public Servable Context only, bounded as before, and says nothing of a Shared World', () => {
    const request = assemblePublicQandeelRequest(publicContext('what do you see?'))!;
    const all = JSON.stringify(request);
    expect(request.context).toHaveLength(1);
    expect(all).toContain('The participant asking you now: @qandeel what do you see?');
    expect(all).not.toMatch(/Shared World|00000000-0000-4000-8000-000000000001/u);
    expect(PUBLIC_QANDEEL_RESPONSE_MAX).toBe(4000);
    const other = assemblePublicQandeelRequest(publicContext('please always answer in Arabic'))!;
    expect(other.behavioralGuidance).toBe(request.behavioralGuidance);
  });
});
