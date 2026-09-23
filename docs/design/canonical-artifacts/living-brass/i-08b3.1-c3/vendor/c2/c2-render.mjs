/**
 * I-08B3.1-C2 — headless Chrome renderer.
 *
 * Carried in method from B1/B1R/B2/B2R/B3/B3R/C1/C1R, because every guard in it was earned by a
 * defect that shipped silently in one of those stages. The standing guards:
 *
 *   1. GREYSCALE ANTIALIASING FORCED. This host renders LCD subpixel fringes, which put real colour
 *      on the edge of every glyph and every curve. On a board whose subject is a warm body a few
 *      hundredths of an Oklab unit from a neutral, a red-green fringe is not a nuisance — it is a
 *      contaminant indistinguishable from the property under test.
 *   2. sRGB FORCED, so Chrome does not colour-manage the output into the host's display profile.
 *   3. OVERFLOW GUARD — a board laid out wider than its canvas is refused, not cropped.
 *   4. FONT FINGERPRINT — a board set in a substituted face is refused.
 *   5. BLANK-RENDER GUARD — a board that rasterised to nothing must not pass.
 *   6. THE THREE FAIRNESS GUARDS — geometry, non-material markup, material structure.
 *
 * WHAT C2 ADDS: A FOURTH GUARD, `assertCoverageDelta`.
 *
 * C1R's three guards prove that two frames differ only in material. C2's claim is different and
 * neither stronger nor weaker: that two frames differ only in WHICH OBJECTS the material is on. A
 * P1 frame and a P2 frame are SUPPOSED to differ inside their material svgs — that difference IS the
 * policy — so guard 3 cannot be applied to a P1/P2 pair at all, and applying only guards 1 and 2
 * would leave the central claim of the package unchecked: that the policies differ in the navigation
 * family and in NOTHING ELSE.
 *
 * Guard 4 closes that. It extracts every material-bearing svg from both frames, pairs them in
 * document order, and asserts that the pairs which differ are exactly the ones the policy names —
 * no more and no fewer. A stray Brass chevron, a Brass divider, a Brass analytical node or a
 * silently-neutralised identity mark all fail it.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { decode } from './png.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');
export const WORK = join(PKG, '..', '.i08b31-c2-work');
export const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

if (!existsSync(WORK)) mkdirSync(WORK, { recursive: true });

export const COND = {
  DESK:   { key: 'DESK',   viewport: 1440, dpr: 2, label: 'desktop proof condition — 1440 CSS px, deviceScaleFactor 2' },
  PAIR:   { key: 'PAIR',   viewport: 1120, dpr: 2, label: 'two-phone proof condition — 1120 CSS px, deviceScaleFactor 2' },
  WIDE:   { key: 'WIDE',   viewport: 1800, dpr: 2, label: 'wide desktop proof condition — 1800 CSS px, deviceScaleFactor 2' },
  QUAD:   { key: 'QUAD',   viewport: 1900, dpr: 2, label: 'four-phone proof condition — 1900 CSS px, deviceScaleFactor 2' },
  FIVE:   { key: 'FIVE',   viewport: 2260, dpr: 2, label: 'five-phone proof condition — 2260 CSS px, deviceScaleFactor 2' },
  SIX:    { key: 'SIX',    viewport: 2620, dpr: 2, label: 'six-phone proof condition — 2620 CSS px, deviceScaleFactor 2' },
  BARE:   { key: 'BARE',   viewport: 900,  dpr: 2, label: 'unlabelled Product-Owner condition — 900 CSS px, deviceScaleFactor 2' },
};

/**
 * Chrome's LAYOUT VIEWPORT is narrower than the window it is given: ask for 1440 and the page lays
 * out at 1422, an 18 px difference that `--hide-scrollbars` does not remove. The window is therefore
 * always asked for GUTTER px more than the board needs, and the page is required to report a layout
 * viewport at least as wide as the board.
 */
export const GUTTER = 24;

export const AA = ['--disable-lcd-text', '--disable-font-subpixel-positioning'];

export const CONSTANT_FLAGS = [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  ...AA, '--force-color-profile=srgb', '--virtual-time-budget=25000',
  '--run-all-compositor-stages-before-draw',
];

/**
 * The Chrome build, read from the versioned directory beside the executable.
 *
 * `chrome.exe --version` is NOT usable on this host: it hands off to the already-running browser and
 * prints nothing, and adding `--headless=new` to make it print leaves a process that never closes.
 * That cost B2 a silent forty-minute stall.
 */
let _version = null;
export function chromeVersion() {
  if (_version !== null) return _version;
  const dir = CHROME.slice(0, CHROME.lastIndexOf('\\'));
  let v = '(version directory not found)';
  try {
    const hits = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^\d+\.\d+\.\d+\.\d+$/.test(e.name))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (hits.length) v = `Google Chrome ${hits[hits.length - 1]} (read from the install directory)`;
  } catch { /* reported as not found rather than guessed */ }
  _version = v;
  return v;
}

function run(args) {
  return new Promise((res) => {
    const c = spawn(CHROME, args, { windowsHide: true });
    let err = '';
    c.stdout.on('data', () => {});
    c.stderr.on('data', (d) => { err += d; });
    c.on('close', () => res(err));
  });
}

export function dumpDom(url, width, height = 900, dpr = 1) {
  const args = ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    ...AA, `--force-device-scale-factor=${dpr}`, '--force-color-profile=srgb',
    '--virtual-time-budget=25000', `--window-size=${width},${height}`, '--dump-dom', url];
  return new Promise((res) => {
    const chunks = [];
    const c = spawn(CHROME, args, { windowsHide: true });
    c.stdout.on('data', (d) => chunks.push(d));
    c.stderr.on('data', () => {});
    c.on('close', () => res(Buffer.concat(chunks).toString('utf8')));
  });
}

export async function shoot(html, outPng, name, { width, height, dpr = 1 }) {
  const pagePath = join(WORK, `raw-${name}.html`);
  writeFileSync(pagePath, html, 'utf8');
  const url = `file:///${pagePath.replace(/\\/g, '/')}`;
  await run([...CONSTANT_FLAGS, `--force-device-scale-factor=${dpr}`,
    `--window-size=${width},${height}`, `--screenshot=${outPng}`, url]);
  if (!existsSync(outPng)) throw new Error(`${name}: Chrome wrote no PNG`);
  return outPng;
}

async function measure(url, width, dpr) {
  const dom = await dumpDom(url, width, 900, dpr);
  const meta = (n) => {
    const m = dom.match(new RegExp(`<meta name="${n}" content="([^"]*)">`));
    return m ? m[1] : '';
  };
  const rects = {};
  for (const m of dom.matchAll(/<meta name="qp-rect-([^"]+)" content="([^"]*)">/g)) {
    const [x, y, rw, rh] = m[2].split(',').map(Number);
    rects[m[1]] = { x, y, w: rw, h: rh };
  }
  const f = meta('qp-font');
  return {
    h: parseInt(meta('qp-height') || '0', 10),
    viewport: parseInt(meta('qp-viewport') || '0', 10),
    minLeft: parseInt(meta('qp-minleft') || '0', 10),
    minLeftEl: meta('qp-minleft-el'),
    maxRight: parseInt(meta('qp-maxright') || '0', 10),
    maxRightEl: meta('qp-maxright-el'),
    dpr: parseFloat(meta('qp-dpr') || '0'),
    font: f ? f.split(',').map(Number) : [],
    geo: meta('qp-geo'),
    frames: meta('qp-frames'),
    rects,
  };
}

let FONT_EXPECT = null;
export function setFontProbe(p) { FONT_EXPECT = p; }

function assertFont(name, widths) {
  if (!FONT_EXPECT) return;
  const want = FONT_EXPECT.expected;
  if (widths.length !== want.length) {
    throw new Error(`${name}: font fingerprint reported ${widths.length} values, expected ${want.length}`);
  }
  const bad = widths.map((v, i) => [FONT_EXPECT.weights[i], v, want[i]])
    .filter(([, v, w]) => Math.abs(v - w) > FONT_EXPECT.tol);
  if (bad.length) {
    const looksFallback = widths.some((v) => Math.abs(v - FONT_EXPECT.fallbackSeen) < 2);
    const allSame = new Set(widths).size === 1;
    throw new Error(
      `${name}: FONT FINGERPRINT FAILED — ` +
      bad.map(([w, v, e]) => `weight ${w} measured ${v}px, expected ${e}px`).join('; ') +
      ` (+/-${FONT_EXPECT.tol}).` +
      (looksFallback ? " That is this host's fallback face: the board would be set in the wrong font." : '') +
      (allSame ? ' All three weights measured the same: the variable wght axis is not being applied.' : '')
    );
  }
}

export function inkCoverage(img, bg) {
  const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const base = lum(...bg);
  let peak = base;
  for (let i = 0; i < img.width * img.height; i++) {
    const l = lum(img.rgba[i * 4], img.rgba[i * 4 + 1], img.rgba[i * 4 + 2]);
    if (l > peak) peak = l;
  }
  if (peak - base < 1) return { coverage: 0, peak, base };
  let n = 0;
  for (let i = 0; i < img.width * img.height; i++) {
    const l = lum(img.rgba[i * 4], img.rgba[i * 4 + 1], img.rgba[i * 4 + 2]);
    if ((l - base) / (peak - base) >= 0.5) n++;
  }
  return { coverage: n / (img.width * img.height), peak, base };
}

/** Frames may be passed as one flat list or as a list of groups. Carried from C1R. */
export const asGroups = (x) => (Array.isArray(x[0]) ? x : [x]);

/**
 * FAIRNESS GUARD 1 — THE GEOMETRY FINGERPRINT.
 *
 * Every element inside a frame contributes its tag, its box measured RELATIVE TO ITS OWN FRAME, and
 * its text length — and NOTHING about colour. Two frames that differ only in paint produce identical
 * strings. Each board names which of its frames must match; a board that names none is making no
 * fairness claim.
 */
export function assertIdenticalGeometry(name, geo, { groups = null } = {}) {
  const fps = String(geo).split('#');
  const check = groups || [fps.map((_, i) => i)];
  for (const g of check) {
    const first = fps[g[0]];
    for (const i of g.slice(1)) {
      if (fps[i] !== first) {
        const a = first.split('|'), b = fps[i].split('|');
        let at = 'length';
        for (let k = 0; k < Math.max(a.length, b.length); k++) {
          if (a[k] !== b[k]) { at = `element ${k}: "${a[k]}" vs "${b[k]}"`; break; }
        }
        throw new Error(
          `${name}: FAIRNESS GUARD FAILED — frame ${i} is not geometrically identical to frame ${g[0]}. ` +
          `Only the MATERIAL may differ between these frames. First difference at ${at}`
        );
      }
    }
  }
  return fps.length;
}

/**
 * FAIRNESS GUARD 2 — NON-MATERIAL MARKUP IDENTITY.
 *
 * Guard 1 proves every laid-out box is the same. This proves something the DOM cannot: that the
 * MARKUP the frames are built from is byte-for-byte the same everywhere except inside the
 * material-bearing SVGs. What remains after excision is the entire product — machinery, map,
 * relation lines, entries, tab strip, state carrier, every class, every character of Arabic.
 */
export function assertNonMaterialMarkupIdentical(name, frames) {
  const strip = (s) => s
    .replace(/<svg\b[^>]*\bdata-mat\b[^>]*>[\s\S]*?<\/svg>/g, '<MATERIAL/>')
    .replace(/data-qp-rect="[^"]*"/g, 'data-qp-rect="*"');
  for (const group of asGroups(frames)) {
    const base = strip(group[0]);
    for (let i = 1; i < group.length; i++) {
      const s = strip(group[i]);
      if (s !== base) {
        let at = 0;
        while (at < Math.min(s.length, base.length) && s[at] === base[at]) at++;
        throw new Error(
          `${name}: FAIRNESS GUARD FAILED — frame ${i}'s non-material markup differs from frame 0 at character ${at}.\n` +
          `    frame 0: ...${base.slice(Math.max(0, at - 60), at + 60)}...\n` +
          `    frame ${i}: ...${s.slice(Math.max(0, at - 60), at + 60)}...`
        );
      }
    }
  }
  return strip(asGroups(frames)[0][0]).length;
}

/** Ids are serial and depend on board assembly order, which is bookkeeping, not material. */
const normaliseIds = (s) => s
  .replace(/id="([a-zA-Z]+)\d+"/g, 'id="$1N"')
  .replace(/url\(#([a-zA-Z]+)\d+\)/g, 'url(#$1N)')
  .replace(/data-qp-rect="[^"]*"/g, 'data-qp-rect="*"');

const materialSvgs = (s) => (s.match(/<svg\b[^>]*\bdata-mat\b[^>]*>[\s\S]*?<\/svg>/g) || []);

/**
 * FAIRNESS GUARD 3 — MATERIAL STRUCTURE IDENTITY (inherited from C1R).
 *
 * Used where frames are supposed to carry the SAME material — a state matrix, a scale comparison.
 * Every `#rrggbb` is replaced by a placeholder, so what is compared is the material's STRUCTURE: its
 * filter, its frequencies, its seed, its alpha map, its clip paths, its element order, its geometry.
 */
export function assertMaterialStructureIdentical(name, frames) {
  const structure = (s) => normaliseIds(materialSvgs(s).join('\n').replace(/#[0-9a-fA-F]{6}\b/g, '#COLOUR'));
  for (const group of asGroups(frames)) {
    const base = structure(group[0]);
    if (!base.length) throw new Error(`${name}: no material svg found — this guard is not scanning`);
    for (let i = 1; i < group.length; i++) {
      const s = structure(group[i]);
      if (s !== base) {
        let at = 0;
        while (at < Math.min(s.length, base.length) && s[at] === base[at]) at++;
        throw new Error(
          `${name}: MATERIAL STRUCTURE GUARD FAILED — frame ${i}'s material differs from frame 0 by ` +
          `something other than a colour value, at character ${at}.\n` +
          `    frame 0: ...${base.slice(Math.max(0, at - 70), at + 70)}...\n` +
          `    frame ${i}: ...${s.slice(Math.max(0, at - 70), at + 70)}...`
        );
      }
    }
  }
  return structure(asGroups(frames)[0][0]).length;
}

/**
 * FAIRNESS GUARD 4 — THE COVERAGE DELTA. NEW IN C2, AND THE ONE THAT MATCHES WHAT C2 CLAIMS.
 *
 * C2's central structural claim is: "the ONLY difference between a P1 frame and a P2 frame is the
 * paint of the persistent navigation family." Guards 1 and 2 cannot see it — both are blind to the
 * inside of a material svg, which is precisely where the policy lives. Guard 3 cannot be used at
 * all, because a P1/P2 pair is SUPPOSED to differ there.
 *
 * So this guard pairs the material svgs of two frames in document order and classifies each pair:
 *   · IDENTICAL            — same object, same paint
 *   · PAINT-ONLY DIFFERENT — same structure, different `#rrggbb`
 *   · STRUCTURALLY DIFFERENT — anything else, which is always a failure
 *
 * Every material svg carries a `data-role`, so the guard can then check that the set of roles which
 * changed paint is EXACTLY the set the policy is entitled to change. A Brass chevron, a Brass
 * divider, a Brass analytical node, or an identity mark that quietly went neutral between the two
 * policies each produce a role in the changed set that is not in the entitled set, and fail here.
 *
 * `expectChanged` is stated by the CALLER, per board, in the caller's own words. A guard whose
 * expectation is derived from the thing it is checking would be the tautology C1R found in C1's
 * preflight and refused to repeat.
 */
export function assertCoverageDelta(name, frameA, frameB, expectChanged) {
  const a = materialSvgs(frameA), b = materialSvgs(frameB);
  if (a.length !== b.length) {
    throw new Error(`${name}: COVERAGE DELTA GUARD FAILED — frame A carries ${a.length} material ` +
      `objects and frame B carries ${b.length}. A coverage policy paints objects differently; it ` +
      `does not add or remove them.`);
  }
  if (!a.length) throw new Error(`${name}: no material svg found — this guard is not scanning`);
  const roleOf = (s) => (s.match(/data-role="([^"]+)"/) || [, '(unnamed)'])[1];
  const changed = [], structural = [];
  for (let i = 0; i < a.length; i++) {
    const [sa, sb] = [a[i], b[i]].map(normaliseIds);
    if (sa === sb) continue;
    const [ca, cb] = [sa, sb].map((s) => s.replace(/#[0-9a-fA-F]{6}\b/g, '#COLOUR'));
    if (ca !== cb) structural.push(`${roleOf(a[i])} (object ${i})`);
    else changed.push(roleOf(a[i]));
  }
  if (structural.length) {
    throw new Error(`${name}: COVERAGE DELTA GUARD FAILED — these material objects differ by ` +
      `something other than paint: ${structural.join(', ')}. Only the PAINT may differ between two ` +
      `coverage policies.`);
  }
  const got = [...new Set(changed)].sort();
  const want = [...new Set(expectChanged)].sort();
  if (got.join('|') !== want.join('|')) {
    const extra = got.filter((r) => !want.includes(r));
    const missing = want.filter((r) => !got.includes(r));
    throw new Error(`${name}: COVERAGE DELTA GUARD FAILED — the policies repaint ` +
      `[${got.join(', ') || 'nothing'}] but are entitled to repaint [${want.join(', ')}].` +
      (extra.length ? ` NOT ENTITLED: ${extra.join(', ')}.` : '') +
      (missing.length ? ` ENTITLED BUT UNCHANGED: ${missing.join(', ')}.` : ''));
  }
  return { objects: a.length, repainted: changed.length, roles: got };
}

/**
 * GUARD 5 — BRASS CONTAINMENT. The material story audit, made mechanical.
 *
 * C2.6 asks, for every Brass occurrence: what is it, why is it QANDEEL-owned, what permission
 * allows Brass, would the reason survive a state change, is it part of the same material story. That
 * is a judgement, and judgements belong in the audit document. But ONE half of it is not a
 * judgement at all and should never have been left to one: whether Brass reached anything that was
 * never a material object in the first place.
 *
 * This guard excises every `data-mat` svg from a frame and asserts the Brass hex does not appear in
 * what is left. What is left is the entire rest of the Product: every ink, every rule, every
 * background, every heading, every quote, every divider, every analytical node, every relation
 * stroke, every state class, every inline style. So it proves, per frame and without reading a word
 * of prose, that Brass is not a heading colour, not a quote colour, not a divider colour, not a
 * reading ornament, not a state, and — the one the Design Director cares about most — nowhere on
 * the analytical plane.
 *
 * It cannot prove the other half: that each surviving Brass object has a legitimate identity
 * permission. That is what `C2_MATERIAL_STORY_AUDIT.md` is for, and it is named there rather than
 * implied, so a reader can see exactly which half of the audit is mechanical and which is argued.
 */
export function assertBrassContained(name, frames, brassHexes) {
  const hexes = (Array.isArray(brassHexes) ? brassHexes : [brassHexes]).map((h) => h.toLowerCase());
  const list = Array.isArray(frames) ? frames.flat() : [frames];
  for (let i = 0; i < list.length; i++) {
    const outside = String(list[i]).replace(/<svg\b[^>]*\bdata-mat\b[^>]*>[\s\S]*?<\/svg>/g, '');
    for (const hex of hexes) {
      const at = outside.toLowerCase().indexOf(hex);
      if (at !== -1) {
        throw new Error(
          `${name}: BRASS CONTAINMENT GUARD FAILED — frame ${i} carries ${hex} OUTSIDE every ` +
          `material object, at character ${at}. Living Brass may paint identity-bearing material ` +
          `objects and nothing else.\n    ...${outside.slice(Math.max(0, at - 90), at + 90)}...`
        );
      }
    }
  }
  return list.length;
}

export async function render(html, outPng, name, { cond = COND.DESK, benchRgb = [0x33, 0x33, 0x33] } = {}) {
  const width = cond.viewport;
  const win = width + GUTTER;
  const pagePath = join(WORK, `page-${name}.html`);
  writeFileSync(pagePath, html, 'utf8');
  const url = `file:///${pagePath.replace(/\\/g, '/')}`;

  const m = await measure(url, win, cond.dpr);
  if (!m.h) throw new Error(`${name}: could not measure page height`);
  assertFont(name, m.font);
  if (m.viewport < width) {
    throw new Error(`${name}: asked Chrome for a ${win}px window and the layout viewport came back ` +
      `${m.viewport}px, which is narrower than the ${width}px board. Raise GUTTER in c2-render.mjs.`);
  }
  if (m.minLeft < -1) {
    throw new Error(`${name}: content extends to x=${m.minLeft}px, i.e. ${-m.minLeft}px off the LEFT edge ` +
      `(${m.minLeftEl}). scrollWidth cannot see this; widen the board.`);
  }
  if (m.maxRight > width + 1) {
    throw new Error(`${name}: content extends to x=${m.maxRight}px on a ${width}px board — ` +
      `${m.maxRight - width}px would be cropped off the right edge (${m.maxRightEl})`);
  }
  if (Math.abs(m.dpr - cond.dpr) > 0.001) {
    throw new Error(`${name}: page reports devicePixelRatio ${m.dpr} but the condition asks for ${cond.dpr}`);
  }
  const height = Math.ceil(m.h);

  await run([...CONSTANT_FLAGS, `--force-device-scale-factor=${cond.dpr}`,
    `--window-size=${win},${height}`, `--screenshot=${outPng}`, url]);

  if (!existsSync(outPng)) throw new Error(`${name}: Chrome wrote no PNG`);
  const img = decode(readFileSync(outPng));
  if (img.width !== win * cond.dpr) {
    throw new Error(`${name}: raster is ${img.width}px wide, expected ${win * cond.dpr} ` +
      `(${width} CSS px board + ${GUTTER} px gutter at deviceScaleFactor ${cond.dpr})`);
  }
  const { coverage } = inkCoverage(img, benchRgb);
  if (coverage < 0.0005) {
    throw new Error(`${name}: render is effectively blank (ink coverage ${(coverage * 100).toFixed(4)}%)`);
  }
  console.log(`  ${name.padEnd(46)} ${cond.key.padEnd(6)} ${String(img.width).padStart(5)}x${String(img.height).padStart(5)}px  ink ${(coverage * 100).toFixed(2)}%`);
  return { name, cond, path: outPng, width: img.width, height: img.height,
    cssWidth: width, cssHeight: height, dpr: cond.dpr, coverage, rects: m.rects, geo: m.geo, img };
}
