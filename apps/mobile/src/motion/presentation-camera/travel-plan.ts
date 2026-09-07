/**
 * T-10 — how a residual is resolved, decided in plain arithmetic before any animation exists.
 *
 * The split this file encodes is the production rule of the whole task, the SCENE TRUTH CUT /
 * CAMERA CONTINUITY split:
 *
 *   semantic membership switches to the current authorized `V` IMMEDIATELY — that is not decided
 *   here, and it is not decided by any animation, because there is no exit path anywhere in this
 *   layer to decide it with;
 *
 *   the CAMERA may travel continuously from the prior visible viewpoint to the already-authorized
 *   canonical destination, and this file says how long that takes and with what character.
 *
 * Nothing here is authority. The camera has already landed in canonical state before a plan is
 * ever asked for; a plan describes the path, never the destination, and a plan that never
 * completes changes nothing about where the reader is.
 */
import {
  ACT_DAMPING_RATIO,
  MOTION_DURATIONS_MS,
  REST_EPSILON_POINTS,
  REST_EPSILON_ZOOM,
  travelDurationMs,
} from '../tokens';
import { residualTravelPoints, residualZoomDistance, type PresentationResidual } from './residual';

/**
 * Why the canonical camera moved, as far as PRESENTATION is concerned.
 *
 * Exactly one cause exists, and it exists only because one frozen Product act is a composite whose
 * two halves are different truths (§8: Go Live + Locate). Every other act is choreographed from
 * what actually changed — camera, depth, or neither — which is a reading of canonical state rather
 * than a claim about intent. A cause is never required for correctness: absent one, the plan is
 * simply the plain one.
 */
export type PresentationMotionCause = 'GO_LIVE_AND_LOCATE';

export type PresentationTravelKind =
  /** The glass already shows the canonical camera. Nothing to resolve, nothing to animate. */
  | 'AT_REST'
  /** Continuous travel through the same world, from here to the authorized destination. */
  | 'TRAVEL'
  /**
   * The residual is dropped and the destination resolves in place.
   *
   * TWO causes only, and neither is a preference. Reduced motion, where large x/y/z travel is the
   * thing being removed; and a destination that is not finitely representable from the previous
   * camera, where there is no continuous path to show and pretending otherwise would be a fiction.
   * A long flight across the same world is NOT one of them: a cut there is a fade-teleport.
   */
  | 'CUT_AND_RESOLVE';

export interface PresentationTravelPlan {
  readonly kind: PresentationTravelKind;
  /** How long the plane takes to reach the authorized position. */
  readonly translationMs: number;
  /** How long the frozen geometric reinforcement takes to reach the authorized rung. */
  readonly zoomMs: number;
  /** How far the reinforcement may lag the disclosure it explains. `0`…`60` ms, never more. */
  readonly zoomDelayMs: number;
  /** The explanatory beat before the spatial half of a composite act. */
  readonly spatialDelayMs: number;
  /** The local opacity resolve that replaces travel when there is no continuous path. */
  readonly resolveMs: number;
  /** Always `1`: an act-driven motion may never overshoot the position it was authorized to reach. */
  readonly dampingRatio: number;
}

export interface PresentationTravelInput {
  /** The residual immediately AFTER the rebase: what is left between the glass and canonical truth. */
  readonly residual: PresentationResidual;
  /** The viewport diagonal in points, so a travel is measured against the screen it crosses. */
  readonly viewportDiagonalPoints: number;
  /**
   * Whether the destination was finitely representable from the previous camera.
   *
   * `false` is a technical answer about the projection, never a semantic one about the world.
   */
  readonly representable: boolean;
  readonly reducedMotion: boolean;
  /** Whether the semantic rung itself changed, so the reinforcement is explaining a disclosure. */
  readonly depthChanged: boolean;
  readonly cause: PresentationMotionCause | null;
}

const AT_REST_PLAN: PresentationTravelPlan = Object.freeze({
  kind: 'AT_REST',
  translationMs: 0,
  zoomMs: 0,
  zoomDelayMs: 0,
  spatialDelayMs: 0,
  resolveMs: 0,
  dampingRatio: ACT_DAMPING_RATIO,
});

/** Whether a residual is close enough to canonical truth that resolving it would show nothing. */
export function residualIsAtRest(residual: PresentationResidual): boolean {
  'worklet';
  return residualTravelPoints(residual) < REST_EPSILON_POINTS && residualZoomDistance(residual) < REST_EPSILON_ZOOM;
}

export function presentationTravelPlan(input: PresentationTravelInput): PresentationTravelPlan {
  // R3-03 — representability is asked FIRST, because "the residual is at rest" means two completely
  // different things.
  //
  // For a representable change it means the glass already shows canonical truth: the ordinary result
  // of a completed drag, whose committed translation IS the residual. Nothing to resolve, nothing to
  // animate.
  //
  // For an UNREPRESENTABLE one it means the opposite — the residual was set to rest because there is
  // no continuous path to preserve, not because the frame is correct. Letting the rest test answer
  // first returned `AT_REST` for exactly that case, so the world changed viewpoint with no travel,
  // no dip and no resolve at all: a bare cut, uncovered. The cut is legitimate there; showing it
  // without the resolve that explains it is not.
  if (input.representable && residualIsAtRest(input.residual)) return AT_REST_PLAN;

  // The composite beat is the only thing a cause changes, and it changes only WHEN the spatial
  // half starts being shown. The act itself completed before this function was called.
  //
  // R3-03: an UNREPRESENTABLE destination earns no beat, ever. A beat is a held frame — the world
  // stays where it looks, so the second truth reads as a consequence of the first — and when the
  // destination is not finitely representable there is no frame to hold: the residual has nothing
  // to preserve and the cut is the whole transition. Delaying the dip there would expose the cut at
  // full weight and explain it 110 ms afterwards, which is the teleport the North Star forbids.
  // Reduced motion is a different case and keeps its beat: the residual there IS representable, so
  // the beat holds a true preserved frame and the cut still lands under the dip that covers it.
  const spatialDelayMs =
    input.cause === 'GO_LIVE_AND_LOCATE' && input.representable ? MOTION_DURATIONS_MS.compositeSpatialBeat : 0;

  if (input.reducedMotion || !input.representable) {
    // Same act, same destination, same visibility, same availability, same copy — only the
    // transition changes. The opacity resolve is not movement, so it survives reduced motion for
    // the same reason T-06's preview presence does: removing it would make the world BLINK, which
    // is a harsher transition, not a calmer one.
    return Object.freeze({
      kind: 'CUT_AND_RESOLVE',
      translationMs: 0,
      zoomMs: 0,
      zoomDelayMs: 0,
      spatialDelayMs,
      resolveMs: MOTION_DURATIONS_MS.reducedResolve,
      dampingRatio: ACT_DAMPING_RATIO,
    });
  }

  const distance = residualTravelPoints(input.residual);
  const travels = distance >= REST_EPSILON_POINTS;
  const reinforces = residualZoomDistance(input.residual) >= REST_EPSILON_ZOOM;

  return Object.freeze({
    kind: 'TRAVEL',
    translationMs: travels ? travelDurationMs(distance, input.viewportDiagonalPoints) : 0,
    // A depth step's reinforcement is a consequence of a disclosure, so it is bounded by the
    // disclosure budget rather than by the travel budget: it is state indication, not a flight.
    zoomMs: reinforces ? (input.depthChanged ? MOTION_DURATIONS_MS.disclosureReinforcement : MOTION_DURATIONS_MS.localResolve) : 0,
    // Disclosure leads; the geometry follows it, or starts with it. Never the other way round —
    // reinforcement that arrives first is an optical zoom that the meaning then catches up to.
    zoomDelayMs: input.depthChanged ? MOTION_DURATIONS_MS.disclosureReinforcementDelay : 0,
    spatialDelayMs,
    resolveMs: 0,
    dampingRatio: ACT_DAMPING_RATIO,
  });
}
