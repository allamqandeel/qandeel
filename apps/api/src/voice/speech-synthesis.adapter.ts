/**
 * S8B-02 (CP2, contract §3.11) — the speech synthesis PORT. An interface only: S8B-02 ships no production adapter and no
 * network code. S8B-04 binds the production TTS adapter behind it (S8B-01 D-A1: `gemini-3.1-flash-tts-preview`, voice
 * Achird) with Speech Rendering, VA-7 and its route; provider-specific logic stays behind this abstraction.
 *
 * What every adapter reports:
 *   - the audio as ordered chunks, so the caller can begin playback before synthesis ends (and stop it: barge-in is the
 *     caller's, S8B-05 / S8B-06);
 *   - the voice it used, and whether it honoured a delivery hint (`hintApplied`), never assumed;
 *   - usage exactly as the provider reports it (D-1): INPUT_TOKEN for the text in and AUDIO_OUTPUT_TOKEN for the audio
 *     out - never converted to characters or milliseconds. A synthesis with no usage reports ABSENT, never zero.
 */
export const SPEECH_SYNTHESIS_ADAPTER = Symbol('SPEECH_SYNTHESIS_ADAPTER');

export interface SpeechSynthesisRequest {
  readonly text: string;
  readonly voiceId: string;
  /** A delivery hint (pace, warmth); an adapter that cannot honour it says so in the result. */
  readonly hint: string | null;
  readonly signal: AbortSignal;
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
}

export interface SpeechSynthesisSession {
  readonly chunks: AsyncIterable<SynthesizedChunk>;
  /** Resolves after the last chunk (or the abort) with what was used. */
  readonly result: Promise<SpeechSynthesisResult>;
}

export interface SpeechSynthesisAdapter {
  readonly provider: 'GEMINI';
  /** Whether a delivery hint can be honoured at all, so the caller never relies on one that is not. */
  readonly supportsHints: boolean;
  synthesize(request: SpeechSynthesisRequest): SpeechSynthesisSession;
}
