/**
 * A3-01 — the global «النشاط» / Activity entry (P3 §3, §5.1, §6, §16).
 *
 *   - ONE independent icon-only control, handed to the non-Analysis upper chrome for its START edge. It is not a World,
 *     not a Global Switcher destination, and the Analysis never receives it.
 *   - Open Ledger, in the rest ink, in every state; never Living Brass; never mirrored.
 *   - The attention mark is a neutral PRESENCE mark: a small solid dot in primary ink at the glyph's upper END corner,
 *     knocked out of the chrome ground by a ring — a shape, never a colour alone, never a number, never red, never
 *     Brass, never a pulse. Its arrival is a calm fade (opacity only under Reduced Motion is the same act).
 *   - The accessible name carries the state: «فتح النشاط، هناك جديد» / "Open Activity, new items".
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AccessibilityInfo, View, findNodeHandle } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Control, MIN_TARGET, useIncreasedContrast, usePalette, useReduceMotion } from '../conversation';
import { P3Glyph } from '../iconography';
import type { ChromeLanguage } from '../orientation-chrome';
import type { ActivityAttentionController } from './attention-controller';
import { activityCopy } from './copy';

export const ACTIVITY_ENTRY_TEST_ID = 'qandeel-activity-entry';
/** P3-A reference craft (not Product law): the mark's arrival. */
const MARK_ARRIVAL_MS = 220;
const MARK_ARRIVAL_REDUCED_MS = 160;

export function AttentionMark({ present, ground, size, testID }: { readonly present: boolean; readonly ground: string; readonly size?: number; readonly testID?: string }) {
  const palette = usePalette();
  const increased = useIncreasedContrast();
  const reduceMotion = useReduceMotion();
  const dot = size ?? (increased ? 7 : 6);
  const shown = useSharedValue(present ? 1 : 0);
  useEffect(() => {
    shown.set(withTiming(present ? 1 : 0, { duration: reduceMotion ? MARK_ARRIVAL_REDUCED_MS : MARK_ARRIVAL_MS, reduceMotion: ReduceMotion.Never }));
  }, [present, reduceMotion, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    // Reduced Motion: the same mark, fading only.
    transform: [{ scale: reduceMotion ? 1 : 0.6 + 0.4 * shown.get() }],
  }));
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[{ width: dot + 4, height: dot + 4, borderRadius: (dot + 4) / 2, backgroundColor: ground, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: palette.primary }} />
    </Animated.View>
  );
}

export interface ActivityEntryProps {
  readonly controller: ActivityAttentionController;
  readonly language: ChromeLanguage;
  readonly onOpen: () => void;
  /** Return the screen reader here once, when the reader comes back from Activity. */
  readonly focus?: boolean;
}

export function ActivityEntry({ controller, language, onOpen, focus = false }: ActivityEntryProps) {
  const palette = usePalette();
  const copy = activityCopy(language);
  const { present } = useSyncExternalStore(controller.subscribe, controller.getState);
  const ref = useRef<View | null>(null);
  useEffect(() => {
    if (!focus) return;
    const node = ref.current === null ? null : findNodeHandle(ref.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [focus]);
  const end = language === 'ar' ? { left: 5 } : { right: 5 };
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityLabel={present ? `${copy.openName}${language === 'ar' ? '، ' : ', '}${copy.newState}` : copy.openName}
      onPress={onOpen}
      testID={ACTIVITY_ENTRY_TEST_ID}
      controlRef={(node) => {
        ref.current = node;
      }}
      style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' }}
    >
      <View>
        <P3Glyph name="ledger" color={palette.restInk} />
        <View style={{ position: 'absolute', top: -5, ...end }}>
          <AttentionMark present={present} ground={palette.world} testID="qandeel-activity-mark" />
        </View>
      </View>
    </Control>
  );
}
