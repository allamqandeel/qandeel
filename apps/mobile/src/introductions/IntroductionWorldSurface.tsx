/**
 * S6-05 (CP5) — the Introduction World on the device: the two humans' private space after a Mutual Match, its one
 * unilateral END, and the closed record each human keeps afterwards. It implements V-1 exactly as the Product Owner
 * approved it (Visual Gate CLOSED 2026-10-15; docs/e2e/QANDEEL_S6_05_VISUAL_COPY_GATE_v1.md): a structural identity with
 * no new colour, token or component.
 *
 *   - S13 / S14: nothing of the World — not even the other person's name — is drawn before the server's read of it
 *     answers; a World this person cannot see is one neutral "not available" (no oracle).
 *   - S6 / S7 / S9: ONE opening block with a 2px start-edge seam in the `primary` ink (the existing `selectedMarker` at
 *     its `markerThickness`) holding the name (IW-11 / IW-11b), the M-11 line, the fixed welcome (IW-22, client text,
 *     R-3) and the note (IW-23). No «قنديل» label: the welcome is the space's own text, not a QANDEEL message.
 *   - S8: the two humans' words in the Shared World's own bubbles (`SharedReadOnlyMaterial` / `SharedOwnMaterial`) and its
 *     composer (`SharedComposer`, IW-24 as its accessible name); the reader deletes their own words through the existing
 *     Shared owner deletion (R-5). When the opening scrolls away, the title moves into the header.
 *   - Tools: back and «إنهاء التعارف» only (D4). No Manage World, no members, no add, no Living Analysis, no field.
 *   - S10 / S11: one confirmation, no reason asked, no red destructive style; the END is S6-02's, retried with the same
 *     command id.
 *   - S12: the closed record — no composer, no END, no management; what this human's own entitlement keeps, after every
 *     owner deletion, with the reader's own words still deletable.
 *   - S15a / S15b: a failed send keeps its words as an unsent message with «إعادة المحاولة» (same command id), and never
 *     says the Introduction ended; IW-35 appears ONLY when the server itself answered the send with the ended state.
 *
 * QANDEEL never speaks here: no reply, weaving, analysis, Activity or Push (R-1, R-7).
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, KeyboardAvoidingView, ScrollView, Text, View, findNodeHandle, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { AppearanceStatusBar } from '../appearance';
import { Control, Glyph, MIN_TARGET, typeStyle, useConversationTypeface, usePalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import type { IntroductionMessage, SharedMaterial } from '../runtime-entry';
import { sharedConversationCopy } from '../shared-world/conversation-copy';
import { sharedCopy } from '../shared-world/copy';
import { SharedComposer, SharedOwnMaterial, SharedReadOnlyMaterial } from '../shared-world/SharedWorldThread';
import { introductionTitle, introductionWorldCopy, type IntroductionWorldCopy } from './introduction-world-copy';
import {
  INTRODUCTION_MESSAGE_MAX_LENGTH, firstNameOf, type IntroductionPending, type IntroductionWorldsController, type IntroductionWorldView,
} from './introduction-world-controller';
import { Action, BUSY_OPACITY, LOCAL_TYPE, Para, ROW_END, ROW_START, type PartContext } from './IntroductionsParts';
import { proposalsCopy } from './proposals-copy';

export const INTRODUCTION_WORLD_TEST_ID = 'qandeel-introduction-world';
const HEADER_MIN_HEIGHT = 48;
const SHEET_RADIUS = 24;
/** V-1: the opening's inner gap between the seam and its words, and between the name block and the welcome. */
const SEAM_GAP = 14;
const OPENING_GAP = 12;
/** V-1 hairline under the opening and above the closed banner: the existing GlobalSwitcher hairline (tertiary ink, 0.4). */
const HAIRLINE_OPACITY = 0.4;

export interface IntroductionWorldSurfaceProps {
  readonly controller: IntroductionWorldsController;
  readonly worldId: string;
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  /** Returns to wherever the World was opened from (the proposals or «العالم المشترك»). */
  readonly onBack: () => void;
}

/** A message as the Shared bubbles draw it: the other person's words under their first name, never an account Name. */
const asMaterial = (message: IntroductionMessage, otherName: string): SharedMaterial => ({
  materialId: message.materialId, producer: message.producer, authorName: message.producer === 'HUMAN' ? otherName : null,
  text: message.text, establishedAt: message.establishedAt, canDelete: message.canDelete,
});

export function IntroductionWorldSurface({ controller, worldId, language, insets, onBack }: IntroductionWorldSurfaceProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const copy = introductionWorldCopy(language);
  const shared = sharedCopy(language);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const [askedToEnd, setConfirmingEnd] = useState(false);
  const [titleInHeader, setTitleInHeader] = useState(false);
  const openingBottom = useRef(0);
  const heldEnds = useRef<{ readonly oldest: string | null; readonly newest: string | null }>({ oldest: null, newest: null });
  const scroll = useRef<ScrollView | null>(null);
  const headingRef = useRef<Text | null>(null);
  const onHeading = useCallback((node: Text | null) => { headingRef.current = node; }, []);

  // Opening the World asks the server first; leaving it forgets it.
  useEffect(() => {
    controller.open(worldId);
    return () => controller.close();
  }, [controller, worldId]);

  const view: IntroductionWorldView | null = state.open !== null && state.open.worldId === worldId ? state.open : null;
  const status = view?.status ?? 'LOADING';
  const firstName = firstNameOf(state, worldId);
  const title = introductionTitle(copy, firstName);
  const ending = view?.end === 'RUNNING';

  // The confirmation stands only while the Introduction is live: once the END is decided (CLOSED, or not this reader's
  // any more) it is gone.
  const confirmingEnd = askedToEnd && status === 'ACTIVE';

  const back = () => {
    if (confirmingEnd) {
      if (!ending) setConfirmingEnd(false);
      return;
    }
    onBack();
  };
  const backRef = useRef(back);
  useEffect(() => {
    backRef.current = back;
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      backRef.current();
      return true;
    });
    return () => subscription.remove();
  }, []);

  // The screen reader arrives once on each level's heading.
  const levelKey = `${confirmingEnd ? 'END' : 'WORLD'}|${status}`;
  useEffect(() => {
    if (!ready) return;
    const node = headingRef.current === null ? null : findNodeHandle(headingRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [ready, levelKey]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: palette.world }} testID={INTRODUCTION_WORLD_TEST_ID} />;

  const ctx: PartContext = { palette, language, writing, busy: ending, onHeading };
  const sheetCtx: PartContext = { ...ctx, onSheet: true };
  const authorized = status === 'ACTIVE' || status === 'CLOSED';
  // The title is the World's own once the server vouched for it: in the header on the closed record, in the opening while
  // live (and in the header once the opening has scrolled away).
  const headerTitle = confirmingEnd ? copy.endTitle : authorized && (status === 'CLOSED' || titleInHeader) ? title : null;

  const header = (
    <View style={{
      paddingTop: insets.top, paddingStart: (writing === 'rtl' ? insets.right : insets.left) + 10, paddingEnd: (writing === 'rtl' ? insets.left : insets.right) + 10,
      minHeight: insets.top + HEADER_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center', columnGap: 2,
    }}>
      <Control palette={palette} language={language} accessibilityLabel={shared.back} onPress={back} testID="qandeel-introduction-back"
        style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center' }}>
        <Glyph name="back" color={palette.restInk} direction={writing} />
      </Control>
      {headerTitle === null ? <View style={{ flex: 1 }} /> : (
        <Text testID="qandeel-introduction-title" accessibilityRole="header" accessibilityLanguage={language} numberOfLines={1}
          ref={confirmingEnd || status === 'CLOSED' ? onHeading : undefined}
          style={{ ...LOCAL_TYPE.header, color: palette.primary, flex: 1, paddingHorizontal: 2, writingDirection: writing }}>
          {headerTitle}
        </Text>
      )}
      {!confirmingEnd && status === 'ACTIVE' ? (
        // IW-26: the one tool beside Back (D4).
        <Control palette={palette} language={language} accessibilityLabel={copy.endAction} onPress={() => setConfirmingEnd(true)} testID="qandeel-introduction-end"
          style={{ minHeight: MIN_TARGET, paddingHorizontal: 8, justifyContent: 'center' }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: writing }}>{copy.endAction}</Text>
        </Control>
      ) : null}
    </View>
  );

  const frame = (children: ReactNode, testID: string) => (
    <View testID={INTRODUCTION_WORLD_TEST_ID} accessibilityLanguage={language} style={{ flex: 1, backgroundColor: palette.world, direction: writing }}>
      <AppearanceStatusBar />
      <View testID={testID} style={{ flex: 1 }}>{children}</View>
    </View>
  );

  if (confirmingEnd && view !== null && status === 'ACTIVE') {
    return frame(<>
      {header}
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingLeft: insets.left, paddingRight: insets.right }}>
        <EndConfirmation ctx={ctx} copy={copy} view={view} />
        <View style={{ flexGrow: 1 }} />
        <View testID="qandeel-introduction-end-sheet"
          style={{ backgroundColor: palette.field, borderTopStartRadius: SHEET_RADIUS, borderTopEndRadius: SHEET_RADIUS, paddingTop: 14, paddingBottom: insets.bottom + 16, marginTop: 16,
            opacity: ending ? BUSY_OPACITY : 1 }}>
          <Action ctx={sheetCtx} primary disabled={ending} label={view.end === 'FAILED' ? shared.retry : copy.endConfirm}
            onPress={() => void controller.endIntroduction().then((kind) => { if (kind !== null && kind !== 'FAILED' && kind !== 'OFFLINE' && kind !== 'INVALID') setConfirmingEnd(false); })}
            testID="qandeel-introduction-end-confirm" />
          <Action ctx={sheetCtx} disabled={ending} label={shared.back} onPress={() => setConfirmingEnd(false)} testID="qandeel-introduction-end-cancel" />
        </View>
      </ScrollView>
    </>, 'qandeel-introduction-end-screen');
  }

  if (!authorized) {
    // S13 / S14: the way back and nothing of the World.
    const body = status === 'LOADING' ? (
      <View testID="qandeel-introduction-loading" accessible accessibilityLabel={shared.opening} accessibilityState={{ busy: true }} style={{ paddingTop: 24 }}>
        <Para ctx={ctx} text={shared.opening} role="supporting" color={palette.secondary} />
      </View>
    ) : (
      <View testID={status === 'UNAVAILABLE' ? 'qandeel-introduction-unavailable' : 'qandeel-introduction-failed'} accessibilityLiveRegion="polite" style={{ paddingTop: 30 }}>
        <Para ctx={ctx} text={status === 'UNAVAILABLE' ? shared.worldUnavailable : shared.actionUnavailable} color={palette.error} />
        <Action ctx={ctx} label={shared.retry} onPress={() => controller.reload()} testID="qandeel-introduction-retry" />
      </View>
    );
    return frame(<>{header}{body}</>, status === 'LOADING' ? 'qandeel-introduction-resolving' : 'qandeel-introduction-denied');
  }

  const closed = status === 'CLOSED';
  const followNewest = () => {
    const messages = view!.messages;
    const ends = { oldest: messages[0]?.materialId ?? null, newest: messages[messages.length - 1]?.materialId ?? null };
    const olderPage = heldEnds.current.oldest !== null && ends.oldest !== heldEnds.current.oldest && ends.newest === heldEnds.current.newest;
    heldEnds.current = ends;
    if (!olderPage) scroll.current?.scrollToEnd({ animated: false });
  };
  const otherName = firstName ?? shared.someone;
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (closed) return;
    const past = event.nativeEvent.contentOffset.y > openingBottom.current;
    if (past !== titleInHeader) setTitleInHeader(past);
  };

  return frame(
    // As in the Shared World: `padding` on both platforms, so the composer stays above the keyboard.
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      {header}
      <ScrollView ref={scroll} testID="qandeel-introduction-body" keyboardShouldPersistTaps="handled" onScroll={onScroll} scrollEventThrottle={64}
        onContentSizeChange={followNewest}
        contentContainerStyle={{ paddingBottom: 16, paddingLeft: insets.left, paddingRight: insets.right }}>
        {closed ? null : (
          <View onLayout={(event) => { openingBottom.current = event.nativeEvent.layout.y + event.nativeEvent.layout.height; }}>
            <Opening ctx={ctx} copy={copy} title={title} />
          </View>
        )}
        <Thread controller={controller} view={view!} ctx={ctx} copy={copy} otherName={otherName} />
      </ScrollView>
      {closed ? (
        <View testID="qandeel-introduction-closed-banner" accessible accessibilityLanguage={language} accessibilityLiveRegion="polite"
          style={{ marginStart: ROW_START, marginEnd: ROW_END, paddingTop: 0, paddingBottom: insets.bottom + 18 }}>
          <View style={{ height: 1, marginBottom: 12, backgroundColor: palette.tertiary, opacity: HAIRLINE_OPACITY }} />
          <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{copy.closedBanner}</Text>
        </View>
      ) : (
        <SharedComposer language={language} palette={palette} bottomInset={insets.bottom} accessibilityLabel={copy.composerName}
          sending={view!.pending !== null} maxLength={INTRODUCTION_MESSAGE_MAX_LENGTH} onSend={(draft) => controller.send(draft)} />
      )}
    </KeyboardAvoidingView>,
    closed ? 'qandeel-introduction-closed' : 'qandeel-introduction-active',
  );
}

/** V-1: the one opening block — the name, M-11, the fixed welcome and the note inside the 2px start-edge seam. */
function Opening({ ctx, copy, title }: { readonly ctx: PartContext; readonly copy: IntroductionWorldCopy; readonly title: string }) {
  const { palette, language, writing, onHeading } = ctx;
  return (
    <>
      <View testID="qandeel-introduction-opening"
        style={{ marginStart: ROW_START, marginEnd: ROW_END, marginTop: 6, marginBottom: 4, paddingVertical: 6, paddingStart: SEAM_GAP,
          borderStartWidth: palette.markerThickness, borderStartColor: palette.selectedMarker }}>
        <Text ref={onHeading} testID="qandeel-introduction-opening-title" accessibilityRole="header" accessibilityLanguage={language}
          style={{ ...LOCAL_TYPE.question, color: palette.primary, writingDirection: writing }}>{title}</Text>
        <Text testID="qandeel-introduction-both-agreed" style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{copy.bothAgreed}</Text>
        <View style={{ height: OPENING_GAP }} />
        <Text testID="qandeel-introduction-welcome" style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{copy.welcome}</Text>
        <Text testID="qandeel-introduction-note" style={{ ...typeStyle('supporting'), color: palette.secondary, marginTop: 6, writingDirection: writing }}>{copy.note}</Text>
      </View>
      <View testID="qandeel-introduction-hairline" style={{ height: 1, marginTop: 14, marginBottom: 4, marginStart: ROW_START, marginEnd: ROW_END, backgroundColor: palette.tertiary, opacity: HAIRLINE_OPACITY }} />
    </>
  );
}

const noticeOf = (view: IntroductionWorldView, copy: IntroductionWorldCopy, language: ChromeLanguage): string | null => {
  const shared = sharedCopy(language);
  switch (view.notice) {
    case 'ALREADY_ENDED': return copy.alreadyEnded;
    case 'DELETED': return sharedConversationCopy(language).deleted;
    case 'DELETE_FAILED': case 'OLDER_FAILED': case 'LOAD_FAILED': return shared.actionUnavailable;
    default: return null;
  }
};

/** The two humans' words, oldest first; the reader's own deletable; the one pending message and what the server said of it. */
function Thread({ controller, view, ctx, copy, otherName }: {
  readonly controller: IntroductionWorldsController; readonly view: IntroductionWorldView; readonly ctx: PartContext;
  readonly copy: IntroductionWorldCopy; readonly otherName: string;
}) {
  const { palette, language, writing } = ctx;
  const conversation = sharedConversationCopy(language);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const notice = noticeOf(view, copy, language);
  useEffect(() => {
    if (notice !== null) AccessibilityInfo.announceForAccessibility(notice);
  }, [notice]);
  return (
    <View testID="qandeel-introduction-thread" style={{ paddingTop: 8 }}>
      <View testID="qandeel-introduction-notice" accessibilityLiveRegion="polite" style={{ marginHorizontal: ROW_START }}>
        {notice === null ? null : (
          <Text style={{ ...typeStyle('supporting'), color: view.notice === 'DELETED' || view.notice === 'ALREADY_ENDED' ? palette.secondary : palette.error,
            paddingTop: 10, writingDirection: writing }}>{notice}</Text>
        )}
        {view.notice === 'LOAD_FAILED' ? <Action ctx={ctx} label={sharedCopy(language).retry} onPress={() => controller.reload()} testID="qandeel-introduction-reload" inline /> : null}
      </View>
      {view.hasOlder ? (
        // Older words are read one bounded page at a time, and only when the reader asks.
        <Control palette={palette} language={language} accessibilityLabel={conversation.olderMessages} accessibilityState={{ busy: view.loadingOlder, disabled: view.loadingOlder }}
          onPress={() => controller.loadOlder()} testID="qandeel-introduction-older"
          style={{ alignSelf: 'center', minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center', opacity: view.loadingOlder ? BUSY_OPACITY : 1 }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{conversation.olderMessages}</Text>
        </Control>
      ) : null}
      {view.messages.map((message) => {
        const material = asMaterial(message, otherName);
        if (!message.canDelete) return <SharedReadOnlyMaterial key={message.materialId} material={material} language={language} palette={palette} />;
        const open = selected === message.materialId;
        return (
          <SharedOwnMaterial key={message.materialId} material={material} language={language} palette={palette}
            open={open} confirming={confirming === message.materialId} busy={view.deleting === message.materialId}
            onToggle={() => { setSelected(open ? null : message.materialId); setConfirming(null); }}
            onAsk={() => setConfirming(message.materialId)}
            onKeep={() => { setConfirming(null); setSelected(null); }}
            onDelete={() => { void controller.deleteMessage(message.materialId).then(() => { setConfirming(null); setSelected(null); }); }} />
        );
      })}
      {view.pending === null ? null : <Pending ctx={ctx} copy={copy} pending={view.pending} onRetry={() => controller.retrySend()} />}
    </View>
  );
}

/** S8 / S15a / S15b: the reader's unsent words, and only what the server said of them. */
function Pending({ ctx, copy, pending, onRetry }: {
  readonly ctx: PartContext; readonly copy: IntroductionWorldCopy; readonly pending: IntroductionPending; readonly onRetry: () => void;
}) {
  const { palette, language, writing } = ctx;
  const conversation = sharedConversationCopy(language);
  const material: SharedMaterial = { materialId: 'pending', producer: 'SELF', authorName: null, text: pending.text, establishedAt: '', canDelete: false };
  const failed = pending.status === 'FAILED' || pending.status === 'OFFLINE';
  return (
    <View testID={`qandeel-introduction-pending-${pending.status.toLowerCase()}`} accessibilityLiveRegion="polite">
      <View style={{ opacity: BUSY_OPACITY }}>
        <SharedReadOnlyMaterial material={material} language={language} palette={palette} />
      </View>
      {pending.status === 'ENDED' ? (
        // IW-35 — only on the server's own ended answer for this member's own World.
        <Text testID="qandeel-introduction-send-ended" style={{ ...typeStyle('supporting'), color: palette.error, marginTop: 4, marginHorizontal: ROW_START - 8, writingDirection: writing }}>
          {copy.sendEnded}
        </Text>
      ) : null}
      {failed ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 4, marginHorizontal: ROW_START - 8, marginTop: 4 }}>
          <Text testID="qandeel-introduction-send-failed" style={{ ...typeStyle('supporting'), color: palette.error, writingDirection: writing }}>{conversation.sendRefused}</Text>
          <Control palette={palette} language={language} accessibilityLabel={conversation.retry} onPress={onRetry} testID="qandeel-introduction-send-retry"
            style={{ minHeight: MIN_TARGET, paddingHorizontal: 8, justifyContent: 'center' }}>
            <Text style={{ ...typeStyle('supporting'), color: palette.primary, writingDirection: writing }}>{conversation.retry}</Text>
          </Control>
        </View>
      ) : null}
      {pending.status === 'OFFLINE' ? (
        <Text testID="qandeel-introduction-offline" style={{ ...typeStyle('supporting'), color: palette.error, marginTop: 12, marginHorizontal: ROW_START - 8, writingDirection: writing }}>
          {proposalsCopy(language).offline}
        </Text>
      ) : null}
    </View>
  );
}

/** S10 / S11: one confirmation, no reason asked; the END is S6-02's. */
function EndConfirmation({ ctx, copy, view }: { readonly ctx: PartContext; readonly copy: IntroductionWorldCopy; readonly view: IntroductionWorldView }) {
  const { palette, language } = ctx;
  return (
    <View testID="qandeel-introduction-end-confirmation" style={{ paddingTop: 8 }}>
      <Para ctx={ctx} text={copy.endStops} />
      <Para ctx={ctx} text={copy.endNoReason} />
      <Para ctx={ctx} text={copy.endNoResume} />
      <View accessibilityLiveRegion="polite" testID="qandeel-introduction-end-status">
        {view.end === 'RUNNING' ? <Para ctx={ctx} text={copy.ending} role="supporting" color={palette.secondary} testID="qandeel-introduction-ending" /> : null}
        {view.end === 'FAILED' ? <Para ctx={ctx} text={sharedCopy(language).actionUnavailable} color={palette.error} testID="qandeel-introduction-end-failed" /> : null}
      </View>
    </View>
  );
}
