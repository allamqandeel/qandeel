/**
 * T-10 — presentation culling: what the reader can actually SEE while the camera is in motion.
 *
 * Semantic membership and paint culling are different facts, and conflating them is what the first
 * independent review caught. An object is absent because the current `V` excludes it — that is
 * semantics, it is immediate, and nothing here can soften it. An object is unpainted because it is
 * off the glass — that is culling, it is a performance decision, and it states nothing at all about
 * the world.
 *
 * Culling against the FINAL canonical viewport is wrong during motion. A Home that was on screen
 * before a long landing, is still in current `V`, and happens to end up outside the destination
 * viewport would vanish in the first rebased frame — not because it left the world, but because a
 * viewport it has not reached yet does not contain it. The reader would see the exact teleport the
 * rebase exists to prevent.
 *
 * ## R3 — why an endpoint box is not a proof
 *
 * R1 bounded a candidate by the box between where it starts and where it ends, and argued that
 * critical damping keeps that box honest. That argument does not hold. The screen position is
 *
 *     screen(p) = c + zoom(s) · (p + t(s) − c)
 *
 * and `zoom` and `t` are INDEPENDENT animations: different durations, different delays, and a
 * reinforcement that may lead or lag its translation. A product of two independently progressing
 * values can reach a screen-space extremum that neither endpoint represents, so monotonicity of
 * each factor proves nothing about the product's range. Sampling frames would not prove it either.
 *
 * So this module stops reasoning about paths and reasons about RANGES. It carries a residual
 * ENVELOPE — an interval per component — and evaluates the screen position by interval arithmetic:
 *
 *     screen.x ∈ c.x + [zoomMin, zoomMax] · ((p.x − c.x) + [txMin, txMax])
 *
 * The result contains every position reachable by ANY assignment of the components within their
 * ranges, which is a strict superset of every position reachable by the actual coupled animation,
 * whatever its timing. That is a bound rather than an observation, and it needs nothing to be true
 * about how the two animations progress.
 *
 * At rest the envelope is degenerate — `[0,0]`, `[0,0]`, `[1,1]` — and the interval product
 * collapses to the point `p` itself, so this is EXACTLY the resting viewport test and a still world
 * paints what it always painted. The envelope is retired back to that degenerate state when the
 * presentation actually reaches rest, so a travel corridor cannot outlive the travel that opened it.
 */
import { RESIDUAL_AT_REST, type PresentationPoint, type PresentationResidual } from './residual';

export interface PresentedCandidate {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
}

export interface PresentedViewport {
  readonly width: number;
  readonly height: number;
}

/**
 * The set of residuals the plane may be showing right now, as one interval per component.
 *
 * Not a path and not a prediction: a containment claim. Everything that reads it only ever needs
 * "could the plane be showing this", and a superset answers that safely.
 */
export interface PresentationResidualEnvelope {
  readonly txMin: number;
  readonly txMax: number;
  readonly tyMin: number;
  readonly tyMax: number;
  readonly zoomMin: number;
  readonly zoomMax: number;
}

export const RESIDUAL_ENVELOPE_AT_REST: PresentationResidualEnvelope = Object.freeze({
  txMin: RESIDUAL_AT_REST.tx,
  txMax: RESIDUAL_AT_REST.tx,
  tyMin: RESIDUAL_AT_REST.ty,
  tyMax: RESIDUAL_AT_REST.ty,
  zoomMin: RESIDUAL_AT_REST.zoom,
  zoomMax: RESIDUAL_AT_REST.zoom,
});

/** One exact residual, as the envelope that contains only it. */
export function residualEnvelope(residual: PresentationResidual): PresentationResidualEnvelope {
  return Object.freeze({
    txMin: residual.tx,
    txMax: residual.tx,
    tyMin: residual.ty,
    tyMax: residual.ty,
    zoomMin: residual.zoom,
    zoomMax: residual.zoom,
  });
}

/** What the plane should tell the renderer when it has moved far enough to be worth saying. */
export interface PresentationAdvance {
  readonly residual: PresentationResidual;
  /** How far beyond that residual to paint, in the plane's own units. */
  readonly padPlaneUnits: number;
}

/**
 * Whether the plane has moved far enough since it last said so — and if it has, what to say.
 *
 * THE RULE, as an ordinary function. The reaction that calls it is a no-op in a test runtime by
 * design, so a rule living inside it would be a rule nobody could check; every decision therefore
 * lives here and the reaction is only the glue that decides WHEN, on the UI runtime, where no Product
 * rule belongs. It is the same separation the scrub already uses.
 *
 * The distance is measured on the GLASS, because that is what the reader sees and what a cull margin
 * is expressed in: a residual translation moves the glass by `zoom · t`, and a residual zoom moves it
 * by roughly the viewport diagonal times the scale change. Both count, so one rule serves a drag and
 * a travel alike.
 *
 * The pad is one budget PLUS the distance just covered. A slow drag therefore asks for the budget and
 * a fast flick asks for more — the band widens with the speed that made it necessary, with no velocity
 * estimate, no prediction and no second constant. `null` means the plane has not moved enough to be
 * worth a crossing, which at rest is every frame.
 */
export function presentationAdvance(
  residual: PresentationResidual,
  reported: PresentationResidual,
  diagonalPoints: number,
  advancePoints: number,
): PresentationAdvance | null {
  'worklet';
  if (!(advancePoints > 0) || !Number.isFinite(advancePoints)) return null;
  const scale = residual.zoom;
  const moved =
    Math.hypot((residual.tx - reported.tx) * scale, (residual.ty - reported.ty) * scale) +
    Math.abs(residual.zoom - reported.zoom) * (Number.isFinite(diagonalPoints) ? Math.abs(diagonalPoints) : 0);
  if (!Number.isFinite(moved) || moved < advancePoints) return null;
  const divisor = Math.abs(scale) < 1e-9 ? 1 : Math.abs(scale);
  return { residual, padPlaneUnits: (advancePoints + moved) / divisor };
}

/**
 * The same envelope with a margin of plane distance on every side of its translation.
 *
 * A travel declares its whole path at once, so its envelope is complete the moment it opens. A DRAG
 * does not: the plane is attached to a hand, nobody knows where it is going, and the corridor can
 * only ever describe where the hand has already been. Padding is what buys the time to find out —
 * the renderer paints a band beyond the last reported position, so the region the next fraction of a
 * second brings onto the glass has already been drawn when it arrives.
 *
 * It pads the translation only. The residual zoom is not a direction a hand travels in — a pinch
 * writes nothing per frame — and widening it would multiply the candidate set for no reader-visible
 * gain.
 */
export function expandedEnvelope(envelope: PresentationResidualEnvelope, padPlaneUnits: number): PresentationResidualEnvelope {
  const pad = Number.isFinite(padPlaneUnits) && padPlaneUnits > 0 ? padPlaneUnits : 0;
  return Object.freeze({
    txMin: envelope.txMin - pad,
    txMax: envelope.txMax + pad,
    tyMin: envelope.tyMin - pad,
    tyMax: envelope.tyMax + pad,
    zoomMin: envelope.zoomMin,
    zoomMax: envelope.zoomMax,
  });
}

/** The smallest envelope containing both. Used to add the destination — always rest — to a travel. */
export function envelopeHull(a: PresentationResidualEnvelope, b: PresentationResidualEnvelope): PresentationResidualEnvelope {
  return Object.freeze({
    txMin: Math.min(a.txMin, b.txMin),
    txMax: Math.max(a.txMax, b.txMax),
    tyMin: Math.min(a.tyMin, b.tyMin),
    tyMax: Math.max(a.tyMax, b.tyMax),
    zoomMin: Math.min(a.zoomMin, b.zoomMin),
    zoomMax: Math.max(a.zoomMax, b.zoomMax),
  });
}

/**
 * The envelope after an already-authorized canonical camera change, rebased exactly as one residual
 * would be.
 *
 * `rebasedResidual` is affine in the residual — `zoom' = zoom / k`, `t' = k · (t + d)` — with `k`
 * positive, so it maps an interval to an interval with no widening and no loss. That is what makes
 * a mid-flight retarget correct WITHOUT reading the live residual: whatever the plane is actually
 * showing lies inside the envelope, so its rebase lies inside the rebased envelope. Paint motion and
 * culling continuity therefore start from the same presentation state by construction, rather than
 * by one of them sampling a value the other only assumes (R3-02b).
 */
export function rebasedEnvelope(envelope: PresentationResidualEnvelope, k: number, d: PresentationPoint): PresentationResidualEnvelope {
  const factor = Number.isFinite(k) && k > 0 ? k : 1;
  const dx = Number.isFinite(d.x) ? d.x : 0;
  const dy = Number.isFinite(d.y) ? d.y : 0;
  return Object.freeze({
    txMin: factor * (envelope.txMin + dx),
    txMax: factor * (envelope.txMax + dx),
    tyMin: factor * (envelope.tyMin + dy),
    tyMax: factor * (envelope.tyMax + dy),
    zoomMin: envelope.zoomMin / factor,
    zoomMax: envelope.zoomMax / factor,
  });
}

/** The range of `a · b` over two intervals: every corner, because either may straddle zero. */
function intervalProduct(aMin: number, aMax: number, bMin: number, bMax: number): { min: number; max: number } {
  const corners = [aMin * bMin, aMin * bMax, aMax * bMin, aMax * bMax];
  return { min: Math.min(...corners), max: Math.max(...corners) };
}

/**
 * Whether an object placed under the CURRENT canonical camera can be on the glass under ANY residual
 * the envelope contains.
 *
 * Conservative by construction: it answers for the whole range at once, so no assumption about the
 * order, duration, delay or coupling of the translation and the reinforcement can make it wrong.
 */
export function isPresentedWithinEnvelope(
  candidate: PresentedCandidate,
  envelope: PresentationResidualEnvelope,
  center: PresentationPoint,
  viewport: PresentedViewport,
  cullMarginPoints: number,
): boolean {
  const ax = candidate.x - center.x;
  const ay = candidate.y - center.y;
  const x = intervalProduct(envelope.zoomMin, envelope.zoomMax, ax + envelope.txMin, ax + envelope.txMax);
  const y = intervalProduct(envelope.zoomMin, envelope.zoomMax, ay + envelope.tyMin, ay + envelope.tyMax);
  // A non-finite bound is not a claim that the object is off the glass, so it is never culled on one.
  if (!Number.isFinite(x.min) || !Number.isFinite(x.max) || !Number.isFinite(y.min) || !Number.isFinite(y.max)) return true;
  const margin = candidate.radius + cullMarginPoints;
  const minX = center.x + x.min - margin;
  const maxX = center.x + x.max + margin;
  const minY = center.y + y.min - margin;
  const maxY = center.y + y.max + margin;
  return maxX >= 0 && minX <= viewport.width && maxY >= 0 && minY <= viewport.height;
}
