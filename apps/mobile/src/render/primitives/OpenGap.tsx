import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { LayoutDirection } from '../../shell/layoutDirection';
import type { GapVM } from '../../schema/adapter';
import { palette, radius, space, type } from '../../theme/tokens';

interface OpenGapProps {
  gap: GapVM;
  layout: LayoutDirection;
  dimmed: boolean;
  stillOpenLabel: string;
}

/**
 * Task 01 §6 principle 5: this must look genuinely unresolved, not stylistically cute.
 *
 * So it gets the opposite of every affordance a CARD gets — no fill, a dashed edge that
 * does not close on the reading-end side, the faintest ink in the palette, and no
 * provenance chip, because a chip reads as a credential. It settles at 0.72 opacity and
 * never reaches full strength.
 */
export function OpenGap({ gap, layout, dimmed, stillOpenLabel }: OpenGapProps) {
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withTiming(1, { duration: 420 });
  }, [reveal]);

  const animated = useAnimatedStyle(() => ({
    opacity: reveal.value * 0.72 * (dimmed ? 0.45 : 1),
  }));

  return (
    <Animated.View
      style={[
        styles.gap,
        {
          // The edge is left open on the side the eye leaves by: the marker is literally
          // unfinished, not a box with a dashed skin. `start`/`end` here are resolved by
          // the NATIVE direction, so they are swapped when the two disagree.
          borderStartWidth: layout.mirrored ? 0 : 1,
          borderEndWidth: layout.mirrored ? 1 : 0,
          alignSelf: layout.selfStart,
        },
        animated,
      ]}
    >
      <View style={[styles.head, { flexDirection: layout.row }]}>
        <Text style={styles.marker}>{gap.variant === 'QUESTION' ? '?' : '—'}</Text>
        <Text style={styles.label}>{stillOpenLabel}</Text>
      </View>
      <Text
        style={[
          styles.body,
          { writingDirection: layout.writingDirection, textAlign: layout.textAlign },
        ]}
      >
        {gap.text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  gap: {
    borderBottomWidth: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.gap,
    borderRadius: radius.sm,
    backgroundColor: 'transparent',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
    maxWidth: '92%',
  },
  head: {
    alignItems: 'center',
    columnGap: space.sm,
    marginBottom: space.xs,
  },
  marker: {
    fontSize: type.label + 2,
    color: palette.gap,
  },
  label: {
    fontSize: type.label,
    letterSpacing: 0.6,
    color: palette.gap,
  },
  body: {
    fontSize: type.card,
    lineHeight: type.cardLineHeight,
    color: palette.gap,
  },
});
