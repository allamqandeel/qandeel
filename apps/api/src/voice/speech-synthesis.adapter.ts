/**
 * S8B-02 (CP2, contract §3.11) — the speech synthesis PORT. An interface only: no network code here; provider-specific logic
 * stays behind this abstraction.
 *
 * S8B-04 (CP1, contract v1.2 §9.1) corrects the earlier note: the production adapter is the Google Cloud (Vertex AI)
 * route, `aiplatform.googleapis.com` `streamGenerateContent`, model `gemini-3.8-flash-tts`, voice `Achird` (one route, no
 * fallback; VA-11R). It lives in `voice/vertex-speech/`; this port gains the classified failure below.
 *
 * What every adapter reports:
 *   - the audio as ordered chunks, so the caller can begin playback before synthesis ends (and stop it: barge-in is the
 *     caller's, S8B-05 / S8B-06);
 *   - the voice it used, and whether it honoured a delivery hint (`hintApplied`), never assumed;
 *   - usage exactly as the provider reports it (D-1): INPUT_TOKEN for the text in and AUDIO_OUTPUT_TOKEN for the audio
 *     out - never converted to characters or milliseconds. A synthesis with no usage reports ABSENT, never zero.
 *   - on failure, a `SpeechSynthesisFailure`: its class, whether audio had started and whether the provider was reached.
 *     Nothing else - never the text, a status body or a credential.
 */
export const SPEECH_SYNTHESIS_ADAPTER = Symbol('SPEECH_SYNTHESIS_ADAPTER');

export interface SpeechSynthesisRequest {
  readonly text: string;
  readonly voiceId: string;
  /** A delivery hint (pace, warmth); an adapter that cannot honour it says so in the result. */
  readonly hint: string | null;
  readonly signal: AbortSignal;
  /** S8B-04: the whole synthesis's bound, from the request to the last byte; absent, the adapter's own. */
  readonly timeoutMs?: number;
}

export interface SynthesizedChunk {
  readonly sequence: number;
  readonly audio: Buffer;
  readonly contentType: 'audio/pcm' | 'audio/ogg';
}

export type SpeechSynthesisUsage =
  | { readonly completeness: 'COMPLETE'; readonly inputTokens: number; readonly audioOutputTokens: number; readonly source: 'PROVIDER_REPORTED' }
  | { readonly completeness: 'ABSENT' };

export interface SpeechSynthesisResult {
  readonly operation: 'GEMINI_SPEECH_GENERATION';
  readonly voiceId: string;
  readonly hintApplied: boolean;
  readonly usage: SpeechSynthesisUsage;
  /** S8B-04: for `audio/pcm` chunks, signed 16-bit little-endian mono at this rate. */
  readonly pcmSampleRate?: number;
}

export interface SpeechSynthesisSession {
  readonly chunks: AsyncIterable<SynthesizedChunk>;
  /** Resolves after the last chunk (or the abort) with what was used; rejects with a SpeechSynthesisFailure. */
  readonly result: Promise<SpeechSynthesisResult>;
}

export interface SpeechSynthesisAdapter {
  readonly provider: 'GEMINI';
  /** Whether a delivery hint can be honoured at all, so the caller never relies on one that is not. */
  readonly supportsHints: boolean;
  synthesize(request: SpeechSynthesisRequest): SpeechSynthesisSession;
}

/**
 * S8B-04 (CP1) — the classes of a failed synthesis:
 *   OVERLOADED (429) · UNAVAILABLE (408, 500, 502, 503, 504) · NETWORK (the connection failed or broke before any audio) ·
 *   UNAUTHORIZED (401, 403) · REJECTED (any other refusal) · FIRST_BYTE_TIMEOUT · TIMEOUT (the whole bound) ·
 *   INTERRUPTED (the stream failed after audio had started) · EMPTY (it ended with no audio) · MALFORMED (an answer
 *   that cannot be read as the documented stream) · TOO_LARGE (more audio than the bound) · CANCELLED (the caller's
 *   signal) · CREDENTIALS (no access token: the provider was never reached).
 */
export type SpeechSynthesisFailureKind = 'OVERLOADED' | 'UNAVAILABLE' | 'NETWORK' | 'UNAUTHORIZED' | 'REJECTED'
  | 'FIRST_BYTE_TIMEOUT' | 'TIMEOUT' | 'INTERRUPTED' | 'EMPTY' | 'MALFORMED' | 'TOO_LARGE' | 'CANCELLED' | 'CREDENTIALS';

const RETRYABLE_BEFORE_AUDIO: ReadonlySet<SpeechSynthesisFailureKind> = new Set(['OVERLOADED', 'UNAVAILABLE', 'NETWORK']);
const CAPACITY_OR_SYSTEM: ReadonlySet<SpeechSynthesisFailureKind> = new Set(['OVERLOADED', 'UNAVAILABLE', 'NETWORK', 'FIRST_BYTE_TIMEOUT', 'TIMEOUT', 'INTERRUPTED']);

export class SpeechSynthesisFailure extends Error {
  constructor(
    readonly kind: SpeechSynthesisFailureKind,
    readonly audioStarted: boolean,
    readonly providerReached: boolean,
  ) {
    super(`SPEECH_SYNTHESIS_${kind}`);
    this.name = 'SpeechSynthesisFailure';
  }

  /**
   * §9.3: one more attempt is allowed only before any audio, and only for a transient capacity or transport failure
   * (408, 429, 500, 502, 503, 504, a broken connection). A timeout is NOT retried: the provider may still be working,
   * and a second paid attempt could duplicate it (I-7).
   */
  get retryable(): boolean {
    return !this.audioStarted && RETRYABLE_BEFORE_AUDIO.has(this.kind);
  }

  /** Whether it counts toward the circuit breaker (capacity or system errors, §9.3), never a refusal or a cancel. */
  get capacityOrSystem(): boolean {
    return CAPACITY_OR_SYSTEM.has(this.kind);
  }
}

/** Gathers a session's PCM, bounded; a session that is not PCM, or exceeds the bound, fails without keeping more. */
export async function collectSpeechPcm(session: SpeechSynthesisSession, maxBytes: number): Promise<{ readonly pcm: Buffer; readonly result: SpeechSynthesisResult }> {
  const parts: Buffer[] = [];
  let bytes = 0;
  let started = false;
  try {
    for await (const chunk of session.chunks) {
      if (chunk.contentType !== 'audio/pcm') throw new SpeechSynthesisFailure('MALFORMED', started, true);
      started = started || chunk.audio.length > 0;
      bytes += chunk.audio.length;
      if (bytes > maxBytes) throw new SpeechSynthesisFailure('TOO_LARGE', true, true);
      parts.push(chunk.audio);
    }
  } catch (error) {
    session.result.catch(() => undefined);
    throw error;
  }
  return { pcm: Buffer.concat(parts, bytes), result: await session.result };
}
