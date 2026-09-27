// P4-C3 — the review boards. Each board is a self-contained HTML sheet rendered to PNG (lib/sheet.mjs, from P4-C). Phones
// are the Product captures (tools/shots.mjs, 2×) shown unaltered; every label, crop, status chip and measurement sits
// OUTSIDE the phones. Review annotations (SYSTEM LAUNCH · APP OWNED · STANDALONE LANTERN TASK BEGINS AFTER THIS BOUNDARY ·
// copy statuses) are never Product copy. Output: boards/*.png, data/BOARDS.json.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { WORK, PKG, SOURCE } from './lib/session.mjs';
import { renderSheet, closeSheetBrowser } from './lib/sheet.mjs';
import { sigSvg } from '../src/sig.mjs';
import { palette } from '../src/tokens.mjs';
import { ROW } from '../src/content.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const SH = Object.fromEntries(JSON.parse(readFileSync(join(PKG, 'data', 'SHOTS.json'), 'utf8')).shots.map((s) => [s.id, s]));
let CH = { summary: { normal: '—', planted: '—' } }; try { CH = JSON.parse(readFileSync(join(PKG, 'data', 'CHECKS.json'), 'utf8')); } catch { /* first pass */ }
const FONT = readFileSync(join(SOURCE, 'vendor', 'fonts', 'Estedad-wght-v8.5.woff2')).toString('base64');
const DARK = palette('dark').colors, LIGHT = palette('light').colors;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const img = (id) => pathToFileURL(join(WORK, 'shots', id + '.png')).href;
const K = 0.6;

const css = `@font-face{font-family:Estedad;src:url(data:font/woff2;base64,${FONT}) format('woff2');font-weight:100 900}
*{box-sizing:border-box;margin:0;padding:0}html{background:#0d0d0d}
body{font-family:Estedad,system-ui,sans-serif;color:#d8d5ca;padding:44px 50px 36px;letter-spacing:0}
.board{width:1800px}
h1{font-size:30px;line-height:1.35;font-weight:600;color:#eeebe2}h1 .n{color:#8b8982;font-weight:500}
.q{font-size:17px;line-height:1.6;color:#afaca3;max-width:1560px;margin-top:8px}
.frame{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:22px 0 26px}
.frame div{background:#151515;border-radius:12px;padding:12px 14px;font-size:13.5px;line-height:1.55;color:#c6c3b9}
.frame b{display:block;font-size:11px;letter-spacing:.06em;color:#8b8982;margin-bottom:5px;font-weight:600}
.row{display:flex;gap:18px;align-items:flex-start;margin:0 0 24px}
.rlab{width:200px;flex:none;font-size:14px;line-height:1.5;color:#d8d5ca;padding-top:22px}
.rlab .sub{display:block;font-size:12.5px;color:#8b8982;margin-top:4px}
figure{flex:none}
figure img{display:block;border-radius:22px;box-shadow:0 0 0 1px #2a2a2a}
figcaption{font-size:12px;line-height:1.45;color:#afaca3;margin-top:7px;max-width:250px}
figcaption code,.mono{font:11px/1.4 ui-monospace,Consolas,monospace;color:#77756f}
.chip{display:inline-block;font:700 10px/1 system-ui,sans-serif;letter-spacing:.05em;border-radius:4px;padding:4px 6px;margin:0 0 6px}
.chip.sys{background:#20242c;color:#a9bbd8}.chip.app{background:#1e2a22;color:#a6d4b3}.chip.pro{background:#2a2720;color:#e0cfa8}.chip.gate{background:#3a1f1c;color:#f0a597}.chip.fz{background:#1b1b1b;color:#c8c5bc}.chip.lan{background:#e0b650;color:#141414}
.panel{background:#151515;border-radius:14px;padding:16px 18px;font-size:13.5px;line-height:1.6;color:#c6c3b9}
.panel h3{font-size:14.5px;color:#eeebe2;margin-bottom:6px;font-weight:600}
.panel ul{padding-inline-start:18px}.panel li{margin:3px 0}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.crop{overflow:hidden;border-radius:10px;box-shadow:0 0 0 1px #2a2a2a;position:relative}
.crop img{position:absolute;display:block;border-radius:0;box-shadow:none}
.m{display:inline-block;background:#1b1b1b;border-radius:6px;padding:2px 7px;margin:2px 4px 2px 0;font-size:12px;color:#d8d5ca}
.m.ok{background:#1e2a22;color:#b3dcbf}.m.bad{background:#3a1f1c;color:#f5b3a6}
.foot{margin-top:28px;font:11px/1.5 ui-monospace,Consolas,monospace;color:#6f6d66}
.arrow{align-self:center;font-size:26px;color:#6f6d66;padding:0 2px}
.boundary{width:${Math.round(390 * K)}px;height:${Math.round(844 * K)}px;border:2px dashed #e0b650;border-radius:22px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:18px;color:#e0cfa8;font-size:13px;line-height:1.55}
.boundary b{display:block;font:700 12px/1.4 system-ui,sans-serif;letter-spacing:.06em;color:#e0b650;margin-bottom:10px}
table{border-collapse:collapse;width:100%;font-size:13px;line-height:1.5}
th{text-align:start;font-size:11px;letter-spacing:.05em;color:#8b8982;font-weight:600;padding:6px 8px;border-bottom:1px solid #2a2a2a}
td{padding:7px 8px;border-bottom:1px solid #1e1e1e;vertical-align:top;color:#d8d5ca}
td.ar{direction:rtl;text-align:right;font-size:15px;line-height:1.75}
td .st{font:700 10px/1 system-ui,sans-serif;letter-spacing:.04em;border-radius:4px;padding:3px 5px;white-space:nowrap}
.st.P{background:#2a2720;color:#e0cfa8}.st.C{background:#1b1b1b;color:#c8c5bc}.st.R{background:#3a1f1c;color:#f0a597}.st.A{background:#20242c;color:#a9bbd8}.st.F{background:#1e2a22;color:#a6d4b3}
.why{color:#9e9b92;font-size:12px}
`;
const CHIP = { sys: 'SYSTEM LAUNCH', app: 'APP OWNED', pro: 'PROPOSED FOR PO REVIEW', gate: 'RUNTIME-GATED WORDS — PROOF ONLY / NOT COPY FREEZE', fz: 'FROZEN UPSTREAM — CONSUMED', lan: 'STANDALONE LANTERN TASK BEGINS AFTER THIS BOUNDARY' };
const chip = (k) => (k ? `<span class="chip ${k}">${CHIP[k]}</span><br>` : '');
function phone(id, cap, { k = K, tag = '' } = {}) {
  const s = SH[id]; if (!s) throw new Error('board wants unknown shot ' + id);
  const place = s.measured.phone.place === 'analysis' ? 'Analysis (dark)' : s.measured.phone.place === 'launch' ? `${s.appearance} · ${s.state}` : s.appearance;
  return `<figure style="width:${Math.max(Math.round(s.w * k), 170)}px">${chip(tag)}<img src="${img(id)}" style="width:${Math.round(s.w * k)}px;height:${Math.round(s.h * k)}px" alt=""><figcaption>${cap}<br><code>${id} · ${s.w}×${s.h} · ${s.lang.toUpperCase()} · ${place}${s.contrast ? ' · Increased Contrast' : ''}${s.rm ? ' · Reduced Motion' : ''}${s.q && s.q.ts ? ' · large text' : ''}</code></figcaption></figure>`;
}
/** A zoomed region of a capture, in phone points (the capture is 2×). */
function crop(id, { x = 0, y = 0, w, h, z = 2, cap = '' }) {
  const s = SH[id];
  // a window onto the capture: the crop box is the only painted rect (the image is its background); a hidden <img> makes the sheet wait for the bytes
  return `<figure><div class="crop" style="width:${Math.round(w * z)}px;height:${Math.round(h * z)}px;background:#0d0d0d url('${img(id)}') no-repeat;background-size:${Math.round(s.w * z)}px ${Math.round(s.h * z)}px;background-position:${-Math.round(x * z)}px ${-Math.round(y * z)}px"></div><img src="${img(id)}" alt="" style="display:none"><figcaption style="max-width:${Math.round(w * z)}px">${cap}<br><code>${id}</code></figcaption></figure>`;
}
const rectOfVn = (id, i = 0) => SH[id].measured.vn[i].rect;
const rectOfRec = (id, i = 0) => SH[id].measured.crec[i].rect;
const frame = (fz, va, ju, nt) => `<div class="frame"><div><b>FROZEN — CONSUMED, NOT UNDER STUDY</b>${fz}</div><div><b>WHAT THIS BOARD PROVES</b>${va}</div><div><b>WHAT TO JUDGE</b>${ju}</div><div><b>DELIBERATELY NOT HERE</b>${nt}</div></div>`;
const row = (label, sub, items) => `<div class="row"><div class="rlab">${label}${sub ? `<span class="sub">${sub}</span>` : ''}</div>${items.join('')}</div>`;
const page = (n, title, q, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="board">` +
  `<h1><span class="n">Board ${n} — </span>${title}</h1><p class="q">${q}</p>${body}` +
  `<p class="foot">QANDEEL · P4-C3 residual visual + copy proof · P4 ACTIVE — NOT CLOSED · nothing here freezes copy: new strings are PROPOSED FOR PO REVIEW; Voice / call words are RUNTIME-GATED · phones are Product captures at 2× (no harness); every annotation is outside them · checks ${CH.summary.normal} · ${CH.summary.planted}</p></div></body></html>`;
const ST = { CANON: 'C', PROPOSED_FOR_PO_REVIEW: 'P', RUNTIME_GATED: 'R', AUDIT_OWNED: 'A', FIXTURE_ONLY: 'F' };
const LABEL = { CANON: 'CANON', PROPOSED_FOR_PO_REVIEW: 'PROPOSED', RUNTIME_GATED: 'RUNTIME-GATED', AUDIT_OWNED: 'AUDIT-OWNED', FIXTURE_ONLY: 'FIXTURE' };
const copyTable = (keys, { why = true } = {}) => `<table><tr><th>Key</th><th>Surface</th><th>Status</th><th style="text-align:right">Arabic</th><th>English</th>${why ? '<th>Why</th>' : ''}</tr>` +
  keys.map((k) => { const r = ROW[k]; return `<tr><td class="mono">${esc(k)}</td><td>${esc(r.surf)}</td><td><span class="st ${ST[r.st]}">${LABEL[r.st]}</span></td><td class="ar">${esc(r.ar)}</td><td>${esc(r.en)}</td>${why ? `<td class="why">${esc(r.why).replace(/«[^»]*»/g, (m) => `<bdi dir="rtl">${m}</bdi>`)}</td>` : ''}</tr>`; }).join('') + '</table>';
const M = (label, v, cls = '') => `<span class="m ${cls}">${label}: ${v}</span>`;
const B = {};

// ---------------------------------------------------------------------------------------------------------- 01 iOS
B['01-launch-handoff-ios'] = page('01', 'Launch → app handoff, iOS — a truthful static launch screen, and the boundary the lantern task starts from',
  'Apple\'s launch screen is a transient system surface that should be nearly identical to the app\'s first frame and is "not a branding opportunity". QANDEEL\'s is therefore one solid World colour in the current appearance. The first app-owned frame is the same ground, deliberately empty: the exceptional lantern moment is confirmed for v1 and owned entirely by its own later task.',
  frame('World fill (<span class="mono">qandeel.world.fill</span>): Dark ' + DARK.world + ' · Light ' + LIGHT.world + '; the status bar is system chrome', 'the launch surface has no text, logo, image or runtime content; it and the first app-owned frame are byte-identical captures (check C-L2), so there is no visual jump and no second splash', 'whether the handoff reads as instantaneous and calm; whether the empty app-owned ground is a clean starting line for the lantern task', 'the lantern, the Q reveal, any timing, storyboard or animation technology; no fake loading delay; no substitute identity composition') +
  row('Dark', 'system Dark', [phone('l-ios-d', 'iOS launch screen: the World colour only', { tag: 'sys' }), '<span class="arrow">→</span>', phone('h-ios-d', 'first app-owned frame: the same ground, nothing designed', { tag: 'app' }), '<span class="arrow">→</span>',
    `<div><span class="chip lan">${CHIP.lan}</span><div class="boundary"><b>QANDEEL — Lantern Gateway Identity Moment v1</b>Presence in v1 is frozen (P4-C2 §2).<br>Its design, motion, interaction, Q reveal, timing and technology are that task\'s own work — none of it is researched, drawn or decided here.</div></div>`,
    phone('l-ios-d320', 'the same launch surface at 320 × 568', { tag: 'sys' })]) +
  row('Light', 'system Light', [phone('l-ios-l', 'iOS launch screen, Light: the Light World colour', { tag: 'sys' }), '<span class="arrow">→</span>', phone('h-ios-l', 'first app-owned frame, Light', { tag: 'app' }),
    `<div class="panel" style="width:640px"><h3>Measured</h3>${M('Dark launch = app-owned frame', SH['l-ios-d'].sha256 === SH['h-ios-d'].sha256 ? 'byte-identical' : 'DIFFERENT', SH['l-ios-d'].sha256 === SH['h-ios-d'].sha256 ? 'ok' : 'bad')}${M('Light launch = app-owned frame', SH['l-ios-l'].sha256 === SH['h-ios-l'].sha256 ? 'byte-identical' : 'DIFFERENT', SH['l-ios-l'].sha256 === SH['h-ios-l'].sha256 ? 'ok' : 'bad')}${M('text on launch', SH['l-ios-d'].measured.launch.text)}${M('declared minimum duration', SH['l-ios-d'].measured.launch.minDuration || 'none', 'ok')}` +
    `<h3 style="margin-top:14px">One real tension — Product Owner question Q-1</h3><p>P1 §12 lets a reader choose Dark / Light / System in QANDEEL (default Dark). A static iOS launch screen can only follow the <b>system</b> appearance. A reader who chose Dark on a Light phone therefore sees a Light launch, then a Dark app. Android 12+ can report the app\'s own choice to the system splash (<span class="mono">UiModeManager.setApplicationNightMode</span>, API 31+); iOS cannot. The proof shows the system-following launch and does not decide the iOS cut: see <span class="mono">P4C3_PRODUCT_PROOF_REPORT.md</span> §Questions.</p></div>`]));

// ---------------------------------------------------------------------------------------------------------- 02 Android
{
  const L = SH['l-and-d'].measured.launch;
  B['02-launch-handoff-android'] = page('02', 'Launch → app handoff, Android 12+ — the platform SplashScreen with the approved icon, then the app',
    'Android 12+ always shows the system SplashScreen: the app\'s adaptive icon, masked, over one opaque background colour. QANDEEL supplies the I-08B2.5 icon bytes unchanged (48 dp framing, P4-C2 §1) and the World colour as the background, and then hands over to the same ground. No custom splash activity, no animated icon, no exit animation, no hold.',
    frame('the I-08B2.5 adaptive foreground layer (vendored bytes, sha ' + readFileSync(join(SOURCE, 'PROVENANCE.json'), 'utf8').match(/ic_launcher_foreground[^}]*"sha256": "([0-9a-f]{12})/)[1] + '…) and its flat ground; the World fill', 'icon in the 160 dp mask of the 240 dp icon box (Android\'s "with icon background" geometry), centred; background a single opaque colour; the app-owned frame keeps that colour and drops the icon (C-L3, C-L4)', 'whether the icon sits calmly on the World ground in both appearances; whether the cut to the app ground is clean', 'AnimatedVectorDrawable, exit animations, keep-on-screen conditions, a second Activity splash — and the lantern') +
    row('Dark', 'system Dark', [phone('l-and-d', 'system SplashScreen: I-08B2.5 icon, World background', { tag: 'sys' }), '<span class="arrow">→</span>', phone('h-and-d', 'first app-owned frame: same colour, no icon', { tag: 'app' }), '<span class="arrow">→</span>',
      `<div><span class="chip lan">${CHIP.lan}</span><div class="boundary"><b>QANDEEL — Lantern Gateway Identity Moment v1</b>Begins after this frame. Nothing about it is designed, timed or chosen in P4-C3.</div></div>`,
      phone('l-and-d430', 'the same splash at 430 pt', { tag: 'sys' })]) +
    row('Light', 'system Light', [phone('l-and-l', 'system SplashScreen, Light', { tag: 'sys' }), '<span class="arrow">→</span>', phone('h-and-l', 'first app-owned frame, Light', { tag: 'app' }),
      crop('l-and-d', { x: 75, y: 302, w: 240, h: 240, z: 1.5, cap: 'the 240 dp icon box; the adaptive layer is masked to its 160 dp circle' }),
      `<div class="panel" style="width:430px"><h3>Measured</h3>${M('mask', L.icon.rect.w + ' × ' + L.icon.rect.h + ' dp', 'ok')}${M('icon box', L.icon.box.w + ' × ' + L.icon.box.h + ' dp', 'ok')}${M('background', L.bg, 'ok')}${M('text', L.text, 'ok')}` +
      `<p style="margin-top:10px">Implementation note (not decided here): the platform theme maps this to <span class="mono">windowSplashScreenBackground</span> = World and the existing adaptive icon; <span class="mono">setApplicationNightMode</span> can make the splash follow the reader\'s in-app appearance (Q-1).</p></div>`]));
}

// ---------------------------------------------------------------------------------------------------------- 03 / 04 Voice Note
// the anatomy crop frames the slab itself (plus 20 pt of ground on its open side), not the whole phone width
const vnCrop = (id, cap, z = 1.6) => { const r = rectOfVn(id), W = SH[id].w, x = Math.max(0, Math.floor(r.x - 20)), x2 = Math.min(W, Math.ceil(r.r + 20)); return crop(id, { x, y: r.y - 8, w: x2 - x, h: r.h + 16, z, cap }); };
const vnFrame = frame('G1.1 speaker side (Arabic right · English left) and the UTTERANCE slab — one Surface tone, open toward the author\'s edge, rounded only inward; P2\'s play / pause (solid media anchors, never mirrored)', 'a Voice Note as a committed turn of the reader\'s conversation: a stored recording has a length, and once played a stored position. Nothing else is drawn, because nothing else is true without a runtime', 'calm, native to the Conversation, unmistakably QANDEEL\'s slab — not a messenger bubble with a waveform', 'waveform, level, amplitude, transcript, speaker colour (no Brass), QANDEEL voice replies (P4-GAP-026), the words «رسالة صوتية» / "Voice message" (gated; accessible only)');
B['03-voice-note-history-ar'] = page('03', 'Voice Note in the Conversation — Arabic RTL',
  'The reader\'s Voice Note is the same UTTERANCE slab as a written turn, carrying exactly one stored recording and its one control. At rest: a hairline and the length. Once played: the heard part is the same line at twice the weight, ending in a position mark — stored playback state, drawn by form, never by colour, never by a signal.',
  vnFrame + row('States', 'stored playback state only', [phone('vn-ar-rest', 'at rest: hairline + length 0:42'), phone('vn-ar-paused', 'paused at 0:17: heard part heavier, position mark'), phone('vn-ar-playing', 'playing: pause glyph; the position is the stored file\'s, not a level'), phone('vn-ar-light', 'system Light'), phone('vn-ar-430', '430 pt')]) +
  row('Anatomy', 'crops at 1.6×', [vnCrop('vn-ar-rest', 'rest: play · hairline · length'), vnCrop('vn-ar-paused', 'paused: the heard part is 2 px primary ink + a 12 pt position mark; the rest stays a 1 px tertiary hairline'),
    `<div class="panel" style="width:520px"><h3>Why this form</h3><ul><li>The slab is the reader\'s own words (G1.1 §3). A voice turn earns no second shape.</li><li>The line reads start → end, the same logical direction as QANDEEL\'s Timeline (in Arabic: right → left).</li><li>No word inside the slab: «رسالة صوتية» is VI-01 V01, provisional until the Voice runtime. The accessible name carries it, marked <span class="chip gate" style="margin:0">RUNTIME-GATED</span>.</li><li>Western digits in Arabic, one formatter (T-12 §9); the digits are an LTR island.</li><li>The play target is 44 × 44 pt; the glyph never grows to meet it (P2 §10).</li></ul></div>`]));
B['04-voice-note-history-en'] = page('04', 'Voice Note in the Conversation — English LTR',
  'The same turn, composed for English: the slab opens to the LEFT edge because the reader\'s turns live there (G1.1 §1). The transport glyph does not mirror; the line runs left → right with the text direction.',
  vnFrame + row('States', '', [phone('vn-en-rest', 'at rest, Light'), phone('vn-en-paused', 'paused at 0:17, Light'), phone('vn-en-dark', 'playing, Dark'), phone('vn-en-430', '430 pt'), phone('sent-en', 'just sent: a 0:07 note joins the history at rest; the composer is idle again')]) +
  row('Anatomy', 'crops at 1.4×', [vnCrop('vn-en-rest', 'rest', 1.4), vnCrop('vn-en-paused', 'paused', 1.4), vnCrop('vn-en-dark', 'playing (Dark)', 1.4)]));

// ---------------------------------------------------------------------------------------------------------- 05 call record
{
  const rc = (id, i, cap) => { const r = rectOfRec(id, i), x = Math.max(0, Math.floor(r.x - 16)), x2 = Math.min(SH[id].w, Math.ceil(r.r + 16)); return crop(id, { x, y: r.y - 10, w: x2 - x, h: r.h + 20, z: 1.3, cap }); };
  B['05-finished-call-history-ar-en'] = page('05', 'The finished call in the Conversation history — Arabic and English',
    'A finished Live Call leaves a mark in the history\'s own plane: centred like the day line, because a call belongs to both speakers and is not the reader\'s UTTERANCE. P2\'s handset at rest, the word, and the length the fixture owns, parted by the Call Rail\'s own seam slant — the machine left at rest in the history.',
    frame('P2 call glyph (16 pt, tertiary); Call Rail A\'s seam angle (8 across 48 up, machines.mjs); the history\'s day-line grammar', 'the record is not a control (no button, no focus stop), offers no play (no durable call audio exists — QAN-BL-VOICE-01), implies no transcript, and states ended + length to assistive technology (C-V3)', 'whether it reads as "a call happened here, this long" at a glance, in both scripts, without looking like a player or a banner', 'Replay of the call\'s audio, a transcript, call direction / missed-call states (runtime), the word «مكالمة صوتية» / "Voice call" as frozen copy (gated)') +
    row('In place', '', [phone('ended-ar', 'Arabic: the earlier 12:04 call, and the call just ended (1:58)'), phone('ended-en', 'English, Light'), phone('vn-ar-paused', 'Arabic, among the other turns'),
      `<div class="panel" style="width:520px"><h3>Truth boundaries</h3><ul><li>Accessible summary: «${esc(ROW.cRecordName.ar.replace('{d}', '12 دقيقة و4 ثوانٍ'))}» / "${esc(ROW.cRecordName.en.replace('{d}', '12 minutes 4 seconds'))}" — <span class="chip gate" style="margin:0">RUNTIME-GATED</span></li><li>Duration digits are a fixture fact; Arabic counted nouns agree (12 دقيقة · 4 ثوانٍ).</li><li>The mark is not a Surface and takes no speaker side: the call was both people\'s.</li><li>Replay\'s existing law is kept: Voice calls are not included in Replay («${esc(ROW.replayCallNote.ar)}»).</li></ul></div>`]) +
    row('Anatomy', 'crops at 1.3×', [rc('ended-ar', 0, 'Arabic: rule · handset · word · seam · length · rule (read right → left)'), rc('ended-en', 1, 'English: the seam leans toward the END edge, as on the rail'), rc('ended-ar', 1, 'Arabic: the call ended in this proof — 1:58')]));
}

// ---------------------------------------------------------------------------------------------------------- 06 recording
{
  const rc = (id, cap) => crop(id, { x: 0, y: SH[id].h - 34 - 56 - 64, w: SH[id].w, h: 64, z: 1, cap });
  B['06-voice-note-recording-non-signal'] = page('06', 'Recording a Voice Note — the non-signal composition',
    'While a note is being captured the lower line (FIELD) says so with what is true without a runtime signal: the microphone in primary ink, the capture word, the elapsed time, and the two acts G1.2 already has — cancel and send. No trace, no bars, no pulse, no red.',
    frame('the 64 pt FIELD line (G1.2); P2 mic (20 pt) and send; Hugeicons-Free close (P2 §8); cancel at slot-i, send at the END slot as in G1.2 / G3.2', 'no level trace (G3.2\'s simulated trace is superseded, P2 §11.1); elapsed is a clock, not a signal; the capture word stays visible because G1.2 R1 keeps it — as gated proof copy', 'hierarchy: state first, then time, then the two acts; whether it reads as "recording, 7 seconds" without motion', '«بسجّل» / "Recording" as frozen copy (VI-01 V04: "Recording may be false" — Phase VII decides); hold-to-talk gesture; background capture behaviour') +
    row('States', '', [phone('rec-ar', 'Arabic, Dark: recording, 0:07', { tag: 'gate' }), phone('rec-en', 'English, Light', { tag: 'gate' }), phone('rec-ar-light', 'Arabic, Light', { tag: 'gate' }), phone('rec-en-dark', 'English, Dark', { tag: 'gate' }), phone('sent-ar', 'sent: the note joins the history at rest')]) +
    row('The line', 'crops at 1× (the captures are 2×)', [rc('rec-ar', 'Arabic: mic · «بسجّل» · 0:07 ……… cancel · send'), rc('rec-en', 'English'), rc('rec-ar-320', 'Arabic at 320 pt'), rc('rec-en-320', 'English at 320 pt')]));
}

// ---------------------------------------------------------------------------------------------------------- 07 live call
{
  const J = ['j-ar-0', 'j-ar-1', 'j-ar-2', 'j-ar-3', 'j-ar-4'].map((id) => SH[id]);
  const jc = (s) => s.measured.call ? `${s.measured.call.id} · ${s.measured.call.elapsed}` : 'no call';
  B['07-live-call-analysis-non-signal'] = page('07', 'The Live Call — Analysis-first, one call across both surfaces, no signal',
    'Driven by real pointer input: the call starts from the Conversation and opens in the Analysis; «المحادثة» shows the Conversation with the same call running in the lower line; «تحليل المحادثة» returns to the same call; End leaves one record of that length. The line is P2 Call Rail A with End Call at 27 px and the elapsed time at START — nothing else in words.',
    frame('G1.2 §1–§4 (Analysis-first; Conversation does not end the call; no normal-state prose; one assistive status channel); P2 §6 Call Rail A; G3.2\'s own Analysis and world (byte-exact, its pre-P2 call line hidden at runtime); SW-3 switcher (P4-C1)', 'the same call id in every step and in G3.2\'s own state; elapsed only increases; the Analysis stays dark; the line carries only digits (C-V4 · C-V5 · C-V6 · C-V11)', 'whether the call feels present and calm without an activity signal; whether End is unmistakable by position and form alone', 'waveform, speaking / listening indicators, "microphone on", "QANDEEL is speaking", codec or provider names, native call stack, connecting / reconnecting copy as frozen') +
    row('Real-input journey', 'Arabic, Dark', [phone('j-ar-0', 'Conversation, before the call'), phone('j-ar-1', `start → the Analysis · ${jc(J[1])}`), phone('j-ar-2', `«المحادثة» → the same call continues · ${jc(J[2])}`), phone('j-ar-3', `«تحليل المحادثة» → the same call · ${jc(J[3])}`), phone('j-ar-4', 'End → one record of 1:58 in the history')]) +
    row('Both languages', '', [phone('ca-en', 'English, system Light: the Analysis stays dark'), phone('cc-en', 'English Conversation during the call (Light)'), phone('cm-ar', 'muted + earpiece: the drawing changes, not a colour'), phone('cm-en', 'English, muted'), phone('ca-en-430', '430 pt')]) +
    row('The line', 'crops at 2×', [crop('ca-ar', { x: 0, y: SH['ca-ar'].measured.call.rect.y, w: 390, h: 64, z: 1.9, cap: 'Arabic: 0:16 at START · route · mic │seam│ End at the END edge' }), crop('cm-en', { x: 0, y: SH['cm-en'].measured.call.rect.y, w: 390, h: 64, z: 1.9, cap: 'English, muted: the slash cuts the microphone; the speaker body empties' })]));
}

// ---------------------------------------------------------------------------------------------------------- 08 core copy
{
  const hdr = (id, cap) => crop(id, { x: 0, y: 47, w: SH[id].w, h: 48, z: 1.6, cap });
  B['08-core-copy-conversation-analysis-replay-timeline'] = page('08', 'Core copy — Conversation · Analysis · Replay · Timeline · the Live edge',
    'G3 §G\'s open words, proposed in place: the English Conversation → Analysis label, the Arabic Replay noun and its entries, the Timeline\'s accessible name and hint, the preview routes and the Live edge while following. Frozen names are copied exactly. G3.2 runs byte-exact; its copy object is substituted at runtime only.',
    row('The door', 'upper chrome, crops at 1.6×', [hdr('vn-en-rest', 'English chrome: "Analysis" beside Replay'), hdr('vn-ar-rest', 'Arabic chrome: «تحليل المحادثة» (frozen)')]) +
    row('In place', '', [phone('rep-ar', 'Replay menu, Arabic: the two proposed entries', { tag: 'pro' }), phone('rep-en', 'Replay menu, English', { tag: 'pro' }), phone('pin-en', 'PINNED, English: T-08\'s frozen Rejoin + Ways back'), phone('an-en', 'Following, English: the Live edge\'s proposed name (accessible)')]) +
    `<div class="panel">${copyTable(['conv', 'door', 'doorName', 'backName', 'replayNoun', 'replayEntry', 'replayFull', 'replayPart', 'timelineName', 'timelineHint', 'previewCancel', 'previewCommit', 'liveFollowing', 'liveRejoin', 'returnsLabel'])}</div>`);
}

// ---------------------------------------------------------------------------------------------------------- 09 confidence + settings
B['09-understanding-confidence-and-settings-copy'] = page('09', 'QANDEEL Understanding confidence words · General Settings group names',
  'P1 froze the four confidence concepts and the Settings groups; P4 owns their words. Both are shown as copy in context — the Understanding surface and the Settings screen themselves stay undrawn (P4-C2 §3 → End-to-End audit).',
  row('Confidence', 'copy specimen, not a screen', [phone('und-ar', 'Arabic: words, never colour; no scores', { tag: 'pro' }), phone('und-en', 'English, Light', { tag: 'pro' }),
    `<div class="panel" style="width:1000px">${copyTable(['confClear', 'confForming', 'confMixed', 'confMore', 'confName'])}</div>`]) +
  row('Settings groups', 'order not frozen', [phone('set-ar', 'Arabic: the nine groups', { tag: 'pro' }), phone('set-en', 'English, Light', { tag: 'pro' }),
    `<div class="panel" style="width:1000px">${copyTable(['settings', 'gAccount', 'gSecurity', 'gQandeel', 'gNotif', 'gAppearance', 'gPrivacy', 'gIntro', 'gPlan', 'gSupport'])}</div>`]));

// ---------------------------------------------------------------------------------------------------------- 10 public id
B['10-public-id-warning'] = page('10', 'The Public ID one-time-change warning — before commitment',
  'P1 §6: the reader gets exactly one lifetime manual change of the Public ID, and is warned prominently before committing that it is the only one and permanent. The warning states those facts and offers two equal, named choices. No fear words, no countdown, no colour of danger, no Login ID / Email / Shared ID / internal id.',
  row('The warning', 'a PASSAGE sheet over Settings', [phone('pid-ar', 'Arabic, Dark', { tag: 'pro' }), phone('pid-en', 'English, Light', { tag: 'pro' }), phone('s320-pid-ar', 'Arabic, 320 × 568', { tag: 'pro' }), phone('s320-pid-en', 'English, 320 × 568', { tag: 'pro' }), phone('lg-pid-ar', 'Arabic, large text', { tag: 'pro' }), phone('f-pid-en', 'keyboard focus on "Keep current ID"', { tag: 'pro' })]) +
  `<div class="panel">${copyTable(['pidTerm', 'pidAvailable', 'pidUsed', 'pidTitle', 'pidBody', 'pidCurrent', 'pidNew', 'pidKeep', 'pidConfirm', 'pidFixtureOld'])}</div>`);

// ---------------------------------------------------------------------------------------------------------- 11 P3 residual
B['11-p3-residual-copy'] = page('11', 'P3 residual copy on frozen P3 surfaces — Notifications & Activity',
  'The help lines and headings P3 left as proof, proposed for closure in one register (T1, gender-neutral) and corrected where a line had drifted from the frozen law. P3 behaviour is unchanged; the permission-education sheet stays with the End-to-End audit; every synthetic event sentence stays FIXTURE.',
  row('Arabic', '', [phone('nt-ar-pro', 'Proactive QANDEEL: heading, help, Allow / Reduce / Off', { tag: 'pro' }), phone('nt-ar-quiet', 'Quiet Hours + Snooze', { tag: 'pro' }), phone('nt-ar-lock', 'Lock Screen previews + sections', { tag: 'pro' })]) +
  row('English', '', [phone('nt-en-pro', 'Light', { tag: 'pro' }), phone('nt-en-quiet', 'Light', { tag: 'pro' }), phone('nt-en-lock', 'Light', { tag: 'pro' })]) +
  `<div class="panel">${copyTable(['p3.proactive', 'p3.proactiveHelp', 'p3.proactiveOptHelp.allow', 'p3.proactiveOptHelp.reduce', 'p3.proactiveOptHelp.off', 'p3.quietHelp', 'p3.snoozeOpts.1h', 'p3.levelHelp.L2', 'p3.introHelp', 'p3.staleExplain', 'p3.empty', 'p3.callSafeRegion', 'p3.eduTitle', 'cContinues'])}</div>`);

// ---------------------------------------------------------------------------------------------------------- 12 opener
B['12-opener-ar-en'] = page('12', 'The normal new-conversation opener — Arabic frozen, English proposed',
  'The Arabic opener is copied exactly as G1.1 froze it — wording, spelling and the « ... » rhythm, uncorrected. The English is authored to carry the same three beats and warmth rather than a literal "I\'m waiting for you". The canonical Q stands beside it: the opener is a named identity moment (P4-C1 Q-A). The First Conversation Opening / Welcome is a different moment and is not drawn.',
  row('In place', '', [phone('op-ar', 'Arabic, Dark (frozen)', { tag: 'fz' }), phone('op-en', 'English, Light', { tag: 'pro' }), phone('op-ar-light', 'Arabic, Light', { tag: 'fz' }), phone('op-en-dark', 'English, Dark', { tag: 'pro' }), phone('s320-op-ar', 'Arabic, 320 pt', { tag: 'fz' }), phone('s320-op-en', 'English, 320 pt', { tag: 'pro' })]) +
  `<div class="panel">${copyTable(['opener', 'firstOpening'])}</div>`);

// ---------------------------------------------------------------------------------------------------------- 13 stress
B['13-stress-320-large-text'] = page('13', 'Stress — 320 × 568 and large text',
  'The smallest supported phone and the browser stand-in for large text, across the new Voice turns, the call line, the opener, the warning and the Settings copy, in both scripts. Measured: no registered string overflows its box, no Voice / call / warning box leaves the phone, Arabic keeps line-height ≥ 1.6, controls stay ≥ 44 pt (C-A4, C-A5).',
  row('320 × 568', 'Voice + copy', [phone('s320-vn-ar', 'Voice Note, Arabic'), phone('s320-vn-en', 'Voice Note, English'), phone('s320-nt-ar', 'Proactive help, Arabic'), phone('s320-nt-en', 'Proactive help, English'), phone('s320-set-ar', 'Settings groups')]) +
  row('320 × 568', 'continued', [phone('s320-und-ar', 'confidence words'), phone('ca-ar-320', 'Live Call, Analysis'), phone('cc-en-320', 'Live Call, Conversation, English')], ) +
  row('Large text', 'browser stand-in (118 % + ramp)', [phone('lg-vn-ar', 'Voice Note + call record'), phone('lg-vn-en', 'English'), phone('lg-nt-ar', 'Proactive help')]) +
  row('Large text', 'continued', [phone('lg-und-ar', 'confidence words'), phone('lg-rec-ar', 'recording line'), phone('lg320-vn-ar', 'large text at 320'), phone('lg320-cc-ar', 'call line, large text at 320')]));

// ---------------------------------------------------------------------------------------------------------- 14 a11y
{
  const pair = (a, b) => `${M('same pixels', SH[a].sha256 === SH[b].sha256 ? 'yes' : 'no', SH[a].sha256 === SH[b].sha256 ? 'ok' : 'bad')}`;
  const f = (id) => SH[id].measured.focused;
  B['14-accessibility-contrast-reduced-motion'] = page('14', 'Accessibility — Increased Contrast · Reduced Motion · focus · names',
    'Browser evidence only (VoiceOver / TalkBack, Dynamic Type and device contrast settings remain device gates). Increased Contrast resolves through F1 / F2\'s own increased token sets; Reduced Motion removes movement and keeps every state, word and act; keyboard focus uses the E1R detached perimeter and is never hidden.',
    row('Increased Contrast', '', [phone('hc-vn-ar', 'Arabic, Dark'), phone('hc-vn-en', 'English, Light'), phone('hc-ca-ar', 'Live Call, Analysis'), phone('hc-nt-en', 'Notifications help, English Light')]) +
    row('Reduced Motion', 'same state, movement removed', [phone('rm-vn-ar', 'Voice Note, paused'), phone('vn-ar-paused', 'the same, standard motion'), phone('rm-rec-en', 'recording, English'), phone('rm-ca-ar', 'Live Call'),
      `<div class="panel" style="width:360px"><h3>Parity</h3>${M('Voice Note RM vs standard', '')}${pair('rm-vn-ar', 'vn-ar-paused')}<p style="margin-top:8px">C-A7 compares words, names, controls and pixels with and without Reduced Motion, and requires every transition of ours to be 0 ms under it. Stored playback position still updates under Reduced Motion: it is information, not decoration.</p></div>`]) +
    row('Keyboard focus', 'E1R perimeter', [phone('f-vplay-ar', `Voice Note control · ring ${f('f-vplay-ar').ring}`), phone('f-mute-ar', `mute · "${esc(f('f-mute-ar').name)}"`), phone('f-end-en', `End call · "${esc(f('f-end-en').name)}"`),
      `<div class="panel" style="width:560px"><h3>Names and targets</h3><ul><li>Every icon-only control has a name in both languages (C-A1): play / pause, mute / unmute (pressed state exposed), speaker route (pressed), End call, cancel, send, Replay, Activity, Settings.</li><li>The Voice Note and the call record are named groups with a spoken length; decorative glyphs are hidden.</li><li>All our targets ≥ 44 × 44 pt (C-A2). Android\'s 48 dp is met by the rail, the rows and the warning\'s actions; the P2-frozen 44 pt icon controls are reported, not changed (finding F-05).</li><li>Call state is announced through one status channel; G3.2\'s own channel is made inert (C-V6).</li></ul></div>`]));
}

// ================================================================================================= render
mkdirSync(join(PKG, 'boards'), { recursive: true });
const meta = [];
for (const [name, html] of Object.entries(B)) {
  const png = await renderSheet(name, html, { width: 1900 });
  writeFileSync(join(PKG, 'boards', name + '.png'), png);
  meta.push({ board: name + '.png', bytes: png.length, sha256: sha(png), shots: [...html.matchAll(/shots\/([\w-]+)\.png/g)].map((m) => m[1]).filter((v, i, a) => a.indexOf(v) === i) });
  process.stdout.write(`${name} `);
}
await closeSheetBrowser();
writeFileSync(join(PKG, 'data', 'BOARDS.json'), JSON.stringify({ note: 'Every board, its bytes and the captures it shows.', boards: meta }, null, 1) + '\n');
console.log(`\nboards ${meta.length}`);
