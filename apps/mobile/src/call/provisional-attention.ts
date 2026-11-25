/**
 * INTEL-LIVE-01 CP2 — the call's provisional attention as the phone holds it: a layer of the call, built ONLY from what the
 * server's protocol v3 frames say the database committed (ATTENTION, ATTENTION_STATE). It decides nothing: no debounce, no
 * timer, no count gate, no meaning; it orders and replaces.
 *
 *   ATTENTION_STATE  part 0 starts a snapshot; its parts arrive in order with the same seq; the complete snapshot REPLACES
 *                    the layer, unless it is older than the layer (a snapshot never moves the layer backwards).
 *   ATTENTION        applies only when its seq is above the layer's (a duplicate or a stale event changes nothing). SET
 *                    opens or updates its subject; WITHDRAW, CONFIRMED and EXPIRED remove it.
 *
 * A subject is identified by its track AND its key: the person's attention and QANDEEL's are never merged. The layer is
 * the call's only: the owner drops it at the call's end, and nothing of it is kept as knowledge (a CONFIRMED subject leaves
 * the layer; what is durable arrives through the conversation's own Analysis).
 */
import type { AttentionMessage, AttentionStateMessage, AttentionSubject } from '../voice-call/live-call-protocol-v3';

export interface ProvisionalMark extends AttentionSubject {
  /** The 0204 event_seq of the subject's latest SET. */
  readonly seq: number;
  /** The server's produced instant on the call clock (null when the mark came from a snapshot). */
  readonly producedClockMs: number | null;
  /** The phone's clock when the layer first showed this SET. */
  readonly appliedAt: number;
}

export interface ProvisionalAttentionLayer {
  /** The highest event_seq the layer reflects. */
  readonly seq: number;
  /** Open subjects, the oldest SET first. */
  readonly marks: readonly ProvisionalMark[];
  /** Rises with every change of `marks` (the stage's memo key). */
  readonly revision: number;
}

interface Assembly {
  readonly seq: number;
  readonly parts: number;
  next: number;
  readonly entries: AttentionStateMessage['entries'][number][];
  readonly after: AttentionMessage[];
}

export const EMPTY_ATTENTION_LAYER: ProvisionalAttentionLayer = Object.freeze({ seq: 0, marks: Object.freeze([]) as readonly ProvisionalMark[], revision: 0 });

const identity = (s: Pick<AttentionSubject, 'track' | 'subjectKey'>): string => `${s.track}:${s.subjectKey}`;

/** One call's layer, fed the client's v3 events in arrival order. */
export class ProvisionalAttention {
  private layer: ProvisionalAttentionLayer = EMPTY_ATTENTION_LAYER;
  private assembly: Assembly | null = null;

  constructor(private readonly now: () => number) {}

  get current(): ProvisionalAttentionLayer {
    return this.layer;
  }

  /** Returns true when the layer changed. */
  event(message: AttentionMessage): boolean {
    if (this.assembly !== null) {
      // A snapshot's parts are sent back to back; an event between them belongs after the snapshot.
      if (message.seq > this.assembly.seq) this.assembly.after.push(message);
      return false;
    }
    return this.apply(message);
  }

  /** Returns true when the layer changed. */
  state(message: AttentionStateMessage): boolean {
    if (message.part === 0) {
      this.assembly = message.seq >= this.layer.seq
        ? { seq: message.seq, parts: message.parts, next: 1, entries: [...message.entries], after: [] }
        : null;
    } else if (this.assembly !== null && this.assembly.seq === message.seq && this.assembly.parts === message.parts && this.assembly.next === message.part) {
      this.assembly.entries.push(...message.entries);
      this.assembly.next += 1;
    } else {
      this.assembly = null; // a part out of order: the snapshot is incomplete and is not applied (the next one will be)
      return false;
    }
    if (this.assembly === null || this.assembly.next < this.assembly.parts) return false;
    const { seq, entries, after } = this.assembly;
    this.assembly = null;
    const before = new Map(this.layer.marks.map((m) => [identity(m), m]));
    const at = this.now();
    const marks = [...entries].sort((a, b) => a.seq - b.seq).map((e): ProvisionalMark => {
      const was = before.get(identity(e));
      // A subject the layer already shows at the same seq keeps its instants (a restore is not a new development).
      return was && was.seq === e.seq ? was : { ...e, producedClockMs: null, appliedAt: at };
    });
    let changed = this.set(seq, marks);
    for (const m of after) changed = this.apply(m) || changed;
    return changed;
  }

  private apply(message: AttentionMessage): boolean {
    if (message.seq <= this.layer.seq) return false;
    const key = identity(message);
    const rest = this.layer.marks.filter((m) => identity(m) !== key);
    if (message.op === 'SET') {
      const { type: _type, op: _op, ...subject } = message;
      return this.set(message.seq, [...rest, { ...subject, appliedAt: this.now() }]);
    }
    return this.set(message.seq, rest);
  }

  private set(seq: number, marks: readonly ProvisionalMark[]): boolean {
    const same = marks.length === this.layer.marks.length && marks.every((m, i) => m === this.layer.marks[i]);
    this.layer = Object.freeze({ seq: Math.max(seq, this.layer.seq), marks: same ? this.layer.marks : Object.freeze(marks), revision: same ? this.layer.revision : this.layer.revision + 1 });
    return !same;
  }
}
