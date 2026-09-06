/**
 * T-06 — the pending contextual-locus choice: the model behind the user-facing route (R1-04).
 *
 * An executor may answer `LOCUS_SELECTION_REQUIRED`. That is a Product state, and a Product state
 * that says "a choice is required" must come with a usable way to make it — otherwise the reader is
 * told they must choose and given nothing to choose with.
 *
 * This module is the narrowest truthful substrate for that, and nothing more. It is not chrome, not
 * art direction and not a navigation surface:
 *
 *   - it holds ONLY what the legitimate result carried: the target, the projection it was resolved
 *     against, and every legitimate locus of that target in that projection;
 *   - it ranks nothing. The order is the disclosed scene's own deterministic order, which is a
 *     tie-break and not a preference, and the model says so rather than implying otherwise;
 *   - it elects nothing. There is no default, no "primary" context, no nearest, no first row, no
 *     last used, no Live Focus heuristic. A pending choice with no selection stays pending;
 *   - it resolves through the SAME executors and the SAME runtime authority as every other route,
 *     so the pointer route and the accessible route cannot diverge in what they are allowed to do;
 *   - it never commits the temporal half early. A composite choice completes as ONE composite
 *     transaction when the locus arrives, and writes nothing at all before that;
 *   - it fails closed when the projection it is pending against stops being the one the act would
 *     commit to — the executors ask the shared freshness rule again, so a stale pending choice
 *     cannot land.
 */
import type { SessionPosition } from '../../state';
import type { EntitledLocus, MapInspectionContext } from '../../map';
import type { CanonicalStore } from '../../state';
import type { TemporalOutcome } from '../outcome';
import { temporalRejected } from '../outcome';
import {
  chooseLocus,
  commitMomentAndLocate,
  type CommitMomentAndLocateOutcome,
  type TemporalLocateTarget,
} from '../targeting';

/**
 * A choice waiting to be made.
 *
 * `COMPOSITE` is a `COMMIT_MOMENT_AND_LOCATE` that stopped because its target has several loci: the
 * temporal half has NOT happened, and completing the choice runs the whole act as one transaction.
 * `SPATIAL` is a `CHOOSE_LOCUS` at the position the reader is already standing on.
 */
export type PendingLocusChoice =
  | {
      readonly kind: 'COMPOSITE';
      readonly moment: SessionPosition;
      readonly context: MapInspectionContext;
      readonly target: TemporalLocateTarget;
      readonly loci: readonly EntitledLocus[];
    }
  | {
      readonly kind: 'SPATIAL';
      readonly context: MapInspectionContext;
      readonly target: TemporalLocateTarget;
      readonly loci: readonly EntitledLocus[];
    };

/**
 * Builds a pending composite choice from the executor's own answer. It is deliberately the ONLY way
 * to construct one from a composite act: a chooser can never be manufactured for a target that did
 * not actually stop on a genuine ambiguity.
 */
export function pendingCompositeChoice(
  outcome: CommitMomentAndLocateOutcome,
  context: MapInspectionContext,
  target: TemporalLocateTarget,
): Extract<PendingLocusChoice, { kind: 'COMPOSITE' }> | null {
  if (outcome.outcome !== 'LOCUS_SELECTION_REQUIRED') return null;
  return Object.freeze({ kind: 'COMPOSITE', moment: outcome.moment, context, target, loci: outcome.loci });
}

/** Builds a pending spatial choice. Only a genuine multiple-locus ambiguity produces one. */
export function pendingSpatialChoice(
  context: MapInspectionContext,
  target: TemporalLocateTarget,
  loci: readonly EntitledLocus[],
): Extract<PendingLocusChoice, { kind: 'SPATIAL' }> | null {
  return loci.length >= 2 ? Object.freeze({ kind: 'SPATIAL', context, target, loci }) : null;
}

export interface LocusChoiceOption {
  /** The locus handle itself. Only a handle from this list may be submitted. */
  readonly locus: EntitledLocus;
  /** A stable identity for the option, so a non-pointer route can name one without an index. */
  readonly key: string;
  /** Structural placeholder copy. It names the context; it ranks and prefers nothing. */
  readonly label: string;
}

export interface LocusChoiceModel {
  readonly kind: PendingLocusChoice['kind'];
  /** Names the target and where the choice applies. Never states which option is better. */
  readonly title: string;
  /** Says explicitly that the order carries no preference. */
  readonly orderingNote: string;
  readonly options: readonly LocusChoiceOption[];
  /** The Session Position the resulting act commits to, for a composite choice. */
  readonly moment: SessionPosition | null;
}

const CONTEXT_ORDER_NOTE = 'Listed in the order the Map discloses them. The order is not a ranking.';

function labelFor(locus: EntitledLocus, target: TemporalLocateTarget): string {
  const where = locus.locus;
  return where.kind === 'THREAD_HOME'
    ? `${target.family} ${target.id} at the permanent place of Thread ${where.threadId}`
    : `${target.family} ${target.id} in Thread ${where.threadId}, context ${where.bindingId}`;
}

/**
 * The presentable form of a pending choice. Every legitimate locus appears exactly once, none is
 * marked, defaulted, preselected or described as preferable, and the copy is a structural
 * placeholder — final wording, tone and localization belong to the later chrome task.
 */
export function locusChoiceModel(pending: PendingLocusChoice): LocusChoiceModel {
  const options = pending.loci.map((locus) =>
    Object.freeze({ locus, key: locus.key, label: labelFor(locus, pending.target) }),
  );
  return Object.freeze({
    kind: pending.kind,
    title:
      pending.kind === 'COMPOSITE'
        ? `Choose where to arrive for ${pending.target.family} ${pending.target.id} at Moment ${pending.moment}`
        : `Choose which context to show for ${pending.target.family} ${pending.target.id}`,
    orderingNote: CONTEXT_ORDER_NOTE,
    options: Object.freeze(options),
    moment: pending.kind === 'COMPOSITE' ? pending.moment : null,
  });
}

/**
 * Completes a pending choice through the existing authorized executor.
 *
 * The submitted handle must be one of the options this pending choice carries — the executors verify
 * membership and the runtime brand again, and this check exists so a non-member cannot even be
 * offered to them by a surface. A composite choice runs as ONE composite transaction; a spatial
 * choice writes the landing only. Either fails closed if the projection has since stopped being the
 * one the act would commit to.
 */
export function resolvePendingLocusChoice(
  store: CanonicalStore,
  pending: PendingLocusChoice,
  locus: EntitledLocus,
): TemporalOutcome | CommitMomentAndLocateOutcome {
  if (pending === null || typeof pending !== 'object' || locus === undefined || locus === null) {
    return temporalRejected('INVALID_INPUT', 'a pending contextual-locus choice names the locus it chooses');
  }
  if (!pending.loci.some((candidate) => candidate === locus)) {
    return temporalRejected('INVALID_INPUT', 'the chosen locus is not one of the legitimate choices this pending selection offers');
  }
  return pending.kind === 'COMPOSITE'
    ? commitMomentAndLocate(store, { moment: pending.moment, context: pending.context, target: pending.target, locus })
    : chooseLocus(store, { context: pending.context, target: pending.target, locus });
}
