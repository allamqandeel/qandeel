/**
 * S8B-03 (CP2, decision D3 / G12-J1) — a capture starts only on the reader's tap with the microphone permission, and
 * never records unseen: leaving the screen or the foreground, an interruption, a route change, a platform error and the
 * ten-minute limit all STOP it and keep a draft. Nothing is sent from here.
 */
import { createManualForegroundSignal } from '../../runtime-entry';
import { VOICE_NOTE_MAX_DURATION_MS } from '../voice-note-limits';
import { CAPTURE_WATCH_MS, createVoiceNoteCapture, type MicrophonePermission, type VoiceRecorderPort } from '../voice-note-capture';
import { createEphemeralVoiceDraftKeyValue, createVoiceDraftStore, type VoiceDraftFiles } from '../voice-draft-store';

jest.mock('expo-sqlite/kv-store', () => ({ SQLiteStorage: jest.fn() }));
jest.mock('expo-file-system', () => ({ Directory: jest.fn(), File: jest.fn(), Paths: {} }));

const OWNER = 'a0000000-0000-4000-8000-000000000001';
const SESSION = 'c0000000-0000-4000-8000-000000000003';

function fakeRecorder(initial: MicrophonePermission = 'GRANTED') {
  const state = {
    permission: initial,
    afterPrompt: 'GRANTED' as MicrophonePermission,
    prompts: 0,
    recording: false,
    duration: 0,
    input: 'builtin:1' as string | null,
    files: new Set<string>(),
    failPrepare: false,
    ended: new Set<() => void>(),
    calls: [] as string[],
  };
  let n = 0;
  const port: VoiceRecorderPort = {
    permission: async () => state.permission,
    requestPermission: async () => {
      state.prompts += 1;
      state.permission = state.afterPrompt;
      return state.permission;
    },
    prepare: async () => {
      state.calls.push('prepare');
      if (state.failPrepare) throw new Error('no recorder');
      n += 1;
      const uri = `file:///docs/Audio/rec-${n}.m4a`;
      state.files.add(uri);
      return uri;
    },
    record: () => {
      state.calls.push('record');
      state.recording = true;
    },
    stop: async () => {
      state.calls.push('stop');
      state.recording = false;
    },
    status: () => ({ isRecording: state.recording, durationMillis: state.duration }),
    currentInput: async () => {
      state.calls.push('input');
      return state.input;
    },
    onEnded: (listener) => {
      state.ended.add(listener);
      return () => state.ended.delete(listener);
    },
  };
  return { port, state };
}

function setup(permission: MicrophonePermission = 'GRANTED') {
  const recorder = fakeRecorder(permission);
  const adopted: string[] = [];
  const removedUris: string[] = [];
  const files: VoiceDraftFiles = {
    adopt: async (_o, draftId, uri) => {
      if (!recorder.state.files.has(uri)) throw new Error('missing');
      recorder.state.files.delete(uri);
      adopted.push(draftId);
      return 2048;
    },
    size: () => 2048,
    check: () => 'COMPLETE',
    checkUri: () => 'COMPLETE',
    read: () => new Uint8Array(2048),
    remove: () => undefined,
    removeUri: (uri) => {
      removedUris.push(uri);
    },
    removeOwner: () => undefined,
  };
  const store = createVoiceDraftStore(createEphemeralVoiceDraftKeyValue(), files);
  const foreground = createManualForegroundSignal('ACTIVE');
  let tick: (() => void) | null = null;
  let ids = 0;
  const capture = createVoiceNoteCapture({
    owner: OWNER, sessionId: SESSION, recorder: recorder.port, store, foreground,
    newId: () => `00000000-0000-4000-8000-${String((ids += 1)).padStart(12, '0')}`,
    setInterval: (callback, ms) => {
      expect(ms).toBe(CAPTURE_WATCH_MS);
      tick = callback;
      return 1;
    },
    clearInterval: () => {
      tick = null;
    },
  });
  const flush = async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  };
  return { capture, recorder, store, foreground, adopted, removedUris, tick: () => tick?.(), watching: () => tick !== null, flush };
}

describe('voice note capture', () => {
  it('records after the permission, and the reader\'s stop keeps a SAVED draft with nothing sent', async () => {
    const t = setup();
    await t.capture.start();
    expect(t.capture.getState()).toMatchObject({ kind: 'RECORDING' });
    // The input is read only after the recorder is routed (an earlier read pins Android's built-in microphone).
    expect(t.recorder.state.calls.slice(0, 3)).toEqual(['prepare', 'record', 'input']);
    t.recorder.state.duration = 4200;
    t.tick();
    const draft = await t.capture.stop();
    expect(draft).toMatchObject({ state: 'SAVED', stoppedBy: 'USER', durationMs: 4200, bytes: 2048 });
    expect(t.capture.getState()).toMatchObject({ kind: 'STOPPED' });
    expect(t.watching()).toBe(false);
    expect((await t.store.list(OWNER)).drafts).toHaveLength(1);
  });

  it('asks for the permission at the moment of intent, once; a refusal records nothing', async () => {
    const t = setup('UNDETERMINED');
    t.recorder.state.afterPrompt = 'DENIED';
    await t.capture.start();
    expect(t.recorder.state.prompts).toBe(1);
    expect(t.capture.getState()).toEqual({ kind: 'PERMISSION_DENIED' });
    expect(t.recorder.state.calls).toEqual([]);
    expect((await t.store.list(OWNER)).drafts).toEqual([]);
  });

  it('a permanently denied permission is not prompted again', async () => {
    const t = setup('DENIED');
    await t.capture.start();
    expect(t.recorder.state.prompts).toBe(0);
    expect(t.capture.getState()).toEqual({ kind: 'PERMISSION_DENIED' });
  });

  it('never starts while the app is not in front of the reader', async () => {
    const t = setup();
    t.foreground.set('INACTIVE');
    await t.capture.start();
    expect(t.capture.getState()).toEqual({ kind: 'IDLE' });
    expect(t.recorder.state.calls).toEqual([]);
  });

  it('leaving the foreground stops and keeps the draft (C-17)', async () => {
    const t = setup();
    await t.capture.start();
    t.foreground.set('INACTIVE');
    await t.flush();
    expect(t.recorder.state.recording).toBe(false);
    expect(t.capture.getState()).toMatchObject({ kind: 'STOPPED', draft: { stoppedBy: 'LEFT_SCREEN' } });
  });

  it('leaving the conversation screen stops and keeps the draft (C-17)', async () => {
    const t = setup();
    await t.capture.start();
    await t.capture.leave();
    expect(t.capture.getState()).toMatchObject({ kind: 'STOPPED', draft: { stoppedBy: 'LEFT_SCREEN' } });
  });

  it('a recorder the platform paused (a call) stops the capture as an interruption (C-18)', async () => {
    const t = setup();
    await t.capture.start();
    t.recorder.state.recording = false;
    t.tick();
    await t.flush();
    expect(t.capture.getState()).toMatchObject({ kind: 'STOPPED', draft: { stoppedBy: 'INTERRUPTION' } });
  });

  it('an input that changed (a headset unplugged) stops the capture as an interruption (C-18)', async () => {
    const t = setup();
    t.recorder.state.input = 'headset:7';
    await t.capture.start();
    await t.flush();
    t.recorder.state.input = 'builtin:1';
    t.tick();
    await t.flush();
    expect(t.capture.getState()).toMatchObject({ kind: 'STOPPED', draft: { stoppedBy: 'INTERRUPTION' } });
  });

  it('an unchanged or unknown input does not stop the capture', async () => {
    const t = setup();
    await t.capture.start();
    await t.flush();
    t.tick();
    await t.flush();
    t.recorder.state.input = null;
    t.tick();
    await t.flush();
    expect(t.capture.getState()).toMatchObject({ kind: 'RECORDING' });
  });

  it('a platform error ends the capture as an interruption', async () => {
    const t = setup();
    await t.capture.start();
    for (const listener of Array.from(t.recorder.state.ended)) listener();
    await t.flush();
    expect(t.capture.getState()).toMatchObject({ kind: 'STOPPED', draft: { stoppedBy: 'INTERRUPTION' } });
    expect(t.recorder.state.ended.size).toBe(0);
  });

  it('the ten-minute limit stops and keeps the draft at the limit (C-19)', async () => {
    const t = setup();
    await t.capture.start();
    t.recorder.state.duration = VOICE_NOTE_MAX_DURATION_MS + 300;
    t.tick();
    await t.flush();
    expect(t.capture.getState()).toMatchObject({ kind: 'STOPPED', draft: { stoppedBy: 'LIMIT', durationMs: VOICE_NOTE_MAX_DURATION_MS } });
  });

  it('cancel discards the capture: no draft remains', async () => {
    const t = setup();
    await t.capture.start();
    await t.capture.cancel();
    expect(t.capture.getState()).toEqual({ kind: 'IDLE' });
    expect((await t.store.list(OWNER)).drafts).toEqual([]);
  });

  it('a recorder that cannot prepare leaves no draft and reports FAILED', async () => {
    const t = setup();
    t.recorder.state.failPrepare = true;
    await t.capture.start();
    expect(t.capture.getState()).toEqual({ kind: 'FAILED' });
    expect((await t.store.list(OWNER)).drafts).toEqual([]);
  });

  it('a recorder file that cannot become a draft is removed and reported FAILED', async () => {
    const t = setup();
    await t.capture.start();
    t.recorder.state.files.clear();
    await t.capture.stop();
    expect(t.capture.getState()).toEqual({ kind: 'FAILED' });
    expect((await t.store.list(OWNER)).drafts).toEqual([]);
  });

  it('a second tap while recording does nothing; a new capture after a stop is a new draft', async () => {
    const t = setup();
    await t.capture.start();
    await t.capture.start();
    expect(t.recorder.state.calls.filter((c) => c === 'prepare')).toHaveLength(1);
    await t.capture.stop();
    await t.capture.start();
    await t.capture.stop();
    expect((await t.store.list(OWNER)).drafts).toHaveLength(2);
  });

  it('holds the screen on only while recording, and releases it on every way out', async () => {
    for (const end of ['stop', 'leave', 'cancel', 'interrupt', 'retire'] as const) {
      const t = setup();
      const calls: string[] = [];
      const capture = createVoiceNoteCapture({
        owner: OWNER, sessionId: SESSION, recorder: t.recorder.port, store: t.store, foreground: t.foreground,
        newId: () => `00000000-0000-4000-8000-0000000000${calls.length}9`,
        screen: { hold: () => calls.push('hold'), release: () => calls.push('release') },
        setInterval: () => 1, clearInterval: () => undefined,
      });
      await capture.start();
      expect(calls).toEqual(['hold']);
      if (end === 'stop') await capture.stop();
      if (end === 'leave') await capture.leave();
      if (end === 'cancel') await capture.cancel();
      if (end === 'interrupt') for (const listener of Array.from(t.recorder.state.ended)) listener();
      if (end === 'retire') capture.retire();
      await t.flush();
      expect(calls).toEqual(['hold', 'release']);
    }
    // A refused permission never holds the screen.
    const denied = setup('DENIED');
    const calls: string[] = [];
    const capture = createVoiceNoteCapture({
      owner: OWNER, sessionId: SESSION, recorder: denied.recorder.port, store: denied.store, foreground: denied.foreground,
      newId: () => '00000000-0000-4000-8000-000000000099', screen: { hold: () => calls.push('hold'), release: () => calls.push('release') },
    });
    await capture.start();
    expect(calls).toEqual([]);
  });

  it('retire mid-recording stops the recorder and keeps the draft; a retired capture never starts', async () => {
    const t = setup();
    await t.capture.start();
    t.capture.retire();
    expect(t.watching()).toBe(false);
    await t.flush();
    expect(t.recorder.state.recording).toBe(false);
    expect((await t.store.list(OWNER)).drafts).toEqual([expect.objectContaining({ state: 'SAVED', stoppedBy: 'LEFT_SCREEN' })]);
    const u = setup();
    u.capture.retire();
    await u.capture.start();
    expect(u.recorder.state.calls).toEqual([]);
  });
});
