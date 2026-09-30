// W3-MEGA-M (E2E-D-13) — what QANDEEL says for a conversational Memory command.
//
// Deterministic, like the Safety gate's responses: the words are chosen from the outcome the database COMMITS, so a
// reply can never claim a change that did not happen. They quote the remembered words themselves and never show an
// id, a status, a score or any implementation vocabulary. Arabic is Egyptian conversational, verb-led, addressed
// without gendered imperatives; failures are framed as the process's («اتغيّرت»), not a confession.
//
// TASK-APPROVED DELEGATED COPY (W3-MEGA-M §10: no large copy redesign; plain, concise, non-diagnostic).
import type { MemoryControlOutcome } from './memory-control.types';

export type MemoryControlLanguage = 'ar' | 'en';

const MAX_QUOTED = 160;

export function quoteMemory(language: MemoryControlLanguage, content: string): string {
  const words = content.trim().replace(/\s+/gu, ' ');
  const bounded = words.length > MAX_QUOTED ? `${words.slice(0, MAX_QUOTED - 1).trimEnd()}…` : words;
  return language === 'ar' ? `«${bounded}»` : `“${bounded}”`;
}

type Line = Record<MemoryControlLanguage, string>;

const LINES = {
  inspectIntro: { ar: 'ده اللي فاكره من كلامنا:', en: "Here's what I remember from our conversations:" },
  inspectOlder: { ar: 'وفيه حاجات أقدم كمان.', en: 'There are a few older things too.' },
  inspectKeptNotRelied: {
    ar: 'وفيه حاجات لسه فاكرها، بس مش بعتمد عليها بناءً على طلبك:',
    en: "And some things I still remember but don't rely on, as you asked:",
  },
  nothingRemembered: { ar: 'لسه مش فاكر عنك حاجة محددة.', en: "I don't have anything specific remembered about you yet." },
  remembered: { ar: 'تمام، هفتكر ده:', en: "Got it, I'll remember:" },
  alreadyRemembered: { ar: 'فاكر ده أصلًا:', en: 'I already remember that:' },
  declinedSensitive: {
    ar: 'دي معلومة حساسة، زي كلمة سر أو كود أو رقم هوية، ومش بحتفظ بالحاجات دي.',
    en: "That looks sensitive, like a password, a code or an ID number, so I don't keep it.",
  },
  alreadyCorrect: { ar: 'فاكرها كده أصلًا:', en: 'I already have it that way:' },
  targetNotFound: { ar: 'مش لاقي حاجة زي كده في اللي فاكره.', en: "I don't have anything like that in what I remember." },
  targetNotSpecified: { ar: 'تقصد أنهي معلومة بالظبط؟', en: 'Which piece of information do you mean exactly?' },
  targetChanged: {
    ar: 'المعلومة دي اتغيّرت قبل ما أعدّلها، فماغيّرتش حاجة.',
    en: "That changed before I could update it, so I didn't change anything.",
  },
  declined: { ar: 'تمام، ماغيّرتش حاجة.', en: "OK, I haven't changed anything." },
  whichOne: { ar: 'تقصد أنهي واحدة؟', en: 'Which one do you mean?' },
  oneAtATime: { ar: 'خلّينا ناخدهم واحدة واحدة. تقصد أنهي واحدة الأول؟', en: "Let's take them one at a time. Which one first?" },
  numberIsEnough: { ar: 'رقمها يكفي.', en: 'The number is enough.' },
} satisfies Record<string, Line>;

export function inspectReply(
  language: MemoryControlLanguage,
  relied: ReadonlyArray<string>,
  notRelied: ReadonlyArray<string>,
  hasOlder: boolean,
): string {
  if (relied.length === 0 && notRelied.length === 0) return LINES.nothingRemembered[language];
  const lines: string[] = [];
  if (relied.length > 0) {
    lines.push(LINES.inspectIntro[language], ...relied.map((content) => `• ${quoteMemory(language, content)}`));
    if (hasOlder) lines.push(LINES.inspectOlder[language]);
  }
  if (notRelied.length > 0) {
    lines.push(relied.length > 0 ? LINES.inspectKeptNotRelied[language] : LINES.inspectKeptNotRelied[language].replace(/^وفيه/u, 'فيه').replace(/^And some/u, 'Some'));
    lines.push(...notRelied.map((content) => `• ${quoteMemory(language, content)}`));
  }
  return lines.join('\n');
}

export function rememberedReply(language: MemoryControlLanguage, content: string): string {
  return `${LINES.remembered[language]} ${quoteMemory(language, content)}`;
}

export function alreadyRememberedReply(language: MemoryControlLanguage, content: string): string {
  return `${LINES.alreadyRemembered[language]} ${quoteMemory(language, content)}`;
}

export function correctedReply(language: MemoryControlLanguage, previous: string, current: string): string {
  return language === 'ar'
    ? `تمام، صحّحتها. بقيت فاكر ${quoteMemory(language, current)} بدل ${quoteMemory(language, previous)}.`
    : `Got it, I've corrected it. I now remember ${quoteMemory(language, current)} instead of ${quoteMemory(language, previous)}.`;
}

export function alreadyCorrectReply(language: MemoryControlLanguage, content: string): string {
  return `${LINES.alreadyCorrect[language]} ${quoteMemory(language, content)}`;
}

export function forgottenReply(language: MemoryControlLanguage, content: string): string {
  return language === 'ar'
    ? `تمام، نسيت ${quoteMemory(language, content)} ومش هرجع له تاني.`
    : `Done, I've forgotten ${quoteMemory(language, content)} and won't bring it up again.`;
}

export function disabledReply(language: MemoryControlLanguage, content: string): string {
  return language === 'ar'
    ? `تمام، مش هعتمد على ${quoteMemory(language, content)} في كلامنا، بس هفضل فاكرها.`
    : `Done, I won't rely on ${quoteMemory(language, content)} when we talk, but I'll keep it.`;
}

/** One option: "do you mean …?"; several: a short numbered list. Only the remembered words are shown. */
export function clarificationReply(language: MemoryControlLanguage, options: ReadonlyArray<string>, oneAtATime = false): string {
  if (options.length === 1) {
    return language === 'ar' ? `تقصد ${quoteMemory(language, options[0])}؟` : `Do you mean ${quoteMemory(language, options[0])}?`;
  }
  return [
    oneAtATime ? LINES.oneAtATime[language] : LINES.whichOne[language],
    ...options.map((content, index) => `${index + 1}. ${quoteMemory(language, content)}`),
    LINES.numberIsEnough[language],
  ].join('\n');
}

/** Replies that carry no remembered words. */
export function plainReply(
  language: MemoryControlLanguage,
  outcome: Extract<MemoryControlOutcome, 'DECLINED_SENSITIVE' | 'TARGET_NOT_FOUND' | 'TARGET_NOT_SPECIFIED' | 'TARGET_CHANGED' | 'CLARIFICATION_DECLINED'>,
): string {
  switch (outcome) {
    case 'DECLINED_SENSITIVE': return LINES.declinedSensitive[language];
    case 'TARGET_NOT_FOUND': return LINES.targetNotFound[language];
    case 'TARGET_NOT_SPECIFIED': return LINES.targetNotSpecified[language];
    case 'TARGET_CHANGED': return LINES.targetChanged[language];
    case 'CLARIFICATION_DECLINED': return LINES.declined[language];
  }
}
