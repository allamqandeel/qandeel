import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

/** The owner's own Name and Login ID, exactly as `read_own_account_identity_v1` (migration 0129) returns them. */
export interface AccountIdentityRow {
  readonly name: string | null;
  readonly login_id: string | null;
}

/** `change_own_account_name_v1` (0129): a bounded outcome and the owner's resulting Name. */
export interface AccountNameChangeRow {
  readonly outcome: string;
  readonly current_name: string | null;
}

/** `change_own_login_id_v1` (0129): a bounded outcome and the owner's resulting Login ID. */
export interface AccountLoginIdChangeRow {
  readonly outcome: string;
  readonly current_login_id: string | null;
}

/**
 * W3-MEGA-A — the account row's identity read and its two owner changes. Every call runs on a token, never the server
 * channel, so the database's own row-level security and `auth.uid()` decide whose row is read or written; no account
 * id is ever sent as authority.
 *
 * The Login ID change runs on the PROOF token the owner's password just earned from the provider: migration 0129
 * refuses it unless that token carries a recent password authentication, so the database itself holds the
 * reauthentication, not this server.
 */
@Injectable()
export class AccountIdentityRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  async readIdentity(accessToken: string): Promise<AccountIdentityRow | undefined> {
    const rows = await this.dataApi.request<AccountIdentityRow[]>(accessToken, 'rpc/read_own_account_identity_v1', { method: 'POST', body: '{}' });
    return Array.isArray(rows) ? rows[0] : undefined;
  }

  async changeName(accessToken: string, name: string): Promise<AccountNameChangeRow | undefined> {
    const rows = await this.dataApi.request<AccountNameChangeRow[]>(accessToken, 'rpc/change_own_account_name_v1', {
      method: 'POST',
      body: JSON.stringify({ p_name: name }),
    });
    return Array.isArray(rows) ? rows[0] : undefined;
  }

  async changeLoginId(proofToken: string, commandId: string, loginId: string): Promise<AccountLoginIdChangeRow | undefined> {
    const rows = await this.dataApi.request<AccountLoginIdChangeRow[]>(proofToken, 'rpc/change_own_login_id_v1', {
      method: 'POST',
      body: JSON.stringify({ p_command_id: commandId, p_login_id: loginId }),
    });
    return Array.isArray(rows) ? rows[0] : undefined;
  }
}
