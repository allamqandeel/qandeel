/**
 * S8A-05 CP2 — one page of a topic's items, exactly as a reader reads it (and so as its author previews it): each whole
 * message with its speaker — the author by their public name (WP1-R1 §5.3 5; «صاحب الموضوع» when the topic shows none),
 * «قنديل», or «فهم قنديل — استنتاج غير مؤكد، ليس حقيقة» — its emphasis, a «…» where messages were left out, and the page
 * it is on. Nothing is dropped: every item is reached page by page.
 *
 * It lays itself out in the flow of the screen that holds it (no fixed height, no absolute position), so it can stand in
 * the field's panel as it is. Every word is `./source-copy`'s.
 */
import { Text, View } from 'react-native';

import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { publicSourceCopy } from './source-copy';

export type PublicTopicItemSpeaker = 'WRITTEN' | 'YOUR_MESSAGE' | 'QANDEEL_REPLY' | 'QANDEEL_UNDERSTANDING';

/** One item, already decoded: what it says, who said it, and how it stands. */
export interface PublicTopicItemEntry {
  readonly key: string;
  readonly role: PublicTopicItemSpeaker;
  readonly message: number | null;
  readonly text: string;
  readonly emphasized: boolean;
  readonly gapBefore: boolean;
  /** Set only on the author's own item that begins a whole message, while the draft can still change. */
  readonly onToggleEmphasis?: () => void;
}

export interface PublicTopicItemsProps {
  readonly entries: readonly PublicTopicItemEntry[];
  readonly page: number;
  readonly pageCount: number;
  readonly onPage: ((page: number) => void) | null;
  /** The author's public name as the topic shows it; null when it shows none. */
  readonly authorName: string | null;
  readonly palette: ConversationPalette;
  readonly language: ChromeLanguage;
  readonly busy?: boolean;
  readonly testID?: string;
  /** The start padding of the screen that holds the list, so its lines align with the rest. */
  readonly inset?: number;
}

const EMPHASIS_BAR = 3;

export function PublicTopicItems({ entries, page, pageCount, onPage, authorName, palette, language, busy = false, testID = 'qandeel-public-topic-items', inset = 24 }: PublicTopicItemsProps) {
  const copy = publicSourceCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const speaker = (role: PublicTopicItemSpeaker) => (role === 'QANDEEL_REPLY' ? copy.speakerQandeel : role === 'QANDEEL_UNDERSTANDING' ? copy.understandingLabel
    : role === 'WRITTEN' ? copy.writtenLabel : authorName ?? copy.speakerAuthor);
  return (
    <View testID={testID} style={{ paddingVertical: 6 }}>
      {entries.map((entry, index) => {
        const previous = index === 0 ? null : entries[index - 1];
        // The speaker is named where a message begins: a new message, a new speaker, or after a gap.
        const named = previous === null || previous.role !== entry.role || previous.message !== entry.message || entry.gapBefore;
        return (
          <View key={entry.key} testID={`${testID}-item`}>
            {entry.gapBefore ? (
              <Text testID={`${testID}-gap`} accessibilityLabel={copy.gap} accessibilityLanguage={language}
                style={{ ...typeStyle('supporting'), color: palette.tertiary, paddingStart: inset, paddingVertical: 2, writingDirection: writing }}>…</Text>
            ) : null}
            {named ? (
              <Text testID={`${testID}-speaker`} accessibilityLanguage={language}
                style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingStart: inset, paddingEnd: 20, paddingTop: 10, writingDirection: writing }}>
                {speaker(entry.role)}
              </Text>
            ) : null}
            <View style={{ marginStart: inset - (entry.emphasized ? EMPHASIS_BAR + 6 : 0), paddingStart: entry.emphasized ? 6 : 0,
              borderStartWidth: entry.emphasized ? EMPHASIS_BAR : 0, borderColor: palette.primary, marginEnd: 20 }}>
              <Text testID={entry.emphasized ? `${testID}-emphasized` : `${testID}-text`} accessibilityLanguage={language}
                accessibilityLabel={entry.emphasized ? `${copy.emphasized}${language === 'ar' ? '، ' : ', '}${entry.text}` : undefined}
                style={{ ...typeStyle('body'), color: palette.primary, paddingVertical: 2, writingDirection: writing }}>
                {entry.text}
              </Text>
            </View>
            {entry.onToggleEmphasis !== undefined ? (
              <Control palette={palette} language={language} accessibilityLabel={entry.emphasized ? copy.unemphasize : copy.emphasize}
                accessibilityState={{ selected: entry.emphasized, busy, disabled: busy }} onPress={entry.onToggleEmphasis} testID={`${testID}-emphasis`}
                style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, marginStart: inset - 16, paddingHorizontal: 16, justifyContent: 'center' }}>
                <Text style={{ ...typeStyle('supporting'), color: palette.restInk, writingDirection: writing }}>{entry.emphasized ? copy.unemphasize : copy.emphasize}</Text>
              </Control>
            ) : null}
          </View>
        );
      })}
      {pageCount > 1 ? (
        <View testID={`${testID}-pages`} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingStart: inset - 16, paddingTop: 8, columnGap: 4 }}>
          {onPage !== null && page > 1 ? (
            <Control palette={palette} language={language} accessibilityLabel={copy.previous} accessibilityState={{ disabled: busy }} onPress={() => onPage(page - 1)}
              testID={`${testID}-previous`} style={{ minHeight: MIN_TARGET, paddingHorizontal: 16, justifyContent: 'center' }}>
              <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: writing }}>{copy.previous}</Text>
            </Control>
          ) : null}
          <Text testID={`${testID}-page`} accessibilityLanguage={language} style={{ ...typeStyle('supporting'), color: palette.secondary, paddingHorizontal: 8, writingDirection: writing }}>
            {copy.pageOf(page, pageCount)}
          </Text>
          {onPage !== null && page < pageCount ? (
            <Control palette={palette} language={language} accessibilityLabel={copy.next} accessibilityState={{ disabled: busy }} onPress={() => onPage(page + 1)}
              testID={`${testID}-next`} style={{ minHeight: MIN_TARGET, paddingHorizontal: 16, justifyContent: 'center' }}>
              <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: writing }}>{copy.next}</Text>
            </Control>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
