/**
 * T-07 — RN07-I: mixed chains, and the boundaries the return layer must not cross.
 *
 * A chain is where a history defect actually shows: one wrong append, one wrong consumption, one
 * passive event counted as an act, and the reverse order stops matching what the reader did.
 */
import { CANONICAL_STATE_KEYS, RETURN_ACTION_TYPES, sessionPosition } from '../../state';
import { panByTranslation, zoomSemanticStep } from '../../map';
import { commitMoment } from '../../temporal-navigation';
import { backOneStep, exactReturn, returnLiveFocus, returnLiveHead, returnWorld } from '../return-actions';
import { returnCheckpoints } from '../checkpoint-target';
import { RETURN_ACT_IDS, returnAvailability } from '../availability';
import { contextAt, returnSurface, returnTestStore, spatialViewpoint, viewpoint, world } from '../__fixtures__/return';

const SP = sessionPosition;
const THREAD_A = { id: 'thread-a', x: '1000000', y: '0' };

describe('RN07-I — mixed chains and layer boundaries', () => {
  it('I74 — Pan → Pin → Inspect-depth → Return World → Back → Back reverses in exact order', () => {
    const store = returnTestStore({ liveHead: 12, temporal: { kind: 'PINNED', at: SP(9) } });
    const surface = returnSurface(store);

    const v0 = viewpoint(store.getState());
    expect(panByTranslation(store, 320, 0).outcome).toBe('APPLIED');
    const v1 = viewpoint(store.getState());
    expect(commitMoment(store, SP(5)).outcome).toBe('APPLIED');
    const v2 = viewpoint(store.getState());
    expect(zoomSemanticStep(store, 'IN').outcome).toBe('APPLIED');
    const v3 = viewpoint(store.getState());
    expect(returnWorld(surface).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(4);

    expect(backOneStep(surface).outcome).toBe('APPLIED');
    expect(viewpoint(store.getState())).toEqual(v3);
    expect(backOneStep(surface).outcome).toBe('APPLIED');
    expect(viewpoint(store.getState())).toEqual(v2);
    expect(backOneStep(surface).outcome).toBe('APPLIED');
    expect(viewpoint(store.getState())).toEqual(v1);
    expect(backOneStep(surface).outcome).toBe('APPLIED');
    expect(viewpoint(store.getState())).toEqual(v0);
    expect(store.getState().history).toHaveLength(0);
  });

  it('I75 — Return Live → Pan → Back → Back: the first reverses the Pan, the second the Live return', () => {
    const store = returnTestStore({ liveHead: 12, temporal: { kind: 'PINNED', at: SP(4) } });
    const surface = returnSurface(store);
    const historical = viewpoint(store.getState());

    expect(returnLiveHead(surface).outcome).toBe('APPLIED');
    const live = spatialViewpoint(store.getState());
    expect(panByTranslation(store, 200, 0).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(2);

    expect(backOneStep(surface).outcome).toBe('APPLIED');
    // The Pan is reversed exactly. Its checkpoint was captured while FOLLOW_LIVE at Session Position
    // 12, so the frozen restoration is PINNED(12): a restored viewpoint never reattaches to Live.
    expect(spatialViewpoint(store.getState())).toEqual(live);
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 12 });

    expect(backOneStep(surface).outcome).toBe('APPLIED');
    expect(viewpoint(store.getState())).toEqual(historical);
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 4 });
    expect(store.getState().history).toHaveLength(0);
  });

  it('I76 — a temporal commit and a one-shot focus return reverse as two exact steps, in order', () => {
    const store = returnTestStore({ liveHead: 12, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-a' } });
    const surface = returnSurface(store);
    const start = spatialViewpoint(store.getState());

    // Each act appends exactly one checkpoint, and each Back reverses exactly one of them.
    expect(commitMoment(store, SP(6)).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(1);
    const pinned = viewpoint(store.getState());

    expect(returnLiveFocus(surface, { context: contextAt(world({ depth: 'SESSION', tc: 6, liveHead: 12, threads: [THREAD_A] })) }).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(2);

    expect(backOneStep(surface).outcome).toBe('APPLIED');
    expect(viewpoint(store.getState())).toEqual(pinned);
    expect(backOneStep(surface).outcome).toBe('APPLIED');
    expect(spatialViewpoint(store.getState())).toEqual(start);
    // The pre-commit stance was FOLLOW_LIVE at Session Position 12; the restoration is PINNED(12).
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 12 });
    expect(store.getState().history).toHaveLength(0);
  });

  it('I77 — rapid passive Live Head and Live Focus events between explicit returns create zero extra RH', () => {
    const store = returnTestStore({ liveHead: 12, temporal: { kind: 'PINNED', at: SP(4) } });
    const surface = returnSurface(store);
    expect(panByTranslation(store, 100, 0).outcome).toBe('APPLIED');
    const afterOneAct = store.getState().history.length;

    for (let sp = 13; sp <= 25; sp += 1) {
      store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(sp) });
      store.ingest({ type: 'LIVE_FOCUS_TRANSITION', value: { kind: 'ESTABLISHED_THREAD', threadId: `thread-${sp}` }, atSp: SP(sp) });
    }
    expect(store.getState().history).toHaveLength(afterOneAct);
    expect(store.getState().live.LH).toBe(25);

    expect(returnLiveHead(surface).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(afterOneAct + 1);
    // ...and the events between the two acts appended nothing of their own.
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['PAN', 'RETURN_LIVE_HEAD']);
  });

  it('I78 — a checkpoint target from a replaced Session never authorizes anything', () => {
    const first = returnTestStore({ sessionId: 'session-1', liveHead: 9 });
    expect(panByTranslation(first, 100, 0).outcome).toBe('APPLIED');
    const target = returnCheckpoints(first)[0];

    // A replaced Session is a NEW store: canonical Session identity is immutable.
    const replaced = returnTestStore({ sessionId: 'session-2', liveHead: 9 });
    expect(panByTranslation(replaced, 100, 0).outcome).toBe('APPLIED');
    const before = replaced.getState();

    const outcome = exactReturn(returnSurface(replaced), target);
    expect(outcome.outcome === 'REJECTED' && outcome.code).toBe('INVALID_INPUT');
    expect(replaced.getState()).toBe(before);
  });

  it('I79, I80 — no return route mutates presentation state, adds a canonical key or a third mode', () => {
    const store = returnTestStore({ liveHead: 12, temporal: { kind: 'PINNED', at: SP(4) } });
    const surface = returnSurface(store);
    expect(returnLiveHead(surface).outcome).toBe('APPLIED');
    expect(returnWorld(surface).outcome).toBe('APPLIED');
    expect(backOneStep(surface).outcome).toBe('APPLIED');
    expect(backOneStep(surface).outcome).toBe('APPLIED');

    expect(Object.keys(store.getState()).sort()).toEqual([...CANONICAL_STATE_KEYS].sort());
    expect(['FOLLOW_LIVE', 'PINNED']).toContain(store.getState().temporal.kind);
    expect(store.getState().history).toHaveLength(0);
    // Every checkpoint records a T-04 / T-06 / T-07 Product identity and nothing else: no route
    // event, no presentation move, no preview and no passive mirror update can enter RH.
    expect(store.getState().history.map((entry) => entry.act)).toEqual([]);
  });

  it('the availability substrate states no identity, place, direction or count of anything in the world', () => {
    const store = returnTestStore({ liveHead: 30, temporal: { kind: 'PINNED', at: SP(4) }, liveFocus: { kind: 'ESTABLISHED_THREAD', threadId: 'thread-secret' } });
    expect(panByTranslation(store, 250, 0).outcome).toBe('APPLIED');

    const availability = returnAvailability(store.getState());
    expect(availability).toEqual({
      liveReturnAvailable: true,
      historical: true,
      worldReturnAvailable: true,
      backAvailable: true,
      checkpointCount: 1,
    });
    // Generic by construction: nothing in it names the Thread, its Home or a direction to it.
    expect(JSON.stringify(availability)).not.toMatch(/thread|secret|anchor|destination|1000000/iu);
    expect([...RETURN_ACT_IDS].sort()).toEqual([...RETURN_ACTION_TYPES].sort());
  });
});
