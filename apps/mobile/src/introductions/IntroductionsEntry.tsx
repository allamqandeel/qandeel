/**
 * S6-01 — the manual «التعارف مع قنديل» / Introductions with QANDEEL entry (GATE-13: manual entry inside MY_WORLD; no
 * fourth World, no tab, no conversational offer before Stage 8A).
 *
 * It stands on Personal QANDEEL's own row, after the Understanding entry at the reader's START edge, as a word (no glyph
 * is frozen for it). It is drawn only when the server says preparation is available now, or the owner already has a
 * draft to see or delete: while both gates are closed and nothing was prepared, nothing is drawn — no teaser, no badge,
 * no notification.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Text, View, findNodeHandle } from 'react-native';

import { Control, typeStyle, usePalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { introductionsCopy } from './copy';
import type { IntroductionsController } from './introductions-controller';

export interface IntroductionsEntryProps {
  readonly controller: IntroductionsController;
  readonly language: ChromeLanguage;
  readonly onOpen: () => void;
  /** Put the screen reader back on the entry once, when the owner returns from the preparation. */
  readonly focus?: boolean;
}

export function IntroductionsEntry({ controller, language, onOpen, focus = false }: IntroductionsEntryProps) {
  const palette = usePalette();
  const copy = introductionsCopy(language);
  const availability = useSyncExternalStore(controller.subscribe, () => controller.getState().availability);
  const node = useRef<View | null>(null);
  useEffect(() => {
    controller.refreshAvailability();
  }, [controller]);
  const shown = availability !== null && (availability.preparation || availability.hasDraft);
  useEffect(() => {
    if (!shown || !focus || node.current === null) return;
    const handle = findNodeHandle(node.current);
    if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [focus, shown]);
  if (!shown) return null;
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityLabel={copy.name}
      onPress={onOpen}
      testID="qandeel-introductions-entry"
      controlRef={(value) => {
        node.current = value;
      }}
      style={{ paddingHorizontal: 12, flexShrink: 1 }}
    >
      <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: language === 'ar' ? 'rtl' : 'ltr' }}>
        {copy.name}
      </Text>
    </Control>
  );
}
