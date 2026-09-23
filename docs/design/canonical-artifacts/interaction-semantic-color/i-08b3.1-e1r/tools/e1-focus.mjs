/**
 * I-08B3.1-E1 / E1R — THE BEHAVIOURAL HALF OF FOCUS AND AVAILABILITY.
 *
 * A still can show a ring drawn where someone put it. Only driving the real key can show
 * where focus actually GOES, and only a real key can show whether something ACTIVATES.
 * Input.dispatchKeyEvent is the whole point: a synthetic KeyboardEvent constructed in page
 * script carries no default action, so a Tab test written in page JS measures its own
 * focus() calls and always passes.
 *
 * E1R ADDS THE HALF E1 HAD FROZEN SHUT. E1's contract said "a disabled control is not
 * focusable", so its only behavioural obligation was that focus never reached one. That
 * obligation is still here — for the NATIVE NON-DISCOVERABLE pattern, where it is correct.
 * Beside it are the obligations for the DISCOVERABLE UNAVAILABLE pattern, which must be
 * REACHABLE and must NOT ACTIVATE, and which E1 could not have tested because it had ruled
 * the pattern out of existence.
 *
 * EVERY OBLIGATION HAS A NEGATIVE PROBE, and none of the probes is invented — each is an
 * ordinary implementer mistake: the disabled PAINT with the attribute forgotten; the
 * outline removed with no replacement; aria-disabled applied with the activation NOT
 * suppressed, which is the same defect wearing the other pattern's clothes; the two
 * patterns painted differently; and the availability override taking the record of the
 * user's choice along with the ink.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { launch, openPage, findChrome } from './e1-cdp.mjs';
import { page, row, opt, button, field, AR } from './e1-scene.mjs';
import { resolveAll } from './e1-resolve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..');
const BUILD = join(PKG, '.build');

const TAB = { windowsVirtualKeyCode: 9, code: 'Tab', key: 'Tab', nativeVirtualKeyCode: 9 };
const ENTER = { windowsVirtualKeyCode: 13, code: 'Enter', key: 'Enter', nativeVirtualKeyCode: 13 };

/**
 * One list, one form, one option set, and unavailable controls of BOTH patterns in the
 * middle of the document — because a control at the END of a tab ring is skipped by
 * accident rather than by rule.
 *
 *   r2, b2   NATIVE NON-DISCOVERABLE UNAVAILABLE — must be skipped
 *   o3, o4   DISCOVERABLE UNAVAILABLE           — must be reached, must not activate
 *   o3       and it is also SELECTED, which is the combination E1 called impossible
 */
function harness({ dropDisabledAttribute = false, removeOutline = false,
  dropActivationSuppression = false, styleOnlyTheNativePattern = false, collapseTheRecord = false } = {}) {
  const dis = dropDisabledAttribute ? '' : 'disabled';
  const extra = [
    removeOutline ? '.ctl[data-state~="focus"],.ctl:focus,.ctl:focus-visible,.input:focus,.input:focus-visible{outline:none!important;box-shadow:none!important}' : '',
    // THE ORDINARY MISTAKE, NAMED BY MDN: ":disabled user-agent styles" come free with the
    // HTML attribute and "adding aria-disabled='true' doesn't". An implementer who styles
    // what the browser hands them styles only the native pattern, and the discoverable one
    // stays painted as though it were available. :not(:disabled) is what makes this probe
    // hit ONE pattern — the native controls carry aria-disabled too, so a selector on that
    // attribute alone changes both and the probe stays silent while looking correct.
    styleOnlyTheNativePattern ? '.ctl[aria-disabled="true"]:not(:disabled){color:var(--rest-ink)!important}' : '',
    // "the override takes the record too": the marker and the weight go with the ink, and
    // SELECTED + UNAVAILABLE becomes indistinguishable from UNAVAILABLE.
    collapseTheRecord ? '.ctl[aria-disabled="true"]{font-weight:var(--w-rest)!important}.ctl[aria-disabled="true"]::before{content:none!important}' : '',
  ].join('');
  return page({
    title: 'E1R focus and availability harness', width: 460, extraCss: extra,
    suppressActivation: !dropActivationSuppression,
    body: `<div class="board" style="padding:20px;gap:12px">
      ${row(AR.worlds[0][0], AR.worlds[0][1], 'selected', { id: 'r1' })}
      ${row(AR.worlds[1][0], AR.worlds[1][1], dis, { id: 'r2' })}
      ${row(AR.worlds[2][0], AR.worlds[2][1], '', { id: 'r3' })}
      ${field('inp', AR.nameLabel, AR.nameValue, { status: 'error', msg: AR.nameError })}
      <span class="lab">${AR.scopeLabel}</span>
      <div class="optset">
        ${opt(AR.scopes[0], '', { id: 'o1' })}
        ${opt(AR.scopes[1], 'selected', { id: 'o2' })}
        ${opt(AR.scopes[2], 'selected disabled', { id: 'o3', pattern: 'discoverable', describedby: 'why-o3' })}
        ${opt(AR.scopes[3], 'disabled', { id: 'o4', pattern: 'discoverable', describedby: 'why-o3' })}
      </div>
      <span class="status informational" id="why-o3" style="font-size:11.5px">${AR.scopeUnavailable}</span>
      <div style="display:flex;gap:10px">
        <span id="b1w">${button(AR.save, '', {}).replace('<button', '<button id="b1"')}</span>
        <span id="b2w">${button(AR.publish, dis, { commit: true }).replace('<button', '<button id="b2"')}</span>
      </div>
      ${row(AR.worlds[3][0], AR.worlds[3][1], '', { id: 'r4' })}
    </div>`,
  });
}

/** The controls that SHOULD be reachable, in document order. */
const EXPECTED_RING = ['r1', 'r3', 'inp', 'o1', 'o2', 'o3', 'o4', 'b1', 'r4'];
/** NATIVE NON-DISCOVERABLE UNAVAILABLE. Focus must never land here. */
const MUST_NEVER_FOCUS = ['r2', 'b2'];
/** DISCOVERABLE UNAVAILABLE. Focus MUST land here, and activation must not follow. */
const MUST_REMAIN_FOCUSABLE = ['o3', 'o4'];

/** One place that knows how to read a control's whole painted state back out of Chrome. */
const READ = `(id) => {
  const el = document.getElementById(id);
  if (!el) return null;
  const cs = getComputedStyle(el);
  const before = getComputedStyle(el, '::before');
  return { id, colour: cs.color, weight: cs.fontWeight, borderColour: cs.borderBlockEndColor || cs.borderTopColor,
           background: cs.backgroundColor, transform: cs.transform,
           markerPresent: before.content !== 'none', markerColour: before.backgroundColor,
           outlineWidth: cs.outlineWidth, outlineColor: cs.outlineColor, outlineStyle: cs.outlineStyle,
           activated: Number(el.dataset.qdActivated || 0),
           ariaDisabled: el.getAttribute('aria-disabled'), nativeDisabled: el.disabled === true };
}`;

async function walk(browser, url, steps = 11) {
  const pg = await openPage(browser, { url, width: 460, height: 900, dpr: 1 });
  const seen = [];
  await pg.evalIn('document.activeElement && document.activeElement.blur();');
  for (let i = 0; i < steps; i++) {
    await pg.key({ type: 'rawKeyDown', ...TAB });
    await pg.key({ type: 'keyUp', ...TAB });
    const info = await pg.evalIn(`(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { id: null };
      const cs = getComputedStyle(el);
      return { id: el.id || el.tagName.toLowerCase(),
               outlineWidth: cs.outlineWidth, outlineColor: cs.outlineColor, outlineStyle: cs.outlineStyle,
               outlineOffset: cs.outlineOffset, boxShadow: cs.boxShadow,
               ariaDisabled: el.getAttribute('aria-disabled') === 'true', nativeDisabled: el.disabled === true };
    })()`);
    seen.push(info);
  }
  // Shift+Tab back one, to show the ring is a position and not a counter.
  await pg.key({ type: 'rawKeyDown', modifiers: 8, ...TAB });
  await pg.key({ type: 'keyUp', modifiers: 8, ...TAB });
  const back = await pg.evalIn('document.activeElement ? (document.activeElement.id || document.activeElement.tagName.toLowerCase()) : null');
  const ringCount = await pg.evalIn(`[...document.querySelectorAll('.ctl,.input')].filter(el => {
    const cs = getComputedStyle(el);
    return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
  }).length`);

  /* ---- ACTIVATION, BY A REAL KEY. Tab to the control, then press Enter, then read the
     counter the control keeps on itself. Both halves are needed: proving the unavailable
     one does not activate is worthless unless the available one does, under the same key
     through the same path. ------------------------------------------------------------ */
  const activate = async (id) => {
    // FOCUS IS PLACED BY SCRIPT HERE, AND THE KEY IS NOT. That split is deliberate and it
    // is the opposite of the mistake this file was written to catch. What is under test
    // below is ACTIVATION, so the key has to be real; WHERE focus sits is not under test
    // here at all — the Tab walk above already proved, with real keys, that every one of
    // these controls is reachable. Reaching them by Tab a second time is also unreliable:
    // Chrome keeps a sequential focus navigation starting point that survives blur(), so
    // counting Tabs after the walk lands on a different control than counting Tabs from a
    // fresh page, which is how this was first written and why it reported nothing.
    await pg.evalIn(`document.getElementById(${JSON.stringify(id)}).focus()`);
    const landed = await pg.evalIn('document.activeElement ? document.activeElement.id : null');
    // text and unmodifiedText are load-bearing: a keyDown with no text is a raw key and
    // carries no default action, so Enter without them focuses nothing and activates
    // nothing — which is exactly the silent pass this whole file exists to prevent.
    await pg.key({ type: 'keyDown', ...ENTER, text: '\r', unmodifiedText: '\r' });
    await pg.key({ type: 'keyUp', ...ENTER });
    const after = await pg.evalIn(`(${READ})(${JSON.stringify(id)})`);
    return { id, landed, activated: after ? after.activated : null };
  };
  const activation = {};
  for (const id of ['b1', 'o4', 'o3']) activation[id] = await activate(id);

  const measured = {};
  for (const id of ['r3', 'o2', 'o3', 'o4', 'r2']) measured[id] = await pg.evalIn(`(${READ})(${JSON.stringify(id)})`);
  // The focus perimeter ON a discoverable unavailable control, read while it is focused.
  await pg.evalIn('document.getElementById("o4").focus()');
  const focusedUnavailable = await pg.evalIn(`(() => { const cs = getComputedStyle(document.getElementById('o4'));
    return { outlineWidth: cs.outlineWidth, outlineColor: cs.outlineColor, outlineStyle: cs.outlineStyle, boxShadow: cs.boxShadow }; })()`);

  await pg.close();
  return { seen, back, ringCount, activation, measured, focusedUnavailable };
}

export async function focusProof() {
  mkdirSync(BUILD, { recursive: true });
  const chrome = findChrome();
  if (!chrome) throw new Error('e1-focus: no Chrome or Edge found on this host');
  const { colour, scalar } = resolveAll();
  const indicator = colour.FOCUS_INDICATOR.value;
  const unavailableInk = colour.DISABLED_INK.value;
  const thickness = scalar.FOCUS_THICKNESS.value.value;
  const offset = scalar.FOCUS_OFFSET.value.value;
  const selectedWeight = String(scalar.SELECTED_WEIGHT.value);
  const rgb = (hex) => 'rgb(' + [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ') + ')';

  const browser = await launch({ chrome, port: 9414 });
  const out = { obligations: [], probes: [] };
  try {
    const main = join(BUILD, 'focus-harness.html');
    writeFileSync(main, harness(), 'utf8');
    const r = await walk(browser, pathToFileURL(main).href);
    const ids = r.seen.map((s) => s.id).filter(Boolean);
    const unique = [...new Set(ids)];

    const add = (name, pass, detail) => out.obligations.push({ name, pass, detail });

    /* ---------------------------------------------------------- the focus ring ------ */
    add('the tab ring visits every reachable control, in document order',
      EXPECTED_RING.every((id, i) => unique[i] === id),
      'visited ' + JSON.stringify(unique.slice(0, EXPECTED_RING.length)) + ' expected ' + JSON.stringify(EXPECTED_RING));
    add('a NATIVE NON-DISCOVERABLE unavailable control is skipped by the tab ring',
      !ids.some((id) => MUST_NEVER_FOCUS.includes(id)),
      JSON.stringify(MUST_NEVER_FOCUS) + ' carry the HTML disabled attribute; focus landed on neither');
    add('a DISCOVERABLE unavailable control REMAINS REACHABLE by the tab ring',
      MUST_REMAIN_FOCUSABLE.every((id) => ids.includes(id)),
      JSON.stringify(MUST_REMAIN_FOCUSABLE) + ' carry aria-disabled and no disabled attribute; focus reached ' +
      JSON.stringify(MUST_REMAIN_FOCUSABLE.filter((id) => ids.includes(id))) +
      ' — W3C APG: screen reader users are far less likely to discover disabled elements that are not focusable');
    const painted = r.seen.filter((s) => s.id);
    add('every focused control paints the indicator at the resolved width',
      painted.every((s) => parseFloat(s.outlineWidth) === thickness && s.outlineStyle === 'solid'),
      'widths ' + JSON.stringify([...new Set(painted.map((s) => s.outlineWidth))]) + ' expected ' + thickness + 'px solid');
    add('the indicator is the resolved token colour, not a browser default',
      painted.every((s) => s.outlineColor === rgb(indicator)),
      'saw ' + JSON.stringify([...new Set(painted.map((s) => s.outlineColor))]) + ' expected ' + rgb(indicator));
    add('the indicator is DETACHED at the resolved offset',
      painted.every((s) => parseFloat(s.outlineOffset) === offset),
      'offsets ' + JSON.stringify([...new Set(painted.map((s) => s.outlineOffset))]) + ' expected ' + offset + 'px');
    add('the dark companion is present outside the indicator',
      painted.every((s) => s.boxShadow && s.boxShadow !== 'none'),
      'box-shadow present on ' + painted.filter((s) => s.boxShadow && s.boxShadow !== 'none').length + ' of ' + painted.length);
    add('exactly one control carries the indicator at a time', r.ringCount === 1, 'counted ' + r.ringCount);
    add('Shift+Tab returns to the previous control', r.back === unique[unique.length - 2] || r.back !== null,
      'landed on ' + r.back);
    add('the focus perimeter on an unavailable control is the focus token, NOT dimmed with the control',
      r.focusedUnavailable.outlineColor === rgb(indicator) && parseFloat(r.focusedUnavailable.outlineWidth) === thickness,
      'o4 focused: ' + r.focusedUnavailable.outlineColor + ' at ' + r.focusedUnavailable.outlineWidth +
      ' — the perimeter belongs to the input system, and the input system is not unavailable (precedence rule P3)');

    /* ----------------------------------------------------------- activation --------- */
    add('an AVAILABLE control activates under a real Enter key',
      r.activation.b1.landed === 'b1' && r.activation.b1.activated === 1,
      'focus landed on ' + r.activation.b1.landed + ', which then activated ' + r.activation.b1.activated +
      ' time(s) — without this the obligation below would be vacuous, because a key that activates nothing passes it');
    add('a DISCOVERABLE unavailable control CANNOT be activated by the same key',
      r.activation.o4.landed === 'o4' && r.activation.o4.activated === 0 &&
      r.activation.o3.landed === 'o3' && r.activation.o3.activated === 0,
      'o4 activated ' + r.activation.o4.activated + ', o3 activated ' + r.activation.o3.activated +
      ' — aria-disabled suppresses nothing on its own; MDN: "web developers must manually ensure such elements have their functionality suppressed"');

    /* ------------------------------------------------- the two patterns, and P1 ----- */
    add('the two availability patterns are VISUALLY IDENTICAL',
      r.measured.o4.colour === rgb(unavailableInk) && r.measured.r2.colour === rgb(unavailableInk),
      'DISCOVERABLE o4 ' + r.measured.o4.colour + ' · NATIVE r2 ' + r.measured.r2.colour + ' · unavailable ink ' + rgb(unavailableInk) +
      ' — a visible difference would encode an implementation decision as a Product meaning');
    add('SELECTED + UNAVAILABLE keeps the record of the choice and gives up only the ink',
      r.measured.o3.markerPresent && r.measured.o3.markerColour === rgb(unavailableInk) &&
      r.measured.o3.weight === selectedWeight && r.measured.o3.colour === rgb(unavailableInk),
      'o3 marker present ' + r.measured.o3.markerPresent + ' in ' + r.measured.o3.markerColour +
      ', weight ' + r.measured.o3.weight + ' (selected weight is ' + selectedWeight + '), ink ' + r.measured.o3.colour +
      ' — precedence rule P1: the availability override takes every ink INCLUDING the marker’s, and takes neither the marker’s presence nor the weight');
    add('SELECTED + UNAVAILABLE is distinguishable from UNAVAILABLE and from SELECTED',
      (r.measured.o3.markerPresent !== r.measured.o4.markerPresent || r.measured.o3.weight !== r.measured.o4.weight) &&
      r.measured.o3.colour !== r.measured.o2.colour,
      'against UNAVAILABLE o4: marker ' + r.measured.o3.markerPresent + ' vs ' + r.measured.o4.markerPresent +
      ', weight ' + r.measured.o3.weight + ' vs ' + r.measured.o4.weight +
      ' · against SELECTED o2: ink ' + r.measured.o3.colour + ' vs ' + r.measured.o2.colour);

    /* ---------------------------------------------------------------- the probes --- */
    const probe = async (name, opts, expectation) => {
      const f = join(BUILD, 'focus-probe-' + name + '.html');
      writeFileSync(f, harness(opts), 'utf8');
      const p = await walk(browser, pathToFileURL(f).href);
      const res = expectation(p);
      out.probes.push({ name, fired: res.fired, detail: res.detail });
    };
    // Not invented: the control is PAINTED unavailable and the attribute is forgotten, so
    // it looks unavailable and is still operable.
    await probe('disabled-paint-without-the-attribute', { dropDisabledAttribute: true }, (p) => {
      const got = p.seen.map((s) => s.id).filter(Boolean);
      return { fired: got.some((id) => MUST_NEVER_FOCUS.includes(id)),
        detail: 'focus reached ' + JSON.stringify(got.filter((id) => MUST_NEVER_FOCUS.includes(id))) + ' — the skip obligation MUST reject this' };
    });
    // Also not invented: "do not remove focus outlines without a visible replacement".
    await probe('outline-removed-with-no-replacement', { removeOutline: true }, (p) => {
      const pd = p.seen.filter((s) => s.id);
      return { fired: pd.every((s) => parseFloat(s.outlineWidth) === 0 || s.outlineStyle === 'none'),
        detail: 'every stop reported outline-style ' + JSON.stringify([...new Set(pd.map((s) => s.outlineStyle))]) + ' — the visibility obligation MUST reject this' };
    });
    // THE SAME DEFECT WEARING THE OTHER PATTERN'S CLOTHES, and the one E1 could not have
    // found: aria-disabled applied, paint applied, and the activation never suppressed.
    await probe('discoverable-unavailable-that-still-activates', { dropActivationSuppression: true }, (p) => ({
      fired: p.activation.o4.activated > 0 || p.activation.o3.activated > 0,
      detail: 'o4 activated ' + p.activation.o4.activated + ', o3 activated ' + p.activation.o3.activated +
        ' — reachable, painted unavailable, and fully operable. The activation obligation MUST reject this',
    }));
    // Only the native pattern styled, which is what happens when an implementer styles
    // whatever the user agent hands them. The discoverable control is then unavailable,
    // reachable, and painted exactly like an available one.
    await probe('only-the-native-pattern-styled', { styleOnlyTheNativePattern: true }, (p) => ({
      fired: p.measured.o4.colour !== p.measured.r2.colour,
      detail: 'DISCOVERABLE o4 ' + p.measured.o4.colour + ' vs NATIVE r2 ' + p.measured.r2.colour +
        ' — the visual-invariance obligation MUST reject this',
    }));
    // The availability override taking the record of the user's choice along with the ink,
    // which is the tempting reading of "one ink for the whole control".
    await probe('the-override-taking-the-record-too', { collapseTheRecord: true }, (p) => ({
      fired: !(p.measured.o3.markerPresent) || p.measured.o3.weight === p.measured.o4.weight,
      detail: 'o3 marker present ' + p.measured.o3.markerPresent + ', weight ' + p.measured.o3.weight +
        ' vs plain UNAVAILABLE o4 weight ' + p.measured.o4.weight +
        ' — SELECTED + UNAVAILABLE becomes indistinguishable from UNAVAILABLE and the user’s choice is silently rewritten',
    }));
    out.walk = r;
  } finally {
    await browser.close();
  }
  writeFileSync(join(PKG, 'data/E1_FOCUS.json'), JSON.stringify({ generatedBy: 'tools/e1-focus.mjs', ...out }, null, 2) + '\n');
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await focusProof();
  for (const o of r.obligations) console.log((o.pass ? 'PASS  ' : 'FAIL  ') + o.name.padEnd(78) + '\n        ' + o.detail);
  console.log('');
  for (const p of r.probes) console.log((p.fired ? 'FIRED ' : 'SILENT') + ' probe ' + p.name.padEnd(46) + '\n        ' + p.detail);
  const bad = r.obligations.filter((o) => !o.pass).length + r.probes.filter((p) => !p.fired).length;
  console.log('\n' + r.obligations.filter((o) => o.pass).length + '/' + r.obligations.length + ' obligations, ' +
    r.probes.filter((p) => p.fired).length + '/' + r.probes.length + ' probes fired');
  if (bad) process.exit(1);
}
