// G1.1-R3 — deterministic motion capture. One journey through the three ways of talking and the two
// depths, rendered frame by frame from the prototype's own clock, then encoded with CapCut's bundled ffmpeg
// (the only H.264 encoder on this host). Every frame is a re-renderable STATE, not a screen recording.
//
// R3 §17 parity: at every commit and at every settled checkpoint the tool also records the prototype's
// usable TRUTH (depth, call, composer, Replay availability, the reachable controls). The standard and the
// Reduced Motion journeys must agree on every one of those records (check R3-M1).
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

/** `at` = when the finger LIFTS (commit); press-in feedback starts PRESS_MS earlier. */
export const JOURNEY = [
  { at: 908, target: '#mic', act: 'note', label: 'voice note starts (Conversation stays)' },
  { at: 3308, target: '#note-send', act: 'notesend', label: 'voice note sent — lands in the history' },
  { at: 4608, target: '#call', act: 'call', label: 'Live Call starts — Analysis-first' },
  { at: 6808, target: '#back', act: 'leave', label: '«المحادثة» — Conversation, the call continues' },
  { at: 8608, target: '#door', act: 'enter', label: '«تحليل المحادثة» — back to the same call' },
  { at: 10408, target: '#end-call', act: 'endcall', label: 'call ends — the reader stays where they are' },
  { at: 11808, target: '#back', act: 'leave', label: 'back to the Conversation — the call record' },
  { at: 13208, target: '#replay', act: 'menu', label: 'Replay entry' },
];
export const JOURNEY_END = 14300;
export const SETTLE_MS = 700;
const PRESS_MS = 90;

async function renderJourney(b, { name, lang = 'ar', appearance = 'dark', rm = false, events = JOURNEY, to = JOURNEY_END }) {
  const dir = join(OUT, name);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const f = join(OUT, `${name}.html`);
  writeFileSync(f, page({ lang, appearance, capture: true }));
  await b.media({ scheme: appearance, reducedMotion: rm ? 'reduce' : 'no-preference' });
  await b.goto('file:///' + f.replace(/\\/g, '/') + `?capture=1&state=active${rm ? '&rm=1' : ''}`);
  await b.eval(`document.fonts.ready.then(()=>Promise.all([400,500,600].map(w=>document.fonts.load(w+' 17px Estedad')))).then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
  await b.eval(`window.__G11rt.remeasure(); window.__G11rt.at(0)`);
  // A review-only touch indicator: where the finger is, so a viewer sees the CAUSE of each motion.
  await b.eval(`(()=>{var d=document.createElement('div');d.id='touch';d.setAttribute('aria-hidden','true');
    d.style.cssText='position:absolute;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:2px solid rgba(255,255,255,.55);background:rgba(255,255,255,.10);pointer-events:none;z-index:50;opacity:0';
    document.getElementById('phone').appendChild(d)})()`);
  const fired = new Set(), settled = new Set();
  const log = [];
  const n = Math.round((to / 1000) * FPS);
  for (let i = 0; i <= n; i++) {
    const t = (i * 1000) / FPS;
    for (const [k, e] of events.entries()) {
      if (!fired.has(k) && t >= e.at) {
        await b.eval(`window.__G11rt.at(${e.at}); window.__G11rt.press(${JSON.stringify(e.target)}, false); window.__G11rt.act(${JSON.stringify(e.act)})`);
        fired.add(k);
        log.push({ at: e.at, act: e.act, phase: 'commit', truth: await b.eval(`window.__G11rt.truth()`) });
      }
      if (fired.has(k) && !settled.has(k) && t >= e.at + SETTLE_MS) {
        settled.add(k);
        await b.eval(`window.__G11rt.at(${t.toFixed(3)})`);
        log.push({ at: e.at, act: e.act, phase: 'settled', truth: await b.eval(`window.__G11rt.truth()`) });
      }
    }
    let touch = null, pressing = null;
    for (const e of events) {
      if (t >= e.at - PRESS_MS && t < e.at) pressing = e;
      if (t >= e.at - PRESS_MS - 60 && t <= e.at + 240) touch = e;
    }
    if (pressing) await b.eval(`window.__G11rt.press(${JSON.stringify(pressing.target)}, true)`);
    if (touch) {
      const c = await b.eval(`(()=>{var e=document.querySelector(${JSON.stringify(touch.target)});if(!e)return null;var r=e.getBoundingClientRect();return r.width?[r.left+r.width/2,r.top+r.height/2]:null})()`);
      if (c) {
        const k = t < touch.at ? Math.min(1, (t - (touch.at - PRESS_MS - 60)) / 60) : Math.max(0, 1 - (t - touch.at) / 240);
        await b.eval(`(()=>{var d=document.getElementById('touch');d.style.left='${c[0]}px';d.style.top='${c[1]}px';d.style.opacity='${k.toFixed(3)}'})()`);
      }
    } else await b.eval(`document.getElementById('touch').style.opacity='0'`);
    await b.eval(`window.__G11rt.at(${t.toFixed(3)})`);
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
  { name: 'journey-ar-dark', lang: 'ar', appearance: 'dark', rm: false },
  { name: 'journey-ar-dark-reduced-motion', lang: 'ar', appearance: 'dark', rm: true },
  { name: 'journey-en-dark', lang: 'en', appearance: 'dark', rm: false },
];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(OUT, { recursive: true });
  const which = process.argv.slice(2);
  const jobs = JOBS.filter((j) => !which.length || which.includes(j.name));
  const b = await launch({ port: 9346 });
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
