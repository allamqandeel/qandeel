/**
 * S5-03B — the stable place of the reader's own Experience, drawn inside the S5-02 review once QANDEEL's understanding of
 * that exact version is ready (S5-03A).
 *
 * One heading, one line saying the place comes from meaning alone and can't be chosen by hand, and either "ask QANDEEL to
 * find its place" or "its place is ready". The place itself is never shown, chosen, dragged or described here: no map,
 * coordinate, region, neighbour, rank or model appears, and nothing says the Experience is published (the review keeps
 * the S5-02 "not published yet" line). Arabic and English. Hardware Back is not registered (the S5-01 rule).
 */
import { Text, View } from 'react-native';

import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { publicFieldCopy } from '../public-world/field/field-copy';
import type { PublicSpatialPreparation } from '../runtime-entry';

const ROW_START = 24;
const ROW_END = 20;
const BUSY_OPACITY = 0.6;

export function PublicPlacePreparation({ place, palette, language, busy, onPrepare }: {
  readonly place: PublicSpatialPreparation; readonly palette: ConversationPalette; readonly language: ChromeLanguage;
  readonly busy: boolean; readonly onPrepare: () => void;
}) {
  const copy = publicFieldCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  // Not ready, or nothing to say: the stage is not drawn.
  if (place !== 'NOT_PLACED' && place !== 'PLACED') return null;
  const line = (text: string, color: string, testID?: string) => (
    <Text testID={testID} accessibilityLanguage={language}
      style={{ ...typeStyle('supporting'), color, paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 4, writingDirection: writing }}>
      {text}
    </Text>
  );
  return (
    <View testID="qandeel-public-place">
      <Text accessibilityRole="header" accessibilityLanguage={language}
        style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 22, paddingBottom: 6, writingDirection: writing }}>
        {copy.placeHeading}
      </Text>
      {line(copy.placeExplain, palette.secondary)}
      {place === 'PLACED' ? line(copy.placeReady, palette.primary, 'qandeel-public-place-ready') : (
        <View style={{ paddingStart: ROW_START - 16, paddingVertical: 4 }}>
          <Control palette={palette} language={language} accessibilityLabel={copy.placeAsk} onPress={onPrepare} testID="qandeel-public-place-ask"
            accessibilityState={{ busy }} style={{ alignSelf: 'flex-start', paddingHorizontal: 16, minHeight: MIN_TARGET, opacity: busy ? BUSY_OPACITY : 1 }}>
            <Text style={{ ...typeStyle('action'), color: palette.primary, writingDirection: writing }}>{copy.placeAsk}</Text>
          </Control>
        </View>
      )}
    </View>
  );
}
