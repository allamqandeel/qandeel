/**
 * W3-MEGA-U (E2E-D-14 / D-15) — the bounded context the Conversation carries after "talk to QANDEEL about this".
 *
 * One quiet block above the composer naming the item the reader chose, in its theme and current summary, and one way
 * to end it. It fills in nothing and sends nothing: the reader decides what to say. The item's identity never appears
 * in it.
 *
 * U3 (P1 §11.4, PG-01): it also carries the ONE explicit way to disagree — «أراه بشكل مختلف» / "I see it differently".
 * It is an intentional act on this item, never inferred from what the reader types. Once it is recorded the item is
 * Contested / Under Review and the block says so in words; the Conversation simply continues.
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

const BUSY_OPACITY = 0.6;

export function UnderstandingDiscussionStrip({ controller, language, insets }: UnderstandingDiscussionStripProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const palette = usePalette();
  const copy = understandingCopy(language);
  const discussion = state.discussion;
  if (discussion === null) return null;
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const sending = discussion.disagreement === 'SENDING';
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
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
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
      {discussion.underReview ? (
        <Text testID="qandeel-understanding-disagreement-recorded" accessibilityLiveRegion="polite" style={{ ...typeStyle('supporting'), color: palette.secondary, paddingTop: 4, writingDirection: writing }}>
          {copy.disagreeRecorded}
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8 }}>
          <Control
            palette={palette}
            language={language}
            accessibilityLabel={copy.disagree}
            accessibilityState={{ busy: sending, disabled: sending }}
            onPress={() => {
              void controller.disagree();
            }}
            testID="qandeel-understanding-disagree"
            style={{ paddingHorizontal: 10, opacity: sending ? BUSY_OPACITY : 1 }}
          >
            <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: writing }}>{copy.disagree}</Text>
          </Control>
          {discussion.disagreement === 'FAILED' ? (
            <Text testID="qandeel-understanding-disagreement-failed" accessibilityLiveRegion="polite" style={{ ...typeStyle('supporting'), color: palette.error, writingDirection: writing }}>
              {copy.disagreeFailed}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
