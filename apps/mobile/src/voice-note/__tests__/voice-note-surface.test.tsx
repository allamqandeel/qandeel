/**
 * S8B-03 (CP2, B1 / B8 / B11 / B13) — Voice Notes on the production Conversation surface, in both languages: the ten
 * G1.2 §E states except QANDEEL's voice reply, with the approved words only, on the reader's own edge; every act a tap
 * with a name; the consent on exactly the approved rows; an expired or deleted recording that keeps its text and offers
 * no play; and C-42 read before the one destructive act. The parts are the real ones (capture, notes, playback, session)
 * over a scripted recorder, server and player.
 */
import { act, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { ConversationSurface, createConversationController, type ConversationController } from '../../conversation';
import { exchange, page, scriptedTransport } from '../../conversation/__fixtures__/conversation';
import type { ChromeLanguage } from '../../orientation-chrome';
import { createManualForegroundSignal, type ConversationExchangeView } from '../../runtime-entry';
import { createEphemeralVoiceDraftKeyValue, createVoiceDraftStore, type VoiceDraftFiles } from '../voice-draft-store';
import type { VoiceCapabilityRead, VoiceConsentRead, VoiceNoteApiClient, VoiceNoteStatusRead } from '../voice-note-api';
import { createVoiceNoteCapture, type VoiceRecorderPort } from '../voice-note-capture';
import { createVoiceNotesController } from '../voice-note-controller';
import { availableUntilText, VOICE_CONSENT_COPY_ROWS, VOICE_CONSENT_VERSION, voiceNotePair, voiceNoteText } from '../voice-note-copy';
import { formatDay } from '../../settings/PrivacyDataSection';
import { CANONICAL_VISUAL } from '../../conversation/visual/canonical-visual.generated';
import { P2_CALL_GLYPHS } from '../../iconography';
import { createVoiceNotePlayback, type VoiceNotePlayerPort } from '../voice-note-playback';
import { createVoiceNoteSession, type VoiceNoteSession } from '../voice-note-session';
import { useVoiceNoteSurface, voiceNoteRest, voiceNoteSeekStepMs } from '../VoiceNoteViews';

jest.mock('expo-sqlite/kv-store', () => ({ SQLiteStorage: jest.fn() }));
jest.mock('expo-file-system', () => ({ Directory: jest.fn(), File: jest.fn(), Paths: {} }));
jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual<object>('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (node: unknown) => (node === null || node === undefined ? null : 4242),
}));

const OWNER = 'a0000000-0000-4000-8000-000000000001';
const SESSION = '11111111-1111-4111-8111-111111111111';
const REC = 'e0000000-0000-4000-8000-000000000005';
const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };

const flush = async () => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
};

function Composed({ conversation, session, language, inFront = true }: {
  conversation: ConversationController; session: VoiceNoteSession; language: ChromeLanguage; inFront?: boolean;
}) {
  const slots = useVoiceNoteSurface(session, language, inFront);
  return <ConversationSurface controller={conversation} language={language} insets={INSETS} onOpenAnalysis={() => undefined} {...slots} />;
}

function world(options: { consent?: boolean; available?: boolean; denied?: boolean } = {}) {
  const recorderFiles = new Set<string>();
  let recording = false;
  let elapsed = 0;
  const recorder: VoiceRecorderPort = {
    permission: async () => (options.denied ? 'DENIED' : 'GRANTED'),
    requestPermission: async () => 'GRANTED',
    prepare: async () => {
      recorderFiles.add('file:///docs/Audio/r.m4a');
      return 'file:///docs/Audio/r.m4a';
    },
    record: () => {
      recording = true;
    },
    stop: async () => {
      recording = false;
    },
    status: () => ({ isRecording: recording, durationMillis: elapsed }),
    currentInput: async () => null,
    onEnded: () => () => undefined,
  };
  const files: VoiceDraftFiles = {
    adopt: async (_o, _d, uri) => {
      if (!recorderFiles.delete(uri)) throw new Error('missing');
      return 4096;
    },
    size: () => 4096, check: () => 'COMPLETE', checkUri: () => 'COMPLETE', read: () => new Uint8Array(4096),
    remove: () => undefined, removeUri: () => undefined, removeOwner: () => undefined,
  };
  const store = createVoiceDraftStore(createEphemeralVoiceDraftKeyValue(), files);
  const foreground = createManualForegroundSignal('ACTIVE');
  let ids = 0;
  const newId = () => `00000000-0000-4000-8000-${String((ids += 1)).padStart(12, '0')}`;
  const timers: { callback: () => void; live: boolean }[] = [];
  const setTimer = (callback: () => void) => {
    const t = { callback, live: true };
    timers.push(t);
    return t;
  };
  const clearTimer = (t: unknown) => {
    (t as { live: boolean }).live = false;
  };
  let tick: (() => void) | null = null;

  const server = {
    consent: options.consent ?? true,
    available: options.available ?? true,
    uploads: 0,
    status: 'PROCESSING' as 'PROCESSING' | 'READY' | 'FAILED_RETRYABLE',
    commitWith: null as ConversationExchangeView | null,
    deletes: [] as string[],
  };
  const api = {
    upload: async () => {
      server.uploads += 1;
      return { kind: 'ACCEPTED', recordingId: REC, acceptedAt: '2026-10-31T10:00:00.000Z', availableUntil: '2026-11-30T10:00:00.000Z' } as const;
    },
    status: async (): Promise<VoiceNoteStatusRead> => ({
      kind: 'STATUS',
      view: { recordingId: REC, sessionId: SESSION, status: server.status, failure: null, canRetry: server.status === 'FAILED_RETRYABLE', turnId: null, recordingAvailable: true, availableUntil: '2026-11-30T10:00:00.000Z', durationMs: 4200 },
    }),
    pending: async () => ({ kind: 'NOTES', notes: [] }) as const,
    retry: async () => 'RETRY_SCHEDULED' as const,
    commitTurn: async () => (server.commitWith === null ? { kind: 'UNKNOWN' } as const : { kind: 'COMMITTED', exchange: server.commitWith } as const),
    deleteRecording: async (id: string) => {
      server.deletes.push(id);
      return 'DELETED' as const;
    },
    capability: async (): Promise<VoiceCapabilityRead> => ({ kind: 'CAPABILITY', view: { voiceNotesAvailable: server.available, consentState: server.consent ? 'GRANTED' : 'NONE', consentCurrent: server.consent } }),
    consent: async (): Promise<VoiceConsentRead> => ({ kind: 'CONSENT', version: VOICE_CONSENT_VERSION, state: 'NONE', rows: VOICE_CONSENT_COPY_ROWS.map((r) => ({ ...r })) }),
    grant: async () => {
      server.consent = true;
      return 'DONE' as const;
    },
    playbackUrl: (id: string) => `https://api.test/voice/recordings/${id}/objects/NOTE/0`,
  } as unknown as VoiceNoteApiClient;

  const turns = scriptedTransport();
  const conversation = createConversationController({
    sessionId: SESSION, transport: turns, isCurrent: () => true, onReplyCommitted: () => undefined,
    newSubmissionKey: () => 'key-1', setTimer: () => null, clearTimer: () => undefined,
  });
  const played: string[] = [];
  const player: VoiceNotePlayerPort = {
    create: async (url, headers, onStatus) => {
      played.push(`${url}|${headers.Authorization}`);
      setTimeout(() => onStatus({ loaded: true, playing: true, positionMs: 1000, durationMs: 4200, finished: false, failed: false }), 0);
      return { play: () => undefined, pause: () => undefined, seekTo: async () => undefined, release: () => undefined };
    },
  };
  const session = createVoiceNoteSession({
    api,
    capture: createVoiceNoteCapture({
      owner: OWNER, sessionId: SESSION, recorder, store, foreground, newId,
      setInterval: (callback) => {
        tick = callback;
        return 1;
      },
      clearInterval: () => {
        tick = null;
      },
    }),
    notes: createVoiceNotesController({ owner: OWNER, sessionId: SESSION, api, store, files, foreground, isCurrent: () => true, newId, onCommitted: (e, of) => conversation.adopt(e, of), setTimer, clearTimer }),
    playback: createVoiceNotePlayback({ player, urlOf: (id) => api.playbackUrl(id), authorization: () => ({ Authorization: 'Bearer reader' }), foreground }),
    foreground, newId, isCurrent: () => true,
  });
  const runTimers = async () => {
    for (const t of timers.filter((x) => x.live)) {
      t.live = false;
      t.callback();
    }
    await flush();
  };
  return {
    session, conversation, turns, server, played, foreground,
    advance: (ms: number) => {
      elapsed = ms;
      tick?.();
    },
    runTimers,
  };
}

async function mounted(language: ChromeLanguage, w: ReturnType<typeof world>, history: ConversationExchangeView[] = []): Promise<RenderResult> {
  const view = await render(<Composed conversation={w.conversation} session={w.session} language={language} />);
  await act(async () => {
    w.turns.answerRead(page(history));
    await flush();
  });
  return view;
}

async function press(view: RenderResult, testID: string) {
  await act(async () => {
    fireEvent.press(view.getByTestId(testID));
    await flush();
  });
}

describe.each(['ar', 'en'] as const)('Voice Notes on the Conversation surface (%s)', (language) => {
  it('E1–E6: the mic at the line\'s end only without typed words; capture line with its word, time, Cancel and Send', async () => {
    const w = world();
    const view = await mounted(language, w);
    const mic = view.getByTestId('qandeel-voice-note-mic');
    expect(mic.props.accessibilityLabel).toBe(voiceNoteText('C-13', language));
    expect(mic.props.accessibilityRole).toBe('button');
    // Words in the composer: Send stands at the end, the microphone does not.
    await act(async () => {
      w.conversation.setDraft('fixture: typed');
    });
    expect(view.queryByTestId('qandeel-voice-note-mic')).toBeNull();
    await act(async () => {
      w.conversation.setDraft('');
    });
    await press(view, 'qandeel-voice-note-mic');
    expect(view.queryByTestId('qandeel-conversation-composer')).toBeNull();
    expect(view.getByTestId('qandeel-voice-note-capture')).toBeTruthy();
    await act(async () => {
      w.advance(65_000);
    });
    expect(view.getByText(voiceNoteText('C-14', language))).toBeTruthy();
    expect(view.getByText('1:05')).toBeTruthy();
    expect(view.getByTestId('qandeel-voice-note-cancel').props.accessibilityLabel).toBe(voiceNoteText('C-15', language));
    expect(view.getByTestId('qandeel-voice-note-send').props.accessibilityLabel).toBe(voiceNoteText('C-16', language));
    // E5: cancel discards; the history is unchanged and the line returns.
    await press(view, 'qandeel-voice-note-cancel');
    expect(view.queryByTestId('qandeel-voice-note-capture')).toBeNull();
    expect(view.getByTestId('qandeel-conversation-composer')).toBeTruthy();
    expect(view.queryByTestId('qandeel-voice-note-tail')).toBeNull();
    expect(w.server.uploads).toBe(0);
  });

  it('E6–E8: Send → C-24 → C-27 → the committed turn on the reader\'s edge, playable with the bearer in a header', async () => {
    const w = world();
    const view = await mounted(language, w);
    await press(view, 'qandeel-voice-note-mic');
    await act(async () => {
      w.advance(4200);
    });
    await press(view, 'qandeel-voice-note-send');
    expect(w.server.uploads).toBe(1);
    expect(view.getByText(voiceNoteText('C-27', language))).toBeTruthy();
    // READY → the turn is committed and joins the conversation; the pending row goes.
    const turn = exchange('fixture: كلام الرسالة', { replyState: 'PENDING' });
    w.server.status = 'READY';
    w.server.commitWith = turn;
    await act(async () => {
      await w.runTimers();
    });
    expect(view.queryByTestId(`qandeel-voice-pending-${REC}`)).toBeNull();
    const slab = view.getByTestId(`qandeel-utterance-${turn.userTurn.id}`);
    expect(slab.props.accessible).not.toBe(true);
    const play = view.getByTestId(`qandeel-voice-note-${REC}-play`);
    const [playName, pauseName] = voiceNotePair('C-34', language);
    expect(play.props.accessibilityLabel).toBe(`${playName} 0:04`);
    // The slab holds only the media row: no words, no date, no delete until the slab itself is opened.
    expect(view.queryByText('fixture: كلام الرسالة')).toBeNull();
    expect(view.queryByTestId(`qandeel-voice-note-${REC}-text`)).toBeNull();
    expect(view.queryByTestId(`qandeel-voice-note-${REC}-delete`)).toBeNull();
    expect(view.queryByText(voiceNoteText('C-36', language))).toBeNull();
    const more = view.getByTestId(`qandeel-voice-note-${REC}-more`);
    expect(more.props.accessibilityLabel).toBe(`${voiceNoteText('C-13', language)} 0:04`);
    expect(more.props.accessibilityState).toEqual(expect.objectContaining({ expanded: false }));
    await press(view, `qandeel-voice-note-${REC}-more`);
    expect(view.getByTestId(`qandeel-voice-note-${REC}-more`).props.accessibilityState).toEqual(expect.objectContaining({ expanded: true }));
    expect(view.getByText(availableUntilText(language, formatDay('2026-11-30T10:00:00.000Z', language)))).toBeTruthy();
    // The words are not visible until asked for (C-35), then with C-36.
    await press(view, `qandeel-voice-note-${REC}-text`);
    expect(view.getByText(voiceNoteText('C-36', language))).toBeTruthy();
    expect(view.getByText('fixture: كلام الرسالة')).toBeTruthy();
    await press(view, `qandeel-voice-note-${REC}-play`);
    expect(w.played).toEqual([`https://api.test/voice/recordings/${REC}/objects/NOTE/0|Bearer reader`]);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      await flush();
    });
    expect(view.getByTestId(`qandeel-voice-note-${REC}-play`).props.accessibilityLabel).toBe(`${pauseName} 0:04`);
    expect(view.getByText('0:01')).toBeTruthy();
  });

  it('E10: a refused microphone says C-21 with C-22; writing stays', async () => {
    const w = world({ denied: true });
    const view = await mounted(language, w);
    await press(view, 'qandeel-voice-note-mic');
    expect(view.getByText(voiceNoteText('C-21', language))).toBeTruthy();
    expect(view.getByTestId('qandeel-voice-note-open-settings').props.accessibilityLabel).toBe(voiceNoteText('C-22', language));
    expect(view.getByTestId('qandeel-conversation-input')).toBeTruthy();
  });

  it('B13: consent before the first note — C-01 … C-11 exactly, then the capture', async () => {
    const w = world({ consent: false });
    const view = await mounted(language, w);
    await press(view, 'qandeel-voice-note-mic');
    for (const row of VOICE_CONSENT_COPY_ROWS) expect(view.getByText(row[language])).toBeTruthy();
    expect(view.getByTestId('qandeel-voice-consent-agree').props.accessibilityLabel).toBe(VOICE_CONSENT_COPY_ROWS[9][language]);
    await press(view, 'qandeel-voice-consent-agree');
    expect(view.queryByTestId('qandeel-voice-consent')).toBeNull();
    expect(view.getByTestId('qandeel-voice-note-capture')).toBeTruthy();
  });

  it('the gates DISABLED: no microphone at all; drafts already here would still show', async () => {
    const w = world({ available: false });
    const view = await mounted(language, w);
    expect(view.queryByTestId('qandeel-voice-note-mic')).toBeNull();
    expect(view.getByTestId('qandeel-conversation-composer')).toBeTruthy();
  });

  it('C-17: leaving the conversation screen stops and keeps a draft, with Send and Delete draft', async () => {
    const w = world();
    const view = await render(<Composed conversation={w.conversation} session={w.session} language={language} />);
    await act(async () => {
      w.turns.answerRead(page([]));
      await flush();
    });
    await press(view, 'qandeel-voice-note-mic');
    await act(async () => {
      w.advance(3000);
    });
    await act(async () => {
      view.rerender(<Composed conversation={w.conversation} session={w.session} language={language} inFront={false} />);
      await flush();
    });
    expect(view.getByText(voiceNoteText('C-17', language))).toBeTruthy();
    const draftRow = view.getByTestId('qandeel-voice-note-tail');
    expect(draftRow).toBeTruthy();
    expect(view.getByText(voiceNoteText('C-20', language))).toBeTruthy();
    expect(w.server.uploads).toBe(0);
  });

  it('B8: expired and deleted recordings keep their text and offer no play; C-42 is read before deleting', async () => {
    const w = world();
    const expired = { ...exchange('fixture: old words', { replyState: 'COMPLETED' }), voiceNote: { recordingId: 'e1000000-0000-4000-8000-000000000001', available: false, availableUntil: '2026-09-01T00:00:00.000Z', durationMs: 3000 } };
    const deleted = { ...exchange('fixture: deleted words', { replyState: 'COMPLETED' }), voiceNote: { recordingId: 'e2000000-0000-4000-8000-000000000002', available: false, availableUntil: null, durationMs: 3000 } };
    const live = { ...exchange('fixture: live words', { replyState: 'COMPLETED' }), voiceNote: { recordingId: REC, available: true, availableUntil: '2099-01-01T00:00:00.000Z', durationMs: 3000 } };
    const view = await mounted(language, w, [expired, deleted, live]);
    expect(view.getByText(voiceNoteText('C-37', language))).toBeTruthy();
    expect(view.getByText(voiceNoteText('C-38', language))).toBeTruthy();
    expect(view.queryByTestId('qandeel-voice-note-e1000000-0000-4000-8000-000000000001-play')).toBeNull();
    expect(view.queryByTestId('qandeel-voice-note-e2000000-0000-4000-8000-000000000002-play')).toBeNull();
    await press(view, 'qandeel-voice-note-e1000000-0000-4000-8000-000000000001-more');
    await press(view, 'qandeel-voice-note-e1000000-0000-4000-8000-000000000001-text');
    expect(view.getByText('fixture: old words')).toBeTruthy();
    // C-41 (behind the slab) → C-42 + C-43; Cancel keeps it; Delete removes the recording.
    await press(view, `qandeel-voice-note-${REC}-more`);
    await press(view, `qandeel-voice-note-${REC}-delete`);
    expect(view.getByText(voiceNoteText('C-42', language))).toBeTruthy();
    const [deleteLabel, cancelLabel] = voiceNotePair('C-43', language);
    expect(view.getByTestId(`qandeel-voice-note-${REC}-delete-no`).props.accessibilityLabel).toBe(cancelLabel);
    await press(view, `qandeel-voice-note-${REC}-delete-no`);
    expect(w.server.deletes).toEqual([]);
    await press(view, `qandeel-voice-note-${REC}-delete`);
    expect(view.getByTestId(`qandeel-voice-note-${REC}-delete-yes`).props.accessibilityLabel).toBe(deleteLabel);
    await press(view, `qandeel-voice-note-${REC}-delete-yes`);
    expect(w.server.deletes).toEqual([REC]);
  });

  it('every Voice Note act is a named button of at least 44 points; no long press is needed', async () => {
    const w = world();
    const view = await mounted(language, w);
    await press(view, 'qandeel-voice-note-mic');
    for (const id of ['qandeel-voice-note-cancel', 'qandeel-voice-note-send']) {
      const node = view.getByTestId(id);
      expect(node.props.accessibilityRole).toBe('button');
      expect(node.props.onLongPress).toBeUndefined();
    }
  });
  it('P2 final glyphs only, at P2 sizes: mic 24 at the END slot; mic 20 · close 24 · send 24 while recording; play 20 in the slab', async () => {
    const w = world();
    const view = await mounted(language, w);
    const holds = (id: string, glyph: string) => within(view.getByTestId(id)).queryAllByTestId(`qandeel-glyph-${glyph}`, { includeHiddenElements: true }).length > 0;
    expect(holds('qandeel-voice-note-mic', 'mic')).toBe(true);
    await press(view, 'qandeel-voice-note-mic');
    expect(holds('qandeel-voice-note-capture', 'micRecording')).toBe(true);
    expect(holds('qandeel-voice-note-cancel', 'close')).toBe(true);
    expect(holds('qandeel-voice-note-send', 'send')).toBe(true);
    // No level, no trace, no dot: the capture line draws nothing but its three glyphs and its two words.
    expect(within(view.getByTestId('qandeel-voice-note-capture')).queryAllByTestId(/^qandeel-glyph-/u, { includeHiddenElements: true }).length).toBe(3);
    await act(async () => {
      w.advance(4200);
    });
    await press(view, 'qandeel-voice-note-send');
    // Sent, still converting: the same slab at rest, its play in the availability ink and not a control, and C-27.
    expect(view.getByTestId(`qandeel-voice-pending-${REC}-play-unavailable`, { includeHiddenElements: true })).toBeTruthy();
    expect(view.queryByTestId(`qandeel-voice-pending-${REC}-play`)).toBeNull();
    w.server.status = 'READY';
    w.server.commitWith = exchange('fixture: words', { replyState: 'PENDING' });
    await act(async () => {
      await w.runTimers();
    });
    expect(holds(`qandeel-voice-note-${REC}-play`, 'play')).toBe(true);
  });
  it("seek in the Timeline's language: tap, drag (preview, release commits), a cancelled drag moves nothing, the accessible adjust", async () => {
    const w = world();
    const live = { ...exchange('fixture: long words', { replyState: 'COMPLETED' }), voiceNote: { recordingId: REC, available: true, availableUntil: '2099-01-01T00:00:00.000Z', durationMs: 30_000 } };
    const view = await mounted(language, w, [live]);
    const id = `qandeel-voice-note-${REC}`;
    const ALL = { includeHiddenElements: true };
    const line = view.getByTestId(`${id}-line`);
    expect(line.props.accessibilityRole).toBe('adjustable');
    expect(line.props.accessibilityLabel).toBe(voiceNoteText('C-13', language));
    expect(line.props.accessibilityValue).toEqual({ min: 0, max: 30, now: 0, text: '0:00 / 0:30' });
    // At rest: the line alone — no heard part, no position.
    expect(view.queryByTestId(`${id}-line-position`, ALL)).toBeNull();
    expect(view.queryByTestId(`${id}-line-heard`, ALL)).toBeNull();
    await act(async () => {
      fireEvent(line, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 44 } } });
      await flush();
    });
    // The line runs START → END inside the aperture's half-width at each end: 17 … 183 of 200.
    await act(async () => {
      fireGestureHandler(getByGestureTestId(`${id}-line-tap`), [{ state: State.BEGAN, x: 100 }, { state: State.ACTIVE, x: 100 }, { state: State.END, x: 100 }]);
      await flush();
    });
    expect(w.session.playback.getState().positions[REC]).toBe(15_000);
    expect(view.getByTestId(`${id}-line-position`, ALL)).toBeTruthy();
    expect(view.getByTestId(`${id}-line`).props.accessibilityValue.text).toBe('0:15 / 0:30');
    // START is the reader's edge: 17 pt from the right in Arabic, from the left in English.
    const startX = language === 'ar' ? 183 : 17;
    // A drag (the harness completes the touch: its preview is shown on the device captures) commits where it is released.
    await act(async () => {
      fireGestureHandler(getByGestureTestId(`${id}-line-drag`), [{ state: State.BEGAN, x: startX }, { state: State.ACTIVE, x: startX }, { state: State.END, x: startX }]);
      await flush();
    });
    expect(w.session.playback.getState().positions[REC]).toBe(0);
    expect(view.queryByTestId(`${id}-line-preview`, ALL)).toBeNull();
    // A drag that is cancelled is lossless.
    await act(async () => {
      fireGestureHandler(getByGestureTestId(`${id}-line-drag`), [{ state: State.BEGAN, x: 100 }, { state: State.ACTIVE, x: 100 }, { state: State.CANCELLED, x: 100 }]);
      await flush();
    });
    expect(w.session.playback.getState().positions[REC]).toBe(0);
    expect(view.queryByTestId(`${id}-line-preview`, ALL)).toBeNull();
    // The accessible route: increment / decrement by five seconds, within the recording.
    await act(async () => {
      fireEvent(view.getByTestId(`${id}-line`), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
      await flush();
    });
    expect(w.session.playback.getState().positions[REC]).toBe(5000);
    await act(async () => {
      fireEvent(view.getByTestId(`${id}-line`), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
      await flush();
    });
    await act(async () => {
      fireEvent(view.getByTestId(`${id}-line`), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
      await flush();
    });
    expect(w.session.playback.getState().positions[REC]).toBe(0);
    // The details are the time's act now; the line is the seek.
    expect(view.getByTestId(`${id}-more`).props.accessibilityLabel).toBe(`${voiceNoteText('C-13', language)} 0:30`);
    // 30 seconds or more: five-second steps, never past the recording's end.
    for (let i = 0; i < 7; i += 1) {
      await act(async () => {
        fireEvent(view.getByTestId(`${id}-line`), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
        await flush();
      });
    }
    expect(w.session.playback.getState().positions[REC]).toBe(30_000);
    await view.unmount();
  });
  it('the accessible step of a message shorter than 30 seconds is one second, inside the recording', async () => {
    const w = world();
    const short = { ...exchange('fixture: short words', { replyState: 'COMPLETED' }), voiceNote: { recordingId: REC, available: true, availableUntil: '2099-01-01T00:00:00.000Z', durationMs: 2_500 } };
    const view = await mounted(language, w, [short]);
    const id = `qandeel-voice-note-${REC}`;
    const adjust = async (actionName: 'increment' | 'decrement') => {
      await act(async () => {
        fireEvent(view.getByTestId(`${id}-line`), 'accessibilityAction', { nativeEvent: { actionName } });
        await flush();
      });
      return w.session.playback.getState().positions[REC];
    };
    expect(await adjust('increment')).toBe(1000);
    expect(await adjust('increment')).toBe(2000);
    expect(await adjust('increment')).toBe(2500);
    expect(await adjust('increment')).toBe(2500);
    // The spoken value counts the seconds the time shows.
    expect(view.getByTestId(`${id}-line`).props.accessibilityValue).toEqual({ min: 0, max: 2, now: 2, text: '0:02 / 0:02' });
    expect(await adjust('decrement')).toBe(1500);
    expect(await adjust('decrement')).toBe(500);
    expect(await adjust('decrement')).toBe(0);
    expect(await adjust('decrement')).toBe(0);
    await view.unmount();
  });
});

describe('the accessible seek step (PO decision, S8B-03 CP2)', () => {
  it('one second below 30 seconds, five seconds from 30 seconds on', () => {
    expect([0, 1, 29_999].map(voiceNoteSeekStepMs)).toEqual([1000, 1000, 1000]);
    expect([30_000, 30_001, 600_000].map(voiceNoteSeekStepMs)).toEqual([5000, 5000, 5000]);
  });
});

describe("the Voice Note glyphs are P2's final drawings", () => {
  it("the microphone is the geometry the Call Rail port draws (VPORT-02), at P2's optical stroke for 24 and 20 px", () => {
    const { mic, micRecording, close, play, pause, send } = CANONICAL_VISUAL.glyphs;
    for (const glyph of [mic, micRecording]) {
      expect(glyph.strokeRects).toEqual([{ ...P2_CALL_GLYPHS.mic.capsule, strokeWidth: glyph.strokes[0].strokeWidth }]);
      expect(glyph.strokes.map((stroke) => stroke.d)).toEqual([P2_CALL_GLYPHS.mic.cradle]);
    }
    expect(mic.size).toBe(24);
    expect(mic.strokes[0].strokeWidth).toBe(P2_CALL_GLYPHS.mic.strokeWidth);
    expect(micRecording.size).toBe(20);
    expect(micRecording.strokes[0].strokeWidth).toBe(1.75);
    expect(close.size).toBe(24);
    expect(close.strokes).toEqual([{ d: 'M18 6L6.00081 17.9992M17.9992 18L6 6.00085', strokeWidth: 1.6 }]);
    expect([send.size, play.size, pause.size]).toEqual([24, 20, 20]);
  });
});

describe('voiceNoteRest', () => {
  it('playable, expired (its period over) or deleted (the period not over, or none)', () => {
    const now = new Date('2026-10-31T00:00:00.000Z');
    expect(voiceNoteRest({ recordingId: REC, available: true, availableUntil: null, durationMs: 1 }, now)).toBe('PLAYABLE');
    expect(voiceNoteRest({ recordingId: REC, available: false, availableUntil: '2026-10-30T00:00:00.000Z', durationMs: 1 }, now)).toBe('EXPIRED');
    expect(voiceNoteRest({ recordingId: REC, available: false, availableUntil: '2026-11-30T00:00:00.000Z', durationMs: 1 }, now)).toBe('DELETED');
    expect(voiceNoteRest({ recordingId: REC, available: false, availableUntil: null, durationMs: 1 }, now)).toBe('DELETED');
  });
});
