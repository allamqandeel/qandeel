/**
 * I-08B3.1-F2 — ONE RESOLUTION, TWO APPEARANCES, AND NO SECOND PALETTE.
 *
 * ================================================================================================
 * THE ARCHITECTURE WAS ALREADY THERE, AND FINDING THAT OUT IS HALF OF PART J.
 *
 * §26 of the brief asks for "semantic role -> appearance projection -> accessibility
 * transformation" rather than "a dark token system plus an unrelated light one". That is not a
 * structure F2 invented: it is the structure I-08B3.1-B4R shipped, before a light appearance was
 * on anyone's list. Its semantic file says so in as many words — "appearance-independent: it
 * names what things ARE, never what they look like. Colours live in the expression layer that an
 * appearance set supplies" — and B4R, C3 and D2R each carry an `appearance` modifier whose
 * `light` context is an EMPTY SET, authored as a deliberate absence with an owner named on it.
 *
 * So F2 adds no semantic name. It fills four declared-empty contexts and extends the resolution
 * by exactly one modifier the chain did not have: `appearance`. Everything else — which Product
 * role reaches which expression value, which accessibility override re-points which class — is
 * inherited and untouched.
 *
 * WHY THE WHOLE APPEARANCE-DEPENDENT SURFACE OF QANDEEL IS TWELVE VALUES. Resolve the frozen dark
 * chain and count the literals an appearance owns: World, Surface, three reading inks, the scrim,
 * Living Brass, three Light stops, Error, Disabled. Everything else in the system — every Product
 * Surface role, every interaction state, every status ink, the identity mark, the navigation
 * machinery, the analysis node and relation — is an ALIAS. That is why a second appearance is
 * twelve derivations rather than a second design system, and it is why cross-appearance semantic
 * parity is structural rather than maintained: the roles cannot diverge, because there is only
 * one set of them.
 *
 * ================================================================================================
 * WHAT THE DEFAULT MUST BE, AND WHY THE DARK-REGRESSION GATE LIVES IN THIS FILE'S SHAPE
 *
 * `resolveAll()` with no options must return EXACTLY the tree I-08B3.1-F1 returns, token for
 * token and literal for literal. Not "the same values" — the same tree, produced by loading the
 * same files in the same order. F2's light sets are appended only when the appearance modifier
 * selects them, so a light value that leaked into the default would change a literal here and be
 * caught by check D-01 before any raster is drawn. tools/f2-regression.mjs then goes further and
 * re-runs F1's OWN resolver and F1's OWN scene builder, because a gate that only compares F2
 * against F2 is a gate against nothing.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');
const F1 = join(PKG, 'vendor', 'f1');

/**
 * The inherited chain, in resolution order, read out of the vendored I-08B3.1-F1 package.
 * APPEARANCE-INDEPENDENT SETS ONLY: every dark expression file has moved into the appearance
 * modifier below, which is the one structural change F2 makes to the chain.
 */
export const BASE_FILES = [
  ['b4r/semantic', 'vendor/f1/vendor/c3/b4r/semantic.tokens.json'],
  ['c3/base', 'vendor/f1/vendor/c3/tokens/base/material.tokens.json'],
  ['d2r/base', 'vendor/f1/vendor/d2r/tokens/base/illumination.tokens.json'],
  ['e1/base', 'vendor/f1/vendor/e1/tokens/base/interaction.tokens.json'],
  ['f1/base', 'vendor/f1/tokens/base/accessibility.tokens.json'],
  /* F2's own semantic layer: the appearance LAW. Not one entry in it is a colour. */
  ['f2/base', 'tokens/base/appearance.tokens.json'],
];

/**
 * THE APPEARANCE MODIFIER. Its `dark` context is the four frozen expression sets, byte-exact and
 * in the order F1 loaded them. Its `light` context is F2's five.
 *
 * The DEFAULT IS DARK, and that is inherited rather than chosen: QANDEEL is dark-led and not
 * dark-locked, and every one of the frozen resolvers already defaults to dark. F2 does not get to
 * change which appearance is canonical by adding the other one.
 */
export const MODIFIERS = {
  appearance: {
    default: 'dark',
    contexts: {
      dark: [
        'vendor/f1/vendor/c3/b4r/dark.tokens.json',
        'vendor/f1/vendor/c3/tokens/appearance/dark.material.tokens.json',
        'vendor/f1/vendor/d2r/tokens/appearance/dark.illumination.tokens.json',
        'vendor/f1/vendor/e1/tokens/appearance/dark.interaction.tokens.json',
        'vendor/f1/tokens/appearance/dark.accessibility.tokens.json',
        /* ONE NAME, NO VALUE MOVED. The meaning-light technique never had to be named while
           there was only one; a second appearance makes the choice between two a Product fact
           that belongs in the tree rather than in a renderer's `if`. */
        'tokens/appearance/dark/f2.dark.illumination-technique.tokens.json',
      ],
      light: [
        'tokens/appearance/light/b4r.light.tokens.json',
        'tokens/appearance/light/c3.light.material.tokens.json',
        'tokens/appearance/light/d2r.light.illumination.tokens.json',
        'tokens/appearance/light/e1.light.interaction.tokens.json',
        'tokens/appearance/light/f1.light.accessibility.tokens.json',
      ],
    },
  },
  /**
   * THE ACCESSIBILITY MODIFIERS ARE PER-APPEARANCE, AND THE SPLIT IS SMALLER THAN IT LOOKS.
   * I-08B3.1-F1's increased-contrast file re-points two ALIASES — the analytical relation and the
   * functional control ink, one rung up the frozen reading ramp — and thickens the focus
   * perimeter, which is a dimension. All three are appearance-independent and all three are
   * loaded for BOTH appearances. Only the three atmosphere lightnesses and the opaque scrim
   * literal are appearance-bound, and those are what the light files carry.
   */
  contrast: {
    default: 'standard',
    contexts: {
      standard: { dark: ['vendor/f1/vendor/c3/b4r/standard.tokens.json'], light: ['vendor/f1/vendor/c3/b4r/standard.tokens.json'] },
      increased: {
        dark: ['vendor/f1/tokens/contrast/increased.accessibility.tokens.json'],
        light: ['vendor/f1/tokens/contrast/increased.accessibility.tokens.json', 'tokens/contrast/light.increased.tokens.json'],
      },
    },
  },
  transparency: {
    default: 'full',
    contexts: {
      full: { dark: ['vendor/f1/tokens/transparency/full.accessibility.tokens.json'], light: ['vendor/f1/tokens/transparency/full.accessibility.tokens.json'] },
      reduced: {
        dark: ['vendor/f1/tokens/transparency/reduced.accessibility.tokens.json'],
        light: ['vendor/f1/tokens/transparency/reduced.accessibility.tokens.json', 'tokens/transparency/light.reduced.tokens.json'],
      },
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

export function loadTokens(state = {}) {
  const appearance = state.appearance ?? MODIFIERS.appearance.default;
  if (!(appearance in MODIFIERS.appearance.contexts)) {
    throw new Error(`f2-resolve: no such appearance: ${appearance} (have ${Object.keys(MODIFIERS.appearance.contexts).join(', ')})`);
  }
  const files = [...BASE_FILES];
  for (const rel of MODIFIERS.appearance.contexts[appearance]) files.push([`appearance/${appearance}`, rel]);

  const applied = { appearance };
  for (const name of ['contrast', 'transparency']) {
    const mod = MODIFIERS[name];
    const ctx = state[name] ?? mod.default;
    if (!(ctx in mod.contexts)) throw new Error(`f2-resolve: no such ${name} context: ${ctx}`);
    applied[name] = ctx;
    for (const rel of mod.contexts[ctx][appearance]) files.push([`${name}/${ctx}`, rel]);
  }

  const flat = new Map(), groups = new Map(), sources = [];
  for (const [label, rel] of files) {
    const path = join(PKG, rel);
    if (!existsSync(path)) throw new Error('f2-resolve: missing token file ' + rel);
    const buf = readFileSync(path);
    flatten(JSON.parse(buf.toString('utf8')), '', label, flat, groups);
    sources.push({ label, rel, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') });
  }
  return { flat, groups, sources, applied };
}

const ALIAS = /^\{([^}]+)\}$/;

/** Resolve a name to its literal, returning EVERY HOP. Inherited from F1 unchanged, and for F1's
 *  reason: the chain matters as much as the value. It matters more across appearances, because
 *  "the light appearance did not re-point anything" is a claim about routes and not about hexes. */
export function resolve(flat, name, seen = []) {
  if (seen.includes(name)) throw new Error(`f2-resolve: alias cycle at ${name} (${seen.join(' -> ')})`);
  const entry = flat.get(name);
  if (!entry) throw new Error(`f2-resolve: no such token: ${name}`);
  const chain = [...seen, name];
  const m = typeof entry.value === 'string' ? ALIAS.exec(entry.value.trim()) : null;
  if (!m) {
    return {
      value: typeof entry.value === 'string' ? entry.value.toLowerCase() : entry.value,
      alpha: entry.alpha, chain, file: entry.file, type: entry.type, node: entry.node,
    };
  }
  const next = resolve(flat, m[1].trim(), chain);
  return { ...next, alpha: entry.alpha !== undefined ? entry.alpha : next.alpha };
}

/** The Product roles. Inherited from I-08B3.1-F1 byte for byte, because the whole point is that
 *  the SAME names resolve in both appearances. A role F2 had to add would be a role the light
 *  appearance needs and the dark one does not, which is a different Product. */
export const ROLES = [
  ['WORLD', 'qandeel.world.fill'],
  ['SURFACE', 'qandeel.surface.functional'],
  ['PRIMARY', 'qandeel.content.primary'],
  ['SECONDARY', 'qandeel.content.secondary'],
  ['TERTIARY', 'qandeel.content.tertiary'],
  ['SCRIM', 'qandeel.passage.scrim'],
  ['BRASS', 'qandeel.identity.material'],
  ['MARK', 'qandeel.identity.mark'],
  ['NAV', 'qandeel.navigation.machinery'],
  ['CONTROL', 'qandeel.control.functional'],
  ['RELATION', 'qandeel.analysis.relation'],
  ['NODE', 'qandeel.analysis.node'],
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

export const SCALARS = [
  ['ATMO_L_NEAR', 'qandeel.expression.accessibility.atmosphere.lightness-near'],
  ['ATMO_L_MID', 'qandeel.expression.accessibility.atmosphere.lightness-mid'],
  ['ATMO_L_FAR', 'qandeel.expression.accessibility.atmosphere.lightness-far'],
  ['ATMO_ALPHA_MUL', 'qandeel.expression.accessibility.atmosphere.stroke-alpha-multiplier'],
  ['ATMO_CHROMA_CEILING', 'qandeel.atmosphere.chroma-ceiling'],
  ['BOUNDARY_WIDTH', 'qandeel.accessibility.contrast.boundary-width'],
  ['FOCUS_THICKNESS', 'qandeel.state.focus.thickness'],
  ['FOCUS_THICKNESS_HC', 'qandeel.accessibility.contrast.focus-thickness'],
  ['FOCUS_OFFSET', 'qandeel.state.focus.offset'],
  ['SELECTED_WEIGHT', 'qandeel.state.selected.weight'],
  ['REST_WEIGHT', 'qandeel.state.rest.weight'],
  ['PRESSED_PRESENCE', 'qandeel.state.pressed.presence'],
  ['SELECTED_MARKER_THICKNESS', 'qandeel.state.selected.marker-thickness'],
  ['TEXT_LEADING_RATIO', 'qandeel.accessibility.text.leading-ratio'],
  ['TEXT_LEADING_FLOOR', 'qandeel.accessibility.text.leading-floor'],
  ['TEXT_LABEL_ESCAPE_SCALE', 'qandeel.accessibility.text.label-escape-scale'],
  ['TEXT_BOLD_WEIGHT_DELTA', 'qandeel.accessibility.text.bold-weight-delta'],
  ['TEXT_MAX_SCALE', 'qandeel.accessibility.text.max-scale'],
  /* F2's own contract statements. None of them is a colour, and that is the test of whether a
     statement belongs in the appearance-independent layer. */
  ['APPEARANCE_LAW', 'qandeel.appearance.law'],
  /* THE FIVE CONTRACTS I-08B3.1-F2R SEPARATED OUT FROM THE CALIBRATIONS THAT WERE STANDING IN FOR
     THEM. Each of the five statements below it used to BE the contract; each is now a measured way
     of meeting one, and the sentence a future appearance would actually be violating is here. */
  ['ROLES_STAY_SEPARABLE', 'qandeel.appearance.roles-stay-separable'],
  ['ROLE_IDENTITY_SURVIVES', 'qandeel.appearance.role-identity-survives-appearance'],
  ['READING_HIERARCHY_PRESERVED', 'qandeel.appearance.reading-hierarchy-is-preserved'],
  ['LIGHT_REMAINS_MEANING', 'qandeel.appearance.light-remains-meaning'],
  ['PASSAGE_IS_SUPPRESSED', 'qandeel.appearance.passage-is-suppressed'],
  ['CHROMA_ORDER', 'qandeel.appearance.chroma-order'],
  ['HUE_CONSTANCY', 'qandeel.appearance.hue-constancy'],
  ['HIERARCHY_IS_A_RATIO', 'qandeel.appearance.hierarchy-is-a-ratio'],
  ['SUPPRESSION_IS_SUBTRACTION', 'qandeel.appearance.suppression-is-subtraction'],
  ['SWITCH_IS_NOT_A_MEANING_EVENT', 'qandeel.appearance.switch.is-not-a-meaning-event'],
  ['SWITCH_CROSSFADE', 'qandeel.appearance.switch.crossfade'],
  ['SWITCH_CROSSFADE_REDUCED', 'qandeel.appearance.switch.crossfade-reduced-motion'],
  ['SYSTEM_APPEARANCE', 'qandeel.appearance.system-appearance'],
  ['LIGHT_WORLD_LIGHTNESS', 'qandeel.appearance.light-world-lightness'],
  ['MEANING_HAS_A_SOURCE', 'qandeel.appearance.meaning-has-a-source'],
  ['LIGHT_NOT_REDUCED', 'qandeel.appearance.light-not-reduced'],
  ['DARK_IS_FROZEN', 'qandeel.appearance.dark-is-frozen'],
  ['STATUS_COLOUR_IS_EARNED', 'qandeel.appearance.status-colour-is-earned'],
  ['RESOLUTION_IS_CENTRALISED', 'qandeel.appearance.resolution-is-centralised'],
];

/** The namespaces nothing an APPEARANCE authors may re-point. Inherited from C3's invariants I-04
 *  and I-05 and F1's third obligation, with one added by F2: an appearance may supply a new VALUE
 *  for a role and may never change WHICH ROLE REACHES WHICH. If it could, "the same semantics in
 *  both appearances" would be a promise instead of a graph. Check P-03 walks every alias chain in
 *  both appearances and requires the two route sets to be identical. */
export const FORBIDDEN_REROUTE = 'an appearance set may supply expression VALUES and may never change an alias ROUTE';

/**
 * THE TOKEN TREE'S CONTENT IDENTITY — I-08B3.1-F2R's replacement for a modification-time ordering.
 *
 * The delegated gates — the dark regression, the parity matrix, the appearance switch — each write
 * a record, and tools/f2-verify has to know that the record is about the tree it is looking at now
 * rather than an older one. F2 asked whether the record's FILE WAS MODIFIED MORE RECENTLY than any
 * token file. That works on the machine that produced it and nowhere else: an independent Linux
 * extraction of the archive failed three checks, D-01, P-01 and S-01, purely because ZIP entries
 * carry a whole-second DOS timestamp and extraction can land every file on the same second or in
 * any order. The records themselves said PASS. The gate was reporting a property of the filesystem.
 *
 * So the question is asked about CONTENT instead: a sha256 over every token file's path and bytes,
 * sorted, with separators forced to '/'. A record carries the digest of the tree it was generated
 * against, and a gate passes only if that digest is the tree's digest now. It is deterministic
 * across operating systems, it survives copying and archiving, and it is a stronger claim than the
 * one it replaces — "written later" allowed a record written after an unrelated edit; "written
 * about THIS tree" does not.
 */
export function tokenTreeDigest() {
  const files = [];
  const walk = (dir) => {
    for (const e of readdirSync(join(PKG, dir), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const rel = dir + '/' + e.name;
      if (e.isDirectory()) walk(rel); else files.push(rel);
    }
  };
  walk('tokens');
  const h = createHash('sha256');
  for (const rel of files.sort()) {
    h.update(rel.replace(/\\/g, '/'));
    h.update(' ');
    h.update(createHash('sha256').update(readFileSync(join(PKG, rel))).digest('hex'));
    h.update(' ');
  }
  return { digest: h.digest('hex'), files: files.length };
}

export function resolveAll(state = {}) {
  const { flat, groups, sources, applied } = loadTokens(state);
  const colour = {}, scalar = {};
  for (const [role, token] of ROLES) colour[role] = { token, ...resolve(flat, token) };
  for (const [role, token] of SCALARS) scalar[role] = { token, ...resolve(flat, token) };
  return { flat, groups, sources, applied, colour, scalar };
}

/** Provenance, verified rather than asserted. Returns SOURCE-ABSENT rather than failing when the
 *  originating packages are not beside this one, because a bare extraction is a supported way to
 *  run this package and a gate that cannot pass there would be a gate nobody runs. */
export function verifyVendor() {
  const rec = JSON.parse(readFileSync(join(PKG, 'data/F2_VENDOR.json'), 'utf8'));
  const ROOT = join(PKG, '..');
  return rec.entries.map((e) => {
    const here = join(PKG, e.published);
    const there = join(ROOT, e.source);
    const h = existsSync(here) ? createHash('sha256').update(readFileSync(here)).digest('hex') : null;
    const s = existsSync(there) ? createHash('sha256').update(readFileSync(there)).digest('hex') : null;
    return {
      published: e.published, expected: e.sha256, here: h, source: s, sourcePresent: s !== null,
      state: h !== e.sha256 ? 'FAIL — published bytes differ'
        : s === null ? 'SOURCE-ABSENT'
          : s === e.sha256 ? 'PASS' : 'FAIL — source differs',
    };
  });
}
