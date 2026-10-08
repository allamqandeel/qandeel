import { Injectable } from '@nestjs/common';
import { SupabaseDataApiService } from '../conversation/supabase-data-api.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';

/** Exactly the migration 0147 result shapes. */
export interface PublicDiscussionPostRow {
  readonly outcome: string; readonly post_id: string | null; readonly thread_root_id: string | null;
  readonly post_ordinal: number | null; readonly qandeel_invoked: boolean;
}
export interface PublicDiscussionReadRow {
  readonly post_id: string; readonly thread_root_id: string; readonly post_ordinal: number; readonly author_label_mode: string;
  readonly author_display_label: string | null; readonly post_body: string; readonly posted_at: string; readonly is_own: boolean;
  readonly qandeel_state: string; readonly qandeel_response_body: string | null; readonly qandeel_responded_at: string | null;
}
export interface PublicDiscussionCapabilityRow { readonly can_contribute: boolean }
export interface PublicQandeelWorkRow { readonly work_outcome: string; readonly work_lease_id: string | null }
export interface PublicQandeelContextRow {
  readonly context_kind: string; readonly context_role: string | null; readonly context_ordinal: number;
  readonly context_ref: string | null; readonly context_text: string | null;
}
export interface PublicQandeelCompleteRow { readonly outcome: string; readonly response_id: string | null }

/**
 * S5-04 — the Public discussion boundary's transport over migration 0147, which reaches the frozen 0096 runtime.
 *
 * The human calls run on the HUMAN's own token: the database derives the author from `auth.uid()`, admits them, asks the
 * entitlement seam and decides the version, the thread root, the ordinal and the instant. No human call names a user, an
 * identity, a version or a verdict. The QANDEEL work runs on the server channel and names only the invoking post and the
 * human whose request started it — the database decides everything else.
 */
@Injectable()
export class PublicDiscussionRepository {
  constructor(private readonly dataApi: SupabaseDataApiService, private readonly server: SupabaseServiceRoleApiService) {}

  private rpc<T>(token: string, name: string, body: Record<string, unknown>): Promise<T[]> {
    return this.dataApi.request<T[]>(token, `rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
  }

  post(token: string, commandId: string, experienceId: string, replyToPostId: string | null, text: string): Promise<PublicDiscussionPostRow[]> {
    return this.rpc<PublicDiscussionPostRow>(token, 'post_own_public_discussion_v1', {
      p_command_id: commandId, p_experience_id: experienceId, p_reply_to_post_id: replyToPostId, p_body: text,
    });
  }

  posts(token: string, experienceId: string, afterOrdinal: number | null): Promise<PublicDiscussionReadRow[]> {
    return this.rpc<PublicDiscussionReadRow>(token, 'read_public_discussion_posts_v1', { p_experience_id: experienceId, p_after_ordinal: afterOrdinal });
  }

  capability(token: string, experienceId: string): Promise<PublicDiscussionCapabilityRow[]> {
    return this.rpc<PublicDiscussionCapabilityRow>(token, 'read_public_discussion_capability_v1', { p_experience_id: experienceId });
  }

  /** Server channel only. */
  async begin(postId: string, requesterUserId: string): Promise<PublicQandeelWorkRow[]> {
    const rows = await this.server.rpc<PublicQandeelWorkRow[]>('begin_public_qandeel_work_v1', { p_post_id: postId, p_requester_user_id: requesterUserId });
    return Array.isArray(rows) ? rows : [];
  }

  /** Server channel only. */
  async context(postId: string, leaseId: string): Promise<PublicQandeelContextRow[]> {
    const rows = await this.server.rpc<PublicQandeelContextRow[]>('read_public_qandeel_context_v1', { p_post_id: postId, p_lease_id: leaseId });
    return Array.isArray(rows) ? rows : [];
  }

  /** Server channel only. */
  async complete(postId: string, leaseId: string, versionId: string, text: string, consumedPostIds: readonly string[]): Promise<PublicQandeelCompleteRow[]> {
    const rows = await this.server.rpc<PublicQandeelCompleteRow[]>('complete_public_qandeel_work_v1', {
      p_post_id: postId, p_lease_id: leaseId, p_experience_version_id: versionId, p_response_body: text, p_consumed_post_ids: consumedPostIds,
    });
    return Array.isArray(rows) ? rows : [];
  }

  /** Server channel only. */
  end(postId: string, leaseId: string, unanswered: boolean): Promise<unknown> {
    return this.server.rpc<unknown>('end_public_qandeel_work_v1', { p_post_id: postId, p_lease_id: leaseId, p_unanswered: unanswered });
  }
}
