// G1.2 — every static phone capture the package ships, rendered from the prototype in capture mode.
// Names carry their proof folder as a prefix (writ-, vn-, lc-, bg-, pf-, bi-, light-, a11y-).
// `q` is the query string: state preset, and the clock-derived times (voiceMs = time since the call began or the
// note began; awayMs = time QANDEEL has been in the background; playMs = playback position).
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { page } from '../src/build.mjs';
import { launch } from './cdp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SCREENS_DIR = join(HERE, '..', 'out', 'screens');

const D = (extra = {}) => ({ lang: 'ar', appearance: 'dark', ...extra });
const E = (extra = {}) => ({ lang: 'en', appearance: 'dark', ...extra });
const L = (extra = {}) => ({ lang: 'ar', appearance: 'light', ...extra });
// Call clock: established at 1.2 s; the 20 s script cycle — reader 0.4–4.0 s, QANDEEL 5.0–8.2 s, reader 9.2–12.8 s,
// QANDEEL 13.8–17.0 s; spoken turns commit at 4.2 s and 13.0 s. 84 s = cycle 4, +2.8 s → the reader speaking.
const USER = 84000, QOUT = 88000, IDLE = 81300;
export const SCREENS = {
  // ---- 1–2 Writing and the idle controls
  'writ-01-writing-ar': { build: D(), q: 'state=typing' },
  'writ-02-idle-three-ways': { build: D(), q: 'state=active' },
  'writ-03-new-conversation-opener': { build: D({ thread: 'new' }), q: 'state=active' },
  // ---- 3–7, 10 Voice Note
  'vn-01-permission-intent': { build: D(), q: 'state=ask-note&perm=unknown' },
  'vn-02-capture-active': { build: D(), q: 'state=note&voiceMs=6400' },
  'vn-03-capture-elapsed-long': { build: D(), q: 'state=note&voiceMs=74000' },
  'vn-04-cancel-focused': { build: D({ focus: 'note-cancel' }), q: 'state=note&voiceMs=6400' },
  'vn-05-committed-in-history': { build: D({ thread: 'voice' }), q: 'state=active' },
  'vn-06-playback': { build: D({ thread: 'voice' }), q: 'state=playing&playMs=5200' },
  'vn-07-draft-after-leaving': { build: D(), q: 'state=draft&voiceMs=6400' },
  // ---- 8 permission denied / 19–20 failure
  'pf-01-mic-denied-writing': { build: D(), q: 'state=denied&perm=denied' },
  'pf-02-call-permission-intent': { build: D(), q: 'state=ask-call&perm=unknown' },
  'pf-03-reconnecting': { build: D(), q: `state=reconnect&voiceMs=${USER}` },
  'pf-04-call-failed-writing': { build: D(), q: 'state=failed' },
  // ---- 9–14, 21 Live Call
  'lc-01-connecting': { build: D(), q: 'state=call&voiceMs=600' },
  'lc-02-analysis-first': { build: D(), q: `state=call&voiceMs=${IDLE}` },
  'lc-03-reader-speaking': { build: D(), q: `state=call&voiceMs=${USER}` },
  'lc-04-qandeel-speaking': { build: D(), q: `state=call&voiceMs=${QOUT}` },
  'lc-05-conversation-same-call': { build: D(), q: `state=call-conv&voiceMs=${QOUT}` },
  'lc-06-muted': { build: D(), q: `state=call-muted&voiceMs=${USER}` },
  'lc-07-speaker-off': { build: D({ focus: 'route' }), q: `state=call-earpiece&voiceMs=${USER}` },
  'lc-08-replay-during-call': { build: D(), q: `state=call-replay-menu&voiceMs=${QOUT}` },
  'lc-09-barge-in-candidate': { build: D(), q: `state=barge&voiceMs=${QOUT}` },
  'lc-10-ended-conversation': { build: D(), q: 'state=ended' },
  // ---- 15–18 background / restore
  'bg-01-locked-while-analysis': { build: D(), q: `state=bg&voiceMs=${USER}&awayMs=48000` },
  'bg-02-returned-same-analysis': { build: D(), q: `state=call&voiceMs=${USER + 48000}` },
  'bg-03-other-app-while-conversation': { build: D(), q: `state=bg-conv&voiceMs=${QOUT}&awayMs=36000` },
  'bg-04-returned-same-conversation': { build: D(), q: `state=call-conv&voiceMs=${QOUT + 36000}` },
  'bg-05-ended-while-away-returned': { build: D(), q: 'state=awayended' },
  'bg-06-relaunch-after-force-quit': { build: D(), q: 'state=relaunch' },
  // ---- 22–23 bilingual
  'bi-01-arabic-mixed-script': { build: D({ thread: 'stress' }), q: 'state=active' },
  'bi-02-arabic-mixed-during-call': { build: D({ thread: 'stress' }), q: `state=call-conv&voiceMs=${USER}` },
  'bi-03-en-idle': { build: E(), q: 'state=active' },
  'bi-04-en-voice-committed': { build: E({ thread: 'voice' }), q: 'state=active' },
  'bi-05-en-capture': { build: E(), q: 'state=note&voiceMs=6400' },
  'bi-06-en-analysis-first': { build: E(), q: `state=call&voiceMs=${QOUT}` },
  'bi-07-en-conversation-same-call': { build: E(), q: `state=call-conv&voiceMs=${USER}` },
  'bi-08-en-background': { build: E(), q: `state=bg&voiceMs=${USER}&awayMs=48000` },
  'bi-09-en-mic-denied': { build: E(), q: 'state=denied&perm=denied' },
  'bi-10-en-call-failed': { build: E(), q: 'state=failed' },
  'bi-11-en-reconnecting': { build: E(), q: `state=reconnect&voiceMs=${USER}` },
  // ---- 24 Light
  'light-01-voice-committed': { build: L({ thread: 'voice' }), q: 'state=active', scheme: 'light' },
  'light-02-capture': { build: L(), q: 'state=note&voiceMs=6400', scheme: 'light' },
  'light-03-analysis-first': { build: L(), q: `state=call&voiceMs=${USER}`, scheme: 'light' },
  'light-04-conversation-same-call': { build: L(), q: `state=call-conv&voiceMs=${QOUT}`, scheme: 'light' },
  'light-05-call-failed': { build: L(), q: 'state=failed', scheme: 'light' },
  // ---- accessibility and stress (30)
  'a11y-01-contrast-more-call': { build: D(), q: `state=call-conv&voiceMs=${QOUT}&contrast=more` },
  'a11y-02-contrast-more-voice': { build: L({ thread: 'voice' }), q: 'state=active&contrast=more', scheme: 'light' },
  'a11y-03-text-200-call-line': { build: D(), q: `state=call-conv&voiceMs=${QOUT}&ts=2` },
  'a11y-04-text-200-reconnecting': { build: D(), q: `state=reconnect&voiceMs=${USER}&ts=2` },
  'a11y-05-text-200-voice': { build: D({ thread: 'voice' }), q: 'state=active&ts=2' },
  'a11y-06-focus-end-call': { build: D({ focus: 'end-call' }), q: `state=call&voiceMs=${USER}` },
  'a11y-07-focus-mic': { build: D({ focus: 'mic' }), q: 'state=active' },
  'a11y-08-compact-360-call': { build: D(), q: `state=call&voiceMs=${QOUT}&w=360&h=780`, vw: 360, vh: 780 },
  'a11y-09-reduced-motion-reader-speaking': { build: D(), q: `state=call&voiceMs=${USER}&rm=1`, rm: true },
  'a11y-10-reduced-motion-capture': { build: D(), q: 'state=note&voiceMs=6400&rm=1', rm: true },
};

export async function captureScreens(names = Object.keys(SCREENS), dir = SCREENS_DIR, port = 9447, defs = SCREENS) {
  mkdirSync(dir, { recursive: true });
  const b = await launch({ port });
  const out = {};
  try {
    for (const name of names) {
      const S = defs[name];
      const vw = S.vw || 390, vh = S.vh || 844;
      await b.viewport({ width: vw, height: vh, dpr: 2 });
      await b.media({ scheme: S.scheme || 'dark', reducedMotion: S.rm ? 'reduce' : 'no-preference' });
      const f = join(dir, `${name}.html`);
      writeFileSync(f, page({ ...S.build, capture: true }));
      await b.goto('file:///' + f.replace(/\\/g, '/') + '?capture=1&' + S.q);
      await b.eval(`document.fonts.ready.then(()=>Promise.all([400,500,600].map(w=>document.fonts.load(w+' 17px Estedad')))).then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
      const err = await b.eval(`window.__G12rt && window.__G12rt.remeasure ? (window.__err || null) : (window.__err || 'runtime did not initialise')`);
      if (err) throw new Error(`${name}: ${err}`);
      await b.eval(`window.__G12rt.remeasure(); window.__G12rt.at(0)`);
      const m = await b.eval(`window.__G12rt.measure()`);
      const truth = await b.eval(`window.__G12rt.truth()`);
      if (m.vw !== vw) throw new Error(`${name}: layout width ${m.vw}, expected ${vw}`);
      const png = await b.shot();
      writeFileSync(join(dir, `${name}.png`), png);
      out[name] = { q: S.q, ...m, truth, sha256: createHash('sha256').update(png).digest('hex'), bytes: png.length };
    }
  } finally { await b.close(); }
  if (dir === SCREENS_DIR) writeFileSync(join(dir, 'SCREENS.json'), JSON.stringify(out, null, 1));
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const names = process.argv.slice(2);
  const r = await captureScreens(names.length ? names : undefined);
  console.log(Object.keys(r).length, 'screens');
}
