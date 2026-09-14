// I-03G - the Shared Source Disclosure Gate: the first gate of the frozen
// CW2-02 §22 delivery sequence, over the I-03E reasoning-only private-context
// lane.
//
// Every item an I-03E EffectiveContext admits carries the frozen I-03A ALLOW
// constraints - `PRIVATE_REASONING_ONLY_CONTEXT`, direct private disclosure
// NOT_GRANTED, material disclosure NOT_GRANTED, provenance SEALED. Reasoning
// authority is not disclosure authority (CW2-02 §19, B15), so in this lane there
// is no such thing as an acceptable direct disclosure: any positively detected
// protected-source disclosure blocks the old output outright.
//
// The gate order (task §16, §19):
//
//   validate the supplied generation artifact structurally
//     -> recompute every frozen digest and the frozen I-03E fingerprint
//     -> compute the exact output identity      (frozen I-03F digestProviderOutput)
//     -> compute the exact protected source set identity
//     -> zero private reasoning contexts -> CLEAR, detector NOT invoked
//     -> otherwise invoke the server-owned detector ONCE for the whole operation
//     -> validate the assessment and its binding
//     -> CLEAR / DETECTED / UNRESOLVED mapped to CLEAR / BLOCKED / UNRESOLVED
//
// What this gate is NOT, and why that is the point:
//
//   - it is NOT a detector. CW2-02 §58 defers the exact implementation of
//     direct-source disclosure detection, so there is no exact-match rule,
//     n-gram window, regular expression, substring search, string or edit
//     distance, similarity or confidence threshold, embedding, vector index,
//     LLM-as-judge prompt, model selection, redaction or rewrite strategy here.
//     The provider output is hashed, placed into the request, and otherwise
//     never indexed, sliced, searched, compared, classified or logged;
//   - it does NOT trust a client or a provider. There is no `sourceDisclosureSafe`
//     input, no provider self-declaration, no client-supplied verdict, no user
//     token and no credential in this file. The only assessment that can clear
//     anything comes from the server-owned contract, and only when its binding
//     is exactly this operation's (CW2-02 §7, B6);
//   - it does NOT block merely because private context exists. A non-empty
//     protected source set with an exactly bound CLEAR assessment clears, which
//     is what keeps higher-level advice influenced by private context useful
//     without a per-inference consent prompt (CW2-02 §20, B16);
//   - it grants NOTHING. A clearance restates the frozen no-disclosure positions
//     unchanged and says `deliveryCommitAuthority = NOT_GRANTED_BY_THIS_BOUNDARY`;
//   - it retrieves, reads, persists, commits and mutates NOTHING - no Personal
//     table, no Shared message, no provenance record, no audit row, no outbox
//     event. It re-reads no deleted source: the protected content it inspects is
//     the generation-time artifact the server already holds (task §10), and
//     I-03F separately marks the old output stale when that source is gone.
//
// The structural validation below duplicates the shape I-03F also refuses. That
// is deliberate: I-03F's validator is module-private and its file is frozen, and
// a gate that ran before a malformed envelope was ever refused would be inviting
// exactly the tampering it exists to stop. Each boundary fails closed on its own.

import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { classifyWorldCandidate, isHumanPrincipal } from '../kernel/world-invariants';
import type { HumanPrincipal } from '../kernel/principal.types';
import type { SharedWorldId } from '../kernel/world.types';
import { STANDING_CONTEXT_ACTION, STANDING_CONTEXT_PURPOSE } from '../authority/standing-context-authority.types';
import type { StandingContextAllowConstraints } from '../authority/standing-context-authority.types';
import { digestReasoningContent, fingerprintSharedEffectiveContext } from '../effective-context/shared-effective-context.service';
import type { PrivateSourceContextRef, SharedEffectiveContext } from '../effective-context/shared-effective-context.types';
import { digestProviderOutput } from '../delivery-authority/shared-delivery-authority-revalidator.service';
import { SHARED_SOURCE_DISCLOSURE_DETECTOR, SHARED_SOURCE_DISCLOSURE_FINDING_CATEGORIES } from './shared-source-disclosure-detector.types';
import type {
  SharedProtectedSource,
  SharedSourceDisclosureAssessmentBinding,
  SharedSourceDisclosureDetectionRequest,
  SharedSourceDisclosureDetector,
} from './shared-source-disclosure-detector.types';
import { SHARED_SOURCE_DISCLOSURE_BLOCK_REASON } from './shared-source-disclosure.types';
import type {
  SharedSourceDisclosureClearance,
  SharedSourceDisclosureGateResult,
  SharedSourceDisclosureUnresolvedReason,
} from './shared-source-disclosure.types';

export const SHARED_PROTECTED_SOURCE_SET_VERSION = 'QANDEEL_CWV2_SHARED_PROTECTED_SOURCE_SET_V1' as const;
export const SHARED_SOURCE_DISCLOSURE_GATE_VERSION = 'QANDEEL_CWV2_SHARED_SOURCE_DISCLOSURE_GATE_V1' as const;

// Exact property sets. An envelope, item, source, authority decision, binding,
// constraint set or detector assessment carrying ANY other property - a
// permission claim, a disclosure flag, a safety verdict, a second content field,
// a client-supplied clearance - is malformed rather than silently tolerated.
const EFFECTIVE_CONTEXT_KEYS = ['effectiveContextRef', 'targetWorldId', 'worldStateSnapshotRef', 'audienceSnapshot', 'privateReasoningContexts'] as const;
const AUDIENCE_SNAPSHOT_KEYS = ['snapshotRef', 'humans'] as const;
const HUMAN_KEYS = ['kind', 'humanId'] as const;
const ITEM_KEYS = ['kind', 'source', 'reasoningContent', 'contentDigest', 'authority'] as const;
const SOURCE_KEYS = ['contextId', 'originWorld'] as const;
const ORIGIN_WORLD_KEYS = ['architectureClass', 'worldType', 'owner'] as const;
const ALLOW_KEYS = ['decision', 'externalEffect', 'constraints', 'binding'] as const;
const CONSTRAINT_KEYS = ['contextClassification', 'reasoningAuthority', 'directPrivateDisclosureAuthority', 'materialDisclosureAuthority', 'provenanceDisclosure', 'deliveryAuthority'] as const;
const BINDING_KEYS = ['action', 'grantorHumanId', 'targetWorldId', 'purpose', 'audienceHumanIds', 'grantId', 'authoritySnapshotRef', 'audienceSnapshotRef'] as const;
const ASSESSMENT_CLEAR_KEYS = ['state', 'assessmentRef', 'detectorPolicyRef', 'binding'] as const;
const ASSESSMENT_DETECTED_KEYS = [...ASSESSMENT_CLEAR_KEYS, 'findings'] as const;
const ASSESSMENT_BINDING_KEYS = ['effectiveContextRef', 'outputDigest', 'protectedSourceSetRef'] as const;

/** The frozen I-03E / I-03A digest form. Nothing else is a content identity. */
const CONTENT_DIGEST = /^sha256:[0-9a-f]{64}$/u;

/**
 * The ONLY constraint set an admitted item may carry: the frozen I-03A ALLOW
 * constant. An envelope whose constraints were widened, narrowed or re-spelled
 * is malformed, and no gate can repair it.
 */
const EXPECTED_ALLOW_CONSTRAINTS: StandingContextAllowConstraints = Object.freeze({
  contextClassification: 'PRIVATE_REASONING_ONLY_CONTEXT',
  reasoningAuthority: 'ALLOW',
  directPrivateDisclosureAuthority: 'NOT_GRANTED',
  materialDisclosureAuthority: 'NOT_GRANTED',
  provenanceDisclosure: 'SEALED',
  deliveryAuthority: 'REQUIRES_REVALIDATION',
} as const);

/** One protected private dependency of the exact operation, as the artifact validated it. */
interface ValidatedItem {
  readonly ownerHumanId: string;
  readonly contextId: string;
  readonly contentDigest: string;
  readonly grantId: string;
  readonly authoritySnapshotRef: string;
  /** The exact generation-time bytes, preserved for the detector request and nothing else. */
  readonly reasoningContent: string;
  readonly source: PrivateSourceContextRef;
}

interface ValidatedArtifact {
  readonly targetWorldId: SharedWorldId;
  readonly effectiveContextRef: string;
  readonly worldStateSnapshotRef: string;
  readonly audienceSnapshotRef: string;
  readonly items: ReadonlyArray<ValidatedItem>;
}

/** What a returned assessment established, reduced to the only three outcomes the gate maps. */
type AssessmentVerdict =
  | { readonly kind: 'CLEAR'; readonly assessmentRef: string; readonly detectorPolicyRef: string }
  | { readonly kind: 'DETECTED' }
  | { readonly kind: 'UNRESOLVED'; readonly reason: SharedSourceDisclosureUnresolvedReason };

const DETECTOR_UNRESOLVED: AssessmentVerdict = Object.freeze({ kind: 'UNRESOLVED', reason: 'DETECTOR_UNRESOLVED' } as const);
const BINDING_MISMATCH: AssessmentVerdict = Object.freeze({ kind: 'UNRESOLVED', reason: 'DETECTOR_BINDING_MISMATCH' } as const);

function blocked(): SharedSourceDisclosureGateResult {
  return Object.freeze({ state: 'BLOCKED', reason: SHARED_SOURCE_DISCLOSURE_BLOCK_REASON } as const);
}

function unresolved(reason: SharedSourceDisclosureUnresolvedReason): SharedSourceDisclosureGateResult {
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
// judges it: a World-taxonomy or non-World name (PUBLIC_WORLD, MATCHING, REPLAY,
// INTRODUCTION, ...) is never a World identity.
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
 * The deterministic protected source set fingerprint (task §14). It binds the
 * envelope identity and, in exact I-03E admitted order, each protected source's
 * ordinal, owner, context id and content digest.
 *
 * It contains no raw private content, no raw output, no clock, no random
 * identity and no secret, and it is not a bearer permission. Exported so tests
 * can prove determinism and every required sensitivity against the canonical
 * content.
 */
export function fingerprintSharedProtectedSourceSet(facts: {
  readonly effectiveContextRef: string;
  readonly items: ReadonlyArray<{
    readonly ownerHumanId: string;
    readonly contextId: string;
    readonly contentDigest: string;
  }>;
}): string {
  const lines = [
    SHARED_PROTECTED_SOURCE_SET_VERSION,
    `effectiveContext=${facts.effectiveContextRef}`,
    `sources=${facts.items.length}`,
    // Each line is an unambiguous JSON array, so an owner id or context id
    // containing a separator can never collide with another source.
    ...facts.items.map((item, ordinal) => JSON.stringify([ordinal, item.ownerHumanId, item.contextId, item.contentDigest])),
  ];
  return `sha256:${createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')}`;
}

/**
 * The deterministic gate fingerprint (task §24). It binds the envelope identity,
 * the exact output identity, the protected source set identity, the basis and -
 * when a detector was actually consulted - the exact assessment and policy it
 * rested on, so a clearance can never be re-read as covering a different output,
 * a different source set or a different detector policy.
 */
export function fingerprintSharedSourceDisclosureGate(facts: {
  readonly effectiveContextRef: string;
  readonly outputDigest: string;
  readonly protectedSourceSetRef: string;
  readonly basis: string;
  readonly detectorAssessmentRef?: string;
  readonly detectorPolicyRef?: string;
}): string {
  const lines = [
    SHARED_SOURCE_DISCLOSURE_GATE_VERSION,
    `effectiveContext=${facts.effectiveContextRef}`,
    `output=${facts.outputDigest}`,
    `protectedSources=${facts.protectedSourceSetRef}`,
    `basis=${facts.basis}`,
    JSON.stringify([facts.detectorAssessmentRef ?? null, facts.detectorPolicyRef ?? null]),
  ];
  return `sha256:${createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')}`;
}

/**
 * Structural validation of the supplied generation artifact (task §16).
 *
 * The envelope is UNTRUSTED runtime data, never trusted because TypeScript says
 * so: it may have crossed a queue, a retry, a process boundary or a caller that
 * mutated it. The WHOLE artifact fails closed on the first malformed or
 * contradictory fact, and every check here runs BEFORE the detector is
 * constructed or invoked, so a malformed artifact never reaches it.
 *
 * Beyond the I-03F shape checks this also recomputes each item's content digest
 * from its exact reasoning bytes, because those exact bytes are what the
 * detector will be asked to judge: an item whose digest does not describe its own
 * content would let a caller bind one operation identity to different content.
 */
function validateGenerationArtifact(envelope: unknown): ValidatedArtifact | 'MALFORMED' {
  if (!isRecord(envelope) || !hasExactKeys(envelope, EFFECTIVE_CONTEXT_KEYS)) return 'MALFORMED';
  const { effectiveContextRef, targetWorldId, worldStateSnapshotRef, audienceSnapshot, privateReasoningContexts } = envelope;
  if (!isNonBlankString(effectiveContextRef) || !isNonBlankString(worldStateSnapshotRef)) return 'MALFORMED';
  if (!isSharedWorldIdentity(targetWorldId)) return 'MALFORMED';

  // The generation audience: exactly the frozen I-03D RESOLVED snapshot shape,
  // non-empty and duplicate-free. Duplicate state is never normalized away.
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
    // The digest must describe THIS content, recomputed with the frozen I-03E
    // helper rather than believed.
    if (digestReasoningContent(item.reasoningContent) !== item.contentDigest) return 'MALFORMED';

    // The source: an exact MY_WORLD human source context, never a Shared, Public
    // or Matching origin and never a material reference.
    const source = item.source;
    if (!isRecord(source) || !hasExactKeys(source, SOURCE_KEYS) || !isNonBlankString(source.contextId)) return 'MALFORMED';
    const originWorld = source.originWorld;
    if (!isRecord(originWorld) || !hasExactKeys(originWorld, ORIGIN_WORLD_KEYS)) return 'MALFORMED';
    if (originWorld.architectureClass !== 'WORLD' || originWorld.worldType !== 'MY_WORLD') return 'MALFORMED';
    const owner = originWorld.owner;
    if (!isRecord(owner) || !hasExactKeys(owner, HUMAN_KEYS) || !isHumanPrincipal(owner)) return 'MALFORMED';

    // The authority: exactly the frozen I-03A ALLOW decision, with its exact
    // constraint literals. A DENY, an UNKNOWN or a widened constraint set is not
    // an admitted reasoning-only dependency.
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

    // One owner carries ONE authority binding inside one envelope.
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
      reasoningContent: item.reasoningContent,
      source: Object.freeze({
        contextId: source.contextId,
        originWorld: Object.freeze({ architectureClass: 'WORLD', worldType: 'MY_WORLD', owner: Object.freeze({ kind: 'HUMAN', humanId: owner.humanId } as const) } as const),
      }),
    });
  }
  return { targetWorldId, effectiveContextRef, worldStateSnapshotRef, audienceSnapshotRef, items: Object.freeze(items) };
}

/** Findings are category names only: non-empty, duplicate-free, and each exactly one of the four frozen classes. */
function areValidFindings(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  const findings = value as ReadonlyArray<unknown>;
  if (!findings.every((finding) => (SHARED_SOURCE_DISCLOSURE_FINDING_CATEGORIES as ReadonlyArray<unknown>).includes(finding))) return false;
  return new Set(findings).size === findings.length;
}

/**
 * Validates a returned assessment against the request it was supposed to answer
 * (task §12, §13, §25).
 *
 * A malformed assessment - an unknown state, a missing or blank reference, an
 * unknown property, findings that are not the frozen categories - is uncertainty,
 * never a clearance and never a block. An assessment whose binding names a
 * different operation is not weak evidence either: it belongs to another output,
 * so it says nothing at all about this one.
 */
function assessmentVerdict(value: unknown, expected: SharedSourceDisclosureAssessmentBinding): AssessmentVerdict {
  if (!isRecord(value)) return DETECTOR_UNRESOLVED;
  if (value.state !== 'CLEAR' && value.state !== 'DETECTED') return DETECTOR_UNRESOLVED;
  const detected = value.state === 'DETECTED';
  if (!hasExactKeys(value, detected ? ASSESSMENT_DETECTED_KEYS : ASSESSMENT_CLEAR_KEYS)) return DETECTOR_UNRESOLVED;
  if (!isNonBlankString(value.assessmentRef) || !isNonBlankString(value.detectorPolicyRef)) return DETECTOR_UNRESOLVED;
  if (detected && !areValidFindings(value.findings)) return DETECTOR_UNRESOLVED;
  const binding = value.binding;
  if (!isRecord(binding) || !hasExactKeys(binding, ASSESSMENT_BINDING_KEYS)) return DETECTOR_UNRESOLVED;
  for (const key of ASSESSMENT_BINDING_KEYS) {
    if (binding[key] !== expected[key]) return BINDING_MISMATCH;
  }
  // Which categories were found is never inspected to decide whether a detection
  // is "acceptable": no direct-disclosure permission exists in this lane.
  if (detected) return Object.freeze({ kind: 'DETECTED' } as const);
  return Object.freeze({ kind: 'CLEAR', assessmentRef: value.assessmentRef, detectorPolicyRef: value.detectorPolicyRef } as const);
}

@Injectable()
export class SharedSourceDisclosureGateService {
  constructor(@Inject(SHARED_SOURCE_DISCLOSURE_DETECTOR) private readonly detector: SharedSourceDisclosureDetector) {}

  /**
   * Runs the Source Disclosure Gate over one exact previously generated Shared
   * output and the exact EffectiveContext that produced it. Returns - never
   * throws - a frozen `SharedSourceDisclosureGateResult`. No user token, client
   * audience, client clearance claim, provider self-declaration or safety verdict
   * exists in the signature; the result carries no finding category, owner,
   * source identity, private content, provider output, detector error or consent
   * state.
   */
  async evaluate(effectiveContext: SharedEffectiveContext, outputText: string): Promise<SharedSourceDisclosureGateResult> {
    // Structure first, then the fingerprint: a caller that mutated the source,
    // the content, an authority binding, the audience or the item order while
    // keeping the old `effectiveContextRef` is refused here, before the detector
    // is told anything at all.
    if (typeof outputText !== 'string') return unresolved('MALFORMED_GENERATION_ARTIFACT');
    const artifact = validateGenerationArtifact(effectiveContext);
    if (artifact === 'MALFORMED') return unresolved('MALFORMED_GENERATION_ARTIFACT');
    const recomputed = fingerprintSharedEffectiveContext({
      worldId: artifact.targetWorldId,
      worldStateSnapshotRef: artifact.worldStateSnapshotRef,
      audienceSnapshotRef: artifact.audienceSnapshotRef,
      items: artifact.items.map((item) => ({
        ownerHumanId: item.ownerHumanId,
        contextId: item.contextId,
        contentDigest: item.contentDigest,
        grantId: item.grantId,
        authoritySnapshotRef: item.authoritySnapshotRef,
      })),
    });
    if (recomputed !== artifact.effectiveContextRef) return unresolved('MALFORMED_GENERATION_ARTIFACT');

    // The frozen I-03F output identity, reused rather than re-invented, so the
    // two boundaries of this lane can only ever agree about which bytes they
    // judged.
    const outputDigest = digestProviderOutput(outputText);
    const protectedSourceSetRef = fingerprintSharedProtectedSourceSet({
      effectiveContextRef: artifact.effectiveContextRef,
      items: artifact.items.map((item) => ({ ownerHumanId: item.ownerHumanId, contextId: item.contextId, contentDigest: item.contentDigest })),
    });

    // Zero admitted private reasoning contexts: there is no protected private
    // source set for THIS gate to protect, so the detector is not invoked. This
    // asserts nothing about System / Safety, Shared material visibility or
    // delivery (task §18).
    if (artifact.items.length === 0) {
      return this.clear(Object.freeze({
        gateRef: fingerprintSharedSourceDisclosureGate({ effectiveContextRef: artifact.effectiveContextRef, outputDigest, protectedSourceSetRef, basis: 'NO_PROTECTED_PRIVATE_CONTEXT' }),
        effectiveContextRef: artifact.effectiveContextRef,
        outputDigest,
        protectedSourceSetRef,
        basis: 'NO_PROTECTED_PRIVATE_CONTEXT',
        sourceDisclosureStatus: 'NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED',
        directPrivateDisclosureAuthority: 'NOT_GRANTED',
        materialDisclosureAuthority: 'NOT_GRANTED',
        provenanceDisclosure: 'SEALED',
        deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY',
      } as const));
    }

    // ONE invocation for the whole operation: the detector judges the exact
    // output against the exact protected source set, never one source at a time.
    const binding: SharedSourceDisclosureAssessmentBinding = Object.freeze({ effectiveContextRef: artifact.effectiveContextRef, outputDigest, protectedSourceSetRef } as const);
    const protectedSources: ReadonlyArray<SharedProtectedSource> = Object.freeze(artifact.items.map((item) => Object.freeze({
      source: item.source,
      reasoningContent: item.reasoningContent,
      contentDigest: item.contentDigest,
    } as const)));
    const request: SharedSourceDisclosureDetectionRequest = Object.freeze({
      effectiveContextRef: artifact.effectiveContextRef,
      outputDigest,
      outputText,
      protectedSourceSetRef,
      protectedSources,
    } as const);

    let assessment: unknown;
    try {
      assessment = await this.detector.assess(request);
    } catch {
      // A throwing, timing-out or otherwise failing detector is uncertainty. The
      // exception is discarded here rather than wrapped: it may carry protected
      // content, and it is never CLEAR (task §25).
      return unresolved('DETECTOR_UNRESOLVED');
    }
    const verdict = assessmentVerdict(assessment, binding);
    if (verdict.kind === 'UNRESOLVED') return unresolved(verdict.reason);
    if (verdict.kind === 'DETECTED') return blocked();

    return this.clear(Object.freeze({
      gateRef: fingerprintSharedSourceDisclosureGate({
        effectiveContextRef: artifact.effectiveContextRef,
        outputDigest,
        protectedSourceSetRef,
        basis: 'SERVER_DETECTOR_CLEAR',
        detectorAssessmentRef: verdict.assessmentRef,
        detectorPolicyRef: verdict.detectorPolicyRef,
      }),
      effectiveContextRef: artifact.effectiveContextRef,
      outputDigest,
      protectedSourceSetRef,
      basis: 'SERVER_DETECTOR_CLEAR',
      detectorAssessmentRef: verdict.assessmentRef,
      detectorPolicyRef: verdict.detectorPolicyRef,
      sourceDisclosureStatus: 'NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED',
      directPrivateDisclosureAuthority: 'NOT_GRANTED',
      materialDisclosureAuthority: 'NOT_GRANTED',
      provenanceDisclosure: 'SEALED',
      deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY',
    } as const));
  }

  /** A clearance says exactly one thing, and structurally refuses to say the output is safe, policy-clear or deliverable. */
  private clear(gate: SharedSourceDisclosureClearance): SharedSourceDisclosureGateResult {
    return Object.freeze({ state: 'CLEAR', gate } as const);
  }
}
