// COSMOS (experimental, isolated) — the UI-thread twins are held to the core, value for value.

import { STEP_THRESHOLD, clampScale, depthOf, layerOpacities, stepFor } from '../core/camera';
import { clampLs, depthOfLs, layerAlphaAt, mod, percentileOf, plateMotions, plateOffsetOf, stepForLs, unheldMaskOf } from '../skia/worklets';

describe('the worklet twins', () => {
  it('layerAlphaAt equals layerOpacities at every depth, for every held pattern', () => {
    const patterns: (boolean[] | null)[] = [null, [true, true, true, true, true], [true, false, true, true, false], [false, true, true, false, true], [true, true, false, false, true]];
    for (const rungs of [3, 5]) {
      for (const pattern of patterns) {
        const held = pattern === null ? null : pattern.slice(0, rungs);
        const mask = unheldMaskOf(held);
        for (let d = -0.4; d <= rungs - 0.6; d += 0.013) {
          const expected = layerOpacities(d, rungs, held);
          for (let r = 0; r < rungs; r += 1) expect(layerAlphaAt(d, rungs, mask, r)).toBeCloseTo(expected[r], 12);
        }
      }
    }
  });

  it('clampLs, depthOfLs and stepForLs equal their core forms', () => {
    for (const scale of [1e-6, 0.5, 1, 7.9, 8, 64, 500, 1e9]) {
      expect(Math.exp(clampLs(Math.log(scale), 3))).toBeCloseTo(clampScale(scale, 3), 9);
      expect(depthOfLs(Math.log(scale))).toBeCloseTo(depthOf(scale), 12);
    }
    const word = (n: number) => (n > 0 ? 'IN' : n < 0 ? 'OUT' : null);
    for (const ratio of [0.5, 1 / STEP_THRESHOLD - 1e-9, 0.95, 1, 1.1, STEP_THRESHOLD + 1e-9, 3]) expect(word(stepForLs(Math.log(ratio)))).toBe(stepFor(ratio));
  });

  it("the plate transform is the gate's, folded into one repeat of the tile", () => {
    // The gate: k = 1.05·scale^zExp·900/1024 for a 1024 tile; offset = focus − tile·k/2 − camera·scale^0.55·pan + drift·t.
    const gate = (cam: { cx: number; cy: number; scale: number }, fx: number, fy: number, t: number, zExp: number, pan: number, dx: number, dy: number) => {
      const k = (1.05 * Math.pow(cam.scale, zExp) * 900) / 1024; const shift = Math.pow(cam.scale, 0.55);
      return { k, x: fx - 1024 * k * 0.5 - cam.cx * shift * pan + dx * t, y: fy - 1024 * k * 0.5 - cam.cy * shift * pan + dy * t };
    };
    for (const rungs of [3, 5]) {
      const motions = plateMotions(rungs);
      expect(motions.gas.zExp).toBeCloseTo(Math.log(2.3) / Math.log(Math.pow(8, rungs - 1)), 12);
      for (const m of [motions.deep, motions.gas, motions.veil]) {
        for (const cam of [{ cx: 0, cy: 0, scale: 1 }, { cx: 37.5, cy: -210.25, scale: 8 }, { cx: -4000, cy: 911, scale: 64 }]) {
          const want = gate(cam, 195, 344, 12.5, m.zExp, m.pan, m.driftX, m.driftY);
          for (const pixels of [1024, 512]) {
            const got = plateOffsetOf(cam.cx, cam.cy, Math.log(cam.scale), 195, 344, 12.5, m.zExp, m.pan, m.driftX, m.driftY, pixels);
            const period = want.k * 1024;
            // One repeat is the same size on the glass whatever the image's own pixel size.
            expect(got.k * pixels).toBeCloseTo(period, 9);
            expect(got.x).toBeGreaterThanOrEqual(0); expect(got.x).toBeLessThan(period);
            // The same placement, a whole number of repeats away.
            for (const off of [mod(got.x - want.x, period), mod(got.y - want.y, period)]) expect(Math.min(off, period - off)).toBeLessThan(1e-6);
          }
        }
      }
    }
  });

  it('mod is never negative, and the percentile is nearest-rank', () => {
    expect(mod(-1, 26)).toBe(25);
    expect(mod(27, 26)).toBe(1);
    expect(mod(-52, 26)).toBe(0);
    const sorted = Array.from({ length: 100 }, (_unused, i) => i + 1);
    expect(percentileOf(sorted, 100, 0.5)).toBe(51);
    expect(percentileOf(sorted, 100, 0.95)).toBe(96);
    expect(percentileOf(sorted, 0, 0.5)).toBe(0);
  });
});
