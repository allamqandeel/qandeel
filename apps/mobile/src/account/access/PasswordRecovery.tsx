/**
 * W2-01 (E2E-A-11) — in-app password recovery: four bounded steps of the ONE Auth Gateway destination.
 *
 *   Email request -> recovery code -> new password + confirmation -> password changed -> Sign in
 *
 * Each step is local entry state under the one route, like Create account and Verify Email. None of them
 * authenticates anyone:
 *
 *   - the Email request is non-enumerating: an account or none, the reader meets ONE approved result
 *     (and the code step repeats it as its instruction); only a request that never reached the server
 *     shows the network sentence, which says nothing about any account. A resend repeats the same result
 *     and never claims that a code was sent;
 *   - the code is six digits (Arabic-Indic digits read as digits), checked for shape locally and then
 *     verified with recovery semantics by the auth authority, which keeps the temporary recovery authority
 *     in its own memory — this surface never holds it and it never becomes a signed-in state. Wrong and
 *     expired are one provider answer, so neither is claimed, and no device clock is consulted;
 *   - the new password must match its confirmation locally before anything is sent. The provider's own
 *     password rules judge it; there is no second policy here;
 *   - on success the recovery authority is retired and the reader is STILL signed out: "Password
 *     changed." and the way back to Sign in, where they sign in explicitly.
 *
 * Every word comes from `./copy.ts`. Passwords and the code are component state only: never logged,
 * never trimmed or transformed, never persisted.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, type TextInput } from 'react-native';

import type { MobileAuthAuthority } from '../../runtime-entry';
import { EMAIL_CODE_LENGTH, isPlausibleEmail, normalizeEmailCode } from '../entry-rules';
import { EntryAction, EntryField, EntryFrame, EntryLink, EntryMessage, EntryText, EntryTitle, type EntryLocale } from '../entry/EntryParts';
import { accountAccessCopy } from './copy';

export const RECOVERY_REQUEST_TEST_ID = 'qandeel-recovery-request';
export const RECOVERY_CODE_TEST_ID = 'qandeel-recovery-code';
export const RECOVERY_NEW_PASSWORD_TEST_ID = 'qandeel-recovery-new-password';
export const RECOVERY_COMPLETED_TEST_ID = 'qandeel-recovery-completed';
/** The approved recovery code is six digits, exactly as the Email verification code is. */
export const RECOVERY_CODE_LENGTH = EMAIL_CODE_LENGTH;

type Notice = { readonly text: string; readonly tone: 'error' | 'status' } | null;

/**
 * The shared request discipline of every step: one request at a time behind a synchronous ref, a
 * completion after unmount changes nothing, and leaving (the return control or Android Back) is refused
 * while a request is in flight.
 */
function useStepDiscipline(onReturn: () => void) {
  const inFlightRef = useRef(false);
  const liveRef = useRef(true);
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
    };
  }, []);

  const leave = useCallback(() => {
    if (inFlightRef.current) return;
    onReturn();
  }, [onReturn]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      leave();
      return true;
    });
    return () => subscription.remove();
  }, [leave]);

  const say = useCallback((next: Notice) => {
    setNotice(next);
    if (next !== null) AccessibilityInfo.announceForAccessibility(next.text);
  }, []);

  return { inFlightRef, liveRef, notice, setNotice, say, leave };
}

// ---------------------------------------------------------------------------------------------------
// 1. Email request
// ---------------------------------------------------------------------------------------------------

export interface RecoveryRequestFormProps {
  readonly auth: MobileAuthAuthority;
  readonly locale: EntryLocale;
  readonly onRequested: (email: string) => void;
  readonly onReturn: () => void;
}

export function RecoveryRequestForm({ auth, locale, onRequested, onReturn }: RecoveryRequestFormProps) {
  const copy = accountAccessCopy(locale.language);
  const { inFlightRef, liveRef, notice, setNotice, say, leave } = useStepDiscipline(onReturn);
  const [email, setEmail] = useState('');
  const [fieldMessage, setFieldMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailField = useRef<TextInput | null>(null);

  const send = useCallback(async () => {
    if (inFlightRef.current) return;
    const address = email.trim();
    // Email ONLY: a Login ID is not accepted here, and a reader who forgot both recovers by Email.
    if (!isPlausibleEmail(address)) {
      setFieldMessage(copy.invalidEmail);
      AccessibilityInfo.announceForAccessibility(copy.invalidEmail);
      emailField.current?.focus();
      return;
    }
    inFlightRef.current = true;
    setFieldMessage(null);
    setNotice(null);
    setBusy(true);
    const outcome = await auth.requestPasswordRecovery(address);
    if (!liveRef.current) return;
    inFlightRef.current = false;
    setBusy(false);
    // Every answered request is the same result; the code step states it.
    if (outcome.ok) return onRequested(address);
    say({ text: copy.network, tone: 'error' });
  }, [auth, copy, email, inFlightRef, liveRef, onRequested, say, setNotice]);

  const onSendPress = useCallback(() => {
    void send();
  }, [send]);

  return (
    <EntryFrame locale={locale} testID={RECOVERY_REQUEST_TEST_ID}>
      <EntryTitle text={copy.recoveryTitle} language={locale.language} testID="qandeel-recovery-title" />
      <EntryField
        testID="qandeel-recovery-email"
        inputRef={emailField}
        label={copy.emailLabel}
        message={fieldMessage}
        language={locale.language}
        latin
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={onSendPress}
      />
      <EntryAction label={copy.sendCode} onPress={onSendPress} busy={busy} language={locale.language} testID="qandeel-recovery-send" />
      <EntryMessage text={notice?.text ?? null} tone={notice?.tone ?? 'error'} language={locale.language} testID="qandeel-recovery-request-notice" />
      <EntryLink label={copy.backToSignIn} onPress={leave} inert={busy} back language={locale.language} testID="qandeel-recovery-request-return" />
    </EntryFrame>
  );
}

// ---------------------------------------------------------------------------------------------------
// 2. Recovery code
// ---------------------------------------------------------------------------------------------------

export interface RecoveryCodeFormProps {
  readonly auth: MobileAuthAuthority;
  readonly locale: EntryLocale;
  readonly email: string;
  readonly onVerified: () => void;
  readonly onReturn: () => void;
}

export function RecoveryCodeForm({ auth, locale, email, onVerified, onReturn }: RecoveryCodeFormProps) {
  const copy = accountAccessCopy(locale.language);
  const { inFlightRef, liveRef, notice, setNotice, say, leave } = useStepDiscipline(onReturn);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'VERIFYING' | 'RESENDING' | null>(null);

  const verify = useCallback(async () => {
    if (inFlightRef.current) return;
    // Fewer than six digits is the one thing the entry can prove — and it proves an incomplete code,
    // not an incorrect one.
    if (code.length !== RECOVERY_CODE_LENGTH) {
      say({ text: copy.codeShape, tone: 'error' });
      return;
    }
    inFlightRef.current = true;
    setBusy('VERIFYING');
    setNotice(null);
    const outcome = await auth.verifyRecoveryCode(email, code);
    if (!liveRef.current) return;
    inFlightRef.current = false;
    setBusy(null);
    if (outcome.ok) return onVerified();
    switch (outcome.failure.kind) {
      // Wrong or expired — the provider does not say which, so neither is claimed.
      case 'CODE_REJECTED':
      case 'UNEXPECTED':
        return say({ text: copy.codeRejected, tone: 'error' });
      case 'NETWORK':
        return say({ text: copy.network, tone: 'error' });
      default: {
        const exhaustive: never = outcome.failure.kind;
        return exhaustive;
      }
    }
  }, [auth, code, copy, email, inFlightRef, liveRef, onVerified, say, setNotice]);

  const resend = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy('RESENDING');
    setNotice(null);
    const outcome = await auth.requestPasswordRecovery(email);
    if (!liveRef.current) return;
    inFlightRef.current = false;
    setBusy(null);
    // The same non-enumerating result as the first request — never "a new code was sent".
    say(outcome.ok ? { text: copy.recoveryRequested, tone: 'status' } : { text: copy.network, tone: 'error' });
  }, [auth, copy, email, inFlightRef, liveRef, say, setNotice]);

  const onVerifyPress = useCallback(() => {
    void verify();
  }, [verify]);
  const onResendPress = useCallback(() => {
    void resend();
  }, [resend]);

  return (
    <EntryFrame locale={locale} testID={RECOVERY_CODE_TEST_ID}>
      <EntryTitle text={copy.recoveryTitle} language={locale.language} testID="qandeel-recovery-code-title" />
      <EntryText text={copy.recoveryRequested} language={locale.language} testID="qandeel-recovery-code-instruction" />
      <EntryField
        testID="qandeel-recovery-code-field"
        label={copy.codeLabel}
        language={locale.language}
        latin
        value={code}
        onChangeText={(typed) => setCode(normalizeEmailCode(typed))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={onVerifyPress}
      />
      <EntryAction label={copy.continueAction} onPress={onVerifyPress} busy={busy === 'VERIFYING'} language={locale.language} testID="qandeel-recovery-code-submit" />
      <EntryMessage text={notice?.text ?? null} tone={notice?.tone ?? 'error'} language={locale.language} testID="qandeel-recovery-code-notice" />
      <EntryLink label={copy.resendAction} onPress={onResendPress} inert={busy !== null} language={locale.language} testID="qandeel-recovery-code-resend" />
      <EntryLink label={copy.backToSignIn} onPress={leave} inert={busy !== null} back language={locale.language} testID="qandeel-recovery-code-return" />
    </EntryFrame>
  );
}

// ---------------------------------------------------------------------------------------------------
// 3. New password
// ---------------------------------------------------------------------------------------------------

export interface NewPasswordFormProps {
  readonly auth: MobileAuthAuthority;
  readonly locale: EntryLocale;
  readonly onChanged: () => void;
  readonly onReturn: () => void;
}

export function NewPasswordForm({ auth, locale, onChanged, onReturn }: NewPasswordFormProps) {
  const copy = accountAccessCopy(locale.language);
  const { inFlightRef, liveRef, notice, setNotice, say, leave } = useStepDiscipline(onReturn);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [messages, setMessages] = useState<{ readonly password: string | null; readonly confirmation: string | null }>({ password: null, confirmation: null });
  const [busy, setBusy] = useState(false);
  const passwordField = useRef<TextInput | null>(null);
  const confirmationField = useRef<TextInput | null>(null);

  const change = useCallback(async () => {
    if (inFlightRef.current) return;
    // Local judgement only for what CANNOT succeed: an empty password, and two entries that differ.
    if (password === '') {
      setMessages({ password: copy.passwordRejected, confirmation: null });
      AccessibilityInfo.announceForAccessibility(copy.passwordRejected);
      passwordField.current?.focus();
      return;
    }
    if (confirmation !== password) {
      setMessages({ password: null, confirmation: copy.passwordMismatch });
      AccessibilityInfo.announceForAccessibility(copy.passwordMismatch);
      confirmationField.current?.focus();
      return;
    }
    inFlightRef.current = true;
    setMessages({ password: null, confirmation: null });
    setNotice(null);
    setBusy(true);
    const outcome = await auth.completePasswordRecovery(password);
    if (!liveRef.current) return;
    inFlightRef.current = false;
    setBusy(false);
    if (outcome.ok) return onChanged();
    switch (outcome.failure.kind) {
      case 'WEAK_PASSWORD':
        setMessages({ password: copy.passwordRejected, confirmation: null });
        AccessibilityInfo.announceForAccessibility(copy.passwordRejected);
        return;
      case 'NETWORK':
        return say({ text: copy.network, tone: 'error' });
      case 'UNEXPECTED':
        return say({ text: copy.updateFailed, tone: 'error' });
      default: {
        const exhaustive: never = outcome.failure.kind;
        return exhaustive;
      }
    }
  }, [auth, confirmation, copy, inFlightRef, liveRef, onChanged, password, say, setNotice]);

  const onChangePress = useCallback(() => {
    void change();
  }, [change]);
  const focusConfirmation = useCallback(() => {
    confirmationField.current?.focus();
  }, []);

  return (
    <EntryFrame locale={locale} testID={RECOVERY_NEW_PASSWORD_TEST_ID}>
      <EntryTitle text={copy.recoveryTitle} language={locale.language} testID="qandeel-recovery-new-password-title" />
      <EntryField
        testID="qandeel-recovery-new-password-field"
        inputRef={passwordField}
        label={copy.newPasswordLabel}
        message={messages.password}
        language={locale.language}
        latin
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={focusConfirmation}
        submitBehavior="submit"
      />
      <EntryField
        testID="qandeel-recovery-confirm-password-field"
        inputRef={confirmationField}
        label={copy.confirmPasswordLabel}
        message={messages.confirmation}
        language={locale.language}
        latin
        value={confirmation}
        onChangeText={setConfirmation}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={onChangePress}
      />
      <EntryAction label={copy.changePassword} onPress={onChangePress} busy={busy} language={locale.language} testID="qandeel-recovery-change-submit" />
      <EntryMessage text={notice?.text ?? null} tone={notice?.tone ?? 'error'} language={locale.language} testID="qandeel-recovery-new-password-notice" />
      <EntryLink label={copy.backToSignIn} onPress={leave} inert={busy} back language={locale.language} testID="qandeel-recovery-new-password-return" />
    </EntryFrame>
  );
}

// ---------------------------------------------------------------------------------------------------
// 4. Password changed
// ---------------------------------------------------------------------------------------------------

export interface RecoveryCompletedProps {
  readonly locale: EntryLocale;
  readonly onReturn: () => void;
}

/** The reader is signed out here. The only way on is the explicit way back to Sign in. */
export function RecoveryCompleted({ locale, onReturn }: RecoveryCompletedProps) {
  const copy = accountAccessCopy(locale.language);
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(copy.passwordChanged);
  }, [copy]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onReturn();
      return true;
    });
    return () => subscription.remove();
  }, [onReturn]);
  return (
    <EntryFrame locale={locale} testID={RECOVERY_COMPLETED_TEST_ID}>
      <EntryTitle text={copy.passwordChanged} language={locale.language} testID="qandeel-recovery-completed-title" />
      <EntryAction label={copy.backToSignIn} onPress={onReturn} busy={false} language={locale.language} testID="qandeel-recovery-completed-return" />
    </EntryFrame>
  );
}
