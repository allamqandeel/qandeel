import { randomUUID } from 'node:crypto';
import { AiProviderCallAccounting } from '../src/ai-usage/ai-provider-call-accounting';
import { SupabaseAiProviderCallLedger, type AiLedgerRpc } from '../src/ai-usage/ai-provider-call-ledger.repository';
import { runWithAiUsageAttribution } from '../src/ai-usage/ai-usage-attribution';
import { accountedDeepSeekChatCompletionsClient } from '../src/ai-usage/accounted-provider-clients';
import { DeepSeekModelRouter } from '../src/model-router/providers/deepseek/deepseek-model-router';
import { createDeepSeekClient } from '../src/model-router/providers/deepseek/deepseek-client';
import { loadDeepSeekModelRouterConfig } from '../src/model-router/providers/deepseek/deepseek-model-router.config';
import { correlation } from '../src/observability/shared-correlation';
import { TelemetryService } from '../src/observability/telemetry.service';

// S8A-02 (Product Owner D3) — the AI-COST-01 accounting of a DeepSeek-only brain-eval run. Operator-only: never imported by
// production code and never a CI step.
//
// The production composition, unchanged: `DeepSeekModelRouter.fromEnvironment(telemetry, accounting)`, whose transport is
// the accounted client, over `AiProviderCallAccounting` and `SupabaseAiProviderCallLedger`. Only the ledger's server channel
// differs: production reaches `begin_ai_provider_call_v1` / `settle_ai_provider_call_v1` through the Data API; here the same
// two RPCs run as `service_role` on the disposable local PostgreSQL 17 that `scripts/ci-01/local-db.mjs` builds from every
// migration (the CP4 recipe). Each case is attributed to its own synthetic account, so its ledger rows are its own.

interface PgClient {
  connect(): Promise<void>;
  query(text: string, values?: ReadonlyArray<unknown>): Promise<{ rows: Array<Record<string, unknown>> }>;
  end(): Promise<void>;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Client } = require('pg') as { Client: new (config: Record<string, unknown>) => PgClient };

const LEDGER_RPC = new Set(['begin_ai_provider_call_v1', 'settle_ai_provider_call_v1']);
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/u;

export interface LedgerRow {
  provider: string; requestedModel: string; operation: string; featureFamily: string; processingPath: string | null;
  attemptNumber: number; callState: string; usageCompleteness: string; usage: Record<string, string> | null; ratingState: string | null;
}

export interface DeepSeekEvaluationLedger {
  readonly router: DeepSeekModelRouter;
  /** Runs one case's provider work attributed to a fresh synthetic account; returns the account id with the result. */
  attribute<T>(work: () => Promise<T>): Promise<{ userId: string; value?: T; error?: unknown }>;
  ledgerRowsFor(userId: string): Promise<ReadonlyArray<LedgerRow>>;
  close(): Promise<void>;
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`NOT RUN: ${name} is required (the disposable local ledger database).`);
  return value;
}

/**
 * CP3 Arm L: an evaluation-only DEEP max_tokens for the diagnostic re-send. The router is composed exactly as production
 * composes it (accounted client, same config) with only that one number changed; production configuration is untouched.
 */
export interface DeepSeekEvaluationLedgerOptions { readonly diagnosticDeepMaxOutputTokens?: number }

export async function openDeepSeekEvaluationLedger(
  environment: NodeJS.ProcessEnv, options: DeepSeekEvaluationLedgerOptions = {},
): Promise<DeepSeekEvaluationLedger> {
  const port = Number(required(environment, 'QANDEEL_EVAL_LEDGER_DB_PORT'));
  const database = required(environment, 'QANDEEL_EVAL_LEDGER_DB_NAME');
  const dataDirectory = required(environment, 'QANDEEL_EVAL_LEDGER_DB_DATA_DIR');
  const client = new Client({
    host: '127.0.0.1', port, database, user: 'postgres', password: required(environment, 'QANDEEL_EVAL_LEDGER_DB_PASSWORD'), connectionTimeoutMillis: 10_000,
  });
  await client.connect();
  // Positive identity proof before anything is written: loopback, our port, our database and data directory, PostgreSQL 17.
  const [identity] = (await client.query(`SELECT host(inet_server_addr()) AS addr, inet_server_port() AS port, current_database() AS db,
    current_setting('server_version_num') AS version, current_setting('data_directory') AS dir`)).rows;
  const normalize = (path: unknown) => String(path).replaceAll('\\', '/').replace(/\/+$/u, '').toLowerCase();
  if (identity.addr !== '127.0.0.1' || Number(identity.port) !== port || identity.db !== database
    || !String(identity.version).startsWith('17') || normalize(identity.dir) !== normalize(dataDirectory)) {
    await client.end();
    throw new Error('NOT RUN: the ledger database is not the disposable local cluster this run started.');
  }

  let queue: Promise<unknown> = Promise.resolve();
  const serialize = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work, work);
    queue = next.then(() => undefined, () => undefined);
    return next;
  };
  const serviceApi: AiLedgerRpc = {
    rpc: <T>(name: string, body: Record<string, unknown>) => serialize(async () => {
      if (!LEDGER_RPC.has(name)) throw new Error(`the evaluation ledger channel serves the two ledger RPCs only, not ${name}`);
      const entries = Object.entries(body);
      if (!entries.every(([key]) => IDENTIFIER.test(key))) throw new Error('invalid RPC argument name');
      const text = `SELECT * FROM public.${name}(${entries.map(([key], index) => `${key} => $${index + 1}`).join(', ')})`;
      await client.query('BEGIN');
      try {
        await client.query('SET LOCAL ROLE service_role');
        const result = await client.query(text, entries.map(([, value]) => (value !== null && typeof value === 'object' ? JSON.stringify(value) : value)));
        await client.query('COMMIT');
        return result.rows as T;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }),
  };

  const telemetry = new TelemetryService(correlation);
  const accounting = new AiProviderCallAccounting(new SupabaseAiProviderCallLedger(serviceApi), telemetry, () => correlation.current());
  const deepMax = options.diagnosticDeepMaxOutputTokens;
  let router: DeepSeekModelRouter;
  if (deepMax === undefined) {
    router = DeepSeekModelRouter.fromEnvironment(telemetry, accounting);
  } else {
    const config = loadDeepSeekModelRouterConfig();
    const diagnostic = { ...config, maxOutputTokens: { ...config.maxOutputTokens, DEEP: deepMax } as unknown as typeof config.maxOutputTokens };
    router = new DeepSeekModelRouter(diagnostic, accountedDeepSeekChatCompletionsClient(createDeepSeekClient(diagnostic), 'CONVERSATION_REPLY', accounting), telemetry);
  }

  return {
    router,
    async attribute<T>(work: () => Promise<T>) {
      const userId = randomUUID();
      await serialize(() => client.query('INSERT INTO auth.users (id) VALUES ($1)', [userId]));
      try {
        return { userId, value: await runWithAiUsageAttribution({ userId }, work) };
      } catch (error) {
        return { userId, error };
      }
    },
    async ledgerRowsFor(userId: string) {
      const { rows } = await serialize(() => client.query(`SELECT c.provider, c.requested_model, c.operation, c.feature_family, c.processing_path,
          c.attempt_number, c.call_state, c.usage_completeness,
          (SELECT json_object_agg(u.usage_kind, u.quantity::text) FROM public.ai_provider_call_usage u WHERE u.provider_call_id = c.id) AS usage,
          (SELECT r.rating_state FROM public.ai_cost_ratings r WHERE r.provider_call_id = c.id AND r.is_canonical) AS rating_state
        FROM public.ai_provider_calls c WHERE c.user_id = $1 ORDER BY c.started_at`, [userId]));
      return rows.map((row) => ({
        provider: String(row.provider), requestedModel: String(row.requested_model), operation: String(row.operation),
        featureFamily: String(row.feature_family), processingPath: row.processing_path === null ? null : String(row.processing_path),
        attemptNumber: Number(row.attempt_number), callState: String(row.call_state), usageCompleteness: String(row.usage_completeness),
        usage: (row.usage as Record<string, string> | null) ?? null, ratingState: row.rating_state === null ? null : String(row.rating_state),
      }));
    },
    close: () => client.end(),
  };
}
