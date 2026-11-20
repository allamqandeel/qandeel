/**
 * COSMOS E-2 corrections, Slice B (the Product Owner's D-2, 2026-11-20) — the Personal conversation catalog over the
 * Conversation: the server's list of the person's own conversations, newest activity first; «محادثة جديدة» / New chat;
 * a tap opens a conversation (the integration owner rebuilds the session runtime); the pencil renames it with a
 * durable manual title.
 *
 * What a row says is the person's own title, else the person's own first words (the server's excerpt), else the
 * honest «محادثة بلا عنوان». No AI name, no invented theme, no count for a name. The row open now is marked, in words.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { FlatList, Text, TextInput, View } from 'react-native';

import type { ChromeLanguage } from '../orientation-chrome';
import type { ConversationCatalogEntry } from '../runtime-entry';
import { conversationCatalogCopy } from './catalog/copy';
import { conversationDisplayName, type ConversationCatalogController } from './conversation-catalog-controller';
import { Control, MIN_TARGET } from './visual/Control';
import { Glyph } from './visual/Glyph';
import { typeStyle, usePalette } from './visual/theme';

export const CONVERSATION_CATALOG_TEST_ID = 'qandeel-conversation-catalog';
const HEADER_MIN_HEIGHT = 56;
const TITLE_MAX = 80;

export type ConversationSwitchTarget =
  | { readonly kind: 'NEW'; readonly clientRequestId: string }
  /** `sp` (COSMOS E-2 Slice A): once the conversation is READY, stand on this Session Position (the topic's source moment). */
  | { readonly kind: 'OPEN'; readonly sessionId: string; readonly sp?: number };

export type ConversationSwitchOutcome = 'SWITCHED' | 'BUSY' | 'NOT_READY' | 'FAILED';

export interface ConversationCatalogSurfaceProps {
  readonly controller: ConversationCatalogController;
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  readonly onBack: () => void;
  /** The integration owner's switch. A fresh request identity is minted here per New-chat tap, never reused. */
  readonly onSwitch: (target: ConversationSwitchTarget) => Promise<ConversationSwitchOutcome>;
  readonly mintRequestId: () => string;
}

export function ConversationCatalogSurface({ controller, language, insets, onBack, onSwitch, mintRequestId }: ConversationCatalogSurfaceProps) {
  const palette = usePalette();
  const copy = conversationCatalogCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState('');
  useEffect(() => {
    controller.refresh();
  }, [controller]);

  const switchTo = useCallback(async (target: ConversationSwitchTarget) => {
    const outcome = await onSwitch(target);
    setBusy(outcome === 'BUSY');
  }, [onSwitch]);

  const startRename = (entry: ConversationCatalogEntry) => {
    setDraft(entry.title ?? '');
    controller.beginRename(entry.sessionId);
  };
  const saveRename = async (sessionId: string) => {
    const words = draft.replace(/\s+/gu, ' ').trim();
    if (words.length < 1 || words.length > TITLE_MAX) return;
    await controller.rename(sessionId, words);
  };
  const startEdge = (writing === 'rtl' ? insets.right : insets.left) + 10;
  const endEdge = (writing === 'rtl' ? insets.left : insets.right) + 10;

  const row = (entry: ConversationCatalogEntry) => {
    const name = conversationDisplayName(entry) ?? copy.untitled;
    const isCurrent = entry.sessionId === state.currentSessionId;
    const renaming = state.renaming === entry.sessionId;
    return (
      <View
        testID={`qandeel-conversation-row-${entry.sessionId}`}
        style={{ paddingStart: startEdge, paddingEnd: endEdge, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', columnGap: 8 }}
      >
        {renaming ? (
          <View style={{ flex: 1 }}>
            <TextInput
              testID="qandeel-conversation-rename-field"
              accessibilityLabel={copy.renameFieldName}
              value={draft}
              onChangeText={setDraft}
              maxLength={TITLE_MAX}
              autoFocus
              onSubmitEditing={() => void saveRename(entry.sessionId)}
              style={{ ...typeStyle('body'), color: palette.primary, borderBottomWidth: 1, borderBottomColor: palette.tertiary, paddingVertical: 6, writingDirection: writing, textAlign: writing === 'rtl' ? 'right' : 'left' }}
            />
            {state.renameFailed ? <Text style={{ ...typeStyle('metadata'), color: palette.error, writingDirection: writing }}>{copy.unavailable}</Text> : null}
            <View style={{ flexDirection: 'row', columnGap: 8, marginTop: 4 }}>
              <Control palette={palette} language={language} accessibilityLabel={copy.save} onPress={() => void saveRename(entry.sessionId)} testID="qandeel-conversation-rename-save" style={{ minHeight: MIN_TARGET, justifyContent: 'center', paddingHorizontal: 8 }}>
                <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.save}</Text>
              </Control>
              <Control palette={palette} language={language} accessibilityLabel={copy.cancel} onPress={() => controller.cancelRename()} testID="qandeel-conversation-rename-cancel" style={{ minHeight: MIN_TARGET, justifyContent: 'center', paddingHorizontal: 8 }}>
                <Text style={{ ...typeStyle('action'), color: palette.tertiary }}>{copy.cancel}</Text>
              </Control>
            </View>
          </View>
        ) : (
          <>
            <Control
              palette={palette}
              language={language}
              accessibilityLabel={isCurrent ? `${name} · ${copy.current}` : name}
              onPress={() => void switchTo({ kind: 'OPEN', sessionId: entry.sessionId })}
              testID={`qandeel-conversation-open-${entry.sessionId}`}
              style={{ flex: 1, minHeight: MIN_TARGET, justifyContent: 'center' }}
            >
              <Text numberOfLines={2} style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{name}</Text>
              <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>
                {isCurrent ? copy.current : whenOf(entry.lastTurnAt ?? entry.createdAt, language)}
              </Text>
            </Control>
            <Control palette={palette} language={language} accessibilityLabel={copy.rename} onPress={() => startRename(entry)} testID={`qandeel-conversation-rename-${entry.sessionId}`} style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ ...typeStyle('action'), color: palette.restInk }}>✎</Text>
            </Control>
          </>
        )}
      </View>
    );
  };

  return (
    <View testID={CONVERSATION_CATALOG_TEST_ID} accessibilityLanguage={language} style={{ flex: 1, backgroundColor: palette.world, direction: writing }}>
      <View style={{ paddingTop: insets.top, paddingStart: startEdge, paddingEnd: endEdge, minHeight: insets.top + HEADER_MIN_HEIGHT, flexDirection: 'row', alignItems: 'center', columnGap: 2 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.back} onPress={onBack} testID="qandeel-conversation-catalog-back" style={{ width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center' }}>
          <Glyph name="back" color={palette.restInk} direction={writing} />
        </Control>
        <Text testID="qandeel-conversation-catalog-title" accessibilityRole="header" accessibilityLanguage={language} style={{ ...typeStyle('statement'), color: palette.primary, flex: 1, paddingHorizontal: 2, writingDirection: writing }}>
          {copy.title}
        </Text>
      </View>
      <View style={{ paddingStart: startEdge, paddingEnd: endEdge, paddingBottom: 6 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.newChat} onPress={() => void switchTo({ kind: 'NEW', clientRequestId: mintRequestId() })} testID="qandeel-conversation-new" style={{ minHeight: MIN_TARGET, justifyContent: 'center' }}>
          <Text style={{ ...typeStyle('action'), color: palette.primary, writingDirection: writing }}>{`+ ${copy.newChat}`}</Text>
        </Control>
        {busy ? <Text testID="qandeel-conversation-busy" style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{copy.busy}</Text> : null}
      </View>
      {state.status === 'UNAVAILABLE' ? (
        <View style={{ paddingStart: startEdge, paddingEnd: endEdge }}>
          <Text testID="qandeel-conversation-catalog-unavailable" style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{copy.unavailable}</Text>
          <Control palette={palette} language={language} accessibilityLabel={copy.tryAgain} onPress={() => controller.refresh()} testID="qandeel-conversation-catalog-retry" style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, justifyContent: 'center' }}>
            <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.tryAgain}</Text>
          </Control>
        </View>
      ) : state.status === 'LOADING' || state.status === 'IDLE' ? (
        <Text testID="qandeel-conversation-catalog-loading" style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingStart: startEdge, paddingEnd: endEdge, writingDirection: writing }}>{copy.loading}</Text>
      ) : (
        <FlatList
          data={state.entries}
          keyExtractor={(entry) => entry.sessionId}
          renderItem={({ item }) => row(item)}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

/** A plain date for the row's second line: the conversation's own newest activity, in the device's calendar. */
function whenOf(iso: string, language: ChromeLanguage): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', { dateStyle: 'medium' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
