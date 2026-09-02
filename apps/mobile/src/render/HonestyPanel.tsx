import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { LayoutDirection } from '../shell/layoutDirection';
import type { HonestyNote } from '../schema/adapter';
import { palette, radius, space, type } from '../theme/tokens';

const REASON_KEY: Record<string, string> = {
  FRAME_THRESHOLD: 'honesty.reasonFrameThreshold',
  NO_ENDS: 'honesty.reasonNoGeometry',
  NO_WORDS: 'honesty.reasonNoGeometry',
  NO_STYLE: 'honesty.reasonNoGeometry',
};

/**
 * Task 01 §5 asks for the weight rule to be verified explicitly rather than asserted. This
 * panel is that verification, on screen rather than in a report: every cap the engine
 * applied and every primitive it refused to draw is listed with the beat that asked for
 * it. If it says nothing, nothing was asked for that the evidence could not carry.
 */
export function HonestyPanel({
  notes,
  layout,
}: {
  notes: readonly HonestyNote[];
  layout: LayoutDirection;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.panel}>
      <Text style={[styles.heading, { textAlign: layout.textAlign }]}>
        {t('honesty.heading')}
      </Text>

      {notes.length === 0 ? (
        <Text style={[styles.line, { textAlign: layout.textAlign }]}>{t('honesty.clean')}</Text>
      ) : (
        notes.map((note, index) => {
          if (note.kind === 'CAPPED') {
            return (
              <Text
                key={`note:${index}`}
                style={[styles.line, { textAlign: layout.textAlign }]}
              >
                {t('honesty.capped', {
                  primitive: note.primitive,
                  beat: note.beatId,
                  asked: note.asked,
                  drawn: note.drawn,
                  levels: note.levels.join(' + '),
                })}
              </Text>
            );
          }
          if (note.kind === 'DROPPED') {
            return (
              <Text
                key={`note:${index}`}
                style={[styles.line, { textAlign: layout.textAlign }]}
              >
                {t('honesty.dropped', {
                  primitive: note.primitive,
                  beat: note.beatId,
                  reason: t(REASON_KEY[note.reason] ?? 'honesty.reasonNoGeometry'),
                })}
              </Text>
            );
          }
          return (
            <Text key={`note:${index}`} style={[styles.line, { textAlign: layout.textAlign }]}>
              {`${note.primitive} · ${note.beatId} · REQUIRED`}
            </Text>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: space.xl,
    padding: space.md,
    borderRadius: radius.sm,
    backgroundColor: palette.paperSunk,
    rowGap: space.xs,
  },
  heading: {
    fontSize: type.label + 1,
    letterSpacing: 0.6,
    color: palette.inkSoft,
    marginBottom: space.xs,
  },
  line: {
    fontSize: type.label,
    lineHeight: type.label + 7,
    color: palette.inkFaint,
  },
});
