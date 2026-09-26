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
writeFileSync(join(SOURCE, 'PROVENANCE.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`vendored ${Object.keys(out.files).length} files from P2-A`);
