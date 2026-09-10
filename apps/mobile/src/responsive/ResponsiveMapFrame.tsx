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
      // Floor and ceiling both come from the plan, and both are load-bearing. The floor is what the
      // world is guaranteed; the ceiling is what the surface has left once the support around it has
      // been allocated. Between them the frame still flexes exactly as it did.
      style={[styles.frame, { flexBasis: frame.basisPoints, minHeight: frame.minHeightPoints, maxHeight: frame.ceilingPoints }, style]}
      onLayout={onLayout}
    >
      {rect === null ? null : children(rect)}
    </View>
  );
}

const styles = StyleSheet.create({
  // The world is sized FIRST, at the plan's share, and grows into whatever the support around it
  // does not need.
  //
  // ## T-12 — why the world now yields, when it once must not have
  //
  // This carried `flexShrink: 0`, and at the time that was the correction: the support regions took
  // their height from a `ScrollView`, a scroller reports no intrinsic height to its parent, and the
  // world was the only child that grew — so if the world yielded at all, a truthful region resolved
  // to ZERO and its own `overflow: hidden` clipped it off the composition entirely.
  //
  // That is no longer the shape of the thing. The band beneath the world now has a DEFINITE height,
  // decided in the plan before either region renders and after the world's own floor has been set
  // aside, and it neither grows nor shrinks. So the room the world yields is a fixed, already-decided
  // allocation rather than whatever a scroller happened to ask for, and `minHeight` below is an
  // absolute stop: the world cannot be pushed under its floor by anything.
  //
  // What refusing to yield actually bought was the ability to hold a share that no longer described
  // the surface. Measured on a device: a rotation into a short landscape window recomposed the band
  // correctly, at 159 points across with the short 4-point gap, while the world kept the 388-point
  // half of the PORTRAIT usable height — and because it would not give the 182 points back, the band
  // was laid out starting 392 points down a 369-point window and neither the Timeline nor the
  // orientation was on screen. The same arithmetic overflows a stationary window between roughly 456
  // and 638 points tall, where the two support floors together cost more than the surface leaves.
  //
  // Yielding to a region that has a definite allocation and cannot yield back is the correct order:
  // it is the world that can show less of itself without ceasing to be true.
  frame: { flexGrow: 1, flexShrink: 1 },
});
