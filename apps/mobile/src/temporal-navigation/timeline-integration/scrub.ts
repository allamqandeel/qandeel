/**
 * T-06 — the Product logic of a temporal scrub, as plain functions, plus the interaction ownership
 * that makes it safe against reordered cross-runtime callbacks (R1-02) and against React
 * reconfiguring the surface that owns it (FCR-01).
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
 * ## One coordinator per surface, whatever React does to the callbacks (FCR-01)
 *
 * The state machine above is only a guarantee while every callback of a surface reaches the SAME
 * instance of it. A queued `scheduleOnRN` keeps the function object it was scheduled with, so if
 * the instance were rebuilt whenever an observer callback changed identity, a late callback could
 * run against an old instance whose epoch, open flag and owned generation know nothing of the newer
 * interaction — and retarget, commit or cancel what the newer one owns.
 *
 * So a coordinator is bound to exactly two things, the store and the preview controller — the
 * SURFACE whose interaction it owns — and reads everything else (the presentation snapshot and
 * the observers) through `latest()` at CALL time. Observer identity can change on every render
 * without touching interaction ownership, and no caller has to memoize anything.
 *
 * A coordinator can be RETIRED, once and for ever, when its surface unmounts or its store or
 * preview controller is replaced. A retired coordinator ignores every callback, adopts nothing,
 * notifies nobody and never reaches the replacement; an interaction it still had open at that
 * moment is treated as interrupted, which is the safe ending — its own preview is discarded and
 * nothing canonical moves. A successor coordinator is told which epochs already belong to the
 * retired surface (`after`), so an interaction minted before the replacement is never adopted by
 * the surface that replaced it, whatever order its callbacks arrive in.
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

/** The two authorities a coordinator is bound to for its whole life. Replacing either retires it. */
export interface ScrubSurface {
  readonly store: CanonicalStore;
  readonly preview: TemporalPreviewController;
}

/** Everything read fresh on every call. Identity changes here never touch interaction ownership. */
export interface ScrubObservers {
  /** Read fresh on every call: the presentation may have moved, and the mirror may have advanced. */
  readonly snapshot: () => PresentationSnapshot;
  /** Presentation acknowledgement, called only AFTER the store has answered. Optional by design. */
  readonly onCommitted?: () => void;
  readonly onCancelled?: () => void;
  readonly onOutcome?: (outcome: TemporalOutcome) => void;
  readonly onPreview?: (result: PreviewResult) => void;
}

export interface ScrubDependencies extends ScrubSurface, ScrubObservers {}

/** The interaction a coordinator currently considers live, for tests and assertions. */
export interface ScrubInteraction {
  readonly epoch: number;
  readonly open: boolean;
  readonly generation: number | null;
  /** True once the coordinator has been retired: every callback is inert from then on. */
  readonly retired: boolean;
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
  readonly liveInteraction: () => ScrubInteraction;
}

export interface ScrubCoordinator {
  readonly handlers: ScrubHandlers;
  /**
   * Retires the coordinator. One-way and idempotent: afterwards every callback is ignored, nothing
   * is adopted and no observer is called. An interaction still open at retirement is interrupted —
   * the preview it established is discarded through the coordinator's OWN preview controller, and
   * nothing canonical moves. A preview it did not establish is not touched.
   */
  readonly retire: () => void;
}

export interface ScrubCoordinatorOptions {
  /**
   * The highest interaction epoch that already belongs to an earlier, retired surface. Every epoch
   * at or below it is ignored rather than adopted, so a gesture minted before this coordinator's
   * surface existed can never act on it.
   */
  readonly after?: number;
}

const CLOSED: PreviewResult = Object.freeze({
  outcome: 'REJECTED',
  code: 'INTERACTION_CLOSED',
  detail: 'this gesture has already settled, cancelled, failed or been superseded',
});

const RETIRED: PreviewResult = Object.freeze({
  outcome: 'REJECTED',
  code: 'INTERACTION_CLOSED',
  detail: 'the temporal surface that owned this gesture has been retired; nothing is previewed',
});

export function createScrubCoordinator(
  surface: ScrubSurface,
  latest: () => ScrubObservers,
  options: ScrubCoordinatorOptions = {},
): ScrubCoordinator {
  // Bound for life. A replacement of either is a different surface, and a different coordinator.
  const { store, preview } = surface;
  // The live interaction. `epoch` only ever increases; `generation` is the preview THIS interaction
  // established, and is the only preview it is ever allowed to commit or cancel. Starting at
  // `after` makes every earlier epoch look already superseded, which is exactly what it is.
  const after = options.after ?? 0;
  let epoch = Number.isSafeInteger(after) && after > 0 ? after : 0;
  let open = false;
  let generation: number | null = null;
  let retired = false;

  /** Order-independent admission. Adoption on first sight; anything behind is ignored. */
  function admit(candidate: number): 'CURRENT' | 'IGNORED' {
    if (retired) return 'IGNORED';
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

  function targeting(observers: ScrubObservers): TemporalTargeting {
    return temporalTargeting(store.getState(), observers.snapshot().track);
  }

  function targetIndex(candidateEpoch: number, index: number): PreviewResult {
    // A retired surface has no observers to tell: it answers, and changes nothing.
    if (retired) return RETIRED;
    const observers = latest();
    if (admit(candidateEpoch) === 'IGNORED') {
      observers.onPreview?.(CLOSED);
      return CLOSED;
    }
    const snapshot = observers.snapshot();
    const track = snapshot.track;
    // The Track is T-05's own complete disclosed prefix, so the index is looked up rather than
    // arithmetic: an index outside it is simply not a disclosed target and produces no intent.
    const target = Number.isInteger(index) && index >= 0 ? track.targets[index] : undefined;
    if (target === undefined) {
      const result: PreviewResult = { outcome: 'REJECTED', code: 'NOT_DISCLOSED', detail: 'no disclosed Moment target at this presentation position' };
      observers.onPreview?.(result);
      return result;
    }
    const current = targeting(observers);
    // The same disclosed-membership rule every other route uses; the pointer route gains no second
    // rule of its own from having an index in hand.
    const resolved = temporalTargetFromDisclosed(current, track, target);
    if (!resolved.ok) {
      const result: PreviewResult = { outcome: 'REJECTED', code: resolved.code, detail: resolved.detail };
      observers.onPreview?.(result);
      return result;
    }
    const result = preview.preview(current, resolved.sp, 'DISCLOSED_TARGET');
    if (result.outcome === 'PREVIEWING') generation = result.preview.generation;
    observers.onPreview?.(result);
    return result;
  }

  function settle(candidateEpoch: number, committed: boolean): void {
    if (admit(candidateEpoch) === 'IGNORED') return;
    const observers = latest();
    // The interaction closes FIRST, so any callback of its own still in flight is already ignored by
    // the time this function does anything at all.
    open = false;
    const owned = generation;
    generation = null;
    // An interaction acts only on the preview it established. Without one there is nothing of its
    // own to commit or to cancel, and it must not reach for somebody else's.
    const ownsLivePreview = owned !== null && preview.isCurrent(owned);

    if (!committed) {
      // Cancellation, interruption and failure are one path and it is the safe one: the ephemeral
      // target is discarded, canonical state is not touched, and RH gains nothing.
      if (ownsLivePreview) preview.cancel();
      observers.onCancelled?.();
      return;
    }
    if (!ownsLivePreview) {
      const outcome: TemporalOutcome = {
        outcome: 'REJECTED',
        code: 'NO_PREVIEW',
        detail: 'this gesture established no live preview target of its own; nothing is committed',
      };
      observers.onOutcome?.(outcome);
      observers.onCancelled?.();
      return;
    }
    // The outcome is computed FIRST and the observers are notified afterwards. An optional call
    // would not evaluate its argument when no observer is attached, which would silently make the
    // whole pointer route a no-op.
    const outcome = commitPreviewedTarget(store, preview, targeting(observers));
    observers.onOutcome?.(outcome);
    if (outcome.outcome === 'APPLIED') observers.onCommitted?.();
    else observers.onCancelled?.();
  }

  function retire(): void {
    if (retired) return;
    retired = true;
    const owned = open ? generation : null;
    open = false;
    generation = null;
    // An interaction torn down mid-flight is an interrupted one, and interruption is the safe
    // ending: its own preview is discarded, nothing canonical moves, and nobody else's preview is
    // touched. No observer is called — the surface that would have acknowledged it is gone.
    if (owned !== null && preview.isCurrent(owned)) preview.cancel();
  }

  return {
    handlers: { targetIndex, settle, liveInteraction: () => ({ epoch, open, generation, retired }) },
    retire,
  };
}

/**
 * A coordinator over one fixed set of dependencies. The R1-02 state machine, exactly as before: the
 * hook no longer uses this shape, but the tests that prove the state machine under reordered
 * delivery do, and so may any caller with dependencies that never change.
 */
export function createScrubHandlers(deps: ScrubDependencies): ScrubHandlers {
  return createScrubCoordinator(deps, () => deps).handlers;
}

const NO_INTERACTION: ScrubInteraction = Object.freeze({ epoch: 0, open: false, generation: null, retired: true });

/**
 * The stable forwarder a surface schedules through. It lives as long as the surface is mounted and
 * routes every callback — whenever it was queued — to whichever coordinator is attached at
 * DELIVERY, and to nothing when none is. Plain JavaScript on purpose: the hook creates it once,
 * attaches each coordinator in a layout effect and detaches it in the cleanup, so no callback ever
 * captures a coordinator, a React ref or anything else with a lifetime of its own.
 */
export interface ScrubForwarder {
  /** What the gesture and the reaction schedule. Its identity never changes. */
  readonly handlers: ScrubHandlers;
  /** Routes every later callback to `coordinator`. */
  readonly attach: (coordinator: ScrubCoordinator) => void;
  /** Routes every later callback to nothing. Idempotent. */
  readonly detach: () => void;
}

export function createScrubForwarder(): ScrubForwarder {
  let live: ScrubCoordinator | null = null;
  return {
    handlers: {
      targetIndex: (epoch, index) => live?.handlers.targetIndex(epoch, index) ?? RETIRED,
      settle: (epoch, committed) => live?.handlers.settle(epoch, committed),
      liveInteraction: () => live?.handlers.liveInteraction() ?? NO_INTERACTION,
    },
    attach: (coordinator) => {
      live = coordinator;
    },
    detach: () => {
      live = null;
    },
  };
}
