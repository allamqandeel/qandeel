// S8A-04 CP3 — operator launcher for the FREE integrated proof of Personal Knowledge in a Shared World (Controlled
// Amendment §8; Product Owner Final Implementation Authorization of 2026-10-25, §8; guard round 21). Never a CI step.
//
//   node scripts/s8a-04/cp3-launch.mjs --dry                 zero cost: the guard refuses the first call
//   node scripts/s8a-04/cp3-launch.mjs --simulate=<tag>      zero cost: local DeepSeek stand-ins answer every request
//
// There is no live mode: no paid call is authorized for CP3 before CP3-D's budget request, and round 21 has no paid
// allowance. A mode whose results file exists is refused (one run per tag).
//   1. Starts a disposable PostgreSQL 17 with every migration (scripts/ci-01/local-db.mjs, unchanged).
//   2. Runs cp3-proof.ts under scripts/s8a-02/network-guard.cjs with an allow-listed environment: SYNTHETIC_ONLY, a
//      placeholder key that is never sent anywhere (the stand-ins answer before the network), and the database.
//      --simulate preloads the stand-ins BEFORE the guard.
//   3. Stops and removes the cluster, always.
//
// Configuration: QANDEEL_EVAL_PG_BIN — the directory holding initdb / pg_ctl / postgres of PostgreSQL 17.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const ROUND = 21;
const REPORTS = join(REPO, '.s8a-04-reports', 'cp3');
const log = (line) => console.log(`[s8a-04 cp3 launch] ${line}`);
const refuse = (why) => { console.error(`[s8a-04 cp3 launch] NOT RUN: ${why}; nothing was sent.`); process.exit(2); };

const args = process.argv.slice(2);
const flag = args[0] ?? '';
const simulateTag = /^--simulate=([a-z0-9-]{1,24})$/u.exec(flag);
if (args.length !== 1 || !(flag === '--dry' || simulateTag)) {
  console.error('usage: node scripts/s8a-04/cp3-launch.mjs --dry | --simulate=<tag>');
  process.exit(2);
}
const dry = flag === '--dry';
const mode = dry ? 'dry' : `simulated-${simulateTag[1]}`;

const git = (gitArgs) => spawnSync('git', ['-C', REPO, ...gitArgs], { encoding: 'utf8' });
const head = git(['rev-parse', 'HEAD']).stdout.trim();
const resultsPath = join(REPORTS, 'results', `${mode}.json`);
if (!dry && existsSync(resultsPath)) refuse(`the ${mode} run already exists`);
const pgBin = process.env.QANDEEL_EVAL_PG_BIN;
if (!pgBin) refuse('QANDEEL_EVAL_PG_BIN is not set');
const spendState = join(REPO, 'artifacts', 'evals', 's8a-04-cp3', dry ? 'deepseek-dry' : `deepseek-simulated-${simulateTag[1]}`, 'spend-state.json');

const localDb = (dbArgs) => spawnSync(process.execPath, [join(REPO, 'scripts', 'ci-01', 'local-db.mjs'), ...dbArgs],
  { cwd: REPO, env: { ...process.env, QANDEEL_CI01_PG_BIN: pgBin }, encoding: 'utf8', maxBuffer: 1 << 26 });
const started = localDb(['start']);
if (started.status !== 0) { console.error(`[s8a-04 cp3 launch] local database did not start: ${(started.stderr || started.stdout).slice(-600)}`); process.exit(1); }
const stateFile = started.stdout.trim().split(/\r?\n/u).at(-1);
const state = JSON.parse(readFileSync(stateFile, 'utf8'));
log(`database ready on 127.0.0.1:${state.port} (${state.database}); head ${head}; ${mode.toUpperCase()}`);

let code = 1;
try {
  const KEEP = ['PATH', 'Path', 'PATHEXT', 'SYSTEMROOT', 'SystemRoot', 'SYSTEMDRIVE', 'SystemDrive', 'COMSPEC', 'ComSpec', 'WINDIR', 'windir', 'TEMP', 'TMP',
    'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'HOMEDRIVE', 'HOMEPATH', 'LANG', 'TZ'];
  const env = Object.fromEntries(KEEP.filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]]));
  Object.assign(env, {
    NODE_ENV: 'development', TS_NODE_TRANSPILE_ONLY: 'true',
    DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: 'sk-dry-run-placeholder-not-a-real-key-0000',
    SHARED_SEMANTIC_READING_TIMEOUT_MS: '2000', SHARED_SPATIAL_PLACEMENT_TIMEOUT_MS: '2000',
    QANDEEL_EVAL_LEDGER_DB_PORT: String(state.port), QANDEEL_EVAL_LEDGER_DB_NAME: state.database,
    QANDEEL_EVAL_LEDGER_DB_PASSWORD: state.password, QANDEEL_EVAL_LEDGER_DB_DATA_DIR: state.dataDir,
    QANDEEL_EVAL_ROUND: String(ROUND), QANDEEL_EVAL_SPEND_STATE: spendState, QANDEEL_EVAL_RUN_LABEL: `s8a04-cp3-${mode}`, QANDEEL_EVAL_GIT_HEAD: head,
    QANDEEL_S8A04_RESULTS_PATH: resultsPath,
    ...(dry ? { QANDEEL_EVAL_DRY: '1' } : { QANDEEL_EVAL_SIMULATE: '1', QANDEEL_EVAL_SIMULATED_CAPS: '600,1' }),
  });
  const preload = dry ? [] : ['--require', join(REPO, 'scripts', 's8a-02', 'simulated-deepseek.cjs'), '--require', join(HERE, 'cp2-simulated.cjs'),
    '--require', join(HERE, 'cp3-simulated.cjs')];
  const child = spawnSync(process.execPath, [...preload, '--require', join(REPO, 'scripts', 's8a-02', 'network-guard.cjs'),
    join(REPO, 'node_modules', 'ts-node', 'dist', 'bin.js'), '--project', join(REPO, 'apps', 'api', 'tsconfig.json'),
    join(HERE, 'cp3-proof.ts')], { cwd: REPO, env, stdio: 'inherit' });
  code = child.status ?? 1;
  log(`driver exited ${code}`);
} finally {
  const stopped = localDb(['stop', stateFile]);
  log(stopped.status === 0 ? 'database stopped and removed' : `cleanup failed: ${(stopped.stderr || stopped.stdout).slice(-300)}`);
}
process.exit(code);
