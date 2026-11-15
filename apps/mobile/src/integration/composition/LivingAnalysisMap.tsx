/**
 * T-12 §11 / §18 — the integrated Product composition.
 *
 * > **One world. One truth. One composition.**
 *
 * One column at every width: the world, the disclosed temporal track beneath it, the orientation and
 * return chrome beneath that. There is no second arrangement to switch into — no sidebar, no
 * inspector panel, no dashboard column, no "desktop layout". A larger window shows more of the SAME
 * world and gives the same words more air, which is T-11's frozen decision and not a choice remade
 * here.
 *
 * Every surface below is the real frozen owner. The temporal layer is T-06's over T-05's own presentation controller,
 * the chrome is T-08's, the accessible Map is T-04's. There is no duplicate, no test-only stand-in and no second
 * implementation of any of them anywhere in this tree.
 *
 * ## Truth convergence
 *
 * The Map, the Timeline, the chrome and the accessibility tree all answer from ONE store, ONE
 * projection cache and ONE viewpoint tuple — `(Session, effective TC, depth, inspection, projection
 * revision)` — because each of them is derived from the same `state` and the same `entry` in the same
 * render pass. There is no path by which the Map paints one `TC` while the chrome names another: they
 * are not synchronized, they are the same read.
 *
 * ## Motion
 *
 * This composition adds no transition, no entrance, no stagger, no layout animation and no press choreography of its
 * own. The one motion fact this layer contributes is the composite spatial CAUSE — the evidence of a composite act,
 * bound to its destination and consumed by the next camera transition.
 *
 * ## S5-03B R1 — the Personal world on the ONE Living Analysis surface
 *
 * The screen itself — the Analysis place, the top band, T-11's responsive column, the measured world frame and the one
 * support band — is `LivingAnalysisSurface`'s, so every world is analysed on the same screen. This file is the
 * Personal world's use of it, and everything it ever owned stays here: the store and the one projection cache, the
 * Timeline (T-05 / T-06) with its temporal orientation line, the chrome (T-08) with Return and Live, the journey and
 * the composite spatial cause.
 *
 * ## COSMOS-INT-01 Slice B — the Personal world as the COSMOS stage (Product Owner, 2026-11-15)
 *
 * The world is now drawn by the COSMOS stage (`cosmos/product`) in the surface's STAGE presentation (D-2): one
 * full-surface cosmic stage under the same top band, the same Timeline and the same T-08 chrome. Its owner
 * (`createPersonalCosmosOwner`) attaches to THIS runtime and dispatches exactly the acts `MapSurface` dispatched for the
 * same gestures — `PAN`, `ZOOM_SEMANTIC` with its focal (CA-Z1), `INSPECT_OBJECT` through T-04's entitlement — and every
 * outcome still passes through `observeMapOutcome`, so the journey sees the same step. T-04's accessible Map
 * (`MapAccessibilityLayer`: inspect, switch context, direct jump, the viewport routes) is laid over the stage, through
 * the same glass, so no accessible route the old Map offered is lost. The motion is COSMOS's (D-5): the composite
 * spatial cause is still asked, with the destination, at each canonical camera change — consumed, not played.
 * `MapSurface` itself is unchanged and still the Replay composite's renderer (G-5, REPLAY-COSMOS-01).
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

import { analysisCopy } from '../../analysis-language';
import { CosmosWorldView, createPersonalCosmosOwner, type CosmosWorldOwner } from '../../cosmos/product';
import { LivingAnalysisSurface, type LivingAnalysisTopBand } from '../../living-analysis';
import { MapAccessibilityLayer, decodeCameraIntent, mapInspectionContext, mapProjectionRequest, useSteadyEnvelope, type MapActionOutcome, type MapInspectionContext, type ViewportEnvelope } from '../../map';
import { OrientationChrome, TemporalOrientationLine, chromeProjection } from '../../orientation-chrome';
import { returnMapContext } from '../../return-navigation';
import type { ResponsiveInsets } from '../../responsive';
import type { CanonicalStore } from '../../state';
import { TemporalTargetLayer } from '../../temporal-navigation';
import type { IntegrationSessionRuntime } from '../runtime/integration-runtime';
import type { ProductLocale } from '../locale/product-locale';
import { TIMELINE_TRACK_DEPTH, trackFromDisclosure } from '../timeline/disclosed-track-source';

export interface LivingAnalysisMapProps {
  readonly runtime: IntegrationSessionRuntime;
  readonly locale: ProductLocale;
  readonly insets: ResponsiveInsets;
  readonly fontScale: number;
  /** The envelope this composition is presented inside; T-11 uses it to retire a stale measurement. */
  readonly envelope: { readonly width: number; readonly height: number };
  /**
   * W1A-01: called after the first commit in which this composition shows its REAL first state: the
   * Map itself composed, or — when the projection is settled and cannot be drawn (refused, or no
   * scene) — the measured composition whose chrome says so. Never while the room is unmeasured or the
   * projection is still being fetched: the depth boundary waits for THIS to fade the world in, and a
   * fade into an unrendered surface is exactly the cut it exists to prevent.
   */
  readonly onComposed?: () => void;
  /** S5-03B R1 — the Analysis top band (the way back to the Conversation), drawn by the surface above the world. */
  readonly top?: LivingAnalysisTopBand | null;
  /** COSMOS-INT-01: the stage's slow drift at rest is paused while a live call shares this surface (the call path is protected). */
  readonly driftPaused?: boolean;
}

/** Reports its own first commit. It renders nothing; it only marks where the Map was composed. */
function ComposedMark({ onComposed }: { readonly onComposed: () => void }) {
  useEffect(() => {
    onComposed();
  }, [onComposed]);
  return null;
}

export function LivingAnalysisMap({ runtime, locale, insets, fontScale, envelope: surfaceEnvelope, onComposed, top = null, driftPaused = false }: LivingAnalysisMapProps) {
  const { store, projection, journey, spatialCause, witness, preview, presentation, returnSurface, bundle } = runtime;

  // The two subscriptions this composition reads from, and there are only two: the canonical store,
  // and the moments the one projection cache's contents changed. Everything else below is derived.
  const state = useSyncExternalStore(store.subscribe, store.getState);
  useSyncExternalStore(projection.subscribe, projection.revision);

  /** The viewpoint the Map is entitled to ask for, from canonical state alone. */
  const request = useMemo(() => mapProjectionRequest(state), [state]);
  /** The same Session and the same effective TC, at the rung the disclosed Moments live on. */
  const trackRequest = useMemo(
    () => (request === null ? null : { sessionId: request.sessionId, tc: request.tc, depth: TIMELINE_TRACK_DEPTH }),
    [request],
  );

  // Fetching is an effect, never a render: a request issued during render would run again on every
  // pass React discards. `ensure` is idempotent per key, so a re-render with an unchanged viewpoint
  // issues nothing at all and a render loop cannot become a fetch loop.
  //
  // QAN-BL-MOB-05: a fetch that ENDED without an answer (a failed read, a payload refused at the trust boundary, no
  // credential) leaves its key NOT_FETCHED, retryable and truthful, but it is not still being fetched. It is remembered
  // here, for that exact viewpoint, so the composition below can tell "settled with nothing to draw" from "on its way".
  const [unanswered, setUnanswered] = useState<{ readonly sessionId: string; readonly tc: number; readonly depth: string } | null>(null);
  useEffect(() => {
    if (request === null) return;
    void projection.ensure(request).then((outcome) => {
      if (outcome === 'NOT_FETCHED' || outcome === 'NOT_AUTHENTICATED' || outcome === 'IDENTITY_MISMATCH') {
        setUnanswered({ sessionId: request.sessionId, tc: request.tc, depth: request.depth });
      }
    });
  }, [projection, request]);
  useEffect(() => {
    if (trackRequest !== null) void projection.ensure(trackRequest);
  }, [projection, trackRequest]);

  const entry = request === null ? null : bundle.projection.lookup(request.sessionId, request.tc, request.depth);
  const trackEntry = trackRequest === null ? null : bundle.projection.lookup(trackRequest.sessionId, trackRequest.tc, trackRequest.depth);

  // T-05 owns the Track and this hands it one. `replaceDisclosed` preserves geometry within a Session
  // and resets it across one, which is T-05's rule; a null derivation leaves the Track standing,
  // because "not disclosed to us" is not "no Moments exist".
  const track = useMemo(() => (trackEntry === null ? null : trackFromDisclosure(trackEntry)), [trackEntry]);
  const lastTrack = useRef<typeof track>(null);
  useEffect(() => {
    if (track === null || track === lastTrack.current) return;
    lastTrack.current = track;
    presentation.replaceDisclosed(track);
  }, [presentation, track]);

  /** T-04's own context derivation. There is no second one, and none is invented when it refuses. */
  const mapContext = useMemo(
    () => (entry === null || request === null ? null : mapInspectionContext(entry, request)),
    [entry, request],
  );
  /** T-08's own projection state, carrying T-04's derivation so a refusal keeps its typed reason. */
  const chrome = useMemo(
    () => (entry === null || request === null ? null : chromeProjection(entry, request)),
    [entry, request],
  );

  /**
   * The LIVE viewpoint's disclosure, for the composite act's spatial half.
   *
   * Read from the same one cache at the moment T-07 asks, so a projection this reader does not hold
   * is a technical refusal rather than a fabricated "there is nowhere to go". Its PRESENCE is what
   * makes Go Live + Locate offerable; it promises no landing.
   */
  const liveContext = useCallback(
    (liveRequest: Parameters<typeof returnMapContext>[1]) =>
      returnMapContext(bundle.projection.lookup(liveRequest.sessionId, liveRequest.tc, liveRequest.depth), liveRequest),
    [bundle.projection],
  );

  /**
   * Every completed act passes through here, and the two inherited bindings read the SAME step.
   *
   * `QAN-BL-T12-01`: a journey begins where an act established an inspection that did not exist, and
   * the checkpoint it appended is the viewpoint it began from. `QAN-BL-MOT-02`: a composite that
   * actually moved the camera arms its cause, bound to the exact destination it produced.
   */
  const observeMapOutcome = useCallback(
    (outcome: MapActionOutcome | { readonly outcome: string }) => {
      if ((outcome as MapActionOutcome).outcome !== 'APPLIED') return;
      journey.observeAct(store, witness.before(), witness.after(), (outcome as { entry?: unknown }).entry as never);
    },
    [journey, store, witness],
  );

  const observeReturnOutcome = useCallback(
    (id: string, outcome: { readonly outcome: string; readonly entry?: unknown }) => {
      if (outcome.outcome !== 'APPLIED') {
        // A refused or no-op act still ends a journey if the reader is no longer inspecting.
        journey.observeState(store, store.getState());
        return;
      }
      if (id === 'GO_LIVE_AND_LOCATE') spatialCause.arm(store, witness.before(), witness.after());
      // The act's OWN appended entry is passed, not `null`. No return act can be an inspection
      // origin — T-07's journey-capable set is `INSPECT_OBJECT` and `DIRECT_JUMP` — so handing the
      // real entry lets the owner REFUSE it, where passing null would pre-empt the question here and
      // make this composition the thing that decides. The owner deciding is the point.
      journey.observeAct(store, witness.before(), witness.after(), (outcome.entry ?? null) as never);
    },
    [journey, spatialCause, store, witness],
  );

  /**
   * The one question the Map asks of the composite binding, at the exact instant the canonical camera moves.
   *
   * It is asked with the destination the camera is actually moving to, and asking consumes the binding whatever the
   * answer — so an unrelated camera act retires it instead of borrowing it. Under COSMOS (D-5) the answer steers no
   * motion; the asking is what keeps the binding's lifecycle exactly as it was.
   */
  const takeSpatialCause = useCallback(
    (destination: Parameters<typeof spatialCause.take>[1]) => spatialCause.take(store, destination),
    [spatialCause, store],
  );

  // COSMOS-INT-01: ONE owner per (runtime, language) — the seam between the stage and THIS runtime. It is created with
  // the composition and retired with it; a replaced runtime is a new owner, never a re-aimed one.
  const [owner, setOwner] = useState(() => ({
    runtime, language: locale.language,
    it: createPersonalCosmosOwner({ runtime, language: locale.language, onOutcome: observeMapOutcome, spatialCause: takeSpatialCause }),
  }));
  if (owner.runtime !== runtime || owner.language !== locale.language) {
    setOwner({ runtime, language: locale.language, it: createPersonalCosmosOwner({ runtime, language: locale.language, onOutcome: observeMapOutcome, spatialCause: takeSpatialCause }) });
  }
  useEffect(() => () => owner.it.dispose(), [owner]);

  /**
   * The projection is SETTLED and still cannot be drawn: there is no viewpoint, it was refused, or it
   * holds no scene. The measured composition — whose chrome states exactly that — is then this
   * surface's real first state. A projection still being fetched is not settled; one whose fetch ended without an
   * answer is (QAN-BL-MOB-05): waiting for it would hold the depth boundary half-crossed for as long as the app runs.
   */
  const fetchEndedUnanswered =
    request !== null && entry?.status === 'NOT_FETCHED' && unanswered !== null
    && unanswered.sessionId === request.sessionId && unanswered.tc === request.tc && unanswered.depth === request.depth;
  const settledWithoutMap =
    request === null || fetchEndedUnanswered || (entry !== null && entry.status !== 'NOT_FETCHED' && (mapContext === null || !mapContext.ok));

  return (
    // The ONE Living Analysis surface, with the Personal world's projection and capabilities: the COSMOS stage under the
    // composition, the disclosed Timeline with its orientation line, and the T-08 chrome with Return and Live.
    <LivingAnalysisSurface
      insets={insets}
      fontScale={fontScale}
      envelope={surfaceEnvelope}
      top={top}
      stage={(glass) => (
        <PersonalStage
          owner={owner.it}
          glass={glass}
          store={store}
          // The accessible Map is offered only from T-04's own context; none is invented when it refuses.
          context={mapContext !== null && mapContext.ok ? mapContext.context : null}
          language={locale.language}
          driftPaused={driftPaused}
          onOutcome={observeMapOutcome}
          // The stage is composed: the Map's real first state, when T-04's context exists to draw from.
          composed={onComposed !== undefined && mapContext !== null && mapContext.ok ? <ComposedMark onComposed={onComposed} /> : null}
        />
      )}
      timeline={{
        line: <TemporalOrientationLine store={store} language={locale.language} preview={preview} />,
        layer: <TemporalTargetLayer store={store} preview={preview} presentation={presentation} language={locale.language} />,
      }}
      chrome={(composition) =>
        chrome === null ? null : (
          <OrientationChrome
            surface={returnSurface}
            language={locale.language}
            projection={chrome}
            exactReturnOrigin={journey.origin()}
            preview={preview}
            liveContext={liveContext}
            onMapOutcome={observeMapOutcome}
            onReturnOutcome={observeReturnOutcome}
            bottomInset={composition.bottomInset}
            returnArrangement={composition.arrangement}
            // VPORT-02: the frozen production composition — the temporal line is said once, beside the Timeline;
            // Return Live has one home, the Timeline's Live edge (G3 amendment §2; P2 §7).
            temporalLine="WITH_TIMELINE"
            returnLiveHome="LIVE_EDGE"
          />
        )
      }
      after={onComposed !== undefined && settledWithoutMap ? <ComposedMark onComposed={onComposed} /> : null}
    />
  );
}

/**
 * The Personal stage: the COSMOS world view over the owner, in the glass steadied by CA-O1, with T-04's accessible Map
 * laid over it through the same glass (the stage's own marks stand down: one object is never two nodes).
 */
function PersonalStage({ owner, glass, store, context, language, driftPaused, onOutcome, composed }: {
  readonly owner: CosmosWorldOwner; readonly glass: ViewportEnvelope; readonly store: CanonicalStore;
  readonly context: MapInspectionContext | null; readonly language: ProductLocale['language']; readonly driftPaused: boolean;
  readonly onOutcome: (outcome: MapActionOutcome | { readonly outcome: string }) => void; readonly composed: ReactNode;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const decoded = useMemo(() => decodeCameraIntent(state.camera), [state.camera]);
  const camera = decoded.ok ? decoded.camera : null;
  // MAP-CLOSE-01 CA-O1: once the reader has acted, the world stays where it is when only the band below it changes.
  const steady = useSteadyEnvelope(glass, camera);
  const copy = analysisCopy(language);
  return (
    <CosmosWorldView owner={owner} world="PERSONAL" language={language} glass={steady} drift={!driftPaused}
      worldLabel={copy.map} zoomInLabel={copy.moreDetail} zoomOutLabel={copy.lessDetail} accessibleMarks={false}>
      {context === null || camera === null ? null : (
        <MapAccessibilityLayer store={store} context={context} camera={camera} envelope={steady} onOutcome={onOutcome} language={language} />
      )}
      {composed}
    </CosmosWorldView>
  );
}
