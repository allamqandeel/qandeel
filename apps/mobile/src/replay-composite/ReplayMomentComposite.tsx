/**
 * S7-03 — ONE historical moment of a Personal Replay, analysed on the ONE Living Analysis surface.
 *
 *   the screen    `LivingAnalysisSurface` — the same screen the Personal Analysis, the Shared World and the Public World
 *                 are analysed on, composed CHROME_ONLY (no Timeline: the player and its navigation are S7-04's);
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
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import { Control, conversationCopy, paragraphDirection, readerDirection, readerSide, typeStyle, usePalette, type ConversationPalette } from '../conversation';
import { LivingAnalysisSurface } from '../living-analysis';
import { MapSurface, mapInspectionContext, mapProjectionRequest } from '../map';
import { spatialSentence, temporalLineModel, temporalSentence, type ChromeLanguage } from '../orientation-chrome';
import { replayEntryCopy } from '../replay-entry';
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
}

export function ReplayMomentComposite({ controller, ordinal, language, insets, initialDepth = 'WORLD' }: ReplayMomentCompositeProps) {
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
      language={language} insets={insets} fontScale={screen.fontScale} envelope={presentedIn} initialDepth={initialDepth} />
  );
}

function ReadyComposite({ controller, version, moments, ordinal, language, insets, fontScale, envelope, initialDepth }: {
  readonly controller: ReplayCompositeController; readonly version: ReplayHistoryVersion; readonly moments: readonly ReplayHistoryMoment[];
  readonly ordinal: number; readonly language: ChromeLanguage; readonly insets: ReplayMomentCompositeProps['insets'];
  readonly fontScale: number; readonly envelope: { readonly width: number; readonly height: number }; readonly initialDepth: SemanticDepth;
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

  return (
    <View testID={REPLAY_COMPOSITE_TEST_ID} style={{ flex: 1 }}>
      <LivingAnalysisSurface
        insets={insets}
        fontScale={fontScale}
        envelope={envelope}
        world={(frame) => (context === null || !context.ok ? null : <MapSurface store={store} context={context.context} envelope={frame} language={language} />)}
        timeline={null}
        chrome={(composition) => (
          <Band bottomInset={composition.bottomInset}>
            {moment === null ? <Refusal language={language} text={replayEntryCopy(language).notAvailable} testID="qandeel-replay-not-available" /> : (
              <MomentPanel controller={controller} store={store} version={version} moment={moment} count={moments.length} language={language}
                analysis={analysis} drawn={context !== null && context.ok} refusedByAdapter={disclosed !== null && disclosed.status === 'REFUSED'} />
            )}
          </Band>
        )}
      />
    </View>
  );
}

function MomentPanel({ controller, store, version, moment, count, language, analysis, drawn, refusedByAdapter }: {
  readonly controller: ReplayCompositeController; readonly store: CanonicalStore; readonly version: ReplayHistoryVersion;
  readonly moment: ReplayHistoryMoment; readonly count: number; readonly language: ChromeLanguage;
  readonly analysis: ReplayAnalysisState | null; readonly drawn: boolean; readonly refusedByAdapter: boolean;
}) {
  const palette = usePalette();
  const words = replayCompositeCopy(language);
  const entry = replayEntryCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  // Android ignores `writingDirection`; the reader's side is set physically, as the Conversation does (bidi.ts).
  const derived = (role: 'metadata' | 'supporting') => ({ ...typeStyle(role), color: palette.tertiary, writingDirection: writing as 'rtl' | 'ltr', textAlign: readerSide(language) });
  const viewpoint = store.getState();
  const scope = version.coverage === 'FULL_SOURCE' ? entry.whole : entry.part;

  return (
    <View testID="qandeel-replay-moment" accessibilityLanguage={language} style={{ rowGap: 10 }}>
      {/* Derived orientation: what the version is and where in it the reader is. Never the source. */}
      <Text testID="qandeel-replay-position" style={derived('metadata')}>{`${scope} · ${words.position(moment.ordinal, count)}`}</Text>

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
    </View>
  );
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

function Band({ bottomInset, children }: { readonly bottomInset: number; readonly children: ReactNode }) {
  return <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: bottomInset + 10 }}>{children}</View>;
}

export type ReplayPreviewLimitOutcome = 'MOMENT_NOT_SEALED' | 'ANALYSIS_UNAVAILABLE';

export interface ReplayPreviewLimitProps {
  /** The S7-01 preview command's own refusal, exactly as it answered. Issuing the command is S7-04's, not this file's. */
  readonly outcome: ReplayPreviewLimitOutcome;
  readonly language: ChromeLanguage;
  readonly insets: ReplayMomentCompositeProps['insets'];
}

/**
 * The two preview limits, said on the same surface — there is no version, so there is no moment and no world to draw:
 * an open head (MOMENT_NOT_SEALED, the APPROVED S7-02 sentence) and a conversation with no sealed analysis
 * (ANALYSIS_UNAVAILABLE, PROPOSED).
 */
export function ReplayPreviewLimit({ outcome, language, insets }: ReplayPreviewLimitProps) {
  const screen = useWindowDimensions();
  const presentedIn = useMemo(() => ({ width: screen.width, height: screen.height }), [screen.width, screen.height]);
  const sentence = outcome === 'MOMENT_NOT_SEALED' ? replayEntryCopy(language).openHead : replayCompositeCopy(language).previewAnalysisUnavailable;
  return (
    <View testID={REPLAY_COMPOSITE_TEST_ID} style={{ flex: 1 }}>
      <LivingAnalysisSurface insets={insets} fontScale={screen.fontScale} envelope={presentedIn} world={() => null} timeline={null}
        chrome={(composition) => (
          <Band bottomInset={composition.bottomInset}>
            <Refusal language={language} text={sentence} testID={outcome === 'MOMENT_NOT_SEALED' ? 'qandeel-replay-preview-open-head' : 'qandeel-replay-preview-no-analysis'} />
          </Band>
        )}
      />
    </View>
  );
}
