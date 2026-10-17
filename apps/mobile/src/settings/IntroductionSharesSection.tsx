/**
 * S6-06 (CP2) — «ما شاركته في التعارف» / What I shared in Introductions, in General Settings → «الخصوصية والبيانات»
 * (P16, V-6), beside «كلامك في عوالم مشتركة انتهت عضويتك فيها».
 *
 *   IntroductionSharesRow   the term only. It opens the page; nothing is read before the reader asks for it.
 *   IntroductionSharesPage  only the reader's OWN shares, per Introduction World — live, after END and after SUCCESS —
 *                           each deletable (a photo is removed whole), and the reader's own display choice with its one-tap
 *                           way back to the first name. Deletion is behind the same words the World uses (PD-26b / PD-31):
 *                           what it truly does, and no claim over what the other person saw or kept.
 *
 * Every word is an approved row: the S6-06 Copy Gate (PD-*), the S6-05 closed-record line (IW-31) and the Shared rows.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';

import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import { fillSharing, introductionSharingCopy, type IntroductionSharingCopy } from '../introductions/introduction-sharing-copy';
import { introductionWorldCopy } from '../introductions/introduction-world-copy';
import type { ChromeLanguage } from '../orientation-chrome';
import type { IntroductionOwnShare, IntroductionPersonalKey, IntroductionSharesWorld, IntroductionStage, IntroductionTextType } from '../runtime-entry';
import { sharedConversationCopy } from '../shared-world/conversation-copy';
import { sharedCopy } from '../shared-world/copy';
import { ActionRow } from './AccountSecuritySection';
import type { IntroductionSharesController } from './introduction-shares-controller';

const ROW_START = 24;
const ROW_END = 20;
const BUSY_OPACITY = 0.6;
const CARD_RADIUS = 16;

const writingOf = (language: ChromeLanguage) => (language === 'ar' ? 'rtl' : 'ltr');
const stageName = (copy: IntroductionSharingCopy, stage: IntroductionStage): string =>
  (stage === 1 ? copy.stageStrong : stage === 2 ? copy.stageMedium : copy.stageClear);
const keyName = (copy: IntroductionSharingCopy, key: IntroductionPersonalKey): string =>
  ({ work_field: copy.keyWorkField, education: copy.keyEducation, hometown_city: copy.keyHometown, about_me: copy.keyAboutMe })[key];
const textLabel = (copy: IntroductionSharingCopy, type: IntroductionTextType, key: IntroductionPersonalKey | null): string =>
  (type === 'FULL_NAME' ? copy.typeFullName : type === 'CONTACT_METHOD' ? copy.typeContact : key === null ? copy.typePersonal : keyName(copy, key));

export function IntroductionSharesRow({ language, palette, onOpen, rowRef }: {
  readonly language: ChromeLanguage; readonly palette: ConversationPalette; readonly onOpen: () => void; readonly rowRef?: (node: View | null) => void;
}) {
  return <ActionRow label={introductionSharingCopy(language).settingsRow} notice={null} busy={false} language={language} palette={palette} onPress={onOpen} rowRef={rowRef} testID="qandeel-introduction-shares-row" />;
}

type Confirming = { readonly kind: 'DELETE'; readonly worldId: string; readonly materialId: string } | { readonly kind: 'REMOVE'; readonly worldId: string; readonly seriesId: string } | null;

export function IntroductionSharesPage({ controller, language, palette }: {
  readonly controller: IntroductionSharesController; readonly language: ChromeLanguage; readonly palette: ConversationPalette;
}) {
  const copy = introductionSharingCopy(language);
  const shared = sharedCopy(language);
  const writing = writingOf(language);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const [confirming, setConfirming] = useState<Confirming>(null);
  useEffect(() => {
    controller.open();
  }, [controller]);
  const said = state.notice === 'DELETED' || state.notice === 'REMOVED' ? sharedConversationCopy(language).deleted
    : state.notice === 'REVOKED' ? copy.displayRevoked : state.notice === 'FAILED' ? shared.actionUnavailable : null;
  useEffect(() => {
    if (said !== null) AccessibilityInfo.announceForAccessibility(said);
  }, [said]);

  return (
    <View testID="qandeel-introduction-shares" style={{ paddingBottom: 16 }}>
      <Text accessibilityRole="header" accessibilityLanguage={language}
        style={{ ...typeStyle('statement'), color: palette.primary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 12, writingDirection: writing }}>
        {copy.settingsRow}
      </Text>
      <Text style={{ ...typeStyle('supporting'), color: palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 8, writingDirection: writing }}>
        {copy.settingsLead}
      </Text>
      <View testID="qandeel-introduction-shares-notice" accessibilityLiveRegion="polite" style={{ paddingStart: ROW_START, paddingEnd: ROW_END }}>
        {said === null ? null : <Text style={{ ...typeStyle('supporting'), color: state.notice === 'FAILED' ? palette.error : palette.secondary, paddingTop: 10, writingDirection: writing }}>{said}</Text>}
      </View>
      {state.status === 'LOADING' ? <View accessible accessibilityLabel={shared.opening} accessibilityState={{ busy: true }} style={{ padding: ROW_START }} /> : null}
      {state.status === 'FAILED' || state.status === 'OFFLINE' ? (
        <View testID="qandeel-introduction-shares-failed" style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 16 }}>
          <Text style={{ ...typeStyle('supporting'), color: palette.error, writingDirection: writing }}>{shared.actionUnavailable}</Text>
          <Control palette={palette} language={language} accessibilityLabel={shared.retry} onPress={() => controller.open()} testID="qandeel-introduction-shares-retry"
            style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center' }}>
            <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{shared.retry}</Text>
          </Control>
        </View>
      ) : null}
      {state.status === 'READY' && state.worlds.length === 0 ? (
        <Text testID="qandeel-introduction-shares-empty" style={{ ...typeStyle('supporting'), color: palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 16, writingDirection: writing }}>
          {copy.settingsEmpty}
        </Text>
      ) : null}
      {state.worlds.map((world) => (
        <SharesWorld key={world.worldId} world={world} controller={controller} language={language} palette={palette} busy={state.busy}
          confirming={confirming} setConfirming={setConfirming} />
      ))}
    </View>
  );
}

function SharesWorld({ world, controller, language, palette, busy, confirming, setConfirming }: {
  readonly world: IntroductionSharesWorld; readonly controller: IntroductionSharesController; readonly language: ChromeLanguage;
  readonly palette: ConversationPalette; readonly busy: string | null; readonly confirming: Confirming; readonly setConfirming: (c: Confirming) => void;
}) {
  const copy = introductionSharingCopy(language);
  const shared = sharedCopy(language);
  const writing = writingOf(language);
  const name = world.otherFirstName ?? shared.someone;
  const texts = world.shares.filter((s): s is Extract<IntroductionOwnShare, { kind: 'TEXT' }> => s.kind === 'TEXT');
  // One photo is one card: its newest shared stage; removing it removes every stage (D-05).
  const photos = new Map<string, IntroductionStage>();
  for (const s of world.shares) if (s.kind === 'IMAGE') photos.set(s.seriesId, Math.max(photos.get(s.seriesId) ?? 1, s.stage) as IntroductionStage);
  const card = { backgroundColor: palette.field, borderRadius: CARD_RADIUS, paddingVertical: 12, paddingHorizontal: 16, marginStart: ROW_START - 8, marginEnd: ROW_END - 8, marginTop: 4, marginBottom: 6 };
  const action = (label: string, onPress: () => void, testID: string, a11y?: string) => (
    <Control palette={palette} language={language} accessibilityLabel={a11y ?? label} accessibilityState={{ disabled: busy !== null }} onPress={() => { if (busy === null) onPress(); }} testID={testID}
      style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, paddingHorizontal: 8, marginStart: -8, justifyContent: 'center' }}>
      <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{label}</Text>
    </Control>
  );
  const confirmation = (text: string, confirmLabel: string, run: () => void, testID: string) => (
    <View testID={testID} style={{ rowGap: 8, paddingTop: 6 }}>
      <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{text}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 8 }}>
        <Control palette={palette} language={language} accessibilityLabel={shared.cancel} onPress={() => setConfirming(null)} testID={`${testID}-keep`}
          style={{ minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center' }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{shared.cancel}</Text>
        </Control>
        <Control palette={palette} language={language} accessibilityLabel={confirmLabel} accessibilityState={{ busy: busy !== null, disabled: busy !== null }}
          onPress={() => { if (busy === null) run(); }} testID={`${testID}-confirm`}
          style={{ minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: palette.world, borderRadius: 12 }}>
          <Text style={{ ...typeStyle('action'), color: palette.primary }}>{confirmLabel}</Text>
        </Control>
      </View>
    </View>
  );
  return (
    <View testID="qandeel-introduction-shares-world" style={{ paddingTop: 8 }}>
      <Text accessibilityRole="header" accessibilityLanguage={language}
        style={{ ...typeStyle('action'), color: palette.primary, paddingTop: 18, paddingBottom: 4, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: writing }}>
        {fillSharing(copy.settingsWith, { name })}
      </Text>
      {world.introductionState === 'ACTIVE' ? null : (
        <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: writing }}>
          {world.introductionState === 'ENDED' ? introductionWorldCopy(language).closedBanner : copy.successCompleted}
        </Text>
      )}
      {texts.map((share) => {
        const label = textLabel(copy, share.textType, share.fieldKey);
        const asking = confirming?.kind === 'DELETE' && confirming.materialId === share.materialId;
        return (
          <View key={share.materialId} testID="qandeel-introduction-shares-text" style={{ ...card, opacity: busy?.includes(share.materialId) ? BUSY_OPACITY : 1 }}>
            <View accessible accessibilityLabel={`${label}: ${share.text}`} accessibilityLanguage={language}>
              <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{label}</Text>
              <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: share.textType === 'CONTACT_METHOD' ? 'ltr' : writing, textAlign: writing === 'rtl' ? 'right' : 'left' }}>{share.text}</Text>
            </View>
            {share.displayed ? (
              <>
                <Text testID="qandeel-introduction-shares-displayed" style={{ ...typeStyle('supporting'), color: palette.secondary, paddingTop: 4, writingDirection: writing }}>{copy.displayGranted}</Text>
                {action(copy.displayRevoke, () => void controller.revokeDisplay(world.worldId), 'qandeel-introduction-shares-revoke')}
              </>
            ) : null}
            {asking
              ? confirmation(fillSharing(copy.deleteConfirm, { name }), copy.deleteShare,
                () => void controller.deleteText(world.worldId, share.materialId).then(() => setConfirming(null)), 'qandeel-introduction-shares-delete-confirmation')
              : action(copy.deleteShare, () => setConfirming({ kind: 'DELETE', worldId: world.worldId, materialId: share.materialId }), 'qandeel-introduction-shares-delete', `${copy.deleteShare}، ${label}`)}
          </View>
        );
      })}
      {[...photos.entries()].map(([seriesId, stage]) => {
        const asking = confirming?.kind === 'REMOVE' && confirming.seriesId === seriesId;
        return (
          <View key={seriesId} testID="qandeel-introduction-shares-photo" style={{ ...card, opacity: busy?.includes(seriesId) ? BUSY_OPACITY : 1 }}>
            <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{copy.typePhoto}</Text>
            <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{stageName(copy, stage)}</Text>
            {asking
              ? confirmation(fillSharing(copy.removeConfirm, { name }), copy.removePhoto,
                () => void controller.removePhoto(world.worldId, seriesId).then(() => setConfirming(null)), 'qandeel-introduction-shares-remove-confirmation')
              : action(copy.removePhoto, () => setConfirming({ kind: 'REMOVE', worldId: world.worldId, seriesId }), 'qandeel-introduction-shares-remove')}
          </View>
        );
      })}
    </View>
  );
}
