/**
 * I-08B3.0-E3 - board builder.
 *
 * Every board is a restrained product environment, not a specimen sheet, and every board
 * reads its content and its type values from system.json. Nothing is retyped per board and
 * no board is given a kinder condition than another.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from './render.mjs';
import {
  page, head, cap, esc, boardCSS, deviceCSS, device, statusbar, message, button, metaLine,
  sectionTitle, bodyPara, screenTitle, roleCSS, scaledRole, SYS, S, ROLES, PKG, CHROME_FACE, REPORTER,
} from './ui.mjs';
import { scaleRole } from './scale.mjs';

const REVIEW = join(PKG, 'review');
const M = JSON.parse(readFileSync(join(PKG, 'docs', 'MEASUREMENTS_rendered-text.json'), 'utf8'));
const CSS = boardCSS + deviceCSS;
const out = [];
const dev = (k) => SYS.devices.find((d) => d.key === k);
const pct = (s) => Math.round(s * 100) + '%';

/* =============================================================== 1. SYSTEM OVERVIEW == */

function overview() {
  const rows = SYS.roles.map((r) => {
    const lb = M.lineBox[r.key];
    const sample = {
      statement: 'أنت تتردد بعد أن يصبح حقيقيًا.',
      screenTitle: 'قراءة ممتدة: ما الذي يتغير بعد الحسم',
      sectionTitle: 'ما الذي تفعله المراجعة فعلًا',
      body: 'يظهر في حديثك نمط ثابت لا يتعلق بصعوبة الاختيار نفسه، بل بتوقيت المراجعة.',
      supporting: 'ظهر هذا النمط في ثلاثة مواضع محفوظة خلال الأسابيع الماضية.',
      action: 'عرض التحليل',
      metadata: 'آخر تحديث ١٤ سبتمبر، ٨:٣٤ م · ٣ ذكريات مرتبطة',
      numeric: '٧٢٪',
    }[r.key];
    const ratio = (r.leading / r.size);
    const flag = !lb.vocalisedFits
      ? `<span class="warn">vocalised ink ${lb.vocalisedInk_px}px exceeds the ${r.leading}px line by ${(-lb.headroom_px).toFixed(2)}px</span>`
      : lb.headroom_px < 1
        ? `<span class="warn">only ${lb.headroom_px}px of headroom over vocalised ink</span>`
        : `<span class="ok">${lb.headroom_px}px headroom over vocalised ink</span>`;
    return `<tr>
<td style="padding-right:26px;"><span style="color:${S.chrome}">${r.n}</span> &nbsp;${r.name}</td>
<td>${r.size} / ${r.leading} &middot; w${r.weight}${r.weightAlt ? '&ndash;' + r.weightAlt : ''}</td>
<td>${ratio.toFixed(3)}</td><td>${lb.vocalisedInk_em}</td>
<td style="white-space:normal;max-width:300px;">${flag}</td></tr>`;
  }).join('');

  const specimenList = SYS.roles.map((r) => {
    const sample = {
      statement: 'أنت تتردد بعد أن يصبح حقيقيًا.',
      screenTitle: 'قراءة ممتدة: ما الذي يتغير بعد الحسم',
      sectionTitle: 'ما الذي تفعله المراجعة فعلًا',
      body: 'يظهر في حديثك نمط ثابت لا يتعلق بصعوبة الاختيار نفسه، بل بتوقيت المراجعة. أنت تصل إلى القرار بهدوء، ثم تبدأ المراجعة بعد ساعات لا قبلها.',
      supporting: 'ظهر هذا النمط في ثلاثة مواضع محفوظة خلال الأسابيع الماضية، وكلها قرارات كانت قابلة للتنفيذ فورًا.',
      action: 'عرض التحليل',
      metadata: 'آخر تحديث ١٤ سبتمبر، ٨:٣٤ م · ٣ ذكريات مرتبطة · Hypothesis H-04',
      numeric: 'الثقة ٧٢٪',
    }[r.key];
    return `<div style="margin-bottom:26px;padding-bottom:22px;border-bottom:1px solid #191C21;">
<div class="spec" style="margin:0 0 8px;">${r.n}. ${r.name} &nbsp;&middot;&nbsp; ${r.size}/${r.leading} &nbsp;&middot;&nbsp; weight ${r.weight} &nbsp;&middot;&nbsp; ratio ${(r.leading / r.size).toFixed(3)}</div>
<div class="arabic" style="font-size:${r.size}px;line-height:${r.leading}px;font-weight:${r.weight};">${esc(sample)}</div></div>`;
  });

  // Monochrome legibility: the whole ladder in ONE ink, so hierarchy must come from
  // size, weight, leading and spacing alone.
  const mono = SYS.roles.map((r) => {
    const sample = { statement: 'أنت تتردد بعد أن يصبح حقيقيًا.', screenTitle: 'قراءة ممتدة', sectionTitle: 'ما الذي تفعله المراجعة', body: 'يظهر في حديثك نمط ثابت لا يتعلق بصعوبة الاختيار نفسه.', supporting: 'ظهر هذا النمط في ثلاثة مواضع محفوظة.', action: 'عرض التحليل', metadata: 'آخر تحديث ١٤ سبتمبر، ٨:٣٤ م', numeric: 'الثقة ٧٢٪' }[r.key];
    return `<div class="arabic" style="font-size:${r.size}px;line-height:${r.leading}px;font-weight:${r.weight};color:${S.primary};margin-bottom:14px;">${esc(sample)}</div>`;
  }).join('');

  const body = `<div class="board">
${head('I-08B3.0-E3 &middot; TYPOGRAPHY SYSTEM OVERVIEW',
  'The proposed contract as stated, set in Estedad v8.5. Ratio is leading divided by size. ' +
  'Vocalised ink is the measured ink extent of a fully vocalised Arabic sentence at that size, in ems, ' +
  'shaped by the rendering engine - not a figure from the font\'s metrics. A role whose line is shorter ' +
  'than its own vocalised ink has no margin left over fully-marked Arabic. Whether the ink of consecutive lines ' +
  'actually touches is a separate question, measured on rendered pixels on TYPOGRAPHY_FAILURE_BOARD - it does not.')}

${cap('The ladder, set')}
<div class="row">
  <div style="width:560px;">${specimenList.slice(0, 4).join('')}</div>
  <div style="width:560px;">${specimenList.slice(4).join('')}</div>
</div>

<div class="sect"><div class="row">
  <div style="width:470px;">${cap('Single ink - hierarchy from size, weight and leading only')}
    <div style="border:1px solid ${S.rule};padding:22px 22px 10px;">${mono}</div>
    <div class="note">Every role is drawn in one colour here. If two roles are indistinguishable in this
    column they are not distinguishable to a person who cannot rely on colour.</div>
  </div>
  <div style="width:690px;">${cap('Measured against the line each role declares')}
    <table class="t"><tr><th>Role</th><th>Size / leading</th><th>Ratio</th><th>Vocalised ink (em)</th><th>Result</th></tr>${rows}</table>
    <div class="note">Estedad v8.5 declares a default line box of ${M.lineBox.body.fontLineBox_em} em
    (USE_TYPO_METRICS set, typo ascender 1025, descender &minus;500, line gap 0, 1000 upem).
    Unvocalised Arabic measures ${M.lineBox.body.plainInk_em} em, so plain prose clears every role in the
    contract. Full vocalisation is what changes the answer.</div>
  </div>
</div></div>
</div>`;
  return { name: 'TYPOGRAPHY_SYSTEM_OVERVIEW', width: 1240, html: page('overview', body, { width: 1240, extraCSS: CSS, reporter: REPORTER }) };
}

/* ================================================================= 2-3. CONVERSATION == */

function conversationScreen(d, scale, leadingModel = 'mul') {
  const msgs = SYS.proofA.messages.map((m) => message(m, scale, leadingModel)).join('');
  const inner = `${statusbar(scale)}
${screenTitle(SYS.proofA.screenTitle, scale)}
<div style="margin-top:4px;">${metaLine(SYS.proofA.footerMeta, scale, { color: S.chrome })}</div>
<div style="border-top:1px solid ${S.rule};margin-top:16px;padding-top:4px;">${msgs}</div>
<div style="display:flex;gap:10px;margin-top:${Math.round(26 * Math.min(scale, 1.4))}px;">
${button(SYS.proofA.actions[0], scale, { primary: true })}${button(SYS.proofA.actions[1], scale)}</div>`;
  const vh = { narrow: 740, standard: 820, tablet: 980 }[d.key];
  return device(d, scale, inner, { viewportH: vh });
}

function conversation(scale) {
  const cols = SYS.devices.map((d) => conversationScreen(d, scale)).join('');
  const sc = pct(scale);
  const b = scaledRole('body', scale), m = scaledRole('metadata', scale), a = scaledRole('action', scale);
  const flow = M.scaleFlow[Math.round(scale * 100) + '%'];
  const body = `<div class="board">
${head(`PROOF A &middot; CONVERSATION &middot; TEXT SCALE ${sc}`,
  `PRIMARY BODY, ACTION / LABEL and METADATA only. Four consecutive messages, not one ideal message. ` +
  `At ${sc}: body ${b.size}/${b.leading}, label ${a.size}/${a.leading}, metadata ${m.size}/${m.leading}. ` +
  `Line-height is a unitless multiple of the size, so the ratio survives scaling. ` +
  `The dashed rule marks where the physical screen ends; content below it is reached by scrolling, which is ` +
  `permitted - content disappearing is not.`)}
<div class="row">${cols}</div>
<div class="sect">${cap('Measured reflow of one body paragraph at this scale')}
<table class="t"><tr><th>Device</th><th>Column</th><th>Lines</th><th>Chars / line</th><th>Words / line</th><th>Block height</th></tr>
${SYS.devices.map((d) => { const f = flow.mul[d.key]; return `<tr><td>${d.name}</td><td>${f.width}px</td><td>${f.lines}</td><td>${f.charsPerLine}</td><td>${f.wordsPerLine}</td><td>${f.height}px</td></tr>`; }).join('')}
</table></div>
</div>`;
  const width = 1780;
  return { name: `CONVERSATION_${Math.round(scale * 100)}`, width, html: page('conv', body, { width, extraCSS: CSS, reporter: REPORTER }) };
}

/* ============================================================== 4-5. LONG ANALYSIS === */

function analysisInner(scale, width) {
  const t = scaledRole('screenTitle', scale);
  let h = `${statusbar(scale)}${screenTitle(SYS.proofB.screenTitle, scale)}
<div style="margin-top:6px;padding-bottom:14px;border-bottom:1px solid ${S.rule};">${metaLine(SYS.proofB.meta, scale, { color: S.chrome })}</div>`;
  for (const s of SYS.proofB.sections) {
    h += sectionTitle(s.h, scale);
    for (const p of s.p) h += bodyPara(p, scale);
  }
  return h;
}

function longAnalysisMobile() {
  const cols = [dev('narrow'), dev('standard')].map((d) =>
    device(d, 1, analysisInner(1, d.w), { viewportH: d.key === 'narrow' ? 740 : 820 })).join('');
  const rm = M.readingMeasure;
  const body = `<div class="board">
${head('PROOF B &middot; LONG ANALYSIS &middot; MOBILE',
  `${M.readingMeasureWordCount} words of continuous Arabic analytical prose at PRIMARY BODY 17/30, with ` +
  `SECTION TITLE 20/32 and METADATA 12/20. Narrow and standard phone widths. Nothing is truncated and ` +
  `nothing is shrunk to fit: the page simply gets longer, which is the behaviour the contract asks for.`)}
<div class="row">${cols}</div>
<div class="sect">${cap('Measured, this passage at 17/30')}
<table class="t"><tr><th>Column</th><th>Lines</th><th>Chars / line</th><th>Words / line</th><th>Height</th></tr>
${rm.slice(0, 2).map((r) => `<tr><td>${r.width}px &mdash; ${r.label}</td><td>${r.lines}</td><td>${r.charsPerLine}</td><td>${r.wordsPerLine}</td><td>${r.height}px</td></tr>`).join('')}</table></div>
</div>`;
  const width = 1060;
  return { name: 'LONG_ANALYSIS_MOBILE', width, html: page('lam', body, { width, extraCSS: CSS, reporter: REPORTER }) };
}

function longAnalysisTablet() {
  const d = dev('tablet');
  const g = SYS.gutters.tablet;
  const full = d.w - 2 * g; // 704 - the unbounded case
  const bounded = 560;
  const mk = (colW, label) => {
    let h = `${statusbar(1)}<div style="max-width:${colW}px;">${screenTitle(SYS.proofB.screenTitle, 1)}
<div style="margin-top:6px;padding-bottom:14px;border-bottom:1px solid ${S.rule};">${metaLine(SYS.proofB.meta, 1, { color: S.chrome })}</div>`;
    for (const s of SYS.proofB.sections.slice(0, 4)) {
      h += sectionTitle(s.h, 1);
      for (const p of s.p) h += bodyPara(p, 1);
    }
    h += '</div>';
    return device(d, 1, h, { label });
  };
  const body = `<div class="board">
${head('PROOF B &middot; LONG ANALYSIS &middot; TABLET',
  `The same passage on a 768px tablet, unbounded against bounded. Left: the text runs the full ${full}px ` +
  `content width. Right: the same text held to a ${bounded}px reading column inside the same 768px screen. ` +
  `The measured line length is the argument, not a preference.`)}
<div class="row">
${mk(full, `TABLET 768px &middot; UNBOUNDED &mdash; text measure ${full}px`)}
${mk(bounded, `TABLET 768px &middot; BOUNDED &mdash; reading column ${bounded}px`)}
</div>
<div class="sect">${cap('Why the unbounded column is the problem')}
<table class="t"><tr><th>Measure</th><th>Lines</th><th>Chars / line</th><th>Words / line</th><th>Note</th></tr>
${M.readingMeasure.map((r) => `<tr><td>${r.width}px</td><td>${r.lines}</td><td>${r.charsPerLine}</td><td>${r.wordsPerLine}</td><td>${esc(r.label)}</td></tr>`).join('')}</table>
<div class="note">Full comparison of five measures, with the fatigue reasoning, is on READING_MEASURE_COMPARISON.</div></div>
</div>`;
  const width = 1780;
  return { name: 'LONG_ANALYSIS_TABLET', width, html: page('lat', body, { width, extraCSS: CSS, reporter: REPORTER }) };
}

/* ========================================================== 6. MEANINGFUL STATEMENT == */

function statementBoard() {
  const d = dev('standard');
  const col = SYS.proofC.steps.map((st) => {
    const lb = M.lineBox.statement;
    const inner = `${statusbar(1)}
<div style="padding:${Math.round(56)}px 0 0;">
<div class="arabic" style="font-size:${st.size}px;line-height:${st.leading}px;font-weight:${ROLES.statement.weight};">${esc(SYS.proofC.statement).replace(/\n/g, '<br>')}</div>
<div style="margin-top:28px;max-width:${d.w - 2 * SYS.gutters.standard}px;">
<div class="arabic" style="font-size:${ROLES.supporting.size}px;line-height:${ROLES.supporting.leading}px;font-weight:400;color:${S.secondary};">${esc(SYS.proofC.supporting)}</div></div>
</div>`;
    const vocEm = M.lineBox.statement.vocalisedInk_em;
    const ink = +(vocEm * st.size).toFixed(2);
    const fits = ink <= st.leading;
    return `<div>${device(d, 1, inner, { label: `${st.label} &middot; ${st.size} / ${st.leading} / ${ROLES.statement.weight}` })}
<div class="spec">ratio ${(st.leading / st.size).toFixed(3)} &middot; vocalised ink ${ink}px &middot;
<span class="${fits ? 'ok' : 'bad'}">${fits ? `fits with ${(st.leading - ink).toFixed(2)}px spare` : `exceeds the line by ${(ink - st.leading).toFixed(2)}px`}</span></div></div>`;
  }).join('');
  const body = `<div class="board">
${head('PROOF C &middot; MEANINGFUL MOMENT',
  `MEANINGFUL STATEMENT with SUPPORTING BODY, at the proposed 32/50/500 and one step either side. ` +
  `No glow, no accent colour, no special treatment - the typography carries the moment or it does not. ` +
  `The statement is two lines by design, so the leading is doing real work here and is measured against ` +
  `the actual vocalised ink of the line (the statement ends in <span dir="rtl">حقيقيًا</span>, which carries a tanween).`)}
<div class="row">${col}</div>
<div class="note">Ink figures are the measured extent of a fully vocalised Arabic sentence at that size,
${M.lineBox.statement.vocalisedInk_em} em, shaped in the engine. Plain unvocalised prose measures
${M.lineBox.body.plainInk_em} em and clears all three.</div>
</div>`;
  const width = 1540;
  return { name: 'MEANINGFUL_STATEMENT_COMPARISON', width, html: page('stmt', body, { width, extraCSS: CSS, reporter: REPORTER }) };
}

/* ============================================================ 7. METADATA / NUMERICS == */

function metadataBoard() {
  const d = dev('standard');
  const mt = ROLES.metadata, nu = ROLES.numeric;
  const f = M.figures;

  const inline = SYS.proofD.items.map((t) => metaLine(t, 1)).join('');
  const w4 = SYS.proofD.items.map((t) => metaLine(t, 1, { weight: 500 })).join('');

  // Proportional vs tabular, in a column where the values change.
  const rowsProp = SYS.proofD.changingRows.map((r) => `
<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #191C21;">
<span class="arabic" style="font-size:${mt.size}px;line-height:${mt.leading}px;color:${S.secondary};">${esc(r.label)}</span>
<span class="arabic" style="font-size:${nu.size}px;line-height:${nu.leading}px;font-weight:${nu.weight};">${esc(r.a)}</span></div>`).join('');
  const three = ['a', 'b', 'c'].map((k) => `<div style="flex:1;">
<div class="spec" style="margin-bottom:6px;">frame ${k.toUpperCase()}</div>
${SYS.proofD.changingRows.map((r) => `<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #191C21;">
<span class="arabic" style="font-size:${mt.size}px;line-height:${mt.leading}px;color:${S.secondary};">${esc(r.label)}</span>
<span class="arabic" style="font-size:${nu.size}px;line-height:${nu.leading}px;font-weight:${nu.weight};font-variant-numeric:tabular-nums;">${esc(r[k])}</span></div>`).join('')}</div>`).join('');
  const threeProp = ['a', 'b', 'c'].map((k) => `<div style="flex:1;">
<div class="spec" style="margin-bottom:6px;">frame ${k.toUpperCase()}</div>
${SYS.proofD.changingRows.map((r) => `<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #191C21;">
<span class="arabic" style="font-size:${mt.size}px;line-height:${mt.leading}px;color:${S.secondary};">${esc(r.label)}</span>
<span class="arabic" style="font-size:${nu.size}px;line-height:${nu.leading}px;font-weight:${nu.weight};">${esc(r[k])}</span></div>`).join('')}</div>`).join('');

  const proseLine = (tnum) => `<div class="arabic" style="font-size:${ROLES.body.size}px;line-height:${ROLES.body.leading}px;${tnum ? 'font-variant-numeric:tabular-nums;' : ''}">
لم يتغيّر SHA-256 الخاص بالنسخة v8.5، رغم أن PR #220 عدّل قيمة Confidence من 0.61 إلى 0.68، والثقة في القراءة ما زالت ٧٢٪ منذ ١٢ دقيقة.</div>`;
  const prose = `${proseLine(false)}
<div class="spec">proportional figures &mdash; the contract's default for prose</div>
<div style="margin-top:16px;">${proseLine(true)}</div>
<div class="spec"><span class="bad">the same sentence with tabular figures forced on</span> &mdash; every digit is
padded to one width, so <b>SHA-256</b>, <b>v8.5</b>, <b>#220</b> and <b>0.68</b> visibly loosen inside running
Arabic. This is the argument against enabling <code>tnum</code> globally, shown rather than asserted.</div>`;

  const body = `<div class="board">
${head('PROOF D &middot; DENSE METADATA AND NUMERICS',
  `METADATA 12/20 and NUMERIC READING 20/30 on the dark surface. Arabic-Indic digits for human-facing ` +
  `values, ASCII for technical identifiers, exactly as the contract states. Tabular figures are applied ` +
  `only in the changing-value column, and the board shows what that choice buys.`)}
<div class="row">
  <div style="width:${d.w}px;">${cap('Metadata at 12/20, weight 400')}
    <div style="border:1px solid ${S.rule};padding:16px 18px;">${inline}</div>
    <div class="spec">measured contrast of secondary ink on this ground: ${M.contrast.secondary.ratio}:1</div>
  </div>
  <div style="width:${d.w}px;">${cap('The same at weight 500')}
    <div style="border:1px solid ${S.rule};padding:16px 18px;">${w4}</div>
    <div class="spec">the contract allows 400&ndash;500 for this role</div>
  </div>
  <div style="width:${d.w}px;">${cap('Numeric reading beside its label')}
    <div style="border:1px solid ${S.rule};padding:10px 18px 4px;">${rowsProp}</div>
    <div class="spec">NUMERIC READING ${nu.size}/${nu.leading}/${nu.weight}, proportional figures</div>
  </div>
</div>

<div class="sect">${cap('The functional case for tabular figures: the same column, three successive readings')}
<div class="row">
  <div style="width:700px;">
    <div class="spec" style="margin-bottom:8px;">PROPORTIONAL &mdash; digits change width, the column edge moves</div>
    <div style="display:flex;gap:26px;border:1px solid ${S.rule};padding:14px 18px;">${threeProp}</div>
  </div>
  <div style="width:700px;">
    <div class="spec" style="margin-bottom:8px;">TABULAR (<code>font-variant-numeric: tabular-nums</code>) &mdash; the column edge holds still</div>
    <div style="display:flex;gap:26px;border:1px solid ${S.rule};padding:14px 18px;">${three}</div>
  </div>
</div>
<div class="note">This is the whole of the functional case. A metadata line that is read once and never
changes gains nothing from tabular figures and loses the natural fit of proportional ones, which is why the
contract does not switch them on globally.</div></div>

<div class="sect">${cap('The separator and the Arabic-Indic zero')}
<div class="row">
<div style="width:520px;">
${['·', '•', '–', '|'].map((sep) => `<div style="margin-bottom:14px;">
<div class="arabic" style="font-size:${mt.size}px;line-height:${mt.leading}px;color:${S.secondary};">آخر تحديث ١٤ سبتمبر، ٨:٣٤ م ${sep} ٣ ذكريات مرتبطة ${sep} الثقة ٧٢٪</div>
<div class="spec">separator ${sep === '·' ? 'U+00B7 middle dot' : sep === '•' ? 'U+2022 bullet' : sep === '–' ? 'U+2013 en dash' : 'U+007C vertical bar'} at 12/20</div></div>`).join('')}
<div style="border-top:1px solid ${S.rule};margin-top:16px;padding-top:14px;">
<div class="arabic" style="font-size:52px;line-height:1.55;letter-spacing:0;">٨:٣٤ م · ٣</div>
<div class="spec">52px &mdash; with the U+00B7 separator</div>
<div class="arabic" style="font-size:52px;line-height:1.55;letter-spacing:0;margin-top:10px;">٨:٣٤ م ٠ ٣</div>
<div class="spec">52px &mdash; the same line with an actual ٠ in the separator's place</div></div>
</div>
<div style="width:640px;">
<table class="t"><tr><th>Glyph</th><th>Advance (em)</th><th>Ink band (em)</th><th>Ink height (em)</th><th>At 12px</th></tr>
${Object.entries(M.separators.glyphs).map(([k, v]) => `<tr><td>${k}</td><td>${v.advance_em}</td><td>${v.inkBottom_em} &rarr; ${v.inkTop_em}</td><td>${v.inkHeight_em}</td><td>${v.inkHeight_px_at12}px</td></tr>`).join('')}
</table>
<div class="note"><b>A separator that can be read as a digit.</b> METADATA is the one role made almost
entirely of digits and separators, and at 12px the middle dot carries
${M.separators.glyphs['U+00B7 middle dot'].inkHeight_px_at12}px of ink against the Arabic-Indic zero's
${M.separators.glyphs['U+0660 arabic-indic zero'].inkHeight_px_at12}px &mdash; a difference of
${M.separators.dotVsZero.inkHeightDelta_px_at12}px between two small round marks whose centres sit
${Math.abs(M.separators.dotVsZero.verticalCentreDelta_em)} em apart. <b>This was found by misreading this
package's own board:</b> <span dir="rtl" class="arabic">٨:٣٤ م ·</span> was taken for a time ending in
<span dir="rtl" class="arabic">٠</span> until the string was measured character by character. The bullet is
the same ink height as the zero and is separated only by sitting higher; the en dash and the vertical bar are
different shapes and cannot be confused with a digit at any size. Which separator the product uses is a
design decision and is not taken here &mdash; the confusability is simply recorded, because it only exists
where Arabic-Indic digits and a round separator share a 12px line.</div>
</div></div></div>

<div class="sect">${cap('Identifiers inside Arabic prose - ASCII source form, unchanged')}
<div style="border:1px solid ${S.rule};padding:18px 20px;max-width:1100px;">${prose}</div></div>

<div class="sect">${cap('Measured figure behaviour in Estedad v8.5')}
<table class="t"><tr><th>Figure set</th><th>Default advance</th><th>With <code>tnum</code></th><th>Result</th></tr>
<tr><td>Western 0&ndash;9</td><td>${f.western_default.min}&ndash;${f.western_default.max}px (spread ${f.western_default.spread})</td><td>${f.western_tnum.min}px (spread ${f.western_tnum.spread})</td><td class="ok">proportional by default, tabular on request</td></tr>
<tr><td>Arabic-Indic ٠&ndash;٩</td><td>${f.arabicIndic_default.min}&ndash;${f.arabicIndic_default.max}px (spread ${f.arabicIndic_default.spread})</td><td>${f.arabicIndic_tnum.min}px (spread ${f.arabicIndic_tnum.spread})</td><td class="ok">proportional by default, tabular on request</td></tr></table>
<div class="note">Measured at 100px per glyph. Both digit systems reach the same tabular advance
(${f.arabicIndic_tnum.min}px), so a column may mix them and still align. Estedad applying <code>tnum</code>
to Arabic-Indic digits at all is the uncommon part: it is what makes an Arabic-Indic metric column possible.</div></div>
</div>`;
  const width = 1500;
  return { name: 'METADATA_NUMERICS', width, html: page('meta', body, { width, extraCSS: CSS, reporter: REPORTER }) };
}

/* ================================================================= 8. MIXED SCRIPT === */

function mixedScriptBoard() {
  const d = dev('standard');
  const b = ROLES.body;
  const paras = SYS.proofE.paragraphs.map((p) =>
    `<p class="arabic" style="font-size:${b.size}px;line-height:${b.leading}px;margin-bottom:16px;">${esc(p)}</p>`).join('');
  const parasNarrow = SYS.proofE.paragraphs.map((p) =>
    `<p class="arabic" style="font-size:${b.size}px;line-height:${b.leading}px;margin-bottom:16px;">${esc(p)}</p>`).join('');

  const ms = M.mixedScript;
  const baseline = `<div style="border:1px solid ${S.rule};padding:22px 24px;">
<div class="arabic" style="font-size:44px;line-height:1.7;">الثقة QANDEEL <span style="color:${S.secondary}">Confidence</span> ٧٢٪</div>
<div class="spec">44px, weight 400 &mdash; Arabic, Latin capitals, Latin lowercase and Arabic-Indic digits on one baseline</div></div>`;

  const bidiRows = Object.entries(M.bidiHard).map(([k, v]) => `<tr>
<td style="max-width:360px;white-space:normal;" dir="rtl" class="arabic">${esc(v.text)}</td>
<td>${v.isolateChangesOrder ? '<span class="bad">yes</span>' : '<span class="ok">no</span>'}</td>
<td>${v.finalStopIsLeftmost ? '<span class="ok">yes</span>' : '<span class="bad">no</span>'}</td></tr>`).join('');

  const body = `<div class="board">
${head('PROOF E &middot; MIXED ARABIC AND ENGLISH',
  `Realistic Arabic prose carrying English technical terminology at PRIMARY BODY 17/30, with no size ` +
  `correction applied to either script. The contract forbids a blanket &plusmn;2px adjustment; the ` +
  `measurements below are the reason it is right not to need one in this typeface.`)}
<div class="row">
  <div style="width:${d.w}px;">${cap('Standard phone, 412px')}
    ${device(d, 1, `${statusbar(1)}<div style="padding-top:14px;">${paras}</div>`, { label: 'MOBILE STANDARD &middot; 412px &middot; 100%' })}</div>
  <div style="width:${dev('narrow').w}px;">${cap('Narrow phone, 360px')}
    ${device(dev('narrow'), 1, `${statusbar(1)}<div style="padding-top:14px;">${parasNarrow}</div>`, { label: 'MOBILE NARROW &middot; 360px &middot; 100%' })}</div>
  <div style="width:520px;">${cap('Shared baseline, four writing systems')}${baseline}
    <div class="sect" style="margin-top:26px;">${cap('Measured relative sizes')}
    <table class="t">
    <tr><th>Quantity</th><th>Measured (em)</th></tr>
    <tr><td>Arabic ink height (<span dir="rtl">الثقة</span>)</td><td>${ms.arabicInk_em}</td></tr>
    <tr><td>Latin cap height</td><td>${ms.latinCapHeight_em}</td></tr>
    <tr><td>Latin lowercase ascender</td><td>${ms.latinLcAscender_em}</td></tr>
    <tr><td>Latin x-height</td><td>${ms.latinXHeight_em}</td></tr>
    <tr><td><b>Arabic &divide; Latin cap</b></td><td><b class="ok">${ms.arabicToLatinCap}</b></td></tr>
    </table>
    <div class="note">Apple's right-to-left guidance warns that Arabic set beside uppercase Latin
    &ldquo;can appear too small&rdquo; and suggests raising it by about 2 points. That advice is about the
    system fonts. Measured here, Estedad's Arabic already stands ${((ms.arabicToLatinCap - 1) * 100).toFixed(1)}%
    taller than its own Latin capitals, and its Latin lowercase ascender (${ms.latinLcAscender_em} em) is
    within ${(Math.abs(ms.latinLcAscender_em - ms.arabicInk_em) * 1000).toFixed(0)}/1000 em of the Arabic.
    Applying the +2pt correction to this family would over-correct in the wrong direction.</div></div>
  </div>
</div>

<div class="sect">${cap('Bidirectional behaviour, measured per character in the engine')}
<table class="t"><tr><th>Sentence</th><th>Isolate changes the visual order?</th><th>Sentence-final stop lands at the left?</th></tr>${bidiRows}</table>
<div class="note">Each sentence was laid out and every character's position read back, then sorted by x to
recover the order the eye sees. In all ${Object.keys(M.bidiHard).length} cases the Latin runs stay internally
left-to-right, the brackets mirror, the Arabic-Indic percentage keeps its sign on the correct side, and the
sentence-final stop lands at the left edge as RTL requires. Wrapping the Latin runs in an explicit
isolate (U+2068 / U+2069) changed nothing in any case, so no directional hack is warranted and none is used.</div>
<div class="note" style="max-width:1400px;"><b>One thing the wrapping does do.</b> On the 412px phone above,
<b>Memory Runtime</b> breaks across two lines: &ldquo;Memory&rdquo; ends one line and &ldquo;Runtime&rdquo;
begins the next. That is correct behaviour for two words separated by an ordinary space, and no typographic
rule is violated. But a multi-word English term is read as one name, and QANDEEL's vocabulary is full of them
(<i>Memory Runtime</i>, <i>QANDEEL Human Map</i>). Whether such terms are bound with a non-breaking space is a
content decision rather than a typographic one, and it is raised here only because this board is where it
becomes visible.</div></div>
</div>`;
  const width = 1560;
  return { name: 'MIXED_SCRIPT', width, html: page('mix', body, { width, extraCSS: CSS, reporter: REPORTER }) };
}

/* ================================================================ 9. CONTROL LABELS == */

function controlsBoard() {
  const scale = 1;
  const a = ROLES.action;
  const dN = dev('narrow');
  const full = dN.w - 2 * SYS.gutters.narrow;

  const fullWidth = `<div style="display:flex;flex-direction:column;gap:10px;">
${button(SYS.proofF.primaryPair[0], scale, { primary: true, full: true })}${button(SYS.proofF.primaryPair[1], scale, { full: true })}</div>`;
  const pair = `<div style="display:flex;gap:10px;">
<span style="flex:1 1 0;display:flex;min-width:0;">${button('متابعة', scale, { primary: true, full: true })}</span>
<span style="flex:1 1 0;display:flex;min-width:0;">${button('إلغاء', scale, { full: true })}</span></div>`;
  const toolbar = `<div style="display:flex;gap:8px;flex-wrap:wrap;">
${SYS.proofF.labels.map((l) => button(l, scale)).join('')}</div>`;
  const contextual = `<div style="display:flex;gap:10px;">${SYS.proofF.contextual.map((l) => button(l, scale)).join('')}</div>`;

  const inner = `${statusbar(scale)}${screenTitle('الإعدادات', scale)}
<div style="margin-top:22px;">${cap2('Full-width primary and secondary')}${fullWidth}</div>
<div style="margin-top:26px;">${cap2('Two controls sharing the width')}${pair}</div>
<div style="margin-top:26px;">${cap2('Contextual actions')}${contextual}</div>
<div style="margin-top:26px;">${cap2('Every label in the set, wrapping as a collection')}${toolbar}</div>`;

  const rows = ['100%', '130%', '160%', '200%'].map((sc) => {
    const per = M.controls[sc].narrow;
    const ovf = Object.entries(per).filter(([k, v]) => v.overflows && k.startsWith('narrow|'));
    const tallest = Math.max(...Object.values(per).map((v) => v.h));
    return `<tr><td>${sc}</td><td>${scaleRole(ROLES.action, parseInt(sc) / 100, 'mul').size}px</td>
<td>${Object.values(per).filter((v) => v.meets48).length}/${Object.keys(per).length}</td>
<td>${tallest}px</td>
<td>${ovf.length ? `<span class="bad">${ovf.length} label${ovf.length > 1 ? 's' : ''} exceed a 104px slot</span>` : '<span class="ok">none</span>'}</td></tr>`;
  }).join('');

  const body = `<div class="board">
${head('PROOF F &middot; UI LABELS AND CONTROLS',
  `ACTION / LABEL ${a.size} / ${a.leading} / ${a.weight} in real controls at 100%. Every control has a ` +
  `48dp minimum height and content-driven growth: none has a fixed height that could clip its label, and ` +
  `no label is shrunk to fit. Where a label cannot fit, the collection wraps - the type never gets smaller.`)}
<div class="row">
  <div>${device(dN, scale, inner, { label: 'MOBILE NARROW &middot; 360px &middot; 100%' })}</div>
  <div style="width:${dev('standard').w}px;">${device(dev('standard'), scale, inner, { label: 'MOBILE STANDARD &middot; 412px &middot; 100%' })}</div>
  <div style="width:560px;">
    ${cap('What happens to a 104px toolbar slot as text scales')}
    <table class="t"><tr><th>Scale</th><th>Label size</th><th>Meets 48dp</th><th>Tallest control</th><th>Overflow</th></tr>${rows}</table>
    <div class="note">A 104px slot is the width a compact toolbar gives a label. At 160% two labels
    (<span dir="rtl" class="arabic">الإعدادات</span>, <span dir="rtl" class="arabic">الإشعارات</span>) no longer
    fit it; at 200% six do not. Arabic cannot be hyphenated and must not be letter-spaced or condensed, so a
    single word wider than its slot has only three honest answers: widen the slot, let the collection wrap,
    or stack the layout. Shrinking the type is not one of them, and the contract already forbids it.</div>
    <div class="sect">${cap('Touch target')}
    <div class="note">Every control here clears 48dp at every scale tested, because height is driven by
    content with a 48dp floor rather than fixed. The tallest control reaches ${Math.max(...Object.values(M.controls['200%'].narrow).map((v) => v.h))}px
    at 200% - that is the long label wrapping to five lines inside a narrow slot, which is the failure
    condition shown on TYPOGRAPHY_FAILURE_BOARD, not a healthy state.</div></div>
  </div>
</div>
</div>`;
  const width = 1620;
  return { name: 'CONTROL_LABELS', width, html: page('ctrl', body, { width, extraCSS: CSS, reporter: REPORTER }) };
}

function cap2(t) {
  return `<div class="cap2">${t}</div>`;
}

export { overview, conversation, longAnalysisMobile, longAnalysisTablet, statementBoard, metadataBoard, mixedScriptBoard, controlsBoard, CSS, M, REVIEW, dev, pct, cap2 };
