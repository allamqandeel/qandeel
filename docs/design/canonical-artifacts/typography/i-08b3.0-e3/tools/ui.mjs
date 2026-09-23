/**
 * I-08B3.0-E3 - the controlled test environment and the restrained product components.
 *
 * Deliberate constraints, so that what a board shows is typography and not decoration:
 *  - one dark-led surface, near-black, never #000000, never glowing
 *  - no gradients, no shadows, no blur, no glass, no accent colour, no brand marks
 *  - QANDEEL doctrine "continuous world before cards": QANDEEL's own speech sits directly
 *    on the ground with no container at all; only the person's own message takes a surface
 *  - board chrome (labels, specs, rulers) is set in the OS UI face and a chrome grey, so it
 *    can never be mistaken for the specimen
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scaleRole } from './scale.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');
export const WORK = join(PKG, '..', '.i08b3-work-e3');
export const SYS = JSON.parse(readFileSync(join(HERE, 'system.json'), 'utf8'));
export const S = SYS.surface;
export const ROLES = Object.fromEntries(SYS.roles.map((r) => [r.key, r]));

const TTF = join(PKG, '..', '.i08b3-work', 'raw', 'estedad-v8.5', 'Estedad-v8.5', 'Estedad[wght].ttf');

/** Base64 so Chrome's file:// font rules cannot silently fall back to a system face. */
export function faceCSS() {
  const b64 = readFileSync(TTF).toString('base64');
  return `@font-face{font-family:"QP-Estedad";font-style:normal;font-weight:100 900;font-display:block;src:url("data:font/ttf;base64,${b64}") format("truetype");}`;
}

export const CHROME_FACE = `ui-sans-serif, "Segoe UI", system-ui, sans-serif`;

/**
 * CSS for every type role at one scale.
 * leadingModel 'mul' keeps line-height a unitless multiple of the size (the ratio survives
 * scaling); 'sp' makes it an absolute value that goes through the nonlinear curve itself.
 * Both are rendered in this package because the proposed contract does not say which it is.
 */
export function roleCSS(scale = 1, leadingModel = 'mul', prefix = 'r') {
  return SYS.roles.map((role) => {
    const s = scaleRole(role, scale, leadingModel);
    const w = role.key === 'metadata' ? role.weight : role.weight;
    return `.${prefix}-${role.key}{font-size:${s.size}px;line-height:${s.leading}px;font-weight:${w};letter-spacing:0;}`;
  }).join('\n');
}

export function scaledRole(key, scale = 1, leadingModel = 'mul') {
  return scaleRole(ROLES[key], scale, leadingModel);
}

/** Shared document head. Arabic root direction and language are declared once, correctly. */
export function page(title, bodyHTML, opts = {}) {
  const { width, extraCSS = '', reporter = '' } = opts;
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar-EG"><head><meta charset="utf-8"><title>${title}</title>
<style>
${faceCSS()}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{background:${S.bg};}
body{width:${width}px;font-family:"QP-Estedad";color:${S.primary};-webkit-text-size-adjust:none;}
.chrome{font-family:${CHROME_FACE};color:${S.chrome};letter-spacing:.02em;direction:ltr;text-align:left;}
.arabic{font-family:"QP-Estedad";direction:rtl;text-align:start;letter-spacing:0;}
${extraCSS}
</style></head><body>${FONT_GUARD_HTML}${bodyHTML}${reporter}</body></html>`;
}

/* ------------------------------------------------------------------ board chrome ---- */

export const boardCSS = `
/* Board chrome reads left-to-right (it is English); every Arabic specimen re-declares rtl,
   and .dev makes each device screen a correct RTL environment in its own right. Without
   this the English tables and captions are pushed against the right edge by the root dir. */
.board{padding:40px 44px 48px;direction:ltr;text-align:left;}
.board-h{border-bottom:1px solid ${S.rule};padding-bottom:18px;margin-bottom:34px;}
.board-h h1{font-family:${CHROME_FACE};font-size:19px;font-weight:600;color:${S.primary};letter-spacing:.06em;direction:ltr;text-align:left;}
.board-h p{font-family:${CHROME_FACE};font-size:12.5px;line-height:1.65;color:${S.chrome};margin-top:8px;max-width:1100px;direction:ltr;text-align:left;}
.cap{font-family:${CHROME_FACE};font-size:10.5px;font-weight:600;letter-spacing:.1em;color:${S.chrome};text-transform:uppercase;direction:ltr;text-align:left;margin-bottom:10px;}
/* A class, never an inline style: CHROME_FACE contains "Segoe UI" in double quotes, which
   closes a style="..." attribute early and silently drops every declaration after it. */
.cap2{font-family:${CHROME_FACE};font-size:10px;letter-spacing:.09em;color:${S.chrome};text-transform:uppercase;margin-bottom:9px;direction:ltr;text-align:left;}
.note{font-family:${CHROME_FACE};font-size:11.5px;line-height:1.6;color:${S.chrome};direction:ltr;text-align:left;margin-top:10px;}
.row{display:flex;gap:40px;align-items:flex-start;flex-wrap:nowrap;}
.sect{margin-top:44px;}
.spec{font-family:${CHROME_FACE};font-size:10.5px;color:${S.chrome};direction:ltr;text-align:left;margin-top:8px;letter-spacing:.03em;}
table.t{border-collapse:collapse;font-family:${CHROME_FACE};font-size:11.5px;color:${S.secondary};direction:ltr;}
table.t th{text-align:left;font-weight:600;color:${S.chrome};padding:7px 16px 7px 0;border-bottom:1px solid ${S.rule};white-space:nowrap;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;}
table.t td{text-align:left;padding:7px 16px 7px 0;border-bottom:1px solid #191C21;white-space:nowrap;}
.ok{color:#8FA88F;}
.bad{color:#C08A8A;}
.warn{color:#BFAE86;}
`;

export const head = (title, sub) =>
  `<div class="board-h"><h1>${title}</h1><p>${sub}</p></div>`;

/** Caption text is authored here and may contain entities, so it is inserted as written. */
export const cap = (t) => `<div class="cap">${t}</div>`;

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* --------------------------------------------------------------- device environment ---- */

export const deviceCSS = `
.dev{background:${S.bg};border:1px solid ${S.rule};position:relative;overflow:hidden;direction:rtl;text-align:start;}
.dev-lab{font-family:${CHROME_FACE};font-size:10.5px;color:${S.chrome};direction:ltr;text-align:left;margin-bottom:9px;letter-spacing:.06em;}
.statusbar{display:flex;justify-content:space-between;align-items:center;color:${S.chrome};font-family:"QP-Estedad";}
/* The fold marker must not sit on top of the content it is describing: a short tag pinned
   to the left edge, not a full sentence laid across the line. The sentence is in the board
   header instead. */
.fold{position:absolute;left:0;right:0;border-top:1px dashed #3A4046;}
.fold span{position:absolute;left:0;top:-7px;background:${S.bg};padding:0 8px 0 2px;font-family:${CHROME_FACE};font-size:9px;color:#5C6670;letter-spacing:.14em;direction:ltr;}
`;

/**
 * A phone/tablet screen. Content flows naturally; the device's real viewport height is
 * drawn as a fold marker rather than by cutting the content off, so page growth under
 * text scaling is visible and honest instead of being hidden.
 */
export function device(d, scale, inner, opts = {}) {
  const { viewportH = null, label = null, foldLabel = 'FOLD' } = opts;
  const g = SYS.gutters[d.key];
  const fold = viewportH ? `<div class="fold" style="top:${viewportH}px"><span>${foldLabel}</span></div>` : '';
  const lab = label === null
    ? `${d.name} &middot; ${d.w}px &middot; text scale ${Math.round(scale * 100)}%`
    : label;
  return `<div><div class="dev-lab">${lab}</div>
<div class="dev" style="width:${d.w}px;padding:0 ${g}px 28px;">${fold}${inner}</div></div>`;
}

export function statusbar(scale) {
  const m = scaledRole('metadata', scale);
  return `<div class="statusbar" style="font-size:${m.size}px;line-height:${m.leading}px;padding:14px 0 6px;">
<span>٨:٣٤</span><span>القاهرة</span></div>`;
}

/* ------------------------------------------------------------------- components ------ */

/**
 * Conversation. QANDEEL speaks on the ground with no container; the person's message takes
 * a quiet raised surface. No bubbles, no tails, no avatars - nothing that competes with the
 * reading of the line.
 */
export function message(msg, scale, leadingModel = 'mul') {
  const b = scaledRole('body', scale, leadingModel);
  const m = scaledRole('metadata', scale, leadingModel);
  const isUser = msg.from === 'user';
  const text = esc(msg.text).replace(/\n/g, '<br>');
  const surf = isUser
    ? `background:${S.raised};padding:${Math.round(12 * Math.min(scale, 1.4))}px 14px;border-radius:10px;`
    : `padding:0 2px;`;
  const who = isUser ? 'أنت' : 'قنديل';
  return `<div style="margin-top:${Math.round(20 * Math.min(scale, 1.35))}px;">
<div class="arabic" style="font-size:${m.size}px;line-height:${m.leading}px;color:${S.chrome};margin-bottom:6px;font-weight:500;">${who} &middot; ${msg.time}</div>
<div class="arabic" style="${surf}font-size:${b.size}px;line-height:${b.leading}px;font-weight:400;color:${isUser ? S.primary : S.primary};">${text}</div>
</div>`;
}

/** A control. Height is content-driven with a floor, never a fixed box that clips. */
export function button(label, scale, opts = {}) {
  const { primary = false, fixedHeight = null, nowrap = false, minTouch = 48, full = false } = opts;
  const a = scaledRole('action', scale);
  const h = fixedHeight !== null
    ? `height:${fixedHeight}px;overflow:hidden;`
    : `min-height:${minTouch}px;`;
  const wrap = nowrap ? 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' : '';
  const w = full ? 'width:100%;' : '';
  return `<span class="arabic" style="display:inline-flex;align-items:center;justify-content:center;${w}${h}${wrap}
padding:10px 18px;border-radius:9px;border:1px solid ${primary ? S.controlEdge : S.rule};
background:${primary ? S.control : 'transparent'};color:${primary ? S.primary : S.secondary};
font-size:${a.size}px;line-height:${a.leading}px;font-weight:${ROLES.action.weight};letter-spacing:0;">${esc(label)}</span>`;
}

export function metaLine(text, scale, opts = {}) {
  const { weight = 400, color = S.secondary, tabular = false } = opts;
  const m = scaledRole('metadata', scale);
  return `<div class="arabic" style="font-size:${m.size}px;line-height:${m.leading}px;font-weight:${weight};color:${color};${tabular ? 'font-variant-numeric:tabular-nums;' : ''}">${esc(text)}</div>`;
}

export function sectionTitle(text, scale) {
  const t = scaledRole('sectionTitle', scale);
  return `<div class="arabic" style="font-size:${t.size}px;line-height:${t.leading}px;font-weight:${ROLES.sectionTitle.weight};margin-top:${Math.round(30 * Math.min(scale, 1.4))}px;margin-bottom:8px;">${esc(text)}</div>`;
}

export function bodyPara(text, scale, leadingModel = 'mul') {
  const b = scaledRole('body', scale, leadingModel);
  return `<p class="arabic" style="font-size:${b.size}px;line-height:${b.leading}px;font-weight:400;margin-top:12px;">${esc(text)}</p>`;
}

export function screenTitle(text, scale) {
  const t = scaledRole('screenTitle', scale);
  return `<div class="arabic" style="font-size:${t.size}px;line-height:${t.leading}px;font-weight:${ROLES.screenTitle.weight};padding-top:10px;">${esc(text)}</div>`;
}

/**
 * Font fingerprint.
 *
 * Chrome activates a @font-face only when something in the PARSED document already uses the
 * family. document.fonts.ready resolves and document.fonts.check() returns true even when
 * the face was never fetched - so a board can lay out, rasterise, look entirely finished,
 * and be set in a substituted system face. The width below was measured with Estedad v8.5
 * demonstrably active and is asserted on every single render.
 */
export const FONT_PROBE = {
  text: 'اللي بيتكرر هنا مش مجرد تردد قبل الاختيار',
  px: 100,
  weights: [400, 500, 600],
  /**
   * One expected width per weight, measured with Estedad v8.5 demonstrably active. Three
   * DIFFERENT values is itself part of the check: if the variable wght axis were not being
   * applied, all three would come back identical.
   */
  expected: [1695.5, 1702.31, 1706.5],
  tol: 1.0,
  fallbackSeen: 1386.58, // what this host produces when Estedad is NOT applied
};

/** Sits in the initial markup of every page: forces the real load AND is the specimen. */
/**
 * A 1px fixed, clipped, LTR box whose probes are each absolutely positioned at its origin.
 * All three pieces matter: laid out in the normal flow the three 1700px probes chain into a
 * 5100px run, and in an RTL document that run extends LEFTWARD past the viewport, shifting
 * the whole page right and tripping this package's own overflow guard. Absolute positioning
 * stacks them at one point instead, where overflow:hidden can clip them.
 */
export const FONT_GUARD_HTML =
  `<div style="position:fixed;top:0;left:0;width:1px;height:1px;overflow:hidden;visibility:hidden;direction:ltr;">` +
  FONT_PROBE.weights.map((w) =>
    `<span class="qp-fp" data-w="${w}" style="position:absolute;top:0;left:0;white-space:pre;font:${w} ${FONT_PROBE.px}px 'QP-Estedad'">${FONT_PROBE.text}</span>`
  ).join('') + `</div>`;

/** Every board embeds this so pass 1 can report the laid-out size and the font fingerprint. */
export const REPORTER = `<script>addEventListener('load',()=>{
const d=document.documentElement,H=document.head;
const add=(n,v)=>{const m=document.createElement('meta');m.name=n;m.content=String(v);H.appendChild(m);};
add('qp-height',Math.ceil(d.scrollHeight));
add('qp-width',Math.ceil(Math.max(d.scrollWidth,document.body.scrollWidth)));
const fp=[...document.querySelectorAll('.qp-fp')].map(e=>Math.round(e.getBoundingClientRect().width*100)/100);
add('qp-font',fp.join(','));
});</script>`;
