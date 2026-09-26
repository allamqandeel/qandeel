// P3-A — composes the 18 review boards from the real captures (WORK/shots, data/SHOTS.json) and the model, and draws
// the one board-level clip (M06, Quiet Hours end). Each board answers ONE question (data/BOARDS.json).
//   node source/tools/p3boards.mjs [boardIds…]
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { renderSheet, sheetBrowser, closeSheetBrowser } from './lib/sheet.mjs';
import { openState, closeBrowser, closeServers, WORK, PKG, SOURCE, sleep } from './lib/session.mjs';
import * as M from '../src/model.mjs';
import * as FX from '../src/fixtures.mjs';
import { COPY, projectionWords } from '../src/content.mjs';
import { P3G, WITHDRAWN, ledgerCutVisible, ringCutVisible, linkGapVisible } from '../src/p3glyphs.mjs';
import { glyph as sigGlyph } from '../src/sig.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const SH = JSON.parse(readFileSync(join(PKG, 'data', 'SHOTS.json'), 'utf8'));
const shotUrl = (n) => { if (!SH[n]) throw new Error('no shot ' + n); return pathToFileURL(join(WORK, 'shots', `${n}.png`)).href; };
const FONT_URL = pathToFileURL(join(SOURCE, 'vendor', 'fonts', 'Estedad-wght-v8.5.woff2')).href;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const FOOT = 'QANDEEL · P3-A Notification + Activity — integrated visual proof + refinement / decision gate · P3 NOT CLOSED / NOT FROZEN · no production runtime · phones are Product captures at 2× (no harness); every diagnostic is outside them';

const CSS = `@font-face{font-family:Estedad;src:url(${FONT_URL}) format('woff2');font-weight:100 900}
*{box-sizing:border-box}html,body{margin:0;background:#0d0d0d}
body{font-family:Estedad;color:#d6d3c8;-webkit-font-smoothing:antialiased}
.board{width:1900px;padding:46px 52px 34px}
h1{font-size:30px;line-height:1.3;font-weight:600;margin:0 0 10px;color:#ece9df}
.q{font-size:16px;line-height:1.6;color:#bdbab0;max-width:1560px;margin:0}
.row{display:flex;gap:28px;align-items:flex-start;margin-top:26px;flex-wrap:nowrap}.row>*{flex-shrink:0}
.wrap{display:flex;gap:26px;align-items:flex-start;margin-top:26px;flex-wrap:wrap}.wrap>*{flex-shrink:0}
figure{margin:0}figure img{display:block}.ph img{border-radius:26px}
figcaption{font-size:14px;line-height:1.5;margin-top:10px;color:#d6d3c8}
.m{display:block;font:11px/1.55 ui-monospace,Consolas,monospace;color:#8b8982;margin-top:3px}
.clip{position:relative;overflow:hidden;border-radius:14px;background:#000}
.clip img{position:absolute;max-width:none}
.note{font-size:14px;line-height:1.65;color:#bdbab0;max-width:1700px;margin-top:22px}
.note b{color:#ece9df;font-weight:600}
.foot{margin-top:30px;font:11px/1.5 ui-monospace,Consolas,monospace;color:#6f6d67}
table{border-collapse:collapse;font-size:13px;line-height:1.45}th,td{text-align:left;padding:6px 10px;border-bottom:1px solid #262626;vertical-align:top}
th{color:#8b8982;font-weight:500;font-size:12px}td.ok{color:#9fd49a}td.no{color:#e0a36a}
.tag{display:inline-block;font:600 10px/1 ui-monospace,Consolas,monospace;letter-spacing:.05em;padding:4px 6px;border-radius:4px;background:#2a2a2a;color:#d6d3c8}
.tag.def{background:#d8d5ca;color:#101010}.tag.warn{background:#3a2c1c;color:#e0b650}
.col{display:flex;flex-direction:column;gap:14px}
.card{background:#151515;border:1px solid #232323;border-radius:14px;padding:16px 18px}
.h3{font-size:15px;font-weight:600;color:#ece9df;margin:0 0 8px}
.ar{font-family:Estedad}`;

const page = (title, q, body, extra = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${CSS}${extra}</style></head><body dir="ltr"><div class="board"><h1>${title}</h1><p class="q">${q}</p>${body}<p class="foot">${FOOT}</p></div></body></html>`;

/** A full phone at scale s (CSS px), with its caption. */
function phone(n, cap = '', s = 1) {
  const m = SH[n], w = m.w || 390, h = m.h || 844;
  return `<figure class="ph" style="width:${w * s}px"><img src="${shotUrl(n)}" width="${w * s}" height="${h * s}"><figcaption>${cap}<span class="m">${w}×${h} · ${m.lang === 'ar' ? 'Arabic' : 'English'} · ${m.appearance === 'system' ? `System → ${m.probe.appearance}` : m.appearance === 'light' ? 'Light' : 'Dark'}${m.contrast ? ' · Increased Contrast' : ''}${m.rm ? ' · Reduced Motion' : ''} · ${n}</span></figcaption></figure>`;
}
/** A crop of a shot: rect in the phone's CSS px, magnified by s. */
function crop(n, r, s = 1, cap = '', pad = 8) {
  const m = SH[n], w = m.w || 390, h = m.h || 844;
  const x = Math.max(0, r.x - pad), y = Math.max(0, r.y - pad), cw = Math.min(w - x, r.w + 2 * pad), ch = Math.min(h - y, r.h + 2 * pad);
  return `<figure style="width:${cw * s}px"><div class="clip" style="width:${cw * s}px;height:${ch * s}px"><img src="${shotUrl(n)}" style="left:${-x * s}px;top:${-y * s}px;width:${w * s}px;height:${h * s}px"></div>${cap ? `<figcaption>${cap}<span class="m">${n}</span></figcaption>` : ''}</figure>`;
}
const R = (n, sel, i = 0) => { const r = SH[n].rects[sel]; if (!r || !r[i]) throw new Error(`no rect ${sel}[${i}] in ${n}`); return r[i]; };
const band = (n, y0, y1) => ({ x: 0, y: y0, w: SH[n].w || 390, h: y1 - y0 });
const rowRect = (n, id) => { const i = FX.FEED.findIndex((f) => f.id === id); return R(n, '.row', i); };

// ------------------------------------------------------------------------------------------------ boards
const B = {};
const QS = {};
function board(id, file, title, q, body, extra) { B[id] = { file, html: page(title, q, body, extra) }; QS[id] = { file: `boards/${file}`, question: q.replace(/<[^>]+>/g, '') }; }

// 01 / 02 — Activity in each language
board('B01', '01-activity-arabic-dark.png', 'Board 01 — Activity «النشاط», Arabic, Dark, 390',
  'Is Activity one quiet chronological feed — every category present without noise, the attention mark small and attached, one coalesced item, one inline action only where it is obvious — and not a card wall or a red unread wall?',
  `<div class="row">${phone('act-ad', 'As opened: new items carry the neutral mark at the source glyph’s upper END corner; the Introductions item carries the hollow WAITING mark (seen, still waiting for you).')}${phone('act-after-dwell-ad', 'A moment later: the rows that were on screen are SEEN and lose the NEW mark. The security item and the introduction keep the hollow WAITING mark: opening Activity does not clear everything (D47).')}${phone('act-stale-ad', 'Scrolled: the muted World (no mark, «مكتوم»), the stale item (tertiary, «لم يعد متاحًا») with its explanation and one explicit act into its own World — never a guessed destination (D39).')}
  <div class="col" style="width:540px"><div class="card"><p class="h3">Row grammar (P3-I)</p><p class="note" style="margin:0">source glyph (the P2 family, neutral ink) · source / context name · time · one event sentence · optional second line · at most ONE inline action («مراجعة» on the security item) · otherwise the whole row is the Direct Entry.</p></div>
  <div class="card"><p class="h3">What the feed holds (fixture, all synthetic)</p><table>${FX.FEED.map((f) => `<tr><td>${f.id}</td><td>${f.category}</td><td class="ar" dir="rtl">${esc(f.text.ar)}</td><td>${f.attention}${f.actionable ? ' · actionable' : ''}${f.coalesced ? ` · coalesced ×${f.coalesced}` : ''}${f.muted ? ' · muted World' : ''}${f.targetGone ? ' · stale target' : ''}</td></tr>`).join('')}</table></div>
  <div class="card"><p class="h3">Not here, on purpose</p><p class="note" style="margin:0">no card per item, no filled unread row, no red, no Living Brass (the navigation family’s material stays in the navigation), no raw total, no five permanent tabs, no Q mark on rows (the Q’s placement is C3 §8’s open question, not P3’s).</p></div></div></div>`);
board('B02', '02-activity-english-light.png', 'Board 02 — Activity, English, Light, 390',
  'Does the same feed hold in English left-to-right under Light — the same semantics, the mark at the upper END corner (now the right), the source column at the START (now the left) — without painting Activity as the dark Analysis?',
  `<div class="row">${phone('act-el', 'As opened.')}${phone('act-after-dwell-el', 'After the rows on screen are seen.')}${phone('act-stale-el', 'Muted World, stale item, explanation.')}${phone('system-appearance-light', 'Arabic, appearance setting = System while the device is Light: Activity follows it (P1 §12; P3-U).')}</div>
  <p class="note"><b>Appearance.</b> Activity is a non-Analysis surface. It follows the P1 preference Dark / Light / System; the new-user default is Dark. The permanently-dark Analysis rule (G3 §C.1) does not apply here — board 17 also shows the planted defect that would paint it dark under Light, and the check that rejects it.</p>`);

// 03 — filters
board('B03', '03-activity-filters.png', 'Board 03 — Lightweight filters, not five tabs',
  'Do All · From Qandeel · Shared · Public · Introductions · System work as quiet filters over ONE feed (All by default) — each item keeping its category, no destination of its own, and Introductions showing presence only?',
  `<div class="row">${['all', 'qandeel', 'shared', 'public', 'intro', 'system'].map((f) => phone(`filter-${f}-ad`, `«${COPY.ar.filters[f].text}»`, 0.62)).join('')}</div>
  <div class="row">${crop('filter-intro-el', R('filter-intro-el', '.filters'), 1.4, 'English, Introductions selected: the chip row scrolls; the selected filter is E1R SELECTED (marker + weight), never a filled pill.')}</div>
  <p class="note"><b>Semantics.</b> A group of toggle buttons (aria-pressed), not a tablist: there is one destination and six views of it. Counts appear only where allowed: Shared (a useful count of items needing attention — 1 coalesced row, not 3 messages), System (only actionable items). Public and From Qandeel show presence; Introductions shows presence ONLY (P3-F, D48).</p>`);

// 04 — attention states
const f = 'act-ad';
board('B04', '04-attention-states.png', 'Board 04 — Attention states are attention, not event truth',
  'Can unseen, seen, opened, actionable, coalesced and stale be told apart — by form and words, never by colour alone and never by pressure — while none of them resolves the source event?',
  `<div class="wrap">${[['F2', 'UNSEEN — the solid neutral mark; the sentence in primary ink.'], ['F6', 'SEEN — no mark (and this one is ambient: it never earned one).'], ['F7', 'OPENED — no mark; the sentence steps back to secondary ink. The governance change itself is unchanged.'], ['F5', 'ACTIONABLE, SEEN — the hollow WAITING mark: it stays until you act, because the proposal is still waiting.'], ['F3', 'ACTIONABLE, UNSEEN — the one inline action is obvious and useful («مراجعة»).'], ['F1', 'COALESCED — three messages of ONE World in one row; different Worlds are never merged (D09).'], ['F8', 'MUTED WORLD — listed, never marked, and said in words («مكتوم»).']].map(([id, cap]) => crop(f, rowRect(f, id), 1.25, cap)).join('')}
  ${crop('act-stale-ad', R('act-stale-ad', '.row', FX.FEED.findIndex((x) => x.id === 'F9')), 1.25, 'STALE — tertiary, «لم يعد متاحًا», the explanation and ONE explicit act into the originating World. Nothing is guessed (D39).')}
  ${crop('act-opened-ad', rowRect('act-opened-ad', 'F2'), 1.25, 'After the row was opened and the user came back: OPENED. The Proactive thread is not «done» — Seen ≠ Opened ≠ resolved (D31, D40, D41).')}</div>
  <p class="note"><b>Accessible names carry the same state in words</b> («جديد» / «في انتظارك» / «لم يعد متاحًا» inside each row’s name), so no state is colour-only (F1R2, E1R). The marks are neutral primary ink: in every appearance they are the same material as the text, not a status colour.</p>`);

// 05 — the global entry
const hdr = (n) => crop(n, band(n, 47, 95), 0.74, '');
const gl = (name, px) => `<svg width="${px}" height="${px}" viewBox="0 0 24 24" style="color:#d8d5ca">${name === 'navShared' ? sigGlyph('navShared', { size: 24 }) : P3G[name](px >= 48 ? 48 : 22)}</svg>`;
const grid = `<svg width="192" height="192" viewBox="0 0 24 24" style="position:absolute;inset:0"><rect x="2" y="2" width="20" height="20" fill="none" stroke="#3a3a3a" stroke-width=".05"/><circle cx="12" cy="12" r="8" fill="none" stroke="#2c2c2c" stroke-width=".05"/><rect x="4" y="4" width="16" height="16" fill="none" stroke="#333" stroke-width=".05" stroke-dasharray=".3 .3"/><line x1="2" y1="2" x2="22" y2="22" stroke="#2a2a2a" stroke-width=".05"/></svg>`;
const construct = (name, label, w = 210, dim = false) => `<figure style="width:${w}px"><div style="position:relative;width:${w - 18}px;height:${w - 18}px;background:#131313;border-radius:14px${dim ? ';opacity:.5' : ''}">${grid.replace(/192/g, String(w - 18))}<svg width="${w - 18}" height="${w - 18}" viewBox="0 0 24 24" style="position:absolute;inset:0;color:#d8d5ca">${(P3G[name] || WITHDRAWN[name])(48)}</svg></div><figcaption>${label}</figcaption></figure>`;
const band2 = (n) => crop(n, band(n, 47, 95), 0.74, '');
board('B05', '05-global-activity-entry.png', 'Board 05 — The global Activity entry: Open Ledger, ACCEPTED — and never in the Analysis',
  'Does the accepted Open Ledger entry sit in the global upper chrome of the non-Analysis shell without replacing the three-World navigation, stay neutral in every state (never Brass), show attention as presence — and stay OUT of the frozen Analysis chrome?',
  `<div class="row"><div class="col"><table><tr><th></th><th>no attention</th><th>attention present</th><th>pressed</th><th>keyboard focus</th><th>Increased Contrast (attention present)</th></tr>
  <tr><td>Arabic · Dark</td><td>${hdr('conv-rest-ad')}</td><td>${hdr('conv-ad')}</td><td>${hdr('entry-press-ad')}</td><td>${hdr('entry-focus-ad')}</td><td>${hdr('entry-more-ad')}</td></tr>
  <tr><td>Arabic · Light</td><td>${hdr('conv-rest-al')}</td><td>${hdr('conv-al')}</td><td></td><td></td><td>${hdr('entry-more-al')}</td></tr>
  <tr><td>English · Dark</td><td>${hdr('conv-rest-ed')}</td><td>${hdr('conv-ed')}</td><td></td><td></td><td></td></tr>
  <tr><td>English · Light</td><td>${hdr('conv-rest-el')}</td><td>${hdr('conv-el')}</td><td>${hdr('entry-press-el')}</td><td>${hdr('entry-focus-el')}</td><td></td></tr></table>
  <p class="note" style="max-width:1150px"><b>State channels are E1R’s.</b> PRESSED = the ground wash under the glyph; FOCUS = the detached perimeter; attention = the mark (presence only, never a number). There is no SELECTED entry state: opening Activity replaces the view, so the entry is never shown selected (and the navigation marker, a 2-pt bar, cannot be confused with the round mark).</p></div></div>
  <div class="row">${phone('conv-ad', 'Arabic, Dark: the entry at the START edge of the upper chrome (right); «تحليل المحادثة» and Replay keep their END-side places; the three Worlds keep the navigation.', 0.7)}<div class="card" style="width:560px"><p class="h3">The entry glyph — Product Owner decision (refinement §4.1)</p><div class="row" style="margin-top:6px">${construct('ledger', '<span class="tag def">ACCEPTED</span><br><b>Open Ledger.</b> Square keyline 16 u, radius 2 u, two equal rows; the QANDEEL cut at the lower END corner on the 45° diagonal, visible gap ' + ledgerCutVisible(22) + ' u (N1 ring cut chord: ' + ringCutVisible(22) + ' u). Not a ring: in P2 the ring means a World.', 250)}${construct('bell', '<span class="tag">COMPARISON / HISTORY ONLY</span><br><b>Quiet Bell</b> — kept as the first pass’s comparison; not the entry.', 250, true)}</div>${crop('bell-ad', band('bell-ad', 47, 95), 0.9, 'History: the Bell in the shell (first pass)')}</div>
  <div class="card" style="width:860px"><p class="h3">The Analysis never gains the entry (refinement §4.2) — G3’s own page, measured</p><table><tr><th></th><th>upper chrome</th></tr>
  <tr><td>Conversation (non-Analysis shell)</td><td>${band2('conv-ad')}</td></tr><tr><td>Analysis, Arabic</td><td>${band2('analysis-ad')}</td></tr><tr><td>Analysis, English (system Light: still dark, G3 §C.1)</td><td>${band2('analysis-el')}</td></tr><tr><td>Analysis in a Live Call</td><td>${band2('analysis-call-ad')}</td></tr></table>
  <p class="note" style="margin-top:10px">The Analysis frames here are G3.2’s reviewed prototype itself, byte-identical to the canonical artifact (check C-SCOPE-4), run unchanged in a frame. Activity is one step away: «المحادثة» returns to the Conversation, where the entry is (C-ANL-2). Planted defect D22 puts the entry into the Analysis chrome and C-ANL-1 rejects it.</p></div></div>
  <div class="row"><div class="card" style="width:1796px"><p class="h3">The Introductions source mark in Activity rows (refinement §9) — two bounded variants inside P2’s grammar, and the withdrawn first-pass drawing</p><div class="row" style="margin-top:6px">
  ${construct('link', '<span class="tag def">RECOMMENDED</span><br><b>Open Link</b> — no ring. navShared’s two points on the 45° diagonal through the cut, each reaching toward the other with one stroke; the strokes stop ' + linkGapVisible() + ' u apart. Before a Mutual Match there is no Shared World to draw: the link is offered, not made.', 300)}
  ${construct('door', '<span class="tag">COMPARISON</span><br><b>At the Door</b> — ONE open ring, the one N1 cut at 45°, one point inside and one standing in the opening. Compliant, but a ring means a World in P2: it risks reading as «قنديل» with a visitor.', 300)}
  ${construct('introTwoArcs', '<span class="tag warn">WITHDRAWN</span><br>First pass: two arcs = TWO openings, a second exception to one-opening-per-ring. History and planted defect D23 only.', 300, true)}
  <div class="col">${crop('filter-intro-link-el', R('filter-intro-link-el', '.row', 0), 1.3, 'Open Link in its row (20 px), English, Light')}${crop('act-ad', rowRect('act-ad', 'F5'), 1.3, 'Open Link in its row, Arabic, Dark')}${crop('filter-intro-door-ad', R('filter-intro-door-ad', '.row', 0), 1.3, 'At the Door in its row (comparison)')}
  <p class="note" style="margin:0;max-width:560px">Measured on the rendered row glyph (C-GLY-1…3): Open Link covers 2° of the N1 ring keyline (no ring, no opening); At the Door has exactly one opening; points on the diagonal (no face); signature distinct from «قنديل», the Shared and Public Worlds and the ledger; stroke 1.75 u, round terminals, inside the live area.</p></div></div></div></div>`);

// 06 — the strip
board('B06', '06-attention-strip.png', 'Board 06 — The in-app Attention Strip: when it appears, and when it does not',
  'Does the strip appear only when QANDEEL already has the user’s attention outside the event’s originating context — attached to the upper chrome, short, dismissible, Direct-Entry capable — and stay absent in the same context and, during an active Live Call, for everything except critical security and a requested exact-time reminder, which get a small call-safe strip that covers nothing frozen?',
  `<div class="row">${phone('strip-shared-ad', '<b>Shared</b> — in the Personal Conversation, a reply arrives in «رحلة الصيف». Product voice.', 0.7)}${phone('strip-qandeel-ad', '<b>From QANDEEL</b> — inside a Shared World, QANDEEL’s own follow-up (QANDEEL voice, D18).', 0.7)}${phone('strip-system-ad', '<b>System</b> — a new sign-in. MSA, neutral, no red: importance is not a colour.', 0.7)}${phone('inplace-ad', '<b>Same context — no strip.</b> Already in «رحلة الصيف»: the reply simply lands in the thread; no strip, no Push (D51).', 0.7)}${phone('call-ad', '<b>Live Call — no strip for ordinary attention.</b> The same reply (and an introduction) are deferred: only the entry’s mark changes; the call line is untouched (G3 §D).', 0.7)}${phone('call-ended-ad', '<b>After the call ends</b> — re-evaluated, the first still-eligible event is presented. Nothing is replayed in bulk.', 0.7)}</div>
  <div class="row">${phone('strip-shared-el', 'English, Light — the same strip LTR.', 0.74)}${crop('strip-shared-ad', R('strip-shared-ad', '.strip'), 1.6, 'The strip: the one Surface tone (an ASIDE: anchored, nonmodal, no scrim), source glyph, «source · الآن», one sentence (max 2 lines), a 44-pt dismiss. The whole body is the Direct Entry.')}
  <div class="card" style="width:560px"><p class="h3">Behaviour (clips M02, M03, M04)</p><p class="note" style="margin:0">appear 240 ms ease-out, 10 pt down from the chrome · readable hold 6 s, paused while it has focus or a finger, no countdown · dismisses by itself, or by ×, or enters on press · no bounce, no pulse, no loop · Reduced Motion: opacity only, the same hold, the same acts · one polite assistive announcement. Timings are craft, not frozen.</p></div></div>
  <h1 style="margin-top:34px;font-size:24px">During an active Live Call (refinement §8): ordinary attention waits; only two things may show a small call-safe strip</h1>
  <div class="row">${phone('analysis-call-ad', '<b>Ordinary — waits.</b> In the Analysis during a call, a Shared reply, an Introduction proposal and a normal Proactive QANDEEL message all arrive: no strip at all. They wait, marked, in Activity, and are re-evaluated when the call ends.', 0.6)}${phone('callsafe-sec-a390-ad', '<b>Critical security — call-safe strip.</b> In the chrome row beside «المحادثة», over the Replay slot only, for its hold. No Direct Entry: the sign-in waits in Activity, still actionable.', 0.6)}${phone('callsafe-rem-a390-ad', '<b>A reminder you set for now — call-safe strip.</b> The short line only; the whole sentence is in its accessible name and in Activity.', 0.6)}${phone('callsafe-rem-a320-ed', '<b>320 × 568, PINNED</b> — G3’s tightest case (world 161 pt on its 160-pt floor). The strip stays in the chrome row, so the world is untouched.', 0.6 * 390 / 320)}${phone('callsafe-sec-conv-ad', '<b>On the Conversation surface</b> during the same call (G1.2: the call continues): the call-safe strip under the chrome; Call Rail A untouched.', 0.6)}${phone('callsafe-dismissed-ad', '<b>Dismissed</b> — the Analysis and the call exactly as before; Replay is back.', 0.6)}</div>
  <div class="row"><div class="card" style="width:1100px"><p class="h3">Measured on G3’s own elements (the frame is G3.2’s page; check C-CALL-3)</p><table><tr><th>capture</th><th>G3 state</th><th>strip (x, y, w × h)</th><th>«المحادثة»</th><th>world starts</th><th>Timeline</th><th>Return Live</th><th>call line</th></tr>
  ${['callsafe-sec-a320-ad', 'callsafe-rem-a320-ed', 'callsafe-sec-a390-ad', 'callsafe-sec-a390-ed', 'callsafe-sec-a430-el'].map((n) => { const p = SH[n].probe.g32, s = SH[n].rects['.strip'][0], f = (b) => (b ? `${Math.round(b.y)}–${Math.round(b.b)}` : '—'); return `<tr><td>${n}</td><td>${p.state}</td><td>${Math.round(s.x)}, ${Math.round(s.y)}, ${Math.round(s.w)} × ${Math.round(s.h)} (bottom ${Math.round(s.y + s.h)})</td><td>x ${Math.round(p.back.x)}–${Math.round(p.back.r)}</td><td>y 95</td><td>${f(p.tl)}</td><td>${f(p.live)}</td><td>${f(p.line)}</td></tr>`; }).join('')}</table>
  <p class="note" style="margin-top:10px">Where it can live: G3’s world starts at y 95 and, in a call, is sized at its floor max(160, usable / 2) (T-11 §3; K14), so anything laid over it would take the world below its floor. The one free place is the upper chrome row (y 47–95): the strip takes the Replay slot and the space up to 8 pt before «المحادثة». It never covers the Conversation ↔ Analysis switch, the Timeline, Return Live, the band or the call line, and adds no persistent control. If Replay takes keyboard focus under it, the strip steps aside (focus not obscured).</p></div>
  <div class="card" style="width:660px"><p class="h3">Behaviour (clips M08, M08r, M09)</p><p class="note" style="margin:0">appear 240 ms, 6 pt from the chrome · the same 6 s readable hold, paused while it has focus · one act: dismiss (44 pt) · no Direct Entry, no modal, no takeover, no pulse, no bounce, no Brass, no red · announced once, politely: «تنبيه أثناء المكالمة: … (المكالمة مستمرة)» · Reduced Motion: opacity only. The model (isCallSafe) admits exactly two cases: a critical security / account event, and an exact-time reminder the user asked for (C-CALL-2m). A reminder that was not requested, or a non-critical security notice, waits.</p></div></div>
  <div class="row">${phone('analysis-strip-shared-ad', '<b>Consequence, outside a call:</b> an ordinary strip in the Analysis uses the same chrome-row place (the world is sized at its floor there too). Here it keeps its Direct Entry. Open craft item for review.', 0.6)}</div>`);

// 07 / 08 — settings
board('B07', '07-settings-arabic.png', 'Board 07 — General Settings → «الإشعارات والنشاط», Arabic',
  'Are the controls organised by Product meaning — Proactive QANDEEL, Shared (with per-World mute), Public (Discovery opt-in), Introductions (only once entered), Security & Account, Quiet Hours, Snooze, Lock Screen previews, and a separate handoff to the device — without faking ownership of OS settings?',
  `<div class="row">${phone('settings-root-ad', 'General Settings (P1 §8: one destination; groups as P1 placed them). The group this proof realizes.', 0.7)}${phone('notif-ad', 'The whole page (tall capture of one scroll).', 0.5)}${phone('notif-reduce-ad', '«أقل» selected: the line under the choice says what it means — fewer interruptions, kept for what matters most or cannot wait. No class, number or threshold.', 0.5)}${phone('notif-lock-ad', 'Lock Screen ceiling for Introductions: default «خاصة جدًا».', 0.7)}${phone('notif-lock-intro-raised-ad', 'The user raised it to «إظهار المعاينة»: allowed — there is no Introductions cap. It is a ceiling: QANDEEL may still show less.', 0.7)}${phone('notif-denied-ad', 'OS permission denied: said once, plainly, with the device handoff; Activity keeps working.', 0.7)}</div>
  <div class="row">${crop('notif-reduce-ad', { ...R('notif-reduce-ad', '.seg'), h: R('notif-reduce-ad', '.seg').h + 64 }, 1.3, '«قنديل يبادر معايا»: سماح · أقل · إيقاف — with the selected option’s line')}${phone('notif-noentry-ad', 'Introductions not entered: its section does not exist yet (D26).', 0.42)}</div>
  <p class="note"><b>«قنديل يبادر معايا» controls interruption only</b> — its line says memory, understanding and analysis are unaffected (D35). <b>«أقل» / Reduce</b> (refinement §7) tightens the Proactive Gate: interruption is kept for the highest-value or most time-bound reasons; a Class 3 moment may still interrupt when the Gate finds it strong enough, and a Class 2 one may wait. <b>Security</b> is a statement, not a switch: it always reaches you, even in Quiet Hours, and cannot override the device (D36). <b>Lock Screen</b> rows are ceilings in the Product Owner’s words — <span style="white-space:nowrap">«<bdi>خاصة جدًا</bdi>»</span> / <span style="white-space:nowrap">«<bdi>إظهار النوع</bdi>»</span> / <span style="white-space:nowrap">«<bdi>إظهار السياق</bdi>»</span> / <span style="white-space:nowrap">«<bdi>إظهار المعاينة</bdi>»</span> — never L-codes; none defaults to «إظهار المعاينة»; Introductions defaults to «خاصة جدًا» and the user may raise it. <b>«إعدادات إشعارات الجهاز»</b> hands over to the platform: sound, alert style, channel importance and the OS Lock Screen stay the device’s.</p>`);
board('B08', '08-settings-english.png', 'Board 08 — General Settings → Notifications & Activity, English',
  'Does the English surface keep exactly the same information architecture, order and meanings, left-to-right?',
  `<div class="row">${phone('settings-root-el', 'General Settings.', 0.7)}${phone('notif-el', 'The whole page (tall capture).', 0.5)}${phone('notif-reduce-el', 'Reduce selected, with its line.', 0.5)}${phone('notif-al', 'Arabic, Light (for comparison of appearance).', 0.5)}${phone('notif-lock-el', 'Lock Screen ceiling, Introductions: Very private by default; L1 reads “Show type”.', 0.7)}${phone('notif-lock-intro-raised-el', 'Raised by the user to Show preview (no category cap).', 0.7)}${phone('notif-denied-el', 'OS permission denied.', 0.7)}</div>`);

// 09 — permission education
board('B09', '09-permission-education.png', 'Board 09 — Contextual permission education → the platform-owned boundary',
  'Is notification permission asked only at a legitimate moment, explained by QANDEEL first (value, no fear or guilt, Product usable either way), and then handed to the OS prompt that QANDEEL neither draws nor imitates?',
  `<div class="row">${phone('edu-ad', 'Arabic, Dark — first entry into a Shared experience (a legitimate moment). The Product Owner’s directional copy.', 0.6)}${phone('edu-al', 'Arabic, Light.', 0.6)}${phone('edu-ed', 'English, Dark.', 0.6)}${phone('edu-el', 'English, Light.', 0.6)}${phone('edu-boundary-ad', '«السماح بالإشعارات» → the platform boundary (schematic: the OS prompt is not drawn).', 0.6)}${phone('edu-notnow-ad', '«مش دلوقتي» → closes; one quiet line; nothing else changes and nothing re-asks.', 0.6)}</div>
  <p class="note"><b>Never at first launch</b> (planted defect D4 is rejected). <b>After Not now</b>: no re-prompt until a new legitimate context or the user goes to settings (D50). <b>Apple</b>: the first request is the only system prompt ("Subsequent authorization requests don’t prompt the person"); <b>Android 13+</b>: POST_NOTIFICATIONS is requested at a moment the app chooses. <b>Provisional authorization</b> (quiet delivery to Notification Center, no Lock Screen) is recorded as a future platform option in P3_PLATFORM_REFERENCE_GATE.md and is <b>not adopted</b> here.</p>`);

// 10 — Lock Screen disclosure (board-drawn, platform schematic)
const W_AR = projectionWords('ar'), W_EN = projectionWords('en');
const pj = (ev, lvl, lang) => { const e = { ...ev, ctxName: ev.ctxName ? ev.ctxName[lang] : null, bounded: ev.bounded[lang], preview: ev.preview[lang] }; return M.project(e, lvl, lang === 'ar' ? W_AR : W_EN); };
const ios = (p, lang, dim = false) => `<div class="ios ${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}" style="${dim ? 'opacity:.45' : ''}"><div class="top"><span class="ic"></span><span class="app">${lang === 'ar' ? 'قنديل' : 'QANDEEL'}</span><span class="tm">${lang === 'ar' ? 'الآن' : 'now'}</span></div>${p.title ? `<div class="tt">${esc(p.title)}</div>` : ''}<div class="bd">${esc(p.body).replace(/@[A-Za-z0-9_.]+/g, (h) => `<bdi dir="ltr">${h}</bdi>`)}</div></div>`;
const andr = (p, lang) => `<div class="and" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><div class="top"><span class="ic"></span><span class="app">${lang === 'ar' ? 'قنديل' : 'QANDEEL'} · ${lang === 'ar' ? 'الآن' : 'now'}</span></div>${p.title ? `<div class="tt">${esc(p.title)}</div>` : ''}<div class="bd">${esc(p.body)}</div></div>`;
const LOCK_ROWS = [['qandeel', FX.EV.proactive, 'Personal / QANDEEL (proactive)'], ['shared', FX.EV.sharedReply, 'Shared World'], ['public', FX.EV.publicReply, 'Public World'], ['intro', FX.EV.introProposal, 'Introductions — a proposal'], ['intro', FX.EV.introAccept, 'Introductions — both accepted'], ['security', FX.EV.security, 'System / Account — critical security']];
const lockCss = `.ios{width:318px;border-radius:20px;padding:11px 14px 12px;background:rgba(58,58,62,.82);color:#f2f2f2;font-size:14px;line-height:1.45}.ios .top{display:flex;gap:8px;align-items:center;color:#c9c9cc;font-size:12px}.ios .ic,.and .ic{width:20px;height:20px;border-radius:5px;background:#6a6a6e;flex:none}.ios .tm{margin-inline-start:auto}.ios .tt{font-weight:700;margin-top:4px}.ios .bd{color:#ececec}
.and{width:318px;border-radius:24px;padding:12px 16px 14px;background:#2b2d30;color:#e6e6e6;font-size:14px;line-height:1.45}.and .top{display:flex;gap:8px;align-items:center;color:#b8bcc2;font-size:12px}.and .ic{border-radius:50%}.and .tt{font-weight:600;margin-top:6px}.and .bd{color:#d4d6da}
.wall{background:linear-gradient(160deg,#20242c,#15161a 60%,#1b1a20);padding:14px;border-radius:18px}.lk td{padding:10px 8px}.lk .cell{position:relative}.lk .cell .tag{position:absolute;top:-8px;inset-inline-end:10px}`;
board('B10', '10-lock-screen-disclosure.png', 'Board 10 — Lock Screen disclosure L0 → L3 (platform schematic, not OS UI)',
  'For each category, what may appear outside the authenticated Product at each ceiling the USER sets — with Introductions defaulting to L0 (not even revealing it is an introduction) but with no category cap, L3 never a default, and a critical event still only L2?',
  `<table class="lk"><tr><th style="width:200px">category · D15 default</th>${M.LEVELS.map((l) => `<th>${l} — «${COPY.ar.levels[l].text}» / ${COPY.en.levels[l].text}${l === 'L3' ? ' <span class="tag warn">NEVER A DEFAULT</span>' : ''}</th>`).join('')}</tr>
  ${LOCK_ROWS.map(([subj, ev, name]) => `<tr><td><b style="color:#ece9df">${name}</b><span class="m">default ${M.DISCLOSURE_DEFAULTS[subj]}${subj === 'intro' ? ' — must not reveal Introductions; NO category cap: the user may raise the ceiling' : subj === 'security' ? ' — critical does not raise it' : ''}</span></td>${M.LEVELS.map((l) => { const allowed = M.LEVELS.indexOf(l) <= M.LEVELS.indexOf(ev.safeMax || 'L3'); const def = M.DISCLOSURE_DEFAULTS[subj] === l; return `<td class="cell"><div class="wall">${ios(pj(ev, allowed ? l : ev.safeMax, 'ar'), 'ar', !allowed)}</div>${def ? '<span class="tag def">DEFAULT</span>' : ''}${!allowed ? `<span class="m">this EVENT’s own bounded projection stops at ${ev.safeMax}${ev.kind === 'proposal' ? ' (a pending proposal names no one before both accept)' : ''}: QANDEEL renders ${ev.safeMax} under this ceiling (D17) — an event fact, not a category rule</span>` : ''}</td>`; }).join('')}</tr>`).join('')}</table>
  <div class="row"><div class="col" style="width:1790px"><p class="h3">The defaults, English, Android-like schematic</p><div class="wrap" style="margin-top:0">${LOCK_ROWS.map(([subj, ev]) => `<div class="wall">${andr(pj(ev, M.DISCLOSURE_DEFAULTS[subj], 'en'), 'en')}</div>`).join('')}</div></div></div>
  <p class="note"><b>QANDEEL owns the words; the platform owns the frame.</b> The cards are schematic stand-ins for the iOS / Android presentation, not reproductions, and the app icon is a grey placeholder. The platform can still hide more: iOS “Show Previews” (Always / When Unlocked / Never, user-owned) and Android’s per-channel Lock Screen visibility (the user “always has ultimate control”). QANDEEL’s level is a ceiling the renderer may undershoot — never exceed (D17). Every string above is produced by <code>model.project()</code> from ONE event, so no preview combines two Worlds. <b>Introductions (refinement §5):</b> the default stays «خاصة جدًا»; the first pass’s permanent “never beyond L1” rule is removed (planted defect D17 restores it and C-PRIV-6 rejects it). Raised to «إظهار المعاينة», the acceptance shows its bounded L3 words (still no names), while a proposal stops at its own L2 (scenarios S28–S31).</p>`, lockCss);

// 11 — indicators
board('B11', '11-badges-attention-indicators.png', 'Board 11 — Attention indicators: presence, useful counts, no pressure',
  'Is the global indicator presence only (never a number, never red, never Brass), do the categories show a count only where it is useful and safe — Shared yes, System only for actionable items, Introductions never — and does it all survive Dark, Light and Increased Contrast?',
  `<div class="row">${['conv-ad', 'conv-al', 'conv-el', 'entry-more-ad', 'entry-more-al'].map((n) => crop(n, R(n, '#act-entry'), 3, n.includes('more') ? 'Increased Contrast (7-pt mark)' : '')).join('')}</div>
  <div class="row">${crop('act-ad', R('act-ad', '.filters'), 1.4, 'Arabic, Dark: «العالم المشترك 1» · presence dots on «من قنديل» / «العالم العام»')}${crop('act-el', R('act-el', '.filters'), 1.4, 'English, Light')}</div>
  <div class="row">${crop('filter-intro-el', R('filter-intro-el', '.filters'), 1.4, 'Introductions: a presence dot, never a count (P3-F)')}${crop('filter-system-ad', R('filter-system-ad', '.filters'), 1.4, 'System: «1» = one ACTIONABLE item (the sign-in), not a volume')}${crop('act-more-ad', R('act-more-ad', '.filters'), 1.4, 'Increased Contrast, Dark')}</div>
  <p class="note"><b>Derived, not summed (D45).</b> The global mark is <code>indicators().global.present</code> — a boolean; the model has no global count field to show. Accessible names say it in words («النشاط، فيه جديد» / “Activity, new items”). <b>Apple HIG</b>: “Avoid creating a custom image or component that mimics the appearance or behavior of a badge” — the mark is a small attached dot, not a red numeric badge; the app-icon badge itself is the platform’s and stays under the Disclosure Contract.</p>`);

// 12 — Quiet Hours
const onight = (() => { const hist = [], pend = [], arr = []; for (const e of FX.OVERNIGHT) { const r = M.decide(e, { settings: FX.OVERNIGHT_SETTINGS, hist, app: 'background', now: e.at }); arr.push({ e, r }); if (r.surface === 'push') hist.push({ at: e.at, kind: e.kind, critical: !!e.critical }); if (r.surface === 'deferred') pend.push(e); } const m = M.reevaluateAtQuietEnd(pend, { settings: FX.OVERNIGHT_SETTINGS, hist, app: 'background', now: M.at(3, '08:00') }); return { arr, m }; })();
const qRect = (n) => { const hs = SH[n].rects['.set h2']; const a = hs.find((h) => h.text === COPY[SH[n].lang].quiet.text), b = hs.find((h) => h.text === COPY[SH[n].lang].lockSec.text); return { x: 0, y: a.y, w: 390, h: b.y - a.y }; };
function timeline(p = 1) {
  const x0 = 60, W = 1020, t0 = M.at(2, '22:30'), t1 = M.at(3, '08:40'), X = (t) => x0 + ((t - t0) / (t1 - t0)) * W, now = t0 + (t1 - t0) * p;
  const qs = X(M.at(2, '23:00')), qe = X(M.at(3, '08:00'));
  const out = onight.arr.map(({ e, r }, i) => {
    if (e.at > now) return '';
    const y = 70 + i * 46, fin = onight.m.results.find((x) => x.id === e.id), atEnd = now >= M.at(3, '08:00');
    const lab = r.surface === 'push' ? 'PUSH now — exception (critical security)' : r.surface === 'activity' ? 'Activity only — ambient (no interruption, no mark)' : atEnd && fin ? ({ push: 'PUSH at 08:00 — re-gated: still useful now', activity: 'Activity + mark — not timely now', stale: 'STALE — its window closed at 07:00; not sent' }[fin.surface]) : 'waiting — Quiet Hours';
    const col = /PUSH/.test(lab) ? '#ece9df' : /STALE/.test(lab) ? '#8b8982' : '#bdbab0';
    return `<g><circle cx="${X(e.at)}" cy="${y}" r="6" fill="${col}"/><text x="${X(e.at) + 12}" y="${y + 5}" fill="#d6d3c8" font-size="14">${M.clock(e.at)} · ${e.id} · ${e.category}/${e.kind}</text><text x="${Math.max(X(e.at) + 12, qe + 14)}" y="${y + 24}" fill="${col}" font-size="13">${lab}</text></g>`;
  }).join('');
  const pushes = onight.arr.filter(({ e, r }) => r.surface === 'push' && e.at <= now).length + (now >= M.at(3, '08:00') ? onight.m.pushes : 0);
  return `<svg width="1640" height="330" viewBox="0 0 1640 330" style="font-family:Estedad"><rect x="${qs}" y="30" width="${qe - qs}" height="270" fill="#141414"/><text x="${qs + 8}" y="48" fill="#8b8982" font-size="12">Quiet Hours 23:00 → 08:00 (default ON)</text>
  <line x1="${qe}" y1="30" x2="${qe}" y2="300" stroke="#8b8982" stroke-dasharray="4 4"/><text x="${qe + 6}" y="316" fill="#8b8982" font-size="12">08:00 — every waiting candidate is re-evaluated</text>
  ${[M.at(2, '23:00'), M.at(3, '01:00'), M.at(3, '03:00'), M.at(3, '05:00'), M.at(3, '07:00'), M.at(3, '08:00')].map((t) => `<text x="${X(t) - 14}" y="${22}" fill="#6f6d67" font-size="12">${M.clock(t)}</text>`).join('')}
  ${p < 1 ? `<line x1="${X(now)}" y1="26" x2="${X(now)}" y2="304" stroke="#e0b650" stroke-width="1.5"/>` : ''}${out}
  <text x="${x0}" y="326" fill="#ece9df" font-size="15">Pushes so far: ${pushes} of 5 candidates</text></svg>`;
}
board('B12', '12-quiet-hours-snooze.png', 'Board 12 — Quiet Hours, Snooze, and no morning dump',
  'With Quiet Hours ON (23:00 → 08:00 local) and five candidates overnight, does the morning bring a re-evaluation into a few valid outcomes — not five Pushes — with only the two frozen exceptions allowed to interrupt at night, and no coalescing across Worlds?',
  `<div class="row">${crop('notif-ad', qRect('notif-ad'), 1.0, 'Arabic: Quiet Hours ON, 23:00 → 08:00, the exceptions in words; Snooze 1 h / 8 h / 24 h / Custom.')}${crop('notif-el', qRect('notif-el'), 1.0, 'English.')}<div class="col"><div class="card" style="width:900px"><p class="h3">Outcome (model.reevaluateAtQuietEnd, fixture OVERNIGHT)</p><table><tr><th>candidate</th><th>arrival</th><th>at 08:00</th></tr>${onight.arr.map(({ e, r }) => { const fin = onight.m.results.find((x) => x.id === e.id); return `<tr><td>${e.id} ${e.category}/${e.kind} ${M.clock(e.at)}</td><td>${r.surface} (${r.reasons.join(', ')})</td><td>${fin ? `${fin.surface} (${fin.reasons.join(', ')})` : '—'}</td></tr>`; }).join('')}</table><p class="note" style="margin-top:10px">Total interruptions: <b>${onight.arr.filter((x) => x.r.surface === 'push').length} at night</b> (the critical exception) + <b>${onight.m.pushes} at 08:00</b>. Q1 and Q3 are both «رحلة الصيف» but different kinds, so they stay separate; nothing crosses Worlds. Snooze and Quiet Hours defer interruption only — every item is in Activity (D37).</p></div></div></div><div class="row"><div class="card" style="width:1700px">${timeline(1)}</div></div>`);

// 13 — frequency ceilings
const wk = M.runTrace(FX.WEEK, FX.WEEK_SETTINGS);
const evName = (e) => `${e.category}/${e.kind}${e.thread ? ` thread ${e.thread}` : ''}${e.newContext ? ' +new context' : ''}`;
board('B13', '13-frequency-ceilings.png', 'Board 13 — Frequency ceilings: ceilings, never quotas',
  'Across a deterministic 7-day trace, do the Product Owner’s v1 ceilings hold — ordinary 4 / rolling 24 h and 12 / rolling 7 d; Proactive QANDEEL 1 / 24 h and 3 / 7 d; the same thread not before 48 h; a third same-subject interruption only with new context; Public Discovery 1 / 7 d and opt-in — with the two exceptions outside, and unused budget never creating a send?',
  `<div class="row"><table style="width:1220px"><tr><th>id</th><th>when</th><th>candidate</th><th>outcome</th><th>why</th><th>ordinary 24 h / 7 d</th><th>proactive 24 h / 7 d</th><th>expected (stated separately)</th></tr>
  ${wk.rows.map((r) => { const e = FX.WEEK.find((x) => x.id === r.id); const ok = FX.WEEK_EXPECT[r.id] === r.surface; return `<tr><td>${r.id}</td><td>day ${M.dayOf(r.at)} ${M.clock(r.at)}</td><td>${evName(e)}</td><td>${r.surface === 'push' ? '<b style="color:#ece9df">PUSH</b>' : r.surface}</td><td>${r.reasons.filter((x) => x !== 'push').join(', ') || '—'}</td><td>${r.ord24} / ${r.ord7}</td><td>${r.pro24} / ${r.pro7}</td><td class="${ok ? 'ok' : 'no'}">${FX.WEEK_EXPECT[r.id]}</td></tr>`; }).join('')}</table>
  <div class="col" style="width:530px"><div class="card"><p class="h3">What the trace demonstrates</p><p class="note" style="margin:0">W05 — the 5th ordinary Push in 24 h is refused (Activity).<br>W08 — a 2nd Proactive inside 24 h waits for the next conversation.<br>W09 — the same thread after 25.5 h with no engagement: refused (48 h).<br>W10 — the same thread after 48.5 h: allowed (the Gate re-runs; fixture says it passes).<br>W14 — a 2nd Discovery in 7 d: suppressed (first to go, D25).<br>W17 — a 3rd interruption on thread A without new context: refused.<br>W18 — the 3rd WITH new meaningful context: allowed (Proactive 3 / 7 d reached).<br>W19 — the 13th ordinary in 7 d: refused.<br>W06, W20 — the exact reminder and the critical security event sit outside the ordinary ceiling.</p></div>
  <div class="card"><p class="h3">Ceiling ≠ quota</p><p class="note" style="margin:0">Day 3 uses 1 of 4 and day 7 uses 0: the model has no path that creates a candidate from unused budget (<code>runTrace([])</code> sends nothing; check C-FREQ-8). The settings never show a meter or a “remaining” number, and nothing in the Product says how many interruptions are left.</p></div>
  <div class="card"><p class="h3">Micro-proofs (checks)</p><p class="note" style="margin:0">A second Proactive 6 h after the first, with the ordinary budget free, is refused for <code>proactive-24h</code> alone — so the 1 / 24 h ceiling is proven independently of the 4 / 24 h one (planted defect D7 flips it).</p></div></div></div>`);

// 14 — foreground / background
const scen = FX.SCENARIOS.map((sc) => ({ sc, r: M.decide({ ...FX.EV[sc.ev] }, FX.scenarioCtx(sc)) }));
board('B14', '14-foreground-background.png', 'Board 14 — Foreground and background: no duplicate interruption',
  'When QANDEEL already has the user’s attention, is an external Push avoided — the event lands in place in the same context, as a strip in a different context, deferred during a Live Call (except critical security and a requested exact-time reminder, which get the call-safe strip) — while in the background Push is used only when eligible and permitted, and Activity is always the fallback?',
  `<div class="row"><table style="width:1290px"><tr><th>scenario</th><th>where the user is</th><th>event</th><th>model</th><th>expected</th><th>reasons</th></tr>${scen.map(({ sc, r }) => { const ok = r.surface === sc.expect && (!sc.expectLevel || r.level === sc.expectLevel); return `<tr><td>${sc.id} ${esc(sc.name)}</td><td>${sc.app}${sc.here ? ' · ' + sc.here : ''}${sc.liveCall ? ' · LIVE CALL' : ''}${sc.os ? ' · OS ' + sc.os : ''}${sc.proactive ? ' · Proactive ' + sc.proactive : ''}${sc.lock ? ' · ceiling ' + JSON.stringify(sc.lock).replace(/["{}]/g, '') : ''}</td><td>${sc.ev}</td><td><b style="color:#ece9df">${r.surface}${r.level ? ' ' + r.level : ''}</b></td><td class="${ok ? 'ok' : 'no'}">${sc.expect}${sc.expectLevel ? ' ' + sc.expectLevel : ''}</td><td>${r.reasons.join(', ')}</td></tr>`; }).join('')}</table>
  <div class="col">${phone('inplace-ad', 'S1 same context: in place', 0.5)}${phone('strip-shared-ad', 'S2 different context: strip', 0.5)}${phone('analysis-call-ad', 'S7/S8/S16 Live Call, Analysis: all deferred', 0.5)}</div><div class="col">${phone('call-ad', 'S7/S8 Live Call, Conversation: deferred, mark only', 0.5)}${phone('notif-denied-ad', 'S6 OS denied: Push unavailable; Activity stays', 0.5)}${phone('callsafe-sec-a390-ad', 'S17 Live Call + critical security: call-safe strip', 0.5)}</div></div>
  <p class="note"><b>Live Call (refinement §8).</b> Deferral holds on either surface and in the background (S19): a call that continues while QANDEEL is backgrounded is still an active call (G3 §D, G1.2). Only critical security (S17) and a requested exact-time reminder (S18) may be presented now — as the call-safe strip in the foreground, or by the normal Push path in the background (S20). <b>Reduce (§7)</b>: S21–S27. <b>Introductions ceiling (§5)</b>: S28–S31.</p>
  <div class="card" style="margin-top:22px;width:1790px"><p class="h3"><span class="tag warn">IMPLEMENTATION EXAMPLE — NOT PRODUCT AUTHORITY</span> &nbsp;one possible platform mapping, for the later implementation task</p><table><tr><th>QANDEEL Interruption Class (I-08N D10)</th><th>iOS (UNNotificationInterruptionLevel)</th><th>Android (channel importance)</th><th>why this is not law</th></tr>
  <tr><td>1 Critical (security / account)</td><td>timeSensitive — requires the Time Sensitive capability and the user’s setting; <b>never</b> critical (Critical Alerts need an Apple-issued entitlement; not assumed)</td><td>a “Security” channel, default importance HIGH — the user can lower it</td><td rowspan="4">Product class ≠ OS level. OS levels are delivery mechanics under entitlements and user settings; channels, once created, are the user’s to change (“Only the user can change the channel behaviors”). A mapping decided here would let platform capability redefine Product semantics (D52).</td></tr>
  <tr><td>2 Timely</td><td>active (timeSensitive only if an event is “happening now or within an hour”, HIG)</td><td>DEFAULT</td></tr><tr><td>3 Meaningful</td><td>active</td><td>DEFAULT</td></tr><tr><td>4 Ambient / Discovery</td><td>passive</td><td>LOW</td></tr></table></div>`);

// 15 — 320
board('B15', '15-stress-320x568.png', 'Board 15 — 320 × 568, Arabic, Dark: the tightest phone',
  'At the narrowest supported phone, with the longest localized labels, do Activity, the strip, the settings and the education still read — no clipping, no horizontal scroll, targets still 44 pt?',
  `<div class="row">${['activity', 'conv-strip-shared', 'conv-strip-system', 'conv-call', 'edu', 'notif-lock'].map((s) => phone(`s320-${s}`, s, 0.78)).join('')}${phone('s320-notif-tall', 'settings, whole page', 0.34)}</div>
  <p class="note">The filter row scrolls inside itself with a soft END edge; the Arabic sentences wrap at the frozen body leading; the strip holds two lines and clamps beyond; the call line keeps Call Rail A with End Call at 27 px untouched. Every capture asserts no horizontal overflow (<code>scrollWidth ≤ innerWidth</code>).</p>`);

// 16 — 390 / 430
board('B16', '16-responsive-390-430.png', 'Board 16 — 390 and 430, Arabic and English',
  'Does the composition scale from 390 to 430 without stretching into a card wall — the same row grammar, the entry at the same edge, the strip still attached to the chrome?',
  `<div class="wrap">${phone('act-ad', 'Arabic 390', 0.62)}${phone('w430-act-ad', 'Arabic 430', 0.62)}${phone('act-el', 'English 390', 0.62)}${phone('w430-act-el', 'English 430', 0.62)}${phone('w430-act-ed', 'English 430, Dark', 0.62)}${phone('strip-shared-ad', 'strip, Arabic 390', 0.62)}${phone('w430-strip-ad', 'strip, Arabic 430', 0.62)}${phone('w430-notif-el', 'settings, English 430', 0.62)}</div>`);

// 17 — accessibility / Reduced Motion (live measurements + the RM frames)
async function a11yTable() {
  const rows = [];
  for (const [st, lang] of [['conv-strip-shared', 'ar'], ['activity', 'ar'], ['notif', 'en'], ['edu', 'ar'], ['analysis-call-security', 'ar'], ['conv-call-reminder', 'en']]) {
    const c = await openState({ state: st, lang, h: st === 'notif' ? 1960 : 844 });
    const ctl = await c.eval('P3.controls()');
    const small = ctl.filter((x) => !x.hidden && (x.w < 44 || x.h < 44)), unnamed = ctl.filter((x) => !x.hidden && !x.name);
    const deco = await c.eval('P3.decorative()');
    rows.push({ st, lang, n: ctl.length, small: small.length, unnamed: unnamed.length, svg: deco.length, exposed: deco.filter((d) => !d.hidden && !d.labelled).length, sample: ctl.filter((x) => x.name).slice(0, 7).map((x) => x.name) });
  }
  await closeBrowser();
  return rows;
}
const truth = (id) => JSON.parse(readFileSync(join(PKG, 'data', 'motion', `${id}.json`), 'utf8'));
const frameUrl = (id, i) => pathToFileURL(join(WORK, 'frames', id, `f${String(i).padStart(4, '0')}.png`)).href;
function stripFrames(id, shot = 'strip-shared-ad') {
  const t = truth(id), picks = [15, 16, 18, 23, 60, 195, 197, 200];
  const r = SH[shot].rects['.strip'][0];
  return picks.map((i) => { const fr = t.truth[i]; return `<figure style="width:${(r.w + 16) * 0.72}px"><div class="clip" style="width:${(r.w + 16) * 0.72}px;height:${(r.h + 40) * 0.72}px"><img src="${frameUrl(id, i)}" style="left:${-(r.x - 8) * 0.72}px;top:${-(r.y - 20) * 0.72}px;width:${390 * 0.72}px;height:${844 * 0.72}px"></div><figcaption><span class="m">${fr.t} ms · opacity ${fr.strip ? (+fr.strip.o).toFixed(2) : '—'} ${fr.strip && fr.strip.t ? '· ' + fr.strip.t.replace('translateY', 'y') : ''}</span></figcaption></figure>`; }).join('');
}

// 18 — decision summary
const DEC = [
  ['Activity «النشاط» / Activity', 'one global destination from the upper chrome; not a World; one quiet chronological feed; All by default; six lightweight filters'],
  ['Entry', '<b>Open Ledger — ACCEPTED</b> (Quiet Bell: comparison / history only) at the START of the upper chrome on every non-Analysis surface; neutral rest ink in every state; <b>never in the Analysis chrome</b> — one step away through «المحادثة»'],
  ['Attention', 'a neutral presence mark (never Brass, never red, never a number); inside Activity a hollow WAITING mark for items that still need you; counts only for Shared and actionable System; Introductions presence only'],
  ['In-app attention', 'the Attention Strip under the chrome — only outside the originating context; during a Live Call ordinary attention waits and is re-evaluated after the call; <b>only critical security and a requested exact-time reminder</b> show a small call-safe strip that covers nothing frozen'],
  ['Outside the app', 'the platform’s own notification presentation; QANDEEL decides only the words, by the L0–L3 ceiling — <span style="white-space:nowrap">«<bdi>خاصة جدًا</bdi>»</span> / <b><span style="white-space:nowrap">«<bdi>إظهار النوع</bdi>»</span></b> / <span style="white-space:nowrap">«<bdi>إظهار السياق</bdi>»</span> / <span style="white-space:nowrap">«<bdi>إظهار المعاينة</bdi>»</span>; Introductions default L0 with <b>no category cap</b>; L3 never default'],
  ['Settings', 'General Settings → «الإشعارات والنشاط»: Proactive (Allow / <b>Reduce = a tighter Gate, not a class rule</b> / Off), Shared + per-World mute, Public (+ opt-in Discovery), Introductions (once entered), Security (always), Quiet Hours 23:00 → 08:00, Snooze 1 h / 8 h / 24 h / Custom, Lock Screen previews, device handoff'],
  ['Permission', 'asked only at a legitimate moment, explained first, then the OS prompt; Not now keeps everything working and never re-asks by itself'],
  ['Frequency', '4 / 24 h and 12 / 7 d ordinary; 1 / 24 h and 3 / 7 d Proactive; 48 h same thread; third needs new context; Discovery 1 / 7 d opt-in — ceilings, never quotas'],
  ['Introductions mark', 'rows use a P2-compliant drawing with no exception: <b>Open Link</b> recommended (At the Door compared); the two-opening first pass is withdrawn'],
];
const OPEN = [
  'Introductions row mark: Open Link (recommended, no ring) or At the Door (one ring, one opening) — both inside P2’s grammar.',
  'The call-safe strip’s place in the Analysis: the chrome row beside «المحادثة», covering the Replay slot for its hold (the only place that touches neither the world at its floor nor any frozen control); the same place for an ordinary strip in the Analysis outside a call.',
  'The call-safe strip carries no Direct Entry (acknowledge only; the item waits in Activity) — the proof does not invent a mid-call navigation law.',
  'Wording of the PROOF lines (Allow / Reduce / Off help, the call-safe region name) and every FIXTURE sentence — the bounded cleanup did not freeze them.',
];

async function main(only) {
  mkdirSync(join(PKG, 'boards'), { recursive: true });
  const A11Y = await a11yTable();
  writeFileSync(join(PKG, 'data', 'A11Y.json'), JSON.stringify(A11Y, null, 1));
  board('B17', '17-accessibility-reduced-motion.png', 'Board 17 — Accessibility and Reduced Motion',
    'Is every control named and at least 44 pt, is every decorative glyph hidden, is focus perceivable, is no state colour-only, is RTL mirrored by meaning — and does the strip under Reduced Motion keep the same meaning with no travel?',
    `<div class="row">${crop('entry-focus-ad', R('entry-focus-ad', '#act-entry'), 2.2, 'FOCUS on the entry (E1R perimeter)')}${crop('strip-focus-ad', R('strip-focus-ad', '.strip'), 1.2, 'FOCUS on the strip’s dismiss — the hold pauses while focus is inside')}${crop('chip-focus-el', R('chip-focus-el', '.filters'), 1.3, 'FOCUS on a filter')}${crop('switch-focus-ad', R('switch-focus-ad', '.srow', 0), 1.3, 'FOCUS on a switch (role=switch, aria-checked)')}</div>
    <div class="row"><table><tr><th>live page</th><th>controls</th><th>&lt; 44 pt</th><th>unnamed</th><th>svg</th><th>decorative exposed</th><th>accessible names (first seven)</th></tr>${A11Y.map((r) => `<tr><td>${r.st} (${r.lang})</td><td>${r.n}</td><td class="${r.small ? 'no' : 'ok'}">${r.small}</td><td class="${r.unnamed ? 'no' : 'ok'}">${r.unnamed}</td><td>${r.svg}</td><td class="${r.exposed ? 'no' : 'ok'}">${r.exposed}</td><td class="ar" style="max-width:760px">${r.sample.map(esc).join(' · ')}</td></tr>`).join('')}</table></div>
    <div class="row"><div class="col" style="width:1790px"><p class="h3">M02 — standard motion (strip region, selected frames)</p><div class="wrap" style="margin-top:0">${stripFrames('M02-strip-appear-hold-dismiss')}</div></div></div>
    <div class="row"><div class="col" style="width:1790px"><p class="h3">M04 — Reduced Motion: opacity only, no travel, the same hold and acts</p><div class="wrap" style="margin-top:0">${stripFrames('M04-strip-reduced-motion')}</div></div></div>
    <div class="row">${crop('callsafe-focus-ad', R('callsafe-focus-ad', '.strip'), 1.6, 'The call-safe strip (Analysis, in a Live Call): FOCUS on its one act, dismiss (44 pt); the hold pauses while focus is inside')}${crop('callsafe-rm-ad', R('callsafe-rm-ad', '.strip'), 1.6, 'Reduced Motion: the same strip, reached by opacity only')}
    <div class="card" style="width:760px"><p class="h3">The call-safe strip for assistive technology</p><p class="note" style="margin:0">A region named «تنبيه أثناء المكالمة» / “Alert during your call”. Its text is read with the region and says the call continues; there is no Direct Entry, so its only control is the named dismiss. It is announced ONCE through P3’s one persistent polite region — never through the call’s own live-status channel (G1.2), and ordinary events are never announced during a call. If G3’s Replay (under it) takes keyboard focus, the strip steps aside, so focus is never obscured.</p></div></div>
    <div class="row"><div class="col" style="width:1790px"><p class="h3">M08 — call-safe strip in the Analysis (standard) · M08r — Reduced Motion</p><div class="wrap" style="margin-top:0">${stripFrames('M08-call-safe-security-analysis', 'callsafe-sec-a390-ad')}</div><div class="wrap" style="margin-top:6px">${stripFrames('M08r-call-safe-security-reduced-motion', 'callsafe-sec-a390-ad')}</div></div></div>
    <div class="row">${phone('act-more-ad', 'Increased Contrast, Dark (the F1 token transform)', 0.6)}${phone('act-more-el', 'Increased Contrast, Light (the F2 transform)', 0.6)}
    <div class="card" style="width:900px"><p class="h3">Naming model and non-colour state</p><p class="note" style="margin:0">Icon-only controls carry names (entry «النشاط» + «فيه جديد» when present; settings; dismiss «إغلاق التنبيه»); every glyph is aria-hidden where its control carries the name; each row’s name includes source, sentence, state word and time; switches and the Proactive radiogroup expose their state; the strip is announced once through the one persistent polite live region. Direction: the back and row chevrons mirror by meaning; the World glyphs, the ledger and the call family never mirror; the strip and the rail follow layout direction. Browser evidence only — VoiceOver / TalkBack, device Reduce Motion and Increase Contrast stay device gates.</p></div></div>`);
  board('B18', '18-decision-summary.png', 'Board 18 — Decision summary for the Product Owner',
    'The integrated direction in one view after the P3-A refinement: what the user sees, where, and when — realizing the accepted P3 direction and the Product Owner’s refinement decisions without reopening I-08N-01, P1, P2 or G3 — and the only questions left, which are craft.',
    `<div class="row">${phone('conv-ad', 'The accepted entry, attention present', 0.46)}${phone('act-ad', 'Activity', 0.46)}${phone('strip-shared-ad', 'The strip', 0.46)}${phone('analysis-call-ad', 'Live Call, Analysis: ordinary waits; no entry', 0.46)}${phone('callsafe-sec-a390-ad', 'Live Call: the call-safe strip', 0.46)}${phone('edu-ad', 'Permission, in context', 0.46)}${phone('notif-lock-intro-raised-ad', 'Introductions ceiling, raised by the user', 0.46)}</div>
    <div class="row"><div class="card" style="width:1140px"><p class="h3">Realized — the accepted P3 direction, with the refinement decisions in bold</p><table>${DEC.map(([a, b]) => `<tr><td style="width:170px"><b style="color:#ece9df">${a}</b></td><td>${b}</td></tr>`).join('')}</table></div>
    <div class="card" style="width:620px"><p class="h3">Open craft questions only (resolved decisions are not re-asked)</p><ol style="margin:0;padding-inline-start:18px;font-size:13.5px;line-height:1.6">${OPEN.map((o) => `<li>${o}</li>`).join('')}</ol>
    <p class="h3" style="margin-top:16px">Resolved by the Product Owner in the refinement</p><p class="note" style="margin:0">Open Ledger · no entry in the Analysis · L1 = <span style="white-space:nowrap">«<bdi>إظهار النوع</bdi>»</span> / “Show type” · Reduce = a tighter Gate, not “Class 2 only” · no Introductions category cap · critical security and requested reminders during a call · a P2-compliant Introductions mark.</p></div></div>`);

  const ids = (only && only.length ? only : Object.keys(B)).filter((id) => B[id]);
  const meta = existsSync(join(PKG, 'data', 'BOARDS.json')) ? JSON.parse(readFileSync(join(PKG, 'data', 'BOARDS.json'), 'utf8')) : {};
  for (const id of ids) {
    const png = await renderSheet(`board-${id}`, B[id].html);
    writeFileSync(join(PKG, 'boards', B[id].file), png);
    meta[id] = { ...QS[id], bytes: png.length, sha256: sha(png) };
    console.log(id, B[id].file, png.length);
  }
  writeFileSync(join(PKG, 'data', 'BOARDS.json'), JSON.stringify(meta, null, 1));
  if (!only || only.includes('M06')) await quietClip();
  await closeSheetBrowser(); await closeServers();
}

/** M06 — the Quiet Hours night drawn as a clip: the cursor sweeps 22:30 → 08:40 on the board's own timeline. */
async function quietClip() {
  const id = 'M06-quiet-hours-end-reevaluation', dir = join(WORK, 'frames', id); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const FPS = 30, N = 7 * FPS, c = await sheetBrowser();
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${CSS} body{padding:30px 40px} .card{width:1700px}</style></head><body dir="ltr"><p class="h3" style="font-size:20px">Quiet Hours end — every waiting candidate is re-evaluated; nothing is dumped</p><div class="card" id="tl"></div><p class="foot">${FOOT}</p></body></html>`;
  const file = join(WORK, 'm06.html'); writeFileSync(file, html);
  await c.viewport({ width: 1780, height: 520, dpr: 1, mobile: false }); await c.goto(pathToFileURL(file).href); await c.eval('document.fonts.ready.then(()=>1)');
  const frames = [];
  for (let i = 0; i < N; i++) { const p = Math.min(1, i / (N - 45)); await c.eval(`document.getElementById('tl').innerHTML=${JSON.stringify(timeline(p))}`); writeFileSync(join(dir, `f${String(i).padStart(4, '0')}.png`), await c.shot({ x: 0, y: 0, width: 1780, height: 520, scale: 1 })); frames.push({ i, p: +p.toFixed(4) }); }
  const FF = join(process.env.LOCALAPPDATA || '', 'CapCut', 'Apps', '9.2.0.3931', 'ffmpeg.exe'), out = join(PKG, 'motion', `${id}.mp4`);
  spawnSync(FF, ['-y', '-framerate', String(FPS), '-i', join(dir, 'f%04d.png'), '-c:v', 'h264_mf', '-b:v', '6M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { encoding: 'utf8' });
  const n = spawnSync(FF, ['-i', out, '-f', 'null', '-'], { encoding: 'utf8' }); const m = [...((n.stdout || '') + (n.stderr || '')).matchAll(/frame=\s*(\d+)/g)].pop();
  writeFileSync(join(PKG, 'data', 'motion', `${id}.json`), JSON.stringify({ id, note: 'board-drawn timeline (not a phone): the model’s OVERNIGHT fixture, cursor 22:30 → 08:40', fps: FPS, framesWritten: N, framesDecoded: m ? +m[1] : -1, pushesAtEnd: onight.m.pushes, frames }));
  console.log(id, N, m ? m[1] : -1);
}

await main(process.argv.length > 2 ? process.argv.slice(2) : null);
