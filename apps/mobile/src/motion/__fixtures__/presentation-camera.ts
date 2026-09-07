/**
 * T-10 — a recording stand-in for the presentation camera, for tests that exercise a SURFACE
 * rather than the binding itself.
 *
 * It records what it was asked to do and holds a residual a test can set, and it deliberately
 * re-implements nothing: the rebase arithmetic, the plan and the binding's own behaviour are
 * proven against the real modules, so a stub that reproduced them could never disagree with them
 * in a way a test would notice.
 */
import type { CanonicalCameraChange, ObjectTransform, PlaneTransform, PresentationCameraBinding } from '../presentation-camera/usePresentationCamera';
import {
  RESIDUAL_AT_REST,
  counterScale,
  planeTransformTriple,
  screenToResidual,
  type PresentationPoint,
  type PresentationResidual,
} from '../presentation-camera/residual';
import type { DerivedValue, SharedValue } from '../runtime/bridge';

interface Box<T> {
  value: T;
  get: () => T;
  set: (next: T | ((current: T) => T)) => void;
}

function box<T>(initial: T): Box<T> {
  let held = initial;
  return {
    get value() {
      return held;
    },
    set value(next: T) {
      held = next;
    },
    get: () => held,
    set: (next) => {
      held = typeof next === 'function' ? (next as (current: T) => T)(held) : next;
    },
  };
}

export interface StubPresentationCamera extends PresentationCameraBinding {
  /** Every canonical change the surface handed over, in order. */
  readonly changes: CanonicalCameraChange[];
  readonly counts: { grab: number; drag: number; release: number; resolveToRest: number; reset: number };
  /** The accumulated drag, in points, exactly as the gesture reported it. */
  readonly drag: { x: number; y: number };
  /** Places the plane between two viewpoints, so a test can prove what a touch then selects. */
  readonly setResidual: (residual: PresentationResidual) => void;
  readonly residual: () => PresentationResidual;
}

export function stubPresentationCamera(options: { center: PresentationPoint; reducedMotion?: boolean }): StubPresentationCamera {
  let residual: PresentationResidual = RESIDUAL_AT_REST;
  const changes: CanonicalCameraChange[] = [];
  const counts = { grab: 0, drag: 0, release: 0, resolveToRest: 0, reset: 0 };
  const drag = { x: 0, y: 0 };
  const planeOpacity = box(1) as unknown as SharedValue<number>;
  const dragging = box(0) as unknown as SharedValue<number>;
  // Bumped by every mover, exactly as the real binding does, so a surface test can drive the
  // stale/fresh distinction a rest notification has to make.
  const epoch = box(0) as unknown as SharedValue<number>;
  const planeTransform = {
    get value() {
      const [x, y, scale] = planeTransformTriple(residual);
      return [{ translateX: x }, { translateY: y }, { scale }] as PlaneTransform;
    },
    get: () => {
      const [x, y, scale] = planeTransformTriple(residual);
      return [{ translateX: x }, { translateY: y }, { scale }] as PlaneTransform;
    },
  } as unknown as DerivedValue<PlaneTransform>;
  const objectScale = {
    get value() {
      return counterScale(residual.zoom);
    },
    get: () => counterScale(residual.zoom),
  } as unknown as DerivedValue<number>;
  const objectTransform = {
    get value() {
      return [{ scale: counterScale(residual.zoom) }] as ObjectTransform;
    },
    get: () => [{ scale: counterScale(residual.zoom) }] as ObjectTransform,
  } as unknown as DerivedValue<ObjectTransform>;

  return {
    planeTransform,
    objectTransform,
    objectScale,
    planeOpacity,
    dragging,
    epoch,
    reducedMotion: options.reducedMotion === true,
    changes,
    counts,
    drag,
    grab: () => {
      counts.grab += 1;
      epoch.set(epoch.get() + 1);
    },
    dragBy: (changeX: number, changeY: number) => {
      counts.drag += 1;
      drag.x += changeX;
      drag.y += changeY;
      residual = { ...residual, tx: residual.tx + changeX, ty: residual.ty + changeY };
    },
    release: () => {
      counts.release += 1;
    },
    applyCanonicalChange: (change: CanonicalCameraChange) => {
      changes.push(change);
      epoch.set(epoch.get() + 1);
      return { kind: 'AT_REST', translationMs: 0, zoomMs: 0, zoomDelayMs: 0, spatialDelayMs: 0, resolveMs: 0, dampingRatio: 1 };
    },
    resolveToRest: () => {
      counts.resolveToRest += 1;
      epoch.set(epoch.get() + 1);
      residual = RESIDUAL_AT_REST;
    },
    reset: () => {
      counts.reset += 1;
      epoch.set(epoch.get() + 1);
      residual = RESIDUAL_AT_REST;
    },
    canonicalPointAt: (point: PresentationPoint) => screenToResidual(point, residual, options.center),
    readResidual: () => residual,
    setResidual: (next: PresentationResidual) => {
      residual = next;
    },
    residual: () => residual,
  };
}
