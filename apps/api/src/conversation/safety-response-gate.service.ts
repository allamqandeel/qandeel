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
  'Respond supportively and concisely to an explicit non-imminent self-harm disclosure.',
  'Do not provide methods, optimization, concealment, or encouragement.',
  'Encourage immediate human or professional support and ask one direct question about immediate safety.',
].join('\n');

const ARABIC = /[\u0600-\u06ff]/;
const METHOD_SEEKING = /\b(?:how (?:can|do|would) i|ways? to|best way to|method(?:s)? (?:to|for)|instructions? (?:to|for))\b|(?:ازاي|إزاي|كيف|طريقة|طرق|افضل طريقة|أفضل طريقة)/i;
const SELF_HARM_ACTION = /\b(?:kill(?:ing)? myself|end(?:ing)? my life|commit(?:ting)? suicide|hurt(?:ing)? myself|harm(?:ing)? myself|cut(?:ting)? myself|overdos(?:e|ing))\b|(?:اقتل نفسي|أقتل نفسي|انتحر|انهي حياتي|أنهي حياتي|أؤذي نفسي|اؤذي نفسي|أجرح نفسي|اجرّح نفسي|جرح نفسي|أقطع شراييني|اقطع شراييني|جرعة زائدة)/i;
const SUICIDE_TOPIC = /\b(?:suicide|suicidal)\b|(?:انتحار|الانتحار|انتحاري|انتحارية)/i;
const IMMINENT = /\b(?:right now|now|tonight|today|immediately|about to|going to|will do it|can't stop myself|have (?:the )?(?:pills|gun|knife|rope))\b|(?:دلوقتي|الآن|الان|النهارده|الليلة|حالًا|حالا|هعملها|حنفذ|هنفذ|معايا (?:الحبوب|مسدس|سكين|حبل))/i;
const NON_IMMINENT_DISCLOSURE = /\b(?:thinking about|thoughts? of|urge(?:s)? to|want to)\b|(?:بفكر|أفكر|افكر|عندي أفكار|عندي رغبة|عايز|عاوز)/i;
const VIOLENT_ACTION = /\b(?:kill|murder|shoot|stab|poison|attack|seriously hurt)\b|(?:اقتل|أقتل|أضربه بالنار|اضربه بالنار|أطعنه|اطعنه|أسممه|اسممه|أهاجم|اهاجم|أؤذيه بشدة|اؤذيه بشدة)/i;
const TARGET_OR_PLAN = /\b(?:him|her|them|someone|person|target|victim|where to aim|without getting caught|hide (?:the )?(?:body|evidence)|plan (?:an|the)? attack)\b|(?:هو|هي|حد|شخص|الهدف|الضحية|أصوب فين|اصوب فين|من غير ما اتمسك|أخفي الجثة|اخفي الجثة|أخفي الدليل|اخفي الدليل|أخطط للهجوم|اخطط للهجوم)/i;
const MINOR = /\b(?:child|children|kid|minor|underage|teen(?:ager)?|\d{1,2}[ -]?year[ -]?old)\b|(?:طفل|طفلة|أطفال|اطفال|قاصر|قاصرة|تحت السن|مراهق|مراهقة|عمره \d{1,2}|عمرها \d{1,2})/i;
const SEXUAL = /\b(?:sex|sexual|nude|naked|porn|explicit (?:photo|image|video)|erotic)\b|(?:جنس|جنسي|جنسية|عاري|عارية|عراة|إباحي|اباحي|صور فاضحة|فيديو فاضح)/i;
const ILLEGAL_HARM = /\b(?:build|make|create)\s+(?:an?\s+)?(?:bomb|explosive)\b|\b(?:write|create|deploy|spread)\b[\s\S]{0,40}\b(?:ransomware|destructive malware)\b|\b(?:steal|hack)\b[\s\S]{0,40}\b(?:credential(?:s)?|password(?:s)?)\b|\b(?:bomb|explosive|ransomware|destructive malware|credential theft|poison|toxin)\b[\s\S]{0,60}\b(?:instructions?|steps?|recipe|undetected|bypass|evade)\b|(?:اصنع|أصنع|اعمل)[\s\S]{0,30}(?:قنبلة|متفجرات)|(?:اكتب|اسرق|أسرق|اخترق|أخترق|سمّم)[\s\S]{0,40}(?:برمجية خبيثة|فدية|كلمات مرور|سم|مادة سامة)|(?:خطوات|تعليمات|طريقة)[\s\S]{0,60}(?:قنبلة|متفجرات|برمجية خبيثة|فدية|سرقة كلمات المرور|تسميم)/i;
const MEDICAL_EMERGENCY = /\b(?:can't breathe|cannot breathe|chest pain|signs? of (?:a )?stroke|face droop|severe bleeding|won't stop bleeding|unconscious|not breathing|anaphylaxis|severe allergic reaction|overdos(?:e|ed)|seizure)\b|(?:مش قادر أتنفس|مش قادرة أتنفس|لا أستطيع التنفس|الم في الصدر|ألم في الصدر|علامات جلطة|نزيف شديد|النزيف مش بيقف|فاقد الوعي|لا يتنفس|حساسية شديدة|جرعة زائدة|تشنجات)/i;
const ACUTE_PERSON_CONTEXT = /\b(?:i have|i'm having|i am having|my |he is|he's|she is|she's|they are|they're|someone is|right now|just )\b|(?:عندي|عنده|عندها|معايا|معاه|معاها|أنا|انا|هو |هي |دلوقتي|الآن|الان|حالًا|حالا)/i;
const BENIGN_INFORMATIONAL_FRAME = /\b(?:history|historical|news|reported|documentary|fiction|fictional|novel|movie|film|video game|game boss)\b|(?:تاريخ|تاريخي|تاريخية|الأخبار|الاخبار|خبر|وثائقي|خيالي|خيالية|رواية|فيلم|لعبة|في اللعبة)/i;
const SAFETY_OR_PREVENTION_FRAME = /\b(?:bomb shelters?|bomb disposal|explosive detection|malware prevention|ransomware defense|credential theft prevention)\b|(?:ملجأ قنابل|التخلص من القنابل|كشف المتفجرات|منع البرمجيات الخبيثة|الحماية من الفدية)/i;

@Injectable()
export class SafetyResponseGateService implements SafetyResponseGate {
  evaluate(currentTurn: string, _context: ReadonlyArray<ModelRouterContextMessage>): SafetyResponseGateResult {
    const language: Language = ARABIC.test(currentTurn) ? 'ar' : 'en';
    const benignInformationalFrame = BENIGN_INFORMATIONAL_FRAME.test(currentTurn);
    const block = (category: Exclude<SafetyCategory, 'NONE'>): SafetyResponseGateResult => ({
      category, disposition: 'BLOCK', deterministicResponse: RESPONSES[category][language],
    });

    if (!benignInformationalFrame && MINOR.test(currentTurn) && SEXUAL.test(currentTurn)) return block('SEXUAL_CONTENT_MINOR');
    if (MEDICAL_EMERGENCY.test(currentTurn) && ACUTE_PERSON_CONTEXT.test(currentTurn)) return block('HIGH_STAKES_MEDICAL_CRISIS');
    if (!benignInformationalFrame && (
      (SELF_HARM_ACTION.test(currentTurn) && IMMINENT.test(currentTurn)) ||
      (METHOD_SEEKING.test(currentTurn) && (SELF_HARM_ACTION.test(currentTurn) || SUICIDE_TOPIC.test(currentTurn)))
    )) {
      return block('SELF_HARM_OR_SUICIDE');
    }
    if (!benignInformationalFrame && VIOLENT_ACTION.test(currentTurn) && (METHOD_SEEKING.test(currentTurn) || TARGET_OR_PLAN.test(currentTurn))) {
      return block('VIOLENCE_OR_HARM_TO_OTHERS');
    }
    if (!benignInformationalFrame && !SAFETY_OR_PREVENTION_FRAME.test(currentTurn) && ILLEGAL_HARM.test(currentTurn)) {
      return block('SEVERE_ILLEGAL_ACTIONABLE_HARM');
    }
    if (SELF_HARM_ACTION.test(currentTurn) && NON_IMMINENT_DISCLOSURE.test(currentTurn)) {
      return { category: 'SELF_HARM_OR_SUICIDE', disposition: 'GUIDED', safetyGuidance: SELF_HARM_GUIDANCE };
    }
    return { category: 'NONE', disposition: 'ALLOW' };
  }
}
