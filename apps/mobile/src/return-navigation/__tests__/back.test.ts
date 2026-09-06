/**
 * T-07 — RN07-B: `BACK_ONE_STEP`.
 *
 * Back reverses the latest effective user-visible transaction, exactly once, and appends nothing.
 * The defect this suite exists to catch is the oscillation that appears the moment a restoration is
 * run through the append path: Back records the state it left, and the next Back walks forward again.
 */
import { RETURN_ACTION_TYPES, opaqueRef, sessionPosition, type CanonicalStore } from '../../state';
import { panByTranslation, zoomSemanticStep } from '../../map';
import { backOneStep } from '../history-restoration';
import { returnLiveHead } from '../live-head';
import { returnSurface, returnTestStore, unavailableInspectionRef, viewpoint } from '../__fixtures__/return';

const SP = sessionPosition;

/** Three real, effective transactions, each appending exactly one checkpoint. */
function threeSteps(store: CanonicalStore): void {
  expect(panByTranslation(store, 100, 0).outcome).toBe('APPLIED');
  expect(panByTranslation(store, 0, 100).outcome).toBe('APPLIED');
  expect(zoomSemanticStep(store, 'IN').outcome).toBe('APPLIED');
  expect(store.getState().history).toHaveLength(3);
}

describe('RN07-B — Back One Step', () => {
  it('B11 — an empty history is a no-op: no state mutation and no refusal dressed up as an act', () => {
    const store = returnTestStore();
    const before = store.getState();
    const outcome = backOneStep(returnSurface(store));
    expect(outcome).toEqual({ outcome: 'NO_OP', reason: 'EMPTY_HISTORY', locate: 'NOT_ATTEMPTED' });
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('B12, B19 — one entry: exact restoration, one entry popped, nothing appended', () => {
    const store = returnTestStore({ temporal: { kind: 'PINNED', at: SP(3) } });
    const start = viewpoint(store.getState());
    expect(panByTranslation(store, 240, 0).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(1);

    const outcome = backOneStep(returnSurface(store));
    expect(outcome).toEqual({ outcome: 'APPLIED', entry: null, consumed: 1, locate: 'NOT_ATTEMPTED' });
    expect(store.getState().history).toHaveLength(0);
    expect(viewpoint(store.getState())).toEqual(start);
  });

  it('B13, B20 — three entries reverse in exact order, and a second Back never walks forward again', () => {
    const store = returnTestStore({ temporal: { kind: 'PINNED', at: SP(3) } });
    const v0 = viewpoint(store.getState());
    expect(panByTranslation(store, 100, 0).outcome).toBe('APPLIED');
    const v1 = viewpoint(store.getState());
    expect(panByTranslation(store, 0, 100).outcome).toBe('APPLIED');
    const v2 = viewpoint(store.getState());
    expect(zoomSemanticStep(store, 'IN').outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(3);

    const surface = returnSurface(store);
    expect(backOneStep(surface).outcome).toBe('APPLIED');
    expect(viewpoint(store.getState())).toEqual(v2);
    expect(store.getState().history).toHaveLength(2);

    expect(backOneStep(surface).outcome).toBe('APPLIED');
    expect(viewpoint(store.getState())).toEqual(v1);
    expect(store.getState().history).toHaveLength(1);

    expect(backOneStep(surface).outcome).toBe('APPLIED');
    expect(viewpoint(store.getState())).toEqual(v0);
    expect(store.getState().history).toHaveLength(0);

    // A fourth Back has nothing to reverse. It does not oscillate forward, and it records nothing.
    const settled = store.getState();
    expect(backOneStep(surface)).toEqual({ outcome: 'NO_OP', reason: 'EMPTY_HISTORY', locate: 'NOT_ATTEMPTED' });
    expect(store.getState()).toBe(settled);
  });

  it('B14, B15 — a checkpoint captured while FOLLOW_LIVE restores PINNED(capturedTC), never Live', () => {
    const store = returnTestStore({ liveHead: 30 });
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });

    // FOLLOW_LIVE @ SP(30) → pin SP(12): the checkpoint records FOLLOW_LIVE as PROVENANCE at tc 30.
    expect(store.dispatch({ type: 'COMMIT_MOMENT', moment: SP(12) }).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().history[0].captured.tmProvenance).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(store.getState().history[0].captured.tc).toBe(30);

    // Live advances to SP(44) while the reader is pinned.
    expect(store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(44) }).outcome).toBe('APPLIED');

    expect(backOneStep(returnSurface(store)).outcome).toBe('APPLIED');
    // The frozen answer: PINNED(30). Never FOLLOW_LIVE, and never PINNED(44).
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 30 });
    expect(store.getState().live.LH).toBe(44);
  });

  it('B16 — a Live Focus transition after the checkpoint is genuinely live, and is not restored', () => {
    const store = returnTestStore({ liveHead: 8, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' }, liveFocusAtSp: 2 });
    expect(panByTranslation(store, 90, 0).outcome).toBe('APPLIED');
    expect(store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-b' }, atSp: SP(7) }).outcome).toBe('APPLIED');

    expect(backOneStep(returnSurface(store)).outcome).toBe('APPLIED');
    expect(store.getState().live.LF).toEqual({ value: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-b' }, atSp: 7 });
    expect(store.getState().history).toHaveLength(0);
  });

  it('B17, B18 — an unavailable reference and a sparse camera are restored exactly, never repaired', () => {
    const ref = unavailableInspectionRef();
    const store = returnTestStore({ temporal: { kind: 'PINNED', at: SP(2) }, depth: 'ANALYTICAL_OBJECT', inspection: ref });
    const camera = store.getState().camera;
    expect(store.getState().inspection).toEqual(ref);

    // One real effective act: the checkpoint carries the exact reference and the exact camera.
    expect(panByTranslation(store, 300, 0).outcome).toBe('APPLIED');
    const captured = store.getState().history[0].captured;
    expect(captured.ifRef).toEqual(ref);
    expect(captured.camera).toEqual(camera);
    // Then the inspection is replaced by a completely different one, so restoration has work to do.
    const other = returnTestStore({ inspection: null });
    expect(other.getState().inspection).toBeNull();

    expect(backOneStep(returnSurface(store)).outcome).toBe('APPLIED');
    // The exact contextual, version and lineage references come back byte for byte: nothing is
    // substituted for a renderable neighbour, nothing is recentred, and no version is elected.
    expect(store.getState().inspection).toEqual(ref);
    expect(store.getState().inspection?.version).toEqual(opaqueRef('VERSION', { version: 3 }));
    expect(store.getState().inspection?.contextualAppearance).toEqual(opaqueRef('CONTEXTUAL_APPEARANCE', { kind: 'THREAD_READING', bindingId: 'binding-x' }));
    expect(store.getState().camera).toEqual(camera);
    expect(store.getState().camera.destination).toBeUndefined();
  });

  it('B19 — Back appends nothing, ever, and no return identity can be appended by a Back chain', () => {
    const store = returnTestStore({ temporal: { kind: 'PINNED', at: SP(3) } });
    threeSteps(store);
    const surface = returnSurface(store);
    const acts: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      backOneStep(surface);
      acts.push(...store.getState().history.map((entry) => entry.act));
    }
    expect(store.getState().history).toHaveLength(0);
    for (const act of acts) expect(RETURN_ACTION_TYPES.includes(act as never)).toBe(false);
  });

  it('a restoration that lands on an identical viewpoint still consumes its checkpoint', () => {
    // FOLLOW_LIVE @ LH, then Commit Moment(LH): `Φ_eff` moves because the MODE moved, and the
    // checkpoint captures FOLLOW_LIVE at the same Session Position. Restoring it produces
    // PINNED(LH) — which is exactly where the reader already is — and Back must still move.
    const store = returnTestStore({ liveHead: 5 });
    expect(store.dispatch({ type: 'COMMIT_MOMENT', moment: SP(5) }).outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 5 });
    expect(store.getState().history).toHaveLength(1);

    const outcome = backOneStep(returnSurface(store));
    expect(outcome).toEqual({ outcome: 'APPLIED', entry: null, consumed: 1, locate: 'NOT_ATTEMPTED' });
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 5 });
    expect(store.getState().history).toHaveLength(0);
  });

  it('an effective Return to Live Head is reversed by exactly one Back', () => {
    const store = returnTestStore({ liveHead: 20, temporal: { kind: 'PINNED', at: SP(6) } });
    expect(zoomSemanticStep(store, 'IN').outcome).toBe('APPLIED');
    const historical = viewpoint(store.getState());
    const depth = store.getState().camera.depth;

    const surface = returnSurface(store);
    expect(returnLiveHead(surface).outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });

    expect(backOneStep(surface).outcome).toBe('APPLIED');
    expect(viewpoint(store.getState())).toEqual(historical);
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 6 });
    expect(store.getState().camera.depth).toBe(depth);
  });
});
