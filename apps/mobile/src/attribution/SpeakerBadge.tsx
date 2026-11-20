/**
 * COSMOS-FINAL-01 E-1 — the speaker badge: one small circle, merged into the turn at its outer edge, level with the
 * turn's first line. It is a visual mark only; the turn's own accessible name already says who spoke, so the badge is
 * hidden from assistive technology.
 */
import { Text, View } from 'react-native';

import { useSurfaceAppearance } from '../appearance';
import { TYPEFACE } from '../conversation/visual/theme';
import { SPEAKER_TONES, type SpeakerTone } from './speaker';

/** The badge's diameter, in points, and the space between it and the turn's words. */
export const SPEAKER_BADGE_SIZE = 22;
export const SPEAKER_BADGE_GAP = 8;

export function SpeakerBadge({ initials, tone, lineHeight, testID }: {
  readonly initials: string;
  readonly tone: SpeakerTone;
  /** The first line's height, so the badge is centred on it. */
  readonly lineHeight: number;
  readonly testID?: string;
}) {
  const { fill, ink } = SPEAKER_TONES[useSurfaceAppearance()][tone];
  return (
    <View
      testID={testID}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: SPEAKER_BADGE_SIZE,
        height: SPEAKER_BADGE_SIZE,
        borderRadius: SPEAKER_BADGE_SIZE / 2,
        marginTop: Math.max(0, (lineHeight - SPEAKER_BADGE_SIZE) / 2),
        backgroundColor: fill,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initials === '' ? null : (
        <Text
          testID={testID === undefined ? undefined : `${testID}-initials`}
          numberOfLines={1}
          maxFontSizeMultiplier={1}
          style={{ fontFamily: TYPEFACE.medium, fontSize: 9.5, lineHeight: 13, includeFontPadding: false, color: ink, textAlign: 'center' }}
        >
          {initials}
        </Text>
      )}
    </View>
  );
}
