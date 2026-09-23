/**
 * I-08B3.1-F2 — THE VENDORED INPUTS.
 *
 * A DIRECTORY NAME IS NOT PROVENANCE. Every inherited file is copied byte-exact and recorded with
 * the sha256 of the package it came from, and this tool re-checks BOTH ENDS: the bytes published
 * here against the record, and — when the originating package is present beside this one — the
 * source against the same record.
 *
 * `--write` re-vendors from the source packages. Without it the tool only verifies, which is what
 * a bare extraction can do: the source packages are not shipped inside this one, so the source side
 * returns SOURCE-ABSENT rather than failing. **A gate that cannot pass where the package is
 * designed to run is a gate nobody runs.**
 *
 * WHAT IS VENDORED, AND WHY IT IS THE WHOLE RUNNABLE CORE OF I-08B3.1-F1 RATHER THAN ITS NUMBERS.
 * The dark-regression gate re-runs F1's own resolver over F1's own token files and re-renders F1's
 * own scene with F1's own builder. That is only possible if F1's code is here. Quoting F1's values
 * instead would make the gate a comparison between F2's memory of dark and F2's memory of dark.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const ROOT = join(PKG, '..');
const F1 = 'I-08B3.1-F1-ACCESSIBILITY-TRANSFORMATIONS-SEMANTIC-PARITY';

/** Each entry is [source path relative to the project root, published path inside this package]. */
export const PLAN = [
  ...['tools', 'tokens', 'vendor'].map((d) => ({ tree: `${F1}/${d}`, into: `vendor/f1/${d}` })),
  { file: `${F1}/fonts/Estedad[wght].ttf`, into: 'vendor/f1/fonts/Estedad[wght].ttf' },
  { file: `${F1}/fonts/Estedad[wght].ttf`, into: 'fonts/Estedad[wght].ttf' },
  { file: `${F1}/data/F1_VENDOR.json`, into: 'vendor/f1/data/F1_VENDOR.json' },
  { file: `${F1}/data/F1_VALIDATION.json`, into: 'vendor/f1/data/F1_VALIDATION.json' },
  { file: `${F1}/data/F1_SPECTACLE.json`, into: 'vendor/f1/data/F1_SPECTACLE.json' },
  { file: `${F1}/data/F1_PARITY.json`, into: 'vendor/f1/data/F1_PARITY.json' },
  { file: `${F1}/data/F1_SCREEN_READER.json`, into: 'vendor/f1/data/F1_SCREEN_READER.json' },
  /* THE ACCEPTED DARK RASTER — the regression gate's reference, not a decoration. */
  { file: `${F1}/review/src/default.png`, into: 'vendor/f1/review/src/default.png' },
  { file: `${F1}/review/inherit/d2r-reference.png`, into: 'vendor/f1/review/inherit/d2r-reference.png' },
];

const sha = (b) => createHash('sha256').update(b).digest('hex');

function expand() {
  const out = [];
  for (const item of PLAN) {
    if (item.file) { out.push({ source: item.file, published: item.into }); continue; }
    const base = join(ROOT, item.tree);
    if (!existsSync(base)) continue;
    const walk = (rel) => {
      for (const e of readdirSync(join(base, rel), { withFileTypes: true })) {
        const r = rel ? rel + '/' + e.name : e.name;
        if (e.isDirectory()) walk(r);
        else out.push({ source: `${item.tree}/${r}`, published: `${item.into}/${r}` });
      }
    };
    walk('');
  }
  return out;
}

export function verify() {
  const rec = JSON.parse(readFileSync(join(PKG, 'data/F2_VENDOR.json'), 'utf8'));
  return rec.entries.map((e) => {
    const here = join(PKG, e.published);
    const there = join(ROOT, e.source);
    const h = existsSync(here) ? sha(readFileSync(here)) : null;
    const s = existsSync(there) ? sha(readFileSync(there)) : null;
    return {
      published: e.published, expected: e.sha256, here: h, sourcePresent: s !== null,
      state: h !== e.sha256 ? 'FAIL — published bytes differ'
        : s === null ? 'SOURCE-ABSENT'
          : s === e.sha256 ? 'PASS' : 'FAIL — source differs',
    };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--write')) {
    const entries = [];
    for (const { source, published } of expand()) {
      const src = join(ROOT, source);
      if (!existsSync(src)) { console.log('  MISSING SOURCE ' + source); continue; }
      const buf = readFileSync(src);
      const dst = join(PKG, published);
      mkdirSync(dirname(dst), { recursive: true });
      writeFileSync(dst, buf);
      entries.push({ published, source, bytes: buf.length, sha256: sha(buf) });
    }
    mkdirSync(join(PKG, 'data'), { recursive: true });
    writeFileSync(join(PKG, 'data/F2_VENDOR.json'), JSON.stringify({
      note: 'Every inherited file, byte-exact, with the sha256 of the package it came from. A directory name is not provenance. tools/f2-vendor.mjs and tools/f2-resolve.mjs each re-check both ends.',
      generatedBy: 'tools/f2-vendor.mjs',
      entries,
    }, null, 2) + '\n');
    console.log('vendored ' + entries.length + ' files, ' + entries.reduce((a, e) => a + e.bytes, 0).toLocaleString('en-US') + ' bytes');
  }

  const rows = verify();
  const counts = rows.reduce((a, r) => { a[r.state.split(' —')[0]] = (a[r.state.split(' —')[0]] ?? 0) + 1; return a; }, {});
  for (const r of rows.filter((x) => x.state.startsWith('FAIL'))) console.log('  ' + r.state + '  ' + r.published);
  console.log(rows.length + ' vendored files: ' + JSON.stringify(counts));
  if (rows.some((r) => r.state.startsWith('FAIL'))) process.exit(1);
}
