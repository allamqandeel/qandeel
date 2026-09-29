/**
 * W2-01 — the final account access lifecycle as a reader meets it, on the Auth Gateway destination.
 *
 * The auth authority is the REAL one over the T-12P port double, and the Sign-in form is T-14's own,
 * rendered through the destination's seam exactly as `ProductRoot` renders it — so the routing, the
 * explicit-completion barrier and the recovery containment under test are production's.
 */
import { act, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { AccountEntry, SessionVerificationRecovery, accountAccessCopy, type LoginIdAvailability } from '..';
import { ProductSignInGateway, productLocale, productSignInCopy } from '../../integration';
import type { ChromeLanguage } from '../../orientation-chrome';
import { createManualForegroundSignal, createMobileAuthAuthority, type MobileAuthAuthority } from '../../runtime-entry';
import { authPortDouble, gate, type AuthPortDouble } from '../../runtime-entry/__fixtures__/runtime-entry';
import { nodes } from '../../responsive/__fixtures__/composition';

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };
const DETAIL = 'PROVIDER-DETAIL-MUST-NOT-BE-RENDERED';
const ACCESS = { en: accountAccessCopy('en'), ar: accountAccessCopy('ar') };
const SIGN_IN = { en: productSignInCopy('en'), ar: productSignInCopy('ar') };
const LOGIN_IDS: LoginIdAvailability = { check: async () => ({ kind: 'AVAILABLE' }) };

interface Mounted {
  readonly view: RenderResult;
  readonly port: AuthPortDouble;
  readonly auth: MobileAuthAuthority;
}

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

async function mount(options: { language?: ChromeLanguage; sessionEnded?: boolean; configure?: (port: AuthPortDouble) => void } = {}): Promise<Mounted> {
  const language = options.language ?? 'en';
  const port = authPortDouble(null);
  options.configure?.(port);
  const auth = createMobileAuthAuthority({ port, foreground: createManualForegroundSignal('ACTIVE') });
  await auth.start();
  const locale = productLocale(language, language === 'ar' ? 'RTL' : 'LTR');
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <AccountEntry
        auth={auth}
        loginIds={LOGIN_IDS}
        locale={locale}
        sessionEnded={options.sessionEnded ?? false}
        renderSignIn={({ footer, onEmailNotConfirmed, passwordAssist, sessionEnded }) => (
          <ProductSignInGateway
            auth={auth}
            locale={locale}
            footer={footer}
            onEmailNotConfirmed={onEmailNotConfirmed}
            passwordAssist={passwordAssist}
            sessionEnded={sessionEnded}
          />
        )}
      />
    </SafeAreaProvider>,
  );
  await settle();
  return { view, port, auth };
}

const tree = (view: RenderResult) => JSON.stringify(view.toJSON());
const press = async (view: RenderResult, id: string) => {
  await fireEvent.press(view.getByTestId(id));
  await settle();
};
const type = async (view: RenderResult, id: string, text: string) => {
  await fireEvent.changeText(view.getByTestId(id), text);
};
const noticeSays = (view: RenderResult, id: string, text: string) => within(view.getByTestId(id)).queryByText(text) !== null;
/** The words of a Text that carries its own test id. */
const textOf = (view: RenderResult, id: string): unknown => view.getByTestId(id).props.children;

async function signIn(view: RenderResult, identifier: string, password: string) {
  await type(view, 'qandeel-sign-in-email', identifier);
  await type(view, 'qandeel-sign-in-password', password);
  await press(view, 'qandeel-sign-in-submit');
}

async function toRecoveryCode(m: Mounted, email = 'reader@example.test') {
  await press(m.view, 'qandeel-sign-in-forgot-password');
  await type(m.view, 'qandeel-recovery-email', email);
  await press(m.view, 'qandeel-recovery-send');
}

async function toNewPassword(m: Mounted) {
  await toRecoveryCode(m);
  await type(m.view, 'qandeel-recovery-code-field', '123456');
  await press(m.view, 'qandeel-recovery-code-submit');
}

describe('final sign-in — one identifier field, Login ID OR Email', () => {
  for (const language of ['en', 'ar'] as const) {
    it(`${language}: exactly one identifier field plus Password, with the approved label and persistent help`, async () => {
      const { view } = await mount({ language });
      const inputs = nodes(view.toJSON()).filter((node) => node.type === 'TextInput');
      expect(inputs.map((node) => (node.props as { testID?: string }).testID)).toEqual(['qandeel-sign-in-email', 'qandeel-sign-in-password']);
      const identifier = view.getByTestId('qandeel-sign-in-email');
      expect(identifier.props.accessibilityLabel).toBe(SIGN_IN[language].identifierLabel);
      expect(identifier.props.accessibilityHint).toBe(SIGN_IN[language].identifierHelp);
      // Persistent help — visible text, never a placeholder.
      expect(textOf(view, 'qandeel-sign-in-identifier-help')).toBe(SIGN_IN[language].identifierHelp);
      expect(identifier.props.placeholder).toBeUndefined();
      // The field stays physically left-to-right in an Arabic layout.
      const style = Object.assign({}, ...[identifier.props.style].flat(2).filter(Boolean));
      expect(style).toEqual(expect.objectContaining({ textAlign: 'left', writingDirection: 'ltr' }));
      // The recovery entry is offered beside the form.
      expect(within(view.getByTestId('qandeel-sign-in-forgot-password')).getByText(ACCESS[language].forgotPassword)).toBeTruthy();
      await view.unmount();
    });
  }

  it('an Email signs in through the provider and a Login ID through the server — the same field, no modes', async () => {
    const byEmail = await mount();
    await signIn(byEmail.view, '  reader@example.test ', 'pw');
    expect(byEmail.auth.getState()).toMatchObject({ kind: 'AUTHENTICATED', userId: 'user-for-reader@example.test' });
    expect(byEmail.port.loginIdSignIns).toEqual([]);
    await byEmail.view.unmount();

    const byLoginId = await mount();
    await signIn(byLoginId.view, ' Mona.Ali ', 'pw');
    // Trimmed only; the server canonicalises case (it is proved there, against the database).
    expect(byLoginId.port.loginIdSignIns).toEqual([{ loginId: 'Mona.Ali', password: 'pw' }]);
    expect(byLoginId.auth.getState()).toMatchObject({ kind: 'AUTHENTICATED', authGeneration: 1 });
    await byLoginId.view.unmount();
  });

  for (const language of ['en', 'ar'] as const) {
    it(`${language}: a wrong Login ID and a wrong Email meet the SAME approved sentence, and nothing more`, async () => {
      const refused = { ok: false as const, failure: { kind: 'INVALID_CREDENTIALS' as const, detail: DETAIL } };
      const byLoginId = await mount({ language, configure: (port) => port.loginIdSignInWith(refused) });
      await signIn(byLoginId.view, 'nobody.here', 'wrong');
      const byEmail = await mount({ language, configure: (port) => port.signInWith(refused) });
      await signIn(byEmail.view, 'nobody@example.test', 'wrong');
      for (const { view } of [byLoginId, byEmail]) {
        expect(noticeSays(view, 'qandeel-sign-in-notice', SIGN_IN[language].invalidCredentials)).toBe(true);
        expect(tree(view)).not.toContain(DETAIL);
        await view.unmount();
      }
      for (const word of ['exist', 'not found', 'unknown', 'غير موجود', 'غير مسجل']) expect(SIGN_IN[language].invalidCredentials).not.toContain(word);
    });
  }

  it('a network failure is T-14’s frozen network sentence, by either route', async () => {
    const offline = { ok: false as const, failure: { kind: 'NETWORK' as const, detail: DETAIL } };
    const m = await mount({ configure: (port) => port.loginIdSignInWith(offline) });
    await signIn(m.view, 'mona.ali', 'pw');
    expect(noticeSays(m.view, 'qandeel-sign-in-notice', 'Couldn’t connect. Try again.')).toBe(true);
    await m.view.unmount();
  });

  it('a proved password on an unconfirmed Email by Login ID goes to Verify Email for the Email it unlocked', async () => {
    const m = await mount({
      configure: (port) => port.loginIdSignInWith({ ok: false, failure: { kind: 'EMAIL_NOT_CONFIRMED', detail: DETAIL, confirmationEmail: 'mona@example.test' } }),
    });
    await signIn(m.view, 'mona.ali', 'correct');
    expect(m.view.getByTestId('qandeel-verify-email')).toBeTruthy();
    expect(tree(m.view)).toContain('mona@example.test');
    expect(m.auth.getState().kind).toBe('SIGNED_OUT');
    await m.view.unmount();
  });

  it('a second press while the first is in flight is refused: one request', async () => {
    const m = await mount();
    const held = m.port.blockLoginIdSignIn({ userId: 'mona', accessToken: 't' });
    await type(m.view, 'qandeel-sign-in-email', 'mona.ali');
    await type(m.view, 'qandeel-sign-in-password', 'pw');
    await fireEvent.press(m.view.getByTestId('qandeel-sign-in-submit'));
    await fireEvent.press(m.view.getByTestId('qandeel-sign-in-submit'));
    await fireEvent.press(m.view.getByTestId('qandeel-sign-in-submit'));
    expect(m.port.loginIdSignIns).toHaveLength(1);
    held.open();
    await settle();
    expect(m.auth.getState()).toMatchObject({ kind: 'AUTHENTICATED', userId: 'mona', authGeneration: 1 });
    await m.view.unmount();
  });

  it('an empty identifier is refused locally in the approved words, and nothing is asked of anyone', async () => {
    const m = await mount({ language: 'ar' });
    await signIn(m.view, '   ', 'pw');
    expect(noticeSays(m.view, 'qandeel-sign-in-notice', 'أدخل معرّف الدخول أو البريد الإلكتروني.')).toBe(true);
    expect(m.port.loginIdSignIns).toEqual([]);
    await m.view.unmount();
  });
});

describe('the ended-session notice — only with the auth owner’s evidence', () => {
  it('shows the approved notice on Sign in, which stays usable', async () => {
    for (const language of ['en', 'ar'] as const) {
      const m = await mount({ language, sessionEnded: true });
      expect(noticeSays(m.view, 'qandeel-sign-in-notice', SIGN_IN[language].sessionEnded)).toBe(true);
      // The password field is empty — nothing is preserved or refilled.
      expect(m.view.getByTestId('qandeel-sign-in-password').props.value).toBe('');
      await signIn(m.view, 'reader@example.test', 'pw');
      expect(m.auth.getState().kind).toBe('AUTHENTICATED');
      await m.view.unmount();
    }
  });

  it('is absent without evidence (a first launch), and spent once the reader moves on', async () => {
    const cold = await mount();
    expect(tree(cold.view)).not.toContain(SIGN_IN.en.sessionEnded);
    await cold.view.unmount();

    const m = await mount({ sessionEnded: true });
    await press(m.view, 'qandeel-sign-in-create-account');
    await press(m.view, 'qandeel-create-account-return');
    expect(tree(m.view)).not.toContain(SIGN_IN.en.sessionEnded);
    await m.view.unmount();

    const attempted = await mount({ sessionEnded: true, configure: (port) => port.signInWith({ ok: false, failure: { kind: 'INVALID_CREDENTIALS', detail: DETAIL } }) });
    await signIn(attempted.view, 'reader@example.test', 'wrong');
    expect(tree(attempted.view)).not.toContain(SIGN_IN.en.sessionEnded);
    expect(noticeSays(attempted.view, 'qandeel-sign-in-notice', SIGN_IN.en.invalidCredentials)).toBe(true);
    await attempted.view.unmount();
  });
});

describe('password recovery — Email only, non-enumerating, and it ends signed out', () => {
  it('Email only: an implausible address (or a Login ID) is refused locally and nothing is sent', async () => {
    const m = await mount();
    await press(m.view, 'qandeel-sign-in-forgot-password');
    for (const typed of ['mona.ali', '', 'no-at-sign']) {
      await type(m.view, 'qandeel-recovery-email', typed);
      await press(m.view, 'qandeel-recovery-send');
      expect(noticeSays(m.view, 'qandeel-recovery-email-message', ACCESS.en.invalidEmail)).toBe(true);
    }
    expect(m.port.recovery.requests).toEqual([]);
    await m.view.unmount();
  });

  for (const language of ['en', 'ar'] as const) {
    it(`${language}: the request leads to the code step, which states the ONE generic result`, async () => {
      const m = await mount({ language });
      await toRecoveryCode(m, '  reader@example.test ');
      expect(m.port.recovery.requests).toEqual(['reader@example.test']);
      expect(m.view.getByTestId('qandeel-recovery-code')).toBeTruthy();
      expect(textOf(m.view, 'qandeel-recovery-code-instruction')).toBe(ACCESS[language].recoveryRequested);
      expect(m.auth.getState()).toEqual({ kind: 'SIGNED_OUT' });
      await m.view.unmount();
    });
  }

  it('a transport failure on the request says only the network sentence and stays on the request', async () => {
    const m = await mount({ configure: (port) => port.recoveryRequestWith({ ok: false, failure: { kind: 'NETWORK', detail: DETAIL } }) });
    await toRecoveryCode(m);
    expect(m.view.getByTestId('qandeel-recovery-request')).toBeTruthy();
    expect(noticeSays(m.view, 'qandeel-recovery-request-notice', ACCESS.en.network)).toBe(true);
    expect(tree(m.view)).not.toContain(ACCESS.en.recoveryRequested);
    await m.view.unmount();
  });

  it('fewer than six digits is an incomplete code — never "incorrect" — and nothing is sent', async () => {
    const m = await mount();
    await toRecoveryCode(m);
    await type(m.view, 'qandeel-recovery-code-field', '١٢٣٤٥');
    expect(m.view.getByTestId('qandeel-recovery-code-field').props.value).toBe('12345');
    await press(m.view, 'qandeel-recovery-code-submit');
    expect(noticeSays(m.view, 'qandeel-recovery-code-notice', ACCESS.en.codeShape)).toBe(true);
    expect(m.port.recovery.verifications).toEqual([]);
    await m.view.unmount();
  });

  it('a provider-rejected code is the approved sentence, never a guessed "wrong" or "expired"', async () => {
    const m = await mount({ configure: (port) => port.recoveryCodeWith({ ok: false, failure: { kind: 'CODE_REJECTED', detail: DETAIL } }) });
    await toRecoveryCode(m);
    await type(m.view, 'qandeel-recovery-code-field', '999999');
    await press(m.view, 'qandeel-recovery-code-submit');
    expect(m.port.recovery.verifications).toEqual([{ email: 'reader@example.test', code: '999999' }]);
    expect(noticeSays(m.view, 'qandeel-recovery-code-notice', ACCESS.en.codeRejected)).toBe(true);
    expect(tree(m.view)).not.toMatch(/expired|incorrect|انتهت صلاحية|غير صحيح/u);
    await m.view.unmount();
  });

  it('resend asks again and repeats the generic result — it never claims a code was sent', async () => {
    const m = await mount();
    await toRecoveryCode(m);
    await type(m.view, 'qandeel-recovery-code-field', '123');
    await press(m.view, 'qandeel-recovery-code-resend');
    expect(m.port.recovery.requests).toHaveLength(2);
    expect(noticeSays(m.view, 'qandeel-recovery-code-notice', ACCESS.en.recoveryRequested)).toBe(true);
    expect(tree(m.view)).not.toContain('A new code was sent.');
    // The typed code is kept.
    expect(m.view.getByTestId('qandeel-recovery-code-field').props.value).toBe('123');
    await m.view.unmount();
  });

  it('a new password that does not match its confirmation is refused locally, and nothing is sent', async () => {
    const m = await mount();
    await toNewPassword(m);
    expect(m.view.getByTestId('qandeel-recovery-new-password')).toBeTruthy();
    await type(m.view, 'qandeel-recovery-new-password-field', 'new secret');
    await type(m.view, 'qandeel-recovery-confirm-password-field', 'new secreT');
    await press(m.view, 'qandeel-recovery-change-submit');
    expect(noticeSays(m.view, 'qandeel-recovery-confirm-password-field-message', ACCESS.en.passwordMismatch)).toBe(true);
    expect(m.port.recovery.updates).toEqual([]);
    await m.view.unmount();
  });

  it('the provider’s password rules, a lost connection and any other refusal each have their approved sentence', async () => {
    const m = await mount();
    await toNewPassword(m);
    const attempt = async () => {
      await type(m.view, 'qandeel-recovery-new-password-field', 'pw');
      await type(m.view, 'qandeel-recovery-confirm-password-field', 'pw');
      await press(m.view, 'qandeel-recovery-change-submit');
    };
    m.port.passwordUpdateWith({ ok: false, failure: { kind: 'WEAK_PASSWORD', detail: DETAIL } });
    await attempt();
    expect(noticeSays(m.view, 'qandeel-recovery-new-password-field-message', ACCESS.en.passwordRejected)).toBe(true);
    m.port.passwordUpdateWith({ ok: false, failure: { kind: 'NETWORK', detail: DETAIL } });
    await attempt();
    expect(noticeSays(m.view, 'qandeel-recovery-new-password-notice', ACCESS.en.network)).toBe(true);
    m.port.passwordUpdateWith({ ok: false, failure: { kind: 'UNEXPECTED', detail: DETAIL } });
    await attempt();
    expect(noticeSays(m.view, 'qandeel-recovery-new-password-notice', ACCESS.en.updateFailed)).toBe(true);
    expect(tree(m.view)).not.toContain(DETAIL);
    await m.view.unmount();
  });

  for (const language of ['en', 'ar'] as const) {
    it(`${language}: success is "Password changed." — the reader is STILL signed out, and signs in explicitly`, async () => {
      const m = await mount({ language });
      await toNewPassword(m);
      await type(m.view, 'qandeel-recovery-new-password-field', ' new secret ');
      await type(m.view, 'qandeel-recovery-confirm-password-field', ' new secret ');
      await press(m.view, 'qandeel-recovery-change-submit');
      // The password is sent untouched, once.
      expect(m.port.recovery.updates.map((update) => update.password)).toEqual([' new secret ']);
      expect(textOf(m.view, 'qandeel-recovery-completed-title')).toBe(ACCESS[language].passwordChanged);
      expect(m.auth.getState()).toEqual({ kind: 'SIGNED_OUT' });
      await press(m.view, 'qandeel-recovery-completed-return');
      expect(m.view.getByTestId('qandeel-sign-in-gateway')).toBeTruthy();
      expect(m.auth.getState()).toEqual({ kind: 'SIGNED_OUT' });
      // Only an explicit, ordinary sign-in authenticates.
      await signIn(m.view, 'reader@example.test', ' new secret ');
      expect(m.auth.getState()).toMatchObject({ kind: 'AUTHENTICATED', authGeneration: 1 });
      await m.view.unmount();
    });
  }

  it('leaving recovery retires the held recovery authority, and leaving is refused while a request is in flight', async () => {
    const m = await mount();
    await toNewPassword(m);
    await press(m.view, 'qandeel-recovery-new-password-return');
    expect(m.view.getByTestId('qandeel-sign-in-gateway')).toBeTruthy();
    expect(m.port.recovery.retired).toHaveLength(1);
    await m.view.unmount();

    const busy = await mount();
    await press(busy.view, 'qandeel-sign-in-forgot-password');
    await type(busy.view, 'qandeel-recovery-email', 'reader@example.test');
    const held = busy.port.blockRecoveryCode();
    busy.port.recoveryRequestWith({ ok: true });
    await press(busy.view, 'qandeel-recovery-send');
    await type(busy.view, 'qandeel-recovery-code-field', '123456');
    await fireEvent.press(busy.view.getByTestId('qandeel-recovery-code-submit'));
    await fireEvent.press(busy.view.getByTestId('qandeel-recovery-code-return'));
    expect(busy.view.getByTestId('qandeel-recovery-code')).toBeTruthy();
    held.open();
    await settle();
    expect(busy.port.recovery.verifications).toHaveLength(1);
    await busy.view.unmount();
  });

  it('Arabic recovery: approved words, and only the Latin fields stay left-to-right', async () => {
    const m = await mount({ language: 'ar' });
    await press(m.view, 'qandeel-sign-in-forgot-password');
    expect(within(m.view.getByTestId('qandeel-recovery-request')).getByText('إعادة تعيين كلمة المرور')).toBeTruthy();
    expect(m.view.getByTestId('qandeel-recovery-request').props.style).toEqual(expect.objectContaining({ direction: 'rtl' }));
    const field = m.view.getByTestId('qandeel-recovery-email');
    expect(Object.assign({}, ...[field.props.style].flat(2).filter(Boolean))).toEqual(expect.objectContaining({ textAlign: 'left', writingDirection: 'ltr' }));
    await m.view.unmount();
  });
});

describe('the unable-to-verify-session state', () => {
  async function unverified(language: ChromeLanguage = 'en') {
    const port = authPortDouble(null);
    port.restoreWith({ ok: false, failure: { kind: 'NETWORK', detail: DETAIL } });
    const auth = createMobileAuthAuthority({ port, foreground: createManualForegroundSignal('ACTIVE') });
    await auth.start();
    const view = await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <SessionVerificationRecovery auth={auth} locale={productLocale(language, language === 'ar' ? 'RTL' : 'LTR')} />
      </SafeAreaProvider>,
    );
    await settle();
    return { view, port, auth };
  }

  for (const language of ['en', 'ar'] as const) {
    it(`${language}: says the approved sentence, offers ONE act — Try again — and asks for no credential`, async () => {
      const { view } = await unverified(language);
      expect(textOf(view, 'qandeel-session-unverified-message')).toBe(ACCESS[language].sessionUnverified);
      expect(view.getByTestId('qandeel-session-unverified-retry').props.accessibilityLabel).toBe(ACCESS[language].tryAgain);
      expect(view.queryByTestId('qandeel-sign-in-gateway')).toBeNull();
      expect(tree(view)).not.toContain(DETAIL);
      await view.unmount();
    });
  }

  it('Try again re-asks the authoritative restore; a restored session authenticates', async () => {
    const { view, port, auth } = await unverified();
    port.restoreWith({ ok: true, value: { userId: 'alice', accessToken: 'token-a' } });
    await press(view, 'qandeel-session-unverified-retry');
    expect(port.restoreCount()).toBe(2);
    expect(auth.getState()).toMatchObject({ kind: 'AUTHENTICATED', userId: 'alice', authGeneration: 1 });
    await view.unmount();
  });

  it('a second press while the retry is in flight is the same retry', async () => {
    const { view, port } = await unverified();
    const held = gate();
    const original = port.restoreSession;
    port.restoreSession = async () => {
      await held.wait();
      return original();
    };
    await fireEvent.press(view.getByTestId('qandeel-session-unverified-retry'));
    await fireEvent.press(view.getByTestId('qandeel-session-unverified-retry'));
    expect(view.getByTestId('qandeel-session-unverified-retry').props.accessibilityState).toEqual(expect.objectContaining({ busy: true }));
    held.open();
    await settle();
    expect(port.restoreCount()).toBe(2);
    await view.unmount();
  });
});

test('no credential, code or token is logged anywhere in these flows', async () => {
  const spies = (['log', 'info', 'warn', 'debug'] as const).map((level) => jest.spyOn(console, level).mockImplementation(() => undefined));
  try {
    const m = await mount();
    await signIn(m.view, 'mona.ali', 'secret-password');
    await m.view.unmount();
    const r = await mount();
    await toNewPassword(r);
    await type(r.view, 'qandeel-recovery-new-password-field', 'new-secret');
    await type(r.view, 'qandeel-recovery-confirm-password-field', 'new-secret');
    await press(r.view, 'qandeel-recovery-change-submit');
    await r.view.unmount();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
});
