/**
 * T-07 — RN07-C: `EXACT_RETURN`.
 *
 * Exact Return restores a NAMED recorded checkpoint and consumes it together with every newer entry,
 * so the restored viewpoint does not linger as a redundant Back step. It appends nothing.
 *
 * The second half of this suite is about the target itself. A checkpoint payload a caller can build
 * is not a name, so the public handle is provenance-bound and is re-proven against CURRENT history
 * at execution — and the store proves the same thing independently, by locating the entry object in
 * its own history before anything is written.
 */
import { sessionPosition, type RhCheckpoint } from '../../state';
import { initialCameraIntent, panByTranslation, zoomSemanticStep } from '../../map';
import { backOneStep, exactReturn } from '../return-actions';
import {
  isCurrentReturnCheckpointTargetForStore,
  isReturnCheckpointTarget,
  latestReturnCheckpoint,
  returnCheckpoints,
  type ReturnCheckpointTarget,
} from '../checkpoint-target';
import { permissiveReturnStore, returnSurface, returnTestStore, unavailableInspectionRef, viewpoint } from '../__fixtures__/return';
import type { CanonicalStore } from '../../state';

const SP = sessionPosition;

/** Four real, effective transactions, with the viewpoint each one left behind. */
function fourSteps(store: CanonicalStore) {
  const v0 = viewpoint(store.getState());
  expect(panByTranslation(store, 100, 0).outcome).toBe('APPLIED');
  const v1 = viewpoint(store.getState());
  expect(panByTranslation(store, 0, 100).outcome).toBe('APPLIED');
  const v2 = viewpoint(store.getState());
  expect(zoomSemanticStep(store, 'IN').outcome).toBe('APPLIED');
  const v3 = viewpoint(store.getState());
  expect(panByTranslation(store, 60, 60).outcome).toBe('APPLIED');
  expect(store.getState().history).toHaveLength(4);
  return { v0, v1, v2, v3 };
}

describe('RN07-C — Exact Return', () => {
  it('C21 — targeting the earliest of four restores it and consumes it and the whole suffix', () => {
    const store = returnTestStore({ temporal: { kind: 'PINNED', at: SP(3) } });
    const { v0 } = fourSteps(store);
    const targets = returnCheckpoints(store);
    expect(targets).toHaveLength(4);

    const outcome = exactReturn(returnSurface(store), targets[0]);
    expect(outcome).toEqual({ outcome: 'APPLIED', entry: null, consumed: 4, locate: 'NOT_ATTEMPTED' });
    expect(viewpoint(store.getState())).toEqual(v0);
    expect(store.getState().history).toHaveLength(0);
  });

  it('C22 — targeting a middle entry preserves the earlier prefix only', () => {
    const store = returnTestStore({ temporal: { kind: 'PINNED', at: SP(3) } });
    const { v0, v1 } = fourSteps(store);
    const targets = returnCheckpoints(store);

    const outcome = exactReturn(returnSurface(store), targets[1]);
    expect(outcome.outcome === 'APPLIED' && outcome.consumed).toBe(3);
    expect(viewpoint(store.getState())).toEqual(v1);
    expect(store.getState().history).toHaveLength(1);

    // The remaining prefix is still a working Back chain, and it reaches the original viewpoint.
    expect(backOneStep(returnSurface(store)).outcome).toBe('APPLIED');
    expect(viewpoint(store.getState())).toEqual(v0);
    expect(store.getState().history).toHaveLength(0);
  });

  it('C23 — targeting the latest is equivalent to one step, and leaves no duplicate checkpoint', () => {
    const store = returnTestStore({ temporal: { kind: 'PINNED', at: SP(3) } });
    const { v3 } = fourSteps(store);
    const latest = latestReturnCheckpoint(store);
    expect(latest).not.toBeNull();

    const outcome = exactReturn(returnSurface(store), latest as ReturnCheckpointTarget);
    expect(outcome.outcome === 'APPLIED' && outcome.consumed).toBe(1);
    expect(viewpoint(store.getState())).toEqual(v3);
    expect(store.getState().history).toHaveLength(3);
    // Nothing was appended, so the restored viewpoint is not sitting in history as a no-op step.
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['PAN', 'PAN', 'ZOOM_SEMANTIC']);
  });

  it('C24 — a forged RhCheckpoint cannot target Exact Return', () => {
    const store = returnTestStore({ temporal: { kind: 'PINNED', at: SP(3) } });
    fourSteps(store);
    const before = store.getState();
    // Built from the Map layer's own encoders, so it is a structurally PERFECT checkpoint that this
    // store simply never recorded — the only thing wrong with it is its provenance.
    const forged: RhCheckpoint = { tmProvenance: { kind: 'FOLLOW_LIVE' }, tc: SP(1), ifRef: null, camera: initialCameraIntent() };
    const outcome = exactReturn(returnSurface(store), forged as unknown as ReturnCheckpointTarget);
    expect(outcome).toEqual({ outcome: 'REJECTED', code: 'INVALID_INPUT', detail: expect.stringContaining('not derived from a recorded checkpoint') });
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(4);
    // The store proves it independently: an entry object it does not hold is not a target either.
    expect(() => (store as unknown as { dispatchReturn: (a: unknown) => unknown }).dispatchReturn({ type: 'EXACT_RETURN', target: { act: 'PAN', captured: forged } })).toThrow(
      /no runtime authorization/u,
    );
  });

  it('C25 — a structural copy and a JSON round trip of a valid handle are refused', () => {
    const store = returnTestStore({ temporal: { kind: 'PINNED', at: SP(3) } });
    fourSteps(store);
    const target = returnCheckpoints(store)[1];
    expect(isReturnCheckpointTarget(target)).toBe(true);

    const copy = { ...target };
    const roundTripped = JSON.parse(JSON.stringify(target)) as ReturnCheckpointTarget;
    expect(isReturnCheckpointTarget(copy)).toBe(false);
    expect(isReturnCheckpointTarget(roundTripped)).toBe(false);
    for (const candidate of [copy, roundTripped, { index: 1 } as ReturnCheckpointTarget]) {
      const outcome = exactReturn(returnSurface(store), candidate);
      expect(outcome.outcome === 'REJECTED' && outcome.code).toBe('INVALID_INPUT');
    }
    expect(store.getState().history).toHaveLength(4);
  });

  it('C26 — a target from another store, and from another Session, is refused', () => {
    const store = returnTestStore({ sessionId: 'session-1', temporal: { kind: 'PINNED', at: SP(3) } });
    const other = returnTestStore({ sessionId: 'session-2', temporal: { kind: 'PINNED', at: SP(3) } });
    fourSteps(store);
    fourSteps(other);
    const before = store.getState();

    const foreign = returnCheckpoints(other)[0];
    const outcome = exactReturn(returnSurface(store), foreign);
    expect(outcome).toEqual({ outcome: 'REJECTED', code: 'INVALID_INPUT', detail: expect.stringContaining('different store') });
    expect(store.getState()).toBe(before);
    expect(other.getState().history).toHaveLength(4);
  });

  it('C27, C28 — a target consumed before execution, and a replay after success, are both refused', () => {
    const store = returnTestStore({ temporal: { kind: 'PINNED', at: SP(3) } });
    const { v1 } = fourSteps(store);
    const targets = returnCheckpoints(store);
    const surface = returnSurface(store);

    // The middle target is consumed by an Exact Return to an earlier one...
    expect(exactReturn(surface, targets[1]).outcome).toBe('APPLIED');
    expect(viewpoint(store.getState())).toEqual(v1);
    const settled = store.getState();

    // ...so the newer handles now name entries that are gone, and the used one cannot be replayed.
    for (const stale of [targets[1], targets[2], targets[3]]) {
      const outcome = exactReturn(surface, stale);
      expect(outcome).toEqual({ outcome: 'REJECTED', code: 'STALE_TARGET', detail: expect.stringContaining('no longer present') });
    }
    expect(store.getState()).toBe(settled);
    expect(store.getState().history).toHaveLength(1);
  });

  it('C29 — a Live Head advance during an Exact Return leaves the final state PINNED(capturedTC)', () => {
    const store = returnTestStore({ liveHead: 10 });
    expect(store.dispatch({ type: 'COMMIT_MOMENT', moment: SP(4) }).outcome).toBe('APPLIED');
    expect(panByTranslation(store, 200, 0).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(2);
    const target = returnCheckpoints(store)[0];
    expect(store.getState().history[0].captured.tmProvenance).toEqual({ kind: 'FOLLOW_LIVE' });
    expect(store.getState().history[0].captured.tc).toBe(10);

    expect(store.ingest({ type: 'LIVE_HEAD_ADVANCED', toSp: SP(33) }).outcome).toBe('APPLIED');
    expect(exactReturn(returnSurface(store), target).outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 10 });
    expect(store.getState().live.LH).toBe(33);
    expect(store.getState().history).toHaveLength(0);
  });

  it('C30, C31 — the exact version, context and every optional camera key are restored as captured', () => {
    const ref = unavailableInspectionRef();
    const store = returnTestStore({ temporal: { kind: 'PINNED', at: SP(2) }, depth: 'ANALYTICAL_OBJECT', inspection: ref });
    const camera = store.getState().camera;
    expect(camera.destination).toBeUndefined();
    expect(camera.orientation).toBeUndefined();

    expect(panByTranslation(store, 120, 0).outcome).toBe('APPLIED');
    expect(zoomSemanticStep(store, 'OUT').outcome).toBe('APPLIED');
    const target = returnCheckpoints(store)[0];

    expect(exactReturn(returnSurface(store), target).outcome).toBe('APPLIED');
    expect(store.getState().inspection).toEqual(ref);
    expect(store.getState().camera).toEqual(camera);
    // Absence is restored as absence: an optional key that was never there does not appear.
    expect('destination' in store.getState().camera).toBe(false);
    expect('orientation' in store.getState().camera).toBe(false);
    expect(store.getState().history).toHaveLength(0);
  });

  it('the store proves target presence and latest-ness itself, before any state is written', () => {
    // Proven against a store whose authority admits anything, so the layer's own provenance check is
    // not standing in front of the kernel's. These are the store's rules, not the layer's.
    const store = permissiveReturnStore({ temporal: { kind: 'PINNED', at: SP(3) } });
    fourSteps(store);
    const history = store.getState().history;
    const before = store.getState();

    // A checkpoint this store never recorded is not a target, even structurally perfect.
    const impostor = { act: history[0].act, captured: { ...history[0].captured } };
    expect(() => store.dispatchReturn({ type: 'EXACT_RETURN', target: impostor })).toThrow(/not present in the current reversible history/u);
    expect(() => store.dispatchReturn({ type: 'BACK_ONE_STEP', target: impostor })).toThrow(/not present in the current reversible history/u);

    // A real entry that is no longer the latest cannot be reversed by Back.
    expect(() => store.dispatchReturn({ type: 'BACK_ONE_STEP', target: history[0] })).toThrow(/reverses the LATEST recorded transaction/u);

    // Every refusal wrote nothing and consumed nothing.
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(4);

    // ...and the latest one is accepted, consuming exactly itself.
    expect(store.dispatchReturn({ type: 'BACK_ONE_STEP', target: history[3] })).toEqual({ outcome: 'APPLIED', entry: null });
    expect(store.getState().history).toHaveLength(3);
  });
});

/**
 * The ONE read-only provenance question a presentation surface may ask (R2-01).
 *
 * `isReturnCheckpointTarget` proves only that SOME store minted a handle, which is not enough for a
 * surface deciding whether to OFFER an act: a foreign handle is indistinguishable from a local one,
 * so the reader is shown a capability that can never work. This predicate answers the whole question
 * — minted here, belongs to this store, entry still recorded — as a boolean, and grants nothing.
 */
describe('RN07-C — the current-provenance predicate', () => {
  it('answers the three questions the executor asks, and nothing else', () => {
    const store = returnTestStore();
    const surface = returnSurface(store);
    fourSteps(store);
    const history = returnCheckpoints(store);

    // Minted here, this store, still present.
    for (const target of history) expect(isCurrentReturnCheckpointTargetForStore(store, target)).toBe(true);

    // Not minted at all.
    for (const forgery of [{ index: 0 }, Object.freeze({ index: 0 }), { ...history[0] }, JSON.parse(JSON.stringify(history[0])), null, undefined, 'x', 0]) {
      expect(isReturnCheckpointTarget(forgery)).toBe(false);
      expect(isCurrentReturnCheckpointTargetForStore(store, forgery)).toBe(false);
    }

    // Minted, but by a different store — the case an ordinal could never catch, because the other
    // store has a checkpoint at every one of these positions too.
    const other = returnTestStore();
    fourSteps(other);
    const foreign = returnCheckpoints(other);
    expect(foreign).toHaveLength(history.length);
    for (const target of foreign) {
      expect(isReturnCheckpointTarget(target)).toBe(true);
      expect(isCurrentReturnCheckpointTargetForStore(store, target)).toBe(false);
    }

    // Minted here, but consumed. Exact Return takes the named entry AND everything newer.
    expect(exactReturn(surface, history[2]).outcome).toBe('APPLIED');
    expect(store.getState().history).toHaveLength(2);
    for (const consumed of [history[2], history[3]]) expect(isCurrentReturnCheckpointTargetForStore(store, consumed)).toBe(false);
    for (const surviving of [history[0], history[1]]) expect(isCurrentReturnCheckpointTargetForStore(store, surviving)).toBe(true);
  });

  it('a consumed entry stays gone however far history regrows', () => {
    const store = returnTestStore();
    const surface = returnSurface(store);
    fourSteps(store);
    const history = returnCheckpoints(store);

    backOneStep(surface);
    expect(store.getState().history).toHaveLength(3);
    expect(isCurrentReturnCheckpointTargetForStore(store, history[3])).toBe(false);

    // New, unrelated transactions refill the position the consumed entry used to occupy. Presence is
    // a question about the entry OBJECT, so the answer does not change.
    for (const step of [1, 2, 3, 4]) expect(panByTranslation(store, step * 40, 0).outcome).toBe('APPLIED');
    expect(store.getState().history.length).toBeGreaterThan(4);
    expect(isCurrentReturnCheckpointTargetForStore(store, history[3])).toBe(false);
  });

  it('it is inert: it mints nothing, consumes nothing and mutates nothing', () => {
    const store = returnTestStore();
    fourSteps(store);
    const target = latestReturnCheckpoint(store);
    const before = store.getState();

    for (let index = 0; index < 5; index += 1) {
      expect(isCurrentReturnCheckpointTargetForStore(store, target)).toBe(true);
    }
    // Object identity: the state was never republished, and nothing was consumed.
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(4);
    // And it grants nothing — the handle it approved still carries only its ordinal.
    expect(Object.keys(target as ReturnCheckpointTarget)).toEqual(['index']);
  });
});
