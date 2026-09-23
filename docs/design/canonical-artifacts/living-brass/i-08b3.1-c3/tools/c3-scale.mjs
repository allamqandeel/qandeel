/**
 * I-08B3.1-C3.2 — IS THE CHARACTER'S SCALE THRESHOLD EARNED, OR IS IT PROOF-SPECIFIC?
 *
 * The brief is explicit, and it is the whole reason this file exists:
 *
 *   "Define a scale threshold as an IMPLEMENTATION RULE only if evidence supports a stable one.
 *    Do not invent one merely for convenience. If the C1/C2 threshold remains proof-specific:
 *    freeze the principle and leave component threshold to integration."
 *
 * C1R and C2 both used `GRAIN_MIN_PX = 96` and both were RIGHT to: it kept the character off every
 * ordinary mark, which is what those stages needed. But neither stage ever measured AT 96. C2
 * emitted the character at 260 px and refused it at 24 and 30, which establishes that 96 lies
 * somewhere in an untested gap — not that 96 is where anything happens. Carrying it into a
 * production freeze on that basis would be exactly the invention the brief forbids.
 *
 * ── THE MEASUREMENT, AND WHY THE OBVIOUS ONE IS WRONG ────────────────────────────────────────
 *
 * The obvious sweep — render the mark with the character at each size and take C2's p05–p95
 * lightness spread — produces a number that RISES as the mark gets smaller. That reading is an
 * artefact and believing it would invert the finding. A small mark is nearly all antialiased edge,
 * and edge pixels blend toward the near-black World, so the spread they contribute swamps and then
 * impersonates the character.
 *
 * So the character is isolated by DIFFERENCE. At every width the same mark is rendered twice, with
 * the character and without it. The two rasters have identical geometry, identical edges and
 * identical antialiasing; the ONLY thing that differs is the noise field. Then:
 *
 *   - the INTERIOR MASK is taken from the character-free render: the pixels that are within one
 *     8-bit step of the pure body on all three channels. Those are the fully covered pixels — no
 *     ground is mixed into them — and they are the only pixels where a lightness reading means the
 *     material rather than the material's edge.
 *   - the delivered amplitude is p95−p05 of Oklab L over that mask IN THE CHARACTER RENDER.
 *
 * THE MASK IS THE RESULT AS MUCH AS THE AMPLITUDE IS. A stroke narrow enough to be all edge has no
 * interior at all, and a material character that has nowhere to live is not "subtle", it is absent.
 * That is a structural threshold rather than a taste threshold, which is the only kind a production
 * contract is entitled to freeze.
 *
 * NOTHING HERE RECALIBRATES ANYTHING. The body, the amplitude, the frequencies, the seed and the
 * alpha map are all read from the sealed C2 model and none is varied. The only variable is the
 * rendered width, which is not a property of the material.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decode } from '../vendor/c2/png.mjs';
import { srgbToOklch, hexToRgb8 } from '../vendor/c2/color.mjs';
import { RESOLVED, WORLD, CHARACTER, GRAIN_MIN_PX, characterShade, MARK_VB } from '../vendor/c2/c2-model.mjs';
import { material, markSVG } from '../vendor/c2/c2-ui.mjs';
import { shoot, WORK, page } from './c3-render.mjs';

const SHADE = characterShade();
const BODY8 = hexToRgb8(RESOLVED.body.hex);

/**
 * The sweep. Dense through the region where the answer is expected to live, and carried far enough
 * either side that a knee cannot be an artefact of where the sweep was cut off.
 *
 * 24 and 30 are the two sizes the Product actually uses for machinery; 260 is the identity moment
 * C2 measured; 96 is the inherited threshold, included so it is TESTED rather than assumed.
 */
export const WIDTHS = [24, 30, 40, 48, 56, 64, 80, 96, 112, 128, 160, 200, 260, 320, 420];

const pct = (arr, p) => (arr.length
  ? arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(p * arr.length))]
  : NaN);

function tile(inner, w, h) {
  return page(`<div class="t">${inner}</div>`, {
    width: w, bg: WORLD,
    extraCSS: `.t{width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;}svg{display:block;}`,
  });
}

/** Pixels within `tol` 8-bit steps of the pure body on every channel — the fully covered interior. */
function interiorMask(img, tol = 1) {
  const mask = new Uint8Array(img.width * img.height);
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    const r = img.rgba[i * 4], g = img.rgba[i * 4 + 1], b = img.rgba[i * 4 + 2];
    if (Math.abs(r - BODY8[0]) <= tol && Math.abs(g - BODY8[1]) <= tol && Math.abs(b - BODY8[2]) <= tol) {
      mask[i] = 1; n++;
    }
  }
  return { mask, count: n };
}

export async function sweep() {
  const rows = [];
  for (const px of WIDTHS) {
    const [, , vw, vh] = MARK_VB;
    const h = Math.round((px * vh) / vw);
    const boxW = Math.max(px + 80, 200);
    const boxH = h + 80;

    /* The SAME mark, twice. `forceCharacter` is what makes the sweep possible: it asks the builder
       for the character at sizes the scale rule would refuse, which is the question being put. */
    const withCh = material(RESOLVED, { widthPx: px, characterHex: SHADE.hex, forceCharacter: true });
    const without = material(RESOLVED, { widthPx: px, characterHex: null, forceCharacter: false });

    const aPng = join(WORK, `scale-${px}-char.png`);
    const bPng = join(WORK, `scale-${px}-flat.png`);
    await shoot(tile(markSVG(withCh, { px }), boxW, boxH), aPng, `scale-${px}-char`, { width: boxW, height: boxH, dpr: 2 });
    await shoot(tile(markSVG(without, { px }), boxW, boxH), bPng, `scale-${px}-flat`, { width: boxW, height: boxH, dpr: 2 });

    const A = decode(readFileSync(aPng));
    const B = decode(readFileSync(bPng));
    if (A.width !== B.width || A.height !== B.height) {
      throw new Error(`${px}px: the two renders differ in size — the difference method requires identical geometry`);
    }

    const { mask, count } = interiorMask(B);
    const totalInk = (() => {           // every pixel of the object, edges included
      let n = 0;
      for (let i = 0; i < B.width * B.height; i++) {
        const [r, g, b] = [B.rgba[i * 4], B.rgba[i * 4 + 1], B.rgba[i * 4 + 2]];
        if (srgbToOklch([r, g, b].map((c) => c / 255))[0] >= 0.42) n++;
      }
      return n;
    })();

    const Ls = [];
    let maxL = -1;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      const [r, g, b] = [A.rgba[i * 4], A.rgba[i * 4 + 1], A.rgba[i * 4 + 2]];
      const L = srgbToOklch([r, g, b].map((c) => c / 255))[0];
      Ls.push(L);
      if (L > maxL) maxL = L;
    }

    const bodyL = srgbToOklch(BODY8.map((c) => c / 255))[0];
    const amplitude = Ls.length ? pct(Ls, 0.95) - pct(Ls, 0.05) : 0;
    const meanL = Ls.length ? Ls.reduce((a, b2) => a + b2, 0) / Ls.length : NaN;

    /* How many DISTINCT 8-bit values the character actually paints inside the mark. At one distinct
       value the noise field has been averaged into a flat tone: the character is not faint, it is
       gone, and what remains is a body that is merely darker than the body. */
    const distinct = new Set();
    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) distinct.add(`${A.rgba[i * 4]},${A.rgba[i * 4 + 1]},${A.rgba[i * 4 + 2]}`);
    }

    rows.push({
      widthPx: px,
      renderedHeightPx: h,
      interiorPixels: count,
      totalObjectPixels: totalInk,
      interiorShare: totalInk ? count / totalInk : 0,
      deliveredAmplitude: amplitude,
      amplitudeVsTarget: amplitude - CHARACTER.targetAmplitude,
      amplitudeShareOfTarget: amplitude / CHARACTER.targetAmplitude,
      distinctInteriorValues: distinct.size,
      meanInteriorL: meanL,
      bodyL,
      brightestInteriorL: maxL,
      neverBrighterThanBody: Ls.length ? maxL <= bodyL + 0.002 : null,
    });
  }
  return rows;
}

/**
 * TWO THINGS THE SWEEP ABOVE CANNOT SAY, CHECKED SEPARATELY.
 *
 * 1. DEVICE PIXEL RATIO. Every figure in this package is taken at dpr 2, because every figure in
 *    C1R and C2 was. But `feTurbulence`'s `baseFrequency` is in USER SPACE, so the noise field
 *    scales with the artwork and the number of DEVICE pixels per noise feature scales with dpr. A
 *    threshold claim that is silent about dpr is a threshold claim with a hidden variable in it, so
 *    the smallest and largest widths are re-measured at dpr 1 — the worst realistic case, and worse
 *    than any shipping phone.
 *
 * 2. DETERMINISM. The turbulence is seeded, so the same page must rasterise to the same bytes. C2
 *    checked this once at 260 px. It is checked here at the SMALLEST width too, because a seeded
 *    generator that is stable when it has room to work is not evidence that it is stable when it
 *    does not.
 */
export async function conditions() {
  const out = { dpr: [], determinism: [] };
  for (const px of [24, 260]) {
    for (const dpr of [1, 2]) {
      const [, , vw, vh] = MARK_VB;
      const h = Math.round((px * vh) / vw);
      const boxW = Math.max(px + 80, 200), boxH = h + 80;
      const withCh = material(RESOLVED, { widthPx: px, characterHex: SHADE.hex, forceCharacter: true });
      const without = material(RESOLVED, { widthPx: px, characterHex: null, forceCharacter: false });
      const aPng = join(WORK, `cond-${px}-${dpr}-char.png`);
      const bPng = join(WORK, `cond-${px}-${dpr}-flat.png`);
      const A1 = await shoot(tile(markSVG(withCh, { px }), boxW, boxH), aPng, `cond-${px}-${dpr}-char`, { width: boxW, height: boxH, dpr });
      await shoot(tile(markSVG(without, { px }), boxW, boxH), bPng, `cond-${px}-${dpr}-flat`, { width: boxW, height: boxH, dpr });
      const A = decode(readFileSync(aPng)), B = decode(readFileSync(bPng));
      const { mask, count } = interiorMask(B);
      const Ls = [];
      const distinct = new Set();
      for (let i = 0; i < mask.length; i++) {
        if (!mask[i]) continue;
        const [r, g, b] = [A.rgba[i * 4], A.rgba[i * 4 + 1], A.rgba[i * 4 + 2]];
        Ls.push(srgbToOklch([r, g, b].map((c) => c / 255))[0]);
        distinct.add(`${r},${g},${b}`);
      }
      out.dpr.push({
        widthPx: px, dpr, interiorPixels: count, distinctInteriorValues: distinct.size,
        deliveredAmplitude: Ls.length ? pct(Ls, 0.95) - pct(Ls, 0.05) : 0,
        amplitudeShareOfTarget: (Ls.length ? pct(Ls, 0.95) - pct(Ls, 0.05) : 0) / CHARACTER.targetAmplitude,
      });

      /* Re-render the identical page and compare BYTES. */
      const rPng = join(WORK, `cond-${px}-${dpr}-char-again.png`);
      const A2 = await shoot(tile(markSVG(withCh, { px }), boxW, boxH), rPng, `cond-${px}-${dpr}-again`, { width: boxW, height: boxH, dpr });
      out.determinism.push({ widthPx: px, dpr, byteIdentical: A1.buf.equals(A2.buf), bytes: A1.buf.length });
    }
  }
  return out;
}

function fmt(n, d = 4) { return Number.isFinite(n) ? n.toFixed(d) : 'n/a'; }

export function report(rows) {
  const lines = [];
  lines.push('width  interior px   share   distinct   delivered   % of target   mean L    never>body');
  for (const r of rows) {
    lines.push(
      `${String(r.widthPx).padStart(5)}  ${String(r.interiorPixels).padStart(11)}  ` +
      `${(r.interiorShare * 100).toFixed(1).padStart(5)}%  ${String(r.distinctInteriorValues).padStart(8)}   ` +
      `${fmt(r.deliveredAmplitude).padStart(9)}   ${(r.amplitudeShareOfTarget * 100).toFixed(0).padStart(10)}%   ` +
      `${fmt(r.meanInteriorL, 4).padStart(6)}    ${String(r.neverBrighterThanBody).padStart(5)}`);
  }
  return lines.join('\n');
}

/**
 * THE VERDICT, DERIVED FROM THE ROWS RATHER THAN CHOSEN.
 *
 * A threshold is EARNED only if the sweep shows a stable transition — a width below which the
 * character measurably fails to exist and above which it measurably delivers its accepted
 * amplitude. "Measurably fails to exist" is given two independent structural definitions so the
 * verdict does not rest on one arbitrary cut:
 *
 *   FLOOR A — the mark has fewer than 64 fully covered interior pixels at 2x, i.e. essentially no
 *             body for a material to be made of.
 *   FLOOR B — the character paints fewer than 8 distinct values inside that interior, i.e. the
 *             noise field has collapsed into a flat tone.
 *
 * DELIVERY is defined as reaching 80 % of the amplitude C1R accepted and C2 confirmed. The band
 * between the highest failing width and the lowest delivering width is the honest answer: if it is
 * narrow the threshold is real and can be frozen; if it is wide, the sweep has located a REGION and
 * a single number inside it would be a convenience, which is the thing the brief forbids.
 */
export function verdict(rows) {
  const fails = rows.filter((r) => r.interiorPixels < 64 || r.distinctInteriorValues < 8);
  const delivers = rows.filter((r) => r.amplitudeShareOfTarget >= 0.80);
  const highestFail = fails.length ? Math.max(...fails.map((r) => r.widthPx)) : null;
  const lowestDeliver = delivers.length ? Math.min(...delivers.map((r) => r.widthPx)) : null;
  const inherited = rows.find((r) => r.widthPx === GRAIN_MIN_PX);

  /**
   * THE CLASSIFICATION, and it has three outcomes rather than two.
   *
   * EARNED           — there is a width below which the character structurally fails and above
   *                    which it delivers, and the two are close enough to name a number.
   * REGION_NOT_POINT — both exist but the gap between them is wide, so any single number inside it
   *                    is a convenience.
   * NOT_A_CAPABILITY_THRESHOLD
   *                  — nothing fails anywhere in the sweep. The character renders at every size the
   *                    Product uses, so a size rule cannot be justified as a capability limit at
   *                    all. The restraint it encodes is real but it is a PERMISSION, and freezing
   *                    it as a number would state a design decision in the grammar of physics.
   */
  const classification = highestFail === null
    ? 'NOT_A_CAPABILITY_THRESHOLD'
    : (lowestDeliver !== null && lowestDeliver - highestFail <= 32 ? 'EARNED' : 'REGION_NOT_POINT');

  return {
    classification,
    floorA: 'fewer than 64 fully covered interior pixels at 2x',
    floorB: 'fewer than 8 distinct values painted inside the interior',
    deliveryRule: 'at least 80 % of the accepted amplitude',
    highestFailingWidth: highestFail,
    lowestDeliveringWidth: lowestDeliver,
    bandPx: highestFail !== null && lowestDeliver !== null ? [highestFail, lowestDeliver] : null,
    inheritedThreshold: GRAIN_MIN_PX,
    inheritedRow: inherited || null,
    inheritedIsInsideBand: !!(inherited && highestFail !== null && lowestDeliver !== null
      && GRAIN_MIN_PX > highestFail && GRAIN_MIN_PX <= lowestDeliver),
    inheritedDelivers: !!(inherited && inherited.amplitudeShareOfTarget >= 0.80),
  };
}

/**
 * THE MAIN-MODULE GUARD, WRITTEN THE ONLY WAY THAT WORKS HERE.
 *
 * The idiomatic `import.meta.url === 'file:///' + argv[1].replace(/\\/g,'/')` is WRONG on this host
 * and wrong silently: the project path contains a space, `import.meta.url` percent-encodes it and a
 * hand-built string does not, so the comparison is false, the block never runs, and the tool exits
 * zero having done nothing. `pathToFileURL` does the encoding the URL actually uses.
 */
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = await sweep();
  console.log(report(rows));
  const v = verdict(rows);
  console.log('\nCLASSIFICATION: ' + v.classification);
  const c = await conditions();
  console.log('\ndpr check:');
  for (const r of c.dpr) {
    console.log(`  ${String(r.widthPx).padStart(4)} px @ dpr ${r.dpr}: interior ${String(r.interiorPixels).padStart(6)}, ` +
      `${String(r.distinctInteriorValues).padStart(4)} distinct, amplitude ${fmt(r.deliveredAmplitude)} ` +
      `(${(r.amplitudeShareOfTarget * 100).toFixed(0)} % of target)`);
  }
  console.log('determinism: ' + c.determinism.map((d) => `${d.widthPx}px@${d.dpr}x ${d.byteIdentical}`).join(', '));
  writeFileSync(join(WORK, 'scale-sweep.json'),
    JSON.stringify({ rows, verdict: v, conditions: c }, null, 2), 'utf8');
}
