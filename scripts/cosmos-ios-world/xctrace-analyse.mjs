#!/usr/bin/env node
// COSMOS-FINAL-01 SE-FU-1 native profiling — VALIDATION BRANCH ONLY (cosmos/validate/final-sefu1-prof; never merged).
// Reads one Time Profiler table exported by `xctrace export --xpath …/table[@schema="time-profile"]` and summarises the
// app process's first launch: the per-thread CPU timeline, the longest main-thread busy stretch and what ran in it, and
// the board's window (typefaceReady → door.layout) mapped onto the trace by independent anchors.
//
// usage: node xctrace-analyse.mjs --tp <time-profile.xml> --toc <toc.xml> --process <executable> --board <note .txt>
//                                 --started <epoch ms the recording reported it started> --out <prefix>
// Writes <prefix>-summary.txt and <prefix>-busy.folded (main-thread stacks of the busy stretch, root first, for a flame
// graph). Holds function names and times only: no content of the app, no identifiers of a reader.
import fs from 'node:fs';

const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const tpPath = arg('tp'), tocPath = arg('toc'), procName = arg('process') ?? '', boardPath = arg('board');
const started = arg('started') ? Number(arg('started')) : NaN;
const out = arg('out') ?? 'xctrace';
const BIN = 100; // ms

// ── a small streaming XML reader for xctrace's export (elements with id= are defined once and referenced by ref=) ──
const byId = new Map();
const stack = [];
const samples = [];
let rows = 0;
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
function attrsOf(s) {
  const a = {};
  for (const m of s.matchAll(/([\w:-]+)="([^"]*)"/g)) a[m[1]] = decode(m[2]);
  for (const m of s.matchAll(/([\w:-]+)='([^']*)'/g)) a[m[1]] = decode(m[2]);
  return a;
}
function resolve(e) { return e && e.attrs.ref ? byId.get(e.attrs.ref) ?? e : e; }
function child(e, tag) { const c = e.children.find((x) => resolve(x)?.tag === tag || x.tag === tag); return resolve(c); }
const frameCache = new WeakMap();
function framesOf(bt) {
  if (!bt) return [];
  if (frameCache.has(bt)) return frameCache.get(bt);
  const names = [];
  for (const f0 of bt.children) {
    const f = resolve(f0);
    if (!f || f.tag !== 'frame') continue;
    const bin = child(f, 'binary');
    const name = f.attrs.name ?? f.attrs.addr ?? '?';
    names.push(bin?.attrs?.name ? `${name} [${bin.attrs.name}]` : name);
  }
  frameCache.set(bt, names);
  return names;
}
function onRow(row) {
  rows += 1;
  const time = child(row, 'sample-time');
  const thread = child(row, 'thread');
  if (!time || !thread) return;
  const proc = child(thread, 'process') ?? child(row, 'process');
  const pfmt = proc?.attrs?.fmt ?? '';
  if (procName && !pfmt.startsWith(`${procName} (`) && !pfmt.startsWith(procName)) return;
  const weight = child(row, 'weight');
  const state = child(row, 'thread-state');
  const bt = child(row, 'backtrace') ?? child(row, 'tagged-backtrace');
  samples.push({
    t: Number(time.text) / 1e6,
    thread: (thread.attrs.fmt ?? '?').replace(/\s*\(.*\)\s*$/, ''),
    main: /^Main Thread/.test(thread.attrs.fmt ?? ''),
    ms: weight ? Number(weight.text) / 1e6 : 1,
    state: state?.attrs?.fmt ?? state?.text ?? '',
    frames: framesOf(bt),
    proc: pfmt,
  });
}
function onClose(e) {
  if (e.attrs.id) byId.set(e.attrs.id, e);
  if (e.tag === 'row') { onRow(e); e.children = []; }
}
async function readXml(path) {
  const re = /<(\/?)([\w:-]+)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>|<\?[^>]*\?>|<!--[\s\S]*?-->|([^<]+)/g;
  let rest = '';
  for await (const chunk of fs.createReadStream(path, { encoding: 'utf8', highWaterMark: 1 << 20 })) {
    const buf = rest + chunk;
    const cut = buf.lastIndexOf('>') + 1;
    rest = buf.slice(cut);
    const text = buf.slice(0, cut);
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      if (m[5] !== undefined) { if (stack.length) stack[stack.length - 1].text += decode(m[5]); continue; }
      if (!m[2]) continue;
      if (m[1] === '/') {
        const e = stack.pop();
        if (e) onClose(e);
        continue;
      }
      const e = { tag: m[2], attrs: attrsOf(m[3] ?? ''), children: [], text: '' };
      if (stack.length) stack[stack.length - 1].children.push(e);
      if (m[4] === '/') onClose(e);
      else stack.push(e);
      // keep only rows' subtrees: drop finished top-level siblings to bound memory
      if (stack.length === 3 && stack[1].children.length > 1 && e.tag === 'row') stack[1].children = [e];
    }
  }
}

// ── board facts (the app's own clock, epoch ms) ──
function boardFacts(path) {
  if (!path || !fs.existsSync(path)) return {};
  const s = fs.readFileSync(path, 'utf8');
  const g = (k) => { const m = s.match(new RegExp(`(?:^|\\s)${k.replace(/\./g, '\\.')}=(\\d+)`)); return m ? Number(m[1]) : undefined; };
  const keys = ['tLaunch0', 'tLaunch1', 'tVisible', 'tTap0', 't.L0.js.start', 't.Lp.conversation.typefaceReady', 't.Lp.door.layout',
    't.L0.door.touch', 't.L1.door.pressedCommit', 't.L5.timelineRail.layout'];
  const f = {};
  for (const k of keys) f[k] = g(k);
  const gaps = [...s.matchAll(/(\d+):gap(\d+)@(\d+)/g)].map((m) => ({ ms: Number(m[2]), at: Number(m[3]) }));
  const screen = s.match(/screen=(\S+) runnerScreen=(\d+)/);
  return { f, gaps, screen: screen ? `${screen[1]} (runner ${screen[2]})` : 'unknown' };
}
function tocStart(path) {
  if (!path || !fs.existsSync(path)) return { epoch: NaN, raw: 'none' };
  const s = fs.readFileSync(path, 'utf8');
  const m = s.match(/<start-date>([^<]+)<\/start-date>/);
  return m ? { epoch: Date.parse(m[1]), raw: m[1] } : { epoch: NaN, raw: 'none' };
}

function topCounts(list, keyFn, n) {
  const c = new Map();
  for (const x of list) for (const k of keyFn(x)) c.set(k, (c.get(k) ?? 0) + x.ms);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}
const fmt = (v) => (Number.isFinite(v) ? Math.round(v) : 'n/a');

await readXml(tpPath);
const L = [];
L.push(`rows read ${rows}; samples of the app process ${samples.length} (process filter "${procName}")`);
if (!samples.length) {
  const seen = new Set();
  L.push('NO SAMPLES FOR THE PROCESS. Fix the filter; the export has no matching process.');
  fs.writeFileSync(`${out}-summary.txt`, `${L.join('\n')}\n`);
  console.log(L.join('\n'));
  process.exit(0);
}
samples.sort((a, b) => a.t - b.t);
const t0 = samples[0].t; // the first sample of the process: its launch, in trace time
const procLabel = samples[0].proc;
const { f = {}, gaps = [], screen } = boardFacts(boardPath);
const toc = tocStart(tocPath);
L.push(`process ${procLabel}; first sample at trace ${fmt(t0)} ms; last at ${fmt(samples[samples.length - 1].t)} ms`);
L.push(`toc start-date ${toc.raw}; recording reported started at ${Number.isFinite(started) ? started : 'n/a'} (epoch ms); board screen ${screen}`);

// Anchors: epoch ms → trace ms.
const anchors = {};
if (Number.isFinite(toc.epoch)) anchors['A toc start-date'] = (e) => e - toc.epoch;
if (Number.isFinite(started)) anchors['B recording started'] = (e) => e - started;
// C (coarse): the first sample of the process is taken as XCUITest's launch request.
if (f.tLaunch0) anchors['C process start = tLaunch0'] = (e) => e - f.tLaunch0 + t0;
// D: the first main-thread touch dispatch after the tap is the board's native touch at the root.
const touchSample = f.tTap0 ? samples.find((s) => s.main && s.frames.some((x) => /sendEvent:|_UIApplicationHandleEventQueue|UITouchesEvent|handleHIDEvent/.test(x))
  && (!anchors['A toc start-date'] || s.t > anchors['A toc start-date'](f.tTap0) - 5000)) : undefined;
if (touchSample && f['t.L0.door.touch']) anchors['D touch dispatch = L0.door.touch'] = (e) => e - f['t.L0.door.touch'] + touchSample.t;

L.push('');
L.push('== board (epoch ms → ms after the process start, per anchor) ==');
L.push(['mark', 'epoch', ...Object.keys(anchors)].join('\t'));
for (const [k, v] of Object.entries(f)) {
  if (!v) { L.push(`${k}\tnone`); continue; }
  L.push([k, v, ...Object.values(anchors).map((a) => fmt(a(v) - t0))].join('\t'));
}
L.push(`JS heartbeat gaps > 100 ms: ${gaps.map((g) => `${g.ms} ms at epoch ${g.at}`).join(', ') || 'none'}`);

// Timeline of CPU by thread class, per bin.
const cls = (s) => (s.main ? 'main' : /JavaScript|hermes|js thread/i.test(s.thread) ? 'js' : /RCTSurface|Fabric|layout|mount/i.test(s.thread) ? 'fabric' : 'other');
const endT = Math.min(samples[samples.length - 1].t, t0 + 60000);
const bins = [];
for (let b = t0; b < endT; b += BIN) bins.push({ b, main: 0, js: 0, fabric: 0, other: 0 });
for (const s of samples) {
  const i = Math.floor((s.t - t0) / BIN);
  if (i >= 0 && i < bins.length) bins[i][cls(s)] += s.ms;
}
L.push('');
L.push(`== CPU per ${BIN} ms bin after the process start (ms of samples: main / js / fabric / other) ==`);
for (const x of bins) {
  if (x.main + x.js + x.fabric + x.other === 0) continue;
  L.push(`+${String(Math.round(x.b - t0)).padStart(6)}  main ${fmt(x.main)}\tjs ${fmt(x.js)}\tfabric ${fmt(x.fabric)}\tother ${fmt(x.other)}`);
}

// The longest main-thread busy stretch (bins ≥ 70 % busy, gaps of one bin tolerated).
let best = null, cur = null, miss = 0;
for (const x of bins) {
  if (x.main >= 0.7 * BIN) { if (!cur) cur = { from: x.b, to: x.b + BIN }; else cur.to = x.b + BIN; miss = 0; }
  else if (cur && miss < 1) { miss += 1; }
  else if (cur) { if (!best || cur.to - cur.from > best.to - best.from) best = cur; cur = null; miss = 0; }
}
if (cur && (!best || cur.to - cur.from > best.to - best.from)) best = cur;

function windowReport(title, from, to) {
  const inW = samples.filter((s) => s.t >= from && s.t < to);
  const main = inW.filter((s) => s.main);
  L.push('');
  L.push(`== ${title}: +${fmt(from - t0)} … +${fmt(to - t0)} ms after the process start (${fmt(to - from)} ms) ==`);
  const perThread = topCounts(inW, (s) => [s.thread], 12);
  L.push(`per thread (ms): ${perThread.map(([k, v]) => `${k} ${fmt(v)}`).join('; ')}`);
  L.push(`main thread: ${fmt(main.reduce((a, s) => a + s.ms, 0))} ms of samples`);
  L.push('-- main thread, top leaf frames (self) --');
  for (const [k, v] of topCounts(main, (s) => [s.frames[0] ?? '?'], 25)) L.push(`${fmt(v)}\t${k}`);
  L.push('-- main thread, top inclusive frames (once per sample) --');
  for (const [k, v] of topCounts(main, (s) => new Set(s.frames), 60)) L.push(`${fmt(v)}\t${k}`);
  L.push('-- main thread, heaviest stacks (leaf first, 30 frames) --');
  for (const [k, v] of topCounts(main, (s) => [s.frames.slice(0, 30).join('\n      ')], 8)) L.push(`${fmt(v)} ms\n      ${k}`);
  L.push('-- all app threads, top inclusive frames --');
  for (const [k, v] of topCounts(inW, (s) => new Set(s.frames), 30)) L.push(`${fmt(v)}\t${k}`);
  return main;
}

if (best) {
  const main = windowReport('LONGEST MAIN-THREAD BUSY STRETCH', best.from, best.to);
  const folded = new Map();
  for (const s of main) { const k = [...s.frames].reverse().join(';'); folded.set(k, (folded.get(k) ?? 0) + s.ms); }
  fs.writeFileSync(`${out}-busy.folded`, [...folded.entries()].map(([k, v]) => `${k} ${Math.round(v)}`).join('\n'));
} else L.push('\nno main-thread busy stretch (≥ 70 % of a bin) found');

const wFrom = f['t.Lp.conversation.typefaceReady'], wTo = f['t.Lp.door.layout'];
if (wFrom && wTo) {
  for (const [name, a] of Object.entries(anchors)) windowReport(`BOARD WINDOW typefaceReady → door.layout, anchor ${name}`, a(wFrom), a(wTo));
}
if (f.tTap0 && f['t.L1.door.pressedCommit']) {
  for (const [name, a] of Object.entries(anchors)) windowReport(`TAP → pressedCommit, anchor ${name}`, a(f.tTap0), a(f['t.L1.door.pressedCommit']));
}
fs.writeFileSync(`${out}-summary.txt`, `${L.join('\n')}\n`);
console.log(L.slice(0, 40).join('\n'));
