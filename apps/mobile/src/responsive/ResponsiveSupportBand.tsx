/**
 * T-11 — the band the two support regions share beneath the world.
 *
 * It exists because of a layout fact the visual proof could not see. Both support regions hold a
 * `ScrollView`, a scroller reports no intrinsic height to its parent, and the world is the only child
 * that grows. So "whatever the world did not take" was the support regions' only source of height,
 * and when a re-layout let the world's growth take the remainder, a region resolved to ZERO and its
 * own `overflow: hidden` clipped a truthful surface off the composition entirely.
 *
 * The room is therefore DECIDED before either region renders, in the plan, from the measured surface
 * and the three frozen minimums — and handed here as a definite number. A definite height cannot be
 * zero and cannot depend on what a scroller reports, which is the whole of the correction.
 *
 * ## Why the two regions can sit across each other
 *
 * Stacked, the two frozen minimums cost `136 + 159` of height. A short window does not have that to
 * give, and the three ways of finding it are all forbidden: removing an act, shrinking a target below
 * 44 points, and cutting essential wording. Placed ACROSS, the same two regions cost
 * `max(136, 159)` instead of their sum — so a short window keeps BOTH truths at full size, and the
 * world pays the difference in area, which is the one thing the contract does allow it to pay.
 *
 * The threshold is not a new one: it is the SAME two-cell readable width the chrome's own arrangement
 * already uses, so a band wide enough to read two columns of wording is wide enough to hold the
 * instrument beside the orientation.
 *
 * ## Why this container is unconditional
 *
 * It is mounted always and only its style changes, exactly as the chrome band is. Swapping a
 * container in at a measurement threshold would change the element type above both regions and
 * remount them — and a remount is a Product event here, because local state that a resize must not
 * clear lives inside them. Nothing here is keyed by a width, a height or a band.
 *
 * Nothing in this file animates. A band that eased between arrangements would make a window resize
 * read as navigation, and a window is not a destination.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import type { SupportComposition } from './plan';

export const RESPONSIVE_SUPPORT_BAND_TEST_ID = 'qandeel-responsive-support-band';

export interface ResponsiveSupportBandProps {
  /** The room the plan gave the two regions, and how they share it. */
  readonly support: SupportComposition;
  readonly children: ReactNode;
  readonly testID?: string;
}

export function ResponsiveSupportBand({ support, children, testID = RESPONSIVE_SUPPORT_BAND_TEST_ID }: ResponsiveSupportBandProps) {
  const across = support.arrangement === 'SIDE_BY_SIDE';
  return (
    <View
      testID={testID}
      style={[
        styles.band,
        {
          height: support.bandPoints,
          marginTop: support.gapPoints,
          flexDirection: across ? 'row' : 'column',
        },
      ]}
      // The band claims no touch of its own, exactly as the regions inside it do not: a press that
      // reaches neither a control nor a scroller belongs to whatever is underneath.
      pointerEvents="box-none"
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // The band neither grows nor yields: its height is the plan's allocation, and the world already had
  // its own floor set aside before that allocation was computed. `flexShrink: 0` is what stops the
  // world's growth from reclaiming the band, which is exactly how a truthful region reached zero.
  band: { flexGrow: 0, flexShrink: 0, overflow: 'hidden' },
});
