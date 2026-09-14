// I-03D - Shared human audience resolution: result vocabulary.
//
// The runtime answer to exactly one pre-model question (CW2-02 §21, step
// "Resolve exact Audience Snapshot"; CW2-02 §6, §44):
//
//   What is the exact CURRENT human participant audience of exact Shared World
//   W under canonical membership state, and what immutable snapshot reference
//   identifies that exact membership state?
//
// The audience family is FULL_CURRENT_SHARED_HUMAN_AUDIENCE only. The snapshot
// itself is the frozen I-03A `SharedHumanAudienceSnapshot`; no competing
// snapshot shape exists here. Current membership is audience identity only -
// it is not historical-material access (CW2-01 A9, CW2-02 B21), not a Standing
// Context grant ceiling, not permission to generate, deliver or disclose.

import type { SharedHumanAudienceSnapshot } from '../authority/standing-context-authority.types';

/** Bounded internal reasons the current audience could not be safely established. Never user-facing text (CW2-02 §47). */
export const SHARED_HUMAN_AUDIENCE_RESOLUTION_FAILURES = [
  'LOOKUP_FAILED',
  'LOOKUP_TIMED_OUT',
  'AUDIENCE_SNAPSHOT_UNAVAILABLE',
  'CONTRADICTORY_CANONICAL_STATE',
] as const;
export type SharedHumanAudienceResolutionFailure = (typeof SHARED_HUMAN_AUDIENCE_RESOLUTION_FAILURES)[number];

/**
 * What the canonical lookup established for the exact World:
 *
 *   RESOLVED   - the lookup completed and found one or more current humans; the
 *                snapshot is the frozen I-03A contract, directly consumable by
 *                the I-03A evaluator as `audienceSnapshot`;
 *   EMPTY      - the canonical World exists, the lookup completed successfully
 *                and zero current open membership episodes exist. No I-03A
 *                snapshot is manufactured, because that contract requires a
 *                non-empty audience; the reference still identifies the exact
 *                (World, no members) state;
 *   UNRESOLVED - the current audience could not be safely established:
 *                malformed input, missing server configuration, timeout,
 *                transport failure, a noncanonical World, or a malformed /
 *                contradictory payload.
 *
 * Known absence (EMPTY) and unknown state (UNRESOLVED) are never collapsed into
 * each other.
 */
export type SharedHumanAudienceResolution =
  | { readonly state: 'RESOLVED'; readonly snapshot: SharedHumanAudienceSnapshot }
  | { readonly state: 'EMPTY'; readonly snapshotRef: string }
  | { readonly state: 'UNRESOLVED'; readonly failure: SharedHumanAudienceResolutionFailure };
