/**
 * T-14 — the Product entry a signed-out reader actually meets.
 *
 * > **This is an adapter. The authentication system already exists.**
 *
 * The hard work — persisted auth storage, the generation rule, the sign-out race, foreground-only
 * refresh, the authenticated bootstrap and T-13 recovery — was finished by T-12P, T-12 and T-13. What
 * was missing was a caller. So this surface owns exactly one thing: it collects a credential the
 * reader typed, hands it to the ONE frozen capability, and maps the typed answer onto frozen Product
 * copy. Then it gets out of the way.
 *
 * ## What it deliberately does not do
 *
 * It creates no Supabase client, reads and writes no auth storage, inspects no token, parses no JWT,
 * creates no conversation Session, calls no QANDEEL API and touches no T-13 recovery record. On
 * success it does not navigate and it manufactures no success state: the authority publishes
 * authentication, the integration runtime leaves `SIGNED_OUT` on its own, and this surface is
 * replaced by whatever that runtime decides comes next. A gateway that pushed a route or started a
 * bootstrap would be a second owner of a lifecycle that already has one.
 *
 * ## The one request state, and why the guard is a ref
 *
 * There is `IDLE` and there is `SUBMITTING`, and nothing else: no queue, no automatic retry, no
 * backoff, no hidden second submit. A second press while the first is in flight is IGNORED rather
 * than merely visually disabled — two presses in one tick both read the same rendered state, so a
 * guard that lived in `useState` would let the second through before React had re-rendered. The ref
 * is read and written synchronously inside the handler, which is where the race actually is.
 *
 * ## Lifecycle
 *
 * This adds no second auth epoch rule. `MobileAuthAuthority` already owns command ordering and the
 * stale-sign-in-versus-sign-out race, and it remains the only judge of whether a completion is
 * current. What lives here is surface-local only: a late Promise completion after unmount issues no
 * React state update. No `AbortController` is created, because the frozen capability supports none
 * and inventing one would be a second cancellation with its own ordering.
 *
 * ## The credential
 *
 * The password is process-local component state and nothing else. It is never logged, never put in
 * an error, never persisted, and never copied into Product or recovery state. It is trimmed by
 * nothing and transformed by nothing — a password is bytes the reader chose, and "helpfully"
 * normalizing one is how a correct credential becomes a wrong one. The email is trimmed once, at
 * submit, and the reader's own field is never rewritten.
 *
 * ## Language, direction and type
 *
 * The words follow `locale.language`; the layout follows `locale.direction`; neither is derived from
 * the other, which is the whole point of the one locale authority. The two credential fields stay
 * physically left-to-right, because an email address and a password are Latin byte sequences whose
 * caret behaviour is unusable when the field mirrors — that is a text-entry decision inside the
 * fields and it does not mirror the Product around them.
 *
 * Every line height is ~1.5x its font size so Arabic ascenders and descenders are not clipped, no
 * font scaling is disabled anywhere, and the FONT FAMILY is deliberately not set: which families the
 * app loads is an asset decision, and this surface states the assumption rather than relying on it.
 * W1B-01 paints it in the frozen visual language the rest of the entry stands in: the Dark World, the
 * FIELD role for its fields, Estedad v8.5 faces in E3's roles, all resolved from the same generated
 * constants the Conversation uses (`../../conversation`) — so no colour value is ever written here. It
 * adds no icon, no illustration and no motion. W1B-01 also gives it exactly two seams, both optional
 * and neither a second auth command: a `footer` the Auth Gateway destination draws below the form (its
 * entry into Create account), and `onEmailNotConfirmed`, the approved route to Email verification when
 * the provider validated the password and reports the Email unverified. Account creation itself lives
 * in `../../account`, never in this directory.
 *
 * ## W2-01 — the final sign-in (P1 §3)
 *
 * ONE identifier field that accepts a Login ID or an Email, plus the password: no modes, no tabs, no
 * second form. The field carries the approved persistent help, and the credential is still spent in
 * exactly one call — now `signInWithIdentifier`, where the auth authority decides which route an
 * identifier takes. Every rejected credential, by Login ID or by Email, is the ONE approved generic
 * sentence. The destination may draw one more thing beside the form (`passwordAssist`, below the
 * password — its recovery entry), and may say that the reader's session ended (`sessionEnded`), a notice
 * that stands until the reader's next attempt. Neither is an auth command, and recovery itself lives in
 * `../../account`, never in this directory. The identifier is trimmed once at submit and never
 * lowercased here; the password is still untouched.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { typeStyle, usePalette } from '../../conversation';
import type { MobileAuthAuthority } from '../../runtime-entry';
import type { ProductLocale } from '../locale/product-locale';
import { clearsPasswordAfter, productSignInCopy, signInFailureMessage } from './product-sign-in-copy';

/** The one stable identifier for the Product entry surface. */
export const PRODUCT_SIGN_IN_GATEWAY_TEST_ID = 'qandeel-sign-in-gateway';
export const SIGN_IN_TITLE_TEST_ID = 'qandeel-sign-in-title';
/**
 * The identifier field (Login ID or Email). W2-01 keeps T-14's constant and value unchanged, so the
 * existing proof flows that address this field keep addressing it.
 */
export const SIGN_IN_EMAIL_TEST_ID = 'qandeel-sign-in-email';
/** W2-01 — the identifier's persistent help. */
export const SIGN_IN_IDENTIFIER_HELP_TEST_ID = 'qandeel-sign-in-identifier-help';
export const SIGN_IN_PASSWORD_TEST_ID = 'qandeel-sign-in-password';
export const SIGN_IN_SUBMIT_TEST_ID = 'qandeel-sign-in-submit';
/** The single status/error region. Present in every state so it can announce a change into it. */
export const SIGN_IN_NOTICE_TEST_ID = 'qandeel-sign-in-notice';

export interface ProductSignInGatewayProps {
  /**
   * The frozen identity authority, exactly as the integration runtime exposes it.
   *
   * This surface calls ONE of its methods. It is passed rather than reached for, so there is no path
   * by which a second authority, a second client or a fixture could be constructed here.
   */
  readonly auth: MobileAuthAuthority;
  /** The one app-level locale. Language and direction are independent, always. */
  readonly locale: ProductLocale;
  /** W1B-01 — drawn below the form by the Auth Gateway destination. It carries no auth command. */
  readonly footer?: ReactNode;
  /**
   * W1B-01 — the provider checked the password FIRST and then reported the Email unverified, so this
   * reveals nothing to someone without the credential. Absent, that kind shows the unexpected sentence.
   */
  readonly onEmailNotConfirmed?: (email: string) => void;
  /** W2-01 — drawn below the password field by the destination: its password recovery entry. No auth command. */
  readonly passwordAssist?: ReactNode;
  /** W2-01 — the auth owner has evidence the reader's session ended. Shown until the next attempt. */
  readonly sessionEnded?: boolean;
}

export function ProductSignInGateway({ auth, locale, footer, onEmailNotConfirmed, passwordAssist, sessionEnded = false }: ProductSignInGatewayProps) {
  const copy = productSignInCopy(locale.language);
  const palette = usePalette();
  const insets = useSafeAreaInsets();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  /** The ended-session notice belongs to the moment the reader arrived; their next attempt replaces it. */
  const [attempted, setAttempted] = useState(false);

  const passwordField = useRef<TextInput | null>(null);
  /** Read and written synchronously: this, not the rendered state, is what makes a second press inert. */
  const inFlight = useRef(false);
  /** Whether this surface is still on screen. A completion that outlives it updates nothing. */
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const submit = useCallback(async () => {
    if (inFlight.current) return;

    // The only two local rejections there are. Neither is an authority over what a valid credential
    // looks like: no Email or Login ID pattern is applied here, because the identity provider and the
    // server decide that, and one generic answer is all a rejected credential may get.
    const typed = identifier.trim();
    setAttempted(true);
    if (typed === '') {
      setFailure(copy.missingIdentifier);
      return;
    }
    if (password === '') {
      setFailure(copy.missingPassword);
      return;
    }

    inFlight.current = true;
    setFailure(null);
    setSubmitting(true);

    const outcome = await auth.signInWithIdentifier(typed, password);
    if (!live.current) return;
    if (outcome.ok) {
      // FINISHED. The authority has published authentication and the integration runtime is already
      // leaving SIGNED_OUT, so returning to an idle form here would be a flicker of a surface the
      // Product has moved past. Nothing is navigated and nothing is bootstrapped from here.
      return;
    }
    inFlight.current = false;
    setSubmitting(false);
    if (outcome.failure.kind === 'EMAIL_NOT_CONFIRMED' && onEmailNotConfirmed !== undefined) {
      // The password was right and the Email is not yet verified: verification is where the reader goes.
      // By Email it is the address they typed; by Login ID it is the one their proved password unlocked.
      onEmailNotConfirmed(outcome.failure.confirmationEmail ?? typed);
      return;
    }
    // The KIND only. The port's technical detail is never a Product sentence.
    setFailure(signInFailureMessage(copy, outcome.failure.kind));
    if (clearsPasswordAfter(outcome.failure.kind)) setPassword('');
  }, [auth, copy, identifier, onEmailNotConfirmed, password]);

  const onSubmitPress = useCallback(() => {
    void submit();
  }, [submit]);

  const focusPassword = useCallback(() => {
    passwordField.current?.focus();
  }, []);

  // One region, one message: what is happening now, what went wrong last, or — until the reader's first
  // attempt here — that their session ended.
  const ended = sessionEnded && !attempted && failure === null;
  const notice = submitting ? copy.submitting : failure ?? (ended ? copy.sessionEnded : null);

  // W1B-01: the frozen visual language, from the generated constants. No colour value is written here.
  const paint = {
    ground: { backgroundColor: palette.world },
    title: { ...typeStyle('statement'), color: palette.primary },
    label: { ...typeStyle('action'), color: palette.secondary },
    input: { ...typeStyle('body'), color: palette.primary, backgroundColor: palette.field },
    submit: { backgroundColor: palette.field },
    submitLabel: { ...typeStyle('action'), color: palette.primary },
    notice: { ...typeStyle('supporting'), color: submitting || ended ? palette.secondary : palette.error },
    help: { ...typeStyle('supporting'), color: palette.tertiary },
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, paint.ground]}
      // The form must stay above the keyboard on both platforms. iOS overlays the keyboard, and
      // Android 15+ enforces edge-to-edge, where the window no longer resizes for it either (measured
      // on the W1A-01 API 36 proof emulator): without this the lower form and its submit sit under the
      // keyboard, and the scroll cannot lift them out because the scroll view itself extends beneath
      // it. `padding` is computed from the real overlap between this view and the keyboard, so on a
      // platform that still resizes the window the overlap is zero and nothing is added twice.
      behavior="padding"
    >
      <ScrollView
        style={styles.root}
        contentContainerStyle={{
          ...styles.content,
          paddingTop: insets.top + GUTTER,
          paddingBottom: insets.bottom + GUTTER,
          paddingLeft: insets.left + GUTTER,
          paddingRight: insets.right + GUTTER,
        }}
        // The form SCROLLS rather than clips when the keyboard and a large text size take the
        // viewport: the submit must stay reachable at every text size, and hiding it behind an
        // overflow rule is the failure this exists to prevent.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View
          testID={PRODUCT_SIGN_IN_GATEWAY_TEST_ID}
          // The layout direction is the reader's, and it is NOT read from the language.
          style={{ ...styles.form, direction: locale.direction === 'RTL' ? 'rtl' : 'ltr' }}
          accessibilityLanguage={locale.language}
        >
          <Text testID={SIGN_IN_TITLE_TEST_ID} accessibilityRole="header" style={[styles.title, paint.title]}>
            {copy.title}
          </Text>

          <View style={styles.field}>
            <Text style={[styles.label, paint.label]}>{copy.identifierLabel}</Text>
            <Text testID={SIGN_IN_IDENTIFIER_HELP_TEST_ID} style={[styles.help, paint.help]}>
              {copy.identifierHelp}
            </Text>
            <TextInput
              testID={SIGN_IN_EMAIL_TEST_ID}
              value={identifier}
              onChangeText={setIdentifier}
              // Left-to-right inside the field only; see the module comment. A Login ID and an Email are
              // both Latin byte sequences.
              style={[styles.input, paint.input]}
              selectionColor={palette.primary}
              cursorColor={palette.primary}
              // The Email keyboard serves both: it carries `@` and `.`, and letters and digits for a Login ID.
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              // `username` is the platform's name for "the account identifier", whichever form it takes.
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={focusPassword}
              submitBehavior="submit"
              accessibilityLabel={copy.identifierLabel}
              accessibilityHint={copy.identifierHelp}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, paint.label]}>{copy.passwordLabel}</Text>
            <TextInput
              testID={SIGN_IN_PASSWORD_TEST_ID}
              ref={passwordField}
              value={password}
              onChangeText={setPassword}
              style={[styles.input, paint.input]}
              selectionColor={palette.primary}
              cursorColor={palette.primary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={onSubmitPress}
              accessibilityLabel={copy.passwordLabel}
            />
          </View>

          {passwordAssist ?? null}

          <Pressable
            testID={SIGN_IN_SUBMIT_TEST_ID}
            // Deliberately still pressable while busy. The refusal lives in the handler, where the
            // race is; a control removed from the responder tree would make the guard untestable and
            // would leave a reader wondering whether their press registered at all.
            onPress={onSubmitPress}
            style={({ pressed }) => [styles.submit, paint.submit, pressed ? styles.pressed : null, submitting ? styles.busy : null]}
            accessibilityRole="button"
            accessibilityLabel={copy.submit}
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            <Text style={[styles.submitLabel, paint.submitLabel]}>{copy.submit}</Text>
          </Pressable>

          <View
            testID={SIGN_IN_NOTICE_TEST_ID}
            // Polite, and always mounted: a live region that appears together with its message has
            // nothing to announce a change against. It carries the status while a request is in
            // flight and the frozen failure sentence afterwards, and never both.
            accessibilityLiveRegion="polite"
            accessibilityRole="summary"
          >
            {notice === null ? null : <Text style={[styles.noticeText, paint.notice]}>{notice}</Text>}
          </View>

          {footer ?? null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** The one spacing constant. Added to the reader's real safe-area inset rather than replacing it. */
const GUTTER = 24;

const styles = StyleSheet.create({
  root: { flex: 1 },
  // `flexGrow` rather than `flex`: the content is its natural height and grows to fill a tall window,
  // which is what lets it scroll instead of clip once the keyboard and large text take the viewport.
  content: { flexGrow: 1, justifyContent: 'center' },
  // A bounded measure, centred. No fixed height and no absolute positioning anywhere: every control
  // is laid out in flow, so nothing can be pushed off-window by a keyboard or a text size.
  form: { width: '100%', maxWidth: 420, alignSelf: 'center', rowGap: 20 },
  // The type roles (E3) and the colours arrive from paint; these are the layout facts only.
  title: {},
  field: { rowGap: 6 },
  label: {},
  help: {},
  // `minHeight` rather than `height`, so the field still contains its text at the largest system
  // size. `textAlign`/`writingDirection` keep the credential physically left-to-right.
  input: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  // 44 is the platform minimum for a comfortable target, as a floor rather than a fixed height.
  submit: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  // A static opacity swap, not an animation: no duration, no easing, no driver. Motion is T-10's.
  pressed: { opacity: 0.6 },
  busy: { opacity: 0.6 },
  submitLabel: {},
  // No height of its own: an empty region takes no room, and a message that runs to several lines at
  // the largest text size grows the region rather than being clipped by it.
  noticeText: {},
});
