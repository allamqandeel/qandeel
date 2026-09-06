/**
 * T-07 — the entry gate every committed return act passes through, and the only thing this layer
 * knows about Preview.
 *
 * T-06 froze the precedence: a committed navigation act during a Preview cancels the Preview FIRST,
 * discards `PTC`, records nothing for it, and then operates from authoritative committed state. That
 * is not re-implemented here. `TemporalPreviewController.cancel()` is T-06's own seam — lossless,
 * non-transactional, canonical-writer-free — and this layer calls exactly that, in exactly one
 * place, before resolving anything at all.
 *
 * The consequence is structural rather than conventional: every public act in this layer is written
 * as `committedReturn(surface, (store) => …)`, the closure receives the STORE and never the preview
 * controller, and nothing in the layer reads a preview snapshot. So no return act can resolve a
 * target, a landing or a checkpoint from ephemeral preview intent — there is no expression in the
 * layer that could.
 */
import type { CanonicalStore } from '../state';
import type { TemporalPreviewController } from '../temporal-navigation';
import type { ReturnOutcome } from './outcomes';

/**
 * The two things a committed return act needs: the canonical store it acts on, and the T-06 Preview
 * controller whose ephemeral intent it must discard first. T-07 owns no preview state of its own and
 * creates no second controller.
 */
export interface ReturnSurface {
  readonly store: CanonicalStore;
  readonly preview: TemporalPreviewController;
}

/**
 * Cancels any open Preview, then runs the act against authoritative committed state.
 *
 * The order is the point. Cancellation happens before the act is resolved, so a return act can never
 * be resolved from `PTC`; and because cancellation writes no canonical field, discarding a preview
 * appends no RH entry and consumes none either.
 */
export function committedReturn(surface: ReturnSurface, run: (store: CanonicalStore) => ReturnOutcome): ReturnOutcome {
  surface.preview.cancel();
  return run(surface.store);
}
