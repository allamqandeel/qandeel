// S8A-03 CP3 — operator launcher for the Focused Real-Model Memory Acceptance (Founder CP3 Final Preparation Approval,
// 2026-10-23). Never a CI step.
//
//   node scripts/s8a-03/cp3-launch.mjs --dry                 zero cost: the guard refuses every DeepSeek request
//   node scripts/s8a-03/cp3-launch.mjs --simulate=<tag>      zero cost: a local DeepSeek stand-in answers under the guard
//   node scripts/s8a-03/cp3-launch.mjs --live                the ONE paid run (refused while guard round 11 is locked)
//
// 1. Fixes the run to what was preregistered: the case file's canonical SHA-256 must be the one written in
//    .s8a-03-reports/cp3/PREREGISTRATION_CP3.md, and that file's own SHA-256 the one recorded beside it. A live run also
//    needs a clean tracked tree (the code under test is exactly a commit), the per-user key file, and an unused spend state.
// 2. Starts a disposable PostgreSQL 17 with every migration (scripts/ci-01/local-db.mjs, unchanged; its isolation proofs
//    apply), so the Memory path, the 0171 index and the AI-COST-01 ledger are the real schema.
// 3. Runs scripts/s8a-03/cp3-memory-acceptance.ts under scripts/s8a-02/network-guard.cjs (round 11: 41 attempts, USD 0.15,
//    cumulative in ONE spend-state file), with an allow-listed environment: the key (read from the key file into the child
//    only; never printed, logged or written), SYNTHETIC_ONLY, the ledger database, the case file and the preregistration.
//    --simulate preloads scripts/s8a-02/simulated-deepseek.cjs and scripts/s8a-03/simulated-capture.cjs BEFORE the guard,
//    reads no key, and keeps its own spend state per tag; QANDEEL_EVAL_SIMULATED_FAULTS / _LATENCY / _CAPS pass through to
//    the stub and the guard in this mode only.
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
const ROUND = 11;
const CASES = join(HERE, 'cp3-cases.json');
const PREREG = join(REPO, '.s8a-03-reports', 'cp3', 'PREREGISTRATION_CP3.md');
const PREREG_HASH = join(REPO, '.s8a-03-reports', 'cp3', 'PREREGISTRATION_CP3.sha256');
const log = (line) => console.log(`[s8a-03 cp3] ${line}`);
const refuse = (why) => { console.error(`[s8a-03 cp3] NOT RUN: ${why}; nothing was sent.`); process.exit(2); };
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
/** The case file's canonical hash: its parsed content, so a line-ending conversion on checkout cannot change it. */
const canonicalCasesSha256 = (text) => sha256(JSON.stringify(JSON.parse(text)));

const [flag, ...extra] = process.argv.slice(2);
const simulateTag = /^--simulate=([a-z0-9-]{1,24})$/u.exec(flag ?? '');
if (extra.length || !(flag === '--dry' || flag === '--live' || simulateTag)) {
  console.error('usage: node scripts/s8a-03/cp3-launch.mjs --dry | --simulate=<tag> | --live');
  process.exit(2);
}
const dry = flag === '--dry';
const live = flag === '--live';
const mode = dry ? 'dry' : live ? 'live' : `simulated-${simulateTag[1]}`;

const git = (args) => spawnSync('git', ['-C', REPO, ...args], { encoding: 'utf8' });
const dirty = git(['status', '--porcelain', '--untracked-files=no']).stdout.trim();
if (dirty && live) refuse('tracked changes are present; the code under test must be a commit');
const head = git(['rev-parse', 'HEAD']).stdout.trim();

const casesSha256 = canonicalCasesSha256(readFileSync(CASES, 'utf8'));
// A live run refuses anything but the preregistered pair; a zero-cost run reports the mismatch and proceeds unregistered.
let preregSha256 = null;
const unregistered = (why) => { if (live) refuse(why); log(`WARNING (zero-cost run, not a registered run): ${why}`); };
if (existsSync(PREREG) && existsSync(PREREG_HASH)) {
  const prereg = readFileSync(PREREG);
  preregSha256 = sha256(prereg);
  if (readFileSync(PREREG_HASH, 'ascii').trim().split(/\s+/u)[0] !== preregSha256) { unregistered('PREREGISTRATION_CP3.md differs from its recorded SHA-256'); preregSha256 = null; }
  else if (!prereg.toString('utf8').includes(casesSha256)) { unregistered(`the case file (canonical SHA-256 ${casesSha256}) is not the preregistered one`); preregSha256 = null; }
} else unregistered('the preregistration or its recorded SHA-256 is missing');

const pgBin = process.env.QANDEEL_EVAL_PG_BIN;
if (!pgBin) refuse('QANDEEL_EVAL_PG_BIN is not set');
const spendState = join(REPO, 'artifacts', 'evals', 's8a-03-cp3', live ? 'deepseek' : simulateTag ? `deepseek-simulated-${simulateTag[1]}` : 'deepseek-dry', 'spend-state.json');
// One paid run, never a second; a simulated tag is used once, so every simulated run starts from zero.
if (!dry && existsSync(spendState)) refuse(`${live ? 'the round 11 spend state already exists (one run only)' : `simulated tag ${simulateTag[1]} was already used`}`);

let key = '';
if (live) {
  const keyFile = join(homedir(), '.qandeel', 'deepseek-api-key.txt');
  if (!existsSync(keyFile)) refuse('the DeepSeek key file is missing');
  key = readFileSync(keyFile, 'ascii').trim();
  if (key.length < 20) refuse('the DeepSeek key file is empty or too short');
}

const localDb = (args) => spawnSync(process.execPath, [join(REPO, 'scripts', 'ci-01', 'local-db.mjs'), ...args],
  { cwd: REPO, env: { ...process.env, QANDEEL_CI01_PG_BIN: pgBin }, encoding: 'utf8', maxBuffer: 1 << 26 });
const started = localDb(['start']);
if (started.status !== 0) { console.error(`[s8a-03 cp3] local database did not start: ${(started.stderr || started.stdout).slice(-600)}`); process.exit(1); }
const stateFile = started.stdout.trim().split(/\r?\n/u).at(-1);
const state = JSON.parse(readFileSync(stateFile, 'utf8'));
log(`database ready on 127.0.0.1:${state.port} (${state.database}); head ${head}${dirty ? ' (+ uncommitted tracked changes)' : ''}; ${mode.toUpperCase()}; cases ${casesSha256.slice(0, 12)}…; prereg ${preregSha256 ? `${preregSha256.slice(0, 12)}…` : 'NOT RECORDED'}`);

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
    QANDEEL_EVAL_ROUND: String(ROUND), QANDEEL_EVAL_SPEND_STATE: spendState, QANDEEL_EVAL_RUN_LABEL: `cp3-${mode}`, QANDEEL_EVAL_GIT_HEAD: head,
    QANDEEL_CP3_CASES_FILE: CASES, QANDEEL_CP3_CASES_SHA256: casesSha256, ...(preregSha256 ? { QANDEEL_CP3_PREREG_SHA256: preregSha256 } : {}),
    QANDEEL_CP3_RESULTS_PATH: join(REPO, '.s8a-03-reports', 'cp3', 'results', `${mode}.json`),
    ...(dry ? { QANDEEL_EVAL_DRY: '1' } : {}),
    ...(simulateTag ? { QANDEEL_EVAL_SIMULATE: '1', ...Object.fromEntries(['QANDEEL_EVAL_SIMULATED_FAULTS', 'QANDEEL_EVAL_SIMULATED_LATENCY', 'QANDEEL_EVAL_SIMULATED_CAPS']
      .filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]])) } : {}),
  });
  key = '';
  const preload = simulateTag ? ['--require', join(REPO, 'scripts', 's8a-02', 'simulated-deepseek.cjs'), '--require', join(HERE, 'simulated-capture.cjs')] : [];
  const child = spawnSync(process.execPath, [...preload, '--require', join(REPO, 'scripts', 's8a-02', 'network-guard.cjs'),
    join(REPO, 'node_modules', 'ts-node', 'dist', 'bin.js'), '--project', join(REPO, 'apps', 'api', 'tsconfig.json'),
    join(HERE, 'cp3-memory-acceptance.ts')], { cwd: REPO, env, stdio: 'inherit' });
  code = child.status ?? 1;
  log(`driver exited ${code}`);
} finally {
  const stopped = localDb(['stop', stateFile]);
  log(stopped.status === 0 ? 'database stopped and removed' : `cleanup failed: ${(stopped.stderr || stopped.stdout).slice(-300)}`);
}
process.exit(code);
