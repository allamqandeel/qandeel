/**
 * I-08B3.1-F2 — THE MEASUREMENT VOCABULARY, INHERITED RATHER THAN RE-AUTHORED.
 *
 * Every conversion comes from the vendored I-08B3.1-A1 module, which transcribes CSS Color 4
 * and the WCAG 2.2 normative definitions. F2 adds NOTHING to the conversions and only names
 * four operations it uses so often that writing them out each time would hide them:
 *
 *   dEok        perceptual distance in OKLab. The distance D2R's Light/Brass separation floor
 *               is defined over, so F2 re-runs D2R's own requirement with D2R's own metric.
 *   over        the alpha composite a browser performs. Measuring an authored colour rather
 *               than its composite is the mistake that makes a translucent system look fine
 *               on paper and fail on screen.
 *   ratioSolve  given a ground and a target WCAG contrast ratio, the luminance an ink must
 *               have. THIS IS THE LOAD-BEARING FUNCTION OF PART A: QANDEEL's reading hierarchy
 *               is a set of RATIOS, and an appearance that preserves the ratios preserves the
 *               hierarchy exactly while changing every value.
 *   luminanceAt the inverse: walk the OKLCh lightness axis at a fixed hue and chroma until the
 *               quantised hex reaches a target luminance. It searches over QUANTISED hexes
 *               because the 8-bit value is what is painted and what WCAG is defined over.
 */
import {
  srgbToOklch, oklchToSrgbRaw, oklchToOklab, hexToRgb8, rgb8ToHex, to8bit,
  relativeLuminance, contrastRatio, contrastHex, inSrgbGamut, linSRGB,
} from '../vendor/f1/vendor/lib/color.mjs';

export {
  srgbToOklch, oklchToSrgbRaw, oklchToOklab, hexToRgb8, rgb8ToHex, to8bit,
  relativeLuminance, contrastRatio, contrastHex, inSrgbGamut,
};

/** OKLCh of a hex, as [L, C, H]. H is NaN when the colour is achromatic — CSS Color 4's own
 *  convention, kept rather than smoothed to 0, because "this role has no hue" is a fact about
 *  the role and the cross-appearance map has to be able to print it. */
export const lch = (hex) => srgbToOklch(hexToRgb8(hex).map((c) => c / 255));

/** OKLab of a hex. NaN hue is treated as 0 so the a/b terms vanish instead of poisoning it. */
export const oklabOf = (hex) => {
  const [L, C, H] = lch(hex);
  return oklchToOklab([L, C, Number.isNaN(H) ? 0 : H]);
};

/** Perceptual distance in OKLab — the metric I-08B3.1-D2R's separation floor is defined over. */
export const dEok = (a, b) => {
  const A = oklabOf(a), B = oklabOf(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
};

/** The composite a browser paints for `fg` at `alpha` over `bg`, quantised as the browser
 *  quantises it. Measuring anything else measures a colour nobody sees. */
export const over = (fg, alpha, bg) => {
  const F = hexToRgb8(fg), B = hexToRgb8(bg);
  return rgb8ToHex(F.map((c, i) => Math.round(c * alpha + B[i] * (1 - alpha))));
};

export const hex = (L, C, H) => rgb8ToHex(to8bit(oklchToSrgbRaw([L, C, H])));
export const Y = (h) => relativeLuminance(hexToRgb8(h));

/** The luminance an ink needs to sit at `ratio` against `ground`, on whichever side of it the
 *  ink falls. Returns null when the ratio is unreachable in sRGB from that ground. */
export function ratioSolve(groundHex, ratio, side) {
  const Yg = Y(groundHex);
  if (side === 'darker') {
    const y = (Yg + 0.05) / ratio - 0.05;
    return y < 0 ? null : y;
  }
  const y = (Yg + 0.05) * ratio - 0.05;
  return y > 1 ? null : y;
}

/**
 * The darkest / lightest QUANTISED hex at (C, H) whose luminance still satisfies `targetY`.
 *
 * It walks the lightness axis rather than solving analytically because the answer has to be a
 * hex: an analytic L lands between two 8-bit values, and the one the browser picks may miss the
 * ratio the derivation claimed. Everything F2 reports is measured on the hex it will ship.
 */
export function luminanceAt(targetY, C, H, { from = 0.05, to = 1.0, step = 0.0002, approach = 'below' } = {}) {
  let best = null;
  for (let L = from; L <= to; L += step) {
    if (!inSrgbGamut([L, C, H])) continue;
    const h = hex(L, C, H);
    const y = Y(h);
    if (approach === 'below' ? y <= targetY : y >= targetY) {
      const cand = { L: +L.toFixed(4), hex: h, Y: y };
      if (approach === 'below') best = cand; else { return cand; }
    } else if (approach === 'below' && best) break;
  }
  return best;
}

/** The greatest chroma representable in sRGB at (L, H), to 1e-4. Used to report how much of the
 *  available colour a role is actually spending — a chroma that is 90% of the ceiling is a
 *  different design decision from the same number at 30%, and the number alone hides which. */
export function chromaCeilingAt(L, H) {
  let lo = 0, hi = 0.45;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (inSrgbGamut([L, mid, H])) lo = mid; else hi = mid;
  }
  return +lo.toFixed(4);
}

/** WCAG 2.2 relative luminance of a hex after a full-page grayscale conversion — the diagnostic
 *  I-08B3.1-F1 renders as an feColorMatrix. Used to answer "does this survive without colour"
 *  with the same arithmetic the browser applies rather than with an assertion. */
export const grayOf = (h) => {
  const lin = linSRGB(hexToRgb8(h).map((c) => c / 255));
  const y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  const g = y <= 0.0031308 ? 12.92 * y : 1.055 * Math.pow(y, 1 / 2.4) - 0.055;
  const v = Math.round(Math.min(1, Math.max(0, g)) * 255);
  return rgb8ToHex([v, v, v]);
};

/** A mechanical per-channel inversion — the thing §4 of the brief forbids. It exists here ONLY
 *  so the package can MEASURE the distance between what it derived and what an inversion would
 *  have produced. "This is not an inversion" is a claim about numbers; without this function it
 *  would be a claim about intentions. */
export const invert = (h) => rgb8ToHex(hexToRgb8(h).map((c) => 255 - c));

export const f = (n, d = 4) => (n === null || n === undefined || Number.isNaN(n) ? 'none' : Number(n).toFixed(d));
export const lchStr = (h) => {
  const [L, C, H] = lch(h);
  return `oklch(${f(L, 4)} ${f(C, 4)} ${Number.isNaN(H) ? 'none' : f(H, 1)})`;
};
