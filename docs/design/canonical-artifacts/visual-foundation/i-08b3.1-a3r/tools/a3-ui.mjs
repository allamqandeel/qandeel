/**
 * I-08B3.1-A3 - the shared proof environment.
 *
 * A3 is a narrower question than A2. There is one World (#101010), one Secondary, one
 * Tertiary, one type system, one body of Arabic and one template. The ONLY thing that may
 * differ between the two finalist renders is the Primary Reading Neutral - a single CSS
 * custom property, `--ink-1`.
 *
 * That makes the fairness contract stricter than A2's, not looser: A2 allowed a thesis seven
 * variables, A3 allows a finalist one. Everything else is a literal constant in these files,
 * and `tools/a3-fairness.mjs` proves the two finalists lay out identically element by element
 * rather than taking the shared template on trust.
 *
 * The bench around a board is the same neutral mid-grey A1 and A2 used (#333333, exactly
 * achromatic), so it cannot tint either finalist and is identical on every board.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PKG = join(HERE, '..');
export const WORK = join(PKG, '..', '.i08b31-a3-work');

/**
 * Estedad v8.5 variable font, referenced not redistributed.
 *
 * NOTE: this host carries TWO files called `Estedad[wght].ttf`. Only this one is v8.5
 * (sha256 3134e31a...); the copy under .i08b3-work/fonts/ is a different binary and would
 * render a different face. The preflight hashes the file it is about to embed rather than
 * trusting the path.
 */
export const TTF = join(PKG, '..', '.i08b3-work', 'raw', 'estedad-v8.5', 'Estedad-v8.5', 'Estedad[wght].ttf');
export const TTF_SHA = '3134e31a27d58e615967e714c7799fbfa2de952876f8597b33dc57ffe0e99d03';

export const BENCH = {
  bg: '#333333',
  ink: '#e8e8e8',
  dim: '#a8a8a8',
  faint: '#8a8a8a',
  rule: '#4a4a4a',
};

export const CHROME_FACE = `ui-sans-serif, "Segoe UI", system-ui, sans-serif`;

let _b64 = null;
export function faceCSS() {
  if (_b64 === null) _b64 = readFileSync(TTF).toString('base64');
  return `@font-face{font-family:"QP-Estedad";font-style:normal;font-weight:100 900;font-display:block;src:url("data:font/ttf;base64,${_b64}") format("truetype");}`;
}

/**
 * Font fingerprint, carried unchanged from I-08B3.0-E3, A1 and A2.
 *
 * document.fonts.ready resolves and document.fonts.check() returns true even when the face
 * was never fetched, so a board can lay out and rasterise while set in a substituted system
 * face. Three weights are measured rather than one: if the variable wght axis were not being
 * applied, all three would come back equal - and A3 depends on the 400/500 distinction more
 * than any previous stage does, because A3.6 asks whether weight 500 rescues the Metadata
 * role. A board where the axis was being ignored would answer that question falsely.
 */
export const FONT_PROBE = {
  text: 'اللي بيتكرر هنا مش مجرد تردد قبل الاختيار',
  px: 100,
  weights: [400, 500, 600],
  expected: [1695.5, 1702.31, 1706.5],
  tol: 1.0,
  fallbackSeen: 1386.58,
};

export const FONT_GUARD_HTML =
  `<div style="position:fixed;top:0;left:0;width:1px;height:1px;overflow:hidden;visibility:hidden;direction:ltr;">` +
  FONT_PROBE.weights.map((w) =>
    `<span class="qp-fp" data-w="${w}" style="position:absolute;top:0;left:0;white-space:pre;font:${w} ${FONT_PROBE.px}px 'QP-Estedad'">${FONT_PROBE.text}</span>`
  ).join('') + `</div>`;

/**
 * Reporter. qp-width comes from the BODY, never documentElement: Chrome on Windows refuses
 * a window narrower than ~500px, so documentElement.scrollWidth reports the viewport and a
 * correct narrow board would be rejected by the overflow guard. That matters more in A3 than
 * it did in A2, because A3.7 renders at a 390px mobile viewport on purpose.
 *
 * qp-geo is the structural fingerprint used by the fairness proof: every element inside the
 * product frame, its laid-out box, and its leaf text length. Colour appears nowhere in it.
 */
export const REPORTER = `<script>addEventListener('load',()=>{
const d=document.documentElement,H=document.head;
const add=(n,v)=>{const m=document.createElement('meta');m.name=n;m.content=String(v);H.appendChild(m);};
add('qp-height',Math.ceil(document.body.scrollHeight||d.scrollHeight));
add('qp-width',Math.ceil(document.body.scrollWidth));
add('qp-viewport',Math.ceil(d.clientWidth));
add('qp-dpr',String(devicePixelRatio));
const fp=[...document.querySelectorAll('.qp-fp')].map(e=>Math.round(e.getBoundingClientRect().width*100)/100);
add('qp-font',fp.join(','));
for(const e of document.querySelectorAll('[data-qp-rect]')){
  const r=e.getBoundingClientRect();
  add('qp-rect-'+e.getAttribute('data-qp-rect'),
      [Math.round(r.left),Math.round(r.top+scrollY),Math.round(r.width),Math.round(r.height)].join(','));
}
const geo=[];
for(const e of document.querySelectorAll('[data-qp-frame] *')){
  const r=e.getBoundingClientRect();
  geo.push(e.tagName+':'+Math.round(r.left)+','+Math.round(r.top)+','+Math.round(r.width)+','+Math.round(r.height)
    +':'+(e.children.length?'':(e.textContent||'').trim().length));
}
add('qp-geo',geo.join('|'));
});</script>`;

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export const boardCSS = `
*{margin:0;padding:0;box-sizing:border-box;}
html,body{background:${BENCH.bg};}
body{font-family:"QP-Estedad";-webkit-text-size-adjust:none;}
.board{padding:34px 38px 40px;direction:ltr;text-align:left;}
.board-h{border-bottom:1px solid ${BENCH.rule};padding-bottom:15px;margin-bottom:26px;}
.board-h h1{font-family:${CHROME_FACE};font-size:17px;font-weight:600;color:${BENCH.ink};}
.board-h p{font-family:${CHROME_FACE};font-size:12.5px;line-height:1.65;color:${BENCH.dim};margin-top:8px;max-width:1180px;}
/* A class, never an inline style: CHROME_FACE contains "Segoe UI" in double quotes, which
   closes a style="..." attribute early and silently drops every declaration after it. */
.cap{font-family:${CHROME_FACE};font-size:11px;font-weight:600;color:${BENCH.ink};margin-bottom:9px;}
.cap2{font-family:${CHROME_FACE};font-size:10.5px;color:${BENCH.dim};margin-bottom:8px;}
.note{font-family:${CHROME_FACE};font-size:11.5px;line-height:1.62;color:${BENCH.dim};margin-top:12px;max-width:1180px;}
.spec{font-family:${CHROME_FACE};font-size:10px;color:${BENCH.faint};margin-top:7px;line-height:1.55;}
.row{display:flex;gap:26px;align-items:flex-start;flex-wrap:nowrap;}
.sect{margin-top:34px;}
/* Board chrome is English and reads left-to-right (.board sets direction:ltr), so every
   Arabic specimen must re-declare rtl for ITSELF. letter-spacing is pinned to 0 here as well
   as at each call site: on Arabic it is banned outright, not merely discouraged. */
.ar{direction:rtl;text-align:right;letter-spacing:0;}
/* Every paragraph on a board IS an Arabic specimen, so the Arabic settings are the DEFAULT
   for a board paragraph rather than something each call site has to remember. A2's first run
   got that wrong: the 12px metadata specimens were written with a literal font-size and
   missed the class, so they inherited the LTR board chrome, rendered left-aligned, and sent
   the right-edge magnification crop into empty ground. Board chrome re-declares LTR for
   itself below; it is later in the sheet and specificity is equal.
   NOTE: this comment lives inside a template literal - no backticks may appear in it. */
.board p{direction:rtl;text-align:right;letter-spacing:0;}
.board-h p{direction:ltr;text-align:left;}
table.t{border-collapse:collapse;font-family:${CHROME_FACE};font-size:11px;color:${BENCH.ink};}
table.t th{text-align:left;font-weight:600;color:${BENCH.dim};padding:6px 15px 6px 0;border-bottom:1px solid ${BENCH.rule};white-space:nowrap;font-size:10px;}
table.t td{text-align:left;padding:6px 15px 6px 0;border-bottom:1px solid #3d3d3d;white-space:nowrap;}
.mono{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;}
`;

export const head = (title, sub) => `<div class="board-h"><h1>${esc(title)}</h1><p>${sub}</p></div>`;
export const cap = (t) => `<div class="cap">${esc(t)}</div>`;
export const cap2 = (t) => `<div class="cap2">${esc(t)}</div>`;

export function page(title, bodyHTML, { width, extraCSS = '' } = {}) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar-EG"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
${faceCSS()}
${boardCSS}
body{width:${width}px;}
${extraCSS}
</style></head><body>${FONT_GUARD_HTML}${bodyHTML}${REPORTER}</body></html>`;
}

/**
 * A bare page with NO board chrome at all, used for the mobile robustness condition.
 *
 * The A3.7 mobile render must be what a phone-width layout actually produces, so the document
 * is the product frame and nothing else - no bench, no caption, no English heading.
 *
 * THE WINDOW IS WIDER THAN THE FRAME, AND HAS TO BE. Chrome on Windows refuses a browser
 * window narrower than roughly 500 CSS px: ask for 390 and the layout viewport comes back 488,
 * while the screenshot is still taken at 390 - so the right-hand end of a 390px document is
 * silently cut off the raster and a strip of page background appears on the other side. The
 * first run of this board had exactly that defect, and the reported element boxes are what
 * exposed it (a box at x 118 with width 350 inside a 390px capture).
 *
 * So the window is made comfortably wider than the minimum, the body is set LTR so a
 * narrower-than-viewport block starts at x 0 deterministically, and the product frame - which
 * carries its own fixed 390px width and its own rtl - is cropped out of the raster by its
 * reported box. The PRODUCT is laid out at exactly 390 CSS px at deviceScaleFactor 3, which is
 * what the robustness question is about; the window around it is a host constraint and is
 * recorded as one.
 */
export function barePage(title, bodyHTML, { width } = {}) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar-EG"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
${faceCSS()}
*{margin:0;padding:0;box-sizing:border-box;}
html,body{background:${BENCH.bg};}
body{font-family:"QP-Estedad";-webkit-text-size-adjust:none;width:${width}px;direction:ltr;}
p{letter-spacing:0;}
</style></head><body>${FONT_GUARD_HTML}${bodyHTML}${REPORTER}</body></html>`;
}
