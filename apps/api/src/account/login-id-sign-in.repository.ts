import { Injectable } from '@nestjs/common';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

/**
 * W2-01 — the one server-only lookup behind a Login ID sign-in: the Email of the account holding a
 * canonical Login ID, or null (migration 0124, `resolve_login_id_sign_in_email_v1`, executable by the
 * server channel only). Its answer never leaves the sign-in exchange that asked for it.
 */
@Injectable()
export class LoginIdSignInRepository {
  constructor(private readonly serviceApi: SupabaseServiceRoleApiService) {}

  async signInAddressOf(canonicalLoginId: string): Promise<string | null> {
    const answer = await this.serviceApi.rpc<unknown>('resolve_login_id_sign_in_email_v1', { p_login_id: canonicalLoginId });
    return typeof answer === 'string' && answer !== '' ? answer : null;
  }
}
