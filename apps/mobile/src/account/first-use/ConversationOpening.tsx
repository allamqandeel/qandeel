/**
 * W1B-01 (E2E-A-14, E2E-B-02, E2E-K-02) — QANDEEL's opening line in a genuinely empty Conversation.
 *
 * It is PRESENTATION, never a turn: it is not stored, not sent to a model, not part of the
 * conversation-so-far, and it is shown only while the authoritative history is READ and EMPTY — so no
 * opening can ever appear above a committed turn. Exactly one of the two is chosen, never both:
 *
 *   - the First Conversation Opening, while the account has never committed a turn (the Product Owner's
 *     controlled amendment to I-08A4 §15);
 *   - the normal new-conversation opener (G1.1 §1, P4-C4 `opener`), unchanged, afterwards.
 *
 * With no account Name there is no opening at all: no fallback name is ever invented. It speaks from
 * QANDEEL's side, open on the World with no surface of its own — as every QANDEEL line does (G1.1) —
 * and a screen reader hears it attributed to QANDEEL through W1A-01's approved QANDEEL-turn attribution,
 * with no internal id anywhere.
 */
import { useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';

import { conversationCopy, oppositeSide, readerSide, typeStyle, usePalette } from '../../conversation';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { AccountController } from '../account-controller';
import { firstUseCopy } from '../copy';

export type OpeningKind = 'FIRST' | 'NORMAL';

/** Which opening an account is owed, or none. Pure, so the rule is testable without a surface. */
export function openingFor(state: ReturnType<AccountController['getState']>): { readonly kind: OpeningKind; readonly displayName: string } | null {
  if (state.status !== 'READY' || state.displayName === null) return null;
  return { kind: state.firstConversationOpening ? 'FIRST' : 'NORMAL', displayName: state.displayName };
}

export function ConversationOpening({ account, language }: { readonly account: AccountController; readonly language: ChromeLanguage }) {
  const state = useSyncExternalStore(account.subscribe, account.getState);
  const palette = usePalette();
  const opening = openingFor(state);
  if (opening === null) return null;

  const copy = firstUseCopy(language);
  const lines = opening.kind === 'FIRST' ? copy.firstOpening(opening.displayName) : [copy.normalOpener(opening.displayName)];
  const side = oppositeSide(readerSide(language));
  const writingDirection = language === 'ar' ? 'rtl' : 'ltr';
  // Aligned to its own reading start, inside a block that sits on QANDEEL's side — as W1A's replies are.
  const textAlign = writingDirection === 'rtl' ? 'right' : 'left';
  return (
    <View
      testID={opening.kind === 'FIRST' ? 'qandeel-first-conversation-opening' : 'qandeel-conversation-opener'}
      accessible
      accessibilityLabel={conversationCopy(language).replyTurnName(lines.join(' '))}
      accessibilityLanguage={language}
      style={{ alignSelf: side === 'right' ? 'flex-end' : 'flex-start', marginTop: 16, maxWidth: '88%', rowGap: 10 }}
    >
      {lines.map((line, index) => (
        <Text
          // A line IS its position in the opening.
          key={index}
          style={{ ...typeStyle(index === 0 && lines.length > 1 ? 'statement' : 'body'), color: palette.primary, textAlign, writingDirection }}
        >
          {line}
        </Text>
      ))}
    </View>
  );
}
