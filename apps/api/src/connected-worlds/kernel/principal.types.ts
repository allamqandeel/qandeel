// I-01A - Connected Worlds principal boundary.
//
// QANDEEL is a system actor, not a human member. Every ownership or consent
// position in the Connected Worlds kernel is therefore typed as HUMAN ONLY:
// there is deliberately no `Principal = Human | QANDEEL` union that consent or
// ownership contracts could be widened to accept. The system actor exists as a
// type solely so that its exclusion is provable at compile time and at runtime.
//
// This file is pure vocabulary. It performs no authorization lookup and knows
// nothing about the Personal runtime's `users` / auth subject model.

/** A human being who can own, join, invite, accept, consent or approve. */
export interface HumanPrincipal {
  readonly kind: 'HUMAN';
  /** Opaque human identity as the caller knows it. The kernel never derives or generates it. */
  readonly humanId: string;
}

/** QANDEEL itself, as a system actor. Never a member, owner, consent principal or approval substitute. */
export interface QandeelSystemActor {
  readonly kind: 'QANDEEL_SYSTEM';
}

/** The ONE system actor value. Frozen because it is a runtime constant compared by structure. */
export const QANDEEL_SYSTEM_ACTOR: QandeelSystemActor = Object.freeze({ kind: 'QANDEEL_SYSTEM' as const });

/** A principal that may OWN a World or World material. Humans only. */
export type OwnershipPrincipal = HumanPrincipal;

/** A principal that may CONSENT (accept, approve, admit, grant). Humans only. */
export type ConsentPrincipal = HumanPrincipal;

/**
 * A required human approval. The approver position accepts humans only, so
 * QANDEEL can never be substituted for a required human approval.
 */
export interface HumanApproval {
  readonly kind: 'HUMAN_APPROVAL';
  readonly approvedBy: ConsentPrincipal;
}
