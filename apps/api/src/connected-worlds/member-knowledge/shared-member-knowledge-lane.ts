// S8A-04 CP3 — the authorized-disclosure lane, composed per request from the frozen I-03 classes (amendment §3; the claim
// path of R4 / §11, the Product Owner's CP3-D V2 Final Implementation Contract of 2026-10-26).
//
// Nothing frozen is edited. Every frozen class is constructed here with request-scoped collaborators that answer ONLY
// for the consented items this request collected:
//
//   * the grant resolver answers I-03E / I-03F with the owner's ONE item reasoning grant (0176), or NOT_FOUND — never the
//     general Standing Context Grant (0076), which no Shared path composes (amendment R-2);
//   * the source-state resolver answers I-03F with the item's current digest (0176), digest only;
//   * BEFORE generation the Disclosure Authorization (DA) and the request's claim table (`shared-claim-spans.ts`): a ref
//     only for an item the DA covers and whose owner this audience can name unambiguously (0178);
//   * AFTER generation the spans are parsed and the owners' Names written by the server; the frozen I-03G gate then runs on
//     the RENDERED text over a detector that asks the checker ONCE per reply and maps the server's decision (R4-2 step 5).
//     The frozen gate keeps every structural check, every fingerprint and its binding check.
//
// The lane's result is never the frozen gate's CLEAR when something was stated: it is AUTHORIZED_DISCLOSURE, which the
// readiness below accepts only after I-03F (unchanged) AND the disclosure revalidation both say CURRENT for the same
// operation and the same rendered text. Every failure is a withheld reply. Nothing here logs, persists or returns private
// content.

import { createHash } from 'node:crypto';
import { runWithAiUsageAttribution, type AiUsageAttribution } from '../../ai-usage/ai-usage-attribution';
import type { SupabaseServiceRoleApiService } from '../../conversation/supabase-service-role-api.service';
import type { HumanPrincipal } from '../kernel/principal.types';
import type { SharedWorldId } from '../kernel/world.types';
import type { StandingContextGrantResolution } from '../authority/standing-context-authority.types';
import { fingerprintStandingContextAuthority, StandingContextGrantResolverService } from '../authority-resolution/standing-context-grant-resolver.service';
import { SharedHumanAudienceResolverService } from '../audience/shared-human-audience-resolver.service';
import { SharedDeliveryAuthorityRevalidatorService } from '../delivery-authority/shared-delivery-authority-revalidator.service';
import type { SharedDeliveryAuthorityRevalidation } from '../delivery-authority/shared-delivery-authority.types';
import type { SharedPrivateSourceStateResolution, SharedPrivateSourceStateResolver } from '../delivery-authority/shared-private-source-state-resolver.types';
import { SharedEffectiveContextService } from '../effective-context/shared-effective-context.service';
import { SharedPreModelWorldStateResolverService } from '../effective-context/shared-pre-model-world-state-resolver.service';
import type {
  PrivateSourceContextRef, SharedEffectiveContext, SharedPrivateContextCandidate,
} from '../effective-context/shared-effective-context.types';
import { fingerprintSharedPrivacyAuthorityDeliveryReadiness } from '../source-disclosure/shared-privacy-authority-delivery-readiness.service';
import type {
  SharedSourceDisclosureDetectionRequest, SharedSourceDisclosureDetector, SharedSourceDisclosureDetectorAssessment,
} from '../source-disclosure/shared-source-disclosure-detector.types';
import { fingerprintSharedProtectedSourceSet, SharedSourceDisclosureGateService } from '../source-disclosure/shared-source-disclosure-gate.service';
import {
  decideSharedClaims, parseSharedClaimSpans, prepareSharedClaimTable, renderSharedClaims, sharedClaimCheckerView,
  type SharedClaimAudienceMember, type SharedClaimDecision, type SharedClaimParse, type SharedClaimTable,
} from './shared-claim-spans';
import {
  SHARED_KNOWLEDGE_DISCLOSURE_SCOPE, SHARED_KNOWLEDGE_ITEM_RPC,
  type SharedAuthorizedDisclosureGate, type SharedDisclosureAuthorization, type SharedDisclosureAuthorizationItem,
  type SharedDisclosureCheckBinding, type SharedDisclosureCheckRequest, type SharedDisclosureJudge, type SharedDisclosureJudgePayer,
  type SharedMemberKnowledgeGateResult, type SharedMemberKnowledgeGateUnresolvedReason, type SharedMemberKnowledgeItem,
  type SharedMemberKnowledgeReadiness,
} from './shared-member-knowledge.types';

export const SHARED_KNOWLEDGE_ITEM_GRANT_SNAPSHOT_VERSION = 'QANDEEL_S8A04_SHARED_KNOWLEDGE_ITEM_GRANT_SNAPSHOT_V1' as const;
export const SHARED_DISCLOSURE_AUTHORIZATION_VERSION = 'QANDEEL_S8A04_SHARED_DISCLOSURE_AUTHORIZATION_V1' as const;
export const SHARED_DISCLOSED_SOURCE_SET_VERSION = 'QANDEEL_S8A04_SHARED_DISCLOSED_SOURCE_SET_V1' as const;
export const SHARED_AUTHORIZED_DISCLOSURE_GATE_VERSION = 'QANDEEL_S8A04_SHARED_AUTHORIZED_DISCLOSURE_GATE_V1' as const;
export const SHARED_DISCLOSURE_REVALIDATION_VERSION = 'QANDEEL_S8A04_SHARED_DISCLOSURE_REVALIDATION_V1' as const;
/** R4: the detector's assessment and policy references are those of the one claim check (V2). */
export const SHARED_CLAIM_ASSESSMENT_VERSION = 'QANDEEL_S8A04_SHARED_CLAIM_ASSESSMENT_V2' as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const CONTENT_DIGEST = /^sha256:[0-9a-f]{64}$/u;
const ITEM_ROW_KEYS = ['availability', 'current_content_digest', 'reasoning_grant_id', 'disclosure_grant_id', 'membership_episode_id',
  'grant_content_digest', 'ceiling_user_ids', 'grant_state', 'disclosure_status'] as const;
const CHECK_RESULT_KEYS = ['state', 'checkRef', 'policyRef', 'binding', 'answer'] as const;
const CHECK_BINDING_KEYS = ['effectiveContextRef', 'audienceSnapshotRef', 'disclosureAuthorizationRef', 'outputDigest'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNonBlankString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
function hasExactKeys(value: Record<string, unknown>, keys: ReadonlyArray<string>): boolean {
  const present = Object.keys(value);
  return present.length === keys.length && keys.every((key) => present.includes(key));
}
const byCodeUnit = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);
const sha256 = (lines: ReadonlyArray<string>) => `sha256:${createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex')}`;

// ---------------------------------------------------------------------------------------------------------------------
// The 0176 item row (`resolve_shared_knowledge_item_v1`): exactly its shape, or nothing.
// ---------------------------------------------------------------------------------------------------------------------

interface ItemRow {
  readonly availability: 'AVAILABLE' | 'DELETED_BY_OWNER' | 'UNAVAILABLE';
  readonly currentContentDigest: string | null;
  readonly reasoningGrantId: string | null;
  readonly disclosureGrantId: string | null;
  readonly membershipEpisodeId: string | null;
  readonly grantContentDigest: string | null;
  readonly ceilingUserIds: ReadonlyArray<string>;
  readonly grantState: string;
  readonly disclosureStatus: string | null;
}

const optionalUuid = (value: unknown): value is string | null => value === null || (typeof value === 'string' && UUID.test(value));

export function decodeSharedKnowledgeItemRow(rows: unknown): ItemRow | null {
  if (!Array.isArray(rows) || rows.length !== 1 || !isRecord(rows[0]) || !hasExactKeys(rows[0], ITEM_ROW_KEYS)) return null;
  const row = rows[0];
  if (row.availability !== 'AVAILABLE' && row.availability !== 'DELETED_BY_OWNER' && row.availability !== 'UNAVAILABLE') return null;
  if (row.current_content_digest !== null && (typeof row.current_content_digest !== 'string' || !CONTENT_DIGEST.test(row.current_content_digest))) return null;
  if (row.availability === 'AVAILABLE' && row.current_content_digest === null) return null;
  if (!optionalUuid(row.reasoning_grant_id) || !optionalUuid(row.disclosure_grant_id) || !optionalUuid(row.membership_episode_id)) return null;
  if (row.grant_content_digest !== null && typeof row.grant_content_digest !== 'string') return null;
  if (row.ceiling_user_ids !== null && (!Array.isArray(row.ceiling_user_ids) || !row.ceiling_user_ids.every((id) => typeof id === 'string' && UUID.test(id)))) return null;
  if (typeof row.grant_state !== 'string' || (row.disclosure_status !== null && typeof row.disclosure_status !== 'string')) return null;
  return Object.freeze({
    availability: row.availability,
    currentContentDigest: row.current_content_digest as string | null,
    reasoningGrantId: row.reasoning_grant_id,
    disclosureGrantId: row.disclosure_grant_id,
    membershipEpisodeId: row.membership_episode_id,
    grantContentDigest: row.grant_content_digest as string | null,
    ceilingUserIds: Object.freeze([...((row.ceiling_user_ids as string[] | null) ?? [])]),
    grantState: row.grant_state,
    disclosureStatus: row.disclosure_status as string | null,
  });
}

/** The same pair the collector returned, still the ACTIVE pair of this item now (any other pair is not this consent). */
function isSamePair(row: ItemRow, item: SharedMemberKnowledgeItem): boolean {
  return row.reasoningGrantId === item.reasoningGrantId && row.disclosureGrantId === item.disclosureGrantId
    && row.membershipEpisodeId === item.membershipEpisodeId && row.grantContentDigest === item.contentDigest;
}

async function readItem(server: SupabaseServiceRoleApiService, worldId: string, ownerUserId: string, memoryId: string): Promise<ItemRow | null> {
  return decodeSharedKnowledgeItemRow(await server.rpc<unknown>(SHARED_KNOWLEDGE_ITEM_RPC, {
    p_world_id: worldId, p_owner_user_id: ownerUserId, p_memory_id: memoryId,
  }));
}

// ---------------------------------------------------------------------------------------------------------------------
// The per-request collaborators of the frozen classes.
// ---------------------------------------------------------------------------------------------------------------------

/** The item grant snapshot reference: the frozen fingerprint's facts, plus the item, its pair and its episode. */
export function fingerprintSharedKnowledgeItemGrant(facts: {
  readonly state: 'FOUND' | 'NOT_FOUND'; readonly worldId: string; readonly grantorId: string; readonly memoryId: string | null;
  readonly reasoningGrantId: string | null; readonly disclosureGrantId: string | null; readonly membershipEpisodeId: string | null;
  readonly contentDigest: string | null; readonly ceiling: ReadonlyArray<string>;
}): string {
  const frozen = facts.state === 'FOUND'
    ? fingerprintStandingContextAuthority({ state: 'FOUND', worldId: facts.worldId, grantorId: facts.grantorId, grantId: facts.reasoningGrantId as string, audienceIds: facts.ceiling })
    : fingerprintStandingContextAuthority({ state: 'NOT_FOUND', worldId: facts.worldId, grantorId: facts.grantorId });
  return sha256([
    SHARED_KNOWLEDGE_ITEM_GRANT_SNAPSHOT_VERSION, `standing=${frozen}`,
    JSON.stringify([facts.memoryId, facts.reasoningGrantId, facts.disclosureGrantId, facts.membershipEpisodeId, facts.contentDigest]),
  ]);
}

/**
 * I-03E / I-03F's grant source for this request: the owner's ONE collected item, its reasoning grant re-read now. FOUND
 * only while it is still this exact pair (ACTIVE, or ACTIVE but needing reconfirmation — the frozen evaluator then denies
 * on the ceiling); anything else is NOT_FOUND; a failed or malformed read is UNRESOLVED.
 */
export class SharedKnowledgeItemGrantResolver {
  constructor(
    private readonly server: SupabaseServiceRoleApiService,
    private readonly worldId: SharedWorldId,
    private readonly itemOf: ReadonlyMap<string, SharedMemberKnowledgeItem>,
  ) {}

  async resolveCurrent(worldId: SharedWorldId, grantor: HumanPrincipal): Promise<StandingContextGrantResolution> {
    const item = worldId === this.worldId ? this.itemOf.get(grantor.humanId) : undefined;
    const notFound = (): StandingContextGrantResolution => Object.freeze({
      state: 'NOT_FOUND',
      authoritySnapshotRef: fingerprintSharedKnowledgeItemGrant({
        state: 'NOT_FOUND', worldId, grantorId: grantor.humanId, memoryId: item?.memoryId ?? null, reasoningGrantId: null,
        disclosureGrantId: null, membershipEpisodeId: null, contentDigest: null, ceiling: [],
      }),
    } as const);
    if (item === undefined) return notFound();
    let row: ItemRow | null;
    try {
      row = await readItem(this.server, worldId, grantor.humanId, item.memoryId);
    } catch {
      return Object.freeze({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' } as const);
    }
    if (row === null) return Object.freeze({ state: 'UNRESOLVED', failure: 'CONTRADICTORY_CANONICAL_STATE' } as const);
    if ((row.grantState !== 'ACTIVE' && row.grantState !== 'NEEDS_RECONFIRMATION') || !isSamePair(row, item)) return notFound();
    const ceiling = [...row.ceilingUserIds].sort(byCodeUnit);
    return Object.freeze({
      state: 'FOUND',
      authoritySnapshotRef: fingerprintSharedKnowledgeItemGrant({
        state: 'FOUND', worldId, grantorId: grantor.humanId, memoryId: item.memoryId, reasoningGrantId: item.reasoningGrantId,
        disclosureGrantId: item.disclosureGrantId, membershipEpisodeId: item.membershipEpisodeId, contentDigest: item.contentDigest, ceiling,
      }),
      grant: Object.freeze({
        grantId: item.reasoningGrantId,
        worldId,
        grantor: Object.freeze({ kind: 'HUMAN', humanId: grantor.humanId } as const),
        status: 'ACTIVE',
        audienceCeiling: Object.freeze(ceiling.map((humanId) => Object.freeze({ kind: 'HUMAN', humanId } as const))),
      }),
    } as const);
  }
}

/** I-03F's source-state source for this request: the item's current availability and digest, in this World only. */
export class SharedKnowledgeSourceStateResolver implements SharedPrivateSourceStateResolver {
  constructor(private readonly server: SupabaseServiceRoleApiService, private readonly worldId: SharedWorldId) {}

  async resolveCurrent(source: PrivateSourceContextRef): Promise<SharedPrivateSourceStateResolution> {
    let row: ItemRow | null;
    try {
      row = await readItem(this.server, this.worldId, source.originWorld.owner.humanId, source.contextId);
    } catch {
      return Object.freeze({ state: 'UNRESOLVED', failure: 'LOOKUP_FAILED' } as const);
    }
    if (row === null) return Object.freeze({ state: 'UNRESOLVED', failure: 'CONTRADICTORY_CANONICAL_STATE' } as const);
    if (row.availability === 'AVAILABLE') return Object.freeze({ state: 'AVAILABLE', contentDigest: row.currentContentDigest as string } as const);
    return Object.freeze({ state: row.availability } as const);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The Disclosure Authorization (§3 step 1, built before generation under R4-2) and its revalidation (§3 step 3b).
// ---------------------------------------------------------------------------------------------------------------------

export function fingerprintSharedDisclosureAuthorization(facts: Omit<SharedDisclosureAuthorization, 'disclosureAuthorizationRef'>): string {
  return sha256([
    SHARED_DISCLOSURE_AUTHORIZATION_VERSION, `world=${facts.targetWorldId.toLowerCase()}`, `effectiveContext=${facts.effectiveContextRef}`,
    `audience=${facts.audienceSnapshotRef}`, `items=${facts.items.length}`,
    ...facts.items.map((item, ordinal) => JSON.stringify([ordinal, item.ownerHumanId, item.contextId, item.contentDigest, item.reasoningGrantId,
      item.disclosureGrantId, item.membershipEpisodeId, item.scope])),
  ]);
}

/**
 * Builds the DA for exactly the envelope's admitted items: an item is in it only when its disclosure grant is the ACTIVE
 * pair of the collected consent, for this episode, with the item's words unchanged and the ceiling covering the exact
 * audience of the envelope. A failed read leaves the item out (it is then not sent at all, R4-1).
 */
export async function buildSharedDisclosureAuthorization(
  server: SupabaseServiceRoleApiService, envelope: SharedEffectiveContext, items: ReadonlyArray<SharedMemberKnowledgeItem>,
): Promise<SharedDisclosureAuthorization> {
  const audience = envelope.audienceSnapshot.humans.map((human) => human.humanId);
  const authorized: SharedDisclosureAuthorizationItem[] = [];
  for (const admitted of envelope.privateReasoningContexts) {
    const owner = admitted.source.originWorld.owner.humanId;
    const item = items.find((candidate) => candidate.ownerUserId === owner && candidate.memoryId === admitted.source.contextId);
    if (item === undefined || item.contentDigest !== admitted.contentDigest) continue;
    let row: ItemRow | null = null;
    try {
      row = await readItem(server, envelope.targetWorldId, owner, item.memoryId);
    } catch {
      row = null;
    }
    if (row === null || row.grantState !== 'ACTIVE' || row.disclosureStatus !== 'ACTIVE' || !isSamePair(row, item)) continue;
    if (row.availability !== 'AVAILABLE' || row.currentContentDigest !== item.contentDigest) continue;
    if (!audience.every((humanId) => row.ceilingUserIds.includes(humanId))) continue;
    authorized.push(Object.freeze({
      ownerHumanId: owner, contextId: item.memoryId, contentDigest: item.contentDigest, reasoningGrantId: item.reasoningGrantId,
      disclosureGrantId: item.disclosureGrantId, membershipEpisodeId: item.membershipEpisodeId, scope: SHARED_KNOWLEDGE_DISCLOSURE_SCOPE,
    }));
  }
  const facts = {
    targetWorldId: envelope.targetWorldId, effectiveContextRef: envelope.effectiveContextRef,
    audienceSnapshotRef: envelope.audienceSnapshot.snapshotRef, items: Object.freeze(authorized),
  };
  return Object.freeze({ ...facts, disclosureAuthorizationRef: fingerprintSharedDisclosureAuthorization(facts) });
}

/** The DA is the one this envelope's server built: same World, operation and audience; each item one of the envelope's. */
function isBoundAuthorization(da: SharedDisclosureAuthorization, envelope: SharedEffectiveContext): boolean {
  if (!isRecord(da) || da.targetWorldId !== envelope.targetWorldId || da.effectiveContextRef !== envelope.effectiveContextRef) return false;
  if (da.audienceSnapshotRef !== envelope.audienceSnapshot.snapshotRef || !Array.isArray(da.items)) return false;
  const seen = new Set<string>();
  for (const item of da.items) {
    if (item.scope !== SHARED_KNOWLEDGE_DISCLOSURE_SCOPE) return false;
    const identity = JSON.stringify([item.ownerHumanId, item.contextId]);
    if (seen.has(identity)) return false;
    seen.add(identity);
    if (!envelope.privateReasoningContexts.some((admitted) => admitted.source.originWorld.owner.humanId === item.ownerHumanId
      && admitted.source.contextId === item.contextId && admitted.contentDigest === item.contentDigest)) return false;
  }
  const { disclosureAuthorizationRef, ...facts } = da;
  return disclosureAuthorizationRef === fingerprintSharedDisclosureAuthorization(facts);
}

/**
 * §3 step 3b — the disclosure grants of exactly the disclosed items, now: still this ACTIVE pair, the episode open, the
 * words unchanged, the ceiling over the current audience (0176's grant state answers all of that).
 */
export async function revalidateSharedDisclosure(
  server: SupabaseServiceRoleApiService, da: SharedDisclosureAuthorization, outputDigest: string, disclosedContextIds: ReadonlyArray<string>,
): Promise<{ readonly state: 'CURRENT'; readonly disclosureRevalidationRef: string } | { readonly state: 'STALE' } | { readonly state: 'UNRESOLVED' }> {
  const disclosed = da.items.filter((item) => disclosedContextIds.includes(item.contextId));
  if (disclosed.length !== disclosedContextIds.length || disclosed.length === 0) return { state: 'UNRESOLVED' };
  for (const item of disclosed) {
    let row: ItemRow | null;
    try {
      row = await readItem(server, da.targetWorldId, item.ownerHumanId, item.contextId);
    } catch {
      return { state: 'UNRESOLVED' };
    }
    if (row === null) return { state: 'UNRESOLVED' };
    if (row.grantState !== 'ACTIVE' || row.disclosureStatus !== 'ACTIVE' || row.availability !== 'AVAILABLE') return { state: 'STALE' };
    if (row.reasoningGrantId !== item.reasoningGrantId || row.disclosureGrantId !== item.disclosureGrantId
      || row.membershipEpisodeId !== item.membershipEpisodeId || row.currentContentDigest !== item.contentDigest
      || row.grantContentDigest !== item.contentDigest) return { state: 'STALE' };
  }
  return {
    state: 'CURRENT',
    disclosureRevalidationRef: sha256([
      SHARED_DISCLOSURE_REVALIDATION_VERSION, `disclosureAuthorization=${da.disclosureAuthorizationRef}`, `output=${outputDigest}`,
      ...disclosed.map((item, ordinal) => JSON.stringify([ordinal, item.ownerHumanId, item.contextId, item.disclosureGrantId])),
    ]),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The claim table (R4-2 step 1): before generation, from the DA and the audience's Names.
// ---------------------------------------------------------------------------------------------------------------------

/** What the reply composition carries from before generation to after it, for one request. */
export interface SharedClaimPreparation {
  readonly authorization: SharedDisclosureAuthorization;
  readonly table: SharedClaimTable;
}

/**
 * The claim table of one request. The Names are used only when they are exactly this envelope's audience (every member,
 * no one else); otherwise no item may be stated (each still informs the reply). Never throws.
 */
export function prepareSharedClaims(input: {
  readonly envelope: SharedEffectiveContext;
  readonly authorization: SharedDisclosureAuthorization;
  readonly items: ReadonlyArray<SharedMemberKnowledgeItem>;
  readonly names: ReadonlyArray<SharedClaimAudienceMember> | null;
  readonly labelOf: ReadonlyMap<string, string>;
  readonly otherNames?: ReadonlyArray<string>;
  readonly nonce?: string;
}): SharedClaimPreparation {
  const audience = input.envelope.audienceSnapshot.humans.map((human) => human.humanId);
  const exact = input.names !== null && input.names.length === audience.length && new Set(input.names.map((member) => member.userId)).size === audience.length
    && input.names.every((member) => audience.includes(member.userId));
  const admitted = input.envelope.privateReasoningContexts.flatMap((entry) => {
    const item = input.items.find((candidate) => candidate.ownerUserId === entry.source.originWorld.owner.humanId
      && candidate.memoryId === entry.source.contextId && candidate.contentDigest === entry.contentDigest);
    return item === undefined ? [] : [item];
  });
  const table = prepareSharedClaimTable({
    admitted,
    authorized: new Set(input.authorization.items.map((item) => item.contextId)),
    audience: exact ? input.names : null,
    labelOf: input.labelOf,
    otherNames: input.otherNames,
    binding: {
      effectiveContextRef: input.envelope.effectiveContextRef,
      audienceSnapshotRef: input.envelope.audienceSnapshot.snapshotRef,
      disclosureAuthorizationRef: input.authorization.disclosureAuthorizationRef,
    },
    nonce: input.nonce,
  });
  return Object.freeze({ authorization: input.authorization, table });
}

// ---------------------------------------------------------------------------------------------------------------------
// The gate lane (R4-2 steps 4 – 6): the frozen I-03G gate over the rendered text, its detector the one claim check.
// ---------------------------------------------------------------------------------------------------------------------

/**
 * The checker's result, validated against what was asked: the exact binding, the exact keys. Null when it is not exactly
 * that; 'MISMATCH' when it is bound to another operation, audience, DA or output.
 */
export function decodeSharedDisclosureCheck(value: unknown, binding: SharedDisclosureCheckBinding):
  { readonly checkRef: string; readonly policyRef: string; readonly answer: unknown } | null | 'MISMATCH' {
  if (!isRecord(value) || !hasExactKeys(value, CHECK_RESULT_KEYS) || value.state !== 'CHECKED') return null;
  if (!isNonBlankString(value.checkRef) || !isNonBlankString(value.policyRef)) return null;
  const bound = value.binding;
  if (!isRecord(bound) || !hasExactKeys(bound, CHECK_BINDING_KEYS)) return null;
  if (CHECK_BINDING_KEYS.some((key) => bound[key] !== binding[key])) return 'MISMATCH';
  return { checkRef: value.checkRef, policyRef: value.policyRef, answer: value.answer };
}

type Rendered = { readonly text: string; readonly outputDigest: string };
type CheckOutcome =
  | { readonly kind: 'DECIDED'; readonly decision: SharedClaimDecision; readonly checkRef: string; readonly policyRef: string }
  | { readonly kind: 'UNRESOLVED'; readonly reason: SharedMemberKnowledgeGateUnresolvedReason };

/** The frozen gate's detector for this request: ONE checker call over the claim view, bound to the rendered text. */
class SharedClaimDetector implements SharedSourceDisclosureDetector {
  outcome: CheckOutcome | undefined;

  constructor(
    private readonly checker: SharedDisclosureJudge,
    private readonly authorization: SharedDisclosureAuthorization,
    private readonly table: SharedClaimTable,
    private readonly parsed: Extract<SharedClaimParse, { ok: true }>,
    private readonly marked: string,
    private readonly rendered: Rendered,
    private readonly payer: SharedDisclosureJudgePayer,
  ) {}

  async assess(request: SharedSourceDisclosureDetectionRequest): Promise<SharedSourceDisclosureDetectorAssessment> {
    this.outcome = await this.check(request);
    const unresolved = Object.freeze({ state: 'UNRESOLVED', failure: 'ASSESSMENT_UNAVAILABLE' } as const);
    if (this.outcome.kind === 'UNRESOLVED') return unresolved;
    const { decision } = this.outcome;
    if (decision.state === 'UNRESOLVED' || decision.state === 'STALE') return unresolved;
    const binding = Object.freeze({ effectiveContextRef: request.effectiveContextRef, outputDigest: request.outputDigest, protectedSourceSetRef: request.protectedSourceSetRef });
    const assessmentRef = sha256([SHARED_CLAIM_ASSESSMENT_VERSION, this.outcome.checkRef]);
    const detectorPolicyRef = sha256([SHARED_CLAIM_ASSESSMENT_VERSION, this.outcome.policyRef]);
    // The frozen gate is told the truth: CLEAR only when nothing was stated and nothing was reported.
    if (decision.state === 'READY' && decision.disclosed.length === 0) return Object.freeze({ state: 'CLEAR', assessmentRef, detectorPolicyRef, binding } as const);
    const findings = decision.state === 'READY'
      ? (['DIRECT_PROTECTED_SOURCE_FACT', 'SOURCE_SPECIFIC_ATTRIBUTION'] as const)
      : decision.sealed ? (['SEALED_PROVENANCE_DISCLOSURE'] as const) : (['DIRECT_PROTECTED_SOURCE_FACT'] as const);
    return Object.freeze({ state: 'DETECTED', assessmentRef, detectorPolicyRef, binding, findings: Object.freeze([...findings]) } as const);
  }

  private async check(request: SharedSourceDisclosureDetectionRequest): Promise<CheckOutcome> {
    // The check is about the text that will be delivered, and about nothing else.
    if (request.outputText !== this.rendered.text || request.outputDigest !== this.rendered.outputDigest
      || request.effectiveContextRef !== this.table.binding.effectiveContextRef) return { kind: 'UNRESOLVED', reason: 'DETECTOR_BINDING_MISMATCH' };
    const binding: SharedDisclosureCheckBinding = Object.freeze({ ...this.table.binding, outputDigest: this.rendered.outputDigest });
    const view = sharedClaimCheckerView(this.marked, this.parsed, this.table);
    const checkRequest: SharedDisclosureCheckRequest = Object.freeze({ binding, reply: view.text, spans: view.spanIds, items: view.items });
    // Correction 2: the sender pays, through the begin command that verifies they wrote the answered message.
    const scope: AiUsageAttribution = { userId: this.payer.userId, sourceWorldId: this.payer.worldId, sourceSharedMaterialId: this.payer.materialId };
    let raw: unknown;
    try {
      raw = await runWithAiUsageAttribution(scope, () => this.checker.judge(checkRequest));
    } catch {
      return { kind: 'UNRESOLVED', reason: 'DETECTOR_UNRESOLVED' };
    }
    const checked = decodeSharedDisclosureCheck(raw, binding);
    if (checked === 'MISMATCH') return { kind: 'UNRESOLVED', reason: 'DETECTOR_BINDING_MISMATCH' };
    if (checked === null) return { kind: 'UNRESOLVED', reason: 'DETECTOR_UNRESOLVED' };
    const decision = decideSharedClaims(checked.answer, view, this.parsed, this.table, {
      binding: { effectiveContextRef: request.effectiveContextRef, audienceSnapshotRef: this.authorization.audienceSnapshotRef, disclosureAuthorizationRef: this.authorization.disclosureAuthorizationRef },
      authorized: new Set(this.authorization.items.map((item) => item.contextId)),
    });
    return { kind: 'DECIDED', decision, checkRef: checked.checkRef, policyRef: checked.policyRef };
  }
}

export function fingerprintSharedDisclosedSourceSet(facts: { readonly disclosureAuthorizationRef: string; readonly items: ReadonlyArray<SharedDisclosureAuthorizationItem> }): string {
  return sha256([SHARED_DISCLOSED_SOURCE_SET_VERSION, `disclosureAuthorization=${facts.disclosureAuthorizationRef}`, `items=${facts.items.length}`,
    ...facts.items.map((item, ordinal) => JSON.stringify([ordinal, item.ownerHumanId, item.contextId, item.contentDigest, item.disclosureGrantId]))]);
}

export function fingerprintSharedAuthorizedDisclosureGate(facts: {
  readonly frozenGateFacts: { readonly effectiveContextRef: string; readonly outputDigest: string; readonly protectedSourceSetRef: string };
  readonly disclosureAuthorizationRef: string; readonly disclosedSourceSetRef: string; readonly assessmentRef: string; readonly detectorPolicyRef: string;
}): string {
  return sha256([
    SHARED_AUTHORIZED_DISCLOSURE_GATE_VERSION, `effectiveContext=${facts.frozenGateFacts.effectiveContextRef}`, `output=${facts.frozenGateFacts.outputDigest}`,
    `protectedSources=${facts.frozenGateFacts.protectedSourceSetRef}`, `disclosureAuthorization=${facts.disclosureAuthorizationRef}`,
    `disclosedSources=${facts.disclosedSourceSetRef}`, 'basis=SERVER_DETECTOR_DETECTED_WITHIN_DISCLOSURE_AUTHORIZATION',
    JSON.stringify([facts.assessmentRef, facts.detectorPolicyRef]),
  ]);
}

/**
 * The gate lane: the frozen I-03G gate, unchanged, over the RENDERED text and this request's detector. The frozen gate's
 * own answer decides every structural question; the server's claim decision decides the rest, and the two must agree.
 */
export async function evaluateSharedMemberKnowledgeGate(input: {
  readonly envelope: SharedEffectiveContext;
  readonly authorization: SharedDisclosureAuthorization;
  readonly table: SharedClaimTable;
  /** The generator's text, its spans parsed against `table`. */
  readonly marked: string;
  readonly parsed: Extract<SharedClaimParse, { ok: true }>;
  /** The text that will be delivered: the spans rendered with their owners' Names. */
  readonly rendered: Rendered;
  readonly checker: SharedDisclosureJudge;
  readonly payer: SharedDisclosureJudgePayer;
}): Promise<SharedMemberKnowledgeGateResult> {
  const unresolved = (reason: SharedMemberKnowledgeGateUnresolvedReason): SharedMemberKnowledgeGateResult => Object.freeze({ state: 'UNRESOLVED', reason } as const);
  if (!isBoundAuthorization(input.authorization, input.envelope)) return unresolved('DISCLOSURE_AUTHORIZATION_MISMATCH');
  if (input.table.binding.effectiveContextRef !== input.envelope.effectiveContextRef || input.table.binding.audienceSnapshotRef !== input.envelope.audienceSnapshot.snapshotRef
    || input.table.binding.disclosureAuthorizationRef !== input.authorization.disclosureAuthorizationRef) return unresolved('DISCLOSURE_AUTHORIZATION_MISMATCH');
  const detector = new SharedClaimDetector(input.checker, input.authorization, input.table, input.parsed, input.marked, input.rendered, input.payer);
  const frozen = await new SharedSourceDisclosureGateService(detector).evaluate(input.envelope, input.rendered.text);
  if (frozen.state === 'UNRESOLVED' && detector.outcome === undefined) return unresolved(frozen.reason);
  if (frozen.state === 'CLEAR' && frozen.gate.basis === 'NO_PROTECTED_PRIVATE_CONTEXT') {
    // Nothing was admitted: no span can be valid (the table is empty), and there is nothing to check.
    if (input.parsed.spans.length > 0) return unresolved('MALFORMED_GENERATION_ARTIFACT');
    return Object.freeze({ state: 'CLEAR', gateRef: frozen.gate.gateRef, effectiveContextRef: frozen.gate.effectiveContextRef, outputDigest: frozen.gate.outputDigest } as const);
  }
  const outcome = detector.outcome;
  if (outcome === undefined) return unresolved('DETECTOR_UNRESOLVED');
  if (outcome.kind === 'UNRESOLVED') return unresolved(outcome.reason);
  const { decision } = outcome;
  if (decision.state === 'UNRESOLVED') return unresolved('DETECTOR_UNRESOLVED');
  if (decision.state === 'STALE') return unresolved('DISCLOSURE_AUTHORIZATION_MISMATCH');
  if (decision.state === 'BLOCKED') {
    if (frozen.state !== 'BLOCKED') return unresolved('DETECTOR_UNRESOLVED');
    return Object.freeze({ state: 'BLOCKED', reason: 'PROTECTED_SOURCE_DISCLOSURE_DETECTED', coolDown: decision.coolDown } as const);
  }
  if (decision.disclosed.length === 0) {
    if (frozen.state !== 'CLEAR') return unresolved('DETECTOR_UNRESOLVED');
    return Object.freeze({ state: 'CLEAR', gateRef: frozen.gate.gateRef, effectiveContextRef: frozen.gate.effectiveContextRef, outputDigest: frozen.gate.outputDigest } as const);
  }
  // Something was stated, every statement inside its own span and authorized. The frozen gate, told DETECTED, blocked:
  // that is the reasoning lane's answer, and it must be the one it gave.
  if (frozen.state !== 'BLOCKED') return unresolved('DETECTOR_UNRESOLVED');
  const protectedSourceSetRef = fingerprintSharedProtectedSourceSet({
    effectiveContextRef: input.envelope.effectiveContextRef,
    items: input.envelope.privateReasoningContexts.map((item) => ({ ownerHumanId: item.source.originWorld.owner.humanId, contextId: item.source.contextId, contentDigest: item.contentDigest })),
  });
  const outputDigest = input.rendered.outputDigest;
  const disclosedItems = input.authorization.items.filter((item) => decision.disclosed.includes(item.contextId));
  if (disclosedItems.length !== decision.disclosed.length) return unresolved('DISCLOSURE_AUTHORIZATION_MISMATCH');
  const disclosedSourceSetRef = fingerprintSharedDisclosedSourceSet({ disclosureAuthorizationRef: input.authorization.disclosureAuthorizationRef, items: disclosedItems });
  const assessmentRef = sha256([SHARED_CLAIM_ASSESSMENT_VERSION, outcome.checkRef]);
  const detectorPolicyRef = sha256([SHARED_CLAIM_ASSESSMENT_VERSION, outcome.policyRef]);
  const gate: SharedAuthorizedDisclosureGate = Object.freeze({
    gateRef: fingerprintSharedAuthorizedDisclosureGate({
      frozenGateFacts: { effectiveContextRef: input.envelope.effectiveContextRef, outputDigest, protectedSourceSetRef },
      disclosureAuthorizationRef: input.authorization.disclosureAuthorizationRef, disclosedSourceSetRef, assessmentRef, detectorPolicyRef,
    }),
    effectiveContextRef: input.envelope.effectiveContextRef,
    outputDigest,
    protectedSourceSetRef,
    disclosureAuthorizationRef: input.authorization.disclosureAuthorizationRef,
    disclosedSourceSetRef,
    disclosedContextIds: Object.freeze(disclosedItems.map((item) => item.contextId)),
    basis: 'SERVER_DETECTOR_DETECTED_WITHIN_DISCLOSURE_AUTHORIZATION',
    sourceDisclosureStatus: 'PROTECTED_SOURCE_DISCLOSURE_DETECTED_WITHIN_AUTHORIZATION',
    directPrivateDisclosureAuthority: 'REQUIRES_DISCLOSURE_REVALIDATION',
    materialDisclosureAuthority: 'NOT_GRANTED',
    provenanceDisclosure: 'SEALED',
    deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY',
  } as const);
  return Object.freeze({ state: 'AUTHORIZED_DISCLOSURE', gate } as const);
}

// ---------------------------------------------------------------------------------------------------------------------
// The lane: its frozen classes, built for one request, and its readiness (§3 step 3).
// ---------------------------------------------------------------------------------------------------------------------

/** The exact CURRENT positions I-03F answers (the frozen readiness requires exactly these, and so does the lane). */
const EXPECTED_CURRENT = Object.freeze({
  authorityStatus: 'CURRENT', sourceDisclosureAuthority: 'NOT_EVALUATED', systemSafetyAuthority: 'NOT_EVALUATED',
  deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY', directPrivateDisclosureAuthority: 'NOT_GRANTED',
  materialDisclosureAuthority: 'NOT_GRANTED', provenanceDisclosure: 'SEALED',
} as const);

export class SharedMemberKnowledgeLane {
  readonly effectiveContext: SharedEffectiveContextService;
  readonly revalidator: SharedDeliveryAuthorityRevalidatorService;
  /** The I-03E candidates of the collected items, in collector order. */
  readonly candidates: ReadonlyArray<SharedPrivateContextCandidate>;

  constructor(
    private readonly server: SupabaseServiceRoleApiService,
    worldState: SharedPreModelWorldStateResolverService,
    audience: SharedHumanAudienceResolverService,
    readonly worldId: SharedWorldId,
    readonly items: ReadonlyArray<SharedMemberKnowledgeItem>,
  ) {
    const grants = new SharedKnowledgeItemGrantResolver(server, worldId, new Map(items.map((item) => [item.ownerUserId, item])));
    // The frozen classes take the frozen grant resolver's type; this request's resolver answers its one method.
    const asGrantResolver = grants as unknown as StandingContextGrantResolverService;
    this.effectiveContext = new SharedEffectiveContextService(worldState, audience, asGrantResolver);
    this.revalidator = new SharedDeliveryAuthorityRevalidatorService(worldState, audience, asGrantResolver, new SharedKnowledgeSourceStateResolver(server, worldId));
    this.candidates = Object.freeze(items.map((item) => Object.freeze({
      kind: 'MY_WORLD_PRIVATE_CONTEXT',
      contextId: item.memoryId,
      originWorld: Object.freeze({ architectureClass: 'WORLD', worldType: 'MY_WORLD', owner: Object.freeze({ kind: 'HUMAN', humanId: item.ownerUserId } as const) } as const),
      availability: 'AVAILABLE',
      reasoningContent: item.content,
    } as const)));
  }

  /** R4-2 step 1, first half: the DA of this envelope, before generation. A failed read leaves an item out. */
  authorize(envelope: SharedEffectiveContext): Promise<SharedDisclosureAuthorization> {
    return buildSharedDisclosureAuthorization(this.server, envelope, this.items);
  }

  /** R4-2 step 1, second half: the claim table over the DA and the audience's Names (null: none may be stated). */
  claims(input: {
    readonly envelope: SharedEffectiveContext; readonly authorization: SharedDisclosureAuthorization;
    readonly names: ReadonlyArray<SharedClaimAudienceMember> | null; readonly labelOf: ReadonlyMap<string, string>;
    readonly otherNames?: ReadonlyArray<string>; readonly nonce?: string;
  }): SharedClaimPreparation {
    return prepareSharedClaims({ ...input, items: this.items });
  }

  /**
   * R4-2 steps 3 – 6: parse and render the generator's text, the gate lane over the rendered text, I-03F, then the
   * disclosure revalidation. Never throws. READY carries the rendered text; BLOCKED carries only the unsafe items.
   */
  async readiness(input: {
    readonly envelope: SharedEffectiveContext; readonly preparation: SharedClaimPreparation; readonly generatedText: string;
    readonly checker: SharedDisclosureJudge; readonly payer: SharedDisclosureJudgePayer;
  }): Promise<SharedMemberKnowledgeReadiness> {
    try {
      const { authorization, table } = input.preparation;
      // A malformed, foreign, duplicate or residual span, or a Name inside one: withheld before anything else, nothing cooled.
      const parsed = parseSharedClaimSpans(input.generatedText, table);
      if (!parsed.ok) return { state: 'UNRESOLVED' };
      const rendered = renderSharedClaims(input.generatedText, parsed);
      if (!rendered.ok) return { state: 'UNRESOLVED' };
      const gate = await evaluateSharedMemberKnowledgeGate({
        envelope: input.envelope, authorization, table, marked: input.generatedText, parsed, rendered, checker: input.checker, payer: input.payer,
      });
      if (gate.state === 'BLOCKED') return Object.freeze({ state: 'BLOCKED', coolDown: gate.coolDown } as const);
      if (gate.state === 'UNRESOLVED') return { state: 'UNRESOLVED' };
      const facts = gate.state === 'CLEAR'
        ? { gateRef: gate.gateRef, effectiveContextRef: gate.effectiveContextRef, outputDigest: gate.outputDigest, disclosed: [] as ReadonlyArray<string> }
        : { gateRef: gate.gate.gateRef, effectiveContextRef: gate.gate.effectiveContextRef, outputDigest: gate.gate.outputDigest, disclosed: gate.gate.disclosedContextIds };
      if (facts.outputDigest !== rendered.outputDigest) return { state: 'UNRESOLVED' };
      const revalidation = await this.revalidator.revalidate(input.envelope, rendered.text);
      const authority = currentAuthority(revalidation, facts.effectiveContextRef, facts.outputDigest);
      if (authority.kind !== 'CURRENT') return { state: authority.kind };
      let disclosureRevalidationRef: string | null = null;
      if (facts.disclosed.length > 0) {
        const disclosure = await revalidateSharedDisclosure(this.server, authorization, facts.outputDigest, facts.disclosed);
        if (disclosure.state !== 'CURRENT') return { state: disclosure.state };
        disclosureRevalidationRef = disclosure.disclosureRevalidationRef;
      }
      return Object.freeze({
        state: 'READY_FOR_LATER_DELIVERY_GATES',
        text: rendered.text,
        readiness: Object.freeze({
          // The v1 readiness formula: the frozen 0090 / 0119 commit recomputes exactly it from the four references it receives.
          readinessRef: fingerprintSharedPrivacyAuthorityDeliveryReadiness({
            effectiveContextRef: facts.effectiveContextRef, outputDigest: facts.outputDigest, sourceDisclosureGateRef: facts.gateRef,
            authorityRevalidationRef: authority.revalidationRef,
          }),
          effectiveContextRef: facts.effectiveContextRef,
          outputDigest: facts.outputDigest,
          sourceDisclosureGateRef: facts.gateRef,
          authorityRevalidationRef: authority.revalidationRef,
          sourceDisclosureStatus: facts.disclosed.length === 0 ? 'NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED' : 'AUTHORIZED_DISCLOSURE_ONLY',
          disclosureAuthorizationRef: authorization.disclosureAuthorizationRef,
          disclosureRevalidationRef,
          disclosedContextIds: Object.freeze([...facts.disclosed]),
          authorityStatus: 'CURRENT',
          systemSafetyStatus: 'NOT_EVALUATED',
          launchGateStatus: 'NOT_EVALUATED',
          deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY',
        } as const),
      } as const);
    } catch {
      return { state: 'UNRESOLVED' };
    }
  }
}

/** I-03F's answer for the same operation, read with the frozen readiness's own rules. */
function currentAuthority(value: SharedDeliveryAuthorityRevalidation, effectiveContextRef: string, outputDigest: string):
  { readonly kind: 'CURRENT'; readonly revalidationRef: string } | { readonly kind: 'STALE' } | { readonly kind: 'UNRESOLVED' } {
  if (!isRecord(value)) return { kind: 'UNRESOLVED' };
  if (value.state === 'STALE') return { kind: 'STALE' };
  if (value.state !== 'CURRENT' || !isRecord(value.revalidation)) return { kind: 'UNRESOLVED' };
  const revalidation = value.revalidation as unknown as Record<string, unknown>;
  if (!isNonBlankString(revalidation.revalidationRef)) return { kind: 'UNRESOLVED' };
  if (Object.entries(EXPECTED_CURRENT).some(([key, expected]) => revalidation[key] !== expected)) return { kind: 'UNRESOLVED' };
  if (revalidation.effectiveContextRef !== effectiveContextRef || revalidation.outputDigest !== outputDigest) return { kind: 'UNRESOLVED' };
  return { kind: 'CURRENT', revalidationRef: revalidation.revalidationRef };
}
