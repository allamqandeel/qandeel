/**
 * S8B-07 CP1-B (Sheet B, B2A) — the player's clock-source port: the one way a version's moments may be timed by
 * something other than the declared reading pace. The player knows nothing of what the source is; it hands a moment to
 * the clock and follows the moment the clock reports, and keeps its own reading pace for every moment the clock does not
 * own (B2X). With no clock, or for a version the clock does not take, the player is exactly the S7-04 player.
 *
 * The time authority of each element (B2A, D-05.5, D-05.6):
 *
 *   the Spine and the position   the moment order; they change only at the start of a timed span or of a paced moment
 *   the moment shown             the clock's own report while it runs (the latest-started span, never inside one)
 *   a paced moment               the declared reading pace, unchanged
 *   pause                        freezes the clock and the reading timer together
 */
import type { ReplayHistoryMoment, ReplayHistoryVersion } from '../runtime-entry';

export type ReplayMomentClockPhase =
  /** Nothing asked of it, or let go. */
  | 'IDLE'
  /** Asked to run; nothing is presented yet. */
  | 'PREPARING'
  | 'RUNNING'
  /** Held by the reader, or by something that outranks it: the player stops playing. */
  | 'HELD'
  /** The span it was asked to run has finished; `through` names the last moment it covered. */
  | 'DONE'
  /** It can never run again for this version: the player stops, and nothing else is played in its place. */
  | 'ENDED'
  /** It cannot run now; a later play asks again. */
  | 'FAILED';

export interface ReplayMomentClockState {
  readonly phase: ReplayMomentClockPhase;
  /** The moment it presents now, or null when it presents none (preparing, between two spans). */
  readonly ordinal: number | null;
  /** Only while DONE: the last moment the finished span covered. */
  readonly through: number | null;
}

export interface ReplayMomentClock {
  getState(): ReplayMomentClockState;
  subscribe(listener: () => void): () => void;
  /** This moment's time is the clock's, not the reading pace's. */
  owns(ordinal: number): boolean;
  /**
   * Present this moment: from the start of its span (`START`, a Spine commit or a step), or as the next one in order
   * (`ADVANCE`), when the clock keeps whatever pause comes before it. False when refused: nothing changes.
   */
  run(ordinal: number, entry: 'START' | 'ADVANCE'): boolean;
  /** The reader paused, or a paced moment is shown: it stops presenting and keeps its place. */
  hold(): void;
  /** Continue from where it was held. False when refused. */
  resume(): boolean;
  /** Let go of everything it holds for this version (closing, another version, a command). */
  release(): void;
  retire(): void;
}

/** Makes the clock of one version, or null when the version is not one the clock times (every V1 version). */
export type ReplayMomentClockSource = (version: ReplayHistoryVersion, moments: readonly ReplayHistoryMoment[]) => ReplayMomentClock | null;
