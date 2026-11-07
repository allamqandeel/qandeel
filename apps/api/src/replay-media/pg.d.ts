// S8B-07 CP1-B — the subset of node-postgres (`pg`, already in the lockfile) the Replay pool uses. Declared here so no
// type package is added; the Replay pool is the only API-side code that opens a direct database connection (P-3).
declare module 'pg' {
  export interface QueryResult<R> {
    rows: R[];
    rowCount: number | null;
  }
  export interface PoolClient {
    query<R = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
    release(error?: Error | boolean): void;
  }
  export interface PoolConfig {
    connectionString?: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    application_name?: string;
    allowExitOnIdle?: boolean;
  }
  export class Pool {
    constructor(config?: PoolConfig);
    query<R = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
    on(event: 'error', listener: (error: Error) => void): this;
  }
}
