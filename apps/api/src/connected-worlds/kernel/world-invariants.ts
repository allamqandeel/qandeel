// I-01A - Connected Worlds structural invariants.
//
// Pure, synchronous, CPU-only structural validation over the kernel vocabulary.
// No I/O, no persistence, no authorization lookup, no network, no model call,
// no timestamp generation, no UUID generation, no ambient state. Every
// validator fails CLOSED: an unknown or malformed input is never classified as
// a World, a human, a legal state, a valid birth or an authorized admission.
//
// This is not the I-03 authority evaluator. It answers structural questions
// only, so that later runtime work has a testable constitution to build on.

import type { HumanPrincipal } from './principal.types';
import { NON_WORLD_KINDS, WORLD_TYPES } from './world.types';
import type { NonWorldKind, SharedWorldId, WorldClassification, WorldType } from './world.types';
import { SHARED_WORLD_BIRTH_BASES, SHARED_WORLD_LEGAL_STATES, SHARED_WORLD_PHASES } from './shared-world.types';
import type {
  AcceptedInvitationBirthEvent,
  BornSharedWorld,
  MemberOperationAvailability,
  MutualMatchBirthEvent,
  SharedWorldBirthOutcome,
  SharedWorldBirthRejection,
  SharedWorldBirthRequest,
  SharedWorldMemberOperation,
  SharedWorldState,
} from './shared-world.types';
import { CONTENT_AVAILABILITIES, DEPENDENCY_KINDS, HISTORY_ACCESS_DEFAULT_ON_JOIN } from './material.types';
import type {
  ContentAvailability,
  DependencyKind,
  HistoryAccessDefault,
  MaterialDependency,
  MembershipEpisode,
  MembershipEpisodeValidation,
  ProvenanceRecord,
  ReasoningDependency,
  SourceMaterialView,
} from './material.types';
import { CONTEXT_ADMISSION_SCOPES } from './authority.types';
import type {
  AudienceExpansionIntent,
  AudienceOperation,
  ContextAdmission,
  ContextAdmissionQuestion,
  ContextAdmissionValidation,
} from './authority.types';

// ---------------------------------------------------------------------------
// World taxonomy.
// ---------------------------------------------------------------------------

export function isWorldType(value: unknown): value is WorldType {
  return typeof value === 'string' && (WORLD_TYPES as ReadonlyArray<string>).includes(value);
}

export function isNonWorldKind(value: unknown): value is NonWorldKind {
  return typeof value === 'string' && (NON_WORLD_KINDS as ReadonlyArray<string>).includes(value);
}

/** Classifies a name. Only the three canonical World types are Worlds; everything else is not, including unknown names. */
export function classifyWorldCandidate(candidate: unknown): WorldClassification {
  if (isWorldType(candidate)) return { verdict: 'WORLD', worldType: candidate };
  if (isNonWorldKind(candidate)) return { verdict: 'NOT_A_WORLD', kind: candidate };
  return { verdict: 'UNKNOWN' };
}

// ---------------------------------------------------------------------------
// Principals.
// ---------------------------------------------------------------------------

/** A human principal is exactly `{ kind: 'HUMAN', humanId: <non-blank string> }`. QANDEEL never satisfies this. */
export function isHumanPrincipal(value: unknown): value is HumanPrincipal {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { readonly kind?: unknown; readonly humanId?: unknown };
  return candidate.kind === 'HUMAN' && typeof candidate.humanId === 'string' && candidate.humanId.trim().length > 0;
}

/** The runtime half of the human-only consent / ownership contract. Throws for QANDEEL or anything else. */
export function requireHumanPrincipal(value: unknown, position: string): HumanPrincipal {
  if (!isHumanPrincipal(value)) {
    throw new TypeError(`${position} requires a human principal; QANDEEL or a malformed principal cannot hold this position.`);
  }
  return value;
}

function sameHuman(left: HumanPrincipal, right: HumanPrincipal): boolean {
  return left.humanId === right.humanId;
}

// Set equality over human identity. Both directions are checked so a repeated
// human on one side ([A, A] against [A, B]) can never pass as the same set.
function sameHumanSet(left: ReadonlyArray<HumanPrincipal>, right: ReadonlyArray<HumanPrincipal>): boolean {
  if (left.length !== right.length) return false;
  return left.every((human) => right.some((other) => sameHuman(human, other)))
    && right.every((human) => left.some((other) => sameHuman(human, other)));
}

// ---------------------------------------------------------------------------
// Shared World state and phase.
// ---------------------------------------------------------------------------

export function isLegalSharedWorldState(candidate: unknown): candidate is SharedWorldState {
  if (typeof candidate !== 'object' || candidate === null) return false;
  const state = candidate as { readonly lifecycle?: unknown; readonly phase?: unknown };
  return SHARED_WORLD_LEGAL_STATES.some((legal) => legal.lifecycle === state.lifecycle && legal.phase === state.phase);
}

/**
 * Two frozen structural exclusions: a READ_ONLY_CLOSED World blocks ordinary
 * mutation (CW2-03 §35), and while `phase = INTRODUCTION` ADD_MEMBER is
 * unavailable (CW2-01 §10, CW2-03 §9). Any other answer is "not structurally
 * excluded" - the kernel does not grant the operation; the unanimous-governance
 * gate (CW2-02 §33, CW2-03 §16) is later runtime work.
 */
export function memberOperationAvailability(state: SharedWorldState, operation: SharedWorldMemberOperation): MemberOperationAvailability {
  if (operation !== 'ADD_MEMBER') return 'NOT_STRUCTURALLY_EXCLUDED';
  if (state.lifecycle === 'READ_ONLY_CLOSED') return 'UNAVAILABLE_READ_ONLY_CLOSED';
  if (state.phase === 'INTRODUCTION') return 'UNAVAILABLE_INTRODUCTION_PAIR_FREEZE';
  return 'NOT_STRUCTURALLY_EXCLUDED';
}

/**
 * In INTRODUCTION phase the human membership is exactly the matched pair at
 * birth (CW2-01 A8). Outside that phase the freeze does not apply and this
 * predicate imposes nothing.
 */
export function isIntroductionPairIntact(world: BornSharedWorld, currentMembers: ReadonlyArray<HumanPrincipal>): boolean {
  if (world.state.phase !== 'INTRODUCTION') return true;
  return currentMembers.length === 2 && sameHumanSet(currentMembers, world.membershipAtBirth);
}

// ---------------------------------------------------------------------------
// Shared World birth - the ONLY producer of a SharedWorldId.
// ---------------------------------------------------------------------------

function rejected(rejection: SharedWorldBirthRejection): SharedWorldBirthOutcome {
  return { born: false, rejection };
}

// CW2-03 §6: a direct birth creates exactly the inviter's and the exact
// target's membership episodes. Anyone else joins later through add-member
// governance (CW2-03 §16), never at birth.
function validateAcceptedInvitation(
  event: AcceptedInvitationBirthEvent,
  participants: ReadonlyArray<HumanPrincipal>,
): SharedWorldBirthRejection | undefined {
  const { invitation, acceptance } = event;
  if (!isHumanPrincipal(invitation.inviter) || !isHumanPrincipal(invitation.target)) return 'NON_HUMAN_PARTICIPANT';
  if (typeof acceptance !== 'object' || acceptance === null || acceptance.kind !== 'INVITATION_ACCEPTANCE') return 'MISSING_ACCEPTANCE_AUTHORITY';
  if (!isHumanPrincipal(acceptance.acceptedBy)) return 'NON_HUMAN_ACCEPTOR';
  if (!sameHuman(acceptance.acceptedBy, invitation.target)) return 'ACCEPTOR_NOT_THE_TARGET';
  if (!sameHumanSet(participants, [invitation.inviter, invitation.target])) return 'PARTICIPANTS_NOT_INVITER_AND_TARGET';
  return undefined;
}

function validateMutualMatch(
  event: MutualMatchBirthEvent,
  participants: ReadonlyArray<HumanPrincipal>,
): SharedWorldBirthRejection | undefined {
  const { proposal, acceptedBy } = event.mutualMatch;
  const pair = proposal.pair;
  if (!pair.every(isHumanPrincipal) || pair.length !== 2 || sameHuman(pair[0], pair[1])) return 'NON_HUMAN_PARTICIPANT';
  if (acceptedBy.length !== 2 || !acceptedBy.every(isHumanPrincipal)) return 'NON_HUMAN_ACCEPTOR';
  // Mutual means BOTH humans of the proposal accepted - one acceptance, or an
  // acceptance by someone outside the pair, is still a pending proposal.
  if (!sameHumanSet(acceptedBy, pair)) return 'PROPOSAL_NOT_MUTUAL';
  if (!sameHumanSet(participants, pair)) return 'PARTICIPANTS_NOT_THE_MATCHED_PAIR';
  return undefined;
}

/**
 * The structural birth boundary. Valid combinations are exactly:
 *
 *   ACCEPTED_INVITATION -> phase STANDARD, the inviter and the exact accepting target (2 distinct humans)
 *   MUTUAL_MATCH        -> phase INTRODUCTION, exactly the 2 matched humans, both accepted
 *
 * Every other combination fails closed with a named rejection. The kernel
 * brands the caller-supplied `worldId`; it never generates one.
 */
export function attemptSharedWorldBirth(request: SharedWorldBirthRequest): SharedWorldBirthOutcome {
  const { worldId, phase, participantsAtBirth, event } = request;
  if (typeof worldId !== 'string' || worldId.trim().length === 0) return rejected('BLANK_WORLD_ID');
  if (!(SHARED_WORLD_PHASES as ReadonlyArray<unknown>).includes(phase)) return rejected('UNKNOWN_PHASE');
  if (typeof event !== 'object' || event === null || !(SHARED_WORLD_BIRTH_BASES as ReadonlyArray<unknown>).includes(event.basis)) {
    return rejected('UNKNOWN_BIRTH_BASIS');
  }
  const expectedPhase = event.basis === 'ACCEPTED_INVITATION' ? 'STANDARD' : 'INTRODUCTION';
  if (phase !== expectedPhase) return rejected('PHASE_BASIS_MISMATCH');

  if (!Array.isArray(participantsAtBirth) || !participantsAtBirth.every(isHumanPrincipal)) return rejected('NON_HUMAN_PARTICIPANT');
  const distinct = new Set(participantsAtBirth.map((participant) => participant.humanId));
  if (distinct.size !== participantsAtBirth.length) return rejected('DUPLICATE_PARTICIPANT');
  if (participantsAtBirth.length < 2) return rejected('TOO_FEW_PARTICIPANTS');
  if (phase === 'INTRODUCTION' && participantsAtBirth.length !== 2) return rejected('INTRODUCTION_REQUIRES_EXACT_PAIR');

  const authorityRejection = event.basis === 'ACCEPTED_INVITATION'
    ? validateAcceptedInvitation(event, participantsAtBirth)
    : validateMutualMatch(event, participantsAtBirth);
  if (authorityRejection) return rejected(authorityRejection);

  return {
    born: true,
    world: {
      architectureClass: 'WORLD',
      worldType: 'SHARED_WORLD',
      worldId: worldId as SharedWorldId,
      birthBasis: event.basis,
      // A Shared World is created ACTIVE (CW2-01 §8). READ_ONLY_CLOSED is a later
      // lifecycle transition owned elsewhere, never a birth state.
      state: { lifecycle: 'ACTIVE', phase },
      membershipAtBirth: participantsAtBirth.map((participant) => ({ kind: 'HUMAN', humanId: participant.humanId })),
    },
  };
}

// ---------------------------------------------------------------------------
// Membership episodes and history access.
// ---------------------------------------------------------------------------

function parseInstant(value: string): number {
  return typeof value === 'string' ? Date.parse(value) : Number.NaN;
}

/**
 * Structural validation of a set of membership episodes. Episodes of the same
 * human in the same World must be well-ordered: at most one open episode, no
 * overlap, and a rejoin is a later distinct episode (CW2-01 §11, §13, A10).
 * Timestamps are compared, never generated.
 */
export function validateMembershipEpisodes(episodes: ReadonlyArray<MembershipEpisode>): MembershipEpisodeValidation {
  const parsed: Array<{ readonly key: string; readonly joined: number; readonly ended: number | null }> = [];
  for (const episode of episodes) {
    if (!isHumanPrincipal(episode.member)) return { valid: false, rejection: 'NON_HUMAN_MEMBER' };
    const joined = parseInstant(episode.joinedAt);
    const ended = episode.endedAt === null ? null : parseInstant(episode.endedAt);
    if (Number.isNaN(joined) || (ended !== null && Number.isNaN(ended))) return { valid: false, rejection: 'UNPARSEABLE_TIMESTAMP' };
    if (ended !== null && ended < joined) return { valid: false, rejection: 'ENDED_BEFORE_JOINED' };
    parsed.push({ key: `${episode.worldId} ${episode.member.humanId}`, joined, ended });
  }
  const byMember = new Map<string, Array<{ readonly joined: number; readonly ended: number | null }>>();
  for (const entry of parsed) {
    const list = byMember.get(entry.key) ?? [];
    list.push(entry);
    byMember.set(entry.key, list);
  }
  for (const list of byMember.values()) {
    if (list.filter((entry) => entry.ended === null).length > 1) return { valid: false, rejection: 'MULTIPLE_OPEN_EPISODES' };
    const ordered = [...list].sort((left, right) => left.joined - right.joined);
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      if (previous.ended === null || ordered[index].joined < previous.ended) return { valid: false, rejection: 'OVERLAPPING_EPISODES' };
    }
  }
  return { valid: true };
}

/**
 * What a membership episode grants BY ITSELF: FROM_JOIN_FORWARD (CW2-01 §12).
 * Anything earlier needs a separate HISTORY_ACCESS_GRANT or a later rule owned
 * by CW2-03; nothing here derives it from membership.
 */
export function defaultHistoryAccessOnJoin(episode: MembershipEpisode): HistoryAccessDefault {
  return { scope: HISTORY_ACCESS_DEFAULT_ON_JOIN, fromInclusive: episode.joinedAt };
}

// ---------------------------------------------------------------------------
// Dependency / provenance and content availability.
// ---------------------------------------------------------------------------

export function isDependencyKind(value: unknown): value is DependencyKind {
  return typeof value === 'string' && (DEPENDENCY_KINDS as ReadonlyArray<string>).includes(value);
}

export function isContentAvailability(value: unknown): value is ContentAvailability {
  return typeof value === 'string' && (CONTENT_AVAILABILITIES as ReadonlyArray<string>).includes(value);
}

/**
 * Only a MATERIAL_DEPENDENCY can make source-material rights relevant to the
 * target. A REASONING_DEPENDENCY never does - it is not material consent - and
 * an INDEPENDENT_TARGET_TRUTH has no source at all.
 */
export function mayRequireSourceMaterialRights(record: ProvenanceRecord): boolean {
  return record.kind === 'MATERIAL_DEPENDENCY';
}

/**
 * Provenance identity survives whatever happened to the content; the content
 * itself is PRESENT only while AVAILABLE. Deleted, unavailable or unrecognised
 * availability all withhold it - provenance never reconstructs a source.
 */
export function resolveSourceMaterialView(
  _record: MaterialDependency | ReasoningDependency,
  availability: ContentAvailability,
): SourceMaterialView {
  const known = isContentAvailability(availability) ? availability : 'UNAVAILABLE';
  return { dependencyIdentified: true, content: known === 'AVAILABLE' ? 'PRESENT' : 'WITHHELD', availability: known };
}

// ---------------------------------------------------------------------------
// Audience expansion.
// ---------------------------------------------------------------------------

/**
 * Explicit audience-expansion classification (I-00 §14, CW2-01 §36). An
 * operation the kernel does not recognise is classified as AUDIENCE_EXPANSION:
 * the safe reading of "unknown" is that it widens audience and needs authority.
 */
export function classifyAudienceExpansion(operation: AudienceOperation): AudienceExpansionIntent {
  switch (operation.operation) {
    case 'PUBLISH_TO_PUBLIC_WORLD':
    case 'DISTRIBUTE_REPLAY_EXTERNALLY':
      return 'AUDIENCE_EXPANSION';
    case 'DISCLOSE_SOURCE_MATERIAL_TO_SHARED_AUDIENCE':
      return operation.audienceAlreadyPossessed === true ? 'NO_AUDIENCE_EXPANSION' : 'AUDIENCE_EXPANSION';
    case 'CREATE_INTERNAL_REPLAY_DRAFT':
    case 'ADMIT_CONTEXT_FOR_REASONING':
    case 'INSPECT_OWN_MATERIAL':
      return 'NO_AUDIENCE_EXPANSION';
    default:
      return 'AUDIENCE_EXPANSION';
  }
}

// ---------------------------------------------------------------------------
// Context Admission.
// ---------------------------------------------------------------------------

/**
 * Structural validation of a Context Admission. Exactly two scopes exist;
 * a Public World scope, a QANDEEL owner, a Shared scope without an exact target
 * World, or a purpose that does not belong to its scope all fail closed.
 */
export function validateContextAdmission(candidate: unknown): ContextAdmissionValidation {
  if (typeof candidate !== 'object' || candidate === null) return { valid: false, rejection: 'UNSUPPORTED_SCOPE' };
  const admission = candidate as { readonly scope?: unknown; readonly owner?: unknown; readonly targetWorldId?: unknown; readonly purpose?: unknown };
  if (!(CONTEXT_ADMISSION_SCOPES as ReadonlyArray<unknown>).includes(admission.scope)) return { valid: false, rejection: 'UNSUPPORTED_SCOPE' };
  if (!isHumanPrincipal(admission.owner)) return { valid: false, rejection: 'NON_HUMAN_OWNER' };
  if (admission.scope === 'SHARED_EXACT_WORLD') {
    if (typeof admission.targetWorldId !== 'string' || admission.targetWorldId.trim().length === 0) return { valid: false, rejection: 'MISSING_TARGET_WORLD' };
    if (admission.purpose !== 'SHARED_REASONING') return { valid: false, rejection: 'PURPOSE_SCOPE_MISMATCH' };
    return {
      valid: true,
      admission: { scope: 'SHARED_EXACT_WORLD', owner: admission.owner, targetWorldId: admission.targetWorldId as SharedWorldId, purpose: 'SHARED_REASONING' },
    };
  }
  if (admission.purpose !== 'MATCHING_CAPABILITY') return { valid: false, rejection: 'PURPOSE_SCOPE_MISMATCH' };
  return { valid: true, admission: { scope: 'MATCHING', owner: admission.owner, purpose: 'MATCHING_CAPABILITY' } };
}

/**
 * The only questions an admission answers `true` to:
 *
 *   SHARED_EXACT_WORLD -> reasoning for THAT exact World
 *   MATCHING           -> reasoning for the Matching capability
 *
 * Material disclosure is never authorized by an admission (CW2-01 §19-§20,
 * A13), and a Matching admission never answers for any Shared World - not even
 * the one born from the Mutual Match (CW2-01 A15, CW2-02 B28).
 */
export function contextAdmissionAuthorizes(admission: ContextAdmission, question: ContextAdmissionQuestion): boolean {
  switch (question.question) {
    case 'REASONING_FOR_SHARED_WORLD':
      return admission.scope === 'SHARED_EXACT_WORLD' && admission.targetWorldId === question.worldId;
    case 'REASONING_FOR_MATCHING':
      return admission.scope === 'MATCHING';
    case 'MATERIAL_DISCLOSURE':
      return false;
    default:
      return false;
  }
}
