/**
 * MAP-CLOSE-01 CA-Z1 (Product Owner, 2026-11-14): a pinch's step keeps the world point under the fingers, in ONE act, and
 * leaves OUT, Back and the rung bounds intact; a step without fingers is exactly what it was.
 */
import { sessionPosition } from '../../state';
import { backOneStep } from '../../return-navigation/return-actions';
import { returnSurface, returnTestStore, viewpoint } from '../../return-navigation/__fixtures__/return';
import { focusField, wholeWorldCamera, zoomField } from '../../public-world/field/public-field-camera';
import { envelope, testStore } from '../__fixtures__/store';
import { decodeCameraIntent, projectAddress, unprojectPoint, zoomSemanticStep, type MapCamera } from '../camera';

const cameraOf = (store: ReturnType<typeof testStore>): MapCamera => {
  const decoded = decodeCameraIntent(store.getState().camera);
  if (!decoded.ok) throw new Error(decoded.detail);
  return decoded.camera;
};
const glass = envelope();
const POINTS = [{ x: 60, y: 200 }, { x: 330, y: 700 }, { x: 195, y: 422 }, { x: 12.37, y: 801.9 }];

describe('CA-Z1 — the step goes where the fingers are', () => {
  it('the world point under the fingers stays under them at every rung, IN and OUT', () => {
    for (const point of POINTS) {
      const store = testStore({ depth: 'WORLD' });
      for (const direction of ['IN', 'IN', 'IN', 'IN', 'OUT', 'OUT', 'OUT', 'OUT'] as const) {
        const before = cameraOf(store);
        const under = unprojectPoint(before, glass, point);
        expect(under).not.toBeNull();
        expect(zoomSemanticStep(store, direction, { envelope: glass, point }).outcome).toBe('APPLIED');
        const after = cameraOf(store);
        const shown = projectAddress(after, glass, under!);
        // Exact to the world's own rounding: under a point at the deepest rung, under 1/1024 pt at the coarsest.
        expect(Math.abs(shown!.x - point.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(shown!.y - point.y)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('IN then OUT at the same fingers returns EXACTLY the camera it started from', () => {
    for (const point of POINTS) {
      const store = testStore({ depth: 'WORLD' });
      const start = store.getState().camera;
      for (let i = 0; i < 4; i += 1) zoomSemanticStep(store, 'IN', { envelope: glass, point });
      for (let i = 0; i < 4; i += 1) zoomSemanticStep(store, 'OUT', { envelope: glass, point });
      expect(store.getState().camera).toEqual(start);
    }
  });

  it('one pinch is ONE ZOOM_SEMANTIC carrying depth, scale and anchor — no PAN, no second act', () => {
    const store = testStore({ depth: 'WORLD' });
    zoomSemanticStep(store, 'IN', { envelope: glass, point: { x: 60, y: 200 } });
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['ZOOM_SEMANTIC']);
    expect(store.getState().camera.depth).toBe('THREAD');
  });

  it('without fingers (the accessible step, the centre) the step is exactly what it was', () => {
    const store = testStore({ depth: 'WORLD' });
    const before = store.getState().camera.anchor;
    zoomSemanticStep(store, 'IN');
    expect(store.getState().camera.anchor).toEqual(before);
    const centred = testStore({ depth: 'WORLD' });
    zoomSemanticStep(centred, 'IN', { envelope: glass, point: { x: glass.width / 2, y: (glass.insetTop + glass.height - glass.insetBottom) / 2 } });
    expect(cameraOf(centred).anchor).toEqual(cameraOf(store).anchor);
  });

  it('Back One Step undoes a pinch exactly (anchor, scale and depth), step by step', () => {
    // Back restores time as PINNED(captured TC) by contract (FIX-T02-04), so start pinned, as the Back tests do.
    const store = returnTestStore({ temporal: { kind: 'PINNED', at: sessionPosition(3) } });
    const v0 = viewpoint(store.getState());
    expect(zoomSemanticStep(store, 'IN', { envelope: glass, point: { x: 60, y: 200 } }).outcome).toBe('APPLIED');
    const v1 = viewpoint(store.getState());
    expect(zoomSemanticStep(store, 'IN', { envelope: glass, point: { x: 330, y: 700 } }).outcome).toBe('APPLIED');
    const surface = returnSurface(store);
    expect(backOneStep(surface).outcome).toBe('APPLIED');
    expect(viewpoint(store.getState())).toEqual(v1);
    expect(backOneStep(surface).outcome).toBe('APPLIED');
    expect(viewpoint(store.getState())).toEqual(v0);
  });

  it('the five rungs stay the bound: no act past SOURCE_PROVENANCE or before WORLD, fingers or not', () => {
    const deep = testStore({ depth: 'SOURCE_PROVENANCE' });
    const before = deep.getState();
    expect(zoomSemanticStep(deep, 'IN', { envelope: glass, point: { x: 60, y: 200 } }).outcome).toBe('REJECTED');
    expect(deep.getState()).toBe(before);
    const top = testStore({ depth: 'WORLD' });
    expect(zoomSemanticStep(top, 'OUT', { envelope: glass, point: { x: 60, y: 200 } }).outcome).toBe('REJECTED');
    expect(top.getState().history).toHaveLength(0);
  });

  it('Shared / Public field: FAR -> MID keeps the place under the fingers, back OUT exactly, three rungs only', () => {
    const point = { x: 60, y: 200 };
    const far = wholeWorldCamera();
    const under = unprojectPoint(far, glass, point)!;
    const mid = zoomField(far, 'IN', null, { envelope: glass, point });
    expect(mid.outcome).toBe('MOVED');
    if (mid.outcome !== 'MOVED') return;
    expect(mid.camera.depth).toBe('MID');
    const shown = projectAddress(mid.camera, glass, under)!;
    expect(Math.abs(shown.x - point.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(shown.y - point.y)).toBeLessThanOrEqual(1);
    const back = zoomField(mid.camera, 'OUT', null, { envelope: glass, point });
    expect(back.outcome === 'MOVED' && back.camera).toEqual(far);
    // NEAR is still focus (a place), and nothing exists past NEAR or before FAR.
    const near = focusField(under);
    expect(zoomField(near, 'IN', null, { envelope: glass, point }).outcome).toBe('AT_BOUNDARY');
    expect(zoomField(far, 'OUT', null, { envelope: glass, point }).outcome).toBe('AT_BOUNDARY');
  });
});
