// P4-C — the deterministic checks. Every DOM check is a pure function over FACTS read from the live built page, so
// the same function judges the normal build and every planted defect. A planted defect must make its named check FAIL;
// the normal build must make every check PASS. Static checks re-hash the frozen sources and the package.
//   node source/tools/p4checks.mjs [--no-git] [--out file]
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { openState, closeBrowser, closeServers, key, PKG, SOURCE, REPO } from './lib/session.mjs';
import { sigSvg } from '../src/sig.mjs';
import { Q } from '../src/qmark.mjs';
import { COPY } from '../src/content.mjs';
import { DECISIONS, DEFECTS, Q_POLICY, DIRECTIONS } from '../src/candidates.mjs';
import { SHOTS, KEEP } from './shots.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const NO_GIT = process.argv.includes('--no-git');
const BASE = '175df7b6f9254d83b82d2b7571c915959fb06a27';
const posix = (p) => p.split('\\').join('/');
const PKG_REL = posix(relative(REPO, PKG));
const EXPECT_G32 = '10611f35cdcfd031d74ad0b065634a19f530e2b1e28acfd2c944d4f2d4983d71';
const FLOOR = 160;   // T-11 §3 MAP_MIN_HEIGHT_POINTS (G3 T-11 / T-12 amendment §3)

// ------------------------------------------------------------------------------------------------ FACTS
const NAV_EXPECT = { mine: sigSvg('navMine', { size: 24 }), shared: sigSvg('navShared', { size: 24 }), public: sigSvg('navPublic', { size: 24 }) };
const FACTS = `(async()=>{
  const ph=document.getElementById('phone');
  const tpl=(s)=>{const t=document.createElement('template');t.innerHTML=s;return t.content.firstElementChild.outerHTML};
  const exp=${JSON.stringify(NAV_EXPECT)};
  const rails=[...document.querySelectorAll('#phone .rail')].filter(n=>n.getClientRects().length).map(n=>{const r=P4.rail('#'+n.id);
    r.id=n.id;r.items.forEach((it,i)=>{const svg=n.querySelectorAll('.it')[i].querySelector('.ic svg');it.glyphSame=!!svg&&!!exp[it.key]&&svg.outerHTML===tpl(exp[it.key]);});return r});
  const chev=document.querySelector('#u-entry .chev svg');
  const f={P:P4.P,place:P4.S.place,surface:ph.dataset.surface,dir:ph.dir,lang:ph.lang,html:document.documentElement.lang,appearance:ph.dataset.appearance,W:ph.getBoundingClientRect().width,
    controls:P4.controls(),rails,vars:P4.vars(),qs:P4.qs(),hdr:P4.hdr(),prow:P4.prow(),ctx:P4.ctx(),analysisEntries:P4.analysisEntries(),order:P4.order(),
    chevMirrored:chev?getComputedStyle(chev).transform!=='none':null,
    navMirrored:[...document.querySelectorAll('#phone .rail .ic, #phone .rail .ic svg')].some(s=>getComputedStyle(s).transform!=='none'),
    doorName:(document.getElementById('door')||{textContent:''}).textContent.trim(),
    pageNames:[...document.querySelectorAll('.page button')].map(b=>(b.getAttribute('aria-label')||b.textContent||'').trim())};
  if(P4.S.place==='analysis'){const g=P4.g32();f.g32={state:g.state,room:g.room,shellDark:g.shellDark,rects:g.rects,ctxInG32:(g.text.match(/سياق الكلام|In play now/g)||[]).length,railInert:(()=>{const d=document.getElementById('g32').contentDocument;const r=d.getElementById('rail');return r?r.hasAttribute('inert'):null})()};}
  // every visible Settings entry must lead to the one destination (clicked, then undone)
  f.settingsRoutes=[];const SETN={ar:'الإعدادات',en:'Settings'}[P4.P.lang];for(const b of [...document.querySelectorAll('#phone button')].filter(e=>e.getClientRects().length&&!e.closest('.page')&&(e.dataset.entry==='settings'||e.getAttribute('aria-label')===SETN))){const before=P4.S.place;b.click();f.settingsRoutes.push(P4.S.place);P4.back();if(P4.S.place!==before)P4.switchTo(before);}
  return f;})()`;

async function facts(page) {
  const c = await openState(page);
  const f = await c.eval(FACTS);
  f.page = page;
  return f;
}

// ------------------------------------------------------------------------------------------------ DOM CHECKS
const near = (a, b, e = 1) => Math.abs(a - b) <= e;
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`; };
const inter = (a, b) => { if (!a || !b) return 0; const x = Math.max(0, Math.min(a.r ?? a.x + a.w, b.r ?? b.x + b.w) - Math.max(a.x, b.x)); const y = Math.max(0, Math.min(a.b ?? a.y + a.h, b.b ?? b.y + b.h) - Math.max(a.y, b.y)); return x * y; };
const NAMES = (lang) => COPY[lang].nav.items.map((i) => i.text);
const FORBIDDEN_NAV = ['الإعدادات', 'Settings', 'النشاط', 'Activity', 'فهم قنديل', 'QANDEEL Understanding', 'التعارف', 'Introductions', 'إعادة عرض المحادثة', 'Replay this conversation', 'Replay'];
const policySettings = (s, surface) => (s === 'A' ? 1 : s === 'B' ? (surface === 'personal' ? 1 : 0) : 0);

const DOM = {
  'C-NAV-1': ['exactly the three existing World destinations, with their current names (Shared World singular)', (F) => F.flatMap((f) => f.rails.map((r) => {
    const keys = r.items.map((i) => i.key).join(','), texts = r.items.map((i) => i.text);
    return keys === 'mine,shared,public' && JSON.stringify(texts) === JSON.stringify(NAMES(f.P.lang)) ? null : `${f.page.id} ${r.id}: ${keys} ${texts.join('|')}`; }))],
  'C-NAV-2': ['no Settings / Activity / Understanding / Introductions / Replay in the switcher', (F) => F.flatMap((f) => f.rails.flatMap((r) => r.items.filter((i) => FORBIDDEN_NAV.includes(i.text)).map((i) => `${f.page.id}: ${i.text}`)))],
  'C-NAV-3': ['the P2 nav glyph stands ABOVE the destination word', (F) => F.flatMap((f) => f.rails.flatMap((r) => r.items.filter((i) => !(i.glyph && i.label && i.glyph.b <= i.label.y + 0.5)).map((i) => `${f.page.id}: ${i.key} glyph b ${i.glyph && i.glyph.b} label y ${i.label && i.label.y}`)))],
  'C-NAV-4': ['Living Brass identical on every destination at every state (never selected-only)', (F) => F.flatMap((f) => f.rails.flatMap((r) => {
    const brass = rgb(f.vars['--brass']); return r.items.filter((i) => i.glyphColor !== brass || i.labelColor !== brass).map((i) => `${f.page.id}: ${i.key}${i.selected ? ' (selected)' : ''} glyph ${i.glyphColor} label ${i.labelColor} ≠ ${brass}`); }))],
  'C-NAV-5': ['SELECTED has a non-colour channel: the E1R marker (≥ 1 pt) and a heavier word; no other item carries either', (F) => F.flatMap((f) => f.rails.flatMap((r) => {
    const sel = r.items.filter((i) => i.selected), rest = r.items.filter((i) => !i.selected);
    if (sel.length !== 1) return [`${f.page.id}: ${sel.length} selected`];
    const s = sel[0], out = [];
    if (!s.marker || s.marker.h < 1) out.push(`${f.page.id}: selected ${s.key} has no marker`);
    if (!(s.weight > Math.max(...rest.map((i) => i.weight)))) out.push(`${f.page.id}: selected weight ${s.weight} not above ${rest.map((i) => i.weight)}`);
    rest.filter((i) => i.marker).forEach((i) => out.push(`${f.page.id}: unselected ${i.key} carries a marker`));
    return out; }))],
  'C-NAV-6': ['nav glyphs are decorative; the word alone names the item', (F) => F.flatMap((f) => f.rails.flatMap((r) => r.items.filter((i) => !i.glyphHidden || i.name !== i.text).map((i) => `${f.page.id}: ${i.key} hidden=${i.glyphHidden} name="${i.name}"`)))],
  'C-NAV-7': ['the nav glyph drawing is P2\'s own (sig.mjs, byte-exact vendored), unaltered', (F) => F.flatMap((f) => f.rails.flatMap((r) => r.items.filter((i) => !i.glyphSame).map((i) => `${f.page.id}: ${i.key} glyph differs from P2 sigSvg`)))],
  'C-TGT-1': ['every studied control keeps the 44 pt minimum target', (F) => F.flatMap((f) => f.controls.filter((c) => (c.inHdr || c.inRow || c.inRail || c.inAnalysis || c.entry) && (c.w < 43.5 || c.h < 43.5)).map((c) => `${f.page.id}: ${c.id || c.entry || c.nav} ${c.w}×${c.h}`))],
  'C-NAME-1': ['every control has an accessible name; icon-only controls carry an aria-label', (F) => F.flatMap((f) => f.controls.filter((c) => !c.name || (c.iconOnly && !c.aria)).map((c) => `${f.page.id}: ${c.id || c.entry || c.nav || '?'} unnamed`))],
  'C-ACT-1': ['P3 Activity: one independent icon-only entry at the START edge of every non-Analysis shell surface, never replaced', (F) => F.filter((f) => ['personal', 'shared'].includes(f.surface)).flatMap((f) => {
    const a = f.controls.filter((c) => c.entry === 'activity'); if (a.length !== 1) return [`${f.page.id}: ${a.length} Activity entries`];
    const e = a[0], start = f.dir === 'rtl' ? near(e.r, f.W - 10, 2) : near(e.x, 10, 2);
    return start && e.inHdr && e.iconOnly ? [] : [`${f.page.id}: Activity at ${e.x}..${e.r} not at START`]; })],
  'C-ACT-2': ['nothing global in the Analysis: no Activity, Settings or Understanding entry is laid over G3.2', (F) => F.filter((f) => f.place === 'analysis').flatMap((f) => f.analysisEntries.length ? [`${f.page.id}: ${f.analysisEntries.join(',')}`] : [])],
  'C-SET-1': ['exactly the policy\'s Settings entries per surface (S-A: every non-Analysis surface; S-B: Personal only) — visible, one per surface, never hidden', (F) => F.filter((f) => ['personal', 'shared'].includes(f.surface)).flatMap((f) => {
    const n = f.controls.filter((c) => c.entry === 'settings').length, want = policySettings(f.P.s, f.surface);
    return n === want ? [] : [`${f.page.id}: ${n} visible Settings entries, policy ${f.P.s} wants ${want}`]; })],
  'C-SET-2': ['every Settings entry reaches the ONE General Settings destination, which is not a World (no switcher on it)', (F) => F.flatMap((f) => {
    const out = f.settingsRoutes.filter((p) => p !== 'settings').map((p) => `${f.page.id}: a Settings entry leads to ${p}`);
    if (f.place === 'settings' && f.rails.length) out.push(`${f.page.id}: Settings shows the switcher`);
    return out; })],
  'C-UND-1': ['QANDEEL Understanding: one stable entry on Personal QANDEEL, none elsewhere, never a Settings row, never «القراءات», never the door', (F) => F.flatMap((f) => {
    const L = COPY[f.P.lang], u = f.controls.filter((c) => c.entry === 'understanding'), out = [];
    if (f.surface === 'personal' && f.P.u !== 'none' && u.length !== 1) out.push(`${f.page.id}: ${u.length} Understanding entries on Personal`);
    if (f.surface === 'shared' && u.length) out.push(`${f.page.id}: Understanding on Shared`);
    u.forEach((c) => { if (c.name !== L.understanding.text) out.push(`${f.page.id}: name "${c.name}"`); if (c.inRail) out.push(`${f.page.id}: in the switcher`); if (['القراءات', 'Readings'].includes(c.name) || c.name === f.doorName) out.push(`${f.page.id}: confused with ${c.name}`); });
    if (f.place === 'settings' && f.pageNames.includes(L.understanding.text)) out.push(`${f.page.id}: Understanding listed inside General Settings`);
    return out; })],
  'C-Q-1': ['every Q is the canonical Q: the brand master\'s three paths and viewBox, verbatim', (F) => F.flatMap((f) => f.qs.filter((q) => q.viewBox !== Q.viewBox || JSON.stringify(q.paths) !== JSON.stringify(Q.paths)).map((q) => `${f.page.id}: ${q.where} Q is not the canonical geometry`))],
  'C-Q-2': ['the Q carries no state: never a control, never in the switcher, decorative, never mirrored, qandeel.identity.mark', (F) => F.flatMap((f) => f.qs.filter((q) => q.inButton || q.where === 'rail' || !q.hidden || q.mirrored || q.color !== rgb(f.vars['--mark'])).map((q) => `${f.page.id}: ${q.where} Q inButton=${q.inButton} hidden=${q.hidden} mirrored=${q.mirrored} color=${q.color}`))],
  'C-Q-3': ['the chrome Q appears exactly where the policy under study puts it (Q-A none; Q-B every shell surface; Q-C Personal only)', (F) => F.filter((f) => ['personal', 'shared'].includes(f.surface)).flatMap((f) => {
    const n = f.qs.filter((q) => q.where === 'chrome').length, want = Q_POLICY[f.P.q] && Q_POLICY[f.P.q][f.surface] ? 1 : 0;
    return n === want ? [] : [`${f.page.id}: ${n} chrome Q, policy ${f.P.q} wants ${want}`]; })],
  'C-X-1': ['«سياق الكلام» appears at most once (and exactly once when a placement is under study)', (F) => F.filter((f) => f.place === 'analysis').flatMap((f) => {
    const n = f.ctx.length + (f.g32 ? f.g32.ctxInG32 : 0), want = f.P.x === 'none' ? 0 : 1;
    return n === want ? [] : [`${f.page.id}: shown ${n}×`]; })],
  'C-X-2': ['«سياق الكلام» overlaps no frozen Analysis control: «المحادثة», Replay, the temporal line, Timeline, Return Live, OrientationChrome, the call line, the switcher, the Matching cue', (F) => F.filter((f) => f.place === 'analysis').flatMap((f) => f.ctx.flatMap((x) => {
    const R = f.g32.rects, need = ['back', 'replay', 'tl-track', 'tl-live', 'composer', 'rail'].filter((k) => !R[k]);
    if (need.length) return [`${f.page.id}: G3.2 rects missing (${need.join(', ')}) — overlap cannot be judged`];
    return ['back', 'replay', 'tl-ctx', 'tl-track', 'tl-live', 'band', 'composer', 'rail', 'cue'].filter((k) => inter(x, R[k]) > 0.5).map((k) => `${f.page.id}: ${x.place} over ${k}`); }))],
  'C-X-3': ['X-A / X-B never enter the world; X-C\'s world cost is measured against the 160 pt floor (recorded, not hidden)', (F) => F.filter((f) => f.place === 'analysis').flatMap((f) => f.ctx.filter((x) => x.place !== 'top' && x.b > f.g32.rects.back.b + 1).map((x) => `${f.page.id}: ${x.place} enters the world (b ${x.b})`))],
  'C-DIR-1': ['Arabic shell = RTL with lang ar-EG; English = LTR with lang en', (F) => F.flatMap((f) => (f.P.lang === 'ar' ? (f.dir === 'rtl' && f.lang === 'ar-EG' && f.html === 'ar-EG') : (f.dir === 'ltr' && f.lang === 'en' && f.html === 'en')) ? [] : [`${f.page.id}: dir ${f.dir} lang ${f.lang}`])],
  'C-DIR-2': ['logical START / END and direction by meaning: Activity START, the door group END, U-A START and S-B END of the Personal row, the depth chevron mirrored in RTL only, nav glyphs and the Q never mirrored', (F) => F.filter((f) => f.surface === 'personal' || f.surface === 'shared').flatMap((f) => {
    const out = [], rtl = f.dir === 'rtl', c = (e) => f.controls.find((x) => x.entry === e && (e !== 'settings' || x.inRow));
    const door = f.controls.find((x) => x.entry === 'analysis');
    if (f.surface === 'personal' && !door) out.push(`${f.page.id}: the door is missing`);
    if (f.surface === 'personal' && f.P.u === 'A' && !f.controls.find((x) => x.entry === 'understanding' && x.inRow)) out.push(`${f.page.id}: U-A missing`);
    if (f.surface === 'personal' && f.P.s === 'B' && !c('settings')) out.push(`${f.page.id}: S-B missing`);
    if (door && (rtl ? door.x > f.W / 2 : door.r < f.W / 2)) out.push(`${f.page.id}: door not at END`);
    const u = f.controls.find((x) => x.entry === 'understanding' && x.inRow); if (u && (rtl ? !near(u.r, f.W - 10, 2) : !near(u.x, 10, 2))) out.push(`${f.page.id}: U-A not at START`);
    const sb = c('settings'); if (sb && (rtl ? !near(sb.x, 10, 2) : !near(sb.r, f.W - 10, 2))) out.push(`${f.page.id}: S-B not at END`);
    if (f.chevMirrored !== null && f.chevMirrored !== rtl) out.push(`${f.page.id}: chevron mirrored=${f.chevMirrored}`);
    if (f.navMirrored) out.push(`${f.page.id}: a nav glyph is mirrored`);
    return out; })],
  'C-FOCUS-1': ['focus order = visual order in the upper chrome, the Personal row and the switcher', (F) => F.filter((f) => f.surface === 'personal' || f.surface === 'shared').flatMap((f) => {
    const rows = f.controls.filter((c) => c.inHdr || c.inRow || c.inRail), out = [];
    for (let i = 1; i < rows.length; i++) { const a = rows[i - 1], b = rows[i];
      if (Math.abs(a.y - b.y) < 4) { if (f.dir === 'rtl' ? b.r > a.x + 1 : b.x < a.r - 1) out.push(`${f.page.id}: ${a.id || a.entry || a.nav} → ${b.id || b.entry || b.nav} runs against reading order`); }
      else if (b.y < a.y) out.push(`${f.page.id}: ${b.id || b.entry} above ${a.id || a.entry}`); }
    return out; })],
  'C-FOCUS-3': ['in the Analysis, G3.2\'s own (pre-P2) rail under the candidate switcher is inert: no second, invisible navigation stays focusable', (F) => F.filter((f) => f.place === 'analysis' && f.P.sw !== 'g32').flatMap((f) => (f.g32.railInert === true ? [] : [`${f.page.id}: G3.2 rail inert=${f.g32.railInert}`]))],
  'C-APP-1': ['the Analysis stays the one dark place under Light; non-Analysis surfaces follow the preference', (F) => F.flatMap((f) => {
    if (f.place === 'analysis') return f.appearance === 'dark' && f.g32.shellDark >= 0.999 ? [] : [`${f.page.id}: analysis ${f.appearance} shellDark ${f.g32.shellDark}`];
    return f.appearance === (f.page.appearance || 'dark') ? [] : [`${f.page.id}: ${f.appearance} ≠ ${f.page.appearance}`]; })],
  'C-COPY-1': ['no frozen copy rewritten: the door, the World names and every studied entry render their canonical words', (F) => F.flatMap((f) => {
    const L = COPY[f.P.lang], out = []; if (f.doorName && f.doorName !== L.door.text) out.push(`${f.page.id}: door "${f.doorName}"`);
    f.controls.filter((c) => c.entry === 'settings' && c.aria && ![L.settings.text, L.activitySettings.text].includes(c.aria)).forEach((c) => out.push(`${f.page.id}: Settings named "${c.aria}"`));
    f.controls.filter((c) => c.entry === 'understanding').forEach((c) => { if (c.name !== L.understanding.text) out.push(`${f.page.id}: Understanding reads "${c.name}"`); });
    f.controls.filter((c) => c.inRail).forEach((c) => { if (!NAMES(f.P.lang).includes(c.name) && !FORBIDDEN_NAV.includes(c.name)) out.push(`${f.page.id}: switcher word "${c.name}"`); });
    f.ctx.forEach((x) => { if (x.text !== L.liveContext.text) out.push(`${f.page.id}: «سياق الكلام» slot reads "${x.text}"`); });
    return out; })],
  'C-DEF-0': ['the normal build activates no planted defect', (F) => F.filter((f) => f.P.defect).map((f) => `${f.page.id}: defect ${f.P.defect}`)],
};

// ------------------------------------------------------------------------------------------------ pages
const pg = (id, o) => ({ id, state: 'conv', lang: 'ar', appearance: 'dark', w: 390, h: 844, ...o });
const NORMAL = [
  pg('I-conv-ad', { q: { dir: 'I' } }), pg('I-shared-ad', { state: 'shared', q: { dir: 'I' } }),
  pg('II-conv-ad', { q: { dir: 'II' } }), pg('II-shared-ad', { state: 'shared', q: { dir: 'II' } }),
  pg('BBCground-conv-ad', { q: { s: 'B', u: 'B', q: 'C', sw: 'ground' } }), pg('BBCground-shared-ad', { state: 'shared', q: { s: 'B', u: 'B', q: 'C', sw: 'ground' } }),
  pg('ABBplate-conv-el', { lang: 'en', appearance: 'light', q: { s: 'A', u: 'B', q: 'B', sw: 'plate' } }), pg('ABBplate-shared-el', { state: 'shared', lang: 'en', appearance: 'light', q: { s: 'A', u: 'B', q: 'B', sw: 'plate' } }),
  pg('I-conv-a320', { w: 320, h: 568, q: { dir: 'I' } }), pg('II-conv-e320', { lang: 'en', appearance: 'light', w: 320, h: 568, q: { dir: 'II' } }),
  pg('II-conv-a430', { w: 430, h: 932, q: { dir: 'II' } }), pg('I-conv-hc-el', { lang: 'en', appearance: 'light', contrast: true, q: { dir: 'I' } }),
  pg('activity-ad', { state: 'activity', q: { dir: 'II' } }), pg('settings-el', { state: 'settings', lang: 'en', appearance: 'light', q: { dir: 'II' } }), pg('understanding-ad', { state: 'understanding', q: { dir: 'I' } }),
  pg('an-end-plate-ad', { state: 'analysis', q: { sw: 'plate', x: 'end' } }), pg('an-centre-ground-call-ad', { state: 'analysis-call', q: { sw: 'ground', x: 'centre' } }),
  pg('an-end-seam-pinned-el', { state: 'analysis-pinned', lang: 'en', appearance: 'light', q: { sw: 'seam', x: 'end' } }),
  pg('an-end-cp320-ad', { state: 'analysis-callpinned', w: 320, h: 568, q: { sw: 'plate', x: 'end' } }), pg('an-centre-cp320-el', { state: 'analysis-callpinned', lang: 'en', w: 320, h: 568, q: { sw: 'seam', x: 'centre' } }),
  pg('an-top-cp320-ad', { state: 'analysis-callpinned', w: 320, h: 568, q: { sw: 'plate', x: 'top' } }), pg('an-top-p1-el', { state: 'analysis', lang: 'en', q: { sw: 'plate', x: 'top' } }),
  pg('an-none-cue-ad', { state: 'analysis-cue', q: { sw: 'plate', x: 'none' } }),
];
/** Each planted defect, the pages it is loaded on, and the check that must reject it. */
const PLANTED = {
  fourthtab: ['C-NAV-1', [pg('d-conv', { q: { dir: 'I', defect: 'fourthtab' } })]],
  brasssel: ['C-NAV-4', [pg('d-conv', { q: { dir: 'I', defect: 'brasssel' } })]],
  nosel: ['C-NAV-5', [pg('d-conv', { q: { dir: 'I', defect: 'nosel' } })]],
  glyphbelow: ['C-NAV-3', [pg('d-conv', { q: { dir: 'I', defect: 'glyphbelow' } })]],
  dupsettings: ['C-SET-1', [pg('d-conv', { q: { dir: 'I', defect: 'dupsettings' } })]],
  hiddensettings: ['C-SET-1', [pg('d-conv', { q: { dir: 'II', defect: 'hiddensettings' } }), pg('d-shared', { state: 'shared', q: { dir: 'II', defect: 'hiddensettings' } })]],
  settingsname: ['C-NAME-1', [pg('d-conv', { q: { dir: 'II', defect: 'settingsname' } })]],
  smalltarget: ['C-TGT-1', [pg('d-conv', { q: { dir: 'II', defect: 'smalltarget' } })]],
  understandinginsettings: ['C-UND-1', [pg('d-conv', { q: { dir: 'I', defect: 'understandinginsettings' } }), pg('d-settings', { state: 'settings', q: { dir: 'I', defect: 'understandinginsettings' } })]],
  activityinanalysis: ['C-ACT-2', [pg('d-an', { state: 'analysis', q: { dir: 'I', defect: 'activityinanalysis' } })]],
  wrongq: ['C-Q-3', [pg('d-conv', { q: { dir: 'I', defect: 'wrongq' } })]],
  qstatus: ['C-Q-2', [pg('d-conv', { q: { dir: 'I', defect: 'qstatus' } })]],
  redrawnq: ['C-Q-1', [pg('d-conv', { q: { s: 'B', u: 'A', q: 'B', defect: 'redrawnq' } })]],
  ctxdup: ['C-X-1', [pg('d-an', { state: 'analysis', q: { dir: 'I', defect: 'ctxdup' } })]],
  ctxoverlap: ['C-X-2', [pg('d-an', { state: 'analysis-call', q: { dir: 'I', defect: 'ctxoverlap' } })]],
  activityend: ['C-ACT-1', [pg('d-conv', { q: { dir: 'II', defect: 'activityend' } })]],
  focusorder: ['C-FOCUS-1', [pg('d-conv', { q: { dir: 'II', defect: 'focusorder' } })]],
  settingsroute: ['C-SET-2', [pg('d-conv', { q: { dir: 'II', defect: 'settingsroute' } })]],
  doorcopy: ['C-COPY-1', [pg('d-conv', { q: { dir: 'I', defect: 'doorcopy' } })]],
  mirrornav: ['C-DIR-2', [pg('d-conv', { q: { dir: 'I', defect: 'mirrornav' } })]],
  navname: ['C-NAV-6', [pg('d-conv', { q: { dir: 'I', defect: 'navname' } })]],
  lightanalysis: ['C-APP-1', [pg('d-an', { state: 'analysis-pinned', lang: 'en', appearance: 'light', q: { dir: 'I', defect: 'lightanalysis' } })]],
  wrongdir: ['C-DIR-1', [pg('d-conv', { q: { dir: 'I', defect: 'wrongdir' } })]],
};

// ------------------------------------------------------------------------------------------------ STATIC CHECKS
const walk = (dir) => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
function staticChecks(F) {
  const out = {};
  const prov = JSON.parse(readFileSync(join(SOURCE, 'PROVENANCE.json'), 'utf8'));
  const bad = [];
  for (const [to, e] of Object.entries(prov.files)) {
    const here = sha(readFileSync(join(SOURCE, ...to.split('/')))), canon = sha(readFileSync(join(REPO, ...e.from.split('/'))));
    if (here !== e.sha256 || canon !== e.sha256) bad.push(`${to}: here ${here.slice(0, 8)} canon ${canon.slice(0, 8)} recorded ${e.sha256.slice(0, 8)}`);
  }
  out['C-PROV-1'] = ['every vendored file is byte-identical to its canonical origin and to PROVENANCE.json', bad, `${Object.keys(prov.files).length} files`];
  const g = sha(readFileSync(join(PKG, 'prototype', 'g3.2', 'index.html'))), gc = sha(readFileSync(join(REPO, ...prov.g32.from.split('/'))));
  out['C-G32-1'] = ['G3.2\'s reviewed prototype is loaded byte-exact and the canonical G3.2 source is unchanged', [g, gc].every((x) => x === EXPECT_G32) && prov.g32.sha256 === EXPECT_G32 ? [] : [`vendored ${g.slice(0, 8)} canonical ${gc.slice(0, 8)}`], EXPECT_G32];
  const qm = readFileSync(join(SOURCE, 'vendor', 'brand', 'QANDEEL_Q_BASE_MASTER.svg')), qc = readFileSync(join(REPO, 'docs', 'design', 'canonical-artifacts', 'brand', 'i-08b2.5', 'masters', 'QANDEEL_Q_BASE_MASTER.svg'));
  out['C-Q-0'] = ['the Q geometry is read from the preserved brand master, byte-exact (brand master bytes unchanged)', sha(qm) === sha(qc) ? [] : ['brand master differs'], sha(qc)];
  return out;
}
async function buildCheck() {
  const { page } = await import('../src/build.mjs');
  const html = page(), onDisk = readFileSync(join(PKG, 'prototype', 'index.html'), 'utf8');
  return ['source/ rebuilds prototype/index.html byte-identically', html === onDisk ? [] : ['prototype/index.html is not the build of source/'], sha(Buffer.from(html))];
}
function gitScope() {
  if (NO_GIT) return ['changed paths: only the P4-C package and, optionally, docs/p4/P4_READ_FIRST.md (skipped: --no-git)', [], 'skipped'];
  const tracked = execFileSync('git', ['diff', '--name-only', BASE], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
  const all = [...new Set([...tracked, ...untracked])];
  const bad = all.filter((p) => !p.startsWith(PKG_REL + '/') && p !== 'docs/p4/P4_READ_FIRST.md');
  return ['changed paths: only the P4-C package and, optionally, docs/p4/P4_READ_FIRST.md (no apps / packages / database / .github / dependency / frozen record)', bad, `${all.length} paths vs ${BASE.slice(0, 7)}`];
}
function shotChecks() {
  const S = JSON.parse(readFileSync(join(PKG, 'data', 'SHOTS.json'), 'utf8'));
  const byId = Object.fromEntries(S.shots.map((s) => [s.id, s]));
  const bad = [];
  for (const s of SHOTS) { const r = byId[s.id]; if (!r) { bad.push(`${s.id} missing`); continue; }
    for (const k of ['state', 'lang', 'appearance', 'w', 'h']) if (r[k] !== s[k]) bad.push(`${s.id}: ${k}`);
    const m = r.measured.phone; if ((s.lang === 'ar') !== (m.dir === 'rtl')) bad.push(`${s.id}: direction`); if (s.state.startsWith('analysis') && m.appearance !== 'dark') bad.push(`${s.id}: analysis not dark`); }
  for (const id of KEEP) { const p = join(PKG, 'captures', id + '.png'); if (!existsSync(p) || sha(readFileSync(p)) !== byId[id].sha256) bad.push(`captures/${id}.png`); }
  const cov = { ar: S.shots.some((s) => s.lang === 'ar'), en: S.shots.some((s) => s.lang === 'en'), w320: S.shots.some((s) => s.w === 320), w390: S.shots.some((s) => s.w === 390), w430: S.shots.some((s) => s.w === 430),
    darkShell: S.shots.some((s) => !s.state.startsWith('analysis') && s.measured.phone.appearance === 'dark'), lightShell: S.shots.some((s) => !s.state.startsWith('analysis') && s.measured.phone.appearance === 'light'),
    analysisUnderLight: S.shots.some((s) => s.state.startsWith('analysis') && s.appearance === 'light' && s.measured.phone.appearance === 'dark'), contrast: S.shots.some((s) => s.contrast),
    focus: S.shots.some((s) => s.measured.focused && s.measured.focused.ring), largeText: S.shots.some((s) => s.q.ts === 'large') };
  const miss = Object.entries(cov).filter(([, v]) => !v).map(([k]) => `coverage: ${k}`);
  return { 'C-SHOT-1': ['every declared capture exists with its declared state; kept captures are byte-identical to SHOTS.json', bad, `${S.shots.length} captures, ${KEEP.length} kept`],
    'C-COV-1': ['coverage: AR RTL + EN LTR; 320 / 390 / 430; Dark + Light non-Analysis; the Analysis dark under Light; Increased Contrast; keyboard focus; large text', miss, JSON.stringify(cov)] };
}
function labelChecks() {
  const out = {}, bad = [];
  const texts = walk(PKG).filter((p) => (/\.(md|json)$/.test(p) || /source[\\/]src[\\/](candidates|content)\.mjs$/.test(p)) && !p.includes(`${join('source', 'vendor')}`) && !p.endsWith('MANIFEST.json') && !p.endsWith('SHOTS.json') && !p.endsWith('CHECKS.json'));
  const CAND = /\b(S-A|S-B|U-A|U-B|Q-A|Q-B|Q-C|SW-1|SW-2|SW-3|X-A|X-B|X-C|Direction I{1,2})\b/;
  // the labels that would claim a decision are UPPERCASE; only these exact, non-claiming phrases are removed before the test
  const SAFE = /NOT SELECTED|No candidate has been selected or frozen|\bSELECTED\b(?= (by|=|is|as|state|marker|through|in|has|carried|channel|with))|SELECTED \(|FROZEN UPSTREAM|CLOSED \/ FROZEN|NOT FROZEN|Arabic APPROVED|AR APPROVED|\(APPROVED\)|APPROVED —/g;
  for (const p of texts) readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
    if (!CAND.test(line)) return;
    if (/\b(APPROVED|SELECTED|FINAL|FROZEN)\b/.test(line.replace(SAFE, ''))) bad.push(`${posix(relative(PKG, p))}:${i + 1}: ${line.trim().slice(0, 140)}`);
  });
  out['C-LABEL-1'] = ['no candidate is labelled APPROVED / SELECTED / FINAL / FROZEN in the package\'s documents, data or candidate sources (board pixels are checked by review, not by this scan)', bad, `${texts.length} files scanned`];  const mp = join(PKG, 'data', 'DECISION_MATRIX.json');
  if (existsSync(mp)) {
    const M = JSON.parse(readFileSync(mp, 'utf8')), b2 = [];
    for (const d of M.decisions) { if (d.state !== 'OPEN') b2.push(`${d.dq} ${d.state}`); for (const c of d.candidates) if (!/^(CANDIDATE — NOT SELECTED|REJECTED BY AUTHORITY)$/.test(c.status)) b2.push(`${c.id} ${c.status}`); }
    for (const d of M.integrated || []) if (d.status !== 'INTEGRATED CANDIDATE — NOT SELECTED') b2.push(`${d.id} ${d.status}`);
    out['C-OPEN-1'] = ['DQ-01 … DQ-04 stay OPEN; every candidate is CANDIDATE — NOT SELECTED or REJECTED BY AUTHORITY; integrated directions are NOT SELECTED', b2, `${M.decisions.length} decisions`];
  } else out['C-OPEN-1'] = ['DQ-01 … DQ-04 stay OPEN (DECISION_MATRIX.json)', ['data/DECISION_MATRIX.json missing'], ''];
  return out;
}
function linkCheck() {
  const bad = []; let n = 0;
  for (const p of walk(PKG).filter((x) => x.endsWith('.md') && !x.includes(join('source', 'vendor')))) {
    for (const m of readFileSync(p, 'utf8').matchAll(/\]\(([^)\s#]+)(#[^)]*)?\)/g)) { if (/^[a-z]+:/i.test(m[1])) continue; n++; if (!existsSync(resolve(dirname(p), decodeURI(m[1])))) bad.push(`${posix(relative(PKG, p))} → ${m[1]}`); }
  }
  return ['every relative Markdown link in the package resolves', bad, `${n} links`];
}

// ------------------------------------------------------------------------------------------------ run
const judge = (F) => Object.fromEntries(Object.entries(DOM).map(([id, [title, fn]]) => { const fails = fn(F).filter(Boolean); return [id, { title, pass: fails.length === 0, fails: fails.slice(0, 12) }]; }));
const F = [];
for (const p of NORMAL) F.push(await facts(p));
const normal = judge(F);
// X-C's world cost, measured (the matrix must classify it from this number, not from taste)
const worldCost = F.filter((f) => f.place === 'analysis' && f.ctx.length).map((f) => {
  const R = f.g32.rects, x = f.ctx[0], top = R.back.b, bottom = Math.min(...['tl-ctx', 'tl-track', 'tl-live'].map((k) => (R[k] ? R[k].y : Infinity)));
  const world = bottom - top, cost = x.place === 'top' ? Math.max(0, Math.min(x.b, bottom) - Math.max(x.y, top)) : 0;
  return { page: f.page.id, placement: x.place, world: +world.toFixed(1), overlayCost: +cost.toFixed(1), unobstructed: +(world - cost).toFixed(1), floor: FLOOR, belowFloor: world - cost < FLOOR };
});
// a REAL keyboard walk: Tab pressed from the page start; the focused control after each press must be the next control of
// the upper chrome and the Personal row in visual reading order
async function tabWalk(page) {
  const c = await openState(page);
  await c.eval('document.activeElement && document.activeElement.blur && document.activeElement.blur()');
  const want = await c.eval(`P4.controls().filter((x) => x.inHdr || x.inRow).map((x) => x.id || x.entry)`);
  const got = [];
  for (let i = 0; i < want.length; i++) { await key(c, 'Tab'); got.push(await c.eval(`(()=>{const a=document.activeElement;return a?(a.id||a.dataset.entry||a.dataset.nav||a.tagName):''})()`)); }
  return { page: page.id, want, got };
}
const walks = [];
for (const p of [pg('walk-I-conv-ad', { q: { dir: 'I' } }), pg('walk-II-conv-ad', { q: { dir: 'II' } }), pg('walk-II-conv-el', { lang: 'en', appearance: 'light', q: { dir: 'II' } })]) walks.push(await tabWalk(p));
normal['C-FOCUS-2'] = { title: 'a real Tab walk from the page start reaches the upper chrome and the Personal row in visual reading order', pass: walks.every((w) => w.want.length > 1 && JSON.stringify(w.want) === JSON.stringify(w.got)),
  fails: walks.filter((w) => JSON.stringify(w.want) !== JSON.stringify(w.got)).map((w) => `${w.page}: want ${w.want.join('>')} got ${w.got.join('>')}`), note: walks.map((w) => `${w.page}: ${w.got.join(' → ')}`).join(' | ') };
const planted = [];
for (const [d, [expect, pages]] of Object.entries(PLANTED)) {
  const FD = []; for (const p of pages) FD.push(await facts({ ...p, id: `${d}/${p.id}` }));
  const r = judge(FD)[expect];
  planted.push({ defect: d, what: DEFECTS[d], check: expect, rejected: !r.pass, evidence: r.fails.slice(0, 3) });
}
await closeBrowser(); await closeServers();

const statics = { ...staticChecks(F), 'C-BUILD-1': await buildCheck(), 'C-SCOPE-1': gitScope(), ...shotChecks(), ...labelChecks(), 'C-LINK-1': linkCheck() };
for (const [id, [title, fails, note]] of Object.entries(statics)) normal[id] = { title, pass: fails.length === 0, fails: fails.slice(0, 12), note };
const xc = worldCost.filter((w) => w.placement === 'top'), M = existsSync(join(PKG, 'data', 'DECISION_MATRIX.json')) ? JSON.parse(readFileSync(join(PKG, 'data', 'DECISION_MATRIX.json'), 'utf8')) : null;
const xcRow = M ? M.decisions.find((d) => d.dq === 'P4-DQ-04B').candidates.find((c) => c.id === 'X-C') : null;
normal['C-X-4'] = { title: 'the matrix classifies X-C from the measured world cost (below the 160 pt floor in the densest state ⇒ FAILS AUTHORITY)', pass: !!xcRow && (xc.some((w) => w.belowFloor) === (xcRow.dimensions['canonical compliance'] === 'FAILS AUTHORITY')), fails: xcRow ? [] : ['matrix missing'], note: JSON.stringify(xc) };

// every upper-chrome overflow any capture shows must be recorded by the matrix — none may be hidden
{ const SS = JSON.parse(readFileSync(join(PKG, 'data', 'SHOTS.json'), 'utf8')).shots.filter((s) => s.measured.hdr && s.measured.hdr.scrollW > s.measured.hdr.clientW + 0.5).map((s) => s.id).sort();
  const MM = M && M.measured.overflow ? M.measured.overflow.map((o) => o.id).sort() : null;
  normal['C-CHROME-1'] = { title: 'no upper-chrome overflow is hidden: every overflowing capture is recorded in the matrix, where its candidate is rated on it', pass: !!MM && JSON.stringify(SS) === JSON.stringify(MM), fails: MM ? SS.filter((i) => !MM.includes(i)).concat(MM.filter((i) => !SS.includes(i))) : ['matrix missing'], note: SS.join(', ') }; }
const ids = Object.keys(normal), passN = ids.filter((k) => normal[k].pass).length, rej = planted.filter((p) => p.rejected).length;
const result = { generated: 'tools/p4checks.mjs', baseline: BASE, summary: { normal: `${passN} / ${ids.length}`, planted: `${rej} / ${planted.length} planted defects rejected` },
  pages: NORMAL.map((p) => p.id), checks: normal, worldCost, planted };
const outFile = arg('--out') || join(PKG, 'data', 'CHECKS.json');
writeFileSync(outFile, JSON.stringify(result, null, 1) + '\n');
for (const k of ids) console.log(`${normal[k].pass ? 'PASS' : 'FAIL'} ${k} ${normal[k].pass ? '' : JSON.stringify(normal[k].fails.slice(0, 3))}`);
for (const p of planted) console.log(`${p.rejected ? 'REJECTED' : 'MISSED  '} ${p.defect} → ${p.check}`);
console.log(`\n${result.summary.normal} checks pass · ${result.summary.planted}`);
if (passN !== ids.length || rej !== planted.length) process.exitCode = 1;
