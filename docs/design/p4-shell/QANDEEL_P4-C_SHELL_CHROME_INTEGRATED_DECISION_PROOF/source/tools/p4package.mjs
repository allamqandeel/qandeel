// P4-C — seals the package: proves source/ rebuilds prototype/index.html byte-identically, then writes MANIFEST.json
// (every file under the package with bytes and SHA-256) and verifies it by reading every file back.
//   node source/tools/p4package.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { PKG } from './lib/session.mjs';
import { page } from '../src/build.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const posix = (p) => p.split('\\').join('/');
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

const built = page(), onDisk = readFileSync(join(PKG, 'prototype', 'index.html'), 'utf8');
if (built !== onDisk) throw new Error('REFUSING TO SEAL: prototype/index.html is not the byte-identical build of source/');
const files = walk(PKG).map((p) => posix(relative(PKG, p))).filter((p) => p !== 'MANIFEST.json').sort();
const entries = files.map((p) => { const b = readFileSync(join(PKG, ...p.split('/'))); return { path: p, bytes: b.length, sha256: sha(b) }; });
const manifest = { package: 'QANDEEL_P4-C_SHELL_CHROME_INTEGRATED_DECISION_PROOF', status: 'P4-C COMPARATIVE VISUAL DECISION PROOF — READY FOR PRODUCT OWNER + INDEPENDENT REVIEW — P4-DQ-01 … P4-DQ-04 OPEN',
  baseline: '175df7b6f9254d83b82d2b7571c915959fb06a27', prototype: { path: 'prototype/index.html', sha256: sha(Buffer.from(built)), rebuild: 'byte-identical' },
  count: entries.length, bytes: entries.reduce((a, e) => a + e.bytes, 0), files: entries };
writeFileSync(join(PKG, 'MANIFEST.json'), JSON.stringify(manifest, null, 1) + '\n');
// read back and verify
const again = JSON.parse(readFileSync(join(PKG, 'MANIFEST.json'), 'utf8'));
const bad = again.files.filter((e) => sha(readFileSync(join(PKG, ...e.path.split('/')))) !== e.sha256);
const extra = walk(PKG).map((p) => posix(relative(PKG, p))).filter((p) => p !== 'MANIFEST.json' && !again.files.some((e) => e.path === p));
if (bad.length || extra.length) throw new Error(`MANIFEST verification failed: ${JSON.stringify({ bad, extra })}`);
console.log(`MANIFEST.json: ${entries.length} files, ${manifest.bytes} B, verified; prototype ${manifest.prototype.sha256.slice(0, 12)} rebuilds byte-identically`);
