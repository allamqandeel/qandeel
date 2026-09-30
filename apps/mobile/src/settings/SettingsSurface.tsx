/**
 * W3-01 (E2E-D-01 / D-10 / D-07) — the ONE General Settings destination, bounded to what the implemented tasks own.
 *
 * P1 §8 / P4-C1 S-B: one application-wide destination, entered from Personal QANDEEL's own row. It is not a
 * route, a world, a Session or a canonical state: the Personal world shows it over itself and keeps
 * everything beneath it exactly as it was, so Back returns to the same place.
 *
 * It exposes only the groups whose functions exist now, and draws no placeholder for any other group:
 *
 *   - «المظهر وتسهيلات الاستخدام» / Appearance & Accessibility — Dark / Light / System (P1 §12), one choice of
 *     three. The selected one is told by E1R's selected treatment (the filled marker inside a selected-ink
 *     ring — a shape, not only a colour) and by its accessibility state; there is no helper sentence.
 *   - «الدعم ومعلومات التطبيق» / Support & About — this device's Sign out (P1 §8.1). It calls the ONE auth
 *     sign-out it is handed, once: while it runs the control is busy and refuses a second press, and when
 *     it completes the runtime retires the world and the ordinary Sign in replaces this surface.
 *
 * W3-02 (E2E-D-09) adds, first, the third real group:
 *
 *   - «الحساب والهوية» / Account & Identity — the reader's Public ID and its ONE lifetime manual change (P1 §6).
 *
 * W3-MEGA-A (E2E-D-03 Name, D-04 Email, D-05 Login ID, D-06 Security & Sign-in) completes Account & Identity with
 * the Name, Login ID and Email rows, and adds the fourth real group:
 *
 *   - «الأمان وتسجيل الدخول» / Security & Sign-in — Change password, Sign out from other devices, and the current
 *     Email with its status as the recovery method (W3-PDG-01 §3). Nothing else: no Phone, 2FA, Passkeys, device
 *     list or activity log, disabled or otherwise. No Account Photo and no Shared ID row exists (media storage is
 *     not implemented; the Shared ID waits for W6).
 *
 * Every change is a STATE of this destination — not a route, a dialog or a world — and Back leaves the change, not
 * Settings. A change in flight is never abandoned half-way. An Email change, or a password change the provider made
 * on a fresh session, ends this device's session: the ONE sign-out below then returns the reader to Sign in.
 *
 * W3-MEGA-S (E2E-D-11, D-12, D-16, D-17 Personal world) adds the fifth and sixth real groups:
 *
 *   - «قنديل والمحادثة» / QANDEEL & Conversation — the Language row, which opens the SYSTEM's language setting for
 *     QANDEEL (W3-PDG-01 §5). No in-app switch, nothing stored; the one locale authority reads the result.
 *   - «الخصوصية والبيانات» / Privacy & Data — Export my data and Delete account (W3-PDG-01 §7, §8), each with the
 *     state the server holds; both requests re-enter the password. Accessibility stays the platform's: no in-app
 *     accessibility switch exists (W3-PDG-01 §6).
 *
 * No placeholder is drawn for a group whose function does not exist (Notifications, Introductions, Plan & Usage).
 *
 * The frame is laid out logically (`direction`), so the start and end edges are the reader's in Arabic and
 * English alike. Every colour is the canonical palette's, in the reader's effective appearance.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, BackHandler, ScrollView, Text, View, findNodeHandle } from 'react-native';

import { APPEARANCE_PREFERENCES, AppearanceStatusBar, useAppearance, useAppearanceChoice, type AppearancePreference } from '../appearance';
import { Control, Glyph, MIN_TARGET, typeStyle, useConversationTypeface, usePalette, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { ActionRow, EmailChange, IdentityRow, LoginIdChange, NameChange, PasswordChange } from './AccountSecuritySection';
import type { AccountIdentityController, AccountIdentityState } from './account-identity-controller';
import { settingsCopy } from './copy';
import { saveExportDocument } from './export-file';
import { openLanguageSettings } from './language-settings';
import type { PrivacyDataController, PrivacyDataState } from './privacy-data-controller';
import { DeletionRequest, deletionStatusSaid, ExportRequest, exportStatusSaid, LanguageRow, PrivacyDataRows } from './PrivacyDataSection';
import type { PublicIdController, PublicIdState } from './public-id-controller';
import { PublicIdChangeSurface, PublicIdRow } from './PublicIdSection';

export const SETTINGS_SURFACE_TEST_ID = 'qandeel-settings';

export interface SettingsSurfaceProps {
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  /** Back to the Personal world, exactly as it was. */
  readonly onBack: () => void;
  /** The ONE sign-out: the frozen auth authority's own. */
  readonly onSignOut: () => Promise<unknown>;
  /** W3-MEGA-A: the reader's identity and security acts for this runtime generation. Without it, those rows are not drawn. */
  readonly identity?: AccountIdentityController;
  /** W3-02: the reader's Public ID for this runtime generation. Without it, the Public ID row is not drawn. */
  readonly publicId?: PublicIdController;
  /** W3-MEGA-S: the reader's Privacy & Data state and requests for this runtime generation. Without it, that group is not drawn. */
  readonly privacy?: PrivacyDataController;
}

/** The change shown in place of the groups, if any. */
type Change = 'PUBLIC_ID' | 'NAME' | 'LOGIN_ID' | 'EMAIL' | 'PASSWORD' | 'EXPORT' | 'DELETE';
/** Where the screen reader returns when a change closes. */
type RowKey = Change;

const NO_PUBLIC_ID: PublicIdState = Object.freeze({ status: 'LOADING', publicId: null, changeAvailable: false });
const NO_IDENTITY: AccountIdentityState = Object.freeze({ status: 'LOADING', identity: null });
const NO_PRIVACY: PrivacyDataState = Object.freeze({ status: 'LOADING', view: null });
const noSubscription = () => () => undefined;

/** The Privacy & Data state of the generation's controller, or LOADING when there is none. */
function usePrivacyState(controller: PrivacyDataController | undefined): PrivacyDataState {
  return useSyncExternalStore(
    controller === undefined ? noSubscription : controller.subscribe,
    controller === undefined ? () => NO_PRIVACY : controller.getState,
  );
}

/** The Public ID state of the generation's controller, or LOADING when there is none. */
function usePublicIdState(controller: PublicIdController | undefined): PublicIdState {
  return useSyncExternalStore(
    controller === undefined ? noSubscription : controller.subscribe,
    controller === undefined ? () => NO_PUBLIC_ID : controller.getState,
  );
}

/** The identity state of the generation's controller, or LOADING when there is none. */
function useIdentityState(controller: AccountIdentityController | undefined): AccountIdentityState {
  return useSyncExternalStore(
    controller === undefined ? noSubscription : controller.subscribe,
    controller === undefined ? () => NO_IDENTITY : controller.getState,
  );
}

/** Craft values of the P4-C3 page composition (proof evidence), not tokens. */
const HEADER_MIN_HEIGHT = 48;
const ROW_START = 24;
const ROW_END = 20;
const MARKER = 20;
const MARKER_DOT = 10;
/** The same dimming the account entry's busy act uses (W1B-01), so "in flight" reads the same everywhere. */
const BUSY_OPACITY = 0.6;

function GroupHeading({ text, language, palette, testID }: {
  readonly text: string;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly testID: string;
}) {
  return (
    <Text
      testID={testID}
      accessibilityRole="header"
      accessibilityLanguage={language}
      style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingTop: 22, paddingBottom: 4, paddingStart: ROW_START, paddingEnd: ROW_END }}
    >
      {text}
    </Text>
  );
}

function AppearanceChoice({ preference, label, selected, onChoose, language, palette }: {
  readonly preference: AppearancePreference;
  readonly label: string;
  readonly selected: boolean;
  readonly onChoose: (preference: AppearancePreference) => void;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
}) {
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, selected }}
      onPress={() => onChoose(preference)}
      testID={`qandeel-appearance-${preference.toLowerCase()}`}
      style={{ minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 14 }}>
        {/* E1R selected state: the marker is a shape — a ring at rest, a ring holding a filled dot when selected. */}
        <View
          testID={`qandeel-appearance-${preference.toLowerCase()}-marker`}
          style={{
            width: MARKER,
            height: MARKER,
            borderRadius: MARKER / 2,
            borderWidth: palette.markerThickness,
            borderColor: selected ? palette.selectedInk : palette.restInk,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected ? (
            <View
              testID={`qandeel-appearance-${preference.toLowerCase()}-selected`}
              style={{ width: MARKER_DOT, height: MARKER_DOT, borderRadius: MARKER_DOT / 2, backgroundColor: palette.selectedMarker }}
            />
          ) : null}
        </View>
        <Text style={{ ...typeStyle('body'), color: palette.primary, flexShrink: 1, writingDirection: language === 'ar' ? 'rtl' : 'ltr' }}>{label}</Text>
      </View>
    </Control>
  );
}

export function SettingsSurface({ language, insets, onBack, onSignOut, identity, publicId, privacy }: SettingsSurfaceProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const copy = settingsCopy(language);
  const appearance = useAppearance();
  const choose = useAppearanceChoice();
  const writing = language === 'ar' ? 'rtl' : 'ltr';

  // W3-02 / W3-MEGA-A — read when Settings is shown, and changed only inside this destination.
  const publicIdState = usePublicIdState(publicId);
  const identityState = useIdentityState(identity);
  const account = identityState.status === 'READY' ? identityState.identity : null;
  useEffect(() => {
    publicId?.start();
  }, [publicId]);
  useEffect(() => {
    identity?.start();
  }, [identity]);
  // W3-MEGA-S — the Privacy & Data state, read when Settings is shown.
  const privacyState = usePrivacyState(privacy);
  useEffect(() => {
    privacy?.start();
  }, [privacy]);

  const [changing, setChanging] = useState<Change | null>(null);
  const committingRef = useRef(false);
  const [returnTo, setReturnTo] = useState<RowKey | null>(null);
  const rowNodes = useRef<Partial<Record<RowKey, View | null>>>({});
  const rowRef = useCallback((key: RowKey) => (node: View | null) => {
    rowNodes.current[key] = node;
  }, []);
  const openChange = useCallback((change: Change) => {
    setReturnTo(null);
    setChanging(change);
  }, []);
  const leaveChange = useCallback(() => {
    // A commit in flight is never abandoned half-way: its answer decides what the reader sees next.
    if (committingRef.current) return;
    setReturnTo(changing);
    setChanging(null);
  }, [changing]);
  const onCommitBusy = useCallback((busy: boolean) => {
    committingRef.current = busy;
  }, []);
  // Android system Back while a change is shown leaves the change, and nothing else.
  useEffect(() => {
    if (changing === null) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      leaveChange();
      return true;
    });
    return () => subscription.remove();
  }, [changing, leaveChange]);
  // Back from a change, the screen reader returns to the row that opened it.
  useEffect(() => {
    if (returnTo === null || changing !== null) return;
    const target = rowNodes.current[returnTo];
    const node = target === null || target === undefined ? null : findNodeHandle(target);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [changing, returnTo, publicIdState, identityState, privacyState]);

  // The screen reader arrives on the destination's name, once, when the surface is drawn.
  const titleRef = useRef<Text | null>(null);
  useEffect(() => {
    if (!ready) return;
    const node = titleRef.current === null ? null : findNodeHandle(titleRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [ready]);

  // One sign-out. The ref refuses a second press in the same frame, before the busy state has rendered. It is also
  // how an Email change, or a password change made on a fresh session, returns the reader to Sign in: the
  // provider has already ended this device's session, and this ends it here.
  const signingOutRef = useRef(false);
  const [signingOut, setSigningOut] = useState(false);
  const signOut = useCallback(() => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSigningOut(true);
    // The runtime retires this surface when the authority publishes SIGNED_OUT; nothing here navigates.
    void onSignOut();
  }, [onSignOut]);

  // Security & Sign-in results, told beneath their own row in a polite region.
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [othersNotice, setOthersNotice] = useState<string | null>(null);
  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const othersRef = useRef(false);
  const signOutOthers = useCallback(async () => {
    if (identity === undefined || othersRef.current) return;
    othersRef.current = true;
    setSigningOutOthers(true);
    setOthersNotice(null);
    const result = await identity.signOutOtherDevices();
    othersRef.current = false;
    setSigningOutOthers(false);
    if (result === null) return;
    const said = result === 'DONE' ? copy.security.signedOutOthers : copy.identity.network;
    setOthersNotice(said);
    AccessibilityInfo.announceForAccessibility(said);
  }, [copy, identity]);
  const passwordChanged = useCallback(() => {
    setPasswordNotice(copy.security.passwordChanged);
    AccessibilityInfo.announceForAccessibility(copy.security.passwordChanged);
    leaveChange();
  }, [copy, leaveChange]);

  const onChoose = useCallback((preference: AppearancePreference) => {
    choose?.(preference);
  }, [choose]);

  // W3-MEGA-S — Privacy & Data results, told beneath their own row in a polite region.
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [deletionNotice, setDeletionNotice] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const privacyActRef = useRef(false);
  const say = useCallback((setNotice: (said: string | null) => void, said: string | null) => {
    setNotice(said);
    if (said !== null) AccessibilityInfo.announceForAccessibility(said);
  }, []);
  const download = useCallback(async () => {
    if (privacy === undefined || privacyActRef.current) return;
    privacyActRef.current = true;
    setDownloading(true);
    setExportNotice(null);
    const result = await privacy.downloadExport();
    let said: string | null = null;
    if (result?.kind === 'READY') {
      const saved = await saveExportDocument(result.document);
      said = saved === 'SAVED' ? copy.privacy.exportSaved : saved === 'FAILED' ? copy.privacy.exportSaveFailed : null;
    } else if (result?.kind === 'RETRY') {
      said = copy.privacy.network;
    }
    privacyActRef.current = false;
    setDownloading(false);
    say(setExportNotice, said);
  }, [copy, privacy, say]);
  const cancelDeletion = useCallback(async () => {
    if (privacy === undefined || privacyActRef.current) return;
    privacyActRef.current = true;
    setCancelling(true);
    setDeletionNotice(null);
    const result = await privacy.cancelDeletion();
    privacyActRef.current = false;
    setCancelling(false);
    if (result === null) return;
    // The Cancel row is gone once the deletion is; the screen reader returns to the Delete account row.
    setReturnTo('DELETE');
    say(setDeletionNotice, result === 'CANCELLED' ? copy.privacy.deleteCancelled
      : result === 'NOT_CANCELLABLE' ? copy.privacy.deleteNotCancellable : copy.privacy.network);
  }, [copy, privacy, say]);
  // A request that the server now holds closes its form, and what is now true is said once — the same words its row
  // shows, from the state the server returned.
  const exportAccepted = useCallback(() => {
    leaveChange();
    const said = exportStatusSaid(privacy?.getState().view ?? null, copy.privacy, language);
    if (said !== null) AccessibilityInfo.announceForAccessibility(said);
  }, [copy, language, leaveChange, privacy]);
  const deletionAccepted = useCallback(() => {
    leaveChange();
    const said = deletionStatusSaid(privacy?.getState().view ?? null, copy.privacy, language);
    if (said !== null) AccessibilityInfo.announceForAccessibility(said);
  }, [copy, language, leaveChange, privacy]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: palette.world }} testID={SETTINGS_SURFACE_TEST_ID} />;

  const changeProps = { language, palette, onFinished: leaveChange, busyChanged: onCommitBusy } as const;
  let change = null;
  if (changing === 'PUBLIC_ID' && publicId !== undefined && publicIdState.publicId !== null) {
    change = (
      <PublicIdChangeSurface
        controller={publicId}
        currentPublicId={publicIdState.publicId}
        copy={copy.publicId}
        language={language}
        palette={palette}
        onFinished={leaveChange}
        busyChanged={onCommitBusy}
      />
    );
  } else if (identity !== undefined && account !== null) {
    if (changing === 'NAME' && account.name !== null) change = <NameChange controller={identity} current={account.name} copy={copy.identity} {...changeProps} />;
    if (changing === 'LOGIN_ID' && account.loginId !== null) change = <LoginIdChange controller={identity} current={account.loginId} copy={copy.identity} {...changeProps} />;
    if (changing === 'EMAIL') change = <EmailChange controller={identity} current={account.email} copy={copy.identity} onChanged={signOut} {...changeProps} />;
    if (changing === 'PASSWORD') {
      change = (
        <PasswordChange
          controller={identity}
          copy={copy.security}
          network={copy.identity.network}
          passwordIncorrect={copy.identity.passwordIncorrect}
          onChanged={passwordChanged}
          onSignedOut={signOut}
          {...changeProps}
        />
      );
    }
  }

  if (privacy !== undefined && privacyState.status === 'READY') {
    const requestProps = { controller: privacy, copy: copy.privacy, language, palette, busyChanged: onCommitBusy } as const;
    if (changing === 'EXPORT') change = <ExportRequest {...requestProps} onAccepted={exportAccepted} />;
    if (changing === 'DELETE') change = <DeletionRequest {...requestProps} onAccepted={deletionAccepted} />;
  }

  const publicIdReady = publicIdState.status === 'READY' && publicIdState.publicId !== null;

  return (
    <View
      testID={SETTINGS_SURFACE_TEST_ID}
      accessibilityLanguage={language}
      // The reader's layout direction: every start and end below is logical.
      style={{ flex: 1, backgroundColor: palette.world, direction: writing }}
    >
      <AppearanceStatusBar />
      <View
        style={{
          paddingTop: insets.top,
          paddingStart: (writing === 'rtl' ? insets.right : insets.left) + 10,
          paddingEnd: (writing === 'rtl' ? insets.left : insets.right) + 10,
          minHeight: insets.top + HEADER_MIN_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          columnGap: 2,
        }}
      >
        <Control
          palette={palette}
          language={language}
          accessibilityLabel={copy.backName}
          onPress={changing !== null ? leaveChange : onBack}
          testID="qandeel-settings-back"
          style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center' }}
        >
          <Glyph name="back" color={palette.restInk} direction={writing} />
        </Control>
        <Text
          ref={titleRef}
          testID="qandeel-settings-title"
          accessibilityRole="header"
          accessibilityLanguage={language}
          style={{ ...typeStyle('statement'), color: palette.primary, flexShrink: 1, paddingHorizontal: 2, writingDirection: writing }}
        >
          {copy.title}
        </Text>
      </View>

      <ScrollView
        testID="qandeel-settings-body"
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 16, paddingLeft: insets.left, paddingRight: insets.right }}
      >
        {change !== null ? change : (
          <>
            {publicIdReady || account !== null ? (
              <View testID="qandeel-settings-group-account">
                <GroupHeading text={copy.accountGroup} language={language} palette={palette} testID="qandeel-settings-group-account-name" />
                {account !== null && account.name !== null ? (
                  <IdentityRow term={copy.identity.nameTerm} value={account.name} ltr={false} language={language} palette={palette}
                    onOpen={() => openChange('NAME')} rowRef={rowRef('NAME')} testID="qandeel-name-row" />
                ) : null}
                {account !== null && account.loginId !== null ? (
                  <IdentityRow term={copy.identity.loginIdTerm} value={account.loginId} ltr language={language} palette={palette}
                    onOpen={() => openChange('LOGIN_ID')} rowRef={rowRef('LOGIN_ID')} testID="qandeel-login-id-row" />
                ) : null}
                {account !== null ? (
                  <IdentityRow term={copy.identity.emailTerm} value={account.email} ltr language={language} palette={palette}
                    onOpen={() => openChange('EMAIL')} rowRef={rowRef('EMAIL')} testID="qandeel-email-row" />
                ) : null}
                {publicIdReady && publicIdState.publicId !== null ? (
                  <PublicIdRow
                    state={{ ...publicIdState, publicId: publicIdState.publicId }}
                    copy={copy.publicId}
                    language={language}
                    palette={palette}
                    onOpen={() => openChange('PUBLIC_ID')}
                    rowRef={rowRef('PUBLIC_ID')}
                  />
                ) : null}
              </View>
            ) : null}

            {account !== null ? (
              <View testID="qandeel-settings-group-security">
                <GroupHeading text={copy.security.group} language={language} palette={palette} testID="qandeel-settings-group-security-name" />
                <ActionRow label={copy.security.changePassword} notice={passwordNotice} busy={false} language={language} palette={palette}
                  onPress={() => {
                    setPasswordNotice(null);
                    openChange('PASSWORD');
                  }}
                  rowRef={rowRef('PASSWORD')} testID="qandeel-change-password" />
                <ActionRow label={copy.security.signOutOthers} notice={othersNotice} busy={signingOutOthers} language={language} palette={palette}
                  onPress={() => void signOutOthers()} testID="qandeel-sign-out-others" />
                {/* The current Email and its status, as the recovery method (W3-PDG-01 §3). Read here, changed above. */}
                <IdentityRow term={copy.identity.emailTerm} value={account.email} ltr status={account.emailVerified ? copy.identity.emailVerified : undefined}
                  language={language} palette={palette} testID="qandeel-recovery-email" />
              </View>
            ) : null}

            {/* W3-MEGA-S — the app language is the SYSTEM's: this row only opens its setting (W3-PDG-01 §5). */}
            <View testID="qandeel-settings-group-qandeel">
              <GroupHeading text={copy.qandeelGroup} language={language} palette={palette} testID="qandeel-settings-group-qandeel-name" />
              <LanguageRow copy={copy.language} language={language} palette={palette} onOpen={() => void openLanguageSettings()} />
            </View>

            <View testID="qandeel-settings-group-appearance">
              <GroupHeading text={copy.appearanceGroup} language={language} palette={palette} testID="qandeel-settings-group-appearance-name" />
              <View accessibilityRole="radiogroup" accessibilityLabel={copy.appearanceGroup} accessibilityLanguage={language}>
                {APPEARANCE_PREFERENCES.map((preference) => (
                  <AppearanceChoice
                    key={preference}
                    preference={preference}
                    label={copy.appearance[preference]}
                    selected={appearance.preference === preference}
                    onChoose={onChoose}
                    language={language}
                    palette={palette}
                  />
                ))}
              </View>
            </View>

            {privacy !== undefined && privacyState.status === 'READY' && privacyState.view !== null ? (
              <View testID="qandeel-settings-group-privacy">
                <GroupHeading text={copy.privacyGroup} language={language} palette={palette} testID="qandeel-settings-group-privacy-name" />
                <PrivacyDataRows
                  view={privacyState.view}
                  copy={copy.privacy}
                  language={language}
                  palette={palette}
                  notices={{ export: exportNotice, deletion: deletionNotice }}
                  busy={{ download: downloading, cancel: cancelling }}
                  onRequestExport={() => {
                    setExportNotice(null);
                    openChange('EXPORT');
                  }}
                  onDownload={() => void download()}
                  onRequestDeletion={() => {
                    setDeletionNotice(null);
                    openChange('DELETE');
                  }}
                  onCancelDeletion={() => void cancelDeletion()}
                  rowRef={rowRef}
                />
              </View>
            ) : null}

            <View testID="qandeel-settings-group-support">
              <GroupHeading text={copy.supportGroup} language={language} palette={palette} testID="qandeel-settings-group-support-name" />
              <Control
                palette={palette}
                language={language}
                accessibilityLabel={copy.signOut}
                accessibilityState={{ busy: signingOut, disabled: signingOut }}
                onPress={signOut}
                testID="qandeel-settings-sign-out"
                style={{ minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0, opacity: signingOut ? BUSY_OPACITY : 1 }}
              >
                <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{copy.signOut}</Text>
              </Control>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
