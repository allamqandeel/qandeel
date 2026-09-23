/**
 * I-08B3.1-C3.11 — THE MACHINE-TESTABLE INVARIANTS, EACH WITH A NEGATIVE PROBE.
 *
 * ── WHAT A NEGATIVE PROBE IS HERE, AND WHY IT IS NOT OPTIONAL ────────────────────────────────
 *
 * I-08B3.1-C1 shipped nineteen checks, nineteen green, and two of them could not have gone red: one
 * compared a constant with itself under a comment claiming it asked the builder, and one described
 * itself as a complete colour audit while scanning a notation that excluded half the colours in the
 * package. Neither was found by reading the documents. Both were found by reading the code against
 * the documents.
 *
 * So in this file an invariant is not a function that returns true. It is a PAIR:
 *
 *   check(ctx)  — must PASS on the real package.
 *   probe(ctx)  — returns a deliberately corrupted package on which `check` MUST FAIL.
 *
 * A green row here therefore means two things were observed, not one: that the package satisfies the
 * rule, and that the checker can tell when a package does not. An invariant whose probe passes is
 * reported as a FAILURE of the invariant, because a guard that cannot fire is a sentence.
 *
 * The probes are deliberately the mistakes a real implementer would actually make — a component
 * token with the hex pasted into it, a selected-state alias, a second body called `body-strong`, an
 * opacity ladder, a Light value copied from dark — rather than nonsense that no one would write.
 *
 * ── SCOPE NOTE, STATED BECAUSE C1's AUDIT OVERSTATED ITS OWN ────────────────────────────────
 *
 * These invariants are about the TOKEN OUTPUT and the package's inherited sources. They are not a
 * claim about any future component tree: a React Native app can always hard-code a colour, and no
 * token check will see it. C3_REACT_NATIVE_MAPPING.md says what would have to be checked there, and
 * says plainly that C3 does not check it.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { load, mergeDocs, toCss, srgbHex } from '../vendor/b4r/b4-dtcg.mjs';
import { oklchToSrgbRaw, srgbToOklch, hexToRgb8, contrastHex } from '../vendor/c2/color.mjs';
import { BODY, RESOLVED, RETIRED, WORLD, SURFACE, PRIMARY, SECONDARY, TERTIARY, characterShade }
  from '../vendor/c2/c2-model.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');
export const PROJECT = join(PKG, '..');

const J = (p) => JSON.parse(readFileSync(p, 'utf8'));
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const clone = (o) => JSON.parse(JSON.stringify(o));

export const BRASS = RESOLVED.body.hex;              // #a58e6f

/**
 * THE CHROMA FLOOR THAT SEPARATES "A SECOND BRASS" FROM "THE FROZEN NEUTRALS", DERIVED RATHER THAN
 * CHOSEN.
 *
 * QANDEEL's frozen reading ramp is not perfectly achromatic — `#d8d5ca` sits at Oklab C 0.015 and
 * `#afaca3` at 0.013, because a warm-leaning neutral was a deliberate A-stage decision. The material
 * sits at 0.052. The first version of invariants I-10 and I-12 used a hand-picked floor of 0.012 and
 * consequently reported the frozen reading ramp as two extra Brass bodies: a true result about the
 * numbers and a false one about the system.
 *
 * The floor is therefore computed from the system itself — halfway between the most chromatic frozen
 * neutral and the body — so it cannot be quietly widened to make a future check pass, and so the
 * margin on either side is a reported figure rather than an assurance.
 */
const chromaOf = (hex) => srgbToOklch(hexToRgb8(hex).map((c) => c / 255))[1];
export const NEUTRAL_MAX_CHROMA = Math.max(...[WORLD, SURFACE, PRIMARY, SECONDARY, TERTIARY].map(chromaOf));
export const BODY_CHROMA = chromaOf(BRASS);
export const CHROMA_FLOOR = (NEUTRAL_MAX_CHROMA + BODY_CHROMA) / 2;

/* ------------------------------------------------------------------ the context ---------- */

/**
 * Everything an invariant may look at, built once. `docs` are the raw token documents as they were
 * WRITTEN TO DISK — never the objects in `c3-tokens.mjs` — so a document that fails to serialise the
 * way its author believed is caught here rather than trusted.
 */
export function context() {
  const t = (rel) => join(PKG, 'tokens', rel);
  const v = (rel) => join(PKG, 'vendor', rel);
  const docs = {
    surfaceSemantic: J(v('b4r/semantic.tokens.json')),
    materialSemantic: J(t('base/material.tokens.json')),
    darkSurface: J(v('b4r/dark.tokens.json')),
    darkMaterial: J(t('appearance/dark.material.tokens.json')),
    lightSurface: J(v('b4r/light.tokens.json')),
    lightMaterial: J(t('appearance/light.material.tokens.json')),
    resolver: J(t('qandeel-living-brass.resolver.json')),
  };
  return { docs, pkg: PKG, project: PROJECT };
}

/** Resolve an appearance out of a context's documents. The one place resolution happens. */
function resolveAppearance(ctx, appearance = 'dark') {
  const d = ctx.docs;
  const merged = appearance === 'dark'
    ? mergeDocs([d.surfaceSemantic, d.materialSemantic, d.darkSurface, d.darkMaterial])
    : mergeDocs([d.surfaceSemantic, d.materialSemantic, d.lightSurface, d.lightMaterial]);
  return load(merged, { file: appearance });
}

/** Every leaf `$value` in a document, with its dotted path. Groups and `$extensions` excluded. */
function leaves(doc, path = [], out = []) {
  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) return out;
  if ('$value' in doc) { out.push({ path: path.join('.'), value: doc.$value, type: doc.$type }); return out; }
  for (const [k, v] of Object.entries(doc)) {
    if (k.startsWith('$')) continue;
    leaves(v, path.concat(k), out);
  }
  return out;
}

/** Every string anywhere in a document INCLUDING `$description` and `$extensions`. */
function allStrings(node, out = []) {
  if (typeof node === 'string') { out.push(node); return out; }
  if (node && typeof node === 'object') for (const v of Object.values(node)) allStrings(v, out);
  return out;
}

/** Every colour literal a document actually paints with: a `$value` object carrying a colour. */
function colourLiterals(doc) {
  return leaves(doc)
    .filter((l) => l.value && typeof l.value === 'object' && Array.isArray(l.value.components))
    .map((l) => ({ path: l.path, hex: (l.value.hex || srgbHex(l.value.components)).toLowerCase(),
      alpha: l.value.alpha === undefined ? 1 : l.value.alpha }));
}

/** Walk every file in the package, so an audit cannot be narrower than the thing it audits. */
function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (e.name.startsWith('.')) continue; walk(p, out); }
    else out.push(p);
  }
  return out;
}

/* ================================================================ THE INVARIANTS ========== */

const I = [];
const inv = (id, title, why, check, probe) => I.push({ id, title, why, check, probe });

/* ---- I-01 ------------------------------------------------------------------------------- */
inv('I-01', 'Exactly one dark Living Brass body literal exists',
  'A second copy of the literal is indistinguishable from the first by eye and completely different ' +
  'in kind: it can be changed without changing the material, which is how a one-body system quietly ' +
  'becomes a two-body system.',
  (ctx) => {
    const all = [];
    for (const [name, doc] of Object.entries(ctx.docs)) {
      if (name === 'resolver') continue;
      for (const c of colourLiterals(doc)) if (c.hex === BRASS) all.push(`${name}:${c.path}`);
    }
    return { pass: all.length === 1, detail: `${all.length} literal(s): ${all.join(', ') || 'none'}` };
  },
  (ctx) => {
    const c = clone(ctx);
    c.docs.materialSemantic.qandeel.navigation.machinery = {
      $type: 'color',
      $value: { colorSpace: 'srgb', components: [0.647059, 0.556863, 0.435294], hex: BRASS },
      $description: 'PROBE: the hex pasted into a component token instead of aliased.',
    };
    return c;
  });

/* ---- I-02 ------------------------------------------------------------------------------- */
inv('I-02', 'Identity aliases resolve to the one body',
  'The point of a semantic layer is that the identity names ARRIVE at the material. An identity name ' +
  'that resolves to something else, or to nothing, is a name that lies.',
  (ctx) => {
    const r = resolveAppearance(ctx, 'dark');
    const names = ['qandeel.identity.material', 'qandeel.identity.mark', 'qandeel.identity.moment'];
    const bad = names.filter((n) => {
      const t = r.resolved.get(n);
      return !t || t.state !== 'RESOLVED' || toCss(t.resolved).toLowerCase() !== BRASS;
    });
    return { pass: bad.length === 0, detail: bad.length ? `not the body: ${bad.join(', ')}` : names.join(', ') };
  },
  (ctx) => {
    const c = clone(ctx);
    c.docs.materialSemantic.qandeel.identity.mark.$value = '{qandeel.content.secondary}';
    return c;
  });

/* ---- I-03 ------------------------------------------------------------------------------- */
inv('I-03', 'Persistent navigation machinery resolves to the one body under P2',
  'P2 IS this alias. If it does not arrive at the body, the coverage policy the Design Director ' +
  'selected is not the coverage policy the token file implements.',
  (ctx) => {
    const r = resolveAppearance(ctx, 'dark');
    const t = r.resolved.get('qandeel.navigation.machinery');
    const ok = t && t.state === 'RESOLVED' && toCss(t.resolved).toLowerCase() === BRASS
      && t.chain.includes('qandeel.identity.material');
    return {
      pass: !!ok,
      detail: t ? `${toCss(t.resolved)} via ${t.chain.join(' -> ')}` : 'missing',
    };
  },
  (ctx) => {
    const c = clone(ctx);
    /* The subtler failure, and the more likely one: it still resolves to Brass, but by its OWN route
       rather than through the identity material — so it is no longer the same material story. */
    c.docs.materialSemantic.qandeel.navigation.machinery.$value =
      '{qandeel.expression.material.living-brass.body}';
    return c;
  });

/* ---- I-04 ------------------------------------------------------------------------------- */
inv('I-04', 'No state token resolves to the material, and no state sibling of the family exists',
  'BRASS DOES NOT INDICATE SELECTION. The failure mode is not a token literally called "selected": ' +
  'it is a sibling of the navigation family — navigation.machinery.selected — which is exactly what ' +
  'a developer adds on the afternoon the designer asks for a highlight.',
  (ctx) => {
    const r = resolveAppearance(ctx, 'dark');
    const STATE = /(^|\.)(selected|active|focus|focused|press|pressed|hover|hovered|disabled|unread|current|checked)(\.|$)/i;
    const bad = [];
    for (const [k, t] of r.resolved) {
      if (!STATE.test(k)) continue;
      if (t.state === 'RESOLVED' && typeof t.resolved === 'object' && toCss(t.resolved).toLowerCase() === BRASS) {
        bad.push(k);
      }
    }
    const stateGroup = ctx.docs.materialSemantic.qandeel.state;
    const stateEmpty = Object.keys(stateGroup).every((k) => k.startsWith('$'));
    return {
      pass: bad.length === 0 && stateEmpty,
      detail: bad.length ? `state names reaching the material: ${bad.join(', ')}`
        : `no state name reaches the material; {qandeel.state} holds ${Object.keys(stateGroup).filter((k) => !k.startsWith('$')).length} value(s)`,
    };
  },
  (ctx) => {
    const c = clone(ctx);
    /**
     * THE PROBE HAD TO BE REWRITTEN, AND THE REASON IS WORTH KEEPING.
     *
     * Its first form nested `selected` INSIDE the `machinery` token. In DTCG a token is a leaf — a
     * node with a `$value` — so the nested child was never parsed as a token at all, the check saw
     * nothing, reported PASS, and the invariant was recorded as GUARD-DEAD. The probe was invalid,
     * not the guard; but the run could not tell the difference between "the guard is asleep" and
     * "the corruption was not expressible", which is exactly why probes are run rather than reasoned
     * about.
     *
     * The corruption is now a SIBLING, which is what a real implementation would produce: a
     * navigation family painted neutral, with a selected variant painted in the material.
     */
    c.docs.materialSemantic.qandeel.navigation.machinery.$value = '{qandeel.content.secondary}';
    c.docs.materialSemantic.qandeel.navigation.selected =
      { $value: '{qandeel.identity.material}', $description: 'PROBE: Brass turns on when selected.' };
    return c;
  });

/* ---- I-05 ------------------------------------------------------------------------------- */
inv('I-05', 'No status token aliases the material, and the status namespace is empty',
  'Living Brass is forbidden as a status code. The namespace is reserved and empty so that this ' +
  'check has a real surface to guard rather than passing because nothing exists.',
  (ctx) => {
    const r = resolveAppearance(ctx, 'dark');
    const ST = /(^|\.)(status|success|warning|error|danger|caution|info|informational)(\.|$)/i;
    const bad = [];
    for (const [k, t] of r.resolved) {
      if (ST.test(k) && t.state === 'RESOLVED' && typeof t.resolved === 'object'
        && toCss(t.resolved).toLowerCase() === BRASS) bad.push(k);
    }
    const g = ctx.docs.materialSemantic.qandeel.status;
    const empty = !!g && Object.keys(g).every((k) => k.startsWith('$'));
    return { pass: bad.length === 0 && empty, detail: bad.length ? bad.join(', ') : 'status reserved and empty' };
  },
  (ctx) => {
    const c = clone(ctx);
    c.docs.materialSemantic.qandeel.status.warning =
      { $type: 'color', $value: '{qandeel.identity.material}', $description: 'PROBE: Brass as a warning colour.' };
    return c;
  });

/* ---- I-06 ------------------------------------------------------------------------------- */
inv('I-06', 'No analytical token resolves to the material',
  'The Living Analysis Map is the proprietary QANDEEL world and its truth is geometric. Brass on an ' +
  'analytical mark would make the material encode analytical importance — the single prohibition ' +
  'that has survived unchanged since C0.',
  (ctx) => {
    const r = resolveAppearance(ctx, 'dark');
    const AN = /(^|\.)(analysis|analytical|node|relation|edge|cluster|rank|confidence|evidence|depth|near|mid|far)(\.|$)/i;
    const bad = [];
    for (const [k, t] of r.resolved) {
      if (AN.test(k) && t.state === 'RESOLVED' && typeof t.resolved === 'object'
        && toCss(t.resolved).toLowerCase() === BRASS) bad.push(k);
    }
    return { pass: bad.length === 0, detail: bad.length ? bad.join(', ') : 'analytical plane entirely neutral' };
  },
  (ctx) => {
    const c = clone(ctx);
    c.docs.materialSemantic.qandeel.analysis.node.$value = '{qandeel.identity.material}';
    return c;
  });

/* ---- I-07 ------------------------------------------------------------------------------- */
inv('I-07', 'No text or content token resolves to the material — BRASS NEVER SETS TYPE',
  'A reading ramp with a warm member in it is a reading ramp whose rungs no longer mean only rank. ' +
  'This is also where a "Brass heading" would enter, which C2 captured as a failure.',
  (ctx) => {
    const r = resolveAppearance(ctx, 'dark');
    const TX = /(^|\.)(content|text|type|heading|title|body|label|caption|quote|lede)(\.|$)/i;
    const bad = [];
    for (const [k, t] of r.resolved) {
      /* `qandeel.expression.material.living-brass.body` contains the word "body" and IS the material.
         Excluding it by path prefix rather than by name keeps the check honest: it is the one token
         the rule is not about, and saying so explicitly is better than a looser pattern. */
      if (k.startsWith('qandeel.expression.material.')) continue;
      if (TX.test(k) && t.state === 'RESOLVED' && typeof t.resolved === 'object'
        && toCss(t.resolved).toLowerCase() === BRASS) bad.push(k);
    }
    return { pass: bad.length === 0, detail: bad.length ? bad.join(', ') : 'no type role reaches the material' };
  },
  (ctx) => {
    const c = clone(ctx);
    c.docs.materialSemantic.qandeel.content = {
      $type: 'color',
      heading: { $value: '{qandeel.identity.material}', $description: 'PROBE: Brass headings.' },
    };
    return c;
  });

/* ---- I-08 ------------------------------------------------------------------------------- */
inv('I-08', 'No border, divider, rule or outline token resolves to the material — BRASS NEVER ENCLOSES',
  'Brass borders around dark cards are named in the brief as a production failure, and they are the ' +
  'single fastest route from a material identity to a luxury relabel: an enclosure reads as a frame, ' +
  'and a warm frame on a dark card reads as gold trim.',
  (ctx) => {
    const r = resolveAppearance(ctx, 'dark');
    const BD = /(^|\.)(border|divider|rule|outline|stroke|separator|hairline|edge|frame)(\.|$)/i;
    const bad = [];
    for (const [k, t] of r.resolved) {
      if (BD.test(k) && t.state === 'RESOLVED' && typeof t.resolved === 'object'
        && toCss(t.resolved).toLowerCase() === BRASS) bad.push(k);
    }
    return { pass: bad.length === 0, detail: bad.length ? bad.join(', ') : 'no enclosure reaches the material' };
  },
  (ctx) => {
    const c = clone(ctx);
    c.docs.materialSemantic.qandeel.divider =
      { $type: 'color', hairline: { $value: '{qandeel.identity.material}', $description: 'PROBE: Brass dividers.' } };
    return c;
  });

/* ---- I-09 ------------------------------------------------------------------------------- */
inv('I-09', 'No Brass opacity ladder exists',
  'An opacity ladder is the most respectable-looking way to build a second, third and fourth Brass ' +
  'without ever authoring a second hex. Every rung is "the same colour", and the system ends up with ' +
  'five materials.',
  (ctx) => {
    const bad = [];
    for (const [name, doc] of Object.entries(ctx.docs)) {
      if (name === 'resolver') continue;
      for (const c of colourLiterals(doc)) {
        if (c.hex === BRASS && c.alpha !== 1) bad.push(`${name}:${c.path} @ alpha ${c.alpha}`);
      }
      /**
       * An alias cannot carry alpha in DTCG, so an opacity ladder has to appear either as a colour
       * literal with alpha (above) or as a NUMBER token that a component would multiply the material
       * by. Both are searched.
       *
       * The pattern is anchored on the token's OWN NAME rather than on its ancestry, which is the
       * correction this check needed: an earlier version matched any numeric token whose path
       * contained "material" and "alpha" anywhere, and so fired on the noise field's coverage map —
       * two numbers that are not the material's opacity at all. That token has since been renamed,
       * and this pattern would no longer match it even if it had not been.
       */
      for (const l of leaves(doc)) {
        const own = l.path.split('.').pop();
        if (typeof l.value === 'number'
          && /^(opacity|alpha|emphasis|muted|subtle|faint|strong|weak|dim)$/i.test(own)
          && /(brass|identity)/i.test(l.path)) {
          bad.push(`${name}:${l.path} = ${l.value}`);
        }
      }
    }
    return { pass: bad.length === 0, detail: bad.length ? bad.join(', ') : 'the material is opaque and has one rung' };
  },
  (ctx) => {
    const c = clone(ctx);
    c.docs.darkMaterial.qandeel.expression.material['living-brass'].muted = {
      $value: { colorSpace: 'srgb', components: [0.647059, 0.556863, 0.435294], hex: BRASS, alpha: 0.6 },
      $description: 'PROBE: a 60 % rung.',
    };
    return c;
  });

/* ---- I-10 ------------------------------------------------------------------------------- */
inv('I-10', 'No Brass lightness or chroma ladder exists — the character tone is derived, not stored',
  'The character IS one lightness step below the body. Storing that step as a colour token would ' +
  'create a two-value Brass ladder, and a two-value ladder is how a five-value ladder starts. It is ' +
  'therefore specified as algorithmic intent — a ratio and a direction — and derived at render time.',
  (ctx) => {
    const bad = [];
    for (const [name, doc] of Object.entries(ctx.docs)) {
      if (name === 'resolver') continue;
      for (const c of colourLiterals(doc)) {
        if (c.hex === BRASS) continue;
        const [, C, H] = srgbToOklch(hexToRgb8(c.hex).map((x) => x / 255));
        /* Any second colour sharing the material's warm direction ABOVE THE DERIVED FLOOR is a rung,
           whatever it is called. Testing the VALUE rather than the NAME is the point: a ladder built
           out of tokens called `tone-1` and `tone-2` would sail past a name-based check. */
        if (C > CHROMA_FLOOR && Math.abs(((H - BODY.H + 540) % 360) - 180) < 25) {
          bad.push(`${name}:${c.path} = ${c.hex} (C ${C.toFixed(3)}, H ${H.toFixed(1)})`);
        }
      }
    }
    const t = ctx.docs.materialSemantic.qandeel.material['living-brass'].character.toneDepthRatio;
    return {
      pass: bad.length === 0 && !!t && typeof t.$value === 'number',
      detail: bad.length ? `second warm value(s): ${bad.join(', ')}`
        : `one warm value above the derived floor C ${CHROMA_FLOOR.toFixed(4)} ` +
          `(frozen neutrals top out at ${NEUTRAL_MAX_CHROMA.toFixed(4)}, the body sits at ` +
          `${BODY_CHROMA.toFixed(4)}); the character tone is a ratio (${t.$value}) and a direction`,
    };
  },
  (ctx) => {
    const c = clone(ctx);
    c.docs.darkMaterial.qandeel.expression.material['living-brass'].shade = {
      $value: { colorSpace: 'srgb', components: [0.588235, 0.498039, 0.376471], hex: '#967f60' },
      $description: 'PROBE: the character tone stored as a second Brass value.',
    };
    return c;
  });

/* ---- I-11 ------------------------------------------------------------------------------- */
inv('I-11', 'The retired bodies appear nowhere except where they are named as retired',
  'A retired value that survives anywhere in the production output is a value someone can resurrect ' +
  'by deleting a comment. The retirement record is allowed to name them; nothing else is.',
  (ctx) => {
    const retiredHexes = RETIRED.filter((r) => r.hex).map((r) => r.hex.toLowerCase());
    const bad = [];

    /**
     * THE ONE PLACE A RETIRED VALUE IS ALLOWED TO APPEAR, IDENTIFIED STRUCTURALLY.
     *
     * The first version of this check allowed a retired hex in any string that also contained the
     * word "retired" — and then failed on the real package, because in the retirement record the hex
     * is its OWN string (`"hex": "#857867"`) and the word "retired" is in a sibling field. That was
     * a text heuristic standing in for a structural fact. The structural fact is this exact path,
     * and it is now read directly: everything reached through it is permitted, and every other
     * occurrence anywhere in any document is a failure.
     */
    const record = ctx.docs.darkMaterial?.qandeel?.expression?.material?.['living-brass']?.body
      ?.$extensions?.['com.qandeel.provenance']?.retired;
    const permitted = new Set(Array.isArray(record) ? record.filter((r) => r.hex).map((r) => r.hex.toLowerCase()) : []);

    for (const [name, doc] of Object.entries(ctx.docs)) {
      for (const c of colourLiterals(doc)) {
        if (retiredHexes.includes(c.hex)) bad.push(`PAINTED ${name}:${c.path} = ${c.hex}`);
      }
      /* Strings, with the retirement record's own entries lifted out first so the record is not
         audited against itself. */
      const recordStrings = new Set(Array.isArray(record) ? allStrings(record) : []);
      for (const s of allStrings(doc)) {
        if (recordStrings.has(s)) continue;
        for (const h of retiredHexes) if (s.toLowerCase().includes(h)) bad.push(`TEXT ${name}: "${s.slice(0, 60)}"`);
      }
    }
    const recorded = retiredHexes.every((h) => permitted.has(h));
    return {
      pass: bad.length === 0 && recorded,
      detail: bad.length ? bad.join(' | ')
        : `${retiredHexes.length} retired value(s) named ONLY in the retirement record at ` +
          'qandeel.expression.material.living-brass.body.$extensions["com.qandeel.provenance"].retired',
    };
  },
  (ctx) => {
    const c = clone(ctx);
    c.docs.materialSemantic.qandeel.identity.legacy = {
      $type: 'color',
      $value: { colorSpace: 'srgb', components: [0.521569, 0.470588, 0.403922], hex: '#857867' },
      $description: 'PROBE: BODY A back as a component value.',
    };
    return c;
  });

/* ---- I-12 ------------------------------------------------------------------------------- */
inv('I-12', 'No second Living Brass body exists, under any name',
  'I-01 counts copies of the one literal. This counts NEIGHBOURS of it: a "brass-strong" or ' +
  '"brass-on-surface" at a slightly different value would pass a duplicate check and would still be ' +
  'a second material.',
  (ctx) => {
    const warm = [];
    for (const [name, doc] of Object.entries(ctx.docs)) {
      if (name === 'resolver') continue;
      for (const c of colourLiterals(doc)) {
        const [, C] = srgbToOklch(hexToRgb8(c.hex).map((x) => x / 255));
        if (C > CHROMA_FLOOR) warm.push(`${name}:${c.path} = ${c.hex}`);
      }
    }
    const unique = new Set(warm.map((w) => w.split('= ')[1]));
    return {
      pass: unique.size === 1,
      detail: `${unique.size} value(s) above the derived chroma floor C ${CHROMA_FLOOR.toFixed(4)}: ` +
        `${[...unique].join(', ')} — the frozen reading ramp sits below it at C ` +
        `${NEUTRAL_MAX_CHROMA.toFixed(4)} and is correctly NOT counted as a second body`,
    };
  },
  (ctx) => {
    const c = clone(ctx);
    c.docs.darkMaterial.qandeel.expression.material['living-brass'].onSurface = {
      $value: { colorSpace: 'srgb', components: [0.67451, 0.580392, 0.454902], hex: '#ac9474' },
      $description: 'PROBE: a second body, tuned for the Surface.',
    };
    return c;
  });

/* ---- I-13 ------------------------------------------------------------------------------- */
inv('I-13', 'No Light appearance value is invented — light resolution FAILS LOUDLY',
  'A light set containing a copy of the dark body would be a Light Brass invented by accident, ' +
  'shipping under a name someone trusted. The architecture is dark-led and not dark-locked, and the ' +
  'difference between those two is exactly this check.',
  (ctx) => {
    const lit = colourLiterals(ctx.docs.lightMaterial);
    const r = resolveAppearance(ctx, 'light');
    const brassNames = ['qandeel.identity.material', 'qandeel.identity.mark', 'qandeel.identity.moment',
      'qandeel.navigation.machinery'];
    const stillResolving = brassNames.filter((n) => {
      const t = r.resolved.get(n);
      return t && t.state === 'RESOLVED';
    });
    return {
      pass: lit.length === 0 && stillResolving.length === 0,
      detail: lit.length ? `light carries ${lit.length} colour value(s)`
        : stillResolving.length ? `resolves in light: ${stillResolving.join(', ')}`
          : `light carries no value; all ${brassNames.length} material names UNRESOLVED and named`,
    };
  },
  (ctx) => {
    const c = clone(ctx);
    c.docs.lightMaterial.qandeel.expression.material['living-brass'] = {
      body: {
        $type: 'color',
        $value: { colorSpace: 'srgb', components: [0.647059, 0.556863, 0.435294], hex: BRASS },
        $description: 'PROBE: the dark body copied into light because "it looks fine".',
      },
    };
    return c;
  });

/* ---- I-14 ------------------------------------------------------------------------------- */
inv('I-14', 'The QANDEEL Light namespace is reserved, empty, and not aliased to the material',
  'BRASS IS MATTER. LIGHT IS MEANING. The likeliest way that doctrine gets broken is not an ' +
  'argument but a collision: "QANDEEL Light" and "light appearance" share an English word, and an ' +
  'implementer who conflates them wires illumination to the material without ever deciding to.',
  (ctx) => {
    const g = ctx.docs.materialSemantic.qandeel.illumination;
    const present = !!g;
    const empty = present && Object.keys(g).every((k) => k.startsWith('$'));
    const r = resolveAppearance(ctx, 'dark');
    const bad = [];
    for (const [k, t] of r.resolved) {
      if (/(^|\.)(illumination|glow|light|luminous|halo|bloom|radiance)(\.|$)/i.test(k)
        && t.state === 'RESOLVED' && typeof t.resolved === 'object'
        && toCss(t.resolved).toLowerCase() === BRASS) bad.push(k);
    }
    return {
      pass: present && empty && bad.length === 0,
      detail: !present ? 'the namespace is not reserved at all'
        : bad.length ? `illumination names reaching the material: ${bad.join(', ')}`
          : 'reserved, empty, and unaliased',
    };
  },
  (ctx) => {
    const c = clone(ctx);
    c.docs.materialSemantic.qandeel.illumination.glow =
      { $type: 'color', $value: '{qandeel.identity.material}', $description: 'PROBE: Light wired to Brass.' };
    return c;
  });

/* ---- I-15 ------------------------------------------------------------------------------- */
inv('I-15', 'Functional control families do not inherit the material',
  'This is the boundary between P2 and "every icon gold". A functional control is not identity-' +
  'bearing because it is visible, persistent or important, and the way that rule dies is group ' +
  'inheritance — one `$type`-style default on a parent and the whole family is warm.',
  (ctx) => {
    const r = resolveAppearance(ctx, 'dark');
    const FN = /(^|\.)(control|action|send|add|plus|back|close|overflow|edit|settings|checkbox|radio|toggle|switch|utility|affordance|chevron)(\.|$)/i;
    const bad = [];
    for (const [k, t] of r.resolved) {
      if (FN.test(k) && t.state === 'RESOLVED' && typeof t.resolved === 'object'
        && toCss(t.resolved).toLowerCase() === BRASS) bad.push(k);
    }
    const fn = r.resolved.get('qandeel.control.functional');
    return {
      pass: bad.length === 0 && !!fn && toCss(fn.resolved).toLowerCase() === TERTIARY,
      detail: bad.length ? bad.join(', ') : `functional controls resolve to ${fn ? toCss(fn.resolved) : '?'} (the frozen tertiary neutral)`,
    };
  },
  (ctx) => {
    const c = clone(ctx);
    c.docs.materialSemantic.qandeel.control.action =
      { $value: '{qandeel.identity.material}', $description: 'PROBE: the send button made of the material.' };
    return c;
  });

/* ================================ BEYOND THE BRIEF'S MINIMUM ============================== */

/* ---- I-16 ------------------------------------------------------------------------------- */
inv('I-16', 'The sRGB literal round-trips from the authored OkLCh triple',
  'The token stores sRGB and records OkLCh as provenance. If the two ever disagree, the production ' +
  'value and the value every C-stage document describes are different colours — and the disagreement ' +
  'would be invisible, because each is internally consistent.',
  (ctx) => {
    const ext = ctx.docs.darkMaterial.qandeel.expression.material['living-brass'].body
      .$extensions['com.qandeel.provenance'].authoredAs;
    const rgb = oklchToSrgbRaw([ext.L, ext.C, ext.H]);
    const hex = '#' + rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('');
    const stored = ctx.docs.darkMaterial.qandeel.expression.material['living-brass'].body.$value.hex;
    const fromComponents = srgbHex(ctx.docs.darkMaterial.qandeel.expression.material['living-brass'].body.$value.components);
    return {
      pass: hex === stored && fromComponents === stored && stored === BRASS,
      detail: `oklch(${ext.L} ${ext.C} ${ext.H}) -> ${hex}; components -> ${fromComponents}; stored ${stored}`,
    };
  },
  (ctx) => {
    const c = clone(ctx);
    /* The realistic corruption: components edited by hand to "clean" numbers that no longer round
       to the stored hex. Every serialiser accepts this silently. */
    c.docs.darkMaterial.qandeel.expression.material['living-brass'].body.$value.components = [0.65, 0.56, 0.44];
    return c;
  });

/* ---- I-17 ------------------------------------------------------------------------------- */
inv('I-17', 'Every inherited file is byte-identical to the sealed package it came from',
  'C3 builds on frozen work. "Vendored" has to mean UNCHANGED, or the freeze it claims to extend is ' +
  'a freeze of something else. The check hashes against the sealed predecessor packages rather than ' +
  'trusting the directory name.',
  (ctx) => {
    const pairs = [
      ['vendor/b4r/b4-dtcg.mjs', 'I-08B3.1-B4R-DTCG-RESOLVER-CONFORMANCE-FINAL/tools/b4-dtcg.mjs'],
      ['vendor/b4r/semantic.tokens.json', 'I-08B3.1-B4R-DTCG-RESOLVER-CONFORMANCE-FINAL/tokens/base/semantic.tokens.json'],
      ['vendor/b4r/dark.tokens.json', 'I-08B3.1-B4R-DTCG-RESOLVER-CONFORMANCE-FINAL/tokens/appearance/dark.tokens.json'],
      ['vendor/b4r/light.tokens.json', 'I-08B3.1-B4R-DTCG-RESOLVER-CONFORMANCE-FINAL/tokens/appearance/light.tokens.json'],
      ['vendor/c2/c2-model.mjs', 'I-08B3.1-C2-LIVING-BRASS-PRODUCT-INTEGRATION/tools/c2-model.mjs'],
      ['vendor/c2/c2-ui.mjs', 'I-08B3.1-C2-LIVING-BRASS-PRODUCT-INTEGRATION/tools/c2-ui.mjs'],
      ['vendor/c2/color.mjs', 'I-08B3.1-C2-LIVING-BRASS-PRODUCT-INTEGRATION/tools/color.mjs'],
      ['reference/canonical/QANDEEL_Q_BASE_MASTER.svg', 'I-08B3.1-C2-LIVING-BRASS-PRODUCT-INTEGRATION/reference/canonical/QANDEEL_Q_BASE_MASTER.svg'],
      ['reference/canonical/QANDEEL_Q_BASE_MASTER.svg', 'I-08B2.5-FINAL-BRAND-ASSET-PACKAGE/masters/QANDEEL_Q_BASE_MASTER.svg'],
    ];
    const rows = [], missing = [], differ = [];
    for (const [local, upstream] of pairs) {
      const lp = join(ctx.pkg, local), up = join(ctx.project, upstream);
      if (!existsSync(up)) { missing.push(upstream); continue; }
      const same = sha(lp) === sha(up);
      rows.push({ local, upstream, same });
      if (!same) differ.push(local);
    }
    /**
     * A THIRD OUTCOME, AND IT IS NOT A HEDGE.
     *
     * In a bare extraction — no project root, no sibling packages — there is nothing to compare
     * against. Reporting FAIL would be wrong: nothing is broken. Reporting PASS would be worse: it
     * would claim a verification that did not happen, which is the exact failure this whole file
     * exists to prevent.
     *
     * So the check returns `pass: null` and the runner reports UNVERIFIABLE HERE. The in-place run,
     * where the predecessors exist, still requires a true PASS.
     */
    if (rows.length === 0) {
      return { pass: null,
        detail: `no sealed predecessor present to compare against (${missing.length} expected) — ` +
          'byte-identity cannot be verified in a bare extraction and is NOT claimed here',
        soft: missing };
    }
    return {
      pass: differ.length === 0,
      detail: differ.length ? `DIFFER: ${differ.join(', ')}`
        : `${rows.length} file(s) byte-identical to their sealed source` +
          (missing.length ? `; ${missing.length} predecessor(s) not present to compare` : ''),
      soft: missing,
    };
  },
  (ctx) => {
    /* The probe cannot corrupt a file on disk, so it redirects the comparison at a file that is
       genuinely different. A guard that only ever sees matching pairs has never been shown to
       notice a mismatch. */
    const c = clone(ctx);
    c.pkg = join(ctx.pkg, 'vendor', 'c2');   // vendor/c2/vendor/c2/... does not exist -> and where it
    c.__probeRedirect = true;                //   does resolve, the bytes are not the sealed ones
    return c;
  });

/* ---- I-18 ------------------------------------------------------------------------------- */
inv('I-18', 'No font binary and no forbidden token name ships',
  'Two package-hygiene rules in one check because both are about what the ZIP contains rather than ' +
  'what the tokens mean. The font is a LOCAL RUNTIME DEPENDENCY, referenced and hashed, never ' +
  'redistributed. The names are the brief\'s list: gold, amber, yellow, accent, brandAccent, ' +
  'selectedColor — each one a name that would tell a future reader the wrong thing about what this is.',
  (ctx) => {
    const FONT = /\.(ttf|otf|woff2?|eot|ttc|pfb)$/i;
    const fonts = walk(ctx.pkg).filter((p) => FONT.test(p)).map((p) => relative(ctx.pkg, p));
    const BAD_NAME = /(^|\.)(gold|amber|yellow|accent|brandaccent|brand-accent|selectedcolor|selected-color)(\.|$)/i;
    const names = [];
    for (const [name, doc] of Object.entries(ctx.docs)) {
      if (name === 'resolver') continue;
      for (const l of leaves(doc)) if (BAD_NAME.test(l.path)) names.push(`${name}:${l.path}`);
    }
    return {
      pass: fonts.length === 0 && names.length === 0,
      detail: (fonts.length ? `FONT BINARIES: ${fonts.join(', ')} ` : 'no font binary; ') +
        (names.length ? `FORBIDDEN NAMES: ${names.join(', ')}` : 'no forbidden token name'),
    };
  },
  (ctx) => {
    const c = clone(ctx);
    c.docs.materialSemantic.qandeel.identity.accent =
      { $value: '{qandeel.identity.material}', $description: 'PROBE: the material renamed to an accent.' };
    return c;
  });

/* ---- I-19 ------------------------------------------------------------------------------- */
inv('I-19', 'The material clears 3:1 on both frozen grounds where it is an essential component visual',
  'Under P2 the persistent navigation family is an ESSENTIAL UI COMPONENT VISUAL, so WCAG 2.2 SC ' +
  '1.4.11 applies to it and is not optional. C2 classified the four usages; C3 re-measures rather ' +
  'than citing, because a production spec that quotes a number it did not compute is a spec that ' +
  'cannot notice when the number changes.',
  (ctx) => {
    const r = resolveAppearance(ctx, 'dark');
    const brass = toCss(r.resolved.get('qandeel.navigation.machinery').resolved);
    const onWorld = contrastHex(brass, WORLD);
    const onSurface = contrastHex(brass, SURFACE);
    return {
      pass: onWorld >= 3 && onSurface >= 3,
      detail: `${brass}: ${onWorld.toFixed(3)}:1 on the World ${WORLD}, ${onSurface.toFixed(3)}:1 on the Surface ${SURFACE}`,
    };
  },
  (ctx) => {
    const c = clone(ctx);
    /* Not a fantasy: this is what "tone it down so it stops looking like gold" produces, and it is
       the move C2 was forbidden to make. The check has to be able to see it. */
    c.docs.darkMaterial.qandeel.expression.material['living-brass'].body.$value =
      { colorSpace: 'srgb', components: [0.32, 0.28, 0.22], hex: '#524738' };
    return c;
  });

/* ---- I-20 ------------------------------------------------------------------------------- */
inv('I-20', 'Every resolver $ref resolves to a file that exists',
  'The resolver is the document that says what the system IS. A $ref pointing at a file that was ' +
  'renamed resolves to nothing, and a resolver that silently drops a set produces a smaller system ' +
  'that still validates.',
  (ctx) => {
    const refs = [];
    const collect = (n) => {
      if (Array.isArray(n)) return n.forEach(collect);
      if (n && typeof n === 'object') {
        for (const [k, v] of Object.entries(n)) {
          if (k === '$ref' && typeof v === 'string' && !v.startsWith('#')) refs.push(v);
          else collect(v);
        }
      }
    };
    collect(ctx.docs.resolver);
    const base = join(ctx.pkg, 'tokens');
    const missing = refs.filter((r) => !existsSync(join(base, r)));
    return {
      pass: refs.length > 0 && missing.length === 0,
      detail: missing.length ? `missing: ${missing.join(', ')}` : `${refs.length} file $ref(s), all present`,
    };
  },
  (ctx) => {
    const c = clone(ctx);
    c.docs.resolver.sets['material-semantic'].sources = [{ $ref: './base/material.tokens.json.bak' }];
    return c;
  });

/* ---- I-21 ------------------------------------------------------------------------------- */
inv('I-21', 'The character tone derives from the AUTHORED triple, and the obvious derivation is wrong',
  'A production spec has to say which number an implementer starts from when two candidates are both ' +
  'called "the body". Starting from the 8-bit sRGB value — the obvious choice, and the one the token ' +
  'paints with — produces a character tone one step off the accepted material, and no colour test ' +
  'would catch it because both values are plausible Brass. This invariant asserts BOTH halves, so ' +
  'the divergence is a standing measurement rather than a remark that could go stale.',
  (ctx) => {
    const body = ctx.docs.darkMaterial.qandeel.expression.material['living-brass'].body;
    const a = body.$extensions['com.qandeel.provenance'].authoredAs;
    const ch = ctx.docs.materialSemantic.qandeel.material['living-brass'].character;
    const depth = ch.amplitude.$value / ch.toneDepthRatio.$value;

    const toHex = (rgb) => '#' + rgb.map((c) =>
      Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('');

    const fromAuthored = toHex(oklchToSrgbRaw([a.L - depth, a.C, a.H]));
    const [mL, mC, mH] = srgbToOklch(hexToRgb8(body.$value.hex).map((c) => c / 255));
    const fromQuantised = toHex(oklchToSrgbRaw([mL - depth, mC, mH]));

    /* The tone the accepted evidence was made with, read from the sealed C2 model rather than
       restated here — so this compares against the shipped material, not against a number typed
       into this file. */
    const accepted = characterShade().hex;

    const contract = ctx.docs.materialSemantic.qandeel.material['living-brass']
      .$extensions['com.qandeel.material-contract'];
    return {
      pass: ch.derivationVersion.$value === 1
        && /AUTHORED-OKLCH/.test(contract.characterDerivation)
        && fromAuthored === accepted
        && fromQuantised !== accepted,
      detail: `spec route (authored oklch ${a.L} ${a.C} ${a.H}, depth ${depth.toFixed(6)}) -> ` +
        `${fromAuthored} = accepted ${accepted}; obvious route (quantised ${body.$value.hex}) -> ` +
        `${fromQuantised}, which is ${fromQuantised === accepted ? 'the same' : 'DIFFERENT and is why the spec names a source'}`,
    };
  },
  (ctx) => {
    const c = clone(ctx);
    /* The realistic corruption: someone tidies the spec by pointing the derivation at the value the
       token actually paints with, because that is obviously the body. */
    c.docs.materialSemantic.qandeel.material['living-brass'].character.derivationVersion.$value = 2;
    c.docs.materialSemantic.qandeel.material['living-brass']
      .$extensions['com.qandeel.material-contract'].characterDerivation =
      'SRGB-BODY. Derive the tone from the value the token paints with.';
    return c;
  });

export const INVARIANTS = I;

/* ===================================================================== RUNNER ============= */

export function runAll() {
  const rows = [];
  for (const it of I) {
    const base = context();
    let real, probeResult, probeThrew = null;
    try { real = it.check(base); } catch (e) { real = { pass: false, detail: `THREW: ${e.message}` }; }
    try {
      probeResult = it.check(it.probe(context()));
    } catch (e) {
      /* A probe that makes the checker THROW has also demonstrated the checker noticed. Recorded as
         a distinct outcome rather than silently counted as a pass, because "it crashed" and "it
         returned false" are different qualities of guard and the reader deserves to know which. */
      probeThrew = e.message.split('\n')[0].slice(0, 90);
      probeResult = { pass: false, detail: `checker threw: ${probeThrew}` };
    }
    /**
     * `pass === null` means the check could not RUN here — it is neither satisfied nor violated.
     * It is counted separately, it does not fail the build, and it is never silently folded into
     * either of the other two outcomes.
     */
    const unverifiable = real.pass === null;
    rows.push({
      id: it.id, title: it.title, why: it.why,
      pass: real.pass, unverifiable, detail: real.detail,
      probeFired: unverifiable ? null : !probeResult.pass,
      probeDetail: probeResult.detail, probeThrew,
      ok: unverifiable ? null : (real.pass && !probeResult.pass),
    });
  }
  return rows;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = runAll();
  for (const r of rows) {
    const mark = r.unverifiable ? 'UNVERIFIABLE' : (r.ok ? 'PASS' : (!r.pass ? 'FAIL' : 'GUARD-DEAD'));
    console.log(`${mark.padEnd(13)} ${r.id}  ${r.title}`);
    console.log(`              ${r.detail}`);
    if (r.probeFired === false) console.log(`              !! PROBE DID NOT FIRE: ${r.probeDetail}`);
  }
  const ok = rows.filter((r) => r.ok === true).length;
  const unver = rows.filter((r) => r.unverifiable).length;
  const broken = rows.filter((r) => r.ok === false);
  console.log(`\n${ok}/${rows.length - unver} verifiable invariants hold AND their probes fired` +
    (unver ? `; ${unver} could not be verified in this environment and ${unver === 1 ? 'is' : 'are'} NOT claimed` : '') + '.');
  if (broken.length) process.exitCode = 1;
}
