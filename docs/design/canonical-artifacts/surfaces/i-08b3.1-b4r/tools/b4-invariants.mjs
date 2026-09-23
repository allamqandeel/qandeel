/**
 * I-08B3.1-B4.5 - THE PRODUCTION INVARIANTS, AS EXECUTABLE TESTS.
 *
 * Twelve invariants, every one of them run against the JSON THAT SHIPS - read back off disk, never
 * against the JavaScript that generated it. A test that imports the generator is a test of the
 * generator.
 *
 * ---------------------------------------------------------------------------------------------
 * AND TWELVE THAT PASS PROVE NOTHING UNTIL SOMETHING FAILS.
 * ---------------------------------------------------------------------------------------------
 *
 * Every invariant here would pass on a file with no tokens in it at all. So each one is also fired
 * at a deliberately BROKEN token document built for it, and the suite fails if the invariant does
 * not reject its probe. The probes are not stylised: `n1` is the four-equal-hexes duplication the
 * brief names, `n2` is a second Surface introduced by the most natural route (an "elevated" one),
 * and `n10` is a brand accent quietly taking control of the Surface - the three ways this system is
 * actually likely to die.
 *
 * COLLATERAL IS RECORDED, NOT HIDDEN. A probe usually trips more than the invariant it was built
 * for, because these rules overlap on purpose. Each probe names which extra rejections are expected
 * and why; an UNEXPECTED extra rejection is a finding about the rules, and is printed as one.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { load, alphaOf, isAlias, srgbHex } from './b4-dtcg.mjs';
import { TOKENS_DIR, PKG, WORK } from './b4-tokens.mjs';
import {
  WORLD, SURFACE, BANNED_SURFACE_VALUES,
} from '../../I-08B3.1-B3R-OVERLAY-SEMANTICS-FOCUS-LIFECYCLE-VERIFICATION/tools/b3-model.mjs';
import { relativeLuminance, hexToRgb8 } from '../../I-08B3.1-B3R-OVERLAY-SEMANTICS-FOCUS-LIFECYCLE-VERIFICATION/tools/color.mjs';

/* --------------------------------------------------------------------- vocabulary ----- */

export const SURFACE_SOURCE = 'qandeel.expression.surface';
export const SURFACE_JUNCTION = 'qandeel.surface.functional';
export const SCRIM_SOURCE = 'qandeel.expression.scrim';
export const ROLES = ['apparatus', 'aside', 'passage', 'field'];
export const ROLE_FILLS = ROLES.map((r) => `qandeel.role.${r}.fill`);

/**
 * The APPROVED token families, enumerated so that "no unapproved token family" is a closed list
 * rather than an opinion. A new top-level group under `qandeel` is a B-track decision and has to be
 * made deliberately; this array is where it would have to be made.
 */
export const APPROVED_FAMILIES = ['expression', 'world', 'surface', 'content', 'passage', 'role'];

/**
 * Terms a Surface may never encode, from B4.5 invariant 8 and SG-1. Checked against token PATHS and
 * `$extensions`, which are the machine-readable surfaces, and NOT against `$description`, which is
 * prose and legitimately contains several of these words in the act of forbidding them. A blacklist
 * over prose would have made the contract unwriteable - the same trap B1 fell into when its own
 * scanner found its own needle list.
 */
const SEMANTIC_FORBIDDEN = ['confidence', 'evidence', 'importance', 'recency', 'far', 'mid', 'near'];

/** Names that would mean a ladder, an elevation function, or a z-order derivation. */
const LADDER_FORBIDDEN = [
  'elevation', 'elevated', 'elevate', 'tonal', 'raised', 'sunken', 'zindex', 'z',
  'level', 'layer', 'step', 'tier', 'depth', 'high', 'low', 'lowest', 'highest', 'dim', 'bright',
  'nested', 'overlay',
];

/** Names that would mean a generic brand accent had entered the Surface system. */
const ACCENT_FORBIDDEN = ['accent', 'brand', 'tint', 'hue', 'chroma', 'saturation'];

/** Appearance words that must never appear in an APPEARANCE-INDEPENDENT name. */
const APPEARANCE_WORDS = ['dark', 'light', 'night', 'day', 'contrast'];

const seg = (key) => key.split('.');
const lower = (s) => s.toLowerCase();

/**
 * A path segment split into WORDS, and this is a correction rather than a refinement.
 *
 * The first version of these scans compared whole segments, and probe `n8` walked straight through
 * it: `surface.functionalDark` hard-codes an appearance into an appearance-independent name, which
 * is the precise failure INV-12 exists to catch, and INV-12 did not fire - because
 * `'functionaldark'` is not equal to `'dark'`. INV-01 caught the probe for an unrelated reason and
 * the suite would have reported a pass.
 *
 * Splitting on camel-case humps and separators catches it while staying narrower than a substring
 * test: `highlight` is one word and does not contain `light` under this rule, so the scan does not
 * have to buy its precision with an exemption list.
 */
const words = (s) => s.split(/(?=[A-Z])/).join(' ')
  .split(/[^a-zA-Z0-9]+/).filter(Boolean).map((w) => w.toLowerCase());
const hasWord = (key, list) => seg(key).some((s) => words(s).some((w) => list.includes(w)));

/* ------------------------------------------------------------------ the corpus -------- */

function readJson(abs) { return JSON.parse(readFileSync(abs, 'utf8')); }

/** Every `*.json` under `tokens/`, so the absence scans cover the shipped set with no exemption. */
export function tokenFiles(dir = TOKENS_DIR, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) tokenFiles(p, out);
    else if (e.name.endsWith('.json')) out.push(p);
  }
  return out;
}

/**
 * The context every invariant is handed.
 *
 * `surfaceFamily` - WHAT COUNTS AS A SURFACE - is the definition this file got wrong first, and the
 * way it was wrong is worth keeping written down.
 *
 * Version one said: a Surface is a token that resolves to `qandeel.expression.surface`. That is
 * circular. Probe `n2` adds a SECOND Surface value under a new name and points a Product role at
 * it; under version one the newcomer resolves to a different source, so it is not "a Surface", so
 * the rules that count Surface values never see it. The system would have had two tones and the
 * invariant that exists to forbid a second tone would have reported one.
 *
 * Version two - this one - defines a Surface by USE: a Surface is whatever a Product Surface role
 * is painted with, together with everything on the way there. Nothing can enter the system without
 * being counted, because the only way to enter the system is to be painted by a role. The known
 * source is unioned in so that the definition still holds in a document where the roles are missing
 * entirely, which is the shape several probes take.
 */
export function context(doc, { files = [], label = 'canonical' } = {}) {
  const l = load(doc, { file: label });
  const surfaceFamily = new Map();
  const paintedBy = new Set([SURFACE_SOURCE]);
  for (const k of ROLE_FILLS) {
    const rec = l.resolved.get(k);
    if (rec && rec.state === 'RESOLVED' && rec.source) paintedBy.add(rec.source);
  }
  for (const [key, rec] of l.resolved) {
    if (rec.state !== 'RESOLVED') continue;
    if (paintedBy.has(rec.source) || paintedBy.has(key)) surfaceFamily.set(key, rec);
  }
  return { doc, label, files, ...l, surfaceFamily, paintedBy };
}

/* ----------------------------------------------------------------- the invariants ----- */

const ok = (detail) => ({ pass: true, detail });
const no = (detail) => ({ pass: false, detail });

export const INVARIANTS = [
  {
    id: 'INV-01',
    title: 'All four Surface roles alias ONE Surface source token',
    why: 'The one-tone rule. Four equal hexes would satisfy every colour comparison and would be the ' +
      'duplication the brief forbids, so this is a statement about REFERENCE CHAINS.',
    run(ctx) {
      const missing = ROLE_FILLS.filter((k) => !ctx.resolved.has(k));
      if (missing.length) return no(`missing role fill token(s): ${missing.join(', ')}`);
      const recs = ROLE_FILLS.map((k) => ctx.resolved.get(k));
      const bad = recs.filter((r) => r.state !== 'RESOLVED');
      if (bad.length) return no(`role fill(s) not resolved: ${bad.map((r) => `${r.path.join('.')} [${r.state}]`).join(', ')}`);
      const literal = recs.filter((r) => r.chain.length < 2);
      if (literal.length) return no(`role fill(s) carry a literal value instead of an alias: ${literal.map((r) => r.path.join('.')).join(', ')}`);
      const viaJunction = recs.filter((r) => !r.chain.includes(SURFACE_JUNCTION));
      if (viaJunction.length) return no(`role fill(s) bypass \`${SURFACE_JUNCTION}\`: ${viaJunction.map((r) => r.path.join('.')).join(', ')}`);
      const sources = new Set(recs.map((r) => r.source));
      if (sources.size !== 1) return no(`the four roles resolve to ${sources.size} different source tokens: ${[...sources].join(', ')}`);
      const [only] = sources;
      if (only !== SURFACE_SOURCE) return no(`the roles resolve to \`${only}\`, not \`${SURFACE_SOURCE}\``);
      return ok(`4 roles -> 1 source; every chain is ${recs[0].chain.join(' -> ')} (length ${recs[0].chain.length})`);
    },
  },

  {
    id: 'INV-02',
    title: 'No role-specific Surface hex exists',
    why: 'A role that carries its own value has left the system even if the value happens to match.',
    run(ctx) {
      const offenders = [...ctx.resolved.values()]
        .filter((r) => r.path[0] === 'qandeel' && r.path[1] === 'role' && !isAlias(r.value));
      if (offenders.length) {
        return no(`${offenders.length} token(s) under \`qandeel.role\` carry a literal value: ` +
          offenders.map((r) => `${r.path.join('.')} = ${JSON.stringify(r.value)}`).join('; '));
      }
      const n = [...ctx.resolved.values()].filter((r) => r.path[1] === 'role').length;
      return ok(`all ${n} tokens under \`qandeel.role\` are aliases`);
    },
  },

  {
    id: 'INV-03',
    title: 'No retired Surface value exists in production-token output',
    why: 'The B2 challenger, the B2 lower-bound control and the four values a renewed search would ' +
      'reach for first. Needles are assembled from halves at runtime, so this scan covers its own ' +
      'source file too and carries no exemption.',
    run(ctx) {
      const hits = [];
      for (const f of ctx.files) {
        const text = lower(readFileSync(f, 'utf8'));
        for (const needle of BANNED_SURFACE_VALUES) {
          if (text.includes(lower(needle))) hits.push(`${f.slice(PKG.length + 1)} contains ${needle}`);
        }
      }
      if (hits.length) return no(hits.join('; '));
      const canonical = lower(JSON.stringify(ctx.doc));
      const count = canonical.split(lower(SURFACE)).length - 1;
      if (count !== 1) {
        return no(`the canonical Surface value appears ${count} time(s) in the document; the one-tone ` +
          'architecture requires exactly one');
      }
      return ok(`${BANNED_SURFACE_VALUES.length} retired/forbidden values absent from ${ctx.files.length} token file(s); ` +
        'the canonical Surface value appears exactly once');
    },
  },

  {
    id: 'INV-04',
    title: 'No chromatic Surface token exists',
    why: 'Achromatic is an accepted B1 direction, and at this lightness one 8-bit step of chroma is a ' +
      'large fraction of the whole signal.',
    run(ctx) {
      const bad = [];
      for (const [key, rec] of ctx.surfaceFamily) {
        const c = rec.resolved.components;
        if (!(c[0] === c[1] && c[1] === c[2])) bad.push(`${key} = [${c.join(', ')}]`);
      }
      const scrim = ctx.resolved.get('qandeel.expression.scrim');
      if (scrim && scrim.state === 'RESOLVED') {
        const c = scrim.resolved.components;
        if (!(c[0] === c[1] && c[1] === c[2])) bad.push(`qandeel.expression.scrim = [${c.join(', ')}]`);
      }
      if (bad.length) return no(`chromatic Surface value(s): ${bad.join('; ')}`);
      return ok(`${ctx.surfaceFamily.size} Surface token(s) and the scrim are achromatic (r = g = b by construction)`);
    },
  },

  {
    id: 'INV-05',
    title: 'No darker-than-World Surface token exists',
    why: 'B1 retired the sunken direction. A Surface that is darker than the ground it sits on is a ' +
      'hole, and it separates by a mechanism the B-track does not have.',
    run(ctx) {
      const world = ctx.resolved.get('qandeel.world.fill');
      if (!world || world.state !== 'RESOLVED') return no('`qandeel.world.fill` is missing or unresolved');
      const wl = relativeLuminance(hexToRgb8(srgbHex(world.resolved.components)));
      const bad = [];
      for (const [key, rec] of ctx.surfaceFamily) {
        const sl = relativeLuminance(hexToRgb8(srgbHex(rec.resolved.components)));
        if (!(sl > wl)) bad.push(`${key} luminance ${sl.toFixed(6)} is not above the World's ${wl.toFixed(6)}`);
      }
      if (bad.length) return no(bad.join('; '));
      const s = ctx.resolved.get(SURFACE_SOURCE);
      const sl = relativeLuminance(hexToRgb8(srgbHex(s.resolved.components)));
      return ok(`Surface relative luminance ${sl.toFixed(6)} > World ${wl.toFixed(6)} for all ${ctx.surfaceFamily.size} Surface token(s)`);
    },
  },

  {
    id: 'INV-06',
    title: 'PASSAGE has a scrim token; ASIDE does not',
    why: 'A scrim follows from BLOCKING. The absence on ASIDE is the contract, so the absence is what ' +
      'is tested - not merely the presence on PASSAGE.',
    run(ctx) {
      if (!ctx.resolved.has('qandeel.role.passage.scrim')) return no('`qandeel.role.passage.scrim` is missing');
      const strays = ROLES.filter((r) => r !== 'passage')
        .map((r) => `qandeel.role.${r}.scrim`).filter((k) => ctx.resolved.has(k));
      if (strays.length) return no(`non-blocking role(s) carry a scrim token: ${strays.join(', ')}`);
      const all = [...ctx.resolved.keys()].filter((k) => k.startsWith('qandeel.role.') && k.endsWith('.scrim'));
      if (all.length !== 1) return no(`${all.length} scrim tokens exist under \`qandeel.role\`: ${all.join(', ')}`);
      return ok('exactly one scrim in the role layer, on PASSAGE; APPARATUS, ASIDE and FIELD have none');
    },
  },

  {
    id: 'INV-07',
    title: 'Nesting adds no Surface tone',
    why: 'An ASIDE over a PASSAGE is the same tone. The strongest form of this rule is that there is ' +
      'no second tone available to step to.',
    run(ctx) {
      const literals = [...ctx.surfaceFamily.values()].filter((r) => !isAlias(r.value));
      if (literals.length !== 1) {
        return no(`the Surface family contains ${literals.length} literal value(s) - ` +
          `${literals.map((r) => r.path.join('.')).join(', ')} - so a nesting step has somewhere to go`);
      }
      const ladder = [...ctx.resolved.keys()].filter((k) => hasWord(k, LADDER_FORBIDDEN));
      if (ladder.length) return no(`token path(s) encode a ladder or a nesting level: ${ladder.join(', ')}`);
      return ok('exactly 1 literal Surface value exists in the whole architecture; no token path encodes a level, ' +
        'step, elevation or nesting depth');
    },
  },

  {
    id: 'INV-08',
    title: 'Surface fill never encodes confidence, evidence, importance, recency or FAR/MID/NEAR',
    why: 'SG-1. A Surface is non-semantic: it may assert nothing about the analysis inside it.',
    run(ctx) {
      const missing = [...ctx.resolved.values()]
        .filter((r) => r.path[1] === 'surface' || r.path[1] === 'role')
        .filter((r) => !r.description);
      if (missing.length) {
        return no(`positive requirement failed: ${missing.length} Surface/role token(s) carry no ` +
          `\`$description\` saying what they are for: ${missing.map((r) => r.path.join('.')).join(', ')}`);
      }
      const bad = [...ctx.resolved.keys()].filter((k) => hasWord(k, SEMANTIC_FORBIDDEN));
      const ext = [];
      for (const r of ctx.resolved.values()) {
        if (!r.extensions) continue;
        const text = lower(JSON.stringify(r.extensions));
        for (const t of SEMANTIC_FORBIDDEN) if (text.includes(t)) ext.push(`${r.path.join('.')} $extensions mentions "${t}"`);
      }
      if (bad.length || ext.length) return no([...bad.map((k) => `token path ${k}`), ...ext].join('; '));
      const n = [...ctx.resolved.values()].filter((r) => r.path[1] === 'surface' || r.path[1] === 'role').length;
      return ok(`all ${n} Surface/role tokens are described; no token path or \`$extensions\` value encodes ` +
        'an analytical property');
    },
  },

  {
    id: 'INV-09',
    title: 'No generic brand accent controls the Surface system',
    why: 'The Surface is not derived from a brand colour, and Living Brass belongs to I-08B3.1-C.',
    run(ctx) {
      const named = [...ctx.resolved.keys()].filter((k) => hasWord(k, ACCENT_FORBIDDEN));
      if (named.length) return no(`accent/brand vocabulary in token path(s): ${named.join(', ')}`);
      const src = ctx.resolved.get(SURFACE_SOURCE);
      if (!src) return no(`\`${SURFACE_SOURCE}\` is missing`);
      if (isAlias(src.value)) {
        return no(`the Surface source is itself an alias to \`${src.value}\` - something else controls it`);
      }
      const families = new Set([...ctx.resolved.keys()].map((k) => seg(k)[1]));
      const unapproved = [...families].filter((f) => !APPROVED_FAMILIES.includes(f));
      if (unapproved.length) return no(`unapproved token famil(ies) present: ${unapproved.join(', ')}`);
      return ok(`the Surface source is a literal nothing else controls; ${families.size} token families, all approved`);
    },
  },

  {
    id: 'INV-10',
    title: 'No elevation function derives a lighter or darker Surface from z-order',
    why: 'This is the mechanism Material 3 uses and the one QANDEEL explicitly does not inherit: ' +
      '"a higher the elevation will result in a darker color in light theme and lighter color in ' +
      'dark theme". Here there is nothing for such a function to return.',
    run(ctx) {
      const ladder = [...ctx.resolved.keys()].filter((k) => hasWord(k, LADDER_FORBIDDEN));
      if (ladder.length) return no(`elevation/ladder vocabulary in token path(s): ${ladder.join(', ')}`);
      const computed = [...ctx.resolved.values()].filter((r) =>
        r.extensions && /function|=>|\$\{|calc\(|mix\(|lighten|darken|overlay/i.test(JSON.stringify(r.extensions)));
      if (computed.length) {
        return no(`\`$extensions\` contains a colour-deriving expression on: ${computed.map((r) => r.path.join('.')).join(', ')}`);
      }
      const literals = [...ctx.surfaceFamily.values()].filter((r) => !isAlias(r.value));
      if (literals.length !== 1) return no(`${literals.length} literal Surface values exist; an elevation function would have a range to return`);
      return ok('no z-order vocabulary, no derived expression, and exactly one Surface value in the system - ' +
        'an elevation function would have a domain but no range');
    },
  },

  {
    id: 'INV-11',
    title: 'Reduce Transparency does not alter the canonical B-track Surface truth',
    why: 'Because the canonical Surface is OPAQUE, the transform is the identity on it. Translucency ' +
      'is retired from the B-track, so there is nothing for the setting to undo.',
    run(ctx) {
      const translucent = [...ctx.surfaceFamily.entries()].filter(([, r]) => alphaOf(r.resolved) !== 1);
      if (translucent.length) {
        return no(`Surface token(s) carry alpha < 1: ${translucent.map(([k, r]) => `${k} alpha ${alphaOf(r.resolved)}`).join('; ')}`);
      }
      /**
       * The second clause is keyed on the SOURCE a token resolves to, not on a list of paths it is
       * allowed to have. An allowlist of three names passed today and would have called any future
       * scrim alias a violation - probe `n5` proved it by adding `role.aside.scrim`, which INV-06
       * correctly rejects and which this rule ALSO rejected, for the wrong reason. The mechanism a
       * thing is made of is the honest thing to key on; the same correction the focus ledger needed
       * in B3R.
       */
      const withAlpha = [...ctx.resolved.entries()]
        .filter(([, r]) => r.state === 'RESOLVED' && alphaOf(r.resolved) !== 1);
      const unexpected = withAlpha.filter(([k, r]) => r.source !== SCRIM_SOURCE && k !== SCRIM_SOURCE).map(([k]) => k);
      if (unexpected.length) return no(`token(s) outside the scrim chain carry an alpha channel: ${unexpected.join(', ')}`);
      return ok(`all ${ctx.surfaceFamily.size} Surface tokens are alpha 1; the only alpha in the system is the ` +
        `scrim chain (${withAlpha.length} tokens, one value)`);
    },
  },

  {
    id: 'INV-12',
    title: 'Theme switching changes expression without changing semantic token names',
    why: 'Dark-led, not dark-locked. The test is not that a Light file could exist - it is that the ' +
      'semantic layer names nothing an appearance owns.',
    run(ctx) {
      const appearanceNamed = [...ctx.resolved.keys()]
        .filter((k) => !k.startsWith('qandeel.expression.'))
        .filter((k) => hasWord(k, APPEARANCE_WORDS));
      if (appearanceNamed.length) return no(`appearance-independent token(s) carry an appearance word: ${appearanceNamed.join(', ')}`);
      const semanticDoc = readJson(join(TOKENS_DIR, 'base', 'semantic.tokens.json'));
      const sem = load(semanticDoc, { file: 'base/semantic.tokens.json' });
      const literals = [...sem.resolved.values()].filter((r) => !isAlias(r.value));
      if (literals.length) {
        return no(`the appearance-independent set holds ${literals.length} literal value(s): ${literals.map((r) => r.path.join('.')).join(', ')}`);
      }
      const dangling = [...sem.resolved.values()].filter((r) => r.state === 'UNRESOLVED');
      if (dangling.length !== sem.resolved.size) {
        return no(`${sem.resolved.size - dangling.length} semantic token(s) resolved WITHOUT an appearance set - ` +
          'the semantic layer is not appearance-independent');
      }
      return ok(`the semantic layer holds ${sem.resolved.size} tokens, 0 literal values, and resolves to nothing ` +
        'on its own: every value it produces comes from whichever appearance set is loaded');
    },
  },
];

/* --------------------------------------------------------------------- the probes ----- */

const clone = (o) => JSON.parse(JSON.stringify(o));
const set = (doc, path, value) => {
  const p = path.split('.');
  let n = doc;
  for (const k of p.slice(0, -1)) { n[k] = n[k] || {}; n = n[k]; }
  n[p[p.length - 1]] = value;
  return doc;
};
const del = (doc, path) => {
  const p = path.split('.');
  let n = doc;
  for (const k of p.slice(0, -1)) { if (!n[k]) return doc; n = n[k]; }
  delete n[p[p.length - 1]];
  return doc;
};
const litColor = (hex, alpha) => {
  const c = hexToRgb8(hex).map((v) => Number((v / 255).toFixed(6)));
  const v = { colorSpace: 'srgb', components: c };
  if (alpha !== undefined) v.alpha = alpha;
  v.hex = hex.toLowerCase();
  return { $value: v, $description: 'probe' };
};

/**
 * Ten deliberately broken documents. `target` is the invariant each exists to fire; `tolerated`
 * lists the OTHER invariants it is expected to trip, each with the reason - overlap between these
 * rules is deliberate and pretending otherwise would hide it.
 */
const SURFACE_CHANGED = 'the probe replaces the canonical Surface value, so it is no longer present ' +
  'in the document exactly once - which is INV-03 doing its job, not a false positive';

export const PROBES = [
  {
    id: 'n1', target: 'INV-02',
    tolerated: {
      'INV-01': 'a role holding its own literal also breaks the chain identity INV-01 measures',
      'INV-03': 'the Surface value now appears twice in the document',
      'INV-07': 'under the use-based family definition the role\'s own literal IS a second Surface ' +
        'value, equal today and independently editable tomorrow - this collateral was not predicted ' +
        'and the rule is right',
      'INV-10': 'same reason: two literal Surface values give an elevation function a range',
    },
    why: 'The duplication the brief names by name: an ASIDE given its own copy of the same hex. Every ' +
      'colour comparison in the world still passes on this document. Only the chain knows.',
    make: (d) => set(clone(d), 'qandeel.role.aside.fill', litColor(SURFACE)),
  },
  {
    id: 'n2', target: 'INV-01',
    tolerated: {
      'INV-07': 'a second literal Surface value now exists, so a nesting step has somewhere to go',
      'INV-10': 'the word "elevated" is z-order vocabulary',
    },
    why: 'The most natural way a second tone actually arrives: not by decision, but by someone needing ' +
      '"the one that sits on top" and adding it. Note that this probe is what proved the first ' +
      'definition of the Surface family circular - see `context()`.',
    make: (d) => {
      const x = set(clone(d), 'qandeel.expression.surfaceElevated', litColor('#1f1f1f'));
      return set(x, 'qandeel.role.passage.fill', { $value: '{qandeel.expression.surfaceElevated}', $description: 'probe' });
    },
  },
  {
    id: 'n3', target: 'INV-04', tolerated: { 'INV-03': SURFACE_CHANGED },
    why: 'A tint of exactly one 8-bit step on one channel - the smallest chromatic Surface that can ' +
      'exist, and the one a designer would never see.',
    make: (d) => set(clone(d), 'qandeel.expression.surface', litColor('#181819')),
  },
  {
    id: 'n4', target: 'INV-05', tolerated: { 'INV-03': SURFACE_CHANGED },
    why: 'A sunken Surface: darker than the World it sits on. B1 retired the direction; this is what it ' +
      'would look like arriving through the token file.',
    make: (d) => set(clone(d), 'qandeel.expression.surface', litColor('#0a0a0a')),
  },
  {
    id: 'n5', target: 'INV-06', tolerated: {},
    why: 'A scrim on an ASIDE - the failure B0R froze the rule against, expressed as a token.',
    make: (d) => set(clone(d), 'qandeel.role.aside.scrim', { $value: '{qandeel.passage.scrim}', $description: 'probe' }),
  },
  {
    id: 'n6', target: 'INV-11', tolerated: {},
    why: 'The retired translucency diagnostic reinstated as production truth. It keeps the canonical ' +
      'hex, so INV-03 is silent and only the alpha gives it away.',
    make: (d) => set(clone(d), 'qandeel.expression.surface', litColor(SURFACE, 0.72)),
  },
  {
    id: 'n7', target: 'INV-03', tolerated: {},
    why: 'A retired B2 value back in the output. Assembled from halves so this probe does not itself ' +
      'plant the needle the scan hunts.',
    make: (d) => set(clone(d), 'qandeel.expression.surface', litColor('#' + '1b1' + 'b1b')),
  },
  {
    id: 'n8', target: 'INV-12',
    tolerated: { 'INV-01': 'the roles no longer pass through the junction token INV-01 names' },
    why: 'An appearance hard-coded into an appearance-independent name - exactly what forces a component ' +
      'rewrite when Light arrives. THIS PROBE FOUND A REAL HOLE: under whole-segment matching, ' +
      '`functionalDark` did not contain the word `dark`, INV-12 stayed silent, and the suite would have ' +
      'passed on INV-01 alone.',
    make: (d) => {
      const x = del(clone(d), 'qandeel.surface.functional');
      set(x, 'qandeel.surface.functionalDark', { $value: `{${SURFACE_SOURCE}}`, $description: 'probe' });
      for (const r of ROLES) set(x, `qandeel.role.${r}.fill`, { $value: '{qandeel.surface.functionalDark}', $description: 'probe' });
      return x;
    },
  },
  {
    id: 'n9', target: 'INV-09',
    tolerated: { 'INV-01': 'the four roles now resolve to the accent, not to the Surface source' },
    why: 'A brand accent quietly taking control of the Surface - the system dying by derivation rather ' +
      'than by decision, which is how it would actually die.',
    make: (d) => {
      const x = set(clone(d), 'qandeel.brand', { accent: litColor(SURFACE) });
      return set(x, 'qandeel.expression.surface', { $value: '{qandeel.brand.accent}', $description: 'probe' });
    },
  },
  {
    id: 'n10', target: 'INV-08', tolerated: {},
    why: 'A Surface that encodes an analytical property - SG-1 broken at the token layer, where it is ' +
      'cheapest to break and hardest to see.',
    make: (d) => set(clone(d), 'qandeel.role.aside.confidence',
      { $value: `{${SURFACE_JUNCTION}}`, $description: 'probe' }),
  },
  {
    id: 'n11', target: 'INV-07',
    tolerated: {
      'INV-01': 'the ASIDE no longer resolves to the shared source',
      'INV-10': 'the word "nested" is ladder vocabulary',
    },
    why: 'The nesting step itself: an ASIDE over a PASSAGE given its own slightly lighter tone, which is ' +
      'what every elevation system in the world would do here and what B0R forbade.',
    make: (d) => {
      const x = set(clone(d), 'qandeel.expression.surfaceNested', litColor('#1c1c1c'));
      return set(x, 'qandeel.role.aside.fill', { $value: '{qandeel.expression.surfaceNested}', $description: 'probe' });
    },
  },
  {
    id: 'n12', target: 'INV-10', tolerated: {},
    why: 'Material 3\'s mechanism arriving as metadata rather than as a token: an extension that tells a ' +
      'build step how to derive a lighter Surface from an elevation level. No name changes, no value ' +
      'changes, and the one-tone rule is over.',
    make: (d) => {
      const x = clone(d);
      x.qandeel.expression.surface.$extensions = {
        'app.qandeel.tonal': { deriveFrom: 'elevation', formula: 'mix(surface, primary, level * 5%)' },
      };
      return x;
    },
  },
];

/* ----------------------------------------------------------------------- runner ------- */

export function runAll(ctx) {
  return INVARIANTS.map((inv) => {
    let r;
    try { r = inv.run(ctx); } catch (e) { r = no(`threw: ${e.message}`); }
    return { id: inv.id, title: inv.title, why: inv.why, ...r };
  });
}

export function main() {
  const files = tokenFiles();
  const canonical = readJson(join(TOKENS_DIR, 'qandeel-surface.tokens.json'));
  const ctx = context(canonical, { files, label: 'tokens/qandeel-surface.tokens.json' });

  console.log(`I-08B3.1-B4.5 - PRODUCTION INVARIANTS`);
  console.log(`  document: tokens/qandeel-surface.tokens.json - ${ctx.resolved.size} tokens, ` +
    `${ctx.errors.length} conformance error(s), ${ctx.surfaceFamily.size} in the Surface family`);
  console.log('');

  const results = runAll(ctx);
  for (const r of results) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.id}  ${r.title}\n          ${r.detail}`);
  const failed = results.filter((r) => !r.pass);

  console.log('');
  console.log(`  NEGATIVE PROBES - each broken document must be REJECTED by the invariant it was built for`);
  const probeResults = [];
  for (const p of PROBES) {
    const broken = p.make(canonical);
    const bctx = context(broken, { files, label: `probe ${p.id}` });
    const res = runAll(bctx);
    const rejectedBy = res.filter((r) => !r.pass).map((r) => r.id);
    const hitTarget = rejectedBy.includes(p.target);
    const collateral = rejectedBy.filter((id) => id !== p.target);
    const unexpected = collateral.filter((id) => !(id in p.tolerated));
    probeResults.push({ ...p, rejectedBy, hitTarget, collateral, unexpected });
    console.log(`  ${hitTarget && !unexpected.length ? 'PASS' : 'FAIL'}  ${p.id} -> ${p.target}` +
      `  rejected by [${rejectedBy.join(', ') || 'NOTHING'}]` +
      (collateral.length ? `  collateral [${collateral.join(', ')}]` : '') +
      (unexpected.length ? `  UNEXPECTED [${unexpected.join(', ')}]` : ''));
  }
  const probeFails = probeResults.filter((p) => !p.hitTarget || p.unexpected.length);

  const covered = new Set(PROBES.map((p) => p.target));
  const uncovered = INVARIANTS.map((i) => i.id).filter((id) => !covered.has(id));

  console.log('');
  console.log(`  invariants: ${results.length - failed.length}/${results.length} pass`);
  console.log(`  probes    : ${probeResults.length - probeFails.length}/${probeResults.length} rejected as designed`);
  console.log(`  invariants with no dedicated probe: ${uncovered.length ? uncovered.join(', ') : '(none)'}`);

  mkdirSync(WORK, { recursive: true });
  writeFileSync(join(WORK, 'invariants.json'), JSON.stringify({
    tokens: ctx.resolved.size, conformanceErrors: ctx.errors,
    invariants: results, probes: probeResults.map(({ make, ...r }) => r), uncovered,
  }, null, 2), { encoding: 'utf8' });

  return { results, probeResults, failed, probeFails, uncovered, ctx };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { failed, probeFails, uncovered } = main();
  if (failed.length || probeFails.length || uncovered.length) process.exit(1);
}
