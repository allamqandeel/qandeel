/**
 * S8B-03 (CP1, contract §4.10) — the BATCH transcription jobs PORT: the durable half of the ASR port family. An interface
 * only: no network, no environment, no provider logic. `SpeechRecognitionAdapter.transcribe` is NOT durable (one call that
 * consumes the audio and returns segments, with no job identity to resume, poll or delete after a crash); the production
 * batch path goes through this port. Its only production caller is `VoiceNoteTranscriptionWorker`; its only production
 * implementation lives under `voice/speechmatics/` and is bound by `voice.module.ts` only when the server key is set.
 *
 * Rules every implementation keeps:
 *   - no method throws for an expected outcome: a thrown error is a programming fault, which the worker treats as TRANSIENT;
 *   - no durable state, and no internal retry of `submit`. One internal retry of `status` / `fetchResult` / `remove` on a
 *     network error only (reads and idempotent deletes);
 *   - `submit` answers NOT_SENT only when it failed before any body byte left; once a byte may have left without a decisive
 *     answer (a timeout, a dropped connection, an aborted signal) it answers UNKNOWN, never "not created";
 *   - words come back as the provider reported them. The band is QANDEEL's own (`asr-confidence/`), and no word confidence
 *     is a probability of meaning;
 *   - `findByReference` answers UNSUPPORTED until reconciliation by reference is proven and enabled;
 *   - no transcript, audio, job id or key is ever logged.
 */
export const BATCH_TRANSCRIPTION_JOBS = Symbol('BATCH_TRANSCRIPTION_JOBS');

/** Opaque provider job identity: the worker stores it, never parses it; never logged. */
export type ProviderJobId = string & { readonly __brand: 'ProviderJobId' };

export interface BatchSubmitRequest {
  /** Read by the worker through VoiceMediaService; no key, no URL. */
  readonly audio: AsyncIterable<Buffer>;
  /** Exact, from recording_objects.byte_size. */
  readonly byteSize: number;
  readonly contentType: 'audio/mp4';
  readonly language: 'ar_en';
  /** = attempt_id (a random UUID, no user data), sent as the job's tracking reference. */
  readonly reference: string;
  /** Ends THIS call only; never cancels the durable process. */
  readonly signal: AbortSignal;
}

export type PermanentBatchFailure = 'UNSUPPORTED_AUDIO' | 'CONFIG_REJECTED' | 'TOO_LARGE' | 'AUTH';
export type TransientBatchFailure = 'RATE_LIMITED' | 'UNAVAILABLE' | 'TIMEOUT' | 'NETWORK';
export type BatchFailure = PermanentBatchFailure | TransientBatchFailure;

export type SubmitOutcome =
  | { readonly kind: 'CREATED'; readonly jobId: ProviderJobId }
  | { readonly kind: 'REJECTED'; readonly failure: PermanentBatchFailure }
  /** Proven: no body byte left. `retryAfterMs` is the provider's Retry-After, when it sent one. */
  | { readonly kind: 'NOT_SENT'; readonly failure: Extract<BatchFailure, 'RATE_LIMITED' | 'UNAVAILABLE' | 'NETWORK'>; readonly retryAfterMs?: number }
  /** Bytes may have left and no decisive answer arrived: never treated as "not created". */
  | { readonly kind: 'UNKNOWN' };

export type JobStatus =
  | { readonly kind: 'RUNNING' }
  | { readonly kind: 'DONE' }
  | { readonly kind: 'FAILED'; readonly failure: BatchFailure }
  /** 404 / 410: the API no longer serves the job. */
  | { readonly kind: 'ABSENT' }
  | { readonly kind: 'TRANSIENT'; readonly failure: BatchFailure };

export interface RecognizedWord {
  readonly text: string;
  /** Provider-reported, NOT a probability of meaning; null when absent (-> LOW). */
  readonly confidence: number | null;
  readonly startMs: number;
  readonly endMs: number;
}

export type FetchOutcome =
  | { readonly kind: 'RESULT'; readonly words: readonly RecognizedWord[]; readonly providerDurationMs: number | null }
  | { readonly kind: 'MALFORMED' }
  | { readonly kind: 'ABSENT' }
  | { readonly kind: 'TRANSIENT'; readonly failure: BatchFailure };

export type RemovalOutcome =
  | { readonly kind: 'REQUESTED' }
  | { readonly kind: 'ABSENT' }
  | { readonly kind: 'LOCKED' }
  | { readonly kind: 'TRANSIENT'; readonly failure: BatchFailure };

export type FindOutcome =
  | { readonly kind: 'FOUND'; readonly jobId: ProviderJobId }
  | { readonly kind: 'NOT_FOUND_IN_COMPLETE_LISTING' }
  /** The default until reconciliation by reference (PC-S2) is proven and enabled. */
  | { readonly kind: 'UNSUPPORTED' }
  | { readonly kind: 'TRANSIENT'; readonly failure: BatchFailure };

export interface BatchTranscriptionJobs {
  readonly provider: 'SPEECHMATICS';
  submit(request: BatchSubmitRequest): Promise<SubmitOutcome>;
  status(jobId: ProviderJobId, signal: AbortSignal): Promise<JobStatus>;
  fetchResult(jobId: ProviderJobId, signal: AbortSignal): Promise<FetchOutcome>;
  remove(jobId: ProviderJobId, signal: AbortSignal): Promise<RemovalOutcome>;
  findByReference(reference: string, signal: AbortSignal): Promise<FindOutcome>;
}

/** The permanent failures: a rejection that no retry can change. */
export const PERMANENT_BATCH_FAILURES: readonly PermanentBatchFailure[] = ['UNSUPPORTED_AUDIO', 'CONFIG_REJECTED', 'TOO_LARGE', 'AUTH'];
export const isPermanentBatchFailure = (failure: BatchFailure): failure is PermanentBatchFailure =>
  (PERMANENT_BATCH_FAILURES as readonly string[]).includes(failure);
