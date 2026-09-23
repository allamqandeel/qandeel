/**
 * I-08B3.1-A3 - the machine-readable record.
 *
 * Writes docs/A3_MEASUREMENTS.csv (one row per measured colour, flat, for a spreadsheet) and
 * docs/A3_MEASUREMENTS.json (the same data plus the structures the CSV cannot express: the
 * ramp step table, the render conditions, the fairness fingerprints, the blind mapping).
 *
 * Nothing in A3_FINDINGS.md is quoted that is not in here. Every rendered value is the value
 * recovered from the QUANTISED hex, because that is what a screen shows and what WCAG is
 * defined over - the authored OKLCH triple is carried alongside so the gap stays visible.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PKG } from './a3-ui.mjs';
import {
  WORLD, SECONDARY, TERTIARY, CONTROL, P1, P2, FINALISTS, CANDIDATES,
  ROLES, oklchOf, diagSubtle, probeSwatches, derivedFinalists, DIAG_SUBTLE_DELTA_L, PROBE_L,
} from './a3-model.mjs';
import { varsFor, diagEdge } from './a3-vars.mjs';
import { contrastHex, resolve } from './color.mjs';
import { checkFairness } from './a3-fairness.mjs';
import { BLIND_MAP } from './a3-boards.mjs';
import { DESKTOP, MOBILE, METADATA_WEIGHT, FORBIDDEN_COUNT } from './a3-env.mjs';
import { COND_A2, COND_MOBILE, CONSTANT_FLAGS } from './a3-render.mjs';

const n = (v, d = 4) => (v === null || v === undefined || Number.isNaN(v) ? '' : Number(v).toFixed(d));
const SUB = diagSubtle().hex;

const COLS = ['group', 'label', 'hex', 'authored_L', 'authored_C', 'authored_H',
  'rendered_L', 'rendered_C', 'rendered_H', 'drift_L', 'drift_C', 'drift_H', 'in_srgb_gamut',
  'gamut_clipped', 'vs_world_base', 'vs_diagnostic_subtle', 'worst_case', 'wcag_role',
  'wcag_floor', 'wcag_pass', 'apple_dark_7to1', 'lightness_above', 'context'];

/**
 * WCAG classification, in CSS units throughout.
 *
 * 1 pt = 1.333 px is the CSS typographic relationship, so a role's size in CSS px becomes its
 * size in CSS pt. WCAG 2.2 defines large scale as 18 pt or 14 pt bold; none of the frozen
 * QANDEEL roles below 24 CSS px qualifies, so Metadata at 12 CSS px (= 9 CSS pt) is ORDINARY
 * text and owes 4.5:1, not 3:1.
 *
 * DO NOT READ A CSS PT AS A NATIVE iOS POINT. They are different unit systems and a browser
 * proof establishes no parity between them. Apple's 11 pt platform minimum is a NATIVE point
 * and cannot be checked from a raster made here; it is relevant future guidance for the native
 * build. This is the A2R correction, carried forward deliberately. See A3_FINDINGS.
 */
function wcagFor(role) {
  const cssPt = role.size * 0.75;            // CSS px -> CSS pt (1pt = 1.333px). NOT native pt.
  const large = cssPt >= 18 || (cssPt >= 14 && role.weight >= 700);
  return { role: large ? 'large' : 'normal', floor: large ? 3.0 : 4.5, cssPt };
}

const ROLE_OF = {
  primary: ROLES.body,
  secondary: ROLES.supporting,
  tertiary: { ...ROLES.metadata, weight: METADATA_WEIGHT },
};

function rows() {
  const out = [];
  const push2 = (group, label, r, extra = {}) => out.push({
    group, label, hex: r.hex,
    authored_L: n(r.authored.L), authored_C: n(r.authored.C), authored_H: n(r.authored.H, 1),
    rendered_L: n(r.actual.L), rendered_C: n(r.actual.C), rendered_H: n(r.actual.H, 1),
    drift_L: n(r.drift.L), drift_C: n(r.drift.C), drift_H: n(r.drift.H, 2),
    in_srgb_gamut: r.inGamut, gamut_clipped: r.clipped,
    vs_world_base: n(contrastHex(r.hex, WORLD), 3),
    vs_diagnostic_subtle: n(contrastHex(r.hex, SUB), 3),
    worst_case: n(Math.min(contrastHex(r.hex, WORLD), contrastHex(r.hex, SUB)), 3),
    lightness_above: n(1 - r.actual.L),
    ...extra,
  });

  /* ---- the surfaces ---- */
  push2('world', 'World Base (sole incumbent, preserved)', resolve(oklchOf(WORLD), 'world'), {
    context: 'A3 preserves #101010 and does not search for another World value. NOT canonical.',
  });
  push2('surface-diagnostic', `Diagnostic Subtle, World + dL ${DIAG_SUBTLE_DELTA_L}`, diagSubtle(), {
    context: 'NON-CANONICAL proof scaffolding carried from A2 so a reading value can be judged on ' +
      'two surfaces. No Subtle ladder is being designed and no surface hierarchy is being decided.',
  });
  push2('non-text-diagnostic', 'Analysis Map edge, solved to WCAG 1.4.11 3:1', diagEdge(), {
    wcag_role: 'non-text', wcag_floor: '3.0',
    wcag_pass: Math.min(contrastHex(diagEdge().hex, WORLD), contrastHex(diagEdge().hex, SUB)) >= 3,
    context: 'NON-CANONICAL diagnostic carried from A2, solved against the Subtle because that is ' +
      'the lighter of the two surfaces a mark can land on. Not promoted into a token by A3.',
  });

  /* ---- the reading ramp, per candidate ---- */
  for (const c of CANDIDATES) {
    const w = wcagFor(ROLE_OF.primary);
    const worst = Math.min(contrastHex(c.hex, WORLD), contrastHex(c.hex, SUB));
    push2(c.key === 'C' ? 'control' : 'finalist', `${c.name} - Primary Reading Neutral`, resolve(oklchOf(c.hex), c.key), {
      wcag_role: w.role, wcag_floor: n(w.floor, 1), wcag_pass: worst >= w.floor,
      apple_dark_7to1: worst >= 7,
      context: c.key === 'C'
        ? `A1 Primary. CONTROL ONLY - on the boards to show what was gained and lost, NOT a third finalist. ` +
          `${ROLE_OF.primary.label} ${ROLE_OF.primary.size}/${ROLE_OF.primary.leading}/${ROLE_OF.primary.weight}.`
        : `FINALIST. A1 Primary lowered by OKLCH L -${c.drop} with chroma and hue held. ` +
          `${ROLE_OF.primary.label} ${ROLE_OF.primary.size}/${ROLE_OF.primary.leading}/${ROLE_OF.primary.weight}. ` +
          `A3 does not choose between the finalists.`,
    });
  }
  for (const [k, hex, label] of [['secondary', SECONDARY, 'Secondary'], ['tertiary', TERTIARY, 'Tertiary']]) {
    const role = ROLE_OF[k];
    const w = wcagFor(role);
    const worst = Math.min(contrastHex(hex, WORLD), contrastHex(hex, SUB));
    push2('reading-unchanged', `${label} (unchanged, not under test)`, resolve(oklchOf(hex), k), {
      wcag_role: w.role, wcag_floor: n(w.floor, 1), wcag_pass: worst >= w.floor,
      apple_dark_7to1: worst >= 7,
      context: `${role.label} ${role.size}/${role.leading}/${role.weight} (= ${n(w.cssPt, 2)} CSS pt, NOT a native iOS pt). ` +
        `Worst case across both surfaces is ${n(worst, 3)}:1.` +
        (worst < 7 ? ' BELOW the 7:1 Apple asks of custom colours in Dark Mode, especially in small text - see A3_FAILURES.' : ''),
    });
  }

  /* ---- the achromatic diagnostic probe ---- */
  probeSwatches().forEach((p) => push2('diagnostic-probe', `achromatic probe L ${p.authored.L.toFixed(2)}`, p, {
    context: 'NON-CANONICAL DIAGNOSTIC ONLY - not QANDEEL Light, not a proposal for it, chroma exactly 0, ' +
      'no hue, no glow, no gradient. Its entitlement stops at the solid fill it actually renders: it says ' +
      'nothing about levels for text, nothing about small marks, and nothing about a token ladder.',
  }));
  return out;
}

/** The three-level content ramp, per candidate, as OKLCH lightness steps. */
function rampTable() {
  const L = (h) => oklchOf(h)[0];
  return CANDIDATES.map((c) => {
    const s1 = L(c.hex) - L(SECONDARY);
    const s2 = L(SECONDARY) - L(TERTIARY);
    return {
      candidate: c.key, isFinalist: c.key !== 'C', primary: c.hex,
      primaryToSecondary_dL: Number(s1.toFixed(4)),
      secondaryToTertiary_dL: Number(s2.toFixed(4)),
      stepRatio: Number((s1 / s2).toFixed(4)),
      note: 'stepRatio 1.000 would be a perfectly even three-level ramp. A number is not a decision; ' +
        'see HIERARCHY_RAMP.png for what the raster shows.',
      primary_vs_secondary_contrast: Number((contrastHex(c.hex, WORLD) / contrastHex(SECONDARY, WORLD)).toFixed(4)),
      lightnessAbovePrimary: Number((1 - L(c.hex)).toFixed(4)),
    };
  });
}

const csvCell = (v) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function writeMeasurements() {
  const data = rows();
  const csv = [COLS.join(','), ...data.map((r) => COLS.map((c) => csvCell(r[c])).join(','))].join('\n') + '\n';
  writeFileSync(join(PKG, 'docs', 'A3_MEASUREMENTS.csv'), csv, 'utf8');

  const json = {
    task: 'I-08B3.1-A3',
    generated: new Date().toISOString().slice(0, 10),
    nothingIsFrozen: 'Every value in this file is an incumbent, a candidate, a control or a diagnostic. ' +
      'No Product colour is declared canonical, no finalist is selected, and nothing is frozen.',
    evidenceClass: 'CONTROLLED BROWSER RENDERS under two raster conditions. There are no participants and ' +
      'no perceptual measurement. This package can say what did and did not separate ON THESE BOARDS, ' +
      'UNDER THESE CONDITIONS. It is not a psychophysical study and it is not native platform validation.',
    decision: {
      madeByThisPackage: 'none',
      forTheDesignDirector: 'which of P1 and P2 closes B3.1-A, and whether #101010 is confirmed',
      worldBase: { hex: WORLD, status: 'sole incumbent, preserved by A3, NOT canonical' },
      control: { hex: CONTROL.hex, status: 'A1 Primary, reference only, NOT a third finalist' },
      finalists: FINALISTS.map((p) => ({ key: p.key, hex: p.hex, drop: p.drop })),
      retired: { thesisB: 'retired as challenger after A2R', thesisC: 'remains retired' },
    },
    derivedFinalistCheck: derivedFinalists().map((d) => ({
      key: d.key, briefHex: d.hex, regeneratedHex: d.derived.hex, matches: d.derived.hex === d.hex,
      method: `OKLCH lightness of the control minus ${d.drop}, chroma and hue held, validated against the rendered sRGB`,
    })),
    typography: {
      frozen: 'Estedad v8.5, I-08B3.0 roles, zero Arabic tracking. NOT reopened by A3.',
      metadataWeightInProduct: METADATA_WEIGHT,
      metadataRole: '12/20/400-500',
      why: 'Weight 500 is already inside the frozen role. A2 found 400 visually fragile at true size; ' +
        'A3 uses 500 in the Product proofs and keeps 400 as a control. No size, leading or tracking ' +
        'changed, and the Tertiary colour was NOT raised to compensate.',
      unitNote: '12 CSS px = 9 CSS pt (1 pt = 1.333 px) -> WCAG ordinary text, 4.5:1. Apple\'s 11 pt iOS ' +
        'minimum is a NATIVE platform point and this browser proof establishes no parity with it.',
    },
    render: {
      conditions: [
        { ...COND_A2, boardCanvasCssPx: COND_A2.viewport, rasterWidthPx: COND_A2.viewport * COND_A2.dpr,
          productFrameCssPx: DESKTOP.frameW, readingMeasureCssPx: DESKTOP.measure, navStripCssPx: DESKTOP.navH },
        { ...COND_MOBILE, productFrameCssPx: MOBILE.frameW, readingMeasureCssPx: MOBILE.measure, navStripCssPx: MOBILE.navH,
          windowNote: 'the window is 780 CSS px because Chrome on Windows refuses one below ~500; the product ' +
            'frame is a fixed 390 CSS px and is cut from the raster by its own reported box',
          measureNote: 'the 350 px measure is below the frozen 520-600 comfort zone because a phone does not ' +
            'have 560 px to give. This condition is a RASTER robustness check, not a reading-measure proof.' },
      ],
      constantAcrossConditions: CONSTANT_FLAGS,
      colourProfile: 'srgb forced on both the measure pass and the screenshot pass',
      antialiasing: 'greyscale forced (--disable-lcd-text, --disable-font-subpixel-positioning)',
      font: 'Estedad v8.5, embedded base64, sha256 3134e31a27d58e615967e714c7799fbfa2de952876f8597b33dc57ffe0e99d03',
      antiGenericRefusalPatterns: FORBIDDEN_COUNT,
      gamut: 'every colour in this package is inside the sRGB gamut, so no CSS gamut-mapping algorithm is ' +
        'ever invoked - which matters because the current CSS Color 4 draft names three and lets an ' +
        'implementation choose between them',
    },
    fairness: {
      contract: 'ONE shared implementation. A candidate contributes exactly one CSS custom property, --ink-1. ' +
        'Five of the six values reaching the template are identical in every render in this package.',
      ...checkFairness(),
    },
    blindMapping: { note: 'appears nowhere in BLIND_READING_X_Y.png', ...BLIND_MAP },
    probeLightnesses: PROBE_L,
    readingRamp: rampTable(),
    colours: data,
  };
  writeFileSync(join(PKG, 'docs', 'A3_MEASUREMENTS.json'), JSON.stringify(json, null, 2), 'utf8');
  return { rows: data.length, json };
}

if (process.argv[1] && process.argv[1].endsWith('a3-measure.mjs')) {
  const { rows: k, json } = writeMeasurements();
  console.log(`A3_MEASUREMENTS.csv  ${k} rows`);
  console.log('A3_MEASUREMENTS.json written');
  for (const r of json.readingRamp) {
    console.log(`  ${r.candidate.padEnd(3)} ${r.primary}  P->S ${r.primaryToSecondary_dL}  S->T ${r.secondaryToTertiary_dL}` +
      `  ratio ${r.stepRatio}  headroom ${r.lightnessAbovePrimary}`);
  }
}
