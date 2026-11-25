import { Injectable } from '@nestjs/common';

/**
 * INTEL-LIVE-01 CP1 (D-2, the controlled amendment of S8B-05 §5.1: "nothing reaches DeepSeek before the commit" becomes
 * "no partial ever leaves the recognizer; each FINAL segment, and each piece of QANDEEL's speech once heard, is evidence for
 * the call's provisional attention") — what the call turn engine hands the provisional attention lane, and nothing else.
 *
 * The lane itself (`live-attention/`: its tracker, its DeepSeek evaluator, its permits and its writer) is outside voice/,
 * which stays provider-free and permit-free: VoiceModule provides this binding; the module that owns the lane registers its
 * implementation into it at start. Unbound (the lane OFF, a test process), the engine hands nothing and nothing changes.
 *
 * Every method is synchronous, in memory and never throws into the voice path: the engine never awaits the lane on the way
 * to QANDEEL's voice (A2 §5). `handover` is awaited only inside the connection's own hand-over flush, bounded by it.
 */
export type LiveCallAttentionTrack = 'USER' | 'QANDEEL';

export interface LiveCallAttentionChannel {
  readonly userId: string;
  readonly sessionId: string;
  readonly callId: string;
  readonly epoch: number;
  /** The capture position the server has ingested, on the call clock. */
  latestCaptureMs(): number;
}

export interface LiveCallAttentionSession {
  /** One FINAL segment (USER) or one whole piece of QANDEEL's speech once heard (QANDEEL), on the call clock. Never an INTERIM. */
  evidence(track: LiveCallAttentionTrack, text: string, clockStartMs: number, clockEndMs: number): void;
  /** A turn of this call was committed (its Threads may have changed). */
  turnCommitted(): void;
  /** The connection is going while it holds the call: what was not covered is recorded as missed, under its epoch. */
  handover(): Promise<void>;
  /** The connection closed. */
  close(): void;
}

export interface LiveCallAttention {
  open(channel: LiveCallAttentionChannel): LiveCallAttentionSession;
}

@Injectable()
export class LiveCallAttentionBinding {
  private bound: LiveCallAttention | null = null;

  bind(attention: LiveCallAttention): void {
    this.bound = attention;
  }

  get attention(): LiveCallAttention | null {
    return this.bound;
  }
}
