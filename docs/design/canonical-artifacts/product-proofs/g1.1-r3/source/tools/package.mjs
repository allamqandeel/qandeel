// G1.1-R3 — assemble the review package and its zip.
//
// Authored prose lives in authored/ and generated evidence in out/; the packager copies both in, so a clean
// rebuild of out/ can never destroy a written document. The zip is written here (forward-slash entry names),
// not by Compress-Archive. The sealed G1.1 and A1 packages are never touched: this writes a NEW directory.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, existsSync, rmSync, mkdtempSync, cpSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deflateRawSync, inflateRawSync, crc32 } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { palette } from '../src/tokens.mjs';
import { JOURNEY, JOURNEY_END, SETTLE_MS, JOBS } from './motion.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORK = join(HERE, '..');
const OUT = join(WORK, 'out');
const NAME = 'I-08B3.1-G1.1-R3-CONSOLIDATED-PRODUCT-CONVERSATION-REPLAY-CORRECTION';
const ROOT = join(WORK, '..', NAME);
const SEALED = [
  ['I-08B3.1-G1.1-PRIMARY-PRODUCT-SHELL-CONVERSATION-NAVIGATION-PROOF.zip', '435a946d5a4932720c95e321c040a2fc14fbe14e52e775a6fb6d8c1c0ba04fac'],
  ['I-08B3.1-G1.1-A1-CONVERSATION-SPEAKER-DIFFERENTIATION-CORRECTION.zip', '0a7cff449a0279455651e0e716d6a2ee9d3c59843a07a82b7257cb0b498b2372'],
];
const sha = (b) => createHash('sha256').update(b).digest('hex');
const sealedState = () => SEALED.map(([f, h]) => { const got = sha(readFileSync(join(WORK, '..', f))); if (got !== h) throw new Error(`sealed package ${f} changed: ${got}`); return `${f} ${h.slice(0, 12)}… unchanged`; });
const sealedBefore = sealedState();

const checks = JSON.parse(readFileSync(join(OUT, 'data', 'G11_R3_CHECKS.json'), 'utf8'));
if (checks.checks.some((c) => !c.ok) || checks.probes.some((p) => !p.rejected)) throw new Error(`checks not green: ${checks.summary.checks} / ${checks.summary.probes} — refusing to package`);

if (existsSync(ROOT)) {
  const readme = join(ROOT, 'README.md');
  if (!existsSync(readme) || !readFileSync(readme, 'utf8').startsWith('# I-08B3.1-G1.1-R3')) throw new Error(`${ROOT} exists and is not an R3 package — refusing to delete it`);
  rmSync(ROOT, { recursive: true, force: true });
}
const TEXT_EXT = new Set(['.md', '.json', '.mjs', '.js', '.html', '.txt', '.ts', '.cjs', '.log']);
const put = (rel, src) => {
  const d = join(ROOT, rel); mkdirSync(dirname(d), { recursive: true });
  if (TEXT_EXT.has(extname(src))) { let s = readFileSync(src, 'utf8'); if (s.charCodeAt(0) === 0xfeff) s = s.slice(1); writeFileSync(d, s.replace(/\r\n/g, '\n')); }
  else copyFileSync(src, d);
};
const write = (rel, data) => { const d = join(ROOT, rel); mkdirSync(dirname(d), { recursive: true }); writeFileSync(d, data); };
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

/* ---------------------------------------------------------------- authored documents */
for (const f of ['README.md', 'G1.1_R3_FINAL_REPORT.md', 'G1.1_R3_SKILL_USAGE_LEDGER_DELTA.md', 'G1.1_R3_B4_RECONCILIATION_NOTE.md']) put(f, join(WORK, 'authored', f));
put('source-notes/SOURCE_TRACE.md', join(WORK, 'authored', 'SOURCE_TRACE.md'));

/* ------------------------------------------------------------------ boards + screens */
for (const f of walk(join(OUT, 'boards')).filter((p) => p.endsWith('.png'))) put(`proof/${relative(join(OUT, 'boards'), f).replace(/\\/g, '/')}`, f);
const CAT = { 'conv-': 'conversation', 'modes-': 'modes', 'replay-': 'replay', 'shared-': 'shared-area', 'light-': 'light', 'a11y-': 'accessibility' };
for (const f of readdirSync(join(OUT, 'screens')).filter((f) => f.endsWith('.png'))) {
  const c = Object.entries(CAT).find(([k]) => f.startsWith(k)); if (!c) throw new Error(`unfiled screen ${f}`);
  put(`proof/${c[1]}/screens/${f}`, join(OUT, 'screens', f));
}

/* -------------------------------------------------------------------------- motion */
for (const j of JOBS) put(`proof/motion/${j.name}.mp4`, join(OUT, 'motion', `${j.name}.mp4`));
const frame = (j, ms) => join(OUT, 'motion', j, `f${String(Math.round((ms / 1000) * 60)).padStart(4, '0')}.png`);
for (const [i, e] of JOURNEY.entries()) for (const j of ['journey-ar-dark', 'journey-ar-dark-reduced-motion']) {
  const tag = j.endsWith('reduced-motion') ? 'reduced-motion' : 'standard';
  put(`proof/motion/frames/${String(i + 1).padStart(2, '0')}-${e.act}-${tag}-settled.png`, frame(j, e.at + SETTLE_MS));
  if (['call', 'leave', 'enter', 'endcall'].includes(e.act)) put(`proof/motion/frames/${String(i + 1).padStart(2, '0')}-${e.act}-${tag}-mid-150ms.png`, frame(j, e.at + 150));
}

/* ----------------------------------------------------------------------- prototype */
for (const f of readdirSync(join(OUT, 'prototype')).filter((f) => f.endsWith('.html'))) put(`prototype/${f}`, join(OUT, 'prototype', f));

/* ---------------------------------------------------------------------------- data */
put('data/G11_R3_CHECKS.json', join(OUT, 'data', 'G11_R3_CHECKS.json'));
put('data/SCREENS.json', join(OUT, 'screens', 'SCREENS.json'));
put('data/WORLD_CROP_PROVENANCE.json', join(OUT, 'world', 'WORLD_CROP_PROVENANCE.json'));
for (const j of JOBS) put(`data/motion/${j.name}.truth.json`, join(OUT, 'motion', `${j.name}.truth.json`));
put('data/motion/ENCODE_LOG.txt', join(OUT, 'motion-run.log'));
const tokenRes = {};
for (const a of ['dark', 'light']) for (const c of ['standard', 'increased']) { const p = palette(a, { contrast: c }); tokenRes[`${a}/${c}`] = { colors: p.colors, alpha: p.alpha, routes: p.routes, numbers: p.numbers }; }
write('data/TOKEN_RESOLUTION.json', JSON.stringify(tokenRes, null, 1));
const DUR = (() => { const m = readFileSync(join(WORK, 'src', 'runtime.js'), 'utf8').match(/var DUR = \{([\s\S]*?)\};/); return Object.fromEntries([...m[1].matchAll(/(\w+):\s*(\d+)/g)].map((x) => [x[1], +x[2]])); })();
write('data/MOTION_JOURNEY.json', JSON.stringify({ fps: 60, endMs: JOURNEY_END, frames: Math.round(JOURNEY_END / 1000 * 60) + 1, settleMs: SETTLE_MS, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', durationsMs: DUR, events: JOURNEY }, null, 1));

/* -------------------------------------------------------------------------- source */
for (const f of ['build.mjs', 'bidi.js', 'tokens.mjs', 'content.mjs', 'glyphs.mjs', 'runtime.js']) put(`source/src/${f}`, join(WORK, 'src', f));
for (const f of ['cdp.mjs', 'screens.mjs', 'motion.mjs', 'boards.mjs', 'checks.mjs', 'package.mjs']) put(`source/tools/${f}`, join(WORK, 'tools', f));
for (const f of walk(join(WORK, 'vendor')).filter((p) => !p.endsWith('zipw.cjs'))) put(`source/vendor/${relative(join(WORK, 'vendor'), f).replace(/\\/g, '/')}`, f);
for (const f of readdirSync(join(OUT, 'world'))) put(`source/out/world/${f}`, join(OUT, 'world', f));
put('source/vendor/Estedad-OFL.txt', join(WORK, '..', 'I-08B3.0-E1-ARABIC-TYPOGRAPHY-COMPARATIVE-PROOF', 'fonts-info', 'licenses', 'estedad-OFL.txt'));
put('source/REGENERATE.md', join(WORK, 'authored', 'REGENERATE.md'));

/* --------------------------------- a bare rebuild from the PACKAGED source reproduces the prototype */
const bare = mkdtempSync(join(tmpdir(), 'g11r3-bare-'));
cpSync(join(ROOT, 'source'), bare, { recursive: true });
const rb = spawnSync(process.execPath, [join(bare, 'src', 'build.mjs')], { cwd: bare, encoding: 'utf8' });
if (rb.status !== 0) throw new Error(`bare rebuild failed: ${rb.stderr}`);
const rebuilt = readdirSync(join(ROOT, 'prototype')).map((f) => { const a = readFileSync(join(ROOT, 'prototype', f)), b = readFileSync(join(bare, 'out', 'prototype', f)); if (sha(a) !== sha(b)) throw new Error(`bare rebuild differs: ${f}`); return f; });
rmSync(bare, { recursive: true, force: true });

/* ----------------------------------------------------------------- text hygiene */
const textFiles = walk(ROOT).filter((p) => TEXT_EXT.has(extname(p)));
if (textFiles.length < 20) throw new Error(`hygiene scan matched only ${textFiles.length} text files`);
const hyg = { files: textFiles.length, bom: [], crlf: [], nul: [], invalidUtf8: [], mojibake: [], secrets: [] };
for (const p of textFiles) {
  const b = readFileSync(p), rel = relative(ROOT, p), s = b.toString('utf8');
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) hyg.bom.push(rel);
  if (b.includes(0x0d)) hyg.crlf.push(rel);
  if (b.includes(0x00)) hyg.nul.push(rel);
  if (s.includes('\uFFFD')) hyg.invalidUtf8.push(rel);
  if (/\u00C3[\u0080-\u00BF]|\u00E2\u20AC/.test(s)) hyg.mojibake.push(rel);
  if (/(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY)/.test(s)) hyg.secrets.push(rel);
}
const hygBad = ['bom', 'crlf', 'nul', 'invalidUtf8', 'mojibake', 'secrets'].filter((k) => hyg[k].length);
if (hygBad.length) throw new Error(`text hygiene failed: ${JSON.stringify(hyg)}`);

/* -------------------------------------------------------------------- manifest */
const files = walk(ROOT).map((p) => ({ path: relative(ROOT, p).replace(/\\/g, '/'), bytes: statSync(p).size, sha256: sha(readFileSync(p)) })).sort((a, b) => a.path.localeCompare(b.path));
write('data/MANIFEST.json', JSON.stringify({ package: NAME, status: 'READY FOR INDEPENDENT PRODUCT / DESIGN REVIEW — not merged, G1.1 not closed, no new Product truth frozen', checks: checks.summary, note: 'A manifest cannot state its own hash; MANIFEST.json is the one file not listed.', hygiene: hyg, files }, null, 1));

/* ------------------------------------------------------------------------- zip */
const entries = walk(ROOT).map((p) => ({ name: `${NAME}/${relative(ROOT, p).replace(/\\/g, '/')}`, data: readFileSync(p) })).sort((a, b) => a.name.localeCompare(b.name));
const STORE = new Set(['.png', '.mp4', '.woff2', '.ttf']);
const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)) & 0xffff;
const dosDate = (d) => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
const now = new Date();
const locals = [], centrals = []; let offset = 0;
for (const e of entries) {
  const nameBuf = Buffer.from(e.name, 'utf8');
  const method = STORE.has(extname(e.name)) ? 0 : 8;
  const body = method === 8 ? deflateRawSync(e.data, { level: 9 }) : e.data;
  const crc = crc32(e.data) >>> 0;
  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(method, 8);
  lh.writeUInt16LE(dosTime(now), 10); lh.writeUInt16LE(dosDate(now), 12); lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(e.data.length, 22); lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
  locals.push(lh, nameBuf, body);
  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(0x031e, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(method, 10);
  ch.writeUInt16LE(dosTime(now), 12); ch.writeUInt16LE(dosDate(now), 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20);
  ch.writeUInt32LE(e.data.length, 24); ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32);
  ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE((0o100644 << 16) >>> 0, 38); ch.writeUInt32LE(offset, 42);
  centrals.push(ch, nameBuf);
  offset += 30 + nameBuf.length + body.length;
}
const cd = Buffer.concat(centrals);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16);
const zipPath = `${ROOT}.zip`;
writeFileSync(zipPath, Buffer.concat([...locals, cd, eocd]));

/* ------------------------------------------------ verify the zip by reading it back */
const z = readFileSync(zipPath);
const eo = z.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
const count = z.readUInt16LE(eo + 10), cdOff = z.readUInt32LE(eo + 16);
let p = cdOff, verified = 0; const backslash = [];
for (let i = 0; i < count; i++) {
  const method = z.readUInt16LE(p + 10), csize = z.readUInt32LE(p + 20), nlen = z.readUInt16LE(p + 28), elen = z.readUInt16LE(p + 30), clen = z.readUInt16LE(p + 32), lo = z.readUInt32LE(p + 42);
  const name = z.toString('utf8', p + 46, p + 46 + nlen);
  if (name.includes('\\')) backslash.push(name);
  const lnlen = z.readUInt16LE(lo + 26), lelen = z.readUInt16LE(lo + 28);
  const data = z.subarray(lo + 30 + lnlen + lelen, lo + 30 + lnlen + lelen + csize);
  const raw = method === 8 ? inflateRawSync(data) : data;
  if (sha(raw) !== sha(readFileSync(join(ROOT, name.slice(NAME.length + 1))))) throw new Error(`zip entry ${name} does not match its source`);
  verified++;
  p += 46 + nlen + elen + clen;
}
if (backslash.length) throw new Error(`backslash entry names: ${backslash.slice(0, 3)}`);
const summary = { package: ROOT, files: entries.length, zip: zipPath, zipBytes: z.length, zipSha256: sha(z), zipEntriesVerified: `${verified}/${count}`,
  checks: checks.summary, bareRebuild: `${rebuilt.length} prototypes byte-identical from the packaged source`, sealed: sealedState(), sealedBefore,
  hygiene: `${hyg.files} text files: 0 BOM, 0 CRLF, 0 NUL, 0 invalid UTF-8, 0 mojibake, 0 secret patterns` };
writeFileSync(join(OUT, 'PACKAGE_SUMMARY.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
