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
 *   - `PTC` is gated by the same addressability rule as every other target BEFORE a lookup happens,
 *     so a position beyond `LH` is never even asked about. No future-history request exists in this
 *     layer, and none can be constructed through it;
 *   - the semantic depth is the one the camera already discloses. A preview never opens a rung the
 *     reader has not earned;
 *   - the answer keeps `NOT_FETCHED`, `UNAVAILABLE` and `disclosed-and-empty` apart, exactly as
 *     T-03C keeps them apart. A sparse or empty historical view is a CORRECT view, and this module
 *     never substitutes a fuller one from another position to make it look better.
 *
 * T-06 introduces no transport of its own. It reads what the projection boundary already holds,
 * through an injected lookup whose shape is exactly `HistoricalDisclosureCache.lookup`. This layer
 * therefore cannot fetch anything, cannot widen a disclosure horizon and cannot cache a second copy
 * of history.
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
import { resolveTemporalTarget, temporalBounds } from '../targeting/addressability';
import type { TemporalRejectionCode } from '../outcome';

/** Exactly the shape of the T-03C holder's own read. Nothing here fetches. */
export type PreviewDisclosureLookup = (sessionId: string, tc: number, depth: SemanticDepth) => HistoricalDisclosureEntry;

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

/**
 * The projection request a preview of `candidate` is entitled to make, or `null` when it is not
 * entitled to make one. The depth is the camera's current rung and the Session is the store's own:
 * a preview changes neither, so neither may be chosen here.
 */
export function previewProjectionRequest(state: CanonicalState, candidate: unknown): MapProjectionRequest | null {
  const resolved = resolveTemporalTarget(temporalBounds(state), candidate);
  return resolved.ok ? { sessionId: state.session.id, tc: resolved.sp, depth: state.camera.depth } : null;
}

/**
 * Resolves the bounded preview projection for one previewed position. The addressability gate runs
 * FIRST, so an illegitimate position never reaches the lookup at all.
 */
export function previewProjection(state: CanonicalState, candidate: unknown, lookup: PreviewDisclosureLookup): PreviewProjection {
  const resolved = resolveTemporalTarget(temporalBounds(state), candidate);
  if (!resolved.ok) return { status: 'NOT_ADDRESSABLE', code: resolved.code, detail: resolved.detail };

  const target = resolved.sp;
  const request: MapProjectionRequest = { sessionId: state.session.id, tc: target, depth: state.camera.depth };
  const entry = lookup(request.sessionId, request.tc, request.depth);
  const resolution = mapInspectionContext(entry, request);
  if (resolution.ok) return { status: 'PROJECTION', target, context: resolution.context };

  const derivation = resolution.derivation;
  switch (derivation.status) {
    case 'PROJECTION_NOT_FETCHED':
      return { status: 'NOT_FETCHED', target, request };
    case 'PROJECTION_UNAVAILABLE':
      return { status: 'UNAVAILABLE', target, code: derivation.code };
    case 'REJECTED':
      return { status: 'MALFORMED', target, reason: derivation.reason, detail: derivation.detail };
    default:
      // A derivation that produced a scene cannot reach here: `mapInspectionContext` returns `ok`
      // exactly then. Anything else is a defect and fails closed rather than guessing a world.
      return { status: 'MALFORMED', target, reason: 'MALFORMED_WORLD', detail: 'the projection boundary produced no usable disclosure' };
  }
}
