/**
 * T-10 — the Product motion vocabulary, in plain arithmetic.
 *
 * The Motion North Star is **nothing teleports, meaning resolves**. Everything below exists to
 * serve that sentence and nothing else: there is no profile system, no per-direction personality
 * and no universal duration. Six named roles, each with its own band, each justified by the
 * frequency of the moment it explains:
 *
 *   M0 direct manipulation   a finger on the Map or the Timeline. ZERO easing, 1:1, UI runtime.
 *   M1 acknowledgement       a control answering a press. Immediate; a state swap, not a motion.
 *   M2 temporal resolve      a committed temporal change. Local, frequent, ~120–200 ms.
 *   M3 semantic disclosure   NEW analytical detail becoming legitimate. ≤260 ms, reinforced ≤320.
 *   M4 spatial travel        an already-authorized camera landing. 260–380 ms, exceptional ≤560.
 *   M5 Meaning Ignition      the ONE rare hero cue — absent in v1 (no authoritative trigger).
 *
 * This module imports nothing. It cannot dispatch, cannot read canonical state, cannot decide what
 * exists and cannot decide where the camera lands: it returns numbers describing how a change that
 * is ALREADY true should be shown. Every value here is a tuning bound, never a target to maximise
 * — the shortest honest duration always wins.
 */

/**
 * The one QANDEEL easing curve, as bezier control points: a strong ease-out.
 *
 * One curve, deliberately. A second curve would be a second personality on a surface whose whole
 * claim is that it behaves the same way everywhere. It is never `ease-in`: a slow start delays the
 * exact moment the reader is watching, and on an analysis surface that reads as the interface
 * disagreeing with the act. It is the same curve T-06 already uses, so the world and the Timeline
 * cannot drift apart.
 */
export const QANDEEL_EASE_OUT = Object.freeze([0.23, 1, 0.32, 1] as const);

/**
 * Critical damping for every act-driven motion.
 *
 * A Product act has no finger on it, so there is no momentum to carry and nothing to overshoot
 * for. `dampingRatio < 1` would draw the camera, a rung or an arrival momentarily past a position
 * nobody authorized — a one-frame lie about where the reader is. `1` settles as fast as a spring
 * can without ever crossing its destination.
 */
export const ACT_DAMPING_RATIO = 1;

/**
 * Where a newly disclosed object starts its local resolve.
 *
 * Never zero, and never near it: nothing in the world appears from nothing, and an object that
 * grows from a point reads as a thing being CREATED rather than as meaning becoming legible. At
 * `0.92` the object is already itself before it finishes arriving.
 */
export const DISCLOSURE_ENTRY_SCALE = 0.92;

/**
 * Rest, in presentation points.
 *
 * T-04 captures a gesture translation at 1/1024 of a point, so a residual below that is not a
 * position the reader could have expressed. Treating it as rest is what stops an idle plane from
 * repainting forever chasing an epsilon it never reaches.
 */
export const REST_EPSILON_POINTS = 1 / 1024;

/** A residual scale this close to `1` is rest: the plane is showing the canonical camera exactly. */
export const REST_EPSILON_ZOOM = 1e-6;

/**
 * Where the plane's opacity starts when there is no continuous path to show.
 *
 * The world does not disappear and come back — it resolves. Deep enough to say that something
 * happened, nowhere near a flash, and opacity only: under reduced motion this is the ONE thing
 * left explaining that the reader went somewhere, so it may not itself be movement.
 */
export const REDUCED_RESOLVE_FROM_OPACITY = 0.45;

/**
 * Where a cut-and-resolve starts, given the weight already on the glass.
 *
 * It RETARGETS rather than restarts. A second act landing while a resolve is still running
 * continues from where the plane actually is; re-seeding the dip would drop it back down and read
 * as a blink — the restart-from-zero failure that makes a sequence the wrong tool for anything
 * that can be triggered twice quickly.
 */
export function resolveFromOpacity(shownOpacity: number): number {
  'worklet';
  if (!Number.isFinite(shownOpacity)) return REDUCED_RESOLVE_FROM_OPACITY;
  return shownOpacity >= 1 ? REDUCED_RESOLVE_FROM_OPACITY : shownOpacity;
}

export const MOTION_DURATIONS_MS = Object.freeze({
  /** M0 — a finger owns the frame. Any duration at all is lag. */
  directManipulation: 0,
  /** M2 — a frequent local resolve: a temporal arrival, a cancelled drag returning to truth. */
  localResolve: 160,
  /** M3 — newly disclosed analytical detail resolving into legitimacy. */
  disclosure: 220,
  /**
   * M3 — the frozen geometric reinforcement, overlapping the disclosure it explains.
   *
   * The lead below and this duration are ONE budget: the reinforcement must be finished by 320 ms
   * from the act, not 320 ms from whenever it happened to start. A depth step that took 360 ms
   * because the lead was added on top would be over budget for a reason no reader can see.
   */
  disclosureReinforcement: 260,
  /**
   * M3 — how long the reinforcement may lag the disclosure. Zero is allowed; more is not.
   *
   * Meaning leads geometry, or they start together. Never the other way round: a reinforcement
   * that arrives first is an optical zoom that the meaning then catches up to.
   */
  disclosureReinforcementDelay: 60,
  /** M4 — a short landing inside one screen. */
  travelMin: 260,
  /** M4 — a landing about one viewport away. */
  travelMax: 380,
  /** M4 — the exceptional long flight across the same world. A ceiling, never a target. */
  travelLongMax: 540,
  /** Reduced motion — the local opacity resolve that replaces travel. Not movement. */
  reducedResolve: 140,
  /**
   * The explanatory beat between the two halves of Go Live + Locate.
   *
   * ONE Product transaction, two truths: the reader is Live, and this is where the thing is. The
   * beat is what makes the second readable as a consequence of the first rather than as noise
   * inside one jump. It delays no authorization and blocks no input — the act is already done.
   */
  compositeSpatialBeat: 110,
});

/**
 * How far a travel may be, in viewport diagonals, before it stops being a short landing.
 *
 * Beyond this the duration keeps growing toward the long-flight ceiling — it never becomes a cut.
 * A cut across the same world is a fade-teleport, and the North Star forbids it in standard motion.
 */
export const TRAVEL_LONG_FLIGHT_DIAGONALS = 1;

/** How many further diagonals it takes to reach the long-flight ceiling. */
export const TRAVEL_CEILING_DIAGONALS = 3;

/**
 * The duration of one camera travel, from the distance it actually has to cover.
 *
 * Distance-responsive rather than fixed, because a 40-point landing and a 2000-point flight are
 * not the same event and giving them one duration makes the first feel slow and the second feel
 * instantaneous. Monotonic, continuous and capped: no distance can produce a longer travel than
 * `travelLongMax`, so a far Home cannot turn into a cinematic sequence.
 */
export function travelDurationMs(distancePoints: number, viewportDiagonalPoints: number): number {
  const { travelMin, travelMax, travelLongMax } = MOTION_DURATIONS_MS;
  if (!Number.isFinite(distancePoints) || !Number.isFinite(viewportDiagonalPoints) || viewportDiagonalPoints <= 0) {
    return travelMin;
  }
  const spans = Math.abs(distancePoints) / viewportDiagonalPoints;
  if (spans <= TRAVEL_LONG_FLIGHT_DIAGONALS) {
    return Math.round(travelMin + (travelMax - travelMin) * (spans / TRAVEL_LONG_FLIGHT_DIAGONALS));
  }
  const beyond = Math.min(1, (spans - TRAVEL_LONG_FLIGHT_DIAGONALS) / TRAVEL_CEILING_DIAGONALS);
  return Math.round(travelMax + (travelLongMax - travelMax) * beyond);
}
