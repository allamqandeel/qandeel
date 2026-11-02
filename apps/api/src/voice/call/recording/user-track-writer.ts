import { Readable } from 'node:stream';
import { muxOggOpus } from '../codec/ogg-opus';
import { AUDIO_PACKET_MS, LIVE_CALL_LIMITS } from '../live-call.protocol';
import type { GapKind, LiveCallStore, TrackState } from '../live-call.store';

/**
 * The voice-media writer seam (VoiceMediaService.writeCallSegment): add (fenced by the connection epoch, 0189) → one PUT of
 * exactly its bytes → store.
 */
export interface CallSegmentMedia {
  writeCallSegment(userId: string, recordingId: string, track: 'USER' | 'QANDEEL', segmentIndex: number, clockStartMs: number,
    clockEndMs: number, body: Readable, byteSize: number, signal: AbortSignal, connectionEpoch: number): Promise<{ outcome: string }>;
}

/**
 * Why the writer stopped: the recording can no longer take the person's audio, and the call must not go on unrecorded
 * (CONSENT_REQUIRED, RECORDING_CLOSED, STORAGE); or FENCED: a newer connection holds the call, which goes on there.
 */
export type WriterFailure = 'CONSENT_REQUIRED' | 'RECORDING_CLOSED' | 'STORAGE' | 'FENCED';

type Op =
  | { readonly kind: 'segment'; packets: Buffer[]; startMs: number; readonly endMs: number; readonly bytes: number }
  | { readonly kind: 'gap'; readonly startMs: number; readonly endMs: number; readonly gap: GapKind };

/**
 * S8B-05 CP1 — the call recording's USER track (voice-runtime-v1.md §7, D-C1): the uplink Opus packets exactly as
 * received, in standalone Ogg Opus segments of about ten seconds, on the capture clock (the track's clock).
 *
 *   - honest packets and times: a segment covers [first packet's captureMs, last + 20 ms), every packet is one 20 ms
 *     frame, and a hole is never filled with invented audio: it is a MUTED or RECONNECTION gap row (0183 / 0189);
 *   - in order, one write at a time: segment indexes and the track clock advance only on the database's answer;
 *   - every admission and gap carries the connection's epoch (0189): once a newer connection holds the call the database
 *     answers FENCED and this writer stops, writing nothing more (the phone resends from the new connection's durable end);
 *     a segment it was admitted for before that still uploads and stores;
 *   - only `STORED` releases a segment's audio (0183 §3.5 rule 3); an ambiguous answer is reconciled from the database
 *     (server_read_call_tracks_v1) before anything else is written, so a duplicate is dropped and nothing is overwritten;
 *   - the audio held (buffered plus in flight) is bounded by the caller through `pendingBytes`;
 *   - nothing is logged: no audio, no key, no recording id.
 */
export class UserTrackWriter {
  private buffer: Buffer[] = [];
  private bufferStartMs: number;
  private bufferBytes = 0;
  private inFlightBytes = 0;
  /** The end of everything accepted so far (written, in flight or buffered): the next packet's captureMs. */
  private acceptedEndMs: number;
  private nextSegment: number;
  private chain: Promise<void> = Promise.resolve();
  private stopped = false;
  private failed: WriterFailure | null = null;
  private readonly abort = new AbortController();
  private stats = { segments: 0, packets: 0, gaps: 0, dropped: 0 };

  constructor(
    private readonly deps: {
      readonly media: CallSegmentMedia; readonly store: Pick<LiveCallStore, 'readTracks' | 'recordGap'>; readonly userId: string; readonly callId: string;
      readonly epoch: number;
    },
    private readonly recordingId: string,
    durable: { readonly userTrackEndMs: number; readonly userNextSegment: number },
  ) {
    this.acceptedEndMs = durable.userTrackEndMs;
    this.bufferStartMs = durable.userTrackEndMs;
    this.nextSegment = durable.userNextSegment;
  }

  /** The captureMs the next packet must carry to be contiguous. */
  get expectedCaptureMs(): number {
    return this.acceptedEndMs;
  }

  get pendingBytes(): number {
    return this.bufferBytes + this.inFlightBytes;
  }

  get failure(): WriterFailure | null {
    return this.failed;
  }

  get counts(): Readonly<{ segments: number; packets: number; gaps: number; dropped: number }> {
    return { ...this.stats };
  }

  /** One contiguous packet (captureMs === expectedCaptureMs; the caller enforces it). */
  append(packet: Buffer, captureMs: number): void {
    if (this.stopped || this.failed) return;
    if (captureMs !== this.acceptedEndMs) throw new RangeError('USER_TRACK_NOT_CONTIGUOUS');
    if (this.buffer.length === 0) this.bufferStartMs = captureMs;
    this.buffer.push(packet);
    this.bufferBytes += packet.length;
    this.acceptedEndMs = captureMs + AUDIO_PACKET_MS;
    this.stats.packets += 1;
    if (this.acceptedEndMs - this.bufferStartMs >= LIVE_CALL_LIMITS.segmentTargetMs) this.cut();
  }

  /** A hole up to `endMs` (a multiple of 20 past the accepted end): the buffered audio is cut first, then the gap row. */
  gap(kind: GapKind, endMs: number): void {
    if (this.stopped || this.failed) return;
    if (endMs <= this.acceptedEndMs) return;
    this.cut();
    const op: Op = { kind: 'gap', startMs: this.acceptedEndMs, endMs, gap: kind };
    this.acceptedEndMs = endMs;
    this.bufferStartMs = endMs;
    this.enqueue(op);
  }

  /** Writes everything accepted so far and waits for the database's answers. */
  async flush(): Promise<void> {
    this.cut();
    await this.chain;
  }

  /** Flushes, then refuses further audio. `abandon`: the call ended without this writer; nothing more is attempted. */
  async close(abandon = false): Promise<void> {
    if (abandon) {
      this.stopped = true;
      this.buffer = [];
      this.bufferBytes = 0;
      this.abort.abort();
      await this.chain;
      return;
    }
    await this.flush();
    this.stopped = true;
  }

  private cut(): void {
    if (this.buffer.length === 0) return;
    const op: Op = { kind: 'segment', packets: this.buffer, startMs: this.bufferStartMs, endMs: this.acceptedEndMs, bytes: this.bufferBytes };
    this.inFlightBytes += this.bufferBytes;
    this.buffer = [];
    this.bufferBytes = 0;
    this.bufferStartMs = this.acceptedEndMs;
    this.enqueue(op);
  }

  private enqueue(op: Op): void {
    this.chain = this.chain.then(() => this.run(op)).catch(() => {
      this.fail('STORAGE');
    });
  }

  private fail(reason: WriterFailure): void {
    if (!this.failed) this.failed = reason;
  }

  private release(op: Op): void {
    if (op.kind === 'segment') this.inFlightBytes -= op.bytes;
  }

  private async run(op: Op): Promise<void> {
    try {
      if (this.failed || this.abort.signal.aborted) return;
      if (op.kind === 'gap') await this.writeGap(op);
      else await this.writeSegment(op, true);
    } finally {
      this.release(op);
    }
  }

  private async writeGap(op: Extract<Op, { kind: 'gap' }>): Promise<void> {
    const outcome = await this.deps.store.recordGap({
      userId: this.deps.userId, recordingId: this.recordingId, epoch: this.deps.epoch, track: 'USER', startMs: op.startMs, endMs: op.endMs,
      kind: op.gap,
    }).catch(() => 'UNAVAILABLE');
    if (outcome === 'RECORDED') {
      this.stats.gaps += 1;
      return;
    }
    if (outcome === 'FENCED') {
      this.fail('FENCED');
      return;
    }
    const durable = await this.reconcile();
    if (!durable) return;
    // Already covered (a resend of the same gap, or another writer got there): nothing to add.
    if (durable.userTrackEndMs >= op.endMs) return;
    this.fail(outcome === 'CONSENT_REQUIRED' ? 'CONSENT_REQUIRED' : 'STORAGE');
  }

  private async writeSegment(op: Extract<Op, { kind: 'segment' }>, retry: boolean): Promise<void> {
    const body = muxOggOpus(op.packets, { serial: this.nextSegment, inputRate: 16_000 });
    const index = this.nextSegment;
    const result = await this.deps.media.writeCallSegment(this.deps.userId, this.recordingId, 'USER', index, op.startMs, op.endMs,
      Readable.from([body]), body.length, this.abort.signal, this.deps.epoch).catch(() => ({ outcome: 'UNAVAILABLE' }));
    if (result.outcome === 'STORED') {
      this.nextSegment = index + 1;
      this.stats.segments += 1;
      return;
    }
    if (result.outcome === 'FENCED') {
      // Nothing was admitted: the newer connection's durable end is before this audio, and the phone resends it there.
      this.fail('FENCED');
      return;
    }
    if (result.outcome === 'CONSENT_REQUIRED') {
      this.fail('CONSENT_REQUIRED');
      return;
    }
    if (result.outcome === 'EXPIRED') {
      this.fail('RECORDING_CLOSED');
      return;
    }
    // UNAVAILABLE (the add, the PUT or the store did not answer), DISCONTINUOUS / OUT_OF_ORDER (another writer moved the
    // track): the database says where the track stands, and only then is anything decided.
    const durable = await this.reconcile();
    if (!durable) return;
    if (durable.userNextSegment > index && durable.userTrackEndMs >= op.endMs) {
      // The add landed (its PUT or store may have failed: the seal turns a pending segment into a WRITER_LOSS gap).
      this.nextSegment = durable.userNextSegment;
      return;
    }
    this.nextSegment = durable.userNextSegment;
    // Drop what the track already holds (a resend another writer stored first), keep the rest contiguous.
    while (op.packets.length > 0 && op.startMs < durable.userTrackEndMs) {
      op.packets.shift();
      op.startMs += AUDIO_PACKET_MS;
      this.stats.dropped += 1;
    }
    if (op.packets.length === 0) return;
    if (op.startMs !== durable.userTrackEndMs || !retry) {
      this.fail('STORAGE');
      return;
    }
    await this.writeSegment(op, false);
  }

  /** The database's view of the USER track; null (and a failure set) when the recording is no longer being written. */
  private async reconcile(): Promise<TrackState | null> {
    const durable = await this.deps.store.readTracks({ userId: this.deps.userId, callId: this.deps.callId }).catch(() => null);
    if (!durable) {
      this.fail('STORAGE');
      return null;
    }
    if (durable.recordingState !== 'RECORDING' || durable.recordingId !== this.recordingId) {
      this.fail('RECORDING_CLOSED');
      return null;
    }
    return durable;
  }
}
