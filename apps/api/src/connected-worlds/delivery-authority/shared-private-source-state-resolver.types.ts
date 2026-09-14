// I-03F - the narrow server-owned private source-state boundary CONTRACT.
//
// Delivery-time authority revalidation needs one fact about each private
// MY_WORLD source an already-generated Shared result depended on (CW2-02 §54,
// §48; CW2-03 §37):
//
//   is that exact source still available, and is it still the exact content
//   the EffectiveContext was built from?
//
// Connected Worlds does not own the Personal source persistence schema, so
// this file declares a DEPENDENCY CONTRACT and nothing else. There is
// deliberately no implementation, no adapter, no table, no SQL, no transport
// and no Nest provider registration here: I-03F must not generalize Personal
// persistence or create a cross-world private-content store merely to support
// revalidation (task I-03F §20, §34).
//
// What the contract structurally cannot carry:
//
//   - raw private content, source text, memory or conversation payload: the
//     AVAILABLE branch carries a DIGEST, never the bytes (task §21);
//   - a client JWT, access token or any caller credential;
//   - a client-supplied availability or a client-supplied digest: the answer is
//     the server's, and the caller passes only the canonical source identity;
//   - an audience, a disclosure permission or any authority position - source
//     availability is a FACT, never a permission (CW2-02 B1, B18).
//
// The single parameter is the frozen I-03E `PrivateSourceContextRef`, which is
// a MY_WORLD-origin source context reference and carries exactly the source
// identity `(origin MY_WORLD owner, contextId)`.

import type { PrivateSourceContextRef } from '../effective-context/shared-effective-context.types';

/** Bounded internal reasons current source state could not be safely established. Never user-facing text (CW2-02 §47). */
export const SHARED_PRIVATE_SOURCE_STATE_RESOLUTION_FAILURES = [
  'LOOKUP_FAILED',
  'LOOKUP_TIMED_OUT',
  'SOURCE_STATE_UNAVAILABLE',
  'CONTRADICTORY_CANONICAL_STATE',
] as const;
export type SharedPrivateSourceStateResolutionFailure = (typeof SHARED_PRIVATE_SOURCE_STATE_RESOLUTION_FAILURES)[number];

/**
 * What the server established about one exact private source right now:
 *
 *   AVAILABLE        - the source still exists and its current content identity
 *                      is exactly `contentDigest` (`sha256:<64 lowercase hex>`
 *                      over the exact UTF-8 source bytes, the frozen I-03E
 *                      digest form). No content accompanies it;
 *   DELETED_BY_OWNER - the owner deleted the source (CW2-03 §37, CW2-02 §27);
 *   UNAVAILABLE      - the source exists but its content cannot currently be
 *                      used (kernel `ContentAvailability`);
 *   UNRESOLVED       - current source state could not be safely established.
 *
 * Known absence (DELETED_BY_OWNER / UNAVAILABLE) and unknown state
 * (UNRESOLVED) are never collapsed into each other: the first makes an already
 * generated result STALE, the second makes revalidation UNRESOLVED.
 */
export type SharedPrivateSourceStateResolution =
  | { readonly state: 'AVAILABLE'; readonly contentDigest: string }
  | { readonly state: 'DELETED_BY_OWNER' }
  | { readonly state: 'UNAVAILABLE' }
  | { readonly state: 'UNRESOLVED'; readonly failure: SharedPrivateSourceStateResolutionFailure };

/**
 * The server-owned resolver I-03F depends on. An implementation belongs to
 * whichever later slice owns Personal source-state exposure; I-03F provides
 * none and tests supply a fake.
 */
export interface SharedPrivateSourceStateResolver {
  resolveCurrent(source: PrivateSourceContextRef): Promise<SharedPrivateSourceStateResolution>;
}

/** The injection token for the contract above. An interface is not a runtime value, so the dependency needs a name. */
export const SHARED_PRIVATE_SOURCE_STATE_RESOLVER = 'SHARED_PRIVATE_SOURCE_STATE_RESOLVER' as const;
