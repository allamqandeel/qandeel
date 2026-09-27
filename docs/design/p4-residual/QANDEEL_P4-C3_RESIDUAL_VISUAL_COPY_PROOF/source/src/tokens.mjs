// G1.1 — resolve every colour the shell paints FROM THE FROZEN TOKEN TREE, never from prose.
//
// Lesson carried from I-08B3.1-D0R (memory: resolve-chrome-from-the-token-tree-not-the-outcome-record):
// a downstream package that copies its colours out of a predecessor's report inherits whatever was
// true when the report was written. So the vendored token files are merged, aliases are resolved
// here at build time, and the build REFUSES to emit when a resolved literal disagrees with the value
// the G1.1 brief states as frozen (§6). Both the value and the alias ROUTE are returned.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// G3.1: the token tree is vendored INSIDE this source tree (source/vendor/tokens), byte-identical to the canonical
// preserved set on main (product-proofs/g1.2/source/vendor/tokens) — checked by tools/checks.mjs.
const TOKENS = join(HERE, '..', 'vendor', 'tokens');

const load = (dir) => readdirSync(join(TOKENS, dir)).filter((f) => f.endsWith('.json')).sort()
  .map((f) => ({ file: `${dir}/${f}`, json: JSON.parse(readFileSync(join(TOKENS, dir, f), 'utf8')) }));

/** Flatten a DTCG tree to { 'a.b.c': {value, file} } — later files override earlier ones. */
function flatten(tree, file, out, prefix = '') {
  if (tree === null || typeof tree !== 'object') return;
  if ('$value' in tree) { out[prefix] = { value: tree.$value, file }; }
  for (const [k, v] of Object.entries(tree)) {
    if (k.startsWith('$')) continue;
    flatten(v, file, out, prefix ? `${prefix}.${k}` : k);
  }
}

function resolveAll(sets) {
  const flat = {};
  for (const { file, json } of sets) flatten(json, file, flat);
  const route = (path, seen = []) => {
    const e = flat[path];
    if (!e) throw new Error(`unresolved token ${path} (route ${seen.join(' → ')})`);
    if (seen.includes(path)) throw new Error(`alias cycle at ${path}`);
    const v = e.value;
    if (typeof v === 'string' && /^\{[^}]+\}$/.test(v)) return route(v.slice(1, -1), [...seen, path]);
    return { value: v, route: [...seen, path], file: e.file };
  };
  return { flat, route };
}

export function resolveAppearance(appearance, { contrast = 'standard' } = {}) {
  const sets = [...load('base'), ...load(appearance)];
  if (contrast === 'increased') {
    sets.push(...load('contrast').filter((s) => s.file.includes(appearance === 'dark' ? 'f1.dark' : 'f2.light')));
  }
  return resolveAll(sets);
}

const hexOf = (v) => (typeof v === 'object' && v && v.hex ? v.hex.toLowerCase() : null);
const alphaOf = (v) => (typeof v === 'object' && v && typeof v.alpha === 'number' ? v.alpha : 1);

/** The roles the G1.1 shell paints, by SEMANTIC name. Nothing below is a literal. */
const ROLE_PATHS = {
  world: 'qandeel.world.fill',
  surface: 'qandeel.role.apparatus.fill',
  field: 'qandeel.role.field.fill',
  // G1.2: the reader's committed turn is the canonical UTTERANCE role (G1.1 closure §3). It resolves through
  // qandeel.role.utterance.fill → qandeel.surface.functional — the ONE functional Surface tone. No new colour.
  functional: 'qandeel.role.utterance.fill',
  primary: 'qandeel.content.primary',
  secondary: 'qandeel.content.secondary',
  tertiary: 'qandeel.content.tertiary',
  scrim: 'qandeel.role.passage.scrim',
  brass: 'qandeel.navigation.machinery',
  mark: 'qandeel.identity.mark',
  lightCore: 'qandeel.expression.illumination.core',
  lightMid: 'qandeel.expression.illumination.mid',
  lightLow: 'qandeel.expression.illumination.low',
  error: 'qandeel.status.error.ink',
  disabled: 'qandeel.state.disabled.ink',
  restInk: 'qandeel.state.rest.ink',
  pressedInk: 'qandeel.state.pressed.ink',
  focusIndicator: 'qandeel.state.focus.indicator',
  focusCompanion: 'qandeel.state.focus.companion',
  selectedInk: 'qandeel.state.selected.ink',
  selectedMarker: 'qandeel.state.selected.marker',
};
const NUM_PATHS = {
  restWeight: 'qandeel.state.rest.weight',
  selectedWeight: 'qandeel.state.selected.weight',
  pressedPresence: 'qandeel.state.pressed.presence',
  focusThickness: 'qandeel.state.focus.thickness',
  focusCompanionThickness: 'qandeel.state.focus.companion-thickness',
  focusOffset: 'qandeel.state.focus.offset',
  markerThickness: 'qandeel.state.selected.marker-thickness',
};

/** The literals the brief (§6) states as frozen. The build asserts the tree agrees. */
export const BRIEF_FROZEN = {
  dark: { world: '#101010', surface: '#181818', primary: '#d8d5ca', secondary: '#afaca3', tertiary: '#8b8982', brass: '#a58e6f', error: '#fe907e' },
  light: { world: '#efeeeb', surface: '#e7e6e3', brass: '#7a6446', error: '#ad4739', lightCore: '#fff6df', lightMid: '#ddd4be', lightLow: '#bcb39e' },
};

export function palette(appearance, opts = {}) {
  const { route } = resolveAppearance(appearance, opts);
  const out = { appearance, contrast: opts.contrast ?? 'standard', colors: {}, alpha: {}, routes: {}, numbers: {} };
  for (const [role, path] of Object.entries(ROLE_PATHS)) {
    const r = route(path);
    const hex = hexOf(r.value);
    if (!hex) throw new Error(`${path} did not resolve to a colour: ${JSON.stringify(r.value)}`);
    out.colors[role] = hex;
    out.alpha[role] = alphaOf(r.value);
    out.routes[role] = r.route;
  }
  for (const [k, path] of Object.entries(NUM_PATHS)) {
    const r = route(path); const v = r.value;
    out.numbers[k] = typeof v === 'object' && v !== null && 'value' in v ? v.value : v;
  }
  if (out.contrast === 'standard') {
    for (const [role, hex] of Object.entries(BRIEF_FROZEN[appearance])) {
      if (out.colors[role] !== hex) throw new Error(`FROZEN VALUE DISAGREES: ${appearance}.${role} resolved ${out.colors[role]} via ${out.routes[role].join(' → ')}, brief says ${hex}`);
    }
  }
  // Brass must reach the material through ONE semantic identity (C3 invariant I-03): the nav family
  // and the mark both route through qandeel.identity.material, never by a path of their own.
  for (const role of ['brass', 'mark']) {
    if (!out.routes[role].includes('qandeel.identity.material')) throw new Error(`${role} does not route through qandeel.identity.material: ${out.routes[role].join(' → ')}`);
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const a of ['dark', 'light']) for (const c of ['standard', 'increased']) {
    const p = palette(a, { contrast: c });
    console.log(`\n== ${a} / ${c}`);
    for (const [k, v] of Object.entries(p.colors)) console.log(`${k.padEnd(16)} ${v}${p.alpha[k] !== 1 ? ` α${p.alpha[k]}` : ''}   ${p.routes[k].join(' → ')}`);
    console.log(JSON.stringify(p.numbers));
  }
}
