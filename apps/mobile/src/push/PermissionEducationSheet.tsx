/**
 * A3-02 — QANDEEL's permission education, BEFORE the platform prompt (I-08N-01 D50; P3 §11; P3-A EDU).
 *
 *   - a PASSAGE: a modal bottom sheet on the one Surface tone over one scrim; focus moves to its heading;
 *   - QANDEEL speaks in the first person and asks for a genuine decision — no fear, no guilt, no implication that the
 *     Product needs permission to work;
 *   - two text acts: «السماح بالإشعارات» / Allow notifications, which hands over to the REAL OS prompt (never drawn or
 *     imitated here), and «مش دلوقتي» / Not now, which keeps everything working; the scrim, Android's Back and the
 *     screen reader's escape gesture all mean "Not now";
 *   - every target is at least 44 pt; the sheet follows the non-Analysis appearance (it is never shown in the Analysis).
 *
 * The words are the A3-02 Product Copy Gate's (`copy.ts`). Geometry and the scrim strength are implementation craft.
 */
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, BackHandler, Pressable, StyleSheet, Text, View, findNodeHandle } from 'react-native';

import { Control, MIN_TARGET, typeStyle, usePalette, withAlpha } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { pushCopy } from './copy';

export const EDUCATION_SHEET_TEST_ID = 'qandeel-push-education';

export interface PermissionEducationSheetProps {
  readonly language: ChromeLanguage;
  readonly insets: { readonly bottom: number; readonly left: number; readonly right: number };
  readonly onAllow: () => void;
  readonly onNotNow: () => void;
}

export function PermissionEducationSheet({ language, insets, onAllow, onNotNow }: PermissionEducationSheetProps) {
  const palette = usePalette();
  const copy = pushCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const heading = useRef<Text>(null);

  useEffect(() => {
    const node = heading.current === null ? null : findNodeHandle(heading.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onNotNow();
      return true;
    });
    return () => subscription.remove();
  }, [onNotNow]);

  return (
    <View style={StyleSheet.absoluteFill} testID={EDUCATION_SHEET_TEST_ID}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha('#000000', 0.48) }]}
        onPress={onNotNow}
        accessible={false}
        importantForAccessibility="no"
      />
      <View
        accessibilityViewIsModal
        onAccessibilityEscape={onNotNow}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: palette.field, borderTopLeftRadius: 20,
          borderTopRightRadius: 20, paddingTop: 24, paddingBottom: insets.bottom + 16, paddingStart: insets.left + 24,
          paddingEnd: insets.right + 24, rowGap: 12, direction: writing,
        }}
      >
        <Text ref={heading} accessibilityRole="header" accessibilityLanguage={language} style={{ ...typeStyle('body'), fontWeight: '600', color: palette.primary, writingDirection: writing }}>
          {copy.eduTitle}
        </Text>
        <Text accessibilityLanguage={language} style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>
          {copy.eduBody}
        </Text>
        <View style={{ rowGap: 4, paddingTop: 4 }}>
          <Control palette={palette} language={language} accessibilityLabel={copy.eduAllow} onPress={onAllow} testID="qandeel-push-education-allow"
            style={{ minHeight: MIN_TARGET, justifyContent: 'center' }}>
            <Text style={{ ...typeStyle('body'), color: palette.selectedInk, writingDirection: writing }}>{copy.eduAllow}</Text>
          </Control>
          <Control palette={palette} language={language} accessibilityLabel={copy.eduNotNow} onPress={onNotNow} testID="qandeel-push-education-not-now"
            style={{ minHeight: MIN_TARGET, justifyContent: 'center' }}>
            <Text style={{ ...typeStyle('body'), color: palette.restInk, writingDirection: writing }}>{copy.eduNotNow}</Text>
          </Control>
        </View>
      </View>
    </View>
  );
}
