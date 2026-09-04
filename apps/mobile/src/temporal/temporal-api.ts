/**
 * T-03A2 — the narrow temporal transport.
 *
 * Explicit authenticated HTTP only: a Session temporal snapshot and a
 * committed-CU catch-up page. There is no WebSocket and no SSE in T-03A2.
 *
 * Everything ambient is INJECTED — base URL, access token and the `fetch`
 * implementation — so this module owns no configuration, no credential storage,
 * no persistence, no Router and no UI. It is not mounted anywhere in the app
 * shell: T-03D owns completing live truth (`LF`), and mounting the canonical
 * provider merely to demonstrate wiring would fabricate a live snapshot this
 * task cannot produce.
 *
 * Every failure is fail-closed: a non-2xx status, an unreadable body, or a
 * payload that fails runtime validation throws instead of returning a partial
 * or invented value.
 */
import type { ConversationalUnitsCommittedWireEvent, SessionTemporalSnapshot } from '@qandeel/runtime';
import { decodeCommittedUnitsResponse, decodeSessionTemporalSnapshot, type WireRejectionReason } from './temporal-wire';

/** The maximum catch-up page the server accepts. */
export const MAX_TEMPORAL_EVENT_PAGE = 256;

export type TemporalTransportFailure =
  | { readonly kind: 'HTTP'; readonly status: number }
  | { readonly kind: 'NETWORK' }
  | { readonly kind: 'MALFORMED_BODY' }
  | { readonly kind: 'INVALID_PAYLOAD'; readonly reason: WireRejectionReason; readonly detail: string };

export class TemporalTransportError extends Error {
  constructor(readonly failure: TemporalTransportFailure) {
    super(`Temporal transport failed: ${failure.kind}.`);
    this.name = 'TemporalTransportError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string> }) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}>;

export interface TemporalApiConfig {
  /** Origin plus any base path, without a trailing slash. */
  readonly baseUrl: string;
  /** The caller's own access token. Never read from storage by this module. */
  readonly accessToken: string;
  readonly fetch: FetchLike;
}

export interface CommittedEventsPageRequest {
  /**
   * Omitted means the start of available delivery events. When supplied it must
   * be an addressable Session Position >= 1: SP(0) is not a cursor.
   */
  readonly afterSp?: number;
  readonly limit?: number;
}

/**
 * FIX-T03A2-02: the requested Session is part of the trust boundary.
 *
 * A response body is untrusted input, so a well-shaped payload that names a
 * DIFFERENT Session than the one in the request URL must never be returned as a
 * successful result. This is the transport's own guard: the canonical store's
 * later `SESSION_MISMATCH` check is a second line, not the first, and an empty
 * catch-up page has no event whose Session could disagree with the envelope.
 */
function assertRequestedSession(requested: string, received: string, where: string): void {
  if (received !== requested) {
    throw new TemporalTransportError({
      kind: 'INVALID_PAYLOAD',
      reason: 'INVALID_IDENTITY',
      detail: `${where}.sessionId: requested Session ${requested}, received ${received}`,
    });
  }
}

export class TemporalApiClient {
  constructor(private readonly config: TemporalApiConfig) {}

  /** `GET /conversation/sessions/:sessionId/temporal`. */
  async fetchSessionTemporalState(sessionId: string): Promise<SessionTemporalSnapshot> {
    const body = await this.get(`${this.base(sessionId)}/temporal`);
    const decoded = decodeSessionTemporalSnapshot(body);
    if (!decoded.ok) throw new TemporalTransportError({ kind: 'INVALID_PAYLOAD', reason: decoded.reason, detail: decoded.detail });
    assertRequestedSession(sessionId, decoded.value.sessionId, 'snapshot');
    return decoded.value;
  }

  /** `GET /conversation/sessions/:sessionId/temporal/events`. */
  async fetchCommittedEvents(
    sessionId: string,
    page: CommittedEventsPageRequest = {},
  ): Promise<readonly ConversationalUnitsCommittedWireEvent[]> {
    const query: string[] = [];
    if (page.afterSp !== undefined) {
      if (!Number.isSafeInteger(page.afterSp) || page.afterSp < 1) {
        throw new RangeError('afterSp must be an addressable Session Position >= 1; SP(0) is not a cursor.');
      }
      query.push(`afterSp=${page.afterSp}`);
    }
    if (page.limit !== undefined) {
      if (!Number.isSafeInteger(page.limit) || page.limit < 1 || page.limit > MAX_TEMPORAL_EVENT_PAGE) {
        throw new RangeError(`limit must be between 1 and ${MAX_TEMPORAL_EVENT_PAGE}.`);
      }
      query.push(`limit=${page.limit}`);
    }
    const suffix = query.length > 0 ? `?${query.join('&')}` : '';
    const body = await this.get(`${this.base(sessionId)}/temporal/events${suffix}`);
    const decoded = decodeCommittedUnitsResponse(body);
    if (!decoded.ok) throw new TemporalTransportError({ kind: 'INVALID_PAYLOAD', reason: decoded.reason, detail: decoded.detail });
    assertRequestedSession(sessionId, decoded.value.sessionId, 'response');
    return decoded.value.events;
  }

  private base(sessionId: string): string {
    return `${this.config.baseUrl}/conversation/sessions/${encodeURIComponent(sessionId)}`;
  }

  private async get(url: string): Promise<unknown> {
    let response: Awaited<ReturnType<FetchLike>>;
    try {
      response = await this.config.fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.config.accessToken}`, Accept: 'application/json' },
      });
    } catch {
      throw new TemporalTransportError({ kind: 'NETWORK' });
    }
    if (!response.ok) throw new TemporalTransportError({ kind: 'HTTP', status: response.status });
    try {
      return await response.json();
    } catch {
      throw new TemporalTransportError({ kind: 'MALFORMED_BODY' });
    }
  }
}
