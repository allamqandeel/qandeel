// Smoke-only PostgreSQL transport substitutes for the foreground Supabase
// PostgREST boundaries used by the Full Intelligence End-to-End Runtime smoke:
//
//   * SupabaseDataApiService / MemoryDataApiService (authenticated channel)
//   * SupabaseServiceRoleApiService (server conversation authority channel)
//
// The production repositories (ConversationRepository, MemoryRepository,
// HypothesisRepository, ConfidenceRepository, HimRepository) stay REAL and
// unchanged above these adapters; CI provides PostgreSQL 17 without PostgREST,
// so each adapter executes the identical canonical reads and SECURITY DEFINER
// RPCs directly through the shared transaction-scoped pg client, with the same
// per-request role that PostgREST would set. The translation below is bounded
// to exactly the request shapes those frozen production repositories emit and
// fails closed on anything else.
//
// These adapters contain NO business logic and decide NO intelligence policy:
// filtering, ordering, limits and field lists are the production repositories'
// own; ownership comes from RLS plus the canonical definer commands; and every
// write authority remains a canonical database function. No derived table is
// ever written directly here — the table path is SELECT-only by construction.
import type { SmokeDbSession, SmokeDbRole } from '../a2-e2e-smoke/smoke-db';

const READABLE_TABLES = new Set([
  'conversation_sessions',
  'conversation_turns',
  'memories',
  'hypotheses',
  'confidence_evaluations',
]);
const AUTHENTICATED_RPC_ALLOWLIST = new Set([
  'create_conversation_session_v1',
  'create_user_conversation_turn',
  'read_him_intelligence_snapshot_v1',
  // QHIA-005: the one-request QHIA-004 batch transport for the foreground
  // hbs.reflection selective read (migration 0054, read-only).
  'read_him_contextual_current_intelligence_batch_v1',
  // QHIA-009/QHIA-010/QHIA-011: the ONE cross-context foreground aggregate
  // transport (migration 0060 aggregate v3, read-only). It wraps the
  // already-proven migration-0059 aggregate v2 - itself wrapping the
  // migration-0058 aggregate v1 over the migration-0056 Situation-stress and
  // migration-0057 Decision-attention authorities, plus the migration-0059
  // Goal-motivation authority - and the migration-0060
  // Relationship-communication authority server-side, all of which compose the
  // QHIA-006 relevance authority with the QHIA-004 batch authority. So no
  // binding-read request, no separate per-channel request, and no dormant
  // hse.self-confidence, Situation-bound Motivation, or sibling HRS read
  // appears anywhere on this allowlist.
  //
  // The retired aggregate-v1 and aggregate-v2 endpoints and the four direct
  // per-channel RPCs are deliberately ABSENT. They remain canonical database
  // authorities, independently verified by their own migrations and verifiers;
  // this allowlist is smoke-only and describes the exact foreground transport
  // the production Orchestrator is supposed to use. Keeping any of them here
  // would let a regression back to a retired request shape pass unnoticed, and
  // the transport census below would have nothing to catch.
  'read_him_session_cross_context_foreground_v3',
  // QHIA-011A: the explicit session context activation command (migration
  // 0055 set), reached ONLY through the new authenticated product application
  // entry during smoke SETUP - never from a conversation turn.
  //
  // It is on this allowlist so the smoke can prove, by census, that the
  // deliberate explicit activation really executed against real PostgreSQL
  // exactly once, rather than being silently refused. Its sibling clear and
  // read commands are deliberately ABSENT: this smoke performs neither, and
  // leaving them off is what makes "the activation entry is a separate
  // one-shot product command, not a per-turn foreground request" checkable.
  'set_him_session_context_binding_v1',
]);
const SERVICE_ROLE_RPC_ALLOWLIST = new Set([
  'claim_conversation_turn',
  'finalize_conversation_turn',
  'fail_conversation_turn',
]);
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/u;
const SELECT_LIST = /^[a-z_][a-z0-9_,]*$/u;

/**
 * Smoke-only authenticated RPC transport census.
 *
 * It records what the frozen PRODUCTION repositories actually ASKED this
 * substitute for - before any allowlist decision - and, separately, what
 * actually completed against real PostgreSQL. Both halves matter:
 *
 *   * recording the ATTEMPT before the allowlist check makes "zero direct
 *     per-channel foreground attempts" a claim about production behaviour
 *     rather than a restatement of what this allowlist happens to permit;
 *   * recording COMPLETION separately is what distinguishes "the RPC really
 *     ran and returned an authoritative answer" from "the RPC was rejected and
 *     an optional foreground enrichment silently degraded" - two states that a
 *     pass/fail smoke result alone cannot tell apart.
 *
 * This is verification instrumentation and lives entirely inside the
 * verification-only PostgREST substitute: no production service, repository,
 * or orchestrator is instrumented, and nothing here changes what production
 * requests or how it behaves.
 */
export class SmokeAuthenticatedRpcCensus {
  private readonly attempted = new Map<string, number>();
  private readonly completed = new Map<string, number>();
  private readonly failed = new Map<string, number>();

  private static bump(counts: Map<string, number>, name: string): void {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  recordAttempt(name: string): void { SmokeAuthenticatedRpcCensus.bump(this.attempted, name); }
  recordCompletion(name: string): void { SmokeAuthenticatedRpcCensus.bump(this.completed, name); }
  recordFailure(name: string): void { SmokeAuthenticatedRpcCensus.bump(this.failed, name); }

  attempts(name: string): number { return this.attempted.get(name) ?? 0; }
  completions(name: string): number { return this.completed.get(name) ?? 0; }
  failures(name: string): number { return this.failed.get(name) ?? 0; }
  attemptedNames(): string[] { return [...this.attempted.keys()].sort(); }
}

function unsupported(detail: string): never {
  throw new Error(`FULL_INTELLIGENCE_E2E_UNSUPPORTED_DATA_API_REQUEST:${detail}`);
}

function identifier(value: string): string {
  if (!IDENTIFIER.test(value)) unsupported('identifier');
  return value;
}

interface TranslatedQuery {
  text: string;
  values: unknown[];
}

/**
 * Bounded translation of the exact PostgREST read-query dialect the frozen
 * production repositories use (eq / not.eq / gt / is.null / in.(...) filters,
 * the two production `or=` shapes, order and limit). Anything outside that
 * dialect fails closed. This is transport plumbing only — every SELECT shape
 * originates verbatim in a production repository.
 */
function translateTableRead(table: string, queryString: string): TranslatedQuery {
  if (!READABLE_TABLES.has(table)) unsupported(`table:${table}`);
  const params = new URLSearchParams(queryString);
  const values: unknown[] = [];
  const conditions: string[] = [];
  let columns = '*';
  let orderBy = '';
  let limit = '';

  const bind = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };

  const simpleCondition = (column: string, expression: string): string => {
    const col = identifier(column);
    if (expression.startsWith('eq.')) return `${col} = ${bind(expression.slice(3))}`;
    if (expression.startsWith('not.eq.')) return `${col} <> ${bind(expression.slice(7))}`;
    if (expression.startsWith('gt.')) return `${col} > ${bind(expression.slice(3))}`;
    if (expression === 'is.null') return `${col} IS NULL`;
    if (expression.startsWith('in.(') && expression.endsWith(')')) {
      const items = expression.slice(4, -1).split(',').filter((item) => item.length > 0);
      if (items.length === 0) unsupported('empty-in-list');
      return `${col} IN (${items.map((item) => bind(item)).join(', ')})`;
    }
    return unsupported(`filter:${expression.split('.')[0] ?? expression}`);
  };

  // The two exact production `or=` shapes:
  //   (expires_at.is.null,expires_at.gt.<ts>)          — MemoryRepository
  //   (and(target_id.eq.<id>,target_version.eq.<v>),…) — ConfidenceRepository
  const orCondition = (expression: string): string => {
    if (!expression.startsWith('(') || !expression.endsWith(')')) unsupported('or-shape');
    const inner = expression.slice(1, -1);
    if (inner.startsWith('and(')) {
      const groups = [...inner.matchAll(/and\(([a-z_]+)\.eq\.([^,()]+),([a-z_]+)\.eq\.([^,()]+)\)/gu)];
      if (groups.length === 0 || groups.map((group) => group[0]).join(',') !== inner) unsupported('or-and-shape');
      return `(${groups
        .map((group) => `(${identifier(group[1])} = ${bind(group[2])} AND ${identifier(group[3])} = ${bind(group[4])})`)
        .join(' OR ')})`;
    }
    const terms = inner.split(',');
    if (terms.length < 2) unsupported('or-term-count');
    return `(${terms
      .map((term) => {
        const dot = term.indexOf('.');
        if (dot <= 0) unsupported('or-term');
        return simpleCondition(term.slice(0, dot), term.slice(dot + 1));
      })
      .join(' OR ')})`;
  };

  for (const [key, value] of params.entries()) {
    if (key === 'select') {
      if (!SELECT_LIST.test(value)) unsupported('select');
      columns = value.split(',').map((column) => identifier(column)).join(', ');
    } else if (key === 'order') {
      orderBy = ` ORDER BY ${value
        .split(',')
        .map((segment) => {
          const [column, direction] = segment.split('.');
          if (direction !== 'asc' && direction !== 'desc') unsupported('order');
          return `${identifier(column)} ${direction.toUpperCase()}`;
        })
        .join(', ')}`;
    } else if (key === 'limit') {
      if (!/^\d{1,6}$/u.test(value)) unsupported('limit');
      limit = ` LIMIT ${Number(value)}`;
    } else if (key === 'or') {
      conditions.push(orCondition(value));
    } else {
      conditions.push(simpleCondition(key, value));
    }
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  return { text: `SELECT ${columns} FROM public.${table}${where}${orderBy}${limit}`, values };
}

function rpcCall(name: string, body: Record<string, unknown>): TranslatedQuery {
  const entries = Object.entries(body);
  const args = entries
    .map(([key], index) => `${identifier(key)} => $${index + 1}`)
    .join(', ');
  return {
    text: `SELECT * FROM public.${identifier(name)}(${args})`,
    values: entries.map(([, value]) => value),
  };
}

/**
 * Authenticated PostgREST channel substitute. Structurally compatible with
 * SupabaseDataApiService and MemoryDataApiService: request(accessToken, path,
 * init). The access token is transport metadata only — the authenticated
 * identity is the transaction-local request.jwt.claims the harness set, which
 * is exactly what PostgREST derives the JWT into for auth.uid()/RLS.
 */
export class PgAuthenticatedDataApiAdapter {
  // Smoke-only observability of this substitute's own traffic. Production is
  // unaware of it and unaffected by it.
  readonly rpcCensus = new SmokeAuthenticatedRpcCensus();

  constructor(private readonly db: SmokeDbSession) {}

  async request<T>(_accessToken: string, path: string, init: RequestInit = {}): Promise<T> {
    return executePostgrestRequest<T>(this.db, 'authenticated', AUTHENTICATED_RPC_ALLOWLIST, path, init, this.rpcCensus);
  }
}

/**
 * Server-only conversation authority channel substitute. Structurally
 * compatible with SupabaseServiceRoleApiService: rpc(name, body) with the
 * service_role transport identity and no user credential.
 */
export class PgConversationServiceRoleApiAdapter {
  constructor(private readonly db: SmokeDbSession) {}

  async rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
    if (!SERVICE_ROLE_RPC_ALLOWLIST.has(name)) unsupported(`service-role-rpc:${name}`);
    const { text, values } = rpcCall(name, body);
    return (await this.db.asRole('service_role', text, values)) as T;
  }
}

async function executePostgrestRequest<T>(
  db: SmokeDbSession,
  role: SmokeDbRole,
  rpcAllowlist: ReadonlySet<string>,
  path: string,
  init: RequestInit,
  census?: SmokeAuthenticatedRpcCensus,
): Promise<T> {
  if (path.startsWith('rpc/')) {
    const name = path.slice('rpc/'.length);
    // Recorded BEFORE the allowlist decision: this counts what production
    // asked for, so a request this substitute refuses is still observable.
    census?.recordAttempt(name);
    try {
      if (!rpcAllowlist.has(name)) unsupported(`rpc:${name}`);
      if ((init.method ?? 'POST') !== 'POST' || typeof init.body !== 'string') unsupported('rpc-method');
      const body = JSON.parse(init.body) as Record<string, unknown>;
      const { text, values } = rpcCall(name, body);
      const rows = (await db.asRole(role, text, values)) as T;
      census?.recordCompletion(name);
      return rows;
    } catch (error) {
      census?.recordFailure(name);
      throw error;
    }
  }
  if (init.method && init.method !== 'GET') unsupported('table-method');
  const queryIndex = path.indexOf('?');
  const table = queryIndex === -1 ? path : path.slice(0, queryIndex);
  const queryString = queryIndex === -1 ? '' : path.slice(queryIndex + 1);
  const { text, values } = translateTableRead(identifier(table), queryString);
  return (await db.asRole(role, text, values)) as T;
}
