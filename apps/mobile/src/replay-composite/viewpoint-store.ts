/**
 * S7-03 — the Replay viewpoint: an ISOLATED canonical store on the real T-02 kernel, one per Replay version.
 *
 * The Living Analysis Map reads its viewpoint — (Session, effective TC, semantic depth) and the camera — from a canonical
 * store, so the composite gives it one. It is never the live conversation's store, and nothing of the live conversation
 * reaches it («إدخال حالة Replay إلى مخزن المحادثة الحية» is forbidden, and so is the reverse):
 *
 *   session   the Replay viewpoint key, not the conversation's Session (`replayViewpointKey`);
 *   LH        the version's own horizon (`lastTc`): no later position is addressable here;
 *   LF        NONE — there is no live truth in a Replay; the moment's own Live Focus at TC travels in its analysis;
 *   TM        PINNED at a moment of the version, and moved only by T-06's own `commitMoment`;
 *   camera    T-04's initial intent at the world origin; the reader's PAN and pinch are the Map's own kernel acts.
 *
 * No Map, Temporal or Return authority is wired: every promoted act (inspection, context switch, direct jump, commit
 * and locate, the return acts) fails closed against this store by construction. So the Replay viewpoint can be looked
 * at, panned and zoomed through the frozen rungs, and nothing else — no inspection panel, no Return, no Live.
 */
import { createCanonicalStore, sessionPosition, type CanonicalStore, type SemanticDepth } from '../state';
import { WORLD_ORIGIN, initialCameraIntent } from '../map';
import type { ReplayHistoryVersion } from '../runtime-entry';
import { replayViewpointKey } from './projection-adapter';

export function createReplayViewpointStore(version: ReplayHistoryVersion, tc: number, depth: SemanticDepth = 'WORLD'): CanonicalStore {
  if (tc < version.firstTc || tc > version.lastTc) throw new RangeError(`the Replay viewpoint opens on a moment of the version, not on ${tc}`);
  return createCanonicalStore({
    session: { id: replayViewpointKey(version) },
    live: { LH: sessionPosition(version.lastTc), LF: { value: { kind: 'NONE' }, atSp: null } },
    temporal: { kind: 'PINNED', at: sessionPosition(tc) },
    inspection: null,
    camera: initialCameraIntent(WORLD_ORIGIN, undefined, depth),
  });
}
