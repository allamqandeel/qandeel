// S8A-04 CP3 — Personal Knowledge in a Shared World: the closed vocabulary of the authorized-disclosure lane
// (QANDEEL_S8A-04_CP3_PERSONAL_KNOWLEDGE_IN_SHARED_WORLD_CONTROLLED_AMENDMENT v1.0, §2 – §4, approved for implementation
// by the Product Owner on 2026-10-25).
//
// The frozen I-03 chain stays byte-identical. This lane is composed BESIDE it, never inside it:
//
//   consented items (0176 collector)
//     -> I-03E EffectiveContext, unchanged, over a per-request grant resolver that answers ONE item per owner
//     -> generation
//     -> Disclosure Authorization (DA), built by the server from the 0176 disclosure grants of exactly those items
//     -> the frozen I-03G gate, unchanged, over a per-request detector that asks the judge once per owner and maps its
//        v2 assessment fail-closed (§3 step 2.5)
//     -> I-03F, unchanged, over the per-request grant and source-state resolvers
//     -> the disclosure revalidation (the disclosure grants again, now)
//     -> the commit with consent (0176 `complete_shared_world_qandeel_reply_v2`, the consent re-checked under lock)
//
// A reply that mentions a consented item is never relabelled CLEAR: the gate's state is AUTHORIZED_DISCLOSURE, its
// status says the disclosure was detected within an authorization, and nothing here is a permission to deliver.

import type { SharedSourceDisclosureAssessmentBinding, SharedSourceDisclosureFindingCategory } from '../source-disclosure/shared-source-disclosure-detector.types';

/** The 0176 service-role reads and acts this lane composes. */
export const SHARED_KNOWLEDGE_FOR_REPLY_RPC = 'list_shared_knowledge_for_reply_v1' as const;
export const SHARED_KNOWLEDGE_ITEM_RPC = 'resolve_shared_knowledge_item_v1' as const;
export const SHARED_KNOWLEDGE_COOL_DOWN_RPC = 'cool_down_shared_knowledge_v1' as const;
export const SHARED_KNOWLEDGE_PROPOSE_RPC = 'propose_shared_knowledge_request_v1' as const;
export const SHARED_QANDEEL_REPLY_COMMIT_V2_RPC = 'complete_shared_world_qandeel_reply_v2' as const;

/** The one consent scope of v1 (PO-2): use, and mention as the owner's. */
export const SHARED_KNOWLEDGE_DISCLOSURE_SCOPE = 'MENTION_ATTRIBUTED_TO_OWNER' as const;

/** The reasoning-dependency reference of one used item: its reasoning grant (0176 `reasoning_ref_v1`). */
export const sharedKnowledgeReasoningRef = (reasoningGrantId: string): string => `shared-knowledge:${reasoningGrantId.toLowerCase()}`;

/** One consented item, as the 0176 collector returns it: at most one per owner per reply. Server-only. */
export interface SharedMemberKnowledgeItem {
  readonly ownerUserId: string;
  /** The owner's Name, for the request's labels only. */
  readonly ownerName: string | null;
  readonly memoryId: string;
  /** The item's exact words, consented for this World, this episode and this ceiling. */
  readonly content: string;
  readonly contentDigest: string;
  readonly reasoningGrantId: string;
  readonly disclosureGrantId: string;
  readonly membershipEpisodeId: string;
  readonly ceilingUserIds: ReadonlyArray<string>;
}

/** One item of a Disclosure Authorization (§2). */
export interface SharedDisclosureAuthorizationItem {
  readonly ownerHumanId: string;
  /** The I-03E source context id: the memory id. */
  readonly contextId: string;
  readonly contentDigest: string;
  readonly reasoningGrantId: string;
  readonly disclosureGrantId: string;
  readonly membershipEpisodeId: string;
  readonly scope: typeof SHARED_KNOWLEDGE_DISCLOSURE_SCOPE;
}

/**
 * The server-built, immutable proof that, for ONE exact operation, each listed item's disclosure grant is ACTIVE for that
 * exact audience (§2). Built only from 0176 rows; never from a client, a provider or a model.
 */
export interface SharedDisclosureAuthorization {
  readonly targetWorldId: string;
  readonly effectiveContextRef: string;
  readonly audienceSnapshotRef: string;
  readonly items: ReadonlyArray<SharedDisclosureAuthorizationItem>;
  /** `sha256:<64 hex>` over every field above. */
  readonly disclosureAuthorizationRef: string;
}

// ---------------------------------------------------------------------------------------------------------------------
// The judge (§4): the server-owned check of a reply that used personal knowledge. A check that can only block.
// ---------------------------------------------------------------------------------------------------------------------

export const SHARED_DISCLOSURE_ATTRIBUTIONS = ['OWNER', 'OTHER', 'NONE', 'UNCLEAR'] as const;
export type SharedDisclosureAttribution = (typeof SHARED_DISCLOSURE_ATTRIBUTIONS)[number];

/**
 * ONE owner's check (§3 step 2.3): the exact reply, that owner's items only, the request's labels and the operation
 * binding. It names no account: the call is made inside the AI-COST-01 scope of the verified author of the message the
 * reply answers (Product Owner correction 2), never the owner's.
 */
export interface SharedDisclosureJudgeRequest {
  readonly binding: SharedSourceDisclosureAssessmentBinding;
  readonly reply: string;
  /** The owner's label in this request. */
  readonly owner: string;
  /** The other people's labels in this request. */
  readonly members: ReadonlyArray<string>;
  /** That owner's admitted items, each with its digest (the assessment's key) and its exact words. */
  readonly items: ReadonlyArray<{ readonly contentDigest: string; readonly item: string }>;
}

/** Who pays for the judge: the sender of the answered message, its World and the message (begin_ai_provider_call_v2). */
export interface SharedDisclosureJudgePayer { readonly userId: string; readonly worldId: string; readonly materialId: string }

/** The v2 assessment (§3 step 2.4), accepted only in this lane. One entry per item of the request, no other key. */
export interface SharedDisclosureJudgeAssessment {
  readonly state: 'ASSESSED';
  readonly assessmentRef: string;
  readonly detectorPolicyRef: string;
  readonly binding: SharedSourceDisclosureAssessmentBinding;
  readonly sources: ReadonlyArray<{
    readonly contentDigest: string;
    readonly findings: ReadonlyArray<SharedSourceDisclosureFindingCategory>;
    readonly attributedTo: SharedDisclosureAttribution;
    readonly unsupportedOwnerClaim: boolean;
  }>;
}

/** The judge returns `unknown` on purpose: the lane validates every key itself, and anything else is UNRESOLVED. */
export interface SharedDisclosureJudge {
  judge(request: SharedDisclosureJudgeRequest): Promise<unknown>;
}
export const SHARED_DISCLOSURE_JUDGE = 'SHARED_DISCLOSURE_JUDGE' as const;

// ---------------------------------------------------------------------------------------------------------------------
// The lane's gate and readiness results.
// ---------------------------------------------------------------------------------------------------------------------

/** §3 step 2.6: a detection that stayed within the Disclosure Authorization. Not CLEAR, and not a permission. */
export interface SharedAuthorizedDisclosureGate {
  readonly gateRef: string;
  readonly effectiveContextRef: string;
  readonly outputDigest: string;
  readonly protectedSourceSetRef: string;
  readonly disclosureAuthorizationRef: string;
  readonly disclosedSourceSetRef: string;
  /** The memory ids whose disclosure the reply made, in admitted order. */
  readonly disclosedContextIds: ReadonlyArray<string>;
  readonly basis: 'SERVER_DETECTOR_DETECTED_WITHIN_DISCLOSURE_AUTHORIZATION';
  readonly sourceDisclosureStatus: 'PROTECTED_SOURCE_DISCLOSURE_DETECTED_WITHIN_AUTHORIZATION';
  readonly directPrivateDisclosureAuthority: 'REQUIRES_DISCLOSURE_REVALIDATION';
  readonly materialDisclosureAuthority: 'NOT_GRANTED';
  readonly provenanceDisclosure: 'SEALED';
  readonly deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY';
}

export const SHARED_MEMBER_KNOWLEDGE_GATE_UNRESOLVED_REASONS = [
  'MALFORMED_GENERATION_ARTIFACT',
  'DETECTOR_UNRESOLVED',
  'DETECTOR_BINDING_MISMATCH',
  'DISCLOSURE_AUTHORIZATION_MISMATCH',
] as const;
export type SharedMemberKnowledgeGateUnresolvedReason = (typeof SHARED_MEMBER_KNOWLEDGE_GATE_UNRESOLVED_REASONS)[number];

/** The lane's gate: the frozen gate's own CLEAR (nothing was disclosed), the authorized state, or a stop. */
export type SharedMemberKnowledgeGateResult =
  | { readonly state: 'CLEAR'; readonly gateRef: string; readonly effectiveContextRef: string; readonly outputDigest: string }
  | { readonly state: 'AUTHORIZED_DISCLOSURE'; readonly gate: SharedAuthorizedDisclosureGate }
  | { readonly state: 'BLOCKED'; readonly reason: 'PROTECTED_SOURCE_DISCLOSURE_DETECTED' }
  | { readonly state: 'UNRESOLVED'; readonly reason: SharedMemberKnowledgeGateUnresolvedReason };

/** §3 step 3: the lane's readiness detail. The binder reads the same five references it reads from I-03G's. */
export interface SharedMemberKnowledgeReadinessDetail {
  readonly readinessRef: string;
  readonly effectiveContextRef: string;
  readonly outputDigest: string;
  readonly sourceDisclosureGateRef: string;
  readonly authorityRevalidationRef: string;
  readonly sourceDisclosureStatus: 'NO_PROTECTED_SOURCE_DISCLOSURE_DETECTED' | 'AUTHORIZED_DISCLOSURE_ONLY';
  readonly disclosureAuthorizationRef: string;
  /** Present only when a disclosure was made and revalidated now. */
  readonly disclosureRevalidationRef: string | null;
  /** The memory ids the reply disclosed (empty: used, not mentioned). */
  readonly disclosedContextIds: ReadonlyArray<string>;
  readonly authorityStatus: 'CURRENT';
  readonly systemSafetyStatus: 'NOT_EVALUATED';
  readonly launchGateStatus: 'NOT_EVALUATED';
  readonly deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY';
}

/**
 * The lane's readiness. A reply that is not READY is withheld exactly like a provider failure (§4): BLOCKED and
 * UNRESOLVED cool the items down for an hour (the judge would keep withholding them); STALE does not (consent or the
 * audience moved — the next reply re-reads them anyway).
 */
export type SharedMemberKnowledgeReadiness =
  | { readonly state: 'READY_FOR_LATER_DELIVERY_GATES'; readonly readiness: SharedMemberKnowledgeReadinessDetail }
  | { readonly state: 'BLOCKED' }
  | { readonly state: 'STALE' }
  | { readonly state: 'UNRESOLVED' };
