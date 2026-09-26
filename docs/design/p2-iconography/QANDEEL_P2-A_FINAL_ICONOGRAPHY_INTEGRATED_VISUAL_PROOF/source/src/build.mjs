// G3.2 — builds the targeted coherence refinement of the G3.1 integrated Product proof: ONE self-contained HTML
// (offline) holding ONE Product state machine. Everything it needs is inside this source tree (../vendor).
//
// G3.2 starts from G3.1's reviewed build inputs (vendor/upstream-g31/src — tools/upstream.mjs rebuilds G3.1 from them
// byte-identically) and changes ONLY what the Product Owner's two decisions under proof require:
//   D-A  the Analysis shell stays dark with the Living Analysis World under system Light AND Dark; every other surface
//        keeps following the system (F2). G3.1's Q-LIGHT-SHELL harness fixture (?shell=A|B) is gone: its A answer is
//        the decision under proof, and B is kept only as a planted negative probe (tools/probes.mjs). The shell's tone
//        change uses F2's own appearance cross-fade quantity (200 ms, symmetric; removed under Reduced Motion).
//   D-B  the concise temporal orientation line («أنت عند اللحظة 14. استمرت المحادثة بعد هذه اللحظة.», or the preview
//        line) moves out of OrientationChrome into the Timeline cluster, directly ABOVE the Track, when — and only
//        when — temporal context exists. «طرق العودة» and every other Return act stay in OrientationChrome, below.
// Everything below is G3.1's text unless marked "G3.2".
//
// G3.1 — builds the integrated end-to-end Product proof: ONE self-contained HTML (offline) holding ONE Product state
// machine. Everything it needs is inside this source tree (../vendor); nothing is read from outside it.
//
// Lineage (each input hash-checked by tools/checks.mjs against CANON_DEPENDENCIES.json):
//   - Analysis / Matching / Return / Timeline composition: derived from the G2.3 build inputs (app.js e2b507f5…,
//     build.mjs 72b76743…, content.mjs ae06f380…), whose hashes equal the preserved G2.3 MANIFEST on main; bridge.js,
//     bidi.js, glyphs.mjs and tokens.mjs are those inputs byte-for-byte (tokens.mjs: vendored path only).
//   - Conversation / Writing / Voice Note / Live Call: ported from the FINAL R1-corrected G1.2 source on main
//     (product-proofs/g1.2/source/src/runtime.js 467f5b76…, content.mjs 2f5fe6da…), never from its pre-R1 builds.
//   - The world: the canonical I-08B1 file, byte-for-byte, inlined as base64 and SHA-256-checked in the page.
//
// What G3.1 changes, and why (every change is an INTEGRATION change, none is a feature):
//   C1  the chrome column is the frozen T-11 §3 / T-12 §5 order: World → Timeline → OrientationChrome. The G2 proofs
//       put orientation ABOVE the Timeline; that order was never canonicalized (G2 closure §E, S-04) and is not used.
//       The compact Return presentation (T-11 amendment) lives inside OrientationChrome in that canonical position.
//   C2  one Conversation for all three modes: Writing and Voice Note stay in the Conversation; a Live Call starts in
//       the Analysis and survives every surface switch with one call identity (G1.2 §1).
//   C3  one locale authority: the device language chooses the Product language (T-12 §9); both languages ship in the
//       page as templates of the SAME markup. English has no Matching moment: no English Matching copy exists.
//   C4  one appearance authority: F2 (follow the system), with G2's scoped supersession for the Living Analysis World
//       only. Q-LIGHT-SHELL stays OPEN: the surrounding shell under system Light is a HARNESS fixture (A / B), never a
//       Product preference and never a G3 decision.
//   C5  focus order = visual order (the DOM is ordered top → bottom); focus is placed after every place change.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { palette } from './tokens.mjs';
import { COPY, THREAD, OPENER, DAYS, FIXTURE, TYPING, CALL_SCRIPT } from './content.mjs';
import { qMarkSVG } from './glyphs.mjs';
import { sigSvg } from './sig.mjs';
import { utilSvg, UTILITY_DEFAULT } from './utility.mjs';
import { railArt, RAIL_RECOMMENDED, SPINE_RECOMMENDED, END_GLYPH_PX, END_GLYPH_STUDY } from './machines.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SOURCE = join(HERE, '..');
const VENDOR = join(SOURCE, 'vendor');
export const OUT_DEFAULT = join(SOURCE, '..', 'prototype');

export const WORLD_PIN = '4DFD9D27D752C3A445168C0CC7067D71DF4ADA84BC61B806D12C8BB3202BC413';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const worldBytes = readFileSync(join(VENDOR, 'canon', 'wf-living-constellation.html'));
if (sha(worldBytes).toUpperCase() !== WORLD_PIN) throw new Error(`REFUSING TO BUILD: canonical world is ${sha(worldBytes)}, pinned ${WORLD_PIN}`);
const FONT = readFileSync(join(VENDOR, 'fonts', 'Estedad-wght-v8.5.woff2')).toString('base64');
const fman = JSON.parse(readFileSync(join(VENDOR, 'fonts', 'google', 'FONT_MANIFEST.json'), 'utf8'));
const worldFonts = fman.faces.filter((f) => f.family === 'IBM Plex Sans Arabic').map((f) => {
  const e = fman.entries[f.url]; const buf = readFileSync(join(VENDOR, 'fonts', 'google', e.file));
  if (sha(buf) !== e.sha256) throw new Error('vendored face changed: ' + e.file);
  return { weight: f.weight, unicodeRange: f.unicodeRange, b64: buf.toString('base64') };
});
if (worldFonts.length !== 20) throw new Error(`expected 20 IBM Plex Sans Arabic faces, found ${worldFonts.length}`);
const BRIDGE = readFileSync(join(HERE, 'bridge.js'), 'utf8');
const APP = readFileSync(join(HERE, 'app.js'), 'utf8');
const BIDI = readFileSync(join(HERE, 'bidi.js'), 'utf8');
const paragraphDir = new Function(`${BIDI}\nreturn paragraphDir;`)();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };
const rgba = (hex, a) => `rgba(${rgb(hex)},${a})`;

function vars(appearance) {
  const p = palette(appearance);
  const c = p.colors, n = p.numbers;
  return `--world:${c.world};--world-rgb:${rgb(c.world)};--surface:${c.surface};--utterance:${c.functional};--primary:${c.primary};--secondary:${c.secondary};` +
    `--tertiary:${c.tertiary};--brass:${c.brass};--mark:${c.mark};--rest:${c.restInk};--sel-ink:${c.selectedInk};--marker:${c.selectedMarker};` +
    `--focus:${c.focusIndicator};--focus-c:${c.focusCompanion};--press:${rgba(c.pressedInk, n.pressedPresence)};--scrim:${rgba(c.scrim, p.alpha.scrim)};` +
    `--error:${c.error};--disabled:${c.disabled};--w-rest:${n.restWeight};--w-sel:${n.selectedWeight};--focus-w:${n.focusThickness}px;` +
    `--focus-cw:${n.focusCompanionThickness}px;--focus-off:${n.focusOffset}px;--marker-h:${n.markerThickness}px;`;
}
export const PALETTES = Object.fromEntries(['dark', 'light'].map((a) => { const p = palette(a); return [a, { ...p.colors, pressedPresence: p.numbers.pressedPresence }]; }));

function css() {
  return `
@font-face{font-family:Estedad;src:url(data:font/woff2;base64,${FONT}) format('woff2');font-weight:100 900;font-display:block}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#0a0a0a}
body{font-family:Estedad;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
#phone,#phone *{letter-spacing:0}
#phone[data-appearance="dark"]{${vars('dark')}}
#phone[data-appearance="light"]{${vars('light')}}
/* G2 closure §F — the Living Analysis World is ONE dark immersive surface under either system appearance. Everything
   that exists only over the world carries the dark scope; nothing of the world is repainted, veiled or re-tuned. */
#phone .dk{${vars('dark')}}
#phone{--W:390px;--H:844px;--top:47px;--hdr:48px;--rail:56px;--home:34px;--comp:64px;--tl:88px;--callH:0px;--band-h:0px;--ctx-h:0px;--ctx-on:0;
  position:relative;width:var(--W);height:var(--H);overflow:hidden;background:var(--world);color:var(--primary);isolation:isolate}
#phone:not([data-call="none"]){--callH:var(--comp)}
::selection{background:var(--press);color:var(--primary)}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent;text-align:inherit}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#phone [hidden]{display:none !important}
.r-title{font-size:26px;line-height:1.6538;font-weight:600}
.r-body{font-size:17px;line-height:1.7647;font-weight:400}
.r-support{font-size:15px;line-height:1.6667;font-weight:400}
.r-action{font-size:14px;line-height:1.6429;font-weight:500}
.r-meta{font-size:12px;line-height:1.6667;font-weight:500}
.num{font-variant-numeric:tabular-nums}
.fprobe{position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);top:0;left:0}

/* ---------------------------------------------------------------- system chrome (not Product) */
.status{position:absolute;top:0;inset-inline:0;height:47px;display:flex;align-items:center;justify-content:space-between;padding:4px 28px 0;color:var(--primary);z-index:12;pointer-events:none}
.status .clock{font:600 16px/1 Estedad;direction:ltr}
.status .sys{display:flex;gap:6px;align-items:center;direction:ltr}
.homebar{position:absolute;bottom:8px;left:50%;width:134px;height:5px;border-radius:3px;background:var(--primary);transform:translateX(-50%);z-index:12;pointer-events:none}

/* ----------------------------------------------------------------------------- the world ---- */
#world-layer{position:absolute;inset:0;z-index:0;transform-origin:50% 40%;will-change:transform,opacity}
#stage-clip{position:absolute;inset:0;overflow:hidden;background:#000}
#stage{position:absolute;top:0;left:0}
#world-frame{display:block;border:0;pointer-events:none;background:#000}
/* Legibility falloffs are the WORLD material thinning over the cosmos, not a Surface (G2.1). G3.1 C1: the lower falloff
   now follows the canonical column — its dense part holds OrientationChrome (lowest), then the Timeline above it. */
#falloff-top{position:absolute;top:0;inset-inline:0;height:172px;z-index:2;pointer-events:none;
  background:linear-gradient(180deg,rgba(var(--world-rgb),.9) 0,rgba(var(--world-rgb),.66) 70px,rgba(var(--world-rgb),.28) 120px,rgba(var(--world-rgb),0) 172px)}
/* G3.2 D-B: the temporal line is words over the world, so it gets the ground every chrome word has. While it is shown
   (--ctx-on, its own opacity), the falloff's stop at the top of the support rises from .62 to .88 and sits at the
   line's top edge (--ctx-h: how far the line stands above the Timeline's own 88 pt; 0 when it fits in the row's free
   top). With no temporal context both are 0 and the falloff is G3.1's, exactly. The world itself is not touched. */
#falloff-bottom{position:absolute;bottom:0;inset-inline:0;z-index:2;pointer-events:none;height:calc(var(--home) + var(--rail) + var(--callH) + var(--band-h) + var(--tl) + var(--ctx-h) + 70px);
  background:linear-gradient(0deg,rgba(var(--world-rgb),.96) 0,rgba(var(--world-rgb),.93) calc(var(--home) + var(--rail) + var(--callH) + var(--band-h) + 30px),rgba(var(--world-rgb),calc(.62 + .26 * var(--ctx-on))) calc(var(--home) + var(--rail) + var(--callH) + var(--band-h) + var(--tl) + var(--ctx-h)),rgba(var(--world-rgb),0) 100%)}
#gesture{position:absolute;inset:0;z-index:3;touch-action:none;cursor:grab;outline:0}
#gesture:active{cursor:grabbing}
#phone:not([data-place="analysis"]) #gesture{display:none}
#gesture:focus-visible{box-shadow:inset 0 0 0 var(--focus-w) var(--focus)}

/* ------------------------------------------------------------------- the upper chrome (G1.1) --- */
#hdr{position:absolute;top:var(--top);inset-inline:0;height:var(--hdr);z-index:8;pointer-events:none}
#hdr-conv,#hdr-world{position:absolute;inset:0;display:flex;align-items:center;padding:0 10px;padding-inline-end:58px}
.hbtn,#replay{pointer-events:auto}
.hbtn{position:relative;display:flex;align-items:center;gap:6px;min-height:44px;padding:0 12px;border-radius:12px;color:var(--rest)}
.hbtn .lb{font-size:14px;line-height:1.6429;font-weight:var(--w-rest)}
#door{margin-inline-start:auto}
#back,#prop-back{color:var(--primary)}
#replay{position:absolute;top:calc(var(--top) + (var(--hdr) - 44px) / 2);inset-inline-end:10px;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest);z-index:9}
#phone[dir="rtl"] .mirror{transform:scaleX(-1)}

/* ---------------------------------------------------------------------- the Timeline (T-05/T-06) --- */
/* C1: the Timeline sits directly under the world. Its base is the top of OrientationChrome; when the chrome has
   something to say, the Timeline rises by exactly the chrome's height (one transform, T-10 curve). */
#timeline{position:absolute;inset-inline:0;bottom:calc(var(--home) + var(--rail) + var(--callH));height:var(--tl);z-index:5;--act:0;pointer-events:none;will-change:transform}
#tl-track{position:absolute;bottom:0;inset-inline-start:16px;inset-inline-end:56px;height:44px;overflow:hidden;touch-action:none;cursor:ew-resize;pointer-events:auto;outline:0;border-radius:10px}
#tl-track:focus-visible{box-shadow:0 0 0 var(--focus-off) var(--focus-c),0 0 0 calc(var(--focus-off) + var(--focus-w)) var(--focus)}
/* P2-A — the TEMPORAL SPINE. #spine is drawn every frame by app.js drawSpine() over T-05's geometry: one committed
   Moment per 48 pt (TIMELINE_STEP, unchanged), inside the 44-pt band (#tl-track, unchanged). The G3.2 proof drew its
   ticks 16 pt apart; P2 restores the canonical 48-pt pitch, so a narrow phone shows fewer Moments (T-05 §"Narrow widths
   show fewer steps") and the older ones stay reachable by the window, which is never animated (T-06). */
#spine{position:absolute;inset:0;width:100%;height:100%;overflow:visible;color:var(--primary)}
/* P2-A: the floating Moment number is not drawn. With the canonical 48-pt pitch it collides with the Live act's label near
   the Live edge (found in capture), and it only repeated what T-08's temporal line above the Track already says. The
   number stays in the accessible value (aria-valuetext) and in the line. */
#tl-num{display:none}
/* The Live edge is T-05/T-06's outboard slot beside the Track (T-11 §6). While PINNED it is RETURN_LIVE_HEAD's one home. */
#tl-live{position:absolute;bottom:0;inset-inline-end:6px;min-width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest);pointer-events:auto}
#tl-live .term{position:absolute;bottom:0;inset-inline-end:0;width:44px;height:44px;overflow:visible;color:var(--primary);pointer-events:none}
/* G3.2 D-B: the Live-edge act's box starts at its label row (60 of the row's 88 pt), so the temporal line that now
   sits in the row's top 28 pt is never inside the act's hit box or focus ring. The label and mark do not move. */
#tl-live.ret{height:60px;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-end;padding:0 4px 0}
#tl-live.ret .lb{font-size:14px;line-height:1.6429;font-weight:var(--w-rest);white-space:nowrap;padding:0 6px;margin-bottom:12px}
/* P2-A: the Live TERMINAL (drawn by app.js) replaces the G3.2 ring; it keeps T-12's rule: the label stays, never icon-only. */
#tl-live.ret .lb{margin-bottom:40px}
/* P2-A finding F-P2-02: G3.2's Live act box (label row + slot, ~169 × 60 pt) lay over the END of the Track, so a press on
   the last Moments reached Return Live instead of the Timeline (worse at the canonical 48-pt pitch: SP 15–17 at 390 pt).
   The act keeps its box, label and focus ring; only its HIT region is narrowed to its label and its outboard column, so
   the Live edge never overlaps the target strip (T-11 §6) and its target stays 50 × 60 pt (≥ 44). */
#tl-live.ret{pointer-events:none}
#tl-live.ret .lb,#tl-live .hit{pointer-events:auto}
#tl-live .hit{position:absolute;bottom:0;inset-inline-end:0;width:50px;height:60px}
/* G3.2 D-B — the temporal orientation line belongs to the Timeline. It is the Timeline's first child (reading and focus
   order = visual order), it stands on the row's free top 28 pt and grows upward, and it rides with the Timeline: it
   never travels on its own. Same words, size, ink and start inset (24 pt) as the status line it replaces below; its end
   runs to 12 pt from the edge (a ragged end), which keeps T-08's longest temporal sentence to two lines at 320 pt. */
#tl-ctx{position:absolute;bottom:60px;inset-inline-start:20px;inset-inline-end:12px;max-width:348px;padding-inline:4px 0;color:var(--primary);pointer-events:none;opacity:0}
#tl-ctx .o-live{color:var(--secondary)}
#tl-ctx span + span{margin-inline-start:.28em}

/* ---------------------------------------------- OrientationChrome (T-08 words, T-11 amendment) --- */
/* C1: the band is the LAST region of the column, under the Timeline. One status line; one dominant Return act shown
   directly; the rest under «طرق العودة» (Return acts only). The trigger is text, like every return (T-08). */
#band{position:absolute;inset-inline:0;bottom:calc(var(--home) + var(--rail) + var(--callH));z-index:5;padding:2px 20px 8px;pointer-events:none;
  max-height:var(--band-max,none);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none}
#band::-webkit-scrollbar{display:none}
/* T-11 §3: the world is sized FIRST, at no less than half; the support yields and keeps its remainder reachable inside
   itself. When OrientationChrome holds more than its room, it scrolls (pointer and keyboard), and a soft edge says so. */
#band.scroll{pointer-events:auto;-webkit-mask-image:linear-gradient(0deg,transparent 0,#000 22px);mask-image:linear-gradient(0deg,transparent 0,#000 22px)}
#band.scroll.at-end{-webkit-mask-image:none;mask-image:none}
#band p{padding-inline:4px;color:var(--primary);max-width:340px}
#band .o-live{color:var(--secondary)}
#band .o-status span + span{margin-inline-start:.28em}
#band .acts{display:flex;flex-wrap:wrap;gap:0 2px;margin-top:2px;margin-inline-start:-6px}
.ret{position:relative;pointer-events:auto;min-height:44px;padding:0 10px;border-radius:12px;color:var(--rest);display:inline-flex;align-items:center}
.ret .lb{font-size:14px;line-height:1.6429;font-weight:var(--w-rest);white-space:nowrap}
#band .ret.more-t .lb{color:var(--tertiary)}
#band .ret.more-t[aria-expanded="true"] .lb{color:var(--rest)}
button.down::before{content:"";position:absolute;inset:4px 0;border-radius:10px;background:var(--press)}
.hbtn.down::before,#replay.down::before,#cue.down::before,.cbtn.down::before,#rail .it.down::before{inset:0}

/* ------------------------------------------------------ the lower line: FIELD (G1.2 R1) --- */
#composer{position:absolute;bottom:calc(var(--home) + var(--rail));height:var(--comp);inset-inline:0;background:var(--surface);z-index:6;will-change:transform;--v:0}
.write{position:absolute;top:10px;inset-inline-start:20px;inset-inline-end:118px;height:44px}
#phone:not([data-call="none"]) .write{inset-inline-end:184px}
#input{position:absolute;inset-inline:0;top:2px;height:30px;width:100%;border:0;outline:0;background:none;color:var(--primary);font:400 17px/1.7647 Estedad;caret-color:var(--primary);text-align:start;opacity:calc(1 - var(--v))}
#input::placeholder{color:var(--tertiary);opacity:1}
.line{position:absolute;inset-inline:0;top:37px;height:1px;background:var(--tertiary);opacity:calc(1 - var(--v))}
#trace{position:absolute;inset-inline-start:0;top:27px;width:100%;height:20px;overflow:visible;opacity:var(--v)}
#trace-path{stroke:var(--primary);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.vtop{position:absolute;top:1px;inset-inline:0;display:flex;gap:12px;align-items:baseline;white-space:nowrap;opacity:var(--v);pointer-events:none}
.vtop #vlabel{color:var(--primary)}
.vtop #elapsed{color:var(--tertiary);direction:ltr}
#phone[data-composer="note"] #input,#phone:not([data-call="none"]) #input{visibility:hidden}
.cbtn{position:absolute;top:10px;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest)}
.slot-o{inset-inline-end:14px}.slot-i{inset-inline-end:66px}.slot-ii{inset-inline-end:118px}
.cbtn.m{display:none}
#phone[data-composer="idle"][data-call="none"] .m-idle{display:grid}
#phone[data-composer="idle"][data-call="none"] #composer.has-text #mic{display:none}
#phone[data-composer="idle"][data-call="none"] #composer:not(.has-text) #send{display:none}
#phone[data-composer="note"] .m-note{display:grid}
#phone:not([data-call="none"]) .m-call{display:grid}
#phone[data-call="connecting"] #route{display:none}
#send,#note-send{color:var(--primary)}
/* P2-A: Mic ↔ Muted and the speaker route are ONE drawing each, morphed by app.js (muteMorph / routeMorph). */
#end-call{color:var(--primary)}
/* P2-A — the CALL RAIL. The G3.2 ring around End Call and the simulated level trace are gone: the rail's art (machines.mjs)
   is neutral hairline geometry; End's rank is separation + terminal form + its solid glyph in primary ink. */
.crail{position:absolute;inset:0;pointer-events:none;color:var(--tertiary);display:none;opacity:var(--v)}
#phone:not([data-call="none"])[data-rail="A"] .crail[data-v="A"],#phone:not([data-call="none"])[data-rail="B"] .crail[data-v="B"],#phone:not([data-call="none"])[data-rail="C"] .crail[data-v="C"]{display:block}
.cr-art{position:absolute;overflow:visible}
#phone[dir="rtl"] .cr-art{transform:scaleX(-1)}
#phone:not([data-call="none"]) #end-call{inset-inline-end:12px}
#phone:not([data-call="none"]) #mute{inset-inline-end:78px}
#phone:not([data-call="none"]) #route{inset-inline-end:122px}
#phone:not([data-call="none"]) .write{inset-inline-end:184px}
#phone:not([data-call="none"]) #trace{display:none}
#phone:not([data-call="none"]) .vtop{top:10px}

/* --------------------------------------------------------------- the rail (G1.1 / G1.2) --- */
#rail{position:absolute;bottom:0;height:calc(var(--rail) + var(--home));inset-inline:0;background:var(--surface);z-index:9}
#rail .items{position:absolute;top:0;inset-inline:0;height:var(--rail);display:flex}
#rail .it{position:relative;flex:1;min-width:0;height:var(--rail);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;padding:0 6px}
#rail .ic{position:relative;display:block;height:24px;color:var(--brass);line-height:0}
/* P2-A (found by check K18): the press wash is the item's GROUND (E1R) and must lie under the glyph and the word. G3.2's
   wash was a positioned ::before painted OVER unpositioned content, which tinted the Brass while pressed. */
#rail .it .lb{position:relative}
#rail .lb{font-size:14px;line-height:1.6429;font-weight:var(--w-rest);color:var(--brass);text-align:center;white-space:nowrap}
#rail .it.sel .lb{font-weight:var(--w-sel)}
#marker{position:absolute;top:0;left:0;height:var(--marker-h);width:0;background:var(--marker);pointer-events:none}

/* --------------------------------------------------------- the Conversation (G1.1 / G1.2 R1) ---- */
#conv{position:absolute;top:calc(var(--top) + var(--hdr));bottom:calc(var(--home) + var(--rail) + var(--comp));inset-inline:0;z-index:4;background:var(--world);will-change:transform,opacity}
#scroll{position:absolute;inset:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none}
#scroll::-webkit-scrollbar{display:none}
.fade{position:absolute;top:0;inset-inline:0;height:28px;background:linear-gradient(var(--world),rgba(var(--world-rgb),0));pointer-events:none;z-index:2}
.thread{position:relative;min-height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding:14px 24px 26px}
.hist,.new{display:flex;flex-direction:column}
.day{color:var(--tertiary);margin:34px 0 2px;text-align:center}
.hist > .day:first-child{margin-top:8px}
/* G1.1 closure §1: the reader's committed turn (UTTERANCE) is a partial directional slab attached to the reader's own
   screen edge — the START edge: RIGHT in Arabic, LEFT in English. QANDEEL is open on the World from the opposite edge. */
.t{position:relative;max-width:100%;margin-top:16px;color:var(--primary)}
.t .tx{overflow-wrap:anywhere}
.t.q{align-self:flex-end;max-width:calc(100% - 48px)}
.t.me{align-self:flex-start;margin-top:28px;margin-inline-start:-24px;max-width:calc(100% - 40px);background:var(--utterance);padding-block:11px 12px;padding-inline:24px 18px;
  border-start-end-radius:18px;border-end-end-radius:18px}
.day + .t.me{margin-top:14px}
.t.me + .t.me{margin-top:6px}
bdi{unicode-bidi:isolate}
.t.opener .qm{display:block;color:var(--mark);margin-bottom:12px}
.t.opener{margin-top:10px}
.day.callm{margin:22px 0 0}
/* A committed voice message (G1.2 §15): same side, same material as a written turn; duration only, no invented
   waveform or transcript. The media row reads left-to-right in both scripts (a media timeline is not mirrored). */
.vn{display:flex;align-items:center;gap:10px;direction:ltr;min-width:212px}
.vn .play{position:relative;width:44px;height:44px;margin:-8px -6px;display:grid;place-items:center;border-radius:12px;color:var(--primary);flex:none}
.vn .play .g-pause{display:none}
.vn .play[data-playing="1"] .g-play{display:none}
.vn .play[data-playing="1"] .g-pause{display:block}
.vn .trk{position:relative;flex:1;min-width:96px;height:2px;border-radius:1px;background:var(--tertiary)}
.vn .trk .fill{position:absolute;inset-block:0;left:0;width:0;background:var(--primary);border-radius:1px}
.vn .dur{color:var(--tertiary);min-width:32px;text-align:right}
.t.voice .vk{color:var(--tertiary);margin-top:6px}

/* ------------------------------------------------------------ Matching: the attention cue --- */
/* One Product-level moment, outside the semantic world (G2.1 primary placement): the completed QANDEEL Q and the
   approved message, one quiet act. No glow, no count, no candidate, no photo, no percentage. */
#cue{position:absolute;z-index:8;top:calc(var(--top) + var(--hdr) + 2px);inset-inline-start:10px;inset-inline-end:12px;display:flex;align-items:flex-start;gap:10px;min-height:44px;padding:6px 12px 4px;border-radius:12px;color:var(--primary)}
#cue .qm{color:var(--mark);flex:none;margin-top:6px}
#cue .cue-tx{display:block;min-width:0}
#cue .cue-line{display:block;color:var(--primary);text-wrap:balance}
#cue .cue-s1{display:block;color:var(--primary);text-wrap:balance}
#cue .cue-s2{display:block;color:var(--secondary);text-wrap:balance;margin-top:3px}
#cue .cue-act{display:inline-block;color:var(--rest);margin-top:1px;min-height:23px}
#falloff-cue{position:absolute;top:0;inset-inline:0;height:calc(var(--top) + var(--hdr) + var(--cue-h,60px) + 84px);z-index:2;pointer-events:none;opacity:0;
  background:linear-gradient(180deg,rgba(var(--world-rgb),.9) 0,rgba(var(--world-rgb),.9) calc(var(--top) + var(--hdr) + var(--cue-h,60px) + 8px),rgba(var(--world-rgb),0) 100%)}

/* ------------------------------------------ Matching: the private proposal (its own place) --- */
#proposal,#shared{position:absolute;top:0;bottom:calc(var(--home) + var(--rail));inset-inline:0;z-index:7;background:var(--world);will-change:transform,opacity}
#proposal{display:flex;flex-direction:column}
.p-hdr{flex:none;height:var(--hdr);margin-top:var(--top);display:flex;align-items:center;padding:0 10px}
.p-scroll{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none}
.p-scroll::-webkit-scrollbar{display:none}
.p-scroll.more{-webkit-mask-image:linear-gradient(180deg,#000 calc(100% - 28px),transparent);mask-image:linear-gradient(180deg,#000 calc(100% - 28px),transparent)}
.p-body{flex:1 0 auto;padding:14px 28px 28px}
.p-body > .qm{display:block;color:var(--mark);margin-bottom:14px}
.p-view{color:var(--primary);max-width:334px;text-wrap:pretty}
.p-privacy{color:var(--secondary);margin-top:36px;max-width:334px;text-wrap:pretty}
.p-privacy .lead{color:var(--primary)}
#prop-gone{color:var(--primary);margin-top:2px}
.p-foot{flex:none;padding:10px 18px 14px}
#prop-next{color:var(--secondary);padding:0 10px 6px;max-width:354px}
.p-actions{display:flex;gap:6px}
.p-actions .pa{position:relative;min-height:44px;padding:0 10px;border-radius:12px}
#proceed{color:var(--primary)}
#not-now{color:var(--rest)}
#prop-ack{color:var(--primary);padding:0 10px 12px;max-width:354px}

/* ---------------------------------- the Shared World / INTRODUCTION (its first screen only) ------- */
.s-name{position:absolute;top:calc(var(--top) + 10px);inset-inline:0;padding:0 28px}
.s-name h1{color:var(--primary);outline:0}
.s-name .ph{color:var(--tertiary)}
.s-thread{position:absolute;inset-inline:0;bottom:calc(var(--comp) + 18px);padding:0 24px;display:flex;flex-direction:column}
.s-thread .day{margin:0 0 4px}
.s-thread .t.q{align-self:flex-end}
.s-line{position:absolute;bottom:0;height:var(--comp);inset-inline:0;background:var(--surface)}
.s-line .write2{position:absolute;top:10px;inset-inline-start:20px;inset-inline-end:20px;height:44px}
.s-line .ph2{position:absolute;inset-inline:0;top:2px;color:var(--tertiary);font:400 17px/1.7647 Estedad}
.s-line .line{top:37px;opacity:1}

/* ------------------------------------------------------------- Replay entry (ASIDE, G1.1) --- */
#rmenu{position:absolute;top:calc(var(--top) + var(--hdr) - 2px);inset-inline-end:10px;width:244px;background:var(--surface);border-radius:14px;padding:6px 0;z-index:10;transform-origin:top left}
#phone[dir="ltr"] #rmenu{transform-origin:top right}
#rmenu .mi{position:relative;display:flex;align-items:center;width:100%;min-height:48px;padding:10px 18px;text-align:start;color:var(--primary)}
#rmenu .mi .lb{font-size:15px;line-height:1.6667}
#rmenu .mnote{padding:4px 18px 8px;color:var(--tertiary)}

button:focus{outline:0}
button:focus-visible,#input:focus-visible,.s-name h1:focus-visible{outline:0;box-shadow:0 0 0 var(--focus-off) var(--focus-c),0 0 0 calc(var(--focus-off) + var(--focus-w)) var(--focus),0 0 0 calc(var(--focus-off) + var(--focus-w) + var(--focus-cw)) var(--focus-c)}

/* ------------------------------------------------------------------ PROOF HARNESS (not Product) */
body.live{display:flex;gap:36px;align-items:flex-start;padding:28px;min-height:100vh}
body.live #phone{flex-shrink:0;border-radius:44px;box-shadow:0 0 0 10px #050505,0 0 0 11px #2a2a2a}
.harness{position:static;width:460px;color:#cfcfcf;font:13px/1.55 system-ui,'Segoe UI',sans-serif}
.harness .flag{display:inline-block;font:700 11px/1 system-ui,'Segoe UI',sans-serif;letter-spacing:.06em;color:#101010;background:#e0b650;border-radius:4px;padding:5px 8px;margin-bottom:10px}
.harness h1{font-size:15px;margin:0 0 6px;color:#ececec}
.harness h2{font-size:12.5px;margin:16px 0 6px;color:#e2e2e2;font-weight:600}
.harness p{margin:0 0 8px;color:#9b9b9b}
.harness .btns{display:flex;flex-wrap:wrap;gap:6px}
.harness button{font:12px/1 system-ui,'Segoe UI',sans-serif;color:#dcdcdc;border:1px solid #444;border-radius:6px;padding:8px 10px;background:#181818}
.harness button[aria-pressed="true"]{background:#d8d5ca;color:#101010;border-color:#d8d5ca}
.harness pre{font:11px/1.5 ui-monospace,Consolas,monospace;color:#a8a8a8;white-space:pre-wrap;background:#121212;border:1px solid #2a2a2a;border-radius:6px;padding:8px;max-height:280px;overflow:auto}
.harness code{font:11.5px ui-monospace,Consolas,monospace;color:#bdbdbd}
.harness .open{color:#e0b650}
`;
}

function statusBar() {
  return `<div class="status" id="status" aria-hidden="true"><span class="clock">9:41</span><span class="sys">` +
    `<svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5" width="3" height="6" rx="1" fill="currentColor"/><rect x="10" y="2.5" width="3" height="8.5" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="11" rx="1" fill="currentColor"/></svg>` +
    `<svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="17" height="8" rx="1.6" fill="currentColor"/><rect x="23.6" y="4" width="1.8" height="4" rx=".9" fill="currentColor" opacity=".45"/></svg>` +
    `</span></div>`;
}
function openerHTML(lang, name) { const [a, b] = OPENER[lang].split('{display_name}'); return `${esc(a)}<bdi>${esc(name)}</bdi>${esc(b)}`; }
function threadHTML(lang) {
  const L = COPY[lang];
  return THREAD[lang].map((t) => {
    if (t.day) return `<p class="day r-meta">${esc(t.day === 'today' ? `${DAYS[lang].today} ${t.time}` : DAYS[lang].yesterday)}</p>`;
    const label = `<span class="sr">${esc(t.who === 'me' ? L.speakerMe.text : L.speakerQ.text)}: </span>`;
    if (t.kind === 'opener') {
      const text = OPENER[lang].split('{display_name}').join(L.displayName.text);
      return `<div class="t q opener" data-who="q">${qMarkSVG({ height: 22, cls: 'qm' })}${label}<p class="tx r-body" dir="${paragraphDir(text, L.dir)}">${openerHTML(lang, L.displayName.text)}</p></div>`;
    }
    return `<div class="t ${t.who}" data-who="${t.who}">${label}<p class="tx r-body" dir="${paragraphDir(t.text, L.dir)}">${esc(t.text)}</p></div>`;
  }).join('');
}
/** The committed voice message's media row (G1.2 R1 voiceRowHTML), cloned by the runtime for sent notes. */
function voiceRowHTML() {
  return `<div class="vn"><button class="play" type="button" data-playing="0">${sigSvg('play', { size: 20, cls: 'g-play' })}${sigSvg('pause', { size: 20, cls: 'g-pause' })}</button>` +
    `<span class="trk" aria-hidden="true"><span class="fill"></span></span><span class="dur r-meta num">0:00</span></div>`;
}
/** Copy with template functions turned into {tpl} so it survives JSON. */
function serial(v) {
  if (typeof v === 'function') return { tpl: v('{0}', '{1}') };
  if (Array.isArray(v)) return v.map(serial);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, serial(x)]));
  return v;
}

/** The phone, in one Product language. The DOM runs top → bottom so focus order is visual order (C5). */
export function phoneHTML(lang) {
  const L = COPY[lang];
  // P2-A: the persistent navigation family — one Living Brass glyph above each frozen destination name. The glyph is
  // decorative (the word names the button); it carries no state class, so it cannot express state (C3 §6).
  const NAV_ICON = { mine: 'navMine', shared: 'navShared', public: 'navPublic' };
  const railItems = L.nav.items.map((n) => `<button class="it" data-world="${n.key}" type="button"><span class="ic">${sigSvg(NAV_ICON[n.key], { size: 24 })}</span><span class="lb">${esc(n.text)}</span></button>`).join('');
  let proposal = '';
  if (L.propPrivacy) {
    // The privacy message's first sentence is its run-in lead (G2.3). Presentation only — it must rejoin exactly.
    const pv = L.propPrivacy.text, cut = pv.indexOf('. '), pvLead = pv.slice(0, cut + 1), pvRest = pv.slice(cut + 2);
    if (cut < 1 || `${pvLead} ${pvRest}` !== pv) throw new Error('REFUSING TO BUILD: the privacy message does not rejoin exactly');
    proposal = `<section id="proposal" aria-label="${esc(L.proposalRegion.text)}">
  <div class="p-hdr"><button id="prop-back" class="hbtn" type="button">${utilSvg('back', { cls: 'mirror', size: 22 })}<span class="lb">${esc(L.proposalBack.text)}</span></button></div>
  <div class="p-scroll" id="prop-scroll"><div class="p-body">${qMarkSVG({ height: 22, cls: 'qm' })}<span class="sr">${esc(L.speakerQ.text)}: </span>
    <div id="prop-view"><p class="p-view r-body" id="prop-qview">${esc(L.propView.text)}</p><p class="p-privacy r-support" id="prop-privacy"><span class="lead">${esc(pvLead)}</span> <span>${esc(pvRest)}</span></p></div>
    <p id="prop-gone" class="r-body" hidden>${esc(L.unavailable.text)}</p></div>
  <div class="p-foot" id="prop-foot">
    <p id="prop-next" class="r-support"></p>
    <div class="p-actions" id="prop-actions"><button id="proceed" class="pa r-action" type="button">${esc(L.proceed.text)}</button><button id="not-now" class="pa r-action" type="button">${esc(L.notNow.text)}</button></div>
    <p id="prop-ack" class="r-body" role="status" hidden>${esc(L.ack.text)}</p>
  </div></div>
</section>
<section id="shared" aria-labelledby="s-title">
  <div class="s-name"><h1 class="r-title" id="s-title" tabindex="-1">${esc(L.sharedTitle.text)}</h1><p class="ph r-meta">${esc(L.phaseIntroduction.text)}</p></div>
  <div class="s-thread"><p class="day r-meta" id="s-day"></p><div class="t q opener" id="s-welcome">${qMarkSVG({ height: 22, cls: 'qm' })}<span class="sr">${esc(L.speakerQ.text)}: </span><p class="tx r-body">${esc(L.welcome.text)}</p></div></div>
  <div class="s-line"><div class="write2"><span class="ph2">${esc(L.composerPlaceholder.text)}</span><div class="line"></div></div></div>
</section>`;
  }
  const cue = L.matchCue ? `<button id="cue" class="dk" type="button" hidden>${qMarkSVG({ height: 16, cls: 'qm' })}<span class="cue-tx"><span class="cue-line r-support" id="cue-line"></span><span class="cue-act r-action" id="cue-act"></span></span></button>` : '';
  return `<div id="phone" dir="${L.dir}" lang="${L.lang}" data-lang="${lang}" data-appearance="dark" data-place="conversation" data-call="none" data-composer="idle" data-mode="FOLLOW_LIVE" aria-label="${esc(L.product.text)}">
<span class="fprobe" aria-hidden="true"><span style="font-weight:400">ا</span><span style="font-weight:500">ا</span><span style="font-weight:600">ا</span></span>
<div id="world-layer" class="dk" aria-hidden="true"><div id="stage-clip"><div id="stage"><iframe id="world-frame" title="${esc(L.analysisRegion.text)}" tabindex="-1" aria-hidden="true"></iframe></div></div></div>
<div id="falloff-top" class="dk"></div><div id="falloff-cue" class="dk"></div><div id="falloff-bottom" class="dk"></div>
${statusBar()}
<div id="hdr">
  <div id="hdr-conv"><button id="door" class="hbtn" type="button">${sigSvg('depth', { size: 22 })}<span class="lb">${esc(L.door.text)}</span></button></div>
  <div id="hdr-world" class="dk"><button id="back" class="hbtn" type="button" aria-label="${esc(L.backName.text)}">${utilSvg('back', { cls: 'mirror', size: 22 })}<span class="lb">${esc(L.back.text)}</span></button></div>
</div>
<button id="replay" type="button" aria-label="${esc(L.replay.text)}" aria-haspopup="menu" aria-expanded="false" aria-controls="rmenu">${sigSvg('replay', { size: 22 })}</button>
<div id="rmenu" role="menu" aria-label="${esc(L.replay.text)}" hidden><button class="mi" role="menuitem" data-scope="full" type="button" tabindex="-1"><span class="lb">${esc(L.replayFull.text)}</span></button><button class="mi" role="menuitem" data-scope="part" type="button" tabindex="-1"><span class="lb">${esc(L.replayPart.text)}</span></button><p class="mnote r-meta" id="rmenu-note" hidden>${esc(L.replayCallNote.text)}</p></div>
${cue}
<section id="conv" aria-label="${esc(L.convRegion.text)}"><div id="scroll"><div class="thread"><div class="hist">${threadHTML(lang)}</div><div class="new"></div></div></div><div class="fade"></div></section>
<section id="gesture" class="dk" tabindex="0" role="application" aria-roledescription="${lang === 'ar' ? 'العالم' : 'world'}" aria-label="${esc(L.analysisRegion.text)}" aria-describedby="world-hint"><span class="sr" id="world-hint">${esc(L.worldRegionHint.text)}</span></section>
<div id="timeline" class="dk">
  <p id="tl-ctx" class="r-support" hidden></p>
  <div id="tl-track" tabindex="0" role="slider" aria-label="${esc(L.timelineLabel.text)}" aria-describedby="tl-hint"><span class="sr" id="tl-hint">${esc(L.timelineHint.text)}</span><svg id="spine" aria-hidden="true" focusable="false"></svg></div>
  <span id="tl-num" class="r-meta num" aria-hidden="true"></span>
  <button id="tl-live" type="button"></button><span class="sr" id="hint-live">${esc(L.returns.RETURN_LIVE_HEAD.hint.text)}</span>
</div>
<div id="band" class="dk" role="region" aria-label="${esc(L.chromeLabel.text)}"><div id="band-in"></div></div>
<div id="composer">
  <label class="sr" for="input">${esc(L.composerLabel.text)}</label>
  <div class="write">
    <input id="input" type="text" dir="auto" autocomplete="off" placeholder="${esc(L.composerPlaceholder.text)}">
    <div class="line"></div>
    <svg id="trace" viewBox="0 0 10 20" preserveAspectRatio="none" aria-hidden="true"><path id="trace-path" d="M0 10 H10"/></svg>
    <div class="vtop"><span id="vlabel" class="r-action"></span><span id="elapsed" class="r-meta num">0:00</span></div>
  </div>
  ${['A', 'B', 'C'].map((v) => `<div class="crail" data-v="${v}" aria-hidden="true">${railArt(v).join('')}</div>`).join('')}
  <button id="call" class="cbtn m m-idle slot-i" type="button" aria-label="${esc(L.call.text)}">${sigSvg('call')}</button>
  <button id="mic" class="cbtn m m-idle slot-o" type="button" aria-label="${esc(L.voiceNote.text)}">${sigSvg('mic')}</button>
  <button id="send" class="cbtn m m-idle slot-o" type="button" aria-label="${esc(L.send.text)}">${sigSvg('send')}</button>
  <button id="note-cancel" class="cbtn m m-note slot-i" type="button" aria-label="${esc(L.voiceCancel.text)}">${utilSvg('close')}</button>
  <button id="note-send" class="cbtn m m-note slot-o" type="button" aria-label="${esc(L.voiceSend.text)}">${sigSvg('send')}</button>
  <button id="route" class="cbtn m m-call slot-ii" type="button" aria-label="${esc(L.route.text)}" aria-pressed="true">${sigSvg('routeMorph', { cls: 'g-route' })}</button>
  <button id="mute" class="cbtn m m-call slot-i" type="button" aria-label="${esc(L.mute.text)}" aria-pressed="false">${sigSvg('muted', { cls: 'g-mm', id: lang })}</button>
  <button id="end-call" class="cbtn m m-call slot-o" type="button" aria-label="${esc(L.endCall.text)}">${sigSvg('endCall', { size: END_GLYPH_PX, cls: 'g-end' })}</button>
</div>
${proposal}
<nav id="rail" aria-label="${esc(L.nav.label.text)}"><div class="items">${railItems}</div><div id="marker"></div></nav>
<div class="homebar" id="homebar"></div>
<p id="call-a11y" class="sr" role="status" aria-live="polite"></p>
</div>`;
}

export function page() {
  const langs = {};
  for (const lang of ['ar', 'en']) langs[lang] = { copy: serial(COPY[lang]), typing: TYPING[lang] };
  const data = { langs, fixture: FIXTURE, script: CALL_SCRIPT, bridge: BRIDGE, palettes: PALETTES, voiceRow: voiceRowHTML(),
    world: { sha256: WORLD_PIN, bytes: worldBytes.length, b64: worldBytes.toString('base64') }, worldFonts };
  return `<!doctype html>
<html lang="ar-EG"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>QANDEEL — P2-A Final Iconography — integrated visual proof (not frozen)</title>
<style>${css()}</style></head>
<body dir="ltr">
<template id="tpl-ar">${phoneHTML('ar')}</template>
<template id="tpl-en">${phoneHTML('en')}</template>
<div id="mount"></div>
${harness()}
<script>window.__G32DATA=${JSON.stringify(data)};</script>
<script>
(function(){var p=new URLSearchParams(location.search);
 /* T-12 §9: the device's language is the ONE locale authority. ?lang= stands in for the device setting (harness). */
 var lang=p.get('lang')==='en'?'en':'ar';
 document.getElementById('mount').appendChild(document.getElementById('tpl-'+lang).content.cloneNode(true));
 document.documentElement.lang=lang==='ar'?'ar-EG':'en';
 var ph=document.getElementById('phone');
 if(p.get('capture')==='1'){document.body.classList.remove('live');var r=document.querySelector('.harness');if(r)r.remove();}
 if(p.get('w'))ph.style.setProperty('--W',p.get('w')+'px');
 if(p.get('h'))ph.style.setProperty('--H',p.get('h')+'px');
 /* F2: the SYSTEM appearance decides; there is no in-app appearance preference. ?appearance= is a harness stand-in. */
 var sys=function(){return window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'};
 ph.setAttribute('data-appearance',p.get('appearance')||sys());ph.setAttribute('data-appearance-source',p.get('appearance')?'harness':'system');
 /* G3.2 D-A: there is no shell parameter. The Analysis shell is dark under either system appearance (the Product
    Owner's decision under proof); every other surface follows the system. */
 /* P2-A harness stand-ins (NOT Product): the Call Rail and Temporal Spine variants under comparison. */
 ph.setAttribute('data-rail',/^[ABC]$/.test(p.get('rail')||'')?p.get('rail'):'${RAIL_RECOMMENDED}');
 ph.setAttribute('data-spine',/^[ABC]$/.test(p.get('spine')||'')?p.get('spine'):'${SPINE_RECOMMENDED}');
 /* P2-A refinement, harness only: the End Call glyph-size study (${END_GLYPH_STUDY.join(' / ')} px). The Product size is
    ${END_GLYPH_PX} px, built into the page; ?end= only re-renders the SAME drawing at a study size for comparison. */
 var es=+(p.get('end')||0);if([${END_GLYPH_STUDY.join(',')}].indexOf(es)>=0){ph.querySelectorAll('#end-call svg').forEach(function(s){s.setAttribute('width',es);s.setAttribute('height',es);});}
 ph.setAttribute('data-end-px',ph.querySelector('#end-call svg')?ph.querySelector('#end-call svg').getAttribute('width'):'');
 window.__G32BOOT={lang:lang};
})();
</script>
<script>${BIDI}</script>
<script>${APP}</script>
</body></html>`;
}

function harness() {
  const b = (s, label) => `<button type="button" data-state="${s}">${label}</button>`;
  const a = (s, label) => `<button type="button" data-sim="${s}">${label}</button>`;
  const t = (group, v, label) => `<button type="button" data-toggle="${group}" data-v="${v}" aria-pressed="false">${label}</button>`;
  return `<aside class="harness" aria-label="Proof harness">
<span class="flag">PROOF HARNESS — NOT PRODUCT UI</span>
<h1>QANDEEL · P2-A — Final Iconography, integrated visual proof</h1>
<p><b>PRODUCT OWNER VISUAL SELECTIONS ACCEPTED — P2 NOT CLOSED / NOT FROZEN.</b> The G3.2 Product state machine, unchanged in its laws, carrying the P2 signature family, the accepted Call Rail and the accepted Temporal Spine + Aperture. Canonical P2 closure is a later P2-B task.</p>
<h2>Variants under comparison (harness only)</h2>
<p>Call Rail: <a href="?rail=A" style="color:#ddd">A Keyed seam (accepted)</a> · <a href="?rail=B" style="color:#ddd">B Open tray</a> · <a href="?rail=C" style="color:#ddd">C Break line</a> (B, C: preserved comparison evidence)<br>Temporal Spine: <a href="?spine=C" style="color:#ddd">C Parting (accepted)</a> · <a href="?spine=A" style="color:#ddd">A Lens</a> · <a href="?spine=B" style="color:#ddd">B Gate</a> (A, B: preserved comparison evidence)<br>End Call glyph study: ${END_GLYPH_STUDY.map((s) => `<a href="?end=${s}" style="color:#ddd">${s} px${s === END_GLYPH_PX ? ' (selected)' : ''}</a>`).join(' · ')}</p>
<p>Everything in the phone is Product; everything here simulates the device, the other human, or jumps to a start state. World: <code id="sha-state">verifying…</code></p>
<h2>Start states</h2>
<div class="btns">${b('CONV', 'Conversation')}${b('P1', 'Analysis · FAR · Live')}${b('P3', 'NEAR · inspecting')}${b('P4', 'PINNED(14)')}${b('P4_OPEN', 'PINNED + «طرق العودة»')}${b('CALL_ANALYSIS', 'In a call · Analysis')}${b('CALL_CONV', 'Same call · Conversation')}${b('CALL_PINNED', 'In a call · PINNED')}${b('REPLAY', 'Replay entry')}${b('M1_CUE', 'Matching attention')}</div>
<h2>The other side / the device (simulated)</h2>
<div class="btns">${a('showCue', 'A proposal awaits')}${a('becomeUnavailable', 'It becomes unavailable')}${a('matchArrives', 'The other side agrees (first accepter)')}${a('typeSame', 'Type a message')}${a('typeCross', 'Type in the other script')}</div>
<h2>Matching perspective</h2>
<div class="btns">${t('who', 'A', 'First accepter')}${t('who', 'B', 'Second accepter')}</div>
<h2>System settings (stand-ins for the OS)</h2>
<div class="btns">${t('appearance', 'system', 'Follow system')}${t('appearance', 'dark', 'System Dark')}${t('appearance', 'light', 'System Light')}</div>
<p style="margin-top:6px">Language: <a href="?lang=ar" style="color:#ddd">Arabic device</a> · <a href="?lang=en" style="color:#ddd">English device</a> · Reduced Motion: <a href="?rm=1" style="color:#ddd">on</a> / <a href="?" style="color:#ddd">system</a></p>
<h2 class="open">Inherited, unchanged (G3 closure)</h2>
<p>The Analysis is one dark place under system Light and Dark; every other surface follows the resolved appearance. The temporal line stands above the Timeline when temporal context exists.</p>
<h2>Truth</h2>
<pre id="truth-view">—</pre>
<pre id="act-log">—</pre>
<p>Parameters: <code>?lang=en</code> · <code>?appearance=light</code> · <code>?rm=1</code> · <code>?w=320&amp;h=568</code> · <code>?state=P4</code>. No voice runtime exists: call audio follows G1.2's fixed script and nothing is recorded or sent. The Replay player is not built.</p>
</aside>`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const outDir = process.argv[2] || OUT_DEFAULT;
  mkdirSync(outDir, { recursive: true });
  const html = page().replace('<body dir="ltr">', '<body dir="ltr" class="live">');
  writeFileSync(join(outDir, 'index.html'), html);
  console.log('wrote', join(outDir, 'index.html'), Buffer.byteLength(html), 'bytes sha256', sha(Buffer.from(html)));
}
