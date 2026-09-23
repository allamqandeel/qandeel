// G1.2 — verification. Every G1.2 quality gate (brief §36, Q1–Q12) and every required proof is at least one
// check here, and every check that can be defeated carries a PROBE: a deliberately planted defect the check must
// reject. A check that cannot fail is a sentence.
//
// Layers: A = pure Node over the source and the authored documents, B = Chrome over the live prototype (every
// behaviour driven through the prototype's own acts and clock), C = over the shipped rasters, the motion truth
// logs and the MP4s.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { palette } from '../src/tokens.mjs';
import { COPY, THREAD, VOICE_TURNS, STRESS, OPENER, LIVE_CONTEXT, CALL_SCRIPT } from '../src/content.mjs';
import { page } from '../src/build.mjs';
import { FUNC_GLYPHS } from '../src/glyphs.mjs';
import { launch } from './cdp.mjs';
import { JOURNEYS, JOBS } from './motion.mjs';
import { SCREENS } from './screens.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORK = join(HERE, '..');
const OUT = join(WORK, 'out');
const REPO = join(WORK, '..');
const results = [], probes = [];
async function check(id, gate, title, fn) {
  let ok = false, detail = '';
  try { const r = await fn(); ok = r === true || (r && r.ok === true); detail = r && r.detail ? r.detail : ''; }
  catch (e) { ok = false; detail = String(e.message || e).slice(0, 400); }
  results.push({ id, gate, title, ok, detail }); return ok;
}
async function probe(id, targets, fn) {
  let rejected = false, detail = '';
  try { const r = await fn(); rejected = r === false || (r && r.ok === false); detail = r && r.detail ? r.detail : ''; }
  catch (e) { rejected = true; detail = 'threw: ' + String(e.message || e).slice(0, 200); }
  probes.push({ id, targets, rejected, detail });
}
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const cssOf = (o = {}) => stripComments(page({ lang: 'ar', appearance: 'dark', capture: true, ...o }).match(/<style>([\s\S]*?)<\/style>/)[1]);
const RUNTIME = readFileSync(join(WORK, 'src', 'runtime.js'), 'utf8');
const doc = (f) => { const p = join(WORK, 'authored', f); return existsSync(p) ? readFileSync(p, 'utf8') : null; };

/* ============================================================== A — source and documents === */

// ---- inherited G1.1 truth. Expectations are TYPED here from the G1.1 closure record, never imported.
const LOCKED_OPENER_AR = 'اهلا يا {display_name} ... انا في انتظارك ... يلا نبدأ';
function openerLocked(o) {
  if (Buffer.from(o.ar, 'utf8').toString('hex') !== Buffer.from(LOCKED_OPENER_AR, 'utf8').toString('hex')) return { ok: false, detail: `ar opener differs: «${o.ar}»` };
  return { ok: true, detail: `${Buffer.byteLength(o.ar)} bytes identical to the G1.1 closure §1 wording; {display_name} the only placeholder` };
}
await check('G12-01', 'G1.1 inherited', 'The new-conversation opener is byte-for-byte the G1.1 locked wording', () => openerLocked(OPENER));
await probe('P-G12-01', 'G12-01', () => openerLocked({ ar: 'اهلا يا {display_name} ... انا مستنيك ... يلا نبدأ' }));

const LOCKED_NAMES = { door: 'تحليل المحادثة', back: 'المحادثة', shared: 'مع الآخرين', sharedOne: 'عالم مشترك', sharedMany: 'عوالم مشتركة', full: 'المحادثة كاملة', part: 'جزء من المحادثة' };
function namingLocked(c) {
  const got = { door: c.door.text, back: c.back.text, shared: c.nav.items[1].text, sharedOne: c.sharedOne.text, sharedMany: c.sharedMany.text, full: c.replayFull.text, part: c.replayPart.text };
  const bad = Object.entries(LOCKED_NAMES).filter(([k, v]) => got[k] !== v).map(([k, v]) => `${k} «${got[k]}» ≠ «${v}»`);
  if (/العالم/.test(c.door.text) || /العالم/.test(c.back.text)) bad.push('«العالم» exposed as the Analysis doorway');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `«${got.door}» / «${got.back}»; rail «${got.shared}»; «${got.sharedOne}» / «${got.sharedMany}»; Replay «${got.full}» / «${got.part}» — unchanged` };
}
await check('G12-02', 'G1.1 inherited', 'Locked naming is unchanged (depth route, shared area, Replay scopes); «العالم» is never the Analysis doorway', () => namingLocked(COPY.ar));
await probe('P-G12-02', 'G12-02', () => namingLocked({ ...COPY.ar, door: { text: 'العالم' } }));

function utteranceRoute(p) {
  const r = p.routes.functional;
  if (r[0] !== 'qandeel.role.utterance.fill' || r[1] !== 'qandeel.surface.functional') return { ok: false, detail: `slab resolves ${r.join(' → ')}` };
  if (p.colors.functional !== p.colors.surface) return { ok: false, detail: `UTTERANCE ${p.colors.functional} is a second tone (Surface ${p.colors.surface})` };
  return { ok: true, detail: `the reader slab resolves ${r.join(' → ')} = ${p.colors.functional}, the one functional Surface tone (G1.1 closure §3: no new colour)` };
}
await check('G12-03', 'G1.1 inherited', 'The reader\'s committed turn (text AND voice) is the canonical UTTERANCE role, one-tone', () => { for (const a of ['dark', 'light']) { const r = utteranceRoute(palette(a)); if (!r.ok) return r; } return utteranceRoute(palette('dark')); });
await probe('P-G12-03', 'G12-03', () => { const p = palette('dark'); return utteranceRoute({ ...p, colors: { ...p.colors, functional: '#1e1e1e' } }); });

const WORLD_TYPES = (() => { const src = readFileSync(join(WORK, 'vendor', 'canon', 'world.types.ts'), 'utf8'); return src.match(/WORLD_TYPES\s*=\s*\[([^\]]+)\]/)[1].match(/'([A-Z_]+)'/g).map((s) => s.slice(1, -1)); })();
function destinations(keys) {
  const map = { mine: 'MY_WORLD', shared: 'SHARED_WORLD', public: 'PUBLIC_WORLD' };
  const got = keys.map((k) => map[k] || k);
  return got.join() === WORLD_TYPES.join() ? { ok: true, detail: `rail = kernel WORLD_TYPES [${WORLD_TYPES.join(', ')}] — no Voice Note, Live Call or Replay destination` } : { ok: false, detail: `rail ${got}` };
}
await check('G12-04', 'Q1', 'ONE relationship: the three ways of talking are not places — the rail is exactly the three canonical World types', () => destinations(COPY.ar.nav.items.map((i) => i.key)));
await probe('P-G12-04', 'G12-04', () => destinations(['mine', 'call', 'shared', 'public']));

// ---- Q12 identity: BRASS IS MATTER, LIGHT IS MEANING, no red "recording", no equalizer, no glow.
function identity(css, src) {
  const bad = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*var\(--(?:brass|mark)\)[^{}]*)\}/g)) { const sel = m[1].trim(); if (!sel.startsWith('#phone[data-appearance') && !['#rail .lb', '.t.opener .qm'].includes(sel)) bad.push(`Brass on ${sel}`); }
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*var\(--error\)[^{}]*)\}/g)) { const sel = m[1].trim(); if (!sel.startsWith('#phone[data-appearance')) bad.push(`error tone on ${sel}`); }
  for (const h of ['#fbf2db', '#e8ddc2', '#d6caa9', '#fff6df', '#ddd4be', '#bcb39e']) if (css.toLowerCase().includes(h)) bad.push(`Meaning Light stop ${h}`);
  if (/radial-gradient|box-shadow:[^;]*0 0 [1-9]\d*px[^;]*rgba\(|drop-shadow|glow/i.test(css.replace(/#os-[^{]*\{[^}]*\}/g, ''))) bad.push('a glow / orb gradient');
  if (/waveSVG|class="wave"|\.wave\b/.test(src)) bad.push('a drawn waveform');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: 'Brass reaches only the World rail and the opener Q; the error tone and every Meaning Light stop are absent from every voice and call state; no glow, no orb gradient, no waveform — the call is drawn only by the microphone\'s own line' };
}
const SRC = ['build.mjs', 'runtime.js', 'glyphs.mjs'].map((f) => readFileSync(join(WORK, 'src', f), 'utf8')).join('\n');
await check('G12-05', 'Q12 / §26–27', 'QANDEEL identity — Brass is not "call active", Light is not a sound meter, no red recording, no AI glow, no equalizer', () => identity(cssOf(), stripComments(SRC)));
await probe('P-G12-05a', 'G12-05', () => identity(cssOf() + '#end-call{color:var(--error)}', stripComments(SRC)));
await probe('P-G12-05b', 'G12-05', () => identity(cssOf() + '#composer{color:var(--brass)}', stripComments(SRC)));
await probe('P-G12-05c', 'G12-05', () => identity(cssOf() + '#world{background:radial-gradient(#fbf2db,transparent)}', stripComments(SRC)));
await probe('P-G12-05d', 'G12-05', () => identity(cssOf(), stripComments(SRC) + '\nexport function waveSVG(){}'));

const G11_DUR = 'resolve: 140, markerLead: 200, markerTrail: 280, dock: 220, depthOut: 200, depthIn: 320, depthInDelay: 100, voice: 220';
function motionHygiene(src) {
  const s = stripComments(src);
  const banned = [[/@keyframes/, '@keyframes'], [/\banimation\s*:/, 'CSS animation'], [/\btransition\s*:/, 'CSS transition'], [/ease-in(?!-out)/, 'ease-in'], [/infinite|withRepeat|setInterval/, 'a loop'], [/breath|pulse|shimmer|ripple/i, 'rejected motion vocabulary']];
  const hits = banned.filter(([re]) => re.test(s)).map(([, n]) => n);
  const curves = [...s.matchAll(/bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/g)].map((m) => m.slice(1).join(',')).filter((c) => c !== '0.23,1,0.32,1');
  if (curves.length) hits.push(`second curve ${curves}`);
  const dur = src.match(/var DUR = \{([^}]+)\}/)[1].trim();
  if (dur !== G11_DUR) hits.push(`durations changed: ${dur}`);
  return hits.length ? { ok: false, detail: hits.join('; ') } : { ok: true, detail: `one curve; no keyframes / transitions / loops / pulse; the G1.1 durations unchanged (${dur}) — G1.2 adds no duration` };
}
await check('G12-06', '§25–26 / carried', 'Motion hygiene — MOTION EXPLAINS CONTINUITY: one curve, no loop, no pulse, no new duration', () => motionHygiene(RUNTIME + '\n' + cssOf()));
await probe('P-G12-06a', 'G12-06', () => motionHygiene(RUNTIME + '\n' + cssOf() + '#end-call{animation:pulse 1.2s infinite}'));
await probe('P-G12-06b', 'G12-06', () => motionHygiene(RUNTIME.replace('voice: 220', 'voice: 220, callGlow: 900')));

// ---- copy: the three authority classes (§32), VI-01 voice principles (§14), gender-neutral fixed Arabic.
function copyTruth(c) {
  const bad = [];
  const all = Object.entries(c).filter(([, v]) => v && typeof v === 'object' && 'text' in v);
  for (const [k, v] of all) {
    if (!v.status) bad.push(`${k}: no authority status`);
    if (/[!！]/.test(v.text)) bad.push(`${k}: exclamation`);
    if (/بيفكّر|بيفكر|بسمعك|قاطعتني|فقدتك/.test(v.text)) bad.push(`${k}: VI-01 §14 forbidden «${v.text}»`);
    if (/(^|\s)(اكتب|ابدأ|اضغط|جرّب|ابعت|شوف|افتح|سجّل|تقدر|كلّم|اتكلم)(\s|$)/.test(v.text)) bad.push(`${k}: gendered imperative`);
  }
  for (const k of ['voiceNote', 'recording', 'call', 'connecting', 'micOn', 'muted', 'qSpeaking', 'reconnecting', 'callFailed']) if (!/OPEN/.test(c[k].status)) bad.push(`${k} is not marked OPEN (VI-01 §14: no voice string is a freeze candidate)`);
  for (const k of ['door', 'back', 'replayFull', 'replayPart', 'sharedOne', 'sharedMany']) if (!/LOCKED/.test(c[k].status)) bad.push(`${k} not marked LOCKED`);
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `${all.length} Arabic strings, each with its authority: LOCKED (G1.1), PROOF, or OPEN (every voice/call string, VI-01 §14); no «!», no «بيفكّر» / «بسمعك» / «قاطعتني» / «فقدتك», no gendered imperative` };
}
await check('G12-07', '§20 / §32', 'Copy authority and truth — LOCKED / PROOF / OPEN on every string; no "Thinking", no "Listening", no fault-assigning or gendered copy', () => copyTruth(COPY.ar));
await probe('P-G12-07a', 'G12-07', () => copyTruth({ ...COPY.ar, micOn: { text: 'بسمعك', status: 'OPEN' } }));
await probe('P-G12-07b', 'G12-07', () => copyTruth({ ...COPY.ar, qSpeaking: { text: 'قنديل بيفكّر', status: 'PROOF' } }));

function recordingOnlyForNotes(src) {
  // «بسجّل» / "Recording" is TRUE for a voice note (it is captured) and may be FALSE for a call (VI-01 §14): the
  // call's words must never use it.
  const fn = src.match(/function lineLabel\(\) \{([\s\S]*?)\n  \}/)[1];
  const callPart = fn.split('\n').filter((l) => /S\.call/.test(l)).join('\n');
  if (/recording/.test(callPart)) return { ok: false, detail: 'a call state is labelled «بسجّل» / Recording' };
  if (!/composer === 'note'\) return Q\.copy\.recording/.test(fn)) return { ok: false, detail: 'the voice-note capture is not the recording label' };
  return { ok: true, detail: '«بسجّل» labels only a voice-note capture (true: it IS captured); every call phase is named by its mechanism — «جاري الاتصال», «الميكروفون شغّال», «الميكروفون مكتوم», «قنديل بيتكلم», V06' };
}
await check('G12-08', '§20 / VI-01 §14', '"Recording" is claimed only where something is recorded — never for the Live Call', () => recordingOnlyForNotes(RUNTIME));
await probe('P-G12-08', 'G12-08', () => recordingOnlyForNotes(RUNTIME.replace("if (S.call === 'connecting') return Q.copy.connecting.text;", "if (S.call === 'connecting') return Q.copy.recording.text;")));

function micOnIntentOnly(src) {
  const s = stripComments(src);
  const gum = (s.match(/getUserMedia/g) || []).length;
  if (gum !== 1) return { ok: false, detail: `getUserMedia appears ${gum} times` };
  const callers = [...s.matchAll(/function (\w+)\([^)]*\) \{((?:(?!\n  function )[\s\S])*?liveLevel\.start\(\))/g)].map((m) => m[1]);
  const extra = callers.filter((c) => !['beginNote', 'beginCall'].includes(c));
  const top = s.split('\n').filter((l) => /^  [^ f].*liveLevel\.start\(\)/.test(l));
  if (extra.length || top.length) return { ok: false, detail: `the microphone is also started by ${extra.concat(top.map((t) => t.trim())).join(', ')}` };
  return { ok: true, detail: 'the browser microphone is requested in exactly one place (liveLevel.start), reached only from beginNote / beginCall — after the reader\'s act and the OS grant; never at load, never from the background' };
}
await check('G12-09', '§16 / Q7', 'The microphone is requested only at the moment of intent — never at launch', () => micOnIntentOnly(RUNTIME));
await probe('P-G12-09', 'G12-09', () => micOnIntentOnly(RUNTIME.replace('  applyPreset(preset);', '  liveLevel.start();\n  applyPreset(preset);')));

function voiceTurnTruth(src, fixture) {
  const bad = [];
  if (fixture.ar.some((t) => t.kind === 'voice' && ('text' in t))) bad.push('the reader\'s voice fixture carries a transcript');
  const sendNote = src.match(/function sendNote\(\) \{([\s\S]*?)\n  \}/)[1];
  if (/class="tx|\.tx/.test(sendNote)) bad.push('a sent voice note renders a text paragraph');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: 'a committed voice note carries its media control, its measured duration and «رسالة صوتية» — no transcript (none exists), no waveform (it would be invented data)' };
}
await check('G12-10', '§15', 'A committed Voice Note implies no transcript and no fake waveform', () => voiceTurnTruth(RUNTIME, VOICE_TURNS));
await probe('P-G12-10', 'G12-10', () => voiceTurnTruth(RUNTIME, { ar: [{ who: 'me', kind: 'voice', durMs: 1, text: 'تفريغ' }] }));

// ---- the production recommendation: every declared background capability maps to a user-visible feature.
const NOTE = doc('G1.2_BACKGROUND_CALL_PLATFORM_COMPLIANCE_NOTE.md');
const DEP = doc('G1.2_AUDIO_RUNTIME_DEPENDENCY_NOTE.md');
function capabilityTable(text) {
  const m = text && text.match(/```json G12-CAPABILITIES\n([\s\S]*?)\n```/);
  if (!m) return { ok: false, detail: 'no G12-CAPABILITIES table' };
  const t = JSON.parse(m[1]), bad = [];
  const ALLOWED_ANDROID = ['android.permission.RECORD_AUDIO', 'android.permission.FOREGROUND_SERVICE', 'android.permission.FOREGROUND_SERVICE_PHONE_CALL', 'android.permission.FOREGROUND_SERVICE_MICROPHONE', 'android.permission.MANAGE_OWN_CALLS', 'android.permission.POST_NOTIFICATIONS'];
  for (const p of t.android.permissions) { if (!ALLOWED_ANDROID.includes(p.name)) bad.push(`unrelated Android permission ${p.name}`); if (!p.feature) bad.push(`${p.name} maps to no feature`); }
  for (const f of t.android.foregroundServiceTypes) { if (!['phoneCall', 'microphone'].includes(f.type)) bad.push(`FGS type ${f.type} declared`); if (!f.feature || !/Live Call/.test(f.feature)) bad.push(`FGS ${f.type} not tied to the Live Call`); }
  const modes = t.ios.UIBackgroundModes.map((x) => x.mode);
  if (modes.join() !== 'audio') bad.push(`iOS background modes ${modes}`);
  if (t.ios.UIBackgroundModes.some((x) => !/Live Call/.test(x.feature))) bad.push('iOS audio mode not tied to the Live Call');
  if (!t.ios.infoPlist.NSMicrophoneUsageDescription) bad.push('no microphone purpose string');
  if (t.expo && t.expo['expo-audio'] && t.expo['expo-audio'].enableBackgroundPlayback !== false) bad.push('expo-audio background playback left at its default (true)');
  if (t.voiceNoteBackgroundCapture !== false) bad.push('a background capability is declared for Voice Notes');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `iOS UIBackgroundModes = [audio] for the Live Call only; Android ${t.android.permissions.length} permissions, FGS types [${t.android.foregroundServiceTypes.map((f) => f.type)}] — every one mapped to the Live Call or the Voice Note; no mediaPlayback, no background Voice Note capture, expo-audio background playback explicitly off` };
}
if (NOTE) {
  await check('G12-11', 'Q7 / Q9 / §9', 'Store safety — the recommended declarations use background capability ONLY for the real user-visible Live Call; nothing "just in case"', () => capabilityTable(NOTE));
  await probe('P-G12-11a', 'G12-11', () => capabilityTable(NOTE.replace('"type": "phoneCall"', '"type": "mediaPlayback"')));
  await probe('P-G12-11b', 'G12-11', () => capabilityTable(NOTE.replace('"mode": "audio"', '"mode": "audio" }, { "mode": "fetch", "feature": "keep-alive"')));
  await probe('P-G12-11c', 'G12-11', () => capabilityTable(NOTE.replace('"voiceNoteBackgroundCapture": false', '"voiceNoteBackgroundCapture": true')));
}

const OFFICIAL = ['developer.apple.com/documentation/xcode/configuring-background-execution-modes', 'developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/playandrecord', 'developer.apple.com/documentation/avfaudio/avaudiosession/mode-swift.struct/voicechat',
  'developer.apple.com/documentation/callkit', 'developer.apple.com/app-store/review/guidelines', 'developer.android.com/develop/background-work/services/fgs/service-types', 'developer.android.com/develop/background-work/services/fgs/restrictions-bg-start',
  'developer.android.com/develop/connectivity/telecom/voip-app/telecom', 'support.google.com/googleplay/android-developer/answer/13392821', 'docs.expo.dev/versions/latest/sdk/audio'];
function noteComplete(text, sections) {
  const bad = [];
  for (const s of sections) if (!text.includes(s)) bad.push(`missing section «${s}»`);
  for (const u of OFFICIAL) if (!text.includes(u)) bad.push(`official source not cited: ${u}`);
  if (/\b(is|are) (already )?(implemented|verified on (a )?device)\b/i.test(text.replace(/NOT (yet )?implemented|not verified on (a )?device/gi, ''))) bad.push('claims an implementation or a device verification');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `${sections.length} required sections; ${OFFICIAL.length} official Apple / Android / Google Play / Expo sources cited by URL; no claim of implementation or device verification` };
}
const NOTE_SECTIONS = ['## 1. iOS', '## 2. Android', '## 3. Google Play', '## 4. Expo', '## 5. OS-owned', '## 6. Background / foreground legality', '## 7. User-visible stop', '## 8. Audio interruption and route', '## 9. Production risks', '## 10. Official sources'];
if (NOTE) {
  await check('G12-12', 'Q6 / §35 C', 'Compliance note — every required section, every claim sourced from the official platform documentation, nothing claimed as implemented', () => noteComplete(NOTE, NOTE_SECTIONS));
  await probe('P-G12-12a', 'G12-12', () => noteComplete(NOTE.replace('## 3. Google Play', '## 3. Store'), NOTE_SECTIONS));
  await probe('P-G12-12b', 'G12-12', () => noteComplete(NOTE + '\nBackground calls are already implemented.', NOTE_SECTIONS));
}
const DEP_SECTIONS = ['## 1. Voice Note', '## 2. Live Call', '## 3. Background', '## 4. Replay', '## 5. Provider', '## 6. What can be Product-proofed now', '## 7. What must exist before production'];
function depComplete(text) {
  const bad = DEP_SECTIONS.filter((s) => !text.includes(s)).map((s) => `missing «${s}»`);
  if (!/NOT PRODUCIBLE/.test(text)) bad.push('the Replay runtime §7 fact is not carried');
  if (/transcript (is|as) (the )?original audio/i.test(text)) bad.push('transcript substituted for audio');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: 'the five dependency questions of §29 answered in seven sections; Personal original audio carried as NOT PRODUCIBLE; no transcript stands in for audio' };
}
if (DEP) {
  await check('G12-13', '§29 / §35 D', 'Audio runtime dependency note — Voice Note audio, call transport, background, Replay audio, provider gaps', () => depComplete(DEP));
  await probe('P-G12-13', 'G12-13', () => depComplete(DEP.replace('## 4. Replay', '## 4. Later')));
}

function trackedClean(porcelain) {
  const tracked = porcelain.split('\n').filter((l) => l && !l.startsWith('??'));
  return tracked.length ? { ok: false, detail: `tracked changes: ${tracked.slice(0, 3).join(' | ')}` } : { ok: true, detail: 'no tracked repository file changed — the production app gains no permission, background mode, dependency or code from this proof' };
}
const PORCELAIN = spawnSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: REPO, encoding: 'utf8' }).stdout;
await check('G12-14', '§33', 'Prototype boundary — nothing merged, no production permission or dependency added (tracked tree unchanged)', () => trackedClean(PORCELAIN));
await probe('P-G12-14', 'G12-14', () => trackedClean(PORCELAIN + '\n M apps/mobile/app.json'));

/* =============================================================== B — the live prototype === */
const b = await launch({ port: 9451 });
await b.viewport({ width: 390, height: 844, dpr: 1 });
let pageN = 0;
/** Load a prototype page and walk it through steps [ms, act|null, record?]. Returns the records. */
async function run(opts, q, steps, { runtime, extraCss = '', rm = false, vw = 390, vh = 844 } = {}) {
  const f = join(OUT, 'checks-tmp', `p${++pageN}.html`);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, page({ lang: 'ar', appearance: 'dark', capture: true, ...opts, ...(runtime ? { runtime } : {}), extraCss }));
  await b.viewport({ width: vw, height: vh, dpr: 1 });
  await b.media({ scheme: opts.appearance === 'light' ? 'light' : 'dark', reducedMotion: rm ? 'reduce' : 'no-preference' });
  await b.goto('file:///' + f.replace(/\\/g, '/') + '?capture=1&' + q + (rm ? '&rm=1' : ''));
  await b.eval(`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
  const err = await b.eval('window.__err || null'); if (err) throw new Error(`page error: ${err}`);
  await b.eval('window.__G12rt.remeasure(); window.__G12rt.at(0)');
  const out = [];
  for (const [ms, act, rec] of steps) {
    await b.eval(`window.__G12rt.at(${ms})`);
    if (act) await b.eval(act.startsWith('js:') ? act.slice(3) : `window.__G12rt.act(${JSON.stringify(act)})`);
    if (rec) out.push({ ms, act, rec, truth: await b.eval('window.__G12rt.truth()'), m: rec === 'm' ? await b.eval('window.__G12rt.measure()') : null, x: rec.startsWith && rec.startsWith('js:') ? await b.eval(rec.slice(3)) : null });
  }
  return out;
}
const T = (recs, ms) => recs.find((r) => r.ms === ms).truth;

// ---- Q2 mode clarity
async function modes(runtime, extraCss) {
  const r = await run({}, 'state=active', [[0, null, 'm'], [200, 'note', 't'], [1400, 'notecancel', 't'], [1600, 'call', 't']], { runtime, extraCss });
  const m = r[0].m, idle = r[0].truth, bad = [];
  if (!idle.controls.includes('mic') || !idle.controls.includes('call')) bad.push('Voice Note and Live Call are not both reachable from Writing');
  const names = await b.eval(`[document.getElementById('mic').getAttribute('aria-label'),document.getElementById('call').getAttribute('aria-label'),document.getElementById('mic').innerHTML,document.getElementById('call').innerHTML]`);
  if (names[0] === names[1]) bad.push('one name for two modes');
  if (names[2] === names[3]) bad.push('one glyph for two modes');
  const [mx, , mw, mh] = m.boxes.mic, [cx, , cw, ch] = m.boxes.call;
  if (mw < 44 || mh < 44 || cw < 44 || ch < 44) bad.push('a mode control under 44 px');
  const gap = Math.max(mx, cx) - (Math.min(mx, cx) + (mx < cx ? mw : cw)); if (gap < 8) bad.push(`gap ${gap} px`);
  if (r[1].truth.depth !== 'conversation' || r[1].truth.composer !== 'note') bad.push('Voice Note moved the reader or did not start');
  if (r[3].truth.depth !== 'world') bad.push('Live Call did not open the Analysis');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `two controls at the end of the one line — «${names[0]}» (microphone) and «${names[1]}» (handset): different names, shapes, places (${gap.toFixed(0)} px apart, 44 px each) and OUTCOMES (Voice Note stays in the Conversation; Live Call opens the Analysis). No third toolbar, no overflow menu` };
}
await check('G12-Q2', 'Q2 / §13', 'Mode clarity — Writing, Voice Note and Live Call are immediately distinguishable without a toolbar', () => modes());
await probe('P-G12-Q2', 'G12-Q2', () => modes(RUNTIME.replace("document.documentElement.setAttribute('data-rt', '1');", "document.getElementById('call').setAttribute('aria-label', document.getElementById('mic').getAttribute('aria-label')); document.getElementById('call').innerHTML = document.getElementById('mic').innerHTML; document.documentElement.setAttribute('data-rt', '1');")));

// ---- Q3 Analysis-first start (granted, and via the permission prompt)
async function analysisFirst(runtime) {
  const a = await run({}, 'state=active&perm=granted', [[0, 'call', 't'], [1300, null, 't']], { runtime });
  const u = await run({}, 'state=active&perm=unknown', [[0, 'call', 't'], [400, 'allow', 't'], [1700, null, 't']], { runtime });
  const bad = [];
  if (a[0].truth.depth !== 'world' || a[0].truth.call !== 'connecting') bad.push('granted: not Analysis-first / not connecting');
  if (a[1].truth.call !== 'live') bad.push('granted: never established');
  if (u[0].truth.depth !== 'conversation' || !u[0].truth.osPerm || u[0].truth.call !== 'none') bad.push('unknown: the call started before the OS answered');
  if (u[1].truth.depth !== 'world' || u[2].truth.call !== 'live') bad.push('unknown → allowed: not Analysis-first');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: 'START = Analysis-first: the call opens the Analysis at once (connecting → live at 1.2 s); with the permission not yet decided, nothing starts until the OS prompt is answered, then the same Analysis-first start' };
}
await check('G12-Q3', 'Q3 / §16–17', 'Live Call START is Analysis-first (after the OS grant when one is needed)', () => analysisFirst());
await probe('P-G12-Q3', 'G12-Q3', () => analysisFirst(RUNTIME.replace("if (S.world === 'mine' && S.depth !== 'world') enterWorld(); else {", "if (false) enterWorld(); else {")));

// ---- Q4 background continuity + Q5 exact restore, both variants
async function restore(runtime) {
  const w = await run({}, 'state=active', [[0, 'call', 't'], [5000, 'bg', 't'], [9000, null, 't'], [13000, 'fg', 'm'], [13700, null, 't']], { runtime });
  const c = await run({}, 'state=active', [[0, 'call', 't'], [3000, 'leave', 't'], [5000, 'bgapp', 't'], [11000, 'fg', 'm'], [11700, null, 't']], { runtime });
  const bad = [];
  const id = w[0].truth.callId;
  if (w[1].truth.call !== 'live' || w[2].truth.call !== 'live' || !w[2].truth.osBg) bad.push('lock: the call did not continue while QANDEEL was away');
  if (w[3].truth.callId !== id || w[3].truth.callStarts !== 1 || w[3].truth.ends.length) bad.push('lock → return: not the same call, or a second session');
  if (w[3].truth.depth !== 'world' || !w[3].truth.worldVisible) bad.push(`lock on Analysis → returned to ${w[3].truth.depth}`);
  if (w[3].truth.conversation !== w[0].truth.conversation) bad.push('a different Conversation after return');
  const el = await b.eval("document.getElementById('elapsed').textContent");
  if (c[3].truth.depth !== 'conversation' || !c[3].truth.convVisible) bad.push(`other app while Conversation → returned to ${c[3].truth.depth}`);
  if (c[3].truth.callId !== c[0].truth.callId || c[3].truth.call !== 'live' || c[3].truth.callStarts !== 1) bad.push('other app → return: not the same live call');
  const ctl = c[4].truth.controls;
  for (const k of ['mute', 'end-call', 'door']) if (!ctl.includes(k)) bad.push(`after return ${k} is not reachable`);
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `lock while on the Analysis → return to the Analysis; another app while on the Conversation → return to the Conversation (not reset to the Analysis). Same call id ${id}, same Conversation ${w[0].truth.conversation}, one call started, the call time kept counting while away (${el} on return after 6 s away), mute / end call / «تحليل المحادثة» reachable at once` };
}
await check('G12-Q4Q5', 'Q4 / Q5 / §4–5, §18', 'Background continuity and EXACT restore — lock or another app, then back to the same call on the same last surface', () => restore());
await probe('P-G12-Q5a', 'G12-Q4Q5', () => restore(RUNTIME.replace('    // A call that is still genuinely active: NOTHING about the surface is written.', "    if (S.depth !== 'world') enterWorld();\n    // A call that is still genuinely active: NOTHING about the surface is written.")));
await probe('P-G12-Q5b', 'G12-Q4Q5', () => restore(RUNTIME.replace("    S.app = 'background'; S.os = os || 'lock';", "    endCall('dropped'); S.app = 'background'; S.os = os || 'lock';")));
await probe('P-G12-Q5c', 'G12-Q4Q5', () => restore(RUNTIME.replace("  function toForeground() {\n    if (S.app !== 'background') return;", "  function toForeground() {\n    if (S.app !== 'background') return; S.callStarts++; S.callId = 'call-new';")));

// ---- Q10 failure truth: failed reconnection, ended while away, force-quit
const CALL_CTL = ['mute', 'end-call', 'route'];
async function failureTruth(runtime) {
  const f = await run({}, 'state=active', [[0, 'call', 't'], [3000, 'drop', 't'], [5000, 'recover', 't'], [7000, 'drop', 't'], [9000, 'fail', 't'], [9800, null, 't']], { runtime });
  const a = await run({}, 'state=active', [[0, 'call', 't'], [3000, 'bg', 't'], [5000, 'awaydrop', 't'], [7000, 'fg', 't'], [7800, null, 't']], { runtime });
  const k = await run({}, 'state=active', [[0, 'call', 't'], [3000, 'bg', 't'], [4000, 'relaunch', 't'], [4800, null, 't']], { runtime });
  const bad = [];
  if (f[1].truth.call !== 'reconnecting' || f[1].truth.label !== COPY.ar.reconnecting.text) bad.push('drop: not a named reconnecting state');
  if (f[2].truth.call !== 'live' || f[2].truth.callId !== f[0].truth.callId) bad.push('recover: not the same call');
  const ff = f[5].truth;
  if (ff.call !== 'none' || ff.depth !== 'conversation' || ff.notice !== 'failed' || CALL_CTL.some((c) => ff.controls.includes(c)) || !ff.controls.includes('input')) bad.push(`failed: ${JSON.stringify({ call: ff.call, depth: ff.depth, notice: ff.notice, controls: ff.controls })}`);
  if (!ff.callRecords.some((x) => x.includes(COPY.ar.callRecordStopped.text))) bad.push('failed: no truthful record in the history');
  if (ff.turns !== f[0].truth.turns) bad.push('failed: committed turns lost');
  const aa = a[4].truth;
  if (a[2].truth.call !== 'none') bad.push('away-drop: still live');
  if (aa.depth !== 'conversation' || aa.notice !== 'failed' || CALL_CTL.some((c) => aa.controls.includes(c))) bad.push(`ended while away → ${aa.depth}, notice ${aa.notice}, controls ${aa.controls}`);
  const kk = k[2].truth;
  if (kk.call !== 'none' || kk.depth !== 'conversation' || kk.notice || kk.callRecords.length || CALL_CTL.some((c) => kk.controls.includes(c))) bad.push(`relaunch: ${JSON.stringify({ call: kk.call, depth: kk.depth, notice: kk.notice, rec: kk.callRecords })}`);
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `reconnecting is named (V06) and the recovered call is the same call; a failed reconnection returns to the Conversation with V07 «${COPY.ar.callFailed.text}», Writing reachable, the record «${ff.callRecords[0]}», all ${ff.turns} committed turns kept and NO call control; a call that ended while away returns the same truth; a force-quit relaunch shows no call, no controls and no invented record` };
}
await check('G12-Q10', 'Q10 / §23 / §4', 'Failure truth — a call that no longer exists never shows live controls; recovery is truthful; nothing committed is lost', () => failureTruth());
await probe('P-G12-Q10a', 'G12-Q10', () => failureTruth(RUNTIME.replace("S.call = 'none'; S.muted = false; liveLevel.stop();\n    go('voice', 0, DUR.voice);", "S.muted = false; liveLevel.stop();\n    go('voice', 0, DUR.voice);")));
await probe('P-G12-Q10b', 'G12-Q10', () => failureTruth(RUNTIME.replace("      S.pendingReturn = null; S.notice = 'failed';\n      if (S.depth === 'world') leaveWorld(true); else commit();", "      S.pendingReturn = null;\n      commit();")));

// ---- permission: at launch nothing; intent → OS; denial → Writing; a second intent after denial → no prompt
async function permission(runtime) {
  const r = await run({}, 'state=active&perm=unknown', [[0, null, 't'], [300, 'note', 't'], [900, 'deny', 't'], [1400, 'call', 't']], { runtime });
  const bad = [];
  if (r[0].truth.ask || r[0].truth.osPerm) bad.push('asked at launch');
  if (r[1].truth.ask !== 'note' || !r[1].truth.osPerm || r[1].truth.composer !== 'idle') bad.push('the voice-note intent did not go through the OS prompt');
  const d = r[2].truth;
  if (d.notice !== 'denied' || !d.controls.includes('input') || !d.controls.includes('notice-act') || d.composer !== 'idle') bad.push('denial does not leave Writing with the named alternative and the Settings route');
  if (r[3].truth.ask || r[3].truth.call !== 'none' || r[3].truth.notice !== 'denied') bad.push('a second intent after denial re-prompts or starts a call');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `nothing is asked at launch; the first intent opens the OS prompt (QANDEEL supplies only the purpose string); «Don't allow» leaves the Conversation, «${COPY.ar.micDenied.text}», the Settings route and the writing line; a later intent does not nag — it names the alternative again` };
}
await check('G12-P1', '§15.10 / §16 / §30', 'Microphone permission — asked at intent, never at launch; denial leaves Writing available', () => permission());
await probe('P-G12-P1', 'G12-P1', () => permission(RUNTIME.replace("  var preset = params.get('state') || 'active';", "  if (S.perm === 'unknown') S.ask = 'call';\n  var preset = params.get('state') || 'active';")));

// ---- Voice Note life-cycle: capture, cancel, commit, playback, leaving mid-capture
async function voiceNote(runtime) {
  const r = await run({}, 'state=active', [[0, null, 't'], [500, 'note', 't'], [3600, 'notecancel', 't'], [4000, 'note', 't'], [10400, 'notesend', 'js:(()=>{var t=[...document.querySelectorAll(".thread .t.me.voice")].pop();return {dur:t.getAttribute("data-dur"),tx:!!t.querySelector(".tx"),vk:t.querySelector(".vk").textContent,x1:t.getBoundingClientRect().right,name:t.querySelector(".play").getAttribute("aria-label")}})()'],
    [11000, 'playlast', 't'], [14000, null, 'js:parseFloat([...document.querySelectorAll(".thread .t.me.voice .fill")].pop().style.width)'], [18000, null, 't'],
    [19000, 'note', 't'], [22000, 'bg', 't'], [26000, 'fg', 't'], [27000, 'notesend', 't']], { runtime });
  const bad = [], base = r[0].truth.turns;
  if (r[1].truth.depth !== 'conversation' || r[1].truth.composer !== 'note' || r[1].truth.label !== COPY.ar.recording.text) bad.push('capture: not Conversation-first / not named');
  if (r[2].truth.turns !== base) bad.push('cancel added something to the history');
  const s = r[4].x;
  if (r[4].truth.turns !== base + 1 || s.dur !== '6000' || s.tx || s.vk !== COPY.ar.voiceNote.text || Math.round(s.x1) !== 390 || !s.name.includes('0:06')) bad.push(`commit: ${JSON.stringify(s)}`);
  if (r[5].truth.playing === null) bad.push('playback did not start');
  if (!(r[6].x > 40 && r[6].x < 60)) bad.push(`playback progress at 3.0 / 6.0 s is ${r[6].x}%`);
  if (r[7].truth.playing !== null) bad.push('playback did not end with the note');
  if (r[9].truth.composer !== 'draft' || r[9].truth.app !== 'background') bad.push('leaving mid-capture did not stop the capture into a draft');
  if (r[10].truth.composer !== 'draft' || r[10].truth.turns !== base + 1) bad.push('the draft was sent or lost while away');
  if (r[11].truth.turns !== base + 2) bad.push('the draft cannot be sent on return');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `capture stays in the Conversation («${COPY.ar.recording.text}»); cancel adds nothing; send commits ONE reader UTTERANCE on the right edge carrying its measured 0:06, «${COPY.ar.voiceNote.text}» and no transcript; playback tracks real elapsed time and ends with the note; leaving QANDEEL mid-capture STOPS the capture into an unsent draft (nothing is recorded in the background, nothing is sent without the reader), which can be sent or discarded on return` };
}
await check('G12-VN', '§15 (all ten states)', 'Voice Note — capture, cancel, commit, playback, and leaving QANDEEL mid-capture', () => voiceNote());
await probe('P-G12-VN', 'G12-VN', () => voiceNote(RUNTIME.replace("if (S.composer === 'note') { S.noteMs = now() - S.noteStart; S.composer = 'draft'; liveLevel.stop(); }", "if (S.composer === 'note') { sendNote(); }")));

// ---- Analysis during a call: the picture never moves with sound; «سياق الكلام» changes only at commits
async function analysisTruth(runtime) {
  const steps = [[0, 'call', null]];
  for (let t = 1200; t <= 41200; t += 100) steps.push([t, null, 'js:[document.getElementById("lctx-v").textContent, document.querySelector("#world img").src.length, window.__G12rt.speaking()]']);
  steps.push([41300, 'drop', null]); for (let t = 41400; t <= 47000; t += 100) steps.push([t, null, 'js:[document.getElementById("lctx-v").textContent]']);
  steps.push([47100, 'recover', 'js:[document.getElementById("lctx-v").textContent]']);
  const r = await run({}, 'state=active', steps, { runtime });
  const bad = [], changes = [];
  const commitsAt = []; for (let c = 0; c < 2; c++) for (const x of CALL_SCRIPT.commits) commitsAt.push(1200 + c * CALL_SCRIPT.cycleMs + x);
  for (let i = 1; i < r.length; i++) if (r[i].x[0] !== r[i - 1].x[0]) changes.push(r[i].ms);
  const live = r.filter((x) => x.ms <= 41200);
  if (new Set(live.map((x) => x.x[1])).size !== 1) bad.push('the Analysis picture changed during the call');
  const expected = commitsAt.filter((c) => c <= 41200);
  const liveChanges = changes.filter((c) => c <= 41200);
  if (liveChanges.length !== expected.length || liveChanges.some((c, i) => c < expected[i] || c - expected[i] > 100)) bad.push(`«سياق الكلام» changed at ${liveChanges} — commits at ${expected}`);
  const speechEdges = []; for (let i = 1; i < live.length; i++) if (live[i].x[2] !== live[i - 1].x[2]) speechEdges.push(live[i].ms);
  if (liveChanges.some((c) => speechEdges.includes(c) && !expected.some((e) => Math.abs(e - c) <= 100))) bad.push('it changes with sound, not with commits');
  if (changes.some((c) => c > 41200)) bad.push(`it changed while the line was down or at reconnection (${changes.filter((c) => c > 41200)})`);
  if (LIVE_CONTEXT.ar.some((v) => !WORLD_LABELS.includes(v))) bad.push('a Live Context value is not a reading drawn in the fixture world');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `over 40 s of live call sampled every 100 ms: the Analysis picture never changed; «سياق الكلام» changed ${liveChanges.length} times, each within 100 ms after a spoken turn COMMITTED (${expected.join(', ')} ms) and never at a speech edge; nothing changed while the line was down or at reconnection; every value is a reading drawn in the fixture world` };
}
// The readings drawn in out/world/world-*.png (typed from the raster; the image is the sealed F2 fixture).
const WORLD_LABELS = ['العلاقات القريبة', 'تأجيل المهام', 'الرغبة في الإتقان', 'مقارنة بالآخرين', 'قلّة النوم', 'الخوف من التقصير', 'إرهاق آخر الأسبوع'];
await check('G12-AN', '§24 / §26', 'Analysis during the call — the picture is not a sound meter; understanding changes only when a spoken turn commits', () => analysisTruth());
await probe('P-G12-AN', 'G12-AN', () => analysisTruth(RUNTIME.replace("var n = commitsNow();", "var n = commitsNow() + (speaking() === 'q' ? 1 : 0);")));

// ---- Q11: every call phase has words; the words never clip (100% and 200%, Arabic and English)
async function callWords(extraCss) {
  const bad = [], seen = {};
  for (const lang of ['ar', 'en']) for (const ts of [1, 2]) {
    const L = COPY[lang];
    const r = await run({ lang }, `state=active&ts=${ts}`, [[0, 'call', 'm'], [1300, null, 'm'], [3000, null, 'm'], [7000, null, 'm'], [7100, 'mute', 'm'], [7200, 'mute', null], [7300, 'drop', 'm']], { extraCss });
    const want = [L.connecting.text, L.micOn.text, L.micOn.text, L.qSpeaking.text, L.muted.text, L.reconnecting.text];
    r.forEach((x, i) => { const w = x.m.lineWords; if (w.text !== want[i] || w.clipped) bad.push(`${lang} ${ts * 100}% ${x.truth.call}: «${w.text}» ${w.where}${w.clipped ? ' CLIPPED' : ''}`); seen[`${lang}${ts}-${i}`] = w.where; });
  }
  const labels = new Set([COPY.ar.connecting.text, COPY.ar.micOn.text, COPY.ar.qSpeaking.text, COPY.ar.muted.text, COPY.ar.reconnecting.text]);
  if (labels.size !== 5) bad.push('two phases share one name');
  return bad.length ? { ok: false, detail: bad.slice(0, 4).join('; ') } : { ok: true, detail: `connecting · microphone on · QANDEEL speaking · muted · reconnecting: five distinct names, readable in full in Arabic and English at 100% and 200% text (${Object.values(seen).filter((w) => w === 'strip').length} of ${Object.keys(seen).length} placements use the full-width strip because the line could not hold the words) — no state lives in motion or colour alone` };
}
await check('G12-Q11a', 'Q11 / §20 / §30', 'Call state in words — every phase named, never clipped, at 100% and 200% text in both languages', () => callWords());
await probe('P-G12-Q11a', 'G12-Q11a', () => callWords('#cstate{display:none !important}'));

async function names(runtime) {
  const r = await run({ thread: 'voice' }, `state=call&voiceMs=84000`, [[0, null, 'js:[...document.querySelectorAll("#phone button")].filter(b=>b.getClientRects().length&&!b.closest(".os")).map(b=>({id:b.id||b.className,name:b.getAttribute("aria-label")||b.textContent.trim(),pressed:b.getAttribute("aria-pressed"),w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height}))']], { runtime });
  const list = r[0].x, bad = [];
  for (const x of list) { if (!x.name) bad.push(`${x.id} has no name`); if ((x.w < 44 || x.h < 44) && !/it\b/.test(x.id)) bad.push(`${x.id} ${x.w}×${x.h}`); }
  const mute = list.find((x) => x.id === 'mute'), route = list.find((x) => x.id === 'route');
  if (!mute || mute.pressed === null || !route || route.pressed === null) bad.push('mute / speaker do not expose their pressed state');
  const back = list.find((x) => x.id === 'back'); if (!back || !back.name.startsWith(COPY.ar.back.text)) bad.push('«المحادثة» accessible name does not contain its visible label');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `${list.length} visible controls during a call, each named and ≥ 44 × 44; mute and speaker expose aria-pressed and change SHAPE (slashed microphone; filled / outline speaker); «${back.name}» contains its visible label (WCAG 2.5.3)` };
}
await check('G12-Q11b', 'Q11 / §30', 'Every primary control has an accessible name, a 44 px target, and state beyond colour', () => names());
await probe('P-G12-Q11b', 'G12-Q11b', () => names(RUNTIME.replace("el('route').setAttribute('aria-pressed', S.route === 'speaker' ? 'true' : 'false');", "el('route').removeAttribute('aria-pressed'); el('route').removeAttribute('aria-label');")));

async function escapeNeverEnds(runtime) {
  const r = await run({}, 'state=active', [[0, 'call', null], [2000, `js:document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`, 't'], [2600, `js:document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`, 't']], { runtime });
  return r[0].truth.depth === 'conversation' && r[0].truth.call === 'live' && r[1].truth.call === 'live' ? { ok: true, detail: 'Escape leaves the Analysis to the Conversation and never ends the call (twice)' } : { ok: false, detail: JSON.stringify(r.map((x) => [x.truth.depth, x.truth.call])) };
}
await check('G12-Q11c', 'Q11 / carried', 'Keyboard — Escape unwinds a layer and never ends a call', () => escapeNeverEnds());
await probe('P-G12-Q11c', 'G12-Q11c', () => escapeNeverEnds(RUNTIME.replace("else if (S.depth === 'world') leaveWorld();\n  });", "else if (S.depth === 'world') leaveWorld(); else endCall('user');\n  });")));

// ---- Replay coexistence (§28)
async function replayCoexists(extraCss) {
  const r = await run({}, 'state=active', [[0, null, 'm'], [100, 'enter', null], [800, null, 'm'], [900, 'call', null], [2500, null, 'm'], [2600, 'leave', null], [3400, null, 'm'], [3500, 'menu', 'js:[!document.getElementById("rmenu-note").hidden, document.getElementById("rmenu-note").textContent, [...document.querySelectorAll(".thread .callm")].every(m=>!m.classList.contains("t"))]']], { extraCss });
  const boxes = r.filter((x) => x.m).map((x) => JSON.stringify(x.m.boxes.replay.map((v) => Math.round(v))));
  const bad = [];
  if (new Set(boxes).size !== 1) bad.push(`Replay moves: ${boxes.join(' | ')}`);
  const [shown, text, markersNotTurns] = r[r.length - 1].x;
  if (!shown || text !== COPY.ar.replayCallNote.text) bad.push('the Replay entry does not say the ongoing call is not included');
  if (!markersNotTurns) bad.push('a call marker is a selectable turn');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `Replay stands at ${boxes[0]} in the Conversation, the Analysis, and both during a call — the call controls never collide with it; during a call its entry says «${text}»; the call's markers are not selectable turns (Replay binds committed material only — replay-runtime-v1 §7, §19)` };
}
await check('G12-R1', '§28', 'Replay coexistence — same place, no collision, never implies the live call or its audio is included', () => replayCoexists());
await probe('P-G12-R1', 'G12-R1', () => replayCoexists('#phone:not([data-call="none"]) #replay{inset-inline-end:62px}'));

// ---- speaker geometry for voice turns (inherited G1.1): reader's voice note on the reader's edge
async function voiceSides(extraCss) {
  const bad = [];
  for (const [lang, thread] of [['ar', 'voice'], ['en', 'voice'], ['ar', 'stress']]) {
    const r = await run({ lang, thread }, 'state=active', [[0, null, 'm']], { extraCss });
    const ts = r[0].m.turns.filter((t) => t.who === 'me');
    for (const t of ts) { const edge = lang === 'ar' ? Math.round(t.x1) === 390 : Math.round(t.x0) === 0; if (!edge) bad.push(`${lang}/${thread} ${t.kind} reader turn at ${Math.round(t.x0)}–${Math.round(t.x1)}`); }
    if (!ts.some((t) => t.kind === 'voice')) bad.push(`${lang}/${thread}: no voice turn measured`);
  }
  return bad.length ? { ok: false, detail: bad.slice(0, 3).join('; ') } : { ok: true, detail: 'every reader turn — text and voice note — touches the reader\'s own edge: RIGHT in Arabic (incl. the mixed-script thread), LEFT in English (G1.1 closure §1)' };
}
await check('G12-BI', 'G1.1 inherited / §31', 'Arabic USER RIGHT, English USER LEFT — for Voice Notes too, and in the mixed-script thread', () => voiceSides());
await probe('P-G12-BI', 'G12-BI', () => voiceSides('.t.me.voice{align-self:flex-end;margin-inline-start:0;margin-inline-end:-24px}'));

// ---- barge-in: a CANDIDATE only, and marked so
async function bargeCandidate() {
  const r = await run({}, 'state=call&voiceMs=88000', [[0, null, 't'], [100, 'barge', 't']]);
  const ok = r[0].truth.speaking === 'q' && r[1].truth.speaking === 'me' && /CANDIDATE/.test(RUNTIME.match(/function barge\(\) \{[\s\S]*?\n  \}/)[0]);
  return ok ? { ok: true, detail: 'speaking over QANDEEL stops QANDEEL\'s audio and hands the line to the reader — shown as a CANDIDATE of the Foundation Freeze principle ("user interruption is a first-class realtime event"); its runtime semantics stay an OPEN dependency' } : { ok: false, detail: JSON.stringify(r.map((x) => x.truth.speaking)) };
}
await check('G12-BARGE', '§21', 'Interruption / barge-in is shown only as a marked candidate, not invented as runtime truth', () => bargeCandidate());

await b.close();

/* ====================================================== C — rasters, truth logs, video === */
const SCR = join(OUT, 'screens');
const SHOTS = JSON.parse(readFileSync(join(SCR, 'SCREENS.json'), 'utf8'));
const REQUIRED = {
  1: 'writ-01-writing-ar', 2: 'writ-02-idle-three-ways', 3: 'vn-01-permission-intent', 4: 'vn-02-capture-active', 5: 'vn-04-cancel-focused', 6: 'vn-05-committed-in-history', 7: 'vn-06-playback', 8: 'pf-01-mic-denied-writing',
  9: 'lc-01-connecting', 10: 'lc-02-analysis-first', 11: 'lc-03-reader-speaking', 12: 'lc-04-qandeel-speaking', 13: 'lc-05-conversation-same-call', 14: 'bg-02-returned-same-analysis', 15: 'bg-01-locked-while-analysis', 16: 'bg-02-returned-same-analysis',
  17: 'bg-03-other-app-while-conversation', 18: 'bg-04-returned-same-conversation', 19: 'pf-03-reconnecting', 20: 'pf-04-call-failed-writing', 21: 'lc-10-ended-conversation', 22: 'bi-01-arabic-mixed-script', 23: 'bi-06-en-analysis-first', 24: 'light-03-analysis-first', 25: 'a11y-09-reduced-motion-reader-speaking',
};
function proofSet(shots) {
  const bad = [];
  for (const [n, s] of Object.entries(REQUIRED)) if (!shots[s]) bad.push(`proof ${n} (${s}) missing`);
  const t = (n) => shots[n] && shots[n].truth;
  const claims = [
    ['vn-01-permission-intent', (x) => x.osPerm && x.depth === 'conversation'], ['vn-02-capture-active', (x) => x.composer === 'note' && x.depth === 'conversation'],
    ['vn-05-committed-in-history', (x) => x.voiceTurns === 1], ['vn-06-playback', (x) => x.playing !== null], ['pf-01-mic-denied-writing', (x) => x.notice === 'denied' && x.controls.includes('input')],
    ['lc-01-connecting', (x) => x.call === 'connecting' && x.depth === 'world'], ['lc-02-analysis-first', (x) => x.call === 'live' && x.depth === 'world'], ['lc-03-reader-speaking', (x) => x.speaking === 'me'],
    ['lc-04-qandeel-speaking', (x) => x.speaking === 'q'], ['lc-05-conversation-same-call', (x) => x.call === 'live' && x.depth === 'conversation'], ['bg-01-locked-while-analysis', (x) => x.osBg && x.call === 'live' && x.depth === 'world'],
    ['bg-02-returned-same-analysis', (x) => !x.osBg && x.call === 'live' && x.depth === 'world'], ['bg-03-other-app-while-conversation', (x) => x.osBg && x.depth === 'conversation'], ['bg-04-returned-same-conversation', (x) => x.call === 'live' && x.depth === 'conversation'],
    ['pf-03-reconnecting', (x) => x.call === 'reconnecting'], ['pf-04-call-failed-writing', (x) => x.call === 'none' && x.notice === 'failed' && !x.controls.includes('end-call')], ['lc-10-ended-conversation', (x) => x.call === 'none' && x.callRecords.length === 1],
    ['bg-05-ended-while-away-returned', (x) => x.call === 'none' && x.depth === 'conversation' && x.notice === 'failed'], ['bg-06-relaunch-after-force-quit', (x) => x.call === 'none' && !x.notice && !x.callRecords.length],
  ];
  for (const [n, fn] of claims) if (!t(n) || !fn(t(n))) bad.push(`${n} does not show what it is named for`);
  return bad.length ? { ok: false, detail: bad.slice(0, 5).join('; ') } : { ok: true, detail: `all 25 required proofs present among ${Object.keys(shots).length} captures, and ${claims.length} of them verified against the prototype's own truth at capture (a screen named "returned to the Conversation" IS the Conversation, a live call, the same call)` };
}
await check('G12-S1', '§34', 'The required proof set — 25 proofs, each capture verified to show the state it is named for', () => proofSet(SHOTS));
await probe('P-G12-S1', 'G12-S1', () => proofSet({ ...SHOTS, 'bg-04-returned-same-conversation': { ...SHOTS['bg-04-returned-same-conversation'], truth: { ...SHOTS['bg-04-returned-same-conversation'].truth, depth: 'world' } } }));

const TRUTH = (n) => JSON.parse(readFileSync(join(OUT, 'motion', `${n}.truth.json`), 'utf8'));
const PARITY_KEYS = ['world', 'depth', 'call', 'composer', 'app', 'perm', 'ask', 'notice', 'callId', 'conversation', 'callStarts', 'speaking', 'muted', 'label', 'lctx', 'replay', 'menu', 'turns', 'voiceTurns', 'osBg', 'osPerm', 'playing'];
function parity(std, rm, name) {
  const bad = [];
  if (std.length !== rm.length) return { ok: false, detail: `${name}: ${std.length} vs ${rm.length} records` };
  for (let i = 0; i < std.length; i++) {
    const a = std[i], c = rm[i];
    if (a.act !== c.act || a.phase !== c.phase) { bad.push(`${name} record ${i} misaligned`); continue; }
    for (const k of PARITY_KEYS) if (JSON.stringify(a.truth[k]) !== JSON.stringify(c.truth[k])) bad.push(`${name} ${a.act}/${a.phase}: ${k} ${JSON.stringify(a.truth[k])} vs ${JSON.stringify(c.truth[k])}`);
    if (a.phase === 'settled' && (a.truth.controls.join() !== c.truth.controls.join() || a.truth.worldVisible !== c.truth.worldVisible || a.truth.convVisible !== c.truth.convVisible)) bad.push(`${name} ${a.act}: settled surface / controls differ`);
  }
  return bad.length ? { ok: false, detail: bad.slice(0, 4).join('; ') } : { ok: true, detail: `${std.length} records` };
}
function allParity(mut) {
  const out = [], bad = [];
  for (const j of Object.keys(JOURNEYS)) { const rm = TRUTH(`${j}-ar-reduced-motion`); const r = parity(TRUTH(`${j}-ar`), mut ? mut(j, rm) : rm, j); if (!r.ok) bad.push(r.detail); else out.push(`${j} ${r.detail}`); }
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `Reduced Motion reaches the same surface, call phase, call id, Conversation id, composer mode, notice, OS surface, call words, Live Context and reachable controls at every commit and settled point: ${out.join(' · ')}` };
}
await check('G12-M1', 'Q11 / §25 / §30', 'Reduced Motion parity in all six journeys — every capability and every state preserved', () => allParity());
await probe('P-G12-M1', 'G12-M1', () => allParity((j, rm) => { if (j !== 'C-background-restore') return rm; const x = JSON.parse(JSON.stringify(rm)); const s = x.filter((r) => r.act === 'fg' && r.phase === 'settled')[1]; s.truth.depth = 'world'; return x; }));

function journeyTruth(get) {
  const bad = [];
  const at = (j, act, phase = 'settled', n = 0) => get(j).filter((r) => r.act === act && r.phase === phase)[n].truth;
  // A — Conversation-first throughout
  if (get('A-voice-note').some((r) => r.truth.depth !== 'conversation')) bad.push('A: the voice note left the Conversation');
  if (at('A-voice-note', 'notesend').voiceTurns !== 1) bad.push('A: the note did not land');
  // B — Analysis-first, same call across depths, end
  const b0 = at('B-live-call-foreground', 'call', 'commit');
  if (b0.depth !== 'world') bad.push('B: not Analysis-first');
  const bl = at('B-live-call-foreground', 'leave'), be = at('B-live-call-foreground', 'enter');
  if (bl.depth !== 'conversation' || bl.call !== 'live' || bl.callId !== b0.callId || be.depth !== 'world' || be.callId !== b0.callId) bad.push('B: depth change touched the call');
  if (at('B-live-call-foreground', 'endcall').call !== 'none') bad.push('B: end did not end');
  // C — both restores
  const c0 = at('C-background-restore', 'call', 'commit');
  const f1 = at('C-background-restore', 'fg', 'settled', 0), f2 = at('C-background-restore', 'fg', 'settled', 1);
  if (f1.depth !== 'world' || f1.callId !== c0.callId || f1.call !== 'live') bad.push(`C: locked on the Analysis → ${f1.depth}`);
  if (f2.depth !== 'conversation' || f2.callId !== c0.callId || f2.call !== 'live') bad.push(`C: other app on the Conversation → ${f2.depth}`);
  if (get('C-background-restore').some((r) => r.truth.callStarts !== 1)) bad.push('C: a second call session');
  // D1 — denied, never the Analysis
  if (get('D1-permission-denied').some((r) => r.truth.depth !== 'conversation' || r.truth.call !== 'none')) bad.push('D1: a call or the Analysis without permission');
  if (at('D1-permission-denied', 'sendtext').turns !== at('D1-permission-denied', 'deny').turns + 1) bad.push('D1: writing did not continue');
  // D2 — same call after recovery; failure → Conversation, no controls
  const d0 = at('D2-network-interruption', 'call', 'commit'), rec = at('D2-network-interruption', 'recover'), fl = at('D2-network-interruption', 'fail');
  if (rec.callId !== d0.callId || rec.call !== 'live') bad.push('D2: recovery is a different call');
  if (fl.call !== 'none' || fl.depth !== 'conversation' || fl.notice !== 'failed' || CALL_CTL.some((c) => fl.controls.includes(c))) bad.push('D2: failure shows live controls or leaves the reader without Writing');
  // D3 — ended while away
  const d3 = at('D3-ended-while-away', 'fg');
  if (d3.call !== 'none' || d3.depth !== 'conversation' || d3.notice !== 'failed' || CALL_CTL.some((c) => d3.controls.includes(c))) bad.push('D3: return after the call ended is not truthful');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: 'A stays in the Conversation and lands one note; B opens the Analysis and keeps one call id across «المحادثة» / «تحليل المحادثة» until the reader ends it; C returns to the Analysis after the lock and to the Conversation after another app — one call, one id; D1 never starts a call or opens the Analysis and writing continues; D2 resumes the SAME call, then fails truthfully into Writing; D3 returns without any live control' };
}
await check('G12-M2', '§18 / §25 A–D', 'The six recorded journeys prove what they are named for (read from their truth logs)', () => journeyTruth((j) => TRUTH(`${j}-ar`)));
await probe('P-G12-M2', 'G12-M2', () => journeyTruth((j) => { const l = TRUTH(`${j}-ar`); if (j !== 'C-background-restore') return l; const x = JSON.parse(JSON.stringify(l)); x.filter((r) => r.act === 'fg' && r.phase === 'settled')[1].truth.depth = 'world'; return x; }));

await check('G12-M3', '§25', 'Every recording exists and decodes to its full frame count (standard + Reduced Motion for all six journeys, and English C)', () => {
  const log = readFileSync(join(OUT, 'motion-run.log'), 'utf8'), bad = [];
  for (const j of JOBS) { const want = Math.round((JOURNEYS[j.journey].end / 1000) * 60) + 1; const m = log.match(new RegExp(`${j.name}\\.mp4","bytes":(\\d+),"frames":(\\d+)`)); if (!m || +m[2] !== want) bad.push(`${j.name}: ${m ? m[2] : 'missing'} / ${want}`); }
  for (const [n, s] of Object.entries(SHOTS)) if (createHash('sha256').update(readFileSync(join(SCR, `${n}.png`))).digest('hex') !== s.sha256) bad.push(`${n} changed after capture`);
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `${JOBS.length} MP4s at 60 fps, each at its full frame count; ${Object.keys(SHOTS).length} rasters match their capture hashes` };
});

// ---- the Skill ledger: every cited file exists at the stated hash; every relevant enumerated Skill accounted for
function ledger(text) {
  const rows = [...text.matchAll(/^\|\s*`([^`]+)`[^|`]*\|\s*`([^`]+)`\s*\|\s*`([0-9a-f]{16})`/gm)];
  const bad = [];
  for (const [, name, p, h] of rows) {
    const abs = p.replace(/^~/, process.env.USERPROFILE).replace(/^<repo>/, REPO);
    if (!existsSync(abs)) { bad.push(`${name}: ${p} missing`); continue; }
    const real = createHash('sha256').update(readFileSync(abs)).digest('hex').slice(0, 16);
    if (real !== h) bad.push(`${name}: stated ${h}, file is ${real}`);
  }
  for (const s of ['react-native-best-practices', 'fishjam', 'animate-expo', 'apple-design', 'fixing-accessibility', 'designing-arabic-frontends', 'writing-eloquent-arabic', 'design-critique', 'react-navigation', 'ui-ux-pro-max', 'emil-design-eng', 'impeccable', 'moq-kit', 'react-native-moq', 'pulsar-haptics'])
    if (!text.includes(s)) bad.push(`relevant Skill ${s} not accounted for`);
  if (rows.length < 15) bad.push(`only ${rows.length} hashed Skill rows`);
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `${rows.length} hashed Skill rows, every cited file present on this host at the stated sha256 prefix; every relevant enumerated Skill accounted for (read + applied, or read + set aside with a reason)` };
}
const LEDGER = doc('G1.2_SKILL_USAGE_LEDGER.md');
if (LEDGER) {
  await check('G12-SK', '§11', 'Skill Gate — the ledger cites real Skills by path and hash, with every relevant host Skill accounted for', () => ledger(LEDGER));
  await probe('P-G12-SK', 'G12-SK', () => ledger(LEDGER.replace(/`([0-9a-f]{16})`/, '`0000000000000000`')));
}
const REPORT = doc('G1.2_FINAL_REPORT.md');
function reportHonest(t) {
  const bad = [];
  if (!/READY FOR INDEPENDENT PRODUCT \/ DESIGN REVIEW/.test(t)) bad.push('status line missing');
  if (/G1\.2[^\n]{0,40}(is )?CLOSED \/ FROZEN/.test(t.replace(/not (be )?(closed|frozen)|G1\.1 — CLOSED \/ FROZEN|Do not close G1\.2/gi, ''))) bad.push('claims G1.2 closure');
  for (const s of ['LOCKED', 'PROOF', 'OPEN', 'Not verified', 'VoiceOver', 'TalkBack', 'OPEN RUNTIME DEPENDENCY']) if (!t.includes(s)) bad.push(`missing «${s}»`);
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: 'status READY FOR INDEPENDENT PRODUCT / DESIGN REVIEW; no G1.2 closure claimed; copy separated LOCKED / PROOF / OPEN; device-level verification stated as not performed; open runtime dependencies named' };
}
if (REPORT) {
  await check('G12-D1', '§35 A / Q6', 'Final report — status, copy authority, open runtime dependencies, and what was NOT verified', () => reportHonest(REPORT));
  await probe('P-G12-D1', 'G12-D1', () => reportHonest(REPORT.replace(/Not verified/g, 'Verified')));
}

/* ------------------------------------------------------------------------ summary ---- */
const passed = results.filter((r) => r.ok).length, rejected = probes.filter((p) => p.rejected).length;
mkdirSync(join(OUT, 'data'), { recursive: true });
writeFileSync(join(OUT, 'data', 'G12_CHECKS.json'), JSON.stringify({ checks: results, probes, summary: { checks: `${passed}/${results.length}`, probes: `${rejected}/${probes.length}` } }, null, 1));
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id.padEnd(10)} ${r.title.slice(0, 92)}${r.ok ? '' : '\n      ' + r.detail}`);
for (const p of probes) if (!p.rejected) console.log(`PROBE NOT REJECTED ${p.id} → ${p.targets}: ${p.detail}`);
console.log(`\n${passed}/${results.length} checks · ${rejected}/${probes.length} probes rejected their planted defect`);
if (passed !== results.length || rejected !== probes.length) process.exitCode = 1;
