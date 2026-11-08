/**
 * S8B-07 CP1-B (VA-10, Sheet A, Copy Gate R1.1 rows CL-01 … CL-11) — a finished call's record with its recording player
 * beneath it. The record itself is the S8B-06 J7 mark, unchanged and never interactive; this component only decides
 * whether it shows the length, and what sits under it:
 *
 *   PREPARING (A0)       the record without its length · the player, play not available · CL-10
 *   AVAILABLE (A1 – A6)  the record without its length · play / pause · the line · the time · CL-04 after 1 s without
 *                        audio · CL-05 when it cannot be played now
 *   the details (A11)    a tap on the time: CL-08 (the retention LIMIT, C-40's date) and CL-09 (the existing Replay entry)
 *   no longer (A7, A8)   the record with its length again · CL-06 / CL-07 only for the cause the server PROVES, otherwise
 *                        CL-11; this session only (a record first seen unavailable says nothing), announced once
 *
 * While a live call runs the control is refused with no text (V-21, V-34): the play does nothing. Nothing here is logged.
 */
import { useEffect, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';

import { Control, Glyph, readerDirection, readerSide, typeStyle, usePalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome/types';
import type { ConversationFinishedCallView } from '../runtime-entry';
import { formatDay } from '../settings/PrivacyDataSection';
import { AudioLine } from './AudioLine';
import type { CallListening } from './call-listening';
import { originalAudioText, type OriginalAudioCopyId } from './original-audio-copy';
import type { TransientPlaybackState } from './transient-playback';
import type { TransientUnavailableReason } from './transient-media-api';

export const CALL_LISTENING_TEST_ID = 'qandeel-call-listening';

/** CL-06 / CL-07 only for a proven cause; otherwise CL-11 (V-30). */
export function callEndedRow(reason: TransientUnavailableReason): OriginalAudioCopyId {
  return reason === 'EXPIRED' ? 'CL-06' : reason === 'DELETED' ? 'CL-07' : 'CL-11';
}

export type CallListeningView =
  /** No listening on this record: the S8B-06 record, unchanged. */
  | { readonly kind: 'RECORD' }
  | { readonly kind: 'PREPARING' }
  | { readonly kind: 'PLAYER'; readonly notice: 'CL-04' | 'CL-05' | null }
  | { readonly kind: 'NO_LONGER'; readonly row: OriginalAudioCopyId };

/** What the record shows, from the server's record and this session's player (pure; the views and the tests share it). */
export function callListeningView(call: ConversationFinishedCallView, engine: TransientPlaybackState, seenAvailable: boolean): CallListeningView {
  if (engine.phase === 'ENDED') return { kind: 'NO_LONGER', row: callEndedRow(engine.endedReason) };
  if (call.recordingStatus === undefined) return { kind: 'RECORD' };
  if (call.recordingStatus === 'UNAVAILABLE') {
    return seenAvailable ? { kind: 'NO_LONGER', row: callEndedRow(call.unavailableReason ?? null) } : { kind: 'RECORD' };
  }
  if (call.recordingStatus === 'PREPARING') return { kind: 'PREPARING' };
  if (engine.phase === 'FAILED') return { kind: 'PLAYER', notice: 'CL-05' };
  return { kind: 'PLAYER', notice: engine.phase === 'PREPARING' && engine.waiting ? 'CL-04' : null };
}

function Beneath({ language, children }: { readonly language: ChromeLanguage; readonly children: ReactNode }) {
  return <View style={{ alignSelf: 'stretch', paddingHorizontal: 24, alignItems: readerSide(language) === 'right' ? 'flex-end' : 'flex-start' }}>{children}</View>;
}

function Line({ id, language, tone = 'tertiary', live = false, testID }: {
  readonly id: OriginalAudioCopyId;
  readonly language: ChromeLanguage;
  readonly tone?: 'tertiary' | 'error';
  readonly live?: boolean;
  readonly testID: string;
}) {
  const palette = usePalette();
  return (
    <Text
      testID={testID}
      accessibilityLanguage={language}
      {...(live ? { accessibilityLiveRegion: 'polite' as const } : {})}
      style={{
        ...typeStyle(tone === 'error' ? 'supporting' : 'metadata'),
        color: tone === 'error' ? palette.error : palette.tertiary,
        textAlign: readerSide(language),
        writingDirection: readerDirection(language),
        marginTop: 2,
      }}
    >
      {originalAudioText(id, language)}
    </Text>
  );
}

export function CallRecordListening({ call, listening, record, language, onReplayEntry }: {
  readonly call: ConversationFinishedCallView;
  readonly listening: CallListening;
  /** The S8B-06 record (J7), with or without its length. */
  readonly record: (showLength: boolean) => ReactElement;
  readonly language: ChromeLanguage;
  /** CL-09: the existing Replay entry; absent, the act is not offered. */
  readonly onReplayEntry?: () => void;
}) {
  const palette = usePalette();
  const engine = listening.engineFor(call.callId);
  const state = useSyncExternalStore(engine.subscribe, engine.getState);
  const [open, setOpen] = useState(false);
  if (call.recordingStatus === 'AVAILABLE') listening.markAvailable(call.callId);
  const view = callListeningView(call, state, listening.wasAvailable(call.callId));
  const testID = `${CALL_LISTENING_TEST_ID}-${call.callId}`;
  const endedRow = view.kind === 'NO_LONGER' ? view.row : null;

  // D-05.3: the end is announced once, as it appears.
  useEffect(() => {
    if (endedRow !== null) AccessibilityInfo.announceForAccessibility(originalAudioText(endedRow, language));
  }, [endedRow, language]);

  if (view.kind === 'RECORD') return record(true);
  if (view.kind === 'NO_LONGER') {
    return (
      <View testID={testID}>
        {record(true)}
        <Beneath language={language}><Line id={view.row} language={language} testID={`${testID}-ended`} /></Beneath>
      </View>
    );
  }
  const callLength = Math.max(0, Date.parse(call.endedAt) - Date.parse(call.startedAt));
  const totalMs = state.runs?.[0]?.durationMs ?? callLength;
  const active = state.phase === 'PLAYING' || state.phase === 'PREPARING';
  const played = state.phase !== 'IDLE';
  const toggle = () => {
    if (active) engine.pause();
    else engine.play(0, state.positionMs);
  };
  const preparing = view.kind === 'PREPARING';
  return (
    <View testID={testID}>
      {record(false)}
      <Beneath language={language}>
        <View style={{ alignSelf: 'stretch' }}>
          <AudioLine
            language={language}
            testID={testID}
            totalMs={totalMs}
            positionMs={played ? state.positionMs : null}
            active={active}
            disabled={preparing}
            playLabel={originalAudioText('CL-01', language)}
            pauseLabel={originalAudioText('CL-02', language)}
            lineLabel={originalAudioText('CL-03', language)}
            onToggle={toggle}
            onSeek={(ms) => engine.seek(0, ms)}
            {...(preparing ? {} : { onTimePress: () => setOpen(!open), timeExpanded: open })}
          />
        </View>
        {preparing ? <Line id="CL-10" language={language} testID={`${testID}-preparing`} /> : null}
        {view.kind === 'PLAYER' && view.notice === 'CL-04' ? <Line id="CL-04" language={language} testID={`${testID}-waiting`} /> : null}
        {view.kind === 'PLAYER' && view.notice === 'CL-05' ? <Line id="CL-05" language={language} tone="error" live testID={`${testID}-failed`} /> : null}
        {open && !preparing ? (
          <View testID={`${testID}-details`} style={{ marginTop: 6 }}>
            {call.availableUntil ? (
              <Text accessibilityLanguage={language} style={{ ...typeStyle('metadata'), color: palette.secondary, textAlign: readerSide(language), writingDirection: readerDirection(language) }}>
                {originalAudioText('CL-08', language).replace('{date}', formatDay(call.availableUntil, language))}
              </Text>
            ) : null}
            {onReplayEntry === undefined ? null : (
              <Control
                palette={palette}
                language={language}
                accessibilityLabel={originalAudioText('CL-09', language)}
                onPress={onReplayEntry}
                testID={`${testID}-replay`}
                style={{ flexDirection: readerSide(language) === 'right' ? 'row-reverse' : 'row', alignItems: 'center', columnGap: 6, paddingHorizontal: 4 }}
              >
                <Glyph name="replay" color={palette.primary} direction={readerDirection(language)} />
                <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{originalAudioText('CL-09', language)}</Text>
              </Control>
            )}
          </View>
        ) : null}
      </Beneath>
    </View>
  );
}
