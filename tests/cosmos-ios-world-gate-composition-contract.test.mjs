// iOS World gate composition (PO directive, 2026-11-23: "Remove Deferred First-Tap Coverage from Mandatory Pre-Launch
// CI"). The mandatory gate (.github/workflows/cosmos-ios-world-gate.yml, scripts/cosmos-ios-world/run-world-gate.sh and
// xcui-analyse.mjs) must not carry the deferred first-tap limitation (SE-FU-1 class, Future Improvements item 022):
//
//   - the fresh-install first-tap XCUITest (testFreshInstallFirstVisibleDoorTapOpensTheAnalysis) is not run by the gate,
//     has no step of its own, and gets no results.tsv row (so it can neither fail nor pass the gate); it stays in the
//     suite only for the non-gating D-3 validation workflow;
//   - P-TAP-RAIL and P-LAND keep their required assertions, but neither is a freshly entered stage's first touch: a
//     non-gating initialization (`initstage`) comes first, writes no row, restores the state and verifies the
//     preconditions, and a failed restoration makes the dependent cases NOT TESTED (the job stays red);
//   - the expected mandatory rows per cell: the 16 World gate cases, plus one row per gating XCUITest (12) and the three
//     measured native cases, 31 in all (32 before).
// Each detector is shown to catch a planted defect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/gu, '\n');
const DEFERRED = 'testFreshInstallFirstVisibleDoorTapOpensTheAnalysis';
const GATE_CASES = ['P-TAP-RAIL', 'P-TAP', 'F1-RESOLVED', 'P-PAN', 'P-PAN-RAIL', 'S-FAR-TAP', 'S-TAP', 'S-EXPANDED', 'S-SOURCES',
  'S-CONV-ENTRY', 'S-LAND', 'U-TAP', 'U-LAND', 'S-EMPTY', 'U-EMPTY', 'P-LAND'];
const MEASURED = ['X-ANCHOR', 'X-PAN-AFTER-PINCH', 'X-PAN-ZOOMED'];

const sources = () => ({
  workflow: read('.github/workflows/cosmos-ios-world-gate.yml'),
  gate: read('scripts/cosmos-ios-world/run-world-gate.sh'),
  analyse: read('scripts/cosmos-ios-world/xcui-analyse.mjs'),
  swift: read('scripts/cosmos-ios-world/xcuitest/CosmosWorldGestureUITests.swift'),
});
const shellCode = (text) => text.split('\n').filter((line) => !/^\s*#/u.test(line)).join('\n');
const yamlCode = shellCode;
// The body of a shell function `name() { … }`, up to the closing brace at the start of a line.
const fnBody = (code, name) => new RegExp(`^${name}\\(\\) \\{\\n([\\s\\S]*?)\\n\\}`, 'mu').exec(code)?.[1] ?? null;

export function violations({ workflow, gate, analyse, swift }) {
  const out = [];
  const wf = yamlCode(workflow);
  // ── the deferred fresh-install first-tap test is not run by the mandatory gate ──
  if (new RegExp(`-only-testing\\s+\\S*${DEFERRED}`, 'u').test(wf)) out.push('the mandatory gate does not run the deferred fresh-install first-tap test');
  if (!new RegExp(`-skip-testing\\s+\\S*${DEFERRED}`, 'u').test(wf)) out.push('the native run of the mandatory gate skips the deferred fresh-install first-tap test');
  if (/simctl uninstall/u.test(wf) || /fresh\.log|fresh-attachments|fresh\.xcresult/u.test(wf)) out.push('the mandatory gate has no fresh-install step');
  if (/name:[^\n]*(SE-FU-1|fresh install)/iu.test(wf)) out.push('no step of the mandatory gate is named for SE-FU-1 or a fresh install');
  if (!/run: npm run test:cosmos-ios-world-gate-composition-contract/u.test(wf)) out.push('the gate workflow checks its own composition before building');
  // ── the classifier makes no row for it ──
  if (!new RegExp(`const NOT_IN_GATE = new Set\\(\\['${DEFERRED}'\\]\\);`, 'u').test(analyse)) out.push('the classifier names the deferred test as not in the gate');
  if (!/const tests = \[\.\.\.swift\.matchAll\(\/func \(test\\w\+\)\\\(\\\)\/g\)\]\.map\(\(m\) => m\[1\]\)\.filter\(\(t\) => !NOT_IN_GATE\.has\(t\)\);/u.test(analyse)) out.push('the classifier makes no row for a test that is not in the gate');
  // ── P-TAP-RAIL and P-LAND are never a fresh stage's first touch ──
  const code = shellCode(gate);
  const init = fnBody(code, 'initstage');
  if (init === null) out.push('the gate has a non-gating stage initialization (initstage)');
  else {
    if (/\bresult\b/u.test(init)) out.push('the initialization writes no results.tsv row');
    if (!/qandeel-personal-peek/u.test(init) || !/backOn/u.test(init) || !/qandeel-cosmos-rail/u.test(init)) out.push('the initialization verifies the preconditions: no PEEK, home, rail');
    if (!/cosmos-detail-sheet-handle/u.test(init) || !/qandeel-cosmos-back/u.test(init)) out.push('the initialization restores the state (PEEK closed, camera home)');
    if (!/return 1/u.test(init)) out.push('a failed restoration is reported to the caller');
  }
  const at = (re) => { const m = re.exec(code); return m ? m.index : -1; };
  const initP = at(/! initstage p;/u), rail = at(/tapcase P-TAP-RAIL p-tap-rail/u), enterP = at(/if ! enter p; then/u);
  if (initP < 0 || rail < 0 || !(enterP < initP && initP < rail)) out.push('P-TAP-RAIL comes after the Personal stage initialization');
  if (!/! initstage p; then\n\s*for c in P-TAP-RAIL P-TAP F1-RESOLVED; do result "\$c" 'NOT TESTED'/u.test(code)) out.push('a failed initialization makes P-TAP-RAIL, P-TAP and F1-RESOLVED NOT TESTED');
  const initPl = at(/! initstage pl;/u), plTap = at(/mt pl-tap tap-point\.yaml/u);
  if (initPl < 0 || plTap < 0 || initPl > plTap) out.push('P-LAND\'s tap comes after the stage initialization');
  if (!/! initstage pl; then result P-LAND 'NOT TESTED'/u.test(code)) out.push('a failed initialization makes P-LAND NOT TESTED');
  // A tap the stage does not take still fails P-TAP-RAIL.
  if (!/result "\$1" FAIL "tap at \$3: no qandeel-personal-peek within 6 s"/u.test(code)) out.push('a P-TAP-RAIL / P-TAP tap that opens no PEEK still FAILs');
  if (!/! grep -qv -e \$'\\tPASS\\t' -e '\^case' "\$RES"/u.test(code)) out.push('the gate exits non-zero unless every case passed');
  // ── the expected mandatory rows ──
  const cases = [...new Set([...code.matchAll(/result "?([A-Z][A-Z0-9-]+)"? (?:PASS|FAIL|'NOT TESTED')/gu)].map((m) => m[1]))];
  const loops = [...code.matchAll(/for c in ([A-Z0-9 -]+); do result/gu)].flatMap((m) => m[1].trim().split(/\s+/u));
  const named = new Set([...cases, ...loops, ...[...code.matchAll(/(?:tapcase|pancase|nodetap|landcase) ([A-Z][A-Z0-9-]+) /gu)].map((m) => m[1])]);
  named.delete('F1'); // the f1 argument, not a case
  const gateCases = [...named].filter((c) => !c.startsWith('X'));
  if (gateCases.sort().join() !== [...GATE_CASES].sort().join()) out.push(`the World gate has exactly its 16 cases (found ${gateCases.sort().join(', ')})`);
  const swiftTests = [...swift.matchAll(/func (test\w+)\(\)/gu)].map((m) => m[1]);
  if (!swiftTests.includes(DEFERRED)) out.push('the deferred test stays in the suite for the non-gating D-3 validation (historical evidence)');
  const gating = swiftTests.filter((t) => t !== DEFERRED);
  if (gating.length !== 12) out.push(`12 gating native tests (found ${gating.length})`);
  for (const m of MEASURED) if (!new RegExp(`result\\('${m}'`, 'u').test(analyse)) out.push(`the measured native case ${m} is still classified`);
  if (GATE_CASES.length + gating.length + MEASURED.length !== 31) out.push('31 mandatory rows per cell');
  return out;
}

test('the mandatory iOS World gate carries no deferred first-tap case, and P-TAP-RAIL / P-LAND are not a first touch', () => {
  assert.deepEqual(violations(sources()), []);
});

test('each detector catches a planted defect', () => {
  const base = sources();
  const plant = (key, from, to) => {
    assert.ok(base[key].includes(from), `plant anchor missing in ${key}: ${from}`);
    return { ...base, [key]: base[key].replace(from, to) };
  };
  const cases = [
    ['a fresh-install step re-added', plant('workflow', '      - name: Classify the native runs', `      - name: SE-FU-1 fresh install\n        run: |\n          xcrun simctl uninstall "$IOS_SIM_UDID" com.qandeel.mobile\n          xcodebuild test-without-building -only-testing QandeelWorldUITests/CosmosWorldGestureUITests/${DEFERRED} > "$X/fresh.log"\n      - name: Classify the native runs`)],
    ['the skip removed from the native run', plant('workflow', `-skip-testing QandeelWorldUITests/CosmosWorldGestureUITests/${DEFERRED} `, '')],
    ['the composition check removed', plant('workflow', 'run: npm run test:cosmos-ios-world-gate-composition-contract', 'run: true')],
    ['the classifier row restored', plant('analyse', '.filter((t) => !NOT_IN_GATE.has(t));', ';')],
    ['P-TAP-RAIL the first touch again', plant('gate', 'elif sleep 5; ! initstage p; then', 'elif false; then')],
    ['P-LAND the first touch again', plant('gate', 'if ! initstage pl; then result P-LAND', 'if false; then result P-LAND')],
    ['the initialization gating', plant('gate', '  printf \'%s\\tpreconditions restored', '  result INIT PASS ok\n  printf \'%s\\tpreconditions restored')],
    ['no precondition check', plant('gate', '[ "$(q "$n-init-2" id qandeel-cosmos-rail)" != none ]', 'true')],
    ['a lost P-TAP-RAIL tap passed', plant('gate', 'else result "$1" FAIL "tap at $3: no qandeel-personal-peek within 6 s"', 'else result "$1" PASS "tap at $3: no qandeel-personal-peek within 6 s"')],
    ['a case dropped', { ...base, gate: base.gate.replaceAll('S-EMPTY', 'S-NONE') }],
    ['the deferred test deleted from the suite', plant('swift', `func ${DEFERRED}()`, 'func removedForever()')],
  ];
  for (const [name, planted] of cases) assert.notDeepEqual(violations(planted), [], `not caught: ${name}`);
});
