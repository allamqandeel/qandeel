import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

/** One row of migration 0155's END boundary. */
export interface IntroductionEndRow { readonly outcome?: unknown }

/**
 * S6-02 — the ONE call, with the CALLER's token, to `end_own_introduction_v1` (migration 0155). The database derives
 * the human from `auth.uid()` and the participation-event identities from the command; nothing here takes an account,
 * a counterpart or an event.
 */
@Injectable()
export class IntroductionEndRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  end(accessToken: string, commandId: string, worldId: string): Promise<IntroductionEndRow[]> {
    return this.dataApi.request<IntroductionEndRow[]>(accessToken, 'rpc/end_own_introduction_v1', {
      method: 'POST', body: JSON.stringify({ p_command_id: commandId, p_world_id: worldId }),
    });
  }
}
