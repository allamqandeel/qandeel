// I-01A - Shared World identity, birth, lifecycle and phase.
//
// A Shared World receives a stable `world_id` ONLY after a valid birth event
// (CW2-01 §5, A4). Before birth there are two prospective objects - an ordinary
// Shared invitation and a Matching proposal - and neither is a Shared World nor
// owns a Shared `world_id`. The prospective interfaces below therefore have no
// `worldId` member at all; the born world is the only carrier of `SharedWorldId`.
//
// Consent CHOREOGRAPHY (who sees an invitation first, sequencing, expiry,
// decline, revocation, the Introduction -> Standard approval transaction, the
// atomic single-winner Mutual Match transaction of CW2-01 §35) is NOT defined
// here. Concrete lifecycle, membership and history mechanics belong to CW2-03.
// This file fixes only the structural birth forms and the legal state vocabulary.

import type { ConsentPrincipal, HumanPrincipal } from './principal.types';
import type { SharedWorldId } from './world.types';

/** Architecture-level Shared lifecycle (CW2-01 §8). */
export const SHARED_WORLD_LIFECYCLES = ['ACTIVE', 'READ_ONLY_CLOSED'] as const;
export type SharedWorldLifecycle = (typeof SHARED_WORLD_LIFECYCLES)[number];

/** Shared phase. INTRODUCTION is a phase, NOT a World type (CW2-01 A7). */
export const SHARED_WORLD_PHASES = ['STANDARD', 'INTRODUCTION'] as const;
export type SharedWorldPhase = (typeof SHARED_WORLD_PHASES)[number];

/** The lifecycle / phase pair a Shared World is in. */
export interface SharedWorldState {
  readonly lifecycle: SharedWorldLifecycle;
  readonly phase: SharedWorldPhase;
}

/** The exhaustive set of legal Shared states. Anything else - a dormant, draft or archived world - is illegal. */
export const SHARED_WORLD_LEGAL_STATES: ReadonlyArray<SharedWorldState> = Object.freeze([
  Object.freeze({ lifecycle: 'ACTIVE', phase: 'STANDARD' } as const),
  Object.freeze({ lifecycle: 'READ_ONLY_CLOSED', phase: 'STANDARD' } as const),
  Object.freeze({ lifecycle: 'ACTIVE', phase: 'INTRODUCTION' } as const),
  Object.freeze({ lifecycle: 'READ_ONLY_CLOSED', phase: 'INTRODUCTION' } as const),
]);

/** Membership operations whose availability the kernel can answer structurally. */
export const SHARED_WORLD_MEMBER_OPERATIONS = ['ADD_MEMBER'] as const;
export type SharedWorldMemberOperation = (typeof SHARED_WORLD_MEMBER_OPERATIONS)[number];

/**
 * The kernel's answer about a member operation. It encodes exactly two frozen
 * structural exclusions: READ_ONLY_CLOSED blocks ordinary mutation (CW2-03 §35,
 * C31) and the Introduction v1 pair freeze makes ADD_MEMBER unavailable
 * (CW2-01 §10, CW2-03 §9). Outside those the kernel does NOT say the operation
 * is available - governance approval (CW2-02 §33, CW2-03 §16) is later runtime
 * work, not a kernel answer.
 */
export type MemberOperationAvailability =
  | 'UNAVAILABLE_READ_ONLY_CLOSED'
  | 'UNAVAILABLE_INTRODUCTION_PAIR_FREEZE'
  | 'NOT_STRUCTURALLY_EXCLUDED';

/**
 * The only two valid birth bases - the task's names for CW2-03 §2's
 * DIRECT_INVITATION_ACCEPTED and MATCHING_MUTUAL_MATCH.
 */
export const SHARED_WORLD_BIRTH_BASES = ['ACCEPTED_INVITATION', 'MUTUAL_MATCH'] as const;
export type SharedWorldBirthBasis = (typeof SHARED_WORLD_BIRTH_BASES)[number];

// ---------------------------------------------------------------------------
// Prospective state - exists BEFORE birth and owns no Shared world_id.
// ---------------------------------------------------------------------------

/**
 * An ordinary direct Shared invitation from one human to one exact target
 * (CW2-03 §3, §6). Not a World and never a dormant World (CW2-01 §5, §37); it
 * has no `worldId`. The inviter gains no owner or admin privilege from
 * initiating (CW2-01 §5, CW2-03 §16) - the field only identifies who invited so
 * that birth can check the World is born to exactly the two people who acted.
 * Invitation lifecycle states (pending, declined, expired, ...) and the secret
 * invitation credential are CW2-03 runtime mechanics, not kernel vocabulary.
 */
export interface SharedInvitation {
  readonly prospective: 'SHARED_INVITATION';
  readonly inviter: HumanPrincipal;
  readonly target: HumanPrincipal;
}

/** The invitation acceptance authority event. The acceptor position is human only and must be the exact target. */
export interface InvitationAcceptance {
  readonly kind: 'INVITATION_ACCEPTANCE';
  readonly acceptedBy: ConsentPrincipal;
}

/** A pending Matching proposal between exactly two humans. Relationship / Introduction state (CW2-01 §18); not a World; no `worldId`. */
export interface MatchingProposal {
  readonly architectureClass: 'RELATIONSHIP_STATE';
  readonly prospective: 'MATCHING_PROPOSAL';
  readonly pair: readonly [HumanPrincipal, HumanPrincipal];
  readonly state: 'PENDING';
}

/** A Mutual Match: the proposal plus BOTH humans' acceptance. Still not a World by itself. */
export interface MutualMatch {
  readonly kind: 'MUTUAL_MATCH';
  readonly proposal: MatchingProposal;
  readonly acceptedBy: readonly [ConsentPrincipal, ConsentPrincipal];
}

// ---------------------------------------------------------------------------
// Birth - the ONLY way a SharedWorldId comes into existence.
// ---------------------------------------------------------------------------

export interface AcceptedInvitationBirthEvent {
  readonly basis: 'ACCEPTED_INVITATION';
  readonly invitation: SharedInvitation;
  readonly acceptance: InvitationAcceptance;
}

export interface MutualMatchBirthEvent {
  readonly basis: 'MUTUAL_MATCH';
  readonly mutualMatch: MutualMatch;
}

export type SharedWorldBirthEvent = AcceptedInvitationBirthEvent | MutualMatchBirthEvent;

/**
 * What a caller proposes as a Shared World birth. `worldId` is the identifier
 * the caller's later persistence assigns; the kernel brands it only when the
 * birth is valid and never generates it.
 */
export interface SharedWorldBirthRequest {
  readonly worldId: string;
  readonly phase: SharedWorldPhase;
  readonly participantsAtBirth: ReadonlyArray<HumanPrincipal>;
  readonly event: SharedWorldBirthEvent;
}

/**
 * A born Shared World. The only object in the kernel that carries a
 * `SharedWorldId`. Its identity is the `worldId`, independent of any current
 * participant set (CW2-01 A5); `membershipAtBirth` is a historical record, not
 * the identity. There is deliberately no owner / admin / initiator field.
 */
export interface BornSharedWorld {
  readonly architectureClass: 'WORLD';
  readonly worldType: 'SHARED_WORLD';
  readonly worldId: SharedWorldId;
  readonly birthBasis: SharedWorldBirthBasis;
  readonly state: SharedWorldState;
  readonly membershipAtBirth: ReadonlyArray<HumanPrincipal>;
}

/** Every reason a birth fails closed. The list is closed so callers cannot invent a softer outcome. */
export const SHARED_WORLD_BIRTH_REJECTIONS = [
  'BLANK_WORLD_ID',
  'UNKNOWN_PHASE',
  'UNKNOWN_BIRTH_BASIS',
  'PHASE_BASIS_MISMATCH',
  'NON_HUMAN_PARTICIPANT',
  'DUPLICATE_PARTICIPANT',
  'TOO_FEW_PARTICIPANTS',
  'INTRODUCTION_REQUIRES_EXACT_PAIR',
  'MISSING_ACCEPTANCE_AUTHORITY',
  'NON_HUMAN_ACCEPTOR',
  'ACCEPTOR_NOT_THE_TARGET',
  'PARTICIPANTS_NOT_INVITER_AND_TARGET',
  'PROPOSAL_NOT_MUTUAL',
  'PARTICIPANTS_NOT_THE_MATCHED_PAIR',
] as const;
export type SharedWorldBirthRejection = (typeof SHARED_WORLD_BIRTH_REJECTIONS)[number];

export type SharedWorldBirthOutcome =
  | { readonly born: true; readonly world: BornSharedWorld }
  | { readonly born: false; readonly rejection: SharedWorldBirthRejection };
