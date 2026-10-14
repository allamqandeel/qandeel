import type { DraftView, PreparationRecord, PriorItem } from './introductions-preparation.types';
import { PRIOR_ITEMS_PER_PLAN, selectOnboardingObjectives, type Objective } from './onboarding-objective-selector';

// S6-01 — the deterministic objective selector (Task Contract WP3, §5 N / K / C; Product Owner authorization CP3).
// Synthetic, privacy-safe personas only: nothing here is a real person or a production recommendation.

const record = (over: Partial<PreparationRecord> = {}, draft: DraftView | null = null): PreparationRecord => ({
  availability: { preparation: true, assistance: true, enrollment: false },
  accountDeletionPending: false,
  assistance: { consent: 'NOT_GRANTED', grantedVersion: null, currentVersion: 'MATCHING_ONBOARDING_ASSISTANCE_V1' },
  draft,
  ...over,
});
const granted = { consent: 'GRANTED' as const, grantedVersion: 'MATCHING_ONBOARDING_ASSISTANCE_V1', currentVersion: 'MATCHING_ONBOARDING_ASSISTANCE_V1' };
const emptyDraft = (over: Partial<DraftView> = {}): DraftView => ({
  version: 1,
  facts: { firstName: null, sex: null, birthYearMonth: null, area: null, maritalStatus: null },
  profile: { shortIntroduction: null, workField: null },
  requirements: { hard: { answer: null, items: [] }, soft: { answer: null, items: [] }, discrepancies: [] },
  notes: [], priorUnderstandingDecisions: 0, skippedSteps: [], review: { state: 'NOT_REVIEWED', reviewedVersion: null },
  ...over,
});
const confirmedFacts: DraftView['facts'] = {
  firstName: { value: 'سارة', state: 'CONFIRMED' }, sex: { value: 'FEMALE', state: 'CONFIRMED' },
  birthYearMonth: { year: 1996, month: 5, state: 'CONFIRMED' }, area: { countryCode: 'EG', regionCode: 'EG-ALX', state: 'CONFIRMED' },
  maritalStatus: { value: 'NEVER_MARRIED', state: 'CONFIRMED' },
};
const item = (n: number, recency: PriorItem['recency'], itemClass: PriorItem['itemClass'] = 'STABLE_PREFERENCE'): PriorItem => ({
  memoryId: `00000000-0000-4000-8000-00000000000${n}`, itemClass, words: `عبارة ${n}`, recency,
});
const kinds = (objectives: readonly Objective[]) => objectives.map((o) => ('fact' in o ? `${o.kind}:${o.fact}` : o.kind));

describe('S6-01 — the onboarding objective selector', () => {
  describe('N — a new user: little or no authorized prior understanding', () => {
    it('asks once for the separate permission, then foundational questions; never claims prior understanding', () => {
      const plan = selectOnboardingObjectives(record(), []);
      expect(plan.path).toBe('NEW');
      expect(plan.stage).toBe('NOT_STARTED');
      expect(kinds(plan.objectives)).toEqual([
        'OFFER_ASSISTANCE',
        'ESTABLISH_FACT:INTRODUCTION_FIRST_NAME', 'ESTABLISH_FACT:SEX', 'ESTABLISH_FACT:BIRTH_YEAR_MONTH', 'ESTABLISH_FACT:BROAD_AREA', 'ESTABLISH_FACT:MARITAL_STATUS',
        'ESTABLISH_HARD_REQUIREMENTS', 'ESTABLISH_SOFT_PREFERENCES',
        'ESTABLISH_PRIORITIES', 'OFFER_SHORT_INTRODUCTION', 'OFFER_WORK_FIELD',
      ]);
      expect(plan.enrollment).toBe('UNAVAILABLE');
    });

    it('a declined offer is never re-asked; granted with nothing qualifying stays NEW', () => {
      const declined = selectOnboardingObjectives(record({}, emptyDraft({ skippedSteps: ['ASSISTANCE_OFFER'] })), []);
      expect(kinds(declined.objectives)).not.toContain('OFFER_ASSISTANCE');
      const grantedEmpty = selectOnboardingObjectives(record({ assistance: granted }), []);
      expect(grantedEmpty.path).toBe('NEW');
      expect(kinds(grantedEmpty.objectives)[0]).toBe('ESTABLISH_FACT:INTRODUCTION_FIRST_NAME');
    });

    it('no offer while the assistance gate is closed', () => {
      const plan = selectOnboardingObjectives(record({ availability: { preparation: true, assistance: false, enrollment: false } }), []);
      expect(kinds(plan.objectives)).not.toContain('OFFER_ASSISTANCE');
    });
  });

  describe('K — a known user: current, authorized prior understanding', () => {
    const items = [item(1, 'CURRENT', 'GOAL'), item(2, 'CURRENT'), item(3, 'CURRENT', 'PERSONAL_FACT')];

    it('confirms the specific known items first, then asks only what is missing; confirmed facts are skipped', () => {
      const draft = emptyDraft({ facts: { ...confirmedFacts, birthYearMonth: null, maritalStatus: { value: 'DIVORCED', state: 'DECLARED' } } });
      const plan = selectOnboardingObjectives(record({ assistance: granted }, draft), items);
      expect(plan.path).toBe('KNOWN');
      expect(kinds(plan.objectives)).toEqual([
        'CONFIRM_PRIOR_ITEM', 'CONFIRM_PRIOR_ITEM', 'CONFIRM_PRIOR_ITEM',
        'ESTABLISH_FACT:BIRTH_YEAR_MONTH', 'CONFIRM_DECLARED_FACT:MARITAL_STATUS',
        'ESTABLISH_HARD_REQUIREMENTS', 'ESTABLISH_SOFT_PREFERENCES',
        'ESTABLISH_PRIORITIES', 'OFFER_SHORT_INTRODUCTION', 'OFFER_WORK_FIELD',
      ]);
      expect(plan.skipped.filter((s) => s.reason === 'ALREADY_CONFIRMED').map((s) => s.objective))
        .toEqual(['ESTABLISH_FACT:INTRODUCTION_FIRST_NAME', 'ESTABLISH_FACT:SEX', 'ESTABLISH_FACT:BROAD_AREA']);
      expect(plan.next).toEqual({ kind: 'CONFIRM_PRIOR_ITEM', item: items[0] });
    });

    it('once the owner confirmed what matters to them, the open priorities question is skipped as already known', () => {
      const draft = emptyDraft({ notes: [{ id: '00000000-0000-4000-8000-0000000000aa', kind: 'WHAT_MATTERS', origin: 'CONFIRMED_FROM_PRIOR_UNDERSTANDING', body: 'الصدق' }] });
      const plan = selectOnboardingObjectives(record({ assistance: granted }, draft), []);
      expect(kinds(plan.objectives)).not.toContain('ESTABLISH_PRIORITIES');
      expect(plan.skipped).toContainEqual({ objective: 'ESTABLISH_PRIORITIES', reason: 'ALREADY_KNOWN_FROM_CONFIRMED_UNDERSTANDING' });
    });

    it('an item never answers a required fact: a known item about where the owner lives still leaves the area to the owner', () => {
      const plan = selectOnboardingObjectives(record({ assistance: granted }), [{ ...item(4, 'CURRENT', 'PERSONAL_FACT'), words: 'أنا ساكنة في الإسكندرية' }]);
      expect(kinds(plan.objectives)).toContain('ESTABLISH_FACT:BROAD_AREA');
    });

    it('at most a bounded number of items per plan; ending the review stops them', () => {
      const many = Array.from({ length: 9 }, (_, i) => item(i, 'CURRENT'));
      const plan = selectOnboardingObjectives(record({ assistance: granted }), many);
      expect(plan.objectives.filter((o) => o.kind === 'CONFIRM_PRIOR_ITEM')).toHaveLength(PRIOR_ITEMS_PER_PLAN);
      const ended = selectOnboardingObjectives(record({ assistance: granted }, emptyDraft({ skippedSteps: ['PRIOR_UNDERSTANDING'] })), many);
      expect(ended.objectives.some((o) => o.kind === 'CONFIRM_PRIOR_ITEM')).toBe(false);
      expect(ended.path).toBe('NEW');
    });
  });

  describe('C — contradictory or outdated understanding', () => {
    it('resolves the owner\'s own contradiction first, reconfirms a corrected fact, and clarifies older items before confirming current ones', () => {
      const draft = emptyDraft({
        facts: { ...confirmedFacts, maritalStatus: { value: 'DIVORCED', state: 'CORRECTED' } },
        requirements: {
          hard: { answer: 'ITEMS', items: [{ dimension: 'AGE_RANGE', min: 28, max: 35 }] },
          soft: { answer: 'ITEMS', items: [{ dimension: 'AGE_RANGE', min: 30, max: 40 }] },
          discrepancies: ['AGE_RANGE'],
        },
      });
      const plan = selectOnboardingObjectives(record({ assistance: granted }, draft), [item(1, 'CURRENT'), item(2, 'NEEDS_RECHECK')]);
      expect(plan.path).toBe('MIXED');
      expect(kinds(plan.objectives).slice(0, 4)).toEqual(['RESOLVE_DISCREPANCY', 'RECONFIRM_CORRECTED_FACT:MARITAL_STATUS', 'CLARIFY_PRIOR_ITEM', 'CONFIRM_PRIOR_ITEM']);
      expect(plan.objectives[0]).toEqual({ kind: 'RESOLVE_DISCREPANCY', dimensions: ['AGE_RANGE'] });
      expect(plan.objectives.some((o) => o.kind === 'REVIEW')).toBe(false);
    });

    it('older items alone make the path MIXED: clarification, never presumptive confirmation', () => {
      const plan = selectOnboardingObjectives(record({ assistance: granted }), [item(1, 'NEEDS_RECHECK'), item(2, 'NEEDS_RECHECK')]);
      expect(plan.path).toBe('MIXED');
      expect(plan.objectives.filter((o) => o.kind === 'CLARIFY_PRIOR_ITEM')).toHaveLength(2);
      expect(plan.objectives.some((o) => o.kind === 'CONFIRM_PRIOR_ITEM')).toBe(false);
    });
  });

  describe('N, K and C pursue materially different objective sequences — not one questionnaire reworded', () => {
    it('three distinct sequences from the same starting draft', () => {
      const n = kinds(selectOnboardingObjectives(record(), []).objectives);
      const k = kinds(selectOnboardingObjectives(record({ assistance: granted }), [item(1, 'CURRENT')]).objectives);
      const c = kinds(selectOnboardingObjectives(record({ assistance: granted }), [item(1, 'NEEDS_RECHECK')]).objectives);
      expect(new Set([n.join(), k.join(), c.join()]).size).toBe(3);
      expect(n[0]).toBe('OFFER_ASSISTANCE');
      expect(k[0]).toBe('CONFIRM_PRIOR_ITEM');
      expect(c[0]).toBe('CLARIFY_PRIOR_ITEM');
    });
  });

  describe('safety of the plan', () => {
    it('no prior item is used without the permission, whatever the reader was given', () => {
      const plan = selectOnboardingObjectives(record(), [item(1, 'CURRENT')]);
      expect(plan.objectives.some((o) => o.kind === 'CONFIRM_PRIOR_ITEM' || o.kind === 'CLARIFY_PRIOR_ITEM')).toBe(false);
      expect(plan.path).toBe('NEW');
      const gateClosed = selectOnboardingObjectives(record({ assistance: granted, availability: { preparation: true, assistance: false, enrollment: false } }), [item(1, 'CURRENT')]);
      expect(gateClosed.objectives.some((o) => o.kind === 'CONFIRM_PRIOR_ITEM')).toBe(false);
    });

    it('review only when every fact is confirmed, both answers given and nothing contradicts; optional steps are offered before it and are skippable', () => {
      const complete = emptyDraft({
        facts: confirmedFacts,
        requirements: { hard: { answer: 'NONE_ADDITIONAL', items: [] }, soft: { answer: 'NONE', items: [] }, discrepancies: [] },
      });
      const plan = selectOnboardingObjectives(record({ assistance: granted }, complete), []);
      expect(plan.stage).toBe('READY_FOR_REVIEW');
      expect(kinds(plan.objectives)).toEqual(['ESTABLISH_PRIORITIES', 'OFFER_SHORT_INTRODUCTION', 'OFFER_WORK_FIELD', 'REVIEW']);
      const skippedAll = selectOnboardingObjectives(record({ assistance: granted }, { ...complete, skippedSteps: ['NOTES', 'SHORT_INTRODUCTION', 'WORK_FIELD'] }), []);
      expect(kinds(skippedAll.objectives)).toEqual(['REVIEW']);
    });

    it('a reviewed draft asks nothing more, and is never enrollment', () => {
      const reviewed = emptyDraft({
        facts: confirmedFacts,
        requirements: { hard: { answer: 'NONE_ADDITIONAL', items: [] }, soft: { answer: 'NONE', items: [] }, discrepancies: [] },
        review: { state: 'REVIEWED', reviewedVersion: 1 },
      });
      const plan = selectOnboardingObjectives(record({}, reviewed), []);
      expect(plan).toMatchObject({ stage: 'REVIEWED', next: null, objectives: [], enrollment: 'UNAVAILABLE' });
    });

    it('a change after review brings the review back', () => {
      const changed = emptyDraft({
        facts: confirmedFacts,
        requirements: { hard: { answer: 'NONE_ADDITIONAL', items: [] }, soft: { answer: 'NONE', items: [] }, discrepancies: [] },
        skippedSteps: ['NOTES', 'SHORT_INTRODUCTION', 'WORK_FIELD', 'ASSISTANCE_OFFER'],
        review: { state: 'CHANGED_SINCE_REVIEW', reviewedVersion: 1 },
      });
      expect(kinds(selectOnboardingObjectives(record({}, changed), []).objectives)).toEqual(['REVIEW']);
    });
  });
});
