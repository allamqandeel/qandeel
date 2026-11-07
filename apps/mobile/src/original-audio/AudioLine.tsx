/**
 * S8B-07 CP1-B (Sheet A row A1 … A5, Sheet B's moment line) — one recording's play control, line and time, drawn in the
 * language of the S8B-03 voice message line (P2's spine and VPORT-02's `Aperture`), for audio this component does not
 * own: it shows a position and reports a reader's act, and nothing else. No waveform, no thumb, no notch.
 *
 *   the control   P2 `play` / `pause`, 20 px in a 44 pt target, named by the caller's approved row with the length; while
 *                 not available, the same mark in tertiary ink, still focusable and announced as not enabled
 *   the line      adjustable (the caller's approved name, value «m:ss / m:ss»), a tap or a drag moves the position;
 *                 the accessible increment / decrement steps as the voice message's does (1 s, or 5 s from 30 s)
 *   the time      the position (or the length before any play), tabular, Western digits in an LTR island; when the caller
 *                 gives `onTimePress`, the quiet act that opens the details (A11)
 */
import { useCallback, useMemo, useState } from 'react';
import { Text, View, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Control, Glyph, MIN_TARGET, readerDirection, readerSide, typeStyle, usePalette } from '../conversation';
import { Aperture, P2_SPINE } from '../iconography';
import type { ChromeLanguage } from '../orientation-chrome/types';
import { voiceNoteSeekStepMs } from '../voice-note/VoiceNoteViews';
import { lengthText } from './original-audio-copy';

const APERTURE_HALF = P2_SPINE.aperture.halfWidth;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export interface AudioLineProps {
  readonly language: ChromeLanguage;
  readonly testID: string;
  readonly totalMs: number;
  /** The played position, or null before any play here. */
  readonly positionMs: number | null;
  /** The control shows pause (playing, or asked to play and preparing). */
  readonly active: boolean;
  /** Nothing can be played now (A0): the mark only, announced as not enabled. */
  readonly disabled: boolean;
  readonly playLabel: string;
  readonly pauseLabel: string;
  readonly lineLabel: string;
  readonly onToggle: () => void;
  readonly onSeek: (positionMs: number) => void;
  readonly onTimePress?: () => void;
  readonly timeExpanded?: boolean;
  readonly timeLabel?: string;
  /** False: the line and the time only; the play control is someone else's (a Replay moment's line, B2). Default true. */
  readonly control?: boolean;
}

export function AudioLine(props: AudioLineProps) {
  const { language, testID, totalMs, positionMs, active, disabled, onSeek } = props;
  const palette = usePalette();
  const [width, setWidth] = useState(0);
  const [preview, setPreview] = useState<number | null>(null);
  const start = readerSide(language);
  const writing = readerDirection(language);
  const played = positionMs !== null;
  const fraction = played && totalMs > 0 ? clamp01(positionMs / totalMs) : 0;
  const run = Math.max(0, width - 2 * APERTURE_HALF);
  const at = (f: number) => APERTURE_HALF + f * run;
  const seekable = !disabled && totalMs > 0;
  const rowDirection = start === 'right' ? 'row-reverse' : 'row';

  const gesture = useMemo(() => {
    const fractionAt = (x: number): number | null => {
      if (run <= 0) return null;
      const logical = start === 'right' ? width - x : x;
      return clamp01((logical - APERTURE_HALF) / run);
    };
    const commit = (x: number) => {
      const f = fractionAt(x);
      if (f !== null) onSeek(Math.round(f * totalMs));
    };
    const drag = Gesture.Pan()
      .runOnJS(true)
      .withTestId(`${testID}-line-drag`)
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
      .withTestId(`${testID}-line-tap`)
      .enabled(seekable)
      .onEnd((event, success) => {
        if (success) commit(event.x);
      });
    return Gesture.Race(drag, tap);
  }, [run, width, start, totalMs, seekable, testID, onSeek]);

  const onAction = useCallback((event: AccessibilityActionEvent) => {
    const by = voiceNoteSeekStepMs(totalMs);
    const step = event.nativeEvent.actionName === 'increment' ? by : event.nativeEvent.actionName === 'decrement' ? -by : 0;
    if (step !== 0) onSeek(Math.min(totalMs, Math.max(0, (positionMs ?? 0) + step)));
  }, [onSeek, positionMs, totalMs]);

  const control = disabled ? (
    <View
      testID={`${testID}-play-unavailable`}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${props.playLabel} ${lengthText(totalMs)}`}
      accessibilityLanguage={language}
      accessibilityState={{ disabled: true }}
      style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' }}
    >
      <Glyph name="play" color={palette.tertiary} direction={writing} />
    </View>
  ) : (
    <Control
      palette={palette}
      language={language}
      accessibilityLabel={`${active ? props.pauseLabel : props.playLabel} ${lengthText(totalMs)}`}
      onPress={props.onToggle}
      testID={`${testID}-play`}
      style={{ width: MIN_TARGET, alignItems: 'center' }}
    >
      <Glyph name={active ? 'pause' : 'play'} color={palette.primary} direction={writing} />
    </Control>
  );

  const line = (
    <View
      testID={`${testID}-line`}
      onLayout={(event: LayoutChangeEvent) => setWidth(Math.floor(event.nativeEvent.layout.width))}
      style={{ flex: 1, minWidth: 48, height: MIN_TARGET }}
      {...(seekable
        ? {
          accessible: true,
          accessibilityRole: 'adjustable' as const,
          accessibilityLabel: props.lineLabel,
          accessibilityLanguage: language,
          accessibilityValue: {
            min: 0, max: Math.floor(totalMs / 1000), now: Math.floor((positionMs ?? 0) / 1000),
            text: `${lengthText(positionMs ?? 0)} / ${lengthText(totalMs)}`,
          },
          accessibilityActions: [{ name: 'increment' }, { name: 'decrement' }],
          onAccessibilityAction: onAction,
        }
        : { accessible: false, importantForAccessibility: 'no-hide-descendants' as const })}
    >
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: P2_SPINE.axisY - P2_SPINE.spine.strokeWidth / 2, height: P2_SPINE.spine.strokeWidth, backgroundColor: palette.tertiary, opacity: P2_SPINE.spine.opacity }} />
      {played ? (
        <>
          <View
            testID={`${testID}-line-heard`}
            pointerEvents="none"
            style={{ position: 'absolute', [start]: 0, top: P2_SPINE.axisY - P2_SPINE.aperture.committed.strokeWidth / 2, width: at(fraction), height: P2_SPINE.aperture.committed.strokeWidth, borderRadius: 1, backgroundColor: palette.primary }}
          />
          <Aperture kind="COMMITTED" testID={`${testID}-line-position`} ink={palette.primary} ground={palette.utterance} style={{ position: 'absolute', top: 0, [start]: at(fraction) - APERTURE_HALF }} />
        </>
      ) : null}
      {preview === null ? null : (
        <Aperture kind="PREVIEW" testID={`${testID}-line-preview`} ink={palette.primary} ground={palette.utterance} style={{ position: 'absolute', top: 0, [start]: at(preview) - APERTURE_HALF }} />
      )}
    </View>
  );

  const shownMs = preview !== null ? Math.round(preview * totalMs) : played ? positionMs : totalMs;
  const time = (
    <Text style={{ ...typeStyle('metadata'), minWidth: 34, color: played || preview !== null ? palette.primary : palette.secondary, fontVariant: ['tabular-nums'], writingDirection: 'ltr', textAlign: start === 'right' ? 'left' : 'right' }}>
      {lengthText(shownMs)}
    </Text>
  );

  return (
    <View style={{ flexDirection: rowDirection, alignItems: 'center', columnGap: 4 }}>
      {props.control === false ? null : control}
      {seekable ? <GestureDetector gesture={gesture}>{line}</GestureDetector> : line}
      {props.onTimePress === undefined ? (
        <View accessible={false} style={{ minHeight: MIN_TARGET, justifyContent: 'center' }}>{time}</View>
      ) : (
        <Control
          palette={palette}
          language={language}
          accessibilityLabel={props.timeLabel ?? `${props.lineLabel} ${lengthText(totalMs)}`}
          accessibilityState={{ expanded: props.timeExpanded === true }}
          onPress={props.onTimePress}
          testID={`${testID}-more`}
          style={{ alignItems: 'center', justifyContent: 'center' }}
        >
          {time}
        </Control>
      )}
    </View>
  );
}
