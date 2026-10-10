// CI-01 C1-B — process-owned disposable PostgreSQL 17 cluster for the Synthetic Intelligence Reality
// Baseline (dev-only; never run by any CI workflow). Implements C1 Task Contract §0.3.
//
//   node scripts/ci-01/local-db.mjs run-baseline      start → prove → migrate → drive → stop (cleanup ALWAYS)
//   node scripts/ci-01/local-db.mjs start             start a cluster and print the state-file path
//   node scripts/ci-01/local-db.mjs prove <state>     re-run the identity / ownership proof
//   node scripts/ci-01/local-db.mjs stop  <state>     stop and remove ONLY a cluster this harness created
//   node scripts/ci-01/local-db.mjs drive <state> [results.json]
//                                                     drive an already-started cluster (development iteration; results
//                                                     default to a scratch path, never the committed results directory)
//
// Configuration (harness only — never a connection to anything that already exists):
//   QANDEEL_CI01_PG_BIN   directory holding initdb / pg_ctl / postgres of PostgreSQL 17 (required)
//   QANDEEL_CI01_ONLY     optional scenario filter forwarded to the driver
//
// Isolation rules enforced here, by code:
//   * inherited PG* / DATABASE_URL / SUPABASE_* / provider / proxy variables are deleted before anything
//     else runs; `.env` is never read (no environment-file flag); the pg client gets explicit host/port/db/user/password;
//   * the cluster is created by THIS process with `initdb` into a fresh mkdtemp directory, started with
//     `pg_ctl` on 127.0.0.1 and a port this process picked as free, with a random password;
//   * before any migration, and again before any stop/removal, a POSITIVE proof is required: the server
//     we are connected to reports our data directory, our port, 127.0.0.1, PostgreSQL 17, a fresh
//     postmaster start, no foreign databases, and reads back the harness marker (with this run's nonce)
//     from its own data directory; the driver repeats the proof before touching anything;
//   * no database is ever dropped; cleanup is `pg_ctl stop` + removal of the mkdtemp directory this
//     process created, and only after the file-level ownership checks pass;
//   * any failed proof is a STOP (non-zero exit), never a retry against another server.
import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const HARNESS = 'qandeel-ci-01-synthetic-intelligence-reality-baseline';
const MARKER_FILE = 'QANDEEL_CI01_HARNESS_MARKER.json';
const TMP_PREFIX = 'qandeel-ci01-';
const USER = 'postgres';

// ---------------------------------------------------------------------------------------------
// §0.3 rule 1 — inherited environment is deleted, never read.
// ---------------------------------------------------------------------------------------------
const SCRUB = /^(?:PG[A-Z0-9_]*|DATABASE_URL|SUPABASE_[A-Z0-9_]*|REDIS[A-Z0-9_]*|OPENAI_[A-Z0-9_]*|ANTHROPIC_[A-Z0-9_]*|GEMINI_[A-Z0-9_]*|GOOGLE_[A-Z0-9_]*|DEEPSEEK_[A-Z0-9_]*|[A-Za-z0-9_]*[Pp][Rr][Oo][Xx][Yy])$/u;
const scrubbedInheritedEnvNames = Object.keys(process.env).filter((name) => SCRUB.test(name)).sort();
for (const name of scrubbedInheritedEnvNames) delete process.env[name];

class StopError extends Error {
  constructor(message) { super(`QANDEEL_CI01_STOP: ${message}`); }
}
const log = (line) => console.log(`[ci-01 local-db] ${line}`);
const normalizePath = (p) => resolve(p).replaceAll('\\', '/').replace(/\/+$/u, '').toLowerCase();

function pgBinDirectory() {
  const dir = process.env.QANDEEL_CI01_PG_BIN;
  if (!dir) throw new StopError('QANDEEL_CI01_PG_BIN is not set (directory with initdb / pg_ctl / postgres of PostgreSQL 17)');
  const exe = (name) => join(dir, process.platform === 'win32' ? `${name}.exe` : name);
  for (const tool of ['initdb', 'pg_ctl', 'postgres']) {
    if (!existsSync(exe(tool))) throw new StopError(`${exe(tool)} not found`);
    const version = spawnSync(exe(tool), ['--version'], { encoding: 'utf8' });
    if (version.status !== 0 || !/\(PostgreSQL\) 17\./u.test(version.stdout)) {
      throw new StopError(`${tool} is not PostgreSQL 17: ${(version.stdout || version.stderr || '').trim()}`);
    }
  }
  const version = spawnSync(exe('postgres'), ['--version'], { encoding: 'utf8' }).stdout.trim();
  return { dir, exe, version };
}

function freeLoopbackPort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 1 << 26, ...options });
  if (result.status !== 0) {
    throw new StopError(`${command} ${args.join(' ')} exited ${result.status}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
  }
  return result;
}

function clientFor(state, database = state.database) {
  return new pg.Client({ host: '127.0.0.1', port: state.port, database, user: USER, password: state.password, connectionTimeoutMillis: 10_000 });
}

async function withClient(state, database, work) {
  const client = clientFor(state, database);
  await client.connect();
  try { return await work(client); } finally { await client.end(); }
}

// ---------------------------------------------------------------------------------------------
// §0.3 rule 2 — the positive identity / ownership proof. Exported shape is embedded in the results.
// ---------------------------------------------------------------------------------------------
export async function proveClusterIdentity(client, state, { expectDatabase, startedNotBefore }) {
  const [row] = (await client.query(`
    SELECT host(inet_server_addr()) AS addr, inet_server_port() AS port, current_database() AS database,
           version() AS version, current_setting('data_directory') AS data_directory,
           pg_postmaster_start_time() AS started_at, pg_backend_pid() AS backend_pid,
           (SELECT count(*)::int FROM pg_database WHERE datname NOT IN ('postgres', 'template0', 'template1') AND datname <> $1) AS foreign_databases,
           pg_read_file($2) AS marker
  `, [state.database, MARKER_FILE])).rows;
  const marker = JSON.parse(row.marker);
  const checks = {
    loopbackAddress: row.addr === '127.0.0.1',
    harnessPort: Number(row.port) === state.port,
    database: expectDatabase ? row.database === expectDatabase : row.database === 'postgres',
    postgres17: /^PostgreSQL 17\./u.test(row.version),
    dataDirectoryIsOurs: normalizePath(row.data_directory) === normalizePath(state.dataDir),
    markerNonceMatches: marker.nonce === state.nonce && marker.harness === HARNESS,
    markerPidIsThisHarness: marker.createdByPid === state.createdByPid,
    freshPostmaster: startedNotBefore ? new Date(row.started_at).getTime() >= startedNotBefore - 5_000 : true,
    noForeignDatabases: row.foreign_databases === 0,
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  const proof = {
    checkedAt: new Date().toISOString(), address: row.addr, port: Number(row.port), database: row.database, version: row.version,
    dataDirectory: row.data_directory, postmasterStartedAt: new Date(row.started_at).toISOString(), markerNonce: marker.nonce,
    foreignDatabases: row.foreign_databases, checks, passed: failed.length === 0,
  };
  if (failed.length > 0) throw new StopError(`cluster identity proof FAILED: ${failed.join(', ')} — ${JSON.stringify(proof)}`);
  return proof;
}

// File-level ownership: required before pg_ctl stop and before removing anything.
function proveFileOwnership(state) {
  const root = normalizePath(state.root);
  const tmp = normalizePath(tmpdir());
  const checks = {
    rootUnderTmp: root.startsWith(`${tmp}/${TMP_PREFIX}`),
    dataDirUnderRoot: normalizePath(state.dataDir).startsWith(`${root}/`),
    markerPresent: existsSync(join(state.dataDir, MARKER_FILE)),
    markerNonceMatches: false,
    pgVersionFileIs17: existsSync(join(state.dataDir, 'PG_VERSION')) && readFileSync(join(state.dataDir, 'PG_VERSION'), 'utf8').trim() === '17',
  };
  if (checks.markerPresent) {
    const marker = JSON.parse(readFileSync(join(state.dataDir, MARKER_FILE), 'utf8'));
    checks.markerNonceMatches = marker.nonce === state.nonce && marker.harness === HARNESS;
  }
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length > 0) throw new StopError(`file-level ownership proof FAILED: ${failed.join(', ')}`);
  return checks;
}

// ---------------------------------------------------------------------------------------------
// Lifecycle.
// ---------------------------------------------------------------------------------------------
async function start() {
  const bin = pgBinDirectory();
  const root = mkdtempSync(join(tmpdir(), TMP_PREFIX));
  const dataDir = join(root, 'pgdata');
  const nonce = randomUUID();
  const password = randomBytes(24).toString('hex');
  const passwordFile = join(root, 'pw.txt');
  writeFileSync(passwordFile, `${password}\n`);
  const startedNotBefore = Date.now();

  log(`initdb → ${dataDir}`);
  run(bin.exe('initdb'), ['-D', dataDir, '-U', USER, '--auth=scram-sha-256', `--pwfile=${passwordFile}`, '--encoding=UTF8', '--locale=C', '--no-sync'],
    { stdio: ['ignore', 'pipe', 'pipe'] });
  const marker = { harness: HARNESS, nonce, createdByPid: process.pid, createdAt: new Date().toISOString(), repository: REPO };
  writeFileSync(join(dataDir, MARKER_FILE), JSON.stringify(marker, null, 2));

  const port = await freeLoopbackPort();
  const database = `qandeel_ci01_${nonce.slice(0, 8)}`;
  const state = { harness: HARNESS, nonce, createdByPid: process.pid, root, dataDir, port, database, password, pgBin: bin.dir, pgVersion: bin.version,
    startedAt: new Date(startedNotBefore).toISOString(), scrubbedInheritedEnvNames };
  const stateFile = join(root, 'cluster.json');
  writeFileSync(stateFile, JSON.stringify(state, null, 2));

  log(`pg_ctl start on 127.0.0.1:${port}`);
  // stdio must be 'ignore': the postmaster inherits any pipe pg_ctl holds, and spawnSync would then wait
  // for an EOF that never comes. Diagnostics go to postgres.log inside the process-owned directory.
  run(bin.exe('pg_ctl'), ['-D', dataDir, '-w', '-t', '60', '-l', join(root, 'postgres.log'),
    '-o', `-p ${port} -c listen_addresses=127.0.0.1 -c max_connections=40 -c fsync=off -c synchronous_commit=off -c full_page_writes=off`, 'start'],
    { stdio: 'ignore' });

  try {
    const clusterProof = await withClient(state, 'postgres', (client) => proveClusterIdentity(client, state, { startedNotBefore }));
    log(`cluster proof PASSED (data_directory=${clusterProof.dataDirectory}, marker=${clusterProof.markerNonce.slice(0, 8)}…)`);
    await withClient(state, 'postgres', (client) => client.query(`CREATE DATABASE ${database}`));
    const databaseProof = await withClient(state, database, (client) => proveClusterIdentity(client, state, { expectDatabase: database, startedNotBefore }));
    state.proofs = { cluster: clusterProof, database: databaseProof };
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
  } catch (error) {
    // A failed proof is a STOP: the cluster this process started is torn down and nothing else is tried.
    await stop(state).catch((cleanupError) => log(`cleanup after failed start: ${cleanupError.message}`));
    throw error;
  }
  return { state, stateFile };
}

// Port of the 2026-10-09 recipe: Supabase-compatible bootstrap, then every migration from zero, each
// file sent as ONE batch (no psql needed; no migration uses a meta-command).
async function migrate(state) {
  const applied = [];
  await withClient(state, state.database, async (client) => {
    const bootstrap = readFileSync(join(REPO, 'database', 'supabase-compatible-bootstrap.sql'), 'utf8');
    await client.query(bootstrap);
    const dir = join(REPO, 'database', 'migrations');
    const files = readdirSync(dir).filter((file) => file.endsWith('.sql')).sort();
    for (const file of files) {
      const started = Date.now();
      try {
        await client.query(readFileSync(join(dir, file), 'utf8'));
      } catch (error) {
        throw new StopError(`migration ${file} failed: ${error.message}${error.where ? `\n  where: ${error.where}` : ''}`);
      }
      applied.push({ file, ms: Date.now() - started });
    }
    // Supabase grants service_role BYPASSRLS; the compatible bootstrap creates the role without it. The
    // 2026-10-09 recipe applied the same attribute so the server-only channel behaves as in production.
    await client.query('ALTER ROLE service_role BYPASSRLS');
  });
  log(`applied ${applied.length} migration(s); last ${applied.at(-1)?.file}`);
  return applied;
}

async function stop(state) {
  const bin = pgBinDirectory();
  const ownership = proveFileOwnership(state);
  // If the server still answers, require the live proof too, so we never stop a server that is not ours.
  try {
    await withClient(state, 'postgres', (client) => proveClusterIdentity(client, state, {}));
  } catch (error) {
    if (error instanceof StopError) throw error;
    log(`server not reachable for the live proof (${error.code ?? error.message}); file-level ownership proof holds — continuing cleanup`);
  }
  if (existsSync(join(state.dataDir, 'postmaster.pid'))) {
    log('pg_ctl stop');
    const result = spawnSync(bin.exe('pg_ctl'), ['-D', state.dataDir, '-m', 'fast', '-w', '-t', '60', 'stop'], { stdio: 'ignore' });
    if (result.status !== 0) log(`pg_ctl stop exited ${result.status} (see postgres.log before removal)`);
  }
  // Bounded to the mkdtemp directory this harness created — proven above. Windows may hold file handles
  // briefly after the postmaster exits, so the removal retries.
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try { rmSync(state.root, { recursive: true, force: true }); break; } catch (error) {
      if (attempt === 5) { log(`could not remove ${state.root}: ${error.message}`); break; }
      await new Promise((r) => setTimeout(r, 1_000 * attempt));
    }
  }
  log(`removed ${state.root}${existsSync(state.root) ? ' (INCOMPLETE — remove manually)' : ''}`);
  return ownership;
}

function git(args) {
  const result = spawnSync('git', args, { cwd: REPO, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function repositoryContext() {
  const head = git(['rev-parse', 'HEAD']);
  const originMain = git(['rev-parse', 'origin/main']);
  const baseline = originMain ? git(['merge-base', 'HEAD', 'origin/main']) : head;
  const productionDiff = spawnSync('git', ['diff', '--quiet', baseline, 'HEAD', '--', 'apps', 'database', 'packages'], { cwd: REPO });
  return {
    head, originMain, baselineMainSha: baseline, branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    workingTreeClean: git(['status', '--porcelain', '--untracked-files=no']) === '',
    productionTreeIdenticalToBaseline: productionDiff.status === 0,
  };
}

function writeContext(state, migrations) {
  const contextFile = join(state.root, 'context.json');
  writeFileSync(contextFile, JSON.stringify({
    repository: repositoryContext(), cluster: {
      pgVersion: state.pgVersion, pgBin: state.pgBin, port: state.port, database: state.database, dataDirectory: state.dataDir,
      markerNonce: state.nonce, startedAt: state.startedAt, proofs: state.proofs, scrubbedInheritedEnvNames: state.scrubbedInheritedEnvNames,
      migrationsApplied: migrations.length, lastMigration: migrations.at(-1)?.file, migrationMs: migrations.reduce((sum, m) => sum + m.ms, 0),
    },
  }, null, 2));
  return contextFile;
}

function drive(state, contextFile, resultsPath) {
  // The child gets an ALLOWLISTED environment: nothing inherited that could name another database or a
  // provider, plus the process-owned connection this harness created.
  const KEEP = ['PATH', 'Path', 'PATHEXT', 'SYSTEMROOT', 'SystemRoot', 'SYSTEMDRIVE', 'SystemDrive', 'COMSPEC', 'ComSpec', 'WINDIR', 'windir', 'TEMP', 'TMP',
    'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA', 'PROGRAMDATA', 'HOMEDRIVE', 'HOMEPATH', 'LANG', 'TZ'];
  const env = Object.fromEntries(KEEP.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]]));
  Object.assign(env, {
    TS_NODE_TRANSPILE_ONLY: 'true',
    QANDEEL_CI01_DB_HOST: '127.0.0.1', QANDEEL_CI01_DB_PORT: String(state.port), QANDEEL_CI01_DB_NAME: state.database,
    QANDEEL_CI01_DB_USER: USER, QANDEEL_CI01_DB_PASSWORD: state.password, QANDEEL_CI01_DATA_DIR: state.dataDir, QANDEEL_CI01_NONCE: state.nonce,
    QANDEEL_CI01_CREATED_BY_PID: String(state.createdByPid), QANDEEL_CI01_CONTEXT_FILE: contextFile, QANDEEL_CI01_RESULTS_PATH: resultsPath,
    QANDEEL_CI01_FIXTURES_DIR: join(HERE, 'fixtures'),
    ...(process.env.QANDEEL_CI01_ONLY ? { QANDEEL_CI01_ONLY: process.env.QANDEEL_CI01_ONLY } : {}),
  });
  log('driving scripts/ci-01/intelligence-reality.ts (network guard preloaded)');
  const child = spawnSync(process.execPath, [
    '--require', join(HERE, 'network-guard.cjs'),
    join(REPO, 'node_modules', 'ts-node', 'dist', 'bin.js'), '--project', join(REPO, 'apps', 'api', 'tsconfig.scripts.json'),
    join(HERE, 'intelligence-reality.ts'),
  ], { cwd: REPO, env, stdio: 'inherit', maxBuffer: 1 << 28 });
  const exitCode = child.status ?? 1;
  log(`driver exited ${exitCode}; results → ${resultsPath}`);
  return exitCode;
}

async function runBaseline() {
  const context = repositoryContext();
  if (!context.baselineMainSha) throw new StopError('cannot determine the baseline SHA (git unavailable?)');
  const started = Date.now();
  const { state, stateFile } = await start();
  let exitCode = 1;
  try {
    const migrations = await migrate(state);
    const contextFile = writeContext(state, migrations);
    exitCode = drive(state, contextFile, join(HERE, 'results', `${context.baselineMainSha}.json`));
  } finally {
    await stop(state);
    log(`total ${Math.round((Date.now() - started) / 1000)}s; state file was ${stateFile}`);
  }
  process.exit(exitCode);
}

const [command, argument] = process.argv.slice(2);
try {
  if (command === 'run-baseline') {
    await runBaseline();
  } else if (command === 'start') {
    const { state, stateFile } = await start();
    const migrations = await migrate(state);
    state.contextFile = writeContext(state, migrations);
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
    console.log(stateFile);
  } else if (command === 'drive' && argument) {
    const state = JSON.parse(readFileSync(argument, 'utf8'));
    proveFileOwnership(state);
    const resultsPath = process.argv[4] ?? join(state.root, 'results.json');
    process.exit(drive(state, state.contextFile, resultsPath));
  } else if (command === 'prove' && argument) {
    const state = JSON.parse(readFileSync(argument, 'utf8'));
    console.log(JSON.stringify({ files: proveFileOwnership(state), cluster: await withClient(state, 'postgres', (c) => proveClusterIdentity(c, state, {})) }, null, 2));
  } else if (command === 'stop' && argument) {
    await stop(JSON.parse(readFileSync(argument, 'utf8')));
  } else {
    console.error('usage: run-baseline | start | prove <state.json> | stop <state.json>');
    process.exit(2);
  }
} catch (error) {
  console.error(error instanceof StopError ? error.message : `QANDEEL_CI01_FATAL: ${error.stack ?? error}`);
  process.exit(1);
}
