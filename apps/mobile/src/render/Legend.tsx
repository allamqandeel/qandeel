import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Canvas, DashPathEffect, Path } from '@shopify/react-native-skia';

import type { LayoutDirection } from '../shell/layoutDirection';
import type { ThreadStyle } from '../schema/types';
import { palette, radius, space, threadColor, type } from '../theme/tokens';
import { buildThreadGeometry } from './threadPaths';

const SWATCH_WIDTH = 70;
const SWATCH_HEIGHT = 30;

const THREAD_STYLES: ThreadStyle[] = ['SUPPORT', 'CONTRADICT', 'EVOLVE', 'CONNECT'];

/**
 * The thread swatches are drawn by the same `buildThreadGeometry` the surface uses, so
 * this is a sample of the real output rather than a hand-drawn approximation of it — if
 * two styles ever stop differing in shape, they stop differing here too.
 */
function ThreadSwatch({ style, isRTL }: { style: ThreadStyle; isRTL: boolean }) {
  const from = { x: isRTL ? SWATCH_WIDTH - 4 : 4, y: 6 };
  const to = { x: isRTL ? SWATCH_WIDTH - 4 : 4, y: SWATCH_HEIGHT - 6 };
  const gutterX = isRTL ? 18 : SWATCH_WIDTH - 18;
  const geometry = buildThreadGeometry(style, from, to, gutterX, isRTL);
  const color = threadColor[style];

  return (
    <Canvas style={{ width: SWATCH_WIDTH, height: SWATCH_HEIGHT }}>
      <Path path={geometry.path} color={color} style="stroke" strokeWidth={1.8} strokeCap="round">
        {geometry.dash ? <DashPathEffect intervals={geometry.dash} /> : null}
      </Path>
      {geometry.companion ? (
        <Path path={geometry.companion} color={color} style="stroke" strokeWidth={1.1} />
      ) : null}
      {geometry.head ? <Path path={geometry.head} color={color} style="fill" /> : null}
    </Canvas>
  );
}

export function Legend({ layout }: { layout: LayoutDirection }) {
  const { t } = useTranslation();

  const rows: Array<[string, string]> = [
    [t('legend.anchor'), t('legend.anchorGloss')],
    [t('legend.card'), t('legend.cardGloss')],
    [t('legend.thread'), t('legend.threadGloss')],
    [t('legend.meter'), t('legend.meterGloss')],
    [t('legend.spine'), t('legend.spineGloss')],
    [t('legend.emergingFrame'), t('legend.emergingFrameGloss')],
    [t('legend.openGap'), t('legend.openGapGloss')],
  ];

  return (
    <View style={styles.panel}>
      <Text style={[styles.heading, { textAlign: layout.textAlign }]}>{t('legend.heading')}</Text>

      {rows.map(([term, gloss]) => (
        <View key={term} style={[styles.row, { flexDirection: layout.row }]}>
          <Text style={styles.term}>{term}</Text>
          <Text style={[styles.gloss, { textAlign: layout.textAlign }]}>{gloss}</Text>
        </View>
      ))}

      <View style={[styles.swatches, { flexDirection: layout.row }]}>
        {THREAD_STYLES.map((style) => (
          <View key={style} style={styles.swatch}>
            <ThreadSwatch style={style} isRTL={layout.isRTL} />
            <Text style={styles.swatchLabel}>{t(`thread.${style}`)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: space.lg,
    padding: space.md,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.rule,
    rowGap: space.xs,
  },
  heading: {
    fontSize: type.label + 1,
    letterSpacing: 0.6,
    color: palette.inkSoft,
    marginBottom: space.xs,
  },
  row: {
    columnGap: space.sm,
    alignItems: 'baseline',
  },
  term: {
    width: 96,
    fontSize: type.label + 1,
    color: palette.ink,
  },
  gloss: {
    flex: 1,
    fontSize: type.label,
    lineHeight: type.label + 7,
    color: palette.inkFaint,
  },
  swatches: {
    marginTop: space.md,
    flexWrap: 'wrap',
    columnGap: space.md,
    rowGap: space.sm,
  },
  swatch: {
    alignItems: 'center',
    rowGap: 2,
  },
  swatchLabel: {
    fontSize: type.label,
    color: palette.inkFaint,
  },
});
