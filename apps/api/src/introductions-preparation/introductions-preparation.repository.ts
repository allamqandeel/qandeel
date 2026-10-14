import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import type { CommandKind } from './introductions-preparation.types';

/**
 * S6-01 — every call with the CALLER's token, to the seven owner entry points of migration 0154. Each derives the
 * human from `auth.uid()` in the database; no method here takes an account parameter that reaches the database.
 */
@Injectable()
export class IntroductionsPreparationRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  private rpc(accessToken: string, name: string, body: Record<string, unknown> = {}): Promise<unknown> {
    return this.dataApi.request<unknown>(accessToken, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  }

  availability(accessToken: string): Promise<unknown> {
    return this.rpc(accessToken, 'read_matching_preparation_availability_v1');
  }

  read(accessToken: string): Promise<unknown> {
    return this.rpc(accessToken, 'read_own_matching_preparation_v1');
  }

  /** The bounded reader. It answers nothing unless both gates are open and the owner's consent is current. */
  priorItems(accessToken: string): Promise<unknown> {
    return this.rpc(accessToken, 'read_own_matching_onboarding_assistance_items_v1');
  }

  command(accessToken: string, commandId: string, expectedVersion: number, kind: CommandKind, payload: Record<string, unknown>): Promise<unknown> {
    return this.rpc(accessToken, 'apply_own_matching_preparation_command_v1', {
      p_command_id: commandId, p_expected_version: expectedVersion, p_kind: kind, p_payload: payload,
    });
  }

  discard(accessToken: string, commandId: string): Promise<unknown> {
    return this.rpc(accessToken, 'discard_own_matching_preparation_v1', { p_command_id: commandId });
  }

  grantAssistance(accessToken: string, commandId: string, consentVersion: string): Promise<unknown> {
    return this.rpc(accessToken, 'grant_own_matching_onboarding_assistance_v1', { p_command_id: commandId, p_consent_version: consentVersion });
  }

  revokeAssistance(accessToken: string, commandId: string): Promise<unknown> {
    return this.rpc(accessToken, 'revoke_own_matching_onboarding_assistance_v1', { p_command_id: commandId });
  }
}
