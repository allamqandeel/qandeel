/**
 * T-03C — the narrow historical disclosure transport.
 *
 * Explicit authenticated HTTP only: ONE read,
 * `GET /conversation/sessions/:sessionId/historical-projection?tc=&depth=[&inspect…]`,
 * answering `V = Disclose(K(TC), depth, inspection)` for ONE covered Session at
 * ONE addressable Session Position. There is no WebSocket and no SSE, no write
 * and no Product action.
 *
 * Everything ambient is INJECTED — base URL, access token and the `fetch`
 * implementation — so this module owns no configuration, no credential
 * storage, no persistence, no Router and no UI. It is not mounted anywhere in
 * the app shell: T-03C delivers typed history only, and no visual UI exists
 * here.
 *
 * Every failure is fail-closed and TYPED: the server's four coverage /
 * technical refusals and "not visible" arrive as `UNAVAILABLE` with their
 * exact code (never as an empty disclosure, never as UNKNOWN_AT_TC); a non-2xx
 * status without a typed body, an unreadable body, a payload that fails
 * runtime validation, or a payload naming another Session or another TC
 * throws instead of returning a partial or invented value.
 */
import type { HistoricalDisclosure, HistoricalInspectionRequest, HistoricalProjectionUnavailableCode, HistoricalSemanticDepth } from '@qandeel/runtime';
import { isSemanticDepth, isSessionPosition } from '../state';
import { decodeHistoricalDisclosure, decodeUnavailableBody, type HistoricalWireRejectionReason } from './historical-projection-wire';

export type HistoricalTransportFailure =
  | { readonly kind: 'UNAVAILABLE'; readonly code: HistoricalProjectionUnavailableCode; readonly status: number }
  | { readonly kind: 'HTTP'; readonly status: number }
  | { readonly kind: 'NETWORK' }
  | { readonly kind: 'MALFORMED_BODY' }
  | { readonly kind: 'INVALID_PAYLOAD'; readonly reason: HistoricalWireRejectionReason; readonly detail: string };

export class HistoricalTransportError extends Error {
  constructor(readonly failure: HistoricalTransportFailure) {
    super(`Historical projection transport failed: ${failure.kind}${failure.kind === 'UNAVAILABLE' ? ` (${failure.code})` : ''}.`);
    this.name = 'HistoricalTransportError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type HistoricalFetchLike = (input: string, init?: { method?: string; headers?: Record<string, string> }) => Promise<{
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}>;

export interface HistoricalProjectionApiConfig {
  /** Origin plus any base path, without a trailing slash. */
  readonly baseUrl: string;
  /** The caller's own access token. Never read from storage by this module. */
  readonly accessToken: string;
  readonly fetch: HistoricalFetchLike;
}

export interface HistoricalDisclosureRequest {
  /** An addressable Session Position: an integer >= 1. SP(0), null and the technical absence sentinel are not requests. */
  readonly tc: number;
  /** One of the five frozen rungs; omitted means WORLD, the floor. */
  readonly depth?: HistoricalSemanticDepth;
  readonly inspection?: HistoricalInspectionRequest;
}

function query(request: HistoricalDisclosureRequest): string {
  if (!isSessionPosition(request.tc) || !Number.isSafeInteger(request.tc)) {
    throw new RangeError('tc must be an addressable Session Position >= 1.');
  }
  const parts = [`tc=${request.tc}`];
  if (request.depth !== undefined) {
    if (!isSemanticDepth(request.depth)) throw new RangeError('depth must be one of the five frozen semantic depths.');
    parts.push(`depth=${request.depth}`);
  }
  if (request.inspection !== undefined) {
    const { family, id, version, appearance } = request.inspection;
    if (typeof id !== 'string' || id.length === 0) throw new RangeError('inspection.id must be a non-empty identity.');
    parts.push(`inspectFamily=${encodeURIComponent(family)}`, `inspectId=${encodeURIComponent(id)}`);
    if (version !== undefined) {
      if (!Number.isSafeInteger(version) || version < 1) throw new RangeError('inspection.version must be an integer >= 1.');
      parts.push(`inspectVersion=${version}`);
    }
    if (appearance !== undefined) {
      if (typeof appearance.bindingId !== 'string' || appearance.bindingId.length === 0) throw new RangeError('inspection.appearance.bindingId must be a non-empty identity.');
      parts.push(`appearanceKind=${encodeURIComponent(appearance.kind)}`, `appearanceBindingId=${encodeURIComponent(appearance.bindingId)}`);
    }
  }
  return `?${parts.join('&')}`;
}

export class HistoricalProjectionApiClient {
  constructor(private readonly config: HistoricalProjectionApiConfig) {}

  /** `GET /conversation/sessions/:sessionId/historical-projection`: V for (Session, TC, depth, inspection). */
  async fetchDisclosure(sessionId: string, request: HistoricalDisclosureRequest): Promise<HistoricalDisclosure> {
    const url = `${this.config.baseUrl}/conversation/sessions/${encodeURIComponent(sessionId)}/historical-projection${query(request)}`;
    let response: Awaited<ReturnType<HistoricalFetchLike>>;
    try {
      response = await this.config.fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${this.config.accessToken}`, Accept: 'application/json' } });
    } catch {
      throw new HistoricalTransportError({ kind: 'NETWORK' });
    }
    if (!response.ok) {
      if (response.status === 404) throw new HistoricalTransportError({ kind: 'UNAVAILABLE', code: 'SESSION_NOT_VISIBLE', status: 404 });
      if (response.status === 400 || response.status === 409) {
        let body: unknown;
        try { body = await response.json(); } catch { throw new HistoricalTransportError({ kind: 'HTTP', status: response.status }); }
        const refusal = decodeUnavailableBody(body);
        if (refusal.ok) throw new HistoricalTransportError({ kind: 'UNAVAILABLE', code: refusal.value.code, status: response.status });
      }
      throw new HistoricalTransportError({ kind: 'HTTP', status: response.status });
    }
    let body: unknown;
    try { body = await response.json(); } catch { throw new HistoricalTransportError({ kind: 'MALFORMED_BODY' }); }
    const decoded = decodeHistoricalDisclosure(body);
    if (!decoded.ok) throw new HistoricalTransportError({ kind: 'INVALID_PAYLOAD', reason: decoded.reason, detail: decoded.detail });
    // The requested Session, TC and depth are part of the trust boundary: a
    // well-shaped disclosure of another Session, another Session Position or
    // another depth is never returned as a successful result.
    if (decoded.value.sessionId !== sessionId) {
      throw new HistoricalTransportError({ kind: 'INVALID_PAYLOAD', reason: 'INVALID_IDENTITY', detail: `disclosure.sessionId: requested Session ${sessionId}, received ${decoded.value.sessionId}` });
    }
    if (decoded.value.tc !== request.tc) {
      throw new HistoricalTransportError({ kind: 'INVALID_PAYLOAD', reason: 'INCOHERENT_HEADER', detail: `disclosure.tc: requested ${request.tc}, received ${decoded.value.tc}` });
    }
    if (decoded.value.depth !== (request.depth ?? 'WORLD')) {
      throw new HistoricalTransportError({ kind: 'INVALID_PAYLOAD', reason: 'INVALID_DEPTH', detail: `disclosure.depth: requested ${request.depth ?? 'WORLD'}, received ${decoded.value.depth}` });
    }
    return decoded.value;
  }
}
