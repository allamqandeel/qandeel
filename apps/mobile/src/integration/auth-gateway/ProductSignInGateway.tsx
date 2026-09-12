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
 * There is no colour, no icon, no illustration and no motion here at all — the final Graphic Language
 * is VI-03's, and a restrained form is what an entry surface owes a reader in the meantime.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MobileAuthAuthority } from '../../runtime-entry';
import type { ProductLocale } from '../locale/product-locale';
import { clearsPasswordAfter, productSignInCopy, signInFailureMessage } from './product-sign-in-copy';

/** The one stable identifier for the Product entry surface. */
export const PRODUCT_SIGN_IN_GATEWAY_TEST_ID = 'qandeel-sign-in-gateway';
export const SIGN_IN_TITLE_TEST_ID = 'qandeel-sign-in-title';
export const SIGN_IN_EMAIL_TEST_ID = 'qandeel-sign-in-email';
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
}

export function ProductSignInGateway({ auth, locale }: ProductSignInGatewayProps) {
  const copy = productSignInCopy(locale.language);
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

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
    // looks like: no email pattern is applied here, because the identity provider decides that and a
    // client-side rule would refuse addresses that are perfectly real.
    const address = email.trim();
    if (address === '') {
      setFailure(copy.missingEmail);
      return;
    }
    if (password === '') {
      setFailure(copy.missingPassword);
      return;
    }

    inFlight.current = true;
    setFailure(null);
    setSubmitting(true);

    const outcome = await auth.signInWithPassword(address, password);
    if (!live.current) return;
    if (outcome.ok) {
      // FINISHED. The authority has published authentication and the integration runtime is already
      // leaving SIGNED_OUT, so returning to an idle form here would be a flicker of a surface the
      // Product has moved past. Nothing is navigated and nothing is bootstrapped from here.
      return;
    }
    inFlight.current = false;
    setSubmitting(false);
    // The KIND only. The port's technical detail is never a Product sentence.
    setFailure(signInFailureMessage(copy, outcome.failure.kind));
    if (clearsPasswordAfter(outcome.failure.kind)) setPassword('');
  }, [auth, copy, email, password]);

  const onSubmitPress = useCallback(() => {
    void submit();
  }, [submit]);

  const focusPassword = useCallback(() => {
    passwordField.current?.focus();
  }, []);

  // One region, one message: what is happening now, or what went wrong last.
  const notice = submitting ? copy.submitting : failure;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      // The keyboard is the one place the two platforms genuinely differ: iOS overlays it and needs
      // the content inset, Android resizes the window already and would double-compensate. This is a
      // keyboard behaviour, not a device class, and nothing about the Product depends on it.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
          <Text testID={SIGN_IN_TITLE_TEST_ID} accessibilityRole="header" style={styles.title}>
            {copy.title}
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>{copy.emailLabel}</Text>
            <TextInput
              testID={SIGN_IN_EMAIL_TEST_ID}
              value={email}
              onChangeText={setEmail}
              // Left-to-right inside the field only; see the module comment.
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={focusPassword}
              submitBehavior="submit"
              accessibilityLabel={copy.emailLabel}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{copy.passwordLabel}</Text>
            <TextInput
              testID={SIGN_IN_PASSWORD_TEST_ID}
              ref={passwordField}
              value={password}
              onChangeText={setPassword}
              style={styles.input}
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

          <Pressable
            testID={SIGN_IN_SUBMIT_TEST_ID}
            // Deliberately still pressable while busy. The refusal lives in the handler, where the
            // race is; a control removed from the responder tree would make the guard untestable and
            // would leave a reader wondering whether their press registered at all.
            onPress={onSubmitPress}
            style={({ pressed }) => [styles.submit, pressed ? styles.pressed : null, submitting ? styles.busy : null]}
            accessibilityRole="button"
            accessibilityLabel={copy.submit}
            accessibilityState={{ disabled: submitting, busy: submitting }}
          >
            <Text style={styles.submitLabel}>{copy.submit}</Text>
          </Pressable>

          <View
            testID={SIGN_IN_NOTICE_TEST_ID}
            // Polite, and always mounted: a live region that appears together with its message has
            // nothing to announce a change against. It carries the status while a request is in
            // flight and the frozen failure sentence afterwards, and never both.
            accessibilityLiveRegion="polite"
            accessibilityRole="summary"
          >
            {notice === null ? null : <Text style={styles.noticeText}>{notice}</Text>}
          </View>
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
  title: { fontSize: 24, lineHeight: 36, fontWeight: '600' },
  field: { rowGap: 6 },
  label: { fontSize: 14, lineHeight: 21 },
  // `minHeight` rather than `height`, so the field still contains its text at the largest system
  // size. `textAlign`/`writingDirection` keep the credential physically left-to-right.
  input: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  // 44 is the platform minimum for a comfortable target, as a floor rather than a fixed height.
  submit: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderRadius: 6, paddingVertical: 12, paddingHorizontal: 16 },
  // A static opacity swap, not an animation: no duration, no easing, no driver. Motion is T-10's.
  pressed: { opacity: 0.6 },
  busy: { opacity: 0.6 },
  submitLabel: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  // No height of its own: an empty region takes no room, and a message that runs to several lines at
  // the largest text size grows the region rather than being clipped by it.
  noticeText: { fontSize: 14, lineHeight: 21 },
});
