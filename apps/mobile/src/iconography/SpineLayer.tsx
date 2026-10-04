/**
 * VPORT-02 — the Temporal Spine's hairline and notches, drawn as plain layout inside T-06's temporal strip.
 *
 * Decorative: the strip's accessible routes are T-06's navigator, so nothing here is an element or takes a touch. Its
 * positions come from `spinePresentation`; a change of window is a re-render with new numbers, never an animation —
 * T-06 froze that presentation movement is not animated.
 */
import { StyleSheet, View } from 'react-native';

import { P2_SPINE } from './p2-production.generated';
import type { SpinePresentation } from './spine';

export interface SpineLayerProps {
  readonly spine: SpinePresentation;
  /** The spine's and the resting notches' ink: tertiary. */
  readonly ink: string;
  /** The previewed notch's ink: primary. It says WHICH Moment, so it draws in the aperture's ink. */
  readonly targetInk: string;
  /** Which notches to draw: the resting ones under the apertures, or the targeted one above them. */
  readonly layer: 'SPINE' | 'TARGET';
  readonly testID?: string;
}

export function SpineLayer({ spine, ink, targetInk, layer, testID }: SpineLayerProps) {
  const { axisY, notch } = P2_SPINE;
  return (
    <View
      testID={testID}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {layer === 'SPINE' ? (
        <View
          style={{
            position: 'absolute',
            start: 0,
            top: axisY - P2_SPINE.spine.strokeWidth / 2,
            width: spine.spineLength,
            height: P2_SPINE.spine.strokeWidth,
            backgroundColor: ink,
            opacity: P2_SPINE.spine.opacity,
          }}
        />
      ) : null}
      {spine.notches
        .filter((each) => (layer === 'TARGET' ? each.target : !each.target))
        .map((each) => {
          const height = each.target ? notch.targetHeight : notch.restHeight;
          const width = each.target ? notch.targetStrokeWidth : notch.restStrokeWidth;
          return (
            <View
              key={each.sp}
              testID={testID === undefined ? undefined : `${testID}:sp-${each.sp}`}
              style={{
                position: 'absolute',
                start: each.start - width / 2,
                top: axisY - height / 2,
                width,
                height,
                borderRadius: width / 2,
                backgroundColor: each.target ? targetInk : ink,
                opacity: each.target ? 1 : notch.restOpacity,
              }}
            />
          );
        })}
    </View>
  );
}
