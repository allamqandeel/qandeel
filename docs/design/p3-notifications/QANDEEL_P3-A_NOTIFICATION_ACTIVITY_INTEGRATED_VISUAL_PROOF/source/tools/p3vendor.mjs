// P3-A — vendors the frozen P2 material this proof consumes, BYTE-FOR-BYTE, from the merged P2-A package on main.
//
// P3 must use the final P2 icon system (P3-A task §19, §20) and must not fork it. So the P2 generators are copied, never
// edited: sig.mjs (N1 geometry), utility.mjs (+ the vendored Hugeicons Free drawings and their MIT notice), machines.mjs
// (Call Rail A, END_GLYPH_PX = 27) and tokens.mjs (+ the frozen token tree), with the Estedad v8.5 face and the four small
// capture helpers. Every copy is recorded in source/PROVENANCE.json with its P2-A path, bytes and SHA-256, and
// tools/p3checks.mjs re-verifies those bytes on every run.
//
//   node source/tools/p3vendor.mjs            (run from anywhere; paths are resolved from this file)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = resolve(HERE, '..');
const REPO = resolve(SOURCE, '..', '..', '..', '..', '..');
const P2 = join(REPO, 'docs', 'design', 'p2-iconography', 'QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF', 'source');
const sha = (b) => createHash('sha256').update(b).digest('hex');

const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

const COPIES = [
  ['src/sig.mjs', 'src/sig.mjs'],
  ['src/utility.mjs', 'src/utility.mjs'],
  ['src/machines.mjs', 'src/machines.mjs'],
  ['src/tokens.mjs', 'src/tokens.mjs'],
  ['vendor/fonts/Estedad-wght-v8.5.woff2', 'vendor/fonts/Estedad-wght-v8.5.woff2'],
  ['vendor/fonts/Estedad-OFL.txt', 'vendor/fonts/Estedad-OFL.txt'],
  ['vendor/utility/utility-glyphs.json', 'vendor/utility/utility-glyphs.json'],
  ...readdirSync(join(P2, 'vendor', 'utility')).filter((f) => f.startsWith('LICENSE-')).map((f) => [`vendor/utility/${f}`, `vendor/utility/${f}`]),
  ...walk(join(P2, 'vendor', 'tokens')).map((p) => { const r = relative(P2, p).split('\\').join('/'); return [r, r]; }),
  ['tools/lib/cdp.mjs', 'tools/lib/cdp.mjs'],
  ['tools/lib/server.mjs', 'tools/lib/server.mjs'],
  ['tools/lib/zipw.cjs', 'tools/lib/zipw.cjs'],
  ['tools/lib/zipr.mjs', 'tools/lib/zipr.mjs'],
];

const out = { note: 'Byte-exact copies of merged P2-A material (main, P2 CLOSED / FROZEN by PR #274). Never edited here; re-verified by tools/p3checks.mjs.', from: 'docs/design/p2-iconography/QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF/source', files: {} };
for (const [from, to] of COPIES) {
  const buf = readFileSync(join(P2, from));
  const dst = join(SOURCE, to);
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, buf);
  out.files[to] = { from, bytes: buf.length, sha256: sha(buf) };
}
// P3-A refinement §4.2 / §8: the Analysis is G3's, frozen. The proof shows it by running G3.2's OWN reviewed prototype —
// the canonical artifact preserved byte-exact under docs/design/canonical-artifacts (G3 closure §K: sha 10611f35…83d71) —
// copied unchanged next to the P3 page (prototype/g3.2/index.html) and loaded in a frame. P3 draws only ON TOP of it (the
// call-safe strip) and never inside it, so the Analysis composition cannot drift.
const G32_FROM = 'docs/design/canonical-artifacts/product-proofs/g3/g3.2/prototype/index.html', G32_TO = 'prototype/g3.2/index.html';
const g32 = readFileSync(join(REPO, ...G32_FROM.split('/')));
mkdirSync(join(SOURCE, '..', 'prototype', 'g3.2'), { recursive: true });
writeFileSync(join(SOURCE, '..', ...G32_TO.split('/')), g32);
out.g32 = { note: 'G3.2 reviewed prototype, byte-exact (G3 CLOSED / FROZEN). Loaded unchanged in a frame for the Analysis surface; never edited.', from: G32_FROM, to: G32_TO, bytes: g32.length, sha256: sha(g32) };
writeFileSync(join(SOURCE, 'PROVENANCE.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`vendored ${Object.keys(out.files).length} files from P2-A + G3.2 prototype ${sha(g32).slice(0, 8)}`);
