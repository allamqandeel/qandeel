/**
 * S8B-04 (CP1, contract v1.2 §5 / §9.1 / §9.3) — the Google Cloud TTS route's configuration, the second (and only other)
 * reader of the environment under `apps/api/src/voice/` (beside `speechmatics/`).
 *
 * What is NOT configurable (I-5, VA-11R): the host `aiplatform.googleapis.com`, the method `streamGenerateContent`, the
 * location `global`, the model `gemini-3.8-flash-tts` and the voice `Achird`. One route, no fallback; changing any of them
 * is a controlled change, not a setting. The only override of the base URL is a plain-http LOOPBACK test server (the fake
 * Vertex server); any other value refuses to start.
 *
 * Authentication is Application Default Credentials only (no API key exists on this route). Without a project the port is
 * not bound and Listen answers NOT_AVAILABLE_NOW-equivalent refusals; nothing is ever sent.
 *
 * Every number in VERTEX_SPEECH_LIMITS is PROPOSED (§9.3): a governed setting, tuned by S8B-08 from real use — NOT a
 * measurement of Google's capacity.
 */
export const VERTEX_SPEECH_MODEL = 'gemini-3.8-flash-tts';
export const VERTEX_SPEECH_VOICE = 'Achird';
export const VERTEX_SPEECH_LOCATION = 'global';
export const VERTEX_SPEECH_BASE_URL = 'https://aiplatform.googleapis.com';
export const VERTEX_SPEECH_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

export interface VertexSpeechLimits {
  readonly firstByteTimeoutMs: number;
  readonly segmentRtf: number;
  readonly segmentSlackMs: number;
  readonly retryJitterMinMs: number;
  readonly retryJitterMaxMs: number;
  readonly maxInFlight: number;
  readonly maxQueued: number;
  readonly maxQueueWaitMs: number;
  readonly breakerErrors: number;
  readonly breakerWindowMs: number;
  readonly breakerOpenMs: number;
}

export const VERTEX_SPEECH_LIMITS: VertexSpeechLimits = Object.freeze({
  /** D-A1 (S8B-01): the first audio byte must arrive within 2,000 ms of the request. */
  firstByteTimeoutMs: 2_000,
  /** The whole segment: RTF p95 0.57 × the segment's longest audio + 2 s (§9.9); measured in P-1. */
  segmentRtf: 0.57,
  segmentSlackMs: 2_000,
  /** One more attempt, before any audio only, after 200–600 ms of jitter. */
  retryJitterMinMs: 200,
  retryJitterMaxMs: 600,
  /** Per instance: 4 running, 8 queued, at most 1 s of queueing. */
  maxInFlight: 4,
  maxQueued: 8,
  maxQueueWaitMs: 1_000,
  /** 5 capacity / system errors within 60 s open the breaker for 30 s. */
  breakerErrors: 5,
  breakerWindowMs: 60_000,
  breakerOpenMs: 30_000,
});

export interface VertexSpeechConfig {
  /** Absent → the synthesis port is not bound; nothing is sent. */
  readonly projectId: string | null;
  readonly baseUrl: string;
}

type Environment = Record<string, string | undefined>;

export function loadVertexSpeechConfig(environment: Environment = process.env): VertexSpeechConfig {
  const project = environment.QANDEEL_VERTEX_TTS_PROJECT?.trim();
  if (project && !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/u.test(project)) throw new Error('QANDEEL_VERTEX_TTS_PROJECT must be a Google Cloud project id');
  const override = environment.QANDEEL_VERTEX_TTS_BASE_URL?.trim();
  let baseUrl = VERTEX_SPEECH_BASE_URL;
  if (override) {
    const url = new URL(override);
    const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]';
    if (url.protocol !== 'http:' || !loopback || url.pathname !== '/' || url.username || url.password || url.search || url.hash) {
      throw new Error('QANDEEL_VERTEX_TTS_BASE_URL may only name a plain-http loopback test server (origin only)');
    }
    baseUrl = url.origin;
  }
  return Object.freeze({ projectId: project ? project : null, baseUrl });
}

/** The one endpoint: `{base}/v1/projects/{project}/locations/global/publishers/google/models/{model}:streamGenerateContent?alt=sse`. */
export function vertexSpeechEndpoint(config: VertexSpeechConfig & { readonly projectId: string }): string {
  return `${config.baseUrl}/v1/projects/${encodeURIComponent(config.projectId)}/locations/${VERTEX_SPEECH_LOCATION}`
    + `/publishers/google/models/${VERTEX_SPEECH_MODEL}:streamGenerateContent?alt=sse`;
}

/** The segment's whole bound: 0.57 × its longest audio (estimated as one second per 10 characters, rounded up) + 2 s. */
export function segmentTimeoutMs(spokenText: string): number {
  const longestAudioSeconds = Math.max(1, Math.ceil([...spokenText].length / 10));
  return Math.ceil(VERTEX_SPEECH_LIMITS.segmentRtf * longestAudioSeconds * 1000) + VERTEX_SPEECH_LIMITS.segmentSlackMs;
}
