// G3.2 planted-defect probes. Each probe PLANTS one regression in a copy of this source tree, BUILDS it, CAPTURES the
// states the defect shows in (with the same capture tool), and hands those captures to the check that guards it —
// in place of the real ones. The check must FAIL. A probe whose plant does not apply, or whose build is refused, is
// reported as such (a refused build is itself the rejection when the defect is one the build forbids).
// usage: node tools/probes.mjs [--only PR1,PR2]   → <PKG>/data/PROBES.json (exit 1 if any planted defect is missed)
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { SOURCE, PKG, WORK } from './lib/session.mjs';
import { CHECKS, loadInputs, clone } from './checks.mjs';

const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
// [id, check, defect, plants: [[file, from, to]], snaps to re-capture from the planted build]
export const PROBES = [
  ['PR1', 'K17', 'a light Analysis shell under system Light (nothing around the world takes the dark scope)',
    [['src/app.js', "var ANALYSIS_SHELL = ['rail', 'composer', 'replay', 'rmenu', 'status', 'homebar'];", 'var ANALYSIS_SHELL = [];']], ['light-far', 'light-pinned', 'light-call']],
  ['PR2', 'K09', 'the temporal line moved back below the Timeline',
    [['src/build.mjs', '#tl-ctx{position:absolute;bottom:60px;', '#tl-ctx{position:absolute;bottom:-54px;']], ['pinned', 'pinned-open', 's320-pinned', 'en-pinned']],
  ['PR3', 'K12', 'a Return act rendered twice (Return Live also disclosed under «طرق العودة»)',
    [['src/app.js', "var band = ids.filter(function (id) { return id !== 'RETURN_LIVE_HEAD'; });", 'var band = ids.slice();']], ['pinned-open', 'light-pinned-open']],
  ['PR4', 'K14', 'the world squeezed below the T-11 floor at 320 × 568 (OrientationChrome takes 60 pt more than its room)',
    [['src/app.js', 'return Math.max(0, Math.floor(f.usable - f.floor - 88 - ctxExtra()));', 'return Math.max(0, Math.floor(f.usable - f.floor - 88 - ctxExtra())) + 60;']], ['s320-pinned-open', 's320-call-pinned-open']],
  ['PR10', 'K14', 'G3.1\'s fixed OrientationChrome minimum kept (54 pt) — the line then pushes the world below its floor at 320 × 568',
    [['src/app.js', 'return Math.max(0, Math.floor(f.usable - f.floor - 88 - ctxExtra()));', 'return Math.max(54, Math.floor(f.usable - f.floor - 88 - ctxExtra()));']], ['s320-call-pinned', 'en-s320-call-pinned']],
  ['PR5', 'K18', 'status-region legibility broken (the status row keeps the system-Light ink over the dark Analysis)',
    [['src/app.js', "var ANALYSIS_SHELL = ['rail', 'composer', 'replay', 'rmenu', 'status', 'homebar'];", "var ANALYSIS_SHELL = ['rail', 'composer', 'replay', 'rmenu', 'homebar'];"]], ['light-far', 'light-call', 'light-call-back']],
  ['PR6', 'K06', 'rendered world pixels changed (a 2 % brightness filter on the world frame)',
    [['src/build.mjs', '#world-frame{display:block;', '#world-frame{display:block;filter:brightness(1.02);']], ['far', 'mid', 'near', 'pinned', 'call']],
  ['PR7', 'K03', 'world bytes changed (one byte of the vendored canonical world flipped)',
    [['vendor/canon/wf-living-constellation.html', 'BYTE@1000', 'FLIP']], []],
  ['PR8', 'K11', 'a stale PINNED sentence left in LIVE (the line shown whatever the stance)',
    [['src/app.js', "    if (S.mode === 'PINNED') {\n      var l = [", "    if (true) {\n      var l = ["]], ['far', 'near', 'mid', 'call', 'pinned-return-live']],
  ['PR9', 'K07', 'a pale veil over the world under system Light',
    [['src/build.mjs', '#phone .dk{', '#phone[data-appearance="light"] #stage-clip{opacity:.96}\n#phone .dk{']], ['light-far', 'light-near', 'light-pinned', 'light-call']],
];

const R = { probes: [] };
for (const [id, target, defect, plants, snaps] of PROBES) {
  if (only && !only.includes(id)) continue;
  const D = join(WORK, 'probes', id); rmSync(D, { recursive: true, force: true }); mkdirSync(D, { recursive: true });
  cpSync(join(SOURCE, 'src'), join(D, 'source', 'src'), { recursive: true }); cpSync(join(SOURCE, 'vendor'), join(D, 'source', 'vendor'), { recursive: true });
  const applied = plants.map(([f, from, to]) => {
    const p = join(D, 'source', ...f.split('/'));
    if (to === 'FLIP') { const b = readFileSync(p); b[1000] ^= 1; writeFileSync(p, b); return true; }
    const t = readFileSync(p, 'utf8').replace(/\r\n/g, '\n'); if (!t.includes(from)) return false; writeFileSync(p, t.replace(from, to)); return true;
  });
  const rec = { id, target, defect, plantApplied: applied.every(Boolean) };
  if (!rec.plantApplied) { rec.rejected = false; rec.note = 'the plant did not apply — the probe proves nothing'; R.probes.push(rec); console.log('BROKEN ', id, defect); continue; }
  const b = spawnSync(process.execPath, ['src/build.mjs', join(D, 'prototype')], { cwd: join(D, 'source'), encoding: 'utf8' });
  rec.build = { exit: b.status, refused: b.status !== 0 ? (b.stderr || '').split('\n').find((l) => /REFUSING|Error/.test(l)) || 'non-zero exit' : null };
  const I = loadInputs(), J = { ...I, snaps: clone(I.snaps), clips: clone(I.clips) };
  if (b.status === 0 && snaps.length) {
    const env = { ...process.env, G32_WORK: join(D, 'work') };
    const c = spawnSync(process.execPath, ['tools/capture.mjs', 'snaps', '--only', snaps.join(','), '--proto', join(D, 'prototype')], { cwd: SOURCE, env, encoding: 'utf8', maxBuffer: 1 << 26 });
    if (c.status !== 0) { rec.rejected = false; rec.note = 'planted capture failed: ' + (c.stderr || '').slice(-300); R.probes.push(rec); console.log('ERROR  ', id, rec.note); continue; }
    const planted = JSON.parse(readFileSync(join(D, 'work', 'snaps', 'index.json'), 'utf8'));
    for (const [sid, s] of Object.entries(planted)) { s.dir = join(D, 'work', 'snaps'); J.snaps[sid] = s; }
    rec.plantedCaptures = Object.keys(planted);
  }
  if (b.status !== 0 && plants.some((p) => p[2] === 'FLIP')) {
    // the build refused the flipped world; hand the check the flipped bytes as if they had been inlined
    J.worldB64 = readFileSync(join(D, 'source', 'vendor', 'canon', 'wf-living-constellation.html')).toString('base64');
  }
  const fn = CHECKS.find((c) => c[0] === target)[3];
  let r; try { r = fn(J); } catch (e) { r = { pass: false, evidence: 'threw: ' + e.message }; }
  rec.checkVerdict = r.pass ? 'PASS' : 'FAIL'; rec.rejected = !r.pass;
  rec.evidence = JSON.stringify(r.evidence).slice(0, 700);
  R.probes.push(rec);
  console.log(rec.rejected ? 'REJECTED' : 'MISSED  ', id, '→', target, defect, rec.build.refused ? `(build refused: ${rec.build.refused})` : '');
}
R.total = R.probes.length; R.rejected = R.probes.filter((p) => p.rejected).length;
if (!only) writeFileSync(join(PKG, 'data', 'PROBES.json'), JSON.stringify(R, null, 1));
console.log(`\n${R.rejected}/${R.total} planted defects rejected`);
process.exit(R.rejected === R.total ? 0 : 1);
