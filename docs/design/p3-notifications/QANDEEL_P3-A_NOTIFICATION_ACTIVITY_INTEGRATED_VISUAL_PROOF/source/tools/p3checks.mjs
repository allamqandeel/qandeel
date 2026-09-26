// P3-A — the proof's deterministic checks (task §21) and its planted defects.
//
// Two kinds of evidence are checked: the Product-behaviour MODEL (src/model.mjs, the same code the page runs) and the
// LIVE prototype (headless Chrome over CDP, prototype/index.html). A check that cannot fail is a sentence, so every
// planted defect is a real mutation — of the model's source (a mutated copy imported from scratch) or of the page
// (?defect=…) — and the named checks must reject it.
//
//   node source/tools/p3checks.mjs [--no-git] [--out <file>]     (default out: data/CHECKS.json)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { openState, kbdFocus, closeBrowser, closeServers, WORK, PKG, SOURCE } from './lib/session.mjs';
import * as FX from '../src/fixtures.mjs';
import { COPY, projectionWords } from '../src/content.mjs';

const args = process.argv.slice(2), NO_GIT = args.includes('--no-git');
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : join(PKG, 'data', 'CHECKS.json');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const BASE = 'b9e087ba366c9df6843b6b880ff5e790f1fde045';
const REPO = join(PKG, '..', '..', '..', '..');
const MODEL_SRC = readFileSync(join(SOURCE, 'src', 'model.mjs'), 'utf8');
const loadModel = async (src, tag) => { mkdirSync(join(WORK, 'mut'), { recursive: true }); const f = join(WORK, 'mut', `model-${tag}.mjs`); writeFileSync(f, src); return import(pathToFileURL(f).href + `?v=${sha(src).slice(0, 8)}`); };
const mutate = (src, from, to) => { if (!src.includes(from)) throw new Error('planted defect anchor missing: ' + from.slice(0, 60)); return src.replace(from, to); };

// ------------------------------------------------------------------------------------------ model checks
const W = { ar: projectionWords('ar'), en: projectionWords('en') };
const pj = (M, ev, lvl, lang = 'ar') => M.project({ ...ev, ctxName: ev.ctxName ? ev.ctxName[lang] : null, bounded: ev.bounded[lang], preview: ev.preview[lang] }, lvl, W[lang]);
function overnight(M) {
  const hist = [], pend = [], arr = [];
  for (const e of FX.OVERNIGHT) { const r = M.decide(e, { settings: FX.OVERNIGHT_SETTINGS, hist, app: 'background', now: e.at }); arr.push(r); if (r.surface === 'push') hist.push({ at: e.at, kind: e.kind, critical: !!e.critical }); if (r.surface === 'deferred') pend.push(e); }
  return { arr, pend, m: M.reevaluateAtQuietEnd(pend, { settings: FX.OVERNIGHT_SETTINGS, hist, app: 'background', now: M.at(3, '08:00') }) };
}
const wk = (M) => Object.fromEntries(M.runTrace(FX.WEEK, FX.WEEK_SETTINGS).rows.map((r) => [r.id, r]));
const sc = (M, id) => { const s = FX.SCENARIOS.find((x) => x.id === id); return M.decide({ ...FX.EV[s.ev] }, FX.scenarioCtx(s)); };
const has = (r, reason) => r.reasons.some((x) => x.includes(reason));

const MODEL_CHECKS = [
  ['C-ACT-4m', 'Activity', 'coalescing never crosses Worlds or authorities (D09)', (M) => {
    const evs = [{ ...FX.EV.sharedReply, id: 'a', kind: 'message', cls: 3, at: 1 }, { ...FX.EV.mutedShared, id: 'b', kind: 'message', cls: 3, at: 2 }, { ...FX.EV.sharedReply, id: 'c', kind: 'message', cls: 3, at: 3 }, { ...FX.EV.publicReaction, id: 'd', at: 4 }, { ...FX.EV.publicReaction, id: 'e', at: 5 }];
    const byId = Object.fromEntries(evs.map((e) => [e.id, e])); const g = M.coalesce(evs);
    return { pass: g.every((x) => M.coalescedValid(x, byId)) && g.length === 3, detail: g.map((x) => x.members.join('+')).join(' | ') };
  }],
  ['C-ACT-6', 'Activity', 'seen / opened are attention state only: opening never resolves the event; an actionable item keeps attention after it is seen (D31, D40, D47)', (M) => {
    const it = { ...FX.FEED.find((f) => f.id === 'F3') }; const o = M.markOpened(M.markSeen(it));
    const ind = M.indicators([o]);
    return { pass: o.resolved === it.resolved && o.actionable === true && ind.global.present === true && ind.system.count === 1, detail: `resolved ${o.resolved} · global ${ind.global.present}` };
  }],
  ['C-MARK-3m', 'Attention', 'the global indicator is presence only — no count field exists (D45)', (M) => { const g = M.indicators(FX.FEED).global; return { pass: Object.keys(g).join() === 'present' && g.present === true, detail: JSON.stringify(g) }; }],
  ['C-MARK-4m', 'Attention', 'Introductions: presence only, never a numeric count (P3-F, D48)', (M) => { const i = M.indicators(FX.FEED).intro; return { pass: !('count' in i), detail: JSON.stringify(i) }; }],
  ['C-STRIP-1m', 'Strip', 'same originating context → in place, never a strip or a Push (S1)', (M) => { const r = sc(M, 'S1'); return { pass: r.surface === 'in-place', detail: r.surface }; }],
  ['C-STRIP-2m', 'Strip', 'an active Live Call defers ordinary attention and an Introduction (S7, S8; G3 §D)', (M) => { const a = sc(M, 'S7'), b = sc(M, 'S8'); return { pass: a.surface === 'deferred' && b.surface === 'deferred', detail: `${a.surface} / ${b.surface}` }; }],
  ['C-PRIV-1', 'Privacy', 'Introductions default L0, and the L0 words reveal neither Introductions nor a person (D15)', (M) => {
    const d = M.DISCLOSURE_DEFAULTS.intro, ar = pj(M, FX.EV.introProposal, d, 'ar'), en = pj(M, FX.EV.introProposal, d, 'en'), s = JSON.stringify([ar, en]);
    return { pass: d === 'L0' && !/التعارف|تعارف|Introduc|سارة|Sara/i.test(s), detail: s };
  }],
  ['C-PRIV-2', 'Privacy', 'no category defaults to L3 (content preview is never a default)', (M) => { const v = Object.entries(M.DISCLOSURE_DEFAULTS); return { pass: v.every(([, l]) => l !== 'L3') && v.length === 8, detail: JSON.stringify(M.DISCLOSURE_DEFAULTS) }; }],
  ['C-PRIV-3', 'Privacy', 'the user ceiling is never exceeded, at every level and subject (D17)', (M) => {
    let bad = []; for (const k of ['sharedReply', 'publicReply', 'proactive', 'reminder', 'security', 'introProposal']) for (const c of M.LEVELS) {
      const s = M.defaultSettings(); s.os = 'granted'; s.intro.entered = true; const e = FX.EV[k]; s.lock[M.subjectOf(e)] = c;
      const r = M.decide({ ...e }, { settings: s, hist: [], app: 'background', now: M.at(3, '14:00') });
      if (r.surface === 'push' && M.LEVELS.indexOf(r.level) > M.LEVELS.indexOf(c)) bad.push(`${k}@${c}→${r.level}`);
    } return { pass: bad.length === 0, detail: bad.join(', ') || '36 combinations' };
  }],
  ['C-PRIV-4', 'Privacy', 'a critical event does not raise disclosure: security is L2 by default (D14, D15)', (M) => { const s = M.defaultSettings(); s.os = 'granted'; const r = M.decide({ ...FX.EV.security }, { settings: s, hist: [], app: 'background', now: M.at(3, '14:00') }); return { pass: r.surface === 'push' && r.level === 'L2', detail: `${r.surface} ${r.level}` }; }],
  ['C-PRIV-5', 'Privacy', 'a preview is built from ONE event and names only its own World (no cross-World preview)', (M) => { const p = pj(M, FX.EV.sharedReply, 'L3', 'ar'); const s = JSON.stringify(p); return { pass: s.includes('رحلة الصيف') && !s.includes('فريق العمل'), detail: s }; }],
  ['C-PERM-4', 'Permission', 'OS permission denied: Push unavailable, Activity still used — even for a critical event (D50, D36)', (M) => { const a = sc(M, 'S6'), b = sc(M, 'S15'); return { pass: a.surface === 'activity' && b.surface === 'activity', detail: `${a.surface} / ${b.surface}` }; }],
  ['C-QUIET-1', 'Quiet Hours', 'default Quiet Hours ON, 23:00 → 08:00 device-local', (M) => { const q = M.defaultSettings().quiet; return { pass: q.on && q.from === '23:00' && q.to === '08:00' && M.inQuiet(M.at(1, '23:30'), q) && M.inQuiet(M.at(2, '07:59'), q) && !M.inQuiet(M.at(2, '08:00'), q), detail: JSON.stringify(q) }; }],
  ['C-QUIET-2', 'Quiet Hours', 'only the exact reminder and the critical security event are exceptions (D06)', (M) => { const ex = Object.entries(FX.EV).filter(([, e]) => M.isQuietException(e)).map(([k]) => k).sort().join(); return { pass: ex === 'reminder,security', detail: ex }; }],
  ['C-QUIET-3', 'Quiet Hours', 'no morning dump: 5 overnight candidates → at most 1 Push at 08:00, every waiting candidate re-evaluated', (M) => { const o = overnight(M); return { pass: o.m.pushes <= 1 && o.m.results.length === o.pend.length && o.pend.length === 3, detail: `08:00 pushes ${o.m.pushes}; ${o.m.results.map((r) => r.id + ':' + r.surface).join(' ')}` }; }],
  ['C-QUIET-4', 'Quiet Hours', 'the morning outcome coalesces nothing across Worlds', (M) => { const o = overnight(M), byId = Object.fromEntries(FX.OVERNIGHT.map((e) => [e.id, e])); return { pass: o.m.activityGroups.every((g) => M.coalescedValid(g, byId)), detail: o.m.activityGroups.map((g) => g.members.join('+')).join(' | ') }; }],
  ['C-FREQ-1', 'Frequency', 'ordinary Push: the 5th in a rolling 24 h is refused (W05)', (M) => { const r = wk(M).W05; return { pass: r.surface === 'activity' && has(r, 'ordinary-24h'), detail: r.surface + ' ' + r.reasons }; }],
  ['C-FREQ-2', 'Frequency', 'ordinary Push: the 13th in a rolling 7 d is refused (W19), after exactly 12 (W18)', (M) => { const t = wk(M); return { pass: t.W19.surface === 'activity' && has(t.W19, 'ordinary-7d') && t.W18.ord7 === 12, detail: `${t.W19.surface} ord7=${t.W18.ord7}` }; }],
  ['C-FREQ-3', 'Frequency', 'Proactive QANDEEL: a 2nd Push 6 h after the first is refused for proactive-24h ALONE (ordinary budget free)', (M) => {
    const s = M.defaultSettings(); s.os = 'granted'; const hist = [{ at: M.at(1, '10:00'), kind: 'proactive', thread: 'X', engaged: false }];
    const r = M.decide({ ...FX.EV.proactive, thread: 'Y' }, { settings: s, hist, app: 'background', now: M.at(1, '16:00') });
    return { pass: r.surface !== 'push' && has(r, 'proactive-24h'), detail: r.surface + ' ' + r.reasons };
  }],
  ['C-FREQ-4', 'Frequency', 'Proactive QANDEEL: 3 / rolling 7 d (W18 is the 3rd; a 4th the same week is refused)', (M) => {
    const t = wk(M); const s = { ...FX.WEEK_SETTINGS }; const hist = M.runTrace(FX.WEEK, FX.WEEK_SETTINGS).pushes;
    const r = M.decide({ ...FX.EV.proactive, thread: 'Z' }, { settings: s, hist, app: 'background', now: M.at(7, '11:00') });
    return { pass: t.W18.pro7 === 3 && r.surface !== 'push' && (has(r, 'proactive-7d') || has(r, 'ordinary-7d')), detail: `pro7=${t.W18.pro7}; 4th: ${r.surface} ${r.reasons}` };
  }],
  ['C-FREQ-5', 'Frequency', 'same proactive thread, no engagement: not before 48 h (W09 refused at 25.5 h, W10 allowed at 48.5 h)', (M) => { const t = wk(M); return { pass: t.W09.surface !== 'push' && has(t.W09, 'same-thread-48h') && t.W10.surface === 'push', detail: `${t.W09.surface} / ${t.W10.surface}` }; }],
  ['C-FREQ-6', 'Frequency', 'a third same-subject interruption needs new meaningful context (W17 refused, W18 allowed)', (M) => { const t = wk(M); return { pass: has(t.W17, 'third-needs-new-context') && t.W18.surface === 'push', detail: `${t.W17.surface} / ${t.W18.surface}` }; }],
  ['C-FREQ-7', 'Frequency', 'Public Discovery: opt-in, at most 1 / rolling 7 d, first to be suppressed (W11, W14, S12)', (M) => { const t = wk(M), n = sc(M, 'S12'); return { pass: t.W11.surface === 'push' && t.W14.surface === 'suppressed' && n.surface === 'suppressed', detail: `${t.W11.surface} / ${t.W14.surface} / not opted in: ${n.surface}` }; }],
  ['C-FREQ-8', 'Frequency', 'unused budget never causes a notification (ceiling ≠ quota): an empty trace sends nothing', (M) => { const r = M.runTrace([], FX.WEEK_SETTINGS); return { pass: r.pushes.length === 0 && r.rows.length === 0, detail: 'pushes ' + r.pushes.length }; }],
  ['C-FREQ-9', 'Frequency', 'the exact reminder and the critical security event sit outside the ordinary ceiling (W06, W20)', (M) => { const t = wk(M); return { pass: t.W06.surface === 'push' && t.W20.surface === 'push' && has(t.W20, 'outside') && t.W20.ord7 === 12, detail: `${t.W06.surface} / ${t.W20.surface}` }; }],
  ['C-FREQ-10', 'Frequency', 'the whole 7-day trace equals the independently stated expectations', (M) => { const t = wk(M), bad = Object.entries(FX.WEEK_EXPECT).filter(([k, v]) => t[k].surface !== v).map(([k]) => k); return { pass: bad.length === 0, detail: bad.join(',') || '20 / 20' }; }],
  ['C-FG-1', 'Foreground', 'all 15 foreground / background scenarios resolve as expected (same context suppresses; different context may strip)', (M) => { const bad = FX.SCENARIOS.filter((s) => sc(M, s.id).surface !== s.expect).map((s) => s.id); return { pass: bad.length === 0, detail: bad.join(',') || '15 / 15' }; }],
];

// ------------------------------------------------------------------------------------------ DOM checks
const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
const PAL = (() => { const t = readFileSync(join(PKG, 'prototype', 'index.html'), 'utf8'); const m = t.match(/window\.P3DATA=(\{.*?\});<\/script>/s); return JSON.parse(m[1]).palettes; })();
async function page(o) { return openState({ ...o, q: { ...(o.q || {}), ...(o.defect ? { defect: o.defect } : {}) } }); }
const DOM_CHECKS = [
  ['C-ACT-1', 'Activity', 'one Activity destination reached from the chrome; the navigation keeps its three Worlds and Activity is not one of them', async (d) => {
    const c = await page({ state: 'conv', defect: d }); const r = await c.eval(`({n:document.querySelectorAll('#rail .it').length,names:[...document.querySelectorAll('#rail .it')].map(e=>e.textContent.trim()),entry:!!document.querySelector('.hdr #act-entry')})`);
    await c.eval(`document.getElementById('act-entry').click()`); const p = await c.eval(`({place:document.getElementById('phone').dataset.place,rail:!!document.querySelector('#rail')})`);
    return { pass: r.n === 3 && r.entry && !r.names.some((x) => /النشاط|Activity/.test(x)) && p.place === 'activity' && !p.rail, detail: `${r.names.join(' · ')} → ${p.place}` };
  }],
  ['C-ACT-2', 'Activity', 'filters are lightweight toggles over one feed — no tablist, no five permanent tabs; All by default', async (d) => {
    const c = await page({ state: 'activity', defect: d }); const r = await c.eval(`({tabs:document.querySelectorAll('[role=tab],[role=tablist]').length,grp:document.querySelector('.filters').getAttribute('role'),n:document.querySelectorAll('.fchip').length,on:[...document.querySelectorAll('.fchip[aria-pressed=true]')].map(e=>e.dataset.filter)})`);
    return { pass: r.tabs === 0 && r.grp === 'group' && r.n === 6 && r.on.join() === 'all', detail: JSON.stringify(r) };
  }],
  ['C-ACT-3', 'Activity', 'every item keeps its semantic category and its one originating context', async (d) => {
    const c = await page({ state: 'activity', defect: d }); const r = await c.eval(`[...document.querySelectorAll('.row')].map(e=>[e.dataset.cat,e.dataset.context])`);
    const ok = r.every(([cat, ctx]) => ['qandeel', 'shared', 'public', 'intro', 'system'].includes(cat) && ctx); return { pass: ok && r.length === FX.FEED.length, detail: `${r.length} rows` };
  }],
  ['C-ACT-4', 'Activity', 'no rendered row merges two Worlds', async (d) => {
    const c = await page({ state: 'activity', defect: d }); const t = await c.eval(`[...document.querySelectorAll('.row .say')].map(e=>e.textContent)`);
    const names = ['رحلة الصيف', 'فريق العمل']; const bad = t.filter((s) => names.every((n) => s.includes(n))); return { pass: bad.length === 0, detail: bad.join(' | ') || 'none' };
  }],
  ['C-ACT-5', 'Activity', 'at most one explicit inline action per item', async (d) => { const c = await page({ state: 'activity', defect: d }); const r = await c.eval(`[...document.querySelectorAll('.row')].map(e=>e.querySelectorAll(':scope > .act').length)`); return { pass: r.every((n) => n <= 1) && r.includes(1), detail: r.join('') }; }],
  ['C-MARK-1', 'Attention', 'the attention mark is never Living Brass (Dark and Light)', async (d) => {
    const out = []; for (const a of ['dark', 'light']) { const c = await page({ state: 'conv', appearance: a, defect: d }); const bg = await c.eval(`getComputedStyle(document.querySelector('#act-entry .amark')).backgroundColor`); out.push([a, bg, rgbOf(PAL[`${a}-standard`].brass)]); }
    return { pass: out.every(([, bg, br]) => bg !== br), detail: out.map((x) => x.join(' ')).join(' | ') };
  }],
  ['C-MARK-2', 'Attention', 'no default red: the mark is the neutral primary ink, never the error ink, and never a badge pill', async (d) => {
    const c = await page({ state: 'conv', defect: d }); const r = await c.eval(`(()=>{const m=document.querySelector('#act-entry .amark');const s=getComputedStyle(m);return {bg:s.backgroundColor,w:m.getBoundingClientRect().width,h:m.getBoundingClientRect().height}})()`);
    return { pass: r.bg === rgbOf(PAL['dark-standard'].primary) && r.bg !== rgbOf(PAL['dark-standard'].error) && r.w <= 8 && Math.abs(r.w - r.h) < 0.5, detail: JSON.stringify(r) };
  }],
  ['C-MARK-3', 'Attention', 'no global raw count: the entry shows no number', async (d) => { const c = await page({ state: 'conv', defect: d }); const t = await c.eval(`document.getElementById('act-entry').textContent`); return { pass: !/\d/.test(t), detail: JSON.stringify(t) }; }],
  ['C-MARK-4', 'Attention', 'Introductions shows presence only — no numeric candidate count anywhere in Activity', async (d) => {
    const c = await page({ state: 'activity', defect: d }); const t = await c.eval(`document.querySelector('.fchip[data-filter=intro]').textContent + '|' + [...document.querySelectorAll('.row[data-cat=intro] .say')].map(e=>e.textContent).join('|')`);
    return { pass: !/[0-9٠-٩]/.test(t), detail: t };
  }],
  ['C-STRIP-1', 'Strip', 'no strip in the same originating context (the reply lands in the thread)', async (d) => { const c = await page({ state: 'shared-inplace', defect: d }); const r = await c.eval(`({strip:!!document.querySelector('.strip'),inplace:!!document.querySelector('.t.new')})`); return { pass: !r.strip && r.inplace, detail: JSON.stringify(r) }; }],
  ['C-STRIP-2', 'Strip', 'no strip during an active Live Call; the call line keeps Call Rail A with End Call at 27 px; the event waits in Activity with the mark', async (d) => {
    const c = await page({ state: 'conv-call', defect: d }); const r = await c.eval(`({strip:!!document.querySelector('.strip'),end:document.querySelector('#end-call svg').getAttribute('width'),rail:!!document.querySelector('.crail .cr-group'),mark:!!document.querySelector('#act-entry .amark'),d:P3.S.deferred.length})`);
    return { pass: !r.strip && r.end === '27' && r.rail && r.mark && r.d === 2, detail: JSON.stringify(r) };
  }],
  ['C-STRIP-3', 'Strip', 'no bounce, pulse or loop: strip motion is monotonic, never overshoots, and nothing in the page animates forever', async (d) => {
    const t = JSON.parse(readFileSync(join(PKG, 'data', 'motion', 'M02-strip-appear-hold-dismiss.json'), 'utf8')).truth;
    const ys = t.filter((f) => f.strip && f.strip.t).map((f) => parseFloat(f.strip.t.match(/-?[\d.]+(?:e-?\d+)?/)[0])); const inOnly = [];
    let prev = -Infinity, mono = true; for (const f of t) { if (!f.strip) continue; if (f.t > 1000) break; const y = f.strip.t ? parseFloat(f.strip.t.match(/-?[\d.]+(?:e-?\d+)?/)[0]) : 0; if (y < prev - 1e-6) mono = false; prev = y; inOnly.push(y); }
    const html = readFileSync(join(PKG, 'prototype', 'index.html'), 'utf8');
    return { pass: mono && ys.every((y) => y <= 0 && y >= -10) && !/infinite|animation-iteration|alternate/.test(html), detail: `appear y: ${inOnly.slice(0, 6).map((v) => v.toFixed(1)).join(' ')}…` };
  }],
  ['C-STRIP-4', 'Strip', 'pressing the strip enters its originating context (Direct Entry preserved)', async (d) => {
    const c = await page({ state: 'conv-strip-shared', defect: d }); await c.eval('P3.enterFirst()'); await c.eval('P3.tick(800)');
    const r = await c.eval(`({place:P3.S.place,here:P3.S.here,title:(document.querySelector('.world-name h1')||{}).textContent})`); return { pass: r.place === 'shared' && r.here === 'w-summer', detail: JSON.stringify(r) };
  }],
  ['C-PERM-1', 'Permission', 'no permission education at first launch; the education carries a legitimate trigger', async (d) => {
    const c = await page({ state: 'conv', defect: d }); const a = await c.eval(`!!document.querySelector('.sheet')`);
    const c2 = await page({ state: 'edu', defect: d }); const t = await c2.eval(`document.querySelector('.sheet').dataset.trigger`);
    return { pass: !a && t && t !== 'launch', detail: `launch sheet: ${a}; trigger: ${t}` };
  }],
  ['C-PERM-2', 'Permission', 'education comes BEFORE the OS boundary, and the OS prompt is not drawn by QANDEEL', async (d) => {
    const c = await page({ state: 'shared', defect: d }); await c.eval(`P3.eduFor('shared-first-entry')`); await c.eval('P3.tick(600)'); const s1 = await c.eval(`({sheet:!!document.querySelector('.sheet[role=dialog][aria-modal=true]'),os:!!document.querySelector('.osbox')})`);
    await c.eval('P3.eduAllow()'); await c.eval('P3.tick(800)'); const s2 = await c.eval(`({sheet:!!document.querySelector('.sheet'),os:document.querySelector('.osbox .tag')&&document.querySelector('.osbox .tag').textContent})`);
    return { pass: s1.sheet && !s1.os && !s2.sheet && /PLATFORM-OWNED/.test(s2.os || ''), detail: JSON.stringify([s1, s2]) };
  }],
  ['C-PERM-3', 'Permission', '«مش دلوقتي» leaves the Product usable and never re-asks on its own', async (d) => {
    const c = await page({ state: 'edu', defect: d }); await c.eval('P3.tick(600)'); await c.eval('P3.eduNotNow()'); await c.eval('P3.tick(800)');
    const r = await c.eval(`({sheet:!!document.querySelector('.sheet,.scrim'),entry:!!document.getElementById('act-entry'),rail:document.querySelectorAll('#rail .it').length,again:P3.eduFor('proactive-allow')})`);
    return { pass: !r.sheet && r.entry && r.rail === 3 && r.again === false, detail: JSON.stringify(r) };
  }],
  ['C-A11Y-1', 'Accessibility', 'every control is named (conversation, strip, Activity, settings, education, call)', async (d) => {
    const bad = []; for (const [st, lang, h] of [['conv-strip-shared', 'ar'], ['activity', 'ar'], ['activity', 'en'], ['notif', 'ar', 1960], ['edu', 'en'], ['conv-call', 'ar'], ['notif-lock', 'ar']]) { const c = await page({ state: st, lang, h: h || 844, defect: d }); const ctl = await c.eval('P3.controls()'); for (const x of ctl) if (!x.hidden && !x.name) bad.push(`${st}:${x.tag}`); }
    return { pass: bad.length === 0, detail: bad.join(', ') || '7 pages' };
  }],
  ['C-A11Y-1b', 'Accessibility', 'no name is glued from several text pieces (a control named by more than one text element carries an explicit label)', async (d) => {
    const bad = []; for (const [st, lang, h] of [['conv-strip-shared', 'ar'], ['activity', 'en'], ['notif', 'ar', 1960], ['notif', 'en', 1960], ['notif-lock', 'ar'], ['settings-root', 'en']]) { const c = await page({ state: st, lang, h: h || 844, defect: d }); const ctl = await c.eval('P3.controls()'); for (const x of ctl) if (!x.hidden && x.glued) bad.push(`${st}:${x.name}`); }
    return { pass: bad.length === 0, detail: bad.slice(0, 5).join(' | ') || '6 pages' };
  }],
  ['C-A11Y-9', 'Accessibility', 'a modal keeps focus inside: nothing behind the education or the preview chooser is reachable, and Escape closes it', async (d) => {
    const out = []; for (const st of ['edu', 'notif-lock']) { const c = await page({ state: st, defect: d }); await c.eval('P3.tick(600)'); const r = await c.eval(`(()=>{const ctl=P3.controls();const inS=[...document.querySelectorAll('.sheet button')].length;const out=[...document.querySelectorAll('#view button')].filter(b=>!b.closest('[inert]')).length;return {inS,out}})()`); await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await c.eval('P3.tick(800)'); out.push({ st, ...r, closed: await c.eval(`!document.querySelector('.sheet')`) }); }
    return { pass: out.every((x) => x.inS >= 2 && x.out === 0 && x.closed), detail: JSON.stringify(out) };
  }],
  ['C-A11Y-2', 'Accessibility', 'every decorative glyph is hidden from the accessibility tree', async (d) => {
    const bad = []; for (const st of ['conv-strip-shared', 'activity', 'notif', 'conv-call']) { const c = await page({ state: st, defect: d }); const g = await c.eval('P3.decorative()'); bad.push(...g.filter((x) => !x.hidden && !x.labelled).map(() => st)); }
    return { pass: bad.length === 0, detail: bad.join(',') || 'all hidden' };
  }],
  ['C-A11Y-3', 'Accessibility', 'every control target is at least 44 × 44 pt (320, 390 and 430)', async (d) => {
    const bad = []; for (const [st, w, h] of [['conv-strip-shared', 390, 844], ['activity', 320, 568], ['notif', 390, 1960], ['edu', 320, 568], ['conv-call', 430, 932], ['notif-lock', 390, 844]]) { const c = await page({ state: st, w, h, defect: d }); const ctl = await c.eval('P3.controls()'); for (const x of ctl) if (!x.hidden && (x.w < 44 || x.h < 44)) bad.push(`${st}@${w}:${x.name}(${x.w}×${x.h})`); }
    return { pass: bad.length === 0, detail: bad.slice(0, 6).join(', ') || '6 pages' };
  }],
  ['C-A11Y-4', 'Accessibility', 'keyboard focus is visible (E1R perimeter) on the entry, a filter, a switch and the strip', async (d) => {
    const out = []; for (const [st, sel, h] of [['conv', '#act-entry'], ['activity', '.fchip[data-filter=shared]'], ['notif', '[data-sw=shared]', 1960], ['conv-strip-shared', '.strip .x']]) { const c = await page({ state: st, h: h || 844, defect: d }); await kbdFocus(c, sel); out.push(await c.eval(`getComputedStyle(document.querySelector(${JSON.stringify(sel)})).boxShadow`)); }
    return { pass: out.every((s) => s && s !== 'none' && (s.match(/rgb/g) || []).length >= 3), detail: `${out.length} focus rings` };
  }],
  ['C-A11Y-5', 'Accessibility', 'state is never colour-only: rows say NEW / WAITING / NO LONGER AVAILABLE in words; switches and radios expose their state', async (d) => {
    const c = await page({ state: 'activity-stale', defect: d }); const r = await c.eval(`({labels:[...document.querySelectorAll('.row .go')].map(e=>e.getAttribute('aria-label'))})`);
    const c2 = await page({ state: 'notif', h: 1960, defect: d }); const s = await c2.eval(`({sw:[...document.querySelectorAll('[role=switch]')].every(e=>['true','false'].includes(e.getAttribute('aria-checked'))),rad:[...document.querySelectorAll('[role=radio]')].filter(e=>e.getAttribute('aria-checked')==='true').length})`);
    const L = COPY.ar; const ok = r.labels.some((l) => l.includes(L.markNew.text)) && r.labels.some((l) => l.includes(L.markWaiting.text)) && r.labels.some((l) => l.includes(L.stale.text));
    return { pass: ok && s.sw && s.rad === 1, detail: `words ${ok}; switches ${s.sw}; checked radios ${s.rad}` };
  }],
  ['C-A11Y-6', 'Direction', 'RTL mirrors by meaning: the entry sits at the START edge in both scripts; back mirrors; the ledger, World and call glyphs never do', async (d) => {
    const out = {}; for (const lang of ['ar', 'en']) { const c = await page({ state: 'conv', lang, defect: d }); out[lang] = await c.eval(`({x:document.getElementById('act-entry').getBoundingClientRect().x,led:getComputedStyle(document.querySelector('#act-entry svg')).transform,nav:getComputedStyle(document.querySelector('#rail .ic svg')).transform})`); }
    const c = await page({ state: 'activity', lang: 'ar', defect: d }); const back = await c.eval(`getComputedStyle(document.querySelector('[data-back] svg')).transform`);
    return { pass: out.ar.x > 300 && out.en.x < 60 && out.ar.led === 'none' && out.ar.nav === 'none' && /matrix\(-1/.test(back), detail: `ar x ${out.ar.x}, en x ${out.en.x}, back ${back}` };
  }],
  ['C-A11Y-7', 'Accessibility', 'Reduced Motion parity: the strip keeps its meaning, hold and acts with no travel', async () => {
    const a = JSON.parse(readFileSync(join(PKG, 'data', 'motion', 'M02-strip-appear-hold-dismiss.json'), 'utf8')).truth, b = JSON.parse(readFileSync(join(PKG, 'data', 'motion', 'M04-strip-reduced-motion.json'), 'utf8')).truth;
    const span = (t) => { const on = t.filter((f) => f.strip).map((f) => f.i); return [on[0], on[on.length - 1]]; };
    const sa = span(a), sb = span(b), travel = b.some((f) => f.strip && f.strip.t && /translateY\((?!0px)/.test(f.strip.t));
    return { pass: !travel && Math.abs(sa[0] - sb[0]) <= 1 && Math.abs(sa[1] - sb[1]) <= 3, detail: `standard frames ${sa}; reduced ${sb}` };
  }],
  ['C-A11Y-8', 'Appearance', 'Activity follows Dark / Light / System (non-Analysis): never painted Analysis-dark under Light', async (d) => {
    const out = []; for (const [a, sch] of [['light', 'light'], ['system', 'light'], ['dark', 'dark']]) { const c = await page({ state: 'activity', appearance: a, scheme: sch, defect: d }); out.push([a, await c.eval(`getComputedStyle(document.querySelector('.page.act')).backgroundColor`)]); }
    return { pass: out[0][1] === rgbOf(PAL['light-standard'].world) && out[1][1] === rgbOf(PAL['light-standard'].world) && out[2][1] === rgbOf(PAL['dark-standard'].world), detail: out.map((x) => x.join(' ')).join(' | ') };
  }],
  ['C-P2-1', 'P2', 'P2 consumed, not forked: navigation glyphs in Living Brass, the entry in neutral rest ink (never Brass)', async (d) => {
    const c = await page({ state: 'conv', defect: d }); const r = await c.eval(`({nav:getComputedStyle(document.querySelector('#rail .ic')).color,entry:getComputedStyle(document.getElementById('act-entry')).color})`);
    return { pass: r.nav === rgbOf(PAL['dark-standard'].brass) && r.entry === rgbOf(PAL['dark-standard'].restInk) && r.entry !== r.nav, detail: JSON.stringify(r) };
  }],
];

// ------------------------------------------------------------------------------------------ static checks
function walk(d) { return readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; }); }
const STATIC_CHECKS = [
  ['C-SCOPE-1', 'Scope', 'only the P3 proof package changes against canonical main; no production source, dependency, locator, backlog or canonical authority', () => {
    if (NO_GIT) return { pass: true, skipped: true, detail: '--no-git' };
    const names = execFileSync('git', ['-C', REPO, 'diff', '--name-only', BASE], { encoding: 'utf8' }).split('\n').filter(Boolean);
    const untracked = execFileSync('git', ['-C', REPO, 'ls-files', '--others', '--exclude-standard', 'docs/design/p3-notifications'], { encoding: 'utf8' }).split('\n').filter(Boolean);
    const bad = names.filter((n) => !n.startsWith('docs/design/p3-notifications/'));
    return { pass: bad.length === 0, detail: `${names.length} tracked changes + ${untracked.length} new package files; outside: ${bad.join(', ') || 'none'}` };
  }],
  ['C-SCOPE-2', 'Scope', 'no dependency or production manifest inside the package', () => { const f = walk(PKG).map((p) => relative(PKG, p)); const bad = f.filter((p) => /(^|[\\/])(package(-lock)?\.json|node_modules|yarn\.lock|pnpm-lock\.yaml|app\.json)$/.test(p)); return { pass: bad.length === 0, detail: `${f.length} files; ${bad.join(', ') || 'none'}` }; }],
  ['C-SCOPE-3', 'Scope', 'the vendored P2 material is byte-identical to its provenance record and to the merged P2-A package', () => {
    const pr = JSON.parse(readFileSync(join(SOURCE, 'PROVENANCE.json'), 'utf8')); const p2 = join(REPO, 'docs', 'design', 'p2-iconography', 'QANDEEL_P2-A_FINAL_ICONOGRAPHY_INTEGRATED_VISUAL_PROOF', 'source'); const bad = [];
    for (const [to, e] of Object.entries(pr.files)) { const b = readFileSync(join(SOURCE, to)); if (sha(b) !== e.sha256) bad.push(to); if (existsSync(join(p2, e.from)) && sha(readFileSync(join(p2, e.from))) !== e.sha256) bad.push('P2:' + e.from); }
    return { pass: bad.length === 0 && Object.keys(pr.files).length > 30, detail: `${Object.keys(pr.files).length} files; ${bad.join(', ') || 'identical'}` };
  }],
  ['C-LIFE-1', 'Lifecycle', 'the package never claims P3 CLOSED / FROZEN', () => {
    const files = walk(PKG).filter((p) => /\.(md|json|html|mjs|js)$/.test(p)); if (!files.length) throw new Error('scanned nothing');
    const bad = []; for (const f of files) for (const line of readFileSync(f, 'utf8').split('\n')) if (/P3\W{0,6}(is\W+)?CLOSED\s*\/\s*FROZEN/i.test(line) && !/\bNOT\b|NOT CLOSED|never|must not|does not|claim/i.test(line)) bad.push(relative(PKG, f));
    return { pass: bad.length === 0, detail: `${files.length} files scanned; ${[...new Set(bad)].join(', ') || 'no claim'}` };
  }],
];

// ------------------------------------------------------------------------------------------ planted defects
const MUT = {
  D3: ['a cross-World coalesced row', (s) => mutate(s, '`${e.category}|${e.context}|${e.kind}`', '`${e.category}|${e.kind}`'), 'crossworld', ['C-ACT-4m', 'C-ACT-4']],
  D5: ['a morning dump: every waiting candidate pushed at 08:00', (s) => mutate(s, 'let r = decide(e, { ...ctx, hist, now: t });', "let r = { surface: 'push', level: 'L1', reasons: ['dump'] };"), null, ['C-QUIET-3']],
  D6: ['the fifth ordinary Push in 24 h allowed', (s) => mutate(s, 'ordinary: { per24h: 4,', 'ordinary: { per24h: 5,'), null, ['C-FREQ-1']],
  D7: ['a second Proactive QANDEEL Push 6 h after the first', (s) => mutate(s, 'proactive: { per24h: 1,', 'proactive: { per24h: 2,'), null, ['C-FREQ-3']],
  D8: ['an Attention Strip in the same originating context', (s) => mutate(s, "if (ctx.here && ctx.here === e.context) { R.push('same-context'); return out('in-place', { mark: false }); }", ''), 'samectx', ['C-STRIP-1m', 'C-STRIP-1']],
  D11: ['Shared previews default to L3', (s) => mutate(s, "shared: 'L2',       // Shared Worlds", "shared: 'L3',       // Shared Worlds"), null, ['C-PRIV-2']],
  D12: ['the Introductions L0 notification names Introductions', (s) => mutate(s, "if (level === 'L0') return { title: null, body: w.l0 };", "if (level === 'L0') return { title: null, body: w.generic[subjectOf(e)] };"), null, ['C-PRIV-1']],
  D13: ['a critical event raises disclosure to L3', (s) => mutate(s, "const level = minLevel(e.safeMax ?? 'L3', s.lock[subj] ?? DISCLOSURE_DEFAULTS[subj]);", "const level = e.critical ? 'L3' : minLevel(e.safeMax ?? 'L3', s.lock[subj] ?? DISCLOSURE_DEFAULTS[subj]);"), null, ['C-PRIV-4']],
  D14: ['Quiet Hours exceptions widened to Proactive QANDEEL', (s) => mutate(s, "export const isQuietException = (e) => e.kind === 'reminder' ||", "export const isQuietException = (e) => e.kind === 'reminder' || e.kind === 'proactive' ||"), null, ['C-QUIET-2']],
};
const DOMDEF = {
  D1: ['a red global “37” badge', 'redbadge', ['C-MARK-2', 'C-MARK-3']],
  D2: ['an Introductions count “12”', 'introcount', ['C-MARK-4']],
  D4: ['a first-launch permission popup', 'firstlaunch', ['C-PERM-1']],
  D9: ['Activity painted Analysis-dark under Light', 'actdark', ['C-A11Y-8']],
  D10: ['a Brass attention dot', 'brassdot', ['C-MARK-1']],
  D15: ['a settings row whose accessible name is glued from two texts', 'gluedname', ['C-A11Y-1b']],
  D16: ['a modal that leaves the page behind it reachable', 'noinert', ['C-A11Y-9']],
};

async function runModel(M, only = null) { const out = []; for (const [id, g, title, fn] of MODEL_CHECKS) { if (only && !only.includes(id)) continue; let r; try { r = fn(M); } catch (e) { r = { pass: false, detail: 'threw: ' + e.message }; } out.push({ id, group: g, title, ...r }); } return out; }
async function runDom(defect = null, only = null) { const out = []; for (const [id, g, title, fn] of DOM_CHECKS) { if (only && !only.includes(id)) continue; let r; try { r = await fn(defect); } catch (e) { r = { pass: false, detail: 'threw: ' + e.message }; } out.push({ id, group: g, title, ...r }); } return out; }

const M0 = await loadModel(MODEL_SRC, 'base');
const results = [...STATIC_CHECKS.map(([id, g, title, fn]) => { let r; try { r = fn(); } catch (e) { r = { pass: false, detail: 'threw: ' + e.message }; } return { id, group: g, title, ...r }; }), ...await runModel(M0), ...await runDom()];
const planted = [];
for (const [id, [desc, mut, domDefect, targets]] of Object.entries(MUT)) {
  const Mm = await loadModel(mut(MODEL_SRC), id);
  const rr = [...await runModel(Mm, targets), ...(domDefect ? await runDom(domDefect, targets) : [])];
  const caught = rr.filter((x) => !x.pass).map((x) => x.id);
  planted.push({ id, desc, via: domDefect ? `model mutation + ?defect=${domDefect}` : 'model mutation', targets, caughtBy: caught, rejected: caught.length > 0 });
}
for (const [id, [desc, defect, targets]] of Object.entries(DOMDEF)) {
  const rr = await runDom(defect, targets); const caught = rr.filter((x) => !x.pass).map((x) => x.id);
  planted.push({ id, desc, via: `?defect=${defect}`, targets, caughtBy: caught, rejected: caught.length > 0 });
}
await closeBrowser(); await closeServers();
planted.sort((a, b) => +a.id.slice(1) - +b.id.slice(1));
const proto = readFileSync(join(PKG, 'prototype', 'index.html'));
const pass = results.filter((r) => r.pass).length;
const rec = { baseline: BASE, prototypeSha256: sha(proto), checks: results, pass, total: results.length, planted, plantedRejected: planted.filter((p) => p.rejected).length, plantedTotal: planted.length };
writeFileSync(OUT, JSON.stringify(rec, null, 1) + '\n');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.id.padEnd(11)} ${r.title}${r.pass ? '' : '  — ' + r.detail}`);
for (const p of planted) console.log(`${p.rejected ? 'REJECTED' : 'MISSED  '} ${p.id} ${p.desc} (${p.caughtBy.join(', ') || '—'})`);
console.log(`\nchecks ${pass} / ${results.length} · planted defects rejected ${rec.plantedRejected} / ${planted.length} · prototype ${rec.prototypeSha256}`);
process.exitCode = pass === results.length && rec.plantedRejected === planted.length ? 0 : 1;
