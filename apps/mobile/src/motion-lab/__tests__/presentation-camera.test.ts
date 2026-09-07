/**
 * T-10.0 — the residual camera arithmetic: re-basing preserves the frame exactly, for a pan, for
 * a semantic zoom, and for a travel with a zoom together; hit testing inverts the presentation.
 */
import { AT_REST, counterScale, isAtRest, planeTransform, rebaseResidual, toCanonical, toScreen, travelDistance, type ResidualCamera } from '../motion/presentation-camera';

const center = { x: 215, y: 240 };

/** Where a node at canonical-camera position `p` is drawn under `residual`. */
const drawn = (p: { x: number; y: number }, residual: ResidualCamera) => toScreen(p, residual, center);

describe('presentation camera residual', () => {
  test('at rest the screen shows the canonical camera exactly', () => {
    const p = { x: 300, y: 100 };
    expect(drawn(p, AT_REST)).toEqual(p);
    expect(isAtRest(AT_REST)).toBe(true);
    expect(planeTransform(AT_REST)).toEqual([0, 0, 1]);
  });

  test('a committed pan re-bases the residual to rest and keeps every node where it was drawn', () => {
    // The finger moved the plane by t; the PAN committed exactly that, so the new anchor was drawn
    // at centre − t on the old screen: d = −t.
    const residual: ResidualCamera = { tx: -80, ty: 35, zoom: 1 };
    const p = { x: 300, y: 100 };
    const before = drawn(p, residual);
    const after = rebaseResidual(residual, 1, { x: 80, y: -35 });
    // Under the new camera the node's canonical position moved by −d = t.
    const pAfter = { x: p.x + residual.tx, y: p.y + residual.ty };
    expect(drawn(pAfter, after)).toEqual(before);
    expect(isAtRest(after)).toBe(true);
  });

  test('a semantic zoom IN by one rung re-bases to zoom 1/8 and preserves the frame', () => {
    const residual = AT_REST;
    const p = { x: 300, y: 100 };
    const before = drawn(p, residual);
    const after = rebaseResidual(residual, 8, { x: 0, y: 0 });
    const pAfter = { x: center.x + 8 * (p.x - center.x), y: center.y + 8 * (p.y - center.y) };
    expect(after.zoom).toBeCloseTo(1 / 8, 12);
    expect(drawn(pAfter, after).x).toBeCloseTo(before.x, 9);
    expect(drawn(pAfter, after).y).toBeCloseTo(before.y, 9);
    // The node's radius is counter-scaled so it does not pop on the commit frame.
    expect(counterScale(after.zoom)).toBeCloseTo(8, 12);
  });

  test('a landing with a depth change re-bases both, from a residual that was still moving', () => {
    const residual: ResidualCamera = { tx: 12, ty: -9, zoom: 1.03 };
    const p = { x: 340, y: 60 };
    const before = drawn(p, residual);
    const k = 1 / 8; // zoom OUT with a travel: the World return
    const d = { x: 50, y: -70 }; // where the World anchor was drawn on the old screen, relative to centre
    const after = rebaseResidual(residual, k, d);
    // Under the new camera: p' − c = k·(p − c) − k·d
    const pAfter = { x: center.x + k * (p.x - center.x) - k * d.x, y: center.y + k * (p.y - center.y) - k * d.y };
    expect(drawn(pAfter, after).x).toBeCloseTo(before.x, 9);
    expect(drawn(pAfter, after).y).toBeCloseTo(before.y, 9);
    expect(travelDistance(after)).toBeGreaterThan(0);
  });

  test('a touch is inverted through the residual before T-04 hit-tests it', () => {
    const residual: ResidualCamera = { tx: -40, ty: 22, zoom: 0.5 };
    const p = { x: 120, y: 300 };
    const s = toScreen(p, residual, center);
    const back = toCanonical(s, residual, center);
    expect(back.x).toBeCloseTo(p.x, 9);
    expect(back.y).toBeCloseTo(p.y, 9);
  });
});
