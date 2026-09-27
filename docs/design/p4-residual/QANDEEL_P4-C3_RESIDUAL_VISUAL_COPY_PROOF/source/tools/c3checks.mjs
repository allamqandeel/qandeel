// P4-C3 — the acceptance checks (task §10). Each check states a Product property and proves it on the built package or
// on the live page in headless Chrome. Every planted defect (src/app.js plantDefects) must be REJECTED by the check that
// names it — a check that cannot fail is a sentence, not a check.
//   node source/tools/c3checks.mjs [--no-git] [--out file]
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { openState, realClick, closeBrowser, closeServers, PKG, REPO, SOURCE, sleep } from './lib/session.mjs';
import { runJourney } from './c3capture.mjs';
import { ROWS, ROW, STATUSES, P3_SAME, C, AP, P, R, A, F, PO_RECORD, RETIRED } from '../src/content.mjs';
import { p3Table } from './c3copytable.mjs';
import { page } from '../src/build.mjs';
import { palette } from '../src/tokens.mjs';

const BASE = '0b2703ef35cbad724078926b645d2d216c860749';
const PKG_REL = 'docs/design/p4-residual/QANDEEL_P4-C3_RESIDUAL_VISUAL_COPY_PROOF';
const NOGIT = process.argv.includes('--no-git');
const OUT = (() => { const i = process.argv.indexOf('--out'); return i > 0 ? process.argv[i + 1] : join(PKG, 'data', 'CHECKS.json'); })();
const sha = (b) => createHash('sha256').update(b).digest('hex');
const rd = (p) => readFileSync(join(REPO, ...p.split('/')), 'utf8');
const posix = (p) => p.split('\\').join('/');
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' });
const DARK = palette('dark').colors, LIGHT = palette('light').colors;
const hex2rgb = (h) => { const n = parseInt(h.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };

const results = [], planted = [];
const ok = (pass, detail) => ({ pass: !!pass, detail });

// --------------------------------------------------------------------------------------------- live page helpers
async function open(o, defect) { const q = { ...(o.q || {}) }; if (defect) q.defect = defect; return openState({ ...o, q }); }
const E = (c, expr) => c.eval(expr);
const CALL_ID = 'call-7c21-01';

// ================================================================================================= THE CHECKS
const CHECKS = [];
const def = (id, fam, claim, run, defects = []) => CHECKS.push({ id, fam, claim, run, defects });

// ---------------------------------------------------------------------------------------------------- SCOPE
// P4-C3R: besides the package, exactly the narrow Product Owner approval record and the locators that make it discoverable.
const GOV_ALLOWED = [PO_RECORD, 'docs/canonical-authority/CANONICAL_AUTHORITY_INDEX.md', 'docs/p4/P4_READ_FIRST.md', 'QANDEEL_CURRENT_STATE.md'];
const FORBIDDEN = /^(apps|database|services|packages|\.github)\/|(^|\/)(package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock)$|migration|schema/i;
def('C-SCOPE-1', 'scope', 'Only this proof package (plus, since P4-C3R, the named approval record and its locators) changed against the PR head P4-C3 started from: no apps/, database/, services/, workflow, dependency, schema or migration path.', async () => {
  if (NOGIT) return ok(true, 'skipped (--no-git)');
  const changed = new Set([...git('diff', '--name-only', BASE).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].map((s) => s.trim()).filter(Boolean));
  const outside = [...changed].filter((p) => !p.startsWith(PKG_REL + '/') && !GOV_ALLOWED.includes(p));
  const forbidden = [...changed].filter((p) => !p.startsWith(PKG_REL + '/') && FORBIDDEN.test(p));
  return ok(!outside.length && !forbidden.length, { changed: changed.size, governance: [...changed].filter((p) => GOV_ALLOWED.includes(p)), outside, forbidden });
});
def('C-SCOPE-2', 'scope', 'No new dependency: every source module imports only node: built-ins or files inside source/.', async () => {
  const bad = [];
  for (const f of walk(SOURCE).filter((p) => /\.(mjs|js|cjs)$/.test(p))) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/(?:^|\n)\s*import\s[^'"]*['"]([^'"]+)['"]/g)) if (!/^(node:|\.{1,2}\/)/.test(m[1])) bad.push(`${posix(relative(SOURCE, f))} → ${m[1]}`);
  }
  return ok(!bad.length, { bad });
});
def('C-SCOPE-3', 'scope', 'No lantern asset, storyboard, timing or technology in the package: no lantern-named file, no lantern element outside the planted-defect code, no animation technology named.', async () => {
  const files = walk(PKG).map((p) => posix(relative(PKG, p)));
  const named = files.filter((p) => /lantern|فانوس/i.test(p));
  const proto = readFileSync(join(PKG, 'prototype', 'index.html'), 'utf8');
  const lanternEls = (proto.match(/data-lantern/g) || []).length;              // exactly one: the planted defect's own markup
  const tech = /\b(rive|lottie|skia|reanimated|animatedvectordrawable|windowSplashScreenAnimatedIcon)\b/i;
  const techHits = [...files.filter((p) => (p.startsWith('source/src/') && /\.(mjs|js)$/.test(p)) || p === 'prototype/index.html').filter((p) => tech.test(readFileSync(join(PKG, ...p.split('/')), 'utf8').replace(/\/\/[^\n]*/g, '')))];
  return ok(!named.length && lanternEls === 1 && !techHits.length, { named, lanternEls, techHits });
});
def('C-SCOPE-4', 'scope', 'PR #280 is still Draft, Open and Unmerged.', async () => {
  if (NOGIT) return ok(true, 'skipped (--no-git)');
  try { const j = JSON.parse(execFileSync('gh', ['pr', 'view', '280', '--repo', 'allamqandeel/qandeel', '--json', 'isDraft,state,mergedAt'], { encoding: 'utf8' })); return ok(j.isDraft && j.state === 'OPEN' && !j.mergedAt, j); }
  catch (e) { return ok(false, 'gh unavailable: ' + e.message.slice(0, 120)); }
});

// ---------------------------------------------------------------------------------------------------- PROVENANCE
def('C-PROV-1', 'provenance', 'Every vendored file is byte-identical to its frozen origin (P2-A, P3-A, I-08B2.5 brand, P4-C).', async () => {
  const prov = JSON.parse(readFileSync(join(SOURCE, 'PROVENANCE.json'), 'utf8')); const bad = [];
  for (const [to, e] of Object.entries(prov.files)) { const a = sha(readFileSync(join(SOURCE, ...to.split('/')))), b = sha(readFileSync(join(REPO, ...e.from.split('/')))); if (a !== b || a !== e.sha256) bad.push(to); }
  return ok(!bad.length, { files: Object.keys(prov.files).length, bad });
});
def('C-PROV-2', 'provenance', 'G3.2 runs byte-exact (sha 10611f35…, G3 §B).', async () => {
  const h = sha(readFileSync(join(PKG, 'prototype', 'g3.2', 'index.html')));
  return ok(h === '10611f35cdcfd031d74ad0b065634a19f530e2b1e28acfd2c944d4f2d4983d71', h);
});
def('C-PROV-3', 'provenance', 'prototype/index.html is the byte-identical build of source/.', async () => ok(page() === readFileSync(join(PKG, 'prototype', 'index.html'), 'utf8'), 'rebuild compared'));

// ---------------------------------------------------------------------------------------------------- VOICE
const voiceStates = [{ state: 'conv', q: { vn: 'paused' } }, { state: 'conv', lang: 'en', appearance: 'light', q: { vn: 'playing' } }, { state: 'record' }, { state: 'call-conv' }, { state: 'call-analysis' }, { state: 'sent', lang: 'en' }];
const NO_SIGNAL = `(()=>{const vis=(e)=>C3.visible(e);const our=[...document.querySelectorAll('#ui *, #aover *')];
  const sig=our.filter(e=>vis(e)&&/(wave|trace|level|meter|amplitude|spectrum)/i.test((e.getAttribute('class')||'')+' '+e.id)).map(e=>e.tagName+'.'+e.getAttribute('class'));
  const canv=document.querySelectorAll('#phone canvas').length;
  const vnSvg=[...document.querySelectorAll('.vn svg')].filter(s=>!s.closest('.vplay')).length;
  const recSvg=[...document.querySelectorAll('.recline svg')].length;
  const anim=document.getAnimations().filter(a=>a.playState==='running'&&a.effect&&a.effect.target&&a.effect.target.closest&&a.effect.target.closest('#ui,#aover')).length;
  const d=C3.frameDoc();const g=d&&d.getElementById('composer');const g32Level=!!(g&&document.getElementById('phone').dataset.call==='live'&&getComputedStyle(g).visibility!=='hidden'&&document.getElementById('phone').dataset.place==='analysis');
  return {sig,canv,vnSvg,recSvg,anim,g32Level}})()`;
def('C-V1', 'voice', 'No waveform, amplitude or level: no signal-shaped element, canvas or running animation in the Voice / call surfaces; the Voice Note carries only its transport glyph; G3.2\'s superseded level trace is hidden in the call.', async (o) => {
  const out = [];
  for (const s of o ? [o] : voiceStates) { const c = await open(s); const m = await E(c, NO_SIGNAL); out.push({ s: s.state, ...m }); }
  const pass = out.every((m) => !m.sig.length && !m.canv && !m.vnSvg && m.recSvg <= 1 && !m.anim && !m.g32Level);
  return ok(pass, out);
}, [{ defect: 'waveform', o: { state: 'conv', q: { vn: 'paused' } } }, { defect: 'fakelevel', o: { state: 'call-analysis' } }]);
def('C-V3', 'voice', 'The finished-call record is a history mark: not a control, no play glyph, no replayable audio, no transcript; its accessible summary states ended + length.', async (o) => {
  const out = [];
  for (const s of o ? [o] : [{ state: 'conv' }, { state: 'call-ended', lang: 'en' }]) {
    const c = await open(s);
    out.push(await E(c, `(()=>{const g=window.C3DATA.glyphs;return [...document.querySelectorAll('.crec')].map(r=>({buttons:r.querySelectorAll('button,[tabindex],a').length,play:r.innerHTML.includes(g.play24),transcript:!!(r.nextElementSibling&&r.nextElementSibling.dataset.transcript),name:r.getAttribute('aria-label'),key:r.dataset.ka}))})()`));
  }
  const all = out.flat();
  return ok(all.length >= 1 && all.every((r) => !r.buttons && !r.play && !r.transcript && r.key === 'cRecordName' && r.name), all);
}, [{ defect: 'callplay', o: { state: 'conv' } }, { defect: 'calltranscript', o: { state: 'conv' } }]);
def('C-V4', 'voice', 'A Live Call is Analysis-first: starting one from the Conversation (real click) lands in the Analysis with the call live.', async () => {
  const c = await open({ state: 'conv' }); await runJourney(c, [['click', '#call-entry']]);
  const m = await E(c, `({place:document.getElementById('phone').dataset.place,call:document.getElementById('phone').dataset.call,id:(document.querySelector('#acall .callline')||{dataset:{}}).dataset.callId})`);
  return ok(m.place === 'analysis' && m.call === 'live' && m.id === CALL_ID, m);
});
def('C-V5', 'voice', 'The same call survives Conversation ↔ Analysis (real input): one call id in the line and in G3.2, elapsed only increases; ending leaves one record of that length.', async (o) => {
  if (o) { const c = await open(o); const m = await E(c, `({dom:(document.querySelector('.callline')||{dataset:{}}).dataset.callId,state:C3.S.call&&C3.S.call.id})`); return ok(m.dom === m.state && m.dom === CALL_ID, m); }
  const c = await open({ state: 'conv' }); const seq = [];
  const snap = async (label) => seq.push({ label, ...(await E(c, `(()=>{const l=[...document.querySelectorAll('.callline')].find(e=>C3.visible(e));return {place:document.getElementById('phone').dataset.place,id:l&&l.dataset.callId,el:l&&l.querySelector('.celapsed').textContent,g:C3.g32()&&C3.g32().callId,recs:[...document.querySelectorAll('.crec .cd')].map(e=>e.textContent)}})()`)) });
  await runJourney(c, [['click', '#call-entry'], ['advance', 16]]); await snap('analysis');
  await runJourney(c, [['frameClick', '#back'], ['advance', 86]]); await snap('conversation');
  await runJourney(c, [['click', '#door'], ['advance', 16]]); await snap('analysis again');
  await runJourney(c, [['click', '#c-end']]); await snap('ended');
  const secs = (s) => { const [m, x] = s.split(':').map(Number); return m * 60 + x; };
  const live = seq.slice(0, 3);
  const pass = live.every((s) => s.id === CALL_ID) && new Set(live.map((s) => s.g)).size === 1 && secs(live[0].el) < secs(live[1].el) && secs(live[1].el) < secs(live[2].el) &&
    live[0].place === 'analysis' && live[1].place === 'conversation'.slice(0, 4) && live[2].place === 'analysis' && seq[3].recs.at(-1) === live[2].el;
  return ok(pass, seq);
}, [{ defect: 'callchange', o: { state: 'call-conv' } }]);
def('C-V6', 'voice', 'Normal call state has no persistent explanatory prose: the call line shows only elapsed digits; "microphone on / muted / QANDEEL speaking / call continues" are assistive-only; one status channel.', async (o) => {
  const out = [];
  for (const s of o ? [o] : [{ state: 'call-analysis' }, { state: 'call-conv' }, { state: 'call-muted', lang: 'en' }, { state: 'call-conv', lang: 'en', appearance: 'light' }]) {
    const c = await open(s);
    out.push(await E(c, `(()=>{const l=[...document.querySelectorAll('.callline')].find(e=>C3.visible(e));const txt=[...l.querySelectorAll('*')].filter(e=>C3.visible(e)&&!e.children.length&&!e.closest('.sr')&&e.textContent.trim()).map(e=>e.textContent.trim());
      const prose=[...document.querySelectorAll('[data-k]')].filter(e=>C3.visible(e)&&!e.closest('.sr')&&['cA11yOn','cA11yMuted','cContinues','cConnecting'].includes(e.dataset.k)).length;
      const status=document.querySelectorAll('#ui [role=status],#aover [role=status]').length;const d=C3.frameDoc();const g=d&&d.getElementById('call-a11y');
      return {txt,prose,status,g32Channel:g?g.hasAttribute('inert'):true}})()`));
  }
  return ok(out.every((m) => m.txt.every((x) => /^\d+:\d\d$/.test(x)) && !m.prose && m.status === 1 && m.g32Channel), out);
}, [{ defect: 'speakingprose', o: { state: 'call-conv' } }]);
def('C-V7', 'voice', 'Canonical P2 glyphs are used: the call line, the Voice Note transport, the composer entries and the call record carry P2-A\'s own drawings byte-for-byte.', async () => {
  const c = await open({ state: 'call-conv' });
  const m1 = await E(c, `(()=>{const N=(s)=>{const t=document.createElement('template');t.innerHTML=s;return t.innerHTML};const g=window.C3DATA.glyphs,l=document.querySelector('.callline');return {end:l.querySelector('#c-end').innerHTML===N(g.endCall),mute:l.querySelector('#c-mute').innerHTML===N(g.callMic+g.callMuted),route:l.querySelector('#c-route').innerHTML===N(g.routeOn+g.routeOff),art:l.innerHTML.startsWith(N(g.railArt)),rec:document.querySelector('.crec .cg').innerHTML===N(g.call16)}})()`);
  const c2 = await open({ state: 'conv', q: { vn: 'paused' } });
  const m2 = await E(c2, `(()=>{const N=(s)=>{const t=document.createElement('template');t.innerHTML=s;return t.innerHTML};const g=window.C3DATA.glyphs;return {play:document.querySelector('.vplay').innerHTML===N(g.play24),call:document.getElementById('call-entry').innerHTML===N(g.call24),mic:document.getElementById('mic-entry').innerHTML===N(g.mic24)}})()`);
  const { sigSvg } = await import('../src/sig.mjs');
  const { END_GLYPH_PX } = await import('../src/machines.mjs');
  const m3 = { endIsP2: sigSvg('endCall', { size: END_GLYPH_PX, cls: 'g-end' }) === (await E(c, 'window.C3DATA.glyphs.endCall')), endPx: END_GLYPH_PX };
  return ok(Object.values(m1).every(Boolean) && Object.values(m2).every(Boolean) && m3.endIsP2 && END_GLYPH_PX === 27, { ...m1, ...m2, ...m3 });
});
const GEOM = `(()=>{const W=document.getElementById('phone').getBoundingClientRect().width;const rtl=document.getElementById('phone').dataset.lang==='ar';return [...document.querySelectorAll('.t.me')].map(v=>{const r=v.getBoundingClientRect();const cs=getComputedStyle(v);
  return {voice:v.classList.contains('vn'),attached:rtl?Math.abs(r.right-W)<1:Math.abs(r.left)<1,start:[cs.borderStartStartRadius,cs.borderEndStartRadius],inward:[cs.borderStartEndRadius,cs.borderEndEndRadius],bg:cs.backgroundColor,surfaceOk:cs.backgroundColor===getComputedStyle(document.getElementById('composer')).backgroundColor,notBrass:cs.backgroundColor!==cs.getPropertyValue('--brass')}})})()`;
def('C-V8', 'voice', 'The Voice Note is the reader\'s UTTERANCE: attached to the author\'s edge (Arabic right, English left), rounded only inward, on the one functional Surface tone — the same slab as a written turn.', async (o) => {
  const out = [];
  for (const s of o ? [o] : [{ state: 'conv', q: { vn: 'paused' } }, { state: 'conv', lang: 'en', appearance: 'light' }, { state: 'conv', w: 320, h: 568 }]) { const c = await open(s); out.push(await E(c, GEOM)); }
  const all = out.flat();
  return ok(all.some((v) => v.voice) && all.every((v) => v.attached && v.start.every((x) => x === '0px') && v.inward.every((x) => x === '18px') && v.surfaceOk), all);
}, [{ defect: 'wrongdir', o: { state: 'conv', q: { vn: 'paused' } } }]);
def('C-V9', 'voice', 'No Brass as speaker colour: the Voice Note, its control and its ink use Surface / primary / secondary / tertiary only; Brass stays on the navigation family.', async () => {
  const out = [];
  for (const [ap, pal] of [['dark', DARK], ['light', LIGHT]]) {
    const c = await open({ state: 'conv', appearance: ap, q: { vn: 'paused' } });
    const cols = await E(c, `[...document.querySelectorAll('.vn, .vn *, .crec, .crec *')].flatMap(e=>{const s=getComputedStyle(e);return [s.color,s.backgroundColor]})`);
    out.push({ ap, brass: hex2rgb(pal.brass), hit: cols.filter((x) => x === hex2rgb(pal.brass)).length });
  }
  return ok(out.every((o) => !o.hit), out);
});
def('C-V10', 'voice', 'Stored playback state is carried by FORM, not colour: at rest there is only the hairline; once played, the heard part is twice the weight and ends in a position mark; mute changes the drawing, not only its colour.', async (o) => {
  const out = [];
  for (const s of o ? [o] : [{ state: 'conv', q: { vn: 'paused' } }, { state: 'conv', lang: 'en', q: { vn: 'rest' } }]) {
    const c = await open(s);
    out.push(await E(c, `(()=>{const v=document.querySelector('.vn');const d=v.querySelector('.done'),r=v.querySelector('.rest'),p=v.querySelector('.pos');return {play:v.dataset.play,doneVis:!!d&&C3.visible(d),posVis:!!p&&C3.visible(p),doneH:d?parseFloat(getComputedStyle(d).height):0,restH:parseFloat(getComputedStyle(r).height)}})()`));
  }
  const c2 = await open({ state: 'call-muted' });
  const mute = await E(c2, `(()=>{const l=document.querySelector('.callline');const on=l.querySelector('.g-mic'),off=l.querySelector('.g-muted');return {pressed:l.querySelector('#c-mute').getAttribute('aria-pressed'),micShown:C3.visible(on),mutedShown:C3.visible(off),routeOff:C3.visible(l.querySelector('.g-off'))}})()`);
  const vnOk = out.every((m) => (m.play === 'rest' ? !m.doneVis && !m.posVis : m.doneVis && m.posVis && m.doneH >= 2 * m.restH));
  return ok(vnOk && (o ? true : mute.pressed === 'true' && !mute.micShown && mute.mutedShown && mute.routeOff), { vn: out, mute });
}, [{ defect: 'colouronly', o: { state: 'conv', q: { vn: 'paused' } } }]);
def('C-V11', 'voice', 'The Analysis stays the dark place during a call, even under system Light (G3 §C.1); the Conversation follows the appearance.', async (o) => {
  const c = await open(o || { state: 'call-analysis', lang: 'en', appearance: 'light' });
  const a = await E(c, `({ap:document.getElementById('phone').dataset.appearance,g:C3.g32()&&C3.g32().shellDark})`);
  if (o) return ok(a.ap === 'dark', a);
  const c2 = await open({ state: 'call-conv', lang: 'en', appearance: 'light' });
  const b = await E(c2, `document.getElementById('phone').dataset.appearance`);
  return ok(a.ap === 'dark' && a.g >= 0.999 && b === 'light', { analysis: a, conversation: b });
}, [{ defect: 'lightanalysis', o: { state: 'call-analysis', lang: 'en', appearance: 'light' } }]);

// ---------------------------------------------------------------------------------------------------- COPY
const G11 = rd('docs/design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md');
def('C-COPY-1', 'copy', 'The frozen Arabic normal opener is exact — in the registry (against G1.1 §1) and on the rendered page.', async (o) => {
  const frozen = G11.match(/«(اهلا يا \{display_name\}[^»]*)»/)[1];
  const c = await open(o || { state: 'opener' });
  const shown = await E(c, `document.querySelector('[data-k="opener"]').textContent`);
  return ok(ROW.opener.ar === frozen && shown === frozen.replace('{display_name}', 'نور'), { frozen, registry: ROW.opener.ar, shown });
}, [{ defect: 'openerdrift', o: { state: 'opener' } }]);
const allText = `(()=>{const t=[...document.querySelectorAll('#phone *')].filter(e=>C3.visible(e)&&!e.children.length).map(e=>e.textContent);const n=[...document.querySelectorAll('#phone [aria-label]')].map(e=>e.getAttribute('aria-label'));const d=C3.frameDoc();const f=d?[...d.querySelectorAll('[aria-label]')].filter(e=>e.getClientRects().length).map(e=>e.getAttribute('aria-label')):[];return [...t,...n,...f]})()`;
def('C-COPY-2', 'copy', 'English casing is QANDEEL everywhere: no "Qandeel" in any registry row, rendered word or accessible name.', async (o) => {
  const reg = ROWS.filter((r) => /\bQandeel\b/.test(r.en)).map((r) => r.k); const hits = [];
  for (const s of o ? [o] : [{ state: 'conv', lang: 'en' }, { state: 'notif', lang: 'en' }, { state: 'call-analysis', lang: 'en' }, { state: 'settings', lang: 'en' }]) { const c = await open(s); hits.push(...(await E(c, allText)).filter((x) => /\bQandeel\b/.test(x))); }
  return ok(!reg.length && !hits.length, { reg, hits: [...new Set(hits)] });
}, [{ defect: 'casing', o: { state: 'conv', lang: 'en' } }]);
const CANON_SRC = {
  product: ['docs/canonical-authority/final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md'],
  conv: ['docs/design/i-08b3.1-g1.1/QANDEEL_G1_1_CANONICAL_CLOSURE_AND_AMENDMENTS.md'],
  shared: ['docs/design/i-08b3.1-g1.2/QANDEEL_G1_2_CANONICAL_CLOSURE.md'],
  public: ['I08A4'], mine: ['I08A4'], intro: ['I08A4'], settings: ['I08A4'], gIntro: ['I08A4'],
  understanding: ['docs/qandeel-p1-user-identity-preferences-understanding-canonical-closure.md'],
  activity: ['P3'], gNotif: ['P3'],
  liveRejoin: ['apps/mobile/src/orientation-chrome/product-copy.ts'], temporalLive: ['apps/mobile/src/orientation-chrome/product-copy.ts'], returnsLabel: ['apps/mobile/src/orientation-chrome/product-copy.ts'],
};
const ALIAS = { I08A4: 'docs/canonical-authority/final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md', P3: 'docs/qandeel-p3-notification-activity-final-realization-canonical-closure.md' };
def('C-COPY-3', 'copy', 'Frozen names are not rewritten: every CANON row appears verbatim in its named authority (G1.1, G1.2, I-08A4, P1, P3, T-08 product-copy.ts, P3-A COPY_TABLE APPROVED rows).', async () => {
  const p3 = p3Table().interfaceRows; const bad = [];
  for (const r of ROWS.filter((x) => x.st === C)) {
    const srcs = (CANON_SRC[r.k] || []).map((s) => ALIAS[s] || s);
    const text = srcs.map(rd).join('\n');
    const inP3 = (s, lang) => p3.some((x) => (lang === 'ar' ? x.ar === s && /APPROVED|CANON|DIRECTION/.test(x.arStatus) : x.en === s && /APPROVED|CANON/.test(x.enStatus)));
    for (const [lang, s] of [['ar', r.ar], ['en', r.en]]) {
      if (s === '—') continue;
      const casingNote = lang === 'en' && /QANDEEL/.test(s) && inP3(s.replace('QANDEEL', 'Qandeel'), lang);          // P4-C2 §5 casing
      if (!(text.includes(s) || inP3(s, lang) || casingNote)) bad.push(`${r.k}.${lang}: ${s}`);
    }
  }
  return ok(!bad.length, { canon: ROWS.filter((x) => x.st === C).length, bad });
});
const APPROVED_KEYS = ['replayNoun', 'confMixed', 'pidBody'];   // exactly the P4-C3R Product Owner approvals — no more
def('C-COPY-4', 'copy', 'Every registry row carries exactly one of the six statuses; "Needs PO approval" is YES exactly for PROPOSED_FOR_PO_REVIEW; APPROVED_BY_PO_P4C3 is carried by exactly the three rows the Product Owner approved in P4-C3R, each naming the approval record — never by relabelling as CANON.', async () => {
  const bad = ROWS.filter((r) => !STATUSES.includes(r.st) || (r.po === 'YES') !== (r.st === P)).map((r) => r.k);
  const ap = ROWS.filter((r) => r.st === AP).map((r) => r.k);
  const apOk = ap.length === APPROVED_KEYS.length && APPROVED_KEYS.every((k) => ap.includes(k)) && APPROVED_KEYS.every((k) => /P4-C3R PO approval record/.test(ROW[k].src));
  return ok(!bad.length && apOk, { rows: ROWS.length, bad, approved: ap });
});
const RENDERED = `(()=>{const out=[];for(const e of document.querySelectorAll('#phone [data-k]')){if(!C3.visible(e))continue;out.push({k:e.dataset.k,t:e.textContent.trim()})}
  const loose=[...document.querySelectorAll('#ui *')].filter(e=>C3.visible(e)&&!e.children.length&&e.textContent.trim()&&!e.closest('[data-k],[data-fixture],.fprobe,.status,.handoff,.day,.vtime,.cd,.num,.celapsed,.sr,bdi')).map(e=>e.textContent.trim());return {out,loose}})()`;
const fill = (k, lang, t) => { let s = lang === 'ar' ? ROW[k].ar : ROW[k].en; return s; };
def('C-COPY-5', 'copy', 'Every word the page shows is a registered string and matches its registry text exactly (no unregistered or drifted copy) — so every newly authored word is tagged with its status.', async (o) => {
  const out = [];
  for (const s of o ? [o] : [{ state: 'conv' }, { state: 'conv', lang: 'en' }, { state: 'record' }, { state: 'notif', q: { sec: 'proactive' } }, { state: 'notif', lang: 'en', q: { sec: 'lock' } }, { state: 'settings' }, { state: 'settings', lang: 'en' }, { state: 'publicid' }, { state: 'publicid', lang: 'en' }, { state: 'understanding' }, { state: 'understanding', lang: 'en' }]) {
    const c = await open(s); const m = await E(c, RENDERED); const lang = s.lang || 'ar';
    const drift = m.out.filter((x) => { const r = ROW[x.k]; if (!r) return true; const want = (lang === 'ar' ? r.ar : r.en); return !want.includes('{') && x.t !== want; });
    out.push({ s: s.state + '/' + lang, n: m.out.length, drift, loose: m.loose });
  }
  return ok(out.every((m) => !m.drift.length && !m.loose.length), out);
}, [{ defect: 'ungated', o: { state: 'record' } }, { defect: 'contextword', o: { state: 'understanding', lang: 'en' } }]);
def('C-COPY-6', 'copy', 'The P3 permission-education sheet stays AUDIT_OWNED (P4-C2 §5); none of its strings is proposed.', async () => {
  const keys = ['p3.eduTitle', 'p3.eduBody', 'p3.eduAllow', 'p3.eduNotNow', 'p3.osBoundary', 'p3.osBoundaryNote', 'p3.notNowNote'];
  return ok(keys.every((k) => ROW[k] && ROW[k].st === A), keys.map((k) => [k, ROW[k] && ROW[k].st]));
});
def('C-COPY-7', 'copy', 'Voice / call strings stay RUNTIME_GATED (QAN-BL-VOICE-01; VI-01 V01–V07), including the two P3-A marked CANON; the only visible gated words are the capture word and the call record\'s word.', async () => {
  const gated = ROWS.filter((r) => /^(v[A-Z]|c[A-Z])/.test(r.k) || r.k === 'replayCallNote');
  const visible = [];
  for (const s of [{ state: 'record' }, { state: 'conv' }, { state: 'call-conv' }, { state: 'call-analysis', lang: 'en' }]) { const c = await open(s); visible.push(...(await E(c, `[...document.querySelectorAll('[data-k]')].filter(e=>C3.visible(e)&&!e.closest('.sr')).map(e=>e.dataset.k)`)).filter((k) => ROW[k] && ROW[k].st === R)); }
  return ok(gated.every((r) => r.st === R) && [...new Set(visible)].every((k) => ['vRecording', 'cRecord'].includes(k)), { gated: gated.length, visibleGated: [...new Set(visible)] });
});
def('C-COPY-8', 'copy', 'Fixture text stays FIXTURE_ONLY: all 63 P3-A event sentences, the conversation turns (rendered data-fixture) and the specimen / handle values.', async () => {
  const fx = p3Table().fixtureRows; const reg = JSON.parse(readFileSync(join(PKG, 'data', 'COPY_REGISTRY.json'), 'utf8'));
  const inReg = reg.rows.filter((r) => r.k.startsWith('p3fx.'));
  const c = await open({ state: 'conv' }); const n = await E(c, `document.querySelectorAll('[data-fixture]').length`);
  return ok(fx.length === 63 && inReg.length === 63 && inReg.every((r) => r.st === F) && ['uFix1', 'uFix2', 'uFix3', 'uFix4', 'pidFixtureOld', 'pidFixtureNew'].every((k) => ROW[k].st === F) && n >= 4, { p3: fx.length, registry: inReg.length, renderedFixtureTurns: n });
});
def('C-COPY-9', 'copy', 'Arabic / English semantic parity: every row has both languages (or neither), with identical placeholders.', async () => {
  const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  const bad = ROWS.filter((r) => (r.ar === '—') !== (r.en === '—') || ph(r.ar) !== ph(r.en)).map((r) => r.k);
  return ok(!bad.length, { rows: ROWS.length, bad });
});
def('C-COPY-10', 'copy', 'English register: no PROPOSED English string ships "context" or "live" as a product word (VI-01 §4 / §7.2); the Live edge the page shows uses the proposed words.', async (o) => {
  const bad = ROWS.filter((r) => (r.st === P || r.st === AP) && /\b(context|live)\b/i.test(r.en)).map((r) => r.k);
  const c = await open(o || { state: 'analysis', lang: 'en' });
  const edge = await E(c, `(()=>{const d=C3.frameDoc();const e=d.getElementById('tl-live');return e?e.getAttribute('aria-label'):null})()`);
  return ok(!bad.length && edge === ROW.liveFollowing.en, { bad, edge });
}, [{ defect: 'livecopy', o: { state: 'analysis', lang: 'en' } }]);
def('C-COPY-11', 'copy', 'P3 residual coverage: every one of P3-A\'s 125 interface keys is dispositioned (its own row, or the same Product string above).', async () => {
  const ui = p3Table().interfaceRows; const miss = ui.filter((r) => !ROW['p3.' + r.key] && !P3_SAME[r.key]).map((r) => r.key);
  const dangling = Object.values(P3_SAME).filter((k) => !ROW[k]);
  return ok(ui.length === 125 && !miss.length && !dangling.length, { keys: ui.length, miss, dangling });
});
def('C-COPY-12', 'copy', 'Arabic T1 register and gender: no PROPOSED Arabic chrome string uses spoken-Egyptian markers or masculine singular imperatives (VI-01 §3.1, §3.6). The frozen opener is exempt.', async () => {
  const marks = /(معاك|معايا|ليك|بتاعك|تقدر|هتقدر|دلوقتي|مفيش|عايز|بيتحكم|هيفضل|يستاهل|(^|\s)(اضغط|اسحب|اختر|ادخل|اترك|استخدم)(\s|$))/;
  const bad = ROWS.filter((r) => (r.st === P || r.st === AP) && r.k !== 'opener' && marks.test(r.ar)).map((r) => `${r.k}: ${r.ar}`);
  return ok(!bad.length, { proposed: ROWS.filter((r) => r.st === P || r.st === AP).length, bad });
});

// ---------------------------------------------------------------------------------------------------- P4-C3R corrections
const LIVE_COPY = `(()=>{const d=C3.frameDoc();const t=[...document.querySelectorAll('#phone [data-k]')].filter(e=>C3.visible(e)).map(e=>({k:e.dataset.k,t:e.textContent.trim()}));
  const n=[...document.querySelectorAll('#phone [aria-label]')].map(e=>e.getAttribute('aria-label'));const f=d?[...d.querySelectorAll('[aria-label]')].map(e=>e.getAttribute('aria-label')):[];
  const rm=d&&d.getElementById('rmenu');return {t,names:[...n,...f],rmenu:rm?rm.getAttribute('aria-label'):null}})()`;
def('C-COPY-13', 'copy', 'The Product Owner\'s P4-C3R wording is active and the replaced wording cannot return: confidence «يوجد تعارض» / Mixed (never «فيه تعارض»); the approved Public ID English sentence (never the older one); the Replay noun «إعادة العرض» / Replay (never «عرض الجلسة» / Session Replay) — in the registry, the generated table and on the rendered page.', async (o) => {
  const reg = [], page = [];
  if (!o) {
    if (ROW.confMixed.ar !== 'يوجد تعارض' || ROW.confMixed.en !== 'Mixed') reg.push('confMixed');
    if (ROW.pidBody.en !== 'This is the only time you can manually change your Public ID. After you confirm, the new ID is permanent and can’t be changed again.') reg.push('pidBody.en');
    if (ROW.replayNoun.ar !== 'إعادة العرض' || ROW.replayNoun.en !== 'Replay') reg.push('replayNoun');
    const active = ROWS.flatMap((r) => [r.ar, r.en]);
    for (const s of Object.values(RETIRED)) if (active.some((a) => a.includes(s))) reg.push('retired active: ' + s);
    const table = JSON.parse(readFileSync(join(PKG, 'data', 'COPY_REGISTRY.json'), 'utf8')).rows.flatMap((r) => [r.ar, r.en]);
    for (const s of Object.values(RETIRED)) if (table.some((a) => a.includes(s))) reg.push('retired in COPY_REGISTRY.json: ' + s);
    const byK = Object.fromEntries(JSON.parse(readFileSync(join(PKG, 'data', 'COPY_REGISTRY.json'), 'utf8')).rows.map((r) => [r.k, r]));
    for (const k of APPROVED_KEYS) if (byK[k].ar !== ROW[k].ar || byK[k].en !== ROW[k].en || byK[k].st !== AP) reg.push('generated table stale: ' + k);
  }
  const states = o ? [o] : [{ state: 'understanding' }, { state: 'understanding', lang: 'en' }, { state: 'publicid' }, { state: 'publicid', lang: 'en' }, { state: 'analysis-replay' }, { state: 'analysis-replay', lang: 'en' }];
  for (const s of states) {
    const c = await open(s); const m = await E(c, LIVE_COPY); const lang = s.lang || 'ar'; const bad = [];
    const all = [...m.t.map((x) => x.t), ...m.names];
    for (const x of Object.values(RETIRED)) if (all.some((a) => a.includes(x))) bad.push('retired: ' + x);
    const want = (k) => (lang === 'ar' ? ROW[k].ar : ROW[k].en);
    if (s.state === 'understanding' && !m.t.some((x) => x.k === 'confMixed' && x.t === want('confMixed'))) bad.push('confMixed missing');
    if (s.state === 'publicid' && !m.t.some((x) => x.k === 'pidBody' && x.t === want('pidBody'))) bad.push('pidBody missing');
    if (s.state === 'analysis-replay' && m.rmenu !== want('replayNoun')) bad.push('replayNoun: ' + m.rmenu);
    page.push({ s: s.state + '/' + lang, bad });
  }
  return ok(!reg.length && page.every((p) => !p.bad.length), { reg, page });
}, [{ defect: 'oldmixed', o: { state: 'understanding' } }, { defect: 'oldpid', o: { state: 'publicid', lang: 'en' } }, { defect: 'sessionreplay', o: { state: 'analysis-replay', lang: 'en' } }]);

// ---------------------------------------------------------------------------------------------------- GOVERNANCE (P4-C3R)
const I08A4 = 'docs/canonical-authority/final-product-experience/i-08a/QANDEEL_I-08A4_CLOSURE_SYNTHESIS_CANONICAL_PRODUCT_SHELL_IA_NAMING_DECISION_RECORD.md';
const REPORTS = ['P4C3_READ_FIRST.md', 'docs/P4C3_PRODUCT_PROOF_REPORT.md', 'docs/P4C3_COPY_PROOF_REPORT.md', 'docs/P4C3_PLATFORM_LAUNCH_RESEARCH.md', 'docs/P4C3_AUTHORITY_AND_SCOPE.md'];
const TECH = /\b(rive|lottie|skia|reanimated|animatedvectordrawable|windowSplashScreenAnimatedIcon)\b/i;
def('C-GOV-1', 'governance', 'The Product Owner decisions are recorded, not left open: F-01 (launch appearance) and F-02 (Replay name) read RESOLVED and no open question Q-1 remains in any report or in the regenerated launch boards\' source; the controlled amendment exists with its frozen-on-merge status, records the platform split and the narrow supersession, keeps P4 ACTIVE, names no lantern technology; I-08A4\'s historical bytes are untouched.', async (o) => {
  const bad = [];
  const docs = Object.fromEntries(REPORTS.map((p) => [p, readFileSync(join(PKG, ...p.split('/')), 'utf8')]));
  docs['source/tools/c3boards.mjs'] = readFileSync(join(SOURCE, 'tools', 'c3boards.mjs'), 'utf8');
  if (o && o.defect === 'openq') docs['docs/P4C3_PRODUCT_PROOF_REPORT.md'] += '\n## 6. Question for the Product Owner\n\n**Q-1 — Launch appearance.** Open.\n';
  for (const [p, s] of Object.entries(docs)) for (const line of s.split('\n')) if (/\bQ-1\b/.test(line) && !/RESOLVED|resolved|approved|Approved/.test(line)) bad.push(`${p}: open Q-1 — ${line.trim().slice(0, 80)}`);
  const rep = docs['docs/P4C3_PRODUCT_PROOF_REPORT.md'];
  const f01 = rep.split('\n').find((l) => l.startsWith('| F-01')), f02 = rep.split('\n').find((l) => l.startsWith('| F-02'));
  if (!f01 || !/RESOLVED BY PRODUCT OWNER/.test(f01)) bad.push('F-01 not resolved');
  if (!f02 || !/RESOLVED BY PRODUCT OWNER \/ CONTROLLED AMENDMENT/.test(f02)) bad.push('F-02 not resolved');
  if (/Question for the Product Owner/.test(rep)) bad.push('open-question section remains');
  if (!/CORRECTIONS COMPLETE \/ READY FOR FINAL INDEPENDENT REVIEW/.test(rep)) bad.push('status line');
  let rec = ''; try { rec = rd(PO_RECORD); } catch { bad.push('approval record missing'); }
  for (const must of ['CANONICAL PRODUCT DECISION RECORD / CONTROLLED AMENDMENT — EFFECTIVE / FROZEN ON MERGE', 'P4 remains ACTIVE', 'يوجد تعارض', 'إعادة العرض', 'عرض الجلسة', 'Session Replay', 'device / system appearance', 'effective QANDEEL app appearance', 'This is the only time you can manually change your Public ID. After you confirm, the new ID is permanent and can’t be changed again.', 'QAN-BL-NAV-02'])
    if (!rec.includes(must)) bad.push('record lacks: ' + must.slice(0, 40));
  if (TECH.test(rec)) bad.push('record names an animation technology');
  if (!NOGIT) { const before = git('show', `${BASE}:${I08A4}`); if (before !== rd(I08A4)) bad.push('I-08A4 bytes changed'); }
  return ok(!bad.length, { bad });
}, [{ defect: 'openq', o: { defect: 'openq' } }]);

// ---------------------------------------------------------------------------------------------------- ACCESSIBILITY
const CTRL = `(()=>{const ours=C3.controls();const d=C3.frameDoc();const fr=d&&document.getElementById('phone').dataset.place==='analysis'?[...d.querySelectorAll('button,[role=slider]')].filter(e=>{if(!e.getClientRects().length||e.closest('[inert]'))return false;const s=getComputedStyle(e);return s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0.5}).map(e=>({id:e.id,name:(e.getAttribute('aria-label')||e.textContent||'').trim(),frame:1})):[];return [...ours,...fr]})()`;
const A11Y_STATES = [{ state: 'conv', q: { vn: 'paused' } }, { state: 'conv', lang: 'en' }, { state: 'record' }, { state: 'call-conv' }, { state: 'call-analysis', lang: 'en' }, { state: 'analysis-pinned' }, { state: 'notif' }, { state: 'publicid', lang: 'en' }, { state: 'settings' }];
def('C-A1', 'accessibility', 'Every visible control, and every icon-only control in particular, has a non-empty accessible name — ours and the G3.2 controls that stay visible.', async (o) => {
  const out = [];
  for (const s of o ? [o] : A11Y_STATES) { const c = await open(s); const cs = await E(c, CTRL); out.push({ s: s.state, n: cs.length, unnamed: cs.filter((x) => !x.name).map((x) => x.id || x.cls) }); }
  return ok(out.every((m) => !m.unnamed.length), out);
}, [{ defect: 'noname', o: { state: 'call-conv' } }]);
def('C-A2', 'accessibility', 'Every control of ours meets the 44 × 44 pt target (P2 §10 / P3 §16; Apple HIG 44 pt). Android\'s 48 dp is reported per control as an implementation note, not a failure (finding F-05).', async (o) => {
  const out = [];
  for (const s of o ? [o] : A11Y_STATES) { const c = await open(s); const cs = (await E(c, CTRL)).filter((x) => !x.frame); out.push({ s: s.state, small: cs.filter((x) => x.w < 43.5 || x.h < 43.5).map((x) => `${x.id || x.cls} ${x.w}×${x.h}`), under48: cs.filter((x) => x.w < 47.5 || x.h < 47.5).length, n: cs.length }); }
  return ok(out.every((m) => !m.small.length), out);
}, [{ defect: 'smalltarget', o: { state: 'conv', q: { vn: 'paused' } } }]);
def('C-A3', 'accessibility', 'Meaning is never colour-only: Voice Note state is form (C-V10), mute / route are form, confidence states are words, the call record has a glyph and a word, and the switcher selection has a marker + weight.', async () => {
  const c = await open({ state: 'understanding' });
  const words = await E(c, `[...document.querySelectorAll('.spec .k')].map(e=>e.textContent.trim())`);
  const c2 = await open({ state: 'conv' });
  const sel = await E(c2, `(()=>{const it=document.querySelector('.rail .it.sel');const a=getComputedStyle(it,'::after');return {marker:a.content!=='none'&&parseFloat(a.height)>0,weight:getComputedStyle(it.querySelector('.lb')).fontWeight}})()`);
  const rec = await E(c2, `(()=>{const r=document.querySelector('.crec');return {glyph:!!r.querySelector('.cg svg'),word:!!r.querySelector('.cw').textContent.trim()}})()`);
  return ok(words.length === 4 && words.every(Boolean) && sel.marker && +sel.weight > 400 && rec.glyph && rec.word, { words, sel, rec });
});
const CLIP = `(()=>{const W=document.getElementById('phone').getBoundingClientRect().width;const bad=[];for(const t of C3.texts()){if(t.scrollW>t.clientW+1&&t.clientW>0)bad.push('overflow '+t.k);if(t.x<-0.5||t.r>W+0.5)bad.push('outside '+t.k+' '+t.x+'..'+t.r)}
  for(const v of document.querySelectorAll('.vn,.crec,.callline,.recline,.sheet,.hdr,.prow')){if(!C3.visible(v))continue;const r=v.getBoundingClientRect();if(r.left<-0.5||r.right>W+0.5)bad.push('box '+v.className+' '+Math.round(r.left)+'..'+Math.round(r.right))}
  const h=document.querySelector('#hdr');if(h&&h.scrollWidth>h.clientWidth+1)bad.push('chrome overflow');const sw=document.documentElement.scrollWidth;return {bad,sw}})()`;
def('C-A4', 'accessibility', 'At 320 × 568 nothing essential clips: every registered string fits its box, every Voice / call / warning box stays inside the phone, the chrome does not overflow, in Arabic and English.', async () => {
  const out = [];
  for (const s of [{ state: 'conv', q: { vn: 'paused' } }, { state: 'conv', lang: 'en', q: { vn: 'paused' } }, { state: 'opener', lang: 'en' }, { state: 'record' }, { state: 'record', lang: 'en' }, { state: 'call-conv', lang: 'en' }, { state: 'call-analysis' }, { state: 'notif', q: { sec: 'proactive' } }, { state: 'notif', lang: 'en', q: { sec: 'quiet' } }, { state: 'publicid' }, { state: 'publicid', lang: 'en' }, { state: 'settings' }, { state: 'understanding', lang: 'en' }]) {
    const c = await open({ ...s, w: 320, h: 568 }); out.push({ s: s.state + '/' + (s.lang || 'ar'), ...(await E(c, CLIP)) });
  }
  return ok(out.every((m) => !m.bad.length), out);
});
def('C-A5', 'accessibility', 'Large text does not clip Arabic: every Arabic registered string keeps line-height ≥ 1.6 and fits its box; the Voice Note and call line keep their controls ≥ 44 pt.', async () => {
  const out = [];
  for (const s of [{ state: 'conv', q: { vn: 'paused', ts: 'large' } }, { state: 'notif', q: { sec: 'proactive', ts: 'large' } }, { state: 'publicid', q: { ts: 'large' } }, { state: 'understanding', q: { ts: 'large' } }, { state: 'record', q: { ts: 'large' } }, { state: 'call-conv', w: 320, h: 568, q: { ts: 'large' } }, { state: 'conv', w: 320, h: 568, q: { vn: 'paused', ts: 'large' } }]) {
    const c = await open(s);
    out.push({ s: s.state, ...(await E(c, `(()=>{const bad=[];for(const e of document.querySelectorAll('#phone [data-k]')){if(!C3.visible(e))continue;const cs=getComputedStyle(e);const lh=parseFloat(cs.lineHeight)/parseFloat(cs.fontSize);if(/[\\u0600-\\u06FF]/.test(e.textContent)&&lh<1.595)bad.push('lh '+e.dataset.k+' '+lh.toFixed(2));if(e.scrollHeight>e.clientHeight+1&&cs.overflow!=='visible')bad.push('clip '+e.dataset.k)}
      const small=C3.controls().filter(x=>x.w<43.5||x.h<43.5).map(x=>x.id);return {bad,small}})()`)) });
  }
  return ok(out.every((m) => !m.bad.length && !m.small.length), out);
});
const LUM = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = LUM(a), y = LUM(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const CONTRAST = `(()=>{const px=(s)=>{const m=s.match(/rgba?\\(([^)]+)\\)/);if(!m)return null;const p=m[1].split(',').map(Number);return p.length===4&&p[3]===0?null:p.slice(0,3)};
  const bgOf=(e)=>{for(let p=e;p;p=p.parentElement){const b=px(getComputedStyle(p).backgroundColor);if(b)return b}return px(getComputedStyle(document.getElementById('phone')).backgroundColor)};
  return [...document.querySelectorAll('#ui *')].filter(e=>C3.visible(e)&&!e.children.length&&e.textContent.trim()&&!e.closest('.status,.handoff,.sr')).map(e=>{const cs=getComputedStyle(e);return {t:e.textContent.trim().slice(0,24),k:e.dataset.k||'',fg:px(cs.color),bg:bgOf(e),size:parseFloat(cs.fontSize),weight:+cs.fontWeight}})})()`;
def('C-A6', 'accessibility', 'Increased Contrast stays legible: every visible text of ours meets 4.5:1 (3:1 for large text) against its actual ground, in Dark and Light, Conversation / call / Settings.', async () => {
  const out = [];
  for (const s of [{ state: 'conv', contrast: true, q: { vn: 'paused' } }, { state: 'conv', lang: 'en', appearance: 'light', contrast: true, q: { vn: 'paused' } }, { state: 'call-conv', contrast: true }, { state: 'notif', lang: 'en', appearance: 'light', contrast: true, q: { sec: 'proactive' } }, { state: 'publicid', contrast: true }]) {
    const c = await open(s); const t = await E(c, CONTRAST);
    const low = t.filter((x) => x.fg && x.bg).map((x) => ({ ...x, r: +ratio(x.fg, x.bg).toFixed(2) })).filter((x) => x.r < ((x.size >= 18.66 || (x.size >= 14 && x.weight >= 700)) ? 3 : 4.5));
    out.push({ s: s.state + '/' + (s.appearance || 'dark'), n: t.length, low: low.map((x) => `${x.k || x.t} ${x.r}`) });
  }
  return ok(out.every((m) => !m.low.length), out);
});
def('C-A6s', 'accessibility', 'Standard contrast (informational baseline for C-A6): the same measurement without Increased Contrast. Values below 4.5:1 here belong to frozen tokens, not to P4-C3, and are reported, never "fixed" by a new colour.', async () => {
  const out = [];
  for (const s of [{ state: 'conv', q: { vn: 'paused' } }, { state: 'conv', lang: 'en', appearance: 'light', q: { vn: 'paused' } }, { state: 'notif', lang: 'en', appearance: 'light', q: { sec: 'proactive' } }]) {
    const c = await open(s); const t = await E(c, CONTRAST);
    const min = t.filter((x) => x.fg && x.bg).map((x) => ({ k: x.k || x.t, r: +ratio(x.fg, x.bg).toFixed(2) })).sort((a, b) => a.r - b.r).slice(0, 3);
    out.push({ s: s.state + '/' + (s.appearance || 'dark'), lowest: min });
  }
  return ok(true, out);
});
def('C-A7', 'accessibility', 'Reduced Motion removes movement, never meaning: the same words, names, controls and still pixels with and without it; every transition of ours is 0 ms under it.', async () => {
  const out = [];
  for (const s of [{ state: 'conv', q: { vn: 'paused' } }, { state: 'record', lang: 'en' }, { state: 'call-conv' }]) {
    const a = await open(s); const A1 = await E(a, `JSON.stringify([C3.texts().map(t=>t.k+t.text),C3.names(),C3.controls().map(c=>c.name)])`); const pa = await a.shot({ x: 0, y: 0, width: 390, height: 844, scale: 1 });
    const b = await open({ ...s, reducedMotion: true }); const B1 = await E(b, `JSON.stringify([C3.texts().map(t=>t.k+t.text),C3.names(),C3.controls().map(c=>c.name)])`); const pb = await b.shot({ x: 0, y: 0, width: 390, height: 844, scale: 1 });
    const dur = await E(b, `[...document.querySelectorAll('#ui *')].map(e=>getComputedStyle(e).transitionDuration).filter(d=>d.split(',').some(x=>parseFloat(x)>0)).length`);
    out.push({ s: s.state, sameMeaning: A1 === B1, samePixels: sha(pa) === sha(pb), nonzeroTransitions: dur });
  }
  return ok(out.every((m) => m.sameMeaning && m.samePixels && !m.nonzeroTransitions), out);
});
def('C-A8', 'accessibility', 'Keyboard focus is visible (E1R perimeter) and never hidden: on the Voice Note control, the call controls and the warning\'s choices.', async () => {
  const out = [];
  for (const [s, sel] of [[{ state: 'conv', q: { vn: 'paused' } }, '.vn .vplay'], [{ state: 'call-conv' }, '#c-mute'], [{ state: 'call-conv', lang: 'en' }, '#c-end'], [{ state: 'publicid', lang: 'en' }, '#pid-keep']]) {
    const c = await open(s); const { kbdFocus } = await import('./lib/session.mjs'); await kbdFocus(c, sel); await sleep(60);
    out.push({ sel, ...(await E(c, `(()=>{const a=document.activeElement;const r=a.getBoundingClientRect();const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {ring:getComputedStyle(a).boxShadow!=='none',visible:a.contains(top)||top===a}})()`)) });
  }
  return ok(out.every((m) => m.ring && m.visible), out);
});

// ---------------------------------------------------------------------------------------------------- LAUNCH
def('C-L1', 'launch', 'iOS launch screen follows Apple guidance: one solid World colour in the current appearance, no text, no logo, no branding, nothing runtime-dependent.', async (o) => {
  const out = [];
  for (const s of o ? [o] : [{ state: 'launch-ios' }, { state: 'launch-ios', appearance: 'light' }]) {
    const c = await open(s);
    out.push(await E(c, `(()=>{const l=document.querySelector('.launch');const kids=[...l.children].map(k=>k.className);const txt=[...l.querySelectorAll('*')].filter(e=>!e.closest('.status')&&e.textContent.trim()).length;const imgs=l.querySelectorAll('img,svg:not(.status svg)').length;
      const pts=[];for(let y=60;y<800;y+=37)for(let x=10;x<380;x+=41){const e=document.elementFromPoint(x,y);pts.push(e===l||e.id==='phone'||e.id==='view'||e.id==='ui')}return {kids,txt,imgs,solid:pts.every(Boolean),bg:getComputedStyle(l).backgroundColor,world:getComputedStyle(document.getElementById('phone')).getPropertyValue('--world').trim()}})()`));
  }
  return ok(out.every((m) => m.kids.join() === 'status' && !m.txt && !m.imgs && m.solid), out);
}, [{ defect: 'splashtext', o: { state: 'launch-ios' } }]);
def('C-L2', 'launch', 'The iOS launch screen is identical to the first app-owned frame (Apple: "nearly identical to the first screen"): the two captures are byte-identical in both appearances — no visual jump, no second splash.', async () => {
  const S = JSON.parse(readFileSync(join(PKG, 'data', 'SHOTS.json'), 'utf8')).shots; const by = Object.fromEntries(S.map((s) => [s.id, s]));
  const pairs = [['l-ios-d', 'h-ios-d'], ['l-ios-l', 'h-ios-l']].map(([a, b]) => ({ a, b, same: by[a] && by[b] && by[a].sha256 === by[b].sha256 }));
  return ok(pairs.every((p) => p.same), pairs);
});
def('C-L3', 'launch', 'Android 12+ SplashScreen: the approved I-08B2.5 adaptive icon (vendored bytes) in the 160 dp mask of the 240 dp icon box, centred, over a single opaque World colour; no animated icon, no branding image.', async (o) => {
  const out = [];
  for (const s of o ? [o] : [{ state: 'launch-android' }, { state: 'launch-android', appearance: 'light' }, { state: 'launch-android', w: 430, h: 932 }]) {
    const c = await open(s);
    out.push(await E(c, `(()=>{const l=document.querySelector('.launch'),m=l.querySelector('.mask'),b=l.querySelector('.asplash');const r=m.getBoundingClientRect(),q=b.getBoundingClientRect(),W=innerWidth,H=innerHeight;
      return {mask:[r.width,r.height],box:[q.width,q.height],round:getComputedStyle(m).borderRadius,centred:Math.abs(q.x+q.width/2-W/2)<0.6&&Math.abs(q.y+q.height/2-H/2)<0.6,src:l.querySelector('img').src===window.C3DATA.glyphs.iconFg,bg:getComputedStyle(l).backgroundColor,imgs:l.querySelectorAll('img').length,txt:[...l.querySelectorAll('*')].filter(e=>!e.closest('.status')&&e.textContent.trim()).length}})()`));
  }
  const fg = readFileSync(join(SOURCE, 'vendor', 'brand', 'android', 'ic_launcher_foreground.xxxhdpi.png'));
  const prov = JSON.parse(readFileSync(join(SOURCE, 'PROVENANCE.json'), 'utf8')).files['vendor/brand/android/ic_launcher_foreground.xxxhdpi.png'];
  return ok(out.every((m) => m.mask[0] === 160 && m.mask[1] === 160 && m.box[0] === 240 && m.round === '50%' && m.centred && m.src && m.imgs === 1 && !m.txt && /^rgb\(/.test(m.bg)) && sha(fg) === prov.sha256, { out, iconSha: sha(fg).slice(0, 12) });
});
def('C-L4', 'launch', 'Android handoff is truthful: the first app-owned frame keeps the splash\'s exact background colour and removes the system icon — no second custom splash.', async () => {
  const out = [];
  for (const ap of ['dark', 'light']) {
    const a = await open({ state: 'launch-android', appearance: ap }), b = await open({ state: 'handoff-android', appearance: ap });
    const x = await E(a, `getComputedStyle(document.querySelector('.launch')).backgroundColor`);
    const y = await E(b, `(()=>{const l=document.querySelector('.launch');return {bg:getComputedStyle(l).backgroundColor,kids:[...l.children].map(k=>k.className).join(),owner:l.dataset.owner}})()`);
    out.push({ ap, splash: x, app: y });
  }
  return ok(out.every((m) => m.splash === m.app.bg && m.app.kids === 'status' && m.app.owner === 'app'), out);
});
def('C-L5', 'launch', 'No fake delay: no minimum-duration or keep-on-screen hold is declared anywhere; the launch code path contains no timer.', async (o) => {
  const c = await open(o || { state: 'launch-android' });
  const attr = await E(c, `document.querySelector('.launch').getAttribute('data-min-duration-ms')`);
  const app = readFileSync(join(SOURCE, 'src', 'app.js'), 'utf8');
  const launchFn = app.slice(app.indexOf('function launchHTML'), app.indexOf('// ----', app.indexOf('function launchHTML')));
  return ok(!attr && !/setTimeout|setInterval|keepOnScreen|minDuration/.test(launchFn), { attr, launchTimer: /setTimeout|setInterval/.test(launchFn) });
}, [{ defect: 'fakedelay', o: { state: 'launch-android' } }]);
def('C-L6', 'launch', 'The standalone lantern task owns everything after the boundary: the first app-owned frame is deliberately empty — ground and system status only, no lantern, no Q, no substitute composition.', async (o) => {
  const out = [];
  for (const s of o ? [o] : [{ state: 'handoff-ios' }, { state: 'handoff-android', appearance: 'light' }]) {
    const c = await open(s);
    out.push(await E(c, `(()=>{const l=document.getElementById('boundary');return {kids:[...l.children].map(k=>k.className).join(),lantern:l.querySelectorAll('[data-lantern]').length,marks:l.querySelectorAll('svg:not(.status svg),img,canvas').length}})()`));
  }
  return ok(out.every((m) => m.kids === 'status' && !m.lantern && !m.marks), out);
}, [{ defect: 'lanterncontent', o: { state: 'handoff-ios' } }]);

// ================================================================================================= RUN
const t0 = Date.now();
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1].split(',') : null; })();   // development only: never used by the pipeline
for (const ch of CHECKS.filter((x) => !ONLY || ONLY.includes(x.id))) {
  let r; try { r = await ch.run(); } catch (e) { r = ok(false, 'threw: ' + e.message); }
  results.push({ id: ch.id, family: ch.fam, claim: ch.claim, pass: r.pass, detail: r.detail });
  process.stdout.write(`${r.pass ? 'PASS' : 'FAIL'} ${ch.id}\n`);
  for (const d of ch.defects) {
    let p; try { p = await ch.run({ ...d.o, q: { ...(d.o.q || {}), defect: d.defect } }); } catch (e) { p = ok(false, 'threw: ' + e.message); }
    planted.push({ defect: d.defect, check: ch.id, rejected: !p.pass });
    process.stdout.write(`  planted ${d.defect}: ${!p.pass ? 'REJECTED' : 'NOT REJECTED'}\n`);
  }
}
await closeBrowser(); await closeServers();
const summary = { normal: `${results.filter((r) => r.pass).length} / ${results.length}`, planted: `${planted.filter((p) => p.rejected).length} / ${planted.length} planted defects rejected`, seconds: Math.round((Date.now() - t0) / 1000), git: NOGIT ? 'skipped' : 'checked' };
writeFileSync(OUT, JSON.stringify({ note: 'P4-C3 acceptance checks (task §10). Browser evidence only; VoiceOver / TalkBack, Dynamic Type, device contrast and native launch behaviour are device gates.', summary, checks: results, planted }, null, 1) + '\n');
if (!process.argv.includes('--out')) {
  const a11y = results.filter((r) => r.family === 'accessibility' || ['C-V10', 'C-V6'].includes(r.id));
  writeFileSync(join(PKG, 'data', 'A11Y.json'), JSON.stringify({ note: 'Accessibility evidence (browser only): names, targets, colour independence, 320 × 568, large text, contrast, Reduced Motion, focus. Device gates (VoiceOver / TalkBack, Dynamic Type, OS Increase Contrast / Reduce Motion, 48 dp on Android hardware) remain open.',
    platform: { ios: '44 × 44 pt default (Apple HIG Accessibility)', android: '48 × 48 dp (Android Developers — accessibility)', qandeel: '44 pt (P2 §10, P3 §16) — frozen; Android 48 dp is an implementation note (finding F-05)' },
    planted: planted.filter((p) => a11y.some((r) => r.id === p.check)), checks: a11y }, null, 1) + '\n');
}
console.log(summary);
if (results.some((r) => !r.pass) || planted.some((p) => !p.rejected)) process.exitCode = 1;
