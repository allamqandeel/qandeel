/**
 * S8B-07 CP1-B (VA-8, Sheet B) — the clock of ONE V2 Replay version: the Replay player's clock-source port, implemented
 * over the one transient engine (`replay:<versionId>`), with the server's presentation map as its only description.
 *
 *   owns           the version's ORIGINAL_AUDIO moments; a TEXT moment is never the clock's (B2X)
 *   the moment     while a run plays, the latest-started window at or before the file position (D-05.5, C-B2): it never
 *                  changes inside a window or in a held space; a multi-unit voice turn is ONE window, presented as its
 *                  first unit's moment, and its later units are covered by it (C-B1)
 *   a Spine jump   the start of the target moment's window (B2T); inside the window only, the moment line seeks (B2S)
 *   the next run   after a run's file ends, the next audio moment in order starts its run from the file's start, after the
 *                  boundary pause the phone times (§5.4: SAME_RECORDING real up to 3 s, else 1.5 s; CROSS_RECORDING 1.5 s,
 *                  no length), with the next run's player created paused at the pause's start
 *   fail closed    a map that does not describe exactly this version's audio moments (a TEXT moment named, a moment named
 *                  twice, an audio moment no window covers, windows out of order) is refused whole: RA-12, nothing plays
 *
 * Nothing here is drawn, analysed or mapped: the moment it reports is all the player and the Living Analysis read.
 * Nothing is logged, and nothing is written anywhere: the position lives in memory.
 */
import type { ReplayMomentClock, ReplayMomentClockState } from '../replay-player';
import type { ReplayHistoryMoment, ReplayHistoryVersion } from '../runtime-entry';
import {
  boundaryPauseMs,
  momentAt,
  spanAt,
  type PresentationBoundary,
  type PresentationRun,
  type PresentationSpan,
} from './presentation-map';
import type { TransientPlayback, TransientPlaybackState, TransientRunShape } from './transient-playback';

type Window = Extract<PresentationSpan, { kind: 'WINDOW' }>;

/** The map read against the version: where each audio moment is, and which moments each run covers. */
export interface ReplayAudioPlan {
  readonly runs: readonly PresentationRun[];
  readonly boundaries: readonly PresentationBoundary[];
  /** Every audio moment's window (a later unit maps to its turn's window). */
  readonly windowOf: ReadonlyMap<number, { readonly runIndex: number; readonly window: Window }>;
  /** The last moment each run covers, later units included. */
  readonly throughOf: readonly number[];
}

const asRun = (shape: TransientRunShape): PresentationRun => ({ artifactId: null, durationMs: shape.durationMs, spans: shape.spans });

/** The map against the version's moments, or null when it does not describe exactly them (refused whole). */
export function planFor(moments: readonly ReplayHistoryMoment[], shapes: readonly TransientRunShape[], boundaries: readonly PresentationBoundary[]): ReplayAudioPlan | null {
  const runs = shapes.map(asRun);
  const medium = new Map(moments.map((moment) => [moment.ordinal, moment.originalMedium]));
  const windows: { runIndex: number; window: Window }[] = [];
  runs.forEach((run, runIndex) => {
    for (const span of run.spans) if (span.kind === 'WINDOW') windows.push({ runIndex, window: span });
  });
  const named = new Set<number>();
  let last = 0;
  for (const { window } of windows) {
    // Only an audio moment of this version, once, and in the Replay's order across the runs.
    if (medium.get(window.momentOrdinal) !== 'ORIGINAL_AUDIO' || named.has(window.momentOrdinal) || window.momentOrdinal <= last) return null;
    named.add(window.momentOrdinal);
    last = window.momentOrdinal;
  }
  const windowOf = new Map<number, { runIndex: number; window: Window }>();
  for (const entry of windows) windowOf.set(entry.window.momentOrdinal, entry);
  const throughOf = runs.map(() => 0);
  let covering: { runIndex: number; window: Window; role: ReplayHistoryMoment['sourceRole'] } | null = null;
  for (const moment of [...moments].sort((a, b) => a.ordinal - b.ordinal)) {
    if (moment.originalMedium !== 'ORIGINAL_AUDIO') {
      covering = null;
      continue;
    }
    const own = windowOf.get(moment.ordinal) ?? null;
    if (own !== null) covering = { ...own, role: moment.sourceRole };
    // An audio moment no window names is a later unit of the turn just before it (the same speaker), or the map is not
    // this version's.
    else if (covering === null || covering.role !== moment.sourceRole) return null;
    else windowOf.set(moment.ordinal, { runIndex: covering.runIndex, window: covering.window });
    throughOf[covering.runIndex] = Math.max(throughOf[covering.runIndex] ?? 0, moment.ordinal);
  }
  if (runs.some((_, index) => (throughOf[index] ?? 0) === 0)) return null;
  return { runs, boundaries, windowOf, throughOf };
}

/** What the views read of the clock now (the moment line, the frames, the notices). */
export interface ReplayAudioDetail {
  readonly engine: TransientPlaybackState;
  readonly plan: ReplayAudioPlan | null;
  /** The map could not be used: refused whole (RA-12). */
  readonly refused: boolean;
  /** The boundary pause being held now, before the next run (RA-04 / RA-05 under the ended moment). */
  readonly between: PresentationBoundary | null;
  /** The file position the views show for the moment presented (the run playing, or the place held). */
  readonly runIndex: number;
  readonly positionMs: number;
}

export type ReplayAudioAnnouncement =
  | { readonly kind: 'MIX' }
  | { readonly kind: 'GAP'; readonly gapKind: Extract<PresentationSpan, { kind: 'GAP' }>['gapKind']; readonly ms: number }
  | { readonly kind: 'HELD'; readonly elapsedMs: number }
  | { readonly kind: 'BOUNDARY'; readonly boundary: PresentationBoundary };

export interface ReplayAudioClock extends ReplayMomentClock {
  readonly versionId: string;
  readonly moments: readonly ReplayHistoryMoment[];
  detail(): ReplayAudioDetail;
  /** A change the views show (the position included): never the controller's concern. */
  revision(): number;
  /** B2S: a place inside the moment's own window, and nowhere else. */
  seekWithin(ordinal: number, offsetMs: number): void;
}

export interface ReplayAudioClockOptions {
  readonly version: ReplayHistoryVersion;
  readonly moments: readonly ReplayHistoryMoment[];
  readonly engine: (onRunEnd: (runIndex: number) => void) => TransientPlayback;
  /** Whether a playback may start now (the live call outranks it): the boundary's own start asks it first. */
  readonly allowed: () => boolean;
  readonly onAnnounce?: (announcement: ReplayAudioAnnouncement) => void;
  readonly onRetired?: () => void;
  readonly setTimer?: (callback: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
  readonly now?: () => number;
}

const IDLE: ReplayMomentClockState = Object.freeze({ phase: 'IDLE', ordinal: null, through: null });

export function createReplayAudioClock(options: ReplayAudioClockOptions): ReplayAudioClock {
  const { moments } = options;
  const setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const now = options.now ?? (() => Date.now());
  const audio = new Set(moments.filter((moment) => moment.originalMedium === 'ORIGINAL_AUDIO').map((moment) => moment.ordinal));

  let state: ReplayMomentClockState = IDLE;
  let revision = 0;
  let retired = false;
  let plan: ReplayAudioPlan | null = null;
  let refused = false;
  /** The run whose end is reported (DONE), until the next run is asked for. */
  let finished: number | null = null;
  /** The boundary pause before run `runIndex`, while it is held (its remaining length while paused). */
  let boundary: { readonly runIndex: number; readonly of: PresentationBoundary; leftMs: number; startedAt: number; handle: unknown } | null = null;
  /** A place inside a moment chosen while nothing ran there (B2S): the next start of that moment begins there. */
  let pendingOffset: { readonly ordinal: number; readonly offsetMs: number } | null = null;
  /** The spans already announced at this file place, so each is said once as it starts. */
  let announced = new Set<PresentationSpan>();
  const listeners = new Set<() => void>();

  const engine = options.engine(onRunEnd);
  const unsubscribeEngine = engine.subscribe(derive);

  function changed(next: ReplayMomentClockState | null): void {
    revision += 1;
    if (next !== null && (next.phase !== state.phase || next.ordinal !== state.ordinal || next.through !== state.through)) state = Object.freeze(next);
    for (const listener of Array.from(listeners)) listener();
  }

  function ensurePlan(): ReplayAudioPlan | null {
    const shapes = engine.getState().runs;
    if (plan !== null || refused || shapes === null) return plan;
    const read = planFor(moments, shapes, engine.getState().boundaries);
    if (read === null) {
      refused = true;
      engine.leave();
      return null;
    }
    plan = read;
    return plan;
  }

  /** The engine's state, read as the clock's (never while a boundary pause or a reported end is held). */
  function derive(): void {
    if (retired) return;
    const e = engine.getState();
    ensurePlan();
    if (refused) return changed({ phase: 'FAILED', ordinal: state.ordinal, through: null });
    if (e.phase === 'ENDED') return changed({ phase: 'ENDED', ordinal: state.ordinal, through: null });
    if (e.phase === 'FAILED') return changed({ phase: 'FAILED', ordinal: state.ordinal, through: null });
    if (boundary !== null) return changed(null);
    if (finished !== null) return changed({ phase: 'DONE', ordinal: state.ordinal, through: plan?.throughOf[finished] ?? state.ordinal });
    if (e.phase === 'IDLE') return changed({ phase: 'IDLE', ordinal: state.ordinal, through: null });
    if (e.phase === 'PREPARING') return changed({ phase: 'PREPARING', ordinal: state.ordinal, through: null });
    if (e.phase === 'PAUSED') return changed({ phase: 'HELD', ordinal: state.ordinal, through: null });
    if (e.phase === 'PLAYING' && plan !== null) {
      const run = plan.runs[e.runIndex];
      const ordinal = run === undefined ? null : momentAt(run, e.positionMs);
      if (run !== undefined) announce(run, e.positionMs);
      return changed({ phase: 'RUNNING', ordinal: ordinal ?? state.ordinal, through: null });
    }
    changed(null);
  }

  function announce(run: PresentationRun, positionMs: number): void {
    const say = options.onAnnounce;
    if (say === undefined) return;
    for (const kind of ['MIX', 'GAP', 'HELD'] as const) {
      const span = spanAt(run, kind, positionMs);
      if (span === null || announced.has(span)) continue;
      announced.add(span);
      if (span.kind === 'MIX') say({ kind: 'MIX' });
      else if (span.kind === 'GAP' && span.gapKind !== 'NOT_SPEAKING') say({ kind: 'GAP', gapKind: span.gapKind, ms: span.toMs - span.fromMs });
      else if (span.kind === 'HELD' && span.shortened) say({ kind: 'HELD', elapsedMs: span.elapsedMs });
    }
  }

  function onRunEnd(runIndex: number): void {
    if (retired) return;
    finished = runIndex;
    derive();
  }

  function cancelBoundary(): void {
    if (boundary === null) return;
    clearTimer(boundary.handle);
    boundary = null;
  }

  function holdBoundary(runIndex: number, of: PresentationBoundary, leftMs: number): void {
    cancelBoundary();
    const entry = { runIndex, of, leftMs, startedAt: now(), handle: null as unknown };
    entry.handle = setTimer(() => {
      if (boundary !== entry || retired) return;
      boundary = null;
      announced = new Set();
      if (!engine.play(runIndex, 0)) changed({ phase: 'HELD', ordinal: state.ordinal, through: null });
      else derive();
    }, leftMs);
    boundary = entry;
  }

  /** Where a moment starts in the file: its window's start, or a place inside it chosen while it was not running. */
  function startOf(ordinal: number, located: { runIndex: number; window: Window }): { runIndex: number; positionMs: number } {
    const offset = pendingOffset !== null && pendingOffset.ordinal === ordinal ? pendingOffset.offsetMs : 0;
    pendingOffset = null;
    const { window } = located;
    return { runIndex: located.runIndex, positionMs: Math.min(window.toMs - 1, window.fromMs + Math.max(0, offset)) };
  }

  const clock: ReplayAudioClock = {
    versionId: options.version.versionId,
    moments,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    owns: (ordinal) => audio.has(ordinal),
    run(ordinal, entry) {
      if (retired || !audio.has(ordinal) || state.phase === 'ENDED' || refused) return false;
      if (!options.allowed()) return false;
      cancelBoundary();
      finished = null;
      announced = new Set();
      const known = ensurePlan();
      if (refused) {
        derive();
        return false;
      }
      if (known === null) {
        // Nothing held yet: the set is asked for, and the map places the start when it arrives.
        const asked = ordinal;
        const ok = engine.play(0, 0, (shapes) => {
          const read = planFor(moments, shapes, engine.getState().boundaries);
          const located = read?.windowOf.get(asked);
          return read === null || located === undefined ? null : startOf(asked, located);
        });
        if (!ok) return false;
        changed({ phase: 'PREPARING', ordinal: null, through: null });
        return true;
      }
      const located = known.windowOf.get(ordinal);
      if (located === undefined) return false;
      const first = known.runs[located.runIndex]?.spans.find((span) => span.kind === 'WINDOW') === located.window;
      if (entry === 'ADVANCE' && located.runIndex > 0 && first) {
        // The pause before the next run, timed here; the next run's player is made paused at its start.
        const of = known.boundaries[located.runIndex - 1]!;
        engine.prepare(located.runIndex);
        holdBoundary(located.runIndex, of, boundaryPauseMs(of));
        options.onAnnounce?.({ kind: 'BOUNDARY', boundary: of });
        changed({ phase: 'RUNNING', ordinal: null, through: null });
        return true;
      }
      const at = entry === 'ADVANCE' && first ? { runIndex: located.runIndex, positionMs: 0 } : startOf(ordinal, located);
      if (!engine.play(at.runIndex, at.positionMs)) return false;
      changed({ phase: engine.getState().phase === 'PLAYING' ? 'RUNNING' : 'PREPARING', ordinal: ordinal === state.ordinal ? ordinal : null, through: null });
      derive();
      return true;
    },
    hold() {
      if (retired) return;
      if (boundary !== null) {
        clearTimer(boundary.handle);
        boundary.leftMs = Math.max(0, boundary.leftMs - (now() - boundary.startedAt));
        const kept = boundary;
        boundary = null;
        engine.pause();
        boundary = { ...kept, handle: null };
        changed({ phase: 'HELD', ordinal: state.ordinal, through: null });
        return;
      }
      engine.pause();
      derive();
    },
    resume() {
      if (retired || state.phase === 'ENDED' || refused || !options.allowed()) return false;
      if (boundary !== null && boundary.handle === null) {
        const kept = boundary;
        boundary = null;
        holdBoundary(kept.runIndex, kept.of, kept.leftMs);
        changed({ phase: 'RUNNING', ordinal: null, through: null });
        return true;
      }
      const e = engine.getState();
      if (!engine.play(e.runIndex, e.positionMs)) return false;
      derive();
      return true;
    },
    release() {
      if (retired) return;
      cancelBoundary();
      finished = null;
      pendingOffset = null;
      engine.leave();
      changed({ phase: 'IDLE', ordinal: null, through: null });
    },
    retire() {
      if (retired) return;
      cancelBoundary();
      retired = true;
      unsubscribeEngine();
      engine.leave();
      engine.retire();
      listeners.clear();
      options.onRetired?.();
    },
    detail() {
      const e = engine.getState();
      return { engine: e, plan, refused, between: boundary === null ? null : boundary.of, runIndex: e.runIndex, positionMs: e.positionMs };
    },
    revision: () => revision,
    seekWithin(ordinal, offsetMs) {
      if (retired || !audio.has(ordinal)) return;
      const located = plan?.windowOf.get(ordinal);
      const e = engine.getState();
      const presented = state.ordinal === null ? undefined : plan?.windowOf.get(state.ordinal)?.window;
      if (located === undefined || presented !== located.window || (e.phase !== 'PLAYING' && e.phase !== 'PAUSED' && e.phase !== 'PREPARING') || e.runIndex !== located.runIndex) {
        // Not running here: the next start of this moment begins at that place inside its window.
        pendingOffset = { ordinal, offsetMs };
        changed(null);
        return;
      }
      const { window } = located;
      engine.seek(located.runIndex, Math.min(window.toMs - 1, window.fromMs + Math.max(0, offsetMs)));
      derive();
    },
  };
  return clock;
}
