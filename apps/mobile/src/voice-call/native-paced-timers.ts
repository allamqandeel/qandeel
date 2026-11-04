/**
 * S8B-06 CP2 — the call's timers, paced by the native engine as well as by JS.
 *
 * React Native pauses JS timers while an Android app is in the background (the screen locked, another call in front),
 * but native events still reach JS. A held call sends no audio, so without its HEARTBEAT the server would close the link
 * after 3 s of silence, and the reconnect backoff that follows is a timer too. Every timer of the call is therefore kept
 * twice: as an ordinary timer (the foreground path) and in this registry, which {@link pump} — called on every native
 * engine event, at least each 250 ms `tick` — fires when due. A callback runs once per due time whichever path comes
 * first; an interval never bursts to catch up (it runs once, then is due one interval later). No content, no storage.
 */
import type { LiveCallTimers } from './live-call-client';

interface Entry {
  readonly id: number;
  readonly fn: () => void;
  readonly intervalMs: number | null;
  due: number;
  handle: unknown;
}

export class NativePacedTimers implements LiveCallTimers {
  private readonly entries = new Map<number, Entry>();
  private nextId = 1;

  constructor(private readonly base: LiveCallTimers) {}

  now(): number {
    return this.base.now();
  }

  setTimeout(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    const entry: Entry = { id, fn, intervalMs: null, due: this.base.now() + Math.max(0, ms), handle: null };
    this.entries.set(id, entry);
    entry.handle = this.base.setTimeout(() => this.fire(id), ms);
    return id;
  }

  clearTimeout(handle: unknown): void {
    this.drop(handle);
  }

  setInterval(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    const entry: Entry = { id, fn, intervalMs: Math.max(1, ms), due: this.base.now() + Math.max(1, ms), handle: null };
    this.entries.set(id, entry);
    entry.handle = this.base.setInterval(() => this.fire(id), ms);
    return id;
  }

  clearInterval(handle: unknown): void {
    this.drop(handle);
  }

  /** Fires every timer whose time has come. Called on native events, so it works while JS timers are paused. */
  pump(): void {
    const now = this.base.now();
    for (const entry of [...this.entries.values()].sort((a, b) => a.due - b.due)) {
      if (entry.due <= now && this.entries.has(entry.id)) this.fire(entry.id);
    }
  }

  /** How many timers are pending (tests). */
  get pending(): number {
    return this.entries.size;
  }

  private fire(id: number): void {
    const entry = this.entries.get(id);
    if (entry === undefined) return;
    const now = this.base.now();
    if (entry.intervalMs === null) {
      this.entries.delete(id);
      this.base.clearTimeout(entry.handle);
    } else {
      // The native path may have run it already for this due time: the JS interval then skips once.
      if (now < entry.due - entry.intervalMs / 2) return;
      entry.due = now + entry.intervalMs;
    }
    entry.fn();
  }

  private drop(handle: unknown): void {
    if (typeof handle !== 'number') return;
    const entry = this.entries.get(handle);
    if (entry === undefined) return;
    this.entries.delete(handle);
    if (entry.intervalMs === null) this.base.clearTimeout(entry.handle);
    else this.base.clearInterval(entry.handle);
  }
}
