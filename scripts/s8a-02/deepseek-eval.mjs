// S8A-02 — operator launcher for the DeepSeek-only brain-eval run (Product Owner D3, 2026-10-21). Never a CI step.
//
//   node scripts/s8a-02/deepseek-eval.mjs baseline|candidate [--dry]
//
// 1. Refuses unless the tracked tree is clean (the guidance under test is exactly a commit), and records that commit.
// 2. Starts a disposable PostgreSQL 17 with every migration through `scripts/ci-01/local-db.mjs start` (unchanged; its
//    isolation proofs apply), so every DeepSeek call is written to the real AI-COST-01 ledger.
// 3. Runs `brain-eval.ts deepseek-run golden-conversations-extended <label>` under `scripts/s8a-02/network-guard.cjs`,
//    with an allow-listed environment: the DeepSeek key (read from the per-user key file into the child only; never
//    printed, logged or written), SYNTHETIC_ONLY, the ledger database and the cumulative spend-state file.
// 4. Stops and removes the cluster, always.
//
// `--dry` sends nothing (the guard refuses every DeepSeek request) and writes no spend state: a zero-cost wiring check.
//
// Configuration: QANDEEL_EVAL_PG_BIN — the directory holding initdb / pg_ctl / postgres of PostgreSQL 17.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const SUITE = 'golden-conversations-extended';
const [label, flag] = process.argv.slice(2);
if (!['baseline', 'candidate'].includes(label) || (flag !== undefined && flag !== '--dry')) {
  console.error('usage: node scripts/s8a-02/deepseek-eval.mjs baseline|candidate [--dry]');
  process.exit(2);
}
const dry = flag === '--dry';
const log = (line) => console.log(`[s8a-02] ${line}`);

const git = (args) => spawnSync('git', ['-C', REPO, ...args], { encoding: 'utf8' });
const dirty = git(['status', '--porcelain', '--untracked-files=no']).stdout.trim();
if (dirty) { console.error('[s8a-02] NOT RUN: tracked changes are present; the guidance under test must be a commit.'); process.exit(2); }
const head = git(['rev-parse', 'HEAD']).stdout.trim();

const pgBin = process.env.QANDEEL_EVAL_PG_BIN;
if (!pgBin) { console.error('[s8a-02] NOT RUN: QANDEEL_EVAL_PG_BIN is not set.'); process.exit(2); }

let key = '';
if (!dry) {
  const keyFile = join(homedir(), '.qandeel', 'deepseek-api-key.txt');
  if (!existsSync(keyFile)) { console.error('[s8a-02] NOT RUN: the DeepSeek key file is missing; nothing was sent.'); process.exit(2); }
  key = readFileSync(keyFile, 'ascii').trim();
  if (key.length < 20) { console.error('[s8a-02] NOT RUN: the DeepSeek key file is empty or too short; nothing was sent.'); process.exit(2); }
}

const localDb = (args) => spawnSync(process.execPath, [join(REPO, 'scripts', 'ci-01', 'local-db.mjs'), ...args],
  { cwd: REPO, env: { ...process.env, QANDEEL_CI01_PG_BIN: pgBin }, encoding: 'utf8', maxBuffer: 1 << 26 });
const started = localDb(['start']);
if (started.status !== 0) { console.error(`[s8a-02] local database did not start: ${(started.stderr || started.stdout).slice(-600)}`); process.exit(1); }
const stateFile = started.stdout.trim().split(/\r?\n/u).at(-1);
const state = JSON.parse(readFileSync(stateFile, 'utf8'));
log(`ledger database ready on 127.0.0.1:${state.port} (${state.database}); head ${head}`);

let code = 1;
try {
  const KEEP = ['PATH', 'Path', 'PATHEXT', 'SYSTEMROOT', 'SystemRoot', 'SYSTEMDRIVE', 'SystemDrive', 'COMSPEC', 'ComSpec', 'WINDIR', 'windir', 'TEMP', 'TMP',
    'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'HOMEDRIVE', 'HOMEPATH', 'LANG', 'TZ'];
  const env = Object.fromEntries(KEEP.filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]]));
  Object.assign(env, {
    NODE_ENV: 'development', TS_NODE_TRANSPILE_ONLY: 'true', QANDEEL_ALLOW_PAID_EVAL: '1',
    DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: dry ? 'sk-dry-run-placeholder-not-a-real-key-0000' : key,
    QANDEEL_EVAL_LEDGER_DB_PORT: String(state.port), QANDEEL_EVAL_LEDGER_DB_NAME: state.database,
    QANDEEL_EVAL_LEDGER_DB_PASSWORD: state.password, QANDEEL_EVAL_LEDGER_DB_DATA_DIR: state.dataDir,
    QANDEEL_EVAL_SPEND_STATE: join(REPO, 'artifacts', 'evals', SUITE, 'deepseek', 'spend-state.json'),
    QANDEEL_EVAL_RUN_LABEL: label, QANDEEL_EVAL_GIT_HEAD: head, ...(dry ? { QANDEEL_EVAL_DRY: '1' } : {}),
  });
  key = '';
  const child = spawnSync(process.execPath, ['--require', join(HERE, 'network-guard.cjs'),
    join(REPO, 'node_modules', 'ts-node', 'dist', 'bin.js'), '--project', join(REPO, 'apps', 'api', 'tsconfig.json'),
    join(REPO, 'apps', 'api', 'scripts', 'brain-eval.ts'), 'deepseek-run', SUITE, label], { cwd: REPO, env, stdio: 'inherit' });
  code = child.status ?? 1;
  log(`brain-eval exited ${code}`);
} finally {
  const stopped = localDb(['stop', stateFile]);
  log(stopped.status === 0 ? 'ledger database stopped and removed' : `cleanup failed: ${(stopped.stderr || stopped.stdout).slice(-300)}`);
}
process.exit(code);
