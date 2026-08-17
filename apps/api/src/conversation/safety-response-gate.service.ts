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

const ARABIC = /[\u0600-\u06ff]/;
const METHOD_SEEKING = /\b(?:how (?:can|do|would) i|ways? to|best (?:way|method)|methods? (?:to|for)|instructions? (?:to|for)|step[ -]by[ -]step)\b|(?:ازاي|إزاي|كيف|إيه أفضل طريقة|ايه افضل طريقة|أفضل طريقة|افضل طريقة|طريقة|طرق|خطوات|تعليمات)/i;
const SELF_HARM_ACTION = /\b(?:kill(?:ing)? myself|end(?:ing)? my life|commit(?:ting)? suicide|hurt(?:ing)? myself|harm(?:ing)? myself|cut(?:ting)? myself|overdos(?:e|ing))\b|(?:أ?قتل نفسي|هقتل نفسي|أ?نتحر|هنتحر|أنهي حياتي|انهي حياتي|هأنهي حياتي|أؤذي نفسي|اؤذي نفسي|أأذي نفسي|اأذي نفسي|أجرح نفسي|اجرّح نفسي|جرح نفسي|أقطع شراييني|اقطع شراييني|جرعة زائدة)/i;
const SUICIDE_TOPIC = /\b(?:suicide|suicidal)\b|(?:انتحار|الانتحار|انتحاري|انتحارية)/i;
const DECIDED_INTENT = /\b(?:i (?:decided|intend|plan|am going|will)|i'm going|i've decided|going to|about to)\b|(?:أنا قررت|انا قررت|قررت|ناوي|ناوية|هنتحر|هقتل نفسي|هأنهي حياتي|هأذي نفسي)/i;
const IMMINENT_TIME = /\b(?:right now|tonight|today|immediately|about to|on my way|going there now)\b|(?:دلوقتي|الآن|الان|النهارده|الليلة|حالًا|حالا|رايحله|رايح لها|في الطريق)/i;
const HARM_MEANS = /\b(?:have|got|with|using)\b[\s\S]{0,30}\b(?:pills?|gun|knife|rope|weapon|poison)\b|(?:معايا|معي|باستخدام|عندي)[\s\S]{0,25}(?:حبوب|مسدس|سكينة|سكين|حبل|سلاح|سم)/i;
const NON_IMMINENT_DISCLOSURE = /\b(?:sometimes|lately|been thinking|thinking about|thoughts? of|urge(?:s)? to|want to)\b|(?:ساعات|أحيانًا|احيانا|مؤخرًا|مؤخرا|بفكر|أفكر|افكر|عندي أفكار|عندي رغبة|عايز|عاوز)/i;
const AMBIGUOUS_SELF_HARM = /\b(?:could kill myself|wanted to kill myself|nearly killed myself)\b|(?:كنت هولع في نفسي|هولع في نفسي|كنت عايز أقتل نفسي|كنت عاوز اقتل نفسي|هموت نفسي)/i;
const CLEAR_FIGURATIVE_IDIOM = /\b(?:nearly died laughing|dying (?:of|from) laughter)\b|(?:هموت نفسي من الضحك|هموت من الضحك|موتني من الضحك)/i;
const VIOLENT_ACTION = /\b(?:kill|murder|shoot|stab|poison|attack|seriously hurt)\b|(?:أ?قتل|هقتل|أضربه بالنار|اضربه بالنار|هضربه بالنار|أطعنه|اطعنه|هطعنه|أسممه|اسممه|هسممه|أهاجم|اهاجم|ههاجم|أؤذيه بشدة|اؤذيه بشدة)/i;
const VIOLENT_INTENT = /\b(?:want to|intend to|plan to|going to|will|decided to|seriously hurt)\b|(?:عايز|عاوز|ناوي|ناوية|هقتل|هطعنه|هسممه|ههاجم|قررت)/i;
const EVASION_OR_PLANNING = /\b(?:without getting caught|undetected|hide (?:the )?(?:body|evidence)|where to aim|plan (?:an|the)? attack|how do i do it)\b|(?:من غير ما اتمسك|بدون ما أتمسك|من غير ما ينكشف|أخفي الجثة|اخفي الجثة|أخفي الدليل|اخفي الدليل|أصوب فين|اصوب فين|أخطط للهجوم|اخطط للهجوم|اعملها ازاي|أعملها إزاي)/i;
const INCOMPLETE_HARM_FOLLOW_UP = /\b(?:best method|what methods?|how do i do it|how can i do it|without getting caught|what should i use)\b|(?:أفضل طريقة|افضل طريقة|إيه الطريقة|ايه الطريقة|أعملها إزاي|اعملها ازاي|من غير ما اتمسك|أستخدم إيه|استخدم ايه)/i;
const MINOR = /\b(?:child|children|kid|minor|underage|teen(?:ager)?|(?:1[0-7]|[0-9])[ -]?year[ -]?old)\b|(?:طفل|طفلة|أطفال|اطفال|قاصر|قاصرة|تحت السن|مراهق|مراهقة|عمره \d{1,2}|عمرها \d{1,2})/i;
const SEXUAL = /\b(?:sex|sexual|nude|naked|porn|erotic|explicit (?:photo|image|video|scene))\b|(?:جنس|جنسي|جنسية|عاري|عارية|عراة|إباحي|اباحي|فاضح|فاضحة|مشهد مثير)/i;
const CREATION_OR_REQUEST = /\b(?:write|create|make|generate|draw|show|find|send|describe|give me|tell me)\b|(?:اكتب|أنشئ|انشئ|اعمل|ارسم|وريني|ابعت|اوصف|صف|هات|اديني|قل لي)/i;
const ILLEGAL_HARM = /\b(?:build|make|create|give|write|explain)\b[\s\S]{0,30}\b(?:bomb|explosive)\b|\b(?:write|create|deploy|spread|give)\b[\s\S]{0,50}\b(?:ransomware|destructive malware)\b|\b(?:steal|hack|give|explain)\b[\s\S]{0,50}\b(?:credential(?:s)?|password(?:s)?)\b|\b(?:poison|toxin)\b[\s\S]{0,70}\b(?:instructions?|steps?|recipe|undetected|without (?:being )?detected|evade)\b|\b(?:instructions?|steps?|step[ -]by[ -]step|recipe)\b[\s\S]{0,70}\b(?:bomb|explosive|ransomware|destructive malware|credential theft|poison|toxin)\b|(?:اصنع|أصنع|اعمل|اشرح|اديني)[\s\S]{0,50}(?:قنبلة|متفجرات|برمجية خبيثة|فدية|سرقة كلمات مرور|سم|مادة سامة)|(?:خطوات|تعليمات|طريقة)[\s\S]{0,70}(?:قنبلة|متفجرات|برمجية خبيثة|فدية|سرقة كلمات المرور|تسميم)/i;
const MEDICAL_EMERGENCY = /\b(?:can't breathe|cannot breathe|severe chest pain|signs? of (?:a )?stroke|face droop|severe bleeding|won't stop bleeding|unconscious|not breathing|anaphylaxis|severe allergic reaction|overdos(?:e|ed)|seizure)\b|(?:مش قادر أتنفس|مش قادرة أتنفس|لا أستطيع التنفس|ألم شديد في الصدر|الم شديد في الصدر|علامات جلطة|نزيف شديد|النزيف مش بيقف|فاقد الوعي|لا يتنفس|حساسية شديدة|جرعة زائدة|تشنجات)/i;
const ACUTE_PERSON_CONTEXT = /\b(?:i have|i'm having|i am having|my |he is|he's|she is|she's|they are|they're|someone is|right now|just )\b|(?:عندي|عنده|عندها|معايا|معاه|معاها|أنا|انا|هو |هي |دلوقتي|الآن|الان|حالًا|حالا)/i;
const INFORMATIONAL_FRAME = /\b(?:history|historical|research|news|reported|documentary|fiction|fictional|novel|movie|film|video game|game boss|prevention)\b|(?:تاريخ|تاريخي|تاريخية|بحث|الأخبار|الاخبار|خبر|وثائقي|خيالي|خيالية|رواية|فيلم|لعبة|في اللعبة|وقاية)/i;
const SAFETY_OR_PREVENTION_FRAME = /\b(?:bomb shelters?|bomb disposal|explosive detection|malware prevention|ransomware defense|credential theft prevention)\b|(?:ملجأ قنابل|التخلص من القنابل|كشف المتفجرات|منع البرمجيات الخبيثة|الحماية من الفدية)/i;

@Injectable()
export class SafetyResponseGateService implements SafetyResponseGate {
  evaluate(currentTurn: string, context: ReadonlyArray<ModelRouterContextMessage>): SafetyResponseGateResult {
    const language: Language = ARABIC.test(currentTurn) ? 'ar' : 'en';
    const block = (category: Exclude<SafetyCategory, 'NONE'>): SafetyResponseGateResult => ({
      category, disposition: 'BLOCK', deterministicResponse: RESPONSES[category][language],
    });
    const explicitSelfHarm = SELF_HARM_ACTION.test(currentTurn);
    const methodSeeking = METHOD_SEEKING.test(currentTurn);
    const meansAndTiming = HARM_MEANS.test(currentTurn) && IMMINENT_TIME.test(currentTurn);

    if (MEDICAL_EMERGENCY.test(currentTurn) && ACUTE_PERSON_CONTEXT.test(currentTurn)) {
      return block('HIGH_STAKES_MEDICAL_CRISIS');
    }
    if (
      (explicitSelfHarm && DECIDED_INTENT.test(currentTurn) && (IMMINENT_TIME.test(currentTurn) || HARM_MEANS.test(currentTurn))) ||
      (methodSeeking && (explicitSelfHarm || SUICIDE_TOPIC.test(currentTurn)))
    ) {
      return block('SELF_HARM_OR_SUICIDE');
    }
    if (
      VIOLENT_ACTION.test(currentTurn) &&
      (EVASION_OR_PLANNING.test(currentTurn) || meansAndTiming || (methodSeeking && VIOLENT_INTENT.test(currentTurn)))
    ) {
      return block('VIOLENCE_OR_HARM_TO_OTHERS');
    }
    if (MINOR.test(currentTurn) && SEXUAL.test(currentTurn) && CREATION_OR_REQUEST.test(currentTurn)) {
      return block('SEXUAL_CONTENT_MINOR');
    }
    if (!SAFETY_OR_PREVENTION_FRAME.test(currentTurn) && ILLEGAL_HARM.test(currentTurn)) {
      return block('SEVERE_ILLEGAL_ACTIONABLE_HARM');
    }

    const contextualCategory = this.contextualCategory(currentTurn, context);
    if (contextualCategory) return block(contextualCategory);

    if (explicitSelfHarm && NON_IMMINENT_DISCLOSURE.test(currentTurn) && !CLEAR_FIGURATIVE_IDIOM.test(currentTurn)) {
      return { category: 'SELF_HARM_OR_SUICIDE', disposition: 'GUIDED', safetyGuidance: SELF_HARM_GUIDANCE };
    }
    if (AMBIGUOUS_SELF_HARM.test(currentTurn) && !DECIDED_INTENT.test(currentTurn) && !CLEAR_FIGURATIVE_IDIOM.test(currentTurn)) {
      return { category: 'SELF_HARM_OR_SUICIDE', disposition: 'GUIDED', safetyGuidance: AMBIGUOUS_SAFETY_GUIDANCE };
    }
    return { category: 'NONE', disposition: 'ALLOW' };
  }

  private contextualCategory(
    currentTurn: string,
    context: ReadonlyArray<ModelRouterContextMessage>,
  ): 'SELF_HARM_OR_SUICIDE' | 'VIOLENCE_OR_HARM_TO_OTHERS' | undefined {
    if (!INCOMPLETE_HARM_FOLLOW_UP.test(currentTurn) || INFORMATIONAL_FRAME.test(currentTurn)) return undefined;

    const priorUserTurns = context.slice(0, -1)
      .filter((message) => message.role === 'USER' && message.content !== currentTurn)
      .map((message) => message.content)
      .reverse();
    const mostRecentRelevant = priorUserTurns.find((content) =>
      SELF_HARM_ACTION.test(content) || SUICIDE_TOPIC.test(content) || VIOLENT_ACTION.test(content) || INFORMATIONAL_FRAME.test(content),
    );
    if (!mostRecentRelevant || INFORMATIONAL_FRAME.test(mostRecentRelevant)) return undefined;
    if (SELF_HARM_ACTION.test(mostRecentRelevant) && (DECIDED_INTENT.test(mostRecentRelevant) || NON_IMMINENT_DISCLOSURE.test(mostRecentRelevant))) {
      return 'SELF_HARM_OR_SUICIDE';
    }
    if (VIOLENT_ACTION.test(mostRecentRelevant) && VIOLENT_INTENT.test(mostRecentRelevant)) {
      return 'VIOLENCE_OR_HARM_TO_OTHERS';
    }
    return undefined;
  }
}
