// QAN-BL-CI-04 (PO, 2026-11-23: "RB-2/S2 Handoff + Proactive iOS CI Stabilization"). The iOS World gate's Maestro steps
// (scripts/cosmos-ios-world/run-world-gate.sh) must:
//
//   - keep Maestro's own debug folder for EVERY call in a known place (<OUT>/maestro/<name>), log the call's timeline
//     (maestro-phases.mjs), and keep the evidence of an abnormal exit for every step, not only a door — screenshot,
//     hierarchy, the driver's answer, surviving Maestro processes (stopped), the simulator log;
//   - tell a step that gave no answer (the watchdog's 124, a crash) from a confirmed failed UI assertion: a case is FAIL
//     on a missing UI effect only when its step answered (exit 0, exit 1 = Maestro's own failed command, or a log that
//     proves every command of the flow COMPLETED); otherwise NOT TESTED with an INFRASTRUCTURE reason, never FAIL or PASS;
//   - never report "the Personal Analysis did not open" for a door step that gave no answer;
//   - change no bound, add no retry, and remove no assertion;
//   - upload its evidence also when the job is cancelled or times out.
// The timeline parser is checked on fixtures; the shell's classification helpers are executed by bash; each static
// detector is shown to catch a planted defect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acted, flowCommandCount, phaseLine, readTimeline } from '../scripts/cosmos-ios-world/maestro-phases.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n/gu, '\n');
const FLOWS = 'scripts/cosmos-ios-world/flows';
const shellCode = (text) => text.split('\n').filter((line) => !/^\s*#/u.test(line)).join('\n');
// The body of a shell function: `name() {` + newline … up to the closing brace at the start of a line, or
// `name() { …` (code on the first line) up to the first line that ends with "; }".
const fnBody = (code, name) => new RegExp(`^${name}\\(\\) \\{(?:\\n([\\s\\S]*?)\\n\\}$|( \\S[\\s\\S]*?); \\}$)`, 'mu')
  .exec(code)?.slice(1).find((g) => g !== undefined) ?? null;

// ── fixtures: Maestro cli-2.10.0 log lines, in the shape of gate 45183916103's p-door maestro.log ─────────────────────
const L = (t, msg) => `${t} [ INFO] ${msg}`;
const C = (t, n, name, state) => L(t, `maestro.cli.runner.MaestroCommandRunner.runCommands$lambda$${n}: ${name} ${state}`);
const HEAD = [
  L('13:56:09.140', 'maestro.cli.report.TestDebugReporter.logSystemInfo: Debug output path: /tmp/x'),
  L('13:56:48.263', 'maestro.cli.command.TestCommand.runShardSuite: [shard 1] Selected device SIM using port 22087'),
  L('13:56:49.696', 'maestro.cli.runner.TestRunner.runSingle: Running flow timed-id.yaml...'),
  L('13:56:56.073', 'maestro.Maestro.cachedDeviceInfo_delegate$lambda$0: Got device info: DeviceInfo(platform=IOS)'),
  C('13:58:07.340', 0, 'Define variables', 'RUNNING'), C('13:58:07.393', 2, 'Define variables', 'COMPLETED'),
  C('13:58:07.398', 0, 'Apply configuration', 'RUNNING'), C('13:58:07.413', 2, 'Apply configuration', 'COMPLETED'),
  C('13:58:07.414', 0, 'Run ${output.t0 = Date.now()}', 'RUNNING'), C('13:58:11.205', 2, 'Run ${output.t0 = Date.now()}', 'COMPLETED'),
];
const TAP = [
  C('13:58:11.211', 0, 'Tap on id: ${TAP}', 'RUNNING'),
  L('13:58:22.994', 'maestro.Maestro.screenshotBasedTap-ogj28Uc: Try tapping at (83, 86) using hierarchy based logic'),
];
const TAIL = [
  C('13:58:26.751', 2, 'Tap on id: ${TAP}', 'COMPLETED'),
  C('13:58:26.759', 0, 'Assert that id: ${WAIT} is visible', 'RUNNING'),
  C('13:58:30.576', 2, 'Assert that id: ${WAIT} is visible', 'COMPLETED'),
  C('13:58:30.837', 0, "Run ${console.log('TIMING')}", 'RUNNING'),
  C('13:58:35.728', 2, "Run ${console.log('TIMING')}", 'COMPLETED'),
];
const DOOR = [...HEAD, ...TAP, ...TAIL].join('\n');
const START = Date.UTC(2026, 10, 23, 13, 56, 0, 0);

test('the timeline parser cuts the phases at Maestro\'s own lines and proves the P-DOOR shape acted', () => {
  const t = readTimeline(DOOR);
  const line = phaseLine(t, START, START + 160_000, 150, 4);
  assert.match(line, /^jvm=9\.1 enumerate=39\.1 session=1\.4 deviceinfo=6\.4 engine=71\.3 commands=28\.4 after=4\.3 total=160\.0 /u);
  assert.match(line, / acted=yes own=4\/4 /u);
  assert.match(line, / tap=COMPLETED dispatch="13:58:22\.994 Try tapping at \(83, 86\)"/u);
  assert.match(line, / after_term=5\.7$/u, 'a call stopped at its bound reports how long its own log went on');
  assert.doesNotMatch(phaseLine(t, START, START + 100_000, 150, 4), /after_term/u, 'no after_term below the bound');
});

test('acted is never "yes" without proof: each planted shape is caught', () => {
  const t = (lines) => readTimeline(lines.join('\n'));
  // stopped BETWEEN commands: every started command completed, but the tap never started (Maestro logs no flow end)
  const between = t(HEAD);
  assert.equal(between.started, between.ended, 'the planted shape looks complete to a started==ended rule');
  assert.equal(acted(between, 4), 'no');
  // stopped DURING the tap
  const during = t([...HEAD, ...TAP]);
  assert.equal(acted(during, 4), 'no');
  assert.match(phaseLine(during, START, START + 150_000, 150, 4), /inflight="Tap on id: \$\{TAP\}".* tap=NOT-COMPLETED/u);
  // a FAILED, a SKIPPED and a WARNED command
  for (const state of ['FAILED', 'SKIPPED', 'WARNED']) {
    const shape = t([...HEAD, ...TAP, ...TAIL.slice(0, 2), C('13:58:30.576', 2, 'Assert that id: ${WAIT} is visible', state),
      ...TAIL.slice(3)]);
    assert.equal(acted(shape, 4), 'no', state);
  }
  // the complete flow, but no flow file to count against
  assert.equal(acted(readTimeline(DOOR), null), 'no');
  assert.equal(acted(readTimeline(DOOR), 4), 'yes');
  // no command at all, and no log at all
  assert.equal(acted(t(HEAD.slice(0, 4)), 4), 'none');
  assert.equal(acted(readTimeline(''), 4), 'none');
});

test('every flow declares top-level commands only, so the command count is exact', () => {
  const files = readdirSync(join(root, FLOWS)).filter((f) => f.endsWith('.yaml'));
  assert.ok(files.length >= 10);
  for (const f of files) {
    const yaml = read(`${FLOWS}/${f}`);
    assert.ok(flowCommandCount(yaml) > 0, `${f} declares no command`);
    const body = yaml.split(/^---[ \t]*$/mu).slice(1).join('\n');
    assert.doesNotMatch(body, /^[ \t]+- \S/mu, `${f} nests commands: the count of its own commands would be inflated`);
    assert.doesNotMatch(body, /\b(runFlow|repeat|retry):/u, `${f} runs commands of another flow or repeats them`);
  }
  assert.equal(flowCommandCount(read(`${FLOWS}/timed-id.yaml`)), 4);
  assert.equal(flowCommandCount('appId: x\n---\n- tapOn:\n    point: "1%,1%"\n  - nested\n'), 1);
  assert.equal(flowCommandCount('appId: x\n- tapOn: y\n'), 0, 'no "---": no commands are counted');
});

// ── the gate's shell helpers, executed ─────────────────────────────────────────────────────────────────────────────
const bash = spawnSync('bash', ['-c', 'echo ok'], { encoding: 'utf8' });
test('answered / infra / step_why classify an exit as the gate requires', { skip: bash.stdout?.trim() !== 'ok' && 'no bash' }, () => {
  const code = shellCode(read('scripts/cosmos-ios-world/run-world-gate.sh'));
  const defs = ['answered', 'infra', 'step_why'].map((n) => {
    const m = new RegExp(`^${n}\\(\\) \\{.*\\}$`, 'mu').exec(code);
    assert.ok(m, `${n} is a one-line function`);
    return m[0];
  }).join('\n');
  const run = (rc, actedValue, body) => spawnSync('bash', ['-c', `${defs}\nMT_NAME=p-door MT_RC=${rc} MT_ACTED=${actedValue}\n${body}`],
    { encoding: 'utf8' }).stdout.trim();
  const ans = (rc, a) => run(rc, a, 'answered && echo yes || echo no');
  assert.equal(ans(0, 'none'), 'yes', 'exit 0 answered');
  assert.equal(ans(1, 'no'), 'yes', "exit 1 is Maestro's own failed command: the case judges it as before");
  assert.equal(ans(124, 'yes'), 'yes', 'the P-DOOR shape: stopped, but every command of its flow COMPLETED');
  assert.equal(ans(124, 'no'), 'no', 'stopped during its flow');
  assert.equal(ans(124, 'none'), 'no', 'stopped before its first command');
  assert.equal(ans(125, 'none'), 'no', 'the /deviceInfo fail-fast');
  assert.equal(ans(137, 'no'), 'no', 'killed');
  assert.match(run(124, 'no', "infra 'the missing PEEK'"), /^INFRASTRUCTURE: Maestro step p-door exited 124 .*acted=no.*the missing PEEK is not evidence either way$/u);
  assert.equal(run(1, 'no', "step_why 'the World did not open'"), 'the World did not open');
  assert.match(run(124, 'none', "step_why 'the World did not open'"), /^the World did not open — not established: INFRASTRUCTURE: /u);
});

test('abnormal keeps its evidence, with a fallback when the step wrote no debug log', { skip: bash.stdout?.trim() !== 'ok' && 'no bash' }, () => {
  const code = shellCode(read('scripts/cosmos-ios-world/run-world-gate.sh'));
  const body = fnBody(code, 'abnormal');
  assert.ok(body, 'abnormal exists');
  // Stubs for the simulator, the driver and the processes; `find`, `cp` and the files are real.
  const script = (setup) => `set -u
T="$(mktemp -d)"; export HOME="$T/home"; OUT="$T/out"; ROOT="$T"; UDID=sim; PORT=1; MT_PHASES='x acted=no'; MT_ACTED=no
mkdir -p "$HOME/.maestro/tests" "$OUT/maestro/p-door"
shot() { echo png > "$OUT/$1.png"; }; dump() { echo '{}' > "$OUT/$1.json"; }; say() { :; }
curl() { return 7; }; pgrep() { return 1; }; pkill() { return 1; }; node() { return 0; }
abnormal() {
${body}
}
${setup}
abnormal p-door timed-id.yaml 124; cat "$OUT/maestro/p-door/abnormal.txt"; ls "$OUT/maestro/p-door"; rm -rf "$T"`;
  const run = (setup) => spawnSync('bash', ['-c', script(setup)], { encoding: 'utf8' }).stdout;
  // the step's own log is absent; a Maestro session folder created after the step started is the fallback
  const withFallback = run(`touch -d '5 seconds ago' "$OUT/maestro/p-door/started.marker"
mkdir -p "$HOME/.maestro/tests/2026-11-23_old" && touch -d '1 hour ago' "$HOME/.maestro/tests/2026-11-23_old"
mkdir -p "$HOME/.maestro/tests/2026-11-23_new" && echo log > "$HOME/.maestro/tests/2026-11-23_new/maestro.log"`);
  assert.match(withFallback, /^step=p-door flow=timed-id\.yaml exit=124$/mu);
  assert.match(withFallback, /^driver-status=no answer within 10 s$/mu);
  assert.match(withFallback, /^debug-log=absent$/mu);
  assert.match(withFallback, /^fallback-session=.*2026-11-23_new$/mu, 'the session folder newer than the step is kept');
  assert.match(withFallback, /^screenshot=kept$/mu);
  assert.match(withFallback, /^hierarchy=kept$/mu);
  assert.match(withFallback, /^fallback-session$/mu, 'the fallback folder is copied beside the record');
  // planted: only a folder OLDER than the step exists — it must not be taken for this step's evidence
  const onlyOld = run(`touch -d '5 seconds ago' "$OUT/maestro/p-door/started.marker"
mkdir -p "$HOME/.maestro/tests/2026-11-23_old" && touch -d '1 hour ago' "$HOME/.maestro/tests/2026-11-23_old"`);
  assert.match(onlyOld, /^fallback-session=none$/mu);
  assert.doesNotMatch(onlyOld, /^fallback-session$/mu);
  // the step's own log is present: no fallback is looked for
  const own = run(`touch -d '5 seconds ago' "$OUT/maestro/p-door/started.marker"; echo log > "$OUT/maestro/p-door/maestro.log"
mkdir -p "$HOME/.maestro/tests/2026-11-23_new"`);
  assert.match(own, /^debug-log=present$/mu);
  assert.match(own, /^fallback-session=none$/mu);
});

// ── static: the gate and its workflow ─────────────────────────────────────────────────────────────────────────────
// Every verdict a Maestro action decides: its FAIL is preceded by a NOT TESTED branch for a step that gave no answer.
const JUDGED_FAILS = [
  'tap at $3: no qandeel-personal-peek within 6 s',
  'after the pan ($3), Back is not available',
  'tap $i neither opened $what nor disclosed a deeper depth ($path)',
  "'$w0' -> '$w1'$(backOn s-far",
  "sheet top $t0 -> $t1 pt; handle '$h0' -> '$h1'\"; fi",
  "no qandeel-shared-thread within 10 s of the panel's Conversation act",
];

export function violations({ gate, workflow, phases }) {
  const out = [];
  const code = shellCode(gate);
  const lines = code.split('\n');
  const mt = fnBody(code, 'mt');
  if (!mt) out.push('no mt function');
  else {
    if (!/--debug-output "\$d" --flatten-debug-output/u.test(mt)) out.push('mt does not keep the call\'s own debug folder');
    if (!/local d="\$OUT\/maestro\/\$n"/u.test(mt)) out.push('the debug folder is not <OUT>/maestro/<name>');
    if (!/maestro-phases\.mjs" "\$d\/maestro\.log" "\$t0" "\$t1" 150 "\$F\/\$f"/u.test(mt)) out.push('mt does not log the call\'s timeline against its flow');
    if (!/\[ "\$rc" = 0 \] \|\| abnormal "\$n" "\$f" "\$rc"/u.test(mt)) out.push('an abnormal exit keeps no evidence');
    if (!/bounded-run\.mjs" --seconds 150 --label "\$n"/u.test(mt)) out.push('the Maestro bound is not the unchanged 150 s');
  }
  const bounds = [...code.matchAll(/bounded-run\.mjs" --seconds (\d+)/gu)].map((m) => Number(m[1])).sort((a, b) => a - b);
  if (bounds.join(',') !== '90,150') out.push(`bounded-run bounds changed: ${bounds.join(',')}`);
  // a retry: a step run again after its failure, or in a loop until it succeeds
  if (/\bretry\b|\|\|\s*mt\s|until\s+mt\b|while\s+!?\s*mt\b/u.test(code)) out.push('the gate retries a step');
  const abnormal = fnBody(code, 'abnormal');
  if (!abnormal) out.push('no abnormal function');
  else {
    for (const [what, re] of [['screenshot', /shot "\$n-abnormal"/u], ['hierarchy', /dump "\$n-abnormal"/u],
      ['driver status', /\/status"/u], ['surviving processes stopped', /pkill -KILL -f "\$HOME\/\.maestro\/"/u],
      ['record', /> "\$d\/abnormal\.txt"/u], ['simulator log', /bounded-run\.mjs" --seconds 90 .*log show --last 5m/u]]) {
      if (!re.test(abnormal)) out.push(`abnormal keeps no ${what}`);
    }
    if (/\bresult\b|\bmt\b /u.test(abnormal)) out.push('abnormal decides a case or runs a Maestro step');
  }
  if (!/^answered\(\) \{ \[ "\$MT_RC" = 0 \] \|\| \[ "\$MT_RC" = 1 \] \|\| \[ "\$\{MT_ACTED:-\}" = yes \]; \}$/mu.test(code)) {
    out.push('answered is not exactly: exit 0, exit 1, or acted=yes');
  }
  for (const fail of JUDGED_FAILS) {
    const i = lines.findIndex((l) => l.includes(fail) && / FAIL /u.test(l));
    if (i < 0) { out.push(`FAIL verdict not found: ${fail}`); continue; }
    if (!/! answered; then (nt_)?result .*'NOT TESTED'.*\$\(infra /u.test(lines[i - 1] ?? '')) out.push(`FAIL without a no-answer branch: ${fail}`);
  }
  // PO review (2026-11-23) 1 and 3: `answered` only ever chooses between NOT TESTED and a FAIL the case already had. No
  // PASS depends on a step's exit status or its log: every PASS is decided by the UI state the gate reads itself.
  for (const line of lines.filter((l) => /\banswered\b/u.test(l) && !/^answered\(\)/u.test(l))) {
    const ok = /'NOT TESTED'/u.test(line) || /^\s*mt "\$n-(lx|p)" .*; local (lx|p)why=""; answered \|\| \1why="\$\(infra /u.test(line)
      || /init\.tsv"$/u.test(line);
    if (!ok || /\bPASS\b/u.test(line)) out.push(`answered decides more than NOT TESTED: ${line.trim().slice(0, 90)}`);
  }
  for (const line of lines.filter((l) => /result\b.*\bPASS\b/u.test(l))) {
    if (/\b(answered|MT_RC|MT_ACTED|MT_PHASES|acted)\b/u.test(line)) out.push(`a PASS depends on a Maestro exit or log: ${line.trim().slice(0, 90)}`);
  }
  if (!/elif \[ "\$ok" = 0 \] && \[ "\$proven" = 1 \]; then result "\$c" 'NOT TESTED'/u.test(code)) out.push('landcase lets an unproven part decide more than NOT TESTED');
  // PO review 2: the step's exit status is recorded apart from the case verdicts
  if (!/^STEPS="\$OUT\/steps\.tsv"; printf 'step\\texit/mu.test(code.replace(/\\tflow/u, ''))) out.push('no steps.tsv header');
  if (!mt || !/>> "\$STEPS"/u.test(mt)) out.push('mt does not record its exit in steps.tsv');
  if (/\bresult\b/u.test(mt ?? '') || /STEPS/u.test(fnBody(code, 'result') ?? '')) out.push('the step record and the case verdicts are mixed');
  // PO review 4: a missing debug log has a recorded fallback
  if (abnormal && !(/-newer "\$d\/started\.marker"/u.test(abnormal) && /fallback-session=\$fb/u.test(abnormal) && /debug-log=/u.test(abnormal))) out.push('abnormal has no recorded fallback for an absent debug log');
  if (mt && !/: > "\$d\/started\.marker"/u.test(mt)) out.push('mt marks no start for the fallback');
  const enter = fnBody(code, 'enter');
  if (!enter || !/if \[ "\$MT_RC" != 1 \]; then\n\s*ENTER_WHY="INFRASTRUCTURE: the door step/u.test(enter)) out.push('a door that gave no answer is reported as "did not open"');
  if (/'NOT TESTED' 'the Personal Analysis did not open'/u.test(code)) out.push('a case hard-codes "the Personal Analysis did not open"');
  if (!/^\s*- uses: actions\/upload-artifact@v4\n\s*if: \$\{\{ always\(\) \}\}\n\s*with: \{name: 'ios-world-gate-/mu.test(shellCode(workflow))) {
    out.push('the evidence is not uploaded on cancel or timeout');
  }
  // PO review 5: the upload on cancellation is described as best-effort, never as guaranteed collection
  if (!/upload is ATTEMPTED[\s\S]{0,200}Best-effort only/u.test(workflow)) out.push('the upload on cancellation is not stated as best-effort');
  if (/from ['"](?!node:)/u.test(phases)) out.push('maestro-phases imports something other than Node');
  return out;
}

const sources = () => ({
  gate: read('scripts/cosmos-ios-world/run-world-gate.sh'),
  workflow: read('.github/workflows/cosmos-ios-world-gate.yml'),
  phases: read('scripts/cosmos-ios-world/maestro-phases.mjs'),
});

test('the gate keeps every abnormal step\'s evidence and never turns a step that gave no answer into FAIL', () => {
  assert.deepEqual(violations(sources()), []);
});

test('each static detector catches a planted defect', () => {
  const base = sources();
  const plant = (key, from, to) => {
    assert.ok(base[key].includes(from), `planted anchor missing: ${from}`);
    return violations({ ...base, [key]: base[key].replace(from, () => to) });
  };
  const cases = [
    ['gate', '--debug-output "$d" --flatten-debug-output', '', /debug folder/u],
    ['gate', '[ "$rc" = 0 ] || abnormal "$n" "$f" "$rc"', 'true', /abnormal exit keeps no evidence/u],
    ['gate', '--seconds 150 --label "$n"', '--seconds 300 --label "$n"', /unchanged 150 s|bounds changed/u],
    ['gate', 'say "  maestro $n ($f) exit $rc";', 'say "  maestro $n ($f) exit $rc"; [ "$rc" = 124 ] && retry;', /retries/u],
    ['gate', 'mt "$n-init" tap-point.yaml "P=$pt";', 'mt "$n-init" tap-point.yaml "P=$pt" || mt "$n-init2" tap-point.yaml "P=$pt";', /retries/u],
    ['gate', 'pkill -KILL -f "$HOME/.maestro/"', 'true', /surviving processes/u],
    ['gate', '|| [ "$MT_RC" = 1 ] ', '', /answered is not exactly/u],
    ['gate', '|| [ "${MT_ACTED:-}" = yes ]; }', '|| true; }', /answered is not exactly/u],
    ['gate', "  elif ! answered; then result \"$1\" 'NOT TESTED' \"the pan ($3): $(infra 'the unmoved camera')\"\n", '', /FAIL without a no-answer branch: after the pan/u],
    ['gate', 'if [ "$MT_RC" != 1 ]; then', 'if false; then', /door that gave no answer/u],
    ['gate', `result "$c" 'NOT TESTED' "$ENTER_WHY"`, `result "$c" 'NOT TESTED' 'the Personal Analysis did not open'`, /hard-codes/u],
    ['workflow', 'if: ${{ always() }}', 'if: ${{ !cancelled() }}', /cancel or timeout/u],
    ['workflow', 'Best-effort only', 'Guaranteed', /best-effort/u],
    ['gate', `    result "$1" PASS "tap at $3 opened the PEEK"`, `    answered && result "$1" PASS "tap at $3 opened the PEEK"`, /PASS depends on a Maestro exit/u],
    ['gate', `if backOn "$2"; then result "$1" PASS`, `if backOn "$2" || [ "$MT_RC" = 124 ]; then result "$1" PASS`, /PASS depends on a Maestro exit/u],
    ['gate', `  elif ! answered; then result S-FAR-TAP 'NOT TESTED'`, `  elif ! answered; then result S-FAR-TAP PASS`, /answered decides more than NOT TESTED/u],
    ['gate', `elif [ "$ok" = 0 ] && [ "$proven" = 1 ]; then result "$c" 'NOT TESTED'`, `elif [ "$ok" = 0 ] && [ "$proven" = 1 ]; then result "$c" PASS`, /landcase lets an unproven part/u],
    ['gate', `>> "$STEPS"`, `>> "$RES"`, /steps\.tsv/u],
    ['gate', `-newer "$d/started.marker"`, `-newer "$d"`, /fallback/u],
    ['phases', "import process from 'node:process';", "import process from 'node:process';\nimport x from 'yaml';", /imports/u],
  ];
  for (const [key, from, to, expected] of cases) {
    const v = plant(key, from, to);
    assert.ok(v.some((m) => expected.test(m)), `not caught: ${expected} — got ${JSON.stringify(v)}`);
  }
});
