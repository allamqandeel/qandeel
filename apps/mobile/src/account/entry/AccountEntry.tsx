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
 *
 * W2-01 adds password recovery as four more bounded local states of the same destination (`../access`)
 * and gives the Sign-in form its recovery entry (`passwordAssist`) and, when the auth owner has evidence
 * that the reader's session ended, the notice that says so — until the reader moves on from Sign in.
 * Recovery authenticates nobody: it ends on "Password changed." and returns here, to Sign in.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { AppearanceStatusBar } from '../../appearance';

import { useConversationTypeface, usePalette } from '../../conversation';
import { isEmailIdentifier, type EmailVerificationTarget, type MobileAuthAuthority } from '../../runtime-entry';
import { accountAccessCopy } from '../access/copy';
import { NewPasswordForm, RecoveryCodeForm, RecoveryCompleted, RecoveryRequestForm } from '../access/PasswordRecovery';
import { accountEntryCopy } from '../copy';
import { CreateAccountForm, type LoginIdAvailability } from './CreateAccountForm';
import { EntryLink, type EntryLocale } from './EntryParts';
import { VerifyEmailForm } from './VerifyEmailForm';

export const ACCOUNT_ENTRY_TEST_ID = 'qandeel-account-entry';

/** What the Sign-in form is given by this destination. */
export interface SignInEntrySlot {
  /** The approved entry into Create account, drawn below the Sign-in form. */
  readonly footer: ReactNode;
  /**
   * The provider validated the password and reported the Email unverified: verify it now. Handed the
   * identifier the reader typed. W2-01 R1: a Login ID stays a Login ID — its Email never reaches the device.
   */
  readonly onEmailNotConfirmed: (identifier: string) => void;
  /** W2-01 — the approved entry into password recovery, drawn below the password field. */
  readonly passwordAssist: ReactNode;
  /** W2-01 — the reader's session ended (auth-owner evidence) and they have not yet moved on from Sign in. */
  readonly sessionEnded: boolean;
}

export interface AccountEntryProps {
  readonly auth: MobileAuthAuthority;
  readonly loginIds: LoginIdAvailability;
  readonly locale: EntryLocale;
  readonly renderSignIn: (slot: SignInEntrySlot) => ReactNode;
  /** W2-01 — from the auth owner's `SIGNED_OUT` state. Never inferred here. */
  readonly sessionEnded?: boolean;
}

export type EntryScreen =
  | { readonly kind: 'SIGN_IN' }
  | { readonly kind: 'CREATE_ACCOUNT' }
  // W2-01 R1 — an Email the reader typed, or a Login ID whose Email stays on the server.
  | { readonly kind: 'VERIFY_EMAIL'; readonly target: EmailVerificationTarget }
  // W2-01 — password recovery. The temporary recovery authority is the auth owner's, never in this state.
  | { readonly kind: 'RECOVERY_REQUEST' }
  | { readonly kind: 'RECOVERY_CODE'; readonly email: string }
  | { readonly kind: 'RECOVERY_NEW_PASSWORD' }
  | { readonly kind: 'RECOVERY_COMPLETED' };

export function AccountEntry({ auth, loginIds, locale, renderSignIn, sessionEnded = false }: AccountEntryProps) {
  const ready = useConversationTypeface();
  const palette = usePalette();
  const copy = accountEntryCopy(locale.language);
  const access = accountAccessCopy(locale.language);
  const [screen, setScreen] = useState<EntryScreen>({ kind: 'SIGN_IN' });
  /** The ended-session notice belongs to the reader's arrival; once they move on from Sign in it is spent. */
  const [movedOn, setMovedOn] = useState(false);

  const go = useCallback((next: EntryScreen) => {
    if (next.kind !== 'SIGN_IN') setMovedOn(true);
    setScreen(next);
  }, []);
  const toSignIn = useCallback(() => go({ kind: 'SIGN_IN' }), [go]);
  const toCreateAccount = useCallback(() => go({ kind: 'CREATE_ACCOUNT' }), [go]);
  const toVerifyEmail = useCallback((email: string) => go({ kind: 'VERIFY_EMAIL', target: { via: 'EMAIL', email } }), [go]);
  /** Classified by the auth authority's own rule — the same one that routed the credential. */
  const toVerifyAfterSignIn = useCallback(
    (identifier: string) => go({ kind: 'VERIFY_EMAIL', target: isEmailIdentifier(identifier) ? { via: 'EMAIL', email: identifier } : { via: 'LOGIN_ID', loginId: identifier } }),
    [go],
  );
  const toRecovery = useCallback(() => go({ kind: 'RECOVERY_REQUEST' }), [go]);
  const toRecoveryCode = useCallback((email: string) => go({ kind: 'RECOVERY_CODE', email }), [go]);
  const toNewPassword = useCallback(() => go({ kind: 'RECOVERY_NEW_PASSWORD' }), [go]);
  const toRecoveryCompleted = useCallback(() => go({ kind: 'RECOVERY_COMPLETED' }), [go]);
  /** Leaving recovery before it completed retires the held recovery authority at once. */
  const leaveRecovery = useCallback(() => {
    auth.abandonPasswordRecovery();
    go({ kind: 'SIGN_IN' });
  }, [auth, go]);

  let content: ReactNode;
  if (!ready) {
    // The faces are bundled and register in a moment; until then the World shows and nothing else, so
    // there is no first frame in a fallback face.
    content = null;
  } else if (screen.kind === 'CREATE_ACCOUNT') {
    content = <CreateAccountForm auth={auth} loginIds={loginIds} locale={locale} onCreated={toVerifyEmail} onReturn={toSignIn} />;
  } else if (screen.kind === 'VERIFY_EMAIL') {
    content = <VerifyEmailForm auth={auth} locale={locale} target={screen.target} onReturn={toSignIn} />;
  } else if (screen.kind === 'RECOVERY_REQUEST') {
    content = <RecoveryRequestForm auth={auth} locale={locale} onRequested={toRecoveryCode} onReturn={leaveRecovery} />;
  } else if (screen.kind === 'RECOVERY_CODE') {
    content = <RecoveryCodeForm auth={auth} locale={locale} email={screen.email} onVerified={toNewPassword} onReturn={leaveRecovery} />;
  } else if (screen.kind === 'RECOVERY_NEW_PASSWORD') {
    content = <NewPasswordForm auth={auth} locale={locale} onChanged={toRecoveryCompleted} onReturn={leaveRecovery} />;
  } else if (screen.kind === 'RECOVERY_COMPLETED') {
    content = <RecoveryCompleted locale={locale} onReturn={toSignIn} />;
  } else {
    content = renderSignIn({
      footer: <EntryLink label={copy.createAccountTitle} onPress={toCreateAccount} language={locale.language} testID="qandeel-sign-in-create-account" />,
      onEmailNotConfirmed: toVerifyAfterSignIn,
      passwordAssist: <EntryLink label={access.forgotPassword} onPress={toRecovery} language={locale.language} testID="qandeel-sign-in-forgot-password" />,
      sessionEnded: sessionEnded && !movedOn,
    });
  }

  return (
    <View testID={ACCOUNT_ENTRY_TEST_ID} style={{ flex: 1, backgroundColor: palette.world }}>
      {/* G3 K18: the platform status content is light over the Dark World the entry stands on. */}
      <AppearanceStatusBar />
      {content}
    </View>
  );
}
