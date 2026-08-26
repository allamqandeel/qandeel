// Minimal ambient typing for the repository's root `pg` devDependency, which
// ships without bundled TypeScript declarations. Smoke-harness scope only:
// production API code never imports `pg`.
declare module 'pg' {
  export interface QueryResult<R = Record<string, unknown>> {
    rows: R[];
    rowCount: number | null;
  }
  export class Client {
    constructor(config?: { connectionString?: string });
    connect(): Promise<void>;
    end(): Promise<void>;
    query<R = Record<string, unknown>>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
  }
  const pg: { Client: typeof Client };
  export default pg;
}
