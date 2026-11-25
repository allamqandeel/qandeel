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

/** INTEL-LIVE-01 CP2: one attention subject as the phone is told it (0204's columns; never a transcript). */
export interface LiveCallAttentionSubject {
  readonly track: LiveCallAttentionTrack;
  readonly subjectKey: string;
  readonly label: string;
  readonly kind: 'TOPIC' | 'PERSON' | 'PLACE' | 'EXPERIENCE' | 'CONCERN' | 'PLAN';
  readonly confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly threadRef: string | null;
}

/**
 * INTEL-LIVE-01 CP2 (D-3, protocol v3): what the lane discloses to the phone, only ever from rows the database committed.
 * EVENT is one attention event (`seq` = its 0204 event_seq); STATE is the call's open attention as ONE read of the
 * database holds it (`seq` = the call's highest event_seq in that read).
 */
export type LiveCallAttentionDisclosure =
  | {
    readonly kind: 'EVENT'; readonly seq: number; readonly op: 'SET' | 'WITHDRAW' | 'CONFIRMED' | 'EXPIRED';
    readonly subject: LiveCallAttentionSubject; readonly producedClockMs: number | null;
  }
  | { readonly kind: 'STATE'; readonly seq: number; readonly entries: readonly (LiveCallAttentionSubject & { readonly seq: number })[] };

/** SENT; DROPPED (the phone is a slow consumer: audio first, the state is sent again later); NOT_LISTENING (not v3, not ACTIVE). */
export type LiveCallAttentionDelivery = 'SENT' | 'DROPPED' | 'NOT_LISTENING';

export interface LiveCallAttentionChannel {
  readonly userId: string;
  readonly sessionId: string;
  readonly callId: string;
  readonly epoch: number;
  /** The capture position the server has ingested, on the call clock. */
  latestCaptureMs(): number;
  /** INTEL-LIVE-01 CP2: towards the phone (protocol v3 only). Synchronous; never awaited; absent where nothing listens. */
  discloseAttention?(disclosure: LiveCallAttentionDisclosure): LiveCallAttentionDelivery;
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
  /**
   * INTEL-LIVE-01 CP2: a half of this call was settled on THIS instance (0204's settlement rows were written): its sessions
   * here tell their phones the database's attention again. In memory; a lost signal is covered by the sessions' own watch.
   */
  settled?(callId: string): void;
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
