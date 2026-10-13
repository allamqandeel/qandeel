/**
 * S6-01 — Introductions with QANDEEL: the pre-enrollment preparation (CW2-06A §2–§5; migration 0154). The closed
 * vocabularies the API accepts and returns. They mirror the database's CHECKs; the database stays the authority and
 * refuses anything these let through.
 */

export const DECLARED_FACTS = ['INTRODUCTION_FIRST_NAME', 'SEX', 'BIRTH_YEAR_MONTH', 'BROAD_AREA', 'MARITAL_STATUS'] as const;
export type DeclaredFact = (typeof DECLARED_FACTS)[number];

export const FACT_STATES = ['DECLARED', 'CONFIRMED', 'CORRECTED'] as const;
export type FactState = (typeof FACT_STATES)[number];

export const SEX_VALUES = ['MALE', 'FEMALE'] as const;
export const MARITAL_STATUSES = ['NEVER_MARRIED', 'DIVORCED', 'WIDOWED', 'CURRENTLY_MARRIED'] as const;
export const WORK_FIELDS = ['HEALTH', 'EDUCATION', 'ENGINEERING_TECHNOLOGY', 'BUSINESS_FINANCE', 'LAW_GOVERNMENT', 'MEDIA_ARTS',
  'SCIENCE_RESEARCH', 'CRAFTS_TRADES', 'SERVICES_HOSPITALITY', 'AGRICULTURE_ENVIRONMENT', 'STUDENT', 'NOT_CURRENTLY_WORKING', 'OTHER'] as const;
export const SKIP_STEPS = ['NOTES', 'SHORT_INTRODUCTION', 'WORK_FIELD', 'ASSISTANCE_OFFER', 'PRIOR_UNDERSTANDING'] as const;
export type SkipStep = (typeof SKIP_STEPS)[number];
export const NOTE_KINDS = ['ABOUT_ME', 'WHAT_MATTERS'] as const;
export const NOTE_ORIGINS = ['USER_AUTHORED', 'CONFIRMED_FROM_PRIOR_UNDERSTANDING', 'CORRECTED_FROM_PRIOR_UNDERSTANDING'] as const;
export const PRIOR_DECISIONS = ['CONFIRMED', 'CORRECTED', 'NO_LONGER_ACCURATE', 'DECLINED'] as const;
export const REQUIREMENT_DIMENSIONS = ['AGE_RANGE', 'MARITAL_STATUS', 'AREA'] as const;
export type RequirementDimension = (typeof REQUIREMENT_DIMENSIONS)[number];

export const COMMAND_KINDS = ['SET_FACT', 'CONFIRM_FACT', 'SET_PROFILE', 'SET_REQUIREMENTS', 'ADD_NOTE', 'REMOVE_NOTE',
  'RECORD_PRIOR_UNDERSTANDING', 'SKIP_STEP', 'CONFIRM_REVIEW'] as const;
export type CommandKind = (typeof COMMAND_KINDS)[number];

/** Every answer the database gives a draft command; only APPLIED changed anything. */
export const COMMAND_OUTCOMES = ['APPLIED', 'UNAVAILABLE', 'ACCOUNT_DELETION_PENDING', 'STALE_VERSION', 'COMMAND_ID_REUSED',
  'NOT_ELIGIBLE', 'ALREADY_DECIDED', 'NOTE_LIMIT_REACHED', 'NOTHING_TO_CONFIRM', 'NOT_READY_FOR_REVIEW'] as const;
export type CommandOutcome = (typeof COMMAND_OUTCOMES)[number];
export const DISCARD_OUTCOMES = ['DISCARDED'] as const;
export const GRANT_OUTCOMES = ['GRANTED', 'ALREADY_GRANTED', 'UNAVAILABLE', 'ACCOUNT_DELETION_PENDING', 'CONSENT_VERSION_NOT_CURRENT', 'COMMAND_ID_REUSED'] as const;
export const REVOKE_OUTCOMES = ['REVOKED', 'NOT_GRANTED', 'COMMAND_ID_REUSED'] as const;

export type PriorItemRecency = 'CURRENT' | 'NEEDS_RECHECK';
export type PriorItemClass = 'PERSONAL_FACT' | 'STABLE_PREFERENCE' | 'GOAL' | 'DECISION_COMMITMENT';

export interface RequirementItem {
  readonly dimension: RequirementDimension;
  readonly min?: number;
  readonly max?: number;
  readonly accepted?: readonly string[];
  readonly countryCode?: string;
  readonly regionCodes?: readonly string[];
}

export interface FactView<T> { readonly value: T; readonly state: FactState }
export interface DraftView {
  readonly version: number;
  readonly facts: {
    readonly firstName: FactView<string> | null;
    readonly sex: FactView<(typeof SEX_VALUES)[number]> | null;
    readonly birthYearMonth: { readonly year: number; readonly month: number; readonly state: FactState } | null;
    readonly area: { readonly countryCode: string; readonly regionCode: string | null; readonly state: FactState } | null;
    readonly maritalStatus: FactView<(typeof MARITAL_STATUSES)[number]> | null;
  };
  readonly profile: { readonly shortIntroduction: string | null; readonly workField: string | null };
  readonly requirements: {
    readonly hard: { readonly answer: 'NONE_ADDITIONAL' | 'ITEMS' | null; readonly items: readonly RequirementItem[] };
    readonly soft: { readonly answer: 'NONE' | 'ITEMS' | null; readonly items: readonly RequirementItem[] };
    readonly discrepancies: readonly RequirementDimension[];
  };
  readonly notes: ReadonlyArray<{ readonly id: string; readonly kind: (typeof NOTE_KINDS)[number]; readonly origin: (typeof NOTE_ORIGINS)[number]; readonly body: string }>;
  readonly priorUnderstandingDecisions: number;
  readonly skippedSteps: readonly SkipStep[];
  readonly review: { readonly state: 'NOT_REVIEWED' | 'REVIEWED' | 'CHANGED_SINCE_REVIEW'; readonly reviewedVersion: number | null };
}

/** One item of the owner's own prior understanding, shown for confirmation (CW2-06A §3.4): the words exactly as stored. */
export interface PriorItem {
  readonly memoryId: string;
  readonly itemClass: PriorItemClass;
  readonly words: string;
  readonly recency: PriorItemRecency;
}

export interface PreparationRecord {
  readonly availability: { readonly preparation: boolean; readonly assistance: boolean; readonly enrollment: false };
  readonly accountDeletionPending: boolean;
  readonly assistance: { readonly consent: 'GRANTED' | 'NOT_GRANTED'; readonly grantedVersion: string | null; readonly currentVersion: string | null };
  readonly draft: DraftView | null;
}
