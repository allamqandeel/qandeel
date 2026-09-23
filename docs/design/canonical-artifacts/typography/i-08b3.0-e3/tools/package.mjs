/**
 * I-08B3.0-E3 - packaging.
 *
 * The zip is written by hand rather than with PowerShell's Compress-Archive, which emits
 * entry names separated by BACKSLASHES. The ZIP appendix requires forward slashes, so a
 * Compress-Archive archive extracts on macOS and Linux as files with literal backslashes in
 * their names instead of directories - and it looks perfectly fine on Windows, so the defect
 * is invisible from here. A design review package opened on a Mac cannot ship that way.
 *
 *   node tools/package.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { PKG } from './ui.mjs';

// The measurement JSON is written straight into docs/ by measure.mjs and collision.mjs, and
// the authored prose lives in docs/ too - which is safe here only because docs/ is NOT a
// generated tree. Nothing in this package deletes docs/ wholesale.

// ---- crc32 ------------------------------------------------------------------------------
const T = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
const crc32 = (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };

function walk(dir, out = []) {
  for (const n of readdirSync(dir).sort()) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

const ROOT = basename(PKG);
const files = walk(PKG).filter((p) => !p.endsWith('.zip'));

const dosTime = (d) => ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff;
const dosDate = (d) => (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
const now = new Date();

const local = [], central = [];
let offset = 0;

for (const abs of files) {
  // Forward slashes, always. The whole point of writing this by hand.
  const name = `${ROOT}/${relative(PKG, abs).split(/[\\/]/).join('/')}`;
  const nameBuf = Buffer.from(name, 'utf8');
  const data = readFileSync(abs);
  const comp = deflateRawSync(data, { level: 9 });
  const useStore = comp.length >= data.length;
  const body = useStore ? data : comp;
  const method = useStore ? 0 : 8;
  const crc = crc32(data);

  const lh = Buffer.alloc(30);
  lh.writeUInt32LE(0x04034b50, 0);
  lh.writeUInt16LE(20, 4);
  lh.writeUInt16LE(0x0800, 6);          // UTF-8 name flag
  lh.writeUInt16LE(method, 8);
  lh.writeUInt16LE(dosTime(now), 10);
  lh.writeUInt16LE(dosDate(now), 12);
  lh.writeUInt32LE(crc, 14);
  lh.writeUInt32LE(body.length, 18);
  lh.writeUInt32LE(data.length, 22);
  lh.writeUInt16LE(nameBuf.length, 26);
  lh.writeUInt16LE(0, 28);
  local.push(lh, nameBuf, body);

  const ch = Buffer.alloc(46);
  ch.writeUInt32LE(0x02014b50, 0);
  ch.writeUInt16LE(0x031e, 4);          // made by: UNIX, zip 3.0
  ch.writeUInt16LE(20, 6);
  ch.writeUInt16LE(0x0800, 8);
  ch.writeUInt16LE(method, 10);
  ch.writeUInt16LE(dosTime(now), 12);
  ch.writeUInt16LE(dosDate(now), 14);
  ch.writeUInt32LE(crc, 16);
  ch.writeUInt32LE(body.length, 20);
  ch.writeUInt32LE(data.length, 24);
  ch.writeUInt16LE(nameBuf.length, 28);
  ch.writeUInt16LE(0, 30);
  ch.writeUInt16LE(0, 32);
  ch.writeUInt16LE(0, 34);
  ch.writeUInt16LE(0, 36);
  // (0o100644 << 16) overflows a signed 32-bit int; coerce before writing.
  ch.writeUInt32LE((0o100644 << 16) >>> 0, 38);
  ch.writeUInt32LE(offset, 42);
  central.push(ch, nameBuf);

  offset += lh.length + nameBuf.length + body.length;
}

const cdBuf = Buffer.concat(central);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);
eocd.writeUInt16LE(0, 6);
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(cdBuf.length, 12);
eocd.writeUInt32LE(offset, 16);
eocd.writeUInt16LE(0, 20);

const zip = Buffer.concat([...local, cdBuf, eocd]);
const out = join(PKG, '..', 'I-08B3.0-E3-TYPOGRAPHY-SYSTEM-PROOF.zip');
writeFileSync(out, zip);

// ---- verify by re-parsing the central directory of the file just written ----------------
// (Scanning the whole buffer for 0x5C would be meaningless: deflate output contains that
//  byte by chance. Only the entry NAMES matter, so read them back properly.)
const check = readFileSync(out);
const eocdAt = check.length - 22;
const nEntries = check.readUInt16LE(eocdAt + 10);
let p = check.readUInt32LE(eocdAt + 16), backslashes = 0, dirEntries = 0;
const names = [];
for (let i = 0; i < nEntries; i++) {
  if (check.readUInt32LE(p) !== 0x02014b50) throw new Error('central directory corrupt');
  const nl = check.readUInt16LE(p + 28), el = check.readUInt16LE(p + 30), cl = check.readUInt16LE(p + 32);
  const nm = check.toString('utf8', p + 46, p + 46 + nl);
  names.push(nm);
  if (nm.includes('\\')) backslashes++;
  if (nm.endsWith('/')) dirEntries++;
  p += 46 + nl + el + cl;
}
console.log(`${files.length} files -> ${out}`);
console.log(`${(zip.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`central directory entries : ${nEntries} (matches file count: ${nEntries === files.length})`);
console.log(`entry names with backslash: ${backslashes}  ${backslashes === 0 ? '(ok)' : '(BROKEN on macOS/Linux)'}`);
console.log(`directory entries         : ${dirEntries} (files only, as intended)`);
if (backslashes || nEntries !== files.length) process.exit(1);
