/**
 * I-08B3.1-C2 — THE ONE PROOF IMPLEMENTATION.
 *
 * THE FAIRNESS CONTRACT IS ENFORCED BY STRUCTURE, NOT BY CARE.
 *
 * Every board that compares policies calls the SAME environment builder with the SAME content and
 * passes a different MATERIAL SET. There is no per-policy geometry, copy, spacing or scale anywhere
 * in this file — a policy has nothing to be given an advantage with. The policy reaches the page as
 * the paint of some SVGs and as nothing else.
 *
 * THREE THINGS ARE UNREACHABLE HERE, AND THEIR UNREACHABILITY IS THE POINT:
 *
 *   · BRASS ON THE ANALYTICAL PLANE. The Map's nodes and relation strokes read the frozen inks from
 *     the stylesheet. No parameter on `envMap` can put a material into them.
 *   · BRASS ON A FUNCTIONAL CONTROL. `policyMaterials` returns the functional material from one
 *     frozen neutral and has no branch that returns anything else.
 *   · BRASS ENCODING STATE. The five navigation icons are painted from ONE material for all five
 *     positions; there is no per-index material argument. Selection, focus, press and disabled are
 *     carried by the achromatic state carrier, which is CSS and is never passed a material.
 *
 * The one prohibited composition the brief asks for is built by `envMapProhibitedAccumulation`,
 * whose name says what it is, and `c2-preflight.mjs` asserts it is called only from the failure
 * captures.
 *
 * Everything else is carried unchanged from B1/B1R/B2/B2R/B3/B3R/C1/C1R because each guard was
 * earned by a defect that shipped silently: the `dir="ltr"` root with per-frame `dir="rtl"` (an RTL
 * root crops LEFT overflow out of the screenshot while `scrollWidth` reports nothing);
 * `flex-shrink:0` on row children; the three-weight font fingerprint (`document.fonts.check()`
 * returns true for a face that was never fetched); the horizontal extent reporter; and the unitless
 * line-height model.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PKG, PROJECT, WORLD, SURFACE, PRIMARY, SECONDARY, TERTIARY, ROLES, COPY,
  MARK, MARK_VB, MARK_PATH_IDS, ICONS, FUNCTIONAL_ICONS, ICON_STROKE, CHARACTER, GRAIN_MIN_PX,
  STATE_CARRIER, solveNeutral, MARK_PX_IN_MACHINERY, IDENTITY_PX, NAV_PX,
  NAV_NEUTRAL, FUNCTIONAL_NEUTRAL, policyBrassClasses, RESOLVED, characterShade,
} from './c2-model.mjs';
import { setFontProbe } from './c2-render.mjs';

/**
 * Estedad v8.5 — REFERENCED, NEVER REDISTRIBUTED.
 *
 * The brief is explicit that font binaries must not be shipped. The face is therefore an explicitly
 * documented LOCAL RUNTIME DEPENDENCY: the package records the required version and the exact
 * SHA-256 of the file it embeds at render time, and the preflight HASHES the file it is about to use
 * rather than trusting the path. This host carries two files called `Estedad[wght].ttf` and only one
 * of them is v8.5, which is why trusting the path would not be good enough.
 */
export const TTF = join(PROJECT, '.i08b3-work', 'raw', 'estedad-v8.5', 'Estedad-v8.5', 'Estedad[wght].ttf');
export const TTF_SHA = '3134e31a27d58e615967e714c7799fbfa2de952876f8597b33dc57ffe0e99d03';
export const TTF_VERSION = 'Estedad v8.5 (variable, wght 100–900)';

export const BENCH = { bg: '#333333', ink: '#e8e8e8', dim: '#a8a8a8', faint: '#8a8a8a', rule: '#4a4a4a' };
/**
 * SINGLE QUOTES, DELIBERATELY.
 *
 * This constant is interpolated both into <style> blocks and into inline `style="..."` attributes.
 * With the double-quoted form it inherits from C1R, the first inner quote ENDS the attribute: the
 * element loses its entire style, its text falls back to the black default, and on a dark bench it
 * becomes invisible without any error. That is precisely what happened, and the blank-render guard
 * is what caught it — an inline style attribute cannot contain a double quote, so the font stack
 * does not use one.
 */
export const CHROME_FACE = `ui-sans-serif, 'Segoe UI', system-ui, sans-serif`;

let _b64 = null;
export function faceCSS() {
  if (_b64 === null) _b64 = readFileSync(TTF).toString('base64');
  return `@font-face{font-family:"QP-Estedad";font-style:normal;font-weight:100 900;font-display:block;src:url("data:font/ttf;base64,${_b64}") format("truetype");}`;
}

export const FONT_PROBE = {
  text: 'اللي بيتكرر هنا مش مجرد تردد قبل الاختيار',
  px: 100, weights: [400, 500, 600],
  expected: [1695.5, 1702.31, 1706.5], tol: 1.0, fallbackSeen: 1386.58,
};
setFontProbe(FONT_PROBE);

export const FONT_GUARD_HTML =
  `<div style="position:fixed;top:0;left:0;width:1px;height:1px;overflow:hidden;visibility:hidden;direction:ltr;">` +
  FONT_PROBE.weights.map((w) =>
    `<span class="qp-fp" data-w="${w}" style="position:absolute;top:0;left:0;white-space:pre;font:${w} ${FONT_PROBE.px}px 'QP-Estedad'">${FONT_PROBE.text}</span>`
  ).join('') + `</div>`;

/** THE REPORTER. No template-literal interpolation may appear anywhere inside this string. */
export const REPORTER = `<script>addEventListener('load',()=>{
const d=document.documentElement,H=document.head;
const add=(n,v)=>{const m=document.createElement('meta');m.name=n;m.content=String(v);H.appendChild(m);};
add('qp-height',Math.ceil(document.body.scrollHeight||d.scrollHeight));
add('qp-viewport',Math.ceil(d.clientWidth));
add('qp-dpr',String(devicePixelRatio));
const fp=[...document.querySelectorAll('.qp-fp')].map(e=>Math.round(e.getBoundingClientRect().width*100)/100);
add('qp-font',fp.join(','));
/* HORIZONTAL EXTENT GUARD. document.body.scrollWidth does NOT grow when content overflows to the
   LEFT, so with an RTL root a too-wide board hangs off the left edge, is cropped out of the
   screenshot, and nothing reports it. The root is dir="ltr" and every painted element's true extent
   is reported so the renderer can refuse anything outside the board. */
let mnL=0,mxR=0,mnE='',mxE='';
const desc=(e)=>e.tagName+(e.className&&e.className.baseVal===undefined?'.'+String(e.className).split(' ').join('.'):'')+'["'+(e.textContent||'').trim().slice(0,28)+'"]';
for(const e of document.querySelectorAll('.board, .board *, .qf, .qf *')){
  const r=e.getBoundingClientRect();
  if(r.width<=0&&r.height<=0) continue;
  if(r.left<mnL){mnL=r.left;mnE=desc(e);}
  if(r.right>mxR){mxR=r.right;mxE=desc(e);}
}
add('qp-minleft',Math.floor(mnL));
add('qp-maxright',Math.ceil(mxR));
add('qp-minleft-el',mnE);
add('qp-maxright-el',mxE);
for(const e of document.querySelectorAll('[data-qp-rect]')){
  const r=e.getBoundingClientRect();
  add('qp-rect-'+e.getAttribute('data-qp-rect'),
      [Math.round(r.left),Math.round(r.top+scrollY),Math.round(r.width),Math.round(r.height)].join(','));
}
/* THE FAIRNESS FINGERPRINT. Every box inside a frame, measured RELATIVE TO THAT FRAME'S OWN ORIGIN,
   with its text length and WITHOUT ANY COLOUR. Two frames that differ only in paint produce
   identical strings. */
const fingerprint=(host)=>{
  const hr=host.getBoundingClientRect(); const g=[];
  for(const e of host.querySelectorAll('*')){
    if(e.classList&&e.classList.contains('qp-nofp')) continue;
    const sv=e.closest('svg'); if(sv&&sv!==e) continue;
    const r=e.getBoundingClientRect();
    g.push(e.tagName+':'+Math.round(r.left-hr.left)+','+Math.round(r.top-hr.top)+','
      +Math.round(r.width)+','+Math.round(r.height)
      +':'+(e.children.length?'':(e.textContent||'').trim().length));
  }
  return g.join('|');
};
const FRAMES=[...document.querySelectorAll('[data-qp-frame]')];
add('qp-frames',FRAMES.length);
add('qp-geo',FRAMES.map(fingerprint).join('#'));
});</script>`;

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ================================================================ THE MATERIAL ============ */

/**
 * A MATERIAL is the only thing that varies between the frames of a comparison.
 *
 * THE SCALE RULE IS APPLIED HERE AND NOWHERE ELSE, so it cannot be forgotten at a call site. A
 * caller asks for the material at 24 px and gets the quiet satin body with no character — not
 * because the caller remembered, but because `material()` will not emit one. This is the mechanism
 * that makes "ONE system with two scale expressions" true rather than aspirational.
 */
export function material(resolved, { widthPx, characterHex = null, forceCharacter = null } = {}) {
  const allowed = forceCharacter === null ? widthPx >= GRAIN_MIN_PX : forceCharacter;
  return {
    key: resolved.key,
    bodyHex: resolved.body.hex,
    characterHex: allowed ? characterHex : null,
    characterOn: !!(allowed && characterHex),
    characterSuppressed: !!(!allowed && characterHex),
  };
}

/** A neutral "material" — every non-Brass mark, and every Brass-removal control. Never an accent. */
export const neutralMaterial = (hex) => ({
  key: 'NEUTRAL', bodyHex: hex, characterHex: null, characterOn: false, characterSuppressed: false,
});

/**
 * THE POLICY BECOMES PAINT HERE, AND ONLY HERE.
 *
 * Returns the four materials an environment builder needs. Two of them can be Brass; two of them
 * CANNOT, under any argument. `functional` is built from one frozen neutral with no branch, and
 * there is no `analytical` material at all, because the analytical plane is painted by the frozen
 * stylesheet and takes no material.
 *
 * `removal` replaces Brass with the rank standing machinery would carry if the material did not
 * exist. `neutraliseTo` lets C2.11 substitute the luminance-matched neutral instead, which is a
 * different question and is asked separately.
 */
export function policyMaterials(policyKey, {
  brass = RESOLVED, characterHex = null, removeBrass = false, neutraliseTo = null,
} = {}) {
  const cls = policyBrassClasses(policyKey);
  const sub = neutraliseTo || (removeBrass ? SECONDARY : null);
  const brassAt = (px, character) => (sub
    ? neutralMaterial(sub)
    : material(brass, { widthPx: px, characterHex: character }));
  return {
    policy: policyKey,
    mark: cls.identityMark ? brassAt(MARK_PX_IN_MACHINERY, null) : neutralMaterial(SECONDARY),
    identity: cls.identityMark ? brassAt(IDENTITY_PX, characterHex) : neutralMaterial(SECONDARY),
    nav: cls.navFamily ? brassAt(NAV_PX, null) : neutralMaterial(NAV_NEUTRAL),
    functional: neutralMaterial(FUNCTIONAL_NEUTRAL),
  };
}

/* ------------------------------------------------------------------ the mark ------------- */

let _uid = 0;
const uid = (p) => `${p}${++_uid}`;

/**
 * THE APPROVED QANDEEL Q, PAINTED IN A MATERIAL.
 *
 * The three path strings come from `c2-model.mjs`, which reads them out of the PACKAGE-LOCAL
 * exact-byte snapshot of the approved production master. Nothing here redraws, re-rounds or
 * re-orders them, and no policy gets its own copy.
 *
 * TWO BRANCHES, AND ONLY TWO. The quiet satin body, and the same body carrying the character. There
 * is no third branch, because there is no third expression: D-2 is retired and no highlight, second
 * tone, gradient, bevel or ramp exists to be reached for.
 *
 * `data-role` is what makes the coverage-delta guard possible: it lets a guard say "the objects
 * whose paint changed between these two frames are exactly the navigation family" instead of
 * "something somewhere changed".
 */
export function markSVG(m, { px, cls = '', title = '', rectId = null, role = 'identity-mark' } = {}) {
  const [vx, vy, vw, vh] = MARK_VB;
  const h = Math.round((px * vh) / vw);
  const id = uid('m');
  const [R, T, K] = MARK_PATH_IDS.map((k) => MARK.paths[k]);

  let defs = '';
  let paint;

  if (m.characterHex) {
    defs = `<clipPath id="cpm${id}"><path d="${R}"/><path d="${T}"/><path d="${K}"/></clipPath>` +
      `<filter id="gr${id}" x="${vx}" y="${vy}" width="${vw}" height="${vh}" ` +
      `filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${CHARACTER.fx} ${CHARACTER.fy}" ` +
      `numOctaves="${CHARACTER.numOctaves}" seed="${CHARACTER.seed}" result="t"/>` +
      /* Take the turbulence's RED channel into ALPHA under one linear map. One channel, one scale,
         one bias, no transfer curve — so the delivered amplitude is a product of two numbers.
         THE X FREQUENCY IS AN ELEVENTH OF THE Y FREQUENCY: that anisotropy is the whole of the
         "directional" in directional material character. */
      `<feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  ` +
      `${CHARACTER.alphaK} 0 0 0 ${CHARACTER.alphaBias}" result="a"/>` +
      `<feFlood flood-color="${m.characterHex}" result="f"/>` +
      `<feComposite in="f" in2="a" operator="in"/></filter>`;
    paint = `<g clip-path="url(#cpm${id})">` +
      `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${m.bodyHex}"/>` +
      `<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="none" filter="url(#gr${id})"/></g>`;
  } else {
    paint = `<path d="${R}" fill="${m.bodyHex}"/><path d="${T}" fill="${m.bodyHex}"/>` +
      `<path d="${K}" fill="${m.bodyHex}"/>`;
  }

  return `<svg class="qmark ${cls}" data-mat data-role="${role}"${rectId ? ` data-qp-rect="${rectId}"` : ''} ` +
    `width="${px}" height="${h}" viewBox="${MARK.viewBox}" ` +
    `fill-rule="nonzero" xmlns="http://www.w3.org/2000/svg" role="img"${title ? ` aria-label="${esc(title)}"` : ' aria-hidden="true"'}>` +
    (defs ? `<defs>${defs}</defs>` : '') + paint + `</svg>`;
}

/**
 * A NAVIGATION ICON, PAINTED IN A MATERIAL.
 *
 * Stroke-built, so the material is carried by a LINE rather than by an area — the harder and the
 * more honest case, because a hairline is where a body is least able to be a body. C1R established
 * that BODY C can deliver here; C2 asks whether it SHOULD.
 *
 * There is no per-index material parameter, which is how "Brass NEVER turns on because an item is
 * selected" is implemented rather than promised.
 */
export function iconSVG(icon, m, { px = NAV_PX, cls = '', role = 'nav' } = {}) {
  const dots = icon.dots.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.55" fill="${m.bodyHex}"/>`).join('');
  return `<svg class="qicon ${cls}" data-mat data-role="${role}" width="${px}" height="${px}" viewBox="0 0 24 24" ` +
    `xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
    `<path d="${icon.d}" fill="none" stroke="${m.bodyHex}" stroke-width="${ICON_STROKE}" ` +
    `stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg>`;
}

/**
 * A FUNCTIONAL CONTROL'S ICON — an interior control, never identity-bearing.
 *
 * It is a material-bearing object like any other so that the coverage-delta guard can SEE it and
 * confirm it did not change between the policies. An object that is neutral because no board draws
 * it is not evidence; an object that is drawn everywhere and measurably never Brass is.
 */
export function funcIconSVG(d, m, { px = 20, flip = false } = {}) {
  return `<svg class="qfunc" data-mat data-role="functional" width="${px}" height="${px}" viewBox="0 0 24 24" ` +
    `xmlns="http://www.w3.org/2000/svg" aria-hidden="true"${flip ? ' style="transform:scaleX(-1);"' : ''}>` +
    `<path d="${d}" fill="none" stroke="${m.bodyHex}" stroke-width="1.6" ` +
    `stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** The forward chevron for a row. RTL forward is LEFT, so the glyph points left. */
export const CHEVRON_D = 'M14.5 6 L8.5 12 L14.5 18';

/**
 * THE SWAP MARK. C2.8/C2.9 change copy AND product mark and nothing else, so the swapped
 * compositions need a mark that is emphatically NOT the QANDEEL Q while occupying exactly the same
 * box. A plain ring with a bar, and a rounded square with a tick, are about as generic as marks get,
 * which is what the test wants.
 */
export function swapMarkSVG(m, { px, kind = 'luxury', role = 'identity-mark' } = {}) {
  const [, , vw, vh] = MARK_VB;
  const h = Math.round((px * vh) / vw);
  const body = kind === 'luxury'
    ? `<circle cx="855" cy="548" r="430" fill="none" stroke="${m.bodyHex}" stroke-width="86"/>` +
      `<rect x="812" y="250" width="86" height="596" fill="${m.bodyHex}"/>`
    : `<rect x="470" y="163" width="770" height="770" rx="150" fill="none" stroke="${m.bodyHex}" stroke-width="86"/>` +
      `<path d="M640 548 L790 698 L1070 418" fill="none" stroke="${m.bodyHex}" stroke-width="86" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg class="qmark" data-mat data-role="${role}" width="${px}" height="${h}" viewBox="${MARK.viewBox}" ` +
    `xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}

/* ================================================================ BOARD CHROME ============ */

export const boardCSS = `
*{margin:0;padding:0;box-sizing:border-box;}
html,body{background:${BENCH.bg};}
body{font-family:"QP-Estedad";-webkit-text-size-adjust:none;}
.board{padding:34px 38px 40px;direction:ltr;text-align:left;}
.board-h{border-bottom:1px solid ${BENCH.rule};padding-bottom:15px;margin-bottom:26px;}
.board-h h1{font-family:${CHROME_FACE};font-size:17px;font-weight:600;color:${BENCH.ink};}
.board-h p{font-family:${CHROME_FACE};font-size:12.5px;line-height:1.65;color:${BENCH.dim};margin-top:8px;max-width:1240px;}
.cap{font-family:${CHROME_FACE};font-size:11px;font-weight:600;color:${BENCH.ink};margin-bottom:9px;}
.cap2{font-family:${CHROME_FACE};font-size:10.5px;color:${BENCH.dim};margin-bottom:8px;line-height:1.5;}
.capbox{min-height:58px;}
.note{font-family:${CHROME_FACE};font-size:11.5px;line-height:1.62;color:${BENCH.dim};margin-top:14px;max-width:1240px;}
.spec{font-family:${CHROME_FACE};font-size:10px;color:${BENCH.faint};margin-top:7px;line-height:1.55;}
.row{display:flex;gap:26px;align-items:flex-start;flex-wrap:nowrap;}
.row > *{flex-shrink:0;}
.sect{margin-top:34px;}
.board p{direction:rtl;text-align:right;letter-spacing:0;}
.board-h p{direction:ltr;text-align:left;}
table.t{border-collapse:collapse;font-family:${CHROME_FACE};font-size:11px;color:${BENCH.ink};}
table.t th{text-align:left;font-weight:600;color:${BENCH.dim};padding:6px 15px 6px 0;border-bottom:1px solid ${BENCH.rule};white-space:nowrap;font-size:10px;}
table.t td{text-align:left;padding:6px 15px 6px 0;border-bottom:1px solid #3d3d3d;white-space:nowrap;}
.mono{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;}
.rowlb{font-family:${CHROME_FACE};font-size:11px;font-weight:600;color:${BENCH.ink};
       width:180px;padding-top:2px;line-height:1.5;}
.rowlb span{display:block;font-weight:400;color:${BENCH.faint};font-size:10px;margin-top:5px;}
.spec-tile{background:${WORLD};display:flex;align-items:center;justify-content:center;}
.spec-tile.onsurf{background:${SURFACE};}
`;

export const head = (t, s) => `<div class="board-h"><h1>${t}</h1><p>${s}</p></div>`;
export const cap = (t) => `<div class="cap">${t}</div>`;
export const cap2 = (t) => `<div class="cap2">${t}</div>`;

/* ============================================================ THE PRODUCT FRAME =========== */

const R = (k) => `font-size:${ROLES[k].size}px;line-height:${ROLES[k].leading / ROLES[k].size};font-weight:${ROLES[k].weight};letter-spacing:0;`;

export const FRAME = { mobile: { w: 390, h: 844 } };

/** Achromatic structural lines, solved against the ground each sits on. NOT tokens. */
export const EDGE_ON_SURFACE = solveNeutral(SURFACE, 3.0).hex;
export const HAIRLINE_ON_WORLD = '#2a2a2a';

export const frameCSS = `
.qf{position:relative;overflow:hidden;background:${WORLD};display:flex;flex-direction:column;
    direction:rtl;text-align:right;font-family:"QP-Estedad";color:${PRIMARY};}
.qf *{letter-spacing:0;}
.qmark,.qicon,.qfunc{display:block;}

/* -------------------------------------------------------------------- APPARATUS ---------- */
/* Standing machinery along the frame's edge, outside the content plane. One of B0's four frozen
   roles, painted with the frozen Surface. Position and adjacency tell it apart — not a tone step,
   not a shadow, not a radius. IDENTICAL IN ALL FOUR ENVIRONMENTS, which is what makes the
   cross-environment board a comparison of coverage rather than of four different designs. */
.qf-app{background:${SURFACE};flex:0 0 auto;position:relative;z-index:3;}
.qf-app .r1{min-height:56px;display:flex;align-items:center;gap:12px;padding:12px 16px 10px;}
.qf-app .r1 .t{${R('screenTitle')};color:${PRIMARY};margin-inline-end:auto;white-space:nowrap;}
.qf-app .r2{display:flex;align-items:center;gap:18px;padding:0 16px 12px;${R('metadata')};color:${SECONDARY};}
.qf-chev{margin-inline-start:6px;width:5px;height:5px;border-left:1.5px solid ${SECONDARY};
         border-bottom:1.5px solid ${SECONDARY};transform:rotate(45deg);display:inline-block;}

/* ------------------------------------------------- the analytical plane: THE MAP --------- */
/* The plane IS the World. Nodes are objects in a geography: no fill, no border, no radius, no card.
   Depth is carried by TYPE ROLE and by ink rank, and by nothing else. THE MAP IS NEUTRAL IN EVERY
   PRIMARY BOARD IN THIS PACKAGE, and there is no builder parameter that can change that. */
.mp-plane{position:relative;z-index:1;flex:1 1 auto;min-height:0;overflow:hidden;}
.mp-geo{position:absolute;top:22px;bottom:16px;right:26px;left:26px;}
.mp-rel{position:absolute;inset:0;width:100%;height:100%;overflow:visible;}
.mp-node{position:absolute;transform:translate(50%,-50%);white-space:nowrap;}
.mp-node.near{${R('sectionTitle')};color:${PRIMARY};}
.mp-node.mid{${R('supporting')};color:${SECONDARY};}
.mp-node.far{${R('metadata')};color:${TERTIARY};}
.mp-meta{flex:0 0 auto;height:38px;display:flex;align-items:center;gap:18px;padding:0 16px;
         ${R('metadata')};color:${TERTIARY};}

/* -------------------------------------------------------- analytical entries ------------- */
.wk-plane{position:relative;z-index:1;flex:0 0 auto;padding:4px 16px 14px;}
.wk-e{margin-bottom:14px;}
.wk-e:last-child{margin-bottom:0;}
.wk-e .t{${R('sectionTitle')};color:${PRIMARY};}
.wk-e .s{${R('supporting')};color:${SECONDARY};margin-top:4px;}
.wk-e .m{${R('metadata')};color:${TERTIARY};margin-top:6px;display:flex;gap:16px;}

/* ------------------------------------------------------- ENV 1: THE CONVERSATION --------- */
/* No bubbles and no cards. The two voices are told apart by ink rank, by type role and by inset —
   the same three devices B0's hierarchy already uses everywhere else. The World stays dominant
   because nothing is drawn on top of it. */
/* Turns are anchored to the BOTTOM, against the composer, because that is where a conversation
   actually sits and an empty screen with six messages floating at the top is a mock-up rather than
   a Product. It also makes the test harder, not easier: it puts the newest turn as close to the
   navigation as it will ever be. */
.cv-plane{flex:1 1 auto;min-height:0;overflow:hidden;padding:18px 16px 4px;
          display:flex;flex-direction:column;justify-content:flex-end;}
.cv-t{margin-bottom:17px;}
.cv-t.you{padding-inline-start:46px;${R('supporting')};color:${SECONDARY};}
.cv-t.q{${R('body')};color:${PRIMARY};}
.cv-comp{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:12px 16px 14px;
         border-top:1px solid ${HAIRLINE_ON_WORLD};}
.cv-comp .ph{${R('body')};color:${TERTIARY};margin-inline-end:auto;}

/* --------------------------------------------------------- ENV 3: THE DEEP READING ------- */
/* Reading sits DIRECTLY ON THE WORLD. No container, no card, no tinted plane. The divider and the
   pulled line are both achromatic, and there is no builder parameter that can make either of them
   a material — which is the whole of "Brass must not become heading, quote or divider colour". */
.rd-plane{flex:1 1 auto;min-height:0;overflow:hidden;padding:20px 16px 4px;}
.rd-h1{${R('compactStmt')};color:${PRIMARY};}
.rd-lede{${R('supporting')};color:${TERTIARY};margin-top:8px;}
.rd-rule{height:1px;background:${HAIRLINE_ON_WORLD};margin:20px 0 16px;}
.rd-p{${R('body')};color:${PRIMARY};margin-top:14px;}
.rd-h2{${R('sectionTitle')};color:${PRIMARY};}
/* The rule sits on the START edge - the RIGHT, in Arabic. A logical inline-start property rather
   than a hand-picked side, so it follows the writing direction instead of a guess about it.
   NOTE: this comment lives inside a template literal - no backticks may appear in it. */
.rd-q{${R('compactStmt')};color:${SECONDARY};margin:18px 0 4px;
      border-inline-start:2px solid ${HAIRLINE_ON_WORLD};padding-inline-start:14px;}

/* ------------------------------------------------------------- ENV 4: THE UTILITY -------- */
/* Rows on the World, separated by hairlines. NOT card soup: nothing is contained, nothing has a
   fill, nothing has a radius. Every row's chevron is a FUNCTIONAL control and is neutral under both
   policies — which is the point of drawing eleven of them. */
.ut-plane{flex:1 1 auto;min-height:0;overflow:hidden;padding:6px 0 0;}
.ut-sec{margin-top:14px;}
.ut-sec:first-child{margin-top:4px;}
.ut-h{${R('metadata')};color:${TERTIARY};padding:0 16px 6px;}
.ut-r{display:flex;align-items:center;gap:12px;padding:11px 16px;
      border-top:1px solid ${HAIRLINE_ON_WORLD};}
.ut-r .l{${R('body')};color:${PRIMARY};margin-inline-end:auto;}
.ut-r .v{${R('supporting')};color:${TERTIARY};white-space:nowrap;}

/* ---------------------------------------------------------------- THE TAB BAR ------------ */
/* APPARATUS again: standing machinery along the opposite edge. Same Surface, same role, no second
   tone, no elevation step, no shadow. THE ONE PLACE P1 AND P2 DIFFER.
   NOTE: this comment lives inside a template literal - no backticks may appear in it. */
.qf-tabs{background:${SURFACE};flex:0 0 auto;position:relative;z-index:3;display:flex;
         padding:0 4px 10px;border-top:1px solid ${EDGE_ON_SURFACE};}
.qf-tab{flex:1 1 0;display:flex;flex-direction:column;align-items:center;gap:5px;
        padding:10px 2px 2px;position:relative;}
.qf-tab .lb{${R('metadata')};white-space:nowrap;}
/* THE DIAGNOSTIC STATE CARRIER — achromatic, held identical under both policies, and NOT a final
   interaction colour. Selected: PRIMARY ink at weight 600 plus a 2 px achromatic rule on the item's
   own top edge. It is legible in greyscale because both halves are luminance. Under P2 the icon is
   Brass at EVERY state, so nothing here reads the material at all. */
.qf-tab .lb{color:${STATE_CARRIER.restInk};font-weight:${STATE_CARRIER.restWeight};}
.qf-tab.sel .lb{color:${STATE_CARRIER.selectedInk};font-weight:${STATE_CARRIER.selectedWeight};}
.qf-tab.sel::before{content:"";position:absolute;top:-1px;right:14px;left:14px;
                    height:${STATE_CARRIER.ruleThickness}px;background:${PRIMARY};}
/* Focused: an achromatic ring, 2 CSS px because SC 2.4.13 is an AREA criterion. A box-shadow and not
   an outline or a border, so ring / no ring cannot move a single laid-out box. */
.qf-tab.foc{box-shadow:0 0 0 2px ${PRIMARY};border-radius:8px;}
/* Pressed: a DIAGNOSTIC achromatic wash. Not a second Surface tone and not a status colour. */
.qf-tab.prs{background:rgba(255,255,255,0.07);border-radius:8px;}
/* Disabled: the neutral ink drops. THE MATERIAL DOES NOT CHANGE, which is the condition stated as
   code rather than as a promise. C2 does not solve the known disabled styling issue; see the
   findings, where it is recorded as a dependency for E. */
.qf-tab.dis .lb{color:${STATE_CARRIER.disabledInk};}

/* --------------------------------------------------------------- identity moment --------- */
.qf-ident{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;align-items:center;
          justify-content:center;gap:26px;padding:40px 24px;}
.qf-ident .w{${R('compactStmt')};color:${SECONDARY};text-align:center;}
`;

/* ------------------------------------------------------------------ builders ------------- */

const chev = `<span class="qf-chev"></span>`;

/**
 * The standing machinery. IDENTICAL across all four environments, by construction.
 *
 * `id` names this frame's measurement hooks. Detail crops must be taken from the raster the board
 * actually produced — re-rendering a tab strip on its own would show a DIFFERENT set of pixels and
 * quietly answer a different question — so every frame carries hooks the measurement pass can find
 * its own regions by. The hook values are normalised away by guards 2 and 3.
 */
function apparatus(mats, { title, period, order, swap = null, id = 'x' }) {
  const markHTML = swap
    ? swapMarkSVG(mats.mark, { px: MARK_PX_IN_MACHINERY, kind: swap })
    : markSVG(mats.mark, { px: MARK_PX_IN_MACHINERY });
  return `<div class="qf-app" data-qp-rect="app-${id}"><div class="r1">` +
    markHTML + `<div class="t">${esc(title)}</div></div>` +
    `<div class="r2"><span>${esc(period)}${chev}</span><span>${esc(order)}</span></div></div>`;
}

/**
 * THE PERSISTENT NAVIGATION FAMILY. ONE material for all five positions, at every state.
 *
 * There is no per-index material argument and there cannot be one: that absence is how "ALL members
 * of that family carry the same Brass regardless of state" is implemented. The state classes are
 * applied to the tab, not to the icon.
 */
function tabs(mats, { selected = 0, focus = null, pressed = null, disabled = null } = {}, id = 'x') {
  return `<div class="qf-tabs" data-qp-rect="tabs-${id}">` + ICONS.map((ic, i) => {
    const cls = [i === selected ? 'sel' : '', i === focus ? 'foc' : '',
      i === pressed ? 'prs' : '', i === disabled ? 'dis' : ''].filter(Boolean).join(' ');
    return `<div class="qf-tab ${cls}">${iconSVG(ic, mats.nav)}` +
      `<span class="lb">${esc(ic.label)}</span></div>`;
  }).join('') + `</div>`;
}

const meta = (a, b) => `<div class="mp-meta"><span>${esc(a)}</span><span>${esc(b)}</span></div>`;

const frameOpen = () => `<div class="qf" dir="rtl" lang="ar-EG" data-qp-frame ` +
  `style="width:${FRAME.mobile.w}px;height:${FRAME.mobile.h}px;">`;

/* ------------------------------------------------ ENV 2 — THE LIVING ANALYSIS MAP -------- */

/**
 * The proprietary world. THE ANALYTICAL PLANE IS NEUTRAL AND HAS NO MATERIAL PARAMETER.
 *
 * `identity` swaps the Map for the one legitimate large identity moment — the composition where the
 * analysis has not finished assembling. That screen exists whether or not C2 exists; nothing about
 * it was invented to flatter a texture, and the machinery mark is NOT enlarged to reach the
 * character's threshold, which would be the prohibited rescue.
 */
export function envMap({ mats, copy = COPY.map, state = {}, swap = null, identity = false,
  identityLine = COPY.identity.line, id = 'x', nodeLimit = null } = {}) {
  /* `nodeLimit` exists for ONE test — C2.2's ANALYTICAL NULL TEST, which needs the same Product
     carrying different amounts of analysis. It changes only how much analytical content is present
     and can never change its colour. */
  const nodes = nodeLimit === null ? copy.nodes : copy.nodes.slice(0, nodeLimit);
  const edges = copy.edges.filter(([a, b]) => a < nodes.length && b < nodes.length);
  const lines = edges.map(([a, b]) => {
    const p = nodes[a], q = nodes[b];
    return `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="${TERTIARY}" ` +
      `stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  }).join('');
  const map = `<div class="mp-plane" data-qp-rect="content-${id}"><div class="mp-geo">` +
    `<svg class="mp-rel" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>` +
    nodes.map((n) => `<div class="mp-node ${n.depth}" style="right:${n.x}%;top:${n.y}%;">${esc(n.t)}</div>`).join('') +
    `</div></div>` + meta(copy.provenance, copy.updated);

  const plane = `<div class="wk-plane">` + copy.entries.map((e) =>
    `<div class="wk-e"><div class="t">${esc(e.t)}</div><div class="s">${esc(e.s)}</div>` +
    `<div class="m">${e.m.map((x) => `<span>${esc(x)}</span>`).join('')}</div></div>`).join('') + `</div>`;

  const identMark = swap
    ? swapMarkSVG(mats.identity, { px: IDENTITY_PX, kind: swap, role: 'identity-moment' })
    : markSVG(mats.identity, { px: IDENTITY_PX, role: 'identity-moment', rectId: `ident-${id}` });
  const ident = `<div class="qf-ident" data-qp-rect="content-${id}">` + identMark +
    `<div class="w">${esc(identityLine)}</div></div>` + meta(copy.provenance, copy.updated);

  return frameOpen() + apparatus(mats, { ...copy, swap, id }) +
    (identity ? ident : map + plane) + tabs(mats, state, id) + `</div>`;
}

/* ------------------------------------------- ENV 1 — THE PERSONAL CONVERSATION WORLD ----- */

export function envConversation({ mats, copy = COPY.conversation, state = {}, swap = null, id = 'x' } = {}) {
  const turns = `<div class="cv-plane" data-qp-rect="content-${id}">` + copy.turns.map((t) =>
    `<div class="cv-t ${t.who}">${esc(t.t)}</div>`).join('') + `</div>`;
  /* FLIPPED: forward in Arabic is LEFT. An SVG path does not mirror itself inside an RTL container,
     so a send arrow drawn pointing right stays pointing right and quietly means "back". */
  const comp = `<div class="cv-comp"><span class="ph">${esc(copy.composer)}</span>` +
    funcIconSVG(FUNCTIONAL_ICONS.send, mats.functional, { px: 22, flip: true }) + `</div>`;
  return frameOpen() + apparatus(mats, { ...copy, swap, id }) + turns + comp +
    tabs(mats, state, id) + `</div>`;
}

/* ------------------------------------------------ ENV 3 — THE DEEP ANALYSIS READING ------ */

export function envReading({ mats, copy = COPY.reading, state = {}, swap = null, id = 'x' } = {}) {
  const blocks = copy.blocks.map((b) => {
    if (b.k === 'h') return `<div class="rd-rule"></div><div class="rd-h2">${esc(b.t)}</div>`;
    if (b.k === 'q') return `<div class="rd-q">${esc(b.t)}</div>`;
    return `<div class="rd-p">${esc(b.t)}</div>`;
  }).join('');
  const plane = `<div class="rd-plane" data-qp-rect="content-${id}"><div class="rd-h1">${esc(copy.title)}</div>` +
    `<div class="rd-lede">${esc(copy.lede)}</div>${blocks}</div>`;
  return frameOpen() +
    apparatus(mats, { title: copy.appTitle, period: copy.appPeriod, order: copy.appOrder, swap, id }) +
    plane + meta(copy.provenance, copy.updated) + tabs(mats, state, id) + `</div>`;
}

/* ----------------------------------------------------- ENV 4 — THE UTILITY / SYSTEM UI --- */

export function envUtility({ mats, copy = COPY.utility, state = {}, swap = null, id = 'x' } = {}) {
  const secs = copy.sections.map((s) =>
    `<div class="ut-sec"><div class="ut-h">${esc(s.h)}</div>` + s.rows.map((r) =>
      `<div class="ut-r"><span class="l">${esc(r.l)}</span>` +
      (r.v ? `<span class="v">${esc(r.v)}</span>` : '') +
      funcIconSVG(CHEVRON_D, mats.functional, { px: 18 }) + `</div>`).join('') + `</div>`).join('');
  return frameOpen() + apparatus(mats, { ...copy, swap, id }) +
    `<div class="ut-plane" data-qp-rect="content-${id}">${secs}</div>` + meta(copy.provenance, copy.updated) +
    tabs(mats, state, id) + `</div>`;
}

export const ENV_BUILDERS = {
  conversation: envConversation, map: envMap, reading: envReading, utility: envUtility,
};

/* ================================================== THE PROHIBITED COMPOSITION ============ */

/**
 * C2.14 — THE ANTI-ACCUMULATION FAILURE CAPTURE. A FAILURE CAPTURE AND NOTHING ELSE.
 *
 * Brass identity mark + Brass navigation + Brass functional controls + Brass dividers + a Brass
 * analytical mark, all at once. This composition is PROHIBITED by the material story: three of
 * those five have no identity permission at all, and the fifth is on the analytical plane, where
 * Brass may never go.
 *
 * It is built by a separate function rather than by a flag on `envMap` for one reason: a flag can be
 * passed by accident, and a function with this name cannot. `c2-preflight.mjs` asserts that the only
 * caller is `c2-boards.mjs`'s failure section, so the prohibited composition cannot drift into a
 * primary board while nobody is looking.
 */
export function envMapProhibitedAccumulation({ brassHex, copy = COPY.map, state = {} } = {}) {
  const b = neutralMaterial(brassHex);
  const mats = { mark: b, identity: b, nav: b, functional: b };
  const lines = copy.edges.map(([a, bb]) => {
    const p = copy.nodes[a], q = copy.nodes[bb];
    return `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="${brassHex}" ` +
      `stroke-width="1" vector-effect="non-scaling-stroke"/>`;
  }).join('');
  const map = `<div class="mp-plane"><div class="mp-geo">` +
    `<svg class="mp-rel" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>` +
    copy.nodes.map((n, i) => `<div class="mp-node ${n.depth}" style="right:${n.x}%;top:${n.y}%;` +
      (i === 0 ? `color:${brassHex};` : '') + `">${esc(n.t)}</div>`).join('') +
    `</div></div>` + meta(copy.provenance, copy.updated);
  const plane = `<div class="wk-plane">` + copy.entries.map((e) =>
    `<div class="wk-e" style="border-top:1px solid ${brassHex};padding-top:10px;">` +
    `<div class="t">${esc(e.t)}</div><div class="s">${esc(e.s)}</div>` +
    `<div class="m">${e.m.map((x) => `<span>${esc(x)}</span>`).join('')}</div></div>`).join('') + `</div>`;
  const app = `<div class="qf-app"><div class="r1">` +
    markSVG(mats.mark, { px: MARK_PX_IN_MACHINERY }) + `<div class="t">${esc(copy.title)}</div>` +
    funcIconSVG(FUNCTIONAL_ICONS.search, mats.functional, { px: 22 }) +
    funcIconSVG(FUNCTIONAL_ICONS.add, mats.functional, { px: 22 }) + `</div>` +
    `<div class="r2"><span>${esc(copy.period)}${chev}</span><span>${esc(copy.order)}</span></div></div>`;
  return frameOpen() + app + map + plane + tabs(mats, state) + `</div>`;
}

/* ------------------------------------------------------------------- tiles --------------- */

export function tile(inner, { w, h, onSurface = false } = {}) {
  return `<div class="spec-tile${onSurface ? ' onsurf' : ''}" data-qp-frame ` +
    `style="width:${w}px;height:${h}px;">${inner}</div>`;
}

export function iconStrip(m, { px = NAV_PX, gap = 26, w = 390, h = 74, onSurface = true } = {}) {
  return `<div class="spec-tile${onSurface ? ' onsurf' : ''}" data-qp-frame ` +
    `style="width:${w}px;height:${h}px;gap:${gap}px;">` +
    ICONS.map((ic) => iconSVG(ic, m, { px })).join('') + `</div>`;
}

/* ------------------------------------------------------------------- pages --------------- */

export function page(title, bodyHTML, { width, extraCSS = '' } = {}) {
  return `<!DOCTYPE html>
<html dir="ltr" lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
${faceCSS()}
${boardCSS}
${frameCSS}
body{width:${width}px;}
${extraCSS}
</style></head><body>${FONT_GUARD_HTML}${bodyHTML}${REPORTER}</body></html>`;
}

/**
 * A BLIND page. No board chrome, no headings, no captions, no values — the frames and nothing else.
 *
 * A separate function rather than an option, because a blind board that accidentally inherits a
 * caption block is not a blind board, and the only reliable way to guarantee that is for the blind
 * builder to have no caption machinery available to it at all. The same function serves the
 * Product-Owner proof, where the requirement is the same: no labels inside or beside the frames.
 */
export function blindPage(title, bodyHTML, { width, extraCSS = '' } = {}) {
  return `<!DOCTYPE html>
<html dir="ltr" lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
${faceCSS()}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{background:${BENCH.bg};}
body{font-family:"QP-Estedad";-webkit-text-size-adjust:none;width:${width}px;direction:ltr;}
.board{padding:40px 40px 44px;direction:ltr;}
.row{display:flex;gap:40px;align-items:flex-start;flex-wrap:nowrap;}
.row > *{flex-shrink:0;}
.blind-lb{font-family:${CHROME_FACE};font-size:12px;font-weight:600;color:${BENCH.ink};
          letter-spacing:0.14em;margin-top:18px;text-align:center;}
.blind-sc{font-family:${CHROME_FACE};font-size:10px;color:${BENCH.faint};
          letter-spacing:0.10em;margin-bottom:10px;text-align:center;}
.spec-tile{background:${WORLD};display:flex;align-items:center;justify-content:center;}
${frameCSS}
${extraCSS}
</style></head><body>${FONT_GUARD_HTML}${bodyHTML}${REPORTER}</body></html>`;
}

/** The character tone for the one identity moment, derived once. */
export const CHARACTER_HEX = characterShade(RESOLVED).hex;
