/**
 * S8B-07 CP1-B (Sheet B, B1a – B1c; Copy Gate R1.1 RA-13 / RA-16) — a voice turn of several committed units in the Replay
 * selection. The selection itself is unchanged: S7-02 already makes a turn ONE message with ONE mark (`replay-anchors.ts`:
 * all of a turn's units, or none; there is no per-unit control). What this adds is only its words:
 *
 *   - RA-16, the hint of that one mark (accessibility only): the passage is selected as a whole;
 *   - RA-13 under it, with the passage's length, only where the server gave the length (a Voice Note's own duration).
 *
 * A voice turn is one the server marks as spoken: a Voice Note's turn (`voiceNote`), or an exchange of a live call
 * (`deliveryState`, present only for a reply spoken in a call, whose turn was spoken too). A turn of one unit, a text
 * turn, or a turn the proof does not hold carries nothing. Nothing here is logged, and nothing is inferred from text.
 */
import { useMemo, useSyncExternalStore } from 'react';

import type { ConversationSelection, ConversationSelectionMark } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome/types';
import type { ReplayEntryController } from '../replay-entry';
import type { ConversationExchangeView } from '../runtime-entry';
import { originalAudioLengthText, originalAudioText } from './original-audio-copy';

/** The words a message carries in the mode: the hint always, the line only with a length. */
export interface VoicePassageWords {
  readonly hint: string;
  readonly beneath?: string;
}

/** Turn id (lower case) → the units it holds, from the S7-02 anchor proof. */
export type UnitCounts = ReadonlyMap<string, number>;

/** Pure: each multi-unit voice message of the displayed exchanges, with its words. */
export function voicePassages(exchanges: readonly ConversationExchangeView[], units: UnitCounts, language: ChromeLanguage): ReadonlyMap<string, VoicePassageWords> {
  const out = new Map<string, VoicePassageWords>();
  const add = (id: string, lengthMs: number | null) => {
    const turn = id.toLowerCase();
    if ((units.get(turn) ?? 0) < 2) return;
    out.set(turn, Object.freeze({
      hint: originalAudioText('RA-16', language),
      ...(lengthMs === null || lengthMs <= 0 ? {} : { beneath: originalAudioLengthText('RA-13', language, lengthMs) }),
    }));
  };
  for (const exchange of exchanges) {
    const spoken = exchange.deliveryState !== undefined;
    if (exchange.voiceNote !== undefined) add(exchange.userTurn.id, exchange.voiceNote.durationMs);
    else if (spoken) add(exchange.userTurn.id, null);
    if (spoken && exchange.reply !== null) add(exchange.reply.id, null);
  }
  return out;
}

/** The selection with the voice passages' words on their marks; the same selection when there are none. */
export function withVoicePassages(selection: ConversationSelection | null, passages: ReadonlyMap<string, VoicePassageWords>): ConversationSelection | null {
  if (selection === null || passages.size === 0) return selection;
  return Object.freeze({
    ...selection,
    markOf(id: string): ConversationSelectionMark | null {
      const mark = selection.markOf(id);
      const words = passages.get(id.toLowerCase());
      return mark === null || words === undefined || mark.mark === 'NONE' ? mark : Object.freeze({ ...mark, ...words });
    },
  });
}

/** The composition's hook: the Replay selection, worded for its multi-unit voice turns. */
export function useVoicePassageSelection(
  selection: ConversationSelection | null,
  entry: ReplayEntryController,
  conversation: { subscribe(listener: () => void): () => void; getState(): { readonly exchanges: readonly ConversationExchangeView[] } },
  language: ChromeLanguage,
): ConversationSelection | null {
  const state = useSyncExternalStore(entry.subscribe, entry.getState);
  const exchanges = useSyncExternalStore(conversation.subscribe, () => conversation.getState().exchanges);
  const proof = state.selection !== null && typeof state.selection.proof === 'object' ? state.selection.proof : null;
  return useMemo(() => {
    if (selection === null || proof === null) return selection;
    const units = new Map<string, number>();
    for (const [turn, block] of proof.blocks) units.set(turn, block.lastSp - block.firstSp + 1);
    return withVoicePassages(selection, voicePassages(exchanges, units, language));
  }, [selection, proof, exchanges, language]);
}
