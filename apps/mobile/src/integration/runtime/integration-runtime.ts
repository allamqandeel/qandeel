/**
 * T-12 §7 / §8 — the ONE integration owner.
 *
 * > **Integration connects owners. Integration does not replace owners.**
 *
 * Its whole job is lifecycle and composition: obtain a runtime from T-12P, wire the three frozen
 * promoted-act authorities into the one store that runtime creates, hang the T-12-owned coordinators
 * off that same generation, and retire all of them together. It is not a second canonical store, a
 * second Return engine, a second projection cache, a second temporal cursor, a second camera, a
 * semantic resolver, or persistence — and it holds no Product truth of its own at all.
 *
 * ## One store, and the memoization trap that could have cost it
 *
 * `MobileRuntimeEntry.bootstrap` memoises its in-flight attempt per AUTH generation and — this is the
 * part that matters — ignores the overrides of every later call. A single bootstrap issued without
 * `storeDependencies` would therefore hand this generation a store with no Map, temporal or Return
 * authority, permanently: every promoted act would fail closed, silently, and the app would look
 * mounted while being inert. The trap is that such a call is indistinguishable from a correct one at
 * the call site.
 *
 * It is closed structurally rather than by discipline. `createMobileRuntimeEntry` is called HERE and
 * the resulting entry is never published: nothing outside this module holds it, so no other code can
 * bootstrap it. Inside, `bootstrap` appears exactly once, in `bootstrapWithAuthorities`, which always
 * carries the dependencies and takes only the recovery decision beside them. The static contract pins
 * both facts.
 *
 * ## Generations
 *
 * A runtime generation is the identity of everything bound to one authenticated identity and one
 * conversation Session: the store, the one projection cache, the live driver, the projection
 * coordinator, the journey origin, the composite spatial cause and — since T-13 — the recovery writer.
 * T-12P retires its half on sign-out and identity replacement; this owner retires its half in the same
 * breath, so no coordinator, no outstanding fetch, no armed motion cause and no queued durable write
 * can ever address a store that has been replaced.
 *
 * A token refresh is NOT a generation change and deliberately retires nothing.
 *
 * ## Recovery is consumed here, and owned elsewhere (T-13)
 *
 * The Product recovery boundary is T-13's `recovery/` layer, reached through its barrel exactly as
 * every other owner is. This module holds no record, no codec, no storage and no schema; what it does
 * is sequence the frozen recovery order for one authenticated identity:
 *
 *     auth identity -> load and validate THIS identity's record -> decide
 *       -> FRESH:   the existing clean new-Session bootstrap
 *       -> RESUME:  the existing bootstrap through its `existingSessionId` seam, with the recovered
 *                   viewpoint, so the Session is validated against server authority and the fresh
 *                   authoritative snapshot is fetched before any store exists
 *       -> REFUSED: fail closed. No replacement Session is created, nothing becomes READY, and the
 *                   refusal is published as the controlled `RECOVERY_FAILED` phase.
 *
 * READY is published only after that whole sequence succeeded, which is what makes the forbidden order
 * — render a stale local world, then correct it — unrepresentable: there is no store to render until the
 * server has answered. After READY the T-13 writer advances the durable snapshot from the ONE store; it
 * is retired with the generation like everything else.
 *
 * Nothing here is a persistence route: this layer never reads or writes storage itself, and the seam
 * that tears down (`dispose`) is still not a seam that restores.
 */

import { createTemporalPreviewController, type TemporalPreviewController } from '../../temporal-navigation';
import { createPresentationController, disclosedTrack, type PresentationController } from '../../timeline';
import { MAP_ACTION_AUTHORITY } from '../../map';
import { TEMPORAL_ACTION_AUTHORITY } from '../../temporal-navigation';
import { RETURN_ACTION_AUTHORITY, type ReturnSurface } from '../../return-navigation';
import { HistoricalProjectionApiClient } from '../../projection';
import type { CanonicalStore, StoreDependencies } from '../../state';
import {
  createMobileRuntimeEntry,
  type BootstrapFailure,
  type CanonicalRuntimeBundle,
  type ForegroundLiveDriver,
  type MobileAuthAuthority,
  type MobileAuthState,
  type MobilePublicConfig,
  type MobilePublicConfigFailure,
  type MobileRuntimeEntry,
  type MobileRuntimeEntryOptions,
} from '../../runtime-entry';
import {
  attachRecoveryWriter,
  createProductRecoveryStore,
  decideRecovery,
  type ProductRecoveryStorage,
  type ProductRecoveryStore,
  type RecoveryDecision,
  type RecoveryRefusal,
  type RecoveryWriter,
} from '../../recovery';
import { createInspectionJourneyCoordinator, type InspectionJourneyCoordinator } from '../journey/inspection-journey';
import { createCanonicalTransitionWitness, type CanonicalTransitionWitness } from '../motion/canonical-transition-witness';
import { createSpatialCauseBinding, type SpatialCauseBinding } from '../motion/spatial-cause';
import { createProjectionCoordinator, type ProjectionCoordinator } from '../projection/projection-coordinator';

/**
 * The three frozen promoted-act authorities, as ONE value.
 *
 * They are the production verifiers their owning tasks published — T-04's, T-06's and T-07's — and
 * they are deliberately three distinct objects: a store given one owner's verifier for another
 * family would let that owner's mint open the neighbouring door. Wiring is all this constant does;
 * no authority is created, wrapped, widened or re-implemented here.
 */
export const T12_STORE_DEPENDENCIES: StoreDependencies = Object.freeze({
  mapActionAuthority: MAP_ACTION_AUTHORITY,
  temporalActionAuthority: TEMPORAL_ACTION_AUTHORITY,
  returnActionAuthority: RETURN_ACTION_AUTHORITY,
});

/**
 * The ONE place this layer bootstraps, and it cannot do so without the authorities.
 *
 * `existingSessionId` is passed in exactly one case: a RESUME decision, whose Session locator came
 * from THIS identity's validated Product recovery record. It is never a literal, never a fixture and
 * never synthesised here; a FRESH decision passes none and the bootstrap acquires a Session as before.
 * The recovered viewpoint travels beside it so the bootstrap can judge it against the fresh snapshot.
 */
function bootstrapWithAuthorities(entry: MobileRuntimeEntry, decision: Extract<RecoveryDecision, { kind: 'FRESH' | 'RESUME' }>) {
  if (decision.kind === 'RESUME') {
    return entry.bootstrap({
      storeDependencies: T12_STORE_DEPENDENCIES,
      existingSessionId: decision.record.sessionId,
      initialViewpoint: decision.record.viewpoint,
    });
  }
  return entry.bootstrap({ storeDependencies: T12_STORE_DEPENDENCIES });
}

/** How this generation's Session came to be: acquired afresh, or resumed from the identity's record. */
export type SessionOrigin = 'FRESH' | 'RESUMED';

/** Everything bound to one runtime generation. Replaced as a whole, never field by field. */
export interface IntegrationSessionRuntime {
  readonly generation: number;
  readonly bundle: CanonicalRuntimeBundle;
  readonly store: CanonicalStore;
  /** The ONE cache, created by the T-12P bootstrap. This layer creates none. */
  readonly projection: ProjectionCoordinator;
  readonly journey: InspectionJourneyCoordinator;
  readonly spatialCause: SpatialCauseBinding;
  /** The canonical state either side of the most recent change. Both backlog bindings read it. */
  readonly witness: CanonicalTransitionWitness;
  readonly preview: TemporalPreviewController;
  readonly presentation: PresentationController;
  /** T-07's surface: the store and the preview it must cancel before any return act. */
  readonly returnSurface: ReturnSurface;
  readonly liveDriver: ForegroundLiveDriver;
  /** T-13: where this Session came from, and the writer advancing its durable snapshot. */
  readonly recovery: { readonly origin: SessionOrigin; readonly writer: RecoveryWriter };
}

/**
 * Why recovery failed closed. Two come from the T-13 owner (the record, or the storage); the third is
 * the bootstrap refusing the resumed Session or the recovered viewpoint against server authority.
 */
export type RecoveryFailure = RecoveryRefusal | { readonly kind: 'SESSION_INVALID'; readonly failure: BootstrapFailure };

export type IntegrationPhase =
  /** Public configuration is absent or refused. No runtime is built; nothing points anywhere. */
  | { readonly kind: 'CONFIG_REFUSED'; readonly failure: MobilePublicConfigFailure; readonly detail: string }
  | { readonly kind: 'RESTORING' }
  /** Nobody is authenticated. A correct resting state, and not a failure. */
  | { readonly kind: 'SIGNED_OUT' }
  | { readonly kind: 'AUTH_ERROR' }
  /** T-13: the identity's Product recovery record is being loaded and validated. Technical, never a world. */
  | { readonly kind: 'RECOVERING' }
  | { readonly kind: 'BOOTSTRAPPING' }
  | { readonly kind: 'BOOTSTRAP_FAILED'; readonly failure: BootstrapFailure }
  /** T-13: recovery failed closed. No replacement Session was created and nothing is READY. */
  | { readonly kind: 'RECOVERY_FAILED'; readonly failure: RecoveryFailure }
  | { readonly kind: 'READY'; readonly runtime: IntegrationSessionRuntime };

export interface IntegrationRuntime {
  readonly config: MobilePublicConfig;
  /**
   * The authenticated identity authority, exposed READ-ONLY for orientation and for the
   * validation-only auth harness `QAN-BL-T12-04` requires. `bootstrap` is deliberately NOT exposed.
   */
  readonly auth: MobileAuthAuthority;
  getPhase(): IntegrationPhase;
  subscribe(listener: () => void): () => void;
  /** Restore any persisted AUTH session and begin observing. Idempotent. */
  start(): Promise<void>;
  dispose(): void;
}

export type IntegrationRuntimeResult =
  | { readonly ok: true; readonly runtime: IntegrationRuntime }
  | { readonly ok: false; readonly phase: Extract<IntegrationPhase, { kind: 'CONFIG_REFUSED' }> };

export interface IntegrationRuntimeOptions extends MobileRuntimeEntryOptions {
  /** Injected by the tests so a bootstrap can be driven without a network. Production passes none. */
  readonly httpFetch?: MobileRuntimeEntryOptions['httpFetch'];
  /**
   * T-13: the Product recovery storage. Injected by the tests; production passes none and the T-13
   * owner builds its own SQLite-backed one, separate from the auth store.
   */
  readonly recoveryStorage?: ProductRecoveryStorage;
}

export function createIntegrationRuntime(options: IntegrationRuntimeOptions = {}): IntegrationRuntimeResult {
  const built = createMobileRuntimeEntry(options);
  if (!built.ok) {
    return { ok: false, phase: { kind: 'CONFIG_REFUSED', failure: built.failure, detail: built.detail } };
  }
  const entry = built.runtime;
  // The ONE Product recovery store, from the T-13 owner. Built once for the life of this runtime; it is
  // namespaced per identity inside, so identity replacement needs no second store.
  const recovery: ProductRecoveryStore = createProductRecoveryStore(options.recoveryStorage);

  const listeners = new Set<() => void>();
  let phase: IntegrationPhase = { kind: 'RESTORING' };
  let session: IntegrationSessionRuntime | null = null;
  let attemptedAuthGeneration: number | null = null;
  let disposed = false;

  const publish = (next: IntegrationPhase) => {
    phase = next;
    for (const listener of Array.from(listeners)) listener();
  };

  /** Tear down everything bound to the current generation. Retires; never restores. */
  function retireSession(): void {
    if (session === null) return;
    session.recovery.writer.retire();
    session.liveDriver.dispose();
    session.projection.retire();
    session.journey.retire();
    session.spatialCause.retire();
    session.witness.dispose();
    session.preview.cancel();
    session = null;
  }

  function buildSession(bundle: CanonicalRuntimeBundle, decision: Extract<RecoveryDecision, { kind: 'FRESH' | 'RESUME' }>): IntegrationSessionRuntime {
    const generation = bundle.runtimeGeneration;
    const isCurrent = () => !disposed && entry.currentRuntimeGeneration() === generation;
    const preview = createTemporalPreviewController();
    // The Track starts empty because nothing is disclosed yet. An empty Track is a legitimate T-05
    // value and says only that no Moment has been disclosed to this reader — it is not a claim that
    // the Session has none, and no surface reads it as one.
    const presentation = createPresentationController(disclosedTrack(bundle.sessionId, []));

    const projection = createProjectionCoordinator({
      sessionId: bundle.sessionId,
      cache: bundle.projection,
      authGeneration: bundle.authGeneration,
      credential: () => {
        const state = entry.auth.getState();
        return state.kind === 'AUTHENTICATED' ? { accessToken: state.accessToken, authGeneration: state.authGeneration } : null;
      },
      // Built per request, never held: the config carries the token it was constructed with and has
      // no setter, so a held client would go on presenting a token a refresh has already replaced.
      createProjectionClient: (accessToken) =>
        new HistoricalProjectionApiClient({
          baseUrl: entry.config.apiBaseUrl,
          accessToken,
          fetch: options.httpFetch ?? ((input, init) => fetch(input, init as RequestInit) as never),
        }),
      isCurrent,
    });

    // T-13: the durable snapshot advances from the ONE store, for THIS identity and THIS Session, and
    // continues strictly above the sequence the resumed record carried. Retired with the generation.
    const writer = attachRecoveryWriter({
      store: bundle.store,
      recovery,
      ownerUserId: bundle.userId,
      sessionId: bundle.sessionId,
      isCurrent,
      startSequence: decision.kind === 'RESUME' ? decision.record.sequence : 0,
    });

    return {
      generation,
      bundle,
      store: bundle.store,
      projection,
      journey: createInspectionJourneyCoordinator(generation),
      spatialCause: createSpatialCauseBinding(generation),
      witness: createCanonicalTransitionWitness(bundle.store),
      preview,
      presentation,
      returnSurface: { store: bundle.store, preview },
      liveDriver: entry.liveDriverFor(bundle),
      recovery: { origin: decision.kind === 'RESUME' ? 'RESUMED' : 'FRESH', writer },
    };
  }

  async function bootstrapFor(authGeneration: number, userId: string): Promise<void> {
    attemptedAuthGeneration = authGeneration;

    // T-13 — the identity's own record, loaded and validated BEFORE any Session is acquired or resumed.
    publish({ kind: 'RECOVERING' });
    const loaded = await recovery.load(userId);
    if (disposed) return;
    if (entry.auth.getState().kind === 'AUTHENTICATED' && attemptedAuthGeneration !== authGeneration) return;
    const decision = decideRecovery(userId, loaded);
    if (decision.kind === 'REFUSED') {
      // Fail closed: no replacement Session, no store, and a controlled state the shell can name.
      if (attemptedAuthGeneration === authGeneration) publish({ kind: 'RECOVERY_FAILED', failure: decision.refusal });
      return;
    }

    publish({ kind: 'BOOTSTRAPPING' });
    const result = await bootstrapWithAuthorities(entry, decision);
    if (disposed) return;
    // A result that arrived after its identity was replaced creates nothing and publishes nothing:
    // the newer identity's own attempt owns the phase.
    if (entry.auth.getState().kind === 'AUTHENTICATED' && attemptedAuthGeneration !== authGeneration) return;
    if (result.kind !== 'READY') {
      if (attemptedAuthGeneration !== authGeneration) return;
      // A resumed Session the server refused, or a recovered viewpoint the snapshot made impossible,
      // is a recovery failure: the record was not usable, and no fresh Session is minted in its place.
      if (decision.kind === 'RESUME') publish({ kind: 'RECOVERY_FAILED', failure: { kind: 'SESSION_INVALID', failure: result.failure } });
      else publish({ kind: 'BOOTSTRAP_FAILED', failure: result.failure });
      return;
    }
    retireSession();
    session = buildSession(result.bundle, decision);
    session.liveDriver.start();
    publish({ kind: 'READY', runtime: session });
  }

  const unsubscribeAuth = entry.auth.subscribe((state: MobileAuthState) => {
    if (disposed) return;
    if (state.kind === 'AUTHENTICATED') {
      // A token refresh keeps the auth generation, so it must change nothing here either.
      if (attemptedAuthGeneration === state.authGeneration) return;
      retireSession();
      void bootstrapFor(state.authGeneration, state.userId);
      return;
    }
    attemptedAuthGeneration = null;
    retireSession();
    publish(state.kind === 'SIGNED_OUT' ? { kind: 'SIGNED_OUT' } : state.kind === 'ERROR' ? { kind: 'AUTH_ERROR' } : { kind: 'RESTORING' });
  });

  return {
    ok: true,
    runtime: {
      config: entry.config,
      auth: entry.auth,
      getPhase: () => phase,
      subscribe(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      async start() {
        // A disposed runtime stays disposed. Without this a remount — React Strict Mode's
        // mount/unmount/mount in development, or any host that re-runs an effect — would call
        // `start()` on an authority that has already been torn down, and the failure would look like
        // a bug in the auth layer rather than in the lifecycle above it.
        if (disposed) return;
        await entry.start();
        if (disposed) return;
        const state = entry.auth.getState();
        if (state.kind === 'AUTHENTICATED' && attemptedAuthGeneration !== state.authGeneration) {
          await bootstrapFor(state.authGeneration, state.userId);
        }
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        unsubscribeAuth();
        retireSession();
        entry.dispose();
        listeners.clear();
      },
    },
  };
}
