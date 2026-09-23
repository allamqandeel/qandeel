/**
 * I-08B3.1-A3 - THE FAIRNESS PROOF.
 *
 * A3's fairness contract is stricter than A2's. A2 allowed a thesis seven colour variables;
 * A3 allows a finalist exactly one, `--ink-1`. Everything else - World, diagnostic Subtle,
 * Secondary, Tertiary, diagnostic edge, geometry, DOM, copy, type roles, spacing, direction,
 * viewport, deviceScaleFactor - is shared.
 *
 * That is easy to promise and easy to break by accident: one extra word of Arabic, one
 * different margin, one line that wraps differently, and a reviewer looking at two dark
 * screenshots has no way to catch it. So it is checked mechanically.
 *
 * While each environment renders, the page reports a STRUCTURAL FINGERPRINT: for every element
 * inside the product frame, its tag, its laid-out box in CSS pixels, and the length of its text
 * if it is a leaf. Colour appears nowhere in the fingerprint. Two candidates that differ only
 * in colour must produce byte-identical fingerprints; anything else - a different element
 * count, a box that moved by one pixel, a line that wrapped differently because a string was
 * not actually shared - shows up as a mismatch and fails the run.
 *
 * Fingerprints are grouped by (environment, raster condition) and every candidate in a group
 * is compared against the first. A group is only ever compared with itself, because the two
 * raster conditions lay out at different widths on purpose and are not claimed to be the same
 * composition.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PKG } from './a3-ui.mjs';

const GEO = join(PKG, '..', '.i08b31-a3-work', 'geo.json');

export function checkFairness() {
  if (!existsSync(GEO)) throw new Error('geo.json is missing - run tools/a3-boards.mjs first');
  const geo = JSON.parse(readFileSync(GEO, 'utf8'));

  /** key is `${candidate}:${env}:${cond}` */
  const groups = new Map();
  for (const [k, v] of Object.entries(geo)) {
    const [cand, env, cond] = k.split(':');
    const g = `${env}:${cond}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push({ cand, geo: v });
  }

  const report = [];
  let failed = 0;
  for (const [g, members] of [...groups.entries()].sort()) {
    const [env, cond] = g.split(':');
    members.sort((a, b) => a.cand.localeCompare(b.cand));
    const ref = members[0];
    const refEls = ref.geo.split('|');
    let firstDiff = null;
    for (const m of members.slice(1)) {
      const els = m.geo.split('|');
      if (els.length !== refEls.length) {
        firstDiff = `${ref.cand} has ${refEls.length} elements, ${m.cand} has ${els.length}`;
        break;
      }
      for (let i = 0; i < els.length; i++) {
        if (els[i] !== refEls[i]) {
          firstDiff = `element ${i}: ${ref.cand} "${refEls[i]}"  ${m.cand} "${els[i]}"`;
          break;
        }
      }
      if (firstDiff) break;
    }
    const ok = firstDiff === null;
    if (!ok) failed++;
    report.push({
      env, cond, candidates: members.map((m) => m.cand),
      elements: refEls.length, identical: ok, firstDiff,
    });
  }
  return { report, failed };
}

if (process.argv[1] && process.argv[1].endsWith('a3-fairness.mjs')) {
  const { report, failed } = checkFairness();
  console.log('\nSTRUCTURAL FAIRNESS - the only permitted difference is --ink-1\n');
  for (const r of report) {
    console.log(`  ${r.env.padEnd(7)} ${r.cond.padEnd(7)} ${r.candidates.join(' vs ').padEnd(11)} ` +
      `${String(r.elements).padStart(3)} elements   ` +
      (r.identical ? 'IDENTICAL' : `DIFFERS - ${r.firstDiff}`));
  }
  console.log(failed === 0
    ? '\nPASS - every environment lays out identically for every candidate, in both raster conditions.'
    : `\nFAIL - ${failed} group(s) differ structurally.`);
  process.exit(failed === 0 ? 0 : 1);
}
