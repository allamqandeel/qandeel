import type { DeclaredFact, DraftView, PreparationRecord, PriorItem, RequirementDimension } from './introductions-preparation.types';

/**
 * S6-01 — the Matching Onboarding Objective selector (Task Contract WP3; Product Owner authorization §2, CP3).
 *
 * Deterministic and provider-neutral. It chooses the PURPOSE of the next step, not its wording, from exactly two
 * inputs: the owner's current preparation (server-confirmed) and, only when the owner granted the separate
 * MATCHING_ONBOARDING_ASSISTANCE permission and both gates are open, the bounded items of the owner's own prior
 * understanding (CW2-06A §3). It infers nothing: no item is mapped to a fact, a requirement or a trait, and a Hypothesis,
 * HIM measurement or someone else's information never reaches it.
 *
 * Objectives, in the order they are pursued:
 *   OFFER_ASSISTANCE            ask once whether QANDEEL may show what it already understands (declinable; never re-asked)
 *   RESOLVE_DISCREPANCY         a soft preference outside the hard requirement of the same dimension: the owner decides
 *   RECONFIRM_CORRECTED_FACT    a fact changed after it was confirmed must be confirmed again
 *   CLARIFY_PRIOR_ITEM          an older prior-understanding item: asked as a question, never presumed true
 *   CONFIRM_PRIOR_ITEM          a current prior-understanding item: confirm, correct, mark no longer accurate, or decline
 *   ESTABLISH_FACT / CONFIRM_DECLARED_FACT    each required fact, in a fixed order; a confirmed one is skipped
 *   ESTABLISH_HARD_REQUIREMENTS / ESTABLISH_SOFT_PREFERENCES    kept apart; "none" is a valid answer
 *   ESTABLISH_PRIORITIES        what matters to the owner, in their words; skipped when the owner already confirmed some
 *   OFFER_SHORT_INTRODUCTION / OFFER_WORK_FIELD                 optional, skippable
 *   REVIEW                      everything required is confirmed and consistent; the owner reviews the draft
 * Then nothing: the draft is reviewed, and real enrollment is not available yet.
 */

export const REQUIRED_FACT_ORDER: readonly DeclaredFact[] = ['INTRODUCTION_FIRST_NAME', 'SEX', 'BIRTH_YEAR_MONTH', 'BROAD_AREA', 'MARITAL_STATUS'];
/** At most this many prior-understanding items are pursued in one plan: one purposeful question at a time, no fatigue. */
export const PRIOR_ITEMS_PER_PLAN = 5;

export type Objective =
  | { readonly kind: 'OFFER_ASSISTANCE' }
  | { readonly kind: 'RESOLVE_DISCREPANCY'; readonly dimensions: readonly RequirementDimension[] }
  | { readonly kind: 'RECONFIRM_CORRECTED_FACT'; readonly fact: DeclaredFact }
  | { readonly kind: 'CLARIFY_PRIOR_ITEM'; readonly item: PriorItem }
  | { readonly kind: 'CONFIRM_PRIOR_ITEM'; readonly item: PriorItem }
  | { readonly kind: 'ESTABLISH_FACT'; readonly fact: DeclaredFact }
  | { readonly kind: 'CONFIRM_DECLARED_FACT'; readonly fact: DeclaredFact }
  | { readonly kind: 'ESTABLISH_HARD_REQUIREMENTS' }
  | { readonly kind: 'ESTABLISH_SOFT_PREFERENCES' }
  | { readonly kind: 'ESTABLISH_PRIORITIES' }
  | { readonly kind: 'OFFER_SHORT_INTRODUCTION' }
  | { readonly kind: 'OFFER_WORK_FIELD' }
  | { readonly kind: 'REVIEW' };

export type SkipReason = 'ALREADY_CONFIRMED' | 'ALREADY_ANSWERED' | 'ALREADY_KNOWN_FROM_CONFIRMED_UNDERSTANDING' | 'SKIPPED_BY_OWNER';
export interface SkippedObjective { readonly objective: string; readonly reason: SkipReason }

/**
 * NEW: nothing authorized and current is known — the onboarding says so plainly and asks foundational questions.
 * KNOWN: authorized, current prior understanding exists — the onboarding says it will check that understanding.
 * MIXED: what is known is older, contradicts the owner's own draft, or was corrected — clarification comes first.
 */
export type OnboardingPath = 'NEW' | 'KNOWN' | 'MIXED';
export type PreparationStage = 'NOT_STARTED' | 'PREPARING' | 'READY_FOR_REVIEW' | 'REVIEWED';

export interface ObjectivePlan {
  readonly path: OnboardingPath;
  readonly stage: PreparationStage;
  readonly next: Objective | null;
  readonly objectives: readonly Objective[];
  readonly skipped: readonly SkippedObjective[];
  /** Always UNAVAILABLE in S6-01: the six 0149 commands stay closed (Product Owner D1). */
  readonly enrollment: 'UNAVAILABLE';
}

const factState = (draft: DraftView | null, fact: DeclaredFact) => {
  if (!draft) return null;
  const f = draft.facts;
  switch (fact) {
    case 'INTRODUCTION_FIRST_NAME': return f.firstName?.state ?? null;
    case 'SEX': return f.sex?.state ?? null;
    case 'BIRTH_YEAR_MONTH': return f.birthYearMonth?.state ?? null;
    case 'BROAD_AREA': return f.area?.state ?? null;
    default: return f.maritalStatus?.state ?? null;
  }
};

export function selectOnboardingObjectives(record: PreparationRecord, priorItems: readonly PriorItem[]): ObjectivePlan {
  const draft = record.draft;
  const skippedSteps = new Set(draft?.skippedSteps ?? []);
  const assistanceUsable = record.availability.assistance && record.assistance.consent === 'GRANTED';
  // Only what the owner authorized, and only while the owner has not ended the review of prior items.
  const items = assistanceUsable && !skippedSteps.has('PRIOR_UNDERSTANDING') ? priorItems : [];
  const objectives: Objective[] = [];
  const skipped: SkippedObjective[] = [];

  if (record.availability.assistance && record.assistance.consent === 'NOT_GRANTED'
      && !skippedSteps.has('ASSISTANCE_OFFER') && (draft?.priorUnderstandingDecisions ?? 0) === 0) {
    objectives.push({ kind: 'OFFER_ASSISTANCE' });
  }

  const discrepancies = draft?.requirements.discrepancies ?? [];
  if (discrepancies.length > 0) objectives.push({ kind: 'RESOLVE_DISCREPANCY', dimensions: discrepancies });

  for (const fact of REQUIRED_FACT_ORDER) {
    if (factState(draft, fact) === 'CORRECTED') objectives.push({ kind: 'RECONFIRM_CORRECTED_FACT', fact });
  }

  // Clarification before presumptive confirmation: older items first, then current ones; bounded.
  const pursued = [...items.filter((i) => i.recency === 'NEEDS_RECHECK'), ...items.filter((i) => i.recency === 'CURRENT')]
    .slice(0, PRIOR_ITEMS_PER_PLAN);
  for (const item of pursued) {
    objectives.push(item.recency === 'NEEDS_RECHECK' ? { kind: 'CLARIFY_PRIOR_ITEM', item } : { kind: 'CONFIRM_PRIOR_ITEM', item });
  }

  for (const fact of REQUIRED_FACT_ORDER) {
    const state = factState(draft, fact);
    if (state === null) objectives.push({ kind: 'ESTABLISH_FACT', fact });
    else if (state === 'DECLARED') objectives.push({ kind: 'CONFIRM_DECLARED_FACT', fact });
    else if (state === 'CONFIRMED') skipped.push({ objective: `ESTABLISH_FACT:${fact}`, reason: 'ALREADY_CONFIRMED' });
  }

  if (draft?.requirements.hard.answer == null) objectives.push({ kind: 'ESTABLISH_HARD_REQUIREMENTS' });
  else skipped.push({ objective: 'ESTABLISH_HARD_REQUIREMENTS', reason: 'ALREADY_ANSWERED' });
  if (draft?.requirements.soft.answer == null) objectives.push({ kind: 'ESTABLISH_SOFT_PREFERENCES' });
  else skipped.push({ objective: 'ESTABLISH_SOFT_PREFERENCES', reason: 'ALREADY_ANSWERED' });

  const optional: Objective[] = [];
  const notes = draft?.notes ?? [];
  if (notes.some((n) => n.origin !== 'USER_AUTHORED')) {
    skipped.push({ objective: 'ESTABLISH_PRIORITIES', reason: 'ALREADY_KNOWN_FROM_CONFIRMED_UNDERSTANDING' });
  } else if (notes.length > 0) {
    skipped.push({ objective: 'ESTABLISH_PRIORITIES', reason: 'ALREADY_ANSWERED' });
  } else if (skippedSteps.has('NOTES')) {
    skipped.push({ objective: 'ESTABLISH_PRIORITIES', reason: 'SKIPPED_BY_OWNER' });
  } else {
    optional.push({ kind: 'ESTABLISH_PRIORITIES' });
  }
  if (draft?.profile.shortIntroduction) skipped.push({ objective: 'OFFER_SHORT_INTRODUCTION', reason: 'ALREADY_ANSWERED' });
  else if (skippedSteps.has('SHORT_INTRODUCTION')) skipped.push({ objective: 'OFFER_SHORT_INTRODUCTION', reason: 'SKIPPED_BY_OWNER' });
  else optional.push({ kind: 'OFFER_SHORT_INTRODUCTION' });
  if (draft?.profile.workField) skipped.push({ objective: 'OFFER_WORK_FIELD', reason: 'ALREADY_ANSWERED' });
  else if (skippedSteps.has('WORK_FIELD')) skipped.push({ objective: 'OFFER_WORK_FIELD', reason: 'SKIPPED_BY_OWNER' });
  else optional.push({ kind: 'OFFER_WORK_FIELD' });

  const requiredComplete = REQUIRED_FACT_ORDER.every((fact) => factState(draft, fact) === 'CONFIRMED')
    && draft?.requirements.hard.answer != null && draft?.requirements.soft.answer != null && discrepancies.length === 0;
  const reviewed = draft?.review.state === 'REVIEWED';
  // Required work first; each optional step is offered once, before the review; a reviewed draft asks nothing more.
  const plan: Objective[] = reviewed ? []
    : requiredComplete ? [...objectives, ...optional, { kind: 'REVIEW' }]
    : [...objectives, ...optional];

  const hasCurrent = items.some((i) => i.recency === 'CURRENT');
  const hasOlder = items.some((i) => i.recency === 'NEEDS_RECHECK');
  const corrected = REQUIRED_FACT_ORDER.some((fact) => factState(draft, fact) === 'CORRECTED');
  const path: OnboardingPath = hasOlder || discrepancies.length > 0 || corrected ? 'MIXED' : hasCurrent ? 'KNOWN' : 'NEW';
  const stage: PreparationStage = draft === null ? 'NOT_STARTED' : reviewed ? 'REVIEWED' : requiredComplete ? 'READY_FOR_REVIEW' : 'PREPARING';

  return { path, stage, next: plan[0] ?? null, objectives: plan, skipped, enrollment: 'UNAVAILABLE' };
}
