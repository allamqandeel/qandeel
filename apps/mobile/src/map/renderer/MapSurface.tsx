/**
 * T-04 — the composed Map surface: the structural Skia canvas, the drag route, the tap route and
 * the accessible semantic layer over ONE disclosed projection.
 *
 * The three routes cannot disagree, because they share one derivation and one placement: a tap
 * hits exactly what is painted, and the accessible tree names exactly what is entitled. A future,
 * off-depth or unavailable identity is in none of them.
 *
 * This component is a truthful mechanics substrate. It is deliberately not mounted in the app
 * shell: the technical container is T-01's and stays byte-identical, and where the Map appears in
 * the Product is a later task's decision.
 */
import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';

import type { CanonicalStore } from '../../state';
import { useMapPanGesture, type MapCamera, type ViewportEnvelope } from '../camera';
import { MapAccessibilityLayer } from '../accessibility';
import { inspectObject, type DirectJumpOutcome, type MapInspectionContext } from '../inspection';
import type { MapActionOutcome } from '../outcome';
import { MapCanvas } from './MapCanvas';
import { hitTest, placeScene } from './map-geometry';
import { DEFAULT_RENDER_STYLE, type RenderStyle } from './render-style';

export const MAP_SURFACE_TEST_ID = 'qandeel-map-surface';
export const MAP_SURFACE_PLANE_TEST_ID = 'qandeel-map-surface-plane';

export interface MapSurfaceProps {
  readonly store: CanonicalStore;
  readonly context: MapInspectionContext;
  readonly camera: MapCamera;
  readonly envelope: ViewportEnvelope;
  readonly style?: RenderStyle;
  readonly onOutcome?: (outcome: MapActionOutcome | DirectJumpOutcome) => void;
}

export function MapSurface({ store, context, camera, envelope, style = DEFAULT_RENDER_STYLE, onOutcome }: MapSurfaceProps) {
  const placed = useMemo(() => placeScene(context.scene, camera, envelope), [context.scene, camera, envelope]);
  const { gesture, progress } = useMapPanGesture(store, { onSettled: onOutcome });

  // The act runs first and the observer is notified afterwards: an optional call would not
  // evaluate its argument when no observer is attached, silently disabling the pointer route.
  const onTap = useCallback(
    (x: number, y: number) => {
      const node = hitTest(placed, { x, y });
      if (node === null) return;
      if (node.family !== 'THREAD' && node.family !== 'READING' && node.family !== 'EMERGING_FOCUS') return;
      const outcome = inspectObject(store, context, { family: node.family, id: node.id });
      onOutcome?.(outcome);
    },
    [placed, store, context, onOutcome],
  );

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
