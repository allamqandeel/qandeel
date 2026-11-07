/**
 * S8B-07 CP1-B (contract §7) — the phone's ONE playback slot, keyed by subject: `note:<recordingId>` (a Voice Note, the
 * S8B-03 owner), `call:<callId>` (listening to a call's recording) and `replay:<versionId>` (a Replay's original audio).
 * Starting any of them releases the one that holds the slot, so one subject plays at a time.
 *
 *   - The muted standby of a hand-over (§20) is not a second claim: it belongs to the subject that holds the slot, and
 *     that subject's engine releases it with everything else it holds.
 *   - The live call outranks all of them (`CallAudioEngine` owns the audio session): while a call is live, a `call:` or
 *     `replay:` claim is refused, and a call that begins releases the `call:` / `replay:` holder at once (V-21, V-34).
 *     A Voice Note's behaviour is the S8B-03 one, unchanged.
 *
 * Nothing here plays, reads or logs anything; it only decides who may hold a player.
 */
export type PlaybackReleaseCause = 'OTHER_START' | 'LIVE_CALL' | 'RETIRED';

export interface PlaybackClaim {
  readonly key: string;
  /** Whether this claim still holds the slot. */
  holds(): boolean;
  /** The holder lets the slot go itself (its `release` callback is not called). */
  drop(): void;
}

/** Whether a live call is running now, and when that changes (bound to the S8B-06 call owner's stage). */
export interface LiveCallSignal {
  isLive(): boolean;
  subscribe(listener: () => void): () => void;
}

export interface PlaybackOwner {
  /**
   * The slot for `key`, after releasing whoever holds it (its `release` runs first, with OTHER_START). Null, with nothing
   * released, for a `call:` or `replay:` subject while a live call runs.
   */
  claim(key: string, release: (cause: PlaybackReleaseCause) => void): PlaybackClaim | null;
  /** Whether a call or Replay may start now (the controls are refused while a call is live). */
  transientAllowed(): boolean;
  /** Called when the live call's state changes, after the owner has acted on it. */
  subscribe(listener: () => void): () => void;
  retire(): void;
}

const TRANSIENT = /^(call|replay):/u;

export function createPlaybackOwner(liveCall: LiveCallSignal | null): PlaybackOwner {
  let holder: { key: string; release: (cause: PlaybackReleaseCause) => void; token: number } | null = null;
  let tokens = 0;
  let retired = false;
  const listeners = new Set<() => void>();

  const evict = (cause: PlaybackReleaseCause) => {
    const evicted = holder;
    holder = null;
    if (evicted === null) return;
    try {
      evicted.release(cause);
    } catch {
      // A holder that fails to let go has still lost the slot.
    }
  };

  const unsubscribe = liveCall?.subscribe(() => {
    if (retired) return;
    if (liveCall.isLive() && holder !== null && TRANSIENT.test(holder.key)) evict('LIVE_CALL');
    for (const listener of Array.from(listeners)) listener();
  });

  return {
    claim(key, release) {
      if (retired || (TRANSIENT.test(key) && liveCall?.isLive() === true)) return null;
      evict('OTHER_START');
      tokens += 1;
      const token = tokens;
      holder = { key, release, token };
      return {
        key,
        holds: () => holder !== null && holder.token === token,
        drop: () => {
          if (holder !== null && holder.token === token) holder = null;
        },
      };
    },
    transientAllowed: () => !retired && liveCall?.isLive() !== true,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    retire() {
      retired = true;
      unsubscribe?.();
      evict('RETIRED');
      listeners.clear();
    },
  };
}
