/**
 * W1A-01 — the production Conversation surface (E2E-B-03 write, E2E-B-04 read).
 *
 * It is QANDEEL's frozen visual language from the first frame, not a generic chat UI:
 *
 *   - the World (Dark, P1 default) is the ground. There are no bubbles and no avatars;
 *   - the reader's COMMITTED turn is the UTTERANCE role: a partial directional slab attached to the
 *     reader's own screen edge — RIGHT in Arabic, LEFT in English (G1.1 closure §1, §3);
 *   - QANDEEL speaks open on the World from the opposite edge, with no surface of its own;
 *   - the composer is the FIELD role: one lower line with its Send at the end edge, shown only while
 *     there are words to send;
 *   - every paragraph takes its OWN direction from its words, independently of its speaker's side;
 *   - the only upper chrome is the Conversation → Analysis depth control (B-07). No Activity,
 *     Replay, Understanding, Settings, Global Shell, Voice or Shared/Public entry is here;
 *   - W3-01 (P4-C1 S-B): beneath the upper chrome, Personal QANDEEL's own row carries the ONE General
 *     Settings entry — icon-only, 44 × 44, at the reader's END edge, drawn only when the Personal world
 *     supplies it. It is never in the upper chrome and never in the Analysis. The row is where the later
 *     QANDEEL Understanding entry (U-A) will also stand; nothing else is in it now.
 *
 * The surface lays itself out in an explicit left-to-right frame and places every element on a
 * PHYSICAL side computed from the reader's language. That is what makes the frozen side rule
 * independent of whatever global layout direction the platform happens to be in.
 *
 * Every word comes from `copy.ts`, exactly as approved. A state with no approved word says nothing.
 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore, type ReactElement } from 'react';
import {
  AccessibilityInfo,
  FlatList,
  KeyboardAvoidingView,
  Text,
  TextInput,
  View,
  findNodeHandle,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import type { ChromeLanguage } from '../orientation-chrome';
import type { ConversationExchangeView } from '../runtime-entry';
import { directedParagraphs, oppositeSide, readerDirection, readerSide, withDirectionMark, type PhysicalSide } from './bidi';
import type { ConversationController } from './conversation-controller';
import { MAX_SUBMISSION_LENGTH } from './conversation-controller';
import { conversationCopy, type ConversationCopy } from './copy';
import { Control, MIN_TARGET } from './visual/Control';
import { useConversationTypeface } from './visual/fonts';
import { Glyph } from './visual/Glyph';
import { typeStyle, usePalette, type ConversationPalette } from './visual/theme';

export const CONVERSATION_SURFACE_TEST_ID = 'qandeel-conversation';

export interface SurfaceInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface ConversationSurfaceProps {
  readonly controller: ConversationController;
  readonly language: ChromeLanguage;
  readonly insets: SurfaceInsets;
  /** Conversation → Analysis (B-07). The same Session and runtime generation continue. */
  readonly onOpenAnalysis: () => void;
  /** Move screen-reader focus to the depth control once, when arriving from Analysis. */
  readonly focusDepthControl?: boolean;
  /**
   * W1B-01: QANDEEL's opening line, supplied by the account owner. Presentation only — never a turn —
   * and drawn only while the authoritative history is READ and EMPTY, so it can never sit above a
   * committed turn. This layer writes none of its words.
   */
  readonly opening?: ReactElement | null;
  /**
   * W3-01 (E2E-D-01): open the one General Settings destination. Supplied only by the Personal QANDEEL
   * world; without it the Personal row is not drawn at all.
   */
  readonly onOpenSettings?: () => void;
  /** Move screen-reader focus to the Settings entry once, when returning from Settings. */
  readonly focusSettingsEntry?: boolean;
}

/** G1.1 / G3.2 proof geometry, in points. Craft values of the frozen composition, not tokens. */
const HEADER_MIN_HEIGHT = 48;
/** P4-C1 S-B proof geometry: the Personal row beneath the upper chrome, one 44 pt target high. */
const PERSONAL_ROW_HEIGHT = 44;
const THREAD_GUTTER = 24;
const SLAB_END_INSET = 40;
const REPLY_END_INSET = 48;
const COMPOSER_MAX_LINES = 5;
/** How close to the newest turn the reader must be for a new reply to follow them down. */
const FOLLOW_THRESHOLD = 96;
/** How close to the oldest held turn scrolling must come before an older page is asked for. */
const OLDER_THRESHOLD = 240;

const textAlignFor = (side: PhysicalSide) => side;
const alignSelfFor = (side: PhysicalSide) => (side === 'right' ? 'flex-end' : 'flex-start');

/** A turn's words, paragraph by paragraph, each in its own direction and aligned to its own start. */
function Paragraphs({ text, fallback, palette, role }: {
  readonly text: string;
  readonly fallback: 'rtl' | 'ltr';
  readonly palette: ConversationPalette;
  readonly role: 'body';
}) {
  const paragraphs = useMemo(() => directedParagraphs(text, fallback), [text, fallback]);
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <Text
          // A paragraph IS its position in the turn, so its index is its identity.
          key={index}
          style={{
            ...typeStyle(role),
            color: palette.primary,
            textAlign: textAlignFor(paragraph.direction === 'rtl' ? 'right' : 'left'),
            writingDirection: paragraph.direction,
          }}
        >
          {withDirectionMark(paragraph)}
        </Text>
      ))}
    </>
  );
}

/** A status line on QANDEEL's side: the waiting line or the reply failure. */
function StatusLine({ text, tone, side, palette, testID, language }: {
  readonly text: string;
  readonly tone: 'waiting' | 'failure';
  readonly side: PhysicalSide;
  readonly palette: ConversationPalette;
  readonly testID: string;
  readonly language: ChromeLanguage;
}) {
  return (
    <Text
      testID={testID}
      accessibilityLiveRegion="polite"
      accessibilityLanguage={language}
      style={{
        ...typeStyle(tone === 'waiting' ? 'metadata' : 'supporting'),
        color: tone === 'waiting' ? palette.secondary : palette.error,
        alignSelf: alignSelfFor(side),
        textAlign: textAlignFor(side),
        writingDirection: language === 'ar' ? 'rtl' : 'ltr',
        marginTop: 12,
      }}
    >
      {text}
    </Text>
  );
}

function ExchangeRow({ exchange, copy, palette, language, contentWidth }: {
  readonly exchange: ConversationExchangeView;
  readonly copy: ConversationCopy;
  readonly palette: ConversationPalette;
  readonly language: ChromeLanguage;
  readonly contentWidth: number;
}) {
  const mine = readerSide(language);
  const theirs = oppositeSide(mine);
  const fallback = readerDirection(language);
  return (
    <View>
      {/* UTTERANCE — the reader's committed words, on the reader's own edge. */}
      <View
        testID={`qandeel-utterance-${exchange.userTurn.id}`}
        accessible
        accessibilityLabel={copy.userTurnName(exchange.userTurn.content)}
        style={{
          alignSelf: alignSelfFor(mine),
          marginTop: 28,
          maxWidth: Math.max(0, contentWidth - SLAB_END_INSET),
          backgroundColor: palette.utterance,
          paddingTop: 11,
          paddingBottom: 12,
          // The slab bleeds to the reader's screen edge; its rounded corners face the conversation.
          ...(mine === 'right'
            ? { marginRight: -THREAD_GUTTER, paddingRight: THREAD_GUTTER, paddingLeft: 18, borderTopLeftRadius: 18, borderBottomLeftRadius: 18 }
            : { marginLeft: -THREAD_GUTTER, paddingLeft: THREAD_GUTTER, paddingRight: 18, borderTopRightRadius: 18, borderBottomRightRadius: 18 }),
        }}
      >
        <Paragraphs text={exchange.userTurn.content} fallback={fallback} palette={palette} role="body" />
      </View>

      {exchange.reply !== null ? (
        // QANDEEL — open on the World, from the opposite edge. No surface of its own.
        <View
          testID={`qandeel-reply-${exchange.reply.id}`}
          accessible
          accessibilityLabel={copy.replyTurnName(exchange.reply.content)}
          style={{ alignSelf: alignSelfFor(theirs), marginTop: 16, maxWidth: Math.max(0, contentWidth - REPLY_END_INSET) }}
        >
          <Paragraphs text={exchange.reply.content} fallback={fallback} palette={palette} role="body" />
        </View>
      ) : exchange.replyState === 'FAILED' ? (
        <StatusLine text={copy.replyFailed} tone="failure" side={theirs} palette={palette} language={language} testID={`qandeel-reply-failed-${exchange.userTurn.id}`} />
      ) : (
        <StatusLine text={copy.waitingForReply} tone="waiting" side={theirs} palette={palette} language={language} testID={`qandeel-reply-pending-${exchange.userTurn.id}`} />
      )}
    </View>
  );
}

export function ConversationSurface({
  controller,
  language,
  insets,
  onOpenAnalysis,
  focusDepthControl = false,
  opening,
  onOpenSettings,
  focusSettingsEntry = false,
}: ConversationSurfaceProps) {
  const ready = useConversationTypeface();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const palette = usePalette();
  const reduceMotion = useReducedMotion();
  const copy = conversationCopy(language);
  const { width } = useWindowDimensions();
  const mine = readerSide(language);
  const theirs = oppositeSide(mine);
  const endSide = theirs; // the end edge of the reader's line is the edge opposite their start
  const fallback = readerDirection(language);
  const contentWidth = Math.max(0, width - insets.left - insets.right - THREAD_GUTTER * 2);

  useEffect(() => {
    controller.ensureHistory();
  }, [controller]);

  // ---------------------------------------------------------------- assistive announcements
  // One announcement per state CHANGE, in the approved words only. The status lines also carry a
  // polite live region for Android; iOS has none, so the announcement is what reaches VoiceOver.
  const announced = useRef<{ submission: string | null; refused: boolean; failed: Set<string>; replies: Set<string>; history: string | null } | null>(null);
  useEffect(() => {
    const seen = announced.current;
    const phase = state.submission === null ? null : `${state.submission.key}:${state.submission.phase}`;
    const failed = new Set(state.exchanges.filter((e) => e.replyState === 'FAILED').map((e) => e.userTurn.id));
    const replies = new Set(state.exchanges.filter((e) => e.reply !== null).map((e) => e.reply!.id));
    if (seen === null) {
      // The first read is the conversation-so-far, not news: nothing is announced for it.
      announced.current = { submission: phase, refused: state.refused, failed, replies, history: state.history };
      return;
    }
    if (phase !== seen.submission && state.submission !== null) {
      AccessibilityInfo.announceForAccessibility(state.submission.phase === 'AWAITING' ? copy.waitingForReply : copy.sendUnconfirmed);
    }
    if (state.refused && !seen.refused) AccessibilityInfo.announceForAccessibility(copy.sendRefused);
    for (const exchange of state.exchanges) {
      if (exchange.reply !== null && !seen.replies.has(exchange.reply.id) && seen.history === 'READY') {
        AccessibilityInfo.announceForAccessibility(copy.replyTurnName(exchange.reply.content));
      }
      if (exchange.replyState === 'FAILED' && !seen.failed.has(exchange.userTurn.id) && seen.history === 'READY') {
        AccessibilityInfo.announceForAccessibility(copy.replyFailed);
      }
    }
    if (state.history === 'UNAVAILABLE' && seen.history !== 'UNAVAILABLE') {
      AccessibilityInfo.announceForAccessibility(copy.historyUnavailable);
    }
    announced.current = { submission: phase, refused: state.refused, failed, replies, history: state.history };
  }, [state, copy]);

  // -------------------------------------------------------------------------------- scrolling
  // Open at the newest turn; follow a new reply down only when the reader is already near it; never
  // pull a reader away from older turns they are reading. Older pages load as the top approaches.
  const list = useRef<FlatList<ConversationExchangeView>>(null);
  const nearNewest = useRef(true);
  const positioned = useRef(false);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      nearNewest.current = contentSize.height - (contentOffset.y + layoutMeasurement.height) < FOLLOW_THRESHOLD;
      if (contentOffset.y < OLDER_THRESHOLD) controller.loadOlder();
    },
    [controller],
  );
  const onContentSizeChange = useCallback(() => {
    if (!positioned.current) {
      if (state.history !== 'LOADING') {
        positioned.current = true;
        list.current?.scrollToEnd({ animated: false });
      }
      return;
    }
    if (nearNewest.current) list.current?.scrollToEnd({ animated: !reduceMotion });
  }, [reduceMotion, state.history]);

  // ------------------------------------------------------------------------- depth control
  const doorRef = useRef<View | null>(null);
  useEffect(() => {
    if (!focusDepthControl || !ready) return;
    const node = doorRef.current === null ? null : findNodeHandle(doorRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [focusDepthControl, ready]);

  // W3-01: returning from Settings puts the reader back on the entry they left from.
  const settingsRef = useRef<View | null>(null);
  useEffect(() => {
    if (!focusSettingsEntry || !ready) return;
    const node = settingsRef.current === null ? null : findNodeHandle(settingsRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [focusSettingsEntry, ready]);

  if (!ready) {
    // The faces are bundled and register in a moment; until then the World shows and nothing else.
    return <View style={{ flex: 1, backgroundColor: palette.world }} testID={CONVERSATION_SURFACE_TEST_ID} />;
  }

  const submission = state.submission;
  const locked = submission !== null;
  const canSend = !locked && state.draft.trim().length > 0;
  const composerDirection = state.draft.length === 0 ? fallback : directedParagraphs(state.draft, fallback)[0].direction;

  const footer =
    submission !== null && submission.phase === 'AWAITING' ? (
      <StatusLine text={copy.waitingForReply} tone="waiting" side={theirs} palette={palette} language={language} testID="qandeel-conversation-awaiting" />
    ) : null;

  const historyFailure =
    state.history === 'UNAVAILABLE' ? (
      <View testID="qandeel-conversation-history-unavailable" style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Text
          accessibilityLiveRegion="polite"
          accessibilityLanguage={language}
          style={{ ...typeStyle('supporting'), color: palette.error, textAlign: 'center', writingDirection: fallback }}
        >
          {copy.historyUnavailable}
        </Text>
        <Control palette={palette} language={language} accessibilityLabel={copy.tryAgain} onPress={controller.retryHistory} testID="qandeel-conversation-history-retry" style={{ marginTop: 8, paddingHorizontal: 12 }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.tryAgain}</Text>
        </Control>
      </View>
    ) : null;

  return (
    <KeyboardAvoidingView
      testID={CONVERSATION_SURFACE_TEST_ID}
      // The composer must stay above the keyboard on both platforms. iOS overlays the keyboard, and
      // Android 15+ enforces edge-to-edge, where the window no longer resizes for it either — measured
      // on the API 36 proof emulator, the composer and its Send stayed under the keyboard without
      // this. `padding` is computed from the real overlap between this view and the keyboard, so on
      // a platform that still resizes the window the overlap is zero and nothing is added twice.
      behavior="padding"
      // An explicit LEFT-TO-RIGHT frame: every side below is physical, computed from the language.
      style={{ flex: 1, backgroundColor: palette.world, direction: 'ltr' }}
    >
      {/* The upper chrome: exactly one control, Conversation → Analysis, at the reader's END edge. */}
      <View
        style={{
          paddingTop: insets.top,
          paddingLeft: insets.left + 10,
          paddingRight: insets.right + 10,
          minHeight: insets.top + HEADER_MIN_HEIGHT,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: endSide === 'right' ? 'flex-end' : 'flex-start',
        }}
      >
        <Control
          palette={palette}
          language={language}
          accessibilityLabel={copy.doorName}
          onPress={onOpenAnalysis}
          testID="qandeel-depth-to-analysis"
          controlRef={(node) => {
            doorRef.current = node;
          }}
          style={{ paddingHorizontal: 12 }}
        >
          <View style={{ flexDirection: fallback === 'rtl' ? 'row-reverse' : 'row', alignItems: 'center' }}>
            <Glyph name="depth" color={palette.restInk} direction={fallback} />
            <Text style={{ ...typeStyle('action'), color: palette.restInk, ...(fallback === 'rtl' ? { marginRight: 6 } : { marginLeft: 6 }) }}>
              {copy.doorLabel}
            </Text>
          </View>
        </Control>
      </View>

      {/*
        W3-01 — Personal QANDEEL's own row (P4-C1 S-B), directly beneath the upper chrome and on the World:
        no card and no surface of its own. The General Settings entry stands at the reader's END edge,
        icon-only in the rest ink, and carries its approved name.
      */}
      {onOpenSettings === undefined ? null : (
        <View
          testID="qandeel-personal-row"
          style={{
            paddingLeft: insets.left + 10,
            paddingRight: insets.right + 10,
            height: PERSONAL_ROW_HEIGHT,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: endSide === 'right' ? 'flex-end' : 'flex-start',
          }}
        >
          <Control
            palette={palette}
            language={language}
            accessibilityLabel={copy.settingsName}
            onPress={onOpenSettings}
            testID="qandeel-settings-entry"
            controlRef={(node) => {
              settingsRef.current = node;
            }}
            style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center' }}
          >
            <Glyph name="settings" color={palette.restInk} direction={fallback} />
          </Control>
        </View>
      )}

      <FlatList
        ref={list}
        testID="qandeel-conversation-thread"
        data={state.exchanges}
        keyExtractor={(exchange) => exchange.userTurn.id}
        renderItem={({ item }) => <ExchangeRow exchange={item} copy={copy} palette={palette} language={language} contentWidth={contentWidth} />}
        ListHeaderComponent={state.exchanges.length > 0 ? historyFailure : null}
        // An empty list is either a history that could not be read, or — once READ — a genuinely empty
        // Conversation, which is where the W1B-01 opening belongs.
        ListEmptyComponent={state.history === 'READY' ? (opening ?? null) : historyFailure}
        ListFooterComponent={footer}
        onScroll={onScroll}
        scrollEventThrottle={64}
        onContentSizeChange={onContentSizeChange}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'flex-end',
          paddingTop: 14,
          paddingBottom: 26,
          paddingLeft: insets.left + THREAD_GUTTER,
          paddingRight: insets.right + THREAD_GUTTER,
        }}
      />

      {submission !== null && submission.phase === 'UNCONFIRMED' ? (
        <View
          testID="qandeel-conversation-unconfirmed"
          style={{
            paddingLeft: insets.left + 20,
            paddingRight: insets.right + 20,
            paddingBottom: 4,
            alignItems: mine === 'right' ? 'flex-end' : 'flex-start',
          }}
        >
          <Text
            accessibilityLiveRegion="polite"
            accessibilityLanguage={language}
            style={{ ...typeStyle('supporting'), color: palette.error, textAlign: textAlignFor(mine), writingDirection: fallback }}
          >
            {copy.sendUnconfirmed}
          </Text>
          <Control palette={palette} language={language} accessibilityLabel={copy.tryAgain} onPress={controller.retrySubmission} testID="qandeel-conversation-send-retry" style={{ paddingHorizontal: 12 }}>
            <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.tryAgain}</Text>
          </Control>
        </View>
      ) : null}

      {/* A definitive refusal: the words are back in the composer, editable. No retry is offered. */}
      {submission === null && state.refused ? (
        <View
          testID="qandeel-conversation-refused"
          style={{
            paddingLeft: insets.left + 20,
            paddingRight: insets.right + 20,
            paddingBottom: 4,
            alignItems: mine === 'right' ? 'flex-end' : 'flex-start',
          }}
        >
          <Text
            accessibilityLiveRegion="polite"
            accessibilityLanguage={language}
            style={{ ...typeStyle('supporting'), color: palette.error, textAlign: textAlignFor(mine), writingDirection: fallback }}
          >
            {copy.sendRefused}
          </Text>
        </View>
      ) : null}

      {/* FIELD — the composer. One lower line; Send at the END edge, present only with words to send. */}
      <View
        testID="qandeel-conversation-composer"
        style={{
          backgroundColor: palette.field,
          paddingTop: 10,
          paddingBottom: insets.bottom + 10,
          paddingLeft: insets.left + 20,
          paddingRight: insets.right + 14,
          flexDirection: endSide === 'right' ? 'row' : 'row-reverse',
          alignItems: 'flex-end',
        }}
      >
        <View style={{ flex: 1, minHeight: MIN_TARGET, justifyContent: 'center', marginHorizontal: 6 }}>
          <TextInput
            testID="qandeel-conversation-input"
            accessibilityLabel={copy.composerName}
            accessibilityLanguage={language}
            placeholder={copy.composerPlaceholder}
            placeholderTextColor={palette.tertiary}
            value={state.draft}
            onChangeText={controller.setDraft}
            editable={!locked}
            multiline
            maxLength={MAX_SUBMISSION_LENGTH}
            // Enter makes a new line; the Send control is the only way to send (§3.1).
            submitBehavior="newline"
            selectionColor={palette.primary}
            cursorColor={palette.primary}
            style={{
              ...typeStyle('body'),
              color: palette.primary,
              maxHeight: typeStyle('body').lineHeight * COMPOSER_MAX_LINES,
              paddingTop: 7,
              paddingBottom: 7,
              paddingHorizontal: 0,
              textAlign: composerDirection === 'rtl' ? 'right' : 'left',
              writingDirection: composerDirection,
            }}
          />
          <View style={{ height: 1, backgroundColor: palette.tertiary }} />
        </View>
        {canSend ? (
          <Control palette={palette} language={language} accessibilityLabel={copy.sendName} onPress={controller.send} testID="qandeel-conversation-send" style={{ width: MIN_TARGET, alignItems: 'center' }}>
            <Glyph name="send" color={palette.primary} direction={fallback} />
          </Control>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}
