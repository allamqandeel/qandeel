/**
 * T-11 — the recomposition plan: how a measured surface is composed, and nothing about what is true.
 *
 * **Recompose density, never meaning.**
 *
 * A plan is a pure function of a `PresentationSurface` (and, for the hysteresis alone, of the band
 * that was already settled). It decides how much room each region gets and how the chrome arranges
 * itself. It decides nothing about the world, the camera, time, disclosure, the offered acts or a
 * single word — and it cannot: it can reach no store, no executor and no projection, and it names
 * no Product concept at all.
 *
 * ## Bands are consequences, not identities
 *
 * There is exactly ONE width boundary and ONE height modifier, and both are derived from content
 * stress rather than from any device. Nothing here mentions a phone, a tablet, a desktop, a brand,
 * a model or a platform, and nothing may: a breakpoint that names a device becomes a Product
 * concept the moment somebody reads it, and then two devices have two Products.
 *
 * ### `EXPANSIVE_MIN_WIDTH = 552` — where a single column stops being the only truthful choice
 *
 * The longest reader-facing wording in the chrome is a 116-character English return hint at T-08's
 * 13-point hint size. It wraps at every supported width, so what matters is not whether it fits but
 * how short its lines become. The mobile line-length floor is 35 characters; at 13 points an
 * average Latin advance is ≈ 6.5 points, so 35 characters ≈ 227.5 points — `232` on the 8-point
 * rhythm, which is `PAIRED_MIN_CELL_POINTS`. Two such cells, the 8-point minimum between touch
 * targets, T-08's own 16-point horizontal padding and the band's own breathing room give
 *
 *     2 × 232 + 8 + 2 × 16 + 2 × 24 = 552
 *
 * Below it a second column would take every control's lines under the readable floor, so the single
 * column is not a compromise — it is the only arrangement that keeps the words readable.
 *
 * ### `SHORT_HEIGHT_POINTS = 456` — where the world and the chrome compete for every point
 *
 * The Timeline's own strip is T-05's 48-point Track, its 44-point position rail and T-06's 44-point
 * target strip: `136`. The smallest chrome that still says where the reader is and offers one way
 * back is T-08's own `12 + (21 + 4 + 21) + 12 + 21 + 12 + 44 + 12 = 159`. The Map floor below is
 * `160`. Their sum is `455`, which is `456` on the 8-point rhythm. Above it there is slack to
 * spend; below it every point given to one region is taken from another, which is what makes short
 * landscape a different composition problem rather than a smaller one.
 *
 * Both quantities are MINIMUMS and are used as nothing else. The temporal surface's real height is
 * larger and content-dependent — T-05's and T-06's accessible non-drag routes are real, visible
 * controls whose wording wraps — and the chrome's real height depends on how many acts are offered
 * and how long their Arabic runs. Neither is knowable in advance, which is exactly why nothing here
 * hands out a height CEILING computed from them: the composition's vertical arithmetic is left to
 * the layout engine, which is the only thing that has measured the words.
 *
 * ### `MAP_MIN_HEIGHT_POINTS = 160` — the world never disappears
 *
 * T-04 draws a Home at radius 13 and rings its contextual appearances at radius 40 with a 22-point
 * step. Two turns of that ring is a 124-point diameter; with 18 points of air on each side the Map
 * keeps `160`. Less than that is not a smaller world, it is a strip that cannot show one Thread and
 * what is bound to it — and "the Map may show less" was never permission for the Map to vanish.
 *
 * ### `CHROME_MAX_MEASURE_POINTS = 544` — a wide window is not a wide paragraph
 *
 * At T-08's 15-point label size an average Latin advance is ≈ 7.5 points, so the 72-character upper
 * end of the comfortable reading measure is 540 points — `544` on the 8-point rhythm. Past that the
 * extra width becomes air around the words rather than longer lines. This is a CLAMP and not a
 * band: it is continuous, it binds gradually, and no composition changes shape when it starts to
 * apply.
 *
 * ## Hysteresis, and why it is a pure function
 *
 * A container resting exactly on the boundary would otherwise flip band on sub-point noise for as
 * long as it sat there. So crossing UP happens at the threshold and crossing DOWN happens 8 points
 * below it — the 8-point rhythm, the smallest change that is a layout change rather than noise.
 * The previously settled band is an ARGUMENT rather than hidden state, so the function stays pure
 * and total: with no previous band the plain thresholds apply, and the same pair of inputs always
 * produces the same band.
 */
import { usableHeight, usableWidth, type PresentationSurface } from './surface';

/**
 * Two bands, and deliberately not three.
 *
 * `COMPACT` is not "a phone" and `EXPANSIVE` is not "a tablet": they are "the chrome must be a
 * single column" and "it need not be". Everything else that changes with size — the reading
 * measure, the breathing room, the Map's share — changes continuously and needs no band at all.
 */
export const PRESENTATION_BANDS = Object.freeze(['COMPACT', 'EXPANSIVE'] as const);
export type PresentationBand = (typeof PRESENTATION_BANDS)[number];

/** How the return acts are laid out. Presentation only: the same acts, in the same order. */
export const CHROME_ARRANGEMENTS = Object.freeze(['STACKED', 'PAIRED'] as const);
export type ChromeArrangement = (typeof CHROME_ARRANGEMENTS)[number];

/** The readable floor for one cell of a paired arrangement: 35 characters at the hint's 13 points. */
export const PAIRED_MIN_CELL_POINTS = 232;
/** The 8-point rhythm: the smallest difference that is a layout change rather than measurement noise. */
export const BAND_HYSTERESIS_POINTS = 8;
/** The platform minimum between two touch targets. */
export const PAIRED_COLUMN_GAP_POINTS = 8;
/** T-08's own horizontal padding. The band frames the chrome; it never reaches inside it. */
export const CHROME_OWN_HORIZONTAL_PADDING = 16;
/** Breathing room an expansive window earns. Air around the same words, never a second Product. */
export const EXPANSIVE_BAND_PADDING = 24;

export const EXPANSIVE_MIN_WIDTH =
  2 * PAIRED_MIN_CELL_POINTS + PAIRED_COLUMN_GAP_POINTS + 2 * CHROME_OWN_HORIZONTAL_PADDING + 2 * EXPANSIVE_BAND_PADDING;
export const MAP_MIN_HEIGHT_POINTS = 160;
/**
 * The world is sized first, at this fraction of the usable height.
 *
 * Not a taste: "support AROUND the world" is a Product statement, and a composition where the
 * support holds most of the surface has replaced the world with a description of it. Half is the
 * smallest share that keeps the world the subject, and it is a FLOOR on its share rather than a
 * cap — the world grows into whatever the support does not need.
 */
export const WORLD_SHARE_DENOMINATOR = 2;
export const TIMELINE_ROW_POINTS = 136;
export const CHROME_FLOOR_POINTS = 159;
export const SHORT_HEIGHT_POINTS = 456;
export const CHROME_MAX_MEASURE_POINTS = 544;
/** The gap between the world and the support around it, at the two vertical rhythms. */
export const BAND_GAP_POINTS = 12;
export const SHORT_BAND_GAP_POINTS = 4;

/**
 * The band for a usable width, given the band already settled.
 *
 * `previous === null` is the first evaluation and has no band to keep, so the plain thresholds
 * apply. Otherwise the boundary is asymmetric by exactly `BAND_HYSTERESIS_POINTS`.
 */
export function bandFor(usable: number, previous: PresentationBand | null = null): PresentationBand {
  if (!Number.isFinite(usable)) return 'COMPACT';
  if (previous === 'EXPANSIVE') return usable >= EXPANSIVE_MIN_WIDTH - BAND_HYSTERESIS_POINTS ? 'EXPANSIVE' : 'COMPACT';
  return usable >= EXPANSIVE_MIN_WIDTH ? 'EXPANSIVE' : 'COMPACT';
}

/** How the chrome band frames T-08's chrome. Every number is a layout quantity; none is a Product one. */
export interface ChromeComposition {
  readonly arrangement: ChromeArrangement;
  /** The band's content width, after its own padding and the reading clamp. */
  readonly measurePoints: number;
  /** The band's padding OUTSIDE the chrome. T-08's own 16 points are untouched. */
  readonly paddingHorizontal: number;
  /** The vertical gap between the Timeline row and the chrome. */
  readonly gapPoints: number;
  /** Forwarded to T-08's own `bottomInset` seam. The band is the bottom-most surface. */
  readonly bottomInset: number;
}

/** The frame the Map is composed in. Its own rect is MEASURED by that frame, never predicted here. */
export interface MapFrameComposition {
  /**
   * The room the world is given BEFORE the support around it asks for any.
   *
   * The world is the subject and the rest is support around it, so the support cannot take the
   * surface by growing: the world is sized first, at half the usable height or its floor, whichever
   * is larger, and it GROWS into whatever the support does not need. On a tall window with little
   * to say the world takes almost all of it; on a window where the support needs more than half,
   * the support yields and reaches its own overflow rather than pushing the world into a strip.
   *
   * Without this the arithmetic runs the other way — the support takes its natural height and the
   * world gets the remainder — and the visual proof showed exactly where that ends: a 1024-point
   * window with a 150-point world under 870 points of support, which is a description of the world
   * where the world should be.
   */
  readonly basisPoints: number;
  readonly minHeightPoints: number;
  readonly insetTop: number;
  readonly insetRight: number;
  readonly insetLeft: number;
}

/**
 * How the two support regions share the band beneath the world.
 *
 * `STACKED` is the normal composition: the temporal instrument above the orientation, each with its
 * own frozen minimum. `SIDE_BY_SIDE` is the short-height composition, where stacking the two full
 * vertical minimums (136 + 159) would cost more height than a short window has to give. Placing them
 * across instead costs `max(136, 159)` rather than their sum, which is what lets a short window keep
 * BOTH truths at full size instead of removing one of them.
 */
export type SupportArrangement = 'STACKED' | 'SIDE_BY_SIDE';

/**
 * The room each support region is GIVEN, decided before either of them renders.
 *
 * This exists because a support region whose height is inferred from its content cannot state a floor:
 * both regions hold a `ScrollView`, a scroller reports no intrinsic height to its parent, and the world
 * is the only child that grows — so "whatever the world did not take" was resolving to zero and taking
 * a truthful region off the surface with it. The allocation is therefore decided here, in arithmetic
 * over the measured surface and the three frozen minimums, and handed to the components as a basis.
 *
 * It is an ALLOCATION, never a ceiling: each region still clips to what it was given and keeps the
 * remainder reachable inside its own scroller, exactly as before.
 */
export interface SupportComposition {
  readonly arrangement: SupportArrangement;
  /** The whole band beneath the world, gaps between the two regions included. */
  readonly bandPoints: number;
  /** The temporal instrument's share. In `SIDE_BY_SIDE` this is the band's full height. */
  readonly timelinePoints: number;
  /** The orientation's share. In `SIDE_BY_SIDE` this is the band's full height. */
  readonly chromePoints: number;
  /**
   * The width the orientation is composed in.
   *
   * The whole band width when stacked; its own half of the band when across. Across, the two widths
   * are stated rather than left to flex, so the instrument and the orientation each get a definite
   * measure and neither can be squeezed out by the other.
   */
  readonly chromeWidthPoints: number;
  /** The vertical rhythm between the world and the band, and between the two regions when stacked. */
  readonly gapPoints: number;
}

export interface RecompositionPlan {
  readonly surface: PresentationSurface;
  readonly band: PresentationBand;
  /** Whether the world and the chrome are competing for every point. */
  readonly shortHeight: boolean;
  readonly mapFrame: MapFrameComposition;
  readonly chrome: ChromeComposition;
  /** The room the two support regions are given, and how they share it. */
  readonly support: SupportComposition;
  /**
   * The width the Timeline row is composed in. T-05 measures its own viewport inside it.
   *
   * Deliberately NOT the chrome's reading measure. The reading clamp exists because a 1366-point
   * line of prose is unreadable; a Timeline is not prose. It is a temporal instrument, and every
   * extra point of it is one more disclosed Moment the reader can see and reach at once — so it
   * gets the whole available width, and only the words are clamped.
   */
  readonly timelineWidthPoints: number;
  /**
   * WHICH coordinate mapping this composition is, as one number.
   *
   * Deliberately an identity rather than a counter. A consumer that maps physical coordinates
   * through this composition needs to recognise a coordinate taken under a mapping that no longer
   * exists — the same ownership idea T-06 applies to an open temporal interaction and T-10 applies
   * to a retired travel — and "is this the same mapping" answers that exactly, while "how many
   * times has it changed" would require this function to remember, which is precisely what makes a
   * derived value stop being derived. Two compositions with the same frame always share it; two
   * with different frames practically never do. It is never a timer and never a clock, and only
   * the quantities a coordinate is actually taken through feed it: the chrome's vertical rhythm,
   * its bottom inset and its arrangement change what the reader sees and map nothing.
   */
  readonly geometry: number;
}

export interface RecompositionOptions {
  /**
   * The band already settled on screen, when there is one.
   *
   * The hysteresis needs to know which band is showing, and taking it as an ARGUMENT rather than
   * holding it keeps this function pure and total: the same pair of inputs always produces the same
   * plan, and there is no history for a caller to get wrong.
   */
  readonly band?: PresentationBand | null;
}

/**
 * The plan for one measured surface.
 *
 * Total and pure: every supported surface produces a plan, the same surface under the same settled
 * band always produces the same plan, and nothing outside this function is read.
 */
export function recompositionPlan(surface: PresentationSurface, options: RecompositionOptions = {}): RecompositionPlan {
  const width = usableWidth(surface);
  const height = usableHeight(surface);
  const band = bandFor(width, options.band ?? null);
  const shortHeight = height < SHORT_HEIGHT_POINTS;

  const paddingHorizontal = band === 'EXPANSIVE' ? EXPANSIVE_BAND_PADDING : 0;
  // The reading clamp. Continuous, so nothing changes shape when it starts to bind, and never wider
  // than the room actually available.
  const available = Math.max(0, width - 2 * paddingHorizontal);
  const measurePoints = Math.min(available, CHROME_MAX_MEASURE_POINTS + 2 * CHROME_OWN_HORIZONTAL_PADDING);

  // Two across only where the vertical room is the scarce resource AND each cell still clears the
  // readable floor. On a wide, tall window a single column costs nothing and keeps the acts reading
  // as one ordered list rather than as an invented grouping — so width alone never pairs them.
  const cell = (measurePoints - 2 * CHROME_OWN_HORIZONTAL_PADDING - PAIRED_COLUMN_GAP_POINTS) / 2;
  const arrangement: ChromeArrangement = shortHeight && band === 'EXPANSIVE' && cell >= PAIRED_MIN_CELL_POINTS ? 'PAIRED' : 'STACKED';

  const gapPoints = shortHeight ? SHORT_BAND_GAP_POINTS : BAND_GAP_POINTS;

  // The world is sized first here too: the support asks only for what is left once the world's own
  // floor is set aside, so no allocation below can push the world under `MAP_MIN_HEIGHT_POINTS`.
  const stackedBudget = Math.max(0, height - MAP_MIN_HEIGHT_POINTS - 2 * gapPoints);
  const acrossBudget = Math.max(0, height - MAP_MIN_HEIGHT_POINTS - gapPoints);
  // The SAME two-cell readable threshold the chrome's own arrangement already uses. A short window
  // wide enough to read two columns is wide enough to put the instrument beside the orientation.
  const acrossReadable = shortHeight && band === 'EXPANSIVE' && cell >= PAIRED_MIN_CELL_POINTS;

  const bothFloors = TIMELINE_ROW_POINTS + CHROME_FLOOR_POINTS;
  let support: SupportComposition;
  if (!shortHeight) {
    // Above the threshold there is slack to spend. The band takes the room the world's own share
    // leaves — which is what the composition already did when the scrollers happened to measure — and
    // the surplus above the two frozen minimums is shared in the ratio of those minimums, so neither
    // region is pinned to its floor while the other has room to spare.
    const mapShare = Math.max(MAP_MIN_HEIGHT_POINTS, Math.round(height / WORLD_SHARE_DENOMINATOR));
    const bandPoints = Math.max(bothFloors + gapPoints, Math.max(0, height - mapShare - gapPoints));
    const surplus = Math.max(0, bandPoints - gapPoints - bothFloors);
    const chromePoints = CHROME_FLOOR_POINTS + Math.round((surplus * CHROME_FLOOR_POINTS) / bothFloors);
    const timelinePoints = Math.max(TIMELINE_ROW_POINTS, bandPoints - gapPoints - chromePoints);
    support = { arrangement: 'STACKED', bandPoints: timelinePoints + chromePoints + gapPoints, timelinePoints, chromePoints, gapPoints, chromeWidthPoints: available };
  } else if (acrossReadable) {
    // Across, the band costs the LARGER of the two minimums instead of their sum, and each region is
    // given the band's full height. This is what keeps a short window from having to drop a truth.
    const bandPoints = Math.min(Math.max(TIMELINE_ROW_POINTS, CHROME_FLOOR_POINTS), acrossBudget);
    const half = Math.max(0, Math.round((available - PAIRED_COLUMN_GAP_POINTS) / 2));
    support = { arrangement: 'SIDE_BY_SIDE', bandPoints, timelinePoints: bandPoints, chromePoints: bandPoints, gapPoints, chromeWidthPoints: available - PAIRED_COLUMN_GAP_POINTS - half };
  } else {
    // Short AND too narrow to read two columns. Neither region may disappear, so the remaining room is
    // split in the ratio of the two frozen minimums and each keeps its own reachable overflow: the
    // pressure is paid in presentation, never by removing an act.
    const bothFloors = TIMELINE_ROW_POINTS + CHROME_FLOOR_POINTS;
    const chromePoints = stackedBudget <= 0 ? 0 : Math.min(CHROME_FLOOR_POINTS, Math.max(1, Math.round((stackedBudget * CHROME_FLOOR_POINTS) / bothFloors)));
    const timelinePoints = stackedBudget <= 0 ? 0 : Math.min(TIMELINE_ROW_POINTS, Math.max(1, stackedBudget - chromePoints));
    support = { arrangement: 'STACKED', bandPoints: timelinePoints + chromePoints + gapPoints, timelinePoints, chromePoints, gapPoints, chromeWidthPoints: available };
  }

  // Across, the instrument is composed in its own half of the band rather than the whole width, and
  // that is a coordinate quantity: T-05 maps a scrub through it, so it feeds the mapping identity.
  const timelineWidthPoints = support.arrangement === 'SIDE_BY_SIDE'
    ? Math.max(0, Math.round((available - PAIRED_COLUMN_GAP_POINTS) / 2))
    : available;

  return Object.freeze({
    surface,
    band,
    shortHeight,
    mapFrame: Object.freeze({
      basisPoints: Math.max(MAP_MIN_HEIGHT_POINTS, Math.round(height / WORLD_SHARE_DENOMINATOR)),
      minHeightPoints: MAP_MIN_HEIGHT_POINTS,
      insetTop: surface.insetTop,
      insetRight: surface.insetRight,
      insetLeft: surface.insetLeft,
    }),
    chrome: Object.freeze({
      arrangement,
      measurePoints,
      paddingHorizontal,
      gapPoints,
      bottomInset: surface.insetBottom,
    }),
    support: Object.freeze(support),
    timelineWidthPoints,
    geometry: mappingIdentity([
      surface.width,
      surface.height,
      surface.insetTop,
      surface.insetLeft,
      surface.insetRight,
      timelineWidthPoints,
    ]),
  });
}

/**
 * A deterministic 32-bit identity of the quantities a coordinate is mapped through.
 *
 * FNV-1a over the quantized points, which are integers by construction, so the same frame always
 * produces the same number on every device and in every process. It is an identity and not a hash
 * of anything secret; a collision would mean two frames are treated as one, which is why the frame
 * is described by its six numbers rather than by a rounded summary of them.
 */
function mappingIdentity(quantities: readonly number[]): number {
  let hash = 0x811c9dc5;
  for (const quantity of quantities) {
    // Two bytes per quantity is enough for every supported dimension, and the shift keeps the two
    // halves distinguishable so `(a, b)` and `(b, a)` do not collide.
    for (const byte of [quantity & 0xff, (quantity >>> 8) & 0xff, (quantity >>> 16) & 0xff]) {
      hash ^= byte;
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return hash >>> 0;
}

/** Component-wise. Two plans that compose identically ARE the same plan, whatever their identity. */
export function planEquals(a: RecompositionPlan, b: RecompositionPlan): boolean {
  return (
    a.band === b.band &&
    a.shortHeight === b.shortHeight &&
    a.timelineWidthPoints === b.timelineWidthPoints &&
    a.mapFrame.basisPoints === b.mapFrame.basisPoints &&
    a.mapFrame.minHeightPoints === b.mapFrame.minHeightPoints &&
    a.mapFrame.insetTop === b.mapFrame.insetTop &&
    a.mapFrame.insetRight === b.mapFrame.insetRight &&
    a.mapFrame.insetLeft === b.mapFrame.insetLeft &&
    a.chrome.arrangement === b.chrome.arrangement &&
    a.chrome.measurePoints === b.chrome.measurePoints &&
    a.chrome.paddingHorizontal === b.chrome.paddingHorizontal &&
    a.chrome.gapPoints === b.chrome.gapPoints &&
    a.chrome.bottomInset === b.chrome.bottomInset &&
    a.support.arrangement === b.support.arrangement &&
    a.support.bandPoints === b.support.bandPoints &&
    a.support.timelinePoints === b.support.timelinePoints &&
    a.support.chromePoints === b.support.chromePoints &&
    a.support.gapPoints === b.support.gapPoints &&
    a.surface.width === b.surface.width &&
    a.surface.height === b.surface.height &&
    a.surface.fontScale === b.surface.fontScale &&
    a.geometry === b.geometry
  );
}
