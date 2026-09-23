/**
 * I-08B3.1-E1 — the archive.
 *
 * A zero-dependency store/deflate ZIP writer. ZIP entry names use FORWARD SLASHES on every
 * platform, including this one, which is the trap that has produced an archive that
 * extracts into a single file with backslashes in its name.
 *
 * The build directory, the archive itself and nothing else are excluded. The manifest is
 * regenerated before packing, because a manifest written before the last file changed is
 * a manifest that describes a package that no longer exists.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join, relative, basename } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const NAME = basename(PKG);
const OUT = join(PKG, '..', NAME + '.zip');

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
const crc32 = (buf) => { let c = -1; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };

function collect() {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.name === '.build') continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(p);
    }
  };
  walk(PKG);
  return out.sort();
}

export function zip() {
  const files = collect();
  const parts = [], central = [];
  let offset = 0;
  for (const p of files) {
    // FORWARD SLASHES. A backslash here produces an archive that extracts into one file.
    const name = (NAME + '/' + relative(PKG, p).replace(/\\/g, '/'));
    const nameBuf = Buffer.from(name, 'utf8');
    const data = readFileSync(p);
    const comp = deflateRawSync(data, { level: 9 });
    const useStore = comp.length >= data.length;
    const body = useStore ? data : comp;
    const method = useStore ? 0 : 8;
    const crc = crc32(data);

    const lf = Buffer.alloc(30);
    lf.writeUInt32LE(0x04034b50, 0); lf.writeUInt16LE(20, 4); lf.writeUInt16LE(0x0800, 6);
    lf.writeUInt16LE(method, 8); lf.writeUInt16LE(0, 10); lf.writeUInt16LE(0x21, 12);
    lf.writeUInt32LE(crc, 14); lf.writeUInt32LE(body.length, 18); lf.writeUInt32LE(data.length, 22);
    lf.writeUInt16LE(nameBuf.length, 26); lf.writeUInt16LE(0, 28);
    parts.push(lf, nameBuf, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10); cd.writeUInt16LE(0, 12); cd.writeUInt16LE(0x21, 14);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(body.length, 20); cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += lf.length + nameBuf.length + body.length;
  }
  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16);
  const buf = Buffer.concat([...parts, cdBuf, end]);
  writeFileSync(OUT, buf);
  return { path: OUT, entries: files.length, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = zip();
  console.log('archive  ' + r.path);
  console.log('entries  ' + r.entries);
  console.log('bytes    ' + r.bytes);
  console.log('SHA-256  ' + r.sha256);
}
