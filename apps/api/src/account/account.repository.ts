import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

/** The caller's own first-use facts, exactly as `read_account_first_use_v1` (migration 0123) returns them. */
export interface AccountFirstUseRow {
  readonly name: string | null;
  readonly welcome_completed: boolean;
  readonly has_conversed: boolean;
}

/**
 * W1B-01 — the account row's two Product reads and one Product write.
 *
 * The first-use read and the Welcome completion run on the CALLER's token, so the database's own
 * row-level security and `auth.uid()` decide whose row is touched; the caller's id is never sent as
 * authority. The Login ID availability check is the one pre-authentication question, and it goes to
 * the server channel only, because it must be answerable before an account session exists and no
 * client role may execute it.
 */
@Injectable()
export class AccountRepository {
  constructor(
    private readonly dataApi: SupabaseDataApiService,
    private readonly serviceApi: SupabaseServiceRoleApiService,
  ) {}

  async readFirstUse(accessToken: string): Promise<AccountFirstUseRow | undefined> {
    const rows = await this.dataApi.request<AccountFirstUseRow[]>(accessToken, 'rpc/read_account_first_use_v1', {
      method: 'POST',
      body: '{}',
    });
    return Array.isArray(rows) ? rows[0] : undefined;
  }

  async completeWelcome(accessToken: string): Promise<void> {
    await this.dataApi.request<void>(accessToken, 'rpc/complete_first_use_welcome_v1', { method: 'POST', body: '{}' });
  }

  async isLoginIdAvailable(loginId: string): Promise<boolean> {
    return (await this.serviceApi.rpc<boolean>('login_id_is_available_v1', { p_login_id: loginId })) === true;
  }
}
