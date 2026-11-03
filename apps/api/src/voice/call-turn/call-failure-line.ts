import { DOWNLINK_OPUS, OpusPacketEncoder } from '../call/codec/opus-codec';
import { AUDIO_PACKET_MS } from '../call/live-call.protocol';
import { failureLineLanguage, type FailureLineLanguage, type LoadedFailureLine } from '../failure-line/spoken-failure-line';
import { wavToPcm } from '../listen/wav';

/**
 * S8B-05 CP4 (voice-runtime §4.5, D-05-02) — the fixed spoken failure line F-01 as the call plays it: REPLY_AUDIO packets,
 * Opus 24 kHz in 20 ms frames (the last one completed with silence), per language, encoded once from the pinned files.
 * Null while the files are NOT_INSTALLED (the Product Owner chooses them by listening, after a separate authorization):
 * a reply that produced nothing then closes FAILED with no line played. Never synthesized at run time.
 */
export const LIVE_CALL_FAILURE_LINE = Symbol('LIVE_CALL_FAILURE_LINE');

export type CallFailureLine = Readonly<Record<FailureLineLanguage, readonly Buffer[]>>;

const FRAME_BYTES = (DOWNLINK_OPUS.rate * AUDIO_PACKET_MS * 2) / 1000;

export function callFailureLine(loaded: LoadedFailureLine): CallFailureLine | null {
  if (loaded.state !== 'READY') return null;
  const encode = (wav: Buffer): readonly Buffer[] => {
    const pcm = wavToPcm(wav, DOWNLINK_OPUS.rate);
    const encoder = new OpusPacketEncoder(DOWNLINK_OPUS.rate, DOWNLINK_OPUS.bitrate);
    try {
      const packets: Buffer[] = [];
      for (let offset = 0; offset < pcm.length; offset += FRAME_BYTES) {
        const frame = Buffer.alloc(FRAME_BYTES);
        pcm.copy(frame, 0, offset, Math.min(pcm.length, offset + FRAME_BYTES));
        packets.push(encoder.encode(frame));
      }
      return Object.freeze(packets);
    } finally {
      encoder.close();
    }
  };
  return Object.freeze({ ar: encode(loaded.audio.ar), en: encode(loaded.audio.en) });
}

/** The line in the language of the exchange: the person's words (a reply that produced nothing has none of its own). */
export function failureLineFor(line: CallFailureLine | null | undefined, content: string): readonly Buffer[] | null {
  return line ? line[failureLineLanguage(content)] : null;
}
