/**
 * W1B-01 — the Auth Gateway destination as a reader meets it: Sign in → Create account → Verify Email.
 *
 * The auth authority is the REAL one over the T-12P port double, so the generation rule and the
 * explicit-completion barrier under test are production's; only the network is a double. The Sign-in
 * form is T-14's own, rendered through the destination's seam exactly as `ProductRoot` renders it.
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { AccountEntry, accountEntryCopy, type LoginIdAvailability } from '..';
import { ProductSignInGateway, productLocale } from '../../integration';
import type { ChromeLanguage } from '../../orientation-chrome';
import { createMobileAuthAuthority, createManualForegroundSignal, type LoginIdAvailabilityOutcome, type MobileAuthAuthority } from '../../runtime-entry';
import { authPortDouble, gate, type AuthPortDouble } from '../../runtime-entry/__fixtures__/runtime-entry';

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };
const DETAIL = 'PROVIDER-DETAIL-MUST-NOT-BE-RENDERED';
const EN = accountEntryCopy('en');
const AR = accountEntryCopy('ar');

interface Mounted {
  readonly view: RenderResult;
  readonly port: AuthPortDouble;
  readonly auth: MobileAuthAuthority;
  readonly checks: string[];
  answerAvailability(outcome: LoginIdAvailabilityOutcome): void;
}

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

async function mount(language: ChromeLanguage = 'en', direction: 'LTR' | 'RTL' = language === 'ar' ? 'RTL' : 'LTR'): Promise<Mounted> {
  const port = authPortDouble(null);
  const auth = createMobileAuthAuthority({ port, foreground: createManualForegroundSignal('ACTIVE') });
  await auth.start();
  const checks: string[] = [];
  let availability: LoginIdAvailabilityOutcome = { kind: 'AVAILABLE' };
  const loginIds: LoginIdAvailability = {
    check: async (loginId) => {
      checks.push(loginId);
      return availability;
    },
  };
  const locale = productLocale(language, direction);
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <AccountEntry
        auth={auth}
        loginIds={loginIds}
        locale={locale}
        renderSignIn={({ footer, onEmailNotConfirmed }) => (
          <ProductSignInGateway auth={auth} locale={locale} footer={footer} onEmailNotConfirmed={onEmailNotConfirmed} />
        )}
      />
    </SafeAreaProvider>,
  );
  await settle();
  return {
    view,
    port,
    auth,
    checks,
    answerAvailability: (outcome) => {
      availability = outcome;
    },
  };
}

const tree = (view: RenderResult) => JSON.stringify(view.toJSON());
const press = async (view: RenderResult, id: string) => {
  await fireEvent.press(view.getByTestId(id));
  await settle();
};
const type = async (view: RenderResult, id: string, text: string) => {
  await fireEvent.changeText(view.getByTestId(id), text);
};

async function toCreateAccount(view: RenderResult) {
  await press(view, 'qandeel-sign-in-create-account');
}

async function fillAccount(view: RenderResult, values: Partial<Record<'name' | 'loginId' | 'email' | 'password', string>> = {}) {
  await type(view, 'qandeel-create-account-name', values.name ?? '  منى علي ');
  await type(view, 'qandeel-create-account-login-id', values.loginId ?? 'Mona.Ali');
  await type(view, 'qandeel-create-account-email', values.email ?? ' mona@example.test ');
  await type(view, 'qandeel-create-account-password', values.password ?? ' exact Pässword ');
}

async function toVerify(m: Mounted) {
  await toCreateAccount(m.view);
  await fillAccount(m.view);
  await press(m.view, 'qandeel-create-account-submit');
}

describe('Sign in → Create account', () => {
  it('the Sign-in form offers the approved entry, and Create account asks for exactly Name, Login ID, Email and Password', async () => {
    const { view } = await mount('en');
    expect(view.getByTestId('qandeel-sign-in-gateway')).toBeTruthy();
    expect(view.getByText(EN.createAccountTitle)).toBeTruthy();
    await toCreateAccount(view);
    expect(view.getByTestId('qandeel-create-account-title').props.children).toBe(EN.createAccountTitle);
    for (const label of [EN.nameLabel, EN.loginIdLabel, EN.emailLabel, EN.passwordLabel]) expect(view.getAllByText(label).length).toBeGreaterThan(0);
    // The Login ID help is PERSISTENT text, and it is also the field's spoken hint.
    expect(view.getByTestId('qandeel-create-account-login-id-help').props.children).toBe(EN.loginIdHelp);
    expect(view.getByTestId('qandeel-create-account-login-id').props.accessibilityHint).toBe(EN.loginIdHelp);
    expect(tree(view).match(/"type":"TextInput"/gu)).toHaveLength(4);
    for (const absent of ['photo', 'Photo', 'age', 'Gender', 'Country', 'First name', 'Last name', 'Skip']) expect(tree(view)).not.toContain(`"${absent}"`);
    await view.unmount();
  });

  it('Arabic: the approved words, and only the Latin fields stay left-to-right', async () => {
    const { view } = await mount('ar');
    await toCreateAccount(view);
    expect(view.getByTestId('qandeel-create-account-title').props.children).toBe(AR.createAccountTitle);
    expect(view.getByTestId('qandeel-create-account-login-id-help').props.children).toBe(AR.loginIdHelp);
    const flat = (id: string) => StyleSheet.flatten(view.getByTestId(id).props.style) as Record<string, unknown>;
    for (const latin of ['qandeel-create-account-login-id', 'qandeel-create-account-email', 'qandeel-create-account-password']) {
      expect(flat(latin)).toMatchObject({ textAlign: 'left', writingDirection: 'ltr' });
    }
    expect(flat('qandeel-create-account-name')).toMatchObject({ textAlign: 'right', writingDirection: 'rtl' });
    expect(view.getByTestId('qandeel-create-account-password').props.secureTextEntry).toBe(true);
    expect(view.getByTestId('qandeel-create-account-email').props.keyboardType).toBe('email-address');
    await view.unmount();
  });

  it('an empty form is refused locally in the approved words, and nothing is asked of anyone', async () => {
    const m = await mount('en');
    await toCreateAccount(m.view);
    await press(m.view, 'qandeel-create-account-submit');
    const text = tree(m.view);
    for (const message of [EN.emptyName, EN.emptyLoginId, EN.invalidEmail, EN.passwordRejected]) expect(text).toContain(message);
    expect(m.checks).toEqual([]);
    expect(m.port.signUps).toEqual([]);
    await m.view.unmount();
  });

  it('a malformed Login ID has its own approved sentence, and is never checked or sent', async () => {
    const m = await mount('ar');
    await toCreateAccount(m.view);
    await fillAccount(m.view, { loginId: 'mo..na' });
    await press(m.view, 'qandeel-create-account-submit');
    expect(tree(m.view)).toContain(AR.malformedLoginId);
    expect(m.checks).toEqual([]);
    expect(m.port.signUps).toEqual([]);
    await m.view.unmount();
  });

  it('a taken Login ID is unavailable — asked by its canonical form — and no account is created', async () => {
    const m = await mount('en');
    m.answerAvailability({ kind: 'TAKEN' });
    await toCreateAccount(m.view);
    await fillAccount(m.view);
    await press(m.view, 'qandeel-create-account-submit');
    expect(m.checks).toEqual(['mona.ali']);
    expect(tree(m.view)).toContain(EN.loginIdUnavailable);
    expect(m.port.signUps).toEqual([]);
    await m.view.unmount();
  });

  it('a failed availability question over the network says so, and creates nothing', async () => {
    const m = await mount('en');
    m.answerAvailability({ kind: 'NETWORK' });
    await toCreateAccount(m.view);
    await fillAccount(m.view);
    await press(m.view, 'qandeel-create-account-submit');
    expect(tree(m.view)).toContain(EN.network);
    expect(m.port.signUps).toEqual([]);
    await m.view.unmount();
  });

  it('success creates the account with exactly what was typed — Name trimmed, Login ID canonical, password untouched — and signs nobody in', async () => {
    const m = await mount('en');
    await toVerify(m);
    expect(m.port.signUps).toEqual([{ email: 'mona@example.test', password: ' exact Pässword ', identity: { name: 'منى علي', loginId: 'mona.ali' } }]);
    expect(m.view.getByTestId('qandeel-verify-email-title').props.children).toBe(EN.verifyTitle);
    expect(m.view.getByTestId('qandeel-verify-email-instruction').props.children).toBe(EN.verifyInstruction('mona@example.test'));
    expect(m.auth.getState()).toEqual({ kind: 'SIGNED_OUT' });
    await m.view.unmount();
  });

  it.each([
    ['REFUSED', 'accountRefused'],
    ['WEAK_PASSWORD', 'passwordRejected'],
    ['INVALID_EMAIL', 'invalidEmail'],
    ['NETWORK', 'network'],
  ] as const)('a %s refusal is the approved %s sentence, and the provider’s words never show', async (kind, key) => {
    const m = await mount('en');
    m.port.signUpWith({ ok: false, failure: { kind, detail: DETAIL } });
    await toCreateAccount(m.view);
    await fillAccount(m.view);
    await press(m.view, 'qandeel-create-account-submit');
    expect(tree(m.view)).toContain(EN[key]);
    expect(tree(m.view)).not.toContain(DETAIL);
    expect(m.view.queryByTestId('qandeel-verify-email')).toBeNull();
    await m.view.unmount();
  });

  it('a second press while the first submission is in flight makes no second request, and leaving is refused meanwhile', async () => {
    const m = await mount('en');
    const held = gate();
    const answered: LoginIdAvailabilityOutcome = { kind: 'AVAILABLE' };
    const slow: LoginIdAvailability = { check: async () => { await held.wait(); return answered; } };
    await m.view.unmount();
    const locale = productLocale('en', 'LTR');
    const view = await render(
      <SafeAreaProvider initialMetrics={METRICS}>
        <AccountEntry auth={m.auth} loginIds={slow} locale={locale} renderSignIn={(slot) => <ProductSignInGateway auth={m.auth} locale={locale} {...slot} />} />
      </SafeAreaProvider>,
    );
    await settle();
    await toCreateAccount(view);
    await fillAccount(view);
    await fireEvent.press(view.getByTestId('qandeel-create-account-submit'));
    await fireEvent.press(view.getByTestId('qandeel-create-account-submit'));
    await fireEvent.press(view.getByTestId('qandeel-create-account-return'));
    expect(view.getByTestId('qandeel-create-account')).toBeTruthy();
    expect(view.getByTestId('qandeel-create-account-submit').props.accessibilityState).toMatchObject({ busy: true });
    held.open();
    await settle();
    expect(m.port.signUps).toHaveLength(1);
    await view.unmount();
  });

  it('the approved return control goes back to Sign in and authenticates nobody', async () => {
    const m = await mount('ar');
    await toCreateAccount(m.view);
    expect(m.view.getByTestId('qandeel-create-account-return').props.accessibilityLabel).toBe(AR.returnFromCreateAccount);
    await press(m.view, 'qandeel-create-account-return');
    expect(m.view.getByTestId('qandeel-sign-in-gateway')).toBeTruthy();
    expect(m.auth.getState()).toEqual({ kind: 'SIGNED_OUT' });
    await m.view.unmount();
  });
});

describe('Verify Email', () => {
  it('fewer than six digits are an incorrect code, and nothing is sent', async () => {
    const m = await mount('en');
    await toVerify(m);
    const verify = jest.spyOn(m.port, 'verifyEmailCode');
    await type(m.view, 'qandeel-verify-email-code', '123');
    await press(m.view, 'qandeel-verify-email-submit');
    expect(tree(m.view)).toContain(EN.codeIncorrect);
    expect(verify).not.toHaveBeenCalled();
    await m.view.unmount();
  });

  it('the code field keeps six digits and reads Arabic-Indic digits', async () => {
    const m = await mount('ar');
    await toVerify(m);
    const typed = Array.from({ length: 7 }, (_, i) => String.fromCodePoint(0x0661 + i)).join('');
    await type(m.view, 'qandeel-verify-email-code', typed);
    expect(m.view.getByTestId('qandeel-verify-email-code').props.value).toBe('123456');
    expect(m.view.getByTestId('qandeel-verify-email-code').props.keyboardType).toBe('number-pad');
    await m.view.unmount();
  });

  it.each(['en', 'ar'] as const)('%s: a provider-rejected code is never guessed incorrect or expired — it is the approved generic sentence', async (language) => {
    const copy = accountEntryCopy(language);
    const m = await mount(language);
    await toVerify(m);
    m.port.verifyWith({ ok: false, failure: { kind: 'CODE_REJECTED', detail: DETAIL } });
    await type(m.view, 'qandeel-verify-email-code', '000000');
    await press(m.view, 'qandeel-verify-email-submit');
    expect(tree(m.view)).toContain(copy.verifyFailed);
    expect(tree(m.view)).not.toContain(copy.codeIncorrect);
    // Pressed again much later: no clock turns the same provider answer into a claim.
    const later = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 24 * 60 * 60 * 1000);
    await press(m.view, 'qandeel-verify-email-submit');
    later.mockRestore();
    const text = tree(m.view);
    expect(text).toContain(copy.verifyFailed);
    for (const claim of [copy.codeIncorrect, copy.codeExpired, DETAIL]) expect(text).not.toContain(claim);
    expect(m.auth.getState()).toEqual({ kind: 'SIGNED_OUT' });
    await m.view.unmount();
  });

  it.each([
    ['CODE_REJECTED', 'verifyFailed'],
    ['UNEXPECTED', 'verifyFailed'],
    ['NETWORK', 'network'],
  ] as const)('a %s verification failure is the approved %s sentence', async (kind, key) => {
    const m = await mount('ar');
    await toVerify(m);
    m.port.verifyWith({ ok: false, failure: { kind, detail: DETAIL } });
    await type(m.view, 'qandeel-verify-email-code', '123456');
    await press(m.view, 'qandeel-verify-email-submit');
    expect(tree(m.view)).toContain(AR[key]);
    expect(m.auth.getState()).toEqual({ kind: 'SIGNED_OUT' });
    await m.view.unmount();
  });

  it('resend keeps the typed code and says a new code was sent', async () => {
    const m = await mount('en');
    await toVerify(m);
    await type(m.view, 'qandeel-verify-email-code', '123456');
    await press(m.view, 'qandeel-verify-email-resend');
    expect(tree(m.view)).toContain(EN.resendSucceeded);
    expect(m.view.getByTestId('qandeel-verify-email-code').props.value).toBe('123456');
    m.port.verifyWith({ ok: false, failure: { kind: 'CODE_REJECTED', detail: DETAIL } });
    await press(m.view, 'qandeel-verify-email-submit');
    expect(tree(m.view)).toContain(EN.verifyFailed);
    expect(tree(m.view)).not.toContain(EN.codeIncorrect);
    await m.view.unmount();
  });

  it('a refused resend is the approved sentence; a transport failure is the network sentence', async () => {
    const m = await mount('en');
    await toVerify(m);
    m.port.resendWith({ ok: false, failure: { kind: 'REFUSED', detail: DETAIL } });
    await press(m.view, 'qandeel-verify-email-resend');
    expect(tree(m.view)).toContain(EN.resendFailed);
    m.port.resendWith({ ok: false, failure: { kind: 'NETWORK', detail: DETAIL } });
    await press(m.view, 'qandeel-verify-email-resend');
    expect(tree(m.view)).toContain(EN.network);
    expect(tree(m.view)).not.toContain(DETAIL);
    await m.view.unmount();
  });

  it('a verified code is the explicit completion that establishes the identity', async () => {
    const m = await mount('en');
    await toVerify(m);
    m.port.verifyWith({ ok: true, value: { userId: 'mona', accessToken: 'token-mona' } });
    await type(m.view, 'qandeel-verify-email-code', '123456');
    await press(m.view, 'qandeel-verify-email-submit');
    expect(m.auth.getState()).toEqual({ kind: 'AUTHENTICATED', userId: 'mona', accessToken: 'token-mona', authGeneration: 1 });
    await m.view.unmount();
  });

  it('the approved return control leaves verification without authenticating anyone', async () => {
    const m = await mount('ar');
    await toVerify(m);
    expect(m.view.getByTestId('qandeel-verify-email-return').props.accessibilityLabel).toBe(AR.returnFromVerify);
    await press(m.view, 'qandeel-verify-email-return');
    expect(m.view.getByTestId('qandeel-sign-in-gateway')).toBeTruthy();
    expect(m.auth.getState()).toEqual({ kind: 'SIGNED_OUT' });
    await m.view.unmount();
  });
});

describe('Sign in with an unverified Email', () => {
  it('a correct password on an unverified Email goes straight to Verify Email, whose rejected code is never guessed expired', async () => {
    const m = await mount('en');
    m.port.signInWith({ ok: false, failure: { kind: 'EMAIL_NOT_CONFIRMED', detail: DETAIL } });
    await type(m.view, 'qandeel-sign-in-email', ' mona@example.test ');
    await type(m.view, 'qandeel-sign-in-password', 'right password');
    await press(m.view, 'qandeel-sign-in-submit');
    expect(m.view.getByTestId('qandeel-verify-email-instruction').props.children).toBe(EN.verifyInstruction('mona@example.test'));
    expect(tree(m.view)).not.toContain(DETAIL);
    m.port.verifyWith({ ok: false, failure: { kind: 'CODE_REJECTED', detail: DETAIL } });
    await type(m.view, 'qandeel-verify-email-code', '123456');
    await press(m.view, 'qandeel-verify-email-submit');
    expect(tree(m.view)).toContain(EN.verifyFailed);
    expect(tree(m.view)).not.toContain(EN.codeExpired);
    await m.view.unmount();
  });

  it('a wrong password is still the one generic sentence — nothing about verification', async () => {
    const m = await mount('en');
    m.port.signInWith({ ok: false, failure: { kind: 'INVALID_CREDENTIALS', detail: DETAIL } });
    await type(m.view, 'qandeel-sign-in-email', 'mona@example.test');
    await type(m.view, 'qandeel-sign-in-password', 'wrong');
    await press(m.view, 'qandeel-sign-in-submit');
    // W2-01 re-anchor: the one generic sentence is now the approved final one (W2-01 record §2); the
    // expired fact is T-14's "Email or password is incorrect.". The claim is unchanged: one sentence.
    expect(tree(m.view)).toContain('We couldn’t sign you in with these details. Check them and try again.');
    expect(m.view.queryByTestId('qandeel-verify-email')).toBeNull();
    expect(tree(m.view)).not.toContain(DETAIL);
    await m.view.unmount();
  });
});
