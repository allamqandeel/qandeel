import { DEFAULT_INTERACTION_PREFERENCES, type InteractionPreferences } from '../interaction-preferences/interaction-preferences.types';
import { interactionPreferenceReply } from '../interaction-preferences/interaction-preference.copy';
import { GOLDEN_CP3_QUALIFICATION_CASES, onProductionRoute } from './brain-eval.golden-cp3.suite';
import type { BrainEvaluationCase, StyleFocus } from './brain-eval.types';

// S8A-02 CP3 — the acceptance suite of the Final Integrated Correction (Product Owner, 2026-10-22). Synthetic only; DeepSeek
// only; nothing here reaches production. It starts from the cases that already exist (the human-review failure references
// H07 / H15 / H23 / H25 / H28 / H42, their neighbours and a few no-regression controls, all BY REFERENCE and unchanged) and
// adds only what no existing case covers: each reply language against a message in another one, persistence across turns,
// a preference changed mid-conversation, the current request against the durable preference and back, the same question
// under every explanation style and every humour choice, two compatible combinations, H15 with the context that settles it,
// and H28 across turns (continuity, a correction, new information). Every earlier ASSISTANT turn below is written by hand
// and fixed before any call; DeepSeek never produced it. Each case is sent on the path production routing chooses, at the
// PRODUCTION budget (no transport override), so delivery is measured as production would deliver it.

/** The existing cases rerun on the corrected guidance, in this order (texts and review notes unchanged). */
export const CP3C_REUSED_CASE_IDS = [
  'fast-golden-pref-english-simpler-from-ar', // H23
  'fast-golden-pref-gulf-ar', // H25
  'fast-golden-pref-msa-direct-ar', // H42
  'fast-golden-pref-levantine-welcome-ar',
  'deep-golden-pref-maghrebi-complex-ar',
  'fast-golden-pref-egyptian-request-msa-ar',
  'deep-golden-declared-brevity-complex-ar-eg', // H07
  'deep-golden-declared-brevity-ar-eg',
  'fast-golden-declared-no-humour-ar-eg',
  'fast-golden-no-invented-history-ar-eg', // H15
  'fast-golden-gender-caregiving-ar-eg', // H28
  'fast-golden-gender-unknown-ar-eg', // H45
  'fast-golden-gender-self-feminine-ar-eg',
  'fast-golden-gender-mechanics-ar-eg',
  'deep-golden-complex-decision-ar-eg',
  'deep-golden-complex-en',
  'fast-golden-request-change-ar-eg',
  'fast-golden-neutral-msa-default-ar',
  'fast-golden-humour-initiative-ar-eg',
] as const;

const user = (content: string) => ({ role: 'USER' as const, content });
const assistant = (content: string) => ({ role: 'ASSISTANT' as const, content });
const preferences = (over: Partial<InteractionPreferences>): InteractionPreferences => ({ ...DEFAULT_INTERACTION_PREFERENCES, ...over });
const personal = (
  id: string, locale: BrainEvaluationCase['locale'], styleFocus: ReadonlyArray<StyleFocus>, context: BrainEvaluationCase['context'],
  reviewNotes: ReadonlyArray<string>, interactionPreferences?: InteractionPreferences,
): BrainEvaluationCase => ({
  id, path: id.startsWith('deep-') ? 'DEEP' : 'FAST', locale, context, reviewNotes, styleFocus,
  ...(interactionPreferences === undefined ? {} : { interactionPreferences }),
});

const COMPOUND_QUESTION = 'يعني إيه فايدة مركبة؟ وليه البنوك بتتكلم عنها كتير؟';
const LIGHT_MOMENT = 'أخيرًا الإيميل اللي مستنيه من شهر وصل… وطلع إعلان 🙃';
const INTERVIEW_OPENING = [
  user('عندي مقابلة شغل بكرة الصبح، والتوتر مسيطر عليّا'),
  assistant('طبيعي تحس بكده قبل مقابلة مهمة. جهّز إجابة قصيرة عن نفسك، واقرا عن الشركة شوية، ونام بدري؛ ده لوحده بيفرق كتير.'),
];
const ARABIC_THIS_TIME = 'المرة دي رد عليا بالعربي عشان هبعت الكلام لمامتي: إزاي أقنعها تمشي نص ساعة كل يوم؟';

/** The new cases (C01–C25). */
export const CP3C_NEW_CASES: ReadonlyArray<BrainEvaluationCase> = [
  // Preferences: each reply language against a message in another language or dialect.
  personal('fast-golden-cp3c-pref-egyptian-from-en', 'ar', ['DECLARED_PREFERENCES', 'DIALECT_SWITCHING', 'NEGATIVE_CONTROL'],
    [user("I haven't been sleeping well lately. Any simple tips?")],
    ['The durable EGYPTIAN_ARABIC preference holds although the user writes English: the whole reply in Egyptian Arabic', 'Simple, usable tips; no lecture', 'Preference not announced', 'FAIL if the reply, or part of it, is in English or Modern Standard Arabic'],
    preferences({ replyLanguage: 'EGYPTIAN_ARABIC' })),
  personal('fast-golden-cp3c-pref-levantine-from-msa', 'ar', ['DECLARED_PREFERENCES', 'DIALECT_SWITCHING', 'NEGATIVE_CONTROL'],
    [user('ما أفضل طريقة لبدء تعلّم الطبخ لشخص مبتدئ تمامًا؟')],
    ['The durable LEVANTINE_ARABIC preference holds although the user writes Modern Standard Arabic: the whole reply in Levantine Arabic', 'Practical first steps', 'Preference not announced', 'FAIL if the reply, or part of it, is in Modern Standard Arabic or another dialect'],
    preferences({ replyLanguage: 'LEVANTINE_ARABIC' })),
  personal('fast-golden-cp3c-pref-maghrebi-from-eg', 'ar', ['DECLARED_PREFERENCES', 'DIALECT_SWITCHING', 'NEGATIVE_CONTROL'],
    [user('عايز أعمل عزومة بسيطة لأصحابي في البيت بميزانية قليلة، أعمل إيه؟')],
    ['The durable MAGHREBI_ARABIC preference holds although the user writes Egyptian: the whole reply in Maghrebi Arabic', 'Practical, low-budget ideas', 'Preference not announced', 'FAIL if the reply, or part of it, is in Egyptian Arabic, Modern Standard Arabic or another dialect'],
    preferences({ replyLanguage: 'MAGHREBI_ARABIC' })),
  personal('fast-golden-cp3c-pref-msa-from-en', 'ar', ['DECLARED_PREFERENCES', 'DIALECT_SWITCHING', 'NEGATIVE_CONTROL'],
    [user('How do I stop procrastinating on my assignments?')],
    ['The durable MODERN_STANDARD_ARABIC preference holds although the user writes English: the whole reply in Modern Standard Arabic, without dialect words', 'Usable advice', 'Preference not announced', 'FAIL if the reply, or part of it, is in English or a dialect'],
    preferences({ replyLanguage: 'MODERN_STANDARD_ARABIC' })),
  // Preferences: persistence across turns (multi-turn).
  personal('fast-golden-cp3c-pref-english-multiturn-ar', 'en', ['DECLARED_PREFERENCES', 'MULTI_TURN_TRANSITION', 'NEGATIVE_CONTROL'],
    [
      user('عايز أبدأ أقرأ كتب بانتظام بس مش عارف أبدأ منين'),
      assistant('Start small: pick one book you actually want to read, not one you feel you should, and read ten pages a day at a fixed time, like before bed.'),
      user('طب ولو زهقت من الكتاب في النص؟'),
      assistant('Then switch. Finishing every book is not the goal; reading regularly is. Put it aside without guilt and start one that pulls you in.'),
      user('وإزاي أفتكر اللي قريته؟'),
    ],
    ['Third turn: the durable ENGLISH preference still holds although every message is Arabic', 'Answers the actual question briefly and usefully', 'Preference not announced or repeated', 'FAIL if the reply, or part of it, is in Arabic'],
    preferences({ replyLanguage: 'ENGLISH' })),
  personal('fast-golden-cp3c-pref-gulf-multiturn-eg', 'ar', ['DECLARED_PREFERENCES', 'MULTI_TURN_TRANSITION', 'NEGATIVE_CONTROL'],
    [
      user('ناوي أشتري عربية مستعملة لأول مرة'),
      assistant('حلو إنك تفكر فيها زين. أهم شي تفحص السيارة عند ورشة تثق فيها قبل لا تدفع، وتشوف سجل الصيانة والحوادث.'),
      user('وأعرف منين إن السعر مناسب؟'),
      assistant('قارن نفس الموديل والسنة والممشى في أكثر من موقع، وإذا لقيت سعر أقل من السوق بوايد اسأل ليش قبل لا تتحمس.'),
      user('طب أدفع كاش ولا تقسيط؟'),
    ],
    ['Third turn: the durable GULF_ARABIC preference still holds although the user writes Egyptian throughout', 'A balanced, practical answer', 'Preference not announced', 'FAIL if the reply slides into Egyptian or Modern Standard Arabic, or mixes dialects'],
    preferences({ replyLanguage: 'GULF_ARABIC' })),
  // Preferences: a durable change made mid-conversation (the command turn is answered from the record, as production does).
  personal('fast-golden-cp3c-pref-changed-en-to-eg', 'ar', ['DECLARED_PREFERENCES', 'MULTI_TURN_TRANSITION', 'NEGATIVE_CONTROL'],
    [
      user('إيه أحسن وقت أذاكر فيه؟'),
      assistant('Whenever your focus is best. For most people that is the morning, but test it: study at the same hour for a week and see when you remember more.'),
      user('كلمني دايمًا بالمصري'),
      assistant(interactionPreferenceReply('ar', 'SAVED', 'REPLY_LANGUAGE', 'EGYPTIAN_ARABIC')),
      user('طب أعمل إيه لو بنام وأنا بذاكر؟'),
    ],
    ['The changed durable preference (now EGYPTIAN_ARABIC) is absorbed at once: the whole reply in Egyptian Arabic, although the earlier reply is in English', 'Practical help', 'No comment on the change', 'FAIL if the reply, or part of it, is in English or Modern Standard Arabic'],
    preferences({ replyLanguage: 'EGYPTIAN_ARABIC' })),
  // Preferences: the explicit current request against the durable one, and back once its scope ends.
  personal('fast-golden-cp3c-pref-english-request-arabic', 'en', ['DECLARED_PREFERENCES', 'MULTI_TURN_TRANSITION', 'NEGATIVE_CONTROL'],
    [user(ARABIC_THIS_TIME)],
    ['The explicit current request (Arabic, this time) outranks the durable ENGLISH preference for what it asks: the reply is in Arabic', 'Gentle, usable words for persuading the mother', 'No comment on the switch', 'FAIL if it replies in English'],
    preferences({ replyLanguage: 'ENGLISH' })),
  personal('fast-golden-cp3c-pref-english-after-request', 'en', ['DECLARED_PREFERENCES', 'MULTI_TURN_TRANSITION', 'NEGATIVE_CONTROL'],
    [
      user(ARABIC_THIS_TIME),
      assistant('ممكن تقول لها: «يا ماما، نص ساعة مشي كل يوم هتفرق في نومك ومزاجك، وأنا هنزل معاكي أول أسبوع.» ابدأوا بعد العصر في مكان قريب وسهل.'),
      user('تمام شكرًا. هو المشي ولا الجري أحسن للقلب؟'),
    ],
    ['The earlier request was for that one message; on a new ordinary question the durable ENGLISH preference applies again: the reply is in English', 'Answers the question simply', 'FAIL if the reply, or part of it, stays in Arabic'],
    preferences({ replyLanguage: 'ENGLISH' })),
  personal('fast-golden-cp3c-brief-request-detail', 'ar', ['DECLARED_PREFERENCES', 'BREVITY', 'NEGATIVE_CONTROL'],
    [user('المرة دي عايزك تشرحلي بالتفصيل، خطوة بخطوة، إزاي أكتب سيرة ذاتية لأول شغل ليا')],
    ['The explicit current request for detail outranks the durable ALWAYS_BRIEF preference for this reply: a full step-by-step answer', 'Conversational, usable steps; not padded', 'FAIL if it stays brief and drops the steps asked for'],
    preferences({ replyLength: 'ALWAYS_BRIEF' })),
  personal('fast-golden-cp3c-brief-multiturn', 'ar', ['DECLARED_PREFERENCES', 'BREVITY', 'MULTI_TURN_TRANSITION', 'NEGATIVE_CONTROL'],
    [
      user('عايز أبدأ أستثمر مبلغ صغير'),
      assistant('ابدأ بصندوق استثمار متنوع منخفض التكلفة، وبمبلغ تقدر تسيبه سنين من غير ما تحتاجه.'),
      user('طب إيه الفرق بين الأسهم والسندات والصناديق والدهب، وأنهي أنسب لواحد لسه بيبدأ ومش عايز مخاطرة كبيرة ودخله متوسط؟'),
    ],
    ['Second turn, a broad question: the durable ALWAYS_BRIEF preference still holds: a brief reply with only what matters most', 'Keeps the essential: a clear recommendation for a cautious beginner', 'FAIL if it is long or walks through every option in detail, or drops the recommendation'],
    preferences({ replyLength: 'ALWAYS_BRIEF' })),
  // Explanation style: the same question under DEFAULT and each declared style, so the difference shows side by side.
  personal('fast-golden-cp3c-explain-default', 'ar', ['REGISTER_FIT', 'NATURALNESS'],
    [user(COMPOUND_QUESTION)],
    ['Reference reply: the same question with no declared explanation style', 'Correct and clear']),
  personal('fast-golden-cp3c-explain-simpler', 'ar', ['DECLARED_PREFERENCES', 'NEGATIVE_CONTROL'],
    [user(COMPOUND_QUESTION)],
    ['The durable SIMPLER style shows: everyday words and an everyday example', 'Correct', 'Preference not announced', 'FAIL if it relies on financial terms left unexplained'],
    preferences({ explanationStyle: 'SIMPLER' })),
  personal('fast-golden-cp3c-explain-direct', 'ar', ['DECLARED_PREFERENCES', 'NEGATIVE_CONTROL'],
    [user(COMPOUND_QUESTION)],
    ['The durable DIRECT style shows: the first sentence is the answer itself (what compound interest is)', 'Correct', 'Preference not announced', 'FAIL if it opens with a preamble, a remark on the question, or background before the answer'],
    preferences({ explanationStyle: 'DIRECT' })),
  personal('fast-golden-cp3c-explain-simpler-direct', 'ar', ['DECLARED_PREFERENCES', 'NEGATIVE_CONTROL'],
    [user(COMPOUND_QUESTION)],
    ['The durable SIMPLER_AND_DIRECT style shows: the answer first, in everyday words', 'Correct', 'Preference not announced', 'FAIL if it opens with a preamble, or relies on financial terms left unexplained'],
    preferences({ explanationStyle: 'SIMPLER_AND_DIRECT' })),
  // Humour: the same light moment under WELCOME, DEFAULT and DECLINED.
  personal('fast-golden-cp3c-humour-welcome', 'ar', ['DECLARED_PREFERENCES', 'HUMOUR_INITIATIVE', 'NEGATIVE_CONTROL'],
    [user(LIGHT_MOMENT)],
    ['The durable WELCOME preference: a light touch of humour fits this moment and is welcome; natural, never forced', 'Short', 'Preference not announced', 'FAIL if the humour is forced, long, or at the person\'s expense'],
    preferences({ humour: 'WELCOME' })),
  personal('fast-golden-cp3c-humour-default', 'ar', ['HUMOUR_INITIATIVE', 'NATURALNESS'],
    [user(LIGHT_MOMENT)],
    ['No declared humour preference: QANDEEL\'s own judgement decides whether a light touch fits', 'Short and natural']),
  personal('fast-golden-cp3c-humour-declined', 'ar', ['DECLARED_PREFERENCES', 'HUMOUR_INITIATIVE', 'NEGATIVE_CONTROL'],
    [user(LIGHT_MOMENT)],
    ['The durable DECLINED preference: no humour at all, though the moment invites it; still warm and natural', 'Preference not announced', 'FAIL if any joke, pun or playful remark appears'],
    preferences({ humour: 'DECLINED' })),
  // Compatible combinations: every chosen field holds, none bleeds into another.
  personal('fast-golden-cp3c-combo-english-brief-direct', 'en', ['DECLARED_PREFERENCES', 'BREVITY', 'NEGATIVE_CONTROL'],
    [user('إزاي أتعامل مع زميل في الشغل بياخد مجهودي وينسبه لنفسه قدام المدير؟')],
    ['All three durable preferences together: English, brief, the answer first', 'A concrete, usable step', 'Preference not announced', 'FAIL if any one of the three is broken (Arabic, long, or opening with a preamble)'],
    preferences({ replyLanguage: 'ENGLISH', replyLength: 'ALWAYS_BRIEF', explanationStyle: 'DIRECT' })),
  personal('fast-golden-cp3c-combo-egyptian-welcome-simpler', 'ar', ['DECLARED_PREFERENCES', 'DIALECT_SWITCHING', 'HUMOUR_INITIATIVE', 'NEGATIVE_CONTROL'],
    [user('لماذا يتأخر الطلب في المطاعم أيام العطلات أكثر من باقي الأيام؟')],
    ['Egyptian reply although the user writes Modern Standard Arabic; a simple everyday explanation; a light touch of humour welcome where it fits', 'Preference not announced', 'FAIL if it replies in Modern Standard Arabic, uses jargon, or the humour is forced'],
    preferences({ replyLanguage: 'EGYPTIAN_ARABIC', humour: 'WELCOME', explanationStyle: 'SIMPLER' })),
  // H15: the same message with the earlier context that settles what «الدكتور» means (the no-context case is reused).
  personal('fast-golden-cp3c-doctor-medical-context', 'ar', ['NATURALNESS', 'MULTI_TURN_TRANSITION', 'NEGATIVE_CONTROL'],
    [
      user('بقالي شهرين متابع مع دكتور باطنة عشان الضغط، وبيظبطلي جرعة الدوا كل زيارة'),
      assistant('كويس إنك منتظم في المتابعة، ده أهم حاجة في ضبط الضغط. لو عندك أي سؤال عن الجرعة أو القياسات قولّي.'),
      user('نسيت معاد الدكتور النهارده، أعمل إيه؟'),
    ],
    ['Uses what the conversation already makes clear (the internist following the blood-pressure treatment): rebook soon, and keep to the treatment as prescribed meanwhile', 'Practical and calm, without asking which doctor', 'FAIL if it reads «الدكتور» as a university professor, asks which doctor, or invents details not given']),
  personal('fast-golden-cp3c-doctor-university-context', 'ar', ['NATURALNESS', 'MULTI_TURN_TRANSITION', 'NEGATIVE_CONTROL'],
    [
      user('السنة دي سنة تخرجي، والدكتور المشرف على مشروعي صارم جدًا في المواعيد'),
      assistant('سنة التخرج ضغطها عالي، والمشرف الصارم في المواعيد ممكن يبقى في صالحك لو اتفقتوا على خطة واضحة من الأول.'),
      user('نسيت معاد الدكتور النهارده، أعمل إيه؟'),
    ],
    ['Uses what the conversation makes clear (the strict supervising professor): a prompt, honest message that apologises and asks for another slot', 'Practical and calm', 'FAIL if it treats it as a medical appointment, asks which doctor, or invents details not given']),
  // H28: one form kept across turns; a correction; new information from the person's own words.
  personal('fast-golden-cp3c-gender-continuity', 'ar', ['NATURALNESS', 'PERSONALITY_CONSISTENCY', 'MULTI_TURN_TRANSITION', 'NEGATIVE_CONTROL'],
    [...INTERVIEW_OPENING, user('طب لو سألوني عن عيوبي أقول إيه؟')],
    ['Keeps the one form the conversation already uses (grammatical masculine) through the whole reply', 'Useful, honest framing for the weaknesses question', 'FAIL if it switches between masculine and feminine within the reply or against the earlier reply']),
  personal('fast-golden-cp3c-gender-correction', 'ar', ['NATURALNESS', 'PERSONALITY_CONSISTENCY', 'MULTI_TURN_TRANSITION', 'NEGATIVE_CONTROL'],
    [...INTERVIEW_OPENING, user('على فكرة أنا بنت 😅 طب لو سألوني عن عيوبي أقول إيه؟')],
    ['Adapts at once to the correction: feminine address through the whole reply, without fuss or a long apology', 'Useful answer to the question', 'FAIL if any masculine address to her remains, it mixes forms, or it dwells on the correction']),
  personal('fast-golden-cp3c-gender-new-info', 'ar', ['NATURALNESS', 'PERSONALITY_CONSISTENCY', 'MULTI_TURN_TRANSITION', 'NEGATIVE_CONTROL'],
    [
      user('نفسي أنظّم وقتي أحسن، الأيام بتجري ومفيش حاجة بتخلص'),
      assistant('ابدأ بحاجة بسيطة: اكتب كل يوم الصبح أهم تلات حاجات لازم يخلصوا، واعملهم الأول قبل أي حاجة تانية.'),
      user('المشكلة إني أم لتلات عيال وكمان بشتغل من البيت، فاليوم بيتقطع طول الوقت'),
    ],
    ['Adapts to what her own words now show (a mother): feminine address through the whole reply, consistently', 'Practical for a day that keeps being interrupted', 'FAIL if it keeps masculine address to her, mixes forms, or comments on the switch']),
];

/** The 44 acceptance cases on their production route: 19 reused by reference, then the 25 new ones. */
export const GOLDEN_CP3_CORRECTION_SUITE: ReadonlyArray<BrainEvaluationCase> = [
  ...CP3C_REUSED_CASE_IDS.map((id) => {
    const found = GOLDEN_CP3_QUALIFICATION_CASES.find((testCase) => testCase.id === id);
    if (found === undefined) throw new Error(`CP3 correction: ${id} is not an existing Personal Golden case.`);
    return found;
  }),
  ...CP3C_NEW_CASES.map(onProductionRoute),
];
