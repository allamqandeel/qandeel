// G3.2 packaging — the brief's §17 rebuild proof, then the seal.
//   1. the reviewed build (prototype/index.html) is MOVED aside and its SHA-256 recorded;
//   2. the source tree alone (source/, copied to a clean folder) rebuilds the prototype there;
//   3. the rebuild must be BYTE-IDENTICAL to the reviewed build, and it becomes prototype/index.html;
//   4. the checks run against the rebuilt prototype (exit 0 required);
//   5. MANIFEST.json lists every package file (bytes, SHA-256) and the proofs above;
//   6. the ZIP is written beside the folder (forward-slash names) and read back entry by entry against the folder;
//   7. the ZIP is extracted to a clean folder; EVERY manifest-listed file is verified there; the prototype is rebuilt
//      from the EXTRACTED source — byte-identical.
// usage: node tools/package.mjs   → ../<name>.zip, .zip.sha256, .zip.verify.json, <WORK>/package-result.json
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync, renameSync, existsSync, cpSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { SOURCE, PKG, WORK } from './lib/session.mjs';
import { readZip } from './lib/zipr.mjs';

const require = createRequire(import.meta.url);
const { build: zipBuild } = require('./lib/zipw.cjs');
const NAME = 'I-08B3.1-G3.2-TARGETED-COHERENCE-REFINEMENT';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const node = (args, cwd) => spawnSync(process.execPath, args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, env: process.env });
const R = { steps: [] };
const fail = (m) => { R.failed = m; writeFileSync(join(WORK, 'package-result.json'), JSON.stringify(R, null, 1)); console.error('PACKAGE FAILED: ' + m); process.exit(1); };
function walk(d, out = []) { for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) { const f = join(d, e.name); if (e.isDirectory()) walk(f, out); else out.push(f); } return out; }

/* 1–3: move the reviewed build aside; rebuild from a clean copy of the source alone */
const proto = join(PKG, 'prototype', 'index.html');
const RB = join(WORK, 'rebuild'); rmSync(RB, { recursive: true, force: true }); mkdirSync(RB, { recursive: true });
const reviewed = readFileSync(proto); R.reviewed = { sha256: sha(reviewed), bytes: reviewed.length };
renameSync(proto, join(RB, 'reviewed-index.html'));
cpSync(SOURCE, join(RB, 'source'), { recursive: true });
const b1 = node(['src/build.mjs', join(RB, 'out')], join(RB, 'source'));
if (b1.status !== 0) { renameSync(join(RB, 'reviewed-index.html'), proto); fail('clean rebuild failed: ' + b1.stderr); }
const rebuilt = readFileSync(join(RB, 'out', 'index.html')); R.rebuilt = { sha256: sha(rebuilt), bytes: rebuilt.length, from: 'a clean copy of source/ only' };
R.byteIdentical = R.rebuilt.sha256 === R.reviewed.sha256;
if (!R.byteIdentical) { renameSync(join(RB, 'reviewed-index.html'), proto); fail('rebuild is not byte-identical to the reviewed build'); }
copyFileSync(join(RB, 'out', 'index.html'), proto);
R.steps.push(`reviewed build moved aside (${R.reviewed.sha256}); rebuilt from a clean copy of source/: byte-identical; the rebuilt file is prototype/index.html`);

/* 4: validate the rebuilt prototype */
const ck = node(['tools/checks.mjs'], SOURCE);
R.checksExit = ck.status; R.checksTail = (ck.stdout || '').split('\n').filter(Boolean).slice(-1);
if (ck.status !== 0) fail('checks failed on the rebuilt prototype:\n' + (ck.stdout || '').split('\n').filter((l) => l.startsWith('FAIL')).join('\n'));
R.steps.push('checks re-run against the rebuilt prototype: ' + R.checksTail.join(' / '));

/* 5: the manifest */
const REQUIRED = ['README.md', 'docs/G3.2_CANONICAL_RECONCILIATION.md', 'docs/G3.2_PRODUCT_DECISIONS_PROVED.md', 'docs/G3.2_INTEGRATION_FINDINGS.md', 'docs/G3.2_SKILL_USE.md', 'docs/G3.2_OPEN_QUESTIONS.md',
  'source/REGENERATE.md', 'source/CANON_DEPENDENCIES.json', 'source/src/build.mjs', 'source/src/app.js', 'source/vendor/upstream-g31/G3.1-MANIFEST.json', 'source/tools/pipeline.mjs', 'source/tools/package.mjs', 'source/tools/checks.mjs', 'source/tools/probes.mjs',
  'prototype/index.html', 'data/CHECKS.json', 'data/STATE_MATRIX.json', 'data/LIVECHECK.json', 'data/BOARDS.json', 'data/PROBES.json', 'data/UPSTREAM.json'];
const missing = REQUIRED.filter((f) => !existsSync(join(PKG, f)));
if (missing.length) fail('missing required files: ' + missing.join(', '));
const forbidden = walk(PKG).map((f) => relative(PKG, f).split(sep).join('/')).filter((f) => /node_modules|\.cache|chrome-profile|\.g3\d-work|(^|\/)\.env/i.test(f));
if (forbidden.length) fail('forbidden files in the package: ' + forbidden.join(', '));
const boards = readdirSync(join(PKG, 'boards')).filter((f) => f.endsWith('.png')), clips = readdirSync(join(PKG, 'motion')).filter((f) => f.endsWith('.mp4'));
if (boards.length < 12 || clips.length < 5) fail(`evidence too thin: ${boards.length} boards, ${clips.length} clips`);
const checks = JSON.parse(readFileSync(join(PKG, 'data', 'CHECKS.json'), 'utf8')), live = JSON.parse(readFileSync(join(PKG, 'data', 'LIVECHECK.json'), 'utf8')), probes = JSON.parse(readFileSync(join(PKG, 'data', 'PROBES.json'), 'utf8'));
const deps = JSON.parse(readFileSync(join(SOURCE, 'CANON_DEPENDENCIES.json'), 'utf8')), up = JSON.parse(readFileSync(join(PKG, 'data', 'UPSTREAM.json'), 'utf8'));
const files = walk(PKG).filter((f) => f !== join(PKG, 'MANIFEST.json')).map((f) => { const b = readFileSync(f); return { path: relative(PKG, f).split(sep).join('/'), bytes: b.length, sha256: sha(b) }; });
const manifest = {
  task: 'I-08B3.1-G3.2 — Targeted Coherence Refinement Proof', status: 'READY FOR INDEPENDENT PRODUCT REVIEW — review candidate only; NOT closed, NOT frozen; no canonical amendment written; G3 is not closed',
  baseline: deps.baseline, worldSha256: deps.worldPin,
  upstream: { g31ZipSha256: 'A5D286A888B7B851193AA4C2805C443766284FC45B3521DAAE356677F7E3316E', g31PrototypeRebuiltByteIdentical: up.rebuiltG31.byteIdenticalToReviewedG31, g31PrototypeSha256: up.rebuiltG31.sha256 },
  decisionsUnderProof: ['A — the Analysis shell stays dark with the Living Analysis World under system Light and Dark; other surfaces follow the system', 'B — the concise temporal orientation line stands directly above the Timeline when temporal context exists'],
  prototype: { path: 'prototype/index.html', sha256: R.rebuilt.sha256, bytes: R.rebuilt.bytes, rebuiltFromSource: true, byteIdenticalToReviewedBuild: R.byteIdentical },
  checks: { passed: checks.passed, total: checks.checks }, probes: { rejected: probes.rejected, total: probes.total }, liveRun: { passed: live.passed, total: live.total },
  evidence: { boards: boards.length, motionClips: clips.length }, canonicalDependencies: 'source/CANON_DEPENDENCIES.json',
  selfExcluded: 'MANIFEST.json cannot list its own hash; the ZIP\'s SHA-256 is written beside it as .zip.sha256',
  fileCount: files.length + 1, files,
};
writeFileSync(join(PKG, 'MANIFEST.json'), JSON.stringify(manifest, null, 1));
R.steps.push(`manifest: ${files.length} files + itself`);

/* 6: the ZIP, read back against the folder */
const all = walk(PKG);
const entries = all.map((f) => ({ name: `${NAME}/${relative(PKG, f).split(sep).join('/')}`, data: readFileSync(f), mtime: statSync(f).mtime }));
const zipPath = join(dirname(PKG), `${NAME}.zip`);
const zbuf = zipBuild(entries); writeFileSync(zipPath, zbuf);
const back = readZip(zipPath);
const byName = new Map(entries.map((e) => [e.name, e.data]));
const bad = back.filter((e) => !byName.has(e.name) || !byName.get(e.name).equals(e.data)).map((e) => e.name);
if (back.length !== entries.length || bad.length) fail(`ZIP read-back: ${back.length}/${entries.length} entries, ${bad.length} differ`);
R.zip = { path: zipPath, bytes: zbuf.length, sha256: sha(zbuf), entries: back.length, readBack: 'every entry: name, size, CRC-32 and bytes equal to the folder' };
writeFileSync(zipPath + '.sha256', `${R.zip.sha256}  ${NAME}.zip\n`);

/* 7: extract; verify every manifest-listed file; rebuild from the EXTRACTED source */
const X = join(WORK, 'zipcheck'); rmSync(X, { recursive: true, force: true });
for (const e of back) { const p = join(X, ...e.name.split('/')); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, e.data); }
const xm = JSON.parse(readFileSync(join(X, NAME, 'MANIFEST.json'), 'utf8'));
const xbad = xm.files.filter((f) => { const p = join(X, NAME, ...f.path.split('/')); return !existsSync(p) || sha(readFileSync(p)) !== f.sha256 || statSync(p).size !== f.bytes; }).map((f) => f.path);
R.extractedManifest = { listed: xm.files.length, verified: xm.files.length - xbad.length, differing: xbad };
if (xbad.length) fail('extracted files differ from the manifest: ' + xbad.join(', '));
const b2 = node(['src/build.mjs', join(X, 'rebuilt')], join(X, NAME, 'source'));
const fromZip = existsSync(join(X, 'rebuilt', 'index.html')) ? sha(readFileSync(join(X, 'rebuilt', 'index.html'))) : null;
R.zipRebuild = { exit: b2.status, sha256: fromZip, byteIdentical: fromZip === R.rebuilt.sha256 };
if (!R.zipRebuild.byteIdentical) fail('rebuild from the extracted ZIP is not byte-identical');
writeFileSync(zipPath + '.verify.json', JSON.stringify({ zip: `${NAME}.zip`, sha256: R.zip.sha256, bytes: R.zip.bytes, entries: R.zip.entries, readBack: R.zip.readBack,
  extractedManifest: R.extractedManifest, rebuildFromExtractedZip: R.zipRebuild, reviewedBuild: R.reviewed.sha256 }, null, 1));
R.steps.push(`ZIP ${R.zip.bytes} B, ${R.zip.entries} entries, sha256 ${R.zip.sha256}; read back OK; ${R.extractedManifest.verified}/${R.extractedManifest.listed} manifest files verified after extraction; rebuilt from the extracted ZIP: byte-identical`);
writeFileSync(join(WORK, 'package-result.json'), JSON.stringify(R, null, 1));
console.log(R.steps.join('\n'));
