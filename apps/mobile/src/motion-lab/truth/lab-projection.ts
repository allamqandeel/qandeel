/**
 * T-10.0 MOTION LAB — the projection provider: what the client "holds" for `(Session, TC, depth)`.
 *
 * In production the disclosure arrives over T-03C's transport and sits in its Class-B holder. The
 * lab answers the same question synchronously from the scripted record, in the same wire shape,
 * and then hands it to the SAME context builder, freshness rule and Return seam production uses:
 *
 *   `mapInspectionContext`  (T-04)  — the disclosure and the derived scene, travelling together;
 *   `mapContextFreshness`   (T-04)  — the ONE rule that says whether that context is this Map;
 *   `returnMapContext`      (T-07)  — the technical half of the Return seam, for Go Live + Locate.
 *
 * A position beyond the Live Head is answered as `UNAVAILABLE / SESSION_POSITION_NOT_ADDRESSABLE`,
 * never as an empty world: the lab cannot show the future because the provider cannot produce it.
 */
import { mapContextFreshness, mapInspectionContext, mapProjectionRequest, type MapInspectionContext, type MapProjectionRequest } from '../../map';
import type { HistoricalDisclosureEntry } from '../../projection';
import { returnMapContext, type ReturnMapContext } from '../../return-navigation';
import type { CanonicalState, CanonicalStore } from '../../state';
import { LAB_WORLD, disclosureAt, type LabWorld } from './lab-world';

/** The entry the client holds for a request, from the scripted record and the mirrored Live Head. */
export function labDisclosureEntry(world: LabWorld, state: CanonicalState, request: MapProjectionRequest): HistoricalDisclosureEntry {
  const liveHead = state.live.LH;
  if (liveHead === null) return { status: 'UNAVAILABLE', code: 'LIVE_HEAD_NOT_ESTABLISHED' };
  if (request.sessionId !== world.sessionId) return { status: 'UNAVAILABLE', code: 'SESSION_NOT_VISIBLE' };
  if (!Number.isInteger(request.tc) || request.tc < 1 || request.tc > liveHead) {
    return { status: 'UNAVAILABLE', code: 'SESSION_POSITION_NOT_ADDRESSABLE' };
  }
  const value = disclosureAt(world, request.tc, request.depth, liveHead);
  return { status: 'FETCHED', value, sealed: value.sealed };
}

/** The Map context for an explicit request, or `null` when the client holds no usable disclosure. */
export function labContextFor(world: LabWorld, state: CanonicalState, request: MapProjectionRequest): MapInspectionContext | null {
  const resolution = mapInspectionContext(labDisclosureEntry(world, state, request), request);
  return resolution.ok ? resolution.context : null;
}

/** The context of the CURRENT canonical viewpoint, proven fresh by T-04's one rule, or `null`. */
export function currentLabContext(world: LabWorld, state: CanonicalState): MapInspectionContext | null {
  const request = mapProjectionRequest(state);
  if (request === null) return null;
  const context = labContextFor(world, state, request);
  if (context === null) return null;
  return mapContextFreshness(state, context).fresh ? context : null;
}

/**
 * The context of a PREVIEWED position (`PTC`) at the camera's current depth. `PTC` is Class C: this
 * never touches the store, and a preview beyond the Live Head cannot be produced at all.
 */
export function previewLabContext(world: LabWorld, state: CanonicalState, ptc: number): MapInspectionContext | null {
  return labContextFor(world, state, { sessionId: state.session.id, tc: ptc as MapProjectionRequest['tc'], depth: state.camera.depth });
}

/** The `liveContext` provider Go Live + Locate binds its spatial half through (T-07's public seam). */
export function labLiveContextProvider(store: CanonicalStore, world: LabWorld = LAB_WORLD): (request: MapProjectionRequest) => ReturnMapContext {
  return (request) => returnMapContext(labDisclosureEntry(world, store.getState(), request), request);
}
