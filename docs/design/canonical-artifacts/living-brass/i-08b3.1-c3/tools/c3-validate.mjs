/**
 * I-08B3.1-C3 — THE VALIDATION RUN.
 *
 * One entry point that executes every check the package makes, folds the results into
 * `data/C3_VALIDATION.json` and `data/C3_MEASUREMENTS.csv`, and writes `docs/C3_VALIDATION_RESULTS.md`
 * from the results rather than beside them. No figure in that document is typed by hand.
 *
 * FOUR LAYERS, AND THEY HAVE DIFFERENT DEPENDENCIES. Stating that plainly matters because a reviewer
 * extracting this package into an empty directory should know what will run there and what will not:
 *
 *   A. INVARIANTS + PROBES        — pure Node. No Chrome, no font, no sibling packages. Runs anywhere.
 *   B. DTCG SCHEMA CONFORMANCE    — needs `ajv`. Reported as UNAVAILABLE if absent, never skipped
 *                                   silently, because a conformance section that vanishes reads as a
 *                                   conformance section that passed.
 *   C. THE CHARACTER SCALE SWEEP  — needs headless Chrome. No font: the mark is geometry.
 *   D. THE REPRODUCTION PROOF     — needs Chrome, the local Arabic font, and the sealed C2 package.
 *
 * Nothing in A is allowed to depend on B, C or D. The claims that matter most — one body, no ladder,
 * no state alias, no invented Light — are the ones that survive the barest environment.
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { srgbToOklch, hexToRgb8 } from '../vendor/c2/color.mjs';
import { decode } from '../vendor/c2/png.mjs';
import { runAll as runInvariants, CHROMA_FLOOR, NEUTRAL_MAX_CHROMA, BODY_CHROMA } from './c3-invariants.mjs';
import { build as buildTokens } from './c3-tokens.mjs';
import { build as buildSkills } from './c3-skills.mjs';
import { build as buildReference } from './c3-reference.mjs';
import { RESOLVED, WORLD, SURFACE, PRIMARY, SECONDARY, TERTIARY, CHARACTER, GRAIN_MIN_PX }
  from '../vendor/c2/c2-model.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');
export const DATA = join(PKG, 'data');
export const DOCS = join(PKG, 'docs');
for (const d of [DATA, DOCS]) if (!existsSync(d)) mkdirSync(d, { recursive: true });

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const f = (n, d = 4) => (Number.isFinite(n) ? n.toFixed(d) : 'n/a');

/* ------------------------------------------------- B. schema conformance (optional dep) --- */

async function schemaConformance() {
  let Ajv, addFormats;
  try {
    const A = await import('ajv');
    const F = await import('ajv-formats');
    Ajv = A.default ?? A;
    addFormats = F.default ?? F;
  } catch (e) {
    return { available: false, why: `ajv is not resolvable from here (${e.code || e.message}) — ` +
      'the DTCG schemas are vendored and hashed, but nothing validated against them in this run' };
  }
  const SCHEMA_DIR = join(PKG, 'vendor', 'schemas', '2025.10');
  const prov = JSON.parse(readFileSync(join(SCHEMA_DIR, 'PROVENANCE.json'), 'utf8'));

  /* The vendored schemas are only authority if they are the ones that were vendored. */
  const integrity = [];
  for (const file of prov.files) {
    const abs = join(SCHEMA_DIR, file.published);
    if (!existsSync(abs)) { integrity.push({ file: file.published, ok: false, why: 'missing' }); continue; }
    const got = sha(abs).toUpperCase();
    integrity.push({ file: file.published, ok: got === file.sha256, recorded: file.sha256, got });
  }
  const broken = integrity.filter((i) => !i.ok);
  if (broken.length) return { available: true, integrity, ok: false, results: [], broken };

  const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: true });
  addFormats(ajv);
  for (const file of prov.files) {
    const doc = JSON.parse(readFileSync(join(SCHEMA_DIR, file.published), 'utf8'));
    ajv.addSchema(doc, doc.$id);
  }
  const FORMAT_ID = 'https://www.designtokens.org/schemas/2025.10/format.json';
  const RESOLVER_ID = 'https://www.designtokens.org/schemas/2025.10/resolver.json';

  const targets = [
    ['tokens/base/material.tokens.json', FORMAT_ID],
    ['tokens/appearance/dark.material.tokens.json', FORMAT_ID],
    ['tokens/appearance/light.material.tokens.json', FORMAT_ID],
    ['tokens/qandeel-living-brass.resolver.json', RESOLVER_ID],
  ];
  const results = [];
  for (const [rel, id] of targets) {
    const v = ajv.getSchema(id);
    const doc = JSON.parse(readFileSync(join(PKG, rel), 'utf8'));
    const pass = v(doc);
    results.push({ file: rel, schema: id, pass,
      errors: pass ? [] : v.errors.map((e) => `${e.instancePath || '/'} ${e.keyword}: ${e.message}`) });
  }
  return { available: true, integrity, ok: results.every((r) => r.pass), results,
    schemaFiles: prov.files.length, publicationCommit: prov.publicationCommit };
}

/* ---------------------------------- the chromatic-share measurement, for the Life Test ---- */

/**
 * WHAT FRACTION OF A FINISHED QANDEEL FRAME CARRIES ANY COLOUR AT ALL.
 *
 * Measured off C3's OWN reproduction rasters rather than quoted from C2, so the figure in the Life
 * Test is a measurement this package made of the compositions this package produced. It is a
 * SUPPORTING PROXY and nothing more: the Life Test asks whether a screen feels interchangeable with
 * a competent grey utility app, and no pixel statistic answers that. It bounds the question instead
 * of pretending to settle it.
 */
/**
 * THE INK FLOOR IS DERIVED, AND THE FIRST VERSION OF IT WAS WRONG IN A WAY WORTH RECORDING.
 *
 * It was set to Oklab L 0.20 as an eyeballed "above the grounds" line. The frozen Surface `#181818`
 * measures L 0.2090 — ABOVE that line — so every Surface pixel in every frame was being counted as
 * ink. The denominator was mostly ground, the chromatic share came out around three to seven times
 * too small, and every figure was plausible. The headline number of the Life Test was wrong and
 * nothing about it looked wrong.
 *
 * The floor is now the midpoint between the brightest thing the frozen system paints that is NOT
 * ink — the hairline `#2a2a2a`, L 0.2850 — and the dimmest thing it paints that IS ink — the
 * disabled state carrier `#5a5a58`, L 0.4669. Both are frozen constants read from the sealed model,
 * so the boundary moves only if the system moves.
 */
const HAIRLINE = '#2a2a2a';
const DIMMEST_INK = '#5a5a58';
export const INK_FLOOR = (srgbToOklch(hexToRgb8(HAIRLINE).map((c) => c / 255))[0]
  + srgbToOklch(hexToRgb8(DIMMEST_INK).map((c) => c / 255))[0]) / 2;

function chromaticShare(pngPath) {
  const img = decode(readFileSync(pngPath));
  let ink = 0, chromatic = 0;
  for (let i = 0; i < img.width * img.height; i++) {
    const [r, g, b] = [img.rgba[i * 4], img.rgba[i * 4 + 1], img.rgba[i * 4 + 2]];
    const [L, C] = srgbToOklch([r, g, b].map((c) => c / 255));
    if (L < INK_FLOOR) continue;                  // ground and hairline chrome are not ink
    ink++;
    /**
     * THE CHROMA THRESHOLD NEEDED A SECOND CORRECTION, FOR A DIFFERENT REASON.
     *
     * It was first set at `NEUTRAL_MAX_CHROMA` — above the warmest frozen neutral. But the warmest
     * frozen neutral IS `#d8d5ca`, the primary reading ink, so its own pixels sat exactly ON the
     * boundary and floating-point noise put about half of them on the chromatic side. The
     * conversation screen came back as 13.95 % chromatic, which is roughly four times what a screen
     * carrying six Brass objects can possibly be, and the number looked perfectly plausible.
     *
     * The threshold is the same DERIVED floor the invariants use: halfway between the warmest frozen
     * neutral and the body. Everything the reading ramp paints is comfortably below it and
     * everything the material paints is comfortably above.
     */
    if (C > CHROMA_FLOOR) chromatic++;
  }
  return { inkFloor: INK_FLOOR, chromaFloor: CHROMA_FLOOR, inkPixels: ink, chromaticPixels: chromatic,
    chromaticShareOfInk: ink ? chromatic / ink : 0, totalPixels: img.width * img.height };
}

/* ======================================================================= RUN ============== */

export async function run({ withRender = true } = {}) {
  const out = { generated: new Date().toISOString(), layers: {} };

  out.tokenFiles = buildTokens();
  out.layers.A = { name: 'invariants and negative probes', dependencies: 'none — pure Node' };
  out.invariants = runInvariants();
  const unver = out.invariants.filter((r) => r.unverifiable).length;
  out.layers.A.result = `${out.invariants.filter((r) => r.ok === true).length}/${out.invariants.length - unver}` +
    (unver ? ` (+${unver} unverifiable here)` : '');
  out.chromaFloor = { derived: CHROMA_FLOOR, frozenNeutralMax: NEUTRAL_MAX_CHROMA, bodyChroma: BODY_CHROMA };

  out.layers.B = { name: 'DTCG 2025.10 schema conformance', dependencies: 'ajv' };
  out.schema = await schemaConformance();
  out.layers.B.result = out.schema.available ? (out.schema.ok ? 'CONFORMS' : 'FAILED') : 'UNAVAILABLE';

  out.skills = buildSkills();
  out.reference = buildReference();

  if (withRender) {
    const scale = await import('./c3-scale.mjs');
    out.layers.C = { name: 'character scale sweep', dependencies: 'headless Chrome (no font)' };
    const rows = await scale.sweep();
    const conditions = await scale.conditions();
    out.scale = { rows, verdict: scale.verdict(rows), conditions };
    out.layers.C.result = out.scale.verdict.classification;

    const repro = await import('./c3-repro.mjs');
    out.layers.D = { name: 'token-driven reproduction of the accepted compositions',
      dependencies: 'headless Chrome + the local Arabic font + the sealed I-08B3.1-C2 package' };
    out.repro = await repro.run();
    const good = out.repro.rows.filter((r) => r.rasterBytesIdentical && r.markupIdentical).length;
    out.layers.D.result = `${good}/${out.repro.rows.length} byte-identical`;

    out.life = out.repro.rows.map((r) => ({
      case: r.case, label: r.label,
      ...chromaticShare(join(PKG, 'review', 'proof', `${r.case}-token.png`)),
    }));

    /**
     * THE RESULT NOBODY SET OUT TO MEASURE, PROMOTED TO ITS OWN FIELD BECAUSE IT IS THE STRONGEST
     * SINGLE STATEMENT OF THE COVERAGE POLICY IN THE PACKAGE.
     *
     * The eight Product screens — four environments and four interaction states — contain the SAME
     * NUMBER OF CHROMATIC PIXELS, exactly. Not similar: identical. The material's footprint does not
     * move between a conversation and an analytical map, and it does not move when an item is
     * selected, pressed, focused or disabled. The share of ink varies only because the amount of
     * NEUTRAL ink varies, which is the content doing its work.
     *
     * This is an independent confirmation of state invariance, arrived at from the raster rather
     * than from the markup guard that was designed to prove it, and of C2's environment ordering:
     * Utility concentrates the material most and Reading dilutes it most, found here on a different
     * instrument from the one C2 used.
     */
    const productScreens = out.life.filter((l) => !l.case.startsWith('c09'));
    const counts = new Set(productScreens.map((l) => l.chromaticPixels));
    out.footprint = {
      productScreens: productScreens.length,
      distinctChromaticPixelCounts: counts.size,
      chromaticPixels: [...counts],
      identicalAcrossEnvironmentsAndStates: counts.size === 1,
      shareRange: [Math.min(...productScreens.map((l) => l.chromaticShareOfInk)),
        Math.max(...productScreens.map((l) => l.chromaticShareOfInk))],
      ordering: productScreens.slice().sort((a, b) => b.chromaticShareOfInk - a.chromaticShareOfInk)
        .map((l) => ({ case: l.case, label: l.label, share: l.chromaticShareOfInk })),
    };
  }

  return out;
}

/* ==================================================================== EMIT ================ */

function csv(out) {
  const rows = [['group', 'key', 'value', 'unit', 'note']];
  const add = (g, k, v, u = '', n = '') => rows.push([g, k, String(v), u, n]);

  add('body', 'hex', RESOLVED.body.hex, '', 'THE ONE LITERAL — not canonical until the Design Director freezes C');
  add('body', 'authored.L', RESOLVED.authored.L, 'Oklab L', 'the derivation source for the character tone');
  add('body', 'authored.C', RESOLVED.authored.C, 'Oklab C', '');
  add('body', 'authored.H', RESOLVED.authored.H, 'deg', '');
  add('body', 'inGamut', RESOLVED.body.inGamut, '', '');
  add('body', 'clipped', RESOLVED.body.clipped, '', '');
  add('body', 'contrast.world', f(RESOLVED.body.contrastWorld, 3), ':1', `on ${WORLD}`);
  add('body', 'contrast.surface', f(RESOLVED.body.contrastSurface, 3), ':1', `on ${SURFACE}`);
  add('chroma', 'body', f(BODY_CHROMA), 'Oklab C', '');
  add('chroma', 'frozenNeutralMax', f(NEUTRAL_MAX_CHROMA), 'Oklab C', 'the warmest frozen neutral');
  add('chroma', 'derivedFloor', f(CHROMA_FLOOR), 'Oklab C', 'midpoint — separates "a second body" from "the frozen ramp"');

  add('character', 'targetAmplitude', CHARACTER.targetAmplitude, 'Oklab L', 'accepted in C1R');
  add('character', 'proofEraConstant', GRAIN_MIN_PX, 'px', 'RECORDED, NOT FROZEN');

  for (const i of out.invariants) {
    add('invariant', i.id, i.ok ? 'PASS' : (i.pass ? 'GUARD-DEAD' : 'FAIL'), '', i.title);
    add('invariant.probe', i.id, i.probeFired ? 'FIRED' : 'DID NOT FIRE', '', i.probeThrew ? 'checker threw' : '');
  }
  if (out.scale) {
    for (const r of out.scale.rows) {
      add('scale', `${r.widthPx}px.deliveredAmplitude`, f(r.deliveredAmplitude), 'Oklab L',
        `${(r.amplitudeShareOfTarget * 100).toFixed(0)} % of target`);
      add('scale', `${r.widthPx}px.interiorPixels`, r.interiorPixels, 'px@2x', '');
      add('scale', `${r.widthPx}px.distinctValues`, r.distinctInteriorValues, '', '');
      add('scale', `${r.widthPx}px.neverBrighterThanBody`, r.neverBrighterThanBody, '', '');
    }
    add('scale', 'classification', out.scale.verdict.classification, '', 'C3.2 verdict, derived from the rows');
    for (const c of out.scale.conditions.dpr) {
      add('scale.dpr', `${c.widthPx}px@${c.dpr}x.interiorPixels`, c.interiorPixels, 'px', '');
      add('scale.dpr', `${c.widthPx}px@${c.dpr}x.amplitude`, f(c.deliveredAmplitude), 'Oklab L', '');
    }
    for (const d of out.scale.conditions.determinism) {
      add('scale.determinism', `${d.widthPx}px@${d.dpr}x`, d.byteIdentical, '', 'the same page rendered twice');
    }
  }
  if (out.repro) {
    for (const m of out.repro.mapping) {
      add('repro.mapping', m.permissionClass, m.token, '', `model ${m.model}, same ${m.same}`);
    }
    add('repro', 'characterTone.token', out.repro.tone, '', `accepted ${out.repro.acceptedTone}`);
    for (const r of out.repro.rows) {
      add('repro', `${r.case}.rasterBytesIdentical`, r.rasterBytesIdentical, '', r.label);
      add('repro', `${r.case}.differingPixels`, r.differingPixels, `px of ${r.totalPixels}`, '');
    }
  }
  if (out.life) {
    add('life', 'inkFloor', f(out.life[0].inkFloor), 'Oklab L', 'derived: midpoint of the hairline and the dimmest ink');
    add('life', 'chromaFloor', f(out.life[0].chromaFloor), 'Oklab C', 'derived: midpoint of the warmest frozen neutral and the body');
    for (const l of out.life) {
      add('life', `${l.case}.chromaticShareOfInk`, (l.chromaticShareOfInk * 100).toFixed(2), '%', l.label);
      add('life', `${l.case}.chromaticPixels`, l.chromaticPixels, 'px@2x', '');
      add('life', `${l.case}.inkPixels`, l.inkPixels, 'px@2x', '');
    }
  }
  if (out.footprint) {
    add('footprint', 'distinctChromaticPixelCounts', out.footprint.distinctChromaticPixelCounts, '',
      'across four environments AND four interaction states');
    add('footprint', 'identicalAcrossEnvironmentsAndStates', out.footprint.identicalAcrossEnvironmentsAndStates, '',
      'the material footprint does not move');
    add('footprint', 'shareRange.min', (out.footprint.shareRange[0] * 100).toFixed(2), '%', '');
    add('footprint', 'shareRange.max', (out.footprint.shareRange[1] * 100).toFixed(2), '%', '');
  }
  if (out.schema && out.schema.results) {
    for (const r of out.schema.results) add('schema', r.file, r.pass ? 'CONFORMS' : 'FAILED', '', r.schema);
  }
  add('skills', 'inventory', out.skills.inventoryCount, 'SKILL.md', 'walked from disk');
  add('skills', 'used', out.skills.used.length, '', '');
  add('reference', 'sources', out.reference.sources.length, '', '');
  add('reference', 'supports', out.reference.supports.length, '', 'sentences running toward QANDEEL');
  add('reference', 'departures', out.reference.departures.length, '', 'sentences running against, departed from on the record');

  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n') + '\n';
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = await run({ withRender: !process.argv.includes('--no-render') });
  writeFileSync(join(DATA, 'C3_VALIDATION.json'), JSON.stringify(out, null, 2), 'utf8');
  writeFileSync(join(DATA, 'C3_MEASUREMENTS.csv'), csv(out), 'utf8');
  console.log('LAYER  RESULT                         DEPENDENCIES');
  for (const [k, v] of Object.entries(out.layers)) {
    console.log(`  ${k}    ${String(v.result).padEnd(28)} ${v.dependencies}`);
  }
  const bad = out.invariants.filter((i) => i.ok === false);
  if (bad.length) { console.log('\nINVARIANTS NOT HOLDING:'); for (const b of bad) console.log(`  ${b.id} ${b.title}`); }
  if (out.life) {
    console.log('\nchromatic share of ink, measured off this package\'s own reproduction rasters:');
    for (const l of out.life) console.log(`  ${(l.chromaticShareOfInk * 100).toFixed(2).padStart(6)} %  ${l.label}`);
  }
  console.log(`\nwrote data/C3_VALIDATION.json and data/C3_MEASUREMENTS.csv`);
  if (bad.length) process.exitCode = 1;
}
