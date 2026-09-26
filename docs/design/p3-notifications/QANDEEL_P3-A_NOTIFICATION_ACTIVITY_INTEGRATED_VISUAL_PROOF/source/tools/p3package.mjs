// P3-A — seals the package (run after tools/p3pipeline.mjs and after the authored documents are final).
//   1. rebuilds the prototype from source/ into scratch and requires it to be byte-identical to prototype/index.html;
//   2. requires data/CHECKS.json to be all-pass for THIS prototype (its prototypeSha256 must match);
//   3. writes MANIFEST.json: every file of the package (except the manifest itself) with bytes and SHA-256;
//   4. writes the review ZIP OUTSIDE the repository (env P3_ZIP, default E:\QANDEEL\<package>.zip), then reads every
//      entry back and verifies its bytes against the manifest.
//   node source/tools/p3package.mjs
import { readFileSync, writeFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { PKG, SOURCE, WORK } from './lib/session.mjs';
import { readZip } from './lib/zipr.mjs';

const require = createRequire(import.meta.url);
const { zipDir } = require('./lib/zipw.cjs');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const NAME = 'QANDEEL_P3-A_NOTIFICATION_ACTIVITY_INTEGRATED_VISUAL_PROOF';

// 1 — byte-identical rebuild
const scratch = join(WORK, 'rebuild'); rmSync(scratch, { recursive: true, force: true });
execFileSync(process.execPath, [join(SOURCE, 'src', 'build.mjs'), scratch], { encoding: 'utf8' });
const a = sha(readFileSync(join(PKG, 'prototype', 'index.html'))), b = sha(readFileSync(join(scratch, 'index.html')));
if (a !== b) throw new Error(`rebuild differs: ${a} vs ${b}`);

// 2 — the checks must describe this prototype, and pass
const chk = JSON.parse(readFileSync(join(PKG, 'data', 'CHECKS.json'), 'utf8'));
if (chk.prototypeSha256 !== a) throw new Error('data/CHECKS.json was produced for another prototype');
if (chk.pass !== chk.total || chk.plantedRejected !== chk.plantedTotal) throw new Error(`checks not green: ${chk.pass}/${chk.total}, planted ${chk.plantedRejected}/${chk.plantedTotal}`);

// 3 — manifest
const files = [];
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
walk(PKG);
const entries = files.map((f) => relative(PKG, f).split(sep).join('/')).filter((r) => r !== 'MANIFEST.json').sort()
  .map((r) => { const buf = readFileSync(join(PKG, r)); return { path: r, bytes: buf.length, sha256: sha(buf) }; });
const count = (pre) => entries.filter((e) => e.path.startsWith(pre)).length;
const manifest = { package: NAME, status: 'P3-A — VISUAL PROOF / DECISION GATE — READY FOR PRODUCT OWNER + INDEPENDENT REVIEW — P3 is NOT CLOSED / NOT FROZEN — no production runtime',
  baseline: 'b9e087ba366c9df6843b6b880ff5e790f1fde045', prototypeSha256: a, rebuiltByteIdentical: true,
  checks: { pass: chk.pass, total: chk.total, plantedRejected: chk.plantedRejected, plantedTotal: chk.plantedTotal },
  counts: { files: entries.length, boards: count('boards/'), motionClips: entries.filter((e) => e.path.startsWith('motion/') && e.path.endsWith('.mp4')).length, captures: count('captures/'), docs: count('docs/') },
  totalBytes: entries.reduce((s, e) => s + e.bytes, 0), entries };
writeFileSync(join(PKG, 'MANIFEST.json'), JSON.stringify(manifest, null, 1) + '\n');

// 4 — the ZIP, outside the repository, read back entry by entry
const zipPath = process.env.P3_ZIP || join(PKG, '..', '..', '..', '..', '..', `${NAME}.zip`);
const z = zipDir(PKG, zipPath);
const back = readZip(zipPath), byName = new Map(back.map((e) => [e.name, e]));
let verified = 0;
for (const e of entries) { const r = byName.get(e.path); if (!r || sha(r.data) !== e.sha256) throw new Error('zip entry mismatch: ' + e.path); verified++; }
const man = byName.get('MANIFEST.json'); if (!man || sha(man.data) !== sha(readFileSync(join(PKG, 'MANIFEST.json')))) throw new Error('zip MANIFEST.json mismatch');
if (back.some((e) => e.name.includes('\\'))) throw new Error('backslash in a zip entry name');
const zb = readFileSync(zipPath);
console.log(JSON.stringify({ zip: zipPath, bytes: statSync(zipPath).size, sha256: sha(zb).toUpperCase(), zipEntries: z.entries, manifestEntries: entries.length, verified: verified + 1, prototype: a }, null, 1));
