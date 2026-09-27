// P4-C3 — builds the residual visual + copy proof: ONE self-contained, offline HTML file (prototype/index.html).
// Everything it needs is inside this source tree.
//
// Consumed, never redrawn:
//   - the P2 family, byte-exact (sig.mjs, utility.mjs + vendor/utility, machines.mjs): the navigation glyphs in Living
//     Brass; depth, replay, call, mic / muted, route, End Call (27 px), send, play / pause; Call Rail A's art; utility
//     close / back / chevron / settings;
//   - P3's Open Ledger (p3glyphs.mjs, byte-exact) — the Activity entry;
//   - the canonical Q, read verbatim from the I-08B2.5 master (qmark.mjs) — at the opener only (P4-C1 Q-A);
//   - the I-08B2.5 Android adaptive foreground layer and its flat background, byte-exact, for the system splash;
//   - the frozen token tree through tokens.mjs (it refuses to emit if a frozen literal disagrees);
//   - Estedad v8.5, inlined;
//   - the G1.1 / P3-A / P4-C shell geometry and the P4-C1 decisions S-B + U-A + Q-A + SW-3.
// The Analysis is G3.2's own reviewed prototype (prototype/g3.2/index.html, byte-exact) in a frame. At runtime only,
// P4-C3 replaces its superseded pre-P2 call line and switcher in their own measured boxes (P2 Call Rail A; SW-3) and
// substitutes the proposed copy in its copy object. No G3.2 byte changes.
//
// New here, and only here: the Voice Note history turn, the finished-call record, the non-signal recording line, and the
// copy-in-context pages — composed from the one Surface tone, the frozen inks, E1R's state channels and P2 glyphs.
// No new colour, token, glyph or Surface role.
//
//   node source/src/build.mjs [outDir]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { palette } from './tokens.mjs';
import { sigSvg } from './sig.mjs';
import { utilSvg } from './utility.mjs';
import { railArt, RAIL_RECOMMENDED, END_GLYPH_PX } from './machines.mjs';
import { p3Svg, ACTIVITY_ACCEPTED } from './p3glyphs.mjs';
import { qSvg } from './qmark.mjs';
import { ROWS, THREAD, DISPLAY_NAME, CROSS } from './content.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SOURCE = resolve(HERE, '..');
export const OUT_DEFAULT = resolve(SOURCE, '..', 'prototype');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const FONT = readFileSync(join(SOURCE, 'vendor', 'fonts', 'Estedad-wght-v8.5.woff2')).toString('base64');
const ICON_FG = readFileSync(join(SOURCE, 'vendor', 'brand', 'android', 'ic_launcher_foreground.xxxhdpi.png')).toString('base64');
export const ICON_BG = readFileSync(join(SOURCE, 'vendor', 'brand', 'android', 'ic_launcher_background.xml'), 'utf8').match(/#[0-9A-Fa-f]{6}/)[0].toLowerCase();
const APP = readFileSync(join(HERE, 'app.js'), 'utf8');
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };
const rgba = (hex, a) => `rgba(${rgb(hex)},${a})`;

export const PALETTES = {};
function vars(appearance, contrast = 'standard') {
  const p = palette(appearance, { contrast });
  const c = p.colors, n = p.numbers;
  PALETTES[`${appearance}-${contrast}`] = { ...c, pressedPresence: n.pressedPresence, restWeight: n.restWeight, selectedWeight: n.selectedWeight, markerThickness: n.markerThickness, scrimAlpha: p.alpha.scrim };
  return `--world:${c.world};--surface:${c.surface};--primary:${c.primary};--secondary:${c.secondary};` +
    `--tertiary:${c.tertiary};--brass:${c.brass};--mark:${c.mark};--rest:${c.restInk};--sel-ink:${c.selectedInk};--marker:${c.selectedMarker};` +
    `--focus:${c.focusIndicator};--focus-c:${c.focusCompanion};--press:${rgba(c.pressedInk, n.pressedPresence)};--scrim:${rgba(c.scrim, p.alpha.scrim)};` +
    `--disabled:${c.disabled};--w-rest:${n.restWeight};--w-sel:${n.selectedWeight};--focus-w:${n.focusThickness}px;` +
    `--focus-cw:${n.focusCompanionThickness}px;--focus-off:${n.focusOffset}px;--marker-h:${n.markerThickness}px;`;
}

function css() {
  return `
@font-face{font-family:Estedad;src:url(data:font/woff2;base64,${FONT}) format('woff2');font-weight:100 900;font-display:block}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#0a0a0a}
body{font-family:Estedad;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
#phone,#phone *{letter-spacing:0}
#phone[data-appearance="dark"]{${vars('dark')}}
#phone[data-appearance="light"]{${vars('light')}}
#phone[data-appearance="dark"][data-contrast="more"]{${vars('dark', 'increased')}}
#phone[data-appearance="light"][data-contrast="more"]{${vars('light', 'increased')}}
#phone{--W:390px;--H:844px;--top:47px;--hdr:48px;--prow:44px;--rail:56px;--home:34px;--comp:64px;--mark-d:6px;--ground:var(--world);--t:180ms;
  position:relative;width:var(--W);height:var(--H);overflow:hidden;background:var(--world);color:var(--primary);isolation:isolate}
#phone[data-contrast="more"]{--mark-d:7px}
/* Reduced Motion: every movement becomes a cut; the states, words and names are unchanged (P2 §9; P3 §16) */
#phone[data-rm="1"]{--t:0ms}
#phone *{transition-duration:var(--t)}
#phone[data-textsize="large"]{font-size:118%}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent;text-align:inherit}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#phone [hidden]{display:none !important}
/* the frozen reading ramp (P3-A / P4-C), line-heights ≥ 1.6 for Arabic (designing-arabic-frontends §2) */
.r-title{font-size:26px;line-height:1.6538;font-weight:600}
.r-head{font-size:20px;line-height:1.6;font-weight:600}
.r-body{font-size:17px;line-height:1.7647;font-weight:400}
.r-support{font-size:15px;line-height:1.6667;font-weight:400}
.r-action{font-size:14px;line-height:1.6429;font-weight:500}
.r-meta{font-size:12px;line-height:1.6667;font-weight:500}
#phone[data-textsize="large"] .r-body{font-size:21px}#phone[data-textsize="large"] .r-support{font-size:18px}
#phone[data-textsize="large"] .r-action,#phone[data-textsize="large"] .hbtn .lb,#phone[data-textsize="large"] .it .lb{font-size:17px}
#phone[data-textsize="large"] .r-meta{font-size:15px}#phone[data-textsize="large"] .r-head{font-size:24px}
.num{font-variant-numeric:tabular-nums}
bdi{unicode-bidi:isolate}
.ltr{direction:ltr;unicode-bidi:isolate}
.fprobe{position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);top:0;left:0}
#phone[dir="rtl"] .mirror{transform:scaleX(-1)}
button:focus{outline:0}
/* E1R FOCUS: the detached perimeter with its world-colour companion */
button:focus-visible,[tabindex]:focus-visible{outline:2px solid transparent;outline-offset:var(--focus-off);box-shadow:0 0 0 var(--focus-off) var(--focus-c),0 0 0 calc(var(--focus-off) + var(--focus-w)) var(--focus),0 0 0 calc(var(--focus-off) + var(--focus-w) + var(--focus-cw)) var(--focus-c)}
h1:focus-visible{box-shadow:none !important}
/* E1R PRESSED: the ground takes the wash, UNDER the content */
.pz{position:relative;isolation:isolate}
.pz.down::before{content:"";position:absolute;inset:0;border-radius:inherit;background:var(--press);z-index:-1}

/* ------------------------------------------------------------------ system chrome (not Product) */
.status{position:absolute;top:0;inset-inline:0;height:47px;display:flex;align-items:center;justify-content:space-between;padding:4px 28px 0;color:var(--primary);z-index:30;pointer-events:none;direction:ltr}
.status .clock{font:600 16px/1 Estedad}
.status .sys{display:flex;gap:6px;align-items:center}
.homebar{position:absolute;bottom:8px;left:50%;width:134px;height:5px;border-radius:3px;background:var(--primary);transform:translateX(-50%);z-index:30;pointer-events:none}
#phone[data-os="android"] .homebar{width:108px;height:4px;bottom:10px}

/* ------------------------------------------------------------- the upper chrome (G1.1; P3 §3; P4-C1 S-B + U-A + Q-A) */
.hdr{position:absolute;top:var(--top);inset-inline:0;height:var(--hdr);display:flex;align-items:center;padding:0 10px;gap:2px;z-index:12}
.hbtn{position:relative;display:flex;align-items:center;gap:6px;min-height:44px;padding:0 12px;border-radius:12px;color:var(--rest);white-space:nowrap;flex:none}
.hbtn .lb{font-size:14px;line-height:1.6429;font-weight:var(--w-rest)}
.ibtn{position:relative;flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest)}
.push-end{margin-inline-start:auto}
.grp{display:flex;gap:2px;align-items:center}
.amark{position:absolute;top:calc(11px - var(--mark-d) / 2 + 1px);inset-inline-end:calc(11px - var(--mark-d) / 2 + 1px);width:var(--mark-d);height:var(--mark-d);border-radius:50%;background:var(--primary);box-shadow:0 0 0 2px var(--ground);pointer-events:none}
/* the Personal row (U-A + S-B): Understanding at START, the one Settings entry at END — on Personal QANDEEL only */
.prow{position:absolute;top:calc(var(--top) + var(--hdr));inset-inline:0;height:var(--prow);display:flex;align-items:center;padding:0 10px;gap:2px;z-index:11}
.uentry{color:var(--primary)}.uentry .lb{font-weight:500}.uentry .chev{color:var(--tertiary);line-height:0;margin-inline-start:-2px}

/* --------------------------------------------------------------------- THE GLOBAL SWITCHER — SW-3 Keyed Seam (P4-C1) */
.rail{position:absolute;bottom:0;height:calc(var(--rail) + var(--home));inset-inline:0;z-index:20;background:var(--surface);box-shadow:inset 0 1px 0 var(--tertiary)}
.rail .items{position:absolute;top:0;inset-inline:0;height:var(--rail);display:flex}
.rail .it{position:relative;flex:1;min-width:0;height:var(--rail);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 6px}
.rail .ic{display:block;height:24px;color:var(--brass);line-height:0}
.rail .lb{position:relative;font-size:14px;line-height:1.6429;font-weight:var(--w-rest);color:var(--brass);white-space:nowrap}
.rail .it.sel .lb{font-weight:var(--w-sel)}
.rail .it.sel::after{content:"";position:absolute;top:0;inset-inline:0;height:var(--marker-h);background:var(--marker)}
#arail,#acall{position:absolute;z-index:3;overflow:visible}
#arail .rail{position:absolute;inset:0;height:auto}
#acall .callline{inset:0;bottom:auto;height:100%}

/* ---------------------------------------------------------------------- Conversation host (G1.1 / G1.2; P3-A) */
.conv{position:absolute;top:calc(var(--top) + var(--hdr) + var(--prow));bottom:calc(var(--home) + var(--rail) + var(--comp));inset-inline:0;overflow:hidden;
  -webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 22px);mask-image:linear-gradient(to bottom,transparent 0,#000 22px)}
.thread{position:absolute;inset-inline:0;bottom:0;display:flex;flex-direction:column;padding:10px 24px 24px}
#phone[data-scroll="top"] .thread{bottom:auto;top:0}
.day{color:var(--tertiary);margin:14px 0 2px;text-align:center}
.t{position:relative;margin-top:16px;color:var(--primary)}
.t.q{align-self:flex-end;max-width:calc(100% - 48px)}
.t.q .qm{display:block;color:var(--mark);margin-bottom:6px;line-height:0}
/* UTTERANCE (G1.1 §3): the reader's own committed turn — anchored to the author's edge, rounded only inward */
.t.me{align-self:flex-start;margin-top:22px;margin-inline-start:-24px;max-width:calc(100% - 40px);background:var(--surface);padding-block:11px 12px;padding-inline:24px 18px;border-start-end-radius:18px;border-end-end-radius:18px}

/* ----- THE VOICE NOTE TURN (P4-C3). The same UTTERANCE slab, carrying exactly one committed voice turn and its one
   media control (G1.1 §3). No waveform, no level, no words: a stored recording has a length and, once played, a stored
   position — nothing else is true about it without a runtime. The line is a hairline; the part already heard is the same
   line drawn in primary ink at twice the weight, ending in the position mark. State = form (weight + mark), never colour. */
.t.me.vn{display:flex;align-items:center;gap:6px;width:min(calc(100% - 40px),292px);padding-block:6px;padding-inline:14px 20px}
.vplay{flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--primary)}
.vtrack{position:relative;flex:1;min-width:48px;height:44px}
.vtrack .rest{position:absolute;inset-inline:0;top:50%;height:1px;margin-top:-.5px;background:var(--tertiary);border-radius:1px}
.vtrack .done{position:absolute;inset-inline-start:0;top:50%;height:2px;margin-top:-1px;background:var(--primary);border-radius:2px;transition-property:inline-size;transition-timing-function:linear}
.vtrack .pos{position:absolute;top:50%;width:2px;height:12px;margin-top:-6px;margin-inline-start:-1px;background:var(--primary);border-radius:1px}
.vtime{flex:none;min-width:34px;text-align:end;color:var(--secondary)}
.vn[data-play="rest"] .done,.vn[data-play="rest"] .pos{display:none}
.vn:not([data-play="rest"]) .vtime{color:var(--primary)}

/* ----- THE FINISHED-CALL RECORD (P4-C3). A call belongs to both speakers, so it is not an UTTERANCE: it is a mark in
   the history's own plane, like the day line — centred, non-interactive, no Surface. The handset is P2's call glyph at
   rest; the slant between word and length is Call Rail A's own seam angle (machines.mjs: 8 over 48), the call's machine
   left in the history at rest. No play control: no durable call audio exists (QAN-BL-VOICE-01). No transcript. */
.crec{display:flex;align-items:center;justify-content:center;gap:10px;margin:24px 0 6px;color:var(--tertiary)}
.crec .rl{flex:none;width:28px;height:1px;background:var(--tertiary)}
.crec .cg{line-height:0}
.crec .cw{color:var(--secondary)}
.crec .seam{flex:none;line-height:0;color:var(--tertiary)}
.crec .cd{color:var(--secondary)}

/* ------------------------------------------------------- the lower line: FIELD (G1.2; P2-A Call Rail A in the call) */
.composer{position:absolute;bottom:calc(var(--home) + var(--rail));height:var(--comp);inset-inline:0;background:var(--surface);z-index:6}
.composer .write{position:absolute;top:10px;inset-inline-start:20px;inset-inline-end:118px;height:44px}
.composer .ph{position:absolute;inset-inline:0;top:2px;color:var(--tertiary)}
.composer .line{position:absolute;inset-inline:0;top:37px;height:1px;background:var(--tertiary)}
.cbtn{position:absolute;top:10px;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest)}
.slot-o{inset-inline-end:14px}.slot-i{inset-inline-end:66px}
/* RECORDING (non-signal): the microphone in primary ink states what is happening; the provisional word and the elapsed
   time say it in words; cancel and send are the two acts (G1.2). No trace, no level, no pulse, no red. */
.recline{position:absolute;top:10px;inset-inline-start:20px;inset-inline-end:118px;height:44px;display:flex;align-items:center;gap:10px;white-space:nowrap}
.recline .rg{line-height:0;color:var(--primary)}
.recline .rw{color:var(--primary)}
.recline .re{color:var(--secondary)}
.composer .send{color:var(--primary)}
/* THE CALL LINE (G1.2; P2 §6 Call Rail A "Keyed Seam", End Call 27 px) — drawn exactly as P2-A draws it */
.callline .cr-art{position:absolute;overflow:visible;color:var(--tertiary)}
#phone[dir="rtl"] .callline .cr-art{transform:scaleX(-1)}
.callline .celapsed{position:absolute;top:10px;inset-inline-start:20px;height:44px;display:flex;align-items:center;color:var(--tertiary)}
.callline #c-end{inset-inline-end:12px;color:var(--primary)}
.callline #c-mute{inset-inline-end:78px}
.callline #c-route{inset-inline-end:122px}
.callline .g-muted,.callline[data-muted="1"] .g-mic{display:none}.callline[data-muted="1"] .g-muted{display:inline}
.callline .g-off,.callline[data-route="0"] .g-on{display:none}.callline[data-route="0"] .g-off{display:inline}

/* ---------------------------------------------------------------------------------- pushed pages (P3-A / P4-C) */
.page{position:absolute;inset:0;background:var(--world);z-index:16;--ground:var(--world)}
.page .hdr h1{color:var(--primary);padding-inline:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.page .body{position:absolute;top:calc(var(--top) + var(--hdr));bottom:0;inset-inline:0;overflow:hidden;padding-bottom:calc(var(--home) + 16px)}
.srow{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:8px 20px 8px 24px;color:var(--primary);text-align:start}
#phone[dir="rtl"] .srow{padding:8px 24px 8px 20px}
.srow .lb{flex:1;min-width:0}.srow .chev{color:var(--tertiary);flex:none;line-height:0}
.srow .val{color:var(--secondary);flex:none;max-width:48%;text-align:end}
.sec{color:var(--tertiary);padding:22px 24px 4px}
.help{color:var(--secondary);padding:0 24px 8px}
.opt{position:relative;display:grid;grid-template-columns:22px 1fr;column-gap:14px;width:100%;padding:10px 20px 10px 24px;text-align:start;color:var(--primary)}
#phone[dir="rtl"] .opt{padding:10px 24px 10px 20px}
.opt .dot{width:20px;height:20px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--rest);margin-top:4px;position:relative}
.opt[aria-checked="true"] .dot{box-shadow:inset 0 0 0 1.5px var(--sel-ink)}
.opt[aria-checked="true"] .dot::after{content:"";position:absolute;inset:5px;border-radius:50%;background:var(--sel-ink)}
.opt[aria-checked="true"] .ol{font-weight:var(--w-sel)}
.opt .oh{grid-column:2;color:var(--secondary)}
.chips{display:flex;flex-wrap:wrap;gap:4px;padding:2px 20px 6px}
.chip{position:relative;min-height:44px;padding:0 12px;border-radius:12px;display:inline-flex;align-items:center;color:var(--rest)}
.chip[aria-checked="true"]{color:var(--sel-ink);font-weight:var(--w-sel)}
.chip[aria-checked="true"]::after{content:"";position:absolute;bottom:6px;inset-inline:12px;height:var(--marker-h);background:var(--marker)}
.handoff{margin:18px 24px 0;padding:14px 16px;border:1.5px dashed var(--tertiary);border-radius:14px;color:var(--secondary)}
.handoff .tag{display:block;font:600 10px/1.4 ui-monospace,Consolas,monospace;color:var(--tertiary);margin-bottom:6px;direction:ltr;text-align:start}
.spec{padding:14px 24px;border-bottom:1px solid var(--tertiary)}
.spec .st{display:flex;align-items:center;gap:8px;color:var(--secondary);margin-top:2px}
.spec .st .k{color:var(--primary);font-weight:600}

/* ------------------------------------------------------------ PASSAGE (B4): the Public ID warning before commitment */
.scrim{position:absolute;inset:0;background:var(--scrim);z-index:40}
.sheet{position:absolute;inset-inline:0;bottom:0;z-index:41;background:var(--surface);border-start-start-radius:22px;border-start-end-radius:22px;padding:26px 24px calc(var(--home) + 14px)}
.sheet h2{color:var(--primary)}
.sheet .body2{color:var(--secondary);margin-top:8px}
.sheet .ids{display:grid;grid-template-columns:auto 1fr;gap:6px 16px;margin:18px 0 20px;align-items:baseline}
.sheet .ids dt{color:var(--tertiary)}
.sheet .ids dd{color:var(--primary);font-weight:600}
.sheet .acts{display:flex;flex-direction:column;gap:8px}
.sheet .act{min-height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;padding:0 16px;box-shadow:inset 0 0 0 1px var(--tertiary);color:var(--primary)}
.sheet .act.commit{font-weight:var(--w-sel)}

/* ------------------------------------------------------------------------- the Analysis (G3.2 in a frame) */
#g32host{position:absolute;inset:0;z-index:1}
#g32host iframe{display:block;width:100%;height:100%;border:0}
#aover{position:absolute;inset:0;z-index:2;pointer-events:none}
#aover > *{pointer-events:auto}

/* ------------------------------------------------------------------ SYSTEM LAUNCH (platform-owned; not Product UI) */
.launch{position:absolute;inset:0;background:var(--world)}
.asplash{position:absolute;left:50%;top:50%;width:240px;height:240px;margin:-120px 0 0 -120px}
.asplash .mask{position:absolute;left:40px;top:40px;width:160px;height:160px;border-radius:50%;overflow:hidden;background:${ICON_BG}}
.asplash .mask img{position:absolute;left:-40px;top:-40px;width:240px;height:240px;display:block}

/* ------------------------------------------------------------------ PROOF HARNESS (not Product) */
body.live{display:flex;gap:36px;align-items:flex-start;padding:28px;min-height:100vh}
body.live #phone{flex-shrink:0;border-radius:44px;box-shadow:0 0 0 10px #050505,0 0 0 11px #2a2a2a}
.harness{width:460px;color:#cfcfcf;font:13px/1.55 system-ui,'Segoe UI',sans-serif}
.harness .flag{display:inline-block;font:700 11px/1 system-ui,'Segoe UI',sans-serif;letter-spacing:.06em;color:#101010;background:#e0b650;border-radius:4px;padding:5px 8px;margin-bottom:10px}
.harness h1{font-size:15px;margin:0 0 6px;color:#ececec}
.harness h2{font-size:12.5px;margin:16px 0 6px;color:#e2e2e2;font-weight:600}
.harness a{display:inline-block;font:12px/1 system-ui,'Segoe UI',sans-serif;color:#dcdcdc;border:1px solid #444;border-radius:6px;padding:7px 9px;margin:0 4px 6px 0;background:#181818;text-decoration:none}
.harness a.on{border-color:#e0b650;color:#fff}
.harness p{margin:4px 0}
`;
}

/** Pre-rendered glyph strings: the runtime never draws; it places these. */
function glyphs() {
  const g = {};
  for (const n of ['navMine', 'navShared', 'navPublic']) g[n] = sigSvg(n, { size: 24 });
  g.depth22 = sigSvg('depth', { size: 22 }); g.replay22 = sigSvg('replay', { size: 22 });
  g.call24 = sigSvg('call'); g.mic24 = sigSvg('mic'); g.send24 = sigSvg('send');
  g.call16 = sigSvg('call', { size: 16 });
  g.play24 = sigSvg('play'); g.pause24 = sigSvg('pause');
  g.micRec20 = sigSvg('mic', { size: 20 });
  g.callMic = sigSvg('mic', { cls: 'g-mic' }); g.callMuted = sigSvg('muted', { cls: 'g-muted', id: 'call' });
  g.routeOn = sigSvg('routeOn', { cls: 'g-on' }); g.routeOff = sigSvg('route', { cls: 'g-off' });
  g.endCall = sigSvg('endCall', { size: END_GLYPH_PX, cls: 'g-end' });
  g.ledger22 = p3Svg(ACTIVITY_ACCEPTED, { size: 22 });
  g.settings22 = utilSvg('settings', { size: 22 });
  g.back22 = utilSvg('back', { size: 22, cls: 'mirror' }); g.chev16 = utilSvg('chevron', { size: 16, cls: 'mirror' });
  g.close24 = utilSvg('close', { size: 24 });
  g.q18 = qSvg({ height: 18, cls: 'qm' });
  g.railArt = railArt(RAIL_RECOMMENDED).join('');
  g.iconFg = `data:image/png;base64,${ICON_FG}`;
  return g;
}

export function page() {
  vars('dark'); vars('light'); vars('dark', 'increased'); vars('light', 'increased');   // fills PALETTES
  const data = { rows: ROWS, thread: THREAD, displayName: DISPLAY_NAME, cross: CROSS, glyphs: glyphs(), palettes: PALETTES, iconBg: ICON_BG, endGlyphPx: END_GLYPH_PX };
  return `<!doctype html>
<html lang="ar-EG"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>QANDEEL — P4-C3 residual visual + copy proof</title>
<style>${css()}</style></head>
<body>
<div id="mount"></div>
<script>window.C3DATA=${JSON.stringify(data).replace(/</g, '\\u003c')};</script>
<script>
${APP}
</script>
</body></html>`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = resolve(process.argv[2] || OUT_DEFAULT);
  mkdirSync(out, { recursive: true });
  const html = page();
  writeFileSync(join(out, 'index.html'), html);
  console.log(`wrote ${join(out, 'index.html')} ${Buffer.byteLength(html)} B sha256 ${sha(Buffer.from(html))}`);
}
