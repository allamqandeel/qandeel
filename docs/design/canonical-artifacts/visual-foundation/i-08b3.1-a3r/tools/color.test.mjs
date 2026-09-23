/**
 * I-08B3.1-A1 - known-answer tests for the colour module.
 *
 *   node tools/color.test.mjs
 *
 * The task's stop conditions include "colour conversion cannot be validated" and "the host
 * silently clips/gamut-maps values without detection". These tests are how those two
 * conditions are discharged, so they check against values that exist independently of this
 * implementation - published OKLCH coordinates for the sRGB primaries, ratios that follow
 * arithmetically from the WCAG formula, and exhaustive round-trips - rather than against
 * numbers this file produced itself.
 */
import {
  linSRGB, gamSRGB, srgbToOklch, oklchToSrgbRaw, resolve, inSrgbGamut,
  relativeLuminance, contrastRatio, contrastHex, hexToRgb8, rgb8ToHex, to8bit,
} from './color.mjs';

let pass = 0, fail = 0;
const near = (a, b, tol, what) => {
  const ok = Math.abs(a - b) <= tol;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${what}: got ${a}, want ${b} (+/-${tol})`);
};
const ok = (cond, what) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${what}`);
};

console.log('\n-- sRGB transfer function is its own inverse ------------------------------');
for (const v of [0, 0.002, 0.04, 0.05, 0.2, 0.5, 0.9, 1]) {
  near(gamSRGB(linSRGB([v]))[0], v, 1e-12, `gam(lin(${v}))`);
}

console.log('\n-- published OKLCH coordinates of the sRGB primaries ----------------------');
// Reference values as serialised by CSS Color 4 implementations for the sRGB corners.
const prim = [
  ['#ff0000', 0.6280, 0.2577, 29.23],
  ['#00ff00', 0.8664, 0.2948, 142.50],
  ['#0000ff', 0.4520, 0.3132, 264.05],
];
for (const [hex, L, C, H] of prim) {
  const [gl, gc, gh] = srgbToOklch(hexToRgb8(hex).map((c) => c / 255));
  near(gl, L, 5e-4, `${hex} L`);
  near(gc, C, 5e-4, `${hex} C`);
  near(gh, H, 0.05, `${hex} H`);
}
near(srgbToOklch([1, 1, 1])[0], 1, 1e-6, '#ffffff L is exactly 1');
near(srgbToOklch([0, 0, 0])[0], 0, 1e-9, '#000000 L is exactly 0');
ok(Number.isNaN(srgbToOklch([1, 1, 1])[2]), '#ffffff hue is achromatic (NaN)');

console.log('\n-- WCAG relative luminance, derived independently -------------------------');
// L for #808080 follows directly from the WCAG formula: ((128/255 + 0.055)/1.055)^2.4,
// identical for all three channels, so the 0.2126/0.7152/0.0722 weights sum to 1 and drop out.
const grey = Math.pow((128 / 255 + 0.055) / 1.055, 2.4);
near(relativeLuminance([128, 128, 128]), grey, 1e-12, '#808080 relative luminance');
near(relativeLuminance([255, 255, 255]), 1, 1e-12, 'white luminance is 1');
near(relativeLuminance([0, 0, 0]), 0, 1e-12, 'black luminance is 0');

console.log('\n-- WCAG contrast ratio ---------------------------------------------------');
// (1 + 0.05) / (0 + 0.05) = 21 exactly, from the normative formula.
near(contrastHex('#ffffff', '#000000'), 21, 1e-9, 'white vs black is exactly 21:1');
near(contrastHex('#000000', '#ffffff'), 21, 1e-9, 'ratio is symmetric');
near(contrastHex('#3a3a3a', '#3a3a3a'), 1, 1e-12, 'a colour against itself is 1:1');
// #767676 is the canonical darkest grey that still clears 4.5:1 on white; #777777 does not.
const a = contrastHex('#767676', '#ffffff'), b = contrastHex('#777777', '#ffffff');
ok(a >= 4.5 && a < 4.6, `#767676 on white clears 4.5:1 (${a.toFixed(3)})`);
ok(b < 4.5, `#777777 on white fails 4.5:1 (${b.toFixed(3)})`);
ok(contrastRatio([255, 255, 255], [0, 0, 0]) === contrastRatio([0, 0, 0], [255, 255, 255]),
  'contrastRatio argument order is irrelevant');

console.log('\n-- exhaustive 8-bit round-trip -------------------------------------------');
// Every grey, plus a deterministic sweep of chromatic values. hex -> OKLCH -> hex must be
// the identity; if it is not, every measured value in the report is suspect.
let rt = 0, rtBad = [];
const check = (r, g, b) => {
  const hex = rgb8ToHex([r, g, b]);
  const back = rgb8ToHex(to8bit(oklchToSrgbRaw(srgbToOklch([r / 255, g / 255, b / 255]))));
  rt++;
  if (back !== hex) rtBad.push(`${hex}->${back}`);
};
for (let v = 0; v < 256; v++) check(v, v, v);
for (let r = 0; r < 256; r += 17) for (let g = 0; g < 256; g += 17) for (let b = 0; b < 256; b += 17) check(r, g, b);
ok(rtBad.length === 0, `${rt} colours round-trip hex->OKLCH->hex exactly${rtBad.length ? ' (' + rtBad.slice(0, 5).join(', ') + ')' : ''}`);

console.log('\n-- gamut detection -------------------------------------------------------');
ok(inSrgbGamut([0.5, 0.0, 0]), 'mid grey is in sRGB gamut');
ok(inSrgbGamut([0.1500, 0.0060, 250]), 'a near-black low-chroma World candidate is in gamut');
ok(!inSrgbGamut([0.9000, 0.3000, 140]), 'a vivid light green is OUT of sRGB gamut');
ok(!inSrgbGamut([0.6280, 0.3500, 29.23]), 'chroma beyond the sRGB red corner is OUT of gamut');
const bad = resolve([0.9000, 0.3000, 140], 'out-of-gamut probe');
ok(bad.clipped === true, 'resolve() flags a clipped colour instead of returning it silently');
ok(Math.abs(bad.drift.C) > 0.01, `resolve() reports the chroma actually lost to clipping (${bad.drift.C.toFixed(4)})`);
const good = resolve([0.1500, 0.0060, 250], 'in-gamut probe');
ok(good.clipped === false, 'resolve() does not flag an in-gamut colour');

console.log('\n-- quantisation drift is reported, not hidden ----------------------------');
// At World-level chroma an 8-bit step is a large fraction of the signal. The point of this
// test is not that drift is small; it is that `actual` is recovered from the hex and so can
// never silently disagree with what is painted.
const w = resolve([0.1500, 0.0060, 250], 'World probe');
const reRes = srgbToOklch(hexToRgb8(w.hex).map((c) => c / 255));
near(w.actual.L, reRes[0], 1e-12, 'resolve().actual.L is recovered from the hex');
near(w.actual.C, reRes[1], 1e-12, 'resolve().actual.C is recovered from the hex');
ok(w.hex === rgb8ToHex(w.rgb8), 'resolve().hex matches its own 8-bit triple');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
