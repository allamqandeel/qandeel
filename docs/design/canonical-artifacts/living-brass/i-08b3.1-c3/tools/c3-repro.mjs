/**
 * I-08B3.1-C3.12 — THE NON-CREATIVE INTEGRATION CHECK.
 *
 * "Use accepted C2 compositions. Do NOT redesign them. Verify the production token mapping
 *  reproduces: Body C, the P2 navigation family, the neutral analytical plane, the unchanged state
 *  carrier, large identity scale behaviour. No new aesthetic comparison."
 *
 * ── THE FORM OF THE PROOF ────────────────────────────────────────────────────────────────────
 *
 * The compositions are not redrawn, re-laid-out or re-authored. They are built by the SEALED C2
 * builders, byte-identical in `vendor/c2/`, from the sealed C2 copy — so the only thing this file
 * contributes is WHERE THE COLOURS COME FROM.
 *
 * Each composition is therefore built TWICE from one builder:
 *
 *   MODEL PATH  — `policyMaterials('P2', …)`, exactly as C2 called it. Constants in a module.
 *   TOKEN PATH  — `tokenMaterials('P2')`, which resolves the DTCG graph and knows no constants: the
 *                 body arrives from `qandeel.navigation.machinery` through its alias chain, the
 *                 neutral from `qandeel.control.functional`, the character tone from the derivation
 *                 rule the token file specifies.
 *
 * Then the two are compared as RASTERS, byte for byte. A byte-identical PNG is the strongest
 * available statement that the token mapping reproduces the accepted evidence: it is insensitive to
 * how either path is written and sensitive to every pixel either path produces. The emitted markup
 * is compared too, with generated ids normalised, because an exact string comparison is
 * unperturbable by composition in a way a raster never is — so the two instruments check each other.
 *
 * ── THE SECOND THING THIS FILE PROVES, WHICH IS NOT OBVIOUS ──────────────────────────────────
 *
 * The two paths decide the CHARACTER by different rules. C2 decided it by SIZE — `material()` emits
 * the character only at 96 rendered pixels or more. C3 decides it by PERMISSION — the character
 * belongs to `qandeel.identity.moment` and to nothing else, because C3_VALIDATION_RESULTS §3
 * measured the size rule and found it is not a capability threshold.
 *
 * If those two rules disagreed anywhere in the accepted compositions, the rasters would differ and
 * this file would fail. They do not disagree, and that agreement is the evidence that replacing a
 * size rule with a permission rule changes nothing anyone has approved — which is the whole basis on
 * which C3 declines to freeze the number.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load, mergeDocs, toCss } from '../vendor/b4r/b4-dtcg.mjs';
import { oklchToSrgbRaw } from '../vendor/c2/color.mjs';
import { createHash } from 'node:crypto';
import { shoot, WORK } from './c3-render.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');
export const PROJECT = join(PKG, '..');
export const PROOF = join(PKG, 'review', 'proof');
if (!existsSync(PROOF)) mkdirSync(PROOF, { recursive: true });

/**
 * WHERE THE SEALED BUILDERS COME FROM, AND WHY NOT FROM `vendor/`.
 *
 * `vendor/c2/` holds exact-byte copies of the C2 tools and is the package's provenance record.
 * Importing the builders FROM there does not work, and the reason is worth stating rather than
 * papering over: `c2-ui.mjs` computes the path to the Arabic font from its own module URL, so a
 * copy living inside this package looks for the font inside this package — where it is not, and
 * where it must never be, because C3 ships no font binary.
 *
 * The obvious workarounds are all worse. Copying the font in would ship a binary the brief forbids
 * and invariant I-18 would fire on it, correctly. Editing the vendored copy would make "vendored"
 * mean "edited", which is the one thing it must not mean.
 *
 * So the proof imports the builders from the SEALED C2 PACKAGE ITSELF, and asserts byte-identity
 * against the vendored copy before it does. That is strictly stronger than importing the copy: the
 * code that produced these rasters is demonstrably the code C2 shipped, and the code C3 ships is
 * demonstrably the same code. If the sealed package is absent, this step reports UNAVAILABLE and
 * says so — it does not fall back to something that would produce a green result from a different
 * input.
 */
const C2_PKG = join(PROJECT, 'I-08B3.1-C2-LIVING-BRASS-PRODUCT-INTEGRATION');
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

export function sealedC2() {
  const files = ['c2-ui.mjs', 'c2-model.mjs', 'c2-render.mjs', 'color.mjs', 'png.mjs'];
  const missing = [], differ = [], verified = [];
  for (const f of files) {
    const sealed = join(C2_PKG, 'tools', f);
    const vendored = join(PKG, 'vendor', 'c2', f);
    if (!existsSync(sealed)) { missing.push(f); continue; }
    const a = sha(sealed), b = sha(vendored);
    if (a !== b) differ.push(`${f}: sealed ${a.slice(0, 12)} vs vendored ${b.slice(0, 12)}`);
    else verified.push({ file: f, sha256: a });
  }
  if (missing.length) {
    return { available: false, why: `the sealed C2 package is not present (${missing.join(', ')})`, verified };
  }
  if (differ.length) {
    throw new Error('THE VENDORED C2 TOOLS ARE NOT THE SEALED ONES — the reproduction proof would be ' +
      `running different code from the code this package ships:\n  ${differ.join('\n  ')}`);
  }
  return { available: true, verified, root: C2_PKG };
}

const SEALED = sealedC2();
if (!SEALED.available) {
  throw new Error(`C3.12 cannot run: ${SEALED.why}. The invariants and the token resolution do not ` +
    'depend on it and run from a bare extraction; this step needs the accepted compositions.');
}

const ui = await import(pathToFileURL(join(C2_PKG, 'tools', 'c2-ui.mjs')).href);
const modelMod = await import(pathToFileURL(join(C2_PKG, 'tools', 'c2-model.mjs')).href);
const { ENV_BUILDERS, policyMaterials, CHARACTER_HEX, blindPage, markSVG } = ui;
const { ENVIRONMENTS } = modelMod;

/* ============================================================ THE TOKEN PATH ============== */

const J = (p) => JSON.parse(readFileSync(join(PKG, p), 'utf8'));

/** Resolve the dark appearance of the combined graph. The only source of colour in this file. */
export function resolveDark() {
  const merged = mergeDocs([
    J('vendor/b4r/semantic.tokens.json'),
    J('tokens/base/material.tokens.json'),
    J('vendor/b4r/dark.tokens.json'),
    J('tokens/appearance/dark.material.tokens.json'),
  ]);
  const r = load(merged, { file: 'dark' });
  if (r.errors.length) throw new Error(`the token graph does not load: ${r.errors.join('; ')}`);
  if (r.unresolved.length) throw new Error(`unresolved in dark: ${r.unresolved.map((u) => u.path.join('.')).join(', ')}`);
  return r;
}

const hexOf = (r, name) => {
  const t = r.resolved.get(name);
  if (!t || t.state !== 'RESOLVED') throw new Error(`token ${name} does not resolve`);
  return toCss(t.resolved).toLowerCase();
};
const numOf = (r, name) => {
  const t = r.resolved.get(name);
  if (!t || t.state !== 'RESOLVED') throw new Error(`token ${name} does not resolve`);
  return t.resolved;
};

/**
 * THE CHARACTER TONE, DERIVED EXACTLY AS THE TOKEN FILE SPECIFIES.
 *
 * `character.derivation` is `authored-oklch`, so the source is the authored triple in the body
 * token's provenance extension and NOT the 8-bit value the token paints with. Invariant I-21 holds
 * that distinction; this function is the place it has consequences. Deriving from the quantised
 * body here would put `#957f60` into the identity moment and every raster below would differ.
 */
export function deriveCharacterTone(r, docs) {
  const rule = r.resolved.get('qandeel.material.living-brass.character.derivationVersion');
  if (!rule || rule.resolved !== 1) {
    throw new Error(`unknown character derivation rule version: ${rule && rule.resolved}`);
  }
  const a = docs.dark.qandeel.expression.material['living-brass'].body
    .$extensions['com.qandeel.provenance'].authoredAs;
  const depth = numOf(r, 'qandeel.material.living-brass.character.amplitude')
    / numOf(r, 'qandeel.material.living-brass.character.toneDepthRatio');
  return '#' + oklchToSrgbRaw([a.L - depth, a.C, a.H])
    .map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('');
}

/**
 * THE PRODUCTION MATERIAL MAPPING — the object a component tree would build from tokens.
 *
 * Shaped to match what the sealed builders consume, and populated ONLY from the resolved graph. It
 * takes no policy argument, and that absence is the point: P2 is not a runtime branch here, it is
 * the alias that `qandeel.navigation.machinery` already carries. There is no code path in this file
 * that could produce a P1 navigation, which is what "the token file IS the coverage policy" means.
 */
export function tokenMaterials() {
  const r = resolveDark();
  const docs = { dark: J('tokens/appearance/dark.material.tokens.json') };
  const tone = deriveCharacterTone(r, docs);
  const flat = (hex) => ({ key: 'TOKEN', bodyHex: hex, characterHex: null, characterOn: false, characterSuppressed: false });
  return {
    policy: 'P2',
    mark:       flat(hexOf(r, 'qandeel.identity.mark')),
    identity:   { key: 'TOKEN', bodyHex: hexOf(r, 'qandeel.identity.moment'), characterHex: tone, characterOn: true, characterSuppressed: false },
    nav:        flat(hexOf(r, 'qandeel.navigation.machinery')),
    functional: flat(hexOf(r, 'qandeel.control.functional')),
    _tone: tone,
    _resolved: r,
  };
}

/* ============================================================== COMPARISON ================ */

/** Generated filter/clip ids differ between builds and do not reach the raster. Normalised out. */
const normalise = (s) => s
  .replace(/\b(id|for)="[^"]*"/g, '$1="X"')
  .replace(/url\(#[^)]*\)/g, 'url(#X)')
  .replace(/\bclip-path="[^"]*"/g, 'clip-path="X"')
  .replace(/\baria-labelledby="[^"]*"/g, 'aria-labelledby="X"')
  .replace(/\bdata-qp-rect="[^"]*"/g, 'data-qp-rect="X"');

const CASES = [
  ...ENVIRONMENTS.map((e) => ({ key: e.key, label: `${e.name} — "${e.nick}"`, kind: 'env' })),
  { key: 'map', label: 'analytical plane, SELECTED state', kind: 'env', state: { selected: 2 } },
  { key: 'map', label: 'analytical plane, PRESSED state', kind: 'env', state: { selected: 0, pressed: 3 } },
  { key: 'map', label: 'analytical plane, FOCUSED state', kind: 'env', state: { selected: 0, focus: 1 } },
  { key: 'map', label: 'analytical plane, DISABLED state', kind: 'env', state: { selected: 0, disabled: 4 } },
  { key: 'identity', label: 'the large identity moment, brushed/handled character', kind: 'identity' },
];

export async function run() {
  const tok = tokenMaterials();
  const mod = policyMaterials('P2', { characterHex: CHARACTER_HEX });

  /* Before a single pixel: do the two mappings agree OBJECT BY OBJECT? A raster comparison that
     passed while these disagreed would mean the difference was invisible, not absent. */
  const mapping = ['mark', 'identity', 'nav', 'functional'].map((k) => ({
    permissionClass: k,
    model: mod[k].bodyHex,
    token: tok[k].bodyHex,
    same: mod[k].bodyHex === tok[k].bodyHex,
    modelCharacter: mod[k].characterHex,
    tokenCharacter: tok[k].characterHex,
    characterSame: mod[k].characterHex === tok[k].characterHex,
    tokenChain: null,
  }));
  for (const m of mapping) {
    const name = { mark: 'qandeel.identity.mark', identity: 'qandeel.identity.moment',
      nav: 'qandeel.navigation.machinery', functional: 'qandeel.control.functional' }[m.permissionClass];
    m.tokenChain = tok._resolved.resolved.get(name).chain.join(' -> ');
  }

  const rows = [];
  let n = 0;
  for (const c of CASES) {
    n++;
    const id = `c${String(n).padStart(2, '0')}-${c.key}`;
    const build = (mats, tag) => (c.kind === 'identity'
      ? `<div class="row" style="justify-content:center;padding:56px 0;">${markSVG(mats.identity, { px: 260 })}</div>`
      : ENV_BUILDERS[c.key]({ mats, id: `${id}-${tag}`, ...(c.state ? { state: c.state } : {}) }));

    const fModel = build(mod, 'model');
    const fToken = build(tok, 'token');

    const width = c.kind === 'identity' ? 420 : 502;
    const html = (f) => blindPage(id, `<div class="board" style="padding:56px 0;">` +
      `<div class="row" style="justify-content:center;gap:0;">${f}</div></div>`, { width });

    const a = await shoot(html(fModel), join(WORK, `${id}-model.png`), `${id}-model`, { width: width + 24, height: 1100, dpr: 2 });
    const b = await shoot(html(fToken), join(PROOF, `${id}-token.png`), `${id}-token`, { width: width + 24, height: 1100, dpr: 2 });

    let differing = 0;
    if (a.img.width === b.img.width && a.img.height === b.img.height) {
      for (let i = 0; i < a.img.rgba.length; i += 4) {
        if (a.img.rgba[i] !== b.img.rgba[i] || a.img.rgba[i + 1] !== b.img.rgba[i + 1]
          || a.img.rgba[i + 2] !== b.img.rgba[i + 2]) differing++;
      }
    } else differing = -1;

    rows.push({
      case: id, label: c.label,
      rasterBytesIdentical: a.buf.equals(b.buf),
      differingPixels: differing,
      totalPixels: a.img.width * a.img.height,
      markupIdentical: normalise(fModel) === normalise(fToken),
      inkFraction: b.inkFraction,
    });
  }

  return { mapping, rows, tone: tok._tone, acceptedTone: CHARACTER_HEX };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = await run();
  console.log('PERMISSION CLASS   model path   token path   same   chain');
  for (const m of out.mapping) {
    console.log(`  ${m.permissionClass.padEnd(16)} ${m.model.padEnd(12)} ${m.token.padEnd(12)} ` +
      `${String(m.same && m.characterSame).padEnd(6)} ${m.tokenChain}`);
  }
  console.log(`\ncharacter tone: token path ${out.tone}, accepted ${out.acceptedTone}, ` +
    `${out.tone === out.acceptedTone ? 'MATCH' : 'DIFFER'}`);
  console.log('\nCASE                 raster bytes   differing px   markup   label');
  for (const r of out.rows) {
    console.log(`  ${r.case.padEnd(18)} ${String(r.rasterBytesIdentical).padEnd(13)} ` +
      `${String(r.differingPixels).padStart(8)} / ${r.totalPixels}  ${String(r.markupIdentical).padEnd(7)} ${r.label}`);
  }
  const bad = out.rows.filter((r) => !r.rasterBytesIdentical || !r.markupIdentical);
  console.log(`\n${out.rows.length - bad.length}/${out.rows.length} compositions reproduced byte-identically from the token graph.`);
  writeFileSync(join(WORK, 'repro.json'), JSON.stringify(out, null, 2), 'utf8');
  if (bad.length) process.exitCode = 1;
}
