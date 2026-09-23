/**
 * Inspection helper: cut a 1:1 region out of a rendered board so it can be examined at
 * true resolution instead of judged from a downscaled whole.
 *   node tools/crop.mjs <board.png> <x> <y> <w> <h> <out.png> [scale]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { decode, encode, crop, upscale } from './png.mjs';

const [, , src, x, y, w, h, out, sc] = process.argv;
const img = decode(readFileSync(src));
let c = crop(img, +x, +y, +w, +h);
if (sc && +sc > 1) c = upscale(c, +sc);
writeFileSync(out, encode(c));
console.log(`${src} ${img.width}x${img.height} -> ${out} ${c.width}x${c.height}`);
