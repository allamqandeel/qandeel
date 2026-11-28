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
 *   the entries   the draft just saved, from the Conversation's saved line (S8B-07 CP2-A.1: its RS-02 «فتح إعادة العرض»,
 *                 which opens that exact Replay); and the Analysis's END edge,
 *                 the same quiet 44 × 44 Replay glyph the Conversation's upper chrome has.
 *
 * The Replay is navigated on ONE timeline of the whole selected part (`ReplayTimelineBar`), beside P2's own `play` /
 * `pause` (the signature family's media transport, `sig.mjs`, through the generated canonical glyphs; never the Call
 * Rail, which is the call's). Play and pause differ in FORM (the triangle, the two bars) and carry their names. Every
 * word is a copy owner's.
 *
 * S8B-07 CP2-A.1 correction round — "REPLAY UI FINAL CORRECTION" (Product Owner, 2026-11-28), which supersedes here the
 * S7-04 decision of 2026-10-20 that put the moments on the Replay's Temporal Spine: the Spine, the per-moment audio lines
 * and the second line are gone from the Replay; the one timeline carries the moment starts as P2's rest notches. The
 * declaration of the pace (S7-04 `pacing`, RA-01 / RA-02) is no longer a paragraph on the screen: it is the timeline's
 * accessibility hint, and each shortened or crossed pause is still said where it happens (RA-04 / RA-05). The top band
 * is one row: the way back, then the private lifecycle's sentence and acts in quieter type (the title when there are
 * none). `ReplaySpine` stays in this module, no longer drawn by the player.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, StyleSheet, Text, View, findNodeHandle, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import { Control, Glyph, MIN_TARGET, conversationCopy, readerDirection, readerSide, typeStyle, usePalette } from '../conversation';
import { LivingAnalysisSurface, type LivingAnalysisTopBand } from '../living-analysis';
import type { ChromeLanguage } from '../orientation-chrome';
import { ReplayMomentComposite, ReplayPreviewLimit, replayCompositeCopy, type ReplayCompositeController, type ReplayMomentControls } from '../replay-composite';
import type { ReplayStageClock } from '../replay-cosmos';
import { replayPresentationClock, replayTimelinePosition, replayTimelineTarget, type ReplayPresentationPlan, type ReplayStageAudioState } from '../replay-cosmos/presentation-clock';
import { replayEntryCopy, replaySaveCopy, type ReplayEntryController } from '../replay-entry';
import type { ReplayHistoryMoment } from '../runtime-entry';
import { replayPlayerCopy } from './copy';
import { replayMomentPaceMs, type ReplayPlayerController, type ReplayPlayerTransportView, type ReplayPlayerView } from './player-controller';
import { ReplayTimelineBar } from './ReplayTimelineBar';

export const REPLAY_PLAYER_TEST_ID = 'qandeel-replay-player';
/** The top band's height under the safe area: the Analysis return band's own (W1A-01). */
const BAR_MIN_HEIGHT = 48;
const DISABLED_OPACITY = 0.45;

type Edges = { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };

export interface ReplayPlayerProps {
  readonly controller: ReplayPlayerController;
  readonly language: ChromeLanguage;
  readonly insets: Edges;
  /** S8B-07 CP1-B: what the controller's clock source shows for the versions it times. Absent: exactly the S7-04 player. */
  readonly surface?: ReplayPlayerSurface;
}

/**
 * S8B-07 CP1-B (Sheet B): the moment controls a clock source adds for the version shown, read by a hook so they follow its
 * own state. Null: the version is the player's alone (every V1 version).
 */
export interface ReplayPlayerSurface {
  useControls(view: ReplayPlayerView, language: ChromeLanguage): ReplayPlayerSurfaceControls | null;
}

export interface ReplayPlayerSurfaceControls {
  /**
   * CP2-A.1 correction round: the ONE status line under the timeline — RA-11, RA-12 with «Try again», or the row it
   * ended with — drawn by the surface in a line the timeline always holds (null: nothing to say). Never a paragraph.
   */
  readonly status: ReactNode;
  /** The declaration of this version's pace (RA-01 / RA-02), said to assistive technology on the timeline. */
  readonly hint: string;
  readonly moment: NonNullable<ReplayMomentControls['moment']>;
  /** The version can no longer play: no reading is shown in its place. */
  readonly withheld: boolean;
  /** PR #404 RB-1: the version's clock, which the COSMOS stage follows (its place, never the reading pace). */
  readonly stageClock?: ReplayStageClock;
  /**
   * S8B-07 CP2-A.1 (R-3): what the one timeline of the whole selected part reads from the version's clock — the map it is
   * laid out on and where the clock is. The player draws it (correction round): in the moment band, never the surface's
   * temporal slot, which stays empty (option (b)); a seek on it is the player's `seekTo`.
   */
  readonly timeline: ReplayTimelineSource;
}

/** S8B-07 CP2-A.1: the version's clock, as the one timeline reads it. */
export interface ReplayTimelineSource {
  subscribe(listener: () => void): () => void;
  revision(): number;
  /** The map the line is laid out on: the played set's, or the version's read alone; null: not known yet (no length). */
  plan(): ReplayPresentationPlan | null;
  audio(): ReplayStageAudioState;
  /** A place chosen while nothing ran there, which the next start of that moment begins at. */
  pending(): { readonly ordinal: number; readonly offsetMs: number } | null;
}

/** A version of text alone (every V1 version): its line is the reading pace's, laid out with no audio map. */
const TEXT_ONLY_PLAN: ReplayPresentationPlan = Object.freeze({ runs: [], boundaries: [], windowOf: new Map(), throughOf: [] });
const NOTHING_HEARD: ReplayStageAudioState = Object.freeze({ phase: 'IDLE', ordinal: null, place: null });
const TEXT_ONLY_TIMELINE: ReplayTimelineSource = Object.freeze({
  subscribe: () => () => undefined,
  revision: () => 0,
  plan: () => TEXT_ONLY_PLAN,
  audio: () => NOTHING_HEARD,
  pending: () => null,
});

/** How often the timeline is redrawn while the Replay plays (its position is read from the clock each time). */
export const REPLAY_TIMELINE_REDRAW_MS = 100;

const NO_SURFACE: ReplayPlayerSurface = { useControls: () => null };

/**
 * REPLAY-COSMOS-01: each paced moment's presentation window for the COSMOS stage — the declared reading pace the player
 * times it with. A clock-presented V2 moment's window is its audio window, from the clock the surface hands the stage
 * (PR #404 RB-1 S2: residue R-3). S8B-07 CP2-A.1: the one function the timeline lays a paced moment out with, too.
 */
const momentPaceMs = (moment: ReplayHistoryMoment): number => replayMomentPaceMs(moment);

/** CP2-A.1: the player's reading-pace elapsed part of this paced moment, or null (not paced here, or not yet timed). */
const pacedElapsedOf = (controller: ReplayPlayerController, ordinal: number): number | null => {
  const paced = controller.pacedElapsed();
  return paced !== null && paced.ordinal === ordinal ? paced.elapsedMs : null;
};

const noSubscription = () => () => undefined;
const noRevision = () => 0;

/** Re-renders when the composite's own state changes (the transport's reach follows the version's viewability). */
function useCompositeRevision(composite: ReplayCompositeController | null): void {
  useSyncExternalStore(composite === null ? noSubscription : composite.subscribe, composite === null ? noRevision : composite.revision);
}

export function ReplayPlayer({ controller, language, insets, surface = NO_SURFACE }: ReplayPlayerProps) {
  const { open } = useSyncExternalStore(controller.subscribe, controller.getState);
  const shown = open !== null;
  const [barHeight, setBarHeight] = useState(insets.top + BAR_MIN_HEIGHT);
  useCompositeRevision(open?.composite ?? null);
  const added = useSurfaceControls(surface, open, language);

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
    instrument: <Transport controller={controller} view={open} transport={transport} language={language} added={added} />,
    ...(added === null ? {} : { moment: added.moment, withheld: added.withheld }),
  };

  let body: ReactNode;
  if (open.composite !== null) {
    body = <ReplayMomentComposite controller={open.composite} ordinal={open.ordinal} language={language} insets={insets} top={top} controls={controls}
      playing={open.playing} windowMs={momentPaceMs} stageClock={added?.stageClock ?? null} pacedElapsed={(ordinal) => pacedElapsedOf(controller, ordinal)} />;
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

/** The surface's hook, always called (with no open view, it is given none). */
function useSurfaceControls(surface: ReplayPlayerSurface, open: ReplayPlayerView | null, language: ChromeLanguage): ReplayPlayerSurfaceControls | null {
  const controls = surface.useControls(open ?? CLOSED, language);
  return open === null ? null : controls;
}

const CLOSED: ReplayPlayerView = Object.freeze({
  origin: 'CONVERSATION', replayId: null, reading: false, lifecycle: null, draftRevision: null, version: null, composite: null,
  ordinal: 1, playing: false, command: null, problem: null, notice: null,
});

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

  // CP2-A.1 correction round ("REPLAY UI FINAL CORRECTION" §4): ONE row — the way back, then, at the far side, the
  // private lifecycle's sentence and its acts in the quieter metadata type, or the title when there are none. Every act
  // keeps its full 44 pt target; on a narrow screen or at a large text size the row wraps, and nothing is removed.
  const quiet = sentence !== null || actions.length > 0 || busy;
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
        {!quiet ? (
          <Text
            testID="qandeel-replay-player-title"
            accessibilityRole="header"
            numberOfLines={2}
            style={{ ...typeStyle('metadata'), color: palette.secondary, flex: 1, writingDirection: direction, textAlign: readerSide(language) === 'right' ? 'left' : 'right' }}
          >
            {replayEntryCopy(language).replayName}
          </Text>
        ) : (
          <>
            {/* The name stays the passage's header for assistive technology (S7-05 D2), with no visible room of its own
                (one clipped point in the band's own ink: never transparent, so a screen reader still reaches it). */}
            <Text testID="qandeel-replay-player-title" accessibilityRole="header" numberOfLines={1}
              style={{ ...typeStyle('metadata'), position: 'absolute', width: 1, height: 1, overflow: 'hidden', color: palette.world }}>
              {replayEntryCopy(language).replayName}
            </Text>
            <View testID="qandeel-replay-player-status"
              style={{ flex: 1, direction: 'ltr', flexDirection: start === 'right' ? 'row-reverse' : 'row', justifyContent: 'flex-end', flexWrap: 'wrap', alignItems: 'center', columnGap: 4 }}>
              {sentence === null ? null : (
                <Text testID="qandeel-replay-player-sentence" accessibilityLiveRegion="polite"
                  style={{ ...typeStyle('metadata'), color: palette.tertiary, flexShrink: 1, writingDirection: direction, textAlign: readerSide(language) }}>
                  {sentence}
                </Text>
              )}
              {busy ? <Busy /> : null}
              {actions.map((action) => (
                <Control key={action.testID} palette={palette} language={language} accessibilityLabel={action.label} onPress={action.onPress} testID={action.testID} style={{ paddingHorizontal: 8 }}>
                  <Text style={{ ...typeStyle('metadata'), color: palette.primary, writingDirection: direction }}>{action.label}</Text>
                </Control>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// -------------------------------------------------------------------------------------------------- the transport
/**
 * P2's play / pause, then the Replay's ONE timeline, in the reading direction: the instrument of the moment band (CP2-A.1
 * correction round). Its length and place are the presentation clock's (`replayPresentationClock` over the clock's map, or
 * the reading pace alone for a version of text), redrawn while it plays; a seek is the player's `seekTo`.
 */
function Transport({ controller, view, transport, language, added }: {
  readonly controller: ReplayPlayerController; readonly view: ReplayPlayerView; readonly transport: ReplayPlayerTransportView; readonly language: ChromeLanguage;
  readonly added: ReplayPlayerSurfaceControls | null;
}) {
  const palette = usePalette();
  const words = replayPlayerCopy(language);
  const direction = readerDirection(language);
  const source = added?.timeline ?? TEXT_ONLY_TIMELINE;
  useSyncExternalStore(source.subscribe, source.revision);
  const blocked = view.command !== null;
  const read = view.composite?.state() ?? null;
  const moments = read === null || read.status !== 'READY' ? NO_MOMENTS : read.moments;
  const sentences = replayCompositeCopy(language);
  const plan = source.plan();
  const presentation = useMemo(() => (plan === null || moments.length === 0 ? null : replayPresentationClock(plan, moments, momentPaceMs)), [plan, moments]);
  const [, redraw] = useState(0);
  useEffect(() => {
    if (!view.playing) return undefined;
    const handle = setInterval(() => redraw((n) => n + 1), REPLAY_TIMELINE_REDRAW_MS);
    return () => clearInterval(handle);
  }, [view.playing]);
  const marks = useMemo(() => (presentation === null ? [] : Array.from(new Set(presentation.inputs.filter((m) => m.presentedBy === m.ordinal).map((m) => m.windowStartMs)))), [presentation]);
  const positionMs = presentation === null ? 0 : replayTimelinePosition(presentation, view.ordinal, source.audio(), pacedElapsedOf(controller, view.ordinal), source.pending());
  // At the last moment, play starts again from the first: the same P2 play mark, named for what it does.
  const playLabel = view.playing ? words.pause : transport.atLast ? words.restart : words.play;
  const control = (
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
  );
  return (
    <ReplayTimelineBar
      language={language}
      control={control}
      totalMs={presentation === null ? null : presentation.durationMs}
      positionMs={positionMs}
      marks={marks}
      disabled={blocked || added?.withheld === true || presentation === null}
      label={replayEntryCopy(language).replayName}
      hint={added?.hint ?? words.pacing}
      where={sentences.position(view.ordinal, moments.length)}
      onSeek={(ms) => {
        const target = presentation === null ? null : replayTimelineTarget(presentation, ms);
        if (target !== null) controller.seekTo(target.ordinal, target.offsetMs);
      }}
      status={added?.status ?? null}
    />
  );
}

const NO_MOMENTS: readonly ReplayHistoryMoment[] = Object.freeze([]);

// ---------------------------------------------------------------------------------------------------- the entries
export interface ReplayPreviewActionProps {
  readonly player: ReplayPlayerController;
  readonly entry: ReplayEntryController;
  readonly language: ChromeLanguage;
}

/**
 * The saved line's one action: open the exact Replay just saved (S8B-07 CP2-A.1, RS-02 «فتح إعادة العرض»; it is read first,
 * and a draft is previewed, so what was saved is what is shown). Not offered when the draft reaches the open Live Head —
 * the line already says it can be shown only after the conversation continues.
 */
export function ReplayPreviewAction({ player, entry, language }: ReplayPreviewActionProps) {
  const { saved } = useSyncExternalStore(entry.subscribe, entry.getState);
  const palette = usePalette();
  const ref = useReturnFocus(player, 'CONVERSATION');
  if (saved === null || saved.reachesOpenHead) return null;
  const label = replaySaveCopy(language).openReplay;
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
