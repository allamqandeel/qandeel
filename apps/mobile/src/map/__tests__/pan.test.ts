import { address, envelope, testStore } from '../__fixtures__/store';
import { effectiveTC } from '../../state';
import {
  currentCamera,
  exploreViewport,
  initialCameraIntent,
  panByTranslation,
  panFromExplorationStep,
  panFromTranslation,
  decodeCameraIntent,
} from '../camera';
import { OSDAP_MAX_COORD, decodeWorldAnchorRef } from '../world';

const cameraOf = (x: bigint, y: bigint) => {
  const decoded = decodeCameraIntent(initialCameraIntent(address(x, y)));
  if (!decoded.ok) throw new Error(decoded.detail);
  return decoded.camera;
};

describe('PAN — gesture and non-drag interpretation (M04-03)', () => {
  it('M04-03 — an effective pan changes only the permitted camera fields', () => {
    const store = testStore();
    const before = store.getState();
    const outcome = panByTranslation(store, -40, 25);
    expect(outcome.outcome).toBe('APPLIED');

    const after = store.getState();
    expect(after.temporal).toEqual(before.temporal);
    expect(effectiveTC(after)).toBe(effectiveTC(before));
    expect(after.live).toBe(before.live);
    expect(after.live.LF).toBe(before.live.LF);
    expect(after.inspection).toBe(before.inspection);
    expect(after.camera.depth).toBe(before.camera.depth);
    expect(after.camera.scale).toEqual(before.camera.scale);
    expect(after.camera.destination).toBeUndefined();
    expect(after.camera.anchor).not.toEqual(before.camera.anchor);
    expect(after.history).toHaveLength(1);
    expect(after.history[0].act).toBe('PAN');
  });

  it('the camera moves against the content, exactly, in both axes', () => {
    const camera = cameraOf(0n, 0n);
    const resolution = panFromTranslation(camera, 10, -4);
    expect(resolution.outcome).toBe('INTENT');
    if (resolution.outcome !== 'INTENT') return;
    // Default scale is 8192 world units per point: dragging the content right moves the camera
    // left, and dragging it up (negative screen y) moves the camera down in a world with +y up.
    expect(resolution.anchor.x).toBe(-81_920n);
    expect(resolution.anchor.y).toBe(-32_768n);
  });

  it('one completed drag is one canonical intent, never one per gesture frame', () => {
    const store = testStore();
    const camera = currentCamera(store);
    if (!camera.ok) throw new Error(camera.detail);
    // Frames of a live drag are Class D presentation progress and reach no act.
    for (const frame of [2, 7, 19, 44]) panFromTranslation(camera.camera, frame, 0);
    expect(store.getState().history).toHaveLength(0);
    panByTranslation(store, 44, 0);
    expect(store.getState().history).toHaveLength(1);
  });

  it('a movement that rounds to no world displacement is not a Product act', () => {
    const store = testStore();
    const before = store.getState();
    expect(panByTranslation(store, 0, 0)).toEqual({ outcome: 'NO_OP' });
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('a pan beyond the canonical coordinate bound is refused, never clamped into a fake position', () => {
    const store = testStore({ anchor: address(OSDAP_MAX_COORD - 10n, 0n) });
    const before = store.getState();
    const outcome = panByTranslation(store, -1000, 0);
    expect(outcome).toEqual({ outcome: 'REJECTED', code: 'BEYOND_CANONICAL_BOUND', detail: expect.any(String) });
    expect(store.getState()).toBe(before);
    expect(store.getState().history).toHaveLength(0);
  });

  it('a non-finite input yields nothing and invents no transaction', () => {
    const store = testStore();
    expect(panByTranslation(store, Number.NaN, 0)).toMatchObject({ outcome: 'REJECTED', code: 'INVALID_INPUT' });
    expect(store.getState().history).toHaveLength(0);
  });

  it('the non-drag route produces the same act as the drag route, in all four directions', () => {
    const camera = cameraOf(0n, 0n);
    const step = (direction: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN') => {
      const resolution = panFromExplorationStep(camera, envelope(), direction);
      if (resolution.outcome !== 'INTENT') throw new Error(`expected an intent for ${direction}`);
      return resolution.anchor;
    };
    // One third of the 390-point safe width at 8192 units per point.
    expect(step('RIGHT').x).toBe(1_064_960n);
    expect(step('LEFT').x).toBe(-1_064_960n);
    expect(step('RIGHT').y).toBe(0n);
    // Vertical steps use the safe height (844 - 48 - 24 = 772 points), captured exactly at the
    // sub-point resolution before it ever multiplies a canonical quantity.
    expect(step('UP').y).toBe(2_108_072n);
    expect(step('DOWN').y).toBe(-2_108_072n);
    expect(step('UP').x).toBe(0n);
  });

  it('each non-drag activation appends exactly one checkpoint through the same store boundary', () => {
    const store = testStore();
    expect(exploreViewport(store, envelope(), 'RIGHT').outcome).toBe('APPLIED');
    expect(exploreViewport(store, envelope(), 'DOWN').outcome).toBe('APPLIED');
    expect(store.getState().history.map((entry) => entry.act)).toEqual(['PAN', 'PAN']);
    const anchor = decodeWorldAnchorRef(store.getState().camera.anchor);
    expect(anchor.ok).toBe(true);
  });
});
