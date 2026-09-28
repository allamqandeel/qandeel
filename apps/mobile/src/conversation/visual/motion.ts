/**
 * W1A-01 — the one motion quantity at the Conversation ↔ Analysis boundary.
 *
 * The G3 canonical closure (`docs/design/i-08b3.1-g3/QANDEEL_G3_CANONICAL_CLOSURE.md`) applies F2's appearance-switch semantics to this boundary: a SYMMETRIC cross-fade
 * (`qandeel.appearance.switch.crossfade`, 200 ms, a production-default / device-tunable craft value)
 * that is not a meaning event, and under Reduced Motion no cross-fade at all
 * (`qandeel.appearance.switch.crossfade-reduced-motion`, 0 ms). Both values are read from the F2
 * token file by the generator; neither is typed here.
 */
import { CANONICAL_VISUAL } from './canonical-visual.generated';

export const DEPTH_CROSSFADE_MS: number = CANONICAL_VISUAL.crossfadeMs;
export const DEPTH_CROSSFADE_REDUCED_MOTION_MS: number = CANONICAL_VISUAL.crossfadeReducedMotionMs;
