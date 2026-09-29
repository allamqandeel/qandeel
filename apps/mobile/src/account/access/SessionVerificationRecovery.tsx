/**
 * W2-01 (E2E-A-12) — the Product state for a session that could not be verified.
 *
 * > **Unknown ≠ Signed Out.**
 *
 * It stands over the auth authority's `ERROR` state: the persisted session could not be verified, and
 * nothing proved that it ended. So this surface asks for no credential, shows no Sign in, opens no world
 * and bootstraps nothing — the session stays exactly where it is. It says so in the approved sentence and
 * offers ONE act, "Try again", which asks the authority to re-run the authoritative restore:
 *
 *   restored        -> the authority authenticates; the runtime bootstraps once and replaces this surface
 *   proved ended    -> Sign in, with the session-ended notice
 *   still unknown   -> this surface stays, and the sentence is said again
 *
 * It owns no auth state: the retry is the authority's, one at a time, and a second press joins it.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useConversationTypeface, usePalette } from '../../conversation';
import type { MobileAuthAuthority } from '../../runtime-entry';
import { EntryAction, EntryFrame, EntryText, type EntryLocale } from '../entry/EntryParts';
import { accountAccessCopy } from './copy';

export const SESSION_UNVERIFIED_TEST_ID = 'qandeel-session-unverified';

export interface SessionVerificationRecoveryProps {
  readonly auth: MobileAuthAuthority;
  readonly locale: EntryLocale;
}

export function SessionVerificationRecovery({ auth, locale }: SessionVerificationRecoveryProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const copy = accountAccessCopy(locale.language);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const retry = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    const next = await auth.retrySessionVerification();
    if (!live.current) return;
    inFlight.current = false;
    setBusy(false);
    // Still unknown: nothing changed, so the reader is told again rather than left wondering.
    if (next.kind === 'ERROR') AccessibilityInfo.announceForAccessibility(copy.sessionUnverified);
  }, [auth, copy]);

  const onRetryPress = useCallback(() => {
    void retry();
  }, [retry]);

  return (
    <View testID={SESSION_UNVERIFIED_TEST_ID} style={{ flex: 1, backgroundColor: palette.world }}>
      <StatusBar style="light" />
      {ready ? (
        <EntryFrame locale={locale} testID="qandeel-session-unverified-frame">
          <View accessibilityLiveRegion="polite">
            <EntryText text={copy.sessionUnverified} language={locale.language} tone="primary" testID="qandeel-session-unverified-message" />
          </View>
          <EntryAction label={copy.tryAgain} onPress={onRetryPress} busy={busy} language={locale.language} testID="qandeel-session-unverified-retry" />
        </EntryFrame>
      ) : null}
    </View>
  );
}
