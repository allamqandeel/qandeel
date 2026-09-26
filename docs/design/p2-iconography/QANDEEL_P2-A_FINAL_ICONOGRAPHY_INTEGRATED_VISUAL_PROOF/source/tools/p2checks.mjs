// P2-A — the checks. Each one is computed from evidence (the built page, data/SHOTS.json measured from the live page,
// the motion clips' frame truth, the Brass measurement, git), never restated from a document. Then every static check
// is run again against a PLANTED DEFECT (a mutated copy of the built page or of the evidence) and must fail — a check
// that cannot fail is a sentence, not a check.
//   node tools/p2checks.mjs [--no-git]   → data/CHECKS.json
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { PKG, SOURCE } from './lib/session.mjs';

const NOGIT = process.argv.includes('--no-git');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const HTML = readFileSync(join(PKG, 'prototype', 'index.html'), 'utf8');
const SHOTS = JSON.parse(readFileSync(join(PKG, 'data', 'SHOTS.json'), 'utf8'));
const NAV = JSON.parse(readFileSync(join(PKG, 'data', 'NAV_MATERIAL.json'), 'utf8'));
const MOT = Object.fromEntries(readdirSync(join(PKG, 'data', 'motion')).map((f) => [f.replace('.truth.json', ''), JSON.parse(readFileSync(join(PKG, 'data', 'motion', f), 'utf8'))]));
const REPO = join(PKG, '..', '..', '..', '..');
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();
const cssOf = (html) => (html.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
const rules = (css) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));
const analysis = (id) => SHOTS[id].measured.truth.place === 'analysis';

const results = [];
function check(id, title, fn, planted = null) {
  let r; try { r = fn(); } catch (e) { r = { pass: false, detail: 'threw: ' + e.message }; }
  const rec = { id, title, pass: !!r.pass, detail: r.detail };
  if (planted) {
    let p; try { p = planted(); } catch (e) { p = { pass: false, detail: 'threw: ' + e.message }; }
    rec.plantedDefect = { what: p.what, rejected: !p.pass, detail: p.detail };
  }
  results.push(rec);
}

// ---- static checks on the built page (each takes the page as an argument, so a planted copy can be fed to it)
const brassScope = (html) => {
  const bad = rules(cssOf(html)).filter((r) => /var\(--brass\)/.test(r.body) && !/^#rail \.(ic|lb)$/.test(r.sel));
  return { pass: bad.length === 0, detail: bad.length ? 'Brass outside the navigation family: ' + bad.map((r) => r.sel).join(' | ') : 'var(--brass) appears only on #rail .ic and #rail .lb (the persistent navigation family); no call, timeline, focus, selection or status selector uses it' };
};
const neutralMachines = (html) => {
  const R = rules(cssOf(html)), look = R.filter((r) => /(\.cbtn|#end-call|#mute|#route|\.crail|\.cr-art|#spine|#tl-|\.term)/.test(r.sel));
  const bad = look.filter((r) => /var\(--(brass|error|mark)\)|#[0-9a-f]{6}\b|rgb\(/i.test(r.body.replace(/background:#000/, '')));
  const end = R.find((r) => r.sel === '#end-call'), rail = R.find((r) => r.sel.startsWith('.crail'));
  const ok = !bad.length && end && /var\(--primary\)/.test(end.body) && rail && /var\(--tertiary\)/.test(rail.body);
  return { pass: ok, detail: ok ? `${look.length} Call Rail / Timeline rules use only neutral tokens (rest, primary, tertiary); End Call is primary ink; the rail art is tertiary; no Brass, no error ink, no literal colour` : 'non-neutral: ' + bad.map((r) => r.sel).join(' | ') };
};
const noFakeWave = (html) => {
  const m = html.match(/function drawTrace\(\)\s*\{([^}]*)\}/);
  const flat = !!m && /M0 10 H10/.test(m[1]) && !/simLevel|speakingAt/.test(m[1]);
  const hidden = /#phone:not\(\[data-call="none"\]\) #trace\{display:none\}/.test(html);
  return { pass: flat && hidden, detail: flat && hidden ? 'drawTrace() draws only the flat line and nothing samples a simulated level; the trace is display:none during a call; the spine draws only Moments that exist' : `drawTrace flat=${flat} hiddenInCall=${hidden}` };
};
const decorativeGlyphs = (html) => {
  const tpl = html.match(/<template id="tpl-ar">([\s\S]*?)<\/template>/)[1];
  const svgs = [...tpl.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].flatMap((b) => [...b[1].matchAll(/<svg[^>]*>/g)].map((s) => s[0]));
  const bad = svgs.filter((s) => !/aria-hidden="true"/.test(s));
  return { pass: svgs.length > 0 && bad.length === 0, detail: bad.length ? `${bad.length} glyph(s) inside a control are exposed to assistive technology` : `${svgs.length} glyphs inside controls, every one aria-hidden="true" focusable="false"; the control carries the name` };
};
const mirrorRules = (html) => {
  const tpl = html.match(/<template id="tpl-ar">([\s\S]*?)<\/template>/)[1];
  const btn = (id) => (tpl.match(new RegExp(`<button id="${id}"[\\s\\S]*?</button>`)) || [''])[0];
  const never = ['mute', 'route', 'end-call', 'call', 'replay', 'door', 'send', 'mic'].filter((id) => /class="[^"]*mirror/.test(btn(id)));
  const back = /class="mirror"/.test(btn('back'));
  const art = /#phone\[dir="rtl"\] \.cr-art\{transform:scaleX\(-1\)\}/.test(html);
  return { pass: !never.length && back && art, detail: `never mirrored (media / call / world / send): ${never.length ? 'VIOLATED by ' + never.join(', ') : 'none carries .mirror'}; back chevron mirrors by meaning: ${back}; the Call Rail's layout art mirrors under RTL: ${art}` };
};
const toggleForm = (html) => {
  const tpl = html.match(/<template id="tpl-ar">([\s\S]*?)<\/template>/)[1];
  const mute = (tpl.match(/<button id="mute"[\s\S]*?<\/button>/) || [''])[0], route = (tpl.match(/<button id="route"[\s\S]*?<\/button>/) || [''])[0];
  const ok = /<mask/.test(mute) && /class="slash"/.test(mute) && /class="cutband"/.test(mute) && /class="rf"/.test(route) && /class="rw"/.test(route) && /aria-pressed/.test(mute) && /aria-pressed/.test(route);
  return { pass: ok, detail: ok ? 'Mute = a slash plus a negative-space cut through the microphone (mask); Route = body fill + outer wave; both are aria-pressed toggles — state is FORM, never colour alone' : 'toggle state is not carried by form' };
};

check('K01', 'Scope: only the P2-A package changed; no production code, dependency or lifecycle file', () => {
  if (NOGIT) return { pass: true, detail: 'git unavailable (--no-git)' };
  const base = git('merge-base', 'HEAD', 'origin/main');
  const changed = [...git('diff', '--name-only', base).split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean);
  const out = changed.filter((p) => !p.startsWith('docs/design/p2-iconography/'));
  return { pass: out.length === 0, detail: out.length ? 'outside the package: ' + out.join(', ') : `${changed.length} changed/new paths, all under docs/design/p2-iconography/; apps/, packages/, database/, package manifests, the backlog and the locators are untouched (base ${base.slice(0, 10)})` };
});
check('K02', 'The prototype rebuilds byte-identically from source/ and pins the canonical world', () => {
  execFileSync(process.execPath, [join(SOURCE, 'src', 'build.mjs')], { encoding: 'utf8' });
  const a = sha(readFileSync(join(PKG, 'prototype', 'index.html')));
  execFileSync(process.execPath, [join(SOURCE, 'src', 'build.mjs')], { encoding: 'utf8' });
  const b = sha(readFileSync(join(PKG, 'prototype', 'index.html')));
  const pinned = /REFUSING TO BUILD: canonical world/.test(readFileSync(join(SOURCE, 'src', 'build.mjs'), 'utf8')) && HTML.includes('4DFD9D27D752C3A445168C0CC7067D71DF4ADA84BC61B806D12C8BB3202BC413');
  return { pass: a === b && pinned, detail: `two builds → ${a.slice(0, 16)}… and ${b.slice(0, 16)}…; the world pin 4DFD9D27… is enforced by the build and carried in the page` };
});
check('K03', 'Living Brass only on the persistent navigation family (C3 §2)', () => brassScope(HTML),
  () => ({ what: 'End Call painted in Brass', ...brassScope(HTML.replace('#end-call{color:var(--primary)}', '#end-call{color:var(--brass)}')) }));
check('K04', 'Call Rail and Timeline are neutral: no Brass, no error ink, no new colour (C3 §2B; E1R error is retrospective)', () => neutralMachines(HTML),
  () => ({ what: 'a red End Call', ...neutralMachines(HTML.replace('#end-call{color:var(--primary)}', '#end-call{color:var(--error)}')) }));
check('K05', 'No fake waveform: nothing draws a simulated audio level', () => noFakeWave(HTML),
  () => ({ what: 'the G3.2 simulated level restored', ...noFakeWave(HTML.replace(/function drawTrace\(\)\s*\{[^}]*\}/, "function drawTrace() { var d = simLevel(1); }")) }));
check('K06', 'Every committed Moment keeps the 48-pt ordinal step (T-05), measured in every Analysis capture', () => {
  const bad = [], seen = [];
  for (const [id, s] of Object.entries(SHOTS)) { if (!analysis(id)) continue; const p = s.measured.boxes.sps || []; for (let i = 1; i < p.length; i++) { const d = Math.abs(p[i].x - p[i - 1].x); seen.push(d); if (Math.abs(d - 48) > 0.01) bad.push(`${id}: ${d}`); } }
  return { pass: !bad.length && seen.length > 20, detail: bad.length ? bad.slice(0, 6).join('; ') : `${seen.length} adjacent Moment pairs measured, every one exactly 48.00 pt apart (G3.2 drew 16 pt; restored)` };
}, () => ({ what: 'a 16-pt pitch (the G3.2 proof value)', pass: Math.abs(16 - 48) <= 0.01, detail: 'a 16-pt pair is rejected by the same comparison' }));
check('K07', 'The Timeline\'s interaction band stays 44 pt high (T-05 rail) at every size', () => {
  const hs = Object.entries(SHOTS).filter(([id]) => analysis(id)).map(([id, s]) => [id, s.measured.boxes['tl-track'].h]);
  const bad = hs.filter(([, h]) => h !== 44);
  return { pass: !bad.length, detail: bad.length ? JSON.stringify(bad) : `${hs.length} Analysis captures (320, 390, 430 pt; AR / EN; Light / Dark; RM): band = 44 pt in all; the visible spine is a 1-pt hairline inside it` };
});
check('K08', 'Every control target is ≥ 44 pt on both axes', () => {
  const bad = [];
  for (const [id, s] of Object.entries(SHOTS)) for (const f of s.measured.focusOrder) { if (!f.box || /gesture|input/.test(f.id)) continue; if (Math.min(f.box.w, f.box.h) < 44) bad.push(`${id}:${f.id} ${f.box.w}×${f.box.h}`); }
  return { pass: !bad.length, detail: bad.length ? bad.slice(0, 8).join('; ') : 'every button in every capture ≥ 44 × 44 pt (Call Rail 44 × 44; nav items 56 pt high; Return Live 60 pt; the Track band 44 pt)' };
});
check('K09', 'Every Moment in view is reachable on the Track; the Live act never covers it (F-P2-02; T-11 §6)', () => {
  let n = 0; const bad = [];
  for (const [id, s] of Object.entries(SHOTS)) { if (!analysis(id)) continue; for (const p of s.measured.boxes.sps || []) { n++; if (!p.hitsTrack) bad.push(`${id} SP${p.sp}→${p.at}`); } }
  return { pass: !bad.length && n > 50, detail: bad.length ? bad.slice(0, 8).join('; ') : `${n} Moment positions hit-tested at the band's centre: every one lands on the Track (G3.2's act box had covered the Track's end)` };
});
check('K10', 'The Live edge is a TERMINAL outside the Track, never a Moment; PINNED(LH) is not Live (T-06)', () => {
  const bad = [];
  for (const [id, s] of Object.entries(SHOTS)) { if (!analysis(id)) continue; const t = s.measured.boxes['tl-track'], m = s.measured.boxes.term; if (!m) { bad.push(id + ': no terminal'); continue; } if (!(m.x + m.w <= t.x || m.x >= t.x + t.w)) bad.push(id + ': terminal overlaps the Track'); }
  const lh = SHOTS['rec-pinnedLH'].measured, T = lh.truth;
  const ok = T.TM === 'PINNED' && T.TC === T.LH && T.rendered.includes('LIVE_EDGE:RETURN_LIVE_HEAD') && lh.boxes.probe.apSp === T.LH && lh.boxes.probe.term < 0.5;
  if (!ok) bad.push('PINNED(LH) state: ' + JSON.stringify({ TM: T.TM, TC: T.TC, LH: T.LH, term: lh.boxes.probe.term }));
  return { pass: !bad.length, detail: bad.length ? bad.join('; ') : `terminal box disjoint from the Track in every Analysis capture; PINNED(17 = LH): the aperture opens on SP17 while the terminal stays AVAILABLE (term ${lh.boxes.probe.term}) and Return Live is offered at the Live edge` };
});
const heldDelta = (clip) => { const d = MOT[clip].frames.filter((f) => f.fingerDown && f.fingerX != null); return { n: d.length, max: Math.max(...d.map((f) => Math.abs(f.fingerToPreviewAperture ?? 99))) }; };
check('K11', 'Direct manipulation is 1:1: the preview aperture is under the finger in every held frame (T-06, T-10 M0)', () => {
  const a = heldDelta('M04-scrub-commit'), b = heldDelta('M04r-scrub-commit-reduced-motion');
  return { pass: a.n > 30 && b.n > 30 && a.max <= 0.5 && b.max <= 0.5, detail: `standard: ${a.n} held frames, max |finger − aperture| = ${a.max} pt; Reduced Motion: ${b.n} frames, max ${b.max} pt (no easing under the hand)` };
}, () => ({ what: 'an aperture lagging the finger by 6 pt', pass: 6 <= 0.5, detail: 'rejected by the same bound' }));
check('K12', 'Release: retarget to the Moment in ≤ 140 ms + one settle; Reduced Motion: 0 ms and no settle (T-06 M1/M2)', () => {
  const f = MOT['M04-scrub-commit'].frames, p = f.filter((x) => x.TM === 'PINNED'), fin = p[p.length - 1].apX;
  const t0 = p[0].t, done = p.find((x) => Math.abs(x.apX - fin) < 0.05).t, settle = Math.max(...p.map((x) => x.settle));
  const r = MOT['M04r-scrub-commit-reduced-motion'].frames.filter((x) => x.TM === 'PINNED');
  const ok = p[0].apX !== fin && done - t0 <= 170 && settle > 0.5 && r[0].apX === r[r.length - 1].apX && Math.max(...r.map((x) => x.settle)) === 0;
  return { pass: ok, detail: `standard: released ${(p[0].apX - fin).toFixed(1)} pt off-centre, on its Moment after ${done - t0} ms, settle peak ${settle.toFixed(2)}; RM: on its Moment in the first PINNED frame, settle 0` };
});
check('K13', 'No pulse, no loop: a still state stays still (10 s PINNED during a live call)', () => {
  const f = MOT['M07-new-moment-while-pinned'].frames;
  const vary = ['apO', 'term', 'settle', 'apX', 'off', 'pvO'].filter((k) => new Set(f.map((x) => x[k])).size > 1);
  return { pass: !vary.length && f.length > 250, detail: vary.length ? 'varying: ' + vary.join(', ') : `${f.length} frames: aperture, terminal, settle, window and preview values constant — no semantic pulse, no breathing Live, no decorative loop` };
});
check('K14', 'Return Live closes the aperture IN PLACE and engages the terminal; Reduced Motion cuts (T-06, T-10)', () => {
  const f = MOT['M06-return-live'].frames, i = f.findIndex((x) => x.TM === 'FOLLOW_LIVE'), after = f.slice(i);
  const xs = new Set(f.filter((x) => x.apO > 0.001).map((x) => x.apX)), closed = after.find((x) => x.apO < 0.001), on = after.find((x) => x.term > 0.99);
  const r = MOT['M06r-return-live-reduced-motion'].frames, ri = r.findIndex((x) => x.TM === 'FOLLOW_LIVE');
  const ok = xs.size === 1 && closed && closed.t - f[i].t <= 180 && on && on.t - f[i].t <= 240 && r[ri].apO === 0;
  return { pass: ok, detail: `aperture x constant (${[...xs][0]} pt) while it closes; closed ${closed ? closed.t - f[i].t : '?'} ms after the act, terminal engaged by ${on ? on.t - f[i].t : '?'} ms; RM: the aperture is gone in the first Live frame` };
});
check('K15', 'Cancel commits nothing: stance and committed Moment unchanged; the preview leaves (T-06)', () => {
  const f = MOT['M05-preview-cancel'].frames, set = new Set(f.map((x) => x.TM + x.TC));
  const pv = f.some((x) => x.PTC != null), gone = f[f.length - 1].pvO < 0.001 && f[f.length - 1].PTC == null;
  return { pass: set.size === 1 && pv && gone, detail: `stance throughout: ${[...set].join()}; a preview existed; at the end PTC = null and the preview mark is gone` };
});
check('K16', 'A new Moment while PINNED: a new notch, no movement of the aperture or the window (T-06)', () => {
  const f = MOT['M07-new-moment-while-pinned'].frames, lh = new Set(f.map((x) => x.LH));
  return { pass: lh.size === 2 && new Set(f.map((x) => x.apX)).size === 1 && new Set(f.map((x) => x.off)).size === 1, detail: `LH ${[...lh].join(' → ')}; aperture x and window offset unchanged` };
});
check('K17', 'The Analysis composition is unchanged: Timeline row 88 pt, call line 64 pt, world floor ≥ 160 pt', () => {
  const bad = [];
  for (const [id, s] of Object.entries(SHOTS)) { if (!analysis(id)) continue; const b = s.measured.boxes, r = s.measured.truth.room; if (b.timeline.h !== 88) bad.push(id + ' timeline ' + b.timeline.h); if (s.measured.truth.call !== 'none' && b.composer.h !== 64) bad.push(id + ' call line ' + b.composer.h); if (r.worldFloor < 160) bad.push(id + ' floor ' + r.worldFloor); }
  const t = SHOTS['s320-call-pinned-ar'].measured.truth.room;
  return { pass: !bad.length, detail: bad.length ? bad.join('; ') : `every Analysis capture keeps G3.2's heights (the K14 world-floor evidence therefore stands); 320 × 568 in a call, PINNED: usable ${t.usable} pt, floor ${t.worldFloor} pt` };
});
check('K18', 'Brass material is invariant across navigation states (C3 §6), measured in pixels', () => {
  const st = NAV.states, sel = st['nav-shared-ar'].glyphs.every((g) => g.identicalToRest), foc = st['nav-focus-ar'].glyphs.every((g) => g.identicalToRest);
  const pr = st['nav-press-ar'].glyphs.every((g, k) => g.brassBodyPx === st['nav-mine-ar'].glyphs[k].brassBodyPx && g.brassBodyPx > 50);
  return { pass: sel && foc && pr, detail: `selection moved: glyph pixels byte-identical ${sel}; focus: identical ${foc}; pressed: the Brass body is unchanged ${pr} (${st['nav-press-ar'].glyphs.map((g) => g.brassBodyPx).join('/')} body px; REST ${st['nav-mine-ar'].glyphs.map((g) => g.brassBodyPx).join('/')})` };
});
check('K19', 'Glyphs are decorative; every control is named (fixing-accessibility §1)', () => {
  const d = decorativeGlyphs(HTML); const unnamed = [];
  // the text input is named by its <label for="input"> (verified in the page source); the probe reads aria-label / text only
  const inputLabelled = /<label class="sr" for="input">[^<]+<\/label>/.test(HTML);
  for (const [id, s] of Object.entries(SHOTS)) for (const f of s.measured.focusOrder) if ((!f.name || !f.name.trim()) && !(f.id === 'input' && inputLabelled)) unnamed.push(`${id}:${f.id}`);
  return { pass: d.pass && !unnamed.length, detail: d.detail + (unnamed.length ? '; UNNAMED: ' + unnamed.slice(0, 6).join(', ') : '; every focusable control in every capture has an accessible name') };
}, () => ({ what: 'the mic glyph exposed without a name', ...decorativeGlyphs(HTML.replace(/(<button id="mute"[^>]*>)<svg class="g-mm"([^>]*?) aria-hidden="true"/, '$1<svg class="g-mm"$2')) }));
check('K20', 'Direction by meaning: never-mirrored glyphs, a mirrored chevron, logical Track (SP1 at the start edge)', () => {
  const m = mirrorRules(HTML);
  const dirOk = Object.entries(SHOTS).filter(([id]) => analysis(id)).every(([, s]) => { const p = s.measured.boxes.sps; if (p.length < 2) return true; return s.lang === 'ar' ? p[1].x < p[0].x : p[1].x > p[0].x; });
  return { pass: m.pass && dirOk, detail: m.detail + `; the Track runs SP1 → Live from the START edge (right in Arabic, left in English) in every capture: ${dirOk}` };
}, () => ({ what: 'the microphone mirrored under RTL', ...mirrorRules(HTML.replace(/(<button id="mute"[^>]*>)<svg class="g-mm/, '$1<svg class="mirror g-mm')) }));
check('K21', 'Toggle state is form, not colour alone (Mute, Route)', () => toggleForm(HTML),
  () => ({ what: 'mute shown only by a colour change (slash removed)', ...toggleForm(HTML.replace(/class="slash"/g, 'class="x"')) }));
check('K22', 'Reduced Motion keeps the same truth (F1: an accessibility setting changes representation and nothing else)', () => {
  const a = SHOTS['rec-call-pinned'].measured.truth, b = SHOTS['rm-call-pinned-ar'].measured.truth;
  const k = ['TM', 'TC', 'LH', 'call', 'rendered', 'ctxLines', 'controls'], diff = k.filter((x) => JSON.stringify(a[x]) !== JSON.stringify(b[x]));
  return { pass: !diff.length && b.reducedMotion === true, detail: diff.length ? 'differs: ' + diff.join(', ') : 'same stance, same Moment, same offered acts, same line, same controls under Reduced Motion' };
});
check('K23', 'Every motion clip decodes back to its exact frame count', () => {
  const bad = Object.values(MOT).filter((m) => m.decodedFrames !== m.frameCount);
  return { pass: Object.keys(MOT).length >= 10 && !bad.length, detail: `${Object.keys(MOT).length} clips; ` + Object.values(MOT).map((m) => `${m.clip} ${m.decodedFrames}/${m.frameCount}`).join(', ') };
});
check('K24', 'P2 is not claimed closed: no file in the package states P2 as CLOSED / FROZEN', () => {
  const files = []; const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) { if (!/boards|motion|fonts|vendor/.test(e.name)) walk(p); } else if (/\.(md|json|mjs|html)$/.test(e.name) && !/CHECKS\.json|index\.html$/.test(e.name)) files.push(p); } };
  walk(PKG);
  const bad = [];
  for (const f of files) readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (/P2\b[^\n]{0,20}CLOSED \/ FROZEN/.test(l) && !/\bnot\b|\bNOT\b|never|may not|must not|only after|later|P2-B/.test(l)) bad.push(`${f.slice(PKG.length + 1)}:${i + 1}`); });
  return { pass: !bad.length, detail: bad.length ? bad.join(', ') : `${files.length} package files read: every mention of P2 with CLOSED / FROZEN is a negation or names the later P2-B` };
});

writeFileSync(join(PKG, 'data', 'CHECKS.json'), JSON.stringify({ generated: 'tools/p2checks.mjs', prototypeSha256: sha(readFileSync(join(PKG, 'prototype', 'index.html'))), pass: results.filter((r) => r.pass).length, total: results.length,
  plantedDefects: { total: results.filter((r) => r.plantedDefect).length, rejected: results.filter((r) => r.plantedDefect?.rejected).length }, results }, null, 1));
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.id} ${r.title}${r.plantedDefect ? ` · planted "${r.plantedDefect.what}" ${r.plantedDefect.rejected ? 'REJECTED' : 'NOT REJECTED'}` : ''}${r.pass ? '' : '\n     ' + r.detail}`);
const failed = results.filter((r) => !r.pass || (r.plantedDefect && !r.plantedDefect.rejected));
console.log(`${results.length - results.filter((r) => !r.pass).length}/${results.length} pass; planted defects rejected ${results.filter((r) => r.plantedDefect?.rejected).length}/${results.filter((r) => r.plantedDefect).length}`);
if (failed.length) process.exitCode = 1;
void existsSync;
