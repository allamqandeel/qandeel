// I-07C - the frozen Mutual Match, Introduction Record and active-Introduction
// claim vocabularies, as compile-time truth.
//
// This file fixes the VOCABULARY the I-07C database runtime already enforces in
// migrations 0113 and 0114, and performs no evaluation of any kind. It is a
// sibling of the I-07A `matching-setup.types.ts` and the I-07B
// `matching-proposal.types.ts` rather than an extension of either: both of
// those are frozen records of their own slices and neither is edited here.
//
// What is NOT here, because it does not exist: `SECOND_ACCEPTED` or any other
// accepted-but-not-matched state - the second acceptance is durable only as a
// successful Match commit; a release of an active-Introduction claim, the
// Introduction success transition to STANDARD and the unilateral Introduction
// end (all I-07D, representable in the database and produced by nothing here);
// any compatibility score, rank, percentage, weight or ordering, in this file
// or in the database.

/**
 * The CW2-03 Introduction Record lifecycle. All three are REPRESENTABLE in the
 * database; I-07C produces exactly one of them.
 */
export const INTRODUCTION_RECORD_STATUSES = ['ACTIVE', 'COMPLETED', 'CLOSED'] as const;
export type IntroductionRecordStatus = (typeof INTRODUCTION_RECORD_STATUSES)[number];

/** The one Introduction Record status a Match commit can produce. */
export const I07C_PRODUCED_INTRODUCTION_RECORD_STATUSES = ['ACTIVE'] as const;
export type ProducedIntroductionRecordStatus = (typeof I07C_PRODUCED_INTRODUCTION_RECORD_STATUSES)[number];

/** The two terminal statuses I-07D produces; representable here, produced by nothing. */
export const I07D_RESERVED_INTRODUCTION_RECORD_STATUSES = ['COMPLETED', 'CLOSED'] as const;
export type ReservedIntroductionRecordStatus = (typeof I07D_RESERVED_INTRODUCTION_RECORD_STATUSES)[number];

/**
 * The internal active-Introduction claim. `HELD` is the only state a Match commit
 * writes; `RELEASED` is representable so I-07D adds the release producer rather
 * than relaxing a ceiling. The claim is a concurrency guard, never user-facing
 * state and never a replacement for the canonical Shared-World-derived
 * active-Introduction truth.
 */
export const ACTIVE_INTRODUCTION_CLAIM_STATES = ['HELD', 'RELEASED'] as const;
export type ActiveIntroductionClaimState = (typeof ACTIVE_INTRODUCTION_CLAIM_STATES)[number];

export const I07C_PRODUCED_CLAIM_STATES = ['HELD'] as const;
export type ProducedClaimState = (typeof I07C_PRODUCED_CLAIM_STATES)[number];

/**
 * The two proposal states I-07B left representable with no producer, and that
 * the I-07C Match commit is the ONLY producer of. Identical to the I-07B
 * reserved list by construction; the static contract asserts it.
 */
export const I07C_PRODUCED_PROPOSAL_STATES = ['CANCELLED_BY_COMPETING_MATCH', 'MUTUAL_MATCH_COMMITTED'] as const;
export type I07cProducedProposalState = (typeof I07C_PRODUCED_PROPOSAL_STATES)[number];

/**
 * The one private reason I-07C adds to the I-07B vocabulary: why a live
 * proposal ended when another Match involving one of its humans committed.
 * PRIVATE operational state; the recipient projection answers NO_LONGER_AVAILABLE.
 */
export const I07C_PROPOSAL_PRIVATE_REASONS = ['COMPETING_MATCH_COMMITTED'] as const;
export type I07cProposalPrivateReason = (typeof I07C_PROPOSAL_PRIVATE_REASONS)[number];

/** The one pause reason I-07A reserved that I-07C is the reviewed producer of. */
export const I07C_PRODUCED_PAUSE_REASONS = ['ACTIVE_INTRODUCTION'] as const;
export type I07cProducedPauseReason = (typeof I07C_PRODUCED_PAUSE_REASONS)[number];

/** The frozen Matching birth: exactly one Shared World state, and no other. */
export const MUTUAL_MATCH_BIRTH_LIFECYCLE = ['ACTIVE'] as const;
export const MUTUAL_MATCH_BIRTH_PHASE = ['INTRODUCTION'] as const;
export const MUTUAL_MATCH_BIRTH_BASIS = ['MUTUAL_MATCH'] as const;

/**
 * The committed result of the atomic Mutual Match commit, as the one boundary
 * answers it: the operation, the opaque identities the caller supplied and the
 * frozen birth constants. There is deliberately no counterparty identifier, no
 * profile, no eligibility, no authority, no private reason and no competing
 * proposal fact. A retry returns exactly what the command committed, never the
 * World's or the record's current state.
 */
export interface MutualMatchCommitResult {
  readonly outcome: 'MATCHED';
  readonly committedMatchId: string;
  readonly matchedProposalId: string;
  readonly bornWorldId: string;
  readonly bornIntroductionRecordId: string;
  readonly worldLifecycle: (typeof MUTUAL_MATCH_BIRTH_LIFECYCLE)[number];
  readonly worldPhase: (typeof MUTUAL_MATCH_BIRTH_PHASE)[number];
  readonly worldBirthBasis: (typeof MUTUAL_MATCH_BIRTH_BASIS)[number];
  readonly introductionRecordStatus: ProducedIntroductionRecordStatus;
}
