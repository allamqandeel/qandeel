/**
 * AC-01 — the ONE request-time credential seam.
 *
 * > **A credential is read at the request, not captured at the runtime.**
 *
 * The frozen T-03 transports take their bearer token as an immutable config field and expose no
 * setter: `TemporalApiConfig.accessToken` and `HistoricalProjectionApiConfig.accessToken` are read
 * on EVERY request from the value the client was constructed with. That is correct for a transport
 * — a transport should own no credential lifecycle — but it means whoever constructs one owns the
 * freshness of every request it will ever make.
 *
 * Two consumers already discharged that duty by building a client immediately before each request:
 * T-12P's live driver (`clientForRequest`) and T-12's projection coordinator. The runtime entry's
 * own BOOTSTRAP clients did not — they were constructed once from the access token as it stood at
 * bootstrap, so a Supabase `TOKEN_REFRESHED` landing mid-bootstrap left every later request on that
 * client presenting the superseded token. `authGeneration` is deliberately stable across a refresh,
 * so nothing retired, nothing re-bootstrapped, and nothing noticed.
 *
 * This closes it in ONE place instead of at each construction site. The seam wraps the HTTP
 * implementation rather than the client, so:
 *
 *   - no frozen T-03 module changes, and no frozen semantics move;
 *   - the `Authorization` header is decided at the moment of the request, from the authority that
 *     owns the credential, for every request every client built through it will ever make;
 *   - a construction site cannot opt out by forgetting, because it never holds a token to begin
 *     with — see `NO_CAPTURED_CREDENTIAL`.
 *
 * ## What it refuses, and why that is the safe direction
 *
 * The seam is bound to ONE auth generation: the identity the caller was built for. It refuses when
 * nobody is authenticated, and when the current credential belongs to a REPLACED identity. Both
 * refusals happen before a URL is opened, so no request carries a credential its caller did not
 * mean, and no request for a retired identity reaches the network at all.
 *
 * A refusal can only arise from an auth change, and every auth change that could cause one also
 * retires the runtime generation — so the bootstrap's own `isCurrent()` checks report `RETIRED`
 * and the transport-level failure the refusal produced is discarded rather than surfaced. The
 * non-idempotent Session create is the case that makes this matter: its `OUTCOME_UNKNOWN` means
 * "a Session may exist on the server and this client cannot learn its id", which would be a false
 * claim about a request that was never sent. It is unreachable for exactly the reason above, and
 * `credential-freshness.test.ts` proves it rather than asserting it.
 *
 * ## What it is not
 *
 * Not global mutable state: the supplier is a closure over the auth authority, there is no module
 * scope here, and nothing is written. Not a refresh trigger: it READS whatever the Supabase SDK has
 * already supplied and never asks for a token of its own. Not a logger: no error, message or field
 * below carries a credential value.
 */
import type { RuntimeHttpFetch } from '../conversation/conversation-session-api';

/** The credential one request is authorized with, together with the identity it belongs to. */
export interface RuntimeCredential {
  readonly accessToken: string;
  readonly authGeneration: number;
}

/** Reads the credential as it stands RIGHT NOW, or `null` when nobody is authenticated. */
export type RuntimeCredentialSupplier = () => RuntimeCredential | null;

export type CredentialRefusal =
  /** Nobody is authenticated. There is no credential to authorize anything with. */
  | 'NOT_AUTHENTICATED'
  /** Someone is authenticated, but it is no longer the identity this caller was built for. */
  | 'IDENTITY_REPLACED';

/**
 * A request that was REFUSED before it was issued.
 *
 * It never reached the network, so no server observed it and no state can have changed because of
 * it. Carries the reason and nothing else — never a token, never a URL with one in it.
 */
export class CredentialUnavailableError extends Error {
  constructor(readonly refusal: CredentialRefusal) {
    super(`The request was not issued: ${refusal}.`);
    this.name = 'CredentialUnavailableError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * The placeholder a frozen transport config is constructed with.
 *
 * `TemporalApiConfig` and `HistoricalProjectionApiConfig` REQUIRE an `accessToken`, so a client
 * built for use behind this seam must pass something. Passing the real token would leave a genuine
 * credential captured in the object graph — the very thing this correction removes — and would make
 * a future construction site that forgot the seam fail SILENTLY, with a stale but well-formed
 * token, which is the original defect wearing a different hat.
 *
 * So the captured value is deliberately not a credential. Behind the seam it is overwritten before
 * every request and never reaches the wire. Without the seam it produces an immediate, unambiguous
 * `401` naming itself, which is the fail-closed direction.
 */
export const NO_CAPTURED_CREDENTIAL = 'no-captured-credential';

export interface AuthorizedFetchOptions {
  /** The live credential authority. Called once per request, never cached. */
  readonly credential: RuntimeCredentialSupplier;
  /**
   * The authenticated identity the caller was built for. A credential from any other generation
   * refuses the request rather than authorizing it for the wrong reader.
   */
  readonly authGeneration: number;
  /** The HTTP implementation the authorized request is delegated to. */
  readonly fetch: RuntimeHttpFetch;
}

/**
 * Wrap an HTTP implementation so that every request it carries is authorized at the moment it is
 * issued.
 *
 * The `Authorization` header is written LAST and therefore always wins: whatever a client put there
 * from its own config — including {@link NO_CAPTURED_CREDENTIAL} — is replaced by the credential
 * read one line earlier. Every other header and the body are passed through untouched.
 */
export function createAuthorizedFetch({ credential, authGeneration, fetch }: AuthorizedFetchOptions): RuntimeHttpFetch {
  // `async` so a refusal is always a REJECTED promise rather than a synchronous throw. Every caller
  // today awaits inside a `try`, where both behave identically, but a future one that holds the
  // promise before awaiting it would see a synchronous throw escape its own error handling.
  return async (input, init) => {
    const current = credential();
    if (current === null) throw new CredentialUnavailableError('NOT_AUTHENTICATED');
    if (current.authGeneration !== authGeneration) throw new CredentialUnavailableError('IDENTITY_REPLACED');
    return fetch(input, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${current.accessToken}` },
    });
  };
}
