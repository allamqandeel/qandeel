/**
 * S4-01 — the «العالم المشترك» / Shared World area: its root and the World shell.
 *
 * Root (S4-01 §1.7, §8.2): the reader's current Shared Worlds, their incoming invitations and ONE invite / create
 * action — calm, and with no ranking of any kind: Worlds stand in the order they were born, invitations in the order
 * they arrived (CW2-07 §17). An invitation shows only what the invitee may see — the inviter's Name — with Accept and
 * Decline. The invite asks for the other person's Shared ID and answers one non-enumerating confirmation that names
 * nobody (S4-01 §1.3).
 *
 * World (S4-01 §1.6, CW2-07 §19–§21): entering resolves authority FIRST. Until the server says ALLOW only a neutral
 * transition shell is drawn — no name, no member, no welcome — and a denial is one neutral "not available" with the
 * way back. On ALLOW: the World's surface, its current members and QANDEEL's short welcome.
 *
 * S4-02: below them, the World's real conversation (`SharedWorldThread.tsx`) — read only after ALLOW, belonging to this
 * one World, with the reader's text input while ordinary sending is open.
 *
 * S4-03: inside an ALLOWed World, ONE calm way into «إدارة العالم» / Manage World (`SharedManagePage.tsx`), the World's
 * own management place — settings, the proposals that wait on the reader, removal, sharing earlier messages, leave and
 * ending the World. Leaving returns to the root at once. A World's committed name becomes its label; until then the S4-01
 * member-name label stays. The root lists the ended Worlds the reader may still read, each opening a separate read-only
 * place (`SharedClosedWorld.tsx`) that is never an active World.
 *
 * Nothing here reads the Personal world: no Session, camera, focus or time is passed in, so none can transfer.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, KeyboardAvoidingView, ScrollView, Text, TextInput, View, findNodeHandle } from 'react-native';

import { ActivityEntry, type ActivityAttentionController } from '../activity';
import { AppearanceStatusBar } from '../appearance';
import { Control, Glyph, MIN_TARGET, typeStyle, usePalette, useConversationTypeface, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { fill, sharedCopy, worldLabel, type SharedCopy } from './copy';
import { sharedLifecycleCopy } from './lifecycle-copy';
import type { SharedWorldController } from './shared-world-controller';
import { SharedClosedWorld } from './SharedClosedWorld';
import { SharedManagePage } from './SharedManagePage';
import { SharedSendBar, SharedThread } from './SharedWorldThread';

export const SHARED_AREA_TEST_ID = 'qandeel-shared-area';
const HEADER_MIN_HEIGHT = 48;
const ROW_START = 24;
const ROW_END = 20;
const BUSY_OPACITY = 0.6;
const FIELD_MIN_HEIGHT = 48;
const FIELD_RADIUS = 12;
/** LEFT-TO-RIGHT ISOLATE … POP DIRECTIONAL ISOLATE: a Shared ID is one Latin run in any paragraph. */
const LRI = String.fromCodePoint(0x2066);
const PDI = String.fromCodePoint(0x2069);

export interface SharedWorldAreaProps {
  readonly controller: SharedWorldController;
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  /** The one global Activity entry for this non-Analysis upper chrome (P3 §3); absent when the host has none. */
  readonly activity?: { readonly controller: ActivityAttentionController; readonly onOpen: () => void; readonly focus: boolean };
}

export function SharedWorldArea({ controller, language, insets, activity }: SharedWorldAreaProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const copy = sharedCopy(language);
  const lifecycle = sharedLifecycleCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const threadScroll = useRef<ScrollView | null>(null);
  // The World opens at its newest words and follows new ones — but an older page the reader asked for grows the thread
  // ABOVE them, and must never pull the reader away from what they asked to read.
  const heldEnds = useRef<{ readonly oldest: string | null; readonly newest: string | null }>({ oldest: null, newest: null });
  const followNewest = () => {
    const materials = state.thread.materials;
    const ends = { oldest: materials[0]?.materialId ?? null, newest: materials[materials.length - 1]?.materialId ?? null };
    const olderPage = heldEnds.current.oldest !== null && ends.oldest !== heldEnds.current.oldest && ends.newest === heldEnds.current.newest;
    heldEnds.current = ends;
    if (!olderPage) threadScroll.current?.scrollToEnd({ animated: false });
  };

  // Entering the area re-reads the root and re-resolves the World the reader left it on — authority before restore.
  useEffect(() => {
    controller.enter();
  }, [controller]);

  // Local Back: from a World to the area's root. At the root nothing is registered — Back is local-only and never
  // silently returns to the Personal world (I-08A4 §4).
  // S4-03: Back from Manage World returns to the World it manages; from an ended World, to the root.
  const placeKind = state.place.kind;
  useEffect(() => {
    if (placeKind === 'ROOT') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (placeKind === 'MANAGE') controller.closeManage();
      else controller.toRoot();
      return true;
    });
    return () => subscription.remove();
  }, [controller, placeKind]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: palette.world }} testID={SHARED_AREA_TEST_ID} />;

  const header = (title: string | null, back: boolean, onBack: () => void = () => controller.toRoot()) => (
    <View style={{
      paddingTop: insets.top, paddingStart: (writing === 'rtl' ? insets.right : insets.left) + 10, paddingEnd: (writing === 'rtl' ? insets.left : insets.right) + 10,
      minHeight: insets.top + HEADER_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center', columnGap: 2,
    }}>
      {back ? (
        <Control palette={palette} language={language} accessibilityLabel={copy.back} onPress={onBack} testID="qandeel-shared-back" style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center' }}>
          <Glyph name="back" color={palette.restInk} direction={writing} />
        </Control>
      ) : activity !== undefined ? (
        <ActivityEntry controller={activity.controller} language={language} onOpen={activity.onOpen} focus={activity.focus} />
      ) : null}
      {title === null ? <View style={{ flex: 1 }} /> : (
        <Text testID="qandeel-shared-title" accessibilityRole="header" accessibilityLanguage={language}
          style={{ ...typeStyle('statement'), color: palette.primary, flex: 1, paddingHorizontal: 2, writingDirection: writing }}>
          {title}
        </Text>
      )}
    </View>
  );

  const frame = (children: ReactNode, testID: string) => (
    <View testID={SHARED_AREA_TEST_ID} accessibilityLanguage={language} style={{ flex: 1, backgroundColor: palette.world, direction: writing }}>
      <AppearanceStatusBar />
      <View testID={testID} style={{ flex: 1 }}>{children}</View>
    </View>
  );

  if (state.place.kind === 'MANAGE') {
    // «إدارة العالم» / Manage World: the World's own management place. Its fields stay above the keyboard on both
    // platforms (the S4-02 rule: Android 15+ edge-to-edge does not resize for the keyboard).
    return frame(
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" testID="qandeel-shared-manage-keyboard">
        {header(lifecycle.manageWorld, true, () => controller.closeManage())}
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingLeft: insets.left, paddingRight: insets.right }}>
          <SharedManagePage controller={controller} language={language} palette={palette} bottomInset={insets.bottom} />
        </ScrollView>
      </KeyboardAvoidingView>,
      'qandeel-shared-managing',
    );
  }

  if (state.place.kind === 'CLOSED') {
    const ended = state.closed.world;
    return frame(
      <>
        {header(ended === null ? null : labelOfWorld(copy, ended), true)}
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16, paddingLeft: insets.left, paddingRight: insets.right }}>
          <SharedClosedWorld controller={controller} language={language} palette={palette} />
        </ScrollView>
      </>,
      'qandeel-shared-ended-world',
    );
  }

  if (state.place.kind === 'WORLD') {
    if (state.entry.status === 'ALLOW' && state.entry.world !== null) {
      const world = state.entry.world;
      return frame(
        // As in the Personal Conversation: `padding` on both platforms, because Android 15+ edge-to-edge no longer
        // resizes the window for the keyboard, and the composer and its Send must stay above it.
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          {header(labelOfWorld(copy, world), true)}
          <ScrollView ref={threadScroll} keyboardShouldPersistTaps="handled" onContentSizeChange={followNewest}
            contentContainerStyle={{ paddingBottom: 16, paddingLeft: insets.left, paddingRight: insets.right }}>
            {/* QANDEEL's short, neutral welcome (S4-01 §1.6), then the World's real conversation (S4-02). */}
            <View testID="qandeel-shared-welcome" accessible accessibilityLabel={`${copy.personalWorld}: ${copy.welcome}`} accessibilityLanguage={language}
              style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 18, rowGap: 4 }}>
              <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{copy.personalWorld}</Text>
              <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{copy.welcome}</Text>
            </View>
            <SectionHeading text={copy.membersHeading} palette={palette} language={language} />
            <View testID="qandeel-shared-members">
              {world.members.map((member, index) => (
                <View key={`${index}-${member.name ?? ''}`} testID={`qandeel-shared-member-${index}`} style={{ minHeight: MIN_TARGET, justifyContent: 'center', paddingStart: ROW_START, paddingEnd: ROW_END }}>
                  <Text style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>
                    {member.self ? copy.you : member.name ?? copy.someone}
                  </Text>
                </View>
              ))}
            </View>
            {/* S4-03: the one way into the World's own management place. */}
            <View style={{ paddingStart: ROW_START - 12, paddingTop: 6 }}>
              <Control palette={palette} language={language} accessibilityLabel={lifecycle.manageWorld} onPress={() => controller.openManage()} testID="qandeel-shared-manage-open"
                style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center' }}>
                <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: writing }}>{lifecycle.manageWorld}</Text>
              </Control>
            </View>
            <SharedThread key={world.worldId} controller={controller} language={language} palette={palette} />
          </ScrollView>
          <SharedSendBar key={`send-${world.worldId}`} controller={controller} language={language} palette={palette} bottomInset={insets.bottom} />
        </KeyboardAvoidingView>,
        'qandeel-shared-world',
      );
    }
    if (state.entry.status === 'DENIED') {
      return frame(
        <>
          {header(null, true)}
          <View testID="qandeel-shared-world-unavailable" accessibilityLiveRegion="polite" style={{ padding: ROW_START }}>
            <Text style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>{copy.worldUnavailable}</Text>
          </View>
        </>,
        'qandeel-shared-denied',
      );
    }
    // The pre-authority transition shell: the world's ground and the way back, and nothing of the destination.
    return frame(
      <>
        {header(null, true)}
        <View testID="qandeel-shared-transition" accessible accessibilityLabel={copy.opening} accessibilityState={{ busy: true }} accessibilityLanguage={language} style={{ flex: 1 }} />
      </>,
      'qandeel-shared-resolving',
    );
  }

  return frame(
    <>
      {header(copy.sharedWorld, false)}
      <SharedRoot controller={controller} copy={copy} language={language} palette={palette} insets={insets} />
    </>,
    'qandeel-shared-root',
  );
}

function SectionHeading({ text, palette, language }: { readonly text: string; readonly palette: ConversationPalette; readonly language: ChromeLanguage }) {
  return (
    <Text accessibilityRole="header" accessibilityLanguage={language}
      style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 22, paddingBottom: 6, writingDirection: language === 'ar' ? 'rtl' : 'ltr' }}>
      {text}
    </Text>
  );
}

function SharedRoot({ controller, copy, language, palette, insets }: {
  readonly controller: SharedWorldController;
  readonly copy: SharedCopy;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly insets: { readonly right: number; readonly bottom: number; readonly left: number };
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const root = state.root.data;
  const [inviting, setInviting] = useState(false);
  const lifecycle = sharedLifecycleCopy(language);
  const noticeText = state.notice === 'DECLINED' ? copy.declined : state.notice === 'NOT_OPEN' ? copy.notOpen
    : state.notice === 'ACTION_UNAVAILABLE' ? copy.actionUnavailable : state.notice === 'LEFT' ? lifecycle.left : null;
  useEffect(() => {
    if (noticeText !== null) AccessibilityInfo.announceForAccessibility(noticeText);
  }, [noticeText]);

  return (
    <ScrollView testID="qandeel-shared-root-body" keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 16, paddingLeft: insets.left, paddingRight: insets.right }}>
      <View testID="qandeel-shared-notice" accessibilityLiveRegion="polite" style={{ paddingStart: ROW_START, paddingEnd: ROW_END }}>
        {noticeText === null ? null : <Text style={{ ...typeStyle('supporting'), color: palette.secondary, paddingTop: 10, writingDirection: writing }}>{noticeText}</Text>}
      </View>

      {state.root.status === 'UNAVAILABLE' && root === null ? (
        <View testID="qandeel-shared-unavailable" style={{ padding: ROW_START, rowGap: 8 }}>
          <Text style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>{copy.actionUnavailable}</Text>
          <Control palette={palette} language={language} accessibilityLabel={copy.retry} onPress={() => controller.enter()} testID="qandeel-shared-retry"
            style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, justifyContent: 'center' }}>
            <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.retry}</Text>
          </Control>
        </View>
      ) : root === null ? (
        <View testID="qandeel-shared-loading" accessibilityState={{ busy: true }} style={{ padding: ROW_START }} />
      ) : (
        <>
          {root.capabilities.invitation ? (
            inviting ? (
              <InvitePanel controller={controller} copy={copy} language={language} palette={palette} onClose={() => setInviting(false)} />
            ) : (
              <View style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 16 }}>
                <Control palette={palette} language={language} accessibilityLabel={copy.createWorld} onPress={() => setInviting(true)} testID="qandeel-shared-create"
                  style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: palette.field }}>
                  <Text style={{ ...typeStyle('action'), color: palette.primary, writingDirection: writing }}>{copy.createWorld}</Text>
                </Control>
              </View>
            )
          ) : (
            <Text testID="qandeel-shared-not-open" style={{ ...typeStyle('supporting'), color: palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 16, writingDirection: writing }}>
              {copy.notOpen}
            </Text>
          )}

          {root.invitations.length > 0 || root.memberRequests.length > 0 ? (
            <View testID="qandeel-shared-invitations">
              <SectionHeading text={copy.invitationsHeading} palette={palette} language={language} />
              {root.invitations.map((invitation) => {
                const busy = state.busy === invitation.invitationId;
                const text = fill(copy.invitation, invitation.inviterName ?? copy.someone);
                return (
                  <View key={invitation.invitationId} testID={`qandeel-shared-invitation-${invitation.invitationId}`} style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 8, rowGap: 8, opacity: busy ? BUSY_OPACITY : 1 }}>
                    <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{text}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 8 }}>
                      <Control palette={palette} language={language} accessibilityLabel={`${copy.accept}, ${text}`} accessibilityState={{ busy, disabled: state.busy !== null }}
                        onPress={() => void controller.accept(invitation.invitationId)} testID="qandeel-shared-accept"
                        style={{ minHeight: MIN_TARGET, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: palette.field }}>
                        <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.accept}</Text>
                      </Control>
                      <Control palette={palette} language={language} accessibilityLabel={`${copy.decline}, ${text}`} accessibilityState={{ disabled: state.busy !== null }}
                        onPress={() => void controller.decline(invitation.invitationId)} testID="qandeel-shared-decline"
                        style={{ minHeight: MIN_TARGET, paddingHorizontal: 16, justifyContent: 'center' }}>
                        <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.decline}</Text>
                      </Control>
                    </View>
                  </View>
                );
              })}
              {/* S4-03: an add / rejoin waiting on the reader as its exact target: who proposed it, nothing of the World. There
                  is no decline in canon: the reader simply does not accept. */}
              {root.memberRequests.map((request) => {
                const busy = state.busy === request.requestId;
                const text = fill(request.kind === 'ADD' ? lifecycle.memberRequestAdd : lifecycle.memberRequestRejoin, request.proposerName ?? copy.someone);
                return (
                  <View key={request.requestId} testID={`qandeel-shared-member-request-${request.requestId}`} style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 8, rowGap: 8, opacity: busy ? BUSY_OPACITY : 1 }}>
                    <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{text}</Text>
                    <Control palette={palette} language={language} accessibilityLabel={`${lifecycle.accept}, ${text}`} accessibilityState={{ busy, disabled: state.busy !== null }}
                      onPress={() => void controller.acceptMembershipRequest(request.requestId)} testID="qandeel-shared-member-request-accept"
                      style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: palette.field }}>
                      <Text style={{ ...typeStyle('action'), color: palette.primary }}>{lifecycle.accept}</Text>
                    </Control>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View testID="qandeel-shared-worlds">
            <SectionHeading text={copy.worldsHeading} palette={palette} language={language} />
            {root.worlds.length === 0 ? (
              <Text testID="qandeel-shared-no-worlds" style={{ ...typeStyle('body'), color: palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: writing }}>
                {copy.noWorlds}
              </Text>
            ) : root.worlds.map((world) => {
              const label = labelOfWorld(copy, world);
              return (
                <Control key={world.worldId} palette={palette} language={language} accessibilityLabel={label} onPress={() => controller.openWorld(world.worldId)}
                  testID={`qandeel-shared-world-${world.worldId}`} style={{ minHeight: MIN_TARGET, paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 10, borderRadius: 0 }}>
                  <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{label}</Text>
                </Control>
              );
            })}
          </View>

          {/* S4-03: the ended Worlds the reader may still read — a separate, read-only place each. */}
          {root.closedWorlds.length > 0 ? (
            <View testID="qandeel-shared-ended-worlds">
              <SectionHeading text={lifecycle.endedHeading} palette={palette} language={language} />
              {root.closedWorlds.map((world) => {
                const label = labelOfWorld(copy, world);
                return (
                  <Control key={world.worldId} palette={palette} language={language} accessibilityLabel={label} onPress={() => controller.openClosed(world.worldId)}
                    testID={`qandeel-shared-ended-${world.worldId}`} style={{ minHeight: MIN_TARGET, paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 10, borderRadius: 0 }}>
                    <Text style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>{label}</Text>
                  </Control>
                );
              })}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function InvitePanel({ controller, copy, language, palette, onClose }: {
  readonly controller: SharedWorldController;
  readonly copy: SharedCopy;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly onClose: () => void;
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);
  const labelRef = useRef<Text | null>(null);
  useEffect(() => {
    const node = labelRef.current === null ? null : findNodeHandle(labelRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);

  const send = useCallback(async () => {
    if (busyRef.current || value.trim().length === 0) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    const outcome = await controller.invite(value);
    busyRef.current = false;
    if (!mounted.current) return;
    setBusy(false);
    const said = outcome === 'SUBMITTED' ? copy.invitationSent : outcome === 'INVALID_SHARED_ID' ? copy.invalidSharedId
      : outcome === 'NOT_OPEN' ? copy.notOpen : copy.actionUnavailable;
    if (outcome === 'SUBMITTED') setValue('');
    setMessage(said);
    AccessibilityInfo.announceForAccessibility(said);
  }, [controller, copy, value]);

  return (
    <View testID="qandeel-shared-invite" style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 16, rowGap: 10 }}>
      <Text ref={labelRef} style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{copy.inviteFieldLabel}</Text>
      {/* A Shared ID is typed left to right in any language (P1 §16; T-14 §5). */}
      <View style={{ direction: 'ltr' }}>
        <TextInput
          testID="qandeel-shared-invite-input"
          value={value}
          onChangeText={(text) => {
            setValue(text);
            if (message !== null) setMessage(null);
          }}
          editable={!busy}
          placeholder={copy.inviteHint}
          placeholderTextColor={palette.tertiary}
          accessibilityLabel={copy.inviteFieldLabel}
          accessibilityLanguage={language}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          importantForAutofill="no"
          keyboardType="ascii-capable"
          maxLength={32}
          returnKeyType="send"
          onSubmitEditing={() => void send()}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          selectionColor={palette.primary}
          cursorColor={palette.primary}
          style={{
            ...typeStyle('body'), color: palette.primary, backgroundColor: palette.field, minHeight: FIELD_MIN_HEIGHT, borderRadius: FIELD_RADIUS,
            paddingHorizontal: 14, paddingVertical: 9, borderWidth: palette.focusThickness, borderColor: focused ? palette.focusIndicator : palette.field,
            textAlign: 'left', writingDirection: 'ltr',
          }}
        />
      </View>
      <View testID="qandeel-shared-invite-message" accessibilityLiveRegion="polite">
        {message === null ? null : <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{message}</Text>}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', columnGap: 12, rowGap: 10 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.cancel} onPress={onClose} testID="qandeel-shared-invite-cancel"
          style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.cancel}</Text>
        </Control>
        <Control palette={palette} language={language} accessibilityLabel={copy.sendInvitation} accessibilityState={{ busy, disabled: busy }} onPress={() => void send()}
          testID="qandeel-shared-invite-send" style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: palette.field, opacity: busy ? BUSY_OPACITY : 1 }}>
          <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.sendInvitation}</Text>
        </Control>
      </View>
    </View>
  );
}

/** S4-03: a World's label — its committed name once one is committed; until then the S4-01 member-name label. */
export function labelOfWorld(copy: SharedCopy, world: { readonly name: string | null; readonly members: readonly { readonly name: string | null; readonly self: boolean }[] }): string {
  return world.name !== null && world.name.length > 0 ? world.name : worldLabel(copy, world.members);
}

/** A Shared ID as one isolated left-to-right run. */
export const isolatedSharedId = (value: string): string => `${LRI}${value}${PDI}`;
