// S8A-04 CP3 — Personal Knowledge in a Shared World: the closed vocabulary of the authorized-disclosure lane
// (QANDEEL_S8A-04_CP3_PERSONAL_KNOWLEDGE_IN_SHARED_WORLD_CONTROLLED_AMENDMENT v1.0, §2 – §4, approved for implementation
// by the Product Owner on 2026-10-25; the claim path of R4 / §11, the Product Owner's CP3-D V2 Final Implementation
// Contract of 2026-10-26).
//
// The frozen I-03 chain stays byte-identical. This lane is composed BESIDE it, never inside it:
//
//   consented items (0176 collector)
//     -> I-03E EffectiveContext, unchanged, over a per-request grant resolver that answers ONE item per owner
//     -> Disclosure Authorization (DA), built by the server from the 0176 disclosure grants of exactly those items
//     -> the claim table (`shared-claim-spans.ts`): a request ref only for an item in the DA whose owner the audience can
//        name unambiguously (0178); every other admitted item may inform the reply but never be stated
//     -> generation (a personal fact stated inside its span; everything else free text)
//     -> parse and render: the owners' Names written by the server; every later step sees the RENDERED text only
//     -> the frozen I-03G gate, unchanged, over a per-request detector that asks the checker ONCE per reply (R4-2)
//     -> I-03F, unchanged, over the per-request grant and source-state resolvers
//     -> the disclosure revalidation (the disclosure grants again, now)
//     -> the commit with consent (0176 `complete_shared_world_qandeel_reply_v2`, the consent re-checked under lock)
//
// A reply that states a consented item is never relabelled CLEAR: the gate's state is AUTHORIZED_DISCLOSURE, its status
// says the disclosure was detected within an authorization, and nothing here is a permission to deliver.

/** The 0176 service-role reads and acts this lane composes. */
export const SHARED_KNOWLEDGE_FOR_REPLY_RPC = 'list_shared_knowledge_for_reply_v1' as const;
export const SHARED_KNOWLEDGE_ITEM_RPC = 'resolve_shared_knowledge_item_v1' as const;
export const SHARED_KNOWLEDGE_COOL_DOWN_RPC = 'cool_down_shared_knowledge_v1' as const;
export const SHARED_KNOWLEDGE_PROPOSE_RPC = 'propose_shared_knowledge_request_v1' as const;
export const SHARED_QANDEEL_REPLY_COMMIT_V2_RPC = 'complete_shared_world_qandeel_reply_v2' as const;
/** The 0178 service-role read: the Name every member of a World's exact current audience is shown (R4-2 step 1). */
export const SHARED_AUDIENCE_NAMES_RPC = 'list_shared_audience_names_v1' as const;

/** The one consent scope of v1 (PO-2): use, and mention as the owner's. */
export const SHARED_KNOWLEDGE_DISCLOSURE_SCOPE = 'MENTION_ATTRIBUTED_TO_OWNER' as const;

/** The reasoning-dependency reference of one used item: its reasoning grant (0176 `reasoning_ref_v1`). */
export const sharedKnowledgeReasoningRef = (reasoningGrantId: string): string => `shared-knowledge:${reasoningGrantId.toLowerCase()}`;

/** One consented item, as the 0176 collector returns it: at most one per owner per reply. Server-only. */
export interface SharedMemberKnowledgeItem {
  readonly ownerUserId: string;
  /** The owner's Name, for the request's labels only (the rendered Name is 0178's). */
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
// The checker (R4-2 step 4, R4-4; amendment §11): ONE server-owned check of a reply that used personal knowledge, over the
// reply as its claim spans left it. A check that can only block; it decides no ownership and grants no disclosure.
// ---------------------------------------------------------------------------------------------------------------------

/** What the check is bound to: the operation, its audience and DA, and the digest of the text that will be delivered. */
export interface SharedDisclosureCheckBinding {
  readonly effectiveContextRef: string;
  readonly audienceSnapshotRef: string;
  readonly disclosureAuthorizationRef: string;
  /** The digest of the RENDERED reply (the owners' Names written in): the text every later gate and the commit carry. */
  readonly outputDigest: string;
}

/**
 * The checker's request (the `shared-claim-spans.ts` view): the reply with each span under its checker id (`⟦K1: …⟧`),
 * the span ids in order and the items under checker ids. It carries no Name, no request ref and no identity of any kind;
 * the call is made inside the AI-COST-01 scope of the verified author of the message the reply answers (correction 2).
 */
export interface SharedDisclosureCheckRequest {
  readonly binding: SharedDisclosureCheckBinding;
  readonly reply: string;
  readonly spans: ReadonlyArray<string>;
  readonly items: ReadonlyArray<{ readonly id: string; readonly item: string }>;
}

/** Who pays for the check: the sender of the answered message, its World and the message (begin_ai_provider_call_v2). */
export interface SharedDisclosureJudgePayer { readonly userId: string; readonly worldId: string; readonly materialId: string }

/** The checker's result as its adapter returns it: the model's answer (validated again by the lane), bound and referenced. */
export interface SharedDisclosureCheckResult {
  readonly state: 'CHECKED';
  readonly checkRef: string;
  readonly policyRef: string;
  readonly binding: SharedDisclosureCheckBinding;
  /** `{ spans, outside, sealed }` (`SharedClaimCheckerAnswer`); the lane validates every key against its own view. */
  readonly answer: unknown;
}

/**
 * The checker (the DI token keeps its CP3-B name and AI-COST-01 family, SHARED_DISCLOSURE_JUDGE). It returns `unknown` on
 * purpose: the lane validates every key itself, and anything else is UNRESOLVED.
 */
export interface SharedDisclosureJudge {
  judge(request: SharedDisclosureCheckRequest): Promise<unknown>;
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
  /** `coolDown`: only the items the checker found unsafe (R4-3), in admitted order. */
  | { readonly state: 'BLOCKED'; readonly reason: 'PROTECTED_SOURCE_DISCLOSURE_DETECTED'; readonly coolDown: ReadonlyArray<string> }
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
 * The lane's readiness. A reply that is not READY is withheld exactly like a provider failure (§4). R4-3: only BLOCKED
 * carries items to cool down, and only those the checker found unsafe; UNRESOLVED (a checker failure, a malformed span)
 * and STALE (consent or the audience moved) cool nothing. READY carries the RENDERED text: the only text the binder and the
 * commit may receive.
 */
export type SharedMemberKnowledgeReadiness =
  | { readonly state: 'READY_FOR_LATER_DELIVERY_GATES'; readonly readiness: SharedMemberKnowledgeReadinessDetail; readonly text: string }
  | { readonly state: 'BLOCKED'; readonly coolDown: ReadonlyArray<string> }
  | { readonly state: 'STALE' }
  | { readonly state: 'UNRESOLVED' };
