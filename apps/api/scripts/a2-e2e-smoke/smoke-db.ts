// Shared transaction-isolated PostgreSQL session for the A2 end-to-end runtime
// smoke. One pg.Client, one outer BEGIN ... ROLLBACK: every smoke-only
// transport adapter shares this connection, so the entire database fixture is
// discarded atomically at the end and no developer database is ever truncated.
//
// Each adapter call runs inside its own SAVEPOINT with an explicit SET LOCAL
// ROLE, mirroring the per-request transaction + role that PostgREST gives every
// production Data API call. A failed call rolls back only its own savepoint,
// exactly like a failed PostgREST request, so canonical error paths cannot
// poison the outer smoke transaction.
//
// This file contains transport plumbing only — no business logic, no authority
// rules, no Evidence/Hypothesis/Confidence semantics.
/// <reference path="./pg.d.ts" />
import { Client } from 'pg';

export type SmokeDbRole = 'postgres' | 'service_role' | 'authenticated' | 'anon';

// PostgREST serializes every row to JSON, so timestamptz columns reach the
// application as strings. node-pg parses them to Date objects instead; this
// restores the exact transport representation the production TypeScript
// contracts were written against. Values that are already JSON-compatible
// (uuid/text/int/float/bool/jsonb/arrays) pass through unchanged.
export function toTransportRow<T>(row: Record<string, unknown>): T {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    mapped[key] = value instanceof Date ? value.toISOString() : value;
  }
  return mapped as T;
}

export class SmokeDbSession {
  private readonly client: Client;
  private savepointCounter = 0;
  private serialQueue: Promise<unknown> = Promise.resolve();

  constructor(connectionString: string) {
    this.client = new Client({ connectionString });
  }

  async open(): Promise<void> {
    await this.client.connect();
    await this.client.query('BEGIN');
  }

  /**
   * All calls share ONE physical connection, so each multi-statement request
   * must run atomically: real services legitimately issue concurrent Data API
   * requests (e.g. Promise.all([evidence, hypotheses])), and interleaving two
   * SAVEPOINT/RELEASE sequences would let one call's RELEASE destroy the
   * other's savepoint. Serializing is exactly what a one-connection PostgREST
   * pool does; request semantics are unchanged.
   */
  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = this.serialQueue.then(work, work);
    this.serialQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  /** Fixture setup and observer assertions only (spec: postgres role). */
  observer<R = Record<string, unknown>>(text: string, values: readonly unknown[] = []): Promise<R[]> {
    return this.serialize(async () => {
      await this.client.query('RESET ROLE');
      const result = await this.client.query<Record<string, unknown>>(text, values);
      return result.rows.map((row) => toTransportRow<R>(row));
    });
  }

  /**
   * One production-equivalent Data API request: savepoint + SET LOCAL ROLE +
   * query, released on success and rolled back (with the original error
   * rethrown) on failure — the per-call atomicity PostgREST provides.
   */
  asRole<R = Record<string, unknown>>(role: SmokeDbRole, text: string, values: readonly unknown[] = []): Promise<R[]> {
    return this.serialize(async () => {
      const savepoint = `a2_smoke_rpc_${++this.savepointCounter}`;
      await this.client.query(`SAVEPOINT ${savepoint}`);
      try {
        await this.client.query('RESET ROLE');
        if (role !== 'postgres') await this.client.query(`SET LOCAL ROLE ${role}`);
        const result = await this.client.query<Record<string, unknown>>(text, values);
        await this.client.query(`RELEASE SAVEPOINT ${savepoint}`);
        await this.client.query('RESET ROLE');
        return result.rows.map((row) => toTransportRow<R>(row));
      } catch (error) {
        await this.client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        await this.client.query(`RELEASE SAVEPOINT ${savepoint}`);
        throw error;
      }
    });
  }

  /** Transaction-local JWT claims, exactly what PostgREST sets for a user request. */
  async setAuthenticatedClaims(userId: string): Promise<void> {
    await this.observer('SELECT set_config($1, $2, true)', ['request.jwt.claims', JSON.stringify({ sub: userId })]);
  }

  async clearAuthenticatedClaims(): Promise<void> {
    await this.observer('SELECT set_config($1, $2, true)', ['request.jwt.claims', '']);
  }

  rollback(): Promise<void> {
    return this.serialize(async () => {
      await this.client.query('ROLLBACK');
    });
  }

  /** Post-rollback verification queries (outside the smoke transaction). */
  afterRollback<R = Record<string, unknown>>(text: string, values: readonly unknown[] = []): Promise<R[]> {
    return this.serialize(async () => {
      const result = await this.client.query<Record<string, unknown>>(text, values);
      return result.rows.map((row) => toTransportRow<R>(row));
    });
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}
