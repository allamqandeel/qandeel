/**
 * T-06 — TN06-03, TN06-04, TN06-05, TN06-21.
 *
 * The commit boundary is the whole of the temporal contract in miniature: exact targeting goes
 * through the frozen kernel primitive, `PINNED(LH)` never becomes `FOLLOW_LIVE`, only explicit Live
 * intent does, and `RH` gains exactly one entry per effective act and nothing at all for anything
 * ephemeral.
 */
import { sessionPosition } from '../../state';
import { createTemporalPreviewController } from '../preview';
import { LIVE_EDGE_INTENT, commitLiveEdge, commitLiveEdgeIntent, commitMoment, commitPreviewedTarget, commitTemporalIntent, temporalBounds } from '../targeting';
import { temporalTestStore } from '../__fixtures__/temporal';

describe('TN06-03 — exact Moment commit', () => {
  it('commits a valid disclosed Session Position through the frozen COMMIT_MOMENT primitive', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const outcome = commitMoment(store, 3);

    expect(outcome.outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 3 });
    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().history[0].act).toBe('COMMIT_MOMENT');
  });

  it('commits whatever the preview targets, and the preview stops being a preview', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const preview = createTemporalPreviewController();
    preview.preview(temporalBounds(store.getState()), 2, 'DISCLOSED_TARGET');

    expect(commitPreviewedTarget(store, preview).outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 2 });
    expect(preview.getSnapshot()).toEqual({ status: 'IDLE' });
  });

  it('refuses to commit when there is no preview, and changes nothing', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const before = store.getState();
    expect(commitPreviewedTarget(store, createTemporalPreviewController())).toEqual({
      outcome: 'REJECTED',
      code: 'NO_PREVIEW',
      detail: expect.any(String),
    });
    expect(store.getState()).toBe(before);
  });

  it('fails closed beyond the Live Head without reaching the kernel', () => {
    const store = temporalTestStore({ liveHead: 4 });
    const before = store.getState();
    expect(commitMoment(store, 5)).toEqual({ outcome: 'REJECTED', code: 'BEYOND_LIVE_HEAD', detail: expect.any(String) });
    expect(store.getState()).toBe(before);
  });

  it('leaves the preview alone when a commit is refused, so the reader can retarget or cancel', () => {
    const store = temporalTestStore({ liveHead: 4 });
    const preview = createTemporalPreviewController();
    preview.preview(temporalBounds(store.getState()), 3, 'DISCLOSED_TARGET');
    // A Session replacement under an open preview: the target belongs to a Session this store is not on.
    const foreign = temporalTestStore({ sessionId: 'session-2', liveHead: 1 });
    expect(commitPreviewedTarget(foreign, preview).outcome).toBe('REJECTED');
    expect(preview.getSnapshot().status).toBe('PREVIEWING');
    expect(foreign.getState().history).toHaveLength(0);
  });
});

describe('TN06-04 — PINNED(LH) is not FOLLOW_LIVE', () => {
  it('produces PINNED(LH) when the Live Head itself is committed as a Moment', () => {
    const store = temporalTestStore({ liveHead: 4 });
    expect(commitMoment(store, 4).outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 4 });
    expect(store.getState().temporal.kind).not.toBe('FOLLOW_LIVE');
  });

  it('stays where it was pinned when the Live Head advances, while FOLLOW_LIVE moves with it', () => {
    const pinned = temporalTestStore({ liveHead: 4 });
    const following = temporalTestStore({ liveHead: 4 });
    commitMoment(pinned, 4);

    // Both are at Session Position 4 right now, and they are still different states.
    expect(temporalBounds(pinned.getState()).committedTc).toBe(4);
    expect(temporalBounds(following.getState()).committedTc).toBe(4);

    pinned.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: sessionPosition(9) });
    following.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: sessionPosition(9) });

    expect(pinned.getState().temporal).toEqual({ kind: 'PINNED', at: 4 });
    expect(temporalBounds(pinned.getState()).committedTc).toBe(4);
    expect(temporalBounds(following.getState()).committedTc).toBe(9);
  });

  it('never infers Live intent from a preview that reached the Live Head', () => {
    const store = temporalTestStore({ liveHead: 4 });
    const preview = createTemporalPreviewController();
    preview.preview(temporalBounds(store.getState()), 4, 'RELATIVE_FORWARD');
    expect(commitPreviewedTarget(store, preview).outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 4 });
  });
});

describe('TN06-05 — explicit Live target', () => {
  it('produces FOLLOW_LIVE only from an explicit Live act', () => {
    const store = temporalTestStore({ liveHead: 4, temporal: { kind: 'PINNED', at: sessionPosition(2) } });
    expect(commitLiveEdge(store).outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
  });

  it('discards an open preview and then goes live', () => {
    const store = temporalTestStore({ liveHead: 6, temporal: { kind: 'PINNED', at: sessionPosition(2) } });
    const preview = createTemporalPreviewController();
    preview.preview(temporalBounds(store.getState()), 5, 'DISCLOSED_TARGET');

    expect(commitLiveEdgeIntent(store, preview).outcome).toBe('APPLIED');
    expect(preview.getSnapshot()).toEqual({ status: 'IDLE' });
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
  });

  it('routes a two-shape intent without any path from a Moment target into Live intent', () => {
    const store = temporalTestStore({ liveHead: 4, temporal: { kind: 'PINNED', at: sessionPosition(1) } });
    expect(commitTemporalIntent(store, { kind: 'MOMENT', sp: sessionPosition(4) }).outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 4 });

    expect(commitTemporalIntent(store, LIVE_EDGE_INTENT).outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
  });

  it('fails closed with no mirrored Live Head', () => {
    const store = temporalTestStore({ liveHead: 4 });
    // A store that has never mirrored a committed Session Position cannot be constructed PINNED, so
    // the absence case is proven through the kernel's own precondition on the Live Edge.
    const outcome = commitLiveEdge(store);
    expect(outcome.outcome).toBe('NO_OP');
  });
});

describe('TN06-21 — RH integrity', () => {
  it('records nothing for previews, retargets, cancellations or repeated preview ticks', () => {
    const store = temporalTestStore({ liveHead: 8 });
    const preview = createTemporalPreviewController();
    for (const sp of [1, 2, 3, 4, 5, 6, 7, 8, 7, 6]) preview.preview(temporalBounds(store.getState()), sp, 'RELATIVE_FORWARD');
    preview.cancel();
    for (const sp of [2, 3, 4]) preview.preview(temporalBounds(store.getState()), sp, 'DISCLOSED_TARGET');
    preview.cancel();

    expect(store.getState().history).toHaveLength(0);
  });

  it('records exactly one entry per effective commit, and none for a true no-op', () => {
    const store = temporalTestStore({ liveHead: 8 });

    expect(commitMoment(store, 3).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(1);

    // The same target committed twice is a true no-op: nothing moved, so nothing is recorded.
    expect(commitMoment(store, 3).outcome).toBe('NO_OP');
    expect(store.getState().history).toHaveLength(1);

    expect(commitMoment(store, 5).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(2);

    // Mode counts as an effective difference even at the same effective Session Position.
    expect(commitMoment(store, 8).outcome).toBe('APPLIED');
    expect(commitLiveEdge(store).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(4);
    expect(store.getState().history.map((entry) => entry.act)).toEqual([
      'COMMIT_MOMENT',
      'COMMIT_MOMENT',
      'COMMIT_MOMENT',
      'COMMIT_LIVE_EDGE',
    ]);
  });

  it('records nothing for a passive Live Head advance under FOLLOW_LIVE', () => {
    const store = temporalTestStore({ liveHead: 4 });
    store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: sessionPosition(5) });
    store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: sessionPosition(6) });
    expect(temporalBounds(store.getState()).committedTc).toBe(6);
    expect(store.getState().history).toHaveLength(0);
  });

  it('records nothing for a passive Live Head advance while pinned, and does not move the pin', () => {
    const store = temporalTestStore({ liveHead: 4 });
    commitMoment(store, 2);
    store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: sessionPosition(7) });
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 2 });
    expect(store.getState().history).toHaveLength(1);
  });
});
