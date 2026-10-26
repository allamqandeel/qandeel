// S8A-04 CP3-D V2 — operator launcher for the preregistered two-tier acceptance of Trusted Claim Spans (Controlled Amendment
// R4, §11.6; the Product Owner's D-7 gate, 2026-10-26). Never a CI step.
//
//   node scripts/s8a-04/cp3d-v2/launch.mjs --tier=1|2 --dry                zero cost: the guard refuses the first call
//   node scripts/s8a-04/cp3d-v2/launch.mjs --tier=1|2 --simulate=<tag>     zero cost: local DeepSeek stand-ins answer
//   node scripts/s8a-04/cp3d-v2/launch.mjs --tier=1|2 --live               paid: ONE run of that tier, inside its guard round
//
// Tier 1 runs in guard round 23, Tier 2 in round 24; each round has its own caps and spend-state file, and both are LOCKED
// (no live run) until the Product Owner approves its budget — lifting a lock is the single change the approval makes.
// A live run is refused unless: the cases / scenarios, the rubric and the policy have exactly the fingerprints recorded in
// PREREGISTRATION.md; nothing under apps/, database/, packages/, scripts/s8a-02/ or scripts/s8a-04/ differs from HEAD (the
// code under test and the harness are committed, so the run names one SHA); the per-user key file exists; that tier's live
// results and spend state do not exist (one paid run per tier; no retry); and, for Tier 2, Tier 1's live results exist and
// were ACCEPTED (if Tier 1 fails, nothing is spent on Tier 2).
// Steps: start a disposable PostgreSQL 17 with every migration (scripts/ci-01/local-db.mjs, unchanged); run the tier's driver
// under scripts/s8a-02/network-guard.cjs with an allow-listed environment (the key is read from the key file into the child
// only — never printed, logged or written; SYNTHETIC_ONLY; the database); stop and remove the cluster, always.
//
// Configuration: QANDEEL_EVAL_PG_BIN — the directory holding initdb / pg_ctl / postgres of PostgreSQL 17.
// Simulated only: QANDEEL_CP3D_V2_SIM=oracle|silent (Tier 1 stand-in), QANDEEL_EVAL_SIMULATED_FAULTS, QANDEEL_CP3D_V2_T2_ONLY.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const S8A04 = resolve(HERE, '..');
const REPORTS = join(REPO, '.s8a-04-reports', 'cp3d-v2');
const log = (line) => console.log(`[s8a-04 cp3d-v2 launch] ${line}`);
const refuse = (why) => { console.error(`[s8a-04 cp3d-v2 launch] NOT RUN: ${why}; nothing was sent.`); process.exit(2); };

const args = process.argv.slice(2);
const tierArg = /^--tier=([12])$/u.exec(args[0] ?? '');
const flag = args[1] ?? '';
const simulateTag = /^--simulate=([a-z0-9-]{1,24})$/u.exec(flag);
if (args.length !== 2 || !tierArg || !(flag === '--dry' || flag === '--live' || simulateTag)) {
  console.error('usage: node scripts/s8a-04/cp3d-v2/launch.mjs --tier=1|2 --dry | --simulate=<tag> | --live');
  process.exit(2);
}
const tier = Number(tierArg[1]);
const dry = flag === '--dry';
const live = flag === '--live';
const mode = dry ? 'dry' : live ? 'live' : `simulated-${simulateTag[1]}`;
const ROUND = tier === 1 ? 23 : 24;

// The preregistration: fixed before any paid call.
const sha = (path) => createHash('sha256').update(readFileSync(path, 'utf8'), 'utf8').digest('hex');
const prereg = readFileSync(join(HERE, 'PREREGISTRATION.md'), 'utf8');
const recorded = (label) => new RegExp(`^- \\*\\*${label}:\\*\\* \`([^\`]+)\`$`, 'mu').exec(prereg)?.[1];
const fixed = {
  tier1: recorded('Tier 1 cases SHA-256'), tier2: recorded('Tier 2 scenarios SHA-256'), rubric: recorded('Rater rubric SHA-256'), policy: recorded('Check policy'),
};
if (!fixed.tier1 || !fixed.tier2 || !fixed.rubric || !/^QANDEEL_S8A04_SHARED_DISCLOSURE_CHECK_V2:sha256:[0-9a-f]{64}$/u.test(fixed.policy ?? '')) {
  refuse('the preregistration does not record every fingerprint');
}
const setFile = join(HERE, tier === 1 ? 'tier1-cases.json' : 'tier2-scenarios.json');
if (sha(setFile) !== (tier === 1 ? fixed.tier1 : fixed.tier2)) refuse(`the Tier ${tier} set differs from the preregistered fingerprint`);
if (sha(join(HERE, 'RATER_RUBRIC.md')) !== fixed.rubric) refuse('the rater rubric differs from the preregistered fingerprint');

const git = (gitArgs) => spawnSync('git', ['-C', REPO, ...gitArgs], { encoding: 'utf8' });
const head = git(['rev-parse', 'HEAD']).stdout.trim();
const underTest = git(['status', '--porcelain', '--untracked-files=all', '--', 'apps', 'database', 'packages', 'scripts/s8a-02', 'scripts/s8a-04']).stdout.trim()
  .split(/\r?\n/u).filter((line) => line && !line.endsWith('apps/api/scripts/.probe.tmp.ts'));
if (underTest.length && live) refuse(`the code under test or the harness differs from HEAD (${underTest.length} path(s)); commit it first`);

const resultsPath = join(REPORTS, `tier${tier}`, `${mode}.json`);
if (!dry && existsSync(resultsPath)) refuse(`the Tier ${tier} ${mode} run already exists`);
const spendState = join(REPO, 'artifacts', 'evals', 's8a-04-cp3d-v2', `tier${tier}`, live ? 'deepseek' : simulateTag ? `deepseek-simulated-${simulateTag[1]}` : 'deepseek-dry', 'spend-state.json');
if (live && existsSync(spendState)) refuse(`round ${ROUND} has already been spent (one paid run per tier; a second needs a new approval)`);
if (live && tier === 2) {
  const tier1Live = join(REPORTS, 'tier1', 'live.json');
  if (!existsSync(tier1Live)) refuse('Tier 2 runs only after Tier 1\'s live run');
  if (JSON.parse(readFileSync(tier1Live, 'utf8')).accepted !== true) refuse('Tier 1 was not ACCEPTED: nothing is spent on Tier 2');
}
const pgBin = process.env.QANDEEL_EVAL_PG_BIN;
if (!pgBin) refuse('QANDEEL_EVAL_PG_BIN is not set');
const simMode = process.env.QANDEEL_CP3D_V2_SIM ?? 'oracle';
if (simulateTag && tier === 1 && !['oracle', 'silent'].includes(simMode)) refuse('QANDEEL_CP3D_V2_SIM must be oracle or silent');

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
if (started.status !== 0) { console.error(`[s8a-04 cp3d-v2 launch] local database did not start: ${(started.stderr || started.stdout).slice(-600)}`); process.exit(1); }
const stateFile = started.stdout.trim().split(/\r?\n/u).at(-1);
const state = JSON.parse(readFileSync(stateFile, 'utf8'));
log(`Tier ${tier}; database ready on 127.0.0.1:${state.port} (${state.database}); head ${head}${underTest.length ? ' (+ uncommitted code under test)' : ''}; ${mode.toUpperCase()}`);

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
    QANDEEL_EVAL_ROUND: String(ROUND), QANDEEL_EVAL_SPEND_STATE: spendState, QANDEEL_EVAL_RUN_LABEL: `s8a04-cp3d-v2-t${tier}-${mode}`, QANDEEL_EVAL_GIT_HEAD: head,
    QANDEEL_S8A04_RESULTS_PATH: resultsPath, QANDEEL_S8A04_V2_POLICY_REF: fixed.policy,
    ...(tier === 1 ? { QANDEEL_S8A04_V2_TIER1_SHA256: fixed.tier1 } : { QANDEEL_S8A04_V2_TIER2_SHA256: fixed.tier2 }),
    ...(dry ? { QANDEEL_EVAL_DRY: '1' } : {}),
    // A zero-cost run spends nothing, so a round's paid caps would only cut it short: the guard's declared simulated-cap
    // override (honoured in simulated mode alone) lifts them for it.
    ...(simulateTag ? {
      QANDEEL_EVAL_SIMULATE: '1', QANDEEL_EVAL_SIMULATED_CAPS: '1000,1', QANDEEL_CP3D_V2_SIM: simMode,
      ...(process.env.QANDEEL_EVAL_SIMULATED_FAULTS ? { QANDEEL_EVAL_SIMULATED_FAULTS: process.env.QANDEEL_EVAL_SIMULATED_FAULTS } : {}),
      ...(process.env.QANDEEL_CP3D_V2_T2_ONLY ? { QANDEEL_CP3D_V2_T2_ONLY: process.env.QANDEEL_CP3D_V2_T2_ONLY } : {}),
    } : {}),
    ...(tier === 2 ? { SHARED_SEMANTIC_READING_TIMEOUT_MS: '2000', SHARED_SPATIAL_PLACEMENT_TIMEOUT_MS: '2000' } : {}),
  });
  key = '';
  const preload = !simulateTag ? [] : tier === 1
    ? ['--require', join(REPO, 'scripts', 's8a-02', 'simulated-deepseek.cjs'), '--require', join(HERE, 'tier1-simulated.cjs')]
    : ['--require', join(REPO, 'scripts', 's8a-02', 'simulated-deepseek.cjs'), '--require', join(S8A04, 'cp2-simulated.cjs'), '--require', join(S8A04, 'cp3-simulated.cjs')];
  const child = spawnSync(process.execPath, [...preload, '--require', join(REPO, 'scripts', 's8a-02', 'network-guard.cjs'),
    join(REPO, 'node_modules', 'ts-node', 'dist', 'bin.js'), '--project', join(REPO, 'apps', 'api', 'tsconfig.json'),
    join(HERE, tier === 1 ? 'tier1-eval.ts' : 'tier2-e2e.ts')], { cwd: REPO, env, stdio: 'inherit' });
  code = child.status ?? 1;
  log(`driver exited ${code}`);
} finally {
  const stopped = localDb(['stop', stateFile]);
  log(stopped.status === 0 ? 'database stopped and removed' : `cleanup failed: ${(stopped.stderr || stopped.stdout).slice(-300)}`);
}
process.exit(code);
