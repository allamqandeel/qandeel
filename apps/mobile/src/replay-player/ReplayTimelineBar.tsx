/**
 * S8B-07 CP2-A.1 correction round — "REPLAY UI FINAL CORRECTION" (Product Owner, 2026-11-28): the Replay's ONE timeline.
 *
 * A familiar media-player line, in QANDEEL's own ink, for the whole selected Replay and nothing else:
 *
 *   the control  P2's own play / pause (the caller's, through the generated glyphs): the ONE Play / Pause of the Replay
 *   the track    a beginning and an end (the thumb's radius in from each edge); the elapsed part in the primary ink, the
 *                part still to come in the tertiary ink at P2's spine opacity; each later moment's start a P2 rest notch
 *                (6 pt, the Spine's own value) — the moment order the Spine showed, kept on the one line
 *   the thumb    a compact disc on the track's axis (12 pt; 16 pt while dragged), replacing the Aperture "Parting" the
 *                Product Owner asked to retire here (it stays the voice message's and the Spine's own)
 *   the time     elapsed / total, tabular Western digits in an LTR island, in a box sized once from the total, so the
 *                track never changes width while the time runs
 *   the status   ONE line of fixed height under the track (RA-11 / RA-12 with «Try again» / the ended row), drawn by the
 *                caller: a status never moves anything around it (F-4)
 *
 * A tap or a drag places the Replay at that instant (forward and backward, before the first Play, playing or paused); the
 * accessible increment / decrement step as a voice message does. Right to left in Arabic, left to right in English. It
 * keeps no time of its own: its position and seek are the caller's, read from the one presentation clock.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Text, View, useWindowDimensions, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { MIN_TARGET, readerDirection, readerSide, typeStyle, usePalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { replayListSeparator } from './copy';

export const REPLAY_TIMELINE_TEST_ID = 'qandeel-replay-timeline';
/** The thumb's radius at rest; the track's beginning and end lie this far in from the line's edges. */
export const REPLAY_TIMELINE_INSET = 8;
const THUMB = 12;
const THUMB_DRAGGED = 16;
const RAIL = 3;
/** P2's rest notch (the Spine's moment mark), its height and stroke. */
const NOTCH = { height: 6, width: 1, opacity: 0.85 } as const;
/** P2's spine opacity: the part still to come. */
const REMAINING_OPACITY = 0.55;
const AXIS = MIN_TARGET / 2;
const STATUS_LINE = typeStyle('metadata').lineHeight;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** «m:ss», the voice message's own length text. */
export function timelineClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

/** The accessible step: 1 s, or 5 s from 30 s (the voice message's). */
export function timelineStepMs(totalMs: number): number {
  return totalMs >= 30_000 ? 5_000 : 1_000;
}

export interface ReplayTimelineBarProps {
  readonly language: ChromeLanguage;
  /** P2's play / pause, the caller's. */
  readonly control: ReactNode;
  /** The whole Replay's length, or null while it is not known (the track is drawn, with no length and no seek). */
  readonly totalMs: number | null;
  readonly positionMs: number;
  /** Each later moment's start on the line (ms). */
  readonly marks: readonly number[];
  readonly disabled: boolean;
  readonly label: string;
  /** Said to assistive technology on the line (the declared pace). */
  readonly hint: string;
  /** Said after the time (where the reader is among the moments). */
  readonly where: string;
  readonly onSeek: (positionMs: number) => void;
  /** The one-line status, or nothing; its line is held either way. */
  readonly status: ReactNode;
}

export function ReplayTimelineBar({ language, control, totalMs, positionMs, marks, disabled, label, hint, where, onSeek, status }: ReplayTimelineBarProps) {
  const palette = usePalette();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  const start = readerSide(language);
  const end = start === 'right' ? 'left' : 'right';
  const rowDirection = start === 'right' ? 'row-reverse' : 'row';
  const total = totalMs ?? 0;
  const seekable = !disabled && total > 0;
  const run = Math.max(0, width - 2 * REPLAY_TIMELINE_INSET);
  const at = (fraction: number) => REPLAY_TIMELINE_INSET + clamp01(fraction) * run;
  const fraction = total > 0 ? clamp01(positionMs / total) : 0;
  const shown = preview ?? fraction;

  const gesture = useMemo(() => {
    const fractionAt = (x: number): number | null => {
      if (run <= 0) return null;
      const logical = start === 'right' ? width - x : x;
      return clamp01((logical - REPLAY_TIMELINE_INSET) / run);
    };
    const commit = (x: number) => {
      const f = fractionAt(x);
      if (f !== null) onSeek(Math.round(f * total));
    };
    const drag = Gesture.Pan()
      .runOnJS(true)
      .withTestId(`${REPLAY_TIMELINE_TEST_ID}-drag`)
      .enabled(seekable)
      .activeOffsetX([-8, 8])
      .failOffsetY([-12, 12])
      .onStart((event) => setPreview(fractionAt(event.x)))
      .onUpdate((event) => setPreview(fractionAt(event.x)))
      .onEnd((event, success) => {
        if (success) commit(event.x);
      })
      .onFinalize(() => setPreview(null));
    const tap = Gesture.Tap()
      .runOnJS(true)
      .withTestId(`${REPLAY_TIMELINE_TEST_ID}-tap`)
      .enabled(seekable)
      .onEnd((event, success) => {
        if (success) commit(event.x);
      });
    return Gesture.Race(drag, tap);
  }, [run, width, start, total, seekable, onSeek]);

  const onAction = useCallback((event: AccessibilityActionEvent) => {
    const by = timelineStepMs(total);
    const step = event.nativeEvent.actionName === 'increment' ? by : event.nativeEvent.actionName === 'decrement' ? -by : 0;
    if (step !== 0) onSeek(Math.min(total, Math.max(0, positionMs + step)));
  }, [onSeek, positionMs, total]);

  const shownMs = Math.round(shown * total);
  const time = totalMs === null ? '' : `${timelineClock(shownMs)} / ${timelineClock(total)}`;
  // Sized once from the total (tabular digits), so the track keeps its width while the time runs.
  const timeWidth = Math.ceil((2 * timelineClock(total).length + 3) * 7 * fontScale) + 2;
  const thumb = preview === null ? THUMB : THUMB_DRAGGED;

  const line = (
    <View
      testID={`${REPLAY_TIMELINE_TEST_ID}-line`}
      onLayout={(event: LayoutChangeEvent) => setWidth(Math.floor(event.nativeEvent.layout.width))}
      style={{ flex: 1, minWidth: 48, height: MIN_TARGET }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityLanguage={language}
      accessibilityState={{ disabled: !seekable }}
      accessibilityValue={totalMs === null ? { text: where } : {
        min: 0, max: Math.floor(total / 1000), now: Math.floor(positionMs / 1000),
        text: `${timelineClock(positionMs)} / ${timelineClock(total)}${replayListSeparator(language)}${where}`,
      }}
      accessibilityActions={seekable ? [{ name: 'increment' }, { name: 'decrement' }] : []}
      onAccessibilityAction={onAction}
    >
      {/* The whole track, then the elapsed part over it from the reader's start. */}
      <View pointerEvents="none" testID={`${REPLAY_TIMELINE_TEST_ID}-track`}
        style={{ position: 'absolute', left: REPLAY_TIMELINE_INSET, right: REPLAY_TIMELINE_INSET, top: AXIS - RAIL / 2, height: RAIL, borderRadius: RAIL / 2, backgroundColor: palette.tertiary, opacity: REMAINING_OPACITY }} />
      {marks.map((ms) => (total > 0 && ms > 0 && ms < total ? (
        <View key={ms} pointerEvents="none" testID={`${REPLAY_TIMELINE_TEST_ID}-mark-${ms}`}
          style={{ position: 'absolute', [start]: at(ms / total) - NOTCH.width / 2, top: AXIS - NOTCH.height / 2, width: NOTCH.width, height: NOTCH.height, backgroundColor: palette.tertiary, opacity: NOTCH.opacity }} />
      ) : null))}
      {total > 0 ? (
        <>
          <View pointerEvents="none" testID={`${REPLAY_TIMELINE_TEST_ID}-elapsed`}
            style={{ position: 'absolute', [start]: REPLAY_TIMELINE_INSET, top: AXIS - RAIL / 2, height: RAIL, width: Math.max(0, at(shown) - REPLAY_TIMELINE_INSET), borderRadius: RAIL / 2, backgroundColor: palette.primary }} />
          <View pointerEvents="none" testID={`${REPLAY_TIMELINE_TEST_ID}-thumb`}
            style={{ position: 'absolute', [start]: at(shown) - thumb / 2, top: AXIS - thumb / 2, width: thumb, height: thumb, borderRadius: thumb / 2, backgroundColor: palette.primary }} />
        </>
      ) : null}
    </View>
  );

  return (
    <View testID="qandeel-replay-transport" accessibilityLanguage={language}>
      <View style={{ flexDirection: rowDirection, alignItems: 'center', columnGap: 4, minHeight: MIN_TARGET }}>
        {control}
        {seekable ? <GestureDetector gesture={gesture}>{line}</GestureDetector> : line}
        <View style={{ width: timeWidth, height: MIN_TARGET, justifyContent: 'center' }} accessible={false} importantForAccessibility="no-hide-descendants">
          <Text testID={`${REPLAY_TIMELINE_TEST_ID}-time`} numberOfLines={1}
            style={{ ...typeStyle('metadata'), color: palette.secondary, fontVariant: ['tabular-nums'], writingDirection: 'ltr', textAlign: end }}>
            {time}
          </Text>
        </View>
      </View>
      {/* One status line, always held (F-4): it appears and goes without moving anything. */}
      <View testID={`${REPLAY_TIMELINE_TEST_ID}-status`}
        style={{ height: Math.ceil(STATUS_LINE * fontScale), overflow: 'visible', justifyContent: 'center',
          [start === 'right' ? 'paddingRight' : 'paddingLeft']: MIN_TARGET + 4 + REPLAY_TIMELINE_INSET, direction: readerDirection(language) }}>
        {status}
      </View>
    </View>
  );
}
