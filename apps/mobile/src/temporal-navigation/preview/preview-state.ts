/**
 * T-06 — the ephemeral temporal preview: `PREVIEW_TEMPORAL_TARGET`, `CANCEL_PREVIEW` and the
 * progress of `RELATIVE_FORWARD_CONTINUATION`.
 *
 * `PTC` is Class C. It is NOT canonical state, it has no key in `CanonicalState`, it is never
 * persisted, it never appends `RH`, and it is not a second temporal cursor: while a preview exists,
 * `TM` is unchanged, effective committed `TC` is unchanged, committed Map entitlement is still
 * based on committed `TC`, and committed inspection is untouched. A preview is a temporary
 * PRESENTATION of a legitimate historical target and nothing more.
 *
 * This controller therefore has no store, no dispatch, no transport, no persistence and no
 * canonical writer of any kind. It cannot mutate Product truth even by mistake, because it holds
 * nothing that could. Every judgement it makes about what may be previewed is delegated to the one
 * addressability gate, over `TemporalBounds` supplied by the caller — so it cannot drift from the
 * canonical rule, and it cannot read canonical state behind the caller's back either.
 *
 * A preview is deliberately NOT implemented by moving `TM` and moving it back. That would create
 * two false Product transitions, two RH checkpoints and a moment in which committed truth said
 * something that never happened.
 *
 * `generation` is the interruption guard. It increases on every change of preview intent —
 * including cancellation — so any work started for one preview target (a projection resolution, a
 * settle animation, a scheduled announcement) can ask `isCurrent(generation)` and discover that it
 * is answering a question nobody is asking any more. Nothing in this file is keyed to an animation,
 * a frame, a gesture phase or a duration.
 */
import type { SessionPosition } from '../../state';
import type { TemporalRejectionCode } from '../outcome';
import { nextForwardTarget, resolveTemporalTarget, type TemporalBounds } from '../targeting/addressability';

/** Which legitimate route established this preview. Classification only; it grants nothing. */
export type PreviewSource = 'DISCLOSED_TARGET' | 'RELATIVE_FORWARD' | 'EXACT_ENTRY';

/**
 * The committed viewpoint at the moment the preview began. It is EVIDENCE ONLY: nothing restores
 * from it and nothing writes it back. It exists so that a cancellation can be checked to have
 * changed no committed truth, and so a stale preview from a replaced Session is recognisable.
 *
 * Presentation restoration reads the CURRENT committed bounds instead, because under `FOLLOW_LIVE`
 * committed truth legitimately advances with `LH` while a preview is open.
 */
export interface CommittedTemporalOrigin {
  readonly sessionId: string;
  readonly mode: 'FOLLOW_LIVE' | 'PINNED';
  readonly tc: SessionPosition;
}

export interface ActiveTemporalPreview {
  readonly status: 'PREVIEWING';
  /** `PTC`: the previewed Session Position. Never a commitment, never a mode. */
  readonly ptc: SessionPosition;
  readonly source: PreviewSource;
  readonly origin: CommittedTemporalOrigin;
  readonly generation: number;
}

export type TemporalPreview = { readonly status: 'IDLE' } | ActiveTemporalPreview;

export const IDLE_PREVIEW: TemporalPreview = Object.freeze({ status: 'IDLE' });

export type PreviewResult =
  | { readonly outcome: 'PREVIEWING'; readonly preview: ActiveTemporalPreview }
  /** Ephemeral preview intent was discarded. No canonical field moved and no RH entry exists. */
  | { readonly outcome: 'CLEARED' }
  /** Nothing to do: the same target was asked for again, or there was nothing to cancel. */
  | { readonly outcome: 'UNCHANGED' }
  | { readonly outcome: 'REJECTED'; readonly code: TemporalRejectionCode; readonly detail: string };

export interface TemporalPreviewController {
  getSnapshot(): TemporalPreview;
  subscribe(listener: () => void): () => void;
  /** `PREVIEW_TEMPORAL_TARGET`: express an ephemeral temporal target. Never a commit. */
  preview(bounds: TemporalBounds, candidate: unknown, source: PreviewSource): PreviewResult;
  /** `RELATIVE_FORWARD_CONTINUATION`: one step forward over addressable targets, bounded by `LH`. */
  stepForward(bounds: TemporalBounds): PreviewResult;
  /** `CANCEL_PREVIEW`: discard ephemeral intent. Lossless, non-transactional, always safe. */
  cancel(): PreviewResult;
  /** Drops a preview that belongs to a replaced Session. Invents no navigation of any kind. */
  reconcile(bounds: TemporalBounds): PreviewResult;
  /** The interruption guard: is this generation still the live preview intent? */
  isCurrent(generation: number): boolean;
}

export function createTemporalPreviewController(): TemporalPreviewController {
  const listeners = new Set<() => void>();
  let state: TemporalPreview = IDLE_PREVIEW;
  // Monotonic across the whole life of the controller, including cancellations, so a generation
  // can never be reused and late work can never be mistaken for current work.
  let generation = 0;

  function publish(next: TemporalPreview): void {
    state = next;
    for (const listener of Array.from(listeners)) listener();
  }

  function begin(bounds: TemporalBounds, sp: SessionPosition, source: PreviewSource): PreviewResult {
    const committedTc = bounds.committedTc;
    if (committedTc === null) {
      return { outcome: 'REJECTED', code: 'NO_ADDRESSABLE_POSITION', detail: 'no committed temporal position exists to preview away from' };
    }
    const origin: CommittedTemporalOrigin =
      state.status === 'PREVIEWING' ? state.origin : Object.freeze({ sessionId: bounds.sessionId, mode: bounds.mode, tc: committedTc });
    generation += 1;
    const preview: ActiveTemporalPreview = Object.freeze({ status: 'PREVIEWING', ptc: sp, source, origin, generation });
    publish(preview);
    return { outcome: 'PREVIEWING', preview };
  }

  function preview(bounds: TemporalBounds, candidate: unknown, source: PreviewSource): PreviewResult {
    const resolved = resolveTemporalTarget(bounds, candidate);
    if (!resolved.ok) return { outcome: 'REJECTED', code: resolved.code, detail: resolved.detail };
    // Re-asking for the target already previewed is not a new intent: it publishes nothing, bumps
    // no generation and invalidates no in-flight work. A scrub that stays inside one disclosed step
    // therefore costs nothing at all.
    if (state.status === 'PREVIEWING' && state.ptc === resolved.sp && state.origin.sessionId === bounds.sessionId) {
      return { outcome: 'UNCHANGED' };
    }
    if (state.status === 'PREVIEWING' && state.origin.sessionId !== bounds.sessionId) cancel();
    return begin(bounds, resolved.sp, source);
  }

  function stepForward(bounds: TemporalBounds): PreviewResult {
    const from = state.status === 'PREVIEWING' ? state.ptc : bounds.committedTc;
    const step = nextForwardTarget(bounds, from);
    switch (step.outcome) {
      case 'REJECTED':
        return { outcome: 'REJECTED', code: step.code, detail: step.detail };
      case 'AT_LIVE_HEAD':
        // The continuation holds at the Live Head. It does not wrap, does not widen the horizon and
        // — above all — does not become Live intent: only an explicit Live act produces FOLLOW_LIVE.
        return { outcome: 'UNCHANGED' };
      case 'STEP':
        return begin(bounds, step.sp, 'RELATIVE_FORWARD');
      default: {
        const exhaustive: never = step;
        return exhaustive;
      }
    }
  }

  function cancel(): PreviewResult {
    if (state.status === 'IDLE') return { outcome: 'UNCHANGED' };
    generation += 1;
    publish(IDLE_PREVIEW);
    return { outcome: 'CLEARED' };
  }

  function reconcile(bounds: TemporalBounds): PreviewResult {
    if (state.status === 'IDLE') return { outcome: 'UNCHANGED' };
    // A replaced Session takes its preview with it. Nothing is carried across, nothing is
    // re-targeted into the new Session, and no Product navigation is invented in its place.
    if (state.origin.sessionId !== bounds.sessionId) return cancel();
    // `LH` is monotonic, so a target legitimate when it was previewed stays legitimate; anything
    // else is a defect, and the preview is discarded rather than clamped to a different Moment.
    return resolveTemporalTarget(bounds, state.ptc).ok ? { outcome: 'UNCHANGED' } : cancel();
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    preview,
    stepForward,
    cancel,
    reconcile,
    isCurrent: (candidate: number) => state.status === 'PREVIEWING' && state.generation === candidate,
  };
}
