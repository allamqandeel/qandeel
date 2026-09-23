/**
 * I-08B3.1-B4.9 - TOKEN VALIDATION, and I-08B3.1-B4.2 - THEME CAPABILITY.
 *
 * B4.5 asks whether the SYSTEM is right. This file asks whether the FILE is right, which is a
 * different question and fails in different ways: a document can express a perfect one-tone
 * architecture and still be unreadable by a conforming tool because a component is out of range or
 * a group is also a token.
 *
 * ---------------------------------------------------------------------------------------------
 * THE CHECK THAT MATTERS MOST HERE IS THE ONE THAT PROVES SOMETHING IS MISSING.
 * ---------------------------------------------------------------------------------------------
 *
 * "An unresolved future expression is preferable to an invented value." That sentence is only worth
 * anything if the unresolved-ness is DETECTABLE, and there is a shape of this architecture where it
 * would not have been: had the canonical values lived in the semantic layer with an appearance set
 * merely overriding them, resolving into Light would have silently returned the DARK values and
 * every check would have passed on a light theme that was secretly dark.
 *
 * So the values live in the appearance layer alone, and check 9 resolves the semantic layer against
 * the empty Light set and REQUIRES every semantic token to come back UNRESOLVED, naming the exact
 * expression token it wanted. A missing Light theme is a build error. An invented one is a decision
 * nobody made.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { load, mergeDocs, isAlias, alphaOf, srgbHex, toCss, COLOR_SPACES } from './b4-dtcg.mjs';
import { TOKENS_DIR, WORK, DTCG_VERSION } from './b4-tokens.mjs';
import { APPROVED_FAMILIES, SURFACE_SOURCE, SCRIM_SOURCE } from './b4-invariants.mjs';
import {
  WORLD, PRIMARY, SECONDARY, TERTIARY, SURFACE, SCRIM_BASELINE,
} from '../../I-08B3.1-B3R-OVERLAY-SEMANTICS-FOCUS-LIFECYCLE-VERIFICATION/tools/b3-model.mjs';

const read = (rel) => JSON.parse(readFileSync(join(TOKENS_DIR, rel), 'utf8'));

/**
 * The values the canonical DARK expression MUST carry, imported from the sealed accepted package.
 * This is the check that stops a token file from being internally consistent and wrong - the exact
 * failure mode B2R found in its own leading contract.
 */
const EXPECTED = [
  ['qandeel.world.fill', WORLD, 1],
  ['qandeel.surface.functional', SURFACE, 1],
  ['qandeel.content.primary', PRIMARY, 1],
  ['qandeel.content.secondary', SECONDARY, 1],
  ['qandeel.content.tertiary', TERTIARY, 1],
  ['qandeel.passage.scrim', '#000000', SCRIM_BASELINE],
];

const ok = (detail) => ({ pass: true, detail });
const no = (detail) => ({ pass: false, detail });

export const CHECKS = [
  {
    id: 'V-01', title: 'Every shipped token file parses and conforms to the Format Module',
    run(ctx) {
      const bad = ctx.files.filter((f) => f.errors.length);
      if (bad.length) {
        return no(bad.map((f) => `${f.rel}: ${f.errors.join(' | ')}`).join('; '));
      }
      return ok(ctx.files.map((f) => `${f.rel} (${f.resolved.size} token${f.resolved.size === 1 ? '' : 's'})`).join(', '));
    },
  },
  {
    id: 'V-02', title: 'The canonical document resolves completely - no dangling reference',
    run(ctx) {
      if (ctx.canon.unresolved.length) {
        return no(`${ctx.canon.unresolved.length} unresolved: ` +
          ctx.canon.unresolved.map((r) => `${r.path.join('.')} -> ${r.detail}`).join('; '));
      }
      return ok(`${ctx.canon.resolved.size} tokens, all resolved`);
    },
  },
  {
    id: 'V-03', title: 'No circular reference',
    run(ctx) {
      if (ctx.canon.circular.length) {
        return no(ctx.canon.circular.map((r) => r.detail).join('; '));
      }
      const depths = [...ctx.canon.resolved.values()].map((r) => r.chain.length);
      return ok(`0 cycles; alias chains are ${Math.min(...depths)}-${Math.max(...depths)} links deep ` +
        '(deep aliases are permitted and are what makes the appearance layer swappable)');
    },
  },
  {
    id: 'V-04', title: 'Every token is typed, and every colour value is well formed',
    run(ctx) {
      if (ctx.canon.errors.length) return no(ctx.canon.errors.join('; '));
      const types = new Set([...ctx.canon.resolved.values()].map((r) => r.resolvedType));
      const spaces = new Set([...ctx.canon.resolved.values()].map((r) => r.resolved.colorSpace));
      const unknown = [...spaces].filter((s) => !COLOR_SPACES.includes(s));
      if (unknown.length) return no(`unknown colour space(s): ${unknown.join(', ')}`);
      if (spaces.size !== 1 || !spaces.has('srgb')) {
        return no(`the package authors sRGB only; found ${[...spaces].join(', ')}`);
      }
      return ok(`type(s) {${[...types].join(', ')}} inherited from the root group; colour space srgb only; ` +
        'components round-trip to their own hex fallback');
    },
  },
  {
    id: 'V-05', title: 'The canonical DARK values are the accepted values, to the digit',
    why: 'Imported from the sealed I-08B3.1-B3R package, never retyped.',
    run(ctx) {
      const bad = [];
      for (const [key, hex, alpha] of EXPECTED) {
        const r = ctx.canon.resolved.get(key);
        if (!r || r.state !== 'RESOLVED') { bad.push(`${key} is missing or unresolved`); continue; }
        const got = srgbHex(r.resolved.components);
        if (got !== hex.toLowerCase()) bad.push(`${key} resolves to ${got}, expected ${hex}`);
        if (r.resolved.hex !== hex.toLowerCase()) bad.push(`${key} hex fallback is ${r.resolved.hex}, expected ${hex}`);
        if (alphaOf(r.resolved) !== alpha) bad.push(`${key} alpha is ${alphaOf(r.resolved)}, expected ${alpha}`);
      }
      if (bad.length) return no(bad.join('; '));
      return ok(EXPECTED.map(([k, h, a]) => `${k.split('.').slice(1).join('.')} ${h}${a === 1 ? '' : ` @${a}`}`).join(', '));
    },
  },
  {
    id: 'V-06', title: 'One-tone identity: exactly one token in the document holds the Surface value',
    run(ctx) {
      const literals = [...ctx.canon.resolved.values()].filter((r) => !isAlias(r.value))
        .filter((r) => srgbHex(r.resolved.components) === SURFACE.toLowerCase());
      if (literals.length !== 1) {
        return no(`${literals.length} token(s) hold the Surface value literally: ` +
          literals.map((r) => r.path.join('.')).join(', '));
      }
      if (literals[0].path.join('.') !== SURFACE_SOURCE) {
        return no(`the literal lives at \`${literals[0].path.join('.')}\`, not \`${SURFACE_SOURCE}\``);
      }
      const consumers = [...ctx.canon.resolved.values()].filter((r) => r.source === SURFACE_SOURCE);
      return ok(`1 literal at \`${SURFACE_SOURCE}\`; ${consumers.length} tokens reach it by reference`);
    },
  },
  {
    id: 'V-07', title: 'The scrim carries an alpha channel and nothing else does',
    run(ctx) {
      const withAlpha = [...ctx.canon.resolved.entries()].filter(([, r]) => alphaOf(r.resolved) !== 1);
      const stray = withAlpha.filter(([k, r]) => r.source !== SCRIM_SOURCE && k !== SCRIM_SOURCE);
      if (stray.length) return no(`alpha outside the scrim chain: ${stray.map(([k]) => k).join(', ')}`);
      const src = ctx.canon.resolved.get(SCRIM_SOURCE);
      if (!src) return no(`\`${SCRIM_SOURCE}\` is missing`);
      if (alphaOf(src.resolved) !== SCRIM_BASELINE) {
        return no(`the scrim alpha is ${alphaOf(src.resolved)}, and the value selected for B4 production ` +
          `verification is ${SCRIM_BASELINE}`);
      }
      if (src.resolved.hex !== '#000000') return no(`the scrim is ${src.resolved.hex}, not neutral black`);
      return ok(`${withAlpha.length} tokens carry alpha, all on the scrim chain; ` +
        `the source is neutral black at alpha ${SCRIM_BASELINE}, serialised as \`${toCss(src.resolved)}\``);
    },
  },
  {
    id: 'V-08', title: 'No unapproved token family',
    run(ctx) {
      const families = [...new Set([...ctx.canon.resolved.keys()].map((k) => k.split('.')[1]))];
      const roots = [...new Set([...ctx.canon.resolved.keys()].map((k) => k.split('.')[0]))];
      const unapproved = families.filter((f) => !APPROVED_FAMILIES.includes(f));
      if (unapproved.length) return no(`unapproved famil(ies): ${unapproved.join(', ')}`);
      if (roots.length !== 1 || roots[0] !== 'qandeel') return no(`unexpected root group(s): ${roots.join(', ')}`);
      return ok(`root \`qandeel\`; families {${families.join(', ')}}, all on the approved list`);
    },
  },
  {
    id: 'V-09', title: 'NO INVENTED LIGHT VALUE - and the absence is detectable, not merely true',
    why: 'The load-bearing check of the theme-capability claim.',
    run(ctx) {
      const lightTokens = [...ctx.light.resolved.values()];
      const invented = lightTokens.filter((r) => !isAlias(r.value));
      if (invented.length) {
        return no(`the Light appearance set holds ${invented.length} literal colour value(s): ` +
          invented.map((r) => r.path.join('.')).join(', ') + ' - no Light value has been designed');
      }
      const merged = ctx.lightResolved;
      const unresolved = merged.unresolved;
      const resolvedAnyway = [...merged.resolved.values()].filter((r) => r.state === 'RESOLVED');
      if (resolvedAnyway.length) {
        return no(`${resolvedAnyway.length} semantic token(s) RESOLVED against an empty Light set - ` +
          'the appearance layer is leaking dark values into a theme nobody has designed: ' +
          resolvedAnyway.slice(0, 4).map((r) => r.path.join('.')).join(', '));
      }
      if (!unresolved.length) return no('the Light resolution produced no tokens at all, so nothing was proved');
      const wanted = [...new Set(unresolved.map((r) => r.chain[r.chain.length - 1]))];
      return ok(`the Light set contributes 0 colour values; resolving the semantic layer into it leaves ` +
        `all ${unresolved.length} semantic and role tokens UNRESOLVED, naming ${wanted.length} missing ` +
        `expression token(s): ${wanted.join(', ')}`);
    },
  },
  {
    id: 'V-10', title: 'The shipped canonical file IS the resolver output for appearance=dark',
    why: 'Otherwise the deliverable and the architecture are two documents that merely agree today.',
    run(ctx) {
      const built = mergeDocs([read('base/semantic.tokens.json'), read('appearance/dark.tokens.json')]);
      const a = JSON.stringify(built);
      const b = JSON.stringify(read('qandeel-surface.tokens.json'));
      if (a !== b) return no('merging `base/semantic` + `appearance/dark` does not reproduce `qandeel-surface.tokens.json`');
      return ok(`semantic + dark merges to the shipped canonical document exactly (${a.length} bytes of JSON, identical)`);
    },
  },
  {
    id: 'V-11', title: 'The resolver manifest is well formed for DTCG Resolver 2025.10',
    why: 'Corrected in I-08B3.1-B4R. This check covers the obligations the official JSON Schema ' +
      'states in its own `$comment` that it CANNOT check.',
    run(ctx) {
      const r = ctx.resolver;
      const errs = validateResolver(r);
      if (errs.length) return no(errs.join('; '));
      const sets = Object.keys(r.sets || {});
      const mods = Object.entries(r.modifiers || {});
      const combos = mods.reduce((n, [, m]) => n * Object.keys(m.contexts).length, 1);
      return ok(`version ${r.version}; \`sets\` and \`modifiers\` are maps; ${sets.length} set ` +
        `{${sets.join(', ')}}, ${mods.length} modifiers {${mods.map(([n2, m]) => `${n2}: ${Object.keys(m.contexts).join('|')}`).join(', ')}}; ` +
        `resolutionOrder is ${r.resolutionOrder.length} reference object(s), each resolving to a declared ` +
        `set or modifier; every modifier default names one of its own contexts; ` +
        `${combos} representable appearance/contrast combinations, 1 of which has values today`);
    },
  },
];

/* ------------------------------------------------- the resolver rules, in one place ----- */

/**
 * DTCG RESOLVER MODULE 2025.10 - the structural rules, CORRECTED IN I-08B3.1-B4R.
 *
 * ---------------------------------------------------------------------------------------------
 * WHY THIS FUNCTION IS NOT REDUNDANT WITH THE OFFICIAL SCHEMA
 * ---------------------------------------------------------------------------------------------
 *
 * `tools/b4r-schema.mjs` validates the same document against the official JSON Schema, and that is
 * the authority on SYNTAX. But the Resolver Module places obligations on TOOLS that JSON Schema
 * cannot express, and the official schema says so itself, twice, in `$comment`:
 *
 *   - "JSON Schema cannot validate that this value matches a key in 'contexts'. This validation
 *     must be performed at runtime by the implementation."   (modifier `default`)
 *   - "Uniqueness must be validated at runtime as JSON Schema cannot validate uniqueness across
 *     array items."                                          (inline `name`)
 *
 * And a `$ref` naming a set that was never declared is a perfectly well-formed URI reference: the
 * schema has no way to know whether `#/sets/semantic` points at anything. So the two validators
 * PARTITION the specification rather than duplicating it, and a document has to satisfy both. If
 * they ever disagreed on a syntax question the official schema would win - that is the rule this
 * package now operates under, because it is the rule that would have prevented B4R-REV-01.
 *
 * The B4 shape - `sets: [...]`, `modifiers: [...]`, `resolutionOrder: [{type, name}]` - is rejected
 * by the first gate below. The `{ type, name }` form is REAL but belongs to an INLINE declaration,
 * where `name` and `type` sit on top of the set or modifier body; B4 wrote the marker keys with
 * neither the body nor a reference.
 */
export function validateResolver(r) {
  const errs = [];
  const isMap = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  if (!isMap(r)) return ['the resolver document must be a JSON object'];
  if (r.version !== DTCG_VERSION) errs.push(`version is ${JSON.stringify(r.version)}, must be "${DTCG_VERSION}"`);

  /* Gate 1: the root containers are MAPS keyed by name, not arrays of named objects. */
  for (const [key, kind] of [['sets', 'Set'], ['modifiers', 'Modifier']]) {
    if (r[key] === undefined) continue;
    if (Array.isArray(r[key])) {
      errs.push(`\`${key}\` is an array; DTCG Resolver 2025.10 declares it as Map[string, ${kind}], ` +
        'so the name is the KEY - the array-of-named-objects form is not the published shape');
    } else if (!isMap(r[key])) {
      errs.push(`\`${key}\` must be an object/map`);
    }
  }
  if (errs.some((e) => e.includes('is an array') || e.includes('must be an object/map'))) return errs;

  const sets = isMap(r.sets) ? r.sets : {};
  const modifiers = isMap(r.modifiers) ? r.modifiers : {};

  for (const [name, s] of Object.entries(sets)) {
    if (!isMap(s)) { errs.push(`set \`${name}\` must be an object`); continue; }
    if (!Array.isArray(s.sources)) errs.push(`set \`${name}\` must declare a \`sources\` array`);
  }

  for (const [name, m] of Object.entries(modifiers)) {
    if (!isMap(m)) { errs.push(`modifier \`${name}\` must be an object`); continue; }
    if (!isMap(m.contexts)) { errs.push(`modifier \`${name}\` must declare a \`contexts\` map`); continue; }
    const keys = Object.keys(m.contexts);
    if (keys.length < 2) {
      errs.push(`modifier \`${name}\` has ${keys.length} context(s); a modifier with one context is a ` +
        'set, and the official schema requires `minProperties: 2`');
    }
    if (m.default !== undefined && !keys.includes(m.default)) {
      errs.push(`modifier \`${name}\` defaults to \`${m.default}\`, which is not one of its contexts ` +
        `{${keys.join(', ')}} - a runtime obligation the official schema delegates in its \`$comment\``);
    }
    for (const [ctx, arr] of Object.entries(m.contexts)) {
      if (!Array.isArray(arr)) errs.push(`modifier \`${name}\` context \`${ctx}\` must be an array of sources`);
    }
  }

  /* Gate 2: resolutionOrder - reference objects, or inline declarations complete with their body. */
  if (!Array.isArray(r.resolutionOrder) || !r.resolutionOrder.length) {
    errs.push('`resolutionOrder` is required and must be a non-empty array');
    return errs;
  }
  const seen = new Set();
  const claim = (nm, at) => {
    if (seen.has(nm)) errs.push(`${at} re-uses the name \`${nm}\`, which MUST be unique within resolutionOrder`);
    seen.add(nm);
  };
  r.resolutionOrder.forEach((step, i) => {
    const at = `resolutionOrder[${i}]`;
    if (!isMap(step)) { errs.push(`${at} must be an object`); return; }

    if (typeof step.$ref === 'string') {
      if (step.name !== undefined || step.type !== undefined) {
        errs.push(`${at} is a reference object carrying inline-declaration keys as well; it must be one or the other`);
      }
      if (/^#\/resolutionOrder\//.test(step.$ref)) {
        errs.push(`${at} points into \`resolutionOrder\`, which nothing may reference`);
        return;
      }
      const m = /^#\/(sets|modifiers)\/(.+)$/.exec(step.$ref);
      if (!m) {
        errs.push(`${at} has \`$ref\` \`${step.$ref}\`; a resolutionOrder reference must point at ` +
          '`#/sets/<name>` or `#/modifiers/<name>`');
        return;
      }
      const [, kind, nm] = m;
      const pool = kind === 'sets' ? sets : modifiers;
      if (!Object.prototype.hasOwnProperty.call(pool, nm)) {
        errs.push(`${at} references \`${step.$ref}\`, which is not a declared ${kind === 'sets' ? 'set' : 'modifier'} ` +
          `(declared ${kind}: ${Object.keys(pool).join(', ') || 'none'})`);
        return;
      }
      claim(nm, at);
      return;
    }

    if (step.name !== undefined || step.type !== undefined) {
      if (typeof step.name !== 'string' || !step.name) errs.push(`${at} is an inline declaration with no \`name\``);
      if (step.type !== 'set' && step.type !== 'modifier') {
        errs.push(`${at} has \`type\` ${JSON.stringify(step.type)}; an inline declaration must be "set" or "modifier"`);
      }
      if (step.type === 'set' && !Array.isArray(step.sources)) {
        errs.push(`${at} declares \`type: "set"\` and \`name\` but carries no \`sources\`. \`name\` and ` +
          '`type` are added ON TOP OF an inline set body - they do not stand in for it. A set declared ' +
          'at the root is referenced instead, with `{ "$ref": "#/sets/<name>" }`');
      }
      if (step.type === 'modifier' && !isMap(step.contexts)) {
        errs.push(`${at} declares \`type: "modifier"\` and \`name\` but carries no \`contexts\`. A modifier ` +
          'declared at the root is referenced instead, with `{ "$ref": "#/modifiers/<name>" }`');
      }
      if (typeof step.name === 'string' && step.name) claim(step.name, at);
      return;
    }

    errs.push(`${at} is neither a reference object (\`$ref\`) nor an inline declaration (\`name\` + \`type\` + body)`);
  });

  return errs;
}

/* --------------------------------------------------------------------- the probes ----- */

/**
 * Eleven malformed documents, each aimed at one check. V-09 gets the sharpest of the original six:
 * a Light set that invents a plausible colour. It is plausible ON PURPOSE - an implausible probe
 * would only prove the check can reject something obviously wrong. I-08B3.1-B4R adds five aimed at
 * V-11, three of which are the shape this package itself shipped.
 */
const CANON = 'qandeel-surface.tokens.json';
const LIGHT = 'appearance/light.tokens.json';
export const RESOLVER_FILE = 'qandeel-surface.resolver.json';
const edit = (rel, fn) => { const d = JSON.parse(readFileSync(join(TOKENS_DIR, rel), 'utf8')); fn(d); return { [rel]: d }; };

export const PROBES = [
  { id: 'v-n1', target: 'V-01', why: 'an object that is a token and a group at once - the Format Module ' +
      'calls this an invalid structure, and nothing about it looks wrong in a diff',
    make: () => edit(CANON, (d) => { d.qandeel.surface.functional.nested = { $value: '{qandeel.expression.surface}' }; }) },
  { id: 'v-n2', target: 'V-03', why: 'a reference cycle, which makes every value in the chain unknown',
    make: () => edit(CANON, (d) => { d.qandeel.expression.surface = { $value: '{qandeel.surface.functional}' }; }) },
  { id: 'v-n3', target: 'V-04', why: '8-bit values pasted into `components` - in range for the author, out ' +
      'of range for the spec, and clamped to WHITE by every serialiser without a word',
    make: () => edit(CANON, (d) => { d.qandeel.expression.surface.$value.components = [24, 24, 24]; }) },
  { id: 'v-n4', target: 'V-05', why: 'a Surface one 8-bit step off the accepted value; invisible, and wrong',
    make: () => edit(CANON, (d) => { d.qandeel.expression.surface.$value = { colorSpace: 'srgb', components: [0.098039, 0.098039, 0.098039], hex: '#191919' }; }) },
  { id: 'v-n5', target: 'V-07', why: 'the scrim silently moved off the selected alpha',
    make: () => edit(CANON, (d) => { d.qandeel.expression.scrim.$value.alpha = 0.6; }) },
  { id: 'v-n6', target: 'V-09', why: 'A PLAUSIBLE INVENTED LIGHT VALUE. This is the probe the whole ' +
      'theme-capability claim rests on: if the check cannot reject a reasonable-looking Light Surface, ' +
      'then "no Light value was invented" is a statement about my restraint rather than a property of ' +
      'the package.',
    make: () => edit(LIGHT, (d) => {
      d.qandeel.expression.surface = { $value: { colorSpace: 'srgb', components: [0.968627, 0.968627, 0.968627], hex: '#f7f7f7' } };
    }) },

  /* ---------------------------------------------------- I-08B3.1-B4R, all aimed at V-11 --- */

  /**
   * The five malformed resolvers the independent freeze review asked for. The first three are the
   * shape B4 actually shipped, taken apart one member at a time; the last two are the obligations
   * the official JSON Schema explicitly delegates to the implementation, which means a package that
   * validated ONLY against the schema would ship them both.
   */
  { id: 'v-n7', target: 'V-11', why: 'PROBE A - `sets` as an array of named objects. This is half of ' +
      'the exact shape B4 shipped: it reads perfectly well and is not the published model.',
    make: () => edit(RESOLVER_FILE, (d) => {
      d.sets = Object.entries(d.sets).map(([name, s]) => ({ name, ...s }));
    }) },
  { id: 'v-n8', target: 'V-11', why: 'PROBE B - `modifiers` as an array of named objects.',
    make: () => edit(RESOLVER_FILE, (d) => {
      d.modifiers = Object.entries(d.modifiers).map(([name, m]) => ({ name, ...m }));
    }) },
  { id: 'v-n9', target: 'V-11', why: 'PROBE C - `resolutionOrder` entries as `{ type, name }` while the ' +
      'sets and modifiers are declared at the ROOT. The subtlest of the three, because this form is ' +
      'real: it is how a set is declared INLINE, where `name` and `type` sit on top of the body. ' +
      'Written without a body and without a `$ref` it is neither shape.',
    make: () => edit(RESOLVER_FILE, (d) => {
      d.resolutionOrder = [
        { type: 'set', name: 'semantic' },
        { type: 'modifier', name: 'appearance' },
        { type: 'modifier', name: 'contrast' },
      ];
    }) },
  { id: 'v-n10', target: 'V-11', why: 'PROBE D - a `$ref` to a set that was never declared. Syntactically ' +
      'a valid URI reference, so the official schema cannot reject it; it resolves to nothing at build time.',
    make: () => edit(RESOLVER_FILE, (d) => { d.resolutionOrder[0] = { $ref: '#/sets/foundation' }; }) },
  { id: 'v-n11', target: 'V-11', why: 'PROBE E - a modifier whose `default` names a context it does not ' +
      'have. The Resolver Module requires a tool to throw here, and the official schema says in its own ' +
      '`$comment` that JSON Schema cannot check it. QANDEEL is dark-led, so a silently unusable default ' +
      'on `appearance` is the one that would hurt.',
    make: () => edit(RESOLVER_FILE, (d) => { d.modifiers.appearance.default = 'darkMode'; }) },
];

/* ----------------------------------------------------------------------- runner ------- */

const RELS = ['base/semantic.tokens.json', 'appearance/dark.tokens.json', 'appearance/light.tokens.json',
  'contrast/standard.tokens.json', 'contrast/increased.tokens.json', 'qandeel-surface.tokens.json'];

/**
 * Build the context from the SHIPPED FILES, with an optional per-file override.
 *
 * The override is how a probe perturbs this suite, and it took a failing probe to get right: the
 * first version mutated an in-memory copy of the canonical document, so `v-n1` - an object that is a
 * token and a group at once - never reached V-01, whose subject is the file set on disk. The probe
 * reported FAIL and the rule was fine. A probe that cannot reach the check it aims at measures the
 * harness, not the package.
 */
function build(overrides = {}) {
  const get = (rel) => overrides[rel] ?? read(rel);
  return {
    canonDoc: get('qandeel-surface.tokens.json'), lightDoc: get('appearance/light.tokens.json'),
    files: RELS.map((rel) => ({ rel, ...load(get(rel), { file: rel }) })),
    canon: load(get('qandeel-surface.tokens.json'), { file: 'qandeel-surface.tokens.json' }),
    light: load(get('appearance/light.tokens.json'), { file: 'appearance/light.tokens.json' }),
    lightResolved: load(mergeDocs([get('base/semantic.tokens.json'), get('appearance/light.tokens.json')]),
      { file: 'semantic + light' }),
    /**
     * Read through `get`, not `read`. Until I-08B3.1-B4R this line read the resolver straight from
     * disk, which meant no probe could perturb it and V-11 was the one check in the suite with no
     * negative evidence behind it - the same defect `v-n1` exposed in this harness once already, in
     * a different member. That is twice now: a check whose subject cannot be reached by the probe
     * machinery is a check nobody has tested.
     */
    resolver: get(RESOLVER_FILE),
  };
}

export function runAll(ctx) {
  return CHECKS.map((c) => {
    let r;
    try { r = c.run(ctx); } catch (e) { r = no(`threw: ${e.message}`); }
    return { id: c.id, title: c.title, why: c.why, ...r };
  });
}

export function main() {
  const ctx = build();

  console.log('I-08B3.1-B4.9 - TOKEN VALIDATION');
  const results = runAll(ctx);
  for (const r of results) console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.id}  ${r.title}\n          ${r.detail}`);
  const failed = results.filter((r) => !r.pass);

  console.log('');
  console.log('  NEGATIVE PROBES');
  const probeResults = [];
  for (const p of PROBES) {
    const res = runAll(build(p.make()));
    const rejectedBy = res.filter((r) => !r.pass).map((r) => r.id);
    const hit = rejectedBy.includes(p.target);
    probeResults.push({ id: p.id, target: p.target, why: p.why, rejectedBy, hit });
    console.log(`  ${hit ? 'PASS' : 'FAIL'}  ${p.id} -> ${p.target}  rejected by [${rejectedBy.join(', ') || 'NOTHING'}]`);
  }
  const probeFails = probeResults.filter((p) => !p.hit);

  console.log('');
  console.log(`  checks: ${results.length - failed.length}/${results.length} pass`);
  console.log(`  probes: ${probeResults.length - probeFails.length}/${probeResults.length} rejected as designed`);

  mkdirSync(WORK, { recursive: true });
  writeFileSync(join(WORK, 'validation.json'),
    JSON.stringify({ checks: results, probes: probeResults }, null, 2), { encoding: 'utf8' });

  return { results, probeResults, failed, probeFails };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { failed, probeFails } = main();
  if (failed.length || probeFails.length) process.exit(1);
}
