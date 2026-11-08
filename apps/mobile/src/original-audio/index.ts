/**
 * S8B-07 CP1-B — original audio on the phone: listening to a finished call's recording (Sheet A) and a Replay's original
 * audio (Sheet B), streamed from the Replay Media Service, one subject at a time, under the live call.
 */
export { AudioLine } from './AudioLine';
export type { AudioLineProps } from './AudioLine';
export { createCallListening } from './call-listening';
export type { CallListening, CallListeningOptions } from './call-listening';
export { CALL_LISTENING_TEST_ID, CallRecordListening, callEndedRow, callListeningView } from './CallListeningViews';
export type { CallListeningView } from './CallListeningViews';
export { lengthText, ORIGINAL_AUDIO_COPY_GATE, ORIGINAL_AUDIO_COPY_ROWS, originalAudioLengthText, originalAudioText } from './original-audio-copy';
export type { OriginalAudioCopyId, OriginalAudioCopyRow } from './original-audio-copy';
export { createPlaybackOwner } from './playback-owner';
export type { LiveCallSignal, PlaybackClaim, PlaybackOwner, PlaybackReleaseCause } from './playback-owner';
export { boundaryPauseMs, decodePresentationMap, firstWindowOf, momentAt, spanAt, windowAt } from './presentation-map';
export type { PresentationBoundary, PresentationMap, PresentationRun, PresentationSpan } from './presentation-map';
export { createReplayAudio } from './replay-audio';
export type { ReplayAudio, ReplayAudioOptions } from './replay-audio';
export { createReplayAudioClock, planFor } from './replay-audio-clock';
export type { ReplayAudioAnnouncement, ReplayAudioClock, ReplayAudioDetail, ReplayAudioPlan } from './replay-audio-clock';
export { REPLAY_AUDIO_TEST_ID, announcementText, createReplayAudioSurface, frameText, replayEndedRow } from './ReplayAudioViews';
export { TransientMediaApiClient } from './transient-media-api';
export { useVoicePassageSelection, voicePassages, withVoicePassages } from './voice-passage-selection';
export type { UnitCounts, VoicePassageWords } from './voice-passage-selection';
export type { TransientRequestResult, TransientSetView, TransientStatusResult, TransientUnavailableReason } from './transient-media-api';
export { createTransientPlayback, TRANSIENT_RENEWAL_LEAD_MS } from './transient-playback';
export type { TransientPlayback, TransientPlaybackEvent, TransientPlaybackPhase, TransientPlaybackState } from './transient-playback';
