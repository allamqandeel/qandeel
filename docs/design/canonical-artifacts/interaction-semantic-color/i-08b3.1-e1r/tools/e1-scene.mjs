/**
 * I-08B3.1-E1 — THE PRODUCT SCENE.
 *
 * EVERY COLOUR IN THIS FILE COMES OUT OF THE RESOLVED TOKEN GRAPH. There is not one hex
 * literal below, and check R1 fails the build if the CSS the page receives disagrees with
 * what tools/e1-resolve.mjs resolves. I-08B3.1-D0 painted its chrome from constants it
 * declared itself and inherited the wrong coverage policy while doing it; the fix was not
 * to type a different hex but to stop the proof holding colours at all.
 *
 * ARABIC-NATIVE, and the typographic decisions are consequences of the script rather than
 * preferences: dir="rtl" lang="ar" at the root, because lang drives font fallback and
 * screen-reader voice as much as dir does; line-height 1.65, because Arabic ascenders,
 * descenders and diacritics clip below about 1.6; no letter-spacing anywhere, because it
 * visibly breaks the connected script; no italics, because Arabic has no italic tradition
 * and browsers fake-slant it; weights kept inside 400-700; logical properties throughout,
 * so the selection marker lands on the inline-start edge, which in RTL is the RIGHT edge.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveAll } from './e1-resolve.mjs';
import { hexToRgb8 } from '../vendor/lib/color.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
export const FONT_URL = pathToFileURL(join(PKG, 'fonts/Estedad[wght].ttf')).href;

const rgba = (hex, a) => `rgba(${hexToRgb8(hex).join(', ')}, ${a})`;

export function palette() {
  const r = resolveAll();
  const c = Object.fromEntries(Object.entries(r.colour).map(([k, v]) => [k, v.value]));
  const s = Object.fromEntries(Object.entries(r.scalar).map(([k, v]) => [k, typeof v.value === 'object' ? v.value.value : v.value]));
  return { c, s, resolved: r };
}

/* ------------------------------------------------------------------- iconography ---- */
/** Stroke marks. Every one is a SILHOUETTE first: the four status marks are a circle, a
 *  triangle, an open check and a bare letterform, so they are told apart with every pixel
 *  desaturated and at 16 px. */
const I = {
  conversation: '<path d="M4 6.5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 4v-4H6a2 2 0 0 1-2-2z"/>',
  map: '<path d="M3 18c3-5 6-7 9-7s6 2 9 7"/><path d="M5.5 13c2.2-3.2 4.3-4.6 6.5-4.6S16.3 9.8 18.5 13"/><path d="M8.5 8.4C10 6.5 11 5.8 12 5.8s2 .7 3.5 2.6"/>',
  worlds: '<circle cx="8.5" cy="9.5" r="4"/><circle cx="15.5" cy="14.5" r="4"/>',
  path: '<path d="M3 17h5"/><path d="M11 17h5"/><path d="M19 17h2"/><circle cx="9.5" cy="17" r="1.6"/><circle cx="17.5" cy="17" r="1.6"/><path d="M9.5 15.4V7"/><path d="M17.5 15.4v-4"/>',
  settings: '<path d="M4 8h9"/><path d="M17 8h3"/><path d="M4 16h4"/><path d="M12 16h8"/><circle cx="15" cy="8" r="2"/><circle cx="10" cy="16" r="2"/>',
  error: '<circle cx="12" cy="12" r="8.2"/><path d="M9.2 9.2l5.6 5.6"/><path d="M14.8 9.2l-5.6 5.6"/>',
  warning: '<path d="M12 3.6 21.2 19.6H2.8z"/><path d="M12 9.6v4.6"/><path d="M12 16.6v.9"/>',
  success: '<path d="M4.5 12.8 9.6 18 19.5 6.6"/>',
  informational: '<path d="M12 10.4v8"/><path d="M12 6.2v1.2"/>',
  lock: '<path d="M7 11V8.5a5 5 0 0 1 10 0V11"/><rect x="4.6" y="11" width="14.8" height="9" rx="2"/>',
};
export const icon = (name, { size = 24, w = 1.7, cls = '' } = {}) =>
  `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
  `stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${I[name]}</svg>`;

/** The canonical Q, vendored byte-identical from the sealed C3 package and painted with
 *  the resolved identity material. The mark's PLACEMENT is C2's open question and not
 *  E1's; the token grants material, and E1 does not touch either. */
export function canonicalQ(size = 26) {
  const svg = readFileSync(join(PKG, 'vendor/c3/reference/QANDEEL_Q_BASE_MASTER.svg'), 'utf8');
  const defs = svg.slice(svg.indexOf('<defs>'), svg.indexOf('</defs>') + 7);
  return `<svg class="qmark" width="${size * 1.385}" height="${size}" viewBox="0 -69.76 1710.08 1235.9" ` +
    `fill-rule="nonzero" aria-hidden="true" focusable="false">${defs}<g fill="currentColor"><use href="#q-mark"/></g></svg>`;
}

/* ------------------------------------------------------------------------ styles ---- */
export function css(p) {
  const { c, s } = p;
  return `
@font-face{font-family:Estedad;src:url("${FONT_URL}") format("truetype");font-weight:100 900;font-display:block}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --world:${c.WORLD}; --surface:${c.SURFACE};
  --primary:${c.PRIMARY}; --secondary:${c.SECONDARY}; --tertiary:${c.TERTIARY};
  --brass:${c.BRASS}; --mark:${c.MARK}; --nav:${c.NAV}; --control:${c.CONTROL};
  --light-core:${c.LIGHT_CORE}; --light-mid:${c.LIGHT_MID}; --light-low:${c.LIGHT_LOW};
  --rest-ink:${c.REST_INK}; --pressed-ink:${c.PRESSED_INK}; --pressed-wash:${rgba(c.PRESSED_INK, s.PRESSED_PRESENCE)};
  --focus:${c.FOCUS_INDICATOR}; --focus-companion:${c.FOCUS_COMPANION};
  --focus-w:${s.FOCUS_THICKNESS}px; --focus-cw:${s.FOCUS_COMPANION_THICKNESS}px; --focus-off:${s.FOCUS_OFFSET}px;
  --selected-ink:${c.SELECTED_INK}; --selected-marker:${c.SELECTED_MARKER}; --marker-w:${s.SELECTED_MARKER_THICKNESS}px;
  --disabled:${c.DISABLED_INK};
  --error:${c.ERROR_INK}; --warning:${c.WARNING_INK}; --success:${c.SUCCESS_INK}; --informational:${c.INFORMATIONAL_INK};
  --w-rest:${s.REST_WEIGHT}; --w-selected:${s.SELECTED_WEIGHT};
}
html,body{background:var(--world);color:var(--primary)}
body{font-family:Estedad,sans-serif;font-weight:var(--w-rest);line-height:1.65;-webkit-font-smoothing:antialiased}
.ic{flex:0 0 auto;display:block}
.qmark{display:block;color:var(--mark)}

/* ---- THE STATE COMPOSITION MODEL, IN THE CASCADE. ------------------------------------
   Three channels are exclusively owned (ground, perimeter, marker presence + weight); the
   INK is shared by SELECTED and DISABLED, and the cascade resolves it by precedence rule
   P1 rather than by pretending only one state writes it. I-08B3.1-E1 shipped a slogan
   that said no channel was used twice. It was false when it was written, and this block
   is the truthful version: the availability override is LAST on purpose. ------------- */
.ctl{position:relative;display:flex;align-items:center;gap:10px;font:inherit;font-weight:var(--w-rest);
     color:var(--rest-ink);background:transparent;border:0;text-align:start;cursor:pointer;
     transition:background-color 120ms ease-out, transform 120ms ease-out, color 120ms ease-out}
.ctl[data-state~="pressed"]{background:var(--pressed-wash);transform:scale(.97)}
/* BOTH SELECTORS, AND THE SECOND ONE IS WHY THE BEHAVIOURAL PROOF EXISTS.
   data-state="focus" is how a STILL shows the focused state. :focus-visible is what a
   real Tab key produces. An earlier build styled only the first, so every board painted
   a focus ring that the real focus state never produced - the keyboard got Chrome's
   1 px default outline instead. No still could have caught it; tools/e1-focus.mjs did,
   by reading the COMPUTED style of whatever the Tab key actually landed on. */
.ctl[data-state~="focus"],.ctl:focus-visible,.input[data-state~="focus"],.input:focus-visible{
     outline:var(--focus-w) solid var(--focus);outline-offset:var(--focus-off);
     box-shadow:0 0 0 calc(var(--focus-off) + var(--focus-w) + var(--focus-cw)) var(--focus-companion)}
.ctl[data-state~="selected"]{color:var(--selected-ink);font-weight:var(--w-selected)}
.ctl[data-state~="selected"]::before{content:"";position:absolute;background:var(--selected-marker)}

/* row: the marker is on the control's own INLINE-START edge, which in RTL is the right */
.row{inline-size:100%;padding:7px 14px;border-radius:2px;min-block-size:48px}
.row[data-state~="selected"]::before{inset-inline-start:0;inset-block:9px;inline-size:var(--marker-w)}
.row .txt{display:flex;flex-direction:column;gap:2px;min-inline-size:0}
/* A row's TITLE is content at secondary rank, not control ink: qandeel.state.rest.ink
   governs a CONTROL's own ink - a button label, a navigation label - and a row title is
   the thing the row is about. SELECTED promotes it one rung, secondary -> primary, which
   is a move UP the frozen ramp and not a new colour. */
.row .title{color:var(--secondary);font-size:14.5px}
.row[data-state~="selected"] .title{color:var(--selected-ink)}
.row .meta{font-size:12.5px;color:var(--tertiary);font-weight:400}
.row[data-state~="selected"] .meta{color:var(--secondary)}

/* navigation: the marker is on the edge the group is anchored to - the TOP edge.
   THERE IS NO UNAVAILABLE RULE HERE, AND ITS ABSENCE IS THE CONTRACT. The icon is
   Living Brass. E1 shipped a rule that set the navigation item's icon colour to the
   unavailable ink whenever the item carried the disabled state, which repainted the
   identity material because an item became unavailable - exactly the
   thing two packages were spent forbidding, sitting in the stylesheet the whole time
   because the universal law "no Brass-bearing object has a disabled state" made the rule
   unreachable and therefore unexamined. E1R withdrew the law, the rule became reachable,
   and check R30 now reads this stylesheet and rejects any state selector that paints a
   Brass-bearing element. How availability is expressed around an identity object is a
   navigation-contract decision E1R does not own and does not pre-empt. */
.nav{display:flex;justify-content:space-between;gap:2px;padding:8px 16px 11px;background:var(--surface)}
.navitem{flex:1 1 0;flex-direction:column;gap:5px;align-items:center;justify-content:flex-start;
         padding:9px 2px 5px;border-radius:2px;color:var(--rest-ink);font-size:11px}
.navitem .ic{color:var(--nav)}
.navitem[data-state~="selected"]::before{inset-inline:22%;inset-block-start:0;block-size:var(--marker-w)}

/* button: a boundary, not a box */
.btn{justify-content:center;padding:11px 20px;border:1px solid var(--rest-ink);border-radius:2px;
     color:var(--primary);font-weight:var(--w-selected);font-size:14.5px}
.btn.commit{border-color:var(--primary)}

/* option / scope chip: a CHOSEN VALUE in a set. This is the morphology at which
   SELECTED + UNAVAILABLE is reachable, because a value can stop being available while
   remaining the value the user chose. */
.optset{display:flex;gap:9px;flex-wrap:wrap}
.opt{justify-content:center;padding:8px 15px;border:1px solid var(--rest-ink);border-radius:2px;
     color:var(--rest-ink);font-size:13.5px;min-block-size:40px}
.opt[data-state~="selected"]{border-color:var(--selected-ink)}
.opt[data-state~="selected"]::before{inset-inline-start:0;inset-block:7px;inline-size:var(--marker-w)}

/* ---- P1 · AVAILABILITY OVERRIDES INK, and P2 · AVAILABILITY SUPPRESSES THE PRESS. -----
   LAST IN THE CASCADE ON PURPOSE. Every ink the control carries - label, metadata, border
   and THE SELECTION MARKER - resolves to the one unavailable ink, whichever ink it started
   from. What the override does NOT take is the marker's PRESENCE or the type weight: the
   choice the user made is a record, and a record survives its subject becoming unavailable.
   That is what keeps SELECTED + UNAVAILABLE distinguishable from UNAVAILABLE.
   BOTH AVAILABILITY PATTERNS ARE MATCHED. [aria-disabled="true"] is the DISCOVERABLE
   pattern, which carries no HTML disabled attribute and therefore receives no user-agent
   styling at all; the paint has to be asked for explicitly, and the two patterns must
   look identical because they mean the same thing. */
.ctl[data-state~="disabled"],.ctl[aria-disabled="true"],.ctl:disabled{color:var(--disabled);cursor:default}
.ctl[data-state~="disabled"] .title,.ctl[aria-disabled="true"] .title,.ctl:disabled .title,
.ctl[data-state~="disabled"] .meta,.ctl[aria-disabled="true"] .meta,.ctl:disabled .meta{color:var(--disabled)}
.ctl[data-state~="disabled"]::before,.ctl[aria-disabled="true"]::before,.ctl:disabled::before{background:var(--disabled)}
.btn[data-state~="disabled"],.btn[aria-disabled="true"],.btn:disabled,
.opt[data-state~="disabled"],.opt[aria-disabled="true"],.opt:disabled{border-color:var(--disabled)}
.ctl[data-state~="disabled"][data-state~="pressed"],.ctl[aria-disabled="true"][data-state~="pressed"]{
     background:transparent;transform:none}

/* field: the line does the work */
.field{display:flex;flex-direction:column;gap:5px;inline-size:100%}
.field label{font-size:12.5px;color:var(--secondary);font-weight:400}
.field .input{display:flex;align-items:center;gap:8px;padding:8px 2px;font-size:15px;color:var(--primary);
     border-block-end:1px solid var(--tertiary);background:transparent;min-block-size:36px;
     transition:border-color 120ms ease-out}
.field .input[dir="ltr"]{text-align:left}
.field[data-status="error"] .input{border-block-end-width:2px;border-block-end-color:var(--error)}
.field[data-status="error"] label{color:var(--error)}
.field .msg{display:flex;align-items:flex-start;gap:6px;font-size:12.5px;line-height:1.65}
.field[data-status="error"] .msg{color:var(--error)}
.field .msg .ic{margin-block-start:1px}
.field .ph{color:var(--tertiary)}

/* status blocks - three of the four roles carry no colour of their own */
.status{display:flex;align-items:flex-start;gap:8px;font-size:13px;line-height:1.65}
.status.error{color:var(--error)}
.status.warning{color:var(--warning);font-weight:var(--w-selected)}
.status.success{color:var(--success)}
.status.informational{color:var(--informational)}
.status .ic{margin-block-start:2px}
.cautionline{border-block-start:2px solid var(--warning);padding-block-start:12px}

/* chrome */
.screen{inline-size:390px;block-size:844px;display:flex;flex-direction:column;background:var(--world);overflow:hidden}
.hdr{display:flex;align-items:center;gap:10px;padding:13px 16px 10px;background:var(--surface)}
.hdr h1{font-size:16px;font-weight:var(--w-selected);color:var(--primary)}
.hdr .sub{margin-inline-start:auto;font-size:11.5px;color:var(--tertiary);font-weight:400}
.body{flex:1 1 auto;padding:14px;display:flex;flex-direction:column;gap:10px;overflow:hidden}
/* flex:0 0 auto deliberately. Without it an over-full screen SILENTLY SQUEEZES every
   panel and its contents instead of overflowing, so nothing looks broken and a fixed
   block-size inside simply stops applying. The page reports its own scrollHeight and
   e1-render.mjs fails the capture rather than trusting the eye. */
.panel{flex:0 0 auto;background:var(--surface);border-radius:2px;padding:12px;display:flex;flex-direction:column;gap:10px}
h2{font-size:13px;font-weight:var(--w-selected);color:var(--secondary)}
p{font-size:13.5px;color:var(--secondary)}

/* The board frame that carries the specimens. THE ANNOTATION IS REVIEW APPARATUS, NOT
   PRODUCT COPY, and most of it is English. An English sentence sitting in an RTL block
   has its neutral punctuation reordered - the full stop and the question mark jump to
   the wrong end - so every English run is an isolated LTR island. This is the same rule
   the product copy obeys for its own LTR islands, applied to the board's own chrome. */
.board{background:var(--world);padding:26px;display:flex;flex-direction:column;gap:20px}
.board h3{font-size:13px;font-weight:600;color:var(--primary)}
.en{direction:ltr;unicode-bidi:isolate;text-align:left}
.board .cap{font-size:11.5px;color:var(--tertiary);font-weight:400;line-height:1.6;
     direction:ltr;unicode-bidi:isolate;text-align:left;max-inline-size:118ch}
.grid{display:grid;gap:14px}
.cell{display:flex;flex-direction:column;gap:7px}
.cell .lab{font-size:10.5px;color:var(--tertiary);font-weight:500;letter-spacing:0;
     direction:ltr;unicode-bidi:isolate;text-align:left}
.plate{padding:16px;border-radius:2px}
.plate.on-world{background:var(--world)}
.plate.on-surface{background:var(--surface)}
.swatch{display:flex;align-items:center;gap:10px;font-size:11.5px;color:var(--secondary);
     direction:ltr;unicode-bidi:isolate;text-align:left;line-height:1.55}
.chip{inline-size:34px;block-size:34px;border-radius:2px;flex:0 0 auto}
.mono{font-family:Estedad,monospace;font-variant-numeric:tabular-nums;font-feature-settings:"tnum"}
`;
}

/* ------------------------------------------------------------------- the content ---- */
/** Arabic copy, composed in Arabic structure rather than mapped from English. Register is
 *  فصحى for errors and for the destructive commit, which is where the skill puts it. */
export const AR = {
  appTitle: 'قنديل',
  worldsTitle: 'العوالم',
  nav: [
    ['conversation', 'المحادثة'],
    ['map', 'الخريطة'],
    ['worlds', 'العوالم'],
    ['path', 'المسار'],
    ['settings', 'الإعدادات'],
  ],
  worlds: [
    ['مشروع قنديل', '١٢ عضوًا'],
    ['القراءة الليلية', '٤ أعضاء'],
    ['ملاحظات الرحلة', 'عضوان'],
    ['أرشيف البحث', '٧ أعضاء'],
  ],
  nameLabel: 'اسم العالَم',
  nameValue: 'مش',
  nameError: 'اسم العالَم قصير جدًّا. اكتب ثلاثة أحرف على الأقل.',
  mailLabel: 'البريد الإلكتروني للدعوة',
  mailValue: 'sara@qandeel',
  mailError: 'هذا البريد غير صالح. تأكّد من كتابته كاملًا.',
  syncError: 'تعذّرت مزامنة العالَم. تأكّد من اتصالك بالإنترنت ثمّ أعد المحاولة.',
  retry: 'أعد المحاولة',
  warning: 'سيصبح هذا العالَم عامًّا. يستطيع أيّ شخص قراءة ما تنشره فيه، ولا يمكن التراجع بعد النشر.',
  success: 'أصبح العالَم عامًّا.',
  informational: 'يظهر هذا العالَم لأعضائه فقط.',
  publish: 'اجعله عامًّا',
  cancel: 'إلغاء',
  save: 'احفظ',
  disabledReason: 'اكتب اسمًا للعالَم قبل النشر.',
  scopeLabel: 'نطاق العرض',
  scopes: ['الكل', 'العامّة', 'المشتركة', 'المؤرشفة'],
  scopeUnavailable: 'لم تعد المشاركة متاحة في هذا العالَم، واختيارك محفوظ.',
  needsPermission: 'يحتاج هذا الإجراء إذنًا من مالك العالَم.',
  unavailable: 'غير متاح',
  invite: 'ادعُ عضوًا',
  members: 'الأعضاء',
  insight: 'ثلاثة مواضيع تلتقي هنا',
};

export const st = (...names) => names.filter(Boolean).join(' ');

/* --------------------------------------------------------- the availability patterns */
/**
 * THE TWO PATTERNS, IN MARKUP RATHER THAN IN PROSE.
 *
 * `native`       — the HTML `disabled` attribute. Browsers remove it from the tab
 *                  sequence, and that is the whole point of choosing this pattern.
 * `discoverable` — `aria-disabled="true"` and NO `disabled` attribute, so the control
 *                  keeps its place in the focus order. W3C APG: "there are some contexts
 *                  where it is useful for an element to convey a disabled state while
 *                  remaining focusable", and "screen reader users are far less likely to
 *                  discover disabled elements that are not focusable". MDN is explicit
 *                  that aria-disabled applies no user-agent styling and suppresses no
 *                  behaviour: "Web developers must manually ensure such elements have
 *                  their functionality suppressed." Both halves are done here — the paint
 *                  in css(), the suppression in the page script — and the behavioural
 *                  proof checks that the suppression actually holds under a real key.
 *
 * The DATA-STATE is the same word in both cases, because the two are VISUALLY IDENTICAL.
 */
export const avail = (state = '', pattern = 'native') => {
  if (!/\b(disabled|unavailable)\b/.test(state)) return '';
  return pattern === 'discoverable' ? 'aria-disabled="true"' : 'disabled aria-disabled="true"';
};

/* ---------------------------------------------------------------------- fragments --- */
export const row = (title, meta, state = '', { id = '', tag = 'button', pattern = 'native', describedby = '' } = {}) =>
  `<${tag} class="ctl row" data-state="${state}" ${avail(state, pattern)} ` +
  `${describedby ? `aria-describedby="${describedby}"` : ''} ` +
  `${state.includes('selected') ? 'aria-current="true"' : ''} ${id ? `id="${id}"` : ''}>` +
  `<span class="txt"><span class="title">${title}</span>${meta ? `<span class="meta mono">${meta}</span>` : ''}</span></${tag}>`;

/** An option / scope chip: a CHOSEN VALUE in a set, which is the control type at which
 *  SELECTED + UNAVAILABLE is reachable and has to be expressed. */
export const opt = (label, state = '', { id = '', pattern = 'discoverable', describedby = '' } = {}) =>
  `<button class="ctl opt" data-state="${state}" ${avail(state, pattern)} ` +
  `${describedby ? `aria-describedby="${describedby}"` : ''} ` +
  `${state.includes('selected') ? 'aria-pressed="true"' : 'aria-pressed="false"'} ${id ? `id="${id}"` : ''}>${label}</button>`;

export const navItem = ([ico, label], state = '') =>
  `<button class="ctl navitem" data-state="${state}" ${avail(state)} ` +
  `${state.includes('selected') ? 'aria-current="page"' : ''}>${icon(ico, { size: 24, w: 1.75 })}<span>${label}</span></button>`;

export const navBar = (selectedIndex = 2, states = {}) =>
  `<nav class="nav" aria-label="${AR.worldsTitle}">` +
  AR.nav.map((n, i) => navItem(n, st(i === selectedIndex ? 'selected' : '', states[i] || ''))).join('') + '</nav>';

export const button = (label, state = '', { commit = false, describedby = '', pattern = 'native' } = {}) =>
  `<button class="ctl btn${commit ? ' commit' : ''}" data-state="${state}" ` +
  `${avail(state, pattern)} ${describedby ? `aria-describedby="${describedby}"` : ''}>${label}</button>`;

export const field = (id, label, value, { status = '', msg = '', state = '', ltr = false, placeholder = false } = {}) =>
  `<div class="field" data-status="${status}">` +
  `<label for="${id}">${label}</label>` +
  `<div class="input ${placeholder ? 'ph' : ''}" id="${id}" data-state="${state}" role="textbox" tabindex="0" ` +
  `${ltr ? 'dir="ltr"' : ''} ${status === 'error' ? `aria-invalid="true" aria-describedby="${id}-msg"` : ''}>${value}</div>` +
  (msg ? `<p class="msg" id="${id}-msg" ${status === 'error' ? 'role="alert"' : ''}>${icon(status === 'error' ? 'error' : 'informational', { size: 15, w: 1.8 })}<span>${msg}</span></p>` : '') +
  '</div>';

export const statusBlock = (kind, text, { weightRule = false } = {}) =>
  `<p class="status ${kind}${weightRule && kind === 'warning' ? ' cautionline' : ''}">${icon(kind, { size: 16, w: 1.85 })}<span>${text}</span></p>`;

/* ------------------------------------------------------------------------- page ----- */
export function page({ title, width, body, extraCss = '', suppressActivation = true }) {
  const p = palette();
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar" data-qd-ready="0">
<head><meta charset="utf-8"><title>${title}</title><style>${css(p)}${extraCss}
html,body{inline-size:${width}px}</style></head>
<body>${body}
<script>
// ACTIVATION, AND THE HALF aria-disabled DOES NOT DO FOR YOU.
// The HTML disabled attribute suppresses activation in the user agent. aria-disabled
// suppresses nothing: MDN is explicit that "web developers must manually ensure such
// elements have their functionality suppressed". A DISCOVERABLE UNAVAILABLE control is
// therefore fully operable unless this is written, and it LOOKS unavailable while being
// operable - the same defect shape as a control painted disabled with the attribute
// forgotten. Every control also counts its own activations so the behavioural proof can
// press a real key and read back whether anything happened.
for (const el of document.querySelectorAll('.ctl')) {
  el.dataset.qdActivated = '0';
  el.addEventListener('click', (ev) => {
    const unavailable = el.disabled === true || el.getAttribute('aria-disabled') === 'true';
    if (${suppressActivation ? 'unavailable' : 'false'}) { ev.preventDefault(); return; }
    el.dataset.qdActivated = String(Number(el.dataset.qdActivated) + 1);
  });
}
(async () => {
  // The page declares itself ready only after every weight it uses has actually loaded
  // and it has measured its own font fingerprint. document.fonts.check() answers from the
  // font's declared coverage, not from whether the bytes arrived, so it is not trusted here.
  try { await document.fonts.load('400 16px Estedad', 'ق'); } catch (e) {}
  try { await document.fonts.load('500 16px Estedad', 'ق'); } catch (e) {}
  try { await document.fonts.load('600 16px Estedad', 'ق'); } catch (e) {}
  try { await document.fonts.ready; } catch (e) {}
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;font:400 64px Estedad,serif;white-space:pre';
  probe.textContent = 'قنديل';
  document.body.appendChild(probe);
  const w = probe.getBoundingClientRect().width;
  probe.style.font = '400 64px serif';
  const fallback = probe.getBoundingClientRect().width;
  probe.remove();
  document.documentElement.setAttribute('data-qd-font', String(Math.round(w * 100) / 100));
  document.documentElement.setAttribute('data-qd-font-fallback', String(Math.round(fallback * 100) / 100));
  // An over-full fixed-height screen does not look broken: flex squeezes its children and
  // a block-size inside simply stops applying. So the page measures the overrun itself.
  // The CLIPPING container is .body, so measuring its children alone reports nothing
  // while the last panel is being cut off: a child that is fully painted and then
  // clipped by its parent has no overflow of its own. Measure both.
  let over = 0;
  for (const el of document.querySelectorAll('.body, .body > *, .screen')) {
    over = Math.max(over, el.scrollHeight - el.clientHeight);
  }
  document.documentElement.setAttribute('data-qd-overflow', String(over));
  document.documentElement.setAttribute('data-qd-ready', '1');
})();
</script></body></html>`;
}
