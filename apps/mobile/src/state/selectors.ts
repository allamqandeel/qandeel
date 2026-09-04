/**
 * T-02 — Class-B selectors computable from Class A alone.
 *
 * Nothing here reads `K(TC)`, `V`, projection truth, a presentation envelope or any Class C / D
 * value. Historical / sparse-projection state, `IF_render`, divergence, locatability, the
 * visible footprint and the disclosure horizon are owned by T-03C / T-04 / T-08 / T-06 / T-11
 * and are deliberately not declared here (REV-T02-04).
 */
import {
  isSessionPosition,
  type CameraIntent,
  type CanonicalState,
  type InspectionRef,
  type RhEntry,
  type SessionPosition,
  type TemporalMode,
} from './classes';

/** `FOLLOW_LIVE → LH`; `PINNED(t) → t`. The only accessor of effective `TC`; there is no storage slot. */
export function effectiveTC(state: CanonicalState): SessionPosition | null {
  return state.temporal.kind === 'FOLLOW_LIVE' ? state.live.LH : state.temporal.at;
}

/** `1 <= m <= LH`. Always false while `LH = null`: nothing is addressable before SP(1). */
export function isAddressableMoment(state: CanonicalState, moment: number): boolean {
  return state.live.LH !== null && isSessionPosition(moment) && moment <= state.live.LH;
}

/**
 * Temporal orientation entailed by Class A only: the mode, the effective `TC`, and whether a
 * pinned `TC` is earlier than the current Live Head. It never states whether a historical Map
 * is sparse, correct, complete or unavailable; that is projection truth from `K(TC)` / `V`.
 */
export type TemporalOrientation =
  | { readonly mode: 'FOLLOW_LIVE'; readonly effectiveTC: SessionPosition | null }
  | {
      readonly mode: 'PINNED';
      readonly at: SessionPosition;
      readonly effectiveTC: SessionPosition;
      readonly earlierThanLiveHead: boolean;
    };

export function temporalOrientation(state: CanonicalState): TemporalOrientation {
  if (state.temporal.kind === 'FOLLOW_LIVE') {
    return { mode: 'FOLLOW_LIVE', effectiveTC: state.live.LH };
  }
  const at = state.temporal.at;
  // `PINNED` requires a mirrored LH (validated at construction and by COMMIT_MOMENT), so the comparison is defined.
  const lh = state.live.LH;
  return { mode: 'PINNED', at, effectiveTC: at, earlierThanLiveHead: lh !== null && at < lh };
}

/**
 * Pure projection of the client-owned committed navigation intent for a later T-13 consumer.
 * Carries `TM` as a mode (never a null cursor), `IF_ref`, `MC` intent and `RH`; never `LH`,
 * `LF`, any cached projection, `PTC`, a window, a position, an envelope or a footprint.
 * T-02 performs no persistence.
 */
export interface CommittedNavigationIntent {
  readonly temporal: TemporalMode;
  readonly effectiveTC: SessionPosition | null;
  readonly inspection: InspectionRef | null;
  readonly camera: CameraIntent;
  readonly history: readonly RhEntry[];
}

export function committedNavigationIntent(state: CanonicalState): CommittedNavigationIntent {
  return {
    temporal: state.temporal,
    effectiveTC: effectiveTC(state),
    inspection: state.inspection,
    camera: state.camera,
    history: state.history,
  };
}
