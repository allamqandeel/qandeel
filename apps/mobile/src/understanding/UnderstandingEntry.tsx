/**
 * W3-MEGA-U (E2E-D-14) — the persistent «فهم قنديل» / QANDEEL Understanding entry (P4-C1 U-A).
 *
 * It stands on Personal QANDEEL's own row beneath the upper chrome, at the reader's START edge, with the General
 * Settings entry at the END edge. It is a word, not an icon: no glyph is frozen for it (P1 §16.1), and the frozen name
 * is its accessible name. It is never in the upper chrome, never in the Analysis and never in Settings.
 */
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Text, View, findNodeHandle } from 'react-native';

import { Control, typeStyle, usePalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { understandingCopy } from './copy';

export interface UnderstandingEntryProps {
  readonly language: ChromeLanguage;
  readonly onOpen: () => void;
  /** Put the screen reader back on the entry once, when the reader returns from Understanding. */
  readonly focus?: boolean;
}

export function UnderstandingEntry({ language, onOpen, focus = false }: UnderstandingEntryProps) {
  const palette = usePalette();
  const copy = understandingCopy(language);
  const node = useRef<View | null>(null);
  useEffect(() => {
    if (!focus || node.current === null) return;
    const handle = findNodeHandle(node.current);
    if (handle !== null) AccessibilityInfo.setAccessibilityFocus(handle);
  }, [focus]);
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityLabel={copy.name}
      onPress={onOpen}
      testID="qandeel-understanding-entry"
      controlRef={(value) => {
        node.current = value;
      }}
      style={{ paddingHorizontal: 12, flexShrink: 1 }}
    >
      <Text numberOfLines={1} style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: language === 'ar' ? 'rtl' : 'ltr' }}>
        {copy.name}
      </Text>
    </Control>
  );
}
