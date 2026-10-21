import { DEFAULT_INTERACTION_PREFERENCES, type InteractionPreferences } from '../interaction-preferences/interaction-preferences.types';
import { assemblePublicQandeelRequest, type PublicQandeelContext } from '../public-world/public-qandeel-model-input';
import { assembleSharedConversationRequest, type SharedConversationTurn } from '../shared-world/shared-conversation-model-input';
import { GOLDEN_CONVERSATION_SUITE } from './brain-eval.golden.suite';
import type { BrainEvaluationCase, StyleFocus } from './brain-eval.types';

// S8A-02 — the extended Golden Conversations suite: the 22 approved Golden cases, by reference and unchanged, plus 8
// supplementary synthetic cases for what they do not cover (Product Owner D4, 2026-10-21). It is a third named suite of the
// ONE brain-eval system (same validator, harness and blinded review); the 22-case suite stays exactly as ACE-01 left it.
//
// The supplement covers durable reply languages and explanation styles the Golden cases never declare (QAN-BL-IP-02), a
// current explicit request outranking a durable language, real production-DEEP questions (D5: is the personality still
// QANDEEL when it thinks, and does a substantial answer stay conversation rather than a report), and one Shared World and
// one Public World reply through their own production assemblers (QAN-BL-ACE-02, ACE-SP-01 extension).
//
// What 30 cases cannot cover is recorded for a separate targeted round, never claimed (D4): see the S8A-02 record.

const user = (content: string) => ({ role: 'USER' as const, content });
const assistant = (content: string) => ({ role: 'ASSISTANT' as const, content });
const preferences = (over: Partial<InteractionPreferences>): InteractionPreferences => ({ ...DEFAULT_INTERACTION_PREFERENCES, ...over });

const personal = (
  id: string,
  locale: BrainEvaluationCase['locale'],
  styleFocus: ReadonlyArray<StyleFocus>,
  context: BrainEvaluationCase['context'],
  reviewNotes: ReadonlyArray<string>,
  interactionPreferences?: InteractionPreferences,
): BrainEvaluationCase => ({
  id, path: id.startsWith('deep-') ? 'DEEP' : 'FAST', locale, context, reviewNotes, styleFocus,
  ...(interactionPreferences === undefined ? {} : { interactionPreferences }),
});

function shared(id: string, styleFocus: ReadonlyArray<StyleFocus>, conversation: ReadonlyArray<SharedConversationTurn>, reviewNotes: ReadonlyArray<string>): BrainEvaluationCase {
  const request = assembleSharedConversationRequest(conversation);
  if (request === null) throw new Error(`${id}: the Shared assembler refuses this conversation.`);
  return { id, path: id.startsWith('deep-') ? 'DEEP' : 'FAST', locale: 'und', context: request.context, reviewNotes, styleFocus, world: { kind: 'SHARED', conversation } };
}

function publicReply(id: string, styleFocus: ReadonlyArray<StyleFocus>, discussion: PublicQandeelContext, reviewNotes: ReadonlyArray<string>): BrainEvaluationCase {
  const request = assemblePublicQandeelRequest(discussion);
  if (request === null) throw new Error(`${id}: the Public assembler refuses this discussion.`);
  return { id, path: id.startsWith('deep-') ? 'DEEP' : 'FAST', locale: 'und', context: request.context, reviewNotes, styleFocus, world: { kind: 'PUBLIC', discussion } };
}

const human = (authorName: string, text: string): SharedConversationTurn => ({ producer: 'HUMAN', authorName, text });
const qandeel = (text: string): SharedConversationTurn => ({ producer: 'QANDEEL', authorName: null, text });

export const GOLDEN_SUPPLEMENT_CASES: ReadonlyArray<BrainEvaluationCase> = [
  // S1 — durable Modern Standard Arabic + DIRECT, while the user writes Egyptian.
  personal('fast-golden-pref-msa-direct-ar', 'ar', ['DECLARED_PREFERENCES', 'DIALECT_SWITCHING', 'BREVITY'],
    [user('عايز أبدأ أجري الصبح بس كل مرة بكسل بعد يومين، أعمل إيه؟')],
    ['The durable MODERN_STANDARD_ARABIC preference holds although the user writes Egyptian', 'Direct: the useful point first', 'Preference not announced'],
    preferences({ replyLanguage: 'MODERN_STANDARD_ARABIC', explanationStyle: 'DIRECT' })),
  // S2 — durable Levantine + humour WELCOME, in a light everyday moment.
  personal('fast-golden-pref-levantine-welcome-ar', 'ar', ['DECLARED_PREFERENCES', 'HUMOUR_INITIATIVE', 'NATURALNESS'],
    [user('أخيرًا خلصت تنظيف المطبخ بعد ثلاث ساعات')],
    ['Levantine reply (durable preference), one dialect throughout', 'Light humour is welcome where it fits; never forced', 'No question needed'],
    preferences({ replyLanguage: 'LEVANTINE_ARABIC', humour: 'WELCOME' })),
  // S3 — durable English + SIMPLER, while the user writes Arabic.
  personal('fast-golden-pref-english-simpler-from-ar', 'en', ['DECLARED_PREFERENCES', 'DIALECT_SWITCHING', 'BREVITY'],
    [user('يعني إيه تضخم بالظبط؟ كل الناس بتتكلم عنه')],
    ['The durable ENGLISH preference holds although the user writes Arabic', 'Simple explanation without jargon or a lecture', 'Preference not announced'],
    preferences({ replyLanguage: 'ENGLISH', explanationStyle: 'SIMPLER' })),
  // S4 — durable Maghrebi + SIMPLER_AND_DIRECT on a substantial question production routes DEEP.
  personal('deep-golden-pref-maghrebi-complex-ar', 'ar', ['DECLARED_PREFERENCES', 'NATURALNESS', 'NEGATIVE_CONTROL'],
    [user('عندي عرض عمل في مدينة أخرى براتب أعلى بكثير، لكن أهلي هنا وأمي كبيرة في السن. هل يستحق المال هذا البعد؟ وكيف أقرر دون أن أندم؟ وهل يوجد حل وسط؟')],
    ['Maghrebi reply (durable preference), one dialect throughout', 'Real substance, simple and direct, in conversational prose', 'FAIL if it becomes a formatted report (headings, bold labels, bullet lists) or a lecture'],
    preferences({ replyLanguage: 'MAGHREBI_ARABIC', explanationStyle: 'SIMPLER_AND_DIRECT' })),
  // S5 — durable Egyptian, then an explicit current request for Modern Standard Arabic text.
  personal('fast-golden-pref-egyptian-request-msa-ar', 'ar', ['DECLARED_PREFERENCES', 'DIALECT_SWITCHING', 'MULTI_TURN_TRANSITION'],
    [
      user('عايز أعتذر لمديري إني اتأخرت في التسليم'),
      assistant('ماشي، تحب الاعتذار يكون قصير ولا فيه شرح للسبب؟'),
      user('قصير. واكتبهولي بالفصحى عشان هبعته إيميل'),
    ],
    ['The explicit current request (Modern Standard Arabic for the email) outranks the durable Egyptian preference for what it asks', 'A short, usable email text', 'No comment on the switch, no lecture'],
    preferences({ replyLanguage: 'EGYPTIAN_ARABIC' })),
  // S6 — the CP4 decision question (production DEEP, MULTI_QUESTION), no declared preference.
  personal('deep-golden-complex-decision-ar-eg', 'ar', ['NATURALNESS', 'REGISTER_FIT', 'NEGATIVE_CONTROL'],
    [user('بفكر أسيب شغلي الثابت وأبدأ مشروع صغير لتسجيل البودكاست. معايا مدخرات تكفي سنة تقريبا. هل الأحسن أبدأ دلوقتي؟ ولا أستنى لما أجهز الاستوديو الأول؟ وإزاي أعرف إن عندي عملاء كفاية قبل ما أسيب الشغل؟')],
    ['Full substance where it is needed, in natural Egyptian conversation', 'Candid view allowed; respects the decision as the user\'s', 'FAIL if it reads as a formatted consultancy report (headings, bold labels, bullet lists) rather than conversation']),
  // S7 — Shared World: two participants, two dialects; one asked for English for himself; the other is answered.
  shared('fast-golden-shared-mixed-dialects', ['DIALECT_SWITCHING', 'DISAGREEMENT', 'NEGATIVE_CONTROL'],
    [
      human('منى', 'يا قنديل احنا بنخطط لرحلة آخر الشهر، وأنا شايفة إن البحر أحسن'),
      human('رامي', 'Please reply to me in English from now on.'),
      qandeel('Sure, Rami. Sea or mountains can both work; it depends on what the group wants most from the trip.'),
      human('رامي', 'أنا بفضّل الجبل، الطقس هونيك أحلى بكتير'),
      human('منى', 'بس الجبل هيبقى برد جدًا آخر الشهر. مين فينا عنده حق يا قنديل؟'),
    ],
    ['Answers the message being answered in its own language (Egyptian Arabic)', 'Takes no side by default; fair to both, humiliates no one', 'FAIL if Rami\'s English request is applied to Mona\'s message, or a verdict for one side is given']),
  // S8 — Public World: a public discussion in neutral Arabic with a light moment.
  publicReply('fast-golden-public-neutral-msa', ['NATURALNESS', 'HUMOUR_INITIATIVE', 'REGISTER_FIT'],
    {
      versionId: 'synthetic-experience-s8a-02',
      meaning: 'قصة شخص بدأ يتعلم الطبخ في الأربعين بعد سنوات من الاعتماد على الوجبات الجاهزة',
      primaryThemes: ['التعلم', 'العادات'],
      secondaryThemes: [],
      content: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'في الأربعين قررت أن أتعلم الطبخ. أول طبق أحرقته بالكامل، لكني الآن أطبخ ثلاث مرات في الأسبوع.' }],
      posts: [
        { id: 'synthetic-post-1', ordinal: 1, invoking: false, text: 'أنا أيضًا أحرقت الأرز في أول محاولة 😂' },
        { id: 'synthetic-post-2', ordinal: 2, invoking: true, text: 'يا قنديل، هل التعلم بعد الأربعين أصعب فعلًا أم أننا نبالغ؟' },
      ],
      earlierResponses: [],
      related: [],
    },
    ['Neutral simplified Modern Standard Arabic: no dialect settles it', 'Public discussion material, not a private chat; no guess about who anyone is', 'Light humour may fit, never at anyone\'s expense; a direct answer, no lecture']),
];

export const GOLDEN_EXTENDED_SUITE: ReadonlyArray<BrainEvaluationCase> = [...GOLDEN_CONVERSATION_SUITE, ...GOLDEN_SUPPLEMENT_CASES];
