// I-03F - Shared delivery authority revalidation boundary.
//
// The ONE server-internal answer to CW2-02 §8: a result computed under a
// previously valid authority envelope is NOT grandfathered merely because the
// computation already happened. Between the provider returning bytes and any
// protected delivery or irreversible commit, the exact facts that admitted
// private context must still hold (CW2-02 §6, §22, §48, B7, B34; CW2-03 §48).
//
// Revalidation order (task I-03F §39):
//
//   validate the supplied SharedEffectiveContext structurally
//     -> recompute and verify its frozen I-03E fingerprint
//     -> compute the exact output digest
//     -> resolve current World state              (frozen I-03E resolver, 0080)
//     -> READ_ONLY_CLOSED / changed snapshot -> STALE
//     -> resolve the exact current Audience Snapshot        (frozen I-03D, 0079)
//     -> exact EMPTY / changed snapshot -> STALE
//     -> dedup unique private owners and unique private sources
//     -> one current Standing Context Grant per owner       (frozen I-03B, 0077)
//     -> one current source state per exact source  (server-owned contract only)
//     -> re-evaluate EVERY admitted dependency      (frozen I-03A evaluator)
//     -> DENY / binding drift / source drift -> STALE
//     -> UNKNOWN / unresolved grant or source -> UNRESOLVED
//     -> otherwise CURRENT, bound to this one exact operation
//
// Why an unresolved dependency is GLOBAL here and item-local in I-03E: before
// generation, an owner whose authority is unknown can simply be left out of
// the envelope. After generation the output already depended on that owner's
// admitted context, and revalidation cannot retract a dependency that already
// influenced the bytes (task §25). So a post-generation UNKNOWN makes the whole
// old result not authority-current.
//
// What this boundary is NOT:
//
//   - it is not the Narrow Source Disclosure Gate. CW2-02 §58 explicitly
//     defers the exact implementation of direct-source disclosure detection,
//     so there is no quote detector, private-fact classifier, provenance-leak
//     detector, regex source matcher, embedding or string similarity measure,
//     redaction engine or provider self-declaration here, and none may be
//     inferred from a CURRENT result;
//   - it is not the System / Safety policy check;
//   - it is not delivery permission: CURRENT means `authorityStatus =
//     'CURRENT'` and nothing more;
//   - it persists, commits and mutates NOTHING - no Shared message, no
//     provenance record, no audit row, no outbox event, no grant, no
//     membership, no World state. Shared output persistence belongs to I-04;
//   - it invokes no model, re-runs no generation, reads no Personal table,
//     opens no route and adds no database boundary.
//
// The provider output is used for exactly one purpose: a SHA-256 identity that
// binds this revalidation to those exact bytes. Its text is never inspected,
// searched, compared, summarized, rewritten, classified or logged.

import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { classifyWorldCandidate, isHumanPrincipal, isLegalSharedWorldState } from '../kernel/world-invariants';
import type { HumanPrincipal } from '../kernel/principal.types';
import type { SharedWorldId } from '../kernel/world.types';
import { evaluateStandingContextAuthority } from '../authority/standing-context-authority';
import { STANDING_CONTEXT_ACTION, STANDING_CONTEXT_PURPOSE } from '../authority/standing-context-authority.types';
import type {
  SharedHumanAudienceSnapshot,
  StandingContextAllowConstraints,
  StandingContextAuthorityRequest,
  StandingContextGrantResolution,
} from '../authority/standing-context-authority.types';
import { StandingContextGrantResolverService } from '../authority-resolution/standing-context-grant-resolver.service';
import { SharedHumanAudienceResolverService } from '../audience/shared-human-audience-resolver.service';
import { SharedPreModelWorldStateResolverService } from '../effective-context/shared-pre-model-world-state-resolver.service';
import { fingerprintSharedEffectiveContext } from '../effective-context/shared-effective-context.service';
import type { PrivateSourceContextRef, SharedEffectiveContext } from '../effective-context/shared-effective-context.types';
import { SHARED_PRIVATE_SOURCE_STATE_RESOLVER } from './shared-private-source-state-resolver.types';
import type { SharedPrivateSourceStateResolution, SharedPrivateSourceStateResolver } from './shared-private-source-state-resolver.types';
import type {
  SharedDeliveryAuthorityCurrent,
  SharedDeliveryAuthorityRevalidation,
  SharedDeliveryAuthorityStaleReason,
  SharedDeliveryAuthorityUnresolvedReason,
} from './shared-delivery-authority.types';

export const SHARED_DELIVERY_AUTHORITY_REVALIDATION_VERSION = 'QANDEEL_CWV2_SHARED_DELIVERY_AUTHORITY_REVALIDATION_V1' as const;

// Exact property sets. An envelope, item, source, authority decision, binding
// or constraint set carrying ANY other property - a permission claim, a
// disclosure flag, a safety verdict, a second content field, a client-supplied
// availability - is malformed rather than silently tolerated.
const EFFECTIVE_CONTEXT_KEYS = ['effectiveContextRef', 'targetWorldId', 'worldStateSnapshotRef', 'audienceSnapshot', 'privateReasoningContexts'] as const;
const AUDIENCE_SNAPSHOT_KEYS = ['snapshotRef', 'humans'] as const;
const HUMAN_KEYS = ['kind', 'humanId'] as const;
const ITEM_KEYS = ['kind', 'source', 'reasoningContent', 'contentDigest', 'authority'] as const;
const SOURCE_KEYS = ['contextId', 'originWorld'] as const;
const ORIGIN_WORLD_KEYS = ['architectureClass', 'worldType', 'owner'] as const;
const ALLOW_KEYS = ['decision', 'externalEffect', 'constraints', 'binding'] as const;
const CONSTRAINT_KEYS = ['contextClassification', 'reasoningAuthority', 'directPrivateDisclosureAuthority', 'materialDisclosureAuthority', 'provenanceDisclosure', 'deliveryAuthority'] as const;
const BINDING_KEYS = ['action', 'grantorHumanId', 'targetWorldId', 'purpose', 'audienceHumanIds', 'grantId', 'authoritySnapshotRef', 'audienceSnapshotRef'] as const;
const WORLD_STATE_RESOLVED_KEYS = ['state', 'snapshot'] as const;
const WORLD_STATE_SNAPSHOT_KEYS = ['worldId', 'lifecycle', 'phase', 'snapshotRef'] as const;
const AUDIENCE_EMPTY_KEYS = ['state', 'snapshotRef'] as const;
const AUDIENCE_RESOLVED_KEYS = ['state', 'snapshot'] as const;
const SOURCE_AVAILABLE_KEYS = ['state', 'contentDigest'] as const;

/** The frozen I-03E / I-03A digest form. Nothing else is a content identity. */
const CONTENT_DIGEST = /^sha256:[0-9a-f]{64}$/u;

/**
 * The ONLY constraint set an admitted item may carry. It is the frozen I-03A
 * ALLOW constant: an envelope whose constraints were widened, narrowed or
 * re-spelled is malformed, and no delivery-time check can repair it.
 */
const EXPECTED_ALLOW_CONSTRAINTS: StandingContextAllowConstraints = Object.freeze({
  contextClassification: 'PRIVATE_REASONING_ONLY_CONTEXT',
  reasoningAuthority: 'ALLOW',
  directPrivateDisclosureAuthority: 'NOT_GRANTED',
  materialDisclosureAuthority: 'NOT_GRANTED',
  provenanceDisclosure: 'SEALED',
  deliveryAuthority: 'REQUIRES_REVALIDATION',
} as const);

/** The bounded grant resolution an unexpected resolver failure becomes. I-03A maps it to UNKNOWN; here UNKNOWN is global. */
const GRANT_RESOLUTION_FAILED: StandingContextGrantResolution = Object.freeze({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' } as const);
/** The bounded source resolution an unexpected resolver failure becomes. */
const SOURCE_RESOLUTION_FAILED: SharedPrivateSourceStateResolution = Object.freeze({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' } as const);

/** One admitted dependency, reduced to exactly the facts revalidation needs. Reasoning content is never carried here. */
interface ValidatedItem {
  readonly ownerHumanId: string;
  readonly contextId: string;
  readonly contentDigest: string;
  readonly grantId: string;
  readonly authoritySnapshotRef: string;
  /** The exact frozen source reference handed to the server-owned source-state contract, and nothing else. */
  readonly source: PrivateSourceContextRef;
}

interface ValidatedEnvelope {
  readonly targetWorldId: SharedWorldId;
  readonly effectiveContextRef: string;
  readonly worldStateSnapshotRef: string;
  readonly audienceSnapshotRef: string;
  /** Canonically ordered human ids of the generation audience, exactly as I-03A binds them. */
  readonly audienceHumanIds: ReadonlyArray<string>;
  readonly items: ReadonlyArray<ValidatedItem>;
}

/** What one admitted dependency's re-evaluation established. `OK` is the only outcome a CURRENT result tolerates. */
type ItemVerdict =
  | { readonly kind: 'OK' }
  | { readonly kind: 'STALE'; readonly reason: SharedDeliveryAuthorityStaleReason }
  | { readonly kind: 'UNRESOLVED'; readonly reason: SharedDeliveryAuthorityUnresolvedReason };

const OK: ItemVerdict = Object.freeze({ kind: 'OK' } as const);

function stale(reason: SharedDeliveryAuthorityStaleReason): SharedDeliveryAuthorityRevalidation {
  return Object.freeze({ state: 'STALE', reason } as const);
}

function unresolved(reason: SharedDeliveryAuthorityUnresolvedReason): SharedDeliveryAuthorityRevalidation {
  return Object.freeze({ state: 'UNRESOLVED', reason } as const);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasExactKeys(value: Record<string, unknown>, keys: ReadonlyArray<string>): boolean {
  const present = Object.keys(value);
  return present.length === keys.length && keys.every((key) => present.includes(key));
}

// A Shared World identity is an opaque non-blank identifier, exactly as I-03A
// judges it: a World-taxonomy or non-World name (PUBLIC_WORLD, MATCHING,
// REPLAY, INTRODUCTION, ...) is never a World identity. No stricter identity
// law is invented here; the resolvers own their own transport-level shape.
function isSharedWorldIdentity(value: unknown): value is SharedWorldId {
  return isNonBlankString(value) && classifyWorldCandidate(value).verdict === 'UNKNOWN';
}

/** Source identity is `(origin MY_WORLD owner, contextId)`: the same opaque id under two owners is two different sources. */
function sourceIdentity(ownerHumanId: string, contextId: string): string {
  return JSON.stringify([ownerHumanId, contextId]);
}

// Deterministic, locale-independent code-unit ordering, matching how I-03A
// canonicalizes an audience so the same human set always compares equal.
const byCodeUnit = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

function canonicalHumanIds(humans: ReadonlyArray<HumanPrincipal>): ReadonlyArray<string> {
  return [...humans.map((human) => human.humanId)].sort(byCodeUnit);
}

function sameIdList(left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

/**
 * `sha256:<64 hex>` over the exact UTF-8 provider output.
 *
 * This is the ONLY thing done with the output text. The digest binds one
 * revalidation to one exact byte sequence, contains no output, is not a bearer
 * permission, is not persisted here, and uses no clock, random value or
 * secret. Different bytes give a different digest, so a revalidation of output
 * A can never apply to output B.
 */
export function digestProviderOutput(outputText: string): string {
  return `sha256:${createHash('sha256').update(outputText, 'utf8').digest('hex')}`;
}

/**
 * The deterministic revalidation fingerprint (task I-03F §26). It binds the
 * envelope identity, the exact output identity, the exact World, the CURRENT
 * World-state and audience references, and - in exact admitted order - each
 * dependency's ordinal, owner, context id, content digest, grant id and
 * authority snapshot. It contains no raw private content, no raw output, no
 * clock, no random identity and no secret. Exported so tests can prove
 * determinism and every required sensitivity against the canonical content.
 */
export function fingerprintSharedDeliveryAuthorityRevalidation(facts: {
  readonly effectiveContextRef: string;
  readonly outputDigest: string;
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
    SHARED_DELIVERY_AUTHORITY_REVALIDATION_VERSION,
    `effectiveContext=${facts.effectiveContextRef}`,
    `output=${facts.outputDigest}`,
    `world=${facts.worldId.toLowerCase()}`,
    `worldState=${facts.worldStateSnapshotRef}`,
    `audience=${facts.audienceSnapshotRef}`,
    `items=${facts.items.length}`,
    // Each item line is an unambiguous JSON array, so an owner id or context id
    // containing a separator can never collide with another item.
    ...facts.items.map((item, ordinal) => JSON.stringify([ordinal, item.ownerHumanId, item.contextId, item.contentDigest, item.grantId, item.authoritySnapshotRef])),
  ];
  return `sha256:${createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')}`;
}

/**
 * Structural validation of the supplied envelope (task I-03F §15, §35-§37).
 *
 * The envelope is UNTRUSTED runtime data, never trusted because TypeScript
 * says so: it may have crossed a queue, a retry, a process boundary or a
 * caller that mutated it. The WHOLE envelope fails closed on the first
 * malformed or contradictory fact, and every check here runs BEFORE any
 * dependency call, so a malformed envelope never reaches the World, audience,
 * grant or source resolvers.
 */
function validateEffectiveContext(envelope: unknown): ValidatedEnvelope | 'MALFORMED' {
  if (!isRecord(envelope) || !hasExactKeys(envelope, EFFECTIVE_CONTEXT_KEYS)) return 'MALFORMED';
  const { effectiveContextRef, targetWorldId, worldStateSnapshotRef, audienceSnapshot, privateReasoningContexts } = envelope;
  if (!isNonBlankString(effectiveContextRef) || !isNonBlankString(worldStateSnapshotRef)) return 'MALFORMED';
  if (!isSharedWorldIdentity(targetWorldId)) return 'MALFORMED';

  // The generation audience: exactly the frozen I-03A snapshot shape, non-empty
  // and duplicate-free. Duplicate state is never normalized away.
  if (!isRecord(audienceSnapshot) || !hasExactKeys(audienceSnapshot, AUDIENCE_SNAPSHOT_KEYS)) return 'MALFORMED';
  const { snapshotRef: audienceSnapshotRef, humans } = audienceSnapshot;
  if (!isNonBlankString(audienceSnapshotRef)) return 'MALFORMED';
  if (!Array.isArray(humans) || humans.length === 0) return 'MALFORMED';
  for (const human of humans as ReadonlyArray<unknown>) {
    if (!isRecord(human) || !hasExactKeys(human, HUMAN_KEYS) || !isHumanPrincipal(human)) return 'MALFORMED';
  }
  const audienceHumanIds = canonicalHumanIds(humans as ReadonlyArray<HumanPrincipal>);
  if (new Set(audienceHumanIds).size !== audienceHumanIds.length) return 'MALFORMED';

  if (!Array.isArray(privateReasoningContexts)) return 'MALFORMED';
  const identities = new Set<string>();
  // Per owner, the ONE authority binding every item of that owner must share.
  const ownerBindings = new Map<string, string>();
  const items: ValidatedItem[] = [];
  for (const item of privateReasoningContexts as ReadonlyArray<unknown>) {
    if (!isRecord(item) || !hasExactKeys(item, ITEM_KEYS)) return 'MALFORMED';
    if (item.kind !== 'AUTHORIZED_PRIVATE_REASONING_CONTEXT') return 'MALFORMED';
    if (typeof item.reasoningContent !== 'string') return 'MALFORMED';
    if (typeof item.contentDigest !== 'string' || !CONTENT_DIGEST.test(item.contentDigest)) return 'MALFORMED';

    // The source: an exact MY_WORLD human source context, never a Shared,
    // Public or Matching origin and never a material reference.
    const source = item.source;
    if (!isRecord(source) || !hasExactKeys(source, SOURCE_KEYS) || !isNonBlankString(source.contextId)) return 'MALFORMED';
    const originWorld = source.originWorld;
    if (!isRecord(originWorld) || !hasExactKeys(originWorld, ORIGIN_WORLD_KEYS)) return 'MALFORMED';
    if (originWorld.architectureClass !== 'WORLD' || originWorld.worldType !== 'MY_WORLD') return 'MALFORMED';
    const owner = originWorld.owner;
    if (!isRecord(owner) || !hasExactKeys(owner, HUMAN_KEYS) || !isHumanPrincipal(owner)) return 'MALFORMED';

    // The authority: exactly the frozen I-03A ALLOW decision, with its exact
    // constraint literals. A DENY, an UNKNOWN or a widened constraint set is
    // not an admitted dependency.
    const authority = item.authority;
    if (!isRecord(authority) || !hasExactKeys(authority, ALLOW_KEYS)) return 'MALFORMED';
    if (authority.decision !== 'ALLOW' || authority.externalEffect !== 'ADMIT_FOR_REASONING_ONLY') return 'MALFORMED';
    const constraints = authority.constraints;
    if (!isRecord(constraints) || !hasExactKeys(constraints, CONSTRAINT_KEYS)) return 'MALFORMED';
    for (const key of CONSTRAINT_KEYS) {
      if (constraints[key] !== EXPECTED_ALLOW_CONSTRAINTS[key]) return 'MALFORMED';
    }

    const binding = authority.binding;
    if (!isRecord(binding) || !hasExactKeys(binding, BINDING_KEYS)) return 'MALFORMED';
    if (binding.action !== STANDING_CONTEXT_ACTION || binding.purpose !== STANDING_CONTEXT_PURPOSE) return 'MALFORMED';
    if (!isNonBlankString(binding.grantId) || !isNonBlankString(binding.authoritySnapshotRef)) return 'MALFORMED';
    // The binding must be THIS envelope's, not a foreign or stale internal one.
    if (binding.grantorHumanId !== owner.humanId) return 'MALFORMED';
    if (binding.targetWorldId !== targetWorldId) return 'MALFORMED';
    if (binding.audienceSnapshotRef !== audienceSnapshotRef) return 'MALFORMED';
    if (!Array.isArray(binding.audienceHumanIds)) return 'MALFORMED';
    if (!binding.audienceHumanIds.every((id: unknown) => typeof id === 'string')) return 'MALFORMED';
    if (!sameIdList([...(binding.audienceHumanIds as ReadonlyArray<string>)].sort(byCodeUnit), audienceHumanIds)) return 'MALFORMED';

    // One source may appear once. Same owner, same context id, twice is a
    // contradiction; the same opaque id under a different owner is not.
    const identity = sourceIdentity(owner.humanId, source.contextId);
    if (identities.has(identity)) return 'MALFORMED';
    identities.add(identity);

    // One owner carries ONE authority binding inside one envelope. Two items of
    // the same owner disagreeing about grant, authority snapshot, audience
    // reference, World, action or purpose is contradictory internal state.
    const ownerBinding = JSON.stringify([binding.grantId, binding.authoritySnapshotRef, binding.audienceSnapshotRef, binding.targetWorldId, binding.action, binding.purpose]);
    const known = ownerBindings.get(owner.humanId);
    if (known !== undefined && known !== ownerBinding) return 'MALFORMED';
    ownerBindings.set(owner.humanId, ownerBinding);

    items.push({
      ownerHumanId: owner.humanId,
      contextId: source.contextId,
      contentDigest: item.contentDigest,
      grantId: binding.grantId,
      authoritySnapshotRef: binding.authoritySnapshotRef,
      source: Object.freeze({
        contextId: source.contextId,
        originWorld: Object.freeze({ architectureClass: 'WORLD', worldType: 'MY_WORLD', owner: Object.freeze({ kind: 'HUMAN', humanId: owner.humanId } as const) } as const),
      }),
    });
  }
  return {
    targetWorldId,
    effectiveContextRef,
    worldStateSnapshotRef,
    audienceSnapshotRef,
    audienceHumanIds,
    items: Object.freeze(items),
  };
}

// The World-state resolver is server-internal and returns a bounded union, but
// its answer is still validated positively before it gates anything: only the
// exact frozen RESOLVED shape, for exactly the requested World, carrying a
// kernel-legal lifecycle / phase pair and a non-blank reference, is a known
// World state. Anything else is not safely knowable.
function resolvedWorldState(value: unknown, targetWorldId: SharedWorldId): { readonly lifecycle: string; readonly snapshotRef: string } | undefined {
  if (!isRecord(value) || !hasExactKeys(value, WORLD_STATE_RESOLVED_KEYS) || value.state !== 'RESOLVED') return undefined;
  const snapshot = value.snapshot;
  if (!isRecord(snapshot) || !hasExactKeys(snapshot, WORLD_STATE_SNAPSHOT_KEYS)) return undefined;
  const { worldId, lifecycle, phase, snapshotRef } = snapshot;
  if (worldId !== targetWorldId || !isNonBlankString(snapshotRef)) return undefined;
  if (typeof lifecycle !== 'string' || typeof phase !== 'string' || !isLegalSharedWorldState({ lifecycle, phase })) return undefined;
  return { lifecycle, snapshotRef };
}

// A known canonical zero-audience state is exactly the frozen I-03D EMPTY
// result and nothing else. An EMPTY-like object that is malformed is
// uncertainty, never the known fact that nobody is present.
function isEmptyAudience(value: unknown): boolean {
  return isRecord(value) && hasExactKeys(value, AUDIENCE_EMPTY_KEYS) && value.state === 'EMPTY' && isNonBlankString(value.snapshotRef);
}

// The exact frozen I-03D RESOLVED result carrying the frozen I-03A snapshot: a
// non-blank reference and a non-empty, duplicate-free set of human principals.
function resolvedAudience(value: unknown): SharedHumanAudienceSnapshot | undefined {
  if (!isRecord(value) || !hasExactKeys(value, AUDIENCE_RESOLVED_KEYS) || value.state !== 'RESOLVED') return undefined;
  const snapshot = value.snapshot;
  if (!isRecord(snapshot) || !hasExactKeys(snapshot, AUDIENCE_SNAPSHOT_KEYS)) return undefined;
  const { snapshotRef, humans } = snapshot;
  if (!isNonBlankString(snapshotRef) || !Array.isArray(humans) || humans.length === 0 || !humans.every(isHumanPrincipal)) return undefined;
  if (new Set(humans.map((human) => human.humanId)).size !== humans.length) return undefined;
  // Rebuilt from the two validated members rather than passed through, so the
  // snapshot handed to the frozen I-03A evaluator carries exactly its contract.
  return Object.freeze({ snapshotRef, humans } as SharedHumanAudienceSnapshot);
}

// The source-state contract is server-owned, and its answer is still validated
// positively: an AVAILABLE branch must carry exactly a canonical digest and
// nothing else, and the two known-absence branches carry exactly their state.
// Anything else - an unknown property, a missing digest, a smuggled content
// field, a malformed union member - is not safely knowable.
function sourceStateVerdict(value: unknown, expectedDigest: string): ItemVerdict {
  if (!isRecord(value)) return { kind: 'UNRESOLVED', reason: 'PRIVATE_SOURCE_STATE_UNRESOLVED' };
  if (value.state === 'AVAILABLE') {
    if (!hasExactKeys(value, SOURCE_AVAILABLE_KEYS)) return { kind: 'UNRESOLVED', reason: 'PRIVATE_SOURCE_STATE_UNRESOLVED' };
    if (typeof value.contentDigest !== 'string' || !CONTENT_DIGEST.test(value.contentDigest)) return { kind: 'UNRESOLVED', reason: 'PRIVATE_SOURCE_STATE_UNRESOLVED' };
    // Content that changed after generation is a different source version: the
    // old output was produced from bytes that no longer exist (CW2-02 §54).
    return value.contentDigest === expectedDigest ? OK : { kind: 'STALE', reason: 'PRIVATE_SOURCE_CHANGED_OR_UNAVAILABLE' };
  }
  if ((value.state === 'DELETED_BY_OWNER' || value.state === 'UNAVAILABLE') && hasExactKeys(value, ['state'])) {
    return { kind: 'STALE', reason: 'PRIVATE_SOURCE_CHANGED_OR_UNAVAILABLE' };
  }
  return { kind: 'UNRESOLVED', reason: 'PRIVATE_SOURCE_STATE_UNRESOLVED' };
}

@Injectable()
export class SharedDeliveryAuthorityRevalidatorService {
  constructor(
    private readonly worldState: SharedPreModelWorldStateResolverService,
    private readonly audience: SharedHumanAudienceResolverService,
    private readonly grants: StandingContextGrantResolverService,
    @Inject(SHARED_PRIVATE_SOURCE_STATE_RESOLVER) private readonly sources: SharedPrivateSourceStateResolver,
  ) {}

  /**
   * Revalidates one exact previously generated Shared output against the exact
   * EffectiveContext that produced it. Returns - never throws - a frozen
   * `SharedDeliveryAuthorityRevalidation`. No user token, client audience,
   * client grant claim, client availability claim, disclosure parameter or
   * safety verdict exists in the signature; the result carries no per-owner
   * authority detail, no source identity, no raw upstream error and no output.
   */
  async revalidate(effectiveContext: SharedEffectiveContext, outputText: string): Promise<SharedDeliveryAuthorityRevalidation> {
    // Structure first, then the fingerprint: a caller that mutated the source,
    // the content digest, an authority binding, the audience reference, the
    // World-state reference or the item order while keeping the old
    // `effectiveContextRef` is refused here, before any state is consulted.
    if (typeof outputText !== 'string') return unresolved('MALFORMED_EFFECTIVE_CONTEXT');
    const envelope = validateEffectiveContext(effectiveContext);
    if (envelope === 'MALFORMED') return unresolved('MALFORMED_EFFECTIVE_CONTEXT');
    const recomputed = fingerprintSharedEffectiveContext({
      worldId: envelope.targetWorldId,
      worldStateSnapshotRef: envelope.worldStateSnapshotRef,
      audienceSnapshotRef: envelope.audienceSnapshotRef,
      items: envelope.items.map((item) => ({
        ownerHumanId: item.ownerHumanId,
        contextId: item.contextId,
        contentDigest: item.contentDigest,
        grantId: item.grantId,
        authoritySnapshotRef: item.authoritySnapshotRef,
      })),
    });
    if (recomputed !== envelope.effectiveContextRef) return unresolved('MALFORMED_EFFECTIVE_CONTEXT');

    const outputDigest = digestProviderOutput(outputText);

    // Current World state. A closed World is known canonical state; a changed
    // World-state snapshot - including ACTIVE / INTRODUCTION becoming ACTIVE /
    // STANDARD - is a phase change the old generation was not authorized under
    // (CW2-03 §48). Neither silently delivers.
    let worldState: unknown;
    try {
      worldState = await this.worldState.resolveCurrent(envelope.targetWorldId);
    } catch {
      return unresolved('WORLD_STATE_UNRESOLVED');
    }
    const currentWorld = resolvedWorldState(worldState, envelope.targetWorldId);
    if (currentWorld === undefined) return unresolved('WORLD_STATE_UNRESOLVED');
    if (currentWorld.lifecycle === 'READ_ONLY_CLOSED') return stale('WORLD_READ_ONLY_CLOSED');
    if (currentWorld.snapshotRef !== envelope.worldStateSnapshotRef) return stale('WORLD_STATE_CHANGED');

    // The exact current Audience Snapshot. There is no "close enough": no
    // subset or superset grandfathering, and a leave followed by a rejoin
    // changes the snapshot even when the same humans are present again,
    // because membership episode identity changed (CW2-02 §48, B34).
    let audience: unknown;
    try {
      audience = await this.audience.resolveCurrent(envelope.targetWorldId);
    } catch {
      return unresolved('AUDIENCE_UNRESOLVED');
    }
    if (isEmptyAudience(audience)) return stale('NO_ACTIVE_HUMANS');
    const currentAudience = resolvedAudience(audience);
    if (currentAudience === undefined) return unresolved('AUDIENCE_UNRESOLVED');
    if (currentAudience.snapshotRef !== envelope.audienceSnapshotRef) return stale('AUDIENCE_CHANGED');
    // The reference is a content fingerprint of exactly this membership state,
    // so an identical reference over a different human set is contradictory
    // canonical state, never a match.
    if (!sameIdList(canonicalHumanIds(currentAudience.humans), envelope.audienceHumanIds)) return unresolved('AUDIENCE_UNRESOLVED');

    // An envelope with zero admitted private dependencies is legitimate: World
    // and audience are still revalidated above, and NO grant and NO source
    // lookup happens below.
    if (envelope.items.length === 0) {
      return this.current(envelope, outputDigest, currentWorld.snapshotRef, currentAudience.snapshotRef);
    }

    // One current grant resolution per unique owner, and one current source
    // state per exact `(owner, contextId)` identity. Both sets are deduplicated
    // BEFORE any lookup: no duplicate network call per item, no union across
    // owners, and one owner's resolution never covers another's.
    const owners = [...new Set(envelope.items.map((item) => item.ownerHumanId))];
    const grants = new Map<string, StandingContextGrantResolution>();
    await Promise.all(owners.map(async (ownerHumanId) => {
      let resolution: StandingContextGrantResolution;
      try {
        resolution = await this.grants.resolveCurrent(envelope.targetWorldId, Object.freeze({ kind: 'HUMAN', humanId: ownerHumanId } as const));
      } catch {
        resolution = GRANT_RESOLUTION_FAILED;
      }
      grants.set(ownerHumanId, resolution);
    }));

    const uniqueSources = new Map<string, PrivateSourceContextRef>();
    for (const item of envelope.items) uniqueSources.set(sourceIdentity(item.ownerHumanId, item.contextId), item.source);
    const sourceStates = new Map<string, unknown>();
    await Promise.all([...uniqueSources].map(async ([identity, source]) => {
      let resolution: unknown;
      try {
        resolution = await this.sources.resolveCurrent(source);
      } catch {
        resolution = SOURCE_RESOLUTION_FAILED;
      }
      sourceStates.set(identity, resolution);
    }));

    // Re-evaluate EVERY admitted dependency through the frozen I-03A law,
    // against the SAME current audience snapshot and its owner's ONE current
    // grant resolution. No independent permission logic exists here.
    const verdicts = envelope.items.map((item) => this.verdictFor(item, envelope, currentAudience, grants, sourceStates));
    // Known staleness outranks uncertainty (task §39): both block delivery, but
    // only STALE tells the caller that regenerating under current authority
    // will help. Within a class the first admitted item decides the reason, and
    // no reason ever identifies which owner, source or grant it came from.
    const staleVerdict = verdicts.find((verdict) => verdict.kind === 'STALE');
    if (staleVerdict !== undefined && staleVerdict.kind === 'STALE') return stale(staleVerdict.reason);
    const unresolvedVerdict = verdicts.find((verdict) => verdict.kind === 'UNRESOLVED');
    if (unresolvedVerdict !== undefined && unresolvedVerdict.kind === 'UNRESOLVED') return unresolved(unresolvedVerdict.reason);

    return this.current(envelope, outputDigest, currentWorld.snapshotRef, currentAudience.snapshotRef);
  }

  /**
   * One admitted dependency, re-evaluated. A revoked, absent or otherwise
   * denied authority makes the old output STALE; an unknown authority or an
   * unknown source state makes revalidation UNRESOLVED - it may NOT simply drop
   * the dependency, because the output already depended on it (task §25).
   */
  private verdictFor(
    item: ValidatedItem,
    envelope: ValidatedEnvelope,
    currentAudience: SharedHumanAudienceSnapshot,
    grants: ReadonlyMap<string, StandingContextGrantResolution>,
    sourceStates: ReadonlyMap<string, unknown>,
  ): ItemVerdict {
    const request: StandingContextAuthorityRequest = Object.freeze({
      action: STANDING_CONTEXT_ACTION,
      grantor: Object.freeze({ kind: 'HUMAN', humanId: item.ownerHumanId } as const),
      targetWorldId: envelope.targetWorldId,
      purpose: STANDING_CONTEXT_PURPOSE,
      audienceSnapshot: currentAudience,
    });
    const decision = evaluateStandingContextAuthority(request, grants.get(item.ownerHumanId) ?? GRANT_RESOLUTION_FAILED);
    // DENY is a positive canonical statement that the use is no longer
    // authorized - revoked, absent, or beyond the current ceiling. UNKNOWN is
    // uncertainty. The internal reason class stays inside I-03A either way.
    if (decision.decision === 'DENY') return { kind: 'STALE', reason: 'PRIVATE_AUTHORITY_CHANGED' };
    if (decision.decision !== 'ALLOW') return { kind: 'UNRESOLVED', reason: 'PRIVATE_AUTHORITY_UNRESOLVED' };
    // ALLOW is not enough: a reconfirmed or re-issued grant is a NEW authority
    // basis, not a retroactive blessing of an old generation (CW2-02 §8, §51;
    // CW2-03 §40). Any binding drift means regenerate, never grandfather.
    const binding = decision.binding;
    if (binding.grantId !== item.grantId) return { kind: 'STALE', reason: 'PRIVATE_AUTHORITY_CHANGED' };
    if (binding.authoritySnapshotRef !== item.authoritySnapshotRef) return { kind: 'STALE', reason: 'PRIVATE_AUTHORITY_CHANGED' };
    if (binding.audienceSnapshotRef !== envelope.audienceSnapshotRef) return { kind: 'STALE', reason: 'PRIVATE_AUTHORITY_CHANGED' };
    if (binding.targetWorldId !== envelope.targetWorldId) return { kind: 'STALE', reason: 'PRIVATE_AUTHORITY_CHANGED' };
    if (binding.grantorHumanId !== item.ownerHumanId) return { kind: 'STALE', reason: 'PRIVATE_AUTHORITY_CHANGED' };
    if (binding.action !== STANDING_CONTEXT_ACTION || binding.purpose !== STANDING_CONTEXT_PURPOSE) return { kind: 'STALE', reason: 'PRIVATE_AUTHORITY_CHANGED' };
    if (!sameIdList(binding.audienceHumanIds, envelope.audienceHumanIds)) return { kind: 'STALE', reason: 'PRIVATE_AUTHORITY_CHANGED' };

    return sourceStateVerdict(sourceStates.get(sourceIdentity(item.ownerHumanId, item.contextId)), item.contentDigest);
  }

  /**
   * The successful result. It says exactly one thing - that authority is
   * current for this one exact operation - and structurally refuses to say
   * that the output is disclosure-safe, policy-safe or deliverable.
   */
  private current(envelope: ValidatedEnvelope, outputDigest: string, worldStateSnapshotRef: string, audienceSnapshotRef: string): SharedDeliveryAuthorityRevalidation {
    const revalidation: SharedDeliveryAuthorityCurrent = Object.freeze({
      revalidationRef: fingerprintSharedDeliveryAuthorityRevalidation({
        effectiveContextRef: envelope.effectiveContextRef,
        outputDigest,
        worldId: envelope.targetWorldId,
        worldStateSnapshotRef,
        audienceSnapshotRef,
        items: envelope.items.map((item) => ({
          ownerHumanId: item.ownerHumanId,
          contextId: item.contextId,
          contentDigest: item.contentDigest,
          grantId: item.grantId,
          authoritySnapshotRef: item.authoritySnapshotRef,
        })),
      }),
      effectiveContextRef: envelope.effectiveContextRef,
      outputDigest,
      targetWorldId: envelope.targetWorldId,
      worldStateSnapshotRef,
      audienceSnapshotRef,
      authorityStatus: 'CURRENT',
      sourceDisclosureAuthority: 'NOT_EVALUATED',
      systemSafetyAuthority: 'NOT_EVALUATED',
      deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY',
      directPrivateDisclosureAuthority: 'NOT_GRANTED',
      materialDisclosureAuthority: 'NOT_GRANTED',
      provenanceDisclosure: 'SEALED',
    } as const);
    return Object.freeze({ state: 'CURRENT', revalidation } as const);
  }
}
