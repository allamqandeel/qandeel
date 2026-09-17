// I-07A - the frozen Matching setup vocabularies, as compile-time truth.
//
// Matching v1 is exactly one Product capability: MARRIAGE_INTRODUCTION. It is
// hosted from MY_WORLD, it is a doorway, it is private by default and it is
// mediated by QANDEEL (CW2-06). This file fixes the VOCABULARY the I-07A
// database runtime already enforces, and performs no evaluation of any kind.
//
// It is deliberately a sibling of the merged Connected Worlds kernel rather than
// a member of it: the kernel's `MatchingAdmission` already says that Matching
// Context Admission is capability-scoped and carries no target World, and
// nothing here changes the meaning of that or of any other Shared World
// primitive. Migration 0108 persists these vocabularies and migration 0109 is
// the only thing that may write them.
//
// What is NOT here, because it does not exist yet: candidate discovery, pair
// evaluation, PAIR_KEY, an eligibility snapshot, the candidate-side
// PASS | FAIL | UNKNOWN answer, a Safe Compatibility Conclusion, a proposal of
// any kind (I-07B); an Introduction slot, a match commit, a Mutual Match or a
// Shared World birth (I-07C); progressive Introduction disclosure or the
// post-Introduction resume revalidation (I-07D). No compatibility score, rank,
// percentage or ordering appears anywhere, in this file or in the database.

/** Current participation in the Matching capability. Absence resolves to OFF. */
export const MATCHING_PARTICIPATION_STATES = ['OFF', 'ACTIVE', 'PAUSED'] as const;
export type MatchingParticipationState = (typeof MATCHING_PARTICIPATION_STATES)[number];

/**
 * Every pause reason the frozen architecture requires the runtime to be able to
 * represent. Four of them deliberately have NO I-07A producer.
 */
export const MATCHING_PAUSE_REASONS = [
  'USER_PAUSED',
  'ACTIVE_INTRODUCTION',
  'POST_INTRODUCTION',
  'POST_SUCCESS',
  'SYSTEM_POLICY',
] as const;
export type MatchingPauseReason = (typeof MATCHING_PAUSE_REASONS)[number];

/**
 * The ONLY pause an I-07A human command may create, and the only one its resume
 * path may lift. `ACTIVE_INTRODUCTION`, `POST_INTRODUCTION`, `POST_SUCCESS` and
 * `SYSTEM_POLICY` each require revalidation owned by I-07C / I-07D and stay
 * fail-closed until it exists - which is why this is a narrowed TYPE and not a
 * comment: a later caller cannot pass one of the other four here by accident.
 */
export const I07A_USER_RESUMABLE_PAUSE_REASONS = ['USER_PAUSED'] as const;
export type UserResumablePauseReason = (typeof I07A_USER_RESUMABLE_PAUSE_REASONS)[number];

/**
 * The two frozen entry channels, which are activation PROVENANCE. An offer, a
 * prompt or a suggestion from QANDEEL is not one of them and is not activation.
 */
export const MATCHING_ACTIVATION_ENTRY_CHANNELS = ['CONVERSATIONAL_ENTRY', 'MANUAL_MY_WORLD_ENTRY'] as const;
export type MatchingActivationEntryChannel = (typeof MATCHING_ACTIVATION_ENTRY_CHANNELS)[number];

/** The four human acts I-07A owns. The act is the command's identity, never a parameter. */
export const MATCHING_PARTICIPATION_ACTS = ['ACTIVATE', 'PAUSE', 'RESUME', 'TURN_OFF'] as const;
export type MatchingParticipationAct = (typeof MATCHING_PARTICIPATION_ACTS)[number];

/**
 * The frozen CW2-06 requirement distinction, and the whole of it. There is no
 * weight, score, rank or percentage beside it, because I-07A stores the human's
 * self-declared requirement truth and evaluates no candidate.
 */
export const MATCHING_REQUIREMENT_STRENGTHS = ['HARD_DEALBREAKER', 'SOFT_PREFERENCE'] as const;
export type MatchingRequirementStrength = (typeof MATCHING_REQUIREMENT_STRENGTHS)[number];

/** A human-consent act over a Matching authority. History, never current state. */
export const MATCHING_AUTHORITY_EVENT_TYPES = ['GRANTED', 'RECONFIRMED', 'REVOKED'] as const;
export type MatchingAuthorityEventType = (typeof MATCHING_AUTHORITY_EVENT_TYPES)[number];

/** Current authority state. A revoked authority is history and is never reactivated. */
export const MATCHING_AUTHORITY_STATUSES = ['ACTIVE', 'REVOKED'] as const;
export type MatchingAuthorityStatus = (typeof MATCHING_AUTHORITY_STATUSES)[number];

/**
 * The caller's own Matching setup, as the one self-inspection boundary answers
 * it: identities and bounded states, never a profile or requirement VALUE,
 * never another human, and never a proposal. Absence is OFF.
 */
export interface MatchingSetupSelfView {
  readonly participationState: MatchingParticipationState;
  readonly pauseReason: MatchingPauseReason | null;
  readonly participationEventId: string | null;
  readonly matchingContextGrantId: string | null;
  readonly introductionProfileVersionId: string | null;
  readonly matchingRequirementVersionId: string | null;
  readonly preMatchDisclosureAuthorityId: string | null;
  readonly boundProfileVersionId: string | null;
  readonly approvedFieldCount: number;
}
