import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { LayoutDirection } from '../../shell/layoutDirection';
import { surfaceProvenance } from '../../schema/honesty';
import type { CardVM } from '../../schema/adapter';
import { motion, palette, radius, space, type } from '../../theme/tokens';
import { useSurfaceMeasure } from '../measure';

interface CardProps {
  card: CardVM;
  quote?: string;
  layout: LayoutDirection;
  dimmed: boolean;
}

/**
 * A CARD is a short remark set beside an anchor. It only ever exists because the beat
 * said `user_meaning.must_show_in_words` — the adapter drops it otherwise, so this
 * component never has to decide whether the analysis is allowed to speak.
 */
export function Card({ card, quote, layout, dimmed }: CardProps) {
  const { ref, onLayout } = useSurfaceMeasure(`card:${card.key}`);
  const provenance = surfaceProvenance(card.levels);
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withTiming(1, { duration: motion.cardEnterMs });
  }, [reveal]);

  const animated = useAnimatedStyle(() => ({
    opacity: reveal.value * (dimmed ? 0.35 : 1),
    transform: [{ translateY: (1 - reveal.value) * 6 }],
  }));

  return (
    <View ref={ref} onLayout={onLayout} style={{ alignSelf: layout.selfStart, maxWidth: '92%' }}>
      <Animated.View
        style={[
          styles.card,
          {
            borderColor: palette.rule,
            backgroundColor: palette.paperSunk,
            opacity: provenance.borderOpacity,
          },
          animated,
        ]}
      >
        <View style={[styles.head, { flexDirection: layout.row }]}>
          <Text style={styles.chip}>{provenance.label}</Text>
          {card.mandatory ? <Text style={styles.chipStrong}>REQUIRED</Text> : null}
        </View>
        {quote ? (
          <Text
            style={[
              styles.quote,
              { writingDirection: layout.writingDirection, textAlign: layout.textAlign },
            ]}
            numberOfLines={2}
          >
            {quote.trim()}
          </Text>
        ) : null}
        <Text
          style={[
            styles.body,
            { writingDirection: layout.writingDirection, textAlign: layout.textAlign },
          ]}
        >
          {card.text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  head: {
    alignItems: 'center',
    columnGap: space.sm,
    marginBottom: space.xs,
  },
  chip: {
    fontSize: type.label,
    letterSpacing: 0.6,
    color: palette.inkFaint,
  },
  chipStrong: {
    fontSize: type.label,
    letterSpacing: 0.6,
    color: palette.contradict,
  },
  quote: {
    fontSize: type.card,
    lineHeight: type.cardLineHeight,
    color: palette.inkFaint,
    fontStyle: 'italic',
    marginBottom: space.xs,
  },
  body: {
    fontSize: type.card,
    lineHeight: type.cardLineHeight,
    color: palette.inkSoft,
  },
});
