/**
 * I-08B3.1-C2 — RASTER MEASUREMENT PRIMITIVES.
 *
 * A separate module because BOTH the boards and the measurement pass need these, and because the
 * alternative — computing a number in one file to print and again in another to record — is how two
 * figures that are supposed to be the same quantity end up disagreeing in a review package.
 */
import { gamSRGB, linSRGB, srgbToOklch, hexToRgb8, relativeLuminance } from './color.mjs';

/** WCAG relative luminance of one 8-bit pixel. Defined over 8-bit sRGB, which is what is painted. */
export const Y = (r, g, b) => relativeLuminance([r, g, b]);

/**
 * TRUE GREYSCALE — computed here rather than by CSS.
 *
 * `filter: grayscale(1)` is an `feColorMatrix` saturate(0), which mixes the GAMMA-ENCODED channels.
 * That is not relative luminance, and a proof of "the hierarchy survives colour removal" built on it
 * would be a proof about a different transform than the one WCAG is defined over.
 *
 * For a grey, relative luminance IS the linear channel value — the three coefficients sum to 1 — so
 * the inverse is exact: take each pixel's relative luminance as the linear value and gamma-encode it.
 */
export function toGreyscale(img) {
  const out = Buffer.alloc(img.rgba.length);
  for (let i = 0; i < img.width * img.height; i++) {
    const y = Y(img.rgba[i * 4], img.rgba[i * 4 + 1], img.rgba[i * 4 + 2]);
    const v = Math.round(Math.min(1, Math.max(0, gamSRGB([y, y, y])[0])) * 255);
    out[i * 4] = v; out[i * 4 + 1] = v; out[i * 4 + 2] = v; out[i * 4 + 3] = 255;
  }
  return { width: img.width, height: img.height, rgba: out };
}

/**
 * LUMINANCE EXCESS over a stated ground, summed across a region.
 *
 * THIS IS NOT AN ATTENTION MEASUREMENT AND IS NEVER REPORTED AS ONE. It is the total light a region
 * puts on the screen above the ground it sits on: a physical quantity, computed in LINEAR light
 * because light adds linearly and gamma-encoded values do not.
 *
 * It is offered as a SALIENCE PROXY for C2.10 for one reason — where the eye goes first on a
 * near-black screen is driven overwhelmingly by where the light is — and its limits are stated
 * beside it wherever it appears: it is blind to shape, to meaning, to reading order and to the
 * direction of the script, and a small bright thing and a large dim thing can score alike.
 */
export function luminanceExcess(img, rect, groundHex) {
  const g = Y(...hexToRgb8(groundHex));
  let sum = 0, n = 0, above = 0;
  const x0 = Math.max(0, rect.x), y0 = Math.max(0, rect.y);
  const x1 = Math.min(img.width, rect.x + rect.w), y1 = Math.min(img.height, rect.y + rect.h);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4;
      const d = Y(img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]) - g;
      n++;
      if (d > 0) { sum += d; above++; }
    }
  }
  return { sum, pixels: n, litPixels: above, ground: groundHex, groundY: g };
}

/**
 * WARM MASS — how much of a region's ink is the material rather than the neutral ramp.
 *
 * A pixel counts as warm when its Oklab b (the yellow axis) clears a threshold. The frozen reading
 * neutrals are not achromatic — they carry a small warmth of their own, which A1 measured and A3
 * froze — so a threshold of zero would count the entire Product as Brass. The threshold is set
 * ABOVE the warmest frozen neutral and is reported with the result, so a reader can see what was
 * counted rather than trust that something sensible was.
 */
export function warmThreshold(neutralHexes) {
  let worst = 0;
  for (const hex of neutralHexes) {
    const [L, C, H] = srgbToOklch(hexToRgb8(hex).map((c) => c / 255));
    const b = Number.isNaN(H) ? 0 : C * Math.sin((H * Math.PI) / 180);
    if (b > worst) worst = b;
  }
  return { threshold: worst * 1.6, warmestNeutral: worst, margin: 1.6 };
}

export function warmMass(img, rect, { threshold, groundHex }) {
  const g = Y(...hexToRgb8(groundHex));
  let warmSum = 0, warmPx = 0, inkSum = 0, inkPx = 0;
  const x0 = Math.max(0, rect.x), y0 = Math.max(0, rect.y);
  const x1 = Math.min(img.width, rect.x + rect.w), y1 = Math.min(img.height, rect.y + rect.h);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4;
      const [r, gg, bb] = [img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]];
      const d = Y(r, gg, bb) - g;
      if (d <= 0.002) continue;
      inkSum += d; inkPx++;
      const [L, C, H] = srgbToOklch([r, gg, bb].map((c) => c / 255));
      const bStar = Number.isNaN(H) ? 0 : C * Math.sin((H * Math.PI) / 180);
      if (bStar >= threshold) { warmSum += d; warmPx++; }
    }
  }
  return { warmSum, warmPx, inkSum, inkPx, threshold,
    warmShareOfInk: inkSum > 0 ? warmSum / inkSum : 0 };
}

/** Byte identity of a region between two rasters. Used by the ANALYTICAL NULL TEST. */
export function regionsIdentical(a, b, rect) {
  if (a.width !== b.width) return { identical: false, why: 'different raster widths' };
  const x0 = Math.max(0, rect.x), y0 = Math.max(0, rect.y);
  const x1 = Math.min(a.width, b.width, rect.x + rect.w);
  const y1 = Math.min(a.height, b.height, rect.y + rect.h);
  let diff = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * a.width + x) * 4;
      n++;
      if (a.rgba[i] !== b.rgba[i] || a.rgba[i + 1] !== b.rgba[i + 1] || a.rgba[i + 2] !== b.rgba[i + 2]) diff++;
    }
  }
  return { identical: diff === 0, diff, pixels: n, share: n ? diff / n : 0 };
}

/** Share of pixels differing between two equally sized rasters. Used by the Brass-removal controls. */
export function frameDifference(a, b) {
  const n = Math.min(a.width * a.height, b.width * b.height);
  let diff = 0, sumAbs = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(a.rgba[i * 4] - b.rgba[i * 4]) +
      Math.abs(a.rgba[i * 4 + 1] - b.rgba[i * 4 + 1]) +
      Math.abs(a.rgba[i * 4 + 2] - b.rgba[i * 4 + 2]);
    if (d > 0) { diff++; sumAbs += d; }
  }
  return { pixels: n, changed: diff, share: n ? diff / n : 0, meanAbsPerChanged: diff ? sumAbs / diff / 3 : 0 };
}

export { linSRGB };
