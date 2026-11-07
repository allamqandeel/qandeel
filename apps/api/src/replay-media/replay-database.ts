import { Pool } from 'pg';

/**
 * S8B-07 CP1-B (INFRA-07 P-3, contract §17.2) — the Replay pool's own database connection.
 *
 * The Replay pool never reaches PostgreSQL through the API's channel: it connects as `qandeel_replay_media`, the role
 * 0196 creates with CONNECTION LIMIT 10, statement_timeout 5 s, lock_timeout 1 s and idle_in_transaction_session_timeout
 * 10 s, and an application pool no larger than that limit. Each definer call is one statement in its own implicit
 * transaction, so no transaction is ever held around media I/O. At start-up the role and its limits are read back from
 * the database and the process refuses to start when they are not the approved ones (V-28). The connection string
 * comes from `REPLAY_MEDIA_DATABASE_URL` only (a deployment value; never committed, never logged).
 */
export const REPLAY_DATABASE_ROLE = 'qandeel_replay_media';
export const REPLAY_ROLE_CONNECTION_LIMIT = 10;
export const REPLAY_ROLE_SETTINGS: Readonly<Record<string, string>> = {
  statement_timeout: '5s',
  lock_timeout: '1s',
  idle_in_transaction_session_timeout: '10s',
};

/** The narrow surface the repository needs (a pool, or a fake in the tests). */
export interface ReplayDatabase {
  query<R>(text: string, values: readonly unknown[]): Promise<R[]>;
  close(): Promise<void>;
}

export class ReplayDatabaseRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayDatabaseRefusal';
  }
}

/** The application pool size: `REPLAY_MEDIA_DB_POOL_MAX` (default 4), never above the role's connection limit. */
export function replayPoolSizeOf(env: NodeJS.ProcessEnv): number {
  const raw = env.REPLAY_MEDIA_DB_POOL_MAX;
  const size = raw === undefined || raw === '' ? 4 : Number(raw);
  if (!Number.isInteger(size) || size < 1 || size > REPLAY_ROLE_CONNECTION_LIMIT) {
    throw new ReplayDatabaseRefusal(`REPLAY_MEDIA_DB_POOL_MAX must be an integer in [1, ${REPLAY_ROLE_CONNECTION_LIMIT}]`);
  }
  return size;
}

export class PgReplayDatabase implements ReplayDatabase {
  private readonly pool: Pool;

  constructor(connectionString: string, max: number) {
    this.pool = new Pool({
      connectionString, max, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000, application_name: 'qandeel-replay',
      allowExitOnIdle: true,
    });
    // An idle client's error (the server restarted) must never crash the process; the next query reconnects.
    this.pool.on('error', () => undefined);
  }

  async query<R>(text: string, values: readonly unknown[]): Promise<R[]> {
    return (await this.pool.query<R>(text, values)).rows;
  }

  close(): Promise<void> {
    return this.pool.end();
  }
}

export function replayDatabaseFrom(env: NodeJS.ProcessEnv): PgReplayDatabase {
  const url = env.REPLAY_MEDIA_DATABASE_URL;
  if (!url) throw new ReplayDatabaseRefusal('REPLAY_MEDIA_DATABASE_URL is required on the Replay pool');
  return new PgReplayDatabase(url, replayPoolSizeOf(env));
}

/**
 * V-28 / V-33: the session AUTHENTICATED as the Replay role itself (session_user, not only current_user: a superuser
 * login that sets the role at connection time, `options=-c role=…`, or any member role that SET ROLEs into it, can leave
 * the role again and is refused), the role belongs to no other role (it can SET ROLE to nothing), it keeps its approved
 * limits, and it holds no table privilege and no superuser power. Refuses (throws) otherwise; the entry point then does
 * not start. The role is NOLOGIN in 0196: a deployment grants it LOGIN with its own credential (HOSTED-DEPLOY-01).
 */
export async function assertReplayDatabaseRole(db: ReplayDatabase): Promise<void> {
  const [role] = await db.query<{
    session_user: string; current_user: string; rolconnlimit: number; rolconfig: string[] | null; rolsuper: boolean;
    rolbypassrls: boolean; memberships: number;
  }>(
    `SELECT session_user, current_user, r.rolconnlimit, r.rolconfig, r.rolsuper, r.rolbypassrls,
            (SELECT count(*)::int FROM pg_catalog.pg_auth_members m WHERE m.member = r.oid) AS memberships
       FROM pg_catalog.pg_roles r WHERE r.rolname = session_user`, []);
  if (role === undefined || role.session_user !== REPLAY_DATABASE_ROLE || role.current_user !== REPLAY_DATABASE_ROLE) {
    throw new ReplayDatabaseRefusal(`the Replay pool connects only as ${REPLAY_DATABASE_ROLE}`);
  }
  if (Number(role.memberships) !== 0) throw new ReplayDatabaseRefusal('the Replay role must belong to no other role');
  if (role.rolsuper || role.rolbypassrls) throw new ReplayDatabaseRefusal('the Replay role must not be a superuser or bypass RLS');
  if (Number(role.rolconnlimit) !== REPLAY_ROLE_CONNECTION_LIMIT) {
    throw new ReplayDatabaseRefusal(`the Replay role's CONNECTION LIMIT must be ${REPLAY_ROLE_CONNECTION_LIMIT}`);
  }
  const config = new Map((role.rolconfig ?? []).map((entry) => {
    const at = entry.indexOf('=');
    return [entry.slice(0, at), entry.slice(at + 1)] as const;
  }));
  for (const [name, value] of Object.entries(REPLAY_ROLE_SETTINGS)) {
    if (config.get(name) !== value) throw new ReplayDatabaseRefusal(`the Replay role's ${name} must be ${value}`);
  }
  const [{ n }] = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.role_table_grants g WHERE g.grantee = current_user`, []);
  if (n !== 0) throw new ReplayDatabaseRefusal('the Replay role must hold no table privilege');
}
