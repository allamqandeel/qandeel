/**
 * T-07 — RN07-E: `RETURN_LIVE_HEAD`.
 *
 * Temporal only, and the trap is passive live truth: a Live Head that advances around the act must
 * never make a no-op look effective, and must never make an effective act record the wrong position.
 */
import { sessionPosition } from '../../state';
import { zoomSemanticStep } from '../../map';
import { backOneStep, returnLiveHead } from '../return-actions';
import { countingStore, interposingPreview, permissiveReturnStore, returnSurface, returnTestStore, viewpoint } from '../__fixtures__/return';

const SP = sessionPosition;

describe('RN07-E — Return to Live Head', () => {
  it('E39 — from a historical position: FOLLOW_LIVE at the current Live Head, camera and inspection unchanged', () => {
    const store = returnTestStore({ liveHead: 60, temporal: { kind: 'PINNED', at: SP(20) } });
    const camera = store.getState().camera;
    const inspection = store.getState().inspection;

    const outcome = returnLiveHead(returnSurface(store));
    expect(outcome.outcome === 'APPLIED' && outcome.consumed).toBe(0);
    expect(outcome.outcome === 'APPLIED' && outcome.locate).toBe('NOT_ATTEMPTED');
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(store.getState().camera).toBe(camera);
    expect(store.getState().inspection).toBe(inspection);
    expect(store.getState().live.LH).toBe(60);
  });

  it('E40 — one Back afterwards restores the exact pre-return historical viewpoint', () => {
    const store = returnTestStore({ liveHead: 60, temporal: { kind: 'PINNED', at: SP(60) } });
    expect(store.dispatch({ type: 'COMMIT_MOMENT', moment: SP(20) }).outcome).toBe('APPLIED');
    expect(zoomSemanticStep(store, 'IN').outcome).toBe('APPLIED');
    const historical = viewpoint(store.getState());
    const depth = store.getState().camera.depth;

    const surface = returnSurface(store);
    expect(returnLiveHead(surface).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(3);
    expect(store.getState().history[2].act).toBe('RETURN_LIVE_HEAD');
    expect(store.getState().history[2].captured.tc).toBe(20);

    expect(backOneStep(surface).outcome).toBe('APPLIED');
    expect(viewpoint(store.getState())).toEqual(historical);
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 20 });
    expect(store.getState().camera.depth).toBe(depth);
  });

  it('E41 — already FOLLOW_LIVE: a true no-op that records nothing', () => {
    const store = returnTestStore({ liveHead: 12 });
    const before = store.getState();
    const outcome = returnLiveHead(returnSurface(store));
    expect(outcome).toEqual({ outcome: 'NO_OP', reason: 'ALREADY_FOLLOWING_LIVE', locate: 'NOT_ATTEMPTED' });
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('E42 — a Live Head advance while the act is in flight produces no action-attributable RH', () => {
    const store = returnTestStore({ liveHead: 12 });
    const counting = countingStore(store);
    // The advance is delivered from inside the act, on the cancellation that opens it, so it lands
    // between activation and the transition rather than merely before or after.
    const preview = interposingPreview(() => {
      store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(40) });
    });
    const outcome = returnLiveHead({ store: counting.store, preview });
    expect(outcome).toEqual({ outcome: 'NO_OP', reason: 'ALREADY_FOLLOWING_LIVE', locate: 'NOT_ATTEMPTED' });
    expect(store.getState().live.LH).toBe(40);
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(store.getState().history).toHaveLength(0);
    expect(counting.counts.returns).toBe(1);
  });

  it('E43 — a Live Head change around the act never produces a stale PINNED(old LH)', () => {
    const store = returnTestStore({ liveHead: 12, temporal: { kind: 'PINNED', at: SP(5) } });
    const preview = interposingPreview(() => {
      store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(41) });
    });
    expect(returnLiveHead({ store, preview }).outcome).toBe('APPLIED');
    // The act writes a MODE, never a position: the effective TC is derived from whatever `LH` is.
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(store.getState().live.LH).toBe(41);
    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().history[0].captured.tc).toBe(5);
    expect(store.getState().history[0].captured.tmProvenance).toEqual({ kind: 'PINNED', at: 5 });
  });

  it('before the first mirrored Session Position there is nothing to return to', () => {
    const store = permissiveReturnStore({ liveHead: null });
    expect(store.getState().live.LH).toBeNull();
    const before = store.getState();
    expect(() => store.dispatchReturn({ type: 'RETURN_LIVE_HEAD' })).toThrow(/there is no Live Head to return to/u);
    expect(() => store.dispatchReturn({ type: 'GO_LIVE_AND_LOCATE' })).toThrow(/there is no Live Head to return to/u);
    expect(store.getState()).toBe(before);
    // ...and the executor answers with a typed refusal rather than an exception.
    const outcome = returnLiveHead(returnSurface(returnTestStore({ liveHead: null })));
    expect(outcome.outcome === 'REJECTED' && outcome.code).toBe('PRECONDITION_FAILED');
  });
});
