/**
 * T-07 — `GO_LIVE_AND_LOCATE` (P5): go Live and land once, as ONE Product act.
 *
 * Frozen sequence:
 *
 *     activation
 *       → establish FOLLOW_LIVE as the temporal sub-effect
 *       → resolve the authoritative Live Head
 *       → at the logical post-live boundary bind ONCE:  P5_LF* := LF at that boundary
 *       → locate once iff the bound referent is legitimately locatable at K(LH)
 *
 * `P5_LF*` is transient and act-local. It is not canonical state, not RH, not a temporal mode and
 * not a reusable capability: it exists as a local constant for the length of this function, and
 * there is nowhere else in the layer it could be kept.
 *
 * ## Why the binding is at the post-live boundary and not at activation
 *
 * P5 is not "return to where attention was when I asked". It is "go live, and take me to where live
 * attention is". The referent is therefore read after the temporal result is known — so a Live Focus
 * transition that arrives between activation and that boundary is bound, and the older referent is
 * not landed on. After the boundary the referent is fixed: a transition arriving while the live
 * projection is being resolved does not retarget the act, because nothing below re-reads `LF`.
 *
 * ## Atomicity
 *
 * There is exactly ONE canonical dispatch. The temporal effect is never published first and then
 * followed by a camera act: that would leave an intermediate committed state that never happened, an
 * extra RH checkpoint, and a Back that stops halfway. The post-live viewpoint is computed as a local
 * hypothetical, used to ask for the live projection and to prove the landing against, and then the
 * whole act — temporal and spatial together — is dispatched once. One Back after an effective P5
 * therefore restores the complete pre-P5 viewpoint.
 *
 * ## When the spatial part cannot happen
 *
 * A bound referent that is `NONE`, undisclosed at the Live viewpoint, ungeographic, or ambiguous
 * leaves the temporal Live return standing alone — still ONE act, still one checkpoint when it is
 * effective. So does a live projection the client does not hold, and so does a live scene that has
 * stopped being the Live viewpoint's projection by the time the act is authorized: a delivery
 * failure and a stale scene are technical facts, and neither is allowed to become a fabricated
 * semantic claim that there is nowhere to go, nor to invent a camera movement.
 */
import { mapProjectionRequest, type MapProjectionRequest } from '../map';
import type { CanonicalState } from '../state';
import { committedReturn, type ReturnSurface } from './surface';
import { runReturnPlan } from './authority';
import { focusMapTarget, resolveFocusLanding, type ReturnMapContext } from './focus-target';
import { returnRejected, withLocate, type ReturnLocateStatus, type ReturnOutcome } from './outcomes';

export interface GoLiveAndLocateRequest {
  /**
   * Resolves the disclosed projection of the LIVE viewpoint. It is called at the post-live boundary,
   * AFTER the referent has been bound, so a provider that has to reach for a disclosure cannot
   * retarget the act; and whatever it returns is still proven current before anything is written.
   */
  readonly liveContext: (request: MapProjectionRequest) => ReturnMapContext;
}

export function goLiveAndLocate(surface: ReturnSurface, request: GoLiveAndLocateRequest): ReturnOutcome {
  return committedReturn(surface, (store) => {
    const atBoundary = store.getState();
    if (atBoundary.live.LH === null) {
      return returnRejected('NO_ADDRESSABLE_POSITION', 'no authoritative committed Session Position has been mirrored (LH = null); there is no Live Head to return to');
    }
    // The hypothetical post-live viewpoint. Never published, never stored, never observable: it
    // exists so the LIVE projection can be asked for, and proven current, before the one dispatch.
    const postLive: CanonicalState = { ...atBoundary, temporal: { kind: 'FOLLOW_LIVE' } };
    const projectionRequest = mapProjectionRequest(postLive);
    if (projectionRequest === null) {
      return returnRejected('NO_ADDRESSABLE_POSITION', 'the live viewpoint has no addressable Session Position');
    }
    // AMB-01: bound exactly ONCE, here, at the logical post-live boundary. Nothing below re-reads it.
    const bound = focusMapTarget(atBoundary.live.LF.value);

    /** The temporal return alone, still as ONE composite act. Used wherever the landing cannot be. */
    const temporalOnly = (locate: ReturnLocateStatus): ReturnOutcome =>
      withLocate(runReturnPlan(store, { act: 'GO_LIVE_AND_LOCATE', landing: null }), locate);

    if (bound === null) return temporalOnly('NO_FOCUS');

    const live = request.liveContext(projectionRequest);
    if (!live.ok) return temporalOnly('PROJECTION_NOT_AVAILABLE');

    const landing = resolveFocusLanding(live.context, bound);
    if (landing.status === 'NO_LANDING') return temporalOnly(landing.locate);

    const located = runReturnPlan(store, { act: 'GO_LIVE_AND_LOCATE', landing: { to: landing.to, context: live.context } });
    if (located.outcome === 'REJECTED' && located.code === 'STALE_PROJECTION') {
      // The live scene stopped being the projection of the live viewpoint before the act was
      // authorized. Nothing was dispatched, so this is still exactly one transaction — the temporal
      // one — and no camera movement is invented from a scene that is no longer this Map.
      return temporalOnly('STALE_PROJECTION');
    }
    return withLocate(located, located.outcome === 'NO_OP' ? 'ALREADY_THERE' : 'LANDED');
  });
}
