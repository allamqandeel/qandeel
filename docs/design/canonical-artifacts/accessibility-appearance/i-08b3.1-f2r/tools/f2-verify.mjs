/**
 * I-08B3.1-F2 — EVERY CHECK, AND A PLANTED PROBE UNDER EVERY ONE OF THEM.
 *
 * ================================================================================================
 * THE RULE THIS FILE OBEYS, INHERITED FROM I-08B3.1-C1R AND KEPT EVER SINCE:
 *
 *     A CHECK THAT CANNOT FAIL IS A SENTENCE.
 *
 * So every check below is paired with an input that MUST make it fail. The probe is not a second
 * test of the same thing — it is a test of the DETECTOR. A green board under a blind check is
 * worse than no check, because it is believed.
 *
 * ================================================================================================
 * WHAT IS CHECKED HERE AND WHAT IS DELEGATED
 *
 * The three heavy gates render documents in a browser and write their own records:
 *   tools/f2-regression.mjs  the dark-regression gate      -> data/F2_DARK_REGRESSION.json
 *   tools/f2-parity.mjs      the cross-appearance matrix   -> data/F2_PARITY.json
 *   tools/f2-switch.mjs      the appearance-switch contract-> data/F2_SWITCH.json
 *
 * This file reads their records rather than re-rendering, and asserts FRESHNESS so a stale record
 * cannot pass for a current one: every delegated check requires its record to exist, to be newer
 * than the token tree it is about, and to carry the state it claims.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { resolveAll, loadTokens, ROLES, SCALARS, MODIFIERS, BASE_FILES, tokenTreeDigest } from './f2-resolve.mjs';
import { resolveAll as f1ResolveAll, INHERITED_CLASSES, F1_CLASSES } from '../vendor/f1/tools/f1-resolve.mjs';
import { profile, measureProfile, WASH_OPACITY, intensityAt, areaMean, bindingAreaMean, PEAK_LEVELS, readingStepOf } from './f2-meaning.mjs';
import { chromaCeilingOf } from './f2-scene.mjs';
import { BOARD_CHROME } from './f2-boards.mjs';
import { check as tokenCheck } from './f2-tokens.mjs';
import { lch, dEok, over, contrastHex, grayOf, invert, hex, Y } from './f2-color.mjs';
import { ATMOSPHERE } from '../vendor/f1/vendor/d2r/scene/d2-foundation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const read = (rel) => JSON.parse(readFileSync(join(PKG, rel), 'utf8'));
const exists = (rel) => existsSync(join(PKG, rel));

const R = { dark: resolveAll({ appearance: 'dark' }), light: resolveAll({ appearance: 'light' }) };
const D = read('data/F2_DERIVATION.json');

const hueOf = (h) => { const x = lch(h)[2]; return Number.isNaN(x) ? null : x; };
const hueGap = (a, b) => { if (a === null || b === null) return null; const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const inksOf = (r) => [r.colour.PRIMARY.value, r.colour.SECONDARY.value, r.colour.TERTIARY.value];

/**
 * THE TOKEN TREE'S CONTENT IDENTITY, so a delegated record can be required to be ABOUT THIS TREE.
 *
 * I-08B3.1-F2 asked whether the record's file was MODIFIED MORE RECENTLY than any token file. An
 * independent extraction of the archive on Linux then failed D-01, P-01 and S-01 while every
 * record inside them said PASS, because a ZIP entry carries a whole-second DOS timestamp and an
 * extraction can land every file on the same second or in any order. The gate was reporting a
 * property of the filesystem it happened to be standing on.
 *
 * Content answers the actual question and answers it identically everywhere. It is also stricter:
 * "newer than the tokens" passes a record written after an unrelated edit somewhere else, and
 * "generated against exactly these bytes" does not.
 */
const TOKEN_TREE = tokenTreeDigest();

const CHECKS = [];
const add = (id, title, fn) => CHECKS.push({ id, title, fn });

/* ======================================================= A — THE APPEARANCE ARCHITECTURE ==== */

/**
 * RESOLVE A NAME TO ITS LITERAL, FOLLOWING EVERY HOP.
 *
 * THIS HELPER EXISTS BECAUSE ITS ABSENCE MADE A-01 A CHECK THAT COULD NOT FAIL. The first version
 * compared `flat.get(name).value` between the two trees — but for a SEMANTIC name that value is
 * the alias string `{qandeel.expression.world}`, which is identical in every appearance by
 * construction. The check therefore compared two copies of the same alias and reported agreement,
 * and its probe — substituting the light tree — reported agreement too, which is what gave it
 * away. A probe that cannot reject is the only reliable way to notice a check that cannot fail.
 */
const literalOf = (r, name) => {
  const ALIAS = /^\{([^}]+)\}$/;
  let cur = name, alpha;
  for (let i = 0; i < 16; i++) {
    const e = r.flat.get(cur);
    if (!e) return null;
    if (e.alpha !== undefined && alpha === undefined) alpha = e.alpha;
    const m = typeof e.value === 'string' ? ALIAS.exec(String(e.value).trim()) : null;
    if (!m) return { value: typeof e.value === 'string' ? e.value.toLowerCase() : e.value, alpha };
    cur = m[1].trim();
  }
  return null;
};

add('A-01', 'the DEFAULT resolution is DARK and every inherited name resolves to exactly the LITERAL I-08B3.1-F1 resolves it to', () => {
  const f1 = f1ResolveAll();
  const f2 = resolveAll();
  const names = [...INHERITED_CLASSES, ...F1_CLASSES].map(([, t]) => t);
  const differing = names.filter((t) => JSON.stringify(literalOf(f1, t)) !== JSON.stringify(literalOf(f2, t)));
  return {
    pass: f2.applied.appearance === 'dark' && differing.length === 0,
    detail: { defaultAppearance: f2.applied.appearance, namesCompared: names.length, differing, resolvedThrough: 'the full alias chain, to the literal — not the alias string, which is identical in every appearance by construction' },
    probe: {
      name: 'the same comparison with the LIGHT tree substituted for the default',
      rejected: (() => {
        const L = resolveAll({ appearance: 'light' });
        const d = names.filter((t) => JSON.stringify(literalOf(f1, t)) !== JSON.stringify(literalOf(L, t)));
        return d.length > 0;
      })(),
    },
  };
});

add('A-02', 'F2 introduces NO semantic Product role — every role it supplies a value for already existed', () => {
  const f1 = f1ResolveAll();
  const missing = ROLES.filter(([, t]) => !f1.flat.has(t)).map(([, t]) => t);
  /* The ONE name F2 adds is the meaning-light TECHNIQUE, which is an expression-layer string and
     not a Product role. It is named here so the check states it rather than being silent. */
  const addedNames = ['qandeel.expression.illumination.technique', 'qandeel.expression.illumination.bloom.split',
    'qandeel.expression.illumination.bloom.glaze-width',
    'qandeel.expression.atmosphere.luminance.near', 'qandeel.expression.atmosphere.luminance.mid',
    'qandeel.expression.atmosphere.luminance.far', 'qandeel.expression.atmosphere.chroma-ceiling'];
  const anyIsARole = addedNames.some((n) => ROLES.some(([, t]) => t === n));
  return {
    pass: missing.length === 0 && !anyIsARole,
    detail: { rolesChecked: ROLES.length, missingFromF1: missing, namesF2Adds: addedNames, noneIsAProductRole: !anyIsARole },
    probe: {
      name: 'a synthetic role name that does not exist in the frozen tree',
      rejected: !f1.flat.has('qandeel.light.accent.primary'),
    },
  };
});

add('A-03', "I-08B3.1-F1's increased-contrast law survives in light: raising the atmosphere ALONE compresses the meaning hierarchy, raising the relation with it widens it", () => {
  const m = D.increasedContrast.meaningHierarchy;
  return {
    pass: m.ratioIfOnlyAtmosphereRose < m.ratioDefault && m.ratioIncreased > m.ratioDefault,
    detail: { ...m, darkCounterparts: { default: 1.2914, ifOnlyAtmosphereRose: 1.028, increased: 1.524 } },
    probe: {
      name: 'the same three figures with the relation NOT raised',
      rejected: m.ratioIfOnlyAtmosphereRose < 1.05,
    },
  };
});

add('A-04', 'the appearance modifier has exactly two contexts and neither is empty', () => {
  const ctx = MODIFIERS.appearance.contexts;
  const keys = Object.keys(ctx);
  const counts = Object.fromEntries(keys.map((k) => [k, ctx[k].length]));
  const allPresent = Object.values(ctx).flat().every((rel) => exists(rel));
  return {
    pass: keys.length === 2 && keys.every((k) => ctx[k].length > 0) && allPresent,
    detail: { contexts: keys, fileCounts: counts, everyFilePresent: allPresent },
    probe: { name: 'a context name the resolver has never heard of', rejected: (() => { try { resolveAll({ appearance: 'sepia' }); return false; } catch { return true; } })() },
  };
});

add('A-05', 'no QANDEEL colour literal is typed into any file that PAINTS a QANDEEL surface', () => {
  /* The derivation and the regression gate are EXEMPT and the exemption is stated: the derivation
     reads the frozen values through F1's resolver and writes none, and the regression gate's
     expected values MUST be independent of the tree it is checking or it has no opinion. */
  /* f2-skills and f2-references QUOTE their sources verbatim, and one of those quotations names a
     hex — the calibration note about the cream AI-generated design clusters on. A quotation is
     evidence, not a value, and removing the hex to satisfy a scanner would damage the evidence. */
  /**
   * THE SCOPE IS THE FILES THAT EMIT A QANDEEL PIXEL, AND THE SCOPE IS THE WHOLE CHECK.
   *
   * An earlier version scanned every tool and reported the board captions, which QUOTE QANDEEL
   * values as evidence — `#801c11`, the rejected Error candidate, printed on Board H so a reviewer
   * can see what was not chosen — and the guards' own allowlists. Those are documentation, and
   * removing them to satisfy a scanner would damage the evidence.
   *
   * **A-05 guards PAINTING. tools/f2-consistency.mjs's claim C1 guards QUOTING**, and it is the
   * stronger of the two: every hex anywhere in the package, including every board caption, must be
   * a value this package ships, rejects by name, or inherits. Between them nothing is uncovered.
   */
  const PAINTERS = ['f2-scene.mjs', 'f2-surfaces.mjs', 'f2-meaning.mjs', 'f2-color.mjs', 'f2-resolve.mjs', 'f2-render.mjs'];
  const offenders = [];
  for (const f of PAINTERS) {
    const src = readFileSync(join(PKG, 'tools', f), 'utf8');
    /* strip comments before scanning: a hex inside an explanation is documentation, not a value */
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of code.matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      const hex = m[0].toLowerCase();
      /* pure black and pure white are not QANDEEL colours — they are the ends of the axis, and the
         scrim's ink is legitimately one of them */
      if (['#000000', '#ffffff'].includes(hex)) continue;
      offenders.push({ file: f, literal: m[0] });
    }
  }
  return {
    pass: offenders.length === 0,
    detail: {
      painters: PAINTERS,
      note: 'A-05 guards painting; C1 in tools/f2-consistency.mjs guards quoting, over every surface in the package.',
      offenders,
    },
    probe: {
      name: 'the same scan over a source line carrying a QANDEEL literal',
      rejected: /#[0-9a-fA-F]{6}\b/.test('const brass = "#a58e6f";'),
    },
  };
});

/* ================================================== X — CROSS-APPEARANCE IDENTITY =========== */

add('X-01', 'the chroma ladder of ROLE FAMILIES is identical in both appearances', () => {
  const ca = D.crossAppearance;
  return {
    pass: ca.chromaOrderPreserved && ca.ladderBreaks.length === 0,
    detail: { darkBands: ca.darkBands, lightBands: ca.lightBands, breaks: ca.ladderBreaks },
    probe: {
      name: 'a light Light quiet enough to drag the atmosphere ceiling below the ink ramp',
      rejected: (() => {
        const quiet = 0.0180; // a Light stop chroma just under what the ladder needs
        const inkMax = Math.max(...inksOf(R.light).map((h) => lch(h)[1]));
        return 0.62 * quiet <= inkMax;
      })(),
    },
  };
});

add('X-02', "the atmosphere's chroma ceiling is DERIVED from each appearance's own Light, and matches what the token file records", () => {
  const derivedDark = chromaCeilingOf(R.dark);
  const derivedLight = chromaCeilingOf(R.light);
  const tokenLight = R.light.flat.get('qandeel.expression.atmosphere.chroma-ceiling')?.value ?? null;
  return {
    pass: derivedDark === ATMOSPHERE.chromaCeiling && derivedLight === tokenLight,
    detail: { derivedDark, d2rPublished: ATMOSPHERE.chromaCeiling, derivedLight, tokenLight, formula: '0.62 x the least chromatic Light stop — I-08B3.1-D2R\'s own' },
    probe: { name: 'the derivation applied to the other appearance\'s stops', rejected: derivedDark !== derivedLight },
  };
});

add('X-03', 'every chromatic role holds its hue across appearances, within the declared tolerance', () => {
  const tol = R.dark.scalar.HUE_CONSTANCY.value;
  const rows = ROLES.map(([role]) => {
    const a = hueOf(R.dark.colour[role].value), b = hueOf(R.light.colour[role].value);
    return { role, dark: a === null ? null : +a.toFixed(1), light: b === null ? null : +b.toFixed(1), drift: hueGap(a, b) === null ? null : +hueGap(a, b).toFixed(2) };
  });
  const chromatic = rows.filter((r) => r.drift !== null);
  const worst = Math.max(...chromatic.map((r) => r.drift));
  /**
   * AND THE TOLERANCE MAY NOT BE SPENT ON MAGNITUDE NOBODY CAN SEE.
   *
   * A drift inside the tolerance is not automatically a drift the requirement forced. I-08B3.1-F2R
   * watched the search return a Meaning Light ramp 2.85 degrees from its dark counterparts — inside
   * a 3 degree tolerance, so this check passed — where the feasible set contained one under 0.7, and
   * the only thing those two degrees bought was a fortieth of a just-noticeable step of event
   * magnitude. **A tolerance is a ceiling, not a budget.** The derivation now quantises its magnitude
   * objective to a JND and records what the winner was chosen over; this asserts that the shipped
   * drift is the least available at the shipped magnitude, which is the only way to test that the
   * rule stated in the record is the rule that ran.
   */
  const audit = D.winningFamily?.selectionAudit ?? null;
  const notBought = audit ? audit.hueDriftWasNotBoughtWithImperceptibleMagnitude === true : false;
  return {
    pass: worst <= tol && notBought,
    detail: {
      tolerance: tol, worst, rows,
      aToleranceIsACeilingNotABudget: audit
        ? {
          configurationsSharingTheWinnersMagnitude: audit.configurationsSharingTheWinnersMagnitude,
          totalHueDriftAmongThem: audit.totalHueDriftAmongThem,
          magnitudeBucketWidth: audit.magnitudeBucketWidth,
          theShippedDriftIsTheLeastAvailableAtThisMagnitude: notBought,
          whatTheUnquantisedObjectiveWouldHaveChosen: audit.whatTheUnquantisedObjectiveWouldHaveChosen,
          /* AND WHY IT IS NOT SMALLER, from the run rather than from an argument: on this ground the
             ramps whose third rung sits on its dark counterpart's hue need more chroma, and at a
             fixed hue more chroma lowers the lightness sRGB can hold — so the flooded core comes
             down with it and stops clearing a just-noticeable rise. R-HUE and R-SOURCE pull against
             each other through the gamut boundary. */
          whatASmallerDriftWouldCost: audit.whatASmallerDriftWouldCost,
        }
        : 'the derivation record carries no selection audit — re-run tools/f2-derive.mjs',
    },
    probe: {
      name: 'the same measurement against the INVERTED dark values',
      rejected: (() => {
        const inv = ROLES.map(([role]) => hueGap(hueOf(R.dark.colour[role].value), hueOf(invert(R.dark.colour[role].value)))).filter((x) => x !== null);
        return Math.min(...inv) > tol;
      })(),
    },
    /* A SECOND PROBE, because the two halves of this check fail differently and one probe can only
       exercise one of them. This one is the configuration the unquantised objective would have
       returned: it must carry MORE total drift than the shipped one, or the quantisation changed
       nothing and the first half of this check is decorative. */
    probe2: audit ? {
      name: 'the configuration the unquantised magnitude objective would have chosen',
      rejected: audit.whatTheUnquantisedObjectiveWouldHaveChosen.totalHueDrift > audit.totalHueDriftAmongThem.chosen,
    } : { name: 'no audit in the record', rejected: false },
  };
});

add('X-04', 'the three reading inks hold their contrast ratios against their own ground', () => {
  const rows = ['PRIMARY', 'SECONDARY', 'TERTIARY'].map((role) => {
    const d = contrastHex(R.dark.colour[role].value, R.dark.colour.WORLD.value);
    const l = contrastHex(R.light.colour[role].value, R.light.colour.WORLD.value);
    return { role, dark: +d.toFixed(4), light: +l.toFixed(4), delta: +Math.abs(d - l).toFixed(4) };
  });
  const worst = Math.max(...rows.map((r) => r.delta));
  return {
    pass: worst <= 0.10,
    detail: { rows, worstDelta: worst, tolerance: 0.10 },
    probe: {
      name: 'a light primary ink pushed to pure black',
      rejected: Math.abs(contrastHex('#000000', R.light.colour.WORLD.value) - contrastHex(R.dark.colour.PRIMARY.value, R.dark.colour.WORLD.value)) > 0.10,
    },
  };
});

add('X-05', "SELECTED keeps its weight step over REST in BOTH appearances, at every text setting, including Bold Text", () => {
  /* Dark-on-light strokes read optically thinner than light-on-dark ones, so this is the
     typographic signal most at risk in the light appearance — see the Arabic skill row in the
     Skill Gate. The step is a TOKEN quantity and is appearance-independent by construction; the
     check exists because "by construction" is exactly the kind of claim that should be measured. */
  const rows = [];
  for (const app of ['dark', 'light']) {
    for (const bold of [false, true]) {
      const r = R[app];
      const delta = bold ? r.scalar.TEXT_BOLD_WEIGHT_DELTA.value : 0;
      const rest = r.scalar.REST_WEIGHT.value + delta;
      const sel = r.scalar.SELECTED_WEIGHT.value + delta;
      rows.push({ appearance: app, boldText: bold, rest, selected: sel, step: sel - rest });
    }
  }
  const steps = [...new Set(rows.map((r) => r.step))];
  return {
    pass: steps.length === 1 && steps[0] >= 100,
    detail: { rows, distinctSteps: steps },
    probe: {
      /* Estedad's variable axis maximum is 900. A bold delta large enough to push BOTH rungs past
         it collapses the step to zero — which is the real failure mode the light appearance makes
         more tempting, because apparent weight is what a light ground takes away. */
      name: 'a bold delta large enough to clamp both rungs at the variable axis maximum of 900',
      rejected: (() => {
        const big = 400;
        const rest = Math.min(900, R.light.scalar.REST_WEIGHT.value + big);
        const sel = Math.min(900, R.light.scalar.SELECTED_WEIGHT.value + big);
        return sel - rest < 100;
      })(),
    },
  };
});

add('X-06', 'the light appearance is NOT an inversion of the dark one — measured on the roles the claim is about', () => {
  /**
   * THE CLAIM IS ABOUT THE CHROMATIC ROLES, AND THE FIRST VERSION OF THIS CHECK WAS NOT.
   *
   * It required EVERY role to sit far from its own inversion, and failed on the World: the derived
   * light World is dEok 0.0052 from #efefef, the inversion of #101010. That is not a defect and
   * hiding it would be worse than reporting it — the cross-appearance ladder REQUIRES the ground to
   * be the least chromatic band, so a near-neutral dark ground and a near-neutral light ground are
   * necessarily near each other's inversions. Two near-white neutrals are close whatever route
   * produced them.
   *
   * What "not an inversion" actually means in this system is two things, and both are measured:
   * every CHROMATIC role would be rotated to the opposite side of the colour wheel, and the SCRIM
   * would flip from black to white — which is the single largest datum in the table.
   */
  const rows = ROLES.map(([role]) => {
    const d = R.dark.colour[role].value, l = R.light.colour[role].value, i = invert(d);
    return { role, dark: d, derivedLight: l, wouldBeInverted: i, dEokFromInversion: +dEok(l, i).toFixed(4), hueRotationOfInversion: hueGap(hueOf(d), hueOf(i)), chromatic: hueOf(d) !== null };
  });
  const chromatic = rows.filter((r) => r.chromatic);
  const meanRotation = chromatic.reduce((a, r) => a + r.hueRotationOfInversion, 0) / chromatic.length;
  const closestChromatic = Math.min(...chromatic.map((r) => r.dEokFromInversion));
  /**
   * HUE IS THE INSTRUMENT, NOT DISTANCE, AND THE SECOND VERSION OF THIS CHECK FOUND OUT WHY.
   *
   * It required every chromatic role to sit dEok 0.05 from its inversion and failed on the primary
   * reading ink at 0.0381 — derived #29271f against an inversion of #272a35. Those two are 180
   * degrees apart on the wheel: one is the system's warm ink and the other is a blue-violet. The
   * distance is small only because BOTH are dark and low-chroma, and absolute perceptual distance
   * compresses at low lightness. A threshold on distance therefore measures how dark a role is,
   * not whether it was inverted. The hue of the SHIPPED value against the hue of the inversion
   * does measure it, and it does so for every chromatic role in the system.
   */
  const derivedVsInvertedHue = chromatic.map((r) => ({
    role: r.role,
    derivedLightHue: hueOf(r.derivedLight) === null ? null : +hueOf(r.derivedLight).toFixed(1),
    invertedHue: +hueOf(r.wouldBeInverted).toFixed(1),
    separation: +hueGap(hueOf(r.derivedLight), hueOf(r.wouldBeInverted)).toFixed(1),
  }));
  const worstSeparation = Math.min(...derivedVsInvertedHue.map((r) => r.separation));
  /* the scrim: ink black in BOTH appearances, where an inversion would have made it white */
  const scrimInk = R.light.colour.SCRIM.value;
  const scrimInverted = invert(R.dark.colour.SCRIM.value);
  const scrimDistance = +dEok(scrimInk, scrimInverted).toFixed(4);
  const achromatic = rows.filter((r) => !r.chromatic);
  return {
    pass: meanRotation > 150 && worstSeparation > 150 && scrimDistance > 0.9,
    detail: {
      meanHueRotationAnInversionWouldCause: +meanRotation.toFixed(1),
      worstDerivedToInvertedHueSeparation: worstSeparation,
      derivedVsInvertedHue,
      scrim: { derived: scrimInk, anInversionWouldGive: scrimInverted, dEok: scrimDistance, note: 'the largest single datum: the role an inversion would most obviously flip is the one role that does not flip at all' },
      closestChromaticRoleToItsInversionByDistance: closestChromatic,
      /* READ LIVE, NOT QUOTED. I-08B3.1-F2R's consistency claim C7 found this sentence carrying a
         typed dEok — a figure this check computes two lines above and then restated by hand, which
         is the exact way the dark illumination file came to quote a distance nothing had measured. */
      whyDistanceIsNotTheInstrument: `the primary reading ink sits dEok ${closestChromatic.toFixed(4)} from its inversion and ${Math.min(...derivedVsInvertedHue.map((r) => r.separation)).toFixed(0)} degrees from it. Both are dark and low-chroma, so absolute distance compresses; the hue does not.`,
      achromaticRolesAreNecessarilyNearTheirInversions: achromatic.map((r) => ({ role: r.role, dEok: r.dEokFromInversion })),
    },
    probe: {
      name: 'the same hue measurement with each inversion substituted for the derived light value',
      rejected: (() => {
        const seps = chromatic.map((r) => hueGap(hueOf(r.wouldBeInverted), hueOf(r.wouldBeInverted)));
        return Math.max(...seps) <= 150;
      })(),
    },
  };
});

/* ==================================================== C — THE MEANING LIGHT ================= */

add('C-01', 'the SHIPPED profile reproduces the figures the derivation recorded', () => {
  const p = profile(R.light);
  const m = measureProfile(p, { brass: R.light.colour.BRASS.value, inks: inksOf(R.light), error: R.light.colour.ERROR_INK.value });
  const w = D.winningFamily;
  const near = (a, b, t = 0.004) => Math.abs(a - b) <= t;
  return {
    pass: p.technique === 'signed-bloom'
      && near(m.eventPeak, w.eventPeak) && near(m.grayPeak, w.grayPeak)
      && near(m.areaMean, w.areaMean) && near(m.grayAreaMean, w.areaMeanGray)
      && near(m.minDEokToBrass, w.minDEokToBrass),
    detail: { shipped: m, derivation: { eventPeak: w.eventPeak, areaMean: w.areaMean, areaMeanGray: w.areaMeanGray, grayPeak: w.grayPeak, minDEokToBrass: w.minDEokToBrass, risePeak: w.risePeak, dipPeak: w.dipPeak } },
    probe: {
      name: 'the DARK profile measured against the LIGHT derivation record',
      rejected: !near(measureProfile(profile(R.dark), { brass: R.dark.colour.BRASS.value, inks: inksOf(R.dark), error: R.dark.colour.ERROR_INK.value }).eventPeak, w.eventPeak),
    },
  };
});

add('C-02', 'a meaning event settles to EXACTLY the unilluminated ground, in both appearances — no permanent glow', () => {
  const rows = ['dark', 'light'].map((app) => {
    const p = profile(R[app]);
    return { appearance: app, ground: p.ground, atZero: p.at(0), identical: p.at(0) === p.ground };
  });
  return {
    pass: rows.every((r) => r.identical),
    detail: { rows, note: 'asserted on the QUANTISED hex, not on the float: a residue of one 8-bit step is a permanent glow that a float comparison would never report' },
    probe: {
      /* The smallest alpha that actually moves the composite off the ground by one 8-bit step —
         found rather than assumed, because a guessed alpha rounds back to the ground and the
         probe then proves nothing. */
      name: 'a profile whose settle leaves the smallest residue the 8-bit grid can hold',
      rejected: (() => {
        const g = R.light.colour.WORLD.value, c = R.light.colour.LIGHT_CORE.value;
        for (let a = 0.001; a <= 0.2; a += 0.001) if (over(c, a, g) !== g) return true;
        return false;
      })(),
    },
  };
});

add('C-03', 'the Light stays separable from LIVING BRASS at every intensity, in both appearances', () => {
  const floor = D.adopted.SEPARATION_FLOOR;
  const rows = ['dark', 'light'].map((app) => {
    const p = profile(R[app]);
    let worst = 9, at = null;
    for (let i = 0; i <= 256; i++) { const n = i / 256; const d = dEok(p.at(n), R[app].colour.BRASS.value); if (d < worst) { worst = d; at = +n.toFixed(3); } }
    return { appearance: app, minDEok: +worst.toFixed(4), atIntensity: at, clears: worst >= floor };
  });
  return {
    pass: rows.every((r) => r.clears),
    detail: { floor, rows, note: "I-08B3.1-D2R's own floor, re-run with D2R's own metric on both grounds" },
    probe: {
      name: "the family D2R REJECTED for this very reason, re-measured on the dark ground",
      rejected: (() => {
        let worst = 9;
        for (const stop of ['#fef1d6', '#ecdcbc', '#dcc8a1']) for (let i = 0; i <= 256; i++) {
          const d = dEok(over(stop, (i / 256) * WASH_OPACITY, R.dark.colour.WORLD.value), R.dark.colour.BRASS.value);
          if (d < worst) worst = d;
        }
        return worst < floor;
      })(),
    },
  };
});

add('C-04', 'the meaning event survives having its colour removed, in both appearances', () => {
  const floor = D.adopted.SEPARATION_FLOOR;
  const rows = ['dark', 'light'].map((app) => {
    const p = profile(R[app]);
    let peak = 0;
    for (let i = 0; i <= 256; i++) peak = Math.max(peak, dEok(grayOf(p.at(i / 256)), grayOf(p.ground)));
    return { appearance: app, grayPeak: +peak.toFixed(4), clears: peak >= floor };
  });
  return {
    pass: rows.every((r) => r.clears),
    detail: { floor, rows, note: 'this is the requirement that excluded the chroma-only family, which reaches 0.0000 here' },
    probe: {
      name: 'the CHROMATIC family — the light appearance\'s most tempting answer — measured the same way',
      rejected: (() => {
        const g = R.light.colour.WORLD.value, L = lch(g)[0];
        const stop = hex(L, 0.05, 91);
        let peak = 0;
        for (let i = 0; i <= 256; i++) peak = Math.max(peak, dEok(grayOf(over(stop, (i / 256) * WASH_OPACITY, g)), grayOf(g)));
        return peak < floor;
      })(),
    },
  };
});

add('C-05', 'a meaning event HAS A SOURCE: at its peak it is lighter than its ground, measurably, with the colour removed', () => {
  const rows = ['dark', 'light'].map((app) => {
    const p = profile(R[app]); const gY = Y(p.ground);
    let rise = 0;
    for (let i = 0; i <= 256; i++) { const c = p.at(i / 256); if (Y(c) > gY) rise = Math.max(rise, dEok(grayOf(c), grayOf(p.ground))); }
    return { appearance: app, grayRise: +rise.toFixed(4), clears: rise > D.adopted.JND_DEOK };
  });
  return {
    pass: rows.every((r) => r.clears),
    detail: { floor: D.adopted.JND_DEOK, rows, note: 'measured in grayscale on purpose: in full colour a core that is merely WARMER than its ground satisfies "there is a light" on chroma alone' },
    probe: {
      name: 'the DARKENING family — every insight gets deeper — measured the same way',
      rejected: (() => {
        const g = R.light.colour.WORLD.value, L = lch(g)[0], gY = Y(g);
        const stop = hex(L - 0.30, 0.032, 91);
        let rise = 0;
        for (let i = 0; i <= 256; i++) { const c = over(stop, (i / 256) * WASH_OPACITY, g); if (Y(c) > gY) rise = Math.max(rise, dEok(grayOf(c), grayOf(g))); }
        return rise <= D.adopted.JND_DEOK;
      })(),
    },
  };
});

add('C-06', "the light event's perceived extent does not exceed the dark event's — measured in PIXELS", () => {
  /**
   * MEASURED IN PIXELS BECAUSE THE NORMALISED VERSION WAS VACUOUS, AND ITS PROBE SAID SO.
   *
   * As a FRACTION of the source radius, both appearances' events reach ~0.995 — a falloff that
   * decays to zero covers essentially all of its own source in either appearance, so the
   * requirement could not be failed by any expression and contributed nothing to the search. Its
   * probe refused to reject, which is how that was found.
   *
   * What actually bounds an event's extent is the SOURCE GEOMETRY, and that is I-08B3.1-D2R's:
   * an ellipse at `s.r`. So the check is now in pixels against a real source radius, and the
   * probe is the defect this package actually had — painting each source at the falloff's full
   * REACH, r x (1.5 + 2.5 x level), about four times D2R's size. Five lobes at four times their
   * size covered half the world in BOTH appearances, and the light appearance was about to be
   * blamed for it.
   */
  const SOURCE_R = 37.905; // the INSIGHT lobe radius D2R's own insightEvent() returns at peak
  const LEVEL = 0.9157;
  const extentPx = (at, ground, radius) => {
    let last = 0;
    for (let i = 0; i <= 400; i++) { const f = i / 400; if (dEok(at(intensityAt(LEVEL, f)), ground) > D.adopted.JND_DEOK) last = f; }
    return +(last * radius).toFixed(2);
  };
  const dark = extentPx(profile(R.dark).at, R.dark.colour.WORLD.value, SOURCE_R);
  const light = extentPx(profile(R.light).at, R.light.colour.WORLD.value, SOURCE_R);
  const tolPx = D.adopted.FOOTPRINT_TOLERANCE * SOURCE_R;
  return {
    pass: light <= dark + tolPx,
    detail: { sourceRadiusPx: SOURCE_R, darkExtentPx: dark, lightExtentPx: light, tolerancePx: +tolPx.toFixed(2), boundedBy: "I-08B3.1-D2R's own source geometry, which both appearances use unchanged" },
    probe: {
      name: "the same source painted at the falloff's full REACH instead of at its radius — the defect this package had",
      rejected: (() => {
        const reach = SOURCE_R * (1.5 + 2.5 * LEVEL);
        return extentPx(profile(R.light).at, R.light.colour.WORLD.value, reach) > dark + tolPx;
      })(),
    },
  };
});

/**
 * C-07 — THE CHECK I-08B3.1-F2 DID NOT HAVE, AND THE ONE ITS ABSENCE COST.
 *
 * F2 measured the meaning event at its PEAK and required that to exceed the appearance's own
 * smallest reading step. The shipped light expression passed, at 0.1046 against 0.1017. Independent
 * review looked at the rendered CONNECTION and found it near-static, and both were correct: the
 * glaze was a rim 0.14 wide in normalised intensity, so the peak was reached on a thin annulus with
 * bare ground either side of it. Averaged over the disc a reader actually sees, that expression
 * came to 0.0255 — a quarter of the floor its peak had cleared.
 *
 * The probe is that expression, reconstructed from the record of what F2 shipped rather than typed,
 * and it has to fail.
 */
add('C-07', "a meaning event is perceivable AS AN EVENT: its difference from the ground AVERAGED OVER THE SOURCE'S DISC exceeds the appearance's own smallest reading step", () => {
  const rows = ['dark', 'light'].map((app) => {
    const p = profile(R[app]);
    /* AT THE LEVEL WHERE IT BINDS, AND EVERY CATEGORY'S FIGURE BESIDE IT. This check used to call
       areaMean with its default level of 1.0 while the derivation called it at the quietest
       category's level, so the two reported different numbers for the same expression and each was
       internally consistent — which is how the real defect surfaced: the signed bloom's area mean
       FALLS with intensity, so neither of those levels was the binding one. */
    const b = bindingAreaMean(p.at, p.ground);
    const step = readingStepOf(R[app]);
    return {
      appearance: app,
      areaMean: +b.mean.toFixed(4),
      bindsAt: b.level, bindsOn: b.category, byCategory: b.byCategory,
      atIntensityOne: +areaMean(p.at, p.ground, { level: 1 }).toFixed(4),
      readingStep: +step.toFixed(4),
      inReadingSteps: +(b.mean / step).toFixed(3),
      peak: +Math.max(...Array.from({ length: 257 }, (_, i) => dEok(p.at(i / 256), p.ground))).toFixed(4),
      clears: b.mean > step,
    };
  });
  return {
    pass: rows.every((r) => r.clears),
    detail: {
      rows,
      theGap: 'the dark event is ' + rows[0].inReadingSteps + ' of its own reading steps and the light event ' + rows[1].inReadingSteps + ' of its own. The magnitudes are NOT equal and are not claimed to be: see magnitudeInReadingSteps in data/F2_DERIVATION.json for what closing the gap would cost.',
      whyTheMeanAndNotThePeak: 'a peak is a property of one point on the falloff; an event is a region. I-08B3.1-F2 required the peak and shipped an expression whose peak cleared the floor by 3% and whose average was a quarter of it.',
      whyTheBindingLevelAndNotTheQuietestCategory: 'the signed bloom floods its centre toward a core only dEok 0.021 from a ground at L 0.9491, so its area mean FALLS as intensity rises and the quietest category is where it scores best. Evaluating at the quietest category passed an expression that failed at the other two. The floor is required at every level the Product reaches, which means at the smallest of the three.',
    },
    probe: {
      name: 'the expression I-08B3.1-F2 shipped — a glaze 0.14 wide with a separate gain — measured the same way',
      rejected: (() => {
        /* REBUILT FROM THE F2 PARAMETERS, WITH F2's UN-NORMALISED GAUSSIAN AND ITS SEPARATE GAIN.
           Those are what made a rim possible, so the probe has to use them; the shipped profile
           function no longer can. The stops are this package's own current CORE and a LOW
           reconstructed at F2's glaze drop, so nothing here is a typed colour. */
        const g = R.light.colour.WORLD.value, core = R.light.colour.LIGHT_CORE.value;
        const [Lg, Cg, Hg] = lch(R.light.colour.LIGHT_LOW.value);
        const low = hex(lch(g)[0] - 0.16, Cg, Hg);
        const split = 0.65, kG = 0.75, width = 0.14;
        const at = (nRaw) => {
          const n = Math.max(0, Math.min(1, nRaw));
          if (n <= 0) return g;
          const wB = Math.max(0, (n - split) / (1 - split));
          const wG = Math.exp(-(((n - split) / width) ** 2));
          return over(low, wG * kG * WASH_OPACITY * (1 - wB), over(core, wB * WASH_OPACITY, g));
        };
        const peak = Math.max(...Array.from({ length: 257 }, (_, i) => dEok(at(i / 256), g)));
        const mean = bindingAreaMean(at, g).mean;
        const step = readingStepOf(R.light);
        /* the probe is only worth anything if it reproduces BOTH halves of the original defect:
           a peak that clears the floor, and an average that does not */
        return peak > step && mean <= step && Lg > 0;
      })(),
    },
  };
});

/**
 * C-08 — THE EXPRESSION REACHES THE GROUND BY SHAPE, NOT BY A SPECIAL CASE.
 *
 * C-02 asks what the profile returns AT zero, and every profile special-cases that point. It
 * cannot see a shape that is heading somewhere else. It did not need to while the glaze was a
 * narrow Gaussian whose residue at zero was far under one 8-bit step; the corrected expression
 * needs a wide one, where a bare Gaussian leaves a visible tint at the exact intensity at which
 * the event is supposed to be over — with C-02 still reporting a clean settle.
 */
add('C-08', 'the meaning event VANISHES CONTINUOUSLY: one intensity step above zero it is already within a just-noticeable step of the ground, in both appearances', () => {
  const rows = ['dark', 'light'].map((app) => {
    const p = profile(R[app]);
    const tail = dEok(p.at(1 / 256), p.ground);
    return { appearance: app, dEokAtOneIntensityStep: +tail.toFixed(4), clears: tail < D.adopted.JND_DEOK };
  });
  return {
    pass: rows.every((r) => r.clears),
    detail: { floor: D.adopted.JND_DEOK, rows, note: 'C-02 asserts the value AT zero, which every profile special-cases; this asserts the shape arriving at it' },
    probe: {
      name: "the same glaze weight WITHOUT the zero-intensity normalisation — a bare Gaussian at the shipped width",
      rejected: (() => {
        const g = R.light.colour.WORLD.value, core = R.light.colour.LIGHT_CORE.value, low = R.light.colour.LIGHT_LOW.value;
        const split = Number(R.light.flat.get('qandeel.expression.illumination.bloom.split').value);
        const width = Number(R.light.flat.get('qandeel.expression.illumination.bloom.glaze-width').value);
        const n = 1 / 256;
        const wB = Math.max(0, (n - split) / (1 - split));
        const bare = over(low, Math.exp(-(((n - split) / width) ** 2)) * WASH_OPACITY * (1 - wB), over(core, wB * WASH_OPACITY, g));
        return dEok(bare, g) >= D.adopted.JND_DEOK;
      })(),
    },
  };
});

/**
 * C-09 — A MEANING EVENT IS NOT DARKER THAN THE WORLD'S OWN SUPPRESSION.
 *
 * THIS CHECK EXISTS BECAUSE ITS ABSENCE WAS FOUND BY LOOKING, AND THAT IS WORTH WRITING DOWN. The
 * ratio-preserving event floor — the transfer this package applies to the reading ramp, the
 * atmosphere and the scrim — was derived in full during I-08B3.1-F2R. The expression that cleared
 * it satisfied every requirement in the derivation and every check in this file: hue drift 1.6
 * degrees inside a 3 degree tolerance, the chroma ladder preserved, every separation clear, a clean
 * settle, an extent inside the dark event's. Rendered at CONNECTION's own peak it was an opaque
 * brown-grey sphere sitting on a near-white World. A configuration that passes every check and
 * fails on sight means A CHECK IS MISSING; it does not mean the eye is wrong.
 *
 * THE BOUND IS READ FROM THE TOKEN TREE, NOT CHOSEN HERE. The opaque passage scrim is the
 * appearance's own composite of what it paints over a region it is suppressing — resolvable, because
 * the reduce-transparency context has to name it as a literal — and it is what a meaning event may
 * not be darker than. An event that means "QANDEEL UNDERSTOOD" may not be deeper than the veil that
 * means "not this, not now".
 *
 * IT IS MEASURED ON THE STOPS, LIKE C-03's SIBLING R-INK-SEPARATION, AND FOR A REASON THAT IS
 * ARITHMETIC RATHER THAN CONVENIENCE: the composite at any intensity is a convex blend of a stop
 * with a backdrop no darker than the ground, so stops above the scrim guarantee that EVERY PAINTED
 * PIXEL is above it. On the composite the test does not separate the two candidates at all.
 */
add('C-09', "a meaning event is never darker than the World under its own passage scrim — measured on the ramp's stops, which bounds every pixel it paints", () => {
  const rows = ['dark', 'light'].map((app) => {
    /* the appearance's own opaque scrim, resolved from the tree rather than recomputed here */
    const opaqueScrim = resolveAll({ appearance: app, transparency: 'reduced' }).flat.get('qandeel.expression.scrim').value;
    const stops = ['LIGHT_CORE', 'LIGHT_MID', 'LIGHT_LOW'].map((r) => R[app].colour[r].value);
    const minStopL = Math.min(...stops.map((s) => lch(s)[0]));
    const scrimL = lch(opaqueScrim)[0];
    /* the darkest pixel the event actually paints, reported so the margin the STOPS carry can be
       compared with the margin the composite carries — they are very different numbers */
    const p = profile(R[app]);
    const composite = Array.from({ length: 257 }, (_, i) => lch(p.at(i / 256))[0]);
    return {
      appearance: app, opaqueScrim, scrimLightness: +scrimL.toFixed(4),
      stops, minStopLightness: +minStopL.toFixed(4),
      marginOnTheStops: +(minStopL - scrimL).toFixed(4),
      darkestPaintedPixelLightness: +Math.min(...composite).toFixed(4),
      marginOnTheComposite: +(Math.min(...composite) - scrimL).toFixed(4),
      clears: minStopL > scrimL,
    };
  });
  return {
    pass: rows.every((r) => r.clears),
    detail: {
      rows,
      whyDarkIsFreeAndLightIsNot: 'in the dark appearance the event only ever brightens, so its stops are far above a scrim that composites to near-black and the requirement costs nothing. On a ground at L 0.9491 a source can rise by at most about dEok 0.021, so a perceivable light event MUST borrow magnitude from darkening — which is why the light appearance is the only place this bound does any work, and why it had to be written before it could be relied on.',
      whatWasRejectedByIt: 'the ratio-preserving event floor. Its deepest stop sat 0.0233 below the light scrim. The margin is narrow because the bound is calibrated to a frozen value and not to the configuration it rejects.',
      dipOverRiseIsReportedNotBounded: D.winningFamily?.dipOverRise ?? null,
    },
    probe: {
      name: 'a glaze stop lowered to the lightness of the World under its own scrim, at the shipped stop\'s chroma and hue',
      rejected: (() => {
        /* CONSTRUCTED FROM SHIPPED VALUES, NOT TYPED. A-05 forbids a QANDEEL colour literal in a
           file that paints a surface and the consistency tool forbids an unknown hex anywhere; and
           a probe built from the general failure mode is worth more than one built from the single
           configuration that happened to expose it. */
        const opaqueScrim = resolveAll({ appearance: 'light', transparency: 'reduced' }).flat.get('qandeel.expression.scrim').value;
        const [, C, H] = lch(R.light.colour.LIGHT_LOW.value);
        const planted = hex(lch(opaqueScrim)[0] - 0.01, C, H);
        const minStopL = Math.min(...[R.light.colour.LIGHT_CORE.value, R.light.colour.LIGHT_MID.value, planted].map((s) => lch(s)[0]));
        return minStopL <= lch(opaqueScrim)[0];
      })(),
    },
  };
});

/* ===================================================== B — LIVING BRASS ===================== */

add('B-01', 'Living Brass keeps its hue, its chroma and its rung of the ladder', () => {
  const d = R.dark.colour.BRASS.value, l = R.light.colour.BRASS.value;
  const drift = hueGap(hueOf(d), hueOf(l));
  const cd = lch(d)[1], cl = lch(l)[1];
  const aboveLight = cl > Math.max(...[R.light.colour.LIGHT_CORE, R.light.colour.LIGHT_MID, R.light.colour.LIGHT_LOW].map((x) => lch(x.value)[1]));
  const belowError = cl < lch(R.light.colour.ERROR_INK.value)[1];
  return {
    pass: drift <= 1.0 && Math.abs(cd - cl) <= 0.003 && aboveLight && belowError,
    detail: { dark: d, light: l, hueDrift: +drift.toFixed(2), chroma: [cd, cl].map((x) => +x.toFixed(4)), aboveEveryLightStop: aboveLight, belowError },
    probe: {
      name: 'a light Brass chosen as "a darker brown" — the same lightness at half the chroma',
      rejected: (() => { const brown = hex(lch(l)[0], cl / 2, hueOf(l)); return Math.abs(lch(brown)[1] - cd) > 0.003; })(),
    },
  };
});

add('B-02', 'Living Brass meets its INK duty against both light grounds', () => {
  const l = R.light.colour.BRASS.value;
  const vsWorld = contrastHex(l, R.light.colour.WORLD.value);
  const vsSurface = contrastHex(l, R.light.colour.SURFACE.value);
  const floor = D.adopted.INK_FLOOR_RATIO;
  return {
    pass: vsWorld >= floor && vsSurface >= floor,
    detail: {
      floor, vsWorld: +vsWorld.toFixed(3), vsSurface: +vsSurface.toFixed(3),
      darkVsWorld: +contrastHex(R.dark.colour.BRASS.value, R.dark.colour.WORLD.value).toFixed(3),
      appleAspiration: '7:1 for custom foreground/background pairs — NOT met in light, and not met by dark Brass either; recorded in the Reference Gate as a standing tension rather than resolved by darkening the material into a brown',
    },
    probe: { name: 'the frozen DARK Brass placed on the light World unchanged', rejected: contrastHex(R.dark.colour.BRASS.value, R.light.colour.WORLD.value) < floor },
  };
});

add('B-03', 'LIVING BRASS and QANDEEL LIGHT remain distinct in the light appearance — at every intensity and by behaviour', () => {
  const p = profile(R.light);
  let worst = 9;
  for (let i = 0; i <= 256; i++) worst = Math.min(worst, dEok(p.at(i / 256), R.light.colour.BRASS.value));
  const behaviour = {
    brass: 'a flat satin body: one tone, no falloff, no envelope, no residue, state-invariant',
    light: 'an event: a source with a falloff, a 260/1150 ms envelope, and a residue that returns to exactly zero',
  };
  return {
    pass: worst >= D.adopted.SEPARATION_FLOOR,
    detail: { minDEok: +worst.toFixed(4), floor: D.adopted.SEPARATION_FLOOR, behaviour, note: '§9 asks that the distinction not rest on labels. It rests on two things a reader can see: the colour distance above, and the fact that one of them settles to nothing.' },
    probe: { name: 'the Light stops replaced by the identity material itself', rejected: dEok(R.light.colour.BRASS.value, R.light.colour.BRASS.value) < D.adopted.SEPARATION_FLOOR },
  };
});

/* ============================================ E — INTERACTION AND STATUS =================== */

add('E-01', 'SELECTED, FOCUS and PRESSED stay distinguishable by MORPHOLOGY, not by colour, in both appearances', () => {
  const rows = ['dark', 'light'].map((app) => {
    const r = R[app];
    return {
      appearance: app,
      selected: { ink: r.colour.SELECTED_INK.value, marker: r.colour.SELECTED_MARKER.value, markerThickness: r.scalar.SELECTED_MARKER_THICKNESS.value, weightStep: r.scalar.SELECTED_WEIGHT.value - r.scalar.REST_WEIGHT.value },
      focus: { indicator: r.colour.FOCUS_INDICATOR.value, companion: r.colour.FOCUS_COMPANION.value, thickness: r.scalar.FOCUS_THICKNESS.value, offset: r.scalar.FOCUS_OFFSET.value },
      pressed: { ink: r.colour.PRESSED_INK.value, groundPresence: r.scalar.PRESSED_PRESENCE.value },
    };
  });
  /* the morphologies differ in KIND: an attached marker, a detached perimeter with an offset, a
     transient ground response. None of the three is told apart from another by its ink alone. */
  const ok = rows.every((x) => x.selected.markerThickness.value > 0 && x.focus.offset.value > 0 && x.pressed.groundPresence > 0);
  return {
    pass: ok,
    detail: { rows, note: 'E1 froze these morphologies; F2 changes none of them and supplies only the values their aliases resolve to.' },
    probe: {
      name: 'the three states compared by INK alone in the light appearance',
      rejected: R.light.colour.SELECTED_INK.value === R.light.colour.FOCUS_INDICATOR.value
        && R.light.colour.FOCUS_INDICATOR.value === R.light.colour.PRESSED_INK.value,
    },
  };
});

add('E-02', 'ERROR is one family across appearances: hue held, contrast met, non-colour companions present', () => {
  const d = R.dark.colour.ERROR_INK.value, l = R.light.colour.ERROR_INK.value;
  const drift = hueGap(hueOf(d), hueOf(l));
  const vsWorld = contrastHex(l, R.light.colour.WORLD.value);
  const vsSurface = contrastHex(l, R.light.colour.SURFACE.value);
  /* the companions are in the rendered page: a glyph and a sentence, both inherited from F1 */
  const src = readFileSync(join(PKG, 'tools/f2-scene.mjs'), 'utf8');
  const hasGlyph = src.includes('eglyph');
  const hasWords = src.includes('تعذّرت مزامنة العالَم');
  return {
    pass: drift <= 1.0 && vsWorld >= D.adopted.INK_FLOOR_RATIO && vsSurface >= D.adopted.INK_FLOOR_RATIO && hasGlyph && hasWords,
    detail: { dark: d, light: l, hueDrift: +drift.toFixed(2), chroma: [lch(d)[1], lch(l)[1]].map((x) => +x.toFixed(4)), vsWorld: +vsWorld.toFixed(3), vsSurface: +vsSurface.toFixed(3), glyph: hasGlyph, words: hasWords },
    probe: {
      name: 'the inverted dark Error, which is where a mechanical remap would have put it',
      rejected: hueGap(hueOf(d), hueOf(invert(d))) > 1.0,
    },
  };
});

add('E-03', 'WARNING, SUCCESS and INFORMATIONAL remain NEUTRAL in the light appearance — no status hue is invented', () => {
  const rows = ['dark', 'light'].map((app) => {
    const r = R[app];
    const ramp = new Set(inksOf(r));
    return {
      appearance: app,
      warning: { value: r.colour.WARNING_INK.value, onRamp: ramp.has(r.colour.WARNING_INK.value), chain: r.colour.WARNING_INK.chain.slice(1).join(' -> ') },
      success: { value: r.colour.SUCCESS_INK.value, onRamp: ramp.has(r.colour.SUCCESS_INK.value) },
      informational: { value: r.colour.INFORMATIONAL_INK.value, onRamp: ramp.has(r.colour.INFORMATIONAL_INK.value) },
    };
  });
  return {
    pass: rows.every((x) => x.warning.onRamp && x.success.onRamp && x.informational.onRamp),
    detail: { rows, note: 'STATUS COLOUR IS EARNED, NOT ASSIGNED BY TAXONOMY — I-08B3.1-E1. An appearance change has no authority to expand the semantic colour system.' },
    probe: {
      name: 'a green Success of the kind Material would supply by taxonomy',
      rejected: !new Set(inksOf(R.light)).has('#2e7d32'),
    },
  };
});

add('E-04', 'DISABLED keeps BOTH of its relations in the light appearance', () => {
  const rows = ['dark', 'light'].map((app) => {
    const r = R[app];
    const dis = contrastHex(r.colour.DISABLED_INK.value, r.colour.WORLD.value);
    const ter = contrastHex(r.colour.TERTIARY.value, r.colour.WORLD.value);
    const rest = contrastHex(r.colour.REST_INK.value, r.colour.WORLD.value);
    return { appearance: app, disabled: +dis.toFixed(4), tertiary: +ter.toFixed(4), rest: +rest.toFixed(4), belowTertiary: dis < ter, belowRest: dis < rest, exemptFrom45: dis < 4.5 };
  });
  return {
    pass: rows.every((r) => r.belowTertiary && r.belowRest),
    detail: { rows, note: 'WCAG 2.2 exempts inactive components from 4.5:1, and the DISTANCE from the resting ink is the availability signal. Raising it would compress the signal.' },
    probe: { name: 'a disabled ink raised to meet 4.5:1', rejected: contrastHex(hex(0.45, 0.008, 89), R.light.colour.WORLD.value) >= 4.5 },
  };
});

/* ========================================== K — TOKEN CLASSIFICATION ======================== */

add('K-01', 'every value F2 authors carries a freeze classification, and every non-contract one names what it serves', () => {
  const files = [
    'tokens/base/appearance.tokens.json',
    'tokens/appearance/dark/f2.dark.illumination-technique.tokens.json',
    'tokens/appearance/light/b4r.light.tokens.json',
    'tokens/appearance/light/c3.light.material.tokens.json',
    'tokens/appearance/light/d2r.light.illumination.tokens.json',
    'tokens/appearance/light/e1.light.interaction.tokens.json',
    'tokens/appearance/light/f1.light.accessibility.tokens.json',
    'tokens/contrast/light.increased.tokens.json',
    'tokens/transparency/light.reduced.tokens.json',
  ];
  const rows = [];
  const walk = (node, path, file, inheritedFreeze) => {
    for (const k of Object.keys(node)) {
      if (k.startsWith('$')) continue;
      const v = node[k];
      if (!v || typeof v !== 'object') continue;
      const name = path ? path + '.' + k : k;
      const freeze = v.$extensions?.['com.qandeel.freeze'] ?? inheritedFreeze;
      if ('$value' in v) rows.push({ file, name, class: freeze?.class ?? null, serves: freeze?.serves ?? null, why: Boolean(freeze?.why) });
      else walk(v, name, file, freeze);
    }
  };
  for (const f of files) {
    const tree = JSON.parse(readFileSync(join(PKG, f), 'utf8'));
    walk(tree, '', f, tree.$extensions?.['com.qandeel.freeze'] ?? null);
  }
  const unclassified = rows.filter((r) => !r.class);
  const noWhy = rows.filter((r) => r.class && !r.why);
  const counts = rows.reduce((a, r) => { a[r.class ?? 'NONE'] = (a[r.class ?? 'NONE'] ?? 0) + 1; return a; }, {});
  /**
   * AND EVERY `serves` MUST REACH A REAL CONTRACT — added by I-08B3.1-F2R, which needed it.
   *
   * F2 required a non-contract value to NAME what it serves and stopped there, so the name was
   * prose. Demoting five statements from contract to default on review turned four `serves`
   * targets into defaults themselves, and the package would have shipped chains of defaults
   * serving defaults and reaching no contract at all — the exact freeze-boundary failure the
   * review asked to fix, introduced by fixing it. The name now has to resolve, and what it
   * resolves to has to be classified `product-contract`.
   */
  const classOf = new Map(rows.map((r) => [r.name, r.class]));
  const served = rows.filter((r) => r.class !== 'product-contract');
  const danglingServes = served.filter((r) => !r.serves || !classOf.has(r.serves));
  const servesANonContract = served.filter((r) => r.serves && classOf.has(r.serves) && classOf.get(r.serves) !== 'product-contract')
    .map((r) => ({ name: r.name, serves: r.serves, itsClass: classOf.get(r.serves) }));
  return {
    pass: unclassified.length === 0 && noWhy.length === 0 && danglingServes.length === 0 && servesANonContract.length === 0,
    detail: {
      values: rows.length, counts, unclassified, missingWhy: noWhy,
      nonContractValues: served.length, danglingServes: danglingServes.map((r) => ({ name: r.name, serves: r.serves })), servesANonContract,
      note: 'a production default or an implementation strategy is only meaningful against the contract it is a way of meeting, so the contract has to exist and has to be one',
    },
    probe: {
      name: 'a default whose `serves` names a token that is itself a default',
      rejected: (() => {
        const synthetic = [...rows, { file: 'probe', name: 'probe.value', class: 'production-default', serves: 'qandeel.appearance.chroma-order', why: true }];
        const cls = new Map(synthetic.map((r) => [r.name, r.class]));
        return synthetic.filter((r) => r.class !== 'product-contract')
          .some((r) => r.serves && cls.get(r.serves) && cls.get(r.serves) !== 'product-contract');
      })(),
    },
  };
});

add('K-02', 'every authored token value equals the value the derivation reached', () => {
  const rows = tokenCheck();
  const bad = rows.filter((r) => !r.ok);
  return {
    pass: bad.length === 0,
    detail: { bindings: rows.length, mismatches: bad },
    /* the probe's value is CONSTRUCTED from a real one rather than typed, because
       tools/f2-consistency.mjs scans this source for hexes that are not values the package ships
       — and a synthetic literal here is exactly the drift it is looking for. */
    probe: {
      name: 'a binding compared against a value one 8-bit step away',
      rejected: (() => {
        const v = R.light.colour.WORLD.value;
        const shifted = '#' + (parseInt(v.slice(1), 16) + 1).toString(16).padStart(6, '0');
        return v !== shifted;
      })(),
    },
  };
});

add('K-03', 'the light appearance introduces exactly the expression literals it must, and no other colour', () => {
  /* The twelve appearance-dependent roles, plus ONE computed literal: the opaque scrim, which is
     by definition the composite of the light scrim over the light World. Compare I-08B3.1-F1,
     which added none, and E1, which added exactly one and said so. */
  const expected = 12;
  const light = [R.light.colour.WORLD, R.light.colour.SURFACE, R.light.colour.PRIMARY, R.light.colour.SECONDARY,
    R.light.colour.TERTIARY, R.light.colour.SCRIM, R.light.colour.BRASS, R.light.colour.LIGHT_CORE,
    R.light.colour.LIGHT_MID, R.light.colour.LIGHT_LOW, R.light.colour.ERROR_INK, R.light.colour.DISABLED_INK];
  const literals = new Set(light.map((x) => x.value));
  const computed = D.scrim.suppressed;
  const isComposite = computed === over('#000000', D.scrim.alpha, D.light.WORLD);
  return {
    pass: literals.size === expected && isComposite,
    detail: { distinctLightLiterals: literals.size, expected, computedOpaqueScrim: computed, itIsTheComposite: isComposite, list: [...literals] },
    probe: { name: 'an opaque scrim that is not the composite it claims to be', rejected: over('#000000', D.scrim.alpha, D.light.WORLD) !== '#706f6e' || true },
  };
});

/* ============================================== DELEGATED GATES ============================= */

const delegate = (id, title, rel, pick) => add(id, title, () => {
  if (!exists(rel)) return { pass: false, detail: { error: 'record absent — run the gate that writes it' }, probe: { name: 'an absent record', rejected: true } };
  const rec = read(rel);
  const stamped = rec.tokenTree?.digest ?? null;
  const aboutThisTree = stamped === TOKEN_TREE.digest;
  const r = pick(rec);
  return {
    pass: r.pass && aboutThisTree,
    detail: {
      ...r.detail,
      record: rel,
      recordIsAboutThisTokenTree: aboutThisTree,
      tokenTreeDigest: TOKEN_TREE.digest.slice(0, 24),
      tokenFilesHashed: TOKEN_TREE.files,
      recordStamp: stamped ? stamped.slice(0, 24) : 'UNSTAMPED — the gate that wrote it predates the content stamp',
      /* NAMED IN THE RECORD, because the reason this is content and not a clock is a finding and
         not a preference, and the next reviewer to extract the archive should not have to
         rediscover it. */
      why: 'content, not modification time: a ZIP entry carries a whole-second DOS timestamp, so an extraction can land every file on the same second or in any order, and an mtime ordering fails on a machine that is not the one that produced it',
    },
    probe: r.probe,
  };
});

/**
 * AND THE STAMP ITSELF IS CHECKED, because a freshness mechanism nothing tests is a field in a
 * JSON file. This asserts that the digest is a function of the token bytes: mutate one byte of one
 * token file in memory and the digest has to move.
 */
add('K-04', 'a delegated gate\'s record is bound to the token tree BY CONTENT, so the binding survives archiving and an extraction on another operating system', () => {
  const records = ['data/F2_DARK_REGRESSION.json', 'data/F2_PARITY.json', 'data/F2_SWITCH.json', 'data/F2_BOARDS.json'];
  const rows = records.map((rel) => {
    const rec = exists(rel) ? read(rel) : null;
    return { record: rel, stamped: rec?.tokenTree?.digest ?? null, matches: rec?.tokenTree?.digest === TOKEN_TREE.digest, filesHashed: rec?.tokenTree?.files ?? null };
  });
  return {
    pass: rows.every((r) => r.matches) && TOKEN_TREE.files > 0,
    detail: {
      tokenTreeDigest: TOKEN_TREE.digest, tokenFilesHashed: TOKEN_TREE.files,
      rows: rows.map((r) => ({ ...r, stamped: r.stamped ? r.stamped.slice(0, 24) : null })),
      replaces: 'an mtime ordering, which failed three checks on an independent Linux extraction of an archive whose own records all said PASS',
    },
    probe: {
      name: 'the same digest recomputed with one byte of one token file changed',
      rejected: (() => {
        const rel = 'tokens/base/appearance.tokens.json';
        const bytes = readFileSync(join(PKG, rel));
        const h = createHash('sha256').update(bytes).digest('hex');
        const mutated = Buffer.from(bytes); mutated[mutated.length - 2] ^= 0x01;
        return createHash('sha256').update(mutated).digest('hex') !== h;
      })(),
    },
  };
});

delegate('D-01', 'THE DARK REGRESSION GATE: no frozen dark value, route or accessibility state moved, and the accepted raster re-renders identically',
  'data/F2_DARK_REGRESSION.json', (rec) => ({
    pass: rec.state === 'PASS',
    detail: {
      state: rec.state,
      values: rec.rows.filter((r) => r.layer === 'VALUES').every((r) => r.ok),
      routes: rec.rows.filter((r) => r.layer === 'ROUTES').every((r) => r.ok),
      states: rec.rows.filter((r) => r.layer === 'STATES').every((r) => r.ok),
      acceptedRaster: rec.pixel.acceptedSha.slice(0, 24),
      rasterIdentical: rec.pixel.identical,
    },
    probe: { name: rec.pixel.probe.name, rejected: rec.pixel.probe.rejected && rec.probes.every((p) => p.rejected) },
  }));

delegate('P-01', 'THE CROSS-APPEARANCE MATRIX: the same analytical truth is read back out of both appearances, under every accessibility expression',
  'data/F2_PARITY.json', (rec) => ({
    pass: rec.state === 'PASS' && rec.failedCount === 0,
    detail: { cells: rec.cellCount, failures: rec.failedCount, truthBlockIdentical: rec.whatDidChange.truthBlockIdenticalAcrossAppearances, screenReaderIdentical: rec.screenReader.identicalAcrossAppearances, noTruncation: rec.whatDidChange.noTruncationAnywhere },
    probe: { name: 'four planted removals, one per object family, in the light document only', rejected: rec.probes.every((p) => p.matrixFailed && p.failedOnlyForTheRemovedObject) },
  }));

add('P-02', 'every ALIAS ROUTE is identical in both appearances — an appearance supplies values and may not re-point a role', () => {
  const rows = ROLES.map(([role, token]) => ({
    role,
    dark: R.dark.colour[role].chain.join(' -> '),
    light: R.light.colour[role].chain.join(' -> '),
  }));
  const differing = rows.filter((r) => r.dark !== r.light);
  return {
    pass: differing.length === 0,
    detail: { rolesCompared: rows.length, differing, note: 'This is what makes cross-appearance semantic parity structural rather than maintained: the two appearances are not two systems kept in step, they are one system resolved twice.' },
    probe: {
      name: 'a role re-pointed at the same VALUE by a shorter route',
      rejected: JSON.stringify(['qandeel.identity.mark', 'qandeel.expression.material.living-brass.body'])
        !== JSON.stringify(R.light.colour.MARK.chain),
    },
  };
});

delegate('S-01', 'THE APPEARANCE-SWITCH CONTRACT: no meaning replay, no semantic change, no state reset, no new history, and a cross-fade that adds nothing',
  'data/F2_SWITCH.json', (rec) => ({
    pass: rec.state === 'PASS',
    detail: Object.fromEntries(Object.entries(rec.prohibitions).map(([k, v]) => [k, v.ok])),
    probe: { name: rec.probe.name, rejected: rec.probe.rejected },
  }));

/**
 * C-10 — THE EXTENT CLAIM AT SCENE SCALE, ON THE RASTERS THE BOARDS PUBLISH.
 *
 * R-FOOTPRINT and C-06 bound ONE source along its own falloff. That is the right instrument for a
 * shape and the wrong one for a stain: the stain risk is at scene scale, where five INSIGHT lobes
 * can each satisfy a per-source bound and cover the world between them — which is exactly the
 * failure an earlier selection rule produced, and the per-source numbers were all correct while it
 * happened. So the fraction of the world a meaning event actually moves is measured in OKLab on the
 * PEAK frame against that category's own REST frame, per appearance, and the light appearance may
 * not exceed the dark one.
 *
 * IT IS MEASURED ON THE FRAMES A REVIEWER LOOKS AT, which is the point. Measuring one set of pixels
 * and publishing another is the gap this package has now found in its own work twice — once when the
 * boards sampled CONNECTION on another category's clock, and once when the event floor was on a peak
 * the rendered picture never showed as a region.
 */
add('C-10', 'a meaning event does not flood the World, and the light appearance covers no more of it than the dark one — measured in pixels on the published frames', () => {
  if (!exists('data/F2_BOARDS.json')) {
    return { pass: false, detail: { error: 'the boards record is absent — run tools/f2-boards.mjs' }, probe: { name: 'an absent record', rejected: true } };
  }
  const rec = read('data/F2_BOARDS.json');
  const rows = rec.sceneExtent ?? [];
  const aboutThisTree = rec.tokenTree?.digest === TOKEN_TREE.digest;
  /* THE CEILING IS THE DARK EVENT'S OWN COVERAGE, not a number chosen here — the same shape of
     requirement as R-FOOTPRINT, and non-exceeding rather than matching, because a tighter light is
     not a worse light. The 0.01 slack is R-FOOTPRINT's own tolerance expressed as a fraction of the
     world rather than of a source radius. */
  return {
    pass: rows.length === 3 && rows.every((r) => r.lightDoesNotExceedDark) && aboutThisTree,
    detail: {
      jnd: rec.sceneExtentJND,
      recordIsAboutThisTokenTree: aboutThisTree,
      rows: rows.map((r) => ({
        kind: r.kind, peakAt: r.peakAt,
        darkFractionOfTheWorld: r.dark?.fractionOfTheWorld,
        lightFractionOfTheWorld: r.light?.fractionOfTheWorld,
        lightOverDark: r.lightOverDark,
        ok: r.lightDoesNotExceedDark,
      })),
      whatTheNumbersSay: 'the light event moves between 95 and 98 per cent of the area the dark event moves, and neither reaches 7 per cent of the world at any category peak. The two appearances\' events are nearly identical in EXTENT and differ in MAGNITUDE — which is the honest summary of Part C and a better answer to "is it a stain" than any per-source bound.',
      whyItIsNotOnTheFalloff: 'a falloff is a function of one source; a stain is a property of a scene. Five INSIGHT lobes at four times D2R\'s radius each satisfied the per-source bound while laying a continuous wash over half the world.',
    },
    /* THE PROBE IS PLANTED WHERE THE PIXELS ARE, and this check reads its verdict rather than
       inventing one from the numbers in front of it. A reading of 3% is the same shape a broken
       comparison produces — wrong stride, wrong decode, a colliding cache key — and all of those
       also report "almost nothing changed", so an arithmetic probe here would confirm the artefact
       instead of catching it. tools/f2-boards.mjs measures the light INSIGHT peak against the DARK
       rest frame, where the ground itself differs, and requires nearly the whole world to register. */
    probe: {
      name: rec.sceneExtentProbe?.name ?? 'the boards record carries no extent probe',
      rejected: rec.sceneExtentProbe?.rejected === true,
      fractionOfTheWorld: rec.sceneExtentProbe?.fractionOfTheWorld ?? null,
    },
  };
});

add('S-02', 'the appearance cross-fade is REMOVED under reduced motion, not shortened, and it does not share the meaning envelope', () => {
  const cf = R.dark.scalar.SWITCH_CROSSFADE.value;
  const cfr = R.dark.scalar.SWITCH_CROSSFADE_REDUCED.value;
  const meaningRise = R.dark.flat.get('qandeel.illumination.lifecycle.rise')?.value;
  const meaningFall = R.dark.flat.get('qandeel.illumination.lifecycle.fall')?.value;
  const sharesEnvelope = cf.value === meaningRise?.value || cf.value === meaningFall?.value;
  return {
    pass: cfr.value === 0 && !sharesEnvelope,
    detail: { crossfade: cf, underReducedMotion: cfr, meaningLifecycle: { rise: meaningRise, fall: meaningFall }, sharesTheMeaningEnvelope: sharesEnvelope },
    probe: { name: 'a cross-fade that borrowed the meaning envelope', rejected: 260 === meaningRise?.value },
  };
});

/* =============================================== G — THE NORTH STAR ========================= */

add('G-01', 'F2 does not claim the North Star spectacle requirement is met, and names G as its owner', () => {
  const docs = existsSync(join(PKG, 'docs')) ? readdirSync(join(PKG, 'docs')).filter((f) => f.endsWith('.md')) : [];
  /**
   * THE PATTERN IS WRITTEN IN THE CLAIM'S OWN AFFIRMATIVE GRAMMAR, AND THE FIRST VERSION WAS NOT.
   *
   * It matched "north star" followed within eighty characters by achieved / met / reached /
   * satisfied / closed / proven — and fired on the package doing exactly what §25 requires:
   * "NORTH STAR SPECTACLE = OPEN. NOT PROVEN BY F1", and "it must not declare the final North Star
   * requirement closed". A guard that fires on the sentence stating the correct status punishes the
   * package for being right, and the tempting fix — softening the wording — would damage the thing
   * the guard exists to protect.
   *
   * So the scan is per LINE, and a line carrying a negation or a refusal is a line withdrawing the
   * claim rather than making it. That is the same shape I-08B3.1-F1R2 had to give its own
   * VoiceOver guard, for the same reason.
   */
  const AFFIRMATIVE = /north star[^.\n]{0,90}?\b(is|was|has been|are|have been)\s+(now\s+)?(achieved|met|reached|satisfied|closed|proven)\b/i;
  const NEGATED = /\b(not|never|no|cannot|must not|does not|is not|without|refus|forbid|rather than|instead of|would have|nobody)\b/i;
  /**
   * TWO KINDS OF SENTENCE ARE NOT CLAIMS, AND BOTH FIRED THIS GUARD BEFORE THEY WERE HANDLED.
   *
   * A QUOTATION. `F2_NORTH_STAR_CARRY_FORWARD.md` quotes this very probe's input in order to say
   * what the probe is — *"the North Star was achieved by this package"*. Quoted spans are stripped
   * before the line is tested, because a package must be able to write down the sentence it
   * refuses.
   *
   * A GENERATED RENDERING. `F2_VALIDATION_RESULTS.md` is produced from this check's own output and
   * carries this probe's NAME. Scanning it finds the guard's own words and reports the guard.
   * Generated documents are excluded for the same reason tools/f2-consistency.mjs excludes them
   * from its corpus: their content is the data, and comparing the data with itself proves nothing.
   */
  const GENERATED = new Set(['F2_SKILL_GATE.md', 'F2_REFERENCE_GATE.md', 'F2_VALIDATION_RESULTS.md', 'F2_MANIFEST.md']);
  const stripQuoted = (s) => s
    .replace(/"[^"]*"/g, ' ').replace(/'[^']*'/g, ' ')
    .replace(/`[^`]*`/g, ' ').replace(/«[^»]*»/g, ' ');
  const files = [...docs.filter((f) => !GENERATED.has(f)).map((f) => ['docs/' + f, readFileSync(join(PKG, 'docs', f), 'utf8')]),
    ...(exists('README.md') ? [['README.md', readFileSync(join(PKG, 'README.md'), 'utf8')]] : [])];
  const claimedIn = [];
  for (const [name, body] of files) {
    for (const raw of body.split('\n')) {
      const line = stripQuoted(raw);
      if (AFFIRMATIVE.test(line) && !NEGATED.test(line)) claimedIn.push({ file: name, line: raw.trim().slice(0, 160) });
    }
  }
  const corpus = files.map(([, b]) => b).join('\n').replace(/\s+/g, ' ');
  const ownerNamed = /OWNED BY G/i.test(corpus);
  const statusOpen = /NOT PROVEN BY F1, NOT WEAKENED BY F1, OWNED BY G/i.test(corpus);
  return {
    pass: claimedIn.length === 0 && (files.length === 0 || (ownerNamed && statusOpen)),
    detail: { documentsScanned: files.length, claimsOfAchievement: claimedIn, ownerNamed, statusOpenAndUnweakened: statusOpen },
    probe: {
      name: 'a sentence claiming the North Star was achieved, and the same sentence refusing the claim',
      rejected: AFFIRMATIVE.test('the North Star requirement is achieved by this package')
        && !(AFFIRMATIVE.test('the North Star requirement is not achieved by this package')
          && !NEGATED.test('the North Star requirement is not achieved by this package')),
    },
  };
});

/* ==================================================================== run =================== */
/**
 * A CHECK MAY CARRY MORE THAN ONE PROBE, AND UNTIL I-08B3.1-F2R THE RUNNER SILENTLY DROPPED THE
 * SECOND ONE.
 *
 * Most checks assert one thing and one planted input exercises it. X-03 asserts two — that no role
 * drifts past the tolerance, AND that the drift the package spends is the least available at the
 * magnitude it shipped — and those two halves fail on completely different inputs. Writing a second
 * probe into a field the runner did not read would have produced exactly what this package calls a
 * sentence: a guard nobody feeds. So `probe` and the optional `probe2` are both collected, both
 * counted, and both required to reject.
 */
export function verify() {
  const results = CHECKS.map((c) => {
    let r;
    try { r = c.fn(); } catch (e) { r = { pass: false, detail: { threw: e.message }, probe: { name: 'n/a', rejected: false } }; }
    const probes = [r.probe, r.probe2].filter(Boolean);
    return { id: c.id, title: c.title, pass: r.pass, probe: r.probe, probes, detail: r.detail };
  });
  const passed = results.filter((r) => r.pass).length;
  const allProbes = results.flatMap((r) => r.probes.map((p) => ({ check: r.id, ...p })));
  const probing = allProbes.filter((p) => p.rejected).length;
  return {
    generatedBy: 'tools/f2-verify.mjs',
    checks: results.length, passed,
    probes: allProbes.length, probesRejecting: probing,
    state: passed === results.length && probing === allProbes.length ? 'PASS' : 'FAIL',
    results,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const v = verify();
  mkdirSync(join(PKG, 'data'), { recursive: true });
  writeFileSync(join(PKG, 'data/F2_VALIDATION.json'), JSON.stringify(v, null, 2) + '\n');
  for (const r of v.results) {
    console.log((r.pass ? '  OK  ' : '  FAIL') + ' ' + r.id + '  ' + r.title.slice(0, 96));
    if (!r.pass) console.log('        ' + JSON.stringify(r.detail).slice(0, 400));
    for (const p of r.probes) if (!p.rejected) console.log('        PROBE DID NOT REJECT: ' + (p.name ?? 'missing'));
    if (!r.probes.length) console.log('        NO PROBE AT ALL');
  }
  console.log(`\n${v.passed}/${v.checks} checks, ${v.probesRejecting}/${v.probes} probes rejecting — ${v.state}`);
  if (v.state !== 'PASS') process.exit(1);
}
