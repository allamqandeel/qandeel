/**
 * I-08B3.1-F2 — THE THREE QUIET SURFACES, IN BOTH APPEARANCES.
 *
 * ================================================================================================
 * WHY THESE EXIST, AND WHAT THEY ARE NOT
 *
 * §23 of the brief asks for a personal CONVERSATION, a DEEP ANALYSIS reading view and a
 * UTILITY / FORM / ERROR surface, and says plainly: "The Product Owner must see the Product, not
 * token chips." I-08B3.1-F1's proofs are all the Living Analysis World, which is the right subject
 * for an accessibility package and the wrong one for a reading-comfort question — a map with eight
 * labels cannot tell anyone whether long-form Arabic is comfortable on this ground.
 *
 * THEY INTRODUCE NO TOKEN AND NO ROLE. Every colour on these surfaces is resolved by its Product
 * role out of the same tree the Living Analysis World uses; every type size, weight and leading is
 * the frozen one; the Surface is the ONE functional Surface I-08B3.1-B4R froze, in all three. What
 * is new is the COMPOSITION, which is what a Product proof is.
 *
 * ================================================================================================
 * THE COPY IS WRITTEN, NOT ASSEMBLED
 *
 * Arabic that is structured like English and then translated reads as a machine talking. The
 * conversation below is in فصحى, in Arabic sentence structure, and it says what QANDEEL would
 * actually say: it reports what it observed, names the shape of the pattern, and then says plainly
 * that it does not know the cause. The last line is the load-bearing one — an analytical product
 * that never admits the limit of its own evidence is not being careful, it is being confident.
 *
 * It is also the SAME analytical content as the Living Analysis World's insight, deliberately:
 * «الإتقان يسبق السهر بيومين» is the sentence the map settles on, and seeing it arrive in a
 * conversation is what makes the two surfaces one Product rather than two demonstrations.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveAll } from './f2-resolve.mjs';
import { VIEW, FRAME } from '../vendor/f1/vendor/d2r/scene/d2-foundation.mjs';
import { over } from './f2-color.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ------------------------------------------------------------------------ the copy ------- */
export const CONVERSATION = Object.freeze([
  { who: 'person', text: 'لماذا أتأخّر في تسليم ما أُعِدّه جيّدًا؟' },
  { who: 'qandeel', text: 'في الأسابيع الأربعة الماضية، سبق الإتقانُ السهرَ بيومين في كلّ مرّة. يطول الإعداد، فينقص النوم، ثمّ تتراجع الطاقة، ثمّ يتأخّر التسليم.' },
  { who: 'qandeel', text: 'هذا ما لاحظتُه في عالَمك. ولستُ على يقين من السبب.', muted: true },
  { who: 'person', text: 'وماذا عن الأسبوع الماضي؟' },
  { who: 'qandeel', text: 'الأسبوع الماضي لم يكتمل بعد. أعرضه حين تُغلق أيّامه.', muted: true },
]);

export const DEEP_ANALYSIS = Object.freeze({
  title: 'الإتقان والسهر',
  kicker: 'تحليل معمّق · عالَمك الخاص',
  body: [
    { kind: 'lead', text: 'يتكرّر في أربعة أسابيع ترتيبٌ واحد: يسبق الإتقانُ السهرَ بيومين، ثمّ تتراجع الطاقة في اليوم الرابع.' },
    { kind: 'p', text: 'الرغبة في الإتقان تظهر أوّلًا. تطول ساعات الإعداد، ويتأخّر النوم عن موعده بساعة أو ساعتين، ثمّ بثلاث. في اليوم الثالث تنخفض الطاقة انخفاضًا يُقاس، وفي الرابع يتأخّر التسليم الذي كان الإعدادُ كلّه من أجله.' },
    { kind: 'p', text: 'الترتيب نفسه تكرّر أربع مرّات. هذا يكفي لتسمية النمط ولا يكفي لتسمية السبب: قد يكون السهر نتيجةً للرغبة في الإتقان، وقد يكون الاثنان نتيجةً لشيء ثالث لم يُسجَّل في هذا العالَم.' },
    { kind: 'aside', text: 'ما يُعرَض هنا مبنيّ على ما سجّلتَه أنت. ما لم يُسجَّل لا يظهر، ولا يُفترَض غيابُه.' },
    { kind: 'p', text: 'الخوف من التقصير يجاور الموضوعين في العالَم، ويشترك معهما في النمط. أمّا مقارنة النفس بالآخرين فتقع خارجه: هي قريبة في المكان وليست قريبة في المعنى.' },
  ],
});

export const FORM = Object.freeze({
  title: 'مزامنة العالَم',
  fieldLabel: 'اسم العالَم',
  fieldValue: 'عالَمي الخاص',
  hint: 'يظهر هذا الاسم لك وحدك.',
  errorTitle: 'تعذّرت مزامنة العالَم',
  errorBody: 'انقطع الاتّصال أثناء الحفظ. لم يتغيّر شيء في عالَمك. أعِد المحاولة حين يعود الاتّصال.',
  action: 'إعادة المحاولة',
  secondary: 'لاحقًا',
  disabledAction: 'فتح أرشيف الأسبوع',
  disabledReason: 'هذا الأرشيف يفتح بعد انتهاء الأسبوع.',
});

/* --------------------------------------------------------------------- the shell -------- */
function shell({ appearance, contrast = 'standard', transparency = 'full', textScale = 1, boldText = false, filter = 'none', title, body, tall = VIEW.H }) {
  const r = resolveAll({ appearance, contrast, transparency });
  const c = {
    world: r.colour.WORLD.value,
    surface: r.colour.SURFACE.value,
    primary: r.colour.PRIMARY.value,
    secondary: r.colour.SECONDARY.value,
    tertiary: r.colour.TERTIARY.value,
    brass: r.colour.BRASS.value,
    error: r.colour.ERROR_INK.value,
    disabled: r.colour.DISABLED_INK.value,
    focus: r.colour.FOCUS_INDICATOR.value,
    focusComp: r.colour.FOCUS_COMPANION.value,
    selected: r.colour.SELECTED_INK.value,
  };
  const boundary = contrast === 'increased' ? resolveHex(r, 'qandeel.accessibility.contrast.boundary') : null;
  const boundaryW = contrast === 'increased' ? r.scalar.BOUNDARY_WIDTH.value.value : 0;
  const leading = r.scalar.TEXT_LEADING_RATIO.value;
  const bold = boldText ? r.scalar.TEXT_BOLD_WEIGHT_DELTA.value : 0;
  const px = (n) => (n * textScale).toFixed(2);
  const fontPath = join(PKG, 'fonts', 'Estedad[wght].ttf').replace(/\\/g, '/');
  const FILTERS = {
    none: '',
    grayscale: '<filter id="qd-f" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"/></filter>',
    protan: '<filter id="qd-f" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.152286 1.052583 -0.204868 0 0  0.114503 0.786281 0.099216 0 0  -0.003882 -0.048116 1.051998 0 0  0 0 0 1 0"/></filter>',
    deutan: '<filter id="qd-f" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.367322 0.860646 -0.227968 0 0  0.280085 0.672501 0.047413 0 0  -0.011820 0.042940 0.968881 0 0  0 0 0 1 0"/></filter>',
  };
  return `<!doctype html>
<html dir="rtl" lang="ar" data-qd-ready="0" data-qd-appearance="${appearance}" data-qd-surface="${esc(title)}"
      data-qd-contrast="${contrast}" data-qd-transparency="${transparency}" data-qd-textscale="${textScale}"
      data-qd-bold="${boldText ? 1 : 0}" data-qd-filter="${filter}">
<head><meta charset="utf-8"><title>QANDEEL — ${esc(title)}</title>
<style>
@font-face { font-family:'Estedad'; src:url('file:///${fontPath}') format('truetype'); font-weight:100 900; font-display:block; }
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:${c.world}}
body{font-family:'Estedad',sans-serif;width:${VIEW.W}px;color:${c.primary};line-height:${leading};
  letter-spacing:normal;font-style:normal}
#page{position:relative;width:${VIEW.W}px;min-height:${tall}px;background:${c.world};padding-bottom:${FRAME.nav + 18}px}
header#chrome{position:sticky;top:0;height:${FRAME.header}px;background:${c.surface};z-index:5;
  ${boundaryW ? `border-block-end:${boundaryW}px solid ${boundary};` : ''}
  display:flex;align-items:center;justify-content:space-between;padding:0 14px}
#mark{color:${c.brass};font-size:${px(15)}px;font-weight:${Math.min(900, 700 + bold)}}
#screen{color:${c.tertiary};font-size:${px(12)}px;font-weight:${500 + bold}}
nav#nav{position:absolute;inset-inline:0;bottom:0;height:${FRAME.nav}px;background:${c.surface};
  ${boundaryW ? `border-block-start:${boundaryW}px solid ${boundary};` : ''}
  display:flex;align-items:center;justify-content:space-around}
.navitem{color:${c.brass};font-size:${px(11)}px;font-weight:${500 + bold}}
main{padding:16px 14px 0}
${body.css}
</style></head>
<body>
${FILTERS[filter] ? `<svg width="0" height="0" aria-hidden="true" style="position:absolute"><defs>${FILTERS[filter]}</defs></svg>` : ''}
<div id="page"${filter === 'none' ? '' : ' style="filter:url(#qd-f)"'}>
  <header id="chrome"><span id="mark" aria-label="قنديل">ق</span><span id="screen">${esc(title)}</span></header>
  <main>${body.html}</main>
  <nav id="nav" aria-label="التنقّل"><span class="navitem">العالَم</span><span class="navitem">المحادثة</span><span class="navitem">الزمن</span></nav>
</div>
<script>document.fonts.ready.then(function(){document.documentElement.setAttribute('data-qd-ready','1');});</script>
</body></html>`;
}

function resolveHex(r, name) {
  const ALIAS = /^\{([^}]+)\}$/;
  let cur = name;
  for (let i = 0; i < 12; i++) {
    const e = r.flat.get(cur);
    if (!e) return null;
    const m = typeof e.value === 'string' ? ALIAS.exec(e.value.trim()) : null;
    if (!m) return String(e.value).toLowerCase();
    cur = m[1].trim();
  }
  return null;
}

/* ---------------------------------------------------------------- the conversation ------ */
/**
 * THE QUIET SURFACE. No map, no event, no chrome beyond the frame — the Product at its most
 * ordinary, which is where a ground's reading comfort is actually decided.
 *
 * QANDEEL's own turns are NOT put on a bubble. A bubble is a container, and I-08B3.1-B4R froze
 * that QANDEEL has one functional Surface and no container roles; giving the assistant a tinted
 * bubble would invent a second surface tone to carry "who is speaking", which the START MARK and
 * the ink already carry. The person's turns sit on the one Surface; QANDEEL's sit on the World.
 */
export function conversation(opts = {}) {
  const r = resolveAll({ appearance: opts.appearance, contrast: opts.contrast ?? 'standard', transparency: opts.transparency ?? 'full' });
  const c = { surface: r.colour.SURFACE.value, primary: r.colour.PRIMARY.value, secondary: r.colour.SECONDARY.value, tertiary: r.colour.TERTIARY.value, brass: r.colour.BRASS.value };
  const s = opts.textScale ?? 1, bold = opts.boldText ? r.scalar.TEXT_BOLD_WEIGHT_DELTA.value : 0;
  const px = (n) => (n * s).toFixed(2);
  const rows = CONVERSATION.map((t) => t.who === 'person'
    ? `<div class="turn person"><p>${esc(t.text)}</p></div>`
    : `<div class="turn qandeel${t.muted ? ' muted' : ''}"><span class="q" aria-hidden="true">ق</span><p>${esc(t.text)}</p></div>`).join('\n');
  return shell({
    ...opts, title: 'المحادثة',
    body: {
      css: `
.turn{margin-block-end:14px}
.turn p{font-size:${px(14)}px;font-weight:${500 + bold}}
.turn.person{background:${c.surface};border-radius:10px;padding:12px 14px}
.turn.person p{color:${c.primary}}
.turn.qandeel{display:flex;gap:10px;padding:2px 2px}
.turn.qandeel .q{color:${c.brass};font-size:${px(13)}px;font-weight:${Math.min(900, 700 + bold)};flex:0 0 auto;line-height:1.2}
.turn.qandeel p{color:${c.primary}}
.turn.qandeel.muted p{color:${c.tertiary};font-size:${px(13)}px}`,
      html: `<section aria-label="المحادثة">\n${rows}\n</section>`,
    },
  });
}

/* --------------------------------------------------------------- the deep analysis ------ */
export function deepAnalysis(opts = {}) {
  const r = resolveAll({ appearance: opts.appearance, contrast: opts.contrast ?? 'standard', transparency: opts.transparency ?? 'full' });
  const c = { primary: r.colour.PRIMARY.value, secondary: r.colour.SECONDARY.value, tertiary: r.colour.TERTIARY.value, surface: r.colour.SURFACE.value, brass: r.colour.BRASS.value };
  const s = opts.textScale ?? 1, bold = opts.boldText ? r.scalar.TEXT_BOLD_WEIGHT_DELTA.value : 0;
  const px = (n) => (n * s).toFixed(2);
  const html = DEEP_ANALYSIS.body.map((b) => {
    if (b.kind === 'lead') return `<p class="lead">${esc(b.text)}</p>`;
    if (b.kind === 'aside') return `<p class="aside">${esc(b.text)}</p>`;
    return `<p>${esc(b.text)}</p>`;
  }).join('\n');
  return shell({
    ...opts, title: 'تحليل معمّق', tall: 1180,
    body: {
      css: `
.kicker{color:${c.tertiary};font-size:${px(11)}px;font-weight:${500 + bold};margin-block-end:6px}
h1{color:${c.primary};font-size:${px(22)}px;font-weight:${Math.min(900, 700 + bold)};margin-block-end:14px}
p{font-size:${px(14)}px;font-weight:${400 + bold};color:${c.secondary};margin-block-end:12px}
p.lead{color:${c.primary};font-size:${px(16)}px;font-weight:${500 + bold}}
/* THE ASIDE IS TINTED FROM THE FOREGROUND, NEVER GREY — the craft floor's rule for secondary
   text on a coloured surface, and the light ground is a coloured surface. */
p.aside{color:${c.tertiary};font-size:${px(13)}px;border-inline-start:2px solid ${c.brass};padding-inline-start:10px}`,
      html: `<article aria-label="تحليل معمّق"><p class="kicker">${esc(DEEP_ANALYSIS.kicker)}</p><h1>${esc(DEEP_ANALYSIS.title)}</h1>\n${html}\n</article>`,
    },
  });
}

/* ----------------------------------------------------------------------- the form ------- */
/**
 * UTILITY, FORM AND ERROR — the surface where colour is most tempted to carry meaning alone.
 *
 * Everything I-08B3.1-E1 and F1 require is here and is inherited rather than re-decided: the error
 * carries its ink AND a glyph AND its message in words; the unavailable action states its reason
 * through a real accessible description on a real control; the FIELD is a boundary rather than a
 * box, which is B4R's frozen treatment of the authorship surface.
 */
export function form(opts = {}) {
  const r = resolveAll({ appearance: opts.appearance, contrast: opts.contrast ?? 'standard', transparency: opts.transparency ?? 'full' });
  const c = {
    world: r.colour.WORLD.value, surface: r.colour.SURFACE.value, primary: r.colour.PRIMARY.value,
    secondary: r.colour.SECONDARY.value, tertiary: r.colour.TERTIARY.value, brass: r.colour.BRASS.value,
    error: r.colour.ERROR_INK.value, disabled: r.colour.DISABLED_INK.value,
    focus: r.colour.FOCUS_INDICATOR.value, focusComp: r.colour.FOCUS_COMPANION.value,
  };
  const s = opts.textScale ?? 1, bold = opts.boldText ? r.scalar.TEXT_BOLD_WEIGHT_DELTA.value : 0;
  const px = (n) => (n * s).toFixed(2);
  const focusW = (opts.contrast === 'increased' ? r.scalar.FOCUS_THICKNESS_HC : r.scalar.FOCUS_THICKNESS).value.value;
  const focusOffset = r.scalar.FOCUS_OFFSET.value.value;
  return shell({
    ...opts, title: 'مزامنة العالَم', tall: 700,
    body: {
      css: `
h1{color:${c.primary};font-size:${px(18)}px;font-weight:${Math.min(900, 700 + bold)};margin-block-end:16px}
label{display:block;color:${c.secondary};font-size:${px(12)}px;font-weight:${500 + bold};margin-block-end:6px}
.field{border:0;border-block-end:1.5px solid ${c.tertiary};background:transparent;color:${c.primary};
  font-family:inherit;font-size:${px(15)}px;font-weight:${500 + bold};width:100%;padding:6px 2px;line-height:inherit}
.field:focus{outline:${focusW}px solid ${c.focus};outline-offset:${focusOffset}px;box-shadow:0 0 0 ${focusW + focusOffset}px ${c.focusComp}}
.hint{color:${c.tertiary};font-size:${px(11)}px;font-weight:${500 + bold};margin-block-start:6px}
.err{margin-block-start:18px;border-inline-start:3px solid ${c.error};padding-inline-start:12px}
.err .t{display:flex;align-items:center;gap:8px;color:${c.error};font-size:${px(14)}px;font-weight:${Math.min(900, 700 + bold)}}
.err .g{display:inline-flex;align-items:center;justify-content:center;inline-size:${px(18)}px;block-size:${px(18)}px;
  border:1.5px solid currentColor;border-radius:50%;font-weight:700;font-size:${px(12)}px;flex:0 0 auto}
.err p{color:${c.secondary};font-size:${px(13)}px;font-weight:${400 + bold};margin-block-start:6px}
.actions{display:flex;gap:10px;margin-block-start:20px}
.btn{font-family:inherit;font-size:${px(13)}px;font-weight:${600 + bold};padding:10px 16px;border-radius:8px;
  border:1.5px solid ${c.brass};background:transparent;color:${c.brass};line-height:inherit}
.btn.quiet{border-color:${c.tertiary};color:${c.tertiary}}
.unavail{margin-block-start:22px}
.unavail .row{color:${c.disabled};font-size:${px(13)}px;font-weight:${500 + bold}}
.unavail .why{color:${c.tertiary};font-size:${px(11)}px;font-weight:${500 + bold};margin-block-start:4px}`,
      html: `<section aria-label="مزامنة العالَم">
  <h1>${esc(FORM.title)}</h1>
  <label for="wn">${esc(FORM.fieldLabel)}</label>
  <input class="field" id="wn" value="${esc(FORM.fieldValue)}" aria-describedby="wn-hint wn-err" aria-invalid="true" autofocus>
  <p class="hint" id="wn-hint">${esc(FORM.hint)}</p>
  <div class="err" id="wn-err" role="alert">
    <div class="t"><span class="g" aria-hidden="true">!</span><span>${esc(FORM.errorTitle)}</span></div>
    <p>${esc(FORM.errorBody)}</p>
  </div>
  <div class="actions">
    <button class="btn">${esc(FORM.action)}</button>
    <button class="btn quiet">${esc(FORM.secondary)}</button>
  </div>
  <div class="unavail">
    <div class="row" role="button" tabindex="0" aria-disabled="true" aria-describedby="why">${esc(FORM.disabledAction)}</div>
    <p class="why" id="why">${esc(FORM.disabledReason)}</p>
  </div>
</section>`,
    },
  });
}

export const SURFACES = { conversation, deepAnalysis, form };
