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
 *
 * ## Provenance, not shape (R2-02)
 *
 * The executors fail closed on submission, which protects canonical state. That is not enough for
 * the Product contract the chooser itself carries: a surface that says "choose one of these" must
 * not be able to say it about a false, foreign, incomplete, mixed or duplicated set. Being told a
 * list of loci is not evidence that they are THE legitimate loci of THIS target in THIS projection.
 *
 * So neither factory accepts a locus list at all. Both DERIVE the set from `resolveLocusChoice`
 * against the supplied context and target, and construct only from a genuine
 * `LOCUS_SELECTION_REQUIRED` — which by R1-03 exists only where there really are several legitimate
 * loci. The composite factory additionally binds the executor's own answer to that derivation: same
 * position, same ambiguity, same complete locus-key set. An outcome from one target paired with
 * another, or from one projection paired with another, produces no chooser.
 *
 * The loci a pending choice carries are the RE-RESOLVED ones, so what the surface offers is what the
 * resolver says exists, not what a caller passed in. The result is branded at runtime, and
 * `resolvePendingLocusChoice` re-checks that brand, so a hand-assembled pending object cannot act
 * even if it reaches a surface.
 */
import type { SessionPosition } from '../../state';
import type { EntitledLocus, MapInspectionContext } from '../../map';
import type { CanonicalStore } from '../../state';
import type { TemporalOutcome } from '../outcome';
import { temporalRejected } from '../outcome';
import {
  chooseLocus,
  commitMomentAndLocate,
  resolveLocusChoice,
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
declare const PENDING_PROVENANCE: unique symbol;

/**
 * The type-level half of provenance (R3-03). A hand-assembled object cannot satisfy it without an
 * explicit cast, so the ordinary way to obtain a pending choice is to derive one — and the runtime
 * brand below catches the cast.
 */
interface PendingProvenance {
  readonly [PENDING_PROVENANCE]: true;
}

interface CompositeChoice {
  readonly kind: 'COMPOSITE';
  readonly moment: SessionPosition;
  readonly context: MapInspectionContext;
  readonly target: TemporalLocateTarget;
  readonly loci: readonly EntitledLocus[];
}

interface SpatialChoice {
  readonly kind: 'SPATIAL';
  readonly context: MapInspectionContext;
  readonly target: TemporalLocateTarget;
  readonly loci: readonly EntitledLocus[];
}

export type PendingCompositeLocusChoice = CompositeChoice & PendingProvenance;
export type PendingSpatialLocusChoice = SpatialChoice & PendingProvenance;
export type PendingLocusChoice = PendingCompositeLocusChoice | PendingSpatialLocusChoice;

const minted = new WeakSet<object>();

/** True only for a pending choice these factories produced from a real, re-derived ambiguity. */
export function isPendingLocusChoice(value: unknown): value is PendingLocusChoice {
  return typeof value === 'object' && value !== null && minted.has(value as object);
}

/**
 * The complete legitimate locus set of this target in this projection, or `null` when there is no
 * genuine ambiguity. This is the ONLY source of a chooser's options: it is derived, never accepted.
 */
function ambiguityOf(context: MapInspectionContext, target: TemporalLocateTarget): readonly EntitledLocus[] | null {
  if (context === null || typeof context !== 'object' || target === null || typeof target !== 'object') return null;
  const resolution = resolveLocusChoice(context, target, undefined);
  return resolution.outcome === 'LOCUS_SELECTION_REQUIRED' ? resolution.loci : null;
}

/**
 * Whether two locus lists are the SAME set: same members and same count. Compared element-wise on
 * sorted keys rather than through a joined string, so there is no separator to collide with and a
 * duplicated entry changes the length and is refused rather than silently absorbed.
 */
function sameLocusSet(a: readonly EntitledLocus[], b: readonly EntitledLocus[]): boolean {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const left = [...a].map((locus) => locus.key).sort();
  const right = [...b].map((locus) => locus.key).sort();
  return left.every((key, index) => key === right[index]);
}

/**
 * Builds a pending composite choice, bound to the ambiguity that actually produced the outcome.
 *
 * Four things must agree before a chooser exists (R2-02): the outcome must be a genuine selection
 * requirement; the supplied projection must describe the position that outcome commits to; that
 * projection and target must STILL resolve to an ambiguity; and its complete locus-key set must be
 * exactly the outcome's. An outcome from one target paired with another, or from one projection
 * paired with another, or one whose set has since changed, produces nothing.
 */
export function pendingCompositeChoice(
  outcome: CommitMomentAndLocateOutcome,
  context: MapInspectionContext,
  target: TemporalLocateTarget,
): PendingCompositeLocusChoice | null {
  if (outcome === null || typeof outcome !== 'object' || outcome.outcome !== 'LOCUS_SELECTION_REQUIRED') return null;
  if (context === null || typeof context !== 'object' || context.scene.tc !== outcome.moment) return null;
  const loci = ambiguityOf(context, target);
  if (loci === null) return null;
  // The outcome's own set and the re-derived set must be the same set — same members, same count, so
  // a subset, a superset and a duplicated entry are all refused.
  if (!sameLocusSet(loci, outcome.loci)) return null;
  // The RE-DERIVED loci are what the chooser offers: what the resolver says exists, never what a
  // caller supplied alongside it.
  const pending = Object.freeze({ kind: 'COMPOSITE', moment: outcome.moment, context, target, loci: Object.freeze([...loci]) }) as PendingCompositeLocusChoice;
  minted.add(pending);
  return pending;
}

/**
 * Builds a pending spatial choice by DERIVING the ambiguity, not by being told one. There is no
 * loci parameter: zero and unique loci produce nothing, and a caller cannot substitute a different
 * set, mix two targets, trim one or pad it with a foreign locus.
 */
export function pendingSpatialChoice(context: MapInspectionContext, target: TemporalLocateTarget): PendingSpatialLocusChoice | null {
  const loci = ambiguityOf(context, target);
  if (loci === null) return null;
  const pending = Object.freeze({ kind: 'SPATIAL', context, target, loci: Object.freeze([...loci]) }) as PendingSpatialLocusChoice;
  minted.add(pending);
  return pending;
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
 * The presentable form of a pending choice, or `null` when there is no provenance behind it.
 *
 * The brand is checked HERE, at the presentation boundary, not only at execution (R3-03). Rejecting
 * a forged choice when the reader presses it is too late: by then they have already been shown a
 * list of contexts that may be false, foreign, incomplete or mixed, and shown it with the full
 * authority of the Product. A chooser that cannot prove where its options came from must produce no
 * model at all, so there is nothing to render.
 *
 * Every legitimate locus appears exactly once, none is marked, defaulted, preselected or described
 * as preferable, and the copy is a structural placeholder — final wording, tone and localization
 * belong to the later chrome task.
 */
export function locusChoiceModel(pending: PendingLocusChoice): LocusChoiceModel | null {
  if (!isPendingLocusChoice(pending)) return null;
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
  if (locus === undefined || locus === null) {
    return temporalRejected('INVALID_INPUT', 'a pending contextual-locus choice names the locus it chooses');
  }
  // Defence in depth: even a pending object that reached a surface some other way cannot act, because
  // only a factory-derived one carries the brand.
  if (!isPendingLocusChoice(pending)) {
    return temporalRejected('INVALID_INPUT', 'the pending contextual-locus choice was not derived from a genuine ambiguity');
  }
  if (!pending.loci.some((candidate) => candidate === locus)) {
    return temporalRejected('INVALID_INPUT', 'the chosen locus is not one of the legitimate choices this pending selection offers');
  }
  return pending.kind === 'COMPOSITE'
    ? commitMomentAndLocate(store, { moment: pending.moment, context: pending.context, target: pending.target, locus })
    : chooseLocus(store, { context: pending.context, target: pending.target, locus });
}
