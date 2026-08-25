import { Injectable } from '@nestjs/common';
import type { ModelRouterContextMessage } from '../model-router/model-router.types';
import type { SafetyCategory, SafetyResponseGate, SafetyResponseGateResult } from './safety-response-gate.types';

type Language = 'ar' | 'en';

const RESPONSES: Record<Exclude<SafetyCategory, 'NONE'>, Record<Language, string>> = {
  SELF_HARM_OR_SUICIDE: {
    en: "I can't help with ways to harm yourself. If you may act now, move away from anything you could use and contact local emergency services or a trusted person who can stay with you right now.",
    ar: 'مش هقدر أساعد في طرق لإيذاء نفسك. لو ممكن تنفّذ دلوقتي، ابعد عن أي حاجة ممكن تستخدمها واتصل بالطوارئ المحلية أو بشخص موثوق يفضل معاك حالًا.',
  },
  VIOLENCE_OR_HARM_TO_OTHERS: {
    en: "I can't help plan or carry out serious harm. Step away from weapons and the person involved; if anyone is in immediate danger, contact local emergency services. I can help you de-escalate safely.",
    ar: 'مش هقدر أساعد في التخطيط لإيذاء حد أو تنفيذه. ابعد عن أي سلاح وعن الشخص المعني، ولو في خطر فوري اتصل بالطوارئ المحلية. أقدر أساعدك تهدّي الموقف بأمان.',
  },
  SEXUAL_CONTENT_MINOR: {
    en: "I can't help create, find, or sexualize content involving minors.",
    ar: 'مش هقدر أساعد في إنشاء أو إيجاد أو وصف محتوى جنسي يتعلق بقاصرين.',
  },
  SEVERE_ILLEGAL_ACTIONABLE_HARM: {
    en: "I can't provide instructions that enable serious harm or wrongdoing. I can help with lawful, preventive, or safety-focused alternatives.",
    ar: 'مش هقدر أقدّم تعليمات تمكّن ضررًا جسيمًا أو جريمة. أقدر أساعد ببدائل قانونية أو وقائية تركّز على الأمان.',
  },
  HIGH_STAKES_MEDICAL_CRISIS: {
    en: "This may be a medical emergency. Contact local emergency services or seek urgent in-person medical care now; don't wait for an online diagnosis.",
    ar: 'دي ممكن تكون حالة طبية طارئة. اتصل بالطوارئ المحلية أو اطلب رعاية طبية عاجلة حضوريًا دلوقتي، وما تستناش تشخيصًا أونلاين.',
  },
};

// Deterministic response when the user asks Qandeel to enable another person's death or
// self-harm. It never assumes the current user is the suicidal actor, and never provides means.
const THIRD_PARTY_FACILITATION_RESPONSES: Record<Language, string> = {
  en: "I can't help with ways to end or harm someone's life. If they may act soon, contact local emergency services now and encourage them to talk with a crisis line or a professional. I can help you find safe, supportive ways to be there for them.",
  ar: 'مش هقدر أساعد في طرق تنهي أو تأذي حياة حد. لو ممكن ينفّذ قريب، اتصل بالطوارئ المحلية حالًا وشجّعه يتكلم مع متخصص أو خط مساعدة. أقدر أساعدك تلاقي طرق آمنة تكون جنبه بيها.',
};

export const SELF_HARM_GUIDANCE = [
  'Respond supportively and concisely to a credible non-imminent self-harm disclosure.',
  'Ask at most one direct question about current or immediate safety and encourage appropriate human or professional support.',
  'Do not diagnose or provide methods, optimization, concealment, or encouragement. Avoid canned crisis language.',
].join('\n');

export const AMBIGUOUS_SAFETY_GUIDANCE = [
  'The wording may be figurative or may indicate real self-harm risk; do not assume either meaning.',
  'Respond naturally and ask at most one focused clarification about whether the user could actually harm themself.',
  'Do not use canned crisis language or provide harmful methods. Escalate only if the user confirms real or current danger.',
].join('\n');

export const THIRD_PARTY_SUPPORT_GUIDANCE = [
  'The user is seeking help for another person who may be at risk of self-harm; the user themself has not expressed self-harm intent.',
  'Respond to the user as a supporter: acknowledge the situation, offer concrete supportive steps, and encourage involving professional or crisis resources for the at-risk person, urgently if that person may act soon.',
  "Ask at most one focused question about the other person's immediate safety. Do not address the user as if they were personally suicidal, and never provide methods, means, or encouragement of self-harm.",
].join('\n');

const ARABIC = /[؀-ۿ]/;
const METHOD_SEEKING = /\b(?:how (?:can|do|would) i|ways? to|best (?:way|method)|methods? (?:to|for)|instructions? (?:to|for)|step[ -]by[ -]step)\b|(?:ازاي|إزاي|كيف|إيه أفضل طريقة|ايه افضل طريقة|أفضل طريقة|افضل طريقة|طريقة|طرق|خطوات|تعليمات)/i;
const SELF_HARM_ACTION = /\b(?:kill(?:ing)? myself|end(?:ing)? my life|commit(?:ting)? suicide|hurt(?:ing)? myself|harm(?:ing)? myself|cut(?:ting)? myself|overdos(?:e|ing))\b|(?:أ?قتل نفسي|هقتل نفسي|أ?نتحر|هنتحر|أنهي حياتي|انهي حياتي|هأنهي حياتي|أؤذي نفسي|اؤذي نفسي|أأذي نفسي|اأذي نفسي|أجرح نفسي|اجرّح نفسي|جرح نفسي|أقطع شراييني|اقطع شراييني|جرعة زائدة)/i;
const SUICIDE_TOPIC = /\b(?:suicide|suicidal)\b|(?:انتحار|الانتحار|انتحاري|انتحارية)/i;
const DECIDED_INTENT = /\b(?:i (?:decided|intend|plan|am going|will)|i'm going|i've decided|going to|about to)\b|(?:أنا قررت|انا قررت|قررت|ناوي|ناوية|هنتحر|هقتل نفسي|هأنهي حياتي|هأذي نفسي)/i;
const IMMINENT_TIME = /\b(?:right now|tonight|today|immediately|about to|on my way|going there now)\b|(?:دلوقتي|الآن|الان|النهارده|الليلة|حالًا|حالا|رايحله|رايح لها|في الطريق)/i;
const HARM_MEANS = /\b(?:have|got|with|using)\b[\s\S]{0,30}\b(?:pills?|gun|knife|rope|weapon|poison)\b|(?:معايا|معي|باستخدام|عندي)[\s\S]{0,25}(?:حبوب|مسدس|سكينة|سكين|حبل|سلاح|سم)/i;
const NON_IMMINENT_DISCLOSURE = /\b(?:sometimes|lately|been thinking|thinking about|thoughts? of|urge(?:s)? to|want to)\b|(?:ساعات|أحيانًا|احيانا|مؤخرًا|مؤخرا|بفكر|أفكر|افكر|عندي أفكار|عندي رغبة|عايز|عاوز)/i;
const AMBIGUOUS_SELF_HARM = /\b(?:could kill myself|wanted to kill myself|nearly killed myself)\b|(?:كنت هولع في نفسي|هولع في نفسي|كنت عايز أقتل نفسي|كنت عاوز اقتل نفسي|هموت نفسي)/i;
const CLEAR_FIGURATIVE_IDIOM = /\b(?:nearly died laughing|dying (?:of|from) laughter)\b|(?:هموت نفسي من الضحك|هموت من الضحك|هيموت من الضحك|يموت من الضحك|تموت من الضحك|موتني من الضحك)/i;
const VIOLENT_ACTION = /\b(?:kill|murder|shoot|stab|poison|attack|seriously hurt)\b|(?:أ?قتل|هقتل|أضربه بالنار|اضربه بالنار|هضربه بالنار|أطعنه|اطعنه|هطعنه|أسممه|اسممه|هسممه|أهاجم|اهاجم|ههاجم|أؤذيه بشدة|اؤذيه بشدة)/i;
const VIOLENT_INTENT = /\b(?:want to|intend to|plan to|going to|will|decided to|seriously hurt)\b|(?:عايز|عاوز|ناوي|ناوية|هقتل|هطعنه|هسممه|ههاجم|قررت)/i;
const EVASION_OR_PLANNING = /\b(?:without getting caught|undetected|hide (?:the )?(?:body|evidence)|where to aim|plan (?:an|the)? attack|how do i do it)\b|(?:من غير ما اتمسك|بدون ما أتمسك|من غير ما ينكشف|أخفي الجثة|اخفي الجثة|أخفي الدليل|اخفي الدليل|أصوب فين|اصوب فين|أخطط للهجوم|اخطط للهجوم|اعملها ازاي|أعملها إزاي)/i;
const INCOMPLETE_HARM_FOLLOW_UP = /\b(?:best method|what methods?|how do i do it|how can i do it|without getting caught|what should i use)\b|(?:أفضل طريقة|افضل طريقة|إيه الطريقة|ايه الطريقة|أعملها إزاي|اعملها ازاي|من غير ما اتمسك|أستخدم إيه|استخدم ايه)/i;
const MINOR = /\b(?:child|children|kid|minor|underage|teen(?:ager)?|(?:1[0-7]|[0-9])[ -]?year[ -]?old)\b|(?:طفل|طفلة|أطفال|اطفال|قاصر|قاصرة|تحت السن|مراهق|مراهقة|عمره \d{1,2}|عمرها \d{1,2})/i;
const SEXUAL = /\b(?:sex|sexual|nude|naked|porn|erotic|explicit (?:photo|image|video|scene))\b|(?:جنس|جنسي|جنسية|عاري|عارية|عراة|إباحي|اباحي|فاضح|فاضحة|مشهد مثير)/i;
const CREATION_OR_REQUEST = /\b(?:write|create|make|generate|draw|show|find|send|describe|give me|tell me)\b|(?:اكتب|أنشئ|انشئ|اعمل|ارسم|وريني|ابعت|اوصف|صف|هات|اديني|قل لي)/i;
// Credential clause requires an acquisition/operational verb; grammatical person (attacker/hacker)
// deliberately plays no role, so third-person operational requests remain blocked while purely
// defensive explanations ("how password managers protect credentials") are not isolated-keyword hits.
const ILLEGAL_HARM = /\b(?:build|make|create|give|write|explain)\b[\s\S]{0,30}\b(?:bomb|explosive)\b|\b(?:write|create|deploy|spread|give)\b[\s\S]{0,50}\b(?:ransomware|destructive malware)\b|\b(?:steal(?:s|ing)?|hack(?:s|ing)?|crack(?:s|ing)?|phish(?:es|ing)?|intercept(?:s|ing)?|bypass(?:es|ing)?|dump(?:s|ing)?|exfiltrat\w*|obtain(?:s|ing)?)\b[\s\S]{0,50}\b(?:credential(?:s)?|password(?:s)?)\b|\b(?:poison|toxin)\b[\s\S]{0,70}\b(?:instructions?|steps?|recipe|undetected|without (?:being )?detected|evade)\b|\b(?:instructions?|steps?|step[ -]by[ -]step|recipe)\b[\s\S]{0,70}\b(?:bomb|explosive|ransomware|destructive malware|credential theft|poison|toxin)\b|(?:اصنع|أصنع|اعمل|اشرح|اديني)[\s\S]{0,50}(?:قنبلة|متفجرات|برمجية خبيثة|فدية|سرقة كلمات مرور|سم|مادة سامة)|(?:خطوات|تعليمات|طريقة)[\s\S]{0,70}(?:قنبلة|متفجرات|برمجية خبيثة|فدية|سرقة كلمات المرور|تسميم)/i;
const MEDICAL_EMERGENCY = /\b(?:can't breathe|cannot breathe|severe chest pain|signs? of (?:a )?stroke|face droop|severe bleeding|won't stop bleeding|unconscious|not breathing|anaphylaxis|severe allergic reaction|overdos(?:e|ed)|seizure)\b|(?:مش قادر أتنفس|مش قادرة أتنفس|لا أستطيع التنفس|ألم شديد في الصدر|الم شديد في الصدر|علامات جلطة|نزيف شديد|النزيف مش بيقف|فاقد الوعي|لا يتنفس|حساسية شديدة|جرعة زائدة|تشنجات|تشنج)/i;
const ACUTE_PERSON_CONTEXT = /\b(?:i have|i'm having|i am having|my |he is|he's|she is|she's|they are|they're|someone is|right now|just )\b|(?:عندي|عنده|عندها|معايا|معاه|معاها|أنا|انا|هو |هي |دلوقتي|الآن|الان|حالًا|حالا|جاله|جالها|ابني|بنتي)/i;
const INFORMATIONAL_FRAME = /\b(?:history|historical|research|news|reported|documentary|fiction|fictional|novel|movie|film|video game|game boss|prevention)\b|(?:تاريخ|تاريخي|تاريخية|بحث|الأخبار|الاخبار|خبر|وثائقي|خيالي|خيالية|رواية|فيلم|لعبة|في اللعبة|وقاية)/i;
const SAFETY_OR_PREVENTION_FRAME = /\b(?:bomb shelters?|bomb disposal|explosive detection|malware prevention|ransomware defense|credential theft prevention)\b|(?:ملجأ قنابل|التخلص من القنابل|كشف المتفجرات|منع البرمجيات الخبيثة|الحماية من الفدية)/i;

// --- Medical temporality (v2). A clearly past-bound event may release the medical block only
// when nothing marks the state as current: acute facts outrank benign framing, never the reverse.
const MEDICAL_PAST_BOUND = /\b(?:last (?:year|month|week)|years? ago|months? ago|weeks? ago|when (?:i|he|she|they) (?:was|were)|used to have)\b|(?:من سنة|من سنه|من سنتين|من شهر|من شهرين|من أسبوع|من اسبوع|السنة اللي فاتت|قبل سنة|قبل سنه|قبل شهر|وهو صغير|وهي صغيرة|زمان)/i;
const MEDICAL_ONGOING_STATE = /\b(?:is|are|am|'s)\s+(?:still\s+)?(?:unconscious|not breathing|bleeding|seizing|having (?:a )?seizure)\b|\bstill\s+(?:unconscious|not breathing|bleeding)\b|\bwon't stop\b|\bright now\b|(?:لسه|لسة|ما زال|مازال|لا يزال)\s*(?:فاقد الوعي|مغمى عليه|مش بيتنفس|لا يتنفس|بينزف)|النزيف مش بيقف|دلوقتي|حالًا|حالا/i;

// --- Actor attribution (v2). These surfaces exist so the semantic actor of self-harm language
// can be distinguished before method interpretation. None of them is a standalone allow-list:
// protective framing only matters when facilitation and direct-user signals are absent.
const THIRD_PARTY_PERSON = /\b(?:my|our)\s+(?:best )?(?:friend|brother|sister|mom|mother|dad|father|son|daughter|husband|wife|cousin|colleague|coworker|classmate|roommate|neighbou?r|mate)\b|\b(?:someone|somebody|a friend(?: of mine)?)\b|(?:صاحبي|صاحبتي|أخويا|اخويا|أختي|اختي|ابني|بنتي|جوزي|مراتي|زميلي|زميلتي|واحد صاحبي|حد قريب مني|حد أعرفه|حد اعرفه)/i;
const THIRD_PERSON_RISK_STATE = /\b(?:suicidal|thinking about (?:suicide|killing (?:him|her|them)sel(?:f|ves))|wants? to die|wants? to kill (?:him|her|them)sel(?:f|ves)|kill(?:s|ing)? (?:him|her|them)sel(?:f|ves)|hurt(?:s|ing)? (?:him|her)self|end(?:s|ing)? (?:his|her|their) (?:own )?life|from committing suicide|(?:he|she|they)\s+(?:can|could|will|would|wants? to)\s*die)\b|(?:بيفكر في الانتحار|بتفكر في الانتحار|عايز يموت|عاوز يموت|عايزة تموت|هينتحر|ينتحر|تنتحر|هيقتل نفسه|يقتل نفسه|تقتل نفسها|يأذي نفسه|يؤذي نفسه|ينهي حياته|هينهي حياته|يجرح نفسه|يموت|تموت|هيموت)/i;
const PROTECTIVE_REQUEST = /\b(?:what (?:should|can|do) i (?:say|tell|do)|how (?:do|can|should) i (?:help|support|talk|be there|respond|reply|approach|reach)|help(?:ing)?|support(?:ing)?|talk to (?:him|her|them)|warning signs?|watch (?:for|out)|look out for|convince (?:him|her|them)|encourage (?:him|her|them)|stop (?:him|her|them)|keep (?:him|her|them) safe|get (?:him|her|them) (?:help|to a (?:doctor|hospital|therapist|counsell?or))|take (?:him|her|them) to|de-?escalat)/i;
const PROTECTIVE_REQUEST_AR = /(?:أساعد|اساعد|أساعده|اساعده|أساعدها|اساعدها|أدعم|ادعم|أدعمه|ادعمه|أتكلم مع|اتكلم مع|أقول له|اقول له|أقوله|اقوله|أقولها|اقولها|أطمنه|اطمنه|أطمنها|أتصرف|اتصرف|أعمل إيه|اعمل ايه|أعمل ايه|اعمل إيه|علامات الخطر|علامات التحذير|آخد بالي|أخد بالي|اخد بالي|أنقذه|انقذه|أحميه|احميه|أمنعه|امنعه|أوقفه|اوقفه)/;
// Facilitation spans are "tempered": between the enabling verb and the death verb no relative-clause,
// speech, or negation marker may appear, so "help my friend who says he wants to die" stays protective
// while "help my friend die" does not.
const FACILITATION_REQUEST = new RegExp(
  [
    String.raw`\b(?:help|support|assist)\b(?:(?!\b(?:who|that|says?|said|not|stop|from)\b)[^.?!؟\n]){0,45}\b(?:die|kill (?:him|her|them)sel(?:f|ves)|end (?:his|her|their) life|commit suicide)\b`,
    String.raw`\b(?:pills?|drugs?|poison)\b[^.?!؟\n]{0,45}\b(?:give|slip|hand)\b|\b(?:give|slip|hand)\b[^.?!؟\n]{0,45}\b(?:pills?|drugs?|poison)\b`,
    String.raw`\b(?:what|which)\s+(?:method|way|pills?|drugs?)s?\b[^.?!؟\n]{0,60}\b(?:him|her|them)\b(?![^.?!؟\n]{0,25}\b(?:get|seek|find)\s+help\b)`,
    String.raw`\b(?:most effective|fastest|quickest|easiest|best|painless)\s+(?:way|method)s?\b(?![^.?!؟\n]{0,35}\b(?:to|of)\s+(?:help|support|talk|convinc|calm|stop|get|reach|approach))`,
    String.raw`\btell (?:him|her|them)\b[^.?!؟\n]{0,30}\b(?:use|take|method)\b`,
  ].join('|'),
  'i',
);
const FACILITATION_REQUEST_AR = new RegExp(
  [
    '(?:أساعد|اساعد|ساعد|أدعم|ادعم)(?:(?!اللي|إللي|بيقول|قال|عشان ما|علشان ما|مش|ما )[\\s\\S]){0,30}(?:يموت|تموت|ينتحر|تنتحر|ينهي حياته|يقتل نفسه)',
    '(?:أقوله|اقوله|أقول له|اقول له|أقولها|اقولها)[\\s\\S]{0,15}(?:يستخدم|تستخدم|ياخد|تاخد|يعمل)',
    '(?:يستخدم|تستخدم|ياخد|تاخد)\\s*(?:إيه|ايه)',
    '(?:أديله|اديله|أجيبله|اجيبله|أديلها|اديلها)',
    '(?:من غير ما حد يلحقه|قبل ما حد يلحقه|من غير ما حد يعرف|أسرع طريقة|اسرع طريقة)',
  ].join('|'),
  'u',
);
// Removing these third-person constructions before first-person analysis prevents "he wants to
// kill himself" or Arabic "ينتحر" from masquerading as the user's own self-harm statement.
const THIRD_PERSON_SELF_HARM_PHRASES = /\b(?:kill(?:s|ing)? (?:him|her|them)sel(?:f|ves)|end(?:s|ing)? (?:his|her|their) (?:own )?life|hurt(?:s|ing)? (?:him|her)self|wants? to die|from committing suicide|(?:he|she|they)\s+(?:can|could|will|would)\s*die)\b|(?:هينتحر|ينتحر|تنتحر|هيقتل نفسه|يقتل نفسه|تقتل نفسها|يأذي نفسه|يؤذي نفسه|ينهي حياته|هينهي حياته|يجرح نفسه|عايز يموت|عاوز يموت|عايزة تموت)/gi;
// Bounded euphemisms that count as risk evidence when they appear inside reported speech.
const QUOTED_RISK_EUPHEMISM = /\bend it(?: all)?\b|\b(?:i )?(?:can'?t|cannot) go on\b|(?:أرتاح من الدنيا|أخلص من نفسي|خلاص هرتاح|عايز أرتاح خلاص|هخلص على نفسي)/i;
const QUOTED_SPEECH = /"[^"\n]{1,300}"|“[^”\n]{1,300}”|«[^»\n]{1,300}»/g;
const THIRD_PARTY_SPEAKER = /(?:\b(?:my|our)\s+(?:best )?(?:friend|brother|sister|mom|mother|dad|father|son|daughter|husband|wife|cousin|colleague|coworker|classmate|roommate|neighbou?r|mate)\b|\b(?:he|she|they|someone|somebody)\b|(?:صاحبي|صاحبتي|أخويا|اخويا|أختي|اختي|ابني|بنتي|جوزي|مراتي|زميلي|زميلتي))[\s\S]{0,30}(?:\b(?:said|says|texted|told\s+(?:me|us)|wrote|messaged|sent|posted)\b|(?:قال|قالت|قالوا|بعت|بعتت|كتب|كتبت|باعت))(?:\s*(?:لي|لنا|me|to me|:|,))?\s*$/i;
// Arabic بعت/كتبت are person-ambiguous in written Egyptian; the self reading requires an explicit
// first-person marker, while bare قلت is unambiguously first person.
const SELF_SPEAKER = /\b[Ii]\s+(?:said|told|texted|wrote|messaged|sent)\b[\s\S]{0,30}$|(?:أنا\s+|انا\s+)(?:قلت|بعت|كتبت)(?:\s*ل\S+)?[\s\S]{0,15}$|قلت(?:\s*ل\S+)?[\s\S]{0,15}$/;

interface SelfHarmActorFrame {
  // currentTurn with third-party-attributed quote contents removed
  dequoted: string;
  // dequoted with third-person self-harm phrasing removed (first-person analysis surface)
  firstPersonSurface: string;
  quotedThirdPartyRisk: boolean;
}

@Injectable()
export class SafetyResponseGateService implements SafetyResponseGate {
  evaluate(currentTurn: string, context: ReadonlyArray<ModelRouterContextMessage>): SafetyResponseGateResult {
    const language: Language = ARABIC.test(currentTurn) ? 'ar' : 'en';
    const block = (category: Exclude<SafetyCategory, 'NONE'>): SafetyResponseGateResult => ({
      category, disposition: 'BLOCK', deterministicResponse: RESPONSES[category][language],
    });
    const blockThirdPartyFacilitation = (): SafetyResponseGateResult => ({
      category: 'SELF_HARM_OR_SUICIDE', disposition: 'BLOCK',
      deterministicResponse: THIRD_PARTY_FACILITATION_RESPONSES[language],
    });

    // Medical crisis first: current acute facts outrank every benign frame. A clearly past-bound
    // event releases the block only when no marker presents the state as current or ongoing.
    if (MEDICAL_EMERGENCY.test(currentTurn) && ACUTE_PERSON_CONTEXT.test(currentTurn)) {
      const historicallyResolved =
        MEDICAL_PAST_BOUND.test(currentTurn) &&
        !IMMINENT_TIME.test(currentTurn) &&
        !MEDICAL_ONGOING_STATE.test(currentTurn);
      if (!historicallyResolved) return block('HIGH_STAKES_MEDICAL_CRISIS');
    }

    const frame = this.buildSelfHarmActorFrame(currentTurn);
    const firstPersonRisk = SELF_HARM_ACTION.test(frame.firstPersonSurface);
    const methodSeeking = METHOD_SEEKING.test(frame.dequoted);
    const thirdPartyAtRisk =
      frame.quotedThirdPartyRisk ||
      (THIRD_PARTY_PERSON.test(frame.dequoted) && THIRD_PERSON_RISK_STATE.test(frame.dequoted)) ||
      (THIRD_PARTY_PERSON.test(frame.dequoted) && SUICIDE_TOPIC.test(frame.dequoted) && !INFORMATIONAL_FRAME.test(frame.dequoted));
    const protectiveRequest = PROTECTIVE_REQUEST.test(frame.dequoted) || PROTECTIVE_REQUEST_AR.test(frame.dequoted);
    const facilitationRequest = FACILITATION_REQUEST.test(frame.dequoted) || FACILITATION_REQUEST_AR.test(frame.dequoted);
    const suicideTopicAnywhere =
      SUICIDE_TOPIC.test(currentTurn) || SELF_HARM_ACTION.test(currentTurn) ||
      THIRD_PERSON_RISK_STATE.test(currentTurn) || frame.quotedThirdPartyRisk;

    // 1) Direct user intent with imminence or means.
    if (
      firstPersonRisk && DECIDED_INTENT.test(frame.firstPersonSurface) &&
      (IMMINENT_TIME.test(frame.dequoted) || HARM_MEANS.test(frame.firstPersonSurface))
    ) {
      return block('SELF_HARM_OR_SUICIDE');
    }
    // 2) Direct user method-seeking, or generic suicide method-seeking not bound to a third party.
    if (methodSeeking && (firstPersonRisk || (SUICIDE_TOPIC.test(frame.dequoted) && !thirdPartyAtRisk))) {
      return block('SELF_HARM_OR_SUICIDE');
    }
    // 3) Facilitation of another person's death is blocked regardless of helper framing.
    if (thirdPartyAtRisk && facilitationRequest) {
      return blockThirdPartyFacilitation();
    }
    // 4) Quotes are not an escape hatch: a method-flavored follow-up against risk content that
    //    only appeared inside an attributed quote still fails closed unless the request itself
    //    is protective. The narrow follow-up surface (not broad question phrasing) is deliberate
    //    so unlisted supportive questions are not swallowed by this rule.
    if (INCOMPLETE_HARM_FOLLOW_UP.test(frame.dequoted) && suicideTopicAnywhere && thirdPartyAtRisk && !protectiveRequest) {
      return blockThirdPartyFacilitation();
    }

    const meansAndTiming = HARM_MEANS.test(currentTurn) && IMMINENT_TIME.test(currentTurn);
    if (
      VIOLENT_ACTION.test(frame.firstPersonSurface) &&
      (EVASION_OR_PLANNING.test(currentTurn) || meansAndTiming || (METHOD_SEEKING.test(currentTurn) && VIOLENT_INTENT.test(frame.firstPersonSurface)))
    ) {
      return block('VIOLENCE_OR_HARM_TO_OTHERS');
    }
    if (MINOR.test(currentTurn) && SEXUAL.test(currentTurn) && CREATION_OR_REQUEST.test(currentTurn)) {
      return block('SEXUAL_CONTENT_MINOR');
    }
    if (!SAFETY_OR_PREVENTION_FRAME.test(currentTurn) && ILLEGAL_HARM.test(currentTurn)) {
      return block('SEVERE_ILLEGAL_ACTIONABLE_HARM');
    }

    const contextual = this.contextualCategory(currentTurn, context);
    if (contextual === 'THIRD_PARTY_FACILITATION') return blockThirdPartyFacilitation();
    if (contextual) return block(contextual);

    // 5) Third-party support or reported third-party crisis: guide as a supporter, never as if
    //    the user were the suicidal actor.
    if (thirdPartyAtRisk && !CLEAR_FIGURATIVE_IDIOM.test(currentTurn)) {
      return { category: 'SELF_HARM_OR_SUICIDE', disposition: 'GUIDED', safetyGuidance: THIRD_PARTY_SUPPORT_GUIDANCE };
    }
    // 6) First-person non-imminent disclosure and ambiguous first-person wording.
    if (firstPersonRisk && NON_IMMINENT_DISCLOSURE.test(frame.firstPersonSurface) && !CLEAR_FIGURATIVE_IDIOM.test(currentTurn)) {
      return { category: 'SELF_HARM_OR_SUICIDE', disposition: 'GUIDED', safetyGuidance: SELF_HARM_GUIDANCE };
    }
    if (AMBIGUOUS_SELF_HARM.test(frame.firstPersonSurface) && !DECIDED_INTENT.test(frame.firstPersonSurface) && !CLEAR_FIGURATIVE_IDIOM.test(currentTurn)) {
      return { category: 'SELF_HARM_OR_SUICIDE', disposition: 'GUIDED', safetyGuidance: AMBIGUOUS_SAFETY_GUIDANCE };
    }
    return { category: 'NONE', disposition: 'ALLOW' };
  }

  // Splits third-party-attributed quoted speech out of the first-person analysis surface while
  // keeping self-attributed and unattributed quotes (fail closed: unattributed quoted words are
  // treated as the user's own). Quote contents still count as topic/risk evidence.
  private buildSelfHarmActorFrame(currentTurn: string): SelfHarmActorFrame {
    let dequoted = '';
    let lastIndex = 0;
    let quotedThirdPartyRisk = false;
    const scanner = new RegExp(QUOTED_SPEECH.source, 'g');
    for (let match = scanner.exec(currentTurn); match !== null; match = scanner.exec(currentTurn)) {
      const before = currentTurn.slice(Math.max(0, match.index - 60), match.index);
      const selfAttributed = SELF_SPEAKER.test(before);
      const thirdPartyAttributed = !selfAttributed && THIRD_PARTY_SPEAKER.test(before);
      dequoted += currentTurn.slice(lastIndex, match.index);
      if (thirdPartyAttributed) {
        const inner = match[0].slice(1, -1);
        if (
          SELF_HARM_ACTION.test(inner) || SUICIDE_TOPIC.test(inner) || HARM_MEANS.test(inner) ||
          DECIDED_INTENT.test(inner) || QUOTED_RISK_EUPHEMISM.test(inner)
        ) {
          quotedThirdPartyRisk = true;
        }
        dequoted += '""';
      } else {
        dequoted += match[0];
      }
      lastIndex = match.index + match[0].length;
    }
    dequoted += currentTurn.slice(lastIndex);
    const firstPersonSurface = dequoted.replace(new RegExp(THIRD_PERSON_SELF_HARM_PHRASES.source, 'gi'), ' ');
    return { dequoted, firstPersonSurface, quotedThirdPartyRisk };
  }

  private contextualCategory(
    currentTurn: string,
    context: ReadonlyArray<ModelRouterContextMessage>,
  ): 'SELF_HARM_OR_SUICIDE' | 'VIOLENCE_OR_HARM_TO_OTHERS' | 'THIRD_PARTY_FACILITATION' | undefined {
    if (!INCOMPLETE_HARM_FOLLOW_UP.test(currentTurn) || INFORMATIONAL_FRAME.test(currentTurn)) return undefined;

    const priorUserTurns = context.slice(0, -1)
      .filter((message) => message.role === 'USER' && message.content !== currentTurn)
      .map((message) => message.content)
      .reverse();
    const mostRecentRelevant = priorUserTurns.find((content) =>
      SELF_HARM_ACTION.test(content) || SUICIDE_TOPIC.test(content) || THIRD_PERSON_RISK_STATE.test(content) ||
      VIOLENT_ACTION.test(content) || INFORMATIONAL_FRAME.test(content),
    );
    if (!mostRecentRelevant || INFORMATIONAL_FRAME.test(mostRecentRelevant)) return undefined;

    // Prior third-party risk (support or otherwise) + a method-seeking follow-up fails closed as
    // facilitation, without reinterpreting the user as the suicidal actor.
    const priorFrame = this.buildSelfHarmActorFrame(mostRecentRelevant);
    const priorThirdParty =
      priorFrame.quotedThirdPartyRisk ||
      (THIRD_PARTY_PERSON.test(priorFrame.dequoted) &&
        (THIRD_PERSON_RISK_STATE.test(priorFrame.dequoted) || SUICIDE_TOPIC.test(priorFrame.dequoted)));
    const priorFirstPerson = SELF_HARM_ACTION.test(priorFrame.firstPersonSurface);
    if (priorThirdParty && !priorFirstPerson) return 'THIRD_PARTY_FACILITATION';
    if (priorFirstPerson && (DECIDED_INTENT.test(priorFrame.firstPersonSurface) || NON_IMMINENT_DISCLOSURE.test(priorFrame.firstPersonSurface))) {
      return 'SELF_HARM_OR_SUICIDE';
    }
    if (VIOLENT_ACTION.test(mostRecentRelevant) && VIOLENT_INTENT.test(mostRecentRelevant)) {
      return 'VIOLENCE_OR_HARM_TO_OTHERS';
    }
    return undefined;
  }
}
