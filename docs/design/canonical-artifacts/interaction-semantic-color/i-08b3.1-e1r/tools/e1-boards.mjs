/**
 * I-08B3.1-E1 — THE PROOF BOARDS.
 *
 * Real QANDEEL UI, not abstract rectangles, and not colour chips. Where a board does show
 * a chip it is BESIDE the control that carries it, because a chip on its own is the thing
 * the brief lists as a failure condition.
 *
 * The board annotation is review apparatus and most of it is English. An English sentence
 * sitting in an RTL block has its neutral punctuation reordered — the full stop and the
 * question mark jump to the wrong end — so every English run is an isolated LTR island,
 * which is the same rule the product copy obeys for its own LTR islands.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { page, palette, row, navBar, navItem, button, field, opt, statusBlock, canonicalQ, AR } from './e1-scene.mjs';

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..');
/** THE BOARD READS THE SHIPPED TOKEN FILE, NOT THE MODULE THAT WROTE IT. A proof board
 *  drawing a contract from the source that generated the contract proves the source. */
const COMPOSITION = JSON.parse(readFileSync(join(PKG, 'tokens/base/interaction.tokens.json'), 'utf8'))
  .qandeel.state.$extensions['com.qandeel.composition'];

const cap = (t) => `<p class="cap">${t}</p>`;
/** Arabic and English on one line: each run isolated, so neither reorders the other. */
const h3 = (ar, en) => `<h3><span>${ar}</span> <span class="en">&middot; ${en}</span></h3>`;
const cell = (lab, inner, plate = 'on-surface') =>
  `<div class="cell"><span class="lab">${lab}</span><div class="plate ${plate}">${inner}</div></div>`;

const STATES = [['REST', ''], ['PRESSED', 'pressed'], ['FOCUS', 'focus'], ['SELECTED', 'selected'], ['DISABLED', 'disabled']];

/* ---------------------------------------------------------------- B01 / B02 matrix -- */
function stateMatrix(ground) {
  const plate = ground === 'WORLD' ? 'on-world' : 'on-surface';
  const arGround = ground === 'WORLD' ? 'العالَم' : 'السطح الوظيفي';
  const grid = STATES.map(([name, s]) => `
    <div class="cell"><span class="lab">${name}</span>
      <div class="plate ${plate}" style="display:flex;flex-direction:column;gap:18px">
        ${row(AR.worlds[0][0], AR.worlds[0][1], s)}
        <div style="display:flex">${button(AR.save, s)}</div>
        ${field('f-' + name + '-' + ground.slice(0, 3), AR.nameLabel, name === 'DISABLED' ? AR.nameValue : 'مشروع قنديل', { state: s === 'focus' ? 'focus' : '' })}
      </div>
    </div>`).join('');
  return page({
    title: `E1 state matrix on the ${ground}`, width: 1180,
    body: `<div class="board">
      ${h3('الحالات الخمس على ' + arGround, 'THE FIVE STATES ON THE ' + ground)}
      ${cap('Three control morphologies &mdash; a list row, a button, a field &mdash; in every state. PRESSED owns the ground, FOCUS a detached perimeter, SELECTED the marker&rsquo;s presence and the type weight, DISABLED availability. THE INK IS SHARED BY SELECTED AND DISABLED and is resolved by precedence, which is what board b17 is for: I-08B3.1-E1 said no channel was used twice, and that was false as it was written.')}
      <div class="grid" style="grid-template-columns:repeat(5,1fr)">${grid}</div>
    </div>`,
  });
}

/* ------------------------------------------------------------------------ B03 focus - */
function focusProof() {
  const morph = (lab, inner, plate) => cell(lab, `<div style="display:flex;flex-direction:column;gap:20px">${inner}</div>`, plate);
  const set = (plate) => [
    morph('LIST ROW', row(AR.worlds[1][0], AR.worlds[1][1], 'focus'), plate),
    morph('BUTTON', `<div style="display:flex">${button(AR.invite, 'focus')}</div>`, plate),
    morph('FIELD', field('ff-' + plate, AR.nameLabel, 'القراءة الليلية', { state: 'focus' }), plate),
    morph('NAV ITEM', `<div class="nav" style="background:transparent;padding:0">${navItem(AR.nav[2], 'focus')}</div>`, plate),
  ].join('');
  return page({
    title: 'E1 focus proof', width: 1180,
    body: `<div class="board">
      ${h3('برهان التركيز', 'FOCUS, ON FOUR MORPHOLOGIES AND ON BOTH GROUNDS')}
      ${cap('The indicator is DETACHED &mdash; it sits outside the control, separated by a gap as wide as its own line, so it reads as apparatus adjacent to the object rather than as a property of it. The dark companion outside it is not decoration: the indicator alone reaches 3:1 against only the two grounds and the two pressed grounds, and fails against every ink, against the identity material, against the Light and against the error. The pair reaches 3:1 against all of them.')}
      <span class="lab">ON THE FUNCTIONAL SURFACE</span>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">${set('on-surface')}</div>
      <span class="lab">ON THE WORLD</span>
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">${set('on-world')}</div>
    </div>`,
  });
}

/* -------------------------------------------------------- B04 selected vs focused --- */
function selectedVsFocus() {
  const list = (items) => `<div class="plate on-surface" style="display:flex;flex-direction:column;gap:4px">${items}</div>`;
  return page({
    title: 'E1 selected is not focused', width: 1160,
    body: `<div class="board">
      ${h3('المختار ليس المركَّز عليه', 'SELECTED IS NOT FOCUSED')}
      ${cap('Four rows in ONE list. The first is SELECTED and not focused; the second is FOCUSED and not selected; the third is BOTH; the fourth is neither. The marker is attached to the row&rsquo;s inline-start edge &mdash; the RIGHT edge in RTL &mdash; and the indicator is detached outside it, so the two compose on the third row without either becoming ambiguous.')}
      <div class="grid" style="grid-template-columns:1fr 1fr">
        <div class="cell"><span class="lab">A SELECTED, NOT FOCUSED &nbsp;|&nbsp; B FOCUSED, NOT SELECTED &nbsp;|&nbsp; C BOTH &nbsp;|&nbsp; D NEITHER</span>
        ${list([
    row(AR.worlds[0][0], AR.worlds[0][1], 'selected'),
    row(AR.worlds[1][0], AR.worlds[1][1], 'focus'),
    row(AR.worlds[2][0], AR.worlds[2][1], 'selected focus'),
    row(AR.worlds[3][0], AR.worlds[3][1], ''),
  ].join(''))}</div>
        <div class="cell"><span class="lab">THE SAME DISTINCTION IN THE NAVIGATION &mdash; selected on one item, focus on another</span>
          <div class="plate on-surface" style="padding:0">${navBar(2, { 0: 'focus' })}</div>
          <span class="lab" style="margin-block-start:14px">SELECTED AND FOCUSED AT ONCE, ON ONE ITEM</span>
          <div class="plate on-surface" style="padding:0">${navBar(2, { 2: 'focus' })}</div>
        </div>
      </div>
    </div>`,
  });
}

/* ------------------------------------------------------ B05 pressed vs selected ----- */
function pressedVsSelected() {
  const strip = (lab, steps) => `<div class="cell"><span class="lab">${lab}</span>
    <div class="plate on-surface" style="display:flex;gap:16px;align-items:stretch">
      ${steps.map(([n, s]) => `<div style="flex:1 1 0;display:flex;flex-direction:column;gap:7px"><span class="lab">${n}</span>${row(AR.worlds[0][0], AR.worlds[0][1], s)}</div>`).join('')}
    </div></div>`;
  return page({
    title: 'E1 pressed is not selected', width: 1180,
    body: `<div class="board">
      ${h3('الضغط ليس الاختيار', 'PRESSED IS NOT SELECTED')}
      ${cap('PRESSED is transient and lives on the GROUND; SELECTED is persistent and lives on the OBJECT. A press that is released leaves the row exactly as it found it. A press that commits leaves a marker and a promotion of ink and weight, and the ground returns to rest either way. THE SEPARATION FROM A MEANING EVENT IS BEHAVIOURAL, NOT CHROMATIC: a meaning event rises, decays and reaches exactly zero, and a press has no lifecycle at all. The wash is made from the Product&rsquo;s own reading ink, which check R11 holds on the chain rather than on the composited chroma &mdash; at these alphas over a near-black ground almost any wash composites to a nearly achromatic value.')}
      ${strip('REST &rarr; PRESSED &rarr; RELEASED &nbsp;(nothing persists)', [['REST', ''], ['PRESSED', 'pressed'], ['RELEASED', '']])}
      ${strip('REST &rarr; PRESSED &rarr; SELECTED &nbsp;(the marker persists)', [['REST', ''], ['PRESSED', 'pressed'], ['SELECTED', 'selected']])}
      ${strip('AND THEY COMPOSE &mdash; a SELECTED row being pressed again', [['SELECTED', 'selected'], ['SELECTED + PRESSED', 'selected pressed'], ['SELECTED', 'selected']])}
    </div>`,
  });
}

/* ------------------------------------------------------------------- B06 error ------ */
function errorProof() {
  return page({
    title: 'E1 error proof', width: 1160,
    body: `<div class="board">
      ${h3('الخطأ', 'ERROR &mdash; THE ONLY ROLE THAT HAS EARNED A HUE, AND WHAT IT SHIPS WITH')}
      ${cap('Colour is never the sole carrier. E1 measured the alternative WCAG 2.2 SC 1.4.1 allows &mdash; a lightness difference at a contrast ratio of 3:1 or greater &mdash; and the error ink reaches only 1.03:1 against the secondary reading ink and 1.58:1 against the tertiary. THE LIGHTNESS ROUTE IS NOT AVAILABLE HERE, so the glyph, the copy and the promoted boundary are load-bearing rather than belt-and-braces.')}
      <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
        ${cell('FIELD VALIDATION &mdash; Arabic, formal register', field('e1', AR.nameLabel, AR.nameValue, { status: 'error', msg: AR.nameError }))}
        ${cell('MIXED DIRECTION &mdash; an LTR island inside RTL', field('e2', AR.mailLabel, AR.mailValue, { status: 'error', msg: AR.mailError, ltr: true }))}
        ${cell('AN OPERATION THAT FAILED', `<div style="display:flex;flex-direction:column;gap:14px">${statusBlock('error', AR.syncError)}<div style="display:flex">${button(AR.retry)}</div></div>`)}
      </div>
      <div class="grid" style="grid-template-columns:1fr 1fr">
        ${cell('THE ERROR FIELD, FOCUSED &mdash; two systems on one control, neither obscuring the other', field('e3', AR.nameLabel, AR.nameValue, { status: 'error', msg: AR.nameError, state: 'focus' }))}
        ${cell('THE SAME FIELD ON THE WORLD', field('e4', AR.nameLabel, AR.nameValue, { status: 'error', msg: AR.nameError }), 'on-world')}
      </div>
    </div>`,
  });
}

/* ------------------------------------------- B07 the three colourless status roles -- */
function roleProofs() {
  return page({
    title: 'E1 warning success informational', width: 1180,
    body: `<div class="board">
      ${h3('ثلاثة أدوار بلا لون خاص بعد', 'THREE ROLES THAT ARE KEPT AND HAVE NOT EARNED A HUE')}
      ${cap('STATUS COLOUR IS EARNED, NOT ASSIGNED BY TAXONOMY. Warning is carried by POSITION &mdash; it stands on the boundary the user is about to commit across, which they are already looking at. Success is carried by the state it reports, which has already changed in front of them. Informational is what the frozen three-step reading ramp was built for. Each ships a glyph and copy, so none of the three depends on rank alone either. THESE ARE CURRENT EXPRESSIONS, NOT A CAP: each role carries the condition that would overturn its refusal, and a bounded audit of eight QANDEEL surfaces found that two of those conditions are ALREADY MET. Neither is answered with a hue here; both are handed to Product with the evidence named.')}
      <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
        ${cell('WARNING &mdash; on the commit boundary, in the Product&rsquo;s own ink', `
          <div style="display:flex;flex-direction:column;gap:13px">
            <h2>${AR.publish}</h2>
            ${statusBlock('warning', AR.warning, { weightRule: true })}
            <div style="display:flex;gap:10px">${button(AR.publish, '', { commit: true })}${button(AR.cancel)}</div>
          </div>`)}
        ${cell('SUCCESS &mdash; the state that changed, shown changed', `
          <div style="display:flex;flex-direction:column;gap:13px">
            <h2>${AR.worldsTitle}</h2>
            ${statusBlock('success', AR.success)}
            ${row('مشروع قنديل', 'عامّ &middot; ١٢ عضوًا', 'selected')}
          </div>`)}
        ${cell('INFORMATIONAL &mdash; rank in the reading ramp', `
          <div style="display:flex;flex-direction:column;gap:13px">
            <h2>${AR.members}</h2>
            ${row(AR.worlds[1][0], AR.worlds[1][1], '')}
            ${statusBlock('informational', AR.informational)}
          </div>`)}
      </div>
      ${cap('THE ASYMMETRY IS THE POINT. Only one of the four roles is coloured today, so the coloured thing is always the thing that needs attention. A green success would spend that on the one outcome that needs none of it. What is frozen is that a hue must be EARNED and that QANDEEL does not use a generic traffic-light palette &mdash; not the number of hues.')}
    </div>`,
  });
}

/* ------------------------------------------------------------- B10 integrated screen  */
function integratedScreen() {
  return page({
    title: 'E1 integrated QANDEEL screen', width: 390,
    body: `<div class="screen">
      <header class="hdr">${canonicalQ(24)}<h1>${AR.worldsTitle}</h1><span class="sub en">Connected Worlds</span></header>
      <div class="body">
        <div class="panel">
          <h2>${AR.insight}</h2>
          <div style="position:relative;flex:0 0 76px;block-size:76px">
            <div style="position:absolute;inset:0;opacity:.86;filter:blur(3.4px);background:
              radial-gradient(circle 26px at 29% 46%, var(--light-core) 0%, transparent 70%),
              radial-gradient(circle 34px at 61% 34%, var(--light-mid) 0%, transparent 72%),
              radial-gradient(circle 44px at 45% 72%, var(--light-low) 0%, transparent 74%)"></div>
            <svg width="100%" height="76" viewBox="0 0 330 76" fill="none" preserveAspectRatio="none" style="position:relative;display:block">
              <g stroke="var(--tertiary)" stroke-width="1.2">
                <path d="M96 42 L150 34"/><path d="M150 34 L206 52"/><path d="M96 42 L206 52"/>
              </g>
              <g fill="var(--primary)"><circle cx="96" cy="42" r="3.4"/><circle cx="150" cy="34" r="3.4"/><circle cx="206" cy="52" r="3.4"/></g>
            </svg>
          </div>
        </div>
        <div class="panel">
          <h2>${AR.members}</h2>
          ${row(AR.worlds[0][0], AR.worlds[0][1], 'selected')}
          ${row(AR.worlds[1][0], AR.worlds[1][1], 'focus')}
          ${row(AR.worlds[2][0], AR.worlds[2][1], '')}
          ${row(AR.worlds[3][0], AR.worlds[3][1], 'disabled')}
        </div>
        <div class="panel">
          ${field('s1', AR.nameLabel, AR.nameValue, { status: 'error', msg: AR.nameError })}
          ${statusBlock('informational', AR.informational)}
          <div style="display:flex;gap:10px;align-items:center">
            ${button(AR.publish, 'disabled', { commit: true, describedby: 'why' })}
            <span class="status informational" id="why" style="font-size:11.5px">${AR.disabledReason}</span>
          </div>
        </div>
      </div>
      ${navBar(2)}
    </div>`,
  });
}

/* --------------------------------------------------------------- B11 separation ----- */
function separationProof() {
  const p = palette();
  const chip = (name, varName, note) =>
    `<div class="swatch"><span class="chip" style="background:var(${varName})"></span><span><b>${name}</b><br>${note}</span></div>`;
  return page({
    title: 'E1 separation proof', width: 1180,
    body: `<div class="board">
      ${h3('برهان الفصل', 'CAN THE FOUR SYSTEMS SHARE A SCREEN WITHOUT COLLIDING?')}
      ${cap('BRASS IS MATTER &mdash; it is what QANDEEL-owned identity machinery is made of, and it does not change with state. LIGHT IS MEANING &mdash; it is an event that rises, decays and reaches exactly zero. STATE IS THE USER&rsquo;S POSITION &mdash; and it introduces no colour at all. STATUS IS WHAT NEEDS ATTENTION &mdash; one colour, for failure.')}
      <div class="grid" style="grid-template-columns:1.15fr 1fr">
        <div class="cell"><span class="lab">ALL FOUR, ON ONE PANEL</span>
          <div class="plate on-surface" style="display:flex;flex-direction:column;gap:13px">
            <div style="display:flex;align-items:center;gap:10px">${canonicalQ(22)}<span style="font-size:13px;color:var(--secondary)">المادة &middot; <span class="en">BRASS, identity material</span></span></div>
            <div style="display:flex;align-items:center;gap:10px">
              <span style="inline-size:22px;block-size:22px;border-radius:50%;background:radial-gradient(circle,var(--light-core),var(--light-low) 58%,transparent 72%);filter:blur(1.1px)"></span>
              <span style="font-size:13px;color:var(--secondary)">المعنى &middot; <span class="en">LIGHT, a meaning event</span></span></div>
            ${row(AR.worlds[0][0], AR.worlds[0][1], 'selected')}
            ${row(AR.worlds[1][0], AR.worlds[1][1], 'focus')}
            ${statusBlock('error', AR.syncError)}
            <div class="nav" style="padding:6px 0 0;background:transparent">${AR.nav.map((n, i) => navItem(n, i === 2 ? 'selected' : '')).join('')}</div>
          </div>
        </div>
        <div class="cell"><span class="lab">THE SAME FIVE VALUES, MEASURED APART</span>
          <div class="plate on-surface" style="display:flex;flex-direction:column;gap:13px">
            ${chip('LIVING BRASS ' + p.c.BRASS, '--brass', 'MATTER. State-invariant. OkLCh chroma 0.0516, hue 75.')}
            ${chip('QANDEEL LIGHT ' + p.c.LIGHT_LOW, '--light-low', 'MEANING. Event-based. Chroma up to 0.0462, hue 89&ndash;90.')}
            ${chip('SELECTED / FOCUS ' + p.c.SELECTED_INK, '--selected-ink', 'THE PRODUCT&rsquo;S OWN READING INK. State adds no colour.')}
            ${chip('UNAVAILABLE ' + p.c.DISABLED_INK, '--disabled', 'THE READING RAMP, EXTENDED BY ONE RUNG.')}
            ${chip('ERROR ' + p.c.ERROR_INK, '--error', 'THE ONLY STATUS HUE QANDEEL HAS EARNED. Chroma 0.1364 &mdash; 2.6&times; the most chromatic frozen value.')}
          </div>
          ${cap('The chips are here BESIDE the controls that carry them, never instead of them.')}
        </div>
      </div>
    </div>`,
  });
}

/* ------------------------------------------------------------- B15 disabled record -- */
function disabledProof() {
  return page({
    title: 'E1 disabled', width: 1180,
    body: `<div class="board">
      ${h3('غير متاح', 'UNAVAILABLE &mdash; TWO PATTERNS, ONE EXPRESSION')}
      ${cap('An unavailable control RESOLVES EVERY INK IT CARRIES TO ONE VALUE and so loses its internal hierarchy: hierarchy is for reading and acting, and the control is doing neither. That ink is the frozen reading ramp extended by one rung, so no unavailable control can be confused with an available one whatever ink it started from. DISABLED DESCRIBES AVAILABILITY, NOT FOCUSABILITY. I-08B3.1-E1 froze &ldquo;a disabled control is not focusable&rdquo;; that is true of one pattern and wrong as a rule, and the two cells on the right are the correction.')}
      <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
        ${cell('AVAILABLE &mdash; hierarchy intact', `<div style="display:flex;flex-direction:column;gap:14px">${row(AR.worlds[0][0], AR.worlds[0][1], '')}<div style="display:flex">${button(AR.publish, '', { commit: true })}</div></div>`)}
        ${cell('NATIVE NON-DISCOVERABLE &mdash; skipped by the tab ring', `<div style="display:flex;flex-direction:column;gap:14px">${row(AR.worlds[0][0], AR.worlds[0][1], 'disabled')}<div style="display:flex;flex-direction:column;gap:8px">${button(AR.publish, 'disabled', { commit: true, describedby: 'why2' })}<span class="status informational" id="why2" style="font-size:11.5px">${AR.disabledReason}</span></div></div>`)}
        ${cell('DISCOVERABLE &mdash; reachable, and it cannot act', `<div style="display:flex;flex-direction:column;gap:14px">${row(AR.worlds[0][0], AR.worlds[0][1], 'disabled', { pattern: 'discoverable', describedby: 'why3' })}<div style="display:flex;flex-direction:column;gap:8px">${button(AR.publish, 'disabled', { commit: true, pattern: 'discoverable', describedby: 'why3' })}<span class="status informational" id="why3" style="font-size:11.5px">${AR.needsPermission}</span></div></div>`)}
      </div>
      ${cap('THE SAME TWO CONTROLS ARE IN BOTH UNAVAILABLE CELLS, DELIBERATELY: a different control in each would have let a morphology difference pass for a pattern difference. THE TWO PATTERNS ARE PIXEL-FOR-PIXEL THE SAME, and that is the contract rather than an accident. The user is being told one thing in both cells &mdash; this is unavailable &mdash; and a visible difference would encode an implementation decision as a Product meaning. What differs is not visible at all: the middle cell carries the HTML disabled attribute and the browser removes it from the tab sequence; the right-hand cell carries aria-disabled, keeps its place in the focus order, and has its activation suppressed explicitly. W3C APG: screen reader users are far less likely to discover disabled elements that are not focusable, because moving focus is one of their primary methods of discovery.')}
      <div class="grid" style="grid-template-columns:1fr 1fr">
        ${cell('THE FORBIDDEN ALTERNATIVE, SHOWN RATHER THAN DESCRIBED', `
          <div class="nav" style="background:transparent;padding:0;opacity:.42">${AR.nav.map((n, i) => navItem(n, i === 2 ? 'selected' : '')).join('')}</div>
          <p class="cap" style="margin-block-start:10px">This is what compositing a Brass-bearing control down looks like. The token is untouched and the material reference has not changed &mdash; and it still reads as Brass turning down because an item became unavailable. FORBIDDEN: the APPEARANCE of the material may not depend on state any more than its VALUE may. E1R does not replace it with a permitted expression, because it does not have one to give: how availability is shown around an identity object is a navigation-contract decision, and E1&rsquo;s answer &mdash; a universal law that no Brass-bearing object ever has a disabled state &mdash; was a Product ruling it had no authority to make. What E1 DID ship, for two packages, was a stylesheet rule repainting this icon to the unavailable ink; check R30 now reads the stylesheet and rejects it.</p>`)}
        ${cell('THE BEHAVIOURAL HALF, WHICH NO STILL CAN SHOW', `
          <div style="display:flex;flex-direction:column;gap:12px">
            ${row(AR.worlds[0][0], AR.worlds[0][1], 'disabled')}
            ${row(AR.worlds[1][0], AR.worlds[1][1], 'disabled', { pattern: 'discoverable' })}
            <p class="cap">These two look identical and behave differently, which is exactly why a still cannot settle it. tools/e1-focus.mjs drives real Tab key events and a real Enter key through a real browser: the first row is never reached, the second is reached and does not activate, and an available control activates under the same key so that the second obligation is not vacuous. A synthetic KeyboardEvent constructed in page script carries no default action, so a test written in page JS measures its own focus() calls and always passes.</p>
          </div>`)}
      </div>
    </div>`,
  });
}

/* ------------------------------------------------- B17 state composition (E1R) ------ */
/**
 * THE BOARD THE REVISION EXISTS FOR. It carries the combination I-08B3.1-E1 recorded as
 * impossible — SELECTED + UNAVAILABLE — at the control type where it is reachable, and it
 * prints the sixteen-row verdict table straight out of the SHIPPED token file, so the
 * picture and the contract cannot drift apart.
 */
function composition() {
  const M = COMPOSITION.matrix;
  const badge = (v) => v === 'REACHABLE' ? '&#9679;' : v === 'CONDITIONAL' ? '&#9681;' : '&#9675;';
  const rowsHtml = M.map((m) => `<tr>
      <td class="mono">${m.combination === 'rest' ? 'rest' : m.combination}</td>
      <td>${badge(m.verdict)} ${m.verdict}</td>
      <td class="mono">${m.rule}</td>
      <td>${m.ground} &middot; ${m.perimeter} &middot; ${m.marker} &middot; ${m.ink} &middot; ${m.weight}</td>
    </tr>`).join('');
  const chan = COMPOSITION.channels.map((c) => `<tr>
      <td>${c.channel}</td><td class="mono">${c.owner}</td>
      <td class="mono">${(c.alsoWritten ?? []).length ? c.alsoWritten.join(', ') : '&mdash;'}</td>
      <td class="mono">${c.precedenceRule ?? '&mdash;'}</td></tr>`).join('');
  const prec = COMPOSITION.precedence.map((p) => `<tr>
      <td class="mono">${p.id}</td><td><b>${p.rule}</b><br>${p.detail}</td></tr>`).join('');
  return page({
    title: 'E1R state composition', width: 1180,
    extraCss: 'table{border-collapse:collapse;inline-size:100%;direction:ltr;unicode-bidi:isolate;text-align:left}' +
      'th,td{padding:5px 9px;font-size:11px;color:var(--secondary);border-block-end:1px solid var(--surface);vertical-align:top;line-height:1.5}' +
      'th{color:var(--tertiary);font-weight:600;font-size:10px}td.mono{color:var(--primary);white-space:nowrap}' +
      '.cell .cap{max-inline-size:none}.plate{overflow:visible}',
    body: `<div class="board">
      ${h3('تركيب الحالات', 'STATE COMPOSITION &mdash; WHAT ACTUALLY MAKES THESE COMPOSE')}
      ${cap('I-08B3.1-E1 said each state owned a different channel and that NO CHANNEL WAS USED TWICE. It was a clean sentence and it was false as it was written: SELECTED writes the ink and DISABLED writes the ink. The expressions on every accepted board were right; the explanation of why they worked was not, and a wrong explanation is worse than none because it stops anyone looking. What actually makes them compose is that THREE channels are exclusively owned, ONE is shared and resolved by a declared precedence, and DISABLED is an OVERRIDE rather than a peer.')}
      <div class="grid" style="grid-template-columns:1fr 1fr">
        <div class="cell"><span class="lab">SELECTED + UNAVAILABLE &mdash; AT THE CONTROL TYPE WHERE IT IS REACHABLE</span>
          <div class="plate on-surface" style="display:flex;flex-direction:column;gap:12px;min-block-size:150px">
            <span class="lab">${AR.scopeLabel}</span>
            <div class="optset">
              ${opt(AR.scopes[0], '')}
              ${opt(AR.scopes[1], 'selected')}
              ${opt(AR.scopes[2], 'selected disabled', { pattern: 'discoverable', describedby: 'b17why' })}
              ${opt(AR.scopes[3], 'disabled', { pattern: 'discoverable', describedby: 'b17why' })}
            </div>
            <span class="status informational" id="b17why" style="font-size:11.5px">${AR.scopeUnavailable}</span>
          </div>
          ${cap('A value the user chose can stop being available while remaining the value they chose. THE MARKER STAYS AND THE WEIGHT STAYS &mdash; they are the record of a choice, and availability is not a reason to withdraw a record. THE INK GOES, including the marker&rsquo;s: precedence rule P1 collapses every ink the control carries to the one unavailable value. Two channels tell it apart from plain UNAVAILABLE, one from plain SELECTED, and the behavioural proof measures all three off the computed style. Hiding the marker instead would silently rewrite the user&rsquo;s choice; hiding the control would silently rewrite the set.')}
        </div>
        <div class="cell"><span class="lab">AND IT COMPOSES WITH FOCUS &mdash; because the chip stays in the tab ring</span>
          <div class="plate on-surface" style="display:flex;flex-direction:column;gap:12px;min-block-size:150px;justify-content:center">
            <div class="optset">
              ${opt(AR.scopes[2], 'selected disabled focus', { pattern: 'discoverable' })}
              ${opt(AR.scopes[3], 'disabled focus', { pattern: 'discoverable' })}
            </div>
          </div>
          ${cap('SELECTED + UNAVAILABLE + FOCUSED. E1 recorded DISABLED + focus as &ldquo;cannot occur&rdquo;, so this combination had no expression at all &mdash; and under the DISCOVERABLE pattern it is the ordinary case for anyone tabbing through a set of options. The perimeter is drawn in the focus indicator&rsquo;s own tokens and is NOT dimmed with the control: it belongs to the input system, and the input system is not unavailable. That is precedence rule P3.')}
        </div>
      </div>
      <div class="grid" style="grid-template-columns:1fr 1.25fr">
        <div class="cell"><span class="lab">THE CHANNELS, AND WHO WRITES THEM</span>
          <table><thead><tr><th>channel</th><th>owner</th><th>also written by</th><th>rule</th></tr></thead><tbody>${chan}</tbody></table>
          ${cap('One row has two writers. That row is the whole of what the withdrawn slogan got wrong, and it is why the model resolves by precedence instead of claiming exclusivity.')}
        </div>
        <div class="cell"><span class="lab">THE PRECEDENCE RULES &mdash; three, not one ordering</span>
          <table><tbody>${prec}</tbody></table>
        </div>
      </div>
      <span class="lab">ALL SIXTEEN COMBINATIONS, READ OUT OF THE SHIPPED TOKEN FILE &mdash; &#9679; reachable &nbsp; &#9681; conditional &nbsp; &#9675; unreachable</span>
      <table><thead><tr><th>combination</th><th>verdict</th><th>rule</th><th>ground &middot; perimeter &middot; marker &middot; ink &middot; weight</th></tr></thead><tbody>${rowsHtml}</tbody></table>
      ${cap('Four combinations are UNREACHABLE and every one of them for the same reason: precedence rule P2 suppresses the press response wherever unavailability is present, because a ground response says the interaction was received. Three are CONDITIONAL &mdash; on the availability pattern, on the control type, or on both. None is undefined, and check R27 fails if one becomes so.')}
    </div>`,
  });
}

/* ---------------------------------------------------------------- B16 200% text ----- */
function textStress() {
  return page({
    title: 'E1 text stress', width: 1160,
    extraCss: '.stress{font-size:200%}',
    body: `<div class="board">
      ${h3('نص بحجم ٢٠٠٪', 'THE STATES AT 200% TEXT')}
      ${cap('Apple asks for at least 200 percent enlargement. At that size a state carried by a hairline or by a tight gap stops being carried. The marker, the detached indicator and the promoted boundary all scale with the control because they are expressed in logical properties against the control&rsquo;s own box; the error message wraps and keeps its glyph on the first line.')}
      <div class="grid stress" style="grid-template-columns:1fr 1fr">
        ${cell('SELECTED / FOCUSED / DISABLED', `<div style="display:flex;flex-direction:column;gap:22px">${row(AR.worlds[0][0], AR.worlds[0][1], 'selected')}${row(AR.worlds[1][0], AR.worlds[1][1], 'focus')}${row(AR.worlds[2][0], AR.worlds[2][1], 'disabled')}</div>`)}
        ${cell('THE ERROR FIELD', field('t1', AR.nameLabel, AR.nameValue, { status: 'error', msg: AR.nameError }))}
      </div>
    </div>`,
  });
}

export const BOARDS = [
  { id: 'B01', file: 'b01-state-matrix-surface', width: 1180, html: () => stateMatrix('FUNCTIONAL SURFACE'), what: 'the five states on three control morphologies, on the functional Surface' },
  { id: 'B02', file: 'b02-state-matrix-world', width: 1180, html: () => stateMatrix('WORLD'), what: 'the same five states on the World' },
  { id: 'B03', file: 'b03-focus', width: 1180, html: focusProof, what: 'focus on four morphologies and on both grounds' },
  { id: 'B04', file: 'b04-selected-vs-focus', width: 1160, html: selectedVsFocus, what: 'selected-not-focused, focused-not-selected, and both at once' },
  { id: 'B05', file: 'b05-pressed-vs-selected', width: 1180, html: pressedVsSelected, what: 'the press lifecycle, released and committed' },
  { id: 'B06', file: 'b06-error', width: 1160, html: errorProof, what: 'form error, mixed-direction error, and an operation that failed' },
  { id: 'B07', file: 'b07-roles-without-colour', width: 1180, html: roleProofs, what: 'warning, success and informational, all retained and all colourless' },
  { id: 'B10', file: 'b10-integrated-screen', width: 390, html: integratedScreen, what: 'one real QANDEEL screen carrying all four systems at once' },
  { id: 'B11', file: 'b11-separation', width: 1180, html: separationProof, what: 'Brass, Light, state and status side by side, and measured apart' },
  { id: 'B15', file: 'b15-disabled', width: 1180, html: disabledProof, what: 'the two availability patterns, one expression, and the Brass case E1R narrows' },
  { id: 'B16', file: 'b16-text-200', width: 1160, html: textStress, what: 'the states at 200 percent text' },
  { id: 'B17', file: 'b17-state-composition', width: 1180, html: composition, what: 'SELECTED + UNAVAILABLE, and all sixteen combinations from the shipped contract' },
];

export { integratedScreen };
