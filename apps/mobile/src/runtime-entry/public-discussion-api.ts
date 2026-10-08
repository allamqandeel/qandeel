/**
 * S5-04 — the client for the dependent discussion of ONE Public Experience, beside the S5-01 … S5-03C clients on the same
 * identity-bound transport (`PublicWorldApiClient.discussion`).
 *
 *   GET  /public/field/experiences/:id/discussion[?after=n]          the served version's posts, paged, and whether the
 *                                                                    reader may contribute now
 *   POST /public/field/experiences/:id/discussion                    { commandId, text, replyTo } → a post or a reply
 *   POST /public/field/experiences/:id/discussion/:postId/qandeel    {} → ask again for the one Public QANDEEL response of
 *                                                                    the reader's own invoking post
 *
 * A transport and nothing else: no credential of its own, no viewer, author, identity, version, ordinal, instant, recipient
 * or entitlement claim, and no retry of its own. Every answer is decoded strictly; anything else is no answer.
 */
import type { PublicAuthoringAnswer, PublicAuthoringApiConfig } from './public-authoring-api';

export type PublicQandeelState = 'NONE' | 'PENDING' | 'UNAVAILABLE' | 'RESPONDED';
export interface PublicDiscussionPost {
  readonly id: string;
  readonly threadRootId: string;
  readonly ordinal: number;
  /** The author's CURRENT Public Identity display — a mode and a label, never an account. */
  readonly author: { readonly mode: 'PSEUDONYM' | 'REAL_NAME'; readonly label: string | null };
  readonly text: string;
  readonly postedAt: string;
  readonly own: boolean;
  /** The ONE Public QANDEEL response this post invoked, if any. QANDEEL is never a human author. */
  readonly qandeel: { readonly state: 'NONE' | 'PENDING' | 'UNAVAILABLE' } | { readonly state: 'RESPONDED'; readonly text: string; readonly respondedAt: string };
}
export type PublicDiscussionPage =
  | { readonly kind: 'ABSENT' }
  | { readonly kind: 'SERVED'; readonly canContribute: boolean; readonly posts: ReadonlyArray<PublicDiscussionPost>; readonly nextAfter: number | null };
export type PublicDiscussionPostOutcome =
  | { readonly kind: 'COMMITTED'; readonly postId: string; readonly threadRootId: string; readonly qandeel: PublicQandeelState }
  | { readonly kind: 'NOT_ENTITLED' }
  | { readonly kind: 'UNAVAILABLE' };

type Exchange = { readonly kind: 'OK'; readonly body: unknown } | { readonly kind: 'STATUS'; readonly status: number } | { readonly kind: 'NETWORK' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
const isOrdinal = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const isInstant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const hasExactly = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
};
const NO: { readonly kind: 'NO_ANSWER' } = Object.freeze({ kind: 'NO_ANSWER' as const });
const yes = <T>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });
const QANDEEL_STATES: readonly string[] = ['NONE', 'PENDING', 'UNAVAILABLE', 'RESPONDED'];

/** The server's bounds: at most 100 posts per page; a post holds 1–4000 characters. */
export const PUBLIC_DISCUSSION_PAGE_MAX = 100;
export const PUBLIC_DISCUSSION_TEXT_MAX = 4000;

function qandeelOf(value: unknown): PublicDiscussionPost['qandeel'] | null {
  if (!isRecord(value) || typeof value.state !== 'string' || !QANDEEL_STATES.includes(value.state)) return null;
  if (value.state === 'RESPONDED') {
    return hasExactly(value, ['state', 'text', 'respondedAt']) && typeof value.text === 'string' && isInstant(value.respondedAt)
      ? { state: 'RESPONDED', text: value.text, respondedAt: value.respondedAt } : null;
  }
  return hasExactly(value, ['state']) ? { state: value.state as 'NONE' | 'PENDING' | 'UNAVAILABLE' } : null;
}

function postOf(value: unknown): PublicDiscussionPost | null {
  if (!isRecord(value) || !hasExactly(value, ['id', 'threadRootId', 'ordinal', 'author', 'text', 'postedAt', 'own', 'qandeel'])
    || !isUuid(value.id) || !isUuid(value.threadRootId) || !isOrdinal(value.ordinal) || typeof value.text !== 'string'
    || !isInstant(value.postedAt) || typeof value.own !== 'boolean') return null;
  const author = isRecord(value.author) && hasExactly(value.author, ['mode', 'label'])
    && (value.author.mode === 'PSEUDONYM' || value.author.mode === 'REAL_NAME')
    && (value.author.label === null || typeof value.author.label === 'string') ? value.author : null;
  const qandeel = qandeelOf(value.qandeel);
  if (author === null || qandeel === null) return null;
  return Object.freeze({
    id: value.id, threadRootId: value.threadRootId, ordinal: value.ordinal,
    author: { mode: author.mode as 'PSEUDONYM' | 'REAL_NAME', label: author.label as string | null },
    text: value.text, postedAt: value.postedAt, own: value.own, qandeel,
  });
}

export class PublicDiscussionApiClient {
  constructor(private readonly config: PublicAuthoringApiConfig) {}

  async read(experienceId: string, after: number | null): Promise<PublicAuthoringAnswer<PublicDiscussionPage>> {
    const query = after === null ? '' : `?after=${after}`;
    const answer = await this.exchange('GET', `/public/field/experiences/${encodeURIComponent(experienceId)}/discussion${query}`);
    if (answer.kind !== 'OK' || !isRecord(answer.body)) return NO;
    const b = answer.body;
    if (b.state === 'UNAVAILABLE' && hasExactly(b, ['state'])) return yes({ kind: 'ABSENT' });
    if (b.state !== 'SERVED' || !hasExactly(b, ['state', 'canContribute', 'posts', 'nextAfter']) || typeof b.canContribute !== 'boolean'
      || !Array.isArray(b.posts) || b.posts.length > PUBLIC_DISCUSSION_PAGE_MAX || (b.nextAfter !== null && !isOrdinal(b.nextAfter))) return NO;
    const posts = b.posts.map(postOf);
    if (!posts.every((post): post is PublicDiscussionPost => post !== null)) return NO;
    return yes({ kind: 'SERVED', canContribute: b.canContribute, posts, nextAfter: b.nextAfter as number | null });
  }

  async post(experienceId: string, commandId: string, text: string, replyTo: string | null): Promise<PublicAuthoringAnswer<PublicDiscussionPostOutcome>> {
    const answer = await this.exchange('POST', `/public/field/experiences/${encodeURIComponent(experienceId)}/discussion`, { commandId, text, replyTo });
    if (answer.kind !== 'OK' || !isRecord(answer.body)) return NO;
    const b = answer.body;
    if ((b.outcome === 'NOT_ENTITLED' || b.outcome === 'UNAVAILABLE') && hasExactly(b, ['outcome'])) return yes({ kind: b.outcome });
    if (b.outcome !== 'COMMITTED' || !hasExactly(b, ['outcome', 'postId', 'threadRootId', 'qandeel']) || !isUuid(b.postId)
      || !isUuid(b.threadRootId) || typeof b.qandeel !== 'string' || !QANDEEL_STATES.includes(b.qandeel)) return NO;
    return yes({ kind: 'COMMITTED', postId: b.postId, threadRootId: b.threadRootId, qandeel: b.qandeel as PublicQandeelState });
  }

  async retryQandeel(experienceId: string, postId: string): Promise<PublicAuthoringAnswer<PublicQandeelState>> {
    const answer = await this.exchange('POST', `/public/field/experiences/${encodeURIComponent(experienceId)}/discussion/${encodeURIComponent(postId)}/qandeel`, {});
    if (answer.kind !== 'OK' || !isRecord(answer.body) || !hasExactly(answer.body, ['qandeel'])) return NO;
    const state = answer.body.qandeel;
    return state === 'RESPONDED' || state === 'PENDING' || state === 'UNAVAILABLE' ? yes(state) : NO;
  }

  private async exchange(method: 'GET' | 'POST', path: string, payload?: unknown): Promise<Exchange> {
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}${path}`, {
        method,
        headers: payload === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      });
      if (!response.ok) return { kind: 'STATUS', status: response.status };
      return { kind: 'OK', body: (await response.json()) as unknown };
    } catch {
      return { kind: 'NETWORK' };
    }
  }
}
