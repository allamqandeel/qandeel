/**
 * I-08B3.0-E3 - board builder, part two: the scaling matrix, the reading measure, the mark
 * QA, the stress copy, and the failure board.
 *
 * The failure board is the point of the exercise. It is built from the same measurements as
 * every other board; nothing on it is staged and nothing on it is invented.
 */
import {
  page, head, cap, esc, boardCSS, deviceCSS, device, statusbar, message, button, metaLine,
  sectionTitle, bodyPara, screenTitle, scaledRole, SYS, S, ROLES, CHROME_FACE, REPORTER,
} from './ui.mjs';
import { scaleRole } from './scale.mjs';
import { M, CSS, dev, pct, cap2 } from './build-boards.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PKG } from './ui.mjs';

const COLL = JSON.parse(readFileSync(join(PKG, 'docs', 'MEASUREMENTS_line-collision.json'), 'utf8')).results;
/** Inter-line ink clearance as a fraction of the role's own size - comparable across sizes. */
const clearEm = (k) => +(COLL[k].closestApproachBetweenLines_cssPx / COLL[k].size).toFixed(3);

/* ====================================================== 10. ACCESSIBILITY SCALE MATRIX = */

function convColumn(scale) {
  const msgs = SYS.proofA.messages.slice(0, 3).map((m) => message(m, scale)).join('');
  return `${statusbar(scale)}${screenTitle(SYS.proofA.screenTitle, scale)}
<div style="border-top:1px solid ${S.rule};margin-top:14px;">${msgs}</div>
<div style="display:flex;gap:10px;margin-top:22px;">${button(SYS.proofA.actions[0], scale, { primary: true })}${button(SYS.proofA.actions[1], scale)}</div>`;
}
function analysisColumn(scale) {
  let h = `${statusbar(scale)}${screenTitle(SYS.proofB.screenTitle, scale)}
<div style="margin-top:6px;padding-bottom:12px;border-bottom:1px solid ${S.rule};">${metaLine(SYS.proofB.meta, scale, { color: S.chrome })}</div>`;
  const s = SYS.proofB.sections[0];
  h += sectionTitle(s.h, scale);
  for (const p of s.p) h += bodyPara(p, scale);
  return h;
}
function controlColumn(scale) {
  return `${statusbar(scale)}${screenTitle('الإعدادات', scale)}
<div style="margin-top:20px;display:flex;flex-direction:column;gap:10px;">
${button('عرض التحليل', scale, { primary: true })}${button('العودة إلى الآن', scale)}</div>
<div style="margin-top:22px;display:flex;gap:8px;flex-wrap:wrap;">
${['رجوع', 'حفظ', 'مشاركة', 'الإعدادات', 'الإشعارات', 'بحث'].map((l) => button(l, scale)).join('')}</div>`;
}

function accessibilityMatrix() {
  const d = dev('narrow');
  const proofs = [
    { key: 'A', name: 'PROOF A &mdash; CONVERSATION', fn: convColumn, vh: 740 },
    { key: 'B', name: 'PROOF B &mdash; LONG ANALYSIS', fn: analysisColumn, vh: 740 },
    { key: 'F', name: 'PROOF F &mdash; CONTROLS', fn: controlColumn, vh: 740 },
  ];
  const blocks = proofs.map((p) => {
    const cols = SYS.scales.map((sc) => {
      const s = sc / 100;
      const b = scaledRole('body', s), a = scaledRole('action', s), m = scaledRole('metadata', s);
      return `<div>${device(d, s, p.fn(s), { viewportH: p.vh, label: `${sc}% &middot; body ${b.size}/${b.leading} &middot; label ${a.size}/${a.leading} &middot; meta ${m.size}/${m.leading}` })}</div>`;
    }).join('');
    return `<div class="sect">${cap(p.name + ' &mdash; 360px narrow phone at 100 / 130 / 160 / 200%')}<div class="row">${cols}</div></div>`;
  }).join('');

  const growth = SYS.roles.map((r) => {
    const cells = SYS.scales.map((sc) => {
      const g = scaleRole(r, sc / 100, 'mul');
      return `<td>${g.size}px <span style="color:${S.chrome}">&times;${g.sizeFactor}</span></td>`;
    }).join('');
    return `<tr><td>${r.name}</td><td>${r.size}px</td>${cells}</tr>`;
  }).join('');

  const flowRows = SYS.scales.map((sc) => {
    const f = M.scaleFlow[sc + '%'].mul.narrow;
    return `<tr><td>${sc}%</td><td>${f.px}px</td><td>${f.lines}</td><td>${f.charsPerLine}</td><td>${f.height}px</td><td>${(f.height / M.scaleFlow['100%'].mul.narrow.height).toFixed(2)}&times;</td></tr>`;
  }).join('');

  const body = `<div class="board">
${head('ACCESSIBILITY SCALE MATRIX &middot; 100 / 130 / 160 / 200%',
  `Text scaled with Android 14's <b>nonlinear</b> font-scaling curve, transcribed from AOSP ` +
  `<code>FontScaleConverterFactory</code> and <code>FontScaleConverterImpl</code>. Nothing here is simulated ` +
  `by multiplying the layout: only type sizes are scaled, through the platform's own lookup-and-interpolate ` +
  `tables, and every other dimension stays in dp exactly as a real device would keep it. ` +
  `Leading is a unitless multiple of the size, so each role keeps its ratio.`)}
${blocks}

<div class="sect">${cap('What the platform curve actually does to each role')}
<table class="t"><tr><th>Role</th><th>Base</th>${SYS.scales.map((s) => `<th>${s}%</th>`).join('')}</tr>${growth}</table>
<div class="note"><b>The curve is not uniform, and that is the headline.</b> At 200% METADATA doubles
(&times;2.000) while MEANINGFUL STATEMENT grows by under a quarter (&times;1.243). At 130% the statement does
not move at all (&times;1.000) while metadata grows 30%. The ratio between the largest and smallest role
therefore falls from ${(ROLES.statement.size / ROLES.metadata.size).toFixed(2)}&times; at 100% to
${(scaleRole(ROLES.statement, 2, 'mul').size / scaleRole(ROLES.metadata, 2, 'mul').size).toFixed(2)}&times; at 200%.
Hierarchy compresses as text grows. Apple's Dynamic Type behaves the same way &mdash; Body 17&rarr;53pt
(&times;3.1) against Large Title 34&rarr;60pt (&times;1.8) &mdash; and Apple states the intent directly:
&ldquo;when people increase text size&hellip; they don't always want to increase the size of every word on
the screen.&rdquo; A contract cannot assume its proportions are preserved.</div></div>

<div class="sect">${cap('Page growth - one body paragraph on the 360px phone')}
<table class="t"><tr><th>Scale</th><th>Body size</th><th>Lines</th><th>Chars / line</th><th>Block height</th><th>Growth</th></tr>${flowRows}</table>
<div class="note">Content reflows and the page gets longer. Nothing is clipped, truncated or hidden at any
scale tested. Reaching the lower content by scrolling is permitted behaviour; the dashed rule on each screen
marks where the physical viewport ends.</div></div>
</div>`;
  const width = 1720;
  return { name: 'ACCESSIBILITY_SCALE_MATRIX', width, html: page('a11y', body, { width, extraCSS: CSS, reporter: REPORTER }) };
}

/* ============================================================= 11. READING MEASURE ==== */

function readingMeasureBoard() {
  const text = SYS.proofB.sections.slice(0, 3);
  const cols = SYS.readingMeasures.map((rm) => {
    const m = M.readingMeasure.find((x) => x.width === rm.w);
    let h = '';
    for (const s of text) { h += sectionTitle(s.h, 1); for (const p of s.p) h += bodyPara(p, 1); }
    const verdict = m.wordsPerLine < 8 ? ['warn', 'short lines, frequent returns']
      : m.wordsPerLine <= 15 ? ['ok', 'comfortable']
        : ['bad', 'long lines, the return sweep starts to lose the next line'];
    return `<div style="width:${rm.w}px;">
<div class="dev-lab">${rm.w}px &middot; ${esc(rm.label)}</div>
<div style="border:1px solid ${S.rule};padding:20px 22px;background:${S.bg};">${h}</div>
<div class="spec">${m.lines} lines &middot; ${m.charsPerLine} chars/line &middot; <b>${m.wordsPerLine} words/line</b> &middot; ${m.height}px tall
<br><span class="${verdict[0]}">${verdict[1]}</span></div></div>`;
  }).join('');

  const rows = M.readingMeasure.map((r) => {
    const eye = (r.width / ROLES.body.size).toFixed(1);
    return `<tr><td>${r.width}px</td><td>${r.lines}</td><td>${r.charsPerLine}</td><td>${r.wordsPerLine}</td><td>${eye} em</td><td>${r.height}px</td><td>${esc(r.label)}</td></tr>`;
  }).join('');

  const body = `<div class="board">
${head('READING MEASURE COMPARISON &middot; PRIMARY BODY 17/30',
  `The same ${M.readingMeasureWordCount}-word passage set at five column widths, all other conditions ` +
  `identical. Measured, not preferred: line count, characters per line, words per line, and the eye-travel ` +
  `distance expressed in ems of the body size.`)}
<div class="row" style="align-items:flex-start;">${cols}</div>
<div class="sect">${cap('Measured')}
<table class="t"><tr><th>Measure</th><th>Lines</th><th>Chars / line</th><th>Words / line</th><th>Eye travel</th><th>Height</th><th>Context</th></tr>${rows}</table>
<div class="note">
<b>Reading the numbers.</b> Arabic words in this passage average
${(M.readingMeasure[0].charsPerLine / M.readingMeasure[0].wordsPerLine).toFixed(1)} characters, so the
familiar Latin 45&ndash;75 character guidance does not transfer directly; words per line is the more honest
quantity for Arabic, and the return sweep is what tires the eye.<br><br>
At <b>328px</b> the line carries ${M.readingMeasure[0].wordsPerLine} words. The passage runs to
${M.readingMeasure[0].lines} lines and the eye returns constantly; acceptable on a phone because there is no
alternative, but it is the least comfortable condition in the set, not the best.<br><br>
At <b>704px</b> &mdash; a 768px tablet with nothing holding the text back &mdash; the line carries
${M.readingMeasure[4].wordsPerLine} words over ${(704 / ROLES.body.size).toFixed(0)} ems of travel. Losing
your place on the return sweep becomes likely, and the paragraph loses its rhythm: this is the condition the
contract's reading-column principle exists to prevent.<br><br>
Measured against a 10&ndash;15 words-per-line target, <b>480px (${M.readingMeasure[1].wordsPerLine} words)</b>
and <b>560px (${M.readingMeasure[2].wordsPerLine} words)</b> are comfortable, while <b>640px
(${M.readingMeasure[3].wordsPerLine} words)</b> is already long. The upper boundary therefore lies between
560px and 640px, and a reading column in the region of <b>520&ndash;600px</b> is where this passage holds its
shape best. That is a range offered for judgement and not a token: the right value also depends on gutters,
on whether a second column of interface sits beside the text, and on the tablet sizes the product actually
supports. It is also worth noting that the conversation view on a 768px tablet runs to
${M.scaleFlow['100%'].mul.tablet.wordsPerLine} words per line for the same reason, so whatever measure is
chosen, the question is not confined to the analysis screen.</div></div>
</div>`;
  const width = 3020;
  return { name: 'READING_MEASURE_COMPARISON', width, html: page('rm', body, { width, extraCSS: CSS, reporter: REPORTER }) };
}

/* ================================================================= 12. DIACRITIC QA === */

function diacriticBoard() {
  const K = SYS.diacritics.knownIssue;
  const sampleList = SYS.diacritics.samples.map((s) => {
    const m = M.diacritics.samples[s];
    return `<div style="margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #191C21;">
<div class="arabic" style="font-size:56px;line-height:1.7;">${esc(s)}</div>
<div class="spec">ink ${m.up} em above baseline, ${m.down} em below, extent ${m.extent} em</div></div>`;
  });
  const samples = `<div class="row" style="gap:28px;">
<div style="width:330px;">${sampleList.slice(0, 3).join('')}</div>
<div style="width:330px;">${sampleList.slice(3).join('')}</div></div>`;

  const atSize = [ROLES.statement.size, ROLES.body.size, ROLES.metadata.size].map((px) => {
    const lh = SYS.roles.find((r) => r.size === px).leading;
    return `<div style="margin-bottom:22px;">
<div class="spec" style="margin-bottom:6px;">${px} / ${lh}</div>
<div class="arabic" style="font-size:${px}px;line-height:${lh}px;max-width:620px;">${esc(SYS.proofG.vocalised)}</div></div>`;
  }).join('');

  const pairs = K.pairs.map((p) => {
    const m = M.diacritics.knownIssue[p.base];
    return `<div style="width:230px;text-align:center;border:1px solid ${S.rule};padding:18px 10px;">
<div class="spec" style="text-align:center;margin:0 0 12px;">${esc(p.base)}</div>
<div class="arabic" style="font-size:96px;line-height:1.9;text-align:center;direction:rtl;">${esc(p.m)}</div>
<div class="spec" style="text-align:center;">U+0651 + <b>U+064D</b><br>combining kasratan<br>
ink ceiling ${m.modern_064D.up} em<br>
<span class="${m.modernRaisesCeiling ? 'bad' : 'ok'}">${m.modernRaisesCeiling ? 'ABOVE the shadda' : 'below the shadda'}</span></div>
<div style="border-top:1px solid ${S.rule};margin:14px 0;"></div>
<div class="arabic" style="font-size:96px;line-height:1.9;text-align:center;direction:rtl;">${esc(p.l)}</div>
<div class="spec" style="text-align:center;">U+0651 + <b>U+FE74</b><br>isolated presentation form<br>
ink floor ${m.legacy_FE74.down} em<br>
<span class="ok">does not raise the ceiling</span></div></div>`;
  }).join('');

  const stackRows = Object.entries(M.diacritics.stacks).map(([k, v]) =>
    `<tr><td>${esc(k)}</td><td>${v.text}</td><td>${v.up}</td><td>${v.down}</td><td>${v.extent}</td></tr>`).join('');

  const body = `<div class="board">
${head('DIACRITIC QA &middot; ESTEDAD v8.5',
  `Mark placement, stacking and clearance. Nothing is repaired: these are the font's own glyphs and its own ` +
  `GPOS positioning, rendered as shipped. The open upstream report ` +
  `<code>aminabedi68/Estedad #39</code> is reproduced and measured rather than repeated.`)}

${cap('The requested mark samples, at 56px')}${samples}
<div class="sect">${cap('A fully vocalised sentence at three product sizes')}${atSize}
<div class="note" style="max-width:900px;">Fully vocalised Arabic measures ${M.lineBox.body.vocalisedInk_em} em
of ink against ${M.lineBox.body.plainInk_em} em for the same prose unvocalised. QANDEEL's own content is
unvocalised except for occasional tanween, so the fully-marked case above is the worst case, not the normal
one.</div></div>

<div class="sect">${cap('The known issue, reproduced - shadda followed by kasratan')}
<div class="note" style="max-width:1180px;margin-bottom:18px;">
Upstream issue #39, open against v8.5, reports that &ldquo;U+FE74&rdquo; after shadda &ldquo;is
mispositioned, it should be below Shadda, not above it&rdquo;. Both encodings were rendered and measured.
<b>The defect is real but the issue names the wrong codepoint.</b> U+FE74 is ARABIC KASRATAN ISOLATED FORM,
a spacing presentation-form glyph, and it does not raise the ink ceiling on any of the four bases tested. The
codepoint a keyboard and an IME actually produce is U+064D, the combining kasratan &mdash; and that is the one
Estedad v8.5 places <b>above</b> the shadda on all four bases, where it belongs below.</div>
<div class="row">${pairs}</div>
<div class="sect">${cap('The same defect at the sizes the product actually sets')}
<div class="row">
${[ROLES.statement.size, ROLES.body.size, ROLES.metadata.size].map((px) => `<div style="width:280px;">
<div class="spec" style="margin-bottom:6px;">${px}px</div>
<div class="arabic" style="font-size:${px}px;line-height:${Math.round(px * 1.9)}px;">مُهِمٌّ &nbsp; بِّ &nbsp; قِّ &nbsp; مَرَّةٌ</div></div>`).join('')}
<div style="width:520px;"><div class="note" style="margin-top:0;">At ${ROLES.body.size}px and below the
misplaced kasratan is a mark of roughly one pixel. It reads as slightly heavier vocalisation rather than as
an error, and no collision with the line above occurs at the contract's body leading. At 32px it is plainly
visible. The severity therefore scales with the size the product chooses to set vocalised text at, and
QANDEEL sets almost none.</div></div>
</div></div>
<div class="note" style="max-width:1180px;">
<b>Measured severity.</b> The defect requires the exact sequence shadda + kasratan on the same base. It does
not affect unvocalised prose, and it does not affect the tanween forms QANDEEL's content does use
(<span dir="rtl" class="arabic">حقيقيًا</span>, <span dir="rtl" class="arabic">مرةً</span>) because those
carry no shadda. It does affect fully vocalised text, which is a real QANDEEL case only if the product ever
sets Qur'anic quotation, classical poetry, or teaching material with full tashkeel. Nothing is edited here
and nothing is worked around: it is recorded, with its trigger and its blast radius.</div></div>

<div class="sect">${cap('Mark stacking - measured ink, in ems from the baseline')}
<table class="t"><tr><th>Combination</th><th>Codepoints</th><th>Above baseline</th><th>Below baseline</th><th>Extent</th></tr>${stackRows}</table>
<div class="note">The tallest stack in the set is qaf + shadda + dammatan at 1.104 em above the baseline
&mdash; the pattern in <span dir="rtl" class="arabic">مُهِمٌّ</span>. A standalone shadda + fatha with no base
sits entirely above the baseline (floor &minus;0.34 em), which is the v8.4 adjustment for marks used without
a base behaving as intended.</div></div>
</div>`;
  const width = 1420;
  return { name: 'DIACRITIC_QA', width, html: page('dia', body, { width, extraCSS: CSS, reporter: REPORTER }) };
}

/* ================================================================== 13. STRESS COPY === */

function stressBoard() {
  const G = SYS.proofG, d = dev('narrow');
  const b = ROLES.body, t = ROLES.screenTitle, mt = ROLES.metadata;
  const inner = `${statusbar(1)}
<div class="arabic" style="font-size:${t.size}px;line-height:${t.leading}px;font-weight:${t.weight};padding-top:10px;">${esc(G.longTitle)}</div>
<div style="margin-top:12px;">${metaLine(G.twoLineMeta, 1, { color: S.chrome })}</div>
<div style="margin-top:10px;">${metaLine(G.denseDateTime, 1, { color: S.chrome })}</div>
<div style="margin-top:20px;">${bodyPara(G.longMixed, 1)}</div>
<div style="margin-top:6px;">${bodyPara(G.punctuation, 1)}</div>
<div style="margin-top:6px;">${bodyPara(G.brackets, 1)}</div>
<div style="margin-top:6px;">${bodyPara(G.identifierProse, 1)}</div>
<div style="margin-top:18px;"><div class="arabic" style="font-size:${b.size}px;line-height:${Math.round(b.size * 1.95)}px;">${esc(G.vocalised)}</div></div>
<div style="margin-top:22px;display:flex;">${button(G.longAction, 1, { primary: true })}</div>`;

  const narrowSlot = `<div style="width:104px;">${button(G.longAction, 1)}</div>`;

  const body = `<div class="board">
${head('PROOF G &middot; STRESS COPY',
  `Deliberately difficult content: an over-long title, an over-long action label, a long mixed-script ` +
  `sentence, two-line metadata, a dense date and time, stacked punctuation, brackets, percentages, ` +
  `identifiers inside prose, and a fully vocalised sentence. The copy is not prettified to make it fit.`)}
<div class="row">
  <div>${device(d, 1, inner, { viewportH: 740 })}</div>
  <div>${device(dev('standard'), 1, inner, { viewportH: 820 })}</div>
  <div style="width:640px;">
    ${cap('What each stress case does')}
    <table class="t"><tr><th>Case</th><th>Behaviour</th></tr>
    <tr><td>Over-long screen title</td><td class="ok">wraps to multiple lines, never truncated</td></tr>
    <tr><td>Over-long action label, full width</td><td class="ok">wraps; control grows in height</td></tr>
    <tr><td>Over-long action label, 104px slot</td><td class="bad">word wider than the slot &mdash; see below</td></tr>
    <tr><td>Long mixed Arabic / English sentence</td><td class="ok">Latin runs stay LTR inside RTL flow</td></tr>
    <tr><td>Two-line metadata at 12/20</td><td class="ok">wraps on the separator, stays legible</td></tr>
    <tr><td>Dense date and time</td><td class="ok">Arabic-Indic digits, no reordering</td></tr>
    <tr><td>Stacked punctuation &lsquo;؟!&rsquo; &laquo;&raquo; &mdash; ;&hellip;</td><td class="ok">correct sides, correct mirroring</td></tr>
    <tr><td>Brackets ( ) [ ] { } around identifiers</td><td class="ok">mirrored correctly by the engine</td></tr>
    <tr><td>Fully vocalised sentence at 17px</td><td class="warn">needs 1.95 leading, not the contract's 1.765</td></tr>
    </table>
    <div class="sect">${cap('The 104px slot, at 100%')}
    ${narrowSlot}
    <div class="note">The same label the full-width control handles on one line becomes a five-line block in a
    narrow slot. This is correct behaviour for the rules as written &mdash; wrap rather than shrink &mdash;
    but it is also the shape of the failure: a slot this narrow should not be given a label this long, and
    the answer is a shorter label or a wider slot, never smaller type.</div></div>
  </div>
</div>
</div>`;
  const width = 1620;
  return { name: 'STRESS_COPY', width, html: page('stress', body, { width, extraCSS: CSS, reporter: REPORTER }) };
}

/* ============================================================== 14. FAILURE BOARD ===== */

function failureBoard() {
  const d = dev('narrow');

  /* F1 - roles whose line is shorter than their own vocalised ink */
  const bad = SYS.roles.filter((r) => !M.lineBox[r.key].vocalisedFits);
  const tight = SYS.roles.filter((r) => M.lineBox[r.key].vocalisedFits && M.lineBox[r.key].headroom_px < 1);
  const f1 = bad.map((r) => {
    const lb = M.lineBox[r.key];
    const c = COLL[r.key];
    return `<div style="width:520px;margin-bottom:26px;">
<div class="spec" style="margin-bottom:6px;">${r.name} &mdash; ${r.size}/${r.leading}, ratio ${(r.leading / r.size).toFixed(3)}</div>
<div style="border:1px solid #3A2C2C;padding:14px 16px;">
<div class="arabic" style="font-size:${r.size}px;line-height:${r.leading}px;font-weight:${r.weight};">${esc(SYS.proofG.vocalised)}</div></div>
<div class="spec"><span class="warn">worst-case vocalised ink ${lb.vocalisedInk_px}px against a ${r.leading}px line &mdash; short by ${(-lb.headroom_px).toFixed(2)}px</span>
<br><span class="ok">measured clearance between adjacent lines: ${c.closestApproachBetweenLines_cssPx}px (${clearEm(r.key)} em) &mdash; no collision</span></div></div>`;
  }).join('');

  /* F2 - the sp leading model at 200% */
  const spRows = SYS.roles.map((r) => {
    const mul = scaleRole(r, 2, 'mul'), sp = scaleRole(r, 2, 'sp');
    const bad2 = sp.ratio < 1.6;
    return `<tr><td>${r.name}</td><td>${(r.leading / r.size).toFixed(3)}</td><td>${mul.size}/${mul.leading} &mdash; ${mul.ratio}</td>
<td class="${bad2 ? 'bad' : 'ok'}">${sp.size}/${sp.leading} &mdash; ${sp.ratio}</td></tr>`;
  }).join('');
  const spDemo = ['mul', 'sp'].map((model) => {
    const s = scaleRole(ROLES.body, 2, model);
    return `<div style="width:420px;">
<div class="spec" style="margin-bottom:6px;">${model === 'mul' ? 'leading as a multiplier' : 'leading as an absolute sp value'} &mdash; ${s.size}/${s.leading}, ratio ${s.ratio}</div>
<div style="border:1px solid ${model === 'sp' ? '#3A2C2C' : S.rule};padding:14px 16px;">
<div class="arabic" style="font-size:${s.size}px;line-height:${s.leading}px;">${esc(SYS.proofB.sections[0].p[0].slice(0, 150))}</div></div></div>`;
  }).join('');

  /* F3 - hierarchy compression */
  const hier = [1, 2].map((sc) => {
    const st = scaleRole(ROLES.statement, sc, 'mul'), mt = scaleRole(ROLES.metadata, sc, 'mul');
    const se = scaleRole(ROLES.sectionTitle, sc, 'mul'), bd = scaleRole(ROLES.body, sc, 'mul');
    return `<div style="width:420px;">
<div class="spec" style="margin-bottom:8px;">${pct(sc)} &mdash; statement &divide; metadata = <b>${(st.size / mt.size).toFixed(2)}&times;</b>, section title &divide; body = <b>${(se.size / bd.size).toFixed(2)}&times;</b></div>
<div style="border:1px solid ${S.rule};padding:16px 18px;">
<div class="arabic" style="font-size:${st.size}px;line-height:${st.leading}px;font-weight:500;">أنت تتردد بعد أن يصبح حقيقيًا.</div>
<div class="arabic" style="font-size:${se.size}px;line-height:${se.leading}px;font-weight:600;margin-top:14px;">ما الذي تفعله المراجعة</div>
<div class="arabic" style="font-size:${bd.size}px;line-height:${bd.leading}px;margin-top:8px;">يظهر في حديثك نمط ثابت لا يتعلق بصعوبة الاختيار.</div>
<div class="arabic" style="font-size:${mt.size}px;line-height:${mt.leading}px;color:${S.secondary};margin-top:10px;">آخر تحديث ١٤ سبتمبر، ٨:٣٤ م</div>
</div></div>`;
  }).join('');

  /* F4 - the narrow slot at 200% */
  const slot200 = `<div style="display:flex;gap:18px;">
${[1, 2].map((sc) => `<div style="width:104px;">
<div class="spec" style="margin-bottom:6px;">${pct(sc)}</div>${button('الإشعارات', sc)}</div>`).join('')}
<div style="width:300px;"><div class="spec" style="margin-bottom:6px;">200%, the word alone</div>
<div class="arabic" style="font-size:${scaleRole(ROLES.action, 2, 'mul').size}px;line-height:${scaleRole(ROLES.action, 2, 'mul').leading}px;font-weight:500;">الإشعارات</div>
<div class="spec"><span class="bad">${M.controls['200%'].narrow['narrow|الإشعارات'].textW}px of text in a 104px slot (76px content box)</span></div></div></div>`;

  /* F5 - statement at 32 on a 360 phone */
  const stmtNarrow = device(d, 1, `${statusbar(1)}<div style="padding-top:40px;">
<div class="arabic" style="font-size:${ROLES.statement.size}px;line-height:${ROLES.statement.leading}px;font-weight:500;">${esc(SYS.proofC.statement).replace(/\n/g, '<br>')}</div></div>`,
    { label: 'MEANINGFUL STATEMENT 32/50 on a 360px phone' });
  const stmtNarrow26 = device(d, 1, `${statusbar(1)}<div style="padding-top:40px;">
<div class="arabic" style="font-size:26px;line-height:42px;font-weight:500;">${esc(SYS.proofC.statement).replace(/\n/g, '<br>')}</div></div>`,
    { label: 'the same statement at 26/42' });

  /* F6 - metadata at the smallest size */
  const metaSmall = `<div style="border:1px solid ${S.rule};padding:16px 18px;width:420px;">
${metaLine(SYS.proofG.twoLineMeta, 1, { color: S.secondary })}
<div style="margin-top:12px;">${metaLine(SYS.proofG.twoLineMeta, 1, { color: S.chrome })}</div></div>
<div class="spec">top: secondary ink, measured ${M.contrast.secondary.ratio}:1 &mdash; bottom: chrome ink, measured ${M.contrast.chrome.ratio}:1</div>`;

  const body = `<div class="board">
${head('TYPOGRAPHY FAILURE BOARD',
  `Where the proposed contract becomes weak. Every case below is reproduced from the same measurements and ` +
  `the same content as the other boards. None is staged and none is invented; the stress conditions that ` +
  `passed are listed at the foot of the board so the absence of a failure there means something.`)}

<div class="sect">${cap('F1 &mdash; three roles have no margin over fully vocalised Arabic (but nothing collides)')}
<div class="note" style="max-width:1100px;margin-bottom:16px;">
A fully vocalised Arabic sentence measures ${M.lineBox.statement.vocalisedInk_em} em of ink in this typeface,
so <b>MEANINGFUL STATEMENT (ratio 1.563), SECTION TITLE (1.600) and NUMERIC READING (1.500)</b> declare a line
shorter than their own worst-case ink, and <b>ACTION / LABEL</b> clears it by
${M.lineBox.action.headroom_px}px, which is not a margin.<br><br>
<b>That arithmetic says the line boxes overlap. It does not say the ink touches, and this package checked
rather than assumed.</b> Each role's worst case was set as a real multi-line block and the rendered pixels
were read back: for every pixel column, the longest unbroken vertical run of ink, and the closest approach
between the ink of adjacent lines. <b>No role collides.</b> The tallest mark and the deepest descender of a
line are simply never in the same column. The overlap is therefore a <i>latent</i> condition &mdash; there is
no clearance left for content with heavier vocalisation than this &mdash; and not a defect visible today.</div>
<div class="row">${f1}</div>
<div class="sect" style="margin-top:22px;">${cap('Measured on rendered pixels, not arithmetic')}
<table class="t"><tr><th>Role</th><th>Ratio</th><th>Line boxes overlap</th><th>Longest ink run</th><th>One line can occupy</th><th>Ink collides</th><th>Closest approach between lines</th></tr>
${SYS.roles.map((r) => { const c = COLL[r.key]; return `<tr><td>${r.name}</td><td>${c.ratio}</td>
<td class="${c.boxesOverlapBy_px > 0 ? 'warn' : ''}">${c.boxesOverlapBy_px > 0 ? `yes, by ${c.boxesOverlapBy_px}px` : 'no'}</td>
<td>${c.longestInkRun_devicePx} device px</td><td>${c.oneLineInk_devicePx} device px</td>
<td class="${c.inkActuallyCollides ? 'bad' : 'ok'}">${c.inkActuallyCollides ? 'YES' : 'no'}</td>
<td>${c.closestApproachBetweenLines_cssPx}px &nbsp;<span style="color:${S.chrome}">(${clearEm(r.key)} em)</span></td></tr>`; }).join('')}</table>
<div class="note">Clearance expressed in ems of each role's own size is the comparable figure, and it ranks
exactly as the ratios predict: <b>NUMERIC READING ${clearEm('numeric')} em</b> and
<b>SECTION TITLE ${clearEm('sectionTitle')} em</b> are the tightest, <b>PRIMARY BODY ${clearEm('body')} em</b>
the most comfortable. Unvocalised prose &mdash; which is what QANDEEL actually sets &mdash; measures
${M.lineBox.body.plainInk_em} em and leaves considerably more than this.</div></div></div>

<div class="sect">${cap('F2 &mdash; the leading model decides whether the system survives 200%')}
<div class="note" style="max-width:1100px;margin-bottom:16px;">
The contract states each role as a &ldquo;size / leading&rdquo; pair but does not say whether the leading is
an absolute value or a multiple of the size. If it is absolute and expressed in sp, it goes through the
platform's nonlinear curve <i>independently</i> of the size &mdash; and because the curve flattens for larger
numbers, the leading grows more slowly than the text it has to contain. Every role falls below the Arabic
floor, and PRIMARY BODY collapses from 1.765 to 1.310.</div>
<div class="row">${spDemo}</div>
<table class="t" style="margin-top:20px;"><tr><th>Role</th><th>Ratio at 100%</th><th>At 200%, leading as a multiplier</th><th>At 200%, leading as absolute sp</th></tr>${spRows}</table></div>

<div class="sect">${cap('F3 &mdash; hierarchy compresses as text scales, on both platforms')}
<div class="row">${hier}</div>
<div class="note">Nothing is broken here and nothing is clipped &mdash; but the distance between the loudest
and the quietest role nearly halves. A hierarchy that depends on the 32:12 relationship reading as
&ldquo;much larger&rdquo; will not read that way for the people who most need the larger text.</div></div>

<div class="sect">${cap('F4 &mdash; a single Arabic word outgrows a narrow slot at 200%')}
${slot200}
<div class="note" style="max-width:1100px;">Arabic does not hyphenate, must not be letter-spaced, and must not
be condensed, so there is no typographic escape: the word is simply wider than the box. At 160% two labels in
the set exceed a 104px slot; at 200%, six do. The answer is a wider slot, a wrapped collection or a stacked
layout &mdash; all of which are layout decisions, not typography ones.</div></div>

<div class="sect">${cap('F5 &mdash; is 32 too large for the narrow phone it has to live on?')}
<div class="row">${stmtNarrow}${stmtNarrow26}
<div style="width:460px;">
<div class="note" style="margin-top:34px;">At 32/50 on a 360px screen the statement takes
${Math.ceil(ROLES.statement.leading * 2)}px of height for two lines and leaves little room above the fold for
the supporting sentence that gives it its evidence. At 26/42 the same statement keeps its weight in the
hierarchy and returns roughly ${(ROLES.statement.leading - 42) * 2}px. This is a product judgement about how
much of the first screen a single sentence should own, not a legibility failure &mdash; 32 is perfectly
legible. It is offered as an observation, not a correction.</div></div></div></div>

<div class="sect">${cap('F6 &mdash; metadata at 12px on the dark ground')}
<div class="row">${metaSmall}
<div style="width:620px;"><div class="note" style="margin-top:0;">
12/20 holds up at ${M.contrast.secondary.ratio}:1 in secondary ink: the counters stay open and the
Arabic-Indic digits stay distinct at this size in Estedad. The lower line shows the same string in the board's
chrome grey at ${M.contrast.chrome.ratio}:1 &mdash; below the 4.5:1 that normal-size text needs, and shown here
only to mark where the floor is. <b>This is a colour observation, and colour is not being decided in this
task</b>; it matters only as a warning that the METADATA role has no contrast headroom to give away, because
it is the smallest text in the system and the most likely to be set in the quietest ink.</div></div></div></div>

<div class="sect">${cap('Stress conditions that were tried and did NOT fail')}
<div class="note" style="max-width:1180px;">
These are recorded so that their absence from the list above is informative rather than an oversight.
<b>Line collision:</b> every role was set as a multi-line block of fully vocalised Arabic and the rendered
pixels were read column by column; no role produced a single collision, and the closest approach between
adjacent lines was ${Math.min(...SYS.roles.map((r) => COLL[r.key].closestApproachBetweenLines_cssPx))}px at the
tightest. <b>Bidirectional layout:</b> all ${Object.keys(M.bidiHard).length} hard cases (trailing Latin token before an
Arabic full stop, Arabic comma after an identifier, parenthesised identifier, two adjacent Latin runs, a hash
and digits, an Arabic-Indic percentage, a version token mid-sentence) laid out correctly, and adding explicit
isolates changed nothing &mdash; so no directional hack is warranted.
<b>Mixed-script size balance:</b> Arabic stands ${((M.mixedScript.arabicToLatinCap - 1) * 100).toFixed(1)}% taller than Latin
capitals at the same nominal size, so the contract's no-correction rule holds and a &plusmn;2px adjustment would
over-correct. <b>The Latin lowercase &lsquo;i&rsquo;</b> (upstream issue #44) renders correctly here: it carries
a ${M.latinI.i_advance_100px}px advance at 100px and its tittle sits at ${M.latinI.i_ink.up} em, and
&ldquo;Confidence&rdquo; is exactly that much wider than &ldquo;Confdence&rdquo;. <b>Truncation:</b> nothing was
truncated or clipped at any scale on any device tested. <b>Touch targets:</b> every control cleared 48dp at
every scale. <b>Digit alignment:</b> both digit systems reach the same tabular advance, so a mixed column still
aligns. <b>Weights:</b> 400 / 500 / 600 stayed distinguishable in a single ink at every role size.</div></div>
</div>`;
  const width = 1820;
  return { name: 'TYPOGRAPHY_FAILURE_BOARD', width, html: page('fail', body, { width, extraCSS: CSS, reporter: REPORTER }) };
}

export { accessibilityMatrix, readingMeasureBoard, diacriticBoard, stressBoard, failureBoard };
