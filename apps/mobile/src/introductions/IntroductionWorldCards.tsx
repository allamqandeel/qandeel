/**
 * S6-05 (CP5, V-1 S5) — the reader's own Introduction Worlds as «العالم المشترك» lists them: a separate «التعارف» section
 * above the ordinary Worlds, each card carrying the same 2px start-edge seam as the World's opening; an ended
 * Introduction moves into «عوالم منتهية» with «انتهى التعارف». No fourth area, no public directory, no ranking: the
 * cards stand in the order the server listed them, and a card says only the first name the server presented to this
 * reader (IW-11), or «تعارف» when it vouches for none (IW-11b). An Introduction World is never drawn as an ordinary
 * Shared World: it opens the Introduction surface, never the World's Living Analysis or Manage World.
 */
import { useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';

import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { introductionTitle, introductionWorldCopy } from './introduction-world-copy';
import type { IntroductionWorldsController } from './introduction-world-controller';

const CARD_RADIUS = 16;
const ROW_START = 24;
const ROW_END = 20;

/** The reader's ACTIVE or ENDED Introduction Worlds as cards; nothing when there are none. */
export function IntroductionWorldCards({ controller, which, language, palette, onOpen }: {
  readonly controller: IntroductionWorldsController;
  readonly which: 'ACTIVE' | 'ENDED';
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly onOpen: (worldId: string) => void;
}) {
  const copy = introductionWorldCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const worlds = state.list.status === 'READY' ? state.list.worlds.filter((w) => w.state === which) : [];
  if (worlds.length === 0) return null;
  return (
    <View testID={`qandeel-introduction-cards-${which.toLowerCase()}`} style={{ rowGap: 10, paddingTop: 4 }}>
      {worlds.map((world) => {
        const title = introductionTitle(copy, world.otherFirstName);
        const status = which === 'ACTIVE' ? copy.cardSubtitle : copy.endedStatus;
        return (
          <Control key={world.worldId} palette={palette} language={language} accessibilityLabel={`${title}${language === 'ar' ? '، ' : ', '}${status}`}
            onPress={() => onOpen(world.worldId)} testID={`qandeel-introduction-card-${world.worldId}`}
            style={{ marginStart: ROW_START - 8, marginEnd: ROW_END - 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: CARD_RADIUS,
              backgroundColor: palette.field, alignItems: 'stretch', minHeight: MIN_TARGET,
              // V-1: the live Introduction's card carries the opening's seam; an ended one does not.
              ...(which === 'ACTIVE' ? { borderStartWidth: palette.markerThickness, borderStartColor: palette.selectedMarker } : {}) }}>
            <Text style={{ ...typeStyle('action'), color: palette.primary, writingDirection: writing }}>{title}</Text>
            <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{status}</Text>
          </Control>
        );
      })}
    </View>
  );
}

/** Whether the reader has any Introduction World in this state — for the section headings around the cards. */
export const hasIntroductionWorlds = (controller: IntroductionWorldsController, which: 'ACTIVE' | 'ENDED'): boolean => {
  const { list } = controller.getState();
  return list.status === 'READY' && list.worlds.some((w) => w.state === which);
};
