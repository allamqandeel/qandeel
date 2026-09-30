/**
 * W3-MEGA-A — the Name, Login ID and Email rows of Account & Identity, the Security & Sign-in group, and their change
 * states, inside the ONE General Settings destination (P1 §8.1; W3-PDG-01 §2–§3). A change is a STATE of this
 * destination — no route, no dialog, no new world — and Settings' Back leaves the change, not Settings.
 *
 *   IdentityRow          a term, the reader's value and, for the Email, its status. Pressable when it opens a change.
 *   ChangeForm           one change: its title first, the current value, the fields, ONE polite live region, and
 *                        the confirm act, refused while one is in flight.
 *   NameChange           the one Name field (no First / Last split).
 *   LoginIdChange        the new Login ID with its persistent help, then the password (appropriate verification).
 *   EmailChange          the password and the new Email; then the code sent to the new Email and the code sent to
 *                        the current one. It changes only when both are confirmed; then the reader is signed out.
 *   PasswordChange       the current password, the new one and its confirmation.
 *
 * Every word comes from `copy.ts`. A Login ID, an Email, a password and a code are Latin content: each field is its
 * own explicit left-to-right context, and a drawn Login ID or Email is an isolated left-to-right run, so it never
 * reorders an Arabic line. Nothing here decides whether a change happened: the controller reports what the server
 * said, or what a fresh read shows. A typed password lives only in this component state — for the Email change, until
 * its code step's resend no longer needs it — and is dropped when the change closes (the state unmounts).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Text, TextInput, View, findNodeHandle, type KeyboardTypeOptions, type TextInputProps } from 'react-native';

import { NAME_MAX_LENGTH, normalizeEmailCode, EMAIL_CODE_LENGTH } from '../account';
import { Control, MIN_TARGET, typeStyle, type ConversationPalette } from '../conversation';
import type { ChromeLanguage } from '../orientation-chrome';
import type { AccountIdentityController } from './account-identity-controller';
import type { AccountIdentityCopy, SecurityCopy } from './copy';

const ROW_START = 24;
const ROW_END = 20;
/** The same dimming every busy act uses (W1B-01, W3-01, W3-02), so "in flight" reads the same everywhere. */
const BUSY_OPACITY = 0.6;
const FIELD_MIN_HEIGHT = 48;
const FIELD_RADIUS = 12;

/** LEFT-TO-RIGHT ISOLATE … POP DIRECTIONAL ISOLATE: Latin content is one run in any paragraph. */
const LRI = String.fromCodePoint(0x2066);
const PDI = String.fromCodePoint(0x2069);
export const isolatedLtr = (value: string): string => `${LRI}${value}${PDI}`;

const writingOf = (language: ChromeLanguage) => (language === 'ar' ? 'rtl' : 'ltr');

// ---------------------------------------------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------------------------------------------

export function IdentityRow({ term, value, ltr, status, language, palette, onOpen, rowRef, testID }: {
  readonly term: string;
  readonly value: string;
  /** Latin content (a Login ID, an Email) is drawn as an isolated left-to-right run. */
  readonly ltr: boolean;
  readonly status?: string;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly onOpen?: () => void;
  readonly rowRef?: (node: View | null) => void;
  readonly testID: string;
}) {
  const writing = writingOf(language);
  const label = [term, value, ...(status === undefined ? [] : [status])].join(', ');
  const content = (
    <View style={{ rowGap: 2 }}>
      <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{term}</Text>
      <Text testID={`${testID}-value`} style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>
        {ltr ? isolatedLtr(value) : value}
      </Text>
      {status === undefined ? null : (
        <Text testID={`${testID}-status`} style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{status}</Text>
      )}
    </View>
  );
  const frame = { minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0 } as const;
  if (onOpen === undefined) {
    return (
      <View ref={rowRef} testID={testID} accessible accessibilityLabel={label} accessibilityLanguage={language} style={{ ...frame, justifyContent: 'center' }}>
        {content}
      </View>
    );
  }
  return (
    <Control palette={palette} language={language} accessibilityLabel={label} onPress={onOpen} testID={testID} controlRef={rowRef} style={frame}>
      {content}
    </Control>
  );
}

/** One act row (Change password, Sign out from other devices), with its own polite result line beneath it. */
export function ActionRow({ label, notice, busy, language, palette, onPress, rowRef, testID }: {
  readonly label: string;
  readonly notice: string | null;
  readonly busy: boolean;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  readonly onPress: () => void;
  readonly rowRef?: (node: View | null) => void;
  readonly testID: string;
}) {
  const writing = writingOf(language);
  return (
    <View>
      <Control
        palette={palette}
        language={language}
        accessibilityLabel={label}
        accessibilityState={{ busy, disabled: busy }}
        onPress={onPress}
        testID={testID}
        controlRef={rowRef}
        style={{ minHeight: MIN_TARGET, paddingVertical: 10, paddingStart: ROW_START, paddingEnd: ROW_END, borderRadius: 0, opacity: busy ? BUSY_OPACITY : 1 }}
      >
        <Text style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>{label}</Text>
      </Control>
      <View testID={`${testID}-notice`} accessibilityLiveRegion="polite" style={{ paddingStart: ROW_START, paddingEnd: ROW_END }}>
        {notice === null ? null : <Text style={{ ...typeStyle('supporting'), color: palette.secondary, writingDirection: writing }}>{notice}</Text>}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The one change form
// ---------------------------------------------------------------------------------------------------------------

/** What a confirm came to: words to say, a continuation, or nothing. */
export type Outcome = string | (() => void) | null;

export interface FieldSpec {
  readonly key: string;
  readonly label: string;
  /** Persistent help, drawn and spoken with the field (never a placeholder that disappears). */
  readonly help?: string;
  /** A sentence drawn above the field (the code instructions). */
  readonly instruction?: string;
  readonly kind: 'name' | 'login-id' | 'email' | 'password' | 'new-password' | 'code';
}

const FIELD_TRAITS: Readonly<Record<FieldSpec['kind'], {
  readonly ltr: boolean;
  readonly secure: boolean;
  readonly keyboard: KeyboardTypeOptions;
  readonly autoComplete: TextInputProps['autoComplete'];
  readonly maxLength: number;
}>> = {
  name: { ltr: false, secure: false, keyboard: 'default', autoComplete: 'name', maxLength: NAME_MAX_LENGTH },
  'login-id': { ltr: true, secure: false, keyboard: 'ascii-capable', autoComplete: 'off', maxLength: 64 },
  email: { ltr: true, secure: false, keyboard: 'email-address', autoComplete: 'email', maxLength: 254 },
  password: { ltr: true, secure: true, keyboard: 'default', autoComplete: 'current-password', maxLength: 1024 },
  'new-password': { ltr: true, secure: true, keyboard: 'default', autoComplete: 'new-password', maxLength: 1024 },
  code: { ltr: true, secure: false, keyboard: 'number-pad', autoComplete: 'one-time-code', maxLength: 16 },
};

export function ChangeForm({ title, current, fields, confirmLabel, secondary, language, palette, onConfirm, busyChanged, testID }: {
  readonly title: string;
  readonly current?: { readonly label: string; readonly value: string; readonly ltr: boolean };
  readonly fields: readonly FieldSpec[];
  readonly confirmLabel: string;
  /** A second act (the code resend), refused while the confirm is in flight. */
  readonly secondary?: { readonly label: string; readonly run: () => Promise<Outcome> };
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  /**
   * The confirm: a message to show, a continuation to run once the act is no longer in flight (leaving the form,
   * signing out), or null.
   */
  readonly onConfirm: (values: Readonly<Record<string, string>>) => Promise<Outcome>;
  readonly busyChanged: (busy: boolean) => void;
  readonly testID: string;
}) {
  const writing = writingOf(language);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, ''])));
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);

  // The title is the first thing the screen reader reaches.
  const titleRef = useRef<Text | null>(null);
  useEffect(() => {
    const node = titleRef.current === null ? null : findNodeHandle(titleRef.current);
    if (node !== null) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);

  const run = useCallback(async (act: () => Promise<Outcome>) => {
    // One act: the ref refuses a second press in the same frame, before the busy state has rendered.
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    busyChanged(true);
    setMessage(null);
    const said = await act();
    busyRef.current = false;
    busyChanged(false);
    // A continuation runs only now, once nothing is in flight: the frame may then leave the change.
    if (mounted.current) setBusy(false);
    if (typeof said === 'function') {
      said();
      return;
    }
    if (!mounted.current) return;
    if (said !== null) {
      setMessage(said);
      AccessibilityInfo.announceForAccessibility(said);
    }
  }, [busyChanged]);

  const confirm = useCallback(() => void run(() => onConfirm(values)), [onConfirm, run, values]);

  return (
    <View testID={testID} style={{ paddingStart: ROW_START, paddingEnd: ROW_END, paddingTop: 18, rowGap: 14 }}>
      <Text
        ref={titleRef}
        testID={`${testID}-title`}
        accessibilityRole="header"
        accessibilityLanguage={language}
        style={{ ...typeStyle('statement'), color: palette.primary, writingDirection: writing }}
      >
        {title}
      </Text>

      {current === undefined ? null : (
        <View accessible accessibilityLabel={[current.label, current.value].join(', ')} accessibilityLanguage={language} style={{ rowGap: 2 }}>
          <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{current.label}</Text>
          <Text testID={`${testID}-current`} style={{ ...typeStyle('body'), color: palette.primary, writingDirection: writing }}>
            {current.ltr ? isolatedLtr(current.value) : current.value}
          </Text>
        </View>
      )}

      {fields.map((field) => {
        const traits = FIELD_TRAITS[field.kind];
        const value = values[field.key] ?? '';
        return (
          <View key={field.key} style={{ rowGap: 6 }}>
            {field.instruction === undefined ? null : (
              <Text testID={`${testID}-${field.key}-instruction`} style={{ ...typeStyle('body'), color: palette.secondary, writingDirection: writing }}>{field.instruction}</Text>
            )}
            <Text style={{ ...typeStyle('metadata'), color: palette.tertiary, writingDirection: writing }}>{field.label}</Text>
            {/* A Latin field is one explicit left-to-right context; the Name follows the reader's direction. */}
            <View style={{ direction: traits.ltr ? 'ltr' : writing }}>
              <TextInput
                testID={`${testID}-${field.key}`}
                value={value}
                onChangeText={(text) => {
                  const next = field.kind === 'code' ? normalizeEmailCode(text) : text;
                  setValues((previous) => ({ ...previous, [field.key]: next }));
                  if (message !== null) setMessage(null);
                }}
                editable={!busy}
                accessibilityLabel={field.label}
                accessibilityHint={field.help}
                accessibilityLanguage={language}
                accessibilityState={{ disabled: busy }}
                secureTextEntry={traits.secure}
                autoCapitalize={field.kind === 'name' ? 'words' : 'none'}
                autoCorrect={false}
                spellCheck={false}
                autoComplete={traits.autoComplete}
                importantForAutofill={traits.autoComplete === 'off' ? 'no' : 'yes'}
                keyboardType={traits.keyboard}
                maxLength={field.kind === 'code' ? EMAIL_CODE_LENGTH : traits.maxLength}
                onFocus={() => setFocused(field.key)}
                onBlur={() => setFocused((was) => (was === field.key ? null : was))}
                selectionColor={palette.primary}
                cursorColor={palette.primary}
                style={{
                  ...typeStyle('body'),
                  color: palette.primary,
                  backgroundColor: palette.field,
                  minHeight: FIELD_MIN_HEIGHT,
                  borderRadius: FIELD_RADIUS,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderWidth: palette.focusThickness,
                  // The F1 focus indicator while the field has focus; the field's own colour otherwise.
                  borderColor: focused === field.key ? palette.focusIndicator : palette.field,
                  textAlign: traits.ltr ? 'left' : 'auto',
                  writingDirection: traits.ltr ? 'ltr' : writing,
                }}
              />
            </View>
            {field.help === undefined ? null : (
              <Text testID={`${testID}-${field.key}-help`} style={{ ...typeStyle('supporting'), color: palette.tertiary, writingDirection: writing }}>{field.help}</Text>
            )}
          </View>
        );
      })}

      {/* One polite region, always mounted, so a message can be announced. Words, never a colour alone. */}
      <View testID={`${testID}-message`} accessibilityLiveRegion="polite">
        {message === null ? null : <Text style={{ ...typeStyle('supporting'), color: palette.error, writingDirection: writing }}>{message}</Text>}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', columnGap: 12, rowGap: 10 }}>
        {secondary === undefined ? null : (
          <Control
            palette={palette}
            language={language}
            accessibilityLabel={secondary.label}
            accessibilityState={{ disabled: busy }}
            onPress={() => void run(secondary.run)}
            testID={`${testID}-secondary`}
            style={{ paddingHorizontal: 16, paddingVertical: 10, opacity: busy ? BUSY_OPACITY : 1 }}
          >
            <Text style={{ ...typeStyle('action'), color: palette.restInk, textAlign: 'center', writingDirection: writing }}>{secondary.label}</Text>
          </Control>
        )}
        <Control
          palette={palette}
          language={language}
          accessibilityLabel={confirmLabel}
          accessibilityState={{ busy, disabled: busy }}
          onPress={confirm}
          testID={`${testID}-confirm`}
          style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: palette.field, opacity: busy ? BUSY_OPACITY : 1 }}
        >
          <Text style={{ ...typeStyle('action'), color: palette.primary, textAlign: 'center', writingDirection: writing }}>{confirmLabel}</Text>
        </Control>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The changes
// ---------------------------------------------------------------------------------------------------------------

interface ChangeProps {
  readonly controller: AccountIdentityController;
  readonly language: ChromeLanguage;
  readonly palette: ConversationPalette;
  /** Leave the change and return to its row. */
  readonly onFinished: () => void;
  readonly busyChanged: (busy: boolean) => void;
}

export function NameChange({ controller, current, copy, ...props }: ChangeProps & { readonly current: string; readonly copy: AccountIdentityCopy }) {
  const onConfirm = useCallback(async (values: Readonly<Record<string, string>>): Promise<Outcome> => {
    const result = await controller.changeName(values.name ?? '');
    switch (result) {
      case 'DONE':
      case 'UNCHANGED':
        return props.onFinished;
      case 'EMPTY':
        return copy.emptyName;
      case 'RETRY':
        return copy.network;
      case null:
        return null;
    }
  }, [controller, copy, props]);
  return (
    <ChangeForm
      testID="qandeel-name-change"
      title={copy.nameTerm}
      current={{ label: copy.current, value: current, ltr: false }}
      fields={[{ key: 'name', label: copy.next, kind: 'name' }]}
      confirmLabel={copy.confirm}
      onConfirm={onConfirm}
      language={props.language}
      palette={props.palette}
      busyChanged={props.busyChanged}
    />
  );
}

export function LoginIdChange({ controller, current, copy, ...props }: ChangeProps & { readonly current: string; readonly copy: AccountIdentityCopy }) {
  const onConfirm = useCallback(async (values: Readonly<Record<string, string>>): Promise<Outcome> => {
    const result = await controller.changeLoginId(values.loginId ?? '', values.password ?? '');
    switch (result) {
      case 'DONE':
      case 'UNCHANGED':
        return props.onFinished;
      case 'EMPTY':
        return copy.emptyLoginId;
      case 'MALFORMED':
        return copy.malformedLoginId;
      case 'UNAVAILABLE':
        return copy.loginIdUnavailable;
      case 'PASSWORD_REJECTED':
        return copy.passwordIncorrect;
      case 'RETRY':
        return copy.network;
      case null:
        return null;
    }
  }, [controller, copy, props]);
  return (
    <ChangeForm
      testID="qandeel-login-id-change"
      title={copy.loginIdTerm}
      current={{ label: copy.current, value: current, ltr: true }}
      fields={[
        { key: 'loginId', label: copy.next, help: copy.loginIdHelp, kind: 'login-id' },
        { key: 'password', label: copy.password, kind: 'password' },
      ]}
      confirmLabel={copy.confirm}
      onConfirm={onConfirm}
      language={props.language}
      palette={props.palette}
      busyChanged={props.busyChanged}
    />
  );
}

/**
 * The Email change, in two steps of the same state (W3-PDG-01 §2): the password and the new Email; then the two
 * codes. `onChanged` runs once the provider confirmed both: the reader's current session has ended, and the caller
 * signs this device out so the reader returns to Sign in.
 */
export function EmailChange({ controller, current, copy, onChanged, ...props }: ChangeProps & {
  readonly current: string;
  readonly copy: AccountIdentityCopy;
  readonly onChanged: () => void;
}) {
  const [pending, setPending] = useState<{ readonly email: string; readonly password: string } | null>(null);

  const request = useCallback(async (values: Readonly<Record<string, string>>): Promise<Outcome> => {
    const email = (values.email ?? '').trim();
    const password = values.password ?? '';
    const result = await controller.requestEmailChange(password, email);
    switch (result) {
      case 'CODES_SENT':
        setPending({ email, password });
        return null;
      case 'UNCHANGED':
        return props.onFinished;
      case 'INVALID_EMAIL':
        return copy.invalidEmail;
      case 'PASSWORD_REJECTED':
        return copy.passwordIncorrect;
      case 'RETRY':
        return copy.network;
      case null:
        return null;
    }
  }, [controller, copy, props]);

  const confirm = useCallback(async (values: Readonly<Record<string, string>>): Promise<Outcome> => {
    if (pending === null) return null;
    const newCode = values.newCode ?? '';
    const currentCode = values.currentCode ?? '';
    if (newCode.length !== EMAIL_CODE_LENGTH || currentCode.length !== EMAIL_CODE_LENGTH) return copy.codeIncomplete;
    const result = await controller.confirmEmailChange(pending.email, newCode, currentCode);
    switch (result) {
      case 'CHANGED':
        return onChanged;
      case 'CODE_REJECTED':
        return copy.codeRejected;
      case 'RETRY':
        return copy.network;
      case null:
        return null;
    }
  }, [controller, copy, onChanged, pending]);

  // A resend asks again with what the reader already gave. It says nothing of its own (non-enumerating, W2-01).
  const resend = useCallback(async (): Promise<Outcome> => {
    if (pending === null) return null;
    const result = await controller.requestEmailChange(pending.password, pending.email);
    return result === 'RETRY' ? copy.network : null;
  }, [controller, copy, pending]);

  if (pending === null) {
    return (
      <ChangeForm
        testID="qandeel-email-change"
        title={copy.emailTerm}
        current={{ label: copy.current, value: current, ltr: true }}
        fields={[
          { key: 'password', label: copy.password, kind: 'password' },
          { key: 'email', label: copy.next, kind: 'email' },
        ]}
        confirmLabel={copy.confirm}
        onConfirm={request}
        language={props.language}
        palette={props.palette}
        busyChanged={props.busyChanged}
      />
    );
  }
  return (
    <ChangeForm
      key="codes"
      testID="qandeel-email-verify"
      title={copy.emailTerm}
      fields={[
        { key: 'newCode', label: copy.codeLabel, instruction: copy.codeInstruction(pending.email), kind: 'code' },
        { key: 'currentCode', label: copy.codeLabel, instruction: copy.codeInstruction(current), kind: 'code' },
      ]}
      confirmLabel={copy.verifyAction}
      secondary={{ label: copy.resendAction, run: resend }}
      onConfirm={confirm}
      language={props.language}
      palette={props.palette}
      busyChanged={props.busyChanged}
    />
  );
}

/**
 * Change password (W3-PDG-01 §3). Changed on this device → the reader is told "Password changed." at the row and stays
 * signed in (every other session has ended). Changed on a fresh session → `onSignedOut`: this device's session ended too.
 */
export function PasswordChange({ controller, copy, network, onChanged, onSignedOut, passwordIncorrect, ...props }: ChangeProps & {
  readonly copy: SecurityCopy;
  readonly network: string;
  readonly passwordIncorrect: string;
  readonly onChanged: () => void;
  readonly onSignedOut: () => void;
}) {
  const onConfirm = useCallback(async (values: Readonly<Record<string, string>>): Promise<Outcome> => {
    const next = values.newPassword ?? '';
    if (next === '' || (values.password ?? '') === '') return copy.policy;
    // Checked here, before anything is sent: two different entries can never be the reader's intent.
    if (next !== (values.confirmPassword ?? '')) return copy.mismatch;
    const result = await controller.changePassword(values.password ?? '', next);
    switch (result) {
      case 'CHANGED':
        return onChanged;
      case 'CHANGED_SIGNED_OUT':
        return onSignedOut;
      case 'POLICY':
        return copy.policy;
      case 'PASSWORD_REJECTED':
        return passwordIncorrect;
      case 'RETRY':
        return network;
      case null:
        return null;
    }
  }, [controller, copy, network, onChanged, onSignedOut, passwordIncorrect]);
  return (
    <ChangeForm
      testID="qandeel-password-change"
      title={copy.changePassword}
      fields={[
        { key: 'password', label: copy.currentPassword, kind: 'password' },
        { key: 'newPassword', label: copy.newPassword, kind: 'new-password' },
        { key: 'confirmPassword', label: copy.confirmPassword, kind: 'new-password' },
      ]}
      confirmLabel={copy.changePassword}
      onConfirm={onConfirm}
      language={props.language}
      palette={props.palette}
      busyChanged={props.busyChanged}
    />
  );
}
