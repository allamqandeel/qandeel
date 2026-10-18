import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

export type EnrollmentKind = 'ENROLL' | 'CORRECTION' | 'RESUME' | 'RECONFIRM_CONSENT';
export interface EnrollmentActRow {
  readonly outcome: string;
  readonly participation_state: string | null;
  readonly matchable: boolean | null;
}

/**
 * S6-07 (CP1) — the two entry points of migration 0165, on the human's OWN token only. Each derives the human from
 * `auth.uid()` in the database; nothing here takes an account parameter that reaches the database, and there is no
 * service_role call: enrollment and its three consents are the human's own act (SEC-MATCH-00, CA-01-impl).
 */
@Injectable()
export class IntroductionsEnrollmentRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  read(token: string): Promise<unknown> {
    return this.dataApi.request<unknown>(token, 'rpc/read_my_matching_enrollment_v1', { method: 'POST', body: '{}' });
  }

  act(token: string, commandId: string, kind: EnrollmentKind, expectedDraftVersion: number | null,
    consents: { readonly participation: string | null; readonly contextGrant: string | null; readonly disclosureAuthority: string | null }):
    Promise<EnrollmentActRow[]> {
    return this.dataApi.request<EnrollmentActRow[]>(token, 'rpc/enroll_my_matching_setup_v1', {
      method: 'POST',
      body: JSON.stringify({
        p_command_id: commandId, p_kind: kind, p_expected_draft_version: expectedDraftVersion,
        p_participation_consent_version: consents.participation, p_context_consent_version: consents.contextGrant,
        p_disclosure_consent_version: consents.disclosureAuthority,
      }),
    });
  }
}
