/**
 * T-06 — Temporal Navigation Layer: the interaction and substrate around the frozen temporal
 * primitives, and nothing more.
 *
 * The canonical state kernel stays the only authority. `COMMIT_MOMENT` and `COMMIT_LIVE_EDGE`
 * remain T-02's, unreplaced and unwrapped; this layer decides WHEN to call them, from an explicit
 * user act, and owns everything around that moment: the ephemeral preview, its cancellation,
 * relative forward continuation, the bridge from T-05's disclosed presentation, the composite
 * temporal-and-locate act, the contextual-locus choice, the motion that explains all of it, and the
 * accessible routes that reach every one of them without a drag.
 *
 * Layer order, and the reason each boundary exists:
 *
 *   `outcome`               one typed answer per act, so a surface never catches an exception;
 *   `targeting`             canonical addressability AND the narrower disclosed interaction gate,
 *                           the single commit boundary, and the two promoted acts behind their own
 *                           runtime authority;
 *   `preview`               `PTC` as Class C, and the explicitly bounded projection it may present;
 *   `continuation`          repeated forward targeting that holds at the disclosure horizon and at
 *                           `LH` alike, and commits nothing;
 *   `locus-choice`          the pending contextual-locus choice and its user-facing route;
 *   `timeline-integration`  disclosed target → temporal intent, one way only, with per-gesture
 *                           interaction ownership over reordered cross-runtime callbacks;
 *   `motion`                the motion contract in plain arithmetic, then its Reanimated binding;
 *   `accessibility`         the same capabilities without a drag or a precision pointer.
 *
 * What this layer does NOT do: it stores no canonical field, adds no second temporal cursor, keeps
 * no `PTC` in `CanonicalState`, persists nothing, fetches nothing, gives T-05 any store authority,
 * gives the Map any temporal authority, implements any T-07 return act, or lets an animation frame,
 * an animation completion, a gesture position, a scroll offset or a duration become Product truth.
 */
export type { TemporalOutcome, TemporalRejectionCode } from './outcome';
export { dispatchAuthorizedTemporalAction, dispatchKernelCommit, temporalRejected } from './outcome';

export * from './targeting';
export * from './preview';
export * from './continuation';
export * from './locus-choice';
export * from './motion';
export * from './accessibility';
export * from './timeline-integration';
