/**
 * T-12 §10 / §18 — coordinating the current canonical viewpoint into T-03C requests.
 *
 * > **Projection coordination writes no canonical state.**
 *
 * There is exactly ONE cache and this owner does not hold it: `bundle.projection` is the
 * `HistoricalDisclosureCache` the T-12P bootstrap created, and everything here writes into that one.
 * Nothing is remembered beside it — no second map of disclosures, no derived copy, no snapshot.
 *
 * ## The gate this adds, and the defect it closes
 *
 * The frozen cache is deliberately passive: `hold` observes the delivered revision and then writes
 * the entry UNCONDITIONALLY. `observeRevision` refuses to rewind a Session's revision, but the write
 * that follows it does not consult anything — so two open-head fetches of the SAME (Session, TC,
 * depth) that resolve out of order leave the OLDER disclosure held, silently, with nothing anywhere
 * able to tell. That is correct behaviour for a holder; deciding which response is still wanted is a
 * composition fact, and composition is here.
 *
 * So every fetch carries an epoch, and a response may write only if its epoch is still the latest one
 * issued for its exact key AND the runtime generation it was issued under is still current. A
 * response that loses that race is dropped — not held for a different key, not merged, not retried
 * into the newer one. Nothing is decided by a timer or by arrival order.
 *
 * ## Identity is proven against the payload, not assumed from the request
 *
 * A disclosure names the Session, the `tc` and the depth it IS. Those are compared with what was
 * asked for before anything is held, so a response that answers a different question — a different
 * Session above all — cannot become this viewpoint's truth even if a transport, a proxy or a cache
 * upstream confused two requests.
 *
 * ## The three technical states stay three
 *
 * A typed refusal is knowledge and is held as `UNAVAILABLE`. A transport failure is NOT knowledge:
 * nothing is held, the key stays `NOT_FETCHED`, and it stays retryable. Neither ever becomes an empty
 * world, and neither is ever converted into the other. No `V` is invented, no future material is
 * disclosed early, and no object is ghosted from a viewpoint the reader has left.
 *
 * ## Credentials
 *
 * `HistoricalProjectionApiConfig` captures the access token at construction and exposes no setter, so
 * a client held across a refresh would go on presenting the token it was born with. A client is
 * therefore built immediately before each request from the credential read at that instant — the same
 * rule T-12P's live driver follows, for the same reason — and a request whose credential belongs to a
 * replaced identity is never issued at all.
 */

import {
  HistoricalTransportError,
  type HistoricalDisclosure,
  type HistoricalDisclosureCache,
  type HistoricalProjectionApiClient,
} from '../../projection';
import type { MapProjectionRequest } from '../../map';

/** The credential a request is authorized with, read fresh at every request boundary. */
export interface ProjectionCredential {
  readonly accessToken: string;
  readonly authGeneration: number;
}

export interface ProjectionCoordinatorOptions {
  readonly sessionId: string;
  readonly cache: HistoricalDisclosureCache;
  /** The authenticated identity this bundle belongs to. A request is never issued for another. */
  readonly authGeneration: number;
  readonly credential: () => ProjectionCredential | null;
  /** Builds a transport for ONE request. Never held across requests. */
  readonly createProjectionClient: (accessToken: string) => HistoricalProjectionApiClient;
  /** Whether this coordinator's runtime generation is still the current one. */
  readonly isCurrent: () => boolean;
}

/** Why a fetch did not happen, or what it produced. Technical throughout; never a semantic claim. */
export type ProjectionFetchOutcome =
  | 'FETCHED'
  | 'UNAVAILABLE'
  | 'NOT_FETCHED'
  | 'ALREADY_HELD'
  | 'IN_FLIGHT'
  | 'NOT_AUTHENTICATED'
  | 'RETIRED'
  | 'STALE'
  | 'IDENTITY_MISMATCH';

export interface ProjectionCoordinator {
  /**
   * Make sure the disclosure for this exact request is held, fetching it once if it is not.
   *
   * Idempotent per key: a key already held, or already being fetched, issues nothing. That is what
   * keeps a render loop from becoming a fetch loop.
   */
  ensure(request: MapProjectionRequest): Promise<ProjectionFetchOutcome>;
  /** Re-fetch a key whose held value the cache has invalidated. Same gate, same identity proof. */
  refresh(request: MapProjectionRequest): Promise<ProjectionFetchOutcome>;
  /**
   * Observe the moments the CACHE's contents actually changed.
   *
   * The frozen cache is passive and publishes nothing, so a reader cannot subscribe to it. This is
   * the notification for the writes THIS coordinator made — never a second copy of what it holds, and
   * never a claim about what is in it. Readers still ask the cache itself.
   */
  subscribe(listener: () => void): () => void;
  /** A counter that advances on each such change. The `useSyncExternalStore` snapshot. */
  revision(): number;
  /** How many fetches are outstanding. For proofs and for nothing else. */
  inFlightCount(): number;
  /** Retire every outstanding fetch: nothing issued under this coordinator may write again. */
  retire(): void;
}

const keyOf = (request: MapProjectionRequest): string => [request.sessionId, String(request.tc), request.depth].join(' ');

/**
 * Whether a delivered disclosure IS the answer to the question that was asked.
 *
 * A response is data, and a payload that names a different Session, position or rung is not this
 * viewpoint's truth however well-formed it is.
 */
function answers(disclosure: HistoricalDisclosure, request: MapProjectionRequest): boolean {
  return disclosure.sessionId === request.sessionId && disclosure.tc === request.tc && disclosure.depth === request.depth;
}

export function createProjectionCoordinator(options: ProjectionCoordinatorOptions): ProjectionCoordinator {
  const { sessionId, cache, authGeneration, credential, createProjectionClient, isCurrent } = options;

  /** key -> the epoch of the most recent request issued for it. The whole staleness rule. */
  const latest = new Map<string, number>();
  const listeners = new Set<() => void>();
  let epochs = 0;
  let changes = 0;
  let retired = false;

  const changed = () => {
    changes += 1;
    for (const listener of Array.from(listeners)) listener();
  };

  async function issue(request: MapProjectionRequest): Promise<ProjectionFetchOutcome> {
    if (retired || !isCurrent()) return 'RETIRED';
    // A request for another Session cannot be built from this bundle at all: the Session is the
    // bundle's, not the caller's, so a foreign viewpoint is refused before a URL exists.
    if (request.sessionId !== sessionId) return 'IDENTITY_MISMATCH';

    const held = credential();
    if (held === null) return 'NOT_AUTHENTICATED';
    // A credential belonging to a replaced identity never authorizes a request for this bundle.
    if (held.authGeneration !== authGeneration) return 'RETIRED';

    const key = keyOf(request);
    const epoch = (epochs += 1);
    latest.set(key, epoch);

    // Built here, immediately before the request, from the credential read one line above.
    const client = createProjectionClient(held.accessToken);

    let disclosure: HistoricalDisclosure;
    try {
      disclosure = await client.fetchDisclosure(request.sessionId, { tc: request.tc, depth: request.depth });
    } catch (cause) {
      // The gate applies to a refusal exactly as it does to a success: a typed refusal that lost the
      // race describes a viewpoint whose answer has already been superseded, and writing it would
      // replace a newer truth with an older one.
      if (retired || !isCurrent()) return 'RETIRED';
      if (latest.get(key) !== epoch) return 'STALE';
      latest.delete(key);
      if (cause instanceof HistoricalTransportError && cause.failure.kind === 'UNAVAILABLE') {
        cache.holdUnavailable(request.sessionId, request.tc, request.depth, cause.failure.code);
        changed();
        return 'UNAVAILABLE';
      }
      // A transport failure is not knowledge. Nothing is held; the key stays NOT_FETCHED and
      // retryable, which is the truthful "we do not know" rather than an empty world.
      return 'NOT_FETCHED';
    }

    if (retired || !isCurrent()) return 'RETIRED';
    if (latest.get(key) !== epoch) return 'STALE';
    if (!answers(disclosure, request)) {
      latest.delete(key);
      return 'IDENTITY_MISMATCH';
    }
    latest.delete(key);
    cache.hold(disclosure);
    changed();
    return 'FETCHED';
  }

  return {
    ensure(request) {
      if (retired || !isCurrent()) return Promise.resolve<ProjectionFetchOutcome>('RETIRED');
      if (request.sessionId !== sessionId) return Promise.resolve<ProjectionFetchOutcome>('IDENTITY_MISMATCH');
      const key = keyOf(request);
      if (latest.has(key)) return Promise.resolve<ProjectionFetchOutcome>('IN_FLIGHT');
      // The cache is the one authority on what is already known. NOT_FETCHED is the only state that
      // warrants a request: a typed refusal is knowledge and is not re-asked on every render, and the
      // cache clears the two refusals that depend on the Live Head when a newer revision arrives.
      if (cache.lookup(request.sessionId, request.tc, request.depth).status !== 'NOT_FETCHED') {
        return Promise.resolve<ProjectionFetchOutcome>('ALREADY_HELD');
      }
      return issue(request);
    },

    refresh(request) {
      return issue(request);
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    revision: () => changes,

    inFlightCount: () => latest.size,

    retire() {
      retired = true;
      // Every outstanding epoch is now unmatchable, so no response still in flight can write.
      latest.clear();
      listeners.clear();
    },
  };
}
