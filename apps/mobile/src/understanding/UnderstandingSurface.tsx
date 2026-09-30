/**
 * W3-MEGA-U (E2E-D-14) — «فهم قنديل» / QANDEEL Understanding, a depth of Personal QANDEEL (P1 §11).
 *
 * Not a route, a world, a Settings group, a Profile or a dashboard: the Personal world shows it over itself and keeps
 * everything beneath it exactly as it was, so Back returns to the same place, in the same Session.
 *
 *   - First view: the reader's current understanding, most recently changed first. Each item is its title (a theme),
 *     its current summary and its confidence IN WORDS. No percentage, score, rank or diagnostic label, and no empty
 *     category tab: when there is nothing, one honest sentence says so.
 *   - Detail: the same item, then only the explanation that exists — the reader's own supporting context («الأدلة»),
 *     contradictory context («التناقضات»), alternatives, unresolved points and how it evolved. An empty part is left
 *     out, never filled in. This is a user-facing explanation, not the model's reasoning.
 *   - "Talk to QANDEEL about this" returns the reader to their Conversation with that item as its bounded context.
 *     It is not an editor: nothing is written into the composer and nothing is sent.
 *
 * The frame is laid out logically (`direction`), so start and end are the reader's in Arabic and English alike, and
 * every colour is the canonical palette's in the reader's effective (non-Analysis) appearance.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, ScrollView, Text, View, findNodeHandle } from 'react-native';

import { AppearanceStatusBar } from '../appearance';
import { Control, Glyph, MIN_TARGET, typeStyle, useConversationTypeface, usePalette, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import type { UnderstandingDetailView, UnderstandingItemView } from '../runtime-entry';
import { understandingCopy, type UnderstandingCopy } from './copy';
import type { UnderstandingController } from './understanding-controller';

export const UNDERSTANDING_SURFACE_TEST_ID = 'qandeel-understanding';

export interface UnderstandingSurfaceProps {
  readonly controller: UnderstandingController;
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  /** Back to the Personal world, exactly as it was. */
  readonly onBack: () => void;
  /** "Talk to QANDEEL about this" was recorded: return to the Conversation. */
  readonly onTalk: () => void;
}

/** Craft values of the existing Personal page composition (Settings), not tokens. */
const HEADER_MIN_HEIGHT = 48;
const ROW_START = 24;
const ROW_END = 20;
const BUSY_OPACITY = 0.6;

function SectionHeading({ text, language, palette, writing }: {
  readonly text: string; readonly language: ChromeLanguage; readonly palette: ConversationPalette; readonly writing: 'rtl' | 'ltr';
}) {
  return (
    <Text
      accessibilityRole="header"
      accessibilityLanguage={language}
      style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingTop: 22, paddingBottom: 4, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: writing }}
    >
      {text}
    </Text>
  );
}

function Paragraph({ text, palette, writing, role = 'body', color }: {
  readonly text: string; readonly palette: ConversationPalette; readonly writing: 'rtl' | 'ltr';
  readonly role?: 'body' | 'supporting'; readonly color?: string;
}) {
  return (
    <Text style={{ ...typeStyle(role), color: color ?? palette.primary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 4, writingDirection: writing }}>
      {text}
    </Text>
  );
}

function ItemRow({ item, copy, language, palette, writing, onOpen }: {
  readonly item: UnderstandingItemView; readonly copy: UnderstandingCopy; readonly language: ChromeLanguage;
  readonly palette: ConversationPalette; readonly writing: 'rtl' | 'ltr'; readonly onOpen: (ref: string) => void;
}) {
  const title = copy.theme[item.theme];
  const confidence = copy.confidenceName(copy.confidence[item.confidence]);
  return (
    <Control
      palette={palette}
      language={language}
      // One stop for the screen reader, in reading order: title, summary, then the confidence named in words.
      accessibilityLabel={item.underReview ? `${title}, ${item.summary}, ${confidence}, ${copy.underReview}` : `${title}, ${item.summary}, ${confidence}`}
      onPress={() => onOpen(item.ref)}
      testID={`qandeel-understanding-item-${item.ref}`}
      style={{ minHeight: MIN_TARGET, paddingVertical: 12, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0 }}
    >
      <Text style={{ ...typeStyle('action'), color: palette.primary, writingDirection: writing }}>{title}</Text>
      <Text style={{ ...typeStyle('body'), color: palette.secondary, paddingTop: 2, writingDirection: writing }}>{item.summary}</Text>
      <Text testID={`qandeel-understanding-item-${item.ref}-confidence`} style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingTop: 4, writingDirection: writing }}>
        {confidence}
      </Text>
      {item.underReview ? (
        <Text testID={`qandeel-understanding-item-${item.ref}-under-review`} style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>
          {copy.underReview}
        </Text>
      ) : null}
    </Control>
  );
}

function Detail({ view, copy, language, palette, writing, talkState, onTalk }: {
  readonly view: UnderstandingDetailView; readonly copy: UnderstandingCopy; readonly language: ChromeLanguage;
  readonly palette: ConversationPalette; readonly writing: 'rtl' | 'ltr'; readonly talkState: 'IDLE' | 'OPENING' | 'FAILED';
  readonly onTalk: () => void;
}) {
  const sections: readonly (readonly [string, readonly string[], string])[] = [
    [copy.evidence, view.evidence, 'evidence'],
    [copy.contradictions, view.contradictions, 'contradictions'],
    [copy.alternatives, view.alternatives, 'alternatives'],
    [copy.unresolved, view.unresolved, 'unresolved'],
  ];
  const busy = talkState === 'OPENING';
  return (
    <View testID="qandeel-understanding-detail">
      <Paragraph text={view.summary} palette={palette} writing={writing} />
      <Text testID="qandeel-understanding-detail-confidence" style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 4, writingDirection: writing }}>
        {copy.confidenceName(copy.confidence[view.confidence])}
      </Text>
      {view.underReview ? (
        <Text testID="qandeel-understanding-detail-under-review" style={{ ...typeStyle('supporting'), color: palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 8, writingDirection: writing }}>
          {copy.underReviewNote}
        </Text>
      ) : null}
      {sections.map(([heading, texts, key]) => texts.length === 0 ? null : (
        <View key={key} testID={`qandeel-understanding-detail-${key}`}>
          <SectionHeading text={heading} language={language} palette={palette} writing={writing} />
          {texts.map((text, index) => <Paragraph key={`${key}-${index}`} text={text} palette={palette} writing={writing} role="supporting" color={palette.secondary} />)}
        </View>
      ))}
      {view.evolution.length === 0 ? null : (
        <View testID="qandeel-understanding-detail-evolution">
          <SectionHeading text={copy.evolution} language={language} palette={palette} writing={writing} />
          {view.evolution.map((entry, index) => (
            <Paragraph key={`evolution-${index}`} text={copy.evolutionKind[entry.kind]} palette={palette} writing={writing} role="supporting" color={palette.secondary} />
          ))}
        </View>
      )}
      <View style={{ paddingTop: 24 }}>
        {talkState === 'FAILED' ? (
          <Text accessibilityLiveRegion="polite" testID="qandeel-understanding-talk-failed" style={{ ...typeStyle('supporting'), color: palette.error, paddingStart: ROW_START, paddingEnd: ROW_END, paddingBottom: 4, writingDirection: writing }}>
            {copy.talkFailed}
          </Text>
        ) : null}
        <Control
          palette={palette}
          language={language}
          accessibilityLabel={copy.talk}
          accessibilityState={{ busy, disabled: busy }}
          onPress={onTalk}
          testID="qandeel-understanding-talk"
          style={{ minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0, opacity: busy ? BUSY_OPACITY : 1 }}
        >
          <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: writing }}>{copy.talk}</Text>
        </Control>
      </View>
    </View>
  );
}

export function UnderstandingSurface({ controller, language, insets, onBack, onTalk }: UnderstandingSurfaceProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const copy = understandingCopy(language);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const detail = state.detail;

  // Each time the surface is shown it opens on the first view, read afresh — never on an item explanation read
  // earlier, which a disagreement or a newer interpretation may since have changed.
  useEffect(() => {
    controller.closeItem();
    controller.refresh();
  }, [controller]);

  const closeItem = useCallback(() => {
    controller.closeItem();
    controller.refresh();
  }, [controller]);
  // Android system Back while an item is open leaves the item, and nothing else.
  const itemOpen = detail !== null;
  useEffect(() => {
    if (!itemOpen) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeItem();
      return true;
    });
    return () => subscription.remove();
  }, [itemOpen, closeItem]);
  // An item that is no longer one of the reader's current ones returns them to the current list, which no longer holds it.
  const gone = detail?.status === 'GONE';
  useEffect(() => {
    if (gone) closeItem();
  }, [gone, closeItem]);

  // The screen reader arrives on the heading once per view (the list, or an item).
  const titleRef = useRef<Text | null>(null);
  const titleKey = detail === null ? 'list' : detail.ref;
  useEffect(() => {
    if (!ready) return;
    const node = titleRef.current === null ? null : findNodeHandle(titleRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [ready, titleKey]);

  const talk = useCallback(() => {
    void controller.talk().then((result) => {
      if (result === 'OPENED') onTalk();
    });
  }, [controller, onTalk]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: palette.world }} testID={UNDERSTANDING_SURFACE_TEST_ID} />;

  const title = detail !== null && detail.view !== null ? copy.theme[detail.view.theme] : copy.name;

  let body: ReactNode = null;
  if (detail !== null) {
    if (detail.status === 'READY' && detail.view !== null) {
      body = <Detail view={detail.view} copy={copy} language={language} palette={palette} writing={writing} talkState={state.talk} onTalk={talk} />;
    } else if (detail.status === 'UNAVAILABLE') {
      body = <Unavailable copy={copy} language={language} palette={palette} writing={writing} onRetry={() => controller.openItem(detail.ref)} />;
    }
  } else if (state.list === 'UNAVAILABLE') {
    body = <Unavailable copy={copy} language={language} palette={palette} writing={writing} onRetry={controller.refresh} />;
  } else if (state.list === 'READY' && state.items.length === 0) {
    body = <View testID="qandeel-understanding-empty"><Paragraph text={copy.empty} palette={palette} writing={writing} color={palette.secondary} /></View>;
  } else if (state.items.length > 0) {
    body = state.items.map((item) => (
      <ItemRow key={item.ref} item={item} copy={copy} language={language} palette={palette} writing={writing} onOpen={controller.openItem} />
    ));
  }

  return (
    <View testID={UNDERSTANDING_SURFACE_TEST_ID} accessibilityLanguage={language} style={{ flex: 1, backgroundColor: palette.world, direction: writing }}>
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
          onPress={detail === null ? onBack : closeItem}
          testID="qandeel-understanding-back"
          style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center' }}
        >
          <Glyph name="back" color={palette.restInk} direction={writing} />
        </Control>
        <Text
          ref={titleRef}
          testID="qandeel-understanding-title"
          accessibilityRole="header"
          accessibilityLanguage={language}
          style={{ ...typeStyle('statement'), color: palette.primary, flexShrink: 1, paddingHorizontal: 2, writingDirection: writing }}
        >
          {title}
        </Text>
      </View>
      <ScrollView
        testID="qandeel-understanding-body"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16, paddingLeft: insets.left, paddingRight: insets.right }}
      >
        {body}
      </ScrollView>
    </View>
  );
}

function Unavailable({ copy, language, palette, writing, onRetry }: {
  readonly copy: UnderstandingCopy; readonly language: ChromeLanguage; readonly palette: ConversationPalette;
  readonly writing: 'rtl' | 'ltr'; readonly onRetry: () => void;
}) {
  return (
    <View testID="qandeel-understanding-unavailable" style={{ paddingTop: 16 }}>
      <Text accessibilityLiveRegion="polite" style={{ ...typeStyle('supporting'), color: palette.error, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: writing }}>
        {copy.unavailable}
      </Text>
      <Control palette={palette} language={language} accessibilityLabel={copy.tryAgain} onPress={onRetry} testID="qandeel-understanding-retry" style={{ marginTop: 8, marginStart: ROW_START - 12, paddingHorizontal: 12, alignSelf: 'flex-start' }}>
        <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.tryAgain}</Text>
      </Control>
    </View>
  );
}
