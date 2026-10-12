// W3-MEGA-M (E2E-D-13) — what QANDEEL says for a conversational Memory command.
//
// Deterministic, like the Safety gate's responses: the words are chosen from the outcome the database COMMITS, so a
// reply can never claim a change that did not happen. They quote the remembered words themselves and never show an
// id, a status, a score or any implementation vocabulary. Arabic is Egyptian conversational, verb-led, addressed
// without gendered imperatives; failures are framed as the process's («اتغيّرت»), not a confession.
//
// TASK-APPROVED DELEGATED COPY (W3-MEGA-M §10: no large copy redesign; plain, concise, non-diagnostic).
import type { MemoryControlOutcome } from './memory-control.types';
import type { MemorySubject } from './memory.types';

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
  // MEM-AR-01C — PRODUCT OWNER LOCKED COPY (Task Contract §9.1). Exact bytes; pinned by the MEM-AR-01 static contract.
  subjectQuestion: { ar: 'المعلومة دي عنك إنت، ولا عن حد تاني؟', en: 'Is this about you or someone else?' },
  inspectAboutOthers: {
    ar: 'وفيه كمان حاجات حكيتلي عنها تخص ناس تانية:',
    en: "And here are some things you've told me about other people:",
  },
  // CQ-1 (Product Owner, 2026-10-11): the same heading when no section precedes it.
  inspectAboutOthersFirst: {
    ar: 'فيه حاجات حكيتلي عنها تخص ناس تانية:',
    en: "Here are some things you've told me about other people:",
  },
  // L-10 (Product Owner, 2026-10-12): the subject labels of otherwise identical clarification options. Exact bytes.
  aboutYou: { ar: 'عنك إنت', en: 'about you' },
  aboutSomeoneElse: { ar: 'عن حد تاني', en: 'about someone else' },
} satisfies Record<string, Line>;

/**
 * MEM-AR-01C: `aboutOthers` are the current Memories about someone else (subject OTHER). They follow the user's own
 * section (and «inspectOlder») and precede the not-relied section; UNATTRIBUTED Memories stay in the user's section,
 * exactly as before, without claiming whom they are about.
 */
export function inspectReply(
  language: MemoryControlLanguage,
  relied: ReadonlyArray<string>,
  notRelied: ReadonlyArray<string>,
  hasOlder: boolean,
  aboutOthers: ReadonlyArray<string> = [],
): string {
  if (relied.length === 0 && notRelied.length === 0 && aboutOthers.length === 0) return LINES.nothingRemembered[language];
  const lines: string[] = [];
  if (relied.length > 0) {
    lines.push(LINES.inspectIntro[language], ...relied.map((content) => `• ${quoteMemory(language, content)}`));
    if (hasOlder) lines.push(LINES.inspectOlder[language]);
  }
  if (aboutOthers.length > 0) {
    lines.push(relied.length > 0 ? LINES.inspectAboutOthers[language] : LINES.inspectAboutOthersFirst[language]);
    lines.push(...aboutOthers.map((content) => `• ${quoteMemory(language, content)}`));
  }
  if (notRelied.length > 0) {
    lines.push(relied.length > 0 || aboutOthers.length > 0 ? LINES.inspectKeptNotRelied[language] : LINES.inspectKeptNotRelied[language].replace(/^وفيه/u, 'فيه').replace(/^And some/u, 'Some'));
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

/**
 * One option: "do you mean …?"; several: a short numbered list. Only the remembered words are shown - and (L-10) when
 * options would read the same while their established subjects differ, each of those with an established subject also
 * says whom it is about. An option whose subject was never established is never labelled. `subjects` follows `options`.
 */
export function clarificationReply(
  language: MemoryControlLanguage, options: ReadonlyArray<string>, oneAtATime = false,
  subjects: ReadonlyArray<MemorySubject | null | undefined> = [],
): string {
  if (options.length === 1) {
    return language === 'ar' ? `تقصد ${quoteMemory(language, options[0])}؟` : `Do you mean ${quoteMemory(language, options[0])}?`;
  }
  const shown = options.map((content) => quoteMemory(language, content));
  const labelled = (index: number): boolean => {
    const subject = subjects[index];
    return (subject === 'SELF' || subject === 'OTHER')
      && shown.some((words, other) => other !== index && words === shown[index] && (subjects[other] === 'SELF' || subjects[other] === 'OTHER') && subjects[other] !== subject);
  };
  return [
    oneAtATime ? LINES.oneAtATime[language] : LINES.whichOne[language],
    ...shown.map((words, index) => `${index + 1}. ${words}${labelled(index) ? ` — ${(subjects[index] === 'SELF' ? LINES.aboutYou : LINES.aboutSomeoneElse)[language]}` : ''}`),
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

/** MEM-AR-01C: the one question asked when a remember request does not say whom it is about. */
export function subjectQuestionReply(language: MemoryControlLanguage): string {
  return LINES.subjectQuestion[language];
}
