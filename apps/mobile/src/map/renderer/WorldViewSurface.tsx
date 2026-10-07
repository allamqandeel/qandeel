/**
 * S5-03B R1 — the world view of the ONE Living Analysis surface: the presentation camera, the world's expression,
 * the drag and the semantic step, the frame, and the composed view (surface, gesture plane, tap route, accessible
 * layer) — for whatever world is drawn in it.
 *
 * Until R1 all of this lived in `MapSurface`, so a second world could only reuse the Personal Map's renderer and had to
 * rebuild the surface around it. It is now the surface's own, in two halves:
 *
 *   `useWorldView` — the mechanics, in exactly the order `MapSurface` always ran them: the presentation camera and its
 *   corridor, the platform contrast, the world's expression, the authority generation, the ONE drag and the ONE
 *   semantic step (simultaneous, separated by pointer count), then the camera commit, culling and membership. It is a
 *   hook so the world's owner calls it in place and every effect keeps its order.
 *
 *   `WorldViewSurface` — the composed view: the surface, the gesture plane carrying the world's paint, the tap route
 *   through the residual the frame was painted with, and the world's accessible layer beside the plane.
 *
 * What a world IS stays its owner's: its authority and freshness, its placement, the act a drag and a step become, what
 * a tap selects, how each object is painted and what the accessible layer says. The Personal Map passes its store, its
 * disclosed scene, `PAN` / `ZOOM_SEMANTIC`, inspection and `MapAccessibilityLayer`; nothing here knows any of them.
 */
import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { useAuthorityGeneration, type PresentationMotionCause } from '../../motion';
import { useIncreasedContrast } from '../../conversation/visual/theme';
import {
  useWorldPanGesture,
  useWorldSemanticStepGesture,
  type SemanticZoomDirection,
  type ViewportEnvelope,
  type WorldGestureOutcome,
  type WorldViewCamera,
} from '../camera';
import { worldPresentation, type WorldPresentation } from '../visual';
import { useWorldFrame, useWorldMotion, type WorldFrame, type WorldMotion, type WorldSurfaceNode } from './useWorldSurface';

/** The inspection the world's SELECTED expression reads, in the expression's own terms. */
export type WorldViewInspection = Parameters<typeof worldPresentation>[1]['inspection'];

export interface WorldViewInput<C extends WorldViewCamera, N extends WorldSurfaceNode, O extends WorldGestureOutcome> {
  /** The authority this view draws under. A different identity is a replaced authority. */
  readonly owner: object;
  readonly envelope: ViewportEnvelope;
  /** The camera the owner holds, or `null` when it holds none it can decode. */
  readonly camera: C | null;
  /** The full current placement, or `null` while the owner has nothing it may draw. */
  readonly placed: { readonly nodes: readonly N[] } | null;
  /** The node keys of the current accepted projection, or `null` in a technical gap. */
  readonly membership: ReadonlySet<string> | null;
  /** The composite spatial cause of the transition being applied, asked once, at apply time. */
  readonly cause: () => PresentationMotionCause | null;
  /** Whether the world may be acted on now: a drag or a step is recognised only while it is. */
  readonly enabled: boolean;
  readonly inspection: WorldViewInspection;
  /** The ONE act a completed drag becomes. */
  readonly pan: (translationX: number, translationY: number) => O;
  /** The ONE step a finished pinch asks for, along the world's own ladder. */
  readonly step: (direction: SemanticZoomDirection) => O;
  readonly onSettled?: (outcome: O) => void;
}

export interface WorldView<C extends WorldViewCamera, N extends WorldSurfaceNode> extends WorldFrame<N> {
  readonly worldMotion: WorldMotion<C>;
  /** The facts the world's expression reads, or `undefined` without a camera. */
  readonly world: WorldPresentation | undefined;
  /** The drag and the semantic step, composed for one `GestureDetector`. */
  readonly gesture: ReturnType<typeof Gesture.Simultaneous>;
}

export function useWorldView<C extends WorldViewCamera, N extends WorldSurfaceNode, O extends WorldGestureOutcome>(
  input: WorldViewInput<C, N, O>,
): WorldView<C, N> {
  const { owner, envelope, camera, placed, membership, cause, enabled, inspection, pan, step, onSettled } = input;
  // The presentation camera, and the travel / drag corridor it reports into (the generic world surface).
  const worldMotion = useWorldMotion<C>(envelope);
  const { motion } = worldMotion;
  // VPORT-01: the facts the world's EXPRESSION reads, gathered once per commit. The camera's distance
  // and anchor, the device's reduced-motion answer, the platform contrast setting and the current
  // inspection — none of which reaches placement, hit testing, membership or the accessible tree.
  const increasedContrast = useIncreasedContrast();
  const world = useMemo(
    () =>
      camera === null
        ? undefined
        : worldPresentation(camera, {
            reducedMotion: motion.reducedMotion,
            contrast: increasedContrast ? 'increased' : 'standard',
            inspection,
          }),
    [camera, increasedContrast, motion.reducedMotion, inspection],
  );
  const authority = useAuthorityGeneration(owner);
  const { gesture: panGesture } = useWorldPanGesture<O>({ enabled, camera: motion, authority, commit: pan, onSettled });
  const { gesture: zoomGesture } = useWorldSemanticStepGesture<O>({ enabled, authority, step, onSettled });
  // Simultaneous, not exclusive. The two recognisers are already separated by pointer count — the pan
  // takes one finger and the pinch takes two — so neither has to lose a race, and racing them would
  // make the winner depend on which recogniser happened to activate first. What this composition
  // guarantees is that a second finger reaches the pinch instead of being swallowed by a pan that has
  // already claimed the plane.
  const gesture = useMemo(() => Gesture.Simultaneous(panGesture, zoomGesture), [panGesture, zoomGesture]);
  const frame = useWorldFrame<C, N>(worldMotion, { owner, camera, envelope, placed, membership, cause });
  return { ...frame, worldMotion, world, gesture };
}

export interface WorldViewSurfaceProps {
  readonly testID: string;
  readonly planeTestID: string;
  /** Whether the world is composed now. Without it only the accessible layer, if any, is mounted. */
  readonly composed: boolean;
  readonly gesture: ReturnType<typeof Gesture.Simultaneous>;
  /** A tap on the plane, in the plane's own points; the owner resolves it through the view's `nodeAt`. */
  readonly onTap: (x: number, y: number) => void;
  /** The world's paint: a `WorldCanvas` under the owner's projection. */
  readonly canvas: ReactNode;
  /** The world's accessible layer, mounted beside the plane. */
  readonly accessibility?: ReactNode;
}

export function WorldViewSurface({ testID, planeTestID, composed, gesture, onTap, canvas, accessibility = null }: WorldViewSurfaceProps) {
  // A world that cannot be composed renders an empty surface rather than a plausible wrong world. Its
  // accessible layer may still be mounted: it keeps the routes that could bring the camera back.
  if (!composed) {
    return (
      <View testID={testID} style={styles.surface}>
        {accessibility}
      </View>
    );
  }

  return (
    <View testID={testID} style={styles.surface}>
      <GestureDetector gesture={gesture}>
        <View
          testID={planeTestID}
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onResponderRelease={(event) => onTap(event.nativeEvent.locationX, event.nativeEvent.locationY)}
        >
          {canvas}
        </View>
      </GestureDetector>
      {accessibility}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { flex: 1 },
});
