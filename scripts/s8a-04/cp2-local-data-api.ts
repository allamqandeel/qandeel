// S8A-04 CP2 — an IN-PROCESS Data API over the disposable local PostgreSQL 17, for the round-19 harness only (operator-only;
// never a CI step; never imported by production code).
//
// The production services reach the database through the Supabase Data API: `POST {SUPABASE_URL}/rest/v1/rpc/<name>` with
// the server's service key (the service-role channel, the audience and World-state resolvers, the AI-COST-01 ledger) or a
// member's access token (the member's own reads and commands). The harness runs those services UNCHANGED, so it answers that
// one route the way PostgREST does, inside this process: no socket is opened for it, and nothing but the loopback port of the
// disposable database (which scripts/s8a-02/network-guard.cjs allows) is reached.
//
//   * each request is one transaction, `SET LOCAL ROLE service_role | authenticated`, with `request.jwt.claims` set as
//     PostgREST sets them (the member's `sub` from the harness's own token table);
//   * the named arguments are bound as parameters; a set-returning function answers a JSON array of rows, any other
//     function its single JSON value (PostgreSQL's own `json_agg` / `to_json`, so timestamps are the ISO strings PostgREST
//     sends);
//   * a database error answers PostgREST's status and body (`PTxyz` -> xyz, 42501 -> 403, otherwise 400) with its code.
//
// Every other URL goes on to the fetch it wraps — the network guard, which refuses everything but DeepSeek.
import { randomUUID } from 'node:crypto';

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any
interface PgPoolClient { query(text: string, values?: ReadonlyArray<unknown>): Promise<{ rows: Json[] }>; release(): void }
interface PgPool { connect(): Promise<PgPoolClient>; end(): Promise<void>; query(text: string, values?: ReadonlyArray<unknown>): Promise<{ rows: Json[] }> }
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require('pg') as { Pool: new (config: Record<string, unknown>) => PgPool };

/** A host that resolves nowhere: the in-process route answers it before any lookup could happen. */
export const LOCAL_DATA_API_URL = 'http://qandeel-cp2-local-data-api.invalid';
const PREFIX = `${LOCAL_DATA_API_URL}/rest/v1/rpc/`;
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/u;

export interface LocalDataApi {
  /** The database itself, as its owner: fixtures and the harness's own observations only. */
  readonly owner: PgPool;
  /** A member's access token for the in-process route. */
  tokenFor(userId: string): string;
  readonly calls: Map<string, number>;
  close(): Promise<void>;
}

export async function openLocalDataApi(environment: NodeJS.ProcessEnv): Promise<LocalDataApi> {
  const required = (name: string) => {
    const value = environment[name]?.trim();
    if (!value) throw new Error(`NOT RUN: ${name} is required (the disposable local database)`);
    return value;
  };
  const port = Number(required('QANDEEL_EVAL_LEDGER_DB_PORT'));
  const database = required('QANDEEL_EVAL_LEDGER_DB_NAME');
  const dataDirectory = required('QANDEEL_EVAL_LEDGER_DB_DATA_DIR');
  const pool = new Pool({ host: '127.0.0.1', port, database, user: 'postgres', password: required('QANDEEL_EVAL_LEDGER_DB_PASSWORD'), max: 6, connectionTimeoutMillis: 10_000 });
  // The same positive identity proof as the S8A-02 evaluation ledger: loopback, this port, this database, PostgreSQL 17.
  const [identity] = (await pool.query(`SELECT host(inet_server_addr()) AS addr, inet_server_port() AS port, current_database() AS db,
    current_setting('server_version_num') AS version, current_setting('data_directory') AS dir`)).rows;
  const normalize = (path: unknown) => String(path).replaceAll('\\', '/').replace(/\/+$/u, '').toLowerCase();
  if (identity.addr !== '127.0.0.1' || Number(identity.port) !== port || identity.db !== database
    || !String(identity.version).startsWith('17') || normalize(identity.dir) !== normalize(dataDirectory)) {
    await pool.end();
    throw new Error('NOT RUN: the database is not the disposable local cluster this run started');
  }

  const serviceKey = `cp2-service-${randomUUID()}`;
  const publishableKey = `cp2-publishable-${randomUUID()}`;
  const members = new Map<string, string>();
  type Shape = 'rows' | 'set' | 'void' | 'value';
  const shapes = new Map<string, Shape>();
  const calls = new Map<string, number>();

  async function shapeOf(name: string): Promise<Shape> {
    const known = shapes.get(name);
    if (known !== undefined) return known;
    const { rows } = await pool.query(`SELECT bool_or(p.proretset) AS set, bool_and(p.prorettype = 'pg_catalog.void'::regtype) AS void, bool_and(t.typtype IN ('c', 'p') OR 't' = ANY(coalesce(p.proargmodes, ARRAY[]::"char"[]))) AS rows
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_type t ON t.oid = p.prorettype WHERE n.nspname = 'public' AND p.proname = $1`, [name]);
    if (rows[0]?.set === null || rows[0]?.set === undefined) throw Object.assign(new Error('function not found'), { code: 'PGRST202' });
    const shape: Shape = rows[0].set === true ? (rows[0].rows === true ? 'rows' : 'set') : rows[0].void === true ? 'void' : 'value';
    shapes.set(name, shape);
    return shape;
  }

  const respond = (status: number, body: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  async function rpc(name: string, bearer: string, apikey: string, body: Record<string, unknown>): Promise<Response> {
    calls.set(name, (calls.get(name) ?? 0) + 1);
    if (!IDENTIFIER.test(name)) return respond(404, { code: 'PGRST202', message: 'not found' });
    let role: 'service_role' | 'authenticated';
    let claims: Record<string, unknown>;
    if (bearer === serviceKey) { role = 'service_role'; claims = { role }; } else if (apikey === publishableKey && members.has(bearer)) {
      role = 'authenticated'; claims = { sub: members.get(bearer), role };
    } else return respond(401, { code: 'PGRST301', message: 'unauthorized' });
    const entries = Object.entries(body);
    if (!entries.every(([key]) => IDENTIFIER.test(key))) return respond(400, { code: 'PGRST100', message: 'invalid argument name' });
    let shape: Shape;
    try { shape = await shapeOf(name); } catch { return respond(404, { code: 'PGRST202', message: 'not found' }); }
    const args = entries.map(([key], index) => `${key} => $${index + 1}`).join(', ');
    // A TABLE / composite set answers objects (PostgREST's rows, even with one column); a set of a base type, its values.
    const text = shape === 'rows' ? `SELECT coalesce(json_agg(to_json(r)), '[]'::json) AS j FROM (SELECT * FROM public.${name}(${args})) r`
      : shape === 'set' ? `SELECT coalesce(json_agg(r), '[]'::json) AS j FROM public.${name}(${args}) r`
      : shape === 'void' ? `SELECT public.${name}(${args}), NULL::json AS j` : `SELECT to_json(public.${name}(${args})) AS j`;
    const values = entries.map(([, value]) => (value !== null && typeof value === 'object' && !Array.isArray(value) ? JSON.stringify(value) : value));
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL ROLE ${role}`);
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      const { rows } = await client.query(text, values);
      await client.query('COMMIT');
      const value = rows[0]?.j;
      return value === null || value === undefined ? respond(204, undefined) : respond(200, value);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      const code = String((error as Json)?.code ?? '');
      const status = /^PT[0-9]{3}$/u.test(code) ? Number(code.slice(2)) : code === '42501' ? 403 : 400;
      return respond(status, { code, message: String((error as Json)?.message ?? 'error').slice(0, 200), details: null, hint: null });
    } finally {
      client.release();
    }
  }

  const inner = globalThis.fetch;
  const localDataApiFetch = async function localDataApiFetch(input: Json, init?: Json): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
    if (typeof url !== 'string' || !url.startsWith(LOCAL_DATA_API_URL)) return inner(input, init);
    if (!url.startsWith(PREFIX) || (init?.method ?? 'GET') !== 'POST') return respond(404, { code: 'PGRST125', message: 'only rpc' });
    const headers = new Headers(init?.headers ?? {});
    const bearer = (headers.get('authorization') ?? '').replace(/^Bearer /u, '');
    let body: Record<string, unknown>;
    try { body = typeof init?.body === 'string' && init.body.length > 0 ? JSON.parse(init.body) : {}; } catch { return respond(400, { code: 'PGRST102', message: 'invalid body' }); }
    return rpc(url.slice(PREFIX.length).split('?')[0], bearer, headers.get('apikey') ?? '', body);
  };
  globalThis.fetch = localDataApiFetch as typeof fetch;
  // The production services read these at call time. They name only this in-process route and its per-run keys.
  process.env.SUPABASE_URL = LOCAL_DATA_API_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;
  process.env.SUPABASE_PUBLISHABLE_KEY = publishableKey;

  return {
    owner: pool,
    tokenFor(userId: string) {
      const token = `cp2-member-${randomUUID()}`;
      members.set(token, userId);
      return token;
    },
    calls,
    async close() {
      if (globalThis.fetch === (localDataApiFetch as typeof fetch)) globalThis.fetch = inner;
      delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.SUPABASE_PUBLISHABLE_KEY;
      await pool.end();
    },
  };
}
