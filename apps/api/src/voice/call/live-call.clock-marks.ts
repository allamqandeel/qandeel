import { randomUUID } from 'node:crypto';
import { CLOCK_MARK_POLICY } from './live-call.protocol-v2';

/**
 * S8B-07 RB-2 / M-2 (CP3 / CP4) — the instance's clock-mark slots (Option B, T = 1000 ms): ten staggered 100 ms slots,
 * each call in one of them (by its id), so a call gets one mark per second and an instance makes at most one database
 * statement per slot.
 *
 *   A slot runs ONE statement (0203 `server_call_clock_slot_v1`): it persists the echoes received since the last slot,
 *   compacts the calls that ended, and takes a FRESH snapshot. Only once that statement has resolved are the slot's marks
 *   sent, each bound to that snapshot. A failed statement sends no mark and keeps its echoes and compactions for the next
 *   slot. A slot whose previous statement is still running is SKIPPED, never caught up. A slot with nothing to send,
 *   persist or compact makes no statement at all.
 *
 *   An echo is kept only if it answers a mark this instance sent on that very connection, is the first answer to it,
 *   arrives within the echo lifetime, carries a capture position (not NOCLOCK) AFTER the latest audio the server held when
 *   the mark was sent, and rises above the call's previous echo. Anything else is dropped: a dropped echo can only make a
 *   certification later (or absent: AFTER_END), never earlier.
 *
 * No worker, no polling of other state, no routing between instances: the timer runs only while this instance carries a
 * v2 call or has echoes or compactions to persist. Content-free signals only.
 */
export interface ClockSlotStore {
  clockSlot(input: {
    instanceId: string;
    echoes: ReadonlyArray<ClockEchoRecord>;
    compact: readonly string[];
  }): Promise<{ snapshotId: number }>;
}

export interface ClockEchoRecord {
  readonly callId: string;
  readonly epoch: number;
  readonly markSeq: number;
  readonly snapshotId: number;
  readonly captureMs: number;
}

/** What a registered connection gives the slots. */
export interface ClockMarkPort {
  /** Sends CLOCK_MARK { seq } on the connection. */
  send(seq: number): void;
  /** The latest capture position the server holds for the call (the floor an echo must pass). */
  latestCaptureMs(): number;
}

export interface ClockMarkRegistration {
  /** A MARK_ECHO received on this registration's connection. */
  echo(seq: number, captureMs: number | null): void;
  /** The connection no longer carries the call; `ended` queues its compaction. */
  release(ended: boolean): void;
}

export interface ClockTimer {
  now(): number;
  every(fn: () => void, ms: number): unknown;
  stop(handle: unknown): void;
}

export const REAL_CLOCK_TIMER: ClockTimer = {
  now: () => Date.now(),
  every: (fn, ms) => {
    const t = setInterval(fn, ms);
    t.unref?.();
    return t;
  },
  stop: (handle) => clearInterval(handle as NodeJS.Timeout),
};

interface Outstanding {
  readonly snapshotId: number;
  readonly sentAt: number;
  readonly floor: number;
}

interface Carried {
  readonly callId: string;
  readonly epoch: number;
  readonly port: ClockMarkPort;
  readonly slot: number;
  nextSeq: number;
  lastEcho: number;
  readonly outstanding: Map<number, Outstanding>;
}

/** The slot a call's marks go out in: stable per call, spread evenly over the period. */
export function slotOf(callId: string): number {
  let h = 0;
  for (const ch of callId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % CLOCK_MARK_POLICY.slots;
}

export class LiveCallClockMarks {
  readonly instanceId = randomUUID();
  private readonly calls = new Map<string, Carried>();
  private echoes: ClockEchoRecord[] = [];
  private compactions: string[] = [];
  private handle: unknown = null;
  private tick = 0;
  private running = false;

  constructor(
    private readonly store: ClockSlotStore,
    private readonly timer: ClockTimer = REAL_CLOCK_TIMER,
    private readonly signal: (operation: string, outcome: string) => void = () => undefined,
  ) {}

  /** The call's connection (one epoch) starts receiving marks. A newer epoch of the same call replaces an older one. */
  register(callId: string, epoch: number, port: ClockMarkPort): ClockMarkRegistration {
    const carried: Carried = { callId, epoch, port, slot: slotOf(callId), nextSeq: 0, lastEcho: -1, outstanding: new Map() };
    const previous = this.calls.get(callId);
    if (previous && previous.epoch <= epoch) carried.lastEcho = previous.lastEcho;
    if (!previous || previous.epoch <= epoch) this.calls.set(callId, carried);
    this.arm();
    return {
      echo: (seq, captureMs) => this.echo(carried, seq, captureMs),
      release: (ended) => {
        if (this.calls.get(callId) === carried) this.calls.delete(callId);
        if (ended && !this.compactions.includes(callId)) this.compactions.push(callId);
        this.arm();
      },
    };
  }

  get carried(): number {
    return this.calls.size;
  }

  get pending(): { echoes: number; compactions: number } {
    return { echoes: this.echoes.length, compactions: this.compactions.length };
  }

  private echo(carried: Carried, seq: number, captureMs: number | null): void {
    const mark = carried.outstanding.get(seq);
    if (!mark) return this.signal('clock_echo', 'dropped_unknown');
    carried.outstanding.delete(seq);
    if (captureMs === null) return this.signal('clock_echo', 'noclock');
    if (this.timer.now() - mark.sentAt > CLOCK_MARK_POLICY.echoLifetimeMs) return this.signal('clock_echo', 'dropped_expired');
    if (captureMs <= mark.floor || captureMs <= carried.lastEcho || captureMs % 20 !== 0) return this.signal('clock_echo', 'dropped_order');
    carried.lastEcho = captureMs;
    this.echoes.push({ callId: carried.callId, epoch: carried.epoch, markSeq: seq, snapshotId: mark.snapshotId, captureMs });
    this.arm();
  }

  private arm(): void {
    const busy = this.calls.size > 0 || this.echoes.length > 0 || this.compactions.length > 0;
    if (busy && this.handle === null) this.handle = this.timer.every(() => void this.slot(), CLOCK_MARK_POLICY.slotMs);
    if (!busy && this.handle !== null && !this.running) {
      this.timer.stop(this.handle);
      this.handle = null;
    }
  }

  /** One slot. Exposed for tests; never throws. */
  async slot(): Promise<void> {
    const index = this.tick % CLOCK_MARK_POLICY.slots;
    this.tick += 1;
    if (this.running) {
      this.signal('clock_slot', 'skipped_busy');
      return;
    }
    const due = [...this.calls.values()].filter((c) => c.slot === index);
    if (due.length === 0 && this.echoes.length === 0 && this.compactions.length === 0) return this.arm();
    const now = this.timer.now();
    for (const c of due) {
      for (const [seq, o] of c.outstanding) if (now - o.sentAt > CLOCK_MARK_POLICY.echoLifetimeMs) c.outstanding.delete(seq);
    }
    const echoes = this.echoes.splice(0, CLOCK_MARK_POLICY.maxEchoesPerBatch);
    const compact = this.compactions.splice(0, CLOCK_MARK_POLICY.maxEchoesPerBatch);
    this.running = true;
    let snapshotId: number;
    try {
      ({ snapshotId } = await this.store.clockSlot({ instanceId: this.instanceId, echoes, compact }));
      if (!Number.isSafeInteger(snapshotId) || snapshotId < 1) throw new Error('CLOCK_SLOT_UNEXPECTED_SHAPE');
    } catch {
      // Nothing was persisted and no snapshot exists: no mark is sent; the echoes and compactions wait for the next slot.
      this.echoes = [...echoes, ...this.echoes];
      for (const id of compact) if (!this.compactions.includes(id)) this.compactions.push(id);
      this.signal('clock_slot', 'transport_failure');
      return;
    } finally {
      this.running = false;
      this.arm();
    }
    this.signal('clock_slot', 'success');
    const sentAt = this.timer.now();
    for (const c of due) {
      if (this.calls.get(c.callId) !== c) continue;
      c.nextSeq += 1;
      c.outstanding.set(c.nextSeq, { snapshotId, sentAt, floor: c.port.latestCaptureMs() });
      c.port.send(c.nextSeq);
    }
  }

  stop(): void {
    if (this.handle !== null) this.timer.stop(this.handle);
    this.handle = null;
  }
}
