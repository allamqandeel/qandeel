/**
 * T-06 — the explicitly bounded preview projection.
 *
 * A preview may show a legitimate historical target. It may show it ONLY through the same
 * disclosure path everything else uses, at the previewed position, and never through anything
 * derived from the position the reader is standing on.
 *
 * That is what makes no-hindsight structural here rather than aspirational:
 *
 *   - the projection asked for is `(Session, PTC, MC.depth)`. `K(PTC)` is what the server disclosed
 *     as known at `PTC`, so a later object simply is not in it. There is nothing to dim, ghost,
 *     grey out or "keep for stability", because there is nothing there;
 *   - `PTC` is gated by the same TWO rules as every other target — canonical Moment validity AND
 *     current disclosed interaction availability — BEFORE a lookup happens (R2-01). A position
 *     beyond `LH` is never asked about, and neither is a position that `LH` makes valid but nothing
 *     has disclosed. No future-history request exists in this layer, and none can be constructed
 *     through it;
 *   - the semantic depth is the one the camera CURRENTLY discloses. A preview never opens a rung the
 *     reader has not earned, and never one the reader has since left;
 *   - the answer keeps `NOT_FETCHED`, `UNAVAILABLE` and `disclosed-and-empty` apart, exactly as
 *     T-03C keeps them apart. A sparse or empty historical view is a CORRECT view, and this module
 *     never substitutes a fuller one from another position to make it look better.
 *
 * ## Where each authority comes from (R3-01)
 *
 * A `TemporalTargeting` carries two things: canonical `bounds` and a `disclosed` membership
 * authority. Only the second is taken from the caller. Canonical validity is ALWAYS re-derived from
 * the `CanonicalState` actually being projected, because a targeting value can be built from another
 * store, or from an older or newer snapshot of the same Session, and a caller-supplied `LH` must
 * never be able to widen what the current state permits. Matching Session ids are not evidence of a
 * matching Live Head.
 *
 * So the two are composed here: current bounds from the state, disclosed membership from the
 * authority, and the ONE shared rule decides. Disclosure can only ever narrow the answer — it is
 * asked second and it holds no `LH` of its own — so a stale, shorter Track refuses more, never less.
 *
 * ## Why there is no reusable authorization object (R3-02)
 *
 * Authorization is a fact about a moment in time: this Session, this position, this camera depth.
 * An object that recorded it and outlived it would be a replayable capability — still projecting at
 * a depth the camera has left, or for a Session that has been replaced — and a runtime brand would
 * only prove where it came from, never that it is still true.
 *
 * So the token and the low-level projector are module-private and the public surface is exactly two
 * functions, each of which authorizes against the CURRENT state synchronously and projects in the
 * same breath. There is nothing to hold, nothing to replay, and nothing whose freshness has to be
 * remembered by a caller.
 *
 * T-06 introduces no transport of its own. It reads what the projection boundary already holds,
 * through an injected lookup whose shape is exactly `HistoricalDisclosureCache.lookup`. This layer
 * therefore cannot fetch anything, cannot widen a disclosure horizon and cannot cache a second copy
 * of history. The cache legitimately holds projections the reader is not currently entitled to
 * interact with, so presence in it is evidence about what was once fetched and never authority about
 * what may be shown now.
 */
import type { HistoricalProjectionUnavailableCode } from '@qandeel/runtime';

import type { CanonicalState, SemanticDepth, SessionPosition } from '../../state';
import type { HistoricalDisclosureEntry } from '../../projection';
import {
  mapInspectionContext,
  type MapInspectionContext,
  type MapProjectionRequest,
  type MapSceneRejectionReason,
} from '../../map';
import { temporalBounds } from '../targeting/addressability';
import { resolveDisclosedTarget, type TemporalTargeting } from '../targeting/disclosed-availability';
import type { TemporalRejectionCode } from '../outcome';

/** Exactly the shape of the T-03C holder's own read. Nothing here fetches. */
export type PreviewDisclosureLookup = (sessionId: string, tc: number, depth: SemanticDepth) => HistoricalDisclosureEntry;

/**
 * A position a preview may look up, together with the exact projection it may ask for.
 *
 * Deliberately NOT exported: it is the momentary output of the gates, not a capability. It exists
 * only between authorization and the lookup that follows it in the same call.
 */
interface AuthorizedPreviewTarget {
  readonly sessionId: string;
  readonly tc: SessionPosition;
  readonly depth: SemanticDepth;
}

type PreviewTargetAuthorization =
  | { readonly ok: true; readonly target: AuthorizedPreviewTarget }
  | { readonly ok: false; readonly code: TemporalRejectionCode; readonly detail: string };

/**
 * The ONE gate a preview position passes to become lookup-able, evaluated against the state being
 * projected right now.
 *
 * Canonical bounds are derived here from that state and the caller's own `bounds` is discarded
 * (R3-01), so a targeting value carrying a later Live Head — from another store, or a newer snapshot
 * of the same Session — cannot widen what this state permits. The disclosed membership authority is
 * the only thing taken from the caller, and the shared rule checks its Session against the state's
 * own before admitting anything. The depth is read from canonical state, never from the caller.
 */
function authorizePreviewTarget(state: CanonicalState, targeting: TemporalTargeting, candidate: unknown): PreviewTargetAuthorization {
  if (targeting === null || typeof targeting !== 'object' || targeting.disclosed === undefined) {
    return { ok: false, code: 'INVALID_INPUT', detail: 'a disclosed targeting authority is required to preview a projection' };
  }
  // Current canonical bounds + the supplied disclosed membership. Disclosure can only narrow: it is
  // asked second and carries no Live Head of its own.
  const current: TemporalTargeting = { bounds: temporalBounds(state), disclosed: targeting.disclosed };
  const resolved = resolveDisclosedTarget(current, candidate);
  if (!resolved.ok) return { ok: false, code: resolved.code, detail: resolved.detail };

  return { ok: true, target: { sessionId: state.session.id, tc: resolved.sp, depth: state.camera.depth } };
}

export type PreviewProjection =
  /** The disclosure of the previewed position, and the scene derived from that same disclosure. */
  | { readonly status: 'PROJECTION'; readonly target: SessionPosition; readonly context: MapInspectionContext }
  /** The client has not obtained `V` for this position. It says NOTHING about history. */
  | { readonly status: 'NOT_FETCHED'; readonly target: SessionPosition; readonly request: MapProjectionRequest }
  /** The server's own typed refusal. Never "unknown", never an empty world. */
  | { readonly status: 'UNAVAILABLE'; readonly target: SessionPosition; readonly code: HistoricalProjectionUnavailableCode }
  | { readonly status: 'MALFORMED'; readonly target: SessionPosition; readonly reason: MapSceneRejectionReason; readonly detail: string }
  /** The position may not be previewed at all. No lookup was performed. */
  | { readonly status: 'NOT_ADDRESSABLE'; readonly code: TemporalRejectionCode; readonly detail: string };

function requestFor(target: AuthorizedPreviewTarget): MapProjectionRequest {
  return { sessionId: target.sessionId, tc: target.tc, depth: target.depth };
}

/** Projects a target the caller has just authorized, in the same call. Module-private by design. */
function projectAuthorized(target: AuthorizedPreviewTarget, lookup: PreviewDisclosureLookup): PreviewProjection {
  const request = requestFor(target);
  const entry = lookup(request.sessionId, request.tc, request.depth);
  const resolution = mapInspectionContext(entry, request);
  if (resolution.ok) return { status: 'PROJECTION', target: target.tc, context: resolution.context };

  const derivation = resolution.derivation;
  switch (derivation.status) {
    case 'PROJECTION_NOT_FETCHED':
      return { status: 'NOT_FETCHED', target: target.tc, request };
    case 'PROJECTION_UNAVAILABLE':
      return { status: 'UNAVAILABLE', target: target.tc, code: derivation.code };
    case 'REJECTED':
      return { status: 'MALFORMED', target: target.tc, reason: derivation.reason, detail: derivation.detail };
    default:
      // A derivation that produced a scene cannot reach here: `mapInspectionContext` returns `ok`
      // exactly then. Anything else is a defect and fails closed rather than guessing a world.
      return { status: 'MALFORMED', target: target.tc, reason: 'MALFORMED_WORLD', detail: 'the projection boundary produced no usable disclosure' };
  }
}

/**
 * The projection request a preview of `candidate` is entitled to make against THIS state, or `null`.
 * It cannot be derived from canonical state and a bare candidate, and it cannot be held: it is
 * recomputed from current state every time it is asked for.
 */
export function previewProjectionRequest(state: CanonicalState, targeting: TemporalTargeting, candidate: unknown): MapProjectionRequest | null {
  const authorization = authorizePreviewTarget(state, targeting, candidate);
  return authorization.ok ? requestFor(authorization.target) : null;
}

/**
 * Resolves the bounded preview projection for one previewed position. Both gates run FIRST, against
 * the state supplied to this very call, so an illegitimate position — canonically invalid, beyond
 * the current Live Head, or simply not disclosed — never reaches the lookup at all, whatever the
 * cache happens to be holding for it and whatever a caller's bounds snapshot happens to claim.
 */
export function previewProjection(
  state: CanonicalState,
  targeting: TemporalTargeting,
  candidate: unknown,
  lookup: PreviewDisclosureLookup,
): PreviewProjection {
  const authorization = authorizePreviewTarget(state, targeting, candidate);
  if (!authorization.ok) return { status: 'NOT_ADDRESSABLE', code: authorization.code, detail: authorization.detail };
  return projectAuthorized(authorization.target, lookup);
}
