/**
 * T-11 — the pure recomposition owner: measurement, bands, idempotence and jitter.
 *
 * Everything here runs without a renderer, a frame, a gesture or a store, because everything here
 * IS a pure function. The proofs that need a real component are in the suites beside this one; what
 * this file proves is that the arithmetic underneath them cannot be talked into a second answer.
 */
import {
  BAND_HYSTERESIS_POINTS,
  CHROME_MAX_MEASURE_POINTS,
  CHROME_OWN_HORIZONTAL_PADDING,
  EXPANSIVE_BAND_PADDING,
  EXPANSIVE_MIN_WIDTH,
  MAP_MIN_HEIGHT_POINTS,
  PAIRED_COLUMN_GAP_POINTS,
  PAIRED_MIN_CELL_POINTS,
  PRESENTATION_BANDS,
  SHORT_HEIGHT_POINTS,
  bandFor,
  planEquals,
  recompositionPlan,
  type PresentationBand,
  type RecompositionPlan,
} from '../plan';
import { MAX_TRACKED_FONT_SCALE, presentationSurface, quantizePoints, surfaceEquals, usableHeight, usableWidth } from '../surface';

/** The supported proof envelope, by measurement rather than by any device name. */
const ENVELOPE = [
  { id: 'C1', width: 320, height: 568 },
  { id: 'C2', width: 360, height: 800 },
  { id: 'C3', width: 390, height: 844 },
  { id: 'C4', width: 412, height: 915 },
  { id: 'C5', width: 568, height: 320 },
  { id: 'C6', width: 844, height: 390 },
  { id: 'C7', width: 768, height: 1024 },
  { id: 'C8', width: 1024, height: 768 },
  { id: 'C9', width: 1366, height: 1024 },
] as const;

const surfaceOf = (width: number, height: number, extra: Record<string, number> = {}) => {
  const built = presentationSurface({ width, height, ...extra });
  if (built === null) throw new Error(`${width}x${height} should be a surface`);
  return built;
};

const planOf = (width: number, height: number, extra: Record<string, number> = {}, previous: RecompositionPlan | null = null) =>
  recompositionPlan(surfaceOf(width, height, extra), { band: previous === null ? null : previous.band });

describe('T11 — a measurement is normalized, or it is refused', () => {
  it('quantizes to whole points, so a container that has not moved recomposes nothing', () => {
    // The float pair a 360-point container reports on a non-integer density.
    const a = surfaceOf(359.99998474121094, 799.9999694824219);
    const b = surfaceOf(360.0000152587891, 800.0000305175781);
    expect(a.width).toBe(360);
    expect(a.height).toBe(800);
    expect(surfaceEquals(a, b)).toBe(true);
    expect(quantizePoints(0.4)).toBe(0);
    expect(quantizePoints(0.5)).toBe(1);
  });

  it('T11-A20 — a rect that is not a surface produces no plan rather than a guess', () => {
    expect(presentationSurface({ width: 0, height: 800 })).toBeNull();
    expect(presentationSurface({ width: 320, height: 0 })).toBeNull();
    expect(presentationSurface({ width: Number.NaN, height: 800 })).toBeNull();
    expect(presentationSurface({ width: Number.POSITIVE_INFINITY, height: 800 })).toBeNull();
    expect(presentationSurface({ width: -320, height: 800 })).toBeNull();
    // Insets that have consumed the whole rect are not a smaller surface.
    expect(presentationSurface({ width: 320, height: 800, insetLeft: 160, insetRight: 160 })).toBeNull();
    expect(presentationSurface({ width: 320, height: 800, insetTop: 400, insetBottom: 400 })).toBeNull();
    expect(presentationSurface({ width: 320, height: 800, fontScale: 0 })).toBeNull();
    expect(presentationSurface({ width: 320, height: 800, fontScale: Number.NaN })).toBeNull();
  });

  it('clamps an unbounded font scale without making it a different surface', () => {
    expect(surfaceOf(320, 568, { fontScale: 1.35 }).fontScale).toBe(1.35);
    expect(surfaceOf(320, 568, { fontScale: 99 }).fontScale).toBe(MAX_TRACKED_FONT_SCALE);
  });

  it('insets change the usable rect and nothing else', () => {
    const surface = surfaceOf(390, 844, { insetTop: 48, insetBottom: 34, insetLeft: 8, insetRight: 8 });
    expect(usableWidth(surface)).toBe(374);
    expect(usableHeight(surface)).toBe(762);
    expect(surface.width).toBe(390);
    expect(surface.height).toBe(844);
  });
});

describe('T11 — bands are consequences, and there are exactly two', () => {
  it('names no device, and offers no third band to name one with', () => {
    expect(PRESENTATION_BANDS).toEqual(['COMPACT', 'EXPANSIVE']);
  });

  it('derives its one width boundary from the readable cell, the gap and the two paddings', () => {
    expect(EXPANSIVE_MIN_WIDTH).toBe(
      2 * PAIRED_MIN_CELL_POINTS + PAIRED_COLUMN_GAP_POINTS + 2 * CHROME_OWN_HORIZONTAL_PADDING + 2 * EXPANSIVE_BAND_PADDING,
    );
    expect(bandFor(EXPANSIVE_MIN_WIDTH - 1)).toBe('COMPACT');
    expect(bandFor(EXPANSIVE_MIN_WIDTH)).toBe('EXPANSIVE');
  });

  it('T11-A69 — a container resting on the boundary cannot flip band for ever', () => {
    // Settled wide, then jittering by less than the rhythm in both directions.
    let band: PresentationBand = bandFor(EXPANSIVE_MIN_WIDTH);
    expect(band).toBe('EXPANSIVE');
    for (const noise of [-1, +1, -4, +4, -7, +7, -1, 0]) {
      band = bandFor(EXPANSIVE_MIN_WIDTH + noise, band);
      expect(band).toBe('EXPANSIVE');
    }
    // Settled narrow, jittering upward by less than nothing: the up-crossing has no hysteresis, so
    // it happens exactly at the threshold and not one point earlier.
    let narrow: PresentationBand = bandFor(EXPANSIVE_MIN_WIDTH - 1);
    expect(narrow).toBe('COMPACT');
    for (const noise of [-1, -2, -1, -3]) {
      narrow = bandFor(EXPANSIVE_MIN_WIDTH - 1 + noise, narrow);
      expect(narrow).toBe('COMPACT');
    }
    // A real change still crosses, in both directions.
    expect(bandFor(EXPANSIVE_MIN_WIDTH, narrow)).toBe('EXPANSIVE');
    expect(bandFor(EXPANSIVE_MIN_WIDTH - BAND_HYSTERESIS_POINTS - 1, band)).toBe('COMPACT');
  });

  it('T11-A10 — the same inputs always produce the same band, and the band it produces is stable', () => {
    for (let width = 240; width <= 1400; width += 1) {
      const first = bandFor(width);
      expect(bandFor(width)).toBe(first);
      // The fixed-point property the measuring hook relies on: re-deriving the band from the band it
      // just produced returns that band.
      expect(bandFor(width, first)).toBe(first);
    }
  });
});

describe('T11 — the plan over the supported envelope', () => {
  it('composes every case, and never lets the world fall below its floor', () => {
    for (const testCase of ENVELOPE) {
      const plan = planOf(testCase.width, testCase.height);
      expect(plan.mapFrame.minHeightPoints).toBe(MAP_MIN_HEIGHT_POINTS);
      expect(plan.chrome.measurePoints).toBeGreaterThan(0);
      expect(plan.chrome.measurePoints).toBeLessThanOrEqual(testCase.width);
      // The plan asserts no vertical CEILING for the chrome. It cannot know the temporal surface's
      // height or the chrome's, because both depend on words that have not been laid out yet — so
      // the vertical arithmetic belongs to the layout engine and the plan says nothing about it.
      expect(Object.keys(plan.chrome).sort()).toEqual(['arrangement', 'bottomInset', 'gapPoints', 'measurePoints', 'paddingHorizontal']);
    }
  });

  it('pairs the acts only where vertical room is scarce AND the cell stays readable', () => {
    const arrangement = Object.fromEntries(ENVELOPE.map((c) => [c.id, planOf(c.width, c.height).chrome.arrangement]));
    expect(arrangement).toEqual({
      C1: 'STACKED',
      C2: 'STACKED',
      C3: 'STACKED',
      C4: 'STACKED',
      // Short landscape: the vertical room is what is scarce, and the width pays for it.
      C5: 'PAIRED',
      C6: 'PAIRED',
      // Wide and TALL: a single column costs nothing, so width alone never pairs them.
      C7: 'STACKED',
      C8: 'STACKED',
      C9: 'STACKED',
    });
  });

  it('every paired cell clears the readable floor', () => {
    for (const testCase of ENVELOPE) {
      const plan = planOf(testCase.width, testCase.height);
      if (plan.chrome.arrangement !== 'PAIRED') continue;
      const cell = (plan.chrome.measurePoints - 2 * CHROME_OWN_HORIZONTAL_PADDING - PAIRED_COLUMN_GAP_POINTS) / 2;
      expect(cell).toBeGreaterThanOrEqual(PAIRED_MIN_CELL_POINTS);
    }
  });

  it('an expansive window gains air around the same words rather than longer lines', () => {
    const wide = planOf(1366, 1024);
    expect(wide.band).toBe('EXPANSIVE');
    expect(wide.chrome.paddingHorizontal).toBe(EXPANSIVE_BAND_PADDING);
    // The reading clamp binds: the measure is the clamp plus T-08's own padding, not the window.
    expect(wide.chrome.measurePoints).toBe(CHROME_MAX_MEASURE_POINTS + 2 * CHROME_OWN_HORIZONTAL_PADDING);
    // and a compact window is given every point it has.
    const narrow = planOf(320, 568);
    expect(narrow.band).toBe('COMPACT');
    expect(narrow.chrome.paddingHorizontal).toBe(0);
    expect(narrow.chrome.measurePoints).toBe(320);
  });

  it('the clamp is continuous: nothing changes shape where it starts to bind', () => {
    let previous = planOf(560, 900);
    for (let width = 561; width <= 900; width += 1) {
      const plan = planOf(width, 900, {}, previous);
      // The measure only ever grows or holds, never jumps by more than the point that was added.
      expect(plan.chrome.measurePoints - previous.chrome.measurePoints).toBeLessThanOrEqual(1);
      expect(plan.chrome.measurePoints).toBeGreaterThanOrEqual(previous.chrome.measurePoints);
      // and no arrangement, band or gap changes anywhere across the clamp.
      expect(plan.chrome.arrangement).toBe(previous.chrome.arrangement);
      expect(plan.band).toBe(previous.band);
      expect(plan.chrome.gapPoints).toBe(previous.chrome.gapPoints);
      previous = plan;
    }
  });

  it('a short window is a different composition problem, not a smaller one', () => {
    expect(planOf(844, SHORT_HEIGHT_POINTS - 1).shortHeight).toBe(true);
    expect(planOf(844, SHORT_HEIGHT_POINTS).shortHeight).toBe(false);
    const short = planOf(844, 390);
    const tall = planOf(844, 900);
    expect(short.chrome.gapPoints).toBeLessThan(tall.chrome.gapPoints);
    expect(short.chrome.arrangement).toBe('PAIRED');
    expect(tall.chrome.arrangement).toBe('STACKED');
  });
});

describe('T11 — idempotence, jitter and the plan as a value', () => {
  it('T11-A10 — the same measurement always produces the same composition', () => {
    const first = planOf(390, 844);
    const again = recompositionPlan(surfaceOf(390, 844), { band: first.band });
    expect(planEquals(first, again)).toBe(true);
    expect(again).toEqual(first);
  });

  it('sub-point measurement noise produces the same plan', () => {
    const opening = planOf(390, 844);
    let plan = opening;
    for (const noise of [0.2, -0.3, 0.49, -0.4, 0.1]) {
      plan = recompositionPlan(surfaceOf(390 + noise, 844 + noise), { band: plan.band });
      expect(planEquals(plan, opening)).toBe(true);
    }
  });

  it('T11-A71 — wide, narrow and wide again returns an equivalent plan', () => {
    const wide = planOf(1024, 768);
    const narrow = recompositionPlan(surfaceOf(320, 568), { band: wide.band });
    const back = recompositionPlan(surfaceOf(1024, 768), { band: narrow.band });
    expect(planEquals(wide, back)).toBe(true);
    expect(back.band).toBe(wide.band);
    expect(back.chrome).toEqual(wide.chrome);
    expect(back.mapFrame).toEqual(wide.mapFrame);
  });

  it('T11-A72 — narrow, landscape and narrow again returns an equivalent plan', () => {
    const narrow = planOf(360, 800);
    const landscape = recompositionPlan(surfaceOf(800, 360), { band: narrow.band });
    const back = recompositionPlan(surfaceOf(360, 800), { band: landscape.band });
    expect(planEquals(narrow, back)).toBe(true);
  });

  it('the geometry identity names the mapping, and only the mapping', () => {
    const first = planOf(390, 844);
    // A pure font-scale change is presentation pressure; it maps no coordinate.
    expect(planOf(390, 844, { fontScale: 1.6 }).geometry).toBe(first.geometry);
    // A bottom-inset change moves padding and maps nothing.
    expect(planOf(390, 844, { insetBottom: 34 }).geometry).toBe(first.geometry);
    expect(planOf(390, 844, { insetBottom: 34 }).chrome.bottomInset).toBe(34);
    // A width, a height or a mapped inset replaces the frame a coordinate is taken through.
    for (const different of [planOf(500, 844), planOf(390, 900), planOf(390, 844, { insetLeft: 16 }), planOf(390, 844, { insetTop: 48 })]) {
      expect(different.geometry).not.toBe(first.geometry);
    }
    // It is an IDENTITY: the same frame always answers the same, and never remembers.
    expect(planOf(390, 844).geometry).toBe(first.geometry);
    expect(recompositionPlan(surfaceOf(390, 844), { band: 'EXPANSIVE' }).geometry).toBe(first.geometry);
    // Every case in the envelope has its own frame, so none can be mistaken for another.
    const identities = ENVELOPE.map((testCase) => planOf(testCase.width, testCase.height).geometry);
    expect(new Set(identities).size).toBe(ENVELOPE.length);
  });

  it('T11-A08, T11-A09 — an inset or a font scale changes presentation quantities only', () => {
    const plain = planOf(390, 844);
    const inset = planOf(390, 844, { insetBottom: 34 });
    const scaled = planOf(390, 844, { fontScale: 2 });
    for (const other of [inset, scaled]) {
      expect(other.band).toBe(plain.band);
      expect(other.chrome.arrangement).toBe(plain.chrome.arrangement);
      expect(other.mapFrame.minHeightPoints).toBe(plain.mapFrame.minHeightPoints);
    }
    expect(inset.chrome.bottomInset).toBe(34);
    expect(plain.chrome.bottomInset).toBe(0);
    // The font scale is carried, and it decides no composition of its own: growing the chrome is
    // what the words do, not what the plan does for them.
    expect(scaled.surface.fontScale).toBe(2);
    expect(scaled.chrome.measurePoints).toBe(plain.chrome.measurePoints);
  });

  it('every point of a continuous resize produces a plan, and the sweep settles', () => {
    let plan = planOf(240, 900);
    let crossings = 0;
    for (let width = 241; width <= 1400; width += 1) {
      const next = recompositionPlan(surfaceOf(width, 900), { band: plan.band });
      if (next.band !== plan.band) crossings += 1;
      plan = next;
    }
    // A monotonic sweep crosses the ONE boundary exactly once, whatever the hysteresis.
    expect(crossings).toBe(1);
    expect(plan.band).toBe('EXPANSIVE');
    // Sweeping back crosses it once more and returns to the composition it started from.
    for (let width = 1399; width >= 240; width -= 1) {
      const next = recompositionPlan(surfaceOf(width, 900), { band: plan.band });
      if (next.band !== plan.band) crossings += 1;
      plan = next;
    }
    expect(crossings).toBe(2);
    expect(planEquals(plan, planOf(240, 900))).toBe(true);
  });
});
