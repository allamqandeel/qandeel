// G1.2 — builds the self-contained interactive prototype (one HTML file, font and Analysis rasters inlined,
// no network) from the resolved token tree, the copy table and the glyphs. The shell is G1.1's, unchanged in
// every frozen decision (speaker sides, UTTERANCE slab, opener, naming, Replay placement); G1.2 adds the voice
// and call life-cycle ON it.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { palette } from './tokens.mjs';
import { COPY, THREAD, NEW_THREAD, STRESS, VOICE_TURNS, SHARED_WORLDS, DISPLAY_NAME, OPENER, LIVE_CONTEXT, CALL_SCRIPT, messagesCount, mmss } from './content.mjs';
import { FUNC_GLYPHS, svg, qMarkSVG } from './glyphs.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORK = join(HERE, '..');
const OUT = join(WORK, 'out', 'prototype');
mkdirSync(OUT, { recursive: true });

const FONT = readFileSync(join(WORK, 'vendor', 'Estedad-wght-v8.5.woff2')).toString('base64');
// The Analysis depth's imagery is the sealed F2 fixture world, reused unchanged from G1.1. It is scaffolding,
// NOT the Living Analysis spectacle — G2 owns that (G1.1 closure §5; G1.2 §17, §24).
const WORLD = {
  dark: readFileSync(join(WORK, 'out', 'world', 'world-dark.png')).toString('base64'),
  light: readFileSync(join(WORK, 'out', 'world', 'world-light.png')).toString('base64'),
};
const RUNTIME = readFileSync(join(HERE, 'runtime.js'), 'utf8');
const BIDI = readFileSync(join(HERE, 'bidi.js'), 'utf8');
export const paragraphDir = new Function(`${BIDI}\nreturn paragraphDir;`)();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

function vars(appearance, contrast) {
  const p = palette(appearance, { contrast });
  const c = p.colors, n = p.numbers;
  return `--world:${c.world};--surface:${c.surface};--utterance:${c.functional};--primary:${c.primary};--secondary:${c.secondary};--tertiary:${c.tertiary};` +
    `--brass:${c.brass};--mark:${c.mark};--rest:${c.restInk};--sel-ink:${c.selectedInk};--marker:${c.selectedMarker};` +
    `--focus:${c.focusIndicator};--focus-c:${c.focusCompanion};--press:${rgba(c.pressedInk, n.pressedPresence)};` +
    `--scrim:${rgba(c.scrim, p.alpha.scrim)};--error:${c.error};--disabled:${c.disabled};` +
    `--w-rest:${n.restWeight};--w-sel:${n.selectedWeight};--focus-w:${n.focusThickness}px;--focus-cw:${n.focusCompanionThickness}px;` +
    `--focus-off:${n.focusOffset}px;--marker-h:${n.markerThickness}px;` +
    `--boundary:${contrast === 'increased' ? `1px solid ${c.tertiary}` : '0 solid transparent'};`;
}

function css() {
  return `
@font-face{font-family:Estedad;src:url(data:font/woff2;base64,${FONT}) format('woff2');font-weight:100 900;font-display:block}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#0a0a0a}
body{font-family:Estedad;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
#phone,#phone *{letter-spacing:0}
#phone[data-appearance="dark"]{${vars('dark', 'standard')}}
#phone[data-appearance="dark"][data-contrast="more"]{${vars('dark', 'increased')}}
#phone[data-appearance="light"]{${vars('light', 'standard')}}
#phone[data-appearance="light"][data-contrast="more"]{${vars('light', 'increased')}}
#phone{--ts:1;--W:390px;--H:844px;--top:47px;--home:34px;--hdr:calc(48px + 18px * (var(--ts) - 1));--comp:calc(64px + 30px * (var(--ts) - 1));--rail:calc(56px + 38px * (var(--ts) - 1));
  position:relative;width:var(--W);height:var(--H);overflow:hidden;background:var(--world);color:var(--primary);isolation:isolate}
::selection{background:var(--press);color:var(--primary)}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#phone [hidden]{display:none !important}

.r-title{font-size:calc(26px * var(--ts));line-height:1.6538;font-weight:600}
.r-body{font-size:calc(17px * var(--ts));line-height:1.7647;font-weight:400}
.r-support{font-size:calc(15px * var(--ts));line-height:1.6667;font-weight:400}
.r-action{font-size:calc(14px * var(--ts));line-height:1.6429;font-weight:500}
.r-meta{font-size:calc(12px * var(--ts));line-height:1.6667;font-weight:500}
.num{font-variant-numeric:tabular-nums}
#phone:lang(en) .r-body{line-height:1.5294}
#phone:lang(en) .r-title{line-height:1.3077}

/* ------------------------------------------------------------- system chrome (not Product) */
.status{position:absolute;top:0;inset-inline:0;height:47px;display:flex;align-items:center;justify-content:space-between;
  padding:4px 28px 0;color:var(--primary);z-index:6;pointer-events:none}
.status .clock{font:600 16px/1 Estedad;direction:ltr}
.status .sys{display:flex;gap:6px;align-items:center;direction:ltr}
.homebar{position:absolute;bottom:8px;left:50%;width:134px;height:5px;border-radius:3px;background:var(--primary);transform:translateX(-50%);z-index:6;pointer-events:none}

/* ----------------------------------------------------------- the upper chrome (G1.1, unchanged) */
#hdr{position:absolute;top:var(--top);inset-inline:0;height:var(--hdr);z-index:5}
#hdr-conv,#hdr-world,#hdr-pick{position:absolute;inset:0;display:flex;align-items:center;padding:0 10px}
#hdr-conv,#hdr-world{padding-inline-end:58px}
.hbtn{position:relative;display:flex;align-items:center;gap:6px;min-height:44px;padding:0 12px;border-radius:12px;color:var(--rest)}
.hbtn .lb{font-size:calc(14px * var(--ts));line-height:1.6429;font-weight:var(--w-rest)}
#door{margin-inline-start:auto}
#back{color:var(--primary)}
#replay{position:absolute;top:calc((var(--hdr) - 44px) / 2);inset-inline-end:10px;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest);z-index:1}
#phone:not([data-replay="1"]) #replay{display:none}
#hdr-pick .lb{padding:0 14px;color:var(--primary)}
#phone[dir="rtl"] .mirror{transform:scaleX(-1)}

/* -------------------------------------------------------------------- destinations ------ */
.dest{position:absolute;top:calc(var(--top) + var(--hdr));bottom:calc(var(--home) + var(--rail));inset-inline:0;overflow:hidden}
#dest-mine{top:0}
#conv{position:absolute;top:calc(var(--top) + var(--hdr));bottom:var(--comp);inset-inline:0;will-change:transform,opacity}
#scroll{position:absolute;inset:0;overflow-y:auto;scrollbar-width:none;overscroll-behavior:contain}
#scroll::-webkit-scrollbar{display:none}
.fade{position:absolute;top:0;inset-inline:0;height:28px;background:linear-gradient(var(--world),rgba(0,0,0,0));pointer-events:none;z-index:2}
[data-appearance="light"] .fade{background:linear-gradient(var(--world),rgba(239,238,235,0))}
.thread{position:relative;min-height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding:14px 24px 26px}
.hist,.new{display:flex;flex-direction:column}
.day{color:var(--tertiary);margin:34px 0 2px;text-align:center}
.day:first-child{margin-top:8px}
/* A turn is TWO direction contexts (G1.1): the container inherits the phone's direction (which SIDE), the
   paragraph carries its own (src/bidi.js). */
.t{position:relative;max-width:100%;margin-top:16px;color:var(--primary)}
.t .tx{overflow-wrap:anywhere}
/* ---- UTTERANCE (G1.1 closure §3): the reader's committed turn, anchored to the reader's own START edge
   (RIGHT in Arabic, LEFT in English), open toward it, rounded only on the inward corners, one functional tone. */
.t.q{align-self:flex-end;max-width:calc(100% - 48px)}
.t.me{align-self:flex-start;margin-top:28px;margin-inline-start:-24px;max-width:calc(100% - 40px);
  background:var(--utterance);padding-block:11px 12px;padding-inline:24px 18px;
  border-start-end-radius:18px;border-end-end-radius:18px;border:var(--boundary);border-inline-start:0}
.day + .t.me{margin-top:14px}
.t.me + .t.me{margin-top:6px}
bdi{unicode-bidi:isolate}
.t.opener .qm{display:block;color:var(--mark);margin-bottom:12px}
.t.opener{margin-top:10px}

/* ---- A voice message (G1.2 §15). The committed note is the reader's UTTERANCE: same side, same material as a
   written turn. It carries only what the capture truly knows — that it is a voice message, and its duration.
   No transcript, no waveform. The media row reads left-to-right in both scripts (a media timeline is not
   mirrored — designing-arabic-frontends §6); the playback track fills with the real elapsed time. */
.vn{display:flex;align-items:center;gap:10px;direction:ltr;min-width:212px}
.vn .play{position:relative;width:44px;height:44px;margin:-8px -6px;display:grid;place-items:center;border-radius:12px;color:var(--primary);flex:none}
.vn .play .g-pause{display:none}
.vn .play[data-playing="1"] .g-play{display:none}
.vn .play[data-playing="1"] .g-pause{display:block}
.vn .trk{position:relative;flex:1;min-width:96px;height:2px;border-radius:1px;background:var(--tertiary)}
.vn .trk .fill{position:absolute;inset-block:0;left:0;width:0;background:var(--primary);border-radius:1px}
.vn .dur{color:var(--tertiary);min-width:32px;text-align:right}
.t.voice .vk{color:var(--tertiary);margin-top:6px}
.t.spoken .vn{margin-top:8px;min-width:0;justify-content:flex-end}
.t.spoken .vn .trk{display:none}

#picks{position:absolute;inset:0;pointer-events:none;display:none}
#phone[data-pick="1"] #picks{display:block}
#picks .pk{position:absolute;inset-inline-end:4px;width:14px;height:14px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--tertiary)}
#picks .pk.on{box-shadow:none;background:var(--marker)}
#picks .rng{position:absolute;inset-inline-end:calc(11px - var(--marker-h) / 2);width:var(--marker-h);background:var(--marker)}
#phone[data-pick="1"] .thread .t{cursor:pointer}

/* ---- The Analysis (scaffold). The picture is the sealed fixture world and does NOT move with sound: Meaning
   Light is not a sound meter (G1.2 §26). What changes during a call is «سياق الكلام» — the reading the latest
   COMMITTED spoken turn brought into play — and only at the commit (the canonical Live Focus law, T-03D). */
#world{position:absolute;inset:0;overflow:hidden;visibility:hidden;will-change:transform,opacity;transform-origin:50% 40%}
#world img{position:absolute;top:25px;left:0;width:390px;height:724px;display:block}
#lctx{position:absolute;top:calc(var(--top) + var(--hdr) + 2px);inset-inline-start:24px;inset-inline-end:24px;display:flex;align-items:baseline;gap:10px;z-index:1}
#lctx .k{color:var(--tertiary)}
#lctx .v{color:var(--secondary)}

#dest-shared .title,#dest-public .title{padding:4px 24px 0;color:var(--primary)}
#dest-shared .note{padding:0 24px;color:var(--tertiary);margin-top:2px}
.rows{margin-top:22px}
.row{position:relative;display:flex;align-items:center;gap:12px;width:100%;padding:12px 24px 13px;text-align:start}
.row .who{flex:1;color:var(--primary);font-weight:500}
.row .when{color:var(--tertiary)}
.row .fw{color:var(--rest)}
.boundary{margin:28px 24px 0;padding:18px;border:1px dashed #6b6b6b;border-radius:6px;color:#9a9a9a;font:500 12px/1.6 system-ui,'Segoe UI',sans-serif;direction:ltr;text-align:left}

/* --------------------------------------------- the lower interaction area (FIELD) --------- */
/* ONE line holds the three ways of talking (G1.1). Writing is the line itself; its two controls are the Voice
   Note (microphone) and the Live Call (handset) — two different shapes, two different names, two different
   places, two different outcomes. During a voice note the line is the capture; during a call the line is
   the CALL: its state in words, its time, the microphone level, and the call's own controls. */
#composer{position:absolute;top:calc(var(--H) - var(--home) - var(--rail) - var(--comp));height:var(--comp);inset-inline:0;background:var(--surface);z-index:3;border-top:var(--boundary);
  --v:0;will-change:transform}
.write{position:absolute;top:10px;inset-inline-start:20px;inset-inline-end:118px;height:44px}
#phone:not([data-call="none"]) .write{inset-inline-end:170px}
#input{position:absolute;inset-inline:0;top:2px;height:calc(30px * var(--ts));width:100%;border:0;outline:0;background:none;color:var(--primary);
  font:400 calc(17px * var(--ts))/1.7647 Estedad;caret-color:var(--primary);opacity:calc(1 - var(--v));text-align:start}
#input::placeholder{color:var(--tertiary);opacity:1}
.line{position:absolute;inset-inline:0;top:calc(37px + 30px * (var(--ts) - 1));height:1px;background:var(--tertiary);opacity:calc(1 - var(--v))}
#trace{position:absolute;inset-inline-start:0;top:calc(27px + 22px * (var(--ts) - 1));width:100%;height:20px;overflow:visible;opacity:var(--v)}
#trace-path{stroke:var(--primary);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}
#trace-old{stroke:var(--tertiary);stroke-width:1.5;fill:none;stroke-linecap:round;stroke-linejoin:round}
.vtop{position:absolute;top:1px;inset-inline:0;display:flex;gap:12px;align-items:baseline;opacity:var(--v);pointer-events:none;white-space:nowrap;overflow:hidden}
.vtop .vl{color:var(--primary);overflow:hidden;text-overflow:ellipsis}
.vtop #elapsed{color:var(--tertiary);direction:ltr;flex:none}
.cbtn{position:absolute;top:10px;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest)}
/* Three slots, 44 px each, 8 px apart: end 14 · end 66 · end 118. */
.slot-o{inset-inline-end:14px}.slot-i{inset-inline-end:66px}.slot-ii{inset-inline-end:118px}
.cbtn.m{display:none}
#phone[data-composer="idle"][data-call="none"] .m-idle{display:grid}
#phone[data-composer="idle"][data-call="none"] #composer.has-text #mic{display:none}
#phone[data-composer="idle"][data-call="none"] #composer:not(.has-text) #send{display:none}
#phone[data-composer="note"] .m-note,#phone[data-composer="draft"] .m-note{display:grid}
#phone:not([data-call="none"]) .m-call{display:grid}
#phone[data-call="connecting"] #route,#phone[data-call="reconnecting"] #route{display:none}
#send,#note-send{color:var(--primary)}
#mute[aria-pressed="true"] .g-mic,#mute:not([aria-pressed="true"]) .g-muted{display:none}
#route[aria-pressed="true"] .g-off,#route:not([aria-pressed="true"]) .g-on{display:none}
#end-call{color:var(--primary)}
/* End call is marked by SHAPE — the laid-down handset in a ring — never by a red fill (Brass is not "call
   active" and the error tone is not "call"). */
#end-call::after{content:"";position:absolute;inset:3px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--primary)}

/* ---- The notice: a T4 system line that names what happened and the alternative (VI-01 §14.4–5). It sits
   directly above the line it is about; never a modal, never a toast that disappears on its own. */
#notice,#cstate{position:absolute;bottom:calc(var(--home) + var(--rail) + var(--comp));inset-inline:0;z-index:3;background:var(--surface);border-top:var(--boundary);
  display:flex;align-items:center;gap:4px;padding-block:8px;padding-inline:20px 6px}
#notice .nt,#cstate .nt{flex:1;color:var(--primary);min-width:0}
/* The call's words never clip: when the line cannot hold them (a long system sentence, a long draft label, large
   text), they stand in full above the line — the line keeps its time, its level and its controls. */
#cstate{padding-block:12px;padding-inline:20px}
#cstate .nt{color:var(--primary)}
#notice .nb{min-height:44px;padding:0 12px;border-radius:12px;color:var(--primary);white-space:nowrap}
#notice .nx{width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest);flex:none}

#pickbar{position:absolute;top:calc(var(--H) - var(--home) - var(--rail) - var(--comp));height:var(--comp);inset-inline:0;background:var(--surface);z-index:3;border-top:var(--boundary);display:none;align-items:center;gap:6px;padding:0 10px 0 14px}
#phone[data-pick="1"] #pickbar{display:flex}
#phone[data-pick="1"] #composer{visibility:hidden}
#pickbar .cnt{flex:1;padding:0 10px;color:var(--primary)}
#pickbar .pb{min-height:44px;padding:0 14px;border-radius:12px;color:var(--rest)}
#pickbar #pick-go{color:var(--primary)}
#pickbar #pick-go[aria-disabled="true"]{color:var(--disabled)}

#rmenu{display:none;position:absolute;top:calc(var(--top) + var(--hdr) - 2px);inset-inline-end:10px;width:244px;background:var(--surface);border-radius:14px;padding:6px 0;z-index:8;border:var(--boundary)}
#phone.rmenu-open #rmenu{display:block}
#rmenu .mi{position:relative;display:flex;align-items:center;width:100%;min-height:48px;padding:10px 18px;text-align:start;color:var(--primary)}
#rmenu .mi .lb{font-size:calc(15px * var(--ts));line-height:1.6667}
#rmenu .mnote{padding:4px 18px 8px;color:var(--tertiary)}
#rprev{display:none;position:absolute;inset:0;z-index:9;background:var(--scrim)}
#phone.rprev-open #rprev{display:block}
#rprev .sheet{position:absolute;inset-inline:0;bottom:0;top:120px;background:var(--surface);border-start-start-radius:18px;border-start-end-radius:18px;padding:14px 10px 0}
#rprev .sh{display:flex;align-items:center;justify-content:space-between;padding-inline-start:14px}
#rprev .sh .lb{color:var(--primary)}
#rprev .x{width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest)}

#rail{position:absolute;top:calc(var(--H) - var(--home) - var(--rail));height:calc(var(--rail) + var(--home));inset-inline:0;background:var(--surface);z-index:4;border-top:var(--boundary)}
#rail .items{position:absolute;top:0;inset-inline:0;height:var(--rail);display:flex}
#rail .it{position:relative;flex:1;min-width:0;height:var(--rail);display:flex;align-items:center;justify-content:center;padding:0 6px}
#rail .lb{font-size:calc(14px * var(--ts));line-height:1.6429;font-weight:var(--w-rest);color:var(--brass);text-align:center;overflow-wrap:anywhere}
#rail .it.sel .lb{font-weight:var(--w-sel)}
#marker{position:absolute;top:calc(var(--rail) - 12px);left:0;height:var(--marker-h);width:0;background:var(--marker);pointer-events:none}

.prs::before{content:"";position:absolute;inset:4px;border-radius:12px;background:var(--press)}
#rail .it.prs::before{inset:6px 8px}
.row.prs::before{inset:0 8px;border-radius:12px}
button:focus{outline:0}
button:focus-visible,#input:focus-visible,.t:focus-visible{outline:0;box-shadow:0 0 0 var(--focus-off) var(--focus-c),0 0 0 calc(var(--focus-off) + var(--focus-w)) var(--focus),0 0 0 calc(var(--focus-off) + var(--focus-w) + var(--focus-cw)) var(--focus-c)}
#rail .it:focus-visible,#phone.show-focus #rail .it.f-demo{box-shadow:none}
#rail .it:focus-visible::after,#phone.show-focus #rail .it.f-demo::after{content:"";position:absolute;inset:6px 8px;border-radius:12px;box-shadow:0 0 0 var(--focus-off) var(--focus-c),0 0 0 calc(var(--focus-off) + var(--focus-w)) var(--focus),0 0 0 calc(var(--focus-off) + var(--focus-w) + var(--focus-cw)) var(--focus-c)}
#phone.show-focus .f-demo:not(.it){box-shadow:0 0 0 var(--focus-off) var(--focus-c),0 0 0 calc(var(--focus-off) + var(--focus-w)) var(--focus),0 0 0 calc(var(--focus-off) + var(--focus-w) + var(--focus-cw)) var(--focus-c)}

/* ------------------------------------------------ OS-OWNED surfaces — schematic review chrome ---
   G1.2 §19: "Do not fake a custom iOS/Android lock screen UI … clearly distinguish Product-owned UI from
   OS-owned UI." These two overlays stand where the OPERATING SYSTEM draws. They are deliberately NOT QANDEEL
   material and not an imitation of any OS: neutral grey, dashed, system font, English, labelled schematic. */
.os{position:absolute;z-index:30;font:500 12.5px/1.55 system-ui,'Segoe UI',sans-serif;color:#b9b9b9;direction:ltr;text-align:left}
#os-bg{inset:0;background:repeating-linear-gradient(135deg,#171717 0 14px,#1b1b1b 14px 28px);padding:86px 26px 0}
#os-bg .card,#os-perm .card{border:1.5px dashed #6a6a6a;border-radius:10px;padding:16px 16px 14px;background:#121212}
.os .tag{display:inline-block;font-size:10.5px;font-weight:700;color:#121212;background:#9a9a9a;border-radius:3px;padding:0 6px;margin-bottom:10px}
.os h3{font-size:14.5px;color:#e6e6e6;margin:0 0 8px;font-weight:600}
.os p{margin:0 0 8px}
.os .k{color:#e0e0e0}
.os .ar{font-family:Estedad,system-ui;direction:rtl;unicode-bidi:isolate}
#os-bg .away{margin-top:14px;color:#e6e6e6;font-variant-numeric:tabular-nums}
#os-perm{inset:0;background:rgba(0,0,0,.58);display:flex;align-items:center;justify-content:center;padding:0 34px}
#os-perm .card{width:100%}
#os-perm .acts{display:flex;gap:8px;margin-top:12px}
#os-perm .acts button{flex:1;min-height:44px;border:1px solid #6a6a6a;border-radius:8px;color:#e6e6e6;font:600 13px/1 system-ui,'Segoe UI',sans-serif;background:#1d1d1d}

body.live{display:flex;gap:36px;align-items:flex-start;padding:28px;min-height:100vh}
body.live #phone{flex-shrink:0;border-radius:44px;box-shadow:0 0 0 10px #050505,0 0 0 11px #2a2a2a}
.review{position:static;width:400px;color:#cfcfcf;font:13px/1.55 system-ui,'Segoe UI',sans-serif}
.review h1{font-size:15px;margin:0 0 8px}
.review h2{font-size:13px;margin:14px 0 6px;color:#e2e2e2}
.review p{margin:0 0 10px;color:#9b9b9b}
.review .sim{display:flex;flex-wrap:wrap;gap:6px}
.review .sim button{font:12px/1 system-ui,'Segoe UI',sans-serif;color:#dcdcdc;border:1px solid #444;border-radius:6px;padding:8px 10px;background:#181818}
.review pre{font:11.5px/1.5 ui-monospace,Consolas,monospace;color:#a8a8a8;white-space:pre-wrap;background:#121212;border:1px solid #2a2a2a;border-radius:6px;padding:8px}
`;
}

function statusBar() {
  return `<div class="status" aria-hidden="true"><span class="clock">9:41</span><span class="sys">` +
    `<svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5" width="3" height="6" rx="1" fill="currentColor"/><rect x="10" y="2.5" width="3" height="8.5" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="11" rx="1" fill="currentColor"/></svg>` +
    `<svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="17" height="8" rx="1.6" fill="currentColor"/><rect x="23.6" y="4" width="1.8" height="4" rx=".9" fill="currentColor" opacity=".45"/></svg>` +
    `</span></div>`;
}

export function openerHTML(lang, name = DISPLAY_NAME[lang]) {
  const [a, b] = OPENER[lang].split('{display_name}');
  return `${esc(a)}<bdi>${esc(name)}</bdi>${esc(b)}`;
}
/** The committed voice message's media row. Used for fixture turns here and cloned by the runtime for sent ones. */
export function voiceRowHTML(lang, durMs, label) {
  const L = COPY[lang];
  const nm = `${label}${lang === 'en' ? ',' : '،'} ${mmss(durMs)}`;
  return `<div class="vn"><button class="play" type="button" aria-label="${esc(nm)}" data-playing="0">${svg(FUNC_GLYPHS.play, { size: 20, cls: 'g-play' })}${svg(FUNC_GLYPHS.pause, { size: 20, cls: 'g-pause' })}</button>` +
    `<span class="trk" aria-hidden="true"><span class="fill"></span></span><span class="dur r-meta num">${mmss(durMs)}</span></div>`;
}
let vnN = 0;
export function turnHTML(lang, t, dirMode = 'script') {
  const L = COPY[lang], who = t.who;
  const label = `<span class="sr">${esc(who === 'me' ? L.speakerMe.text : L.speakerQ.text)}: </span>`;
  if (t.kind === 'opener') {
    const name = t.name || DISPLAY_NAME[lang];
    const text = OPENER[lang].split('{display_name}').join(name);
    return `<div class="t q opener" data-who="q" data-kind="opener">${qMarkSVG({ height: 22, cls: 'qm' })}${label}` +
      `<p class="tx r-body" dir="${paragraphDir(text, L.dir)}">${openerHTML(lang, name)}</p></div>`;
  }
  if (t.kind === 'voice') {
    // The reader's committed voice message: media row + the plain fact that it is one. Nothing else.
    return `<div class="t me voice" data-who="me" data-kind="voice" data-dur="${t.durMs}" data-vn="${++vnN}">${label}${voiceRowHTML(lang, t.durMs, L.play.text)}` +
      `<p class="vk r-meta">${esc(L.voiceNote.text)}</p></div>`;
  }
  const d = dirMode === 'auto' ? 'auto' : paragraphDir(t.text, L.dir);
  if (t.kind === 'spoken') {
    return `<div class="t q spoken" data-who="q" data-kind="spoken" data-dur="${t.durMs}" data-vn="${++vnN}">${label}<p class="tx r-body" dir="${d}">${esc(t.text)}</p>${voiceRowHTML(lang, t.durMs, L.qPlay.text)}</div>`;
  }
  return `<div class="t ${who}" data-who="${who}">${label}<p class="tx r-body" dir="${d}">${esc(t.text)}</p></div>`;
}
function threadHTML(lang, turns, dirMode) {
  const L = COPY[lang];
  return turns.map((t) => (t.day ? `<p class="day r-meta">${esc(t.day === 'today' ? `${L.today.text} ${t.time}` : L.yesterday.text)}</p>` : turnHTML(lang, t, dirMode))).join('');
}

/** OS-owned schematics. English review chrome; the Arabic inside quotes is the proposed purpose string. */
function osHTML(lang) {
  const L = COPY[lang];
  const purpose = lang === 'ar' ? `<p class="k ar" dir="rtl" lang="ar">«${esc(L.permPurpose.text)}»</p>` : `<p class="k">“${esc(L.permPurpose.text)}”</p>`;
  return `<div id="os-perm" class="os" hidden aria-hidden="true"><div class="card"><span class="tag">SYSTEM PROMPT · OS-OWNED · SCHEMATIC</span>
<h3>The operating system asks for the microphone</h3>
<p>Shown by iOS / Android at the moment of intent — never at launch. QANDEEL supplies only the purpose string:</p>
${purpose}
<div class="acts"><button type="button" id="os-deny">Don't allow</button><button type="button" id="os-allow">Allow</button></div></div></div>
<div id="os-bg" class="os" hidden aria-hidden="true"><div class="card"><span class="tag">OS-OWNED SURFACE · SCHEMATIC · NOT DESIGNED BY QANDEEL</span>
<h3 id="os-bg-h">The screen is locked</h3>
<p id="os-bg-call">The Live Call continues in the background: the microphone in, QANDEEL's audio out — the same call.</p>
<p><span class="k">iOS, production:</span> the system's own microphone-in-use indicator, always; with the recommended CallKit integration the system also presents this as an ongoing call in its own call UI. The exact system presentation is verified on a device, not here.</p>
<p><span class="k">Android, production:</span> the ongoing-call notification (CallStyle, with Hang up) of the call's foreground service, and the green microphone indicator. It is expected platform transparency, not a design defect.</p>
<p>QANDEEL draws none of this. Returning through the app icon, the notification or recents shows the in-call surface exactly as it was left.</p>
<p class="away">Away: <span id="os-away">0:00</span> · call <span id="os-call">—</span></p></div></div>`;
}

/**
 * `thread`: 'active' · 'new' · 'voice' (active + a committed voice message and QANDEEL's reply) · 'stress'.
 */
export function page({ lang = 'ar', appearance = 'system', thread = 'active', contrast = 'standard', capture = false, focus = null, dirMode = 'script', runtime = RUNTIME, extraCss = '' } = {}) {
  vnN = 0;
  const L = COPY[lang];
  const turns = thread === 'stress' ? [{ day: 'today', time: '11:12' }, ...STRESS.ar]
    : thread === 'new' ? NEW_THREAD[lang]
    : thread === 'voice' ? [...THREAD[lang], ...VOICE_TURNS[lang]] : THREAD[lang];
  const content = `<div class="thread"><div class="hist">${threadHTML(lang, turns, dirMode)}</div><div class="new" aria-live="polite"></div><div id="picks" aria-hidden="true"></div></div>`;
  const railItems = L.nav.items.map((n) =>
    `<button class="it${focus === `rail-${n.key}` ? ' f-demo' : ''}" data-world="${n.key}" type="button"><span class="lb">${esc(n.text)}</span></button>`).join('');
  const shared = SHARED_WORLDS[lang].map((w) =>
    `<button class="row" type="button"><span class="who r-body">${esc(w.people)}</span><span class="when r-meta">${esc(w.last)}</span>${svg(FUNC_GLYPHS.back, { cls: 'fw mirror-fw', size: 20 })}</button>`).join('');
  const copy = Object.fromEntries(Object.entries(L).filter(([, v]) => v && v.text).map(([k, v]) => [k, { text: v.text }]));
  const counts = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i + 1, messagesCount(lang, i + 1)]));
  const inject = { lang, copy, counts, typingSample: lang === 'ar' ? 'الأرقام هتوصل بكرة الصبح' : 'The numbers land tomorrow morning',
    liveContext: LIVE_CONTEXT[lang], script: CALL_SCRIPT, voiceRow: voiceRowHTML(lang, 0, L.play.text) };
  const appAttr = appearance === 'system' ? 'dark' : appearance;
  const review = capture ? '' : reviewPanel();
  const f = (k) => (focus === k ? ' f-demo' : '');
  return `<!doctype html>
<html lang="${L.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>QANDEEL — G1.2 voice and live conversation proof</title>
<style>${css()}
#phone[dir="rtl"] .mirror-fw{transform:none}
#phone[dir="ltr"] .mirror-fw{transform:scaleX(-1)}
${extraCss}</style></head>
<body dir="ltr"${capture ? '' : ' class="live"'}>
<div id="phone" dir="${L.dir}" lang="${L.lang}" data-appearance="${appAttr}" data-contrast="${contrast === 'increased' ? 'more' : 'standard'}" data-thread="${thread}" data-composer="idle" data-call="none" data-app="foreground" role="application" aria-label="${esc(L.product.text)}" class="${focus ? 'show-focus' : ''}">
${statusBar()}
<div id="hdr">
  <div id="hdr-conv"><button id="door" class="hbtn${f('door')}" type="button">${svg(FUNC_GLYPHS.depth, { size: 22 })}<span class="lb">${esc(L.door.text)}</span></button></div>
  <div id="hdr-world"><button id="back" class="hbtn${f('back')}" type="button" aria-label="${esc(L.backName.text)}">${svg(FUNC_GLYPHS.back, { cls: 'mirror', size: 22 })}<span class="lb">${esc(L.back.text)}</span></button></div>
  <div id="hdr-pick" hidden><p class="lb r-action">${esc(L.replayPart.text)}</p></div>
  <button id="replay" class="${f('replay').trim()}" type="button" aria-label="${esc(L.replay.text)}" aria-haspopup="menu" aria-expanded="false" aria-controls="rmenu">${svg(FUNC_GLYPHS.replay, { size: 22 })}</button>
</div>
<main>
  <section id="dest-mine" class="dest" aria-label="${esc(L.nav.items[0].text)}">
    <div id="conv"><div id="scroll">${content}</div><div class="fade"></div></div>
    <div id="world" role="region" aria-label="${esc(L.door.text)}"><img alt="" src="data:image/png;base64,${WORLD[appAttr]}">
      <p id="lctx" aria-live="polite"><span class="k r-meta">${esc(L.liveContext.text)}</span><span class="v r-support" id="lctx-v">${esc(LIVE_CONTEXT[lang][0])}</span></p></div>
  </section>
  <section id="dest-shared" class="dest" aria-labelledby="st">
    <h1 id="st" class="title r-title">${esc(L.sharedMany.text)}</h1>
    <div class="rows">${shared}</div>
  </section>
  <section id="dest-public" class="dest" aria-label="${esc(L.nav.items[2].text)}">
    <h1 class="title r-title">${esc(L.nav.items[2].text)}</h1>
    <div class="boundary">PROOF BOUNDARY — the Public World surface is not designed in G1.x.</div>
  </section>
</main>
<div id="notice" hidden><p class="nt r-support" id="notice-t"></p><button id="notice-act" class="nb r-action" type="button" hidden>${esc(L.openSettings.text)}</button><button id="notice-x" class="nx" type="button" aria-label="${esc(L.close.text)}">${svg(FUNC_GLYPHS.close, { size: 20 })}</button></div>
<div id="cstate" hidden><p class="nt r-support" id="cstate-t"></p></div>
<div id="composer">
  <label class="sr" for="input">${esc(L.composerLabel.text)}</label>
  <div class="write">
    <input id="input" type="text" dir="auto" autocomplete="off" placeholder="${esc(L.composerPlaceholder.text)}">
    <div class="line"></div>
    <svg id="trace" viewBox="0 0 10 20" preserveAspectRatio="none" aria-hidden="true"><path id="trace-old" d=""/><path id="trace-path" d=""/></svg>
    <div class="vtop" id="vtop"><span id="vlabel" class="vl r-action">${esc(L.recording.text)}</span><span id="elapsed" class="r-meta num">0:00</span></div>
  </div>
  <!-- writing -->
  <button id="call" class="cbtn m m-idle slot-i${f('call')}" type="button" aria-label="${esc(L.call.text)}">${svg(FUNC_GLYPHS.call)}</button>
  <button id="mic" class="cbtn m m-idle slot-o${f('mic')}" type="button" aria-label="${esc(L.voiceNote.text)}">${svg(FUNC_GLYPHS.mic)}</button>
  <button id="send" class="cbtn m m-idle slot-o" type="button" aria-label="${esc(L.send.text)}">${svg(FUNC_GLYPHS.send)}</button>
  <!-- voice note -->
  <button id="note-cancel" class="cbtn m m-note slot-i${f('note-cancel')}" type="button" aria-label="${esc(L.voiceCancel.text)}">${svg(FUNC_GLYPHS.close)}</button>
  <button id="note-send" class="cbtn m m-note slot-o${f('note-send')}" type="button" aria-label="${esc(L.voiceSend.text)}">${svg(FUNC_GLYPHS.send)}</button>
  <!-- live call -->
  <button id="route" class="cbtn m m-call slot-ii${f('route')}" type="button" aria-label="${esc(L.route.text)}" aria-pressed="true">${svg(FUNC_GLYPHS.routeOn, { cls: 'g-on' })}${svg(FUNC_GLYPHS.route, { cls: 'g-off' })}</button>
  <button id="mute" class="cbtn m m-call slot-i${f('mute')}" type="button" aria-label="${esc(L.mute.text)}" aria-pressed="false">${svg(FUNC_GLYPHS.mic, { cls: 'g-mic' })}${svg(FUNC_GLYPHS.muted, { cls: 'g-muted' })}</button>
  <button id="end-call" class="cbtn m m-call slot-o${f('end-call')}" type="button" aria-label="${esc(L.endCall.text)}">${svg(FUNC_GLYPHS.endCall)}</button>
</div>
<div id="pickbar"><p id="pick-count" class="cnt r-action" aria-live="polite">${esc(L.pickHint.text)}</p><button id="pick-cancel" class="pb r-action" type="button">${esc(L.cancel.text)}</button><button id="pick-go" class="pb r-action" type="button" aria-disabled="true">${esc(L.preview.text)}</button></div>
<nav id="rail" aria-label="${esc(L.nav.label.text)}"><div class="items">${railItems}</div><div id="marker"></div></nav>
<div id="rmenu" role="menu" aria-label="${esc(L.replay.text)}"><button class="mi" role="menuitem" data-scope="full" type="button"><span class="lb">${esc(L.replayFull.text)}</span></button><button class="mi" role="menuitem" data-scope="part" type="button"><span class="lb">${esc(L.replayPart.text)}</span></button><p class="mnote r-meta" id="rmenu-note" hidden>${esc(L.replayCallNote.text)}</p></div>
<div id="rprev" role="dialog" aria-modal="true" aria-labelledby="rprev-t"><div class="sheet"><div class="sh"><h2 id="rprev-t" class="lb r-action">${esc(L.preview.text)}</h2><button class="x" id="rprev-x" type="button" aria-label="${esc(L.close.text)}">${svg(FUNC_GLYPHS.close)}</button></div>
<div class="boundary">PROOF BOUNDARY — the Replay preview is not designed in G1.x. Original Personal Live Call / Voice Note audio is NOT a producible Replay source (docs/replay-runtime-v1.md §7); an ongoing call is open Live Head and cannot be frozen (§19).</div></div></div>
${osHTML(lang)}
<div class="homebar"></div>
<p id="live" class="sr" aria-live="polite"></p>
</div>
${review}
<script>window.__G12=${JSON.stringify(inject)};window.addEventListener('error',function(e){window.__err=String(e.message)+' @'+e.lineno;});</script>
<script>
(function(){var p=new URLSearchParams(location.search),ph=document.getElementById('phone');
 var ap=p.get('appearance')||'${appearance}';
 if(ap==='system'){var m=matchMedia('(prefers-color-scheme: light)');ph.setAttribute('data-appearance',m.matches?'light':'dark');}
 else ph.setAttribute('data-appearance',ap);
 var img=document.querySelector('#world img');img.src=ph.getAttribute('data-appearance')==='light'?'data:image/png;base64,${WORLD.light}':img.src;
 if(p.get('contrast')==='more')ph.setAttribute('data-contrast','more');
 if(p.get('ts'))ph.style.setProperty('--ts',p.get('ts'));
 if(p.get('w'))ph.style.setProperty('--W',p.get('w')+'px');
 if(p.get('h'))ph.style.setProperty('--H',p.get('h')+'px');
})();
</script>
<script>${BIDI}</script>
<script>${runtime}</script>
</body></html>`;
}

function reviewPanel() {
  const b = (act, label) => `<button type="button" data-sim="${act}">${label}</button>`;
  return `<aside class="review">
<h1>QANDEEL · G1.2 — review chrome</h1>
<p>Interactive. Write and press Enter; the microphone records a voice message (Conversation-first); the handset starts a Live Call (Analysis-first). «المحادثة» opens the Conversation without ending the call; «تحليل المحادثة» returns to the same call. The microphone permission is asked at the moment of intent (<code>?perm=unknown|granted|denied</code>).</p>
<h2>Simulate the operating system (review only)</h2>
<div class="sim">${b('bg', 'Lock the screen')}${b('bgapp', 'Open another app')}${b('fg', 'Return to QANDEEL')}${b('drop', 'Network drops')}${b('recover', 'Network returns')}${b('fail', 'Reconnection fails')}${b('awaydrop', 'Call ends while away')}${b('relaunch', 'Force-quit + relaunch')}${b('barge', 'Speak over QANDEEL (candidate)')}</div>
<h2>Truth (what is the same call)</h2>
<pre id="truth-view">—</pre>
<p id="level-src">Voice level: simulated unless the browser grants the microphone. Nothing is recorded, stored or sent; there is no voice runtime.</p>
<p>Parameters: <code>?appearance=light|dark</code> · <code>?rm=1</code> Reduced Motion · <code>?contrast=more</code> · <code>?ts=2</code> · <code>?state=</code> note · call · call-conv · … (see tools/screens.mjs).</p>
</aside>`;
}

const BUILDS = [
  { file: 'index.html', opts: { lang: 'ar', appearance: 'system' } },
  { file: 'index-en.html', opts: { lang: 'en', appearance: 'system' } },
  { file: 'index-voice-history.html', opts: { lang: 'ar', appearance: 'system', thread: 'voice' } },
];
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const b of BUILDS) { writeFileSync(join(OUT, b.file), page(b.opts)); console.log('wrote', b.file); }
}
