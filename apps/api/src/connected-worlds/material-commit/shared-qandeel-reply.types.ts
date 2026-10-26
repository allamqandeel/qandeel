// S4-02 — the request-driven Shared QANDEEL reply: its closed vocabulary and its two ports.
//
// The reply composition (`shared-qandeel-reply.service.ts`) runs the frozen I-03 chain end to end for one human request
// and hands the bound result to migration 0139's server-owned commit. It owns no provider and no Product route: the
// words come from a GENERATOR port the Shared World Product boundary implements over the provider-neutral Model Router,
// and the conversation it is given is exactly the Shared material every human of the CURRENT audience may see.
//
// Nothing here names a Personal source. S4-02 offers the frozen EffectiveContext NO private context candidate: no
// reviewed collector of Personal Standing Context exists, and neither does a Source Disclosure detector or a private
// source-state resolver (CW2-02 §58 defers them). So no Personal context can enter a Shared model call, and the two
// dependency contracts are bound to fail-closed implementations that are never reached with zero candidates.
//
// S8A-04 CP2 (Shared Social Memory Controlled Amendment §3): the generator also receives what the World already knows — the
// saved positions every current recipient may see, as labelled entries with no identity in them — and chooses, within the
// turn's existing slack, what the reply is given. It says which entries it gave; the composition maps them to places.

import type { SharedKnowledgeEntry } from '../../shared-world/shared-world-knowledge';

/** One Shared material as the REQUESTING member's Product read returns it (migration 0139). */
export interface SharedConversationMaterial {
  readonly materialId: string;
  readonly producer: 'HUMAN' | 'QANDEEL';
  /** The human author's legitimate visible Name, or null (QANDEEL, or a Name the account never set). */
  readonly authorName: string | null;
  readonly text: string;
  /** ISO instant; the canonical order of the World's history. */
  readonly establishedAt: string;
}

/**
 * One message of the conversation the generator receives.
 *
 * S8A-02 CP1 (Trusted Speaker & Message Provenance, 2026-10-22): who wrote a message is the author identity the frozen 0089
 * resolver returns for that exact `material_id`, never the Name and never anything in the words. The composition turns it
 * into a token that lives for this one request only, so two people with one Name, or with none, stay two people, and no
 * account or material identity crosses this boundary.
 */
export interface SharedReplyGenerationTurn {
  readonly producer: 'HUMAN' | 'QANDEEL';
  readonly authorName: string | null;
  readonly text: string;
  /** This message in this request: `M1`, `M2`, … in conversation order. Never a material identity. */
  readonly messageRef: string;
  /** The human author in this request: `S1`, `S2`, … by first appearance; null for QANDEEL. Never an account identity. */
  readonly speakerRef: string | null;
}

/**
 * What the generator receives: the exact-World conversation every current recipient may see, oldest first, ending with
 * the requesting human's committed message. No identifier, no audience, no authority and no private context.
 */
export interface SharedReplyGenerationInput {
  readonly conversation: ReadonlyArray<SharedReplyGenerationTurn>;
  /** The account the provider spend is attributed to (AI-COST-01): the human whose request started the generation. */
  readonly requesterUserId: string;
  /**
   * S8A-04 CP2 (AI-COST-01 as narrowed, §5): the World and the HUMAN_TEXT message the spend is correlated with. The begin
   * command verifies the requester wrote it; these identities only correlate spend and never reach a provider.
   */
  readonly source?: { readonly worldId: string; readonly materialId: string };
  /** S8A-04 CP2: the World's knowledge (K1…Kn, commit order), labelled with this request's labels. Empty: none. */
  readonly knowledge?: ReadonlyArray<SharedKnowledgeEntry>;
  /**
   * S8A-04 CP3: the items their owners allowed QANDEEL to use and mention here, admitted by I-03E for this exact audience
   * and listed by its Disclosure Authorization, each under its owner's label in this request. R4: `ref` is the request's
   * claim reference, present only when the item may be stated (inside its span); null: it may only shape the reply.
   * Absent when none was admitted.
   */
  readonly memberKnowledge?: ReadonlyArray<{ readonly owner: string; readonly ref: string | null; readonly item: string }>;
}

export type SharedReplyGeneration =
  /** `knowledgeRefs`: the knowledge entries the reply was given (S8A-04 CP2), possibly none. */
  | { readonly state: 'GENERATED'; readonly text: string; readonly knowledgeRefs?: ReadonlyArray<string> }
  | { readonly state: 'UNAVAILABLE' };

/** The words of one QANDEEL reply. Implemented by the Shared World Product boundary over the Model Router. */
export interface SharedQandeelReplyGenerator {
  generate(input: SharedReplyGenerationInput): Promise<SharedReplyGeneration>;
}
export const SHARED_QANDEEL_REPLY_GENERATOR = 'SHARED_QANDEEL_REPLY_GENERATOR' as const;

/** Why no QANDEEL reply was committed. Bounded internal classes; never user-facing text, never a participant or source. */
export const SHARED_QANDEEL_REPLY_REFUSALS = [
  'MALFORMED_REQUEST',
  /** Another request is generating the reply to this same command right now; its reply will appear on its own. */
  'WORK_IN_PROGRESS',
  /** The requesting human is at the in-flight bound or has spent the rolling work-start budget. */
  'WORK_LIMITED',
  /** No lease: not this human's command in this World, membership ended, or the conversation capability is closed. */
  'WORK_UNAVAILABLE',
  'CONTEXT_NOT_READY',
  'HISTORY_UNRESOLVED',
  'GENERATION_UNAVAILABLE',
  'DELIVERY_NOT_READY',
  'BINDING_REFUSED',
  'COMMIT_REFUSED',
  'COMMIT_STALE',
] as const;
export type SharedQandeelReplyRefusal = (typeof SHARED_QANDEEL_REPLY_REFUSALS)[number];

export type SharedQandeelReplyOutcome =
  /** `recalledPlaceIds` (S8A-04 CP2): the saved positions the reply was given; the reading after it receives them. */
  | { readonly state: 'COMMITTED'; readonly materialId: string; readonly recalledPlaceIds?: ReadonlyArray<string> }
  | { readonly state: 'UNAVAILABLE'; readonly reason: SharedQandeelReplyRefusal };
