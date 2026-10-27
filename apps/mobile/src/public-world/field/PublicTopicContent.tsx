/**
 * S8A-05 CP2 — a served topic's content in its panel, page by page (50 items a page), in its sealed order: nothing is
 * dropped, and the next page is read only when the reader asks for it. A topic made from its author's conversation or
 * from a «فهم قنديل» item names who said what (the author by their public name, «قنديل», or QANDEEL's unconfirmed understanding), shows its
 * emphasis and a «…» where messages were left out. A reader is never told where in the author's private conversation
 * a message stood: the server sends no such position.
 *
 * Nothing is kept for display (R1): page 1 is the panel's own latest read, a later page is read now, and a new panel read
 * reads the shown page again. A page that is no longer served removes the topic, as the panel's own read does. Content
 * without sealed speakers (before CP2) is drawn exactly as before.
 */
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { typeStyle, type ConversationPalette } from '../../conversation';
import type { ChromeLanguage } from '../../orientation-chrome';
import { PublicTopicItems, type PublicTopicItemEntry } from '../../public-compose/PublicTopicItems';
import type { PublicFieldContentItem, PublicFieldExperience } from '../../runtime-entry';
import type { PublicFieldCopy } from './field-copy';
import type { PublicFieldController } from './public-field-controller';

export interface PublicTopicContentProps {
  readonly experience: PublicFieldExperience;
  readonly copy: PublicFieldCopy;
  readonly palette: ConversationPalette;
  readonly language: ChromeLanguage;
  /** Reads one later page; null where the host has no paged read (only the first page is shown then). */
  readonly readPage: PublicFieldController['contentPage'] | null;
}

type Shown = { readonly page: number; readonly items: readonly PublicFieldContentItem[] | null; readonly failed: boolean };

export function PublicTopicContent({ experience, copy, palette, language, readPage }: PublicTopicContentProps) {
  const pageCount = experience.contentPages?.pageCount ?? 1;
  const [shown, setShown] = useState<Shown>({ page: 1, items: null, failed: false });
  const page = Math.min(shown.page, pageCount);

  // A later page is read now — and again on every new panel read (a new `experience`), never kept from an older one.
  useEffect(() => {
    if (page === 1 || readPage === null) return undefined;
    let cancelled = false;
    void readPage(experience.entry.id, page).then((answer) => {
      if (cancelled) return;
      setShown(typeof answer === 'object' ? { page: answer.page, items: answer.items, failed: false } : { page, items: null, failed: true });
    });
    return () => {
      cancelled = true;
    };
  }, [experience, page, readPage]);

  const items = page === 1 ? experience.content : shown.items;
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const text = (role: 'body' | 'metadata', color: string) => ({ ...typeStyle(role), color, writingDirection: writing as 'rtl' | 'ltr' });
  const onPage = readPage === null ? null : (next: number) => setShown({ page: next, items: null, failed: false });
  const spoken = (items ?? []).some((item) => item.role !== undefined);

  if (!spoken && pageCount === 1) {
    return (
      <>
        {experience.content.map((item) => (
          <View key={item.ordinal} style={{ rowGap: 2 }}>
            {item.kind === 'ANALYSIS' ? <Text style={text('metadata', palette.tertiary)}>{copy.analysisItem}</Text> : null}
            <Text style={text('body', palette.primary)}>{item.text}</Text>
          </View>
        ))}
      </>
    );
  }

  const entries: PublicTopicItemEntry[] = spoken && items !== null ? items.map((item) => ({
    key: String(item.ordinal), role: item.role ?? 'WRITTEN', message: item.message ?? null, text: item.text,
    emphasized: item.emphasized === true, gapBefore: item.gapBefore === true,
  })) : [];
  return (
    <View testID="qandeel-public-panel-content" style={{ marginHorizontal: -20 }}>
      {!spoken && items !== null ? (
        <View style={{ paddingHorizontal: 20, rowGap: 10 }}>
          {items.map((item) => (
            <View key={item.ordinal} style={{ rowGap: 2 }}>
              {item.kind === 'ANALYSIS' ? <Text style={text('metadata', palette.tertiary)}>{copy.analysisItem}</Text> : null}
              <Text style={text('body', palette.primary)}>{item.text}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {items === null ? (
        shown.failed
          ? <Text testID="qandeel-public-panel-content-unavailable" accessibilityLiveRegion="polite" style={{ ...text('body', palette.secondary), paddingHorizontal: 20 }}>
            {copy.fieldUnavailable}
          </Text>
          : <View testID="qandeel-public-panel-content-loading" accessible accessibilityState={{ busy: true }} style={{ minHeight: 48 }} />
      ) : null}
      <PublicTopicItems entries={entries} page={page} pageCount={pageCount} onPage={onPage} authorName={experience.publisher.label} palette={palette} language={language}
        busy={items === null && !shown.failed} testID="qandeel-public-panel-items" inset={20} />
    </View>
  );
}
