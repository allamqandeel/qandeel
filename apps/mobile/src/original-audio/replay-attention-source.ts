/**
 * INTEL-LIVE-01 CP3 (D-CP3, the Product Owner's approval of 2026-11-26) — the ONE place the phone fetches a version's
 * attention answer (0205's GET, through the same AC-01 authorized client the playback uses) and decides whether the
 * Replay's Lane B may use it. The availability source's own shape (`replay-availability-source.ts`), for a second lane:
 *
 *   PENDING      not asked yet, or the answer has not arrived           → Lane B is empty
 *   BOUND        a decoded answer bound to the held map and version      → Lane B reduces it
 *   REFUSED      malformed, or bound to something else (revised, another map, other source windows) → empty
 *   NOT_FOUND    the version is not this person's CURRENT one            → empty
 *   UNAVAILABLE  BUSY, offline, any other answer                        → empty; nothing older stands in for it
 *
 * Lane B is separate from Lane A: no state of this source ever changes what Lane A discloses or when. One request per
 * opening, for the first map held; an answer that arrives after the source was retired, or for a map other than the one
 * now held, is dropped unread. Held in memory; nothing is stored, logged or reported.
 */
import type { ReplayAudioPlan } from './replay-audio-clock';
import {
  bindReplayAttention, decodeReplayAttention, type ReplayAttention, type ReplayAttentionBindingRefusal,
} from './replay-attention';
import { presentationMapDigest } from './replay-availability';
import type { TransientAvailabilityResult } from './transient-media-api';

export type ReplayAttentionSourceState =
  | { readonly kind: 'PENDING' }
  | { readonly kind: 'BOUND'; readonly answer: ReplayAttention; readonly mapDigest: string }
  | { readonly kind: 'REFUSED'; readonly reason: 'MALFORMED' | 'MAP_UNREADABLE' | ReplayAttentionBindingRefusal }
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'UNAVAILABLE' };

export interface ReplayAttentionSource {
  getState(): ReplayAttentionSourceState;
  /** Called with the plan the clock holds now (null before it holds one); asks once, for the first plan held. */
  observe(plan: ReplayAudioPlan | null): void;
  subscribe(listener: () => void): () => void;
  revision(): number;
  retire(): void;
}

/**
 * What a stage clock that carries Lane B also answers (`replay-audio.ts`). A port of its own, beside the stage clock
 * (`replay-cosmos/presentation-clock.ts`), which is Lane A's and is not edited (CP0 v1.0 §8.5): a clock without it has
 * an empty Lane B.
 */
export interface ReplayAttentionPort {
  attention(): ReplayAttentionSourceState;
}

export interface ReplayAttentionSourceOptions {
  readonly replayId: string;
  readonly versionId: string;
  /** The revision of the version the player holds (the history wire's). */
  readonly revision: number;
  readonly fetch: () => Promise<TransientAvailabilityResult>;
  /** The source windows pinned for this version in this session (null: none yet), and where a new pin is kept. */
  readonly pinned: () => string | null;
  readonly pin: (sourceWindowBindingDigest: string) => void;
}

const PENDING: ReplayAttentionSourceState = Object.freeze({ kind: 'PENDING' as const });

export function createReplayAttentionSource(options: ReplayAttentionSourceOptions): ReplayAttentionSource {
  let state: ReplayAttentionSourceState = PENDING;
  let revision = 0;
  let retired = false;
  let askedFor: ReplayAudioPlan | null = null;
  let held: ReplayAudioPlan | null = null;
  const listeners = new Set<() => void>();
  const set = (next: ReplayAttentionSourceState) => {
    state = next;
    revision += 1;
    for (const listener of Array.from(listeners)) listener();
  };

  function settle(plan: ReplayAudioPlan, result: TransientAvailabilityResult): void {
    if (retired || held !== plan) return;
    if (result.kind === 'NOT_FOUND') return set({ kind: 'NOT_FOUND' });
    if (result.kind !== 'ANSWER') return set({ kind: 'UNAVAILABLE' });
    const mapDigest = presentationMapDigest(plan.runs, plan.boundaries);
    if (mapDigest === null) return set({ kind: 'REFUSED', reason: 'MAP_UNREADABLE' });
    const answer = decodeReplayAttention(result.body, { replayId: options.replayId, versionId: options.versionId, runs: plan.runs });
    if (answer === null) return set({ kind: 'REFUSED', reason: 'MALFORMED' });
    const bound = bindReplayAttention(answer, { revision: options.revision, mapDigest, sourceWindowBindingDigest: options.pinned() });
    if (!bound.ok) return set({ kind: 'REFUSED', reason: bound.reason });
    options.pin(answer.binding.sourceWindowBindingDigest!);
    set({ kind: 'BOUND', answer, mapDigest });
  }

  return {
    getState: () => state,
    observe(plan) {
      if (retired) return;
      if (plan !== held) {
        held = plan;
        if (state !== PENDING && askedFor !== plan) set(PENDING);
      }
      if (plan === null || askedFor !== null) return;
      askedFor = plan;
      // Called from the audio clock's own listener: a failure here is Lane B's alone and never reaches the clock, the
      // audio or Lane A.
      let asked: Promise<TransientAvailabilityResult>;
      try {
        asked = options.fetch();
      } catch {
        asked = Promise.resolve({ kind: 'UNAVAILABLE' });
      }
      void asked.then(
        (result) => settle(plan, result),
        () => settle(plan, { kind: 'UNAVAILABLE' }),
      );
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    revision: () => revision,
    retire() {
      retired = true;
      listeners.clear();
    },
  };
}
