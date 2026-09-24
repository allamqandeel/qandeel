// G2.3 — builds the interactive amendment proof: ONE self-contained Arabic HTML (no network needed). A narrow delta on
// the G2.2 prototype: the approved opening message in the cue (D1); QANDEEL's approved view + privacy message in the
// proposal, laid out for reading (D2, brief §7); the approved compact Return presentation (brief §4). Everything else is
// G2.2's, byte for byte in intent: the world, the bridge, the Matching process, the motion values and the D5 appearance.
//
// G2.2 — builds the interactive mini-proof: ONE self-contained Arabic HTML (no network needed).
// A delta on the G2.1 prototype (I-08B3.1-G2.1, READY FOR PRODUCT REVIEW), whose vendored bytes it reuses read-only:
//   - the canonical world bytes (base64), verified in the page against the pinned SHA-256 before use, then loaded
//     verbatim into an isolated frame and driven only through the G2.1 bridge (unchanged);
//   - Estedad (the E3 / G1 Product face) and the IBM Plex Sans Arabic faces the canonical world links;
//   - every colour, resolved from the vendored token tree (tokens.mjs, unchanged but for its path).
// What G2.2 changes (and nothing else): D2 compact Return/Orientation candidate · D3/M1–M7 the Matching process ·
// D5 the Analysis is dark-immersive under system Dark AND system Light (no Light repaint, no veil).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { palette } from './tokens.mjs';
import { COPY, THREAD, OPENER, DAYS, FIXTURE } from './content.mjs';
import { FUNC_GLYPHS, svg, qMarkSVG } from './glyphs.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const G21 = 'E:/QANDEEL/QANDEEL PROJECT/design-workshops/I-08B3.1-G2.1-ANALYSIS-SCREEN-COMPOSITION';
const VENDOR = join(G21, 'source', 'vendor');
export const PKG = 'E:/QANDEEL/QANDEEL PROJECT/design-workshops/I-08B3.1-G2.3-MATCHING-COPY-RETURN-AMENDMENT';
const OUT = join(PKG, 'prototype');
mkdirSync(OUT, { recursive: true });

export const WORLD_PIN = '4DFD9D27D752C3A445168C0CC7067D71DF4ADA84BC61B806D12C8BB3202BC413';
const worldBytes = readFileSync(join(VENDOR, 'canon', 'wf-living-constellation.html'));
const worldSha = createHash('sha256').update(worldBytes).digest('hex').toUpperCase();
if (worldSha !== WORLD_PIN) throw new Error(`REFUSING TO BUILD: canonical world is ${worldSha}, pinned ${WORLD_PIN}`);
const FONT = readFileSync(join(VENDOR, 'fonts', 'Estedad-wght-v8.5.woff2')).toString('base64');
const fman = JSON.parse(readFileSync(join(VENDOR, 'fonts', 'google', 'FONT_MANIFEST.json'), 'utf8'));
const worldFonts = fman.faces.filter((f) => f.family === 'IBM Plex Sans Arabic').map((f) => {
  const e = fman.entries[f.url]; const buf = readFileSync(join(VENDOR, 'fonts', 'google', e.file));
  if (createHash('sha256').update(buf).digest('hex') !== e.sha256) throw new Error('vendored face changed: ' + e.file);
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
    `--focus-cw:${n.focusCompanionThickness}px;--focus-off:${n.focusOffset}px;--marker-h:${n.markerThickness}px;--boundary:0 solid transparent;`;
}
/* The literals the shell's blended chrome needs in the page (D5): the rail, the status bar, the Replay control, the
   call line and the Replay menu blend from the system appearance to the Analysis's dark appearance and back. */
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
/* D5 — the Analysis surface is ONE dark immersive surface under either system appearance. Every element that exists
   only on the Analysis carries the dark scope; nothing of the world is repainted, veiled or re-tuned. */
#phone .dk{${vars('dark')}}
#phone{--W:390px;--H:844px;--top:47px;--hdr:48px;--rail:56px;--home:34px;--comp:64px;--tl:88px;--callH:0px;
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
/* Legibility falloffs are the WORLD material (#101010) thinning over the cosmos, not a Surface (G2.1, unchanged). */
#falloff-top{position:absolute;top:0;inset-inline:0;height:172px;z-index:2;pointer-events:none;
  background:linear-gradient(180deg,rgba(var(--world-rgb),.9) 0,rgba(var(--world-rgb),.66) 70px,rgba(var(--world-rgb),.28) 120px,rgba(var(--world-rgb),0) 172px)}
#falloff-bottom{position:absolute;bottom:0;inset-inline:0;z-index:2;pointer-events:none;height:calc(var(--home) + var(--rail) + var(--callH) + var(--tl) + 70px);
  background:linear-gradient(0deg,rgba(var(--world-rgb),.96) 0,rgba(var(--world-rgb),.93) calc(var(--home) + var(--rail) + var(--callH) + 30px),rgba(var(--world-rgb),.62) calc(var(--home) + var(--rail) + var(--callH) + var(--tl)),rgba(var(--world-rgb),0) 100%)}
#falloff-band{position:absolute;inset-inline:0;z-index:2;pointer-events:none;bottom:calc(var(--home) + var(--rail) + var(--callH));height:calc(var(--tl) + var(--band-on-h,0px) + 100px);
  background:linear-gradient(0deg,rgba(var(--world-rgb),.92) 0,rgba(var(--world-rgb),.92) calc(var(--tl) + var(--band-on-h,0px) + 12px),rgba(var(--world-rgb),0) 100%)}
#gesture{position:absolute;inset:0;z-index:3;touch-action:none;cursor:grab;outline:0}
#gesture:active{cursor:grabbing}
#phone:not([data-place="analysis"]) #gesture{display:none}
#gesture:focus-visible{box-shadow:inset 0 0 0 var(--focus-w) var(--focus)}

/* ------------------------------------------------------------------- the upper chrome (G1.1) --- */
/* The header layer passes the pointer through: only its visible buttons take a press. (Found by the G2.2 live check:
   the empty layer sat over the proposal's own back button and swallowed the tap — latent in G2.1 as well.) */
#hdr{position:absolute;top:var(--top);inset-inline:0;height:var(--hdr);z-index:8;pointer-events:none}
#hdr-conv,#hdr-world{position:absolute;inset:0;display:flex;align-items:center;padding:0 10px;padding-inline-end:58px}
.hbtn,#replay{pointer-events:auto}
.hbtn{position:relative;display:flex;align-items:center;gap:6px;min-height:44px;padding:0 12px;border-radius:12px;color:var(--rest)}
.hbtn .lb{font-size:14px;line-height:1.6429;font-weight:var(--w-rest)}
#door{margin-inline-start:auto}
#back,#prop-back{color:var(--primary)}
#replay{position:absolute;top:calc((var(--hdr) - 44px) / 2);inset-inline-end:10px;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest);z-index:1}
#phone[dir="rtl"] .mirror{transform:scaleX(-1)}

/* ---------------------------------------------- contextual orientation (T-08 words, quiet) --- */
#band{position:absolute;inset-inline:0;bottom:calc(var(--home) + var(--rail) + var(--callH) + var(--tl) - 6px);z-index:5;padding:0 20px 0;pointer-events:none}
#band p{padding-inline:4px;color:var(--primary);max-width:340px}
#band .o-live{color:var(--secondary)}
#band .acts{display:flex;flex-wrap:wrap;gap:0 2px;margin-top:4px;margin-inline-start:-6px}
.ret{position:relative;pointer-events:auto;min-height:44px;padding:0 10px;border-radius:12px;color:var(--rest);display:inline-flex;align-items:center}
.ret .lb{font-size:14px;line-height:1.6429;font-weight:var(--w-rest);white-space:nowrap}
/* G2.2 compact candidate (D2): one status paragraph, one return visible, the rest behind T-08's own group name. The
   trigger is text, like every return (T-08: no icon, arrow or chevron). Open, it lists the rest in T-08's order. */
#band .o-status span + span{margin-inline-start:.28em}
#band .ret.more-t .lb{color:var(--tertiary)}
#band .ret.more-t[aria-expanded="true"] .lb{color:var(--rest)}
button.down::before{content:"";position:absolute;inset:4px 0;border-radius:10px;background:var(--press)}
.hbtn.down::before,#replay.down::before,#cue.down::before{inset:0}

/* ---------------------------------------------------------------------- the Timeline (G2.1) --- */
#timeline{position:absolute;inset-inline:0;bottom:calc(var(--home) + var(--rail) + var(--callH));height:var(--tl);z-index:5;--act:0;pointer-events:none}
#tl-track{position:absolute;bottom:0;inset-inline-start:16px;inset-inline-end:56px;height:44px;overflow:hidden;touch-action:none;cursor:ew-resize;pointer-events:auto;outline:0;border-radius:10px}
#tl-track:focus-visible{box-shadow:0 0 0 var(--focus-off) var(--focus-c),0 0 0 calc(var(--focus-off) + var(--focus-w)) var(--focus)}
#tl-ticks{position:absolute;inset:0}
#tl-base{position:absolute;inset-inline-end:2px;bottom:21px;height:1px;background:var(--tertiary);opacity:calc(.28 + .14 * var(--act))}
#tl-ticks .tk{position:absolute;inset-inline-end:calc(8px + var(--i) * 16px);bottom:calc(22px - (6px + 6px * var(--act)) / 2);width:1px;height:calc(6px + 6px * var(--act));background:var(--tertiary);opacity:.85}
#tl-ticks .tk.cur{width:2px;height:14px;bottom:15px;background:var(--primary);opacity:1}
#tl-ticks .tk.pin{width:2px;height:20px;bottom:12px;background:var(--primary);opacity:1}
#tl-ticks .tk.pv{width:0;height:30px;bottom:7px;background:none;border-inline-start:1px dashed var(--primary);opacity:1}
#tl-num{position:absolute;bottom:40px;inset-inline-end:calc(56px + 8px + var(--i) * 16px - 12px);width:24px;text-align:center;color:var(--primary);unicode-bidi:isolate;opacity:var(--act)}
#tl-live{position:absolute;bottom:0;inset-inline-end:6px;min-width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest);pointer-events:auto}
#tl-live .dot{width:6px;height:6px;border-radius:50%;background:var(--primary)}
#tl-live.ret{height:88px;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-end;padding:0 4px 0}
#tl-live.ret .lb{font-size:14px;line-height:1.6429;font-weight:var(--w-rest);white-space:nowrap;padding:0 6px;margin-bottom:12px}
#tl-live.ret::after{content:"";display:block;width:7px;height:7px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--tertiary);margin:0 15px 18px}

/* ------------------------------------------------------ the lower line: FIELD (G1.2, unchanged) --- */
#composer{position:absolute;bottom:calc(var(--home) + var(--rail));height:var(--comp);inset-inline:0;background:var(--surface);z-index:6;will-change:transform}
.write{position:absolute;top:10px;inset-inline-start:20px;inset-inline-end:118px;height:44px}
#phone:not([data-call="none"]) .write{inset-inline-end:170px}
#input{position:absolute;inset-inline:0;top:2px;height:30px;width:100%;border:0;outline:0;background:none;color:var(--primary);font:400 17px/1.7647 Estedad;caret-color:var(--primary);text-align:start}
#input::placeholder{color:var(--tertiary);opacity:1}
.line{position:absolute;inset-inline:0;top:37px;height:1px;background:var(--tertiary)}
#trace{position:absolute;inset-inline-start:0;top:27px;width:100%;height:20px;overflow:visible;display:none}
#trace-path{stroke:var(--primary);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.vtop{position:absolute;top:1px;inset-inline:0;display:none;gap:12px;align-items:baseline;white-space:nowrap}
.vtop #call-state{color:var(--primary)}
.vtop #elapsed{color:var(--tertiary);direction:ltr}
#phone:not([data-call="none"]) #input,#phone:not([data-call="none"]) .line{display:none}
#phone:not([data-call="none"]) #trace{display:block}
#phone:not([data-call="none"]) .vtop{display:flex}
.cbtn{position:absolute;top:10px;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest)}
.slot-o{inset-inline-end:14px}.slot-i{inset-inline-end:66px}.slot-ii{inset-inline-end:118px}
.cbtn.m{display:none}
#phone[data-call="none"] .m-idle{display:grid}
#phone:not([data-call="none"]) .m-call{display:grid}
#phone[data-call="connecting"] #route{display:none}
#mute[aria-pressed="true"] .g-mic,#mute:not([aria-pressed="true"]) .g-muted{display:none}
#route[aria-pressed="true"] .g-off,#route:not([aria-pressed="true"]) .g-on{display:none}
#end-call{color:var(--primary)}
#end-call::after{content:"";position:absolute;inset:3px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--primary)}

/* --------------------------------------------------------------- the rail (G1.1, unchanged) --- */
#rail{position:absolute;bottom:0;height:calc(var(--rail) + var(--home));inset-inline:0;background:var(--surface);z-index:9}
#rail .items{position:absolute;top:0;inset-inline:0;height:var(--rail);display:flex}
#rail .it{position:relative;flex:1;min-width:0;height:var(--rail);display:flex;align-items:center;justify-content:center;padding:0 6px}
#rail .lb{font-size:14px;line-height:1.6429;font-weight:var(--w-rest);color:var(--brass);text-align:center}
#rail .it.sel .lb{font-weight:var(--w-sel)}
#marker{position:absolute;top:calc(var(--rail) - 12px);left:0;height:var(--marker-h);width:0;background:var(--marker);pointer-events:none}

/* --------------------------------------------------------- the Conversation (G1.1 / G1.2) ---- */
#conv{position:absolute;top:calc(var(--top) + var(--hdr));bottom:calc(var(--home) + var(--rail) + var(--comp));inset-inline:0;z-index:4;background:var(--world);will-change:transform,opacity}
#scroll{position:absolute;inset:0;overflow:hidden}
.fade{position:absolute;top:0;inset-inline:0;height:28px;background:linear-gradient(var(--world),rgba(var(--world-rgb),0));pointer-events:none;z-index:2}
.thread{position:absolute;inset-inline:0;bottom:0;display:flex;flex-direction:column;justify-content:flex-end;padding:14px 24px 26px}
.day{color:var(--tertiary);margin:34px 0 2px;text-align:center}
.day:first-child{margin-top:8px}
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

/* ------------------------------------------------------------ Matching: the attention cue --- */
/* One Product-level moment, outside the semantic world (G2.1 primary placement, unchanged): the completed QANDEEL Q
   (I-08B2.5 master geometry, satin, ordinary scale, never mirrored) and QANDEEL's line; under it, the one quiet act.
   No glow, no count, no candidate, no photo, no percentage. The same place carries the first accepter's later news. */
/* G2.3: the end inset is 12 (was 22) so the cue's text ends on the band's own 24-pt text margin (20 + 4): the approved
   message's first sentence then holds one line at 390 and balances into two on a narrower window. */
#cue{position:absolute;z-index:8;top:calc(var(--top) + var(--hdr) + 2px);inset-inline-start:10px;inset-inline-end:12px;display:flex;align-items:flex-start;gap:10px;min-height:44px;padding:6px 12px 4px;border-radius:12px;color:var(--primary)}
#cue .qm{color:var(--mark);flex:none;margin-top:6px}
#cue .cue-tx{display:block;min-width:0}
#cue .cue-line{display:block;color:var(--primary);text-wrap:balance}
/* G2.3 D1: the approved opening message — its first sentence (the news) and its second (the basis and the invitation)
   each start a line; one paragraph of text, two inks, no size change, nothing shrunk to fit. */
#cue .cue-s1{display:block;color:var(--primary);text-wrap:balance}
#cue .cue-s2{display:block;color:var(--secondary);text-wrap:balance;margin-top:3px}
#cue .cue-act{display:inline-block;color:var(--rest);margin-top:1px;min-height:23px}
#falloff-cue{position:absolute;top:0;inset-inline:0;height:calc(var(--top) + var(--hdr) + var(--cue-h,60px) + 84px);z-index:2;pointer-events:none;opacity:0;
  background:linear-gradient(180deg,rgba(var(--world-rgb),.9) 0,rgba(var(--world-rgb),.9) calc(var(--top) + var(--hdr) + var(--cue-h,60px) + 8px),rgba(var(--world-rgb),0) 100%)}

/* ------------------------------------------ Matching: the private proposal (its own place) --- */
#proposal,#shared{position:absolute;top:0;bottom:calc(var(--home) + var(--rail));inset-inline:0;z-index:7;background:var(--world);will-change:transform,opacity}
/* G2.3 (brief §7): three zones that never blur into one — QANDEEL's view (the reading voice, with its Q), the privacy
   assurance (a quieter statement with a run-in lead), and the human decision. They are read in that order: on a tall
   window the decision rests where the thumb is; on a short one the three scroll together, so the decision is reached
   only after the privacy message, never beside it. No size is reduced to make anything fit. */
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
.s-name h1{color:var(--primary)}
.s-name .ph{color:var(--tertiary)}
.s-thread{position:absolute;inset-inline:0;bottom:calc(var(--comp) + 18px);padding:0 24px;display:flex;flex-direction:column}
.s-thread .day{margin:0 0 4px}
.s-thread .t.q{align-self:flex-end}
.s-line{position:absolute;bottom:0;height:var(--comp);inset-inline:0;background:var(--surface)}
.s-line .write2{position:absolute;top:10px;inset-inline-start:20px;inset-inline-end:20px;height:44px}
.s-line .ph2{position:absolute;inset-inline:0;top:2px;color:var(--tertiary);font:400 17px/1.7647 Estedad}
.s-line .line{top:37px}

/* ------------------------------------------------------------- Replay entry (ASIDE, G1.1) --- */
#rmenu{position:absolute;top:calc(var(--top) + var(--hdr) - 2px);inset-inline-end:10px;width:244px;background:var(--surface);border-radius:14px;padding:6px 0;z-index:10;transform-origin:top left}
#rmenu .mi{position:relative;display:flex;align-items:center;width:100%;min-height:48px;padding:10px 18px;text-align:start;color:var(--primary)}
#rmenu .mi .lb{font-size:15px;line-height:1.6667}
#rmenu .mnote{padding:4px 18px 8px;color:var(--tertiary)}

button:focus{outline:0}
button:focus-visible,#input:focus-visible{outline:0;box-shadow:0 0 0 var(--focus-off) var(--focus-c),0 0 0 calc(var(--focus-off) + var(--focus-w)) var(--focus),0 0 0 calc(var(--focus-off) + var(--focus-w) + var(--focus-cw)) var(--focus-c)}

/* ------------------------------------------------------------------ review chrome (not Product) */
body.live{display:flex;gap:36px;align-items:flex-start;padding:28px;min-height:100vh}
body.live #phone{flex-shrink:0;border-radius:44px;box-shadow:0 0 0 10px #050505,0 0 0 11px #2a2a2a}
.review{position:static;width:440px;color:#cfcfcf;font:13px/1.55 system-ui,'Segoe UI',sans-serif}
.review h1{font-size:15px;margin:0 0 6px;color:#ececec}
.review h2{font-size:12.5px;margin:16px 0 6px;color:#e2e2e2;font-weight:600}
.review p{margin:0 0 8px;color:#9b9b9b}
.review .btns{display:flex;flex-wrap:wrap;gap:6px}
.review button{font:12px/1 system-ui,'Segoe UI',sans-serif;color:#dcdcdc;border:1px solid #444;border-radius:6px;padding:8px 10px;background:#181818}
.review button[aria-pressed="true"]{background:#d8d5ca;color:#101010;border-color:#d8d5ca}
.review pre{font:11px/1.5 ui-monospace,Consolas,monospace;color:#a8a8a8;white-space:pre-wrap;background:#121212;border:1px solid #2a2a2a;border-radius:6px;padding:8px;max-height:300px;overflow:auto}
.review code{font:11.5px ui-monospace,Consolas,monospace;color:#bdbdbd}
.review table.cs{border-collapse:collapse;width:100%}
.review table.cs td{border-bottom:1px solid #262626;padding:5px 8px 5px 0;vertical-align:top;color:#a9a9a9}
.review table.cs td.ar{font-family:Estedad,system-ui;direction:rtl;text-align:right;color:#dedbd2;font-size:13.5px;line-height:1.6}
.review .st{display:inline-block;font-size:10.5px;font-weight:600;padding:1px 6px;border-radius:4px;background:#2c2c3a;color:#c8c8f0;white-space:nowrap}
.review .st.po{background:#d8d5ca;color:#101010}
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
      return `<div class="t q opener">${qMarkSVG({ height: 22, cls: 'qm' })}${label}<p class="tx r-body" dir="${paragraphDir(text, L.dir)}">${openerHTML(lang, L.displayName.text)}</p></div>`;
    }
    return `<div class="t ${t.who}">${label}<p class="tx r-body" dir="${paragraphDir(t.text, L.dir)}">${esc(t.text)}</p></div>`;
  }).join('');
}
/** Copy with template functions turned into {tpl} so it survives JSON. */
function serial(v) {
  if (typeof v === 'function') return { tpl: v('{0}', '{1}') };
  if (Array.isArray(v)) return v.map(serial);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, serial(x)]));
  return v;
}

export function page() {
  const lang = 'ar', L = COPY[lang];
  const data = { lang, copy: serial(L), fixture: FIXTURE, bridge: BRIDGE, palettes: PALETTES, world: { sha256: WORLD_PIN, bytes: worldBytes.length, b64: worldBytes.toString('base64') }, worldFonts };
  const railItems = L.nav.items.map((n) => `<button class="it" data-world="${n.key}" type="button"><span class="lb">${esc(n.text)}</span></button>`).join('');
  // D2: the privacy message's first sentence is its run-in lead. The split is presentation only — asserted to rejoin
  // into the approved text exactly, or the build refuses.
  const pv = L.propPrivacy.text, cut = pv.indexOf('. '), pvLead = pv.slice(0, cut + 1), pvRest = pv.slice(cut + 2);
  if (cut < 1 || `${pvLead} ${pvRest}` !== pv) throw new Error('REFUSING TO BUILD: the privacy message does not rejoin exactly');
  return `<!doctype html>
<html lang="${L.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>QANDEEL — G2.3 Matching copy + Return amendment proof</title>
<style>${css()}</style></head>
<body dir="ltr">
<div id="phone" dir="${L.dir}" lang="${L.lang}" data-appearance="dark" data-place="analysis" data-call="none" data-mode="FOLLOW_LIVE" role="application" aria-label="${esc(L.product.text)}">
<span class="fprobe" aria-hidden="true"><span style="font-weight:400">ا</span><span style="font-weight:500">ا</span><span style="font-weight:600">ا</span></span>
<div id="world-layer" class="dk"><div id="stage-clip"><div id="stage"><iframe id="world-frame" title="${esc(L.analysisRegion.text)}" tabindex="-1" aria-hidden="true"></iframe></div></div></div>
<div id="falloff-top" class="dk"></div><div id="falloff-cue" class="dk"></div><div id="falloff-band" class="dk"></div><div id="falloff-bottom" class="dk"></div>
<section id="gesture" class="dk" tabindex="0" role="application" aria-roledescription="العالم" aria-label="${esc(L.analysisRegion.text)}" aria-describedby="world-hint"><span class="sr" id="world-hint">${esc(L.worldRegionHint.text)}</span></section>
<section id="conv" aria-label="${esc(L.back.text)}"><div id="scroll"><div class="thread">${threadHTML(lang)}</div></div><div class="fade"></div></section>
${statusBar()}
<div id="hdr">
  <div id="hdr-conv"><button id="door" class="hbtn" type="button">${svg(FUNC_GLYPHS.depth, { size: 22 })}<span class="lb">${esc(L.door.text)}</span></button></div>
  <div id="hdr-world" class="dk"><button id="back" class="hbtn" type="button" aria-label="${esc(L.backName.text)}">${svg(FUNC_GLYPHS.back, { cls: 'mirror', size: 22 })}<span class="lb">${esc(L.back.text)}</span></button></div>
  <button id="replay" type="button" aria-label="${esc(L.replay.text)}" aria-haspopup="menu" aria-expanded="false" aria-controls="rmenu">${svg(FUNC_GLYPHS.replay, { size: 22 })}</button>
</div>
<button id="cue" class="dk" type="button" hidden>${qMarkSVG({ height: 16, cls: 'qm' })}<span class="cue-tx"><span class="cue-line r-support" id="cue-line"></span><span class="cue-act r-action" id="cue-act"></span></span></button>
<div id="band" class="dk" role="region" aria-label="${esc(L.chromeLabel.text)}"><div id="band-in"></div></div>
<div id="timeline" class="dk">
  <div id="tl-track" tabindex="0" role="slider" aria-label="${esc(L.timelineLabel.text)}" aria-describedby="tl-hint"><span class="sr" id="tl-hint">${esc(L.timelineHint.text)}</span><div id="tl-base"></div><div id="tl-ticks"></div></div>
  <span id="tl-num" class="r-meta num" aria-hidden="true"></span>
  <button id="tl-live" type="button"></button><span class="sr" id="hint-live">${esc(L.returns.RETURN_LIVE_HEAD.hint.text)}</span>
</div>
<div id="composer">
  <label class="sr" for="input">${esc(L.composerLabel.text)}</label>
  <div class="write">
    <input id="input" type="text" dir="auto" autocomplete="off" placeholder="${esc(L.composerPlaceholder.text)}">
    <div class="line"></div>
    <svg id="trace" viewBox="0 0 10 20" preserveAspectRatio="none" aria-hidden="true"><path id="trace-path" d="M0 10 H10"/></svg>
    <div class="vtop"><span id="call-state" class="r-action"></span><span id="elapsed" class="r-meta num">0:00</span></div>
  </div>
  <button id="call" class="cbtn m m-idle slot-i" type="button" aria-label="${esc(L.call.text)}">${svg(FUNC_GLYPHS.call)}</button>
  <button id="mic" class="cbtn m m-idle slot-o" type="button" aria-label="${esc(L.voiceNote.text)}">${svg(FUNC_GLYPHS.mic)}</button>
  <button id="route" class="cbtn m m-call slot-ii" type="button" aria-label="${esc(L.route.text)}" aria-pressed="true">${svg(FUNC_GLYPHS.routeOn, { cls: 'g-on' })}${svg(FUNC_GLYPHS.route, { cls: 'g-off' })}</button>
  <button id="mute" class="cbtn m m-call slot-i" type="button" aria-label="${esc(L.mute.text)}" aria-pressed="false">${svg(FUNC_GLYPHS.mic, { cls: 'g-mic' })}${svg(FUNC_GLYPHS.muted, { cls: 'g-muted' })}</button>
  <button id="end-call" class="cbtn m m-call slot-o" type="button" aria-label="${esc(L.endCall.text)}">${svg(FUNC_GLYPHS.endCall)}</button>
</div>
<section id="proposal" aria-label="${esc(L.proposalRegion.text)}">
  <div class="p-hdr"><button id="prop-back" class="hbtn" type="button">${svg(FUNC_GLYPHS.back, { cls: 'mirror', size: 22 })}<span class="lb">${esc(L.proposalBack.text)}</span></button></div>
  <div class="p-scroll" id="prop-scroll"><div class="p-body">${qMarkSVG({ height: 22, cls: 'qm' })}<span class="sr">${esc(L.speakerQ.text)}: </span>
    <div id="prop-view"><p class="p-view r-body" id="prop-qview">${esc(L.propView.text)}</p><p class="p-privacy r-support" id="prop-privacy"><span class="lead">${esc(pvLead)}</span> <span>${esc(pvRest)}</span></p></div>
    <p id="prop-gone" class="r-body" hidden>${esc(L.unavailable.text)}</p></div>
  <div class="p-foot" id="prop-foot">
    <p id="prop-next" class="r-support"></p>
    <div class="p-actions" id="prop-actions"><button id="proceed" class="pa r-action" type="button">${esc(L.proceed.text)}</button><button id="not-now" class="pa r-action" type="button">${esc(L.notNow.text)}</button></div>
    <p id="prop-ack" class="r-body" role="status" hidden>${esc(L.ack.text)}</p>
  </div></div>
</section>
<section id="shared" aria-label="${esc(L.sharedTitle.text)} — ${esc(L.phaseIntroduction.text)}">
  <div class="s-name"><h1 class="r-title">${esc(L.sharedTitle.text)}</h1><p class="ph r-meta">${esc(L.phaseIntroduction.text)}</p></div>
  <div class="s-thread"><p class="day r-meta" id="s-day"></p><div class="t q opener" id="s-welcome">${qMarkSVG({ height: 22, cls: 'qm' })}<span class="sr">${esc(L.speakerQ.text)}: </span><p class="tx r-body">${esc(L.welcome.text)}</p></div></div>
  <div class="s-line"><div class="write2"><span class="ph2">${esc(L.composerPlaceholder.text)}</span><div class="line"></div></div></div>
</section>
<nav id="rail" aria-label="${esc(L.nav.label.text)}"><div class="items">${railItems}</div><div id="marker"></div></nav>
<div id="rmenu" role="menu" aria-label="${esc(L.replay.text)}" hidden><button class="mi" role="menuitem" type="button"><span class="lb">${esc(L.replayFull.text)}</span></button><button class="mi" role="menuitem" type="button"><span class="lb">${esc(L.replayPart.text)}</span></button><p class="mnote r-meta" id="rmenu-note" hidden>${esc(L.replayCallNote.text)}</p></div>
<div class="homebar" id="homebar"></div>
<p id="call-a11y" class="sr" role="status" aria-live="polite"></p>
</div>
${reviewPanel()}
<script>window.__G21DATA=${JSON.stringify(data)};</script>
<script>
(function(){var p=new URLSearchParams(location.search),ph=document.getElementById('phone');
 if(p.get('capture')==='1'){document.body.classList.remove('live');var r=document.querySelector('.review');if(r)r.remove();}
 if(p.get('w'))ph.style.setProperty('--W',p.get('w')+'px');
 if(p.get('h'))ph.style.setProperty('--H',p.get('h')+'px');
 /* D5: the system appearance decides the SHELL; the Analysis is dark either way. ?appearance= overrides for review. */
 var sys=function(){return window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'};
 ph.setAttribute('data-appearance',p.get('appearance')||sys());ph.setAttribute('data-appearance-source',p.get('appearance')?'param':'system');
})();
</script>
<script>${APP}</script>
</body></html>`;
}

function reviewPanel() {
  const b = (s, label) => `<button type="button" data-state="${s}">${label}</button>`;
  const a = (s, label) => `<button type="button" data-sim="${s}">${label}</button>`;
  const t = (group, v, label) => `<button type="button" data-toggle="${group}" data-v="${v}" aria-pressed="false">${label}</button>`;
  const L = COPY.ar;
  const cs = (part, keys) => `<tr><td>${part}</td><td class="ar">${keys.map((k) => `«${esc(L[k].text)}»`).join(' · ')}</td><td><span class="st${L[keys[0]].status.startsWith('PO') ? ' po' : ''}">${esc(L[keys[0]].status)}</span></td></tr>`;
  return `<aside class="review">
<h1>QANDEEL · I-08B3.1-G2.3 — Matching copy + Return presentation amendment proof</h1>
<p>Review chrome, not Product. A narrow delta on the G2.2 prototype: the two approved Matching messages, and the approved compact Return presentation. The world inside the phone is the canonical Living Analysis source, loaded byte-for-byte: <code id="sha-state">verifying…</code></p>
<h2>Matching process (unchanged from G2.2)</h2>
<div class="btns">${b('M1_CUE', 'M1 cue')}${b('M2_PROPOSAL_A', 'M2 proposal · first accepter')}${b('M2_PROPOSAL_B', 'M2 proposal · second accepter')}${b('M3_ACK', 'M3 acknowledged')}${b('M3_AFTER', 'M3 · back in the Analysis')}${b('M4_UNAVAILABLE', 'M4 no longer available')}${b('M4_ENDED_A', 'M4 · first accepter told')}${b('M5_BORN', 'M5 second accepter · Shared World born')}${b('M6_ARRIVAL', 'M6 first accepter · arrival')}${b('M6_ENTERED', 'M6 · entered (already existed)')}</div>
<h2>Acts</h2>
<div class="btns">${a('showCue', 'A proposal awaits (cue)')}${a('openProposal', 'Open it')}${a('proceed', '«أكمّل»')}${a('notNow', '«لأ، شكراً»')}${a('becomeUnavailable', 'It becomes unavailable')}${a('matchArrives', 'The other side agrees (first accepter)')}${a('enterShared', 'Enter the Shared World')}${a('toggleMore', '«طرق العودة»')}${a('commitTurn', 'A turn commits')}${a('enterAnalysis', 'Conversation → Analysis')}${a('leaveAnalysis', 'Analysis → Conversation')}</div>
<h2>Perspective</h2>
<div class="btns">${t('who', 'A', 'First accepter (FIRST_RECIPIENT)')}${t('who', 'B', 'Second accepter (CANDIDATE)')}</div>
<h2>Return / Orientation — the approved compact presentation</h2>
<div class="btns">${b('P2', 'P2 · MID')}${b('P3', 'P3 · inspecting')}${b('P3_OPEN', `P3 · «${esc(L.revealReturns.text)}» open`)}${b('P4', 'P4 · PINNED(14)')}${b('P4_OPEN', `P4 · «${esc(L.revealReturns.text)}» open`)}</div>
<p style="margin-top:6px">One status line · one dominant return shown directly (the Live Head at the Timeline's live edge when PINNED, otherwise «${esc(L.returns.BACK_ONE_STEP.label.text)}») · the other valid returns under «${esc(L.revealReturns.text)}», in T-08's order and words · no dominant act → every act shown directly.</p>
<h2>System appearance (D5 — not reopened)</h2>
<div class="btns">${t('appearance', 'system', 'Follow the system')}${t('appearance', 'dark', 'System Dark')}${t('appearance', 'light', 'System Light')}${b('CONV', 'Conversation')}${b('P1', 'Analysis · FAR')}</div>
<h2>Matching copy status</h2>
<table class="cs">
${cs('Opening message (D1)', ['matchCue'])}
${cs('QANDEEL\'s view (D2)', ['propView'])}
${cs('Privacy (D2)', ['propPrivacy'])}
${cs('Cue action', ['matchCueAct'])}
${cs('What continuing does — first accepter', ['propNextA'])}
${cs('— second accepter', ['propNextB'])}
${cs('Decisions', ['proceed', 'notNow'])}
${cs('First-accepter acknowledgement', ['ack'])}
${cs('No longer available', ['unavailable', 'endedAct'])}
${cs('Later arrival', ['arrivalLine', 'arrivalAct'])}
${cs('Shared World phase · welcome', ['phaseIntroduction', 'welcome'])}
</table>
<h2>Truth</h2>
<pre id="truth-view">—</pre>
<pre id="act-log">—</pre>
<p>Parameters: <code>?state=M2_PROPOSAL_A</code> · <code>?appearance=light</code> · <code>?rm=1</code> reduced motion · <code>?w=320&amp;h=568</code>. The opening message and QANDEEL's view + privacy message are the Product Owner's approved copy, verbatim; every other Matching word is PROOF COPY — OPEN.</p>
</aside>`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const html = page().replace('<body dir="ltr">', '<body dir="ltr" class="live">');
  writeFileSync(join(OUT, 'index.html'), html);
  console.log('wrote index.html', html.length, 'bytes');
}
