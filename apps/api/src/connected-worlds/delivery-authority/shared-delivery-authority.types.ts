// I-03F - Shared delivery authority revalidation: result vocabulary.
//
// The runtime answer to exactly one post-generation question (CW2-02 §8, §22,
// §48; CW2-03 §48):
//
//   Is the EXACT previously generated Shared output still authority-current
//   against the EXACT SharedEffectiveContext that produced it?
//
// It is deliberately NOT the answer to "may this be delivered". CW2-02 §22
// freezes a delivery sequence with four gates before commit - Source
// Disclosure Gate, Authority Snapshot revalidation, Audience Snapshot
// revalidation, System / Safety policy check - and I-03F implements only the
// authority / audience / source-state portion. CW2-02 §58 explicitly defers
// the exact implementation of direct-source disclosure detection, so no
// detector, classifier, similarity threshold, redaction engine or provider
// self-declaration exists in this namespace, and none may be inferred from a
// CURRENT result.
//
// The CURRENT result therefore states structurally what it does NOT grant:
// source-disclosure safety is NOT_EVALUATED, system / safety policy is
// NOT_EVALUATED, and delivery / commit authority is NOT_GRANTED_BY_THIS
// BOUNDARY. The three positions frozen by I-03A and carried by I-03E -
// direct private disclosure, material disclosure and provenance disclosure -
// are restated unchanged (CW2-02 §19, §24, B15, B17): a freshness proof never
// widens them.
//
// There is deliberately no `deliveryAllowed`, `allowed`, `safe`,
// `sourceDisclosureSafe`, `publishAllowed` or `materialDisclosureAllowed`
// position representable anywhere in this vocabulary.

import type { SharedWorldId } from '../kernel/world.types';

/**
 * Known canonical state that makes the OLD generated result no longer
 * authority-current. Every reason is a bounded internal class: it names WHAT
 * class of authority moved, never which participant revoked, which owner's
 * source failed, which grant was absent or whether consent was revoked rather
 * than never given (CW2-02 §47, B33).
 */
export const SHARED_DELIVERY_AUTHORITY_STALE_REASONS = [
  'WORLD_STATE_CHANGED',
  'WORLD_READ_ONLY_CLOSED',
  'AUDIENCE_CHANGED',
  'NO_ACTIVE_HUMANS',
  'PRIVATE_AUTHORITY_CHANGED',
  'PRIVATE_SOURCE_CHANGED_OR_UNAVAILABLE',
] as const;
export type SharedDeliveryAuthorityStaleReason = (typeof SHARED_DELIVERY_AUTHORITY_STALE_REASONS)[number];

/**
 * The required current authority / source state could not be safely
 * established, or the supplied envelope is not the frozen I-03E shape. Never
 * user-facing text and never a raw exception, response body, upstream failure
 * string or secret.
 */
export const SHARED_DELIVERY_AUTHORITY_UNRESOLVED_REASONS = [
  'MALFORMED_EFFECTIVE_CONTEXT',
  'WORLD_STATE_UNRESOLVED',
  'AUDIENCE_UNRESOLVED',
  'PRIVATE_AUTHORITY_UNRESOLVED',
  'PRIVATE_SOURCE_STATE_UNRESOLVED',
] as const;
export type SharedDeliveryAuthorityUnresolvedReason = (typeof SHARED_DELIVERY_AUTHORITY_UNRESOLVED_REASONS)[number];

/**
 * The successful result: authority freshness, and nothing else.
 *
 * It is bound to ONE exact operation - one EffectiveContext, one output
 * identity, one World state, one audience snapshot - and is not a bearer
 * permission (CW2-02 §7, B6). It carries no raw output, no private content, no
 * per-owner grant status, no clock, no random identity and no secret.
 */
export interface SharedDeliveryAuthorityCurrent {
  /** `sha256:<64 lowercase hex>` binding the envelope, the exact output identity and every revalidated current fact. */
  readonly revalidationRef: string;
  readonly effectiveContextRef: string;
  /** `sha256:<64 lowercase hex>` over the exact UTF-8 provider output. Never the output itself. */
  readonly outputDigest: string;
  readonly targetWorldId: SharedWorldId;
  /** The CURRENT World-state reference, which equals the envelope's or this result would not exist. */
  readonly worldStateSnapshotRef: string;
  /** The CURRENT audience-snapshot reference, which equals the envelope's or this result would not exist. */
  readonly audienceSnapshotRef: string;
  readonly authorityStatus: 'CURRENT';
  /** CW2-02 §20 / §58: the Narrow Source Disclosure Gate is a separate, deferred boundary. This result asserts nothing about it. */
  readonly sourceDisclosureAuthority: 'NOT_EVALUATED';
  /** CW2-02 §22 / §46: the System / Safety policy check is a separate boundary that may only narrow, never manufacture, authority (B31). */
  readonly systemSafetyAuthority: 'NOT_EVALUATED';
  /** CW2-02 §22: delivery / commit is the gate AFTER every check. Freshness is a precondition of it, never a grant of it. */
  readonly deliveryCommitAuthority: 'NOT_GRANTED_BY_THIS_BOUNDARY';
  /** Restated from the frozen I-03A ALLOW constraints, unchanged (CW2-02 §19, B15). */
  readonly directPrivateDisclosureAuthority: 'NOT_GRANTED';
  /** Restated from the frozen I-03A ALLOW constraints, unchanged (CW2-02 §25, B18). */
  readonly materialDisclosureAuthority: 'NOT_GRANTED';
  /** Restated from the frozen I-03A ALLOW constraints, unchanged (CW2-02 §24, B17). */
  readonly provenanceDisclosure: 'SEALED';
}

/**
 * The three-state answer:
 *
 *   CURRENT    - every authority-relevant fact was revalidated and still
 *                matches the exact generation envelope;
 *   STALE      - current canonical facts are KNOWN and the old generated
 *                result is no longer current-authorized. It must be discarded
 *                or regenerated under current authority (CW2-02 §8);
 *   UNRESOLVED - required current authority / source state is not safely
 *                knowable, or the supplied envelope is malformed.
 *
 * STALE and UNRESOLVED both block, and are never collapsed into each other:
 * "the world moved" and "we cannot tell" are different facts, and only the
 * first tells a caller that regenerating will help.
 */
export type SharedDeliveryAuthorityRevalidation =
  | { readonly state: 'CURRENT'; readonly revalidation: SharedDeliveryAuthorityCurrent }
  | { readonly state: 'STALE'; readonly reason: SharedDeliveryAuthorityStaleReason }
  | { readonly state: 'UNRESOLVED'; readonly reason: SharedDeliveryAuthorityUnresolvedReason };
