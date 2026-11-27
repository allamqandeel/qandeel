/**
 * S8B-07 CP2-A.1 — the iOS Replay gate's readout of the continuous player. VALIDATION ONLY.
 *
 * It reads, never drives: every 100 ms it samples the place the player shows on its one timeline with the SAME functions
 * the timeline line draws it with (`replayPresentationClock`, `replayTimelinePosition`), and keeps what the gate asserts —
 * the moments passed through while playing, whether the place ever went back or jumped while it played with no step on
 * the line (a seek), the longest forward step, and whether the part was played to its end. A step on the line goes
 * through `controller.seekTo` of the wrapped controller this returns, so the readout knows a jump was asked for, and
 * where each step landed (the place shown once it settled), so the gate judges its accuracy. The line is read before the
 * first Play too, from the map the timeline is drawn on (`timelinePlan`) and a place chosen there (`pending`).
 * Nothing here is Product behaviour, and nothing in the Product imports it.
 */
import type { ReplayAudioClock } from '../../original-audio/replay-audio-clock';
import { replayPresentationClock, replayTimelinePosition, type ReplayPresentationClock } from '../../replay-cosmos';
import { replayMomentPaceMs, type ReplayPlayerController } from '../../replay-player';

export const CP2A1_PROOF_SAMPLE_MS = 100;
/** A seek's own jump, and the engine settling after it, are not judged for this long. */
export const CP2A1_PROOF_SEEK_GRACE_MS = 600;
/** While playing, the place may not go back by more than this between two samples… */
export const CP2A1_PROOF_BACK_MS = 50;
/** …nor step forward by more than this (a sample is 100 ms; a slow simulator frame is allowed for). */
export const CP2A1_PROOF_JUMP_MS = 1500;
/** Where a step landed: the place shown this long after it (the engine re-placed, a held place drawn). */
export const CP2A1_PROOF_LAND_MS = 300;

export interface Cp2a1ProofReading {
  readonly ordinal: number | null;
  readonly tMs: number | null;
  readonly durationMs: number | null;
  readonly playing: boolean;
  readonly seeks: number;
  /** Each step's landing place, in order. */
  readonly landsMs: readonly number[];
  readonly visited: readonly number[];
  readonly continuity: 'OK' | 'BROKEN';
  readonly maxStepMs: number;
  readonly ended: boolean;
}

export interface Cp2a1ProofMonitor {
  /** The player's controller with `seekTo` counted; the timeline is given this one. */
  readonly controller: ReplayPlayerController;
  sample(now?: number): Cp2a1ProofReading;
  reading(): Cp2a1ProofReading;
  subscribe(listener: () => void): () => void;
  start(): () => void;
}

export function createCp2a1ProofMonitor(player: ReplayPlayerController, clockOf: () => ReplayAudioClock | null): Cp2a1ProofMonitor {
  const listeners = new Set<() => void>();
  let seeks = 0;
  let seekAt = Number.NEGATIVE_INFINITY;
  let landing = false;
  let lands: number[] = [];
  let prevT: number | null = null;
  let visited: number[] = [];
  let broken = false;
  let maxStep = 0;
  let presentation: { plan: unknown; clock: ReplayPresentationClock | null } | null = null;
  let last: Cp2a1ProofReading = Object.freeze({
    ordinal: null, tMs: null, durationMs: null, playing: false, seeks: 0, landsMs: [], visited: [], continuity: 'OK', maxStepMs: 0, ended: false,
  });

  const controller: ReplayPlayerController = {
    ...player,
    seekTo(ordinal, offsetMs) {
      seeks += 1;
      seekAt = Date.now();
      // A step before the last one landed lands nowhere of its own: its place is recorded as not judged (NaN).
      if (landing) lands = [...lands, Number.NaN];
      landing = true;
      player.seekTo(ordinal, offsetMs);
    },
  };

  const sample = (now = Date.now()): Cp2a1ProofReading => {
    const open = player.getState().open;
    const clock = clockOf();
    const detail = clock?.detail() ?? null;
    const plan = detail?.timelinePlan ?? null;
    if (clock !== null && plan !== null && presentation?.plan !== plan) {
      presentation = { plan, clock: replayPresentationClock(plan, clock.moments, replayMomentPaceMs) };
    }
    let t: number | null = null;
    if (open !== null && clock !== null && plan !== null && presentation !== null && presentation.clock !== null) {
      const state = clock.getState();
      const paced = player.pacedElapsed();
      t = replayTimelinePosition(presentation.clock, open.ordinal, { phase: state.phase, ordinal: state.ordinal, place: clock.place() },
        paced !== null && paced.ordinal === open.ordinal ? paced.elapsedMs : null, detail?.pending ?? null);
    }
    const playing = open?.playing === true;
    const settling = now - seekAt < CP2A1_PROOF_SEEK_GRACE_MS;
    if (open !== null && (playing || settling) && visited[visited.length - 1] !== open.ordinal) visited = [...visited, open.ordinal];
    if (playing && !settling && prevT !== null && t !== null) {
      const step = t - prevT;
      if (step > maxStep) maxStep = step;
      if (step < -CP2A1_PROOF_BACK_MS || step > CP2A1_PROOF_JUMP_MS) broken = true;
    }
    prevT = t;
    if (landing && t !== null && now - seekAt >= CP2A1_PROOF_LAND_MS) {
      lands = [...lands, t];
      landing = false;
    }
    const durationMs = presentation?.clock?.durationMs ?? null;
    last = Object.freeze({
      ordinal: open?.ordinal ?? null,
      tMs: t,
      durationMs,
      playing,
      seeks,
      landsMs: lands,
      visited,
      continuity: broken ? 'BROKEN' : 'OK',
      maxStepMs: maxStep,
      ended: !playing && visited.length > 0 && t !== null && durationMs !== null && t >= durationMs - CP2A1_PROOF_BACK_MS,
    });
    for (const listener of Array.from(listeners)) listener();
    return last;
  };

  return {
    controller,
    sample,
    reading: () => last,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      const handle = setInterval(() => sample(), CP2A1_PROOF_SAMPLE_MS);
      return () => clearInterval(handle);
    },
  };
}

const seconds = (ms: number | null) => (ms === null ? '-' : (ms / 1000).toFixed(1));

/** The one line the gate reads (ASCII only; validation text, not Product copy). */
export function formatCp2a1Reading(r: Cp2a1ProofReading): string {
  return [
    `ord=${r.ordinal ?? '-'}`, `t=${seconds(r.tMs)}`, `dur=${seconds(r.durationMs)}`, `play=${r.playing ? 1 : 0}`, `seeks=${r.seeks}`,
    `lands=${r.landsMs.map((ms) => (Number.isNaN(ms) ? 'x' : seconds(ms))).join(',') || '-'}`,
    `visited=${r.visited.join('-') || '-'}`, `cont=${r.continuity}`, `max=${seconds(r.maxStepMs)}`, `end=${r.ended ? 1 : 0}`,
  ].join(' ');
}
