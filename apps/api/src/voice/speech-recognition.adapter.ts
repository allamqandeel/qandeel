import type { AiUsageSource, AiVoiceOperation } from '../ai-usage/ai-usage.types';

/**
 * S8B-02 (CP2, contract §3.11) — the speech recognition PORT. An interface only: S8B-02 ships no production adapter and
 * no network code. S8B-03 (batch, Voice Notes) and S8B-05 (streaming, the live call) bind the Speechmatics adapter behind
 * it (S8B-01 D-B1: `ar_en`), so provider-specific logic stays behind this abstraction (AGENTS.md §4).
 *
 * What every adapter reports, and what it must never claim:
 *   - text with a confidence BAND (HIGH / MEDIUM / LOW), never a calibrated probability. A transcript is a machine
 *     transcript (MACHINE_ASR), never the human's verbatim text (D-7);
 *   - interim results are provisional and are never committed; only a final result is;
 *   - timing on the recording's clock `[startMs, endMs)`, for the turn anchor (D-3) - no word alignment is claimed;
 *   - usage in the ledger's own kind (AUDIO_INPUT_MS) with its SOURCE: PROVIDER_REPORTED when the provider reported it,
 *     GATEWAY_MEASURED when only QANDEEL's gateway measured the streamed audio - which is never evidence of what the
 *     provider billed (D-2). An adapter that knows nothing reports ABSENT, never zero.
 */
export const SPEECH_RECOGNITION_ADAPTER = Symbol('SPEECH_RECOGNITION_ADAPTER');

export type AsrConfidenceBand = 'HIGH' | 'MEDIUM' | 'LOW';
export type SpeechRecognitionOperation = Extract<AiVoiceOperation, 'SPEECHMATICS_REALTIME_TRANSCRIPTION' | 'SPEECHMATICS_BATCH_TRANSCRIPTION'>;

export interface RecognizedSpeech {
  readonly text: string;
  readonly band: AsrConfidenceBand;
  readonly startMs: number;
  readonly endMs: number;
}

/** The usage of one recognition call, in the ledger's kind, with where the quantity came from (D-2). */
export type SpeechRecognitionUsage =
  | { readonly completeness: 'COMPLETE'; readonly audioInputMs: number; readonly source: AiUsageSource }
  | { readonly completeness: 'ABSENT' };

export interface BatchRecognitionRequest {
  /** The audio, already read by the caller from the private store; an adapter never receives a key or URL. */
  readonly audio: AsyncIterable<Buffer>;
  readonly contentType: 'audio/mp4' | 'audio/ogg';
  readonly language: 'ar_en';
  readonly signal: AbortSignal;
}

export interface BatchRecognitionResult {
  readonly operation: 'SPEECHMATICS_BATCH_TRANSCRIPTION';
  readonly segments: readonly RecognizedSpeech[];
  readonly usage: SpeechRecognitionUsage;
}

export type StreamingRecognitionEvent =
  | { readonly kind: 'INTERIM'; readonly speech: RecognizedSpeech }
  | { readonly kind: 'FINAL'; readonly speech: RecognizedSpeech };

export interface StreamingRecognitionSession {
  /** Sends one chunk of audio; resolves when the adapter accepted it. */
  send(chunk: Buffer): Promise<void>;
  /** Interim and final results, in order, until the session ends. */
  readonly events: AsyncIterable<StreamingRecognitionEvent>;
  /** Ends the audio and settles the session's usage. A crashed session reports ABSENT, never zero. */
  end(): Promise<{ readonly operation: 'SPEECHMATICS_REALTIME_TRANSCRIPTION'; readonly usage: SpeechRecognitionUsage }>;
  abort(): void;
}

export interface SpeechRecognitionAdapter {
  readonly provider: 'SPEECHMATICS';
  transcribe(request: BatchRecognitionRequest): Promise<BatchRecognitionResult>;
  openStream(request: { readonly language: 'ar_en'; readonly signal: AbortSignal }): Promise<StreamingRecognitionSession>;
}
