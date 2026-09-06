/**
 * T-04 — the composed Map surface: the structural Skia canvas, the drag route, the tap route and
 * the accessible semantic layer over ONE disclosed projection.
 *
 * The three routes cannot disagree, because they share one derivation and one placement: a tap
 * hits exactly what is painted, and the accessible tree names exactly what is entitled. A future,
 * off-depth or unavailable identity is in none of them.
 *
 * They also cannot disagree with the store. The surface subscribes to canonical state — not to
 * the camera alone — and asks the ONE freshness rule whether the supplied context still is this
 * Map's `(Session, effective TC, MC.depth)`. When it is not, nothing of the old projection
 * survives: no paint, no placement, no hit testing, no object accessibility, no act. That is a
 * transient projection-availability state during the handoff to a fresh `V`, not a Product state,
 * so the surface stays structurally empty rather than showing anything about it — final chrome,
 * including anything that would explain the wait, is T-08's.
 *
 * This component is a truthful mechanics substrate. It is deliberately not mounted in the app
 * shell: the technical container is T-01's and stays byte-identical, and where the Map appears in
 * the Product is a later task's decision.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import type { CanonicalStore } from '../../state';
import { decodeCameraIntent, useMapPanGesture, type ViewportEnvelope } from '../camera';
import { MapAccessibilityLayer } from '../accessibility';
import { inspectObject, type DirectJumpOutcome, type MapInspectionContext } from '../inspection';
import { mapContextFreshness } from '../projection';
import type { MapActionOutcome } from '../outcome';
import { MapCanvas } from './MapCanvas';
import { hitTest, placeScene } from './map-geometry';
import { DEFAULT_RENDER_STYLE, type RenderStyle } from './render-style';

export const MAP_SURFACE_TEST_ID = 'qandeel-map-surface';
export const MAP_SURFACE_PLANE_TEST_ID = 'qandeel-map-surface-plane';

export interface MapSurfaceProps {
  readonly store: CanonicalStore;
  readonly context: MapInspectionContext;
  readonly envelope: ViewportEnvelope;
  readonly style?: RenderStyle;
  readonly onOutcome?: (outcome: MapActionOutcome | DirectJumpOutcome) => void;
}

export function MapSurface({ store, context, envelope, style = DEFAULT_RENDER_STYLE, onOutcome }: MapSurfaceProps) {
  // Canonical state is READ, never held beside the store: the whole state, because the projection
  // tuple is Session + effective TC + `MC.depth`, and the camera alone cannot tell us whether the
  // supplied projection is still this Map.
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const decoded = useMemo(() => decodeCameraIntent(state.camera), [state.camera]);
  const camera = decoded.ok ? decoded.camera : null;
  // The one shared rule, over the state this component subscribed to.
  const freshness = useMemo(() => mapContextFreshness(state, context), [state, context]);
  const usable = camera !== null && freshness.fresh;
  const placed = useMemo(
    () => (usable && camera !== null ? placeScene(context.scene, camera, envelope) : null),
    [usable, context.scene, camera, envelope],
  );
  const { gesture, progress } = useMapPanGesture(store, { enabled: usable, onSettled: onOutcome });

  // The act runs first and the observer is notified afterwards: an optional call would not
  // evaluate its argument when no observer is attached, silently disabling the pointer route.
  const onTap = useCallback(
    (x: number, y: number) => {
      if (placed === null) return;
      const node = hitTest(placed, { x, y });
      if (node === null) return;
      if (node.family !== 'THREAD' && node.family !== 'READING' && node.family !== 'EMERGING_FOCUS') return;
      const outcome = inspectObject(store, context, { family: node.family, id: node.id });
      onOutcome?.(outcome);
    },
    [placed, store, context, onOutcome],
  );

  // An undecodable camera, or a projection that is no longer this Map's, renders an empty surface
  // rather than a plausible wrong Map. The accessible layer is still mounted when a camera exists:
  // it enforces the same freshness rule itself, so it exposes no object of the old scene, while
  // the viewport routes that could bring the camera back to a matching depth stay reachable.
  if (camera === null || placed === null) {
    return (
      <View testID={MAP_SURFACE_TEST_ID} style={styles.surface}>
        {camera === null ? null : (
          <MapAccessibilityLayer store={store} context={context} camera={camera} envelope={envelope} onOutcome={onOutcome} />
        )}
      </View>
    );
  }

  return (
    <View testID={MAP_SURFACE_TEST_ID} style={styles.surface}>
      <GestureDetector gesture={gesture}>
        <View
          testID={MAP_SURFACE_PLANE_TEST_ID}
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onResponderRelease={(event) => onTap(event.nativeEvent.locationX, event.nativeEvent.locationY)}
        >
          <MapCanvas
            scene={context.scene}
            camera={camera}
            envelope={envelope}
            placed={placed}
            panTranslationX={progress.translationX}
            panTranslationY={progress.translationY}
            style={style}
          />
        </View>
      </GestureDetector>
      <MapAccessibilityLayer store={store} context={context} camera={camera} envelope={envelope} onOutcome={onOutcome} />
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { flex: 1 },
});
