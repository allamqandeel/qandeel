import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { anchorEmphasis, palette, space, type } from '../../theme/tokens';
import type { LayoutDirection } from '../../shell/layoutDirection';
import type { AnchorVM } from '../../schema/adapter';
import { weightRank } from '../../schema/honesty';
import type { TranscriptSpan } from '../../schema/types';
import { useSurfaceMeasure } from '../measure';

/**
 * The transcript is laid out one word-view per word rather than as a single `<Text>`.
 * That is what makes ANCHOR spans measurable: threads and card brackets need real
 * on-screen rects for their endpoints, and a nested `<Text>` cannot report one. Arabic
 * shaping is unaffected — letters join inside a word, never across the space between two.
 */
const TOKEN_RE = /\s*\S+\s*|\s+/g;

function tokenize(text: string): string[] {
  const matches = text.match(TOKEN_RE);
  return matches && matches.length > 0 ? matches : [text];
}

export function tokenKey(spanId: string, index: number): string {
  return `token:${spanId}#${index}`;
}

interface TokenProps {
  id: string;
  text: string;
  anchor: AnchorVM | undefined;
  focused: boolean;
  anyFocus: boolean;
  layout: LayoutDirection;
  onPress: () => void;
}

function Token({ id, text, anchor, focused, anyFocus, layout, onPress }: TokenProps) {
  const { ref, onLayout } = useSurfaceMeasure(id);
  const emphasis = anchor ? anchorEmphasis[anchor.weight.drawn] : null;
  const isPast = anchor?.role === 'PAST';

  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.value = withTiming(anchor ? 1 : 0, { duration: 240 });
  }, [anchor, reveal]);

  // Focus dims everything that is not the focused span; nothing is ever hidden, so the
  // way back is always visible (Task 01 §6 principle 2).
  const dim = anyFocus && !focused ? 0.32 : 1;
  const pastDim = isPast ? 0.62 : 1;

  const washStyle = useAnimatedStyle(() => ({
    opacity: reveal.value * (emphasis?.backgroundOpacity ?? 0),
  }));

  const ruleStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    height: emphasis?.underlineWidth ?? 0,
  }));

  return (
    <Pressable onPress={onPress} disabled={!anchor}>
      <View ref={ref} testID={id} onLayout={onLayout} style={{ opacity: dim * pastDim }}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: palette.ink, borderRadius: 2, pointerEvents: 'none' },
            washStyle,
          ]}
        />
        <Text
          style={{
            fontSize: type.transcript,
            lineHeight: type.transcriptLineHeight,
            color: palette.ink,
            fontWeight: emphasis?.fontWeight ?? '400',
            writingDirection: layout.writingDirection,
          }}
        >
          {text}
        </Text>
        {emphasis ? (
          <Animated.View
              style={[
              {
                position: 'absolute',
                pointerEvents: 'none',
                left: 0,
                right: 0,
                bottom: 2,
                backgroundColor: emphasis.underlineDashed ? 'transparent' : palette.ink,
                borderBottomWidth: emphasis.underlineDashed ? emphasis.underlineWidth : 0,
                borderBottomColor: palette.inkSoft,
                borderStyle: emphasis.underlineDashed ? 'dashed' : 'solid',
              },
              ruleStyle,
            ]}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

interface TranscriptProps {
  spans: readonly TranscriptSpan[];
  anchors: readonly AnchorVM[];
  layout: LayoutDirection;
  focusedSpanId: string | null;
  onFocusSpan: (spanId: string | null) => void;
}

export function Transcript({
  spans,
  anchors,
  layout,
  focusedSpanId,
  onFocusSpan,
}: TranscriptProps) {
  // One anchor wins per span: the strongest drawn weight, so a span touched by two beats
  // is not quietly re-emphasised twice.
  const anchorBySpan = useMemo(() => {
    const map = new Map<string, AnchorVM>();
    for (const anchor of anchors) {
      const current = map.get(anchor.spanId);
      if (!current || weightRank(anchor.weight.drawn) > weightRank(current.weight.drawn)) {
        map.set(anchor.spanId, anchor);
      }
    }
    return map;
  }, [anchors]);

  return (
    <View style={[styles.row, { flexDirection: layout.row }]}>
      {spans.map((span) =>
        tokenize(span.text).map((text, index) => (
          <Token
            key={tokenKey(span.span_id, index)}
            id={tokenKey(span.span_id, index)}
            text={text}
            anchor={anchorBySpan.get(span.span_id)}
            focused={focusedSpanId === span.span_id}
            anyFocus={focusedSpanId !== null}
            layout={layout}
            onPress={() =>
              onFocusSpan(focusedSpanId === span.span_id ? null : span.span_id)
            }
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    columnGap: 0,
    rowGap: space.xs,
  },
});
