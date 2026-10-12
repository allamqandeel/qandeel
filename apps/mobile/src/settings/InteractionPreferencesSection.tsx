/**
 * IP-IMP-01 — General Settings → «قنديل والمحادثة» / QANDEEL & Conversation → «تفضيلات التعامل» / Interaction
 * Preferences: ONE row in the existing group, opening a page of the ONE General Settings destination (the same
 * state-of-the-destination pattern its other pages use; no route, no second Settings framework, no forced popup).
 *
 * The page holds the four durable preferences the reader may declare - Reply Length, Reply Language & Dialect, Humour,
 * Explanation Style - each a radio group whose first option is «تلقائي» / Automatic (no durable declaration). A choice
 * commits directly (no Save button) and is PENDING until the server answers: the confirmed value stays selected, the
 * chosen option says it is busy, and nothing else can be chosen meanwhile. The server's answer is shown afterwards, and
 * said once: saved, reset to Automatic, or not saved. The reply language here is QANDEEL's reply language; the app's own
 * UI language is the system's and stays in the Language row beside this one.
 *
 * Below them, «مراجعة تفضيلات سابقة» / Review previous preferences opens, in place, the optional review of what the
 * reader said before this record existed (their own SELF Memories naming an approved value). Each can be applied - or,
 * when it would replace a different current choice, «استبدال التفضيل الحالي» - or skipped. An empty review says so.
 * Every word is the Product Owner's approved IP-IMP-01 copy (`interaction-preferences-copy.ts`).
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';

import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { INTERACTION_PREFERENCE_FIELDS, INTERACTION_PREFERENCE_KEYS, INTERACTION_PREFERENCE_VALUES } from './interaction-preferences-vocabulary';
import { ActionRow } from './AccountSecuritySection';
import { interactionPreferencesCopy, type InteractionPreferencesCopy } from './interaction-preferences-copy';
import type { InteractionPreferencesController, InteractionPreferencesState } from './interaction-preferences-controller';

const ROW_START = 24;
const ROW_END = 20;
const BUSY_OPACITY = 0.55;

export const INTERACTION_PREFERENCES_ROW_TEST_ID = 'qandeel-settings-interaction-preferences';

/** The row in «قنديل والمحادثة» / QANDEEL & Conversation that opens the page. */
export function InteractionPreferencesRow({ language, palette, onOpen, rowRef }: {
  readonly language: ChromeLanguage; readonly palette: ConversationPalette; readonly onOpen: () => void; readonly rowRef?: (node: View | null) => void;
}) {
  return (
    <ActionRow label={interactionPreferencesCopy(language).row} notice={null} busy={false} language={language} palette={palette}
      onPress={onOpen} rowRef={rowRef} testID={INTERACTION_PREFERENCES_ROW_TEST_ID} />
  );
}

function Heading({ text, palette, language }: { readonly text: string; readonly palette: ConversationPalette; readonly language: ChromeLanguage }) {
  return (
    <Text accessibilityRole="header" accessibilityLanguage={language} style={{ ...typeStyle('metadata'), color: palette.tertiary, paddingTop: 22, paddingBottom: 4, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: language === 'ar' ? 'rtl' : 'ltr' }}>
      {text}
    </Text>
  );
}

/** One option: a ring holding a filled dot when it is the CONFIRMED value - a shape, never colour alone. */
function Option({ label, selected, pending, disabled, onChoose, palette, language, testID }: {
  readonly label: string; readonly selected: boolean; readonly pending: boolean; readonly disabled: boolean; readonly onChoose: () => void;
  readonly palette: ConversationPalette; readonly language: ChromeLanguage; readonly testID: string;
}) {
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, selected, busy: pending, disabled }}
      onPress={disabled ? () => undefined : onChoose}
      testID={testID}
      style={{ minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0, opacity: pending ? BUSY_OPACITY : 1 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 14 }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: palette.markerThickness, borderColor: selected ? palette.selectedInk : palette.restInk, alignItems: 'center', justifyContent: 'center' }}>
          {selected ? <View testID={`${testID}-selected`} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.selectedMarker }} /> : null}
        </View>
        <Text style={{ ...typeStyle('body'), color: palette.primary, flex: 1, writingDirection: writing }}>{label}</Text>
      </View>
    </Control>
  );
}

function noticeText(state: InteractionPreferencesState, words: InteractionPreferencesCopy): string | null {
  if (state.notice === 'SAVED') return words.saved;
  if (state.notice === 'RESET') return words.reset;
  if (state.notice === 'NOT_SAVED') return words.notSaved;
  return null;
}

export function InteractionPreferencesPage({ controller, language, palette, busyChanged }: {
  readonly controller: InteractionPreferencesController;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  /** True while a change is committing: the destination does not leave a commit half-way. */
  readonly busyChanged?: (busy: boolean) => void;
}) {
  const words = interactionPreferencesCopy(language);
  const writing = language === 'ar' ? 'rtl' : 'ltr';
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  useEffect(() => {
    controller.start();
  }, [controller]);
  const busy = state.pending !== null;
  useEffect(() => {
    busyChanged?.(busy);
  }, [busy, busyChanged]);
  useEffect(() => () => busyChanged?.(false), [busyChanged]);
  // The result of an act is said once: keyed on the state that carries it, never on a rebuilt copy object.
  const said = useRef<InteractionPreferencesState | null>(null);
  const notice = noticeText(state, words);
  useEffect(() => {
    if (notice === null || said.current === state) return;
    said.current = state;
    AccessibilityInfo.announceForAccessibility(notice);
  }, [notice, state]);

  if (state.status === 'LOADING') {
    return <View testID="qandeel-interaction-preferences-loading" accessibilityState={{ busy: true }} style={{ padding: ROW_START }} />;
  }
  if (state.status === 'UNAVAILABLE' || state.record === null) {
    // The one approved sentence says what happened and what to do; pressing it reads again.
    return (
      <Control palette={palette} language={language} accessibilityLabel={words.loadFailed} onPress={() => controller.start()} testID="qandeel-interaction-preferences-load-failed"
        style={{ minHeight: MIN_TARGET, padding: ROW_START, borderRadius: 0 }}>
        <Text accessibilityLiveRegion="polite" style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{words.loadFailed}</Text>
      </Control>
    );
  }
  const current = state.record.preferences;
  const pendingChoice = state.pending !== null && 'field' in state.pending ? state.pending : null;
  const pendingMemory = state.pending !== null && 'memoryId' in state.pending ? state.pending.memoryId : null;
  const review = state.review;

  return (
    <View testID="qandeel-interaction-preferences" accessibilityLanguage={language}>
      <View testID="qandeel-interaction-preferences-notice" accessibilityLiveRegion="polite" style={{ paddingStart: ROW_START, paddingEnd: ROW_END }}>
        {notice === null ? null : <Text style={{ ...typeStyle('supporting'), color: palette.secondary, paddingTop: 12, writingDirection: writing }}>{notice}</Text>}
      </View>

      {INTERACTION_PREFERENCE_FIELDS.map((field) => (
        <View key={field} testID={`qandeel-interaction-preferences-${slug(field)}`}>
          <Heading text={words.fields[field]} palette={palette} language={language} />
          <View accessibilityRole="radiogroup" accessibilityLabel={words.fields[field]} accessibilityLanguage={language} testID={`qandeel-interaction-preferences-${slug(field)}-group`}>
            {INTERACTION_PREFERENCE_VALUES[field].map((value) => (
              <Option
                key={value}
                label={words.values[field][value]}
                selected={current[INTERACTION_PREFERENCE_KEYS[field]] === value}
                pending={pendingChoice !== null && pendingChoice.field === field && pendingChoice.value === value}
                disabled={busy}
                onChoose={() => {
                  if (current[INTERACTION_PREFERENCE_KEYS[field]] !== value) void controller.choose(field, value);
                }}
                palette={palette}
                language={language}
                testID={`qandeel-interaction-preferences-${slug(field)}-${slug(value)}`}
              />
            ))}
          </View>
        </View>
      ))}

      <View style={{ paddingTop: 16 }}>
        <ActionRow label={words.review} notice={null} busy={review.status === 'LOADING'} language={language} palette={palette}
          onPress={() => (review.status === 'CLOSED' || review.status === 'UNAVAILABLE' ? controller.openReview() : undefined)}
          testID="qandeel-interaction-preferences-review" />
      </View>
      {review.status === 'UNAVAILABLE' ? (
        <Text testID="qandeel-interaction-preferences-review-failed" accessibilityLiveRegion="polite" style={{ ...typeStyle('supporting'), color: palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: writing }}>
          {words.loadFailed}
        </Text>
      ) : null}
      {review.status === 'READY' && review.candidates.length === 0 ? (
        <Text testID="qandeel-interaction-preferences-review-empty" accessibilityLiveRegion="polite" style={{ ...typeStyle('supporting'), color: palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: writing }}>
          {words.noCandidates}
        </Text>
      ) : null}
      {review.status === 'READY' ? review.candidates.map((candidate) => {
        const held = current[INTERACTION_PREFERENCE_KEYS[candidate.field]];
        const replaces = held !== 'DEFAULT' && held !== candidate.value;
        const act = replaces ? words.replace : words.apply;
        const proposal = `${words.fields[candidate.field]}: ${words.values[candidate.field][candidate.value]}`;
        const separator = language === 'ar' ? '، ' : ', ';
        const pending = pendingMemory === candidate.memoryId;
        return (
          <View key={candidate.memoryId} testID={`qandeel-interaction-preferences-candidate-${candidate.memoryId}`} style={{ paddingTop: 12 }}>
            {/* The reader's own words, exactly as remembered, then what applying them would choose. */}
            <Text style={{ ...typeStyle('body'), color: palette.primary, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: writing }}>{`«${candidate.statement}»`}</Text>
            <Text style={{ ...typeStyle('supporting'), color: palette.secondary, paddingStart: ROW_START, paddingEnd: ROW_END, writingDirection: writing }}>{proposal}</Text>
            <View style={{ flexDirection: 'row', columnGap: 8, paddingStart: ROW_START - 12, paddingEnd: ROW_END }}>
              <Control palette={palette} language={language} accessibilityLabel={`${act}${separator}${proposal}`} accessibilityState={{ busy: pending, disabled: busy }}
                onPress={busy ? () => undefined : () => void controller.adopt(candidate.memoryId)} testID={`qandeel-interaction-preferences-apply-${candidate.memoryId}`}
                style={{ minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center', opacity: pending ? BUSY_OPACITY : 1 }}>
                <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{act}</Text>
              </Control>
              <Control palette={palette} language={language} accessibilityLabel={`${words.skip}${separator}${proposal}`} accessibilityState={{ disabled: busy }}
                onPress={busy ? () => undefined : () => controller.skip(candidate.memoryId)} testID={`qandeel-interaction-preferences-skip-${candidate.memoryId}`}
                style={{ minHeight: MIN_TARGET, paddingHorizontal: 12, justifyContent: 'center' }}>
                <Text style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>{words.skip}</Text>
              </Control>
            </View>
          </View>
        );
      }) : null}
    </View>
  );
}

function slug(value: string): string {
  return value.toLowerCase().replace(/_/gu, '-');
}

