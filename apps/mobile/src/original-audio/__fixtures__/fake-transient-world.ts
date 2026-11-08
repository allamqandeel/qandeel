/**
 * S8B-07 CP1-B step 5 — a simulated Replay Media Service and streaming player, on jest's fake clock, for the engine's
 * tests. The server keeps the §20 rules as 0196 states them (a known command returns its set; a new command reuses the
 * newest live generation when it covers the source or has ≥ L left, otherwise makes G + 1 bounded by E; ≤ 2 live
 * generations; a source that ended is NOT_FOUND with the proven reason). The player plays a file's content clock while
 * the server lets it read, and logs every AUDIBLE span (loaded and playing): what was heard, and when. The log is
 * what the tests measure lost, repeated and silent audio by — the functional analogue of HC-1 / HC-2, never their proof
 * (the device's, step 6).
 */
import type { VoiceNotePlayer, VoiceNotePlayerPort, VoiceNotePlayerStatus } from '../../voice-note/voice-note-playback';
import type { PresentationBoundary, PresentationSpan } from '../presentation-map';
import type {
  TransientRequestResult, TransientRunView, TransientSetView, TransientStatusResult, TransientUnavailableReason,
} from '../transient-media-api';

export const MINUTE = 60_000;
const CAP_MS = 58 * MINUTE;

interface FakeSet {
  readonly generation: number;
  readonly ids: readonly string[];
  readonly readyAt: number;
  readonly expiresAt: number;
  terminal: 'FAILED' | 'RELEASED' | 'EXPIRED' | null;
}

export interface FakeServerOptions {
  /** Each run's file length (one run: listening). */
  readonly runs: readonly number[];
  readonly spans?: readonly (readonly PresentationSpan[])[];
  readonly boundaries?: readonly PresentationBoundary[];
  /** The source's own end E, from now. */
  readonly sourceEndsInMs: number;
  /** The cause the database proves when the source has ended. */
  readonly sourceReason?: TransientUnavailableReason;
  readonly prepareMs?: number;
  readonly leadMs?: number;
}

let serial = 0;
const uuid = () => {
  serial += 1;
  return `00000000-0000-4000-8000-${serial.toString(16).padStart(12, '0')}`;
};

export class FakeTransientServer {
  readonly sets: FakeSet[] = [];
  readonly commands = new Map<string, FakeSet>();
  readonly calls: string[] = [];
  sourceEnd: number;
  sourceReason: TransientUnavailableReason;
  deletedAt: number | null = null;
  prepareMs: number;
  liveCall = false;
  /** The next N requests are processed, but their answers are lost (UNKNOWN). */
  loseAnswers = 0;
  /** The next N new commands are refused BUSY. */
  busy = 0;
  /** Every generation from this one on fails. */
  failFromGeneration: number | null = null;
  readonly leadMs: number;

  constructor(private readonly options: FakeServerOptions) {
    this.sourceEnd = Date.now() + options.sourceEndsInMs;
    this.sourceReason = options.sourceReason ?? 'EXPIRED';
    this.prepareMs = options.prepareMs ?? 2_000;
    this.leadMs = options.leadMs ?? 5 * MINUTE;
  }

  sourceReadable(): boolean {
    return this.deletedAt === null && Date.now() < this.sourceEnd;
  }

  /** The owner deletes the source (CL-07 / RA-10). */
  deleteSource(): void {
    this.deletedAt = Date.now();
    this.sourceReason = 'DELETED';
  }

  private stateOf(s: FakeSet): TransientSetView['state'] {
    if (s.terminal !== null) return s.terminal;
    if (!this.sourceReadable() || Date.now() >= s.expiresAt) return 'EXPIRED';
    if (this.failFromGeneration !== null && s.generation >= this.failFromGeneration && Date.now() >= s.readyAt) return 'FAILED';
    return Date.now() >= s.readyAt ? 'READY' : 'RUNNING';
  }

  private view(s: FakeSet): TransientSetView {
    const state = this.stateOf(s);
    const live = state === 'PENDING' || state === 'RUNNING' || state === 'READY';
    const reason = this.sourceReadable() ? null : this.sourceReason;
    if (!live) return { state, runs: [], boundaries: [], readableForMs: 0, reason };
    const runs: TransientRunView[] = this.options.runs.map((durationMs, i) => ({
      artifactId: state === 'READY' ? s.ids[i]! : null, durationMs, spans: this.options.spans?.[i] ?? [],
    }));
    return { state, runs, boundaries: this.options.boundaries ?? [], readableForMs: Math.max(0, s.expiresAt - Date.now()), reason };
  }

  /** §14.2 / §20 in the order 0196 keeps. */
  async request(command: string): Promise<TransientRequestResult> {
    this.calls.push(`POST ${command}`);
    const result = this.answer(command);
    if (this.loseAnswers > 0) {
      this.loseAnswers -= 1;
      return { kind: 'UNKNOWN' };
    }
    return result;
  }

  private answer(command: string): TransientRequestResult {
    const known = this.commands.get(command);
    if (known !== undefined) return { kind: 'SET', set: this.view(known) };
    if (!this.sourceReadable()) return { kind: 'NOT_FOUND', reason: this.sourceReason };
    if (this.liveCall) return { kind: 'LIVE_CALL_ACTIVE' };
    if (this.busy > 0) {
      this.busy -= 1;
      return { kind: 'BUSY' };
    }
    const now = Date.now();
    for (const s of this.sets) if (s.terminal === null && now >= s.expiresAt) s.terminal = 'EXPIRED';
    const live = this.sets.filter((s) => s.terminal === null);
    const newest = live[live.length - 1];
    if (newest !== undefined && (newest.expiresAt >= this.sourceEnd || newest.expiresAt - now >= this.leadMs)) {
      this.commands.set(command, newest);
      return { kind: 'SET', set: this.view(newest) };
    }
    const made: FakeSet = {
      generation: (this.sets[this.sets.length - 1]?.generation ?? 0) + 1,
      ids: this.options.runs.map(() => uuid()),
      readyAt: now + this.prepareMs,
      expiresAt: Math.min(now + CAP_MS, this.sourceEnd),
      terminal: null,
    };
    this.sets.push(made);
    if (this.sets.filter((s) => s.terminal === null).length > 2) throw new Error('a third live generation');
    this.commands.set(command, made);
    return { kind: 'SET', set: this.view(made) };
  }

  private setOf(artifactId: string): FakeSet | undefined {
    return this.sets.find((s) => s.ids.includes(artifactId));
  }

  async status(artifactId: string): Promise<TransientStatusResult> {
    this.calls.push(`STATUS ${artifactId}`);
    const s = this.setOf(artifactId);
    if (s === undefined) return { kind: 'NOT_FOUND' };
    const v = this.view(s);
    return { kind: 'STATUS', status: { state: v.state, readableForMs: v.readableForMs, reason: v.reason } };
  }

  async release(artifactId: string): Promise<void> {
    this.calls.push(`DELETE ${artifactId}`);
    const s = this.setOf(artifactId);
    if (s !== undefined && s.terminal === null) s.terminal = 'RELEASED';
  }

  /** Whether a read of this file is served now (each Range is re-checked, §6). */
  readable(artifactId: string): boolean {
    const s = this.setOf(artifactId);
    return s !== undefined && this.stateOf(s) === 'READY';
  }

  generationOf(artifactId: string): number {
    return this.setOf(artifactId)?.generation ?? 0;
  }

  liveGenerations(): number {
    return this.sets.filter((s) => this.stateOf(s) === 'READY' || this.stateOf(s) === 'RUNNING' || this.stateOf(s) === 'PENDING').length;
  }
}

export interface AudibleSpan {
  /** Which player (its creation order). */
  readonly player: number;
  readonly artifactId: string;
  readonly generation: number;
  readonly wallStart: number;
  readonly wallEnd: number;
  readonly contentStart: number;
  readonly contentEnd: number;
}

export interface FakePlayerOptions {
  /** The time from create to the first byte (the network's latency; V-24a measured ≈ 1 s under load). */
  loadDelayMs: number;
  /** A seek on a playing player stalls its clock this long (a number, or one value per seek). */
  seekStallMs: number | (() => number);
  /** Each response is cut after this much reading (the 10-min response cap); 0: never. */
  responseCapMs: number;
}

export interface FakePlayerRecord {
  readonly url: string;
  readonly artifactId: string;
  readonly headers: Record<string, string>;
  readonly calls: string[];
  released: boolean;
  /** Plays after release (must never be counted). */
  playedAfterRelease: number;
}

/** A streaming player on the fake clock: never a file, never a cache; it stops when the server stops serving. */
export function createFakePlayerPort(server: FakeTransientServer, options: FakePlayerOptions) {
  const made: FakePlayerRecord[] = [];
  const audible: AudibleSpan[] = [];
  /** The most players alive (created, not released) at once: one, under CA-07B-2. */
  const alive = { max: 0 };
  let loadDelayMs = options.loadDelayMs;
  const port: VoiceNotePlayerPort = {
    async create(url, headers, onStatus) {
      const artifactId = url.slice(url.lastIndexOf('/') + 1);
      const record: FakePlayerRecord = {
        url, artifactId, headers, calls: [], released: false, playedAfterRelease: 0,
      };
      made.push(record);
      alive.max = Math.max(alive.max, made.filter((m) => !m.released).length);
      const length = (() => {
        const runs = server['options'].runs as readonly number[];
        const index = server.sets.find((s) => s.ids.includes(artifactId))?.ids.indexOf(artifactId) ?? 0;
        return runs[index] ?? 0;
      })();
      let loaded = false;
      let playing = false;
      let wantPlay = false;
      let failed = false;
      let base = 0;
      let startedAt = 0;
      let stallUntil = 0;
      let responseStart = 0;
      let span: { wallStart: number; contentStart: number } | null = null;
      const position = () => {
        if (!playing) return base;
        const t = Date.now();
        return Math.min(length, base + Math.max(0, t - Math.max(startedAt, stallUntil)));
      };
      const isAudible = () => playing && loaded && !failed && !record.released;
      const closeSpan = () => {
        if (span === null) return;
        const end = position();
        if (Date.now() > span.wallStart || end > span.contentStart) {
          audible.push({
            player: made.indexOf(record), artifactId, generation: server.generationOf(artifactId), wallStart: span.wallStart, wallEnd: Date.now(),
            contentStart: span.contentStart, contentEnd: end,
          });
        }
        span = null;
      };
      const openSpan = () => {
        if (span === null && isAudible()) span = { wallStart: Date.now(), contentStart: position() };
      };
      const emit = (patch: Partial<VoiceNotePlayerStatus> = {}) => {
        if (record.released) return;
        onStatus({ loaded, playing, positionMs: position(), durationMs: length, finished: false, failed, ...patch });
      };
      const startPlaying = () => {
        if (playing) return;
        base = position();
        startedAt = Date.now();
        playing = true;
        openSpan();
      };
      const stopPlaying = () => {
        closeSpan();
        base = position();
        playing = false;
      };
      const loadTimer = setTimeout(() => {
        if (record.released) return;
        if (!server.readable(artifactId)) {
          failed = true;
          emit();
          return;
        }
        loaded = true;
        responseStart = Date.now();
        if (wantPlay) startPlaying();
        emit();
      }, loadDelayMs);
      const ticker = setInterval(() => {
        if (record.released) return;
        if (playing && loaded) {
          // The server re-checks each read: a file no longer READY is cut (§15.1), as is a response past its cap.
          const cut = !server.readable(artifactId) || (options.responseCapMs > 0 && Date.now() - responseStart >= options.responseCapMs);
          if (cut) {
            stopPlaying();
            failed = true;
            emit();
            return;
          }
          if (position() >= length) {
            stopPlaying();
            base = length;
            emit({ finished: true, positionMs: length });
            return;
          }
        }
        emit();
      }, 250);
      const player: VoiceNotePlayer = {
        play: () => {
          if (record.released) {
            record.playedAfterRelease += 1;
            return;
          }
          record.calls.push('play');
          wantPlay = true;
          if (loaded && !failed) startPlaying();
        },
        pause: () => {
          record.calls.push('pause');
          wantPlay = false;
          if (playing) stopPlaying();
        },
        seekTo: async (ms) => {
          record.calls.push(`seek:${Math.round(ms)}`);
          closeSpan();
          base = Math.max(0, Math.min(length, ms));
          startedAt = Date.now();
          if (playing) {
            const stall = typeof options.seekStallMs === 'number' ? options.seekStallMs : options.seekStallMs();
            stallUntil = Date.now() + stall;
            if (stall > 0) setTimeout(() => openSpan(), stall);
            else openSpan();
          }
        },
        currentPositionMs: () => position(),
        release: () => {
          record.calls.push('release');
          if (playing) stopPlaying();
          record.released = true;
          clearTimeout(loadTimer);
          clearInterval(ticker);
        },
      };
      return player;
    },
  };
  /** A slower (or faster) start for every player created from here on. */
  const setLoadDelay = (ms: number) => {
    loadDelayMs = ms;
  };
  return { port, made, audible, alive, setLoadDelay };
}

export interface Continuity {
  /** Content never heard between the first and the last audible instant (ms). */
  readonly lostMs: number;
  /** The largest content heard twice at different moments (ms). */
  readonly repeatedMs: number;
  /** The largest silence between two audible spans (ms): what the reader HEARS as a gap. */
  readonly largestSilenceMs: number;
  /** The longest time two spans were heard together (ms): must be 0 (§20.2, CA-07B-2). */
  readonly overlapMs: number;
  readonly transitions: number;
}

/** How the audible log follows the content clock: per transition, the content jump and the silence. */
export function continuityOf(spans: readonly AudibleSpan[]): Continuity {
  // One player's consecutive pieces (a stall splits a span) are one span.
  const merged: AudibleSpan[] = [];
  for (const s of [...spans].sort((a, b) => a.wallStart - b.wallStart)) {
    const last = [...merged].reverse().find((m) => m.player === s.player);
    if (last !== undefined && s.wallStart - last.wallEnd <= 1 && Math.abs(s.contentStart - last.contentEnd) <= 1) {
      merged[merged.indexOf(last)] = { ...last, wallEnd: s.wallEnd, contentEnd: s.contentEnd };
    } else merged.push(s);
  }
  const sorted = merged.filter((s) => s.contentEnd > s.contentStart).sort((a, b) => a.wallStart - b.wallStart);
  let lostMs = 0;
  let repeatedMs = 0;
  let largestSilenceMs = 0;
  let overlapMs = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const before = sorted[i - 1]!;
    const after = sorted[i]!;
    let jump: number;
    if (after.wallStart >= before.wallEnd) {
      jump = after.contentStart - before.contentEnd;
      largestSilenceMs = Math.max(largestSilenceMs, after.wallStart - before.wallEnd);
    } else {
      overlapMs = Math.max(overlapMs, Math.min(before.wallEnd, after.wallEnd) - after.wallStart);
      // Heard together: where the earlier one was at that instant.
      jump = after.contentStart - (before.contentStart + (after.wallStart - before.wallStart));
    }
    if (jump > 0) lostMs += jump;
    if (jump < 0) repeatedMs = Math.max(repeatedMs, -jump);
  }
  return { lostMs, repeatedMs, largestSilenceMs, overlapMs, transitions: Math.max(0, sorted.length - 1) };
}
