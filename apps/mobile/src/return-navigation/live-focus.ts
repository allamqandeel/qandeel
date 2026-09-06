/**
 * T-07 — `RETURN_LIVE_FOCUS` (D1): one-shot return to where live attention is.
 *
 * The whole act is spatial. `TM` is not written, the effective `TC` does not move, and `LF` itself is
 * never changed: this is a camera move to where the live conversation currently is, made once, from
 * wherever the reader is standing.
 *
 * ## The one-shot capture, and why it is at activation
 *
 * At explicit activation the referent is bound ONCE:
 *
 *     LF* := LF at activation
 *
 * `LF*` is transient and act-local. It has no key in canonical state, it is not recorded in RH, it
 * is not a temporal mode, and it creates no persistent follow: a later Live Focus transition does not
 * retarget this act, and reaching the live focus once does not mean tracking it. A later explicit
 * activation binds the then-current referent, which is a different act with a different referent.
 *
 * Reading `LF` at settle instead would be a different Product act: the reader asked to go where
 * attention WAS when they asked, and chasing a newer referent would move them somewhere they never
 * chose. So if the bound referent turns out to have no legitimate place here, the camera does not
 * move at all — there is no fallback to the newer focus, and none to anything else.
 *
 * ## Entitlement, freshness and no hindsight
 *
 * The landing is resolved against the disclosed projection of the viewpoint the reader is standing
 * on, and that projection must still be the store's current one when the act is authorized —
 * same Session, same effective `TC`, same semantic depth. A scene from another Session, another
 * position, another depth, or from before a later committed temporal change cannot authorize a
 * camera landing: projection presence is not entitlement.
 *
 * That is also what keeps a historical Return to Live Focus free of hindsight. A Thread that exists
 * only later is not disclosed at this position, so it is refused rather than located, and no future
 * Home, direction, distance or count reaches the reader through this act.
 */
import { committedReturn, type ReturnSurface } from './surface';
import { runReturnPlan } from './authority';
import { focusMapTarget, resolveFocusLanding } from './focus-target';
import { returnNoOp, withLocate, type ReturnOutcome } from './outcomes';
import type { MapInspectionContext } from '../map';

export interface ReturnLiveFocusRequest {
  /**
   * The disclosed projection of the viewpoint the reader is standing on. It is proven to be the
   * store's current projection before anything is written; a stale one authorizes nothing.
   */
  readonly context: MapInspectionContext;
}

export function returnLiveFocus(surface: ReturnSurface, request: ReturnLiveFocusRequest): ReturnOutcome {
  return committedReturn(surface, (store) => {
    // D1: bound ONCE, here, at explicit activation. Nothing later in this function re-reads `LF`.
    const bound = focusMapTarget(store.getState().live.LF.value);
    if (bound === null) return returnNoOp('NO_LEGITIMATE_LANDING', 'NO_FOCUS');

    const landing = resolveFocusLanding(request.context, bound);
    if (landing.status === 'NO_LANDING') return returnNoOp('NO_LEGITIMATE_LANDING', landing.locate);

    const outcome = runReturnPlan(store, { act: 'RETURN_LIVE_FOCUS', landing: { to: landing.to, context: request.context } });
    // A no-op here means the camera is already at the exact entitled landing: nothing moved, and
    // nothing was recorded, which is the frozen answer rather than a redundant checkpoint.
    return withLocate(outcome, outcome.outcome === 'NO_OP' ? 'ALREADY_THERE' : 'LANDED');
  });
}
