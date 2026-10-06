/**
 * S4-03 (E2E-G-18) — the reader's own words in Shared Worlds they no longer belong to, inside General Settings →
 * «الخصوصية والبيانات» / Privacy & Data (CW2-03 §24 / C21: own-material control through an account / privacy surface,
 * without World browsing).
 *
 *   FormerSharedMaterialRow   the term only. It opens the page; nothing is read before the reader asks for it.
 *   FormerSharedMaterialPage  only the reader's OWN words, newest first, each with its day and Delete — behind the same
 *                             calm confirmation the live World uses (S4-02's approved words: what deletion truthfully
 *                             does). No surrounding message, member, Name, topic, World label or count is shown, and
 *                             deleting reopens nothing. Voice notes do not appear: no durable audio source exists
 *                             (QAN-BL-VOICE-01). Above them, any request to share the reader's own earlier words that
 *                             still needs the reader's approval (material authority survives membership): exactly those
 *                             words, no grantee, and approving brings the reader back into nothing.
 *
 * Every word comes from the S4-03 copy module (which reuses the S4-02 deletion rows); days from the one locale authority.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';

import { Control, MIN_TARGET, directedParagraphs, typeStyle, withDirectionMark, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { sharedLifecycleCopy } from '../shared-world';
import { ActionRow } from './AccountSecuritySection';
import type { FormerSharedMaterialController } from './former-shared-material-controller';
import { formatDay } from './PrivacyDataSection';

const ROW_START = 24;
const ROW_END = 20;
const BUSY_OPACITY = 0.6;

const writingOf = (language: ChromeLanguage) => (language === 'ar' ? 'rtl' : 'ltr');

export function FormerSharedMaterialRow({ language, palette, onOpen, rowRef }: {
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly onOpen: () => void;
  readonly rowRef?: (node: View | null) => void;
}) {
  const copy = sharedLifecycleCopy(language);
  return <ActionRow label={copy.formerRow} notice={null} busy={false} language={language} palette={palette} onPress={onOpen} rowRef={rowRef} testID="qandeel-former-shared-material-row" />;
}

export function FormerSharedMaterialPage({ controller, language, palette }: {
  readonly controller: FormerSharedMaterialController;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
}) {
  const copy = sharedLifecycleCopy(language);
  const writing = writingOf(language);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const [confirming, setConfirming] = useState<string | null>(null);
  useEffect(() => {
    controller.open();
  }, [controller]);
  const said = state.notice === 'DELETED' ? copy.deleted : state.notice === 'APPROVED' ? copy.approvedWaiting : state.notice === 'GRANTED' ? copy.granted
    : state.notice === 'STALE' ? copy.stale : state.notice === 'DELETE_FAILED' || state.notice === 'LOAD_FAILED' || state.notice === 'APPROVE_FAILED' ? copy.actionUnavailable : null;
  const calm = state.notice === 'DELETED' || state.notice === 'APPROVED' || state.notice === 'GRANTED';
  useEffect(() => {
    if (said !== null) AccessibilityInfo.announceForAccessibility(said);
  }, [said]);

  return (
    <View testID="qandeel-former-shared-material" style={{ paddingBottom: 16 }}>
      <Text accessibilityRole="header" accessibilityLanguage={language}
        style={{ ...typeStyle('statement'), color: palette.primary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 12, writingDirection: writing }}>
        {copy.formerRow}
      </Text>
      <Text style={{ ...typeStyle('supporting'), color: palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 8, writingDirection: writing }}>
        {copy.formerExplain}
      </Text>
      <View testID="qandeel-former-shared-material-notice" accessibilityLiveRegion="polite" style={{ paddingStart: ROW_START, paddingEnd: ROW_END }}>
        {said === null ? null : <Text style={{ ...typeStyle('supporting'), color: calm ? palette.secondary : palette.error, paddingTop: 10, writingDirection: writing }}>{said}</Text>}
      </View>
      {state.requests.length > 0 ? (
        <View testID="qandeel-former-shared-requests" style={{ paddingTop: 12 }}>
          <Text accessibilityRole="header" accessibilityLanguage={language}
            style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 10, paddingBottom: 6, writingDirection: writing }}>
            {copy.shareRequestsHeading}
          </Text>
          {state.requests.map((request) => {
            const busy = state.approving === request.packageId;
            return (
              <View key={request.packageId} testID="qandeel-former-shared-request" style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 8, rowGap: 6, opacity: busy ? BUSY_OPACITY : 1 }}>
                <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{copy.formerShareRequest}</Text>
                {request.items.map((item) => (
                  <Text key={item.materialId} style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{item.text}</Text>
                ))}
                {request.approvedBySelf ? (
                  <Text style={{ ...typeStyle('supporting'), color: palette.tertiary, writingDirection: writing }}>{copy.approvedWaiting}</Text>
                ) : (
                  <Control palette={palette} language={language} accessibilityLabel={copy.approve} accessibilityState={{ busy, disabled: state.approving !== null }}
                    onPress={() => void controller.approveRequest(request.packageId)} testID="qandeel-former-shared-request-approve"
                    style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: palette.field }}>
                    <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.approve}</Text>
                  </Control>
                )}
              </View>
            );
          })}
        </View>
      ) : null}
      {state.status === 'LOADING' ? <View accessibilityState={{ busy: true }} style={{ padding: ROW_START }} /> : null}
      {state.status === 'READY' && state.materials.length === 0 ? (
        <Text testID="qandeel-former-shared-material-empty" style={{ ...typeStyle('body'), color: palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 16, writingDirection: writing }}>
          {copy.formerEmpty}
        </Text>
      ) : null}
      {state.materials.map((material) => {
        const busy = state.deleting === material.materialId;
        const day = formatDay(material.establishedAt, language);
        return (
          <View key={material.materialId} testID="qandeel-former-shared-material-item" style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 16, rowGap: 6, opacity: busy ? BUSY_OPACITY : 1 }}>
            <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{day}</Text>
            <View accessible accessibilityLabel={`${day}: ${material.text}`} accessibilityLanguage={language}
              style={{ backgroundColor: palette.utterance, paddingTop: 10, paddingBottom: 11, paddingHorizontal: 16, borderRadius: 18, alignSelf: 'flex-start', maxWidth: '100%' }}>
              {directedParagraphs(material.text, writing).map((paragraph, index) => (
                <Text key={index} style={{ ...typeStyle('body'), color: palette.primary, writingDirection: paragraph.direction }}>{withDirectionMark(paragraph)}</Text>
              ))}
            </View>
            {confirming === material.materialId ? (
              <View testID="qandeel-former-shared-material-confirm" style={{ rowGap: 8 }}>
                <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{copy.deleteExplanation}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 8 }}>
                  <Control palette={palette} language={language} accessibilityLabel={copy.cancel} accessibilityState={{ disabled: busy }} onPress={() => { if (!busy) setConfirming(null); }}
                    testID="qandeel-former-shared-material-keep" style={{ minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center' }}>
                    <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.cancel}</Text>
                  </Control>
                  <Control palette={palette} language={language} accessibilityLabel={copy.deleteConfirm} accessibilityState={{ busy, disabled: busy }}
                    onPress={() => { if (!busy) void controller.deleteMaterial(material.materialId).then(() => setConfirming(null)); }}
                    testID="qandeel-former-shared-material-delete-action" style={{ minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: palette.field }}>
                    <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.deleteConfirm}</Text>
                  </Control>
                </View>
              </View>
            ) : (
              <Control palette={palette} language={language} accessibilityLabel={`${copy.delete}, ${day}`} onPress={() => setConfirming(material.materialId)}
                testID="qandeel-former-shared-material-delete" style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center' }}>
                <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.delete}</Text>
              </Control>
            )}
          </View>
        );
      })}
      {state.hasOlder ? (
        <Control palette={palette} language={language} accessibilityLabel={copy.olderMessages} accessibilityState={{ busy: state.loadingOlder, disabled: state.loadingOlder }}
          onPress={() => controller.loadOlder()} testID="qandeel-former-shared-material-older"
          style={{ alignSelf: 'center', minHeight: MIN_TARGET, paddingHorizontal: 12, marginTop: 12, justifyContent: 'center' }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.olderMessages}</Text>
        </Control>
      ) : null}
    </View>
  );
}
