/**
 * W1B-01 — the Auth Gateway destination: Sign in, Create account and Verify Email, as ONE surface.
 *
 * The three are local entry state under the app's one route — never a router stack, a pushed page or
 * a phase of the integration runtime. Moving between them authenticates nobody, creates no Session and
 * writes nothing: only the auth authority's explicit completions (a sign-in, a verified code) do, and
 * the integration runtime then leaves the signed-out phase on its own and replaces this surface.
 *
 * It is a DESTINATION, not the cold start. Whatever precedes the signed-out entry — P4's static launch
 * and, later, the Lantern Gateway Identity Moment (`QAN-BL-LANTERN-01`) — hands off into this component
 * without rebuilding it: nothing here assumes it is the first thing the reader sees.
 *
 * The Sign-in form stays T-14's own, rendered by the caller through `renderSignIn`; this destination
 * only gives it the approved entry into Create account (its footer) and the approved route to Verify
 * Email when the provider reports an unconfirmed Email after checking the password.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { useConversationTypeface, usePalette } from '../../conversation';
import type { MobileAuthAuthority } from '../../runtime-entry';
import { accountEntryCopy } from '../copy';
import { CreateAccountForm, type LoginIdAvailability } from './CreateAccountForm';
import { EntryLink, type EntryLocale } from './EntryParts';
import { VerifyEmailForm } from './VerifyEmailForm';

export const ACCOUNT_ENTRY_TEST_ID = 'qandeel-account-entry';

/** What the Sign-in form is given by this destination. */
export interface SignInEntrySlot {
  /** The approved entry into Create account, drawn below the Sign-in form. */
  readonly footer: ReactNode;
  /** The provider validated the password and reported the Email unverified: verify it now. */
  readonly onEmailNotConfirmed: (email: string) => void;
}

export interface AccountEntryProps {
  readonly auth: MobileAuthAuthority;
  readonly loginIds: LoginIdAvailability;
  readonly locale: EntryLocale;
  readonly renderSignIn: (slot: SignInEntrySlot) => ReactNode;
  /** The clock the code's lifetime is judged against. Production passes none. */
  readonly now?: () => number;
}

export type EntryScreen =
  | { readonly kind: 'SIGN_IN' }
  | { readonly kind: 'CREATE_ACCOUNT' }
  | { readonly kind: 'VERIFY_EMAIL'; readonly email: string; readonly codeSentAt: number | null };

export function AccountEntry({ auth, loginIds, locale, renderSignIn, now = Date.now }: AccountEntryProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const copy = accountEntryCopy(locale.language);
  const [screen, setScreen] = useState<EntryScreen>({ kind: 'SIGN_IN' });

  const toSignIn = useCallback(() => setScreen({ kind: 'SIGN_IN' }), []);
  const toCreateAccount = useCallback(() => setScreen({ kind: 'CREATE_ACCOUNT' }), []);
  const onEmailNotConfirmed = useCallback((email: string) => setScreen({ kind: 'VERIFY_EMAIL', email, codeSentAt: null }), []);
  const onCreated = useCallback((email: string) => setScreen({ kind: 'VERIFY_EMAIL', email, codeSentAt: now() }), [now]);

  let content: ReactNode;
  if (!ready) {
    // The faces are bundled and register in a moment; until then the World shows and nothing else, so
    // there is no first frame in a fallback face.
    content = null;
  } else if (screen.kind === 'CREATE_ACCOUNT') {
    content = <CreateAccountForm auth={auth} loginIds={loginIds} locale={locale} onCreated={onCreated} onReturn={toSignIn} />;
  } else if (screen.kind === 'VERIFY_EMAIL') {
    content = <VerifyEmailForm auth={auth} locale={locale} email={screen.email} codeSentAt={screen.codeSentAt} now={now} onReturn={toSignIn} />;
  } else {
    content = renderSignIn({
      footer: <EntryLink label={copy.createAccountTitle} onPress={toCreateAccount} language={locale.language} testID="qandeel-sign-in-create-account" />,
      onEmailNotConfirmed,
    });
  }

  return (
    <View testID={ACCOUNT_ENTRY_TEST_ID} style={{ flex: 1, backgroundColor: palette.world }}>
      {/* G3 K18: the platform status content is light over the Dark World the entry stands on. */}
      <StatusBar style="light" />
      {content}
    </View>
  );
}
