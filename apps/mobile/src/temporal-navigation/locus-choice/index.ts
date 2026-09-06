/**
 * T-06 — the pending contextual-locus choice and its user-facing route. A Product state that says a
 * choice is required comes with a usable way to make it, on both the pointer and the non-pointer
 * route, through the same executor and the same runtime authority.
 */
export type {
  LocusChoiceModel,
  LocusChoiceOption,
  PendingCompositeLocusChoice,
  PendingLocusChoice,
  PendingSpatialLocusChoice,
} from './pending-locus-choice';
export {
  isPendingLocusChoice,
  locusChoiceModel,
  pendingCompositeChoice,
  pendingSpatialChoice,
  resolvePendingLocusChoice,
} from './pending-locus-choice';

export type { LocusChoiceSurfaceProps } from './LocusChoiceSurface';
export {
  LOCUS_CHOICE_CANCEL_ACTION,
  LOCUS_CHOICE_CANCEL_TEST_ID,
  LOCUS_CHOICE_TEST_ID,
  LOCUS_CHOICE_UNAVAILABLE_LABEL,
  LocusChoiceSurface,
} from './LocusChoiceSurface';
