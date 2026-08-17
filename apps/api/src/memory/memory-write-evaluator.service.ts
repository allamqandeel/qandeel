import { Injectable } from '@nestjs/common';
import type { CreateMemoryInput, MemoryType } from './memory.types';

export const MEMORY_WRITE_DUPLICATE_LOOKUP_LIMIT = 32;

export const MEMORY_IMPORTANCE: Readonly<Record<Exclude<MemoryType, 'DERIVED_INSIGHT'>, number>> = {
  INTERACTION_PREFERENCE: 0.90,
  GOAL: 0.85,
  DECISION_COMMITMENT: 0.85,
  STABLE_PREFERENCE: 0.75,
  RELATIONSHIP_CONTEXT: 0.75,
  PERSONAL_FACT: 0.65,
  TEMPORARY_STATE: 0.50,
};

export type MemoryWriteSkipReason =
  | 'NO_SUPPORTED_EXPLICIT_PATTERN'
  | 'SENSITIVE_DATA'
  | 'QUOTED_OR_THIRD_PARTY'
  | 'AMBIGUOUS_OR_SPECULATIVE'
  | 'TRANSIENT_OR_LOW_VALUE';

export type MemoryWriteDecision =
  | { decision: 'SKIP'; reason: MemoryWriteSkipReason }
  | { decision: 'WRITE'; candidate: CreateMemoryInput };

interface PatternMatch {
  type: Exclude<MemoryType, 'DERIVED_INSIGHT'>;
  content: string;
  expiresAt?: string;
}

const REMEMBER_CUE = /^(?:please\s+)?remember(?:\s+that)?\s+|^(?:افتكر|إفتكر|خلي بالك)\s+/iu;
const SPECULATION = /\b(?:maybe|perhaps|i guess|i might be)\b|(?:يمكن|ممكن أكون|ممكن اكون|غالب[ًاا])/iu;
const TRANSIENT_EMOTION = /\b(?:i(?:'m| am) (?:upset|sad|angry|annoyed) today)\b|(?:أنا|انا)\s+(?:متضايق|متضايقة|زعلان|زعلانة|غضبان|غضبانة)\s+(?:النهارده|اليوم)/iu;
const QUOTED_OR_THIRD_PARTY = /^(?:he|she|they)\s+(?:said|told me)\b|^(?:هو|هي|هما)\s+(?:قال|قالت|قالوا)\b|^["“'«].+["”'»]$/iu;
const MULTI_SENTENCE = /[.!؟]\s+\S/u;
const OBVIOUS_SECRET = [
  /\b(?:password|passwd|passcode|كلمة السر|كلمه السر|باسورد)\b/iu,
  /\b(?:api[ _-]?key|access[ _-]?token|auth(?:entication)?[ _-]?token|secret[ _-]?key)\b/iu,
  /\b(?:otp|verification code|one[ -]?time (?:password|code)|كود التحقق|رمز التحقق)\b/iu,
  /\b(?:sk|pk)_(?:live|test)_[a-z0-9]{12,}\b/iu,
  /\b(?:ghp|gho|github_pat)_[a-z0-9_]{12,}\b/iu,
  /\b(?:\d[ -]*?){13,19}\b/u,
  /\b(?:national id|government id|ssn|social security|الرقم القومي|رقم الهوية)\b[\s:#-]*\d{8,}/iu,
];

@Injectable()
export class MemoryWriteEvaluatorService {
  evaluate(rawContent: string, now = new Date()): MemoryWriteDecision {
    const content = clean(rawContent);
    if (OBVIOUS_SECRET.some((pattern) => pattern.test(content))) return { decision: 'SKIP', reason: 'SENSITIVE_DATA' };
    if (QUOTED_OR_THIRD_PARTY.test(content)) return { decision: 'SKIP', reason: 'QUOTED_OR_THIRD_PARTY' };
    if (SPECULATION.test(content)) return { decision: 'SKIP', reason: 'AMBIGUOUS_OR_SPECULATIVE' };
    if (TRANSIENT_EMOTION.test(content)) return { decision: 'SKIP', reason: 'TRANSIENT_OR_LOW_VALUE' };
    if (MULTI_SENTENCE.test(content)) return { decision: 'SKIP', reason: 'AMBIGUOUS_OR_SPECULATIVE' };

    const rememberRequested = REMEMBER_CUE.test(content);
    const evaluable = rememberRequested ? prepareRememberContent(content.replace(REMEMBER_CUE, '')) : content;
    const match = this.match(evaluable, now);
    if (!match) return { decision: 'SKIP', reason: 'NO_SUPPORTED_EXPLICIT_PATTERN' };

    return {
      decision: 'WRITE',
      candidate: {
        type: match.type,
        content: match.content,
        source: 'USER_STATED',
        status: 'ACTIVE',
        confidence: rememberRequested ? 0.98 : 0.95,
        importance: MEMORY_IMPORTANCE[match.type],
        ...(match.expiresAt ? { expiresAt: match.expiresAt } : {}),
      },
    };
  }

  private match(content: string, now: Date): PatternMatch | undefined {
    let match: RegExpMatchArray | null;

    match = content.match(/^(?:speak|talk|respond|answer)\s+(?:to\s+)?me\s+in\s+(.+?)[.!؟]?$/iu);
    if (match) return candidate('INTERACTION_PREFERENCE', `Speak to me in ${trimValue(match[1])}.`);
    match = content.match(/^(?:كلمني|كلّمني|اتكلم معايا|رد عليا|رد عليّ)\s+(.+?)[.!؟]?$/u);
    if (match) return candidate('INTERACTION_PREFERENCE', `${content.match(/^(?:كلمني|كلّمني|اتكلم معايا|رد عليا|رد عليّ)/u)![0]} ${trimValue(match[1])}.`);

    match = content.match(/^my goal is\s+(.+?)[.!؟]?$/iu);
    if (match) return candidate('GOAL', `My goal is ${trimValue(match[1])}.`);
    match = content.match(/^هدفي\s+(.+?)[.!؟]?$/u);
    if (match) return candidate('GOAL', `هدفي ${trimValue(match[1])}.`);

    match = content.match(/^i (?:have )?decided to\s+(.+?)[.!؟]?$/iu);
    if (match) return candidate('DECISION_COMMITMENT', `I decided to ${trimValue(match[1])}.`);
    match = content.match(/^قررت\s+(.+?)[.!؟]?$/u);
    if (match) return candidate('DECISION_COMMITMENT', `قررت ${trimValue(match[1])}.`);

    match = content.match(/^(?:by the way,?\s+)?i live in\s+(.+?)(?:\s+for\s+\d+\s+(?:years?|months?))?[.!؟]?$/iu);
    if (match) return candidate('PERSONAL_FACT', `I live in ${trimValue(match[1])}.`);
    match = content.match(/^(?:بالمناسبة\s+)?(?:أنا|انا)\s+(?:ساكن|ساكنة|عايش|عايشة)\s+(?:في\s+)?(.+?)(?:\s+من\s+\d+\s+سنين)?[.!؟]?$/u);
    if (match) return candidate('PERSONAL_FACT', `أنا ساكن في ${trimValue(match[1])}.`);

    match = content.match(/^([\p{L}][\p{L}\p{M}' -]{0,60})\s+is my\s+(brother|sister|friend|wife|husband|mother|father|son|daughter)[.!؟]?$/iu);
    if (match) return candidate('RELATIONSHIP_CONTEXT', `${trimValue(match[1])} is my ${match[2].toLocaleLowerCase('en')}.`);
    match = content.match(/^([\p{L}][\p{L}\p{M}' -]{0,60})\s+(أخويا|اخويا|أختي|اختي|صاحبي|صاحبتي|مراتي|جوزي|والدتي|والدي|ابني|بنتي)[.!؟]?$/u);
    if (match) return candidate('RELATIONSHIP_CONTEXT', `${trimValue(match[1])} ${match[2]}.`);

    match = content.match(/^i (?:prefer|like)\s+(.+?)[.!؟]?$/iu);
    if (match) return candidate('STABLE_PREFERENCE', `I ${/^i prefer/iu.test(content) ? 'prefer' : 'like'} ${trimValue(match[1])}.`);
    match = content.match(/^(?:أنا|انا)\s+(بفضل|بفضّل|بحب)\s+(.+?)[.!؟]?$/u);
    if (match) return candidate('STABLE_PREFERENCE', `أنا ${match[1]} ${trimValue(match[2])}.`);

    match = content.match(/^i(?:'m| am) traveling to\s+(.+?)\s+(tomorrow|next week)[.!؟]?$/iu);
    if (match) return temporary(`I'm traveling to ${trimValue(match[1])} ${match[2].toLocaleLowerCase('en')}.`, match[2], now);
    match = content.match(/^(?:أنا|انا)\s+مسافر(?:ة)?\s+(?:إلى|الى|لـ?|على)?\s*(.+?)\s+(بكرة|غدًا|غدا|الأسبوع الجاي|الاسبوع الجاي)[.!؟]?$/u);
    if (match) return temporary(`أنا مسافر ${trimValue(match[1])} ${match[2]}.`, match[2], now);
    return undefined;
  }
}

function candidate(type: PatternMatch['type'], content: string): PatternMatch {
  return { type, content };
}

function temporary(content: string, relative: string, now: Date): PatternMatch {
  const days = /week|أسبوع|اسبوع/u.test(relative) ? 14 : 2;
  return { type: 'TEMPORARY_STATE', content, expiresAt: new Date(now.getTime() + days * 86_400_000).toISOString() };
}

export function normalizeMemoryContent(value: string): string {
  return value.toLocaleLowerCase('und').normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/gu, '')
    .replace(/[أإآ]/gu, 'ا').replace(/ى/gu, 'ي').replace(/ة/gu, 'ه')
    .replace(/[.!؟،,;:]+$/gu, '').replace(/\s+/gu, ' ').trim();
}

function clean(value: string): string { return value.normalize('NFKC').trim().replace(/\s+/gu, ' '); }
function trimValue(value: string): string { return value.trim().replace(/[.!؟،,;:]+$/gu, '').trim(); }
function prepareRememberContent(value: string): string {
  return clean(value).replace(/^(?:إني|اني|انى)\s+(?=(?:ساكن|ساكنة|عايش|عايشة|بفضل|بفضّل|بحب)(?:\s|$))/u, 'أنا ');
}
