/**
 * W1B-01 (E2E-A-13) — what stands before the reader's world on arrival.
 *
 *   LOADING                      the Dark World and nothing else, for at most `ACCOUNT_READ_WAIT_MS`,
 *                                so a brand-new account never glimpses the Conversation before its
 *                                Welcome;
 *   READY and the Welcome owed   the concise first-use Welcome; its start act completes it and the
 *                                reader's world takes its place — a cut, since no transition for this
 *                                moment is frozen and none is invented;
 *   anything else                the reader's world, unchanged.
 */
import { useSyncExternalStore, type ReactNode } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { usePalette } from '../../conversation';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { AccountController } from '../account-controller';
import { WelcomeSurface } from './WelcomeSurface';

export const FIRST_USE_WAITING_TEST_ID = 'qandeel-first-use-waiting';

export interface FirstUseGateProps {
  readonly account: AccountController;
  readonly language: ChromeLanguage;
  readonly insets: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  readonly children: ReactNode;
}

export function FirstUseGate({ account, language, insets, children }: FirstUseGateProps) {
  const state = useSyncExternalStore(account.subscribe, account.getState);
  const palette = usePalette();
  if (state.status === 'LOADING') {
    return (
      <View testID={FIRST_USE_WAITING_TEST_ID} style={{ flex: 1, backgroundColor: palette.world }}>
        <StatusBar style="light" />
      </View>
    );
  }
  if (state.status === 'READY' && state.welcomePending && state.displayName !== null) {
    return <WelcomeSurface displayName={state.displayName} language={language} insets={insets} onStart={account.completeWelcome} />;
  }
  return <>{children}</>;
}
