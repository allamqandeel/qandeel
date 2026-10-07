/**
 * S5-03B R1 — the support capability of the one Living Analysis surface.
 *
 * `TIMELINE_AND_CHROME` is the Living Analysis Map's frozen composition and the default: asking for it, or asking for
 * nothing, is EXACTLY the plan T-11 always produced. `CHROME_ONLY` is a world with no temporal track: the band keeps the
 * same room, so the world above it is framed exactly as it is for every world, and the chrome alone takes it.
 */
import { SUPPORT_CAPABILITIES, bandFor, recompositionPlan, type PresentationBand } from '../plan';
import { presentationSurface, usableWidth } from '../surface';

const ENVELOPE = [
  { width: 320, height: 568 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 568, height: 320 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 1024 },
  { width: 1180, height: 400 },
] as const;
const INSETS = [
  { insetTop: 0, insetBottom: 0, insetLeft: 0, insetRight: 0 },
  { insetTop: 104, insetBottom: 34, insetLeft: 0, insetRight: 0 },
  { insetTop: 59, insetBottom: 21, insetLeft: 44, insetRight: 44 },
] as const;
const FONT_SCALES = [1, 2, 3.5] as const;

function surfaces() {
  const out = [];
  for (const size of ENVELOPE) {
    for (const insets of INSETS) {
      for (const fontScale of FONT_SCALES) {
        const surface = presentationSurface({ ...size, ...insets, fontScale });
        if (surface !== null) out.push(surface);
      }
    }
  }
  return out;
}

const BANDS: readonly (PresentationBand | null)[] = [null, 'COMPACT', 'EXPANSIVE'];

describe('S5-03B R1 — the default support capability is the frozen composition, unchanged', () => {
  it('names exactly two capabilities, the frozen one first', () => {
    expect(SUPPORT_CAPABILITIES).toEqual(['TIMELINE_AND_CHROME', 'CHROME_ONLY']);
  });

  it('asking for TIMELINE_AND_CHROME, or for nothing, is the plan T-11 always produced', () => {
    for (const surface of surfaces()) {
      for (const band of BANDS) {
        const frozen = recompositionPlan(surface, { band });
        expect(recompositionPlan(surface, { band, support: 'TIMELINE_AND_CHROME' })).toEqual(frozen);
        expect(recompositionPlan(surface, { band, support: undefined })).toEqual(frozen);
      }
    }
  });
});

describe('S5-03B R1 — CHROME_ONLY: the same room, the same world frame, no instrument', () => {
  it('keeps the band and the world frame exactly as every world has them', () => {
    for (const surface of surfaces()) {
      const band = bandFor(usableWidth(surface));
      const frozen = recompositionPlan(surface, { band });
      const chromeOnly = recompositionPlan(surface, { band, support: 'CHROME_ONLY' });
      expect(chromeOnly.mapFrame).toEqual(frozen.mapFrame);
      // The same chrome composition, except that no Timeline row stands above it to keep a gap from.
      expect(chromeOnly.chrome).toEqual({ ...frozen.chrome, gapPoints: 0 });
      expect(chromeOnly.band).toBe(frozen.band);
      expect(chromeOnly.support.bandPoints).toBe(frozen.support.bandPoints);
      expect(chromeOnly.support.gapPoints).toBe(frozen.support.gapPoints);
    }
  });

  it('gives the whole band to the chrome, stacked across the available width, and composes no instrument', () => {
    for (const surface of surfaces()) {
      const plan = recompositionPlan(surface, { support: 'CHROME_ONLY' });
      expect(plan.support.arrangement).toBe('STACKED');
      expect(plan.support.timelinePoints).toBe(0);
      expect(plan.timelineWidthPoints).toBe(0);
      expect(plan.support.chromePoints).toBe(plan.support.bandPoints);
      expect(plan.chrome.gapPoints).toBe(0);
      // Never less room than the frozen composition gave the chrome: the instrument's room is the chrome's now.
      expect(plan.support.chromePoints).toBeGreaterThanOrEqual(recompositionPlan(surface).support.chromePoints);
    }
  });
});
