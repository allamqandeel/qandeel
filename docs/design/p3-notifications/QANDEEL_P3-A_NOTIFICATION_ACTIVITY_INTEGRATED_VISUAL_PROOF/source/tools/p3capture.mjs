// P3-A — captures every Product phone the boards use (real prototype states at 2×, no harness), records each one's
// element geometry for cropping, and renders the motion clips frame by frame on the page's virtual clock.
//
//   node source/tools/p3capture.mjs [shots|clips|all]      (default all)
// Output: WORK/shots/*.png + data/SHOTS.json; motion/*.mp4 + data/motion/*.json; captures/ (the key phones, copied).
import { writeFileSync, mkdirSync, readFileSync, copyFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { openState, shotPhone, kbdFocus, closeBrowser, closeServers, WORK, PKG } from './lib/session.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const SHOTS = join(WORK, 'shots');
const RECT_SEL = ['.hdr', '#act-entry', '#act-entry .amark', '.strip', '.filters', '.fchip', '.row', '.composer', '#rail', '.sheet', '.osbox', '.set h2', '.srow', '.seg', '.optrow', '.world-name', '.toastline', '.osoff'];

// ------------------------------------------------------------------------------------------------ the shot list
const V = { ad: { lang: 'ar', appearance: 'dark' }, al: { lang: 'ar', appearance: 'light' }, ed: { lang: 'en', appearance: 'dark' }, el: { lang: 'en', appearance: 'light' } };
const S = [];
const add = (name, o) => S.push({ name, ...o });
for (const [k, v] of Object.entries(V)) {
  add(`act-${k}`, { state: 'activity', ...v });
  add(`conv-${k}`, { state: 'conv', ...v });
  add(`conv-rest-${k}`, { state: 'conv', q: { mark: '0' }, ...v });
  add(`edu-${k}`, { state: 'edu', ...v });
  add(`strip-shared-${k}`, { state: 'conv-strip-shared', ...v });
}
for (const f of ['all', 'qandeel', 'shared', 'public', 'intro', 'system']) add(`filter-${f}-ad`, { state: 'activity', q: { filter: f }, ...V.ad });
add('filter-intro-el', { state: 'activity', q: { filter: 'intro' }, ...V.el });
add('act-after-dwell-ad', { state: 'activity', ...V.ad, steps: [{ tick: 2600 }] });
add('act-after-dwell-el', { state: 'activity', ...V.el, steps: [{ tick: 2600 }] });
add('conv-after-visit-ad', { state: 'activity', ...V.ad, steps: [{ tick: 2600 }, { eval: 'P3.back()' }, { tick: 400 }] });
add('act-stale-ad', { state: 'activity-stale', ...V.ad });
add('act-stale-el', { state: 'activity-stale', ...V.el });
add('act-opened-ad', { state: 'activity', ...V.ad, steps: [{ tick: 2600 }, { eval: `document.querySelector('.row[data-id="F2"] .go').click()` }, { tick: 600 }, { eval: 'P3.back()' }, { tick: 400 }] });
add('entry-press-ad', { state: 'conv', q: { press: 'entry' }, ...V.ad });
add('entry-press-el', { state: 'conv', q: { press: 'entry' }, ...V.el });
add('entry-focus-ad', { state: 'conv', ...V.ad, focus: '#act-entry' });
add('entry-focus-el', { state: 'conv', ...V.el, focus: '#act-entry' });
add('entry-more-ad', { state: 'conv', ...V.ad, contrast: true });
add('entry-more-al', { state: 'conv', ...V.al, contrast: true });
add('act-more-ad', { state: 'activity', ...V.ad, contrast: true });
add('act-more-el', { state: 'activity', ...V.el, contrast: true });
add('bell-ad', { state: 'conv', q: { entry: 'bell' }, ...V.ad });
add('bell-el', { state: 'conv', q: { entry: 'bell' }, ...V.el });
add('bell-rest-ad', { state: 'conv', q: { entry: 'bell', mark: '0' }, ...V.ad });
add('strip-qandeel-ad', { state: 'shared-strip-qandeel', ...V.ad });
add('strip-qandeel-el', { state: 'shared-strip-qandeel', ...V.el });
add('strip-system-ad', { state: 'conv-strip-system', ...V.ad });
add('strip-system-el', { state: 'conv-strip-system', ...V.el });
add('inplace-ad', { state: 'shared-inplace', ...V.ad });
add('inplace-el', { state: 'shared-inplace', ...V.el });
add('call-ad', { state: 'conv-call', ...V.ad });
add('call-el', { state: 'conv-call', ...V.el });
add('call-ended-ad', { state: 'conv-call', ...V.ad, steps: [{ eval: 'P3.endCall()' }, { tick: 1400 }] });
add('call-ended-el', { state: 'conv-call', ...V.el, steps: [{ eval: 'P3.endCall()' }, { tick: 1400 }] });
add('strip-focus-ad', { state: 'conv-strip-shared', ...V.ad, focus: '.strip .x' });
add('chip-focus-el', { state: 'activity', ...V.el, focus: '.fchip[data-filter="shared"]' });
add('settings-root-ad', { state: 'settings-root', ...V.ad });
add('settings-root-el', { state: 'settings-root', ...V.el });
add('notif-ad', { state: 'notif', ...V.ad, h: 1960 });
add('notif-el', { state: 'notif', ...V.el, h: 1960 });
add('notif-al', { state: 'notif', ...V.al, h: 1960 });
add('notif-noentry-ad', { state: 'notif', q: { intro: '0' }, ...V.ad, h: 1960 });
add('notif-denied-ad', { state: 'notif', q: { os: 'denied' }, ...V.ad });
add('notif-denied-el', { state: 'notif', q: { os: 'denied' }, ...V.el });
add('notif-lock-ad', { state: 'notif-lock', ...V.ad });
add('notif-lock-el', { state: 'notif-lock', ...V.el });
add('notif-lock-shared-ad', { state: 'notif-lock', q: { subject: 'shared' }, ...V.ad });
add('switch-focus-ad', { state: 'notif', ...V.ad, focus: '[data-sw="shared"]' });
add('edu-boundary-ad', { state: 'edu-boundary', ...V.ad });
add('edu-boundary-el', { state: 'edu-boundary', ...V.el });
add('edu-notnow-ad', { state: 'edu-notnow', ...V.ad });
add('edu-notnow-el', { state: 'edu-notnow', ...V.el });
// 320 × 568 stress (Arabic, Dark) and 430 × 932
for (const [st, extra] of [['activity', {}], ['conv-strip-shared', {}], ['conv-strip-system', {}], ['notif', {}], ['edu', {}], ['conv-call', {}], ['notif-lock', {}]]) add(`s320-${st}`, { state: st, ...V.ad, w: 320, h: 568, ...extra });
add('s320-notif-tall', { state: 'notif', ...V.ad, w: 320, h: 2240 });
for (const v of ['ad', 'el']) { add(`w430-act-${v}`, { state: 'activity', ...V[v], w: 430, h: 932 }); add(`w430-strip-${v}`, { state: 'conv-strip-shared', ...V[v], w: 430, h: 932 }); add(`w430-notif-${v}`, { state: 'notif', ...V[v], w: 430, h: 932 }); }
add('w430-act-ed', { state: 'activity', ...V.ed, w: 430, h: 932 });
add('system-appearance-light', { state: 'activity', lang: 'ar', appearance: 'system', scheme: 'light' });
add('system-appearance-dark', { state: 'activity', lang: 'ar', appearance: 'system', scheme: 'dark' });

async function runSteps(c, steps = []) {
  for (const s of steps) {
    if (s.tick) await c.eval(`P3.tick(${s.tick})`);
    if (s.eval) await c.eval(s.eval);
  }
}
export async function shots(only = null) {
  mkdirSync(SHOTS, { recursive: true });
  const meta = {};
  for (const s of S) {
    if (only && !only.includes(s.name)) continue;
    const c = await openState({ state: s.state, lang: s.lang, appearance: s.appearance, rm: !!s.rm, contrast: !!s.contrast, w: s.w || 390, h: s.h || 844, q: s.q || {}, scheme: s.scheme || null });
    await runSteps(c, s.steps);
    if (s.focus) { await kbdFocus(c, s.focus); await c.eval('P3.tick(50)'); }
    const png = await shotPhone(c);
    writeFileSync(join(SHOTS, `${s.name}.png`), png);
    const rects = {};
    for (const sel of RECT_SEL) { const r = await c.eval(`P3.rects(${JSON.stringify(sel)})`); if (r.length) rects[sel] = r; }
    const probe = await c.eval(`(()=>{const ph=document.getElementById('phone');const m=document.querySelector('#act-entry .amark');const pg=document.querySelector('.page');return {appearance:ph.dataset.appearance,dir:ph.dir,place:ph.dataset.place,markBg:m?getComputedStyle(m).backgroundColor:null,pageBg:pg?getComputedStyle(pg).backgroundColor:getComputedStyle(ph).backgroundColor,sw:document.documentElement.scrollWidth,iw:innerWidth,strip:!!document.querySelector('.strip'),a11y:document.getElementById('a11y').textContent}})()`);
    if (probe.sw > probe.iw) throw new Error(`${s.name}: horizontal overflow ${probe.sw} > ${probe.iw}`);
    meta[s.name] = { ...s, file: `shots/${s.name}.png`, bytes: png.length, sha256: sha(png), rects, probe };
    process.stdout.write('.');
  }
  const path = join(PKG, 'data', 'SHOTS.json');
  mkdirSync(join(PKG, 'data'), { recursive: true });
  const prev = only && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  writeFileSync(path, JSON.stringify({ ...prev, ...meta }, null, 1));
  console.log(`\n${Object.keys(meta).length} shots`);
}

// ------------------------------------------------------------------------------------------------ clips
const FFMPEG = join(process.env.LOCALAPPDATA || '', 'CapCut', 'Apps', '9.2.0.3931', 'ffmpeg.exe');
const FPS = 30, DT = 1000 / FPS;
/** frames: an array of { at (ms), eval } actions + total duration. */
const CLIPS = [
  { id: 'M01-attention-mark-present', note: 'during a Live Call an eligible Shared event is deferred: the Activity mark becomes present, no strip, the call is untouched', state: 'conv-call', q: { arrive: '0', mark: '0' }, ...V.ad, dur: 3000, acts: [{ at: 900, eval: `P3.arrive('sharedReply')` }] },
  { id: 'M01r-attention-mark-present-reduced-motion', state: 'conv-call', q: { arrive: '0', mark: '0' }, ...V.ad, rm: true, dur: 3000, acts: [{ at: 900, eval: `P3.arrive('sharedReply')` }] },
  { id: 'M02-strip-appear-hold-dismiss', note: 'a Shared reply while the user is in the Personal Conversation: appear, readable hold (6 s, no countdown), dismiss by itself', state: 'conv', ...V.ad, dur: 7800, acts: [{ at: 500, eval: `P3.arrive('sharedReply')` }] },
  { id: 'M03-strip-direct-entry', note: 'the strip is pressed: it leaves and the Shared World opens (Direct Entry, the originating context)', state: 'conv', ...V.ad, dur: 3600, acts: [{ at: 400, eval: `P3.arrive('sharedReply')` }, { at: 1900, eval: 'P3.enterFirst()' }] },
  { id: 'M04-strip-reduced-motion', note: 'M02 under Reduced Motion: the same appear / hold / dismiss as opacity only, no travel', state: 'conv', ...V.ad, rm: true, dur: 7800, acts: [{ at: 500, eval: `P3.arrive('sharedReply')` }] },
  { id: 'M05-permission-education-to-platform', note: 'first entry into a Shared experience: QANDEEL explains, then hands over to the platform-owned prompt (not drawn)', state: 'shared', ...V.ad, dur: 5200, acts: [{ at: 500, eval: `P3.eduFor('shared-first-entry')` }, { at: 3300, eval: 'P3.eduAllow()' }] },
  { id: 'M05r-permission-education-reduced-motion', state: 'shared', ...V.ad, rm: true, dur: 5200, acts: [{ at: 500, eval: `P3.eduFor('shared-first-entry')` }, { at: 3300, eval: 'P3.eduAllow()' }] },
  { id: 'M07-seen-opened-not-resolved', note: 'rows seen on screen lose the NEW mark; the actionable items keep the WAITING mark; opening a row changes attention only', state: 'activity', ...V.ad, dur: 5600,
    acts: [{ at: 2600, eval: `document.querySelector('.row[data-id="F2"] .go').click()` }, { at: 3800, eval: 'P3.back()' }] },
  { id: 'M07r-seen-opened-reduced-motion', state: 'activity', ...V.ad, rm: true, dur: 5600,
    acts: [{ at: 2600, eval: `document.querySelector('.row[data-id="F2"] .go').click()` }, { at: 3800, eval: 'P3.back()' }] },
];
function encode(dir, out) {
  const r = spawnSync(FFMPEG, ['-y', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'), '-c:v', 'h264_mf', '-b:v', '8M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { encoding: 'utf8' });
  if (!existsSync(out)) throw new Error('ffmpeg produced nothing: ' + (r.stderr || '').slice(-600));
  const n = spawnSync(FFMPEG, ['-i', out, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = [...((n.stdout || '') + (n.stderr || '')).matchAll(/frame=\s*(\d+)/g)].pop();
  return m ? +m[1] : -1;
}
export async function clips(only = null) {
  if (!existsSync(FFMPEG)) throw new Error('no ffmpeg at ' + FFMPEG);
  mkdirSync(join(PKG, 'motion'), { recursive: true }); mkdirSync(join(PKG, 'data', 'motion'), { recursive: true });
  for (const k of CLIPS) {
    if (only && !only.includes(k.id)) continue;
    const dir = join(WORK, 'frames', k.id); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    const c = await openState({ state: k.state, lang: k.lang, appearance: k.appearance, rm: !!k.rm, q: k.q || {} });
    // start the clip from a settled page (entrances done): the virtual clock is read, not reset
    const t0 = await c.eval('P3.T()');
    const acts = [...k.acts].sort((a, b) => a.at - b.at); const truth = [];
    const nF = Math.round(k.dur / DT);
    for (let i = 0; i < nF; i++) {
      const tRel = i * DT;
      while (acts.length && acts[0].at <= tRel) { await c.eval(acts.shift().eval); }
      const st = await c.eval(`(()=>{const s=document.querySelector('.strip'),m=document.querySelector('#act-entry .amark'),sh=document.querySelector('.sheet'),o=document.querySelector('.osbox');const g=(e)=>e?{o:getComputedStyle(e).opacity,t:e.style.transform||''}:null;return {vt:P3.T(),place:document.getElementById('phone').dataset.place,strip:g(s),mark:g(m),sheet:g(sh),osbox:g(o),marks:document.querySelectorAll('.row .amark').length,rings:document.querySelectorAll('.row .amark.ring').length}})()`);
      truth.push({ i, t: Math.round(tRel), ...st });
      writeFileSync(join(dir, `f${String(i).padStart(4, '0')}.png`), await shotPhone(c));
      await c.eval(`P3.tick(${DT})`);
    }
    const out = join(PKG, 'motion', `${k.id}.mp4`);
    const frames = encode(dir, out);
    writeFileSync(join(PKG, 'data', 'motion', `${k.id}.json`), JSON.stringify({ id: k.id, note: k.note || null, state: k.state, lang: k.lang, appearance: k.appearance, rm: !!k.rm, fps: FPS, durMs: k.dur, framesWritten: nF, framesDecoded: frames, startT: t0, acts: k.acts, truth }, null, 0));
    console.log(k.id, nF, 'frames →', frames, 'decoded');
  }
}
export const SHOT_LIST = S, CLIP_LIST = CLIPS;

if (process.argv[1] && process.argv[1].endsWith('p3capture.mjs')) {
  const what = process.argv[2] || 'all', only = process.argv[3] ? process.argv[3].split(',') : null;
  if (what === 'shots' || what === 'all') await shots(only);
  if (what === 'clips' || what === 'all') await clips(only);
  // the key phones are carried in the package as full captures (all of them are composed into the boards)
  const KEY = ['act-ad', 'act-el', 'conv-ad', 'strip-shared-ad', 'strip-qandeel-ad', 'strip-system-ad', 'inplace-ad', 'call-ad', 'call-ended-ad', 'notif-ad', 'notif-el', 'edu-ad', 'edu-el', 'edu-boundary-ad', 's320-activity', 'w430-act-el'];
  mkdirSync(join(PKG, 'captures'), { recursive: true });
  for (const f of readdirSync(join(PKG, 'captures'))) rmSync(join(PKG, 'captures', f));
  for (const k of KEY) if (existsSync(join(SHOTS, `${k}.png`))) copyFileSync(join(SHOTS, `${k}.png`), join(PKG, 'captures', `${k}.png`));
  await closeBrowser(); await closeServers();
}
