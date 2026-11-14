// NASIJ (experimental, isolated) — the UI-thread twins are held to the core, value for value.

import { STEP_THRESHOLD, clampScale, depthOf, layerOpacities, stepFor, weaveOctaves } from '../core/camera';
import { clampLs, depthOfLs, groundAlphaAt, layerAlphaAt, mod, stepForLs, unheldMaskOf, weaveOctaveAt } from '../skia/worklets';

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

  it('weaveOctaveAt equals weaveOctaves, and at a rung the coarser octave is exactly opaque', () => {
    for (let d = -0.3; d <= 4.3; d += 0.037) {
      const ls = d * Math.log(8);
      const expected = weaveOctaves(Math.exp(ls));
      const a = weaveOctaveAt(ls, 0); const b = weaveOctaveAt(ls, 1);
      expect(a.spacing).toBeCloseTo(expected[0].spacing, 9);
      expect(a.alpha).toBeCloseTo(expected[0].alpha, 5);
      if (expected.length > 1) { expect(b.spacing).toBeCloseTo(expected[1].spacing, 9); expect(b.alpha).toBeCloseTo(expected[1].alpha, 5); } else expect(b.alpha).toBe(0);
    }
    for (let rung = 0; rung < 5; rung += 1) {
      const ls = Math.log(Math.pow(8, rung));
      expect(weaveOctaveAt(ls, 0).alpha).toBe(1);
      expect(weaveOctaveAt(ls, 1).alpha).toBe(0);
      // At rest: no ground pass under the opaque weave. Between rungs: the ground is drawn.
      expect(groundAlphaAt(ls)).toBe(0);
      expect(groundAlphaAt(ls + 0.4)).toBe(1);
    }
  });

  it('mod is never negative', () => {
    expect(mod(-1, 26)).toBe(25);
    expect(mod(27, 26)).toBe(1);
    expect(mod(-52, 26)).toBe(0);
  });
});
