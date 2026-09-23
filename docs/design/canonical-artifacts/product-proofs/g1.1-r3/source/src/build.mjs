// G1.1-R3 — builds the self-contained interactive prototype (one HTML file, font and Analysis rasters
// inlined, no network) from the resolved token tree, the copy table and the glyphs.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { palette } from './tokens.mjs';
import { COPY, THREAD, NEW_THREAD, STRESS, VOICE_TURNS, SHARED_WORLDS, DISPLAY_NAME, OPENER, messagesCount } from './content.mjs';
import { FUNC_GLYPHS, svg, qMarkSVG, waveSVG } from './glyphs.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORK = join(HERE, '..');
const OUT = join(WORK, 'out', 'prototype');
mkdirSync(OUT, { recursive: true });

const FONT = readFileSync(join(WORK, 'vendor', 'Estedad-wght-v8.5.woff2')).toString('base64');
// The Analysis depth's imagery is the sealed F2 fixture world, reused unchanged. It is NOT the Living
// Analysis spectacle — G2 owns that (R3 §15).
const WORLD = {
  dark: readFileSync(join(WORK, 'out', 'world', 'world-dark.png')).toString('base64'),
  light: readFileSync(join(WORK, 'out', 'world', 'world-light.png')).toString('base64'),
};
const RUNTIME = readFileSync(join(HERE, 'runtime.js'), 'utf8');
// One paragraph-direction rule for fixture turns (here, in Node) and for sent turns (in the page).
const BIDI = readFileSync(join(HERE, 'bidi.js'), 'utf8');
export const paragraphDir = new Function(`${BIDI}\nreturn paragraphDir;`)();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

/** One CSS variable block per (appearance, contrast), every value resolved from the token tree. */
function vars(appearance, contrast) {
  const p = palette(appearance, { contrast });
  const c = p.colors, n = p.numbers;
  return `--world:${c.world};--surface:${c.surface};--functional:${c.functional};--primary:${c.primary};--secondary:${c.secondary};--tertiary:${c.tertiary};` +
    `--brass:${c.brass};--mark:${c.mark};--rest:${c.restInk};--sel-ink:${c.selectedInk};--marker:${c.selectedMarker};` +
    `--focus:${c.focusIndicator};--focus-c:${c.focusCompanion};--press:${rgba(c.pressedInk, n.pressedPresence)};` +
    `--scrim:${rgba(c.scrim, p.alpha.scrim)};--error:${c.error};--disabled:${c.disabled};` +
    `--w-rest:${n.restWeight};--w-sel:${n.selectedWeight};--focus-w:${n.focusThickness}px;--focus-cw:${n.focusCompanionThickness}px;` +
    `--focus-off:${n.focusOffset}px;--marker-h:${n.markerThickness}px;` +
    `--boundary:${contrast === 'increased' ? `1px solid ${c.tertiary}` : '0 solid transparent'};`;
}

/**
 * How the two speakers are told apart.
 *   r3 — the LOCKED form (R3 §3–4): the reader's words on the functional Surface in a partial slab attached
 *        to the reader's own edge — the START edge (RIGHT in Arabic, LEFT in English) — rounded only on the
 *        corners that face into the conversation, open toward the reader's edge. QANDEEL open on the World,
 *        on the opposite side.
 *   a1 — A1 as submitted (reader at the END edge), kept ONLY to render the superseded-placement comparison.
 */
export const SPEAKERS = ['r3', 'a1'];
function speakerCSS(v) {
  if (v === 'a1') return `
.t{margin-top:16px;color:var(--primary)}
.t.me{align-self:flex-end;margin-top:28px;margin-inline-end:-24px;max-width:calc(100% - 40px);
  background:var(--functional);padding-block:11px 12px;padding-inline:18px 24px;
  border-start-start-radius:18px;border-end-start-radius:18px;border:var(--boundary);border-inline-end:0}
.day + .t.me{margin-top:14px}
.t.me + .t.me{margin-top:6px}`;
  // ---- r3. The reader's slab bleeds through the start gutter to the screen edge (margin-inline-start:-24px):
  // it is a piece of the reader's side of the glass, not a capsule floating on the World. Its two inward
  // corners are rounded; its edge side has no radius and — under Increase Contrast — no border, because it
  // does not end there. It leaves QANDEEL a lane of at least 64 px on the opposite side. QANDEEL's turn is
  // not contained: it sits on the World, set to the END side by a 48 px start inset (so a QANDEEL line never
  // reaches the reader's column), and shrink-wraps when short, so a short reply sits visibly opposite.
  return `
.t{margin-top:16px;color:var(--primary)}
.t.q{align-self:flex-end;max-width:calc(100% - 48px)}
.t.me{align-self:flex-start;margin-top:28px;margin-inline-start:-24px;max-width:calc(100% - 40px);
  background:var(--functional);padding-block:11px 12px;padding-inline:24px 18px;
  border-start-end-radius:18px;border-end-end-radius:18px;border:var(--boundary);border-inline-start:0}
.day + .t.me{margin-top:14px}
.t.me + .t.me{margin-top:6px}`;
}

function css(speaker = 'r3') {
  return `
@font-face{font-family:Estedad;src:url(data:font/woff2;base64,${FONT}) format('woff2');font-weight:100 900;font-display:block}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#0a0a0a}
body{font-family:Estedad;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
/* Letter-spacing is never applied: Arabic is a connected script (designing-arabic-frontends §5). */
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

/* ----------------------------------------------------------- the type roles (I-08B3.0-E3) */
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

/* ----------------------------------------------------------- the upper chrome (R3 §9, §10) --- */
/* Two depth layers share one header. The depth route belongs to each layer; REPLAY does not — it is ONE
   control standing in ONE place at the END edge in both views, so it never moves when the depth changes.
   Its slot is reserved even while Replay is unavailable, so nothing shifts when it becomes available. */
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
/* Day and call markers belong to neither speaker, so they stand in the middle. */
.day{color:var(--tertiary);margin:34px 0 2px;text-align:center}
.day:first-child{margin-top:8px}
/* A turn is TWO direction contexts (designing-arabic-frontends §4). The .t container inherits the phone's
   direction, so which SIDE a speaker sits on never depends on the language of what they said (R3 §4); the
   .tx paragraph carries the turn's own direction (src/bidi.js). */
.t{position:relative;max-width:100%}
.t .tx{overflow-wrap:anywhere}
${speakerCSS(speaker)}
bdi{unicode-bidi:isolate}
/* The opener is QANDEEL's first turn of every new conversation; the Q stands once above it, on
   QANDEEL's side. It is never an avatar and never repeats. */
.t.opener .qm{display:block;color:var(--mark);margin-bottom:12px}
.t.opener{margin-top:10px}

/* A voice message is a turn like any other: same side, same material. The media row reads left-to-right
   in both scripts (a media timeline is not mirrored); the transcript under it is the committed text. */
.vn{display:flex;align-items:center;gap:8px;direction:ltr;margin-bottom:4px}
#phone[dir="rtl"] .vn{justify-content:flex-end}
.vn .play{width:44px;height:44px;margin:-6px -6px;display:grid;place-items:center;border-radius:12px;color:var(--primary);flex:none}
.vn .wave{color:var(--tertiary);flex:none}
.vn .dur{color:var(--tertiary)}
.t.voice .tx{color:var(--secondary)}

/* ---- Replay: choosing a part. Selection is a MODE of this conversation, not an editor: each turn is a
   whole unit that is in or out; chronology cannot be reordered (replay-runtime-v1 §5). The mark sits in the
   END gutter and is a shape (ring → filled dot) joined by one line — never colour or opacity alone. */
#picks{position:absolute;inset:0;pointer-events:none;display:none}
#phone[data-pick="1"] #picks{display:block}
#picks .pk{position:absolute;inset-inline-end:4px;width:14px;height:14px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--tertiary)}
#picks .pk.on{box-shadow:none;background:var(--marker)}
#picks .rng{position:absolute;inset-inline-end:calc(11px - var(--marker-h) / 2);width:var(--marker-h);background:var(--marker)}
#phone[data-pick="1"] .thread .t{cursor:pointer}

#world{position:absolute;inset:0;overflow:hidden;visibility:hidden;will-change:transform,opacity;transform-origin:50% 40%}
#world img{position:absolute;top:25px;left:0;width:390px;height:724px;display:block}

#dest-shared .title,#dest-public .title{padding:4px 24px 0;color:var(--primary)}
#dest-shared .note{padding:0 24px;color:var(--tertiary);margin-top:2px}
#dest-shared .none{padding:6px 24px 0;color:var(--secondary)}
.rows{margin-top:22px}
.row{position:relative;display:flex;align-items:center;gap:12px;width:100%;padding:12px 24px 13px;text-align:start}
.row .who{flex:1;color:var(--primary);font-weight:500}
.row .when{color:var(--tertiary)}
.row .fw{color:var(--rest)}
.boundary{margin:28px 24px 0;padding:18px;border:1px dashed #6b6b6b;border-radius:6px;color:#9a9a9a;font:500 12px/1.6 system-ui,'Segoe UI',sans-serif;direction:ltr;text-align:left}

/* --------------------------------------------- the lower interaction area (FIELD, R3 §5) --- */
/* One line holds all three ways of talking. Writing is the line itself; the two controls at its end are
   Voice Note and Live Call. The line is the SAME object in every mode: it carries the writing, then the
   voice note's level, then the call's level — so a mode change is visibly a change of the same place. */
#composer{position:absolute;top:calc(var(--H) - var(--home) - var(--rail) - var(--comp));height:var(--comp);inset-inline:0;background:var(--surface);z-index:3;border-top:var(--boundary);
  --v:0;will-change:transform}
.write{position:absolute;top:10px;inset-inline-start:20px;inset-inline-end:118px;height:44px}
#input{position:absolute;inset-inline:0;top:2px;height:calc(30px * var(--ts));width:100%;border:0;outline:0;background:none;color:var(--primary);
  font:400 calc(17px * var(--ts))/1.7647 Estedad;caret-color:var(--primary);opacity:calc(1 - var(--v));text-align:start}
#input::placeholder{color:var(--tertiary);opacity:1}
.line{position:absolute;inset-inline:0;top:calc(37px + 30px * (var(--ts) - 1));height:1px;background:var(--tertiary);opacity:calc(1 - var(--v))}
#trace{position:absolute;inset-inline-start:0;top:27px;width:100%;height:20px;overflow:visible;opacity:var(--v)}
#trace-path{stroke:var(--primary);stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}
#trace-old{stroke:var(--tertiary);stroke-width:1.5;fill:none;stroke-linecap:round;stroke-linejoin:round}
.vtop{position:absolute;top:1px;inset-inline-start:0;display:flex;gap:12px;align-items:baseline;opacity:var(--v);pointer-events:none}
.vtop .vl{color:var(--primary)}
.vtop #elapsed{color:var(--tertiary);direction:ltr}
.cbtn{position:absolute;top:10px;width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest)}
/* The outer slot (end:14) and the inner slot (end:66) keep an 8 px gap between 44 px targets. */
.slot-o{inset-inline-end:14px}.slot-i{inset-inline-end:66px}
.cbtn.m{display:none}
#phone[data-composer="idle"]:not([data-call="live"]) .m-idle{display:grid}
#phone[data-composer="idle"]:not([data-call="live"]) #composer.has-text #mic{display:none}
#phone[data-composer="idle"]:not([data-call="live"]) #composer:not(.has-text) #send{display:none}
#phone[data-composer="note"] .m-note{display:grid}
#phone[data-call="live"] .m-call{display:grid}
#send,#note-send{color:var(--primary)}
#mute[aria-pressed="true"] .g-mic,#mute:not([aria-pressed="true"]) .g-muted{display:none}
#end-call{color:var(--primary)}
#end-call::after{content:"";position:absolute;inset:3px;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--primary)}

/* ---- Replay part: the lower bar that replaces the line while a part is being chosen. */
#pickbar{position:absolute;top:calc(var(--H) - var(--home) - var(--rail) - var(--comp));height:var(--comp);inset-inline:0;background:var(--surface);z-index:3;border-top:var(--boundary);display:none;align-items:center;gap:6px;padding:0 10px 0 14px}
#phone[data-pick="1"] #pickbar{display:flex}
#phone[data-pick="1"] #composer{visibility:hidden}
#pickbar .cnt{flex:1;padding:0 10px;color:var(--primary)}
#pickbar .pb{min-height:44px;padding:0 14px;border-radius:12px;color:var(--rest)}
#pickbar #pick-go{color:var(--primary)}
#pickbar #pick-go[aria-disabled="true"]{color:var(--disabled)}

/* ---- Replay: the entry. An ASIDE (B0R §3.2): anchored to the Replay control that summoned it, the
   conversation keeps running beneath it, walking away is a complete outcome — so no scrim. */
#rmenu{display:none;position:absolute;top:calc(var(--top) + var(--hdr) - 2px);inset-inline-end:10px;width:232px;background:var(--surface);border-radius:14px;padding:6px 0;z-index:8;border:var(--boundary)}
#phone.rmenu-open #rmenu{display:block}
#rmenu .mi{position:relative;display:flex;align-items:center;width:100%;min-height:48px;padding:10px 18px;text-align:start;color:var(--primary)}
#rmenu .mi .lb{font-size:calc(15px * var(--ts));line-height:1.6667}
/* ---- Replay: the preview. The step after the entry; its content is G2's and the media track's. */
#rprev{display:none;position:absolute;inset:0;z-index:9;background:var(--scrim)}
#phone.rprev-open #rprev{display:block}
#rprev .sheet{position:absolute;inset-inline:0;bottom:0;top:120px;background:var(--surface);border-start-start-radius:18px;border-start-end-radius:18px;padding:14px 10px 0}
#rprev .sh{display:flex;align-items:center;justify-content:space-between;padding-inline-start:14px}
#rprev .sh .lb{color:var(--primary)}
#rprev .x{width:44px;height:44px;display:grid;place-items:center;border-radius:12px;color:var(--rest)}

/* ---------------------------------------------------------------- the world rail -------- */
#rail{position:absolute;top:calc(var(--H) - var(--home) - var(--rail));height:calc(var(--rail) + var(--home));inset-inline:0;background:var(--surface);z-index:4;border-top:var(--boundary)}
#rail .items{position:absolute;top:0;inset-inline:0;height:var(--rail);display:flex}
#rail .it{position:relative;flex:1;min-width:0;height:var(--rail);display:flex;align-items:center;justify-content:center;padding:0 6px}
#rail .lb{font-size:calc(14px * var(--ts));line-height:1.6429;font-weight:var(--w-rest);color:var(--brass);text-align:center;overflow-wrap:anywhere}
#rail .it.sel .lb{font-weight:var(--w-sel)}
#marker{position:absolute;top:calc(var(--rail) - 12px);left:0;height:var(--marker-h);width:0;background:var(--marker);pointer-events:none}

/* PRESSED — a transient ground response. The material never changes. */
.prs::before{content:"";position:absolute;inset:4px;border-radius:12px;background:var(--press)}
#rail .it.prs::before{inset:6px 8px}
.row.prs::before{inset:0 8px;border-radius:12px}
/* FOCUS — a detached perimeter: offset gap, indicator, dark companion (E1). */
button:focus{outline:0}
button:focus-visible,#input:focus-visible,.t:focus-visible{outline:0;box-shadow:0 0 0 var(--focus-off) var(--focus-c),0 0 0 calc(var(--focus-off) + var(--focus-w)) var(--focus),0 0 0 calc(var(--focus-off) + var(--focus-w) + var(--focus-cw)) var(--focus-c)}
#rail .it:focus-visible,#phone.show-focus #rail .it.f-demo{box-shadow:none}
#rail .it:focus-visible::after,#phone.show-focus #rail .it.f-demo::after{content:"";position:absolute;inset:6px 8px;border-radius:12px;box-shadow:0 0 0 var(--focus-off) var(--focus-c),0 0 0 calc(var(--focus-off) + var(--focus-w)) var(--focus),0 0 0 calc(var(--focus-off) + var(--focus-w) + var(--focus-cw)) var(--focus-c)}
#phone.show-focus .f-demo:not(.it){box-shadow:0 0 0 var(--focus-off) var(--focus-c),0 0 0 calc(var(--focus-off) + var(--focus-w)) var(--focus),0 0 0 calc(var(--focus-off) + var(--focus-w) + var(--focus-cw)) var(--focus-c)}

/* ---------------------------------------------------------------- review chrome --------- */
body.live{display:flex;gap:36px;align-items:flex-start;padding:28px;min-height:100vh}
body.live #phone{flex-shrink:0;border-radius:44px;box-shadow:0 0 0 10px #050505,0 0 0 11px #2a2a2a}
.review{position:static;width:380px;color:#cfcfcf;font:13px/1.55 system-ui,'Segoe UI',sans-serif}
.review h1{font-size:15px;margin:0 0 8px}
.review p{margin:0 0 10px;color:#9b9b9b}
.review a{color:#d8d8d8}
`;
}

function statusBar() {
  return `<div class="status" aria-hidden="true"><span class="clock">9:41</span><span class="sys">` +
    `<svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5" width="3" height="6" rx="1" fill="currentColor"/><rect x="10" y="2.5" width="3" height="8.5" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="11" rx="1" fill="currentColor"/></svg>` +
    `<svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="17" height="8" rx="1.6" fill="currentColor"/><rect x="23.6" y="4" width="1.8" height="4" rx=".9" fill="currentColor" opacity=".45"/></svg>` +
    `</span></div>`;
}

/**
 * The opener: the locked template with `{display_name}` substituted — and nothing else. The name is isolated
 * in <bdi> (designing-arabic-frontends §4), which changes rendering, not text: the paragraph's textContent
 * is byte-for-byte the substituted template (check R3-01).
 */
export function openerHTML(lang, name = DISPLAY_NAME[lang]) {
  const [a, b] = OPENER[lang].split('{display_name}');
  return `${esc(a)}<bdi>${esc(name)}</bdi>${esc(b)}`;
}
let seedN = 0;
export function turnHTML(lang, t, dirMode = 'script') {
  const L = COPY[lang], who = t.who;
  const label = `<span class="sr">${esc(who === 'me' ? L.speakerMe.text : L.speakerQ.text)}: </span>`;
  if (t.kind === 'opener') {
    const name = t.name || DISPLAY_NAME[lang];
    const text = OPENER[lang].split('{display_name}').join(name);
    return `<div class="t q opener" data-who="q" data-kind="opener">${qMarkSVG({ height: 22, cls: 'qm' })}${label}` +
      `<p class="tx r-body" dir="${paragraphDir(text, L.dir)}">${openerHTML(lang, name)}</p></div>`;
  }
  const d = dirMode === 'auto' ? 'auto' : paragraphDir(t.text, L.dir);
  if (t.kind === 'voice') {
    const nm = `${who === 'me' ? L.play.text : L.qPlay.text}${lang === 'en' ? ',' : '،'} ${t.dur}`;
    return `<div class="t ${who} voice" data-who="${who}" data-kind="voice">${label}` +
      `<div class="vn"><button class="play" type="button" aria-label="${esc(nm)}">${svg(FUNC_GLYPHS.play, { size: 20 })}</button>${waveSVG(++seedN)}<span class="dur r-meta num">${esc(t.dur)}</span></div>` +
      `<p class="tx r-support" dir="${d}">${esc(t.text)}</p></div>`;
  }
  return `<div class="t ${who}" data-who="${who}">${label}<p class="tx r-body" dir="${d}">${esc(t.text)}</p></div>`;
}
function threadHTML(lang, turns, dirMode) {
  const L = COPY[lang];
  return turns.map((t) => {
    if (t.day) return `<p class="day r-meta">${esc(t.day === 'today' ? `${L.today.text} ${t.time}` : L.yesterday.text)}</p>`;
    return turnHTML(lang, t, dirMode);
  }).join('');
}

/**
 * `thread`: 'active' (returning reader) · 'new' (a brand-new conversation: the opener only) · 'voice'
 * (active + a voice note and QANDEEL's spoken reply) · 'stress' (mixed-script set).
 */
export function page({ lang = 'ar', appearance = 'system', thread = 'active', contrast = 'standard', capture = false, focus = null, speaker = 'r3', dirMode = 'script' } = {}) {
  if (!SPEAKERS.includes(speaker)) throw new Error(`unknown speaker system ${speaker}`);
  seedN = 0;
  const L = COPY[lang];
  const turns = thread === 'stress' ? [{ day: 'today', time: '11:12' }, ...STRESS.ar]
    : thread === 'new' ? NEW_THREAD[lang]
    : thread === 'voice' ? [...THREAD[lang], ...VOICE_TURNS[lang]] : THREAD[lang];
  const content = `<div class="thread">${`<div class="hist">${threadHTML(lang, turns, dirMode)}</div>`}<div class="new" aria-live="polite"></div><div id="picks" aria-hidden="true"></div></div>`;
  const railItems = L.nav.items.map((n) =>
    `<button class="it${focus === `rail-${n.key}` ? ' f-demo' : ''}" data-world="${n.key}" type="button"><span class="lb">${esc(n.text)}</span></button>`).join('');
  const shared = SHARED_WORLDS[lang].map((w) =>
    `<button class="row" type="button"><span class="who r-body">${esc(w.people)}</span><span class="when r-meta">${esc(w.last)}</span>${svg(FUNC_GLYPHS.back, { cls: 'fw mirror-fw', size: 20 })}</button>`).join('');
  const copy = Object.fromEntries(Object.entries(L).filter(([, v]) => v && v.text).map(([k, v]) => [k, { text: v.text }]));
  const counts = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((n) => [n, messagesCount(lang, n)]));
  const inject = { copy, counts, typingSample: lang === 'ar' ? 'الأرقام هتوصل بكرة الصبح' : 'The numbers land tomorrow morning', wave: waveSVG(40) };
  const appAttr = appearance === 'system' ? 'dark' : appearance;
  const review = capture ? '' : reviewPanel();
  const f = (k) => (focus === k ? ' f-demo' : '');
  return `<!doctype html>
<html lang="${L.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>QANDEEL — G1.1-R3 conversation proof</title>
<style>${css(speaker)}
/* The back and forward glyphs are directional; brand marks, media and non-directional glyphs are not. */
#phone[dir="rtl"] .mirror-fw{transform:none}
#phone[dir="ltr"] .mirror-fw{transform:scaleX(-1)}
</style></head>
<body dir="ltr"${capture ? '' : ' class="live"'}>
<div id="phone" dir="${L.dir}" lang="${L.lang}" data-appearance="${appAttr}" data-contrast="${contrast === 'increased' ? 'more' : 'standard'}" data-speaker="${speaker}" data-thread="${thread}" data-composer="idle" data-call="none" role="application" aria-label="${esc(L.product.text)}" class="${focus ? 'show-focus' : ''}">
${statusBar()}
<div id="hdr">
  <div id="hdr-conv"><button id="door" class="hbtn${f('door')}" type="button">${svg(FUNC_GLYPHS.depth, { size: 22 })}<span class="lb">${esc(L.door.text)}</span></button></div>
  <div id="hdr-world"><button id="back" class="hbtn" type="button" aria-label="${esc(L.backName.text)}">${svg(FUNC_GLYPHS.back, { cls: 'mirror', size: 22 })}<span class="lb">${esc(L.back.text)}</span></button></div>
  <div id="hdr-pick" hidden><p class="lb r-action">${esc(L.replayPart.text)}</p></div>
  <button id="replay" class="${f('replay').trim()}" type="button" aria-label="${esc(L.replay.text)}" aria-haspopup="menu" aria-expanded="false" aria-controls="rmenu">${svg(FUNC_GLYPHS.replay, { size: 22 })}</button>
</div>
<main>
  <section id="dest-mine" class="dest" aria-label="${esc(L.nav.items[0].text)}">
    <div id="conv"><div id="scroll">${content}</div><div class="fade"></div></div>
    <div id="world" role="region" aria-label="${esc(L.door.text)}"><img alt="" src="data:image/png;base64,${WORLD[appAttr]}"></div>
  </section>
  <section id="dest-shared" class="dest" aria-labelledby="st">
    <h1 id="st" class="title r-title">${esc(L.sharedMany.text)}</h1>
    <p class="none r-body" hidden>${esc(L.sharedNone.text)}</p>
    <p class="note r-meta">${esc(L.sharedNote.text)}</p>
    <div class="rows">${shared}</div>
  </section>
  <section id="dest-public" class="dest" aria-label="${esc(L.nav.items[2].text)}">
    <h1 class="title r-title">${esc(L.nav.items[2].text)}</h1>
    <div class="boundary">PROOF BOUNDARY — the Public World surface is not designed in G1.1. It exists as a canonical World type (PUBLIC_WORLD); its semantics are owned by CW2-04 and its surface by a later task.</div>
  </section>
</main>
<div id="composer">
  <label class="sr" for="input">${esc(L.composerLabel.text)}</label>
  <div class="write">
    <input id="input" type="text" dir="auto" autocomplete="off" placeholder="${esc(L.composerPlaceholder.text)}">
    <div class="line"></div>
    <svg id="trace" viewBox="0 0 10 20" preserveAspectRatio="none" aria-hidden="true"><path id="trace-old" d=""/><path id="trace-path" d=""/></svg>
    <div class="vtop"><span id="vlabel" class="vl r-action">${esc(L.recording.text)}</span><span id="elapsed" class="r-meta num">0:00</span></div>
  </div>
  <!-- writing -->
  <button id="call" class="cbtn m m-idle slot-i${f('call')}" type="button" aria-label="${esc(L.call.text)}">${svg(FUNC_GLYPHS.call)}</button>
  <button id="mic" class="cbtn m m-idle slot-o${f('mic')}" type="button" aria-label="${esc(L.voiceNote.text)}">${svg(FUNC_GLYPHS.mic)}</button>
  <button id="send" class="cbtn m m-idle slot-o" type="button" aria-label="${esc(L.send.text)}">${svg(FUNC_GLYPHS.send)}</button>
  <!-- voice note -->
  <button id="note-cancel" class="cbtn m m-note slot-i" type="button" aria-label="${esc(L.voiceCancel.text)}">${svg(FUNC_GLYPHS.close)}</button>
  <button id="note-send" class="cbtn m m-note slot-o" type="button" aria-label="${esc(L.voiceSend.text)}">${svg(FUNC_GLYPHS.send)}</button>
  <!-- live call -->
  <button id="mute" class="cbtn m m-call slot-i${f('mute')}" type="button" aria-label="${esc(L.mute.text)}" aria-pressed="false">${svg(FUNC_GLYPHS.mic, { cls: 'g-mic' })}${svg(FUNC_GLYPHS.muted, { cls: 'g-muted' })}</button>
  <button id="end-call" class="cbtn m m-call slot-o${f('end-call')}" type="button" aria-label="${esc(L.endCall.text)}">${svg(FUNC_GLYPHS.endCall)}</button>
</div>
<div id="pickbar"><p id="pick-count" class="cnt r-action" aria-live="polite">${esc(L.pickHint.text)}</p><button id="pick-cancel" class="pb r-action" type="button">${esc(L.cancel.text)}</button><button id="pick-go" class="pb r-action" type="button" aria-disabled="true">${esc(L.preview.text)}</button></div>
<nav id="rail" aria-label="${esc(L.nav.label.text)}"><div class="items">${railItems}</div><div id="marker"></div></nav>
<div id="rmenu" role="menu" aria-label="${esc(L.replay.text)}"><button class="mi" role="menuitem" data-scope="full" type="button"><span class="lb">${esc(L.replayFull.text)}</span></button><button class="mi" role="menuitem" data-scope="part" type="button"><span class="lb">${esc(L.replayPart.text)}</span></button></div>
<div id="rprev" role="dialog" aria-modal="true" aria-labelledby="rprev-t"><div class="sheet"><div class="sh"><h2 id="rprev-t" class="lb r-action">${esc(L.preview.text)}</h2><button class="x" id="rprev-x" type="button" aria-label="${esc(L.close.text)}">${svg(FUNC_GLYPHS.close)}</button></div>
<div class="boundary">PROOF BOUNDARY — the Replay preview is not designed in G1.1. G2 owns the Living Analysis picture; the I-06 runtime can bind this selection today from committed TEXT only. Original Personal Live Call / Voice Note audio is NOT a producible Replay source (docs/replay-runtime-v1.md §7) and nothing here claims it. Share / export / publish run only through the existing Replay distribution authority (I-06C/D), which fails closed in production today.</div></div></div>
<div class="homebar"></div>
<p id="live" class="sr" aria-live="polite"></p>
</div>
${review}
<script>window.__G11=${JSON.stringify(inject)};window.addEventListener('error',function(e){window.__err=String(e.message)+' @'+e.lineno;});</script>
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
<script>${RUNTIME}</script>
</body></html>`;
}

function reviewPanel() {
  return `<aside class="review">
<h1>QANDEEL · G1.1-R3 — review chrome</h1>
<p>Interactive. Write and press Enter; tap the microphone for a voice message; tap the handset for a Live Call (it opens the Conversation analysis; «المحادثة» returns to the conversation without ending the call). The Replay control appears at the top once the conversation holds committed words.</p>
<p id="level-src">Voice level: simulated unless the browser grants the microphone. Nothing is recorded, stored or sent.</p>
<p>Review-only parameters: <code>?appearance=light|dark</code>, <code>?rm=1</code> Reduced Motion, <code>?contrast=more</code>, <code>?ts=2</code>, <code>?shared=0|1|3</code>, <code>?state=</code> call · call-conv · note · replay-menu · replay-part · shared · world. Builds beside this file: <code>index-en.html</code>, <code>index-new-conversation.html</code>.</p>
<p>Keyboard: Tab through every control; Escape closes the Replay menu, leaves a part selection, or leaves the Analysis (never ends a call).</p>
</aside>`;
}

// Builds every prototype file the package ships.
const BUILDS = [
  { file: 'index.html', opts: { lang: 'ar', appearance: 'system' } },
  { file: 'index-en.html', opts: { lang: 'en', appearance: 'system' } },
  { file: 'index-new-conversation.html', opts: { lang: 'ar', appearance: 'system', thread: 'new' } },
];
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const b of BUILDS) { writeFileSync(join(OUT, b.file), page(b.opts)); console.log('wrote', b.file); }
}
