// G1.2 — review boards. Review chrome is English and neutral; everything inside a phone frame is the prototype's
// own raster, never redrawn. Boards render at 1x; the 780 × 1688 screens ship beside them; crops are cut from the
// same rasters. Motion frames are the recorded frames themselves.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, encode, crop } from '../vendor/png.mjs';
import { launch } from './cdp.mjs';
import { JOURNEYS, SETTLE_MS } from './motion.mjs';
import { COPY } from '../src/content.mjs';

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
const FR = (journey, ms, rm = false) => join(MOT, `${journey}-ar${rm ? '-reduced-motion' : ''}`, `f${String(Math.round((ms / 1000) * 60)).padStart(4, '0')}.png`);
const EV = (j, act, n = 0) => JOURNEYS[j].events.filter((e) => e.act === act)[n].at;
function cropCss(src, name, x0, y0, x1, y1) {
  const img = decode(readFileSync(src));
  const p = join(CROPS, `${name}.png`);
  writeFileSync(p, encode(crop(img, x0 * 2, y0 * 2, (x1 - x0) * 2, (y1 - y0) * 2)));
  return p;
}
const LINE = (n, y0 = 610) => cropCss(S(n), `line-${n}`, 0, y0, 390, 760);
const A = COPY.ar;

const FONT_URL = url(join(WORK, 'vendor', 'Estedad-wght-v8.5.woff2'));
const CSS = `@font-face{font-family:Estedad;src:url(${FONT_URL}) format('woff2');font-weight:100 900}
*{box-sizing:border-box;margin:0;padding:0}
html{background:#161616}
body{background:#161616;color:#d6d6d6;font:14px/1.55 system-ui,'Segoe UI',sans-serif;padding:36px 40px 44px;width:max-content;min-width:960px}
h1{font-size:24px;font-weight:600;color:#f0f0f0;margin-bottom:4px}
.sub{color:#a8a8a8;max-width:1320px;margin-bottom:24px}
.row{display:flex;gap:24px;align-items:flex-start}
.row > *{flex-shrink:0}
figure{display:flex;flex-direction:column;gap:9px}
figure img{display:block;border-radius:22px;box-shadow:0 0 0 1px #2c2c2c}
figure img.flat{border-radius:6px}
figcaption{font-size:13px;color:#bdbdbd;max-width:var(--w)}
figcaption b{color:#ececec;font-weight:600}
.notes{width:400px;font-size:13.5px;color:#c4c4c4}
.notes h2{font-size:14px;color:#ededed;margin:0 0 6px}
.notes li{margin-bottom:7px}
.notes ul{padding-left:18px}
.ar{font-family:Estedad,system-ui;direction:rtl;unicode-bidi:isolate}
bdi.ar{white-space:nowrap}
.tag{display:inline-block;font-size:11px;font-weight:600;padding:1px 7px;border-radius:4px;margin-right:6px;background:#24382a;color:#b4e6c0}
.tag.gap{background:#3a3424;color:#eadcaa}.tag.os{background:#2c2c3a;color:#c8c8f0}.tag.cand{background:#382a24;color:#f0c8b0}
.foot{margin-top:26px;color:#8f8f8f;font-size:12px;max-width:1400px}
.arrow{align-self:center;color:#777;font-size:28px;padding:0 2px}
`;
const fig = ({ src, w = 300, caption, flat = false }) => `<figure style="--w:${w}px"><img class="${flat ? 'flat' : ''}" src="${url(src)}" width="${w}"><figcaption>${caption}</figcaption></figure>`;
const notes = (title, items) => `<div class="notes"><h2>${esc(title)}</h2><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul></div>`;
const col = (...parts) => `<div style="display:flex;flex-direction:column;gap:14px">${parts.join('')}</div>`;
const arrow = '<div class="arrow">→</div>';
const isolate = (html) => html.replace(/«[^»<]*»/g, (m) => `<bdi class="ar">${m}</bdi>`);
function board({ title, sub, rows, foot = '' }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${CSS}</style></head><body>
<h1>${isolate(esc(title))}</h1><p class="sub">${isolate(sub)}</p>${rows.map((r) => `<div class="row" style="margin-bottom:24px">${isolate(r.join(''))}</div>`).join('')}
${foot ? `<p class="foot">${isolate(foot)}</p>` : ''}</body></html>`;
}

export const BOARD_DEFS = () => [
  {
    file: 'G12-00-at-a-glance.png', title: 'G1.2 — Voice + Live Conversation, background-safe: at a glance',
    sub: 'Every phone is the prototype\'s own capture (Arabic, dark, 390 × 844). Three ways of talking in one Conversation: Writing and Voice Note stay in the Conversation; a Live Call opens the Analysis; the call survives the lock and another app, and returns to the exact surface the reader left.',
    rows: [[fig({ src: S('writ-02-idle-three-ways'), w: 232, caption: '<b>Writing.</b> One line; the microphone (Voice Note) and the handset (Live Call) at its end.' }),
      fig({ src: S('vn-05-committed-in-history'), w: 232, caption: '<b>Voice Note, committed.</b> The reader\'s UTTERANCE on the right: play, 0:14, «رسالة صوتية». No transcript, no waveform.' }),
      fig({ src: S('lc-03-reader-speaking'), w: 232, caption: '<b>Live Call — Analysis-first.</b> The Analysis is the hero; the call is the one line.' }),
      fig({ src: S('lc-05-conversation-same-call'), w: 232, caption: '<b>«المحادثة» during the call.</b> Same call, same line.' }),
      fig({ src: S('bg-01-locked-while-analysis'), w: 232, caption: '<span class="tag os">OS-OWNED</span><b>Locked.</b> A labelled schematic — QANDEEL draws none of it.' }),
      fig({ src: S('bg-02-returned-same-analysis'), w: 232, caption: '<b>Return.</b> The same Analysis, the same call, 48 s later.' }),
      fig({ src: S('pf-04-call-failed-writing'), w: 232, caption: '<b>Failed.</b> «المكالمة وقفت. الكتابة متاحة.» No live control remains.' })]],
  },
  {
    file: 'writing/G12-01-writing-and-the-three-ways.png', title: 'Proofs 1–2 — Writing, and the three ways of talking without a toolbar',
    sub: 'The G1.1 line is unchanged: Writing IS the line. Voice Note and Live Call are two icon controls at its end — different shapes, different names, different places, different outcomes. The line becomes the voice note\'s capture, then the call; it is the same object in every mode.',
    rows: [[fig({ src: S('writ-02-idle-three-ways'), caption: '<b>Idle — proof 2.</b> «كلامك هنا» · handset «مكالمة صوتية» · microphone «رسالة صوتية». 44 px targets, 8 px apart.' }),
      fig({ src: S('writ-01-writing-ar'), caption: '<b>Writing — proof 1.</b> With text in the line the microphone becomes Send; the handset stays.' }),
      fig({ src: S('writ-03-new-conversation-opener'), caption: '<b>A new conversation.</b> The G1.1 opener, unchanged; the three ways are there from the first moment.' }),
      col(fig({ src: LINE('writ-02-idle-three-ways', 680), w: 520, flat: true, caption: '<b>Writing.</b>' }),
        fig({ src: LINE('vn-02-capture-active', 680), w: 520, flat: true, caption: '<b>Voice Note capture.</b> «بسجّل» · time · the level · cancel · send.' }),
        fig({ src: LINE('lc-03-reader-speaking', 680), w: 520, flat: true, caption: '<b>Live Call.</b> The call\'s words · time · the microphone level · speaker · mute · end.' }),
        fig({ src: LINE('lc-04-qandeel-speaking', 680), w: 520, flat: true, caption: '<b>Live Call, QANDEEL speaking.</b> The microphone line lies flat; the words say who has the audio.' }))],
    [notes('Why this reads as "type, record, or talk live" (Q2)', [
      '<b>Two glyphs that are not the same object:</b> a microphone (record a message) and a handset (a call). Check <b>G12-Q2</b> requires different names, shapes and places, and different outcomes: the microphone keeps the Conversation, the handset opens the Analysis. A planted "same name, same glyph" is rejected.',
      '<b>Not a telecom dashboard:</b> no labels row, no mode switcher, no overflow. During a call the line gains exactly three controls (speaker, mute, end), all 44 px.',
      '<b>Not an ambiguous microphone:</b> a voice note never opens a call; a call never records a note.',
    ]), notes('What is inherited unchanged from G1.1 (closed / frozen)', ['The slab (UTTERANCE), the speaker sides, the opener, «تحليل المحادثة» / «المحادثة», Replay in the upper chrome, the count-neutral rail — checks G12-01…04 and G12-BI.'])]],
  },
  {
    file: 'voice-note/G12-02-voice-note-states.png', title: 'Proofs 3–8 — Voice Note: Conversation-first, a committed UTTERANCE, nothing invented',
    sub: 'The ten Voice Note states of brief §15. Recording never moves the reader. The committed note carries only what the capture truly knows — that it is a voice message and how long it is. Leaving QANDEEL mid-capture STOPS the capture into an unsent draft (recommendation R-VN).',
    rows: [[fig({ src: S('writ-02-idle-three-ways'), w: 250, caption: '<b>1 · Affordance.</b> The microphone at the line\'s end.' }),
      fig({ src: S('vn-01-permission-intent'), w: 250, caption: '<span class="tag os">OS-OWNED</span><b>2 · Permission intent.</b> The OS asks at the first tap, never at launch; QANDEEL supplies only the purpose string.' }),
      fig({ src: S('vn-02-capture-active'), w: 250, caption: '<b>3 · Capture.</b> «بسجّل» — TRUE here: a note is captured until sent or discarded.' }),
      fig({ src: S('vn-03-capture-elapsed-long'), w: 250, caption: '<b>4 · Elapsed.</b> 1:14, tabular digits; the level runs from the pen.' }),
      fig({ src: S('vn-04-cancel-focused'), w: 250, caption: '<b>5 · Cancel.</b> «إلغاء التسجيل» (focused): discards; the history is unchanged (G12-VN).' })],
    [fig({ src: S('vn-05-committed-in-history'), w: 250, caption: '<b>6–7 · Sent / in history.</b> The reader\'s slab on the RIGHT edge; play · track · 0:14 · «رسالة صوتية».' }),
      fig({ src: S('vn-06-playback'), w: 250, caption: '<b>8 · Playback.</b> Pause glyph; the track fills with real elapsed time (5.2 / 14 s).' }),
      fig({ src: S('vn-07-draft-after-leaving'), w: 250, caption: '<b>Leaving mid-capture (R-VN).</b> «توقّف التسجيل عند الخروج من قنديل» — in full, in the strip; send or discard.' }),
      fig({ src: S('pf-01-mic-denied-writing'), w: 250, caption: '<b>10 · Denied → Writing.</b> «الميكروفون غير متاح لقنديل. الكتابة متاحة.» + «فتح الإعدادات».' }),
      notes('Truth boundaries (brief §15)', [
        '<span class="tag gap">NO TRANSCRIPT</span> None is shown: no speech runtime produces one (G12-10). G1.1\'s UTTERANCE wording anticipates "its committed textual representation" — decision <b>G12-J2</b>.',
        '<span class="tag gap">NO WAVEFORM</span> G1.1-R3\'s seeded waveform is removed: it was invented data wearing a semantic shape.',
        '<span class="tag gap">RUNTIME DEPENDENCY</span> Playback from history needs a durable Personal audio object; <code>source_modality</code> is TEXT-only (dependency note §1).',
        '<b>9 · QANDEEL\'s voice reply:</b> QANDEEL\'s text turn plus a <span class="tag cand">CANDIDATE</span> «تشغيل رد قنديل» control (speech rendering is a dependency).',
        '<b>Not long-press:</b> tap to start, tap to send or cancel — no precision gesture (§15).',
      ])]],
  },
  {
    file: 'live-call/G12-03-live-call-analysis-first.png', title: 'Proofs 9–12 — Live Call: START is Analysis-first; every phase has words',
    sub: 'The reader talks to QANDEEL while seeing QANDEEL\'s understanding. The Analysis (G1.1 scaffold — G2 owns the spectacle) is the hero; the call lives in the one line. The picture never moves with sound: «سياق الكلام» changes only when a spoken turn COMMITS (G12-AN).',
    rows: [[fig({ src: S('lc-01-connecting'), w: 280, caption: '<b>9 · Connecting.</b> «جاري الاتصال»; the Analysis already on screen; mute and end reachable.' }),
      fig({ src: S('lc-02-analysis-first'), w: 280, caption: '<b>10 · Analysis-first, live.</b> «الميكروفون شغّال» — a mechanical state, not «بسمعك».' }),
      fig({ src: S('lc-03-reader-speaking'), w: 280, caption: '<b>11 · The reader speaking.</b> The line draws the microphone\'s level.' }),
      fig({ src: S('lc-04-qandeel-speaking'), w: 280, caption: '<b>12 · QANDEEL\'s audio.</b> «قنديل بيتكلم»; the microphone line lies flat. QANDEEL\'s voice is never drawn as a meter.' }),
      notes('What the call shows, and what it refuses (§20, §26–27)', [
        '<b>Words for every phase</b> — connecting · microphone on · QANDEEL speaking · muted · reconnecting · failed — all <span class="tag gap">OPEN</span> VI-01 §14 wording; none says "Recording", "Listening" or "Thinking" (G12-07, G12-08).',
        '<b>Refused:</b> an orb, a glow, a gradient, an equalizer, Brass as "call active", red as "recording" (G12-05).',
        '<b>ACTIVITY IS PROCESS</b> (the microphone line) · <b>LIGHT IS MEANING</b> (the Analysis, unchanged by sound) · <b>BRASS IS MATTER</b> (rail only) · <b>MOTION EXPLAINS CONTINUITY</b> (only the depth change moves).',
        '<b>«سياق الكلام»</b> (VI-01 approved) names the reading the latest committed spoken turn brought into play — always a reading drawn in the fixture world, never an invented relation.',
      ])]],
  },
  {
    file: 'live-call/G12-04-live-call-controls-conversation-replay.png', title: 'Proofs 13–14, 21 — the same call across depths; controls; Replay; ending',
    sub: '«المحادثة» opens the Conversation without ending the call; «تحليل المحادثة» returns to the same call (journey B keeps one call id throughout). Controls are minimal and support the Analysis: speaker, mute, end. Replay keeps its G1.1 place and never implies the live call is included.',
    rows: [[fig({ src: S('lc-05-conversation-same-call'), w: 260, caption: '<b>13 · Conversation, same call.</b> A quiet «مكالمة صوتية بدأت» marker; the line has not moved.' }),
      fig({ src: S('lc-06-muted'), w: 260, caption: '<b>Muted.</b> Slashed microphone + «الميكروفون مكتوم»; <code>aria-pressed</code>.' }),
      fig({ src: S('lc-07-speaker-off'), w: 260, caption: '<span class="tag cand">CANDIDATE</span><b>Speaker off.</b> Outline speaker (ON = filled); default ON — an Analysis-first call is watched, not held to the ear (G12-J4).' }),
      fig({ src: S('lc-08-replay-during-call'), w: 260, caption: '<b>Replay during a call.</b> Same place; «المكالمة الجارية غير مشمولة.» (G12-R1).' }),
      fig({ src: S('lc-09-barge-in-candidate'), w: 260, caption: '<span class="tag cand">CANDIDATE</span><b>Speaking over QANDEEL.</b> QANDEEL\'s audio stops; the microphone carries the reader.' }),
      fig({ src: S('lc-10-ended-conversation'), w: 260, caption: '<b>21 · Ended by the reader.</b> The record «مكالمة صوتية · 3:12»; Writing, Voice Note and a new call available.' })],
    [notes('Interruption (§21)', ['The Foundation Freeze fixes the principle: "User interruption is a first-class realtime event"; QANDEEL "yield[s] immediately to interruption". Detection, what the interrupted turn becomes, and its display are an <b>OPEN RUNTIME DEPENDENCY</b>; the one screen above is a marked candidate, not frozen.']),
      notes('Replay (§28)', ['Replay binds committed material only; Personal call audio is NOT PRODUCIBLE and an open Live Head cannot be frozen (replay-runtime-v1 §7, §19). The call\'s markers are not selectable Replay turns.']),
      notes('What the call leaves behind (G12-J7)', ['Only that a call happened and how long it ran (and «وقفت» if the reader did not end it). Whether spoken turns appear as text, and with what provenance, is a runtime decision.'])]],
  },
  {
    file: 'background-restore/G12-05-background-and-exact-restore.png', title: 'Proofs 15–18 — the call continues in the background; return restores the EXACT last surface',
    sub: 'START = Analysis-first. RETURN = the last truthful in-call surface. Locking the phone while the Analysis is on screen returns to the Analysis; opening another app while the Conversation is on screen returns to the Conversation — not a reset to the Analysis. Same call id, same Conversation id, one call session (G12-Q4Q5, journey C).',
    rows: [[fig({ src: S('lc-03-reader-speaking'), w: 250, caption: '<b>Before — Analysis.</b> call-3f9bb7 · 1:22.' }), arrow,
      fig({ src: S('bg-01-locked-while-analysis'), w: 250, caption: '<span class="tag os">OS-OWNED</span><b>15 · Locked.</b> The call continues; the schematic names the OS surfaces production shows.' }), arrow,
      fig({ src: S('bg-02-returned-same-analysis'), w: 250, caption: '<b>16 · Returned — the same Analysis.</b> call-3f9bb7 · 2:10 (48 s later); «سياق الكلام» moved on with the turns committed while away.' }),
      fig({ src: S('lc-05-conversation-same-call'), w: 250, caption: '<b>Before — Conversation</b> (opened during the call), 1:26.' }), arrow,
      fig({ src: S('bg-03-other-app-while-conversation'), w: 250, caption: '<span class="tag os">OS-OWNED</span><b>17 · Another app.</b>' }), arrow,
      fig({ src: S('bg-04-returned-same-conversation'), w: 250, caption: '<b>18 · Returned — the same Conversation</b>, not the Analysis. «تحليل المحادثة» returns to the same call.' })],
    [fig({ src: S('bg-05-ended-while-away-returned'), w: 250, caption: '<b>The call ended while away.</b> No in-call surface exists, so none is restored: the Conversation, V07, Writing — and no live control.' }),
      fig({ src: S('bg-06-relaunch-after-force-quit'), w: 250, caption: '<b>Force-quit, relaunch.</b> No call, no controls, no invented record (brief §4: no survival after force-quit is promised).' }),
      notes('Product-owned vs OS-owned (§19)', [
        '<b>Product-owned:</b> the in-app before / after states — which surface, which call, what the line says.',
        '<b>OS-owned (drawn only as a labelled schematic):</b> the lock screen, the system call UI (CallKit, recommended), the microphone indicator, Android\'s ongoing-call notification with Hang up (transparency, not a defect), Task Manager, the route picker.',
        '<b>Return paths:</b> the app icon, recents, the call notification / system call UI — all land on the same restore rule.',
      ]), notes('How production keeps the rule (compliance note §6, dependency note §3)', [
        'One in-process call controller owns call id, Conversation id, mute, route and the last surface; background / foreground never write the surface.',
        'iOS: <code>playAndRecord</code> / <code>voiceChat</code>, <code>audio</code> background mode, CallKit outgoing. Android: <code>RECORD_AUDIO</code> at intent, Core-Telecom, foreground service started while visible, CallStyle notification.',
        'No background work except the call\'s audio; the Analysis catches up on return (T-12P foreground-only).',
      ])]],
  },
  {
    file: 'permissions-failure/G12-06-permissions-and-failure.png', title: 'Proofs 8, 19–20 — permission and failure: truthful recovery, Writing always available',
    sub: 'The microphone is asked for at the moment of intent, through the OS. Denial keeps the reader in the Conversation with the alternative named. A network drop is named; a recovered call is the same call; a failed reconnection, or a call that ended while away, returns to the Conversation with Writing — and never with a live control.',
    rows: [[fig({ src: S('pf-02-call-permission-intent'), w: 270, caption: '<span class="tag os">OS-OWNED</span><b>Call intent, first time.</b> Nothing starts until the OS is answered.' }),
      fig({ src: S('pf-01-mic-denied-writing'), w: 270, caption: '<b>8 · Denied.</b> The Conversation, the notice, «فتح الإعدادات», the writing line. A later tap does not nag (G12-P1).' }),
      fig({ src: S('pf-03-reconnecting'), w: 270, caption: '<b>19 · Reconnecting.</b> V06 «الاتصال انقطع. جاري إعادة الاتصال.» in full (the strip); no live level; end reachable.' }),
      fig({ src: S('pf-04-call-failed-writing'), w: 270, caption: '<b>20 · Failed → Writing.</b> V07; the record «… · وقفت»; every committed turn kept; no call control.' }),
      fig({ src: S('bg-05-ended-while-away-returned'), w: 270, caption: '<b>Ended while away → return.</b> The same truth.' })],
    [notes('What "truthful" means here (Q10)', ['A call that no longer exists never shows mute / speaker / end (G12-Q10, a planted "controls survive" is rejected).', '"No false data loss": the Conversation keeps every committed turn; the notice claims nothing about what was or was not saved.', 'Process-framed, impersonal T4: «الاتصال انقطع», «المكالمة وقفت» — never «فقدتك» (VI-01 §14.4).']),
      notes('Rule proposed for review (G12-J3)', ['An end the reader CHOSE leaves them where they are (G1.1). An end they did NOT choose returns them to the Conversation, where the named alternative — Writing — is on screen. The alternative is reachable, not just named.'])]],
  },
  {
    file: 'bilingual/G12-07-arabic-and-english.png', title: 'Proofs 22–23 — Arabic (USER RIGHT) and English (USER LEFT), mixed script',
    sub: 'Speaker geometry is inherited from G1.1: the reader\'s turns — text and voice note — on the reader\'s own edge; QANDEEL opposite; paragraph direction independent of side. English carries the same control hierarchy, the same background continuation and the same restoration rule.',
    rows: [[fig({ src: S('bi-01-arabic-mixed-script'), w: 250, caption: '<b>22 · Arabic mixed script.</b> A Latin-first Arabic sentence, a pasted English line and a voice note — all on the RIGHT edge.' }),
      fig({ src: S('bi-02-arabic-mixed-during-call'), w: 250, caption: '<b>Mixed script during a call.</b>' }),
      fig({ src: S('bi-03-en-idle'), w: 250, caption: '<b>23 · English, idle.</b> Controls mirrored at the line\'s end.' }),
      fig({ src: S('bi-04-en-voice-committed'), w: 250, caption: '<b>English voice note</b> — on the LEFT edge.' }),
      fig({ src: S('bi-05-en-capture'), w: 250, caption: '<b>English capture.</b> "Recording".' }),
      fig({ src: S('bi-06-en-analysis-first'), w: 250, caption: '<b>English, Analysis-first.</b> "Qandeel is speaking"; "In play" (VI-01: EN wording open).' })],
    [fig({ src: S('bi-07-en-conversation-same-call'), w: 250, caption: '<b>English, Conversation, same call.</b>' }),
      fig({ src: S('bi-08-en-background'), w: 250, caption: '<b>English, locked.</b>' }),
      fig({ src: S('bi-09-en-mic-denied'), w: 250, caption: '<b>English, denied.</b>' }),
      fig({ src: S('bi-10-en-call-failed'), w: 250, caption: '<b>English, failed.</b> "The call isn\'t working. You can keep going in writing."' }),
      fig({ src: S('bi-11-en-reconnecting'), w: 250, caption: '<b>English, reconnecting</b> — in full, in the strip.' }),
      notes('Direction rules applied', ['The voice-note media row reads left-to-right in both scripts (a media timeline is not mirrored); its slab stays on the reader\'s edge.', 'Glyphs: back is mirrored; play, pause, handset, microphone, speaker and Replay are not.', 'The Analysis scaffold\'s labels are the Arabic fixture world in both UIs (G1.1 scaffold); G2 owns the bilingual Analysis.'])]],
  },
  {
    file: 'light/G12-08-light-sanity.png', title: 'Proof 24 — Light appearance sanity check',
    sub: 'The same states in Light (F2R). The UTTERANCE slab, the call line, the notice and the strip are the one functional Surface tone; the Analysis is the Light fixture world.',
    rows: [[fig({ src: S('light-01-voice-committed'), w: 280, caption: '<b>Voice note committed.</b>' }), fig({ src: S('light-02-capture'), w: 280, caption: '<b>Capture.</b>' }),
      fig({ src: S('light-03-analysis-first'), w: 280, caption: '<b>Analysis-first.</b>' }), fig({ src: S('light-04-conversation-same-call'), w: 280, caption: '<b>Conversation, same call.</b>' }),
      fig({ src: S('light-05-call-failed'), w: 280, caption: '<b>Failed → Writing.</b>' })]],
  },
  {
    file: 'motion/G12-09-journeys-A-B-C.png', title: 'Motion — journeys A (Voice Note), B (Live Call foreground), C (background / restore): standard vs Reduced Motion',
    sub: `Frames ${SETTLE_MS} ms after acts, from the recordings. Top row of each pair: standard; bottom: Reduced Motion. Reduced Motion removes travel (the lift / rise of the depth change) and the level drawing; it removes no state and no control — G12-M1 compares the prototype's own truth record at every act in all six journeys.`,
    rows: [
      [['A-voice-note', 'allow', 'A · allowed → capture'], ['A-voice-note', 'notesend', 'A · sent'], ['B-live-call-foreground', 'call', 'B · call → Analysis'], ['B-live-call-foreground', 'leave', 'B · «المحادثة»'], ['B-live-call-foreground', 'enter', 'B · «تحليل المحادثة»'], ['B-live-call-foreground', 'endcall', 'B · ended']]
        .map(([j, a, c]) => fig({ src: FR(j, EV(j, a) + SETTLE_MS), w: 210, caption: `<b>${c}</b> — standard` })),
      [['A-voice-note', 'allow', 'A · allowed → capture'], ['A-voice-note', 'notesend', 'A · sent'], ['B-live-call-foreground', 'call', 'B · call → Analysis'], ['B-live-call-foreground', 'leave', 'B · «المحادثة»'], ['B-live-call-foreground', 'enter', 'B · «تحليل المحادثة»'], ['B-live-call-foreground', 'endcall', 'B · ended']]
        .map(([j, a, c]) => fig({ src: FR(j, EV(j, a) + SETTLE_MS, true), w: 210, caption: `<b>${c}</b> — Reduced Motion` })),
      [['bg', 0, 'C · locked'], ['fg', 0, 'C · back → Analysis'], ['leave', 0, 'C · «المحادثة»'], ['bgapp', 0, 'C · another app'], ['fg', 1, 'C · back → Conversation'], ['enter', 0, 'C · same call']]
        .map(([a, n, c]) => fig({ src: FR('C-background-restore', EV('C-background-restore', a, n) + SETTLE_MS), w: 210, caption: `<b>${c}</b> — standard` })),
      [['bg', 0, 'C · locked'], ['fg', 0, 'C · back → Analysis'], ['leave', 0, 'C · «المحادثة»'], ['bgapp', 0, 'C · another app'], ['fg', 1, 'C · back → Conversation'], ['enter', 0, 'C · same call']]
        .map(([a, n, c]) => fig({ src: FR('C-background-restore', EV('C-background-restore', a, n) + SETTLE_MS, true), w: 210, caption: `<b>${c}</b> — Reduced Motion` })),
      [fig({ src: FR('B-live-call-foreground', EV('B-live-call-foreground', 'call') + 150), w: 210, caption: '<b>Mid-transition, standard</b> (+150 ms): the Conversation lifts, the Analysis rises.' }),
        fig({ src: FR('B-live-call-foreground', EV('B-live-call-foreground', 'call') + 150, true), w: 210, caption: '<b>Mid-transition, Reduced Motion</b> (+150 ms): a 140 ms resolve, no travel.' }),
        notes('Motion discipline', ['No new duration, no new curve (G12-06): the depth change is G1.1\'s lift / rise; the line is G1.1\'s 220 ms.', 'Return from the background is NOT animated: the surface is the one the reader left, so nothing moves (an animation would imply a change).', 'OS-owned surfaces (prompt, lock) appear instantly — the OS draws them.', 'Nothing loops: no breathing, no pulse, no ripple on the call.'])],
    ],
  },
  {
    file: 'motion/G12-10-journeys-D1-D2-D3.png', title: 'Motion — journeys D1 (permission denied), D2 (network interruption), D3 (ended while away)',
    sub: 'Failure journeys, standard (top) and Reduced Motion (bottom). D1 contains no travel at all (every change is instant), so its two recordings are frame-identical — and its truth records identical, as G12-M1 requires of every journey.',
    rows: [
      [['D1-permission-denied', 'call', 'D1 · OS prompt'], ['D1-permission-denied', 'deny', 'D1 · denied → Writing'], ['D1-permission-denied', 'sendtext', 'D1 · written'], ['D2-network-interruption', 'drop', 'D2 · reconnecting'], ['D2-network-interruption', 'recover', 'D2 · same call'], ['D2-network-interruption', 'fail', 'D2 · failed → Writing'], ['D3-ended-while-away', 'fg', 'D3 · back, ended']]
        .map(([j, a, c]) => fig({ src: FR(j, EV(j, a) + SETTLE_MS), w: 200, caption: `<b>${c}</b> — standard` })),
      [['D1-permission-denied', 'call', 'D1 · OS prompt'], ['D1-permission-denied', 'deny', 'D1 · denied → Writing'], ['D1-permission-denied', 'sendtext', 'D1 · written'], ['D2-network-interruption', 'drop', 'D2 · reconnecting'], ['D2-network-interruption', 'recover', 'D2 · same call'], ['D2-network-interruption', 'fail', 'D2 · failed → Writing'], ['D3-ended-while-away', 'fg', 'D3 · back, ended']]
        .map(([j, a, c]) => fig({ src: FR(j, EV(j, a) + SETTLE_MS, true), w: 200, caption: `<b>${c}</b> — Reduced Motion` })),
    ],
  },
  {
    file: 'accessibility/G12-11-accessibility.png', title: 'Accessibility — words for every state, 200% text, contrast, focus, Reduced Motion',
    sub: 'Call state is never carried by motion or colour alone. Every call phase has words; when the line cannot hold them (a long system sentence, or large text) they stand in full in a strip above the line — the defect found and fixed in this task (G12-Q11a). Every control is named, 44 px, and shows its state by shape.',
    rows: [[fig({ src: S('a11y-03-text-200-call-line'), w: 250, caption: '<b>200% text, call.</b> «قنديل بيتكلم» in the strip; time, level and controls on the line.' }),
      fig({ src: S('a11y-04-text-200-reconnecting'), w: 250, caption: '<b>200%, reconnecting.</b> V06 in full.' }),
      fig({ src: S('a11y-05-text-200-voice'), w: 250, caption: '<b>200%, voice notes.</b>' }),
      fig({ src: S('a11y-01-contrast-more-call'), w: 250, caption: '<b>Increase Contrast, call.</b>' }),
      fig({ src: S('a11y-02-contrast-more-voice'), w: 250, caption: '<b>Increase Contrast, Light.</b>' })],
    [fig({ src: S('a11y-06-focus-end-call'), w: 250, caption: '<b>Focus — end call.</b> The E1 perimeter.' }),
      fig({ src: S('a11y-07-focus-mic'), w: 250, caption: '<b>Focus — Voice Note.</b>' }),
      fig({ src: S('a11y-08-compact-360-call'), w: 231, caption: '<b>360 × 780, call.</b>' }),
      fig({ src: S('a11y-09-reduced-motion-reader-speaking'), w: 250, caption: '<b>Reduced Motion, the reader speaking.</b> The level line is drawn flat; «الميكروفون شغّال» still says it.' }),
      notes('Verified here, and not', ['<b>Verified in Chrome:</b> names + 44 px + pressed state for every call control (G12-Q11b); words for all five call phases at 100% and 200%, Arabic and English (G12-Q11a); Escape never ends a call (G12-Q11c); a deaf reader has the words, the time and the controls to navigate, end and recover.', '<b>OS surfaces</b> are acknowledged, not replaced by inaccessible custom UI.', '<b>Not verified:</b> VoiceOver / TalkBack on real devices, the OS call UI\'s own accessibility, Dynamic Type on device.'])]],
  },
];

export async function renderBoards(defs = BOARD_DEFS()) {
  const b = await launch({ port: 9458 });
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
