// S8A-05 CP3 — operator launcher for the preregistered Tier S / Tier P evaluation of the Public semantic interpretation
// (Controlled Amendment A-4; PREREGISTRATION.md). Never a CI step.
//
//   node scripts/s8a-05/cp3/launch.mjs --dry                  zero cost: the guard refuses the first call
//   node scripts/s8a-05/cp3/launch.mjs --simulate=<tag>       zero cost: the local stand-in answers (QANDEEL_S8A05_TIER_S_SIM)
//   node scripts/s8a-05/cp3/launch.mjs --live                 paid: ONE run, inside guard round 25
//
// Round 25 is LOCKED (no live run) until the Product Owner approves its budget; lifting the lock is the single change the
// approval makes. A live run is refused unless: the cases, the rubric and the instructions have exactly the fingerprints
// recorded in PREREGISTRATION.md; nothing under apps/, database/, packages/, scripts/s8a-02/ or scripts/s8a-05/ differs from
// HEAD (the code under test and the harness are committed, so the run names one SHA); the per-user key file exists; and the
// live results and spend state do not exist (one paid run; no retry). Tier P makes no call: it is scored from the same run.
// The driver runs under scripts/s8a-02/network-guard.cjs with an allow-listed environment: the key is read from the key file
// into the child only — never printed, logged or written; SYNTHETIC_ONLY. No database is started: the ledger is in memory.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');
const REPORTS = join(REPO, '.s8a-05-reports', 'cp3');
const ROUND = 25;
const log = (line) => console.log(`[s8a-05 cp3 launch] ${line}`);
const refuse = (why) => { console.error(`[s8a-05 cp3 launch] NOT RUN: ${why}; nothing was sent.`); process.exit(2); };

const args = process.argv.slice(2);
const flag = args[0] ?? '';
const simulateTag = /^--simulate=([a-z0-9-]{1,24})$/u.exec(flag);
if (args.length !== 1 || !(flag === '--dry' || flag === '--live' || simulateTag)) {
  console.error('usage: node scripts/s8a-05/cp3/launch.mjs --dry | --simulate=<tag> | --live');
  process.exit(2);
}
const dry = flag === '--dry';
const live = flag === '--live';
const mode = dry ? 'dry' : live ? 'live' : `simulated-${simulateTag[1]}`;

// The preregistration: fixed before any paid call.
const sha = (path) => createHash('sha256').update(readFileSync(path, 'utf8'), 'utf8').digest('hex');
const prereg = readFileSync(join(HERE, 'PREREGISTRATION.md'), 'utf8');
const recorded = (label) => new RegExp(`^- \\*\\*${label}:\\*\\* \`([0-9a-f]{64})\`$`, 'mu').exec(prereg)?.[1];
const fixed = { cases: recorded('Cases SHA-256'), rubric: recorded('Rater rubric SHA-256'), instructions: recorded('Instructions SHA-256') };
if (!fixed.cases || !fixed.rubric || !fixed.instructions) refuse('the preregistration does not record every fingerprint');
if (sha(join(HERE, 'tier-s-cases.json')) !== fixed.cases) refuse('the cases differ from the preregistered fingerprint');
if (sha(join(HERE, 'RATER_RUBRIC.md')) !== fixed.rubric) refuse('the rater rubric differs from the preregistered fingerprint');

const git = (gitArgs) => spawnSync('git', ['-C', REPO, ...gitArgs], { encoding: 'utf8' });
const head = git(['rev-parse', 'HEAD']).stdout.trim();
const underTest = git(['status', '--porcelain', '--untracked-files=all', '--', 'apps', 'database', 'packages', 'scripts/s8a-02', 'scripts/s8a-05']).stdout.trim()
  .split(/\r?\n/u).filter((line) => line && !line.endsWith('apps/api/scripts/.probe.tmp.ts'));
if (underTest.length && live) refuse(`the code under test or the harness differs from HEAD (${underTest.length} path(s)); commit it first`);

const resultsPath = join(REPORTS, 'tier-s', `${mode}.json`);
if (!dry && existsSync(resultsPath)) refuse(`the ${mode} run already exists`);
const spendState = join(REPO, 'artifacts', 'evals', 's8a-05-cp3', live ? 'deepseek' : simulateTag ? `deepseek-simulated-${simulateTag[1]}` : 'deepseek-dry', 'spend-state.json');
if (live && existsSync(spendState)) refuse(`round ${ROUND} has already been spent (one paid run; a second needs a new approval)`);
const simMode = process.env.QANDEEL_S8A05_TIER_S_SIM ?? 'oracle';
if (simulateTag && !['oracle', 'lazy'].includes(simMode)) refuse('QANDEEL_S8A05_TIER_S_SIM must be oracle or lazy');

let key = '';
if (live) {
  const keyFile = join(homedir(), '.qandeel', 'deepseek-api-key.txt');
  if (!existsSync(keyFile)) refuse('the DeepSeek key file is missing');
  key = readFileSync(keyFile, 'ascii').trim();
  if (key.length < 20) refuse('the DeepSeek key file is empty or too short');
}
log(`head ${head}${underTest.length ? ' (+ uncommitted code under test)' : ''}; ${mode.toUpperCase()}; round ${ROUND}`);

const KEEP = ['PATH', 'Path', 'PATHEXT', 'SYSTEMROOT', 'SystemRoot', 'SYSTEMDRIVE', 'SystemDrive', 'COMSPEC', 'ComSpec', 'WINDIR', 'windir', 'TEMP', 'TMP',
  'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'HOMEDRIVE', 'HOMEPATH', 'LANG', 'TZ'];
const env = Object.fromEntries(KEEP.filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]]));
Object.assign(env, {
  NODE_ENV: 'development', TS_NODE_TRANSPILE_ONLY: 'true',
  DEEPSEEK_QUALIFICATION_MODE: 'SYNTHETIC_ONLY', DEEPSEEK_API_KEY: live ? key : 'sk-dry-run-placeholder-not-a-real-key-0000',
  QANDEEL_EVAL_ROUND: String(ROUND), QANDEEL_EVAL_SPEND_STATE: spendState, QANDEEL_EVAL_RUN_LABEL: `s8a05-cp3-tier-s-${mode}`, QANDEEL_EVAL_GIT_HEAD: head,
  QANDEEL_S8A05_RESULTS_PATH: resultsPath, QANDEEL_S8A05_TIER_S_SHA256: fixed.cases, QANDEEL_S8A05_INSTRUCTIONS_SHA256: fixed.instructions,
  ...(dry ? { QANDEEL_EVAL_DRY: '1' } : {}),
  // A zero-cost run spends nothing, so the round's paid caps would only cut it short: the guard's declared simulated-cap
  // override (honoured in simulated mode alone) lifts them for it.
  ...(simulateTag ? {
    QANDEEL_EVAL_SIMULATE: '1', QANDEEL_EVAL_SIMULATED_CAPS: '1000,1', QANDEEL_S8A05_TIER_S_SIM: simMode,
    ...(process.env.QANDEEL_EVAL_SIMULATED_FAULTS ? { QANDEEL_EVAL_SIMULATED_FAULTS: process.env.QANDEEL_EVAL_SIMULATED_FAULTS } : {}),
  } : {}),
});
key = '';
const preload = simulateTag
  ? ['--require', join(REPO, 'scripts', 's8a-02', 'simulated-deepseek.cjs'), '--require', join(HERE, 'tier-s-simulated.cjs')] : [];
const child = spawnSync(process.execPath, [...preload, '--require', join(REPO, 'scripts', 's8a-02', 'network-guard.cjs'),
  join(REPO, 'node_modules', 'ts-node', 'dist', 'bin.js'), '--project', join(REPO, 'apps', 'api', 'tsconfig.json'),
  join(HERE, 'tier-s-eval.ts')], { cwd: REPO, env, stdio: 'inherit' });
log(`driver exited ${child.status}`);
process.exit(child.status ?? 1);
