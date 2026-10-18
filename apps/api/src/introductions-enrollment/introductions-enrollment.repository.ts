import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

export type EnrollmentKind = 'ENROLL' | 'CORRECTION' | 'RESUME' | 'RECONFIRM_CONSENT';
export type ConsentKind = 'participation' | 'contextGrant' | 'disclosureAuthority';
const REVOCATION: Readonly<Record<ConsentKind, readonly [string, string]>> = Object.freeze({
  participation: ['turn_off_matching_participation_v1', 'p_expected_current_event_id'],
  contextGrant: ['revoke_matching_context_v1', 'p_expected_active_grant_id'],
  disclosureAuthority: ['revoke_pre_match_disclosure_authority_v1', 'p_expected_active_authority_id'],
});
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

  /** The caller's own current setup identities (the frozen 0109 self-inspection), on the caller's token. */
  setup(token: string): Promise<unknown> {
    return this.dataApi.request<unknown>(token, 'rpc/get_my_matching_setup_v1', { method: 'POST', body: '{}' });
  }

  /**
   * S6-07 (CP3) — ONE consent withdrawn, through the retained frozen 0109 command of that consent and nothing else (they
   * stay executable by `authenticated`: 0149 narrowed only the six that create or extend): participation -> TURN_OFF,
   * the Matching Context Grant -> its revocation, the Pre-Match Disclosure Authority -> its revocation. Each is a
   * compare-and-swap on the identity the caller's own setup read just named.
   */
  revoke(token: string, consent: ConsentKind, commandId: string, expectedId: string): Promise<unknown> {
    const [fn, parameter] = REVOCATION[consent];
    return this.dataApi.request<unknown>(token, `rpc/${fn}`, {
      method: 'POST', body: JSON.stringify({ p_command_id: commandId, [parameter]: expectedId }),
    });
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
