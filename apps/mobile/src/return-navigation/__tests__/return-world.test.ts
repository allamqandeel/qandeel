/**
 * T-07 — RN07-G: `RETURN_WORLD`.
 *
 * Spatial and depth only, against the EXISTING canonical World/Z0 camera target. The traps are a
 * locally invented "fit everything" camera, and erasing the inspection reference because the World
 * rung will not render it.
 */
import { cameraIntentEquals, sessionPosition } from '../../state';
import { DEFAULT_MAP_SCALE, WORLD_ORIGIN, initialCameraIntent, panByTranslation, scaleIntentRef, worldAnchorRef, zoomSemanticStep } from '../../map';
import { backOneStep, returnWorld } from '../return-actions';
import { returnSurface, returnTestStore, unavailableInspectionRef } from '../__fixtures__/return';

const SP = sessionPosition;

describe('RN07-G — Return to World', () => {
  it('G55 — from a historical position: same TM, same effective TC, World camera only', () => {
    const store = returnTestStore({ liveHead: 20, temporal: { kind: 'PINNED', at: SP(7) }, depth: 'ANALYTICAL_OBJECT' });
    expect(panByTranslation(store, 900, 400).outcome).toBe('APPLIED');
    const historyBefore = store.getState().history.length;

    const outcome = returnWorld(returnSurface(store));
    expect(outcome.outcome === 'APPLIED' && outcome.consumed).toBe(0);
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 7 });
    expect(store.getState().live.LH).toBe(20);
    expect(store.getState().history).toHaveLength(historyBefore + 1);
    expect(store.getState().history[historyBefore].act).toBe('RETURN_WORLD');
  });

  it('G56 — from FOLLOW_LIVE it stays FOLLOW_LIVE: Return to World is never a temporal act', () => {
    const store = returnTestStore({ liveHead: 20, depth: 'ANALYTICAL_OBJECT' });
    expect(panByTranslation(store, 500, 0).outcome).toBe('APPLIED');
    expect(returnWorld(returnSurface(store)).outcome).toBe('APPLIED');
    expect(store.getState().temporal).toEqual({ kind: 'FOLLOW_LIVE' });
  });

  it('G57 — already at the exact World camera: a true no-op that records nothing', () => {
    const store = returnTestStore({ camera: initialCameraIntent() });
    const before = store.getState();
    const outcome = returnWorld(returnSurface(store));
    expect(outcome).toEqual({ outcome: 'NO_OP', reason: 'ALREADY_AT_WORLD_CAMERA', locate: 'NOT_ATTEMPTED' });
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('G58 — a deep inspection reference survives; only its render may become depth-withheld', () => {
    const ref = unavailableInspectionRef();
    const store = returnTestStore({ depth: 'SOURCE_PROVENANCE', inspection: ref });
    expect(returnWorld(returnSurface(store)).outcome).toBe('APPLIED');
    expect(store.getState().inspection).toEqual(ref);
    expect(store.getState().inspection?.depth).toBe('ANALYTICAL_OBJECT');
    expect(store.getState().camera.depth).toBe('WORLD');
  });

  it('G59, G60 — the target is the existing canonical helper: origin, canonical orientation, default scale, no destination', () => {
    const store = returnTestStore({ depth: 'ANALYTICAL_OBJECT' });
    expect(zoomSemanticStep(store, 'IN').outcome).toBe('APPLIED');
    expect(panByTranslation(store, 2000, -900).outcome).toBe('APPLIED');
    expect(returnWorld(returnSurface(store)).outcome).toBe('APPLIED');

    const camera = store.getState().camera;
    // Exactly `initialCameraIntent()` — not a locally composed camera that merely resembles it.
    expect(cameraIntentEquals(camera, initialCameraIntent())).toBe(true);
    expect(camera.anchor).toEqual(worldAnchorRef(WORLD_ORIGIN));
    expect(camera.scale).toEqual(scaleIntentRef(DEFAULT_MAP_SCALE));
    expect(camera.depth).toBe('WORLD');
    // The helper carries no destination and no orientation key, so neither is invented here.
    expect('destination' in camera).toBe(false);
    expect('orientation' in camera).toBe(false);
  });

  it('one Back reverses it exactly, including the semantic depth it left', () => {
    const store = returnTestStore({ depth: 'ANALYTICAL_OBJECT', temporal: { kind: 'PINNED', at: SP(4) } });
    expect(panByTranslation(store, 700, 200).outcome).toBe('APPLIED');
    const before = store.getState().camera;

    const surface = returnSurface(store);
    expect(returnWorld(surface).outcome).toBe('APPLIED');
    expect(store.getState().camera.depth).toBe('WORLD');

    expect(backOneStep(surface).outcome).toBe('APPLIED');
    expect(store.getState().camera).toEqual(before);
    expect(store.getState().camera.depth).toBe('ANALYTICAL_OBJECT');
    expect(store.getState().temporal).toEqual({ kind: 'PINNED', at: 4 });
  });
});
