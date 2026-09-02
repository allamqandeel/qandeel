import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { LayoutDirection } from '../shell/layoutDirection';
import type { RenderState } from '../schema/adapter';
import type { TranscriptSpan } from '../schema/types';
import { palette, space, type } from '../theme/tokens';
import { lineRects, nearestLine, type Rect } from './geometry';
import { useRectRegistry } from './geometry';
import { SurfaceMeasureProvider } from './measure';
import { ThreadLayer, type Leader } from './ThreadLayer';
import { Card } from './primitives/Card';
import { EmergingFrame } from './primitives/EmergingFrame';
import { Meter } from './primitives/Meter';
import { OpenGap } from './primitives/OpenGap';
import { Spine } from './primitives/Spine';
import { Transcript, tokenKey } from './primitives/Transcript';

/** Width reserved beside the text for thread routing. */
const GUTTER = 46;

/** Upper bound on word views per transcript span when collecting measured rects. */
const MAX_TOKENS_PER_SPAN = 64;

interface AnalysisSurfaceProps {
  state: RenderState;
  spans: readonly TranscriptSpan[];
  layout: LayoutDirection;
  cursor: number;
  total: number;
  onScrub: (cursor: number) => void;
}

export function AnalysisSurface({
  state,
  spans,
  layout,
  cursor,
  total,
  onScrub,
}: AnalysisSurfaceProps) {
  const { t } = useTranslation();
  const { rects, report } = useRectRegistry();
  const surfaceRef = useRef<View | null>(null);
  const [size, setSize] = useState<LayoutRectangle | null>(null);
  const [tappedSpanId, setTappedSpanId] = useState<string | null>(null);
  const [epoch, setEpoch] = useState(0);

  // Anything that can move a measured node relative to the surface bumps the epoch, and
  // every measured node re-measures. The trailing bump catches the entrance animations
  // and the font settling, neither of which fires `onLayout`.
  useEffect(() => {
    setEpoch((value) => value + 1);
    const settle = setTimeout(() => setEpoch((value) => value + 1), 120);
    return () => clearTimeout(settle);
  }, [cursor, layout.isRTL, size?.width, size?.height, spans]);

  // A FOCUS beat and a user tap write to the same place; the user's tap wins, and clearing
  // it is always one control away (Task 01 §6 principle 2).
  const focusedSpanId = tappedSpanId ?? state.beatDrivenFocus;

  const measureValue = useMemo(
    () => ({ surfaceRef, report, epoch }),
    [report, epoch]
  );

  const spanText = useMemo(() => {
    const map = new Map<string, string>();
    for (const span of spans) map.set(span.span_id, span.text);
    return map;
  }, [spans]);

  /** Every span's word rects, folded to per-line rects. Already surface-relative. */
  const spanLines = useMemo(() => {
    const out = new Map<string, Rect[]>();
    for (const span of spans) {
      const tokens: Rect[] = [];
      for (let index = 0; index < MAX_TOKENS_PER_SPAN; index += 1) {
        const rect = rects[tokenKey(span.span_id, index)];
        if (!rect) break;
        tokens.push(rect);
      }
      if (tokens.length > 0) out.set(span.span_id, lineRects(tokens));
    }
    return out;
  }, [rects, spans]);

  /**
   * The thread gutter sits on the side reading starts from. It is derived from the
   * measured text column rather than from a left/right constant, so it follows the
   * mirrored layout instead of having to be told about it.
   */
  const gutterX = useMemo(() => {
    const lines = [...spanLines.values()].flat();
    if (lines.length === 0) return 0;
    const left = Math.min(...lines.map((r) => r.x));
    const right = Math.max(...lines.map((r) => r.x + r.width));
    return layout.isRTL ? right + GUTTER / 2 : left - GUTTER / 2;
  }, [spanLines, layout.isRTL]);

  const anchorLineFor = useCallback(
    (spanId: string, nearY: number): Rect | null => {
      const lines = spanLines.get(spanId);
      if (!lines?.length) return null;
      return nearestLine(lines, nearY);
    },
    [spanLines]
  );

  const brackets = useMemo<Leader[]>(() => {
    const out: Leader[] = [];
    for (const card of state.cards) {
      const from = rects[`card:${card.key}`];
      if (!from) continue;
      const to = anchorLineFor(card.objectRef, from.y);
      if (!to) continue;
      out.push({ key: card.key, from, to });
    }
    return out;
  }, [state.cards, rects, anchorLineFor]);

  const meterTraces = useMemo<Leader[]>(() => {
    const out: Leader[] = [];
    for (const meter of state.meters) {
      const causeRef = meter.steps[meter.steps.length - 1]?.causeRef;
      if (!causeRef) continue;
      const from = rects[`meter:${meter.meterKey}`];
      if (!from) continue;
      const to = anchorLineFor(causeRef, from.y);
      if (!to) continue;
      out.push({ key: meter.meterKey, from, to });
    }
    return out;
  }, [state.meters, rects, anchorLineFor]);

  const readingsCount = state.frames.length + state.gaps.length;

  return (
    <View
      ref={surfaceRef}
      collapsable={false}
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={styles.surface}
    >
      <SurfaceMeasureProvider value={measureValue}>
        <View style={[styles.transcriptRow, { flexDirection: layout.row }]}>
          <View style={{ width: GUTTER }} />
          <View style={styles.textColumn}>
            <Text style={[styles.sectionLabel, { textAlign: layout.textAlign }]}>
              {t('transcript.heading')}
            </Text>
            <Transcript
              spans={spans}
              anchors={state.anchors}
              layout={layout}
              focusedSpanId={focusedSpanId}
              onFocusSpan={setTappedSpanId}
            />
          </View>
        </View>

        <View style={styles.block}>
          {state.cards.map((card) => (
            <Card
              key={card.key}
              card={card}
              quote={spanText.get(card.objectRef)}
              layout={layout}
              dimmed={focusedSpanId !== null && focusedSpanId !== card.objectRef}
            />
          ))}
        </View>

        <View style={styles.block}>
          {state.meters.map((meter) => {
            const causeRef = meter.steps[meter.steps.length - 1]?.causeRef;
            return (
              <Meter
                key={meter.key}
                meter={meter}
                layout={layout}
                dimmed={focusedSpanId !== null && focusedSpanId !== causeRef}
                causeLabel={t('meter.cause')}
                unboundLabel={t('meter.unbound')}
                noScaleLabel={t('honesty.noScale')}
                causeQuote={causeRef ? spanText.get(causeRef) : undefined}
              />
            );
          })}
        </View>

        <View style={styles.block}>
          {readingsCount > 1 ? (
            <Text style={[styles.noRanking, { textAlign: layout.textAlign }]}>
              {t('focus.noRanking')}
            </Text>
          ) : null}
          {state.frames.map((frame) => (
            <EmergingFrame
              key={frame.key}
              frame={frame}
              layout={layout}
              dimmed={focusedSpanId !== null && !frame.memberRefs.includes(focusedSpanId)}
              levelLabel={t('legend.emergingFrame')}
            />
          ))}
          {state.gaps.map((gap) => (
            <OpenGap
              key={gap.key}
              gap={gap}
              layout={layout}
              dimmed={focusedSpanId !== null}
              stillOpenLabel={t('gap.stillOpen')}
            />
          ))}
        </View>

        <Spine
          markers={state.spine}
          cursor={cursor}
          total={total}
          layout={layout}
          heading={t('spine.heading')}
          scrubHint={t('spine.scrubHint')}
          onScrub={onScrub}
        />
      </SurfaceMeasureProvider>

      <ThreadLayer
        width={size?.width ?? 0}
        height={size?.height ?? 0}
        threads={state.threads}
        spanLines={spanLines}
        gutterX={gutterX}
        layout={layout}
        focusedSpanId={focusedSpanId}
        brackets={brackets}
        meterTraces={meterTraces}
      />

      {focusedSpanId !== null ? (
        <View style={[styles.focusBar, { flexDirection: layout.row }]}>
          <Text style={styles.focusLabel} numberOfLines={1}>
            {`${t('focus.focusedOn')}: ${(spanText.get(focusedSpanId) ?? focusedSpanId).trim()}`}
          </Text>
          <Text
            accessibilityRole="button"
            onPress={() => setTappedSpanId(null)}
            style={styles.focusBack}
          >
            {t('focus.backToWhole')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    position: 'relative',
    paddingVertical: space.md,
  },
  transcriptRow: {
    alignItems: 'flex-start',
  },
  textColumn: {
    flex: 1,
  },
  block: {
    marginTop: space.lg,
  },
  sectionLabel: {
    fontSize: type.label,
    letterSpacing: 1,
    color: palette.inkFaint,
    marginBottom: space.sm,
  },
  noRanking: {
    fontSize: type.label,
    lineHeight: type.label + 6,
    color: palette.inkFaint,
    marginBottom: space.sm,
  },
  focusBar: {
    marginTop: space.md,
    alignItems: 'center',
    columnGap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.rule,
    paddingTop: space.sm,
  },
  focusLabel: {
    flex: 1,
    fontSize: type.label,
    color: palette.inkSoft,
  },
  focusBack: {
    fontSize: type.label,
    letterSpacing: 0.4,
    color: palette.ink,
    textDecorationLine: 'underline',
  },
});
