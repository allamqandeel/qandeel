/**
 * T-08 — "what am I inside?", answered from disclosed truth and from nothing else.
 *
 * A context path is not a document hierarchy and a contextual appearance is not a folder. The world
 * stays one world: an object seen through two contexts is ONE canonical identity in two legitimate
 * places, and switching between them is a change of vantage, not a change of object and not the
 * creation of a relation between the two contexts.
 *
 * Everything here is read from the disclosed projection `V` through T-04's own substrate:
 *
 *   - the lineage is the exact route T-04 minted when it admitted the target. No parent is inferred,
 *     no ownership is implied by containment, and no geometry is consulted;
 *   - the appearances are T-04's own disclosed loci for this identity at this position. There is no
 *     second enumeration and no second locatability rule;
 *   - a context that `V` does not disclose is absent from the list entirely, so an unavailable
 *     context can never be offered, and no other appearance is substituted for it.
 *
 * ## Nothing is elected
 *
 * There is no primary context, no default, no preselection, no nearest-by-geometry, no first row and
 * no Live Focus heuristic. `current` states where the reader IS — read from their own `IF_ref` — and
 * is the only mark any option ever carries; where the reader is inside no named context, no option is
 * marked at all. The order is the disclosed scene's own deterministic order, which is a tie-break and
 * not a preference, and `ordering` says so out loud, because a list that does not deny being a
 * ranking will be read as one.
 *
 * A single legitimate appearance produces no chooser. Offering a "choice" of one implies that
 * choosing is a thing the reader must think about here, which is itself a false claim.
 */
import { disclosedAppearances, type MapInspectionContext, type MapObjectFamily } from '../map';
import type { HistoricalFamily } from '../projection';
import type { ContextAppearanceOption, ContextChrome, ContextStep } from './types';

const EMPTY: ContextChrome = Object.freeze({
  lineage: Object.freeze([]),
  appearances: Object.freeze([]),
  choiceAvailable: false,
});

/**
 * What a reader could tell one appearance from another BY.
 *
 * It is the semantic pair the chooser is allowed to show — whether this is the one they are looking
 * through, and the Moment it was taken up at — and never a rendered string. Deriving it from the
 * words would make "can these be told apart?" a question with a different answer in each language,
 * and the answer is a fact about the disclosure, not about the wording. A Moment is a number, so it
 * can never collide with the current-appearance key.
 */
const CURRENT_KEY = 'CURRENT';
const distinguisher = (option: ContextAppearanceOption): string => (option.current ? CURRENT_KEY : String(option.boundAtMoment));

/** The Map families are exactly the disclosure families of the same name; every other family is inspectable but unplaced. */
const MAP_FAMILIES: readonly string[] = Object.freeze(['THREAD', 'READING', 'EMERGING_FOCUS']);

export function mapFamilyOf(family: HistoricalFamily): MapObjectFamily | null {
  return MAP_FAMILIES.includes(family) ? (family as MapObjectFamily) : null;
}

export interface ContextOrientationInputs {
  /** A projection already proven to be this viewpoint's. Meaning is never derived before that. */
  readonly context: MapInspectionContext;
  /** The identity, only ever supplied for a render state that is allowed to name one. */
  readonly identity: { readonly family: HistoricalFamily; readonly id: string } | null;
  /** The contextual binding the reader's own `IF_ref` names, or `null` when it names none. */
  readonly currentBindingId: string | null;
  readonly lineage: readonly ContextStep[];
}

/**
 * The disclosed contextual appearances of the inspected identity, and the disclosed route to it.
 *
 * Only contextual appearances are offered. A Thread's own permanent Home is where that Thread simply
 * IS, not one of several vantages onto it, so it is not a row in a chooser — presenting it as one
 * would invite the reader to "switch" to a context that is not a context.
 */
export function contextOrientation(inputs: ContextOrientationInputs): ContextChrome {
  const { context, identity, currentBindingId, lineage } = inputs;
  if (identity === null) return EMPTY;
  const family = mapFamilyOf(identity.family);
  if (family === null) {
    return Object.freeze({ lineage, appearances: Object.freeze([]), choiceAvailable: false });
  }

  const options: ContextAppearanceOption[] = [];
  for (const locus of disclosedAppearances(context, family, identity.id)) {
    const where = locus.locus;
    if (where.kind !== 'CONTEXTUAL_APPEARANCE') continue;
    // Where the reader is, read from their own inspection. Never a preference and never a default.
    const current = currentBindingId !== null && where.bindingId === currentBindingId;
    options.push(
      Object.freeze({
        ordinal: options.length,
        bindingId: where.bindingId,
        boundAtMoment: where.boundSp,
        current,
      }),
    );
  }

  // Fail closed rather than invent. `V` discloses no human-readable name for a Thread, so two
  // appearances taken up at the same Moment cannot be told apart by anything a reader may see.
  // Offering them anyway would mean either labelling them with internal handles or making a name up;
  // both are worse than saying nothing, so no chooser is produced at all.
  //
  // Asked of the semantic pair rather than of the rendered words, so the chooser appears and
  // disappears identically in every language.
  const keys = new Set(options.map(distinguisher));
  const distinguishable = keys.size === options.length;

  return Object.freeze({
    lineage,
    // One appearance is not a choice, zero is not an empty chooser, and an indistinguishable set is
    // not a choice a reader could make.
    appearances: options.length >= 2 && distinguishable ? Object.freeze(options) : Object.freeze([]),
    choiceAvailable: options.length >= 2 && distinguishable,
  });
}

/** The contextual binding an inspection reference names, or `null` when it names none. */
export function currentBindingOf(appearance: { readonly kind: string; readonly bindingId: string } | null): string | null {
  return appearance !== null && appearance.kind === 'THREAD_READING' ? appearance.bindingId : null;
}
