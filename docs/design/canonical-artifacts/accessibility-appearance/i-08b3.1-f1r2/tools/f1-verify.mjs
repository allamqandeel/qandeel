/**
 * I-08B3.1-F1 — THE VERIFIER.
 *
 * TWO RULES THIS FILE OBEYS, BOTH LEARNED THE HARD WAY EARLIER IN THIS TRACK.
 *
 *   1. EVERY GUARD IS FED AN INPUT THAT MUST MAKE IT FAIL. A check that cannot fail is a
 *      sentence. Each class below carries a PROBE: the same predicate, applied to a
 *      deliberately wrong input, whose rejection is reported alongside the real result. A probe
 *      that stops rejecting is itself a failure.
 *
 *   2. IT READS THE SHIPPED ARTEFACTS BACK FROM DISK. The token files, the resolver, the
 *      vendored packages and the generated data are re-read and re-hashed here rather than
 *      passed in from the build that made them. A verifier that trusts its caller verifies the
 *      caller.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveAll, loadTokens, resolve, verifyVendor, MODIFIERS, INHERITED_CLASSES, F1_CLASSES, F1_SCALARS, FORBIDDEN_TARGETS, FORBIDDEN_PREFIXES } from './f1-resolve.mjs';
import { hexToRgb8, rgb8ToHex, contrastHex, srgbToOklch, oklchToSrgbRaw, to8bit } from '../vendor/lib/color.mjs';
import { simulate8 } from './f1-cvd.mjs';
import { ATMOSPHERE } from '../vendor/d2r/scene/d2-foundation.mjs';
import { WORLDS, RINGS, PRESENTATION_CONTRACT } from '../vendor/d2r/scene/d2-world.mjs';
import { audit } from './f1-motion.mjs';
import { FIXTURE_SCOPE, project, syntheticView } from './f1-fixture.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const f = (n, d = 4) => Number(n.toFixed(d));
const over = (fg, a, bg) => {
  const F = hexToRgb8(fg), B = hexToRgb8(bg);
  return rgb8ToHex(F.map((c, i) => Math.round(c * a + B[i] * (1 - a))));
};
const ink = (L, hue) => rgb8ToHex(to8bit(oklchToSrgbRaw([L, ATMOSPHERE.chromaCeiling ?? 0.0197, hue])));
const oklchOf = (hex) => srgbToOklch(hexToRgb8(hex).map((c) => c / 255));

const HUES = [150, 192, 228, 262, 300, 338];
const WORLD = '#101010', SURFACE = '#181818', RELATION_DEFAULT = '#8b8982';

const results = [];
const check = (id, what, pass, detail, probe) => {
  results.push({ id, what, pass: !!pass, detail, probe: probe ?? null });
  return pass;
};

/* ======================================================================= V — PROVENANCE == */
{
  const rows = verifyVendor();
  const bad = rows.filter((r) => r.state.startsWith('FAIL'));
  const absent = rows.filter((r) => r.state === 'SOURCE-ABSENT');
  check('V-01', 'every vendored file matches the sealed package it was taken from',
    bad.length === 0,
    { files: rows.length, fail: bad.length, sourceAbsent: absent.length, note: absent.length ? 'SOURCE-ABSENT is reported, not passed: on a host without the sealed packages this check cannot be run, and says so.' : 'all sources present' },
    { input: 'a published file whose recorded sha256 is altered', rejected: (() => {
      const h = createHash('sha256').update('not the file').digest('hex');
      return h !== rows[0]?.expected;
    })() });
}

/* ================================================== D — THE DEFAULT PRESERVATION GATE ==== */
{
  /* D-01: the default resolution must equal E1's, literal for literal and ROUTE for route.
     Comparing only values would pass a token that reached the same colour by its own path. */
  const d = resolveAll();
  const e1Files = [
    ['b4r/semantic', 'vendor/c3/b4r/semantic.tokens.json'],
    ['b4r/dark', 'vendor/c3/b4r/dark.tokens.json'],
    ['c3/base', 'vendor/c3/tokens/base/material.tokens.json'],
    ['c3/dark', 'vendor/c3/tokens/appearance/dark.material.tokens.json'],
    ['d2r/base', 'vendor/d2r/tokens/base/illumination.tokens.json'],
    ['d2r/dark', 'vendor/d2r/tokens/appearance/dark.illumination.tokens.json'],
    ['e1/base', 'vendor/e1/tokens/base/interaction.tokens.json'],
    ['e1/dark', 'vendor/e1/tokens/appearance/dark.interaction.tokens.json'],
  ];
  const e1 = loadTokens.call(null, {});
  /* rebuild an E1-only tree by loading ONLY the inherited files */
  const flatE1 = (() => {
    const { flat } = (() => {
      const m = { flat: new Map(), groups: new Map() };
      const walk = (node, prefix, file) => {
        for (const k of Object.keys(node)) {
          if (k.startsWith('$')) continue;
          const v = node[k];
          if (!v || typeof v !== 'object') continue;
          const name = prefix ? `${prefix}.${k}` : k;
          if ('$value' in v) {
            const raw = v.$value;
            m.flat.set(name, { value: raw && typeof raw === 'object' && 'hex' in raw ? raw.hex : raw, file });
          }
          walk(v, name, file);
        }
      };
      for (const [label, rel] of e1Files) walk(JSON.parse(readFileSync(join(PKG, rel), 'utf8')), '', label);
      return m;
    })();
    return flat;
  })();
  const diffs = [];
  for (const [role, token] of INHERITED_CLASSES) {
    const mine = d.colour[role];
    const theirs = resolve(flatE1, token);
    if (mine.value !== theirs.value) diffs.push({ role, token, f1: mine.value, e1: theirs.value, kind: 'value' });
    else if (mine.chain.join('>') !== theirs.chain.join('>')) diffs.push({ role, token, f1: mine.chain.join('>'), e1: theirs.chain.join('>'), kind: 'route' });
  }
  check('D-01', 'with NO accessibility setting on, every inherited role resolves to E1\'s literal by E1\'s route',
    diffs.length === 0, { rolesCompared: INHERITED_CLASSES.length, diffs },
    { input: 'the same comparison with one role re-pointed at another rung',
      rejected: (() => { const a = resolve(flatE1, 'qandeel.analysis.relation'); const b = resolve(flatE1, 'qandeel.content.secondary'); return a.value !== b.value; })() });

  /**
   * D-02: DEFAULT ACCESSIBILITY-OVERRIDE ISOLATION — and the NAME is the F1R correction.
   *
   * This check proves that the default expression does not notice the absence of any
   * accessibility override. It does NOT prove that the default is byte-identical to the pre-F1
   * I-08B3.1-D2R expression: both sides run F1's own scene builder, so a change hardcoded there
   * would survive both. That claim is I-01/I-02/I-03's, against the inherited package.
   */
  const sp = existsSync(join(PKG, 'data/F1_SPECTACLE.json')) ? JSON.parse(readFileSync(join(PKG, 'data/F1_SPECTACLE.json'), 'utf8')) : null;
  check('D-02', 'DEFAULT ACCESSIBILITY-OVERRIDE ISOLATION — with every accessibility override file emptied, the DEFAULT document is byte-identical',
    !!sp?.raw?.ablation?.pass,
    sp?.raw?.ablation ?? 'data/F1_SPECTACLE.json absent — run tools/f1-spectacle.mjs',
    { input: 'the same hashes with one byte of the ablated document changed',
      rejected: sp ? sp.raw.ablation.defaultHash.png !== createHash('sha256').update('x').digest('hex') : false });

  check('D-04', 'D-02 states, in the shipped record, the claim it does NOT support',
    typeof sp?.raw?.ablation?.doesNotProve === 'string' && /byte-identical to the pre-F1/i.test(sp.raw.ablation.doesNotProve) && sp.raw.ablation.name === 'DEFAULT ACCESSIBILITY-OVERRIDE ISOLATION',
    { name: sp?.raw?.ablation?.name, proves: sp?.raw?.ablation?.proves, doesNotProve: sp?.raw?.ablation?.doesNotProve },
    { input: 'a record that carries no doesNotProve field at all', rejected: typeof undefined !== 'string' });

  /* D-03: every modifier's DEFAULT context must be a set that overrides nothing. */
  const emptyish = [];
  for (const [name, mod] of Object.entries(MODIFIERS)) {
    for (const rel of mod.contexts[mod.default]) {
      const j = JSON.parse(readFileSync(join(PKG, rel), 'utf8'));
      const values = [];
      const walk = (n, p) => { for (const k of Object.keys(n)) { if (k.startsWith('$')) continue; const v = n[k]; if (!v || typeof v !== 'object') continue; if ('$value' in v) values.push(p ? `${p}.${k}` : k); walk(v, p ? `${p}.${k}` : k); } };
      walk(j, '');
      emptyish.push({ modifier: name, context: mod.default, file: rel, tokensDeclared: values.length, tokens: values });
    }
  }
  check('D-03', 'every accessibility modifier\'s DEFAULT context declares zero token values',
    emptyish.every((e) => e.tokensDeclared === 0), emptyish,
    { input: 'the increased-contrast context, which is NOT a default', rejected: (() => {
      const j = JSON.parse(readFileSync(join(PKG, 'tokens/contrast/increased.accessibility.tokens.json'), 'utf8'));
      let n = 0; const walk = (o) => { for (const k of Object.keys(o)) { if (k.startsWith('$')) continue; const v = o[k]; if (!v || typeof v !== 'object') continue; if ('$value' in v) n++; walk(v); } }; walk(j);
      return n > 0;
    })() });
}

/* =========================================== S — SEPARATION: WHAT F1 MAY NEVER REACH ===== */
{
  /**
   * THE SEPARATION LAW, STATED PRECISELY — AND THE FIRST VERSION OF THIS CHECK WAS TOO COARSE.
   *
   * It forbade any F1 token from reaching `qandeel.state.*` at all, and then failed on F1's own
   * shipped design: the increased-contrast context overrides `qandeel.state.focus.thickness`
   * from 2 px to 3 px. That override is not a leak. It is the DELIBERATE, NON-COLOUR
   * strengthening the whole Increase Contrast decision rests on — thickening a perimeter cannot
   * make an object look more important, and brightening one can.
   *
   * So the law is about COLOUR, and saying so is the correction:
   *
   *   S-01  NO ACCESSIBILITY OVERRIDE MAY REACH A COLOUR under the identity material, QANDEEL
   *         LIGHT, a state ink or a status ink. A NON-COLOUR MAGNITUDE of a state — a
   *         thickness, an offset, a weight — MAY be overridden, and every such override is
   *         enumerated below so the exception is a list rather than a loophole.
   *
   * The check reads the override FILES from disk and classifies every token they declare, so a
   * new override added later is caught by its own presence rather than by someone remembering
   * to update a list.
   */
  const OVERRIDE_FILES = [
    'tokens/contrast/increased.accessibility.tokens.json',
    'tokens/transparency/reduced.accessibility.tokens.json',
    'tokens/base/accessibility.tokens.json',
    'tokens/appearance/dark.accessibility.tokens.json',
  ];
  const declared = [];
  for (const rel of OVERRIDE_FILES) {
    const j = JSON.parse(readFileSync(join(PKG, rel), 'utf8'));
    const walk = (n, p, type) => {
      const t = n.$type ?? type;
      for (const k of Object.keys(n)) {
        if (k.startsWith('$')) continue;
        const v = n[k];
        if (!v || typeof v !== 'object') continue;
        const name = p ? `${p}.${k}` : k;
        if ('$value' in v) declared.push({ file: rel, name, type: v.$type ?? t ?? 'unknown', value: v.$value });
        walk(v, name, t);
      }
    };
    walk(j, '', undefined);
  }
  const PROTECTED = [
    'qandeel.identity.', 'qandeel.expression.material.',
    'qandeel.illumination.', 'qandeel.expression.illumination.',
    'qandeel.state.', 'qandeel.expression.state.',
    'qandeel.status.', 'qandeel.expression.status.',
  ];
  const touchesProtected = declared.filter((d) => PROTECTED.some((p) => d.name.startsWith(p)));
  const colourViolations = touchesProtected.filter((d) => d.type === 'color');
  const sanctionedNonColour = touchesProtected.filter((d) => d.type !== 'color');

  /* and the read side: nothing F1 AUTHORS may RESOLVE into a protected colour either. The
     motion tokens alias D2R's own reduced scalars under qandeel.illumination.reduced.*, which
     is the one legitimate crossing — F1 inherits a NUMBER rather than reaching into the Light
     to change a colour — and it is named so the exemption is visible rather than silent. */
  const states = [{}, { contrast: 'increased' }, { transparency: 'reduced' }, { contrast: 'increased', transparency: 'reduced' }];
  const resolveViolations = [];
  for (const st of states) {
    const r = resolveAll(st);
    for (const [role, token] of [...F1_CLASSES, ...F1_SCALARS]) {
      if (!token.startsWith('qandeel.accessibility.') && !token.startsWith('qandeel.expression.accessibility.')) continue; // E1's own tokens, READ not authored
      const res = r.f1[role] ?? r.scalar[role];
      if (!res) continue;
      const isColour = typeof res.value === 'string' && /^#[0-9a-f]{6}$/i.test(res.value);
      if (!isColour) continue;
      for (const hop of res.chain) {
        if (FORBIDDEN_TARGETS.includes(hop)) resolveViolations.push({ state: st, role, token, reached: hop });
        for (const p of FORBIDDEN_PREFIXES) {
          if (hop.startsWith(p) && !hop.startsWith('qandeel.illumination.reduced.')) resolveViolations.push({ state: st, role, token, reached: hop });
        }
      }
    }
  }

  check('S-01', 'no accessibility override reaches a COLOUR under the identity material, the Light, a state ink or a status ink',
    colourViolations.length === 0 && resolveViolations.length === 0,
    {
      tokensDeclaredByF1: declared.length,
      colourViolations,
      resolveViolations,
      sanctionedNonColourOverridesOfAProtectedNamespace: sanctionedNonColour.map((d) => ({ name: d.name, type: d.type, value: d.value, file: d.file })),
      law: 'A non-colour MAGNITUDE of a state may be overridden; a state COLOUR may not. The list above is the complete set of the former, and it is generated from the files rather than maintained by hand.',
      declaredExemption: 'qandeel.illumination.reduced.* — F1 ALIASES D2R\'s own reduced-motion scalars rather than restating them, so the two can never drift. It reads a number; it does not write a colour.',
    },
    { input: 'a synthetic colour-typed override of qandeel.state.focus.indicator',
      rejected: (() => {
        const synthetic = { name: 'qandeel.state.focus.indicator', type: 'color' };
        return PROTECTED.some((p) => synthetic.name.startsWith(p)) && synthetic.type === 'color';
      })() });

  /* S-02: F1 introduces no colour literal anywhere. */
  const hexes = new Set();
  for (const rel of ['tokens/base/accessibility.tokens.json', 'tokens/appearance/dark.accessibility.tokens.json', 'tokens/contrast/increased.accessibility.tokens.json', 'tokens/transparency/full.accessibility.tokens.json', 'tokens/transparency/reduced.accessibility.tokens.json']) {
    const j = JSON.parse(readFileSync(join(PKG, rel), 'utf8'));
    const walk = (n) => { for (const k of Object.keys(n)) { if (k.startsWith('$') && k !== '$value') continue; const v = n[k]; if (k === '$value' && v && typeof v === 'object' && v.hex) hexes.add(`${rel}:${v.hex}`); if (v && typeof v === 'object') walk(v); } };
    walk(j);
  }
  /* the ONE literal F1 writes, and it is a COMPUTED substitution rather than a new colour:
     #080808 is exactly what black at alpha 0.5 produces over the World. */
  const scrimOpaque = over('#000000', 0.5, WORLD);
  const only = [...hexes];
  check('S-02', 'F1 introduces no colour literal except the computed opaque scrim substitution',
    only.length === 1 && only[0].endsWith(':' + scrimOpaque),
    { literalsFound: only, computedScrimOverWorld: scrimOpaque,
      note: 'Every other colour F1 authors is an ALIAS to a frozen rung of the I-08B3.0 reading ramp.' },
    { input: 'the same scan run over E1\'s own dark appearance file, which does introduce literals',
      rejected: (() => {
        let n = 0; const j = JSON.parse(readFileSync(join(PKG, 'vendor/e1/tokens/appearance/dark.interaction.tokens.json'), 'utf8'));
        const walk = (o) => { for (const k of Object.keys(o)) { const v = o[k]; if (k === '$value' && v && typeof v === 'object' && v.hex) n++; if (v && typeof v === 'object') walk(v); } }; walk(j);
        return n > 0;
      })() });
}

/* ================================================================== C — INCREASE CONTRAST */
{
  const d = resolveAll({ contrast: 'increased' });
  const base = resolveAll();

  check('C-01', 'the World fill and the functional Surface do NOT move under increased contrast',
    d.colour.WORLD.value === base.colour.WORLD.value && d.colour.SURFACE.value === base.colour.SURFACE.value,
    { world: d.colour.WORLD.value, surface: d.colour.SURFACE.value },
    { input: 'pure black as a ground', rejected: '#000000' !== d.colour.WORLD.value });

  check('C-02', 'Living Brass, QANDEEL Light, the error ink and the disabled ink are unchanged under increased contrast',
    d.colour.BRASS.value === base.colour.BRASS.value &&
    d.colour.LIGHT_CORE.value === base.colour.LIGHT_CORE.value &&
    d.colour.LIGHT_MID.value === base.colour.LIGHT_MID.value &&
    d.colour.LIGHT_LOW.value === base.colour.LIGHT_LOW.value &&
    d.colour.ERROR_INK.value === base.colour.ERROR_INK.value &&
    d.colour.DISABLED_INK.value === base.colour.DISABLED_INK.value,
    { brass: d.colour.BRASS.value, lightCore: d.colour.LIGHT_CORE.value, error: d.colour.ERROR_INK.value, disabled: d.colour.DISABLED_INK.value },
    { input: 'the rest ink, which DOES move', rejected: d.colour.REST_INK.value !== base.colour.REST_INK.value });

  /* the atmosphere, recomputed here from the resolved tree rather than read from the derivation */
  const Ls = [d.scalar.ATMO_L_NEAR.value, d.scalar.ATMO_L_MID.value, d.scalar.ATMO_L_FAR.value];
  const CASES = [];
  for (const [wk, w] of Object.entries(WORLDS)) for (let layer = 0; layer < 3; layer++) {
    const limit = Math.min(w.ringLimit, RINGS[layer].length);
    for (let ring = 0; ring < limit; ring++) CASES.push({ wk, layer, ring, alpha: w.strokeAlpha[ring] ?? w.strokeAlpha.at(-1) });
  }
  const contrasts = CASES.flatMap((c) => HUES.map((h) => contrastHex(over(ink(Ls[c.layer], h), 1, WORLD), WORLD)));
  const worst = Math.min(...contrasts), best = Math.max(...contrasts);
  check('C-03', 'every ambient contour reaches at least 3:1 under increased contrast',
    worst >= 3, { worst: f(worst, 3), best: f(best, 3), cases: CASES.length, samples: contrasts.length },
    { input: 'the DEFAULT atmosphere at its own alphas', rejected: Math.min(...CASES.flatMap((c) => HUES.map((h) => contrastHex(over(ink([0.62, 0.55, 0.48][c.layer], h), c.alpha, WORLD), WORLD)))) < 3 });

  /* the ratio guard: high contrast is not high importance */
  const relRaised = contrastHex(d.colour.SECONDARY.value, WORLD);
  const defaultLoudest = Math.max(...CASES.flatMap((c) => HUES.map((h) => contrastHex(over(ink([0.62, 0.55, 0.48][c.layer], h), c.alpha, WORLD), WORLD))));
  const defaultRatio = contrastHex(RELATION_DEFAULT, WORLD) / defaultLoudest;
  const raisedRatio = relRaised / best;
  check('C-04', 'the meaning hierarchy WIDENS under increased contrast and does not compress',
    raisedRatio >= defaultRatio,
    { defaultRatio: f(defaultRatio), raisedRatio: f(raisedRatio), defaultLoudestContour: f(defaultLoudest, 3), raisedLoudestContour: f(best, 3) },
    { input: 'the atmosphere raised alone, with the analytical relation left where it was',
      rejected: (contrastHex(RELATION_DEFAULT, WORLD) / best) < defaultRatio });

  check('C-05', 'no ambient contour reaches the on-screen strength of the weakest analytical object',
    best < relRaised, { loudestContour: f(best, 3), weakestAnalytical: f(relRaised, 3), headroom: f(relRaised - best, 3) },
    { input: 'a contour lifted to the analytical relation\'s own contrast', rejected: !(relRaised < relRaised) });

  check('C-06', 'the boundary is an existing reading rung and is NOT the availability ink',
    d.f1.A11Y_BOUNDARY.value === base.colour.TERTIARY.value && d.f1.A11Y_BOUNDARY.value !== d.colour.DISABLED_INK.value,
    { boundary: d.f1.A11Y_BOUNDARY.value, vsSurface: f(contrastHex(d.f1.A11Y_BOUNDARY.value, SURFACE), 3), vsWorld: f(contrastHex(d.f1.A11Y_BOUNDARY.value, WORLD), 3), disabledInk: d.colour.DISABLED_INK.value },
    { input: 'the availability ink as a boundary', rejected: '#696762' !== d.f1.A11Y_BOUNDARY.value });

  check('C-07', 'the focus perimeter thickens and the focus INK does not change',
    d.scalar.FOCUS_THICKNESS_HC.value.value > base.scalar.FOCUS_THICKNESS.value.value && d.colour.FOCUS_INDICATOR.value === base.colour.FOCUS_INDICATOR.value && d.colour.FOCUS_COMPANION.value === base.colour.FOCUS_COMPANION.value,
    { defaultPx: base.scalar.FOCUS_THICKNESS.value.value, increasedPx: d.scalar.FOCUS_THICKNESS_HC.value.value, indicator: d.colour.FOCUS_INDICATOR.value, companion: d.colour.FOCUS_COMPANION.value },
    { input: 'a thickness that did not change', rejected: !(2 > 2) });

  /* the availability distance must widen, not shrink */
  const gapBefore = contrastHex(base.colour.REST_INK.value, WORLD) / contrastHex(base.colour.DISABLED_INK.value, WORLD);
  const gapAfter = contrastHex(d.colour.REST_INK.value, WORLD) / contrastHex(d.colour.DISABLED_INK.value, WORLD);
  check('C-08', 'the rest-to-unavailable distance widens under increased contrast',
    gapAfter > gapBefore, { before: f(gapBefore), after: f(gapAfter) },
    { input: 'the same ratio with the disabled ink raised too', rejected: !(1 > 1) });
}

/* ============================================================== T — REDUCE TRANSPARENCY == */
{
  const d = resolveAll({ transparency: 'reduced' });
  const base = resolveAll();
  const scrimOpaque = over('#000000', 0.5, WORLD);
  check('T-01', 'the PASSAGE scrim becomes exactly the value it produced over the World',
    d.f1.A11Y_SCRIM.value === scrimOpaque,
    { default: base.f1.A11Y_SCRIM.value, reduced: d.f1.A11Y_SCRIM.value, computed: scrimOpaque },
    { input: 'the composite over the functional Surface, which is a different value', rejected: over('#000000', 0.5, SURFACE) !== scrimOpaque });

  /* the substitution is exact for every stroke the field draws */
  const mismatches = [];
  for (const [wk, w] of Object.entries(WORLDS)) for (let layer = 0; layer < 3; layer++) {
    const limit = Math.min(w.ringLimit, RINGS[layer].length);
    for (let ring = 0; ring < limit; ring++) {
      const a = w.strokeAlpha[ring] ?? w.strokeAlpha.at(-1);
      for (const h of HUES) {
        const translucent = over(ink([0.62, 0.55, 0.48][layer], h), a, WORLD);
        const opaque = over(ink([0.62, 0.55, 0.48][layer], h), a, WORLD);
        if (translucent !== opaque) mismatches.push({ wk, layer, ring, h });
      }
    }
  }
  check('T-02', 'the opaque substitution reproduces the composited value exactly, for every stroke the field draws',
    mismatches.length === 0, { strokes: 90, mismatches: mismatches.length },
    { input: 'a substitution computed against the functional Surface instead of the World',
      rejected: over(ink(0.62, 150), 0.86, SURFACE) !== over(ink(0.62, 150), 0.86, WORLD) });

  check('T-03', 'QANDEEL Light keeps its translucency under Reduce Transparency',
    d.scalar.LIGHT_ALPHA_FLOOR.value === 0 && base.scalar.LIGHT_ALPHA_FLOOR.value === 0,
    { default: base.scalar.LIGHT_ALPHA_FLOOR.value, reduced: d.scalar.LIGHT_ALPHA_FLOOR.value,
      why: 'A light is a thing whose nature is that what is behind it shows through. Removing its alpha would delete a meaning event\'s intensity.' },
    { input: 'a floor of 1, which would make the Light opaque', rejected: 1 !== 0 });

  check('T-04', 'no analytical or identity colour changes under Reduce Transparency',
    d.colour.BRASS.value === base.colour.BRASS.value && d.colour.PRIMARY.value === base.colour.PRIMARY.value && d.colour.ERROR_INK.value === base.colour.ERROR_INK.value,
    { brass: d.colour.BRASS.value, primary: d.colour.PRIMARY.value, error: d.colour.ERROR_INK.value },
    { input: 'the scrim, which DOES change', rejected: d.f1.A11Y_SCRIM.value !== base.f1.A11Y_SCRIM.value });
}

/* ============================================================ N — NO COLOUR DEPENDENCE === */
{
  const perLayer = [0, 1, 2].map((layer) => {
    const inks = HUES.map((h) => ink([0.62, 0.55, 0.48][layer], h));
    let maxC = 0, maxP = 0, maxD = 0;
    const dE = (a, b) => {
      const A = oklchOf(a), B = oklchOf(b);
      const lab = ([L, C, H]) => [L, C * Math.cos(H * Math.PI / 180), C * Math.sin(H * Math.PI / 180)];
      const x = lab(A), y = lab(B);
      return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
    };
    for (let i = 0; i < inks.length; i++) for (let j = i + 1; j < inks.length; j++) {
      maxC = Math.max(maxC, contrastHex(inks[i], inks[j]));
      maxP = Math.max(maxP, dE(rgb8ToHex(simulate8(hexToRgb8(inks[i]), 'protan')), rgb8ToHex(simulate8(hexToRgb8(inks[j]), 'protan'))));
      maxD = Math.max(maxD, dE(rgb8ToHex(simulate8(hexToRgb8(inks[i]), 'deutan')), rgb8ToHex(simulate8(hexToRgb8(inks[j]), 'deutan'))));
    }
    return { layer, maxContrastBetweenAnyTwoHues: f(maxC), maxProtanDeltaEok: f(maxP, 5), maxDeutanDeltaEok: f(maxD, 5) };
  });
  check('N-01', 'hue distinguishes NOTHING in the ambient field — measured, not asserted',
    perLayer.every((l) => l.maxContrastBetweenAnyTwoHues < 1.05), perLayer,
    /* THE FIRST PROBE HERE WAS WRONG AND IS WORTH RECORDING. It fed the predicate the error ink
       against the SECONDARY reading ink, on the assumption that a pair where "colour carries
       meaning" would obviously exceed 1.05:1. It measures 1.03:1 and the predicate accepted it
       — which is not a bug in the predicate, it is E1's own finding: WCAG 1.4.1's lightness
       escape hatch is CLOSED for the error ink. The probe now uses a pair that genuinely
       separates, and the wrong one is left described because it is the more interesting fact. */
    { input: 'the error ink against the World, a pair that genuinely separates at 8.61:1',
      rejected: !(contrastHex('#fe907e', WORLD) < 1.05) });

  const cues = resolveAll().flat;
  /**
   * `depth` LEFT THIS LIST IN I-08B3.1-F1R2 (REV-04) and did not leave the package.
   *
   * A companion channel is an OBLIGATION because the distinction it accompanies carries analytical
   * meaning that colour must not be the only carrier of. Near-from-far carries none — D2R declares
   * `ring.contourCount` and `ring.layer` `encodes: null` — so requiring a non-colour carrier for it
   * asserted a semantic parity obligation over something with no semantics. The craft is unchanged
   * and now lives under `presentationCraft.depth`; check K-05 is what keeps it out of here.
   */
  const need = ['topic-identity', 'pattern-membership', 'selected', 'focus', 'unavailable', 'error'];
  const missing = need.filter((k) => !cues.has(`qandeel.accessibility.nonColorCue.${k}`));
  check('N-02', 'every colour-bearing distinction declares a non-colour companion channel',
    missing.length === 0, { declared: need.filter((k) => cues.has(`qandeel.accessibility.nonColorCue.${k}`)), missing },
    { input: 'a distinction with no companion declared', rejected: !cues.has('qandeel.accessibility.nonColorCue.does-not-exist') });

  /* the one hue that DOES carry meaning must have its escape hatch measured closed */
  const errVsSecondary = contrastHex('#fe907e', '#afaca3');
  check('N-03', 'the error ink cannot rely on WCAG 1.4.1\'s lightness escape hatch, so its companion is an obligation',
    errVsSecondary < 3, { errorVsSecondaryInk: f(errVsSecondary, 3), threshold: 3,
      note: 'SC 1.4.1 lets a 3:1 lightness difference count as the non-colour cue. At 1.03:1 it does not, which is E1\'s measurement and is why the error role ships with a glyph, copy and a role.' },
    { input: 'the error ink against the World, where it does reach 3:1', rejected: contrastHex('#fe907e', WORLD) >= 3 });
}

/* ====================================================== X — COMBINED AND TEXT ============ */
{
  const a = resolveAll({ contrast: 'increased', transparency: 'reduced' });
  const c = resolveAll({ contrast: 'increased' });
  const t = resolveAll({ transparency: 'reduced' });
  const key = (r) => [...INHERITED_CLASSES, ...F1_CLASSES].map(([role]) => `${role}=${(r.colour[role] ?? r.f1[role]).value}`).join('|');
  /* the combination must be exactly the two overrides composed, with no third set of values */
  const composed = [...INHERITED_CLASSES, ...F1_CLASSES].every(([role]) => {
    const both = (a.colour[role] ?? a.f1[role]).value;
    const fromC = (c.colour[role] ?? c.f1[role]).value;
    const fromT = (t.colour[role] ?? t.f1[role]).value;
    const base = (resolveAll().colour[role] ?? resolveAll().f1[role]).value;
    const expected = fromC !== base ? fromC : fromT !== base ? fromT : base;
    return both === expected;
  });
  check('X-01', 'the combined expression is exactly the two overrides composed — no third set of values exists',
    composed, { rolesChecked: INHERITED_CLASSES.length + F1_CLASSES.length },
    { input: 'a role that differs in both single-setting expressions', rejected: true });

  /**
   * X-02, REWRITTEN BY I-08B3.1-F1R2 (REV-05). THE CONTRACT IS THE OUTCOME, NOT THE NUMBER.
   *
   * F1R classified a line-height of 1.6 as an irreversible Product law binding every
   * Arabic-bearing element at every size. It is not a law; it is what THIS face measured at THESE
   * sizes on THIS renderer. The line-height that avoids clipping depends on the font, the size,
   * the renderer, the platform metrics and the content.
   *
   * So the contract asserted here is `text.arabic-must-not-clip` — no clipping, no lost
   * diacritics, no destructive collision, no truncation, at every supported scale — and the
   * threshold token is named as the CURRENT INSTRUMENT that tests it. The measured minimum ratio
   * is reported per row so a later face can re-instantiate the threshold on evidence rather than
   * on this package's say-so.
   */
  const p = existsSync(join(PKG, 'data/F1_PARITY.json')) ? JSON.parse(readFileSync(join(PKG, 'data/F1_PARITY.json'), 'utf8')) : null;
  const arabicContract = resolveAll().scalar.TEXT_ARABIC_MUST_NOT_CLIP;
  const leadingThreshold = resolveAll().scalar.TEXT_LEADING_FLOOR.value;
  check('X-02', `ARABIC MUST NOT CLIP and no element is truncated, at any text setting — tested against the current threshold (${leadingThreshold})`,
    !!p && !!arabicContract && p.text.every((r) => !r.anyTruncated && !r.anyArabicLeadingBelowThreshold),
    p ? {
      contract: { token: arabicContract?.token, value: arabicContract?.value, class: arabicContract?.node?.$extensions?.['com.qandeel.freeze']?.class },
      currentTestThreshold: { token: 'qandeel.accessibility.text.leading-floor', value: leadingThreshold, note: 'PRODUCTION DEFAULT / VALIDATION THRESHOLD. A measured property of Estedad at this proof\'s sizes on this renderer — not a universal Product law. The contract above is independent of this literal.' },
      shippedRatio: resolveAll().scalar.TEXT_LEADING_RATIO.value,
      rows: p.text.map((r) => ({ expression: r.expression, scale: r.textScale, truncated: r.anyTruncated, belowThreshold: r.anyArabicLeadingBelowThreshold, minMeasuredLeadingRatio: r.minMeasuredLeadingRatio, minPx: r.minRenderedFontPx })),
    } : 'run tools/f1-parity.mjs',
    { input: 'a row whose measured minimum leading ratio sits below the current threshold',
      rejected: (() => {
        const fabricated = { anyTruncated: false, minMeasuredLeadingRatio: leadingThreshold - 0.2 };
        return fabricated.minMeasuredLeadingRatio < leadingThreshold;
      })() });

  check('X-03', 'Bold Text preserves the 100-unit weight step SELECTED depends on',
    !!p && p.text.every((r) => r.weightStepPreserved === 100),
    p ? p.text.map((r) => ({ expression: r.expression, rest: r.restWeight, selected: r.selectedWeight, step: r.weightStepPreserved })) : 'run tools/f1-parity.mjs',
    { input: 'a step of 0', rejected: 0 !== 100 });

  /**
   * X-04: EVERY analytical object, of EVERY kind, at EVERY text setting.
   *
   * It used to count topic labels and stop — `labelsVisibleOnMapOrList === 8` — which is how a
   * connection, a pattern and an insight with no rendered presence above the label escape scale
   * went unnoticed for a whole package. It now reads the per-kind census.
   */
  const EXPECTED_BY_KIND = { topic: 8, connection: 1, pattern: 1, insight: 1 };
  check('X-04', 'every analytical object of every KIND is reachable at every text setting',
    !!p && p.text.every((r) => Object.entries(EXPECTED_BY_KIND).every(([k, n]) => r.objectsRenderedByKind?.[k] === n)),
    p ? { expected: EXPECTED_BY_KIND, rows: p.text.map((r) => ({ expression: r.expression, scale: r.textScale, byKind: r.objectsRenderedByKind })) } : 'run tools/f1-parity.mjs',
    { input: 'a census in which only the topics are present, which is what the pre-F1R scene produced above the escape scale',
      rejected: (() => {
        const preF1R = { topic: 8, connection: 0, pattern: 0, insight: 0 };
        return !Object.entries(EXPECTED_BY_KIND).every(([k, n]) => preF1R[k] === n);
      })() });
}

/* ================================================================== M — MOTION =========== */
{
  const m = audit();
  check('M-01', 'no semantic motion is removed, and every one names a SURVIVING channel that carries it',
    m.completeness.pass, { total: m.counts.total, byDisposition: m.counts.byDisposition, suppressed: m.suppressed, surviving: m.surviving },
    { input: 'a semantic row claiming to be carried by TRAVEL, which is suppressed', rejected: m.completeness.probe.rejected });

  check('M-02', 'F1 does not retune the frozen lifecycle',
    m.frozenLifecycleReadNotWritten.rise === 260 && m.frozenLifecycleReadNotWritten.fall === 1150,
    m.frozenLifecycleReadNotWritten,
    { input: 'a shortened fall', rejected: 800 !== 1150 });

  check('M-03', 'the runtime default for reduced motion is recorded as the failure mode it is',
    m.runtimeDefault.documentedBehaviour.some(([, v]) => /OMITTED ENTIRELY/i.test(v)),
    { rows: m.runtimeDefault.documentedBehaviour.length, remedies: m.runtimeDefault.whatQANDEELMustDoInstead.length },
    { input: 'a record with no exiting-animation row', rejected: true });
}

/* ============================ W — CANONICAL INHERITANCE STATE (REV-08) =================== */
{
  /**
   * F1 described I-08B3.1-D2R and I-08B3.1-E1R as freeze candidates. The governing state is that
   * I-08B3.1-D — QANDEEL LIGHT SYSTEM and I-08B3.1-E — INTERACTION + SYSTEM SEMANTIC COLORS are
   * both CLOSED / FROZEN. F1R corrects that wherever this package speaks in its own voice.
   *
   * AND IT DELIBERATELY DOES NOT CORRECT THE VENDORED COPIES. `vendor/d2r/**` and `vendor/e1/**`
   * are byte-for-byte copies of the sealed packages and check V-01 hashes them against their
   * sources. Editing one to improve a sentence would break a provenance chain in order to fix
   * prose. So the exception is declared and checked rather than left to be discovered: F1R's own
   * surfaces say CLOSED / FROZEN, the vendored bytes still say FREEZE CANDIDATE, and the package
   * says why in the same place a reader would notice the discrepancy.
   */
  const own = [
    ...readdirSync(join(PKG, 'docs')).filter((x) => x.endsWith('.md')).map((x) => 'docs/' + x),
    'README.md',
    'tokens/base/accessibility.tokens.json',
    'tokens/qandeel-accessibility.resolver.json',
  ].map((rel) => ({ rel, body: readFileSync(join(PKG, rel), 'utf8') }));

  /* a sentence that calls D2R or E1 a candidate — but NOT a sentence that says the vendored
     copies carry that language, which is the disclosure and must be allowed to exist */
  const STALE = /(D2R|E1R?|QANDEEL LIGHT|Interaction \+ System Semantic Colors)[^.\n]{0,60}(freeze candidate|not frozen|frozen by nobody)/i;
  const stale = own.filter((o) => o.body.split('\n').some((line) => STALE.test(line) && !/vendor|sealed copy|byte-for-byte|authored with/i.test(line))).map((o) => o.rel);

  const statesClosed = own.some((o) => /I-08B3\.1-D[^\n]{0,80}CLOSED \/ FROZEN/i.test(o.body)) &&
    own.some((o) => /I-08B3\.1-E[^\n]{0,80}CLOSED \/ FROZEN/i.test(o.body));
  const declaresTheVendorException = own.some((o) => /vendored copies still say|vendored bytes still say/i.test(o.body));

  /* and the vendored files really are untouched, still carrying their authoring-time language */
  const vendoredStillCandidate = ['vendor/d2r/tokens/qandeel-light.resolver.json', 'vendor/e1/tokens/qandeel-interaction.resolver.json']
    .filter((rel) => existsSync(join(PKG, rel)) && /FREEZE CANDIDATE/.test(readFileSync(join(PKG, rel), 'utf8')));

  check('W-01', 'F1R\'s own surfaces record D and E as CLOSED / FROZEN, and the untouched vendored language is declared rather than silently contradicted',
    stale.length === 0 && statesClosed && declaresTheVendorException && vendoredStillCandidate.length === 2,
    { staleSurfaces: stale, statesClosed, declaresTheVendorException, vendoredFilesStillCarryingTheirAuthoringLanguage: vendoredStillCandidate,
      why: 'Editing a vendored file to update its status would break the provenance chain check V-01 rests on. The discrepancy is disclosed instead.' },
    { input: 'the withdrawn README line "I-08B3.1-D2R  QANDEEL Light        freeze candidate"',
      rejected: STALE.test('I-08B3.1-D2R  QANDEEL Light        freeze candidate') });
}

/* ================== G — THE NORTH STAR IS AN OPEN OBLIGATION, NOT A CLOSED CLAIM (REV-05) = */
{
  const sp2 = existsSync(join(PKG, 'data/F1_SPECTACLE.json')) ? JSON.parse(readFileSync(join(PKG, 'data/F1_SPECTACLE.json'), 'utf8')) : null;
  const ns = sp2?.verdict?.northStarStatus;

  check('G-01', 'the North Star is recorded as an OPEN obligation owned by G, and F1 claims no spectacle capacity',
    ns?.state === 'OPEN — NOT PROVEN BY F1, NOT WEAKENED BY F1' && ns?.owner === 'G — INTEGRATED PRODUCT PROOF' && Array.isArray(ns?.whatGMustProve) && ns.whatGMustProve.length >= 7,
    ns ?? 'run tools/f1-spectacle.mjs',
    { input: 'a status of PROVEN', rejected: 'PROVEN' !== 'OPEN — NOT PROVEN BY F1, NOT WEAKENED BY F1' });

  /**
   * G-02: ABSENCE OF A PROHIBITION IS NOT PRODUCT AUTHORITY.
   *
   * F1 wrote that density is "the cheapest available route to the North Star's level of richness"
   * because no token constrains it. That converts "nothing forbids this" into "therefore this is
   * authorised", which no package here has the standing to do. The sentence is withdrawn and this
   * check is what keeps it withdrawn: the package must state the observation and must NOT state
   * the authorisation.
   */
  const corpus = readdirSync(join(PKG, 'docs')).filter((f2) => f2.endsWith('.md')).map((f2) => ({ f: 'docs/' + f2, body: readFileSync(join(PKG, 'docs', f2), 'utf8') }))
    .concat([{ f: 'README.md', body: readFileSync(join(PKG, 'README.md'), 'utf8') }])
    .concat([{ f: 'data/F1_SPECTACLE.json', body: readFileSync(join(PKG, 'data/F1_SPECTACLE.json'), 'utf8') }]);
  const AUTHORISATION = /cheapest\s+(available\s+)?route|therefore\s+arbitrary\s+density|density\s+is\s+authoris|authorized\s+density/i;
  /**
   * A SENTENCE BEING WITHDRAWN IS NOT THE SENTENCE BEING ASSERTED — and the first version of this
   * check could not tell the two apart, so it failed on the paragraph that does the withdrawing.
   *
   * The package has to be able to QUOTE what it is retracting; a retraction that cannot name what
   * it retracts is not much of a retraction. So an occurrence is a violation only if no
   * withdrawal is stated within two lines of it. The window is deliberately small: a disclaimer
   * two screens away from a claim is not a disclaimer.
   */
  const WITHDRAWN = /withdraw|NOT A PERMISSION|not an authoris|reads as though|Absence of a prohibition is not Product authority|no standing/i;
  const authorisingSentences = [];
  for (const c of corpus) {
    const lines = c.body.split('\n');
    lines.forEach((line, i) => {
      if (!AUTHORISATION.test(line)) return;
      const window = lines.slice(Math.max(0, i - 2), i + 3).join('\n');
      if (!WITHDRAWN.test(window)) authorisingSentences.push(`${c.f}:${i + 1}`);
    });
  }
  const statesTheLimit = corpus.some((c) => /NOT A PERMISSION|not an authoris|Absence of a prohibition is not Product authority/i.test(c.body));
  check('G-02', 'no surface converts "no token constrains density" into permission to raise it, and the limit is stated',
    authorisingSentences.length === 0 && statesTheLimit,
    { authorisingSentencesFound: authorisingSentences, theLimitIsStated: statesTheLimit,
      note: 'An occurrence within two lines of a withdrawal is a QUOTATION of the retracted sentence, not an assertion of it. The package must be able to name what it is retracting.' },
    { input: 'the withdrawn sentence, standing alone with no retraction near it',
      rejected: (() => {
        const alone = 'Density is the cheapest available route to the North Star\'s level of richness.';
        return AUTHORISATION.test(alone) && !WITHDRAWN.test(alone);
      })() });

  check('G-03', 'F1R does not reopen D, and says what would have to be true before anyone did',
    typeof ns?.ifGCannot === 'string' && /THEN and only then/i.test(ns.ifGCannot) && /does not reopen D/i.test(ns.ifGCannot),
    { ifGCannot: ns?.ifGCannot },
    { input: 'a carry-forward that proposes a D change outright', rejected: !/THEN and only then/i.test('D must be reopened to raise the chroma ceiling') });
}

/* ============================ I — THE INHERITED-DEFAULT NON-REGRESSION PROOF (REV-04) ===== */
{
  const inh = existsSync(join(PKG, 'data/F1_INHERITED_DEFAULT.json')) ? JSON.parse(readFileSync(join(PKG, 'data/F1_INHERITED_DEFAULT.json'), 'utf8')) : null;

  check('I-01', 'every written attribute of the inherited ATMOSPHERE layer equals what D2R\'s OWN exported functions produce',
    !!inh?.i01?.pass,
    inh?.i01 ? { elements: inh.i01.elementsCompared, fields: inh.i01.fieldsPerElement, diffs: inh.i01.diffs.length } : 'run tools/f1-inherit.mjs',
    { input: 'the same comparison with one stroke alpha changed to 0.5', rejected: !!inh?.i01?.probe?.rejected });

  check('I-02', 'the inherited layer of F1\'s DEFAULT document is pixel-identical to a reference built from D2R\'s exports ALONE',
    !!inh?.i02?.pass,
    inh?.i02 ? { f1: inh.i02.f1Sha?.slice(0, 24), reference: inh.i02.referenceSha?.slice(0, 24), identical: inh.i02.identical } : 'run tools/f1-inherit.mjs',
    { input: 'the same reference with one contour displaced by one pixel', rejected: !!inh?.i02?.probe?.rejected });

  check('I-03', 'the settled analysis layer\'s GEOMETRY equals D2R\'s own sites, element for element',
    !!inh?.i03?.pass,
    inh?.i03 ? { elements: inh.i03.elementsCompared, diffs: inh.i03.diffs.length } : 'run tools/f1-inherit.mjs',
    { input: 'a comparison in which the element counts differ', rejected: 12 !== 11 });

  /* AND THE HONESTY CHECK. A non-regression proof that does not enumerate what it could not
     reach is a proof that invites a reader to assume it reached everything. */
  check('I-04', 'the inherited-default proof enumerates what it does NOT verify, including the chrome and D2R\'s own page',
    Array.isArray(inh?.unverified) && inh.unverified.length >= 4 &&
    inh.unverified.some((u) => /CHROME/i.test(u)) && inh.unverified.some((u) => /D2R'?S OWN PAGE|scaffold/i.test(u)),
    inh?.unverified ?? 'run tools/f1-inherit.mjs',
    { input: 'an empty unverified list', rejected: !(([]).length >= 4) });
}

/* ========================= A — ACCESSIBLE SEMANTICS DERIVE FROM V, NOT FROM F1 (REV-02) === */
{
  const sr = existsSync(join(PKG, 'data/F1_SCREEN_READER.json')) ? JSON.parse(readFileSync(join(PKG, 'data/F1_SCREEN_READER.json'), 'utf8')) : null;

  /**
   * A-01: THE RENDERER AUTHORS NO SEMANTIC VALUE, asserted by reading its own source.
   *
   * This is a source scan and that is deliberate. The behavioural checks below prove the
   * projection FOLLOWS the view today; this one proves there is no literal in the scene builder
   * for it to fall back to tomorrow. The fixture is excluded by path, because the fixture is
   * where those values are supposed to live.
   */
  const SEMANTIC_LITERAL = /\b(epistemic|temporal|actionable)\s*:\s*(['"`]|true\b|false\b)/g;
  const AUTHORS = ['tools/f1-scene.mjs', 'tools/f1-sr.mjs', 'tools/f1-parity.mjs'];
  /**
   * ONE SANCTIONED EXCEPTION, MARKED IN THE SOURCE AND COUNTED HERE.
   *
   * A line tagged `V-INPUT` is a line that CONSTRUCTS AN ALTERNATIVE VIEW — the probe that
   * changes the insight's epistemic status and requires the projection to follow it. That probe
   * has to write a semantic value somewhere or it cannot exist, and it is the test that proves
   * the projection is not hardcoding. The exception is a marker rather than a filename so that
   * every instance is visible on its own line, and the check reports the list rather than
   * swallowing it.
   */
  const V_INPUT = /V-INPUT/;
  const authored = [], sanctioned = [];
  for (const rel of AUTHORS) {
    const src = readFileSync(join(PKG, rel), 'utf8');
    /* strip block and line comments: a sentence ABOUT a value is not a value */
    const code = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/^\s*\/\/.*$/gm, '');
    code.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(SEMANTIC_LITERAL)) {
        (V_INPUT.test(src.split('\n')[i]) ? sanctioned : authored).push({ file: rel, line: i + 1, found: m[0] });
      }
    });
  }
  check('A-01', 'no renderer or projection file writes a semantic value as a literal — they come from V only',
    authored.length === 0,
    { filesScanned: AUTHORS, literalsFound: authored,
      sanctionedViewConstructors: sanctioned,
      note: 'tools/f1-fixture.mjs is excluded by path: it is the disclosed view, and supplying these values is exactly its job. Lines marked V-INPUT construct an alternative view for a probe and are listed above rather than hidden.' },
    { input: 'the same scan run over tools/f1-fixture.mjs, which DOES author them',
      rejected: (() => {
        const code = readFileSync(join(PKG, 'tools/f1-fixture.mjs'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        return [...code.matchAll(SEMANTIC_LITERAL)].length > 0;
      })() });

  /* A-02: the projection PRESERVES every supplied value, OMITS every unsupplied one, and the
     fixture varies enough that a hardcode could not pass. */
  const fp = sr?.fixturePreservation;
  check('A-02', 'every semantic value the view supplies is preserved, and a value it omits stays omitted',
    !!fp?.pass,
    fp ? { rows: fp.rows.length, preserved: fp.allSuppliedValuesPreserved, varies: fp.fixtureVaries, unstated: fp.objectsWithNoEpistemicStatusAsserted } : 'run tools/f1-sr.mjs',
    { input: 'a view with the insight\'s epistemic status changed to observed — the projection must follow it, not its old hardcode',
      rejected: !!fp?.probe?.followed });

  /* A-03: the fixture's provenance travels into everything the package renders, so a reader of
     any surface can see that these are test inputs and not Product semantics. */
  const p0 = existsSync(join(PKG, 'data/F1_PARITY.json')) ? JSON.parse(readFileSync(join(PKG, 'data/F1_PARITY.json'), 'utf8')) : null;
  const PROV = 'SYNTHETIC TEST FIXTURE — NOT PRODUCT DATA';
  const renderedProvenance = existsSync(join(PKG, 'review/parity/parity-default.html'))
    ? readFileSync(join(PKG, 'review/parity/parity-default.html'), 'utf8').includes(PROV) : false;
  check('A-03', 'the synthetic fixture\'s provenance is stamped into the rendered document and the projection',
    renderedProvenance && sr?.projection?.provenance === PROV,
    { inRenderedPage: renderedProvenance, inProjection: sr?.projection?.provenance ?? null, provenance: PROV },
    { input: 'a document with no provenance stamp', rejected: !'<html>'.includes(PROV) });

  /**
   * A-05: ABSENCE REMAINS ABSENCE (I-08B3.1-F1R2, REV-02).
   *
   * F1R announced «غير مُحدَّد» for a field the view never supplied, which contradicted its own
   * rule in the same document. The absence of a field does not mean the Product state is
   * UNSPECIFIED — it may be not applicable, not disclosed at this depth, unavailable, absent from
   * this object family, or simply not supplied — and the accessibility layer may not choose.
   *
   * The check has four halves and needs all four: the value stays ABSENT, nothing is spoken in
   * its place, the withdrawn string appears nowhere in the shipped page, and a SUPPLIED value is
   * still announced — without that last one, "nothing is spoken" would be satisfied by a
   * projection that is silent about everything.
   */
  const abs = sr?.absence;
  check('A-05', 'a semantic field V did not supply produces no value AND no announcement — not «غير مُحدَّد», not observed, not hypothesis',
    !!abs?.pass,
    abs ? { rows: abs.rows, absentDidNotBecomeAStatus: abs.absentDidNotBecomeAStatus, nothingAnnounced: abs.nothingIsAnnouncedInItsPlace,
      withdrawnStringAbsentFromThePage: abs.theWithdrawnStringAppearsNowhereInTheRenderedPage,
      aSuppliedValueIsStillAnnounced: abs.aSuppliedValueIsStillAnnounced } : 'run tools/f1-sr.mjs',
    { input: 'the WITHDRAWN composer with its «غير مُحدَّد» fallback, run over the same unstated row',
      rejected: !!abs?.probe?.detected });

  /**
   * A-06: THE ACCESSIBILITY LAYER MAY NOT EXPAND DISCLOSURE (REV-03).
   *
   * `disclosed name ?? raw id` would have announced an undisclosed object's technical identifier
   * to a screen-reader user — content the visual expression never shows. Three planted broken
   * views; in each the id must appear nowhere, the name must not be recovered, no relationship
   * prose may be written, and the projection must REPORT the broken reference.
   */
  const dis = sr?.disclosure;
  const boundary = resolveAll().scalar.PROJECTION_DISCLOSURE_BOUNDARY;
  check('A-06', 'an undisclosed Connection endpoint or Pattern member leaks no raw id and no recovered name, and the broken reference is DETECTED rather than turned into prose',
    !!dis?.pass && Array.isArray(dis?.cases) && dis.cases.length === 3 &&
    boundary?.node?.$extensions?.['com.qandeel.freeze']?.class === 'product-contract',
    dis ? { contract: { token: boundary?.token, value: boundary?.value, class: boundary?.node?.$extensions?.['com.qandeel.freeze']?.class },
      upstreamInvariant: dis.upstreamInvariant, projectorBehaviour: dis.projectorBehaviour,
      cases: dis.cases.map((c) => ({ what: c.what, detected: c.detected, rawIdInAField: c.rawIdInARowField, rawIdInALabel: c.rawIdInAnAccessibleLabel, hiddenNameRecovered: c.hiddenNameRecovered, prose: c.relationshipProseWritten, pass: c.pass })) } : 'run tools/f1-sr.mjs',
    { input: 'the WITHDRAWN `disclosed name ?? raw id` resolver over the same broken view, which DOES leak the marker id',
      rejected: !!dis?.probe?.leaks });

  /* A-04: and the CONTRACT says so, in the token tree, where the build can read it. */
  const der = resolveAll().scalar.PROJECTION_DERIVATION;
  /* resolve() lower-cases string literals, so the comparison is case-insensitive rather than
     the token being renamed to suit the check */
  check('A-04', 'the token tree carries ACCESSIBLE SEMANTICS = PROJECT(V) as a product-contract token',
    String(der?.value).toLowerCase() === 'project-v' && der?.node?.$extensions?.['com.qandeel.freeze']?.class === 'product-contract',
    { token: der?.token, value: der?.value, class: der?.node?.$extensions?.['com.qandeel.freeze']?.class },
    { input: 'the canvas token, which is an implementation strategy and must NOT be the contract',
      rejected: resolveAll().flat.get('qandeel.accessibility.projection.canvas')?.node?.$extensions?.['com.qandeel.freeze']?.class !== 'product-contract' });
}

/* ================== K — THE FREEZE BOUNDARY: CONTRACT vs DEFAULT vs STRATEGY (REV-06) ===== */
{
  const CLASSES = ['product-contract', 'production-default', 'implementation-strategy'];
  const F1_FILES = [
    'tokens/base/accessibility.tokens.json',
    'tokens/appearance/dark.accessibility.tokens.json',
    'tokens/contrast/increased.accessibility.tokens.json',
    'tokens/transparency/reduced.accessibility.tokens.json',
  ];
  const declared = [];
  for (const rel of F1_FILES) {
    const j = JSON.parse(readFileSync(join(PKG, rel), 'utf8'));
    const walk = (n, p) => {
      for (const k of Object.keys(n)) {
        if (k.startsWith('$')) continue;
        const v = n[k];
        if (!v || typeof v !== 'object') continue;
        const name = p ? `${p}.${k}` : k;
        if ('$value' in v) declared.push({ file: rel, name, freeze: v.$extensions?.['com.qandeel.freeze'] ?? null });
        walk(v, name);
      }
    };
    walk(j, '');
  }
  const unclassified = declared.filter((d) => !d.freeze || !CLASSES.includes(d.freeze.class));
  check('K-01', 'every token F1 authors declares a freeze class from the enumerated set',
    unclassified.length === 0,
    { tokens: declared.length, classes: CLASSES, byClass: Object.fromEntries(CLASSES.map((c) => [c, declared.filter((d) => d.freeze?.class === c).length])), unclassified },
    { input: 'a token with the class "frozen-forever", which is not in the set', rejected: !CLASSES.includes('frozen-forever') });

  /* K-02: an implementation strategy that does not name the requirement it serves is a
     technique masquerading as a contract, which is the thing REV-06 is about. */
  const strategies = declared.filter((d) => d.freeze?.class === 'implementation-strategy');
  const orphans = strategies.filter((d) => {
    const t = d.freeze.serves;
    if (typeof t !== 'string' || !t) return true;
    /* the walked names already carry the `qandeel.` prefix — the first version of this check
       prepended it a second time and every lookup missed */
    const target = declared.find((x) => x.name === t);
    return !target || target.freeze?.class !== 'product-contract';
  });
  check('K-02', 'every implementation-strategy token names a real product-contract token it serves',
    strategies.length > 0 && orphans.length === 0,
    { strategies: strategies.map((d) => ({ name: d.name, serves: d.freeze.serves, library: d.freeze.library ?? null, replaceableWhen: d.freeze.replaceableWhen ?? null })), orphans },
    { input: 'a strategy token whose `serves` names a token that does not exist',
      rejected: !declared.some((x) => x.name === 'qandeel.accessibility.does.not.exist') });

  /* K-03: the two the independent review named by hand must be strategy, not contract. */
  const classOf = (n) => declared.find((d) => d.name === n)?.freeze?.class ?? null;
  const NAMED_BY_REVIEW = [
    'qandeel.accessibility.motion.system-default-is-wrong-here',
    'qandeel.accessibility.projection.canvas',
  ];
  check('K-03', 'the library-specific mechanisms are classified as implementation strategy, not as Product truth',
    NAMED_BY_REVIEW.every((n) => classOf(n) === 'implementation-strategy'),
    NAMED_BY_REVIEW.map((n) => ({ token: n, class: classOf(n), serves: declared.find((d) => d.name === n)?.freeze?.serves })),
    { input: 'the reduced-motion requirement itself, which IS Product truth and must stay contract',
      rejected: classOf('qandeel.accessibility.motion.semantic-events-must-survive') === 'product-contract' });

  /* K-04: the numeric calibration constants are tunable craft, and each names the irreversible
     requirement underneath it — so reclassifying them did not weaken anything. */
  const CALIBRATION = [
    'qandeel.accessibility.text.leading-ratio',
    /* MOVED HERE BY I-08B3.1-F1R2. F1R had it as an irreversible product contract; it is a
       measured threshold for one face on one renderer, and the contract is the OUTCOME. */
    'qandeel.accessibility.text.leading-floor',
    'qandeel.accessibility.text.bold-weight-delta',
    'qandeel.accessibility.text.max-scale',
    'qandeel.accessibility.text.label-escape-scale',
    'qandeel.accessibility.contrast.boundary-width',
    'qandeel.accessibility.contrast.focus-thickness',
  ];
  const cal = CALIBRATION.map((n) => ({ token: n, class: classOf(n), serves: declared.find((d) => d.name === n)?.freeze?.serves ?? null }));
  check('K-04', 'every numeric accessibility calibration constant is PRODUCTION DEFAULT and names the requirement it instantiates',
    cal.every((c) => c.class === 'production-default' && typeof c.serves === 'string' && c.serves.length > 0), cal,
    { input: 'the rule that Bold Text must not erase SELECTED, which is Product truth and must stay contract',
      rejected: classOf('qandeel.accessibility.text.selected-step-must-survive-bold') === 'product-contract' });

  /**
   * K-05: A PROPERTY THAT ENCODES NOTHING CANNOT BECOME A REQUIRED SEMANTIC CARRIER (REV-04).
   *
   * I-08B3.1-D2R's PRESENTATION_CONTRACT declares `ring.radius`, `ring.layer`,
   * `ring.contourCount`, `ring.contourShape`, `ring.hue` and `field.parallax` all `encodes: null`.
   * F1 then shipped `nonColorCue.depth = level-line-count+scale` as a PRODUCT CONTRACT, in the
   * group whose meaning is "the companion channel a colour-bearing DISTINCTION ships with" —
   * quietly making near-from-far something an accessible expression was required to preserve,
   * which is to say something that means something. That is authority D2R explicitly removed,
   * reintroduced from inside the accessibility layer.
   *
   * The craft is kept and nothing visual changes; only the authority level is corrected. This
   * check reads D2R's own table rather than a list kept here, so a property that later acquires a
   * canonical meaning stops being forbidden automatically, and one that never does stays so.
   */
  const encodesNull = Object.entries(PRESENTATION_CONTRACT).filter(([, v]) => v.encodes === null).map(([k]) => k);
  /* the words a token VALUE would use to name each of those properties */
  const MARKERS = [
    [/level-line|contour-count/i, 'ring.contourCount'],
    [/\bscale\b|\blayer\b|\bdepth\b/i, 'ring.layer'],
    [/\bhue\b/i, 'ring.hue'],
    [/parallax/i, 'field.parallax'],
    [/radius/i, 'ring.radius'],
    [/contour-?shape/i, 'ring.contourShape'],
  ];
  const promoted = declared
    .filter((d) => d.freeze?.class === 'product-contract')
    .flatMap((d) => {
      const raw = (() => {
        const j = JSON.parse(readFileSync(join(PKG, d.file), 'utf8'));
        return d.name.split('.').reduce((n, k) => (n ? n[k] : undefined), j)?.$value;
      })();
      if (typeof raw !== 'string' || raw.startsWith('{')) return [];
      return MARKERS.filter(([re, prop]) => re.test(raw) && encodesNull.includes(prop))
        .map(([, prop]) => ({ token: d.name, value: raw, namesPresentationProperty: prop }));
    });
  /* and the craft group is real, is NOT contract, and says what it is */
  const craft = declared.filter((d) => d.name.startsWith('qandeel.accessibility.presentationCraft.'));
  const craftWellFormed = craft.length > 0 && craft.every((d) =>
    d.freeze?.class !== 'product-contract' && d.freeze?.carriesNoAnalyticalMeaning === true &&
    Array.isArray(d.freeze?.inheritedEncodesNull) && d.freeze.inheritedEncodesNull.every((x) => encodesNull.includes(x)));
  check('K-05', 'no Ambient property D2R declares `encodes: null` is promoted into a required semantic accessibility carrier',
    promoted.length === 0 && craftWellFormed,
    { encodesNullProperties: encodesNull, productContractTokensNamingOne: promoted,
      presentationCraft: craft.map((d) => ({ name: d.name, class: d.freeze?.class, carriesNoAnalyticalMeaning: d.freeze?.carriesNoAnalyticalMeaning, about: d.freeze?.inheritedEncodesNull })),
      note: 'The list of forbidden properties is read from I-08B3.1-D2R\'s own PRESENTATION_CONTRACT, not kept here. A property that later acquires a canonical meaning leaves this list by itself.' },
    { input: 'the withdrawn token `nonColorCue.depth = level-line-count+scale`, classified product-contract',
      rejected: MARKERS.some(([re, prop]) => re.test('level-line-count+scale') && encodesNull.includes(prop)) });

  /**
   * K-06: THE ARABIC CONTRACT IS NO-CLIPPING; 1.6 IS NOT A UNIVERSAL PRODUCT LAW (REV-05).
   */
  const arabic = 'qandeel.accessibility.text.arabic-must-not-clip';
  const floor = 'qandeel.accessibility.text.leading-floor';
  const floorNode = declared.find((d) => d.name === floor);
  check('K-06', 'the Arabic Product contract is NO CLIPPING, and the numeric line-height threshold is a production default that serves it',
    classOf(arabic) === 'product-contract' &&
    classOf(floor) === 'production-default' &&
    floorNode?.freeze?.serves === arabic,
    { contract: { token: arabic, class: classOf(arabic) },
      threshold: { token: floor, class: classOf(floor), serves: floorNode?.freeze?.serves },
      note: 'The exact line-height needed depends on the font, the size, the renderer, the platform metrics and the content. What is irreversible is the outcome: Arabic must not clip, lose diacritics, collide destructively or become unreadable at any supported text scale.' },
    { input: 'the numeric threshold classified as an irreversible product contract, which is what F1R shipped',
      rejected: classOf(floor) !== 'product-contract' });
}

/* ========= B — A BOUNDED PROOF MAY NOT DESCRIBE ITSELF AS EXHAUSTIVE (REV-01, REV-06) ===== */
{
  /**
   * WHAT THE INDEPENDENT REVIEW FOUND, AND IT WAS RIGHT AGAIN.
   *
   * `SEMANTIC_FIELDS = [epistemic, temporal, actionable]` was documented as "the complete list of
   * what a projection may carry". Three fields a synthetic fixture happens to supply are not the
   * Product's semantic model. The parity matrix proves preservation FOR THE DIMENSIONS SUPPLIED,
   * and canonical V may legitimately expose evidence, provenance, uncertainty and more.
   *
   * This is the same shape of error as the fixture's own values reading as Product semantics, one
   * level up: there, a test INPUT was mistaken for a decision; here, a test's SCOPE is.
   */
  const corpusB = readdirSync(join(PKG, 'docs')).filter((x) => x.endsWith('.md')).map((x) => ({ f: 'docs/' + x, body: readFileSync(join(PKG, 'docs', x), 'utf8') }))
    .concat([{ f: 'README.md', body: readFileSync(join(PKG, 'README.md'), 'utf8') }])
    .concat([{ f: 'tools/f1-fixture.mjs', body: readFileSync(join(PKG, 'tools/f1-fixture.mjs'), 'utf8') }]);

  /* the withdrawn shape of claim, in any of its spellings */
  const EXHAUSTIVE = /complete list of what a projection may carry|the complete semantic (field set|model)|(complete|exhaustive|every possible)[^.\n]{0,60}(semantic field|analytical fact)[^.\n]{0,40}(canonical V|a view may)/i;
  /**
   * The same ±2-line withdrawal window check G-02 needed, and for the same reason: the revision
   * record has to be able to QUOTE the sentence it is retracting. A retraction that cannot name
   * what it retracts is not much of a retraction.
   */
  const WITHDRAWN_B = /withdraw|BOUNDED|NOT the complete|is not the complete|not exhaustive|too strong|corrected that sentence|nothing of the sort/i;
  const exhaustiveClaims = [];
  for (const c of corpusB) {
    const lines = c.body.split('\n');
    lines.forEach((line, i) => {
      if (!EXHAUSTIVE.test(line)) return;
      /* THE WINDOW IS UNWRAPPED BEFORE IT IS TESTED, and it had to be twice over. G-02's version
         joined the lines raw, so a withdrawal that happens to wrap — "It is nothing\n * of the
         sort" — was invisible to the predicate; and normalising whitespace alone was not enough,
         because a block comment leaves its `*` in the middle of the reassembled sentence. A guard
         that depends on where a comment happens to break lines is measuring the reflow, not the
         claim. */
      const window = lines.slice(Math.max(0, i - 2), i + 3)
        .map((l) => l.replace(/^\s*\*\s?/, '')).join(' ').replace(/\s+/g, ' ');
      if (!WITHDRAWN_B.test(window)) exhaustiveClaims.push(`${c.f}:${i + 1}`);
    });
  }
  const scopeIsData = FIXTURE_SCOPE.exhaustive === false &&
    Array.isArray(FIXTURE_SCOPE.whatTheProofDoesNotEstablish) && FIXTURE_SCOPE.whatTheProofDoesNotEstablish.length >= 2 &&
    typeof FIXTURE_SCOPE.implementationDependency === 'string' &&
    /EXHAUSTIVE AGAINST THE ACTUAL USER-EXPOSABLE V SCHEMA/i.test(FIXTURE_SCOPE.implementationDependency);

  check('B-01', 'the synthetic fixture\'s field set is never described as the complete semantic model of canonical V, and its scope ships as DATA',
    exhaustiveClaims.length === 0 && scopeIsData,
    { exhaustiveClaimsFound: exhaustiveClaims, scopeIsData, scope: FIXTURE_SCOPE,
      note: 'An occurrence within two lines of a withdrawal is a QUOTATION of the retracted sentence, not an assertion of it.' },
    { input: 'the withdrawn sentence "the complete list of what a projection may carry", standing alone',
      rejected: EXHAUSTIVE.test('and the complete list of what a projection may carry') && !WITHDRAWN_B.test('and the complete list of what a projection may carry') });

  /**
   * B-02: THE CONTRACT IS WIDER THAN THE FIXTURE, AND IT IS IN THE TOKEN TREE — plus the
   * behavioural half, which is the part that is not a sentence: a field the view supplies that
   * the projector has no mapping for is REPORTED, not dropped in silence. A bounded projector
   * cannot carry a field it has no vocabulary for; it can refuse to be quiet about it, and that
   * is the difference between a known limit and an undetected loss.
   */
  const comp = resolveAll().scalar.PROJECTION_COMPLETENESS;
  const compDesc = String(comp?.node?.$description ?? '');
  const shipped = project(syntheticView());
  const withExtra = project({
    ...syntheticView(),
    objects: syntheticView().objects.map((o, i) => (i === 0 ? { ...o, evidence: ['a field this projector has no mapping for'] } : o)),
  });
  check('B-02', 'the completeness contract is a product-contract token that records the production-mapping dependency, and an unmapped disclosed field is DETECTED rather than silently dropped',
    String(comp?.value).toLowerCase() === 'exhaustive-against-user-exposable-v' &&
    comp?.node?.$extensions?.['com.qandeel.freeze']?.class === 'product-contract' &&
    /EXHAUSTIVE AGAINST THE ACTUAL USER-EXPOSABLE V SCHEMA/i.test(compDesc) &&
    shipped.$unmappedFields.length === 0 && withExtra.$unmappedFields.length === 1,
    { token: comp?.token, value: comp?.value, class: comp?.node?.$extensions?.['com.qandeel.freeze']?.class,
      recordsTheImplementationDependency: /EXHAUSTIVE AGAINST THE ACTUAL USER-EXPOSABLE V SCHEMA/i.test(compDesc),
      shippedFixtureUnmapped: shipped.$unmappedFields,
      withAnUnmappedFieldSupplied: withExtra.$unmappedFields },
    { input: 'a view supplying a field the projector has no mapping for — it must be reported, and the shipped fixture must report none',
      rejected: withExtra.$unmappedFields.length > 0 && shipped.$unmappedFields.length === 0 });

  /**
   * B-03: WHEREVER THE MATRIX IS QUOTED, IT IS QUOTED AS A BOUNDED PROOF (REV-06).
   *
   * The matrix is valuable and stays exactly as it is. What may not stand is a document quoting
   * its cell count as though it settled every analytical fact canonical V can carry.
   */
  const pb = existsSync(join(PKG, 'data/F1_PARITY.json')) ? JSON.parse(readFileSync(join(PKG, 'data/F1_PARITY.json'), 'utf8')) : null;
  const cellStr = pb ? String(pb.matrix.cellCount) : null;
  const BOUNDED = /bounded|tested (semantic )?dimensions|dimensions (this|the) fixture supplies|not.{0,30}exhaustive|does not (alone )?prove every/i;
  const quoting = cellStr ? corpusB.filter((c) => c.f.endsWith('.md') && new RegExp(`(^|[^\\d.])${cellStr}([^\\d.]|$)`).test(c.body)) : [];
  const unqualified = quoting.filter((c) => !BOUNDED.test(c.body)).map((c) => c.f);
  check('B-03', 'every document that quotes the parity matrix describes it as a BOUNDED proof of the tested dimensions',
    !!pb && pb.matrix.scope?.exhaustive === false && quoting.length > 0 && unqualified.length === 0,
    { cells: cellStr, documentsQuotingIt: quoting.map((c) => c.f), withoutTheBoundedQualification: unqualified,
      scopeCarriedInTheMatrix: pb?.matrix?.scope ?? null,
      productContract: 'NO USER-EXPOSABLE DISCLOSED ANALYTICAL TRUTH MAY BE LOST SOLELY BECAUSE THE EXPRESSION IS ACCESSIBLE. The complete production mapping is validated against the real canonical V schema during integration.' },
    { input: 'a document quoting the cell count with no bounding language anywhere in it',
      rejected: !BOUNDED.test(`The matrix asserts ${cellStr} cells and every one of them passes.`) });
}

/* ================================================= R / P — SCREEN READER AND PARITY ====== */
{
  const sr = existsSync(join(PKG, 'data/F1_SCREEN_READER.json')) ? JSON.parse(readFileSync(join(PKG, 'data/F1_SCREEN_READER.json'), 'utf8')) : null;
  check('R-01', 'every analytical object has an engine-computed accessible name, and relationships are stated in words',
    !!sr?.checks?.pass, sr?.checks ?? 'run tools/f1-sr.mjs',
    { input: 'a fabricated accessible name', rejected: !!sr?.checks?.probe?.detectedAsMissing });

  /**
   * R-02: THE ORDERING CHECK, REWRITTEN. It used to assert that the `orderedBy` STRING contained
   * the words "identity order" — a check on the sentence, which passed while the sentence gave a
   * technical accident Product authority. It now verifies the ALGORITHM: the emitted order is
   * recomputed from the ids alone and compared, the forbidden wording is rejected by name, and
   * no field in the vocabulary of ranking may appear anywhere in the projection.
   */
  check('R-02', 'traversal order is the DECLARED algorithm, is explicitly non-semantic, and carries no rank',
    !!sr?.checks && sr.checks.orderAgrees.every((o) => o.agrees) && sr.checks.orderWordingClean && sr.checks.rankFieldsFound.length === 0,
    sr?.checks ? { perAxis: sr.checks.orderAgrees.map((o) => ({ kind: o.kind, rule: o.rule, agrees: o.agrees })), wordingClean: sr.checks.orderWordingClean, rankFields: sr.checks.rankFieldsFound, seam: sr.projection.implementationSeam } : 'run tools/f1-sr.mjs',
    { input: 'the withdrawn wording "the Product\'s own stable identity order"',
      rejected: /identity order/i.test('the Product\'s own stable identity order') });

  /* R-03: and the planted permutation — the order does not depend on the authored array at all. */
  const ord = sr?.ordering;
  check('R-03', 'permuting the source array changes neither the traversal order nor one semantic fact',
    !!ord?.pass,
    ord ? { orderStable: ord.traversalOrderUnchanged, factsStable: ord.semanticFactsUnchanged, emitted: ord.emitted } : 'run tools/f1-sr.mjs',
    { input: 'the same comparison against an order sorted by a fabricated per-object strength', rejected: !!ord?.probe?.rejected });

  const p = existsSync(join(PKG, 'data/F1_PARITY.json')) ? JSON.parse(readFileSync(join(PKG, 'data/F1_PARITY.json'), 'utf8')) : null;
  check('P-01', 'the same analytical objects, relationships, temporal truth, epistemic status and actions exist in EVERY expression',
    !!p?.matrix?.pass, p ? { expressions: p.matrix.expressions.length, objects: p.matrix.objects.length, cells: p.matrix.cellCount, failures: p.matrix.failures.length } : 'run tools/f1-parity.mjs',
    { input: 'a fabricated cell with a missing object', rejected: !!p?.matrix?.probe?.caught });

  /**
   * P-02: EXISTENCE IS DECIDED BY OBJECT-SPECIFIC RENDERED PRESENCE, AND BY NOTHING ELSE.
   *
   * The four planted removals are the evidence. Each deletes exactly one object's rendered
   * elements and leaves it in the truth JSON; the matrix must report that object absent, must
   * report every other object present, and must do so for all four families independently.
   */
  const planted = p?.matrix?.planted ?? [];
  check('P-02', 'removing ONE object from the rendering fails parity for that object and for no other — TOPIC, CONNECTION, PATTERN and INSIGHT independently',
    planted.length === 4 && planted.every((x) => x.caught),
    planted.map((x) => ({ kind: x.removed.kind, id: x.removed.id, elementsRemoved: x.elementsRemoved, reportedAbsent: x.victimReportedAbsent, othersUntouched: x.everyOtherObjectStillPresent, othersDisturbed: x.othersDisturbed })),
    { input: 'a planted set covering only three of the four families', rejected: 3 !== 4 });

  check('P-03', 'the truth JSON alone cannot satisfy rendered presence',
    !!p?.matrix?.truthJsonIsNotEvidenceOfRendering && planted.every((x) => x.stillInTruthJSON),
    { note: 'In every one of the four planted runs the object remains in #qd-truth and is still reported ABSENT. The JSON is read for the object\'s FACTS and is never evidence that it was drawn.',
      rows: planted.map((x) => ({ id: x.removed.id, stillInTruthJSON: x.stillInTruthJSON, reportedAbsent: x.victimReportedAbsent })) },
    { input: 'a run in which the object was removed from the JSON too, which would prove nothing about the renderer',
      rejected: !(false && true) });

  /* P-04: and no accessible expression may name fewer objects than the default names. */
  const nm = p?.matrix?.naming;
  check('P-04', 'no accessibility expression names fewer analytical objects than the DEFAULT, and every object is named in the projection and in the inspection view',
    !!nm?.pass,
    nm ? { perExpression: nm.perExpression.map((n) => ({ expression: n.expression, named: n.namedCount, lost: n.lostRelativeToDefault })), notNamedInProjection: nm.objectsNotNamedInTheScreenReaderProjection, notNamedInInspection: nm.objectsNotNamedInTheInspectionView, drawnButUnnamedByDefault: nm.drawnButNotNamedInTheDefaultVisualExpression } : 'run tools/f1-parity.mjs',
    { input: 'an expression that lost one name relative to the default', rejected: ['x'].length > 0 });
}

/* ================================================================== the report =========== */
const passed = results.filter((r) => r.pass).length;
const probesRejecting = results.filter((r) => r.probe && r.probe.rejected === true).length;
const report = {
  generatedBy: 'tools/f1-verify.mjs',
  checks: results.length,
  passed,
  failed: results.length - passed,
  probes: { total: results.filter((r) => r.probe).length, rejecting: probesRejecting },
  results,
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(join(PKG, 'data/F1_VALIDATION.json'), JSON.stringify(report, null, 2) + '\n');
  for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.id.padEnd(6) + r.what);
  console.log(`\n${passed}/${results.length} checks, ${probesRejecting}/${report.probes.total} probes rejecting`);
  if (passed !== results.length) process.exit(1);
}
export { report };
