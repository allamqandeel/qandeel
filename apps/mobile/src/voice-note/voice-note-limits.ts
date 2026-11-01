/**
 * S8B-03 (CP2, OD-8, contract §8.2) — the limits of one Voice Note, with no native import, so every rule built on them is
 * tested without a device. The recorder's own configuration is recording-options.ts.
 */
export const VOICE_NOTE_MAX_DURATION_MS = 10 * 60 * 1000;
export const VOICE_NOTE_CONTENT_TYPE = 'audio/mp4';
/** The server's ceiling for one note (S8B-02 VOICE_OBJECT_MAX_BYTES); a ten-minute note at 32 kbit/s is about 2.4 MB. */
export const VOICE_NOTE_MAX_BYTES = 25 * 1024 * 1024;
