/**
 * W1B-01 (E2E-A-10, Product Owner decision) — Verify Email with the in-app 6-digit code.
 *
 * Verification is mandatory before QANDEEL: the reader stays here, signed out, until the code verifies.
 * Its success is the ONE explicit completion that establishes the new identity — through the auth
 * authority, never here — and the integration runtime then leaves the signed-out entry on its own.
 *
 *   - the code field keeps digits only (Arabic-Indic digits are read as the same digits), and nothing is
 *     submitted automatically: the reader presses Verify, exactly one request at a time;
 *   - resend has its own bounded in-flight state, never clears the typed code, and replaces the code;
 *   - wrong and expired are told apart only by what the entry truly knows — when the code was sent —
 *     because the provider answers both with one error (see `judgeRejectedCode`);
 *   - leaving (the return control, or Android Back) is refused while a request is in flight, so a
 *     verification the reader walked away from can never land behind them.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler } from 'react-native';

import type { MobileAuthAuthority } from '../../runtime-entry';
import { accountEntryCopy } from '../copy';
import { EMAIL_CODE_LENGTH, judgeRejectedCode, normalizeEmailCode } from '../entry-rules';
import { EntryAction, EntryField, EntryFrame, EntryLink, EntryMessage, EntryText, EntryTitle, type EntryLocale } from './EntryParts';

export const VERIFY_EMAIL_TEST_ID = 'qandeel-verify-email';

export interface VerifyEmailFormProps {
  readonly auth: MobileAuthAuthority;
  readonly locale: EntryLocale;
  readonly email: string;
  /** When the current code was sent, if this entry knows; null when the reader arrived from sign-in. */
  readonly codeSentAt: number | null;
  readonly now: () => number;
  readonly onReturn: () => void;
}

type Notice = { readonly text: string; readonly tone: 'error' | 'status' } | null;

export function VerifyEmailForm({ auth, locale, email, codeSentAt, now, onReturn }: VerifyEmailFormProps) {
  const copy = accountEntryCopy(locale.language);
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<'VERIFYING' | 'RESENDING' | null>(null);
  const inFlight = useRef(false);
  const live = useRef(true);
  const sentAt = useRef<number | null>(codeSentAt);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const leave = useCallback(() => {
    if (inFlight.current) return;
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

  const verify = useCallback(async () => {
    if (inFlight.current) return;
    // Fewer than six digits cannot be the code that was sent.
    if (code.length !== EMAIL_CODE_LENGTH) {
      say({ text: copy.codeIncorrect, tone: 'error' });
      return;
    }
    inFlight.current = true;
    setBusy('VERIFYING');
    setNotice(null);
    const outcome = await auth.verifyEmailCode(email, code);
    if (!live.current) return;
    // FINISHED on success: the authority published the identity and this surface is being replaced.
    if (outcome.ok) return;
    inFlight.current = false;
    setBusy(null);
    switch (outcome.failure.kind) {
      case 'CODE_REJECTED':
        return say({ text: judgeRejectedCode(sentAt.current, now()) === 'EXPIRED' ? copy.codeExpired : copy.codeIncorrect, tone: 'error' });
      case 'NETWORK':
        return say({ text: copy.network, tone: 'error' });
      case 'UNEXPECTED':
        return say({ text: copy.verifyFailed, tone: 'error' });
      default: {
        const exhaustive: never = outcome.failure.kind;
        return exhaustive;
      }
    }
  }, [auth, code, copy, email, now, say]);

  const resend = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy('RESENDING');
    setNotice(null);
    const outcome = await auth.resendEmailCode(email);
    if (!live.current) return;
    inFlight.current = false;
    setBusy(null);
    if (outcome.ok) {
      sentAt.current = now();
      return say({ text: copy.resendSucceeded, tone: 'status' });
    }
    say({ text: outcome.failure.kind === 'NETWORK' ? copy.network : copy.resendFailed, tone: 'error' });
  }, [auth, copy, email, now, say]);

  const onVerifyPress = useCallback(() => {
    void verify();
  }, [verify]);
  const onResendPress = useCallback(() => {
    void resend();
  }, [resend]);

  return (
    <EntryFrame locale={locale} testID={VERIFY_EMAIL_TEST_ID}>
      <EntryTitle text={copy.verifyTitle} language={locale.language} testID="qandeel-verify-email-title" />
      <EntryText text={copy.verifyInstruction(email)} language={locale.language} testID="qandeel-verify-email-instruction" />
      <EntryField
        testID="qandeel-verify-email-code"
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
      <EntryAction label={copy.verifyAction} onPress={onVerifyPress} busy={busy === 'VERIFYING'} language={locale.language} testID="qandeel-verify-email-submit" />
      <EntryMessage text={notice?.text ?? null} tone={notice?.tone ?? 'error'} language={locale.language} testID="qandeel-verify-email-notice" />
      <EntryLink label={copy.resendAction} onPress={onResendPress} inert={busy !== null} language={locale.language} testID="qandeel-verify-email-resend" />
      <EntryLink label={copy.returnFromVerify} onPress={leave} inert={busy !== null} back language={locale.language} testID="qandeel-verify-email-return" />
    </EntryFrame>
  );
}
