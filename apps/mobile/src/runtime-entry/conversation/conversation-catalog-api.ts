/**
 * COSMOS E-2 corrections, Slice B (the Product Owner's D-2, 2026-11-20) — the client for the person's own conversation
 * catalog: `GET /conversation/sessions` (the server-authoritative list) and `PATCH /conversation/sessions/:id/title`
 * (the durable manual title). Both are owner-scoped on the server (migration 0197, `auth.uid()`); this client carries
 * the bearer the seam decides and nothing that names the person.
 *
 * The catalog is READ here and never held: there is no second local catalog (T-13 keeps exactly ONE active Session
 * locator per identity for launch recovery, and the list is the server's). Unknown keys are tolerated, exactly as the
 * Session client tolerates them; what the runtime depends on is validated and anything else is refused as a typed
 * outcome, never papered over.
 */
import type { RuntimeHttpFetch } from './conversation-session-api';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** One row of the catalog, exactly what the presentation needs. */
export interface ConversationCatalogEntry {
  readonly sessionId: string;
  readonly status: 'ACTIVE' | 'IDLE' | 'CLOSED' | 'EXPIRED';
  readonly createdAt: string;
  /** The current MANUAL title, or null when the person never named this conversation. */
  readonly title: string | null;
  /** The person's own first message, excerpted by the server (at most 120 characters): the only suggested name. */
  readonly opening: string | null;
  /** The newest turn's instant, or null for a conversation nothing was said in yet. */
  readonly lastTurnAt: string | null;
  readonly turnCount: number;
}

export type ConversationCatalogListOutcome =
  | { readonly kind: 'LISTED'; readonly entries: readonly ConversationCatalogEntry[] }
  | { readonly kind: 'UNAUTHENTICATED' }
  | { readonly kind: 'UNAVAILABLE'; readonly detail: string };

export type ConversationCatalogRenameOutcome =
  | { readonly kind: 'RENAMED'; readonly sessionId: string; readonly title: string }
  | { readonly kind: 'UNAUTHENTICATED' }
  /** The server refused the words (empty, blank or over 80 characters after normalisation). */
  | { readonly kind: 'REFUSED'; readonly status: number }
  /** The Session is not one of the caller's, as far as the server says; nothing was renamed. */
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'UNAVAILABLE'; readonly detail: string };

/** COSMOS E-2 Slice A: the person's own name for one of their Personal topics (0198 alias ledger). */
export type ThreadAliasOutcome =
  | { readonly kind: 'ALIASED'; readonly threadId: string; readonly alias: string }
  | { readonly kind: 'UNAUTHENTICATED' }
  | { readonly kind: 'REFUSED'; readonly status: number }
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'UNAVAILABLE'; readonly detail: string };

export interface ConversationCatalogApiConfig {
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

const STATUSES = new Set(['ACTIVE', 'IDLE', 'CLOSED', 'EXPIRED']);
const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

function decodeEntry(value: unknown): ConversationCatalogEntry | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const id = row.id;
  const status = row.status;
  const createdAt = row.created_at;
  const turnCount = row.turn_count;
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return null;
  if (typeof status !== 'string' || !STATUSES.has(status)) return null;
  if (typeof createdAt !== 'string') return null;
  if (typeof turnCount !== 'number' || !Number.isInteger(turnCount) || turnCount < 0) return null;
  return {
    sessionId: id,
    status: status as ConversationCatalogEntry['status'],
    createdAt,
    title: text(row.title),
    opening: text(row.opening),
    lastTurnAt: text(row.last_turn_at),
    turnCount,
  };
}

const detailOf = (cause: unknown, fallback: string): string => (cause instanceof Error && cause.message !== '' ? cause.message : fallback);

export class ConversationCatalogApiClient {
  constructor(private readonly config: ConversationCatalogApiConfig) {}

  /** The caller's own conversations, newest activity first (the server orders; this client reorders nothing). */
  async listSessions(): Promise<ConversationCatalogListOutcome> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}/conversation/sessions`, { method: 'GET', headers: { Accept: 'application/json' } });
    } catch (cause) {
      return { kind: 'UNAVAILABLE', detail: detailOf(cause, 'the request did not complete') };
    }
    if (response.status === 401 || response.status === 403) return { kind: 'UNAUTHENTICATED' };
    if (!response.ok) return { kind: 'UNAVAILABLE', detail: `server responded ${response.status}` };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'UNAVAILABLE', detail: 'the response body could not be read' };
    }
    if (!Array.isArray(body)) return { kind: 'UNAVAILABLE', detail: 'the catalog is not a list' };
    const entries: ConversationCatalogEntry[] = [];
    for (const item of body) {
      const entry = decodeEntry(item);
      // One malformed row refuses the whole list: a catalog with a hole in it would be a quiet lie about what exists.
      if (entry === null) return { kind: 'UNAVAILABLE', detail: 'a catalog row is malformed' };
      entries.push(entry);
    }
    return { kind: 'LISTED', entries };
  }

  /** Append a manual title to one owned Session. The words are sent as typed; the server normalises whitespace. */
  async renameSession(sessionId: string, title: string): Promise<ConversationCatalogRenameOutcome> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}/conversation/sessions/${encodeURIComponent(sessionId)}/title`, {
        method: 'PATCH',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
    } catch (cause) {
      return { kind: 'UNAVAILABLE', detail: detailOf(cause, 'the request did not complete') };
    }
    if (response.status === 401 || response.status === 403) return { kind: 'UNAUTHENTICATED' };
    if (response.status === 404) return { kind: 'NOT_FOUND' };
    if (response.status === 400) return { kind: 'REFUSED', status: 400 };
    if (!response.ok) return { kind: 'UNAVAILABLE', detail: `server responded ${response.status}` };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'UNAVAILABLE', detail: 'the response body could not be read' };
    }
    const row = body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    const renamedTitle = row === null ? null : text(row.title);
    const renamedSession = row === null ? null : text(row.session_id);
    if (renamedTitle === null || renamedSession !== sessionId) return { kind: 'UNAVAILABLE', detail: 'the renamed row is malformed' };
    return { kind: 'RENAMED', sessionId, title: renamedTitle };
  }

  /** PATCH /conversation/threads/:threadId/alias — the words only; the server normalises, bounds and owns the ledger. */
  async setThreadAlias(threadId: string, alias: string): Promise<ThreadAliasOutcome> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}/conversation/threads/${encodeURIComponent(threadId)}/alias`, {
        method: 'PATCH',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias }),
      });
    } catch (cause) {
      return { kind: 'UNAVAILABLE', detail: detailOf(cause, 'the request did not complete') };
    }
    if (response.status === 401 || response.status === 403) return { kind: 'UNAUTHENTICATED' };
    if (response.status === 404) return { kind: 'NOT_FOUND' };
    if (response.status === 400) return { kind: 'REFUSED', status: 400 };
    if (!response.ok) return { kind: 'UNAVAILABLE', detail: `server responded ${response.status}` };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'UNAVAILABLE', detail: 'the response body could not be read' };
    }
    const row = body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    const aliased = row === null ? null : text(row.alias);
    const thread = row === null ? null : text(row.thread_id);
    if (aliased === null || thread !== threadId) return { kind: 'UNAVAILABLE', detail: 'the aliased row is malformed' };
    return { kind: 'ALIASED', threadId, alias: aliased };
  }
}
