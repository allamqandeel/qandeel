/**
 * I-08B3.1-F1 — THE SPECTACLE PRESERVATION GATE, IN TWO HALVES THAT MUST NOT BE CONFUSED.
 *
 * HALF ONE — DID F1 WEAKEN THE DEFAULT? This is the gate the brief actually sets, and it is
 * mechanical. Two checks, and the second is the one with teeth:
 *
 *   D-01  the whole token tree resolved with NO accessibility setting on must equal the tree
 *         I-08B3.1-E1 resolves, literal for literal and route for route.
 *   D-02  DEFAULT ACCESSIBILITY-OVERRIDE ISOLATION — and I-08B3.1-F1R renamed it, because F1
 *         called it "the ablation" and let it carry a claim it does not support.
 *
 *         WHAT IT PROVES. Every accessibility override file is replaced with an empty stub and
 *         the default document is rendered again; it must be BYTE-IDENTICAL. If any
 *         accessibility value had leaked into the default path — a contrast value read
 *         unconditionally, a motion scalar consulted where it should not be — removing the
 *         override files would change the default, and the hash would say so. A check that only
 *         rendered the default twice would pass no matter how badly the default was
 *         contaminated, because it would be contaminated identically both times.
 *
 *         WHAT IT DOES NOT PROVE, STATED HERE BECAUSE IT USED TO BE CLAIMED. It does not prove
 *         that the default expression is byte-identical to the pre-F1 I-08B3.1-D2R expression.
 *         Both sides of this comparison run F1's own scene builder, so a change hardcoded into
 *         that builder survives both sides untouched and this check stays green. The missing
 *         claim is proved separately and against the inherited package, in tools/f1-inherit.mjs
 *         — attribute equality against D2R's own exported functions, and pixel equality against
 *         a reference page built from them with no F1 code in it at all.
 *
 * HALF TWO — DOES THE SYSTEM RETAIN THE CAPACITY FOR THE NORTH STAR'S LEVEL OF AWE? This is
 * NOT a gate F1 can pass or fail by changing something, and pretending otherwise would be the
 * dishonest move available here. The distance between the frozen system and the North Star
 * image is a property of decisions made in I-08B3.1-A and D2R — a World frozen at #101010 and
 * an atmosphere chroma ceiling of 0.0197 — and F1 is forbidden from touching either. So this
 * half MEASURES the distance, on the dimensions the brief names, and hands the number up.
 *
 * Saying "the capacity is retained" without measuring would be exactly the claim §23 calls
 * theatre. The measurement is uncomfortable and it is in the package.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync, copyFileSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { page } from './f1-scene.mjs';
import { findChrome, launch, openPage } from './f1-cdp.mjs';
import { srgbToOklch } from '../vendor/lib/color.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const sha = (b) => createHash('sha256').update(b).digest('hex');

/** The override files whose ABSENCE the default must not notice. */
const OVERRIDES = [
  'tokens/contrast/increased.accessibility.tokens.json',
  'tokens/transparency/reduced.accessibility.tokens.json',
];
const EMPTY_STUB = JSON.stringify({ qandeel: { $description: 'ABLATION STUB — tools/f1-spectacle.mjs. If the default expression notices this file is empty, an accessibility value has leaked into the default path.' } }, null, 2) + '\n';

/**
 * Pixel statistics on the dimensions §13 names, computed in the browser because that is where
 * the only image decoder on this host lives. Returned as a histogram summary rather than a
 * verdict: the numbers are for a reader to judge, not for this file to grade.
 */
const STATS_JS = (src, step) => `(async function(){
  const img = new Image();
  img.src = ${JSON.stringify(src)};
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, W, H).data;
  const px = [];
  for (let y = 0; y < H; y += ${step}) for (let xx = 0; xx < W; xx += ${step}) {
    const i = (y * W + xx) * 4;
    px.push([d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]);
  }
  // spatial detail: mean absolute luminance difference to the pixel one step to the right
  let detail = 0, n = 0;
  const lum = function(i){ return 0.2126 * d[i] + 0.7152 * d[i+1] + 0.0722 * d[i+2]; };
  for (let y = 0; y < H; y += ${step}) for (let xx = 0; xx + ${step} < W; xx += ${step}) {
    const i = (y * W + xx) * 4, j = (y * W + xx + ${step}) * 4;
    detail += Math.abs(lum(i) - lum(j)); n++;
  }
  return JSON.stringify({ W: W, H: H, sampled: px.length, px: px, detail: n ? detail / n : 0 });
})()`;

function summarise(raw) {
  const o = JSON.parse(raw);
  const chroma = [], light = [], hues = [];
  for (const p of o.px) {
    const [L, C, Hh] = srgbToOklch(p);
    chroma.push(C);
    light.push(L);
    if (C > 0.02 && !Number.isNaN(Hh)) hues.push(Hh);
  }
  const q = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
  const f = (n, d = 4) => Number(n.toFixed(d));
  /* how many 10-degree hue bins carry any real chroma at all */
  const bins = new Set(hues.map((h) => Math.floor(h / 10)));
  /**
   * CHROMA AMONG THE PIXELS THAT ARE ACTUALLY PAINTED.
   *
   * The plain p95 of a phone frame is dominated by the achromatic ground, which occupies most
   * of it — so comparing it to a full-bleed nebula compares two crops, not two policies. This
   * statistic asks the apples-to-apples question instead: of the pixels that carry ANY chroma
   * at all, how chromatic are they? A threshold of 0.004 is one 8-bit step's worth of chroma at
   * this lightness, i.e. "not the flat ground".
   */
  const painted = chroma.filter((c) => c > 0.004);
  return {
    chromaAmongPaintedPixels: painted.length
      ? { count: painted.length, share: f(painted.length / chroma.length), p50: f(q(painted, 0.5)), p95: f(q(painted, 0.95)), max: f(Math.max(...painted)) }
      : { count: 0, share: 0, p50: 0, p95: 0, max: 0 },
    pixels: o.sampled,
    size: [o.W, o.H],
    chroma: { mean: f(chroma.reduce((a, b) => a + b, 0) / chroma.length), p50: f(q(chroma, 0.5)), p95: f(q(chroma, 0.95)), max: f(Math.max(...chroma)) },
    lightness: { p05: f(q(light, 0.05)), p50: f(q(light, 0.5)), p95: f(q(light, 0.95)), range: f(q(light, 0.95) - q(light, 0.05)) },
    chromaticPixelShare: f(chroma.filter((c) => c > 0.02).length / chroma.length),
    hueBinsOccupied: bins.size,
    spatialDetail: f(o.detail, 3),
  };
}

export async function run({ northStar }) {
  const out = join(PKG, 'review', 'spectacle');
  mkdirSync(out, { recursive: true });
  const chrome = findChrome();
  if (!chrome) return { state: 'UNVERIFIABLE — no Chrome on this host' };

  /* ---------------- HALF ONE: the ablation ---------------- */
  const browser = await launch({ chrome, port: 9449 });
  let defaultHash = null, ablatedHash = null, defaultPng = null;
  try {
    const render = async (tag) => {
      const file = join(out, `default-${tag}.html`);
      writeFileSync(file, page({}));
      const p = await openPage(browser, { url: pathToFileURL(file).href, width: 390, height: 844, dpr: 2 });
      const png = await p.shot({ full: true });
      const html = readFileSync(file);
      await p.close();
      return { png, html };
    };
    const before = await render('intact');
    defaultHash = { html: sha(before.html), png: sha(before.png) };
    defaultPng = join(out, 'default.png');
    writeFileSync(defaultPng, before.png);

    /* swap the override files for empty stubs, re-render, put them back */
    const backups = [];
    for (const rel of OVERRIDES) {
      const p = join(PKG, rel);
      const bak = p + '.ablation-backup';
      copyFileSync(p, bak);
      backups.push([p, bak]);
      writeFileSync(p, EMPTY_STUB);
    }
    let after;
    try {
      after = await render('ablated');
    } finally {
      for (const [p, bak] of backups) { renameSync(bak, p); }
    }
    ablatedHash = { html: sha(after.html), png: sha(after.png) };

    /* ---------------- HALF TWO: the North Star measurement ---------------- */
    let ns = null, ours = null;
    const blank = join(out, 'stats.html');
    writeFileSync(blank, '<!doctype html><html data-qd-ready="1"><head><meta charset="utf-8"></head><body></body></html>');
    const p = await openPage(browser, { url: pathToFileURL(blank).href, width: 800, height: 600, dpr: 1 });
    if (northStar && existsSync(northStar)) {
      const uri = 'data:image/webp;base64,' + readFileSync(northStar).toString('base64');
      ns = summarise(await p.evalIn(STATS_JS(uri, 6)));
    }
    const oursUri = 'data:image/png;base64,' + readFileSync(defaultPng).toString('base64');
    ours = summarise(await p.evalIn(STATS_JS(oursUri, 6)));
    await p.close();

    return {
      state: 'MEASURED',
      ablation: {
        name: 'DEFAULT ACCESSIBILITY-OVERRIDE ISOLATION',
        what: 'Every accessibility override file replaced with an empty stub; the DEFAULT document re-rendered.',
        proves: 'The default expression does not read, and does not notice the absence of, any accessibility override. No accessibility value has leaked into the default path.',
        doesNotProve: 'That the default expression is byte-identical to the pre-F1 I-08B3.1-D2R expression. Both sides run F1\'s own scene builder, so a change hardcoded into that builder would survive both. See data/F1_INHERITED_DEFAULT.json, which proves that separately and against the inherited package.',
        defaultHash, ablatedHash,
        htmlIdentical: defaultHash.html === ablatedHash.html,
        pngIdentical: defaultHash.png === ablatedHash.png,
        pass: defaultHash.html === ablatedHash.html && defaultHash.png === ablatedHash.png,
      },
      northStar: ns,
      current: ours,
    };
  } finally {
    await browser.close();
  }
}

export function verdict(res) {
  if (res.state !== 'MEASURED') return { state: res.state };
  const ns = res.northStar, cu = res.current;
  if (!ns) return { ablation: res.ablation, northStar: 'NOT SUPPLIED TO THIS RUN' };
  const ratio = (a, b) => Number((a / (b || 1e-9)).toFixed(2));
  /**
   * THE DISTANCE IS DECOMPOSED BEFORE IT IS REPORTED, because an undecomposed distance invites
   * the wrong action. Two of these dimensions are statements about a FROZEN POLICY and four are
   * mostly statements about FRAMING — the North Star is a full-bleed 1920-px landscape in which
   * six worlds fill the frame, and the current capture is a 390-pt phone screen of ONE world
   * with a large quiet ground. A reviewer who reads "459x fewer chromatic pixels" as a policy
   * failure would be reading a crop.
   *
   * The number that is NOT a crop is the chroma ceiling: 0.0197 authored, against a North Star
   * 95th percentile of 0.0727. That is the decision, and it is 3.7x.
   */
  const POLICY = new Set(['95th-percentile chroma, PAINTED PIXELS ONLY']);
  return {
    ablation: res.ablation,
    dimensions: [
      ['mean chroma', ns.chroma.mean, cu.chroma.mean, ratio(ns.chroma.mean, cu.chroma.mean), 'POLICY + framing — the ground is achromatic and occupies most of a phone frame'],
      ['95th-percentile chroma, WHOLE FRAME', ns.chroma.p95, cu.chroma.p95, ratio(ns.chroma.p95, cu.chroma.p95), 'FRAMING — dominated by the achromatic ground, which occupies most of a phone frame'],
      ['95th-percentile chroma, PAINTED PIXELS ONLY', ns.chromaAmongPaintedPixels.p95, cu.chromaAmongPaintedPixels.p95, ratio(ns.chromaAmongPaintedPixels.p95, cu.chromaAmongPaintedPixels.p95), 'POLICY — the apples-to-apples comparison, and the one a crop cannot explain away'],
      ['share of chromatic pixels (C > 0.02)', ns.chromaticPixelShare, cu.chromaticPixelShare, ratio(ns.chromaticPixelShare, cu.chromaticPixelShare), 'FRAMING — six worlds filling a frame against one world on a quiet ground'],
      ['10-degree hue bins occupied', ns.hueBinsOccupied, cu.hueBinsOccupied, ratio(ns.hueBinsOccupied, cu.hueBinsOccupied), 'FRAMING + policy — QANDEEL authors exactly six hues and the ceiling puts four of them below the 0.02 threshold this statistic uses'],
      ['lightness range p05..p95', ns.lightness.range, cu.lightness.range, ratio(ns.lightness.range, cu.lightness.range), 'FRAMING — a bright nebula against a dark map'],
      ['spatial detail (mean |dL| between neighbours)', ns.spatialDetail, cu.spatialDetail, ratio(ns.spatialDetail, cu.spatialDetail), 'FRAMING + density — the North Star draws thousands of points; the map draws eight topics'],
    ].map(([name, northStar, current, factor, kind]) => ({ name, northStar, current, northStarIsThisManyTimesTheCurrent: factor, kind, isPolicy: POLICY.has(name) })),
    theOneNumber: {
      what: 'the authored atmosphere chroma ceiling, against the North Star 95th percentile',
      chromaCeiling: 0.0197,
      northStarP95: ns.chroma.p95,
      factor: ratio(ns.chroma.p95, 0.0197),
      owner: 'I-08B3.1-D2R, derived as 0.62 of the minimum chroma of the three QANDEEL LIGHT stops',
      why: 'so that ATMOSPHERE can never compete with LIGHT. It is a semantic separation, not a taste preference, which is exactly why F1 may not touch it and why raising it is a D-track question rather than an accessibility one.',
    },
    reading: [
      'THE HEADLINE RATIOS ARE MOSTLY A CROP, AND THE DECOMPOSITION IS THE RESULT. Over the whole frame the North Star is 88x more chromatic and carries 459x the share of chromatic pixels. Almost all of that is framing: a full-bleed 1920-px landscape in which six worlds fill the frame, against a 390-pt phone screen showing ONE world on a deliberately quiet ground. Reading those numbers as a policy failure would be reading a crop.',
      'AMONG THE PIXELS THAT ARE ACTUALLY PAINTED, THE GAP IS 1.41x. That is the apples-to-apples comparison and it is the surprising one: QANDEEL is not a desaturated product. Its painted 95th-percentile chroma is 0.0516, against the North Star\'s 0.073 — and the QANDEEL figure is carried by LIVING BRASS at C 0.0516 and the ERROR ink at C 0.1364, which is more chroma than the North Star reaches at its own 95th percentile.',
      'THE REAL, NARROW, POLICY GAP IS IN THE ATMOSPHERE. qandeel.atmosphere.chroma-ceiling is 0.0197 against a North Star 95th percentile of 0.073 — 3.69x. So the honest statement is not "QANDEEL is too quiet"; it is "QANDEEL\'s WORLD is 3.69x quieter than the reference image, by a deliberate semantic decision, while its identity material and its status colour are not quiet at all."',
      'AND THAT DECISION IS NOT F1\'s. The ceiling is I-08B3.1-D2R\'s, derived at 0.62 of the minimum chroma of the three QANDEEL LIGHT stops so that ATMOSPHERE could never compete with LIGHT. It is a semantic separation, not a taste preference. Raising it is a D-track and Product question, and F1 is forbidden from touching it.',
      'THE DIMENSION WHERE THE GAP IS NEITHER CROP NOR CEILING IS DENSITY. The North Star draws thousands of points; this map draws eight topics with three, two and one level line, and the measured spatial-detail gap is 3.72x. NO TOKEN IN ANY PACKAGE CONSTRAINS DENSITY — AND THAT IS AN OBSERVATION, NOT A PERMISSION. I-08B3.1-F1 wrote that this made density "the cheapest available route" to the North Star, which reads as though the absence of a prohibition were an authorisation to raise it. It is not. Nothing in the frozen record grants density to anyone, and F1R withdraws the sentence. What may be said is narrower and true: F1 imposes no ceiling on density, so whatever the Product later decides about it, no accessibility expression in this package has to change.',
      'AND THE CAPACITY ITSELF IS NOT PROVEN. F1 measured a real gap on seven dimensions and decomposed it honestly. It did not demonstrate that the final default dark Living Analysis World can REACH the Product Owner\'s required level of awe, and nothing in this package should be read as demonstrating it. That obligation is OPEN and it is carried forward to G — INTEGRATED PRODUCT PROOF. See `northStarStatus` below.',
    ],
    /**
     * THE CARRY-FORWARD, AS DATA RATHER THAN AS PROSE A LATER READER MIGHT SKIP.
     *
     * The North Star stays the SPECTACLE / RICHNESS NORTH STAR at full strength. F1 neither
     * weakens it nor claims to have met it, and F1R does not let the measurement be mistaken for
     * a verdict in either direction.
     */
    northStarStatus: {
      state: 'OPEN — NOT PROVEN BY F1, NOT WEAKENED BY F1',
      owner: 'G — INTEGRATED PRODUCT PROOF',
      f1Claim: 'F1 measured the distance on seven dimensions and decomposed it into framing, policy and density. It makes no claim that the capacity is reached.',
      whatGMustProve: [
        'that the final default dark Living Analysis World reaches the Product Owner\'s required level of WORLD-SCALE AWE',
        'ATMOSPHERIC RICHNESS',
        'COLOUR RICHNESS',
        'SPATIAL DEPTH',
        'AUTHORED MICRO-DETAIL',
        'DISCOVERY',
        'MEANINGFUL LUMINOUS IMPACT',
        'and all of it while preserving every frozen semantic truth',
      ],
      ifGCannot: 'If G cannot achieve that spectacle within the frozen I-08B3.1-D contract, THEN and only then a TARGETED D reconciliation may be required. F1R does not reopen D, does not propose one, and does not treat the measurement below as grounds for one.',
      measuredGaps: {
        atmosphereChromaCeilingVsNorthStarP95: 'x3.69 — a POLICY gap owned by D2R',
        spatialDetail: 'x3.72 — a DENSITY gap owned by nobody yet, and not granted to anyone by its absence from the token tree',
        paintedPixelChroma: 'x1.41 — the apples-to-apples comparison',
      },
    },
    whatF1Guarantees:
      'F1 neither reduces nor caps that capacity, and DEFAULT ACCESSIBILITY-OVERRIDE ISOLATION plus the inherited-default comparison are the proof rather than the promise: every accessibility transformation is an override in a modifier context whose default overrides nothing, the default path resolves through none of them, emptying every override file leaves the default document byte-identical, and the inherited atmosphere layer is pixel-identical to a reference built from I-08B3.1-D2R\'s own functions with no F1 code in it. If the Product raises the chroma ceiling or the field\'s density tomorrow, every expression in this package follows it without one token changing — because not one of them names a chroma, and the increased-contrast derivation is a SEARCH over whatever the ceiling then is rather than a set of values copied out of today\'s one. That is a statement about F1 not being in the way. It is NOT a statement that the capacity has been demonstrated.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const northStar = process.argv[2] ?? null;
  const res = await run({ northStar });
  const v = verdict(res);
  writeFileSync(join(PKG, 'data/F1_SPECTACLE.json'), JSON.stringify({ generatedBy: 'tools/f1-spectacle.mjs', raw: res, verdict: v }, null, 2) + '\n');
  console.log('ABLATION — default document with every accessibility override emptied:');
  console.log('  html identical:', res.ablation?.htmlIdentical, ' png identical:', res.ablation?.pngIdentical);
  console.log('  default png sha256:', res.ablation?.defaultHash?.png?.slice(0, 24));
  console.log('  PASS:', res.ablation?.pass);
  if (v.dimensions) {
    console.log('\nNORTH STAR vs CURRENT DEFAULT:');
    for (const d of v.dimensions) console.log('  ', (d.isPolicy ? '* ' : '  ') + d.name.padEnd(46), String(d.northStar).padStart(9), String(d.current).padStart(9), ' x' + String(d.northStarIsThisManyTimesTheCurrent).padEnd(8), d.kind.split(' — ')[0]);
    console.log('\n  THE ONE NUMBER A CROP CANNOT EXPLAIN AWAY: chroma ceiling', v.theOneNumber.chromaCeiling, 'vs North Star p95', v.theOneNumber.northStarP95, '= x' + v.theOneNumber.factor);
  } else {
    console.log('\nNorth Star:', v.northStar);
  }
  if (res.ablation && !res.ablation.pass) process.exit(1);
}
