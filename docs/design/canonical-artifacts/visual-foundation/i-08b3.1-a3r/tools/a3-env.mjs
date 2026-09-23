/**
 * I-08B3.1-A3 - THE ONE SHARED PROOF IMPLEMENTATION.
 *
 * This file is the fairness contract in code. The control and both finalists render through
 * `productFrame()`. A candidate contributes exactly ONE CSS custom property - `--ink-1` - and
 * contributes nothing else. Geometry, DOM order, element count, type roles, spacing, copy,
 * direction and font are literal constants here and cannot vary by candidate.
 * `tools/a3-fairness.mjs` proves it by comparing the rendered geometry fingerprints element
 * by element, in both raster conditions.
 *
 * TWO GEOMETRIES, for A3.7. `DESKTOP` is the established A2 proof condition, unchanged in
 * every constant, so an A3 environment board and its A2 predecessor are the same composition.
 * `MOBILE` is a 390 CSS px phone viewport at deviceScaleFactor 3. The two are NOT claimed to
 * be the same reading condition - a phone cannot give 560 px of measure, and A3_FINDINGS says
 * so - but within each condition the finalists are identical to each other, which is what the
 * robustness question actually asks.
 *
 * METADATA WEIGHT. The product environments set Metadata at weight 500, not 400. That is
 * inside the frozen role (12/20/400-500) and is what the A3 brief directs after A2 found 400
 * visually fragile at true size. Weight 400 survives as a dedicated control on
 * METADATA_TRUE_SIZE and nowhere else. No size, leading or tracking changed, and the Tertiary
 * colour was NOT raised to compensate.
 *
 * WHAT IS DELIBERATELY ABSENT, and is asserted by `assertNoDecor()` rather than promised:
 * no logo, Q, lantern or mark of any kind; no glow, bloom, aura, gradient, blur, glass,
 * backdrop-filter, shadow, texture or grain; no accent, brass, brand light, status or
 * interaction colour; no card, no container border, no container radius; no mock device, no
 * hero composition. The Logo-Off and Glow-Off conditions are therefore not a separate render -
 * they are the condition every board is already in, and the assertion is the evidence.
 *
 * Structural choices that came from a source rather than from habit:
 *   - a navigation strip on `--subtle` over a body on `--world`: Material 3, "The most common
 *     combination of surface roles uses surface for a background area and surface container
 *     for a navigation area", and "All color mappings - but especially surface colors - should
 *     remain the same for layout regions across breakpoints", which is why the mobile frame
 *     keeps the same role mapping rather than inventing a phone-specific one.
 *   - depth expressed as tone alone, with no border and no shadow: Apple HIG Dark Mode, base
 *     and elevated background colours, where "The base colors are dimmer ... and the elevated
 *     colors are brighter".
 *   - the utility screen carries NO dividers: WCAG 2.2 SC 1.4.11 does not require a visual
 *     boundary indicating the hit area when the control has visible content. The rows have
 *     text, so the separation is spacing.
 *   - no ALL-CAPS tracked label anywhere inside the product region, and no middle-dot meta
 *     string: `frontend-design` names both as template chrome that appears whatever the
 *     subject. letter-spacing is 0 on every Arabic element regardless.
 */
import { esc } from './a3-ui.mjs';
import { ROLES, COPY } from './a3-model.mjs';

/* ---------------------------------------------------------------- geometry ----------- */

/** The established A2 proof condition. Every constant is unchanged from A2. */
export const DESKTOP = {
  key: 'desktop',
  frameW: 960,
  navH: 54,
  padX: 56,
  padTop: 34,
  padBottom: 46,
  measure: 560,      // the established 520-600px Arabic reading comfort zone
  mapH: 416,
};

/**
 * A modern phone viewport. 390 CSS px is the logical width of the current mainstream iPhone
 * class and is what `ui-ux-pro-max`'s pre-delivery checklist points at when it asks for a
 * small-phone pass; deviceScaleFactor 3 is that class's density.
 *
 * The measure here is 350 px, below the frozen 520-600 comfort zone, because a phone simply
 * does not have 560 px to give. That is a property of the device, not a choice A3 made, and
 * it is recorded as a limit on what this condition can prove rather than smoothed over.
 */
export const MOBILE = {
  key: 'mobile',
  frameW: 390,
  navH: 48,
  padX: 20,
  padTop: 22,
  padBottom: 34,
  measure: 350,
  mapH: null,        // the map is a fixed desktop composition - see productFrame()
};

/** Default, so every existing call site reads exactly as it did in A2. */
export const G = DESKTOP;

const R = ROLES;

/** Metadata weight inside the product. Inside the frozen role; see the header. */
export const METADATA_WEIGHT = 500;

/** Arabic, one frozen role, zero tracking. `dir` is inherited from the frame. */
const t = (text, role, ink, { mt = 0, weight = null, w = null, rect = null } = {}) =>
  `<p${rect ? ` data-qp-rect="${rect}"` : ''} style="font-size:${role.size}px;line-height:${role.leading}px;` +
  `font-weight:${weight ?? role.weight};` +
  `color:var(${ink});margin-top:${mt}px;letter-spacing:0;${w ? `width:${w}px;` : ''}">` +
  esc(text).replace(/\n/g, '<br>') + `</p>`;

/**
 * Metadata is always drawn through this, so the weight decision lives in exactly one place.
 *
 * `g.metaWeight` exists for ONE purpose: the failure capture that re-renders a product screen
 * with Metadata at weight 400, which is what A2 measured and found fragile. It is never set
 * on any shipped environment board. Size, leading, tracking and the Tertiary colour are not
 * parameterised at all, because none of them may move.
 */
const meta = (text, ink, g, opts = {}) =>
  t(text, R.metadata, ink, { ...opts, weight: g.metaWeight ?? METADATA_WEIGHT });

/* ------------------------------------------------------------------- strips ---------- */

/**
 * The navigation strip. Flat `--subtle`, full bleed, no border, no radius, no shadow - the
 * separation from the body is tonal and nothing else.
 */
const nav = (label, g) =>
  `<div style="background:var(--subtle);height:${g.navH}px;padding:0 ${g.padX}px;display:flex;align-items:center;">` +
  `<span style="font-size:${R.action.size}px;line-height:${R.action.leading}px;font-weight:${R.action.weight};` +
  `color:var(--ink-2);letter-spacing:0;">${esc(label)}</span></div>`;

const body = (g, inner) =>
  `<div style="background:var(--world);padding:${g.padTop}px ${g.padX}px ${g.padBottom}px;">${inner}</div>`;

/* -------------------------------------------------------------- environments --------- */

function envQuiet(g) {
  const c = COPY.quiet;
  const turn = (x, i) => {
    const isQ = x.who === 'qandeel';
    const role = isQ ? R.body : R.supporting;
    const ink = isQ ? '--ink-1' : '--ink-2';
    return t(x.text, role, ink, { mt: i === 0 ? 0 : 30, w: g.measure });
  };
  return nav('المحادثات', g) + body(g,
    t(c.title, R.screenTitle, '--ink-1') +
    meta(c.meta, '--ink-3', g, { mt: 6 }) +
    `<div style="margin-top:34px;">${c.turns.map(turn).join('')}</div>` +
    meta(c.metaSecond, '--ink-3', g, { mt: 30 }));
}

/**
 * The Living Analysis Map.
 *
 * Every label restates something the conversation in `COPY.quiet` actually contains, and every
 * count is a count of that same corpus. No relationship is invented, nothing is asserted that
 * the reader has not seen said, and no colour is used to make any node look more important
 * than another - all six are drawn in exactly the same two inks. The reading Primary is the
 * only thing that changes between candidates, which is precisely what makes this board a test
 * of whether the finalist still carries analytical structure.
 */
function envMap(g) {
  const c = COPY.map;
  const P = [
    { x: 600, y: 20 }, { x: 336, y: 96 }, { x: 596, y: 176 },
    { x: 60, y: 196 }, { x: 336, y: 272 }, { x: 600, y: 320 },
  ];
  const E = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [4, 5]];
  const NW = 228, NH = 66;
  /* An edge leaves a node from the horizontal middle of its box, and from the TOP or BOTTOM
     edge depending on which way it is going - never from the left or right. The labels are
     right-aligned Arabic filling the box, so a line anchored at a side would be drawn straight
     through the words it is meant to connect. */
  const CLEAR = 8;
  const ax = (p) => p.x + NW / 2;
  const ay = (p, other) => (other.y > p.y ? p.y + NH + CLEAR : p.y - CLEAR);
  const lines = E.map(([a, b]) =>
    `<line x1="${ax(P[a])}" y1="${ay(P[a], P[b])}" x2="${ax(P[b])}" y2="${ay(P[b], P[a])}" ` +
    `stroke="var(--edge)" stroke-width="1"/>`).join('');
  const nodes = P.map((p, i) => {
    const n = c.nodes[i];
    return `<div style="position:absolute;left:${p.x}px;top:${p.y}px;width:${NW}px;text-align:right;">` +
      t(n.t, R.action, '--ink-1') + meta(n.s, '--ink-3', g, { mt: 3 }) +
      meta(n.d, '--ink-3', g) + `</div>`;
  }).join('');
  return nav('التحليل', g) + body(g,
    t(c.title, R.screenTitle, '--ink-1') +
    t(c.lede, R.supporting, '--ink-2', { mt: 8, w: g.measure }) +
    `<div style="position:relative;height:${g.mapH}px;margin-top:26px;">` +
      `<svg width="${g.frameW - g.padX * 2}" height="${g.mapH}" style="position:absolute;left:0;top:0;` +
      `overflow:visible;">${lines}</svg>${nodes}</div>` +
    meta(c.edgeNote, '--ink-3', g) +
    meta(c.foot, '--ink-3', g, { mt: 4 }));
}

function envDeep(g) {
  const c = COPY.deep;
  return nav('القراءة', g) + body(g,
    t(c.title, R.screenTitle, '--ink-1') +
    t(c.statement, R.statement, '--ink-1', { mt: 26, w: g.measure }) +
    t(c.section, R.sectionTitle, '--ink-1', { mt: 42, w: g.measure }) +
    c.paras.map((p, i) => t(p, R.body, '--ink-1', { mt: i === 0 ? 16 : 24, w: g.measure })).join('') +
    t(c.supporting, R.supporting, '--ink-2', { mt: 34, w: g.measure }) +
    /* The one element in the package that is cropped out of two different raster conditions
       and magnified side by side, so the A3.7 robustness question can be answered at pixel
       level rather than by eye. The attribute changes no geometry and is not part of the
       fairness fingerprint, which records tag, box and text length only. */
    meta(c.meta, '--ink-3', g, { mt: 16, rect: 'meta-tail' }));
}

/**
 * The boring screen.
 *
 * No dividers at all - WCAG 2.2 SC 1.4.11 does not require a visual boundary for a control
 * that already has visible content, so the structure is spacing.
 *
 * The unavailable row does not rely on tone alone to say it is unavailable: it also says so in
 * words and gives the reason. `fixing-accessibility` section 7, disabled states must not rely
 * on colour alone.
 */
function envUtil(g) {
  const c = COPY.util;
  const row = (r, i) => {
    const labelInk = r.disabled ? '--ink-3' : '--ink-1';
    const val = r.v
      ? `<span style="font-size:${R.supporting.size}px;line-height:${R.supporting.leading}px;` +
        `font-weight:${R.supporting.weight};color:var(--ink-${r.disabled ? '3' : '2'});letter-spacing:0;` +
        `${r.ltr ? 'direction:ltr;' : ''}">${esc(r.v)}</span>`
      : '';
    return `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:24px;` +
      `margin-top:${i === 0 ? 0 : 22}px;">` +
      `<span style="font-size:${R.body.size}px;line-height:${R.body.leading}px;font-weight:${R.body.weight};` +
      `color:var(${labelInk});letter-spacing:0;">${esc(r.l)}</span>${val}</div>` +
      (r.note ? meta(r.note, '--ink-3', g, { mt: 4 }) : '');
  };
  const group = (gr, i) =>
    `<div style="margin-top:${i === 0 ? 30 : 44}px;">` +
      t(gr.name, R.action, '--ink-3') +
      `<div style="margin-top:18px;">${gr.rows.map(row).join('')}</div>` +
    `</div>`;
  return nav('الإعدادات', g) + body(g,
    t(c.title, R.screenTitle, '--ink-1') +
    c.groups.map(group).join('') +
    meta(c.foot, '--ink-3', g, { mt: 42 }));
}

export const ENVIRONMENTS = {
  quiet: { key: 'quiet', n: 1, title: 'The Quiet Core',         sub: 'Personal Conversation World', build: envQuiet, mobile: true },
  map:   { key: 'map',   n: 2, title: 'The Proprietary World',  sub: 'Living Analysis Map',         build: envMap,   mobile: false },
  deep:  { key: 'deep',  n: 3, title: 'The Intellectual Test',  sub: 'Deep Analysis Reading',       build: envDeep,  mobile: true },
  util:  { key: 'util',  n: 4, title: 'The Boring-Screen Test', sub: 'Utility / System UI',         build: envUtil,  mobile: true },
};

/**
 * The only place a candidate enters the product. `vars` is the six-value colour block, of
 * which five are constants; every other argument is shared.
 *
 * The map is refused at the mobile geometry on purpose. Its node positions are a fixed
 * composition authored for an 848 px content width; re-laying it out for a 350 px column would
 * be a NEW design decision about how the Living Analysis Map behaves on a phone, and A3 has no
 * authority to make it. Refusing is the honest answer; improvising a phone map would not be.
 */
export function productFrame(envKey, vars, g = DESKTOP) {
  const env = ENVIRONMENTS[envKey];
  if (!env) throw new Error(`unknown environment ${envKey}`);
  if (g.key === 'mobile' && !env.mobile) {
    throw new Error(`environment ${envKey} has no mobile geometry - its layout is a fixed ` +
      `desktop composition and re-laying it out would be a new design decision, which A3 may not make`);
  }
  const block = Object.entries(vars).map(([k, v]) => `${k}:${v};`).join('');
  // direction is declared HERE, once, for the whole product region. The board chrome around it
  // is LTR English; without this the Arabic would inherit that and lay out backwards.
  return `<div data-qp-frame data-qp-rect="frame" style="${block}width:${g.frameW}px;` +
    `direction:rtl;text-align:right;background:var(--world);overflow:hidden;">${env.build(g)}</div>`;
}

/* ---------------------------------------------------------------- assertions --------- */

/**
 * The Glow-Off / Logo-Off / Card-Removal evidence, as a refusal rather than a claim.
 *
 * Run against the exact HTML that is about to be rasterised, so it cannot be satisfied by a
 * board that merely looks plain. Every pattern below is something the anti-generic contract
 * forbids, or something `frontend-design` and `impeccable` name as template chrome.
 */
const FORBIDDEN = [
  [/gradient/i,               'gradient'],
  [/box-shadow|text-shadow|drop-shadow/i, 'shadow'],
  [/backdrop-filter/i,        'glass / backdrop blur'],
  [/\bfilter\s*:/i,           'filter (glow, bloom, blur)'],
  [/\bblur\s*\(/i,            'blur'],
  [/border-radius\s*:\s*(?!0)/i, 'rounded container (card grammar)'],
  [/\bopacity\s*:\s*0?\.\d/i, 'partial opacity (produces an unmeasured composited colour)'],
  [/<img|<use|xlink:href/i,   'raster or referenced artwork (a logo could enter here)'],
  [/monospace|Consolas|Cascadia/i, 'monospace as a costume for "technical"'],
  [/text-transform\s*:\s*uppercase/i, 'tracked-out ALL-CAPS label'],
  [/letter-spacing\s*:\s*(?!0)/i, 'letter-spacing (banned outright on Arabic)'],
  [/·|&middot;|&#183;/,       'middle-dot meta string'],
  [/→|&rarr;/,                'arrow appended to a label'],
  [/\b(brass|gold|amber|lantern|glow|bloom|aura|halo)\b/i, 'brand-light or brass vocabulary'],
];

export function assertNoDecor(html, name) {
  const found = [];
  for (const [re, why] of FORBIDDEN) if (re.test(html)) found.push(why);
  if (found.length) {
    throw new Error(`${name}: PRODUCT REGION CONTAINS FORBIDDEN CONSTRUCTS - ${found.join('; ')}`);
  }
  return FORBIDDEN.length;
}

export const FORBIDDEN_COUNT = FORBIDDEN.length;
