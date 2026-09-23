/**
 * I-08B3.1-A3 - PREFLIGHT.
 *
 * The ten checks the brief requires before any A3 board may be trusted, plus two the Reference
 * Gate added, each answered by a measurement rather than by an assurance. Any failure is a STOP
 * condition and exits non-zero.
 *
 *    1  Estedad v8.5 is the file being embedded        - SHA-256 against the pinned digest
 *    2  the World is exactly #101010                   - literal, and the painted pixel
 *    3  the Secondary is exactly #afaca3               - literal, and the painted pixel
 *    4  the Tertiary is exactly #8b8982                - literal, and the painted pixel
 *    5  P1/P2 are the ONLY candidate-dependent values  - diff of the two variable blocks
 *    6  no Brass and no QANDEEL Light exists           - chroma census + vocabulary scan
 *    7  no thesis B or thesis C value remains          - hex scan of every text file
 *    8  the rendered sRGB is the authored sRGB         - every colour, bit for bit
 *    9  no fallback font                               - three-weight render fingerprint
 *   10  Arabic direction and tracking are correct      - COMPUTED styles from a real render
 *   11  every colour is inside the sRGB gamut          - so gamut mapping never runs at all
 *   12  both raster conditions are what they claim     - reported from the pages themselves
 *
 * Check 11 is new at A3 and comes from the Reference Gate. The current CSS Color 4 draft names
 * THREE gamut-mapping algorithms and lets an implementation choose between them, so a colour
 * that needs mapping is a colour whose displayed value is implementation-dependent. Proving
 * every value is already in gamut removes that dependence entirely rather than reasoning about
 * which algorithm Chrome happens to use.
 *
 * Check 6 is not a grep for the word "brass" alone. It also decodes what chroma is actually on
 * the screen, so a chromatic element could not survive even if it were introduced by a
 * stylesheet nobody read.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, basename } from 'node:path';
import { PKG, TTF, TTF_SHA, FONT_PROBE, page, esc } from './a3-ui.mjs';
import { render, COND_A2, COND_MOBILE, dumpDom, chromeVersion } from './a3-render.mjs';
import {
  WORLD, SECONDARY, TERTIARY, CONTROL, P1, P2, FINALISTS,
  oklchOf, diagSubtle, probeSwatches, derivedFinalists, DIAG_SUBTLE_DELTA_L,
} from './a3-model.mjs';
import { varsFor, diagEdge } from './a3-vars.mjs';
import { productFrame, DESKTOP, MOBILE, FORBIDDEN_COUNT } from './a3-env.mjs';
import { srgbToOklch, hexToRgb8, inSrgbGamut } from './color.mjs';
import { decode } from './png.mjs';
import { checkFairness } from './a3-fairness.mjs';

const WORKDIR = join(PKG, '..', '.i08b31-a3-work');
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

/** Every colour this package puts on a screen, gathered from the same code the boards use. */
export function allColours() {
  const set = new Map();
  const add = (hex, why) => { if (!set.has(hex)) set.set(hex, why); };
  add(WORLD, 'World Base - the sole incumbent, preserved');
  add(diagSubtle().hex, `diagnostic Subtle dL +${DIAG_SUBTLE_DELTA_L} - NON-CANONICAL`);
  add(diagEdge().hex, 'diagnostic non-text edge, solved to 3:1 - NON-CANONICAL');
  add(CONTROL.hex, 'CONTROL - A1 Primary, reference only');
  add(P1.hex, 'finalist P1');
  add(P2.hex, 'finalist P2');
  add(SECONDARY, 'Secondary - unchanged, not under test');
  add(TERTIARY, 'Tertiary - unchanged, not under test');
  probeSwatches().forEach((p) => add(p.hex, `achromatic diagnostic probe L ${p.authored.L.toFixed(2)} - NON-CANONICAL`));
  return [...set.entries()].map(([hex, why]) => ({ hex, why }));
}

/** Retired values that must not appear anywhere in the package. */
const RETIRED = {
  'thesis B': ['#101415', '#161a1b', '#e0e3e5', '#afb1b2', '#8c8e8f'],
  'thesis C': ['#191511', '#120f0b', '#dfdcd8', '#aeaca9', '#8a8885'],
};
/** Vocabulary that would mean a later-stage colour family had entered A3. */
const LATER_STAGE = /\b(brass|lantern|amber|gold(?:en)?|glow|bloom|aura|halo)\b/i;

function walk(dir, out = []) {
  for (const n of readdirSync(dir).sort()) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

async function main() {
  const lines = [];
  const say = (s) => { lines.push(s); console.log(s); };
  let stop = 0;
  const check = (n, name, ok, detail) => {
    if (!ok) stop++;
    say(`${ok ? 'PASS' : 'STOP'}  ${String(n).padStart(2)}. ${name}`);
    for (const d of [].concat(detail)) say(`         ${d}`);
  };

  const ver = await chromeVersion();
  say('I-08B3.1-A3 PREFLIGHT');
  say(`renderer: ${ver}`);
  say('');

  /* 1 - the font binary -------------------------------------------------------------- */
  const ttfOk = existsSync(TTF);
  const ttfSha = ttfOk ? sha256(TTF) : '(absent)';
  check(1, 'Estedad v8.5 binary identity', ttfOk && ttfSha === TTF_SHA, [
    `path   ${TTF}`,
    `sha256 ${ttfSha}`,
    `pinned ${TTF_SHA}`,
    'This host carries a SECOND file also called Estedad[wght].ttf, under .i08b3-work/fonts/,',
    'which is a different binary (328,340 bytes vs 284,180). The hash is checked rather than',
    'the path, so the wrong one cannot be embedded silently.',
  ]);

  /* 2-4 - the values that are NOT under test ------------------------------------------- */
  check(2, 'World Base is exactly #101010', WORLD === '#101010', [
    `authored ${WORLD}; measured OKLCH L ${oklchOf(WORLD)[0].toFixed(4)} C ${oklchOf(WORLD)[1].toFixed(4)} (achromatic)`,
    'A3 does not search for another World value and does not micro-adjust this one.',
    'It is preserved, and it is still NOT canonical until independent Design Director review.',
  ]);
  check(3, 'Secondary is exactly #afaca3 and unchanged', SECONDARY === '#afaca3', [
    `authored ${SECONDARY}; measured OKLCH L ${oklchOf(SECONDARY)[0].toFixed(4)} C ${oklchOf(SECONDARY)[1].toFixed(4)} H ${oklchOf(SECONDARY)[2].toFixed(1)}`,
  ]);
  check(4, 'Tertiary is exactly #8b8982 and unchanged', TERTIARY === '#8b8982', [
    `authored ${TERTIARY}; measured OKLCH L ${oklchOf(TERTIARY)[0].toFixed(4)} C ${oklchOf(TERTIARY)[1].toFixed(4)} H ${oklchOf(TERTIARY)[2].toFixed(1)}`,
    'It was NOT brightened to compensate for the Metadata weight question. See A3.6.',
  ]);

  /* 5 - exactly one variable differs --------------------------------------------------- */
  const vP1 = varsFor(P1.hex), vP2 = varsFor(P2.hex);
  const differing = Object.keys(vP1).filter((k) => vP1[k] !== vP2[k]);
  const derived = derivedFinalists();
  const derivedOk = derived.every((d) => d.derived.hex === d.hex);
  check(5, 'P1 and P2 are the ONLY candidate-dependent variables', differing.length === 1 && differing[0] === '--ink-1' && derivedOk, [
    `the template receives ${Object.keys(vP1).length} custom properties; ${differing.length} differs between the finalists: ${differing.join(', ')}`,
    `identical in both: ${Object.keys(vP1).filter((k) => !differing.includes(k)).join('  ')}`,
    ...derived.map((d) => `${d.key} ${d.hex} regenerated from the control by OKLCH L -${d.drop} with chroma and hue held: ` +
      `${d.derived.hex} ${d.derived.hex === d.hex ? '(matches the brief exactly)' : 'MISMATCH'}`),
    'The brief supplied the finalist hexes; they are re-derived here rather than taken on trust.',
  ]);

  /* 6 - no Brass, no QANDEEL Light, no accent ----------------------------------------- */
  const cols = allColours();
  const CEIL = 0.016;
  const chromas = cols.map((c) => ({ ...c, C: srgbToOklch(hexToRgb8(c.hex).map((v) => v / 255))[1] }));
  const over = chromas.filter((c) => c.C > CEIL);
  /* Three files are excluded from the searches below. Two DEFINE the needles - this preflight
     and the packager, which runs the same retired-hex scan independently at archive time - and
     a scanner that reports itself fails every run and teaches nothing. The third is this
     preflight's OWN OUTPUT DOCUMENT: when a run fails it prints the offending values into
     A3_PREFLIGHT.md, which the next run would then find in docs/ and fail on. That is a trap
     that makes a failure permanent and untraceable, so it is removed structurally rather than
     by deleting the file by hand. */
  const NEEDLE_FILES = ['a3-preflight.mjs', 'a3-package.mjs', 'A3_PREFLIGHT.md'];
  const srcFiles = walk(PKG).filter((p) => /\.(md|mjs|csv|json|txt)$/.test(p) && !NEEDLE_FILES.includes(basename(p)));
  /* The vocabulary scan targets what can actually put a colour on a screen: the tools that
     render, and the measurement record. The prose documents are deliberately NOT scanned -
     every one of them has to be able to say "no brass, no QANDEEL Light, no accent", and a
     document cannot paint a pixel. What guarantees the documents is the chroma census above,
     which measures the values that exist rather than the words used about them.
     Within the scanned set, two kinds of line legitimately contain the vocabulary: a NEGATION,
     and the REFUSAL MACHINERY itself - the table of patterns in a3-env.mjs that exists
     precisely to forbid these words, which is a regex-literal entry and paints nothing.
     Exempting it is the same move a2-package.mjs made when it excluded itself from its own
     hex scan: the file that defines the needles will always contain the needles. */
  const paintFiles = srcFiles.filter((p) => /[\\/]tools[\\/].*\.mjs$/.test(p) || /A3_MEASUREMENTS\./.test(p));
  const NEGATION = /\bno\b|\bnot\b|\bnever\b|forbid|absent|undesigned|non-canonical|refus|-off\b/i;
  const REFUSAL_MACHINERY = /^\s*\[\/|FORBIDDEN|assertNoDecor/;
  const vocab = [];
  for (const p of paintFiles) {
    for (const [i, line] of readFileSync(p, 'utf8').split('\n').entries()) {
      if (!LATER_STAGE.test(line)) continue;
      if (NEGATION.test(line) || REFUSAL_MACHINERY.test(line)) continue;
      vocab.push(`${relative(PKG, p)}:${i + 1}`);
    }
  }
  check(6, 'no Brass, QANDEEL Light, interaction or status colour is present', over.length === 0 && vocab.length === 0, [
    `highest chroma among all ${cols.length} colours: ${Math.max(...chromas.map((c) => c.C)).toFixed(4)} ` +
      `(${chromas.reduce((a, b) => (b.C > a.C ? b : a)).hex})`,
    `ceiling for this stage: C ${CEIL} - above that a value is an accent whatever it is called`,
    `the achromatic diagnostic probe is chroma exactly ${probeSwatches()[0].actual.C.toFixed(4)} and carries no hue at all`,
    ...over.map((c) => `OVER: ${c.hex} ${c.why}`),
    ...(vocab.length ? [`later-stage vocabulary used affirmatively at: ${vocab.join(', ')}`] : [
      `${paintFiles.length} rendering and measurement files scanned for later-stage vocabulary used affirmatively: none`,
      `(the ${srcFiles.length - paintFiles.length} prose documents are deliberately not scanned - they have to be able`,
      `to say "no brass, no QANDEEL Light, no accent", and prose paints nothing; the chroma census above is what`,
      `guarantees them, because it measures the values that exist rather than the words used about them)`,
    ]),
  ]);

  /* 7 - the retired theses ------------------------------------------------------------- */
  const leak = [];
  for (const p of srcFiles) {
    const t = readFileSync(p, 'utf8').toLowerCase();
    for (const [which, hexes] of Object.entries(RETIRED)) {
      for (const h of hexes) if (t.includes(h)) leak.push(`${relative(PKG, p)} contains ${which} value ${h}`);
    }
  }
  check(7, 'no thesis B and no thesis C value remains anywhere in the package', leak.length === 0, [
    'thesis B was retired as challenger by the Design Director after A2R; thesis C remains retired.',
    `${Object.values(RETIRED).flat().length} retired hex values searched across ${srcFiles.length} text files`,
    ...(leak.length ? leak : ['none found - neither thesis can be rendered by accident because neither exists in the model']),
  ]);

  /* 8 + 11 - rendered sRGB, bit for bit, and gamut ------------------------------------- */
  const SW = 44;
  const swatches = cols.map((c, i) =>
    `<div data-qp-rect="s${i}" style="background:${c.hex};width:${SW}px;height:${SW}px;"></div>`).join('');
  const swHtml = page('swatch', `<div class="board"><div style="display:flex;flex-wrap:wrap;gap:0;width:${SW * 20}px;">${swatches}</div></div>`,
    { width: COND_A2.viewport });
  const r = await render(swHtml, join(WORKDIR, 'preflight-swatches.png'), 'preflight-swatches');
  const img = decode(readFileSync(r.path));
  const bad = [];
  cols.forEach((c, i) => {
    const rc = r.rects[`s${i}`];
    const x = Math.round((rc.x + rc.w / 2) * r.dpr), y = Math.round((rc.y + rc.h / 2) * r.dpr);
    const p = (y * img.width + x) * 4;
    const seen = [img.rgba[p], img.rgba[p + 1], img.rgba[p + 2]];
    const want = hexToRgb8(c.hex);
    if (seen.join() !== want.join()) bad.push(`${c.hex} (${c.why}) painted as rgb(${seen.join(',')})`);
  });
  check(8, 'every authored colour is painted bit-identically', bad.length === 0, [
    `${cols.length} distinct colours checked in the rendered PNG, ${bad.length} mismatched`,
    '--force-color-profile=srgb on both the measure pass and the screenshot pass, and the PNG',
    'carries no embedded profile, so nothing downstream can re-map it either',
    ...bad,
  ]);

  /* 9 + 10 - font activation, direction and tracking, from a REAL product render -------- */
  const probeFrame = productFrame('deep', varsFor(P1.hex), DESKTOP);
  const styleScript = `<script>addEventListener('load',()=>{
const out=[];
for(const e of document.querySelectorAll('[data-qp-frame] p')){
  const c=getComputedStyle(e);
  out.push(c.direction+'/'+c.letterSpacing+'/'+c.textAlign);
}
const f=document.querySelector('[data-qp-frame]');
const fc=getComputedStyle(f);
const m=document.createElement('meta');m.name='qp-style';
m.content='frame:'+fc.direction+'/'+fc.textAlign+'|'+[...new Set(out)].join('|');
document.head.appendChild(m);
});</script>`;
  const probeHtml = page('preflight-style', `<div class="board"><div style="width:${DESKTOP.frameW}px;">${probeFrame}</div></div>${styleScript}`,
    { width: COND_A2.viewport });
  writeFileSync(join(WORKDIR, 'page-preflight-style.html'), probeHtml, 'utf8');
  const dom = await dumpDom(`file:///${join(WORKDIR, 'page-preflight-style.html').replace(/\\/g, '/')}`, COND_A2.viewport, 900, COND_A2.dpr);
  const got = (dom.match(/<meta name="qp-font" content="([^"]*)">/) || [, ''])[1].split(',').filter(Boolean).map(Number);
  const styles = (dom.match(/<meta name="qp-style" content="([^"]*)">/) || [, ''])[1];
  const drift = got.map((v, i) => Math.abs(v - FONT_PROBE.expected[i]));
  const allSame = new Set(got).size === 1;
  check(9, 'Estedad is applied, the wght axis works, and no fallback face is in use',
    got.length === 3 && drift.every((d) => d <= FONT_PROBE.tol) && !allSame, [
    `weights ${FONT_PROBE.weights.join(' / ')} measured ${got.join(' / ')} px`,
    `expected ${FONT_PROBE.expected.join(' / ')} px, drift ${drift.map((d) => d.toFixed(2)).join(' / ')} (tol ${FONT_PROBE.tol})`,
    `three distinct widths: ${!allSame} - if the axis were being ignored all three would be equal`,
    `this host's fallback face measures ${FONT_PROBE.fallbackSeen} px, which is ${(FONT_PROBE.expected[0] - FONT_PROBE.fallbackSeen).toFixed(1)} px away`,
    'font is embedded base64 in the document, so no network or system lookup can substitute it',
    'A3 depends on the 400/500 distinction more than any earlier stage, because A3.6 asks whether',
    'weight 500 rescues the Metadata role. A board with a dead wght axis would answer that falsely.',
  ]);
  const parts = styles.split('|');
  const frameOk = parts[0] === 'frame:rtl/right';
  const paraStates = parts.slice(1);
  const trackingOk = paraStates.every((s) => /\/(normal|0px)\//.test(s));
  const dirOk = paraStates.every((s) => s.startsWith('rtl/'));
  check(10, 'Arabic direction and tracking are correct in the rendered product', frameOk && dirOk && trackingOk, [
    `computed on the real ENVIRONMENT 3 markup, not asserted from the source`,
    `frame: ${parts[0].replace('frame:', '')} (direction / text-align)`,
    `distinct paragraph states (direction / letter-spacing / text-align): ${paraStates.join('   ')}`,
    `letter-spacing is zero on every Arabic element - banned outright on Arabic, and also one of`,
    `the ${FORBIDDEN_COUNT} refusal patterns run against every product frame before it is rasterised`,
  ]);

  /* 11 - gamut ------------------------------------------------------------------------- */
  const outOfGamut = cols.filter((c) => !inSrgbGamut(srgbToOklch(hexToRgb8(c.hex).map((v) => v / 255))));
  check(11, 'every colour is inside the sRGB gamut, so gamut mapping never runs', outOfGamut.length === 0, [
    'The current CSS Color 4 draft names THREE gamut-mapping algorithms - Binary Search with',
    'Local MINDE, EdgeSeeker and Ray Trace - and lets an implementation pick any of them. A value',
    'that needs mapping therefore has an implementation-dependent displayed colour. None of these',
    `${cols.length} values needs mapping, so the question does not arise for this package.`,
    ...outOfGamut.map((c) => `OUT OF GAMUT: ${c.hex} ${c.why}`),
  ]);

  /* 12 - both raster conditions -------------------------------------------------------- */
  let fair = { report: [], failed: 1 };
  try { fair = checkFairness(); } catch (e) { fair = { report: [], failed: 1, err: e.message }; }
  const condsOk = r.width === COND_A2.viewport * COND_A2.dpr && fair.failed === 0;
  check(12, 'both raster conditions are what they claim, and are structurally fair in both', condsOk, [
    `condition ${COND_A2.key}: ${COND_A2.viewport} CSS px at deviceScaleFactor ${COND_A2.dpr}; a board raster measured ${r.width} px wide`,
    `condition ${COND_MOBILE.key}: product laid out at ${MOBILE.frameW} CSS px at deviceScaleFactor ${COND_MOBILE.dpr}, ` +
      `cut from a ${COND_MOBILE.viewport} CSS px window because Chrome on Windows refuses a window below ~500 CSS px`,
    'colour profile, antialiasing, virtual time budget and compositor flags are IDENTICAL in both',
    'conditions - they are controls, not variables; only viewport and deviceScaleFactor differ',
    ...(fair.err ? [fair.err] : fair.report.map((x) =>
      `${x.env.padEnd(6)} ${x.cond.padEnd(7)} ${String(x.elements).padStart(3)} elements  ${x.identical ? 'identical' : 'DIFFERS: ' + x.firstDiff}`)),
    'compared as laid-out geometry with colour excluded, not as source text',
  ]);

  say('');
  say(stop === 0 ? 'PREFLIGHT PASSED - no stop condition met.'
                 : `PREFLIGHT FAILED - ${stop} stop condition(s) met. A3 boards must not be trusted.`);
  return { lines, stop, chrome: ver };
}

if (process.argv[1] && process.argv[1].endsWith('a3-preflight.mjs')) {
  const { lines, stop } = await main();
  const md = `# I-08B3.1-A3 — PREFLIGHT

**${stop === 0 ? 'PASSED — no stop condition was met.' : `FAILED — ${stop} stop condition(s) met.`}**
Run on ${new Date().toISOString().slice(0, 10)}. Reproduce with \`node tools/a3-preflight.mjs\`;
it exits non-zero on any failure, so it cannot pass silently.

These are the ten checks the A3 brief requires before any board may be trusted, plus two the
Reference Gate added. Each is answered by a measurement taken from this host, not by an
assurance. Checks 9 and 10 in particular are computed from a **real ENVIRONMENT 3 render**
rather than read back out of the source that produced it.

\`\`\`
${lines.join('\n')}
\`\`\`

## Three traps this preflight exists to catch

**Two different files on this host are called \`Estedad[wght].ttf\`** — 284,180 bytes under
\`.i08b3-work/raw/\` and 328,340 bytes under \`.i08b3-work/fonts/\`. Only the first is the
pinned v8.5. Check 1 hashes the file it is about to embed rather than trusting the path.

**Chrome on Windows refuses a browser window narrower than about 500 CSS px.** Ask for 390 and
the layout viewport comes back 488 while the screenshot is still taken at 390, so the
right-hand end of the document is silently cut off the raster. The first mobile run of this
package had exactly that defect. The product frame is therefore laid out at a fixed 390 CSS px
inside a wider window and cut out of the raster by its own reported box, and check 12 records
both numbers.

**A magnification crop must be anchored to the ink, not to the element box.** An RTL
paragraph's border box is the full column width while its glyphs occupy only part of it. Every
magnified tile in this package is cut from the rightmost inked column inside the reported box,
so the crop ends where the glyphs end whatever the box says.
`;
  writeFileSync(join(PKG, 'docs', 'A3_PREFLIGHT.md'), md, 'utf8');
  writeFileSync(join(WORKDIR, 'preflight.txt'), lines.join('\n'), 'utf8');
  process.exit(stop === 0 ? 0 : 1);
}

export { main as runPreflight };
