/**
 * T-06 — the commit boundary: the ONE place ephemeral temporal intent becomes committed Product
 * truth, through the canonical primitives T-02 already owns.
 *
 * `COMMIT_MOMENT` and `COMMIT_LIVE_EDGE` are not replaced, wrapped in a new store, re-derived or
 * generalized into a navigation action. T-06 owns the interaction and the substrate around them and
 * calls them at the correct moment, which is a completed, explicit user act — never a gesture frame,
 * never a scroll event, never an animation callback, and never the arrival of an animation at its
 * end value.
 *
 * The frozen distinction between the two is structural, not conventional:
 *
 *   - `Moment(LH)` is an ordinary committed Moment target. Committing it produces `PINNED(LH)`,
 *     which is a different state from `FOLLOW_LIVE` even though the effective `TC` is the same
 *     Session Position at that instant — and it stays different, because when `LH` advances the
 *     pinned view stays where it is while the following view moves;
 *   - `LIVE_EDGE` is a temporal MODE intent, reached only by an explicit Live act.
 *
 * Nothing in this file can turn one into the other. `commitTemporalIntent` switches on a two-shape
 * intent and there is no path from the `MOMENT` branch into the `LIVE_EDGE` branch — so reaching,
 * previewing, scrubbing to or continuing forward to `SP(LH)` can never quietly mean "go live".
 */
import { type CanonicalStore, type SessionPosition } from '../../state';
import { dispatchKernelCommit, temporalRejected, type TemporalOutcome } from '../outcome';
import type { TemporalPreviewController } from '../preview/preview-state';
import { resolveTemporalTarget, temporalBounds, type TemporalTargetIntent } from './addressability';
import { resolveDisclosedTarget, type TemporalTargeting } from './disclosed-availability';

/**
 * `COMMIT_MOMENT(m)` → `TM := PINNED(m)`. This is the CANONICAL commit and it carries T-02's frozen
 * precondition and no other: `1 <= m <= LH`. It is deliberately not disclosure-aware, because
 * disclosed interaction availability is a T-06 interaction question and redefining the canonical
 * precondition in its terms would collapse two concepts that must stay separable (R1-01). Every
 * T-06 INTERACTION route reaches this only after the disclosed gate has already spoken.
 *
 * The kernel re-checks the same frozen bound itself, because a client-side gate is a convenience and
 * never the authority.
 */
export function commitMoment(store: CanonicalStore, candidate: unknown): TemporalOutcome {
  const resolved = resolveTemporalTarget(temporalBounds(store.getState()), candidate);
  if (!resolved.ok) return temporalRejected(resolved.code, resolved.detail);
  return dispatchKernelCommit(store, { type: 'COMMIT_MOMENT', moment: resolved.sp });
}

/** `COMMIT_LIVE_EDGE` → `TM := FOLLOW_LIVE`. Reachable only from explicit Live intent. */
export function commitLiveEdge(store: CanonicalStore): TemporalOutcome {
  return dispatchKernelCommit(store, { type: 'COMMIT_LIVE_EDGE' });
}

/** One explicit temporal intent → exactly one canonical commit. */
export function commitTemporalIntent(store: CanonicalStore, intent: TemporalTargetIntent): TemporalOutcome {
  switch (intent?.kind) {
    case 'MOMENT':
      return commitMoment(store, intent.sp);
    case 'LIVE_EDGE':
      return commitLiveEdge(store);
    default:
      return temporalRejected('INVALID_INPUT', 'a temporal intent is either a disclosed Moment target or the Live Edge');
  }
}

/**
 * Commits whatever the ephemeral preview is currently targeting.
 *
 * This is the only route by which a preview can become truth, and it is a separate, explicit act:
 * the preview itself never commits, never times out into a commit and never becomes one because an
 * animation finished. After the store has answered, the ephemeral intent is discarded — an applied
 * commit and a no-op commit both mean the preview is no longer a preview of anything. A refusal
 * changes nothing at all, including the preview, so the reader can retarget or cancel.
 */
export function commitPreviewedTarget(store: CanonicalStore, preview: TemporalPreviewController, targeting: TemporalTargeting): TemporalOutcome {
  const snapshot = preview.getSnapshot();
  if (snapshot.status === 'IDLE') {
    return temporalRejected('NO_PREVIEW', 'there is no previewed temporal target to commit');
  }
  // Disclosure is re-checked at the commit boundary, not merely when the preview was established:
  // between the two the Session may have been replaced, and a target that is no longer disclosed is
  // no longer a legitimate interaction target however valid the Moment itself remains (R1-01).
  const disclosed = resolveDisclosedTarget(targeting, snapshot.ptc);
  if (!disclosed.ok) return temporalRejected(disclosed.code, disclosed.detail);
  const outcome = commitMoment(store, disclosed.sp);
  if (outcome.outcome !== 'REJECTED') preview.cancel();
  return outcome;
}

/**
 * Explicit Live intent, from any route. It discards a preview first — an open preview of a
 * historical Moment is not what the reader asked for — and then commits the Live Edge.
 */
export function commitLiveEdgeIntent(store: CanonicalStore, preview: TemporalPreviewController): TemporalOutcome {
  preview.cancel();
  return commitLiveEdge(store);
}

/** The committed Session Position right now, or `null` before the first mirrored Moment. */
export function committedPosition(store: CanonicalStore): SessionPosition | null {
  return temporalBounds(store.getState()).committedTc;
}
