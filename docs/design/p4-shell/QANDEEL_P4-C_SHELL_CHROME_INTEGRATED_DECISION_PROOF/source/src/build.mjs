// P4-C — builds the shell / placement / small-chrome decision proof: ONE self-contained, offline HTML file
// (prototype/index.html). Everything it needs is inside this source tree.
//
// Consumed, never redrawn:
//   - the P2 family, byte-exact (sig.mjs, utility.mjs + vendor/utility, machines.mjs) — the navigation glyphs in Living
//     Brass, `depth`, `replay`, the call glyphs; utility `settings`, `chevron`, `close`;
//   - P3's Open Ledger (p3glyphs.mjs, byte-exact) — the Activity entry;
//   - the canonical Q, read verbatim from the brand master (qmark.mjs);
//   - the frozen token tree through tokens.mjs (it refuses to emit if a frozen literal disagrees);
//   - Estedad v8.5 (the typography foundation), inlined;
//   - the G1.1 / P3-A shell geometry (status 47 pt, upper chrome 48 pt, navigation 56 pt + home 34 pt, line 64 pt).
// The Analysis is G3.2's own reviewed prototype (prototype/g3.2/index.html, byte-exact), loaded unchanged in a frame. P4-C
// lays over it only what a candidate under study needs: the switcher form in the rail's own box, and «سياق الكلام».
//
// What is new is only candidate PLACEMENT and FORM, built from the one Surface tone, E1R's state channels and existing
// glyphs. No new colour, token, glyph, Surface role or copy.
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
import { qSvg, Q, Q_BY_EYE } from './qmark.mjs';
import { COPY, THREAD, SHARED_THREAD, FEED } from './content.mjs';
import { DECISIONS, DIRECTIONS, DEFAULTS, Q_POLICY, DEFECTS, LABEL_INTEGRATED, LABEL_CANDIDATE } from './candidates.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SOURCE = resolve(HERE, '..');
export const OUT_DEFAULT = resolve(SOURCE, '..', 'prototype');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const FONT = readFileSync(join(SOURCE, 'vendor', 'fonts', 'Estedad-wght-v8.5.woff2')).toString('base64');
const APP = readFileSync(join(HERE, 'app.js'), 'utf8');
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };
const rgba = (hex, a) => `rgba(${rgb(hex)},${a})`;

export const PALETTES = {};
function vars(appearance, contrast = 'standard') {
  const p = palette(appearance, { contrast });
  const c = p.colors, n = p.numbers;
  PALETTES[`${appearance}-${contrast}`] = { ...c, pressedPresence: n.pressedPresence, restWeight: n.restWeight, selectedWeight: n.selectedWeight, markerThickness: n.markerThickness };
  return `--world:${c.world};--world-rgb:${rgb(c.world)};--surface:${c.surface};--primary:${c.primary};--secondary:${c.secondary};` +
    `--tertiary:${c.tertiary};--brass:${c.brass};--mark:${c.mark};--rest:${c.restInk};--sel-ink:${c.selectedInk};--marker:${c.selectedMarker};` +
    `--focus:${c.focusIndicator};--focus-c:${c.focusCompanion};--press:${rgba(c.pressedInk, n.pressedPresence)};` +
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
#phone{--W:390px;--H:844px;--top:47px;--hdr:48px;--prow:0px;--rail:56px;--home:34px;--comp:64px;--mark-d:6px;--ground:var(--world);
  position:relative;width:var(--W);height:var(--H);overflow:hidden;background:var(--world);color:var(--primary);isolation:isolate}
#phone[data-contrast="more"]{--mark-d:7px}
#phone[data-textsize="large"]{font-size:118%}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent;text-align:inherit}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
#phone [hidden]{display:none !important}
/* the frozen reading ramp (P3-A), line-heights ≥ 1.6 for Arabic (designing-arabic-frontends §2) */
.r-title{font-size:26px;line-height:1.6538;font-weight:600}
.r-head{font-size:20px;line-height:1.6;font-weight:600}
.r-body{font-size:17px;line-height:1.7647;font-weight:400}
.r-support{font-size:15px;line-height:1.6667;font-weight:400}
.r-action{font-size:14px;line-height:1.6429;font-weight:500}
.r-meta{font-size:12px;line-height:1.6667;font-weight:500}
#phone[data-textsize="large"] .r-body{font-size:20px}#phone[data-textsize="large"] .r-action,#phone[data-textsize="large"] .hbtn .lb,#phone[data-textsize="large"] .it .lb{font-size:17px}
.num{font-variant-numeric:tabular-nums}
bdi{unicode-bidi:isolate}
.fprobe{position:fixed;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);top:0;left:0}
#phone[dir="rtl"] .mirror{transform:scaleX(-1)}
button:focus{outline:0}
/* E1R FOCUS: the detached perimeter with its world-colour companion (as G3.2 / P2-A / P3-A draw it). */
button:focus-visible,[tabindex]:focus-visible{outline:2px solid transparent;outline-offset:var(--focus-off);box-shadow:0 0 0 var(--focus-off) var(--focus-c),0 0 0 calc(var(--focus-off) + var(--focus-w)) var(--focus),0 0 0 calc(var(--focus-off) + var(--focus-w) + var(--focus-cw)) var(--focus-c)}
h1:focus-visible{box-shadow:none !important}
/* E1R PRESSED: the ground takes the wash, UNDER the content (P2-A F-P2-06). */
.pz{position:relative;isolation:isolate}
.pz.down::before{content:"";position:absolute;inset:0;border-radius:inherit;background:var(--press);z-index:-1}

/* ------------------------------------------------------------------ system chrome (not Product) */
.status{position:absolute;top:0;inset-inline:0;height:47px;display:flex;align-items:center;justify-content:space-between;padding:4px 28px 0;color:var(--primary);z-index:30;pointer-events:none}
.status .clock{font:600 16px/1 Estedad;direction:ltr}
.status .sys{display:flex;gap:6px;align-items:center;direction:ltr}
.homebar{position:absolute;bottom:8px;left:50%;width:134px;height:5px;border-radius:3px;background:var(--primary);transform:translateX(-50%);z-index:30;pointer-events:none}

/* ------------------------------------------------------------- the upper chrome (G1.1; P3 §3; P4-C candidates) */
.hdr{position:absolute;top:var(--top);inset-inline:0;height:var(--hdr);display:flex;align-items:center;padding:0 10px;gap:2px;z-index:12}
.hbtn{position:relative;display:flex;align-items:center;gap:6px;min-height:44px;padding:0 12px;border-radius:12px;color:var(--rest);white-space:nowrap;flex:none}
.hbtn .lb{font-size:14px;line-height:1.6429;font-weight:var(--w-rest)}
.ibtn{position:relative;flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest)}
.push-end{margin-inline-start:auto}
/* THE ACTIVITY ENTRY — P3 §3, unchanged: the START edge, icon-only, rest ink in every state, never Brass. */
#act-entry{color:var(--rest)}
.amark{position:absolute;top:calc(11px - var(--mark-d) / 2 + 1px);inset-inline-end:calc(11px - var(--mark-d) / 2 + 1px);width:var(--mark-d);height:var(--mark-d);border-radius:50%;
  background:var(--primary);box-shadow:0 0 0 2px var(--ground);pointer-events:none}
/* S-A: the Settings entry, the second member of the START utility group — P2 curated utility glyph, neutral rest ink. */
.set-entry{color:var(--rest)}
/* THE CANONICAL Q in chrome (Q-B / Q-C): qandeel.identity.mark, centred, decorative, never a control, never a state. */
.qslot{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);line-height:0;color:var(--mark);pointer-events:none}
/* THE PERSONAL ROW (U-A, S-B): Personal QANDEEL's own row directly under the upper chrome, on the page ground (no card,
   no Surface — it is the chrome's second line, APPARATUS by position, not a panel). Shown on Personal QANDEEL only. */
.prow{position:absolute;top:calc(var(--top) + var(--hdr));inset-inline:0;height:var(--prow);display:flex;align-items:center;padding:0 10px;gap:2px;z-index:11}
.uentry{color:var(--primary)}
.uentry .lb{font-weight:500}
.uentry .chev{color:var(--tertiary);line-height:0;margin-inline-start:-2px}
/* U-B: the same words as a chrome action beside the door. */
.ub{color:var(--rest)}

/* --------------------------------------------------------------------- THE GLOBAL SWITCHER (DQ-04A) */
/* Frozen by P2 §5, whatever the form: glyph ABOVE the word; the family in qandeel.navigation.machinery at EVERY state;
   SELECTED = E1R marker + word weight; three destinations. Only container, depth and marker GEOMETRY vary. */
.rail{position:absolute;bottom:0;height:calc(var(--rail) + var(--home));inset-inline:0;z-index:20}
.rail .items{position:absolute;top:0;inset-inline:0;height:var(--rail);display:flex}
.rail .it{position:relative;flex:1;min-width:0;height:var(--rail);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 6px}
.rail .ic{display:block;height:24px;color:var(--brass);line-height:0}
.rail .lb{position:relative;font-size:14px;line-height:1.6429;font-weight:var(--w-rest);color:var(--brass);white-space:nowrap}
.rail .it.sel .lb{font-weight:var(--w-sel)}
/* SW-1 Plate · crown rule */
.rail[data-form="plate"]{background:var(--surface)}
.rail[data-form="plate"] .it.sel::after{content:"";position:absolute;top:0;inset-inline:22%;height:var(--marker-h);background:var(--marker)}
/* SW-2 Ground · word rule */
.rail[data-form="ground"]{background:var(--world);box-shadow:inset 0 1px 0 var(--tertiary)}
.rail[data-form="ground"] .it.sel .lb::after{content:"";position:absolute;bottom:-1px;inset-inline:0;height:var(--marker-h);background:var(--marker)}
/* SW-3 Keyed seam */
.rail[data-form="seam"]{background:var(--surface);box-shadow:inset 0 1px 0 var(--tertiary)}
.rail[data-form="seam"] .it.sel::after{content:"";position:absolute;top:0;inset-inline:0;height:var(--marker-h);background:var(--marker)}
/* the Analysis: the candidate stands in G3.2's own rail box (measured), dark scope (G3 §C.1) */
#arail{position:absolute;z-index:3;overflow:visible}
#arail .rail{position:absolute;inset:0;height:auto}
#arail .homebar{bottom:8px}

/* ---------------------------------------------------------------------- Conversation host (G1.1 / G1.2; P3-A) */
.conv{position:absolute;top:calc(var(--top) + var(--hdr) + var(--prow));bottom:calc(var(--home) + var(--rail) + var(--comp));inset-inline:0;overflow:hidden;
  /* the conversation's own top fade (G3.2's conversation grammar): content leaving the top resolves into the ground instead of
     being sliced by the chrome or the Personal row — applied identically to every candidate and to the baseline */
  -webkit-mask-image:linear-gradient(to bottom,transparent 0,#000 22px);mask-image:linear-gradient(to bottom,transparent 0,#000 22px)}
.thread{position:absolute;inset-inline:0;bottom:0;display:flex;flex-direction:column;padding:10px 24px 24px}
.day{color:var(--tertiary);margin:14px 0 2px;text-align:center}
.t{position:relative;margin-top:16px;color:var(--primary)}
.t.q{align-self:flex-end;max-width:calc(100% - 48px)}
.t.q .qm{display:block;color:var(--mark);margin-bottom:6px}
.t.me{align-self:flex-start;margin-top:22px;margin-inline-start:-24px;max-width:calc(100% - 40px);background:var(--surface);padding-block:11px 12px;padding-inline:24px 18px;border-start-end-radius:18px;border-end-end-radius:18px}
.t .who{display:block;color:var(--secondary)}
.composer{position:absolute;bottom:calc(var(--home) + var(--rail));height:var(--comp);inset-inline:0;background:var(--surface);z-index:6}
.composer .write{position:absolute;top:10px;inset-inline-start:20px;inset-inline-end:118px;height:44px}
.composer .ph{position:absolute;inset-inline:0;top:2px;color:var(--tertiary)}
.composer .line{position:absolute;inset-inline:0;top:37px;height:1px;background:var(--tertiary)}
.cbtn{position:absolute;top:10px;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest)}
.slot-o{inset-inline-end:14px}.slot-i{inset-inline-end:66px}
.world-name{position:absolute;top:calc(var(--top) + var(--hdr));inset-inline:0;padding:0 24px;color:var(--primary)}

/* ---------------------------------------------------------------------------------- pushed pages (P3-A) */
.page{position:absolute;inset:0;background:var(--world);z-index:16;--ground:var(--world)}
.page .hdr h1{color:var(--primary);padding-inline:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.page .body{position:absolute;top:calc(var(--top) + var(--hdr));bottom:0;inset-inline:0;overflow:hidden;padding-bottom:calc(var(--home) + 16px)}
.filters{display:flex;gap:2px;overflow:hidden;padding:0 10px 2px;-webkit-mask-image:linear-gradient(to var(--end-dir),#000 calc(100% - 24px),transparent);mask-image:linear-gradient(to var(--end-dir),#000 calc(100% - 24px),transparent)}
#phone[dir="rtl"]{--end-dir:left}#phone[dir="ltr"]{--end-dir:right}
.fchip{position:relative;flex:none;min-height:44px;padding:0 12px;border-radius:12px;display:inline-flex;align-items:center;color:var(--rest);white-space:nowrap}
.fchip .lb{font-size:14px;line-height:1.6429;font-weight:var(--w-rest)}
.fchip.on{color:var(--sel-ink)}.fchip.on .lb{font-weight:var(--w-sel)}
.fchip.on::after{content:"";position:absolute;bottom:4px;inset-inline:12px;height:var(--marker-h);background:var(--marker)}
.sec{color:var(--tertiary);padding:18px 24px 4px}
.feed{list-style:none}
.row{position:relative;display:grid;grid-template-columns:28px 1fr;column-gap:12px;padding:10px 20px}
.row .gl{position:relative;grid-row:1 / span 2;color:var(--secondary);width:28px;height:28px;display:grid;place-items:center;margin-top:1px}
.row .gl .amark{top:1px;inset-inline-end:0}
.row .gl .amark.ring{background:transparent;box-shadow:inset 0 0 0 1.5px var(--primary),0 0 0 2px var(--ground)}
.row .ln1{display:flex;gap:8px;color:var(--secondary)}.row .ln1 .tm{color:var(--tertiary)}
.row .say{color:var(--primary);text-wrap:pretty;grid-column:2}
.set h2{color:var(--secondary);padding:22px 24px 6px}
.srow{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:8px 20px 8px 24px;color:var(--primary);text-align:start}
#phone[dir="rtl"] .srow{padding:8px 24px 8px 20px}
.srow .lb{flex:1;min-width:0}.srow .chev{color:var(--tertiary);flex:none;line-height:0}
.srow.here{font-weight:600}
.handoff{margin:24px 24px 0;padding:20px;border:1.5px dashed var(--tertiary);border-radius:18px;color:var(--secondary)}
.handoff .tag{display:block;font:600 10px/1.4 ui-monospace,Consolas,monospace;color:var(--tertiary);margin-bottom:8px;direction:ltr;text-align:start}

/* ------------------------------------------------------------------------- the Analysis (G3.2 in a frame) */
#g32host{position:absolute;inset:0;z-index:1}
#g32host iframe{display:block;width:100%;height:100%;border:0}
#aover{position:absolute;inset:0;z-index:2;pointer-events:none}
#aover > *{pointer-events:auto}
/* «سياق الكلام» (DQ-04B): a text action — the chrome's own action grammar, rest ink, 44 pt target. No panel, no value. */
.ctx{position:absolute;display:flex;align-items:center;min-height:44px;padding:0 12px;border-radius:12px;color:var(--rest);white-space:nowrap}
.ctx .lb{font-size:14px;line-height:1.6429;font-weight:var(--w-rest)}

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
  g.call24 = sigSvg('call'); g.mic24 = sigSvg('mic');
  g.ledger22 = p3Svg(ACTIVITY_ACCEPTED, { size: 22 });
  g.settings22 = utilSvg('settings', { size: 22 }); g.settings20 = utilSvg('settings', { size: 20 });
  g.back22 = utilSvg('back', { size: 22, cls: 'mirror' }); g.chev16 = utilSvg('chevron', { size: 16, cls: 'mirror' });
  g.more22 = utilSvg('overflow', { size: 22 });
  g.navShared20 = sigSvg('navShared', { size: 20 }); g.navMine20 = sigSvg('navMine', { size: 20 });
  g.q20 = qSvg({ height: 20, cls: 'qmark' }); g.q18 = qSvg({ height: 18, cls: 'qm' }); g.q8 = qSvg({ height: 8, cls: 'qmark' });
  g.qEye20 = qSvg({ height: 20, cls: 'qmark', paths: Q_BY_EYE });
  g.railArt = railArt(RAIL_RECOMMENDED).join('');
  return g;
}

export function page() {
  vars('dark'); vars('light'); vars('dark', 'increased'); vars('light', 'increased');   // fills PALETTES
  const data = {
    copy: JSON.parse(JSON.stringify(COPY)), thread: THREAD, sharedThread: SHARED_THREAD, feed: FEED, glyphs: glyphs(), palettes: PALETTES,
    decisions: DECISIONS, directions: DIRECTIONS, defaults: DEFAULTS, qPolicy: Q_POLICY, defects: DEFECTS, labels: { integrated: LABEL_INTEGRATED, candidate: LABEL_CANDIDATE },
    qPaths: Q.paths, qViewBox: Q.viewBox, endGlyphPx: END_GLYPH_PX,
  };
  return `<!doctype html>
<html lang="ar-EG"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>QANDEEL — P4-C shell / small-chrome decision proof</title>
<style>${css()}</style></head>
<body>
<div id="mount"></div>
<script>window.P4DATA=${JSON.stringify(data).replace(/</g, '\\u003c')};</script>
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
