/**
 * I-08B3.1-B4.4 - SCRIM PRODUCTION VERIFICATION, and B4.12 - FINAL INTEGRATION CHECK.
 *
 * ---------------------------------------------------------------------------------------------
 * THE ONE QUESTION B4.12 ASKS, AND THE ONLY HONEST WAY TO ANSWER IT
 * ---------------------------------------------------------------------------------------------
 *
 * "Verify that the production token file reproduces the accepted B3 appearance."
 *
 * Comparing hexes would not do it. A token file can carry every correct value and still paint the
 * wrong screen, because what a role is painted with is decided by the ALIAS CHAIN, and an alias
 * chain that points somewhere unintended still resolves to a colour. So each accepted composition is
 * rendered TWICE through the SEALED B3R product stylesheet:
 *
 *   model   every custom property at the value the accepted package used
 *   token   every canonical custom property RESOLVED FROM `tokens/qandeel-surface.tokens.json`,
 *           each Product role taking its own value through its own chain
 *
 * and the two rasters must be byte-identical. If `role.aside.fill` pointed at the wrong token, the
 * ASIDE would change colour and the comparison would fail. Nothing about the token file is trusted:
 * it is read off disk as JSON and asked to paint.
 *
 * THE DIAGNOSTIC PROPERTIES ARE DELIBERATELY NOT SUPPLIED BY THE TOKEN FILE. The Class S edge, the
 * focus ring, the radius and the shadow keep their B3 diagnostic values in BOTH variants, because
 * B4 has no authority to freeze any of them. That split is `B4_PROOF_TO_PRODUCTION_MAP.md` in
 * executable form: what B4 freezes, the token file supplies; what B4 defers, it does not have.
 *
 * ---------------------------------------------------------------------------------------------
 * AND B4.4 IS NOT A SEARCH
 * ---------------------------------------------------------------------------------------------
 *
 * One scrim value is verified: the selected 0.50, read out of the token file. The measurements are
 * made against PREDICTIONS computed before the render - if a neutral black at alpha 0.50 composites
 * over the World, the World's fill MUST land on the value alpha compositing says it lands on. A
 * measurement with no prediction in front of it can only ever agree with itself.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { load, toCss, srgbHex, alphaOf } from './b4-dtcg.mjs';
import { TOKENS_DIR, PKG, WORK } from './b4-tokens.mjs';
import { render, px, dominant, COND_FRAME } from './b4-render.mjs';
import {
  envWork, envMap, barePage, FRAME, DEFAULT_VARS, varBlock,
} from '../../I-08B3.1-B3R-OVERLAY-SEMANTICS-FOCUS-LIFECYCLE-VERIFICATION/tools/b3-ui.mjs';
import { composite, WORLD, SURFACE, PRIMARY } from '../../I-08B3.1-B3R-OVERLAY-SEMANTICS-FOCUS-LIFECYCLE-VERIFICATION/tools/b3-model.mjs';
import { contrastHex, hexToRgb8 } from '../../I-08B3.1-B3R-OVERLAY-SEMANTICS-FOCUS-LIFECYCLE-VERIFICATION/tools/color.mjs';

const REVIEW = join(PKG, 'review', 'integration');
const sha = (b) => createHash('sha256').update(b).digest('hex').toUpperCase();
const hex = (rgb) => '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');

/* -------------------------------------------------------- the token -> CSS bridge ----- */

/**
 * Every canonical custom property, taken from its OWN token through its OWN chain.
 *
 * The four role fills are read separately on purpose. Writing `--s-aside: var(--surface)` - which is
 * what the accepted package does - would make the comparison pass no matter where the role aliases
 * pointed, because the role tokens would never be consulted. Reading each role's own chain is what
 * turns this render into a test of the architecture rather than a test of one hex.
 */
export function tokenVars(doc) {
  const { resolved } = load(doc, { file: 'qandeel-surface.tokens.json' });
  const v = (key) => {
    const r = resolved.get(key);
    if (!r || r.state !== 'RESOLVED') throw new Error(`b4-integration: \`${key}\` is missing or unresolved`);
    return toCss(r.resolved);
  };
  return {
    '--world': v('qandeel.world.fill'),
    '--surface': v('qandeel.surface.functional'),
    '--s-apparatus': v('qandeel.role.apparatus.fill'),
    '--s-aside': v('qandeel.role.aside.fill'),
    '--s-passage': v('qandeel.role.passage.fill'),
    '--s-field': v('qandeel.role.field.fill'),
    /* Submenu furniture and a nested ASIDE are the SAME material as the ASIDE that owns them - the
       frozen "submenu is furniture, not a second layer" rule, expressed by giving them no token of
       their own and pointing them at the role that raised them. */
    '--s-sub': v('qandeel.role.aside.fill'),
    '--s-nested': v('qandeel.role.aside.fill'),
    '--ink-1': v('qandeel.content.primary'),
    '--ink-2': v('qandeel.content.secondary'),
    '--ink-3': v('qandeel.content.tertiary'),
    '--scrim': v('qandeel.role.passage.scrim'),
  };
}

/* ------------------------------------------------------------------- the cases -------- */

/**
 * ALREADY-ACCEPTED COMPOSITIONS. No new board set, no new creative decision - these are B3
 * environments called with B3 options. `world-live` and `passage` share one base composition so that
 * the scrim can be measured as the ONLY difference between two rasters.
 */
export const CASES = [
  { key: 'apparatus', env: envWork, w: FRAME.work.w, on: { utilRow: true }, what: 'APPARATUS - standing machinery beside a live World' },
  { key: 'aside', env: envWork, w: FRAME.work.w, on: { aside: 'menu' }, what: 'ASIDE - anchored, nonmodal, no scrim' },
  { key: 'field', env: envWork, w: FRAME.work.w, on: { field: 'draft' }, what: 'FIELD - authorship boundary carrying a long draft' },
  { key: 'world-live', env: envWork, w: FRAME.work.w, on: { field: 'short' }, what: 'the same composition with the World LIVE - the scrim-off reference' },
  { key: 'passage', env: envWork, w: FRAME.work.w, on: { passage: true, field: 'short' }, what: 'PASSAGE - modal, World suspended under the selected 0.50 scrim' },
  { key: 'n2', env: envWork, w: FRAME.work.w, on: { passage: true, nested: true, field: 'short' }, what: 'N2 - a nested ASIDE over a PASSAGE, same tone, no step' },
  { key: 'map-aside', env: envMap, w: FRAME.map.w, on: { aside: 'excerpt' }, what: 'an earned ASIDE over the Living Analysis Map' },
];

/* ------------------------------------------------------------------- the runner ------- */

async function pair(c, tvars) {
  const out = [];
  for (const [variant, vars] of [['model', {}], ['token', tvars]]) {
    const html = barePage(`${c.key} / ${variant}`, c.env(vars, c.on), { width: c.w });
    const file = join(REVIEW, `${c.key}-${variant}.png`);
    const r = await render(html, file, `${c.key}-${variant}`, { cond: COND_FRAME(c.w) });
    out.push({ variant, ...r });
  }
  const [model, token] = out;
  let diff = 0;
  const n = Math.min(model.img.rgba.length, token.img.rgba.length);
  for (let i = 0; i < n; i += 4) {
    if (model.img.rgba[i] !== token.img.rgba[i] || model.img.rgba[i + 1] !== token.img.rgba[i + 1] ||
        model.img.rgba[i + 2] !== token.img.rgba[i + 2]) diff++;
  }
  return {
    key: c.key, what: c.what, model, token,
    modelSha: sha(model.buf), tokenSha: sha(token.buf),
    identical: sha(model.buf) === sha(token.buf),
    pixelsDiffering: diff,
    sameGeometry: model.geo === token.geo,
    sameFocusTopology: model.focus === token.focus,
  };
}

/* --------------------------------------------------------------- scrim measurement ---- */

/**
 * The predictions, computed from CSS Color 4 alpha compositing BEFORE anything is rendered.
 *
 * `composite(x, a)` is the sealed package's own implementation, so these are not B4's arithmetic
 * either.
 */
export function predictions(alpha) {
  return {
    alpha,
    worldUnderScrim: composite(WORLD, alpha),
    surfaceUnderScrim: composite(SURFACE, alpha),
    primaryInkUnderScrim: composite(PRIMARY, alpha),
    passageForeground: SURFACE,
  };
}

function scrimMeasurements(byKey, pred) {
  const live = byKey['world-live'].token;
  const modal = byKey.passage.token;
  const p = modal.rects.passage;
  const plane = modal.rects.plane;
  const app = modal.rects.apparatus;

  /* A band of the analytical plane ABOVE the PASSAGE, present and identical in both compositions. */
  const band = { x: plane.x + 8, y: plane.y + 8, w: plane.w - 16, h: Math.max(8, p.y - plane.y - 16) };

  const liveBand = dominant(live.img, band);
  const modalBand = dominant(modal.img, band);
  const liveApp = dominant(live.img, app);
  const modalApp = dominant(modal.img, app);
  const panel = dominant(modal.img, { x: p.x + 24, y: p.y + 24, w: p.w - 48, h: p.h - 48 });

  const lum = (rgb) => 0.2126 * (rgb[0] / 255) + 0.7152 * (rgb[1] / 255) + 0.0722 * (rgb[2] / 255);
  return {
    band, panelRect: p,
    worldLive: { rgb: liveBand.rgb, hex: hex(liveBand.rgb), distinct: liveBand.distinct },
    worldSuppressed: { rgb: modalBand.rgb, hex: hex(modalBand.rgb), distinct: modalBand.distinct },
    apparatusLive: { rgb: liveApp.rgb, hex: hex(liveApp.rgb) },
    apparatusSuppressed: { rgb: modalApp.rgb, hex: hex(modalApp.rgb) },
    passageFill: { rgb: panel.rgb, hex: hex(panel.rgb), share: panel.share },
    predicted: pred,
    /* ORIENTATION: the suspended World keeps its structure if it still resolves into more than one
       level. A scrim that flattened it to a single value would have erased the screen rather than
       suppressed it. */
    orientation: {
      distinctLevelsLive: liveBand.distinct,
      distinctLevelsSuppressed: modalBand.distinct,
      structureSurvives: modalBand.distinct > 1,
    },
    suppression: {
      luminanceLive: lum(liveBand.rgb), luminanceSuppressed: lum(modalBand.rgb),
      dropRatio: lum(liveBand.rgb) > 0 ? lum(modalBand.rgb) / lum(liveBand.rgb) : 0,
    },
    foreground: {
      passageOverSuppressedWorld: contrastHex(hex(panel.rgb), hex(modalBand.rgb)),
      passageOverLiveWorld: contrastHex(hex(panel.rgb), hex(liveBand.rgb)),
      inkOnPassage: contrastHex(PRIMARY, hex(panel.rgb)),
      /**
       * WHAT THE SCRIM DOES TO READING BEHIND IT - reported, and NOT a pass criterion.
       *
       * The Design Director's D-5 direction is that the scrim expresses WORLD SUPPRESSION rather
       * than preserving background-reading eligibility. The World behind a PASSAGE is suspended, so
       * text that is still legible there is not a benefit and text that is not is not a defect. The
       * number is printed because a reader will want it, and labelled because a number in a table
       * with a WCAG threshold beside it will be read as a target by someone in a hurry.
       */
      backgroundReadingAfterScrim: contrastHex(pred.primaryInkUnderScrim, pred.worldUnderScrim),
      backgroundReadingBeforeScrim: contrastHex(PRIMARY, WORLD),
      /**
       * THE BOUNDARY FIGURE, and the reason it is reported rather than defended.
       *
       * `passageOverSuppressedWorld` is the tonal separation between the PASSAGE panel and the
       * suspended World at their shared edge. It is small, and it is SUPPOSED to be small: the
       * frozen mechanism for telling a PASSAGE apart is occlusion plus a uniform scrim plus modal
       * behaviour, not an edge contrast. A one-tone system that separated by edge contrast would
       * need a second tone, which is the whole B-track reopening.
       *
       * If a later accessibility expression requires this boundary to clear SC 1.4.11's 3:1, the
       * answer is a Class S structural line on the PASSAGE, and its colour is explicitly NOT B4's
       * to choose. Recorded as an open dependency rather than resolved here.
       */
      scrimImprovesBoundaryBy: contrastHex(hex(panel.rgb), hex(modalBand.rgb)) / contrastHex(hex(panel.rgb), hex(liveBand.rgb)),
    },
  };
}

/* ------------------------------------------------------------------------ main -------- */

export async function main() {
  mkdirSync(REVIEW, { recursive: true });
  mkdirSync(WORK, { recursive: true });

  const doc = JSON.parse(readFileSync(join(TOKENS_DIR, 'qandeel-surface.tokens.json'), 'utf8'));
  const tvars = tokenVars(doc);
  const { resolved } = load(doc, { file: 'canonical' });
  const scrimTok = resolved.get('qandeel.role.passage.scrim');
  const alpha = alphaOf(scrimTok.resolved);
  const pred = predictions(alpha);

  console.log('I-08B3.1-B4.12 - FINAL INTEGRATION CHECK');
  console.log('  custom properties resolved from the token file:');
  for (const [k, v] of Object.entries(tvars)) console.log(`    ${k.padEnd(14)} ${v}`);
  console.log('');
  console.log(`  properties the token file deliberately does NOT supply (deferred to E/F, kept diagnostic): ` +
    Object.keys(DEFAULT_VARS).filter((k) => !(k in tvars)).join(' '));
  console.log('');

  const results = [];
  for (const c of CASES) {
    const r = await pair(c, tvars);
    results.push(r);
    console.log(`  ${r.identical ? 'IDENTICAL' : 'DIFFERS  '}  ${r.key.padEnd(11)} ` +
      `${r.pixelsDiffering} px differ  geo ${r.sameGeometry ? 'same' : 'CHANGED'}  ` +
      `topology ${r.sameFocusTopology ? 'same' : 'CHANGED'}  ${r.tokenSha.slice(0, 16)}`);
  }

  const byKey = Object.fromEntries(results.map((r) => [r.key, r]));
  const scrim = scrimMeasurements(byKey, pred);

  console.log('');
  console.log(`I-08B3.1-B4.4 - SCRIM PRODUCTION VERIFICATION (one value: alpha ${alpha}, read from the token file)`);
  const rows = [
    ['World fill, live', scrim.worldLive.hex, WORLD.toLowerCase()],
    ['World fill, suppressed', scrim.worldSuppressed.hex, pred.worldUnderScrim],
    ['APPARATUS fill, live', scrim.apparatusLive.hex, SURFACE.toLowerCase()],
    ['APPARATUS fill, suppressed', scrim.apparatusSuppressed.hex, pred.surfaceUnderScrim],
    ['PASSAGE fill (foreground)', scrim.passageFill.hex, SURFACE.toLowerCase()],
  ];
  let mismatches = 0;
  for (const [label, got, want] of rows) {
    const okRow = got === want.toLowerCase();
    if (!okRow) mismatches++;
    console.log(`  ${okRow ? 'OK  ' : 'FAIL'}  ${label.padEnd(28)} measured ${got}  predicted ${want}`);
  }
  console.log(`  World luminance drops to ${(scrim.suppression.dropRatio * 100).toFixed(1)}% of live`);
  console.log(`  suspended World keeps ${scrim.orientation.distinctLevelsSuppressed} distinct levels ` +
    `(live: ${scrim.orientation.distinctLevelsLive}) - structure ${scrim.orientation.structureSurvives ? 'survives' : 'ERASED'}`);
  console.log(`  PASSAGE over suppressed World ${scrim.foreground.passageOverSuppressedWorld.toFixed(3)}:1 ` +
    `(over a live World it would be ${scrim.foreground.passageOverLiveWorld.toFixed(3)}:1)`);
  console.log(`  primary reading on the PASSAGE ${scrim.foreground.inkOnPassage.toFixed(3)}:1`);
  console.log(`  the scrim improves the PASSAGE/World boundary by x${scrim.foreground.scrimImprovesBoundaryBy.toFixed(3)} - ` +
    'the separation is occlusion, not edge contrast');
  console.log(`  reading BEHIND the scrim falls ${scrim.foreground.backgroundReadingBeforeScrim.toFixed(2)}:1 -> ` +
    `${scrim.foreground.backgroundReadingAfterScrim.toFixed(2)}:1  (REPORTED, NOT A PASS CRITERION - ` +
    'the World is suspended)');

  const differing = results.filter((r) => !r.identical);
  const geoChanged = results.filter((r) => !r.sameGeometry || !r.sameFocusTopology);

  console.log('');
  console.log(`  integration: ${results.length - differing.length}/${results.length} compositions byte-identical, ` +
    `${results.reduce((n, r) => n + r.pixelsDiffering, 0)} pixels differ in total`);
  console.log(`  scrim      : ${rows.length - mismatches}/${rows.length} measurements match their prediction`);

  writeFileSync(join(WORK, 'integration.json'), JSON.stringify({
    tokenVars: tvars,
    notSupplied: Object.keys(DEFAULT_VARS).filter((k) => !(k in tvars)),
    cases: results.map(({ model, token, ...r }) => ({ ...r,
      files: [`review/integration/${r.key}-model.png`, `review/integration/${r.key}-token.png`],
      raster: { w: model.width, h: model.height } })),
    scrim, scrimRows: rows.map(([label, got, want]) => ({ label, measured: got, predicted: want.toLowerCase(), match: got === want.toLowerCase() })),
  }, null, 2), { encoding: 'utf8' });

  return { results, scrim, differing, geoChanged, mismatches, tvars, alpha };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const r = await main();
  if (r.differing.length || r.geoChanged.length || r.mismatches) process.exit(1);
}
