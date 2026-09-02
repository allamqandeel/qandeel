import { useEffect } from 'react';
import { Canvas, DashPathEffect, Group, Path, type SkPath } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, withTiming } from 'react-native-reanimated';

import type { LayoutDirection } from '../shell/layoutDirection';
import type { ThreadVM } from '../schema/adapter';
import { motion, palette, threadColor } from '../theme/tokens';
import {
  nearestLine,
  readingStartEdge,
  readingStartFoot,
  rectCenter,
  type Rect,
} from './geometry';
import { buildThreadGeometry, leaderPath } from './threadPaths';

export interface Leader {
  key: string;
  from: Rect;
  to: Rect;
}

interface ThreadLayerProps {
  width: number;
  height: number;
  threads: readonly ThreadVM[];
  /** Per-line rects, in surface coordinates, keyed by span id. */
  spanLines: ReadonlyMap<string, Rect[]>;
  gutterX: number;
  layout: LayoutDirection;
  focusedSpanId: string | null;
  /** Hairline brackets tying a CARD to the anchor it annotates. */
  brackets: readonly Leader[];
  /** Hairline traces tying a METER to its `cause_object_ref`. */
  meterTraces: readonly Leader[];
}

function TrimmedPath({
  path,
  color,
  strokeWidth,
  dash,
  opacity,
  filled = false,
  animate = true,
}: {
  path: SkPath;
  color: string;
  strokeWidth: number;
  dash?: number[];
  opacity: number;
  filled?: boolean;
  animate?: boolean;
}) {
  // The stroke draws itself on rather than appearing whole: a relation being asserted is
  // a moment, and the eye should be able to follow where it came from.
  const progress = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    progress.value = withTiming(1, { duration: animate ? motion.threadDrawMs : 0 });
  }, [progress, animate]);
  // Skia reads the trim through a derived value: a bare shared value passed straight to
  // `end` settles on web without the canvas being asked to repaint, which leaves the
  // stroke frozen part-drawn.
  const end = useDerivedValue(() => progress.value);

  return (
    <Path
      path={path}
      end={end}
      color={color}
      opacity={opacity}
      style={filled ? 'fill' : 'stroke'}
      strokeWidth={strokeWidth}
      strokeCap="round"
      strokeJoin="round"
    >
      {dash ? <DashPathEffect intervals={dash} /> : null}
    </Path>
  );
}

function leaderFor(from: Rect, to: Rect, isRTL: boolean): SkPath {
  return leaderPath(readingStartEdge(from, isRTL), readingStartEdge(to, isRTL));
}

/**
 * One canvas over the whole analysis surface. Everything drawn here is positioned from
 * measured layout rects, never from a language check — which is what makes the RTL claim
 * real: mirror the layout and the same code produces a mirrored route, because the
 * numbers it is given have changed.
 */
export function ThreadLayer({
  width,
  height,
  threads,
  spanLines,
  gutterX,
  layout,
  focusedSpanId,
  brackets,
  meterTraces,
}: ThreadLayerProps) {
  if (width <= 0 || height <= 0) return null;

  return (
    // A plain style object, not an array: Skia's web Canvas forwards `style` straight to
    // the DOM node, and an array lands as numeric keys on CSSStyleDeclaration.
    <Canvas
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
        pointerEvents: 'none',
      }}
    >
      <Group>
        {meterTraces.map((trace) => (
          <TrimmedPath
            key={`trace:${trace.key}`}
            path={leaderFor(trace.from, trace.to, layout.isRTL)}
            color={palette.inkFaint}
            strokeWidth={1}
            dash={[1, 4]}
            opacity={focusedSpanId ? 0.3 : 0.55}
            animate={false}
          />
        ))}

        {brackets.map((bracket) => (
          <TrimmedPath
            key={`bracket:${bracket.key}`}
            path={leaderFor(bracket.from, bracket.to, layout.isRTL)}
            color={palette.rule}
            strokeWidth={1}
            opacity={focusedSpanId ? 0.3 : 0.8}
            animate={false}
          />
        ))}

        {threads.map((thread, index) => {
          const fromLines = spanLines.get(thread.fromRef);
          const toLines = spanLines.get(thread.toRef);
          if (!fromLines?.length || !toLines?.length) return null;

          const toAnchorLine = nearestLine(toLines, rectCenter(fromLines[0] as Rect).y);
          const fromAnchorLine = nearestLine(
            fromLines,
            rectCenter((toAnchorLine ?? toLines[0]) as Rect).y
          );
          if (!fromAnchorLine || !toAnchorLine) return null;

          // Two beats can relate the same pair of anchors — here `RECALL` connects them
          // and `CONTRADICT` opposes them. Sharing one route would stack the strokes
          // exactly on top of each other and lose one of the two relations, so each gets
          // its own lane, laid further out into the gutter and never back over the text.
          const laneX = gutterX + (layout.isRTL ? 1 : -1) * index * 9;

          const geometry = buildThreadGeometry(
            thread.style,
            readingStartFoot(fromAnchorLine, layout.isRTL),
            readingStartFoot(toAnchorLine, layout.isRTL),
            laneX,
            layout.isRTL
          );

          const touchesFocus =
            focusedSpanId === null ||
            thread.fromRef === focusedSpanId ||
            thread.toRef === focusedSpanId;
          const opacity = touchesFocus ? 1 : 0.18;
          const color = threadColor[thread.style];

          return (
            <Group key={thread.key}>
              <TrimmedPath
                path={geometry.path}
                color={color}
                strokeWidth={thread.strokeWidth}
                dash={geometry.dash}
                opacity={opacity}
              />
              {geometry.companion ? (
                <TrimmedPath
                  path={geometry.companion}
                  color={color}
                  strokeWidth={thread.strokeWidth * 0.6}
                  opacity={opacity}
                />
              ) : null}
              {geometry.head ? (
                <TrimmedPath
                  path={geometry.head}
                  color={color}
                  strokeWidth={0}
                  opacity={opacity}
                  filled
                  animate={false}
                />
              ) : null}
            </Group>
          );
        })}
      </Group>
    </Canvas>
  );
}
