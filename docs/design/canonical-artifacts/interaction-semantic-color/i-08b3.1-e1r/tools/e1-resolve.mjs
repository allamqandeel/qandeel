/**
 * I-08B3.1-E1 — ONE RESOLUTION OVER FOUR SYSTEMS.
 *
 * E1 does not create a fifth token system. It extends the chain the project already
 * has — I-08B3.1-B4R Surface, extended by C3 Living Brass, extended by D2R QANDEEL
 * Light — and adds interaction state and status to the same resolution.
 *
 * That is the only way the claim this whole package rests on can be CHECKED rather
 * than asserted: "a state or status name never reaches the identity material, and
 * never reaches the Light" is a statement about a graph, and it is only a statement
 * about a graph if both are in the same graph.
 *
 * The inherited files are vendored exact-byte with their sha256 recorded in
 * data/E1_VENDOR.json, and `verifyVendor()` re-checks them against the sealed
 * packages rather than trusting a directory name.
 *
 * DTCG ALIASING ONLY, deliberately. `{a.b.c}` means "this token IS that token".
 * No modifier, no computed value, no local override — every one of those is a way
 * for a call site to hold a colour the token tree does not know about.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');

/** Resolution order. Later files may add to a group; none of them may rewrite a value
 *  another one owns, which invariant I-02 checks by name rather than by convention. */
export const TOKEN_FILES = [
  ['b4r/semantic', join(PKG, 'vendor/c3/b4r/semantic.tokens.json')],
  ['b4r/dark', join(PKG, 'vendor/c3/b4r/dark.tokens.json')],
  ['c3/base', join(PKG, 'vendor/c3/tokens/base/material.tokens.json')],
  ['c3/dark', join(PKG, 'vendor/c3/tokens/appearance/dark.material.tokens.json')],
  ['d2r/base', join(PKG, 'vendor/d2r/tokens/base/illumination.tokens.json')],
  ['d2r/dark', join(PKG, 'vendor/d2r/tokens/appearance/dark.illumination.tokens.json')],
  ['e1/base', join(PKG, 'tokens/base/interaction.tokens.json')],
  ['e1/dark', join(PKG, 'tokens/appearance/dark.interaction.tokens.json')],
];

function flatten(node, prefix, file, out, groups) {
  for (const key of Object.keys(node)) {
    if (key.startsWith('$')) continue;
    const v = node[key];
    if (!v || typeof v !== 'object') continue;
    const name = prefix ? `${prefix}.${key}` : key;
    if ('$value' in v) {
      const raw = v.$value;
      const value = (raw && typeof raw === 'object' && 'hex' in raw) ? raw.hex : raw;
      out.set(name, { value, file, type: v.$type, node: v });
    } else {
      groups.set(name, { file, description: v.$description ?? '', node: v });
    }
    flatten(v, name, file, out, groups);
  }
}

export function loadTokens(files = TOKEN_FILES) {
  const flat = new Map(), groups = new Map(), sources = [];
  for (const [label, path] of files) {
    if (!existsSync(path)) throw new Error('e1-resolve: missing token file ' + path);
    const text = readFileSync(path, 'utf8');
    flatten(JSON.parse(text), '', label, flat, groups);
    sources.push({ label, path, bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(readFileSync(path)).digest('hex') });
  }
  return { flat, groups, sources };
}

const ALIAS = /^\{([^}]+)\}$/;

/** Resolve a name to its literal, returning EVERY HOP. The chain matters as much as the
 *  value: a state token that reached the identity material by its own route would paint
 *  identically and survive any check that only compared colours. */
export function resolve(flat, name, seen = []) {
  if (seen.includes(name)) throw new Error(`e1-resolve: alias cycle at ${name} (${seen.join(' -> ')})`);
  const entry = flat.get(name);
  if (!entry) throw new Error(`e1-resolve: no such token: ${name}`);
  const chain = [...seen, name];
  const m = typeof entry.value === 'string' ? ALIAS.exec(entry.value.trim()) : null;
  if (!m) return { value: typeof entry.value === 'string' ? entry.value.toLowerCase() : entry.value, chain, file: entry.file, type: entry.type, node: entry.node };
  return resolve(flat, m[1].trim(), chain);
}

/** The names the E1 proof asks for. This list is not a token file and must never become
 *  one: everything about their values and their routes comes from the resolved tree. */
export const E1_CLASSES = [
  ['WORLD', 'qandeel.world.fill'],
  ['SURFACE', 'qandeel.surface.functional'],
  ['PRIMARY', 'qandeel.content.primary'],
  ['SECONDARY', 'qandeel.content.secondary'],
  ['TERTIARY', 'qandeel.content.tertiary'],
  ['BRASS', 'qandeel.identity.material'],
  ['MARK', 'qandeel.identity.mark'],
  ['NAV', 'qandeel.navigation.machinery'],
  ['CONTROL', 'qandeel.control.functional'],
  ['LIGHT_CORE', 'qandeel.illumination.core'],
  ['LIGHT_MID', 'qandeel.illumination.mid'],
  ['LIGHT_LOW', 'qandeel.illumination.low'],
  ['REST_INK', 'qandeel.state.rest.ink'],
  ['PRESSED_INK', 'qandeel.state.pressed.ink'],
  ['FOCUS_INDICATOR', 'qandeel.state.focus.indicator'],
  ['FOCUS_COMPANION', 'qandeel.state.focus.companion'],
  ['SELECTED_INK', 'qandeel.state.selected.ink'],
  ['SELECTED_MARKER', 'qandeel.state.selected.marker'],
  ['DISABLED_INK', 'qandeel.state.disabled.ink'],
  ['ERROR_INK', 'qandeel.status.error.ink'],
  ['WARNING_INK', 'qandeel.status.warning.ink'],
  ['SUCCESS_INK', 'qandeel.status.success.ink'],
  ['INFORMATIONAL_INK', 'qandeel.status.informational.ink'],
];

export const E1_SCALARS = [
  ['PRESSED_PRESENCE', 'qandeel.state.pressed.presence'],
  ['FOCUS_THICKNESS', 'qandeel.state.focus.thickness'],
  ['FOCUS_COMPANION_THICKNESS', 'qandeel.state.focus.companion-thickness'],
  ['FOCUS_OFFSET', 'qandeel.state.focus.offset'],
  ['SELECTED_MARKER_THICKNESS', 'qandeel.state.selected.marker-thickness'],
  ['REST_WEIGHT', 'qandeel.state.rest.weight'],
  ['SELECTED_WEIGHT', 'qandeel.state.selected.weight'],
];

/** The two namespaces nothing E1 authors may ever reach. C3 forbade it with invariants
 *  I-04 and I-05 while the groups were empty; E1 fills them and must keep it true. */
export const FORBIDDEN_TARGETS = ['qandeel.identity.material', 'qandeel.expression.material.living-brass.body'];
export const FORBIDDEN_PREFIXES = ['qandeel.illumination.', 'qandeel.expression.illumination.'];

export function resolveAll() {
  const { flat, groups, sources } = loadTokens();
  const colour = {}, scalar = {};
  for (const [role, token] of E1_CLASSES) colour[role] = { token, ...resolve(flat, token) };
  for (const [role, token] of E1_SCALARS) scalar[role] = { token, ...resolve(flat, token) };
  return { flat, groups, sources, colour, scalar };
}

/** Provenance, verified rather than asserted: every vendored file is re-hashed against
 *  the sealed package it came from. A directory name is not evidence. */
export function verifyVendor() {
  const rec = JSON.parse(readFileSync(join(PKG, 'data/E1_VENDOR.json'), 'utf8'));
  const ROOT = join(PKG, '..');
  return rec.entries.map((e) => {
    const here = join(PKG, e.published);
    const there = join(ROOT, e.source);
    const h = existsSync(here) ? createHash('sha256').update(readFileSync(here)).digest('hex') : null;
    const s = existsSync(there) ? createHash('sha256').update(readFileSync(there)).digest('hex') : null;
    return { published: e.published, expected: e.sha256, here: h, source: s,
      pass: h === e.sha256 && (s === null ? 'source-absent' : s === e.sha256) === true || (h === e.sha256 && s === e.sha256),
      sourcePresent: s !== null };
  });
}
