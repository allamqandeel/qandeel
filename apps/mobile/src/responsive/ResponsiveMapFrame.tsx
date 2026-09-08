/**
 * T-11 — the room the world is drawn in.
 *
 * The Map's envelope is a MEASURED fact of this frame, never a number predicted from the outer
 * surface. That is what makes paint, hit testing and the accessible tree agree after a resize
 * without any of them being told to: they are all derived from one envelope, and that envelope is
 * what the frame actually turned out to be. A predicted rect would let the three of them disagree
 * for exactly one frame — which is the class of one-frame lie the motion contract forbids.
 *
 * The frame flexes and the world may therefore show less of itself. It never shows a different
 * world: nothing here recenters, fits, compacts, redistributes or mirrors, and the rect it produces
 * is the only thing it produces.
 *
 * The floor is not decoration. A world compressed below it can no longer show one Thread and what
 * is bound to it, and "the Map may show less" was never permission for the Map to vanish.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

import type { MapFrameComposition } from './plan';
import { presentationSurface, quantizePoints, type PresentationRect } from './surface';

export const RESPONSIVE_MAP_FRAME_TEST_ID = 'qandeel-responsive-map-frame';

export interface ResponsiveMapFrameProps {
  readonly frame: MapFrameComposition;
  /**
   * The world, given the rect it is actually being drawn in.
   *
   * The rect has exactly the shape T-04's `viewportEnvelope` accepts, and it is always a rect that
   * validator accepts: the same refusals are applied here first, so a frame that is not a surface
   * yields no rect at all rather than an envelope built from a guess.
   */
  readonly children: (rect: PresentationRect) => ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export function ResponsiveMapFrame({ frame, children, style, testID = RESPONSIVE_MAP_FRAME_TEST_ID }: ResponsiveMapFrameProps) {
  const [measured, setMeasured] = useState<{ readonly width: number; readonly height: number } | null>(null);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const next = { width: quantizePoints(width), height: quantizePoints(height) };
    setMeasured((current) => (current !== null && current.width === next.width && current.height === next.height ? current : next));
  }, []);

  // Reusing the surface normalizer is deliberate: the Map's rect is refused for exactly the reasons
  // any other measurement is, and the two can never drift into two validity rules.
  const rect =
    measured === null
      ? null
      : presentationSurface({
          width: measured.width,
          height: measured.height,
          insetTop: frame.insetTop,
          insetRight: frame.insetRight,
          // The band below owns the bottom inset; this frame is not the bottom-most surface.
          insetBottom: 0,
          insetLeft: frame.insetLeft,
        });

  return (
    <View
      testID={testID}
      style={[styles.frame, { flexBasis: frame.basisPoints, minHeight: frame.minHeightPoints }, style]}
      onLayout={onLayout}
    >
      {rect === null ? null : children(rect)}
    </View>
  );
}

const styles = StyleSheet.create({
  // The world is sized FIRST, at the plan's share, and grows into whatever the support around it
  // does not need. `flexShrink: 0` is the load-bearing half: without it the support takes its
  // natural height and the world gets the remainder, which on a tall window is a strip under a
  // wall of controls — a description of the world where the world should be. The support regions
  // carry `flexShrink: 1` and their own reachable overflow, so nothing is lost by the world
  // refusing to yield.
  frame: { flexGrow: 1, flexShrink: 0 },
});
