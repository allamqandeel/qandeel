// T-03B2b1 - Canonical Home Placement Engine v1 (QANDEEL OSDAP v1): the frozen
// domain types.
//
// This directory is the second slice of canonical Product task T-03B2 (Thread
// Establishment). Architecture split T-03B2b before coding because choosing the
// canonical Home placement encoding is itself PERMANENT world architecture:
// once an Established Thread receives its Home, later code may never move it,
// recalculate it, swap it, re-layout it, or migrate it to a "better" algorithm.
// This slice is PURE and PRODUCTION-INERT: no migration, no Thread row, no Home
// row, no Thread identity allocation, no service-role RPC, no Nest wiring, no
// provider call, no mobile change, no lifecycle write, no LF. It exists so an
// unsuitable geography algorithm can be rejected BEFORE any permanent user
// world state depends on it. T-03B2b2 owns durability; T-03B2b3 owns runtime
// orchestration.
//
// Frozen spatial truth this engine preserves (Stage 2 / Stage 6):
//   - every Established Thread receives exactly ONE permanent Home Anchor;
//     Emerging Focus receives none;
//   - same Thread -> same Home -> same Canonical Spatial Address -> same
//     canonical placement; refinement and reopening never reposition;
//   - world growth is append-oriented: new geography adapts to old geography,
//     old geography never moves ("outward" = acquire previously uncommitted
//     canonical world space without rewriting established placement);
//   - Conversational Origin is placement INPUT / provenance - never parenthood,
//     hierarchy, causality, semantic relation, ownership or mandatory adjacency;
//   - spatial proximity carries NO analytical meaning by default; no semantic,
//     importance, similarity, confidence, popularity, viewport or device value
//     may influence geography.
//
// Everything below is an implementation ENCODING (Engineering decision
// ED-B2B1-01), not Product semantics. The constants define placement
// viability only.

/**
 * The canonical scheme id. It is part of the permanent place identity
 * (`scheme + x + y`, combined later with the permanent `home_anchor_id`), so a
 * different scheme is a different world encoding and can never be silently
 * substituted for this one.
 */
export const CANONICAL_HOME_PLACEMENT_SCHEME = 'QANDEEL_OSDAP_V1' as const;
export type CanonicalHomePlacementScheme = typeof CANONICAL_HOME_PLACEMENT_SCHEME;

/** Engine identity, recorded as provenance by later slices. */
export const CANONICAL_HOME_PLACEMENT_ENGINE_VERSION = 'canonical-home-placement-engine-v1' as const;

/**
 * The domain separator of every per-attempt digest. It binds the candidate
 * entropy to this scheme: any other domain string yields a different candidate
 * sequence for the same request, so the golden vectors cannot be reproduced by
 * a substituted engine.
 */
export const OSDAP_DIGEST_DOMAIN = 'qandeel-osdap-v1' as const;

/** Exact signed integer world coordinate. Never a JavaScript `number`. */
export type WorldCoord = bigint;

/**
 * Technical storage / implementation bound of a canonical coordinate. This is
 * NOT a Product "edge of the world": exhausting it fails closed
 * (`CANONICAL_PLACEMENT_CAPACITY_EXHAUSTED`); nothing is ever clamped or wrapped.
 */
export const MIN_COORD: WorldCoord = -(2n ** 62n);
export const MAX_COORD: WorldCoord = 2n ** 62n - 1n;

/** v1 Engineering constants - placement viability only, never Product quantities. */
export const HOME_STEP: WorldCoord = 1_000_000n;
export const MIN_HOME_SEPARATION: WorldCoord = 250_000n;
export const CANDIDATES_PER_SHELL = 32 as const;
export const MAX_ATTEMPTS = 8192 as const;

/**
 * The closed Conversational Origin vocabulary. Origin guides the search datum
 * and nothing else. There is no fake primary origin: MULTIPLE and AMBIGUOUS are
 * handled symmetrically over ALL grounded members.
 */
export const CONVERSATIONAL_ORIGIN_STATES = Object.freeze(['NONE', 'RESOLVED', 'MULTIPLE', 'AMBIGUOUS'] as const);
export type ConversationalOriginState = (typeof CONVERSATIONAL_ORIGIN_STATES)[number];

/**
 * The identity shape this engine accepts for a user/world owner id and a Thread
 * id: a closed ASCII charset without whitespace, control characters or the `|`
 * digest separator, so every canonical serialization is injective. RFC 4122
 * UUIDs satisfy it. T-03B2b2 owns the actual identity allocation.
 */
export const CANONICAL_IDENTITY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

/** One committed, permanent Home Anchor of an Established Thread. Read-only input. */
export interface CanonicalExistingHome {
  readonly threadId: string;
  readonly x: WorldCoord;
  readonly y: WorldCoord;
}

/**
 * Conversational Origin as placement input. Every referenced Home must be one of
 * the request's `existingHomes`, with identical coordinates. Duplicates and
 * unknown members are rejected. AMBIGUOUS does not claim every candidate is a
 * true origin; it lets the then-known ambiguous state guide geography
 * conservatively without electing a fake primary.
 */
export type ConversationalOrigin =
  | { readonly state: 'NONE' }
  | { readonly state: 'RESOLVED'; readonly homes: readonly [CanonicalExistingHome] }
  | { readonly state: 'MULTIPLE'; readonly homes: readonly CanonicalExistingHome[] }
  | { readonly state: 'AMBIGUOUS'; readonly homes: readonly CanonicalExistingHome[] };

/**
 * The closed, typed placement request. Exactly these four fields, at runtime
 * as well as in TypeScript: no CU text, no label, no path, no relation, no
 * count, no confidence, no viewport, no extension bag.
 */
export interface HomePlacementRequest {
  /** v1 = the canonical user / world owner id. */
  readonly userWorldId: string;
  readonly newThreadId: string;
  readonly origin: ConversationalOrigin;
  readonly existingHomes: readonly CanonicalExistingHome[];
}

/**
 * The canonical placement result. The place identity is `scheme + x + y`;
 * `attempt`, the base and the fingerprints are establishment provenance /
 * reproducibility data. No rendered pixels, no viewport, no parent.
 */
export interface CanonicalHomePlacement {
  readonly scheme: CanonicalHomePlacementScheme;
  readonly x: WorldCoord;
  readonly y: WorldCoord;
  /** Zero-based index of the first admissible candidate in attempt order. */
  readonly attempt: number;
  readonly baseX: WorldCoord;
  readonly baseY: WorldCoord;
  /** sha256 hex over the canonical serialization of the then-existing world. */
  readonly worldFingerprint: string;
  /** sha256 hex over the canonical serialization of the origin state and members. */
  readonly originFingerprint: string;
}

/** The closed rejection vocabulary. Every failure is typed and closed; nothing is guessed. */
export const CANONICAL_HOME_PLACEMENT_REJECTION_REASONS = Object.freeze([
  /** The request, an origin or a Home is not exactly the closed typed shape. */
  'INVALID_PLACEMENT_INPUT',
  /** The same Thread id appears twice among the existing Homes. */
  'DUPLICATE_EXISTING_THREAD_ID',
  /** Two existing Homes share one canonical placement: a malformed world. */
  'DUPLICATE_EXISTING_PLACEMENT',
  /** An existing Home lies outside the technical coordinate bound: a malformed world. */
  'EXISTING_HOME_OUT_OF_BOUNDS',
  /** The new Thread already has a Home: the engine is called only for NEW establishment. */
  'THREAD_ALREADY_PLACED',
  /** RESOLVED without exactly one member, or MULTIPLE / AMBIGUOUS with fewer than two. */
  'INVALID_ORIGIN_CARDINALITY',
  /** The same Thread appears twice among the origin members. */
  'DUPLICATE_ORIGIN_HOME',
  /** An origin member is not one of the existing Homes. */
  'UNKNOWN_ORIGIN_HOME',
  /** An origin member names an existing Home but carries different coordinates. */
  'ORIGIN_HOME_MISMATCH',
  /** No admissible candidate within MAX_ATTEMPTS, or the technical bound is exhausted. */
  'CANONICAL_PLACEMENT_CAPACITY_EXHAUSTED',
] as const);
export type CanonicalHomePlacementRejectionReason = (typeof CANONICAL_HOME_PLACEMENT_REJECTION_REASONS)[number];

export class CanonicalHomePlacementRejectedError extends Error {
  constructor(
    readonly reason: CanonicalHomePlacementRejectionReason,
    /** The offending list element, or -1 when the failure is not element-local. */
    readonly index: number = -1,
  ) {
    super(`Canonical Home placement was rejected: ${reason}.`);
    this.name = 'CanonicalHomePlacementRejectedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * The consumer-side resolution of a Thread's Home. A Thread that already holds a
 * committed Home keeps it on every later occasion (refinement, dormancy,
 * reopening, return); only a Thread without one is placed, once.
 */
export type ThreadHomeResolution =
  | { readonly outcome: 'COMMITTED_HOME_KEPT'; readonly home: CanonicalExistingHome }
  | { readonly outcome: 'NEW_HOME_PLACED'; readonly placement: CanonicalHomePlacement };
