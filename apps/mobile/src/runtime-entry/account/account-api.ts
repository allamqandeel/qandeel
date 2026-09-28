/**
 * W1B-01 — the clients for the account routes.
 *
 *   GET  /account/first-use               — the caller's own Name and first-use state
 *   POST /account/first-use/welcome       — complete the caller's own Welcome step
 *   POST /account/login-id-availability   — may this Login ID still be chosen? (signed out)
 *
 * Transports and nothing else, exactly like the Conversation clients: they hold no credential (the
 * signed-in client goes through the AC-01 request-time seam its caller hands it; the availability
 * client carries none at all), they never repeat a request, and they never decide what an outcome
 * means to the reader. They decode strictly and report a typed outcome.
 */
import type { RuntimeHttpFetch } from '../conversation/conversation-session-api';

/** What the reader's first use and Conversation opening need to know, as the server decided it. */
export interface AccountFirstUseView {
  /** The account Name QANDEEL addresses the reader by, or null. No fallback is ever supplied. */
  readonly displayName: string | null;
  /** The one-time first-use Welcome is still owed. */
  readonly welcomePending: boolean;
  /** The First Conversation Opening, not the normal opener, is owed: no turn was ever committed. */
  readonly firstConversationOpening: boolean;
}

export type AccountFirstUseOutcome =
  | { readonly kind: 'READ'; readonly view: AccountFirstUseView }
  | { readonly kind: 'UNAVAILABLE' };

export type LoginIdAvailabilityOutcome =
  | { readonly kind: 'AVAILABLE' }
  | { readonly kind: 'TAKEN' }
  /** No HTTP answer at all: a genuine transport failure. */
  | { readonly kind: 'NETWORK' }
  /** The server answered, but not with a usable verdict. */
  | { readonly kind: 'FAILED' };

export interface AccountApiConfig {
  /** Origin plus any base path, without a trailing slash. */
  readonly baseUrl: string;
  readonly fetch: RuntimeHttpFetch;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function decodeFirstUse(body: unknown): AccountFirstUseView | null {
  if (!isRecord(body)) return null;
  const { displayName, welcomePending, firstConversationOpening } = body;
  if (displayName !== null && (typeof displayName !== 'string' || displayName === '')) return null;
  if (typeof welcomePending !== 'boolean' || typeof firstConversationOpening !== 'boolean') return null;
  return { displayName, welcomePending, firstConversationOpening };
}

/** The signed-in account client. Built on the AC-01 seam bound to one identity. */
export class AccountApiClient {
  constructor(private readonly config: AccountApiConfig) {}

  async readFirstUse(): Promise<AccountFirstUseOutcome> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}/account/first-use`, { method: 'GET', headers: { Accept: 'application/json' } });
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
    if (!response.ok) return { kind: 'UNAVAILABLE' };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'UNAVAILABLE' };
    }
    const view = decodeFirstUse(body);
    return view === null ? { kind: 'UNAVAILABLE' } : { kind: 'READ', view };
  }

  /** Issued once. Whether it landed is reported; nothing is repeated here. */
  async completeWelcome(): Promise<boolean> {
    try {
      const response = await this.config.fetch(`${this.config.baseUrl}/account/first-use/welcome`, { method: 'POST', headers: { Accept: 'application/json' } });
      return response.ok;
    } catch {
      // A refused credential seam or a dropped connection: either way the completion did not land.
      return false;
    }
  }
}

/**
 * The one signed-out account question. It carries no credential — there is no account yet — and the
 * Login ID travels in the body, never in a URL.
 */
export class LoginIdAvailabilityClient {
  constructor(private readonly config: AccountApiConfig) {}

  async check(loginId: string): Promise<LoginIdAvailabilityOutcome> {
    let response: Awaited<ReturnType<RuntimeHttpFetch>>;
    try {
      response = await this.config.fetch(`${this.config.baseUrl}/account/login-id-availability`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId }),
      });
    } catch {
      return { kind: 'NETWORK' };
    }
    if (!response.ok) return { kind: 'FAILED' };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: 'FAILED' };
    }
    if (!isRecord(body) || typeof body.available !== 'boolean') return { kind: 'FAILED' };
    return body.available ? { kind: 'AVAILABLE' } : { kind: 'TAKEN' };
  }
}
