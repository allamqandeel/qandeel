import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

/** `read_own_privacy_state_v1` (migration 0130): the owner's export and deletion state, and nothing else. */
export interface PrivacyStateRow {
  readonly export_status: string;
  readonly export_available_until: string | null;
  readonly deletion_status: string;
  readonly deletion_final_at: string | null;
}

/** `request_own_data_export_v1` (0130). */
export interface ExportRequestRow {
  readonly outcome: string;
  readonly export_status: string;
  readonly available_until: string | null;
}

/** `read_own_data_export_v1` (0130): the package only while it is READY and available. */
export interface ExportReadRow {
  readonly export_status: string;
  readonly available_until: string | null;
  readonly content: Record<string, unknown> | null;
}

/** `request_own_account_deletion_v1` / `cancel_own_account_deletion_v1` (0130). */
export interface DeletionActRow {
  readonly outcome: string;
  readonly deletion_status: string;
  readonly final_at: string | null;
}

/**
 * W3-MEGA-S — the owner's Privacy & Data acts. Every call runs on a token, never the server channel, so the database's
 * `auth.uid()` decides whose export and whose account; no account id is ever sent.
 *
 * The two requests run on the PROOF token the owner's password just earned from the provider: migration 0130 refuses
 * them unless that token carries a recent password authentication (0129's check, reused), so the database itself holds
 * the re-authentication.
 */
@Injectable()
export class PrivacyDataRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  async readState(accessToken: string): Promise<PrivacyStateRow | undefined> {
    return this.first<PrivacyStateRow>(accessToken, 'rpc/read_own_privacy_state_v1', {});
  }

  async requestExport(proofToken: string, commandId: string): Promise<ExportRequestRow | undefined> {
    return this.first<ExportRequestRow>(proofToken, 'rpc/request_own_data_export_v1', { p_command_id: commandId });
  }

  async readExport(accessToken: string): Promise<ExportReadRow | undefined> {
    return this.first<ExportReadRow>(accessToken, 'rpc/read_own_data_export_v1', {});
  }

  async requestDeletion(proofToken: string, commandId: string): Promise<DeletionActRow | undefined> {
    return this.first<DeletionActRow>(proofToken, 'rpc/request_own_account_deletion_v1', { p_command_id: commandId });
  }

  async cancelDeletion(accessToken: string): Promise<DeletionActRow | undefined> {
    return this.first<DeletionActRow>(accessToken, 'rpc/cancel_own_account_deletion_v1', {});
  }

  private async first<T>(token: string, path: string, body: Record<string, string>): Promise<T | undefined> {
    const rows = await this.dataApi.request<T[]>(token, path, { method: 'POST', body: JSON.stringify(body) });
    return Array.isArray(rows) ? rows[0] : undefined;
  }
}
