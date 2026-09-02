import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import type { LayoutDirection } from '../../shell/layoutDirection';
import type { FrameVM } from '../../schema/adapter';
import { surfaceProvenance } from '../../schema/honesty';
import { motion, palette, radius, space, type } from '../../theme/tokens';
import { useSurfaceMeasure } from '../measure';

interface EmergingFrameProps {
  frame: FrameVM;
  layout: LayoutDirection;
  dimmed: boolean;
  levelLabel: string;
}

/**
 * The heaviest surface on screen, and the one with the most to prove. It only reaches
 * here after the adapter has checked doc 05's threshold (two or more primary objects and
 * an INFERRED level), so the component's own job is only to arrive *slowly* — four times
 * the duration of a CARD, plus a delay — because a reading that gathers across several
 * beats should not pop in like a footnote.
 *
 * It also never reaches full opacity: `surfaceProvenance` holds an INFERRED-only frame
 * visibly below the strength of observed material.
 */
export function EmergingFrame({ frame, layout, dimmed, levelLabel }: EmergingFrameProps) {
  const { ref, onLayout } = useSurfaceMeasure(`frame:${frame.key}`);
  const provenance = surfaceProvenance(frame.levels);
  const reveal = useSharedValue(0);

  useEffect(() => {
    reveal.value = withDelay(
      motion.frameDelayMs,
      withTiming(1, { duration: motion.frameEnterMs })
    );
  }, [reveal]);

  const animated = useAnimatedStyle(() => ({
    opacity: reveal.value * (dimmed ? 0.35 : 1),
    transform: [{ scale: 0.985 + reveal.value * 0.015 }, { translateY: (1 - reveal.value) * 10 }],
  }));

  return (
    <View ref={ref} onLayout={onLayout} style={{ alignSelf: 'stretch' }}>
      <Animated.View
        style={[
          styles.frame,
          { borderColor: palette.inkFaint, backgroundColor: palette.paperSunk },
          animated,
        ]}
      >
        <View style={[styles.head, { flexDirection: layout.row }]}>
          <Text style={styles.chip}>{levelLabel}</Text>
          <Text style={styles.chip}>{provenance.label}</Text>
          <Text style={styles.chip}>{`×${frame.memberRefs.length}`}</Text>
        </View>
        <Text
          style={[
            styles.body,
            { writingDirection: layout.writingDirection, textAlign: layout.textAlign },
          ]}
        >
          {frame.text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    marginBottom: space.sm,
  },
  head: {
    alignItems: 'center',
    columnGap: space.md,
    marginBottom: space.sm,
  },
  chip: {
    fontSize: type.label,
    letterSpacing: 0.6,
    color: palette.inkFaint,
  },
  body: {
    fontSize: type.frame,
    lineHeight: type.frameLineHeight,
    color: palette.ink,
  },
});
