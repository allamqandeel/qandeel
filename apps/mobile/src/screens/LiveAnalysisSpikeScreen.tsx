import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDirection } from '../shell/DirectionContext';
import { readReviewParams } from '../shell/reviewParams';
import { fixtureFor } from '../fixtures';
import { project } from '../schema/adapter';
import { AnalysisSurface } from '../render/AnalysisSurface';
import { HonestyPanel } from '../render/HonestyPanel';
import { Legend } from '../render/Legend';
import { palette, radius, space, type } from '../theme/tokens';

const BEAT_INTERVAL_MS = 1600;

export function LiveAnalysisSpikeScreen() {
  const { t } = useTranslation();
  const { language, layout, nativeMatches, toggleLanguage } = useDirection();
  const insets = useSafeAreaInsets();

  const fixture = useMemo(() => fixtureFor(language), [language]);
  const total = fixture.beats.length;

  // The cursor deliberately survives a language switch: the two fixtures share beat ids,
  // so the same moment can be compared in both directions without replaying.
  const [cursor, setCursor] = useState(() =>
    Math.min(readReviewParams().beats ?? 0, fixture.beats.length)
  );
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (cursor >= total) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setCursor((value) => value + 1), BEAT_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [playing, cursor, total]);

  const state = useMemo(() => project(fixture, cursor), [fixture, cursor]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.xl },
      ]}
    >
      <Text style={[styles.title, { textAlign: layout.textAlign }]}>{t('app.title')}</Text>
      <Text style={[styles.subtitle, { textAlign: layout.textAlign }]}>{t('app.subtitle')}</Text>
      <Text style={[styles.notice, { textAlign: layout.textAlign }]}>
        {t('app.placeholderNotice')}
      </Text>

      {!nativeMatches ? (
        <Text style={[styles.warning, { textAlign: layout.textAlign }]}>
          {t('direction.nativeMismatch')}
        </Text>
      ) : null}

      <View style={[styles.controls, { flexDirection: layout.row }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (cursor >= total) setCursor(0);
            setPlaying((value) => !value);
          }}
          style={styles.button}
        >
          <Text style={styles.buttonLabel}>
            {playing ? t('controls.pause') : t('controls.play')}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setPlaying(false);
            setCursor(0);
          }}
          style={styles.button}
        >
          <Text style={styles.buttonLabel}>{t('controls.restart')}</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={toggleLanguage} style={styles.button}>
          <Text style={styles.buttonLabel}>{t('controls.switchLanguage')}</Text>
        </Pressable>

        <Text style={styles.counter}>{t('controls.beatCount', { done: cursor, total })}</Text>
      </View>

      {cursor === 0 ? (
        <Text style={[styles.notice, { textAlign: layout.textAlign }]}>
          {t('transcript.waiting')}
        </Text>
      ) : null}

      <AnalysisSurface
        state={state}
        spans={fixture.transcript}
        layout={layout}
        cursor={cursor}
        total={total}
        onScrub={(next) => {
          setPlaying(false);
          setCursor(Math.max(0, Math.min(next, total)));
        }}
      />

      <HonestyPanel notes={state.notes} layout={layout} />
      <Legend layout={layout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.paper,
  },
  content: {
    paddingHorizontal: space.lg,
  },
  title: {
    fontSize: 22,
    color: palette.ink,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: type.label + 2,
    letterSpacing: 0.6,
    color: palette.inkFaint,
    marginTop: 2,
  },
  notice: {
    fontSize: type.label,
    lineHeight: type.label + 7,
    color: palette.inkFaint,
    marginTop: space.sm,
  },
  warning: {
    fontSize: type.label,
    lineHeight: type.label + 7,
    color: palette.contradict,
    marginTop: space.sm,
  },
  controls: {
    marginTop: space.md,
    alignItems: 'center',
    columnGap: space.sm,
    rowGap: space.sm,
    flexWrap: 'wrap',
  },
  button: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.inkSoft,
    borderRadius: radius.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  buttonLabel: {
    fontSize: type.label + 2,
    color: palette.ink,
  },
  counter: {
    fontSize: type.label,
    color: palette.inkFaint,
  },
});
