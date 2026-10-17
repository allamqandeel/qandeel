/**
 * S6-06 (CP2) — «المشاركة»: what the reader shares in their own live Introduction, step by step, and what the other
 * person shared with them. It implements the screens P1 – P9, P14 and P15 exactly as the Product Owner approved them
 * (Visual Gate rev.2, 2026-10-17; docs/e2e/QANDEEL_S6_06_VISUAL_COPY_GATE_v1.md), from the existing Introductions parts
 * and the canonical palette only: no new colour, token or type role.
 *
 *   P1  the panel: «مشاركاتي» and «مشاركات {الاسم}» always shown; the reader's display-name choice (P15) under their own.
 *   P2  one sheet with the four bounded kinds only (D-11): no free kind, no free key.
 *   P3  the reader writes it — nothing is filled from the account; a contact written where it does not belong is refused
 *       by the server and pointed to its one path (D-10); the four personal keys in the S6-01 choice pattern (✓).
 *   P4  the exact preview, then one explicit act; «ليس الآن» leaves nothing behind.
 *   P5 – P7  the photo: the three stages and the blur limit explained BEFORE choosing; prepared on the server only; the
 *       owner previews each stage exactly as it will be sent, and each stage is its own explicit act.
 *   P8  the other person's photo: only the bytes of the stage they shared ever reach this device.
 *   P9  deletion and removal say what they truly do (no claim over what the other person saw or kept).
 *   P14 the gate closed (production today) is said plainly: NOT_AVAILABLE_NOW, nothing written.
 *   P15 the display name: the first name by default; the shared full name only by the reader's own consent, for this
 *       World only, undone in one tap.
 *
 * The device hides nothing as a protection: every act is the server's to decide, and a refusal is said.
 */
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, BackHandler, Easing, Keyboard, KeyboardAvoidingView, ScrollView, Text, View, findNodeHandle } from 'react-native';

import { accountAccessCopy } from '../account/access/copy';
import { Control, Glyph, MIN_TARGET, typeStyle, useConversationTypeface, usePalette, useReduceMotion } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import type { IntroductionDisclosures, IntroductionPersonalKey, IntroductionShare, IntroductionStage, IntroductionTextType } from '../runtime-entry';
import { INTRODUCTION_HOMETOWN_MAX_LENGTH, INTRODUCTION_TEXT_MAX_LENGTH } from '../runtime-entry/introduction-sharing-api';
import { sharedConversationCopy } from '../shared-world/conversation-copy';
import { sharedCopy } from '../shared-world/copy';
import { fillSharing, introductionSharingCopy, type IntroductionSharingCopy } from './introduction-sharing-copy';
import {
  myPhotoOf, theirPhotoOf, type IntroductionSharingController, type IntroductionSharingView, type SharingOutcome,
} from './introduction-sharing-controller';
import { Action, BUSY_OPACITY, Choice, Field, Heading, LOCAL_TYPE, Para, Question, ROW_END, ROW_START, type PartContext } from './IntroductionsParts';
import { proposalsCopy } from './proposals-copy';

export const INTRODUCTION_SHARING_TEST_ID = 'qandeel-introduction-sharing-root';
const HEADER_MIN_HEIGHT = 48;
const SHEET_RADIUS = 24;
/** The Visual Gate's card: the Field ground, radius 16, standing 8 points into the row margins. */
const CARD_RADIUS = 16;
const PICTURE_RADIUS = 14;
const THUMB_WIDTH = 68;
const THUMB_HEIGHT = 84;
const PREVIEW_HEIGHT = 300;
const VIEW_HEIGHT = 420;
const RING = 28;
/** The approved sheets stand over the panel, which recedes to this ink (no scrim colour: the canonical palette only). */
const BEHIND_OPACITY = 0.35;

type SaidLine = 'NOT_AVAILABLE_NOW' | 'DELETED' | 'RETIRED' | 'NOT_SHARED' | 'IMAGE_REFUSED' | 'UNAVAILABLE' | 'FAILED' | 'OFFLINE' | null;

type Step =
  | { readonly kind: 'PANEL' }
  | { readonly kind: 'TYPES' }
  | { readonly kind: 'TEXT'; readonly textType: IntroductionTextType; readonly fieldKey: IntroductionPersonalKey | null; readonly draft: string; readonly refused: boolean }
  | { readonly kind: 'CONFIRM_TEXT'; readonly textType: IntroductionTextType; readonly fieldKey: IntroductionPersonalKey | null; readonly text: string; readonly said: SaidLine }
  | { readonly kind: 'PHOTO_INTRO'; readonly said: SaidLine }
  | { readonly kind: 'MY_PHOTO'; readonly said: SaidLine }
  | { readonly kind: 'CONFIRM_STAGE'; readonly stage: IntroductionStage; readonly said: SaidLine }
  | { readonly kind: 'THEIR_PHOTO' }
  | { readonly kind: 'CONFIRM_REMOVE'; readonly seriesId: string; readonly said: SaidLine }
  | { readonly kind: 'CONFIRM_DELETE'; readonly materialId: string; readonly said: SaidLine }
  | { readonly kind: 'CONFIRM_DISPLAY'; readonly versionId: string; readonly fullName: string; readonly said: SaidLine };

/** What the panel remembers once an act is done: the line said under «مشاركاتي» (P9c, P15d, P15e). */
type PanelNotice = 'REMOVED' | 'DELETED' | 'REVOKED' | 'NOT_SHARED' | 'FAILED' | null;

export interface IntroductionSharingPanelProps {
  readonly sharing: IntroductionSharingController;
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  /** The other person's name as the server presents it to this reader (their first name, or the full name they consented to). */
  readonly otherName: string;
  readonly onBack: () => void;
}

const stageName = (copy: IntroductionSharingCopy, stage: IntroductionStage): string =>
  (stage === 1 ? copy.stageStrong : stage === 2 ? copy.stageMedium : copy.stageClear);
const keyName = (copy: IntroductionSharingCopy, key: IntroductionPersonalKey): string =>
  ({ work_field: copy.keyWorkField, education: copy.keyEducation, hometown_city: copy.keyHometown, about_me: copy.keyAboutMe })[key];
const textLabel = (copy: IntroductionSharingCopy, type: IntroductionTextType, key: IntroductionPersonalKey | null): string =>
  (type === 'FULL_NAME' ? copy.typeFullName : type === 'CONTACT_METHOD' ? copy.typeContact : key === null ? copy.typePersonal : keyName(copy, key));
const PERSONAL_KEYS: readonly IntroductionPersonalKey[] = ['work_field', 'education', 'hometown_city', 'about_me'];
/** A contact is written as the reader wrote it: numbers and addresses read left to right in both languages. */
const textWriting = (type: IntroductionTextType, writing: 'rtl' | 'ltr'): 'rtl' | 'ltr' => (type === 'CONTACT_METHOD' ? 'ltr' : writing);

export function IntroductionSharingPanel({ sharing, language, insets, otherName, onBack }: IntroductionSharingPanelProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const copy = introductionSharingCopy(language);
  const shared = sharedCopy(language);
  const state = useSyncExternalStore(sharing.subscribe, sharing.getState);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const [step, setStep] = useState<Step>({ kind: 'PANEL' });
  const [notice, setNotice] = useState<PanelNotice>(null);
  const headingRef = useRef<Text | null>(null);
  const view: IntroductionSharingView | null = state.open;
  const busy = view?.busy !== null && view?.busy !== undefined;

  // The panel reads afresh whenever it is opened: what the other person shared since is never stale here.
  useEffect(() => {
    sharing.refresh();
  }, [sharing]);

  const back = () => {
    if (busy && step.kind !== 'PANEL' && step.kind !== 'THEIR_PHOTO') return;
    switch (step.kind) {
      case 'PANEL': onBack(); return;
      case 'CONFIRM_TEXT': setStep({ kind: 'TEXT', textType: step.textType, fieldKey: step.fieldKey, draft: step.text, refused: false }); return;
      case 'CONFIRM_STAGE': setStep({ kind: 'MY_PHOTO', said: null }); return;
      default: setStep({ kind: 'PANEL' });
    }
  };
  const backRef = useRef(back);
  useEffect(() => {
    backRef.current = back;
  });
  useEffect(() => {
    // Registered after the World's own handler, so it is asked first: the panel's levels close before the World.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      backRef.current();
      return true;
    });
    return () => subscription.remove();
  }, []);

  // The keyboard belongs to the text step alone: once its field has left the screen, the keyboard goes with it (found on
  // the device: it otherwise stays up over the preview and hides «مشاركة الآن»).
  useEffect(() => {
    if (step.kind !== 'TEXT') Keyboard.dismiss();
  }, [step.kind]);

  // The screen reader arrives once on each step's heading.
  useEffect(() => {
    if (!ready) return;
    const node = headingRef.current === null ? null : findNodeHandle(headingRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [ready, step.kind, view?.status]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: palette.world }} testID={INTRODUCTION_SHARING_TEST_ID} />;

  const ctx: PartContext = { palette, language, writing, busy, onHeading: (node) => { headingRef.current = node; } };
  const quiet: PartContext = { ...ctx, onHeading: undefined };
  /** The approved primary act on the World: the outlined shape (the sheet's primary). */
  const prime: PartContext = { ...quiet, onSheet: true };
  const disclosures = view?.status === 'READY' ? view.disclosures : null;
  const live = disclosures?.introductionState === 'ACTIVE';

  const saidText = (said: SaidLine): string | null => {
    switch (said) {
      case 'NOT_AVAILABLE_NOW': return copy.sharingUnavailable;
      case 'DELETED': return copy.deletedShare;
      case 'RETIRED': return copy.retiredPhoto;
      case 'NOT_SHARED': return copy.displayNeedsName;
      case 'IMAGE_REFUSED': return copy.photoRefused;
      case 'UNAVAILABLE': return shared.worldUnavailable;
      case 'OFFLINE': return proposalsCopy(language).offline;
      case 'FAILED': return shared.actionUnavailable;
      default: return null;
    }
  };
  /** What the server said, in the error ink, where the screen reader hears it. */
  const saidLine = (said: SaidLine, testID: string) => {
    const text = saidText(said);
    return (
      <View accessibilityLiveRegion="polite" testID={testID}>
        {text === null ? null : <Para ctx={quiet} text={text} role="supporting" color={palette.error} />}
      </View>
    );
  };
  const asSaid = (outcome: SharingOutcome): SaidLine =>
    (outcome === 'DONE' || outcome === 'CANCELLED' || outcome === 'CONTACT_REFUSED' ? null : outcome);

  const header = (title: string | null, testID: string) => (
    <View style={{
      paddingTop: insets.top, paddingStart: (writing === 'rtl' ? insets.right : insets.left) + 10, paddingEnd: (writing === 'rtl' ? insets.left : insets.right) + 10,
      minHeight: insets.top + HEADER_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center', columnGap: 2,
    }}>
      <Control palette={palette} language={language} accessibilityLabel={shared.back} onPress={back} testID="qandeel-sharing-back"
        style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center' }}>
        <Glyph name="back" color={palette.restInk} direction={writing} />
      </Control>
      {title === null ? <View style={{ flex: 1 }} /> : (
        <Text ref={ctx.onHeading} testID={testID} accessibilityRole="header" accessibilityLanguage={language} numberOfLines={1}
          style={{ ...LOCAL_TYPE.header, color: palette.primary, flex: 1, paddingHorizontal: 2, writingDirection: writing }}>
          {title}
        </Text>
      )}
    </View>
  );
  const frame = (testID: string, title: string | null, body: ReactNode, opts: { readonly keyboard?: boolean; readonly sheet?: ReactNode } = {}) => {
    const scroll = (
      <ScrollView keyboardShouldPersistTaps="handled" testID={`${testID}-body`}
        contentContainerStyle={{ flexGrow: 1, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: opts.sheet === undefined ? insets.bottom + 16 : 0 }}>
        {body}
      </ScrollView>
    );
    return (
      <View testID={INTRODUCTION_SHARING_TEST_ID} accessibilityLanguage={language} style={{ flex: 1, backgroundColor: palette.world, direction: writing }}>
        <View testID={testID} style={{ flex: 1 }}>
          {opts.keyboard ? (
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">{header(title, 'qandeel-sharing-title')}{scroll}</KeyboardAvoidingView>
          ) : opts.sheet === undefined ? (
            <>{header(title, 'qandeel-sharing-title')}{scroll}</>
          ) : (
            <>
              {/* What the sheet stands over recedes and is not reachable while the sheet is open. */}
              <View style={{ flex: 1, opacity: BEHIND_OPACITY }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden pointerEvents="none">
                {header(title, 'qandeel-sharing-title-behind')}
                <ScrollView contentContainerStyle={{ paddingLeft: insets.left, paddingRight: insets.right }}>{body}</ScrollView>
              </View>
              <View testID="qandeel-sharing-sheet" accessibilityViewIsModal
                style={{ backgroundColor: palette.field, borderTopStartRadius: SHEET_RADIUS, borderTopEndRadius: SHEET_RADIUS, paddingTop: 14,
                  paddingBottom: insets.bottom + 16, paddingLeft: insets.left, paddingRight: insets.right }}>
                {opts.sheet}
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  // ---------------------------------------------------------------------------------------------------------------
  // States without an authorized read (P1c, P1d, P14c).
  if (view === null || view.status !== 'READY' || disclosures === null) {
    const status = view?.status ?? 'LOADING';
    const body = status === 'LOADING' ? (
      <View testID="qandeel-sharing-loading" accessible accessibilityLabel={shared.opening} accessibilityState={{ busy: true }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Ring ctx={ctx} />
      </View>
    ) : (
      <View testID={`qandeel-sharing-${status.toLowerCase()}`} accessibilityLiveRegion="polite" style={{ paddingTop: 12 }}>
        <Para ctx={quiet} text={status === 'UNAVAILABLE' ? shared.worldUnavailable : status === 'OFFLINE' ? proposalsCopy(language).offline : shared.actionUnavailable}
          role="supporting" color={status === 'UNAVAILABLE' ? palette.secondary : palette.error} />
        {status === 'UNAVAILABLE' ? null : <Action ctx={quiet} primary label={shared.retry} onPress={() => sharing.refresh()} testID="qandeel-sharing-retry" />}
      </View>
    );
    return frame('qandeel-sharing-unread', copy.panelTitle, body);
  }

  const mine = disclosures.items.filter((item) => item.mine && item.kind === 'TEXT');
  const theirs = disclosures.items.filter((item) => !item.mine && item.kind === 'TEXT');
  const photo = myPhotoOf(disclosures);
  const theirPhoto = theirPhotoOf(disclosures);
  const fullName = [...mine].reverse().find((item) => item.kind === 'TEXT' && item.textType === 'FULL_NAME') as Extract<IntroductionShare, { kind: 'TEXT' }> | undefined;

  // ---------------------------------------------------------------------------------------------------------------
  // P1 — the panel (and what the sheets stand over).
  const panelBody = (
    <View testID="qandeel-sharing-panel" style={{ paddingTop: 4 }}>
      {mine.length === 0 && photo === null && theirs.length === 0 && theirPhoto === null ? <Para ctx={quiet} text={copy.panelLead} role="supporting" color={palette.secondary} testID="qandeel-sharing-lead" /> : null}
      <Heading ctx={quiet} text={copy.mineHeading} testID="qandeel-sharing-mine" />
      {mine.length === 0 && photo === null ? <Para ctx={quiet} text={copy.emptySection} role="supporting" color={palette.secondary} testID="qandeel-sharing-mine-empty" /> : null}
      {mine.map((item) => item.kind === 'TEXT' ? (
        <Card key={item.versionId} ctx={quiet} testID={`qandeel-sharing-mine-${item.textType.toLowerCase()}`}
          action={<Action ctx={quiet} inline label={copy.deleteShare} accessibilityLabel={`${copy.deleteShare}، ${textLabel(copy, item.textType, item.fieldKey)}`}
            onPress={() => setStep({ kind: 'CONFIRM_DELETE', materialId: item.materialId, said: null })} testID="qandeel-sharing-delete" />}>
          <CardText ctx={quiet} label={textLabel(copy, item.textType, item.fieldKey)} value={item.text} writing={textWriting(item.textType, writing)} />
        </Card>
      ) : null)}
      {photo === null ? null : (
        <Card ctx={quiet} testID="qandeel-sharing-mine-photo" onPress={() => setStep({ kind: 'MY_PHOTO', said: null })}
          accessibilityLabel={`${copy.typePhoto}، ${photo.phase === 'PENDING' ? copy.preparingPhoto : photo.shared.length === 0 ? fillSharing(copy.shareStage, { stage: copy.stageStrong }) : stageName(copy, photo.shared[photo.shared.length - 1].stage)}`}
          picture={photo.face === null ? null : <Picture sharing={sharing} view={view} handle={photo.face.handle} width={THUMB_WIDTH} height={THUMB_HEIGHT} ctx={quiet} label={copy.typePhoto} />}
          action={<Action ctx={quiet} inline label={copy.removePhoto} onPress={() => setStep({ kind: 'CONFIRM_REMOVE', seriesId: photo.seriesId, said: null })} testID="qandeel-sharing-remove" />}>
          <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{copy.typePhoto}</Text>
          <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>
            {photo.phase === 'PENDING' ? copy.preparingPhoto : photo.shared.length === 0 ? fillSharing(copy.shareStage, { stage: copy.stageStrong }) : stageName(copy, photo.shared[photo.shared.length - 1].stage)}
          </Text>
        </Card>
      )}
      <View accessibilityLiveRegion="polite" testID="qandeel-sharing-notice">
        {notice === 'REMOVED' ? (
          <>
            <Para ctx={quiet} text={copy.newPhoto} role="supporting" color={palette.secondary} testID="qandeel-sharing-new-photo" />
            {live ? <Action ctx={quiet} primary label={copy.choosePhoto} onPress={() => { sharing.sweepPhotos(); setNotice(null); setStep({ kind: 'PHOTO_INTRO', said: null }); }} testID="qandeel-sharing-choose-again" /> : null}
          </>
        ) : notice === 'DELETED' ? <Para ctx={quiet} text={sharedConversationCopy(language).deleted} role="supporting" color={palette.secondary} />
          : notice === 'FAILED' ? <Para ctx={quiet} text={shared.actionUnavailable} role="supporting" color={palette.error} /> : null}
      </View>
      <DisplayName ctx={quiet} copy={copy} disclosures={disclosures} fullName={fullName ?? null} live={live} notice={notice} otherName={otherName}
        onGrant={(versionId, name) => setStep({ kind: 'CONFIRM_DISPLAY', versionId, fullName: name, said: null })}
        onRevoke={() => void sharing.revokeDisplay().then((outcome) => setNotice(outcome === 'DONE' ? 'REVOKED' : 'FAILED'))} />
      <Heading ctx={quiet} text={fillSharing(copy.theirsHeading, { name: otherName })} testID="qandeel-sharing-theirs" />
      {theirs.length === 0 && theirPhoto === null ? <Para ctx={quiet} text={copy.emptySection} role="supporting" color={palette.secondary} testID="qandeel-sharing-theirs-empty" /> : null}
      {theirs.map((item) => item.kind === 'TEXT' ? (
        <Card key={item.versionId} ctx={quiet} testID={`qandeel-sharing-theirs-${item.textType.toLowerCase()}`}>
          <CardText ctx={quiet} label={textLabel(copy, item.textType, item.fieldKey)} value={item.text} writing={textWriting(item.textType, writing)} />
        </Card>
      ) : null)}
      {theirPhoto === null ? null : (
        <Card ctx={quiet} testID="qandeel-sharing-theirs-photo" onPress={() => setStep({ kind: 'THEIR_PHOTO' })} accessibilityLabel={`${copy.typePhoto}، ${stageName(copy, theirPhoto.stage)}`}
          picture={<Picture sharing={sharing} view={view} handle={theirPhoto.handle} width={THUMB_WIDTH} height={THUMB_HEIGHT} ctx={quiet} label={copy.typePhoto} />}>
          <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{copy.typePhoto}</Text>
          <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{stageName(copy, theirPhoto.stage)}</Text>
        </Card>
      )}
      <View style={{ flexGrow: 1, minHeight: 8 }} />
      {live ? <Action ctx={prime} primary label={copy.shareSomething} onPress={() => setStep({ kind: 'TYPES' })} testID="qandeel-sharing-share" /> : null}
    </View>
  );

  switch (step.kind) {
    case 'TYPES':
      // P2 — the four bounded kinds only.
      return frame('qandeel-sharing-types', copy.panelTitle, panelBody, { sheet: (
        <View testID="qandeel-sharing-type-sheet">
          <Question ctx={{ ...ctx, onSheet: true }} text={copy.shareSomething} />
          {([['FULL_NAME', copy.typeFullName], ['CONTACT_METHOD', copy.typeContact], ['DEEPER_PERSONAL_FIELD', copy.typePersonal]] as const).map(([type, label]) => (
            <Action key={type} ctx={{ ...quiet, onSheet: true }} label={label} testID={`qandeel-sharing-type-${type.toLowerCase()}`}
              onPress={() => setStep({ kind: 'TEXT', textType: type, fieldKey: null, draft: '', refused: false })} />
          ))}
          <Action ctx={{ ...quiet, onSheet: true }} label={copy.typePhoto} testID="qandeel-sharing-type-photo"
            onPress={() => { sharing.sweepPhotos(); setStep(photo === null ? { kind: 'PHOTO_INTRO', said: null } : { kind: 'MY_PHOTO', said: null }); }} />
          <Action ctx={{ ...quiet, onSheet: true }} label={shared.cancel} onPress={() => setStep({ kind: 'PANEL' })} testID="qandeel-sharing-types-cancel" />
        </View>
      ) });

    case 'TEXT': {
      // P3 — written by the reader; nothing filled from the account.
      const { textType, fieldKey, draft, refused } = step;
      const max = fieldKey === 'hometown_city' ? INTRODUCTION_HOMETOWN_MAX_LENGTH : INTRODUCTION_TEXT_MAX_LENGTH;
      const set = (next: Partial<Extract<Step, { kind: 'TEXT' }>>) => setStep({ ...step, refused: false, ...next });
      const canContinue = draft.trim().length > 0 && (textType !== 'DEEPER_PERSONAL_FIELD' || fieldKey !== null);
      const title = textType === 'FULL_NAME' ? copy.typeFullName : textType === 'CONTACT_METHOD' ? copy.typeContact : copy.typePersonal;
      return frame(`qandeel-sharing-text-${textType.toLowerCase()}`, title, (
        <View style={{ flexGrow: 1, paddingTop: 8 }}>
          {textType === 'DEEPER_PERSONAL_FIELD' ? (
            <View accessibilityRole="radiogroup" testID="qandeel-sharing-keys">
              {PERSONAL_KEYS.map((key) => (
                <Choice key={key} ctx={quiet} label={keyName(copy, key)} selected={fieldKey === key} testID={`qandeel-sharing-key-${key}`}
                  onPress={() => set({ fieldKey: key, draft: key === 'hometown_city' ? draft.slice(0, INTRODUCTION_HOMETOWN_MAX_LENGTH) : draft })} />
              ))}
            </View>
          ) : null}
          {textType !== 'DEEPER_PERSONAL_FIELD' || fieldKey !== null ? (
            <Field ctx={quiet} label={textType === 'DEEPER_PERSONAL_FIELD' && fieldKey !== null ? keyName(copy, fieldKey) : title} showLabel={false} value={draft}
              // The server refuses a line break in any share: one is shown as a space, where the reader sees it.
              onChange={(text) => set({ draft: text.replace(/[\r\n]+/gu, ' ') })} testID="qandeel-sharing-field" maxLength={max}
              multiline={fieldKey === 'about_me'} direction={textWriting(textType, writing)} invalid={refused} />
          ) : null}
          <View accessibilityLiveRegion="polite" testID="qandeel-sharing-field-status">
            {refused ? <Para ctx={quiet} text={copy.contactRefused} role="supporting" color={palette.error} testID="qandeel-sharing-contact-refused" /> : null}
          </View>
          {textType === 'CONTACT_METHOD' ? <Para ctx={quiet} text={copy.contactHint} role="supporting" color={palette.secondary} /> : null}
          {fieldKey === 'hometown_city' ? <Para ctx={quiet} text={copy.hometownHint} role="supporting" color={palette.secondary} /> : null}
          <View style={{ flexGrow: 1, minHeight: 12 }} />
          <Action ctx={prime} primary disabled={!canContinue} label={accountAccessCopy(language).continueAction} testID="qandeel-sharing-continue"
            onPress={() => setStep({ kind: 'CONFIRM_TEXT', textType, fieldKey, text: draft.trim(), said: null })} />
        </View>
      ), { keyboard: true });
    }

    case 'CONFIRM_TEXT': {
      // P4 — the exact preview, then one explicit act (P14a / P9d when the server says so).
      const { textType, fieldKey, text, said } = step;
      const deleted = said === 'DELETED';
      return frame(`qandeel-sharing-confirm-${textType.toLowerCase()}`, null, (
        <View style={{ flexGrow: 1 }}>
          <Question ctx={ctx} text={fillSharing(copy.previewHeading, { name: otherName })} testID="qandeel-sharing-preview-heading" />
          {deleted ? null : (
            <Card ctx={quiet} testID="qandeel-sharing-preview">
              <CardText ctx={quiet} label={textLabel(copy, textType, fieldKey)} value={text} writing={textWriting(textType, writing)} />
            </Card>
          )}
          {deleted ? null : <Para ctx={quiet} text={copy.confirmNote} role="supporting" color={palette.secondary} />}
          {saidLine(said, 'qandeel-sharing-confirm-status')}
          <View style={{ flexGrow: 1, minHeight: 12 }} />
          {deleted || said === 'NOT_AVAILABLE_NOW' || said === 'UNAVAILABLE' ? null : (
            <Action ctx={prime} primary label={said === 'FAILED' || said === 'OFFLINE' ? shared.retry : copy.shareNow} testID="qandeel-sharing-share-now"
              onPress={() => void sharing.shareText(textType, fieldKey, text).then((outcome) => {
                if (outcome === 'DONE') {
                  setNotice(null);
                  setStep({ kind: 'PANEL' });
                } else if (outcome === 'CONTACT_REFUSED') setStep({ kind: 'TEXT', textType, fieldKey, draft: text, refused: true });
                else setStep({ kind: 'CONFIRM_TEXT', textType, fieldKey, text, said: asSaid(outcome) });
              })} />
          )}
          <Action ctx={quiet} label={copy.notNow} onPress={() => setStep({ kind: 'PANEL' })} testID="qandeel-sharing-not-now" />
        </View>
      ));
    }

    case 'PHOTO_INTRO': {
      // P5a / P5b / P5c — explained before choosing; prepared on the server only.
      const preparing = view.busy === 'UPLOAD';
      const retry = view.uploadRetry;
      const choose = () => void (retry ? sharing.retryUpload() : sharing.choosePhoto()).then((outcome) => {
        if (outcome === 'DONE') setStep({ kind: 'MY_PHOTO', said: null });
        else if (outcome !== 'CANCELLED') setStep({ kind: 'PHOTO_INTRO', said: asSaid(outcome) });
      });
      return frame('qandeel-sharing-photo-intro', copy.typePhoto, preparing ? (
        <View testID="qandeel-sharing-preparing" accessible accessibilityLabel={copy.preparingPhoto} accessibilityState={{ busy: true }}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', rowGap: 12 }}>
          <Ring ctx={ctx} />
          <Text style={{ ...typeStyle('supporting'), color: palette.secondary, textAlign: 'center', writingDirection: writing }}>{copy.preparingPhoto}</Text>
        </View>
      ) : (
        <View style={{ flexGrow: 1, paddingTop: 8 }}>
          {step.said === null ? <Para ctx={ctx} text={copy.photoExplain} testID="qandeel-sharing-photo-explain" /> : null}
          {step.said === null ? <Para ctx={quiet} text={copy.blurLimit} role="supporting" color={palette.secondary} testID="qandeel-sharing-blur-limit" /> : null}
          {saidLine(retry && step.said === null ? 'FAILED' : step.said, 'qandeel-sharing-photo-status')}
          <View style={{ flexGrow: 1, minHeight: 12 }} />
          {step.said === 'NOT_AVAILABLE_NOW' ? null : (
            <Action ctx={prime} primary label={retry ? shared.retry : copy.choosePhoto} onPress={choose} testID="qandeel-sharing-choose-photo" />
          )}
        </View>
      ));
    }

    case 'MY_PHOTO': {
      // P6 — the owner's own photo: each stage previewed exactly as it will be sent; the later ones locked.
      if (photo === null) {
        return frame('qandeel-sharing-my-photo-gone', copy.typePhoto, (
          <View style={{ paddingTop: 8 }}>
            {saidLine(step.said ?? 'UNAVAILABLE', 'qandeel-sharing-photo-status')}
            <Action ctx={quiet} label={shared.back} onPress={() => setStep({ kind: 'PANEL' })} testID="qandeel-sharing-photo-back" />
          </View>
        ));
      }
      const locked = ([1, 2, 3] as const).filter((s) => s > (photo.next?.stage ?? 4));
      const pending = photo.phase === 'PENDING';
      return frame('qandeel-sharing-my-photo', copy.typePhoto, (
        <View style={{ flexGrow: 1, paddingTop: 4 }}>
          {pending ? (
            <View testID="qandeel-sharing-preparing" accessible accessibilityLabel={copy.preparingPhoto} accessibilityState={{ busy: true }} style={{ alignItems: 'center', paddingVertical: 32, rowGap: 12 }}>
              <Ring ctx={ctx} />
              <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{copy.preparingPhoto}</Text>
            </View>
          ) : photo.face === null ? null : (
            <>
              <Picture sharing={sharing} view={view} handle={photo.face.handle} height={PREVIEW_HEIGHT} ctx={quiet} label={`${copy.typePhoto}، ${stageName(copy, photo.face.stage)}`} />
              <Text style={{ ...typeStyle('supporting'), color: palette.secondary, textAlign: 'center', paddingTop: 4, writingDirection: writing }} testID="qandeel-sharing-face-stage">
                {stageName(copy, photo.face.stage)}
              </Text>
            </>
          )}
          {saidLine(step.said, 'qandeel-sharing-photo-status')}
          {photo.next === null || step.said === 'NOT_AVAILABLE_NOW' || step.said === 'RETIRED' ? null : (
            <Action ctx={prime} primary label={fillSharing(copy.shareStage, { stage: stageName(copy, photo.next.stage) })} testID="qandeel-sharing-share-stage"
              onPress={() => {
                const next = photo.next!;
                if (next.stage === 1) {
                  void sharing.shareStage(photo.seriesId, 1).then((outcome) => setStep({ kind: 'MY_PHOTO', said: asSaid(outcome) }));
                } else setStep({ kind: 'CONFIRM_STAGE', stage: next.stage, said: null });
              }} />
          )}
          {locked.length === 0 || pending ? null : (
            <View testID="qandeel-sharing-locked" style={{ opacity: 0.7, marginStart: ROW_START, marginEnd: ROW_END, marginVertical: 4, paddingStart: 10,
              borderStartWidth: palette.markerThickness, borderStartColor: palette.tertiary }}>
              <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{locked.map((s) => stageName(copy, s)).join(' · ')}</Text>
              <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{copy.nextLocked}</Text>
            </View>
          )}
          {pending ? null : <Para ctx={quiet} text={copy.blurLimit} role="supporting" color={palette.secondary} />}
          <View style={{ flexGrow: 1, minHeight: 12 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingStart: ROW_START - 8, paddingEnd: ROW_END - 8 }}>
            {photo.phase === 'READY' && live ? (
              <Action ctx={quiet} inline label={copy.changePhoto} testID="qandeel-sharing-change-photo"
                onPress={() => { sharing.sweepPhotos(); void sharing.changePhoto(photo.seriesId).then((outcome) => setStep(outcome === 'DONE' ? { kind: 'MY_PHOTO', said: null } : outcome === 'CANCELLED' ? { kind: 'PHOTO_INTRO', said: null } : { kind: 'PHOTO_INTRO', said: asSaid(outcome) })); }} />
            ) : <View />}
            <Action ctx={quiet} inline label={copy.removePhoto} onPress={() => setStep({ kind: 'CONFIRM_REMOVE', seriesId: photo.seriesId, said: null })} testID="qandeel-sharing-remove-photo" />
          </View>
        </View>
      ));
    }

    case 'CONFIRM_STAGE': {
      // P7a / P7b — the next stage previewed exactly as it will be sent, then its own explicit act.
      const handle = disclosures.myPhoto?.unsharedStages.find((s) => s.stage === step.stage)?.handle ?? null;
      if (photo === null || handle === null) {
        return frame('qandeel-sharing-stage-gone', null, (
          <View style={{ paddingTop: 8 }}>
            {saidLine(step.said ?? 'UNAVAILABLE', 'qandeel-sharing-stage-status')}
            <Action ctx={quiet} label={shared.back} onPress={() => setStep({ kind: 'PANEL' })} testID="qandeel-sharing-stage-back" />
          </View>
        ));
      }
      const stage = stageName(copy, step.stage);
      return frame(`qandeel-sharing-confirm-stage-${step.stage}`, null, (
        <View style={{ flexGrow: 1 }}>
          <Question ctx={ctx} text={fillSharing(copy.previewHeading, { name: otherName })} />
          <Picture sharing={sharing} view={view} handle={handle} height={PREVIEW_HEIGHT} ctx={quiet} label={`${copy.typePhoto}، ${stage}`} />
          <Text style={{ ...typeStyle('supporting'), color: palette.secondary, textAlign: 'center', paddingTop: 4, writingDirection: writing }}>{stage}</Text>
          <Para ctx={quiet} text={copy.confirmNote} role="supporting" color={palette.secondary} />
          {saidLine(step.said, 'qandeel-sharing-stage-status')}
          <View style={{ flexGrow: 1, minHeight: 12 }} />
          {step.said === 'NOT_AVAILABLE_NOW' || step.said === 'RETIRED' || step.said === 'DELETED' ? null : (
            <Action ctx={prime} primary label={step.said === 'FAILED' || step.said === 'OFFLINE' ? shared.retry : fillSharing(copy.shareStage, { stage })} testID="qandeel-sharing-share-stage-now"
              onPress={() => void sharing.shareStage(photo.seriesId, step.stage).then((outcome) => setStep(outcome === 'DONE' ? { kind: 'MY_PHOTO', said: null } : { ...step, said: asSaid(outcome) }))} />
          )}
          <Action ctx={quiet} label={copy.notNow} onPress={() => setStep({ kind: 'MY_PHOTO', said: null })} testID="qandeel-sharing-stage-not-now" />
        </View>
      ));
    }

    case 'THEIR_PHOTO':
      // P8 — only the bytes of the stage the other person shared reach this device.
      return frame('qandeel-sharing-their-photo', copy.panelTitle, theirPhoto === null ? (
        <View style={{ paddingTop: 8 }}><Para ctx={quiet} text={shared.worldUnavailable} role="supporting" color={palette.secondary} /></View>
      ) : (
        <View style={{ paddingTop: 4 }}>
          <Heading ctx={quiet} text={fillSharing(copy.theirsHeading, { name: otherName })} />
          <Picture sharing={sharing} view={view} handle={theirPhoto.handle} height={VIEW_HEIGHT} ctx={quiet} label={`${copy.typePhoto}، ${stageName(copy, theirPhoto.stage)}`} />
          <Text style={{ ...typeStyle('supporting'), color: palette.secondary, textAlign: 'center', paddingTop: 4, writingDirection: writing }} testID="qandeel-sharing-their-stage">
            {stageName(copy, theirPhoto.stage)}
          </Text>
        </View>
      ));

    case 'CONFIRM_REMOVE':
    case 'CONFIRM_DELETE': {
      // P9a / P9b — what deletion truly does, and nothing it cannot.
      const removing = step.kind === 'CONFIRM_REMOVE';
      const sheetCtx: PartContext = { ...quiet, onSheet: true };
      const run = () => void (removing ? sharing.removePhoto(step.seriesId) : sharing.deleteShare(step.materialId)).then((outcome) => {
        if (outcome === 'DONE') {
          setNotice(removing ? 'REMOVED' : 'DELETED');
          setStep({ kind: 'PANEL' });
        } else setStep({ ...step, said: asSaid(outcome) });
      });
      return frame(removing ? 'qandeel-sharing-confirm-remove' : 'qandeel-sharing-confirm-delete', copy.panelTitle, panelBody, { sheet: (
        <View style={{ opacity: busy ? BUSY_OPACITY : 1 }}>
          <Para ctx={sheetCtx} text={fillSharing(removing ? copy.removeConfirm : copy.deleteConfirm, { name: otherName })} testID="qandeel-sharing-delete-explanation" />
          {saidLine(step.said, 'qandeel-sharing-delete-status')}
          <Action ctx={sheetCtx} primary label={step.said === 'FAILED' || step.said === 'OFFLINE' ? shared.retry : removing ? copy.removePhoto : copy.deleteShare}
            onPress={run} testID="qandeel-sharing-delete-confirm" />
          <Action ctx={sheetCtx} label={shared.cancel} onPress={() => setStep({ kind: 'PANEL' })} testID="qandeel-sharing-delete-cancel" />
        </View>
      ) });
    }

    case 'CONFIRM_DISPLAY': {
      // P15b — the confirmation shows the exact disclosed text.
      const sheetCtx: PartContext = { ...quiet, onSheet: true };
      return frame('qandeel-sharing-confirm-display', copy.panelTitle, panelBody, { sheet: (
        <View style={{ opacity: busy ? BUSY_OPACITY : 1 }}>
          <Para ctx={sheetCtx} text={fillSharing(copy.displayConfirm, { fullName: step.fullName })} testID="qandeel-sharing-display-explanation" />
          {saidLine(step.said, 'qandeel-sharing-display-status')}
          {step.said === 'NOT_AVAILABLE_NOW' || step.said === 'NOT_SHARED' ? null : (
            <Action ctx={sheetCtx} primary label={step.said === 'FAILED' || step.said === 'OFFLINE' ? shared.retry : copy.displayGrant} testID="qandeel-sharing-display-confirm"
              onPress={() => void sharing.grantDisplay(step.versionId).then((outcome) => {
                if (outcome === 'DONE') {
                  setNotice(null);
                  setStep({ kind: 'PANEL' });
                } else if (outcome === 'NOT_SHARED') {
                  setNotice('NOT_SHARED');
                  setStep({ kind: 'PANEL' });
                } else setStep({ ...step, said: asSaid(outcome) });
              })} />
          )}
          <Action ctx={sheetCtx} label={shared.cancel} onPress={() => setStep({ kind: 'PANEL' })} testID="qandeel-sharing-display-cancel" />
        </View>
      ) });
    }

    default:
      return frame('qandeel-sharing-ready', copy.panelTitle, panelBody);
  }
}

/** P15 — the reader's display name in this World: the first name by default; the shared full name by consent only. */
function DisplayName({ ctx, copy, disclosures, fullName, live, notice, otherName, onGrant, onRevoke }: {
  readonly ctx: PartContext; readonly copy: IntroductionSharingCopy; readonly disclosures: IntroductionDisclosures; readonly otherName: string;
  readonly fullName: Extract<IntroductionShare, { kind: 'TEXT' }> | null; readonly live: boolean; readonly notice: PanelNotice;
  readonly onGrant: (versionId: string, fullName: string) => void; readonly onRevoke: () => void;
}) {
  const { palette } = ctx;
  const displayed = disclosures.myDisplayedVersionId;
  if (fullName === null && displayed === null && notice !== 'NOT_SHARED') return null;
  // PD-71 names the other person: the reader's first name is what THEY see.
  const explain = fillSharing(copy.displayExplain, { name: otherName });
  const grant = fullName === null || !live ? null : (
    <Action ctx={ctx} primary label={copy.displayGrant} onPress={() => onGrant(fullName.versionId, fullName.text)} testID="qandeel-sharing-display-grant" />
  );
  let body: ReactNode;
  if (fullName === null || notice === 'NOT_SHARED') {
    // P15e — what was not shared cannot be shown.
    body = (<>
      <Para ctx={ctx} text={explain} role="supporting" color={palette.secondary} />
      <Para ctx={ctx} text={copy.displayNeedsName} role="supporting" color={palette.secondary} testID="qandeel-sharing-display-needs-name" />
    </>);
  } else if (displayed === fullName.versionId) {
    // P15c — shown; going back is one tap, in every state.
    body = (<>
      <Para ctx={ctx} text={copy.displayGranted} testID="qandeel-sharing-display-granted" />
      <Action ctx={ctx} inline label={copy.displayRevoke} onPress={onRevoke} testID="qandeel-sharing-display-revoke" />
    </>);
  } else if (displayed !== null) {
    // P15f — a consent never moves to a new full name by itself.
    body = (<>
      <Para ctx={ctx} text={copy.displayNewVersion} role="supporting" color={palette.secondary} testID="qandeel-sharing-display-new-version" />
      {grant}
      <Action ctx={ctx} inline label={copy.displayRevoke} onPress={onRevoke} testID="qandeel-sharing-display-revoke" />
    </>);
  } else {
    // P15a / P15d — the first name; after going back, said once.
    body = (<>
      {notice === 'REVOKED' ? <Para ctx={ctx} text={copy.displayRevoked} role="supporting" color={palette.secondary} testID="qandeel-sharing-display-revoked" /> : null}
      <Para ctx={ctx} text={explain} role="supporting" color={palette.secondary} testID="qandeel-sharing-display-explain" />
      {grant}
    </>);
  }
  return (
    <View testID="qandeel-sharing-display" accessibilityLiveRegion="polite">
      <Heading ctx={ctx} text={copy.displayName} />
      {body}
    </View>
  );
}

/** The Visual Gate's card: the Field ground, the main words, an optional picture and one action at the end. */
function Card({ ctx, children, picture, action, onPress, accessibilityLabel, testID }: {
  readonly ctx: PartContext; readonly children: ReactNode; readonly picture?: ReactNode; readonly action?: ReactNode;
  readonly onPress?: () => void; readonly accessibilityLabel?: string; readonly testID: string;
}) {
  const style = { backgroundColor: ctx.palette.field, borderRadius: CARD_RADIUS, paddingVertical: 12, paddingHorizontal: 16, marginStart: ROW_START - 8, marginEnd: ROW_END - 8,
    marginTop: 4, marginBottom: 6, flexDirection: 'row' as const, alignItems: 'flex-start' as const, columnGap: 12 };
  const main = <View style={{ flex: 1, minWidth: 0 }}>{children}</View>;
  return (
    <View testID={testID} style={style}>
      {onPress === undefined ? <>{picture}{main}</> : (
        <Control palette={ctx.palette} language={ctx.language} accessibilityLabel={accessibilityLabel ?? ''} onPress={onPress} testID={`${testID}-open`}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', columnGap: 12, minHeight: MIN_TARGET, borderRadius: 0 }}>
          {picture}{main}
        </Control>
      )}
      {action === undefined ? null : <View style={{ marginTop: -6, marginEnd: -8 }}>{action}</View>}
    </View>
  );
}

function CardText({ ctx, label, value, writing }: { readonly ctx: PartContext; readonly label: string; readonly value: string; readonly writing: 'rtl' | 'ltr' }) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} accessibilityLanguage={ctx.language}>
      <Text style={{ ...typeStyle('metadata'), color: ctx.palette.tertiary, writingDirection: ctx.writing }}>{label}</Text>
      <Text style={{ ...typeStyle('body'), color: ctx.palette.primary, writingDirection: writing, textAlign: ctx.writing === 'rtl' ? 'right' : 'left' }}>{value}</Text>
    </View>
  );
}

/**
 * One rendition, drawn from memory only: the bytes the server just re-authorized, as a `data:` URI, with expo-image's
 * cache OFF — never a URL, a header, a prefetch or a cache key the native image engine could keep.
 */
function Picture({ sharing, view, handle, height, width, ctx, label }: {
  readonly sharing: IntroductionSharingController; readonly view: IntroductionSharingView; readonly handle: string;
  readonly height: number; readonly width?: number; readonly ctx: PartContext; readonly label: string;
}) {
  const media = view.media[handle];
  useEffect(() => {
    sharing.ensureMedia(handle);
  }, [sharing, handle]);
  const box = { height, width: width ?? undefined, borderRadius: PICTURE_RADIUS, overflow: 'hidden' as const, backgroundColor: ctx.palette.field,
    alignItems: 'center' as const, justifyContent: 'center' as const };
  const wrap = width === undefined ? { marginStart: ROW_START, marginEnd: ROW_END, marginTop: 8, marginBottom: 4 } : {};
  return (
    <View style={wrap}>
      <View style={box} testID={`qandeel-sharing-picture-${media?.kind.toLowerCase() ?? 'loading'}`}>
        {media?.kind === 'DRAWABLE' ? (
          <Image source={{ uri: media.dataUri }} cachePolicy="none" contentFit="cover" accessible accessibilityLabel={label}
            style={{ width: '100%', height: '100%' }} testID="qandeel-sharing-picture-image" />
        ) : media === undefined || media.kind === 'LOADING' ? (width === undefined ? <Ring ctx={ctx} /> : null) : null}
      </View>
      {media?.kind === 'FAILED' && width === undefined ? (
        <Action ctx={ctx} inline label={sharedCopy(ctx.language).retry} onPress={() => sharing.ensureMedia(handle)} testID="qandeel-sharing-picture-retry" />
      ) : null}
    </View>
  );
}

/** The quiet ring of something being prepared: it turns, unless the reader asked for reduced motion. */
function Ring({ ctx }: { readonly ctx: PartContext }) {
  const reduceMotion = useReduceMotion();
  const [turn] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduceMotion) return undefined;
    const loop = Animated.loop(Animated.timing(turn, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, turn]);
  const rotate = useMemo(() => turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }), [turn]);
  return (
    <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="qandeel-sharing-ring"
      style={{ width: RING, height: RING, borderRadius: RING / 2, borderWidth: 2.5, borderColor: ctx.palette.tertiary, borderTopColor: 'transparent',
        transform: reduceMotion ? undefined : [{ rotate }] }} />
  );
}
