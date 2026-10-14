/**
 * S6-01 / CP3 VIS-2 — the Living Portrait projection (Product Owner decision 2026-10-14: direction A, refinements R1–R4).
 *
 * ONE pure function from the canonical `IntroductionsView` the server answered to what the portrait may show. It decides
 * no fact and holds no state: it only PLACES what the server already says, so the portrait is a presentation of
 * canonical server state and never a second source of truth.
 *
 *   settled   CONFIRMED facts, the owner's profile choices, the owner's notes (written by the owner, or confirmed by the
 *             owner from prior understanding — migration 0154 makes such a note ABOUT_ME when its class is
 *             PERSONAL_FACT, otherwise WHAT_MATTERS), and the owner's answered requirements.
 *   open      DECLARED and CORRECTED facts, authorized prior items awaiting the owner, and discrepancies. These are
 *             never drawn as established knowledge: they live in "Not settled yet", apart from the portrait (R1).
 *   missing   nothing is drawn for what was not given — no empty diagram, no slot, no count (R1).
 */
import type { ChromeLanguage } from '../orientation-chrome';
import type { IntroductionsDraft, IntroductionsFact, IntroductionsRequirementItem, IntroductionsView } from '../runtime-entry';
import { areaName } from './area-catalogue';
import { MONTHS, WORK_FIELD_NAMES, type IntroductionsCopy } from './copy';

export const MARITAL = ['NEVER_MARRIED', 'DIVORCED', 'WIDOWED', 'CURRENTLY_MARRIED'] as const;
export const FACT_ORDER: readonly IntroductionsFact[] = ['INTRODUCTION_FIRST_NAME', 'SEX', 'BIRTH_YEAR_MONTH', 'BROAD_AREA', 'MARITAL_STATUS'];

export const listSeparator = (language: ChromeLanguage) => (language === 'ar' ? '، ' : ', ');

/** A fact's value in words, whatever its state; `null` when it was not given. */
export function factValue(draft: IntroductionsDraft | null, fact: IntroductionsFact, copy: IntroductionsCopy, language: ChromeLanguage): string | null {
  const f = draft?.facts;
  if (!f) return null;
  switch (fact) {
    case 'INTRODUCTION_FIRST_NAME': return f.firstName?.value ?? null;
    case 'SEX': return f.sex === null ? null : f.sex.value === 'MALE' ? copy.male : copy.female;
    case 'BIRTH_YEAR_MONTH': return f.birthYearMonth === null ? null : `${MONTHS[language][f.birthYearMonth.month - 1]} ${f.birthYearMonth.year}`;
    case 'BROAD_AREA': return f.area === null ? null
      : f.area.regionCode === null ? areaName(f.area.countryCode, language) : `${areaName(f.area.regionCode, language)}${listSeparator(language)}${areaName(f.area.countryCode, language)}`;
    default: return f.maritalStatus === null ? null : copy[f.maritalStatus.value as (typeof MARITAL)[number]];
  }
}

export const factTitle = (fact: IntroductionsFact, copy: IntroductionsCopy) => ({
  INTRODUCTION_FIRST_NAME: copy.firstNameTitle, SEX: copy.sexTitle, BIRTH_YEAR_MONTH: copy.birthTitle, BROAD_AREA: copy.areaTitle, MARITAL_STATUS: copy.maritalTitle,
})[fact];

function factState(draft: IntroductionsDraft | null, fact: IntroductionsFact) {
  const f = draft?.facts;
  if (!f) return null;
  return ({ INTRODUCTION_FIRST_NAME: f.firstName, SEX: f.sex, BIRTH_YEAR_MONTH: f.birthYearMonth, BROAD_AREA: f.area, MARITAL_STATUS: f.maritalStatus })[fact]?.state ?? null;
}

/** One requirement as a label and a value, so a narrow screen wraps the value and never the label. */
export function requirementWords(item: IntroductionsRequirementItem, copy: IntroductionsCopy, language: ChromeLanguage): PortraitBound {
  if (item.dimension === 'AGE_RANGE') return { label: copy.AGE_RANGE, value: copy.ageRange.replace('{min}', String(item.min)).replace('{max}', String(item.max)) };
  if (item.dimension === 'MARITAL_STATUS') {
    return { label: copy.MARITAL_STATUS, value: (item.accepted ?? []).map((v) => copy[v as (typeof MARITAL)[number]]).join(listSeparator(language)) };
  }
  const regions = item.regionCodes?.map((r) => areaName(r, language)).join(listSeparator(language));
  return { label: copy.AREA, value: `${areaName(item.countryCode ?? '', language)}${regions ? ` (${regions})` : ''}` };
}

export interface PortraitNote { readonly key: string; readonly id: string; readonly body: string }
export interface PortraitBound { readonly label: string | null; readonly value: string }
/** One settled value of "About you", keyed so an arrival can be shown where it lands. */
export interface PortraitValue { readonly key: string; readonly value: string }

/** Something not settled: shown in "Not settled yet" with its own mark, never inside the portrait. */
export interface PortraitOpenItem {
  readonly key: string;
  readonly text: string;
  /** TO_CONFIRM: given or remembered, awaiting the owner. TO_DECIDE: changed, older or in conflict — asked, never presumed. */
  readonly state: 'TO_CONFIRM' | 'TO_DECIDE';
  /** Where a remembered item would go once the owner confirms it (0154: PERSONAL_FACT → ABOUT_ME, otherwise WHAT_MATTERS). */
  readonly lands: 'ABOUT' | 'MATTERS' | null;
}

export interface Portrait {
  /** The confirmed first name, or `null`. */
  readonly name: PortraitValue | null;
  /** Confirmed facts and the owner's work field, as short lines of whole values (sex · birth / area / marital · work). */
  readonly lines: readonly (readonly PortraitValue[])[];
  readonly intro: PortraitValue | null;
  readonly about: readonly PortraitNote[];
  readonly matters: readonly PortraitNote[];
  /** `null` while the owner has not answered; an answer of "none" is a value of its own. */
  readonly hard: readonly PortraitBound[] | null;
  readonly soft: readonly PortraitBound[] | null;
  readonly open: readonly PortraitOpenItem[];
  /** The open item the current objective is about, if it is about one. */
  readonly current: PortraitOpenItem | null;
  /** The optional steps the owner chose to leave out. */
  readonly notIncluded: readonly string[];
  /** Every settled key, for telling what a server-confirmed change added. */
  readonly settledKeys: ReadonlySet<string>;
}

export function projectPortrait(view: IntroductionsView, copy: IntroductionsCopy, language: ChromeLanguage): Portrait {
  const draft = view.draft;
  const confirmed = (fact: IntroductionsFact): PortraitValue | null => {
    const value = factState(draft, fact) === 'CONFIRMED' ? factValue(draft, fact, copy, language) : null;
    return value === null ? null : { key: `fact:${fact}`, value };
  };
  const workField = draft?.profile.workField ?? null;
  const work: PortraitValue | null = workField === null ? null : { key: 'work', value: WORK_FIELD_NAMES[workField]?.[language] ?? '' };
  const lines = [[confirmed('SEX'), confirmed('BIRTH_YEAR_MONTH')], [confirmed('BROAD_AREA')], [confirmed('MARITAL_STATUS'), work]]
    .map((line) => line.filter((x): x is PortraitValue => x !== null && x.value !== ''))
    .filter((line) => line.length > 0);
  const notes = draft?.notes ?? [];
  const note = (n: (typeof notes)[number]): PortraitNote => ({ key: `note:${n.id}`, id: n.id, body: n.body });
  const side = (s: { readonly answer: string | null; readonly items: readonly IntroductionsRequirementItem[] } | undefined, none: string): PortraitBound[] | null =>
    !s || s.answer === null ? null : s.answer === 'ITEMS' ? s.items.map((i) => requirementWords(i, copy, language)) : [{ label: null, value: none }];

  const open: PortraitOpenItem[] = [
    ...FACT_ORDER.flatMap((fact): PortraitOpenItem[] => {
      const state = factState(draft, fact);
      const value = factValue(draft, fact, copy, language);
      return (state === 'DECLARED' || state === 'CORRECTED') && value !== null
        ? [{ key: `fact:${fact}`, text: value, state: state === 'DECLARED' ? 'TO_CONFIRM' : 'TO_DECIDE', lands: null }] : [];
    }),
    ...view.priorItems.map((item): PortraitOpenItem => ({
      key: `prior:${item.memoryId}`, text: item.words, state: item.recency === 'NEEDS_RECHECK' ? 'TO_DECIDE' : 'TO_CONFIRM',
      lands: item.itemClass === 'PERSONAL_FACT' ? 'ABOUT' : 'MATTERS',
    })),
    ...((draft?.requirements.discrepancies.length ?? 0) === 0 ? [] : [{
      key: 'discrepancy', text: (draft?.requirements.discrepancies ?? []).map((d) => copy[d]).join(listSeparator(language)), state: 'TO_DECIDE' as const, lands: null,
    }]),
  ];

  const next = view.plan.next;
  const currentKey = next === null ? null
    : next.kind === 'CONFIRM_PRIOR_ITEM' || next.kind === 'CLARIFY_PRIOR_ITEM' ? `prior:${next.item.memoryId}`
      : next.kind === 'CONFIRM_DECLARED_FACT' || next.kind === 'RECONFIRM_CORRECTED_FACT' ? `fact:${next.fact}`
        : next.kind === 'RESOLVE_DISCREPANCY' ? 'discrepancy' : null;
  let current = open.find((item) => item.key === currentKey) ?? null;
  // A prior item the plan names is shown even if the list was bounded differently: it is the server's own item.
  if (current === null && next !== null && (next.kind === 'CONFIRM_PRIOR_ITEM' || next.kind === 'CLARIFY_PRIOR_ITEM')) {
    current = { key: `prior:${next.item.memoryId}`, text: next.item.words, state: next.kind === 'CLARIFY_PRIOR_ITEM' ? 'TO_DECIDE' : 'TO_CONFIRM',
      lands: next.item.itemClass === 'PERSONAL_FACT' ? 'ABOUT' : 'MATTERS' };
  }

  const name = confirmed('INTRODUCTION_FIRST_NAME');
  const intro: PortraitValue | null = draft?.profile.shortIntroduction ? { key: 'intro', value: draft.profile.shortIntroduction } : null;
  const about = notes.filter((n) => n.kind === 'ABOUT_ME').map(note);
  const matters = notes.filter((n) => n.kind === 'WHAT_MATTERS').map(note);
  const hard = side(draft?.requirements.hard, copy.hardNone);
  const soft = side(draft?.requirements.soft, copy.softNone);
  const settledKeys = new Set<string>([
    ...(name === null ? [] : [name.key]), ...lines.flat().map((v) => v.key), ...(intro === null ? [] : [intro.key]),
    ...about.map((n) => n.key), ...matters.map((n) => n.key), ...(hard === null ? [] : ['hard']), ...(soft === null ? [] : ['soft']),
  ]);
  const skipped = new Set(draft?.skippedSteps ?? []);
  const notIncluded = [
    ...(skipped.has('SHORT_INTRODUCTION') && intro === null ? [copy.shortIntroTitle] : []),
    ...(skipped.has('WORK_FIELD') && work === null ? [copy.workFieldTitle] : []),
  ];
  return { name, lines, intro, about, matters, hard, soft, open, current, notIncluded, settledKeys };
}

/** What a server-confirmed change ADDED to the portrait: the keys settled now that were not settled before. */
export function arrivals(before: Portrait | null, after: Portrait): ReadonlySet<string> {
  if (before === null) return new Set();
  return new Set([...after.settledKeys].filter((key) => !before.settledKeys.has(key)));
}

/** Whether the portrait holds anything at all. A preparation that settled nothing draws no portrait (R1). */
export const portraitIsEmpty = (p: Portrait) => p.settledKeys.size === 0;
