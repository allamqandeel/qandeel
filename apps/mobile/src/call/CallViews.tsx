/**
 * S8B-06 CP3 — the call's surfaces, read from the ONE call owner (G1.2, P4-C3, VPORT-02's CallRail A):
 *
 *   - **The entry:** P2's handset at the composer's END edge, beside the microphone, while there are no words to send.
 *   - **The call line:** CallRail A (mute, route, End) with the call time, in the Analysis's call-line box and above the
 *     Conversation's composer (D-05-07: writing stays available during a call). In normal operation it carries no state
 *     words; a line appears only for what is not normal — connecting (with the recording disclosure, CONNECTING only),
 *     reconnecting, held, and the 60-minute warnings. No speaking or listening indicator is drawn: the microphone's state
 *     and QANDEEL speaking are told to assistive technology only (one polite announcement, and the line's own value).
 *   - **The notice:** why a call did not start or stopped (J3), in the Conversation, with Open settings for the microphone.
 *   - **The record (J7):** a finished call's centred, non-interactive mark, «مكالمة صوتية · m:ss» (· «وقفت»), after the
 *     call's last turn, or at the thread's end for a call that left none.
 *   - **Interrupted:** a call reply the person cut is marked as cut (LC-15), never shown as complete.
 *
 * Every word is a Live Call copy row (`live-call-copy.ts`), every one PROPOSED until the Copy Gate decides.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactElement } from 'react';
import { AccessibilityInfo, Linking, Text, View } from 'react-native';

import { Control, Glyph, MIN_TARGET, readerDirection, readerSide, typeStyle, usePalette } from '../conversation';
import type { ConversationPalette, ConversationReplyCompanion } from '../conversation';
import { CallRail } from '../iconography';
import type { ChromeLanguage } from '../orientation-chrome/types';
import type { ConversationExchangeView } from '../runtime-entry';
import { liveCallScreenCopy, type LiveCallScreenCopy } from '../voice-call/live-call-copy';
import { callIdOfKey, type CallOwner, type CallOwnerState, type CallRecord } from './call-owner';

export const CALL_ENTRY_TEST_ID = 'qandeel-call-entry';
export const CALL_LINE_TEST_ID = 'qandeel-call-line';
export const CALL_NOTICE_TEST_ID = 'qandeel-call-notice';
export const CALL_RECORD_TEST_ID = 'qandeel-call-record';

/** The call's live states: the line is drawn and the entry is not. */
export function callIsLive(state: CallOwnerState): boolean {
  return state.stage !== 'IDLE' && state.stage !== 'PREPARING';
}

/** m:ss, Western digits in both scripts (the time is a number, not a word). */
export function formatCallLength(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
}

export function useCallOwnerState(owner: CallOwner | null): CallOwnerState | null {
  const subscribe = useCallback((listener: () => void) => (owner === null ? () => undefined : owner.subscribe(listener)), [owner]);
  return useSyncExternalStore(subscribe, () => (owner === null ? null : owner.getState()));
}

// ------------------------------------------------------------------------------------------------ the entry

export function CallEntryControl({ owner, language }: { readonly owner: CallOwner; readonly language: ChromeLanguage }) {
  const palette = usePalette();
  const copy = liveCallScreenCopy(language);
  const state = useCallOwnerState(owner)!;
  const preparing = state.stage === 'PREPARING';
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityLabel={copy.entryName}
      accessibilityState={{ busy: preparing }}
      onPress={() => {
        if (!preparing) void owner.start();
      }}
      testID={CALL_ENTRY_TEST_ID}
      style={{ width: MIN_TARGET, alignItems: 'center' }}
    >
      <Glyph name="call" color={palette.restInk} direction={readerDirection(language)} />
    </Control>
  );
}

// ------------------------------------------------------------------------------------------------ the call line

/** The one line of what is not normal, or null. The disclosure is CONNECTING's only (G1.2, VOICE_RECORDING_V3). */
export function callStatusLines(state: CallOwnerState, copy: LiveCallScreenCopy): readonly string[] {
  switch (state.stage) {
    case 'CONNECTING':
      return [copy.connecting, copy.disclosure];
    case 'RECONNECTING':
      return [copy.reconnecting];
    case 'HELD':
      return [copy.held];
    default:
      if (state.warning === 'T1') return [copy.warningT1];
      if (state.warning === 'T5') return [copy.warningT5];
      return [];
  }
}

function useCallClock(activeSince: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (activeSince === null) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeSince]);
  return activeSince === null ? null : Math.max(0, now - activeSince);
}

export function CallLine({ owner, language, palette: given }: { readonly owner: CallOwner; readonly language: ChromeLanguage; readonly palette?: ConversationPalette }) {
  // The surface the line sits on decides its palette: the Analysis's Dark family, or the Conversation's own.
  const own = usePalette();
  const palette = given ?? own;
  const state = useCallOwnerState(owner)!;
  const copy = liveCallScreenCopy(language);
  const elapsed = useCallClock(state.activeSince);
  const mine = readerSide(language);
  const direction = readerDirection(language);
  // The microphone's state is told once per change, politely, to assistive technology only (P4-C3 §5).
  const announced = useRef<boolean | null>(null);
  useEffect(() => {
    if (!callIsLive(state) || state.stage === 'CONNECTING') return;
    if (announced.current === state.muted) return;
    const first = announced.current === null;
    announced.current = state.muted;
    if (!first || state.muted) AccessibilityInfo.announceForAccessibility(state.muted ? copy.microphoneMuted : copy.microphoneOn);
  }, [state, copy.microphoneMuted, copy.microphoneOn]);
  if (!callIsLive(state)) return null;
  const lines = callStatusLines(state, copy);
  const assistiveValue = [state.muted ? copy.microphoneMuted : copy.microphoneOn, ...(state.audible ? [copy.speaking] : [])].join('. ');
  return (
    <View testID={CALL_LINE_TEST_ID} style={{ paddingTop: 6, paddingBottom: 6, backgroundColor: palette.field }}>
      {lines.length === 0 ? null : (
        <View testID={`${CALL_LINE_TEST_ID}:status`} style={{ paddingHorizontal: 20, paddingBottom: 4, alignItems: mine === 'right' ? 'flex-end' : 'flex-start' }}>
          {lines.map((line) => (
            <Text
              key={line}
              accessibilityLiveRegion="polite"
              accessibilityLanguage={language}
              style={{ ...typeStyle('supporting'), color: palette.secondary, textAlign: mine, writingDirection: direction }}
            >
              {line}
            </Text>
          ))}
        </View>
      )}
      <View style={{ flexDirection: mine === 'right' ? 'row' : 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 }}>
        <Text
          testID={`${CALL_LINE_TEST_ID}:time`}
          accessible
          accessibilityLabel={elapsed === null ? copy.connecting : copy.elapsedName(formatCallLength(elapsed))}
          accessibilityValue={{ text: assistiveValue }}
          accessibilityLanguage={language}
          style={{ ...typeStyle('metadata'), color: palette.secondary, fontVariant: ['tabular-nums'], paddingHorizontal: 6 }}
        >
          {elapsed === null ? '' : formatCallLength(elapsed)}
        </Text>
        <CallRail
          palette={palette}
          language={language}
          labels={{ mute: copy.mute, unmute: copy.unmute, route: copy.route, endCall: copy.endCall }}
          muted={state.muted}
          route={state.route}
          onToggleMute={() => owner.toggleMute()}
          onToggleRoute={() => owner.toggleRoute()}
          onEndCall={() => owner.end()}
        />
      </View>
    </View>
  );
}

// ------------------------------------------------------------------------------------------------ the notice

export function CallNoticeLine({ owner, language }: { readonly owner: CallOwner; readonly language: ChromeLanguage }) {
  const palette = usePalette();
  const state = useCallOwnerState(owner)!;
  const copy = liveCallScreenCopy(language);
  if (state.notice === null || callIsLive(state)) return null;
  const mine = readerSide(language);
  return (
    <View testID={CALL_NOTICE_TEST_ID} style={{ paddingHorizontal: 20, paddingBottom: 4, alignItems: mine === 'right' ? 'flex-end' : 'flex-start' }}>
      <Text
        accessibilityLiveRegion="polite"
        accessibilityLanguage={language}
        style={{ ...typeStyle('supporting'), color: palette.secondary, textAlign: mine, writingDirection: readerDirection(language) }}
      >
        {copy.notice[state.notice]}
      </Text>
      {state.notice === 'MIC_PERMISSION' ? (
        <Control palette={palette} language={language} accessibilityLabel={copy.openSettings} onPress={() => void Linking.openSettings()} testID={`${CALL_NOTICE_TEST_ID}:settings`} style={{ paddingHorizontal: 12 }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.openSettings}</Text>
        </Control>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------------------------------------ the record (J7)

export function CallRecordRow({ lengthMs, stopped, language }: { readonly lengthMs: number | null; readonly stopped: boolean; readonly language: ChromeLanguage }) {
  const palette = usePalette();
  const copy = liveCallScreenCopy(language);
  const parts = [copy.recordWord, ...(lengthMs === null ? [] : [formatCallLength(lengthMs)]), ...(stopped ? [copy.recordStopped] : [])];
  const name = lengthMs === null ? copy.recordWord : copy.recordSummary(formatCallLength(lengthMs));
  return (
    <View
      testID={CALL_RECORD_TEST_ID}
      accessible
      accessibilityLabel={stopped ? `${name}. ${copy.recordStopped}` : name}
      accessibilityLanguage={language}
      style={{ alignSelf: 'center', paddingVertical: 4 }}
    >
      <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, textAlign: 'center', writingDirection: readerDirection(language) }}>
        {parts.join(' · ')}
      </Text>
    </View>
  );
}

/** LC-15: a call reply the person cut. Never interactive; never "complete". */
function InterruptedMark({ turnId, language }: { readonly turnId: string; readonly language: ChromeLanguage }) {
  const palette = usePalette();
  return (
    <Text testID={`qandeel-call-interrupted-${turnId}`} accessibilityLanguage={language} style={{ ...typeStyle('metadata'), color: palette.tertiary }}>
      {liveCallScreenCopy(language).interrupted}
    </Text>
  );
}

// ------------------------------------------------------------------------------------------------ the slots

export interface CallSurfaceSlots {
  /** The handset, at the composer's END edge (null while a call is live). */
  readonly composerEnd: ReactElement | null;
  /** Above the composer: the call line while live, the notice after. */
  readonly aboveComposer: ReactElement | null;
  readonly exchangeTrailer: (exchange: ConversationExchangeView) => ReactElement | null;
  readonly replyCompanion: (exchange: ConversationExchangeView) => ConversationReplyCompanion | null;
  /** The record of a call that left no turn. */
  readonly threadTail: ReactElement | null;
  readonly depthNameSuffix: string | null;
  readonly live: boolean;
}

/** The call a turn belongs to: the history's own field, or the server's `live-call:` key. */
export function callIdOf(exchange: ConversationExchangeView): string | null {
  return exchange.liveCall?.callId ?? callIdOfKey(exchange.userTurn.idempotencyKey);
}

export function useCallSurface(
  owner: CallOwner | null,
  exchanges: readonly ConversationExchangeView[],
  language: ChromeLanguage,
): CallSurfaceSlots {
  const state = useCallOwnerState(owner);
  const copy = liveCallScreenCopy(language);
  const live = state !== null && callIsLive(state);
  // The last turn of each call in the loaded thread carries its record (one per call).
  const lastOfCall = useMemo(() => {
    const last = new Map<string, string>();
    for (const exchange of exchanges) {
      const callId = callIdOf(exchange);
      if (callId !== null) last.set(callId, exchange.userTurn.id);
    }
    return last;
  }, [exchanges]);
  const record: CallRecord | null = state?.record ?? null;
  const currentCallId = state?.callId ?? null;
  const exchangeTrailer = useCallback((exchange: ConversationExchangeView): ReactElement | null => {
    const callId = callIdOf(exchange);
    if (callId === null || callId === currentCallId || lastOfCall.get(callId) !== exchange.userTurn.id) return null;
    const known = record !== null && record.callId === callId ? record : null;
    const lengthMs = exchange.liveCall?.lengthMs ?? known?.lengthMs ?? null;
    return <CallRecordRow lengthMs={lengthMs} stopped={known?.stopped === true} language={language} />;
  }, [currentCallId, lastOfCall, record, language]);
  const replyCompanion = useCallback((exchange: ConversationExchangeView): ConversationReplyCompanion | null => {
    if (exchange.deliveryState !== 'INTERRUPTED' || exchange.reply === null) return null;
    return {
      text: null,
      control: <InterruptedMark turnId={exchange.userTurn.id} language={language} />,
    };
  }, [language]);
  if (owner === null || state === null) {
    return { composerEnd: null, aboveComposer: null, exchangeTrailer, replyCompanion, threadTail: null, depthNameSuffix: null, live: false };
  }
  const tailRecord = record !== null && !lastOfCall.has(record.callId) ? <CallRecordRow lengthMs={record.lengthMs} stopped={record.stopped} language={language} /> : null;
  return {
    composerEnd: live ? null : <CallEntryControl owner={owner} language={language} />,
    aboveComposer: live ? <CallLine owner={owner} language={language} /> : <CallNoticeLine owner={owner} language={language} />,
    exchangeTrailer,
    replyCompanion,
    threadTail: tailRecord,
    depthNameSuffix: live ? copy.continuesSuffix : null,
    live,
  };
}
