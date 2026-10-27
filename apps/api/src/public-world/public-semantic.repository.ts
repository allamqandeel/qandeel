import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import type { PublicRegionProfile } from './public-semantic-regions';

/** Exactly the migration 0144 result shapes. */
export interface PublicSemanticReviewRow {
  readonly semantic_state: string; readonly current_lifecycle: string | null; readonly version_ordinal: number | null;
  readonly interpretation_id: string | null; readonly interpretation_revision: number | null; readonly interpretation_origin: string | null;
  readonly meaning: string | null; readonly primary_themes: string[] | null; readonly secondary_themes: string[] | null;
  readonly explanation: string | null; readonly review_decision: string | null; readonly semantically_ready: boolean;
}
export interface PublicSemanticWorkRow { readonly outcome: string; readonly work_id: string | null }
export interface PublicSemanticCommitRow { readonly outcome: string; readonly interpretation_id: string | null; readonly interpretation_revision: number | null }
export interface PublicSemanticOutcomeRow { readonly outcome: string }
/** Exactly the migration 0181 v2 input shape: the package as ONE bounded text (S8A-05 CP3, A-4). */
export interface PublicSemanticInputRow {
  readonly work_kind: string; readonly package_text: string;
  readonly correction_meaning: string | null; readonly correction_primary_themes: string[] | null; readonly correction_secondary_themes: string[] | null;
}

/**
 * S5-03A — the semantic review boundary's only transport, on two separate channels:
 *
 *   - the HUMAN's own token for the five owner commands (review, request a proposal, request a correction, commit,
 *     accept): the database derives the human from `auth.uid()`; no call names a user, a ref, a controller, a lens, a
 *     fingerprint or a readiness. Every identity sent is the caller's own fresh command id or one the database returned;
 *   - the SERVER channel (service role, never a client credential) for the two server commands: the package-only input
 *     of one work, and the interpreter's answer for it. A client can call neither: what QANDEEL proposed can only arrive
 *     here. S8A-05 CP3 (A-4): both are migration 0181's v2 commands — the input is one title-free bounded text, and the
 *     answer carries a closed region profile from which the database derives the dominant sub-region (the lens key).
 */
@Injectable()
export class PublicSemanticRepository {
  constructor(private readonly dataApi: SupabaseDataApiService, private readonly server: SupabaseServiceRoleApiService) {}

  private rpc<T>(token: string, name: string, body: Record<string, unknown>): Promise<T[]> {
    return this.dataApi.request<T[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  }

  review(token: string, experienceId: string): Promise<PublicSemanticReviewRow[]> {
    return this.rpc<PublicSemanticReviewRow>(token, 'read_own_public_semantic_review_v1', { p_experience_id: experienceId });
  }

  requestProposal(token: string, commandId: string, experienceId: string): Promise<PublicSemanticWorkRow[]> {
    return this.rpc<PublicSemanticWorkRow>(token, 'request_own_public_semantic_proposal_v1', { p_command_id: commandId, p_experience_id: experienceId });
  }

  requestCorrection(token: string, commandId: string, experienceId: string, interpretationId: string, meaning: string,
    primaryThemes: readonly string[], secondaryThemes: readonly string[]): Promise<PublicSemanticWorkRow[]> {
    return this.rpc<PublicSemanticWorkRow>(token, 'request_own_public_semantic_correction_v1', {
      p_command_id: commandId, p_experience_id: experienceId, p_interpretation_id: interpretationId, p_meaning: meaning,
      p_primary_themes: [...primaryThemes], p_secondary_themes: [...secondaryThemes],
    });
  }

  commit(token: string, workId: string): Promise<PublicSemanticCommitRow[]> {
    return this.rpc<PublicSemanticCommitRow>(token, 'commit_own_public_semantic_work_v1', { p_work_id: workId });
  }

  accept(token: string, commandId: string, experienceId: string, interpretationId: string): Promise<PublicSemanticOutcomeRow[]> {
    return this.rpc<PublicSemanticOutcomeRow>(token, 'accept_own_public_semantic_proposal_v1', {
      p_command_id: commandId, p_experience_id: experienceId, p_interpretation_id: interpretationId,
    });
  }

  workInput(workId: string): Promise<PublicSemanticInputRow[]> {
    return this.server.rpc<PublicSemanticInputRow[]>('read_public_semantic_work_input_v2', { p_work_id: workId });
  }

  recordOutcome(workId: string, outcome: 'PROPOSED' | 'CONSISTENT' | 'NOT_SUPPORTED', answer: {
    readonly regions: PublicRegionProfile | null; readonly meaning: string | null; readonly primaryThemes: readonly string[] | null;
    readonly secondaryThemes: readonly string[] | null; readonly explanation: string | null;
  }): Promise<PublicSemanticOutcomeRow[]> {
    return this.server.rpc<PublicSemanticOutcomeRow[]>('record_public_semantic_work_outcome_v2', {
      p_work_id: workId, p_outcome: outcome,
      p_region_keys: answer.regions ? answer.regions.regions.map((region) => region.key) : null,
      p_region_weights: answer.regions ? answer.regions.regions.map((region) => region.hundredths) : null,
      p_meaning: answer.meaning, p_primary_themes: answer.primaryThemes ? [...answer.primaryThemes] : null,
      p_secondary_themes: answer.secondaryThemes ? [...answer.secondaryThemes] : null, p_explanation: answer.explanation,
    });
  }
}
