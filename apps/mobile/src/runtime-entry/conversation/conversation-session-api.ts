/**
 * T-12P §2.5 / §7 — the client for the ONE existing conversation-Session route.
 *
 * `POST /conversation/sessions` with the Supabase access token as a bearer. The server mints the
 * id; this client never synthesises one, never reuses another identity's session, and never treats
 * the authenticated user id as a session id. Those are two different identities and they stay two.
 *
 * THE AMBIGUITY IS REAL AND IS NOT PAPERED OVER. The route is not idempotent: the API generates a
 * fresh UUID per call and the database does an unconditional INSERT, with no `ON CONFLICT`, no
 * `Idempotency-Key` and no reuse of an open session. Worse, the API's own upstream call aborts at
 * five seconds and surfaces that as a 503 — by which time the INSERT may already have committed.
 * There is no list-sessions route and the id is never returned on failure, so a client that did not
 * receive a response CANNOT discover whether one was created.
 *
 * Therefore: a transport failure or a server error is reported as `OUTCOME_UNKNOWN` and is NEVER
 * retried automatically. Retrying would silently create a second orphaned Session on every flaky
 * network. Recovering from `OUTCOME_UNKNOWN` needs either a deliberate human decision or a
 * server-side idempotency key that does not exist today; both are outside T-12P.
 */

/** The HTTP seam. Separate from T-03's `FetchLike`, which is frozen and carries no request body. */
export type RuntimeHttpFetch = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ readonly ok: boolean; readonly status: number; json(): Promise<unknown> }>;

/** Exactly what the runtime needs from a created Session. The wire carries more; we assert less. */
export interface ConversationSessionHandle {
  readonly sessionId: string;
}

export type ConversationSessionOutcome =
  | { readonly kind: 'CREATED'; readonly session: ConversationSessionHandle }
  /** The token was rejected before the controller ran. Definitively no Session was created. */
  | { readonly kind: 'UNAUTHENTICATED' }
  /** A definitive client-side refusal. No Session was created. */
  | { readonly kind: 'REFUSED'; readonly status: number }
  /**
   * A Session MAY exist on the server and this client cannot learn its id. Never retry on this.
   * `reason` says how the ambiguity arose; none of the three is safely retryable.
   */
  | {
      readonly kind: 'OUTCOME_UNKNOWN';
      readonly reason: 'NETWORK' | 'SERVER_ERROR' | 'MALFORMED_RESPONSE';
      readonly detail: string;
    };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface ConversationSessionApiConfig {
  /** Origin plus any base path, without a trailing slash. */
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

/**
 * Validate only what the runtime depends on, and refuse anything that would let a wrong value
 * through: the id must be a real UUID and a freshly created Session must be ACTIVE (the database
 * forces both). Unknown keys are tolerated on purpose — this body is a database row projection, it
 * already differs between the create and read routes, and rejecting a legitimately added column
 * would break the client against a server change that cannot hurt it.
 */
function decodeCreatedSession(body: unknown): { ok: true; session: ConversationSessionHandle } | { ok: false; detail: string } {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return { ok: false, detail: 'body is not an object' };
  const record = body as Record<string, unknown>;
  const id = record.id;
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) return { ok: false, detail: 'id is not a UUID' };
  const status = record.status;
  if (status !== 'ACTIVE') return { ok: false, detail: `a created Session must be ACTIVE, received ${JSON.stringify(status)}` };
  return { ok: true, session: { sessionId: id } };
}

export class ConversationSessionApiClient {
  constructor(private readonly config: ConversationSessionApiConfig) {}

  /**
   * Create one conversation Session for the authenticated caller.
   *
   * The caller is responsible for invoking this AT MOST ONCE per runtime generation — the bootstrap
   * owner enforces that. This method deliberately holds no memo of its own: a client that quietly
   * returned a previous Session would hide a duplicate rather than prevent one.
   */
  async createSession(accessToken: string): Promise<ConversationSessionOutcome> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}/conversation/sessions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      });
    } catch (cause) {
      // The request may or may not have reached the server. Ambiguous by construction.
      return {
        kind: 'OUTCOME_UNKNOWN',
        reason: 'NETWORK',
        detail: cause instanceof Error && cause.message !== '' ? cause.message : 'the request did not complete',
      };
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) return { kind: 'UNAUTHENTICATED' };
      if (response.status >= 500) {
        // Includes the API's own 503 for an aborted upstream call, where the INSERT may have
        // committed before the abort. Definitively ambiguous.
        return { kind: 'OUTCOME_UNKNOWN', reason: 'SERVER_ERROR', detail: `server responded ${response.status}` };
      }
      return { kind: 'REFUSED', status: response.status };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // The Session WAS created — the server said 2xx — but its id is unreadable, so it is orphaned.
      return { kind: 'OUTCOME_UNKNOWN', reason: 'MALFORMED_RESPONSE', detail: 'the response body could not be read' };
    }

    const decoded = decodeCreatedSession(body);
    if (!decoded.ok) return { kind: 'OUTCOME_UNKNOWN', reason: 'MALFORMED_RESPONSE', detail: decoded.detail };
    return { kind: 'CREATED', session: decoded.session };
  }
}
