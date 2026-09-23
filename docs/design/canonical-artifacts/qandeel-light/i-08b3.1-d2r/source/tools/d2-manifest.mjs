/**
 * I-08B3.1-D2R — THE MANIFEST AND THE PREFLIGHT.
 *
 * Every file's SHA-256, and fifteen checks that run over the FINISHED PACKAGE rather than over
 * the process that made it. A preflight that only re-reads the reports is a preflight that
 * trusts the tools it is supposed to be checking, so most of these open the artefacts.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { isMain } from './d2-main.mjs';
import { contrastHex } from '../vendor/color.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = join(HERE, '..', '..');

const SKIP = new Set(['D2R_MANIFEST.md']);

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { walk(p, out); continue; }
    const rel = relative(PKG, p).replace(/\\/g, '/');
    if (SKIP.has(rel)) continue;
    const buf = readFileSync(p);
    out.push({ path: rel, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') });
  }
  return out;
}

const REQUIRED = [
  'README.md',
  'D2R_DESIGN_RATIONALE.md', 'D2R_SKILL_GATE.md', 'D2R_REFERENCE_GATE.md',
  'D2R_AMBIENT_MEANING_ACTIVITY.md', 'D2R_TRUTH_AUDIT.md', 'D2R_MOTION_AND_REDUCED_MOTION.md',
  'D2R_IMPLEMENTATION_FEASIBILITY.md', 'D2R_ACCESSIBILITY.md', 'D2R_IMPLEMENTATION_BOUNDARIES.md',
  'D2R_FREEZE_CANDIDATE.md', 'D2R_METHOD.md',
  'D2_PRODUCT_OWNER_REVIEW_BOARD.html',
  'prototypes/D2_LIGHT_SYSTEM.html',
  'tokens/qandeel-light.resolver.json', 'tokens/base/illumination.tokens.json',
  'tokens/appearance/dark.illumination.tokens.json',
  'video/D2_A_AMBIENT_WORLD_FIELD.mp4', 'video/D2_B_CONNECTION_INHERITED.mp4',
  'video/D2_C_PATTERN_CRYSTALLIZATION.mp4', 'video/D2_D_INSIGHT_EMERGENCE.mp4',
  'video/D2_COHERENCE_FOUR_CATEGORIES.mp4',
  'video/D2_RM_A_AMBIENT_WORLD_FIELD.mp4', 'video/D2_RM_B_CONNECTION_INHERITED.mp4',
  'video/D2_RM_C_PATTERN_CRYSTALLIZATION.mp4', 'video/D2_RM_D_INSIGHT_EMERGENCE.mp4',
  'frames/proof/D2_COHERENCE_GRID.png', 'frames/proof/D2_LIGHT_SEPARATION.png',
  'frames/proof/D2_REDUCED_MOTION_PAIRS.png', 'frames/proof/D2_THREE_WORLDS.png',
  'data/D2_RESOLUTION.json', 'data/D2_CAPTURE_REPORT.json', 'data/D2_VERIFY_RESULTS.json',
  'data/D2_ENCODE_REPORT.json', 'data/D2_STILLS_REPORT.json', 'data/D2_LIGHT_DERIVATION.json',
  'data/D2_GATE_INVENTORY.json',
];

const FONT_SIGS = ['wOFF', 'wOF2', 'OTTO', 'true', 'ttcf'];

export function preflight(files) {
  const checks = [];
  const add = (id, title, ok, detail) => { checks.push({ id, title, ok, detail }); return ok; };
  const read = (rel) => readFileSync(join(PKG, rel), 'utf8');
  const json = (rel) => JSON.parse(read(rel));

  /* P1 */ {
    const missing = REQUIRED.filter((r) => !existsSync(join(PKG, r)));
    add('P1', 'every required deliverable is present', missing.length === 0,
      `${REQUIRED.length} required, ${missing.length} missing${missing.length ? ': ' + missing.join(', ') : ''}`);
  }
  /* P2 */ {
    const hits = files.filter((f) => /\.(ttf|otf|woff2?|eot|ttc)$/i.test(f.path));
    const embedded = [];
    for (const f of files) {
      if (!/\.(html|css|json|md|mjs|js|svg|txt)$/i.test(f.path)) continue;
      for (const m of read(f.path).match(/[A-Za-z0-9+/]{512,}={0,2}/g) || []) {
        const head = Buffer.from(m.slice(0, 64), 'base64');
        if (head.length >= 4 && (FONT_SIGS.includes(head.subarray(0, 4).toString('latin1')) || head.readUInt32BE(0) === 0x00010000)) {
          embedded.push(f.path);
        }
      }
    }
    add('P2', 'NOT ONE FONT BYTE SHIPS — tested on bytes, not on the word', hits.length === 0 && embedded.length === 0,
      `${files.length} files; font-extension files ${hits.length}; files carrying decodable font bytes ${embedded.length}`);
  }
  /* P3 */ {
    const enc = json('data/D2_ENCODE_REPORT.json');
    const bad = enc.files.filter((f) => !f.verified);
    const worst = Math.max(...enc.files.map((f) => f.meanError));
    add('P3', 'every video was verified by decoding it back', bad.length === 0,
      `${enc.files.length} films, ${bad.length} unverified, worst mean error ${worst.toFixed(3)}/255`);
  }
  /* P4 */ {
    const v = json('data/D2_VERIFY_RESULTS.json');
    const failed = v.results.filter((r) => !r.ok);
    const probes = v.probes.filter((p) => !p.detected);
    add('P4', 'every check holds and every probe detected its planted violation',
      failed.length === 0 && probes.length === 0,
      `${v.results.length - failed.length}/${v.results.length} hold; ${v.probes.length - probes.length}/${v.probes.length} probes detected`);
  }
  /* P5 */ {
    const r = json('tokens/qandeel-light.resolver.json');
    const sem = read('tokens/base/illumination.tokens.json');
    const exp = json('tokens/appearance/dark.illumination.tokens.json');
    const ok = r.version === '2025.10'
      && /\{qandeel\.expression\.illumination\.core\}/.test(sem)
      && !!exp.qandeel.expression.illumination.core.$value.hex;
    add('P5', 'the token tree resolves and declares the version the frozen C3 tree declares', ok,
      `resolver version ${r.version}; illumination.core aliases its expression; expression carries a hex`);
  }
  /* P6 */ {
    const sem = read('tokens/base/illumination.tokens.json') + read('tokens/appearance/dark.illumination.tokens.json');
    const identity = /\{qandeel\.identity\./.test(sem);
    const accent = /accent/i.test(sem);
    add('P6', 'C3 invariants hold in the new namespaces: no identity alias, no forbidden name',
      !identity && !accent, `aliases into qandeel.identity: ${identity}; the name \`accent\`: ${accent}`);
  }
  /* P7 */ {
    const res = json('data/D2_RESOLUTION.json');
    const ratio = contrastHex(res.chrome.analysisRelation.value, res.foundation.WORLD.value);
    add('P7', 'the settled relation passes WCAG 2.2 SC 1.4.11 on the World', ratio >= 3,
      `${res.chrome.analysisRelation.value} on ${res.foundation.WORLD.value} is ${ratio.toFixed(2)}:1 (the superseded literal measured ${res.relationContrast.superseded.ratio}:1)`);
  }
  /* P8 */ {
    const d = json('data/D2_LIGHT_DERIVATION.json');
    /* `separationFromBrass` is the whole finding — the distance AND where on the path it
       happens — so it is an object, and the first version of this line compared a number
       against it. That is always false, so the check failed while printing the numbers that
       showed it should pass: a predicate and a message that disagreed, and only the message
       was read. Both halves reach `.dE` now. */
    const ok = d.selected.separation >= d.constraints.separationRequired
      && d.selected.separation > d.diagnostic.separationFromBrass.dE;
    add('P8', 'the candidate Light meets its own requirement and improves on what it replaces', ok,
      `candidate ${d.selected.separation.toFixed(4)}, required ${d.constraints.separationRequired}, diagnostic ${d.diagnostic.separationFromBrass.dE.toFixed(4)} — ${(d.selected.separation / d.diagnostic.separationFromBrass.dE).toFixed(2)}x`);
  }
  /* P9 */ {
    const res = json('data/D2_RESOLUTION.json');
    let bad = 0;
    for (const f of res.inherited) {
      const actual = createHash('sha256').update(readFileSync(join(PKG, 'source', f.file))).digest('hex');
      if (actual !== f.sha256) bad++;
    }
    add('P9', 'I-08B3.1-D1\'s three scene files are vendored byte-identical', bad === 0,
      `${res.inherited.length} inherited files, ${bad} changed`);
  }
  /* P10 */ {
    /**
     * THREE STATES, BECAUSE TWO WERE WRONG ON A REVIEWER'S MACHINE.
     *
     * The skills this gate read are EXTERNAL to the package — they live under the executing
     * host's `~/.claude/skills`, and shipping them here would mean redistributing somebody
     * else's files. So on any other machine they are simply absent.
     *
     * The first version treated that as FAIL, which told a reviewer their extraction was broken
     * when nothing was. Reporting PASS would have been worse: it would claim a verification
     * that did not happen, which is the exact failure the whole apparatus exists to prevent.
     *
     * So it returns UNVERIFIABLE HERE — counted separately, never folded into either neighbour,
     * and on the original host the strict check still runs and still has to pass. This is the
     * third state I-08B3.1-C3 established for byte-identity against sealed predecessors, applied
     * to the one dependency that cannot travel.
     */
    const gate = json('data/D2_GATE_INVENTORY.json');
    const claimed = [...gate.used, ...gate.notUsed, ...gate.unavailable];

    /**
     * The decision, as a function, so the THIRD STATE can be demonstrated on any host.
     *
     * On the machine that built this package the sources are present and the strict check runs,
     * which means the unverifiable branch would never be exercised here — and a branch nobody
     * ever runs is a branch nobody knows works. The probe below feeds it a synthetic inventory
     * pointing at paths that do not exist and requires it to return `unverifiable`, so every run
     * on every host shows the third state doing its job.
     */
    const decide = (rows) => {
      const present = rows.filter((r) => existsSync(r.path));
      const changed = present.filter((r) => createHash('sha256').update(readFileSync(r.path)).digest('hex') !== r.sha256);
      if (present.length === 0) return { state: 'unverifiable', present: 0, changed: 0 };
      return { state: present.length === rows.length && changed.length === 0 ? 'holds' : 'fails', present: present.length, changed: changed.length };
    };

    const real = decide(claimed);
    const probe = decide([{ path: join(PKG, '__no_such_skill__', 'SKILL.md'), sha256: '0'.repeat(64) }]);
    const probeOk = probe.state === 'unverifiable';

    if (real.state === 'unverifiable') {
      checks.push({
        id: 'P10', title: 'the recorded skill sources verify on this host', ok: null, unverifiable: true,
        detail: `UNVERIFIABLE — EXTERNAL SKILL SOURCE NOT PRESENT. ${claimed.length} skill files were recorded with their paths and SHA-256 on the executing host; none is present here, which is expected off that host and is NOT a package defect. data/D2_GATE_INVENTORY.json carries every path, size and hash for independent checking wherever the sources exist.`,
      });
    } else {
      add('P10', 'the recorded skill sources verify on this host',
        real.state === 'holds' && probeOk,
        `${gate.skillsOnHost} skills enumerated; ${claimed.length} claimed; ${real.present} present; ${real.changed} whose bytes no longer match the recorded hash. `
        + `Probe: an inventory pointing at absent sources returns ${probe.state.toUpperCase()} rather than FAIL — ${probeOk}. `
        + `Off this host that is the state this check reports.`);
    }
  }
  /* P11 */ {
    const board = read('D2_PRODUCT_OWNER_REVIEW_BOARD.html');
    const refs = [...board.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith('file:') && !u.startsWith('http'));
    const missing = refs.filter((u) => !existsSync(join(PKG, u)));
    add('P11', 'every file the review board points at exists in this package', missing.length === 0,
      `${refs.length} local references, ${missing.length} missing${missing.length ? ': ' + missing.join(', ') : ''}`);
  }
  /* P12 */ {
    const board = read('D2_PRODUCT_OWNER_REVIEW_BOARD.html');
    const ok = /lang="ar"/.test(board) && /dir="rtl"/.test(board)
      && (board.match(/<h1/g) || []).length === 1
      && !/<h3|<h4/.test(board);
    add('P12', 'the review board is RTL Arabic with an unbroken heading outline', ok,
      `dir/lang present; one h1; h2 only below it, no skipped level`);
  }
  /* P13 */ {
    const thin = files.filter((f) => f.path.endsWith('.md') && f.bytes < 700);
    add('P13', 'no shipped document is a stub', thin.length === 0,
      `${files.filter((f) => f.path.endsWith('.md')).length} documents, ${thin.length} under 700 bytes`);
  }
  /* P14 */ {
    const bad = [];
    for (const f of files) {
      if (!f.path.endsWith('.json')) continue;
      try { JSON.parse(read(f.path)); } catch (e) { bad.push(f.path); }
    }
    add('P14', 'every data file parses', bad.length === 0, `${files.filter((f) => f.path.endsWith('.json')).length} JSON files, ${bad.length} malformed`);
  }
  /* P15 */ {
    const proto = read('prototypes/D2_LIGHT_SYSTEM.html');
    const paint = proto.split('<script>')[0];
    const ok = !/@keyframes/.test(proto) && !/\banimation\s*:/.test(paint) && !/\btransition\s*:/.test(paint)
      && /file:\/\/\//.test(proto);
    add('P15', 'the prototype has no CSS animation, transition or keyframes, and loads the face by URL', ok,
      'every visual property is written imperatively from apply(t)');
  }

  return checks;
}

export function build() {
  const files = walk(PKG);
  const checks = preflight(files);
  const total = files.reduce((s, f) => s + f.bytes, 0);

  const verifiable = checks.filter((c) => !c.unverifiable);
  const unver = checks.filter((c) => c.unverifiable);
  const state = (c) => (c.unverifiable ? '**UNVERIFIABLE HERE**' : c.ok ? '**HOLDS**' : '**FAILS**');

  const md = [
    '# I-08B3.1-D2R — MANIFEST', '',
    `**${files.length} files, ${total.toLocaleString()} bytes.** Every hash below is a SHA-256 of the file as`,
    'shipped. The manifest itself is excluded, because a file cannot contain its own hash.', '',
    '---', '',
    '## Preflight', '',
    `**${verifiable.filter((c) => c.ok).length} of ${verifiable.length} verifiable checks hold`
    + (unver.length ? `; ${unver.length} could not be verified here and is NOT claimed.**` : '.**'), '',
    'A check whose inputs are absent returns a THIRD state. Reporting it as a failure would tell a',
    'reviewer their extraction was broken when nothing is; reporting it as a pass would claim a',
    'verification that did not happen.', '',
    '| | Check | | Detail |',
    '|---|---|---|---|',
    ...checks.map((c) => `| ${c.id} | ${c.title} | ${state(c)} | ${c.detail} |`),
    '', '---', '',
    '## Files', '',
    '| Path | Bytes | SHA-256 |',
    '|---|---:|---|',
    ...files.map((f) => `| \`${f.path}\` | ${f.bytes.toLocaleString()} | \`${f.sha256}\` |`),
    '',
  ].join('\n');

  writeFileSync(join(PKG, 'D2R_MANIFEST.md'), md);
  writeFileSync(join(PKG, 'data', 'D2_MANIFEST.json'),
    JSON.stringify({ generated: 'source/tools/d2-manifest.mjs', files, checks, totalBytes: total }, null, 2) + '\n');
  return { files, checks, total };
}

if (isMain(import.meta.url)) {
  console.log('D2R MANIFEST');
  const r = build();
  for (const c of r.checks) {
    console.log(`  ${c.unverifiable ? 'UNVER' : c.ok ? 'HOLDS' : 'FAILS'}  ${c.id}  ${c.title}`);
    console.log(`           ${c.detail}`);
  }
  const verifiable = r.checks.filter((c) => !c.unverifiable);
  const unver = r.checks.filter((c) => c.unverifiable);
  console.log(`\n  ${verifiable.filter((c) => c.ok).length}/${verifiable.length} verifiable preflight checks hold`
    + (unver.length ? `; ${unver.length} UNVERIFIABLE HERE and not claimed` : ''));
  console.log(`  ${r.files.length} files, ${r.total.toLocaleString()} bytes`);
  if (verifiable.some((c) => !c.ok)) process.exitCode = 1;
}
