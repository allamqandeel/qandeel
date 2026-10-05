/**
 * S4-03 — an ended Shared World, read-only (CW2-03 §31–§33; CW2-07 §24 READ_ONLY_HISTORICAL_VIEW). It is reached only
 * through the reader's closed-view entitlement, never through the active World's entry, and it is never presented as
 * active membership: no input, no Manage World, no governance and no QANDEEL reply — only the material the reader was
 * entitled to at closure, each read again against current availability (an owner's later deletion is simply absent).
 * The members shown are the people entitled at closure. Every word is the S4-03 or S4-02 copy module's.
 */
import { useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';

import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { sharedLifecycleCopy } from './lifecycle-copy';
import type { SharedWorldController } from './shared-world-controller';
import { SharedReadOnlyMaterial } from './SharedWorldThread';

const ROW_START = 24;
const ROW_END = 20;
const BUSY_OPACITY = 0.6;

export function SharedClosedWorld({ controller, language, palette }: {
  readonly controller: SharedWorldController;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
}) {
  const copy = sharedLifecycleCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const closed = state.closed;
  const world = closed.world;
  if (world === null) {
    return closed.status === 'LOADING' ? <View testID="qandeel-shared-ended-loading" accessibilityState={{ busy: true }} style={{ padding: ROW_START }} /> : (
      <View testID="qandeel-shared-ended-unavailable" style={{ padding: ROW_START }}>
        <Text style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>{copy.actionUnavailable}</Text>
      </View>
    );
  }
  return (
    <View testID="qandeel-shared-ended" style={{ paddingBottom: 24 }}>
      <Text testID="qandeel-shared-ended-notice" style={{ ...typeStyle('supporting'), color: palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 14, writingDirection: writing }}>
        {copy.endedNotice}
      </Text>
      <Text accessibilityRole="header" accessibilityLanguage={language}
        style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 22, paddingBottom: 6, writingDirection: writing }}>
        {copy.membersHeading}
      </Text>
      {world.members.map((member, index) => (
        <View key={`${index}-${member.name ?? ''}`} style={{ minHeight: MIN_TARGET, justifyContent: 'center', paddingStart: ROW_START, paddingEnd: ROW_END }}>
          <Text style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>{member.self ? copy.you : member.name ?? copy.someone}</Text>
        </View>
      ))}
      <View testID="qandeel-shared-ended-thread" style={{ paddingTop: 8 }}>
        {world.hasOlder ? (
          <Control palette={palette} language={language} accessibilityLabel={copy.olderMessages} accessibilityState={{ busy: closed.loadingOlder, disabled: closed.loadingOlder }}
            onPress={() => controller.loadOlderClosed()} testID="qandeel-shared-ended-older"
            style={{ alignSelf: 'center', minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center', opacity: closed.loadingOlder ? BUSY_OPACITY : 1 }}>
            <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.olderMessages}</Text>
          </Control>
        ) : null}
        {world.materials.map((material) => <SharedReadOnlyMaterial key={material.materialId} material={material} language={language} palette={palette} />)}
      </View>
    </View>
  );
}
