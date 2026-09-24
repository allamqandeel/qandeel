// G3.2 — the G3.1 baseline, reproduced from this source tree. G3.1 is immutable upstream evidence; G3.2 does not
// carry a second copy of its 1.3 MB prototype (with its inlined fonts). Instead:
//   1. the three G3.1 build inputs G3.2 changes are vendored in vendor/upstream-g31/src/, with G3.1's own MANIFEST;
//   2. each equals the hash that manifest records for it, and every file G3.2 shares with G3.1 unchanged (the other
//      src files and the whole vendor tree) equals it too;
//   3. G3.1's build is re-run from those inputs over this tree's vendor/ — and must reproduce G3.1's reviewed
//      prototype BYTE-IDENTICALLY (the SHA-256 in G3.1's MANIFEST);
//   4. if the sealed G3.1 ZIP sits beside this package, its SHA-256 is checked against the reviewed identity and its
//      MANIFEST entry against the vendored copy.
// usage: node tools/upstream.mjs   → <WORK>/upstream-g31/prototype/index.html and <PKG>/data/UPSTREAM.json (exit 1 on any mismatch)
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { SOURCE, PKG, WORK } from './lib/session.mjs';
import { readZip } from './lib/zipr.mjs';

export const G31_ZIP_SHA = 'a5d286a888b7b851193aa4c2805c443766284fc45b3521daae356677f7e3316e';
export const G31_NAME = 'I-08B3.1-G3.1-INTEGRATED-END-TO-END-PRODUCT-PROOF';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const U = join(SOURCE, 'vendor', 'upstream-g31');
const man = JSON.parse(readFileSync(join(U, 'G3.1-MANIFEST.json'), 'utf8'));
const rec = (p) => man.files.find((f) => f.path === p);
const R = { g31Manifest: { sha256: sha(readFileSync(join(U, 'G3.1-MANIFEST.json'))), prototype: man.prototype.sha256 }, vendoredInputs: [], sharedUnchanged: [], problems: [] };

/* 2 — the vendored inputs, and the files G3.2 shares with G3.1 unchanged */
for (const f of ['app.js', 'build.mjs', 'content.mjs']) {
  const got = sha(readFileSync(join(U, 'src', f))), want = rec(`source/src/${f}`);
  R.vendoredInputs.push({ file: `vendor/upstream-g31/src/${f}`, sha256: got, g31Manifest: want && want.sha256, equal: !!want && want.sha256 === got });
}
const shared = man.files.filter((f) => f.path.startsWith('source/vendor/') || ['source/src/bidi.js', 'source/src/bridge.js', 'source/src/glyphs.mjs', 'source/src/tokens.mjs'].includes(f.path));
for (const f of shared) {
  const p = join(SOURCE, ...f.path.split('/').slice(1));
  const got = existsSync(p) ? sha(readFileSync(p)) : null;
  if (got !== f.sha256) R.sharedUnchanged.push({ path: f.path, differs: true });
}
R.sharedFilesChecked = shared.length;
for (const v of R.vendoredInputs) if (!v.equal) R.problems.push('vendored input differs from G3.1 MANIFEST: ' + v.file);
if (R.sharedUnchanged.length) R.problems.push('shared files differ from G3.1: ' + R.sharedUnchanged.map((x) => x.path).join(', '));

/* 3 — rebuild G3.1 from its own inputs over this vendor tree */
const T = join(WORK, 'upstream-g31'); rmSync(T, { recursive: true, force: true }); mkdirSync(join(T, 'source', 'src'), { recursive: true });
cpSync(join(SOURCE, 'vendor'), join(T, 'source', 'vendor'), { recursive: true });
for (const f of ['bidi.js', 'bridge.js', 'glyphs.mjs', 'tokens.mjs']) copyFileSync(join(SOURCE, 'src', f), join(T, 'source', 'src', f));
for (const f of ['app.js', 'build.mjs', 'content.mjs']) copyFileSync(join(U, 'src', f), join(T, 'source', 'src', f));
const b = spawnSync(process.execPath, ['src/build.mjs', join(T, 'prototype')], { cwd: join(T, 'source'), encoding: 'utf8' });
const out = existsSync(join(T, 'prototype', 'index.html')) ? readFileSync(join(T, 'prototype', 'index.html')) : null;
R.rebuiltG31 = { exit: b.status, sha256: out ? sha(out) : null, bytes: out ? out.length : 0, byteIdenticalToReviewedG31: !!out && sha(out) === man.prototype.sha256 };
if (!R.rebuiltG31.byteIdenticalToReviewedG31) R.problems.push('G3.1 did not rebuild byte-identically: ' + (b.stderr || R.rebuiltG31.sha256));

/* 4 — the sealed G3.1 ZIP, when present beside this package */
const zp = join(dirname(PKG), `${G31_NAME}.zip`);
if (existsSync(zp)) {
  const zb = readFileSync(zp), zs = sha(zb);
  const entry = readZip(zp).find((e) => e.name === `${G31_NAME}/data/MANIFEST.json`);
  R.g31Zip = { path: `../${G31_NAME}.zip`, bytes: zb.length, sha256: zs, equalsReviewedIdentity: zs === G31_ZIP_SHA, manifestEntryEqualsVendored: !!entry && sha(entry.data) === R.g31Manifest.sha256 };
  if (!R.g31Zip.equalsReviewedIdentity || !R.g31Zip.manifestEntryEqualsVendored) R.problems.push('the G3.1 ZIP beside the package is not the reviewed one');
} else R.g31Zip = { present: false, note: 'the sealed G3.1 ZIP is not beside this package; the vendored MANIFEST and the byte-identical rebuild still bind the baseline' };

mkdirSync(join(PKG, 'data'), { recursive: true });
writeFileSync(join(PKG, 'data', 'UPSTREAM.json'), JSON.stringify(R, null, 1));
console.log(R.problems.length ? 'UPSTREAM PROBLEMS\n' + R.problems.join('\n') : `G3.1 reproduced byte-identically (${R.rebuiltG31.sha256}); ${R.sharedFilesChecked} shared files unchanged; ZIP ${R.g31Zip.sha256 || 'absent'}`);
process.exit(R.problems.length ? 1 : 0);
