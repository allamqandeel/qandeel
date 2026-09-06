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
 *   - the semantic depth is the one the camera already discloses. A preview never opens a rung the
 *     reader has not earned;
 *   - the answer keeps `NOT_FETCHED`, `UNAVAILABLE` and `disclosed-and-empty` apart, exactly as
 *     T-03C keeps them apart. A sparse or empty historical view is a CORRECT view, and this module
 *     never substitutes a fuller one from another position to make it look better.
 *
 * ## Why the cache is not an authority (R2-01)
 *
 * The disclosure cache legitimately holds projections the reader is not currently entitled to
 * interact with — a projection fetched while the Track was longer, or one held for a position the
 * current disclosed prefix has not reached. Presence in the cache is therefore evidence about what
 * was once fetched, never about what may be shown now, and the lookup is not consulted until the
 * target has already been authorized. `authorizePreviewTarget` is the only way to reach it, and the
 * token it mints is branded at runtime, so a caller cannot hand-assemble one.
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
import { resolveDisclosedTarget, type TemporalTargeting } from '../targeting/disclosed-availability';
import type { TemporalRejectionCode } from '../outcome';

/** Exactly the shape of the T-03C holder's own read. Nothing here fetches. */
export type PreviewDisclosureLookup = (sessionId: string, tc: number, depth: SemanticDepth) => HistoricalDisclosureEntry;

/**
 * A position a preview is allowed to look up. It exists only as the output of the two gates, and it
 * is branded at runtime, so possessing one IS the proof that both were passed.
 */
export interface AuthorizedPreviewTarget {
  readonly sessionId: string;
  readonly tc: SessionPosition;
  readonly depth: SemanticDepth;
}

export type PreviewTargetAuthorization =
  | { readonly ok: true; readonly target: AuthorizedPreviewTarget }
  | { readonly ok: false; readonly code: TemporalRejectionCode; readonly detail: string };

const authorized = new WeakSet<object>();

/** True only for a token this module minted. A structural look-alike is not an authorization. */
export function isAuthorizedPreviewTarget(value: unknown): value is AuthorizedPreviewTarget {
  return typeof value === 'object' && value !== null && authorized.has(value as object);
}

/**
 * The ONE way a preview position becomes lookup-able.
 *
 * The targeting authority must belong to the same Session as the canonical state it is judged
 * against — a targeting built for another store proves nothing about this one — and then the shared
 * interaction gate decides. The depth is read from canonical state rather than from the caller, so
 * a preview can never ask for a rung the camera does not currently disclose.
 */
export function authorizePreviewTarget(
  state: CanonicalState,
  targeting: TemporalTargeting,
  candidate: unknown,
): PreviewTargetAuthorization {
  if (targeting === null || typeof targeting !== 'object') {
    return { ok: false, code: 'INVALID_INPUT', detail: 'a disclosed targeting authority is required to preview a projection' };
  }
  if (targeting.bounds.sessionId !== state.session.id) {
    return {
      ok: false,
      code: 'SESSION_MISMATCH',
      detail: `the targeting authority covers Session ${targeting.bounds.sessionId}; this state mirrors ${state.session.id}`,
    };
  }
  // Canonical validity, then disclosed membership — the same rule, in the same order, as every other
  // route. A canonically valid but undisclosed position is refused here, before any lookup exists.
  const resolved = resolveDisclosedTarget(targeting, candidate);
  if (!resolved.ok) return { ok: false, code: resolved.code, detail: resolved.detail };

  const target: AuthorizedPreviewTarget = Object.freeze({
    sessionId: state.session.id,
    tc: resolved.sp,
    depth: state.camera.depth,
  });
  authorized.add(target);
  return { ok: true, target };
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

/**
 * The projection request an authorized preview target is entitled to make. It cannot be derived from
 * canonical state and a candidate alone (R2-01): without the disclosed authority there is no request.
 */
export function previewProjectionRequest(state: CanonicalState, targeting: TemporalTargeting, candidate: unknown): MapProjectionRequest | null {
  const authorization = authorizePreviewTarget(state, targeting, candidate);
  return authorization.ok ? requestFor(authorization.target) : null;
}

function requestFor(target: AuthorizedPreviewTarget): MapProjectionRequest {
  return { sessionId: target.sessionId, tc: target.tc, depth: target.depth };
}

/**
 * Projects an ALREADY authorized target. The brand is re-checked here, so this cannot be used to
 * skip the gates by handing it a plausible-looking object.
 */
export function projectAuthorizedPreviewTarget(target: AuthorizedPreviewTarget, lookup: PreviewDisclosureLookup): PreviewProjection {
  if (!isAuthorizedPreviewTarget(target)) {
    return { status: 'NOT_ADDRESSABLE', code: 'INVALID_INPUT', detail: 'the preview target was not authorized against the disclosed Track' };
  }
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
 * Resolves the bounded preview projection for one previewed position. Both gates run FIRST, so an
 * illegitimate position — canonically invalid, beyond the Live Head, or simply not disclosed — never
 * reaches the lookup at all, whatever the cache happens to be holding for it.
 */
export function previewProjection(
  state: CanonicalState,
  targeting: TemporalTargeting,
  candidate: unknown,
  lookup: PreviewDisclosureLookup,
): PreviewProjection {
  const authorization = authorizePreviewTarget(state, targeting, candidate);
  if (!authorization.ok) return { status: 'NOT_ADDRESSABLE', code: authorization.code, detail: authorization.detail };
  return projectAuthorizedPreviewTarget(authorization.target, lookup);
}
