/**
 * AC-04 — the allocation arithmetic, measured across the whole envelope rather than argued about.
 *
 * The Phase-M report recorded an observation: for some measured heights the plan's own allocation
 * over-subscribes the surface by roughly 23 points, while T-12's ceiling and yield keep every
 * composed region on screen. That is a claim about arithmetic, so it is settled by arithmetic.
 *
 * These tests state the answer as a BOUNDARY rather than as a verdict. The window exists, it is
 * exactly 23 points wide, the excess is at most 23 points, it needs a surface with almost no
 * vertical safe-area inset, and nothing in it collapses. Pinning all four is what makes the
 * classification checkable later: any change that widens the window, deepens the excess, or lets a
 * region reach zero fails here instead of on a device.
 *
 * Nothing below asserts what Yoga does with an over-subscribed column — `jest-expo` performs no
 * layout, so a test that claimed to know would be claiming something it cannot see.
 */
import {
  CHROME_FLOOR_POINTS,
  MAP_MIN_HEIGHT_POINTS,
  SHORT_HEIGHT_POINTS,
  TIMELINE_ROW_POINTS,
  recompositionPlan,
} from '../plan';
import { presentationSurface, type PresentationSurface } from '../surface';

/** Widths spanning both bands, both chrome arrangements and both sides of the reading clamp. */
const WIDTHS = [320, 360, 375, 390, 412, 480, 552, 568, 600, 700, 768, 816, 844, 1024, 1366] as const;
const HEIGHT_FROM = 300;
const HEIGHT_TO = 1400;

interface Composed {
  readonly surface: PresentationSurface;
  readonly world: number;
  readonly band: number;
  readonly gap: number;
  readonly total: number;
  readonly excess: number;
}

/** What the plan asks the measured column for: the world it may take, the gap, and the band. */
function compose(width: number, height: number, insetTop = 0, insetBottom = 0): Composed | null {
  const surface = presentationSurface({ width, height, insetTop, insetBottom });
  if (surface === null) return null;
  const plan = recompositionPlan(surface);
  // `basisPoints` is the flex basis and `ceilingPoints` the max height, so the most the world can
  // hold is the smaller of the two. The band neither grows nor yields.
  const world = Math.min(plan.mapFrame.basisPoints, plan.mapFrame.ceilingPoints);
  const total = world + plan.support.gapPoints + plan.support.bandPoints;
  return { surface, world, band: plan.support.bandPoints, gap: plan.support.gapPoints, total, excess: total - surface.height };
}

test('AC-04.1 — no region is ever allocated zero, anywhere in the measured envelope', () => {
  const zero: string[] = [];
  for (let height = HEIGHT_FROM; height <= HEIGHT_TO; height += 1) {
    for (const width of WIDTHS) {
      const surface = presentationSurface({ width, height });
      if (surface === null) continue;
      const plan = recompositionPlan(surface);
      if (
        plan.support.timelinePoints <= 0 ||
        plan.support.chromePoints <= 0 ||
        plan.support.bandPoints <= 0 ||
        plan.mapFrame.ceilingPoints < MAP_MIN_HEIGHT_POINTS ||
        plan.timelineWidthPoints <= 0
      ) {
        zero.push(`${width}x${height}`);
      }
    }
  }
  // The defect this whole mechanism exists to close was a truthful region resolving to zero. It
  // does not happen at any measurement in the envelope — which is the first half of the answer.
  expect(zero).toEqual([]);
});

test('AC-04.2 — the partition is exact wherever the world’s own floor does not bind', () => {
  const wrong: string[] = [];
  for (let height = HEIGHT_FROM; height <= HEIGHT_TO; height += 1) {
    for (const width of WIDTHS) {
      const composed = compose(width, height);
      if (composed === null) continue;
      const plan = recompositionPlan(composed.surface);
      const remainder = composed.surface.height - plan.support.bandPoints - plan.support.gapPoints;
      if (remainder < MAP_MIN_HEIGHT_POINTS) continue; // the floor binds; see AC-04.3
      if (plan.mapFrame.ceilingPoints + plan.support.bandPoints + plan.support.gapPoints !== composed.surface.height) {
        wrong.push(`${width}x${height}`);
      }
    }
  }
  // What the world may take, plus the gap, plus the band IS the measured column — exactly, not
  // approximately — everywhere the floor leaves room for it.
  expect(wrong).toEqual([]);
});

test('AC-04.3 — the over-subscribed window is exactly 456…478 usable points, and at most 23 points deep', () => {
  const byHeight = new Map<number, Set<number>>();
  let deepest = 0;
  for (let height = HEIGHT_FROM; height <= HEIGHT_TO; height += 1) {
    for (const width of WIDTHS) {
      const composed = compose(width, height);
      if (composed === null || composed.excess <= 0) continue;
      const widths = byHeight.get(height) ?? new Set<number>();
      widths.add(width);
      byHeight.set(height, widths);
      deepest = Math.max(deepest, composed.excess);
    }
  }

  const heights = [...byHeight.keys()].sort((a, b) => a - b);
  // One contiguous window, opening exactly where the short-height composition stops applying and
  // closing where the band plus the world's floor first fit inside the column.
  const expected = [];
  for (let h = SHORT_HEIGHT_POINTS; h < MAP_MIN_HEIGHT_POINTS + CHROME_FLOOR_POINTS + TIMELINE_ROW_POINTS + 2 * 12; h += 1) {
    expected.push(h);
  }
  expect(heights).toEqual(expected);
  expect(heights[0]).toBe(456);
  expect(heights[heights.length - 1]).toBe(478);
  expect(heights).toHaveLength(23);
  // Width-independent: the window is a vertical arithmetic fact and no band or arrangement escapes it.
  for (const widths of byHeight.values()) expect(widths.size).toBe(WIDTHS.length);
  // And the excess is bounded by the window's own width. It is never a whole region.
  expect(deepest).toBe(23);
  expect(deepest).toBeLessThan(TIMELINE_ROW_POINTS);
  expect(deepest).toBeLessThan(CHROME_FLOOR_POINTS);
});

test('AC-04.4 — a surface with real vertical safe-area insets has no over-subscribed window at all', () => {
  // The branch arithmetic runs on the USABLE height while the ceiling is taken from the MEASURED
  // column, so any vertical inset is headroom the window is paid out of. 23 points of it closes the
  // window completely — less than a status bar on either platform.
  for (const [top, bottom] of [
    [24, 34],
    [0, 24],
    [23, 0],
    [44, 34],
  ] as const) {
    const over: string[] = [];
    for (let height = HEIGHT_FROM; height <= HEIGHT_TO; height += 1) {
      for (const width of WIDTHS) {
        const composed = compose(width, height, top, bottom);
        if (composed !== null && composed.excess > 0) over.push(`${width}x${height}`);
      }
    }
    expect({ top, bottom, over }).toEqual({ top, bottom, over: [] });
  }
});

test('AC-04.5 — the short-height composition reconciles against the world’s floor and never over-subscribes', () => {
  // Both short branches subtract `MAP_MIN_HEIGHT_POINTS` before allocating, which is exactly what
  // the taller branch does not do. Short landscape — the composition the device defect was found in
  // — is therefore inside the surface by construction rather than by luck.
  for (let height = HEIGHT_FROM; height < SHORT_HEIGHT_POINTS; height += 1) {
    for (const width of WIDTHS) {
      const composed = compose(width, height);
      if (composed === null) continue;
      expect(recompositionPlan(composed.surface).shortHeight).toBe(true);
      expect(composed.total).toBeLessThanOrEqual(composed.surface.height);
    }
  }
});

test('AC-04.6 — the Honor’s measured configurations are outside the window, either way up', () => {
  // The two compositions physically measured on hardware, and the two the device produced after the
  // T-12 correction. None of them is in the window, which is why the observation is arithmetic
  // rather than something the device ever showed.
  for (const [width, height] of [
    [369, 816],
    [816, 369],
    [369, 816],
    [816, 369],
  ] as const) {
    const composed = compose(width, height);
    expect(composed).not.toBeNull();
    expect(composed?.excess).toBeLessThanOrEqual(0);
  }
});
