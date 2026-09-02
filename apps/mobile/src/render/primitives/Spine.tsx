import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { LayoutDirection } from '../../shell/layoutDirection';
import type { SpineMarkerVM } from '../../schema/adapter';
import { palette, radius, space, type } from '../../theme/tokens';

interface SpineProps {
  markers: readonly SpineMarkerVM[];
  /** How many beats have played. Markers beyond it are drawn as not-yet-reached. */
  cursor: number;
  total: number;
  layout: LayoutDirection;
  heading: string;
  scrubHint: string;
  onScrub: (cursor: number) => void;
}

/**
 * The persistent strip. Every beat leaves a mark here whether or not it drew anything
 * else, which is what makes it a record of the session rather than a summary of it.
 *
 * Time runs from the edge reading starts at towards the edge it ends at, so in Arabic the
 * session runs right to left. The scrub maths reads the resolved `flexDirection` rather
 * than the language, so it stays correct on an Arabic device showing English and vice
 * versa.
 */
export function Spine({
  markers,
  cursor,
  total,
  layout,
  heading,
  scrubHint,
  onScrub,
}: SpineProps) {
  const [width, setWidth] = useState(0);
  const firstAtLeft = layout.row === 'row';
  const widthRef = useRef(0);

  const scrubToX = useCallback(
    (x: number) => {
      const measured = widthRef.current;
      if (measured <= 0 || total <= 0) return;
      const raw = Math.min(1, Math.max(0, x / measured));
      const fraction = firstAtLeft ? raw : 1 - raw;
      onScrub(Math.round(fraction * total));
    },
    [firstAtLeft, onScrub, total]
  );

  // `runOnJS(true)` keeps the whole gesture on the JS thread: the scrub target is React
  // state, so there is nothing here that benefits from a worklet.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin((event) => scrubToX(event.x))
    .onUpdate((event) => scrubToX(event.x));

  return (
    <View style={styles.wrap}>
      <View style={[styles.head, { flexDirection: layout.row }]}>
        <Text style={styles.heading}>{heading}</Text>
        <Text style={styles.hint}>{scrubHint}</Text>
      </View>

      <GestureDetector gesture={pan}>
        <View
          onLayout={(event) => {
            widthRef.current = event.nativeEvent.layout.width;
            setWidth(event.nativeEvent.layout.width);
          }}
          style={[styles.track, { flexDirection: layout.row }]}
        >
          <View style={styles.rule} />
          {Array.from({ length: total }, (_, index) => {
            const marker = markers[index];
            const reached = index < cursor;
            const isCurrent = index === cursor - 1;
            const size = marker?.emphasized ? 11 : 7;
            return (
              <Pressable
                key={`spine:${index}`}
                onPress={() => onScrub(index + 1)}
                style={styles.slot}
                accessibilityRole="button"
              >
                <View
                  style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    borderWidth: reached ? 0 : StyleSheet.hairlineWidth,
                    borderColor: palette.rule,
                    backgroundColor: reached
                      ? isCurrent
                        ? palette.ink
                        : palette.inkSoft
                      : 'transparent',
                  }}
                />
              </Pressable>
            );
          })}
        </View>
      </GestureDetector>

      <Text style={[styles.caption, { textAlign: layout.textAlign, opacity: width > 0 ? 1 : 0 }]}>
        {markers[cursor - 1]?.beatKind ?? ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.rule,
    paddingTop: space.md,
    marginTop: space.md,
  },
  head: {
    alignItems: 'baseline',
    columnGap: space.md,
    marginBottom: space.sm,
  },
  heading: {
    fontSize: type.label + 1,
    letterSpacing: 0.6,
    color: palette.inkSoft,
  },
  hint: {
    flex: 1,
    fontSize: type.label,
    color: palette.inkFaint,
  },
  track: {
    height: 34,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  rule: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.rule,
  },
  slot: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    marginTop: space.xs,
    fontSize: type.label,
    letterSpacing: 0.6,
    color: palette.inkFaint,
  },
});
