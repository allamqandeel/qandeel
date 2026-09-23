/**
 * I-08B3.0-E3 - verify the shipped zip by decoding boards out of an EXTRACTED copy.
 * The zip writer checks its own central directory; this checks that what comes back out is
 * still a valid image, which is the thing a reviewer actually opens.
 *
 *   node tools/verify-zip.mjs <extracted-root>
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { decode, inkCoverage } from './png.mjs';

const root = process.argv[2];
if (!root) { console.error('usage: node tools/verify-zip.mjs <extracted-root>'); process.exit(1); }
const review = join(root, 'I-08B3.0-E3-TYPOGRAPHY-SYSTEM-PROOF', 'review');

let bad = 0;
for (const f of readdirSync(review).filter((n) => n.endsWith('.png')).sort()) {
  try {
    const img = decode(readFileSync(join(review, f)));
    const { coverage } = inkCoverage(img);
    const ok = coverage >= 0.0008;
    if (!ok) bad++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${f.padEnd(36)} ${img.width}x${img.height}  ink ${(coverage * 100).toFixed(2)}%`);
  } catch (e) { bad++; console.log(`FAIL ${f} - ${e.message}`); }
}
console.log(bad ? `\n${bad} board(s) did not survive the round trip.` : '\nEvery board decodes from the extracted copy.');
process.exit(bad ? 1 : 0);
