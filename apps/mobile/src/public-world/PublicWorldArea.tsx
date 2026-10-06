/**
 * S5-01 — the «العالم العام» / Public World area: the Public World root, behind its entry verdict.
 *
 * Entering resolves authority FIRST (CW2-07 §23–§25). Until the server says ALLOW only a neutral pre-authority shell is
 * drawn — the area's ground and nothing of the destination: no name, no Experience, no count. A refusal is one neutral
 * "not available" with a way to try again; it says nothing about why. On ALLOW the root becomes active: the Public
 * World's own name and its own ground.
 *
 * The root is content-empty by truth: S5-01 opens no Experience, Draft, publication, search, lens, placement,
 * discussion, Public QANDEEL, reaction or Replay, and draws no sample, feed, ranking or invented geography in their
 * place (S5-03 realizes the Experiences and the semantic field). It is a World, not a feed.
 *
 * Back at the root is local-only: nothing is registered, so Back never silently returns to the Personal world
 * (I-08A4 §4). Nothing here reads the Personal world or the Shared area: no Session, camera, focus, time or World is
 * passed in, so none can transfer.
 */
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { ActivityEntry, type ActivityAttentionController } from '../activity';
import { AppearanceStatusBar } from '../appearance';
import { Control, typeStyle, usePalette, useConversationTypeface } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { publicCopy } from './copy';
import type { PublicWorldController } from './public-world-controller';

export const PUBLIC_AREA_TEST_ID = 'qandeel-public-area';
const HEADER_MIN_HEIGHT = 48;
const ROW_START = 24;

export interface PublicWorldAreaProps {
  readonly controller: PublicWorldController;
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  /** The one global Activity entry for this non-Analysis upper chrome (P3 §3); absent when the host has none. */
  readonly activity?: { readonly controller: ActivityAttentionController; readonly onOpen: () => void; readonly focus: boolean };
}

export function PublicWorldArea({ controller, language, insets, activity }: PublicWorldAreaProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const copy = publicCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const { entry } = useSyncExternalStore(controller.subscribe, controller.getState);

  // Entering the area asks the entry verdict again — a previous ALLOW is never kept as authority.
  useEffect(() => {
    controller.enter();
  }, [controller]);

  const frame = (testID: string, children: ReactNode) => (
    <View testID={PUBLIC_AREA_TEST_ID} accessibilityLanguage={language} style={{ flex: 1, backgroundColor: palette.world, direction: writing }}>
      <AppearanceStatusBar />
      <View testID={testID} style={{ flex: 1 }}>{children}</View>
    </View>
  );

  if (!ready || entry === 'NONE' || entry === 'RESOLVING') {
    // The pre-authority shell: the area's ground, and nothing of the destination.
    return frame('qandeel-public-resolving', (
      <View testID="qandeel-public-transition" accessible accessibilityLabel={copy.opening} accessibilityState={{ busy: true }}
        accessibilityLanguage={language} style={{ flex: 1, paddingTop: insets.top }} />
    ));
  }

  if (entry === 'DENIED') {
    return frame('qandeel-public-denied', (
      <View testID="qandeel-public-unavailable" accessibilityLiveRegion="polite" style={{ paddingTop: insets.top + HEADER_MIN_HEIGHT, padding: ROW_START, rowGap: 12 }}>
        <Text style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>{copy.worldUnavailable}</Text>
        <Control palette={palette} language={language} accessibilityLabel={copy.retry} onPress={() => controller.enter()} testID="qandeel-public-retry"
          style={{ alignSelf: 'flex-start' }}>
          <Text style={{ ...typeStyle('action'), color: palette.primary, writingDirection: writing }}>{copy.retry}</Text>
        </Control>
      </View>
    ));
  }

  return frame('qandeel-public-root', (
    <>
      <View style={{
        paddingTop: insets.top, paddingStart: (writing === 'rtl' ? insets.right : insets.left) + 10, paddingEnd: (writing === 'rtl' ? insets.left : insets.right) + 10,
        minHeight: insets.top + HEADER_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center', columnGap: 2,
      }}>
        {activity !== undefined ? <ActivityEntry controller={activity.controller} language={language} onOpen={activity.onOpen} focus={activity.focus} /> : null}
        <Text testID="qandeel-public-title" accessibilityRole="header" accessibilityLanguage={language}
          style={{ ...typeStyle('statement'), color: palette.primary, flex: 1, paddingHorizontal: 2, writingDirection: writing }}>
          {copy.publicWorld}
        </Text>
      </View>
      {/* The Public World's own ground. Its Experiences and semantic field are S5-03's; nothing stands in for them. */}
      <View testID="qandeel-public-field" style={{ flex: 1 }} />
    </>
  ));
}
