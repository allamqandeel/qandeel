// G1.1-R3 — verification. Every R3 acceptance gate (brief §20) is at least one check here, and every check
// that can be defeated carries a PROBE: a deliberately planted defect the check must reject. A check that
// cannot fail is a sentence.
//
// Layers: A = pure Node over the source, B = Chrome over the live prototype, C = over the shipped rasters,
// the motion truth logs and the MP4s.
import { readFileSync, writeFileSync, existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { palette } from '../src/tokens.mjs';
import { COPY, THREAD, NEW_THREAD, STRESS, VOICE_TURNS, SHARED_WORLDS, OPENER, DISPLAY_NAME, openerText, messagesCount } from '../src/content.mjs';
import { page, paragraphDir } from '../src/build.mjs';
import { launch } from './cdp.mjs';
import { decode } from '../vendor/png.mjs';
import { contrastHex, hexToRgb8 } from '../vendor/color.mjs';
import { JOURNEY, JOURNEY_END, JOBS } from './motion.mjs';

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
/** A probe PASSES when the check it targets FAILS on the planted defect. */
async function probe(id, targets, fn) {
  let rejected = false, detail = '';
  try { const r = await fn(); rejected = r === false || (r && r.ok === false); detail = r && r.detail ? r.detail : ''; }
  catch (e) { rejected = true; detail = 'threw: ' + String(e.message || e).slice(0, 200); }
  probes.push({ id, targets, rejected, detail });
}
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
const cssOf = (o = {}) => stripComments(page({ lang: 'ar', appearance: 'dark', capture: true, ...o }).match(/<style>([\s\S]*?)<\/style>/)[1]);
const RUNTIME = readFileSync(join(WORK, 'src', 'runtime.js'), 'utf8');

/* ============================================================== A — source, no browser === */

// ---- R3-01: the opener, byte for byte. The expected strings are typed here from the brief (§2), NOT
// imported from content.mjs — a check that reads its expectation from the thing it checks cannot fail.
const LOCKED_OPENER_AR = 'اهلا يا {display_name} ... انا في انتظارك ... يلا نبدأ';
const LOCKED_OPENER_EN = 'Hi {display_name} ... I\'m here waiting for you ... let\'s get started';
function openerLocked(o) {
  const hex = (s) => Buffer.from(s, 'utf8').toString('hex');
  if (hex(o.ar) !== hex(LOCKED_OPENER_AR)) return { ok: false, detail: `ar opener differs from the brief: «${o.ar}»` };
  if (o.en !== LOCKED_OPENER_EN) return { ok: false, detail: `en opener differs: «${o.en}»` };
  return { ok: true, detail: `ar ${Buffer.byteLength(o.ar)} bytes identical to the brief (sha256 ${createHash('sha256').update(o.ar).digest('hex').slice(0, 12)}…); {display_name} is the only placeholder` };
}
await check('R3-01a', 'G1.1-R3-01', 'The Arabic new-conversation opener is byte-for-byte the locked wording (and the English is the approved line)', () => openerLocked(OPENER));
await probe('P-R3-01a', 'R3-01a', () => openerLocked({ ...OPENER, ar: 'اهلا يا {display_name} ... انا مستنيك ... يلا نبدأ' }));
await probe('P-R3-01a2', 'R3-01a', () => openerLocked({ ...OPENER, ar: 'أهلاً يا {display_name} ... أنا في انتظارك ... يلا نبدأ' }));

// ---- carried invariants
function tokenAgreement(planted) {
  const p = palette('dark');
  const brief = { world: '#101010', surface: '#181818', functional: '#181818', brass: '#a58e6f', ...planted };
  for (const [k, v] of Object.entries(brief)) if (p.colors[k] !== v) return { ok: false, detail: `${k} ${p.colors[k]} ≠ ${v}` };
  return { ok: true, detail: `every painted colour resolves from the vendored token tree; the reader slab's ${p.colors.functional} is qandeel.surface.functional (${p.routes.functional.join(' → ')}), the same value as every Surface role — no new colour` };
}
await check('A01', 'carried', 'Token agreement — resolved values match the frozen literals; the slab tone is the ONE functional Surface value', () => tokenAgreement({}));
await probe('P-A01', 'A01', () => tokenAgreement({ functional: '#1d1d1d' }));

const WORLD_TYPES = (() => { const src = readFileSync(join(WORK, 'vendor', 'canon', 'world.types.ts'), 'utf8'); const m = src.match(/WORLD_TYPES\s*=\s*\[([^\]]+)\]/); return m[1].match(/'([A-Z_]+)'/g).map((s) => s.slice(1, -1)); })();
function destinations(keys) {
  const map = { mine: 'MY_WORLD', shared: 'SHARED_WORLD', public: 'PUBLIC_WORLD' };
  const got = keys.map((k) => map[k] || k);
  if (got.length !== WORLD_TYPES.length || got.some((g, i) => g !== WORLD_TYPES[i])) return { ok: false, detail: `rail ${got} vs kernel ${WORLD_TYPES}` };
  return { ok: true, detail: `rail = kernel WORLD_TYPES [${WORLD_TYPES.join(', ')}]: no Replay, Voice-Note, Call or Analysis destination` };
}
await check('A02', 'G1.1-R3-07 / R3-09', 'The rail carries exactly the three canonical World types — no mode and no Replay is a destination', () => {
  for (const L of ['ar', 'en']) { const r = destinations(COPY[L].nav.items.map((i) => i.key)); if (!r.ok) return r; }
  return destinations(COPY.ar.nav.items.map((i) => i.key));
});
await probe('P-A02', 'A02', () => destinations(['mine', 'shared', 'public', 'replay']));

function brassContainment(css) {
  const allowed = ['#rail .lb', '.t.opener .qm'];
  const off = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*var\(--(?:brass|mark)\)[^{}]*)\}/g)) {
    const sel = m[1].trim(); if (sel.startsWith('#phone[data-appearance')) continue;
    if (!allowed.includes(sel)) off.push(sel);
  }
  return off.length ? { ok: false, detail: `Brass painted by: ${off.join(' | ')}` } : { ok: true, detail: `Living Brass reaches only: ${allowed.join(', ')} — never a speaker, a mode or Replay` };
}
await check('A03', 'carried', 'BRASS IS MATTER — only the World rail labels and the one opener Q reach the Living Brass variables (Brass is no speaker code)', () => brassContainment(cssOf()));
await probe('P-A03', 'A03', () => brassContainment(cssOf() + '\n.t.me{color:var(--brass)}'));

function brassInvariance(css) {
  const bad = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (/(\.sel|\.prs|\.f-demo|:focus|\[aria-current)/.test(m[1]) && /\.lb\b/.test(m[1]) && /(^|;)\s*color\s*:/.test(m[2]) && /#rail/.test(m[1])) bad.push(m[1].trim());
  return bad.length ? { ok: false, detail: bad.join(' | ') } : { ok: true, detail: 'no state selector repaints a navigation label' };
}
await check('A04', 'carried', 'Living Brass is state-invariant — no SELECTED / PRESSED / FOCUS rule repaints a rail label', () => brassInvariance(cssOf()));
await probe('P-A04', 'A04', () => brassInvariance(cssOf() + '\n#rail .it.sel .lb{color:var(--primary)}'));

const ILLUM = ['#fbf2db', '#e8ddc2', '#d6caa9', '#fff6df', '#ddd4be', '#bcb39e'];
function noLight(css) { const hit = ILLUM.filter((h) => css.toLowerCase().includes(h)); return hit.length ? { ok: false, detail: `Meaning Light in shell CSS: ${hit}` } : { ok: true, detail: 'no QANDEEL Light stop in the shell — the Analysis spectacle is G2\'s' }; }
await check('A05', 'G1.1-R3-14', 'LIGHT IS MEANING — the shell references no Meaning Light stop; R3 adds no Analysis visual', () => noLight(cssOf()));
await probe('P-A05', 'A05', () => noLight(cssOf() + '.t.q{color:#fbf2db}'));

function motionHygiene(src) {
  const s = stripComments(src);
  const banned = [[/@keyframes/, '@keyframes'], [/\banimation\s*:/, 'CSS animation'], [/\btransition\s*:/, 'CSS transition'], [/ease-in(?!-out)/, 'ease-in'],
    [/infinite|withRepeat/, 'infinite repeat'], [/breath|pulse|shimmer|ripple/i, 'rejected motion vocabulary'], [/blur\(/, 'blur']];
  const hits = banned.filter(([re]) => re.test(s)).map(([, n]) => n);
  const curves = [...s.matchAll(/bezier\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/g)].map((m) => m.slice(1).join(','));
  const other = curves.filter((c) => c !== '0.23,1,0.32,1'); if (other.length) hits.push(`second curve ${other}`);
  const durs = RUNTIME.match(/var DUR = \{([^}]+)\}/)[1];
  return hits.length ? { ok: false, detail: hits.join('; ') } : { ok: true, detail: `one curve; no keyframes / transitions / loops; R3 adds no duration (${durs.trim()})` };
}
await check('A06', 'carried', 'T-10 motion hygiene — one easing curve, no ease-in, no keyframes, no loops, no decorative motion', () => motionHygiene(RUNTIME + '\n' + cssOf()));
await probe('P-A06', 'A06', () => motionHygiene(RUNTIME + '\n' + cssOf() + '\n.t.me{animation:swell 2s infinite}'));

function copyStrings() {
  const out = [];
  const walk = (o, where) => { if (typeof o === 'string') out.push({ where, text: o }); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (!['status', 'dir', 'lang', 'kind', 'case', 'dur', 'who', 'day', 'time'].includes(k)) walk(v, `${where}.${k}`); };
  walk(COPY, 'COPY'); walk(THREAD, 'THREAD'); walk(STRESS, 'STRESS'); walk(VOICE_TURNS, 'VOICE'); walk(SHARED_WORLDS, 'SHARED');
  return out.filter((s) => !s.where.includes('publicNote'));
}
function copyHygiene(strings) {
  const bad = [];
  const t1Imperatives = /(^|\s)(اكتب|ابدأ|اضغط|جرّب|ابعت|شوف|افتح|اقفل|سجّل|تقدر|اختار|حدّد|اختر)(\s|$)/;
  for (const s of strings) {
    if (/[!！]/.test(s.text)) bad.push(`${s.where}: exclamation`);
    if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(s.text)) bad.push(`${s.where}: emoji`);
    if (/بيفكّر|بيفكر|Thinking|Ask anything/i.test(s.text)) bad.push(`${s.where}: AI-cliché`);
    if (s.where.startsWith('COPY.ar') && t1Imperatives.test(s.text)) bad.push(`${s.where}: gendered imperative in fixed chrome`);
  }
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `${strings.length} strings: no «!», no emoji, no "Thinking", no gendered T1 imperative (the R3 part-selection hint is written without a second-person verb)` };
}
await check('A07', 'carried', 'Copy hygiene (VI-01 §15, §3.6): no exclamation, no emoji, no anthropomorphised latency, no gendered fixed imperative', () => copyHygiene(copyStrings()));
await probe('P-A07', 'A07', () => copyHygiene([...copyStrings(), { where: 'COPY.ar.probe', text: 'حدّد أول رسالة' }]));

const P = { dark: palette('dark').colors, light: palette('light').colors };
const PAIRS = [];
for (const a of ['dark', 'light']) {
  const c = P[a];
  PAIRS.push([a, c.primary, c.world, 4.5, 'QANDEEL turn on World'], [a, c.primary, c.functional, 4.5, 'reader turn on its slab'], [a, c.secondary, c.functional, 4.5, 'voice-note transcript on the slab'],
    [a, c.secondary, c.world, 4.5, 'QANDEEL voice-reply text on World'], [a, c.tertiary, c.world, 4.5, 'day / call marker on World'], [a, c.tertiary, c.functional, 4.5, 'voice-note duration on the slab'],
    [a, c.restInk, c.world, 4.5, '«تحليل المحادثة» / Replay on World'], [a, c.restInk, c.surface, 4.5, 'mode controls on the composer Surface'],
    [a, c.brass, c.surface, 4.5, 'rail label (Brass) on Surface'], [a, c.primary, c.surface, 4.5, 'call / recording label, Replay menu items'],
    [a, c.tertiary, c.functional, 3, 'waveform bars (non-text)'], [a, c.selectedMarker, c.world, 3, 'part-selection mark (non-text)'], [a, c.tertiary, c.world, 3, 'unselected ring (non-text)'],
    [a, c.primary, c.surface, 3, 'call level trace, end-call ring (non-text)'], [a, c.focusIndicator, c.world, 3, 'focus vs World'], [a, c.focusIndicator, c.surface, 3, 'focus vs Surface']);
}
function contrastPairs(set) {
  const fails = [], rows = [];
  for (const [a, fg, bg, min, what] of set) { const r = contrastHex(fg, bg); rows.push(`${a} ${what} ${r.toFixed(2)}`); if (r < min) fails.push(`${a} ${what} ${r.toFixed(2)} < ${min}`); }
  return fails.length ? { ok: false, detail: fails.join('; ') } : { ok: true, detail: rows.join(' · ') };
}
await check('A08', 'G1.1-R3-12', 'Contrast — every text pair ≥ 4.5:1 and every meaningful non-text mark ≥ 3:1, both appearances, including the slab, the voice row and the part marks', () => contrastPairs(PAIRS));
await probe('P-A08', 'A08', () => contrastPairs([...PAIRS, ['dark', P.dark.tertiary, '#5a5a58', 4.5, 'planted']]));

await check('A09', 'G1.1-R3-14', 'The Analysis imagery is the sealed F2 fixture world, unchanged (hash) — G1.1 does not redesign the Analysis', () => {
  const rec = JSON.parse(readFileSync(join(OUT, 'world', 'WORLD_CROP_PROVENANCE.json'), 'utf8'));
  for (const r of rec) {
    const src = readFileSync(join(REPO, r.source));
    if (createHash('sha256').update(src).digest('hex') !== r.sourceSha256) return { ok: false, detail: `${r.source} changed` };
    if (createHash('sha256').update(readFileSync(join(OUT, 'world', r.output))).digest('hex') !== r.outputSha256) return { ok: false, detail: `${r.output} changed` };
  }
  return { ok: true, detail: rec.map((r) => `${r.output} ← ${r.source.split('/').pop()} ${r.sourceSha256.slice(0, 12)}…`).join('; ') };
});

const DIR_CASES = [
  ['عندي presentation للـclient يوم الخميس الساعة 10:30، ولسه مخلّصتش.', 'ar', 'rtl'],
  ['Q3 numbers لسه ما وصلتش، هبعتهالك أول ما توصل.', 'ar', 'rtl'],
  ['Subject: "Q3 review — final numbers (v2.3)"', 'ar', 'ltr'],
  [openerText('ar', 'Nour'), 'ar', 'rtl'],
  ['10:30', 'ar', 'rtl'], ['10:30', 'en', 'ltr'],
  [openerText('en'), 'en', 'ltr'],
];
function dirRule(fn) {
  const bad = DIR_CASES.filter(([t, l, want]) => fn(t, COPY[l].dir) !== want).map(([t, , want]) => `«${t.slice(0, 26)}…» expected ${want}`);
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `${DIR_CASES.length} cases incl. a Latin-first Arabic sentence (rtl), a pasted English line (ltr) and the opener with a Latin display name (rtl)` };
}
await check('A10', 'G1.1-R3-03', 'Paragraph direction follows the script that carries the sentence, and the page inlines exactly this rule', () => {
  const r = dirRule(paragraphDir); if (!r.ok) return r;
  if (!page({ lang: 'ar', appearance: 'dark', capture: true }).includes(`<script>${readFileSync(join(WORK, 'src', 'bidi.js'), 'utf8')}</script>`)) return { ok: false, detail: 'prototype does not inline src/bidi.js verbatim' };
  return { ok: true, detail: r.detail + '; prototype inlines src/bidi.js verbatim' };
});
const firstStrong = (t, fb) => { for (const ch of t) { if (/[֐-ࣿ]/.test(ch)) return 'rtl'; if (/[A-Za-z]/.test(ch)) return 'ltr'; } return fb; };
await probe('P-A10', 'A10', () => dirRule(firstStrong));

function speakerMaterial(css) {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /\.t\.(me|q)\b/.test(m[1]) && !/\.vn|\.tx|\.qm|#picks/.test(m[1]));
  const bad = []; let fill = null;
  for (const [, sel, body] of rules) {
    if (/box-shadow|filter|gradient|opacity/.test(body)) bad.push(`${sel.trim()}: shadow/filter/gradient/opacity`);
    const bg = body.match(/background(?:-color)?\s*:\s*([^;]+)/);
    if (bg) { if (bg[1].trim() !== 'var(--functional)') bad.push(`${sel.trim()}: fill ${bg[1].trim()}`); else fill = sel.trim(); }
    if (/var\(--(brass|mark|error)\)|#[0-9a-f]{3,8}/i.test(body)) bad.push(`${sel.trim()}: literal / Brass / status colour`);
  }
  if (!fill) bad.push('no reader fill');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `${rules.length} speaker rules; the only fill is var(--functional) on ${fill}; no shadow, literal, Brass or status colour` };
}
await check('A11', 'G1.1-R3-05', 'The slab uses only the one functional Surface tone — no shadow, no second tone, no hue, no Brass', () => speakerMaterial(cssOf()));
await probe('P-A11', 'A11', () => speakerMaterial(cssOf() + '\n.t.me{background:#23303a}'));

function namingSource(L) {
  const bad = [];
  for (const lang of ['ar']) {
    const c = L[lang];
    if (c.door.text !== 'تحليل المحادثة') bad.push(`door «${c.door.text}»`);
    if (c.back.text !== 'المحادثة') bad.push(`back «${c.back.text}»`);
    for (const k of ['door', 'back', 'backName', 'backNameCall']) if (/العالم/.test(c[k].text)) bad.push(`${k} names «العالم»`);
  }
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: 'from Conversation «تحليل المحادثة», from Analysis «المحادثة»; no Analysis route or name contains «العالم»' };
}
await check('R3-06a', 'G1.1-R3-06', 'Analysis naming (source) — «تحليل المحادثة» from Conversation, «المحادثة» from Analysis, never «العالم»', () => namingSource(COPY));
await probe('P-R3-06a', 'R3-06a', () => namingSource({ ...COPY, ar: { ...COPY.ar, door: { text: 'العالم' } } }));

function sharedNeutral(L) {
  const bad = [];
  for (const lang of ['ar', 'en']) {
    const t = L[lang].nav.items.find((i) => i.key === 'shared').text;
    if (/عالم|عوالم|world/i.test(t)) bad.push(`${lang} rail «${t}» carries a count-bearing World noun`);
  }
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `rail «${L.ar.nav.items[1].text}» / "${L.en.nav.items[1].text}" — no singular or plural World noun that a count could falsify` };
}
await check('R3-11a', 'G1.1-R3-11', 'Shared area — the primary navigation label is count-neutral', () => sharedNeutral(COPY));
await probe('P-R3-11a', 'R3-11a', () => sharedNeutral({ ...COPY, ar: { ...COPY.ar, nav: { ...COPY.ar.nav, items: [COPY.ar.nav.items[0], { key: 'shared', text: 'عوالم مشتركة' }, COPY.ar.nav.items[2]] } } }));

function countGrammar(fn) {
  const want = { 1: 'رسالة واحدة', 2: 'رسالتين', 3: '3 رسائل', 10: '10 رسائل', 11: '11 رسالة', 20: '20 رسالة' };
  const bad = Object.entries(want).filter(([n, w]) => fn('ar', +n) !== w).map(([n, w]) => `${n}: «${fn('ar', +n)}» ≠ «${w}»`);
  if (fn('en', 1) !== '1 message' || fn('en', 4) !== '4 messages') bad.push('en');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: 'Arabic counted noun: 1 واحدة · 2 dual · 3–10 plural · 11+ singular — the part summary cannot misstate its count' };
}
await check('R3-13b', 'G1.1-R3-12', 'Replay part summary uses true Arabic count grammar', () => countGrammar(messagesCount));
await probe('P-R3-13b', 'R3-13b', () => countGrammar((l, n) => (l === 'en' ? (n === 1 ? '1 message' : `${n} messages`) : `${n} رسالة`)));

function replaySourceTruth(html) {
  const menu = html.match(/<div id="rmenu"[\s\S]*?<\/div>/)[0];
  const names = [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]).filter((n) => /إعادة|Replay/.test(n));
  const claim = /صوت|audio|sound|تسجيل المكالمة|recording/i;
  const bad = [];
  if (claim.test(menu.replace(/<[^>]+>/g, ''))) bad.push('Replay entry claims audio');
  for (const n of names) if (claim.test(n)) bad.push(`«${n}» claims audio`);
  const boundary = html.match(/<div id="rprev"[\s\S]*?PROOF BOUNDARY([\s\S]*?)<\/div>/);
  if (!boundary || !/NOT a producible Replay source/.test(boundary[1])) bad.push('the preview step does not state the audio boundary');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: 'no Replay string offers or implies original audio; the preview boundary states that Personal Live Call / Voice Note audio is not a producible source (replay-runtime-v1 §7)' };
}
await check('R3-10a', 'G1.1-R3-10', 'Replay truth — nothing claims that Personal original Live Call audio is Replay-producible', () => replaySourceTruth(page({ lang: 'ar', appearance: 'dark', capture: true })));
await probe('P-R3-10a', 'R3-10a', () => replaySourceTruth(page({ lang: 'ar', appearance: 'dark', capture: true }).replace('المحادثة كاملة</span>', 'المحادثة كاملة بالصوت</span>')));

/* ============================================================ B — the live prototype ===== */
const b = await launch({ port: 9349 });
const tmp = mkdtempSync(join(tmpdir(), 'g11r3-chk-'));
async function open(build, q, { w = 390, h = 844, scheme = 'dark', rm = false } = {}) {
  await b.viewport({ width: w, height: h, dpr: 2 });
  await b.media({ scheme, reducedMotion: rm ? 'reduce' : 'no-preference' });
  const f = join(tmp, `p${Math.random().toString(36).slice(2)}.html`);
  writeFileSync(f, page({ capture: true, ...build }));
  await b.goto('file:///' + f.replace(/\\/g, '/') + '?capture=1&' + q);
  await b.eval(`document.fonts.ready.then(()=>Promise.all([400,500,600].map(w=>document.fonts.load(w+' 17px Estedad')))).then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))`);
  await b.eval(`window.__G11rt.remeasure()`);
}
const PAGE_EVAL = String.raw`(() => {
  const ph = document.getElementById('phone'), P0 = ph.getBoundingClientRect(), W = P0.width;
  const vis = (e) => { if (!e || !e.getClientRects().length) return false; let p = e; while (p && p !== ph) { if (p.hasAttribute('inert') || p.hidden) return false; const c = getComputedStyle(p); if (c.visibility === 'hidden' || c.display === 'none' || +c.opacity < 0.5) return false; p = p.parentElement; } return true; };
  const texts = [...ph.querySelectorAll('*')].filter((e) => !e.closest('.sr') && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && vis(e));
  const arabic = /[؀-ۿ]/;
  const out = { W, dir: ph.getAttribute('dir'), spacing: [], italics: [], leading: [], family: [], overflow: [], names: [], targets: [], labelInName: [], visibleText: [], tabbable: [] };
  for (const e of texts) {
    const cs = getComputedStyle(e);
    if (!(cs.letterSpacing === 'normal' || parseFloat(cs.letterSpacing) === 0)) out.spacing.push(e.className + ':' + cs.letterSpacing);
    if (arabic.test(e.textContent) && cs.fontStyle !== 'normal') out.italics.push(e.className);
    if (!/Estedad/.test(cs.fontFamily) && !e.closest('.status,.boundary')) out.family.push(e.tagName + '.' + e.className + ':' + cs.fontFamily);
    if (arabic.test(e.textContent) && !e.closest('.boundary')) { const lh = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize); if (!(lh >= 1.63)) out.leading.push((e.className || e.tagName) + ' ' + lh.toFixed(3)); }
    const rg = document.createRange(); rg.selectNodeContents(e); const r = rg.getBoundingClientRect(); if (r.width && (r.left - P0.left < -0.5 || r.right - P0.left > W + 0.5)) out.overflow.push((e.className || e.tagName) + ' [' + (r.left - P0.left).toFixed(1) + ',' + (r.right - P0.left).toFixed(1) + ']');
    if (e.closest('#hdr,#world,#composer,#rmenu')) out.visibleText.push(e.textContent.trim());
  }
  for (const btn of ph.querySelectorAll('button,input')) {
    if (btn.tagName === 'INPUT') { const l = document.querySelector('label[for="' + btn.id + '"]'); if (!l || !l.textContent.trim()) out.names.push('input#' + btn.id); continue; }
    const name = (btn.getAttribute('aria-label') || btn.textContent || '').trim();
    if (!name) out.names.push(btn.id || btn.className);
    const vt = btn.textContent.trim(), al = btn.getAttribute('aria-label');
    if (al && vt && !al.toLowerCase().includes(vt.toLowerCase())) out.labelInName.push((btn.id || btn.className) + ': «' + vt + '» ∉ «' + al + '»');
    if (vis(btn)) { const r = btn.getBoundingClientRect(); if (r.width < 43.5 || r.height < 43.5) out.targets.push((btn.id || btn.className) + ' ' + r.width.toFixed(0) + 'x' + r.height.toFixed(0)); out.tabbable.push(btn.id || btn.getAttribute('data-world') || btn.getAttribute('data-scope') || btn.className); }
  }
  out.current = [...ph.querySelectorAll('#rail [aria-current="page"]')].map((x) => x.dataset.world);
  const tf = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e).transform : null; };
  out.mirror = { back: tf('#back svg'), replay: tf('#replay svg'), call: tf('#call svg'), play: tf('.vn .play svg'), fwd: tf('.row .fw') };
  out.railItems = ph.querySelectorAll('#rail .it').length;
  const rb = document.getElementById('replay'), rr = rb.getBoundingClientRect();
  out.replay = { shown: getComputedStyle(rb).display !== 'none' && vis(rb), box: [rr.left - P0.left, rr.top - P0.top, rr.width, rr.height], inHeader: !!rb.closest('#hdr'), inRail: !!rb.closest('#rail'), name: rb.getAttribute('aria-label'), popup: rb.getAttribute('aria-haspopup') };
  out.doorShown = vis(document.getElementById('door')); out.backShown = vis(document.getElementById('back'));
  out.backName = document.getElementById('back').getAttribute('aria-label');
  out.worldName = document.getElementById('world').getAttribute('aria-label');
  out.sharedHeading = document.getElementById('st').textContent; out.sharedRows = [...ph.querySelectorAll('#dest-shared .row')].filter((r) => !r.hidden).length;
  out.sharedNone = !document.querySelector('#dest-shared .none').hidden; out.railShared = ph.querySelector('#rail [data-world="shared"]').textContent;
  out.turns = [...ph.querySelectorAll('.thread .t')].filter((t) => t.getClientRects().length).map((t) => {
    const p = t.querySelector('.tx'), cr = t.getBoundingClientRect(), cs = getComputedStyle(t), pcs = p ? getComputedStyle(p) : null;
    const rs = p ? (() => { const rg = document.createRange(); rg.selectNodeContents(p); return [...rg.getClientRects()].filter((r) => r.width > 0); })() : [];
    const sr = t.querySelector(':scope > .sr');
    return { who: t.dataset.who, kind: t.dataset.kind || 'text', x0: cr.left - P0.left, x1: cr.right - P0.left, y0: cr.top - P0.top, y1: cr.bottom - P0.top, bg: cs.backgroundColor, cdir: cs.direction, pdir: pcs ? pcs.direction : null,
      tl: rs.length ? Math.min(...rs.map((r) => r.left)) - P0.left : null, tr: rs.length ? Math.max(...rs.map((r) => r.right)) - P0.left : null, label: sr ? sr.textContent : null, text: p ? p.textContent : '',
      radii: [cs.borderStartStartRadius, cs.borderStartEndRadius, cs.borderEndStartRadius, cs.borderEndEndRadius], ms: cs.marginInlineStart, role: t.getAttribute('role'), checked: t.getAttribute('aria-checked') };
  });
  out.truth = window.__G11rt.truth();
  return out;
})()`;
const rgbOf = (hex) => `rgb(${hexToRgb8(hex).join(', ')})`;
const PAGES = [
  ['ar-active', { lang: 'ar', appearance: 'dark' }, 'state=active'],
  ['ar-new', { lang: 'ar', appearance: 'dark', thread: 'new' }, 'state=active'],
  ['en-new', { lang: 'en', appearance: 'dark', thread: 'new' }, 'state=active'],
  ['ar-first-sent', { lang: 'ar', appearance: 'dark', thread: 'new' }, 'state=active&send=' + encodeURIComponent('عندي عرض يوم الخميس ولسه مش جاهز.')],
  ['ar-voice', { lang: 'ar', appearance: 'dark', thread: 'voice' }, 'state=active'],
  ['ar-stress', { lang: 'ar', appearance: 'dark', thread: 'stress' }, 'state=active'],
  ['en-active', { lang: 'en', appearance: 'dark' }, 'state=active'],
  ['en-voice', { lang: 'en', appearance: 'dark', thread: 'voice' }, 'state=active'],
  ['ar-light', { lang: 'ar', appearance: 'light' }, 'state=active', { scheme: 'light' }],
  ['ar-light-voice', { lang: 'ar', appearance: 'light', thread: 'voice' }, 'state=active', { scheme: 'light' }],
  ['ar-contrast', { lang: 'ar', appearance: 'dark' }, 'state=active&contrast=more'],
  ['ar-text200', { lang: 'ar', appearance: 'dark' }, 'state=active&ts=2'],
  ['ar-text200-voice', { lang: 'ar', appearance: 'dark', thread: 'voice' }, 'state=active&ts=2'],
  ['ar-compact', { lang: 'ar', appearance: 'dark' }, 'state=active&w=360&h=780', { w: 360, h: 780 }],
  ['ar-world', { lang: 'ar', appearance: 'dark' }, 'state=world'],
  ['ar-call', { lang: 'ar', appearance: 'dark' }, 'state=call&voiceMs=84000'],
  ['ar-call-conv', { lang: 'ar', appearance: 'dark' }, 'state=call-conv&voiceMs=84000'],
  ['en-call', { lang: 'en', appearance: 'dark' }, 'state=call&voiceMs=84000'],
  ['ar-note', { lang: 'ar', appearance: 'dark' }, 'state=note&voiceMs=3100'],
  ['ar-menu', { lang: 'ar', appearance: 'dark' }, 'state=replay-menu'],
  ['ar-part', { lang: 'ar', appearance: 'dark' }, 'state=replay-part&pick=5,8'],
  ['ar-shared0', { lang: 'ar', appearance: 'dark' }, 'state=shared&shared=0'],
  ['ar-shared1', { lang: 'ar', appearance: 'dark' }, 'state=shared&shared=1'],
  ['ar-shared3', { lang: 'ar', appearance: 'dark' }, 'state=shared&shared=3'],
  ['en-shared1', { lang: 'en', appearance: 'dark' }, 'state=shared&shared=1'],
  ['en-shared3', { lang: 'en', appearance: 'dark' }, 'state=shared&shared=3'],
];
const F = {};
for (const [name, build, q, vp] of PAGES) { await open(build, q, { ...(vp || {}) }); F[name] = await b.eval(PAGE_EVAL); F[name].appearance = build.appearance; }
async function planted(build, q, js) { await open(build, q); await b.eval(`(()=>{${js}})()`); return b.eval(PAGE_EVAL); }

function all(key, fmt) {
  const bad = Object.entries(F).flatMap(([n, f]) => (f[key] || []).map((x) => `${n}: ${x}`));
  return bad.length ? { ok: false, detail: bad.slice(0, 8).join('; ') } : { ok: true, detail: fmt };
}
await check('B01', 'carried', 'Estedad v8.5 is the applied face of every Product text element', () => all('family', `${PAGES.length} pages`));
await check('B02', 'carried', 'No letter-spacing anywhere (Arabic is a connected script)', () => all('spacing', `${PAGES.length} pages`));
await check('B03', 'carried', 'No italics on anything containing Arabic', () => all('italics', `${PAGES.length} pages`));
await check('B04', 'G1.1-R3-12', 'Arabic leading ≥ 1.63 on every Arabic text element, including at 200% text and in the voice-note transcript', () => all('leading', `${PAGES.length} pages incl. ts=2`));
await check('B05', 'G1.1-R3-12', 'No horizontal overflow or clipping of any text, at 100% and 200% text and at 360 px', () => all('overflow', `${PAGES.length} pages`));
await check('B06', 'G1.1-R3-12', 'Every control has an accessible name (Replay, Voice Note, Live Call, mute, end call, play); the input has a <label>', () => all('names', 'every button and the input named'));
await check('B07', 'G1.1-R3-12', 'Label-in-Name (WCAG 2.5.3): every accessible name contains its visible label', () => all('labelInName', 'all aria-labels contain the visible text'));
await check('B08', 'G1.1-R3-12', 'No critical action is precision-only — every visible control ≥ 44 × 44, at 100% and 200% text', () => all('targets', 'every visible control ≥ 44 × 44'));
await check('B09', 'carried', 'Exactly one rail item is aria-current and it is the World on screen', () => {
  for (const [n, f] of Object.entries(F)) { const e = n.includes('shared') ? 'shared' : 'mine'; if (f.current.length !== 1 || f.current[0] !== e) return { ok: false, detail: `${n}: ${f.current}` }; }
  return { ok: true, detail: 'aria-current matches state on every page' };
});
function mirroring(f) {
  const flipped = (m) => m && /^matrix\(-1,/.test(m.replace(/\s/g, ''));
  if (f.dir === 'rtl' && !flipped(f.mirror.back)) return { ok: false, detail: `RTL back not mirrored` };
  if (f.dir === 'ltr' && flipped(f.mirror.back)) return { ok: false, detail: 'LTR back mirrored' };
  for (const k of ['replay', 'call', 'play']) if (flipped(f.mirror[k])) return { ok: false, detail: `${k} mirrored — media / handset glyphs never mirror` };
  return { ok: true, detail: 'back chevron mirrors per direction; Replay, handset and play never do' };
}
await check('B10', 'G1.1-R3-12', 'Mirroring by meaning — back mirrors in RTL; the Replay, handset and play glyphs never mirror', () => { for (const n of ['ar-voice', 'en-voice', 'ar-call']) { const r = mirroring(F[n]); if (!r.ok) return { ok: false, detail: `${n}: ${r.detail}` }; } return mirroring(F['ar-voice']); });
await probe('P-B10', 'B10', () => mirroring({ ...F['ar-voice'], mirror: { ...F['ar-voice'].mirror, replay: 'matrix(-1, 0, 0, 1, 0, 0)' } }));

// ---- R3-01 rendered: the opener paragraph's text is the substituted template, byte for byte.
function openerRendered(facts) {
  const bad = []; let n = 0;
  for (const [name, f] of Object.entries(facts)) for (const t of f.turns.filter((x) => x.kind === 'opener')) {
    n++; const lang = f.dir === 'rtl' ? 'ar' : 'en';
    const want = [LOCKED_OPENER_AR, LOCKED_OPENER_EN][lang === 'ar' ? 0 : 1].split('{display_name}').join(name.includes('stress') ? DISPLAY_NAME.latinInArabic : DISPLAY_NAME[lang]);
    if (t.text !== want) bad.push(`${name}: «${t.text}»`);
    if (t.who !== 'q') bad.push(`${name}: opener is not QANDEEL's turn`);
  }
  if (!n) bad.push('no opener rendered');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `${n} rendered openers (ar, en, and ar with a Latin display name) — each exactly the locked template with {display_name} substituted, spoken by QANDEEL` };
}
await check('R3-01b', 'G1.1-R3-01', 'Rendered opener = the locked template with only {display_name} substituted, on QANDEEL\'s side, in every new conversation', () => openerRendered(F));
await probe('P-R3-01b', 'R3-01b', async () => openerRendered({ x: await planted({ lang: 'ar', appearance: 'dark', thread: 'new' }, 'state=active', `document.querySelector('.opener .tx').lastChild.textContent=' ... انا مستنيك ... يلا نبدأ'`) }));

// ---- R3-02 / R3-05: geometry and morphology.
const CONV = ['ar-active', 'ar-new', 'en-new', 'ar-first-sent', 'ar-voice', 'ar-stress', 'en-active', 'en-voice', 'ar-light', 'ar-light-voice', 'ar-contrast', 'ar-text200', 'ar-text200-voice', 'ar-compact', 'ar-call-conv', 'ar-part'];
function speakerGeometry(facts, names = CONV) {
  const bad = []; let n = 0, minLane = Infinity, minQ = Infinity;
  for (const name of names) {
    const f = facts[name], W = f.W, rtl = f.dir === 'rtl';
    const slab = rgbOf(f.appearance === 'light' ? P.light.functional : P.dark.functional);
    for (const t of f.turns) {
      n++;
      if (t.cdir !== f.dir) bad.push(`${name}: a ${t.who} container resolved ${t.cdir}`);
      if (t.who === 'me') {
        // Arabic: the reader's slab touches the RIGHT screen edge; English: the LEFT.
        const attached = rtl ? Math.abs(t.x1 - W) < 0.5 : Math.abs(t.x0) < 0.5;
        if (!attached) bad.push(`${name}: reader turn not on the ${rtl ? 'RIGHT' : 'LEFT'} edge [${t.x0.toFixed(1)}, ${t.x1.toFixed(1)}]`);
        if (t.bg !== slab) bad.push(`${name}: reader turn on ${t.bg}`);
        const lane = rtl ? t.x0 : W - t.x1; minLane = Math.min(minLane, lane);
        if (lane < 64) bad.push(`${name}: reader slab leaves QANDEEL only ${lane.toFixed(1)} px`);
      } else {
        if (t.bg !== 'rgba(0, 0, 0, 0)') bad.push(`${name}: QANDEEL turn painted ${t.bg}`);
        // QANDEEL keeps off the reader's side: a 72 px band beside the reader's edge is never QANDEEL's.
        const clear = rtl ? W - t.x1 : t.x0; minQ = Math.min(minQ, clear);
        if (clear < 72 - 0.5) bad.push(`${name}: QANDEEL turn reaches ${clear.toFixed(1)} px from the reader's edge`);
      }
    }
  }
  return bad.length ? { ok: false, detail: bad.slice(0, 6).join('; ') } : { ok: true, detail: `${n} turns on ${names.length} pages: every reader slab on the RIGHT edge in Arabic and the LEFT in English, leaving QANDEEL ≥ ${minLane.toFixed(1)} px; every QANDEEL turn ≥ ${minQ.toFixed(1)} px clear of the reader's edge; containers keep the phone's direction` };
}
await check('R3-02', 'G1.1-R3-02', 'Speaker geometry — Arabic USER = RIGHT, English USER = LEFT, QANDEEL opposite, in every state that shows turns', () => speakerGeometry(F));
await probe('P-R3-02a', 'R3-02', async () => speakerGeometry({ x: { ...(await planted({ lang: 'ar', appearance: 'dark', speaker: 'a1' }, 'state=active', '')), appearance: 'dark' } }, ['x']));
await probe('P-R3-02b', 'R3-02', async () => speakerGeometry({ x: { ...(await planted({ lang: 'ar', appearance: 'dark', thread: 'stress' }, 'state=active', `document.querySelectorAll('.t.me').forEach((t)=>t.setAttribute('dir','ltr'))`)), appearance: 'dark' } }, ['x']));

function morphology(facts, names = CONV) {
  const bad = []; let n = 0;
  for (const name of names) for (const t of facts[name].turns.filter((x) => x.who === 'me')) {
    n++;
    const [ss, se, es, ee] = t.radii.map(parseFloat);
    // logical corners: start-* face the reader's own edge (open), end-* face into the conversation (rounded)
    if (!(se >= 12 && ee >= 12)) bad.push(`${name}: inward corners ${se}/${ee}`);
    if (!(ss === 0 && es === 0)) bad.push(`${name}: edge-side corners rounded ${ss}/${es} — a full bubble`);
    if (t.ms !== '-24px') bad.push(`${name}: slab does not bleed to the edge (margin-inline-start ${t.ms})`);
  }
  return bad.length ? { ok: false, detail: bad.slice(0, 5).join('; ') } : { ok: true, detail: `${n} reader slabs: rounded only on the two corners facing into the conversation (18 px), square and open on the reader's edge, bled through the gutter to the screen edge — a partial slab, not a bubble` };
}
await check('R3-05', 'G1.1-R3-05', 'Slab morphology — the approved partial / incomplete slab: attached, open toward the reader\'s edge, rounded only inward', () => morphology(F));
await probe('P-R3-05', 'R3-05', async () => morphology({ x: await planted({ lang: 'ar', appearance: 'dark' }, 'state=active', `const s=document.createElement('style');s.textContent='.t.me{border-radius:18px!important;margin-inline-start:0!important}';document.head.appendChild(s)`) }, ['x']));

function speakerLabels(facts, names = CONV) {
  const bad = []; let n = 0;
  for (const name of names) {
    const L = COPY[facts[name].dir === 'rtl' ? 'ar' : 'en'];
    for (const t of facts[name].turns) { n++; const want = `${t.who === 'me' ? L.speakerMe.text : L.speakerQ.text}: `; if (t.label !== want) bad.push(`${name}: ${t.who} announces «${t.label}»`); }
  }
  return bad.length ? { ok: false, detail: bad.slice(0, 4).join('; ') } : { ok: true, detail: `${n} turns (text, voice and opener) each announce «${COPY.ar.speakerMe.text}» / «${COPY.ar.speakerQ.text}» (en ${COPY.en.speakerMe.text} / ${COPY.en.speakerQ.text}) before their words` };
}
await check('R3-12a', 'G1.1-R3-12', 'Speaker identity is not only visual — every turn announces its speaker before its words (WCAG 1.3.1)', () => speakerLabels(F));
await probe('P-R3-12a', 'R3-12a', async () => speakerLabels({ x: await planted({ lang: 'ar', appearance: 'dark', thread: 'voice' }, 'state=active', `document.querySelector('.t.voice > .sr').remove()`) }, ['x']));

function bidi(f) {
  const bad = [];
  const find = (s) => f.turns.find((t) => t.text.startsWith(s));
  const latinFirst = find('Q3 numbers لسه'), english = find('Subject:'), op = f.turns.find((t) => t.kind === 'opener');
  if (!latinFirst || !english || !op) return { ok: false, detail: 'stress cases missing' };
  if (latinFirst.pdir !== 'rtl') bad.push(`Latin-first Arabic sentence ${latinFirst.pdir}`);
  if (english.pdir !== 'ltr') bad.push(`pasted English line ${english.pdir}`);
  if (op.pdir !== 'rtl') bad.push(`opener with a Latin name ${op.pdir}`);
  for (const t of f.turns) if (t.pdir !== paragraphDir(t.text, f.dir)) bad.push(`«${t.text.slice(0, 20)}…» ${t.pdir}`);
  if (Math.abs(english.x1 - f.W) > 0.5) bad.push('the LTR English line left the reader\'s RIGHT edge');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `${f.turns.length} stress turns: each paragraph in the direction of its sentence («Q3 numbers لسه…» rtl, «Subject: …» ltr, «اهلا يا Nour …» rtl) while the English line's slab stays on the RIGHT edge` };
}
await check('R3-03', 'G1.1-R3-03', 'Bidi — paragraph direction cannot move a message to the other speaker\'s side; mixed Arabic / English reads correctly', () => bidi(F['ar-stress']));
await probe('P-R3-03', 'R3-03', async () => bidi(await planted({ lang: 'ar', appearance: 'dark', thread: 'stress', dirMode: 'auto' }, 'state=active', '')));

// ---- R3-06 rendered
function namingRendered(facts) {
  const bad = [];
  const conv = facts['ar-active'], ana = facts['ar-world'], call = facts['ar-call'];
  if (!conv.visibleText.includes('تحليل المحادثة') || !conv.doorShown) bad.push('Conversation chrome does not show «تحليل المحادثة»');
  if (!ana.visibleText.includes('المحادثة') || !ana.backShown) bad.push('Analysis chrome does not show «المحادثة»');
  if (!call.backShown || !/المحادثة/.test(call.backName) || !/المكالمة/.test(call.backName)) bad.push(`Live Call route name «${call.backName}»`);
  for (const [n, f] of Object.entries(facts)) {
    if (f.dir !== 'rtl') continue;
    for (const t of f.visibleText) if (/العالم/.test(t) && !/العالم العام/.test(t)) bad.push(`${n}: visible «${t}»`);
    if (/العالم/.test(f.worldName)) bad.push(`${n}: Analysis region named «${f.worldName}»`);
  }
  return bad.length ? { ok: false, detail: bad.slice(0, 5).join('; ') } : { ok: true, detail: 'Conversation: «تحليل المحادثة»; Analysis: «المحادثة»; during a call «المحادثة — المكالمة مستمرة»; the Analysis region is named «تحليل المحادثة»; «العالم» appears only in the PUBLIC_WORLD rail name' };
}
await check('R3-06b', 'G1.1-R3-06', 'Analysis naming (rendered) — no user-facing «العالم» remains as the Conversation Analysis doorway', () => namingRendered(F));
await probe('P-R3-06b', 'R3-06b', async () => namingRendered({ ...F, 'ar-active': await planted({ lang: 'ar', appearance: 'dark' }, 'state=active', `document.querySelector('#door .lb').textContent='العالم'`) }));

// ---- R3-07: three ways of talking, one place.
async function modes(plant = '') {
  await open({ lang: 'ar', appearance: 'dark' }, 'state=active');
  return b.eval(`(() => { ${plant}
    const rt = window.__G11rt, S = rt.state, before = document.querySelectorAll('.thread .t').length, comp = document.getElementById('composer');
    const inComposer = ['mic','call','input'].every((id) => comp.contains(document.getElementById(id)));
    const names = { mic: document.getElementById('mic').getAttribute('aria-label'), call: document.getElementById('call').getAttribute('aria-label'), input: document.querySelector('label[for=input]').textContent };
    rt.act('note'); const recDepth = S.depth, recComposer = S.composer; rt.at(2400); rt.act('notesend');
    const after = document.querySelectorAll('.thread .t').length, note = document.querySelector('.thread .new .t.voice');
    return { inComposer, names, recDepth, recComposer, depthAfter: S.depth, added: after - before, noteSide: note && note.dataset.who, sameThread: !!(note && note.closest('#scroll')), rail: document.querySelectorAll('#rail .it').length }; })()`);
}
function modesOk(m) {
  const bad = [];
  if (!m.inComposer) bad.push('a mode control lives outside the lower interaction area');
  if (m.names.mic !== COPY.ar.voiceNote.text || m.names.call !== COPY.ar.call.text) bad.push(`names ${JSON.stringify(m.names)}`);
  if (m.recComposer !== 'note' || m.recDepth !== 'conversation') bad.push(`recording a voice note moved the reader to «${m.recDepth}»`);
  if (m.depthAfter !== 'conversation') bad.push('sending the note left the Conversation');
  if (m.added !== 1 || m.noteSide !== 'me' || !m.sameThread) bad.push('the voice note did not land in the same history on the reader\'s side');
  if (m.rail !== 3) bad.push('a mode became a destination');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `Writing («${m.names.input}»), Voice Note («${m.names.mic}») and Live Call («${m.names.call}») all start from the one lower line; a recorded note stays Conversation-first and lands in the same history on the reader's side; the rail still has 3 Worlds` };
}
await check('R3-07', 'G1.1-R3-07', 'Modes — Writing / Voice Note / Live Call reachable from the composer, one history, never separate destinations', async () => modesOk(await modes()));
await probe('P-R3-07', 'R3-07', async () => modesOk(await modes(`const o=window.__G11rt.act;window.__G11rt.act=function(n){const r=o(n);if(n==='note')o('enter');return r;};`)));

// ---- R3-08: Live Call is Analysis-first and survives the depth change.
async function liveCall(plant = '') {
  await open({ lang: 'ar', appearance: 'dark' }, 'state=active');
  return b.eval(`(() => { ${plant}
    const rt = window.__G11rt, S = rt.state, t = [];
    const snap = (k) => { const x = rt.truth(); t.push({ k, depth: x.depth, call: x.call, world: x.worldVisible, conv: x.convVisible, end: x.controls.includes('end-call'), mute: x.controls.includes('mute'), back: x.controls.includes('back'), door: x.controls.includes('door'), start: S.callStart }); };
    rt.at(1000); rt.act('call'); rt.at(2000); snap('call');
    rt.act('leave'); rt.at(3000); snap('conversation');
    rt.act('enter'); rt.at(4000); snap('analysis-again');
    return t; })()`);
}
function liveOk(t) {
  const [a, c, d] = t, bad = [];
  if (a.depth !== 'world' || !a.world || a.call !== 'live') bad.push('a Live Call did not open on the Analysis');
  if (!a.back || !a.end || !a.mute) bad.push('call controls / route back not reachable in the Analysis');
  if (c.depth !== 'conversation' || !c.conv || c.call !== 'live' || !c.end) bad.push('opening the Conversation ended or hid the call');
  if (!c.door) bad.push('no route back to the Analysis during the call');
  if (d.call !== 'live' || d.depth !== 'world' || d.start !== a.start) bad.push('returning to the Analysis started a different call');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: 'call → Analysis (end call, mute and «المحادثة» reachable); «المحادثة» → Conversation with the call still live and its controls reachable; «تحليل المحادثة» → the SAME call (start instant unchanged)' };
}
await check('R3-08', 'G1.1-R3-08', 'Live Call opens Analysis-first; Conversation is reachable without ending the call; returning continues the same call', async () => liveOk(await liveCall()));
await probe('P-R3-08a', 'R3-08', async () => liveOk(await liveCall(`const o=window.__G11rt.act;window.__G11rt.act=function(n){const r=o(n);if(n==='leave')o('endcall');return r;};`)));
await probe('P-R3-08b', 'R3-08', async () => liveOk(await liveCall(`const o=window.__G11rt.act;window.__G11rt.act=function(n){if(n==='enter'){o('endcall');window.__G11rt.at(3500);o('call');return true;}return o(n);};`)));

// ---- R3-09: Replay is chrome, in one stable place, in both views.
function replayPlacement(facts) {
  const c = facts['ar-active'].replay, w = facts['ar-world'].replay, k = facts['ar-call'].replay, e = facts['en-active'].replay, bad = [];
  for (const [n, r] of [['conversation', c], ['analysis', w], ['live call', k], ['en', e]]) {
    if (!r.shown) bad.push(`${n}: Replay not reachable`);
    if (!r.inHeader || r.inRail) bad.push(`${n}: Replay is not in the upper chrome`);
    if (!r.name || r.popup !== 'menu') bad.push(`${n}: Replay name / popup`);
  }
  if (c.box.some((v, i) => Math.abs(v - w.box[i]) > 0.5) || c.box.some((v, i) => Math.abs(v - k.box[i]) > 0.5)) bad.push(`Replay moves between depths ${c.box} vs ${w.box}`);
  if (facts['ar-active'].railItems !== 3) bad.push('rail changed');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `one Replay control («${c.name}») at the END edge of the upper chrome, at the identical box [${c.box.map((v) => v.toFixed(0)).join(', ')}] in Conversation, Analysis and during a call — not a tab, not a World` };
}
await check('R3-09', 'G1.1-R3-09', 'Replay placement — reachable from the Conversation / Analysis chrome, stable, never a main tab', () => replayPlacement(F));
await probe('P-R3-09', 'R3-09', async () => replayPlacement({ ...F, 'ar-world': await planted({ lang: 'ar', appearance: 'dark' }, 'state=world', `document.getElementById('replay').style.insetInlineEnd='120px'`) }));

function replayAvailability(facts) {
  const bad = [];
  if (facts['ar-new'].replay.shown || facts['en-new'].replay.shown) bad.push('Replay advertised on a brand-new conversation');
  if (facts['ar-new'].tabbable.includes('replay')) bad.push('hidden Replay still reachable by keyboard');
  if (!facts['ar-first-sent'].replay.shown) bad.push('Replay did not become reachable after the first committed words');
  if (!facts['ar-active'].replay.shown) bad.push('Replay unavailable with committed material');
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: 'new conversation (opener only): no Replay, visually or by keyboard; after the reader\'s first committed words: Replay reachable; its slot is reserved, so nothing shifts when it appears' };
}
await check('R3-10b', 'G1.1-R3-09 / R3-10', 'Replay availability — not advertised on an empty conversation; reachable once eligible committed material exists', () => replayAvailability(F));
await probe('P-R3-10b', 'R3-10b', async () => replayAvailability({ ...F, 'ar-new': await planted({ lang: 'ar', appearance: 'dark', thread: 'new' }, 'state=active', `document.getElementById('phone').setAttribute('data-replay','1')`) }));

async function replayEntry(plant = '') {
  await open({ lang: 'ar', appearance: 'dark' }, 'state=active');
  return b.eval(`(() => { ${plant}
    const rt = window.__G11rt, S = rt.state, out = {};
    rt.act('menu');
    const m = document.getElementById('rmenu'); out.items = [...m.querySelectorAll('[role=menuitem]')].map((x) => x.textContent.trim());
    out.menuShown = getComputedStyle(m).display !== 'none'; out.scrim = getComputedStyle(document.getElementById('rprev')).display !== 'none';
    out.convInert = document.getElementById('conv').hasAttribute('inert') || document.getElementById('dest-mine').hasAttribute('inert');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    out.closedByEsc = !S.menu; out.focus = document.activeElement && document.activeElement.id;
    rt.act('menu'); rt.act('part'); out.pick = S.pick;
    rt.tap(8); rt.tap(5);
    const ts = [...document.querySelectorAll('.thread .t')];
    out.roles = ts.every((t) => t.getAttribute('role') === 'checkbox'); out.checked = ts.map((t) => t.getAttribute('aria-checked') === 'true');
    out.count = document.getElementById('pick-count').textContent; out.range = S.range;
    return out; })()`);
}
function entryOk(e) {
  const bad = [];
  if (e.items.join('|') !== `${COPY.ar.replayFull.text}|${COPY.ar.replayPart.text}`) bad.push(`entry offers ${JSON.stringify(e.items)}`);
  if (!e.menuShown || e.scrim || e.convInert) bad.push('entry is not a light ASIDE (scrim or suspended conversation)');
  if (!e.closedByEsc || e.focus !== 'replay') bad.push('Escape does not close the entry and return focus to Replay');
  if (!e.pick || !e.roles) bad.push('the part is not chosen on the conversation\'s own turns');
  const on = e.checked.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
  if (on.join() !== '5,6,7,8') bad.push(`selection ${on} is not the contiguous chronological range 5..8`);
  if (e.count !== messagesCount('ar', 4)) bad.push(`summary «${e.count}»`);
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `entry = exactly «${e.items[0]}» / «${e.items[1]}» in an anchored ASIDE (no scrim, conversation live); Escape closes it and returns focus to Replay; a part is chosen as whole turns in source order (tapped 8 then 5 → 5..8, «${e.count}»); no timeline, no trim, no editor` };
}
await check('R3-13a', 'G1.1-R3-09', 'Replay entry — whole conversation vs a part, chosen on the conversation\'s own turns, no generic editor', async () => entryOk(await replayEntry()));
await probe('P-R3-13a', 'R3-13a', async () => entryOk(await replayEntry(`const m=document.getElementById('rmenu');const x=document.createElement('button');x.setAttribute('role','menuitem');x.textContent='تعديل الفيديو';m.appendChild(x);`)));

function sharedGrammar(facts) {
  const bad = [];
  const want = { 'ar-shared0': [0, COPY.ar.nav.items[1].text, true], 'ar-shared1': [1, COPY.ar.sharedOne.text, false], 'ar-shared3': [3, COPY.ar.sharedMany.text, false], 'en-shared1': [1, COPY.en.sharedOne.text, false], 'en-shared3': [3, COPY.en.sharedMany.text, false] };
  for (const [n, [rows, h, none]] of Object.entries(want)) {
    const f = facts[n];
    if (f.sharedRows !== rows || f.sharedHeading !== h || f.sharedNone !== none) bad.push(`${n}: ${f.sharedRows} rows, heading «${f.sharedHeading}», empty-state ${f.sharedNone}`);
  }
  const rails = new Set(['ar-shared0', 'ar-shared1', 'ar-shared3'].map((n) => facts[n].railShared));
  if (rails.size !== 1) bad.push(`the rail label changes with the count: ${[...rails]}`);
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `0 → «${COPY.ar.nav.items[1].text}» + «${COPY.ar.sharedNone.text}»; 1 → «${COPY.ar.sharedOne.text}»; 3 → «${COPY.ar.sharedMany.text}» (en: ${COPY.en.sharedOne.text} / ${COPY.en.sharedMany.text}); the rail reads «${[...rails][0]}» at every count` };
}
await check('R3-11b', 'G1.1-R3-11', 'Shared grammar — one → «عالم مشترك», more → «عوالم مشتركة», zero → honest empty state; the rail never changes', () => sharedGrammar(F));
await probe('P-R3-11b', 'R3-11b', async () => sharedGrammar({ ...F, 'ar-shared1': await planted({ lang: 'ar', appearance: 'dark' }, 'state=shared&shared=1', `document.getElementById('st').textContent='عوالم مشتركة'`) }));

function keyboardReach(facts) {
  const bad = [];
  const need = { 'ar-active': ['door', 'replay', 'input', 'mic', 'call'], 'ar-call': ['back', 'replay', 'mute', 'end-call'], 'ar-call-conv': ['door', 'replay', 'mute', 'end-call'], 'ar-note': ['note-send', 'note-cancel'], 'ar-part': ['pick-cancel', 'pick-go'] };
  for (const [n, ids] of Object.entries(need)) for (const id of ids) if (!facts[n].tabbable.includes(id) && !(id === 'input')) bad.push(`${n}: ${id} not reachable`);
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: Object.entries(need).map(([n, ids]) => `${n}: ${ids.join(', ')}`).join(' · ') };
}
await check('R3-12b', 'G1.1-R3-12', 'Every primary path is operable without pointer precision — the controls of each mode and Replay are visible, named, un-inert and ≥ 44 px', () => keyboardReach(F));
await probe('P-R3-12b', 'R3-12b', async () => keyboardReach({ ...F, 'ar-call-conv': await planted({ lang: 'ar', appearance: 'dark' }, 'state=call-conv&voiceMs=84000', `document.getElementById('composer').setAttribute('inert','')`) }));

await b.close();

/* ====================================================== C — rasters, truth logs, video === */
const SCR = join(OUT, 'screens');
const SHOTS = JSON.parse(readFileSync(join(SCR, 'SCREENS.json'), 'utf8'));
const rgb = (hex) => hexToRgb8(hex);
function glance(names, shots = SHOTS, src = (n) => join(SCR, `${n}.png`)) {
  const bad = []; let n = 0;
  for (const name of names) {
    const s = shots[name], img = decode(readFileSync(src(name))), rtl = s.dir === 'rtl', W = s.w;
    const light = name.startsWith('light') || name.includes('light'), contrast = name.includes('contrast');
    const pal = palette(light ? 'light' : 'dark', { contrast: contrast ? 'increased' : 'standard' }).colors;
    const px = (x, y) => { const i = (Math.round(y * 2) * img.width + Math.round(x * 2)) * 4; return [img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]]; };
    const near = (a, bb) => a.every((v, i) => Math.abs(v - bb[i]) <= 2);
    for (const t of s.turns) {
      n++;
      // Probe the ground at the reader's own edge, 6 px in, at the turn's vertical middle — where no ink is.
      const y = (t.y0 + t.y1) / 2, xEdge = rtl ? W - 6 : 6;
      const g = px(xEdge, y);
      if (t.who === 'me' && !near(g, rgb(pal.functional))) bad.push(`${name}: reader turn not on its slab at the ${rtl ? 'right' : 'left'} edge (${g})`);
      if (t.who === 'q' && !near(g, rgb(pal.world))) bad.push(`${name}: QANDEEL turn has a ground at the reader's edge (${g})`);
    }
  }
  return bad.length ? { ok: false, detail: bad.slice(0, 5).join('; ') } : { ok: true, detail: `${n} turns on ${names.length} shipped rasters: sampled 6 px in from the reader's edge, every reader turn stands on the slab tone and every QANDEEL turn on the World — the side and the ground are both painted, in dark, Light and Increase Contrast` };
}
const GLANCE_SET = ['conv-02-active-ar', 'conv-03-active-en', 'conv-04-mixed-bidi', 'conv-05-first-words-sent', 'modes-03-voice-note-in-history', 'modes-05-live-call-conversation', 'light-01-active', 'light-03-voice-note-in-history', 'a11y-01-contrast-more', 'a11y-02-contrast-more-light', 'a11y-08-compact-360'];
await check('R3-04', 'G1.1-R3-04', 'Speaker recognition at a glance — in the shipped rasters, each speaker is told by WHICH EDGE and WHICH GROUND, never by colour or ink', () => glance(GLANCE_SET));
await probe('P-R3-04', 'R3-04', () => glance(['conv-06-a1-placement-superseded']));

function parity(std, rm) {
  const bad = []; let n = 0;
  for (let i = 0; i < std.length; i++) {
    const a = std[i], c = rm[i]; n++;
    if (!c || a.act !== c.act || a.phase !== c.phase) { bad.push(`record ${i} misaligned`); continue; }
    for (const k of ['world', 'depth', 'call', 'composer', 'replay', 'menu', 'pick', 'turns']) if (a.truth[k] !== c.truth[k]) bad.push(`${a.act}/${a.phase}: ${k} ${a.truth[k]} vs ${c.truth[k]}`);
    if (a.phase === 'settled' && a.truth.controls.join() !== c.truth.controls.join()) bad.push(`${a.act}: reachable controls differ`);
    if (a.phase === 'settled' && (a.truth.worldVisible !== c.truth.worldVisible || a.truth.convVisible !== c.truth.convVisible)) bad.push(`${a.act}: a different surface is on screen`);
  }
  return bad.length ? { ok: false, detail: bad.slice(0, 5).join('; ') } : { ok: true, detail: `${n} records (${JOURNEY.length} acts × commit + settled): Reduced Motion reaches the same depth, call state, composer mode, Replay availability and history at every commit, and the same surface and the same reachable controls once settled` };
}
const TRUTH = (n) => JSON.parse(readFileSync(join(OUT, 'motion', `${n}.truth.json`), 'utf8'));
await check('R3-M1', 'G1.1-R3-12 / §17', 'Reduced Motion parity — same destination, same controls, same call state, same Replay availability, same history', () => parity(TRUTH('journey-ar-dark'), TRUTH('journey-ar-dark-reduced-motion')));
await probe('P-R3-M1', 'R3-M1', () => { const rm = TRUTH('journey-ar-dark-reduced-motion'); const x = JSON.parse(JSON.stringify(rm)); const s = x.find((r) => r.act === 'leave' && r.phase === 'settled'); s.truth.controls = s.truth.controls.filter((c) => c !== 'end-call'); return parity(TRUTH('journey-ar-dark'), x); });

await check('C01', 'carried', 'Every shipped raster is the capture recorded in SCREENS.json (sha256), and every MP4 decodes to its full frame count', () => {
  for (const [n, s] of Object.entries(SHOTS)) if (createHash('sha256').update(readFileSync(join(SCR, `${n}.png`))).digest('hex') !== s.sha256) return { ok: false, detail: `${n} changed after capture` };
  const log = readFileSync(join(OUT, 'motion-run.log'), 'utf8'); const want = Math.round((JOURNEY_END / 1000) * 60) + 1;
  for (const j of JOBS) { const m = log.match(new RegExp(`${j.name}\\.mp4","bytes":(\\d+),"frames":(\\d+)`)); if (!m || +m[2] !== want) return { ok: false, detail: `${j.name}: ${m ? m[2] : 'missing'} frames, expected ${want}` }; }
  return { ok: true, detail: `${Object.keys(SHOTS).length} rasters verified; ${JOBS.length} MP4s × ${want} frames at 60 fps` };
});

// ---- R3-13: the Skill ledger delta cites Skills that exist, at the hash it states.
function ledger(text) {
  const rows = [...text.matchAll(/^\|\s*`([^`]+)`[^|`]*\|\s*`([^`]+)`\s*\|\s*`([0-9a-f]{16})`/gm)];
  const bad = [];
  for (const [, name, p, h] of rows) {
    const abs = p.replace(/^~/, process.env.USERPROFILE).replace(/^<repo>/, REPO);
    if (!existsSync(abs)) { bad.push(`${name}: ${p} missing`); continue; }
    const real = createHash('sha256').update(readFileSync(abs)).digest('hex').slice(0, 16);
    if (real !== h) bad.push(`${name}: stated ${h}, file is ${real}`);
  }
  if (rows.length < 8) bad.push(`only ${rows.length} Skill rows`);
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: `${rows.length} Skill rows: every cited file exists on this host at exactly the stated sha256 prefix` };
}
const LEDGER = join(WORK, 'authored', 'G1.1_R3_SKILL_USAGE_LEDGER_DELTA.md');
if (existsSync(LEDGER)) {
  await check('R3-13', 'G1.1-R3-13', 'Skill Usage Ledger Delta — every re-read Skill is cited by path and a hash that matches the file on this host', () => ledger(readFileSync(LEDGER, 'utf8')));
  await probe('P-R3-13', 'R3-13', () => ledger(readFileSync(LEDGER, 'utf8').replace(/`([0-9a-f]{16})`/, '`0000000000000000`')));
}
const REPORT = join(WORK, 'authored', 'G1.1_R3_FINAL_REPORT.md');
const DEPENDENCY = 'The intended Product Replay — original conversation/call audio with the Living Analysis world as the visual hero — requires the Voice / Live Call track to establish a reviewed durable Personal original-audio/call source before launch.';
function reportCarries(text) {
  const bad = [];
  if (!text.includes(DEPENDENCY)) bad.push('the §11 Replay dependency sentence is missing or altered');
  if (!text.includes(LOCKED_OPENER_AR)) bad.push('the exact opener is not recorded');
  for (const k of ['G2', 'J5', 'UTTERANCE']) if (!text.includes(k)) bad.push(`missing ${k}`);
  return bad.length ? { ok: false, detail: bad.join('; ') } : { ok: true, detail: 'the report carries the brief\'s Replay audio dependency verbatim, the exact opener, the B4 reconciliation status and the G2 deferral' };
}
if (existsSync(REPORT)) {
  await check('R3-10c', 'G1.1-R3-10 / R3-14', 'The report carries the Replay audio dependency verbatim (and the opener, B4 status, G2 deferral)', () => reportCarries(readFileSync(REPORT, 'utf8')));
  await probe('P-R3-10c', 'R3-10c', () => reportCarries(readFileSync(REPORT, 'utf8').split(DEPENDENCY).join('Replay exports the call audio.')));
}

/* ------------------------------------------------------------------------ summary ---- */
const passed = results.filter((r) => r.ok).length, rejected = probes.filter((p) => p.rejected).length;
mkdirSync(join(OUT, 'data'), { recursive: true });
writeFileSync(join(OUT, 'data', 'G11_R3_CHECKS.json'), JSON.stringify({ checks: results, probes, summary: { checks: `${passed}/${results.length}`, probes: `${rejected}/${probes.length}` } }, null, 1));
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id.padEnd(7)} ${r.title.slice(0, 96)}${r.ok ? '' : '\n      ' + r.detail}`);
for (const p of probes) if (!p.rejected) console.log(`PROBE NOT REJECTED ${p.id} → ${p.targets}: ${p.detail}`);
console.log(`\n${passed}/${results.length} checks · ${rejected}/${probes.length} probes rejected their planted defect`);
if (passed !== results.length || rejected !== probes.length) process.exitCode = 1;
