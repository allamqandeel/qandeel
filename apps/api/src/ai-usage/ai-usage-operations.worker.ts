import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { TelemetryService } from '../observability/telemetry.service';

/** Default cadence of the scan. An implementation detail, not Product authority. */
export const AI_USAGE_OPERATIONS_DEFAULT_POLL_MS = 60_000;

/** The aggregate accounting state (migration 0135 `server_read_ai_usage_operations_summary_v1`). Numbers only. */
export interface AiUsageOperationsSummary {
  readonly pendingCalls: number;
  readonly stalePendingCalls: number;
  readonly stalePendingOldestAgeSeconds: number;
  readonly settledCalls24h: number;
  readonly failedCalls24h: number;
  readonly cancelledCalls24h: number;
  readonly usageUnknownCalls24h: number;
  readonly ratedCalls24h: number;
  readonly unpricedCalls24h: number;
}

const COLUMNS = {
  pendingCalls: 'pending_calls',
  stalePendingCalls: 'stale_pending_calls',
  stalePendingOldestAgeSeconds: 'stale_pending_oldest_age_seconds',
  settledCalls24h: 'settled_calls_24h',
  failedCalls24h: 'failed_calls_24h',
  cancelledCalls24h: 'cancelled_calls_24h',
  usageUnknownCalls24h: 'usage_unknown_calls_24h',
  ratedCalls24h: 'rated_calls_24h',
  unpricedCalls24h: 'unpriced_calls_24h',
} as const satisfies Record<keyof AiUsageOperationsSummary, string>;

/** Reads the one aggregate row; anything that is not exactly non-negative whole numbers is an integrity failure. */
export function parseAiUsageOperationsSummary(rows: unknown): AiUsageOperationsSummary {
  if (!Array.isArray(rows) || rows.length !== 1 || !rows[0] || typeof rows[0] !== 'object') throw new Error('AI_USAGE_SUMMARY_INTEGRITY');
  const row = rows[0] as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [key, column] of Object.entries(COLUMNS)) {
    const value = typeof row[column] === 'string' ? Number(row[column]) : row[column];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('AI_USAGE_SUMMARY_INTEGRITY');
    out[key] = value;
  }
  return out as unknown as AiUsageOperationsSummary;
}

/**
 * AI-COST-01 - makes the accounting ledger's own health visible: open, stale (a crash between begin and settle: its
 * cost is unknown), unknown-usage and unpriced attempts, as content-free gauges. It reads one aggregate row with no
 * identity of any kind, decides nothing, and never touches a call, a rating or a provider.
 *
 * Enabled only where the server channel is configured, never under tests, and it can be switched off.
 */
@Injectable()
export class AiUsageOperationsWorker implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private stopped = false;

  constructor(private readonly serviceApi: SupabaseServiceRoleApiService, private readonly telemetry: TelemetryService) {}

  get enabled(): boolean {
    return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NODE_ENV !== 'test'
      && process.env.AI_USAGE_OPERATIONS_DISABLED !== 'true';
  }

  onModuleInit(): void {
    if (!this.enabled || this.stopped) return;
    const poll = Number(process.env.AI_USAGE_OPERATIONS_POLL_MS ?? AI_USAGE_OPERATIONS_DEFAULT_POLL_MS);
    this.timer = setInterval(() => void this.runOnce(), Number.isFinite(poll) && poll >= 1000 ? poll : AI_USAGE_OPERATIONS_DEFAULT_POLL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  async runOnce(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      const summary = parseAiUsageOperationsSummary(await this.serviceApi.rpc<unknown>('server_read_ai_usage_operations_summary_v1', {}));
      const t = this.telemetry;
      t.recordAiUsageOperationsState('pending', summary.pendingCalls);
      t.recordAiUsageOperationsState('stale_pending', summary.stalePendingCalls, summary.stalePendingOldestAgeSeconds);
      t.recordAiUsageOperationsState('settled_24h', summary.settledCalls24h);
      t.recordAiUsageOperationsState('failed_24h', summary.failedCalls24h);
      t.recordAiUsageOperationsState('cancelled_24h', summary.cancelledCalls24h);
      t.recordAiUsageOperationsState('usage_unknown_24h', summary.usageUnknownCalls24h);
      t.recordAiUsageOperationsState('rated_24h', summary.ratedCalls24h);
      t.recordAiUsageOperationsState('unpriced_24h', summary.unpricedCalls24h);
    } catch {
      // A failed scan is retried on the next cycle; it can never alter accounting or a Product answer.
    } finally {
      this.running = false;
    }
  }
}
