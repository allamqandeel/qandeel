import { disclosureFixture } from '../__fixtures__/disclosure';
import { address, sceneOf, testStore } from '../__fixtures__/store';
import {
  DEFAULT_MAP_SCALE,
  decodeCameraIntent,
  encodeCameraIntent,
  envelopeAspectRatio,
  footprintEquals,
  initialCameraIntent,
  isWithinFootprint,
  projectAddress,
  unprojectPoint,
  viewportEnvelope,
  visibleFootprint,
  WORLD_ORIGIN,
} from '../camera';
import { CANONICAL_MAP_ORIENTATION, canonicalCoordinateText, worldAddressEquals } from '../world';
import { placeScene } from '../renderer';

const THREADS = [
  { id: 'thread-a', x: '0', y: '0' },
  { id: 'thread-b', x: '1000000', y: '0' },
  { id: 'thread-c', x: '-2000000', y: '3000000' },
];

const cameraAt = (anchorX: bigint, anchorY: bigint) => {
  const decoded = decodeCameraIntent(initialCameraIntent(address(anchorX, anchorY)));
  if (!decoded.ok) throw new Error(decoded.detail);
  return decoded.camera;
};

const phone = viewportEnvelope(390, 844, { top: 48, bottom: 24 });
const tablet = viewportEnvelope(1024, 768, { top: 24 });
if (phone === null || tablet === null) throw new Error('fixture envelopes must be viewports');

describe('camera intent and the presentation envelope', () => {
  it('M04-01 — the same V yields the same canonical addresses on two viewports; only pixels differ', () => {
    const store = testStore();
    const disclosure = disclosureFixture({ depth: 'WORLD', threads: THREADS });
    const scene = sceneOf(store, disclosure);
    const camera = cameraAt(0n, 0n);

    const canonicalOf = (envelope: typeof phone) =>
      placeScene(scene, camera, envelope)
        .nodes.filter((node) => node.locus?.kind === 'THREAD_HOME')
        .map((node) => (node.locus?.kind === 'THREAD_HOME' ? `${node.id}:${canonicalCoordinateText(node.locus.address.x)},${canonicalCoordinateText(node.locus.address.y)}` : ''))
        .sort();

    expect(canonicalOf(phone)).toEqual(canonicalOf(tablet));
    expect(canonicalOf(phone)).toEqual(['thread-a:0,0', 'thread-b:1000000,0', 'thread-c:-2000000,3000000']);

    const onPhone = placeScene(scene, camera, phone).nodes.find((node) => node.id === 'thread-b');
    const onTablet = placeScene(scene, camera, tablet).nodes.find((node) => node.id === 'thread-b');
    expect(onPhone?.x).not.toBe(onTablet?.x);
  });

  it('M04-10 — a resize recomputes the visible footprint only and rescues nothing', () => {
    const store = testStore();
    const disclosure = disclosureFixture({ depth: 'WORLD', threads: THREADS });
    const scene = sceneOf(store, disclosure);
    // A camera looking at legitimately empty world, far from every Home.
    const camera = cameraAt(900_000_000n, 900_000_000n);
    const before = store.getState();

    const narrow = visibleFootprint(camera, phone);
    const wide = visibleFootprint(camera, tablet);
    expect(footprintEquals(narrow, wide)).toBe(false);
    expect(wide.maxX - wide.minX).toBeGreaterThan(narrow.maxX - narrow.minX);

    // Nothing canonical moved: the camera, the Homes and RH are identical, and the Map is still
    // legitimately empty on both viewports. There is no fit-to-content rescue.
    expect(store.getState()).toBe(before);
    expect(store.getState().camera).toBe(before.camera);
    expect(store.getState().history).toHaveLength(0);
    expect(placeScene(scene, camera, phone).visibleNodes).toEqual([]);
    expect(placeScene(scene, camera, tablet).visibleNodes).toEqual([]);
    expect(scene.homes).toHaveLength(3);
  });

  it('the aspect ratio and the safe area are derived, and no envelope key can reach MC', () => {
    expect(envelopeAspectRatio(phone)).toBeCloseTo(390 / (844 - 48 - 24), 9);
    const intent = initialCameraIntent();
    expect(Object.keys(intent).sort()).toEqual(['anchor', 'depth', 'scale']);
    for (const forbidden of ['width', 'height', 'aspect', 'insets', 'footprint', 'viewport']) {
      expect(Object.prototype.hasOwnProperty.call(intent, forbidden)).toBe(false);
    }
  });

  it('camera intent round-trips exactly, so an unchanged camera never looks changed to Φ_eff', () => {
    const intent = initialCameraIntent(address(123_456_789n, -987_654_321n));
    const decoded = decodeCameraIntent(intent);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.camera.orientation).toEqual(CANONICAL_MAP_ORIENTATION);
    expect(decoded.camera.scale).toEqual(DEFAULT_MAP_SCALE);
    expect(encodeCameraIntent(decoded.camera)).toEqual(intent);
  });

  it('an undecodable camera is refused, never repaired with a default', () => {
    const broken = { ...initialCameraIntent(), anchor: { kind: 'WORLD_ANCHOR' as const, value: 'not-an-address' } };
    const decoded = decodeCameraIntent(broken);
    expect(decoded.ok).toBe(false);
    if (decoded.ok) return;
    expect(decoded.detail).toContain('WORLD_ANCHOR');
  });

  it('projection and unprojection agree, and a non-canonical screen point is not an address', () => {
    const camera = cameraAt(0n, 0n);
    const home = address(8192n * 10n, 8192n * -20n);
    const point = projectAddress(camera, phone, home);
    expect(point).not.toBeNull();
    if (point === null) return;
    const back = unprojectPoint(camera, phone, point);
    expect(back).not.toBeNull();
    expect(back !== null && worldAddressEquals(back, home)).toBe(true);

    const atBound = cameraAt(2n ** 62n - 1n, 0n);
    expect(unprojectPoint(atBound, phone, { x: phone.width * 4, y: 0 })).toBeNull();
  });

  it('the visible footprint is exact, symmetric around the anchor and inclusive at its edges', () => {
    const camera = cameraAt(1_000_000n, 2_000_000n);
    const footprint = visibleFootprint(camera, phone);
    expect(footprint.maxX - camera.anchor.x).toBe(camera.anchor.x - footprint.minX);
    expect(isWithinFootprint(footprint, address(footprint.minX, footprint.maxY))).toBe(true);
    expect(isWithinFootprint(footprint, address(footprint.maxX + 1n, camera.anchor.y))).toBe(false);
  });

  it('the world origin is a viewpoint, not a Home, and the default camera discloses the World rung', () => {
    expect(WORLD_ORIGIN.x).toBe(0n);
    expect(initialCameraIntent().depth).toBe('WORLD');
  });
});
