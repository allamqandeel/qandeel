/**
 * S8B-07 CP1-B (contract §7, §15.2, §19.2, §20) — playing ONE subject's transient set: a call's listening file (one run)
 * or a Replay version's run files. The engine owns the audio only: which file plays, from where, and when it stops. It
 * knows nothing of graphics, the analysis or the map, and it decides no copy (the views map its state to the approved
 * rows). Every rule is tested through the player port and the client's outcomes (no device); the HC criteria are the
 * device's to prove (step 6), never this engine's tests.
 *
 *   Starting         the slot is claimed (refused while a live call runs, V-34); the POST asks for the set, re-asked with
 *                    the SAME command every 1 s while it is prepared; a lost answer is asked again with the same command.
 *   Stopping (§15.2) the local deadline (answer instant + readableForMs), a status check every 10 s while playing, a
 *                    player error or a refused Range, or the owner's own deletion: pause, release, fetch nothing more.
 *                    A file that is no longer READY while its source is available is NOT a stop (§20): continuation.
 *   Sorting a cause  a new command is asked: a live set is the continuation; NOT_FOUND carries the PROVEN reason (or
 *                    none). The engine never infers a cause (V-30), and never ends while the source is available.
 *   Range (§19.2)    the exact played position is read from the player, the status asked first; READY → the player is
 *                    re-created and seeked there, at most 3 times a minute with back-off; anything else → the cause.
 *   Renewal (§20)    while playing, below L (5 min) of readability left and the file not covering the source, ONE POST
 *                    with a new command; never while paused; the same set back with less than L left: it covers the
 *                    source, so it is never renewed again and plays to E. On play or resume below L: renewed first.
 *   Hand-over (§20.2, amended by the PO 2026-11-08: CA-07B-2) ONE player, never two. G+1 READY while playing, and the file
 *                    stops being readable before the run ends: the old player is paused FIRST and its place read once
 *                    it has stopped; it is released and its file let go
 *                    (DELETE); the new file's player is created there, `resumeBehindMs` behind, and started. A short
 *                    silence (≤ 1 s, measured on the phone's output), no content lost, at most 150 ms heard twice at
 *                    the switch, the two generations never heard together; the position does not move while it is
 *                    silent, nor back.
 *   Degraded         G+1 not READY when the file stops being readable, or G+1 FAILED: the continuation is asked for
 *                    and started at the saved place when it is ready; `TRANSIENT_HANDOVER_DEGRADED` (content-free).
 *
 * The position lives in this runtime's memory only. Nothing is written to the device: the player streams (§15.3).
 * Nothing is logged: no URL, header, id or position.
 */
import type { ForegroundSignal } from '../runtime-entry';
import type { VoiceNotePlayer, VoiceNotePlayerPort, VoiceNotePlayerStatus } from '../voice-note/voice-note-playback';
import type { PlaybackClaim, PlaybackOwner, PlaybackReleaseCause } from './playback-owner';
import type { PresentationBoundary, PresentationSpan } from './presentation-map';
import type { TransientRequestResult, TransientSetView, TransientStatusResult, TransientUnavailableReason } from './transient-media-api';

/** §20: renew below this much readability (initial value; configurable only within [3 min, 10 min]). */
export const TRANSIENT_RENEWAL_LEAD_MS = 5 * 60_000;
export const TRANSIENT_RENEWAL_LEAD_RANGE_MS = Object.freeze({ min: 3 * 60_000, max: 10 * 60_000 });
/** §15.2: the status is asked this often while playing. */
export const TRANSIENT_STATUS_EVERY_MS = 10_000;
/** D-05.4: CL-04 / RA-11 appear only after this long without audio. */
export const TRANSIENT_WAITING_NOTICE_MS = 1_000;
/** The POST of a set being prepared is asked again (same command) this often. */
export const TRANSIENT_POLL_MS = 1_000;
/**
 * §20.2 hand-over (CA-07B-2, Product Owner 2026-11-08): one player. `maxSilenceMs` and `maxRepeatMs` are the acceptance
 * bounds on the phone's output (HC-2′, HC-1 (b′)), not tuning: nothing here waits or seeks by them.
 */
export const TRANSIENT_HANDOVER = Object.freeze({
  /** HC-2′: the silence between the old file's last heard sample and the new file's first, on the phone's output. */
  maxSilenceMs: 1_000,
  /** HC-1 (b′): content heard twice, at the switch only (no content is ever lost). 100 → 150: PO, 2026-11-08 (final). */
  maxRepeatMs: 150,
  /** The switch is made once the file would stop being readable this close to (or before) the run's end. */
  marginMs: 10_000,
  /**
   * A continuation (a switch, a resume) starts this far before the saved place. On HONOR (step 6) the place a stopped
   * player reports differs from what was heard by an amount that varies per player, so the content gap at a switch,
   * with no allowance, spanned −81.4 … +45.9 ms over 112 switches (positive = lost). 57 ms puts all of it at −138 … −11:
   * nothing lost, at most 150 ms heard twice (`maxRepeatMs`), about 11 ms of margin each side. Never ≥ maxRepeatMs.
   */
  resumeBehindMs: 57,
  /** The longest the switch waits for the paused player to say it has stopped before reading its place. */
  stopWaitMs: 300,
});
/** §19.2: at most this many resumes a minute, with this back-off before each. */
export const TRANSIENT_RESUME = Object.freeze({ perMinute: 3, windowMs: 60_000, backoffMs: Object.freeze([0, 1_000, 2_000]) });
/** A player that reports its end this far before its file's length was cut early (a Range answer that ended): resumed. */
export const TRANSIENT_EARLY_END_MS = 500;
/** Lost answers asked again before a start gives up (CL-05 / RA-12). */
const UNKNOWN_RETRIES = 3;

export type TransientPlaybackPhase =
  /** Nothing asked yet (or left). */
  | 'IDLE'
  /** The reader asked to play; no audio is heard yet (the set, the file or a resume is prepared). */
  | 'PREPARING'
  | 'PLAYING'
  | 'PAUSED'
  /** Between two runs (a Replay's boundary or TEXT moments): playing, with no file of this set sounding. */
  | 'BETWEEN'
  /** It cannot be played now (CL-05 / RA-12); a later play asks again. */
  | 'FAILED'
  /** The source is no longer readable: stopped, with the PROVEN reason or none (CL-06 / CL-07 / CL-11, RA-09 / RA-10 / RA-17). */
  | 'ENDED';

/** A run as the views see it: its length and its spans, never its file. */
export interface TransientRunShape {
  readonly durationMs: number;
  readonly spans: readonly PresentationSpan[];
}

export interface TransientPlaybackState {
  readonly phase: TransientPlaybackPhase;
  /** CL-04 / RA-11: true only after 1 s of PREPARING. */
  readonly waiting: boolean;
  readonly runIndex: number;
  /** The played position in the run's file (ms), in memory only. */
  readonly positionMs: number;
  /** The set's runs, once known. */
  readonly runs: readonly TransientRunShape[] | null;
  readonly boundaries: readonly PresentationBoundary[];
  /** Only while ENDED: the cause the server proved, or null. */
  readonly endedReason: TransientUnavailableReason;
}

export type TransientPlaybackEvent = 'TRANSIENT_HANDOVER_DEGRADED';

export interface TransientPlaybackOptions {
  /** `call:<callId>` or `replay:<versionId>`. */
  readonly subjectKey: string;
  readonly request: (commandId: string) => Promise<TransientRequestResult>;
  readonly status: (artifactId: string) => Promise<TransientStatusResult>;
  readonly release: (artifactId: string) => Promise<void>;
  readonly audioUrl: (artifactId: string) => string;
  /** The bearer header at this moment, or null when this identity is no longer the reader's. */
  readonly authorization: () => Record<string, string> | null;
  readonly player: VoiceNotePlayerPort;
  readonly owner: PlaybackOwner;
  readonly foreground: ForegroundSignal;
  readonly newCommandId: () => string;
  /** A run's file played to its end. Absent (listening): it rests at its start, paused. */
  readonly onRunEnd?: (runIndex: number) => void;
  readonly onEvent?: (event: TransientPlaybackEvent) => void;
  readonly renewalLeadMs?: number;
  readonly now?: () => number;
  readonly setTimer?: (callback: () => void, ms: number) => unknown;
  readonly clearTimer?: (handle: unknown) => void;
}

/**
 * Where a first play starts, decided once the set's map is known (a Replay names a moment, not a run): the place in the
 * file, or null when the map cannot present it (refused whole: RA-12).
 */
export type TransientPlace = (runs: readonly TransientRunShape[]) => { readonly runIndex: number; readonly positionMs: number } | null;

export interface TransientPlayback {
  getState(): TransientPlaybackState;
  subscribe(listener: () => void): () => void;
  /**
   * Play from (runIndex, positionMs). False when refused (a live call runs): nothing changes and nothing is said. With
   * `place` and no set held yet, the start is placed by the map when the set arrives.
   */
  play(runIndex?: number, positionMs?: number, place?: TransientPlace): boolean;
  pause(): void;
  seek(runIndex: number, positionMs: number): void;
  /** A Replay boundary: the next run's player is created paused, so it starts on time. */
  prepare(runIndex: number): void;
  /** The owner's own deletion: stopped BEFORE the deletion is sent; nothing more is fetched. */
  stop(): void;
  /** Leaving the record or the player: everything is released and the sets are let go (DELETE). */
  leave(): void;
  retire(): void;
}

interface HeldSet {
  readonly runs: TransientSetView['runs'];
  readonly boundaries: TransientSetView['boundaries'];
  deadline: number;
  covers: boolean;
}

interface Live {
  readonly token: number;
  readonly artifactId: string;
  readonly runIndex: number;
  player: VoiceNotePlayer | null;
  loaded: boolean;
  lastPositionMs: number;
  seeking: number;
  /**
   * The player has been told to play. A player that has played is never started again, nor seeked: a resume or a seek
   * creates a new one at the place (CA-07B-2, step 6 on HONOR: after a pause and a resume, or a seek, of the SAME player,
   * its reported place runs two AAC frames (≈ 43 ms) ahead of what is heard, and the next switch loses that much).
   */
  started: boolean;
  /**
   * The reader's place never goes below this for this player: a player that continues the content starts
   * `TRANSIENT_HANDOVER.resumeBehindMs` BEHIND the saved place, and those first milliseconds are heard twice, but the
   * place shown, the Replay clock and the next read never move back (CA-07B-2 §8: no event runs ahead or back).
   */
  floorMs: number;
  /** Called once by the player's first status that is no longer playing (the hand-over waits for it). */
  onStopped?: () => void;
}

const INITIAL: TransientPlaybackState = Object.freeze({
  phase: 'IDLE', waiting: false, runIndex: 0, positionMs: 0, runs: null, boundaries: [], endedReason: null,
});

export function createTransientPlayback(options: TransientPlaybackOptions): TransientPlayback {
  const now = options.now ?? (() => Date.now());
  const setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const lead = Math.min(TRANSIENT_RENEWAL_LEAD_RANGE_MS.max, Math.max(TRANSIENT_RENEWAL_LEAD_RANGE_MS.min, options.renewalLeadMs ?? TRANSIENT_RENEWAL_LEAD_MS));

  let state: TransientPlaybackState = INITIAL;
  const listeners = new Set<() => void>();
  let claim: PlaybackClaim | null = null;
  let intent: 'PLAY' | 'PAUSE' = 'PAUSE';
  /** Bumped by every stop, leave and eviction: an async continuation of an earlier epoch does nothing. */
  let epoch = 0;
  let tokens = 0;
  let held: HeldSet | null = null;
  let next: HeldSet | null = null;
  let current: Live | null = null;
  let renewal: { command: string; retried: boolean; polling: boolean; beforeStart: boolean } | null = null;
  let renewalFailed = false;
  /** The continuation awaited after the file stopped being readable (§20 phone rule 4). */
  let resumeAt: { runIndex: number; positionMs: number } | null = null;
  /** A first play's start, placed by the map when the set arrives (one use). */
  let placeOnArrival: TransientPlace | null = null;
  let resumes: number[] = [];
  let tickTimer: unknown = null;
  let ticks = 0;
  let deadlineTimer: unknown = null;
  let waitingTimer: unknown = null;
  let retired = false;

  const set = (patch: Partial<TransientPlaybackState>) => {
    state = { ...state, ...patch };
    for (const listener of Array.from(listeners)) listener();
  };
  const publishSet = (source: HeldSet) => {
    set({ runs: source.runs.map((run) => ({ durationMs: run.durationMs, spans: run.spans })), boundaries: source.boundaries });
  };
  const after = (ms: number): Promise<void> => new Promise((resolve) => {
    setTimer(resolve, ms);
  });
  const leftOf = (source: HeldSet) => source.deadline - now();
  const toHeld = (source: TransientSetView, at: number): HeldSet => ({
    runs: source.runs, boundaries: source.boundaries, deadline: at + source.readableForMs,
    // An answer to a NEW command with less than L left is a set the server reused because it covers the source (§20 (b)).
    covers: source.readableForMs < lead,
  });
  const idsOf = (source: HeldSet): string[] => source.runs.map((run) => run.artifactId).filter((id): id is string => id !== null);
  const sameSet = (a: HeldSet, b: TransientSetView) => {
    const mine = idsOf(a);
    return mine.length > 0 && b.runs.some((run) => run.artifactId !== null && mine.includes(run.artifactId));
  };
  const letGo = (source: HeldSet | null) => {
    const id = source === null ? undefined : idsOf(source)[0];
    // Releasing one file of a set releases the whole set (server_release_transient_media_v1).
    if (id !== undefined) void options.release(id).catch(() => undefined);
  };

  function readPosition(live: Live): number {
    try {
      const exact = live.player?.currentPositionMs?.();
      if (typeof exact === 'number' && Number.isFinite(exact) && exact >= 0) return Math.max(live.floorMs, Math.round(exact));
    } catch {
      // A player that cannot answer keeps its last reported place.
    }
    return Math.max(live.floorMs, live.lastPositionMs);
  }

  function releasePlayer(player: VoiceNotePlayer | null): void {
    if (player === null) return;
    try {
      player.release();
    } catch {
      // A player that is already gone has nothing left to release.
    }
  }

  function clearWaiting(): void {
    if (waitingTimer !== null) clearTimer(waitingTimer);
    waitingTimer = null;
    if (state.waiting) set({ waiting: false });
  }

  function expectAudio(runIndex: number, positionMs: number): void {
    set({ phase: 'PREPARING', runIndex, positionMs });
    if (waitingTimer !== null || state.waiting) return;
    waitingTimer = setTimer(() => {
      waitingTimer = null;
      if (state.phase === 'PREPARING') set({ waiting: true });
    }, TRANSIENT_WAITING_NOTICE_MS);
  }

  function releaseCurrent(): void {
    if (current === null) return;
    const live = current;
    current = null;
    try {
      live.player?.pause();
    } catch {
      // Released below in any case.
    }
    releasePlayer(live.player);
  }

  function stopTimers(): void {
    if (tickTimer !== null) clearTimer(tickTimer);
    if (deadlineTimer !== null) clearTimer(deadlineTimer);
    tickTimer = null;
    deadlineTimer = null;
    clearWaiting();
  }

  /** Everything this subject holds is let go; the position stays in memory. */
  function dropAll(releaseSets: boolean): void {
    epoch += 1;
    releaseCurrent();
    stopTimers();
    if (releaseSets) {
      letGo(held);
      letGo(next);
    }
    held = null;
    next = null;
    renewal = null;
    renewalFailed = false;
    resumeAt = null;
    placeOnArrival = null;
    intent = 'PAUSE';
  }

  function onEvicted(cause: PlaybackReleaseCause): void {
    claim = null;
    if (retired) return;
    const at = { runIndex: state.runIndex, positionMs: state.positionMs };
    dropAll(true);
    // Another start, or the live call: paused where it was (§7). A Replay or a record left is `leave()`.
    if (state.phase !== 'ENDED' && state.phase !== 'IDLE') set({ phase: 'PAUSED', waiting: false, ...at });
    void cause;
  }

  function ensureClaim(): boolean {
    if (claim !== null && claim.holds()) return true;
    claim = options.owner.claim(options.subjectKey, onEvicted);
    return claim !== null;
  }

  function fail(): void {
    const at = { runIndex: state.runIndex, positionMs: current === null ? state.positionMs : readPosition(current) };
    epoch += 1;
    releaseCurrent();
    stopTimers();
    renewal = null;
    resumeAt = null;
    intent = 'PAUSE';
    set({ phase: 'FAILED', waiting: false, ...at });
  }

  /** §15.2: stopped, released, nothing more fetched; the proven reason or none. */
  function end(reason: TransientUnavailableReason): void {
    const at = { runIndex: state.runIndex, positionMs: current === null ? state.positionMs : readPosition(current) };
    dropAll(false);
    claim?.drop();
    claim = null;
    set({ phase: 'ENDED', waiting: false, endedReason: reason, ...at });
  }

  function armDeadline(): void {
    if (deadlineTimer !== null) clearTimer(deadlineTimer);
    deadlineTimer = null;
    if (held === null) return;
    const source = held;
    deadlineTimer = setTimer(() => {
      deadlineTimer = null;
      if (held !== source || current === null) return;
      // The file stops being readable here: whatever plays on it stops, and the cause is sorted (§20 rule 4). Paused, its
      // player is only let go: the next play finds the file unreadable and sorts the cause then.
      if (intent === 'PLAY') void fileUnreadable(current.runIndex, readPosition(current));
      else {
        current.lastPositionMs = readPosition(current);
        releaseCurrent();
      }
    }, Math.max(0, leftOf(source)));
  }

  function ensureTick(): void {
    if (tickTimer !== null) return;
    const loop = () => {
      tickTimer = null;
      if (retired || intent !== 'PLAY') return;
      ticks += 1;
      tick();
      tickTimer = setTimer(loop, 1_000);
    };
    tickTimer = setTimer(loop, 1_000);
  }

  function tick(): void {
    if (held === null) return;
    if (renewal !== null && !renewal.polling) void renew(false);
    else if (renewal === null && next === null && !held.covers && !renewalFailed && leftOf(held) < lead) void renew(false);
    maybeHandover();
    if (current !== null && current.player !== null && state.phase === 'PLAYING' && ticks % (TRANSIENT_STATUS_EVERY_MS / 1_000) === 0) {
      void checkStatus(current);
    }
  }

  async function checkStatus(live: Live): Promise<void> {
    const my = epoch;
    const answer = await options.status(live.artifactId);
    if (my !== epoch || current !== live || held === null) return;
    if (answer.kind === 'UNKNOWN') return;
    if (answer.kind === 'STATUS' && answer.status.state === 'READY') {
      held.deadline = now() + answer.status.readableForMs;
      armDeadline();
      return;
    }
    await fileUnreadable(live.runIndex, readPosition(live));
  }

  /** The player for (runIndex, positionMs) on the held set; plays when the reader wants it to. */
  /** `behindMs`: a continuation of the content (a switch, a resume) starts this much before the place (never before 0). */
  async function openRun(runIndex: number, positionMs: number, autoplay: boolean, behindMs = 0): Promise<void> {
    const source = held;
    const artifactId = source?.runs[runIndex]?.artifactId ?? null;
    if (source === null || artifactId === null) {
      fail();
      return;
    }
    releaseCurrent();
    const headers = options.authorization();
    if (headers === null) {
      fail();
      return;
    }
    const my = epoch;
    tokens += 1;
    // A start away from 0 counts as seeking from the outset: a status the new player reports before its seek (its place
    // 0) never moves the reader's clock back (CA-07B-2: the place does not move while the switch is silent).
    const from = Math.max(0, positionMs - behindMs);
    const live: Live = { token: tokens, artifactId, runIndex, player: null, loaded: false, lastPositionMs: positionMs, seeking: from > 0 ? 1 : 0, started: false, floorMs: positionMs };
    current = live;
    if (autoplay) expectAudio(runIndex, positionMs);
    else set({ runIndex, positionMs });
    let created: VoiceNotePlayer;
    try {
      created = await options.player.create(options.audioUrl(artifactId), headers, (status) => onCurrentStatus(live, status));
    } catch {
      if (my === epoch && current === live) await rangeResume(live);
      return;
    }
    if (my !== epoch || current !== live) {
      releasePlayer(created);
      return;
    }
    live.player = created;
    if (from > 0) {
      await created.seekTo(from).catch(() => undefined);
      live.seeking -= 1;
    }
    if (my !== epoch || current !== live) return;
    if (autoplay && intent === 'PLAY') {
      live.started = true;
      created.play();
    }
    armDeadline();
    if (intent === 'PLAY') ensureTick();
  }

  function onCurrentStatus(live: Live, status: VoiceNotePlayerStatus): void {
    if (retired || current !== live) return;
    if (status.failed) {
      void rangeResume(live);
      return;
    }
    if (status.loaded) live.loaded = true;
    if (!status.playing && live.onStopped !== undefined) {
      const stopped = live.onStopped;
      live.onStopped = undefined;
      stopped();
    }
    if (status.finished) {
      const length = held?.runs[live.runIndex]?.durationMs ?? 0;
      const at = Math.max(readPosition(live), Math.round(status.positionMs));
      // An answer that ended before the file did is a cut, not the end (§19.2).
      if (length - at > TRANSIENT_EARLY_END_MS) void rangeResume(live);
      else runEnded(live);
      return;
    }
    if (status.loaded && live.seeking === 0) {
      live.lastPositionMs = Math.max(live.floorMs, Math.round(status.positionMs));
      if (state.positionMs !== live.lastPositionMs) set({ positionMs: live.lastPositionMs });
    }
    if (status.loaded && status.playing && intent === 'PLAY') {
      if (waitingTimer !== null || state.waiting) clearWaiting();
      if (state.phase !== 'PLAYING') set({ phase: 'PLAYING' });
      maybeHandover();
    }
  }

  function runEnded(live: Live): void {
    releaseCurrent();
    clearWaiting();
    const runIndex = live.runIndex;
    // The next run simply starts on the new set when one is ready (§20 rule 1).
    if (next !== null) {
      letGo(held);
      held = next;
      next = null;
      armDeadline();
      publishSet(held);
    }
    const length = held?.runs[runIndex]?.durationMs ?? state.positionMs;
    if (options.onRunEnd !== undefined) {
      set({ phase: 'BETWEEN', runIndex, positionMs: length });
      options.onRunEnd(runIndex);
      return;
    }
    // Listening: it rests at its start again, paused.
    intent = 'PAUSE';
    stopTimers();
    set({ phase: 'PAUSED', runIndex: 0, positionMs: 0 });
  }

  /** §19.2: the exact place first, the status second; READY → re-created there, ≤ 3 a minute; otherwise the cause. */
  async function rangeResume(live: Live): Promise<void> {
    const my = epoch;
    const positionMs = readPosition(live);
    const runIndex = live.runIndex;
    releaseCurrent();
    expectAudio(runIndex, positionMs);
    for (;;) {
      const since = now() - TRANSIENT_RESUME.windowMs;
      resumes = resumes.filter((at) => at > since);
      if (resumes.length >= TRANSIENT_RESUME.perMinute) {
        fail();
        return;
      }
      const backoff = TRANSIENT_RESUME.backoffMs[resumes.length] ?? 0;
      resumes.push(now());
      if (backoff > 0) await after(backoff);
      if (my !== epoch) return;
      const answer = await options.status(live.artifactId);
      if (my !== epoch) return;
      if (answer.kind === 'UNKNOWN') continue;
      if (answer.kind === 'STATUS' && answer.status.state === 'READY' && held !== null) {
        held.deadline = now() + answer.status.readableForMs;
        if (intent === 'PLAY') await openRun(runIndex, positionMs, true);
        else set({ phase: 'PAUSED', positionMs });
        return;
      }
      await fileUnreadable(runIndex, positionMs);
      return;
    }
  }

  /** §20 rule 4: a file no longer READY. The new set if it is ready (degraded), else the source authority is asked. */
  async function fileUnreadable(runIndex: number, positionMs: number): Promise<void> {
    releaseCurrent();
    const gone = held;
    if (next !== null) {
      options.onEvent?.('TRANSIENT_HANDOVER_DEGRADED');
      letGo(gone);
      held = next;
      next = null;
      publishSet(held);
      await openRun(runIndex, positionMs, intent === 'PLAY');
      return;
    }
    expectAudio(runIndex, positionMs);
    resumeAt = { runIndex, positionMs };
    // A renewal in flight is the continuation: it is awaited, never doubled.
    if (renewal !== null) {
      if (!renewal.polling) void renew(false);
      return;
    }
    letGo(gone);
    held = null;
    await acquire(true);
  }

  /** Start (or sort the cause): the set under a new command, asked again with the same one while it is prepared. */
  async function acquire(continuation: boolean): Promise<void> {
    const my = epoch;
    let command = options.newCommandId();
    let renewed = false;
    let unknowns = 0;
    for (;;) {
      if (my !== epoch || intent !== 'PLAY') return;
      const result = await options.request(command);
      if (my !== epoch) return;
      if (result.kind === 'UNKNOWN') {
        unknowns += 1;
        if (unknowns > UNKNOWN_RETRIES) {
          fail();
          return;
        }
        await after(TRANSIENT_POLL_MS * 2 ** (unknowns - 1));
        continue;
      }
      if (result.kind === 'NOT_FOUND') {
        end(result.reason);
        return;
      }
      if (result.kind === 'SET' && result.set.state === 'READY') {
        let at = resumeAt ?? { runIndex: state.runIndex, positionMs: state.positionMs };
        resumeAt = null;
        if (continuation) options.onEvent?.('TRANSIENT_HANDOVER_DEGRADED');
        held = toHeld(result.set, now());
        renewalFailed = false;
        publishSet(held);
        const place = placeOnArrival;
        placeOnArrival = null;
        if (place !== null && state.runs !== null) {
          const placed = place(state.runs);
          if (placed === null || held.runs[placed.runIndex] === undefined) {
            fail();
            return;
          }
          at = placed;
          set({ runIndex: placed.runIndex, positionMs: placed.positionMs });
        }
        if (intent === 'PLAY') await openRun(at.runIndex, at.positionMs, true);
        return;
      }
      if (result.kind === 'SET' && (result.set.state === 'PENDING' || result.set.state === 'RUNNING')) {
        if (state.runs === null) publishSet(toHeld(result.set, now()));
        await after(TRANSIENT_POLL_MS);
        continue;
      }
      // A FAILED set or a COMMAND_REUSED refusal: one new command, once (A-1). BUSY, LIVE_CALL_ACTIVE, REFUSED: CL-05.
      if (!renewed && (result.kind === 'COMMAND_REUSED' || result.kind === 'SET')) {
        renewed = true;
        command = options.newCommandId();
        continue;
      }
      fail();
      return;
    }
  }

  /** §20 rule 1: the next generation, under ONE command at a time; never while paused (unless asked to start on it). */
  async function renew(beforeStart: boolean): Promise<void> {
    if (renewal !== null && renewal.polling) return;
    if (renewal === null) renewal = { command: options.newCommandId(), retried: false, polling: false, beforeStart };
    if (beforeStart) renewal.beforeStart = true;
    const mine = renewal;
    mine.polling = true;
    const my = epoch;
    let unknowns = 0;
    for (;;) {
      if (my !== epoch || renewal !== mine) return;
      if (intent !== 'PLAY') {
        mine.polling = false;
        return;
      }
      const result = await options.request(mine.command);
      if (my !== epoch || renewal !== mine) return;
      if (result.kind === 'UNKNOWN') {
        unknowns += 1;
        if (mine.beforeStart && unknowns > UNKNOWN_RETRIES) return renewalGaveUp(mine);
        // A lost answer: the SAME command again (idempotent, §14.2 step 2).
        await after(TRANSIENT_POLL_MS);
        continue;
      }
      if (result.kind === 'NOT_FOUND') {
        end(result.reason);
        return;
      }
      if (result.kind === 'SET' && held !== null && sameSet(held, result.set)) {
        // The file's own set: it covers the source when less than L is left (rule (b)); it plays to E.
        renewal = null;
        held.deadline = now() + result.set.readableForMs;
        held.covers = result.set.readableForMs < lead;
        armDeadline();
        if (mine.beforeStart || resumeAt !== null) await startHeld();
        return;
      }
      if (result.kind === 'SET' && result.set.state === 'READY') {
        renewal = null;
        next = toHeld(result.set, now());
        if (mine.beforeStart || resumeAt !== null || held === null) await startNext(resumeAt !== null && !mine.beforeStart);
        else maybeHandover();
        return;
      }
      if (result.kind === 'SET' && (result.set.state === 'PENDING' || result.set.state === 'RUNNING')) {
        await after(TRANSIENT_POLL_MS);
        continue;
      }
      // A definitive refusal or a FAILED set: one new command, once (A-1); then the renewal has failed.
      if (!mine.retried) {
        mine.retried = true;
        mine.command = options.newCommandId();
        continue;
      }
      return renewalGaveUp(mine);
    }
  }

  function renewalGaveUp(mine: NonNullable<typeof renewal>): void {
    renewal = null;
    renewalFailed = true;
    // Before a start, or after the file ended: CL-05 / RA-12. While the file still plays, it plays on to its deadline.
    if (mine.beforeStart || resumeAt !== null) fail();
  }

  /** The held set again, from the saved place (a renewal before the start found it covers the source). */
  async function startHeld(): Promise<void> {
    const at = resumeAt ?? { runIndex: state.runIndex, positionMs: state.positionMs };
    resumeAt = null;
    if (intent === 'PLAY') await openRun(at.runIndex, at.positionMs, true);
  }

  /** The new set from the saved place: a start after a pause, or the degraded continuation. */
  async function startNext(degraded: boolean): Promise<void> {
    if (next === null) return;
    const at = resumeAt ?? { runIndex: state.runIndex, positionMs: current === null ? state.positionMs : readPosition(current) };
    resumeAt = null;
    if (degraded) options.onEvent?.('TRANSIENT_HANDOVER_DEGRADED');
    releaseCurrent();
    letGo(held);
    held = next;
    next = null;
    renewalFailed = false;
    publishSet(held);
    // The new file continues the content: `resumeBehindMs` behind the saved place (HC-1 (b′): nothing lost).
    if (intent === 'PLAY') await openRun(at.runIndex, at.positionMs, true, TRANSIENT_HANDOVER.resumeBehindMs);
  }

  /** The hand-over is needed only when the file stops being readable before its run ends (§20 rule 1, last bullet). */
  function maybeHandover(): void {
    if (next === null || held === null || current === null || current.player === null || !current.loaded) return;
    if (intent !== 'PLAY' || state.phase !== 'PLAYING' || current.seeking > 0) return;
    const length = held.runs[current.runIndex]?.durationMs ?? 0;
    const remaining = length - readPosition(current);
    if (leftOf(held) > remaining + TRANSIENT_HANDOVER.marginMs) return;
    switchToNext(current);
  }

  /**
   * §20.2 (CA-07B-2): ONE player. The old one is paused FIRST, so the two generations are never heard together, and its
   * place is read from it paused (a playing player's reported place runs ahead of, or behind, what is heard: step 6); the
   * new file starts `resumeBehindMs` behind it, the reader's place held. Then the old player is released
   * and its file let go.
   */
  function switchToNext(live: Live): void {
    if (next === null || current !== live || live.onStopped !== undefined) return;
    const my = epoch;
    let done = false;
    const timer = setTimer(() => finish(), TRANSIENT_HANDOVER.stopWaitMs);
    // The place is read once the player has stopped: while it plays, its reported place trails what has already been
    // sent to the output (step 6, HONOR: 17 – 60 ms), and reading it then would repeat that much.
    function finish(): void {
      if (done) return;
      done = true;
      clearTimer(timer);
      live.onStopped = undefined;
      if (my !== epoch || current !== live || next === null || intent !== 'PLAY') return;
      resumeAt = { runIndex: live.runIndex, positionMs: readPosition(live) };
      void startNext(false);
    }
    live.onStopped = finish;
    try {
      live.player?.pause();
    } catch {
      finish();
    }
  }

  const unsubscribeForeground = options.foreground.subscribe(() => {
    if (options.foreground.current() !== 'ACTIVE') api.pause();
  });

  const api: TransientPlayback = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play(runIndex = state.runIndex, positionMs = state.positionMs, place) {
      if (retired || state.phase === 'ENDED' || options.foreground.current() !== 'ACTIVE') return false;
      if (!options.owner.transientAllowed() || !ensureClaim()) return false;
      intent = 'PLAY';
      ensureTick();
      placeOnArrival = held === null ? place ?? null : null;
      if (held === null) {
        resumeAt = place === undefined ? { runIndex, positionMs } : null;
        expectAudio(runIndex, positionMs);
        void acquire(false);
        return true;
      }
      if (next !== null) {
        // A pause during a hand-over: the new file starts directly at the saved place (§20 rule 2.4).
        resumeAt = { runIndex, positionMs };
        expectAudio(runIndex, positionMs);
        void startNext(false);
        return true;
      }
      if (leftOf(held) <= 0) {
        resumeAt = { runIndex, positionMs };
        expectAudio(runIndex, positionMs);
        void fileUnreadable(runIndex, positionMs);
        return true;
      }
      if (!held.covers && leftOf(held) < lead) {
        // Below L at play or resume: renewed BEFORE starting (§20 rule 1).
        releaseCurrent();
        resumeAt = { runIndex, positionMs };
        expectAudio(runIndex, positionMs);
        void renew(true);
        return true;
      }
      if (current !== null && current.player !== null && current.runIndex === runIndex && !current.started) {
        // A player prepared at a Replay boundary that has not played yet starts in place; any other start is a new player.
        if (Math.abs(readPosition(current) - positionMs) > 1) void current.player.seekTo(positionMs).catch(() => undefined);
        current.started = true;
        current.player.play();
        set({ phase: 'PLAYING', runIndex, positionMs });
        armDeadline();
        return true;
      }
      // A resume of the paused player's run at its own place continues the content: `resumeBehindMs` behind, like a switch.
      // Any other start (the first, a seek, a moment's start) is exactly where it was asked.
      const resuming = current !== null && current.started && current.runIndex === runIndex && positionMs === state.positionMs;
      void openRun(runIndex, positionMs, true, resuming ? TRANSIENT_HANDOVER.resumeBehindMs : 0);
      return true;
    },
    pause() {
      if (intent !== 'PLAY' && state.phase !== 'PREPARING' && state.phase !== 'BETWEEN') return;
      intent = 'PAUSE';
      let positionMs = state.positionMs;
      if (current !== null) {
        positionMs = readPosition(current);
        current.lastPositionMs = positionMs;
        try {
          current.player?.pause();
        } catch {
          // A player that is gone is paused.
        }
      }
      if (tickTimer !== null) clearTimer(tickTimer);
      tickTimer = null;
      clearWaiting();
      set({ phase: 'PAUSED', positionMs });
    },
    seek(runIndex, positionMs) {
      if (retired || state.phase === 'ENDED') return;
      const to = Math.max(0, Math.round(positionMs));
      if (current !== null && current.player !== null && current.runIndex === runIndex && !current.started) {
        const live = current;
        live.lastPositionMs = to;
        live.seeking += 1;
        void live.player!.seekTo(to).catch(() => undefined).finally(() => {
          live.seeking -= 1;
        });
        set({ runIndex, positionMs: to });
        return;
      }
      releaseCurrent();
      set({ runIndex, positionMs: to, ...(state.phase === 'BETWEEN' ? { phase: intent === 'PLAY' ? 'PREPARING' : 'PAUSED' } : {}) });
      if (intent === 'PLAY') api.play(runIndex, to);
    },
    prepare(runIndex) {
      if (retired || held === null || leftOf(held) <= 0 || intent !== 'PLAY') return;
      if (current !== null && current.runIndex === runIndex) return;
      void openRun(runIndex, 0, false).then(() => {
        if (current !== null && current.runIndex === runIndex && state.phase !== 'ENDED') set({ phase: 'BETWEEN' });
      });
    },
    stop() {
      if (retired) return;
      const at = { runIndex: state.runIndex, positionMs: current === null ? state.positionMs : readPosition(current) };
      dropAll(false);
      claim?.drop();
      claim = null;
      set({ phase: 'ENDED', waiting: false, endedReason: null, ...at });
    },
    leave() {
      if (retired) return;
      dropAll(true);
      claim?.drop();
      claim = null;
      set(INITIAL);
    },
    retire() {
      if (retired) return;
      dropAll(true);
      claim?.drop();
      claim = null;
      retired = true;
      unsubscribeForeground();
      listeners.clear();
    },
  };
  return api;
}
