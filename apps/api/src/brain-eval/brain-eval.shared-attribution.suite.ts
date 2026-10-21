import { assembleSharedConversationRequest, type SharedConversationTurn } from '../shared-world/shared-conversation-model-input';
import type { BrainEvaluationCase, StyleFocus } from './brain-eval.types';

// S8A-02 — Shared information attribution (Product Owner Shared Attribution Engineering Decision, 2026-10-21). Synthetic
// only: every Name and fact is invented. Each conversation is sent twice by label, as production's merged context
// (`shared-merged`) and as the experimental separated candidate (a-1, `shared-separated`), under the same core v3.1 guidance.
//
// - The probe (D2): ONE conversation on FAST and on DEEP, separated only. It checks that DeepSeek accepts consecutive `user`
//   messages and whether a reply completes inside the production budget; it judges no attribution.
// - Part T (D3): ten conversations of 3-4 people, two per category: who said what; no transfer between people; per-person
//   opinions, preferences and decisions; corrections applied to the right person; ambiguity without guessing.
// - The identity hazards (D3 / D5): free, never sent. They show what the model receives when two people share a Name, when
//   people have no Name, when a message quotes another person, and which person an earlier QANDEEL reply answered.
//
// Every review note is the key a reply is scored against; `FAIL if` notes are the blocking attribution faults.

const human = (authorName: string | null, text: string): SharedConversationTurn => ({ producer: 'HUMAN', authorName, text });
const qandeel = (text: string): SharedConversationTurn => ({ producer: 'QANDEEL', authorName: null, text });

function shared(id: string, path: 'FAST' | 'DEEP', styleFocus: ReadonlyArray<StyleFocus>, conversation: ReadonlyArray<SharedConversationTurn>, reviewNotes: ReadonlyArray<string>): BrainEvaluationCase {
  const request = assembleSharedConversationRequest(conversation);
  if (request === null) throw new Error(`${id}: the Shared assembler refuses this conversation.`);
  return { id, path, locale: 'und', context: request.context, reviewNotes, styleFocus, world: { kind: 'SHARED', conversation } };
}

const ATTRIBUTION: ReadonlyArray<StyleFocus> = ['MULTI_TURN_TRANSITION', 'NEGATIVE_CONTROL'];

// T-05: four people, four consecutive `user` pairs when separated; a clean key (one preference each, one indifferent, one
// absent). It is also the probe conversation.
const PREFERENCES_DECISIONS: ReadonlyArray<SharedConversationTurn> = [
  human('منى', 'أنا مع فيلم رعب'),
  human('رامي', 'لا أنا مش بتاع رعب، أنا عايز كوميدي'),
  human('ليلى', 'أنا مش فارقة معايا، اللي تختاروه'),
  human('سامي', 'أنا قررت مش هاجي السهرة دي أصلًا، عندي شغل'),
  human('ليلى', 'يا قنديل، كده كل واحد رأيه إيه، ومين جاي؟'),
];
const PREFERENCES_DECISIONS_NOTES = [
  'Mona wants horror; Rami wants comedy; Leila has no preference; Sami decided not to come',
  'Answers Leila, the current writer, in her Egyptian Arabic',
  'FAIL if a preference or decision is placed on the wrong person, Leila is given a preference, or Sami is counted as coming',
];

/** The D2 probe: one conversation, FAST and DEEP, run under `shared-separated` only. */
export const SHARED_ATTRIBUTION_PROBE_SUITE: ReadonlyArray<BrainEvaluationCase> = (['FAST', 'DEEP'] as const).map((path) =>
  shared(`${path.toLowerCase()}-golden-pathcmp-attribution-probe`, path, ATTRIBUTION, PREFERENCES_DECISIONS, PREFERENCES_DECISIONS_NOTES));

/** Part T: ten conversations, both representations, three repeats. Production routes every one of them FAST. */
export const SHARED_ATTRIBUTION_SUITE: ReadonlyArray<BrainEvaluationCase> = [
  // Who said what.
  shared('fast-golden-attr-who-said-what-trip', 'FAST', ATTRIBUTION, [
    human('هبة', 'أنا هقدر أسوق، بس العربية معايا يوم الخميس بس'),
    human('كريم', 'أنا مش هينفع أتحرك قبل الساعة ٦ عشان الشغل'),
    human('سارة', 'أنا حجزت الشاليه خلاص، بس لازم ندفع العربون قبل الأربع'),
    human('يوسف', 'يا قنديل، لخّصلنا مين قال إيه عشان نتفق'),
  ], [
    'Heba can drive, the car only on Thursday; Karim cannot leave before 6; Sara booked the chalet, deposit due before Wednesday',
    'Yousef stated nothing of his own',
    'FAIL if any fact is placed on the wrong person, or a fact is invented for Yousef or anyone else',
  ]),
  shared('fast-golden-attr-who-said-what-question', 'FAST', ATTRIBUTION, [
    human('ليلى', 'أنا بقترح نروح المطعم الهندي اللي في الزمالك'),
    human('عمر', 'أنا مش بحب الأكل الحراق، بس ماشي'),
    qandeel('ممكن تختار أطباق مش حارة يا عمر، أغلب المطاعم الهندية فيها اختيارات خفيفة.'),
    human('نادية', 'أنا عندي حساسية من المكسرات، فلازم أسأل قبل ما أطلب'),
    human('عمر', 'يا قنديل، مين فينا اللي قال إن عنده حساسية؟ وأنا كنت قلت إيه عن الأكل؟'),
  ], [
    'The nut allergy is Nadia\'s; Omar said he dislikes spicy food; Leila proposed the Indian restaurant',
    'FAIL if the allergy is placed on Omar or Leila, Omar\'s dislike is placed on anyone else, or something nobody said is added',
  ]),
  // No transfer of information or traits between people.
  shared('fast-golden-attr-no-transfer-diet', 'FAST', ATTRIBUTION, [
    human('هبة', 'أنا نباتية من سنين، مش باكل لحمة خالص'),
    human('كريم', 'وأنا بموت في الكفتة'),
    human('مازن', 'أنا عندي سكر، فبحاول أقلل الحلويات'),
    human('كريم', 'يا قنديل، اقترح عليّا أنا أكلة أعملها النهارده بالليل'),
  ], [
    'A suggestion for Karim, who loves kofta; others\' constraints appear only if correctly attributed to them',
    'FAIL if Karim is treated as vegetarian or diabetic, or Heba\'s or Mazen\'s facts are placed on anyone else',
  ]),
  shared('fast-golden-attr-no-transfer-circumstance', 'FAST', ATTRIBUTION, [
    human('رنا', 'أنا لسه متنقلة القاهرة الشهر ده ومش عارفة حد هنا'),
    human('طارق', 'أنا مولود هنا وعارف كل حتة فيها'),
    human('سلمى', 'وأنا بتخنق جدًا من الزحمة'),
    human('طارق', 'يا قنديل، تفتكر أروح فين يوم الجمعة؟'),
  ], [
    'A suggestion for Tarek, who was born in Cairo; masculine address, as his own words show',
    'FAIL if Tarek is treated as new to the city or as disliking crowds, or Rana\'s or Salma\'s circumstances are placed on anyone else',
  ]),
  // Per-person opinions, preferences and decisions.
  shared('fast-golden-attr-preferences-decisions', 'FAST', ATTRIBUTION, PREFERENCES_DECISIONS, PREFERENCES_DECISIONS_NOTES),
  shared('fast-golden-attr-opinions-fair', 'FAST', ['MULTI_TURN_TRANSITION', 'DISAGREEMENT', 'NEGATIVE_CONTROL'], [
    human('يوسف', 'أنا شايف إننا نأجل السفر للشهر الجاي'),
    human('يوسف', 'عشان الأسعار هتنزل بعد الموسم'),
    human('دينا', 'أنا ضد التأجيل، أجازتي في الشهر ده بس'),
    human('هشام', 'أنا مع دينا'),
    human('يوسف', 'يا قنديل، اعرضلنا الرأيين بإنصاف من غير ما تنحاز'),
  ], [
    'Yousef: postpone, because prices drop after the season; Dina: against, her leave is this month only; Hisham sides with Dina',
    'Both views presented fairly, without taking a side',
    'FAIL if a view or reason is placed on the wrong person, Hisham is placed with Yousef, or the reply takes a side',
  ]),
  // Corrections applied to the right person only.
  shared('fast-golden-attr-correction-self', 'FAST', ATTRIBUTION, [
    human('مازن', 'أنا هوصل الساعة ٨'),
    human('نور', 'وأنا هوصل ٨ برضه'),
    human('مازن', 'لا معلش، تصحيح: أنا هوصل ٩ مش ٨'),
    human('هبة', 'يا قنديل، كده مين هيوصل إمتى؟'),
  ], [
    'Mazen at 9 after his correction; Nour still at 8; Heba stated no time',
    'FAIL if Nour is moved to 9, Mazen is left at 8, or a time is invented for Heba',
  ]),
  shared('fast-golden-attr-correction-misattribution', 'FAST', ATTRIBUTION, [
    human('سارة', 'كريم قال إنه هيجيب التورتة'),
    human('كريم', 'لا، أنا قلت هجيب العصير. اللي هتجيب التورتة ريم'),
    human('ريم', 'أيوه أنا اللي هجيب التورتة'),
    human('عمر', 'يا قنديل، مين هيجيب إيه بالظبط؟'),
  ], [
    'Karim brings the juice; Reem brings the cake (Karim corrected what Sara reported, and Reem confirmed); Sara and Omar stated nothing they bring',
    'FAIL if Karim is said to bring the cake, or anything is invented for Sara or Omar',
  ]),
  // Ambiguity, answered without guessing.
  shared('fast-golden-attr-ambiguous-pronoun', 'FAST', ATTRIBUTION, [
    human('رامي', 'أنا مش هقدر أوصّل حد المرة دي'),
    human('هبة', 'أحمد وكريم الاتنين عرضوا يوصّلونا'),
    human('نادية', 'هو قال إنه هيتأخر شوية'),
    human('هبة', 'يا قنديل، مين فيهم اللي هيتأخر؟'),
  ], [
    'Nadia\'s «هو» could be Ahmed or Karim: the reply says it is not clear from what was written, and may suggest asking Nadia',
    'FAIL if the reply names Ahmed or Karim as the one who will be late',
  ]),
  shared('fast-golden-attr-unstated', 'FAST', ATTRIBUTION, [
    human('سامي', 'أنا هحجز التذاكر'),
    human('منى', 'وأنا هجيب الأكل'),
    human('رامي', 'تمام'),
    human('منى', 'يا قنديل، رامي قال هيعمل إيه؟ ومين هيدفع تمن التذاكر؟'),
  ], [
    'Rami only agreed and named no task; who pays for the tickets was never said (Sami books them)',
    'FAIL if a task is invented for Rami, or a payer is named as if it had been said',
  ]),
];

/**
 * The identity hazards: pairs of conversations that are DIFFERENT in fact and are sent as the SAME bytes, or (for the quote)
 * the same in bytes only when merged. Free: they are never sent to any provider.
 */
export interface SharedIdentityHazard {
  readonly id: string;
  readonly finding: 'AI-06 duplicate Names' | 'AI-07 missing Names' | 'AI-08 QANDEEL reply addressee' | 'quotation of another person';
  readonly fact: string;
  readonly first: ReadonlyArray<SharedConversationTurn>;
  readonly second: ReadonlyArray<SharedConversationTurn>;
}

export const SHARED_IDENTITY_HAZARDS: ReadonlyArray<SharedIdentityHazard> = [
  {
    id: 'duplicate-names',
    finding: 'AI-06 duplicate Names',
    fact: 'first: ONE person named سارة says both lines; second: TWO different people, both named سارة, one line each',
    first: [human('سارة', 'أنا هجيب العربية'), human('سارة', 'وأنا مش هقدر أجي خالص'), human('عمر', 'يا قنديل، مين جاي معانا؟')],
    second: [human('سارة', 'أنا هجيب العربية'), human('سارة', 'وأنا مش هقدر أجي خالص'), human('عمر', 'يا قنديل، مين جاي معانا؟')],
  },
  {
    id: 'missing-names',
    finding: 'AI-07 missing Names',
    fact: 'first: ONE person without a Name says both lines; second: TWO different people without a Name, one line each',
    first: [human(null, 'أنا موافق على البحر'), human(null, 'أنا مش موافق، عايز الجبل'), human('ليلى', 'يا قنديل، كام واحد موافق على البحر؟')],
    second: [human(null, 'أنا موافق على البحر'), human(null, 'أنا مش موافق، عايز الجبل'), human('ليلى', 'يا قنديل، كام واحد موافق على البحر؟')],
  },
  {
    id: 'reply-addressee',
    finding: 'AI-08 QANDEEL reply addressee',
    fact: 'first: QANDEEL\'s «أيوه، ينفع» answered Mona\'s question; second: it answered Rami\'s (server-side only, the reply-to link is not read)',
    first: [human('منى', 'ينفع نحجز من غير عربون؟'), human('رامي', 'ينفع نلغي قبلها بيوم؟'), qandeel('أيوه، ينفع.'), human('منى', 'يا قنديل، يعني أنا كده أعمل إيه؟')],
    second: [human('منى', 'ينفع نحجز من غير عربون؟'), human('رامي', 'ينفع نلغي قبلها بيوم؟'), qandeel('أيوه، ينفع.'), human('منى', 'يا قنديل، يعني أنا كده أعمل إيه؟')],
  },
  {
    id: 'quoted-speaker-line',
    finding: 'quotation of another person',
    fact: 'first: Sara writes ONE message that quotes Karim on its own line; second: Sara writes «تمام» and Karim himself writes «أنا موافق»',
    first: [human('سارة', 'تمام\n\nكريم: أنا موافق'), human('عمر', 'يا قنديل، كريم وافق ولا لأ؟')],
    second: [human('سارة', 'تمام'), human('كريم', 'أنا موافق'), human('عمر', 'يا قنديل، كريم وافق ولا لأ؟')],
  },
];
