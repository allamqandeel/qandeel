/**
 * T-11 — the band the support around the world is composed in.
 *
 * It frames the chrome; it never reaches inside it. T-08 owns what the chrome says, which acts it
 * offers, in what order and in what words, and it reads no width, no breakpoint and no measurement
 * to decide any of them. This band decides three things and only three: how much horizontal measure
 * the words get, how much room the band may take before the world would fall below its floor, and
 * whether the reader can reach content that exceeds it.
 *
 * ## Why a scroll container is always here, and why that hides nothing
 *
 * When space runs out the contract's own order is: remove whitespace, let text wrap, recompose,
 * stack, and let the Map show less. Every one of those is applied before this. What it cannot fix
 * is the extreme corner — every return act offered at once, the longest Arabic wording, the largest
 * text size, the shortest window — where the chrome's own natural height exceeds every point the
 * band can be given without erasing the world. The three ways of "solving" that are all forbidden:
 * hiding a control, truncating essential copy, and shrinking a touch target. Letting the reader
 * reach the content is the only remaining honest answer, and it removes nothing: every act stays
 * offered, every word stays whole, every target stays 44 points, and the screen-reader and keyboard
 * routes are untouched because reachable content is what they traverse.
 *
 * ## Why the band has no height CEILING
 *
 * An earlier version gave it one, computed from the window minus the Map's floor minus a CONSTANT
 * for the temporal surface. The visual proof refuted it in one frame: T-05's and T-06's accessible
 * non-drag routes are real, visible controls whose wording wraps, so the temporal surface is far
 * taller than any strip arithmetic predicts — and a ceiling derived from a wrong constant put the
 * bottom of the chrome off the screen entirely, which is the one outcome the whole contract
 * forbids. A number the layer cannot know is a number it must not assert.
 *
 * So the vertical arithmetic is left to the layout engine, which is the only thing that has
 * measured the words: the band SHRINKS into whatever the world and the temporal surface leave it,
 * clips to exactly that, and makes what does not fit reachable inside itself. The world keeps its
 * own floor through its frame's `minHeight`, so the two claims — the world never disappears, and no
 * act is ever unreachable — are both structural rather than both estimated.
 *
 * It is mounted UNCONDITIONALLY rather than swapped in under pressure. A conditional container
 * would change the element type above the chrome at a measurement threshold, which remounts it —
 * and a remount is a Product event here: T-08's retirement of a refused opportunity is identity-
 * compared local state, and a resize must not clear it. A container that is always present cannot.
 * When the content fits, nothing scrolls: there is nothing to scroll to, and the platform bounce
 * that would otherwise imply hidden content is turned off.
 *
 * Nothing in this file animates. A band that changed shape with a transition would make a window
 * resize read as navigation, and a window is not a destination.
 */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { CHROME_FLOOR_POINTS, type ChromeComposition, type SupportComposition } from './plan';

export const RESPONSIVE_CHROME_BAND_TEST_ID = 'qandeel-responsive-chrome-band';
export const RESPONSIVE_CHROME_MEASURE_TEST_ID = 'qandeel-responsive-chrome-measure';

export interface ResponsiveChromeBandProps {
  readonly chrome: ChromeComposition;
  /**
   * The room the plan gave this region.
   *
   * The band held no floor at all, and its height came from a `ScrollView` that reports none — so on
   * a device it resolved to ZERO while the chrome inside it was still mounted, and `overflow: hidden`
   * clipped away every orientation sentence and every return act. The allocation is now stated.
   */
  readonly support: SupportComposition;
  readonly children: ReactNode;
  readonly testID?: string;
}

export function ResponsiveChromeBand({ chrome, support, children, testID = RESPONSIVE_CHROME_BAND_TEST_ID }: ResponsiveChromeBandProps) {
  const across = support.arrangement === 'SIDE_BY_SIDE';
  return (
    <View
      testID={testID}
      style={[
        styles.band,
        {
          paddingHorizontal: chrome.paddingHorizontal,
          // Across, the two regions share one rhythm from the band above them and sit beside each
          // other, so the orientation takes no second gap of its own.
          marginTop: across ? 0 : chrome.gapPoints,
          // The START edge, never the left one: across, the orientation sits after the instrument in
          // reading order, which is the right-hand side in Arabic and the left-hand side in English.
          marginStart: across ? support.gapPoints : 0,
          width: across ? support.chromeWidthPoints : undefined,
          height: support.chromePoints,
          minHeight: Math.min(CHROME_FLOOR_POINTS, support.chromePoints),
        },
      ]}
      // The band claims no touch of its own, exactly as the chrome inside it does not: a press that
      // reaches neither a control nor the scroller belongs to whatever is underneath.
      pointerEvents="box-none"
    >
      <ScrollView
        style={styles.scroller}
        contentContainerStyle={styles.content}
        // No bounce when there is NOTHING to reach: a surface that springs back implies content
        // below it, and implying content that does not exist is its own small untruth. That is
        // exactly what `alwaysBounceVertical={false}` says, and it is the whole of what is wanted.
        //
        // `bounces={false}` is deliberately NOT set with it. It would remove the rubber-band at the
        // boundary in the one case that matters — when the band really is holding more than it can
        // show — and a scroll that ends against an invisible wall is the hard stop nothing physical
        // has. The reader reaches the end of their own return acts; they should feel the end, not
        // hit it.
        alwaysBounceVertical={false}
        // The band is a layout container. Its children carry every accessible route, and a
        // container that named itself would become a node a screen reader stops on instead of
        // traversing into.
        accessibilityRole="none"
      >
        <View testID={RESPONSIVE_CHROME_MEASURE_TEST_ID} style={[styles.measure, { maxWidth: chrome.measurePoints }]} pointerEvents="box-none">
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // The band yields, and it clips to what it was given. `flexShrink: 1` is what makes the world's
  // floor hold — the world is sized first, and the support around it takes the remainder — and
  // `overflow: 'hidden'` is what guarantees the alternative is REACHABLE rather than off the
  // screen: whatever does not fit is inside the scroller, not below the surface.
  // T-12 re-anchor. The band still yields and still clips to the room it was given — `flexShrink: 1`
  // and `overflow: 'hidden'` are unchanged, and so is the rule that whatever does not fit stays
  // reachable inside the scroller rather than below the surface. What changed is that the room is now
  // GIVEN rather than inferred: this band had no floor of any kind, its height came from a scroller
  // that reports none, and measured on a device it resolved to zero with the chrome still mounted
  // inside it — which took every return act off the surface. `flexShrink: 0` here would have been the
  // wrong repair, because the band must still be able to yield; what it must not do is start from
  // nothing.
  band: { flexShrink: 1, flexGrow: 0, overflow: 'hidden' },
  scroller: { flexGrow: 0, flexShrink: 1 },
  content: { flexGrow: 1 },
  // The reading measure, centred. On a narrow surface the ceiling is the surface, so this is the
  // full width and the chrome is exactly what T-08 laid out; on an expansive one the extra width
  // becomes air on either side of the same words rather than longer lines.
  measure: { width: '100%', alignSelf: 'center' },
});
