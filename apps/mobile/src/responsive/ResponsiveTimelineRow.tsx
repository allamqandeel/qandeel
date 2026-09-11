/**
 * T-11 — the region the disclosed temporal track is composed in.
 *
 * It exists because of what the visual proof showed, not because of a plan. T-05's and T-06's
 * accessible non-drag routes are real, visible controls whose wording wraps, so the temporal
 * surface is several times taller than its 48-point Track, 44-point rail and 44-point strip
 * suggest. In a column with the world above it and the chrome below it, a region that could not
 * yield took every point it wanted and pushed the chrome off the bottom of the surface.
 *
 * So both support regions shrink into what the world leaves, each clips to exactly the room it got,
 * and each keeps what does not fit reachable inside itself. Neither can hide anything: the
 * alternative — one region absorbing the whole deficit — is what put a Return act off the screen.
 *
 * ## Which of the two yields first, and why it is this one
 *
 * They are not symmetric in what they hold. The chrome is the reader's ORIENTATION: the sentence
 * that says where they are, and the acts that get them back. This row is a temporal INSTRUMENT with
 * its own extent — a Track that already scrolls, a position rail that already scrolls it, and the
 * accessible routes to both. Its interactive minimum is `TIMELINE_ROW_POINTS`, and almost all of
 * its natural height is above that minimum.
 *
 * So it yields at twice the rate, down to that minimum and no further. Below the minimum the Track,
 * the rail and the target strip would start losing each other; above it, what it gives up is slack
 * the reader can still reach by scrolling. When something has to go first, the instrument goes
 * before the answer.
 *
 * Nothing here decides where the temporal surface finally sits in the Product. That is the
 * integration task's decision and it is recorded as one; what this decides is only that whatever
 * budget it is given, none of it becomes unreachable.
 *
 * Nothing here animates. A region that eased into its new height would make a window resize read as
 * navigation.
 */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { TIMELINE_ROW_POINTS, type SupportComposition } from './plan';

export const RESPONSIVE_TIMELINE_ROW_TEST_ID = 'qandeel-responsive-timeline-row';

/** The rate at which the instrument yields, relative to the orientation beside it. */
export const TIMELINE_ROW_SHRINK = 2;

export interface ResponsiveTimelineRowProps {
  /** The width the row is composed in — the whole available width, never the reading measure. */
  readonly widthPoints: number;
  /** The band's own horizontal padding, so the two support regions share one vertical rhythm. */
  readonly paddingHorizontal?: number;
  /**
   * The room the plan gave this region.
   *
   * Taken as an ALLOCATION rather than measured from the content: the scroller below reports no
   * intrinsic height, so a region that asked its own content how tall to be could be resolved to
   * zero and clipped off the surface. `minHeight` alone does not hold it — this row already carried
   * one and still reached zero — so the allocation is stated as a definite height as well.
   */
  readonly support: SupportComposition;
  readonly children: ReactNode;
  readonly testID?: string;
}

export function ResponsiveTimelineRow({
  widthPoints,
  paddingHorizontal = 0,
  support,
  children,
  testID = RESPONSIVE_TIMELINE_ROW_TEST_ID,
}: ResponsiveTimelineRowProps) {
  return (
    <View
      testID={testID}
      style={[
        styles.row,
        {
          width: widthPoints,
          marginHorizontal: paddingHorizontal,
          height: support.timelinePoints,
          minHeight: Math.min(TIMELINE_ROW_POINTS, support.timelinePoints),
        },
      ]}
      pointerEvents="box-none"
    >
      <ScrollView
        style={styles.scroller}
        contentContainerStyle={styles.content}
        // A horizontal Track lives inside this vertical scroller, so the platform is told the
        // nesting is intentional rather than left to discover it.
        nestedScrollEnabled
        // Bounces only when there is something below to reach — never against an invisible wall.
        // See the chrome band for why `bounces={false}` is not set alongside it.
        alwaysBounceVertical={false}
        accessibilityRole="none"
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Yields at twice the chrome's rate, and never below the extent at which the Track, the position
  // rail and the target strip stop being one instrument.
  // T-12 re-anchor. `flexShrink: TIMELINE_ROW_SHRINK` and `minHeight: TIMELINE_ROW_POINTS` said the
  // instrument yields at twice the orientation's rate and never below its own interactive minimum,
  // and BOTH claims are kept: the rate is still 2, and the minimum is still 136 wherever the surface
  // can afford it. What changed is where the height comes from. It was inferred from a `ScrollView`,
  // which reports none, so the claim was unenforceable — measured on a device this row reached ZERO
  // while carrying that very `minHeight`. The height is now the plan's allocation, which is computed
  // from the same frozen minimums before any region renders, so the guarantee is structural instead
  // of hopeful. The shrink rate stays because it still orders the two regions inside the plan.
  row: {
    flexShrink: TIMELINE_ROW_SHRINK,
    flexGrow: 0,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  scroller: { flexGrow: 0, flexShrink: 1 },
  content: { flexGrow: 1 },
});
