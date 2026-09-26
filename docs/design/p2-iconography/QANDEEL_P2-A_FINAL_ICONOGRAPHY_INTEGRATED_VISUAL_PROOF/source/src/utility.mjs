// P2-A — Layer B, the curated utility family (task §4.1, §12). The glyphs are the libraries' own published drawings,
// vendored as evidence in vendor/utility (tools/vendor-utility.mjs); nothing is installed in apps/mobile.
//
// NORMALISATION (the whole of it): the library's stroke width is replaced by the QANDEEL optical stroke for the render
// size (sig.mjs STROKE), caps and joins stay round, colour stays currentColor. No path is edited. A utility glyph is
// therefore the library's drawing at QANDEEL's weight — which is what a production wrapper would do with a
// `strokeWidth` prop (Hugeicons, Lucide and Tabler all expose one; P2_IMPLEMENTATION_FEASIBILITY.md).
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strokeFor } from './sig.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const UTIL = JSON.parse(readFileSync(join(HERE, '..', 'vendor', 'utility', 'utility-glyphs.json'), 'utf8'));
/** The utility family the proof's Product screens use — the recommendation of P2_UTILITY_LIBRARY_COMPARISON.md. */
export const UTILITY_DEFAULT = 'hugeicons';

/** Inner markup of one library glyph, re-weighted to the QANDEEL optical stroke (`normalise` false = as published). */
export function utilInner(role, { lib = UTILITY_DEFAULT, size = 24, normalise = true } = {}) {
  const L = UTIL.libraries[lib];
  // BACK is the chevron turned to point backwards in a left-to-right reading; the .mirror class turns it again under
  // RTL. A chevron is directional, so it mirrors by MEANING (designing-arabic-frontends §6), never by default.
  const key = role === 'back' ? 'chevron' : role;
  let s = L.glyphs[key].svg;
  const inner = s.slice(s.indexOf('>') + 1, s.lastIndexOf('</svg>'));
  const rootAttrs = s.slice(0, s.indexOf('>'));
  let out = inner;
  if (normalise) {
    const sw = lib === 'phosphor' ? strokeFor(size) * (256 / 24) : strokeFor(size);
    out = out.replace(/stroke-width="[^"]*"/g, `stroke-width="${+sw.toFixed(3)}"`);
    // Libraries that set the stroke on the root <svg> (Lucide, Tabler, Iconoir) are wrapped in a group carrying it.
    if (!/stroke-width=/.test(inner)) out = `<g stroke-width="${+sw.toFixed(3)}">${out}</g>`;
  }
  // carry the root's presentation attributes (fill / stroke / caps) onto a group so the inner paths keep them
  const pres = (rootAttrs.match(/\s(fill|stroke|stroke-linecap|stroke-linejoin|stroke-width)="[^"]*"/g) || [])
    .filter((a) => !(normalise && /stroke-width/.test(a))).join('');
  out = `<g${pres}>${out}</g>`;
  const vb = lib === 'phosphor' ? '0 0 256 256' : '0 0 24 24';
  if (role === 'back') out = `<g transform="translate(${lib === 'phosphor' ? 256 : 24} 0) scale(-1 1)">${out}</g>`;
  return { vb, inner: out };
}

export function utilSvg(role, { lib = UTILITY_DEFAULT, size = 24, cls = '', normalise = true, label = null } = {}) {
  const { vb, inner } = utilInner(role, { lib, size, normalise });
  return `<svg class="${cls}" width="${size}" height="${size}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg"` +
    (label ? ` role="img" aria-label="${label}"` : ' aria-hidden="true" focusable="false"') + `>${inner}</svg>`;
}
