/**
 * S8B-07 CP1-B (VA-8, Sheet B, Copy Gate R1.1 rows RA-01 … RA-17) — what the Replay player shows for a V2 version's audio,
 * through the player's surface slot. Every word is an approved row; nothing here draws a map, an analysis or a graphic,
 * and nothing here plays: the clock does.
 *
 *   the pace          RA-01 (audio only) / RA-02 (text and audio), in place of the V1 declaration, for a V2 version only
 *                     (B11) — CP2-A.1 correction round: said to assistive technology on the one timeline, not as a paragraph
 *   the source        an audio moment's surface holds its speaker (CP2-A.1 correction round: no line of its own — RA-14's
 *                     per-moment line is retired from the Replay, which has ONE timeline); its transcript stands under the
 *                     DERIVED caption RA-03 (B12)
 *   the frames        above a moment: the record of the pause before it — RA-04 (shortened, with its true length) or
 *                     RA-05 (another recording, never a length); under the moment, the same frame while that pause is
 *                     held (B7 – B9). A pause kept at its real length has no frame (B6)
 *   the gaps          under a window, one line per recorded gap by kind: RA-06 / RA-07 / RA-08; NOT_SPEAKING has no text,
 *                     and neither has a writer loss under one second (RA-08's floor, PO 2026-11-08)
 *   the notices       RA-11 after 1 s without audio; RA-12 (error ink) with the existing Stage 7 «Try again» (B14) — in
 *                     the timeline's ONE status line, which is always held, so a notice never moves anything (F-4)
 *   no longer         RA-09 / RA-10 only for the cause the server PROVES, otherwise RA-17; the reading is withheld (B13)
 *   assistive tech    RA-15 when two voices start together, a gap's line as it starts, RA-04 / RA-05 as the pause starts
 *   the timeline      S8B-07 CP2-A.1 (R-2, R-3): the whole part's ONE line is the player's (`ReplayTimelineBar`, correction
 *                     round); this surface hands it what it reads of the clock (`timeline`): the map, the place, the pending
 *
 * No sound is added (D-05.7 (b)). Nothing is logged.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';

import { readerDirection, readerSide, typeStyle, usePalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome/types';
import { replayEntryCopy } from '../replay-entry';
import type { ReplayPlayerController, ReplayPlayerSurface, ReplayPlayerSurfaceControls, ReplayPlayerView, ReplayTimelineSource } from '../replay-player';
import type { ReplayHistoryMoment } from '../runtime-entry';
import { originalAudioLengthText, originalAudioText, type OriginalAudioCopyId } from './original-audio-copy';
import { spanAt, type PresentationBoundary, type PresentationGapKind, type PresentationSpan } from './presentation-map';
import type { ReplayAudio } from './replay-audio';
import type { ReplayAudioAnnouncement, ReplayAudioClock } from './replay-audio-clock';
import type { TransientUnavailableReason } from './transient-media-api';

export const REPLAY_AUDIO_TEST_ID = 'qandeel-replay-audio';

type Window = Extract<PresentationSpan, { kind: 'WINDOW' }>;

/** RA-09 / RA-10 only for a proven cause; otherwise RA-17 (V-30). */
export function replayEndedRow(reason: TransientUnavailableReason): OriginalAudioCopyId {
  return reason === 'EXPIRED' ? 'RA-09' : reason === 'DELETED' ? 'RA-10' : 'RA-17';
}

/** The frame a boundary or a held interval earns: RA-05 always across recordings, RA-04 only when shortened. */
export function frameText(of: PresentationBoundary | { readonly kind: 'HELD'; readonly elapsedMs: number; readonly shortened: boolean }, language: ChromeLanguage): string | null {
  if (of.kind === 'CROSS_RECORDING') return originalAudioText('RA-05', language);
  return of.shortened ? originalAudioLengthText('RA-04', language, of.elapsedMs) : null;
}

const GAP_ROWS = { RECONNECTION: 'RA-06', MUTED: 'RA-07', WRITER_LOSS: 'RA-08' } as const;

/**
 * RA-08's floor (Product Owner, 2026-11-08, a limited Copy Gate amendment): a writer loss shorter than one second has no
 * line and no announcement, so the reader never sees "0:00" for a lost part. The span itself, its length, the recording's
 * timing and the presentation map are unchanged; RA-06 and RA-07 are unchanged.
 */
export const WRITER_LOSS_LINE_MIN_MS = 1_000;

/** A recorded gap's line (RA-06 / RA-07 / RA-08), or none: NOT_SPEAKING, and a writer loss under RA-08's floor. */
export function gapText(gapKind: PresentationGapKind, ms: number, language: ChromeLanguage): string | null {
  if (gapKind === 'NOT_SPEAKING') return null;
  if (gapKind === 'WRITER_LOSS' && ms < WRITER_LOSS_LINE_MIN_MS) return null;
  return originalAudioLengthText(GAP_ROWS[gapKind], language, ms);
}

/** What a screen reader is told as a span starts, in the reader's language (the same truth the lines give). */
export function announcementText(announcement: ReplayAudioAnnouncement, language: ChromeLanguage): string | null {
  switch (announcement.kind) {
    case 'MIX':
      return originalAudioText('RA-15', language);
    case 'GAP':
      return gapText(announcement.gapKind, announcement.ms, language);
    case 'HELD':
      return originalAudioLengthText('RA-04', language, announcement.elapsedMs);
    default:
      return frameText(announcement.boundary, language);
  }
}

/** The place a moment's window holds in the plan, and whether the clock presents it now. */
function located(clock: ReplayAudioClock, ordinal: number): { readonly runIndex: number; readonly window: Window } | null {
  return clock.detail().plan?.windowOf.get(ordinal) ?? null;
}

function presentedWindow(clock: ReplayAudioClock): Window | null {
  const shown = clock.getState().ordinal;
  return shown === null ? null : located(clock, shown)?.window ?? null;
}

function Line({ text, language, testID, tone = 'tertiary', live = false }: {
  readonly text: string; readonly language: ChromeLanguage; readonly testID: string; readonly tone?: 'tertiary' | 'secondary' | 'error'; readonly live?: boolean;
}) {
  const palette = usePalette();
  const color = tone === 'error' ? palette.error : tone === 'secondary' ? palette.secondary : palette.tertiary;
  return (
    <Text testID={testID} accessibilityLanguage={language} {...(live ? { accessibilityLiveRegion: 'polite' as const } : {})}
      style={{ ...typeStyle(tone === 'error' ? 'supporting' : 'metadata'), color, writingDirection: readerDirection(language), textAlign: readerSide(language) }}>
      {text}
    </Text>
  );
}

/** The existing Stage 7 discontinuity frame (two dashed rules), with an approved row inside it. */
function Frame({ text, language, testID }: { readonly text: string; readonly language: ChromeLanguage; readonly testID: string }) {
  const palette = usePalette();
  return (
    <View testID={testID} accessible accessibilityLabel={text} accessibilityLanguage={language}
      style={{ borderTopWidth: 1, borderBottomWidth: 1, borderStyle: 'dashed', borderColor: palette.tertiary, paddingVertical: 6 }}>
      <Text style={{ ...typeStyle('supporting'), color: palette.tertiary, writingDirection: readerDirection(language), textAlign: readerSide(language) }}>{text}</Text>
    </View>
  );
}

/** Above a moment: the pause before its window, if it was shortened or crossed recordings. */
function Before({ clock, ordinal, language }: { readonly clock: ReplayAudioClock; readonly ordinal: number; readonly language: ChromeLanguage }) {
  useSyncExternalStore(clock.subscribe, clock.revision);
  const place = located(clock, ordinal);
  const plan = clock.detail().plan;
  if (place === null || plan === null || place.window.momentOrdinal !== ordinal) return null;
  const run = plan.runs[place.runIndex]!;
  const first = run.spans.find((span) => span.kind === 'WINDOW') === place.window;
  let text: string | null = null;
  if (first && place.runIndex > 0) text = frameText(plan.boundaries[place.runIndex - 1]!, language);
  else {
    const held = run.spans.find((span): span is Extract<PresentationSpan, { kind: 'HELD' }> => span.kind === 'HELD' && span.toMs === place.window.fromMs);
    if (held !== undefined) text = frameText(held, language);
  }
  return text === null ? null : <Frame text={text} language={language} testID={`${REPLAY_AUDIO_TEST_ID}-before-${ordinal}`} />;
}

/** Under the moment: its recorded gaps, the pause being held after it, and what the clock says now. */
function Beneath({ clock, ordinal, language }: { readonly clock: ReplayAudioClock; readonly ordinal: number; readonly language: ChromeLanguage }) {
  useSyncExternalStore(clock.subscribe, clock.revision);
  const place = located(clock, ordinal);
  const detail = clock.detail();
  const window = place?.window ?? null;
  const run = place === null ? null : detail.plan?.runs[place.runIndex] ?? null;
  const gaps = run === null || window === null ? [] : run.spans.flatMap((span) => {
    if (span.kind !== 'GAP' || span.fromMs < window.fromMs || span.toMs > window.toMs) return [];
    const text = gapText(span.gapKind, span.toMs - span.fromMs, language);
    return text === null ? [] : [{ fromMs: span.fromMs, text }];
  });
  const here = window !== null && presentedWindow(clock) === window;
  // The pause after this moment, while it is held: a boundary before the next run, or a held interval inside the run.
  let holding: string | null = null;
  if (here && detail.between !== null) holding = frameText(detail.between, language);
  else if (here && run !== null && window !== null && detail.positionMs >= window.toMs) {
    const held = spanAt(run, 'HELD', detail.positionMs);
    if (held !== null) holding = frameText(held, language);
  }
  return (
    <View testID={`${REPLAY_AUDIO_TEST_ID}-beneath-${ordinal}`} style={{ rowGap: 4 }}>
      {gaps.map((gap) => (
        <Line key={`${gap.fromMs}`} text={gap.text} language={language}
          testID={`${REPLAY_AUDIO_TEST_ID}-gap-${ordinal}-${gap.fromMs}`} />
      ))}
      {holding === null ? null : <Frame text={holding} language={language} testID={`${REPLAY_AUDIO_TEST_ID}-holding`} />}
    </View>
  );
}

/**
 * CP2-A.1 correction round: what the clock says now, in the timeline's ONE status line — RA-11 after 1 s without audio,
 * RA-12 with the existing «Try again», and once it can no longer play, only the proven or generic row. One line, never
 * wrapped; nothing otherwise (the line stays held by the timeline either way).
 */
function Status({ clock, controller, language }: { readonly clock: ReplayAudioClock; readonly controller: ReplayPlayerController; readonly language: ChromeLanguage }) {
  useSyncExternalStore(clock.subscribe, clock.revision);
  const palette = usePalette();
  const state = clock.getState();
  const { engine } = clock.detail();
  const line = (text: string, testID: string, color: string) => (
    <Text testID={testID} numberOfLines={1} accessibilityLanguage={language} accessibilityLiveRegion="polite"
      style={{ ...typeStyle('metadata'), color, flexShrink: 1, writingDirection: readerDirection(language), textAlign: readerSide(language) }}>
      {text}
    </Text>
  );
  if (state.phase === 'ENDED') return line(originalAudioText(replayEndedRow(engine.endedReason), language), `${REPLAY_AUDIO_TEST_ID}-ended`, palette.secondary);
  if (state.phase === 'FAILED') {
    const retry = replayEntryCopy(language).tryAgain;
    return (
      <View testID={`${REPLAY_AUDIO_TEST_ID}-failed`} style={{ flexDirection: readerSide(language) === 'right' ? 'row-reverse' : 'row', alignItems: 'center', columnGap: 12 }}>
        {line(originalAudioText('RA-12', language), `${REPLAY_AUDIO_TEST_ID}-failed-text`, palette.error)}
        {/* The existing «Try again», in the line's own type; its touch target is the full 44 pt (B14). */}
        <Pressable accessibilityRole="button" accessibilityLabel={retry} accessibilityLanguage={language} onPress={() => controller.play()}
          hitSlop={{ top: 13, bottom: 13, left: 8, right: 8 }} testID={`${REPLAY_AUDIO_TEST_ID}-retry`}>
          <Text style={{ ...typeStyle('metadata'), color: palette.primary }}>{retry}</Text>
        </Pressable>
      </View>
    );
  }
  if (engine.phase === 'PREPARING' && engine.waiting) return line(originalAudioText('RA-11', language), `${REPLAY_AUDIO_TEST_ID}-waiting`, palette.tertiary);
  return null;
}

/** RA-01 (audio only) / RA-02 (text and audio): the declaration of the version's pace (B11), for the timeline's hint. */
export function replayPaceDeclaration(moments: readonly ReplayHistoryMoment[], language: ChromeLanguage): string {
  return originalAudioText(moments.some((moment) => moment.originalMedium === 'ORIGINAL_TEXT') ? 'RA-02' : 'RA-01', language);
}

/** CP2-A.1: the clock, as the player's one timeline reads it (the map it is laid out on, the place, the pending place). */
function timelineSource(clock: ReplayAudioClock): ReplayTimelineSource {
  return {
    subscribe: clock.subscribe,
    revision: clock.revision,
    plan: () => clock.detail().timelinePlan,
    audio: () => {
      const state = clock.getState();
      return { phase: state.phase, ordinal: state.ordinal, place: clock.place() };
    },
    pending: () => clock.detail().pending,
  };
}

/** The screen reader is told each span as it starts, once, in the reader's language. */
function useAnnouncements(audio: ReplayAudio, language: ChromeLanguage): void {
  useEffect(() => audio.onAnnouncement((announcement) => {
    const text = announcementText(announcement, language);
    if (text !== null) AccessibilityInfo.announceForAccessibility(text);
  }), [audio, language]);
}

function useReplayAudioControls(audio: ReplayAudio, controller: ReplayPlayerController, view: ReplayPlayerView, language: ChromeLanguage): ReplayPlayerSurfaceControls | null {
  useSyncExternalStore(audio.subscribe, audio.revision);
  useAnnouncements(audio, language);
  const versionId = view.version?.versionId ?? null;
  const clock = versionId === null ? null : audio.clockOf(versionId);
  const timeline = useMemo(() => (clock === null ? null : timelineSource(clock)), [clock]);
  if (clock === null || timeline === null) return null;
  return {
    status: <Status clock={clock} controller={controller} language={language} />,
    hint: replayPaceDeclaration(clock.moments, language),
    withheld: clock.getState().phase === 'ENDED',
    // PR #404 RB-1: the Replay's stage follows this clock's place (it reads; it never drives the clock). RB-2 / S4: with
    // the historical availability bound to the map it holds; a clock alone carries none, and its stage stays neutral.
    stageClock: audio.stageClockOf(clock.versionId) ?? clock,
    timeline,
    moment: (moment: ReplayHistoryMoment) => (moment.originalMedium !== 'ORIGINAL_AUDIO' ? null : {
      caption: originalAudioText('RA-03', language),
      before: <Before clock={clock} ordinal={moment.ordinal} language={language} />,
      beneath: <Beneath clock={clock} ordinal={moment.ordinal} language={language} />,
    }),
  };
}

/** The player's surface for this generation's original audio. */
export function createReplayAudioSurface(audio: ReplayAudio, controller: ReplayPlayerController): ReplayPlayerSurface {
  return {
    useControls: (view, language) => useReplayAudioControls(audio, controller, view, language),
  };
}
