// G1.1-R3 — review boards. Review chrome is English and neutral; everything inside a phone frame is the
// prototype's own raster, never redrawn. Boards are rendered at 1x (the 780 x 1688 screens ship beside
// them); magnified crops are cut from those same rasters, never re-rendered.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, encode, crop } from '../vendor/png.mjs';
import { launch } from './cdp.mjs';
import { OPENER } from '../src/content.mjs';
import { JOURNEY, SETTLE_MS } from './motion.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORK = join(HERE, '..');
const SCR = join(WORK, 'out', 'screens');
const MOT = join(WORK, 'out', 'motion');
const CROPS = join(WORK, 'out', 'crops');
const BOARDS = join(WORK, 'out', 'boards');
mkdirSync(CROPS, { recursive: true }); mkdirSync(BOARDS, { recursive: true });
const url = (p) => 'file:///' + p.replace(/\\/g, '/');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const S = (n) => join(SCR, `${n}.png`);
const FR = (journey, ms) => join(MOT, journey, `f${String(Math.round((ms / 1000) * 60)).padStart(4, '0')}.png`);

/** Cut a band out of a 2x raster, given in CSS px. */
function cropCss(src, name, x0, y0, x1, y1) {
  const img = decode(readFileSync(src));
  const out = crop(img, x0 * 2, y0 * 2, (x1 - x0) * 2, (y1 - y0) * 2);
  const p = join(CROPS, `${name}.png`);
  writeFileSync(p, encode(out));
  return p;
}
const HDR = (n) => cropCss(S(n), `hdr-${n}`, 0, 47, 390, 95);
const COMP = (n) => cropCss(S(n), `comp-${n}`, 0, 684, 390, 760);

const FONT_URL = url(join(WORK, 'vendor', 'Estedad-wght-v8.5.woff2'));
const CSS = `@font-face{font-family:Estedad;src:url(${FONT_URL}) format('woff2');font-weight:100 900}
*{box-sizing:border-box;margin:0;padding:0}
html{background:#161616}
body{background:#161616;color:#d6d6d6;font:14px/1.55 system-ui,'Segoe UI',sans-serif;padding:36px 40px 44px;width:max-content;min-width:960px}
h1{font-size:24px;font-weight:600;color:#f0f0f0;margin-bottom:4px}
.sub{color:#a8a8a8;max-width:1240px;margin-bottom:24px}
.row{display:flex;gap:26px;align-items:flex-start}
.row > *{flex-shrink:0}
figure{display:flex;flex-direction:column;gap:9px}
figure img{display:block;border-radius:22px;box-shadow:0 0 0 1px #2c2c2c}
figure img.flat{border-radius:6px}
figure img.glance{filter:blur(2.5px);clip-path:inset(0 round 22px)}
figcaption{font-size:13px;color:#bdbdbd;max-width:var(--w)}
figcaption b{color:#ececec;font-weight:600}
.notes{width:390px;font-size:13.5px;color:#c4c4c4}
.notes h2{font-size:14px;color:#ededed;margin:0 0 6px}
.notes li{margin-bottom:7px}
.notes ul{padding-left:18px}
.ar{font-family:Estedad,system-ui;direction:rtl;unicode-bidi:isolate}
bdi.ar{white-space:nowrap}
.tag{display:inline-block;font-size:11px;font-weight:600;padding:1px 7px;border-radius:4px;margin-right:6px;background:#24382a;color:#b4e6c0}
.tag.gap{background:#3a3424;color:#eadcaa}.tag.old{background:#3a2424;color:#f0b8b0}
.foot{margin-top:26px;color:#8f8f8f;font-size:12px;max-width:1400px}
`;
const fig = ({ src, w = 390, caption, flat = false, glance = false }) =>
  `<figure style="--w:${w}px"><img class="${flat ? 'flat' : ''}${glance ? ' glance' : ''}" src="${url(src)}" width="${w}"><figcaption>${caption}</figcaption></figure>`;
const notes = (title, items) => `<div class="notes"><h2>${esc(title)}</h2><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul></div>`;
const col = (...parts) => `<div style="display:flex;flex-direction:column;gap:18px">${parts.join('')}</div>`;
// Review chrome is English; every quoted Arabic run («…») is bidi-isolated so a caption cannot reorder it
// (designing-arabic-frontends §4) — «A» / «B» must read A then B inside an English sentence.
const isolate = (html) => html.replace(/«[^»<]*»/g, (m) => `<bdi class="ar">${m}</bdi>`);
function board({ title, sub, rows, foot = '' }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${CSS}</style></head><body>
<h1>${isolate(esc(title))}</h1><p class="sub">${isolate(sub)}</p>${rows.map((r) => `<div class="row" style="margin-bottom:26px">${isolate(r.join(''))}</div>`).join('')}
${foot ? `<p class="foot">${isolate(foot)}</p>` : ''}</body></html>`;
}
const GLANCE = 'Glance row: the same raster under a 2.5 px blur at board size (≈ 4 px at phone size) — the words become unreadable, as in a one-second look. What still separates the speakers there is what a reader actually uses.';
const at = (act, n = 0) => JOURNEY.filter((e) => e.act === act)[n].at;

export const BOARD_DEFS = () => [
  {
    file: 'R3-00-at-a-glance.png', title: 'G1.1-R3 — Consolidated Product / Conversation / Replay correction, at a glance',
    sub: 'Every phone is the prototype\'s own capture. Arabic, dark, 390 × 844. The locked Product decisions of the R3 brief, in one row: the opener, the speaker sides, the three ways of talking, Live Call on the Analysis, Replay in the upper chrome, and count-true shared naming.',
    rows: [[fig({ src: S('conv-01-new-opener'), w: 250, caption: '<b>New conversation.</b> The locked opener, QANDEEL\'s side. No Replay yet.' }),
      fig({ src: S('conv-02-active-ar'), w: 250, caption: '<b>Active.</b> Reader slab on the RIGHT; QANDEEL opposite. Replay in the chrome.' }),
      fig({ src: S('modes-03-voice-note-in-history'), w: 250, caption: '<b>Voice Note.</b> Conversation-first; lands in the history.' }),
      fig({ src: S('modes-04-live-call-analysis'), w: 250, caption: '<b>Live Call.</b> Opens on the Analysis; «المحادثة» returns.' }),
      fig({ src: S('modes-05-live-call-conversation'), w: 250, caption: '<b>Live Call, Conversation open.</b> The call bar never left.' }),
      fig({ src: S('replay-05-entry-menu'), w: 250, caption: '<b>Replay entry.</b> «المحادثة كاملة» / «جزء من المحادثة».' }),
      fig({ src: S('shared-01-one'), w: 250, caption: '<b>Shared area, one.</b> «عالم مشترك»; the rail stays «مع الآخرين».' })]],
  },
  {
    file: 'conversation/R3-01-new-conversation-opener.png', title: 'Proof 1 — the new-conversation opener (locked copy)',
    sub: `The short message at the beginning of every new normal conversation — not the post-registration Welcome. Template, byte for byte: <span class="ar">${esc(OPENER.ar)}</span>. The only runtime substitution is <code>{display_name}</code>.`,
    rows: [[fig({ src: S('conv-01-new-opener'), caption: '<b>Arabic, dark.</b> The opener is QANDEEL\'s first turn, on QANDEEL\'s side, with the Q once above it. The reader has not spoken; the Replay slot at the top is empty.' }),
      fig({ src: S('conv-01b-new-opener-en'), caption: '<b>English.</b> "Hi {display_name} ... I\'m here waiting for you ... let\'s get started" — the approved meaning, on QANDEEL\'s side (the right in English).' }),
      fig({ src: S('light-02-new-opener'), caption: '<b>Light.</b> Same composition; no Welcome, no onboarding, no product-definition text.' }),
      notes('What is fixed, and what is not', [
        '<b>Byte-for-byte.</b> Check R3-01a compares the template\'s UTF-8 bytes with the brief\'s, typed independently into the checker; R3-01b reads the rendered paragraph back and requires exactly the template with only the name substituted — in Arabic, English, and Arabic with a Latin name.',
        '<b>Not rewritten.</b> No hamza added to «اهلا» / «انا», no diacritics, «انا في انتظارك» kept (never «أنا مستنيك»).',
        '<b>The name is isolated</b> in <code>&lt;bdi&gt;</code>, so a Latin display name cannot reorder the Arabic around it (bidi board). That changes rendering, not text.',
        '<span class="tag gap">SOURCE GAP</span> <b>No canonical display name exists.</b> <code>users</code> carries id / auth_subject / timestamps only (migration 0001), and 0111 answers UNRESOLVED_NO_CANONICAL_SOURCE for a product account name. «نور» is a fixture. What the opener says when no name is registered is NOT invented here — it is a Product question (report §E).',
        '<span class="tag gap">SOURCE GAP</span> <b>The post-registration Welcome was not found</b> in any canonical source (the sign-in gateway copy explicitly greets no one). Per brief §13 it is omitted, not reconstructed.',
      ])]],
  },
  {
    file: 'conversation/R3-02-speaker-sides-arabic-english.png', title: 'Proofs 2–3 — speaker sides: Arabic USER right, English USER left, QANDEEL opposite',
    sub: 'The locked partial slab. The reader\'s turn sits on the functional Surface, attached to the reader\'s own edge — the START edge, so RIGHT in Arabic and LEFT in English — open toward that edge and rounded only on the two corners that face into the conversation. QANDEEL speaks open on the World from the opposite side.',
    rows: [[fig({ src: S('conv-02-active-ar'), caption: '<b>Arabic — USER RIGHT.</b> Every reader slab touches the right screen edge; every QANDEEL turn keeps ≥ 72 px clear of it.' }),
      fig({ src: S('conv-03-active-en'), caption: '<b>English — USER LEFT.</b> The whole system mirrors: the slab on the left edge, QANDEEL from the right.' }),
      fig({ src: S('conv-06-a1-placement-superseded'), caption: '<span class="tag old">SUPERSEDED</span><b>A1 as submitted</b> — the reader at the END edge (left in Arabic). R3 §4 locks the opposite; kept only to show what changed.' }),
      notes('What changed from A1, and only that', [
        '<b>Side.</b> The reader moves from the END edge to the START edge (right in Arabic, left in English); QANDEEL moves to the opposite side, set in by a 48 px start inset so its lines never enter the reader\'s column.',
        '<b>Material, radius, rhythm, type, ink:</b> unchanged from the A1 slab the Product Owner selected — the one functional Surface tone, 18 px on the inward corners only, both speakers at primary ink and weight 400.',
        '<b>Measured (R3-02)</b> over 16 states: every reader slab on the RIGHT edge in Arabic and the LEFT in English, leaving QANDEEL a lane ≥ 64 px; every QANDEEL turn ≥ 72 px clear of the reader\'s edge; both turn containers keep the phone\'s direction.',
        '<b>Not a bubble (R3-05):</b> edge-side corners are square and the slab bleeds through the gutter to the screen — probe P-R3-05 plants a full 18 px radius and the check rejects it.',
      ])],
    [fig({ src: S('conv-02-active-ar'), w: 250, glance: true, caption: '<b>Arabic, at a glance.</b>' }), fig({ src: S('conv-03-active-en'), w: 250, glance: true, caption: '<b>English, at a glance.</b>' }),
      fig({ src: S('light-01-active'), w: 250, glance: true, caption: '<b>Light, at a glance.</b>' }), fig({ src: S('a11y-01-contrast-more'), w: 250, glance: true, caption: '<b>Increase Contrast, at a glance.</b>' }),
      notes('The one-second test (G1.1-R3-04)', [GLANCE, 'Grey blocks against the right edge are the reader; open text on the left is QANDEEL — in dark, Light and Increase Contrast. No colour, no Brass, no avatar carries it.', 'R3-04 checks this on the shipped rasters themselves: 6 px in from the reader\'s edge, every reader turn stands on the slab tone and every QANDEEL turn on the World.'])]],
    foot: GLANCE,
  },
  {
    file: 'conversation/R3-03-mixed-language-bidi.png', title: 'Proof 4 — mixed Arabic / English: paragraph direction never moves a turn',
    sub: 'Every turn is two direction contexts: the container takes the phone\'s direction (which SIDE), the paragraph takes its own (how it READS), decided by the script that carries the sentence — not by the first letter.',
    rows: [[fig({ src: S('conv-04-mixed-bidi'), caption: '<b>Arabic UI, mixed turns.</b> An Arabic sentence opening with «Q3 numbers» stays RTL; the pasted English subject line is LTR inside the reader\'s slab — and that slab is still on the RIGHT edge.' }),
      fig({ src: S('conv-04c-mixed-top-latin-name'), caption: '<b>The opener with a Latin display name.</b> «اهلا يا Nour ...» remains an RTL sentence; the isolated name cannot reorder the ellipses around it. Email, version, time, d/m dates, parentheses above.' }),
      fig({ src: S('conv-04b-mixed-first-strong-trap'), caption: '<span class="tag old">THE TRAP</span><b>First-strong <code>dir="auto"</code></b>, rendered for comparison: «Q3 numbers لسه ما وصلتش…» is laid out left-to-right because its first letter is Latin.' }),
      notes('What is proved', [
        '<b>Side never follows script</b> (R3-03, R3-02): a planted <code>dir="ltr"</code> on a reader container moves the slab off the right edge, and the check rejects it (P-R3-02b).',
        '<b>Arabic stays RTL</b> in every Arabic turn, including one that opens with English words; the full stop lands at the Arabic end.',
        '<b>English stays LTR</b> when a whole line is English, aligned to its own start inside the slab.',
        '<b>Media rows read left-to-right</b> in both scripts (play · waveform · duration): a media timeline is not mirrored, and neither are the play, Replay or handset glyphs (B10).',
      ])]],
  },
  {
    file: 'conversation/R3-04-slab-morphology.png', title: 'The selected partial slab, magnified',
    sub: 'Cut from the shipped 2x rasters. Open and square on the reader\'s edge; rounded only where it faces the conversation; made of the one functional Surface tone. Under Increase Contrast the boundary is drawn on the three inward sides and not on the edge it does not end at.',
    rows: [[fig({ src: cropCss(S('conv-02-active-ar'), 'slab-ar', 70, 190, 390, 320), w: 480, flat: true, caption: '<b>Arabic.</b> Attached to the right screen edge.' }),
      fig({ src: cropCss(S('conv-03-active-en'), 'slab-en', 0, 160, 320, 290), w: 480, flat: true, caption: '<b>English.</b> Attached to the left screen edge.' })],
    [fig({ src: cropCss(S('a11y-01-contrast-more'), 'slab-contrast', 70, 190, 390, 320), w: 480, flat: true, caption: '<b>Increase Contrast.</b> 1 px tertiary boundary on the inward sides only.' }),
      fig({ src: cropCss(S('light-01-active'), 'slab-light', 70, 190, 390, 320), w: 480, flat: true, caption: '<b>Light.</b> The Light functional tone on the Light World.' }),
      notes('Why this is the selected form, not a bubble', ['A bubble is a closed capsule floating on the World; this slab is a piece of the reader\'s side of the glass — every Surface in QANDEEL is anchored to an edge.', 'Fill = <code>qandeel.surface.functional</code> resolved directly, not through a role alias: no frozen B4 role owns it yet (B4 reconciliation note).'])]],
  },
  {
    file: 'modes/R3-05-writing-and-the-three-ways-of-talking.png', title: 'Proof 5 — Writing, and the three ways of talking in one line',
    sub: 'Writing, Voice Note and Live Call are three ways of talking to the same QANDEEL in the same conversation — not three products and not three places. They share one lower line: the writing line carries text, then a voice note\'s level, then the live call\'s level.',
    rows: [[fig({ src: S('modes-01-writing'), caption: '<b>Writing.</b> Conversation-first. With text in the line, the outer control is Send; the handset stays beside it.' }),
      col(fig({ src: COMP('conv-02-active-ar'), w: 585, flat: true, caption: '<b>Idle.</b> The line (Writing) · Live Call (handset) · Voice Note (microphone). 44 px targets, 8 px apart.' }),
        fig({ src: COMP('modes-01-writing'), w: 585, flat: true, caption: '<b>Writing.</b> The microphone becomes Send while there is text to send.' }),
        fig({ src: COMP('modes-02-voice-note-recording'), w: 585, flat: true, caption: '<b>Voice Note.</b> «بسجّل» and the elapsed time; the line draws the level; Cancel and Send.' }),
        fig({ src: COMP('modes-05-live-call-conversation'), w: 585, flat: true, caption: '<b>Live Call.</b> «مكالمة صوتية» and the call time; mute and end call (a ring, not a colour).' })),
      notes('The model', [
        '<b>Writing</b> is Conversation-first; the upper depth action is «تحليل المحادثة».',
        '<b>Voice Note</b> starts from the same line and stays in the Conversation (R3-07 records the depth while recording: conversation).',
        '<b>Live Call</b> is the only mode that changes the visible surface — it opens the Analysis (R3-08).',
        '<b>Names</b> (VI-01 V01/V02, provisional Phase VII): «رسالة صوتية», «مكالمة صوتية». VI-01\'s matrix itself lists V01 twice («تسجيل صوتي» / «رسالة صوتية»); R3 uses the composer row.',
        '<b>Not a toolbar:</b> two icon controls at the end of the line, no labels row, no mode switcher.',
      ])]],
  },
  {
    file: 'modes/R3-06-voice-note.png', title: 'Proof 6 — Voice Note: Conversation-first, represented in the history',
    sub: 'A voice message is a turn like any other: same speaker side, same material. The reader\'s note sits in the reader\'s slab; QANDEEL\'s spoken reply stands open on the World. Each carries a play control, a static waveform and its duration, with the committed text beneath.',
    rows: [[fig({ src: S('modes-02-voice-note-recording'), caption: '<b>Recording.</b> From the Conversation\'s own line; the history stays on screen. Nothing moves the reader to the Analysis.' }),
      fig({ src: S('modes-03-voice-note-in-history'), caption: '<b>In the history.</b> The reader\'s note on the right in its slab; QANDEEL\'s voice reply opposite.' }),
      fig({ src: S('a11y-04-text-200-voice-note'), caption: '<b>200% text.</b> The slab, the 44 px play control and the transcript reflow; nothing clips.' }),
      notes('Truth boundaries', [
        '<span class="tag gap">RUNTIME DEPENDENCY</span> <b>Personal audio is not durable today.</b> <code>conversation_units.source_modality</code> is CHECK-pinned to TEXT (migration 0064) and replay-runtime-v1 §7: "Personal audio does not exist and is not invented." Playing a Personal voice note back from the history needs the same reviewed durable Personal audio source as Replay.',
        '<b>The transcript is the committed text.</b> It is shown in secondary ink under the media row. A note sent live in the prototype shows no transcript — the prototype has no speech runtime, so none is invented.',
        '<b>QANDEEL\'s voice reply</b> is represented only "where applicable" (R3 §7): same history, same side as its text turns.',
        '<b>Accessible names</b> carry the duration: «تشغيل الرسالة الصوتية، 0:14» / «تشغيل رد قنديل، 0:09».',
      ])]],
  },
  {
    file: 'modes/R3-07-live-call.png', title: 'Proofs 7–8 — Live Call: Analysis-first; Conversation reachable without ending the call',
    sub: 'Starting a Live Call opens the Analysis as the visual hero, so the reader can talk while seeing QANDEEL\'s understanding. The call lives in the lower line, which stays put in both depths. «المحادثة» opens the Conversation; «تحليل المحادثة» returns to the SAME call.',
    rows: [[fig({ src: S('modes-04-live-call-analysis'), caption: '<b>Live Call — default.</b> Analysis on screen; upper chrome «المحادثة» (named «المحادثة — المكالمة مستمرة») and Replay; call time, level, mute, end call.' }),
      fig({ src: S('modes-05-live-call-conversation'), caption: '<b>Conversation opened during the call.</b> The call bar has not moved; a quiet marker «مكالمة صوتية بدأت» sits in the history; «تحليل المحادثة» returns.' }),
      fig({ src: S('modes-07-live-call-muted'), caption: '<b>Muted.</b> The glyph changes shape (slashed microphone) and the level line flattens; <code>aria-pressed</code> carries the state.' }),
      fig({ src: S('modes-06-live-call-analysis-en'), w: 300, caption: '<b>English.</b> Mirrored chrome; the call bar\'s pen sits at the end of the line.' })],
    [notes('What R3-08 proves on the live prototype', [
      'call → the Analysis is on screen, call live, with end call, mute and «المحادثة» reachable;',
      '«المحادثة» → the Conversation, call still live, its controls still reachable;',
      '«تحليل المحادثة» → the same call — its start instant is unchanged; no second session. Probes plant "leaving ends the call" and "returning restarts it"; both are rejected.',
      'Escape leaves the Analysis but never ends a call.',
    ]), notes('What the call leaves behind', [
      'After the call the history keeps a record line «مكالمة صوتية · m:ss». Nothing else is shown, because the canonical Personal substrate is TEXT only and no reviewed Personal call source exists: no transcript is invented and no audio is implied.',
      '<span class="tag gap">RUNTIME DEPENDENCY</span> What durable call / transcript history the Conversation retains is for the Voice / Live Call track to establish (R3 §8, §11).',
      'Shared human-to-human live call remains DISABLED_BY_PRODUCT_LEGAL_GATE (CW2-03 §42); this proof shows only the Personal call with QANDEEL.',
    ])]],
  },
  {
    file: 'replay/R3-08-replay-in-the-upper-chrome.png', title: 'Proofs 9–12 — Replay in the upper chrome: one control, one place, only when eligible',
    sub: 'Replay is an action on the current conversation, not a World, a tab or a mode. It stands at the END edge of the upper chrome, at the identical position in the Conversation, the Analysis and during a call (R3-09). Its slot is reserved, so nothing moves when it appears.',
    rows: [[col(fig({ src: HDR('conv-02-active-ar'), w: 585, flat: true, caption: '<b>Proof 9 — Conversation chrome.</b> «تحليل المحادثة» and Replay.' }),
      fig({ src: HDR('replay-02-analysis-chrome'), w: 585, flat: true, caption: '<b>Proof 10 — Analysis chrome.</b> «المحادثة» and the same Replay, same place.' }),
      fig({ src: HDR('modes-04-live-call-analysis'), w: 585, flat: true, caption: '<b>During a Live Call.</b> Same chrome; the route back is named «المحادثة — المكالمة مستمرة».' }),
      fig({ src: HDR('conv-01-new-opener'), w: 585, flat: true, caption: '<b>Proof 11 — unavailable.</b> A brand-new conversation holds no committed material of the reader\'s: no Replay, visually or by keyboard.' })),
      fig({ src: S('conv-01-new-opener'), w: 300, caption: '<b>Proof 11 — the new conversation.</b>' }),
      fig({ src: S('conv-05-first-words-sent'), w: 300, caption: '<b>Proof 12 — available.</b> The reader\'s first words are sent through the real send path; Replay becomes reachable.' }),
      fig({ src: S('replay-02-analysis-chrome'), w: 300, caption: '<b>Analysis (writing mode).</b>' })]],
  },
  {
    file: 'replay/R3-09-replay-entry.png', title: 'Proof 13 — Replay entry: the whole conversation, or a part of it. No editor.',
    sub: 'The entry is an ASIDE (B0R §3.2): anchored to the Replay control, the conversation keeps running beneath it, walking away is a complete outcome — so it has no scrim. A part is chosen on the conversation\'s own turns, as whole turns in source order.',
    rows: [[fig({ src: S('replay-05-entry-menu'), caption: '<b>Entry.</b> «المحادثة كاملة» / «جزء من المحادثة», anchored under Replay. Escape closes it and returns focus to Replay.' }),
      fig({ src: S('replay-06b-part-empty'), caption: '<b>A part — choosing.</b> Each turn is a checkbox; a ring in the far gutter marks it. «معاينة» waits until something is chosen.' }),
      fig({ src: S('replay-06-part-selected'), caption: '<b>A part — chosen.</b> First and last turn tapped; the range fills and joins; «4 رسائل» (true Arabic count grammar).' }),
      fig({ src: S('replay-07-preview-boundary'), caption: '<b>Preview — boundary.</b> The next step is G2\'s picture and the media track\'s sound; the proof states the boundary instead of faking a player.' })],
    [notes('Why this is not a video editor', [
      'No timeline, no trim handles, no scrubber, no effects — the only choice is whole conversation vs a contiguous part.',
      'Chronology cannot be reordered: a part is a range of turns in source order (replay-runtime-v1 §5: "A selection may omit real moments; it may never reorder them").',
      'The runtime maps directly: «المحادثة كاملة» ↔ FULL_SOURCE; «جزء من المحادثة» ↔ SELECTED_EXCERPT over EXPLICIT_RESOLVED_ANCHORS.',
    ]), notes('What the runtime can and cannot do today', [
      '<b>Can:</b> bind a Personal selection from committed TEXT (both speakers\' delivered text) and a historical analytical projection at sealed points (§7, §20).',
      '<b>Cannot:</b> use Personal original Live Call / Voice Note audio — NOT PRODUCIBLE, "no durable canonical source exists" (§7). The open Live Head cannot be frozen (§19).',
      '<b>Share / export / publish</b> only through the existing distribution authority (I-06C/D), which fails closed in production today (§62).',
      '<span class="tag gap">PROOF COPY</span> «إعادة عرض المحادثة» — no canonical Arabic term for Replay exists (decision R3-J6).',
    ]), fig({ src: S('replay-08-entry-menu-en'), w: 300, caption: '<b>English.</b> Replay at the right end; the entry anchored beneath it.' })]],
  },
  {
    file: 'shared-area/R3-10-shared-area-count-grammar.png', title: 'Proofs 14–15 — the shared area: the count never lies',
    sub: 'The primary navigation label is count-neutral and never changes: «مع الآخرين». Inside the area the heading is derived from the number of shared worlds actually shown — one → «عالم مشترك», more than one → «عوالم مشتركة», zero → an honest empty state.',
    rows: [[fig({ src: S('shared-01-one'), w: 300, caption: '<b>Proof 14 — one.</b> «عالم مشترك».' }), fig({ src: S('shared-02-many'), w: 300, caption: '<b>Proof 15 — several.</b> «عوالم مشتركة».' }),
      fig({ src: S('shared-03-none'), w: 300, caption: '<b>Zero.</b> The area keeps its neutral name and says «لسه مفيش عالم مشترك.».' }),
      fig({ src: S('shared-04-en-one'), w: 300, caption: '<b>English, one.</b> "Shared world".' }), fig({ src: S('shared-05-en-many'), w: 300, caption: '<b>English, several.</b> "Shared worlds".' })]],
    foot: 'R3-11a checks the rail label carries no World noun a count could falsify; R3-11b renders 0 / 1 / 3 in Arabic and 1 / 3 in English and requires the heading, the empty state and an unchanged rail label — a planted plural heading over one row is rejected.',
  },
  {
    file: 'light/R3-11-light-appearance-sanity.png', title: 'Proof 16 — Light appearance sanity check',
    sub: 'The same states in Light (F2R). The slab is the Light functional tone on the Light World — a one-tone step, like the composer — and the speaker sides hold at a glance (R3-04 samples the Light rasters too).',
    rows: [[fig({ src: S('light-01-active'), w: 300, caption: '<b>Active.</b>' }), fig({ src: S('light-02-new-opener'), w: 300, caption: '<b>New conversation.</b>' }),
      fig({ src: S('light-03-voice-note-in-history'), w: 300, caption: '<b>Voice notes.</b>' }), fig({ src: S('light-04-live-call-analysis'), w: 300, caption: '<b>Live Call — Analysis.</b>' }),
      fig({ src: S('light-05-replay-menu'), w: 300, caption: '<b>Replay entry.</b>' })]],
  },
  {
    file: 'motion/R3-12-reduced-motion-parity.png', title: 'Proof 17 — Reduced Motion parity: the same destination, controls, call state and Replay availability',
    sub: `Frames ${SETTLE_MS} ms after each act, from the two recordings (journey-ar-dark.mp4 and journey-ar-dark-reduced-motion.mp4). Top: standard. Bottom: Reduced Motion. Reduced Motion removes travel (no lift, no rise, no scale); it removes no state and no control — R3-M1 compares the prototype's own truth record at every commit and every settled point.`,
    rows: [
      [['call', 'Live Call → Analysis'], ['leave', '«المحادثة» → Conversation, call live'], ['enter', '«تحليل المحادثة» → same call'], ['endcall', 'call ended'], ['menu', 'Replay entry']].map(([a, c]) => fig({ src: FR('journey-ar-dark', at(a, a === 'leave' ? 0 : 0) + SETTLE_MS), w: 240, caption: `<b>${c}</b> — standard` })),
      [['call', 'Live Call → Analysis'], ['leave', '«المحادثة» → Conversation, call live'], ['enter', '«تحليل المحادثة» → same call'], ['endcall', 'call ended'], ['menu', 'Replay entry']].map(([a, c]) => fig({ src: FR('journey-ar-dark-reduced-motion', at(a) + SETTLE_MS), w: 240, caption: `<b>${c}</b> — Reduced Motion` })),
      [fig({ src: FR('journey-ar-dark', at('call') + 150), w: 240, caption: '<b>Mid-transition, standard</b> (+150 ms): the conversation lifts, the Analysis rises beneath it, the line becomes the call line.' }),
        fig({ src: FR('journey-ar-dark-reduced-motion', at('call') + 150), w: 240, caption: '<b>Mid-transition, Reduced Motion</b> (+150 ms): already there — a 140 ms resolve, no travel.' }),
        notes('Motion discipline (R3 §17)', ['No new duration and no new curve: the depth change reuses G1.1\'s lift / rise (200 / 320 ms, T-10\'s one curve), the line reuses the 220 ms voice transition.', 'Motion explains continuity only: state is committed before any frame moves (the truth record at "commit" already shows the new depth and call).', 'Under Reduced Motion the call level line is drawn flat — the call time still counts and the call controls are identical.', 'Nothing in the Conversation is decorative: no pulse, no breathing, no ripple on the call (A06).'])],
    ],
  },
  {
    file: 'accessibility/R3-13-accessibility-and-stress.png', title: 'Accessibility and stress',
    sub: 'Increase Contrast, 200% text, keyboard focus on the new controls, and a 360 px device. Speaker distinction survives every one of them; every control stays ≥ 44 px, named, and reachable.',
    rows: [[fig({ src: S('a11y-01-contrast-more'), w: 280, caption: '<b>Increase Contrast.</b> The slab gains its inward boundary.' }), fig({ src: S('a11y-02-contrast-more-light'), w: 280, caption: '<b>Increase Contrast, Light.</b>' }),
      fig({ src: S('a11y-03-text-200'), w: 280, caption: '<b>200% text.</b> The slab reflows; the lane stays open.' }), fig({ src: S('a11y-05-focus-replay'), w: 280, caption: '<b>Focus — Replay.</b> The detached E1 perimeter.' }),
      fig({ src: S('a11y-06-focus-call'), w: 280, caption: '<b>Focus — Live Call.</b>' })],
    [fig({ src: S('a11y-07-focus-end-call'), w: 280, caption: '<b>Focus — end call</b>, in the Analysis.' }), fig({ src: S('a11y-08-compact-360'), w: 259, caption: '<b>360 × 780.</b>' }), fig({ src: S('a11y-09-compact-360-call'), w: 259, caption: '<b>360 × 780, during a call.</b>' }),
      notes('What is verified here, and what is not', ['Verified in Chrome: accessible names and Label-in-Name for every control (B06, B07); 44 × 44 targets at 100% and 200% (B08); speaker labels «كلامك» / «قنديل» before every turn, including voice notes and the opener (R3-12a); keyboard reach for each mode\'s controls and Replay (R3-12b); Escape unwinding without ending a call.', '<b>Not verified:</b> VoiceOver / TalkBack on real devices, Android per-Text direction in React Native, OLED behaviour of the one-tone step. These stay a device gate.'])]],
  },
];

export async function renderBoards(defs = BOARD_DEFS()) {
  const b = await launch({ port: 9348 });
  const done = [];
  try {
    for (const d of defs) {
      const html = board(d);
      const hf = join(BOARDS, d.file.replace(/[\\/]/g, '__').replace('.png', '.html'));
      writeFileSync(hf, html);
      await b.viewport({ width: 1900, height: 1200, dpr: 1, mobile: false });
      await b.goto(url(hf));
      await b.eval(`Promise.all([...document.images].map(i=>i.decode?i.decode().catch(()=>0):0)).then(()=>document.fonts.ready)`);
      const dims = await b.eval(`({w:Math.ceil(document.body.getBoundingClientRect().width),h:Math.ceil(document.body.getBoundingClientRect().height),broken:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src)})`);
      if (dims.broken.length) throw new Error(`${d.file}: broken images ${dims.broken.join(', ')}`);
      const W = Math.max(dims.w, 960), H = Math.max(dims.h, 400);
      await b.viewport({ width: W, height: H, dpr: 1, mobile: false });
      await b.eval(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
      const again = await b.eval(`({w:Math.ceil(document.body.getBoundingClientRect().width),h:Math.ceil(document.body.getBoundingClientRect().height)})`);
      if (again.w > W || again.h > H) throw new Error(`${d.file}: content overflows the capture`);
      const out = join(BOARDS, d.file);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, await b.shot());
      done.push({ file: d.file, w: W, h: H });
    }
  } finally { await b.close(); }
  return done;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  console.log(JSON.stringify(await renderBoards(), null, 0));
}
