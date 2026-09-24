// G3.2 live interaction check — the two decisions and their seams driven by REAL input on the live prototype: mouse
// presses at the centre of the real control (asserting that the element under the pointer IS that control), the wheel,
// keys, and real time. The harness is used only for start states and for the system settings it stands in for
// (appearance and Reduced Motion are EMULATED media features, never Product parameters).
// usage: node tools/livecheck.mjs [--proto <dir>]   → <PKG>/data/LIVECHECK.json (exit 1 on any failed step)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openPage, PKG, sleep, key, clickEl, closeServers } from './lib/session.mjs';

const PROTO = process.argv.includes('--proto') ? process.argv[process.argv.indexOf('--proto') + 1] : join(PKG, 'prototype');
const steps = [];
let J = '';
function step(name, pass, detail) { steps.push({ journey: J, step: name, pass: !!pass, detail }); console.log(pass ? 'OK  ' : 'FAIL', J, name, pass ? '' : JSON.stringify(detail)); }
const T = (c) => c.eval('window.__G32.truth()');
const focusId = (c) => c.eval(`(()=>{const a=document.activeElement;return a?(a.id||a.getAttribute('data-act')||a.getAttribute('data-scope')||a.className||a.tagName):null})()`);
async function waitFor(c, expr, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await c.eval(expr)) return true; await sleep(100); } return false; }
async function wheelAt(c, x, y, dy, n = 1) { for (let i = 0; i < n; i++) { await c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: 0, deltaY: dy }); await sleep(60); } await sleep(420); }
async function phoneXY(c, sx, sy) { const r = await c.eval(`(()=>{const b=document.getElementById('phone').getBoundingClientRect();return {x:b.left,y:b.top}})()`); return { x: r.x + sx, y: r.y + sy }; }
/* The temporal cluster, measured in phone points. */
const CLUSTER = `(()=>{const p=document.getElementById('phone').getBoundingClientRect();const r=(e)=>{if(!e||e.hidden||getComputedStyle(e).visibility==='hidden')return null;const b=e.getBoundingClientRect();return {x:+(b.left-p.left).toFixed(1),y:+(b.top-p.top).toFixed(1),w:+b.width.toFixed(1),h:+b.height.toFixed(1),b:+(b.bottom-p.top).toFixed(1),r:+(b.right-p.left).toFixed(1)}};
  const ctx=document.getElementById('tl-ctx'),lb=document.querySelector('#tl-live .lb');return {ctx:r(ctx),ctxOpacity:+getComputedStyle(ctx).opacity,ctxText:ctx.hidden?'':ctx.textContent,track:r(document.getElementById('tl-track')),live:r(document.getElementById('tl-live')),liveLabel:r(lb),band:r(document.getElementById('band')),bandText:document.getElementById('band-in').textContent,
  domCtxBeforeTrack:!!(ctx.compareDocumentPosition(document.getElementById('tl-track'))&Node.DOCUMENT_POSITION_FOLLOWING)}})()`;
const SHELL = `(()=>{const cs=(id,p)=>getComputedStyle(document.getElementById(id))[p];return {status:cs('status','color'),phone:cs('phone','backgroundColor'),rail:cs('rail','backgroundColor'),composer:cs('composer','backgroundColor'),conv:cs('conv','backgroundColor'),homebar:cs('homebar','backgroundColor')}})()`;
const lum = (css) => { const m = css.match(/[\d.]+/g).map(Number).slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return +((x + 0.05) / (y + 0.05)).toFixed(2); };
const dark = (css) => lum(css) < 0.05;

/* A — Decision B by keyboard and pointer: FOLLOW_LIVE → PINNED → «طرق العودة» → Return Live; NEAR does not grow a row */
async function temporal() {
  const c = await openPage({ proto: PROTO, capture: false, lang: 'ar', cdpPort: 9501, httpPort: 8851 });
  await key(c, 'Shift');
  J = 'B-PINNED';
  await c.eval(`window.__G32.enter('P2_LIVE17')`); await sleep(300);
  let k = await c.eval(CLUSTER), t = await T(c);
  step('following Live: no temporal line, no placeholder gap (the Timeline sits on the chrome)', !k.ctx && t.ctxLines.length === 0 && k.track.b <= k.band.y + 1, k);
  await c.eval(`document.getElementById('tl-track').focus()`);
  await key(c, 'ArrowRight'); await key(c, 'ArrowRight'); await waitFor(c, `+getComputedStyle(document.getElementById('tl-ctx')).opacity===1`, 1500);
  t = await T(c); k = await c.eval(CLUSTER);
  step('keyboard preview: the preview line stands directly above the Track (and is not in OrientationChrome)', t.PTC === 15 && k.ctx && k.ctx.b <= k.track.y && k.track.y - k.ctx.b <= 20 && /15/.test(k.ctxText) && !/نظرة مؤقتة/.test(k.bandText) && k.ctxOpacity === 1, { PTC: t.PTC, k });
  await key(c, 'Enter'); await sleep(400);
  t = await T(c); k = await c.eval(CLUSTER);
  step('Enter commits PINNED(15); the line now says where in time and that the conversation continued', t.TM === 'PINNED' && t.TC === 15 && t.ctxLines.length === 2 && k.ctxText.includes('15') && k.ctxText.includes('استمرت'), { TM: t.TM, TC: t.TC, ctx: t.ctxLines });
  step('one local cluster: line → Live-edge act → Track, the line directly above, nothing between', k.ctx.b <= k.liveLabel.y + 1 && k.liveLabel.y - k.ctx.b <= 8 && k.liveLabel.b <= k.track.y + 12, k);
  step('no duplicate orientation truth: OrientationChrome says nothing temporal', t.bandLines.length === 0 && !/اللحظة|استمرت/.test(k.bandText), { band: t.bandLines, bandText: k.bandText });
  step('reading / DOM order: the line comes before the Timeline slider', k.domCtxBeforeTrack, k.domCtxBeforeTrack);
  step('the Live-edge act\'s box and focus ring do not overlap the line', k.live.y >= k.ctx.b - 0.5, { live: k.live, ctx: k.ctx });
  step('Return Live is the dominant act at the Live edge; «طرق العودة» holds the rest (T-08 order)', t.rendered.join() === 'LIVE_EDGE:RETURN_LIVE_HEAD' && t.dominant === 'RETURN_LIVE_HEAD' && t.grouped.join() === 'BACK_ONE_STEP,RETURN_WORLD,GO_LIVE_AND_LOCATE', { rendered: t.rendered, grouped: t.grouped });
  step('focus is not dropped after the commit', (await focusId(c)) === 'tl-track', await focusId(c));
  // «طرق العودة» by keyboard
  await key(c, 'Tab'); const f1 = await focusId(c); await key(c, 'Tab'); const f2 = await focusId(c);
  step('Tab order: Timeline → Live-edge act → «طرق العودة» (visual order; the line is not a stop)', f1 === 'tl-live' && f2 === 'more-t', [f1, f2]);
  await key(c, 'Enter'); await sleep(80);
  t = await T(c);
  let exp = await c.eval(`document.getElementById('more-t').getAttribute('aria-expanded')`), ctl = await c.eval(`document.getElementById('more-t').getAttribute('aria-controls')`);
  step('«طرق العودة» Enter: aria-expanded true, aria-controls names the group, the acts are disclosed at once', exp === 'true' && ctl === 'more-acts' && t.rendered.length === 4, { exp, ctl, rendered: t.rendered });
  await key(c, 'Tab'); const f3 = await focusId(c);
  step('Tab reaches the first disclosed act in T-08 order', f3 === 'BACK_ONE_STEP', f3);
  k = await c.eval(CLUSTER);
  step('the line stays where it was: opening «طرق العودة» does not move it off the Timeline', k.ctx && k.track.y - k.ctx.b <= 20 && k.ctx.b <= k.track.y, k);
  await key(c, 'Escape'); await sleep(120);
  exp = await c.eval(`document.getElementById('more-t').getAttribute('aria-expanded')`);
  step('Escape closes it; focus returns to «طرق العودة»', exp === 'false' && (await focusId(c)) === 'more-t', { exp, focus: await focusId(c) });
  const small = await c.eval(`[...document.querySelectorAll('#phone button, #tl-track')].filter(e=>e.offsetParent&&getComputedStyle(e).visibility!=='hidden'&&+getComputedStyle(e.closest('#timeline,#band')||e).opacity>0.5).map(e=>{const b=e.getBoundingClientRect();return {id:e.id||e.getAttribute('data-act')||e.getAttribute('data-world'),w:b.width,h:b.height}}).filter(b=>b.h<44||b.w<44)`);
  step('every visible control is ≥ 44 × 44 pt', small.length === 0, small);
  // Return Live by a real press on the Live edge
  await clickEl(c, '#tl-live'); await sleep(500);
  t = await T(c); k = await c.eval(CLUSTER);
  step('a press on the Live edge returns to Live (FOLLOW_LIVE at 17)', t.TM === 'FOLLOW_LIVE' && t.TC === 17, { TM: t.TM, TC: t.TC });
  step('LIVE: no stale PINNED sentence remains, and no empty gap is left above the Timeline', !k.ctx && t.ctxLines.length === 0 && k.ctxOpacity === 0, k);
  step('focus is not dropped onto the page after Return Live', !!(await focusId(c)) && (await focusId(c)) !== 'BODY', await focusId(c));
  J = 'B-NEAR';
  await c.eval(`window.__G32.enter('P1')`); await sleep(200);
  const f0 = await c.eval('window.__G32.screenOf(window.__G32.focusIndex())'), p0 = await phoneXY(c, f0.x, f0.y);
  await wheelAt(c, p0.x, p0.y, -300, 6);
  const ff = await c.eval('window.__G32.screenOf(window.__G32.focusIndex())'), pf = await phoneXY(c, ff.x, ff.y);
  await c.click(pf.x, pf.y); await sleep(500);
  t = await T(c); k = await c.eval(CLUSTER);
  step('NEAR by the wheel, then a press inspects: the inspection line stays in OrientationChrome, no temporal row appears', t.IF && t.TM === 'FOLLOW_LIVE' && !k.ctx && t.ctxLines.length === 0 && t.bandLines.length === 1, { IF: t.IF, ctx: k.ctx, band: t.bandLines });
  step('the Return set is T-08\'s, unchanged (BACK dominant; EXACT_RETURN, RETURN_WORLD grouped)', t.offered.join() === 'BACK_ONE_STEP,EXACT_RETURN,RETURN_WORLD' && t.direct.join() === 'BACK_ONE_STEP' && t.grouped.join() === 'EXACT_RETURN,RETURN_WORLD', { offered: t.offered, direct: t.direct, grouped: t.grouped });
  await c.close();
}

/* B — Decision A under system Light, by real presses: Conversation → Analysis → Conversation, and the same call */
async function shellLight() {
  const c = await openPage({ proto: PROTO, capture: false, lang: 'ar', scheme: 'light', cdpPort: 9502, httpPort: 8852 });
  J = 'A-LIGHT';
  let t = await T(c), s = await c.eval(SHELL);
  step('system Light: the Conversation follows it (light ground, dark status ink)', t.appearance === 'light' && t.place === 'conversation' && !dark(s.conv) && dark(s.status), s);
  await clickEl(c, '#door'); await sleep(700);
  t = await T(c); s = await c.eval(SHELL);
  step('«تحليل المحادثة»: the Analysis shell is dark — phone ground, rail, home indicator ink light', t.place === 'analysis' && dark(s.phone) && dark(s.rail) && !dark(s.homebar) && t.analysisShellDark === 1, s);
  step('status region: light ink on the dark Analysis (contrast ≥ 4.5 against the shell ground)', contrast(s.status, s.phone) >= 4.5, { status: s.status, ground: s.phone, ratio: contrast(s.status, s.phone) });
  step('focus moves to «المحادثة»', (await focusId(c)) === 'back', await focusId(c));
  await clickEl(c, '#back'); await sleep(700);
  t = await T(c); s = await c.eval(SHELL);
  step('«المحادثة»: back to the system-Light Conversation shell', t.place === 'conversation' && !dark(s.conv) && !dark(s.phone) && !dark(s.rail) && dark(s.status) && t.analysisShellDark === 0, s);
  J = 'A-LIGHT-CALL';
  await clickEl(c, '#call'); await sleep(700);
  t = await T(c); s = await c.eval(SHELL); const id = t.callId;
  step('the call starts Analysis-first, in the dark Analysis shell (call line dark too)', t.place === 'analysis' && !!id && dark(s.composer) && dark(s.phone), { id, s });
  await waitFor(c, `window.__G32.truth().call==='live'`, 4000);
  await clickEl(c, '#back'); await sleep(700);
  t = await T(c); s = await c.eval(SHELL);
  step('«المحادثة» during the call: the Conversation is system Light, call line included; the SAME call', t.place === 'conversation' && t.call === 'live' && t.callId === id && !dark(s.composer) && !dark(s.conv), { id: t.callId, s });
  step('no persistent call prose; call state on the one assistive channel', t.lineLabel === '' && t.callA11y !== '', { line: t.lineLabel, a11y: t.callA11y });
  await clickEl(c, '#door'); await sleep(700);
  t = await T(c); s = await c.eval(SHELL);
  step('«تحليل المحادثة»: the SAME call, back in the dark Analysis shell', t.place === 'analysis' && t.callId === id && t.callStarts === 1 && dark(s.composer) && dark(s.phone), { id: t.callId, starts: t.callStarts, s });
  J = 'A-SYSTEM';
  await c.media({ scheme: 'dark' }); await sleep(300);
  t = await T(c); s = await c.eval(SHELL);
  step('system switches to Dark while in the Analysis: still the same dark Analysis', t.appearance === 'dark' && dark(s.phone) && dark(s.rail), s);
  await c.media({ scheme: 'light' }); await sleep(300);
  s = await c.eval(SHELL);
  step('and back to Light: the Analysis shell does not turn pale', dark(s.phone) && dark(s.rail) && !dark(s.status), s);
  await clickEl(c, '#end-call');
  await c.close();
}

/* C — Reduced Motion from the SYSTEM: the same acts, the same truth */
async function reduced() {
  J = 'RM';
  const r = await openPage({ proto: PROTO, capture: false, lang: 'ar', scheme: 'light', rm: true, rmParam: false, cdpPort: 9503, httpPort: 8853 });
  step('the system Reduced Motion setting is honoured', (await r.eval('window.__G32.reducedMotion')) === true, null);
  await clickEl(r, '#door'); await sleep(260);
  let t = await T(r), s = await r.eval(SHELL);
  step('Conversation → Analysis under Light: the shell is dark at once (the cross-fade is removed, not shortened)', t.place === 'analysis' && t.analysisShellDark === 1 && dark(s.phone), s);
  await r.eval(`window.__G32.enter('P2_LIVE17')`); await r.eval(`document.getElementById('tl-track').focus()`);
  await key(r, 'ArrowRight'); await key(r, 'ArrowRight'); await key(r, 'Enter'); await waitFor(r, `+getComputedStyle(document.getElementById('tl-ctx')).opacity===1`, 1500);
  t = await T(r); const k = await r.eval(CLUSTER);
  step('PINNED under Reduced Motion: the same line, in the same place above the Track', t.TM === 'PINNED' && t.TC === 15 && k.ctx && k.ctx.b <= k.track.y && k.track.y - k.ctx.b <= 20 && k.ctxOpacity === 1, { TC: t.TC, k });
  await clickEl(r, '#tl-live'); await sleep(260);
  t = await T(r);
  step('Return Live under Reduced Motion: FOLLOW_LIVE, the line gone at once', t.TM === 'FOLLOW_LIVE' && (await r.eval(CLUSTER)).ctx === null, t.TM);
  await r.eval(`window.__G32.enter('CONV')`); await clickEl(r, '#call'); await sleep(300); t = await T(r); const id = t.callId;
  await waitFor(r, `window.__G32.truth().call==='live'`, 4000);
  await clickEl(r, '#back'); await sleep(260); t = await T(r);
  step('the same call survives Analysis → Conversation under Reduced Motion', t.callId === id && t.place === 'conversation' && t.analysisShellDark === 0, { id: t.callId });
  await clickEl(r, '#door'); await sleep(260); t = await T(r);
  step('and returns with it to the dark Analysis', t.callId === id && t.place === 'analysis' && t.analysisShellDark === 1, t.callId);
  await clickEl(r, '#end-call');
  await r.close();
}

/* D — English mirrors the refinement */
async function english() {
  J = 'EN';
  const c = await openPage({ proto: PROTO, capture: false, lang: 'en', cdpPort: 9504, httpPort: 8854 });
  await c.eval(`window.__G32.enter('P4')`); await sleep(300);
  const k = await c.eval(CLUSTER), t = await T(c);
  step('English PINNED: the line starts at the LEFT (start) edge above the Track; the Live edge is at the RIGHT', k.ctx && k.ctx.x <= 26 && k.live.r >= 380 && k.ctx.b <= k.track.y && k.track.y - k.ctx.b <= 20 && t.ctxLines[0] === 'Reading at moment 14.', { k, ctx: t.ctxLines });
  await c.close();
}

await temporal();
await shellLight();
await reduced();
await english();
await closeServers();
const failed = steps.filter((s) => !s.pass);
mkdirSync(join(PKG, 'data'), { recursive: true });
writeFileSync(join(PKG, 'data', 'LIVECHECK.json'), JSON.stringify({ input: 'real CDP mouse presses (asserted pressable at the control centre), wheel and keys; real time; system appearance and Reduced Motion emulated as media features', total: steps.length, passed: steps.length - failed.length, failed: failed.length, steps }, null, 1));
console.log(`\n${steps.length - failed.length}/${steps.length} live steps passed`);
process.exit(failed.length ? 1 : 0);
