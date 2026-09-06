/**
 * T-06 — the Product logic of a temporal scrub, as plain functions.
 *
 * A scrub is a completed, explicit user act with an unambiguous boundary, exactly like the Map's
 * drag: while a finger is down NOTHING canonical happens — the target is ephemeral preview intent
 * and nothing else — and when the gesture ENDS successfully, exactly one canonical commit is
 * dispatched through the established commit boundary. A gesture that is cancelled, interrupted,
 * fails, or is taken over by another recognizer lands in the cancellation path and dispatches
 * nothing at all: no partial commit, no half transaction, no RH entry.
 *
 * Nothing here is reachable from an animation. The acknowledgement hooks are called with the store's
 * answer already in hand, they return nothing, and no Product act waits for one.
 *
 * These are ordinary functions on purpose. Everything with Product meaning is testable without a
 * gesture, a renderer, a worklet or a frame; the hook that wires them to the UI runtime adds no
 * decisions of its own.
 */
import type { CanonicalStore } from '../../state';
import { commitPreviewedTarget } from '../targeting/commit';
import { temporalBounds } from '../targeting/addressability';
import type { PreviewResult, TemporalPreviewController } from '../preview/preview-state';
import type { TemporalOutcome } from '../outcome';
import type { PresentationSnapshot } from '../../timeline';
import { temporalTargetFromDisclosed } from './disclosed-bridge';

export interface ScrubDependencies {
  readonly store: CanonicalStore;
  readonly preview: TemporalPreviewController;
  /** Read fresh on every call: the presentation may have moved, and the mirror may have advanced. */
  readonly snapshot: () => PresentationSnapshot;
  /** Presentation acknowledgement, called only AFTER the store has answered. Optional by design. */
  readonly onCommitted?: () => void;
  readonly onCancelled?: () => void;
  readonly onOutcome?: (outcome: TemporalOutcome) => void;
  readonly onPreview?: (result: PreviewResult) => void;
}

export interface ScrubHandlers {
  /**
   * The finger crossed into disclosed step `index`. Previews it, or refuses. Never commits, never
   * writes canonical state, and never touches the presentation window.
   */
  readonly targetIndex: (index: number) => PreviewResult;
  /**
   * The gesture finished. `committed` is true only for a successful end; every other ending —
   * cancellation, failure, interruption, a competing recognizer winning — arrives here as false.
   */
  readonly settle: (committed: boolean) => void;
}

export function createScrubHandlers(deps: ScrubDependencies): ScrubHandlers {
  function targetIndex(index: number): PreviewResult {
    const snapshot = deps.snapshot();
    const track = snapshot.track;
    // The Track is T-05's own complete disclosed prefix, so the index is looked up rather than
    // arithmetic: an index outside it is simply not a disclosed target and produces no intent.
    const target = Number.isInteger(index) && index >= 0 ? track.targets[index] : undefined;
    if (target === undefined) {
      const result: PreviewResult = { outcome: 'REJECTED', code: 'NOT_ADDRESSABLE', detail: 'no disclosed Moment target at this presentation position' };
      deps.onPreview?.(result);
      return result;
    }
    const bounds = temporalBounds(deps.store.getState());
    const resolved = temporalTargetFromDisclosed(bounds, track, target);
    if (!resolved.ok) {
      const result: PreviewResult = { outcome: 'REJECTED', code: resolved.code, detail: resolved.detail };
      deps.onPreview?.(result);
      return result;
    }
    const result = deps.preview.preview(bounds, resolved.sp, 'DISCLOSED_TARGET');
    deps.onPreview?.(result);
    return result;
  }

  function settle(committed: boolean): void {
    if (!committed) {
      // Cancellation, interruption and failure are one path and it is the safe one: the ephemeral
      // target is discarded, canonical state is not touched, and RH gains nothing.
      deps.preview.cancel();
      deps.onCancelled?.();
      return;
    }
    // The outcome is computed FIRST and the observers are notified afterwards. An optional call
    // would not evaluate its argument when no observer is attached, which would silently make the
    // whole pointer route a no-op.
    const outcome = commitPreviewedTarget(deps.store, deps.preview);
    deps.onOutcome?.(outcome);
    if (outcome.outcome === 'APPLIED') deps.onCommitted?.();
    else deps.onCancelled?.();
  }

  return { targetIndex, settle };
}
