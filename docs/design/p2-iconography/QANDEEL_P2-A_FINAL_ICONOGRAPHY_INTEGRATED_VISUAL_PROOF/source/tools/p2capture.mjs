// P2-A — every Product capture and motion clip of the proof, from the built prototype, in headless Chrome.
//   node tools/p2capture.mjs shots   → <WORK>/shots/<id>.png + data/SHOTS.json (the truth and the measured geometry per shot)
//   node tools/p2capture.mjs clips   → motion/<clip>.mp4 + data/motion/<clip>.truth.json
// Captures use the page's virtual clock (?capture=1): every frame is a pure function of the state and the time. The
// scrub is REAL pointer input (CDP mouse events on the Track), never a scripted state jump.
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openPage, closeServers, settle, WORK, PKG, key } from './lib/session.mjs';

const mode = process.argv[2] || 'shots';
const only = process.argv[3] ? process.argv[3].split(',') : null;
export const FFMPEG = process.env.P2_FFMPEG || join(process.env.LOCALAPPDATA || '', 'CapCut', 'Apps', '9.2.0.3931', 'ffmpeg.exe');
const SHOTS_DIR = join(WORK, 'shots'); mkdirSync(SHOTS_DIR, { recursive: true });

// ---------------------------------------------------------------------------------------------- page helpers
const G = (c, x) => c.eval(x);
const act = (c, a, arg = null) => G(c, `(window.__G32.act(${JSON.stringify(a)}, ${JSON.stringify(arg)}), true)`);
const clock = (c, t) => G(c, `window.__G32.clock(${t})`);
/** The Track's rectangle and the physical x of a Session Position (the page's own geometry). */
const trackGeo = (c) => G(c, `(()=>{const r=document.getElementById('tl-track').getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height}})()`);
const mouse = (c, type, x, y) => c.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: type === 'mouseMoved' ? 0 : 1, pointerType: 'mouse' });
/** Measured facts a board or a check needs, read from the page. */
const MEASURE = `(()=>{const P=document.getElementById('phone').getBoundingClientRect();const box=(e)=>{if(!e)return null;const b=e.getBoundingClientRect();return {x:+(b.left-P.left).toFixed(2),y:+(b.top-P.top).toFixed(2),w:+b.width.toFixed(2),h:+b.height.toFixed(2)}};
 const t=window.__G32.truth();const ids=['tl-track','tl-live','mute','route','end-call','call','door','back','replay','spine','timeline','composer','rail','tl-ctx'];const o={};ids.forEach(i=>o[i]=box(document.getElementById(i)));
 o.rail_items=[...document.querySelectorAll('#rail .it')].map(box);o.rail_icons=[...document.querySelectorAll('#rail .ic')].map(box);o.returns=[...document.querySelectorAll('#band [data-act], #band #more-t')].map(box);
 const sp=document.getElementById('spine');o.notches=sp?[...sp.querySelectorAll('path')].length:0;
 const tk=document.getElementById('tl-track').getBoundingClientRect();o.sps=[];for(let i=1;i<=t.LH;i++){const x=window.__P2.spX(i);if(x<0||x>tk.width)continue;const X=tk.left+x,Y=tk.top+tk.height/2;const at=document.elementFromPoint(X,Y);o.sps.push({sp:i,x:+(tk.left-P.left+x).toFixed(3),hitsTrack:!!at&&(at.id==='tl-track'||!!at.closest('#tl-track')),at:at&&(at.id||at.className&&String(at.className.baseVal??at.className)||at.tagName)});}
 const te=document.querySelector('#tl-live .term');o.term=box(te);o.probe=window.__P2.probe();
 return {truth:{state:t.state,lang:t.lang,place:t.place,TM:t.TM,TC:t.TC,PTC:t.PTC,LH:t.LH,call:t.call,muted:t.muted,appearance:t.appearance,analysisShellDark:t.analysisShellDark,reducedMotion:t.reducedMotion,ctxLines:t.ctxLines,rendered:t.rendered,controls:t.controls,room:t.room,callA11y:t.callA11y,rail:document.getElementById('phone').getAttribute('data-rail'),spine:document.getElementById('phone').getAttribute('data-spine')},boxes:o,
  focusOrder:[...document.querySelectorAll('#phone button, #phone [tabindex="0"], #phone input')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('[hidden]')).map(e=>({id:e.id||e.getAttribute('data-act')||e.getAttribute('data-world')||e.className,name:e.getAttribute('aria-label')||e.textContent.trim().slice(0,40),box:box(e)})),
  world:(()=>{const u=t.room;return u})()}})()`;

// ---------------------------------------------------------------------------------------------- the shots
// Each shot: a start state, optional acts, optional real-input script, and the device stand-ins.
const V = (rail, spine) => `&rail=${rail}&spine=${spine}`;
const R = V('A', 'C');                       // the recommended pair
export const SHOTS = [];
const add = (id, o) => SHOTS.push({ id, lang: 'ar', w: 390, h: 844, scheme: 'dark', rm: false, q: R, ...o });
// Call Rail — the three variants, same states
for (const v of ['A', 'B', 'C']) {
  add(`rail${v}-call-live-ar`, { state: 'CALL_ANALYSIS', q: V(v, 'C') });
  add(`rail${v}-call-pinned-ar`, { state: 'CALL_PINNED', q: V(v, 'C') });
  add(`rail${v}-conv-call-ar`, { state: 'CALL_CONV', q: V(v, 'C') });
}
// Temporal Spine — the three variants, the temporal states
for (const v of ['A', 'B', 'C']) {
  add(`spine${v}-follow`, { state: 'P2_LIVE17', q: V('A', v) });
  add(`spine${v}-pinned14`, { state: 'P4', q: V('A', v) });
  add(`spine${v}-pinnedLH`, { state: 'P2_LIVE17', acts: [['previewAt', 17], ['commitPreview']], q: V('A', v) });
  add(`spine${v}-preview`, { state: 'P4', script: 'scrubHold', sp: 16, q: V('A', v) });
}
// The recommended pair, every temporal state (T-06 / T-07 / G3 amendment)
add('rec-follow', { state: 'P2_LIVE17' });
add('rec-pinned14', { state: 'P4' });
add('rec-pinnedLH', { state: 'P2_LIVE17', acts: [['previewAt', 17], ['commitPreview']] });
add('rec-scrub', { state: 'P4', script: 'scrubHold', sp: 16 });
add('rec-commit', { state: 'P4', script: 'scrubRelease', sp: 16 });
add('rec-cancel', { state: 'P4', script: 'keyCancel' });
add('rec-returnlive', { state: 'P4', acts: [['RETURN_LIVE_HEAD']] });
add('rec-call-pinned', { state: 'CALL_PINNED' });
add('rec-call-live', { state: 'CALL_ANALYSIS' });
add('rec-conv-call', { state: 'CALL_CONV' });
add('rec-muted', { state: 'CALL_ANALYSIS', acts: [['mute'], ['route']] });
// English LTR
for (const s of [['en-call-pinned', 'CALL_PINNED'], ['en-call-live', 'CALL_ANALYSIS'], ['en-conv-call', 'CALL_CONV'], ['en-follow', 'P2_LIVE17']]) add(s[0], { state: s[1], lang: 'en' });
add('en-scrub', { state: 'P4', lang: 'en', script: 'scrubHold', sp: 16 });
// Appearance: system Light
add('light-conv-call-ar', { state: 'CALL_CONV', scheme: 'light' });
add('light-analysis-call-ar', { state: 'CALL_ANALYSIS', scheme: 'light' });
add('light-conv-ar', { state: 'CONV', scheme: 'light' });
add('light-conv-call-en', { state: 'CALL_CONV', scheme: 'light', lang: 'en' });
add('dark-conv-ar', { state: 'CONV' });
// Sizes
add('s320-call-pinned-ar', { state: 'CALL_PINNED', w: 320, h: 568 });
add('s320-call-pinned-open-ar', { state: 'CALL_PINNED_OPEN', w: 320, h: 568 });
add('s320-call-pinned-en', { state: 'CALL_PINNED', w: 320, h: 568, lang: 'en' });
add('s320-scrub-ar', { state: 'CALL_PINNED', w: 320, h: 568, script: 'scrubHold', sp: 16 });
add('s320-conv-call-ar', { state: 'CALL_CONV', w: 320, h: 568 });
add('s430-call-pinned-ar', { state: 'CALL_PINNED', w: 430, h: 932 });
add('s430-follow-en', { state: 'P2_LIVE17', w: 430, h: 932, lang: 'en' });
// States (focus, pressed) and Reduced Motion
add('focus-mute-ar', { state: 'CALL_ANALYSIS', script: 'focus', sel: '#mute' });
add('focus-end-ar', { state: 'CALL_ANALYSIS', script: 'focus', sel: '#end-call' });
add('focus-track-ar', { state: 'P4', script: 'focus', sel: '#tl-track' });
add('focus-live-ar', { state: 'P4', script: 'focus', sel: '#tl-live' });
add('press-end-ar', { state: 'CALL_ANALYSIS', script: 'press', sel: '#end-call' });
add('press-mute-ar', { state: 'CALL_ANALYSIS', script: 'press', sel: '#mute' });
add('rm-call-pinned-ar', { state: 'CALL_PINNED', rm: true, q: R + '&rm=1' });
add('rm-scrub-ar', { state: 'P4', rm: true, q: R + '&rm=1', script: 'scrubHold', sp: 16 });
// Navigation family across states (for the material-invariance measurement)
add('nav-mine-ar', { state: 'CONV' });
add('nav-shared-ar', { state: 'M6_ENTERED' });
add('nav-mine-analysis-light', { state: 'P1', scheme: 'light' });
add('nav-mine-conv-light', { state: 'CONV', scheme: 'light' });
add('nav-focus-ar', { state: 'CONV', script: 'focus', sel: '#rail .it[data-world="shared"]' });
add('nav-press-ar', { state: 'CONV', script: 'press', sel: '#rail .it[data-world="public"]' });

/** Moves a real mouse onto the Track at Session Position `sp` (the page's own geometry), holding it. */
async function scrubTo(c, sp, { steps = 6, release = false, t0 = 0, dt = 33 } = {}) {
  const g = await trackGeo(c);
  const cur = await G(c, 'window.__G32.truth().TC');
  const pos = (s) => G(c, `window.__P2.spX(${s})`);
  const x0 = g.x + await pos(cur), x1 = g.x + await pos(sp), y = g.y + g.h / 2;
  let t = t0;
  await clock(c, t); await mouse(c, 'mousePressed', x0, y);
  for (let i = 1; i <= steps; i++) { t += dt; await clock(c, t); await mouse(c, 'mouseMoved', x0 + (x1 - x0) * i / steps, y); }
  if (release) { t += dt; await clock(c, t); await mouse(c, 'mouseReleased', x1, y); }
  return { x0, x1, y, t };
}

async function runScript(c, s) {
  if (!s.script) return null;
  if (s.script === 'scrubHold') { const r = await scrubTo(c, s.sp, { t0: 1000 }); await clock(c, r.t + 400); return r; }
  if (s.script === 'scrubRelease') { const r = await scrubTo(c, s.sp, { t0: 1000, release: true }); await clock(c, r.t + 600); return r; }
  if (s.script === 'keyCancel') {
    await clock(c, 1000); await G(c, `document.getElementById('tl-track').focus({focusVisible:true})`);
    await key(c, 'ArrowLeft'); await clock(c, 1300); await key(c, 'Escape'); await clock(c, 1340); return { at: 'mid-cancel (40 ms of 240)' };
  }
  if (s.script === 'focus') { await clock(c, 1000); await G(c, `(document.querySelector(${JSON.stringify(s.sel)}).focus({focusVisible:true}),true)`); await clock(c, 1300); return null; }
  if (s.script === 'press') { await clock(c, 1000); await G(c, `window.__G32.press(${JSON.stringify(s.sel)}, true)`); await clock(c, 1300); return null; }
  return null;
}

async function runShots() {
  const out = {}; let port = 9531;
  const groups = {};
  for (const s of SHOTS) { if (only && !only.includes(s.id)) continue; const k = [s.lang, s.w, s.h, s.scheme, s.rm, s.q].join('|'); (groups[k] = groups[k] || []).push(s); }
  for (const list of Object.values(groups)) {
    const s0 = list[0];
    const c = await openPage({ lang: s0.lang, w: s0.w, h: s0.h, scheme: s0.scheme, rm: s0.rm, rmParam: false, q: s0.q, cdpPort: port++, httpPort: 8841 });
    for (const s of list) {
      await clock(c, 0);
      await G(c, `window.__G32.enter(${JSON.stringify(s.state)})`);
      for (const [a, arg] of s.acts || []) await act(c, a, arg ?? null);
      await clock(c, 900);
      const script = await runScript(c, s);
      if (!s.script) await clock(c, 1600);
      const png = await c.shot({ x: 0, y: 0, width: s.w, height: s.h, scale: 1 });
      writeFileSync(join(SHOTS_DIR, `${s.id}.png`), png);
      out[s.id] = { ...s, script, measured: await G(c, MEASURE) };
      if (s.script === 'scrubHold' || s.script === 'press') { await mouse(c, 'mouseReleased', 1, 1); await G(c, `window.__G32.press(${JSON.stringify(s.sel || '#x')}, false)`); }
      console.log('shot', s.id);
    }
    await c.close();
  }
  await closeServers();
  mkdirSync(join(PKG, 'data'), { recursive: true });
  const prev = (() => { try { return JSON.parse(readFileSync(join(PKG, 'data', 'SHOTS.json'), 'utf8')); } catch { return {}; } })();
  writeFileSync(join(PKG, 'data', 'SHOTS.json'), JSON.stringify({ ...prev, ...out }, null, 1));
}

// ---------------------------------------------------------------------------------------------- the clips
// Each clip: 30 fps, the phone's lower region (where the machines live) at 3×, or the whole phone.
const CROP = { y: 0.52 };      // the lower 48 % of the phone: world floor edge, temporal line, Timeline, chrome, call line, rail
export const CLIPS = {
  'M01-mic-mute-unmute': { state: 'CALL_ANALYSIS', dur: 2400, steps: [[500, 'mute'], [1500, 'mute']], what: 'Mic → Muted → Mic: the slash and its negative-space cut are drawn together (180 ms), then withdrawn' },
  'M02-route-toggle': { state: 'CALL_ANALYSIS', dur: 2400, steps: [[500, 'route'], [1500, 'route']], what: 'Speaker → earpiece → speaker: the body fills / empties and the outer wave draws / withdraws together (180 ms)' },
  'M03-press-mute-route-end': { state: 'CALL_ANALYSIS', dur: 3000, steps: [[400, 'press', '#mute'], [560, 'release', '#mute'], [1100, 'press', '#route'], [1260, 'release', '#route'], [1800, 'press', '#end-call'], [2000, 'release', '#end-call'], [2010, 'endCall']], what: 'Press response on the ground (E1R), then End Call: the rail leaves with the call' },
  'M04-scrub-commit': { state: 'P2_LIVE17', dur: 3200, steps: [[400, 'scrub', { from: 17, to: 14, off: 15, hold: 1200 }]], what: 'Real pointer scrub from the Live edge region to 14: the preview aperture is under the finger 1:1; release commits PINNED(14) and the aperture settles once' },
  'M05-preview-cancel': { state: 'P4', dur: 2200, steps: [[400, 'keyPreview', 'ArrowLeft'], [700, 'keyPreview', 'ArrowLeft'], [1200, 'keyCancel']], what: 'Keyboard preview two Moments forward, then Escape: the preview returns to the committed aperture (240 ms) and fades; nothing was committed' },
  'M06-return-live': { state: 'P4', dur: 2200, steps: [[500, 'RETURN_LIVE_HEAD']], what: 'Return Live: the aperture closes in place (140 ms) and the terminal engages (160 ms); nothing travels, nothing pulses' },
  'M07-new-moment-while-pinned': { state: 'CALL_PINNED', dur: 10200, steps: [], what: 'PINNED during a call: spoken turns commit Moments; new notches resolve in at the end, the aperture and the window do not move' },
  'M01r-mic-mute-unmute-reduced-motion': { state: 'CALL_ANALYSIS', rm: true, dur: 2400, steps: [[500, 'mute'], [1500, 'mute']], what: 'Reduced Motion: the same morph (drawing a line is kept: F1 "keep level, ink and draw")', counterpartOf: 'M01-mic-mute-unmute' },
  'M04r-scrub-commit-reduced-motion': { state: 'P2_LIVE17', rm: true, dur: 3200, steps: [[400, 'scrub', { from: 17, to: 14, off: 15, hold: 1200 }]], what: 'Reduced Motion: 1:1 under the finger is kept; the release retarget is 0 ms and the settle is skipped', counterpartOf: 'M04-scrub-commit' },
  'M06r-return-live-reduced-motion': { state: 'P4', rm: true, dur: 2200, steps: [[500, 'RETURN_LIVE_HEAD']], what: 'Reduced Motion: the aperture is cut; the terminal engages with the 140 ms opacity resolve', counterpartOf: 'M06-return-live' },
};
function ffmpeg(args) { const r = spawnSync(FFMPEG, args, { encoding: 'utf8', maxBuffer: 1 << 26 }); return (r.stdout || '') + (r.stderr || ''); }
async function runClips() {
  const md = join(PKG, 'motion'), td = join(PKG, 'data', 'motion'); mkdirSync(md, { recursive: true }); mkdirSync(td, { recursive: true });
  let port = 9581;
  for (const [name, cl] of Object.entries(CLIPS)) {
    if (only && !only.includes(name)) continue;
    const fd = join(WORK, 'frames', name); rmSync(fd, { recursive: true, force: true }); mkdirSync(fd, { recursive: true });
    const w = 390, h = 844, lang = cl.lang || 'ar';
    const c = await openPage({ lang, w, h, rm: !!cl.rm, rmParam: false, q: R + (cl.rm ? '&rm=1' : ''), cdpPort: port++, httpPort: 8843, dpr: 3 });
    await clock(c, 0); await G(c, `window.__G32.enter(${JSON.stringify(cl.state)})`); await clock(c, 0);
    const FPS = 30, n = Math.floor(cl.dur / 1000 * FPS) + 1, steps = cl.steps.slice(), log = [], frames = [];
    let scrub = null;
    const doStep = async ([t, a, arg]) => {
      await clock(c, t);
      if (a === 'press') await G(c, `window.__G32.press(${JSON.stringify(arg)}, true)`);
      else if (a === 'release') await G(c, `window.__G32.press(${JSON.stringify(arg)}, false)`);
      else if (a === 'keyPreview') { await G(c, `document.getElementById('tl-track').focus({focusVisible:true})`); await key(c, arg); }
      else if (a === 'keyCancel') await key(c, 'Escape');
      else if (a === 'scrub') { const g = await trackGeo(c); scrub = { g, from: g.x + await G(c, `window.__P2.spX(${arg.from})`), to: g.x + await G(c, `window.__P2.spX(${arg.to})`) + (arg.off || 0), t0: t, dur: 700, hold: arg.hold, y: g.y + g.h / 2, down: false, up: false }; }
      else await act(c, a, arg ?? null);
      await clock(c, t);
      log.push({ t, act: a, arg: arg ?? null, truth: await G(c, `(()=>{const t=window.__G32.truth();return {TM:t.TM,TC:t.TC,PTC:t.PTC,LH:t.LH,call:t.call,muted:t.muted,callA11y:t.callA11y}})()`) });
    };
    for (let i = 0; i < n; i++) {
      const tf = Math.round(i * 1000 / FPS) + 8;
      while (steps.length && steps[0][0] <= tf) await doStep(steps.shift());
      let finger = null;
      if (scrub && !scrub.up) {
        // the finger: down at t0, a 700 ms eased hand movement, held, then up (the page sees only real mouse events)
        const u = Math.min(1, Math.max(0, (tf - scrub.t0) / scrub.dur)), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        const x = scrub.from + (scrub.to - scrub.from) * e;
        await clock(c, tf);
        if (!scrub.down) { await mouse(c, 'mousePressed', scrub.from, scrub.y); scrub.down = true; log.push({ t: tf, act: 'pointerdown', x: scrub.from }); }
        else if (tf < scrub.t0 + scrub.dur + scrub.hold) await mouse(c, 'mouseMoved', x, scrub.y);
        else { await mouse(c, 'mouseReleased', scrub.to, scrub.y); scrub.up = true; log.push({ t: tf, act: 'pointerup', x: scrub.to }); }
        finger = x;
      }
      await clock(c, tf);
      const cropY = Math.round(h * CROP.y);
      writeFileSync(join(fd, `f${String(i).padStart(4, '0')}.png`), await c.shot({ x: 0, y: cropY, width: w, height: h - cropY, scale: 1 }));
      const s = await G(c, `(()=>{const t=window.__G32.truth();const P=window.__P2.probe();return {t:${tf},TM:t.TM,TC:t.TC,PTC:t.PTC,LH:t.LH,call:t.call,muted:t.muted,...P}})()`);
      if (finger != null) { const g = await trackGeo(c); s.fingerX = +(finger - g.x).toFixed(2); s.fingerToPreviewAperture = s.pvX == null ? null : +(s.pvX - s.fingerX).toFixed(3); }
      frames.push({ i, ...s });
    }
    await c.close();
    const out = join(md, `${name}.mp4`);
    const enc = ffmpeg(['-y', '-loglevel', 'info', '-framerate', String(FPS), '-i', join(fd, 'f%04d.png'), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'h264_mf', '-b:v', '6M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
    const back = ffmpeg(['-i', out, '-f', 'null', '-']);
    const m = [...back.matchAll(/frame=\s*(\d+)/g)].pop();
    const rec = { clip: name, what: cl.what, lang, reducedMotion: !!cl.rm, fps: FPS, frameCount: n, decodedFrames: m ? +m[1] : -1, region: `the phone's lower ${Math.round((1 - CROP.y) * 100)} % at 3× (390 × 844 phone)`,
      start: cl.state, steps: cl.steps, counterpartOf: cl.counterpartOf || null, log, frames, encoder: 'CapCut ffmpeg h264_mf 6 Mb/s yuv420p', encodeTail: enc.split('\n').slice(-2).join(' | ') };
    writeFileSync(join(td, `${name}.truth.json`), JSON.stringify(rec, null, 1));
    console.log('clip', name, n, 'frames → decoded', rec.decodedFrames);
  }
  await closeServers();
}

if (mode === 'shots') await runShots();
if (mode === 'clips') await runClips();
