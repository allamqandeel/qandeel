/**
 * S7-03 — ONE historical moment of a Personal Replay, analysed on the ONE Living Analysis surface.
 *
 *   the screen    `LivingAnalysisSurface` — the same screen the Personal Analysis, the Shared World and the Public World
 *                 are analysed on, composed CHROME_ONLY, always: there is no Timeline here. The player and its
 *                 navigation are S7-04's, which hands its top band above the world and its moment controls into this
 *                 moment's own band (Product Owner visual direction, 2026-10-20: option (b), the measured band);
 *   the world     T-04's own `MapSurface`, over the analysis AT THIS MOMENT, through the governed adapter. There is no
 *                 Replay map, no copy of `LivingAnalysisMap` or `MapSurface`, and no world drawn here;
 *   the chrome    the moment itself: who said it and its exact text, never rewritten or summarised; where the reader is
 *                 (T-08's own temporal and spatial sentences); and every honest "nothing to draw" state.
 *
 * Truth convergence: the message, the Map and the sentences are read from ONE Replay viewpoint store in ONE render — the
 * moment shown is the one whose TC the store is pinned at, and the Map's context is T-04's own freshness-checked one for
 * that same (viewpoint, TC, depth). A moment change is T-06's own `commitMoment`; the Map's context goes stale at once,
 * so nothing of the earlier moment survives on the later one (and nothing of a later one on an earlier one).
 *
 * Nothing here animates. The world's travel and the disclosure arrivals are T-10's, with its Reduced Motion parity; this
 * file adds no transition, no entrance and no emphasis of its own, and the camera never moves because a moment changed.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ScrollView, Text, View, useWindowDimensions, type LayoutChangeEvent, type TextStyle } from 'react-native';

import { Control, conversationCopy, paragraphDirection, readerDirection, readerSide, typeStyle, usePalette, type ConversationPalette } from '../conversation';
import { LivingAnalysisSurface } from '../living-analysis';
import type { LivingAnalysisTopBand } from '../living-analysis';
import { MapSurface, mapInspectionContext, mapProjectionRequest } from '../map';
import { spatialSentence, temporalLineModel, temporalSentence, type ChromeLanguage } from '../orientation-chrome';
import { replayEntryCopy } from '../replay-entry';
import { presentationSurface, recompositionPlan } from '../responsive';
import { returnAvailability } from '../return-navigation';
import type { ReplayHistoryMoment, ReplayHistoryVersion } from '../runtime-entry';
import { sharedCopy } from '../shared-world';
import type { CanonicalStore, SemanticDepth } from '../state';
import { commitMoment } from '../temporal-navigation';
import type { ReplayAnalysisState, ReplayCompositeController } from './composite-controller';
import { replayCompositeCopy } from './copy';
import { discloseReplayMoment } from './projection-adapter';
import { createReplayViewpointStore } from './viewpoint-store';

export const REPLAY_COMPOSITE_TEST_ID = 'qandeel-replay-composite';

export interface ReplayMomentCompositeProps {
  readonly controller: ReplayCompositeController;
  /** The moment to show, by its ordinal in the version (1 .. momentCount). Choosing it is the caller's (S7-04's player). */
  readonly ordinal: number;
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  /** The rung the viewpoint OPENS on (default WORLD). After that the depth is the reader's own pinch, and only that. */
  readonly initialDepth?: SemanticDepth;
  /** S7-04: the player's top band (its way back and its private lifecycle), drawn above the world. Default: none. */
  readonly top?: LivingAnalysisTopBand | null;
  /**
   * S7-04: the player's moment instrument, while the version is READY and a moment is shown: it heads the moment's own
   * band, above the position (said once, never repeated) and the declaration of its pace, inside the band the chrome
   * measures — never in the surface's temporal slot, so the surface stays CHROME_ONLY. The instrument and the position
   * are held in place; the reading under them (the declaration of the pace, the gap, the message and its sentences)
   * scrolls on its own, so a long message never carries the controls out of reach (Product Owner review, 2026-10-20).
   * Default: none, and the moment is composed exactly as before.
   */
  readonly controls?: ReplayMomentControls | null;
}

/** The player's moment controls: its instrument (play / pause and the Replay's Temporal Spine), and the line that declares its pace. */
export interface ReplayMomentControls {
  readonly instrument: ReactNode;
  readonly note: ReactNode;
}

export function ReplayMomentComposite({ controller, ordinal, language, insets, initialDepth = 'WORLD', top = null, controls = null }: ReplayMomentCompositeProps) {
  useSyncExternalStore(controller.subscribe, controller.revision);
  const state = controller.state();
  useEffect(() => controller.open(), [controller]);
  const screen = useWindowDimensions();
  const presentedIn = useMemo(() => ({ width: screen.width, height: screen.height }), [screen.width, screen.height]);

  if (state.status !== 'READY') {
    return (
      <View testID={REPLAY_COMPOSITE_TEST_ID} style={{ flex: 1 }}>
        <LivingAnalysisSurface
          insets={insets}
          fontScale={screen.fontScale}
          envelope={presentedIn}
          top={top}
          world={() => null}
          timeline={null}
          chrome={(composition) => (
            <Band bottomInset={composition.bottomInset}>
              {state.status === 'LOADING' ? <Busy /> : state.status === 'FAILED'
                ? <Refusal language={language} text={replayEntryCopy(language).failed} onRetry={() => controller.retry()} testID="qandeel-replay-failed" />
                : state.status === 'REVOKED'
                  // Withdrawn while viewing: nothing from the earlier reads — no text, no Map, no reason, no layer — until a
                  // fresh, consistent pair of reads.
                  ? <Refusal language={language} text={replayEntryCopy(language).notAvailable} onRetry={() => controller.retry()} testID="qandeel-replay-revoked" />
                  : <Refusal language={language} text={replayEntryCopy(language).notAvailable} testID="qandeel-replay-not-available" />}
            </Band>
          )}
        />
      </View>
    );
  }
  return (
    <ReadyComposite key={state.version.versionId} controller={controller} version={state.version} moments={state.moments} ordinal={ordinal}
      language={language} insets={insets} fontScale={screen.fontScale} envelope={presentedIn} initialDepth={initialDepth} top={top} controls={controls} />
  );
}

function ReadyComposite({ controller, version, moments, ordinal, language, insets, fontScale, envelope, initialDepth, top, controls }: {
  readonly controller: ReplayCompositeController; readonly version: ReplayHistoryVersion; readonly moments: readonly ReplayHistoryMoment[];
  readonly ordinal: number; readonly language: ChromeLanguage; readonly insets: ReplayMomentCompositeProps['insets'];
  readonly fontScale: number; readonly envelope: { readonly width: number; readonly height: number }; readonly initialDepth: SemanticDepth;
  readonly top: LivingAnalysisTopBand | null; readonly controls: ReplayMomentControls | null;
}) {
  const asked = moments.find((moment) => moment.ordinal === ordinal) ?? null;
  // One isolated viewpoint per version, opened on the moment first asked for.
  const [store] = useState<CanonicalStore>(() => createReplayViewpointStore(version, (asked ?? moments[0]).tc, initialDepth));
  // A different moment is T-06's own commit on THIS store, and nothing else: the camera stays where the reader left it.
  useEffect(() => {
    if (asked !== null) commitMoment(store, asked.tc);
  }, [asked, store]);

  const viewpoint = useSyncExternalStore(store.subscribe, store.getState);
  const request = useMemo(() => mapProjectionRequest(viewpoint), [viewpoint]);
  // The moment shown is the one the store is AT — so the text, the Map and the sentences can never name two moments.
  const moment = request === null ? null : moments.find((candidate) => candidate.tc === request.tc) ?? null;
  const viewable = version.viewing.state === 'VIEWABLE';

  useEffect(() => {
    if (moment !== null && request !== null && viewable) controller.ensureAnalysis(moment.ordinal, request.depth);
  }, [controller, moment, request, viewable]);
  const analysis = moment === null || request === null || !viewable ? null : controller.analysis(moment.ordinal, request.depth);

  const disclosed = useMemo(
    () => (analysis === null || analysis.status !== 'AVAILABLE' || moment === null ? null : discloseReplayMoment(version, moment, analysis.analysis)),
    [analysis, moment, version],
  );
  // T-04's own context derivation, for the store's own current request; none is invented when it refuses.
  const context = useMemo(
    () => (disclosed === null || disclosed.status !== 'DISCLOSED' || request === null ? null : mapInspectionContext(disclosed.entry, request)),
    [disclosed, request],
  );

  // S7-04's controls only: the room the surface's band can take at most, read from T-11's own plan for the rect this
  // composite fills (the surface's own), so the moment's reading can be bounded under the controls. Nothing is measured
  // and nothing changes without controls.
  const [rect, setRect] = useState<{ readonly width: number; readonly height: number } | null>(null);
  const onRect = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setRect((current) => (current !== null && current.width === width && current.height === height ? current : { width, height }));
  }, []);
  const bandCap = useMemo(
    () => (controls === null || rect === null ? null : chromeBandCap(rect, top === null ? insets : { ...insets, top: top.height }, fontScale)),
    [controls, rect, top, insets, fontScale],
  );

  return (
    <View testID={REPLAY_COMPOSITE_TEST_ID} style={{ flex: 1 }} onLayout={controls === null ? undefined : onRect}>
      <LivingAnalysisSurface
        insets={insets}
        fontScale={fontScale}
        envelope={envelope}
        top={top}
        world={(frame) => (context === null || !context.ok ? null : <MapSurface store={store} context={context.context} envelope={frame} language={language} />)}
        timeline={null}
        chrome={(composition) => (
          <Band bottomInset={composition.bottomInset}>
            {moment === null ? <Refusal language={language} text={replayEntryCopy(language).notAvailable} testID="qandeel-replay-not-available" /> : (
              <MomentPanel controller={controller} store={store} version={version} moment={moment} count={moments.length} language={language}
                controls={controls} room={bandCap === null ? null : bandCap - bandPadding(composition.bottomInset)}
                analysis={analysis} drawn={context !== null && context.ok} refusedByAdapter={disclosed !== null && disclosed.status === 'REFUSED'} />
            )}
          </Band>
        )}
      />
    </View>
  );
}

function MomentPanel({ controller, store, version, moment, count, language, controls, room, analysis, drawn, refusedByAdapter }: {
  readonly controller: ReplayCompositeController; readonly store: CanonicalStore; readonly version: ReplayHistoryVersion;
  readonly moment: ReplayHistoryMoment; readonly count: number; readonly language: ChromeLanguage; readonly controls: ReplayMomentControls | null;
  readonly room: number | null; readonly analysis: ReplayAnalysisState | null; readonly drawn: boolean; readonly refusedByAdapter: boolean;
}) {
  const palette = usePalette();
  const words = replayCompositeCopy(language);
  const entry = replayEntryCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  // Android ignores `writingDirection`; the reader's side is set physically, as the Conversation does (bidi.ts).
  const derived = (role: 'metadata' | 'supporting') => ({ ...typeStyle(role), color: palette.tertiary, writingDirection: writing as 'rtl' | 'ltr', textAlign: readerSide(language) });
  const position = <Position text={`${scope(version, entry)} · ${words.position(moment.ordinal, count)}`} style={derived('metadata')} />;
  const reading = <MomentReading controller={controller} store={store} version={version} moment={moment} language={language} analysis={analysis} drawn={drawn} refusedByAdapter={refusedByAdapter} />;
  const [held, setHeld] = useState<number | null>(null);
  // A different moment is read from its start: the reading returns to its top at once (no motion), never left where the
  // previous moment was scrolled to.
  const reader = useRef<ScrollView>(null);
  useEffect(() => {
    reader.current?.scrollTo({ y: 0, animated: false });
  }, [moment.tc]);

  if (controls === null) {
    return (
      <View testID="qandeel-replay-moment" accessibilityLanguage={language} style={{ rowGap: MOMENT_GAP }}>
        {/* Derived orientation: what the version is and where in it the reader is. Never the source. */}
        {position}
        {reading}
      </View>
    );
  }
  // The reading's room is what the band can hold under the controls. Until both are measured, or where the controls
  // alone fill the band, nothing is bounded and the band's own scroller reaches everything, exactly as before.
  const bound = room === null || held === null ? null : Math.floor(room - held - CONTROLS_GAP) - 1;
  return (
    <View testID="qandeel-replay-moment" accessibilityLanguage={language} style={{ rowGap: CONTROLS_GAP }}>
      {/* Held in place: the player's instrument, then where the reader is (said once). Under them, and only there,
          the reading scrolls: the declaration of the pace first, then the moment itself. */}
      <View testID="qandeel-replay-moment-controls" style={{ rowGap: CONTROLS_GAP }}
        onLayout={(event: LayoutChangeEvent) => { const height = Math.ceil(event.nativeEvent.layout.height); setHeld((current) => (current === height ? current : height)); }}>
        {controls.instrument}
        {position}
      </View>
      <ScrollView ref={reader} testID="qandeel-replay-moment-reading" style={{ flexGrow: 0, maxHeight: bound !== null && bound >= MIN_READING ? bound : undefined }}
        contentContainerStyle={{ rowGap: MOMENT_GAP }} nestedScrollEnabled alwaysBounceVertical={false} accessibilityRole="none">
        {controls.note}
        {reading}
      </ScrollView>
    </View>
  );
}

const scope = (version: ReplayHistoryVersion, entry: ReturnType<typeof replayEntryCopy>) => (version.coverage === 'FULL_SOURCE' ? entry.whole : entry.part);

/** The moment itself, under its position: what was left out before it, its message, and where the reader is. */
function MomentReading({ controller, store, version, moment, language, analysis, drawn, refusedByAdapter }: {
  readonly controller: ReplayCompositeController; readonly store: CanonicalStore; readonly version: ReplayHistoryVersion;
  readonly moment: ReplayHistoryMoment; readonly language: ChromeLanguage;
  readonly analysis: ReplayAnalysisState | null; readonly drawn: boolean; readonly refusedByAdapter: boolean;
}) {
  const palette = usePalette();
  const words = replayCompositeCopy(language);
  const entry = replayEntryCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const derived = (role: 'metadata' | 'supporting') => ({ ...typeStyle(role), color: palette.tertiary, writingDirection: writing as 'rtl' | 'ltr', textAlign: readerSide(language) });
  const viewpoint = store.getState();

  return (
    <>
      {moment.omittedBefore > 0 ? (
        // PERCEPTIBLE_DISCONTINUITY_REQUIRED: the absence is named where it is, and nothing omitted is shown.
        <View testID="qandeel-replay-gap" accessible accessibilityLabel={words.gap(entry.count(moment.omittedBefore))}
          style={{ borderTopWidth: 1, borderBottomWidth: 1, borderStyle: 'dashed', borderColor: palette.tertiary, paddingVertical: 6 }}>
          <Text style={derived('supporting')}>{words.gap(entry.count(moment.omittedBefore))}</Text>
        </View>
      ) : null}

      {version.viewing.state === 'NOT_VIEWABLE' || moment.text === null ? (
        <NotViewable version={version} language={language} palette={palette} />
      ) : (
        <SourceMessage moment={moment} text={moment.text} language={language} palette={palette} />
      )}

      {version.viewing.state === 'VIEWABLE' && moment.text !== null ? (
        <View style={{ rowGap: 4 }}>
          <Text testID="qandeel-replay-temporal" style={derived('supporting')}>{temporalSentence(language, temporalLineModel(store).temporal)}</Text>
          {drawn ? (
            <Text testID="qandeel-replay-spatial" style={derived('supporting')}>
              {spatialSentence(language, { depth: viewpoint.camera.depth, atWorldViewpoint: !returnAvailability(viewpoint).worldReturnAvailable })}
            </Text>
          ) : null}
          <AnalysisState analysis={analysis} refusedByAdapter={refusedByAdapter} language={language} onRetry={() => controller.retry()} />
        </View>
      ) : null}
    </>
  );
}

function Position({ text, style }: { readonly text: string; readonly style: TextStyle }) {
  return <Text testID="qandeel-replay-position" style={style}>{text}</Text>;
}

/** The historical message exactly as it was committed, with its source identity and role. */
function SourceMessage({ moment, text, language, palette }: {
  readonly moment: ReplayHistoryMoment; readonly text: string; readonly language: ChromeLanguage; readonly palette: ConversationPalette;
}) {
  const turns = conversationCopy(language);
  const speaker = moment.sourceRole === 'USER' ? sharedCopy(language).you : turns.product;
  const name = moment.sourceRole === 'USER' ? turns.userTurnName(text) : turns.replyTurnName(text);
  const direction = paragraphDirection(text, readerDirection(language));
  return (
    <View testID="qandeel-replay-source" accessible accessibilityLabel={name} accessibilityLiveRegion="polite"
      style={{ backgroundColor: palette.field, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 12, rowGap: 4 }}>
      <Text testID="qandeel-replay-speaker" style={{ ...typeStyle('metadata'), color: palette.secondary, writingDirection: readerDirection(language), textAlign: readerSide(language) }}>{speaker}</Text>
      {/* The committed text, byte for byte: no truncation, no line limit, no rewrite, no inserted mark. Its own direction
          (first strong character) is the text's, and it is aligned to its own start. */}
      <Text testID="qandeel-replay-text" style={{ ...typeStyle('body'), color: palette.primary, writingDirection: direction, textAlign: direction === 'rtl' ? 'right' : 'left' }}>{text}</Text>
    </View>
  );
}

function NotViewable({ version, language, palette }: { readonly version: ReplayHistoryVersion; readonly language: ChromeLanguage; readonly palette: ConversationPalette }) {
  const words = replayCompositeCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const line = (testID: string, text: string, color: string) => (
    <Text testID={testID} style={{ ...typeStyle('body'), color, writingDirection: writing, textAlign: readerSide(language) }}>{text}</Text>
  );
  const { viewing } = version;
  return (
    <View testID="qandeel-replay-not-viewable" accessibilityLiveRegion="polite" style={{ rowGap: 6 }}>
      {viewing.notViewableClass === null ? null : line('qandeel-replay-not-viewable-reason', words.notViewable(viewing.notViewableClass), palette.primary)}
      {line('qandeel-replay-source-layer', viewing.sourceLayer === 'DEREFERENCEABLE' ? words.sourceLayerAvailable : words.sourceLayerUnavailable, palette.secondary)}
      {line('qandeel-replay-analytical-layer', viewing.analyticalLayer === 'SEALED_HISTORICAL_EVIDENCE' ? words.analyticalLayerSealed : words.analyticalLayerIncomplete, palette.secondary)}
      {line('qandeel-replay-no-analysis-without-text', words.noAnalysisWithoutText, palette.secondary)}
    </View>
  );
}

/** Why the Map is not drawn, when it is not. A failed read is said as a failure — never as an empty history. */
function AnalysisState({ analysis, refusedByAdapter, language, onRetry }: {
  readonly analysis: ReplayAnalysisState | null; readonly refusedByAdapter: boolean; readonly language: ChromeLanguage;
  readonly onRetry: () => void;
}) {
  const words = replayCompositeCopy(language);
  const entry = replayEntryCopy(language);
  if (analysis === null || analysis.status === 'LOADING') return <Busy />;
  if (analysis.status === 'AVAILABLE' && !refusedByAdapter) return null;
  if (analysis.status === 'FAILED') return <Refusal language={language} text={words.analysisFailed} onRetry={onRetry} testID="qandeel-replay-analysis-failed" />;
  if (analysis.status === 'NOT_CURRENTLY_AVAILABLE') {
    return <Refusal language={language} text={words.analysisNotCurrentlyAvailable} testID="qandeel-replay-analysis-not-currently-available" />;
  }
  return <Refusal language={language} text={entry.notAvailable} testID="qandeel-replay-analysis-not-available" />;
}

function Refusal({ language, text, onRetry, testID }: { readonly language: ChromeLanguage; readonly text: string; readonly onRetry?: () => void; readonly testID: string }) {
  const palette = usePalette();
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const retry = replayEntryCopy(language).tryAgain;
  return (
    <View testID={testID} accessibilityLiveRegion="polite" style={{ rowGap: 8, alignItems: readerSide(language) === 'right' ? 'flex-end' : 'flex-start' }}>
      <Text style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing, textAlign: readerSide(language) }}>{text}</Text>
      {onRetry === undefined ? null : (
        <Control palette={palette} language={language} accessibilityLabel={retry} onPress={onRetry} testID={`${testID}-retry`}>
          <Text style={{ ...typeStyle('action'), color: palette.primary }}>{retry}</Text>
        </Control>
      )}
    </View>
  );
}

/** Reading, said only to assistive technology: there is no loading sentence. */
function Busy() {
  return <View testID="qandeel-replay-busy" accessible accessibilityState={{ busy: true }} style={{ minHeight: 24 }} />;
}

/** The band's own vertical padding, above the moment and above the bottom safe area. */
const BAND_PADDING = 10;
/** The space between the parts of a moment. */
const MOMENT_GAP = 10;
/** The space under the player's controls, as the controls space their own parts. */
const CONTROLS_GAP = 2;
/** Under one touch target, a bounded reading could not be scrolled by a finger: the band's own scroller reaches it. */
const MIN_READING = 44;

function Band({ bottomInset, children }: { readonly bottomInset: number; readonly children: ReactNode }) {
  return <View style={{ paddingHorizontal: 16, paddingTop: BAND_PADDING, paddingBottom: bottomInset + BAND_PADDING }}>{children}</View>;
}

const bandPadding = (bottomInset: number) => BAND_PADDING + bottomInset + BAND_PADDING;

/**
 * The most the surface's chrome band can take for this rect — T-11's own plan, CHROME_ONLY and unmeasured, which is the
 * cap SHARED-VIS-01 sizes the measured band under. Read, never re-derived: the same pure plan the surface composes.
 */
function chromeBandCap(rect: { readonly width: number; readonly height: number }, insets: ReplayMomentCompositeProps['insets'], fontScale: number): number | null {
  const surface = presentationSurface({
    width: rect.width, height: rect.height, insetTop: insets.top, insetRight: insets.right, insetBottom: insets.bottom, insetLeft: insets.left, fontScale,
  });
  return surface === null ? null : recompositionPlan(surface, { support: 'CHROME_ONLY' }).support.chromePoints;
}

export type ReplayPreviewLimitOutcome = 'MOMENT_NOT_SEALED' | 'ANALYSIS_UNAVAILABLE';

export interface ReplayPreviewLimitProps {
  /** The S7-01 preview command's own refusal, exactly as it answered. Issuing the command is S7-04's, not this file's. */
  readonly outcome: ReplayPreviewLimitOutcome;
  readonly language: ChromeLanguage;
  readonly insets: ReplayMomentCompositeProps['insets'];
  /** S7-04: the player's top band. Default: none. */
  readonly top?: LivingAnalysisTopBand | null;
}

/**
 * The two preview limits, said on the same surface — there is no version, so there is no moment and no world to draw:
 * an open head (MOMENT_NOT_SEALED, the APPROVED S7-02 sentence) and a conversation with no sealed analysis
 * (ANALYSIS_UNAVAILABLE, PROPOSED).
 */
export function ReplayPreviewLimit({ outcome, language, insets, top = null }: ReplayPreviewLimitProps) {
  const screen = useWindowDimensions();
  const presentedIn = useMemo(() => ({ width: screen.width, height: screen.height }), [screen.width, screen.height]);
  const sentence = outcome === 'MOMENT_NOT_SEALED' ? replayEntryCopy(language).openHead : replayCompositeCopy(language).previewAnalysisUnavailable;
  return (
    <View testID={REPLAY_COMPOSITE_TEST_ID} style={{ flex: 1 }}>
      <LivingAnalysisSurface insets={insets} fontScale={screen.fontScale} envelope={presentedIn} top={top} world={() => null} timeline={null}
        chrome={(composition) => (
          <Band bottomInset={composition.bottomInset}>
            <Refusal language={language} text={sentence} testID={outcome === 'MOMENT_NOT_SEALED' ? 'qandeel-replay-preview-open-head' : 'qandeel-replay-preview-no-analysis'} />
          </Band>
        )}
      />
    </View>
  );
}
