/**
 * T-06 — TN06-11, TN06-12.
 *
 * Relative forward continuation is ephemeral until an explicit commit, it stops at the authoritative
 * Live Head, and reaching the Live Head is not Live intent. Cancelling one produces zero canonical
 * mutation and zero RH.
 */
import { sessionPosition } from '../../state';
import { createForwardContinuation } from '../continuation';
import { createTemporalPreviewController } from '../preview';
import { commitPreviewedTarget, disclosedTargetAuthority, nextDisclosedTarget, nextForwardTarget, temporalTargeting } from '../targeting';
import { fullyDisclosedTargeting, temporalTestStore, trackOf } from '../__fixtures__/temporal';

describe('TN06-11 — relative forward continuation', () => {
  it('advances the ephemeral target one addressable Session Position at a time', () => {
    const store = temporalTestStore({ liveHead: 6, temporal: { kind: 'PINNED', at: sessionPosition(2) } });
    const preview = createTemporalPreviewController();
    const continuation = createForwardContinuation(preview);
    const before = store.getState();

    expect(continuation.step(fullyDisclosedTargeting(store)).outcome).toBe('PREVIEWING');
    expect(preview.getSnapshot()).toMatchObject({ ptc: 3, source: 'RELATIVE_FORWARD' });
    continuation.step(fullyDisclosedTargeting(store));
    continuation.step(fullyDisclosedTargeting(store));
    expect(preview.getSnapshot()).toMatchObject({ ptc: 5 });

    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('never crosses the Live Head, and holds there however long it is held', () => {
    const store = temporalTestStore({ liveHead: 4, temporal: { kind: 'PINNED', at: sessionPosition(3) } });
    const preview = createTemporalPreviewController();
    const continuation = createForwardContinuation(preview);
    const bounds = fullyDisclosedTargeting(store);

    expect(continuation.step(bounds)).toMatchObject({ outcome: 'PREVIEWING' });
    expect(preview.getSnapshot()).toMatchObject({ ptc: 4 });
    for (let i = 0; i < 25; i += 1) expect(continuation.step(bounds)).toEqual({ outcome: 'UNCHANGED' });
    expect(preview.getSnapshot()).toMatchObject({ ptc: 4 });
  });

  it('holding at the Live Head still commits PINNED(LH), never FOLLOW_LIVE', () => {
    const store = temporalTestStore({ liveHead: 4, temporal: { kind: 'PINNED', at: sessionPosition(3) } });
    const preview = createTemporalPreviewController();
    const continuation = createForwardContinuation(preview);
    continuation.step(fullyDisclosedTargeting(store));
    continuation.step(fullyDisclosedTargeting(store));

    expect(commitPreviewedTarget(store, preview, fullyDisclosedTargeting(store)).outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 4 });
  });

  it('follows an authoritative Live Head that advances mid-hold, without ever passing it', () => {
    const store = temporalTestStore({ liveHead: 3, temporal: { kind: 'PINNED', at: sessionPosition(2) } });
    const preview = createTemporalPreviewController();
    const continuation = createForwardContinuation(preview);

    continuation.step(fullyDisclosedTargeting(store));
    expect(preview.getSnapshot()).toMatchObject({ ptc: 3 });
    expect(continuation.step(fullyDisclosedTargeting(store))).toEqual({ outcome: 'UNCHANGED' });

    store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: sessionPosition(5) });
    expect(continuation.step(fullyDisclosedTargeting(store))).toMatchObject({ outcome: 'PREVIEWING' });
    expect(preview.getSnapshot()).toMatchObject({ ptc: 4 });
    // Still ephemeral: the advancing Live Head committed nothing on the continuation's behalf.
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 2 });
    expect(store.getState().history).toHaveLength(0);
  });

  it('starts from committed truth when no preview is open, and refuses before the first Moment', () => {
    const store = temporalTestStore({ liveHead: 6 });
    const preview = createTemporalPreviewController();
    const continuation = createForwardContinuation(preview);
    // FOLLOW_LIVE at LH = 6: there is nothing later, so a first step changes nothing.
    expect(continuation.step(fullyDisclosedTargeting(store))).toEqual({ outcome: 'UNCHANGED' });

    const empty = {
      bounds: { sessionId: 'session-1', liveHead: null, mode: 'FOLLOW_LIVE' as const, committedTc: null },
      disclosed: disclosedTargetAuthority(trackOf('session-1', 0)),
    };
    expect(continuation.step(empty)).toMatchObject({ outcome: 'REJECTED', code: 'NO_ADDRESSABLE_POSITION' });
  });

  it('repeats on its own cadence and stops when it is held', () => {
    jest.useFakeTimers();
    try {
      const store = temporalTestStore({ liveHead: 9, temporal: { kind: 'PINNED', at: sessionPosition(1) } });
      const preview = createTemporalPreviewController();
      const continuation = createForwardContinuation(preview, { intervalMs: 50 });

      expect(continuation.begin(() => fullyDisclosedTargeting(store)).outcome).toBe('PREVIEWING');
      expect(preview.getSnapshot()).toMatchObject({ ptc: 2 });
      expect(continuation.running).toBe(true);

      jest.advanceTimersByTime(150);
      expect(preview.getSnapshot()).toMatchObject({ ptc: 5 });

      continuation.hold();
      expect(continuation.running).toBe(false);
      jest.advanceTimersByTime(500);
      // Holding leaves the target in place: it commits nothing and cancels nothing.
      expect(preview.getSnapshot()).toMatchObject({ ptc: 5 });
      expect(store.getState().history).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('exposes the boundary as a distinct answer rather than a refusal', () => {
    const bounds = { sessionId: 'session-1', liveHead: sessionPosition(4), mode: 'PINNED' as const, committedTc: sessionPosition(4) };
    expect(nextForwardTarget(bounds, 4)).toEqual({ outcome: 'AT_LIVE_HEAD', sp: 4 });
    expect(nextForwardTarget(bounds, 3)).toEqual({ outcome: 'STEP', sp: 4 });
    expect(nextForwardTarget(bounds, 5)).toMatchObject({ outcome: 'REJECTED', code: 'BEYOND_LIVE_HEAD' });
  });

  it('R1-01 — keeps the canonical bound and the disclosure horizon as two distinguishable answers', () => {
    const store = temporalTestStore({ liveHead: 100, temporal: { kind: 'PINNED', at: sessionPosition(79) } });
    const partial = temporalTargeting(store.getState(), trackOf('session-1', 80));
    const complete = temporalTargeting(store.getState(), trackOf('session-1', 100));

    expect(nextDisclosedTarget(partial, 79)).toEqual({ outcome: 'STEP', sp: 80 });
    expect(nextDisclosedTarget(partial, 80)).toEqual({ outcome: 'AT_DISCLOSURE_HORIZON', sp: 80 });
    expect(nextDisclosedTarget(complete, 80)).toEqual({ outcome: 'STEP', sp: 81 });
    expect(nextDisclosedTarget(complete, 100)).toEqual({ outcome: 'AT_LIVE_HEAD', sp: 100 });
    // A position outside disclosure cannot even be a starting point for a step.
    expect(nextDisclosedTarget(partial, 90)).toMatchObject({ outcome: 'REJECTED', code: 'NOT_DISCLOSED' });
  });
});

describe('TN06-12 — cancellation under continuation', () => {
  it('produces zero canonical mutation and zero RH', () => {
    jest.useFakeTimers();
    try {
      const store = temporalTestStore({ liveHead: 9, temporal: { kind: 'PINNED', at: sessionPosition(1) } });
      const preview = createTemporalPreviewController();
      const continuation = createForwardContinuation(preview, { intervalMs: 50 });
      const before = store.getState();

      continuation.begin(() => fullyDisclosedTargeting(store));
      jest.advanceTimersByTime(200);
      expect(preview.getSnapshot().status).toBe('PREVIEWING');

      expect(continuation.abort()).toEqual({ outcome: 'CLEARED' });

      expect(continuation.running).toBe(false);
      expect(preview.getSnapshot()).toEqual({ status: 'IDLE' });
      expect(store.getState()).toBe(before);
      expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 1 });
      expect(store.getState().history).toHaveLength(0);

      // The timer really is gone: no late tick resurrects the cancelled target.
      jest.advanceTimersByTime(1000);
      expect(preview.getSnapshot()).toEqual({ status: 'IDLE' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('never starts a repetition from a refused first step', () => {
    jest.useFakeTimers();
    try {
      const preview = createTemporalPreviewController();
      const continuation = createForwardContinuation(preview, { intervalMs: 10 });
      const empty = {
      bounds: { sessionId: 'session-1', liveHead: null, mode: 'FOLLOW_LIVE' as const, committedTc: null },
      disclosed: disclosedTargetAuthority(trackOf('session-1', 0)),
    };

      expect(continuation.begin(() => empty)).toMatchObject({ outcome: 'REJECTED' });
      expect(continuation.running).toBe(false);
      jest.advanceTimersByTime(1000);
      expect(preview.getSnapshot()).toEqual({ status: 'IDLE' });
    } finally {
      jest.useRealTimers();
    }
  });
});
