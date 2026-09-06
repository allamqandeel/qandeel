import { disclosureFixture } from '../__fixtures__/disclosure';
import { address, envelope, sceneOf, testStore } from '../__fixtures__/store';
import {
  OSDAP_MAX_COORD,
  OSDAP_MIN_COORD,
  OSDAP_V1_SCHEME,
  canonicalCoordinateText,
  canonicalWorldAddress,
  decodeCanonicalWorldAddress,
  decodeDisclosedHome,
  decodeScaleIntentRef,
  decodeSpatialDestinationRef,
  decodeWorldAnchorRef,
  mapDestination,
  mapScale,
  roundDiv,
  scaleIntentRef,
  spatialDestinationRef,
  worldAddressEquals,
  worldAnchorRef,
} from '../world';
import { decodeCameraIntent, initialCameraIntent, pointsForWorldDelta, projectAddress } from '../camera';

describe('OSDAP v1 canonical coordinates (M04-12)', () => {
  it('keeps extreme legal coordinates exact as bigint and never through a JavaScript number', () => {
    const extreme = address(OSDAP_MAX_COORD, OSDAP_MIN_COORD);
    expect(extreme.x).toBe(2n ** 62n - 1n);
    expect(extreme.y).toBe(-(2n ** 62n));
    // The exact value is far beyond Number.MAX_SAFE_INTEGER: a float round-trip would lose it.
    expect(Number(extreme.x) > Number.MAX_SAFE_INTEGER).toBe(true);
    expect(BigInt(Number(extreme.x))).not.toBe(extreme.x);
    expect(canonicalCoordinateText(extreme.x)).toBe('4611686018427387903');
    expect(canonicalCoordinateText(extreme.y)).toBe('-4611686018427387904');
  });

  it('round-trips an extreme address through the opaque WORLD_ANCHOR encoding without loss', () => {
    const extreme = address(OSDAP_MAX_COORD - 7n, OSDAP_MIN_COORD + 13n);
    const decoded = decodeWorldAnchorRef(worldAnchorRef(extreme));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(worldAddressEquals(decoded.address, extreme)).toBe(true);
    expect(decoded.address.x).toBe(OSDAP_MAX_COORD - 7n);
  });

  it('a local screen projection never overwrites the canonical address it was derived from', () => {
    const anchorX = OSDAP_MAX_COORD - 100_000n;
    const camera = decodeCameraIntent(initialCameraIntent(address(anchorX, 0n)));
    expect(camera.ok).toBe(true);
    if (!camera.ok) return;
    const neighbour = address(anchorX + 8192n, 0n);
    const projected = projectAddress(camera.camera, envelope(), neighbour);
    expect(projected).not.toBeNull();
    // One point at the default scale, and the canonical values are untouched afterwards.
    expect(projected?.x).toBeCloseTo(390 / 2 + 1, 9);
    expect(neighbour.x).toBe(anchorX + 8192n);
    expect(camera.camera.anchor.x).toBe(anchorX);
  });

  it('reports an unrepresentable camera-relative distance instead of clamping it to an edge', () => {
    const camera = decodeCameraIntent(initialCameraIntent(address(0n, 0n)));
    if (!camera.ok) throw new Error(camera.detail);
    expect(pointsForWorldDelta(camera.camera, 8192n)).toBe(1);
    expect(pointsForWorldDelta(camera.camera, OSDAP_MAX_COORD)).toBeNull();
    expect(projectAddress(camera.camera, envelope(), address(OSDAP_MAX_COORD, 0n))).toBeNull();
  });

  it('refuses an out-of-bound coordinate fail-closed rather than clamping or wrapping it', () => {
    expect(canonicalWorldAddress(OSDAP_MAX_COORD + 1n, 0n)).toEqual({ ok: false, reason: 'COORDINATE_OUT_OF_BOUNDS', detail: expect.any(String) });
    expect(canonicalWorldAddress(0n, OSDAP_MIN_COORD - 1n).ok).toBe(false);
    const beyond = decodeDisclosedHome({ x: '99999999999999999999', y: '0' });
    expect(beyond).toEqual({ ok: false, reason: 'COORDINATE_OUT_OF_BOUNDS', detail: expect.any(String) });
  });

  it('refuses a malformed coordinate text and an unknown scheme without coercing either', () => {
    expect(decodeDisclosedHome({ x: '1.5', y: '0' }).ok).toBe(false);
    expect(decodeDisclosedHome({ x: '', y: '0' }).ok).toBe(false);
    expect(decodeCanonicalWorldAddress({ scheme: 'QANDEEL_OSDAP_V2', x: '0', y: '0' })).toEqual({
      ok: false,
      reason: 'UNKNOWN_SCHEME',
      detail: expect.any(String),
    });
    expect(decodeCanonicalWorldAddress({ x: '0', y: '0' }).ok).toBe(false);
    expect(decodeCanonicalWorldAddress({ scheme: OSDAP_V1_SCHEME, x: '0', y: '0', z: '0' }).ok).toBe(false);
  });

  it('never infers a Home: an Emerging Focus stays pregeographic even after promotion', () => {
    const store = testStore({ depth: 'SESSION' });
    const scene = sceneOf(
      store,
      disclosureFixture({
        depth: 'SESSION',
        threads: [{ id: 'thread-a', x: '0', y: '0' }],
        focuses: [{ id: 'focus-1', startedSp: 1, promotedThreadId: 'thread-a' }],
      }),
    );
    const focus = scene.objects.find((object) => object.family === 'EMERGING_FOCUS');
    expect(focus?.loci).toEqual([]);
    expect(scene.ungeographic.map((object) => object.key)).toContain('EMERGING_FOCUS:focus-1');
  });

  it('keeps the scale intent an exact ratio and refuses a non-positive or unrepresentable one', () => {
    const scale = mapScale(3n, 4n);
    expect(scale.ok).toBe(true);
    if (!scale.ok) return;
    const decoded = decodeScaleIntentRef(scaleIntentRef(scale.value));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value.numerator).toBe(3n);
    expect(decoded.value.denominator).toBe(4n);
    expect(mapScale(0n, 1n).ok).toBe(false);
    expect(mapScale(-1n, 1n).ok).toBe(false);
    expect(mapScale(2n ** 60n, 1n).ok).toBe(false);
    // A ratio is reduced, so equal scales are structurally identical and `Φ_eff` sees no change.
    const reduced = mapScale(6n, 8n);
    expect(reduced.ok && reduced.value.numerator).toBe(3n);
  });

  it('encodes an authorized locus exactly, including the host Home of a contextual appearance', () => {
    const host = address(2_000_000n, -3_000_000n);
    const destination = mapDestination('CONTEXTUAL_APPEARANCE', 'thread-a', 'binding-1', host);
    expect(destination.ok).toBe(true);
    if (!destination.ok) return;
    const decoded = decodeSpatialDestinationRef(spatialDestinationRef(destination.value));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.value).toEqual(destination.value);
    // Exactly a contextual appearance carries a binding identity.
    expect(mapDestination('THREAD_HOME', 'thread-a', 'binding-1', host).ok).toBe(false);
    expect(mapDestination('CONTEXTUAL_APPEARANCE', 'thread-a', null, host).ok).toBe(false);
  });

  it('rounds exact division half away from zero so opposite movements are exact mirrors', () => {
    expect(roundDiv(5n, 2n)).toBe(3n);
    expect(roundDiv(-5n, 2n)).toBe(-3n);
    expect(roundDiv(1n, 2n)).toBe(1n);
    expect(roundDiv(-1n, 2n)).toBe(-1n);
    expect(roundDiv(0n, 7n)).toBe(0n);
  });
});
