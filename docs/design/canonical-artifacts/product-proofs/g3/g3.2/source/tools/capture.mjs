// G3.2 capture: the Product snapshots and motion journeys the two decisions and their non-regressions need — no more.
// Everything comes from the ONE G3.2 prototype through its own state machine; the G3.1 baseline twins come from G3.1's
// build reproduced by tools/upstream.mjs (<WORK>/upstream-g31/prototype), driven through ITS own API (window.__G31).
//   snaps → <WORK>/snaps/<id>.png (+ .world.png: the world alone; + .bg-<el>.png: the same frame with one element
//           hidden, the ground a legibility gate reads) and <WORK>/snaps/index.json
//   clips → <WORK>/frames/<clip>/f0000.png … → <PKG>/motion/<clip>.mp4 and <PKG>/data/motion/<clip>.truth.json
// The clock is virtual (?capture=1); system appearance and Reduced Motion are EMULATED media features.
// usage: node tools/capture.mjs [snaps|clips|all] [--only id,id] [--proto <dir>]
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { openPage, WORK, PKG, settle, closeServers, key } from './lib/session.mjs';
import { AUDIT, WORLD_ONLY_ON, WORLD_ONLY_OFF } from './lib/audit.mjs';

const mode = process.argv[2] || 'all';
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const PROTO = process.argv.includes('--proto') ? process.argv[process.argv.indexOf('--proto') + 1] : join(PKG, 'prototype');
const UPSTREAM = join(WORK, 'upstream-g31', 'prototype');
export const FFMPEG = process.env.G32_FFMPEG || join(process.env.LOCALAPPDATA || '', 'CapCut', 'Apps', '9.2.0.3931', 'ffmpeg.exe');

/* ------------------------------------------------------------------------------------------ snaps */
// [id, state, { build: 'g32'|'g31', lang, scheme, w, h, rm, acts: [[act, arg]], at, world, bg: [selectors], focus }]
export const SNAPS = [
  // the G3.1 baseline, same states (diagnostic comparison + world parity)
  ['g31-pinned', 'P4', { build: 'g31', world: true }], ['g31-pinned-open', 'P4_OPEN', { build: 'g31' }],
  ['g31-far', 'P1', { build: 'g31', world: true }], ['g31-mid', 'P2', { build: 'g31', world: true }], ['g31-near', 'P3', { build: 'g31', world: true }],
  ['g31-call', 'CALL_ANALYSIS', { build: 'g31', world: true }],
  ['g31-light-far-B', 'P1', { build: 'g31', scheme: 'light', shell: 'B', bg: ['#status'] }],
  // P1 / P2 — PINNED and «طرق العودة» at 390 × 844
  ['pinned', 'P4', { world: true, bg: ['#tl-ctx'] }], ['pinned-open', 'P4_OPEN', { bg: ['#tl-ctx'] }],
  ['pinned-return-live', 'P4', { acts: [['RETURN_LIVE_HEAD']], at: 2400, world: true }],
  ['preview', 'P2_LIVE17', { acts: [['previewAt', 15]], at: 600, bg: ['#tl-ctx'] }],
  // P3 / P4 — NEAR inspection and LIVE (no temporal context)
  ['far', 'P1', { world: true }], ['mid', 'P2', { world: true }], ['near', 'P3', { world: true }], ['near-open', 'P3_OPEN'],
  ['near-exact', 'P3_OPEN', { acts: [['EXACT_RETURN']], at: 900 }],
  // P5 — 320 × 568 stress
  ['s320-pinned', 'P4', { w: 320, h: 568, bg: ['#tl-ctx'] }], ['s320-pinned-open', 'P4_OPEN', { w: 320, h: 568 }],
  ['s320-call-pinned', 'CALL_PINNED', { w: 320, h: 568, bg: ['#tl-ctx'] }], ['s320-call-pinned-open', 'CALL_PINNED_OPEN', { w: 320, h: 568 }],
  ['s320-near-open', 'P3_OPEN', { w: 320, h: 568 }], ['s320-far', 'P1', { w: 320, h: 568 }],
  ['s320-light-call-pinned', 'CALL_PINNED', { w: 320, h: 568, scheme: 'light', bg: ['#status', '#tl-ctx'] }],
  // P6 — 430 × 932
  ['l430-pinned', 'P4', { w: 430, h: 932 }], ['l430-pinned-open', 'P4_OPEN', { w: 430, h: 932 }], ['l430-far', 'P1', { w: 430, h: 932 }],
  // P7 / P8 / P9 — system Light and Dark
  ['light-conv', 'CONV', { scheme: 'light', bg: ['#status'] }], ['light-far', 'P1', { scheme: 'light', world: true, bg: ['#status'] }],
  ['light-near', 'P3', { scheme: 'light', world: true }], ['light-pinned', 'P4', { scheme: 'light', world: true, bg: ['#status', '#tl-ctx'] }],
  ['light-pinned-open', 'P4_OPEN', { scheme: 'light' }],
  ['light-call', 'CALL_ANALYSIS', { scheme: 'light', world: true, bg: ['#status'] }], ['light-call-conv', 'CALL_CONV', { scheme: 'light', bg: ['#status'] }],
  ['light-call-back', 'CALL_CONV', { scheme: 'light', acts: [['enterAnalysis']], at: 900, bg: ['#status'] }],
  ['light-prop', 'M2_PROPOSAL_A', { scheme: 'light' }], ['light-replay', 'REPLAY', { scheme: 'light' }],
  ['dark-conv', 'CONV', { bg: ['#status'] }], ['call', 'CALL_ANALYSIS', { world: true, bg: ['#status'] }], ['call-conv', 'CALL_CONV'],
  // P10 — Reduced Motion end states
  ['rm-pinned', 'P4', { rm: true, world: true }], ['rm-light-far', 'P1', { rm: true, scheme: 'light', world: true }],
  // English — the refinement mirrors; no English Matching
  ['en-pinned', 'P4', { lang: 'en', bg: ['#tl-ctx'] }], ['en-pinned-open', 'P4_OPEN', { lang: 'en' }], ['en-near-open', 'P3_OPEN', { lang: 'en' }],
  ['en-s320-call-pinned', 'CALL_PINNED', { lang: 'en', w: 320, h: 568 }], ['en-light-call', 'CALL_ANALYSIS', { lang: 'en', scheme: 'light' }],
  ['en-conv-cross', 'CONV', { lang: 'en', acts: [['type', 'cross'], ['send']], at: 900 }], ['ar-conv-cross', 'CONV', { acts: [['type', 'cross'], ['send']], at: 900 }],
  // keyboard focus, painted
  ['focus-live-edge', 'P4', { focus: 'tl-live' }], ['focus-more', 'P4_OPEN', { focus: 'more-t' }], ['focus-track', 'P4', { focus: 'tl-track' }],
];

async function runSnaps() {
  const dir = join(WORK, 'snaps'); mkdirSync(dir, { recursive: true });
  const indexPath = join(dir, 'index.json');
  const index = existsSync(indexPath) && only ? JSON.parse(readFileSync(indexPath, 'utf8')) : {};
  const want = SNAPS.filter(([id]) => !only || only.includes(id));
  const groups = new Map();
  for (const s of want) { const o = s[2] || {}; const k = [o.build || 'g32', o.lang || 'ar', o.scheme || 'dark', o.w || 390, o.h || 844, !!o.rm].join('|'); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
  let port = 9461;
  for (const [k, list] of groups) {
    const [build, lang, scheme, w, h, rm] = k.split('|');
    const api = build === 'g31' ? '__G31' : '__G32';
    const c = await openPage({ proto: build === 'g31' ? UPSTREAM : PROTO, httpPort: build === 'g31' ? 8834 : 8832, cdpPort: port++, lang, scheme, w: +w, h: +h, rm: rm === 'true' });
    for (const [id, state, o = {}] of list) {
      if (build === 'g31') await c.eval(`(window.__G31.setShell(${JSON.stringify(o.shell || 'A')}), true)`);
      await c.eval(`(window.${api}.clock(0), window.${api}.enter(${JSON.stringify(state)}), true)`);
      for (const [a, arg] of o.acts || []) await c.eval(`(window.${api}.act(${JSON.stringify(a)}, ${JSON.stringify(arg ?? null)}), true)`);
      if (o.at) await c.eval(`window.${api}.clock(${o.at})`);
      if (o.focus) { await key(c, 'Shift'); await c.eval(`(document.getElementById(${JSON.stringify(o.focus)})||document.querySelector(${JSON.stringify('[data-act="' + o.focus + '"]')})).focus()`); }
      await c.eval(settle);
      writeFileSync(join(dir, `${id}.png`), await c.shot());
      const truth = await c.eval(`window.${api}.truth()`);
      const audit = await c.eval(AUDIT);
      const rec = { id, build, state, lang, scheme, w: +w, h: +h, rm: rm === 'true', shell: build === 'g31' ? (o.shell || 'A') : null, acts: o.acts || [], at: o.at || 0, file: `${id}.png`, truth, audit, bg: {} };
      for (const sel of o.bg || []) {
        const box = await c.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e||e.hidden)return null;const p=document.getElementById('phone').getBoundingClientRect(),b=e.getBoundingClientRect();const ink=getComputedStyle(e.querySelector('.clock')||e.querySelector('span')||e).color;e.dataset.bgv=e.style.visibility||'-';e.style.visibility='hidden';return {x:b.left-p.left,y:b.top-p.top,w:b.width,h:b.height,ink}})()`);
        if (!box) continue;
        await c.eval(settle);
        const f = `${id}.bg-${sel.replace(/[^a-z0-9-]/gi, '')}.png`;
        writeFileSync(join(dir, f), await c.shot());
        await c.eval(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.style.visibility=e.dataset.bgv==='-'?'':e.dataset.bgv;delete e.dataset.bgv;return true})()`);
        rec.bg[sel] = { file: f, box };
      }
      if (o.world) { await c.eval(WORLD_ONLY_ON); await c.eval(settle); writeFileSync(join(dir, `${id}.world.png`), await c.shot()); await c.eval(WORLD_ONLY_OFF); rec.world = `${id}.world.png`; }
      index[id] = rec;
      console.log('snap', id, build, truth.place, truth.TM, truth.TC, 'ctx', JSON.stringify(truth.ctxLines || null), truth.call);
    }
    await c.close();
  }
  writeFileSync(indexPath, JSON.stringify(index, null, 1));
}

/* ------------------------------------------------------------------------------------------ clips */
// Each clip: a start state, pre-roll acts at negative clock (settled before the first frame), then timed acts.
// `media` switches the EMULATED system appearance mid-clip.
export const CLIPS = {
  '01-pinned-return-live': { lang: 'ar', state: 'P2_LIVE17', dur: 5600,
    steps: [[500, 'previewAt', 16], [900, 'previewAt', 15], [1300, 'previewAt', 14], [1900, 'commitPreview'], [3600, 'RETURN_LIVE_HEAD']],
    keys: [0, 700, 1500, 2000, 2150, 3000, 3650, 3800, 5500] },
  '02-pinned-return-live-reduced-motion': { lang: 'ar', state: 'P2_LIVE17', rm: true, dur: 5600,
    steps: [[500, 'previewAt', 16], [900, 'previewAt', 15], [1300, 'previewAt', 14], [1900, 'commitPreview'], [3600, 'RETURN_LIVE_HEAD']],
    keys: [0, 700, 1500, 2000, 2150, 3000, 3650, 3800, 5500], counterpartOf: '01-pinned-return-live' },
  '03-light-conversation-analysis-conversation': { lang: 'ar', state: 'CONV', scheme: 'light', dur: 4600,
    steps: [[500, 'enterAnalysis'], [2600, 'leaveAnalysis']], keys: [0, 560, 620, 700, 1000, 2000, 2660, 2720, 2800, 3200, 4500] },
  '04-light-live-call-analysis-conversation-analysis': { lang: 'ar', state: 'CONV', scheme: 'light', dur: 8200,
    steps: [[400, 'startCall'], [2800, 'leaveAnalysis'], [5200, 'enterAnalysis']], keys: [0, 700, 1900, 2860, 3000, 3300, 4400, 5260, 5400, 5700, 8100] },
  '05-stress-320-disclosure-reachability': { lang: 'ar', state: 'CALL_PINNED', w: 320, h: 568, dur: 4800,
    steps: [[600, 'toggleMore'], [1500, 'scrollBand', 'end'], [2700, 'GO_LIVE_AND_LOCATE']], keys: [0, 700, 900, 1600, 2200, 2760, 2900, 4700] },
  '06-light-call-reduced-motion': { lang: 'ar', state: 'CONV', scheme: 'light', rm: true, dur: 8200,
    steps: [[400, 'startCall'], [2800, 'leaveAnalysis'], [5200, 'enterAnalysis']], keys: [0, 460, 700, 1900, 2860, 3000, 4400, 5260, 5400, 8100], counterpartOf: '04-light-live-call-analysis-conversation-analysis' },
  '07-light-conversation-analysis-reduced-motion': { lang: 'ar', state: 'CONV', scheme: 'light', rm: true, dur: 4600,
    steps: [[500, 'enterAnalysis'], [2600, 'leaveAnalysis']], keys: [0, 560, 620, 700, 1000, 2000, 2660, 2720, 2800, 3200, 4500], counterpartOf: '03-light-conversation-analysis-conversation' },
};

function ffmpeg(args) { const r = spawnSync(FFMPEG, args, { encoding: 'utf8', maxBuffer: 1 << 26 }); return (r.stdout || '') + (r.stderr || ''); }
const pickTruth = (tr) => ({ place: tr.place, rail: tr.rail, TM: tr.TM, TC: tr.TC, PTC: tr.PTC, LH: tr.LH, call: tr.call, callId: tr.callId, conversation: tr.conversation, appearance: tr.appearance,
  analysisShellDark: tr.analysisShellDark, IF: tr.IF, offered: tr.offered, direct: tr.direct, grouped: tr.grouped, rendered: tr.rendered, moreOpen: tr.moreOpen, controls: tr.controls, world: tr.world,
  bandLines: tr.bandLines, ctxLines: tr.ctxLines, callA11y: tr.callA11y, lineLabel: tr.lineLabel });
async function runClips() {
  const md = join(PKG, 'motion'), td = join(PKG, 'data', 'motion'); mkdirSync(md, { recursive: true }); mkdirSync(td, { recursive: true });
  let port = 9481;
  for (const [name, cl] of Object.entries(CLIPS)) {
    if (only && !only.includes(name)) continue;
    const fd = join(WORK, 'frames', name); rmSync(fd, { recursive: true, force: true }); mkdirSync(fd, { recursive: true });
    const w = cl.w || 390, h = cl.h || 844;
    const c = await openPage({ proto: PROTO, httpPort: 8833, cdpPort: port++, lang: cl.lang, rm: !!cl.rm, scheme: cl.scheme || 'dark', w, h });
    const G = (x) => c.eval(x);
    await G(`(window.__G32.clock(0), window.__G32.enter(${JSON.stringify(cl.state)}), true)`);
    for (const [t, a, arg] of cl.pre || []) {
      await G(`window.__G32.clock(${t})`);
      await G(`(window.__G32.act(${JSON.stringify(a)}, ${JSON.stringify(arg ?? null)}), true)`);
    }
    await G('window.__G32.clock(0)');
    const log = [], steps = cl.steps.slice(); const FPS = 30, n = Math.floor(cl.dur / 1000 * FPS) + 1;
    const doStep = async ([t, a, arg]) => {
      await G(`window.__G32.clock(${t})`);
      if (a === 'media') { await c.media({ scheme: arg, reducedMotion: cl.rm ? 'reduce' : 'no-preference' }); await G(settle); }
      else if (a === 'scrollBand') await G(`(()=>{const b=document.getElementById('band');b.scrollTop=${arg === 'end' ? 'b.scrollHeight' : 0};b.dispatchEvent(new Event('scroll'));return true})()`);
      else await G(`(window.__G32.act(${JSON.stringify(a)}, ${JSON.stringify(arg ?? null)}), true)`);
      await G(`window.__G32.clock(${t})`);
      log.push({ t, act: a, arg: arg ?? null, truth: pickTruth(await G('window.__G32.truth()')) });
    };
    const frames = [];
    for (let i = 0; i < n; i++) {
      const tf = Math.round(i * 1000 / FPS) + 8;                 // 8 ms off the 60 fps grid (a boundary sample is progress 0)
      while (steps.length && steps[0][0] <= tf) await doStep(steps.shift());
      await G(`window.__G32.clock(${tf})`);
      writeFileSync(join(fd, `f${String(i).padStart(4, '0')}.png`), await c.shot());
      if (i % 2 === 0) {
        const s = await G(`(()=>{const t=window.__G32.truth();const x=document.getElementById('tl-ctx'),tr=document.getElementById('tl-track'),p=document.getElementById('phone').getBoundingClientRect();const cb=x.hidden?null:x.getBoundingClientRect();return {t:${tf},place:t.place,call:t.call,callId:t.callId,TM:t.TM,TC:t.TC,PTC:t.PTC,LH:t.LH,appearance:t.appearance,shellDark:t.analysisShellDark,ctxLines:t.ctxLines,ctxOpacity:+getComputedStyle(x).opacity,ctxBottom:cb?+(cb.bottom-p.top).toFixed(2):null,trackTop:+(tr.getBoundingClientRect().top-p.top).toFixed(2),statusInk:getComputedStyle(document.getElementById('status')).color,phoneBg:getComputedStyle(document.getElementById('phone')).backgroundColor}})()`);
        frames.push({ i, ...s });
      }
    }
    const endTruth = pickTruth(await G('window.__G32.truth()'));
    const endAudit = await G(AUDIT);
    await c.close();
    const out = join(md, `${name}.mp4`);
    const enc = ffmpeg(['-y', '-loglevel', 'info', '-framerate', String(FPS), '-i', join(fd, 'f%04d.png'), '-c:v', 'h264_mf', '-b:v', '9M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
    const back = ffmpeg(['-i', out, '-f', 'null', '-']);
    const m = [...back.matchAll(/frame=\s*(\d+)/g)].pop();
    const rec = { clip: name, lang: cl.lang, scheme: cl.scheme || 'dark', reducedMotion: !!cl.rm, fps: FPS, frameCount: n, decodedFrames: m ? +m[1] : -1, size: `${w * 2}x${h * 2} (${w}x${h} @2x)`, start: cl.state, pre: cl.pre || [], steps: cl.steps,
      keyFrames: cl.keys.map((t) => ({ t, frame: Math.min(n - 1, Math.round((t - 8) * FPS / 1000)) })), counterpartOf: cl.counterpartOf || null, log, frames, endTruth,
      endAudit: { text: endAudit.text.map((x) => x.text), controls: endAudit.controls.map((x) => x.id || x.act || x.world) }, encoder: 'CapCut ffmpeg h264_mf 9 Mb/s yuv420p', encodeTail: enc.split('\n').slice(-3).join(' | ') };
    writeFileSync(join(td, `${name}.truth.json`), JSON.stringify(rec, null, 1));
    console.log('clip', name, n, 'frames → decoded', rec.decodedFrames);
  }
}

if (mode === 'snaps' || mode === 'all') await runSnaps();
if (mode === 'clips' || mode === 'all') await runClips();
await closeServers();
