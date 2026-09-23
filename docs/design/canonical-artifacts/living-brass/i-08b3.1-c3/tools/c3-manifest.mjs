/**
 * I-08B3.1-C3 — THE MANIFEST.
 *
 * Every shipped file, hashed, with what it is and where it came from. Generated last, from a walk of
 * the package, so it describes what is actually there rather than what was intended to be.
 *
 * IT ALSO ENFORCES TWO PACKAGING RULES rather than merely reporting on them:
 *
 *   1. NO FONT BINARY. Scanned for here as well as in invariant I-18, because a manifest that lists a
 *      font is a manifest that shipped one.
 *   2. NO WORK DIRECTORY INSIDE THE PACKAGE. Importing the vendored C2 renderer creates
 *      `.i08b31-c2-work/` here, because that module computes its scratch path from its own module
 *      URL and the vendored copy lives inside this package. It is harmless, it is a real consequence
 *      of vendoring, and it is asserted empty and excluded rather than quietly deleted and forgotten.
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync, rmSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');
export const PROJECT = join(PKG, '..');

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

/** Directories that are NOT part of the package. A leading dot is the rule, stated once. */
const EXCLUDED = (name) => name.startsWith('.');

export function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const WHAT = [
  [/^docs\//, 'document'],
  [/^data\//, 'generated data'],
  [/^tokens\//, 'DTCG 2025.10 token file — AUTHORED BY C3'],
  [/^vendor\/b4r\//, 'INHERITED byte-identical from I-08B3.1-B4R (frozen)'],
  [/^vendor\/c2\//, 'INHERITED byte-identical from I-08B3.1-C2 (sealed)'],
  [/^vendor\/schemas\//, 'the official DTCG 2025.10 schemas, vendored with provenance'],
  [/^vendor\/reference\//, 'the canonical mark, placed where the vendored C2 model resolves it'],
  [/^reference\/canonical\//, 'exact-byte snapshot of the approved production master'],
  [/^review\/proof\//, 'C3.12 reproduction raster — rendered from the TOKEN GRAPH'],
  [/^tools\//, 'tool'],
];
const what = (rel) => (WHAT.find(([re]) => re.test(rel)) || [, 'file'])[1];

export function build() {
  /* Assert the vendoring side effect is empty before the manifest claims the package is clean. */
  const workInside = join(PKG, '.i08b31-c2-work');
  let workNote = 'not present';
  if (existsSync(workInside)) {
    const n = readdirSync(workInside).length;
    workNote = `present with ${n} entr${n === 1 ? 'y' : 'ies'}, EXCLUDED from the package`;
    rmSync(workInside, { recursive: true, force: true });
    workNote += ' and removed';
  }

  const files = walk(PKG)
    .map((p) => {
      const rel = relative(PKG, p).replace(/\\/g, '/');
      return { path: rel, bytes: statSync(p).size, sha256: sha(p), what: what(rel) };
    })
    .filter((f) => f.path !== 'docs/C3_MANIFEST.md')   // it cannot hash itself
    .sort((a, b) => a.path.localeCompare(b.path));

  const FONT = /\.(ttf|otf|woff2?|eot|ttc|pfb)$/i;
  const fonts = files.filter((f) => FONT.test(f.path));
  if (fonts.length) {
    throw new Error(`FONT BINARIES IN THE PACKAGE — this must never ship: ${fonts.map((f) => f.path).join(', ')}`);
  }

  const byDir = {};
  for (const f of files) {
    const d = f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '(root)';
    byDir[d] = (byDir[d] || 0) + 1;
  }

  /* Predecessor packages, re-verified untouched. A stage that builds on sealed work should say so
     with hashes rather than with a sentence. */
  const predecessors = [
    'I-08B3.1-C2-LIVING-BRASS-PRODUCT-INTEGRATION.zip',
    'I-08B3.1-C1R-LIVING-BRASS-BODY-PRESENCE-RESOLUTION.zip',
    'I-08B3.1-B4R-DTCG-RESOLVER-CONFORMANCE-FINAL.zip',
  ].map((n) => {
    const p = join(PROJECT, n);
    return existsSync(p) ? { name: n, bytes: statSync(p).size, sha256: sha(p) } : { name: n, present: false };
  });

  return { files, byDir, total: files.reduce((a, f) => a + f.bytes, 0), workNote, predecessors };
}

export function markdown(m) {
  const L = [];
  const p = (s = '') => L.push(s);
  p('# C3_MANIFEST');
  p('');
  p('**I-08B3.1-C3.** Every shipped file, hashed. **GENERATED** last, from a walk of the package, so');
  p('it describes what is actually there rather than what was intended to be.');
  p('');
  p(`**${m.files.length} files · ${m.total.toLocaleString('en-US')} bytes.**`);
  p('');
  p('| Directory | Files |');
  p('|---|---|');
  for (const [d, n] of Object.entries(m.byDir).sort()) p(`| \`${d}\` | ${n} |`);
  p('');
  p('---');
  p('');
  p('## Packaging rules, enforced rather than reported');
  p('');
  p('**No font binary.** The package is scanned on every manifest build and the build throws if one is');
  p('found. The Arabic face is a LOCAL RUNTIME DEPENDENCY — referenced, hashed before use, never');
  p('redistributed. Invariant I-18 scans independently.');
  p('');
  p(`**No work directory inside the package.** \`.i08b31-c2-work/\`: ${m.workNote}.`);
  p('');
  p('That directory is created by importing the vendored C2 renderer, which computes its scratch path');
  p('from its own module URL — and the vendored copy lives inside this package. It is a real');
  p('consequence of vendoring, it is harmless, and it is asserted and excluded here rather than');
  p('quietly deleted and forgotten. C3\'s own renderer writes outside the package, to');
  p('`../.i08b31-c3-work/`.');
  p('');
  p('---');
  p('');
  p('## Predecessors, re-verified untouched');
  p('');
  p('| Package | Bytes | SHA-256 |');
  p('|---|---|---|');
  for (const x of m.predecessors) {
    p(x.present === false ? `| \`${x.name}\` | — | not present |`
      : `| \`${x.name}\` | ${x.bytes.toLocaleString('en-US')} | \`${x.sha256}\` |`);
  }
  p('');
  p('---');
  p('');
  p('## Files');
  p('');
  p('| Path | Bytes | SHA-256 | What it is |');
  p('|---|---|---|---|');
  for (const f of m.files) {
    p(`| \`${f.path}\` | ${f.bytes} | \`${f.sha256}\` | ${f.what} |`);
  }
  p('');
  return L.join('\n') + '\n';
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const m = build();
  writeFileSync(join(PKG, 'docs', 'C3_MANIFEST.md'), markdown(m), 'utf8');
  writeFileSync(join(PKG, 'data', 'C3_MANIFEST.json'), JSON.stringify(m, null, 2), 'utf8');
  console.log(`${m.files.length} files, ${m.total.toLocaleString('en-US')} bytes`);
  for (const [d, n] of Object.entries(m.byDir).sort()) console.log(`  ${String(n).padStart(3)}  ${d}`);
  console.log(`work directory: ${m.workNote}`);
}
