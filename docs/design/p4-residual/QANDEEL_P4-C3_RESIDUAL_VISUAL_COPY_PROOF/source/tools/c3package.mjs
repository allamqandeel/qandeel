// P4-C3 — seals the package: proves source/ rebuilds prototype/index.html byte-identically, then writes MANIFEST.json
// (every file under the package with bytes and SHA-256) and verifies it by reading every file back. Adapted from P4-C.
//   node source/tools/c3package.mjs
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
// data/PROVENANCE.json — every consumed byte (source/PROVENANCE.json), what was authored here, and how it regenerates
{
  const src = JSON.parse(readFileSync(join(PKG, 'source', 'PROVENANCE.json'), 'utf8'));
  const authored = walk(join(PKG, 'source')).map((p) => posix(relative(join(PKG, 'source'), p))).filter((p) => !src.files[p] && p !== 'PROVENANCE.json').sort();
  writeFileSync(join(PKG, 'data', 'PROVENANCE.json'), JSON.stringify({ note: 'What P4-C3 consumed byte-exact, what it authored, and how the package regenerates. See docs/P4C3_AUTHORITY_AND_SCOPE.md.',
    consumed: src.files, g32: src.g32, authored,
    regenerate: ['node source/tools/c3vendor.mjs   (only to re-copy frozen material)', 'node source/tools/c3pipeline.mjs [--no-git]'],
    runtime: 'Node 24 (global WebSocket; no npm packages) + Google Chrome headless over the DevTools Protocol. Nothing installed.' }, null, 1) + '\n');
}
const files = walk(PKG).map((p) => posix(relative(PKG, p))).filter((p) => p !== 'MANIFEST.json').sort();
const entries = files.map((p) => { const b = readFileSync(join(PKG, ...p.split('/'))); return { path: p, bytes: b.length, sha256: sha(b) }; });
const manifest = { package: 'QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF', status: 'P4-C3 RESIDUAL VISUAL + COPY PROOF — READY FOR PRODUCT OWNER + INDEPENDENT REVIEW — P4 ACTIVE, NOT CLOSED',
  baseline: '0b2703ef35cbad724078926b645d2d216c860749', prototype: { path: 'prototype/index.html', sha256: sha(Buffer.from(built)), rebuild: 'byte-identical' },
  count: entries.length, bytes: entries.reduce((a, e) => a + e.bytes, 0), files: entries };
writeFileSync(join(PKG, 'MANIFEST.json'), JSON.stringify(manifest, null, 1) + '\n');
const again = JSON.parse(readFileSync(join(PKG, 'MANIFEST.json'), 'utf8'));
const bad = again.files.filter((e) => sha(readFileSync(join(PKG, ...e.path.split('/')))) !== e.sha256);
const extra = walk(PKG).map((p) => posix(relative(PKG, p))).filter((p) => p !== 'MANIFEST.json' && !again.files.some((e) => e.path === p));
if (bad.length || extra.length) throw new Error(`MANIFEST verification failed: ${JSON.stringify({ bad, extra })}`);
console.log(`MANIFEST.json: ${entries.length} files, ${manifest.bytes} B, verified; prototype ${manifest.prototype.sha256.slice(0, 12)} rebuilds byte-identically`);
