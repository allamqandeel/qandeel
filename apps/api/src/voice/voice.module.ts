import { Module } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseAuthService } from '../auth/supabase-auth.service';
import { SupabaseServiceRoleApiService } from '../conversation/supabase-service-role-api.service';
import { ObservabilityModule } from '../observability/observability.module';
import { FAST_VOICE_PATH, type FastVoicePath } from '../voice-media/fast-voice-path.port';
import { VoiceMediaModule } from '../voice-media/voice-media.module';
import { LiveVoiceNoteController } from './live-note/live-voice-note.controller';
import { LiveVoiceNoteRepository } from './live-note/live-voice-note.repository';
import {
  LIVE_VOICE_NOTE_SETTINGS, LIVE_VOICE_NOTE_STORE, LiveVoiceNoteService, REALTIME_RECOGNITION, type LiveVoiceNoteSettings, type RealtimeRecognition,
} from './live-note/live-voice-note.service';
import { LiveReplyController } from './live-reply/live-reply.controller';
import { LiveReplyRepository } from './live-reply/live-reply.repository';
import { LiveReplyService } from './live-reply/live-reply.service';
import { LIVE_REPLY_STORE } from './live-reply/live-reply.store';
import { loadSpeechmaticsRealtimeConfig } from './speechmatics/speechmatics-realtime.config';
import { SpeechmaticsRealtimeAdapter } from './speechmatics/speechmatics-realtime.adapter';
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
 *
 * S8B-04 (CP2, Fast Voice Path): the automatic voice reply (LiveReplyService, the same synthesis route, server-started)
 * and the live voice note (LiveVoiceNoteService). The realtime recognizer is bound ONLY when the server key is set AND
 * VOICE_NOTE_LIVE_TRANSCRIPT=ADOPT (realtime quality accepted first); otherwise null and no audio is ever streamed. The
 * voice media module reaches both through FAST_VOICE_PATH, resolved at call time (it still imports no provider).
 */
@Module({
  imports: [ObservabilityModule, VoiceMediaModule],
  controllers: [ReplyListenController, LiveReplyController, LiveVoiceNoteController],
  providers: [
    SupabaseAuthService,
    SupabaseAuthGuard,
    SupabaseServiceRoleApiService,
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
    { provide: LIVE_REPLY_STORE, useClass: LiveReplyRepository },
    LiveReplyService,
    { provide: LIVE_VOICE_NOTE_STORE, useClass: LiveVoiceNoteRepository },
    {
      provide: LIVE_VOICE_NOTE_SETTINGS,
      useFactory: (): LiveVoiceNoteSettings => {
        const config = loadSpeechmaticsRealtimeConfig();
        return { mode: config.liveTranscript, thresholds: config.thresholds };
      },
    },
    {
      provide: REALTIME_RECOGNITION,
      useFactory: (): RealtimeRecognition | null => {
        const config = loadSpeechmaticsRealtimeConfig();
        if (config.liveTranscript !== 'ADOPT' || !config.apiKey) return null;
        return new SpeechmaticsRealtimeAdapter({ ...config, apiKey: config.apiKey });
      },
    },
    LiveVoiceNoteService,
    {
      provide: FAST_VOICE_PATH,
      useFactory: (notes: LiveVoiceNoteService, replies: LiveReplyService): FastVoicePath => ({
        finishLiveNote: (userId, liveId, sentChunks, provenDurationMs) => notes.finish(userId, liveId, sentChunks, provenDurationMs),
        discardLiveNote: (userId, liveId) => notes.cancel(userId, liveId).catch(() => undefined),
        openReply: (userId, sessionId, sourceTurnId) => replies.open(userId, sessionId, sourceTurnId),
        attachExchange: (userId, replyId, exchange) => replies.attachExchange(userId, replyId, exchange),
      }),
      inject: [LiveVoiceNoteService, LiveReplyService],
    },
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
