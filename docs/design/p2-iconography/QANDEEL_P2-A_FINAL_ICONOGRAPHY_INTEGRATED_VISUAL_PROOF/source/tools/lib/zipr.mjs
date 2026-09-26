// A minimal ZIP reader for the read-back: end-of-central-directory → central directory → each local header → the
// entry's bytes (stored or inflated), with its CRC-32 and size verified. No ZIP64 (the writer never produces it).
import { readFileSync } from 'node:fs';
import { inflateRawSync, crc32 } from 'node:zlib';

export function readZip(path) {
  const b = readFileSync(path);
  let e = b.length - 22; while (e >= 0 && b.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('no end of central directory');
  const n = b.readUInt16LE(e + 10), cdOff = b.readUInt32LE(e + 16);
  const out = []; let p = cdOff;
  for (let i = 0; i < n; i++) {
    if (b.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central header at ' + p);
    const method = b.readUInt16LE(p + 10), crc = b.readUInt32LE(p + 16), csize = b.readUInt32LE(p + 20), usize = b.readUInt32LE(p + 24);
    const nl = b.readUInt16LE(p + 28), xl = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32), lo = b.readUInt32LE(p + 42);
    const name = b.subarray(p + 46, p + 46 + nl).toString('utf8');
    if (b.readUInt32LE(lo) !== 0x04034b50) throw new Error('bad local header for ' + name);
    const lnl = b.readUInt16LE(lo + 26), lxl = b.readUInt16LE(lo + 28), start = lo + 30 + lnl + lxl;
    const raw = b.subarray(start, start + csize);
    const data = method === 0 ? Buffer.from(raw) : inflateRawSync(raw);
    if (data.length !== usize) throw new Error(`size mismatch ${name}`);
    if ((crc32(data) >>> 0) !== crc) throw new Error(`CRC mismatch ${name}`);
    out.push({ name, data, method });
    p += 46 + nl + xl + cl;
  }
  return out;
}
