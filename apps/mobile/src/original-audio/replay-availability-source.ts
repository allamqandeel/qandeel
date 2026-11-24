/**
 * RB-2 / S4 (the Product Owner's S4 execution directive, 2026-11-24) — the ONE place the phone fetches a version's
 * historical-availability answer (S3's GET, through the same AC-01 authorized client the playback uses: the bearer in a
 * header, never in a URL) and decides whether the Replay may use it.
 *
 * One source per audio clock (one opening of a V2 version). It asks once, when the clock first holds its map, and only
 * for that map: the answer is decoded strictly (`decodeReplayAvailability`) and then bound to what the player holds
 * (`bindReplayAvailability`: the version's revision, the map's digest by the server's serialization, the moments, the
 * source windows and watermark pinned across answers of this session). The state is one of:
 *
 *   PENDING      not asked yet, or the answer has not arrived           → the stage is neutral (U-N)
 *   BOUND        a decoded answer bound to the held map and version      → the CERTIFIED timeline
 *   REFUSED      malformed, or bound to something else (stale, revised, another map or ledger)   → neutral
 *   NOT_FOUND    the version is not this person's CURRENT one (revoked, deleted, retired, replaced) → neutral
 *   UNAVAILABLE  BUSY, offline, any other answer                        → neutral; nothing older stands in for it
 *
 * An answer that arrives after the source was retired, or for a map other than the one now held, is dropped unread. It
 * never retries on its own (one request per opening; asking again is the next opening's — a PO decision if more is
 * wanted). Held in memory; nothing is stored, logged or reported.
 */
import type { ReplayAudioPlan } from './replay-audio-clock';
import {
  bindReplayAvailability, decodeReplayAvailability, presentationMapDigest,
  type ReplayAvailability, type ReplayAvailabilityBinding, type ReplayAvailabilityBindingRefusal,
} from './replay-availability';
import type { TransientAvailabilityResult } from './transient-media-api';

export type ReplayAvailabilitySourceState =
  | { readonly kind: 'PENDING' }
  | { readonly kind: 'BOUND'; readonly answer: ReplayAvailability }
  | { readonly kind: 'REFUSED'; readonly reason: 'MALFORMED' | 'MAP_UNREADABLE' | ReplayAvailabilityBindingRefusal }
  | { readonly kind: 'NOT_FOUND' }
  | { readonly kind: 'UNAVAILABLE' };

export interface ReplayAvailabilitySource {
  getState(): ReplayAvailabilitySourceState;
  /** Called with the plan the clock holds now (null before it holds one); asks once, for the first plan held. */
  observe(plan: ReplayAudioPlan | null): void;
  subscribe(listener: () => void): () => void;
  revision(): number;
  retire(): void;
}

export interface ReplayAvailabilitySourceOptions {
  readonly replayId: string;
  readonly versionId: string;
  /** The revision of the version the player holds (the history wire's). */
  readonly revision: number;
  /** Every ordinal of the version. */
  readonly ordinals: readonly number[];
  readonly fetch: () => Promise<TransientAvailabilityResult>;
  /** The binding of the last answer bound for this version in this session (null: none), and where a new one is kept. */
  readonly pinned: () => ReplayAvailabilityBinding | null;
  readonly pin: (binding: ReplayAvailabilityBinding) => void;
}

const PENDING: ReplayAvailabilitySourceState = Object.freeze({ kind: 'PENDING' as const });

export function createReplayAvailabilitySource(options: ReplayAvailabilitySourceOptions): ReplayAvailabilitySource {
  let state: ReplayAvailabilitySourceState = PENDING;
  let revision = 0;
  let retired = false;
  /** The plan the one request was made for: an answer is used only while that plan is the one held. */
  let askedFor: ReplayAudioPlan | null = null;
  let held: ReplayAudioPlan | null = null;
  const listeners = new Set<() => void>();
  const set = (next: ReplayAvailabilitySourceState) => {
    state = next;
    revision += 1;
    for (const listener of Array.from(listeners)) listener();
  };

  function settle(plan: ReplayAudioPlan, result: TransientAvailabilityResult): void {
    // Stale: retired, or the held plan is no longer the one asked for.
    if (retired || held !== plan) return;
    if (result.kind === 'NOT_FOUND') return set({ kind: 'NOT_FOUND' });
    if (result.kind !== 'ANSWER') return set({ kind: 'UNAVAILABLE' });
    const mapDigest = presentationMapDigest(plan.runs, plan.boundaries);
    if (mapDigest === null) return set({ kind: 'REFUSED', reason: 'MAP_UNREADABLE' });
    const answer = decodeReplayAvailability(result.body, { replayId: options.replayId, versionId: options.versionId, runs: plan.runs });
    if (answer === null) return set({ kind: 'REFUSED', reason: 'MALFORMED' });
    const bound = bindReplayAvailability(answer, { revision: options.revision, mapDigest, ordinals: options.ordinals, previous: options.pinned() });
    if (!bound.ok) return set({ kind: 'REFUSED', reason: bound.reason });
    options.pin(answer.binding);
    set({ kind: 'BOUND', answer });
  }

  return {
    getState: () => state,
    observe(plan) {
      if (retired) return;
      if (plan !== held) {
        held = plan;
        // Another map than the one an answer was bound to: nothing of that answer stands.
        if (state !== PENDING && askedFor !== plan) set(PENDING);
      }
      if (plan === null || askedFor !== null) return;
      askedFor = plan;
      // Called from the audio clock's own listener: a failure here is the availability's alone (UNAVAILABLE, neutral
      // stage) and never reaches the clock or the audio.
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
