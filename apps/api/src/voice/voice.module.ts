import { Module } from '@nestjs/common';
import { ObservabilityModule } from '../observability/observability.module';
import { VoiceMediaModule } from '../voice-media/voice-media.module';
import { MachineAsrConfidenceStartupCheck } from './asr-confidence/machine-asr-confidence.startup-check';
import { BATCH_TRANSCRIPTION_JOBS } from './batch-transcription-jobs.port';
import { SpeechmaticsBatchJobsAdapter } from './speechmatics/speechmatics-batch-jobs.adapter';
import { loadSpeechmaticsBatchConfig, loadVoiceTranscriptionWorkerConfig } from './speechmatics/speechmatics-batch.config';
import { VOICE_NOTE_TRANSCRIPTION_WORKER_SETTINGS, VoiceNoteTranscriptionWorker } from './voice-note-transcription.worker';

/**
 * S8B-03 (CP1, §4.10.3) — the voice runtime module: the ONLY place that binds the batch transcription jobs port to its
 * provider adapter (`voice/speechmatics/`), and only when the server key is set (otherwise the port is null and the
 * worker stays off). The configuration is read and validated once here, at startup (rate limits × declared instances
 * within the provider's limits, the band thresholds' bounds, E13), and a misconfiguration refuses to start. No fake is
 * bound. It re-exports VoiceMediaModule so its composer (ConversationModule, which runs a committed note's turn) reaches
 * the owner's voice routes and the note repository through one import.
 */
@Module({
  imports: [ObservabilityModule, VoiceMediaModule],
  providers: [
    { provide: VOICE_NOTE_TRANSCRIPTION_WORKER_SETTINGS, useFactory: () => loadVoiceTranscriptionWorkerConfig() },
    {
      provide: BATCH_TRANSCRIPTION_JOBS,
      useFactory: () => {
        const config = loadSpeechmaticsBatchConfig();
        return config.apiKey ? new SpeechmaticsBatchJobsAdapter({ ...config, apiKey: config.apiKey }) : null;
      },
    },
    VoiceNoteTranscriptionWorker,
    MachineAsrConfidenceStartupCheck,
  ],
  exports: [VoiceMediaModule],
})
export class VoiceModule {}
