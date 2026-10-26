import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';

/** Exactly the migration 0179 result shapes. */
export interface ComposeDraftListRow {
  readonly draft_id: string; readonly draft_revision: number | string; readonly title: string; readonly section_key: string | null;
  readonly text_length: number; readonly draft_state: string; readonly experience_id: string | null;
  readonly experience_lifecycle: string | null; readonly updated_at: string;
}
export interface ComposeDraftRow {
  readonly draft_id: string; readonly draft_revision: number | string; readonly title: string; readonly body: string;
  readonly section_key: string | null; readonly draft_state: string; readonly experience_id: string | null;
  readonly experience_lifecycle: string | null; readonly created_at: string; readonly updated_at: string;
}
export interface ComposeSaveRow { readonly outcome: string; readonly draft_revision: number | string | null }
export interface ComposeOutcomeRow { readonly outcome: string }
export interface ComposePreviewRow {
  readonly draft_revision: number | string; readonly readiness: string; readonly title: string; readonly body: string;
  readonly section_key: string | null; readonly publisher_label_mode: string; readonly publisher_display_label: string | null;
  readonly privacy_notes: string[];
}
export interface ComposeFreezeRow { readonly outcome: string; readonly experience_id: string | null; readonly current_lifecycle: string | null }
export interface ComposeSectionRow { readonly outcome: string; readonly section_revision: number | string | null }

/**
 * S8A-05 CP1 — the «Write your topic» boundary's only transport. Every call runs on the caller's own token, so the
 * database derives the human from `auth.uid()`; no call names a user, a Public ref, a label, an approver or an audience.
 * The text a call carries is the author's own draft, sent only to their own private draft.
 */
@Injectable()
export class PublicComposeRepository {
  constructor(private readonly dataApi: SupabaseDataApiService) {}

  private rpc<T>(token: string, name: string, body: Record<string, unknown> = {}): Promise<T[]> {
    return this.dataApi.request<T[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  }

  drafts(token: string): Promise<ComposeDraftListRow[]> {
    return this.rpc<ComposeDraftListRow>(token, 'list_own_topic_drafts_v1');
  }

  draft(token: string, draftId: string): Promise<ComposeDraftRow[]> {
    return this.rpc<ComposeDraftRow>(token, 'read_own_topic_draft_v1', { p_draft_id: draftId });
  }

  save(token: string, draftId: string, expectedRevision: number, title: string, body: string, section: string | null): Promise<ComposeSaveRow[]> {
    return this.rpc<ComposeSaveRow>(token, 'save_own_topic_draft_v1', {
      p_draft_id: draftId, p_expected_revision: expectedRevision, p_title: title, p_body: body, p_section_key: section,
    });
  }

  remove(token: string, commandId: string, draftId: string): Promise<ComposeOutcomeRow[]> {
    return this.rpc<ComposeOutcomeRow>(token, 'delete_own_topic_draft_v1', { p_command_id: commandId, p_draft_id: draftId });
  }

  preview(token: string, draftId: string): Promise<ComposePreviewRow[]> {
    return this.rpc<ComposePreviewRow>(token, 'preview_own_topic_draft_v1', { p_draft_id: draftId });
  }

  prepare(token: string, commandId: string, draftId: string, expectedRevision: number): Promise<ComposeFreezeRow[]> {
    return this.rpc<ComposeFreezeRow>(token, 'freeze_own_topic_draft_v1', {
      p_command_id: commandId, p_draft_id: draftId, p_expected_revision: expectedRevision,
    });
  }

  discard(token: string, commandId: string, experienceId: string): Promise<ComposeOutcomeRow[]> {
    return this.rpc<ComposeOutcomeRow>(token, 'discard_own_unpublished_topic_v1', { p_command_id: commandId, p_experience_id: experienceId });
  }

  section(token: string, commandId: string, experienceId: string, section: string): Promise<ComposeSectionRow[]> {
    return this.rpc<ComposeSectionRow>(token, 'set_own_topic_section_v1', {
      p_command_id: commandId, p_experience_id: experienceId, p_section_key: section,
    });
  }
}
