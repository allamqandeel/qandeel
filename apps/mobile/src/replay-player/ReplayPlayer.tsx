/**
 * S7-04 — the Personal Replay player's presentation: one PASSAGE over the depth the reader came from, and its two
 * entries (G1.1-R3 §B7 / §C4 is the reference for behaviour and placement, not for code).
 *
 *   the passage   drawn over the Conversation or the Analysis, which stay mounted beneath it, untouched and out of
 *                 reach: the conversation's loaded position, the composer's words, the live Analysis and its camera and
 *                 the Timeline's own position are exactly where the reader left them when it closes. It is modal for
 *                 assistive technology; Android Back, and the way back at the START edge, close it;
 *   the screen    the ONE Living Analysis surface, through the S7-03 `ReplayMomentComposite` (or its preview limit):
 *                 the historical message, the Map at that moment, and every honest state are the composite's. The
 *                 player adds only its top band (the way back, the title, the private lifecycle) and its moment
 *                 controls, which the composite stands beside the moment's own position inside the band its chrome
 *                 measures (Product Owner visual direction, 2026-10-20: option (b); the surface stays CHROME_ONLY and
 *                 the Live Timeline is not used). It draws no map, no graphic and no motion of its own;
 *   the entries   the draft just saved, from the Conversation's saved line (its «معاينة»); and the Analysis's END edge,
 *                 the same quiet 44 × 44 Replay glyph the Conversation's upper chrome has.
 *
 * The moments are navigated on the Replay's Temporal Spine (`ReplaySpine`: P2's frozen Spine + Aperture C "Parting" and
 * T-06's motion, over the version's moments — Product Owner decision, 2026-10-20), beside P2's own `play` / `pause`
 * (the signature family's media transport, `sig.mjs`, through the generated canonical glyphs; never the Call Rail,
 * which is the call's). Play and pause differ in FORM (the triangle, the two bars) and carry their names. Nothing here
 * claims sound, video or the original timing: the one sentence under the Spine declares the reading pace. Every word is
 * a copy owner's.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, StyleSheet, Text, View, findNodeHandle, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import { Control, Glyph, MIN_TARGET, conversationCopy, readerDirection, readerSide, typeStyle, usePalette } from '../conversation';
import { LivingAnalysisSurface, type LivingAnalysisTopBand } from '../living-analysis';
import type { ChromeLanguage } from '../orientation-chrome';
import { ReplayMomentComposite, ReplayPreviewLimit, replayCompositeCopy, type ReplayCompositeController, type ReplayMomentControls } from '../replay-composite';
import { replayEntryCopy, type ReplayEntryController } from '../replay-entry';
import { replayPlayerCopy } from './copy';
import type { ReplayPlayerController, ReplayPlayerTransportView, ReplayPlayerView } from './player-controller';
import { ReplaySpine } from './ReplaySpine';

export const REPLAY_PLAYER_TEST_ID = 'qandeel-replay-player';
/** The top band's height under the safe area: the Analysis return band's own (W1A-01). */
const BAR_MIN_HEIGHT = 48;
const DISABLED_OPACITY = 0.45;

type Edges = { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };

export interface ReplayPlayerProps {
  readonly controller: ReplayPlayerController;
  readonly language: ChromeLanguage;
  readonly insets: Edges;
}

const noSubscription = () => () => undefined;
const noRevision = () => 0;

/** Re-renders when the composite's own state changes (the transport's reach follows the version's viewability). */
function useCompositeRevision(composite: ReplayCompositeController | null): void {
  useSyncExternalStore(composite === null ? noSubscription : composite.subscribe, composite === null ? noRevision : composite.revision);
}

export function ReplayPlayer({ controller, language, insets }: ReplayPlayerProps) {
  const { open } = useSyncExternalStore(controller.subscribe, controller.getState);
  const shown = open !== null;
  const [barHeight, setBarHeight] = useState(insets.top + BAR_MIN_HEIGHT);
  useCompositeRevision(open?.composite ?? null);

  // Android system Back while the passage is shown is the passage's own way back, and nothing else.
  useEffect(() => {
    if (!shown) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      controller.close();
      return true;
    });
    return () => subscription.remove();
  }, [controller, shown]);

  if (open === null) return null;
  const top: LivingAnalysisTopBand = {
    content: <PlayerBar view={open} controller={controller} language={language} insets={insets} onHeight={setBarHeight} />,
    height: barHeight,
  };
  const transport = controller.transport();
  const controls: ReplayMomentControls | null = !transport.available ? null : {
    instrument: <Transport controller={controller} view={open} transport={transport} language={language} />,
    note: <PacingLine language={language} />,
  };

  let body: ReactNode;
  if (open.composite !== null) {
    body = <ReplayMomentComposite controller={open.composite} ordinal={open.ordinal} language={language} insets={insets} top={top} controls={controls} />;
  } else if (open.problem === 'MOMENT_NOT_SEALED' || open.problem === 'ANALYSIS_UNAVAILABLE') {
    body = <ReplayPreviewLimit outcome={open.problem} language={language} insets={insets} top={top} />;
  } else {
    body = <PlayerStage view={open} language={language} insets={insets} top={top} />;
  }
  return (
    <View testID={REPLAY_PLAYER_TEST_ID} style={StyleSheet.absoluteFill} accessibilityViewIsModal accessibilityLanguage={language}>
      {body}
    </View>
  );
}

/** No version to show yet (reading, previewing) or none at all: the same surface, with nothing drawn in its world. */
function PlayerStage({ view, language, insets, top }: { readonly view: ReplayPlayerView; readonly language: ChromeLanguage; readonly insets: Edges; readonly top: LivingAnalysisTopBand }) {
  const screen = useWindowDimensions();
  const busy = view.reading || view.command?.phase === 'SENDING';
  return (
    <LivingAnalysisSurface
      insets={insets}
      fontScale={screen.fontScale}
      envelope={{ width: screen.width, height: screen.height }}
      top={top}
      world={() => null}
      timeline={null}
      chrome={(composition) => (
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: composition.bottomInset + 10 }}>
          {busy ? <Busy /> : view.lifecycle === 'DRAFT' && view.version === null ? <DraftLine language={language} /> : null}
        </View>
      )}
    />
  );
}

function DraftLine({ language }: { readonly language: ChromeLanguage }) {
  const palette = usePalette();
  return (
    <Text testID="qandeel-replay-player-draft" style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: readerDirection(language), textAlign: readerSide(language) }}>
      {replayEntryCopy(language).savedDraft}
    </Text>
  );
}

/** Reading, said only to assistive technology: there is no loading sentence. */
function Busy() {
  return <View testID="qandeel-replay-player-busy" accessible accessibilityState={{ busy: true }} style={{ minHeight: 24 }} />;
}

// -------------------------------------------------------------------------------------------------- the top band
type Action = { readonly label: string; readonly onPress: () => void; readonly testID: string };

/** What the band says about the Replay now. Every sentence is a copy owner's; a limit is said by its own surface. */
function sentenceOf(view: ReplayPlayerView, language: ChromeLanguage): string | null {
  const entry = replayEntryCopy(language);
  const words = replayPlayerCopy(language);
  if (view.command?.phase === 'UNCONFIRMED') return view.command.act === 'FINALIZE' ? entry.unconfirmed : words.commandUnconfirmed;
  switch (view.problem) {
    case 'READ_FAILED':
    case 'FAILED':
      return entry.failed;
    case 'NOT_FOUND':
    case 'NONE':
    case 'NOT_AVAILABLE_NOW':
      return entry.notAvailable;
    case 'CHANGED':
      return entry.changed;
    case 'ANALYSIS_CHANGED':
      return words.analysisChanged;
    default:
      break;
  }
  if (view.notice === 'FINALIZED') return words.finalizedNotice;
  if (view.notice === 'DRAFT_AGAIN') return words.reopenedNotice;
  if (view.lifecycle === 'FINALIZED') return words.finalized;
  return null;
}

/** The acts the band offers now. None while a command is in flight; only Try again while one is unconfirmed. */
function actionsOf(view: ReplayPlayerView, controller: ReplayPlayerController, language: ChromeLanguage): readonly Action[] {
  const entry = replayEntryCopy(language);
  const words = replayPlayerCopy(language);
  if (view.command?.phase === 'SENDING' || view.reading) return [];
  if (view.command?.phase === 'UNCONFIRMED' || view.problem === 'READ_FAILED') {
    return [{ label: entry.tryAgain, onPress: () => controller.retry(), testID: 'qandeel-replay-player-retry' }];
  }
  if (view.problem === 'NOT_FOUND' || view.problem === 'NONE') return [];
  if (view.lifecycle === 'DRAFT' && view.draftRevision !== null) return [{ label: words.preview, onPress: () => controller.preview(), testID: 'qandeel-replay-player-preview' }];
  if (view.lifecycle === 'PREVIEW_READY' && view.version !== null) {
    return [
      { label: words.finalize, onPress: () => controller.finalize(), testID: 'qandeel-replay-player-finalize' },
      { label: words.reopen, onPress: () => controller.reopen(), testID: 'qandeel-replay-player-reopen' },
    ];
  }
  if (view.lifecycle === 'FINALIZED' && view.version !== null) return [{ label: words.reopen, onPress: () => controller.reopen(), testID: 'qandeel-replay-player-reopen' }];
  return [];
}

function PlayerBar({ view, controller, language, insets, onHeight }: {
  readonly view: ReplayPlayerView; readonly controller: ReplayPlayerController; readonly language: ChromeLanguage;
  readonly insets: Edges; readonly onHeight: (height: number) => void;
}) {
  const palette = usePalette();
  const turns = conversationCopy(language);
  const direction = readerDirection(language);
  const start = readerSide(language);
  const backRef = useRef<View | null>(null);
  // Arriving in the passage, the screen reader lands on its way back.
  useEffect(() => {
    const node = backRef.current === null ? null : findNodeHandle(backRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);
  // The way back names where it returns to: the frozen W1A-01 labels.
  const backLabel = view.origin === 'ANALYSIS' ? turns.doorLabel : turns.backLabel;
  const backName = view.origin === 'ANALYSIS' ? turns.doorName : turns.backName;
  const sentence = sentenceOf(view, language);
  const actions = actionsOf(view, controller, language);
  const busy = view.command?.phase === 'SENDING';

  return (
    <View
      testID="qandeel-replay-player-bar"
      onLayout={(event: LayoutChangeEvent) => onHeight(event.nativeEvent.layout.height)}
      style={{ backgroundColor: palette.world, paddingTop: insets.top, paddingLeft: insets.left + 10, paddingRight: insets.right + 10, minHeight: insets.top + BAR_MIN_HEIGHT }}
    >
      <View style={{ direction: 'ltr', flexDirection: start === 'right' ? 'row-reverse' : 'row', alignItems: 'center', minHeight: BAR_MIN_HEIGHT, columnGap: 8 }}>
        <Control
          palette={palette}
          language={language}
          accessibilityLabel={backName}
          onPress={() => controller.close()}
          testID="qandeel-replay-player-back"
          controlRef={(node) => {
            backRef.current = node;
          }}
          style={{ paddingHorizontal: 12 }}
        >
          <View style={{ flexDirection: direction === 'rtl' ? 'row-reverse' : 'row', alignItems: 'center' }}>
            <Glyph name="back" color={palette.primary} direction={direction} />
            <Text style={{ ...typeStyle('action'), color: palette.primary, ...(direction === 'rtl' ? { marginRight: 6 } : { marginLeft: 6 }) }}>{backLabel}</Text>
          </View>
        </Control>
        <Text
          testID="qandeel-replay-player-title"
          accessibilityRole="header"
          numberOfLines={2}
          style={{ ...typeStyle('metadata'), color: palette.secondary, flex: 1, writingDirection: direction, textAlign: readerSide(language) === 'right' ? 'left' : 'right' }}
        >
          {replayEntryCopy(language).replayName}
        </Text>
      </View>
      {sentence === null && actions.length === 0 && !busy ? null : (
        <View testID="qandeel-replay-player-status" style={{ direction, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 4, paddingBottom: 8, paddingHorizontal: 4 }}>
          {sentence === null ? null : (
            <Text testID="qandeel-replay-player-sentence" accessibilityLiveRegion="polite"
              style={{ ...typeStyle('supporting'), color: palette.secondary, flexShrink: 1, writingDirection: direction, textAlign: readerSide(language) }}>
              {sentence}
            </Text>
          )}
          {busy ? <Busy /> : null}
          {actions.map((action) => (
            <Control key={action.testID} palette={palette} language={language} accessibilityLabel={action.label} onPress={action.onPress} testID={action.testID} style={{ paddingHorizontal: 12 }}>
              <Text style={{ ...typeStyle('action'), color: palette.primary, writingDirection: direction }}>{action.label}</Text>
            </Control>
          ))}
        </View>
      )}
    </View>
  );
}

// -------------------------------------------------------------------------------------------------- the transport
function PacingLine({ language }: { readonly language: ChromeLanguage }) {
  const palette = usePalette();
  return (
    <Text testID="qandeel-replay-pacing" style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: readerDirection(language), textAlign: readerSide(language) }}>
      {replayPlayerCopy(language).pacing}
    </Text>
  );
}

/** P2's play / pause, then the Replay's Temporal Spine, in the reading direction: the instrument of the moment band. */
function Transport({ controller, view, transport, language }: {
  readonly controller: ReplayPlayerController; readonly view: ReplayPlayerView; readonly transport: ReplayPlayerTransportView; readonly language: ChromeLanguage;
}) {
  const palette = usePalette();
  const words = replayPlayerCopy(language);
  const direction = readerDirection(language);
  const blocked = view.command !== null;
  const read = view.composite?.state() ?? null;
  const moments = read === null || read.status !== 'READY' ? [] : read.moments;
  const sentences = replayCompositeCopy(language);
  // At the last moment, play starts again from the first: the same P2 play mark, named for what it does.
  const playLabel = view.playing ? words.pause : transport.atLast ? words.restart : words.play;
  return (
    <View testID="qandeel-replay-transport" style={{ direction, flexDirection: 'row', alignItems: 'center', columnGap: 4, minHeight: MIN_TARGET }}>
      <Control
        palette={palette}
        language={language}
        accessibilityLabel={playLabel}
        accessibilityState={{ disabled: blocked }}
        onPress={blocked ? () => undefined : () => (view.playing ? controller.pause() : controller.play())}
        testID="qandeel-replay-play"
        style={{ width: MIN_TARGET, alignItems: 'center', opacity: blocked ? DISABLED_OPACITY : 1 }}
      >
        <Glyph name={view.playing ? 'pause' : 'play'} color={palette.primary} direction={direction} />
      </Control>
      <ReplaySpine
        moments={moments}
        ordinal={view.ordinal}
        direction={direction}
        disabled={blocked}
        label={words.moments}
        valueOf={(ordinal) => sentences.position(ordinal, moments.length)}
        onCommit={(ordinal) => controller.seek(ordinal)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------- the entries
export interface ReplayPreviewActionProps {
  readonly player: ReplayPlayerController;
  readonly entry: ReplayEntryController;
  readonly language: ChromeLanguage;
}

/**
 * The saved line's one action: preview the draft just saved. Not offered when the draft reaches the open Live Head —
 * the line already says it can be shown only after the conversation continues.
 */
export function ReplayPreviewAction({ player, entry, language }: ReplayPreviewActionProps) {
  const { saved } = useSyncExternalStore(entry.subscribe, entry.getState);
  const palette = usePalette();
  const ref = useReturnFocus(player, 'CONVERSATION');
  if (saved === null || saved.reachesOpenHead) return null;
  const label = replayPlayerCopy(language).preview;
  return (
    <Control palette={palette} language={language} accessibilityLabel={label} onPress={() => player.openSaved(saved)} testID="qandeel-replay-preview"
      controlRef={(node) => {
        ref.current = node;
      }}
      style={{ alignSelf: 'flex-start', paddingHorizontal: 12, marginTop: 2 }}>
      <Text style={{ ...typeStyle('action'), color: palette.primary, writingDirection: readerDirection(language) }}>{label}</Text>
    </Control>
  );
}

export interface ReplayAnalysisEntryProps {
  readonly player: ReplayPlayerController;
  readonly entry: ReplayEntryController;
  readonly language: ChromeLanguage;
}

/**
 * The Analysis's END-edge entry: the same box and glyph as the Conversation's, under the same hint. Nothing while the
 * hint is closed; an empty held slot until something is committed. It opens this conversation's newest Replay.
 */
export function ReplayAnalysisEntry({ player, entry, language }: ReplayAnalysisEntryProps) {
  const state = useSyncExternalStore(entry.subscribe, entry.getState);
  const palette = usePalette();
  const ref = useReturnFocus(player, 'ANALYSIS');
  useEffect(() => {
    entry.ensure();
  }, [entry]);
  if (state.status === 'UNKNOWN' || state.status === 'HIDDEN') return null;
  if (state.status === 'RESERVED') {
    return <View testID="qandeel-replay-analysis-entry-slot" style={{ width: MIN_TARGET, height: MIN_TARGET }} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden />;
  }
  return (
    <Control palette={palette} language={language} accessibilityLabel={replayEntryCopy(language).replayName} onPress={() => player.openLatest(state.saved)}
      controlRef={(node) => {
        ref.current = node;
      }}
      testID="qandeel-replay-analysis-entry" style={{ width: MIN_TARGET, alignItems: 'center' }}>
      <Glyph name="replay" color={palette.primary} direction={readerDirection(language)} />
    </Control>
  );
}

/** Leaving the passage returns the screen reader to the entry that opened it. */
function useReturnFocus(player: ReplayPlayerController, origin: ReplayPlayerView['origin']) {
  const ref = useRef<View | null>(null);
  const openedHere = useSyncExternalStore(player.subscribe, () => player.getState().open?.origin === origin);
  const was = useRef(openedHere);
  useEffect(() => {
    if (was.current && !openedHere) {
      const node = ref.current === null ? null : findNodeHandle(ref.current);
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
    }
    was.current = openedHere;
  }, [openedHere]);
  return ref;
}
