/**
 * MAP-CLOSE-01 CA-O1 (Product Owner, 2026-11-14): when only the room below the world changes (the return acts appear, a
 * place's panel opens or closes), the world stays where it is on the glass. Presentation only: no camera moves.
 */
import { DEFAULT_MAP_SCALE, WORLD_ORIGIN, envelopeCenter, projectAddress, steadyEnvelope, viewportEnvelope, visibleFootprint, type ViewportEnvelope } from '../camera';
import { canonicalWorldAddress } from '../world';

const glass = (height: number, top = 100, width = 390): ViewportEnvelope => {
  const envelope = viewportEnvelope(width, height, { top });
  if (envelope === null) throw new Error('no envelope');
  return envelope;
};
const camera = { anchor: WORLD_ORIGIN, scale: DEFAULT_MAP_SCALE };
const place = (() => {
  const address = canonicalWorldAddress(WORLD_ORIGIN.x + 40_000n, WORLD_ORIGIN.y - 90_000n);
  if (!address.ok) throw new Error('no address');
  return address.address;
})();

describe('CA-O1 — the world stays put when the room below it changes', () => {
  it('the acts appearing below the world (the glass loses 56 points) move nothing on screen', () => {
    const before = glass(720);
    const after = steadyEnvelope(before, glass(664));
    expect(envelopeCenter(after)).toEqual(envelopeCenter(before));
    expect(projectAddress(camera, after, place)).toEqual(projectAddress(camera, before, place));
  });

  it('a panel taking most of the glass recentres once; closing it moves nothing', () => {
    const open = glass(820);
    const panel = steadyEnvelope(open, glass(490));
    // 460 (the old centre) is outside the middle half of 100..490, so the anchor is the new glass's centre.
    expect(envelopeCenter(panel).y).toBe(295);
    const closed = steadyEnvelope(panel, glass(820));
    expect(envelopeCenter(closed).y).toBe(295);
    expect(projectAddress(camera, closed, place)).toEqual(projectAddress(camera, panel, place));
  });

  it('it settles in one pass: holding a held anchor again returns the same envelope', () => {
    const held = steadyEnvelope(glass(720), glass(664));
    expect(steadyEnvelope(held, glass(664))).toEqual(held);
    const plain = glass(720);
    expect(steadyEnvelope(plain, plain)).toEqual(plain);
  });

  it('a rotation, a new top band or a first glass is composed from its own centre', () => {
    const before = steadyEnvelope(glass(720), glass(664));
    expect(steadyEnvelope(before, glass(664, 100, 844)).anchorY).toBeUndefined();
    expect(steadyEnvelope(before, glass(664, 60)).anchorY).toBeUndefined();
    expect(steadyEnvelope(null, glass(664)).anchorY).toBeUndefined();
  });

  it('the footprint is still exactly the glass: unchanged without a held anchor, split unevenly with one', () => {
    const plain = glass(720);
    const footprint = visibleFootprint(camera, plain);
    expect(footprint.maxY - camera.anchor.y).toBe(camera.anchor.y - footprint.minY);
    const held = steadyEnvelope(glass(720), glass(664));
    const uneven = visibleFootprint(camera, held);
    // The top edge is where it was; only the bottom edge came up with the glass.
    expect(uneven.maxY).toBe(footprint.maxY);
    expect(uneven.minY).toBeGreaterThan(footprint.minY);
    expect(uneven.minX).toBe(footprint.minX);
    expect(uneven.maxX).toBe(footprint.maxX);
  });
});
