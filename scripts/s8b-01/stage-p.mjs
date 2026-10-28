// S8B-01 CP2 — Stage P launcher (operator-only; free; no provider).
//
//   QANDEEL_CI01_PG_BIN=<PostgreSQL 17 bin> node scripts/s8b-01/stage-p.mjs <runId>
//
// Reuses CI-01's process-owned disposable cluster (scripts/ci-01/local-db.mjs start → migrate; stop removes only what it
// created) and CI-01's network guard, then runs stage-p.ts against it. Results: artifacts/evals/s8b-01/stage-p/<runId>/
// (gitignored). Nothing here reads .env or connects to anything that already exists.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const runId = process.argv[2];
if (!/^[a-z0-9-]{3,64}$/u.test(runId ?? '')) { console.error('usage: stage-p.mjs <runId>'); process.exit(64); }
const runDir = join(REPO, 'artifacts', 'evals', 's8b-01', 'stage-p', runId);
if (existsSync(runDir)) { console.error(`S8B-01 stage-p: ${runId} has already run`); process.exit(3); }
const localDb = join(REPO, 'scripts', 'ci-01', 'local-db.mjs');

const started = spawnSync(process.execPath, [localDb, 'start'], { cwd: REPO, encoding: 'utf8', env: process.env, maxBuffer: 1 << 26 });
process.stderr.write(started.stderr ?? '');
const stateFile = (started.stdout ?? '').trim().split(/\r?\n/u).at(-1);
if (started.status !== 0 || !stateFile || !existsSync(stateFile)) { console.error(`S8B-01 stage-p: the cluster did not start\n${started.stdout}`); process.exit(1); }
const state = JSON.parse(readFileSync(stateFile, 'utf8'));
let code = 1;
try {
  const KEEP = ['PATH', 'Path', 'PATHEXT', 'SYSTEMROOT', 'SystemRoot', 'SYSTEMDRIVE', 'SystemDrive', 'COMSPEC', 'ComSpec', 'WINDIR', 'windir', 'TEMP', 'TMP',
    'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'HOMEDRIVE', 'HOMEPATH', 'LANG', 'TZ'];
  const env = Object.fromEntries(KEEP.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]]));
  Object.assign(env, {
    TS_NODE_TRANSPILE_ONLY: 'true', NODE_ENV: 'production',
    QANDEEL_CI01_DB_HOST: '127.0.0.1', QANDEEL_CI01_DB_PORT: String(state.port), QANDEEL_CI01_DB_NAME: state.database, QANDEEL_CI01_DB_USER: 'postgres',
    QANDEEL_CI01_DB_PASSWORD: state.password, QANDEEL_CI01_NONCE: state.nonce,
    S8B01_STAGE_P_PLAN: join(HERE, 'stage-p-plan.json'), S8B01_STAGE_P_RESULTS: join(runDir, 'results.json'),
  });
  const child = spawnSync(process.execPath, ['--require', join(REPO, 'scripts', 'ci-01', 'network-guard.cjs'),
    join(REPO, 'node_modules', 'ts-node', 'dist', 'bin.js'), '--project', join(REPO, 'apps', 'api', 'tsconfig.scripts.json'), join(HERE, 'stage-p.ts')],
  { cwd: REPO, env, stdio: 'inherit', maxBuffer: 1 << 28 });
  code = child.status ?? 1;
} finally {
  const stopped = spawnSync(process.execPath, [localDb, 'stop', stateFile], { cwd: REPO, encoding: 'utf8', env: process.env });
  console.log((stopped.stdout ?? '').trim());
}
console.log(`S8B-01 stage-p ${runId}: exit ${code}; results ${join(runDir, 'results.json')}`);
process.exit(code);
