/**
 * S8B-07 CP1-B step 6 (HONOR, r9): the expo-audio port reports a failed player. On Android a source error arrives as the
 * status's `error` message with the state 'idle', never as an 'error' state; the port must report it as failed, or the
 * reader waits on "Getting playback ready" for ever and the §19.2 resume never runs.
 */
import { createExpoVoiceNotePlayerPort, playerFailed } from '../voice-note-player-port';

type Listener = (status: Record<string, unknown>) => void;
const listeners: Listener[] = [];

jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => undefined),
  createAudioPlayer: jest.fn(() => ({
    addListener: (_event: string, listener: Listener) => { listeners.push(listener); return { remove: jest.fn() }; },
    play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(), remove: jest.fn(), release: jest.fn(), currentTime: 0, volume: 1,
  })),
}));

const status = (over: Record<string, unknown>) => ({
  isLoaded: false, playing: false, currentTime: 0, duration: 0, didJustFinish: false, playbackState: 'idle', error: null, ...over,
});

describe('S8B-07 CP1-B r9 — the player port reports a failed source on Android', () => {
  beforeEach(() => { listeners.length = 0; });

  it('a status carrying an error message is failed (Android: the state is "idle")', async () => {
    const seen: boolean[] = [];
    await createExpoVoiceNotePlayerPort().create('http://127.0.0.1/x', {}, (s) => seen.push(s.failed));
    listeners[0]!(status({ playbackState: 'idle', error: 'Source error' }));
    expect(seen).toEqual([true]);
  });

  it('an ordinary status is not failed: loading, buffering, ready, idle with no error, an empty message', async () => {
    const seen: boolean[] = [];
    await createExpoVoiceNotePlayerPort().create('http://127.0.0.1/x', {}, (s) => seen.push(s.failed));
    for (const s of [status({}), status({ playbackState: 'buffering' }), status({ playbackState: 'ready', isLoaded: true, playing: true }), status({ error: '' })]) listeners[0]!(s);
    expect(seen).toEqual([false, false, false, false]);
  });

  it('an "error" or "failed" state stays failed (iOS), with or without a message', () => {
    expect(playerFailed({ playbackState: 'error' })).toBe(true);
    expect(playerFailed({ playbackState: 'Failed', error: null })).toBe(true);
    expect(playerFailed({ playbackState: 'ready', error: null })).toBe(false);
  });
});
