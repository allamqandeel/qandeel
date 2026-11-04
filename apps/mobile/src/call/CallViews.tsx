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
 *     call's last turn, or at its end's place in the thread for a call that left none. Its length and «وقفت» are the
 *     server's durable record (R3, 0193: ended − started, and an end the person did not choose), so they survive a
 *     restart; the phone's own count stands only for the call it just saw end, until a read carries the record.
 *   - **Interrupted:** a call reply the person cut is marked as cut (its own Copy Gate row), never shown as complete.
 *
 * Every word is a Live Call copy row (`live-call-copy.ts`), every one PROPOSED until the Copy Gate decides.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactElement } from 'react';
import { AccessibilityInfo, Linking, Text, View } from 'react-native';

import { Control, Glyph, MIN_TARGET, readerDirection, readerSide, typeStyle, usePalette } from '../conversation';
import type { ConversationPalette, ConversationReplyCompanion } from '../conversation';
import { CallRail } from '../iconography';
import type { ChromeLanguage } from '../orientation-chrome/types';
import type { ConversationExchangeView, ConversationFinishedCallView } from '../runtime-entry';
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
    // The first second shows 0:00 (the time is never earlier than the call); the clock's next tick reads the real time.
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

/** The interrupted mark: a call reply the person cut. Never interactive; never "complete". */
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
  /** S8B-06 CP3 R3: the records of finished calls that ended before the first loaded exchange (null: none). */
  readonly threadHead: ReactElement | null;
  /** The record of a call that left no turn. */
  readonly threadTail: ReactElement | null;
  readonly depthNameSuffix: string | null;
  readonly live: boolean;
}

/** The call a turn belongs to, from the server's own `live-call:` key (null for an ordinary turn). */
export function callIdOf(exchange: ConversationExchangeView): string | null {
  return callIdOfKey(exchange.userTurn.idempotencyKey);
}

/** S8B-06 CP3 R3: what the record of one call says. The server's record (its own instants and end reason) stands first. */
interface RecordFacts {
  readonly lengthMs: number | null;
  readonly stopped: boolean;
}

const NO_CALLS: readonly ConversationFinishedCallView[] = Object.freeze([]);
const instant = (iso: string): number => Date.parse(iso);

/** The server's finished-call record (0193): its length is the server's ended − started; it stopped unless the person ended it. */
function serverFacts(call: ConversationFinishedCallView): RecordFacts {
  return { lengthMs: Math.max(0, instant(call.endedAt) - instant(call.startedAt)), stopped: call.endReason !== 'USER_ENDED' };
}

export function useCallSurface(
  owner: CallOwner | null,
  exchanges: readonly ConversationExchangeView[],
  language: ChromeLanguage,
  // S8B-06 CP3 R3: the finished calls the history carried, from the server's durable record (oldest to newest by their end).
  calls: readonly ConversationFinishedCallView[] = NO_CALLS,
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
  // R3: a finished call that left no turn in the loaded thread is drawn at its end's place: after the last exchange that
  // began before it ended, or before the first exchange (or alone, in an empty thread). Its place comes from the server's
  // instants; the call that is live now is never drawn as finished.
  const placed = useMemo(() => {
    const server = new Map(calls.map((call) => [call.callId, call]));
    const after = new Map<string, ConversationFinishedCallView[]>();
    const head: ConversationFinishedCallView[] = [];
    for (const call of calls) {
      if (lastOfCall.has(call.callId) || call.callId === currentCallId) continue;
      const end = instant(call.endedAt);
      let at: string | null = null;
      for (const exchange of exchanges) {
        if (instant(exchange.userTurn.createdAt) <= end) at = exchange.userTurn.id;
        else break;
      }
      if (at === null) head.push(call);
      else after.set(at, [...(after.get(at) ?? []), call]);
    }
    return { server, after, head };
  }, [calls, exchanges, lastOfCall, currentCallId]);
  const factsOf = useCallback((callId: string): RecordFacts => {
    const known = placed.server.get(callId);
    if (known !== undefined) return serverFacts(known);
    // The call this runtime just saw end, until a read carries the server's record of it.
    if (record !== null && record.callId === callId) return { lengthMs: record.lengthMs, stopped: record.stopped };
    return { lengthMs: null, stopped: false };
  }, [placed, record]);
  const recordRow = useCallback((callId: string): ReactElement => {
    const facts = factsOf(callId);
    return <CallRecordRow key={callId} lengthMs={facts.lengthMs} stopped={facts.stopped} language={language} />;
  }, [factsOf, language]);
  const exchangeTrailer = useCallback((exchange: ConversationExchangeView): ReactElement | null => {
    const callId = callIdOf(exchange);
    const own = callId !== null && callId !== currentCallId && lastOfCall.get(callId) === exchange.userTurn.id ? [callId] : [];
    const later = (placed.after.get(exchange.userTurn.id) ?? []).map((call) => call.callId);
    const rows = [...own, ...later];
    if (rows.length === 0) return null;
    return rows.length === 1 ? recordRow(rows[0]) : <>{rows.map(recordRow)}</>;
  }, [currentCallId, lastOfCall, placed, recordRow]);
  const replyCompanion = useCallback((exchange: ConversationExchangeView): ConversationReplyCompanion | null => {
    if (exchange.deliveryState !== 'INTERRUPTED' || exchange.reply === null) return null;
    return {
      text: null,
      control: <InterruptedMark turnId={exchange.userTurn.id} language={language} />,
    };
  }, [language]);
  const head = placed.head;
  const threadHead = head.length === 0 || exchanges.length === 0 ? null : <>{head.map((call) => recordRow(call.callId))}</>;
  // An empty thread draws its finished calls at the tail, oldest first; then the call this runtime just saw end, when no
  // read has carried its record yet and it left no turn.
  const tailCalls = exchanges.length === 0 ? head.map((call) => call.callId) : [];
  if (record !== null && !lastOfCall.has(record.callId) && !placed.server.has(record.callId)) tailCalls.push(record.callId);
  const threadTail = tailCalls.length === 0 ? null : <>{tailCalls.map(recordRow)}</>;
  if (owner === null || state === null) {
    return { composerEnd: null, aboveComposer: null, exchangeTrailer, replyCompanion, threadHead, threadTail, depthNameSuffix: null, live: false };
  }
  return {
    composerEnd: live ? null : <CallEntryControl owner={owner} language={language} />,
    aboveComposer: live ? <CallLine owner={owner} language={language} /> : <CallNoticeLine owner={owner} language={language} />,
    exchangeTrailer,
    replyCompanion,
    threadHead,
    threadTail,
    depthNameSuffix: live ? copy.continuesSuffix : null,
    live,
  };
}
