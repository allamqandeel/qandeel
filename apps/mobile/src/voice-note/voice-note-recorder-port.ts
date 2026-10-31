/**
 * S8B-03 (CP2, §5.6 / §8.2 B1–B3) — the production `VoiceRecorderPort`, over `expo-audio`.
 *
 * ONE recording configuration (recording-options.ts): AAC-LC in an MPEG-4 container, mono, 16 kHz, 32 kbit/s, written
 * into the app's documents (never `cache`). The audio session allows recording only while a capture runs and is
 * returned to playback afterwards, so a later bubble does not play through the earpiece. No background recording is
 * configured here or in the native config (§5.6); nothing is logged.
 */
import {
  AudioModule,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type AudioRecorder,
  type PermissionResponse,
  type RecordingStatus,
} from 'expo-audio';

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { excludeFromBackup, folderOf } from './backup-exclusion';
import { platformRecordingOptions, VOICE_NOTE_RECORDING_OPTIONS } from './recording-options';
import type { MicrophonePermission, VoiceRecorderPort } from './voice-note-capture';

function permissionOf(response: PermissionResponse): MicrophonePermission {
  if (response.granted) return 'GRANTED';
  // While the OS may still ask (never asked, or one Android denial), the prompt is shown again at the moment of intent.
  return response.canAskAgain ? 'UNDETERMINED' : 'DENIED';
}

/** One recorder per capture; it is released once its file has been taken. */
export function createExpoVoiceRecorderPort(): VoiceRecorderPort & { release(): void } {
  let recorder: AudioRecorder | null = null;
  const endedListeners = new Set<() => void>();
  let subscription: { remove(): void } | null = null;

  const current = (): AudioRecorder => {
    if (recorder === null) throw new Error('recorder not prepared');
    return recorder;
  };

  return {
    permission: async () => permissionOf(await getRecordingPermissionsAsync()),
    requestPermission: async () => permissionOf(await requestRecordingPermissionsAsync()),
    async prepare() {
      subscription?.remove();
      recorder?.release();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' });
      const next = new AudioModule.AudioRecorder(platformRecordingOptions());
      recorder = next;
      subscription = next.addListener('recordingStatusUpdate', (status: RecordingStatus) => {
        if (status.isFinished && status.hasError) for (const listener of Array.from(endedListeners)) listener();
      });
      await next.prepareToRecordAsync(VOICE_NOTE_RECORDING_OPTIONS);
      const uri = next.uri ?? next.getStatus().url;
      if (uri === null || uri === undefined) throw new Error('recorder has no file');
      // iOS: the recorder's own folder (`<documents>/ExpoAudio`) carries the backup flag before the first sample.
      excludeFromBackup(folderOf(uri));
      return uri;
    },
    record: () => current().record(),
    async stop() {
      try {
        await current().stop();
      } finally {
        await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      }
    },
    status() {
      if (recorder === null) return { isRecording: false, durationMillis: 0 };
      const status = recorder.getStatus();
      return { isRecording: status.isRecording, durationMillis: status.durationMillis };
    },
    async currentInput() {
      if (recorder === null) return null;
      try {
        const input = await recorder.getCurrentInput();
        return input?.uid ? `${input.type}:${input.uid}` : null;
      } catch {
        return null;
      }
    },
    onEnded(listener) {
      endedListeners.add(listener);
      return () => endedListeners.delete(listener);
    },
    release() {
      subscription?.remove();
      subscription = null;
      recorder?.release();
      recorder = null;
      endedListeners.clear();
    },
  };
}

const SCREEN_TAG = 'qandeel-voice-note-capture';

/** The production screen hold of a capture (expo-keep-awake, one tag): on while recording, off otherwise. */
export function createCaptureScreenHold(): { hold(): void; release(): void } {
  return {
    hold: () => {
      void activateKeepAwakeAsync(SCREEN_TAG).catch(() => undefined);
    },
    release: () => {
      void deactivateKeepAwake(SCREEN_TAG).catch(() => undefined);
    },
  };
}
