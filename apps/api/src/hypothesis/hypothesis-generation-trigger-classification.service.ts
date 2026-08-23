import { Injectable } from '@nestjs/common';
import {
  MAX_HYPOTHESIS_TRIGGER_INPUT_CHARS,
  type HypothesisGenerationTriggerClassification,
  type HypothesisGenerationTriggerInput,
  type HypothesisTriggerReason,
} from './hypothesis-generation-trigger-classification.types';

type TriggerRule = Readonly<{ reason: HypothesisTriggerReason; patterns: readonly RegExp[] }>;
const MAX_RAW_INPUT_CODE_UNITS = MAX_HYPOTHESIS_TRIGGER_INPUT_CHARS * 2;

// Rules intentionally require explicit surface structures. They do not infer a cause,
// motive, trait, domain, scope, or hypothesis statement.
const TRIGGER_RULES: readonly TriggerRule[] = [
  {
    reason: 'RELATIONAL_PATTERN',
    patterns: [
      /\b(?:every time|whenever|in every relationship)\b[^.!?؟]{0,240}\b(?:someone|a person|my partner|people)\b[^.!?؟]{0,240}\b(?:get(?:s)? close|pull away|push (?:them|people) away|withdraw)\b/iu,
      /(?:كل مرة|كل ما|في كل علاقة)[^.!?؟]{0,240}(?:حد|شخص|شريكي|الناس)[^.!?؟]{0,240}(?:يقرب|بيتقرب|ابعد|ببعد|اهرب|بنسحب)/u,
    ],
  },
  {
    reason: 'OUTCOME_WITH_UNCLEAR_CAUSE',
    patterns: [
      /\bi (?:ended up|wound up|found myself)\b[^.!?؟]{1,240}\b(?:and|but) i (?:do not|don't|cannot|can't) (?:know|understand) (?:why|how)\b/iu,
      /(?:لقيت نفسي|انتهى بيا الحال|انتهي بيا الحال)[^.!?؟]{1,240}(?:ومش|بس مش|وما)(?:\s+انا|\s+أنا)?\s*(?:عارف|عارفة|فاهم|فاهمة)\s+(?:ليه|إزاي|ازاي)/u,
    ],
  },
  {
    reason: 'EXPLICIT_WHY_SELF',
    patterns: [
      /\b(?:why do i|why am i|why can't i|why cannot i|i (?:do not|don't|cannot|can't) understand why i)\b/iu,
      /(?:ليه|لماذا)\s+(?:انا|أنا|إني|اني)\b/u,
      /(?:مش فاهم|مش فاهمة|مش عارف|مش عارفة|ما بفهمش)\s+ليه\s+(?:انا|أنا|إني|اني)?/u,
    ],
  },
  {
    reason: 'RECURRING_PATTERN',
    patterns: [
      /\b(?:every time|whenever)\b[^.!?؟]{1,260}\bi\b[^.!?؟]{1,260}\b(?:change my mind|do the same|repeat|pull away|give up|end up|cannot stop|can't stop|keep doing)\b/iu,
      /\bi (?:always|keep)\b[^.!?؟]{1,260}\b(?:repeat|do the same|change my mind|pull away|give up|end up)\b/iu,
      /(?:كل مرة|كل ما)[^.!?؟]{1,260}(?:انا|أنا|بغير رأيي|بكرر|بعمل نفس|ببعد|بنسحب|بستسلم|بلاقي نفسي)/u,
      /(?:دايمًا|دايما|دائمًا)\s+(?:بكرر|بعمل نفس|بغير رأيي|ببعد|بنسحب|بلاقي نفسي)/u,
    ],
  },
  {
    reason: 'INTERNAL_CONTRADICTION',
    patterns: [
      /\bi (?:want|decided|intend|plan|need)\b[^.!?؟]{1,240}\b(?:but|yet|even though)\b[^.!?؟]{1,240}\bi\b/iu,
      /\bi\b[^.!?؟]{1,240}\b(?:even though|despite the fact that) i\b[^.!?؟]{1,240}/iu,
      /(?:انا|أنا)\s+(?:عايز|عايزة|نفسي|قررت|محتاج|محتاجة)[^.!?؟]{1,240}(?:بس|لكن|مع إني|مع اني|رغم إني|رغم اني)[^.!?؟]{1,240}/u,
      /(?:مع إني|مع اني|رغم إني|رغم اني)[^.!?؟]{1,240}(?:بس|لكن|إلا إني|الا اني)[^.!?؟]{1,240}/u,
    ],
  },
];

const QUOTED_OR_THIRD_PARTY = /^(?:he|she|they)\s+(?:said|told me)(?:\s|$)|^(?:هو|هي|هما)\s+(?:قال|قالت|قالوا)(?:\s|$)|^["“'«].+["”'»]$/iu;
const GREETING_OR_ACK = /^(?:hi|hello|hey|thanks|thank you|ok|okay|sure|got it|مرحبا|مرحبًا|اهلا|أهلا|السلام عليكم|شكرا|شكرًا|تمام|ماشي|حاضر)[.!؟\s]*$/iu;
const TRANSIENT_STATE = /^(?:i(?:'m| am) (?:upset|sad|angry|annoyed|tired) (?:today|right now)|(?:انا|أنا)\s+(?:متضايق|متضايقة|زعلان|زعلانة|غضبان|غضبانة|تعبان|تعبانة)\s+(?:النهارده|اليوم|دلوقتي))[.!؟]*$/iu;
const PREFERENCE_OR_GOAL = /^(?:i (?:prefer|like|want)|my goal is|هدفي|(?:انا|أنا)\s+(?:بفضل|بفضّل|بحب|عايز|عايزة))(?:\s|$)/iu;
const ORDINARY_FACT = /^(?:my name is|i live in|i work (?:at|in|as)|my (?:wife|husband|friend|brother|sister) is (?:called|named)|اسمي|(?:انا|أنا)\s+(?:ساكن|ساكنة|عايش|عايشة|بشتغل)|(?:مراتي|جوزي|صاحبي|صاحبتي|أخويا|اخويا|أختي|اختي)\s+(?:اسمها|اسمه))(?:\s|$)/iu;
const COMMAND_OR_REQUEST = /^(?:please\s+)?(?:tell me|help me|give me|write|show me|explain|قولي|قول لي|ساعدني|اكتب|وريني|اشرح)|^(?:should i|what should i|هل المفروض|اعمل ايه|أعمل إيه|تنصحني)/iu;
const GENERIC_QUESTION = /^(?:what|when|where|who|which|how (?:much|many|long)|ما|متى|امتى|أمتى|أين|فين|من|كم)(?:\s|$).*[?؟]?$/iu;
const TRIGGER_LIKE = /\b(?:why|always|pattern|every time|whenever|contradiction|conflicted|somehow)\b|(?:ليه|دايمًا|دايما|دائمًا|كل مرة|كل ما|نمط|متناقض|مش فاهم|مش عارف)/iu;

@Injectable()
export class HypothesisGenerationTriggerClassificationService {
  classify(input: HypothesisGenerationTriggerInput): HypothesisGenerationTriggerClassification {
    if (input.safetyDisposition !== 'ALLOW') return { classification: 'NO_TRIGGER', reason: 'SAFETY_INELIGIBLE' };
    if (typeof input.text !== 'string') return { classification: 'NO_TRIGGER', reason: 'INSUFFICIENT_SIGNAL' };
    if (input.text.length > MAX_RAW_INPUT_CODE_UNITS) return { classification: 'AMBIGUOUS', reason: 'INPUT_BOUND_EXCEEDED' };
    const text = normalize(input.text);
    if ([...text].length > MAX_HYPOTHESIS_TRIGGER_INPUT_CHARS) return { classification: 'AMBIGUOUS', reason: 'INPUT_BOUND_EXCEEDED' };
    if (text.length === 0) return { classification: 'NO_TRIGGER', reason: 'INSUFFICIENT_SIGNAL' };
    if (QUOTED_OR_THIRD_PARTY.test(text)) return { classification: 'NO_TRIGGER', reason: 'QUOTED_OR_THIRD_PARTY' };

    for (const rule of TRIGGER_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(text))) return { classification: 'TRIGGER', reason: rule.reason };
    }

    if (GREETING_OR_ACK.test(text)) return { classification: 'NO_TRIGGER', reason: 'GREETING_OR_ACK' };
    if (TRANSIENT_STATE.test(text)) return { classification: 'NO_TRIGGER', reason: 'TRANSIENT_STATE_ONLY' };
    if (PREFERENCE_OR_GOAL.test(text)) return { classification: 'NO_TRIGGER', reason: 'PREFERENCE_OR_GOAL' };
    if (ORDINARY_FACT.test(text)) return { classification: 'NO_TRIGGER', reason: 'ORDINARY_FACT' };
    if (COMMAND_OR_REQUEST.test(text)) return { classification: 'NO_TRIGGER', reason: 'COMMAND_OR_REQUEST' };
    if (GENERIC_QUESTION.test(text) || /[?؟]$/u.test(text)) return { classification: 'NO_TRIGGER', reason: 'GENERIC_QUESTION' };
    if (TRIGGER_LIKE.test(text)) return { classification: 'AMBIGUOUS', reason: 'TRIGGER_LIKE_BUT_UNRESOLVED' };
    return { classification: 'NO_TRIGGER', reason: 'INSUFFICIENT_SIGNAL' };
  }
}

function normalize(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}
