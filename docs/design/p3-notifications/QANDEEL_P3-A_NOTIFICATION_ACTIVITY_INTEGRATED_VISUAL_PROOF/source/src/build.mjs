// P3-A — builds the integrated Notification + Activity proof: ONE self-contained, offline HTML file
// (prototype/index.html). Everything it needs is inside this source tree.
//
// What is consumed, never redrawn:
//   - the P2 family, byte-exact (src/sig.mjs, src/utility.mjs + vendor/utility, src/machines.mjs) — navigation glyphs in
//     Living Brass, `depth` / `replay` / the call family and Call Rail A with End Call at 27 px;
//   - the frozen token tree through src/tokens.mjs (it refuses to emit if a frozen literal disagrees);
//   - Estedad v8.5 (the typography foundation), inlined;
//   - the G1.1 / G3.2 shell geometry (status 47 pt, upper chrome 48 pt, navigation 56 pt + home 34 pt, line 64 pt).
// The Analysis is G3.2's own reviewed prototype (prototype/g3.2/index.html, byte-exact, vendored by tools/p3vendor.mjs),
// loaded unchanged in a frame; this page adds nothing to its chrome and draws only a strip above its chrome row.
// What is new (and only this): p3glyphs.mjs (the Activity entry, the Introductions source mark), the Attention Mark,
// the Attention Strip, Activity, the Notifications & Activity settings and the permission education — all built from the
// one Surface tone, E1R's state channels and the canon's text-button actions.
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
import { COPY } from './content.mjs';
import * as FX from './fixtures.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SOURCE = resolve(HERE, '..');
export const OUT_DEFAULT = resolve(SOURCE, '..', 'prototype');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const FONT = readFileSync(join(SOURCE, 'vendor', 'fonts', 'Estedad-wght-v8.5.woff2')).toString('base64');
const APP = readFileSync(join(HERE, 'app.js'), 'utf8');
// The model is shipped INTO the page (exports stripped), so the prototype decides every surface with the same code the
// checks run — a planted defect in the model shows up in the pixels, not only in a table.
const MODEL = readFileSync(join(HERE, 'model.mjs'), 'utf8').replace(/^export /gm, '');
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };
const rgba = (hex, a) => `rgba(${rgb(hex)},${a})`;

export const PALETTES = {};
function vars(appearance, contrast = 'standard') {
  const p = palette(appearance, { contrast });
  const c = p.colors, n = p.numbers;
  PALETTES[`${appearance}-${contrast}`] = { ...c, pressedPresence: n.pressedPresence };
  return `--world:${c.world};--world-rgb:${rgb(c.world)};--surface:${c.surface};--primary:${c.primary};--secondary:${c.secondary};` +
    `--tertiary:${c.tertiary};--brass:${c.brass};--rest:${c.restInk};--sel-ink:${c.selectedInk};--marker:${c.selectedMarker};` +
    `--focus:${c.focusIndicator};--focus-c:${c.focusCompanion};--press:${rgba(c.pressedInk, n.pressedPresence)};--scrim:${rgba(c.scrim, p.alpha.scrim)};` +
    `--error:${c.error};--disabled:${c.disabled};--w-rest:${n.restWeight};--w-sel:${n.selectedWeight};--focus-w:${n.focusThickness}px;` +
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
#phone{--W:390px;--H:844px;--top:47px;--hdr:48px;--rail:56px;--home:34px;--comp:64px;--mark-d:6px;--ground:var(--world);
  position:relative;width:var(--W);height:var(--H);overflow:hidden;background:var(--world);color:var(--primary);isolation:isolate}
#phone[data-contrast="more"]{--mark-d:7px}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent;text-align:inherit}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#phone [hidden]{display:none !important}
.r-title{font-size:26px;line-height:1.6538;font-weight:600}
.r-head{font-size:20px;line-height:1.6;font-weight:600}
.r-body{font-size:17px;line-height:1.7647;font-weight:400}
.r-support{font-size:15px;line-height:1.6667;font-weight:400}
.r-action{font-size:14px;line-height:1.6429;font-weight:500}
.r-meta{font-size:12px;line-height:1.6667;font-weight:500}
.num{font-variant-numeric:tabular-nums}
bdi{unicode-bidi:isolate}
.fprobe{position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);top:0;left:0}
#phone[dir="rtl"] .mirror{transform:scaleX(-1)}
button:focus{outline:0}
/* E1R FOCUS: the detached perimeter with its world-colour companion (as G3.2 / P2-A draw it). */
button:focus-visible,[tabindex]:focus-visible{outline:0;box-shadow:0 0 0 var(--focus-off) var(--focus-c),0 0 0 calc(var(--focus-off) + var(--focus-w)) var(--focus),0 0 0 calc(var(--focus-off) + var(--focus-w) + var(--focus-cw)) var(--focus-c)}
/* Headings take programmatic focus for assistive technology after a place change; they are not controls, so no ring. */
h1:focus-visible,h2:focus-visible{box-shadow:none !important}
/* E1R PRESSED: the ground takes the wash, UNDER the content (P2-A F-P2-06). */
.pz{position:relative;isolation:isolate}
.pz.down::before{content:"";position:absolute;inset:0;border-radius:inherit;background:var(--press);z-index:-1}

/* ------------------------------------------------------------------ system chrome (not Product) */
.status{position:absolute;top:0;inset-inline:0;height:47px;display:flex;align-items:center;justify-content:space-between;padding:4px 28px 0;color:var(--primary);z-index:30;pointer-events:none}
.status .clock{font:600 16px/1 Estedad;direction:ltr}
.status .sys{display:flex;gap:6px;align-items:center;direction:ltr}
.homebar{position:absolute;bottom:8px;left:50%;width:134px;height:5px;border-radius:3px;background:var(--primary);transform:translateX(-50%);z-index:30;pointer-events:none}

/* ------------------------------------------------------------- the upper chrome (G1.1; P3-S) */
.hdr{position:absolute;top:var(--top);inset-inline:0;height:var(--hdr);display:flex;align-items:center;padding:0 10px;gap:2px;z-index:12}
.hbtn{position:relative;display:flex;align-items:center;gap:6px;min-height:44px;padding:0 12px;border-radius:12px;color:var(--rest)}
.hbtn .lb{font-size:14px;line-height:1.6429;font-weight:var(--w-rest)}
.ibtn{position:relative;flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest)}
.push-end{margin-inline-start:auto}
/* THE ACTIVITY ENTRY — the global upper chrome's START edge, on every non-Analysis world surface. Neutral rest ink, in
   every state: it is not the navigation family, so it is never Living Brass (C3 §2A/§2C; task §7). */
#act-entry{color:var(--rest)}
/* THE ATTENTION MARK — presence, not a number: a neutral solid dot at the glyph's upper END corner, knocked out of
   the ground it sits on so it reads as attached, not as a second control. Never Brass, never error ink, never a count. */
.amark{position:absolute;top:calc(11px - var(--mark-d) / 2 + 1px);inset-inline-end:calc(11px - var(--mark-d) / 2 + 1px);width:var(--mark-d);height:var(--mark-d);border-radius:50%;
  background:var(--primary);box-shadow:0 0 0 2px var(--ground);pointer-events:none}
.amark.ring{background:transparent;box-shadow:inset 0 0 0 1.5px var(--primary),0 0 0 2px var(--ground)}

/* --------------------------------------------------------------------------- the navigation (G1.1 / P2) */
#rail{position:absolute;bottom:0;height:calc(var(--rail) + var(--home));inset-inline:0;background:var(--surface);z-index:20}
#rail .items{position:absolute;top:0;inset-inline:0;height:var(--rail);display:flex}
#rail .it{position:relative;flex:1;min-width:0;height:var(--rail);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 6px}
#rail .ic{display:block;height:24px;color:var(--brass);line-height:0}
#rail .lb{font-size:14px;line-height:1.6429;font-weight:var(--w-rest);color:var(--brass);white-space:nowrap}
#rail .it.sel .lb{font-weight:var(--w-sel)}
#rail .it.sel::after{content:"";position:absolute;top:0;inset-inline:22%;height:var(--marker-h);background:var(--marker)}

/* ---------------------------------------------------------------------- Conversation host (G1.1 / G1.2) */
.conv{position:absolute;top:calc(var(--top) + var(--hdr));bottom:calc(var(--home) + var(--rail) + var(--comp));inset-inline:0;overflow:hidden}
.thread{position:absolute;inset-inline:0;bottom:0;display:flex;flex-direction:column;padding:10px 24px 24px}
.day{color:var(--tertiary);margin:14px 0 2px;text-align:center}
.t{position:relative;margin-top:16px;color:var(--primary)}
.t.q{align-self:flex-end;max-width:calc(100% - 48px)}
.t.me{align-self:flex-start;margin-top:22px;margin-inline-start:-24px;max-width:calc(100% - 40px);background:var(--surface);padding-block:11px 12px;padding-inline:24px 18px;border-start-end-radius:18px;border-end-end-radius:18px}
.t .who{display:block;color:var(--secondary)}
.t.new{animation:none}
.composer{position:absolute;bottom:calc(var(--home) + var(--rail));height:var(--comp);inset-inline:0;background:var(--surface);z-index:6}
.composer .write{position:absolute;top:10px;inset-inline-start:20px;inset-inline-end:118px;height:44px}
.composer .ph{position:absolute;inset-inline:0;top:2px;color:var(--tertiary)}
.composer .line{position:absolute;inset-inline:0;top:37px;height:1px;background:var(--tertiary)}
.cbtn{position:absolute;top:10px;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest)}
.slot-o{inset-inline-end:14px}.slot-i{inset-inline-end:66px}
/* Live Call — Call Rail A with End Call at 27 px, exactly as P2 froze it (machines.mjs); nothing here changes it. */
.composer.call .write{inset-inline-end:184px}
.crail{position:absolute;inset:0;pointer-events:none;color:var(--tertiary)}
.cr-art{position:absolute;overflow:visible}
#phone[dir="rtl"] .cr-art{transform:scaleX(-1)}
.composer.call #end-call{inset-inline-end:12px;color:var(--primary)}
.composer.call #mute{inset-inline-end:78px}
.composer.call #route{inset-inline-end:122px}
.composer.call .elapsed{position:absolute;top:10px;inset-inline-start:0;color:var(--tertiary);unicode-bidi:isolate}
.world-name{position:absolute;top:calc(var(--top) + var(--hdr));inset-inline:0;padding:0 24px;color:var(--primary)}
.world-name .ph{color:var(--tertiary)}

/* ------------------------------------------------------------------------- THE ATTENTION STRIP (ASIDE) */
/* Anchored to the upper chrome, emerging from it; the one Surface tone; no scrim (an ASIDE: the world stays live).
   Short, readable, dismissible, Direct-Entry capable. No countdown, no pulse, no bounce. */
.strip{position:absolute;top:calc(var(--top) + var(--hdr) - 2px);inset-inline:10px;z-index:14;display:flex;align-items:stretch;background:var(--surface);border-radius:14px;min-height:60px;--ground:var(--surface)}
.strip .go{flex:1;min-width:0;display:flex;align-items:flex-start;gap:12px;padding:10px 4px 10px 14px;border-radius:14px;text-align:start;color:var(--primary)}
#phone[dir="rtl"] .strip .go{padding:10px 14px 10px 4px}
.strip .src{flex:none;color:var(--secondary);margin-top:3px;line-height:0}
.strip .tx{display:block;min-width:0}
.strip .meta{display:block;color:var(--secondary)}
.strip .say{display:block;color:var(--primary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.strip .x{flex:none;align-self:center;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest);margin-inline-end:4px}
/* THE CALL-SAFE STRIP (refinement §8): the same ASIDE, without Direct Entry — its body is text, its one act is dismiss. */
.strip .vis{display:contents}
.strip.callsafe .go{cursor:default}
/* In the Analysis (G3's own page, in a frame under P3): the strip lives in the upper chrome row only, beside «المحادثة»,
   over the Replay slot. Its box is MEASURED from G3's elements (app.js chromeSlot); it never reaches the world (y ≥ 95). */
#g32host{position:absolute;inset:0;z-index:1}
#g32host iframe{display:block;width:100%;height:100%;border:0}
.strip.inchrome{min-height:0;border-radius:12px;align-items:center}
.strip.inchrome .go{align-items:center;gap:8px;padding:0 2px 0 10px;border-radius:12px}
#phone[dir="rtl"] .strip.inchrome .go{padding:0 10px 0 2px}
.strip.inchrome .src{margin-top:0}
.strip.inchrome .say{color:var(--primary)}
.strip.inchrome .x{margin-inline-end:0}

/* ---------------------------------------------------------------------------------- pushed pages */
.page{position:absolute;inset:0;background:var(--world);z-index:16;--ground:var(--world)}
.page .hdr h1{color:var(--primary);padding-inline:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.page .body{position:absolute;top:calc(var(--top) + var(--hdr));bottom:0;inset-inline:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none;padding-bottom:calc(var(--home) + 16px)}
.page .body::-webkit-scrollbar{display:none}

/* ------------------------------------------------------------------------------------- ACTIVITY */
.filters{position:sticky;top:0;z-index:6;background:var(--world);display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;padding:0 10px 2px;
  -webkit-mask-image:linear-gradient(to var(--end-dir),#000 calc(100% - 24px),transparent);mask-image:linear-gradient(to var(--end-dir),#000 calc(100% - 24px),transparent)}
#phone[dir="rtl"]{--end-dir:left}#phone[dir="ltr"]{--end-dir:right}
.filters::-webkit-scrollbar{display:none}
.fchip{position:relative;flex:none;min-height:44px;padding:0 12px;border-radius:12px;display:inline-flex;align-items:center;gap:6px;color:var(--rest);white-space:nowrap}
.fchip .lb{font-size:14px;line-height:1.6429;font-weight:var(--w-rest)}
.fchip[aria-pressed="true"]{color:var(--sel-ink)}
.fchip[aria-pressed="true"] .lb{font-weight:var(--w-sel)}
.fchip[aria-pressed="true"]::after{content:"";position:absolute;bottom:4px;inset-inline:12px;height:var(--marker-h);background:var(--marker)}
.fchip .cnt{color:var(--tertiary);font-size:12px;font-weight:500}
.fchip .pres{width:5px;height:5px;border-radius:50%;background:var(--primary)}
.feed{list-style:none;padding:4px 0 0}
.sec{color:var(--tertiary);padding:18px 24px 4px}
.row{position:relative;display:grid;grid-template-columns:28px 1fr;column-gap:12px;padding:10px 20px 10px 20px}
.row .go{position:absolute;inset:0;border-radius:0;z-index:0}
.row > :not(.gl):not(.go){grid-column:2}
.row .gl{position:relative;grid-row:1 / span 3;color:var(--secondary);width:28px;height:28px;display:grid;place-items:center;margin-top:1px;pointer-events:none;z-index:1}
.row .gl .amark{top:1px;inset-inline-end:0}
.row .ln1{display:flex;gap:8px;align-items:baseline;color:var(--secondary);pointer-events:none;z-index:1;min-width:0}
.row .ln1 .src{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row .ln1 .tm{color:var(--tertiary);flex:none}
.row .ln1 .st{color:var(--tertiary);flex:none}
.row .say{color:var(--primary);pointer-events:none;z-index:1;text-wrap:pretty}
.row[data-att="opened"] .say{color:var(--secondary)}
.row[data-stale="1"] .say{color:var(--tertiary)}
.row .sec2{color:var(--tertiary);pointer-events:none;z-index:1}
.row .act{position:relative;z-index:2;justify-self:start;min-height:44px;margin:-6px -10px -10px;padding:0 10px;border-radius:12px;color:var(--primary)}
.row .act .lb{font-size:14px;line-height:1.6429;font-weight:var(--w-rest)}
.row .explain{grid-column:2;color:var(--secondary);margin-top:6px;z-index:2}
.row .explain .act{margin-top:0}

/* --------------------------------------------------------------------------------------- SETTINGS */
.set h2{color:var(--secondary);padding:22px 24px 6px}
.set .note{color:var(--tertiary);padding:4px 24px 0;max-width:380px}
.set .note.pro-opt{color:var(--secondary);padding-top:8px}
.srow{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:8px 20px 8px 24px;color:var(--primary);text-align:start}
#phone[dir="rtl"] .srow{padding:8px 24px 8px 20px}
.srow .lb{flex:1;min-width:0}
.srow .val{color:var(--secondary);flex:none}
.srow .chev{color:var(--tertiary);flex:none;line-height:0}
.srow.stmt{cursor:default;color:var(--secondary)}
.sw{flex:none;position:relative;width:40px;height:24px;border-radius:12px;box-shadow:inset 0 0 0 1.5px var(--tertiary)}
.sw::after{content:"";position:absolute;top:4px;inset-inline-start:4px;width:16px;height:16px;border-radius:50%;background:var(--tertiary)}
[aria-checked="true"] > .sw{background:var(--primary);box-shadow:none}
[aria-checked="true"] > .sw::after{inset-inline-start:20px;background:var(--world)}
.seg{display:flex;gap:2px;padding:0 14px}
.seg button{position:relative;flex:1;min-height:44px;border-radius:12px;color:var(--rest);text-align:center}
.seg button .lb{font-size:15px;line-height:1.6667;font-weight:var(--w-rest)}
.seg button[aria-checked="true"]{color:var(--sel-ink)}
.seg button[aria-checked="true"] .lb{font-weight:var(--w-sel)}
.seg button[aria-checked="true"]::after{content:"";position:absolute;bottom:4px;inset-inline:28%;height:var(--marker-h);background:var(--marker)}
.optrow{display:flex;flex-wrap:wrap;gap:2px;padding:0 14px}
.optrow button{position:relative;min-height:44px;padding:0 10px;border-radius:12px;color:var(--rest)}
.optrow button .lb{font-size:15px;line-height:1.6667}
.osoff{margin:8px 20px 0;padding:14px 16px;border-radius:14px;background:var(--surface);color:var(--primary)}
.groups .srow{min-height:56px}
.groups .srow.here{font-weight:600}

/* ------------------------------------------------------- PERMISSION EDUCATION (PASSAGE) + the platform boundary */
.scrim{position:absolute;inset:0;background:var(--scrim);z-index:40}
.sheet{position:absolute;inset-inline:0;bottom:0;z-index:41;background:var(--surface);border-start-start-radius:20px;border-start-end-radius:20px;padding:26px 24px calc(var(--home) + 14px);--ground:var(--surface)}
.sheet h2{color:var(--primary);outline:0;text-wrap:balance}
.sheet p{color:var(--secondary);margin-top:10px;text-wrap:pretty}
.sheet .acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:18px;margin-inline-start:-10px}
.sheet .acts button{position:relative;min-height:44px;padding:0 10px;border-radius:12px}
.sheet .acts .pri{color:var(--primary)}.sheet .acts .sec{color:var(--rest)}
.sheet .opt{display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:6px 0;text-align:start;color:var(--primary);position:relative;border-radius:12px}
.sheet .opt .rad{flex:none;width:20px;height:20px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--tertiary)}
.sheet .opt[aria-checked="true"] .rad{box-shadow:inset 0 0 0 6px var(--primary)}
.sheet .opt .h{display:block;color:var(--tertiary);font-size:12px;line-height:1.6667}
.osbox{position:absolute;inset-inline:34px;top:34%;z-index:42;border:1.5px dashed var(--tertiary);border-radius:18px;padding:22px 20px;text-align:center;color:var(--secondary)}
.osbox .tag{display:block;font:600 10px/1.4 ui-monospace,Consolas,monospace;letter-spacing:.06em;color:var(--tertiary);margin-bottom:10px;direction:ltr}
.osbox .h{display:block;color:var(--primary);font-size:17px;line-height:1.6;font-weight:600}
.toastline{position:absolute;inset-inline:24px;bottom:calc(var(--home) + var(--rail) + var(--comp) + 12px);color:var(--secondary);z-index:9}

/* ------------------------------------------------------------------ PROOF HARNESS (not Product) */
body.live{display:flex;gap:36px;align-items:flex-start;padding:28px;min-height:100vh}
body.live #phone{flex-shrink:0;border-radius:44px;box-shadow:0 0 0 10px #050505,0 0 0 11px #2a2a2a}
.harness{width:440px;color:#cfcfcf;font:13px/1.55 system-ui,'Segoe UI',sans-serif}
.harness .flag{display:inline-block;font:700 11px/1 system-ui,'Segoe UI',sans-serif;letter-spacing:.06em;color:#101010;background:#e0b650;border-radius:4px;padding:5px 8px;margin-bottom:10px}
.harness h1{font-size:15px;margin:0 0 6px;color:#ececec}
.harness h2{font-size:12.5px;margin:16px 0 6px;color:#e2e2e2;font-weight:600}
.harness a,.harness button{display:inline-block;font:12px/1 system-ui,'Segoe UI',sans-serif;color:#dcdcdc;border:1px solid #444;border-radius:6px;padding:7px 9px;margin:0 4px 6px 0;background:#181818;text-decoration:none;cursor:pointer}
.harness a.on{border-color:#e0b650;color:#fff}
.harness pre{font:11px/1.5 ui-monospace,Consolas,monospace;color:#a8a8a8;white-space:pre-wrap;background:#121212;border:1px solid #2a2a2a;border-radius:6px;padding:8px;max-height:300px;overflow:auto}
`;
}

/** Pre-rendered glyph strings: the runtime never draws; it places these. */
function glyphs() {
  const g = {};
  for (const n of ['navMine', 'navShared', 'navPublic']) { g[n + '24'] = sigSvg(n, { size: 24 }); g[n + '20'] = sigSvg(n, { size: 20 }); }
  g.depth22 = sigSvg('depth', { size: 22 }); g.replay22 = sigSvg('replay', { size: 22 });
  g.call24 = sigSvg('call'); g.mic24 = sigSvg('mic');
  g.muted24 = sigSvg('muted', { id: 'p3' }); g.route24 = sigSvg('routeOn'); g.end = sigSvg('endCall', { size: END_GLYPH_PX });
  // the Introductions row mark: Open Link (recommended), At the Door (comparison), and the WITHDRAWN two-arc drawing
  // (history; reachable only through planted defect D23, ?defect=oldintro)
  g.introLink20 = p3Svg('link', { size: 20 }); g.introDoor20 = p3Svg('door', { size: 20 }); g.introTwoArcs20 = p3Svg('introTwoArcs', { size: 20 });
  g.settings20 = utilSvg('settings', { size: 20 }); g.settings22 = utilSvg('settings', { size: 22 });
  g.close20 = utilSvg('close', { size: 20 }); g.back22 = utilSvg('back', { size: 22, cls: 'mirror' });
  g.chev16 = utilSvg('chevron', { size: 16, cls: 'mirror' });
  for (const v of ['ledger', 'bell']) g['act-' + v] = p3Svg(v, { size: 22 });
  g.railArt = railArt(RAIL_RECOMMENDED).join('');
  return g;
}

export function page() {
  vars('dark'); vars('light'); vars('dark', 'increased'); vars('light', 'increased');   // fills PALETTES
  const serialCopy = JSON.parse(JSON.stringify(COPY));
  const data = {
    copy: serialCopy, glyphs: glyphs(), palettes: PALETTES, activityAccepted: ACTIVITY_ACCEPTED, endGlyphPx: END_GLYPH_PX,
    fx: { CONTEXTS: FX.CONTEXTS, SOURCE_GLYPH: FX.SOURCE_GLYPH, NOW: FX.NOW, FEED: FX.FEED, FEED_SETTINGS: FX.FEED_SETTINGS, EV: FX.EV, SCENARIOS: FX.SCENARIOS },
  };
  return `<!doctype html>
<html lang="ar-EG"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>QANDEEL — P3-A Notification + Activity proof</title>
<style>${css()}</style></head>
<body>
<div id="mount"></div>
<script>window.P3DATA=${JSON.stringify(data).replace(/</g, '\\u003c')};</script>
<script>
${MODEL}
window.P3MODEL={decide,project,indicators,coalesce,coalesceKey,markSeen,markOpened,defaultSettings,DISCLOSURE_DEFAULTS,CEILINGS,QUIET_DEFAULT,at,clock,inQuiet};
</script>
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
