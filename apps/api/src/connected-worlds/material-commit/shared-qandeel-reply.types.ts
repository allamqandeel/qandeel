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
 * What the generator receives: the exact-World conversation every current recipient may see, oldest first, ending with
 * the requesting human's committed message. No identifier, no audience, no authority and no private context.
 */
export interface SharedReplyGenerationInput {
  readonly conversation: ReadonlyArray<{ readonly producer: 'HUMAN' | 'QANDEEL'; readonly authorName: string | null; readonly text: string }>;
  /** The account the provider spend is attributed to (AI-COST-01): the human whose request started the generation. */
  readonly requesterUserId: string;
}

export type SharedReplyGeneration =
  | { readonly state: 'GENERATED'; readonly text: string }
  | { readonly state: 'UNAVAILABLE' };

/** The words of one QANDEEL reply. Implemented by the Shared World Product boundary over the Model Router. */
export interface SharedQandeelReplyGenerator {
  generate(input: SharedReplyGenerationInput): Promise<SharedReplyGeneration>;
}
export const SHARED_QANDEEL_REPLY_GENERATOR = 'SHARED_QANDEEL_REPLY_GENERATOR' as const;

/** Why no QANDEEL reply was committed. Bounded internal classes; never user-facing text, never a participant or source. */
export const SHARED_QANDEEL_REPLY_REFUSALS = [
  'MALFORMED_REQUEST',
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
  | { readonly state: 'COMMITTED'; readonly materialId: string }
  | { readonly state: 'UNAVAILABLE'; readonly reason: SharedQandeelReplyRefusal };
