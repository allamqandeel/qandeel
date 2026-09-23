// G1.2 — deterministic motion capture. Each journey is rendered frame by frame from the prototype's own clock
// and encoded with CapCut's bundled ffmpeg (this host's only H.264 encoder). Every frame is a re-renderable STATE.
//
// Parity (G1.2 §25, §30): at every act ("commit") and SETTLE_MS later ("settled") the tool records the
// prototype's usable TRUTH — surface, call phase and id, Conversation id, composer mode, notice, OS surface,
// reachable controls, the call's words. The standard and Reduced Motion recordings of a journey must agree on
// every record (check G12-M1). Acts with no `target` are the OPERATING SYSTEM (lock, other app, return, network)
// and draw no finger.
import { writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { page } from '../src/build.mjs';
import { launch } from './cdp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'out', 'motion');
const FFMPEG = join(process.env.LOCALAPPDATA, 'CapCut', 'Apps', '9.2.0.3931', 'ffmpeg.exe');
const FPS = 60;
export const SETTLE_MS = 700;
const PRESS_MS = 90;

/** `at` = when the finger LIFTS (commit). */
export const JOURNEYS = {
  'A-voice-note': { q: 'perm=unknown', end: 10000, events: [
    { at: 900, target: '#mic', act: 'note', label: 'microphone — the intent; the OS asks (first time only)' },
    { at: 2100, target: '#os-allow', act: 'allow', label: 'allowed in the OS prompt — capture begins in the Conversation' },
    { at: 5300, target: '#note-send', act: 'notesend', label: 'sent — the note lands as the reader\'s UTTERANCE' },
    { at: 6500, target: '.thread .new .t.voice .play', act: 'playlast', label: 'playback of the committed note' },
  ] },
  'B-live-call-foreground': { q: 'perm=granted', end: 15200, events: [
    { at: 900, target: '#call', act: 'call', label: 'handset — Live Call starts Analysis-first (connecting)' },
    { at: 8200, target: '#back', act: 'leave', label: '«المحادثة» — the Conversation; the same call continues' },
    { at: 10400, target: '#door', act: 'enter', label: '«تحليل المحادثة» — back to the same call' },
    { at: 12600, target: '#mute', act: 'mute', label: 'microphone muted (shape + words)' },
    { at: 14200, target: '#end-call', act: 'endcall', label: 'the reader ends the call — stays where they are' },
  ] },
  'C-background-restore': { q: 'perm=granted', end: 14600, events: [
    { at: 700, target: '#call', act: 'call', label: 'Live Call — Analysis-first' },
    { at: 3400, act: 'bg', label: 'OS: the screen locks while the Analysis is on screen' },
    { at: 6400, act: 'fg', label: 'OS: back to QANDEEL — the same Analysis, the same call, 3 s later' },
    { at: 7800, target: '#back', act: 'leave', label: '«المحادثة» — the Conversation during the call' },
    { at: 9200, act: 'bgapp', label: 'OS: another app comes to the front' },
    { at: 12200, act: 'fg', label: 'OS: back to QANDEEL — the Conversation, not the Analysis' },
    { at: 13600, target: '#door', act: 'enter', label: '«تحليل المحادثة» — the same call continues' },
  ] },
  'D1-permission-denied': { q: 'perm=unknown', end: 5800, events: [
    { at: 900, target: '#call', act: 'call', label: 'handset — the OS asks for the microphone' },
    { at: 2300, target: '#os-deny', act: 'deny', label: 'not allowed — the Conversation stays; the notice names Writing' },
    { at: 3600, target: '#input', act: 'type', label: 'writing' },
    { at: 4800, target: '#send', act: 'sendtext', label: 'sent — the relationship continues in writing' },
  ] },
  'D2-network-interruption': { q: 'perm=granted', end: 13000, events: [
    { at: 700, target: '#call', act: 'call', label: 'Live Call — Analysis-first' },
    { at: 4600, act: 'drop', label: 'network drops — reconnecting (words, no live level)' },
    { at: 6600, act: 'recover', label: 'network returns — the SAME call resumes' },
    { at: 9000, act: 'drop', label: 'network drops again' },
    { at: 11800, act: 'fail', label: 'reconnection fails — the Conversation, Writing available, the call record' },
  ] },
  'D3-ended-while-away': { q: 'perm=granted', end: 8200, events: [
    { at: 700, target: '#call', act: 'call', label: 'Live Call — Analysis-first' },
    { at: 3000, act: 'bg', label: 'OS: the screen locks' },
    { at: 5000, act: 'awaydrop', label: 'OS: the call ends while QANDEEL is away' },
    { at: 7000, act: 'fg', label: 'OS: back — no live controls; the Conversation says what happened' },
  ] },
};

async function renderJourney(b, { name, journey, lang = 'ar', appearance = 'dark', rm = false }) {
  const J = JOURNEYS[journey];
  const dir = join(OUT, name);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const f = join(OUT, `${name}.html`);
  writeFileSync(f, page({ lang, appearance, capture: true }));
  await b.media({ scheme: appearance, reducedMotion: rm ? 'reduce' : 'no-preference' });
  await b.goto('file:///' + f.replace(/\\/g, '/') + `?capture=1&state=active&${J.q}${rm ? '&rm=1' : ''}`);
  await b.eval(`document.fonts.ready.then(()=>Promise.all([400,500,600].map(w=>document.fonts.load(w+' 17px Estedad')))).then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
  await b.eval(`window.__G12rt.remeasure(); window.__G12rt.at(0)`);
  const err = await b.eval('window.__err || null'); if (err) throw new Error(`${name}: ${err}`);
  await b.eval(`(()=>{var d=document.createElement('div');d.id='touch';d.setAttribute('aria-hidden','true');
    d.style.cssText='position:absolute;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:2px solid rgba(255,255,255,.55);background:rgba(255,255,255,.10);pointer-events:none;z-index:50;opacity:0';
    document.getElementById('phone').appendChild(d)})()`);
  const events = J.events;
  const fired = new Set(), settled = new Set();
  const log = [];
  const n = Math.round((J.end / 1000) * FPS);
  for (let i = 0; i <= n; i++) {
    const t = (i * 1000) / FPS;
    for (const [k, e] of events.entries()) {
      if (!fired.has(k) && t >= e.at) {
        await b.eval(`window.__G12rt.at(${e.at}); ${e.target ? `window.__G12rt.press(${JSON.stringify(e.target)}, false);` : ''} window.__G12rt.act(${JSON.stringify(e.act)})`);
        fired.add(k);
        log.push({ at: e.at, act: e.act, phase: 'commit', truth: await b.eval(`window.__G12rt.truth()`) });
      }
      if (fired.has(k) && !settled.has(k) && t >= e.at + SETTLE_MS) {
        settled.add(k);
        await b.eval(`window.__G12rt.at(${t.toFixed(3)})`);
        log.push({ at: e.at, act: e.act, phase: 'settled', truth: await b.eval(`window.__G12rt.truth()`) });
      }
    }
    let touch = null, pressing = null;
    for (const e of events) {
      if (!e.target) continue;
      if (t >= e.at - PRESS_MS && t < e.at) pressing = e;
      if (t >= e.at - PRESS_MS - 60 && t <= e.at + 240) touch = e;
    }
    if (pressing) await b.eval(`window.__G12rt.press(${JSON.stringify(pressing.target)}, true)`);
    if (touch) {
      const c = await b.eval(`(()=>{var e=document.querySelector(${JSON.stringify(touch.target)});if(!e)return null;var r=e.getBoundingClientRect(),p=document.getElementById('phone').getBoundingClientRect();return r.width?[r.left-p.left+r.width/2,r.top-p.top+r.height/2]:null})()`);
      if (c) {
        const k = t < touch.at ? Math.min(1, (t - (touch.at - PRESS_MS - 60)) / 60) : Math.max(0, 1 - (t - touch.at) / 240);
        await b.eval(`(()=>{var d=document.getElementById('touch');d.style.left='${c[0]}px';d.style.top='${c[1]}px';d.style.opacity='${k.toFixed(3)}'})()`);
      }
    } else await b.eval(`document.getElementById('touch').style.opacity='0'`);
    await b.eval(`window.__G12rt.at(${t.toFixed(3)})`);
    writeFileSync(join(dir, `f${String(i).padStart(4, '0')}.png`), await b.shot());
  }
  writeFileSync(join(OUT, `${name}.truth.json`), JSON.stringify(log, null, 1));
  return { name, frames: n + 1, dir, log };
}

export function encode(dir, mp4) {
  const r = spawnSync(FFMPEG, ['-y', '-hide_banner', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'),
    '-c:v', 'h264_mf', '-b:v', '9M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { encoding: 'utf8' });
  const all = (r.stdout || '') + (r.stderr || '');
  if (!existsSync(mp4) || statSync(mp4).size < 10000) throw new Error(`encode failed: ${all.slice(-800)}`);
  const c = spawnSync(FFMPEG, ['-hide_banner', '-i', mp4, '-f', 'null', '-'], { encoding: 'utf8' });
  const m = [...((c.stdout || '') + (c.stderr || '')).matchAll(/frame=\s*(\d+)/g)].pop();
  return { mp4, bytes: statSync(mp4).size, frames: m ? +m[1] : -1 };
}

export const JOBS = [
  ...Object.keys(JOURNEYS).flatMap((j) => [
    { name: `${j}-ar`, journey: j, lang: 'ar', rm: false },
    { name: `${j}-ar-reduced-motion`, journey: j, lang: 'ar', rm: true },
  ]),
  { name: 'C-background-restore-en', journey: 'C-background-restore', lang: 'en', rm: false },
];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(OUT, { recursive: true });
  const which = process.argv.slice(2);
  const jobs = JOBS.filter((j) => !which.length || which.some((w) => j.name.startsWith(w)));
  const b = await launch({ port: 9446 });
  const results = [];
  try {
    await b.viewport({ width: 390, height: 844, dpr: 2 });
    for (const j of jobs) {
      const t0 = Date.now();
      const r = await renderJourney(b, j);
      results.push(r);
      console.log(r.name, r.frames, 'frames', Date.now() - t0, 'ms');
    }
  } finally { await b.close(); }
  for (const r of results) console.log(JSON.stringify(encode(r.dir, join(OUT, `${r.name}.mp4`))));
}
