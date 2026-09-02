import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import type { LayoutDirection } from '../../shell/layoutDirection';
import type { MeterVM } from '../../schema/adapter';
import { motion, palette, radius, space, type } from '../../theme/tokens';
import { useSurfaceMeasure } from '../measure';

const TRACK_HEIGHT = 96;
const MARKER = 11;

interface MeterProps {
  meter: MeterVM;
  layout: LayoutDirection;
  dimmed: boolean;
  causeLabel: string;
  unboundLabel: string;
  noScaleLabel: string;
  causeQuote?: string;
}

/**
 * The schema gives a meter a `meter_key`, a `delta_hint` of UP/DOWN/UNCHANGED and a
 * `cause_object_ref`. It gives no value, no range and no unit — so this draws no
 * percentage, no fill and no number, because there is none to draw. What it shows is the
 * ladder of moves that were actually recorded, on an axis with no labels, plus the
 * anchor each move traces back to.
 *
 * Inventing a scale here would be the single easiest way to break Task 01 §5, and it
 * would look better than the honest version. That is exactly why it is not done.
 */
export function Meter({
  meter,
  layout,
  dimmed,
  causeLabel,
  unboundLabel,
  noScaleLabel,
  causeQuote,
}: MeterProps) {
  const { ref, onLayout } = useSurfaceMeasure(`meter:${meter.meterKey}`);
  const { cumulative, range, latest } = useMemo(() => {
    let running = 0;
    let peak = 1;
    for (const step of meter.steps) {
      running += step.delta === 'UP' ? 1 : step.delta === 'DOWN' ? -1 : 0;
      peak = Math.max(peak, Math.abs(running));
    }
    return {
      cumulative: running,
      range: Math.max(2, peak),
      latest: meter.steps[meter.steps.length - 1],
    };
  }, [meter.steps]);

  const travel = TRACK_HEIGHT / 2 - MARKER;
  const offset = useSharedValue(0);

  useEffect(() => {
    // Down is down. The sign is inverted because screen y grows downward.
    offset.value = withTiming(-(cumulative / range) * travel, { duration: motion.meterMs });
  }, [cumulative, range, travel, offset]);

  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  return (
    <View
      ref={ref}
      onLayout={onLayout}
      style={[styles.panel, { flexDirection: layout.row, opacity: dimmed ? 0.35 : 1 }]}
    >
      <View style={styles.trackColumn}>
        <View style={styles.track} />
        <View style={styles.origin} />
        <Animated.View style={[styles.marker, markerStyle]} />
      </View>

      <View style={styles.info}>
        {/* A machine key, shown as a machine key — never translated into a friendly noun
            the schema did not authorise. */}
        <Text style={[styles.key, { textAlign: layout.textAlign }]}>{meter.meterKey}</Text>

        <View style={[styles.deltaRow, { flexDirection: layout.row }]}>
          {meter.steps.map((step, index) => (
            <Text key={`${step.beatId}:${index}`} style={styles.delta}>
              {step.delta === 'UP' ? '▲' : step.delta === 'DOWN' ? '▼' : '·'}
            </Text>
          ))}
        </View>

        <Text style={[styles.caption, { textAlign: layout.textAlign }]}>{noScaleLabel}</Text>

        <Text style={[styles.caption, { textAlign: layout.textAlign }]}>
          {latest?.causeRef
            ? `${causeLabel}: ${causeQuote ? causeQuote.trim() : latest.causeRef}`
            : unboundLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignItems: 'center',
    columnGap: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.rule,
    borderRadius: radius.sm,
    padding: space.md,
    marginBottom: space.sm,
  },
  trackColumn: {
    width: 24,
    height: TRACK_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    width: StyleSheet.hairlineWidth,
    height: TRACK_HEIGHT,
    backgroundColor: palette.rule,
  },
  origin: {
    position: 'absolute',
    width: 14,
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.rule,
  },
  marker: {
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    backgroundColor: palette.ink,
  },
  info: {
    flex: 1,
    rowGap: space.xs,
  },
  key: {
    fontSize: type.label + 1,
    letterSpacing: 0.4,
    color: palette.inkSoft,
    fontFamily: undefined,
  },
  deltaRow: {
    columnGap: space.xs,
    alignItems: 'center',
  },
  delta: {
    fontSize: type.label,
    color: palette.inkSoft,
  },
  caption: {
    fontSize: type.label,
    lineHeight: type.label + 6,
    color: palette.inkFaint,
  },
});
