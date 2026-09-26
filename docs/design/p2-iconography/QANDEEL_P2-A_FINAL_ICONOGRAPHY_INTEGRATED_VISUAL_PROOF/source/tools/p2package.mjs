// P2-A — seals the package.
//   1. copies the key full-resolution Product captures into captures/ (the boards compose all 63);
//   2. rebuilds the prototype from source/ into a scratch folder and requires it to be byte-identical;
//   3. writes MANIFEST.json: every file of the package (except the manifest itself) with bytes and SHA-256;
//   4. writes the review ZIP OUTSIDE the repository (env P2_ZIP, default E:\QANDEEL\<package>.zip) and reads every entry
//      back, verifying its bytes against the manifest.
//   node tools/p2package.mjs
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { PKG, SOURCE, WORK } from './lib/session.mjs';
import { readZip } from './lib/zipr.mjs';

const require = createRequire(import.meta.url);
const { zipDir } = require('./lib/zipw.cjs');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const NAME = 'QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF';

// 1 — the key captures (the recommended system through the states a reviewer will want at full resolution)
export const KEY = ['rec-follow', 'rec-pinned14', 'rec-pinnedLH', 'rec-scrub', 'rec-returnlive', 'rec-call-live', 'rec-call-pinned', 'rec-conv-call', 'en-call-pinned', 's320-call-pinned-ar', 'light-conv-call-ar'];
const cap = join(PKG, 'captures'); rmSync(cap, { recursive: true, force: true }); mkdirSync(cap, { recursive: true });
for (const id of KEY) copyFileSync(join(WORK, 'shots', id + '.png'), join(cap, id + '.png'));

// 2 — byte-identical rebuild
const scratch = join(WORK, 'rebuild'); rmSync(scratch, { recursive: true, force: true });
execFileSync(process.execPath, [join(SOURCE, 'src', 'build.mjs'), scratch], { encoding: 'utf8' });
const a = sha(readFileSync(join(PKG, 'prototype', 'index.html'))), b = sha(readFileSync(join(scratch, 'index.html')));
if (a !== b) throw new Error(`rebuild differs: ${a} vs ${b}`);

// 3 — manifest
const files = [];
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
walk(PKG);
const entries = files.map((f) => relative(PKG, f).split(sep).join('/')).filter((r) => r !== 'MANIFEST.json').sort()
  .map((r) => { const buf = readFileSync(join(PKG, r)); return { path: r, bytes: buf.length, sha256: sha(buf) }; });
const count = (pre) => entries.filter((e) => e.path.startsWith(pre)).length;
const manifest = { package: NAME, status: 'P2-A — VISUAL PROOF / DECISION GATE — RECOMMENDED FOR PRODUCT OWNER REVIEW — NOT FROZEN (P2 is not closed)',
  prototypeSha256: a, rebuiltByteIdentical: true, counts: { files: entries.length, boards: count('boards/'), motionClips: count('motion/'), captures: count('captures/'), docs: count('docs/') },
  totalBytes: entries.reduce((s, e) => s + e.bytes, 0), entries };
writeFileSync(join(PKG, 'MANIFEST.json'), JSON.stringify(manifest, null, 1) + '\n');

// 4 — the ZIP, outside the repository, read back
const zipPath = process.env.P2_ZIP || join(PKG, '..', '..', '..', '..', '..', `${NAME}.zip`);
const z = zipDir(PKG, zipPath);
const back = readZip(zipPath), byName = new Map(back.map((e) => [e.name, e]));
let verified = 0;
for (const e of entries) { const r = byName.get(e.path); if (!r || sha(r.data) !== e.sha256) throw new Error('zip entry mismatch: ' + e.path); verified++; }
const zb = readFileSync(zipPath);
console.log(JSON.stringify({ zip: zipPath, bytes: statSync(zipPath).size, sha256: sha(zb).toUpperCase(), zipEntries: z.entries, manifestEntries: entries.length, verified, prototype: a }, null, 1));
