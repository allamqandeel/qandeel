import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

/** Exactly the migration 0141 owner-command shapes. */
export interface SharedWorldAlertRow { readonly world_id: string; readonly muted: boolean }
export interface SharedAlertsOutcomeRow { readonly outcome: 'MUTED' | 'UNMUTED' | 'UNAVAILABLE' }

/**
 * S4-04 — the per-World alert rows (D34; P3 §12.2) on the caller's OWN token, through migration 0141's two owner
 * commands. The database derives the human from `auth.uid()` and authorizes the exact World by the S4-01 entry law; no
 * account, World authority or mute row is ever sent.
 */
@Injectable()
export class SharedWorldAlertsRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  private async rpc<T>(token: string, name: string, body: Record<string, unknown> = {}): Promise<T[]> {
    const rows = await this.dataApi.request<T[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
    return Array.isArray(rows) ? rows : [];
  }

  list(token: string) { return this.rpc<SharedWorldAlertRow>(token, 'list_own_shared_world_alerts_v1'); }
  set(token: string, worldId: string, muted: boolean) {
    return this.rpc<SharedAlertsOutcomeRow>(token, 'set_own_shared_world_alerts_v1', { p_world_id: worldId, p_muted: muted });
  }
}
