/**
 * W3-MEGA-U (E2E-D-14) — the bounded context the Conversation carries after "talk to QANDEEL about this".
 *
 * One quiet line above the composer naming the item the reader chose, in the reader's own words for it (its theme and
 * current summary), and one way to end it. It fills in nothing and sends nothing: the reader decides what to say. The
 * item's identity never appears in it.
 */
import { useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';

import { Control, typeStyle, usePalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { understandingCopy } from './copy';
import type { UnderstandingController } from './understanding-controller';

export interface UnderstandingDiscussionStripProps {
  readonly controller: UnderstandingController;
  readonly language: ChromeLanguage;
  readonly insets: { readonly left: number; readonly right: number };
}

export function UnderstandingDiscussionStrip({ controller, language, insets }: UnderstandingDiscussionStripProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const palette = usePalette();
  const copy = understandingCopy(language);
  const discussion = state.discussion;
  if (discussion === null) return null;
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <View
      testID="qandeel-understanding-discussion"
      accessibilityLanguage={language}
      style={{
        direction: writing,
        paddingTop: 8,
        paddingBottom: 4,
        paddingStart: (writing === 'rtl' ? insets.right : insets.left) + 20,
        paddingEnd: (writing === 'rtl' ? insets.left : insets.right) + 10,
        flexDirection: 'row',
        alignItems: 'center',
        columnGap: 8,
      }}
    >
      <View style={{ flex: 1 }} accessible accessibilityLiveRegion="polite" accessibilityLabel={`${copy.discussing(copy.theme[discussion.theme])}. ${discussion.summary}`}>
        <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>
          {copy.discussing(copy.theme[discussion.theme])}
        </Text>
        <Text numberOfLines={2} style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>
          {discussion.summary}
        </Text>
      </View>
      <Control
        palette={palette}
        language={language}
        accessibilityLabel={copy.endDiscussion}
        onPress={controller.endDiscussion}
        testID="qandeel-understanding-discussion-end"
        style={{ paddingHorizontal: 10 }}
      >
        <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: writing }}>{copy.endDiscussion}</Text>
      </Control>
    </View>
  );
}
