/**
 * S8A-05 CP2 — «شارك في العالم العام» / Share in Public World: the entry in the Personal row, the selection's bar where the
 * composer stands, and the selection handed to `ConversationSurface` — the conversation's own messages, chosen one by
 * one (a contiguous part, separate whole messages, or the whole conversation). The composer's words are untouched and
 * return with it.
 *
 * Every word is `../public-compose/source-copy`'s (the S8A-05 CP2 Copy Gate) or an approved word it reuses. Nothing here
 * holds selection state: the controller does, by message id.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { BackHandler, Text, View } from 'react-native';

import { Control, readerDirection, typeStyle, usePalette, type ConversationSelection, type ConversationSelectionMark } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import { publicComposeCopy } from '../public-compose/copy';
import { isSourceReadiness, publicSourceCopy } from '../public-compose/source-copy';
import type { ConversationExchangeView } from '../runtime-entry';
import { displayedMessageIds, type PublicShareController, type PublicShareState } from './public-share-controller';

const BUSY_OPACITY = 0.6;

interface ConversationReading {
  getState(): { readonly exchanges: readonly ConversationExchangeView[] };
  subscribe(listener: () => void): () => void;
}

export interface PublicShareEntryProps {
  readonly controller: PublicShareController;
  readonly language: ChromeLanguage;
}

/** The entry: one quiet text action in the Personal row, like the Introductions entry beside it. */
export function PublicShareEntry({ controller, language }: PublicShareEntryProps) {
  const palette = usePalette();
  const copy = publicSourceCopy(language);
  return (
    <Control palette={palette} language={language} accessibilityLabel={copy.shareEntry} onPress={controller.open} testID="qandeel-public-share-entry"
      style={{ paddingHorizontal: 12 }}>
      <Text style={{ ...typeStyle('action'), color: palette.restInk, writingDirection: readerDirection(language) }}>{copy.shareEntry}</Text>
    </Control>
  );
}

export interface PublicShareBarProps {
  readonly controller: PublicShareController;
  readonly state: PublicShareState;
  readonly language: ChromeLanguage;
  readonly insets: { readonly left: number; readonly right: number; readonly bottom: number };
}

/** The selection's bar: the hint or the problem, the whole conversation, Cancel, then Continue. */
export function PublicShareBar({ controller, state, language, insets }: PublicShareBarProps) {
  const palette = usePalette();
  const copy = publicSourceCopy(language);
  const compose = publicComposeCopy(language);
  const writing = readerDirection(language);
  const proven = typeof state.proof === 'object' && state.proof !== null;
  const canContinue = proven && !state.busy && state.chosen.size > 0;

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      controller.cancel();
      return true;
    });
    return () => subscription.remove();
  }, [controller]);

  const refusal = state.refusal;
  const problem = state.problem === 'NOTHING' ? copy.shareNothing
    : state.problem === 'UNPROVABLE' ? copy.shareUnprovable
    : state.problem === 'REFUSED' && refusal !== null
      ? (refusal === 'LIMIT_REACHED' ? compose.limitReached : refusal === 'ACCOUNT_DELETION_PENDING' ? compose.deletionPending
        : isSourceReadiness(refusal as never) ? copy.readiness(refusal as never) : compose.actionUnavailable)
    : state.problem !== null ? compose.actionUnavailable
    : null;
  const action = (label: string, onPress: () => void, enabled: boolean, testID: string, primary = false) => (
    <Control palette={palette} language={language} accessibilityLabel={label} accessibilityState={{ disabled: !enabled, busy: primary && state.busy }}
      onPress={onPress} testID={testID} style={{ paddingHorizontal: 10, opacity: enabled ? 1 : BUSY_OPACITY }}>
      <Text style={{ ...typeStyle('action'), color: primary ? palette.primary : palette.restInk, writingDirection: writing }}>{label}</Text>
    </Control>
  );

  return (
    <View
      testID="qandeel-public-share-bar"
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
      {problem === null ? null : (
        <Text testID="qandeel-public-share-problem" accessibilityLiveRegion="polite"
          style={{ ...typeStyle('supporting'), color: palette.error, writingDirection: writing, paddingBottom: 4 }}>
          {problem}
        </Text>
      )}
      <Text testID="qandeel-public-share-hint" style={{ ...typeStyle('supporting'), color: palette.tertiary, writingDirection: writing, paddingBottom: 4 }}>
        {copy.shareHint}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 8 }}>
        <View style={{ flex: 1 }}>{action(copy.shareWhole, controller.chooseWhole, proven && !state.busy, 'qandeel-public-share-whole')}</View>
        {action(copy.shareCancel, controller.cancel, !state.busy, 'qandeel-public-share-cancel')}
        {action(copy.shareContinue, controller.proceed, canContinue, 'qandeel-public-share-continue', true)}
      </View>
    </View>
  );
}

/**
 * The selection mode handed to `ConversationSurface`, derived from the controller's state and the conversation's
 * displayed messages; `null` while nothing is being chosen. Chosen messages are IN, joined to a chosen neighbour; a
 * message that is not provable is NONE and cannot be chosen.
 */
export function usePublicShareSelection(
  controller: PublicShareController | null,
  conversation: ConversationReading,
  language: ChromeLanguage,
  insets: { readonly left: number; readonly right: number; readonly bottom: number },
): ConversationSelection | null {
  const closed = useMemo(() => ({ getState: () => null, subscribe: () => () => undefined }), []);
  const state = useSyncExternalStore(controller?.subscribe ?? closed.subscribe, controller?.getState ?? closed.getState);
  const exchanges = useSyncExternalStore(conversation.subscribe, () => conversation.getState().exchanges);
  const copy = publicSourceCopy(language);
  return useMemo(() => {
    if (controller === null || state === null || !state.selecting) return null;
    const proof = typeof state.proof === 'object' ? state.proof : null;
    const displayed = displayedMessageIds(exchanges);
    const marks = new Map<string, ConversationSelectionMark>();
    const chosen = (i: number) => i >= 0 && i < displayed.length && proof !== null && proof.blocks.has(displayed[i]) && state.chosen.has(displayed[i]);
    displayed.forEach((id, i) => {
      const anchored = proof !== null && proof.blocks.has(id);
      const mark = !anchored ? 'NONE' : state.chosen.has(id) ? 'IN' : 'OUT';
      marks.set(id, Object.freeze({ mark, joinAbove: mark === 'IN' && chosen(i - 1), joinBelow: mark === 'IN' && chosen(i + 1) }));
    });
    return Object.freeze({
      title: copy.shareTitle,
      interactive: proof !== null && !state.busy,
      markOf: (id: string) => marks.get(id.toLowerCase()) ?? null,
      onToggle: (id: string) => controller.toggle(id),
      bar: <PublicShareBar controller={controller} state={state} language={language} insets={insets} />,
    });
  }, [controller, copy, exchanges, insets, language, state]);
}
