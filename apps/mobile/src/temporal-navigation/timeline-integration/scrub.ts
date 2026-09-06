/**
 * T-06 — the Product logic of a temporal scrub, as plain functions, plus the interaction ownership
 * that makes it safe against reordered cross-runtime callbacks (R1-02).
 *
 * A scrub is a completed, explicit user act with an unambiguous boundary, exactly like the Map's
 * drag: while a finger is down NOTHING canonical happens — the target is ephemeral preview intent
 * and nothing else — and when the gesture ENDS successfully, exactly one canonical commit is
 * dispatched through the established commit boundary. A gesture that is cancelled, interrupted,
 * fails, or is taken over by another recognizer lands in the cancellation path and dispatches
 * nothing at all: no partial commit, no half transaction, no RH entry.
 *
 * ## Why an interaction epoch, and what it guarantees
 *
 * Target crossings and endings are scheduled from the UI runtime onto the RN runtime separately, so
 * a callback can arrive after the gesture that produced it has already settled, cancelled, failed or
 * been superseded. Correctness must not depend on the scheduler delivering them in order.
 *
 * Every scheduled callback therefore carries the EPOCH of the interaction that produced it — a
 * monotonic counter incremented once per gesture on the UI runtime — and this module keeps a tiny
 * state machine over it:
 *
 *   epoch <  current   a callback from an older, already superseded interaction  → ignored
 *   epoch >  current   the first callback of a newer interaction                 → adopted, open
 *   epoch == current   the live interaction                                      → acted on while open
 *   epoch == current, closed                                                      → ignored
 *
 * Adoption on first sight is what makes it order-independent: no separate "open" message can arrive
 * late or out of turn, because the first callback of an interaction opens it whatever it is.
 *
 * From that, all of the required guarantees follow structurally rather than by timing:
 *
 *   - a late target callback after cancel or after commit cannot reopen or retarget a preview,
 *     because its interaction is closed;
 *   - an older gesture's callback cannot disturb a newer gesture's preview, because its epoch is
 *     behind;
 *   - an older settle or finalize cannot commit or cancel a newer gesture, for the same reason;
 *   - a successful settle commits ONLY the preview its own interaction established — it holds that
 *     preview's generation and checks it is still the live one — so it can never commit a preview
 *     left behind by the accessible route or by an earlier gesture;
 *   - a successful settle with no target of its own fails closed and commits nothing;
 *   - a cancellation cancels ONLY the preview its own interaction owns, so a stray finalize cannot
 *     discard a preview somebody else created.
 *
 * Nothing here is reachable from an animation. The acknowledgement hooks are called with the store's
 * answer already in hand, they return nothing, and no Product act waits for one.
 *
 * These are ordinary functions on purpose. Everything with Product meaning is testable without a
 * gesture, a renderer, a worklet or a frame — including under deliberately delayed and reordered
 * delivery — and the hook that wires them to the UI runtime adds no decisions of its own.
 */
import type { CanonicalStore } from '../../state';
import { commitPreviewedTarget } from '../targeting/commit';
import { temporalTargeting, type TemporalTargeting } from '../targeting/disclosed-availability';
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
   * The finger of interaction `epoch` crossed into disclosed step `index`. Previews it, or refuses.
   * Never commits, never writes canonical state, and never touches the presentation window.
   */
  readonly targetIndex: (epoch: number, index: number) => PreviewResult;
  /**
   * Interaction `epoch` finished. `committed` is true only for a successful end; every other ending
   * — cancellation, failure, interruption, a competing recognizer winning — arrives here as false.
   */
  readonly settle: (epoch: number, committed: boolean) => void;
  /** The interaction this layer currently considers live, for tests and assertions. */
  readonly liveInteraction: () => { readonly epoch: number; readonly open: boolean; readonly generation: number | null };
}

const CLOSED: PreviewResult = Object.freeze({
  outcome: 'REJECTED',
  code: 'INTERACTION_CLOSED',
  detail: 'this gesture has already settled, cancelled, failed or been superseded',
});

export function createScrubHandlers(deps: ScrubDependencies): ScrubHandlers {
  // The live interaction. `epoch` only ever increases; `generation` is the preview THIS interaction
  // established, and is the only preview it is ever allowed to commit or cancel.
  let epoch = 0;
  let open = false;
  let generation: number | null = null;

  /** Order-independent admission. Adoption on first sight; anything behind is ignored. */
  function admit(candidate: number): 'CURRENT' | 'IGNORED' {
    if (!Number.isSafeInteger(candidate) || candidate <= 0) return 'IGNORED';
    if (candidate < epoch) return 'IGNORED';
    if (candidate > epoch) {
      epoch = candidate;
      open = true;
      generation = null;
      return 'CURRENT';
    }
    return open ? 'CURRENT' : 'IGNORED';
  }

  function targeting(): TemporalTargeting {
    return temporalTargeting(deps.store.getState(), deps.snapshot().track);
  }

  function targetIndex(candidateEpoch: number, index: number): PreviewResult {
    if (admit(candidateEpoch) === 'IGNORED') {
      deps.onPreview?.(CLOSED);
      return CLOSED;
    }
    const snapshot = deps.snapshot();
    const track = snapshot.track;
    // The Track is T-05's own complete disclosed prefix, so the index is looked up rather than
    // arithmetic: an index outside it is simply not a disclosed target and produces no intent.
    const target = Number.isInteger(index) && index >= 0 ? track.targets[index] : undefined;
    if (target === undefined) {
      const result: PreviewResult = { outcome: 'REJECTED', code: 'NOT_DISCLOSED', detail: 'no disclosed Moment target at this presentation position' };
      deps.onPreview?.(result);
      return result;
    }
    const current = targeting();
    // The same disclosed-membership rule every other route uses; the pointer route gains no second
    // rule of its own from having an index in hand.
    const resolved = temporalTargetFromDisclosed(current, track, target);
    if (!resolved.ok) {
      const result: PreviewResult = { outcome: 'REJECTED', code: resolved.code, detail: resolved.detail };
      deps.onPreview?.(result);
      return result;
    }
    const result = deps.preview.preview(current, resolved.sp, 'DISCLOSED_TARGET');
    if (result.outcome === 'PREVIEWING') generation = result.preview.generation;
    deps.onPreview?.(result);
    return result;
  }

  function settle(candidateEpoch: number, committed: boolean): void {
    if (admit(candidateEpoch) === 'IGNORED') return;
    // The interaction closes FIRST, so any callback of its own still in flight is already ignored by
    // the time this function does anything at all.
    open = false;
    const owned = generation;
    generation = null;
    // An interaction acts only on the preview it established. Without one there is nothing of its
    // own to commit or to cancel, and it must not reach for somebody else's.
    const ownsLivePreview = owned !== null && deps.preview.isCurrent(owned);

    if (!committed) {
      // Cancellation, interruption and failure are one path and it is the safe one: the ephemeral
      // target is discarded, canonical state is not touched, and RH gains nothing.
      if (ownsLivePreview) deps.preview.cancel();
      deps.onCancelled?.();
      return;
    }
    if (!ownsLivePreview) {
      const outcome: TemporalOutcome = {
        outcome: 'REJECTED',
        code: 'NO_PREVIEW',
        detail: 'this gesture established no live preview target of its own; nothing is committed',
      };
      deps.onOutcome?.(outcome);
      deps.onCancelled?.();
      return;
    }
    // The outcome is computed FIRST and the observers are notified afterwards. An optional call
    // would not evaluate its argument when no observer is attached, which would silently make the
    // whole pointer route a no-op.
    const outcome = commitPreviewedTarget(deps.store, deps.preview, targeting());
    deps.onOutcome?.(outcome);
    if (outcome.outcome === 'APPLIED') deps.onCommitted?.();
    else deps.onCancelled?.();
  }

  return { targetIndex, settle, liveInteraction: () => ({ epoch, open, generation }) };
}
