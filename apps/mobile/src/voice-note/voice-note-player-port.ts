/**
 * S8B-03 (CP2) — `VoiceNotePlayerPort` on `expo-audio`, proven early on the reader's device (contract §8.3): the platform
 * player reads the note from the server with the bearer in a request HEADER and Range, so no copy of the audio is written
 * to the device and no credential is ever in a URL. No background playback (`shouldPlayInBackground: false`). Nothing is
 * logged.
 */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import type { VoiceNotePlayerPort, VoiceNotePlayerStatus } from './voice-note-playback';

const FAILED_STATES = new Set(['error', 'failed']);

/**
 * A failed player. On Android `expo-audio` never reports an 'error' state: a source error (a 503, a refused or broken
 * answer) arrives as the status's `error` message, with the state back to 'idle'. Without it the reader waited on
 * "Getting playback ready" for ever, and the §19.2 resume never ran (S8B-07 CP1-B step 6, HONOR, r9).
 */
export function playerFailed(status: { readonly playbackState: string; readonly error?: string | null }): boolean {
  return FAILED_STATES.has(String(status.playbackState).toLowerCase()) || (typeof status.error === 'string' && status.error.length > 0);
}

export function createExpoVoiceNotePlayerPort(): VoiceNotePlayerPort {
  return {
    async create(url, headers, onStatus) {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' });
      // Streaming only (S8B-07 CP1-B §15.3): never `downloadFirst`, so no copy of the audio is written to the device.
      const player = createAudioPlayer({ uri: url, headers }, { updateInterval: 250 });
      const subscription = player.addListener('playbackStatusUpdate', (status) => {
        const view: VoiceNotePlayerStatus = {
          loaded: status.isLoaded,
          playing: status.playing,
          positionMs: status.currentTime * 1000,
          durationMs: status.duration * 1000,
          finished: status.didJustFinish,
          failed: playerFailed(status),
        };
        onStatus(view);
      });
      return {
        play: () => player.play(),
        pause: () => player.pause(),
        seekTo: (positionMs) => player.seekTo(positionMs / 1000),
        currentPositionMs: () => player.currentTime * 1000,
        // `remove()` only forgets the player in the module; the native player keeps playing until it is released
        // (S8B-04 CP2 device finding), so it is stopped and released here, not left to garbage collection. It is muted
        // first: on HONOR a stopped player let out its last buffered audio (≈ 43 ms) at release, after a switch's fade
        // (S8B-07 CP1-B step 6, CA-07B-2 r7); nothing of a released player is heard.
        release: () => {
          subscription.remove();
          player.volume = 0;
          player.pause();
          player.remove();
          player.release();
        },
      };
    },
  };
}
