/**
 * T-10.0 MOTION LAB — the three candidate motion directions as DATA.
 *
 * Nothing in this file is frozen. These are prototype evaluation profiles for the human Motion
 * North Star review (T-10.0 §7, §11, §12). Every number here is a hypothesis to look at, not a
 * production constant, and none of them is ever consulted by a Product decision: a profile only
 * decides how an already-committed canonical change is SHOWN.
 *
 * The three directions are meant to be genuinely different answers to the same brief, not three
 * presets of one system. Each one moves a different thing:
 *
 *   A  CONTINUOUS RESOLVE   the CAMERA. The world is a stable place; travel is one well-damped
 *                           slide; disclosure fades in place; nothing else moves.
 *   B  SEMANTIC UNFOLDING   DISCLOSURE. Deeper meaning unfolds from the locus that hosts it, in
 *                           order, and the camera only follows; a long travel is a resolve, not a
 *                           flight. "Meaning Ignition" gets its strongest test here.
 *   C  FIELD RESONANCE      the FIELD. Momentum is preserved, settles are springs with the hand's
 *                           velocity, nearby presentation responds a little to gesture energy.
 *
 * Reduced motion is an alternate choreography, never "motion off" (T-10.0 §12, P9): the same acts,
 * the same truth, the same destinations, with x/y/z travel replaced by short fades, no depth or
 * parallax simulation, no repeated peripheral motion, and direct gesture tracking kept.
 */

export type DirectionId = 'A' | 'B' | 'C';

export const DIRECTION_IDS: readonly DirectionId[] = Object.freeze(['A', 'B', 'C']);

/** A duration-based Reanimated spring, in the two designer parameters. */
export interface SpringSpec {
  readonly kind: 'spring';
  readonly durationMs: number;
  /** `1` is critically damped (no overshoot); below `1` overshoots. */
  readonly dampingRatio: number;
  /** Whether the release velocity of the hand is handed to the spring. */
  readonly carriesVelocity: boolean;
}

/** A duration-based ease-out timing. */
export interface TimingSpec {
  readonly kind: 'timing';
  readonly durationMs: number;
}

/** No transition: the value is set. Used by reduced motion for every x/y/z movement. */
export interface CutSpec {
  readonly kind: 'cut';
}

export type SettleSpec = SpringSpec | TimingSpec | CutSpec;

/** How a node that has just been disclosed arrives, and how one that stops being disclosed leaves. */
export interface PresenceRecipe {
  /**
   * `in-place`: opacity + a small size resolve where the node belongs (A);
   * `from-host`: the appearance slides out of the Home that hosts it (B / C);
   * `fade`: opacity only, no size, no travel (reduced motion).
   */
  readonly enter: 'in-place' | 'from-host' | 'fade';
  readonly enterMs: number;
  /** Ease-out timing or spring for the enter travel / size. */
  readonly enterSettle: SettleSpec;
  /** Delay between successive entering nodes, by disclosure ordinal. Zero means none. */
  readonly staggerMs: number;
  /** `instant` removes on the next frame; `fade` is opacity out; `to-host` folds back into the host. */
  readonly exit: 'instant' | 'fade' | 'to-host';
  readonly exitMs: number;
}

export interface MotionProfile {
  readonly id: DirectionId;
  readonly name: string;
  readonly premise: string;
  /** The single axis this direction diverges on. */
  readonly axis: string;
  readonly pan: {
    /** `withDecay` deceleration after release. Closer to `1` travels further. */
    readonly deceleration: number;
    /** A cancelled gesture returns the plane to canonical truth with this settle (nothing is committed). */
    readonly cancelSettle: SettleSpec;
  };
  /** Semantic Zoom: how the geometric reinforcement (×8 per rung) resolves toward the canonical scale. */
  readonly zoom: {
    readonly settle: SettleSpec;
    /** Delay before the camera reinforcement starts, so disclosure can lead (B). */
    readonly delayMs: number;
  };
  /** Camera travel toward a landed destination (Direct Jump, the locating returns, Back, Exact Return, World). */
  readonly travel: {
    readonly settle: SettleSpec;
    /** Extra duration per point of travel, capped by `maxMs`. */
    readonly msPerPoint: number;
    readonly maxMs: number;
    /**
     * Beyond this many viewport diagonals the travel is not flown at all: the world resolves at
     * the destination instead (B tests "meaning resolves" against "nothing teleports").
     */
    readonly resolveBeyondDiagonals: number | null;
    /** Opacity dip used by a resolve (and by reduced motion) instead of a flight. */
    readonly resolveMs: number;
  };
  /** Disclosure changes: a semantic depth step, an inspection landing. */
  readonly disclosure: PresenceRecipe;
  /** Temporal changes: a scrub preview, a committed Moment, a live advance, a temporal return. */
  readonly temporal: PresenceRecipe;
  /** Go Live + Locate: the temporal half resolves first; the conditional spatial half follows after this delay. */
  readonly goLiveSpatialDelayMs: number;
  /** Field response (C): how much node size follows camera velocity, and the arrival settle. */
  readonly field: {
    /** Fraction of size per 1000 pt/s of camera velocity. `0` disables. */
    readonly velocityBreath: number;
    /** Size bump on arrival after a travel; `0` disables. */
    readonly arrivalBreath: number;
  };
  /** Meaning Ignition (PROTOTYPE-ONLY hypothesis, T-10.0 §8 S5). */
  readonly ignition: {
    readonly style: 'ring' | 'bloom' | 'ripple';
    readonly durationMs: number;
    /** How far (in points) the ring expands over the cue; `0` keeps it an opacity-only ring (reduced motion). */
    readonly ringGrowthPoints: number;
    /** Ripple only: how far (in points) neighbouring nodes respond, and by how much. */
    readonly rippleRadiusPoints: number;
    readonly rippleBreath: number;
  };
  /** Exact Return: a brief arrival lock that says "exactly here", distinct from Back. */
  readonly exactReturnLockMs: number;
}

const spring = (durationMs: number, dampingRatio: number, carriesVelocity = false): SpringSpec => ({ kind: 'spring', durationMs, dampingRatio, carriesVelocity });
const timing = (durationMs: number): TimingSpec => ({ kind: 'timing', durationMs });
const CUT: CutSpec = Object.freeze({ kind: 'cut' });

export const DIRECTION_A: MotionProfile = Object.freeze<MotionProfile>({
  id: 'A',
  name: 'Continuous Resolve',
  premise: 'The world is stable; the camera and disclosure resolve naturally around it.',
  axis: 'Camera continuity: one well-damped slide, disclosure fades where it belongs, nothing decorative moves.',
  pan: { deceleration: 0.996, cancelSettle: spring(320, 1) },
  zoom: { settle: spring(460, 1), delayMs: 0 },
  travel: { settle: spring(380, 1), msPerPoint: 0.28, maxMs: 560, resolveBeyondDiagonals: null, resolveMs: 200 },
  disclosure: { enter: 'in-place', enterMs: 220, enterSettle: timing(220), staggerMs: 0, exit: 'fade', exitMs: 120 },
  temporal: { enter: 'in-place', enterMs: 160, enterSettle: timing(160), staggerMs: 0, exit: 'instant', exitMs: 0 },
  goLiveSpatialDelayMs: 140,
  field: { velocityBreath: 0, arrivalBreath: 0 },
  ignition: { style: 'ring', durationMs: 420, ringGrowthPoints: 16, rippleRadiusPoints: 0, rippleBreath: 0 },
  exactReturnLockMs: 240,
});

export const DIRECTION_B: MotionProfile = Object.freeze<MotionProfile>({
  id: 'B',
  name: 'Semantic Unfolding',
  premise: 'Movement is primarily the unfolding of meaning, not travel.',
  axis: 'Disclosure: detail unfolds from the locus that hosts it, in disclosure order; the camera follows meaning and never leads it.',
  pan: { deceleration: 0.993, cancelSettle: timing(260) },
  zoom: { settle: timing(300), delayMs: 90 },
  travel: { settle: timing(280), msPerPoint: 0.12, maxMs: 380, resolveBeyondDiagonals: 1.25, resolveMs: 240 },
  disclosure: { enter: 'from-host', enterMs: 220, enterSettle: timing(340), staggerMs: 36, exit: 'to-host', exitMs: 180 },
  temporal: { enter: 'from-host', enterMs: 180, enterSettle: timing(260), staggerMs: 28, exit: 'instant', exitMs: 0 },
  goLiveSpatialDelayMs: 260,
  field: { velocityBreath: 0, arrivalBreath: 0 },
  ignition: { style: 'bloom', durationMs: 560, ringGrowthPoints: 16, rippleRadiusPoints: 0, rippleBreath: 0 },
  exactReturnLockMs: 280,
});

export const DIRECTION_C: MotionProfile = Object.freeze<MotionProfile>({
  id: 'C',
  name: 'Field Resonance',
  premise: 'The Living Analysis Map behaves as a coherent spatial field with restrained physical resonance.',
  axis: 'The field: momentum preserved, springs carry the hand\'s velocity, nearby presentation responds a little to gesture energy.',
  pan: { deceleration: 0.998, cancelSettle: spring(360, 0.85, true) },
  zoom: { settle: spring(540, 0.86), delayMs: 0 },
  travel: { settle: spring(520, 0.82, true), msPerPoint: 0.18, maxMs: 640, resolveBeyondDiagonals: null, resolveMs: 200 },
  disclosure: { enter: 'from-host', enterMs: 180, enterSettle: spring(520, 0.72), staggerMs: 24, exit: 'to-host', exitMs: 220 },
  temporal: { enter: 'in-place', enterMs: 160, enterSettle: spring(420, 0.74), staggerMs: 0, exit: 'instant', exitMs: 0 },
  goLiveSpatialDelayMs: 80,
  field: { velocityBreath: 0.05, arrivalBreath: 0.06 },
  ignition: { style: 'ripple', durationMs: 520, ringGrowthPoints: 16, rippleRadiusPoints: 120, rippleBreath: 0.06 },
  exactReturnLockMs: 260,
});

/**
 * The reduced-motion choreography of a direction (P9, §12): same acts, same truth, same
 * destinations. Every x/y/z travel becomes a cut plus a short fade, no size resolve, no stagger,
 * no field response, and a shorter momentum after release. Direct gesture tracking is untouched.
 */
export function reducedMotionProfile(profile: MotionProfile): MotionProfile {
  return Object.freeze<MotionProfile>({
    ...profile,
    pan: { deceleration: 0.985, cancelSettle: CUT },
    zoom: { settle: CUT, delayMs: 0 },
    travel: { settle: CUT, msPerPoint: 0, maxMs: 0, resolveBeyondDiagonals: 0, resolveMs: 180 },
    disclosure: { enter: 'fade', enterMs: 140, enterSettle: CUT, staggerMs: 0, exit: 'instant', exitMs: 0 },
    temporal: { enter: 'fade', enterMs: 120, enterSettle: CUT, staggerMs: 0, exit: 'instant', exitMs: 0 },
    goLiveSpatialDelayMs: profile.goLiveSpatialDelayMs,
    field: { velocityBreath: 0, arrivalBreath: 0 },
    // Opacity only: the ring does not expand under reduced motion (§12: no movement that only
    // standard motion would carry; the cue is a fade, and it stays local).
    ignition: { style: 'ring', durationMs: 260, ringGrowthPoints: 0, rippleRadiusPoints: 0, rippleBreath: 0 },
    exactReturnLockMs: 0,
  });
}

export const DIRECTIONS: Readonly<Record<DirectionId, MotionProfile>> = Object.freeze({ A: DIRECTION_A, B: DIRECTION_B, C: DIRECTION_C });

export function motionProfile(id: DirectionId, reducedMotion: boolean): MotionProfile {
  const profile = DIRECTIONS[id];
  return reducedMotion ? reducedMotionProfile(profile) : profile;
}

/** Travel duration for a settle, from the distance the plane must move. */
export function travelDurationMs(profile: MotionProfile, distancePoints: number): number {
  const settle = profile.travel.settle;
  if (settle.kind === 'cut') return 0;
  return Math.min(profile.travel.maxMs, Math.round(settle.durationMs + profile.travel.msPerPoint * Math.max(0, distancePoints)));
}
