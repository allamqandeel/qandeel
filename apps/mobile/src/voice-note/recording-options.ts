/**
 * S8B-03 (CP2, contract §8.2) — the ONE recording configuration of a Voice Note: AAC-LC in an MPEG-4 (M4A) container,
 * one channel, 16 000 Hz, 32 000 bit/s, at most ten minutes (OD-8). The server's duration proof (CP1 §4.6.2) accepts
 * exactly this shape: one mono AAC-LC track whose indexed frames last at most 10 minutes + 1 s.
 *
 * Android: MediaRecorder `mpeg4` + `aac` (the AAC encoder is AAC-LC). iOS: AVAudioRecorder `MPEG4AAC` (kAudioFormatMPEG4AAC
 * is AAC-LC). Metering is off: G1.2 shows no level the app does not truly have, and no waveform is drawn.
 */
import { AudioQuality, IOSOutputFormat, type RecordingOptions } from 'expo-audio';
import { Platform } from 'react-native';

import { VOICE_NOTE_CONTENT_TYPE } from './voice-note-limits';


export const VOICE_NOTE_RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 16_000,
  numberOfChannels: 1,
  bitRate: 32_000,
  isMeteringEnabled: false,
  directory: 'document',
  android: {
    extension: '.m4a',
    outputFormat: 'mpeg4',
    audioEncoder: 'aac',
    sampleRate: 16_000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: IOSOutputFormat.MPEG4AAC,
    audioQuality: AudioQuality.MEDIUM,
    sampleRate: 16_000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: VOICE_NOTE_CONTENT_TYPE,
    bitsPerSecond: 32_000,
  },
};

/**
 * The same configuration flattened for the native recorder's constructor, as `expo-audio` does for `prepareToRecordAsync`
 * (the constructor is not shimmed, and the native side requires `extension`).
 */
export function platformRecordingOptions(os: string = Platform.OS): Record<string, unknown> {
  const { extension, sampleRate, numberOfChannels, bitRate, isMeteringEnabled, directory } = VOICE_NOTE_RECORDING_OPTIONS;
  const common = { extension, sampleRate, numberOfChannels, bitRate, isMeteringEnabled };
  if (os === 'ios') return { ...common, directory, ...VOICE_NOTE_RECORDING_OPTIONS.ios };
  if (os === 'android') return { ...common, directory, ...VOICE_NOTE_RECORDING_OPTIONS.android };
  return { ...common, ...VOICE_NOTE_RECORDING_OPTIONS.web };
}
