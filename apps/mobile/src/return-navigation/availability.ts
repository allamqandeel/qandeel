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
 * ## Why there is no Live-Focus capability bit here
 *
 * A model derived from Class A alone can honestly say that Live exists and that a route back to Live
 * is available — the generic Live meta a historical reader is permitted. It cannot honestly say
 * whether a Return to Live Focus has anywhere to go, and it must not try, for two separate reasons:
 *
 *   - `LF != NONE` is LIVE truth. From a historical position that is future-relative: a bit derived
 *     from it can reveal that a Thread exists which `K(TC)` does not disclose, which is exactly the
 *     future-state information the historical firewall exists to keep out;
 *   - it would also overstate the capability. A live Thread with no legitimate place at the reader's
 *     current viewpoint is not a landing, so `LF != NONE` proves nothing about whether the act can
 *     do anything at all.
 *
 * That question is answerable only against a disclosed projection that is proven to be this
 * viewpoint's, and so it lives with the act — `liveFocusReturnAvailability` in `return-actions.ts` —
 * where the same freshness rule and the same locatability substrate the act uses can answer it. No
 * second projection source exists in this layer, and none is created here.
 */
import { cameraIntentEquals, effectiveTC, type CanonicalState } from '../state';
import { initialCameraIntent } from '../map';
import { RETURN_ACTION_TYPES } from '../state';

/** The six frozen return identities, as a semantic command vocabulary. Never a generic one. */
export const RETURN_ACT_IDS = RETURN_ACTION_TYPES;

export interface ReturnAvailability {
  /** An authoritative Live Head exists, so a route back to Live is a meaningful act. */
  readonly liveReturnAvailable: boolean;
  /** The committed stance is `PINNED` behind the Live Head: Live is elsewhere. Nothing says where. */
  readonly historical: boolean;
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
    worldReturnAvailable: !cameraIntentEquals(state.camera, initialCameraIntent()),
    backAvailable: state.history.length > 0,
    checkpointCount: state.history.length,
  });
}
