/**
 * S6-01 — the Introductions preparation device-proof stand-in. VALIDATION ONLY: reachable only in the S4-01 proof build
 * (`select-s401-proof-entry.mjs --apply`), never in the production bundle.
 *
 * Until a scenario is seeded nothing answers here, so the proof world behaves exactly as before (no entry is drawn: both
 * gates are closed). The seeds open the preparation for the visual proof and the Maestro journey:
 *
 *   qandeel://s401-proof/introductions/seed-new     N: no authorized prior understanding; assistance offered
 *   qandeel://s401-proof/introductions/seed-known   K: the permission granted; two CURRENT synthetic items
 *   qandeel://s401-proof/introductions/seed-mixed   C: one older synthetic item, a corrected fact and a dealbreaker /
 *                                                   preference conflict
 *   qandeel://s401-proof/introductions/seed-portrait VIS-2: a synthetic preparation ready for review (the Living Portrait:
 *                                                   About you, What matters, a dealbreaker and a preference)
 *   qandeel://s401-proof/introductions/close        the gates close (a draft stays readable and deletable)
 *
 * It answers in the shapes `apps/api/src/introductions-preparation` returns. The plan below is a compact SYNTHETIC
 * stand-in for the API's deterministic objective selector (which its own Jest suite proves), enough to walk the screens;
 * the items are synthetic words, never a real person's.
 */
import type { ChromeLanguage } from '../../orientation-chrome';

type Json = Record<string, unknown>;
type Fact = 'INTRODUCTION_FIRST_NAME' | 'SEX' | 'BIRTH_YEAR_MONTH' | 'BROAD_AREA' | 'MARITAL_STATUS';
const FACTS: readonly Fact[] = ['INTRODUCTION_FIRST_NAME', 'SEX', 'BIRTH_YEAR_MONTH', 'BROAD_AREA', 'MARITAL_STATUS'];
const KEY: Readonly<Record<Fact, string>> = {
  INTRODUCTION_FIRST_NAME: 'firstName', SEX: 'sex', BIRTH_YEAR_MONTH: 'birthYearMonth', BROAD_AREA: 'area', MARITAL_STATUS: 'maritalStatus',
};
const CONSENT = 'MATCHING_ONBOARDING_ASSISTANCE_V1';
const SYNTHETIC_ITEMS: Readonly<Record<ChromeLanguage, readonly string[]>> = {
  ar: ['هدفي أن أبني أسرة هادئة خلال السنوات القادمة', 'أحب الصدق والوضوح في التعامل', 'أفضّل السكن قريبًا من أهلي'],
  en: ['My goal is to build a calm family in the coming years', 'I value honesty and clarity', "I'd rather live close to my family"],
};

export interface S601ProofIntroductions {
  route(path: string, method: string, body: Json | undefined): { ok: boolean; status: number; json: () => Promise<unknown> } | undefined;
  seedNew(): void;
  seedKnown(): void;
  seedMixed(): void;
  seedPortrait(): void;
  close(): void;
}

export function createS601ProofIntroductions(language: ChromeLanguage): S601ProofIntroductions {
  let open = false;
  let seeded = false;
  let consent = false;
  let draft: Json | null = null;
  let items: { memoryId: string; itemClass: string; words: string; recency: 'CURRENT' | 'NEEDS_RECHECK' }[] = [];
  const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const emptyDraft = (): Json => ({
    version: 0, facts: { firstName: null, sex: null, birthYearMonth: null, area: null, maritalStatus: null },
    profile: { shortIntroduction: null, workField: null },
    requirements: { hard: { answer: null, items: [] }, soft: { answer: null, items: [] }, discrepancies: [] },
    notes: [], priorUnderstandingDecisions: 0, skippedSteps: [] as string[], review: { state: 'NOT_REVIEWED', reviewedVersion: null },
  });
  const d = () => (draft ??= emptyDraft()) as {
    version: number; facts: Record<string, Json | null>; profile: Json; requirements: { hard: Json; soft: Json; discrepancies: string[] };
    notes: Json[]; priorUnderstandingDecisions: number; skippedSteps: string[]; review: Json;
  };
  const touch = () => {
    const x = d();
    x.version += 1;
    if (x.review.state === 'REVIEWED') x.review = { state: 'CHANGED_SINCE_REVIEW', reviewedVersion: x.review.reviewedVersion };
  };

  function plan(): Json {
    const x = draft === null ? null : d();
    const skipped = new Set(x?.skippedSteps ?? []);
    const shown = consent && !skipped.has('PRIOR_UNDERSTANDING') ? items : [];
    const state = (fact: Fact) => ((x?.facts[KEY[fact]] as Json | null)?.state as string | undefined) ?? null;
    const objectives: Json[] = [];
    if (open && !consent && !skipped.has('ASSISTANCE_OFFER') && (x?.priorUnderstandingDecisions ?? 0) === 0) objectives.push({ kind: 'OFFER_ASSISTANCE' });
    const discrepancies = x?.requirements.discrepancies ?? [];
    if (discrepancies.length > 0) objectives.push({ kind: 'RESOLVE_DISCREPANCY', dimensions: discrepancies });
    for (const fact of FACTS) if (state(fact) === 'CORRECTED') objectives.push({ kind: 'RECONFIRM_CORRECTED_FACT', fact });
    for (const item of [...shown.filter((i) => i.recency === 'NEEDS_RECHECK'), ...shown.filter((i) => i.recency === 'CURRENT')]) {
      objectives.push({ kind: item.recency === 'NEEDS_RECHECK' ? 'CLARIFY_PRIOR_ITEM' : 'CONFIRM_PRIOR_ITEM', item });
    }
    for (const fact of FACTS) {
      if (state(fact) === null) objectives.push({ kind: 'ESTABLISH_FACT', fact });
      else if (state(fact) === 'DECLARED') objectives.push({ kind: 'CONFIRM_DECLARED_FACT', fact });
    }
    if (x?.requirements.hard.answer == null) objectives.push({ kind: 'ESTABLISH_HARD_REQUIREMENTS' });
    if (x?.requirements.soft.answer == null) objectives.push({ kind: 'ESTABLISH_SOFT_PREFERENCES' });
    const optional: Json[] = [];
    if ((x?.notes.length ?? 0) === 0 && !skipped.has('NOTES')) optional.push({ kind: 'ESTABLISH_PRIORITIES' });
    if (!x?.profile.shortIntroduction && !skipped.has('SHORT_INTRODUCTION')) optional.push({ kind: 'OFFER_SHORT_INTRODUCTION' });
    if (!x?.profile.workField && !skipped.has('WORK_FIELD')) optional.push({ kind: 'OFFER_WORK_FIELD' });
    const complete = FACTS.every((f) => state(f) === 'CONFIRMED') && x?.requirements.hard.answer != null && x?.requirements.soft.answer != null && discrepancies.length === 0;
    const reviewed = x?.review.state === 'REVIEWED';
    const all = reviewed ? [] : complete ? [...objectives, ...optional, { kind: 'REVIEW' }] : [...objectives, ...optional];
    const path = shown.some((i) => i.recency === 'NEEDS_RECHECK') || discrepancies.length > 0 || FACTS.some((f) => state(f) === 'CORRECTED') ? 'MIXED'
      : shown.length > 0 ? 'KNOWN' : 'NEW';
    return { path, stage: x === null ? 'NOT_STARTED' : reviewed ? 'REVIEWED' : complete ? 'READY_FOR_REVIEW' : 'PREPARING',
      next: all[0] ?? null, objectives: all, skipped: [], enrollment: 'UNAVAILABLE' };
  }

  function view(): Json {
    return {
      availability: { preparation: open, assistance: open, enrollment: false },
      accountDeletionPending: false,
      assistance: { consent: consent ? 'GRANTED' : 'NOT_GRANTED', grantedVersion: consent ? CONSENT : null, currentVersion: CONSENT },
      draft,
      priorItems: consent ? items : [],
      plan: plan(),
      phrasing: 'UNBOUND',
    };
  }

  function apply(kind: string, p: Json): string {
    const x = d();
    if (kind === 'SET_FACT') {
      const fact = p.fact as Fact;
      const previous = x.facts[KEY[fact]];
      const value = fact === 'INTRODUCTION_FIRST_NAME' ? { value: p.firstName } : fact === 'SEX' ? { value: p.sex } : fact === 'MARITAL_STATUS' ? { value: p.maritalStatus }
        : fact === 'BIRTH_YEAR_MONTH' ? { year: p.year, month: p.month } : { countryCode: p.countryCode, regionCode: p.regionCode };
      const wasConfirmed = previous !== null && previous !== undefined && (previous.state === 'CONFIRMED' || previous.state === 'CORRECTED');
      x.facts[KEY[fact]] = { ...value, state: wasConfirmed ? 'CORRECTED' : 'DECLARED' };
    } else if (kind === 'CONFIRM_FACT') {
      const f = x.facts[KEY[p.fact as Fact]];
      if (f === null || f === undefined || f.state === 'CONFIRMED') return 'NOTHING_TO_CONFIRM';
      x.facts[KEY[p.fact as Fact]] = { ...f, state: 'CONFIRMED' };
    } else if (kind === 'SET_REQUIREMENTS') {
      x.requirements[p.strength === 'HARD' ? 'hard' : 'soft'] = { answer: p.answer, items: p.items };
      x.requirements.discrepancies = [];
    } else if (kind === 'SET_PROFILE') {
      x.profile = { shortIntroduction: p.shortIntroduction, workField: p.workField };
    } else if (kind === 'ADD_NOTE') {
      x.notes.push({ id: `56010000-0000-4000-8000-${String(x.notes.length + 1).padStart(12, '0')}`, kind: p.kind, origin: 'USER_AUTHORED', body: p.body });
    } else if (kind === 'RECORD_PRIOR_UNDERSTANDING') {
      const item = items.find((i) => i.memoryId === p.memoryId);
      if (item === undefined) return 'NOT_ELIGIBLE';
      items = items.filter((i) => i !== item);
      x.priorUnderstandingDecisions += 1;
      if (p.decision === 'CONFIRMED' || p.decision === 'CORRECTED') {
        x.notes.push({ id: `56010000-0000-4000-8000-${String(x.notes.length + 1).padStart(12, '0')}`, kind: item.itemClass === 'PERSONAL_FACT' ? 'ABOUT_ME' : 'WHAT_MATTERS',
          origin: p.decision === 'CONFIRMED' ? 'CONFIRMED_FROM_PRIOR_UNDERSTANDING' : 'CORRECTED_FROM_PRIOR_UNDERSTANDING', body: p.decision === 'CONFIRMED' ? item.words : p.correctedBody });
      }
    } else if (kind === 'SKIP_STEP') {
      if (!x.skippedSteps.includes(p.step as string)) x.skippedSteps.push(p.step as string);
    } else if (kind === 'CONFIRM_REVIEW') {
      touch();
      x.review = { state: 'REVIEWED', reviewedVersion: x.version };
      return 'APPLIED';
    }
    touch();
    return 'APPLIED';
  }

  return {
    route(path, method, body) {
      if (!seeded || !path.startsWith('/introductions/')) return undefined;
      if (path === '/introductions/availability' && method === 'GET') return json(200, { preparation: open, assistance: open, enrollment: false, hasDraft: draft !== null });
      if (path === '/introductions/preparation' && method === 'GET') return json(200, view());
      if (method !== 'POST' || body === undefined) return json(400, { outcome: 'INVALID_REQUEST' });
      if (path === '/introductions/preparation/discard') { draft = null; consent = false; return json(200, { outcome: 'DISCARDED', view: view() }); }
      if (path === '/introductions/preparation/assistance/revoke') { const was = consent; consent = false; return json(200, { outcome: was ? 'REVOKED' : 'NOT_GRANTED', view: view() }); }
      if (!open) return json(200, { outcome: 'UNAVAILABLE', view: view() });
      if (path === '/introductions/preparation/assistance/grant') { consent = true; return json(200, { outcome: 'GRANTED', view: view() }); }
      if (path === '/introductions/preparation/commands') {
        const expected = body.expectedVersion as number;
        if (expected !== (draft === null ? 0 : d().version)) return json(200, { outcome: 'STALE_VERSION', view: view() });
        return json(200, { outcome: apply(body.kind as string, body.payload as Json), view: view() });
      }
      return json(404, {});
    },
    seedNew() { seeded = true; open = true; consent = false; draft = null; items = SYNTHETIC_ITEMS[language].slice(0, 2).map((words, i) => ({ memoryId: `56010000-0000-4000-8000-00000000010${i}`, itemClass: i === 0 ? 'GOAL' : 'STABLE_PREFERENCE', words, recency: 'CURRENT' as const })); },
    seedKnown() {
      seeded = true; open = true; consent = true; draft = null;
      items = SYNTHETIC_ITEMS[language].slice(0, 2).map((words, i) => ({ memoryId: `56010000-0000-4000-8000-00000000020${i}`, itemClass: i === 0 ? 'GOAL' : 'STABLE_PREFERENCE', words, recency: 'CURRENT' as const }));
    },
    seedMixed() {
      seeded = true; open = true; consent = true;
      items = [{ memoryId: '56010000-0000-4000-8000-000000000300', itemClass: 'STABLE_PREFERENCE', words: SYNTHETIC_ITEMS[language][2], recency: 'NEEDS_RECHECK' }];
      draft = emptyDraft();
      const x = d();
      x.version = 7;
      x.facts.firstName = { value: language === 'ar' ? 'سارة' : 'Sara', state: 'CONFIRMED' };
      x.facts.maritalStatus = { value: 'DIVORCED', state: 'CORRECTED' };
      x.requirements = {
        hard: { answer: 'ITEMS', items: [{ dimension: 'AGE_RANGE', min: 28, max: 35 }] },
        soft: { answer: 'ITEMS', items: [{ dimension: 'AGE_RANGE', min: 30, max: 40 }] },
        discrepancies: ['AGE_RANGE'],
      };
    },
    seedPortrait() {
      seeded = true; open = true; consent = true; items = [];
      const ar = language === 'ar';
      draft = emptyDraft();
      const x = d();
      x.version = 16;
      x.priorUnderstandingDecisions = 3;
      x.facts = {
        firstName: { value: ar ? 'سلمى' : 'Salma', state: 'CONFIRMED' }, sex: { value: 'FEMALE', state: 'CONFIRMED' },
        birthYearMonth: { year: 1996, month: 5, state: 'CONFIRMED' }, area: { countryCode: 'EG', regionCode: 'EG-ALX', state: 'CONFIRMED' },
        maritalStatus: { value: 'NEVER_MARRIED', state: 'CONFIRMED' },
      };
      x.profile = { shortIntroduction: null, workField: 'EDUCATION' };
      x.requirements = { hard: { answer: 'ITEMS', items: [{ dimension: 'AREA', countryCode: 'EG' }] }, soft: { answer: 'ITEMS', items: [{ dimension: 'AGE_RANGE', min: 28, max: 36 }] }, discrepancies: [] };
      const note = (n: number, kind: string, origin: string, body: string) => ({ id: `56010000-0000-4000-8000-00000000040${n}`, kind, origin, body });
      x.notes = [
        note(1, 'WHAT_MATTERS', 'CONFIRMED_FROM_PRIOR_UNDERSTANDING', ar ? 'أريد أن أبقى قريبة من أهلي في الإسكندرية بعد الزواج.' : 'I want to stay close to my family in Alexandria after marriage.'),
        note(2, 'ABOUT_ME', 'CONFIRMED_FROM_PRIOR_UNDERSTANDING', ar ? 'أعمل معلمة، وأحب عملي ولا أنوي تركه.' : "I'm a teacher. I love my work and don't plan to leave it."),
        note(3, 'WHAT_MATTERS', 'CONFIRMED_FROM_PRIOR_UNDERSTANDING', ar ? 'أتمنى بيتًا فيه حوار، لا صمت.' : 'I hope for a home with conversation, not silence.'),
        note(4, 'WHAT_MATTERS', 'USER_AUTHORED', ar ? 'الصدق، والهدوء عند الاختلاف.' : 'Honesty, and staying calm when we disagree.'),
      ];
      x.skippedSteps = ['SHORT_INTRODUCTION'];
    },
    close() { open = false; },
  };
}
