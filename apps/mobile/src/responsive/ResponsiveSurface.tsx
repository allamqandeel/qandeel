/**
 * T-11 — the measured container that the whole composition is responsive to.
 *
 * It is a `View` with an `onLayout` and nothing else: no store, no dispatch, no projection, no
 * camera, no time, no words. It measures the room it was actually given and hands the plan to its
 * children, so a surface composed inside a split view, a sheet, a proof harness or a future shell
 * is responsive to THAT room rather than to a display it does not own.
 *
 * The children are a function of the plan rather than elements, for one reason: until the container
 * has a real rect there is no plan, and a composition drawn against invented geometry is worse than
 * a composition that has not been drawn yet. The first layout pass therefore renders nothing, which
 * is honest, instead of a Map placed against a guess.
 *
 * This mounts no app shell, defines no route and composes no Product surface of its own. Where the
 * Map, the Timeline and the chrome finally sit together is the integration task's decision; this is
 * the room they will sit in.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import type { RecompositionPlan } from './plan';
import { useResponsiveSurface, type ResponsiveSurfaceOptions } from './useResponsiveSurface';

export const RESPONSIVE_SURFACE_TEST_ID = 'qandeel-responsive-surface';

export interface ResponsiveSurfaceProps extends ResponsiveSurfaceOptions {
  readonly children: (plan: RecompositionPlan) => ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly testID?: string;
}

export function ResponsiveSurface({ children, insets, fontScale, envelope, style, testID = RESPONSIVE_SURFACE_TEST_ID }: ResponsiveSurfaceProps) {
  const { onLayout, plan } = useResponsiveSurface({ insets, fontScale, envelope });
  return (
    <View testID={testID} style={[styles.surface, style]} onLayout={onLayout}>
      {plan === null ? null : children(plan)}
    </View>
  );
}

const styles = StyleSheet.create({
  // A column, because the world is above the support around it and always has been. This is the
  // SAME bottom-band system at every width: there is no side panel arrangement to switch into.
  surface: { flex: 1, flexDirection: 'column' },
});
