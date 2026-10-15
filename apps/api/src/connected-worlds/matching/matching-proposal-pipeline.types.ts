// S6-03 - the confirmed-fact, structured-requirement, neutral-presentation,
// re-proposal and admission vocabularies of migrations 0156 / 0157, as
// compile-time truth (Controlled Amendment CW2-06B).
//
// This file fixes VOCABULARY the database runtime already enforces and
// performs no evaluation of any kind. It is a sibling of the frozen I-07A
// `matching-setup.types.ts`, I-07B `matching-proposal.types.ts` and I-07C
// `matching-match.types.ts`, and edits none of them: the I-07B recipient view
// interface stays the historical record of what a view BINDS, and the neutral
// projection below supersedes it only in what is PRESENTED (CW2-06B-07).
//
// What is NOT here, because it does not exist: a writer, a route, a worker, a
// Model Router import, a compatibility score, rank, percentage or weight, a
// rejection ledger, a cooldown, or any copy.

/** The Product pair rule a snapshot's fact binding records (CW2-06B-05). Never a hard requirement result. */
export const MATCHING_PAIR_RULE = 'OPPOSITE_SEX_CONFIRMED_V1' as const;
export type MatchingPairRule = typeof MATCHING_PAIR_RULE;

/** The confirmed sex values (CW2-06B-01). Absent is UNKNOWN; nothing infers one. */
export const CONFIRMED_SEX_VALUES = ['MALE', 'FEMALE'] as const;
export type ConfirmedSex = (typeof CONFIRMED_SEX_VALUES)[number];

/** The confirmed marital status values (CW2-06B-01). Recording one decides no eligibility by itself. */
export const CONFIRMED_MARITAL_STATUS_VALUES = ['NEVER_MARRIED', 'DIVORCED', 'WIDOWED', 'CURRENTLY_MARRIED'] as const;
export type ConfirmedMaritalStatus = (typeof CONFIRMED_MARITAL_STATUS_VALUES)[number];

/**
 * The structured requirement encoding v1 (CW2-06B-03): the requirement key of
 * each dimension and strength. The encoding version is part of the key, and a
 * key carries only its own strength.
 */
export const STRUCTURED_REQUIREMENT_KEYS_V1 = {
  AGE_RANGE: { HARD_DEALBREAKER: 'age_range_v1', SOFT_PREFERENCE: 'age_range_preference_v1' },
  MARITAL_STATUS: { HARD_DEALBREAKER: 'marital_status_v1', SOFT_PREFERENCE: 'marital_status_preference_v1' },
  AREA: { HARD_DEALBREAKER: 'area_v1', SOFT_PREFERENCE: 'area_preference_v1' },
} as const;
export type StructuredRequirementDimension = keyof typeof STRUCTURED_REQUIREMENT_KEYS_V1;

/** The one private reason S6-03 adds to the proposal reason vocabulary (CW2-06B-16). Private operational state. */
export const S6_03_PROPOSAL_PRIVATE_REASONS = ['MATCHING_FACT_VERSION_CHANGED'] as const;
export type S603ProposalPrivateReason = (typeof S6_03_PROPOSAL_PRIVATE_REASONS)[number];

/**
 * The terminal proposal states that place a canonical unordered pair under the
 * continuing automatic block on re-proposal until a Stage 9 policy is approved
 * (CW2-06B-14). EXPIRED blocks and is not a refusal.
 */
export const REPROPOSAL_BLOCKING_STATES = [
  'FIRST_DECLINED', 'SECOND_DECLINED', 'WITHDRAWN', 'EXPIRED', 'MUTUAL_MATCH_COMMITTED',
] as const;
export type ReproposalBlockingState = (typeof REPROPOSAL_BLOCKING_STATES)[number];

/** The two system outcomes that block nothing and are never a human refusal. */
export const REPROPOSAL_NON_BLOCKING_TERMINAL_STATES = ['STALE', 'CANCELLED_BY_COMPETING_MATCH'] as const;

/** The pre-preparation admission answers (CW2-06B-15). Today it never answers ADMITTED. */
export const PAIR_ADMISSION_ANSWERS = [
  'ADMITTED', 'NOT_MATCHABLE', 'PAIR_RULE_NOT_SATISFIED', 'FIRST_NAME_NOT_CONFIRMED', 'REPROPOSAL_BLOCKED',
  'POLICY_UNCONFIGURED', 'PRODUCER_UNAVAILABLE', 'PREREQUISITES_NOT_CLEARED',
] as const;
export type PairAdmissionAnswer = (typeof PAIR_ADMISSION_ANSWERS)[number];

/** The Stage 8A producer readiness seam. It answers UNAVAILABLE until a real, evaluated, approved producer exists. */
export const COMPATIBILITY_PRODUCER_READINESS = ['UNAVAILABLE', 'READY'] as const;
export type CompatibilityProducerReadiness = (typeof COMPATIBILITY_PRODUCER_READINESS)[number];

/**
 * What the recipient projection PRESENTS before and after Mutual Match
 * (CW2-06B-07): bound internally, presented neutrally. The first name and the
 * conclusion are null in every state; a born Introduction's names come only
 * from the Handoff through the S6-02 projection.
 */
export interface MatchingNeutralRecipientProposalPresentation {
  readonly recipientViewId: string;
  readonly matchingProposalId: string;
  readonly presentedFirstName: null;
  readonly safeCompatibilityConclusion: null;
  readonly neutralOutcome: 'AWAITING_YOU' | 'IN_PROGRESS' | 'CLOSED_BY_YOU' | 'NO_LONGER_AVAILABLE' | 'MATCH_CONCLUDED';
  readonly actionAvailable: boolean;
}
