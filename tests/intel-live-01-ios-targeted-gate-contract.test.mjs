// INTEL-LIVE-01 CP1 — the iOS Targeted Gate for the live call and the World gate's proportional scope (PO directive
// "Semantic Freedom & Targeted Cross-Platform Validation", 2026-11-25, §3 / §4; backlog BG-10 clarification).
//
// It holds: the targeted gate is change-aware over the live-call backend and client, drives the PRODUCTION call controls
// of the S8B-06 CP3 proof build against the proof server with the attention lane ON, records every case PASS / FAIL /
// NOT TESTED and never turns an unrun case into a PASS; the World gate keeps every suite and its push-to-main run while
// the API and the database are no longer its inputs; BG-10's clarification is in the backlog and AGENTS.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const code = (text) => text.replace(/^\s*#[^\n]*$/gmu, '');

const GATE = '.github/workflows/ios-targeted-gate.yml';
const RUNNER = 'scripts/ios-targeted-gate/run-live-call-gate.sh';
const WORLD = '.github/workflows/cosmos-ios-world-gate.yml';
const SERVER = 'apps/api/scripts/s8b-06-cp3-device-proof-server.ts';
const COMMANDS = 'apps/mobile/src/voice-call/__validation__/s806cp3-call-commands.ts';
const ROOT = 'apps/mobile/src/voice-call/__validation__/S806Cp3ProofRoot.tsx';
const FLOWS = ['itg-call-launch.yaml', 'itg-call-tap.yaml', 'itg-call-visible.yaml', 'itg-call-gone.yaml'];
const CASES = ['ITG-01', 'ITG-02', 'ITG-03', 'ITG-04', 'ITG-05', 'ITG-06'];

const tree = () => ({
  gate: read(GATE),
  runner: read(RUNNER),
  world: read(WORLD),
  server: read(SERVER),
  commands: read(COMMANDS),
  root: read(ROOT),
  flows: FLOWS.map((f) => read(`apps/mobile/.maestro/${f}`)).join('\n---\n'),
});

/** The pull_request paths of a workflow, comments removed. */
function prPaths(workflow) {
  const block = /pull_request:\n\s+paths:\n((?:\s+(?:-\s+'[^']+'|#[^\n]*)\n)+)/u.exec(workflow);
  return block ? [...block[1].matchAll(/-\s+'([^']+)'/gu)].map((m) => m[1]) : [];
}

export function violations({ gate, runner, world, server, flows, commands, root }) {
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
  // The functional cases start and end the call by the proof root's call commands, never a touch (PO, 2026-11-25, the
  // final functional validation approach; runs 45612961224, 45630621237, 45659136860 dropped the call-entry tap). The
  // ITG-02 touch-drop recovery exception is removed with its verifier; UI touch is checked SEPARATELY after them.
  {
    const from = runner.indexOf('# ITG-01 — launch');
    const to = runner.indexOf('# UI touch — SEPARATE');
    const functional = from >= 0 && to > from ? code(runner.slice(from, to)) : '';
    if (!functional || /itg-call-tap\.yaml|tapOn/u.test(functional)) out.push('a functional case depends on a touch');
    if (!functional.includes('call_command start 02-command \\\n  || fail ITG-02 ')) out.push('ITG-02 does not start the call by the start command');
    if (!functional.includes('call_command end 04-command \\\n  || fail ITG-04 ')) out.push('ITG-04 does not end the call by the end command');
    if (!functional.includes('flow itg-call-gone.yaml end -e ID=qandeel-call-rail:end -e STAY_ID=qandeel-depth-to-conversation')) out.push('ITG-04 does not see the call line go and the Analysis stay');
    if (!functional.includes('s.call.state === "ACTIVE"\' \\\n  || fail ITG-02')) out.push('ITG-02 does not require the server to hold the call ACTIVE');
    if (!r.includes('grep -q "\\"outcome\\":\\"$want\\"" "$OUT/host/$saved.jsonl"') || !r.includes('-X POST "$SERVER/proof/call?do=$op"')) {
      out.push("a call command does not wait for the app's own acknowledgement of executing it");
    }
    if (/touch-drop|TAP_RECOVERED|connect-repeat/u.test(r)) out.push('the removed ITG-02 touch-drop recovery is still in the runner');
    const ui = r.slice(r.indexOf('ui_touch() {'), r.indexOf('\nui_touch\n'));
    if (!ui || /\b(fail|record|exit)\b/u.test(ui)) out.push('a UI touch check can change the functional results or the exit status');
    if (['ut-1', 'ut-2', 'ut-3'].some((l) => ui.split('flow itg-call-tap.yaml ' + l + ' ').length !== 2)) out.push('a UI touch check is not made exactly once');
    if (!r.includes('ut "$c" "NOT TESTED" "not reached') || /ut "\$c" PASS/u.test(r)) out.push('an unreached UI touch check is not NOT TESTED');
    if (!r.includes("printf 'case\\tresult\\tdetail\\n' > \"$UI_TOUCH\"") || !r.includes('UI_TOUCH="$OUT/ui-touch.tsv"')) out.push('the UI touch checks are not recorded separately');
    if (r.lastIndexOf('\nexit 0\n') < r.indexOf('\nui_touch\n')) out.push("the UI touch checks are not the run's last, exit-neutral step");
    if (!g.includes('cat "$RUNNER_TEMP/itg/ui-touch.tsv"')) out.push('the job summary does not show the UI touch checks');
  }
  {
    const c = code(commands ?? '');
    if (!c.includes("export const PROOF_CALL_COMMANDS_BASE = 'http://127.0.0.1:8806';")) out.push("the call commands reach beyond the simulator's loopback proof server");
    if (!c.includes("if (owner.getState().stage === 'PREPARING') return 'BUSY';\n  void owner.start();")) out.push("the start command is not the call entry's own call");
    if (!c.includes("if (command === 'end') {\n    owner.end();")) out.push("the end command is not End's own call");
    if (!c.includes('/proof/call/ack?id=')) out.push('the app does not acknowledge what it executed');
    if (!(root ?? '').includes("followProofCallCommands({\n      owner: () => {\n        const phase = runtime.getPhase();\n        return phase.kind === 'READY' ? phase.runtime.call : null;")) {
      out.push("the proof root does not follow the call commands on the session's own CallOwner");
    }
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

  if (!s.includes("if (callCommand !== null && !callCommand.acked) throw new HttpException('a call command is still unanswered', 409);")) out.push('a call command can be queued over an unanswered one');
  if (!s.includes('if (callCommand === null || callCommand.taken || req.socket?.destroyed === true) return { id: null };\n      callCommand.taken = true;')) {
    out.push('a call command can be handed out more than once, or to a request whose connection closed');
  }
  if (!s.includes('!callCommand.taken || callCommand.acked) throw new HttpException')) out.push('a call command can be acknowledged twice or before it was taken');
  if (!s.includes('const timer = setTimeout(wake, 20_000);')) out.push('the proof root polls instead of one held request');

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
  assert.match(runner, /-e ID=qandeel-depth-to-conversation -e WAIT_ID=qandeel-call-entry/u);
  assert.match(runner, /flow itg-call-gone\.yaml end /u);
});

test('ITG-04 asserts the approved end (S8B-06 CP3 J3): the call line goes and the Analysis stays; UT-1 taps back to the entry', () => {
  // Run 45571644129: the call ended USER_ENDED on the server at the tap and the call line went, but the flow waited for the
  // call entry on the Analysis, where it is never drawn. The person's own End does not move them (J3).
  const gone = code(read('apps/mobile/.maestro/itg-call-gone.yaml'));
  assert.ok(!/tapOn/u.test(gone), 'the end flow touches nothing');
  const goes = gone.indexOf('notVisible:\n      id: ${ID}');
  assert.ok(goes >= 0 && gone.indexOf('assertVisible:\n    id: ${STAY_ID}') > goes, 'the call line goes, then the Analysis is still there');
  const r = read(RUNNER);
  assert.match(r, /s\.call\.state === "ENDED" && s\.call\.end_reason === "USER_ENDED"/u, 'the server still must end the call USER_ENDED');
  assert.match(r, /flow itg-call-tap\.yaml ut-1 -e ID=qandeel-depth-to-conversation -e WAIT_ID=qandeel-call-entry/u, 'the door back to the entry is a UI touch check');
  assert.ok(!existsSync(new URL('../apps/mobile/.maestro/itg-call-end.yaml', import.meta.url)) && !existsSync(new URL('../scripts/ios-targeted-gate/touch-drop.mjs', import.meta.url)),
    'the touch-driven end flow and the touch-drop verifier are gone');
  assert.match(read('docs/e2e/QANDEEL_S8B_06_CALL_UI_LIVE_MAP_DEVICE_CLOSURE_RECORD_v1.md'), /the person's own End \(app, notification, system UI\) does not move them/u,
    'the behaviour asserted is the approved one');
});

test('the call commands are proof-only: no Product module reaches them, and the Product entry is unchanged', () => {
  const walk = (dir) => readdirSync(new URL('../' + dir, import.meta.url), { withFileTypes: true }).flatMap((e) => {
    const p = dir + '/' + e.name;
    if (e.isDirectory()) return ['__validation__', '__tests__', 'node_modules'].includes(e.name) ? [] : walk(p);
    return /\.(ts|tsx|js|jsx)$/u.test(e.name) ? [p] : [];
  });
  const reaching = [...walk('apps/mobile/src'), ...walk('apps/api/src')].filter((p) => /s806cp3-call-commands|\/proof\/call/u.test(read(p)));
  assert.deepEqual(reaching, []);
  assert.match(read('apps/mobile/package.json'), /"main": "expo-router\/entry"/u);
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
    ['a functional case by touch again', plant('runner', 'call_command start 02-command \\', 'flow itg-call-tap.yaml connect -e ID=qandeel-call-entry -e WAIT_ID=qandeel-call-rail:end -e SHOT=02-in-call \\')],
    ['the acknowledgement not awaited', plant('runner', 'grep -q "\\"outcome\\":\\"$want\\"" "$OUT/host/$saved.jsonl"', 'true')],
    ['a UI touch failure failing the job', plant('runner', 'ut UT-2 FAIL "a tap on the call entry did not draw', 'fail ITG-02 "a tap on the call entry did not draw')],
    ['a UI touch check repeated', plant('runner', '  FLOW_SECONDS=120 flow itg-call-tap.yaml ut-2 ', '  FLOW_SECONDS=120 flow itg-call-tap.yaml ut-2 -e ID=qandeel-call-entry || FLOW_SECONDS=120 flow itg-call-tap.yaml ut-2 ')],
    ['an unreached UI touch check made PASS', plant('runner', 'ut "$c" "NOT TESTED" "not reached', 'ut "$c" PASS "not reached')],
    ['the UI touch results hidden', plant('gate', 'cat "$RUNNER_TEMP/itg/ui-touch.tsv"', 'true')],
    ['the touch-drop recovery kept', plant('runner', '# ITG-02 — connect, by the start command', 'TAP_RECOVERED=""\n# ITG-02 — connect, by the start command')],
    ['a command handed out twice', plant('server', 'callCommand === null || callCommand.taken || req.socket', 'callCommand === null || req.socket')],
    ['a command handed to a closed connection', plant('server', ' || req.socket?.destroyed === true) return { id: null };', ') return { id: null };')],
    ['a command queued over an unanswered one', plant('server', "if (callCommand !== null && !callCommand.acked) throw new HttpException('a call command is still unanswered', 409);", '')],
    ['the follower polling instead of one held request', plant('server', 'setTimeout(wake, 20_000);', 'setTimeout(wake, 0);')],
    ["start without the entry's guard", plant('commands', "  if (owner.getState().stage === 'PREPARING') return 'BUSY';\n", '')],
    ["end not the owner's", plant('commands', "if (command === 'end') {\n    owner.end();", "if (command === 'end') {")],
    ['a command from off the loopback', plant('commands', "'http://127.0.0.1:8806'", "'http://10.0.2.2:8806'")],
    ['the follower dropped from the proof root', plant('root', 'const stopCommands = followProofCallCommands({', 'const stopCommands = (({}) => () => undefined)({')],
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
