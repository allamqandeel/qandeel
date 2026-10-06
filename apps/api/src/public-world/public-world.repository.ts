import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

/** Exactly the migration 0142 result shapes. */
export interface PublicEntryRow { readonly verdict: 'ALLOW' | 'UNAVAILABLE' }
export interface PublicDisplayRow { readonly label_mode: 'PSEUDONYM' | 'REAL_NAME'; readonly display_label: string | null; readonly real_name_available: boolean }
export interface PublicDisplayChangeRow { readonly outcome: 'UPDATED' | 'UNCHANGED' | 'UNAVAILABLE'; readonly label_mode: 'PSEUDONYM' | 'REAL_NAME'; readonly display_label: string | null }

/**
 * S5-01 — the Public World Product boundary's only transport. Every call runs on the caller's own token, so the
 * database derives the human from `auth.uid()`; no call names a user, a Public ref, a label, an audience or an authority.
 */
@Injectable()
export class PublicWorldRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  private rpc<T>(token: string, name: string, body: Record<string, unknown> = {}): Promise<T[]> {
    return this.dataApi.request<T[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  }

  entry(token: string): Promise<PublicEntryRow[]> {
    return this.rpc<PublicEntryRow>(token, 'read_public_world_entry_v1');
  }

  readDisplay(token: string): Promise<PublicDisplayRow[]> {
    return this.rpc<PublicDisplayRow>(token, 'read_own_public_display_v1');
  }

  setDisplayMode(token: string, mode: 'PSEUDONYM' | 'REAL_NAME'): Promise<PublicDisplayChangeRow[]> {
    return this.rpc<PublicDisplayChangeRow>(token, 'set_own_public_display_mode_v1', { p_label_mode: mode });
  }
}
