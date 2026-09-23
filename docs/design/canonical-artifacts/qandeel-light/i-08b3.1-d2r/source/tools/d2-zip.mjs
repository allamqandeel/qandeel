/**
 * I-08B3.1-D2R — package the archive, then open it again and check it.
 *
 * Windows PowerShell 5.1's `Compress-Archive` writes entry names with BACKSLASH separators.
 * The ZIP appendix specifies forward slashes, so macOS and Linux extractors produce files
 * with literal backslashes in their names instead of directories — and the defect is
 * invisible on the machine that created it, because Windows opens it fine. It also emits
 * directory entries, so the entry count never matches the file count.
 *
 * The writer below is adapted to ESM from I-08B2.5's `source/zipw.js`, which was written for
 * exactly this reason and has shipped several packages in this track.
 *
 * WRITING IT CORRECTLY IS HALF THE JOB. The archive is then re-opened from its own bytes:
 * every entry name is checked for a backslash, the entry count is checked against the file
 * count, and every entry is inflated and its CRC-32 recomputed against the stored value. A
 * package nobody can extract is worse than no package.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep, basename } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..', '..');
const OUT = join(PKG, '..', `${basename(PKG)}.zip`);

/* --------------------------------------------------------------------------- crc32 --- */
const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() / 2)) & 0xffff;
const dosDate = (d) => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;

function build(entries) {
  const locals = [], central = [];
  let offset = 0;
  for (const e of entries) {
    if (e.name.includes('\\')) throw new Error(`d2-zip: entry name must use forward slashes: ${e.name}`);
    const name = Buffer.from(e.name, 'utf8');
    const deflated = deflateRawSync(e.data, { level: 9 });
    const useStore = deflated.length >= e.data.length;   // never make a file bigger
    const body = useStore ? e.data : deflated;
    const method = useStore ? 0 : 8;
    const crc = crc32(e.data);
    const t = dosTime(e.mtime), d = dosDate(e.mtime);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6);        // bit 11: names are UTF-8
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(t, 10); lh.writeUInt16LE(d, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(body.length, 18);
    lh.writeUInt32LE(e.data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, name, body);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(t, 12); ch.writeUInt16LE(d, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(body.length, 20);
    ch.writeUInt32LE(e.data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32); ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36);
    // regular file, 0644. The shift overflows a signed 32-bit int; coerce before writing.
    ch.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);

    offset += lh.length + name.length + body.length;
  }

  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, cd, eocd]);
}

/* ------------------------------------------------------------------------- collect --- */
const files = [];
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = join(d, e.name);
    if (e.isDirectory()) walk(full); else files.push(full);
  }
})(PKG);

const entries = files.map((f) => ({
  name: relative(PKG, f).split(sep).join('/'),
  data: readFileSync(f),
  mtime: statSync(f).mtime,
}));

const buf = build(entries);
writeFileSync(OUT, buf);

/* -------------------------------------------------------------------------- verify --- */
const zip = readFileSync(OUT);
// Read the CENTRAL DIRECTORY, not the local headers: that is what an extractor uses, and a
// package whose two copies of the truth disagree would still open on one tool and not another.
const eocdPos = (() => {
  for (let i = zip.length - 22; i >= 0; i--) if (zip.readUInt32LE(i) === 0x06054b50) return i;
  throw new Error('d2-zip: no end-of-central-directory record');
})();
const count = zip.readUInt16LE(eocdPos + 10);
let p = zip.readUInt32LE(eocdPos + 16);
const problems = [];
const seen = [];
for (let i = 0; i < count; i++) {
  if (zip.readUInt32LE(p) !== 0x02014b50) { problems.push(`central header ${i} is malformed`); break; }
  const method = zip.readUInt16LE(p + 10);
  const crc = zip.readUInt32LE(p + 16);
  const csize = zip.readUInt32LE(p + 20);
  const usize = zip.readUInt32LE(p + 24);
  const nlen = zip.readUInt16LE(p + 28);
  const elen = zip.readUInt16LE(p + 30);
  const clen = zip.readUInt16LE(p + 32);
  const lho = zip.readUInt32LE(p + 42);
  const name = zip.toString('utf8', p + 46, p + 46 + nlen);
  seen.push(name);
  if (name.includes('\\')) problems.push(`backslash in entry name: ${name}`);
  if (name.endsWith('/')) problems.push(`directory entry present: ${name}`);

  const lnlen = zip.readUInt16LE(lho + 26), lelen = zip.readUInt16LE(lho + 28);
  const body = zip.subarray(lho + 30 + lnlen + lelen, lho + 30 + lnlen + lelen + csize);
  const data = method === 0 ? body : inflateRawSync(body);
  if (data.length !== usize) problems.push(`${name}: inflated to ${data.length}, header says ${usize}`);
  else if (crc32(data) !== crc) problems.push(`${name}: CRC mismatch`);
  p += 46 + nlen + elen + clen;
}
if (count !== entries.length) problems.push(`central directory lists ${count}, package has ${entries.length} files`);

const missing = entries.map((e) => e.name).filter((n) => !seen.includes(n));
if (missing.length) problems.push(`not in the archive: ${missing.slice(0, 5).join(', ')}`);

if (problems.length) {
  throw new Error(`d2-zip: the archive is not extractable:\n  ${problems.slice(0, 10).join('\n  ')}`);
}

const sha = createHash('sha256').update(zip).digest('hex');
console.log(JSON.stringify({
  file: OUT,
  bytes: zip.length,
  entries: count,
  filesInPackage: entries.length,
  sha256: sha,
  verified: 'every entry re-inflated and CRC-checked from the central directory; '
    + 'no backslashes, no directory entries',
}, null, 2));
