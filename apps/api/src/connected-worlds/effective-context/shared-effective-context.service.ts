// I-03E - Shared EffectiveContext: private Context Admission envelope and
// pre-model World gate.
//
// Pre-model authority envelope. Must be revalidated before protected
// delivery/commit by a later runtime boundary.
//
// The ONE server-internal composition of the frozen I-03 chain for the Shared
// private-reasoning lane (CW2-02 §21; I-00 §7, R2):
//
//   validate candidate-set structure
//     -> resolve exact World state            (I-03E World-state resolver, 0080)
//     -> READ_ONLY_CLOSED blocks               (CW2-03 §35 / C31)
//     -> resolve exact current human audience  (I-03D)
//     -> EMPTY blocks, UNRESOLVED is unresolved (CW2-03 §27 / C24)
//     -> exclude DELETED_BY_OWNER / UNAVAILABLE (CW2-02 §27 / B19)
//     -> one grant resolution per unique owner (I-03B)
//     -> one I-03A decision per AVAILABLE candidate, same audience snapshot
//     -> ALLOW admits; DENY and UNKNOWN are excluded   (CW2-02 §5 / B4)
//     -> build the envelope and its deterministic fingerprint (CW2-02 §7 / B6)
//
// A private MY_WORLD context item is absent from the EffectiveContext unless
// current World state, the exact current Shared audience, the exact current
// Standing Context authority and the exact source availability all permit its
// use. Each candidate is authorized only by its exact owner's grant: grants
// are never unioned (CW2-02 §12 / B10), an Introduction-phase World creates no
// extra privacy authority (CW2-03 §44 / C38), and no grantor-in-audience rule
// is invented (I-03A deliberately did not require it: a valid current grant is
// an independent authority basis, CW2-03 §26).
//
// What this service is NOT: it retrieves no private context (the candidates
// arrive from a server-owned collector: retrieval relevance != authority
// eligibility), reads no Personal table, invokes no model, builds no
// ModelRouterRequest, budgets no bytes or tokens (QIR-004 owns resource
// allocation; this owns eligibility), reranks, summarizes, rewrites, redacts
// or quotes nothing, scans no output, revalidates no delivery, and exposes no
// route. An admitted item is reasoning-only context, never material, never
// Shared truth and never a provenance record; a later generated target may
// record a REASONING_DEPENDENCY, which does not exist yet.

import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CONTENT_AVAILABILITIES } from '../kernel/material.types';
import { isHumanPrincipal, isLegalSharedWorldState } from '../kernel/world-invariants';
import type { SharedWorldId } from '../kernel/world.types';
import { evaluateStandingContextAuthority } from '../authority/standing-context-authority';
import { STANDING_CONTEXT_ACTION, STANDING_CONTEXT_PURPOSE } from '../authority/standing-context-authority.types';
import type { SharedHumanAudienceSnapshot, StandingContextAuthorityRequest, StandingContextGrantResolution } from '../authority/standing-context-authority.types';
import { StandingContextGrantResolverService } from '../authority-resolution/standing-context-grant-resolver.service';
import type { SharedHumanAudienceResolution } from '../audience/shared-human-audience-resolution.types';
import { SharedHumanAudienceResolverService } from '../audience/shared-human-audience-resolver.service';
import { SharedPreModelWorldStateResolverService } from './shared-pre-model-world-state-resolver.service';
import type {
  AuthorizedPrivateReasoningContext,
  SharedEffectiveContext,
  SharedEffectiveContextBlockReason,
  SharedEffectiveContextResolution,
  SharedEffectiveContextUnresolvedReason,
  SharedPreModelWorldStateResolution,
  SharedPrivateContextCandidate,
} from './shared-effective-context.types';
import { SHARED_PRIVATE_CONTEXT_CANDIDATE_KIND } from './shared-effective-context.types';

export const SHARED_EFFECTIVE_CONTEXT_VERSION = 'QANDEEL_CWV2_SHARED_EFFECTIVE_CONTEXT_V1' as const;

const CANDIDATE_KEYS = ['kind', 'contextId', 'originWorld', 'availability'] as const;
const AVAILABLE_CANDIDATE_KEYS = [...CANDIDATE_KEYS, 'reasoningContent'] as const;
const ORIGIN_WORLD_KEYS = ['architectureClass', 'worldType', 'owner'] as const;
const OWNER_KEYS = ['kind', 'humanId'] as const;

// An unexpected grant-resolver failure for one owner is item-local: it is the
// same as an unresolved grant (I-03A maps it to UNKNOWN, which excludes that
// owner's candidates) and never aborts another owner's independently
// authorized context.
const GRANT_RESOLUTION_FAILED: StandingContextGrantResolution = Object.freeze({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' } as const);

/** One structurally valid AVAILABLE candidate, in offered order. Unavailable candidates never reach this shape. */
interface ValidatedAvailableCandidate {
  readonly ownerHumanId: string;
  readonly contextId: string;
  readonly reasoningContent: string;
}

type ResolvedWorldState = Extract<SharedPreModelWorldStateResolution, { readonly state: 'RESOLVED' }>;
type ResolvedAudience = Extract<SharedHumanAudienceResolution, { readonly state: 'RESOLVED' }>;

function unresolved(reason: SharedEffectiveContextUnresolvedReason): SharedEffectiveContextResolution {
  return Object.freeze({ state: 'UNRESOLVED', reason } as const);
}

function blocked(reason: SharedEffectiveContextBlockReason): SharedEffectiveContextResolution {
  return Object.freeze({ state: 'BLOCKED', reason } as const);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// Exact property sets: a candidate, an origin or an owner carrying ANY other
// property (a permission claim, a disclosure flag, a material reference, a
// second content field) is malformed rather than silently tolerated.
function hasExactKeys(value: Record<string, unknown>, keys: ReadonlyArray<string>): boolean {
  const present = Object.keys(value);
  return present.length === keys.length && keys.every((key) => present.includes(key));
}

/**
 * Structural validation of the offered candidate set (task I-03E §13-§15).
 * The WHOLE set fails closed on the first malformed or contradictory
 * candidate: a non-MY_WORLD origin, a non-human owner, a blank context id, an
 * unsupported availability, an unknown property, the same owner offering the
 * same context id twice, or a deleted / unavailable candidate that still
 * carries content. The result is the AVAILABLE candidates only, in offered
 * order; deleted and unavailable candidates are excluded here, before any
 * grant is resolved, so no authority lookup can resurrect them.
 */
function validateCandidateSet(candidates: unknown): ReadonlyArray<ValidatedAvailableCandidate> | 'MALFORMED' {
  if (!Array.isArray(candidates)) return 'MALFORMED';
  const identities = new Set<string>();
  const available: ValidatedAvailableCandidate[] = [];
  for (const candidate of candidates as ReadonlyArray<unknown>) {
    if (!isRecord(candidate) || candidate.kind !== SHARED_PRIVATE_CONTEXT_CANDIDATE_KIND) return 'MALFORMED';
    const { contextId, originWorld, availability } = candidate;
    if (!isNonBlankString(contextId)) return 'MALFORMED';
    if (!isRecord(originWorld) || !hasExactKeys(originWorld, ORIGIN_WORLD_KEYS)) return 'MALFORMED';
    if (originWorld.architectureClass !== 'WORLD' || originWorld.worldType !== 'MY_WORLD') return 'MALFORMED';
    const owner = originWorld.owner;
    if (!isRecord(owner) || !hasExactKeys(owner, OWNER_KEYS) || !isHumanPrincipal(owner)) return 'MALFORMED';
    if (!(CONTENT_AVAILABILITIES as ReadonlyArray<unknown>).includes(availability)) return 'MALFORMED';
    // Source identity is (origin MY_WORLD owner, contextId): the same opaque
    // id under two different owners is two sources; twice under one owner is
    // a contradiction.
    const identity = JSON.stringify([owner.humanId, contextId]);
    if (identities.has(identity)) return 'MALFORMED';
    identities.add(identity);
    if (availability === 'AVAILABLE') {
      if (!hasExactKeys(candidate, AVAILABLE_CANDIDATE_KEYS) || typeof candidate.reasoningContent !== 'string') return 'MALFORMED';
      available.push({ ownerHumanId: owner.humanId, contextId, reasoningContent: candidate.reasoningContent });
    } else if (!hasExactKeys(candidate, CANDIDATE_KEYS) || 'reasoningContent' in candidate) {
      // A deleted / unavailable source that still carries content is a
      // contradiction of the frozen availability law, never ignored.
      return 'MALFORMED';
    }
  }
  return available;
}

// The World-state resolver is server-internal and returns a bounded union,
// but its answer is still checked positively before it gates anything.
function isResolvedWorldState(value: unknown, targetWorldId: SharedWorldId): value is ResolvedWorldState {
  if (!isRecord(value) || value.state !== 'RESOLVED' || !isRecord(value.snapshot)) return false;
  const { worldId, lifecycle, phase, snapshotRef } = value.snapshot;
  return worldId === targetWorldId && isLegalSharedWorldState({ lifecycle, phase }) && isNonBlankString(snapshotRef);
}

// The audience snapshot every candidate is evaluated against must be the
// frozen I-03A shape: a non-blank reference and a non-empty, duplicate-free
// set of human principals. Membership of any particular owner is NOT checked.
function isResolvedAudience(value: unknown): value is ResolvedAudience {
  if (!isRecord(value) || value.state !== 'RESOLVED' || !isRecord(value.snapshot)) return false;
  const { snapshotRef, humans } = value.snapshot;
  if (!isNonBlankString(snapshotRef) || !Array.isArray(humans) || humans.length === 0 || !humans.every(isHumanPrincipal)) return false;
  return new Set(humans.map((human) => human.humanId)).size === humans.length;
}

/** `sha256:<64 hex>` over the exact UTF-8 reasoning content: drift detection only, never a replacement and never a permission. */
export function digestReasoningContent(reasoningContent: string): string {
  return `sha256:${createHash('sha256').update(reasoningContent, 'utf8').digest('hex')}`;
}

/**
 * The deterministic EffectiveContext fingerprint (task I-03E §32). It binds
 * the exact World, the World-state snapshot, the audience snapshot and, in
 * admitted order, each item's ordinal, owner, context id, content digest,
 * grant id and authority snapshot. It contains no raw private content, no
 * clock, no random identity and no secret. Exported so tests can prove
 * determinism and every required sensitivity against the canonical content.
 */
export function fingerprintSharedEffectiveContext(facts: {
  readonly worldId: string;
  readonly worldStateSnapshotRef: string;
  readonly audienceSnapshotRef: string;
  readonly items: ReadonlyArray<{
    readonly ownerHumanId: string;
    readonly contextId: string;
    readonly contentDigest: string;
    readonly grantId: string;
    readonly authoritySnapshotRef: string;
  }>;
}): string {
  const lines = [
    SHARED_EFFECTIVE_CONTEXT_VERSION,
    `world=${facts.worldId.toLowerCase()}`,
    `worldState=${facts.worldStateSnapshotRef}`,
    `audience=${facts.audienceSnapshotRef}`,
    `items=${facts.items.length}`,
    // Each item line is an unambiguous JSON array, so an owner id or context
    // id containing a separator can never collide with another item.
    ...facts.items.map((item, ordinal) => JSON.stringify([ordinal, item.ownerHumanId, item.contextId, item.contentDigest, item.grantId, item.authoritySnapshotRef])),
  ];
  return `sha256:${createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')}`;
}

@Injectable()
export class SharedEffectiveContextService {
  constructor(
    private readonly worldState: SharedPreModelWorldStateResolverService,
    private readonly audience: SharedHumanAudienceResolverService,
    private readonly grants: StandingContextGrantResolverService,
  ) {}

  /**
   * Builds the Shared EffectiveContext for one exact target World from the
   * candidate private context a server-owned collector offered. Returns -
   * never throws - a frozen `SharedEffectiveContextResolution`. No user token,
   * client audience, client grant claim, material or disclosure parameter
   * exists; the result carries no per-owner authority detail and no raw
   * upstream error.
   */
  async resolve(targetWorldId: SharedWorldId, candidates: ReadonlyArray<SharedPrivateContextCandidate>): Promise<SharedEffectiveContextResolution> {
    const validated = validateCandidateSet(candidates);
    if (validated === 'MALFORMED') return unresolved('MALFORMED_CANDIDATE_SET');

    // Resolve World / capability. A closed World is known canonical state that
    // blocks ordinary generation before audience or grants are touched.
    let worldState: unknown;
    try {
      worldState = await this.worldState.resolveCurrent(targetWorldId);
    } catch {
      return unresolved('WORLD_STATE_UNRESOLVED');
    }
    if (!isResolvedWorldState(worldState, targetWorldId)) return unresolved('WORLD_STATE_UNRESOLVED');
    if (worldState.snapshot.lifecycle === 'READ_ONLY_CLOSED') return blocked('WORLD_READ_ONLY_CLOSED');
    // ACTIVE / STANDARD and ACTIVE / INTRODUCTION proceed identically from
    // here: the Introduction phase creates no extra privacy authority.

    // Resolve the exact Audience Snapshot, once, for every candidate.
    let audience: unknown;
    try {
      audience = await this.audience.resolveCurrent(targetWorldId);
    } catch {
      return unresolved('AUDIENCE_UNRESOLVED');
    }
    if (isRecord(audience) && audience.state === 'EMPTY') return blocked('NO_ACTIVE_HUMANS');
    if (!isResolvedAudience(audience)) return unresolved('AUDIENCE_UNRESOLVED');
    const audienceSnapshot: SharedHumanAudienceSnapshot = audience.snapshot;

    // One current Standing Context Grant resolution per unique AVAILABLE
    // candidate owner, in first-appearance order. Lookups may run in
    // parallel; authority is evaluated below in offered candidate order.
    const owners = [...new Set(validated.map((candidate) => candidate.ownerHumanId))];
    const resolutions = new Map<string, StandingContextGrantResolution>();
    await Promise.all(owners.map(async (ownerHumanId) => {
      let resolution: StandingContextGrantResolution;
      try {
        resolution = await this.grants.resolveCurrent(targetWorldId, Object.freeze({ kind: 'HUMAN', humanId: ownerHumanId } as const));
      } catch {
        resolution = GRANT_RESOLUTION_FAILED;
      }
      resolutions.set(ownerHumanId, resolution);
    }));

    // Evaluate every AVAILABLE candidate through the frozen I-03A law against
    // the SAME audience snapshot and its owner's ONE resolved grant state.
    const admitted: AuthorizedPrivateReasoningContext[] = [];
    for (const candidate of validated) {
      const grantor = Object.freeze({ kind: 'HUMAN', humanId: candidate.ownerHumanId } as const);
      const request: StandingContextAuthorityRequest = Object.freeze({
        action: STANDING_CONTEXT_ACTION,
        grantor,
        targetWorldId,
        purpose: STANDING_CONTEXT_PURPOSE,
        audienceSnapshot,
      });
      const decision = evaluateStandingContextAuthority(request, resolutions.get(candidate.ownerHumanId) ?? GRANT_RESOLUTION_FAILED);
      // DENY and UNKNOWN are both excluded before any provider path; the
      // reason class stays internal to I-03A and never enters this result.
      if (decision.decision !== 'ALLOW') continue;
      admitted.push(Object.freeze({
        kind: 'AUTHORIZED_PRIVATE_REASONING_CONTEXT',
        source: Object.freeze({
          contextId: candidate.contextId,
          originWorld: Object.freeze({ architectureClass: 'WORLD', worldType: 'MY_WORLD', owner: grantor } as const),
        }),
        // Byte-for-byte: never summarized, rewritten, redacted, tokenized or reranked.
        reasoningContent: candidate.reasoningContent,
        contentDigest: digestReasoningContent(candidate.reasoningContent),
        authority: decision,
      }));
    }

    const effectiveContext: SharedEffectiveContext = Object.freeze({
      effectiveContextRef: fingerprintSharedEffectiveContext({
        worldId: targetWorldId,
        worldStateSnapshotRef: worldState.snapshot.snapshotRef,
        audienceSnapshotRef: audienceSnapshot.snapshotRef,
        items: admitted.map((item) => ({
          ownerHumanId: item.source.originWorld.owner.humanId,
          contextId: item.source.contextId,
          contentDigest: item.contentDigest,
          grantId: item.authority.binding.grantId,
          authoritySnapshotRef: item.authority.binding.authoritySnapshotRef,
        })),
      }),
      targetWorldId,
      worldStateSnapshotRef: worldState.snapshot.snapshotRef,
      audienceSnapshot,
      privateReasoningContexts: Object.freeze(admitted),
    });
    return Object.freeze({ state: 'READY', effectiveContext } as const);
  }
}
