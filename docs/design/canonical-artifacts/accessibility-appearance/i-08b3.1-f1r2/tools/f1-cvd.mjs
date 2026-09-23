/**
 * Dichromacy simulation — Viénot, Brettel & Mollon (1999) for protanopia and
 * deuteranopia, Brettel/Viénot for tritanopia, transcribed here rather than taken
 * from a dependency.
 *
 * THIS IS A DESIGN INSTRUMENT, NOT A CLAIM ABOUT WHAT A PERSON SEES. It is used to
 * put a FLOOR under a chroma value, so that the floor comes from an accessibility
 * model instead of from taste. Every accessibility CLAIM in E1 rests on the
 * non-colour channel, never on this transform.
 *
 * Because the matrices are transcribed, `selfCheck()` below feeds the transform
 * inputs whose behaviour is known independently of the constants: the grey axis must
 * be a fixed point, red and green must collapse together under protan/deutan, and
 * blue and yellow must collapse together under tritan. A mistyped constant fails at
 * least one of those.
 *
 * Applied to LINEAR-LIGHT sRGB, which is the physically meaningful reading of an LMS
 * transform. (Many web implementations apply it to gamma-encoded values; that is a
 * different, and wrong, transform, and it would move the floor.)
 */
import { linSRGB, gamSRGB } from '../vendor/lib/color.mjs';

const RGB_TO_LMS = [
  [17.8824, 43.5161, 4.11935],
  [3.45565, 27.1554, 3.86714],
  [0.0299566, 0.184309, 1.46709],
];
const LMS_TO_RGB = [
  [0.080944447900, -0.130504409000, 0.116721066000],
  [-0.010248533500, 0.054019326600, -0.113614708000],
  [-0.000365296938, -0.004121614690, 0.693511405000],
];

const mul = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);

const PLANE = {
  protan: (lms) => [2.02344 * lms[1] - 2.52581 * lms[2], lms[1], lms[2]],
  deutan: (lms) => [lms[0], 0.494207 * lms[0] + 1.24827 * lms[2], lms[2]],
  tritan: (lms) => [lms[0], lms[1], -0.395913 * lms[0] + 0.801109 * lms[1]],
};

/**
 * THE KINDS THE DERIVATION IS ALLOWED TO USE.
 *
 * Viénot, Brettel & Mollon (1999) validate the SINGLE-PLANE simplification for
 * protanopia and deuteranopia only. Brettel, Viénot & Mollon (1997) needs TWO
 * half-planes for tritanopia, and the single-plane form collapses to something
 * that leaves pure blue unmoved — `selfCheck()` demonstrates that below rather
 * than hiding it. So `tritan` is implemented, exercised, and DELIBERATELY NOT
 * USED to set any floor: a number from a model outside its validated range would
 * be a measurement that cannot support the claim standing on it.
 */
export const KINDS = ['protan', 'deutan'];
export const ALL_KINDS = ['protan', 'deutan', 'tritan'];

/** rgb in 0..1 gamma-encoded sRGB -> simulated, same encoding, clamped to gamut. */
export function simulate(rgb, kind) {
  if (kind === 'none') return rgb.slice();
  const out = gamSRGB(mul(LMS_TO_RGB, PLANE[kind](mul(RGB_TO_LMS, linSRGB(rgb)))));
  return out.map((c) => Math.min(1, Math.max(0, c)));
}

export const simulate8 = (rgb8, kind) =>
  simulate(rgb8.map((c) => c / 255), kind).map((c) => Math.round(c * 255));

/** Property tests that do not depend on the constants being remembered correctly. */
export function selfCheck() {
  const results = [];
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

  for (const kind of ALL_KINDS) {
    for (const g of [0.0, 0.25, 0.5, 0.75, 1.0]) {
      const got = simulate([g, g, g], kind);
      results.push({
        check: `${kind}: grey ${g} is a fixed point`,
        pass: d(got, [g, g, g]) < 0.01,
        detail: got.map((c) => c.toFixed(4)).join(' '),
      });
    }
  }
  const hue = (rgb) => {
    const [r, g, b] = rgb; const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 1e-6) return NaN;
    let h;
    if (mx === r) h = 60 * (((g - b) / (mx - mn)) % 6);
    else if (mx === g) h = 60 * ((b - r) / (mx - mn) + 2);
    else h = 60 * ((r - g) / (mx - mn) + 4);
    return (h + 360) % 360;
  };
  const dh = (a, b) => { const x = Math.abs(a - b) % 360; return x > 180 ? 360 - x : x; };

  for (const kind of ['protan', 'deutan']) {
    const r = simulate([1, 0, 0], kind), g = simulate([0, 1, 0], kind);
    results.push({
      check: `${kind}: pure red and pure green collapse to one hue`,
      pass: dh(hue(r), hue(g)) < 12,
      detail: `red h=${hue(r).toFixed(1)} green h=${hue(g).toFixed(1)} delta=${dh(hue(r), hue(g)).toFixed(1)}`,
    });
    const b = simulate([0, 0, 1], kind);
    results.push({
      check: `${kind}: blue is NOT collapsed into the red/green pair`,
      pass: dh(hue(b), hue(r)) > 60,
      detail: `blue h=${hue(b).toFixed(1)}`,
    });
  }
  {
    const r = simulate([1, 0, 0], 'tritan'), g = simulate([0, 1, 0], 'tritan');
    results.push({
      check: 'tritan: red and green stay apart (tritanopes keep red-green)',
      pass: dh(hue(r), hue(g)) > 60,
      detail: `delta=${dh(hue(r), hue(g)).toFixed(1)}`,
    });
    // THE MODEL'S OWN BOUNDARY, ASSERTED RATHER THAN DISCOVERED LATER BY A REVIEWER.
    // Brettel 1997 needs two half-planes for tritanopia; the single-plane form used
    // here leaves pure blue on the plane, i.e. unchanged. This check exists to make
    // that limitation fail loudly if anyone ever starts feeding tritan into a floor.
    const b0 = [0, 0, 1], b1 = simulate(b0, 'tritan');
    results.push({
      check: 'tritan: single-plane limit — pure blue is a fixed point',
      pass: d(b0, b1) < 0.01,
      detail: `moved ${d(b0, b1).toFixed(5)}; tritan is EXCLUDED from every derived floor`,
    });
  }

  // A dichromatic projection is idempotent: simulating an already-simulated colour
  // must change nothing. That is a property of the MATRIX PRODUCT, so it fails loudly
  // if any single constant is mistyped, without depending on remembering the value.
  for (const kind of ALL_KINDS) {
    let worst = 0;
    for (const rgb of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [0, 1, 1], [1, 0, 1], [0.6, 0.3, 0.2], [0.2, 0.7, 0.9]]) {
      const once = simulate(rgb, kind);
      worst = Math.max(worst, d(once, simulate(once, kind)));
    }
    results.push({ check: `${kind}: the projection is idempotent`, pass: worst < 0.01, detail: `worst drift ${worst.toFixed(5)}` });
  }

  // Protanopia loses the long-wavelength cone, so pure red must lose a large share of
  // its luminance; deuteranopia does not lose it the same way.
  const Y = ([r, g, b]) => { const l = linSRGB([r, g, b]); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
  const yRed = Y([1, 0, 0]);
  results.push({
    check: 'protan: pure red loses most of its luminance',
    pass: Y(simulate([1, 0, 0], 'protan')) < 0.5 * yRed,
    detail: `${yRed.toFixed(4)} -> ${Y(simulate([1, 0, 0], 'protan')).toFixed(4)}`,
  });
  results.push({
    check: 'deutan: pure red keeps most of its luminance',
    pass: Y(simulate([1, 0, 0], 'deutan')) > 0.8 * yRed,
    detail: `${yRed.toFixed(4)} -> ${Y(simulate([1, 0, 0], 'deutan')).toFixed(4)}`,
  });
  return results;
}
