import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PublicActivityProducer } from './public-activity.producer';
import { PublicDiscussionRepository, type PublicDiscussionReadRow } from './public-discussion.repository';
import { PublicQandeelReplyService, type PublicQandeelReplyState } from './public-qandeel-reply.service';

/** One post of the discussion, with its thread root and its one Public QANDEEL response (if any). */
export interface PublicDiscussionPostView {
  readonly id: string;
  readonly threadRootId: string;
  readonly ordinal: number;
  /** The Public Identity display, joined now — a mode and a label, never an account. */
  readonly author: { readonly mode: 'PSEUDONYM' | 'REAL_NAME'; readonly label: string | null };
  readonly text: string;
  readonly postedAt: string;
  readonly own: boolean;
  readonly qandeel:
    | { readonly state: 'NONE' | 'PENDING' | 'UNAVAILABLE' }
    | { readonly state: 'RESPONDED'; readonly text: string; readonly respondedAt: string };
}
export type PublicDiscussionView =
  | { readonly state: 'UNAVAILABLE' }
  | {
    readonly state: 'SERVED';
    /** Whether the reader may post or reply now (served, admitted AND entitled — the CW2-08 seam). */
    readonly canContribute: boolean;
    readonly posts: ReadonlyArray<PublicDiscussionPostView>;
    /** The ordinal to page after, when a full page came back; null at the end. */
    readonly nextAfter: number | null;
  };
export type PublicDiscussionPostResult =
  | { readonly outcome: 'COMMITTED'; readonly postId: string; readonly threadRootId: string; readonly qandeel: 'NONE' | PublicQandeelReplyState }
  | { readonly outcome: 'NOT_ENTITLED' | 'UNAVAILABLE' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
/** The database's bounds: a page holds at most 100 posts; a post holds 1–4000 characters. */
export const PUBLIC_DISCUSSION_PAGE_MAX = 100;
export const PUBLIC_DISCUSSION_TEXT_MAX = 4000;
const QANDEEL_STATES: readonly string[] = ['NONE', 'PENDING', 'UNAVAILABLE', 'RESPONDED'];

const invalid = (): never => { throw new BadRequestException({ outcome: 'INVALID_REQUEST' }); };
const unavailable = (): never => { throw new ServiceUnavailableException('Public discussion is unavailable.'); };
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isOrdinal = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const isInstant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));

/**
 * S5-04 — the ONE dependent discussion of a Public Experience at NEAR, over the frozen 0096 runtime (through 0147):
 *
 *   - the discussion read: the served version's posts, paged, each with its Public Identity display and its one Public
 *     QANDEEL response state; whether the reader may contribute now;
 *   - a post or a reply: only the reader's own words, the Experience and (optionally) the post it answers. The author,
 *     identity, version, thread root, ordinal and instant are the database's. A reply to a reply joins its thread root
 *     (one visible depth). Contribution fails closed on the entitlement seam (CW2-04 D22; Stage 9);
 *   - @qandeel: when the committed words hold the standalone token, the ONE Public QANDEEL response is asked for, under
 *     the durable lease; the human post stands whatever the generation does;
 *   - the Public Activity source producer is told the committed fact's identity, and nothing else.
 *
 * Every refusal of something not served is one neutral answer. Nothing is ranked, liked, followed or counted here, and
 * nothing is logged.
 */
@Injectable()
export class PublicDiscussionService {
  constructor(
    private readonly repository: PublicDiscussionRepository,
    private readonly replies: PublicQandeelReplyService,
    private readonly activity: PublicActivityProducer,
  ) {}

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) throw error;
      return unavailable();
    }
  }

  /** The discussion: exactly {} or { after } (the ordinal to page after). */
  read(token: string, experienceId: string, query: unknown): Promise<PublicDiscussionView> {
    const value = query && typeof query === 'object' && !Array.isArray(query) ? query as Record<string, unknown> : {};
    const keys = Object.keys(value);
    if (keys.some((key) => key !== 'after')) invalid();
    let after: number | null = null;
    if (value.after !== undefined) {
      if (typeof value.after !== 'string' || !/^[1-9][0-9]{0,15}$/u.test(value.after)) invalid();
      after = Number(value.after);
      if (!Number.isSafeInteger(after)) invalid();
    }
    if (!isUuid(experienceId)) return Promise.resolve({ state: 'UNAVAILABLE' });
    return this.guard(async () => {
      const [capability, rows] = await Promise.all([this.repository.capability(token, experienceId), this.repository.posts(token, experienceId, after)]);
      if (!Array.isArray(capability) || capability.length > 1 || !Array.isArray(rows) || rows.length > PUBLIC_DISCUSSION_PAGE_MAX) return unavailable();
      if (capability.length === 0) return { state: 'UNAVAILABLE' as const };
      if (typeof capability[0].can_contribute !== 'boolean') return unavailable();
      const posts = rows.map(postOf);
      return {
        state: 'SERVED' as const, canContribute: capability[0].can_contribute, posts,
        nextAfter: posts.length === PUBLIC_DISCUSSION_PAGE_MAX ? posts[posts.length - 1].ordinal : null,
      };
    });
  }

  /** A post or a reply: exactly { commandId, text, replyTo } — replyTo a post id or null. */
  post(userId: string, token: string, experienceId: string, body: unknown): Promise<PublicDiscussionPostResult> {
    const value = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
    if (!value || Object.keys(value).length !== 3 || !isUuid(value.commandId) || !('replyTo' in value) || !('text' in value)) return invalid();
    const { commandId, text, replyTo } = value as { commandId: string; text: unknown; replyTo: unknown };
    if (typeof text !== 'string' || text.trim().length === 0 || text.length > PUBLIC_DISCUSSION_TEXT_MAX) return invalid();
    if (replyTo !== null && !isUuid(replyTo)) return invalid();
    if (!isUuid(experienceId)) return Promise.resolve({ outcome: 'UNAVAILABLE' });
    return this.guard(async () => {
      const rows = await this.repository.post(token, commandId, experienceId, replyTo as string | null, text);
      if (!Array.isArray(rows) || rows.length !== 1) return unavailable();
      const row = rows[0];
      if (row.outcome === 'NOT_ENTITLED' || row.outcome === 'UNAVAILABLE') return { outcome: row.outcome };
      if (!['POSTED', 'REPLIED', 'ALREADY_COMMITTED'].includes(row.outcome) || !isUuid(row.post_id) || !isUuid(row.thread_root_id)
        || typeof row.qandeel_invoked !== 'boolean') return unavailable();
      await this.activity.discussionPost(row.post_id).catch(() => undefined);
      const qandeel = row.qandeel_invoked ? await this.replies.respond(row.post_id, userId) : 'NONE' as const;
      return { outcome: 'COMMITTED' as const, postId: row.post_id, threadRootId: row.thread_root_id, qandeel };
    });
  }

  /** Ask again for the ONE response of the reader's own invoking post (after an unavailable attempt). Exactly {}. */
  async retryQandeel(userId: string, experienceId: string, postId: string, body: unknown): Promise<{ readonly qandeel: PublicQandeelReplyState }> {
    const value = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
    if (!value || Object.keys(value).length !== 0) return invalid();
    if (!isUuid(experienceId) || !isUuid(postId)) return { qandeel: 'UNAVAILABLE' };
    return { qandeel: await this.replies.respond(postId, userId) };
  }
}

function postOf(row: PublicDiscussionReadRow): PublicDiscussionPostView {
  if (!isUuid(row?.post_id) || !isUuid(row.thread_root_id) || !isOrdinal(row.post_ordinal)
    || (row.author_label_mode !== 'PSEUDONYM' && row.author_label_mode !== 'REAL_NAME')
    || (row.author_display_label !== null && typeof row.author_display_label !== 'string')
    || typeof row.post_body !== 'string' || !isInstant(row.posted_at) || typeof row.is_own !== 'boolean'
    || !QANDEEL_STATES.includes(row.qandeel_state)) return unavailable();
  let qandeel: PublicDiscussionPostView['qandeel'];
  if (row.qandeel_state === 'RESPONDED') {
    if (typeof row.qandeel_response_body !== 'string' || !isInstant(row.qandeel_responded_at)) return unavailable();
    qandeel = { state: 'RESPONDED', text: row.qandeel_response_body, respondedAt: row.qandeel_responded_at as string };
  } else {
    qandeel = { state: row.qandeel_state as 'NONE' | 'PENDING' | 'UNAVAILABLE' };
  }
  return {
    id: row.post_id, threadRootId: row.thread_root_id, ordinal: row.post_ordinal,
    author: { mode: row.author_label_mode, label: row.author_display_label }, text: row.post_body, postedAt: row.posted_at, own: row.is_own, qandeel,
  };
}
