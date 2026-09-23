// I-01A - Connected Worlds world taxonomy.
//
// Connected Worlds is an ADDITIVE domain beside the frozen Personal runtime,
// not a generalization of it. Nothing here references `conversation_sessions`,
// the Personal `ConversationService`, the Personal `CanonicalStore`, or
// `@qandeel/runtime`. MY_WORLD is named so that the taxonomy is complete; its
// observable Personal semantics are owned elsewhere and are not restated here.
//
// This file is closed vocabulary only: literal unions, readonly contracts and
// the one branded identity that a Shared World receives at birth.

import type { OwnershipPrincipal } from './principal.types';

/**
 * The five architecture classes. No class inherits another class's audience,
 * ownership, lifecycle or authority merely because implementations later share
 * infrastructure; every kernel object names its class explicitly.
 */
export const ARCHITECTURE_CLASSES = [
  'WORLD',
  'CAPABILITY',
  'MATERIAL_ARTIFACT',
  'USER_STATE',
  'RELATIONSHIP_STATE',
] as const;
export type ArchitectureClass = (typeof ARCHITECTURE_CLASSES)[number];

/** Exactly three World types. There is no fourth World. */
export const WORLD_TYPES = ['MY_WORLD', 'SHARED_WORLD', 'PUBLIC_WORLD'] as const;
export type WorldType = (typeof WORLD_TYPES)[number];

/**
 * Names that are explicitly NOT World types. They are listed so the boundary is
 * structural and testable rather than a matter of convention:
 *
 *   REPLAY            - a source-bound derived artifact (CW2-01 §31)
 *   MATCHING          - a capability initiated from MY_WORLD (I-00 §17, CW2-01 §2)
 *   INTRODUCTION      - a Shared World PHASE, never a World type (CW2-01 A7)
 *   PUBLIC_EXPERIENCE - a bounded published object inside the Public World (CW2-01 §6)
 *   INVITATION        - prospective state before a Shared birth (CW2-01 §5)
 *   DISCUSSION        - public discussion under a parent Public Experience (CW2-01 §29)
 *
 * The kernel classifies these as non-World only. It does not assign each a
 * further architecture class where the task contract does not fix one.
 */
export const NON_WORLD_KINDS = [
  'REPLAY',
  'MATCHING',
  'INTRODUCTION',
  'PUBLIC_EXPERIENCE',
  'INVITATION',
  'DISCUSSION',
] as const;
export type NonWorldKind = (typeof NON_WORLD_KINDS)[number];

// Compile-time proof that the two closed sets are disjoint: the intersection of
// two disjoint literal unions is `never`, and `never` is the only type that
// satisfies this constraint.
type AssertNever<T extends never> = T;
export type WorldTypesAndNonWorldKindsAreDisjoint = AssertNever<WorldType & NonWorldKind>;

declare const SHARED_WORLD_ID_BRAND: unique symbol;
/**
 * A Shared World identity. It is a branded string that ONLY a valid Shared World
 * birth (`attemptSharedWorldBirth` in `world-invariants.ts`) produces, so a
 * prospective invitation or a pending Matching proposal can never carry one.
 * The kernel brands a caller-supplied identifier; it generates no UUID.
 */
export type SharedWorldId = string & { readonly [SHARED_WORLD_ID_BRAND]: 'SharedWorldId' };

/** The existing Personal world of exactly one human owner. Semantics owned by the frozen Personal runtime. */
export interface MyWorldRef {
  readonly architectureClass: 'WORLD';
  readonly worldType: 'MY_WORLD';
  readonly owner: OwnershipPrincipal;
}

/** A born Shared World, addressed by the identity its birth produced. */
export interface SharedWorldRef {
  readonly architectureClass: 'WORLD';
  readonly worldType: 'SHARED_WORLD';
  readonly worldId: SharedWorldId;
}

/** The Public World. Its bounded published objects (Public Experiences) are NOT Worlds. */
export interface PublicWorldRef {
  readonly architectureClass: 'WORLD';
  readonly worldType: 'PUBLIC_WORLD';
}

export type WorldRef = MyWorldRef | SharedWorldRef | PublicWorldRef;

/**
 * The outcome of asking whether a name denotes a World. Unknown names are NOT
 * Worlds: classification fails closed.
 */
export type WorldClassification =
  | { readonly verdict: 'WORLD'; readonly worldType: WorldType }
  | { readonly verdict: 'NOT_A_WORLD'; readonly kind: NonWorldKind }
  | { readonly verdict: 'UNKNOWN' };
