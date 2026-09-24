// G3.2 verification. Every check is computed from EVIDENCE — rendered captures (and their audits), the G3.1 baseline
// captures from G3.1's byte-identical rebuild, the motion truth logs, the real-input live run, the built page and the
// canonical records — never from the source's intentions. Each check is a pure function of one input object, so
// tools/probes.mjs can hand it planted-defect evidence (captures of PLANTED BUILDS) and require a FAIL.
// usage: node tools/checks.mjs [--proto <dir>] [--no-git]   → <PKG>/data/CHECKS.json + STATE_MATRIX.json (exit 1 on any fail)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SOURCE, PKG, WORK } from './lib/session.mjs';
import { decode } from './lib/png.mjs';

const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const PROTO = arg('--proto') || join(PKG, 'prototype');
const NOGIT = process.argv.includes('--no-git');
export const sha = (b) => createHash('sha256').update(b).digest('hex');
const rdj = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const BASELINE = 'da4cf0c9ebcb573f8f186f60b6affbf8a4bd6752';

/* ------------------------------------------------------------------------------------------ pixels */
const pngCache = new Map();
function png(rec, file) { const p = join(rec.dir, file); if (!pngCache.has(p)) pngCache.set(p, decode(readFileSync(p))); return pngCache.get(p); }
/** The world alone of two captures, pixel for pixel. */
export function worldDiff(I, a, b) {
  const A = png(I.snaps[a], I.snaps[a].world), B = png(I.snaps[b], I.snaps[b].world);
  if (A.width !== B.width || A.height !== B.height) return { differing: -1, of: 0 };
  let d = 0; const n = A.width * A.height;
  for (let i = 0; i < n; i++) { const o = i * 4; if (A.rgba[o] !== B.rgba[o] || A.rgba[o + 1] !== B.rgba[o + 1] || A.rgba[o + 2] !== B.rgba[o + 2]) d++; }
  return { differing: d, of: n };
}
const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const cssL = (css) => { const m = css.match(/[\d.]+/g).map(Number); return L(m[0], m[1], m[2]); };
const ratio = (a, b) => { const [x, y] = [a, b].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** Legibility of an element's ink against the ground actually painted behind it: the same frame with the element
    hidden, its box sampled at 2×. The worst of the 5th / 95th luminance percentile is the binding ground. */
export function legibility(I, id, sel) {
  const s = I.snaps[id], bg = s.bg && s.bg[sel]; if (!bg) return null;
  const P = png(s, bg.file), b = bg.box, lum = [];
  for (let y = Math.max(0, Math.floor(b.y * 2)); y < Math.min(P.height, Math.ceil((b.y + b.h) * 2)); y++)
    for (let x = Math.max(0, Math.floor(b.x * 2)); x < Math.min(P.width, Math.ceil((b.x + b.w) * 2)); x++) { const o = (y * P.width + x) * 4; lum.push(L(P.rgba[o], P.rgba[o + 1], P.rgba[o + 2])); }
  lum.sort((p, q) => p - q);
  const p5 = lum[Math.floor(lum.length * 0.05)], p95 = lum[Math.floor(lum.length * 0.95)], ink = cssL(b.ink);
  return { id, sel, ink: b.ink, groundP5: +p5.toFixed(4), groundP95: +p95.toFixed(4), ratio: +Math.min(ratio(ink, p5), ratio(ink, p95)).toFixed(2) };
}
/** Mean luminance of a region of a capture (the shell's own ground). */
function regionL(I, id, box) {
  const s = I.snaps[id], P = png(s, s.file); let sum = 0, n = 0;
  for (let y = Math.floor(box.y * 2); y < Math.ceil((box.y + box.h) * 2); y++) for (let x = Math.floor(box.x * 2); x < Math.ceil((box.x + box.w) * 2); x++) { const o = (y * P.width + x) * 4; sum += L(P.rgba[o], P.rgba[o + 1], P.rgba[o + 2]); n++; }
  return +(sum / n).toFixed(4);
}

/* ------------------------------------------------------------------------------------------ inputs */
export function loadInputs(work = WORK) {
  const html = readFileSync(join(PROTO, 'index.html'), 'utf8');
  const deps = rdj(join(SOURCE, 'CANON_DEPENDENCIES.json'));
  const snaps = rdj(join(work, 'snaps', 'index.json'));
  for (const s of Object.values(snaps)) s.dir = join(work, 'snaps');
  const clips = Object.fromEntries(readdirSync(join(PKG, 'data', 'motion')).filter((f) => f.endsWith('.truth.json')).map((f) => [f.replace('.truth.json', ''), rdj(join(PKG, 'data', 'motion', f))]));
  const live = rdj(join(PKG, 'data', 'LIVECHECK.json'));
  const upstream = rdj(join(PKG, 'data', 'UPSTREAM.json'));
  const vendored = Object.fromEntries(deps.canonical.map((f) => [f.vendored, sha(readFileSync(join(SOURCE, f.vendored)))]));
  const productCopy = readFileSync(join(SOURCE, 'vendor', 'canon', 'product-copy.ts'), 'utf8');
  const worldB64 = (html.match(/"b64":"([A-Za-z0-9+/=]+)"/) || [])[1] || '';
  let git = null;
  if (!NOGIT) try {
    const repo = join(SOURCE, '..', '..', '..');
    const g = (a) => execFileSync('git', ['-C', repo, ...a], { maxBuffer: 1 << 26 }).toString();
    git = { originMain: g(['rev-parse', 'origin/main']).trim(), tracked: g(['status', '--porcelain', '--untracked-files=no']).trim().split('\n').filter(Boolean),
      branch: g(['branch', '--show-current']).trim(), g32Branches: g(['branch', '-a', '--list', '*g3.2*', '*g32*']).trim(),
      blobs: Object.fromEntries(deps.canonical.map((f) => [f.canonical, g(['rev-parse', `${deps.baseline}:${f.canonical}`]).trim()])) };
  } catch (e) { git = { error: String(e.message).slice(0, 200) }; }
  return { html, deps, snaps, clips, live, upstream, vendored, productCopy, worldB64, git };
}

/* ------------------------------------------------------------------------------------------ helpers */
const ORDER = ['BACK_ONE_STEP', 'EXACT_RETURN', 'RETURN_LIVE_HEAD', 'RETURN_LIVE_FOCUS', 'RETURN_WORLD', 'GO_LIVE_AND_LOCATE'];
const g32 = (I) => Object.values(I.snaps).filter((s) => s.build === 'g32');
const analysis = (I) => g32(I).filter((s) => s.truth.place === 'analysis');
const texts = (s) => s.audit.text.filter((t) => !t.status).map((t) => t.text);
const ctxOf = (s) => s.audit.text.filter((t) => t.where === 'tl-ctx');
const ctxBox = (s) => { const t = ctxOf(s); if (!t.length) return null; const y = Math.min(...t.map((x) => x.box.y)), b = Math.max(...t.map((x) => x.box.y + x.box.h)); return { y, b, x: Math.min(...t.map((x) => x.box.x)), r: Math.max(...t.map((x) => x.box.x + x.box.w)) }; };
const liveStep = (I, j, frag) => I.live.steps.find((s) => s.journey === j && s.step.includes(frag));
const TEMPORAL = /أنت عند اللحظة|استمرت المحادثة|نظرة مؤقتة|Reading at moment|has continued since|A temporary look/;
const pairs = [['g31-far', 'far'], ['g31-mid', 'mid'], ['g31-near', 'near'], ['g31-pinned', 'pinned'], ['g31-call', 'call']];
/** Where the world region ends: the top of the highest support element (the temporal line, else the Timeline row). */
const worldH = (s) => { const tl = s.audit.regions.timeline; if (!tl) return null; const c = ctxBox(s); return Math.min(c ? c.y : Infinity, tl.y - 44) - 95; };

/* ------------------------------------------------------------------------------------------ checks */
export const CHECKS = [
  // ---------------------------------------------------------------- baseline / canon
  ['K01', 'baseline', 'origin/main is the brief\'s expected canonical SHA', (I) => {
    if (!I.git || I.git.error) return { pass: false, evidence: 'git unavailable: ' + (I.git && I.git.error) };
    return { pass: I.git.originMain === BASELINE && I.deps.baseline === BASELINE, evidence: { originMain: I.git.originMain, expected: BASELINE } };
  }],
  ['K02', 'baseline', 'G3.1 is the immutable upstream: its ZIP identity holds, and its reviewed prototype rebuilds byte-identically from the vendored G3.1 inputs', (I) => {
    const u = I.upstream;
    const zip = u.g31Zip && u.g31Zip.present !== false ? u.g31Zip.equalsReviewedIdentity && u.g31Zip.manifestEntryEqualsVendored : true;
    return { pass: u.problems.length === 0 && u.rebuiltG31.byteIdenticalToReviewedG31 && u.vendoredInputs.every((v) => v.equal) && u.sharedFilesChecked >= 70 && zip,
      evidence: { g31Zip: u.g31Zip, g31PrototypeRebuilt: u.rebuiltG31.sha256, vendoredInputs: u.vendoredInputs.map((v) => `${v.file} ${v.equal ? '= G3.1 MANIFEST' : 'DIFFERS'}`), sharedUnchanged: u.sharedFilesChecked } };
  }],
  ['K03', 'world', 'The I-08B1 world is byte-exact: vendored = pin = main blob = the bytes inlined in the G3.2 prototype', (I) => {
    const w = I.deps.canonical.find((f) => f.vendored.endsWith('wf-living-constellation.html'));
    const inl = sha(Buffer.from(I.worldB64, 'base64'));
    return { pass: w.sha256.toUpperCase() === I.deps.worldPin && I.vendored[w.vendored] === w.sha256 && inl === w.sha256 && (!I.git || !!I.git.error || I.git.blobs[w.canonical] === w.blob),
      evidence: { pin: I.deps.worldPin, vendored: I.vendored[w.vendored], inlined: inl, blob: w.blob } };
  }],
  ['K04', 'baseline', 'Every vendored canonical record equals its main blob (none modified)', (I) => {
    const bad = I.deps.canonical.filter((f) => I.vendored[f.vendored] !== f.sha256 || (I.git && !I.git.error && I.git.blobs[f.canonical] !== f.blob)).map((f) => f.vendored);
    return { pass: bad.length === 0 && I.deps.canonical.length >= 30, evidence: { files: I.deps.canonical.length, differing: bad } };
  }],
  ['K05', 'baseline', 'No repository change: no tracked file modified, no G3.2 branch', (I) => {
    if (!I.git || I.git.error) return { pass: false, evidence: 'git unavailable' };
    return { pass: I.git.tracked.length === 0 && I.git.g32Branches === '', evidence: { trackedChanges: I.git.tracked.length, branch: I.git.branch, g32Branches: I.git.g32Branches || 'none' } };
  }],
  // ---------------------------------------------------------------- the world: zero change
  ['K06', 'world', 'World pixels identical to the G3.1 baseline at the same state: FAR, MID, NEAR, PINNED(14), in a call', (I) => {
    const r = pairs.map(([a, b]) => ({ pair: `${a} ↔ ${b}`, ...worldDiff(I, a, b) }));
    return { pass: r.every((x) => x.differing === 0 && x.of > 0), evidence: r.map((x) => `${x.pair}: ${x.differing} / ${x.of}`) };
  }],
  ['K07', 'world', 'The same dark world under system Light and Reduced Motion — no repaint, no veil (world alone, 0 px)', (I) => {
    const r = [['far', 'light-far'], ['near', 'light-near'], ['pinned', 'light-pinned'], ['call', 'light-call'], ['far', 'rm-light-far'], ['pinned', 'rm-pinned']].map(([a, b]) => ({ pair: `${a} ↔ ${b}`, ...worldDiff(I, a, b) }));
    return { pass: r.every((x) => x.differing === 0 && x.of > 0), evidence: r.map((x) => `${x.pair}: ${x.differing} / ${x.of}`) };
  }],
  ['K08', 'world', 'No new world object, relation, candidate, badge, marker or veil: world state equals G3.1\'s at every paired state', (I) => {
    const r = pairs.map(([a, b]) => ({ pair: `${a} ↔ ${b}`, same: JSON.stringify(I.snaps[a].truth.world) === JSON.stringify(I.snaps[b].truth.world) && JSON.stringify(I.snaps[a].truth.fired) === JSON.stringify(I.snaps[b].truth.fired) }));
    const veil = /#(stage-clip|world-frame|world-layer)[^{]*\{[^}]*(filter|mix-blend)/.test(I.html.split('<body')[0]);
    return { pass: r.every((x) => x.same) && !veil, evidence: { pairs: r, cssFilterOnTheWorld: veil } };
  }],
  // ---------------------------------------------------------------- Decision B
  ['K09', 'decision-B', 'PINNED / preview: the temporal line stands DIRECTLY above the Track, in the Timeline cluster, at every size and language', (I) => {
    const rows = analysis(I).filter((s) => s.truth.ctxLines.length).map((s) => {
      const c = ctxBox(s), tl = s.audit.regions.timeline, live = s.audit.regions.liveEdge;
      const gap = c ? +(tl.y - c.b).toFixed(1) : null;
      return { id: s.id, gap, ok: !!c && c.b <= tl.y + 0.5 && gap <= 20 && (s.truth.TM !== 'PINNED' || (live && c.b <= live.y + 1)) && (!s.audit.regions.band || c.b <= s.audit.regions.band.y) };
    });
    return { pass: rows.length >= 12 && rows.every((r) => r.ok), evidence: { captures: rows.length, failing: rows.filter((r) => !r.ok), gaps: [...new Set(rows.map((r) => r.gap))] } };
  }],
  ['K10', 'decision-B', 'One truth, said once: no temporal sentence in OrientationChrome; the line\'s words are T-08\'s and appear once', (I) => {
    // the temporal words may be visible ONLY inside the line (#tl-ctx); anywhere else they would be a second truth
    const bad = analysis(I).filter((s) => s.truth.bandLines.some((l) => TEMPORAL.test(l)) || s.audit.text.some((t) => !t.status && t.where !== 'tl-ctx' && TEMPORAL.test(t.text)) || ctxOf(s).length !== s.truth.ctxLines.length).map((s) => s.id);
    const words = analysis(I).flatMap((s) => s.truth.ctxLines).filter((l) => !I.productCopy.includes(l.replace(/\d+/g, '')) && !/^(أنت عند اللحظة|Reading at moment|نظرة مؤقتة|A temporary look)/.test(l));
    return { pass: bad.length === 0 && words.length === 0, evidence: { duplicated: bad, notT08: words } };
  }],
  ['K11', 'decision-B', 'Only when context genuinely exists: no temporal row (and no gap) in LIVE, NEAR, in a call; OrientationChrome at NEAR is G3.1\'s', (I) => {
    const live = analysis(I).filter((s) => s.truth.TM === 'FOLLOW_LIVE' && s.truth.PTC == null);
    const stale = live.filter((s) => s.truth.ctxLines.length || ctxOf(s).length).map((s) => s.id);
    // no gap: the Timeline sits exactly where G3.1 put it when there is no temporal context
    const same = [['g31-far', 'far'], ['g31-near', 'near'], ['g31-mid', 'mid'], ['g31-call', 'call']].map(([a, b]) => ({ pair: b, tlY: [I.snaps[a].audit.regions.timeline.y, I.snaps[b].audit.regions.timeline.y],
      band: [I.snaps[a].truth.bandLines.join('|'), I.snaps[b].truth.bandLines.join('|')], ok: I.snaps[a].audit.regions.timeline.y === I.snaps[b].audit.regions.timeline.y && I.snaps[a].truth.bandLines.join('|') === I.snaps[b].truth.bandLines.join('|') }));
    const ret = I.snaps['pinned-return-live'];
    return { pass: live.length >= 10 && stale.length === 0 && same.every((x) => x.ok) && ret.truth.TM === 'FOLLOW_LIVE' && !ctxOf(ret).length,
      evidence: { liveCaptures: live.length, staleLine: stale, unchangedFromG31: same, afterReturnLive: { TM: ret.truth.TM, line: ctxOf(ret).map((t) => t.text) } } };
  }],
  ['K12', 'decision-B', 'T-08 untouched: offered, dominant, direct, grouped and rendered Return sets equal G3.1\'s; rendered ⊆ offered; no act twice', (I) => {
    const k = (t) => JSON.stringify([t.offered, t.dominant, t.direct, t.grouped, t.rendered]);
    const eq = [['g31-pinned', 'pinned'], ['g31-pinned-open', 'pinned-open'], ['g31-near', 'near'], ['g31-mid', 'mid'], ['g31-far', 'far'], ['g31-call', 'call']].map(([a, b]) => ({ pair: b, same: k(I.snaps[a].truth) === k(I.snaps[b].truth) }));
    const extra = g32(I).filter((s) => s.truth.rendered.some((r) => !s.truth.offered.includes(r.replace('LIVE_EDGE:', '')))).map((s) => s.id);
    const dup = g32(I).filter((s) => { const acts = s.truth.rendered.map((r) => r.replace('LIVE_EDGE:', '')), ctl = s.audit.controls.filter((c) => c.act).map((c) => c.act); return new Set(acts).size !== acts.length || new Set(ctl).size !== ctl.length; }).map((s) => s.id);
    const liveEdge = analysis(I).filter((s) => s.truth.TM === 'PINNED' && s.truth.PTC == null).every((s) => s.truth.rendered.includes('LIVE_EDGE:RETURN_LIVE_HEAD'));
    return { pass: eq.every((x) => x.same) && extra.length === 0 && dup.length === 0 && liveEdge, evidence: { equalToG31: eq, renderedNotOffered: extra, duplicated: dup, returnLiveAtLiveEdge: liveEdge } };
  }],
  ['K13', 'decision-B', '«طرق العودة» stays Return-only: T-08 words, T-08 order, expanded-state truth', (I) => {
    const open = analysis(I).filter((s) => s.truth.moreOpen);
    const bad = open.filter((s) => { const d = s.truth.rendered.filter((r) => !r.startsWith('LIVE_EDGE:') && r !== s.truth.dominant); return JSON.stringify(d) !== JSON.stringify(s.truth.grouped) || !d.every((a, i) => i === 0 || ORDER.indexOf(a) > ORDER.indexOf(d[i - 1])) || !s.audit.controls.filter((c) => c.act).every((c) => I.productCopy.includes(c.name)); }).map((s) => s.id);
    const trig = open.every((s) => s.audit.controls.some((c) => c.id === 'more-t' && c.expanded === 'true' && c.name === (s.lang === 'ar' ? 'طرق العودة' : 'Ways back')));
    const closed = analysis(I).filter((s) => !s.truth.moreOpen && s.truth.grouped.length).every((s) => s.audit.controls.some((c) => c.id === 'more-t' && c.expanded === 'false'));
    return { pass: open.length >= 6 && bad.length === 0 && trig && closed, evidence: { open: open.length, failing: bad, expandedTrueWhenOpen: trig, expandedFalseWhenClosed: closed } };
  }],
  ['K14', 'decision-B', 'The world is still sized first: ≥ max(160, usable / 2) in every Analysis capture — the line is paid for by the support, never by the world', (I) => {
    const rows = analysis(I).filter((s) => s.audit.regions.timeline).map((s) => { const usable = s.h - 95 - 90 - (s.truth.call !== 'none' ? 64 : 0), floor = Math.max(160, usable / 2), h = worldH(s); return { id: s.id, size: `${s.w}x${s.h}`, worldH: +h.toFixed(1), floor, ok: h + 0.5 >= floor }; });
    const tight = rows.slice().sort((a, b) => (a.worldH - a.floor) - (b.worldH - b.floor)).slice(0, 3);
    return { pass: rows.length >= 30 && rows.every((r) => r.ok) && rows.some((r) => r.id === 's320-call-pinned-open'), evidence: { captures: rows.length, failing: rows.filter((r) => !r.ok), tightest: tight } };
  }],
  ['K15', 'decision-B', '320 × 568: the primary temporal meaning (line + Return Live) is never inside the scroller; «طرق العودة» is reachable in OrientationChrome\'s own room', (I) => {
    const rows = analysis(I).filter((s) => s.w === 320 && s.truth.ctxLines.length).map((s) => {
      const c = ctxBox(s), live = s.audit.controls.find((x) => x.act === 'RETURN_LIVE_HEAD'), band = s.audit.regions.band, more = s.audit.controls.find((x) => x.id === 'more-t');
      const inPhone = (b) => b.y >= 0 && b.y + b.h <= s.h;
      return { id: s.id, ok: !!c && c.y >= 95 && !!live && inPhone(live.box) && (!band || (c.b <= band.y && live.box.y + live.box.h <= band.y + 1)) && !!more && more.box.y >= band.y - 1 && more.box.y + more.box.h <= band.y + band.h + 1 };
    });
    const clip = I.clips['05-stress-320-disclosure-reachability'], go = clip && clip.log.find((x) => x.act === 'GO_LIVE_AND_LOCATE');
    return { pass: rows.length >= 4 && rows.every((r) => r.ok) && !!go && go.truth.TM === 'FOLLOW_LIVE', evidence: { captures: rows, lastDisclosedActReachedAndPressed: go && { TM: go.truth.TM, TC: go.truth.TC } } };
  }],
  ['K16', 'decision-B', '430 × 932: more of the same world at the same scale; the support is the SAME size, not a larger dashboard', (I) => {
    const a = I.snaps.pinned, b = I.snaps['l430-pinned'], ao = I.snaps['pinned-open'], bo = I.snaps['l430-pinned-open'];
    const sameScale = a.truth.window.unitsPerPt === b.truth.window.unitsPerPt && b.truth.window.visibleW > a.truth.window.visibleW;
    const sup = (s) => { const c = ctxBox(s), band = s.audit.regions.band; return +(band.y + band.h - c.y).toFixed(1); };
    return { pass: sameScale && sup(a) === sup(b) && sup(ao) === sup(bo) && worldH(b) > worldH(a), evidence: { unitsPerPt: [a.truth.window.unitsPerPt, b.truth.window.unitsPerPt], visibleW: [a.truth.window.visibleW, b.truth.window.visibleW], supportHeight: { pinned: [sup(a), sup(b)], open: [sup(ao), sup(bo)] }, worldH: [worldH(a), worldH(b)] } };
  }],
  // ---------------------------------------------------------------- Decision A
  ['K17', 'decision-A', 'System Light: the Analysis shell is dark (status row, rail, call line, ground); Conversation, proposal follow the system', (I) => {
    const rail = (s) => regionL(I, s.id, { x: 0, y: s.h - 90, w: s.w, h: 56 }), statusRow = (s) => regionL(I, s.id, { x: 0, y: 0, w: s.w, h: 47 });
    const ana = ['light-far', 'light-pinned', 'light-pinned-open', 'light-call', 'light-call-back', 'light-replay', 's320-light-call-pinned', 'en-light-call'].map((id) => I.snaps[id]);
    const sys = ['light-conv', 'light-call-conv', 'light-prop'].map((id) => I.snaps[id]);
    const a = ana.map((s) => ({ id: s.id, rail: rail(s), status: statusRow(s), shellDark: s.truth.analysisShellDark, call: s.truth.call === 'live' ? regionL(I, s.id, { x: 0, y: s.h - 154, w: s.w, h: 64 }) : null }));
    const c = sys.map((s) => ({ id: s.id, rail: rail(s), status: statusRow(s), shellDark: s.truth.analysisShellDark, call: s.truth.call === 'live' ? regionL(I, s.id, { x: 0, y: s.h - 154, w: s.w, h: 64 }) : null }));
    const ok = a.every((x) => x.rail < 0.03 && x.status < 0.03 && x.shellDark === 1 && (x.call === null || x.call < 0.05)) && c.every((x) => x.rail > 0.5 && x.status > 0.5 && x.shellDark === 0 && (x.call === null || x.call > 0.5));
    return { pass: ok && sys.every((s) => s.truth.appearance === 'light') && ana.every((s) => s.truth.appearance === 'light'), evidence: { analysisUnderLight: a, systemFollowing: c, note: 'mean relative luminance of the rendered region (0 black … 1 white)' } };
  }],
  ['K18', 'decision-A', 'Status-region legibility: ink vs the ground actually behind it ≥ 4.5:1 on every surface, both appearances (the G3.1 fixture-B failure is gone)', (I) => {
    const ids = g32(I).filter((s) => s.bg && s.bg['#status']).map((s) => s.id);
    const r = ids.map((id) => legibility(I, id, '#status'));
    const b = I.snaps['g31-light-far-B'] ? legibility(I, 'g31-light-far-B', '#status') : null;
    return { pass: r.length >= 8 && r.every((x) => x.ratio >= 4.5) && (!b || b.ratio < 4.5), evidence: { g32: r, g31FixtureB_forReference: b } };
  }],
  ['K19', 'decision-A', 'Surface-scoped, not an override: no appearance control or shell parameter in the Product; F2 system-follow stays the only appearance input', (I) => {
    const phones = I.html.split('<template id="tpl-').slice(1).map((p) => p.split('</template>')[0]);
    const inPhone = phones.some((p) => /data-toggle|data-shell|theme|dark mode|الوضع الداكن/i.test(p));
    const shellParam = /get\('shell'\)|data-shell|setShell/.test(I.html);
    const system = /prefers-color-scheme: light/.test(I.html) && /data-appearance-source/.test(I.html);
    return { pass: !inPhone && !shellParam && system, evidence: { productAppearanceControl: inPhone, shellFixtureRemains: shellParam, followsSystem: system } };
  }],
  ['K20', 'decision-A', 'System Light + a Live Call: Analysis (dark) → Conversation (light) → Analysis (dark), ONE call identity, no call prose', (I) => {
    const res = ['04-light-live-call-analysis-conversation-analysis', '06-light-call-reduced-motion'].map((k) => {
      const c = I.clips[k], lg = c.log, ids = new Set(lg.map((s) => s.truth.callId));
      const settled = (t0) => { const f = c.frames.filter((x) => x.t >= t0 + 400 && x.t < t0 + 1200); return f.length ? f[f.length - 1].shellDark : null; };
      return { clip: k, places: lg.map((s) => s.truth.place).join('→'), ids: [...ids], shellAfter: lg.map((s) => settled(s.t)), prose: lg.filter((s) => s.truth.call === 'live' && s.truth.lineLabel !== '').length,
        ok: lg.map((s) => s.truth.place).join() === 'analysis,conversation,analysis' && ids.size === 1 && !ids.has(null) && lg.map((s) => settled(s.t)).join() === '1,0,1' && lg.every((s) => s.truth.appearance === 'light') };
    });
    const live = ['«المحادثة» during the call', 'the SAME call, back in the dark'].map((f) => liveStep(I, 'A-LIGHT-CALL', f));
    return { pass: res.every((r) => r.ok && r.prose === 0) && live.every((s) => s && s.pass), evidence: { clips: res, realInput: live.map((s) => s && s.pass) } };
  }],
  ['K21', 'decision-A', 'The shell\'s tone change is F2\'s appearance cross-fade: ≈ 200 ms under standard motion, REMOVED (a cut) under Reduced Motion', (I) => {
    const m = (k, act) => { const c = I.clips[k], s = c.log.find((x) => x.act === act), f = c.frames.filter((x) => x.t > s.t); const mid = f.find((x) => x.shellDark > 0 && x.shellDark < 1); const done = f.find((x) => x.shellDark === (act === 'enterAnalysis' ? 1 : 0)); return { act, firstFrame: f[0] && f[0].shellDark, midVisible: !!mid, doneAfter: done ? done.t - s.t : null }; };
    const std = [m('03-light-conversation-analysis-conversation', 'enterAnalysis'), m('03-light-conversation-analysis-conversation', 'leaveAnalysis')];
    const red = [m('07-light-conversation-analysis-reduced-motion', 'enterAnalysis'), m('07-light-conversation-analysis-reduced-motion', 'leaveAnalysis')];
    // frames are sampled every 66.7 ms and the tone is read to 3 decimals: the 200 ms ease-out reads as done from its
    // 7/8 point (≈ 175 ms), so a standard change must show a mid value and settle between 140 and 270 ms; a Reduced
    // Motion change must show no mid value at all and be done on the first sample after the act
    return { pass: std.every((x) => x.midVisible && x.doneAfter >= 140 && x.doneAfter <= 270) && red.every((x) => !x.midVisible && x.doneAfter !== null && x.doneAfter <= 70),
      evidence: { standard: std, reducedMotion: red, source: 'DUR.appearance = 200 ms (F2 qandeel.appearance.switch.crossfade); blend() is a cut under Reduced Motion' } };
  }],
  // ---------------------------------------------------------------- motion
  ['K22', 'motion', 'Reduced Motion keeps the same truth at every act and the same settled Product (01↔02, 03↔07, 04↔06)', (I) => {
    const pick = (t) => JSON.stringify({ p: t.place, c: t.call, i: t.callId, m: t.TM, tc: t.TC, ptc: t.PTC, lh: t.LH, o: t.offered, d: t.direct, g: t.grouped, w: t.world, b: t.bandLines, x: t.ctxLines, a: t.appearance });
    const P = [['01-pinned-return-live', '02-pinned-return-live-reduced-motion'], ['03-light-conversation-analysis-conversation', '07-light-conversation-analysis-reduced-motion'], ['04-light-live-call-analysis-conversation-analysis', '06-light-call-reduced-motion']].map(([s, r]) => {
      const a = I.clips[s], b = I.clips[r];
      const steps = a.log.length === b.log.length && a.log.every((x, i) => pick(x.truth) === pick(b.log[i].truth) && x.t === b.log[i].t);
      const end = JSON.stringify(a.endTruth.controls) === JSON.stringify(b.endTruth.controls) && JSON.stringify(a.endAudit.text) === JSON.stringify(b.endAudit.text) && pick(a.endTruth) === pick(b.endTruth);
      return { pair: `${s} ↔ ${r}`, acts: a.log.length, equalAtEveryAct: steps, equalWhenSettled: end };
    });
    return { pass: P.every((p) => p.equalAtEveryAct && p.equalWhenSettled), evidence: P };
  }],
  ['K23', 'motion', 'The temporal line never travels on its own and never runs ahead of the truth: fixed to the Track in every frame; it exists only while the state says so', (I) => {
    const res = ['01-pinned-return-live', '02-pinned-return-live-reduced-motion', '05-stress-320-disclosure-reachability'].map((k) => {
      const f = I.clips[k].frames.filter((x) => x.ctxBottom != null && x.ctxOpacity > 0);
      const offs = [...new Set(f.map((x) => +(x.trackTop - x.ctxBottom).toFixed(1)))];
      // a line with no temporal context behind it may only be the 140 ms resolve-out right after the act that ended it
      const lastAct = (t) => Math.max(-1e9, ...I.clips[k].log.filter((s) => s.t <= t).map((s) => s.t));
      const early = I.clips[k].frames.filter((x) => x.ctxOpacity > 0 && x.ctxLines.length === 0 && x.t - lastAct(x.t) > 180);
      const ahead = I.clips[k].frames.filter((x) => x.ctxLines.some((l) => /\d+/.test(l) && +l.match(/\d+/)[0] > (x.PTC ?? x.TC)));
      return { clip: k, framesWithLine: f.length, offsetsTrackToLine: offs, lingering: early.length, futureMoment: ahead.length, ok: f.length > 10 && offs.length === 1 && early.length === 0 && ahead.length === 0 };
    });
    return { pass: res.every((r) => r.ok), evidence: res };
  }],
  ['K24', 'motion', 'Every clip decodes back to exactly the frames it was encoded from', (I) => {
    const rows = Object.values(I.clips).map((c) => ({ clip: c.clip, encoded: c.frameCount, decoded: c.decodedFrames, size: c.size, reducedMotion: c.reducedMotion }));
    return { pass: rows.length >= 5 && rows.every((r) => r.encoded > 0 && r.decoded === r.encoded), evidence: rows };
  }],
  // ---------------------------------------------------------------- accessibility / language
  ['K25', 'a11y', 'Real input: focus order = visual order, the line read before the slider, expanded state, focus return, ≥ 44 pt, Return Live by a press', (I) => {
    const need = ['reading / DOM order', 'Tab order: Timeline', 'aria-expanded true', 'Tab reaches the first disclosed act', 'Escape closes it', '≥ 44 × 44 pt', 'a press on the Live edge', 'focus is not dropped onto the page', 'box and focus ring do not overlap'];
    const got = need.map((f) => { const s = I.live.steps.find((x) => x.step.includes(f)); return { f, pass: !!s && s.pass }; });
    return { pass: got.every((x) => x.pass) && I.live.failed === 0, evidence: { steps: got, liveRun: `${I.live.passed}/${I.live.total}` } };
  }],
  ['K26', 'a11y', 'The temporal line is legible on the world (ink vs the ground behind it ≥ 4.5:1), Arabic line-height ≥ 1.6, no letter-spacing', (I) => {
    const ids = g32(I).filter((s) => s.bg && s.bg['#tl-ctx']).map((s) => s.id), r = ids.map((id) => legibility(I, id, '#tl-ctx'));
    const typo = analysis(I).flatMap((s) => ctxOf(s)).every((t) => t.lh >= 1.6 && (t.letterSpacing === 'normal' || t.letterSpacing === '0px'));
    return { pass: r.length >= 6 && r.every((x) => x.ratio >= 4.5) && typo, evidence: { legibility: r, lineHeightAndSpacing: typo } };
  }],
  ['K27', 'language', 'Bidi and sides hold: English line starts LEFT with the Live edge RIGHT; speaker sides and paragraph direction unchanged from G3.1', (I) => {
    const en = I.snaps['en-pinned'], c = ctxBox(en), live = en.audit.regions.liveEdge;
    const ar = I.snaps.pinned, ca = ctxBox(ar), la = ar.audit.regions.liveEdge;
    const xa = I.snaps['ar-conv-cross'].audit.text.find((t) => t.text === 'The numbers land tomorrow morning'), xe = I.snaps['en-conv-cross'].audit.text.find((t) => t.text === 'الأرقام هتوصل بكرة الصبح');
    const cx = (t) => t.box.x + t.box.w / 2;
    return { pass: !!c && c.x <= 26 && live.x + live.w >= 380 && !!ca && ca.r >= 364 && la.x <= 10 && xa && xa.dir === 'ltr' && cx(xa) > 195 && xe && xe.dir === 'rtl' && cx(xe) < 195,
      evidence: { english: { lineStartX: c && c.x, liveEdgeRight: live.x + live.w }, arabic: { lineStartRight: ca && ca.r, liveEdgeLeft: la.x }, crossScript: { arUI_enLine: xa && xa.dir, enUI_arLine: xe && xe.dir } } };
  }],
  ['K28', 'harness', 'Captures are Product only; the harness is labelled "PROOF HARNESS — NOT PRODUCT UI" and shows no Q-LIGHT-SHELL switch', (I) => {
    const leak = g32(I).filter((s) => texts(s).some((t) => /PROOF|HARNESS|fixture|SHA-256/.test(t))).map((s) => s.id);
    return { pass: leak.length === 0 && /PROOF HARNESS — NOT PRODUCT UI/.test(I.html) && !/Q-LIGHT-SHELL — OPEN/.test(I.html), evidence: { harnessInCaptures: leak } };
  }],
  ['K29', 'rebuild', 'Source-only rebuild: this source tree rebuilds the checked prototype byte-identically', (I) => {
    const T = join(WORK, 'check-rebuild'); rmSync(T, { recursive: true, force: true }); mkdirSync(T, { recursive: true });
    cpSync(join(SOURCE, 'src'), join(T, 'source', 'src'), { recursive: true }); cpSync(join(SOURCE, 'vendor'), join(T, 'source', 'vendor'), { recursive: true });
    const b = spawnSync(process.execPath, ['src/build.mjs', join(T, 'out')], { cwd: join(T, 'source'), encoding: 'utf8' });
    const got = existsSync(join(T, 'out', 'index.html')) ? sha(readFileSync(join(T, 'out', 'index.html'))) : null, want = sha(Buffer.from(I.html));
    return { pass: b.status === 0 && got === want, evidence: { checked: want, rebuilt: got } };
  }],
];

/* ------------------------------------------------------------------------------------------ run */
export function runChecks(I) {
  return CHECKS.map(([id, group, title, fn]) => { let r; try { r = fn(I); } catch (e) { r = { pass: false, evidence: 'threw: ' + e.message }; } return { id, group, title, pass: !!r.pass, evidence: r.evidence }; });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const I = loadInputs();
  const results = runChecks(I);
  for (const r of results) console.log(r.pass ? 'PASS' : 'FAIL', r.id, r.title, r.pass ? '' : JSON.stringify(r.evidence).slice(0, 600));
  const probes = existsSync(join(PKG, 'data', 'PROBES.json')) ? rdj(join(PKG, 'data', 'PROBES.json')) : null;
  const matrix = g32(I).map((s) => ({ id: s.id, state: s.state, lang: s.lang, scheme: s.scheme, size: `${s.w}x${s.h}`, reducedMotion: s.rm, acts: s.acts, place: s.truth.place, TM: s.truth.TM, TC: s.truth.TC, PTC: s.truth.PTC, LH: s.truth.LH,
    call: s.truth.call, callId: s.truth.callId, analysisShellDark: s.truth.analysisShellDark, offered: s.truth.offered, dominant: s.truth.dominant, direct: s.truth.direct, grouped: s.truth.grouped, moreOpen: s.truth.moreOpen,
    rendered: s.truth.rendered, ctxLines: s.truth.ctxLines, bandLines: s.truth.bandLines, room: s.truth.room, worldH: worldH(s), controls: s.audit.controls.map((c) => ({ id: c.id || c.act || c.world || c.scope, name: c.name, expanded: c.expanded })), visibleText: texts(s) }));
  const passed = results.filter((r) => r.pass).length;
  writeFileSync(join(PKG, 'data', 'CHECKS.json'), JSON.stringify({ prototype: { path: 'prototype/index.html', sha256: sha(Buffer.from(I.html)) }, checks: results.length, passed, results,
    probes: probes && { total: probes.total, rejected: probes.rejected }, live: { total: I.live.total, passed: I.live.passed } }, null, 1));
  writeFileSync(join(PKG, 'data', 'STATE_MATRIX.json'), JSON.stringify({ captures: matrix.length, states: matrix }, null, 1));
  console.log(`\n${passed}/${results.length} checks pass`);
  process.exit(passed === results.length ? 0 : 1);
}
