/**
 * S8B-03 (CP2) — the order of the reader's acts in one Session: the launch gate at the moment of intent (C-31), consent
 * before the first note on exactly the approved rows (B13), the OS permission at intent (C-21), the capture, Send, and
 * the early deletion of a recording (C-42 confirmed elsewhere). Nothing is sent before Send.
 */
import { createManualForegroundSignal } from '../../runtime-entry';
import { createEphemeralVoiceDraftKeyValue, createVoiceDraftStore, type VoiceDraftFiles, type VoiceDraftRecord } from '../voice-draft-store';
import { createVoiceNoteCapture, type MicrophonePermission, type VoiceRecorderPort } from '../voice-note-capture';
import { VOICE_CONSENT_COPY_ROWS, VOICE_CONSENT_VERSION } from '../voice-note-copy';
import type { VoiceNotesController } from '../voice-note-controller';
import type { VoiceNotePlayback } from '../voice-note-playback';
import { consentRowsAreApproved, createVoiceNoteSession, withRecordingDeleted } from '../voice-note-session';
import type { VoiceCapabilityRead, VoiceConsentRead } from '../voice-note-api';

jest.mock('expo-sqlite/kv-store', () => ({ SQLiteStorage: jest.fn() }));
jest.mock('expo-file-system', () => ({ Directory: jest.fn(), File: jest.fn(), Paths: {} }));

const OWNER = 'a0000000-0000-4000-8000-000000000001';
const SESSION = 'c0000000-0000-4000-8000-000000000003';
const REC = 'e0000000-0000-4000-8000-000000000005';

function recorder(permission: MicrophonePermission) {
  const calls: string[] = [];
  let recording = false;
  const files = new Set<string>();
  const port: VoiceRecorderPort = {
    permission: async () => permission,
    requestPermission: async () => permission,
    prepare: async () => {
      calls.push('prepare');
      files.add('file:///docs/Audio/r.m4a');
      return 'file:///docs/Audio/r.m4a';
    },
    record: () => {
      calls.push('record');
      recording = true;
    },
    stop: async () => {
      calls.push('stop');
      recording = false;
    },
    status: () => ({ isRecording: recording, durationMillis: 3000 }),
    currentInput: async () => null,
    onEnded: () => () => undefined,
  };
  return { port, calls, files };
}

function setup(options: { available?: boolean; consent?: boolean; permission?: MicrophonePermission; rows?: VoiceConsentRead } = {}) {
  const rec = recorder(options.permission ?? 'GRANTED');
  const files: VoiceDraftFiles = {
    adopt: async (_o, _d, uri) => {
      if (!rec.files.delete(uri)) throw new Error('missing');
      return 2048;
    },
    size: () => 2048, check: () => 'COMPLETE', checkUri: () => 'COMPLETE', read: () => new Uint8Array(2048),
    remove: () => undefined, removeUri: () => undefined, removeOwner: () => undefined,
  };
  const store = createVoiceDraftStore(createEphemeralVoiceDraftKeyValue(), files);
  const foreground = createManualForegroundSignal('ACTIVE');
  let ids = 0;
  const newId = () => `00000000-0000-4000-8000-${String((ids += 1)).padStart(12, '0')}`;
  const capture = createVoiceNoteCapture({ owner: OWNER, sessionId: SESSION, recorder: rec.port, store, foreground, newId, setInterval: () => 1, clearInterval: () => undefined });
  const added: VoiceDraftRecord[] = [];
  const sent: string[] = [];
  const forgotten: string[] = [];
  const notes = {
    getState: () => ({ items: [], unrecoverable: false }),
    subscribe: () => () => undefined,
    restore: jest.fn(async () => undefined),
    addDraft: (draft: VoiceDraftRecord) => added.push(draft),
    send: async (draftId: string) => {
      sent.push(draftId);
    },
    deleteDraft: async () => undefined,
    retryNote: async () => undefined,
    forgetNote: async (id: string) => {
      forgotten.push(id);
    },
    dismissNotice: jest.fn(),
    retire: jest.fn(),
  } as unknown as VoiceNotesController;
  const playback = { forget: jest.fn(), pause: jest.fn(), retire: jest.fn() } as unknown as VoiceNotePlayback;
  const api = {
    calls: [] as string[],
    available: options.available ?? true,
    consent: options.consent ?? true,
    grantOutcome: 'DONE' as 'DONE' | 'FAILED' | 'VERSION_NOT_CURRENT' | 'OFFLINE',
    deleteOutcome: 'DELETED' as 'DELETED' | 'FAILED' | 'OFFLINE',
  };
  const deleted: string[] = [];
  const session = createVoiceNoteSession({
    api: {
      capability: async (): Promise<VoiceCapabilityRead> => {
        api.calls.push('capability');
        return { kind: 'CAPABILITY', view: { voiceNotesAvailable: api.available, consentState: api.consent ? 'GRANTED' : 'NONE', consentCurrent: api.consent } };
      },
      consent: async (): Promise<VoiceConsentRead> => {
        api.calls.push('consent');
        return options.rows ?? { kind: 'CONSENT', version: VOICE_CONSENT_VERSION, state: 'NONE', rows: VOICE_CONSENT_COPY_ROWS.map((r) => ({ ...r })) };
      },
      grant: async (commandId, version) => {
        api.calls.push(`grant:${version}`);
        expect(commandId).toMatch(/^[0-9a-f-]{36}$/u);
        if (api.grantOutcome === 'DONE') api.consent = true;
        return api.grantOutcome;
      },
      withdraw: async (commandId) => {
        api.calls.push('withdraw');
        expect(commandId).toMatch(/^[0-9a-f-]{36}$/u);
        api.consent = false;
        return 'DONE';
      },
      deleteRecording: async (id) => {
        api.calls.push(`delete:${id}`);
        return api.deleteOutcome;
      },
    },
    capture, notes, playback, foreground, newId, isCurrent: () => true,
    onRecordingDeleted: (id) => deleted.push(id),
  });
  return { session, rec, api, added, sent, forgotten, deleted, playback, notes, foreground };
}

describe('voice note session', () => {
  it('offers the microphone only while the server says Voice Notes are available; restore sends nothing', async () => {
    const closed = setup({ available: false });
    await closed.session.restore();
    expect(closed.session.getState().offered).toBe(false);
    const open = setup();
    await open.session.restore();
    expect(open.session.getState()).toMatchObject({ offered: true, consentCurrent: true, sheet: null, notice: null });
    expect(open.api.calls).toEqual(['capability']);
    expect(open.rec.calls).toEqual([]);
  });

  it('a gate closed since the screen opened is said at the tap (C-31), and nothing records', async () => {
    const t = setup();
    await t.session.restore();
    t.api.available = false;
    await t.session.begin();
    expect(t.session.getState()).toMatchObject({ offered: false, notice: 'GATE_CLOSED' });
    expect(t.rec.calls).toEqual([]);
  });

  it('consent comes first, on exactly the approved rows; agreeing grants the shown version, then the capture starts', async () => {
    const t = setup({ consent: false });
    await t.session.begin();
    const sheet = t.session.getState().sheet;
    expect(sheet).toMatchObject({ phase: 'READY', granting: false });
    expect(sheet?.phase === 'READY' && sheet.rows.map((r) => r.id)).toEqual(VOICE_CONSENT_COPY_ROWS.map((r) => r.id));
    expect(t.rec.calls).toEqual([]);
    await t.session.agree();
    expect(t.api.calls).toEqual(['capability', 'consent', `grant:${VOICE_CONSENT_VERSION}`]);
    expect(t.session.getState()).toMatchObject({ sheet: null, consentCurrent: true });
    expect(t.session.capture.getState().kind).toBe('RECORDING');
  });

  it('S8B-04 D4: a consent to an earlier version is asked for again, with R-01 above the text; a first consent without it', async () => {
    const rows = VOICE_CONSENT_COPY_ROWS.map((r) => ({ ...r }));
    const outdated = setup({ consent: false, rows: { kind: 'CONSENT', version: VOICE_CONSENT_VERSION, state: 'OUTDATED', rows } });
    await outdated.session.begin();
    expect(outdated.session.getState().sheet).toMatchObject({ phase: 'READY', renewal: true });
    expect(outdated.rec.calls).toEqual([]);
    await outdated.session.agree();
    expect(outdated.api.calls).toEqual(['capability', 'consent', `grant:${VOICE_CONSENT_VERSION}`]);
    const first = setup({ consent: false });
    await first.session.begin();
    expect(first.session.getState().sheet).toMatchObject({ phase: 'READY', renewal: false });
  });

  it('B13: rows that are not the approved ones (or another version) are never shown and no consent is asked', async () => {
    const tampered = VOICE_CONSENT_COPY_ROWS.map((r) => ({ ...r }));
    tampered[3] = { ...tampered[3], en: `${tampered[3].en} ` };
    const t = setup({ consent: false, rows: { kind: 'CONSENT', version: VOICE_CONSENT_VERSION, state: 'NONE', rows: tampered } });
    await t.session.begin();
    expect(t.session.getState().sheet).toEqual({ phase: 'UNAVAILABLE' });
    await t.session.agree();
    expect(t.api.calls.some((c) => c.startsWith('grant'))).toBe(false);
    expect(consentRowsAreApproved('VOICE_RECORDING_V2', VOICE_CONSENT_COPY_ROWS)).toBe(false);
    expect(consentRowsAreApproved(VOICE_CONSENT_VERSION, VOICE_CONSENT_COPY_ROWS.slice(1))).toBe(false);
    expect(consentRowsAreApproved(VOICE_CONSENT_VERSION, VOICE_CONSENT_COPY_ROWS)).toBe(true);
  });

  it('C-11 changes nothing; a failed grant leaves the sheet to try again', async () => {
    const t = setup({ consent: false });
    await t.session.begin();
    t.session.decline();
    expect(t.session.getState().sheet).toBeNull();
    expect(t.rec.calls).toEqual([]);
    await t.session.begin();
    t.api.grantOutcome = 'FAILED';
    await t.session.agree();
    expect(t.session.getState().sheet).toMatchObject({ phase: 'READY', granting: false });
    expect(t.session.capture.getState().kind).toBe('IDLE');
  });

  it('a refused microphone says C-21 with Open Settings, and records nothing', async () => {
    const t = setup({ permission: 'DENIED' });
    await t.session.begin();
    expect(t.session.getState().notice).toBe('PERMISSION_DENIED');
    expect(t.rec.calls).toEqual([]);
    t.session.dismissNotice();
    expect(t.session.getState().notice).toBeNull();
  });

  it('Send stops the capture, keeps it as a draft, and sends that draft — the only way anything is sent', async () => {
    const t = setup();
    await t.session.begin();
    expect(t.sent).toEqual([]);
    await t.session.send();
    expect(t.added).toHaveLength(1);
    expect(t.sent).toEqual([t.added[0].draftId]);
    expect(t.session.capture.getState().kind).toBe('IDLE');
  });

  it('a capture stopped by leaving becomes a draft row (C-17), and is not sent', async () => {
    const t = setup();
    await t.session.begin();
    await t.session.leave();
    expect(t.playback.pause).toHaveBeenCalled();
    expect(t.added).toEqual([expect.objectContaining({ stoppedBy: 'LEFT_SCREEN', state: 'SAVED' })]);
    expect(t.sent).toEqual([]);
    expect(t.session.capture.getState().kind).toBe('IDLE');
  });

  it('a draft whose send needs consent asks for it first, then sends that draft (not a new capture)', async () => {
    const t = setup({ consent: false });
    await t.session.restore();
    await t.session.sendDraft('draft-1');
    expect(t.sent).toEqual([]);
    expect(t.session.getState().sheet).toMatchObject({ phase: 'READY' });
    await t.session.agree();
    expect(t.sent).toEqual(['draft-1']);
    expect(t.rec.calls).toEqual([]);
  });

  it('deleting a recording (C-42 confirmed) releases its playback, removes its row and marks its turn deleted', async () => {
    const t = setup();
    expect(await t.session.deleteRecording(REC)).toBe('DELETED');
    expect(t.playback.forget).toHaveBeenCalledWith(REC);
    expect(t.forgotten).toEqual([REC]);
    expect(t.deleted).toEqual([REC]);
    t.api.deleteOutcome = 'FAILED';
    expect(await t.session.deleteRecording(REC)).toBe('FAILED');
    expect(t.deleted).toEqual([REC]);
    const turn = { userTurn: { id: 't', content: 'words', idempotencyKey: null, createdAt: '2026-10-31T10:00:00.000Z' }, replyState: 'PENDING' as const, reply: null, voiceNote: { recordingId: REC, available: true, availableUntil: '2026-11-30T10:00:00.000Z', durationMs: 3000 } };
    expect(withRecordingDeleted(turn, REC).voiceNote).toEqual({ recordingId: REC, available: false, availableUntil: null, durationMs: 3000 });
    expect(withRecordingDeleted(turn, 'other')).toBe(turn);
  });

  it('OD-4: withdrawing consent (C-46 after C-47) marks it WITHDRAWN and asks for consent again before the next note', async () => {
    const t = setup();
    await t.session.restore();
    expect(t.session.getState().consentState).toBe('GRANTED');
    expect(await t.session.withdrawConsent()).toBe('DONE');
    expect(t.session.getState()).toMatchObject({ consentState: 'NONE', consentCurrent: false, withdrawing: false });
    await t.session.begin();
    expect(t.session.getState().sheet).toMatchObject({ phase: 'READY' });
  });

  it('retire stops the capture (kept as a draft), the notes and playback', async () => {
    const t = setup();
    await t.session.begin();
    t.session.retire();
    expect(t.notes.retire).toHaveBeenCalled();
    expect(t.playback.retire).toHaveBeenCalled();
    expect(t.rec.calls).toContain('stop');
  });
});
