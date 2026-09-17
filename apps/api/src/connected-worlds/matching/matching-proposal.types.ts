// I-07B - the frozen Matching proposal and disclosure vocabularies, as
// compile-time truth.
//
// This file fixes the VOCABULARY the I-07B database runtime already enforces in
// migrations 0110-0112, and performs no evaluation of any kind. It is a sibling
// of the I-07A `matching-setup.types.ts` rather than an extension of it: I-07A
// owns the private setup vocabularies and deliberately invents no candidate,
// ranking or proposal word, which is a property its own contract asserts.
//
// What is NOT here, because it does not exist: `SECOND_ACCEPTED` or any other
// accepted-but-not-matched state, `MATCH_COMMIT_ID`, `ACTIVE_INTRODUCTION_SLOT`,
// a Mutual Match producer, a competing-match cancellation producer, an
// Introduction Record, a Shared World birth and `MATCH_HANDOFF_PACKAGE_VERSION`
// (all I-07C); progressive Introduction disclosure and the Introduction success
// transition (I-07D). No compatibility score, rank, percentage, weight or
// ordering appears anywhere, in this file or in the database.

/**
 * The eleven frozen CW2-06 proposal states. All eleven are REPRESENTABLE in the
 * database; I-07B has a producer for nine of them.
 */
export const MATCHING_PROPOSAL_STATES = [
  'PREPARED',
  'OFFERED_TO_FIRST',
  'FIRST_DECLINED',
  'FIRST_FORWARD_APPROVED',
  'FORWARDED_TO_SECOND',
  'SECOND_DECLINED',
  'WITHDRAWN',
  'EXPIRED',
  'STALE',
  'CANCELLED_BY_COMPETING_MATCH',
  'MUTUAL_MATCH_COMMITTED',
] as const;
export type MatchingProposalState = (typeof MATCHING_PROPOSAL_STATES)[number];

/**
 * The two states with NO I-07B producer. They are reserved for `I-07C`, exactly
 * as migration 0108 reserves four pause reasons and migration 0089 reserves
 * material kinds: representable so that slice ADDS a producer rather than
 * relaxing a ceiling somebody would otherwise have to widen.
 */
export const I07C_RESERVED_PROPOSAL_STATES = ['CANCELLED_BY_COMPETING_MATCH', 'MUTUAL_MATCH_COMMITTED'] as const;
export type ReservedProposalState = (typeof I07C_RESERVED_PROPOSAL_STATES)[number];

/**
 * The nine states an I-07B command may produce, as a NARROWED TYPE rather than a
 * comment - so a later caller cannot pass one of the two reserved states here by
 * accident.
 */
export const I07B_PRODUCED_PROPOSAL_STATES = [
  'PREPARED',
  'OFFERED_TO_FIRST',
  'FIRST_DECLINED',
  'FIRST_FORWARD_APPROVED',
  'FORWARDED_TO_SECOND',
  'SECOND_DECLINED',
  'WITHDRAWN',
  'EXPIRED',
  'STALE',
] as const;
export type ProducedProposalState = (typeof I07B_PRODUCED_PROPOSAL_STATES)[number];

/** The four states in which a proposal is LIVE, and at most one per pair is. */
export const MATCHING_LIVE_PROPOSAL_STATES = [
  'PREPARED', 'OFFERED_TO_FIRST', 'FIRST_FORWARD_APPROVED', 'FORWARDED_TO_SECOND',
] as const;
export type LiveProposalState = (typeof MATCHING_LIVE_PROPOSAL_STATES)[number];

/** The two roles a human may hold in one proposal. Direction is immutable. */
export const MATCHING_RECIPIENT_ROLES = ['FIRST_RECIPIENT', 'CANDIDATE'] as const;
export type MatchingRecipientRole = (typeof MATCHING_RECIPIENT_ROLES)[number];

/**
 * The frozen hard-dealbreaker answer. `UNKNOWN` is NOT satisfaction, and the
 * database refuses to let one carry a confirmed source, so it can never be
 * quietly promoted to `PASS`.
 */
export const MATCHING_HARD_REQUIREMENT_OUTCOMES = ['PASS', 'FAIL', 'UNKNOWN'] as const;
export type MatchingHardRequirementOutcome = (typeof MATCHING_HARD_REQUIREMENT_OUTCOMES)[number];

/**
 * The only sources from which a candidate fact may be established, plus the
 * absence of one. A third-party claim, and an inference from a name, a voice, a
 * photo, a language style or any stereotype-bearing proxy, are not refused at
 * runtime - they CANNOT BE SPELLED.
 */
export const MATCHING_EVIDENCE_SOURCE_CLASSES = [
  'SELF_AUTHORED_PERSONAL',
  'EXPLICIT_MATCHING_ANSWER',
  'INTRODUCTION_PROFILE',
  'CANONICAL_PRODUCT_ACCOUNT_STATE',
  'NOT_ESTABLISHED',
] as const;
export type MatchingEvidenceSourceClass = (typeof MATCHING_EVIDENCE_SOURCE_CLASSES)[number];

/** The source classes an ESTABLISHED outcome may name; `NOT_ESTABLISHED` is not one. */
export const MATCHING_ESTABLISHED_SOURCE_CLASSES = [
  'SELF_AUTHORED_PERSONAL',
  'EXPLICIT_MATCHING_ANSWER',
  'INTRODUCTION_PROFILE',
  'CANONICAL_PRODUCT_ACCOUNT_STATE',
] as const;
export type MatchingEstablishedSourceClass = (typeof MATCHING_ESTABLISHED_SOURCE_CLASSES)[number];

/**
 * The configurable Product policy identities. The exact weekly count, pending
 * maximum and expiry duration are DEFERRED Product decisions: no value is frozen
 * here or in DDL, and no policy row ships in any migration.
 */
export const MATCHING_PROPOSAL_POLICY_KINDS = [
  'PROPOSAL_CADENCE',
  'PENDING_PROPOSAL_LIMIT',
  'PROPOSAL_EXPIRY',
  'PROPOSAL_SAFE_FIELDS',
  'SENSITIVE_CONCLUSION_FILTER',
] as const;
export type MatchingProposalPolicyKind = (typeof MATCHING_PROPOSAL_POLICY_KINDS)[number];

/** Why the Sensitive Conclusion Filter withheld a conclusion. Always PRIVATE. */
export const MATCHING_FILTER_REFUSAL_CLASSES = [
  'CONTACT_ROUTE',
  'PRIVATE_QUOTE',
  'HIDDEN_PROVENANCE',
  'VISIBLE_RANKING',
  'SENSITIVE_FACT',
  'UNCLASSIFIED_RESULT',
] as const;
export type MatchingFilterRefusalClass = (typeof MATCHING_FILTER_REFUSAL_CLASSES)[number];

/** The filter verdicts. An UNCLASSIFIED safety result is a refusal, never a pass. */
export const MATCHING_FILTER_VERDICTS = ['PERMITTED', 'REFUSED', 'UNCLASSIFIED'] as const;
export type MatchingFilterVerdict = (typeof MATCHING_FILTER_VERDICTS)[number];

/** Why a proposal ended. PRIVATE operational state; no recipient answer carries one. */
export const MATCHING_PROPOSAL_PRIVATE_REASONS = [
  'RECIPIENT_DECLINED',
  'WITHDRAWN_BY_FIRST_PARTY',
  'PROPOSAL_EXPIRED',
  'PARTICIPATION_NOT_ACTIVE',
  'MATCHING_CONTEXT_GRANT_CHANGED',
  'INTRODUCTION_PROFILE_VERSION_CHANGED',
  'MATCHING_REQUIREMENT_VERSION_CHANGED',
  'DISCLOSURE_AUTHORITY_CHANGED',
  'PROPOSAL_POLICY_CHANGED',
  'ACTIVE_INTRODUCTION_PRESENT',
  'RECIPIENT_VIEW_SUPERSEDED',
] as const;
export type MatchingProposalPrivateReason = (typeof MATCHING_PROPOSAL_PRIVATE_REASONS)[number];

/**
 * What a recipient may be told about a proposal's outcome, and the whole of it.
 *
 * The mapping IS the privacy property. `NO_LONGER_AVAILABLE` covers a second
 * decline, an expiry, a private invalidation, the other party's withdrawal and a
 * competing match that cancelled the proposal, so none of the five can be told
 * apart. `MATCH_CONCLUDED` is the one terminal both humans are by definition
 * party to, and what a matched human actually sees is the I-07C / I-07D
 * Introduction surface rather than this projection.
 */
export const MATCHING_NEUTRAL_PROPOSAL_OUTCOMES = [
  'AWAITING_YOU',
  'IN_PROGRESS',
  'CLOSED_BY_YOU',
  'NO_LONGER_AVAILABLE',
  'MATCH_CONCLUDED',
] as const;
export type MatchingNeutralProposalOutcome = (typeof MATCHING_NEUTRAL_PROPOSAL_OUTCOMES)[number];

/**
 * A recipient's view of one proposal, as the one audience-facing boundary
 * answers it: an opaque view identity, an opaque proposal identity, a first
 * name, the filtered Safe Compatibility Conclusion, a neutral outcome and one
 * affordance.
 *
 * There is deliberately no counterparty identifier, no eligibility snapshot, no
 * disclosure authority, no profile version, no evidence, no provenance, no
 * private reason and no proposal state name. A field added here that the
 * database boundary does not return would be a compile-time lie; a field the
 * boundary returned and this omitted would be caught by the audience contract
 * over the boundary's own result columns.
 */
export interface MatchingRecipientProposalView {
  readonly recipientViewId: string;
  readonly matchingProposalId: string;
  readonly presentedFirstName: string;
  readonly safeCompatibilityConclusion: string;
  readonly neutralOutcome: MatchingNeutralProposalOutcome;
  readonly actionAvailable: boolean;
}

/** One disclosed Introduction Profile field of a recipient view. */
export interface MatchingDisclosedProposalField {
  readonly disclosedFieldKey: string;
  readonly disclosedFieldValue: string;
}
