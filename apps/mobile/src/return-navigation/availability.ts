/**
 * T-07 — the minimal non-pointer substrate: which return acts are meaningful right now, derived
 * from Class-A facts alone.
 *
 * This is the semantic half of a return surface, and deliberately only that half. It states nothing
 * about the world:
 *
 *   - no Thread or Emerging Focus identity, and no display label of any kind;
 *   - no Home, coordinate, direction or distance;
 *   - no count of loci, and no accessibility set-size or child count;
 *   - no "go there" hint, and no contextual label borrowed from a position the reader is not at.
 *
 * `liveFocusReturnAvailable` says only that live attention exists somewhere — the generic "Live
 * continued" statement already permitted upstream — and never what or where it is. From a historical
 * position that distinction is the whole point: the reader may learn that Live is elsewhere and that
 * a return to it is available, and may not learn where it went.
 *
 * There is no copy, no icon, no colour and no layout here, and no component: final return and
 * orientation chrome is a later task's, and every act below is already reachable as a plain function
 * call, without a drag, a precision pointer or a coordinate, through the same authority the pointer
 * route would use. There is exactly one executor per act and no generic Home/Back/Live route that
 * could collapse the six identities into fewer.
 */
import { cameraIntentEquals, effectiveTC, type CanonicalState } from '../state';
import { initialCameraIntent } from '../map';
import { RETURN_ACTION_TYPES } from '../state';

/** The six frozen return identities, as a semantic command vocabulary. Never a generic one. */
export const RETURN_ACT_IDS = RETURN_ACTION_TYPES;

export interface ReturnAvailability {
  /** An authoritative Live Head exists, so a return to Live is a meaningful act. */
  readonly liveReturnAvailable: boolean;
  /** The committed stance is `PINNED`: Live is elsewhere. Nothing here says where. */
  readonly historical: boolean;
  /** Live attention exists somewhere. Generic by construction: no identity, no place, no count. */
  readonly liveFocusReturnAvailable: boolean;
  /** The camera is not already at the canonical World / Z0 viewpoint. */
  readonly worldReturnAvailable: boolean;
  /** At least one recorded checkpoint can be reversed. */
  readonly backAvailable: boolean;
  /** How many of the reader's OWN transactions are recorded. Never a count of anything in the world. */
  readonly checkpointCount: number;
}

export function returnAvailability(state: CanonicalState): ReturnAvailability {
  const liveHead = state.live.LH;
  return Object.freeze({
    liveReturnAvailable: liveHead !== null,
    historical: state.temporal.kind === 'PINNED' && liveHead !== null && effectiveTC(state) !== liveHead,
    liveFocusReturnAvailable: liveHead !== null && state.live.LF.value.kind !== 'NONE',
    worldReturnAvailable: !cameraIntentEquals(state.camera, initialCameraIntent()),
    backAvailable: state.history.length > 0,
    checkpointCount: state.history.length,
  });
}
