/**
 * COSMOS E-2 corrections, Slice B (the Product Owner's D-2, 2026-11-20) — the «المحادثات» / Conversations entry: one
 * icon-only control in the Conversation's upper chrome (START edge, beside Activity) that opens the person's own
 * conversation catalog. It is not a World and not a Global Switcher destination; it carries no count and no mark.
 *
 * The glyph is drawn here with three short rules (a list), in the rest ink, never mirrored: there is no frozen P2 / P3
 * glyph for "conversations" and inventing one in the iconography layer is not this slice's to do.
 */
import { View } from 'react-native';

import type { ChromeLanguage } from '../orientation-chrome';
import { conversationCatalogCopy } from './catalog/copy';
import { Control, MIN_TARGET } from './visual/Control';
import { usePalette } from './visual/theme';

export const CONVERSATIONS_ENTRY_TEST_ID = 'qandeel-conversations-entry';

export interface ConversationsEntryProps {
  readonly language: ChromeLanguage;
  readonly onOpen: () => void;
}

export function ConversationsEntry({ language, onOpen }: ConversationsEntryProps) {
  const palette = usePalette();
  const copy = conversationCatalogCopy(language);
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityLabel={copy.entryName}
      onPress={onOpen}
      testID={CONVERSATIONS_ENTRY_TEST_ID}
      style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' }}
    >
      <View accessible={false} style={{ width: 18, height: 14, justifyContent: 'space-between' }}>
        <View style={{ height: 2, borderRadius: 1, backgroundColor: palette.restInk }} />
        <View style={{ height: 2, borderRadius: 1, backgroundColor: palette.restInk, width: 14 }} />
        <View style={{ height: 2, borderRadius: 1, backgroundColor: palette.restInk }} />
      </View>
    </Control>
  );
}
