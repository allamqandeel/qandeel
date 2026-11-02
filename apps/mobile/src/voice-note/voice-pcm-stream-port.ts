/**
 * S8B-04 (CP2, D-S1) — `VoicePcmStreamPort` on `expo-audio`'s AudioStream: 16 kHz mono 16-bit PCM, beside the S8B-03 M4A
 * recorder (proven together on the device). The samples go only to the live note's chunk requests; nothing is written to
 * the device and nothing is logged.
 */
import { AudioModule, type NativeAudioModule } from 'expo-audio';

import type { VoicePcmStreamPort } from './voice-live-note';

/** expo-audio's native module, typed: its stream class is a native member the import linter cannot see (as the S8B-03 recorder). */
const nativeAudio: NativeAudioModule = AudioModule;

export function createExpoVoicePcmStreamPort(): VoicePcmStreamPort {
  return {
    async start(onBuffer) {
      const stream = new nativeAudio.AudioStream({ sampleRate: 16000, channels: 1, encoding: 'int16' });
      const subscription = stream.addListener('audioStreamBuffer', (buffer: { data: ArrayBuffer; sampleRate: number }) => {
        onBuffer(new Uint8Array(buffer.data), buffer.sampleRate);
      });
      try {
        await stream.start();
      } catch (error) {
        subscription.remove();
        throw error;
      }
      return () => {
        subscription.remove();
        stream.stop();
      };
    },
  };
}
