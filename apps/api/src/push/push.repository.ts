import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import type { AttemptState, ClaimedAttempt } from './push.types';

/** One device sync, exactly migration 0137's owner command parameters. */
export interface DeviceSync {
  readonly p_installation_id: string; readonly p_platform: string; readonly p_token: string | null;
  readonly p_apns_environment: string | null; readonly p_os_permission: string; readonly p_time_zone: string;
  readonly p_locale: string; readonly p_app_version: string | null;
}

/**
 * Migration 0137. Owner commands run with the CALLER'S token (the owner is `auth.uid()`; no command takes an account);
 * the three server passes run on the server channel only, and no route reaches them. Nothing here reads a token back
 * to a client.
 */
@Injectable()
export class PushRepository {
  constructor(private readonly dataApi: SupabaseDataApiService, private readonly server: SupabaseServiceRoleApiService) {}

  sync(token: string, sync: DeviceSync): Promise<{ readonly outcome: string }[]> {
    return this.dataApi.request<{ readonly outcome: string }[]>(token, 'rpc/sync_own_push_device_v1', { method: 'POST', body: JSON.stringify(sync) });
  }

  detach(token: string, installationId: string): Promise<{ readonly outcome: string }[]> {
    return this.dataApi.request<{ readonly outcome: string }[]>(token, 'rpc/detach_own_push_device_v1', {
      method: 'POST', body: JSON.stringify({ p_installation_id: installationId }),
    });
  }

  detachOthers(token: string, installationId: string): Promise<{ readonly detached: number }[]> {
    return this.dataApi.request<{ readonly detached: number }[]>(token, 'rpc/detach_own_other_push_devices_v1', {
      method: 'POST', body: JSON.stringify({ p_installation_id: installationId }),
    });
  }

  recordOpen(token: string, installationId: string, itemId: string): Promise<{ readonly outcome: string }[]> {
    return this.dataApi.request<{ readonly outcome: string }[]>(token, 'rpc/record_own_push_open_v1', {
      method: 'POST', body: JSON.stringify({ p_installation_id: installationId, p_item_id: itemId }),
    });
  }

  /** Server channel only. */
  plan(limit: number): Promise<{ readonly planned: number }[]> {
    return this.server.rpc<{ readonly planned: number }[]>('server_plan_push_attempts_v1', { p_limit: limit });
  }

  /** Server channel only. */
  async claim(limit: number, leaseSeconds: number, claimToken: string): Promise<ClaimedAttempt[]> {
    const rows = await this.server.rpc<{ readonly claim: ClaimedAttempt }[]>('server_claim_push_attempts_v1', {
      p_limit: limit, p_lease_seconds: leaseSeconds, p_claim_token: claimToken,
    });
    if (!Array.isArray(rows)) throw new Error('PUSH_CLAIM_MALFORMED');
    return rows.map((row) => row.claim);
  }

  /** Server channel only. */
  record(attemptId: string, claimToken: string, state: AttemptState, reason: string | null, nextAttemptAt: string | null,
    disclosureLevel: string | null, counted: boolean): Promise<{ readonly outcome: string }[]> {
    return this.server.rpc<{ readonly outcome: string }[]>('server_record_push_attempt_v1', {
      p_attempt_id: attemptId, p_claim_token: claimToken, p_state: state, p_reason: reason, p_next_attempt_at: nextAttemptAt,
      p_disclosure_level: disclosureLevel, p_counted: counted,
    });
  }
}
