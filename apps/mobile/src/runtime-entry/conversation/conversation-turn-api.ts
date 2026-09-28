/**
 * W1A-01 — the client for the Conversation turn routes (E2E-B-03 write, E2E-B-04 read).
 *
 *   POST /conversation/sessions/:sessionId/turns   — admit one user turn and receive QANDEEL's reply
 *   GET  /conversation/sessions/:sessionId/turns   — the authoritative conversation-so-far, paged
 *
 * It is a transport and nothing else. It never holds a credential — every request goes through the
 * AC-01 request-time seam its caller hands it — never chooses an idempotency key, never repeats a
 * request, and never decides what a failure means to the reader. It reports what the server said,
 * decoded strictly, as a typed outcome.
 *
 * ## The one ambiguity it refuses to hide
 *
 * The write admits the user turn BEFORE QANDEEL's reply is generated, in the same request. A request
 * that did not return a readable answer — the network dropped, the server answered 5xx, or the body
 * could not be read — may or may not have committed the reader's words. That is `OUTCOME_UNKNOWN`,
 * and it is never reported as "not sent" or as "failed". Only the caller, holding the submission's
 * own idempotency key, can resolve it: by READING the history (which admits nothing) or by
 * re-issuing the SAME submission under the SAME key (which the server resolves to the same turn).
 *
 * A definitive refusal is different: `401`/`403` and every other `4xx` mean the controller refused
 * before admission, so nothing was committed.
 */
import { CredentialUnavailableError } from '../auth/request-credential';
import type { RuntimeHttpFetch } from './conversation-session-api';

/** What the reader's side of one exchange is, decoded from the wire. */
export interface ConversationUserTurnView {
  readonly id: string;
  readonly content: string;
  /** The submission identity this turn was admitted under, when the client supplied one. */
  readonly idempotencyKey: string | null;
  readonly createdAt: string;
}

export interface ConversationReplyView {
  readonly id: string;
  readonly content: string;
  readonly createdAt: string;
}

/**
 * Where QANDEEL's reply to one committed user turn stands.
 *
 *   COMPLETED — the reply exists and is authoritative.
 *   FAILED    — the committed turn terminated without a reply (the frozen FAILED state).
 *   PENDING   — the turn is committed and its reply is still outstanding.
 */
export type ConversationReplyState = 'COMPLETED' | 'FAILED' | 'PENDING';

export interface ConversationExchangeView {
  readonly userTurn: ConversationUserTurnView;
  readonly replyState: ConversationReplyState;
  readonly reply: ConversationReplyView | null;
}

export interface ConversationHistoryPageView {
  /** Oldest to newest. */
  readonly exchanges: readonly ConversationExchangeView[];
  readonly hasOlder: boolean;
}

export interface ConversationTurnSubmission {
  readonly content: string;
  readonly idempotencyKey: string;
}

export type ConversationUnknownReason = 'NETWORK' | 'SERVER_ERROR' | 'MALFORMED_RESPONSE';

export type ConversationSubmitOutcome =
  /** The server answered with the committed turn — and, when it exists, QANDEEL's reply. */
  | { readonly kind: 'ANSWERED'; readonly exchange: ConversationExchangeView }
  /** Refused before admission (`4xx`, including `401`/`403`). Nothing was committed. */
  | { readonly kind: 'REFUSED'; readonly status: number }
  /** Never issued: the credential seam refused it. Nothing reached the network. */
  | { readonly kind: 'NOT_ISSUED' }
  /** The words MAY have been committed, and this response cannot say. See the module comment. */
  | { readonly kind: 'OUTCOME_UNKNOWN'; readonly reason: ConversationUnknownReason };

export type ConversationHistoryOutcome =
  | { readonly kind: 'PAGE'; readonly page: ConversationHistoryPageView }
  | { readonly kind: 'UNAVAILABLE'; readonly reason: 'NOT_ISSUED' | 'REFUSED' | ConversationUnknownReason };

export interface ConversationTurnApiConfig {
  /** Origin plus any base path, without a trailing slash. */
  readonly baseUrl: string;
  /** Always the AC-01 authorized seam in production: the bearer is decided at each request. */
  readonly fetch: RuntimeHttpFetch;
}

/** The largest history page the server serves. The client asks for exactly this, or less. */
export const CONVERSATION_HISTORY_PAGE_LIMIT = 50;

type Decoded<T> = { readonly ok: true; readonly value: T } | { readonly ok: false };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

function decodeUser(value: unknown, keyField: 'idempotency_key' | 'idempotencyKey', timeField: 'created_at' | 'createdAt'): Decoded<ConversationUserTurnView> {
  if (!isRecord(value) || !isText(value.id) || typeof value.content !== 'string' || !isText(value[timeField])) return { ok: false };
  const key = value[keyField];
  if (key !== null && key !== undefined && !isText(key)) return { ok: false };
  return {
    ok: true,
    value: { id: value.id, content: value.content, idempotencyKey: isText(key) ? key : null, createdAt: value[timeField] as string },
  };
}

function decodeReply(value: unknown, timeField: 'created_at' | 'createdAt'): Decoded<ConversationReplyView> {
  if (!isRecord(value) || !isText(value.id) || typeof value.content !== 'string' || !isText(value[timeField])) return { ok: false };
  return { ok: true, value: { id: value.id, content: value.content, createdAt: value[timeField] as string } };
}

/**
 * The write route's body: `{ userTurn, assistantTurn?, temporal? }` of raw rows. Only what the
 * Conversation depends on is asserted; `temporal` belongs to the Analysis owners and is not read.
 */
export function decodeSubmitResponse(body: unknown): Decoded<ConversationExchangeView> {
  if (!isRecord(body) || !isRecord(body.userTurn)) return { ok: false };
  const row = body.userTurn;
  if (row.role !== 'USER') return { ok: false };
  const user = decodeUser(row, 'idempotency_key', 'created_at');
  if (!user.ok) return { ok: false };
  let reply: ConversationReplyView | null = null;
  if (body.assistantTurn !== undefined) {
    const assistant = body.assistantTurn;
    if (!isRecord(assistant) || assistant.role !== 'ASSISTANT' || assistant.status !== 'COMPLETED' || assistant.source_turn_id !== user.value.id) {
      return { ok: false };
    }
    const decoded = decodeReply(assistant, 'created_at');
    if (!decoded.ok) return { ok: false };
    reply = decoded.value;
  }
  const status = row.status;
  let replyState: ConversationReplyState;
  if (reply !== null) replyState = 'COMPLETED';
  else if (status === 'FAILED') replyState = 'FAILED';
  else if (status === 'RECEIVED' || status === 'GENERATING' || status === 'COMPLETED') replyState = 'PENDING';
  // No other lifecycle state is reachable from this surface (there is no cancel in W1A), so any
  // other value is a response this client cannot honestly interpret.
  else return { ok: false };
  return { ok: true, value: { userTurn: user.value, replyState, reply } };
}

/** The read route's body: `{ exchanges: [{ userTurn, replyState, assistantTurn }], hasOlder }`. */
export function decodeHistoryResponse(body: unknown): Decoded<ConversationHistoryPageView> {
  if (!isRecord(body) || !Array.isArray(body.exchanges) || typeof body.hasOlder !== 'boolean') return { ok: false };
  const exchanges: ConversationExchangeView[] = [];
  for (const entry of body.exchanges) {
    if (!isRecord(entry)) return { ok: false };
    const user = decodeUser(entry.userTurn, 'idempotencyKey', 'createdAt');
    if (!user.ok) return { ok: false };
    const state = entry.replyState;
    if (state !== 'COMPLETED' && state !== 'FAILED' && state !== 'PENDING') return { ok: false };
    let reply: ConversationReplyView | null = null;
    if (entry.assistantTurn !== null) {
      const decoded = decodeReply(entry.assistantTurn, 'createdAt');
      if (!decoded.ok) return { ok: false };
      reply = decoded.value;
    }
    // A reply and its state are one fact: COMPLETED carries exactly one reply, nothing else carries any.
    if ((state === 'COMPLETED') !== (reply !== null)) return { ok: false };
    exchanges.push({ userTurn: user.value, replyState: state, reply });
  }
  return { ok: true, value: { exchanges, hasOlder: body.hasOlder } };
}

export class ConversationTurnApiClient {
  constructor(private readonly config: ConversationTurnApiConfig) {}

  private sessionPath(sessionId: string): string {
    return `${this.config.baseUrl}/conversation/sessions/${encodeURIComponent(sessionId)}/turns`;
  }

  /**
   * Submit ONE user turn. Issued exactly once per call; the caller owns the key, and re-issuing the
   * same submission under the same key is the caller's explicit decision, never this method's.
   */
  async submitTurn(sessionId: string, submission: ConversationTurnSubmission): Promise<ConversationSubmitOutcome> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(this.sessionPath(sessionId), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: submission.content, idempotencyKey: submission.idempotencyKey }),
      });
    } catch (cause) {
      if (cause instanceof CredentialUnavailableError) return { kind: 'NOT_ISSUED' };
      return { kind: 'OUTCOME_UNKNOWN', reason: 'NETWORK' };
    }
    if (!response.ok) {
      if (response.status >= 500) return { kind: 'OUTCOME_UNKNOWN', reason: 'SERVER_ERROR' };
      return { kind: 'REFUSED', status: response.status };
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'OUTCOME_UNKNOWN', reason: 'MALFORMED_RESPONSE' };
    }
    const decoded = decodeSubmitResponse(body);
    if (!decoded.ok) return { kind: 'OUTCOME_UNKNOWN', reason: 'MALFORMED_RESPONSE' };
    // The server resolved the key to exactly this turn; one that carries a different key is not ours.
    if (decoded.value.userTurn.idempotencyKey !== submission.idempotencyKey) return { kind: 'OUTCOME_UNKNOWN', reason: 'MALFORMED_RESPONSE' };
    return { kind: 'ANSWERED', exchange: decoded.value };
  }

  /** Read one page of the conversation-so-far. `before` is the oldest user turn the caller holds. */
  async readHistory(sessionId: string, options: { readonly before?: string } = {}): Promise<ConversationHistoryOutcome> {
    const query = `limit=${CONVERSATION_HISTORY_PAGE_LIMIT}${options.before === undefined ? '' : `&before=${encodeURIComponent(options.before)}`}`;
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.sessionPath(sessionId)}?${query}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
    } catch (cause) {
      return { kind: 'UNAVAILABLE', reason: cause instanceof CredentialUnavailableError ? 'NOT_ISSUED' : 'NETWORK' };
    }
    if (!response.ok) return { kind: 'UNAVAILABLE', reason: response.status >= 500 ? 'SERVER_ERROR' : 'REFUSED' };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'UNAVAILABLE', reason: 'MALFORMED_RESPONSE' };
    }
    const decoded = decodeHistoryResponse(body);
    return decoded.ok ? { kind: 'PAGE', page: decoded.value } : { kind: 'UNAVAILABLE', reason: 'MALFORMED_RESPONSE' };
  }
}
