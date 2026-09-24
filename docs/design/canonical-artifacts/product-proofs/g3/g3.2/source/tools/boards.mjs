// G3.2 review boards — the smallest set that proves the two decisions and their critical non-regressions (brief §11).
// Phones show Product pixels only (captures of the rebuilt prototype, or of G3.1's byte-identical rebuild where a
// board compares). Every diagnostic — captions, the measured column strips, distances — sits OUTSIDE the phones.
// usage: node tools/boards.mjs [--only 01,08]   → <PKG>/boards/NN-*.png and <PKG>/data/BOARDS.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './lib/cdp.mjs';
import { serveDir, WORK, PKG, closeServers, settle } from './lib/session.mjs';

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const IDX = JSON.parse(readFileSync(join(WORK, 'snaps', 'index.json'), 'utf8'));
const TRUTH = (clip) => JSON.parse(readFileSync(join(PKG, 'data', 'motion', `${clip}.truth.json`), 'utf8'));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/«[^»]*»/g, (m) => `<bdi>${m}</bdi>`);
const BD = join(WORK, 'boards-html'); mkdirSync(BD, { recursive: true }); mkdirSync(join(PKG, 'boards'), { recursive: true });
const snap = (id) => { const r = IDX[id]; if (!r) throw new Error('missing snap ' + id); return r; };

function tag(r) {
  const p = [r.build === 'g31' ? 'G3.1 baseline (rebuilt byte-identically)' : 'G3.2', `${r.w}×${r.h}`, r.lang === 'ar' ? 'Arabic device' : 'English device', `system ${r.scheme === 'light' ? 'Light' : 'Dark'}`];
  if (r.rm) p.push('Reduced Motion');
  if (r.build === 'g31' && r.scheme === 'light') p.push(`G3.1 harness fixture ${r.shell}`);
  return p.join(' · ');
}
function tile({ src, w, label, sub, strip = '', crop = null }) {
  const img = crop
    ? `<div class="ph crop" style="width:${crop.w * crop.s}px;height:${crop.h * crop.s}px"><img src="../${src}" style="width:${crop.W * crop.s}px;margin-left:${-crop.x * crop.s}px;margin-top:${-crop.y * crop.s}px"></div>`
    : `<div class="ph"><img src="../${src}" style="width:${w}px"></div>`;
  return `<figure><div class="pair">${img}${strip}</div><figcaption><b>${esc(label)}</b><i>${esc(sub)}</i></figcaption></figure>`;
}
const S = (id, label, o = {}) => { const r = snap(id); return tile({ src: `snaps/${id}.png`, w: r.w, label, sub: tag(r), strip: o.strip ? strip(id) : '' }); };
/** A magnified detail of a capture (still Product pixels, only enlarged): the temporal cluster. */
const D = (id, label, box, s = 2) => { const r = snap(id); return tile({ src: `snaps/${id}.png`, w: r.w, label, sub: `detail ×${s} of ${id} · ${tag(r)}`, crop: { ...box, W: r.w, s } }); };
const F = (clip, t, label) => {
  const tr = TRUTH(clip), frame = Math.round((t - 8) * tr.fps / 1000), tf = Math.round(frame * 1000 / tr.fps) + 8;
  if (frame < 0 || frame >= tr.frameCount) throw new Error(`t ${t} is outside ${clip}`);
  const w = +tr.size.split('x')[0] / 2, s = tr.frames.filter((x) => x.t <= tf).pop() || {};
  return tile({ src: `frames/${clip}/f${String(frame).padStart(4, '0')}.png`, w, label, sub: `${clip} · t = ${tf} ms${tr.reducedMotion ? ' · Reduced Motion' : ''} · system ${tr.scheme === 'light' ? 'Light' : 'Dark'}${s.callId ? ' · ' + s.callId : ''}` });
};

/* The measured column, drawn BESIDE the phone at the same scale (never on it). */
function parts(id) {
  const r = snap(id), a = r.audit, out = [];
  const tx = (re, where) => { const t = a.text.filter((x) => re.test(x.text) && (!where || x.where === where)); if (!t.length) return null; const y = Math.min(...t.map((x) => x.box.y)), b = Math.max(...t.map((x) => x.box.y + x.box.h)); return { y, h: b - y }; };
  const sentence = tx(/أنت عند اللحظة|Reading at moment|نظرة مؤقتة/);
  const act = tx(/العودة إلى المحادثة الجارية|Rejoin the conversation/, 'tl-live');
  const more = a.controls.find((c) => c.id === 'more-t');
  const tl = a.regions.timeline, top = 95;
  const worldEnd = Math.min(sentence && r.build === 'g32' ? sentence.y : Infinity, tl ? tl.y - 44 : Infinity);
  out.push({ t: 'World', y: top, h: worldEnd - top, c: '#5f8f7e' });
  if (sentence) out.push({ t: 'where in time', y: sentence.y, h: sentence.h, c: '#d9b35c' });
  if (act) out.push({ t: 'Return Live', y: act.y, h: act.h, c: '#cfcfcf' });
  if (tl) out.push({ t: 'Track', y: tl.y, h: tl.h, c: '#8e8e8e' });
  if (more) out.push({ t: 'Ways back', y: more.box.y, h: more.box.h, c: '#a98fd0' });   // Latin in the monospace strip (Arabic would not shape there)
  return { out, sentence, act };
}
function strip(id) {
  const r = snap(id), { out, sentence, act } = parts(id);
  const bands = out.map((p) => `<div class="bd" style="top:${p.y}px;height:${Math.max(2, p.h)}px;border-color:${p.c}"><span style="color:${p.c}">${esc(p.t)}</span></div>`).join('');
  const d = sentence && act ? Math.round(Math.abs((sentence.y + sentence.h / 2) - (act.y + act.h / 2))) : null;
  const between = sentence && act ? out.filter((p) => p.t === 'Track' && ((p.y > Math.min(sentence.y, act.y) && p.y < Math.max(sentence.y, act.y)))).length : 0;
  return `<div class="strip" style="height:${r.h}px">${bands}${d != null ? `<div class="dist">sentence ↔ Return Live: ${d} pt${between ? '<br>the Track sits between them' : '<br>nothing between them'}</div>` : ''}</div>`;
}

const cluster = (id) => { const r = snap(id), tl = r.audit.regions.timeline, band = r.audit.regions.band; const y = tl.y - 44 - 44; return { x: 0, y, w: r.w, h: (band ? band.y + band.h : tl.y + tl.h) - y + 6 }; };

export const BOARDS = [
  ['01-g31-vs-g32-pinned-comparison', 'PINNED(14): G3.1 separated the explanation from its act — G3.2 reconnects them to the Timeline', [
    'DIAGNOSTIC BOARD. Left pair: the reviewed G3.1 composition (rebuilt byte-identically from its sealed inputs). The act «العودة إلى المحادثة الجارية» sits at the Live edge ABOVE the Track, while the sentence that gives it meaning — «أنت عند اللحظة 14. استمرت المحادثة بعد هذه اللحظة.» — sits BELOW the Track in OrientationChrome: the reader meets the act before its reason.',
    'Right pair: G3.2 (Decision B). The same sentence, the same T-08 words, moves out of OrientationChrome into the Timeline cluster, directly above the Track: where in time → that it continued → the Live edge → how to return, in one local cluster. «طرق العودة» and every other Return act stay below, governed by the T-11 amendment. Nothing is said twice. The strips beside each phone are measured from the captures.'],
    () => [S('g31-pinned', 'G3.1 — PINNED(14)', { strip: true }), S('g31-pinned-open', 'G3.1 — «طرق العودة» open', { strip: true }), S('pinned', 'G3.2 — PINNED(14)', { strip: true }), S('pinned-open', 'G3.2 — «طرق العودة» open', { strip: true })]],
  ['02-ar-pinned-390', 'Arabic PINNED at 390 × 844 — settled', [
    'The world stays the hero and is replayed to Moment 14 only (no future ghosting: 0 px against G3.1 at the same state). The temporal line stands on the Timeline row\'s free top, its start aligned with the chrome\'s 24-pt start inset; the Live-edge act sits directly beneath it at the END edge, the Track below.',
    'English mirrors it: the line starts at the LEFT, the Live edge is at the RIGHT; the words are T-08\'s English.'],
    () => [S('pinned', 'PINNED(14)'), D('pinned', 'The cluster', cluster('pinned')), S('en-pinned', 'English — PINNED(14)')]],
  ['03-ar-pinned-return-ways-open', 'PINNED + «طرق العودة» expanded', [
    'Return Live stays directly visible at the Live edge, where the Product context owns it. «طرق العودة» discloses the other offered acts one activation away — «الرجوع خطوة واحدة», «العودة إلى العالم كله», «العودة إلى المحادثة والانتقال إلى موضعها» — in T-08\'s order and words. The temporal line does not move when the group opens.',
    'Visual order = focus order: Timeline → Live-edge act → «طرق العودة» → the disclosed acts. The line is text, read before the slider, never a focus stop.'],
    () => [S('pinned-open', '«طرق العودة» open'), S('focus-more', 'Keyboard: focus on «طرق العودة» (expanded)'), D('pinned-open', 'The cluster, open', cluster('pinned-open'))]],
  ['04-near-inspection-non-overfit', 'NEAR inspection — the refinement does not overfit PINNED', [
    'Following Live while inspecting, there is no temporal context, so there is no temporal row: OrientationChrome keeps G3.1\'s inspection line and its Return acts, and the Timeline sits exactly where G3.1 put it (compare the first two phones). The Return sets are T-08\'s, unchanged.',
    'After «العودة إلى المعاينة الأصلية» the restored checkpoint is a PINNED stance (G3.1 F-11, inherited), so the line appears — only its first sentence, because nothing continued after 14.'],
    () => [S('g31-near', 'G3.1 — NEAR · inspecting'), S('near', 'G3.2 — NEAR · inspecting'), S('near-open', 'G3.2 — «طرق العودة» open'), S('near-exact', 'After the exact return')]],
  ['05-live-follow-live-clean', 'LIVE / FOLLOW_LIVE — no stale sentence, no placeholder gap', [
    'After Return Live the reader follows Live again at 17: the line has resolved out, nothing holds its place, and the Timeline sits directly on OrientationChrome. The world takes back the room.',
    'A temporary look (a preview) is temporal context too: its own T-08 line stands in the same place while it lasts, and the preview\'s two acts stay in OrientationChrome.'],
    () => [S('pinned', 'PINNED(14)'), S('pinned-return-live', 'After Return Live — at 17'), S('preview', 'A temporary look at 15'), S('far', 'FAR · following Live')]],
  ['06-stress-320x568', '320 × 568 stress — the world keeps its floor; the line is paid for by the support', [
    'T-11 §3 sizes the world FIRST at ≥ max(160, usable / 2). The two-line temporal line is charged to the support before OrientationChrome gets its room; OrientationChrome scrolls inside what is left, and «طرق العودة» brings its disclosed acts into view. The primary meaning — the line and Return Live — is never inside the scroller.',
    'The densest state is a live call while PINNED: the world sits exactly at its 160-pt floor. English wraps the same way.'],
    () => [S('s320-pinned', 'PINNED', { strip: true }), S('s320-pinned-open', 'PINNED · open'), S('s320-call-pinned', 'In a call · PINNED', { strip: true }), S('s320-call-pinned-open', 'In a call · PINNED · open'), S('en-s320-call-pinned', 'English · in a call · PINNED')]],
  ['07-larger-phone-430x932', '430 × 932 — more of the same world; the support does not grow', [
    'The larger phone is a larger window onto the same world at the same scale. The temporal line, the Timeline and OrientationChrome keep exactly their 390-pt heights (measured), so the extra room all goes to the world: no dashboard, no bigger card.'],
    () => [S('pinned', '390 × 844', { strip: true }), S('l430-pinned', '430 × 932', { strip: true }), S('l430-pinned-open', '430 × 932 · open')]],
  ['08-system-light-surface-boundary', 'System Light — Conversation (light) → Analysis (dark shell) → Conversation (light)', [
    'Decision A. Under system Light the Conversation follows the system. «تحليل المحادثة» enters ONE dark immersive place: the Living Analysis World and its whole shell — status region, upper chrome, Timeline, OrientationChrome, rail, home indicator — so the status ink turns light and stays legible (no dark-on-dark). «المحادثة» returns to the system-Light Conversation.',
    'The tone change is F2\'s own appearance cross-fade, 200 ms (second phone: mid-fade), and it is REMOVED under Reduced Motion. It is surface-scoped: no app-wide dark mode, no appearance setting, no F2 token changed, no veil over the world.'],
    () => [F('03-light-conversation-analysis-conversation', 400, 'Conversation · Light'), F('03-light-conversation-analysis-conversation', 608, 'Mid cross-fade (≈ 100 ms)'), F('03-light-conversation-analysis-conversation', 1800, 'Analysis · dark shell'), F('03-light-conversation-analysis-conversation', 4400, 'Back · Light'), S('light-pinned', 'Analysis · PINNED · Light')]],
  ['09-system-light-live-call-boundary', 'System Light + a Live Call — Analysis (dark) → Conversation (light) → the same call in the Analysis (dark)', [
    'The call starts Analysis-first, in the dark Analysis shell; its call line belongs to that shell. «المحادثة» during the call opens the system-Light Conversation — call line included — without ending or replacing the call. «تحليل المحادثة» returns to the SAME call (one call id, see the captions) in the dark shell. No ordinary call-state prose appears; state goes to the one assistive channel.'],
    () => [F('04-light-live-call-analysis-conversation-analysis', 2400, 'Analysis · in the call'), F('04-light-live-call-analysis-conversation-analysis', 4400, 'Conversation · same call'), F('04-light-live-call-analysis-conversation-analysis', 7600, 'Analysis · same call'), S('s320-light-call-pinned', '320 × 568 · in the call · PINNED · Light')]],
  ['10-system-dark-non-regression', 'System Dark — no regression; and the G3.1 fixture-B failure is gone', [
    'Under system Dark everything is as in G3.1: the Conversation is dark, the Analysis is the same dark place. Under Light, the Analysis now renders the same dark shell as under Dark (the world alone is 0 px different).',
    'For reference only: G3.1\'s harness fixture B under Light left the status region\'s dark ink on the dark world. It is not a Product state any more — G3.2 has no shell fixture — and it is kept as a planted probe that the legibility gate rejects.'],
    () => [S('dark-conv', 'Conversation · Dark'), S('call', 'Analysis · in a call · Dark'), S('light-call', 'Analysis · in a call · Light'), S('g31-light-far-B', 'G3.1 fixture B · Light (eliminated)')]],
  ['11-accessibility-reading-order', 'Accessibility — reading order, focus, expanded state, targets', [
    'DOM order = reading order = visual order: … world region → the temporal line (text) → the Timeline slider → the Live-edge act → «طرق العودة» → the disclosed acts → call line → rail. The Live-edge act\'s box begins at its label row, so its focus ring never crosses the line above it. Every control is ≥ 44 × 44 pt and named; «طرق العودة» carries aria-expanded / aria-controls.',
    'Browser accessibility evidence only (headless Chrome, real CDP input): real VoiceOver / TalkBack validation remains a device gate.'],
    () => [S('focus-track', 'Focus on the Timeline'), S('focus-live-edge', 'Focus on the Live-edge act'), S('focus-more', 'Focus on «طرق العودة»'), S('en-pinned-open', 'English — «Ways back» open')]],
  ['12-reduced-motion-parity', 'Reduced Motion — the same truth and the same hierarchy, simpler motion', [
    'The same acts at the same instants. Standard motion: the line resolves in over 220 ms with the preview and out over 140 ms at Return Live, riding on the Timeline; the shell\'s tone cross-fades over 200 ms. Reduced Motion: the line resolves in over 140 ms and is cut out; the shell\'s tone is a cut. Once settled, the two are the same frame of truth (motion 01 ↔ 02, 03 ↔ 07, 04 ↔ 06 compared act by act).'],
    () => [F('01-pinned-return-live', 574, 'Standard — the preview line resolving in'), F('02-pinned-return-live-reduced-motion', 574, 'Reduced — resolved'), F('03-light-conversation-analysis-conversation', 608, 'Standard — shell mid cross-fade'), F('07-light-conversation-analysis-reduced-motion', 608, 'Reduced — shell already dark'), F('02-pinned-return-live-reduced-motion', 3000, 'Reduced — PINNED, settled')]],
];

function page(title, notes, tiles, n) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#0d0d0d}
body{display:inline-block;padding:44px 52px 36px;color:#cfcfcf;font-family:system-ui,'Segoe UI',sans-serif}
h1{font-size:21px;font-weight:600;color:#ededed;margin-bottom:10px;max-width:1600px}
.no{font:600 11px/1 ui-monospace,Consolas,monospace;color:#8f8a7e;letter-spacing:.08em;margin-bottom:10px}
.notes{max-width:1600px;margin-bottom:26px}
.notes p{font-size:13.5px;line-height:1.62;color:#a7a7a7;margin-bottom:5px}
.row{display:flex;gap:30px;align-items:flex-start}
figure{flex:none}
.pair{display:flex;gap:10px;align-items:flex-start}
.ph{position:relative;border-radius:26px;overflow:hidden;box-shadow:0 0 0 1px #262626}
.ph.crop{border-radius:14px}
.ph img{display:block}
.strip{position:relative;width:124px;border-left:1px solid #262626}
.strip .bd{position:absolute;left:6px;right:0;border-left:3px solid;background:rgba(255,255,255,.035)}
.strip .bd span{position:absolute;left:6px;top:50%;transform:translateY(-50%);font:600 10.5px/1.2 ui-monospace,Consolas,monospace;white-space:nowrap}
.strip .dist{position:absolute;left:8px;bottom:6px;right:0;font:10.5px/1.45 ui-monospace,Consolas,monospace;color:#d9b35c}
figcaption{margin-top:10px;max-width:520px}
figcaption b{display:block;font-size:13px;font-weight:600;color:#dcdcdc;font-family:'Segoe UI',Tahoma,sans-serif}
figcaption i{display:block;font-style:normal;font:10.5px/1.5 ui-monospace,Consolas,monospace;color:#7f7f7f;margin-top:3px}
footer{margin-top:24px;font:10.5px/1.5 ui-monospace,Consolas,monospace;color:#6d6d6d}
</style></head><body><div class="no">BOARD ${n}</div><h1>${esc(title)}</h1><div class="notes">${notes.map((x) => `<p>${esc(x)}</p>`).join('')}</div>
<div class="row">${tiles.join('')}</div>
<footer>QANDEEL · I-08B3.1-G3.2 targeted coherence refinement proof · READY FOR INDEPENDENT PRODUCT REVIEW — not frozen; G3 not closed · phones are Product captures at 2× (the proof harness is absent); every diagnostic is outside them</footer></body></html>`;
}

const base = await serveDir(WORK, 8871);
const c = await launch({ port: 9531 });
const out = [];
for (const [name, title, notes, tilesFn] of BOARDS) {
  const n = name.slice(0, 2);
  if (only && !only.includes(n)) continue;
  const tiles = tilesFn();
  writeFileSync(join(BD, `${name}.html`), page(title, notes, tiles, n));
  await c.viewport({ width: 2900, height: 2200, dpr: 1, mobile: false });
  await c.goto(`${base}/boards-html/${name}.html`);
  await c.eval(`Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r})))`);
  await c.eval(settle);
  const dim = await c.eval(`(()=>{const b=document.body.getBoundingClientRect();return {w:Math.ceil(b.width),h:Math.ceil(b.height),broken:[...document.images].filter(i=>!i.naturalWidth).length}})()`);
  if (dim.broken) throw new Error(`${name}: ${dim.broken} image(s) failed to load`);
  if (dim.w > 2900 || dim.h > 2200) throw new Error(`${name}: board ${dim.w}×${dim.h} exceeds its canvas`);
  writeFileSync(join(PKG, 'boards', `${name}.png`), await c.shot({ x: 0, y: 0, width: dim.w, height: dim.h }));
  out.push({ board: `${name}.png`, title, size: `${dim.w}×${dim.h}`, tiles: tiles.length });
  console.log('board', name, dim.w + '×' + dim.h);
}
await c.close(); await closeServers();
const prev = existsSync(join(PKG, 'data', 'BOARDS.json')) && only ? JSON.parse(readFileSync(join(PKG, 'data', 'BOARDS.json'), 'utf8')).boards : [];
const merged = [...prev.filter((b) => !out.some((o) => o.board === b.board)), ...out].sort((a, b) => a.board.localeCompare(b.board));
writeFileSync(join(PKG, 'data', 'BOARDS.json'), JSON.stringify({ boards: merged }, null, 1));
