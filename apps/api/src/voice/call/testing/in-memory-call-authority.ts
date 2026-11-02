import type { Readable } from 'node:stream';
import type { CallClock } from '../live-call.connection';
import type { LiveCallStore, TrackState } from '../live-call.store';
import type { CallSegmentMedia } from '../recording/user-track-writer';

/**
 * S8B-05 CP1 — test doubles only: an in-memory stand-in for the call authority (0189) and the voice media writer, with
 * the same answers the real ones give for the paths the unit and gateway tests drive. The real authority is proven by
 * database/verify-migration-0189.mjs and the synthetic proof against a real PostgreSQL.
 */
export interface MemoryCall {
  id: string;
  userId: string;
  sessionId: string;
  instance: string;
  state: 'CONNECTING' | 'ACTIVE' | 'RECONNECTING' | 'ENDED';
  epoch: number;
  startedAt: string | null;
  endReason: string | null;
  recordingId: string | null;
}

export interface MemorySegment {
  track: 'USER' | 'QANDEEL';
  index: number;
  startMs: number;
  endMs: number;
  bytes: Buffer;
}

export interface MemoryGap {
  track: 'USER' | 'QANDEEL';
  startMs: number;
  endMs: number;
  kind: string;
}

export class InMemoryCallAuthority implements LiveCallStore, CallSegmentMedia {
  readonly calls = new Map<string, MemoryCall>();
  readonly segments: MemorySegment[] = [];
  readonly gaps: MemoryGap[] = [];
  capacity = 2;
  consent = true;
  endsAt: string | null = null;
  /** Make the next N segment writes answer this outcome (after the add landed, when `landed`). */
  failNextWrites: { outcome: string; count: number; landed: boolean } | null = null;
  recordingState = 'RECORDING';
  private seq = 0;

  private seats(): number {
    return [...this.calls.values()].filter((c) => c.state !== 'ENDED').length;
  }

  private own(userId: string, callId: string): MemoryCall | null {
    const call = this.calls.get(callId);
    return call && call.userId === userId ? call : null;
  }

  async begin(input: { userId: string; sessionId: string; callId: string; clientInstanceId: string }) {
    const existing = this.calls.get(input.callId);
    if (existing) return { outcome: 'COMMAND_CONFLICT' as const, epoch: null };
    if (!this.consent) return { outcome: 'CONSENT_REQUIRED' as const, epoch: null };
    if ([...this.calls.values()].some((c) => c.userId === input.userId && c.state !== 'ENDED')) return { outcome: 'ALREADY_IN_CALL' as const, epoch: null };
    if (this.seats() >= this.capacity) return { outcome: 'CAPACITY_FULL' as const, epoch: null };
    this.calls.set(input.callId, {
      id: input.callId, userId: input.userId, sessionId: input.sessionId, instance: input.clientInstanceId, state: 'CONNECTING', epoch: 1,
      startedAt: null, endReason: null, recordingId: null,
    });
    return { outcome: 'BEGUN' as const, epoch: 1 };
  }

  async activate(input: { userId: string; callId: string; epoch: number }) {
    const call = this.own(input.userId, input.callId);
    if (!call) return { outcome: 'NOT_FOUND' as const, startedAt: null, recordingId: null };
    if (call.state === 'ENDED') return { outcome: 'ENDED' as const, startedAt: null, recordingId: null };
    if (call.epoch !== input.epoch) return { outcome: 'FENCED' as const, startedAt: null, recordingId: null };
    if (call.state !== 'CONNECTING') return { outcome: 'NOT_CONNECTING' as const, startedAt: null, recordingId: null };
    if (!this.consent) return { outcome: 'CONSENT_REQUIRED' as const, startedAt: null, recordingId: null };
    call.state = 'ACTIVE';
    call.startedAt = new Date(Date.UTC(2026, 10, 2, 10, 0, 0)).toISOString();
    call.recordingId = `00000000-0000-4000-9000-${String(++this.seq).padStart(12, '0')}`;
    return { outcome: 'ACTIVE' as const, startedAt: call.startedAt, recordingId: call.recordingId };
  }

  async heartbeat(input: { userId: string; callId: string; epoch: number }) {
    const call = this.own(input.userId, input.callId);
    if (!call) return { outcome: 'NOT_FOUND' as const, callState: null, endsAt: null };
    if (call.state === 'ENDED') return { outcome: 'ENDED' as const, callState: call.endReason, endsAt: null };
    if (call.epoch !== input.epoch) return { outcome: 'FENCED' as const, callState: call.state, endsAt: null };
    if (call.state === 'RECONNECTING') return { outcome: 'RECONNECTING' as const, callState: call.state, endsAt: null };
    return { outcome: 'ALIVE' as const, callState: call.state, endsAt: call.state === 'ACTIVE' ? this.endsAt : null };
  }

  async suspend(input: { userId: string; callId: string; epoch: number }) {
    const call = this.own(input.userId, input.callId);
    if (!call) return { outcome: 'NOT_FOUND' as const };
    if (call.state === 'ENDED') return { outcome: 'ENDED' as const };
    if (call.epoch !== input.epoch) return { outcome: 'FENCED' as const };
    if (call.state === 'CONNECTING') this.finish(call, 'FAILED');
    else call.state = 'RECONNECTING';
    return { outcome: 'SUSPENDED' as const };
  }

  async resume(input: { userId: string; callId: string; clientInstanceId: string }) {
    const call = this.own(input.userId, input.callId);
    const none = { callState: null, epoch: null, startedAt: null, recordingId: null };
    if (!call) return { outcome: 'NOT_FOUND' as const, ...none };
    if (call.state === 'ENDED') return { outcome: 'ENDED' as const, ...none, callState: call.endReason };
    if (call.instance !== input.clientInstanceId) return { outcome: 'OTHER_DEVICE' as const, ...none };
    call.epoch += 1;
    if (call.state === 'RECONNECTING') call.state = 'ACTIVE';
    return { outcome: 'RESUMED' as const, callState: call.state, epoch: call.epoch, startedAt: call.startedAt, recordingId: call.recordingId };
  }

  async end(input: { userId: string; callId: string; epoch: number; reason: 'USER_ENDED' | 'FAILED' | 'SERVER_ENDED' }) {
    const call = this.own(input.userId, input.callId);
    if (!call) return { outcome: 'NOT_FOUND' as const, endReason: null };
    if (call.state === 'ENDED') return { outcome: 'ALREADY_ENDED' as const, endReason: call.endReason };
    if (call.epoch !== input.epoch) return { outcome: 'FENCED' as const, endReason: null };
    this.finish(call, input.reason);
    return { outcome: 'ENDED' as const, endReason: input.reason };
  }

  finish(call: MemoryCall, reason: string): void {
    call.state = 'ENDED';
    call.endReason = reason;
    if (call.recordingId) this.recordingState = 'STORED';
  }

  async sweep(): Promise<number> {
    return 0;
  }

  async truth(userId: string) {
    const call = [...this.calls.values()].find((c) => c.userId === userId && c.state !== 'ENDED');
    return call
      ? { callTruth: 'ACTIVE' as const, callId: call.id, callState: call.state, startedAt: call.startedAt }
      : { callTruth: 'NO_CALL_KNOWN' as const, callId: null, callState: null, startedAt: null };
  }

  trackState(): { endMs: number; next: number } {
    const userSegments = this.segments.filter((s) => s.track === 'USER');
    const userGaps = this.gaps.filter((g) => g.track === 'USER');
    const endMs = Math.max(0, ...userSegments.map((s) => s.endMs), ...userGaps.map((g) => g.endMs));
    return { endMs, next: userSegments.length };
  }

  async readTracks(input: { userId: string; callId: string }): Promise<TrackState | null> {
    const call = this.own(input.userId, input.callId);
    if (!call?.recordingId) return null;
    const { endMs, next } = this.trackState();
    return { recordingId: call.recordingId, recordingState: this.recordingState, userTrackEndMs: endMs, userNextSegment: next };
  }

  /** 0189's writer fence: only the connection holding the current epoch of the recording's ACTIVE call writes. */
  private fenced(recordingId: string, epoch: number): boolean {
    const call = [...this.calls.values()].find((c) => c.recordingId === recordingId);
    return !call || call.state !== 'ACTIVE' || call.epoch !== epoch;
  }

  async recordGap(input: { userId: string; recordingId: string; epoch: number; track: 'USER' | 'QANDEEL'; startMs: number; endMs: number; kind: string }) {
    if (this.recordingState !== 'RECORDING') return 'RECORDING_CLOSED';
    if (this.fenced(input.recordingId, input.epoch)) return 'FENCED';
    if (input.startMs !== this.trackState().endMs) return 'DISCONTINUOUS';
    this.gaps.push({ track: input.track, startMs: input.startMs, endMs: input.endMs, kind: input.kind });
    return 'RECORDED';
  }

  async writeCallSegment(_userId: string, recordingId: string, track: 'USER' | 'QANDEEL', segmentIndex: number, clockStartMs: number,
    clockEndMs: number, body: Readable, byteSize: number, _signal: AbortSignal, connectionEpoch: number): Promise<{ outcome: string }> {
    if (this.recordingState === 'RECORDING' && this.fenced(recordingId, connectionEpoch)) return { outcome: 'FENCED' };
    const parts: Buffer[] = [];
    for await (const part of body) parts.push(part as Buffer);
    const bytes = Buffer.concat(parts);
    if (bytes.length !== byteSize) return { outcome: 'UNAVAILABLE' };
    if (!this.consent) return { outcome: 'CONSENT_REQUIRED' };
    if (this.recordingState !== 'RECORDING') return { outcome: 'EXPIRED' };
    const { endMs, next } = this.trackState();
    if (segmentIndex !== next) return { outcome: 'OUT_OF_ORDER' };
    if (clockStartMs !== endMs) return { outcome: 'DISCONTINUOUS' };
    const failure = this.failNextWrites;
    if (failure && failure.count > 0) {
      failure.count -= 1;
      if (failure.landed) this.segments.push({ track, index: segmentIndex, startMs: clockStartMs, endMs: clockEndMs, bytes });
      return { outcome: failure.outcome };
    }
    this.segments.push({ track, index: segmentIndex, startMs: clockStartMs, endMs: clockEndMs, bytes });
    return { outcome: 'STORED' };
  }
}

/** A manual clock: timers fire only when the test advances time. */
export class ManualClock implements CallClock {
  private at = 1_000_000;
  private nextId = 1;
  private readonly timers = new Map<number, { due: number; fn: () => void }>();

  now(): number {
    return this.at;
  }

  setTimeout(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.timers.set(id, { due: this.at + ms, fn });
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.timers.delete(handle as number);
  }

  /** Moves time forward, firing every timer that falls due, in order. */
  advance(ms: number): void {
    const target = this.at + ms;
    for (;;) {
      let soonest: [number, { due: number; fn: () => void }] | null = null;
      for (const entry of this.timers) if (entry[1].due <= target && (!soonest || entry[1].due < soonest[1].due)) soonest = entry;
      if (!soonest) break;
      this.timers.delete(soonest[0]);
      this.at = soonest[1].due;
      soonest[1].fn();
    }
    this.at = target;
  }
}
