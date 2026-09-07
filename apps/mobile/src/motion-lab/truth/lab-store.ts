/**
 * T-10.0 MOTION LAB — the REAL canonical store, wired with the three real runtime authorities.
 *
 * Nothing about the kernel is stood in for. Every act a prototype performs runs through T-02's
 * per-field authority guard, `Φ_eff` no-op rule and RH boundary, behind T-04's, T-06's and T-07's
 * own authorities, exactly as production would. That is what makes P5 structural here: an
 * animation cannot commit anything, because there is nothing in the lab that can dispatch except
 * the executors those layers already ship.
 *
 * The Live Head is advanced the way the server would advance it — through the authoritative
 * mirror seam — and the Live Focus transition of the newly committed Moment is delivered beside
 * it, exactly as the record scripts it. A prototype never writes `LH` or `LF` directly.
 */
import { MAP_ACTION_AUTHORITY, initialCameraIntent } from '../../map';
import { RETURN_ACTION_AUTHORITY } from '../../return-navigation';
import { createCanonicalStore, sessionPosition, type CanonicalStore } from '../../state';
import { TEMPORAL_ACTION_AUTHORITY } from '../../temporal-navigation';
import { LAB_INITIAL_LIVE_HEAD, LAB_WORLD, liveFocusAt, type LabWorld } from './lab-world';

export function createLabStore(world: LabWorld = LAB_WORLD, liveHead: number = LAB_INITIAL_LIVE_HEAD): CanonicalStore {
  const focus = liveFocusAt(world, liveHead);
  return createCanonicalStore(
    {
      session: { id: world.sessionId },
      live: {
        LH: sessionPosition(liveHead),
        LF: { value: focus === null ? { kind: 'NONE' } : focus.value, atSp: focus === null ? null : sessionPosition(focus.atSp) },
      },
      temporal: { kind: 'FOLLOW_LIVE' },
      inspection: null,
      camera: initialCameraIntent(),
    },
    {
      mapActionAuthority: MAP_ACTION_AUTHORITY,
      temporalActionAuthority: TEMPORAL_ACTION_AUTHORITY,
      returnActionAuthority: RETURN_ACTION_AUTHORITY,
    },
  );
}

export type LiveAdvanceOutcome = { readonly outcome: 'ADVANCED'; readonly toSp: number } | { readonly outcome: 'AT_END'; readonly liveHead: number };

/**
 * Delivers the next committed Moment of the scripted record: `LIVE_HEAD_ADVANCED(toSp)`, then the
 * Live Focus transition committed at that Moment when the record has one. Both go through the
 * kernel's own `ingest` seam; a prototype cannot reach `LH` or `LF` any other way.
 */
export function advanceLive(store: CanonicalStore, world: LabWorld = LAB_WORLD): LiveAdvanceOutcome {
  const liveHead = store.getState().live.LH;
  if (liveHead === null) return { outcome: 'AT_END', liveHead: 0 };
  if (liveHead >= world.finalLiveHead) return { outcome: 'AT_END', liveHead };
  const toSp = sessionPosition(liveHead + 1);
  store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp });
  const transition = world.liveFocusTransitions.find((candidate) => candidate.atSp === toSp);
  if (transition !== undefined) store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: transition.value, atSp: toSp });
  return { outcome: 'ADVANCED', toSp };
}
