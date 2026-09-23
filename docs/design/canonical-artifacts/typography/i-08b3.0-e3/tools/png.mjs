/**
 * I-08B3.0-E1 - minimal PNG codec (node:zlib only).
 *
 * Needed for two things a browser cannot do for us:
 *   1. SMALL_SIZE_DETAIL: magnifying 12px text must magnify the PIXELS Chrome actually
 *      drew. Re-rendering the vectors at 48px would show a different thing entirely.
 *   2. A blank-render guard - a board that rasterised to nothing must not pass silently.
 */
import { deflateSync, inflateSync } from 'node:zlib';

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
const crc32 = (buf) => { let c = -1; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** @returns {{width:number,height:number,rgba:Buffer}} */
export function decode(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let p = 8, w = 0, h = 0, depth = 0, ctype = 0, idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p); const type = buf.toString('latin1', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (depth !== 8 || (ctype !== 2 && ctype !== 6)) throw new Error(`unsupported PNG depth=${depth} ctype=${ctype}`);
  const ch = ctype === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      line[i] = v & 0xff;
    }
    for (let x = 0; x < w; x++) {
      const s = x * ch, d = (y * w + x) * 4;
      out[d] = line[s]; out[d + 1] = line[s + 1]; out[d + 2] = line[s + 2]; out[d + 3] = ch === 4 ? line[s + 3] : 255;
    }
    prev = line;
  }
  return { width: w, height: h, rgba: out };
}

export function encode({ width, height, rgba }) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const blank = (w, h, [r, g, b]) => {
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = 255; }
  return { width: w, height: h, rgba };
};

export function crop(img, x, y, w, h) {
  const out = Buffer.alloc(w * h * 4);
  for (let j = 0; j < h; j++) {
    const sy = y + j; if (sy < 0 || sy >= img.height) continue;
    img.rgba.copy(out, j * w * 4, (sy * img.width + x) * 4, (sy * img.width + Math.min(x + w, img.width)) * 4);
  }
  return { width: w, height: h, rgba: out };
}

/** Nearest neighbour - deliberately. This must show the pixel grid, not a smooth guess. */
export function upscale(img, f) {
  const w = img.width * f, h = img.height * f, out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy = (y / f) | 0;
    for (let x = 0; x < w; x++) {
      const sx = (x / f) | 0, s = (sy * img.width + sx) * 4, d = (y * w + x) * 4;
      out[d] = img.rgba[s]; out[d + 1] = img.rgba[s + 1]; out[d + 2] = img.rgba[s + 2]; out[d + 3] = 255;
    }
  }
  return { width: w, height: h, rgba: out };
}

export function paste(dst, src, x, y) {
  for (let j = 0; j < src.height; j++) {
    const dy = y + j; if (dy < 0 || dy >= dst.height) continue;
    for (let i = 0; i < src.width; i++) {
      const dx = x + i; if (dx < 0 || dx >= dst.width) continue;
      const s = (j * src.width + i) * 4, d = (dy * dst.width + dx) * 4;
      dst.rgba[d] = src.rgba[s]; dst.rgba[d + 1] = src.rgba[s + 1]; dst.rgba[d + 2] = src.rgba[s + 2]; dst.rgba[d + 3] = 255;
    }
  }
}

/** Fraction of pixels whose luminance sits above the midpoint between ground and peak. */
export function inkCoverage(img, bg = [0x0e, 0x10, 0x13]) {
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const base = lum(...bg);
  let peak = base, n = 0;
  for (let i = 0; i < img.width * img.height; i++) { const l = lum(img.rgba[i * 4], img.rgba[i * 4 + 1], img.rgba[i * 4 + 2]); if (l > peak) peak = l; }
  if (peak - base < 1) return { coverage: 0, peak, base };
  for (let i = 0; i < img.width * img.height; i++) {
    const l = lum(img.rgba[i * 4], img.rgba[i * 4 + 1], img.rgba[i * 4 + 2]);
    if ((l - base) / (peak - base) >= 0.5) n++;   // contour convention: cov = 0.5
  }
  return { coverage: n / (img.width * img.height), peak, base };
}
