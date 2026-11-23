/**
 * PR #404 RB-1 S1–S3 — the Replay's ONE presentation clock when the version has original audio: CP1-B's presentation
 * map, exactly as the phone's ReplayAudioClock read it against the version (`planFor`), laid out as presentation time.
 * It is not a second timing authority: every number is a sum of the map's own lengths (each run's file, its spans), the
 * boundary pause the clock itself holds (§5.4, `boundaryPauseMs`), and — for a TEXT moment, which carries no audio and is
 * not in the map — the declared reading pace the player times it with (B2X). Nothing is measured, estimated or invented.
 *
 *   blocks    in moment order: a TEXT moment's reading pace; before a later run, its boundary pause; each run's file
 *   windows   every WINDOW of every run, overlapping speakers kept as they are (none dropped, merged or flattened)
 *   inputs    each moment for the timeline: its window (a later unit of a voice turn: its turn's, C-B1), the instant it
 *             has been presented in full (an audio window's END: no analysis before speech; a text moment's display),
 *             and NO availability (none is recorded before RB-2 — never filled in here)
 *   at(place) the clock's place (a file position, or the elapsed part of the pause) as presentation time; `placeAt` the
 *             reverse, which is how the export places the original audio under its frames (S3)
 *
 * The in-app stage (S2) follows the place the clock reports — the playing file's own position — and never a wall clock
 * or the reading pace while it presents audio; the video (S3) draws frame k at k / fps on this same clock with each run's
 * file at `runStartMs`. Known limitation, not RB-1's to fix: the map's HELD spans are D-05.1's (a long pause presented as
 * 1.5 s); full-length pauses are RB-5 RS-7. Text-only versions have no map and keep the reading pace (no audio claimed).
 */
import { boundaryPauseMs, type PresentationBoundary, type PresentationSpan, type PresentationTrack } from '../original-audio/presentation-map';
import type { ReplayAudioPlace, ReplayAudioPlan } from '../original-audio/replay-audio-clock';
import type { ReplayMomentClockPhase } from '../replay-player';
import type { ReplayHistoryMoment } from '../runtime-entry';
import type { ReplayCosmosMomentInput } from './timeline';

export type ReplayPresentationBlock =
  | { readonly kind: 'TEXT'; readonly ordinal: number; readonly startMs: number; readonly endMs: number }
  | { readonly kind: 'PAUSE'; readonly runIndex: number; readonly startMs: number; readonly endMs: number; readonly boundary: PresentationBoundary }
  | { readonly kind: 'RUN'; readonly runIndex: number; readonly startMs: number; readonly endMs: number };

export interface ReplayPresentationWindow {
  readonly momentOrdinal: number;
  readonly track: PresentationTrack;
  readonly runIndex: number;
  readonly startMs: number;
  readonly endMs: number;
}

/** A span of a run, on the presentation clock (its file times moved by the run's start, nothing else). */
export type ReplayPresentationSpan = PresentationSpan & { readonly runIndex: number; readonly startMs: number; readonly endMs: number };

export interface ReplayPresentationClock {
  readonly durationMs: number;
  readonly blocks: readonly ReplayPresentationBlock[];
  readonly windows: readonly ReplayPresentationWindow[];
  readonly spans: readonly ReplayPresentationSpan[];
  readonly inputs: readonly ReplayCosmosMomentInput[];
  runStartMs(runIndex: number): number;
  at(place: ReplayAudioPlace): number;
  /** The audio place presenting time t, or null in a TEXT block (no audio there). */
  placeAt(t: number): ReplayAudioPlace | null;
}

/**
 * The clock of a version's audio plan, or null when it cannot be laid out without skipping: a TEXT moment between two
 * moments of one run (CP1-B's `planFor` accepts it; the server never groups so — 0195 `kept` / `grouped` start a new
 * run at every text item — and the player would pass over it while that run plays), or a run presented out of order.
 */
export function replayPresentationClock(plan: ReplayAudioPlan, moments: readonly ReplayHistoryMoment[], paceMs: (moment: ReplayHistoryMoment) => number): ReplayPresentationClock | null {
  const ordered = [...moments].sort((a, b) => a.ordinal - b.ordinal);
  const blocks: ReplayPresentationBlock[] = [];
  const runStart = new Map<number, number>();
  const inputs: ReplayCosmosMomentInput[] = [];
  let cursor = 0;
  let open: number | null = null; // the run being presented, until its last moment
  for (const moment of ordered) {
    if (moment.originalMedium !== 'ORIGINAL_AUDIO') {
      if (open !== null && moment.ordinal < (plan.throughOf[open] ?? 0)) return null;
      open = null;
      const length = Math.max(1, paceMs(moment));
      blocks.push({ kind: 'TEXT', ordinal: moment.ordinal, startMs: cursor, endMs: cursor + length });
      inputs.push({ ordinal: moment.ordinal, tc: moment.tc, windowStartMs: cursor, windowEndMs: cursor + length, completeAtMs: cursor, presentedBy: moment.ordinal, availableAtMs: null });
      cursor += length;
      continue;
    }
    const located = plan.windowOf.get(moment.ordinal);
    if (located === undefined) return null;
    const { runIndex, window } = located;
    if (!runStart.has(runIndex)) {
      // A run starts once, in order, after everything before it; a later run after the pause the clock holds before it.
      if (runIndex !== runStart.size) return null;
      if (runIndex > 0) {
        const boundary = plan.boundaries[runIndex - 1];
        if (boundary === undefined) return null;
        const pause = boundaryPauseMs(boundary);
        blocks.push({ kind: 'PAUSE', runIndex, startMs: cursor, endMs: cursor + pause, boundary });
        cursor += pause;
      }
      const run = plan.runs[runIndex]!;
      runStart.set(runIndex, cursor);
      blocks.push({ kind: 'RUN', runIndex, startMs: cursor, endMs: cursor + run.durationMs });
      cursor += run.durationMs;
    } else if (open !== runIndex) {
      return null;
    }
    open = runIndex;
    const offset = runStart.get(runIndex)!;
    // A later unit of a voice turn is presented on its turn's window (C-B1): the same window, the same end.
    inputs.push({
      ordinal: moment.ordinal, tc: moment.tc, windowStartMs: offset + window.fromMs, windowEndMs: offset + window.toMs, completeAtMs: offset + window.toMs,
      presentedBy: window.momentOrdinal, availableAtMs: null,
    });
  }
  if (runStart.size !== plan.runs.length) return null;

  const windows: ReplayPresentationWindow[] = [];
  const spans: ReplayPresentationSpan[] = [];
  plan.runs.forEach((run, runIndex) => {
    const offset = runStart.get(runIndex)!;
    for (const span of run.spans) {
      spans.push({ ...span, runIndex, startMs: offset + span.fromMs, endMs: offset + span.toMs });
      if (span.kind === 'WINDOW') windows.push({ momentOrdinal: span.momentOrdinal, track: span.track, runIndex, startMs: offset + span.fromMs, endMs: offset + span.toMs });
    }
  });
  const durationMs = cursor;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    durationMs, blocks, windows, spans, inputs,
    runStartMs: (runIndex) => runStart.get(runIndex) ?? 0,
    at(place) {
      if (place.kind === 'RUN') {
        const block = blocks.find((b) => b.kind === 'RUN' && b.runIndex === place.runIndex);
        return block === undefined ? 0 : block.startMs + clamp(place.positionMs, 0, block.endMs - block.startMs);
      }
      const pause = blocks.find((b) => b.kind === 'PAUSE' && b.runIndex === place.runIndex);
      if (pause !== undefined) return pause.startMs + clamp(place.elapsedMs, 0, pause.endMs - pause.startMs);
      return runStart.get(place.runIndex) ?? 0;
    },
    placeAt(t) {
      const block = blocks.find((b) => b.startMs <= t && t < b.endMs) ?? (t >= durationMs ? blocks[blocks.length - 1] : undefined);
      if (block === undefined || block.kind === 'TEXT') return null;
      if (block.kind === 'PAUSE') return { kind: 'BOUNDARY', runIndex: block.runIndex, elapsedMs: clamp(t, block.startMs, block.endMs) - block.startMs };
      return { kind: 'RUN', runIndex: block.runIndex, positionMs: clamp(t, block.startMs, block.endMs) - block.startMs };
    },
  };
}

/**
 * The in-app stage's allowance behind the audio place: FC-0 (PO, 2026-11-23), on the audio and in a text block after it.
 * Measured on HONOR ALI-NX1's built-in speaker (RB1_REPORT §13, phone mic and screen-present times on one clock): the
 * clock's reported place leads the HEARD sound by up to 106.45 ms in steady play and up to 201.65 ms just after a resume or
 * a generation handover; at 100 ms, disclosures were drawn up to 81.8 ms before their speech was audibly over. 300 ms
 * covers that measured worst case with margin. It delays; it never advances anything. It is evidence for that phone's
 * speaker only: Bluetooth, wired, a route change, other devices and iOS are NOT measured, and it is not claimed for them.
 */
export const REPLAY_STAGE_AUDIO_LAG_MS = 300;

/**
 * S2: what the stage reads of the version's audio clock (the CP1-B `ReplayAudioClock` is one, as it is): its state, its
 * plan once the map is held, and its place now. The stage subscribes to nothing else and never times anything itself.
 */
export interface ReplayStageClock {
  getState(): { readonly phase: ReplayMomentClockPhase; readonly ordinal: number | null };
  subscribe(listener: () => void): () => void;
  revision(): number;
  detail(): { readonly plan: ReplayAudioPlan | null };
  place(): ReplayAudioPlace | null;
}

export interface ReplayStageAudioState {
  readonly phase: ReplayMomentClockPhase;
  readonly ordinal: number | null;
  readonly place: ReplayAudioPlace | null;
}

export type ReplayStageTime =
  /**
   * The moment shown is text: the reading pace runs inside its block (the player times it), no audio claimed — drawn
   * `behindMs` behind it, the audio's own allowance: the player shows a text moment as soon as the file before it reports
   * its end, and that report leads what is heard, so the disclosure of the run's last speech waits as it would on the audio.
   */
  | { readonly kind: 'PACED'; readonly startMs: number; readonly endMs: number; readonly behindMs: number }
  /** Following the audio: the clock's place, behind it by the stated allowance. */
  | { readonly kind: 'AUDIO'; readonly t: number }
  /** Nothing presents the moment shown now: its start, where the player starts it. */
  | { readonly kind: 'AT'; readonly t: number };

const FOLLOWING: readonly ReplayMomentClockPhase[] = ['PREPARING', 'RUNNING', 'HELD', 'DONE'];

/**
 * The stage time for the moment the player shows (S2), from the audio clock's own state and place. The place is used only
 * while it presents that moment — the clock presents it or nothing named (a boundary pause, a start not yet heard), and
 * the place lies inside the moment's presentation range (from its window's start to the next moment's) — so a stale
 * place (paused elsewhere, then moved on the Spine) can never draw later knowledge than the moment shown allows.
 */
export function replayStageTime(clock: ReplayPresentationClock, shown: number, audio: ReplayStageAudioState): ReplayStageTime {
  const index = clock.inputs.findIndex((m) => m.ordinal === shown);
  if (index < 0) return { kind: 'AT', t: 0 };
  const own = clock.inputs[index]!;
  const text = clock.blocks.find((b) => b.kind === 'TEXT' && b.ordinal === shown);
  if (text !== undefined) return { kind: 'PACED', startMs: text.startMs, endMs: text.endMs, behindMs: REPLAY_STAGE_AUDIO_LAG_MS };
  const start = own.windowStartMs;
  const next = clock.inputs.slice(index + 1).find((m) => m.windowStartMs > start);
  const end = next === undefined ? clock.durationMs : next.windowStartMs;
  const presentedBy = (ordinal: number) => clock.inputs.find((m) => m.ordinal === ordinal)?.presentedBy ?? ordinal;
  const presents = audio.ordinal === null || presentedBy(audio.ordinal) === own.presentedBy;
  if (audio.place === null || !FOLLOWING.includes(audio.phase) || !presents) return { kind: 'AT', t: start };
  const t = clock.at(audio.place);
  if (t < start) return { kind: 'AT', t: start };
  // Past the range while the clock still names this moment: its report trails the place by up to one status tick (250 ms),
  // so the stage holds at the range's end until the player shows the next moment (a delay, never an advance).
  return { kind: 'AUDIO', t: Math.max(0, Math.min(t, end) - REPLAY_STAGE_AUDIO_LAG_MS) };
}

/** S3: the original audio under the video — each run's file at the clock's own offset; silence (no file) elsewhere. */
export function replayExportAudio(clock: ReplayPresentationClock): readonly { readonly runIndex: number; readonly atMs: number; readonly durationMs: number }[] {
  return clock.blocks.filter((b): b is Extract<ReplayPresentationBlock, { kind: 'RUN' }> => b.kind === 'RUN')
    .map((b) => ({ runIndex: b.runIndex, atMs: b.startMs, durationMs: b.endMs - b.startMs }));
}
