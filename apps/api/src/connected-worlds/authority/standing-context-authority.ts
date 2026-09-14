// I-03A - Shared Standing Context authority evaluator.
//
// Pre-model authority decision. Must be revalidated before protected
// delivery/commit by a later runtime boundary.
//
// Pure, synchronous, deterministic and fail-closed. No I/O, no persistence
// lookup, no model call, no clock, no random identity, no ambient state. The
// evaluator receives already-resolved authority facts - an exact request with
// its exact current human Audience Snapshot, and ONE resolution of the current
// Standing Context Grant state for the exact (grantor, World) query - and
// applies the decision law of task I-03A §11 to them. It does not decide
// membership, Shared lifecycle eligibility, material availability, Safety,
// entitlement or delivery; those belong to later I-03 / I-04 boundaries.
//
// Decision law, in evaluation order:
//
//   1. request / audience validity      malformed -> UNKNOWN (§11.2, §11.6)
//   2. resolution validity and state    UNRESOLVED -> UNKNOWN, NOT_FOUND -> DENY (§11.1)
//   3. grant snapshot validity          malformed -> UNKNOWN, unknown status -> UNKNOWN
//   4. status                           REVOKED -> DENY (§11.3)
//   5. exact grantor                    mismatch -> DENY (§11.4)
//   6. exact World                      mismatch -> DENY (§11.5)
//   7. audience ceiling                 A ⊄ C -> DENY (§11.7)
//   8. ALLOW, reasoning-only, bound to the request and both snapshots (§12-§14)
//
// Validity is checked before the resolution state because DENY is a POSITIVE
// canonical statement about one exact query: without a well-formed exact
// query there is nothing to positively deny, only something not safely
// knowable. NOT_FOUND therefore maps to DENY for every well-formed request,
// exactly as §11.1 requires, and never hides a malformed one.

import { classifyWorldCandidate, isHumanPrincipal } from '../kernel/world-invariants';
import type { HumanPrincipal } from '../kernel/principal.types';
import type { SharedWorldId } from '../kernel/world.types';
import {
  STANDING_CONTEXT_ACTION,
  STANDING_CONTEXT_GRANT_STATUSES,
  STANDING_CONTEXT_PURPOSE,
} from './standing-context-authority.types';
import type {
  SharedHumanAudienceSnapshot,
  StandingContextAllowConstraints,
  StandingContextAuthorityDecision,
  StandingContextAuthorityRequest,
  StandingContextDecisionBinding,
  StandingContextDenyReason,
  StandingContextGrantResolution,
  StandingContextGrantSnapshot,
  StandingContextUnknownReason,
} from './standing-context-authority.types';

// The ONLY constraint set an ALLOW can carry. Frozen: it is a runtime constant
// compared and returned by structure, never widened per call.
const ALLOW_CONSTRAINTS: StandingContextAllowConstraints = Object.freeze({
  contextClassification: 'PRIVATE_REASONING_ONLY_CONTEXT',
  reasoningAuthority: 'ALLOW',
  directPrivateDisclosureAuthority: 'NOT_GRANTED',
  materialDisclosureAuthority: 'NOT_GRANTED',
  provenanceDisclosure: 'SEALED',
  deliveryAuthority: 'REQUIRES_REVALIDATION',
} as const);

const REQUEST_KEYS = ['action', 'grantor', 'targetWorldId', 'purpose', 'audienceSnapshot'] as const;
const AUDIENCE_SNAPSHOT_KEYS = ['snapshotRef', 'humans'] as const;
const GRANT_SNAPSHOT_KEYS = ['grantId', 'worldId', 'grantor', 'status', 'audienceCeiling'] as const;

function deny(reason: StandingContextDenyReason): StandingContextAuthorityDecision {
  return Object.freeze({ decision: 'DENY', externalEffect: 'BLOCKED', reason } as const);
}

function unknown(reason: StandingContextUnknownReason): StandingContextAuthorityDecision {
  return Object.freeze({ decision: 'UNKNOWN', externalEffect: 'BLOCKED', reason } as const);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Exact property sets: a request, a snapshot or a grant carrying ANY other
// property (a client permission claim, a disclosure flag, a scope, a TTL, a
// list of grants) is malformed rather than silently tolerated.
function hasExactKeys(value: Record<string, unknown>, keys: ReadonlyArray<string>): boolean {
  const present = Object.keys(value);
  return present.length === keys.length && keys.every((key) => present.includes(key));
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// A Shared World identity is an opaque non-blank identifier. A World-taxonomy
// or non-World name (PUBLIC_WORLD, MATCHING, REPLAY, INTRODUCTION, ...) is
// never a World identity, so it is refused structurally rather than compared.
function isSharedWorldIdentity(value: unknown): value is SharedWorldId {
  return isNonBlankString(value) && classifyWorldCandidate(value).verdict === 'UNKNOWN';
}

// A set of humans: every element human, no human identity repeated. Duplicate
// state is malformed and is never normalized away (§16).
function isHumanSet(value: unknown): value is ReadonlyArray<HumanPrincipal> {
  if (!Array.isArray(value) || !value.every(isHumanPrincipal)) return false;
  return new Set(value.map((human) => human.humanId)).size === value.length;
}

function validateRequest(request: unknown): StandingContextUnknownReason | undefined {
  if (!isRecord(request) || !hasExactKeys(request, REQUEST_KEYS)) return 'MALFORMED_REQUEST';
  const { action, grantor, targetWorldId, purpose, audienceSnapshot } = request;
  if (action !== STANDING_CONTEXT_ACTION || purpose !== STANDING_CONTEXT_PURPOSE) return 'MALFORMED_REQUEST';
  if (!isHumanPrincipal(grantor)) return 'MALFORMED_REQUEST';
  if (!isSharedWorldIdentity(targetWorldId)) return 'MALFORMED_REQUEST';
  return validateAudienceSnapshot(audienceSnapshot);
}

function validateAudienceSnapshot(snapshot: unknown): StandingContextUnknownReason | undefined {
  if (!isRecord(snapshot) || !hasExactKeys(snapshot, AUDIENCE_SNAPSHOT_KEYS)) return 'MALFORMED_AUDIENCE_SNAPSHOT';
  if (!isNonBlankString(snapshot.snapshotRef)) return 'MISSING_AUDIENCE_SNAPSHOT_REF';
  // An empty audience is malformed for a protected output decision (§8).
  if (!isHumanSet(snapshot.humans) || snapshot.humans.length === 0) return 'MALFORMED_AUDIENCE_SNAPSHOT';
  return undefined;
}

function validateGrantSnapshot(grant: unknown): StandingContextUnknownReason | undefined {
  if (!isRecord(grant) || !hasExactKeys(grant, GRANT_SNAPSHOT_KEYS)) return 'MALFORMED_GRANT_SNAPSHOT';
  if (!isNonBlankString(grant.grantId) || !isSharedWorldIdentity(grant.worldId)) return 'MALFORMED_GRANT_SNAPSHOT';
  if (!isHumanPrincipal(grant.grantor) || !isHumanSet(grant.audienceCeiling)) return 'MALFORMED_GRANT_SNAPSHOT';
  if (!(STANDING_CONTEXT_GRANT_STATUSES as ReadonlyArray<unknown>).includes(grant.status)) return 'UNKNOWN_GRANT_STATUS';
  return undefined;
}

// Deterministic, locale-independent code-unit ordering of the audience
// identities, so the same human set always yields the same binding.
function canonicalHumanIds(humans: ReadonlyArray<HumanPrincipal>): ReadonlyArray<string> {
  return Object.freeze([...humans.map((human) => human.humanId)].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0)));
}

/**
 * Evaluates one exact Shared private-reasoning request against one resolved
 * Standing Context Grant state. Both parameters are treated as untrusted /
 * resolved runtime state: every malformed shape yields a named UNKNOWN and
 * nothing throws. The inputs are never mutated; the ceiling is never widened,
 * current members are never added to it, and no second grant is consulted.
 */
export function evaluateStandingContextAuthority(
  request: StandingContextAuthorityRequest,
  resolution: StandingContextGrantResolution,
): StandingContextAuthorityDecision {
  const requestProblem = validateRequest(request);
  if (requestProblem) return unknown(requestProblem);

  if (!isRecord(resolution)) return unknown('GRANT_STATE_UNRESOLVED');
  if (resolution.state === 'UNRESOLVED') return unknown('GRANT_STATE_UNRESOLVED');
  if (resolution.state !== 'FOUND' && resolution.state !== 'NOT_FOUND') return unknown('GRANT_STATE_UNRESOLVED');
  if (!isNonBlankString(resolution.authoritySnapshotRef)) return unknown('MISSING_AUTHORITY_SNAPSHOT_REF');
  if (resolution.state === 'NOT_FOUND') {
    if (!hasExactKeys(resolution, ['state', 'authoritySnapshotRef'])) return unknown('GRANT_STATE_UNRESOLVED');
    return deny('NO_STANDING_CONTEXT_GRANT');
  }
  if (!hasExactKeys(resolution, ['state', 'authoritySnapshotRef', 'grant'])) return unknown('GRANT_STATE_UNRESOLVED');

  const grantProblem = validateGrantSnapshot(resolution.grant);
  if (grantProblem) return unknown(grantProblem);
  const grant: StandingContextGrantSnapshot = resolution.grant;

  if (grant.status === 'REVOKED') return deny('GRANT_REVOKED');
  if (grant.grantor.humanId !== request.grantor.humanId) return deny('GRANTOR_MISMATCH');
  if (grant.worldId !== request.targetWorldId) return deny('TARGET_WORLD_MISMATCH');

  // ALLOW requires A ⊆ C over human identity. An empty ceiling authorizes no
  // non-empty audience; nothing is inferred from order or from membership.
  const ceiling = new Set(grant.audienceCeiling.map((human) => human.humanId));
  const audience: SharedHumanAudienceSnapshot = request.audienceSnapshot;
  if (!audience.humans.every((human) => ceiling.has(human.humanId))) return deny('AUDIENCE_EXCEEDS_GRANT_CEILING');

  const binding: StandingContextDecisionBinding = Object.freeze({
    action: STANDING_CONTEXT_ACTION,
    grantorHumanId: request.grantor.humanId,
    targetWorldId: request.targetWorldId,
    purpose: STANDING_CONTEXT_PURPOSE,
    audienceHumanIds: canonicalHumanIds(audience.humans),
    grantId: grant.grantId,
    authoritySnapshotRef: resolution.authoritySnapshotRef,
    audienceSnapshotRef: audience.snapshotRef,
  });
  return Object.freeze({ decision: 'ALLOW', externalEffect: 'ADMIT_FOR_REASONING_ONLY', constraints: ALLOW_CONSTRAINTS, binding } as const);
}
