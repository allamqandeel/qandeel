/**
 * T-08 — the one read-only orientation model, and the gate every semantic answer in it passes.
 *
 * ## Freshness before meaning
 *
 * The order is the whole design, and it is not negotiable:
 *
 *     current canonical viewpoint
 *       -> prove the held disclosure IS this viewpoint's
 *         -> derive semantic chrome
 *           -> present actions
 *
 * A projection is authority for exactly the `(Session, effective TC, MC.depth)` it was disclosed
 * for. Read a stale, foreign-Session, wrong-position or wrong-depth scene as evidence and every
 * absence in it becomes a confident lie: "that is not there", "there is nowhere to go", "it was not
 * known then", "there is no context", "there is no live focus". None of those is a fact about the
 * world; all of them are facts about what the client happens to be holding.
 *
 * So while the held disclosure is not proven current, this model derives NO semantic answer from it.
 * The inspection state becomes the matching TECHNICAL state, the contextual lineage and the
 * appearance list are empty rather than retained, and the Live Focus question is `UNPROVEN` — which
 * is not a quieter `UNAVAILABLE`, but the statement that the question was never asked.
 *
 * The rule itself is T-04's ONE shared `mapContextFreshness`, reached through T-04's own
 * `isCurrentMapContext` and called in exactly one place here. There is no second freshness
 * algorithm, no projection cache, no second locatability resolver and no second Live Focus resolver
 * anywhere in T-08.
 *
 * ## What stays true without any projection at all
 *
 * The temporal stance, the camera's own depth and viewpoint, and the generic return availabilities
 * are entailed by Class A alone. They are derived above the gate, they remain truthful while a
 * projection is missing, and they are exactly the generic orientation a reader keeps during a
 * projection transition. They name nothing in the world, so they cannot leak anything from it.
 */
import {
  effectiveTC,
  temporalOrientation as canonicalTemporalOrientation,
  type CanonicalState,
  type CanonicalStore,
} from '../state';
import {
  decodeInspectionRef,
  isCurrentMapContext,
  mapInspectionContext,
  type MapInspectionContext,
  type MapProjectionRequest,
  type MapSceneDerivation,
} from '../map';
import type { HistoricalDisclosureEntry } from '../projection';
import { liveFocusReturnAvailability, returnAvailability } from '../return-navigation';
// Type only, so no module of T-06 is loaded at runtime by this layer and no value of it is reachable
// from here. What T-08 receives is the SNAPSHOT T-06 publishes, never its controller.
import type { TemporalPreview } from '../temporal-navigation';
import { exactReturnTargetFor, type ExactReturnOrigin } from './exact-return-origin';
import { contextOrientation, currentBindingOf } from './context-orientation';
import { inspectionRender, renderableIdentity } from './inspection-orientation';
import { returnOrientation } from './return-orientation';
import type {
  ChromeProjectionState,
  ContextChrome,
  InspectionRenderState,
  LiveChrome,
  OrientationModel,
  PreviewChrome,
  SpatialChrome,
  TemporalChrome,
} from './types';

/**
 * What the client holds for this viewpoint, with the three technical outcomes kept apart.
 *
 * A single `MapInspectionContext | null` would collapse "not fetched", "the server refused" and
 * "the held disclosure is incoherent" into one absence, and an absence is exactly what must not be
 * manufactured here. This carries T-04's own derivation instead, so each stays its own fact.
 */
export type ChromeProjection =
  | { readonly held: true; readonly context: MapInspectionContext }
  | { readonly held: false; readonly derivation: MapSceneDerivation };

/**
 * Turns what the projection boundary already holds into a chrome projection.
 *
 * It derives nothing itself: T-04's own context builder does the work, there is no second cache and
 * no second scene derivation, and a refusal keeps the typed reason the boundary gave it.
 */
export function chromeProjection(entry: HistoricalDisclosureEntry, request: MapProjectionRequest): ChromeProjection {
  const resolution = mapInspectionContext(entry, request);
  return resolution.ok ? { held: true, context: resolution.context } : { held: false, derivation: resolution.derivation };
}

/** The projection request of the CURRENT canonical viewpoint, or `null` while nothing is addressable. */
export { mapProjectionRequest } from '../map';

const EMPTY_CONTEXT: ContextChrome = Object.freeze({
  lineage: Object.freeze([]),
  appearances: Object.freeze([]),
  choiceAvailable: false,
});

/**
 * The preview orientation of a surface that was given no preview source at all.
 *
 * Not a re-implementation of T-06's own idle value: it is what "this surface cannot observe a
 * preview" means, which is the same thing a reader is told either way — that nothing transient is
 * being looked at. It is a frozen module constant so the subscription below has a stable snapshot to
 * return, which is what keeps `useSyncExternalStore` from looping.
 */
const NO_PREVIEW: PreviewChrome = Object.freeze({ status: 'IDLE' });

/**
 * T-06's published snapshot, narrowed to what a reader may be told.
 *
 * `origin` and `generation` are deliberately dropped: the first is T-06's own evidence that nothing
 * committed moved, the second is its interruption guard, and neither is orientation. What survives is
 * the previewed position and which of the reader's own routes established it.
 */
function previewOf(preview: TemporalPreview | null | undefined): PreviewChrome {
  if (preview === null || preview === undefined || preview.status === 'IDLE') return NO_PREVIEW;
  return Object.freeze({ status: 'PREVIEWING' as const, at: preview.ptc, source: preview.source });
}

function projectionStateOf(store: CanonicalStore, projection: ChromeProjection): ChromeProjectionState {
  if (!projection.held) {
    const derivation = projection.derivation;
    if (derivation.status === 'PROJECTION_NOT_FETCHED') return { status: 'NOT_FETCHED' };
    if (derivation.status === 'PROJECTION_UNAVAILABLE') return { status: 'UNAVAILABLE', code: derivation.code };
    return { status: 'INCOHERENT' };
  }
  // THE freshness rule, asked through T-04's own accessor and in exactly one place in this layer.
  const freshness = isCurrentMapContext(store, projection.context);
  return freshness.fresh ? { status: 'CURRENT' } : { status: 'STALE', reason: freshness.reason };
}

/**
 * The technical inspection state that matches a projection that cannot answer.
 *
 * Each one is a different fact and none of them is an absence in the world: the reader is told that
 * the Product cannot currently show what they asked for, never that what they asked for is not there.
 */
function technicalRender(projection: ChromeProjectionState): InspectionRenderState {
  switch (projection.status) {
    case 'NOT_FETCHED':
      return { kind: 'PROJECTION_NOT_FETCHED' };
    case 'UNAVAILABLE':
      return { kind: 'PROJECTION_UNAVAILABLE', code: projection.code };
    case 'STALE':
      return { kind: 'PROJECTION_STALE', reason: projection.reason };
    default:
      return { kind: 'PROJECTION_INCOHERENT' };
  }
}

/**
 * The committed temporal stance, and beside it whatever is transiently being looked at.
 *
 * The preview is a SIBLING of the committed answer and never a substitute for it: `mode` is still
 * derived from `TM` alone and `at` from the committed effective `TC` alone, so an open preview cannot
 * make a reader appear to have travelled, cannot turn `FOLLOW_LIVE` into `PINNED`, and cannot rewrite
 * a pinned target. There is still no third mode, and still nowhere to put one.
 */
function temporalOf(state: CanonicalState, preview: PreviewChrome): TemporalChrome {
  const orientation = canonicalTemporalOrientation(state);
  const liveHeadEstablished = state.live.LH !== null;
  return orientation.mode === 'FOLLOW_LIVE'
    ? Object.freeze({ mode: 'FOLLOW_LIVE' as const, at: effectiveTC(state), earlierThanLiveHead: false, liveHeadEstablished, preview })
    : Object.freeze({
        mode: 'PINNED' as const,
        at: orientation.at,
        earlierThanLiveHead: orientation.earlierThanLiveHead,
        liveHeadEstablished,
        preview,
      });
}

export interface OrientationModelOptions {
  /**
   * An Exact Return opportunity bound from a real explicit inspection journey, or nothing.
   *
   * T-08 never mints one: it does not read the reversible history, does not assume the oldest
   * recorded checkpoint is an original inspection, and builds no history browser. The opportunity is
   * bound against the store the journey happened in, so a handle from a replaced or foreign store is
   * not offered at all — and T-07 still re-proves provenance and presence independently at
   * execution, which remains the only authority.
   */
  readonly exactReturnOrigin?: ExactReturnOrigin | null;
  /**
   * T-06's published preview SNAPSHOT, or nothing when this surface observes no preview.
   *
   * A snapshot rather than a controller, so this function stays pure and has no way to start,
   * retarget, commit or cancel a preview. T-06 keeps all of that, including the cancellation every
   * T-07 executor performs for itself.
   */
  readonly preview?: TemporalPreview | null;
  /**
   * Whether this mounted surface can attempt the composite's spatial half at all.
   *
   * Presentation capability, not world truth: it is settled before anything about Live is known, so
   * it discloses nothing and cannot move with `LF`. Absent, the composite is not offered — a control
   * whose spatial half has nothing to attempt with is a promise the surface cannot keep.
   */
  readonly liveContextAvailable?: boolean;
}

/**
 * The whole orientation answer for one render.
 *
 * It writes nothing, holds nothing between calls, caches nothing and adds no canonical state. Two
 * canonical states that differ only in a Live Focus the reader's own `K(TC)` cannot disclose produce
 * a deeply equal model, because no field of it is derived from `LF`.
 */
export function orientationModel(store: CanonicalStore, projection: ChromeProjection, options: OrientationModelOptions = {}): OrientationModel {
  const state = store.getState();
  const availability = returnAvailability(state);
  const temporal = temporalOf(state, previewOf(options.preview));

  const spatial: SpatialChrome = Object.freeze({
    // The camera's own rung, from canonical state. A sparse scene is never evidence about the camera.
    depth: state.camera.depth,
    atWorldViewpoint: !availability.worldReturnAvailable,
  });

  const projectionState = projectionStateOf(store, projection);
  const current = projectionState.status === 'CURRENT' && projection.held ? projection.context : null;

  // Live meta, generic only. Nothing below reads `LF`: the single specific capability is the
  // projection-bound answer, and it is asked only of a projection proven to be this viewpoint's.
  const live: LiveChrome = Object.freeze({
    liveEstablished: availability.liveReturnAvailable,
    advancedWhileHistorical: availability.historical,
    routeBackToLiveAvailable: availability.liveReturnAvailable,
    focusReturn: current === null ? ('UNPROVEN' as const) : liveFocusReturnAvailability(store, current).status,
  });

  const requested = state.inspection !== null;
  const render: InspectionRenderState =
    // Inspecting nothing is knowable without any projection at all, and it is neutral: it names no
    // object, holds no place for one and states nothing about the world.
    !requested ? { kind: 'NO_INSPECTION' } : current === null ? technicalRender(projectionState) : inspectionRender(state.inspection, current);

  const identity = renderableIdentity(render);
  const context =
    current === null || identity === null
      ? EMPTY_CONTEXT
      : contextOrientation({
          context: current,
          identity,
          currentBindingId: currentBindingOf(decodeInspectionRef(state.inspection)?.appearance ?? null),
          lineage: render.kind === 'RENDERABLE' ? render.lineage : Object.freeze([]),
        });

  return Object.freeze({
    projection: projectionState,
    temporal,
    spatial,
    inspection: Object.freeze({ requested, render }),
    live,
    returns: returnOrientation({
      availability,
      temporal,
      focusReturn: live.focusReturn,
      // Provenance is asked of T-07 itself: it minted this handle, THIS store minted it, and that
      // exact reversible-history entry is still recorded. There is no ordinal and no depth
      // comparison anywhere in it, which is why a consumed origin stays retired however far history
      // later regrows. This is presentation only: authority remains entirely T-07's, which re-proves
      // provenance and presence before writing anything.
      exactReturnBound: exactReturnTargetFor(store, options.exactReturnOrigin) !== null,
      // Client capability, decided before anything about Live is known. It cannot move with `LF`, so
      // requiring it adds no future-relative input to the offered set.
      liveContextAvailable: options.liveContextAvailable === true,
    }),
    context,
  });
}
