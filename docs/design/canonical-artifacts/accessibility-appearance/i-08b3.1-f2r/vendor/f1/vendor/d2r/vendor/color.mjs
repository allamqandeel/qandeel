/**
 * I-08B3.1-A1 - colour conversion and measurement.
 *
 * Every conversion below is transcribed from the CSS Color Module Level 4 sample code
 * (W3C, "Sample code for color conversions"), and every contrast figure from the WCAG 2.2
 * normative definitions of `relative luminance` and `contrast ratio`. Nothing here is
 * approximated from memory, and nothing is taken from a third-party colour library, so the
 * numbers in the report can be traced to a specification rather than to a dependency.
 *
 * Two properties of this task make the details matter more than usual:
 *
 *   1. The candidates are near-black with chroma around 0.005. At that magnitude the
 *      difference between a correct and an almost-correct transform is larger than the
 *      difference between two theses, so `almost right` would silently invent the result.
 *
 *   2. An authored OKLCH triple is NOT what a screen displays. It is converted, possibly
 *      gamut-clipped, then quantised to 8 bits. This module always reports the authored
 *      value AND the value recovered from the quantised hex, because only the second one
 *      is what a reader actually sees and what WCAG is defined over.
 */

/* ------------------------------------------------------------------ sRGB transfer ---- */

/** CSS Color 4 `lin_sRGB`: gamma-encoded sRGB -> linear-light, extended to negatives. */
export function linSRGB(rgb) {
  return rgb.map((val) => {
    const sign = val < 0 ? -1 : 1;
    const abs = Math.abs(val);
    if (abs <= 0.04045) return val / 12.92;
    return sign * Math.pow((abs + 0.055) / 1.055, 2.4);
  });
}

/** CSS Color 4 `gam_sRGB`: linear-light -> gamma-encoded sRGB, extended to negatives. */
export function gamSRGB(rgb) {
  return rgb.map((val) => {
    const sign = val < 0 ? -1 : 1;
    const abs = Math.abs(val);
    if (abs > 0.0031308) return sign * (1.055 * Math.pow(abs, 1 / 2.4) - 0.055);
    return 12.92 * val;
  });
}

const mul = (M, v) => M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);

/* ------------------------------------------------------- sRGB <-> XYZ (D65) ---------- */
// CSS Color 4 gives these as exact rational fractions; kept in that form deliberately so
// they can be diffed against the specification character by character.

const LIN_SRGB_TO_XYZ = [
  [506752 / 1228815, 87881 / 245763, 12673 / 70218],
  [87098 / 409605, 175762 / 245763, 12673 / 175545],
  [7918 / 409605, 87881 / 737289, 1001167 / 1053270],
];

const XYZ_TO_LIN_SRGB = [
  [12831 / 3959, -329 / 214, -1974 / 3959],
  [-851781 / 878810, 1648619 / 878810, 36519 / 878810],
  [705 / 12673, -2585 / 12673, 705 / 667],
];

/* ------------------------------------------------------------ XYZ <-> OKLab ---------- */
// "XYZ <-> LMS matrices recalculated for consistent reference white ... recalculated for
// 64bit precision" - CSS Color 4. The older 32-bit matrices are still widely copied around
// and do not round-trip cleanly; these do.

const XYZ_TO_LMS = [
  [0.8190224379967030, 0.3619062600528904, -0.1288737815209879],
  [0.0329836539323885, 0.9292868615863434, 0.0361446663506424],
  [0.0481771893596242, 0.2642395317527308, 0.6335478284694309],
];

const LMS_TO_OKLAB = [
  [0.2104542683093140, 0.7936177747023054, -0.0040720430116193],
  [1.9779985324311684, -2.4285922420485799, 0.4505937096174110],
  [0.0259040424655478, 0.7827717124575296, -0.8086757549230774],
];

const LMS_TO_XYZ = [
  [1.2268798758459243, -0.5578149944602171, 0.2813910456659647],
  [-0.0405757452148008, 1.1122868032803170, -0.0717110580655164],
  [-0.0763729366746601, -0.4214933324022432, 1.5869240198367816],
];

const OKLAB_TO_LMS = [
  [1.0000000000000000, 0.3963377773761749, 0.2158037573099136],
  [1.0000000000000000, -0.1055613458156586, -0.0638541728258133],
  [1.0000000000000000, -0.0894841775298119, -1.2914855480194092],
];

export function xyzToOklab(xyz) {
  // Math.cbrt is sign-matched. A general pow() would produce NaN for the negative LMS
  // values that occur near the gamut edge - the spec calls this out explicitly.
  return mul(LMS_TO_OKLAB, mul(XYZ_TO_LMS, xyz).map((c) => Math.cbrt(c)));
}

export function oklabToXyz(lab) {
  return mul(LMS_TO_XYZ, mul(OKLAB_TO_LMS, lab).map((c) => c ** 3));
}

export function oklabToOklch([L, a, b]) {
  const epsilon = 0.000004;
  let hue = (Math.atan2(b, a) * 180) / Math.PI;
  const chroma = Math.sqrt(a ** 2 + b ** 2);
  if (hue < 0) hue += 360;
  return [L, chroma, chroma <= epsilon ? NaN : hue];
}

export function oklchToOklab([L, C, H]) {
  // A hue of NaN means "achromatic" in CSS Color 4. Treated as 0 here so the a/b terms
  // vanish rather than poisoning the whole triple.
  const h = Number.isNaN(H) ? 0 : H;
  return [L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)];
}

/* ----------------------------------------------------------------- composites -------- */

/** OKLCH -> gamma-encoded sRGB in 0..1, unclamped so gamut excursions stay visible. */
export function oklchToSrgbRaw(oklch) {
  return gamSRGB(mul(XYZ_TO_LIN_SRGB, oklabToXyz(oklchToOklab(oklch))));
}

export function srgbToOklch(rgb) {
  return oklabToOklch(xyzToOklab(mul(LIN_SRGB_TO_XYZ, linSRGB(rgb))));
}

/**
 * Is this OKLCH triple representable in sRGB?
 *
 * The tolerance absorbs floating-point dust only. It is deliberately far tighter than one
 * 8-bit step (1/255 = 0.0039), so a colour that is genuinely outside the gamut - and would
 * therefore be silently altered by clamping - can never be reported as inside it.
 */
export function inSrgbGamut(oklch, tol = 1e-6) {
  return oklchToSrgbRaw(oklch).every((c) => c >= -tol && c <= 1 + tol);
}

export const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** 0..1 float channels -> 8-bit integers, by the same rounding the browser will apply. */
export const to8bit = (rgb) => rgb.map((c) => Math.round(clamp01(c) * 255));

export const rgb8ToHex = (rgb8) =>
  '#' + rgb8.map((c) => c.toString(16).padStart(2, '0')).join('');

export function hexToRgb8(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/* -------------------------------------------------------------------- WCAG ----------- */

/**
 * WCAG 2.2 `relative luminance`, defined over 8-BIT sRGB values.
 *
 * Taking 8-bit input is the whole point rather than an implementation shortcut: WCAG
 * defines R8bit/255 as the starting point, and the browser only ever paints a quantised
 * colour. Feeding this the pre-quantisation float would produce a ratio for a colour that
 * is never displayed.
 */
export function relativeLuminance(rgb8) {
  const [R, G, B] = rgb8.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** WCAG 2.2 `contrast ratio` = (L1 + 0.05) / (L2 + 0.05), lighter over darker. */
export function contrastRatio(rgb8a, rgb8b) {
  const a = relativeLuminance(rgb8a);
  const b = relativeLuminance(rgb8b);
  const [L1, L2] = a >= b ? [a, b] : [b, a];
  return (L1 + 0.05) / (L2 + 0.05);
}

export const contrastHex = (h1, h2) => contrastRatio(hexToRgb8(h1), hexToRgb8(h2));

/* ------------------------------------------------------------------ resolve ---------- */

/**
 * Take an authored OKLCH triple all the way to what a display shows, and report every
 * step where the value could have been altered without anyone noticing.
 *
 * `driftL/C/H` is the gap between what was authored and what the quantised hex actually
 * is. It is reported for every colour in the package because at chroma ~0.005 an 8-bit
 * step is a large fraction of the whole signal - a World authored at C=0.006 can land on
 * a hex whose true chroma is 0.004 or 0.008, and that difference is the thesis.
 */
export function resolve(oklch, label = '') {
  const raw = oklchToSrgbRaw(oklch);
  const inGamut = raw.every((c) => c >= -1e-6 && c <= 1 + 1e-6);
  const clipped = raw.some((c) => c < -1e-6 || c > 1 + 1e-6);
  const rgb8 = to8bit(raw);
  const hex = rgb8ToHex(rgb8);
  const actual = srgbToOklch(rgb8.map((c) => c / 255));
  const dh = (() => {
    if (Number.isNaN(actual[2]) || Number.isNaN(oklch[2])) return NaN;
    let d = Math.abs(actual[2] - oklch[2]) % 360;
    return d > 180 ? 360 - d : d;
  })();
  return {
    label,
    authored: { L: oklch[0], C: oklch[1], H: oklch[2] },
    rgbFloat: raw,
    rgb8,
    hex,
    inGamut,
    clipped,
    actual: { L: actual[0], C: actual[1], H: actual[2] },
    drift: { L: actual[0] - oklch[0], C: actual[1] - oklch[1], H: dh },
    luminance: relativeLuminance(rgb8),
  };
}

export const fmt = (n, d = 4) => (Number.isNaN(n) ? 'none' : n.toFixed(d));

/** `oklch(L C H)` in the CSS Color 4 serialisation, for quoting in the report. */
export const oklchStr = ({ L, C, H }) =>
  `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${Number.isNaN(H) ? 'none' : H.toFixed(1)})`;
