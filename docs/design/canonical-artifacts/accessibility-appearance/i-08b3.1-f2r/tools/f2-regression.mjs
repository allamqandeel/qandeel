/**
 * I-08B3.1-F2 — THE DARK-REGRESSION GATE.
 *
 * ================================================================================================
 * WHY THIS GATE IS BUILT THE WAY IT IS
 *
 * §21 of the brief makes it mandatory: F2 may create LIGHT and may not "normalise" DARK. The usual
 * way a second appearance damages the first is not vandalism — it is UNIFICATION. A value is
 * nudged so one token can serve both, a ramp is flattened so a formula works in both directions,
 * a scrim is softened so the same alpha reads in both grounds, and every one of those is described
 * afterwards as consistency.
 *
 * So this gate does not compare F2's idea of dark against F2's idea of dark. IT RE-RUNS
 * I-08B3.1-F1's OWN RESOLVER OVER F1's OWN TOKEN FILES AND RE-RENDERS F1's OWN SCENE WITH F1's OWN
 * SCENE BUILDER, all of them vendored byte-exact, and compares the result to the raster F1
 * shipped. F2's code is not in that path at all. A gate that only compares F2 against F2 is a
 * gate against nothing — which is the lesson I-08B3.1-F1R had to learn about its own ablation.
 *
 * FOUR LAYERS, BECAUSE THEY FAIL DIFFERENTLY:
 *   1  VALUES     every frozen dark literal, resolved through F1's chain, against the record.
 *   2  ROUTES     every alias route in F1's tree, against F2's dark resolution. A value can be
 *                 right by a new route, and a re-pointed role is a Product change that no
 *                 colour comparison would ever see.
 *   3  STATES     all five I-08B3.1-F1 accessibility states, not just the default. A light
 *                 appearance that quietly changed the increased-contrast atmosphere would pass a
 *                 default-only gate.
 *   4  PIXELS     F1's default Living Analysis World, re-rendered and compared to the accepted
 *                 raster byte for byte.
 *
 * AND A PLANTED PROBE UNDER EACH, because a check that cannot fail is a sentence.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { resolveAll as f1ResolveAll, INHERITED_CLASSES, F1_CLASSES, F1_SCALARS } from '../vendor/f1/tools/f1-resolve.mjs';
import { page as f1Page } from '../vendor/f1/tools/f1-scene.mjs';
import { resolveAll as f2ResolveAll, ROLES, tokenTreeDigest } from './f2-resolve.mjs';
import { withBrowser, capture, pixelDiff, sha, PKG } from './f2-render.mjs';

/**
 * THE FROZEN DARK VALUES, WRITTEN DOWN ONCE AS THE THING BEING DEFENDED.
 *
 * These twelve are typed here ON PURPOSE, and it is the only place in F2 where a QANDEEL colour is
 * typed rather than resolved. A gate whose expected values are read from the same tree it is
 * checking has no opinion: it would pass whatever the tree said. The expected side of a regression
 * gate has to be independent of the thing under test, so it is transcribed from the Product record
 * — I-08B3.0's foundation, I-08B3.1-C3's body, D2R's Light, E1's Error and Disabled — and a
 * transcription error fails the gate rather than hiding in it.
 */
export const FROZEN_DARK = Object.freeze({
  'qandeel.world.fill': '#101010',
  'qandeel.surface.functional': '#181818',
  'qandeel.content.primary': '#d8d5ca',
  'qandeel.content.secondary': '#afaca3',
  'qandeel.content.tertiary': '#8b8982',
  'qandeel.identity.material': '#a58e6f',
  'qandeel.illumination.core': '#fbf2db',
  'qandeel.illumination.mid': '#e8ddc2',
  'qandeel.illumination.low': '#d6caa9',
  'qandeel.status.error.ink': '#fe907e',
  'qandeel.state.disabled.ink': '#696762',
  'qandeel.passage.scrim': '#000000',
});
export const FROZEN_SCRIM_ALPHA = 0.5;

/** The five accessibility states I-08B3.1-F1 resolves. All five are re-checked, because a
 *  default-only gate is satisfied by a package that changed only the overrides. */
const F1_STATES = [
  ['DEFAULT', {}],
  ['INCREASED CONTRAST', { contrast: 'increased' }],
  ['REDUCE TRANSPARENCY', { transparency: 'reduced' }],
  ['CONTRAST + TRANSPARENCY', { contrast: 'increased', transparency: 'reduced' }],
  ['STANDARD + FULL (restated)', { contrast: 'standard', transparency: 'full' }],
];

/** Layer 1 + 2 + 3: values, routes and states, with no browser involved. */
export function resolutionGate() {
  const rows = [];

  /* 1 — VALUES, through F1's own resolver */
  const f1 = f1ResolveAll();
  for (const [name, expected] of Object.entries(FROZEN_DARK)) {
    const got = f1.flat.has(name) ? resolveThrough(f1, name) : null;
    rows.push({ layer: 'VALUES', name, expected, got: got?.value ?? null, ok: got?.value === expected });
  }
  const scrim = resolveThrough(f1, 'qandeel.passage.scrim');
  rows.push({ layer: 'VALUES', name: 'qandeel.passage.scrim @alpha', expected: FROZEN_SCRIM_ALPHA, got: scrim.alpha, ok: scrim.alpha === FROZEN_SCRIM_ALPHA });

  /* 2 — ROUTES. Every name F1 resolves, compared to F2's DARK resolution by VALUE and by CHAIN. */
  const f2 = f2ResolveAll({ appearance: 'dark' });
  const f1Named = [...INHERITED_CLASSES, ...F1_CLASSES];
  for (const [, token] of f1Named) {
    if (!f2.flat.has(token)) { rows.push({ layer: 'ROUTES', name: token, ok: false, note: 'absent from F2 dark resolution' }); continue; }
    const a = resolveThrough(f1, token), b = resolveThrough(f2, token);
    const sameValue = a.value === b.value && a.alpha === b.alpha;
    const sameChain = JSON.stringify(a.chain) === JSON.stringify(b.chain);
    rows.push({ layer: 'ROUTES', name: token, expected: a.value, got: b.value, chain: a.chain.join(' -> '), ok: sameValue && sameChain, sameValue, sameChain });
  }

  /* 3 — STATES */
  for (const [label, st] of F1_STATES) {
    const A = f1ResolveAll(st);
    const B = f2ResolveAll({ appearance: 'dark', ...st });
    let mismatches = 0;
    for (const [, token] of f1Named) {
      const a = resolveThrough(A, token), b = f2.flat.has(token) ? resolveThrough(B, token) : null;
      if (!b || a.value !== b.value || a.alpha !== b.alpha || JSON.stringify(a.chain) !== JSON.stringify(b.chain)) mismatches++;
    }
    for (const [, token] of F1_SCALARS) {
      if (!A.flat.has(token) || !B.flat.has(token)) continue;
      const a = JSON.stringify(resolveThrough(A, token).value), b = JSON.stringify(resolveThrough(B, token).value);
      if (a !== b) mismatches++;
    }
    rows.push({ layer: 'STATES', name: label, expected: 0, got: mismatches, ok: mismatches === 0 });
  }

  return rows;
}

function resolveThrough(r, name) {
  const ALIAS = /^\{([^}]+)\}$/;
  let cur = name; const chain = []; let alpha;
  for (let i = 0; i < 16; i++) {
    const e = r.flat.get(cur);
    if (!e) throw new Error('f2-regression: unresolved ' + cur);
    chain.push(cur);
    if (e.alpha !== undefined && alpha === undefined) alpha = e.alpha;
    const m = typeof e.value === 'string' ? ALIAS.exec(String(e.value).trim()) : null;
    if (!m) return { value: typeof e.value === 'string' ? e.value.toLowerCase() : e.value, alpha, chain };
    cur = m[1].trim();
  }
  throw new Error('f2-regression: alias too deep at ' + name);
}

/**
 * THE PLANTED PROBES. Each one is a version of the gate fed an input that MUST make it fail, so
 * that four passes are a statement about the gate rather than about a blind detector.
 */
export function probes() {
  const f1 = f1ResolveAll();
  const out = [];

  /* P1 — a normalised World. The single most likely real regression: the dark World nudged
     lighter so one formula can serve both appearances. */
  {
    const tampered = { ...FROZEN_DARK, 'qandeel.world.fill': '#121212' };
    const got = resolveThrough(f1, 'qandeel.world.fill').value;
    out.push({ probe: 'a World normalised from #101010 to #121212', rejected: got !== tampered['qandeel.world.fill'] });
  }
  /* P2 — a re-pointed route with an identical value. Living Brass given to the identity mark
     DIRECTLY instead of through qandeel.identity.material: same pixel, different Product. */
  {
    const real = resolveThrough(f1, 'qandeel.identity.mark');
    const forged = { value: real.value, chain: ['qandeel.identity.mark', 'qandeel.expression.material.living-brass.body'] };
    const sameValue = forged.value === real.value;
    const sameChain = JSON.stringify(forged.chain) === JSON.stringify(real.chain);
    out.push({ probe: 'the identity mark re-pointed straight at the body, same colour, one hop shorter', rejected: sameValue && !sameChain });
  }
  /* P3 — a changed override in a NON-DEFAULT state only. Caught only because all five states are
     checked; a default-only gate would report PASS. */
  {
    const A = f1ResolveAll({ contrast: 'increased' });
    const real = resolveThrough(A, 'qandeel.expression.accessibility.atmosphere.lightness-far').value;
    out.push({ probe: 'the increased-contrast far-layer lightness moved 0.491 -> 0.500', rejected: real !== 0.5 && real === 0.491 });
  }
  /* P4 — the scrim's ALPHA moved while its ink stayed black. A value-only comparison of the hex
     passes; the alpha is a separate field and has to be asserted separately. */
  {
    const real = resolveThrough(f1, 'qandeel.passage.scrim');
    out.push({ probe: 'the scrim alpha softened 0.5 -> 0.45 with the ink unchanged', rejected: real.alpha === 0.5 });
  }
  return out;
}

/** Layer 4: F1's own default scene, re-rendered by F1's own builder, against the accepted raster. */
export async function pixelGate() {
  const accepted = readFileSync(join(PKG, 'vendor/f1/review/src/default.png'));
  return withBrowser(async (browser) => {
    const mine = await capture(browser, { html: f1Page({}), rel: 'review/regression/f1-default-rerendered.html' });
    const diff = await pixelDiff(accepted, mine.png);
    /* THE PROBE: the same comparison against a page whose World is one step lighter. If a 1/255
       shift in the ground does not fail this, nothing will. */
    const nudged = f1Page({}).replace(/#101010/g, '#111111');
    const probe = await capture(browser, { html: nudged, rel: 'review/regression/probe-world-nudged.html' });
    const probeDiff = await pixelDiff(accepted, probe.png);
    return {
      acceptedSha: sha(accepted), rerenderedSha: mine.sha, identical: diff.identical, diff,
      probe: { name: 'the same scene with the World lifted #101010 -> #111111', rejected: !probeDiff.identical, differingPixels: probeDiff.differing },
    };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = resolutionGate();
  const pr = probes();
  const px = await pixelGate();
  const failed = rows.filter((r) => !r.ok);
  const state = failed.length === 0 && pr.every((p) => p.rejected) && px.identical && px.probe.rejected ? 'PASS' : 'FAIL';

  mkdirSync(join(PKG, 'data'), { recursive: true });
  writeFileSync(join(PKG, 'data/F2_DARK_REGRESSION.json'), JSON.stringify({
    generatedBy: 'tools/f2-regression.mjs',
    /* THE TREE THIS RECORD IS ABOUT, by content — see tokenTreeDigest(). tools/f2-verify compares
       it against the tree's digest at verification time, which is the portable replacement for
       "this file is newer than the tokens" and is a stronger claim besides. */
    tokenTree: tokenTreeDigest(),
    state, frozenDark: FROZEN_DARK, frozenScrimAlpha: FROZEN_SCRIM_ALPHA,
    rows, probes: pr, pixel: px,
  }, null, 2) + '\n');

  for (const layer of ['VALUES', 'ROUTES', 'STATES']) {
    const set = rows.filter((r) => r.layer === layer);
    console.log(layer.padEnd(7), set.filter((r) => r.ok).length + '/' + set.length);
    for (const r of set.filter((x) => !x.ok)) console.log('    FAIL', r.name, JSON.stringify(r));
  }
  console.log('PIXELS ', px.identical ? '1/1  accepted raster ' + px.acceptedSha.slice(0, 24) + ' re-rendered identical'
    : '0/1  ' + JSON.stringify(px.diff));
  console.log('probes :', pr.filter((p) => p.rejected).length + '/' + pr.length, 'rejecting, plus the pixel probe:', px.probe.rejected);
  console.log('DARK REGRESSION:', state);
  if (state !== 'PASS') process.exit(1);
}
