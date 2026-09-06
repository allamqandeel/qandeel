/**
 * T-07 — `RETURN_LIVE_HEAD` (P4): return to the Live Head, and nothing else.
 *
 * Frozen result:
 *
 *     TM := FOLLOW_LIVE
 *     effective TC := the authoritative current Live Head, by derivation
 *
 * `IF_ref`, `MC`, `LH` and `LF` are all preserved directly. Historical projection re-resolves only
 * because the effective `TC` changed; this act itself moves no camera and inspects nothing, which is
 * exactly why its frozen authority is `TM` alone.
 *
 * ## Effectiveness, and the passive-event trap it avoids
 *
 * When the reader is historical the act is effective and appends exactly ONE checkpoint capturing
 * the complete pre-act historical viewpoint — so one Back afterwards restores that exact position,
 * inspection, camera and depth.
 *
 * When the reader is already following Live it is a true no-op and records nothing. That answer is
 * derived by the store from `Φ_eff` over the SAME live truth on both sides of the transition, so a
 * Live Head that advances while the act is in flight cannot be attributed to it: there is no
 * "activation snapshot" here to compare against a later "settled global state", and this module
 * therefore has no way to turn a passive advance into an action-attributable transaction.
 */
import { committedReturn, type ReturnSurface } from './surface';
import { runReturnPlan } from './authority';
import { withNoOpReason, type ReturnOutcome } from './outcomes';

export function returnLiveHead(surface: ReturnSurface): ReturnOutcome {
  return committedReturn(surface, (store) => withNoOpReason(runReturnPlan(store, { act: 'RETURN_LIVE_HEAD' }), 'ALREADY_FOLLOWING_LIVE'));
}
