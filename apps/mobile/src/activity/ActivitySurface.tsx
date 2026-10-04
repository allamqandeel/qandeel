/**
 * A3-01 — «النشاط» / Activity, the one global destination (P3 §3–§4, §6, §16; I-08N-01 D28–D31, D38–D40, D47).
 *
 *   - One full page over the Product shell, without World navigation: Activity is not a World. Back returns the reader
 *     to exactly where they were. It is non-Analysis: it follows the reader's Dark / Light / System appearance.
 *   - One quiet chronological feed, «الكل» / All by default, grouped by day; the five lightweight filters are a
 *     presentation of the semantic categories over the same feed (toggle buttons with a selected state — not tabs, not
 *     destinations). Shared shows a count of rows needing attention, System a count of actionable rows; From QANDEEL
 *     and Public show presence; Introductions presence ONLY.
 *   - Rows, not cards: the source / context identity, the time, one primary sentence, optional secondary context. The
 *     whole row is the Direct Entry when it has one — revalidated when pressed; a stale row says so in words and offers
 *     only a safe act into its own context; a row whose destination has no surface yet fails closed and says so.
 *   - Attention is never colour alone: NEW carries the solid mark, a seen-but-waiting row the hollow ring, an opened row
 *     quietens to the secondary ink, a stale row the tertiary ink and words, a muted World «مكتوم». Each state is also in
 *     the row's accessible name. Rows the reader actually looks at become SEEN; opening Activity clears nothing.
 *
 * The source glyph column draws only the P3 members A3-01 ports (Open Link for Introductions) and the existing
 * `settings` utility glyph for System; P2's World navigation glyphs are not ported ahead of their owner (record §16).
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, FlatList, ScrollView, Text, View, findNodeHandle, type ViewToken } from 'react-native';

import { AppearanceStatusBar } from '../appearance';
import { Control, Glyph, MIN_TARGET, conversationCopy, typeStyle, useConversationTypeface, usePalette, type ConversationPalette } from '../conversation';
import { P3Glyph } from '../iconography';
import type { ChromeLanguage } from '../orientation-chrome';
import type { ActivityCategory, ActivityItem, DirectEntryDestination } from '../runtime-entry';
import { ACTIVITY_CATEGORIES } from './vocabulary';
import { AttentionMark } from './ActivityEntry';
import { pick, sourceOf } from './AttentionStrip';
import type { ActivityAttentionController } from './attention-controller';
import { activityCopy, fill, type ActivityCopy } from './copy';
import type { ActivityFeedController } from './feed-controller';
import { dayGroupOf, rowTime, type DayGroup } from './time';

export const ACTIVITY_SURFACE_TEST_ID = 'qandeel-activity';
const HEADER_MIN_HEIGHT = 48;
const ROW_START = 20;
const ROW_END = 20;
const GLYPH_COLUMN = 28;
const WAITING_RING = 1.5;
/** P3-A reference craft (not Product law): a row is SEEN when at least half of it was on screen for 1.2 s. */
const SEEN_VIEWABILITY = { itemVisiblePercentThreshold: 50, minimumViewTime: 1200 };

export interface ActivitySurfaceProps {
  readonly feed: ActivityFeedController;
  readonly attention: ActivityAttentionController;
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  readonly onBack: () => void;
  /** Notifications & Activity, from Activity's own settings act. */
  readonly onOpenSettings: () => void;
  /** A revalidated Direct Entry (or a stale row's safe act into its own context). The composition executes it. */
  readonly onEnter: (destination: DirectEntryDestination) => void;
}

type Row = { readonly kind: 'DAY'; readonly key: string; readonly group: DayGroup } | { readonly kind: 'ITEM'; readonly key: string; readonly item: ActivityItem };

/** What a pressed row came to, shown beneath it until the reader moves on. */
type RowNotice = { readonly itemId: string; readonly kind: 'STALE' | 'UNAVAILABLE'; readonly fallback: DirectEntryDestination | null };

const fallbackName = (destination: DirectEntryDestination, language: ChromeLanguage, copy: ActivityCopy): string =>
  destination.kind === 'GENERAL_SETTINGS' ? conversationCopy(language).settingsName
    : destination.kind === 'QANDEEL_UNDERSTANDING' ? copy.sources.QANDEEL : copy.sources.QANDEEL;

function RowMark({ item, palette, testID }: { readonly item: ActivityItem; readonly palette: ConversationPalette; readonly testID: string }) {
  if (item.mark && item.attention === 'NEW') return <AttentionMark present ground={palette.world} testID={`${testID}-new`} />;
  if (item.waiting) {
    // WAITING: the hollow ring — a different SHAPE from NEW, never only a different colour.
    return <View testID={`${testID}-waiting`} style={{ width: 10, height: 10, borderRadius: 5, borderWidth: WAITING_RING, borderColor: palette.primary }} />;
  }
  return <View style={{ width: 10, height: 10 }} />;
}

function FilterButton({ label, selected, indicator, onPress, language, palette, testID }: {
  readonly label: string; readonly selected: boolean; readonly indicator: { readonly present: boolean; readonly count: number | null } | null;
  readonly onPress: () => void; readonly language: ChromeLanguage; readonly palette: ConversationPalette; readonly testID: string;
}) {
  const said = indicator?.count != null ? `${label} ${indicator.count}` : label;
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityRole="togglebutton"
      accessibilityLabel={indicator?.present ? `${said}${language === 'ar' ? '، ' : ', '}${activityCopy(language).newState}` : said}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      testID={testID}
      style={{ minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center' }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 4 }}>
        <Text style={{ ...typeStyle('action'), color: selected ? palette.selectedInk : palette.restInk, fontWeight: selected ? '600' : undefined }}>{label}</Text>
        {indicator?.count != null ? <Text style={{ ...typeStyle('metadata'), color: palette.secondary }}>{String(indicator.count)}</Text> : null}
        {indicator?.present && indicator.count == null ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.primary }} /> : null}
      </View>
      {/* E1R SELECTED: weight and a 2-pt marker under the word — a shape, not only a colour. */}
      <View style={{ height: palette.markerThickness, marginTop: 2, backgroundColor: selected ? palette.selectedMarker : 'transparent' }} />
    </Control>
  );
}

export function ActivitySurface({ feed, attention, language, insets, onBack, onOpenSettings, onEnter }: ActivitySurfaceProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const copy = activityCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const state = useSyncExternalStore(feed.subscribe, feed.getState);
  const { categories } = useSyncExternalStore(attention.subscribe, attention.getState);
  const [notice, setNotice] = useState<RowNotice | null>(null);
  const opening = useRef(false);

  useEffect(() => {
    feed.show(null);
  }, [feed]);

  // The screen reader arrives on the destination's name, once.
  const titleRef = useRef<Text | null>(null);
  useEffect(() => {
    if (!ready) return;
    const node = titleRef.current === null ? null : findNodeHandle(titleRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [ready]);

  // The page's clock, read once when it opens (day groups and row times are relative to it).
  const [now] = useState(() => Date.now());
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    let last: DayGroup | null = null;
    for (const item of state.items) {
      const group = dayGroupOf(item.at, now);
      if (group !== last) out.push({ kind: 'DAY', key: `day-${group}`, group });
      last = group;
      out.push({ kind: 'ITEM', key: item.id, item });
    }
    return out;
  }, [now, state.items]);

  // Rows the reader actually looks at become SEEN (P3-A reference craft: half on screen for 1.2 s).
  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken<Row>[] }) => {
    const ids = viewableItems.flatMap((token) => (token.item?.kind === 'ITEM' && token.item.item.attention === 'NEW' ? [token.item.item.id] : []));
    if (ids.length > 0) feed.seen(ids);
  }, [feed]);

  const press = useCallback(async (item: ActivityItem) => {
    if (opening.current || item.entry === 'NONE') return;
    opening.current = true;
    setNotice(null);
    const outcome = await feed.open(item.id);
    opening.current = false;
    if (outcome.kind === 'ENTER') {
      onEnter(outcome.destination);
      return;
    }
    if (outcome.kind === 'STALE' || outcome.kind === 'UNAVAILABLE') {
      setNotice({ itemId: item.id, kind: outcome.kind, fallback: outcome.fallback });
      AccessibilityInfo.announceForAccessibility(outcome.kind === 'STALE' ? copy.staleExplain : copy.gate.entryUnavailable);
    }
  }, [copy, feed, onEnter]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: palette.world }} testID={ACTIVITY_SURFACE_TEST_ID} />;

  const filters: (ActivityCategory | null)[] = [null, ...ACTIVITY_CATEGORIES];
  const indicatorOf = (category: ActivityCategory | null) => {
    if (category === null || categories === null) return null;
    const value = categories[category] as { readonly present: boolean; readonly count?: number | null };
    return { present: value.present, count: value.count ?? null };
  };

  const renderRow = ({ item: row }: { item: Row }) => {
    if (row.kind === 'DAY') {
      const said = row.group === 'TODAY' ? copy.today : row.group === 'YESTERDAY' ? copy.yesterday : copy.earlier;
      return (
        <Text accessibilityRole="header" style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingTop: 18, paddingBottom: 4, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: writing }}>
          {said}
        </Text>
      );
    }
    const { item } = row;
    const source = sourceOf(item, language);
    const time = rowTime(item.at, language, now);
    const sentence = pick(item.body, language);
    const secondary = item.secondary === null ? null : pick(item.secondary, language);
    const stateWord = item.stale ? copy.stale : item.muted ? copy.muted : null;
    const attentionWord = item.mark && item.attention === 'NEW' ? copy.markNew : item.waiting ? copy.markWaiting : null;
    const sep = language === 'ar' ? '، ' : ', ';
    const name = [source, time, sentence, secondary, stateWord, attentionWord].filter((part) => part !== null && part !== '').join(sep);
    const ink = item.stale ? palette.tertiary : item.attention === 'OPENED' ? palette.secondary : palette.primary;
    const glyph = item.category === 'INTRODUCTIONS' ? <P3Glyph name="link" color={palette.secondary} />
      : item.category === 'SYSTEM' ? <Glyph name="settings" color={palette.secondary} direction={writing} /> : null;
    const rowNotice = notice?.itemId === item.id ? notice : null;
    return (
      <View>
        <Control
          palette={palette}
          language={language}
          accessibilityLabel={name}
          accessibilityState={{ disabled: item.entry === 'NONE' }}
          onPress={() => void press(item)}
          testID={`qandeel-activity-row-${item.id}`}
          style={{ borderRadius: 0, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', columnGap: 12 }}>
            <View style={{ width: GLYPH_COLUMN, alignItems: 'center', paddingTop: 2 }}>{glyph}</View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ ...typeStyle('metadata'), color: palette.secondary, writingDirection: writing }}>
                {[source, time, stateWord].filter(Boolean).join(' · ')}
              </Text>
              <Text style={{ ...typeStyle('body'), color: ink, writingDirection: writing }}>{sentence}</Text>
              {secondary === null ? null : <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{secondary}</Text>}
            </View>
            <View style={{ paddingTop: 6 }}>
              <RowMark item={item} palette={palette} testID={`qandeel-activity-row-${item.id}-mark`} />
            </View>
          </View>
        </Control>
        {rowNotice === null ? null : (
          <View testID={`qandeel-activity-row-${item.id}-notice`} accessibilityLiveRegion="polite" style={{ paddingStart: ROW_START + GLYPH_COLUMN + 12, paddingEnd: ROW_END, paddingBottom: 10 }}>
            <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>
              {rowNotice.kind === 'STALE' ? copy.staleExplain : copy.gate.entryUnavailable}
            </Text>
            {rowNotice.fallback === null ? null : (
              <Control
                palette={palette}
                language={language}
                accessibilityLabel={fill(copy.staleOpen, fallbackName(rowNotice.fallback, language, copy))}
                onPress={() => rowNotice.fallback !== null && onEnter(rowNotice.fallback)}
                testID={`qandeel-activity-row-${item.id}-fallback`}
                style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, justifyContent: 'center' }}
              >
                <Text style={{ ...typeStyle('action'), color: palette.primary }}>{fill(copy.staleOpen, fallbackName(rowNotice.fallback, language, copy))}</Text>
              </Control>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View testID={ACTIVITY_SURFACE_TEST_ID} accessibilityLanguage={language} style={{ flex: 1, backgroundColor: palette.world, direction: writing }}>
      <AppearanceStatusBar />
      <View style={{
        paddingTop: insets.top, paddingStart: (writing === 'rtl' ? insets.right : insets.left) + 10, paddingEnd: (writing === 'rtl' ? insets.left : insets.right) + 10,
        minHeight: insets.top + HEADER_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center', columnGap: 2,
      }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.back} onPress={onBack} testID="qandeel-activity-back" style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center' }}>
          <Glyph name="back" color={palette.restInk} direction={writing} />
        </Control>
        <Text ref={titleRef} testID="qandeel-activity-title" accessibilityRole="header" accessibilityLanguage={language}
          style={{ ...typeStyle('statement'), color: palette.primary, flex: 1, paddingHorizontal: 2, writingDirection: writing }}>
          {copy.title}
        </Text>
        <Control palette={palette} language={language} accessibilityLabel={copy.settingsName} onPress={onOpenSettings} testID="qandeel-activity-settings" style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center' }}>
          <Glyph name="settings" color={palette.restInk} direction={writing} />
        </Control>
      </View>

      <View accessibilityLabel={copy.filterGroup} accessibilityLanguage={language} testID="qandeel-activity-filters">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingStart: (writing === 'rtl' ? insets.right : insets.left) + 10, paddingEnd: 10 }}>
          {filters.map((category) => (
            <FilterButton
              key={category ?? 'ALL'}
              label={category === null ? copy.all : copy.filters[category]}
              selected={state.filter === category}
              indicator={indicatorOf(category)}
              onPress={() => feed.show(category)}
              language={language}
              palette={palette}
              testID={`qandeel-activity-filter-${(category ?? 'ALL').toLowerCase()}`}
            />
          ))}
        </ScrollView>
      </View>

      {state.status === 'UNAVAILABLE' ? (
        <View testID="qandeel-activity-unavailable" accessibilityLiveRegion="polite" style={{ padding: ROW_START, rowGap: 8 }}>
          <Text style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>{copy.gate.unavailable}</Text>
          <Control palette={palette} language={language} accessibilityLabel={copy.tryAgain} onPress={() => feed.retry()} testID="qandeel-activity-retry" style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, justifyContent: 'center' }}>
            <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.tryAgain}</Text>
          </Control>
        </View>
      ) : state.status === 'LOADING' && state.items.length === 0 ? (
        <View testID="qandeel-activity-loading" accessibilityLiveRegion="polite" accessibilityState={{ busy: true }} style={{ padding: ROW_START }}>
          <Text style={{ ...typeStyle('supporting'), color: palette.tertiary, writingDirection: writing }}>{copy.gate.loading}</Text>
        </View>
      ) : state.status === 'READY' && state.items.length === 0 ? (
        <View testID="qandeel-activity-empty" style={{ padding: ROW_START }}>
          <Text style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>{copy.empty}</Text>
        </View>
      ) : (
        <FlatList
          testID="qandeel-activity-feed"
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={renderRow}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={SEEN_VIEWABILITY}
          onEndReached={() => feed.loadOlder()}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16, paddingLeft: insets.left, paddingRight: insets.right }}
        />
      )}
    </View>
  );
}
