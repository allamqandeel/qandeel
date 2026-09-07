/**
 * T-10.0 MOTION LAB — the presentation camera binding: finger, momentum, re-basing and the
 * per-act choreography, on the UI runtime.
 *
 * What is canonical stays canonical. The kernel's `MC` is written only by the T-04 executors; this
 * hook writes the RESIDUAL (`tx`, `ty`, `zoom`) between that camera and the pixels, and it does so
 * per frame on the UI runtime without a React render. The one route from here to Product truth is
 * `commitPan`, called from the RN runtime, at most once per completed interaction, when the plane
 * comes to REST (after the finger and its momentum are done, or when a Product act interrupts the
 * momentum). That is the only reading of T-04's "one canonical PAN per completed input" under
 * which the canonical camera can never disagree with what the reader is looking at: the pan is
 * committed where the world actually stopped. (Open question for human review: whether the commit
 * boundary should instead be the finger's release, with momentum as a second act.)
 *
 * Interruption is structural: a new finger cancels whatever is running and continues from the
 * current value; a Product act mid-settle cancels the momentum, commits the residual, and then
 * runs; a new canonical camera arriving mid-travel re-bases from the CURRENT residual and
 * retargets the settle. No queue exists, and nothing waits for an animation to finish.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withDecay,
  withDelay,
  withSequence,
  withTiming,
  type DerivedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { envelopeCenter, mapScaleEquals, projectAddress, worldAddressEquals, type MapCamera, type ViewportEnvelope } from '../../map';
import type { LabCause } from '../truth/lab-acts';
import { counterScale, planeTransform, toCanonical, type Point } from './presentation-camera';
import { travelDurationMs, type MotionProfile } from './profiles';
import { fadeTo, settleTo } from './settle';

export interface LabCameraOptions {
  readonly envelope: ViewportEnvelope;
  /** Read at call time, so switching the direction mid-session needs no rebinding. */
  readonly profile: () => MotionProfile;
  /** Whether the plane's velocity is tracked per frame (a field response, or a settle that carries velocity). */
  readonly velocityTracking: boolean;
  /** The ONE route to canonical truth: T-04's `PAN`, with the residual the plane came to rest at. */
  readonly commitPan: (translationX: number, translationY: number) => void;
  /** A tap, already converted into canonical-camera coordinates for T-04's own hit test. */
  readonly onTap: (point: Point) => void;
}

export interface SyntheticFinger {
  /** Touch down: stops momentum and takes ownership, exactly as a real finger would. */
  readonly grab: () => void;
  /** Moves the plane by a delta over `ms`, linearly, as a finger would. */
  readonly drag: (dx: number, dy: number, ms: number) => void;
  /** Lifts with a velocity in points per second. */
  readonly release: (vx: number, vy: number) => void;
}

export interface LabCameraBinding {
  readonly tx: SharedValue<number>;
  readonly ty: SharedValue<number>;
  readonly zoom: SharedValue<number>;
  readonly dragging: SharedValue<number>;
  /** Plane speed in points per second, for the field response. Zero unless a profile asks for it. */
  readonly speed: SharedValue<number>;
  readonly planeOpacity: SharedValue<number>;
  /** Exact Return's arrival lock, `0`…`1`. */
  readonly lock: SharedValue<number>;
  /** Arrival breath for the field profile, `0`…`1`. */
  readonly arrival: SharedValue<number>;
  readonly planeTransform: DerivedValue<readonly [number, number, number]>;
  readonly inverseScale: DerivedValue<number>;
  readonly gesture: ReturnType<typeof Gesture.Pan>;
  readonly tap: ReturnType<typeof Gesture.Tap>;
  /** Called from a layout effect once the new canonical positions are committed to React. */
  readonly applyCameraChange: (previous: MapCamera | null, next: MapCamera, cause: LabCause | null) => void;
  /** Cancels momentum, commits the residual pan (if any), then runs the act. */
  readonly settleThen: <T>(act: () => T) => T;
  readonly synthetic: SyntheticFinger;
}

const LINEAR = Easing.linear;

/** A plain mutable box. Mutated only through `set`, read only through `get`. */
export interface Box<T> {
  readonly get: () => T;
  readonly set: (value: T) => void;
}

export function createBox<T>(initial: T): Box<T> {
  let value = initial;
  return {
    get: () => value,
    set: (next) => {
      value = next;
    },
  };
}

export function useLabCamera(options: LabCameraOptions): LabCameraBinding {
  const { envelope } = options;
  const center = useMemo(() => envelopeCenter(envelope), [envelope]);
  const diagonal = Math.hypot(envelope.width, envelope.height);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const zoom = useSharedValue(1);
  const dragging = useSharedValue(0);
  const speed = useSharedValue(0);
  const vx = useSharedValue(0);
  const vy = useSharedValue(0);
  const planeOpacity = useSharedValue(1);
  const lock = useSharedValue(0);
  const arrival = useSharedValue(0);
  const epoch = useSharedValue(0);
  const pendingAxes = useSharedValue(0);
  // Who owns the residual: 1 while the hand or its momentum does (committable at rest), 0 while the
  // presentation is only resolving toward an already-committed camera (never committable).
  const handOwned = useSharedValue(0);
  const lastTx = useSharedValue(0);
  const lastTy = useSharedValue(0);

  // The options are read through a plain mutable box at call time, so callbacks queued before a
  // rerender still reach the current profile and the current store (the T-06 FCR-01 lesson). A
  // plain-JS box held in state rather than a ref: the React Compiler lint rejects a ref read from
  // a gesture callback, and rejects a direct mutation of state, so the box mutates through a method.
  const [latest] = useState(() => createBox(options));
  useLayoutEffect(() => {
    latest.set(options);
  });

  const planeTransformValue = useDerivedValue(() => planeTransform({ tx: tx.get(), ty: ty.get(), zoom: zoom.get() }));
  const inverseScale = useDerivedValue(() => counterScale(zoom.get()));

  // Plane velocity, only while a profile asks for a field response or carries velocity into a
  // settle. It is presentation arithmetic over presentation values and reaches nothing canonical.
  const frame = useFrameCallback((info) => {
    const dt = info.timeSincePreviousFrame;
    if (dt === null || dt <= 0) return;
    const nx = tx.get();
    const ny = ty.get();
    const z = zoom.get();
    const ivx = ((nx - lastTx.get()) * z * 1000) / dt;
    const ivy = ((ny - lastTy.get()) * z * 1000) / dt;
    lastTx.set(nx);
    lastTy.set(ny);
    // A light low-pass so a single late frame does not read as a jolt — snapped to zero below half
    // a point per second. Without the snap the filter never reaches zero, the speed changes by a
    // hair every frame, and everything derived from it (every node's radius) repaints a plane that
    // is at rest (the /review-animations finding: 53–72 repaints/s idle).
    const fx = vx.get() * 0.6 + ivx * 0.4;
    const fy = vy.get() * 0.6 + ivy * 0.4;
    const sx = Math.abs(fx) < 0.5 ? 0 : fx;
    const sy = Math.abs(fy) < 0.5 ? 0 : fy;
    if (sx !== vx.get()) vx.set(sx);
    if (sy !== vy.get()) vy.set(sy);
    const magnitude = Math.hypot(sx, sy);
    if (magnitude !== speed.get()) speed.set(magnitude);
  }, false);
  const { velocityTracking } = options;
  useEffect(() => {
    frame.setActive(velocityTracking);
    if (!velocityTracking) {
      vx.set(0);
      vy.set(0);
      speed.set(0);
    }
  }, [frame, speed, velocityTracking, vx, vy]);

  /** RN runtime: commit the residual the plane rests at, once, through T-04's PAN. */
  const restOnRN = useCallback(
    (epochAt: number) => {
      if (epochAt !== epoch.get()) return; // a newer interaction owns the plane
      if (handOwned.get() !== 1) return; // a travel resolving toward committed truth is not intent
      handOwned.set(0);
      const x = tx.get();
      const y = ty.get();
      if (Math.abs(x) < 1 / 1024 && Math.abs(y) < 1 / 1024) return;
      latest.get().commitPan(x, y);
    },
    [epoch, handOwned, latest, tx, ty],
  );

  const releaseWithMomentum = useCallback(
    (velocityX: number, velocityY: number) => {
      'worklet';
      const deceleration = latest.get().profile().pan.deceleration;
      const at = epoch.get();
      pendingAxes.set(2);
      const done = (finished?: boolean) => {
        'worklet';
        if (finished !== true) return; // cancelled: whoever cancelled it owns the rest
        pendingAxes.set(pendingAxes.get() - 1);
        if (pendingAxes.get() === 0) scheduleOnRN(restOnRN, at);
      };
      tx.set(withDecay({ velocity: velocityX, deceleration, reduceMotion: ReduceMotion.Never }, done));
      ty.set(withDecay({ velocity: velocityY, deceleration, reduceMotion: ReduceMotion.Never }, done));
    },
    [epoch, latest, pendingAxes, restOnRN, tx, ty],
  );

  const grab = useCallback(() => {
    'worklet';
    epoch.set(epoch.get() + 1);
    cancelAnimation(tx);
    cancelAnimation(ty);
    dragging.set(1);
    // A hand on the plane takes ownership of whatever residual is there, including an unfinished
    // travel: from now on where the plane rests is the reader's own viewpoint.
    handOwned.set(1);
  }, [dragging, epoch, handOwned, tx, ty]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(3)
        .onBegin(() => {
          grab();
        })
        .onChange((event) => {
          // 1:1 with the hand (P2): no easing, no lag, no spring — the plane is attached to it.
          const z = zoom.get();
          tx.set(tx.get() + event.changeX / z);
          ty.set(ty.get() + event.changeY / z);
        })
        .onEnd((event, success) => {
          dragging.set(0);
          const z = zoom.get();
          if (success) {
            releaseWithMomentum(event.velocityX / z, event.velocityY / z);
          } else {
            // Cancelled after activation: the frozen T-04 rule — a cancelled input invents nothing.
            // The plane returns to canonical truth and no PAN is committed.
            const spec = latest.get().profile().pan.cancelSettle;
            tx.set(settleTo(0, spec, 0));
            ty.set(settleTo(0, spec, 0));
          }
        })
        .onFinalize((_event, success) => {
          if (success) return;
          if (dragging.get() === 0) return;
          // A touch that never became a drag (a tap, a competing recognizer) still stopped whatever
          // momentum was running: the plane rests where the hand stopped it, and that rest is committed.
          dragging.set(0);
          scheduleOnRN(restOnRN, epoch.get());
        }),
    [dragging, epoch, grab, latest, releaseWithMomentum, restOnRN, tx, ty, zoom],
  );

  const tapOnRN = useCallback(
    (x: number, y: number) => {
      const point = toCanonical({ x, y }, { tx: tx.get(), ty: ty.get(), zoom: zoom.get() }, center);
      latest.get().onTap(point);
    },
    [center, latest, tx, ty, zoom],
  );

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(300)
        .onEnd((event, success) => {
          if (success) scheduleOnRN(tapOnRN, event.x, event.y);
        }),
    [tapOnRN],
  );

  const applyCameraChange = useCallback(
    (previous: MapCamera | null, next: MapCamera, cause: LabCause | null) => {
      if (previous === null) return;
      const anchorMoved = !worldAddressEquals(previous.anchor, next.anchor);
      const scaleMoved = !mapScaleEquals(previous.scale, next.scale);
      if (!anchorMoved && !scaleMoved) return;
      const profile = latest.get().profile();

      // Points per world unit, new over old: a semantic zoom IN by one rung is k = 8.
      const oldPpu = Number(previous.scale.denominator) / Number(previous.scale.numerator);
      const newPpu = Number(next.scale.denominator) / Number(next.scale.numerator);
      const k = newPpu / oldPpu;
      const destination = projectAddress(previous, envelope, next.anchor);
      if (destination === null || !Number.isFinite(k) || k <= 0) {
        // Not finitely representable from the old camera: there is no continuous path to show.
        // A cut, and the plane resolves in place rather than pretending to have travelled.
        tx.set(0);
        ty.set(0);
        zoom.set(1);
        planeOpacity.set(0.35);
        planeOpacity.set(fadeTo(1, profile.travel.resolveMs));
        return;
      }
      const d = { x: destination.x - center.x, y: destination.y - center.y };

      // Re-base from the CURRENT residual (functional updates, so a finger writing at this moment
      // loses nothing): the frame that is on screen is preserved exactly.
      zoom.set((z) => z / k);
      tx.set((v) => k * (v + d.x));
      ty.set((v) => k * (v + d.y));
      // Unless a hand is on the plane right now, the residual from here on belongs to the
      // presentation: it resolves toward committed truth and can never be committed as a pan.
      if (dragging.get() !== 1) handOwned.set(0);

      const restingZoom = zoom.get();
      const distance = Math.hypot(tx.get() * restingZoom, ty.get() * restingZoom);
      const zoomAway = Math.abs(restingZoom - 1);
      // What actually needs resolving is read from the residual itself, so an act that arrives
      // mid-travel retargets the unfinished travel instead of abandoning it.
      const needsTravel = distance > 0.5;
      const needsZoom = zoomAway > 1e-4;
      if (!needsTravel && !needsZoom) return;
      const spatialDelay = cause === 'GO_LIVE_AND_LOCATE' ? profile.goLiveSpatialDelayMs : 0;

      if (needsTravel) {
        const spec = profile.travel.settle;
        const beyond = profile.travel.resolveBeyondDiagonals;
        const resolve = spec.kind === 'cut' || (beyond !== null && distance > diagonal * beyond);
        if (resolve) {
          // B's answer to a long flight (and reduced motion's answer to every flight): the world
          // resolves at the destination. Same truth, same destination, no travel.
          tx.set(withDelay(spatialDelay, withTiming(0, { duration: 0 })));
          ty.set(withDelay(spatialDelay, withTiming(0, { duration: 0 })));
          planeOpacity.set(withDelay(spatialDelay, withSequence(withTiming(0.3, { duration: 0 }), fadeTo(1, profile.travel.resolveMs))));
        } else {
          const durationMs = travelDurationMs(profile, distance);
          const sized = spec.kind === 'spring' ? { ...spec, durationMs } : { ...spec, durationMs };
          tx.set(withDelay(spatialDelay, settleTo(0, sized, vx.get() / Math.max(restingZoom, 1e-6))));
          ty.set(withDelay(spatialDelay, settleTo(0, sized, vy.get() / Math.max(restingZoom, 1e-6))));
          if (profile.field.arrivalBreath > 0) {
            arrival.set(withDelay(spatialDelay + Math.round(durationMs * 0.7), withSequence(fadeTo(1, 120), settleTo(0, { kind: 'spring', durationMs: 420, dampingRatio: 0.7, carriesVelocity: false }, 0))));
          }
        }
      }
      if (needsZoom) {
        const spec = profile.zoom.settle;
        if (spec.kind === 'cut') {
          zoom.set(1);
          if (scaleMoved) planeOpacity.set(withSequence(withTiming(0.55, { duration: 0 }), fadeTo(1, profile.travel.resolveMs)));
        } else {
          zoom.set(withDelay(spatialDelay + profile.zoom.delayMs, settleTo(1, spec, 0)));
        }
      }
      if (cause === 'EXACT_RETURN' && profile.exactReturnLockMs > 0) {
        // The arrival lock: a brief inset frame saying "exactly here", never a glow and never brass.
        const arrive = needsTravel ? travelDurationMs(profile, distance) : profile.zoom.settle.kind === 'cut' ? 0 : profile.zoom.settle.durationMs;
        lock.set(withDelay(Math.round(arrive * 0.6), withSequence(fadeTo(1, 90), withDelay(60, fadeTo(0, profile.exactReturnLockMs)))));
      }
    },
    [arrival, center, diagonal, dragging, envelope, handOwned, latest, lock, planeOpacity, tx, ty, vx, vy, zoom],
  );

  const settleThen = useCallback(
    <T,>(act: () => T): T => {
      // Only a residual the HAND owns (a drag, or its momentum) is intent to commit. A presentation
      // travel still in flight is left to the act's own re-basing, which retargets it.
      if (handOwned.get() === 1) {
        epoch.set(epoch.get() + 1);
        cancelAnimation(tx);
        cancelAnimation(ty);
        dragging.set(0);
        restOnRN(epoch.get());
      }
      return act();
    },
    [dragging, epoch, handOwned, restOnRN, tx, ty],
  );

  const synthetic = useMemo<SyntheticFinger>(
    () => ({
      grab: () => {
        grab();
      },
      drag: (dx, dy, ms) => {
        const z = zoom.get();
        tx.set(withTiming(tx.get() + dx / z, { duration: ms, easing: LINEAR, reduceMotion: ReduceMotion.Never }));
        ty.set(withTiming(ty.get() + dy / z, { duration: ms, easing: LINEAR, reduceMotion: ReduceMotion.Never }));
      },
      release: (velocityX, velocityY) => {
        dragging.set(0);
        const z = zoom.get();
        releaseWithMomentum(velocityX / z, velocityY / z);
      },
    }),
    [dragging, grab, releaseWithMomentum, tx, ty, zoom],
  );

  return {
    tx,
    ty,
    zoom,
    dragging,
    speed,
    planeOpacity,
    lock,
    arrival,
    planeTransform: planeTransformValue,
    inverseScale,
    gesture,
    tap,
    applyCameraChange,
    settleThen,
    synthetic,
  };
}
