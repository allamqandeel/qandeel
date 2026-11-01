/**
 * S8B-03 (CP2) — `VoiceNotePlayerPort` on `expo-audio`, proven early on the reader's device (contract §8.3): the platform
 * player reads the note from the server with the bearer in a request HEADER and Range, so no copy of the audio is written
 * to the device and no credential is ever in a URL. No background playback (`shouldPlayInBackground: false`). Nothing is
 * logged.
 */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import type { VoiceNotePlayerPort, VoiceNotePlayerStatus } from './voice-note-playback';

const FAILED_STATES = new Set(['error', 'failed']);

export function createExpoVoiceNotePlayerPort(): VoiceNotePlayerPort {
  return {
    async create(url, headers, onStatus) {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' });
      const player = createAudioPlayer({ uri: url, headers }, { updateInterval: 250 });
      const subscription = player.addListener('playbackStatusUpdate', (status) => {
        const view: VoiceNotePlayerStatus = {
          loaded: status.isLoaded,
          playing: status.playing,
          positionMs: status.currentTime * 1000,
          durationMs: status.duration * 1000,
          finished: status.didJustFinish,
          failed: FAILED_STATES.has(String(status.playbackState).toLowerCase()),
        };
        onStatus(view);
      });
      return {
        play: () => player.play(),
        pause: () => player.pause(),
        seekTo: (positionMs) => player.seekTo(positionMs / 1000),
        release: () => {
          subscription.remove();
          player.remove();
        },
      };
    },
  };
}
