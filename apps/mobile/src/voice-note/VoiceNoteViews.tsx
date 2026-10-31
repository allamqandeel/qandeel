/**
 * S8B-03 (CP2) — what a Voice Note shows in the conversation. The drawings, sizes and weights are P2's final iconography
 * (P2 closure §3, §4, §8; P2-A inventory §2, geometry spec), through the approved `Glyph` renderer; the composition is
 * P4-C3's (§1 the voice message, §3 the recording line; P4 Final Closure §6); the behaviour and every word are the S8B-03
 * contract's.
 *
 *   VoiceNoteMicEntry     P2 `mic` at 24 px in rest ink at the line's END slot, only while Voice Notes are offered;
 *   VoiceNoteCaptureLine  the FIELD line while recording: START P2 `mic` 20 px · «جارٍ التسجيل» · m:ss; Hugeicons Free
 *                         `close` (cancel, rest ink) at the inner slot; P2 `send` (primary) at the END slot;
 *   VoiceConsentPanel     the consent, before the first note: every approved row (C-01 … C-11), then the two decisions;
 *   VoiceNoteTail         drafts and notes not yet in the conversation, each in the same slab, with the line its state needs;
 *   VoiceNoteBody         a committed Voice Note turn: the reader's own UTTERANCE slab holding P2 `play` / `pause` (20 px in a
 *                         44 pt target), the line in the Temporal Spine's language (heard part, the Parting at the
 *                         position, seek by tap, drag or the accessible adjust), and the time — nothing else.
 *
 * What is not always true is not always shown: the availability date, the text and deleting the recording are behind the
 * slab itself (a tap, named and with its expanded state), and a state's approved line appears only while that state
 * holds. There is no level meter, no waveform, no pulse and no recording dot. Times are tabular Western digits, an LTR
 * island inside Arabic. Every act is a tap; nothing needs a long press. Targets are 44 pt.
 */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import { Linking, ScrollView, Text, View, useWindowDimensions, type AccessibilityActionEvent, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Control, Glyph, MIN_TARGET, readerDirection, readerSide, typeStyle, usePalette, type ConversationPalette } from '../conversation';
import { Aperture, P2_SPINE } from '../iconography';
import type { ChromeLanguage } from '../orientation-chrome';
import type { ConversationExchangeView, ConversationVoiceNoteView } from '../runtime-entry';
import { formatDay } from '../settings/PrivacyDataSection';
import { VOICE_NOTE_MAX_DURATION_MS } from './voice-note-limits';
import { availableUntilText, voiceNotePair, voiceNoteText } from './voice-note-copy';
import type { VoiceDraftRecord } from './voice-draft-store';
import type { VoiceNoteItem } from './voice-note-controller';
import type { VoiceNoteSession } from './voice-note-session';

/** P4-C3 §1: a fixed calm width; length is never encoded as width. */
export const VOICE_NOTE_SLAB_WIDTH = 292;
/** P4-C3 §1: `min(100% − 40, 292)`. */
const SLAB_END_INSET = 40;
/** The thread's gutter the reader's slab bleeds across to the screen edge (G1.1 §3). */
const THREAD_GUTTER = 24;
/** P4-C3 §3: the inner slot sits 8 pt inside the END slot, and the recording line stops 8 pt before it. */
const SLOT_GAP = 8;
/**
 * The consent screen's share of the window. Device proof (HONOR, Android 15, default font scale) found half the window
 * left the last approved row below the fold while «أوافق وأتابع» was already visible; three quarters shows every row
 * there, and a larger font scale still scrolls.
 */
const CONSENT_HEIGHT_SHARE = 0.75;

/** m:ss, Western digits. */
export function durationText(ms: number | null): string {
  const seconds = Math.max(0, Math.floor((ms ?? 0) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Whether a committed note's recording can be played, and if not, which approved line says why: past its period
 * (C-37), or deleted (C-38) — the server keeps a deleted recording's period, so a period not yet over means deleted.
 */
export function voiceNoteRest(note: ConversationVoiceNoteView, now: Date): 'PLAYABLE' | 'EXPIRED' | 'DELETED' {
  if (note.available) return 'PLAYABLE';
  if (note.availableUntil !== null && Date.parse(note.availableUntil) <= now.getTime()) return 'EXPIRED';
  return 'DELETED';
}

function useSession(session: VoiceNoteSession) {
  const own = useSyncExternalStore(session.subscribe, session.getState);
  const capture = useSyncExternalStore(session.capture.subscribe, session.capture.getState);
  const notes = useSyncExternalStore(session.notes.subscribe, session.notes.getState);
  const playback = useSyncExternalStore(session.playback.subscribe, session.playback.getState);
  return { own, capture, notes, playback };
}

/** A row laid from the reader's START edge. */
function rowFor(language: ChromeLanguage): 'row' | 'row-reverse' {
  return readerSide(language) === 'right' ? 'row-reverse' : 'row';
}

function Line({ text, language, palette, tone = 'secondary', testID }: {
  readonly text: string;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly tone?: 'secondary' | 'error';
  readonly testID?: string;
}) {
  return (
    <Text
      testID={testID}
      accessibilityLiveRegion="polite"
      accessibilityLanguage={language}
      style={{ ...typeStyle('supporting'), color: tone === 'error' ? palette.error : palette.secondary, textAlign: readerSide(language), writingDirection: readerDirection(language), marginTop: 6 }}
    >
      {text}
    </Text>
  );
}

function TextAct({ label, onPress, language, palette, testID, busy = false }: {
  readonly label: string;
  readonly onPress: () => void;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly testID: string;
  readonly busy?: boolean;
}) {
  return (
    <Control palette={palette} language={language} accessibilityLabel={label} onPress={onPress} testID={testID} accessibilityState={busy ? { busy: true } : undefined} style={{ paddingHorizontal: 12 }}>
      <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{label}</Text>
    </Control>
  );
}

/** A row of acts laid from the reader's START edge. */
function Acts({ language, children }: { readonly language: ChromeLanguage; readonly children: ReactNode }) {
  return <View style={{ flexDirection: rowFor(language), flexWrap: 'wrap', alignItems: 'center' }}>{children}</View>;
}

// ------------------------------------------------------------------------------------------------ the line's end

/** P2-A inventory §2 "Voice Note: record entry": P2 `mic`, 24 px, rest ink, at the END slot. Named C-13. */
export function VoiceNoteMicEntry({ session, language }: { readonly session: VoiceNoteSession; readonly language: ChromeLanguage }) {
  const palette = usePalette();
  return (
    <Control palette={palette} language={language} accessibilityLabel={voiceNoteText('C-13', language)} onPress={() => void session.begin()} testID="qandeel-voice-note-mic" style={{ width: MIN_TARGET, alignItems: 'center' }}>
      <Glyph name="mic" color={palette.restInk} direction={readerDirection(language)} />
    </Control>
  );
}

/** Whether the composition should hand the composer's end the microphone. */
export function voiceNoteOffered(session: VoiceNoteSession): boolean {
  const own = session.getState();
  const capture = session.capture.getState().kind;
  return own.offered && own.sheet === null && (capture === 'IDLE' || capture === 'PERMISSION_DENIED');
}

/** Whether the composition should hand the composer's place to the capture line or the consent. */
export function voiceNoteHoldsField(session: VoiceNoteSession): boolean {
  const kind = session.capture.getState().kind;
  return session.getState().sheet !== null || kind === 'STARTING' || kind === 'RECORDING' || kind === 'STOPPING';
}

// ------------------------------------------------------------------------------------------------ the capture line

/**
 * P4-C3 §3 in the 64 pt FIELD line: from START 20 pt, P2 `mic` 20 px in primary ink · C-14 (primary) · the elapsed time
 * (secondary, tabular), stopping 8 pt before the inner slot; Hugeicons Free `close` (rest ink, named C-15) in the inner
 * slot; P2 `send` (primary, named C-16) in the END slot. The two acts G1.2 already has — no stop or review step.
 */
export function VoiceNoteCaptureLine({ session, language }: { readonly session: VoiceNoteSession; readonly language: ChromeLanguage }) {
  const palette = usePalette();
  const { capture } = useSession(session);
  const start = readerSide(language);
  const writing = readerDirection(language);
  const recording = capture.kind === 'RECORDING';
  const elapsed = capture.kind === 'RECORDING' ? Math.min(capture.elapsedMs, VOICE_NOTE_MAX_DURATION_MS) : 0;
  return (
    <View testID="qandeel-voice-note-capture" style={{ height: MIN_TARGET, flexDirection: rowFor(language), alignItems: 'center' }}>
      <View
        accessible
        accessibilityLabel={`${voiceNoteText('C-14', language)} ${durationText(elapsed)}`}
        accessibilityLanguage={language}
        style={{ flex: 1, height: MIN_TARGET, flexDirection: rowFor(language), alignItems: 'center', columnGap: 10, overflow: 'hidden', [start === 'right' ? 'marginRight' : 'marginLeft']: 6, [start === 'right' ? 'marginLeft' : 'marginRight']: SLOT_GAP }}
      >
        <Glyph name="micRecording" color={palette.primary} direction={writing} />
        <Text numberOfLines={1} style={{ ...typeStyle('action'), color: palette.primary, writingDirection: writing }}>{voiceNoteText('C-14', language)}</Text>
        <Text style={{ ...typeStyle('action'), color: palette.secondary, fontVariant: ['tabular-nums'], writingDirection: 'ltr' }}>{durationText(elapsed)}</Text>
      </View>
      <Control palette={palette} language={language} accessibilityLabel={voiceNoteText('C-15', language)} onPress={() => void session.cancel()} testID="qandeel-voice-note-cancel" style={{ width: MIN_TARGET, alignItems: 'center' }}>
        <Glyph name="close" color={palette.restInk} direction={writing} />
      </Control>
      <View style={{ width: SLOT_GAP }} />
      <Control palette={palette} language={language} accessibilityLabel={voiceNoteText('C-16', language)} onPress={() => { if (recording) void session.send(); }} testID="qandeel-voice-note-send" accessibilityState={recording ? undefined : { busy: true }} style={{ width: MIN_TARGET, alignItems: 'center' }}>
        <Glyph name="send" color={palette.primary} direction={writing} />
      </Control>
    </View>
  );
}

// ------------------------------------------------------------------------------------------------ the consent

/**
 * C-01 … C-11, exactly the rows the server holds for the current version (verified before they are shown). The title
 * (C-01) heads the screen; every body row (C-02 … C-09) is set as its own paragraph and scrolls when the screen is short;
 * the two decisions stand apart beneath them, «أوافق وأتابع» (C-10) as the one prominent act, «ليس الآن» (C-11) beside it
 * as the quiet one. No row is hidden, shortened or reworded.
 */
export function VoiceConsentPanel({ session, language, maxHeight }: { readonly session: VoiceNoteSession; readonly language: ChromeLanguage; readonly maxHeight: number }) {
  const palette = usePalette();
  const { own } = useSession(session);
  const sheet = own.sheet;
  if (sheet === null) return null;
  const side = readerSide(language);
  const writing = readerDirection(language);
  if (sheet.phase !== 'READY') {
    // Loading says nothing; rows we cannot vouch for are not shown and no consent is asked (only C-11 to leave).
    return (
      <View testID="qandeel-voice-consent" style={{ minHeight: 64, justifyContent: 'center' }}>
        {sheet.phase === 'UNAVAILABLE' ? (
          <Acts language={language}>
            <TextAct label={voiceNoteText('C-11', language)} onPress={session.decline} language={language} palette={palette} testID="qandeel-voice-consent-decline" />
          </Acts>
        ) : null}
      </View>
    );
  }
  const [title, ...body] = sheet.rows.slice(0, 9);
  const agree = sheet.rows[9];
  const decline = sheet.rows[10];
  return (
    <View testID="qandeel-voice-consent" style={{ paddingHorizontal: 6 }}>
      <ScrollView style={{ maxHeight }} contentContainerStyle={{ paddingTop: 6, paddingBottom: 12 }}>
        <Text accessibilityRole="header" accessibilityLanguage={language} style={{ ...typeStyle('statement'), color: palette.primary, textAlign: side, writingDirection: writing, marginBottom: 14 }}>
          {title[language]}
        </Text>
        {body.map((row) => (
          <Text key={row.id} testID={`qandeel-voice-consent-${row.id}`} accessibilityLanguage={language} style={{ ...typeStyle('supporting'), color: palette.primary, textAlign: side, writingDirection: writing, marginTop: 10 }}>
            {row[language]}
          </Text>
        ))}
      </ScrollView>
      <View style={{ height: 1, backgroundColor: palette.tertiary, opacity: 0.4, marginBottom: 12 }} />
      <Control
        palette={palette}
        language={language}
        accessibilityLabel={agree[language]}
        onPress={() => void session.agree()}
        accessibilityState={sheet.granting ? { busy: true } : undefined}
        testID="qandeel-voice-consent-agree"
        style={{ minHeight: 48, alignItems: 'center', paddingHorizontal: 16, backgroundColor: palette.world, opacity: sheet.granting ? 0.6 : 1 }}
      >
        <Text style={{ ...typeStyle('action'), color: palette.primary, writingDirection: writing }}>{agree[language]}</Text>
      </Control>
      <Control palette={palette} language={language} accessibilityLabel={decline[language]} onPress={session.decline} testID="qandeel-voice-consent-decline" style={{ alignItems: 'center', paddingHorizontal: 16, marginTop: 4 }}>
        <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: writing }}>{decline[language]}</Text>
      </Control>
    </View>
  );
}

// ------------------------------------------------------------------------------------------------ the media slab

/**
 * The reader's UTTERANCE slab as P4-C3 §1 draws it for a voice message: attached to the reader's edge across the thread's
 * gutter, rounded only on its inward corners, `min(100% − 40, 292)` wide, 6 pt above and below, 14 pt at START and 20 pt at
 * END, its parts 6 pt apart from START to END.
 */
function VoiceSlab({ language, contentWidth, testID, children }: {
  readonly language: ChromeLanguage;
  readonly contentWidth: number;
  readonly testID?: string;
  readonly children: ReactNode;
}) {
  const palette = usePalette();
  const right = readerSide(language) === 'right';
  return (
    <View
      testID={testID}
      style={{
        width: Math.min(Math.max(0, contentWidth - SLAB_END_INSET), VOICE_NOTE_SLAB_WIDTH),
        backgroundColor: palette.utterance,
        paddingVertical: 6,
        flexDirection: rowFor(language),
        alignItems: 'center',
        columnGap: 6,
        ...(right
          ? { marginRight: -THREAD_GUTTER, paddingRight: 14, paddingLeft: 20, borderTopLeftRadius: 18, borderBottomLeftRadius: 18 }
          : { marginLeft: -THREAD_GUTTER, paddingLeft: 14, paddingRight: 20, borderTopRightRadius: 18, borderBottomRightRadius: 18 }),
      }}
    >
      {children}
    </View>
  );
}

/** P2's Parting aperture is 34 wide: its centre never comes closer than half of that to either end of the line. */
const APERTURE_HALF = P2_SPINE.aperture.halfWidth;
/**
 * An accessible increment / decrement moves the position by one step, always inside the recording (PO decision, S8B-03
 * CP2): one second for a message shorter than 30 seconds, five seconds for one of 30 seconds or more.
 */
export const VOICE_NOTE_SHORT_SEEK_STEP_MS = 1000;
export const VOICE_NOTE_LONG_SEEK_STEP_MS = 5000;
export const VOICE_NOTE_LONG_RECORDING_MS = 30_000;

export function voiceNoteSeekStepMs(totalMs: number): number {
  return totalMs < VOICE_NOTE_LONG_RECORDING_MS ? VOICE_NOTE_SHORT_SEEK_STEP_MS : VOICE_NOTE_LONG_SEEK_STEP_MS;
}

const NO_PREVIEW = () => undefined;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * The voice message's line, in the language of QANDEEL's Temporal Spine (P2 closure §7, drawn by VPORT-02's own
 * `Aperture`, as the S7-04 Replay draws it) — simplified for one recording in the conversation:
 *
 *   the line      P2's spine: a 1 pt hairline in tertiary ink at the spine's opacity, through the 44 pt band's axis;
 *   heard         the same line from START to the stored position, in primary ink at the committed parting's 1.5 pt;
 *   position      the committed Parting — the line itself opening, with its mark — at the stored position, once played;
 *   moving        while a finger moves along the line, the lighter preview Parting (no mark) follows it 1:1; the release
 *                 moves the note there, and a touch that is cancelled moves nothing.
 *
 * No notch (a recording has no Moments), no Live edge, no detached thumb, no waveform. Without a recording that can be
 * played here (`recordingId` null) it is the line alone and takes no touch.
 */
function VoiceLine({ session, recordingId, totalMs, language, testID, preview, onPreview }: {
  readonly session: VoiceNoteSession;
  readonly recordingId: string | null;
  readonly totalMs: number;
  readonly language: ChromeLanguage;
  readonly testID: string;
  readonly preview: number | null;
  readonly onPreview: (fraction: number | null) => void;
}) {
  const palette = usePalette();
  const { playback } = useSession(session);
  const [width, setWidth] = useState(0);
  const start = readerSide(language);
  const position = recordingId === null ? undefined : playback.positions[recordingId];
  const played = position !== undefined;
  const fraction = played && totalMs > 0 ? clamp01(position / totalMs) : 0;
  const run = Math.max(0, width - 2 * APERTURE_HALF);
  const at = (f: number) => APERTURE_HALF + f * run;
  const seekable = recordingId !== null && totalMs > 0;

  const gesture = useMemo(() => {
    // x is measured from the view's left edge; the line runs START → END.
    const fractionAt = (x: number): number | null => {
      if (run <= 0) return null;
      const logical = start === 'right' ? width - x : x;
      return clamp01((logical - APERTURE_HALF) / run);
    };
    const commit = (x: number) => {
      const f = fractionAt(x);
      if (recordingId !== null && f !== null) void session.playback.seek(recordingId, f * totalMs);
    };
    // A drag along the line (a vertical move stays the conversation's scroll): the preview follows, the release commits.
    const drag = Gesture.Pan()
      .runOnJS(true)
      .withTestId(`${testID}-line-drag`)
      .enabled(seekable)
      .activeOffsetX([-8, 8])
      .failOffsetY([-12, 12])
      .onStart((event) => onPreview(fractionAt(event.x)))
      .onUpdate((event) => onPreview(fractionAt(event.x)))
      .onEnd((event, success) => {
        if (success) commit(event.x);
      })
      .onFinalize(() => onPreview(null));
    // A tap on the line moves the note there.
    const tap = Gesture.Tap()
      .runOnJS(true)
      .withTestId(`${testID}-line-tap`)
      .enabled(seekable)
      .onEnd((event, success) => {
        if (success) commit(event.x);
      });
    return Gesture.Race(drag, tap);
  }, [run, width, start, recordingId, totalMs, seekable, session, testID, onPreview]);

  const onAction = useCallback((event: AccessibilityActionEvent) => {
    if (recordingId === null) return;
    const by = voiceNoteSeekStepMs(totalMs);
    const step = event.nativeEvent.actionName === 'increment' ? by : event.nativeEvent.actionName === 'decrement' ? -by : 0;
    if (step !== 0) void session.playback.seek(recordingId, Math.min(totalMs, Math.max(0, (position ?? 0) + step)));
  }, [recordingId, session, totalMs, position]);

  const line = (
    <View
      testID={`${testID}-line`}
      onLayout={(event: LayoutChangeEvent) => setWidth(Math.floor(event.nativeEvent.layout.width))}
      style={{ flex: 1, minWidth: 48, height: MIN_TARGET }}
      {...(seekable
        ? {
          accessible: true,
          accessibilityRole: 'adjustable' as const,
          accessibilityLabel: voiceNoteText('C-13', language),
          accessibilityLanguage: language,
          accessibilityValue: { min: 0, max: Math.floor(totalMs / 1000), now: Math.floor((position ?? 0) / 1000), text: `${durationText(position ?? 0)} / ${durationText(totalMs)}` },
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
  return seekable ? <GestureDetector gesture={gesture}>{line}</GestureDetector> : line;
}

function SlabTime({ ms, played, language }: { readonly ms: number | null; readonly played: boolean; readonly language: ChromeLanguage }) {
  const palette = usePalette();
  return (
    <Text style={{ ...typeStyle('metadata'), minWidth: 34, color: played ? palette.primary : palette.secondary, fontVariant: ['tabular-nums'], writingDirection: 'ltr', textAlign: readerSide(language) === 'right' ? 'left' : 'right' }}>
      {durationText(ms)}
    </Text>
  );
}

/**
 * One quiet act in the slab (the time; or, for an expired or deleted recording, its line): it names the voice message
 * and its length (C-13), says whether its details are open, and on a tap opens or closes them beneath the slab. Nothing
 * in it is drawn as a button.
 */
function Disclosure({ name, open, onToggle, language, testID, children, flex = true }: {
  readonly name: string;
  readonly open: boolean;
  readonly onToggle: () => void;
  readonly language: ChromeLanguage;
  readonly testID: string;
  readonly children: ReactNode;
  readonly flex?: boolean;
}) {
  const palette = usePalette();
  return (
    <Control palette={palette} language={language} accessibilityLabel={name} accessibilityState={{ expanded: open }} onPress={onToggle} testID={testID} style={{ ...(flex ? { flex: 1 } : {}), flexDirection: rowFor(language), alignItems: 'center', justifyContent: 'center', columnGap: 6 }}>
      {children}
    </Control>
  );
}

/**
 * P4-C3 §1's one media control: P2 `play` / `pause` at P2's 20 px (inventory §2) in a 44 pt target, primary ink, named by
 * C-34 with the length. A note not yet playable here (still sending or converting, or a draft) shows the same mark in the
 * one availability ink, as P2 shows a control that is not available (board 11), and is not a control.
 */
function PlayControl({ session, recordingId, total, language, testID }: {
  readonly session: VoiceNoteSession;
  readonly recordingId: string | null;
  readonly total: number;
  readonly language: ChromeLanguage;
  readonly testID: string;
}) {
  const palette = usePalette();
  const { playback } = useSession(session);
  const writing = readerDirection(language);
  if (recordingId === null) {
    return (
      <View accessible={false} importantForAccessibility="no-hide-descendants" testID={`${testID}-play-unavailable`} style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' }}>
        <Glyph name="play" color={palette.tertiary} direction={writing} />
      </View>
    );
  }
  const current = playback.current?.recordingId === recordingId ? playback.current.phase : null;
  const playing = current === 'PLAYING' || current === 'LOADING';
  const [playName, pauseName] = voiceNotePair('C-34', language);
  return (
    <Control palette={palette} language={language} accessibilityLabel={`${playing ? pauseName : playName} ${durationText(total)}`} onPress={() => void session.playback.toggle(recordingId)} testID={`${testID}-play`} style={{ width: MIN_TARGET, alignItems: 'center' }}>
      <Glyph name={playing ? 'pause' : 'play'} color={palette.primary} direction={writing} />
    </Control>
  );
}

/**
 * The media row of a playable recording: play / pause · the line (seek) · the time. The time is the quiet act that opens
 * the details beneath the slab; while a finger moves along the line it shows where the note would go.
 */
function MediaRow({ session, recordingId, durationMs, language, testID, open, onToggle }: {
  readonly session: VoiceNoteSession;
  readonly recordingId: string;
  readonly durationMs: number | null;
  readonly language: ChromeLanguage;
  readonly testID: string;
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  const { playback } = useSession(session);
  const [preview, setPreview] = useState<number | null>(null);
  const position = playback.positions[recordingId];
  const played = position !== undefined;
  const total = durationMs ?? 0;
  const shown = preview !== null ? Math.round(preview * total) : played ? position : total;
  return (
    <>
      <PlayControl session={session} recordingId={recordingId} total={total} language={language} testID={testID} />
      <VoiceLine session={session} recordingId={recordingId} totalMs={total} language={language} testID={testID} preview={preview} onPreview={setPreview} />
      <Disclosure name={`${voiceNoteText('C-13', language)} ${durationText(total)}`} open={open} onToggle={onToggle} language={language} testID={`${testID}-more`} flex={false}>
        <SlabTime ms={shown} played={played || preview !== null} language={language} />
      </Disclosure>
    </>
  );
}

/** C-41 → C-42 with C-43: the consequence is read before the one destructive act. */
function DeleteRecording({ session, recordingId, language, testID }: {
  readonly session: VoiceNoteSession;
  readonly recordingId: string;
  readonly language: ChromeLanguage;
  readonly testID: string;
}) {
  const palette = usePalette();
  const [phase, setPhase] = useState<'REST' | 'CONFIRM' | 'DELETING'>('REST');
  const [deleteLabel, cancelLabel] = voiceNotePair('C-43', language);
  if (phase === 'REST') {
    return <TextAct label={voiceNoteText('C-41', language)} onPress={() => setPhase('CONFIRM')} language={language} palette={palette} testID={`${testID}-delete`} />;
  }
  return (
    <View testID={`${testID}-delete-confirm`} style={{ width: '100%' }}>
      <Line text={voiceNoteText('C-42', language)} language={language} palette={palette} />
      <Acts language={language}>
        <TextAct
          label={deleteLabel}
          busy={phase === 'DELETING'}
          onPress={() => {
            if (phase === 'DELETING') return;
            setPhase('DELETING');
            void session.deleteRecording(recordingId).then((outcome) => {
              if (outcome !== 'DELETED') setPhase('CONFIRM');
            });
          }}
          language={language}
          palette={palette}
          testID={`${testID}-delete-yes`}
        />
        <TextAct label={cancelLabel} onPress={() => setPhase('REST')} language={language} palette={palette} testID={`${testID}-delete-no`} />
      </Acts>
    </View>
  );
}

/** Beneath the slab, on the reader's edge: what was asked for, or what the state needs said. */
function Beneath({ language, children }: { readonly language: ChromeLanguage; readonly children: ReactNode }) {
  return <View style={{ alignSelf: readerSide(language) === 'right' ? 'flex-end' : 'flex-start', maxWidth: VOICE_NOTE_SLAB_WIDTH, marginTop: 2 }}>{children}</View>;
}

// ------------------------------------------------------------------------------------------------ the committed turn

/**
 * A committed Voice Note turn (P4-C3 §1). The slab holds only the media row. Its details — C-40 (the availability date),
 * C-35 (the text, with C-36) and C-41 (delete) — open beneath it on a tap of the slab. C-39 appears only when playing
 * failed. An expired (C-37) or deleted (C-38) recording says so in the slab, with no play; its text stays reachable.
 */
export function VoiceNoteBody({ session, note, transcript, language, contentWidth, now = () => new Date() }: {
  readonly session: VoiceNoteSession;
  readonly note: ConversationVoiceNoteView;
  readonly transcript: string;
  readonly language: ChromeLanguage;
  readonly contentWidth: number;
  readonly now?: () => Date;
}) {
  const palette = usePalette();
  const { playback } = useSession(session);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const rest = voiceNoteRest(note, now());
  const side = readerSide(language);
  const writing = readerDirection(language);
  const testID = `qandeel-voice-note-${note.recordingId}`;
  const [showLabel, hideLabel] = voiceNotePair('C-35', language);
  const failed = playback.current?.recordingId === note.recordingId && playback.current.phase === 'FAILED';
  const toggle = () => setOpen(!open);
  return (
    <View testID={testID} style={{ alignItems: side === 'right' ? 'flex-end' : 'flex-start' }}>
      <VoiceSlab language={language} contentWidth={contentWidth}>
        {rest === 'PLAYABLE' ? (
          <MediaRow session={session} recordingId={note.recordingId} durationMs={note.durationMs} language={language} testID={testID} open={open} onToggle={toggle} />
        ) : (
          // Expired or deleted: no control, no focus stop for playing — only what is true, said once; the text stays.
          <Disclosure name={voiceNoteText(rest === 'EXPIRED' ? 'C-37' : 'C-38', language)} open={open} onToggle={toggle} language={language} testID={`${testID}-more`}>
            <Text testID={`${testID}-${rest === 'EXPIRED' ? 'expired' : 'deleted'}`} style={{ ...typeStyle('supporting'), flex: 1, color: palette.secondary, textAlign: side, writingDirection: writing }}>
              {voiceNoteText(rest === 'EXPIRED' ? 'C-37' : 'C-38', language)}
            </Text>
          </Disclosure>
        )}
      </VoiceSlab>
      {failed ? <Beneath language={language}><Line text={voiceNoteText('C-39', language)} language={language} palette={palette} tone="error" testID={`${testID}-play-failed`} /></Beneath> : null}
      {open ? (
        <Beneath language={language}>
          <View testID={`${testID}-details`}>
            {rest === 'PLAYABLE' && note.availableUntil !== null ? (
              <Text accessibilityLanguage={language} style={{ ...typeStyle('metadata'), color: palette.secondary, textAlign: side, writingDirection: writing, marginTop: 6 }}>
                {availableUntilText(language, formatDay(note.availableUntil, language))}
              </Text>
            ) : null}
            <Acts language={language}>
              <Control palette={palette} language={language} accessibilityLabel={shown ? hideLabel : showLabel} accessibilityRole="togglebutton" accessibilityState={{ checked: shown }} onPress={() => setShown(!shown)} testID={`${testID}-text`} style={{ paddingHorizontal: 12 }}>
                <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{shown ? hideLabel : showLabel}</Text>
              </Control>
              {rest === 'PLAYABLE' ? <DeleteRecording session={session} recordingId={note.recordingId} language={language} testID={testID} /> : null}
            </Acts>
            {shown ? (
              <View testID={`${testID}-transcript`}>
                <Text accessibilityLanguage={language} style={{ ...typeStyle('metadata'), color: palette.secondary, textAlign: side, writingDirection: writing }}>{voiceNoteText('C-36', language)}</Text>
                <Text selectable style={{ ...typeStyle('body'), color: palette.primary, textAlign: side, writingDirection: writing, marginTop: 4 }}>{transcript}</Text>
              </View>
            ) : null}
          </View>
        </Beneath>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------------------------------------ the tail

const STOP_LINE: Record<NonNullable<VoiceDraftRecord['stoppedBy']>, string | null> = {
  USER: null,
  LEFT_SCREEN: 'C-17',
  INTERRUPTION: 'C-18',
  LIMIT: 'C-19',
};

/**
 * A draft on this device (not yet the server's): the same slab at rest, its play not available here, and beneath it
 * the line its state needs (C-17 / C-18 / C-19 why it stopped, C-24 sending, C-25 not sent, C-31, C-32) and its acts —
 * send (P2 `send`, C-16) or try again (C-26), and delete the draft (C-20). While it is sending there is nothing to do.
 */
function DraftRow({ session, item, language, contentWidth }: {
  readonly session: VoiceNoteSession;
  readonly item: Extract<VoiceNoteItem, { kind: 'DRAFT' }>;
  readonly language: ChromeLanguage;
  readonly contentWidth: number;
}) {
  const palette = usePalette();
  const { draft, phase } = item;
  const testID = `qandeel-voice-draft-${draft.draftId}`;
  const stopLine = draft.stoppedBy === null ? null : STOP_LINE[draft.stoppedBy];
  const line =
    phase === 'SENDING' ? 'C-24'
      : phase === 'NOT_SENT' || phase === 'REFUSED' ? 'C-25'
        : phase === 'GATE_CLOSED' ? 'C-31'
          : phase === 'CONSENT_REQUIRED' ? 'C-32'
            : stopLine;
  const canSend = phase !== 'SENDING' && phase !== 'REFUSED';
  return (
    <View testID={testID} style={{ marginTop: 28, alignItems: readerSide(language) === 'right' ? 'flex-end' : 'flex-start' }}>
      <VoiceSlab language={language} contentWidth={contentWidth}>
        <PlayControl session={session} recordingId={null} total={draft.durationMs ?? 0} language={language} testID={testID} />
        <View accessible accessibilityLabel={`${voiceNoteText('C-13', language)} ${durationText(draft.durationMs)}`} accessibilityLanguage={language} style={{ flex: 1, flexDirection: rowFor(language), alignItems: 'center', columnGap: 6 }}>
          <VoiceLine session={session} recordingId={null} totalMs={0} language={language} testID={testID} preview={null} onPreview={NO_PREVIEW} />
          <SlabTime ms={draft.durationMs} played={false} language={language} />
        </View>
      </VoiceSlab>
      <Beneath language={language}>
        {line === null ? null : <Line text={voiceNoteText(line, language)} language={language} palette={palette} tone={phase === 'NOT_SENT' || phase === 'REFUSED' ? 'error' : 'secondary'} testID={`${testID}-line`} />}
        {phase === 'SENDING' ? null : (
          <Acts language={language}>
            {canSend ? (
              phase === 'NOT_SENT'
                ? <TextAct label={voiceNoteText('C-26', language)} onPress={() => void session.sendDraft(draft.draftId)} language={language} palette={palette} testID={`${testID}-retry`} />
                : (
                  <Control palette={palette} language={language} accessibilityLabel={voiceNoteText('C-16', language)} onPress={() => void session.sendDraft(draft.draftId)} testID={`${testID}-send`} style={{ width: MIN_TARGET, alignItems: 'center' }}>
                    <Glyph name="send" color={palette.primary} direction={readerDirection(language)} />
                  </Control>
                )
            ) : null}
            <TextAct label={voiceNoteText('C-20', language)} onPress={() => void session.notes.deleteDraft(draft.draftId)} language={language} palette={palette} testID={`${testID}-delete`} />
          </Acts>
        )}
      </Beneath>
    </View>
  );
}

const NOTE_LINE: Record<Extract<VoiceNoteItem, { kind: 'NOTE' }>['phase'], string> = {
  PROCESSING: 'C-27',
  RETRYABLE: 'C-28',
  FINAL: 'C-29',
  NO_SPEECH: 'C-30',
  HELD_CONSENT: 'C-33',
  GATE_CLOSED: 'C-31',
};

/**
 * An accepted note not yet in the conversation: the same slab, and beneath it the one line its state needs. While it is
 * still being converted it is not yet the reader's to play or delete here (the turn will be); once settled its media row
 * plays and its slab opens C-41, and a retryable failure offers C-26.
 */
function NoteRow({ session, item, language, contentWidth }: {
  readonly session: VoiceNoteSession;
  readonly item: Extract<VoiceNoteItem, { kind: 'NOTE' }>;
  readonly language: ChromeLanguage;
  readonly contentWidth: number;
}) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const testID = `qandeel-voice-pending-${item.recordingId}`;
  const settled = item.phase !== 'PROCESSING' && item.phase !== 'GATE_CLOSED';
  return (
    <View testID={testID} style={{ marginTop: 28, alignItems: readerSide(language) === 'right' ? 'flex-end' : 'flex-start' }}>
      <VoiceSlab language={language} contentWidth={contentWidth}>
        {settled ? (
          <MediaRow session={session} recordingId={item.recordingId} durationMs={item.durationMs} language={language} testID={testID} open={open} onToggle={() => setOpen(!open)} />
        ) : (
          <>
            <PlayControl session={session} recordingId={null} total={item.durationMs ?? 0} language={language} testID={testID} />
            <View accessible accessibilityLabel={`${voiceNoteText('C-13', language)} ${durationText(item.durationMs)}`} accessibilityLanguage={language} style={{ flex: 1, flexDirection: rowFor(language), alignItems: 'center', columnGap: 6 }}>
              <VoiceLine session={session} recordingId={null} totalMs={0} language={language} testID={testID} preview={null} onPreview={NO_PREVIEW} />
              <SlabTime ms={item.durationMs} played={false} language={language} />
            </View>
          </>
        )}
      </VoiceSlab>
      <Beneath language={language}>
        <Line text={voiceNoteText(NOTE_LINE[item.phase], language)} language={language} palette={palette} tone={item.phase === 'RETRYABLE' || item.phase === 'FINAL' ? 'error' : 'secondary'} testID={`${testID}-line`} />
        <Acts language={language}>
          {item.phase === 'RETRYABLE' && item.canRetry ? (
            <TextAct label={voiceNoteText('C-26', language)} onPress={() => void session.notes.retryNote(item.recordingId)} language={language} palette={palette} testID={`${testID}-retry`} />
          ) : null}
          {settled && open ? <DeleteRecording session={session} recordingId={item.recordingId} language={language} testID={testID} /> : null}
        </Acts>
      </Beneath>
    </View>
  );
}

/** Notices, drafts and notes of this Session that are not (yet) turns — after the committed thread. */
export function VoiceNoteTail({ session, language, contentWidth }: { readonly session: VoiceNoteSession; readonly language: ChromeLanguage; readonly contentWidth: number }) {
  const palette = usePalette();
  const { own, notes } = useSession(session);
  if (own.notice === null && !notes.unrecoverable && notes.items.length === 0) return null;
  return (
    <View testID="qandeel-voice-note-tail">
      {notes.items.map((item) =>
        item.kind === 'DRAFT'
          ? <DraftRow key={item.draft.draftId} session={session} item={item} language={language} contentWidth={contentWidth} />
          : <NoteRow key={item.recordingId} session={session} item={item} language={language} contentWidth={contentWidth} />,
      )}
      {notes.unrecoverable ? <View style={{ marginTop: 16 }}><Line text={voiceNoteText('C-23', language)} language={language} palette={palette} tone="error" testID="qandeel-voice-draft-unrecoverable" /></View> : null}
      {own.notice === 'PERMISSION_DENIED' ? (
        <View testID="qandeel-voice-note-permission-denied" style={{ marginTop: 16 }}>
          <Line text={voiceNoteText('C-21', language)} language={language} palette={palette} />
          <Acts language={language}>
            <TextAct label={voiceNoteText('C-22', language)} onPress={() => void Linking.openSettings()} language={language} palette={palette} testID="qandeel-voice-note-open-settings" />
          </Acts>
        </View>
      ) : null}
      {own.notice === 'GATE_CLOSED' ? <View style={{ marginTop: 16 }}><Line text={voiceNoteText('C-31', language)} language={language} palette={palette} testID="qandeel-voice-note-unavailable" /></View> : null}
    </View>
  );
}

// ------------------------------------------------------------------------------------------------ the composition seam

export interface VoiceNoteSurfaceSlots {
  readonly composerEnd: ReactElement | null;
  readonly composerOverride: ReactElement | null;
  readonly threadTail: ReactElement | null;
  readonly utteranceBody: (exchange: ConversationExchangeView) => ReactElement | null;
}

/**
 * What the composition hands the Conversation surface's neutral slots, for one Voice Note session (or none, outside the
 * Personal world). `inFront` is whether the conversation screen is what the reader sees: when it is not, a capture
 * stops and is kept (C-17) and playback pauses. The Session's drafts and notes are restored once.
 */
export function useVoiceNoteSurface(session: VoiceNoteSession | null, language: ChromeLanguage, inFront: boolean): VoiceNoteSurfaceSlots {
  const { height, width } = useWindowDimensions();
  const contentWidth = Math.max(0, width - 2 * THREAD_GUTTER);
  const subscribe = useCallback((listener: () => void) => {
    if (session === null) return () => undefined;
    const a = session.subscribe(listener);
    const b = session.capture.subscribe(listener);
    return () => {
      a();
      b();
    };
  }, [session]);
  const key = useSyncExternalStore(subscribe, () => (session === null ? 'NONE' : `${voiceNoteOffered(session)}:${voiceNoteHoldsField(session)}:${session.getState().sheet !== null}`));
  useEffect(() => {
    if (session !== null) void session.restore();
  }, [session]);
  useEffect(() => {
    if (session !== null && !inFront) void session.leave();
  }, [session, inFront]);
  const utteranceBody = useCallback(
    (exchange: ConversationExchangeView) =>
      session === null || exchange.voiceNote === undefined ? null : (
        <VoiceNoteBody session={session} note={exchange.voiceNote} transcript={exchange.userTurn.content} language={language} contentWidth={contentWidth} />
      ),
    [session, language, contentWidth],
  );
  if (session === null) return { composerEnd: null, composerOverride: null, threadTail: null, utteranceBody };
  const [offered, holds, sheet] = key.split(':').map((part) => part === 'true');
  return {
    composerEnd: offered ? <VoiceNoteMicEntry session={session} language={language} /> : null,
    composerOverride: !holds ? null : sheet
      ? <VoiceConsentPanel session={session} language={language} maxHeight={Math.round(height * CONSENT_HEIGHT_SHARE)} />
      : <VoiceNoteCaptureLine session={session} language={language} />,
    threadTail: <VoiceNoteTail session={session} language={language} contentWidth={contentWidth} />,
    utteranceBody,
  };
}
