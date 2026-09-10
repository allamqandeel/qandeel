/**
 * T-04 — the drag route: a pointer / touch gesture bound to the frozen `PAN` act.
 * T-10 — the same route, moved onto the UI runtime.
 *
 * The Product mechanic is UNCHANGED and is the reason this file is careful:
 *
 *   ONE completed drag → ONE canonical `PAN`, at the actual end of the gesture, from the finger's
 *   own reported total translation. No momentum is added, no commit is delayed until visual rest,
 *   no second `PAN` is dispatched when the plane settles, no translation is synthesised from
 *   velocity, and no animation completion commits anything. A cancelled, failed or interrupted
 *   gesture dispatches nothing at all and invents no semantics.
 *
 * What changed is where the in-progress translation LIVES. It used to be React state, so every
 * gesture frame re-rendered the surface on the JS runtime. It is now the presentation camera's
 * residual, written on the UI runtime, so the plane is attached to the hand at 1:1 with no easing,
 * no lag and not one React render for the whole drag. Exactly one crossing back to the Product
 * runtime exists, at the end of a completed gesture, and it carries the same two numbers the
 * frozen act always took.
 *
 * The release is deliberately silent. The committed `PAN` moves the canonical anchor by the
 * finger's own translation, so the rebase that follows it cancels the residual almost exactly: the
 * world HOLDS ITS PLACE where the reader put it. QANDEEL is not a slippy map. When the act does
 * NOT change canonical state — a refusal at the coordinate bound, a movement too small to be an
 * act — the presentation returns to the camera the reader is actually at, because nothing moved.
 *
 * ## R1 — a drag belongs to the authority it began under
 *
 * A drag is performed against one store, one Session, one camera. If that owner is REPLACED before
 * the completion crossing arrives, the drag is stale: it describes a world nobody is looking at.
 *
 * The earlier version read the current store at call time and dispatched into the replacement. That
 * is the wrong reading of "one completed drag is one PAN": the finger moved a world that no longer
 * exists, and replaying its translation into a different world's camera is an act the reader never
 * performed there. It is now DROPPED — no `PAN` in the store the drag began under, none in the
 * replacement, and no outcome claiming an act happened. The presentation is reconciled under the
 * new owner instead.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Gesture } from 'react-native-gesture-handler';

import { createBox, handoffToProduct, type AuthorityGeneration, type PresentationCameraBinding } from '../../motion';
import type { CanonicalStore } from '../../state';
import type { MapActionOutcome } from '../outcome';
import { panByTranslation } from './map-camera-actions';

export interface MapPanGestureBinding {
  /** Compose into a `GestureDetector`. */
  readonly gesture: ReturnType<typeof Gesture.Pan>;
}

export interface MapPanGestureOptions {
  readonly enabled?: boolean;
  /** The presentation residual the drag writes. Class D: never canonical, discarded on cancel. */
  readonly camera: PresentationCameraBinding;
  /**
   * Which authority this surface is bound to.
   *
   * Stamped on the gesture when it begins and re-read when its crossing arrives, so a completion
   * that outlived its owner can be recognised as stale rather than re-aimed at a new one.
   */
  readonly authority: AuthorityGeneration;
  /** Observes the single canonical outcome of a completed drag; purely informational. */
  readonly onSettled?: (outcome: MapActionOutcome) => void;
}

export function useMapPanGesture(store: CanonicalStore, options: MapPanGestureOptions): MapPanGestureBinding {
  const { enabled = true, camera, authority, onSettled } = options;

  // What the crossing must reach when it ARRIVES, not what was current when the gesture was built.
  //
  // A changing observer would otherwise rebuild the gesture on every render, re-attaching the
  // recognizer and risking a completion arriving twice; reading at call time is why the gesture
  // below depends on nothing that changes per render. The STORE is read here too, but only to
  // dispatch a drag that is still its own — the generation check above decides that first.
  //
  // A box rather than a ref, because these functions are handed to gesture callbacks and the React
  // Compiler's rules — correctly — refuse a ref that crosses that boundary.
  const [latest] = useState(() => createBox({ store, onSettled, mounted: true }));
  useLayoutEffect(() => {
    latest.set({ store, onSettled, mounted: true });
  }, [latest, onSettled, store]);
  // An unmount between the gesture ending on the UI runtime and the crossing arriving on the
  // Product runtime must dispatch nothing: a surface that is gone has no reader to have panned.
  useEffect(
    () => () => {
      latest.set({ ...latest.get(), mounted: false });
    },
    [latest],
  );

  const settle = useCallback(
    (translationX: number, translationY: number, generation: number) => {
      const current = latest.get();
      if (!current.mounted) return;
      if (generation !== authority.current()) {
        // STALE. The owner that this drag moved was replaced before its completion arrived: no act
        // in the old store, no act in the new one, and no outcome claiming otherwise. The residual
        // belongs to a world that is gone, so it is dropped rather than resolved — the replacement
        // owner's own camera is what the surface shows next.
        camera.reset();
        return;
      }
      const outcome = panByTranslation(current.store, translationX, translationY);
      // An act that changed no canonical camera leaves the plane displaced from the truth it is
      // supposed to be showing, so the presentation comes home. An APPLIED act needs nothing here:
      // the rebase that observes the new canonical camera resolves the residual by itself.
      if (outcome.outcome !== 'APPLIED') camera.resolveToRest();
      current.onSettled?.(outcome);
    },
    [authority, camera, latest],
  );

  const discard = useCallback(
    (generation: number) => {
      if (!latest.get().mounted) return;
      if (generation !== authority.current()) {
        camera.reset();
        return;
      }
      camera.resolveToRest();
    },
    [authority, camera, latest],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        // ONE finger, and this is load-bearing rather than tidy. A second finger on the plane means
        // the reader is asking for a depth change, and a pan that kept recognising through it would
        // commit a translation the reader never asked for at the moment they asked for something
        // else. Capping the pointer count is what makes the two gestures mutually exclusive at the
        // recogniser instead of at a guess about intent.
        .maxPointers(1)
        // Every callback below is a worklet on the UI runtime. None of them touches the canonical
        // store, which is plain JavaScript and has no worklet representation.
        .onBegin(() => {
          // The authority this drag is being performed against, stamped before the first point.
          authority.capture();
          camera.grab();
        })
        .onChange((event) => {
          camera.dragBy(event.changeX, event.changeY);
        })
        .onEnd((event, success) => {
          camera.release();
          // The ONE crossing: at the end of a completed gesture, with the finger's own total
          // translation AND the generation it began under. Never per frame, never from a decay,
          // never from an animation callback.
          if (success) handoffToProduct(settle, event.translationX, event.translationY, authority.captured.get());
          else handoffToProduct(discard, authority.captured.get());
        })
        // Cancellation, failure and interruption all land here without ever having dispatched.
        .onFinalize((_event, success) => {
          if (success) return;
          camera.release();
          handoffToProduct(discard, authority.captured.get());
        }),
    [authority, camera, discard, enabled, settle],
  );

  return { gesture };
}
