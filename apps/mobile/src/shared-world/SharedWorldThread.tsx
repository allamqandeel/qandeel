/**
 * S4-02 — a Shared World's conversation: its visible material and the reader's text input.
 *
 * Three producers, three treatments, and none of them guessed (S4-02 §1.4, §8.3) — the server says who produced each
 * material and whether this reader may delete it:
 *
 *   - the READER's own words sit on the reader's own edge (the start edge: right in Arabic, left in English), on the
 *     utterance slab, exactly as in the Personal Conversation;
 *   - ANOTHER PERSON's words sit on the other edge, on the same functional surface, under that person's own Name;
 *   - QANDEEL speaks open on the World from the other edge with NO surface of its own (the frozen Conversation grammar),
 *     under its CANON name — never a chat bubble.
 *
 * Every paragraph takes its own direction from its words (G1.1 bidi), whoever wrote it. Only the reader's own words
 * offer Delete, behind a calm confirmation that states what deletion does; nothing is destroyed by a swipe.
 *
 * The input is drawn only while the server says ordinary sending is open. It sends one logical submission at a time,
 * keeps the reader's words until the server confirms they are committed, and carries no microphone or voice control:
 * Shared Voice Notes wait on a durable audio runtime that does not exist yet (QAN-BL-VOICE-01).
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Text, TextInput, View } from 'react-native';

import {
  Control, Glyph, MIN_TARGET, directedParagraphs, typeStyle, withDirectionMark, type ConversationPalette,
} from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import type { SharedMaterial } from '../runtime-entry';
import { sharedConversationCopy, type SharedConversationCopy } from './conversation-copy';
import { SHARED_MESSAGE_MAX_LENGTH, type SharedThreadNotice, type SharedWorldController } from './shared-world-controller';

const GUTTER = 24;
const SLAB_END_INSET = 40;
const QANDEEL_END_INSET = 48;
const FIELD_MIN_HEIGHT = 44;
const FIELD_RADIUS = 12;
const INPUT_MAX_LINES = 5;
const BUSY_OPACITY = 0.6;

function Words({ text, fallback, palette }: { readonly text: string; readonly fallback: 'rtl' | 'ltr'; readonly palette: ConversationPalette }) {
  const paragraphs = useMemo(() => directedParagraphs(text, fallback), [text, fallback]);
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <Text key={index} style={{ ...typeStyle('body'), color: palette.primary, writingDirection: paragraph.direction }}>
          {withDirectionMark(paragraph)}
        </Text>
      ))}
    </>
  );
}

const noticeText = (copy: SharedConversationCopy, notice: SharedThreadNotice): string | null => {
  switch (notice) {
    case 'SEND_UNCONFIRMED': return copy.sendUnconfirmed;
    case 'SEND_REFUSED': return copy.sendRefused;
    case 'REPLY_FAILED': return copy.replyFailed;
    case 'DELETED': return copy.deleted;
    case 'DELETE_FAILED': return copy.deleteFailed;
    case 'LOAD_FAILED': return copy.loadFailed;
    default: return null;
  }
};

/**
 * One material that is not the reader's to delete — QANDEEL's words, another person's, or (S4-03) anything in an ended
 * World, which is read-only by entitlement. The same three treatments as the live thread; nothing here is actionable.
 */
export function SharedReadOnlyMaterial({ material, language, palette }: {
  readonly material: SharedMaterial;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
}) {
  const copy = sharedConversationCopy(language);
  const fallback = language === 'ar' ? 'rtl' : 'ltr';
  if (material.producer === 'QANDEEL') {
    // QANDEEL — open on the World, from the other edge. No surface of its own.
    return (
      <View testID={`qandeel-shared-material-qandeel-${material.materialId}`} accessible
        accessibilityLabel={copy.qandeelTurnName(material.text)} accessibilityLanguage={language}
        style={{ alignSelf: 'flex-end', marginTop: 16, maxWidth: '88%', paddingEnd: GUTTER - 4, rowGap: 2, marginStart: QANDEEL_END_INSET }}>
        <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: fallback }}>{copy.qandeel}</Text>
        <Words text={material.text} fallback={fallback} palette={palette} />
      </View>
    );
  }
  const mine = material.producer === 'SELF';
  const name = material.authorName ?? copy.someone;
  return (
    <View testID={`qandeel-shared-material-${mine ? 'self' : 'human'}-${material.materialId}`} accessible
      accessibilityLabel={mine ? copy.selfTurnName(material.text) : copy.otherTurnName(name, material.text)} accessibilityLanguage={language}
      style={{ alignSelf: mine ? 'flex-start' : 'flex-end', marginTop: 20, maxWidth: '88%', marginHorizontal: GUTTER - 8, marginEnd: SLAB_END_INSET }}>
      <View style={{ backgroundColor: mine ? palette.utterance : palette.field, paddingTop: 10, paddingBottom: 11, paddingHorizontal: 16, borderRadius: 18, rowGap: 2 }}>
        {mine ? null : <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: fallback }}>{name}</Text>}
        <Words text={material.text} fallback={fallback} palette={palette} />
      </View>
    </View>
  );
}

/**
 * One material the reader may delete — their own words — behind the calm confirmation that states what deletion does.
 * Reused as it is by the S6-05 Introduction World (R-5): the selection and the deletion itself belong to the caller.
 */
export function SharedOwnMaterial({ material, language, palette, open, confirming, busy, onToggle, onAsk, onKeep, onDelete }: {
  readonly material: SharedMaterial;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  /** The Delete action is offered under the words. */
  readonly open: boolean;
  /** The confirmation is shown. */
  readonly confirming: boolean;
  /** The deletion is on its way. */
  readonly busy: boolean;
  readonly onToggle: () => void;
  readonly onAsk: () => void;
  readonly onKeep: () => void;
  readonly onDelete: () => void;
}) {
  const copy = sharedConversationCopy(language);
  const fallback = language === 'ar' ? 'rtl' : 'ltr';
  const mine = material.producer === 'SELF';
  const name = material.authorName ?? copy.someone;
  const slab = (
    <View style={{ backgroundColor: mine ? palette.utterance : palette.field, paddingTop: 10, paddingBottom: 11, paddingHorizontal: 16, borderRadius: 18, rowGap: 2 }}>
      {mine ? null : <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: fallback }}>{name}</Text>}
      <Words text={material.text} fallback={fallback} palette={palette} />
    </View>
  );
  const label = mine ? copy.selfTurnName(material.text) : copy.otherTurnName(name, material.text);
  const testID = `qandeel-shared-material-${mine ? 'self' : 'human'}-${material.materialId}`;
  const place = { alignSelf: mine ? 'flex-start' : 'flex-end', marginTop: 20, maxWidth: '88%', marginHorizontal: GUTTER - 8 } as const;
  return (
    <View style={{ ...place, marginEnd: SLAB_END_INSET, rowGap: 6, opacity: busy ? BUSY_OPACITY : 1 }}>
      <Control palette={palette} language={language} accessibilityLabel={label} onPress={onToggle}
        testID={testID} style={{ borderRadius: 18 }}>
        {slab}
      </Control>
      {open && !confirming ? (
        <Control palette={palette} language={language} accessibilityLabel={copy.delete} onPress={onAsk}
          testID="qandeel-shared-delete" style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center' }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.delete}</Text>
        </Control>
      ) : null}
      {confirming ? (
        <View testID="qandeel-shared-delete-confirm" style={{ rowGap: 8 }}>
          <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: fallback }}>{copy.deleteExplanation}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 8 }}>
            <Control palette={palette} language={language} accessibilityLabel={copy.cancel} accessibilityState={{ disabled: busy }}
              onPress={() => { if (!busy) onKeep(); }} testID="qandeel-shared-delete-keep"
              style={{ minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center' }}>
              <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.cancel}</Text>
            </Control>
            <Control palette={palette} language={language} accessibilityLabel={copy.deleteConfirm} accessibilityState={{ busy, disabled: busy }}
              onPress={onDelete}
              testID="qandeel-shared-delete-confirm-action" style={{ minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center', backgroundColor: palette.field }}>
              <Text style={{ ...typeStyle('action'), color: palette.primary }}>{copy.deleteConfirm}</Text>
            </Control>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** The World's visible material, oldest first, with the reader's own words deletable behind a confirmation. */
export function SharedThread({ controller, language, palette }: {
  readonly controller: SharedWorldController;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
}) {
  const copy = sharedConversationCopy(language);
  const fallback = language === 'ar' ? 'rtl' : 'ltr';
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const thread = state.thread;
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const said = noticeText(copy, thread.notice);
  useEffect(() => {
    if (said !== null) AccessibilityInfo.announceForAccessibility(said);
  }, [said]);

  const row = (material: SharedMaterial) => {
    if (material.producer === 'QANDEEL' || !material.canDelete) {
      return <SharedReadOnlyMaterial key={material.materialId} material={material} language={language} palette={palette} />;
    }
    const open = selected === material.materialId;
    return (
      <SharedOwnMaterial key={material.materialId} material={material} language={language} palette={palette}
        open={open} confirming={confirming === material.materialId} busy={thread.deleting === material.materialId}
        onToggle={() => { setSelected(open ? null : material.materialId); setConfirming(null); }}
        onAsk={() => setConfirming(material.materialId)}
        onKeep={() => { setConfirming(null); setSelected(null); }}
        onDelete={() => { void controller.deleteMaterial(material.materialId).then(() => { setConfirming(null); setSelected(null); }); }} />
    );
  };

  return (
    <View testID="qandeel-shared-thread" style={{ paddingTop: 8 }}>

      {thread.hasOlder ? (
        // Older history is read one bounded page at a time, and only when the reader asks for it.
        <Control palette={palette} language={language} accessibilityLabel={copy.olderMessages} accessibilityState={{ busy: thread.loadingOlder, disabled: thread.loadingOlder }}
          onPress={() => controller.loadOlder()} testID="qandeel-shared-older"
          style={{ alignSelf: 'center', minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center', opacity: thread.loadingOlder ? BUSY_OPACITY : 1 }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.olderMessages}</Text>
        </Control>
      ) : null}
      {thread.materials.map(row)}
      {thread.sending !== null ? (
        <Text testID="qandeel-shared-waiting" accessibilityLiveRegion="polite"
          style={{ ...typeStyle('metadata'), color: palette.secondary, alignSelf: 'flex-end', marginTop: 12, marginHorizontal: GUTTER, writingDirection: fallback }}>
          {copy.waitingForReply}
        </Text>
      ) : null}
      <View testID="qandeel-shared-thread-notice" accessibilityLiveRegion="polite" style={{ marginHorizontal: GUTTER }}>
        {said === null ? null : <Text style={{ ...typeStyle('supporting'), color: thread.notice === 'DELETED' ? palette.secondary : palette.error, paddingTop: 10, writingDirection: fallback }}>{said}</Text>}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, marginHorizontal: GUTTER - 8, marginTop: 10 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.refresh} onPress={() => controller.refreshThread()} testID="qandeel-shared-refresh"
          style={{ minHeight: MIN_TARGET, paddingHorizontal: 8, justifyContent: 'center' }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk }}>{copy.refresh}</Text>
        </Control>
      </View>
      {thread.status === 'READY' && !thread.conversation ? (
        <Text testID="qandeel-shared-conversation-not-open" style={{ ...typeStyle('supporting'), color: palette.tertiary, marginHorizontal: GUTTER, marginTop: 8, writingDirection: fallback }}>
          {copy.conversationNotOpen}
        </Text>
      ) : null}
    </View>
  );
}

/** The reader's text input: drawn only while ordinary sending is open; one submission at a time; no voice control. */
export function SharedSendBar({ controller, language, palette, bottomInset }: {
  readonly controller: SharedWorldController;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly bottomInset: number;
}) {
  const copy = sharedConversationCopy(language);
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  if (!(state.thread.status === 'READY' && state.thread.conversation)) return null;
  // The words are cleared only once the server confirmed they are committed.
  return (
    <SharedComposer language={language} palette={palette} bottomInset={bottomInset} accessibilityLabel={copy.composerName}
      sending={state.thread.sending !== null} maxLength={SHARED_MESSAGE_MAX_LENGTH} onSend={(draft) => controller.send(draft)} />
  );
}

/**
 * The composer itself: the multiline input and its Send. `onSend` answers whether the words may leave the input (the
 * Shared World: once committed; the S6-05 Introduction: once they stand as the pending message). Reused by S6-05 with
 * its own accessible name (IW-24).
 */
export function SharedComposer({ language, palette, bottomInset, accessibilityLabel, sending, maxLength, onSend }: {
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly bottomInset: number;
  readonly accessibilityLabel: string;
  readonly sending: boolean;
  readonly maxLength: number;
  readonly onSend: (draft: string) => boolean | Promise<boolean>;
}) {
  const copy = sharedConversationCopy(language);
  const fallback = language === 'ar' ? 'rtl' : 'ltr';
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  // A composer that leaves the screen (an Introduction that ended) takes its keyboard with it: blurred while it still exists.
  const input = useRef<TextInput | null>(null);
  useLayoutEffect(() => () => { input.current?.blur(); }, []);
  const canSend = !sending && draft.trim().length > 0 && draft.length <= maxLength;
  const send = async () => {
    if (!canSend) return;
    const cleared = await onSend(draft);
    if (cleared && mounted.current) setDraft('');
  };
  return (
    <View testID="qandeel-shared-send-bar" style={{ flexDirection: 'row', alignItems: 'flex-end', columnGap: 6, paddingHorizontal: 12, paddingTop: 8, paddingBottom: bottomInset + 8 }}>
      <TextInput
        ref={input}
        testID="qandeel-shared-input"
        value={draft}
        onChangeText={setDraft}
        editable={!sending}
        multiline
        maxLength={maxLength}
        placeholder={copy.composerPlaceholder}
        placeholderTextColor={palette.tertiary}
        accessibilityLabel={accessibilityLabel}
        accessibilityLanguage={language}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={palette.primary}
        cursorColor={palette.primary}
        style={{
          ...typeStyle('body'), flex: 1, color: palette.primary, backgroundColor: palette.field, minHeight: FIELD_MIN_HEIGHT,
          maxHeight: typeStyle('body').lineHeight * INPUT_MAX_LINES, borderRadius: FIELD_RADIUS, paddingHorizontal: 14, paddingVertical: 9,
          borderWidth: palette.focusThickness, borderColor: focused ? palette.focusIndicator : palette.field, writingDirection: fallback,
          opacity: sending ? BUSY_OPACITY : 1,
        }}
      />
      <Control palette={palette} language={language} accessibilityLabel={copy.send} accessibilityState={{ busy: sending, disabled: !canSend }}
        onPress={() => void send()} testID="qandeel-shared-send" style={{ width: MIN_TARGET, alignItems: 'center' }}>
        <Glyph name="send" color={canSend ? palette.primary : palette.restInk} direction={fallback} />
      </Control>
    </View>
  );
}
