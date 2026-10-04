/**
 * A3-01 — the call-safe strip (P3 §9), built as a reusable, truth-safe component and NOT MOUNTED on any Product route.
 *
 * No canonical Live Call authority exists on `main` (`QAN-BL-VOICE-01`), so nothing in production can truthfully say a
 * call is active (`call-truth.ts`). This component is therefore proved with validation fixtures only; the future
 * Stage 8 call owner mounts it, under these frozen rules, which it already implements:
 *
 *   - only the two call-safe exceptions reach it (a genuinely critical security / account event; an exact-time reminder
 *     the reader explicitly requested) — `decidePresentation` decides that, never this view;
 *   - dismiss ONLY: there is no Direct Entry, the body is text, and dismissing resolves nothing and ends no call;
 *   - nonmodal and transient: never a takeover, a full-screen interruption or a replacement for the call; no Brass, no
 *     red, no pulse, no bounce;
 *   - announced once through the one polite announcement, with its own region name, never through the call's own
 *     live-status channel;
 *   - in the Analysis it may temporarily occlude the Replay slot only, and steps aside when that slot takes focus — the
 *     geometry is the future mount's, measured on G3's own chrome (P3 §9.1).
 */
import { useEffect } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';

import { Control, MIN_TARGET, typeStyle, usePalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import type { ActivityItem } from '../runtime-entry';
import { pick, sourceOf } from './AttentionStrip';
import { activityCopy } from './copy';

export const CALL_SAFE_STRIP_TEST_ID = 'qandeel-call-safe-strip';

export interface CallSafeStripProps {
  readonly item: ActivityItem;
  readonly language: ChromeLanguage;
  readonly onDismiss: () => void;
}

export function CallSafeStrip({ item, language, onDismiss }: CallSafeStripProps) {
  const palette = usePalette();
  const copy = activityCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const sentence = pick(item.body, language);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`${copy.callSafeRegion}: ${sentence}`);
    // Announced once, on appearance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View
      testID={CALL_SAFE_STRIP_TEST_ID}
      accessibilityRole="summary"
      accessibilityLabel={copy.callSafeRegion}
      accessibilityLanguage={language}
      style={{ minHeight: MIN_TARGET, borderRadius: 14, backgroundColor: palette.field, flexDirection: 'row', alignItems: 'center', direction: writing, paddingStart: 12 }}
    >
      {/* Text only: no Direct Entry from a call-safe strip. */}
      <Text testID="qandeel-call-safe-strip-text" numberOfLines={2} style={{ flex: 1, ...typeStyle('supporting'), color: palette.primary, writingDirection: writing }}>
        {`${sourceOf(item, language)} · ${sentence}`}
      </Text>
      <Control
        palette={palette}
        language={language}
        accessibilityLabel={copy.stripDismiss}
        onPress={onDismiss}
        testID="qandeel-call-safe-strip-dismiss"
        style={{ minWidth: MIN_TARGET, minHeight: MIN_TARGET, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ ...typeStyle('metadata'), color: palette.restInk }}>{copy.stripDismiss}</Text>
      </Control>
    </View>
  );
}
