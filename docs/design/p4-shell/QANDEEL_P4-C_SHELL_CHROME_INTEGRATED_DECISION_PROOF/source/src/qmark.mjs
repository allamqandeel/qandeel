// P4-C — the canonical Q, taken from the preserved brand master (vendor/brand/QANDEEL_Q_BASE_MASTER.svg, byte-exact
// from docs/design/canonical-artifacts/brand/i-08b2.5/masters/). Nothing is redrawn: the three path strings are read out
// of the master verbatim and emitted unchanged. Material: `qandeel.identity.mark` (C3 §2A) — the page paints it with the
// token, never with a literal. Never mirrored (a logo: designing-arabic-frontends §6). Never interactive, never a state.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MASTER_PATH = join(HERE, '..', 'vendor', 'brand', 'QANDEEL_Q_BASE_MASTER.svg');
const master = readFileSync(MASTER_PATH, 'utf8');

const pick = (id) => { const m = master.match(new RegExp(`<path id="${id}" d="([^"]+)"`)); if (!m) throw new Error(`Q master has no ${id}`); return m[1]; };
export const Q = {
  viewBox: master.match(/viewBox="([^"]+)"/)[1],
  paths: [pick('q-ring'), pick('q-tail'), pick('q-light-core')],
};
const [, , VW, VH] = Q.viewBox.split(' ').map(Number);
export const Q_ASPECT = VW / VH;

/** The Q at a given height, decorative (the surface around it owns every name). */
export function qSvg({ height = 20, cls = 'qmark', paths = Q.paths } = {}) {
  const width = +(height * Q_ASPECT).toFixed(2);
  return `<svg class="${cls}" width="${width}" height="${height}" viewBox="${Q.viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" fill="currentColor">` +
    paths.map((d) => `<path d="${d}"/>`).join('') + '</svg>';
}

/** Planted defect `redrawnq` only: a Q "by eye" — a plain ring and tail. Never used by the normal build. */
export const Q_BY_EYE = ['M620 0A600 600 0 1 0 620 1200A600 600 0 1 0 620 0Z M620 90A510 510 0 1 1 620 1110A510 510 0 1 1 620 90Z', 'M700 900L1700 1100L1690 1130L690 930Z'];
