import { Injectable } from '@nestjs/common';
import type { CreateMemoryInput, MemoryRecord, MemoryType } from './memory.types';
import { normalizeArabicComparison } from './arabic-text';
import { distinctiveWords, isPredicateWord } from './memory-control.resolution';

export const MEMORY_WRITE_DUPLICATE_LOOKUP_LIMIT = 32;
/** W3-MEGA-M: the longest statement an explicit "remember" request keeps as one Memory. */
export const MAX_EXPLICIT_STATEMENT_LENGTH = 280;

export const MEMORY_IMPORTANCE: Readonly<Record<Exclude<MemoryType, 'DERIVED_INSIGHT'>, number>> = {
  INTERACTION_PREFERENCE: 0.90,
  GOAL: 0.85,
  DECISION_COMMITMENT: 0.85,
  STABLE_PREFERENCE: 0.75,
  RELATIONSHIP_CONTEXT: 0.75,
  PERSONAL_FACT: 0.65,
  TEMPORARY_STATE: 0.50,
};

/**
 * S8B-02 P-1 (Product Owner, 2026-10-30): the confidence a background Memory captured from a MACHINE_ASR transcript is
 * recorded with, per ASR confidence band. These are controlled configuration values, NOT accuracy claims. A LOW band
 * writes no Memory. For a voice turn they replace the typed-text 0.98 / 0.95, which the database refuses there (0183).
 */
export const MACHINE_ASR_MEMORY_CONFIDENCE = Object.freeze({ HIGH: 0.90, MEDIUM: 0.75 } as const);
export type AsrConfidenceBand = 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * S8B-02 CP1 (D-7): the background candidate of a voice turn. The typed grammar has already decided WHAT would be kept;
 * this decides only whether a machine transcript may keep it, and at which configured confidence.
 */
export function machineAsrMemoryCandidate(
  candidate: CreateMemoryInput,
  band: AsrConfidenceBand,
): { decision: 'SKIP'; reason: 'LOW_CONFIDENCE_MACHINE_ASR' } | { decision: 'WRITE'; candidate: CreateMemoryInput } {
  if (band !== 'HIGH' && band !== 'MEDIUM') return { decision: 'SKIP', reason: 'LOW_CONFIDENCE_MACHINE_ASR' };
  return { decision: 'WRITE', candidate: { ...candidate, source: 'MACHINE_ASR', confidence: MACHINE_ASR_MEMORY_CONFIDENCE[band] } };
}

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
// S8A-03 CP3 D-3: a question is never a fact to keep. Every background pattern below ends in an optional «؟», so
// «أنا عايش فين؟», «هدفي إيه؟» or «أحمد أخويا؟» were written as statements with the question mark dropped. A message
// that asks anything is not background-captured; the explicit «افتكر» / correction paths are unchanged (their
// interpreter already refuses a question).
const QUESTION = /[?؟]/u;
// S8A-03 CP3 D-3: the residence clause names a place; an interrogative in that place («أنا ساكن فين», «أنا عايش
// إزاي», «أنا عايش في انهي مدينة») is a question without its mark, never a residence.
const NOT_A_PLACE = /^(?:في\s+)?(?:فين|وين|منين|إزاي|ازاي|إزاى|ازاى|إمتى|امتى|ليه|إيه|ايه|أنهي|انهي|أنهى|انهى)(?![\p{L}\p{M}])/u;
// W3-MEGA-M: Unicode-aware boundaries. JavaScript's \b is ASCII-only, so the Arabic alternatives inside \b…\b could
// never match and Arabic secrets passed this screen. Arabic attaches و / ب / ل / ف / ال to the keyword («وكلمة السر»,
// «والباسورد»), so those clitics are allowed in front of it. Card, account, IBAN, passport and PIN / CVV identifiers are
// screened too; an identity-number keyword is screened with or without the number beside it.
const OBVIOUS_SECRET = [
  /(?<![\p{L}\p{N}_])(?:password|passwd|passcode|pin(?: code| number)?|cvv|cvc|(?:[وبلف]|ال)?(?:[وبلف]|ل)?(?:ال)?(?:كلم[ةه] (?:ال)?سر|كلم[ةه] (?:ال)?مرور|باسورد|رقم (?:ال)?سري|بين كود))(?![\p{L}\p{N}_])/iu,
  /(?<![\p{L}\p{N}_])(?:iban|account number|passport number|(?:[وبلف]|ال)?(?:رقم (?:ال)?(?:حساب|كارت|بطاق[ةه]|فيزا|باسبور|جواز)|ايبان|آيبان))(?![\p{L}\p{N}_])/iu,
  /\b[a-z]{2}\d{2}[a-z0-9]{11,30}\b/iu,
  /\b(?:api[ _-]?key|access[ _-]?token|auth(?:entication)?[ _-]?token|secret[ _-]?key)\b/iu,
  /(?<![\p{L}\p{N}_])(?:otp|verification code|one[ -]?time (?:password|code)|(?:[وبلف]|ال)?(?:كود|رمز) (?:ال)?(?:تحقق|تفعيل))(?![\p{L}\p{N}_])/iu,
  /\b(?:sk|pk)_(?:live|test)_[a-z0-9]{12,}\b/iu,
  /\b(?:ghp|gho|github_pat)_[a-z0-9_]{12,}\b/iu,
  /\b(?:\d[ -]*?){13,19}\b/u,
  /(?<![\p{L}\p{N}_])(?:national id|government id|ssn|social security|(?:[وبلف]|ال)?(?:ال)?رقم (?:ال)?(?:قومي|هوي[ةه]))(?![\p{L}\p{N}_])/iu,
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
    if (QUESTION.test(content)) return { decision: 'SKIP', reason: 'NO_SUPPORTED_EXPLICIT_PATTERN' };

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

  /**
   * W3-MEGA-M (E2E-D-13): the explicit "remember this" write path P1 §9 names. The user's explicit request is the
   * authority, so the background grammar is NOT the ceiling here: a statement the typed patterns recognise keeps its
   * canonical type and wording, and any other statement is kept in the user's own words as a PERSONAL_FACT (or the
   * caller's fallback type). The existing secret / sensitive-identifier screen still applies unchanged.
   */
  explicitStatementCandidate(
    rawStatement: string,
    now = new Date(),
    fallbackType: Exclude<MemoryType, 'DERIVED_INSIGHT'> = 'PERSONAL_FACT',
  ): { decision: 'SKIP'; reason: 'SENSITIVE_DATA' | 'EMPTY' } | { decision: 'WRITE'; candidate: CreateMemoryInput } {
    const statement = prepareRememberContent(rawStatement).replace(/^(?:إني|اني|انى|إنّي)\s+/u, 'أنا ');
    if (OBVIOUS_SECRET.some((pattern) => pattern.test(statement))) return { decision: 'SKIP', reason: 'SENSITIVE_DATA' };
    const words = trimValue(statement);
    if (words.length < 2) return { decision: 'SKIP', reason: 'EMPTY' };
    // One remembered fact, not a document: a longer request stays ordinary conversation.
    if (words.length > MAX_EXPLICIT_STATEMENT_LENGTH) return { decision: 'SKIP', reason: 'EMPTY' };
    const match = this.match(statement, now) ?? candidate(fallbackType, `${words}.`);
    return {
      decision: 'WRITE',
      candidate: {
        type: match.type, content: match.content, source: 'USER_STATED', status: 'ACTIVE', confidence: 0.98,
        importance: MEMORY_IMPORTANCE[match.type],
        ...(match.expiresAt ? { expiresAt: match.expiresAt } : {}),
      },
    };
  }

  /**
   * MEM-AR-01C (PD-1) — step 1 of the subject screen: whether the closed first-person / user-relative grammar the
   * background captures with (I-F3) recognises this explicit statement. Such a statement is about the user (SELF).
   */
  recognizesFirstPersonStatement(rawStatement: string, now = new Date()): boolean {
    const statement = prepareRememberContent(rawStatement).replace(/^(?:إني|اني|انى|إنّي)\s+/u, 'أنا ');
    return this.match(statement, now) !== undefined;
  }

  private match(content: string, now: Date): PatternMatch | undefined {
    let match: RegExpMatchArray | null;

    // IP-IMP-01 (WP2): no template produces an INTERACTION_PREFERENCE Memory any more. «كلمني بالمصري» / "speak to me in
    // English" without a durable marker is a TEMPORARY request - honoured in that conversation and never stored - and an
    // explicit durable request is a command that writes only the canonical Interaction Preferences record (0153). The
    // type stays for the owner's existing legacy rows, which are never rewritten (their review is the owner's choice).

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
    // MEM-AR-01A (PD-4): the user's own clause, never re-gendered or re-verbed («أنا ساكنة …», «أنا عايشة …»).
    match = content.match(/^(?:بالمناسبة\s+)?((?:أنا|انا)\s+(?:ساكن|ساكنة|عايش|عايشة)\s+((?:في\s+)?\S.*?))[.!؟]?$/u);
    if (match && !NOT_A_PLACE.test(match[2])) return candidate('PERSONAL_FACT', asSaid(match[1]));

    match = content.match(/^([\p{L}][\p{L}\p{M}' -]{0,60})\s+is my\s+(brother|sister|friend|wife|husband|mother|father|son|daughter)[.!؟]?$/iu);
    if (match) return candidate('RELATIONSHIP_CONTEXT', `${trimValue(match[1])} is my ${match[2].toLocaleLowerCase('en')}.`);
    match = content.match(/^([\p{L}][\p{L}\p{M}' -]{0,60})\s+(أخويا|اخويا|أختي|اختي|صاحبي|صاحبتي|مراتي|جوزي|والدتي|والدي|ابني|بنتي)[.!؟]?$/u);
    if (match) return candidate('RELATIONSHIP_CONTEXT', `${trimValue(match[1])} ${match[2]}.`);

    match = content.match(/^i (?:prefer|like)\s+(.+?)[.!؟]?$/iu);
    if (match) return candidate('STABLE_PREFERENCE', `I ${/^i prefer/iu.test(content) ? 'prefer' : 'like'} ${trimValue(match[1])}.`);
    match = content.match(/^(?:أنا|انا)\s+(بفضل|بفضّل|بحب)\s+(.+?)[.!؟]?$/u);
    if (match) return candidate('STABLE_PREFERENCE', `أنا ${match[1]} ${trimValue(match[2])}.`);
    // MEM-AR-01A (PD-5): «بحب …» without the pronoun is still first person («بيحب», «بتحب», «بنحب» are not). A
    // question is never a statement to keep.
    match = content.match(/^(بحب\s+[^?؟]+?)[.!]?$/u);
    if (match) return candidate('STABLE_PREFERENCE', asSaid(match[1]));
    // MEM-AR-01A (PD-5): first-person «بطلت …», in the user's words. A following «ت… / ي… / ن…» verb is another
    // person («بطلت تكلمني»), so it is not captured. Kept apart from an existing Memory it may reverse by
    // `screenMemoryCapture` below: reversing a fact is 01B's controlled correction, never a silent capture.
    match = content.match(/^((?:(?:أنا|انا)\s+)?بطلت\s+(?![تين])[^?؟]+?)[.!]?$/u);
    if (match) return candidate('PERSONAL_FACT', asSaid(match[1]));

    match = content.match(/^i(?:'m| am) traveling to\s+(.+?)\s+(tomorrow|next week)[.!؟]?$/iu);
    if (match) return temporary(`I'm traveling to ${trimValue(match[1])} ${match[2].toLocaleLowerCase('en')}.`, match[2], now);
    match = content.match(/^((?:أنا|انا)\s+مسافر(?:ة)?\s+(?:إلى|الى|لـ?|على)?\s*.+?\s+(بكرة|غدًا|غدا|الأسبوع الجاي|الاسبوع الجاي))[.!؟]?$/u);
    if (match) return temporary(asSaid(match[1]), match[2], now);
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

/** MEM-AR-01A: the duplicate-comparison key is the ONE shared comparison normalizer (`arabic-text`). */
export function normalizeMemoryContent(value: string): string {
  return normalizeArabicComparison(value);
}

// MEM-AR-01A — legacy-template compatibility. Before 01A the Arabic location and travel patterns stored a masculine
// template («أنا ساكن في X.», «أنا مسافر X بكرة.») whatever the user said. Those rows are never rewritten; instead a new
// statement of the SAME fact in the user's own words («أنا ساكنة في X») is compared with the template it would have
// produced. The two regular expressions below are the frozen pre-01A patterns, unchanged, and they apply only to these
// two statement shapes: no other wording, subject or fact is collapsed.
const LEGACY_LOCATION_TEMPLATE = /^(?:بالمناسبة\s+)?(?:أنا|انا)\s+(?:ساكن|ساكنة|عايش|عايشة)\s+(?:في\s+)?(.+?)(?:\s+من\s+\d+\s+سنين)?[.!؟]?$/u;
const LEGACY_TRAVEL_TEMPLATE = /^(?:أنا|انا)\s+مسافر(?:ة)?\s+(?:إلى|الى|لـ?|على)?\s*(.+?)\s+(بكرة|غدًا|غدا|الأسبوع الجاي|الاسبوع الجاي)[.!؟]?$/u;

function legacyTemplateForm(content: string): string | undefined {
  const text = clean(content);
  let match = text.match(LEGACY_LOCATION_TEMPLATE);
  if (match) return `أنا ساكن في ${trimValue(match[1])}.`;
  match = text.match(LEGACY_TRAVEL_TEMPLATE);
  if (match) return `أنا مسافر ${trimValue(match[1])} ${match[2]}.`;
  return undefined;
}

/**
 * The comparison keys a new statement is already remembered under: its own words and, for the two formerly templated
 * Arabic shapes only, the frozen legacy template of the same statement.
 */
export function memoryDuplicateKeys(content: string): ReadonlySet<string> {
  const legacy = legacyTemplateForm(content);
  return new Set([normalizeMemoryContent(content), ...(legacy === undefined ? [] : [normalizeMemoryContent(legacy)])]);
}

const REVERSAL_CAPTURE = /^(?:أنا\s+)?بطلت\s+(.+)$/u;

/**
 * MEM-AR-01A — the background capture screen against the user's current Memories (owner-scoped, bounded by the caller).
 *  * EXACT_NORMALIZED_DUPLICATE: a Memory of the same type already says it (own words or the legacy template).
 *  * REVERSAL_NEEDS_CORRECTION: «بطلت X» shares a distinctive word with a current Memory («أنا بحب القهوة»). It may
 *    reverse that fact, which only 01B's controlled correction may do, so the capture fails closed: nothing is written,
 *    retired or corrected. A reversal with no lexical link to the old wording is not detectable here (a known limit).
 */
export function screenMemoryCapture(
  candidate: Pick<CreateMemoryInput, 'type' | 'content'>,
  current: ReadonlyArray<Pick<MemoryRecord, 'type' | 'content'>>,
): 'EXACT_NORMALIZED_DUPLICATE' | 'REVERSAL_NEEDS_CORRECTION' | undefined {
  const keys = memoryDuplicateKeys(candidate.content);
  if (current.some((memory) => memory.type === candidate.type && keys.has(normalizeMemoryContent(memory.content)))) return 'EXACT_NORMALIZED_DUPLICATE';
  const reversal = candidate.content.match(REVERSAL_CAPTURE);
  if (reversal) {
    const object = [...distinctiveWords(reversal[1])].filter((word) => !isPredicateWord(word));
    if (current.some((memory) => { const words = distinctiveWords(memory.content); return object.some((word) => words.has(word)); })) {
      return 'REVERSAL_NEEDS_CORRECTION';
    }
  }
  return undefined;
}

/** S8A-03 CP2: the same secret / sensitive-identifier screen, read by the model-assisted capture and its pre-screen. */
export function containsObviousSecret(value: string): boolean {
  const content = clean(value);
  return OBVIOUS_SECRET.some((pattern) => pattern.test(content));
}

function clean(value: string): string { return value.normalize('NFKC').trim().replace(/\s+/gu, ' '); }
/** MEM-AR-01A: the user's clause as said: orthographic «انا» → «أنا» and one terminal full stop, nothing else. */
function asSaid(clause: string): string { return `${trimValue(clause).replace(/^انا(?=\s)/u, 'أنا')}.`; }
function trimValue(value: string): string { return value.trim().replace(/[.!؟،,;:]+$/gu, '').trim(); }
function prepareRememberContent(value: string): string {
  return clean(value).replace(/^(?:إني|اني|انى)\s+(?=(?:ساكن|ساكنة|عايش|عايشة|بفضل|بفضّل|بحب)(?:\s|$))/u, 'أنا ');
}
