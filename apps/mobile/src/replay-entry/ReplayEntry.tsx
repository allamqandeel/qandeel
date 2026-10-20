/**
 * S7-02 — the Personal Replay entry's presentation: the END-edge control, its ASIDE, the selection mode's bar and the
 * one saved / unavailable line. G1.1-R3 is the reference for its behaviour and placement (§B7), not its code.
 *
 *   - The control is one quiet 44 × 44 media glyph at the upper chrome's END edge, after the depth control; the glyph
 *     never mirrors. While the hint is open and nothing is committed yet, its slot is held empty, so nothing shifts
 *     when it appears.
 *   - The ASIDE is anchored to the control under the upper chrome, with no scrim: the conversation stays where it is.
 *     A choice, a second press of the control or Android Back closes it.
 *   - The selection mode is the conversation's own messages, through the `ConversationSurface` selection seam. Its bar
 *     stands where the composer is; the composer's words are untouched and return with it.
 *
 * Every word is `copy.ts`'s. Nothing here reads or draws any Analysis, map, graphic or motion state, and nothing here
 * holds selection state: the controller does, by message id.
 */
import { useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, BackHandler, findNodeHandle, Text, View } from 'react-native';

import {
  CONVERSATION_HEADER_MIN_HEIGHT,
  Control,
  Glyph,
  MIN_TARGET,
  oppositeSide,
  readerDirection,
  readerSide,
  typeStyle,
  usePalette,
  type ConversationSelection,
  type ConversationSelectionMark,
} from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import type { ConversationExchangeView } from '../runtime-entry';
import { replayEntryCopy } from './copy';
import { displayedMessageIds, selectionMarks } from './replay-anchors';
import type { ReplayEntryController, ReplaySelectionState } from './replay-entry-controller';

const BUSY_OPACITY = 0.6;
const MENU_MIN_WIDTH = 232;
const MENU_RADIUS = 14;

interface ConversationReading {
  getState(): { readonly exchanges: readonly ConversationExchangeView[] };
  subscribe(listener: () => void): () => void;
}

export interface ReplayEntryControlProps {
  readonly controller: ReplayEntryController;
  readonly language: ChromeLanguage;
}

/** The END-edge control. Nothing at all while the hint is closed; an empty held slot until something is committed. */
export function ReplayEntryControl({ controller, language }: ReplayEntryControlProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const palette = usePalette();
  const copy = replayEntryCopy(language);
  const ref = useRef<View | null>(null);
  const engaged = state.menu !== null || state.selection !== null;
  const wasEngaged = useRef(engaged);

  useEffect(() => {
    controller.ensure();
  }, [controller]);

  // Leaving the ASIDE or the selection returns the screen reader to the control that opened it.
  useEffect(() => {
    if (wasEngaged.current && !engaged) {
      const node = ref.current === null ? null : findNodeHandle(ref.current);
      if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
    }
    wasEngaged.current = engaged;
  }, [engaged]);

  if (state.status === 'UNKNOWN' || state.status === 'HIDDEN') return null;
  if (state.status === 'RESERVED') {
    return (
      <View
        testID="qandeel-replay-entry-slot"
        style={{ width: MIN_TARGET, height: MIN_TARGET }}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      />
    );
  }
  return (
    <Control
      palette={palette}
      language={language}
      accessibilityLabel={copy.replayName}
      accessibilityState={{ expanded: state.menu !== null }}
      onPress={() => (state.menu === null ? controller.openMenu() : controller.closeMenu())}
      controlRef={(node) => {
        ref.current = node;
      }}
      testID="qandeel-replay-entry"
      style={{ width: MIN_TARGET, alignItems: 'center' }}
    >
      <Glyph name="replay" color={palette.primary} direction={readerDirection(language)} />
    </Control>
  );
}

export interface ReplayEntryMenuProps {
  readonly controller: ReplayEntryController;
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly left: number; readonly right: number };
}

/** The ASIDE, anchored under the control at the END edge. No scrim: nothing else on the surface is covered. */
export function ReplayEntryMenu({ controller, language, insets }: ReplayEntryMenuProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const palette = usePalette();
  const copy = replayEntryCopy(language);
  const open = state.menu !== null;

  useEffect(() => {
    if (!open) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      controller.closeMenu();
      return true;
    });
    return () => subscription.remove();
  }, [controller, open]);

  if (state.menu === null) return null;
  const end = oppositeSide(readerSide(language));
  const writing = readerDirection(language);
  const draft = state.menu.savedDraft;
  const item = (label: string, choice: 'WHOLE' | 'PART' | 'SAVED_DRAFT', testID: string) => (
    <Control palette={palette} language={language} accessibilityLabel={label} onPress={() => controller.choose(choice)} testID={testID} style={{ paddingHorizontal: 14 }}>
      <Text style={{ ...typeStyle('action'), color: palette.primary, writingDirection: writing, textAlign: readerSide(language) }}>{label}</Text>
    </Control>
  );
  return (
    <View
      testID="qandeel-replay-menu"
      accessibilityLanguage={language}
      style={{
        position: 'absolute',
        top: insets.top + CONVERSATION_HEADER_MIN_HEIGHT,
        ...(end === 'left' ? { left: insets.left + 10 } : { right: insets.right + 10 }),
        minWidth: MENU_MIN_WIDTH,
        paddingVertical: 6,
        borderRadius: MENU_RADIUS,
        backgroundColor: palette.field,
        borderWidth: 1,
        borderColor: palette.tertiary,
      }}
    >
      {item(copy.whole, 'WHOLE', 'qandeel-replay-choose-whole')}
      {item(copy.part, 'PART', 'qandeel-replay-choose-part')}
      {draft !== 'LOADING' && draft !== null ? item(copy.savedDraft, 'SAVED_DRAFT', 'qandeel-replay-choose-saved-draft') : null}
    </View>
  );
}

export interface ReplaySelectionBarProps {
  readonly controller: ReplayEntryController;
  readonly selection: ReplaySelectionState;
  readonly language: ChromeLanguage;
  readonly insets: { readonly left: number; readonly right: number; readonly bottom: number };
}

/** The selection mode's bar, where the composer stands: what is chosen, Cancel, then the one primary action. */
export function ReplaySelectionBar({ controller, selection, language, insets }: ReplaySelectionBarProps) {
  const palette = usePalette();
  const copy = replayEntryCopy(language);
  const writing = readerDirection(language);
  const saving = selection.command?.phase === 'SAVING';
  const unconfirmed = selection.command?.phase === 'UNCONFIRMED';
  const canSave = selection.command === null && selection.range !== null;

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      controller.cancel();
      return true;
    });
    return () => subscription.remove();
  }, [controller]);

  const problem = selection.problem === 'CHANGED' ? copy.changed
    : selection.problem === 'NOT_PROVABLE' ? copy.notProvable
    : selection.problem === 'UNCONFIRMED' ? copy.unconfirmed
    : selection.problem === 'FAILED' ? copy.failed
    : null;
  const what = selection.range !== null ? copy.count(selection.range.messageCount) : selection.scope === 'PART' ? copy.pickHint : null;
  const primaryLabel = unconfirmed ? copy.tryAgain : copy.save;
  const primaryEnabled = unconfirmed || canSave;

  return (
    <View
      testID="qandeel-replay-selection-bar"
      accessibilityLanguage={language}
      style={{
        direction: writing,
        backgroundColor: palette.field,
        paddingTop: 10,
        paddingBottom: insets.bottom + 10,
        paddingStart: (writing === 'rtl' ? insets.right : insets.left) + 20,
        paddingEnd: (writing === 'rtl' ? insets.left : insets.right) + 10,
      }}
    >
      {selection.range !== null && selection.range.reachesOpenHead ? (
        <Text testID="qandeel-replay-open-head" style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing, paddingBottom: 4 }}>
          {copy.openHead}
        </Text>
      ) : null}
      {problem === null ? null : (
        <Text testID="qandeel-replay-problem" accessibilityLiveRegion="polite" style={{ ...typeStyle('supporting'), color: palette.error, writingDirection: writing, paddingBottom: 4 }}>
          {problem}
        </Text>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 8 }}>
        <Text testID="qandeel-replay-selection-what" accessibilityLiveRegion="polite" style={{ flex: 1, ...typeStyle('supporting'), color: palette.tertiary, writingDirection: writing }}>
          {what ?? ''}
        </Text>
        <Control
          palette={palette}
          language={language}
          accessibilityLabel={copy.cancel}
          accessibilityState={{ disabled: saving }}
          onPress={controller.cancel}
          testID="qandeel-replay-cancel"
          style={{ paddingHorizontal: 10, opacity: saving ? BUSY_OPACITY : 1 }}
        >
          <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: writing }}>{copy.cancel}</Text>
        </Control>
        <Control
          palette={palette}
          language={language}
          accessibilityLabel={primaryLabel}
          accessibilityState={{ busy: saving, disabled: !primaryEnabled }}
          onPress={unconfirmed ? controller.retry : controller.save}
          testID={unconfirmed ? 'qandeel-replay-try-again' : 'qandeel-replay-save'}
          style={{ paddingHorizontal: 10, opacity: primaryEnabled ? 1 : BUSY_OPACITY }}
        >
          <Text style={{ ...typeStyle('action'), color: palette.primary, writingDirection: writing }}>{primaryLabel}</Text>
        </Control>
      </View>
    </View>
  );
}

/**
 * The selection mode handed to `ConversationSurface`, derived from the controller's state and the conversation's
 * displayed messages; `null` while no selection is on. It holds no state of its own.
 */
export function useReplaySelection(
  controller: ReplayEntryController,
  conversation: ConversationReading,
  language: ChromeLanguage,
  insets: { readonly left: number; readonly right: number; readonly bottom: number },
): ConversationSelection | null {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const exchanges = useSyncExternalStore(conversation.subscribe, () => conversation.getState().exchanges);
  const copy = replayEntryCopy(language);
  const selection = state.selection;
  return useMemo(() => {
    if (selection === null) return null;
    const proof = typeof selection.proof === 'object' ? selection.proof : null;
    const marks = proof === null
      ? new Map<string, ConversationSelectionMark>()
      : selectionMarks(proof, displayedMessageIds(exchanges), selection.scope === 'WHOLE'
        ? { kind: 'WHOLE' }
        : { kind: 'PART', firstId: selection.firstId, lastId: selection.lastId });
    return Object.freeze({
      title: selection.scope === 'WHOLE' ? copy.whole : copy.part,
      interactive: selection.scope === 'PART' && selection.command === null && proof !== null,
      markOf: (id: string) => marks.get(id.toLowerCase()) ?? null,
      onToggle: (id: string) => controller.toggle(id),
      bar: <ReplaySelectionBar controller={controller} selection={selection} language={language} insets={insets} />,
    });
  }, [controller, copy, exchanges, insets, language, selection]);
}

export interface ReplayNoticeLineProps {
  readonly controller: ReplayEntryController;
  readonly language: ChromeLanguage;
  readonly insets: { readonly left: number; readonly right: number };
  /** S7-04: the player's one action on a saved draft (its Preview), handed in by the composition. Default: none. */
  readonly action?: ReactNode;
}

/**
 * The one line after a save, or when the gate refused: above the composer, never a dialog. It has no control of its own
 * and so no new word: it goes when the conversation moves on or the entry is opened again. After a save it carries the
 * action the composition hands it (S7-04), and nothing when the gate refused.
 */
export function ReplayNoticeLine({ controller, language, insets, action = null }: ReplayNoticeLineProps) {
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  const palette = usePalette();
  const copy = replayEntryCopy(language);
  if (state.notice === null) return null;
  const writing = readerDirection(language);
  const text = state.notice === 'SAVED_WHOLE' ? copy.savedWhole : state.notice === 'SAVED_PART' ? copy.savedPart : copy.notAvailable;
  const openHead = state.notice !== 'NOT_AVAILABLE' && state.saved !== null && state.saved.reachesOpenHead;
  return (
    <View
      testID="qandeel-replay-notice"
      accessibilityLanguage={language}
      style={{
        direction: writing,
        paddingTop: 8,
        paddingBottom: 4,
        paddingStart: (writing === 'rtl' ? insets.right : insets.left) + 20,
        paddingEnd: (writing === 'rtl' ? insets.left : insets.right) + 10,
      }}
    >
      <View accessible accessibilityLiveRegion="polite">
        <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{text}</Text>
        {openHead ? (
          <Text testID="qandeel-replay-notice-open-head" style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{copy.openHead}</Text>
        ) : null}
      </View>
      {state.notice !== 'NOT_AVAILABLE' && state.saved !== null ? action : null}
    </View>
  );
}
