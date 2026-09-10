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
 * Every surface below is the real frozen owner. `MapSurface` is T-04's, the temporal layer is T-06's
 * over T-05's own presentation controller, the chrome is T-08's. There is no duplicate, no test-only
 * stand-in and no second implementation of any of them anywhere in this tree.
 *
 * ## Truth convergence
 *
 * The Map, the Timeline, the chrome and the accessibility tree all answer from ONE store, ONE
 * projection cache and ONE viewpoint tuple — `(Session, effective TC, depth, inspection, projection
 * revision)` — because each of them is derived from the same `state` and the same `entry` in the same
 * render pass. There is no path by which the Map paints one `TC` while the chrome names another: they
 * are not synchronized, they are the same read.
 *
 * ## Nothing here animates
 *
 * Motion is T-10's, entirely. This composition adds no transition, no entrance, no stagger, no
 * layout animation and no press choreography of its own: the world's travel belongs to the
 * presentation camera and arrival belongs to the disclosure registry, both already frozen. The one
 * motion fact this layer contributes is the composite spatial CAUSE — which is not new motion at all,
 * only the evidence that lets T-10's existing plan hold its already-frozen beat.
 */

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { MapSurface, mapInspectionContext, mapProjectionRequest, viewportEnvelope, type MapActionOutcome } from '../../map';
import { OrientationChrome, chromeProjection } from '../../orientation-chrome';
import { returnMapContext } from '../../return-navigation';
import {
  ResponsiveChromeBand,
  ResponsiveMapFrame,
  ResponsiveSupportBand,
  ResponsiveSurface,
  ResponsiveTimelineRow,
  type ResponsiveInsets,
} from '../../responsive';
import { TemporalTargetLayer } from '../../temporal-navigation';
import type { IntegrationSessionRuntime } from '../runtime/integration-runtime';
import type { ProductLocale } from '../locale/product-locale';
import { TIMELINE_TRACK_DEPTH, trackFromDisclosure } from '../timeline/disclosed-track-source';

export interface LivingAnalysisMapProps {
  readonly runtime: IntegrationSessionRuntime;
  readonly locale: ProductLocale;
  readonly insets: ResponsiveInsets;
  readonly fontScale: number;
}

export function LivingAnalysisMap({ runtime, locale, insets, fontScale }: LivingAnalysisMapProps) {
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
  useEffect(() => {
    if (request !== null) void projection.ensure(request);
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
   * The one question the Map asks of the composite binding, at the exact instant it travels.
   *
   * It is asked with the destination the Map is actually travelling to, and asking consumes the
   * binding whatever the answer — so an unrelated camera act retires it instead of borrowing it.
   */
  const takeSpatialCause = useCallback(
    (destination: Parameters<typeof spatialCause.take>[1]) => spatialCause.take(store, destination),
    [spatialCause, store],
  );

  return (
    // T-11's own surface identity is kept: the responsive container belongs to that owner, and
    // overriding its test id would make the composition unrecognizable to the owner's own tooling.
    // The integration root's stable identity is PRODUCT_ROOT_TEST_ID, one level up.
    <ResponsiveSurface insets={insets} fontScale={fontScale}>
      {(plan) => (
        <>
          <ResponsiveMapFrame frame={plan.mapFrame}>
            {(rect) => {
              const envelope = viewportEnvelope(rect.width, rect.height, {
                top: rect.insetTop,
                right: rect.insetRight,
                bottom: rect.insetBottom,
                left: rect.insetLeft,
              });
              // A surface that cannot be composed renders nothing rather than a guess. T-11 refuses
              // the same rects T-04's validator refuses, so this is null only when there is no rect.
              if (envelope === null || mapContext === null || !mapContext.ok) return null;
              return (
                <MapSurface
                  store={store}
                  context={mapContext.context}
                  envelope={envelope}
                  spatialCause={takeSpatialCause}
                  onOutcome={observeMapOutcome}
                />
              );
            }}
          </ResponsiveMapFrame>

          {/*
            The two support regions share ONE band, and it is mounted unconditionally so that a
            measurement threshold changes a style and never an element type — a remount here would
            clear local state that a resize must not touch. Which way they sit inside it is the
            plan's decision, never this composition's.
          */}
          <ResponsiveSupportBand support={plan.support}>
            <ResponsiveTimelineRow
              widthPoints={plan.timelineWidthPoints}
              paddingHorizontal={plan.chrome.paddingHorizontal}
              support={plan.support}
            >
              <TemporalTargetLayer store={store} preview={preview} presentation={presentation} />
            </ResponsiveTimelineRow>

            <ResponsiveChromeBand chrome={plan.chrome} support={plan.support}>
              {chrome === null ? null : (
                <OrientationChrome
                  surface={returnSurface}
                  language={locale.language}
                  projection={chrome}
                  exactReturnOrigin={journey.origin()}
                  preview={preview}
                  liveContext={liveContext}
                  onMapOutcome={observeMapOutcome}
                  onReturnOutcome={observeReturnOutcome}
                  bottomInset={plan.chrome.bottomInset}
                  returnArrangement={plan.chrome.arrangement}
                />
              )}
            </ResponsiveChromeBand>
          </ResponsiveSupportBand>
        </>
      )}
    </ResponsiveSurface>
  );
}
