/**
 * S8B-06 CP3 — the read-only client for the reader's own call as the server holds it (S8B-05 CP1, 0189):
 *
 *   GET /voice/calls/truth — `{ callTruth: 'ACTIVE' | 'NO_CALL_KNOWN', callId, callState, startedAt }`
 *
 * One read and nothing else: no socket (the call's one WebSocket is the voice-call client's, never this layer's), no
 * command, no user id, no cache and no persistence. The identity is the verified token on the server, decided at each
 * request by the AC-01 seam its caller hands it. It decodes strictly: an answer it cannot read is UNAVAILABLE, never a
 * guess, and never "no call" — a phone that cannot read the truth must not conclude that a call has ended.
 */
import type { RuntimeHttpFetch } from './conversation/conversation-session-api';

export interface CallTruthApiConfig {
  /** Origin plus any base path, without a trailing slash. */
  readonly baseUrl: string;
  /** Always the AC-01 authorized seam in production: the bearer is decided at each request. */
  readonly fetch: RuntimeHttpFetch;
}

export type ServerCallState = 'CONNECTING' | 'ACTIVE' | 'RECONNECTING' | 'ENDED';

export type CallTruthRead =
  | { readonly kind: 'ACTIVE'; readonly callId: string; readonly callState: ServerCallState; readonly startedAt: string | null }
  | { readonly kind: 'NO_CALL_KNOWN' }
  | { readonly kind: 'UNAVAILABLE' };

const STATES: ReadonlySet<string> = new Set(['CONNECTING', 'ACTIVE', 'RECONNECTING', 'ENDED']);
const KEYS = ['callTruth', 'callId', 'callState', 'startedAt'];

export function decodeCallTruth(body: unknown): CallTruthRead {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { kind: 'UNAVAILABLE' };
  const record = body as Record<string, unknown>;
  const own = Object.keys(record);
  if (own.length !== KEYS.length || !KEYS.every((key) => own.includes(key))) return { kind: 'UNAVAILABLE' };
  if (record.callTruth === 'NO_CALL_KNOWN') return { kind: 'NO_CALL_KNOWN' };
  if (record.callTruth !== 'ACTIVE') return { kind: 'UNAVAILABLE' };
  const { callId, callState, startedAt } = record;
  if (typeof callId !== 'string' || callId.length === 0 || typeof callState !== 'string' || !STATES.has(callState)) return { kind: 'UNAVAILABLE' };
  if (startedAt !== null && typeof startedAt !== 'string') return { kind: 'UNAVAILABLE' };
  return { kind: 'ACTIVE', callId, callState: callState as ServerCallState, startedAt };
}

export class CallTruthApiClient {
  constructor(private readonly config: CallTruthApiConfig) {}

  async read(): Promise<CallTruthRead> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}/voice/calls/truth`, { method: 'GET', headers: { Accept: 'application/json' } });
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
    if (!response.ok) return { kind: 'UNAVAILABLE' };
    try {
      return decodeCallTruth(await response.json());
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
  }
}

/**
 * The call channel's address for this API: the same origin, `https` → `wss` (and, for the local proof only, `http` →
 * `ws`; the voice-call client refuses cleartext unless its proof flag allows the loopback). Null for anything else.
 */
export function callConnectUrl(baseUrl: string): string | null {
  const match = /^(https?):\/\/(.+)$/u.exec(baseUrl);
  if (!match) return null;
  return `${match[1] === 'https' ? 'wss' : 'ws'}://${match[2]}/voice/calls/connect`;
}
