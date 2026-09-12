/**
 * T-12P §2.6 / §8 — the canonical runtime bootstrap.
 *
 * The store must never be created from guessed Product truth, so this owner does the whole
 * sequence or none of it:
 *
 *   authenticated identity
 *   -> acquire ONE QANDEEL conversation Session
 *   -> fetch the authoritative temporal snapshot for that Session
 *   -> if (and only if) an addressable Live Head exists, fetch the WORLD disclosure at it
 *   -> derive the initial canonical state from already-frozen laws
 *   -> create the CanonicalStore exactly once
 *   -> READY
 *
 * WHAT IS NOT INVENTED HERE. A brand-new Session has no addressable position: `LH` is `null`, which
 * the kernel already defines as a technical absence sentinel — not `SP(0)`, not a Moment, never
 * addressable. So no `SP(1)` is fabricated, no `V` is fabricated, and no historical projection is
 * requested at all, because with no Live Head there is no legal `tc` to request one for. The
 * initial temporal mode is `FOLLOW_LIVE` because it is the only mode the kernel will accept at
 * construction: `PINNED` is rejected outright while `LH` is `null`, and neither act that could
 * establish `FOLLOW_LIVE` can run without a Live Head either. The camera is `initialCameraIntent()`
 * called with no arguments — not a default chosen here, but the canonical World/Z0 target that T-07
 * compares against, so constructing anything else would silently change what "Return to World"
 * means. `inspection` is `null`, the canonical "inspecting nothing".
 *
 * GENERATION SAFETY. Each attempt captures its generation and re-checks it before every step and
 * immediately before creating the store. A superseded attempt creates nothing and reports RETIRED,
 * so an old bootstrap can never become READY late or hand back a store nobody is watching.
 *
 * T-13 — RECOVERY GOES THROUGH THIS SAME SEQUENCE, NOT AROUND IT. A resumed Session arrives as
 * `existingSessionId` (the seam §2.5 already reserved for an already-authorized Session) and the
 * reader's durable viewpoint arrives as `initialViewpoint`. Nothing about the order changes: the
 * Session is validated by fetching its authoritative snapshot, the fresh `LH` / `LF` come from that
 * snapshot and never from storage, the viewpoint is judged against that snapshot — a pinned position
 * or a checkpoint beyond the fresh Live Head fails the attempt closed rather than being clamped — and
 * only then is the ONE store created, from fresh live truth plus the recovered `TM`, `IF_ref`, `MC`
 * and `RH`. The effective `TC` is derived by the kernel as always; it is never stored and never
 * supplied. A stale local frame therefore cannot exist: there is no store to render until the server
 * has answered.
 */
import { HistoricalDisclosureCache, HistoricalTransportError, type HistoricalProjectionApiClient } from '../../projection';
import { initialCameraIntent } from '../../map';
import {
  createCanonicalStore,
  sessionPosition,
  type CanonicalStateInit,
  type StoreDependencies,
} from '../../state';
import { liveTruthFromSnapshot, type TemporalApiClient } from '../../temporal';
import type { ConversationSessionApiClient } from '../conversation/conversation-session-api';
import type {
  BootstrapFailure,
  BootstrapResult,
  CanonicalRuntimeBundle,
  InitialDisclosureDisposition,
  InitialViewpoint,
} from './bootstrap-types';

/** The authenticated identity a bootstrap attempt is bound to. */
export interface BootstrapIdentity {
  readonly userId: string;
  readonly accessToken: string;
  readonly authGeneration: number;
}

export interface BootstrapClients {
  readonly conversation: ConversationSessionApiClient;
  readonly temporal: TemporalApiClient;
  readonly projection: HistoricalProjectionApiClient;
}

export interface BootstrapRequest {
  readonly identity: BootstrapIdentity;
  readonly clients: BootstrapClients;
  /**
   * The runtime generation this attempt belongs to, and the predicate that says whether it is still
   * the current one. Checked before every step and before store creation.
   */
  readonly runtimeGeneration: number;
  readonly isCurrent: () => boolean;
  /**
   * Store dependencies. T-12P supplies none: the Map, temporal and Return authorities belong to
   * T-04, T-06 and T-07, and wiring them is T-12's composition job. A store built without them
   * still ingests authoritative live truth, which is all T-12P needs, and executes no promoted act
   * at all — which is the correct fail-closed posture for a runtime with no Product surface.
   */
  readonly storeDependencies?: StoreDependencies;
  /**
   * An already-authorized conversation Session id, for a test or integration seam. When supplied,
   * NO session is created — this is the "unless an explicit already-authorized session ID is
   * supplied" half of §2.5 and it is the only way to avoid the create call.
   *
   * T-13 is the one production caller: the id comes from the identity's validated Product recovery
   * record, and the snapshot fetch below is what validates the Session against server authority.
   */
  readonly existingSessionId?: string;
  /**
   * T-13 — the reader's validated durable viewpoint, constructed INTO the store in place of the fresh
   * entry laws. Judged against the fresh snapshot first; refused whole if it is incoherent with it.
   */
  readonly initialViewpoint?: InitialViewpoint;
}

const failed = (failure: BootstrapFailure): BootstrapResult => ({ kind: 'FAILED', failure });

/**
 * T-13 — whether a durable viewpoint is possible under the fresh Live Head. The kernel's own
 * construction rule refuses `PINNED(t)` with `t > LH`; the checkpoints need the same judgement, because
 * a restoration is `PINNED(capturedTC)` and a captured position beyond the Live Head could never be
 * restored truthfully. Nothing is clamped, dropped or repaired: the first impossibility refuses all.
 */
function viewpointCoherenceIssue(viewpoint: InitialViewpoint, liveHead: number | null): string | null {
  if (viewpoint.temporal.kind === 'PINNED') {
    if (liveHead === null) return `PINNED(${viewpoint.temporal.at}) is impossible: the Session has no addressable Live Head`;
    if (viewpoint.temporal.at > liveHead) return `PINNED(${viewpoint.temporal.at}) is beyond the authoritative Live Head ${liveHead}`;
  }
  for (let index = 0; index < viewpoint.history.length; index += 1) {
    const captured = viewpoint.history[index].captured.tc;
    if (liveHead === null || captured > liveHead) {
      return `history[${index}] captured Session Position ${captured} is beyond the authoritative Live Head ${liveHead === null ? 'null' : liveHead}`;
    }
  }
  return null;
}

/**
 * Run one bootstrap attempt.
 *
 * Exactly one conversation Session is created per successful attempt, and never more: the single
 * `createSession` call below is the only one, and the caller (`createRuntimeEntryCoordinator`, or
 * T-12's own composition) guarantees one attempt per runtime generation. A token refresh does not
 * reach here at all, because it does not change the auth generation.
 */
export async function bootstrapCanonicalRuntime(request: BootstrapRequest): Promise<BootstrapResult> {
  const { identity, clients, runtimeGeneration, isCurrent } = request;
  if (!isCurrent()) return failed({ kind: 'RETIRED' });

  // 1 — one conversation Session for this runtime generation.
  let sessionId: string;
  if (request.existingSessionId !== undefined) {
    sessionId = request.existingSessionId;
  } else {
    const outcome = await clients.conversation.createSession(identity.accessToken);
    if (!isCurrent()) return failed({ kind: 'RETIRED' });
    if (outcome.kind !== 'CREATED') return failed({ kind: 'SESSION_ACQUISITION', outcome });
    sessionId = outcome.session.sessionId;
  }

  // 2 — the authoritative temporal snapshot. Validated by the transport before it is trusted.
  let snapshot;
  try {
    snapshot = await clients.temporal.fetchSessionTemporalState(sessionId);
  } catch (cause) {
    if (!isCurrent()) return failed({ kind: 'RETIRED' });
    return failed({ kind: 'SNAPSHOT', detail: describe(cause, 'the temporal snapshot could not be read') });
  }
  if (!isCurrent()) return failed({ kind: 'RETIRED' });
  if (snapshot.sessionId !== sessionId) {
    return failed({
      kind: 'SNAPSHOT',
      detail: `snapshot names Session ${snapshot.sessionId}, requested ${sessionId}`,
    });
  }

  // 3 — the initial canonical state: fresh live truth from the snapshot, and either the frozen entry
  // laws or (T-13) the reader's validated durable viewpoint judged against that same snapshot.
  let init: CanonicalStateInit;
  try {
    init = {
      session: { id: sessionId },
      live: liveTruthFromSnapshot(snapshot),
      temporal: { kind: 'FOLLOW_LIVE' },
      inspection: null,
      camera: initialCameraIntent(),
    };
  } catch (cause) {
    return failed({ kind: 'INVALID_INITIAL_STATE', detail: describe(cause, 'the snapshot could not become live truth') });
  }
  if (request.initialViewpoint !== undefined) {
    const issue = viewpointCoherenceIssue(request.initialViewpoint, snapshot.liveHead);
    if (issue !== null) return failed({ kind: 'VIEWPOINT_INCOHERENT', detail: issue });
    // `live` stays the snapshot's. The four recovered fields replace the entry laws, by name.
    init = {
      session: init.session,
      live: init.live,
      temporal: request.initialViewpoint.temporal,
      inspection: request.initialViewpoint.inspection,
      camera: request.initialViewpoint.camera,
      history: request.initialViewpoint.history,
    };
  }

  // 4 — the initial WORLD disclosure, only where one is legal, at the viewpoint the reader will
  // actually stand on: the fresh Live Head when following Live, the exact pinned position otherwise.
  const projection = new HistoricalDisclosureCache();
  let initialDisclosure: InitialDisclosureDisposition = 'NOT_APPLICABLE';
  const initialTc = init.temporal.kind === 'PINNED' ? init.temporal.at : snapshot.liveHead;
  if (initialTc !== null) {
    initialDisclosure = await loadInitialDisclosure(clients.projection, projection, sessionId, initialTc);
    if (!isCurrent()) return failed({ kind: 'RETIRED' });
  }

  // 5 — the last possible moment before the store exists. Nothing is created for a stale attempt.
  if (!isCurrent()) return failed({ kind: 'RETIRED' });

  let store;
  try {
    store = createCanonicalStore(init, request.storeDependencies ?? {});
  } catch (cause) {
    return failed({ kind: 'INVALID_INITIAL_STATE', detail: describe(cause, 'the canonical store refused the initial state') });
  }

  const bundle: CanonicalRuntimeBundle = {
    runtimeGeneration,
    authGeneration: identity.authGeneration,
    userId: identity.userId,
    sessionId,
    store,
    projection,
    initialDisclosure,
    cursors: {
      // The snapshot already established the mirror, so delivery resumes strictly after it.
      committedAfterSp: snapshot.liveHead === null ? null : sessionPosition(snapshot.liveHead),
      liveFocusAfterSp: snapshot.liveFocusAtSp === null ? null : sessionPosition(snapshot.liveFocusAtSp),
    },
  };
  return { kind: 'READY', bundle };
}

/**
 * Fetch the one WORLD disclosure at the initial viewpoint's position and hold whatever the server
 * actually said. For a fresh Session that is the Live Head; for a recovered `PINNED(t)` it is `t`.
 *
 * A typed refusal is held as `UNAVAILABLE` — it is knowledge, and the frozen contract keeps it
 * distinct from "not fetched". A transport failure holds nothing: the cache stays `NOT_FETCHED`,
 * which is the truthful "we do not know" and stays retryable. Neither becomes an empty world, and
 * neither blocks the runtime: a reader with no projection sees the technical state, which is
 * correct, rather than a fabricated one.
 */
async function loadInitialDisclosure(
  client: HistoricalProjectionApiClient,
  cache: HistoricalDisclosureCache,
  sessionId: string,
  tc: number,
): Promise<InitialDisclosureDisposition> {
  try {
    const disclosure = await client.fetchDisclosure(sessionId, { tc });
    cache.hold(disclosure);
    return 'FETCHED';
  } catch (cause) {
    if (cause instanceof HistoricalTransportError && cause.failure.kind === 'UNAVAILABLE') {
      cache.holdUnavailable(sessionId, tc, 'WORLD', cause.failure.code);
      return 'UNAVAILABLE';
    }
    return 'NOT_FETCHED';
  }
}

function describe(cause: unknown, fallback: string): string {
  return cause instanceof Error && cause.message !== '' ? cause.message : fallback;
}
