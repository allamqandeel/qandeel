/**
 * W1B-01 (E2E-A-09) — Create account: exactly Name, Login ID, Email and Password (P1 §4), nothing else.
 *
 * It owns one request state and the approved words for what can go wrong, and nothing more. The
 * account is created by the ONE auth authority, whose sign-up authenticates nobody: success hands the
 * Email to Verify Email, and the reader stays signed out until the code is verified.
 *
 * ## The order of one submission
 *
 *   1. local judgement, in approved words, of fields that CANNOT succeed (empty Name; empty or
 *      malformed Login ID; an implausible Email; an empty password);
 *   2. the Login ID availability question — the one pre-account question, answered with a boolean, so a
 *      taken identifier is reported as unavailable while the Email is never looked up at all;
 *   3. sign-up. The database enforces the same Login ID grammar and uniqueness, so a Login ID taken in
 *      the meantime ends as the generic refusal rather than a claim the entry cannot prove.
 *
 * A second press while a submission is in flight is IGNORED by a synchronous ref, not merely drawn
 * disabled (T-14's reason: two presses in one tick read the same rendered state). The password is
 * component state only; it is never trimmed, transformed, logged or put in a message.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, Platform, type TextInput } from 'react-native';

import type { LoginIdAvailabilityOutcome, MobileAuthAuthority } from '../../runtime-entry';
import { accountEntryCopy } from '../copy';
import { NAME_MAX_LENGTH, LOGIN_ID_MAX_LENGTH, canonicalName, isPlausibleEmail, judgeLoginId } from '../entry-rules';
import { EntryAction, EntryField, EntryFrame, EntryLink, EntryMessage, EntryTitle, type EntryLocale } from './EntryParts';

export const CREATE_ACCOUNT_TEST_ID = 'qandeel-create-account';

export interface LoginIdAvailability {
  check(loginId: string): Promise<LoginIdAvailabilityOutcome>;
}

export interface CreateAccountFormProps {
  readonly auth: MobileAuthAuthority;
  readonly loginIds: LoginIdAvailability;
  readonly locale: EntryLocale;
  /** The account exists and its code was sent: go to Verify Email for this address. */
  readonly onCreated: (email: string) => void;
  /** Back to Sign in. Refused while a submission is in flight. */
  readonly onReturn: () => void;
}

type FieldKey = 'name' | 'loginId' | 'email' | 'password';
type Messages = Partial<Record<FieldKey | 'form', string>>;

export function CreateAccountForm({ auth, loginIds, locale, onCreated, onReturn }: CreateAccountFormProps) {
  const copy = accountEntryCopy(locale.language);
  const [name, setName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [messages, setMessages] = useState<Messages>({});
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const live = useRef(true);
  const nameField = useRef<TextInput | null>(null);
  const loginIdField = useRef<TextInput | null>(null);
  const emailField = useRef<TextInput | null>(null);
  const passwordField = useRef<TextInput | null>(null);

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

  // Android system Back is the same act as the return control, and is refused the same way.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      leave();
      return true;
    });
    return () => subscription.remove();
  }, [leave]);

  /** Show these messages, move focus to the first field that carries one, and say the first aloud. */
  const report = useCallback((next: Messages) => {
    setMessages(next);
    const first = (['name', 'loginId', 'email', 'password', 'form'] as const).find((key) => next[key] !== undefined);
    if (first === undefined) return;
    if (first !== 'form') ({ name: nameField, loginId: loginIdField, email: emailField, password: passwordField })[first].current?.focus();
    AccessibilityInfo.announceForAccessibility(next[first] as string);
  }, []);

  const submit = useCallback(async () => {
    if (inFlight.current) return;

    const judged: Messages = {};
    const nameValue = canonicalName(name);
    if (nameValue === '') judged.name = copy.emptyName;
    const login = judgeLoginId(loginId);
    if (login.kind === 'EMPTY') judged.loginId = copy.emptyLoginId;
    else if (login.kind === 'MALFORMED') judged.loginId = copy.malformedLoginId;
    const address = email.trim();
    if (!isPlausibleEmail(address)) judged.email = copy.invalidEmail;
    // An empty password cannot meet any policy; every other judgement is the provider's own.
    if (password === '') judged.password = copy.passwordRejected;
    if (Object.keys(judged).length > 0 || login.kind !== 'WELL_FORMED') {
      report(judged);
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setMessages({});

    const settle = (next: Messages) => {
      inFlight.current = false;
      setSubmitting(false);
      report(next);
    };

    const availability = await loginIds.check(login.canonical);
    if (!live.current) return;
    if (availability.kind === 'TAKEN') return settle({ loginId: copy.loginIdUnavailable });
    if (availability.kind === 'NETWORK') return settle({ form: copy.network });
    // AVAILABLE, or a check that could not answer: sign-up proceeds and the database decides.

    const created = await auth.signUp(address, password, { name: nameValue, loginId: login.canonical });
    if (!live.current) return;
    if (created.ok) {
      inFlight.current = false;
      onCreated(address);
      return;
    }
    // The KIND only. The provider's detail is never a Product sentence.
    switch (created.failure.kind) {
      case 'INVALID_EMAIL':
        return settle({ email: copy.invalidEmail });
      case 'WEAK_PASSWORD':
        return settle({ password: copy.passwordRejected });
      case 'NETWORK':
        return settle({ form: copy.network });
      case 'REFUSED':
        return settle({ form: copy.accountRefused });
      default: {
        const exhaustive: never = created.failure.kind;
        return exhaustive;
      }
    }
  }, [auth, copy, email, loginId, loginIds, name, onCreated, password, report]);

  const onSubmitPress = useCallback(() => {
    void submit();
  }, [submit]);

  return (
    <EntryFrame locale={locale} testID={CREATE_ACCOUNT_TEST_ID}>
      <EntryTitle text={copy.createAccountTitle} language={locale.language} testID="qandeel-create-account-title" />
      <EntryField
        testID="qandeel-create-account-name"
        label={copy.nameLabel}
        language={locale.language}
        inputRef={nameField}
        value={name}
        onChangeText={setName}
        maxLength={NAME_MAX_LENGTH}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => loginIdField.current?.focus()}
        message={messages.name}
      />
      <EntryField
        testID="qandeel-create-account-login-id"
        label={copy.loginIdLabel}
        help={copy.loginIdHelp}
        language={locale.language}
        latin
        inputRef={loginIdField}
        value={loginId}
        onChangeText={setLoginId}
        maxLength={LOGIN_ID_MAX_LENGTH}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username-new"
        textContentType="username"
        keyboardType={Platform.OS === 'ios' ? 'ascii-capable' : 'default'}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailField.current?.focus()}
        message={messages.loginId}
      />
      <EntryField
        testID="qandeel-create-account-email"
        label={copy.emailLabel}
        language={locale.language}
        latin
        inputRef={emailField}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordField.current?.focus()}
        message={messages.email}
      />
      <EntryField
        testID="qandeel-create-account-password"
        label={copy.passwordLabel}
        language={locale.language}
        latin
        inputRef={passwordField}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={onSubmitPress}
        message={messages.password}
      />
      <EntryAction label={copy.createAccountAction} onPress={onSubmitPress} busy={submitting} language={locale.language} testID="qandeel-create-account-submit" />
      <EntryMessage text={messages.form ?? null} language={locale.language} testID="qandeel-create-account-notice" />
      <EntryLink label={copy.returnFromCreateAccount} onPress={leave} inert={submitting} language={locale.language} testID="qandeel-create-account-return" />
    </EntryFrame>
  );
}
