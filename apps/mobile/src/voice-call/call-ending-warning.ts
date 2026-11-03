/**
 * S8B-06 CP2 — the 60-minute warning on the phone (contract D-05-06, A1 §5, acceptance #36). Pure: no timer, no platform.
 *
 * Two sources, one cue per warning:
 *   - **The server's CALL_ENDING** (frozen protocol; `endsInMs` 300 000 or 60 000) queues the cue AT ONCE. It arrives on
 *     the live connection, whose events reach JS with the screen locked.
 *   - **The local trigger.** CALL_ENDING is per connection: a notice whose moment passed while the phone was reconnecting is
 *     never sent again. So every STATE's `endsAt` (re)schedules both cues on the ENGINE's own clock (`scheduleCue`), which
 *     keeps running where JS timers stop (Android pauses them in the background). A cue whose moment already passed is
 *     queued at once; a T-5 is not scheduled when less than a minute is left (T-1 supersedes it).
 *
 * Dedup is the engine's: the ids are fixed per call (`T5`, `T1`); an id fired once is REPEATED forever after (a resume, a
 * late CALL_ENDING, a rescheduled time), a T-5 never plays after a T-1, and an end drops what is waiting. The cue starts at
 * the first suitable silence and is forced, at the latest, `forceAfterMs` after it fell due (never over QANDEEL). It counts
 * as heard ONLY when the engine reports HEARD — the platform presented its last frame — never when it was queued.
 *
 * `endsAt` is the server's wall clock read on the phone's: a skew of a few seconds moves the LOCAL trigger by as much, while
 * the server's CALL_ENDING, when it arrives, queues at its own moment (whichever comes first wins; the other is REPEATED).
 */
import type { CueEvent, CueKind, CueRequest } from './voice-call-engine';

export const WARNING_LEAD_MS: Readonly<Record<CueKind, number>> = Object.freeze({ T5: 5 * 60_000, T1: 60_000 });
/** The longest a due cue waits for a silence before it is forced (T-5 by T-4:30, T-1 by T-0:45). */
export const WARNING_FORCE_AFTER_MS: Readonly<Record<CueKind, number>> = Object.freeze({ T5: 30_000, T1: 15_000 });

export interface WarningCuePort {
  playCue(id: string, kind: CueKind, forceAfterMs: number, notificationText: string | null): CueRequest;
  scheduleCue(id: string, kind: CueKind, dueInMs: number, forceAfterMs: number, notificationText: string | null): CueRequest;
}

export interface WarningLines {
  readonly notificationT5: string;
  readonly notificationT1: string;
}

export type WarningPhase = 'NONE' | 'SCHEDULED' | 'QUEUED' | 'PLAYING' | 'HEARD' | 'SUPERSEDED' | 'DROPPED';

export class CallEndingWarning {
  private endsAtMs: number | null = null;
  readonly phase: Record<CueKind, WarningPhase> = { T5: 'NONE', T1: 'NONE' };
  readonly requests: { readonly kind: CueKind; readonly via: 'SERVER' | 'LOCAL'; readonly result: CueRequest }[] = [];

  constructor(private readonly port: WarningCuePort, private readonly lines: WarningLines) {}

  /** The text the notification should carry for the warnings (null: none is due yet). */
  get notificationLine(): string | null {
    if (this.isDue('T1')) return this.lines.notificationT1;
    if (this.isDue('T5')) return this.lines.notificationT5;
    return null;
  }

  /** A STATE (first, or after a resume): its `endsAt`, read at `nowMs` on the phone's clock. */
  onState(endsAt: string | null, nowMs: number): void {
    if (endsAt === null) return;
    const at = Date.parse(endsAt);
    if (!Number.isFinite(at)) return;
    this.endsAtMs = at;
    this.schedule(nowMs);
  }

  /** The engine (re)started: what it held is gone, so the schedule is applied again. */
  onEngineRunning(nowMs: number): void {
    if (this.endsAtMs !== null) this.schedule(nowMs);
  }

  /** The server's CALL_ENDING: queue that warning now. */
  onCallEnding(endsInMs: number): void {
    const kind: CueKind = endsInMs > WARNING_LEAD_MS.T1 ? 'T5' : 'T1';
    this.record(kind, 'SERVER', this.port.playCue(kind, kind, WARNING_FORCE_AFTER_MS[kind], this.text(kind)));
  }

  /** The engine's cue events: the only source of PLAYING and HEARD. */
  onCue(event: CueEvent, id: string): void {
    if (id !== 'T5' && id !== 'T1') return;
    const next: Partial<Record<CueEvent, WarningPhase>> = {
      QUEUED: 'QUEUED', DUE: 'QUEUED', STARTED: 'PLAYING', REQUEUED: 'QUEUED', HEARD: 'HEARD', SUPERSEDED: 'SUPERSEDED', DROPPED: 'DROPPED',
    };
    const phase = next[event];
    if (phase === undefined) return;
    if (this.phase[id] === 'HEARD') return;
    // The engine reports from two threads (the request's QUEUED, the playback's STARTED), so a QUEUED can reach JS after
    // its STARTED (seen on the API 36 emulator). Only a REQUEUED (a hold cut the cue) takes a playing cue back.
    if (this.phase[id] === 'PLAYING' && (event === 'QUEUED' || event === 'DUE')) return;
    this.phase[id] = phase;
  }

  private schedule(nowMs: number): void {
    const remaining = this.endsAtMs! - nowMs;
    if (remaining <= 0) return;
    for (const kind of ['T5', 'T1'] as const) {
      if (kind === 'T5' && remaining <= WARNING_LEAD_MS.T1) continue;
      if (this.phase[kind] !== 'NONE' && this.phase[kind] !== 'SCHEDULED') continue;
      const dueInMs = Math.max(0, remaining - WARNING_LEAD_MS[kind]);
      this.record(kind, 'LOCAL', this.port.scheduleCue(kind, kind, dueInMs, WARNING_FORCE_AFTER_MS[kind], this.text(kind)));
    }
  }

  private record(kind: CueKind, via: 'SERVER' | 'LOCAL', result: CueRequest): void {
    this.requests.push({ kind, via, result });
    if (result === 'SCHEDULED' && this.phase[kind] === 'NONE') this.phase[kind] = 'SCHEDULED';
    else if (result === 'QUEUED' && (this.phase[kind] === 'NONE' || this.phase[kind] === 'SCHEDULED')) this.phase[kind] = 'QUEUED';
    else if (result === 'SUPERSEDED' && this.phase[kind] !== 'HEARD') this.phase[kind] = 'SUPERSEDED';
  }

  private isDue(kind: CueKind): boolean {
    const phase = this.phase[kind];
    return phase === 'QUEUED' || phase === 'PLAYING' || phase === 'HEARD';
  }

  private text(kind: CueKind): string {
    return kind === 'T5' ? this.lines.notificationT5 : this.lines.notificationT1;
  }
}
