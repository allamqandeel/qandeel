'use strict';
// I-08B2.5 / png.js
// A real PNG codec (zlib-backed) so that everything measured in this task is
// measured on bytes an actual renderer produced, not on a numerical emulation.
//
//   decode(buf) -> { w, h, data: Uint8ClampedArray RGBA }
//   encodeRGBA(w, h, data) -> Buffer      (colour type 6, with alpha)
//   encodeRGB(w, h, data)  -> Buffer      (colour type 2, NO alpha channel —
//                                          required for iOS / App Store icons)
// Supports 8-bit non-interlaced input of colour types 0, 2, 3, 4 and 6, which
// covers everything Chrome's --screenshot emits.

const zlib = require('zlib');

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function encode(w, h, data, channels) {
  // data is RGBA; `channels` picks how many of them are written out.
  const bpp = channels;
  const raw = Buffer.alloc((w * bpp + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0; // filter type 0 (None): deterministic and plenty small here
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      raw[o++] = data[i];
      raw[o++] = data[i + 1];
      raw[o++] = data[i + 2];
      if (bpp === 4) raw[o++] = data[i + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;                    // bit depth
  ihdr[9] = bpp === 4 ? 6 : 2;    // colour type: 6 = RGBA, 2 = RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const encodeRGBA = (w, h, data) => encode(w, h, data, 4);
const encodeRGB = (w, h, data) => encode(w, h, data, 3);

function decode(buf) {
  if (!buf.slice(0, 8).equals(SIG)) throw new Error('not a PNG');
  let o = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  let palette = null, trns = null;
  const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.slice(o + 4, o + 8).toString('latin1');
    const data = buf.slice(o + 8, o + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; ctype = data[9]; interlace = data[12];
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 8) throw new Error('unsupported bit depth ' + depth);
  if (interlace !== 0) throw new Error('interlaced PNG not supported');
  const CH = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  if (!CH) throw new Error('unsupported colour type ' + ctype);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * CH;
  const px = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const ft = raw[p++];
    const line = raw.slice(p, p + stride); p += stride;
    const cur = px.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.slice((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= CH ? cur[i - CH] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= CH ? prev[i - CH] : 0;
      let v = line[i];
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[i] = v & 0xff;
    }
  }

  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, n = w * h; i < n; i++) {
    const s = i * CH, d = i * 4;
    if (ctype === 6) { out[d] = px[s]; out[d + 1] = px[s + 1]; out[d + 2] = px[s + 2]; out[d + 3] = px[s + 3]; }
    else if (ctype === 2) { out[d] = px[s]; out[d + 1] = px[s + 1]; out[d + 2] = px[s + 2]; out[d + 3] = 255; }
    else if (ctype === 0) { out[d] = out[d + 1] = out[d + 2] = px[s]; out[d + 3] = 255; }
    else if (ctype === 4) { out[d] = out[d + 1] = out[d + 2] = px[s]; out[d + 3] = px[s + 1]; }
    else if (ctype === 3) {
      const k = px[s];
      out[d] = palette[k * 3]; out[d + 1] = palette[k * 3 + 1]; out[d + 2] = palette[k * 3 + 2];
      out[d + 3] = trns && k < trns.length ? trns[k] : 255;
    }
  }
  return { w, h, data: out };
}

module.exports = { decode, encodeRGBA, encodeRGB, crc32 };
