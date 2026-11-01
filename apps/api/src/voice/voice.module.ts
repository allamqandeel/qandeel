import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { ObservabilityModule } from '../observability/observability.module';
import { VoiceMediaModule } from '../voice-media/voice-media.module';
import { MachineAsrConfidenceStartupCheck } from './asr-confidence/machine-asr-confidence.startup-check';
import { BATCH_TRANSCRIPTION_JOBS } from './batch-transcription-jobs.port';
import { SpeechmaticsBatchJobsAdapter } from './speechmatics/speechmatics-batch-jobs.adapter';
import { loadSpeechmaticsBatchConfig, loadVoiceTranscriptionWorkerConfig } from './speechmatics/speechmatics-batch.config';
import { VOICE_NOTE_TRANSCRIPTION_WORKER_SETTINGS, VoiceNoteTranscriptionWorker } from './voice-note-transcription.worker';
import { LISTEN_SYNTHESIS_ROUTE, type ListenSynthesisRoute } from './listen/listen-synthesis.route';
import { ReplyListenController } from './listen/reply-listen.controller';
import { ReplyListenService } from './listen/reply-listen.service';
import { SpeechAdmissionGuard } from './speech-admission.guard';
import { AdcAccessTokenSource } from './vertex-speech/vertex-speech.auth';
import { VertexSpeechAdapter } from './vertex-speech/vertex-speech.adapter';
import {
  loadVertexSpeechConfig, segmentTimeoutMs, VERTEX_SPEECH_LIMITS, VERTEX_SPEECH_MODEL, VERTEX_SPEECH_VOICE,
} from './vertex-speech/vertex-speech.config';

/**
 * S8B-03 (CP1, §4.10.3) — the voice runtime module: the ONLY place that binds the batch transcription jobs port to its
 * provider adapter (`voice/speechmatics/`), and only when the server key is set (otherwise the port is null and the
 * worker stays off). The configuration is read and validated once here, at startup (rate limits × declared instances
 * within the provider's limits, the band thresholds' bounds, E13), and a misconfiguration refuses to start. No fake is
 * bound. It re-exports VoiceMediaModule so its composer (ConversationModule, which runs a committed note's turn) reaches
 * the owner's voice routes and the note repository through one import.
 *
 * S8B-04 (CP1): it also binds the ONE speech synthesis route - Google Cloud TTS (`vertex-speech/`, ADC only) - and only
 * when a project is configured (otherwise null: Listen refuses before anything is written or sent). No fake is bound and
 * no fallback exists. «استمع» (ReplyListenController / ReplyListenService) lives here, beside the route it pays for.
 */
@Module({
  imports: [ObservabilityModule, VoiceMediaModule],
  controllers: [ReplyListenController],
  providers: [
    SupabaseAuthService,
    SupabaseAuthGuard,
    {
      provide: LISTEN_SYNTHESIS_ROUTE,
      useFactory: (): ListenSynthesisRoute | null => {
        const config = loadVertexSpeechConfig();
        if (!config.projectId) return null;
        const { retryJitterMinMs: min, retryJitterMaxMs: max } = VERTEX_SPEECH_LIMITS;
        return {
          adapter: new VertexSpeechAdapter({ ...config, projectId: config.projectId }, new AdcAccessTokenSource()),
          admission: new SpeechAdmissionGuard(VERTEX_SPEECH_LIMITS),
          model: VERTEX_SPEECH_MODEL,
          voiceId: VERTEX_SPEECH_VOICE,
          segmentTimeoutMs,
          retryDelayMs: () => min + Math.floor(Math.random() * (max - min + 1)),
        };
      },
    },
    ReplyListenService,
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
