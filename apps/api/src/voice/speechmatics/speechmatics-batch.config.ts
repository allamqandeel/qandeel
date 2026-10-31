import { asrBandThresholds, type AsrBandThresholds } from '../asr-confidence/asr-confidence';

/**
 * S8B-03 (CP1, contract §4.6.1 / §4.10.3 / §8.1) — the ONE reader of the environment under `apps/api/src/voice/`.
 * Every value is validated at startup and the server refuses to start outside the governed bounds. The key is a server
 * secret: it is never logged, never returned and never sent to a client; without it the batch port is not bound and the
 * transcription worker stays off. The attempt limits, the quarantine and the deletion horizon are NOT configured here:
 * the database policy (`voice_private.transcription_policy_v1`) is their one authority.
 */
export interface SpeechmaticsBatchConfig {
  /** Absent → the batch port is not bound and the worker is disabled. */
  readonly apiKey: string | null;
  readonly baseUrl: string;
  /** Reconciliation by tracking reference (PC-S2): off until it is proven. */
  readonly reconcileByReference: boolean;
  readonly createsPerSecond: number;
  readonly readsPerSecond: number;
  readonly declaredInstances: number;
}

export interface VoiceTranscriptionWorkerConfig {
  readonly enabled: boolean;
  readonly concurrency: number;
  readonly thresholds: AsrBandThresholds;
}

/** The EU batch endpoint (S8B-01 D-B1); configurable, never an unencrypted remote host. */
export const DEFAULT_SPEECHMATICS_BATCH_BASE_URL = 'https://eu1.asr.api.speechmatics.com';
/** The provider's documented per-account limits: job creation 10 / s, other requests 50 / s. */
export const PROVIDER_LIMITS = Object.freeze({ createsPerSecond: 10, readsPerSecond: 50 });

type Environment = Record<string, string | undefined>;

function integer(environment: Environment, name: string, fallback: number, min: number, max: number): number {
  const raw = environment[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer within [${min}, ${max}]`);
  return value;
}

export function loadSpeechmaticsBatchConfig(environment: Environment = process.env): SpeechmaticsBatchConfig {
  const key = environment.SPEECHMATICS_API_KEY?.trim();
  const baseUrl = (environment.SPEECHMATICS_BATCH_BASE_URL?.trim() || DEFAULT_SPEECHMATICS_BATCH_BASE_URL).replace(/\/+$/u, '');
  const url = new URL(baseUrl);
  const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('SPEECHMATICS_BATCH_BASE_URL must be https (plain http only on a loopback test server)');
  }
  if (url.username || url.password || url.search || url.hash) throw new Error('SPEECHMATICS_BATCH_BASE_URL must carry no credentials, query or fragment');
  const createsPerSecond = integer(environment, 'SPEECHMATICS_BATCH_CREATES_PER_SECOND', 2, 1, PROVIDER_LIMITS.createsPerSecond);
  const readsPerSecond = integer(environment, 'SPEECHMATICS_BATCH_READS_PER_SECOND', 10, 1, PROVIDER_LIMITS.readsPerSecond);
  const declaredInstances = integer(environment, 'VOICE_API_INSTANCES', 1, 1, 64);
  // §4.6.1: refuse to start when the declared instances × the per-instance limit exceed the provider's limits.
  if (declaredInstances * createsPerSecond > PROVIDER_LIMITS.createsPerSecond || declaredInstances * readsPerSecond > PROVIDER_LIMITS.readsPerSecond) {
    throw new Error('VOICE_API_INSTANCES × the per-instance Speechmatics rate limits exceed the provider limits');
  }
  return Object.freeze({
    apiKey: key ? key : null,
    baseUrl: url.origin + url.pathname.replace(/\/+$/u, ''),
    reconcileByReference: environment.SPEECHMATICS_RECONCILE_BY_REFERENCE === 'true',
    createsPerSecond,
    readsPerSecond,
    declaredInstances,
  });
}

/**
 * The worker's switches. Off in `test`, off without the key, off without the database and media configuration, and off
 * when explicitly disabled. Concurrency defaults to 2 (at most 4).
 */
export function loadVoiceTranscriptionWorkerConfig(environment: Environment = process.env): VoiceTranscriptionWorkerConfig {
  const batch = loadSpeechmaticsBatchConfig(environment);
  const enabled = Boolean(batch.apiKey && environment.SUPABASE_URL && environment.SUPABASE_SERVICE_ROLE_KEY
    && environment.QANDEEL_MEDIA_S3_ENDPOINT && environment.QANDEEL_MEDIA_S3_BUCKET)
    && environment.NODE_ENV !== 'test' && environment.VOICE_TRANSCRIPTION_WORKER_DISABLED !== 'true';
  return Object.freeze({
    enabled,
    concurrency: integer(environment, 'VOICE_TRANSCRIPTION_CONCURRENCY', 2, 1, 4),
    thresholds: asrBandThresholds(environment.VOICE_ASR_BAND_HIGH, environment.VOICE_ASR_BAND_MEDIUM),
  });
}
