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
import * as GL from '../src/p3glyphs.mjs';

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
  ['C-FG-1', 'Foreground', `all ${FX.SCENARIOS.length} scenarios resolve as independently stated — surface, and disclosure level where stated`, (M) => { const bad = FX.SCENARIOS.filter((s) => { const r = sc(M, s.id); return r.surface !== s.expect || (s.expectLevel && r.level !== s.expectLevel); }).map((s) => s.id); return { pass: bad.length === 0 && FX.SCENARIOS.length >= 39, detail: bad.join(',') || `${FX.SCENARIOS.length} / ${FX.SCENARIOS.length}` }; }],
  // ---- P3-A refinement §5: Introductions — default L0, NO category cap; the user may raise the ceiling; the event may render less
  ['C-PRIV-6', 'Privacy', 'no Introductions category cap: default L0, and a ceiling the user raises above L1 is honoured up to the event\'s own safe projection (S28–S31)', (M) => {
    const r = Object.fromEntries(['S28', 'S29', 'S30', 'S31'].map((id) => [id, sc(M, id)]));
    const capped = Object.entries(FX.EV).filter(([, e]) => e.category === 'intro' && e.safeMax && M.LEVELS.indexOf(e.safeMax) <= 1).map(([k]) => k);
    return { pass: M.DISCLOSURE_DEFAULTS.intro === 'L0' && r.S28.level === 'L0' && r.S30.level === 'L3' && r.S31.level === 'L1' && capped.length === 0, detail: `default ${r.S28.level}; raised to L3 → acceptance ${r.S30.level}; raised to L1 → ${r.S31.level}; fixture intro caps ≤ L1: ${capped.join(',') || 'none'}` };
  }],
  ['C-PRIV-7', 'Privacy', 'the user\'s ceiling is a ceiling: an Introduction whose own bounded projection stops lower renders lower (S29), and even the raised L3 words name no person', (M) => {
    const a = sc(M, 'S29'), p = JSON.stringify([pj(M, FX.EV.introAccept, 'L3', 'ar'), pj(M, FX.EV.introAccept, 'L3', 'en'), pj(M, FX.EV.introProposal, a.level, 'ar')]);
    return { pass: a.surface === 'push' && a.level === 'L2' && !/سارة|Sara|كريم|Karim|مها|Maha|@/.test(p), detail: `proposal under an L3 ceiling → ${a.level}; ${p.slice(0, 120)}…` };
  }],
  // ---- §7: «أقل» / Reduce tightens the Proactive Gate; it is not a class rule; no scores
  ['C-RED-1', 'Reduce', 'Reduce is not "Class 2 only": a Gate-strong Class 3 still interrupts (S24) and a Gate-weak Class 2 waits (S22); a Gate-strong Class 2 interrupts (S21)', (M) => { const a = sc(M, 'S21'), b = sc(M, 'S22'), c = sc(M, 'S24'); return { pass: a.surface === 'push' && b.surface === 'next-conversation' && c.surface === 'push', detail: `S21 ${a.surface} · S22 ${b.surface} · S24 ${c.surface}` }; }],
  ['C-RED-2', 'Reduce', 'under Reduce an ordinary Class 3 waits for the next conversation (S23) and Class 4 never interrupts (S25); Reduce is not Off', (M) => { const a = sc(M, 'S23'), b = sc(M, 'S25'), off = sc(M, 'S14'); return { pass: a.surface === 'next-conversation' && b.surface === 'activity' && sc(M, 'S21').surface === 'push' && off.surface === 'next-conversation' && has(off, 'proactive-off'), detail: `S23 ${a.surface} · S25 ${b.surface}` }; }],
  ['C-RED-3', 'Reduce', 'Quiet Hours and the Proactive ceilings still constrain a Gate-strong candidate under Reduce (S26, S27)', (M) => { const a = sc(M, 'S26'), b = sc(M, 'S27'); return { pass: a.surface === 'deferred' && has(a, 'quiet-hours') && b.surface !== 'push' && has(b, 'proactive-24h'), detail: `S26 ${a.surface} · S27 ${b.surface} ${b.reasons}` }; }],
  // ---- §8: an active Live Call
  ['C-CALL-1m', 'Live Call', 'ordinary Shared, Introductions and Proactive attention waits during an active Live Call — foreground and background (S7, S8, S16, S19)', (M) => { const r = ['S7', 'S8', 'S16', 'S19'].map((id) => sc(M, id).surface); return { pass: r.every((x) => x === 'deferred'), detail: r.join(' / ') }; }],
  ['C-CALL-2m', 'Live Call', 'only critical security and a requested exact-time reminder may show the call-safe strip (S17, S18); a reminder that was not requested, and a non-critical security notice, still wait', (M) => {
    const a = sc(M, 'S17'), b = sc(M, 'S18'), ctx = FX.scenarioCtx(FX.SCENARIOS.find((s) => s.id === 'S17'));
    const c = M.decide({ ...FX.EV.reminder, requested: false }, ctx), d = M.decide({ ...FX.EV.security, critical: false }, ctx), e = sc(M, 'S20');
    return { pass: a.surface === 'call-strip' && b.surface === 'call-strip' && c.surface === 'deferred' && d.surface === 'deferred' && e.surface === 'push' && e.level === 'L2', detail: `S17 ${a.surface} · S18 ${b.surface} · unrequested ${c.surface} · non-critical ${d.surface} · background ${e.surface} ${e.level}` };
  }],
  // ---- final micro-refinement §5–§7: the Analysis is not an attention surface; leaving it re-evaluates, never replays
  ['C-ANL-3m', 'Analysis', 'inside the Analysis, with no call, ordinary Shared, Public, Introductions and Proactive attention — and critical security too (no new exception) — is deferred, never a strip; it stays in Activity with the mark (S32–S36)', (M) => {
    const r = ['S32', 'S33', 'S34', 'S35', 'S36'].map((id) => [id, sc(M, id)]);
    return { pass: r.every(([, x]) => x.surface === 'deferred' && has(x, 'analysis-deferred') && x.activity === true && x.mark === true), detail: r.map(([id, x]) => `${id} ${x.surface} (${x.reasons})`).join(' · ') };
  }],
  ['C-ANL-4m', 'Analysis', 'inside the Analysis during an active Live Call only the two call-safe cases present — critical security and a requested exact-time reminder (S37, S38); an ordinary Shared reply waits (S39); isCallSafe admits exactly those two fixture events', (M) => {
    const a = sc(M, 'S37'), b = sc(M, 'S38'), c = sc(M, 'S39'), set = Object.entries(FX.EV).filter(([, e]) => M.isCallSafe(e)).map(([k]) => k).sort().join();
    return { pass: a.surface === 'call-strip' && b.surface === 'call-strip' && c.surface === 'deferred' && has(c, 'live-call-deferred') && set === 'reminder,security', detail: `S37 ${a.surface} · S38 ${b.surface} · S39 ${c.surface} · call-safe set: ${set}` };
  }],
  ['C-EXIT-1m', 'Exit', 'leaving the Analysis re-evaluates what waited there against the CURRENT context: one Shared reply → one strip (X1); if the call continues, it keeps waiting (X4)', (M) => {
    const x1 = FX.ANALYSIS_EXIT.find((x) => x.id === 'X1'), x4 = FX.ANALYSIS_EXIT.find((x) => x.id === 'X4');
    const a = M.reevaluatePending(x1.pending, FX.exitCtx(x1)), b = M.reevaluatePending(x4.pending, FX.exitCtx(x4));
    return { pass: a.strip === 'E-reply' && a.results[0].surface === 'strip' && b.strip === null && b.pending.join() === 'E-reply' && has(b.results[0], 'live-call-deferred'), detail: `X1 strip ${a.strip} · X4 ${b.results[0].surface}, pending ${b.pending}` };
  }],
  ['C-EXIT-2m', 'Exit', 'never a dump: at most ONE strip after leaving (X2: four waited → one strip, the others in Activity or in place); stale, muted and same-context candidates are not forced (X3: no strip) — every case equals its independently stated outcome', (M) => {
    const bad = [], d = [];
    for (const x of FX.ANALYSIS_EXIT) {
      const r = M.reevaluatePending(x.pending, FX.exitCtx(x)), n = r.results.filter((q) => q.surface === 'strip').length;
      if (n > 1 || r.strip !== x.expect.strip || r.results.some((q) => x.expect.surfaces[q.id] !== q.surface)) bad.push(x.id);
      d.push(`${x.id}: ${n} strip${n === 1 ? '' : 's'} (${r.results.map((q) => q.id + ':' + q.surface).join(' ')})`);
    }
    return { pass: bad.length === 0 && FX.ANALYSIS_EXIT.length >= 4, detail: (bad.length ? 'FAIL ' + bad.join(',') + ' · ' : '') + d.join(' | ') };
  }],
];
const CODE = (src) => src.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
const MODEL_STATIC = [
  ['C-RED-4', 'Reduce', 'no score, weight or threshold: the Reduce decision reads one explicit boolean the fixture states (reduceEligible), never a class', (src) => {
    const line = src.split('\n').find((l) => l.includes("s.proactive === 'reduce'")) || '';
    const flags = Object.values(FX.EV).filter((e) => 'reduceEligible' in e).map((e) => typeof e.reduceEligible);
    return { pass: /reduceEligible !== true/.test(line) && !/\bcls\b/.test(line) && !/\b(score|weight|threshold)s?\b/i.test(CODE(src)) && flags.length >= 5 && flags.every((t) => t === 'boolean'), detail: line.trim().slice(0, 140) };
  }],
];

// ------------------------------------------------------------------------------------------ DOM checks
const rgbOf = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
const PAL = (() => { const t = readFileSync(join(PKG, 'prototype', 'index.html'), 'utf8'); const m = t.match(/window\.P3DATA=(\{.*?\});<\/script>/s); return JSON.parse(m[1]).palettes; })();
async function page(o) { return openState({ ...o, q: { ...(o.q || {}), ...(o.defect ? { defect: o.defect } : {}) } }); }
/** Reads a rendered glyph's GEOMETRY in the browser (paths sampled along their length, dots as circles): how much of the
 *  N1 ring keyline (centre 12,12, r 8) it covers, how many openings that ring has, where its points of light sit, its
 *  strokes, terminals and extent. A drawing is a ring when it covers ≥ 150° of the keyline (P2's porous Public ring
 *  covers ≈ 170°; the square ledger ≈ 110°). An opening is an uncovered run of ≥ 3°. */
const GLYPH_JS = `(sel, html) => {
  let svg, host = null;
  if (html) { host = document.createElement('div'); host.style.cssText = 'position:fixed;left:-999px;top:0'; host.innerHTML = html; document.body.appendChild(host); svg = host.querySelector('svg'); }
  else svg = document.querySelector(sel);
  const cov = new Array(360).fill(0), strokes = [], caps = [], dots = []; let lo = 24, hi = 0;
  for (const p of svg.querySelectorAll('path')) {
    if (p.getAttribute('fill') !== 'none') continue;
    strokes.push(+p.getAttribute('stroke-width')); caps.push(p.getAttribute('stroke-linecap'));
    const sw = +p.getAttribute('stroke-width') / 2, L = p.getTotalLength();
    for (let s = 0; s <= L; s += 0.05) { const q = p.getPointAtLength(s), r = Math.hypot(q.x - 12, q.y - 12);
      if (Math.abs(r - 8) < 0.3) cov[(Math.round(Math.atan2(q.y - 12, q.x - 12) * 180 / Math.PI) + 360) % 360] = 1;
      lo = Math.min(lo, q.x - sw, q.y - sw); hi = Math.max(hi, q.x + sw, q.y + sw); }
  }
  for (const c of svg.querySelectorAll('circle')) { const x = +c.getAttribute('cx'), y = +c.getAttribute('cy'), r = +c.getAttribute('r'); dots.push([x, y, r]); lo = Math.min(lo, x - r, y - r); hi = Math.max(hi, x + r, y + r); }
  const coverage = cov.reduce((a, b) => a + b, 0), ring = coverage >= 150; let gaps = 0;
  if (ring) for (let i = 0; i < 360; i++) if (!cov[i] && cov[(i + 359) % 360]) { let n = 0; while (n < 360 && !cov[(i + n) % 360]) n++; if (n >= 3) gaps++; }
  let face = false; for (let i = 0; i < dots.length; i++) for (let j = i + 1; j < dots.length; j++) if (Math.abs(dots[i][1] - dots[j][1]) < 1 && Math.abs(dots[i][0] - dots[j][0]) > 2) face = true;
  const out = { viewBox: svg.getAttribute('viewBox'), coverage, ring, gaps, dots: dots.map((d) => d.slice(0, 2)), dotsOnRing: dots.filter(([x, y]) => Math.abs(Math.hypot(x - 12, y - 12) - 8) < 0.6).length, face, strokes, caps, ext: [+lo.toFixed(2), +hi.toFixed(2)] };
  if (host) host.remove();
  return out;
}`;
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
    const bad = []; for (const [st, lang, h] of [['conv-strip-shared', 'ar'], ['activity', 'ar'], ['activity', 'en'], ['notif', 'ar', 1960], ['edu', 'en'], ['conv-call', 'ar'], ['notif-lock', 'ar'], ['analysis-call-security', 'ar'], ['conv-call-reminder', 'en'], ['analysis-exit', 'en']]) { const c = await page({ state: st, lang, h: h || 844, defect: d }); const ctl = await c.eval('P3.controls()'); for (const x of ctl) if (!x.hidden && !x.name) bad.push(`${st}:${x.tag}`); }
    return { pass: bad.length === 0, detail: bad.join(', ') || '10 pages' };
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
    const bad = []; for (const st of ['conv-strip-shared', 'activity', 'notif', 'conv-call', 'analysis-call-security', 'conv-call-security']) { const c = await page({ state: st, defect: d }); const g = await c.eval('P3.decorative()'); bad.push(...g.filter((x) => !x.hidden && !x.labelled).map(() => st)); }
    return { pass: bad.length === 0, detail: bad.join(',') || 'all hidden' };
  }],
  ['C-A11Y-3', 'Accessibility', 'every control target is at least 44 × 44 pt (320, 390 and 430)', async (d) => {
    const bad = []; for (const [st, w, h] of [['conv-strip-shared', 390, 844], ['activity', 320, 568], ['notif', 390, 1960], ['edu', 320, 568], ['conv-call', 430, 932], ['notif-lock', 390, 844], ['analysis-call-security', 320, 568], ['analysis-call-reminder', 430, 932], ['analysis-exit', 320, 568]]) { const c = await page({ state: st, w, h, defect: d }); const ctl = await c.eval('P3.controls()'); for (const x of ctl) if (!x.hidden && (x.w < 44 || x.h < 44)) bad.push(`${st}@${w}:${x.name}(${x.w}×${x.h})`); }
    return { pass: bad.length === 0, detail: bad.slice(0, 6).join(', ') || '9 pages' };
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
  // ---- P3-A refinement §4: the accepted selections
  ['C-SEL-1', 'Selections', 'Open Ledger is the accepted Activity entry (Quiet Bell is comparison / history only) and the one the shell draws', async (d) => {
    const c = await page({ state: 'conv', defect: d }); const r = await c.eval(`(()=>{const s=document.querySelector('#act-entry svg');const as=(k)=>{const t=document.createElement('div');t.innerHTML=P3DATA.glyphs[k];return t.firstElementChild.outerHTML};return {ledger:s.outerHTML===as('act-ledger'),bell:s.outerHTML===as('act-bell')}})()`);
    return { pass: GL.ACTIVITY_ACCEPTED === 'ledger' && GL.ACTIVITY_VARIANTS.ledger.accepted === true && GL.ACTIVITY_VARIANTS.bell.accepted === false && r.ledger && !r.bell, detail: JSON.stringify(r) };
  }],
  ['C-SEL-2', 'Selections', 'Open Link is the FINAL Introductions row mark and the one the shell draws by default; At the Door is comparison / history only; the two-opening drawing is only a withdrawn (rejected) drawing', async (d) => {
    const c = await page({ state: 'activity', q: { filter: 'intro' }, defect: d }); const r = await c.eval(`(()=>{const s=document.querySelector('.row[data-cat="intro"] .gl svg');const as=(k)=>{const t=document.createElement('div');t.innerHTML=P3DATA.glyphs[k];return t.firstElementChild.outerHTML};return {accepted:P3DATA.introAccepted,link:s.outerHTML===as('introLink20'),door:s.outerHTML===as('introDoor20'),old:s.outerHTML===as('introTwoArcs20')}})()`);
    const meta = GL.INTRO_ACCEPTED === 'link' && GL.INTRO_VARIANTS.link.accepted === true && GL.INTRO_VARIANTS.door.accepted === false && /comparison \/ history only/.test(GL.INTRO_VARIANTS.door.role) && !('introTwoArcs' in GL.P3G) && 'introTwoArcs' in GL.WITHDRAWN;
    return { pass: meta && r.accepted === 'link' && r.link && !r.door && !r.old, detail: JSON.stringify({ meta, ...r }) };
  }],
  ['C-ANL-1', 'Analysis', 'the Analysis never gains the Activity entry (G3 composition untouched); the non-Analysis shell keeps it', async (d) => {
    const out = [];
    for (const [st, lang, w, h] of [['analysis', 'ar', 390, 844], ['analysis', 'en', 390, 844], ['analysis-call', 'ar', 390, 844], ['analysis-call-security', 'ar', 320, 568], ['analysis-call-reminder', 'en', 430, 932]]) {
      const c = await page({ state: st, lang, w, h, defect: d }); out.push({ st, lang, w, place: await c.eval(`document.getElementById('phone').dataset.place`), entry: await c.eval(`!!document.getElementById('act-entry')`) });
    }
    for (const st of ['conv', 'shared-strip-qandeel']) { const c = await page({ state: st, defect: d }); out.push({ st, place: await c.eval(`document.getElementById('phone').dataset.place`), entry: await c.eval(`!!document.getElementById('act-entry')`) }); }
    return { pass: out.every((x) => (x.place === 'analysis' ? !x.entry : x.entry)), detail: out.map((x) => `${x.st}${x.w ? '@' + x.w : ''}:${x.entry ? 'entry' : 'none'}`).join(' ') };
  }],
  ['C-ANL-2', 'Analysis', 'Activity stays one step away: «المحادثة» leads from the Analysis back to the Conversation, where the entry is', async (d) => {
    const c = await page({ state: 'analysis', defect: d }); await c.eval(`document.getElementById('g32').contentDocument.getElementById('back').click()`); await c.eval('P3.tick(400)');
    const r = await c.eval(`({place:P3.S.place,entry:!!document.getElementById('act-entry')})`); return { pass: r.place === 'conv' && r.entry, detail: JSON.stringify(r) };
  }],
  // ---- final micro-refinement §5–§7: no ordinary strip inside the Analysis; re-evaluation on exit
  ['C-ANL-3', 'Analysis', 'inside the Analysis (no call) a Shared reply, a Public reply, an Introduction and a Proactive note create NO strip, no transient region and no announcement; each waits, marked, for Activity — Arabic 390, English 320', async (d) => {
    const out = [];
    for (const [lang, w, h] of [['ar', 390, 844], ['en', 320, 568]]) {
      const c = await page({ state: 'analysis-deferred', lang, w, h, defect: d }); await c.eval('P3.tick(2000)');
      out.push(await c.eval(`({place:P3.S.place,strip:!!document.querySelector('.strip'),regions:document.querySelectorAll('#ui [role=region]').length,said:document.getElementById('a11y').textContent,shown:P3.S.shown.length,waiting:P3.S.deferred.map(e=>e.id).join(),feed:P3.S.feed.slice(0,4).map(i=>i.category+':'+i.attention).join(),g3:P3.g32()&&P3.g32().place})`));
    }
    return { pass: out.every((x) => x.place === 'analysis' && !x.strip && x.regions === 0 && x.said === '' && x.shown === 0 && x.waiting === 'E-reply,E-preply,E-intro,E-pro' && x.feed === 'qandeel:unseen,intro:unseen,public:unseen,shared:unseen' && x.g3 === 'analysis'), detail: JSON.stringify(out) };
  }],
  ['C-EXIT-3', 'Exit', 'leaving the Analysis by «المحادثة» (G3\'s own control) re-evaluates what waited: exactly ONE strip over the next 9 s — never a dump, never nothing — and the others stay in Activity with the mark', async (d) => {
    const out = [];
    for (const q of [{}, { arrive: 'reply' }]) {
      const c = await page({ state: 'analysis-deferred', q, defect: d });
      await c.eval(`document.getElementById('g32').contentDocument.getElementById('back').click()`); await c.eval('P3.tick(9000)');
      out.push(await c.eval(`({place:P3.S.place,shown:P3.S.shown.join(),waiting:P3.S.deferred.length,unseen:P3.S.feed.filter(i=>i.attention==='unseen').length})`));
    }
    return { pass: out[0].place === 'conv' && out[0].shown === 'E-reply' && out[0].waiting === 0 && out[0].unseen === 4 && out[1].shown === 'E-reply' && out[1].unseen === 1, detail: JSON.stringify(out) };
  }],
  ['C-EXIT-4', 'Exit', 'nothing is shown merely because it once waited: a Shared reply deferred in the Analysis whose World is muted before the user leaves gives no strip on exit, and stays in Activity', async (d) => {
    const c = await page({ state: 'analysis-exit', q: { arrive: 'reply', mute: 'w-summer' }, defect: d }); await c.eval('P3.tick(9000)');
    const r = await c.eval(`({place:P3.S.place,shown:P3.S.shown.join(),inFeed:P3.S.feed.some(i=>i.id.startsWith('E-reply'))})`);
    return { pass: r.place === 'conv' && r.shown === '' && r.inFeed, detail: JSON.stringify(r) };
  }],
  // ---- §6: the L1 words
  ['C-COPY-1', 'Copy', 'L1 reads «إظهار النوع» / "Show type" everywhere it is shown; the withdrawn «تنبيه عام» / "General" is gone', async (d) => {
    const html = readFileSync(join(PKG, 'prototype', 'index.html'), 'utf8'); const out = [];
    for (const lang of ['ar', 'en']) { const c = await page({ state: 'notif-lock', lang, defect: d }); out.push(await c.eval(`document.querySelector('[data-level="L1"]').textContent`)); }
    return { pass: COPY.ar.levels.L1.text === 'إظهار النوع' && COPY.en.levels.L1.text === 'Show type' && out[0].startsWith('إظهار النوع') && out[1].startsWith('Show type') && !/تنبيه عام/.test(out.join()) && !/^General/.test(out[1]) && !html.includes('"text":"تنبيه عام"') && !html.includes('"text":"General"'), detail: out.map((t) => t.slice(0, 24)).join(' | ') };
  }],
  ['C-RED-5', 'Reduce', 'Settings explain «أقل» / Reduce in words, with no class, number or threshold', async (d) => {
    const out = []; for (const lang of ['ar', 'en']) { const c = await page({ state: 'notif', lang, h: 1960, q: { proactive: 'reduce' }, defect: d }); out.push(await c.eval(`({t:document.getElementById('pro-help').textContent,on:document.querySelector('[data-pro="reduce"]').getAttribute('aria-checked'),desc:document.querySelector('.seg').getAttribute('aria-describedby')})`)); }
    return { pass: out[0].t === COPY.ar.proactiveOptHelp.reduce.text && out[1].t === COPY.en.proactiveOptHelp.reduce.text && out.every((x) => x.on === 'true' && x.desc === 'pro-help' && !/[0-9٠-٩]|class|فئة/i.test(x.t)), detail: out.map((x) => x.t).join(' | ') };
  }],
  // ---- §8: the call-safe strip
  ['C-CALL-3', 'Live Call', 'the one bounded exception, measured on G3\'s own elements at 320, 390 and 430: the call-safe strip temporarily and intentionally occludes the Replay slot and nothing else — it stays in the chrome row (y ≤ 95, so the world floor is untouched) and clear of «المحادثة», the Timeline, Return Live, the band and the call line', async (d) => {
    const hit = (a, b) => !!b && a.x < b.r && a.x + a.w > b.x && a.y < b.b && a.y + a.h > b.y; const bad = [], seen = [];
    for (const [st, lang, w, h] of [['analysis-call-security', 'ar', 320, 568], ['analysis-call-security', 'en', 320, 568], ['analysis-call-reminder', 'en', 320, 568], ['analysis-call-security', 'ar', 390, 844], ['analysis-call-reminder', 'en', 390, 844], ['analysis-call-security', 'en', 430, 932]]) {
      const c = await page({ state: st, lang, w, h, defect: d }); const g = await c.eval('P3.g32()'), s = (await c.eval(`P3.rects('.strip')`))[0];
      const id = `${st}/${lang}@${w}`; if (!s) { bad.push(id + ':no strip'); continue; }
      seen.push(`${id}:${g.state}`);
      if (s.y < 47 || s.y + s.h > 95) bad.push(id + ':leaves chrome row'); if (s.x < 0 || s.x + s.w > w) bad.push(id + ':off phone');
      for (const k of ['back', 'tl', 'live', 'band', 'line']) if (hit(s, g[k])) bad.push(`${id}:covers ${k}`);
      if (!hit(s, g.replay)) bad.push(id + ':does not sit on the Replay slot');
      if (g.place !== 'analysis' || g.call !== 'live') bad.push(id + ':call ' + g.call);
    }
    return { pass: bad.length === 0 && seen.length === 6, detail: bad.join(', ') || seen.join(' ') };
  }],
  ['C-CALL-4', 'Live Call', 'ordinary Shared, Introduction and Proactive arrivals during a call show no strip on the Analysis (they wait, marked, in Activity)', async (d) => {
    const c = await page({ state: 'analysis-call', defect: d }); const r = await c.eval(`({strip:!!document.querySelector('.strip'),d:P3.S.deferred.length,log:P3.S.log.slice(0,3)})`);
    return { pass: !r.strip && r.d === 3, detail: JSON.stringify(r) };
  }],
  ['C-CALL-5', 'Live Call', 'critical security and a requested reminder show the call-safe strip on both call surfaces; it has no Direct Entry, dismissing it leaves the call running, and the security item still waits in Activity', async (d) => {
    const out = [];
    for (const [st, lang] of [['analysis-call-security', 'ar'], ['analysis-call-reminder', 'en'], ['conv-call-security', 'ar'], ['conv-call-reminder', 'en']]) {
      const c = await page({ state: st, lang, defect: d });
      const a = await c.eval(`({s:!!document.querySelector('.strip.callsafe'),go:!!document.querySelector('.strip button.go'),lab:(document.querySelector('.strip')||{getAttribute(){return ''}}).getAttribute('aria-label')})`);
      await c.eval(`document.querySelector('.strip .x')&&document.querySelector('.strip .x').click()`); await c.eval('P3.tick(400)');
      const b = await c.eval(`({s:!!document.querySelector('.strip'),call:P3.S.call,g:P3.g32()&&P3.g32().call,sec:P3.S.feed.filter(i=>i.kind==='security'&&i.actionable).length})`);
      out.push({ st, ok: a.s && !a.go && a.lab === COPY[lang].callSafeRegion.text && !b.s && b.call === true && (!st.startsWith('analysis') || b.g === 'live') && (!st.endsWith('security') || b.sec >= 1) });
    }
    return { pass: out.every((x) => x.ok), detail: out.map((x) => `${x.st}:${x.ok}`).join(' ') };
  }],
  ['C-CALL-6', 'Live Call', 'call-safe motion: no pulse, bounce or loop; Reduced Motion keeps the same appear, hold and dismiss with no travel (M08 / M08r)', async () => {
    const a = JSON.parse(readFileSync(join(PKG, 'data', 'motion', 'M08-call-safe-security-analysis.json'), 'utf8')).truth, b = JSON.parse(readFileSync(join(PKG, 'data', 'motion', 'M08r-call-safe-security-reduced-motion.json'), 'utf8')).truth;
    const y = (f) => (f.strip && f.strip.t ? parseFloat(f.strip.t.match(/-?[\d.]+(?:e-?\d+)?/)[0]) : 0);
    const span = (t) => { const on = t.filter((f) => f.strip).map((f) => f.i); return [on[0], on[on.length - 1]]; };
    let prev = -Infinity, mono = true; for (const f of a) { if (!f.strip) continue; if (f.t > 1000) break; if (y(f) < prev - 1e-6) mono = false; prev = y(f); }
    const sa = span(a), sb = span(b), travel = b.some((f) => f.strip && f.strip.t && /translateY\((?!0px)/.test(f.strip.t));
    return { pass: mono && a.every((f) => y(f) <= 0 && y(f) >= -6) && !travel && Math.abs(sa[0] - sb[0]) <= 1 && Math.abs(sa[1] - sb[1]) <= 3, detail: `standard frames ${sa}; reduced ${sb}` };
  }],
  ['C-CALL-7', 'Live Call', 'focus is never hidden under the occluded Replay: when G3\'s Replay takes keyboard focus, the call-safe strip steps aside at once and the call continues', async (d) => {
    const out = []; for (const [lang, w, h] of [['ar', 390, 844], ['en', 320, 568]]) {
      const c = await page({ state: 'analysis-call-security', lang, w, h, defect: d }); const before = await c.eval(`!!document.querySelector('.strip')`);
      await c.eval(`document.getElementById('g32').contentDocument.getElementById('replay').focus()`); await c.eval('P3.tick(400)');
      out.push({ lang, before, after: await c.eval(`!!document.querySelector('.strip')`), focus: await c.eval(`document.getElementById('g32').contentDocument.activeElement.id`), call: await c.eval('P3.S.call') });
    }
    return { pass: out.every((x) => x.before && !x.after && x.focus === 'replay' && x.call === true), detail: JSON.stringify(out) };
  }],
  // ---- §9: the Introductions row mark
  ['C-GLY-1', 'Glyph', 'the Introductions mark obeys P2 N1 with no exception: no ring with more than one opening (both the accepted Open Link and the At the Door comparison)', async (d) => {
    const out = []; for (const v of [null, 'door']) { const c = await page({ state: 'activity', q: { filter: 'intro', ...(v ? { introglyph: v } : {}) }, defect: d }); out.push({ v: v || 'link', ...(await c.eval(`(${GLYPH_JS})('.row[data-cat="intro"] .gl svg')`)) }); }
    return { pass: out.every((x) => !x.ring || x.gaps === 1) && !out[0].ring, detail: out.map((x) => `${x.v}: ring ${x.ring} (${x.coverage}°) openings ${x.gaps}`).join(' · ') };
  }],
  ['C-GLY-2', 'Glyph', 'no face-reading (points never side by side on a horizontal) and no collision with the World glyphs or the Activity ledger', async (d) => {
    const c = await page({ state: 'activity', q: { filter: 'intro' }, defect: d }); const me = await c.eval(`(${GLYPH_JS})('.row[data-cat="intro"] .gl svg')`); const sig = (x) => [x.ring ? 1 : 0, x.gaps, x.dots.length, x.dotsOnRing].join('|');
    const others = {}; for (const k of ['navMine20', 'navShared20', 'navPublic20', 'act-ledger']) others[k] = sig(await c.eval(`(${GLYPH_JS})(null, P3DATA.glyphs[${JSON.stringify(k)}])`));
    return { pass: !me.face && me.dots.length === 2 && Object.values(others).every((s) => s !== sig(me)), detail: `intro ${sig(me)} vs ${JSON.stringify(others)}; face ${me.face}` };
  }],
  ['C-GLY-3', 'Glyph', 'the same optical system: the stroke is P2\'s optical stroke for 20 px, round terminals, the 24-unit grid, everything inside the live area', async (d) => {
    const c = await page({ state: 'activity', q: { filter: 'intro' }, defect: d }); const x = await c.eval(`(${GLYPH_JS})('.row[data-cat="intro"] .gl svg')`);
    return { pass: x.viewBox === '0 0 24 24' && x.strokes.length > 0 && x.strokes.every((s) => s === 1.75) && x.caps.every((k) => k === 'round') && x.ext[0] >= 2 && x.ext[1] <= 22, detail: JSON.stringify({ strokes: x.strokes, caps: x.caps, ext: x.ext }) };
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
  ['C-SCOPE-4', 'Scope', 'the Analysis is G3\'s own frozen page: prototype/g3.2/index.html is byte-identical to the preserved G3.2 canonical artifact (G3 closure: 10611f35…83d71)', () => {
    const g = JSON.parse(readFileSync(join(SOURCE, 'PROVENANCE.json'), 'utf8')).g32; const here = sha(readFileSync(join(PKG, 'prototype', 'g3.2', 'index.html'))), canon = sha(readFileSync(join(REPO, ...g.from.split('/'))));
    return { pass: here === g.sha256 && canon === g.sha256 && here.startsWith('10611f35') && here.endsWith('83d71'), detail: `${here.slice(0, 8)}…${here.slice(-5)} (canonical ${canon.slice(0, 8)})` };
  }],
  ['C-LIFE-1', 'Lifecycle', 'the package never claims P3 CLOSED / FROZEN', () => {
    const files = walk(PKG).filter((p) => /\.(md|json|html|mjs|js)$/.test(p)); if (!files.length) throw new Error('scanned nothing');
    const bad = []; for (const f of files) for (const line of readFileSync(f, 'utf8').split('\n')) if (/P3\W{0,6}(is\W+)?CLOSED\s*\/\s*FROZEN/i.test(line) && !/\bNOT\b|NOT CLOSED|never|must not|does not|claim/i.test(line)) bad.push(relative(PKG, f));
    return { pass: bad.length === 0, detail: `${files.length} files scanned; ${[...new Set(bad)].join(', ') || 'no claim'}` };
  }],
];

// ------------------------------------------------------------------------------------------ documentation truth
// The package's words must say what the geometry shows (final micro-refinement §8): the call-safe strip DOES occlude the
// Replay slot, intentionally and temporarily, so no document may claim it covers no frozen control; the rejected ordinary
// Analysis strip may appear only labelled as rejected; the decision summary leaves no Product / craft question open.
const ACCEPTED_REPLAY = 'Temporary intentional Replay occlusion is the one bounded exception';
const FALSE_CLAIM = /covers?\s+(?:nothing\s+frozen|no\s+frozen\s+control)|no\s+frozen\s+control\s+is\s+covered|nothing\s+frozen\s+is\s+covered/i;
function docCorpus() {
  const files = [join(PKG, 'P3_READ_FIRST.md'), ...readdirSync(join(PKG, 'docs')).filter((n) => n.endsWith('.md')).map((n) => join(PKG, 'docs', n)), join(PKG, 'data', 'BOARDS.json')];
  return Object.fromEntries(files.map((p) => [relative(PKG, p).replace(/\\/g, '/'), readFileSync(p, 'utf8')]));
}
const DOC_CHECKS = [
  ['C-DOC-1', 'Documentation', 'the words match the geometry: nothing claims the call-safe strip covers no frozen control; the accepted wording (Replay is the one temporarily, intentionally occluded control) is stated; the rejected ordinary Analysis strip appears only labelled REJECTED; the decision summary leaves only copy and device / implementation items open', (corpus) => {
    const bad = [];
    for (const [f, t] of Object.entries(corpus)) if (FALSE_CLAIM.test(t.replace(/\s+/g, ' ')) && !t.split('\n').some((l) => FALSE_CLAIM.test(l))) bad.push(`${f}: false claim (wrapped across lines)`);
    for (const [f, t] of Object.entries(corpus)) t.split('\n').forEach((l, i) => { if (FALSE_CLAIM.test(l)) bad.push(`${f}:${i + 1} false claim`); if (/analysis-strip-shared/.test(l) && !/REJECTED/.test(l)) bad.push(`${f}:${i + 1} unlabelled analysis-strip-shared`); });
    for (const f of ['P3_READ_FIRST.md', 'docs/P3_ATTENTION_STRIP_SPEC.md', 'docs/P3_PRODUCT_PROOF_REPORT.md']) if (!(corpus[f] || '').replace(/\s+/g, ' ').includes(ACCEPTED_REPLAY)) bad.push(f + ': accepted Replay wording missing');
    const open = (JSON.parse(corpus['data/BOARDS.json']).B18 || {}).open || [];
    if (!open.length || open.some((o) => !/^(Copy only|Device \/ implementation):/.test(o) || /Open Link|At the Door|Replay|Direct Entry/.test(o.replace(/call-safe region name/g, '')))) bad.push('board 18 leaves a Product / craft question open');
    return { pass: bad.length === 0, detail: bad.slice(0, 6).join(' · ') || `${Object.keys(corpus).length} documents; open items: ${open.length} (copy / device only)` };
  }],
];
const DOCDEF = {
  D29: ['the Attention Strip spec claims the call-safe strip covers no frozen control', (c) => ({ ...c, 'docs/P3_ATTENTION_STRIP_SPEC.md': c['docs/P3_ATTENTION_STRIP_SPEC.md'] + '\nIn the Analysis the call-safe strip covers no frozen control.\n' }), ['C-DOC-1']],
};

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
  // ---- P3-A refinement
  D17: ['a universal Introductions cap (every Introduction ≤ L1)', (s) => mutate(s, "const level = minLevel(e.safeMax ?? 'L3', s.lock[subj] ?? DISCLOSURE_DEFAULTS[subj]);", "const level = minLevel(subj === 'intro' ? 'L1' : (e.safeMax ?? 'L3'), s.lock[subj] ?? DISCLOSURE_DEFAULTS[subj]);"), null, ['C-PRIV-6', 'C-FG-1']],
  D19: ['Reduce implemented as a hard "Class 2 only" rule', (s) => mutate(s, "s.proactive === 'reduce' && e.reduceEligible !== true)", "s.proactive === 'reduce' && e.cls >= 3)"), null, ['C-RED-1', 'C-RED-4']],
  D20: ['critical security deferred during a Live Call', (s) => mutate(s, "export const isCallSafe = (e) =>", "export const isCallSafe = (e) => false &&"), 'calldefer', ['C-CALL-2m', 'C-CALL-5']],
  // ---- P3-A final micro-refinement
  D24: ['REJECTED / PLANTED DEFECT — ORDINARY STRIP INSIDE ANALYSIS: a Shared reply becomes a normal strip in the Analysis', (s) => mutate(s, "if (ctx.view === 'analysis') { R.push('analysis-deferred'); return out('deferred'); }", ''), 'analysisstrip', ['C-ANL-3m', 'C-FG-1', 'C-ANL-3']],
  D25: ['a deferred Analysis event is never re-evaluated on exit', (s) => mutate(s, 'const results = pending.map((e) => ({ id: e.id, e, ...decide(e, ctx) }));', "const results = pending.map((e) => ({ id: e.id, e, surface: 'deferred', reasons: ['never-re-evaluated'], mark: true }));"), 'noreeval', ['C-EXIT-1m', 'C-EXIT-3']],
  D26: ['multiple deferred Analysis events dump multiple strips on exit', (s) => mutate(s, "for (const r of strips.slice(1)) { r.surface = 'activity'; r.reasons = [...r.reasons, 'one-strip-at-a-time']; }", ''), 'dump', ['C-EXIT-2m', 'C-EXIT-3']],
  D21: ['an ordinary Shared reply shown during a Live Call', (s) => mutate(s, "if (ctx.liveCall && !isCallSafe(e))", "if (ctx.liveCall && !isCallSafe(e) && e.category !== 'shared')"), 'callshared', ['C-CALL-1m', 'C-CALL-4', 'C-STRIP-2']],
};
const DOMDEF = {
  D1: ['a red global “37” badge', 'redbadge', ['C-MARK-2', 'C-MARK-3']],
  D2: ['an Introductions count “12”', 'introcount', ['C-MARK-4']],
  D4: ['a first-launch permission popup', 'firstlaunch', ['C-PERM-1']],
  D9: ['Activity painted Analysis-dark under Light', 'actdark', ['C-A11Y-8']],
  D10: ['a Brass attention dot', 'brassdot', ['C-MARK-1']],
  D15: ['a settings row whose accessible name is glued from two texts', 'gluedname', ['C-A11Y-1b']],
  D16: ['a modal that leaves the page behind it reachable', 'noinert', ['C-A11Y-9']],
  D18: ['the withdrawn L1 label «تنبيه عام» / "General" restored', 'oldl1', ['C-COPY-1']],
  D22: ['the Activity entry added to the Analysis chrome', 'analysisentry', ['C-ANL-1']],
  D23: ['the withdrawn two-opening Introductions ring restored', 'oldintro', ['C-GLY-1', 'C-SEL-2']],
  D27: ['the call-safe strip "covers no frozen control": moved off the Replay slot, below the chrome row, into the world floor', 'badslot', ['C-CALL-3']],
  D28: ['the call-safe strip gets a Direct Entry', 'callentry', ['C-CALL-5']],
};

async function runModel(M, only = null, src = MODEL_SRC) {
  const out = [];
  for (const [id, g, title, fn] of MODEL_CHECKS) { if (only && !only.includes(id)) continue; let r; try { r = fn(M); } catch (e) { r = { pass: false, detail: 'threw: ' + e.message }; } out.push({ id, group: g, title, ...r }); }
  for (const [id, g, title, fn] of MODEL_STATIC) { if (only && !only.includes(id)) continue; let r; try { r = fn(src); } catch (e) { r = { pass: false, detail: 'threw: ' + e.message }; } out.push({ id, group: g, title, ...r }); }
  return out;
}
async function runDom(defect = null, only = null) { const out = []; for (const [id, g, title, fn] of DOM_CHECKS) { if (only && !only.includes(id)) continue; let r; try { r = await fn(defect); } catch (e) { r = { pass: false, detail: 'threw: ' + e.message }; } out.push({ id, group: g, title, ...r }); } return out; }

const M0 = await loadModel(MODEL_SRC, 'base');
const runDoc = (corpus, only = null) => DOC_CHECKS.filter(([id]) => !only || only.includes(id)).map(([id, g, title, fn]) => { let r; try { r = fn(corpus); } catch (e) { r = { pass: false, detail: 'threw: ' + e.message }; } return { id, group: g, title, ...r }; });
const CORPUS = docCorpus();
const results = [...STATIC_CHECKS.map(([id, g, title, fn]) => { let r; try { r = fn(); } catch (e) { r = { pass: false, detail: 'threw: ' + e.message }; } return { id, group: g, title, ...r }; }), ...runDoc(CORPUS), ...await runModel(M0), ...await runDom()];
const planted = [];
for (const [id, [desc, mut, domDefect, targets]] of Object.entries(MUT)) {
  const src = mut(MODEL_SRC), Mm = await loadModel(src, id);
  const rr = [...await runModel(Mm, targets, src), ...(domDefect ? await runDom(domDefect, targets) : [])];
  const caught = rr.filter((x) => !x.pass).map((x) => x.id);
  planted.push({ id, desc, via: domDefect ? `model mutation + ?defect=${domDefect}` : 'model mutation', targets, caughtBy: caught, rejected: caught.length > 0 });
}
for (const [id, [desc, defect, targets]] of Object.entries(DOMDEF)) {
  const rr = await runDom(defect, targets); const caught = rr.filter((x) => !x.pass).map((x) => x.id);
  planted.push({ id, desc, via: `?defect=${defect}`, targets, caughtBy: caught, rejected: caught.length > 0 });
}
for (const [id, [desc, inject, targets]] of Object.entries(DOCDEF)) {
  const caught = runDoc(inject(CORPUS), targets).filter((x) => !x.pass).map((x) => x.id);
  planted.push({ id, desc, via: 'document mutation', targets, caughtBy: caught, rejected: caught.length > 0 });
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
