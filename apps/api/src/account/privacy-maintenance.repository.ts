import { Injectable } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

/** A deletion the server must advance now (migration 0130 `server_claim_due_account_deletions_v1`). */
export interface DueDeletion {
  readonly deletionId: string;
  readonly userId: string;
  readonly status: 'SCHEDULED' | 'ERASED';
}

/**
 * PROD-OPS-01 — the aggregate Privacy & Data operational state (migration 0132
 * `server_read_privacy_operations_summary_v1`). Counts and ages in whole seconds only: no identity of any kind.
 */
export interface PrivacyOperationsSummary {
  readonly exportPreparing: number;
  readonly exportRetrying: number;
  readonly exportStuckPreparing: number;
  readonly exportStuckPreparingOldestAgeSeconds: number;
  readonly exportFailedTotal: number;
  readonly exportFailedRecent: number;
  readonly exportRecentFailuresTransientDatabase: number;
  readonly exportRecentFailuresConstraintOrIntegrity: number;
  readonly exportRecentFailuresResourceOrCapacity: number;
  readonly exportRecentFailuresInternalOther: number;
  readonly deletionStuckDue: number;
  readonly deletionStuckDueOldestAgeSeconds: number;
  readonly deletionStuckProviderPending: number;
  readonly deletionStuckProviderPendingOldestAgeSeconds: number;
}

/** The database's answer to a server pass had a shape no migration produces. Carries no answer content. */
export class PrivacyMaintenanceAnswerError extends Error {
  constructor() {
    super('Privacy maintenance answer was malformed.');
    this.name = 'PrivacyMaintenanceAnswerError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const SUMMARY_COLUMNS: ReadonlyArray<readonly [keyof PrivacyOperationsSummary, string]> = [
  ['exportPreparing', 'export_preparing'],
  ['exportRetrying', 'export_retrying'],
  ['exportStuckPreparing', 'export_stuck_preparing'],
  ['exportStuckPreparingOldestAgeSeconds', 'export_stuck_preparing_oldest_age_seconds'],
  ['exportFailedTotal', 'export_failed_total'],
  ['exportFailedRecent', 'export_failed_recent'],
  ['exportRecentFailuresTransientDatabase', 'export_recent_failures_transient_database'],
  ['exportRecentFailuresConstraintOrIntegrity', 'export_recent_failures_constraint_or_integrity'],
  ['exportRecentFailuresResourceOrCapacity', 'export_recent_failures_resource_or_capacity'],
  ['exportRecentFailuresInternalOther', 'export_recent_failures_internal_other'],
  ['deletionStuckDue', 'deletion_stuck_due'],
  ['deletionStuckDueOldestAgeSeconds', 'deletion_stuck_due_oldest_age_seconds'],
  ['deletionStuckProviderPending', 'deletion_stuck_provider_pending'],
  ['deletionStuckProviderPendingOldestAgeSeconds', 'deletion_stuck_provider_pending_oldest_age_seconds'],
];

/**
 * W3-MEGA-S — the server's own Privacy & Data passes, on the server channel only (the database grants them to the
 * service role and to no client). No client token and no client-supplied id ever reaches them: the ids they act on
 * come from the database's own claim.
 */
@Injectable()
export class PrivacyMaintenanceRepository {
  constructor(private readonly serviceApi: SupabaseServiceRoleApiService) {}

  /** Prepare pending export packages and discard expired ones. Returns how many were prepared. */
  async prepareExports(limit: number): Promise<number> {
    const prepared = await this.serviceApi.rpc<unknown>('server_prepare_data_exports_v1', { p_limit: limit });
    if (typeof prepared !== 'number') throw new PrivacyMaintenanceAnswerError();
    return prepared;
  }

  /** Lease the deletions that are due: past their grace period, or erased with the provider account still to remove. */
  async claimDueDeletions(limit: number): Promise<DueDeletion[]> {
    const rows = await this.serviceApi.rpc<unknown>('server_claim_due_account_deletions_v1', { p_limit: limit });
    if (!Array.isArray(rows)) throw new PrivacyMaintenanceAnswerError();
    return rows.flatMap((row: unknown) => {
      if (typeof row !== 'object' || row === null) return [];
      const r = row as { deletion_id?: unknown; user_id?: unknown; deletion_status?: unknown };
      if (typeof r.deletion_id !== 'string' || !UUID.test(r.deletion_id) || typeof r.user_id !== 'string' || !UUID.test(r.user_id)) return [];
      if (r.deletion_status !== 'SCHEDULED' && r.deletion_status !== 'ERASED') return [];
      return [{ deletionId: r.deletion_id, userId: r.user_id, status: r.deletion_status }];
    });
  }

  /** The ONE governed Personal erasure. Its outcome is the database's own word. */
  async erase(deletionId: string): Promise<string> {
    const outcome = await this.serviceApi.rpc<unknown>('server_erase_personal_account_v1', { p_deletion_id: deletionId });
    return typeof outcome === 'string' ? outcome : 'UNKNOWN';
  }

  /** Record that the provider account is gone. */
  async complete(deletionId: string): Promise<string> {
    const outcome = await this.serviceApi.rpc<unknown>('server_complete_account_deletion_v1', { p_deletion_id: deletionId });
    return typeof outcome === 'string' ? outcome : 'UNKNOWN';
  }

  /** PROD-OPS-01 — the aggregate operational state, decoded strictly: exactly one row of non-negative whole numbers. */
  async readOperationsSummary(): Promise<PrivacyOperationsSummary> {
    const rows = await this.serviceApi.rpc<unknown>('server_read_privacy_operations_summary_v1', {});
    if (!Array.isArray(rows) || rows.length !== 1 || typeof rows[0] !== 'object' || rows[0] === null) throw new PrivacyMaintenanceAnswerError();
    const row = rows[0] as Record<string, unknown>;
    const summary: Partial<Record<keyof PrivacyOperationsSummary, number>> = {};
    for (const [field, column] of SUMMARY_COLUMNS) {
      const value = row[column];
      if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new PrivacyMaintenanceAnswerError();
      summary[field] = value;
    }
    return summary as PrivacyOperationsSummary;
  }
}
