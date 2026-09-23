/**
 * I-08B3.1-F1 — ONE RESOLUTION OVER FIVE SYSTEMS, PLUS THE ACCESSIBILITY MODIFIERS.
 *
 * F1 does not create a sixth token system. It extends the chain the project already has —
 * B4R Surface, extended by C3 Living Brass, extended by D2R QANDEEL Light, extended by E1
 * interaction and status — and adds the ACCESSIBILITY TRANSFORMATIONS to the same resolution.
 *
 * That is the only way the claim this package rests on can be CHECKED rather than asserted:
 * "an accessibility setting changes representation and nothing else" is a statement about a
 * graph. It is only a statement about a graph if the accessibility overrides and the things
 * they must not reach are in the same graph.
 *
 * THE MODIFIERS ARE NOT A THIRD APPEARANCE. B4R already declared the shape of this:
 *
 *     "An increased-contrast expression is an OVERRIDE of the appearance it applies to, not a
 *      third appearance — Apple asks for 'light and dark variants, and an increased contrast
 *      option for each variant'. Its values are owned by I-08B3.1-F."
 *
 * F1 fills that declared, empty context for the DARK appearance only. Resolving increased
 * contrast in the LIGHT appearance still fails loudly, because F2 owns it.
 *
 * WHAT THE DEFAULT CONTEXT MUST BE. Every accessibility modifier's default context is the one
 * that overrides NOTHING. `resolveAll()` with no options must therefore return exactly the
 * tree E1 returned, token for token and literal for literal — which is check D-01, and which
 * is the mechanical half of the Default Preservation Gate. An accessibility transformation
 * that leaked into the default would change a literal here and be caught before any raster
 * is drawn.
 */
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');

/** The inherited chain, in resolution order. F1 adds no file before `f1/base`. */
export const INHERITED_FILES = [
  ['b4r/semantic', 'vendor/c3/b4r/semantic.tokens.json'],
  ['b4r/dark', 'vendor/c3/b4r/dark.tokens.json'],
  ['c3/base', 'vendor/c3/tokens/base/material.tokens.json'],
  ['c3/dark', 'vendor/c3/tokens/appearance/dark.material.tokens.json'],
  ['d2r/base', 'vendor/d2r/tokens/base/illumination.tokens.json'],
  ['d2r/dark', 'vendor/d2r/tokens/appearance/dark.illumination.tokens.json'],
  ['e1/base', 'vendor/e1/tokens/base/interaction.tokens.json'],
  ['e1/dark', 'vendor/e1/tokens/appearance/dark.interaction.tokens.json'],
];

/** Authored by F1. The roles; never a literal that an appearance does not own. */
export const F1_BASE = ['f1/base', 'tokens/base/accessibility.tokens.json'];
export const F1_DARK = ['f1/dark', 'tokens/appearance/dark.accessibility.tokens.json'];

/**
 * THE THREE MODIFIERS, and the contexts each one has.
 *
 * `standard` / `full` / `opaque-off` are the DEFAULT contexts and every one of them is
 * deliberately empty. An empty set that is present says "this context overrides nothing" in a
 * way an absent set cannot — B4R's own words, and the reason its standard.tokens.json exists.
 */
export const MODIFIERS = {
  contrast: {
    default: 'standard',
    contexts: {
      standard: ['vendor/c3/b4r/standard.tokens.json'],
      increased: ['tokens/contrast/increased.accessibility.tokens.json'],
    },
  },
  transparency: {
    default: 'full',
    contexts: {
      full: ['tokens/transparency/full.accessibility.tokens.json'],
      reduced: ['tokens/transparency/reduced.accessibility.tokens.json'],
    },
  },
};

function flatten(node, prefix, file, out, groups) {
  for (const key of Object.keys(node)) {
    if (key.startsWith('$')) continue;
    const v = node[key];
    if (!v || typeof v !== 'object') continue;
    const name = prefix ? `${prefix}.${key}` : key;
    if ('$value' in v) {
      const raw = v.$value;
      const value = raw && typeof raw === 'object' && 'hex' in raw ? raw.hex : raw;
      const alpha = raw && typeof raw === 'object' && raw.alpha !== undefined ? raw.alpha : undefined;
      out.set(name, { value, alpha, file, type: v.$type, node: v });
    } else {
      groups.set(name, { file, description: v.$description ?? '', node: v });
    }
    flatten(v, name, file, out, groups);
  }
}

/**
 * Load the tree for one accessibility state.
 *
 * `state` is `{ contrast, transparency }`; anything omitted takes the modifier's default,
 * which overrides nothing. Motion and text are NOT modifiers here and that is deliberate —
 * see tokens/base/accessibility.tokens.json. Neither one resolves to a colour, so putting
 * them in the colour resolver would make the resolver the authority on something it cannot
 * check.
 */
export function loadTokens(state = {}) {
  const files = [...INHERITED_FILES, F1_BASE, F1_DARK];
  const applied = {};
  for (const [name, mod] of Object.entries(MODIFIERS)) {
    const ctx = state[name] ?? mod.default;
    if (!(ctx in mod.contexts)) {
      throw new Error(`f1-resolve: no such ${name} context: ${ctx} (have ${Object.keys(mod.contexts).join(', ')})`);
    }
    applied[name] = ctx;
    for (const rel of mod.contexts[ctx]) files.push([`${name}/${ctx}`, rel]);
  }

  const flat = new Map(), groups = new Map(), sources = [];
  for (const [label, rel] of files) {
    const path = join(PKG, rel);
    if (!existsSync(path)) throw new Error('f1-resolve: missing token file ' + rel);
    const buf = readFileSync(path);
    flatten(JSON.parse(buf.toString('utf8')), '', label, flat, groups);
    sources.push({ label, rel, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') });
  }
  return { flat, groups, sources, applied };
}

const ALIAS = /^\{([^}]+)\}$/;

/** Resolve a name to its literal, returning EVERY HOP. The chain matters as much as the value:
 *  an accessibility override that reached the identity material by its own route would paint
 *  identically and survive any check that only compared colours. */
export function resolve(flat, name, seen = []) {
  if (seen.includes(name)) throw new Error(`f1-resolve: alias cycle at ${name} (${seen.join(' -> ')})`);
  const entry = flat.get(name);
  if (!entry) throw new Error(`f1-resolve: no such token: ${name}`);
  const chain = [...seen, name];
  const m = typeof entry.value === 'string' ? ALIAS.exec(entry.value.trim()) : null;
  if (!m) {
    return {
      value: typeof entry.value === 'string' ? entry.value.toLowerCase() : entry.value,
      alpha: entry.alpha,
      chain,
      file: entry.file,
      type: entry.type,
      node: entry.node,
    };
  }
  const next = resolve(flat, m[1].trim(), chain);
  return { ...next, alpha: entry.alpha !== undefined ? entry.alpha : next.alpha };
}

/**
 * THE NAMES F1 READS. Inherited names first, so that a check can compare the SAME name across
 * accessibility states and see what a transformation did to it.
 */
export const INHERITED_CLASSES = [
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

/** The names F1 authors. Every one of them is a TRANSFORMATION, not a new colour role. */
export const F1_CLASSES = [
  ['A11Y_BOUNDARY', 'qandeel.accessibility.contrast.boundary'],
  ['A11Y_GROUND', 'qandeel.accessibility.contrast.ground'],
  ['A11Y_ATMOSPHERE_INK', 'qandeel.accessibility.contrast.atmosphere-ink'],
  ['A11Y_SCRIM', 'qandeel.accessibility.transparency.scrim'],
  ['A11Y_FIELD', 'qandeel.accessibility.transparency.field'],
];

export const F1_SCALARS = [
  ['ATMOSPHERE_ALPHA', 'qandeel.accessibility.transparency.atmosphere-alpha'],
  ['LIGHT_ALPHA_FLOOR', 'qandeel.accessibility.transparency.light-alpha-floor'],
  ['BOUNDARY_WIDTH', 'qandeel.accessibility.contrast.boundary-width'],
  ['FOCUS_THICKNESS_HC', 'qandeel.accessibility.contrast.focus-thickness'],
  ['FOCUS_THICKNESS', 'qandeel.state.focus.thickness'],
  ['FOCUS_OFFSET', 'qandeel.state.focus.offset'],
  ['SELECTED_WEIGHT', 'qandeel.state.selected.weight'],
  ['REST_WEIGHT', 'qandeel.state.rest.weight'],
  ['PRESSED_PRESENCE', 'qandeel.state.pressed.presence'],
  ['SELECTED_MARKER_THICKNESS', 'qandeel.state.selected.marker-thickness'],
  ['ATMO_L_NEAR', 'qandeel.expression.accessibility.atmosphere.lightness-near'],
  ['ATMO_L_MID', 'qandeel.expression.accessibility.atmosphere.lightness-mid'],
  ['ATMO_L_FAR', 'qandeel.expression.accessibility.atmosphere.lightness-far'],
  ['ATMO_ALPHA_MUL', 'qandeel.expression.accessibility.atmosphere.stroke-alpha-multiplier'],
  ['MOTION_TRAVEL', 'qandeel.accessibility.motion.travel'],
  ['MOTION_BLUR', 'qandeel.accessibility.motion.blur'],
  ['MOTION_SCALE', 'qandeel.accessibility.motion.scale'],
  ['MOTION_PARALLAX_DIFFERENTIAL', 'qandeel.accessibility.motion.parallax-differential'],
  ['MOTION_DECAY', 'qandeel.accessibility.motion.decay'],
  ['MOTION_LEVEL', 'qandeel.accessibility.motion.level'],
  ['MOTION_INK', 'qandeel.accessibility.motion.ink'],
  ['MOTION_DRAW', 'qandeel.accessibility.motion.draw'],
  /* the three PRODUCT-CONTRACT statements I-08B3.1-F1R separated out of implementation values */
  ['MOTION_SEMANTIC_EVENTS_SURVIVE', 'qandeel.accessibility.motion.semantic-events-must-survive'],
  ['PROJECTION_DERIVATION', 'qandeel.accessibility.projection.derivation'],
  /* the two I-08B3.1-F1R2 separated out: the SCOPE of the projection obligation, and its
     DISCLOSURE BOUNDARY. Both were previously carried only by prose. */
  ['PROJECTION_COMPLETENESS', 'qandeel.accessibility.projection.completeness'],
  ['PROJECTION_DISCLOSURE_BOUNDARY', 'qandeel.accessibility.projection.disclosure-boundary'],
  ['TEXT_ARABIC_MUST_NOT_CLIP', 'qandeel.accessibility.text.arabic-must-not-clip'],
  ['TEXT_SELECTED_STEP_RULE', 'qandeel.accessibility.text.selected-step-must-survive-bold'],
  ['TEXT_MAX_SCALE', 'qandeel.accessibility.text.max-scale'],
  ['TEXT_LEADING_FLOOR', 'qandeel.accessibility.text.leading-floor'],
  ['TEXT_LEADING_RATIO', 'qandeel.accessibility.text.leading-ratio'],
  ['TEXT_LABEL_ESCAPE_SCALE', 'qandeel.accessibility.text.label-escape-scale'],
  ['TEXT_BOLD_WEIGHT_DELTA', 'qandeel.accessibility.text.bold-weight-delta'],
];

/** The namespaces nothing F1 authors may ever reach. C3 forbade the first two with invariants
 *  I-04 and I-05; E1 filled the state and status groups and kept it true; F1 adds a third
 *  obligation — an accessibility override may not reach a STATE or STATUS role either, because
 *  "high contrast must not become high importance" is exactly that reachability claim. */
export const FORBIDDEN_TARGETS = [
  'qandeel.identity.material',
  'qandeel.expression.material.living-brass.body',
];
export const FORBIDDEN_PREFIXES = [
  'qandeel.illumination.',
  'qandeel.expression.illumination.',
  'qandeel.state.',
  'qandeel.status.',
];

export function resolveAll(state = {}) {
  const { flat, groups, sources, applied } = loadTokens(state);
  const colour = {}, scalar = {}, f1 = {};
  for (const [role, token] of INHERITED_CLASSES) colour[role] = { token, ...resolve(flat, token) };
  for (const [role, token] of F1_CLASSES) f1[role] = { token, ...resolve(flat, token) };
  for (const [role, token] of F1_SCALARS) scalar[role] = { token, ...resolve(flat, token) };
  return { flat, groups, sources, applied, colour, scalar, f1 };
}

/** Provenance, verified rather than asserted. */
export function verifyVendor() {
  const rec = JSON.parse(readFileSync(join(PKG, 'data/F1_VENDOR.json'), 'utf8'));
  const ROOT = join(PKG, '..');
  return rec.entries.map((e) => {
    const here = join(PKG, e.published);
    const there = join(ROOT, e.source);
    const h = existsSync(here) ? createHash('sha256').update(readFileSync(here)).digest('hex') : null;
    const s = existsSync(there) ? createHash('sha256').update(readFileSync(there)).digest('hex') : null;
    return {
      published: e.published,
      expected: e.sha256,
      here: h,
      source: s,
      sourcePresent: s !== null,
      state: h !== e.sha256 ? 'FAIL — published bytes differ' : s === null ? 'SOURCE-ABSENT' : s === e.sha256 ? 'PASS' : 'FAIL — source differs',
    };
  });
}
