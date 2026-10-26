/**
 * S8A-05 CP1 — «اكتب موضوعك» / Write your topic, drawn INSIDE the «العالم العام» / Public World root (no second navigation
 * system: its Back returns to the Public root; nothing is registered with the platform).
 *
 *   - «مسوداتي»: the reader's own private drafts, from the account;
 *   - the editor: a human title, the reader's own text and one section they choose from the fixed list. QANDEEL writes,
 *     rewrites and suggests nothing here;
 *   - the preview: the topic exactly as Public World would show it — the title first, the CURRENT public display, the
 *     section and the text — with the plain warning that all of it would become public and the deterministic privacy
 *     notes; «تجهيز للنشر» answers honestly that publishing is not open yet;
 *   - a prepared, never-published topic shows that it is not published, and can go back to its draft;
 *   - deleting a draft asks once more, then erases its words.
 *
 * The editor saves by itself (the controller's autosave) and says only what is known about it: saving, saved — only when
 * the account holds exactly the words shown — or that the save failed and the words are still here.
 *
 * Every word is the S8A-05 CP1 copy module's (its Copy Gate) or an approved word it reuses.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, ScrollView, Text, TextInput, View } from 'react-native';

import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { publicAuthoringCopy } from '../public-authoring';
import type { PublicTopicPreview } from '../runtime-entry';
import { PUBLIC_TOPIC_SECTIONS, PUBLIC_TOPIC_TEXT_MAX, PUBLIC_TOPIC_TITLE_MAX } from '../runtime-entry';
import { fillCompose, publicComposeCopy, type PublicComposeCopy } from './copy';
import { isDraftSaved, type PublicComposeController, type PublicComposeDraft, type PublicComposeNotice, type PublicComposeState } from './public-compose-controller';

export const PUBLIC_COMPOSE_TEST_ID = 'qandeel-public-compose';
const ROW_START = 24;
const ROW_END = 20;
const BUSY_OPACITY = 0.6;
const FIELD_MIN_HEIGHT = 48;
const TEXT_MIN_HEIGHT = 160;
const FIELD_RADIUS = 12;

interface Shared { readonly palette: ConversationPalette; readonly language: ChromeLanguage; readonly copy: PublicComposeCopy; readonly writing: 'rtl' | 'ltr' }

const noticeOf = (copy: PublicComposeCopy, notice: PublicComposeNotice, saved: boolean): string | null => {
  switch (notice) {
    case 'STALE': return copy.stale;
    case 'LIMIT_REACHED': return copy.limitReached;
    case 'DELETION_PENDING': return copy.deletionPending;
    case 'INVALID': return copy.invalid;
    // «مسودتك محفوظة.» only when the account confirmed exactly the draft shown (the Product Owner's condition).
    case 'NOT_OPEN': return saved ? `${copy.notOpen} ${copy.draftKept}` : copy.notOpen;
    case 'TITLE_TOO_SHORT': return copy.readiness('TITLE_TOO_SHORT');
    case 'TEXT_REQUIRED': return copy.readiness('TEXT_REQUIRED');
    case 'SECTION_REQUIRED': return copy.readiness('SECTION_REQUIRED');
    case 'DELETED': return copy.deleted;
    case 'ACTION_UNAVAILABLE': return copy.actionUnavailable;
    default: return null;
  }
};

function Heading({ text, s, testID }: { readonly text: string; readonly s: Shared; readonly testID?: string }) {
  return (
    <Text testID={testID} accessibilityRole="header" accessibilityLanguage={s.language}
      style={{ ...typeStyle('metadata'), color: s.palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 22, paddingBottom: 6, writingDirection: s.writing }}>
      {text}
    </Text>
  );
}

function Line({ text, s, role = 'supporting', testID, color }: {
  readonly text: string; readonly s: Shared; readonly role?: 'supporting' | 'body' | 'statement'; readonly testID?: string; readonly color?: string;
}) {
  return (
    <Text testID={testID} accessibilityLanguage={s.language}
      style={{ ...typeStyle(role), color: color ?? s.palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 4, writingDirection: s.writing }}>
      {text}
    </Text>
  );
}

function Action({ label, onPress, s, testID, busy, emphasis = false }: {
  readonly label: string; readonly onPress: () => void; readonly s: Shared; readonly testID: string; readonly busy: boolean; readonly emphasis?: boolean;
}) {
  return (
    <View style={{ paddingStart: ROW_START - 16, paddingVertical: 4 }}>
      <Control palette={s.palette} language={s.language} accessibilityLabel={label} accessibilityState={{ busy, disabled: busy }} onPress={onPress} testID={testID}
        style={{ alignSelf: 'flex-start', minHeight: MIN_TARGET, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: emphasis ? s.palette.field : undefined, opacity: busy ? BUSY_OPACITY : 1 }}>
        <Text style={{ ...typeStyle('action'), color: emphasis ? s.palette.primary : s.palette.restInk, writingDirection: s.writing }}>{label}</Text>
      </Control>
    </View>
  );
}

function Field({ label, hint, value, onChange, max, multiline, s, busy, testID }: {
  readonly label: string; readonly hint: string; readonly value: string; readonly onChange: (next: string) => void; readonly max: number;
  readonly multiline: boolean; readonly s: Shared; readonly busy: boolean; readonly testID: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ rowGap: 4, paddingStart: ROW_START, paddingEnd: ROW_END, paddingVertical: 6 }}>
      <Text accessibilityLanguage={s.language} style={{ ...typeStyle('supporting'), color: s.palette.secondary, writingDirection: s.writing }}>{label}</Text>
      <TextInput testID={testID} value={value} onChangeText={onChange} editable={!busy} maxLength={max} multiline={multiline} accessibilityLabel={label}
        accessibilityHint={hint} accessibilityLanguage={s.language} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        selectionColor={s.palette.primary} cursorColor={s.palette.primary} textAlignVertical={multiline ? 'top' : 'center'}
        style={{
          ...typeStyle('body'), color: s.palette.primary, backgroundColor: s.palette.field, minHeight: multiline ? TEXT_MIN_HEIGHT : FIELD_MIN_HEIGHT,
          borderRadius: FIELD_RADIUS, paddingHorizontal: 14, paddingVertical: 9, borderWidth: s.palette.focusThickness,
          borderColor: focused ? s.palette.focusIndicator : s.palette.field, writingDirection: s.writing, textAlign: s.writing === 'rtl' ? 'right' : 'left',
        }} />
      <Text accessibilityLanguage={s.language} style={{ ...typeStyle('supporting'), color: s.palette.tertiary, writingDirection: s.writing }}>{hint}</Text>
    </View>
  );
}

/** What is known about saving, and nothing more: saving, saved (confirmed exactly), or failed with the words still here. */
function SaveStatus({ state, s }: { readonly state: PublicComposeState; readonly s: Shared }) {
  const text = state.saving === 'SAVING' ? s.copy.saving : state.saving === 'FAILED' ? s.copy.saveFailed : isDraftSaved(state) ? s.copy.saved : null;
  if (text === null) return null;
  return (
    <Text testID="qandeel-public-compose-save-status" accessibilityLiveRegion="polite" accessibilityLanguage={s.language}
      style={{ ...typeStyle('supporting'), color: state.saving === 'FAILED' ? s.palette.primary : s.palette.tertiary, paddingStart: ROW_START, paddingEnd: ROW_END,
        paddingVertical: 4, writingDirection: s.writing }}>
      {text}
    </Text>
  );
}

function Editor({ draft, s, busy, confirmingDelete, controller, state }: {
  readonly draft: PublicComposeDraft; readonly s: Shared; readonly busy: boolean; readonly confirmingDelete: boolean; readonly controller: PublicComposeController;
  readonly state: PublicComposeState;
}) {
  if (draft.state === 'PREPARED') {
    return (
      <View testID="qandeel-public-compose-prepared">
        <Line text={s.copy.preparedState} s={s} testID="qandeel-public-compose-prepared-state" />
        <Line text={draft.title} s={s} role="statement" color={s.palette.primary} />
        {draft.section !== null ? <Line text={s.copy.section(draft.section)} s={s} /> : null}
        <Line text={draft.text} s={s} role="body" color={s.palette.primary} />
        <Line text={s.copy.backToDraftNote} s={s} />
        <Action label={s.copy.backToDraft} onPress={controller.backToDraft} s={s} busy={busy} emphasis testID="qandeel-public-compose-back-to-draft" />
        <DeleteRow s={s} busy={busy} confirming={confirmingDelete} controller={controller} />
      </View>
    );
  }
  return (
    <View testID="qandeel-public-compose-editor">
      <Line text={s.copy.privateNote} s={s} testID="qandeel-public-compose-private" />
      <Field label={s.copy.titleLabel} hint={s.copy.titleHint} value={draft.title} onChange={controller.setTitle} max={PUBLIC_TOPIC_TITLE_MAX} multiline={false}
        s={s} busy={busy} testID="qandeel-public-compose-title" />
      <Field label={s.copy.textLabel} hint={fillCompose(s.copy.textCount, String(draft.text.length))} value={draft.text} onChange={controller.setText}
        max={PUBLIC_TOPIC_TEXT_MAX} multiline s={s} busy={busy} testID="qandeel-public-compose-text" />
      <Heading text={s.copy.sectionLabel} s={s} />
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', paddingStart: ROW_START - 8, paddingEnd: ROW_END, columnGap: 6, rowGap: 6 }}>
        {PUBLIC_TOPIC_SECTIONS.map((key) => {
          const chosen = draft.section === key;
          return (
            <Control key={key} palette={s.palette} language={s.language} accessibilityRole="radio" accessibilityLabel={s.copy.section(key)}
              accessibilityState={{ checked: chosen, disabled: busy }} onPress={() => controller.setSection(key)} testID={`qandeel-public-compose-section-${key}`}
              style={{ minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center', borderRadius: FIELD_RADIUS, backgroundColor: chosen ? s.palette.field : undefined }}>
              <Text style={{ ...typeStyle('supporting'), color: chosen ? s.palette.primary : s.palette.secondary, writingDirection: s.writing }}>{s.copy.section(key)}</Text>
            </Control>
          );
        })}
      </View>
      <SaveStatus state={state} s={s} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingTop: 12 }}>
        <Action label={s.copy.save} onPress={controller.save} s={s} busy={busy} testID="qandeel-public-compose-save" />
        <Action label={s.copy.preview} onPress={controller.showPreview} s={s} busy={busy} emphasis testID="qandeel-public-compose-preview" />
      </View>
      <DeleteRow s={s} busy={busy} confirming={confirmingDelete} controller={controller} />
    </View>
  );
}

function DeleteRow({ s, busy, confirming, controller }: { readonly s: Shared; readonly busy: boolean; readonly confirming: boolean; readonly controller: PublicComposeController }) {
  if (!confirming) return <Action label={s.copy.delete} onPress={controller.askDelete} s={s} busy={busy} testID="qandeel-public-compose-delete" />;
  return (
    <View testID="qandeel-public-compose-delete-confirm">
      <Line text={s.copy.deleteNote} s={s} />
      <Action label={s.copy.deleteConfirm} onPress={controller.confirmDelete} s={s} busy={busy} testID="qandeel-public-compose-delete-confirmed" />
    </View>
  );
}

function Preview({ preview, s, busy, controller, shownAs }: {
  readonly preview: PublicTopicPreview; readonly s: Shared; readonly busy: boolean; readonly controller: PublicComposeController; readonly shownAs: string;
}) {
  return (
    <View testID="qandeel-public-compose-preview-screen">
      <Line text={s.copy.previewHeading} s={s} />
      {/* The topic as Public World would show it: the human title first. */}
      <View testID="qandeel-public-compose-preview-card" style={{ paddingVertical: 8 }}>
        <Line text={preview.title} s={s} role="statement" color={s.palette.primary} testID="qandeel-public-compose-preview-title" />
        {preview.publisher.label !== null ? <Line text={`${shownAs}: ${preview.publisher.label}`} s={s} testID="qandeel-public-compose-preview-publisher" /> : null}
        {preview.section !== null ? <Line text={s.copy.section(preview.section)} s={s} testID="qandeel-public-compose-preview-section" /> : null}
        <Line text={preview.text} s={s} role="body" color={s.palette.primary} testID="qandeel-public-compose-preview-text" />
      </View>
      <Heading text={s.copy.privacyHeading} s={s} />
      <Line text={s.copy.publicWarning} s={s} color={s.palette.primary} testID="qandeel-public-compose-public-warning" />
      {preview.privacyNotes.map((note) => <Line key={note} text={s.copy.note(note)} s={s} color={s.palette.primary} testID={`qandeel-public-compose-note-${note}`} />)}
      {preview.readiness !== 'READY'
        ? <Line text={s.copy.readiness(preview.readiness)} s={s} testID="qandeel-public-compose-not-ready" />
        : <Action label={s.copy.prepare} onPress={controller.prepare} s={s} busy={busy} emphasis testID="qandeel-public-compose-prepare" />}
    </View>
  );
}

export interface PublicComposeWorkspaceProps {
  readonly controller: PublicComposeController;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly bottomInset: number;
}

export function PublicComposeWorkspace({ controller, language, palette, bottomInset }: PublicComposeWorkspaceProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const copy = publicComposeCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const s: Shared = { palette, language, copy, writing };
  const said = noticeOf(copy, state.notice, isDraftSaved(state));
  useEffect(() => {
    if (said !== null) AccessibilityInfo.announceForAccessibility(said);
  }, [said]);

  const title = state.screen === 'PREVIEW' ? copy.preview
    : state.screen === 'EDIT' ? (state.draft !== null && state.draft.title.trim().length > 0 ? state.draft.title : copy.newDraft) : copy.draftsHeading;

  return (
    <View testID={PUBLIC_COMPOSE_TEST_ID} accessibilityLanguage={language} style={{ flex: 1, direction: writing }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingStart: ROW_START - 16, paddingEnd: ROW_END, columnGap: 4 }}>
        <Control palette={palette} language={language} accessibilityLabel={copy.back} onPress={controller.back} testID="qandeel-public-compose-back"
          style={{ paddingHorizontal: 16 }}>
          <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: writing }}>{copy.back}</Text>
        </Control>
        <Text accessibilityRole="header" accessibilityLanguage={language} testID="qandeel-public-compose-heading" numberOfLines={1}
          style={{ ...typeStyle('body'), color: palette.primary, flex: 1, writingDirection: writing }}>{title}</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: bottomInset + 24 }} keyboardShouldPersistTaps="handled">
        {said !== null ? <Line text={said} s={s} testID="qandeel-public-compose-notice" color={palette.primary} /> : null}
        {state.status === 'UNAVAILABLE' ? (
          <View testID="qandeel-public-compose-unavailable">
            <Line text={copy.actionUnavailable} s={s} role="body" />
            <Action label={copy.retry} onPress={controller.refresh} s={s} busy={state.busy} testID="qandeel-public-compose-retry" />
          </View>
        ) : state.status === 'LOADING' ? (
          // Keyed apart from the list: a reused native view would keep the loading view's busy state on Android.
          <View key="loading" testID="qandeel-public-compose-loading" accessible accessibilityState={{ busy: true }} style={{ minHeight: MIN_TARGET }} />
        ) : state.screen === 'LIST' ? (
          // The screen's heading already names the drafts; the list repeats no heading of its own.
          <View key="list" testID="qandeel-public-compose-list">
            <Action label={copy.newDraft} onPress={controller.newDraft} s={s} busy={state.busy} emphasis testID="qandeel-public-compose-new" />
            <Line text={copy.privateNote} s={s} />
            {state.drafts.length === 0 ? <Line text={copy.noDrafts} s={s} testID="qandeel-public-compose-no-drafts" /> : state.drafts.map((draft) => (
              <View key={draft.draftId}>
                <Action label={draft.title.trim().length > 0 ? draft.title : copy.untitled} onPress={() => controller.openDraft(draft.draftId)} s={s}
                  busy={state.busy} testID="qandeel-public-compose-draft-row" />
                {draft.state === 'PREPARED' ? <Line text={copy.preparedState} s={s} /> : null}
              </View>
            ))}
          </View>
        ) : state.screen === 'EDIT' && state.draft !== null ? (
          <Editor draft={state.draft} s={s} busy={state.busy} confirmingDelete={state.confirmingDelete} controller={controller} state={state} />
        ) : state.screen === 'PREVIEW' && state.preview !== null ? (
          <Preview preview={state.preview} s={s} busy={state.busy} controller={controller} shownAs={publicAuthoringCopy(language).shownAs} />
        ) : null}
      </ScrollView>
    </View>
  );
}
