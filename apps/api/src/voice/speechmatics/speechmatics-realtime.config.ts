import { asrBandThresholds, type AsrBandThresholds } from '../asr-confidence/asr-confidence';

/**
 * S8B-04 (CP2, the fast voice path) — the Speechmatics REALTIME (streaming socket) recognition configuration. Every value is
 * validated at startup; the server refuses to start outside the governed bounds. The key is the same server secret as the
 * batch route (`SPEECHMATICS_API_KEY`): it is never logged, never returned, never sent to a client and never part of an
 * error message. Without it the realtime adapter is not bound.
 *
 * What is NOT configurable: the recognition settings below are the configuration S8B-01 measured in its final engineering
 * proof (scripts/s8b-01/asr-sm-proof-plan.json, arm ENHANCED_AR_EN_FAST; evidence record §9.20: ForceEndOfUtterance
 * answered p50 164 ms / p95 216 ms). Changing any of them is a controlled change, not a setting.
 */

/** The EU realtime endpoint the S8B-01 probe pinned (asr-sm-proof-plan.json `endpointUrl`). */
export const DEFAULT_SPEECHMATICS_REALTIME_URL = 'wss://eu.rt.speechmatics.com/v2';

export const SPEECHMATICS_REALTIME_RECOGNITION = Object.freeze({
  language: 'ar_en',
  operatingPoint: 'enhanced',
  /** Speechmatics' minimum; the measured value. */
  maxDelayS: 0.7,
  /** Kept: it held every number correct, and ForceEndOfUtterance releases what it holds. */
  maxDelayMode: 'flexible',
  /** Speechmatics' own end-of-utterance trigger is OFF: QANDEEL decides when to finalize (ForceEndOfUtterance). */
  endOfUtteranceSilenceTriggerS: 0,
  encoding: 'pcm_s16le',
  sampleRate: 16_000,
});

/** 16 kHz × 2 bytes, mono: the gateway's measure of the audio it streamed. */
export const SPEECHMATICS_REALTIME_BYTES_PER_MS = 32;

export interface SpeechmaticsRealtimeLimits {
  /** RecognitionStarted must arrive within this time of opening the socket. */
  readonly startTimeoutMs: number;
  /** The evidence record's governed ForceEndOfUtterance answer timeout (≈ 4.6 × the measured p95 of 216 ms). */
  readonly finalizeTimeoutMs: number;
  /** EndOfTranscript must arrive within this time of EndOfStream. */
  readonly endTimeoutMs: number;
  /** Bytes the socket may hold unwritten before the next frame waits. */
  readonly maxBufferedBytes: number;
  /** Bytes accepted by `send` but not yet written (e.g. before RecognitionStarted); beyond it the session fails. */
  readonly maxPendingBytes: number;
}

export const SPEECHMATICS_REALTIME_LIMITS: SpeechmaticsRealtimeLimits = Object.freeze({
  startTimeoutMs: 5_000,
  finalizeTimeoutMs: 1_000,
  endTimeoutMs: 5_000,
  maxBufferedBytes: 64 * 1024, // 2 s of audio
  maxPendingBytes: 1024 * 1024, // ≈ 32 s of audio
});

export interface SpeechmaticsRealtimeConfig {
  /** Absent → the realtime adapter is not bound; nothing is ever sent. */
  readonly apiKey: string | null;
  readonly url: string;
  readonly thresholds: AsrBandThresholds;
  /**
   * S8B-04 (CP2): VOICE_NOTE_LIVE_TRANSCRIPT. ADOPT lets a qualifying live transcript stand for its recording; anything
   * else (the default) is OFF - no audio is streamed during a recording and the batch path transcribes every note.
   */
  readonly liveTranscript: 'OFF' | 'ADOPT';
}

type Environment = Record<string, string | undefined>;

export function loadSpeechmaticsRealtimeConfig(environment: Environment = process.env): SpeechmaticsRealtimeConfig {
  const key = environment.SPEECHMATICS_API_KEY?.trim();
  const raw = environment.SPEECHMATICS_REALTIME_URL?.trim() || DEFAULT_SPEECHMATICS_REALTIME_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('SPEECHMATICS_REALTIME_URL must be a valid wss:// URL');
  }
  if (url.protocol !== 'wss:') throw new Error('SPEECHMATICS_REALTIME_URL must be wss://');
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('SPEECHMATICS_REALTIME_URL must carry no credentials, query or fragment');
  }
  return Object.freeze({
    apiKey: key ? key : null,
    url: url.origin + url.pathname.replace(/\/+$/u, ''),
    thresholds: asrBandThresholds(environment.VOICE_ASR_BAND_HIGH, environment.VOICE_ASR_BAND_MEDIUM),
    liveTranscript: environment.VOICE_NOTE_LIVE_TRANSCRIPT?.trim() === 'ADOPT' ? 'ADOPT' : 'OFF',
  });
}
