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
const TOUCH = 'scripts/ios-targeted-gate/touch-drop.mjs';
const FLOWS = ['itg-call-launch.yaml', 'itg-call-tap.yaml', 'itg-call-visible.yaml', 'itg-call-end.yaml'];
const CASES = ['ITG-01', 'ITG-02', 'ITG-03', 'ITG-04', 'ITG-05', 'ITG-06'];

const tree = () => ({
  gate: read(GATE),
  runner: read(RUNNER),
  world: read(WORLD),
  server: read(SERVER),
  touch: read(TOUCH),
  flows: FLOWS.map((f) => read(`apps/mobile/.maestro/${f}`)).join('\n---\n'),
});

/** The pull_request paths of a workflow, comments removed. */
function prPaths(workflow) {
  const block = /pull_request:\n\s+paths:\n((?:\s+(?:-\s+'[^']+'|#[^\n]*)\n)+)/u.exec(workflow);
  return block ? [...block[1].matchAll(/-\s+'([^']+)'/gu)].map((m) => m[1]) : [];
}

export function violations({ gate, runner, world, server, flows, touch }) {
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
  // PO 2026-11-25, option 1: ONE recorded repeat of ITG-03's spoken turn, only after a server-confirmed loss before PLAYED_OUT.
  if ((r.match(/-X POST "\$SERVER\/proof\/speak/gu) ?? []).length !== 2) out.push('ITG-03 arms the stimulus other than once plus the one recovery repeat');
  const lossAt = r.indexOf('if [ "$TURN" -eq 2 ]; then');
  const repeatAt = r.indexOf('wait_turn 120 03-repeat "$BEFORE"');
  const elseAt = r.indexOf('\nelse\n', repeatAt);
  if (lossAt < 0 || repeatAt < lossAt || elseAt < 0) out.push('ITG-03 repeats its turn without a server-confirmed connection loss');
  if (!/if \[ "\$\(losses\)" -gt "\$before" \]; then/u.test(r) || !/losses\(\) \{ grep -c '"kind":"connection-lose"' "\$EVENTS"/u.test(r)) out.push('ITG-03 does not take the loss from the server\'s own record');
  if (!/s\.call\.state === \\"ACTIVE\\" && s\.call\.epoch > \$LOST_EPOCH/u.test(r)) out.push('ITG-03 repeats before the call is ACTIVE again at a later epoch');
  if (!/\[ "\$TURN" -ne 2 \] \|\| fail ITG-03 "a second connection loss/u.test(r)) out.push('a second connection loss does not fail ITG-03');
  if (!/if \[ -n "\$RECOVERED" \]; then\n\s+record ITG-03 "PASS AFTER RECOVERY"/u.test(r)) out.push('a recovered ITG-03 is not recorded PASS AFTER RECOVERY');
  if (!/wait_turn 120 03-attempt-1 "\$BEFORE"/u.test(r) || !/> "\$OUT\/host\/03-loss-1\.jsonl"/u.test(r)) out.push('the first attempt\'s evidence is not kept');
  if (!/^start_client_diagnostics$/mu.test(r) || !/log show --style compact --start "\$CLIENT_LOG_FROM"/u.test(r) || !/^\s+collect_client_log$/mu.test(r)
    || !/client_snapshot "failure-\$1"/u.test(r)) out.push('the client-side diagnostics are missing');
  // Run 45612961224: ITG-02's tap reached the app and nothing followed, with no client evidence. They start before ITG-01.
  if (!/\nstart_client_diagnostics\nflow itg-call-launch\.yaml launch /u.test(r) || !/\( while :; do pid="\$\(pgrep -x QANDEEL \| head -n 1\)"/u.test(r)) {
    out.push('the client-side diagnostics do not cover the run from ITG-01');
  }
  // ITG-02's ONE infrastructure-recovery exception (PO, 2026-11-25; runs 45612961224 and 45630621237): one repeat of the
  // call-entry tap, only after touch-drop.mjs confirmed the simulator's own touch drop with the server idle.
  {
    const first = r.indexOf('if ! flow itg-call-tap.yaml connect -e ID=qandeel-call-entry');
    const verify = r.indexOf('node "$REPO/scripts/ios-targeted-gate/touch-drop.mjs" "$OUT/host/02-touch-1.log" "$EVENTS" "$TAP_SINCE" "$OUT/host/02-attempt-1-state.json"');
    const refused = r.indexOf("|| fail ITG-02 \"a tap on the call entry did not draw the call line's End, and it was not the simulator's confirmed touch drop");
    const repeat = r.indexOf('flow itg-call-tap.yaml connect-repeat ');
    const count = (needle) => r.split(needle).length - 1;
    if (first < 0 || verify < first || refused < verify || repeat < refused || count('flow itg-call-tap.yaml connect-repeat ') !== 1
      || count('flow itg-call-tap.yaml connect') !== 2) {
      out.push('ITG-02 repeats its tap without the confirmed touch drop, or more than once');
    }
    if (!r.includes('-e SHOT=02-in-call \\\n    || fail ITG-02 "the ONE repeat'))out.push('a failed ITG-02 repeat does not fail the case');
    if (!r.includes('if [ -n "$TAP_RECOVERED" ]; then\n  record ITG-02 "PASS AFTER RECOVERY"')) out.push('a recovered ITG-02 is not recorded PASS AFTER RECOVERY');
    if (!['> "$OUT/host/02-attempt-1-state.json"', '> "$OUT/host/02-touch-1.log"', 'shots/itg-02-attempt-1.png'].every((e) => r.includes(e))) {
      out.push('the first tap\'s evidence is not kept');
    }
    for (const [rule, needle] of [
      ['T1', 'if (touched.length !== 1) verdict(false'],
      ['T2', 'if (dropped.length === 0) verdict(false'],
      ['T3', 'presence: none`))) verdict(false'],
      ['T4', 'if (disappeared < 0 || cancelled < 0) verdict(false'],
      ['S1', "state.call !== null) verdict(false"],
      ['S2', "e.path.startsWith('/voice/calls')) || (e.kind === 'KICK' && e.reason === 'CALL_ACTIVATED')"],
    ]) if (!(touch ?? '').includes(needle)) out.push(`touch-drop.mjs does not hold ${rule}`);
  }
  // Run 45601664395 (PO, 2026-11-25): the harness's own load on a runner with no idle CPU and 129 MB free.
  if (/log stream/u.test(r)) out.push('the runner streams the app log during the cases (measured at about a third of a core)');
  if (!/ts-node\/dist\/bin\.js" --transpile-only --project/u.test(r) || !/run: node node_modules\/typescript\/bin\/tsc -p apps\/api\/tsconfig\.scripts\.json --noEmit/u.test(g)) {
    out.push('the proof server is not type-checked in its own step and run transpile-only beside the simulator');
  }
  if (!/run: sudo mdutil -a -i off/u.test(g) || g.indexOf('sudo mdutil -a -i off') > g.indexOf('-configuration Release -sdk iphonesimulator')) out.push('Spotlight is not stopped before the build');

  if (!/id: qandeel-call-entry/u.test(flows)) out.push('the launch flow does not wait for the production call entry');
  if (/hideKeyboard|retry:/u.test(code(flows))) out.push('a flow hides the keyboard or retries');

  const s = server;
  if (!/if \(process\.env\.PROOF_ATTENTION === 'ON'\) \{\n\s+attentionBinding\.bind\(liveCallAttentionOf\(/u.test(s)) out.push('the proof server does not compose the production attention lane under PROOF_ATTENTION=ON');
  if (!/attentionSettlement: process\.env\.PROOF_ATTENTION === 'ON' \? new CallAttentionRepository\(serverApi\) : undefined/u.test(s)) out.push('the proof server does not settle the attention lane at the call\'s end');
  if (!/if \(openStreams === 0\) throw new HttpException/u.test(s)) out.push('/proof/speak arms a stimulus with no open uplink');
  if (!/evidence\('connection-lose', \{ code: args\[0\] \?\? null, reason: args\[1\] \?\? null, phase: this\.phase \?\? null, epoch: this\.epoch \?\? null \}\)/u.test(s)) out.push('a connection loss is recorded without its epoch');
  if (!/evidence\('http', \{ method: req\.method, path: req\.url\.split\('\?'\)\[0\], status: res\.statusCode, ms: Date\.now\(\) - started \}\)/u.test(s)) {
    out.push('the proof server does not record each HTTP request\'s path and status, without its query');
  }

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
  assert.match(read('apps/mobile/src/conversation/AnalysisReturnBar.tsx'), /testID="qandeel-depth-to-conversation"/u);
  const runner = read(RUNNER);
  assert.match(runner, /-e ID=qandeel-call-entry -e WAIT_ID=qandeel-call-rail:end/u);
  assert.match(runner, /flow itg-call-end\.yaml end \\\n/u);
});

test('ITG-04 asserts the approved end (S8B-06 CP3 J3): the call line goes, the Analysis stays, the entry is back in the Conversation', () => {
  // Run 45571644129: the call ended USER_ENDED on the server at the tap and the call line went, but the flow waited for the
  // call entry on the Analysis, where it is never drawn. The person's own End does not move them (J3).
  const end = code(read('apps/mobile/.maestro/itg-call-end.yaml'));
  const steps = ['tapOn:\n    id: qandeel-call-rail:end', 'notVisible:\n      id: qandeel-call-rail:end', 'assertVisible:\n    id: qandeel-depth-to-conversation',
    'tapOn:\n    id: qandeel-depth-to-conversation', 'visible:\n      id: qandeel-call-entry'];
  let at = -1;
  for (const step of steps) {
    const next = end.indexOf(step);
    assert.ok(next > at, `ITG-04's flow carries, in order: ${step.replace(/\n\s*/gu, ' ')}`);
    at = next;
  }
  const r = read(RUNNER);
  assert.match(r, /s\.call\.state === "ENDED" && s\.call\.end_reason === "USER_ENDED"/u, 'the server still must end the call USER_ENDED');
  assert.match(read('docs/e2e/QANDEEL_S8B_06_CALL_UI_LIVE_MAP_DEVICE_CLOSURE_RECORD_v1.md'), /the person's own End \(app, notification, system UI\) does not move them/u,
    'the behaviour asserted is the approved one');
});

test('BG-10 is clarified, not relaxed (PO directive 2026-11-25)', () => {
  const backlog = read('docs/qandeel-canonical-backlog-v1.md');
  assert.match(backlog, /\*\*BG-10 clarification — validation proportional to impact \(PO directive, 2026-11-25; recorded by\nINTEL-LIVE-01 CP1\)\.\*\*/u);
  for (const clause of [/iOS compatibility stays mandatory and no blanket exemption exists/u, /never marked NOT TESTED to avoid its cost/u,
    /a build alone is insufficient/u, /are never deleted or weakened/u, /reported as not run, never as passed/u, /\.github\/workflows\/ios-targeted-gate\.yml/u]) {
    assert.match(backlog.replace(/\s+/gu, ' '), clause);
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
    ['a recovery recorded as PASS', plant('runner', 'record ITG-03 "PASS AFTER RECOVERY"', 'record ITG-03 PASS')],
    ['a second loss tolerated', plant('runner', '[ "$TURN" -ne 2 ] || fail ITG-03', 'true || fail ITG-03')],
    ['a repeat without a loss', plant('runner', 'if [ "$TURN" -eq 2 ]; then', 'if [ "$TURN" -ne 0 ]; then')],
    ['a repeat before reconnection', plant('runner', 's.call.epoch > $LOST_EPOCH', 'true')],
    ['a third stimulus', plant('runner', '  wait_turn 120 03-repeat "$BEFORE"', '  curl -s -X POST "$SERVER/proof/speak?ms=1500"\n  wait_turn 120 03-repeat "$BEFORE"')],
    ['the loss taken from elsewhere', plant('runner', 'if [ "$(losses)" -gt "$before" ]; then', 'if false; then')],
    ['the diagnostics dropped', plant('runner', '\nstart_client_diagnostics\n', '\n')],
    ['the diagnostics started late again', plant('runner', '\nstart_client_diagnostics\nflow itg-call-launch.yaml', '\nflow itg-call-launch.yaml')],
    ['the pid read once', plant('runner', '( while :; do pid="$(pgrep -x QANDEEL | head -n 1)"', 'pid="$(pgrep -x QANDEEL | head -n 1)"; ( while :; do')],
    ['the HTTP evidence dropped', plant('server', "evidence('http', {", 'void ({')],
    ['the HTTP evidence with its query', plant('server', "path: req.url.split('?')[0]", 'path: req.url')],
    ['an ITG-02 recovery recorded as PASS', plant('runner', 'record ITG-02 "PASS AFTER RECOVERY"', 'record ITG-02 PASS')],
    ['an ITG-02 repeat without the confirmed drop', plant('runner', "|| fail ITG-02 \"a tap on the call entry did not draw the call line's End, and it was not the simulator's confirmed touch drop", "|| true \"a tap on the call entry did not draw the call line's End, and it was not the simulator's confirmed touch drop")],
    ['a second ITG-02 repeat', plant('runner', '  flow itg-call-tap.yaml connect-repeat ', '  flow itg-call-tap.yaml connect-repeat -e ID=qandeel-call-entry || flow itg-call-tap.yaml connect-repeat ')],
    ['a failed ITG-02 repeat tolerated', plant('runner', '    || fail ITG-02 "the ONE repeat', '    || true "the ONE repeat')],
    ['the completed-tap rule dropped (T3)', plant('touch', 'presence: none`))) verdict(false', 'presence: none`))) void (false')],
    ['the cancellation rule dropped (T4)', plant('touch', 'if (disappeared < 0 || cancelled < 0) verdict(false', 'if (false) verdict(false')],
    ['the idle-call rule dropped (S1)', plant('touch', 'state.call !== null) verdict(false', 'false) verdict(false')],
    ['the loss epoch dropped', plant('server', ', epoch: this.epoch ?? null });', ' });')],
    ['the app log streamed again', plant('runner', '  CLIENT_LOG_FROM="$(date', '  xcrun simctl spawn "$UDID" log stream --style compact &\n  CLIENT_LOG_FROM="$(date')],
    ['the server type-checked beside the simulator', plant('runner', '/bin.js" --transpile-only --project', '/bin.js" --project')],
    ['transpile-only without a type-check', plant('gate', '        run: node node_modules/typescript/bin/tsc -p apps/api/tsconfig.scripts.json --noEmit', '        run: true')],
    ['Spotlight left indexing', plant('gate', '        run: sudo mdutil -a -i off', '        run: true')],
    ['the settlement dropped', plant('server', "attentionSettlement: process.env.PROOF_ATTENTION === 'ON' ? new CallAttentionRepository(serverApi) : undefined,", '')],
    ['the API re-added to the World gate', plant('world', "      - 'packages/**'\n", "      - 'packages/**'\n      - 'apps/api/**'\n")],
    ['a World gate suite removed', plant('world', 'run: npm run test:cosmos-ios-world-gate-composition-contract', 'run: true')],
  ]) {
    assert.notDeepEqual(violations(mutated), [], `${what} must be refused`);
  }
});
