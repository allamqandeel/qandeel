import { Injectable } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

/** A deletion the server must advance now (migration 0130 `server_claim_due_account_deletions_v1`). */
export interface DueDeletion {
  readonly deletionId: string;
  readonly userId: string;
  readonly status: 'SCHEDULED' | 'ERASED';
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

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
    return typeof prepared === 'number' ? prepared : 0;
  }

  /** Lease the deletions that are due: past their grace period, or erased with the provider account still to remove. */
  async claimDueDeletions(limit: number): Promise<DueDeletion[]> {
    const rows = await this.serviceApi.rpc<unknown>('server_claim_due_account_deletions_v1', { p_limit: limit });
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((row: unknown) => {
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
}
