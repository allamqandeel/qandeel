/**
 * T-07 — RN07-H: `GO_LIVE_AND_LOCATE` (P5), the most failure-prone act in the layer.
 *
 * Two things are proven again and again here: the referent is bound ONCE at the logical post-live
 * boundary, and the whole act is ONE canonical transaction — no intermediate publish, no
 * intermediate checkpoint, no intermediate Back stop.
 */
import { CANONICAL_STATE_KEYS, sessionPosition } from '../../state';
import { decodeWorldAnchorRef, panByTranslation } from '../../map';
import { goLiveAndLocate } from '../go-live-and-locate';
import { backOneStep } from '../history-restoration';
import {
  contextAt,
  countingStore,
  interposingPreview,
  mutatingDispatchStore,
  providing,
  providingNothing,
  returnSurface,
  returnTestStore,
  viewpoint,
  world,
} from '../__fixtures__/return';

const SP = sessionPosition;

const THREAD_A = { id: 'thread-a', x: '1000000', y: '0' };
const THREAD_B = { id: 'thread-b', x: '2000000', y: '0' };

const liveWorld = (tc: number, liveHead = tc, threads = [THREAD_A, THREAD_B]) =>
  world({ depth: 'SESSION', tc, liveHead, threads, focuses: [{ id: 'focus-1', startedSp: 1 }] });

describe('RN07-H — Go Live + Locate (P5)', () => {
  it('H61, H70, H71, H72 — one composite transaction: one dispatch, one publish, one checkpoint', () => {
    const inner = returnTestStore({ liveHead: 9, temporal: { kind: 'PINNED', at: SP(3) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    expect(panByTranslation(inner, 400, 0).outcome).toBe('APPLIED');
    const counting = countingStore(inner);
    const historyBefore = inner.getState().history.length;

    const outcome = goLiveAndLocate(returnSurface(counting.store), { liveContext: providing(contextAt(liveWorld(9))) });
    expect(outcome.outcome === 'APPLIED' && outcome.locate).toBe('LANDED');
    expect(counting.counts.returns).toBe(1);
    expect(counting.counts.publishes).toBe(1);
    expect(counting.counts.kernel).toBe(0);
    expect(counting.counts.temporal).toBe(0);
    expect(inner.getState().history).toHaveLength(historyBefore + 1);
    expect(inner.getState().history[historyBefore].act).toBe('GO_LIVE_AND_LOCATE');
    expect(inner.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
  });

  it('H62 — one Back after an effective P5 restores the complete pre-P5 viewpoint', () => {
    const store = returnTestStore({ liveHead: 9, temporal: { kind: 'PINNED', at: SP(3) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    expect(panByTranslation(store, 400, 120).outcome).toBe('APPLIED');
    const prior = viewpoint(store.getState());
    const historyBefore = store.getState().history.length;

    const surface = returnSurface(store);
    expect(goLiveAndLocate(surface, { liveContext: providing(contextAt(liveWorld(9))) }).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(historyBefore + 1);

    expect(backOneStep(surface).outcome).toBe('APPLIED');
    // Temporal, inspection and camera all come back together: there was never a halfway stop.
    expect(viewpoint(store.getState())).toEqual(prior);
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 3 });
    expect(store.getState().history).toHaveLength(historyBefore);
  });

  it('H63 — Race A: the referent that changes before the post-live boundary is the one bound', () => {
    const store = returnTestStore({ liveHead: 9, temporal: { kind: 'PINNED', at: SP(3) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    // A becomes an Emerging Focus B before the boundary: B is bound, and B is pregeographic, so
    // nothing is landed — and emphatically NOT the older A.
    const preview = interposingPreview(() => {
      store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'EMERGING_FOCUS', emergingFocusId: 'focus-1' }, atSp: SP(9) });
    });

    const outcome = goLiveAndLocate({ store, preview }, { liveContext: providing(contextAt(liveWorld(9))) });
    expect(outcome.outcome === 'APPLIED' && outcome.locate).toBe('NOT_LOCATABLE');
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    // The camera did not move to Thread A's Home, or anywhere else.
    const anchor = decodeWorldAnchorRef(store.getState().camera.anchor);
    expect(anchor.ok && anchor.address.x).toBe(0n);
    expect(store.getState().history).toHaveLength(1);
  });

  it('H64 — Race B: the referent bound at the boundary is not retargeted by a later transition', () => {
    const inner = returnTestStore({ liveHead: 9, temporal: { kind: 'PINNED', at: SP(3) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    const store = mutatingDispatchStore(inner, () => {
      inner.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-b' }, atSp: SP(9) });
    });

    const outcome = goLiveAndLocate(returnSurface(store), { liveContext: providing(contextAt(liveWorld(9))) });
    expect(outcome.outcome === 'APPLIED' && outcome.locate).toBe('LANDED');
    const anchor = decodeWorldAnchorRef(inner.getState().camera.anchor);
    expect(anchor.ok && anchor.address.x).toBe(1000000n);
    expect(inner.getState().live.LF.value).toEqual({ kind: 'ESTABLISHED_THREAD', threadId: 'thread-b' });
  });

  it('H64 — a transition delivered while the live projection is being resolved does not retarget it', () => {
    const store = returnTestStore({ liveHead: 9, temporal: { kind: 'PINNED', at: SP(3) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    const context = contextAt(liveWorld(9));
    const outcome = goLiveAndLocate(returnSurface(store), {
      liveContext: () => {
        store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-b' }, atSp: SP(9) });
        return { ok: true, context };
      },
    });
    expect(outcome.outcome === 'APPLIED' && outcome.locate).toBe('LANDED');
    const anchor = decodeWorldAnchorRef(store.getState().camera.anchor);
    expect(anchor.ok && anchor.address.x).toBe(1000000n);
  });

  it('H65, H68 — a bound referent that cannot be placed leaves the Live return standing, as one act', () => {
    for (const [focus, expected] of [
      [{ kind: 'EMERGING_FOCUS', emergingFocusId: 'focus-1' } as const, 'NOT_LOCATABLE'],
      [{ kind: 'NONE' } as const, 'NO_FOCUS'],
      [{ kind: 'ESTABLISHED_THREAD', threadId: 'thread-missing' } as const, 'NOT_ENTITLED'],
    ] as const) {
      const inner = returnTestStore({ liveHead: 9, temporal: { kind: 'PINNED', at: SP(3) }, liveFocus: focus });
      const counting = countingStore(inner);
      const camera = inner.getState().camera;

      const outcome = goLiveAndLocate(returnSurface(counting.store), { liveContext: providing(contextAt(liveWorld(9))) });
      expect(outcome.outcome === 'APPLIED' && outcome.locate).toBe(expected);
      expect(counting.counts.returns).toBe(1);
      expect(counting.counts.publishes).toBe(1);
      expect(inner.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
      expect(inner.getState().camera).toBe(camera);
      expect(inner.getState().history).toHaveLength(1);
    }
  });

  it('H66 — already FOLLOW_LIVE with a camera that can move: one spatially effective composite act', () => {
    const inner = returnTestStore({ liveHead: 9, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    const counting = countingStore(inner);
    const outcome = goLiveAndLocate(returnSurface(counting.store), { liveContext: providing(contextAt(liveWorld(9))) });
    expect(outcome.outcome === 'APPLIED' && outcome.locate).toBe('LANDED');
    expect(counting.counts.returns).toBe(1);
    expect(inner.getState().history).toHaveLength(1);
    expect(inner.getState().history[0].act).toBe('GO_LIVE_AND_LOCATE');
  });

  it('H67 — already FOLLOW_LIVE and already at the landing: a no-op with no RH churn', () => {
    const store = returnTestStore({ liveHead: 9, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    const request = { liveContext: providing(contextAt(liveWorld(9))) };
    expect(goLiveAndLocate(returnSurface(store), request).outcome).toBe('APPLIED');
    const settled = store.getState();

    const outcome = goLiveAndLocate(returnSurface(store), request);
    expect(outcome).toEqual({ outcome: 'NO_OP', reason: 'NO_EFFECTIVE_CHANGE', locate: 'ALREADY_THERE' });
    expect(store.getState()).toBe(settled);
    expect(store.getState().history).toHaveLength(1);
  });

  it('H69 — a live scene that is stale by settle cannot land, and the temporal return still succeeds', () => {
    const inner = returnTestStore({ liveHead: 9, temporal: { kind: 'PINNED', at: SP(3) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    // The provider hands back a scene for an OLDER Live Head; by the time the act is authorized the
    // Live Head has moved on, so that scene is not this Map any more.
    const stale = contextAt(liveWorld(9));
    const counting = countingStore(inner);
    const outcome = goLiveAndLocate(returnSurface(counting.store), {
      liveContext: () => {
        inner.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(14) });
        return { ok: true, context: stale };
      },
    });
    expect(outcome.outcome === 'APPLIED' && outcome.locate).toBe('STALE_PROJECTION');
    // Exactly one canonical dispatch reached the store: the refused one never got that far, so the
    // act is still ONE transaction. (The publish count is 2 here only because the passive Live Head
    // advance this case injects publishes on its own, which is a mirror update and not an act.)
    expect(counting.counts.returns).toBe(1);
    expect(inner.getState().history).toHaveLength(1);
    expect(inner.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    const anchor = decodeWorldAnchorRef(inner.getState().camera.anchor);
    expect(anchor.ok && anchor.address.x).toBe(0n);
    expect(inner.getState().history).toHaveLength(1);
  });

  it('a projection the client does not hold is technical, and never a fabricated "nowhere to go"', () => {
    const inner = returnTestStore({ liveHead: 9, temporal: { kind: 'PINNED', at: SP(3) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    const counting = countingStore(inner);
    const outcome = goLiveAndLocate(returnSurface(counting.store), { liveContext: providingNothing });
    expect(outcome.outcome === 'APPLIED' && outcome.locate).toBe('PROJECTION_NOT_AVAILABLE');
    expect(counting.counts.returns).toBe(1);
    expect(inner.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(inner.getState().history).toHaveLength(1);
  });

  it('H73 — the bound referent never appears in CanonicalState or in RH', () => {
    const store = returnTestStore({ liveHead: 9, temporal: { kind: 'PINNED', at: SP(3) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    expect(goLiveAndLocate(returnSurface(store), { liveContext: providing(contextAt(liveWorld(9))) }).outcome).toBe('APPLIED');

    expect(Object.keys(store.getState()).sort()).toEqual([...CANONICAL_STATE_KEYS].sort());
    for (const entry of store.getState().history) {
      expect(Object.keys(entry).sort()).toEqual(['act', 'captured']);
      expect(Object.keys(entry.captured).sort()).toEqual(['camera', 'ifRef', 'tc', 'tmProvenance']);
    }
    // No return-specific key of any kind entered canonical state.
    const serialized = JSON.stringify(store.getState());
    for (const forbidden of ['RETURNING', 'SETTLING', 'RETURN_TARGET', 'BACK_CURSOR', 'P5_LF', 'RETURN_EPOCH', 'RETURN_STACK', 'PTC', 'IF_render']) {
      expect(serialized.includes(forbidden)).toBe(false);
    }
  });

  it('there is no third temporal mode: every act leaves TM as FOLLOW_LIVE or PINNED', () => {
    const store = returnTestStore({ liveHead: 9, temporal: { kind: 'PINNED', at: SP(3) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    const surface = returnSurface(store);
    expect(goLiveAndLocate(surface, { liveContext: providing(contextAt(liveWorld(9))) }).outcome).toBe('APPLIED');
    expect(store.getState().temporal.kind).toBe('FOLLOW_LIVE');
    expect(backOneStep(surface).outcome).toBe('APPLIED');
    expect(store.getState().temporal.kind).toBe('PINNED');
    expect(['FOLLOW_LIVE', 'PINNED']).toContain(store.getState().temporal.kind);
  });
});
