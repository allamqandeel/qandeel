// INTEL-LIVE-01 CP1 — the iOS Targeted Gate for the live call and the World gate's proportional scope (PO directive
// "Semantic Freedom & Targeted Cross-Platform Validation", 2026-11-25, §3 / §4; backlog BG-10 clarification).
//
// It holds: the targeted gate is change-aware over the live-call backend and client, drives the PRODUCTION call controls
// of the S8B-06 CP3 proof build against the proof server with the attention lane ON, records every case PASS / FAIL /
// NOT TESTED and never turns an unrun case into a PASS; the World gate keeps every suite and its push-to-main run while
// the API and the database are no longer its inputs; BG-10's clarification is in the backlog and AGENTS.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const code = (text) => text.replace(/^\s*#[^\n]*$/gmu, '');

const GATE = '.github/workflows/ios-targeted-gate.yml';
const RUNNER = 'scripts/ios-targeted-gate/run-live-call-gate.sh';
const WORLD = '.github/workflows/cosmos-ios-world-gate.yml';
const SERVER = 'apps/api/scripts/s8b-06-cp3-device-proof-server.ts';
const FLOWS = ['itg-call-launch.yaml', 'itg-call-tap.yaml', 'itg-call-visible.yaml'];
const CASES = ['ITG-01', 'ITG-02', 'ITG-03', 'ITG-04', 'ITG-05', 'ITG-06'];

const tree = () => ({
  gate: read(GATE),
  runner: read(RUNNER),
  world: read(WORLD),
  server: read(SERVER),
  flows: FLOWS.map((f) => read(`apps/mobile/.maestro/${f}`)).join('\n---\n'),
});

/** The pull_request paths of a workflow, comments removed. */
function prPaths(workflow) {
  const block = /pull_request:\n\s+paths:\n((?:\s+(?:-\s+'[^']+'|#[^\n]*)\n)+)/u.exec(workflow);
  return block ? [...block[1].matchAll(/-\s+'([^']+)'/gu)].map((m) => m[1]) : [];
}

export function violations({ gate, runner, world, server, flows }) {
  const out = [];
  const paths = prPaths(gate);
  for (const p of ['apps/api/src/voice/**', 'apps/api/src/live-analysis/**', 'apps/api/src/live-attention/**', 'database/migrations/**', 'packages/**',
    'apps/mobile/src/call/**', 'apps/mobile/modules/qandeel-voice-call/**', SERVER, 'scripts/ios-targeted-gate/**', 'apps/mobile/.maestro/itg-*.yaml', GATE]) {
    if (!paths.includes(p)) out.push(`the targeted gate is not triggered by ${p}`);
  }
  const g = code(gate);
  if (!/push:\n\s+branches: \[main\]/u.test(g)) out.push('the targeted gate does not run on a push to main');
  if (!/S806_DEVICE_PROOF=1 node apps\/mobile\/scripts\/select-s806cp3-proof-entry\.mjs --apply/u.test(g)) out.push('the targeted gate does not build the S8B-06 CP3 proof entry');
  if (!/-configuration Release -sdk iphonesimulator/u.test(g)) out.push('the targeted gate does not build the Release simulator app');
  if (!/database\/supabase-compatible-bootstrap\.sql/u.test(g) || !/for migration in database\/migrations\/\*\.sql/u.test(g)) out.push('the targeted gate does not bootstrap and migrate its throwaway database');
  if (!/run: bash scripts\/ios-targeted-gate\/run-live-call-gate\.sh/u.test(g)) out.push('the targeted gate does not run its cases');
  if (!/if: always\(\)\n\s+uses: actions\/upload-artifact@v4/u.test(g)) out.push('the targeted gate does not upload its evidence pass or fail');
  if (/continue-on-error|retry|maxRetries/u.test(g)) out.push('the targeted gate softens or retries a step');
  if (/secrets\.|API_KEY|_KEY_FILE/u.test(g)) out.push('the targeted gate reaches a credential');

  const r = code(runner);
  if (!/PROOF_ATTENTION=ON/u.test(r)) out.push('the runner does not turn the attention lane ON');
  if (!/infrastructure "the proof server's attention lane is not ON"/u.test(r)) out.push('the runner does not refuse a server whose lane is not ON');
  for (const c of CASES) {
    if (!new RegExp(`record ${c} PASS `, 'u').test(r)) out.push(`the runner never records ${c}`);
  }
  if (!/record "\$c" "NOT TESTED"/u.test(r)) out.push('an unrun case is not recorded NOT TESTED');
  if (/record "\$c" PASS|record "\$1" PASS/u.test(r)) out.push('an unrun case can be recorded PASS');
  if ((r.match(/^\s*exit 1$/gmu) ?? []).length < 2) out.push('a failure or an infrastructure stop does not end the run red');
  if (!/e\.close_reason === "PLAYED_OUT"/u.test(r)) out.push('ITG-03 does not require the reply PLAYED_OUT');
  if (!/half_state === "COMPLETE"/u.test(r) || !/\["USER", "QANDEEL"\]\.every/u.test(r)) out.push('ITG-05 does not require both tracks settled');
  if (!/end_reason === "USER_ENDED"/u.test(r)) out.push('ITG-04 does not require USER_ENDED');

  if (!/id: qandeel-call-entry/u.test(flows)) out.push('the launch flow does not wait for the production call entry');
  if (/hideKeyboard|retry:/u.test(code(flows))) out.push('a flow hides the keyboard or retries');

  const s = server;
  if (!/if \(process\.env\.PROOF_ATTENTION === 'ON'\) \{\n\s+attentionBinding\.bind\(liveCallAttentionOf\(/u.test(s)) out.push('the proof server does not compose the production attention lane under PROOF_ATTENTION=ON');
  if (!/attentionSettlement: process\.env\.PROOF_ATTENTION === 'ON' \? new CallAttentionRepository\(serverApi\) : undefined/u.test(s)) out.push('the proof server does not settle the attention lane at the call\'s end');
  if (!/if \(openStreams === 0\) throw new HttpException/u.test(s)) out.push('/proof/speak arms a stimulus with no open uplink');

  const worldPaths = prPaths(world);
  for (const p of ['apps/mobile/**', 'packages/**', 'package-lock.json', 'scripts/cosmos-ios-world/**', WORLD]) {
    if (!worldPaths.includes(p)) out.push(`the World gate no longer runs for ${p}`);
  }
  for (const p of ['apps/api/**', 'database/**']) {
    if (worldPaths.includes(p)) out.push(`the World gate re-runs its full matrix for ${p}, which its app cannot reach`);
  }
  if (!/it reaches no API and no database/u.test(world)) out.push('the World gate does not justify its narrowed scope');
  const w = code(world);
  if (!/push:\n\s+branches: \[main\]/u.test(w)) out.push('the World gate no longer runs on a push to main');
  if (!/scripts\/cosmos-ios-world\/run-world-gate\.sh/u.test(w) || !/run: npm run test:cosmos-ios-world-gate-composition-contract/u.test(w)) out.push('the World gate lost a suite');
  return out;
}

test('the iOS Targeted Gate, its flows and the World gate hold their scope', () => {
  for (const f of FLOWS) assert.ok(existsSync(new URL(`../apps/mobile/.maestro/${f}`, import.meta.url)), `${f} exists`);
  assert.deepEqual(violations(tree()), []);
});

test('the flows tap controls the production call surfaces still carry', () => {
  const views = read('apps/mobile/src/call/CallViews.tsx');
  const rail = read('apps/mobile/src/iconography/CallRail.tsx');
  assert.match(views, /export const CALL_ENTRY_TEST_ID = 'qandeel-call-entry';/u);
  assert.match(rail, /export const CALL_RAIL_TEST_ID = 'qandeel-call-rail';/u);
  assert.match(rail, /testID=\{`\$\{CALL_RAIL_TEST_ID\}:end`\}/u);
  const runner = read(RUNNER);
  assert.match(runner, /-e ID=qandeel-call-entry -e WAIT_ID=qandeel-call-rail:end/u);
  assert.match(runner, /-e ID=qandeel-call-rail:end -e WAIT_ID=qandeel-call-entry/u);
});

test('BG-10 is clarified, not relaxed (PO directive 2026-11-25)', () => {
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  assert.match(backlog, /\*\*BG-10 clarification — validation proportional to impact \(PO directive, 2026-11-25; recorded by\nINTEL-LIVE-01 CP1\)\.\*\*/u);
  for (const clause of [/iOS compatibility stays mandatory and no blanket exemption exists/u, /never marked NOT TESTED to avoid its cost/u,
    /a build alone is insufficient/u, /are never deleted or weakened/u, /reported as not run, never as passed/u, /\.github\/workflows\/ios-targeted-gate\.yml/u]) {
    assert.match(backlog.replace(/\n/gu, ' '), clause);
  }
  assert.match(read('AGENTS.md'), /BG-10 clarification, PO 2026-11-25/u);
});

test('each refusal is real: planted regressions are caught', () => {
  const base = tree();
  const plant = (key, from, to) => {
    assert.ok(base[key].includes(from), `the plant anchor exists in ${key}: ${from.slice(0, 60)}`);
    return { ...base, [key]: base[key].replace(from, to) };
  };
  for (const [what, mutated] of [
    ['the attention lane trigger removed', plant('gate', "      - 'apps/api/src/live-attention/**'\n", '')],
    ['a retry added', plant('gate', '        run: bash scripts/ios-targeted-gate/run-live-call-gate.sh', '        continue-on-error: true\n        run: bash scripts/ios-targeted-gate/run-live-call-gate.sh')],
    ['the lane left OFF', plant('runner', 'PROOF_ATTENTION=ON PROOF_EVENTS_FILE', 'PROOF_EVENTS_FILE')],
    ['an unrun case made PASS', plant('runner', 'record "$c" "NOT TESTED" "$1"', 'record "$c" PASS "$1"')],
    ['playout not required', plant('runner', 'e.close_reason === "PLAYED_OUT"', 'true')],
    ['the settlement dropped', plant('server', "attentionSettlement: process.env.PROOF_ATTENTION === 'ON' ? new CallAttentionRepository(serverApi) : undefined,", '')],
    ['the API re-added to the World gate', plant('world', "      - 'packages/**'\n", "      - 'packages/**'\n      - 'apps/api/**'\n")],
    ['a World gate suite removed', plant('world', 'run: npm run test:cosmos-ios-world-gate-composition-contract', 'run: true')],
  ]) {
    assert.notDeepEqual(violations(mutated), [], `${what} must be refused`);
  }
});
