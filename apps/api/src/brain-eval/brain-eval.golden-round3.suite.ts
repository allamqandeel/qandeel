import { DEFAULT_INTERACTION_PREFERENCES } from '../interaction-preferences/interaction-preferences.types';
import { assembleSharedConversationRequest, type SharedConversationTurn } from '../shared-world/shared-conversation-model-input';
import { GOLDEN_ROUND2_SUITE } from './brain-eval.golden-round2.suite';
import type { BrainEvaluationCase, StyleFocus } from './brain-eval.types';

// S8A-02 Round 3 (Product Owner review of Round 2, 2026-10-21) — the focused Shared language comparison of the ONE
// brain-eval system. Synthetic only. Three rules, each in its Round 2 conversation (by reference) and in one new
// conversation, so that no verdict rests on a single input:
// - Mona: one participant's English request never reaches another participant;
// - Rami: a request a writer explicitly made for their later replies is honoured in a reply to that writer;
// - Leila: a request made for one reply ends with that reply.
// Every case runs three times per version (core v3 against core v3.1).

const human = (authorName: string, text: string): SharedConversationTurn => ({ producer: 'HUMAN', authorName, text });
const qandeel = (text: string): SharedConversationTurn => ({ producer: 'QANDEEL', authorName: null, text });

function shared(id: string, styleFocus: ReadonlyArray<StyleFocus>, conversation: ReadonlyArray<SharedConversationTurn>, reviewNotes: ReadonlyArray<string>): BrainEvaluationCase {
  const request = assembleSharedConversationRequest(conversation);
  if (request === null) throw new Error(`${id}: the Shared assembler refuses this conversation.`);
  return { id, path: 'FAST', locale: 'und', context: request.context, reviewNotes, styleFocus, world: { kind: 'SHARED', conversation } };
}

const FOCUS: ReadonlyArray<StyleFocus> = ['DIALECT_SWITCHING', 'MULTI_TURN_TRANSITION', 'NEGATIVE_CONTROL'];

/** The Round 2 conversations, by reference; R2-11's single-repeat limit was a Round 2 budget measure and does not apply. */
export const ROUND3_REFERENCED_CASE_IDS = [
  'fast-golden-shared-mixed-dialects',
  'fast-golden-shared-english-request-owner',
  'fast-golden-shared-one-reply-language-request',
] as const;

export const ROUND3_NEW_CASES: ReadonlyArray<BrainEvaluationCase> = [
  // Mona's rule, second conversation: Adam's standing English request; Nour writes last, in Arabic.
  shared('fast-golden-shared-no-transfer-2', FOCUS,
    [
      human('آدم', 'Qandeel, from now on please answer me in English.'),
      qandeel('Sure, Adam.'),
      human('آدم', 'What do you think about going to Alexandria next weekend?'),
      qandeel('Alexandria could be lovely next weekend, especially if the weather holds.'),
      human('نور', 'يا قنديل، أنا خايفة تبقى زحمة جدًا هناك. إيه رأيك؟'),
    ],
    ['The reply answers Nour, the current writer, in her own Egyptian Arabic', 'Adam\'s request stays his: not applied to Nour, not announced as a rule', 'FAIL if Nour is answered in English, or Adam\'s request is applied to anyone else or announced as a group rule']),
  // Rami's rule, second conversation: Sami asks in Arabic for English for the rest of the conversation; Heba and Sami
  // then write in Arabic in one merged turn, Sami last.
  shared('fast-golden-shared-standing-request-2', FOCUS,
    [
      human('سامي', 'يا قنديل، من فضلك رد عليّا بالإنجليزي في باقي المحادثة دي'),
      qandeel('Sure, Sami. I\'ll reply to you in English.'),
      human('هبة', 'إحنا بنفكر نطبخ سوا بكرة'),
      human('سامي', 'عندك فكرة أكلة سهلة لأربع أشخاص؟'),
    ],
    ['The reply answers Sami, the current writer, in English: his request covers his later replies in this conversation', 'Heba\'s language is not changed and nothing becomes a group rule', 'FAIL if Sami is answered in Arabic, or his request is announced or applied as a rule for everyone']),
  // Leila's rule, second conversation: Karim asks for English for one reply only, then writes in Arabic.
  shared('fast-golden-shared-one-reply-request-2', FOCUS,
    [
      human('كريم', 'Qandeel, answer just this one in English: what is a quick dessert we can make tonight?'),
      qandeel('A no-bake chocolate mousse is quick: whip cream, fold in melted chocolate, and chill it for an hour.'),
      human('دينا', 'عندي خلاط لو احتجتوا'),
      human('كريم', 'تمام يا قنديل، وأقدر أعملها من غير خلاط؟'),
    ],
    ['Karim\'s English request covered one reply only; his new Arabic message is answered in his own Arabic', 'Nothing carries over to Dina or becomes a group rule', 'FAIL if Karim is answered in English, or the one-reply request is treated as lasting or applied to anyone else']),
];

const byId = new Map(GOLDEN_ROUND2_SUITE.map((testCase) => [testCase.id, testCase]));

export const GOLDEN_ROUND3_SHARED_SUITE: ReadonlyArray<BrainEvaluationCase> = [
  ...ROUND3_REFERENCED_CASE_IDS.map((id) => {
    const testCase = byId.get(id);
    if (testCase === undefined) throw new Error(`Round 3 references an unknown case: ${id}`);
    const { maxRepeats: _roundTwoBudgetOnly, ...unchanged } = testCase;
    return unchanged;
  }),
  ...ROUND3_NEW_CASES,
];

// Round 3 Part B (Product Owner Round 3 decisions D2-D4, 2026-10-21): gender guessed without evidence, and a declared brevity
// preference on DEEP, core v3 against core v3.1, three repeats. Five Round 2 cases by reference, unchanged, and two new ones.
// The referenced gender notes predate D2: under D2 a consistent grammatical-masculine generic is allowed where neutral wording
// would be forced; a topic-driven switch, mixed forms in one reply, or contradicting a gender the person showed is not.

export const ROUND3_PERSONALITY_REFERENCED_CASE_IDS = [
  'fast-golden-pref-levantine-welcome-ar',
  'fast-golden-gender-unknown-ar-eg',
  'fast-golden-gender-self-feminine-ar-eg',
  'deep-golden-declared-brevity-ar-eg',
  'deep-golden-complex-decision-ar-eg',
] as const;

const COMPLEX_DECISION_ID = 'deep-golden-complex-decision-ar-eg';

const complexDecision = byId.get(COMPLEX_DECISION_ID);
if (complexDecision === undefined) throw new Error(`Round 3 references an unknown case: ${COMPLEX_DECISION_ID}`);

export const ROUND3_PERSONALITY_NEW_CASES: ReadonlyArray<BrainEvaluationCase> = [
  // Gender, a topic stereotyped as female: the person's words show no gender. Production routes it FAST.
  {
    id: 'fast-golden-gender-caregiving-ar-eg', path: 'FAST', locale: 'ar', styleFocus: ['NATURALNESS', 'EMPATHY', 'NEGATIVE_CONTROL'],
    context: [{ role: 'USER', content: 'أمي بقت محتاجة رعاية طول اليوم، وأنا اللي بقوم بكل حاجة. أعمل إيه؟' }],
    reviewNotes: [
      'Steady, practical and warm about the actual situation',
      'Wording that assumes no gender, or the grammatical-masculine generic used consistently (D2); never as a fact about the person',
      'FAIL if it uses feminine address or a role drawn from the topic (for example «كبنت»), or mixes forms within the reply',
    ],
  },
  // Brevity on a complex decision: the complex-decision message unchanged, with the durable ALWAYS_BRIEF preference.
  {
    id: 'deep-golden-declared-brevity-complex-ar-eg', path: 'DEEP', locale: 'ar', context: complexDecision.context,
    styleFocus: ['DECLARED_PREFERENCES', 'NATURALNESS', 'NEGATIVE_CONTROL'],
    interactionPreferences: { ...DEFAULT_INTERACTION_PREFERENCES, replyLength: 'ALWAYS_BRIEF' },
    reviewNotes: [
      'The durable ALWAYS_BRIEF preference comes from the canonical record; it is honoured on a complex question',
      'Brief but complete: the answer and the one or two points that matter most (for example testing demand before leaving the job)',
      'FAIL if it is long or report-shaped despite the preference, or drops what is essential to the decision',
    ],
  },
];

export const GOLDEN_ROUND3_PERSONALITY_SUITE: ReadonlyArray<BrainEvaluationCase> = [
  ...ROUND3_PERSONALITY_REFERENCED_CASE_IDS.map((id) => {
    const testCase = byId.get(id);
    if (testCase === undefined) throw new Error(`Round 3 references an unknown case: ${id}`);
    return testCase;
  }),
  ...ROUND3_PERSONALITY_NEW_CASES,
];
