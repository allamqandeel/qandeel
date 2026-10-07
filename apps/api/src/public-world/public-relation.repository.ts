import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

/** Exactly the migration 0146 owner result shapes. */
export interface PublicRelationExperienceRow { readonly experience_id: string; readonly meaning: string }
export interface PublicRelationRow {
  readonly relation_id: string; readonly experience_id: string; readonly other_experience_id: string;
  readonly other_meaning: string; readonly relation_state: string;
}
export interface PublicRelationRequestRow { readonly outcome: string; readonly relation_id: string | null }
export interface PublicRelationActRow { readonly outcome: string }
export type PublicRelationAct = 'accept' | 'decline' | 'cancel' | 'remove';

/**
 * S5-03C — the explicit-relation boundary's only transport. Every call runs on the HUMAN's own token: the database
 * derives the acting controller from `auth.uid()`, admits them as a viewer, and decides which side they may act for. No
 * call names a user, a side, a version, a revision, a type, a strength or any text. There is no server channel here: a
 * relation is a human act, never a server one.
 */
@Injectable()
export class PublicRelationRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  private rpc<T>(token: string, name: string, body: Record<string, unknown>): Promise<T[]> {
    return this.dataApi.request<T[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  }

  experiences(token: string): Promise<PublicRelationExperienceRow[]> {
    return this.rpc<PublicRelationExperienceRow>(token, 'read_own_public_relation_experiences_v1', {});
  }

  relations(token: string): Promise<PublicRelationRow[]> {
    return this.rpc<PublicRelationRow>(token, 'read_own_public_relations_v1', {});
  }

  request(token: string, commandId: string, experienceId: string, otherExperienceId: string): Promise<PublicRelationRequestRow[]> {
    return this.rpc<PublicRelationRequestRow>(token, 'request_public_relation_v1', {
      p_command_id: commandId, p_experience_id: experienceId, p_other_experience_id: otherExperienceId,
    });
  }

  act(token: string, act: PublicRelationAct, commandId: string, relationId: string): Promise<PublicRelationActRow[]> {
    return this.rpc<PublicRelationActRow>(token, `${act}_public_relation_v1`, { p_command_id: commandId, p_relation_id: relationId });
  }
}
