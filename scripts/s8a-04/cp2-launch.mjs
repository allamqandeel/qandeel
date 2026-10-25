// S8A-04 CP2 — operator launcher for the paid stages of the Shared Social Memory Controlled Amendment §11 (guard round 19:
// 80 calls, USD 0.08 at peak in all; a ceiling, not a target). Never a CI step.
//
//   node scripts/s8a-04/cp2-launch.mjs --dry --stage=<stage>               zero cost: the guard refuses the first call
//   node scripts/s8a-04/cp2-launch.mjs --simulate=<tag> --stage=<stage>    zero cost: a local DeepSeek stand-in answers
//   node scripts/s8a-04/cp2-launch.mjs --live --stage=<stage>              paid, inside guard round 19
//
// Stages, in order (amendment §11): reading (14 calls, USD 0.010), placement (10, 0.006), recall (24, 0.035), integrated
// (32, 0.029). Every live stage spends from the SAME round-19 spend-state file; each stage runs live once, and only after
// the stage before it passed: its live results exist and the operator recorded its gate
// (.s8a-04-reports/cp2/gates/<stage>.passed, written by `cp2-blind.mjs gate` after the two blind ratings). The Product Owner
// approves the live runs.
//
// 1. A live run is refused unless nothing under apps/, database/, packages/ or scripts/s8a-04/ differs from HEAD (the code
//    under test is exactly a commit), and the per-user key file exists.
// 2. Starts a disposable PostgreSQL 17 with every migration (scripts/ci-01/local-db.mjs, unchanged), through 0175.
// 3. Runs cp2-driver.ts under scripts/s8a-02/network-guard.cjs with an allow-listed environment: the key (read from the key
//    file into the child only; never printed, logged or written), SYNTHETIC_ONLY, the database and the scenario files'
//    canonical SHA-256. --simulate preloads the stand-ins BEFORE the guard and reads no key.
// 4. Stops and removes the cluster, always.
//
// Configuration: QANDEEL_EVAL_PG_BIN — the directory holding initdb / pg_ctl / postgres of PostgreSQL 17.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const ROUND = 19;
const STAGES = ['reading', 'placement', 'recall', 'integrated'];
const SCENARIOS = join(HERE, 'cp2-scenarios.json');
const CP1_SCENARIOS = join(HERE, 'social-reading-scenarios.json');
const REPORTS = join(REPO, '.s8a-04-reports', 'cp2');
const log = (line) => console.log(`[s8a-04 cp2 launch] ${line}`);
const refuse = (why) => { console.error(`[s8a-04 cp2 launch] NOT RUN: ${why}; nothing was sent.`); process.exit(2); };

const args = process.argv.slice(2);
const flag = args[0] ?? '';
const stage = /^--stage=([a-z]+)$/u.exec(args[1] ?? '')?.[1];
const simulateTag = /^--simulate=([a-z0-9-]{1,24})$/u.exec(flag);
if (args.length !== 2 || !STAGES.includes(stage ?? '') || !(flag === '--dry' || flag === '--live' || simulateTag)) {
  console.error(`usage: node scripts/s8a-04/cp2-launch.mjs --dry | --simulate=<tag> | --live  --stage=${STAGES.join('|')}`);
  process.exit(2);
}
const dry = flag === '--dry';
const live = flag === '--live';
const mode = dry ? 'dry' : live ? 'live' : `simulated-${simulateTag[1]}`;

const git = (gitArgs) => spawnSync('git', ['-C', REPO, ...gitArgs], { encoding: 'utf8' });
const head = git(['rev-parse', 'HEAD']).stdout.trim();
const underTest = git(['status', '--porcelain', '--untracked-files=all', '--', 'apps', 'database', 'packages', 'scripts/s8a-04']).stdout.trim()
  .split(/\r?\n/u).filter((line) => line && !line.endsWith('apps/api/scripts/.probe.tmp.ts'));
if (underTest.length && live) refuse(`the code under test differs from HEAD (${underTest.length} path(s)); commit it first`);

const resultsPath = join(REPORTS, 'results', `${mode}-${stage}.json`);
if (!dry && existsSync(resultsPath)) refuse(`stage ${stage} already ran in ${mode} mode`);
if (live) {
  const previous = STAGES[STAGES.indexOf(stage) - 1];
  if (previous && !existsSync(join(REPORTS, 'results', `live-${previous}.json`))) refuse(`stage ${previous} has not run live`);
  if (previous && !existsSync(join(REPORTS, 'gates', `${previous}.passed`))) refuse(`stage ${previous} has no recorded passing gate`);
}

const canonical = (path) => createHash('sha256').update(JSON.stringify(JSON.parse(readFileSync(path, 'utf8')))).digest('hex');
const scenariosSha256 = canonical(SCENARIOS);
const cp1ScenariosSha256 = canonical(CP1_SCENARIOS);
const pgBin = process.env.QANDEEL_EVAL_PG_BIN;
if (!pgBin) refuse('QANDEEL_EVAL_PG_BIN is not set');
const spendState = join(REPO, 'artifacts', 'evals', 's8a-04-cp2', live ? 'deepseek' : simulateTag ? `deepseek-simulated-${simulateTag[1]}` : 'deepseek-dry', 'spend-state.json');

let key = '';
if (live) {
  const keyFile = join(homedir(), '.qandeel', 'deepseek-api-key.txt');
  if (!existsSync(keyFile)) refuse('the DeepSeek key file is missing');
  key = readFileSync(keyFile, 'ascii').trim();
  if (key.length < 20) refuse('the DeepSeek key file is empty or too short');
}

const localDb = (dbArgs) => spawnSync(process.execPath, [join(REPO, 'scripts', 'ci-01', 'local-db.mjs'), ...dbArgs],
  { cwd: REPO, env: { ...process.env, QANDEEL_CI01_PG_BIN: pgBin }, encoding: 'utf8', maxBuffer: 1 << 26 });
const started = localDb(['start']);
if (started.status !== 0) { console.error(`[s8a-04 cp2 launch] local database did not start: ${(started.stderr || started.stdout).slice(-600)}`); process.exit(1); }
const stateFile = started.stdout.trim().split(/\r?\n/u).at(-1);
const state = JSON.parse(readFileSync(stateFile, 'utf8'));
log(`database ready on 127.0.0.1:${state.port} (${state.database}); head ${head}${underTest.length ? ' (+ uncommitted code under test)' : ''}; ${mode.toUpperCase()} stage ${stage}; scenarios ${scenariosSha256.slice(0, 12)}…`);

let code = 1;
try {
  const KEEP = ['PATH', 'Path', 'PATHEXT', 'SYSTEMROOT', 'SystemRoot', 'SYSTEMDRIVE', 'SystemDrive', 'COMSPEC', 'ComSpec', 'WINDIR', 'windir', 'TEMP', 'TMP',
    'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'HOMEDRIVE', 'HOMEPATH', 'LANG', 'TZ'];
  const env = Object.fromEntries(KEEP.filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]]));
  Object.assign(env, {
    NODE_ENV: 'development', TS_NODE_TRANSPILE_ONLY: 'true',
    DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: live ? key : 'sk-dry-run-placeholder-not-a-real-key-0000',
    QANDEEL_EVAL_LEDGER_DB_PORT: String(state.port), QANDEEL_EVAL_LEDGER_DB_NAME: state.database,
    QANDEEL_EVAL_LEDGER_DB_PASSWORD: state.password, QANDEEL_EVAL_LEDGER_DB_DATA_DIR: state.dataDir,
    QANDEEL_EVAL_ROUND: String(ROUND), QANDEEL_EVAL_SPEND_STATE: spendState, QANDEEL_EVAL_RUN_LABEL: `s8a04-cp2-${mode}-${stage}`, QANDEEL_EVAL_GIT_HEAD: head,
    QANDEEL_S8A04_STAGE: stage, QANDEEL_S8A04_SCENARIOS_FILE: SCENARIOS, QANDEEL_S8A04_SCENARIOS_SHA256: scenariosSha256,
    QANDEEL_S8A04_CP1_SCENARIOS_FILE: CP1_SCENARIOS, QANDEEL_S8A04_CP1_SCENARIOS_SHA256: cp1ScenariosSha256, QANDEEL_S8A04_RESULTS_PATH: resultsPath,
    ...(process.env.QANDEEL_S8A04_DEBUG === '1' ? { QANDEEL_S8A04_DEBUG: '1' } : {}),
    ...(dry ? { QANDEEL_EVAL_DRY: '1' } : {}),
    ...(simulateTag ? { QANDEEL_EVAL_SIMULATE: '1', ...Object.fromEntries(['QANDEEL_EVAL_SIMULATED_FAULTS', 'QANDEEL_EVAL_SIMULATED_LATENCY', 'QANDEEL_EVAL_SIMULATED_CAPS']
      .filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]])) } : {}),
  });
  key = '';
  const preload = simulateTag ? ['--require', join(REPO, 'scripts', 's8a-02', 'simulated-deepseek.cjs'), '--require', join(HERE, 'cp2-simulated.cjs')] : [];
  const child = spawnSync(process.execPath, [...preload, '--require', join(REPO, 'scripts', 's8a-02', 'network-guard.cjs'),
    join(REPO, 'node_modules', 'ts-node', 'dist', 'bin.js'), '--project', join(REPO, 'apps', 'api', 'tsconfig.json'),
    join(HERE, 'cp2-driver.ts')], { cwd: REPO, env, stdio: 'inherit' });
  code = child.status ?? 1;
  log(`driver exited ${code}`);
} finally {
  const stopped = localDb(['stop', stateFile]);
  log(stopped.status === 0 ? 'database stopped and removed' : `cleanup failed: ${(stopped.stderr || stopped.stdout).slice(-300)}`);
}
process.exit(code);
