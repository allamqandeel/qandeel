'use strict';
// I-08B2.5 / zipw.js
// A minimal, spec-correct ZIP writer.
//
// Windows PowerShell 5.1's Compress-Archive writes entry names with BACKSLASH
// separators. That is not what the ZIP appendix specifies -- entry names must
// use forward slashes -- and macOS and Linux extractors therefore produce files
// with literal backslashes in their names instead of directories. A brand
// package that reviewers may open on a Mac cannot ship that way, so the archive
// is written here instead.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { crc32 } = require('zlib');   // G2.1: Node's own CRC-32 (Node >= 22). The I-08B2.5 original imported it from a png helper not vendored here; nothing else changed.

function dosTime(d) {
  return ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() / 2)) & 0xffff;
}
function dosDate(d) {
  return (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff;
}

// entries: [{ name: 'a/b.png', data: Buffer, mtime: Date }]
function build(entries) {
  const locals = [];
  const central = [];
  let offset = 0;

  for (const e of entries) {
    if (e.name.includes('\\')) throw new Error('entry name must use forward slashes: ' + e.name);
    const name = Buffer.from(e.name, 'utf8');
    const deflated = zlib.deflateRawSync(e.data, { level: 9 });
    // store rather than deflate when compression does not help
    const useStore = deflated.length >= e.data.length;
    const body = useStore ? e.data : deflated;
    const method = useStore ? 0 : 8;
    const crc = crc32(e.data);
    const t = dosTime(e.mtime), d = dosDate(e.mtime);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);            // version needed
    lh.writeUInt16LE(0x0800, 6);        // flags: bit 11, names are UTF-8
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(t, 10);
    lh.writeUInt16LE(d, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(body.length, 18);
    lh.writeUInt32LE(e.data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, name, body);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);            // version made by
    ch.writeUInt16LE(20, 6);            // version needed
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(t, 12);
    ch.writeUInt16LE(d, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(body.length, 20);
    ch.writeUInt32LE(e.data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt16LE(0, 30);            // extra
    ch.writeUInt16LE(0, 32);            // comment
    ch.writeUInt16LE(0, 34);            // disk
    ch.writeUInt16LE(0, 36);            // internal attrs
    // external attrs: regular file, 0644. The shift overflows a signed 32-bit
    // int, so it is coerced back to unsigned before being written.
    ch.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);

    offset += lh.length + name.length + body.length;
  }

  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, cd, eocd]);
}

// zip a directory tree, entry names relative to `dir`, forward-slashed, sorted
function zipDir(dir, dest) {
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else files.push(full);
    }
  })(dir);

  const entries = files.map(f => ({
    name: path.relative(dir, f).split(path.sep).join('/'),
    data: fs.readFileSync(f),
    mtime: fs.statSync(f).mtime,
  }));
  const buf = build(entries);
  fs.writeFileSync(dest, buf);
  return { entries: entries.length, bytes: buf.length };
}

module.exports = { build, zipDir };
