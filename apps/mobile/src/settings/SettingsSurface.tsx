/**
 * W3-01 (E2E-D-01 / D-10 / D-07) — the ONE General Settings destination, bounded to what W3-01 owns.
 *
 * P1 §8 / P4-C1 S-B: one application-wide destination, entered from Personal QANDEEL's own row. It is not a
 * route, a world, a Session or a canonical state: the Personal world shows it over itself and keeps
 * everything beneath it exactly as it was, so Back returns to the same place.
 *
 * It exposes only the two groups whose functions exist now, and draws no placeholder for any other group:
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
 *   - «الحساب والهوية» / Account & Identity — the reader's Public ID and its ONE lifetime manual change
 *     (P1 §6). It is drawn once the Public ID has been read, and it holds that one function and nothing
 *     else: no Name, photo, Login ID, Email, Shared ID or Security row, disabled or otherwise. The change
 *     is a state of THIS destination — not a route, a dialog or a world — and Back leaves the change, not
 *     Settings.
 *
 * The final nine-group Settings hierarchy is NOT this surface (D-02 advances only).
 *
 * The frame is laid out logically (`direction`), so the start and end edges are the reader's in Arabic and
 * English alike. Every colour is the canonical palette's, in the reader's effective appearance.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, BackHandler, ScrollView, Text, View, findNodeHandle } from 'react-native';

import { APPEARANCE_PREFERENCES, AppearanceStatusBar, useAppearance, useAppearanceChoice, type AppearancePreference } from '../appearance';
import { Control, Glyph, MIN_TARGET, typeStyle, useConversationTypeface, usePalette, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { settingsCopy } from './copy';
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
  /** W3-02: the reader's Public ID for this runtime generation. Without it, Account & Identity is not drawn. */
  readonly publicId?: PublicIdController;
}

const NO_PUBLIC_ID: PublicIdState = Object.freeze({ status: 'LOADING', publicId: null, changeAvailable: false });
const noSubscription = () => () => undefined;

/** The Public ID state of the generation's controller, or LOADING when there is none. */
function usePublicIdState(controller: PublicIdController | undefined): PublicIdState {
  return useSyncExternalStore(
    controller === undefined ? noSubscription : controller.subscribe,
    controller === undefined ? () => NO_PUBLIC_ID : controller.getState,
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

export function SettingsSurface({ language, insets, onBack, onSignOut, publicId }: SettingsSurfaceProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const copy = settingsCopy(language);
  const appearance = useAppearance();
  const choose = useAppearanceChoice();
  const writing = language === 'ar' ? 'rtl' : 'ltr';

  // W3-02 — the Public ID: read when Settings is shown, and changed only inside this destination.
  const publicIdState = usePublicIdState(publicId);
  useEffect(() => {
    publicId?.start();
  }, [publicId]);
  const [changingPublicId, setChangingPublicId] = useState(false);
  const committingRef = useRef(false);
  const [returnToRow, setReturnToRow] = useState(false);
  const rowNode = useRef<View | null>(null);
  const openChange = useCallback(() => {
    setReturnToRow(false);
    setChangingPublicId(true);
  }, []);
  const leaveChange = useCallback(() => {
    // A commit in flight is never abandoned half-way: its answer decides what the reader sees next.
    if (committingRef.current) return;
    setChangingPublicId(false);
    setReturnToRow(true);
  }, []);
  const onCommitBusy = useCallback((busy: boolean) => {
    committingRef.current = busy;
  }, []);
  // Android system Back while the change is shown leaves the change, and nothing else.
  useEffect(() => {
    if (!changingPublicId) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      leaveChange();
      return true;
    });
    return () => subscription.remove();
  }, [changingPublicId, leaveChange]);
  // Back from the change, the screen reader returns to the Public ID row.
  useEffect(() => {
    if (!returnToRow || changingPublicId || rowNode.current === null) return;
    const node = findNodeHandle(rowNode.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [changingPublicId, returnToRow, publicIdState]);

  // The screen reader arrives on the destination's name, once, when the surface is drawn.
  const titleRef = useRef<Text | null>(null);
  useEffect(() => {
    if (!ready) return;
    const node = titleRef.current === null ? null : findNodeHandle(titleRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [ready]);

  // One sign-out. The ref refuses a second press in the same frame, before the busy state has rendered.
  const signingOutRef = useRef(false);
  const [signingOut, setSigningOut] = useState(false);
  const signOut = useCallback(() => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    setSigningOut(true);
    // The runtime retires this surface when the authority publishes SIGNED_OUT; nothing here navigates.
    void onSignOut();
  }, [onSignOut]);

  const onChoose = useCallback((preference: AppearancePreference) => {
    choose?.(preference);
  }, [choose]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: palette.world }} testID={SETTINGS_SURFACE_TEST_ID} />;

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
          onPress={changingPublicId ? leaveChange : onBack}
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
        {changingPublicId && publicId !== undefined && publicIdState.publicId !== null ? (
          <PublicIdChangeSurface
            controller={publicId}
            currentPublicId={publicIdState.publicId}
            copy={copy.publicId}
            language={language}
            palette={palette}
            onFinished={leaveChange}
            busyChanged={onCommitBusy}
          />
        ) : (
          <>
            {publicIdState.status === 'READY' && publicIdState.publicId !== null ? (
              <View testID="qandeel-settings-group-account">
                <GroupHeading text={copy.accountGroup} language={language} palette={palette} testID="qandeel-settings-group-account-name" />
                <PublicIdRow
                  state={{ ...publicIdState, publicId: publicIdState.publicId }}
                  copy={copy.publicId}
                  language={language}
                  palette={palette}
                  onOpen={openChange}
                  rowRef={(node) => {
                    rowNode.current = node;
                  }}
                />
              </View>
            ) : null}

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
