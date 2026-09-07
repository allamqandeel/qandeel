/**
 * T-10 R1 — presentation culling: what the reader can actually SEE while the camera travels.
 *
 * Semantic membership and paint culling are different facts, and conflating them is what the
 * independent review caught. An object is absent because the current `V` excludes it — that is
 * semantics, it is immediate, and nothing here can soften it. An object is unpainted because it is
 * off the glass — that is culling, it is a performance decision, and it states nothing at all about
 * the world.
 *
 * Culling against the FINAL canonical viewport is wrong during travel. A Home that was on screen
 * before a long landing, is still in current `V`, and happens to end up outside the destination
 * viewport would vanish in the first rebased frame — not because it left the world, but because a
 * viewport it has not reached yet does not contain it. The reader would see the exact teleport the
 * rebase exists to prevent.
 *
 * So culling follows the PRESENTED viewport: an object is a paint candidate while the travel could
 * still put it on the glass. The test is deliberately conservative — the bounding box of where the
 * object starts and where it ends, grown by its own radius and the cull margin — so it is a strict
 * superset of the resting test and degenerates to exactly the resting test when nothing is
 * travelling.
 */
import { residualToScreen, type PresentationPoint, type PresentationResidual } from './residual';

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
 * Whether an object placed under the CURRENT canonical camera can be on the glass at any point of
 * the travel that started from `startResidual`.
 *
 * `startResidual` is the residual armed when the canonical camera last changed — identity when the
 * plane is at rest, in which case this is the resting viewport test and nothing extra is painted.
 */
export function isPresentedDuringTravel(
  candidate: PresentedCandidate,
  startResidual: PresentationResidual,
  center: PresentationPoint,
  viewport: PresentedViewport,
  cullMarginPoints: number,
): boolean {
  const start = residualToScreen({ x: candidate.x, y: candidate.y }, startResidual, center);
  if (!Number.isFinite(start.x) || !Number.isFinite(start.y)) return true;
  const margin = candidate.radius + cullMarginPoints;
  const minX = Math.min(start.x, candidate.x) - margin;
  const maxX = Math.max(start.x, candidate.x) + margin;
  const minY = Math.min(start.y, candidate.y) - margin;
  const maxY = Math.max(start.y, candidate.y) + margin;
  return maxX >= 0 && minX <= viewport.width && maxY >= 0 && minY <= viewport.height;
}
