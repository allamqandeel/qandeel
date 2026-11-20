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
 *
 * ## COSMOS-INT-01 Slice C — the approved COSMOS chrome, timeline and navigation (Product Owner, 2026-11-15; Contract v1.3 §14, §15)
 *
 * The screen is the accepted COSMOS experience: the stage fills everything under the top band, and the Personal
 * timeline is the approved bottom rail (`CosmosTimelineRail`) over the SAME T-05 presentation controller, T-06 preview
 * controller and T-06 commit boundary, with the T-08 temporal orientation line directly above it and the T-05 / T-06
 * navigators headless beside it. The old timeline row and the old chrome band are no longer brought to the surface —
 * the composition brings no `timeline` and a chrome that measures nothing, so under the surface's own CHROME_ONLY rule
 * the band is the bottom safe area and nothing else (C-6) — and the T-07 return acts and T-04's context choice the band
 * presented as text blocks are the compact contextual chips (`CosmosContextualActs`), reached through the same
 * executors and the same observers. The Product Owner's UX correction (v1.4 §16) places them: the historical and
 * Live-focus acts in one line at the start of the rail's words row; Return to World as the one companion chip under
 * Overview at a deeper rung; and at the first rung the stage's Back chip IS the canonical Return to World (`home`).
 * The T-08 temporal sentence is no longer drawn: the rail's compact Moment label carries it to assistive technology.
 * No function is lost; no sentence is invented; nothing of T-05 / T-06 / T-07 / T-08 is edited.
 *
 * ## COSMOS-INT-01 Slice D CP3 — the Personal Detail Sheet (Product Owner, 2026-11-17; Contract v1.7 §19.16)
 *
 * An inspection opens CP1's ONE Detail Sheet in PEEK, in the stage, after the world view — PEEK only, never EXPANDED
 * (G-7). The PEEK holds only what already existed: the inspected object's family word, T-08's inspection statement and
 * lineage (its own sentences), T-04's context choice (its ONE home: the rail no longer draws it, SD-4) and T-04's
 * "Go to this place" (the same `directJump`, offered exactly where the accessible Map offers it: one locus). While it is
 * open it covers the rail, which stays mounted and keeps its state, inert beneath it; closing it reveals the rail
 * unchanged. Dismissal is presentation only (D-12): no act, no camera, no inspection and no history is written, and
 * nothing is read. A tap on the inspected object shows it again (SD-12). The Analysis's ONE hardware Back handler
 * (`DepthComposition`) asks it first (`registerSheetBack`, SD-5). Conversation and Replay stay in the top band.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';

import { analysisCopy } from '../../analysis-language';
import {
  COSMOS_OVERVIEW_ACT_TEST_ID, COSMOS_PEEK_PLACEHOLDER_INK, CosmosContextualActs, CosmosDetailSheet, CosmosPeekWords, CosmosSheetStage, CosmosTimelineRail, CosmosWorldView, RAIL_ACTS, SHEET_HANDLE_HEIGHT, SHEET_PEEK_MAX, createPersonalCosmosOwner, cosmosPeekChipStyles,
  createCurrentPersonalCosmosOwner, reopeningOwner, useDetailSheet, type CosmosWorldOwner, type SheetContent,
} from '../../cosmos/product';
import { LivingAnalysisSurface, type LivingAnalysisTopBand } from '../../living-analysis';
import {
  MapAccessibilityLayer, decodeCameraIntent, decodeInspectionRef, directJump, mapContextFreshness, mapInspectionContext, mapProjectionRequest, useSteadyEnvelope,
  type MapActionOutcome, type MapInspectionContext, type ViewportEnvelope,
} from '../../map';
import { chromeProjection, contextPathSentence, inspectionSentence, orientationModel, type ChromeProjection } from '../../orientation-chrome';
import { returnMapContext, returnWorld } from '../../return-navigation';
import type { ResponsiveInsets } from '../../responsive';
import { sessionPosition, type CanonicalStore } from '../../state';
import type { ConversationSwitchOutcome, CurrentPersonalWorldController } from '../../conversation';
import type { ProjectionCoordinator } from '../projection/projection-coordinator';
import { heldContextEntry, inspectionRequestOf } from '../projection/projection-coordinator';
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
  /** COSMOS E-2 Slice A: append the person's own name for a Personal topic (true when the server kept it). */
  readonly onAlias?: (threadId: string, alias: string) => Promise<boolean>;
  /** COSMOS E-2 Slice A: open another conversation of the person's at the moment a topic began. */
  readonly onOpenSource?: (sessionId: string, sp: number) => Promise<ConversationSwitchOutcome>;
  /** S5-03B R1 — the Analysis top band (the way back to the Conversation), drawn by the surface above the world. */
  readonly top?: LivingAnalysisTopBand | null;
  /** COSMOS-INT-01: the stage's slow drift at rest is paused while a live call shares this surface (the call path is protected). */
  readonly driftPaused?: boolean;
  /**
   * Slice D CP3 (§19.6, SD-5): the Personal sheet's step of the Analysis's ONE hardware Back handler — handed to the host
   * while this composition is mounted (`null` when it leaves). It answers `true` when it dismissed the PEEK (presentation
   * only); the host then runs its own order, unchanged. No listener is registered here.
   */
  readonly registerSheetBack?: (back: (() => boolean) | null) => void;
}

/** Slice D CP3: the Personal PEEK's content and its parts. */
export const PERSONAL_PEEK_TEST_ID = 'qandeel-personal-peek';
export const PERSONAL_PEEK_FAMILY_TEST_ID = `${PERSONAL_PEEK_TEST_ID}:family`;
export const PERSONAL_PEEK_STATEMENT_TEST_ID = `${PERSONAL_PEEK_TEST_ID}:statement`;
export const PERSONAL_PEEK_LINEAGE_TEST_ID = `${PERSONAL_PEEK_TEST_ID}:lineage`;
export const PERSONAL_PEEK_CHOICE_TEST_ID = `${PERSONAL_PEEK_TEST_ID}:choice`;
export const PERSONAL_PEEK_GO_TEST_ID = `${PERSONAL_PEEK_TEST_ID}:go`;
/** COSMOS E-2 Slice C (D-5, Option U): the Personal map's mode chips and the CURRENT world's PEEK. */
export const PERSONAL_WORLD_MODE_TEST_ID = 'qandeel-personal-world-mode';
export const PERSONAL_WORLD_MODE_SESSION_TEST_ID = `${PERSONAL_WORLD_MODE_TEST_ID}:session`;
export const PERSONAL_WORLD_MODE_CURRENT_TEST_ID = `${PERSONAL_WORLD_MODE_TEST_ID}:current`;
export const PERSONAL_WORLD_MODE_NOTE_TEST_ID = `${PERSONAL_WORLD_MODE_TEST_ID}:note`;
export const PERSONAL_CURRENT_PEEK_TEST_ID = 'qandeel-personal-current-peek';
export type PersonalWorldMode = 'SESSION' | 'CURRENT';
/** The rail's holder: the rail stays mounted in it, and is inert and hidden beneath an open PEEK. */
export const PERSONAL_RAIL_HOLDER_TEST_ID = 'qandeel-personal-rail-holder';
/** Where the host lays the rail: `bottom = inset + 12` (CosmosWorldView's `railWrap`). The PEEK reaches at least its top. */
const RAIL_BOTTOM_GAP = 12;

/** Reports its own first commit. It renders nothing; it only marks where the Map was composed. */
function ComposedMark({ onComposed }: { readonly onComposed: () => void }) {
  useEffect(() => {
    onComposed();
  }, [onComposed]);
  return null;
}

export function LivingAnalysisMap({ runtime, locale, insets, fontScale, envelope: surfaceEnvelope, onComposed, top = null, driftPaused = false, registerSheetBack, onAlias, onOpenSource }: LivingAnalysisMapProps) {
  const { store, projection, journey, spatialCause, witness, preview, presentation, returnSurface, bundle, currentWorld } = runtime;

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

  /**
   * COSMOS-FINAL-01 F-1 — the same viewpoint, asked about the inspection the reader holds (`IF_ref`, decoded from the
   * canonical state alone): `V = Disclose(K(TC), depth, inspection)`. Nothing more is asked while nothing is inspected.
   * Same coordinator, same one cache (its own key), same idempotence: an unchanged inspection issues nothing.
   */
  const inspectedRequest = useMemo(() => {
    const inspection = request === null ? null : inspectionRequestOf(state.inspection);
    return request === null || inspection === null ? null : { ...request, inspection };
  }, [request, state.inspection]);
  useEffect(() => {
    if (inspectedRequest !== null) void projection.ensure(inspectedRequest);
  }, [projection, inspectedRequest]);

  const entry = request === null ? null : bundle.projection.lookup(request.sessionId, request.tc, request.depth);
  /**
   * What T-04's context and T-08's chrome read (`heldContextEntry`, the one rule): the inspected V once it is held for
   * the inspection held NOW, otherwise the plain V. Until it arrives, the plain V's missing answer is what T-08 already
   * calls a technical gap (INSPECTION_NOT_RESOLVED), never a claim about the target.
   */
  const contextEntry = request === null ? null : heldContextEntry(bundle.projection, request, inspectedRequest?.inspection ?? null);
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
    () => (contextEntry === null || request === null ? null : mapInspectionContext(contextEntry, request)),
    [contextEntry, request],
  );
  /** T-08's own projection state, carrying T-04's derivation so a refusal keeps its typed reason. */
  const chrome = useMemo(
    () => (contextEntry === null || request === null ? null : chromeProjection(contextEntry, request)),
    [contextEntry, request],
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
   * COSMOS E-2 Slice C (the Product Owner's D-5, Option U): the Personal map's two modes. SESSION is everything above —
   * this conversation's Session-bound world under the frozen temporal authority. CURRENT is the person's world of all
   * their topics NOW (migration 0199), a separate owner over a separate read: it moves no Session camera, commits no
   * moment and carries no timeline. The map opens in SESSION; the mode is this composition's alone (never persisted).
   */
  const [mode, setMode] = useState<PersonalWorldMode>('SESSION');
  const [focusedCurrent, setFocusedCurrent] = useState<string | null>(null);
  const [currentOwner, setCurrentOwner] = useState(() => ({
    runtime, language: locale.language,
    it: createCurrentPersonalCosmosOwner({ world: currentWorld, language: locale.language, onFocus: setFocusedCurrent }),
  }));
  if (currentOwner.runtime !== runtime || currentOwner.language !== locale.language) {
    setCurrentOwner({ runtime, language: locale.language, it: createCurrentPersonalCosmosOwner({ world: currentWorld, language: locale.language, onFocus: setFocusedCurrent }) });
  }
  useEffect(() => () => currentOwner.it.dispose(), [currentOwner]);
  // The current world is read when the person asks for it (and again each time they come back to it), never at launch.
  useEffect(() => { if (mode === 'CURRENT') currentWorld.refresh(); }, [currentWorld, mode]);
  const modeChips = <WorldModeChips mode={mode} language={locale.language} onMode={setMode} />;
  const toSession = useCallback(() => setMode('SESSION'), []);
  /** "Open where it began" from the CURRENT world: this conversation's moment is committed and the Session mode shows it. */
  const commitHere = useCallback((sp: number) => {
    const outcome = store.dispatch({ type: 'COMMIT_MOMENT', moment: sessionPosition(sp) });
    observeMapOutcome({ outcome: outcome.outcome });
    if (outcome.outcome === 'APPLIED') setMode('SESSION');
  }, [observeMapOutcome, store]);

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

  /** Slice C, D-3: the stage's Back chip at the first rung is T-07's canonical Return to World, observed like every return act. */
  const home = useCallback(() => {
    observeReturnOutcome('RETURN_WORLD', returnWorld(returnSurface));
  }, [observeReturnOutcome, returnSurface]);

  return (
    // The ONE Living Analysis surface, with the Personal world's projection and capabilities: the COSMOS stage under the
    // top band, with the approved rail (the disclosed Timeline, the orientation line above it, the Live edge) and the
    // compact contextual controls (the T-07 return acts, the context choice) in the stage's own chrome. The composition
    // brings no timeline row and no chrome band: the stage occupies the reclaimed area (Contract v1.3 §14 C-6).
    <LivingAnalysisSurface
      insets={insets}
      fontScale={fontScale}
      envelope={surfaceEnvelope}
      top={top}
      stage={(glass) => mode === 'CURRENT' ? (
        <CurrentStage
          owner={currentOwner.it}
          world={currentWorld}
          glass={glass}
          language={locale.language}
          driftPaused={driftPaused}
          chips={modeChips}
          home={toSession}
          focused={focusedCurrent}
          currentSessionId={bundle.sessionId}
          registerSheetBack={registerSheetBack}
          onAlias={onAlias}
          onOpenSource={onOpenSource}
          onCommitHere={commitHere}
        />
      ) : (
        <PersonalStage
          owner={owner.it}
          glass={glass}
          store={store}
          projection={projection}
          onAlias={onAlias}
          onOpenSource={onOpenSource}
          // The accessible Map is offered only from T-04's own context; none is invented when it refuses.
          context={mapContext !== null && mapContext.ok ? mapContext.context : null}
          language={locale.language}
          driftPaused={driftPaused}
          onOutcome={observeMapOutcome}
          home={home}
          rail={<>
            {modeChips}
            <CosmosTimelineRail
              store={store}
              preview={preview}
              presentation={presentation}
              language={locale.language}
              // §16 A-3: the historical and Live-focus acts and the technical note, in ONE line at the start of the rail's
              // words row; Return Live is the rail's own Live words (VPORT-02). Slice D CP3 (SD-4): T-04's context choice
              // is no longer here — its one home is the PEEK.
              acts={
                chrome === null ? null : (
                  <CosmosContextualActs
                    surface={returnSurface}
                    language={locale.language}
                    projection={chrome}
                    exactReturnOrigin={journey.origin()}
                    preview={preview}
                    liveContext={liveContext}
                    onMapOutcome={observeMapOutcome}
                    onReturnOutcome={observeReturnOutcome}
                    acts={RAIL_ACTS}
                    choice={false}
                  />
                )
              }
            />
          </>}
          // Slice D CP3: T-04's context choice, in the PEEK — the same component and executor, with no act and no note.
          choice={
            chrome === null ? null : (
              <CosmosContextualActs
                surface={returnSurface}
                language={locale.language}
                projection={chrome}
                preview={preview}
                onMapOutcome={observeMapOutcome}
                acts={[]}
                note={false}
                testID={PERSONAL_PEEK_CHOICE_TEST_ID}
              />
            )
          }
          chrome={chrome}
          registerSheetBack={registerSheetBack}
          // §16 A-2: the canonical Return to World at a deeper rung, as Overview's one companion chip (at the first rung,
          // away from the centre, the stage's Back chip is this act — `home`).
          overviewAct={
            chrome === null ? null : (
              <CosmosContextualActs
                surface={returnSurface}
                language={locale.language}
                projection={chrome}
                onReturnOutcome={observeReturnOutcome}
                acts={['RETURN_WORLD']}
                extras={false}
                testID={COSMOS_OVERVIEW_ACT_TEST_ID}
              />
            )
          }
          // The stage is composed: the Map's real first state, when T-04's context exists to draw from.
          composed={onComposed !== undefined && mapContext !== null && mapContext.ok ? <ComposedMark onComposed={onComposed} /> : null}
        />
      )}
      timeline={null}
      chrome={() => null}
      after={onComposed !== undefined && settledWithoutMap ? <ComposedMark onComposed={onComposed} /> : null}
    />
  );
}

/**
 * The Personal stage: the COSMOS world view over the owner, in the glass steadied by CA-O1, with T-04's accessible Map
 * laid over it through the same glass (the stage's own marks stand down: one object is never two nodes).
 *
 * Slice D CP3: and, in the same stage after it (exactly as Shared's and Public's), the Detail Sheet over the inspection —
 * PEEK only. The world view and its canvas are never re-keyed by the sheet, and the glass is NOT lifted by the PEEK
 * (no SD-10 lift here): the camera, the semantic zoom and #396's usable centre answer exactly as before.
 */
function PersonalStage({ owner: seam, glass, store, context, language, driftPaused, onOutcome, composed, home, rail, overviewAct, choice, chrome, registerSheetBack, projection, onAlias, onOpenSource }: {
  readonly owner: CosmosWorldOwner; readonly glass: ViewportEnvelope; readonly store: CanonicalStore;
  readonly context: MapInspectionContext | null; readonly language: ProductLocale['language']; readonly driftPaused: boolean;
  readonly onOutcome: (outcome: MapActionOutcome | { readonly outcome: string }) => void; readonly composed: ReactNode;
  readonly home: () => void; readonly rail: ReactNode; readonly overviewAct: ReactNode;
  readonly choice: ReactNode; readonly chrome: ChromeProjection | null;
  readonly registerSheetBack?: (back: (() => boolean) | null) => void;
  readonly projection: ProjectionCoordinator;
  readonly onAlias?: (threadId: string, alias: string) => Promise<boolean>;
  readonly onOpenSource?: (sessionId: string, sp: number) => Promise<ConversationSwitchOutcome>;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const decoded = useMemo(() => decodeCameraIntent(state.camera), [state.camera]);
  const camera = decoded.ok ? decoded.camera : null;
  // MAP-CLOSE-01 CA-O1: once the reader has acted, the world stays where it is when only the band below it changes.
  const steady = useSteadyEnvelope(glass, camera);
  const copy = analysisCopy(language);

  // Slice D CP3: the sheet is about the inspection — one inspected object is one group, so a context switch or a jump
  // keeps the phase and another object opens the PEEK again. No inspection: no content, and the sheet closes.
  const content = personalSheetContent(state.inspection, chrome);
  const sheet = useDetailSheet(content);
  const sheetBack = sheet.back;
  useEffect(() => {
    registerSheetBack?.(sheetBack);
    return () => registerSheetBack?.(null);
  }, [registerSheetBack, sheetBack]);
  // SD-12: a tap answered FOCUS (the inspected object, or another) shows a closed sheet again; the act is unchanged.
  const reopen = sheet.open;
  const owner = useMemo(() => reopeningOwner(seam, reopen), [seam, reopen]);
  const open = sheet.phase !== 'CLOSED';

  // The rail's height, measured where it is laid (its holder): the PEEK reaches at least the rail's top, so it covers it.
  const [railHeight, setRailHeight] = useState(0);
  // Larger text than the PEEK holds scrolls inside it; its body then leaves the vertical drag to that scroll (the handle drags).
  const [overflows, setOverflows] = useState(false);
  const onRailLayout = useCallback((event: LayoutChangeEvent) => setRailHeight(Math.round(event.nativeEvent.layout.height)), []);
  const held = rail === null ? null : (
    // The rail is never re-mounted by the sheet: the holder is always here; beneath an open PEEK it is hidden, takes no
    // touch and is hidden from accessibility. Its layout (and the stage's usable centre read from it) is unchanged.
    <View testID={PERSONAL_RAIL_HOLDER_TEST_ID} collapsable={false} onLayout={onRailLayout} pointerEvents={open ? 'none' : 'box-none'}
      importantForAccessibility={open ? 'no-hide-descendants' : 'auto'} accessibilityElementsHidden={open} style={open ? styles.inert : null}>
      {rail}
    </View>
  );

  return (
    <>
      <CosmosSheetStage expanded={false}>
        <CosmosWorldView owner={owner} world="PERSONAL" language={language} glass={steady} drift={!driftPaused}
          worldLabel={copy.map} zoomInLabel={copy.moreDetail} zoomOutLabel={copy.lessDetail} accessibleMarks={false}
          home={home} rail={held} overviewAct={overviewAct}>
          {context === null || camera === null ? null : (
            <MapAccessibilityLayer store={store} context={context} camera={camera} envelope={steady} onOutcome={onOutcome} language={language} />
          )}
          {composed}
        </CosmosWorldView>
      </CosmosSheetStage>
      <CosmosDetailSheet phase={sheet.phase} onSettle={sheet.settle} glass={glass} language={language} allowExpanded={false}
        bodyDrags={!overflows} subject={content?.group ?? null} accent>
        {content === null || chrome === null ? null : (
          <PersonalPeek store={store} chrome={chrome} context={context} language={language} bottomInset={glass.insetBottom}
            cover={railHeight === 0 ? 0 : railHeight + RAIL_BOTTOM_GAP} choice={choice} onOutcome={onOutcome} onOverflow={setOverflows}
            projection={projection} onAlias={onAlias} onOpenSource={onOpenSource} />
        )}
      </CosmosDetailSheet>
    </>
  );
}

/**
 * Slice D CP3: WHAT the Personal sheet is about, as an identity. The key is the whole inspection (a context switch is new
 * content of the same subject); the group is the inspected object. Nothing inspected, or no chrome to speak from: none.
 */
function personalSheetContent(inspection: ReturnType<CanonicalStore['getState']>['inspection'], chrome: ChromeProjection | null): SheetContent | null {
  if (inspection === null || chrome === null) return null;
  const decoded = decodeInspectionRef(inspection);
  if (decoded === null) return { key: 'UNDECODED', group: 'UNDECODED' };
  const binding = decoded.appearance?.kind === 'THREAD_READING' ? decoded.appearance.bindingId : '';
  const group = `${decoded.family}:${decoded.id}`;
  return { key: `${group}:${decoded.version ?? ''}:${binding}`, group };
}

/**
 * Slice D CP3 (§19.16): the Personal PEEK. Only what already existed, each from its own owner: the family word
 * (`analysisCopy`, the stage's own word for the inspected mark — never for an identity this moment does not know),
 * T-08's inspection statement and lineage sentences, T-04's context choice, and T-04's "Go to this place" — the same
 * `directJump` with the same request the accessible Map sends, offered exactly where it offers it (the inspected object
 * has ONE locus in the current scene; never where a context would have to be elected). The typography is T-08's own
 * roles (statement `supporting`, lineage `metadata`); the family word is the focused mark's gold.
 *
 * It fits the PEEK at the accepted size; where larger text would not, it scrolls inside the PEEK (the handle still drags),
 * so nothing is cut off and no act becomes unreachable.
 */
function PersonalPeek({ store, chrome, context, language, bottomInset, cover, choice, onOutcome, onOverflow, projection, onAlias, onOpenSource }: {
  readonly store: CanonicalStore; readonly chrome: ChromeProjection; readonly context: MapInspectionContext | null;
  readonly language: ProductLocale['language']; readonly bottomInset: number; readonly cover: number; readonly choice: ReactNode;
  readonly onOutcome: (outcome: MapActionOutcome | { readonly outcome: string }) => void;
  readonly onOverflow: (overflows: boolean) => void;
  readonly projection: ProjectionCoordinator;
  readonly onAlias?: (threadId: string, alias: string) => Promise<boolean>;
  readonly onOpenSource?: (sessionId: string, sp: number) => Promise<ConversationSwitchOutcome>;
}) {
  // The most the PEEK shows under its handle (sheet-geometry's cap); a taller content scrolls inside it.
  const room = SHEET_PEEK_MAX - SHEET_HANDLE_HEIGHT + bottomInset;
  const [contentHeight, setContentHeight] = useState(0);
  const overflows = contentHeight > room + 0.5;
  useEffect(() => { onOverflow(overflows); }, [onOverflow, overflows]);
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const copy = analysisCopy(language);
  const model = orientationModel(store, chrome);
  const render = model.inspection.render;
  const lineage = contextPathSentence(language, model.context.lineage);
  const inspected = decodeInspectionRef(state.inspection);
  const fresh = context !== null && mapContextFreshness(state, context).fresh;
  // The inspected object as the CURRENT scene discloses it (the very object the stage draws and labels), or none.
  const object = inspected === null || context === null || !fresh
    ? undefined
    : context.scene.objects.find((candidate) => candidate.family === inspected.family && candidate.id === inspected.id);
  // The family word is the approved Thread / Reading / Emerging focus word — the stage's own word for that mark — and only
  // for an object this moment discloses: from T-08's render state where it carries the family, otherwise from the object in
  // the current scene. An identity this moment does not know, or a family with no approved word, is never named.
  const carried = render.kind === 'RENDERABLE' || render.kind === 'CONTEXT_UNAVAILABLE_AT_TC' || render.kind === 'DEPTH_WITHHELD'
    ? render.family
    : render.kind === 'IDENTITY_UNKNOWN_AT_TC' ? null : object?.family ?? null;
  const family = carried === 'THREAD' || carried === 'READING' || carried === 'EMERGING_FOCUS' ? copy.family[carried] : null;
  const go = context !== null && inspected !== null && object !== undefined && object.loci.length === 1
    ? () => onOutcome(directJump(store, context, { family: inspected.family, id: inspected.id }))
    : null;
  // The PEEK reaches at least the rail's top (the handle's row is above the content).
  const minHeight = cover === 0 ? 0 : Math.max(0, cover - SHEET_HANDLE_HEIGHT) + bottomInset;
  // COSMOS E-2 Slice A (D-3 / D-4): the inspected Thread as THIS context discloses it — its server-given name (the person's
  // alias, else their grounding wording, else honestly none) and where it began. Nothing here is invented by the client.
  const thread = inspected !== null && inspected.family === 'THREAD' && context !== null && fresh
    ? context.disclosure.world.threads.find((candidate) => candidate.id === inspected.id) ?? null
    : null;
  const name = thread === null ? null
    : thread.name.text === null ? { text: copy.topicUnnamed, hint: null, quiet: true }
      : { text: thread.name.text, hint: thread.name.source === 'USER_ALIAS' ? copy.topicNameYours : copy.topicNameFromWords };
  const refresh = useCallback(() => {
    if (context === null) return;
    const sessionId = context.disclosure.sessionId;
    const tc = sessionPosition(context.disclosure.tc);
    // The names live in every rung's disclosure of this (Session, TC): each held rung is re-read from the server.
    for (const depth of ['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE'] as const) {
      void projection.refresh({ sessionId, tc, depth });
    }
    // HONOR acceptance (2026-11-20): the PEEK reads the INSPECTED viewpoint (the same key plus the held inspection, its own
    // cache entry). Without re-reading it too, the map showed the new name while the PEEK kept the old name and source.
    const asked = inspectionRequestOf(state.inspection);
    if (asked !== null) void projection.refresh({ sessionId, tc, depth: context.disclosure.depth, inspection: asked });
  }, [context, projection, state.inspection]);
  const origin = thread === null ? null : thread.origin;
  const openSource = origin === null || context === null ? null : () => {
    if (origin.sessionId === context.disclosure.sessionId) {
      onOutcome({ outcome: store.dispatch({ type: 'COMMIT_MOMENT', moment: sessionPosition(origin.sp) }).outcome });
      return;
    }
    if (onOpenSource !== undefined) void onOpenSource(origin.sessionId, origin.sp).then((outcome) => onOutcome({ outcome }));
  };
  return (
    // keyboardShouldPersistTaps (COSMOS E-2 HONOR acceptance DEFECT-4): with the topic-name keyboard open, a tap on Save
    // reaches Save; without it the first tap only dismissed the keyboard.
    <ScrollView style={{ maxHeight: room }} scrollEnabled={overflows} nestedScrollEnabled showsVerticalScrollIndicator={overflows} indicatorStyle="white"
      alwaysBounceVertical={false} keyboardShouldPersistTaps="handled" onContentSizeChange={(_width: number, height: number) => setContentHeight(Math.round(height))}>
      <CosmosPeekWords testID={PERSONAL_PEEK_TEST_ID} language={language} family={family} name={name} statement={inspectionSentence(language, render)}
        lineage={lineage} choice={choice} go={go === null ? null : { label: copy.goToPlace, onPress: go }} minHeight={minHeight} bottomInset={bottomInset}
        extra={thread === null ? null : (
          <TopicNameActs key={thread.id} current={thread.name.source === 'USER_ALIAS' ? thread.name.text : null} language={language}
            onAlias={onAlias === undefined ? null : async (alias: string) => { const kept = await onAlias(thread.id, alias); if (kept) refresh(); return kept; }}
            onOpenSource={openSource} />
        )} />
    </ScrollView>
  );
}

/**
 * COSMOS E-2 Slice C: the Personal map's mode chips — this conversation's Session-bound world, or all the person's topics
 * now. Two acts in the rail's words, the chosen one marked (the sheet's own accent border; the integration layer defines
 * no colour).
 */
function WorldModeChips({ mode, language, onMode }: { readonly mode: PersonalWorldMode; readonly language: ProductLocale['language']; readonly onMode: (mode: PersonalWorldMode) => void }) {
  const copy = analysisCopy(language);
  const chip = (which: PersonalWorldMode, testID: string, label: string) => (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: mode === which }}
      onPress={() => onMode(which)} style={peekStyles.press}>
      <View style={[peekStyles.chip, mode === which ? peekStyles.fieldFailed : null]}><Text style={peekStyles.chipText}>{label}</Text></View>
    </Pressable>
  );
  return (
    <View testID={PERSONAL_WORLD_MODE_TEST_ID} style={peekStyles.acts} pointerEvents="box-none">
      {chip('SESSION', PERSONAL_WORLD_MODE_SESSION_TEST_ID, copy.worldModeThisConversation)}
      {chip('CURRENT', PERSONAL_WORLD_MODE_CURRENT_TEST_ID, copy.worldModeAllTopics)}
    </View>
  );
}

/**
 * COSMOS E-2 Slice C: the CURRENT Personal World's stage — the same world view and the same sheet, over the current
 * owner. Its rail is the mode chips and one honest note (the present, with no timeline; served empty; or unreadable now).
 * The Back chip at the first rung returns to this conversation's world. The PEEK is about the focused Thread: its served
 * name and hint, Slice A's acts (name it; open where it began), and nothing about a Session Position it does not have.
 */
function CurrentStage({ owner: seam, world, glass, language, driftPaused, chips, home, focused, currentSessionId, registerSheetBack, onAlias, onOpenSource, onCommitHere }: {
  readonly owner: CosmosWorldOwner; readonly world: CurrentPersonalWorldController; readonly glass: ViewportEnvelope;
  readonly language: ProductLocale['language']; readonly driftPaused: boolean; readonly chips: ReactNode; readonly home: () => void;
  readonly focused: string | null; readonly currentSessionId: string;
  readonly registerSheetBack?: (back: (() => boolean) | null) => void;
  readonly onAlias?: (threadId: string, alias: string) => Promise<boolean>;
  readonly onOpenSource?: (sessionId: string, sp: number) => Promise<ConversationSwitchOutcome>;
  readonly onCommitHere: (sp: number) => void;
}) {
  const copy = analysisCopy(language);
  const state = useSyncExternalStore(world.subscribe, world.getState);
  const thread = focused === null ? null : state.threads.find((candidate) => candidate.id === focused) ?? null;
  // One focused Thread is one group; a new served name is new content of the same subject.
  const content: SheetContent | null = thread === null ? null : { key: `${thread.id}:${thread.name.source}:${thread.name.text ?? ''}`, group: thread.id };
  const sheet = useDetailSheet(content);
  const sheetBack = sheet.back;
  useEffect(() => {
    registerSheetBack?.(sheetBack);
    return () => registerSheetBack?.(null);
  }, [registerSheetBack, sheetBack]);
  const reopen = sheet.open;
  const owner = useMemo(() => reopeningOwner(seam, reopen), [seam, reopen]);
  const note = state.status === 'UNAVAILABLE' ? copy.currentWorldUnavailable
    : state.status === 'READY' && state.threads.length === 0 ? copy.currentWorldEmpty : copy.currentWorldNote;
  const name = thread === null ? null
    : thread.name.text === null ? { text: copy.topicUnnamed, hint: null, quiet: true }
      : { text: thread.name.text, hint: thread.name.source === 'USER_ALIAS' ? copy.topicNameYours : copy.topicNameFromWords };
  const openSource = thread === null ? null : () => {
    if (thread.origin.sessionId === currentSessionId) { onCommitHere(thread.origin.sp); return; }
    if (onOpenSource !== undefined) void onOpenSource(thread.origin.sessionId, thread.origin.sp);
  };
  return (
    <>
      <CosmosSheetStage expanded={false}>
        <CosmosWorldView owner={owner} world="PERSONAL" language={language} glass={glass} drift={!driftPaused}
          worldLabel={copy.worldModeAllTopics} zoomInLabel={copy.moreDetail} zoomOutLabel={copy.lessDetail} accessibleMarks={false}
          home={home} rail={<View pointerEvents="box-none">{chips}<Text testID={PERSONAL_WORLD_MODE_NOTE_TEST_ID} style={peekStyles.chipText}>{note}</Text></View>} />
      </CosmosSheetStage>
      <CosmosDetailSheet phase={sheet.phase} onSettle={sheet.settle} glass={glass} language={language} allowExpanded={false}
        bodyDrags subject={content?.group ?? null} accent>
        {thread === null ? null : (
          <CosmosPeekWords testID={PERSONAL_CURRENT_PEEK_TEST_ID} language={language} family={copy.family.THREAD} name={name}
            statement={copy.currentWorldNote} lineage={null} go={null} minHeight={0} bottomInset={glass.insetBottom}
            extra={(
              <TopicNameActs key={thread.id} current={thread.name.source === 'USER_ALIAS' ? thread.name.text : null} language={language}
                onAlias={onAlias === undefined ? null : async (alias: string) => { const kept = await onAlias(thread.id, alias); if (kept) world.refresh(); return kept; }}
                onOpenSource={openSource} />
            )} />
        )}
      </CosmosDetailSheet>
    </>
  );
}

/** The name's acts (COSMOS E-2 Slice A): name / rename the topic in the person's own words, and open where it began. */
function TopicNameActs({ current, language, onAlias, onOpenSource }: {
  readonly current: string | null; readonly language: ProductLocale['language'];
  readonly onAlias: ((alias: string) => Promise<boolean>) | null; readonly onOpenSource: (() => void) | null;
}) {
  const copy = analysisCopy(language);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current ?? '');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const rtl = language === 'ar';
  const words = { writingDirection: rtl ? 'rtl' : 'ltr', textAlign: rtl ? 'right' : 'left' } as const;
  // HONOR acceptance (DEFECT-4, R2): the field unmounts while focused, and Android then keeps an empty keyboard over the
  // PEEK; closing the editor (a kept Save or Cancel) also closes the keyboard.
  const close = () => { Keyboard.dismiss(); setEditing(false); };
  const save = async () => {
    if (onAlias === null || busy || draft.trim() === '') return;
    setBusy(true);
    const kept = await onAlias(draft);
    setBusy(false);
    setFailed(!kept);
    if (kept) close();
  };
  return (
    <View testID={`${PERSONAL_PEEK_TEST_ID}:name-acts`} style={peekStyles.acts} pointerEvents="box-none">
      {editing ? (
        <View style={peekStyles.editor}>
          <TextInput testID={`${PERSONAL_PEEK_TEST_ID}:name-field`} accessibilityLabel={copy.topicNameField} value={draft} onChangeText={setDraft} maxLength={60}
            editable={!busy} autoFocus style={[peekStyles.field, words, failed ? peekStyles.fieldFailed : null]} placeholder={copy.topicNameField} placeholderTextColor={COSMOS_PEEK_PLACEHOLDER_INK} />
          <Pressable testID={`${PERSONAL_PEEK_TEST_ID}:name-save`} accessibilityRole="button" accessibilityLabel={copy.saveName} disabled={busy || draft.trim() === ''} onPress={() => { void save(); }} style={peekStyles.press}>
            <View style={peekStyles.chip}><Text style={peekStyles.chipText}>{copy.saveName}</Text></View>
          </Pressable>
          <Pressable testID={`${PERSONAL_PEEK_TEST_ID}:name-cancel`} accessibilityRole="button" accessibilityLabel={copy.cancelName} disabled={busy} onPress={() => { close(); setFailed(false); setDraft(current ?? ''); }} style={peekStyles.press}>
            <View style={peekStyles.chip}><Text style={peekStyles.chipText}>{copy.cancelName}</Text></View>
          </Pressable>
        </View>
      ) : (
        <>
          {onAlias === null ? null : (
            <Pressable testID={`${PERSONAL_PEEK_TEST_ID}:name-edit`} accessibilityRole="button" accessibilityLabel={copy.nameTopic} onPress={() => { setDraft(current ?? ''); setEditing(true); }} style={peekStyles.press}>
              <View style={peekStyles.chip}><Text style={peekStyles.chipText}>{copy.nameTopic}</Text></View>
            </Pressable>
          )}
          {onOpenSource === null ? null : (
            <Pressable testID={`${PERSONAL_PEEK_TEST_ID}:source`} accessibilityRole="button" accessibilityLabel={copy.openSource} onPress={onOpenSource} style={peekStyles.press}>
              <View style={peekStyles.chip}><Text style={peekStyles.chipText}>{copy.openSource}</Text></View>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

// The sheet's own tokens (cosmos/product): the integration layer defines no colour (T-12 §28.22).
const peekStyles = cosmosPeekChipStyles;

const styles = StyleSheet.create({
  inert: { opacity: 0 },
});
