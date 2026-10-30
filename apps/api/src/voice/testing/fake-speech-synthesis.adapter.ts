import type {
  SpeechSynthesisAdapter, SpeechSynthesisRequest, SpeechSynthesisResult, SpeechSynthesisSession, SynthesizedChunk,
} from '../speech-synthesis.adapter';

/** The fake's rates: one input token per 4 UTF-8 bytes of text, 25 audio tokens and 640 bytes of audio per chunk. */
export const FAKE_TTS_CHUNK_BYTES = 640;
export const FAKE_TTS_AUDIO_TOKENS_PER_CHUNK = 25;

/**
 * S8B-02 (CP2) — a DETERMINISTIC speech synthesis fake, for tests only (never composed by a module): the same text always
 * gives the same chunks and usage. One chunk per sentence-like part. No network code. An aborted synthesis stops between
 * chunks and reports ABSENT usage (never zero).
 */
export class FakeSpeechSynthesisAdapter implements SpeechSynthesisAdapter {
  readonly provider = 'GEMINI' as const;

  constructor(readonly supportsHints = false) {}

  synthesize(request: SpeechSynthesisRequest): SpeechSynthesisSession {
    const parts = request.text.split(/(?<=[.!?؟،])\s+/u).filter((p) => p.trim() !== '');
    const produced: SynthesizedChunk[] = [];
    let settle!: (result: SpeechSynthesisResult) => void;
    const result = new Promise<SpeechSynthesisResult>((resolve) => { settle = resolve; });
    const supportsHints = this.supportsHints;
    const finish = (aborted: boolean): void => settle({
      operation: 'GEMINI_SPEECH_GENERATION',
      voiceId: request.voiceId,
      hintApplied: request.hint !== null && supportsHints,
      usage: aborted ? { completeness: 'ABSENT' } : {
        completeness: 'COMPLETE', source: 'PROVIDER_REPORTED',
        inputTokens: Math.ceil(Buffer.byteLength(request.text, 'utf8') / 4),
        audioOutputTokens: produced.length * FAKE_TTS_AUDIO_TOKENS_PER_CHUNK,
      },
    });
    return {
      result,
      chunks: {
        async *[Symbol.asyncIterator]() {
          for (let i = 0; i < parts.length; i += 1) {
            if (request.signal.aborted) {
              finish(true);
              return;
            }
            const chunk: SynthesizedChunk = { sequence: i, audio: Buffer.alloc(FAKE_TTS_CHUNK_BYTES, i % 251), contentType: 'audio/pcm' };
            produced.push(chunk);
            yield chunk;
          }
          finish(false);
        },
      },
    };
  }
}
