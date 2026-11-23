/**
 * S8B-07 RB-2 / S2 (Alternative A, PO direction D-S2-12; execution scope v1.2 §3) - the real-PostgreSQL proofs of the
 * bounded semantic commit sweeper: A-03 - A-14 (A-01 / A-02 / A-09's static half are the Jest spec and the static
 * contract). S1's proofs (verify-migration-0201.mjs: B-05..B-08, L-01..L-04, D-06..D-11) are reused, not repeated.
 *
 * The REAL worker and repository run against a REAL local PostgreSQL through a PostgREST stand-in (a bounded pg pool that
 * calls the same definers as service_role, one transaction per call, with PostgREST's error identity), exactly as the CP3
 * harness does. A-13 runs the S8B-05 CP3 live-call harness UNCHANGED, with and without a sweeper process beside it.
 *
 * Isolation: a FRESH template database is built from the bootstrap and every migration (so no shared-CI residue can be
 * in it), and every proof runs in its own clone of it, dropped afterwards. The database DATABASE_URL names is never
 * written: its PENDING ledger rows are counted and reported, never drained. Loopback only.
 *
 * Timing figures are DIAGNOSTICS (local machine, shared CPU); the authority is the database's own state. Sections:
 * RB2_S2_ONLY=A-03,A-10 runs a subset (development only; a subset is never the S2 result). RB2_S2_REPS (>= 3) sets A-13's
 * repetitions; RB2_S2_REPORT names the JSON report.
 *
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55460/qandeel_s2 \
 *     node node_modules/ts-node/dist/bin.js --transpile-only --project apps/api/tsconfig.scripts.json \
 *     apps/api/scripts/rb2-s2-semantic-commit-sweeper-proof.ts
 */
import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataApiError } from '../src/conversation/supabase-data-api.service';
import type { SupabaseServiceRoleApiService } from '../src/conversation/supabase-service-role-api.service';
import { DatabaseBackgroundPermitGate, type BackgroundPermit } from '../src/live-analysis/background-permits';
import { ConversationSemanticRuntimeRepository } from '../src/live-focus/conversation-semantic-runtime.repository';
import {
  BACKGROUND_PRESSURE_HOLD_MS,
  BackgroundPermitPressure,
  SEMANTIC_COMMIT_SWEEP_DEFAULTS,
  SEMANTIC_COMMIT_SWEEP_DETECTORS,
  SemanticCommitSweeperWorker,
  type SemanticCommitSweepConfig,
  type SemanticCommitSweepTick,
} from '../src/live-focus/semantic-commit-sweeper.worker';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client, Pool } = require('pg') as { Client: new (c: object) => PgClient; Pool: new (c: object) => PgPool };
interface PgResult { rows: Array<Record<string, unknown>> }
interface PgClient { connect(): Promise<void>; query(text: string, values?: unknown[]): Promise<PgResult>; end(): Promise<void>; release?(): void }
interface PgPool { connect(): Promise<PgClient & { release(): void }>; query(text: string, values?: unknown[]): Promise<PgResult>; end(): Promise<void> }

const ROOT = resolve(__dirname, '../../..');
const LEDGER = 'public.session_semantic_commit_instants';
const SWEEPER = 'server_observe_unobserved_semantic_commits_v1';
const OBSERVER = 'server_observe_session_semantic_commits_v1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now();
const ONLY = new Set((process.env.RB2_S2_ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean));
const REPS = Math.max(3, Number(process.env.RB2_S2_REPS ?? 3));

// ------------------------------------------------------------------ the database and its isolation
function loopback(): URL {
  const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid');
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname)) throw new Error('RB2_S2_PROOF_REFUSED: DATABASE_URL must name a loopback database');
  return url;
}
const BASE = loopback();
const urlOf = (db: string) => { const u = new URL(BASE.toString()); u.pathname = `/${db}`; return u.toString(); };
const SHARED_DB = BASE.pathname.replace(/^\//u, '');
const TEMPLATE = `rb2s2_tpl_${process.pid}`;

async function client(db: string, app = 'rb2s2-owner'): Promise<PgClient> {
  const c = new Client({ connectionString: urlOf(db), application_name: app });
  // A forced drop of a proof's database ends its connections: that must end the section, never the process.
  (c as unknown as { on(e: string, f: () => void): void }).on('error', () => undefined);
  await c.connect();
  return c;
}
async function admin<T>(work: (c: PgClient) => Promise<T>): Promise<T> {
  const c = await client('postgres', 'rb2s2-admin');
  try { return await work(c); } finally { await c.end(); }
}

/** The template: the bootstrap (roles are cluster-wide and already exist) and every migration, nothing else. */
async function buildTemplate(): Promise<{ migrations: number; last: string; ms: number }> {
  const t0 = now();
  await admin(async (a) => { await a.query(`DROP DATABASE IF EXISTS ${TEMPLATE} WITH (FORCE)`); await a.query(`CREATE DATABASE ${TEMPLATE}`); });
  const c = await client(TEMPLATE);
  try {
    let bootstrap = readFileSync(join(ROOT, 'database/supabase-compatible-bootstrap.sql'), 'utf8');
    for (const role of ['anon', 'authenticated', 'service_role']) {
      const exists = (await c.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [role])).rows.length > 0;
      if (exists) bootstrap = bootstrap.replace(`CREATE ROLE ${role} NOLOGIN;`, '');
    }
    await c.query(bootstrap);
    const files = readdirSync(join(ROOT, 'database/migrations')).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) await c.query(readFileSync(join(ROOT, 'database/migrations', f), 'utf8'));
    const [{ n }] = (await c.query(`SELECT count(*)::int AS n FROM ${LEDGER}`)).rows as Array<{ n: number }>;
    assert.equal(n, 0, 'the template holds no ledger row');
    return { migrations: files.length, last: files.at(-1) ?? '', ms: Math.round(now() - t0) };
  } finally {
    await c.end();
  }
}

/** One proof, one database: a clone of the template, with only this proof's fixtures, dropped afterwards. */
async function isolated<T>(label: string, work: (db: string) => Promise<T>): Promise<T> {
  const db = `rb2s2_${label.toLowerCase().replace(/[^a-z0-9]+/gu, '_')}_${process.pid}`;
  await admin(async (a) => { await a.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`); await a.query(`CREATE DATABASE ${db} TEMPLATE ${TEMPLATE}`); });
  try {
    const o = await client(db);
    const [{ n }] = (await o.query(`SELECT count(*)::int AS n FROM ${LEDGER}`)).rows as Array<{ n: number }>;
    await o.end();
    assert.equal(n, 0, `${label}: its database starts with no ledger row`);
    return await work(db);
  } finally {
    await admin((a) => a.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`));
  }
}

// ------------------------------------------------------------------ the PostgREST stand-in (service_role, bounded pool)
const SCALAR = new Set([SWEEPER, OBSERVER, 's2_planted_sweep_no_skip_v1']);
function postgrestError(error: { code?: string; message?: string }): DataApiError {
  const code = error.code ?? '';
  const status = code === '42883' ? 404 : code === '42501' ? 403 : code.startsWith('22') ? 400 : code === '40001' ? 409 : 500;
  return new DataApiError(status, { databaseCode: code === '42883' ? 'PGRST202' : code, databaseMessage: error.message });
}
class RpcShim implements Pick<SupabaseServiceRoleApiService, 'rpc'> {
  readonly pool: PgPool;
  readonly waits: Record<string, number[]> = {};
  readonly latencies: Record<string, number[]> = {};
  inFlight = 0;
  maxInFlight = 0;

  constructor(db: string, max: number, app: string) {
    this.pool = new Pool({ connectionString: urlOf(db), max, application_name: app });
    (this.pool as unknown as { on(e: string, f: () => void): void }).on('error', () => undefined);
  }

  async rpc<T>(name: string, body: Record<string, unknown>, options: { readonly timeoutMs?: number } = {}): Promise<T> {
    const started = now();
    const c = await this.pool.connect();
    (this.waits[name] ??= []).push(now() - started);
    this.inFlight += 1;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    const keys = Object.keys(body);
    const args = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
    const sql = SCALAR.has(name) ? `SELECT public.${name}(${args}) AS r` : `SELECT * FROM public.${name}(${args})`;
    const work = (async () => {
      try {
        await c.query('BEGIN');
        await c.query('SET LOCAL ROLE service_role');
        const res = await c.query(sql, keys.map((k) => body[k]));
        await c.query('COMMIT');
        return (SCALAR.has(name) ? res.rows[0]?.r : res.rows) as T;
      } catch (error) {
        await c.query('ROLLBACK').catch(() => undefined);
        throw postgrestError(error as { code?: string; message?: string });
      } finally {
        c.release();
        this.inFlight -= 1;
        (this.latencies[name] ??= []).push(now() - started);
      }
    })();
    // A client timeout ends the wait, never the statement (as an aborted fetch does not cancel PostgREST's statement).
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })), options.timeoutMs ?? 5_000);
    });
    try {
      return await Promise.race([work, timeout]);
    } finally {
      clearTimeout(timer);
      work.catch(() => undefined);
    }
  }

  end(): Promise<void> { return this.pool.end(); }
}

// ------------------------------------------------------------------ fixtures (owner role, inside the proof's own database)
interface Fixture { readonly users: string[]; readonly sessions: string[] }
/** `sessions` Sessions of `rows` committed semantic transactions each: the origin clock move, then `rows - 1` same-SP events. */
async function seed(o: PgClient, sessions: number, rows: number): Promise<Fixture> {
  const out: Fixture = { users: [], sessions: [] };
  for (let i = 0; i < sessions; i += 1) {
    const user = randomUUID();
    const session = randomUUID();
    await o.query('INSERT INTO auth.users (id) VALUES ($1)', [user]);
    await o.query("INSERT INTO public.conversation_sessions (id, user_id, status, channel) VALUES ($1, $2, 'ACTIVE', 'TEXT')", [session, user]);
    await o.query('UPDATE public.session_semantic_clocks SET current_sp = 1 WHERE session_id = $1', [session]);
    if (rows > 1) await commits(o, session, user, rows - 1);
    out.users.push(user);
    out.sessions.push(session);
  }
  return out;
}
/** `n` more committed transactions on one Session, each its own (COMMIT inside the loop: one ledger row each). */
async function commits(o: PgClient, session: string, user: string, n: number): Promise<void> {
  await o.query(`DO $$ BEGIN FOR i IN 1..${Math.floor(n)} LOOP PERFORM public.reserve_session_same_sp_event_v1('${session}', '${user}'); COMMIT; END LOOP; END $$`);
}
async function ledger(o: PgClient): Promise<{ total: number; pending: number; stamped: number }> {
  const [r] = (await o.query(`SELECT count(*)::int AS total, count(*) FILTER (WHERE observed_at IS NULL)::int AS pending,
      count(*) FILTER (WHERE observed_at IS NOT NULL)::int AS stamped FROM ${LEDGER}`)).rows as Array<{ total: number; pending: number; stamped: number }>;
  return r;
}
async function wal(o: PgClient): Promise<string> {
  return String((await o.query('SELECT pg_current_wal_lsn()::text AS l')).rows[0].l);
}
async function walBytes(o: PgClient, from: string): Promise<number> {
  return Number((await o.query('SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), $1::pg_lsn)::bigint AS b', [from])).rows[0].b);
}

// ------------------------------------------------------------------ the real worker, instrumented
const BASE_CONFIG: SemanticCommitSweepConfig = { enabled: true, misconfigured: false, ...SEMANTIC_COMMIT_SWEEP_DEFAULTS, detectors: SEMANTIC_COMMIT_SWEEP_DETECTORS };
interface Instrumented {
  readonly worker: SemanticCommitSweeperWorker;
  readonly statements: Array<{ ms: number; rows: number }>;
  /** Statements that failed (timeout, transport), with how long each took: never counted as a measured statement. */
  readonly failures: number[];
  readonly signals: string[];
  readonly ticks: SemanticCommitSweepTick[];
  tick(): Promise<SemanticCommitSweepTick | null>;
}
function sweeper(shim: RpcShim, config: Partial<SemanticCommitSweepConfig> = {}, pressure: { pressing(): boolean } = { pressing: () => false },
  boundary?: { sweepUnobservedSemanticCommits(limit: number, timeoutMs: number): Promise<number> }): Instrumented {
  const repository = boundary ?? new ConversationSemanticRuntimeRepository(shim as unknown as SupabaseServiceRoleApiService);
  const statements: Array<{ ms: number; rows: number }> = [];
  const failures: number[] = [];
  const signals: string[] = [];
  const ticks: SemanticCommitSweepTick[] = [];
  const timed = {
    sweepUnobservedSemanticCommits: async (limit: number, timeoutMs: number) => {
      const t0 = now();
      let rows: number;
      try {
        rows = await repository.sweepUnobservedSemanticCommits(limit, timeoutMs);
      } catch (error) {
        failures.push(now() - t0);
        throw error;
      }
      statements.push({ ms: now() - t0, rows });
      return rows;
    },
  };
  const worker = new SemanticCommitSweeperWorker(timed, { recordOperationalOutcome: (_d: string, op: string, out: string) => { signals.push(`${op}:${out}`); } },
    pressure, { ...BASE_CONFIG, ...config });
  return {
    worker, statements, failures, signals, ticks,
    tick: async () => { const t = await worker.runOnce(); if (t) ticks.push(t); return t; },
  };
}

// ------------------------------------------------------------------ measurement helpers
const pct = (values: number[], p: number) => {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))] * 10) / 10;
};
const dist = (values: number[]) => ({ n: values.length, p50: pct(values, 50), p95: pct(values, 95), p99: pct(values, 99), p999: pct(values, 99.9), max: pct(values, 100) });
const median = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

/**
 * Samples, every `everyMs`, each heavyweight lock wait in the database: who waits, on whom (by application_name) and for
 * what kind of lock. A ROW lock wait is a `tuple` or `transactionid` lock; a relation-extension wait (`extend`, two
 * statements growing the same table) is not a row lock and is reported apart.
 */
const ROW_LOCKS = new Set(['tuple', 'transactionid']);
function lockSampler(db: string, everyMs = 5) {
  const waits: Array<{ waiter: string; blocker: string; locktype: string }> = [];
  let samples = 0;
  let running = true;
  const loop = (async () => {
    const c = await client(db, 'rb2s2-sampler');
    try {
      while (running) {
        const r = await c.query(`SELECT a.application_name AS waiter, b.application_name AS blocker,
              (SELECT string_agg(DISTINCT l.locktype, ',') FROM pg_locks l WHERE l.pid = a.pid AND NOT l.granted) AS locktype
             FROM pg_stat_activity a
            CROSS JOIN LATERAL unnest(pg_blocking_pids(a.pid)) AS bp(pid) JOIN pg_stat_activity b ON b.pid = bp.pid
           WHERE a.datname = current_database()`);
        samples += 1;
        for (const row of r.rows) waits.push({ waiter: String(row.waiter), blocker: String(row.blocker), locktype: String(row.locktype) });
        await sleep(everyMs);
      }
    } finally { await c.end(); }
  })();
  return { stop: async () => { running = false; await loop; return { samples, waits }; } };
}

// ------------------------------------------------------------------ the report
interface Result { id: string; status: 'PASS' | 'FAIL' | 'REPORTED' | 'NOT RUN'; claim: string; detail?: unknown; planted?: string }
const results: Result[] = [];
async function proof(id: string, claim: string, work: () => Promise<{ detail?: unknown; planted?: string; reported?: boolean }>): Promise<void> {
  if (ONLY.size && !ONLY.has(id)) { results.push({ id, status: 'NOT RUN', claim }); return; }
  const t0 = now();
  try {
    const out = await work();
    results.push({ id, status: out.reported ? 'REPORTED' : 'PASS', claim, detail: out.detail, planted: out.planted });
    console.log(`${out.reported ? 'REPORTED' : 'PASS'}  ${id} ${claim} (${Math.round((now() - t0) / 1000)} s)`);
    if (out.planted) console.log(`        planted: ${out.planted}`);
    console.log(`        ${JSON.stringify(out.detail)}`);
  } catch (error) {
    results.push({ id, status: 'FAIL', claim, detail: String((error as Error)?.stack ?? error) });
    console.log(`FAIL  ${id} ${claim}\n        ${String((error as Error)?.stack ?? error)}`);
  }
}

// ================================================================== A-03: multi-worker, each row once, no waits
async function a03(): Promise<{ detail: unknown; planted: string }> {
  const ROWS = 500;
  const SESSIONS = 40;
  const WORKERS = 8;
  const run = async (db: string, fn: string | null) => {
    const o = await client(db);
    await seed(o, SESSIONS, ROWS);
    const before = await ledger(o);
    const shims = Array.from({ length: WORKERS }, (_, i) => new RpcShim(db, 1, `rb2s2-sweeper-${i}`));
    const sampler = lockSampler(db, 2);
    const t0 = now();
    let stamped = 0;
    if (fn === null) {
      const workers = shims.map((s) => sweeper(s, { batch: 100, rounds: 10, statementTimeoutMs: 5_000 }));
      await Promise.all(workers.map(async (w) => { for (let i = 0; i < 200; i += 1) { if ((await w.tick()) === 'drained_visible' && w.statements.at(-1)?.rows === 0) break; } }));
      stamped = workers.reduce((n, w) => n + w.statements.reduce((m, s) => m + s.rows, 0), 0);
    } else {
      // The planted copy is called raw: the same loop, the same limit, through the same stand-in.
      await Promise.all(shims.map(async (s) => { for (let i = 0; i < 500; i += 1) { const n = await s.rpc<number>(fn, { p_limit: 100 }); stamped += n; if (n === 0) break; } }));
    }
    const ms = Math.round(now() - t0);
    const locks = await sampler.stop();
    const after = await ledger(o);
    await Promise.all(shims.map((s) => s.end()));
    await o.end();
    const between = locks.waits.filter((w) => w.waiter.startsWith('rb2s2-sweeper') && w.blocker.startsWith('rb2s2-sweeper'));
    return { before, after, stamped, ms, locks: { samples: locks.samples, waits: locks.waits.length,
      sweeperOnSweeperRowLock: between.filter((w) => ROW_LOCKS.has(w.locktype)).length,
      sweeperOnSweeperOther: Object.fromEntries([...new Set(between.filter((w) => !ROW_LOCKS.has(w.locktype)).map((w) => w.locktype))]
        .map((t) => [t, between.filter((w) => w.locktype === t).length])) } };
  };
  const shipped = await isolated('a03', (db) => run(db, null));
  assert.equal(shipped.before.pending, SESSIONS * ROWS, 'every fixture row starts PENDING');
  assert.equal(shipped.stamped, shipped.before.pending, 'the sum of what 8 concurrent sweepers stamped equals the rows: none twice, none lost');
  assert.equal(shipped.after.pending, 0, 'nothing left PENDING');
  assert.equal(shipped.after.stamped, shipped.before.total, 'every row stamped exactly once (the guard refuses a second stamp)');
  assert.equal(shipped.locks.sweeperOnSweeperRowLock, 0, 'no sweeper ever waited on another\'s ROW lock (SKIP LOCKED); other lock kinds are reported');
  const planted = await isolated('a03p', async (db) => {
    const o = await client(db);
    const def = String((await o.query(`SELECT pg_get_functiondef('public.${SWEEPER}(integer)'::regprocedure) AS d`)).rows[0].d);
    assert.match(def, /FOR UPDATE SKIP LOCKED/u);
    await o.query(def.replace(`public.${SWEEPER}(`, 'public.s2_planted_sweep_no_skip_v1(').replace('FOR UPDATE SKIP LOCKED', 'FOR UPDATE'));
    await o.query('GRANT EXECUTE ON FUNCTION public.s2_planted_sweep_no_skip_v1(integer) TO service_role');
    await o.end();
    return run(db, 's2_planted_sweep_no_skip_v1');
  });
  assert.ok(planted.locks.sweeperOnSweeperRowLock > 0, 'the planted copy without SKIP LOCKED is caught: its sweepers wait on each other\'s row locks');
  return { detail: { shipped, plantedNoSkipLocked: planted.locks }, planted: `0201's sweeper body without SKIP LOCKED: ${planted.locks.sweeperOnSweeperRowLock} sweeper-on-sweeper row-lock waits sampled (caught)` };
}

// ================================================================== A-04: the row-lock claim under READ COMMITTED
async function a04(): Promise<{ detail: unknown; planted: string }> {
  return isolated('a04', async (db) => {
    const o = await client(db);
    const f = await seed(o, 1, 50);
    const [session, user] = [f.sessions[0], f.users[0]];
    const holder = await client(db, 'rb2s2-sweeper-held');
    const writer = await client(db, 'rb2s2-writer');
    const watcher = await client(db, 'rb2s2-watcher');
    const out: Record<string, unknown> = {};
    try {
      await holder.query('BEGIN');
      await holder.query('SET LOCAL ROLE service_role');
      const held = Number((await holder.query(`SELECT public.${SWEEPER}(500) AS n`)).rows[0].n);
      assert.equal(held, 50, 'the sweeper statement stamped and now holds every row of the Session, the latest included');
      const writerPid = Number((await writer.query('SELECT pg_backend_pid() AS p')).rows[0].p);
      for (const mode of ['DEFERRED', 'IMMEDIATE']) {
        await writer.query("SET lock_timeout = '100ms'");
        await writer.query('BEGIN');
        if (mode === 'IMMEDIATE') await writer.query('SET CONSTRAINTS public.session_semantic_clocks_record_commit_instant IMMEDIATE');
        await writer.query('SELECT * FROM public.reserve_session_same_sp_event_v1($1, $2)', [session, user]);
        await writer.query('SELECT * FROM public.reserve_session_same_sp_event_v1($1, $2)', [session, user]);
        const blocking = (await watcher.query('SELECT pg_blocking_pids($1) AS b', [writerPid])).rows[0].b as number[];
        assert.deepEqual(blocking, [], `${mode}: the writer is blocked by nothing while the sweeper holds its locks`);
        const t0 = now();
        await writer.query('COMMIT');
        out[`${mode}CommitMs`] = Math.round((now() - t0) * 10) / 10;
      }
      // Two committed writer transactions recorded, chained after the held (stamped, locked) row.
      const rows = (await o.query(`SELECT xact_id::text AS x, observed_at FROM ${LEDGER} WHERE session_id = $1 ORDER BY through_sp, through_event_sequence`, [session])).rows;
      assert.equal(rows.length, 52, 'both writer transactions recorded while the sweeper held its row locks (lock_timeout 100 ms never fired)');
      // PLANTED: a writer step that does touch a locked ledger row waits, and lock_timeout refuses it.
      await writer.query('BEGIN');
      let code: string | undefined;
      try {
        // The Session's first row: one the held sweep stamped and still locks (its stamp is not yet visible here).
        await writer.query(`SELECT 1 FROM ${LEDGER} WHERE session_id = $1 AND (through_sp, through_event_sequence) = (
            SELECT through_sp, through_event_sequence FROM ${LEDGER} WHERE session_id = $1 ORDER BY through_sp, through_event_sequence LIMIT 1) FOR UPDATE`, [session]);
      } catch (error) { code = (error as { code?: string }).code; }
      await writer.query('ROLLBACK');
      assert.equal(code, '55P03', 'the planted writer step on a locked row is refused by lock_timeout');
      await holder.query('COMMIT');
      return { detail: { ...out, heldRows: held, recordedAfter: rows.length }, planted: 'a writer step locking a sweeper-locked ledger row: 55P03 (caught)' };
    } finally {
      await holder.query('ROLLBACK').catch(() => undefined);
      await Promise.all([holder.end(), writer.end(), watcher.end(), o.end()]);
    }
  });
}

// ================================================================== A-05: concurrent Sessions, commit latency vs control
async function writersFor(db: string, f: Fixture, ms: number): Promise<number[]> {
  const latencies: number[] = [];
  const clients = await Promise.all(f.sessions.map(() => client(db, 'rb2s2-writer')));
  const until = now() + ms;
  await Promise.all(clients.map(async (c, i) => {
    while (now() < until) {
      const t0 = now();
      await c.query('SELECT * FROM public.reserve_session_same_sp_event_v1($1, $2)', [f.sessions[i], f.users[i]]);
      latencies.push(now() - t0);
    }
  }));
  await Promise.all(clients.map((c) => c.end()));
  return latencies;
}
async function a05(): Promise<{ detail: unknown; reported: boolean }> {
  return isolated('a05', async (db) => {
    const o = await client(db);
    const writers = await seed(o, 16, 1);
    const backlog = await seed(o, 4, 5_000);
    const runs: Record<string, unknown>[] = [];
    let sweeperBlocksWriter = 0;
    for (const mode of ['control', 'sweeping', 'control', 'sweeping']) {
      if (mode === 'sweeping') await commits(o, backlog.sessions[0], backlog.users[0], 5_000);
      const shim = new RpcShim(db, 1, 'rb2s2-sweeper');
      const w = sweeper(shim, { batch: SEMANTIC_COMMIT_SWEEP_DEFAULTS.batch, rounds: 10 });
      let sweeping = mode === 'sweeping';
      const loop = (async () => { while (sweeping) { await w.tick(); await sleep(1); } })();
      const sampler = lockSampler(db, 5);
      const lat = await writersFor(db, writers, 10_000);
      sweeping = false;
      await loop;
      const locks = await sampler.stop();
      const onSweeper = locks.waits.filter((x) => x.waiter === 'rb2s2-writer' && x.blocker.startsWith('rb2s2-sweeper'));
      sweeperBlocksWriter += onSweeper.filter((x) => ROW_LOCKS.has(x.locktype)).length;
      runs.push({ mode, commitMs: dist(lat), sweeperStatements: w.statements.length, sweeperRows: w.statements.reduce((n, s) => n + s.rows, 0),
        lockWaitSamples: locks.waits.length, writerOnSweeperRowLock: onSweeper.filter((x) => ROW_LOCKS.has(x.locktype)).length,
        writerOnSweeperOther: onSweeper.filter((x) => !ROW_LOCKS.has(x.locktype)).map((x) => x.locktype) });
      await shim.end();
    }
    await o.end();
    assert.equal(sweeperBlocksWriter, 0, 'no writer ever waited on a sweeper backend\'s row lock');
    return { detail: { runs }, reported: true };
  });
}

// ================================================================== A-06: the shared PostgREST pool
async function a06(): Promise<{ detail: unknown; reported: boolean }> {
  return isolated('a06', async (db) => {
    const o = await client(db);
    const people = await seed(o, 8, 1);
    const backlog = await seed(o, 2, 10_000);
    const runs: Record<string, unknown>[] = [];
    for (const mode of ['control', 'sweeping', 'control', 'sweeping']) {
      if (mode === 'sweeping') await commits(o, backlog.sessions[0], backlog.users[0], 6_000);
      // ONE bounded pool, as one PostgREST: 4 connections shared by voice-class permit traffic and the sweeper.
      const shim = new RpcShim(db, 4, 'rb2s2-postgrest');
      const gate = new DatabaseBackgroundPermitGate(shim);
      const w = sweeper(shim, { batch: SEMANTIC_COMMIT_SWEEP_DEFAULTS.batch, rounds: 10 });
      let sweeping = mode === 'sweeping';
      let sweeperConnections = 0;
      let maxSweeperConnections = 0;
      const wrapped = shim.rpc.bind(shim);
      shim.rpc = (async <T>(name: string, body: Record<string, unknown>, opts?: { timeoutMs?: number }) => {
        if (name !== SWEEPER) return wrapped<T>(name, body, opts);
        sweeperConnections += 1; maxSweeperConnections = Math.max(maxSweeperConnections, sweeperConnections);
        try { return await wrapped<T>(name, body, opts); } finally { sweeperConnections -= 1; }
      }) as RpcShim['rpc'];
      const loop = (async () => { while (sweeping) { await w.tick(); await sleep(1); } })();
      const until = now() + 8_000;
      const voice: number[] = [];
      await Promise.all(people.users.map(async (u) => {
        while (now() < until) {
          const t0 = now();
          const permit = await gate.acquire(u, 'CALL_ANALYSIS', { respectCriticalWindow: false, maxWaitMs: 2_000 });
          await permit?.release();
          voice.push(now() - t0);
        }
      }));
      sweeping = false;
      await loop;
      const waits = Object.entries(shim.waits).filter(([n]) => n !== SWEEPER).flatMap(([, v]) => v);
      runs.push({ mode, voiceClassPermitRoundTripMs: dist(voice), voiceClassPoolWaitMs: dist(waits), sweeperStatements: w.statements.length, maxSweeperConnections });
      assert.ok(maxSweeperConnections <= 1, 'the sweeper never holds more than one pool connection (single-flight)');
      await shim.end();
    }
    await o.end();
    return { detail: { pool: 4, runs }, reported: true };
  });
}

// ================================================================== A-07: REPEATABLE READ / SERIALIZABLE characterization
async function a07(): Promise<{ detail: unknown; reported: boolean }> {
  return isolated('a07', async (db) => {
    const o = await client(db);
    const f = await seed(o, 1, 1);
    const [session, user] = [f.sessions[0], f.users[0]];
    const w = await client(db, 'rb2s2-writer');
    const s = await client(db, 'rb2s2-sweeper');
    const TRIALS = 60;
    const table: Record<string, Record<string, number>> = {};
    for (const writerLevel of ['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE']) {
      for (const sweeperLevel of ['READ COMMITTED', 'SERIALIZABLE']) {
        for (const order of ['snapshot-then-sweep', 'write-then-sweep']) {
          const key = `${writerLevel} writer / ${sweeperLevel} sweeper / ${order}`;
          const tally = (table[key] = { committed: 0, '40001': 0, other: 0 });
          for (let i = 0; i < TRIALS; i += 1) {
            await commits(o, session, user, 1); // a fresh PENDING latest row for the sweeper to stamp
            await w.query(`BEGIN ISOLATION LEVEL ${writerLevel}`);
            await w.query(`SELECT count(*) FROM ${LEDGER} WHERE session_id = $1`, [session]);
            if (order === 'write-then-sweep') await w.query('SELECT * FROM public.reserve_session_same_sp_event_v1($1, $2)', [session, user]);
            await s.query(`BEGIN ISOLATION LEVEL ${sweeperLevel}`);
            await s.query('SET LOCAL ROLE service_role');
            await s.query(`SELECT public.${SWEEPER}(500)`);
            await s.query('COMMIT');
            try {
              if (order === 'snapshot-then-sweep') await w.query('SELECT * FROM public.reserve_session_same_sp_event_v1($1, $2)', [session, user]);
              await w.query('COMMIT');
              tally.committed += 1;
            } catch (error) {
              await w.query('ROLLBACK').catch(() => undefined);
              if ((error as { code?: string }).code === '40001') tally['40001'] += 1; else tally.other += 1;
            }
          }
        }
      }
    }
    // The chain is intact whatever was refused: every committed writer recorded once, in order.
    const chain = (await o.query(`SELECT bool_and((from_sp, from_event_sequence) = (prev_sp, prev_seq)) AS ok FROM (
        SELECT from_sp, from_event_sequence, lag(through_sp) OVER w AS prev_sp, lag(through_event_sequence) OVER w AS prev_seq
          FROM ${LEDGER} WHERE session_id = $1 WINDOW w AS (ORDER BY through_sp, through_event_sequence)) x WHERE prev_sp IS NOT NULL`, [session])).rows[0].ok;
    assert.equal(chain, true, 'the ledger chain is intact after every interleaving');
    for (const [key, t] of Object.entries(table)) {
      if (key.startsWith('READ COMMITTED writer')) assert.equal(t['40001'] + t.other, 0, `${key}: READ COMMITTED (the coordinators' level) is never refused`);
    }
    await Promise.all([w.end(), s.end(), o.end()]);
    return { detail: { trials: TRIALS, table }, reported: true };
  });
}

// ================================================================== A-08: erasure concurrent with a sweep
async function a08(): Promise<{ detail: unknown }> {
  return isolated('a08', async (db) => {
    const o = await client(db);
    const erased = await seed(o, 1, 3_000);
    const kept = await seed(o, 1, 3_000);
    const holder = await client(db, 'rb2s2-sweeper-held');
    const eraser = await client(db, 'rb2s2-erasure');
    // A sweep statement holds row locks on the oldest rows (some of each person) while the erasure starts.
    await holder.query('BEGIN');
    await holder.query('SET LOCAL ROLE service_role');
    const held = Number((await holder.query(`SELECT public.${SWEEPER}(500) AS n`)).rows[0].n);
    await eraser.query('BEGIN');
    const [del] = (await eraser.query(`INSERT INTO personal_data_private.account_deletions (user_id, command_id, status, requested_at, final_at)
        VALUES ($1, gen_random_uuid(), 'SCHEDULED', clock_timestamp() - interval '8 days', clock_timestamp() - interval '1 day') RETURNING id`, [erased.users[0]])).rows;
    await eraser.query('SET LOCAL ROLE service_role');
    const t0 = now();
    const erasing = eraser.query('SELECT public.server_erase_account_v1($1) AS outcome', [del.id]);
    // A concurrent sweeper keeps running meanwhile: it skips what is locked and never waits.
    const shim = new RpcShim(db, 1, 'rb2s2-sweeper');
    const w = sweeper(shim, { batch: 200, rounds: 10 });
    for (let i = 0; i < 5; i += 1) await w.tick();
    await sleep(200);
    await holder.query('COMMIT');
    const outcome = String((await erasing).rows[0].outcome);
    await eraser.query('COMMIT');
    const erasureMs = Math.round(now() - t0);
    assert.equal(outcome, 'ERASED');
    for (let i = 0; i < 40; i += 1) { if ((await w.tick()) === 'drained_visible' && w.statements.at(-1)?.rows === 0) break; }
    const left = (await o.query(`SELECT count(*) FILTER (WHERE user_id = $1)::int AS erased, count(*) FILTER (WHERE user_id = $2)::int AS kept,
        count(*) FILTER (WHERE user_id = $2 AND observed_at IS NULL)::int AS kept_pending FROM ${LEDGER}`, [erased.users[0], kept.users[0]])).rows[0];
    assert.equal(left.erased, 0, 'no row of the erased person is left');
    assert.equal(left.kept, 3_000, 'the other person\'s rows are untouched');
    assert.equal(left.kept_pending, 0, 'and all of them are stamped by the sweeps that continued');
    const post = await shim.rpc<number>(SWEEPER, { p_limit: 1000 });
    assert.equal(post, 0, 'a sweep after the erasure stamps nothing');
    await shim.end();
    await Promise.all([holder.end(), eraser.end(), o.end()]);
    return { detail: { heldBySweep: held, erasureMs, concurrentSweepStatements: w.statements.length, left } };
  });
}

// ================================================================== A-09: C-2 signal semantics on the real database
async function a09(): Promise<{ detail: unknown }> {
  return isolated('a09', async (db) => {
    const o = await client(db);
    const f = await seed(o, 1, 1_200);
    const shim = new RpcShim(db, 1, 'rb2s2-sweeper');
    const w = sweeper(shim, { batch: 500, rounds: 10 });
    assert.equal(await w.tick(), 'drained_visible');
    assert.deepEqual(w.statements.map((s) => s.rows), [500, 500, 200]);
    assert.deepEqual(w.signals, ['sweep_round:work_found', 'sweep_round:work_found', 'sweep_round:work_found', 'sweep_round:drained_visible', 'sweep_tick:drained_visible']);
    // CAPACITY_REACHED does not prove a backlog: exactly batch x rounds rows, and zero remain.
    await commits(o, f.sessions[0], f.users[0], 1_000);
    const c = sweeper(shim, { batch: 500, rounds: 2 });
    assert.equal(await c.tick(), 'capacity_reached');
    assert.equal((await ledger(o)).pending, 0, 'CAPACITY_REACHED, and nothing remains');
    // DRAINED_VISIBLE does not prove empty: rows locked by another transaction are skipped, unmeasured.
    await commits(o, f.sessions[0], f.users[0], 300);
    const locker = await client(db, 'rb2s2-locker');
    await locker.query('BEGIN');
    await locker.query(`SELECT 1 FROM ${LEDGER} WHERE observed_at IS NULL FOR UPDATE`);
    const d = sweeper(shim, { batch: 500, rounds: 10 });
    assert.equal(await d.tick(), 'drained_visible');
    assert.equal(d.statements[0].rows, 0);
    const lockedPending = (await ledger(o)).pending;
    assert.equal(lockedPending, 300, 'DRAINED_VISIBLE while 300 rows are PENDING and locked');
    await locker.query('COMMIT');
    await shim.end();
    await Promise.all([locker.end(), o.end()]);
    return { detail: { drained: w.statements.map((s) => s.rows), capacityReachedWithNothingLeft: true, drainedVisibleWhileLockedPending: lockedPending } };
  });
}

// ================================================================== A-10: a 50,000-row single-Session backlog
async function a10(): Promise<{ detail: unknown; planted: string }> {
  const N = 50_000;
  const drained = await isolated('a10', async (db) => {
    const o = await client(db);
    const t0 = now();
    const f = await seed(o, 1, N);
    const seedMs = Math.round(now() - t0);
    const shim = new RpcShim(db, 1, 'rb2s2-sweeper');
    // S2-16c: every row held FOR UPDATE by another transaction. The sweeper returns 0 (DRAINED_VISIBLE) and does not wait.
    const locker = await client(db, 'rb2s2-locker');
    await locker.query('BEGIN');
    await locker.query(`SELECT 1 FROM ${LEDGER} WHERE session_id = $1 FOR UPDATE`, [f.sessions[0]]);
    const blind = sweeper(shim, { batch: 500, rounds: 10 });
    const sampler = lockSampler(db, 2);
    assert.equal(await blind.tick(), 'drained_visible');
    const blindLocks = await sampler.stop();
    assert.equal(blind.statements[0].rows, 0, 'S2-16c: every row locked -> 0 stamped');
    assert.equal(blindLocks.waits.filter((x) => x.waiter.startsWith('rb2s2-sweeper')).length, 0, 'and the sweeper never waited');
    assert.equal((await ledger(o)).pending, N, 'DRAINED_VISIBLE with the whole backlog PENDING: the signal is not a bound');
    await locker.query('COMMIT');
    // After the release: drained in bounded statements by the shipped worker.
    const repository = new ConversationSemanticRuntimeRepository(shim as unknown as SupabaseServiceRoleApiService);
    const walPer: number[] = [];
    const w = sweeper(shim, { batch: SEMANTIC_COMMIT_SWEEP_DEFAULTS.batch, rounds: SEMANTIC_COMMIT_SWEEP_DEFAULTS.rounds }, { pressing: () => false }, {
      sweepUnobservedSemanticCommits: async (l, t) => { const from = await wal(o); const n = await repository.sweepUnobservedSemanticCommits(l, t); walPer.push(await walBytes(o, from)); return n; },
    });
    const d0 = now();
    let ticks = 0;
    while ((await ledger(o)).pending > 0 && ticks < 200) { await w.tick(); ticks += 1; }
    const drainMs = Math.round(now() - d0);
    const end = await ledger(o);
    assert.equal(end.pending, 0, 'drained');
    assert.equal(end.stamped, N, 'each row stamped once');
    assert.ok(w.statements.every((s) => s.rows <= SEMANTIC_COMMIT_SWEEP_DEFAULTS.batch), 'every statement stamped at most the batch');
    await shim.end();
    await Promise.all([locker.end(), o.end()]);
    return { seedMs, ticks, drainMs, statements: w.statements.length, rowsPerStatementMax: Math.max(...w.statements.map((s) => s.rows)),
      statementMs: dist(w.statements.map((s) => s.ms)), walBytesPerStatement: dist(walPer), rowsPerSecond: Math.round(N / (drainMs / 1000)) };
  });
  // The hazard demonstration, run once directly (never from the API): 0201's per-Session observer on the same backlog.
  const hazard = await isolated('a10h', async (db) => {
    const o = await client(db);
    const f = await seed(o, 1, N);
    const c = await client(db, 'rb2s2-hazard');
    const from = await wal(o);
    await c.query('BEGIN');
    await c.query('SET LOCAL ROLE service_role');
    const t0 = now();
    const n = Number((await c.query(`SELECT public.${OBSERVER}($1) AS n`, [f.sessions[0]])).rows[0].n);
    const ms = Math.round(now() - t0);
    const locks = Number((await o.query("SELECT count(*)::int AS n FROM pg_locks l JOIN pg_stat_activity a USING (pid) WHERE a.application_name = 'rb2s2-hazard'")).rows[0].n);
    await c.query('COMMIT');
    const bytes = await walBytes(o, from);
    await Promise.all([c.end(), o.end()]);
    return { rowsInOneStatement: n, ms, walBytes: bytes, lockEntriesHeld: locks };
  });
  assert.equal(hazard.rowsInOneStatement, N, 'the per-Session observer stamps the whole backlog in ONE statement (the hazard)');
  assert.ok(hazard.rowsInOneStatement >= 100 * SEMANTIC_COMMIT_SWEEP_DEFAULTS.batch, 'two orders of magnitude past the sweeper\'s statement bound');
  return { detail: { drained, hazard }, planted: `0201's per-Session observer on the same backlog: ${hazard.rowsInOneStatement} rows, ${hazard.ms} ms, ${hazard.walBytes} WAL bytes in one statement (the hazard, shown; never reachable from the API - static contract)` };
}

// ================================================================== A-11: sizing with Live Voice priority
async function holdAllPermits(gate: DatabaseBackgroundPermitGate, users: string[]): Promise<BackgroundPermit[]> {
  const held: BackgroundPermit[] = [];
  for (const u of users) for (let k = 0; k < 2; k += 1) {
    const p = await gate.acquire(u, 'CALL_ANALYSIS', { respectCriticalWindow: false, maxWaitMs: 1_000 });
    if (p) held.push(p);
  }
  return held;
}
async function a11(): Promise<{ detail: unknown; planted: string }> {
  return isolated('a11', async (db) => {
    const o = await client(db);
    const people = await seed(o, 10, 1);
    const backlog = await seed(o, 1, 1);
    const variants = [100, 250, 500];
    const runs: Array<Record<string, unknown>> = [];
    const voiceLoad = async (shim: RpcShim, ms: number) => {
      const gate = new DatabaseBackgroundPermitGate(shim);
      const until = now() + ms;
      const lat: number[] = [];
      await Promise.all(people.users.slice(0, 6).map(async (u) => {
        while (now() < until) { const t0 = now(); const p = await gate.acquire(u, 'CALL_ANALYSIS', { respectCriticalWindow: false, maxWaitMs: 2_000 }); await p?.release(); lat.push(now() - t0); }
      }));
      return lat;
    };
    // Three interleaved passes (forward, reverse, forward), so each verdict is a true median and one stalled run cannot
    // decide it.
    const reverse = variants.slice().reverse();
    for (const batch of ['control', ...variants, 'control', ...reverse, 'control', ...variants] as Array<'control' | number>) {
      const shim = new RpcShim(db, 4, 'rb2s2-postgrest');
      if (batch === 'control') {
        runs.push({ variant: 'control', voiceClassMs: dist(await voiceLoad(shim, 6_000)) });
      } else {
        await commits(o, backlog.sessions[0], backlog.users[0], batch * 10 * 7);
        const w = sweeper(shim, { batch, rounds: 10, tickBudgetMs: SEMANTIC_COMMIT_SWEEP_DEFAULTS.tickBudgetMs });
        let on = true;
        const tickMs: number[] = [];
        const loop = (async () => { while (on) { const t0 = now(); await w.tick(); tickMs.push(now() - t0); await sleep(500); } })();
        const lat = await voiceLoad(shim, 6_000);
        on = false;
        await loop;
        const rows = w.statements.reduce((n, s) => n + s.rows, 0);
        runs.push({ variant: batch, voiceClassMs: dist(lat), statementMs: dist(w.statements.map((s) => s.ms)), tickMs: dist(tickMs),
          failedStatements: w.failures.length, rowsPerSecond: Math.round(rows / 6), ticks: w.ticks.length,
          capacityReached: w.ticks.filter((t) => t === 'capacity_reached').length });
        await sleep(200);
        const rest = sweeper(shim, { batch: 500, rounds: 10 });
        while ((await ledger(o)).pending > 0) await rest.tick();
      }
      await shim.end();
    }
    // Yielding: every shared permit held (16 of 16), one more unit of background work asks and waits -> the sweeper yields.
    const shim = new RpcShim(db, 4, 'rb2s2-postgrest');
    await commits(o, backlog.sessions[0], backlog.users[0], 2_000);
    const pressure = new BackgroundPermitPressure();
    const gate = new DatabaseBackgroundPermitGate(shim, { observer: pressure });
    const held = await holdAllPermits(gate, people.users.slice(0, 8));
    assert.equal(held.length, 16, 'every shared permit is held');
    const waiting = gate.acquire(people.users[9], 'CALL_ANALYSIS', { respectCriticalWindow: true, maxWaitMs: 1_500 });
    await sleep(100);
    const yielding = sweeper(shim, { batch: 500, rounds: 10 }, pressure);
    const t1 = await yielding.tick();
    assert.equal(t1, 'yielded', 'saturated permits -> the tick yields');
    assert.equal(yielding.statements.length, 0, 'and runs no statement');
    // PLANTED: a sweeper that ignores the permit pool sweeps while every permit is held.
    const ignoring = sweeper(shim, { batch: 500, rounds: 10 }, { pressing: () => false });
    await ignoring.tick();
    assert.ok(ignoring.statements.length > 0, 'the planted sweeper ignoring the pool runs statements under saturation (caught)');
    assert.equal(await waiting, null, 'the waiting unit was not granted (nothing freed)');
    for (const p of held) await p.release();
    await sleep(BACKGROUND_PRESSURE_HOLD_MS + 100);
    const resumed = await yielding.tick();
    assert.notEqual(resumed, 'yielded', 'released -> after the hold the tick sweeps again');
    await shim.end();
    await o.end();
    // The shipped default is the largest variant whose statement P95 fits a tenth of the tick budget (all ten rounds
    // inside it) and whose voice-class P95 is within +50 ms of the interleaved controls' median.
    const controls = runs.filter((r) => r.variant === 'control').map((r) => (r.voiceClassMs as ReturnType<typeof dist>).p95 ?? 0);
    const base = median(controls);
    const verdict = variants.map((b) => {
      const mine = runs.filter((r) => r.variant === b);
      // A run in which no statement completed, or one failed, has no measured statement time: it is never "safe".
      const stmtP95 = median(mine.map((r) => ((r.failedStatements as number) > 0 ? Number.POSITIVE_INFINITY
        : (r.statementMs as ReturnType<typeof dist>).p95 ?? Number.POSITIVE_INFINITY)));
      const voiceP95 = median(mine.map((r) => (r.voiceClassMs as ReturnType<typeof dist>).p95 ?? Number.POSITIVE_INFINITY));
      return { batch: b, statementP95Ms: stmtP95, voiceClassP95DeltaMs: Math.round((voiceP95 - base) * 10) / 10,
        safe: stmtP95 <= SEMANTIC_COMMIT_SWEEP_DEFAULTS.tickBudgetMs / 10 && voiceP95 - base <= 50 };
    });
    const selected = verdict.filter((v) => v.safe).map((v) => v.batch).at(-1) ?? null;
    assert.equal(selected, SEMANTIC_COMMIT_SWEEP_DEFAULTS.batch, `the shipped batch (${SEMANTIC_COMMIT_SWEEP_DEFAULTS.batch}) is the measured safe default (${selected})`);
    return { detail: { runs, verdict, selectedBatch: selected, yielded: t1, resumedAfterRelease: resumed },
      planted: `a sweeper ignoring the permit pool ran ${ignoring.statements.length} statement(s) while 16 / 16 permits were held (caught)` };
  });
}

// ================================================================== A-12: prolonged load -> recovery -> detectors
async function a12(): Promise<{ detail: unknown; planted: string }> {
  const SCALED = { noOpportunityMs: 10_000, ceilingTicks: 5, failingTicks: 3 };
  const INTERVAL = 1_000;
  return isolated('a12', async (db) => {
    const o = await client(db);
    const people = await seed(o, 10, 1);
    const arrival = await seed(o, 1, 1);
    const shim = new RpcShim(db, 4, 'rb2s2-postgrest');
    const pressure = new BackgroundPermitPressure();
    const gate = new DatabaseBackgroundPermitGate(shim, { observer: pressure });
    const config = { batch: 500, rounds: 10, intervalMs: INTERVAL, detectors: SCALED };
    // Phase 1 (load): every permit held and background work kept waiting; commits keep arriving (20 / s).
    const held = await holdAllPermits(gate, people.users.slice(0, 8));
    let loading = true;
    const waiters = (async () => { while (loading) await gate.acquire(people.users[9], 'CALL_ANALYSIS', { respectCriticalWindow: true, maxWaitMs: 1_000 }); })();
    const arrive = (async () => { while (loading) { await commits(o, arrival.sessions[0], arrival.users[0], 20); await sleep(1_000); } })();
    const stampedAtStart = (await ledger(o)).stamped;
    const w = sweeper(shim, config, pressure);
    const p0 = now();
    while (now() - p0 < 15_000) { await w.tick(); await sleep(INTERVAL); }
    const duringLoad = (await ledger(o)).stamped - stampedAtStart;
    // PLANTED (a): the same phase with a sweeper that ignores the yield condition stamps rows during the load (one
    // statement of one row: enough to be caught, and the backlog is left for the recovery phase).
    const ignoring = sweeper(shim, { ...config, batch: 1, rounds: 1 }, { pressing: () => false });
    await ignoring.tick();
    const ignoredRows = ignoring.statements.reduce((n, s) => n + s.rows, 0);
    loading = false;
    await Promise.all([waiters, arrive]);
    for (const p of held) await p.release();
    assert.equal(duringLoad, 0, 'no row stamped while the yield held');
    assert.ok(w.ticks.length > 0 && w.ticks.every((t) => t === 'yielded'), 'every tick yielded');
    assert.ok(w.signals.includes('detector:no_sweep_opportunity'), 'NO_SWEEP_OPPORTUNITY fired within its (scaled) threshold');
    assert.ok(ignoredRows > 0, 'the planted sweeper ignoring the yield condition is caught: it stamped rows under load');
    // Phase 2 (recovery): load ends; rounds resume; the backlog drains within the C-3.1 / R-1..R-5 bound.
    const B = (await ledger(o)).pending;
    const recovery: SemanticCommitSweepTick[] = [];
    const r0 = now();
    while ((await ledger(o)).pending > 0 && recovery.length < 60) { const t = await w.tick(); if (t) recovery.push(t); await sleep(INTERVAL); }
    const recoveryMs = Math.round(now() - r0);
    const end = await ledger(o);
    const perTick = SEMANTIC_COMMIT_SWEEP_DEFAULTS.batch * 10;
    const bound = Math.ceil(B / perTick) + Math.ceil(BACKGROUND_PRESSURE_HOLD_MS / INTERVAL) + 1;
    assert.equal(end.pending, 0, 'recovered: zero PENDING (owner read, this database only)');
    assert.equal(end.stamped, end.total, 'each row stamped once');
    assert.ok(recovery.filter((t) => t !== 'yielded').length <= bound, `non-yielded ticks to drain within the bound ${bound}`);
    assert.ok(w.signals.includes('sweep_round:work_found') && recovery.at(-1) === 'drained_visible', 'rounds resumed: WORK_FOUND, then DRAINED_VISIBLE');
    // PLANTED (b): configured below the arrival rate (A-R3 violated): never drains; CEILING_SUSTAINED fires continuously.
    const slow = sweeper(shim, { batch: 5, rounds: 1, intervalMs: INTERVAL, detectors: SCALED });
    const before = (await ledger(o)).pending;
    for (let i = 0; i < 10; i += 1) { await commits(o, arrival.sessions[0], arrival.users[0], 20); await slow.tick(); await sleep(200); }
    const after = (await ledger(o)).pending;
    const ceilings = slow.signals.filter((s) => s === 'detector:ceiling_sustained').length;
    assert.ok(after > before && ceilings >= 5, 'below arrival: the backlog grows and CEILING_SUSTAINED fires on every tick from the 5th');
    while ((await ledger(o)).pending > 0) await sweeper(shim).tick();
    // PLANTED (c): a failing sweeper fires SWEEP_FAILING and leaves rows PENDING - not stamped, not lost.
    await commits(o, arrival.sessions[0], arrival.users[0], 50);
    const failing = sweeper(shim, { detectors: SCALED }, { pressing: () => false }, { sweepUnobservedSemanticCommits: async () => { throw new DataApiError(503); } });
    for (let i = 0; i < 3; i += 1) await failing.tick();
    const kept = await ledger(o);
    assert.ok(failing.signals.includes('detector:sweep_failing'), 'SWEEP_FAILING fired');
    assert.equal(kept.pending, 50, 'the 50 rows stay PENDING, none lost');
    await shim.end();
    await o.end();
    return {
      detail: { loadTicks: w.ticks.length - recovery.length, rowsStampedDuringLoad: duringLoad, backlogAtRecovery: B, recoveryTicks: recovery.length, recoveryMs, bound,
        drainedAfterRecovery: end, belowArrival: { before, after, ceilingSustained: ceilings }, failing: { signals: failing.signals.filter((s) => s.startsWith('detector')), pending: kept.pending } },
      planted: `(a) yield ignored: ${ignoredRows} rows stamped under load; (b) below arrival: backlog ${before} -> ${after}, CEILING_SUSTAINED x${ceilings}; (c) failing: SWEEP_FAILING, 50 rows PENDING (all caught)`,
    };
  });
}

// ================================================================== A-13: First Audio and Live Focus, the CP3 harness
function harness(db: string, reportPath: string): Promise<{ code: number | null; text: string }> {
  return new Promise((done) => {
    const child = spawn(process.execPath, [join(ROOT, 'node_modules/ts-node/dist/bin.js'), '--transpile-only', '--project',
      join(ROOT, 'apps/api/tsconfig.scripts.json'), join(ROOT, 'apps/api/scripts/s8b-05-cp3-live-analysis-proof.ts')], {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
      env: { ...process.env, DATABASE_URL: urlOf(db), S8B05_CP3_PROFILES: 'SHIPPED', S8B05_CP3_M2: '0', S8B05_CP3_MODES: 'M0,M1_SHIPPED', S8B05_CP3_REPORT: reportPath },
    });
    let text = '';
    child.stdout.on('data', (c) => { text += c; });
    child.stderr.on('data', (c) => { text += c; });
    child.on('close', (code) => done({ code, text }));
  });
}
async function a13(): Promise<{ detail: unknown }> {
  const work = join(process.env.RB2_S2_WORK ?? require('node:os').tmpdir(), `rb2s2-a13-${process.pid}`);
  require('node:fs').mkdirSync(work, { recursive: true });
  const reps: Array<Record<string, unknown>> = [];
  for (let rep = 1; rep <= REPS; rep += 1) {
    for (const side of ['baseline', 'sweeper'] as const) {
      const out = await isolated(`a13_${side}_${rep}`, async (db) => {
        let stop = async () => ({});
        if (side === 'sweeper') {
          // The sweeper beside the harness: ANOTHER instance (so this instance's permit pressure is invisible to it: the
          // worst case), the shipped batch and rounds, a 5 s interval (six times the shipped cadence), and a backlog large
          // enough that every tick reaches its ceiling for the whole run.
          const o = await client(db);
          const f = await seed(o, 1, 1);
          await commits(o, f.sessions[0], f.users[0], 60_000);
          await o.end();
          const shim = new RpcShim(db, 1, 'rb2s2-sweeper');
          const w = sweeper(shim, { intervalMs: 5_000 });
          let on = true;
          const loop = (async () => { while (on) { await w.tick(); await sleep(5_000); } })();
          stop = async () => { on = false; await loop; await shim.end(); return { ticks: w.ticks.length, capacityReached: w.ticks.filter((t) => t === 'capacity_reached').length, statements: w.statements.length, rows: w.statements.reduce((n, s) => n + s.rows, 0), statementMs: dist(w.statements.map((s) => s.ms)) }; };
        }
        const reportPath = join(work, `${side}-${rep}.json`);
        const r = await harness(db, reportPath);
        const sweep = await stop();
        assert.equal(r.code, 0, `${side} ${rep}: the CP3 harness passed its own checks (${r.text.split('\n').filter((l) => /FAIL/u.test(l)).slice(0, 2).join(' | ')})`);
        const report = JSON.parse(readFileSync(reportPath, 'utf8')) as { modes: Record<string, { firstAudioMs: { p50: number; p95: number }; commitToLiveFocusUpdateMs?: { p50: number; p95: number } }> };
        return { side, rep, firstAudio: Object.fromEntries(Object.entries(report.modes).map(([m, v]) => [m, v.firstAudioMs])), liveFocus: report.modes.M1_SHIPPED?.commitToLiveFocusUpdateMs, sweep };
      });
      reps.push(out);
      console.log(`        A-13 ${side} ${rep}: ${JSON.stringify(out)}`);
    }
  }
  const pick = (side: string, f: (r: Record<string, any>) => number) => median(reps.filter((r) => r.side === side).map(f));
  const delta: Record<string, unknown> = {};
  for (const mode of ['M0', 'M1_SHIPPED']) {
    const d50 = pick('sweeper', (r) => r.firstAudio[mode].p50) - pick('baseline', (r) => r.firstAudio[mode].p50);
    const d95 = pick('sweeper', (r) => r.firstAudio[mode].p95) - pick('baseline', (r) => r.firstAudio[mode].p95);
    delta[mode] = { firstAudioP50DeltaMs: d50, firstAudioP95DeltaMs: d95 };
    assert.ok(d50 <= 50 && d95 <= 100, `${mode}: First Audio within GCR-01's +50 / +100 ms (P50 ${d50}, P95 ${d95})`);
  }
  const lf95 = pick('sweeper', (r) => r.liveFocus.p95) - pick('baseline', (r) => r.liveFocus.p95);
  delta.liveFocusP95DeltaMs = lf95;
  delta.liveFocusP95Baseline = pick('baseline', (r) => r.liveFocus.p95);
  assert.ok(lf95 <= 100, `commit -> Live Focus P95 regression within +100 ms (${lf95})`);
  return { detail: { reps: REPS, delta, runs: reps } };
}

// ================================================================== A-14: Replay timing fidelity (a distribution, not an order proof)
async function lagOf(o: PgClient, since: string): Promise<ReturnType<typeof dist>> {
  const r = (await o.query(`SELECT extract(epoch FROM observed_at - trigger_at) * 1000 AS ms FROM ${LEDGER} WHERE observed_at IS NOT NULL AND trigger_at >= $1::timestamptz`, [since])).rows;
  return dist(r.map((x) => Number(x.ms)));
}
async function a14(): Promise<{ detail: unknown; reported: boolean }> {
  const scenarios: Array<{ name: string; intervalMs: number; arrivalPerSecond: number; seconds: number; yieldDuty: number }> = [
    { name: 'idle, shipped 30 s interval', intervalMs: 30_000, arrivalPerSecond: 2, seconds: 95, yieldDuty: 0 },
    { name: 'nominal, shipped 30 s interval', intervalMs: 30_000, arrivalPerSecond: 50, seconds: 95, yieldDuty: 0 },
    { name: 'nominal, 5 s interval', intervalMs: 5_000, arrivalPerSecond: 50, seconds: 40, yieldDuty: 0 },
    { name: 'voice load (yield half the time), 5 s interval', intervalMs: 5_000, arrivalPerSecond: 50, seconds: 40, yieldDuty: 0.5 },
  ];
  const out: Record<string, unknown> = {};
  for (const s of scenarios) {
    out[s.name] = await isolated(`a14_${s.intervalMs}_${s.arrivalPerSecond}_${s.yieldDuty}`, async (db) => {
      const o = await client(db);
      const f = await seed(o, 4, 1);
      const since = String((await o.query('SELECT clock_timestamp()::text AS t')).rows[0].t);
      const shim = new RpcShim(db, 1, 'rb2s2-sweeper');
      let pressing = false;
      const w = sweeper(shim, { intervalMs: s.intervalMs }, { pressing: () => pressing });
      let on = true;
      const start = now();
      const ticker = (async () => {
        // The worker's own cadence: the first tick after a jitter, then one per interval.
        await sleep(1_000 + Math.random() * 4_000);
        while (on) { pressing = s.yieldDuty > 0 && Math.random() < s.yieldDuty; await w.tick(); await sleep(s.intervalMs); }
      })();
      while (now() - start < s.seconds * 1_000) {
        await Promise.all(f.sessions.map((session, i) => commits(o, session, f.users[i], Math.max(1, Math.round(s.arrivalPerSecond / f.sessions.length)))));
        await sleep(1_000);
      }
      on = false;
      pressing = false;
      await ticker;
      const lag = await lagOf(o, since);
      const left = (await ledger(o)).pending;
      await shim.end();
      await o.end();
      return { lagMs: lag, stillPendingAtEnd: left, ticks: w.ticks.length };
    });
    console.log(`        A-14 ${s.name}: ${JSON.stringify(out[s.name])}`);
  }
  return { detail: out, reported: true };
}

// ================================================================== main
async function main(): Promise<void> {
  const t0 = now();
  const residue = await (async () => {
    const c = await client(SHARED_DB, 'rb2s2-residue');
    try {
      const exists = (await c.query("SELECT to_regclass('public.session_semantic_commit_instants') IS NOT NULL AS e")).rows[0].e;
      if (!exists) return { ledger: 'absent' };
      return (await c.query(`SELECT count(*)::int AS rows, count(*) FILTER (WHERE observed_at IS NULL)::int AS pending FROM ${LEDGER}`)).rows[0];
    } finally { await c.end(); }
  })();
  console.log(`RB-2 / S2 proof: the shared database ${SHARED_DB} is read only - its ledger residue (REPORTED, never drained): ${JSON.stringify(residue)}`);
  const template = await buildTemplate();
  assert.equal(template.last, '0201_s8b_07_semantic_commit_instants_v1.sql', 'S2 adds no migration: 0201 is the last');
  console.log(`RB-2 / S2 proof: template ${TEMPLATE} built fresh (${template.migrations} migrations, last ${template.last}, ${template.ms} ms)`);
  try {
    await proof('A-03', 'multi-worker: 8 concurrent sweepers stamp every row exactly once with no lock wait', a03);
    await proof('A-04', 'row-lock claim (READ COMMITTED): a writer commits while sweeper row locks are held; nothing blocks it', a04);
    await proof('A-05', 'concurrent Sessions: commit latency vs control, no writer ever blocked by a sweeper', a05);
    await proof('A-06', 'shared PostgREST pool: voice-class permit traffic vs control; the sweeper holds at most one connection', a06);
    await proof('A-07', 'REPEATABLE READ / SERIALIZABLE characterization; READ COMMITTED never refused', a07);
    await proof('A-08', 'erasure concurrent with a sweep: completes, removes only its person, sweeps continue', a08);
    await proof('A-09', 'C-2 signal semantics on the real database', a09);
    await proof('A-10', '50,000-row single-Session backlog: S2-16c, bounded drain, the per-Session hazard shown', a10);
    await proof('A-11', 'sizing with Live Voice priority: variants, yielding under saturated permits, the safe default', a11);
    await proof('A-12', 'prolonged load -> recovery -> C-3.2 detectors, with the three planted negatives', a12);
    await proof('A-13', 'First Audio and Live Focus: the CP3 harness, baseline vs a sweeper beside it', a13);
    await proof('A-14', 'Replay timing fidelity: observed_at - trigger_at by load and interval', a14);
  } finally {
    await admin((a) => a.query(`DROP DATABASE IF EXISTS ${TEMPLATE} WITH (FORCE)`)).catch(() => undefined);
  }
  const failed = results.filter((r) => r.status === 'FAIL');
  const report = { generatedAt: new Date().toISOString(), sharedDatabaseResidue: residue, template, subset: ONLY.size ? [...ONLY] : null, minutes: Math.round((now() - t0) / 6000) / 10, results };
  if (process.env.RB2_S2_REPORT) writeFileSync(process.env.RB2_S2_REPORT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`RB-2 / S2 proof: ${results.filter((r) => r.status === 'PASS').length} PASS, ${results.filter((r) => r.status === 'REPORTED').length} REPORTED, ${failed.length} FAIL, ${results.filter((r) => r.status === 'NOT RUN').length} NOT RUN (${report.minutes} min)${ONLY.size ? ' - SUBSET, not an S2 result' : ''}`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
