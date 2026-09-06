/**
 * T-06 — the temporal motion contract, decided in plain arithmetic before any animation exists.
 *
 * Motion here explains Product truth. It never carries it. This module is deliberately pure and
 * import-free of the store, the commit boundary, the preview controller and the animation library:
 * it takes numbers describing what is already true and returns numbers describing how to show it.
 * It cannot dispatch, cannot commit, cannot cancel and cannot reach canonical state, so no motion
 * decision can become a Product decision by accident.
 *
 * ## What survived the gate, and what did not
 *
 * Rejected — presentation scrolling, window movement, refine and widen. Hundreds of interactions a
 * day, and animating them would blur presentation movement into temporal traversal, which is a
 * frozen distinction. They stay exactly as unanimated as T-05 built them.
 *
 * Rejected — cross-fading the Map across a committed temporal move. A cross-fade keeps the old
 * projection's pixels on screen while the new position is already committed, which is stale `V`
 * presented as current. The Map's handoff is therefore not animated at all: it empties immediately,
 * as its own layer already decides, and orientation is carried by the temporal cursor instead.
 *
 * Rejected — a camera fly-to on a composite locate. Camera motion is not this task's authority.
 *
 * Rejected — a repeating "live pulse" as the Live/Pinned distinction. An infinite repeat does not
 * start at all under reduced motion, so it could never be the distinction; and as reinforcement it
 * is decoration on a dense functional surface. The distinction is `temporalStance`, which is derived
 * from the temporal MODE alone and is completely independent of motion.
 *
 * Rejected — any ghost, trail, echo or interpolation between two historical states. There is no
 * truthful in-between: the states are different disclosures, not different positions of one thing.
 *
 * Kept — four, all under 300ms:
 *
 *   M1 cursor retarget      state indication / preventing a jarring change. The cursor would
 *                           otherwise teleport per discrete step, and a held continuation would
 *                           read as a stutter rather than as travel. Retargets rather than
 *                           restarting, so rapid repeats glide instead of jerking.
 *   M2 commit settle        feedback, played AFTER the store has already answered. It acknowledges
 *                           a transaction that has already happened; it never gates one.
 *   M3 cancel return        spatial consistency. The preview leaves along the path it arrived by,
 *                           critically damped so it cannot overshoot past committed truth and
 *                           momentarily suggest a position nobody is at.
 *   M4 preview presence     preview-versus-commit legibility. A preview marker is never rendered at
 *                           full committed weight, so a preview frame cannot be mistaken for truth.
 *
 * ## The rules the numbers encode
 *
 *   - while a finger is down the cursor tracks it 1:1 with NO easing. Easing a direct manipulation
 *     is lag, and lag on a scrub reads as the interface disagreeing with the finger;
 *   - reduced motion sets every duration to zero. Same targets, same preview, same commit, same
 *     cancellation, same Map truth, same Live/Pinned distinction — only the transition changes;
 *   - the commit settle is skipped entirely under reduced motion rather than compressed into a
 *     flash, and nothing depends on it having played.
 */

/** Strong ease-out, as bezier control points. Entering, exiting and retargeting all use it. */
export const EASE_OUT_BEZIER = Object.freeze([0.23, 1, 0.32, 1] as const);

export const TEMPORAL_MOTION_DURATIONS = Object.freeze({
  /** M1 — one discrete retarget of the cursor. */
  cursorMs: 140,
  /** M4 — preview marker appearing or leaving. */
  presenceMs: 160,
  /** M2 — the acknowledgement of a commit that has already been applied. */
  commitSettleMs: 200,
  /** M3 — the return to committed truth after a cancellation. */
  cancelMs: 240,
});

/** Critically damped: settles as fast as a spring can without ever overshooting. */
export const CANCEL_DAMPING_RATIO = 1;

/** The extra scale the commit acknowledgement reaches. Never a scale from zero. */
export const COMMIT_SETTLE_SCALE = 0.06;

export interface TemporalMotionInput {
  /** Effective committed `TC`, or `null` before the first mirrored Moment. */
  readonly committedSp: number | null;
  /** `PTC`, or `null` when no preview exists. */
  readonly previewSp: number | null;
  readonly mode: 'FOLLOW_LIVE' | 'PINNED';
  /** True only while a finger is actually down on the temporal surface. */
  readonly dragging: boolean;
  readonly reducedMotion: boolean;
}

/**
 * How the temporal surface should present itself. Every field is presentation; not one of them is
 * consulted by any commit, cancellation, entitlement or addressability decision.
 */
export interface TemporalMotionPlan {
  /** Where the cursor should rest. The preview target when one exists, otherwise committed truth. */
  readonly cursorSp: number | null;
  /** Where committed truth is. Always drawn, and never moved by a preview. */
  readonly committedSp: number | null;
  /** Whether a preview marker exists at all. */
  readonly previewPresent: boolean;
  /**
   * The static, motion-independent statement of the temporal mode. `PINNED(LH)` and `FOLLOW_LIVE`
   * differ here even when the effective `TC` is the same Session Position, and they keep differing
   * with motion frozen, with reduced motion on, and in the accessible tree.
   */
  readonly temporalStance: 'FOLLOWING_LIVE' | 'PINNED_TO_MOMENT';
  readonly cursorMs: number;
  readonly presenceMs: number;
  readonly cancelMs: number;
  /** Zero means the acknowledgement is skipped, not compressed. */
  readonly commitSettleMs: number;
}

export function temporalMotionPlan(input: TemporalMotionInput): TemporalMotionPlan {
  const reduced = input.reducedMotion === true;
  // A finger on the surface is direct manipulation, not an animation: any duration at all is lag.
  const tracking = input.dragging === true;
  return Object.freeze({
    cursorSp: input.previewSp ?? input.committedSp,
    committedSp: input.committedSp,
    previewPresent: input.previewSp !== null,
    temporalStance: input.mode === 'FOLLOW_LIVE' ? 'FOLLOWING_LIVE' : 'PINNED_TO_MOMENT',
    cursorMs: reduced || tracking ? 0 : TEMPORAL_MOTION_DURATIONS.cursorMs,
    // Reduced motion means fewer and GENTLER, not none. Everything that MOVES goes to zero; the
    // preview marker's opacity does not, because a preview appearing and leaving is a state change
    // that still needs a bridge, and an opacity change is not movement. Removing it would make the
    // preview blink in and out — a harsher transition, not a calmer one.
    presenceMs: TEMPORAL_MOTION_DURATIONS.presenceMs,
    cancelMs: reduced ? 0 : TEMPORAL_MOTION_DURATIONS.cancelMs,
    commitSettleMs: reduced ? 0 : TEMPORAL_MOTION_DURATIONS.commitSettleMs,
  });
}

/**
 * The centre of a disclosed Session Position in the TRACK's own coordinate space, in layout points.
 *
 * Deliberately independent of the presentation window (R1-MOTION-01). Where a Moment sits on the
 * Track changes only when the Moment changes; where the window sits changes on every scroll frame,
 * and scrolling is a hundreds-of-times-a-day action that must not animate at all. Keeping the two
 * apart lets the marker EASE when its Moment changes and track the scroll instantly.
 */
export function trackOffsetFor(sp: number | null, stepWidth: number): number | null {
  if (sp === null || !Number.isFinite(sp) || !Number.isFinite(stepWidth)) return null;
  return (sp - 1) * stepWidth + stepWidth / 2;
}

export interface TemporalMotionGeometry {
  /** T-05's invariant disclosed step, in layout points. */
  readonly stepWidth: number;
  /** The presentation window's own offset. Presentation geometry, never a temporal quantity. */
  readonly windowOffset: number;
}

/**
 * The centre of a disclosed Session Position within the presentation window, in layout points.
 *
 * This is presentation arithmetic over T-05's invariant ordinal geometry, and it is the ONLY place
 * a Session Position becomes a coordinate. It never runs backwards: nothing in this layer turns a
 * coordinate into a temporal position except the disclosed-target hit test, which asks T-05.
 */
export function cursorOffsetFor(sp: number | null, geometry: TemporalMotionGeometry): number | null {
  const track = trackOffsetFor(sp, geometry.stepWidth);
  if (track === null || !Number.isFinite(geometry.windowOffset)) return null;
  return track - geometry.windowOffset;
}
