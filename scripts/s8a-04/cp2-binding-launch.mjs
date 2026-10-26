// S8A-04 CP2 — operator launcher for the integrated proof of the placer binding (Controlled Amendment §7; guard round 20).
// Never a CI step.
//
//   node scripts/s8a-04/cp2-binding-launch.mjs --dry                 zero cost: the guard refuses the first call
//   node scripts/s8a-04/cp2-binding-launch.mjs --simulate=<tag>      zero cost: a local DeepSeek stand-in answers (every scenario)
//   node scripts/s8a-04/cp2-binding-launch.mjs --live                paid, inside guard round 20 (scenario A only); refused by the
//                                                                    guard while round 20 is locked (the Product Owner's budget gate)
//
// 1. A live run is refused unless nothing under apps/, database/, packages/ or scripts/s8a-04/ differs from HEAD, and the
//    per-user key file exists; a mode whose results file exists is refused (one run per mode and tag).
// 2. Starts a disposable PostgreSQL 17 with every migration (scripts/ci-01/local-db.mjs, unchanged).
// 3. Runs cp2-binding-proof.ts under scripts/s8a-02/network-guard.cjs with an allow-listed environment: the key (read from
//    the key file into the child only; never printed, logged or written), SYNTHETIC_ONLY and the database. --simulate
//    preloads the stand-ins BEFORE the guard and reads no key.
// 4. Stops and removes the cluster, always.
//
// Configuration: QANDEEL_EVAL_PG_BIN — the directory holding initdb / pg_ctl / postgres of PostgreSQL 17.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const ROUND = 20;
const REPORTS = join(REPO, '.s8a-04-reports', 'cp2-binding');
const log = (line) => console.log(`[s8a-04 cp2-binding launch] ${line}`);
const refuse = (why) => { console.error(`[s8a-04 cp2-binding launch] NOT RUN: ${why}; nothing was sent.`); process.exit(2); };

const args = process.argv.slice(2);
const flag = args[0] ?? '';
const simulateTag = /^--simulate=([a-z0-9-]{1,24})$/u.exec(flag);
if (args.length !== 1 || !(flag === '--dry' || flag === '--live' || simulateTag)) {
  console.error('usage: node scripts/s8a-04/cp2-binding-launch.mjs --dry | --simulate=<tag> | --live');
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

const resultsPath = join(REPORTS, 'results', `${mode}.json`);
if (!dry && existsSync(resultsPath)) refuse(`the ${mode} run already exists`);
const pgBin = process.env.QANDEEL_EVAL_PG_BIN;
if (!pgBin) refuse('QANDEEL_EVAL_PG_BIN is not set');
const spendState = join(REPO, 'artifacts', 'evals', 's8a-04-cp2-binding', live ? 'deepseek' : simulateTag ? `deepseek-simulated-${simulateTag[1]}` : 'deepseek-dry', 'spend-state.json');

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
if (started.status !== 0) { console.error(`[s8a-04 cp2-binding launch] local database did not start: ${(started.stderr || started.stdout).slice(-600)}`); process.exit(1); }
const stateFile = started.stdout.trim().split(/\r?\n/u).at(-1);
const state = JSON.parse(readFileSync(stateFile, 'utf8'));
log(`database ready on 127.0.0.1:${state.port} (${state.database}); head ${head}${underTest.length ? ' (+ uncommitted code under test)' : ''}; ${mode.toUpperCase()}`);

let code = 1;
try {
  const KEEP = ['PATH', 'Path', 'PATHEXT', 'SYSTEMROOT', 'SystemRoot', 'SYSTEMDRIVE', 'SystemDrive', 'COMSPEC', 'ComSpec', 'WINDIR', 'windir', 'TEMP', 'TMP',
    'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'HOMEDRIVE', 'HOMEPATH', 'LANG', 'TZ'];
  const env = Object.fromEntries(KEEP.filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]]));
  Object.assign(env, {
    NODE_ENV: 'development', TS_NODE_TRANSPILE_ONLY: 'true',
    DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: live ? key : 'sk-dry-run-placeholder-not-a-real-key-0000',
    // The refusal scenarios' hangs end on the adapters' own bounds; shortened for the zero-cost run only.
    ...(simulateTag ? { SHARED_SEMANTIC_READING_TIMEOUT_MS: '2000', SHARED_SPATIAL_PLACEMENT_TIMEOUT_MS: '2000' } : {}),
    QANDEEL_EVAL_LEDGER_DB_PORT: String(state.port), QANDEEL_EVAL_LEDGER_DB_NAME: state.database,
    QANDEEL_EVAL_LEDGER_DB_PASSWORD: state.password, QANDEEL_EVAL_LEDGER_DB_DATA_DIR: state.dataDir,
    QANDEEL_EVAL_ROUND: String(ROUND), QANDEEL_EVAL_SPEND_STATE: spendState, QANDEEL_EVAL_RUN_LABEL: `s8a04-cp2-binding-${mode}`, QANDEEL_EVAL_GIT_HEAD: head,
    QANDEEL_S8A04_RESULTS_PATH: resultsPath,
    ...(dry ? { QANDEEL_EVAL_DRY: '1' } : {}),
    // The zero-cost run spends nothing, so round 20's paid caps would only cut it short: the guard's declared simulated-cap
    // override (honoured in simulated mode alone) lifts them for it.
    ...(simulateTag ? { QANDEEL_EVAL_SIMULATE: '1', QANDEEL_EVAL_SIMULATED_CAPS: '400,1' } : {}),
  });
  key = '';
  const preload = simulateTag ? ['--require', join(REPO, 'scripts', 's8a-02', 'simulated-deepseek.cjs'), '--require', join(HERE, 'cp2-simulated.cjs')] : [];
  const child = spawnSync(process.execPath, [...preload, '--require', join(REPO, 'scripts', 's8a-02', 'network-guard.cjs'),
    join(REPO, 'node_modules', 'ts-node', 'dist', 'bin.js'), '--project', join(REPO, 'apps', 'api', 'tsconfig.json'),
    join(HERE, 'cp2-binding-proof.ts')], { cwd: REPO, env, stdio: 'inherit' });
  code = child.status ?? 1;
  log(`driver exited ${code}`);
} finally {
  const stopped = localDb(['stop', stateFile]);
  log(stopped.status === 0 ? 'database stopped and removed' : `cleanup failed: ${(stopped.stderr || stopped.stdout).slice(-300)}`);
}
process.exit(code);
