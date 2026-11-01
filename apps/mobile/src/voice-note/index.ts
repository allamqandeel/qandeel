/** S8B-03 — Personal Voice Notes in the Personal conversation (contract v1.2 §8.2). */
export type { VoiceNoteSession, VoiceNoteSessionState, VoiceNoteSessionNotice, VoiceConsentSheet } from './voice-note-session';
export { consentRowsAreApproved, createVoiceNoteSession, withRecordingDeleted } from './voice-note-session';
export type { VoiceNoteDevice } from './voice-note-runtime';
export { createDeviceVoiceNotes, createInertVoiceNoteDevice, createVoiceNoteSessionRuntime, mintVoiceNoteId } from './voice-note-runtime';
export type { VoiceNoteSurfaceSlots } from './VoiceNoteViews';
export { durationText, useVoiceNoteSurface, voiceNoteRest, VOICE_NOTE_SLAB_WIDTH } from './VoiceNoteViews';
export { VoiceNoteApiClient } from './voice-note-api';
export { availableUntilText, voiceConsentText, voiceNotePair, voiceNoteText, VOICE_CONSENT_COPY_ROWS, VOICE_NOTE_COPY_ROWS } from './voice-note-copy';
export { VoiceNoteSettingsSection, voiceNoteSettingsShown } from './VoiceNoteSettingsSection';
