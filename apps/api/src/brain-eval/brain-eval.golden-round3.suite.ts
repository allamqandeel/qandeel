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
