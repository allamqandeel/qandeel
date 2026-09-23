// G1.1-R3 — every static phone capture the package ships, rendered from the prototype in capture mode.
// Names carry their proof folder as a prefix (conv-, modes-, replay-, shared-, light-, a11y-).
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
export const SCREENS = {
  // ---- conversation (proofs 1–4)
  'conv-01-new-opener': { build: D({ thread: 'new' }), q: 'state=active' },
  'conv-01b-new-opener-en': { build: E({ thread: 'new' }), q: 'state=active' },
  'conv-02-active-ar': { build: D(), q: 'state=active' },
  'conv-03-active-en': { build: E(), q: 'state=active' },
  'conv-04-mixed-bidi': { build: D({ thread: 'stress' }), q: 'state=active' },
  'conv-04b-mixed-first-strong-trap': { build: D({ thread: 'stress', dirMode: 'auto' }), q: 'state=active' },
  'conv-04c-mixed-top-latin-name': { build: D({ thread: 'stress' }), q: 'state=active&top=1' },
  'conv-05-first-words-sent': { build: D({ thread: 'new' }), q: 'state=active&send=' + encodeURIComponent('عندي عرض يوم الخميس ولسه مش جاهز.') },
  'conv-06-a1-placement-superseded': { build: D({ speaker: 'a1' }), q: 'state=active' },
  // ---- modes (proofs 5–8)
  'modes-01-writing': { build: D(), q: 'state=typing' },
  'modes-02-voice-note-recording': { build: D(), q: 'state=note&voiceMs=3100' },
  'modes-03-voice-note-in-history': { build: D({ thread: 'voice' }), q: 'state=active' },
  'modes-04-live-call-analysis': { build: D(), q: 'state=call&voiceMs=84000' },
  'modes-05-live-call-conversation': { build: D(), q: 'state=call-conv&voiceMs=84000' },
  'modes-06-live-call-analysis-en': { build: E(), q: 'state=call&voiceMs=84000' },
  'modes-07-live-call-muted': { build: D(), q: 'state=call-muted&voiceMs=84000' },
  // ---- Replay (proofs 9–13)
  'replay-02-analysis-chrome': { build: D(), q: 'state=world' },
  'replay-05-entry-menu': { build: D(), q: 'state=replay-menu' },
  'replay-06-part-selected': { build: D(), q: 'state=replay-part&pick=5,8' },
  'replay-06b-part-empty': { build: D(), q: 'state=replay-part' },
  'replay-07-preview-boundary': { build: D(), q: 'state=replay-preview' },
  'replay-08-entry-menu-en': { build: E(), q: 'state=replay-menu' },
  // ---- shared area (proofs 14–15)
  'shared-01-one': { build: D(), q: 'state=shared&shared=1' },
  'shared-02-many': { build: D(), q: 'state=shared&shared=3' },
  'shared-03-none': { build: D(), q: 'state=shared&shared=0' },
  'shared-04-en-one': { build: E(), q: 'state=shared&shared=1' },
  'shared-05-en-many': { build: E(), q: 'state=shared&shared=3' },
  // ---- Light (proof 16)
  'light-01-active': { build: L(), q: 'state=active', scheme: 'light' },
  'light-02-new-opener': { build: L({ thread: 'new' }), q: 'state=active', scheme: 'light' },
  'light-03-voice-note-in-history': { build: L({ thread: 'voice' }), q: 'state=active', scheme: 'light' },
  'light-04-live-call-analysis': { build: L(), q: 'state=call&voiceMs=84000', scheme: 'light' },
  'light-05-replay-menu': { build: L(), q: 'state=replay-menu', scheme: 'light' },
  // ---- accessibility and stress
  'a11y-01-contrast-more': { build: D(), q: 'state=active&contrast=more' },
  'a11y-02-contrast-more-light': { build: L(), q: 'state=active&contrast=more', scheme: 'light' },
  'a11y-03-text-200': { build: D(), q: 'state=active&ts=2' },
  'a11y-04-text-200-voice-note': { build: D({ thread: 'voice' }), q: 'state=active&ts=2' },
  'a11y-05-focus-replay': { build: D({ focus: 'replay' }), q: 'state=active' },
  'a11y-06-focus-call': { build: D({ focus: 'call' }), q: 'state=active' },
  'a11y-07-focus-end-call': { build: D({ focus: 'end-call' }), q: 'state=call&voiceMs=84000' },
  'a11y-08-compact-360': { build: D(), q: 'state=active&w=360&h=780', vw: 360, vh: 780 },
  'a11y-09-compact-360-call': { build: D(), q: 'state=call-conv&voiceMs=84000&w=360&h=780', vw: 360, vh: 780 },
  'a11y-10-reduced-motion-call': { build: D(), q: 'state=call&voiceMs=84000&rm=1', rm: true },
};

export async function captureScreens(names = Object.keys(SCREENS), dir = SCREENS_DIR, port = 9347, defs = SCREENS) {
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
      const err = await b.eval(`window.__G11rt && window.__G11rt.remeasure ? null : (window.__err || 'runtime did not initialise')`);
      if (err) throw new Error(`${name}: ${err}`);
      await b.eval(`window.__G11rt.remeasure()`);
      const m = await b.eval(`window.__G11rt.measure()`);
      const truth = await b.eval(`window.__G11rt.truth()`);
      if (m.vw !== vw) throw new Error(`${name}: layout width ${m.vw}, expected ${vw}`);
      const png = await b.shot();
      writeFileSync(join(dir, `${name}.png`), png);
      out[name] = { ...m, truth, sha256: createHash('sha256').update(png).digest('hex'), bytes: png.length };
    }
  } finally { await b.close(); }
  writeFileSync(join(dir, 'SCREENS.json'), JSON.stringify(out, null, 1));
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const names = process.argv.slice(2);
  const r = await captureScreens(names.length ? names : undefined);
  console.log(Object.keys(r).length, 'screens');
}
