/**
 * T-14 §16.A — the Product sign-in gateway, as a reader meets it.
 *
 * Every assertion here is about the SURFACE and its one call. The auth authority is a deterministic
 * double because T-12P already proves the transport, the generation rule and the sign-out race on
 * its own; re-proving them through a form would prove them worse and would make this suite depend on
 * a network it cannot have.
 */
import { act, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { isPressTarget, nodes } from '../../responsive/__fixtures__/composition';
import {
  PRODUCT_SIGN_IN_GATEWAY_TEST_ID,
  ProductSignInGateway,
  SIGN_IN_EMAIL_TEST_ID,
  SIGN_IN_NOTICE_TEST_ID,
  SIGN_IN_PASSWORD_TEST_ID,
  SIGN_IN_SUBMIT_TEST_ID,
  SIGN_IN_TITLE_TEST_ID,
  productSignInCopy,
} from '../auth-gateway';
import { productLocale, type LayoutDirection } from '../locale/product-locale';
import { authAuthorityDouble, authFailure, type AuthAuthorityDouble } from '../__fixtures__/auth-gateway';
import type { ChromeLanguage } from '../../orientation-chrome';

const AR = productSignInCopy('ar');
const EN = productSignInCopy('en');

/** The exact frozen copy of §6, written here as literals so a drift in either file is a failure. */
const FROZEN = {
  ar: {
    title: 'تسجيل الدخول',
    emailLabel: 'البريد الإلكتروني',
    passwordLabel: 'كلمة المرور',
    submit: 'دخول',
    submitting: 'جارٍ تسجيل الدخول',
    missingEmail: 'أدخل البريد الإلكتروني.',
    missingPassword: 'أدخل كلمة المرور.',
    invalidCredentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    network: 'تعذّر الاتصال. حاول مرة أخرى.',
    unexpected: 'تعذّر تسجيل الدخول الآن. حاول مرة أخرى.',
  },
  en: {
    title: 'Sign in',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    submit: 'Sign in',
    submitting: 'Signing in',
    missingEmail: 'Enter your email.',
    missingPassword: 'Enter your password.',
    invalidCredentials: 'Email or password is incorrect.',
    network: 'Couldn’t connect. Try again.',
    unexpected: 'Couldn’t sign in right now. Try again.',
  },
} as const;

interface Mounted {
  readonly view: RenderResult;
  readonly auth: AuthAuthorityDouble;
}

/**
 * The reader's real device, as the app's own safe-area provider supplies it.
 *
 * The gateway consumes the insets the app already mounts a provider for, so a test that rendered it
 * without one would be testing a surface the Product never shows.
 */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
};

async function mount(options: { language?: ChromeLanguage; direction?: LayoutDirection } = {}): Promise<Mounted> {
  const auth = authAuthorityDouble();
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ProductSignInGateway auth={auth} locale={productLocale(options.language ?? 'en', options.direction ?? 'LTR')} />
    </SafeAreaProvider>,
  );
  return { view, auth };
}

/** Fill both fields with something valid, so a test about submission is not really a test about validation. */
async function fill(view: RenderResult, email = 'reader@example.test', password = 'correct horse'): Promise<void> {
  await fireEvent.changeText(view.getByTestId(SIGN_IN_EMAIL_TEST_ID), email);
  await fireEvent.changeText(view.getByTestId(SIGN_IN_PASSWORD_TEST_ID), password);
}

/**
 * The title, read through its own identifier.
 *
 * In English the title and the submit label are the SAME frozen word, so a text query would be
 * ambiguous — and that ambiguity is a fact about the frozen copy, not a defect to work around.
 */
const titleText = (view: RenderResult): unknown => view.getByTestId(SIGN_IN_TITLE_TEST_ID).props.children;

/** Whether the submit control renders exactly this label inside itself. */
const submitSays = (view: RenderResult, text: string): boolean =>
  within(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID)).queryByText(text) !== null;

/** Whether the ONE status/error region currently says exactly this sentence. */
const noticeSays = (view: RenderResult, text: string): boolean =>
  within(view.getByTestId(SIGN_IN_NOTICE_TEST_ID)).queryByText(text) !== null;

const tree = (view: RenderResult): string => JSON.stringify(view.toJSON());

/** The props of one rendered host node. `nodes` is deliberately untyped, so this is where the cast lives. */
const propsOf = (node: Record<string, unknown>): Record<string, unknown> => (node.props ?? {}) as Record<string, unknown>;

/** One node's style, flattened, whatever shape the component happened to pass it in. */
function styleOf(node: Record<string, unknown>): Record<string, unknown> {
  const style = propsOf(node).style;
  if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean)) as Record<string, unknown>;
  return (style ?? {}) as Record<string, unknown>;
}

describe('T14-A1, T14-A2 — the frozen bilingual copy is exact', () => {
  it('the Arabic pack is the frozen Arabic, word for word', async () => {
    expect(AR).toEqual(FROZEN.ar);
  });

  it('the English pack is the frozen English, word for word', async () => {
    expect(EN).toEqual(FROZEN.en);
  });

  it('the rendered Arabic surface carries the frozen title, labels and submit', async () => {
    const { view } = await mount({ language: 'ar' });
    expect(titleText(view)).toBe(FROZEN.ar.title);
    expect(view.getByText(FROZEN.ar.emailLabel)).toBeTruthy();
    expect(view.getByText(FROZEN.ar.passwordLabel)).toBeTruthy();
    expect(submitSays(view, FROZEN.ar.submit)).toBe(true);
    // And not one word of the other pack leaked in beside it.
    expect(view.queryByText(FROZEN.en.emailLabel)).toBeNull();
    expect(view.queryByText(FROZEN.en.passwordLabel)).toBeNull();
    await view.unmount();
  });

  it('the rendered English surface carries the frozen title, labels and submit', async () => {
    const { view } = await mount({ language: 'en' });
    expect(titleText(view)).toBe(FROZEN.en.title);
    expect(view.getByText(FROZEN.en.emailLabel)).toBeTruthy();
    expect(view.getByText(FROZEN.en.passwordLabel)).toBeTruthy();
    expect(submitSays(view, FROZEN.en.submit)).toBe(true);
    expect(view.queryByText(FROZEN.ar.title)).toBeNull();
    expect(view.queryByText(FROZEN.ar.emailLabel)).toBeNull();
    await view.unmount();
  });
});

describe('T14-A3, T14-A4 — language and direction are independent axes', () => {
  it('Arabic renders under an LTR layout, and says so in its layout rather than in its words', async () => {
    const { view } = await mount({ language: 'ar', direction: 'LTR' });
    const gateway = view.getByTestId(PRODUCT_SIGN_IN_GATEWAY_TEST_ID);
    expect(gateway.props.style).toEqual(expect.objectContaining({ direction: 'ltr' }));
    // The WORDS are still Arabic: the direction changed the layout and nothing else.
    expect(titleText(view)).toBe(FROZEN.ar.title);
    await view.unmount();
  });

  it('English renders under an RTL layout, with the English words unchanged', async () => {
    const { view } = await mount({ language: 'en', direction: 'RTL' });
    const gateway = view.getByTestId(PRODUCT_SIGN_IN_GATEWAY_TEST_ID);
    expect(gateway.props.style).toEqual(expect.objectContaining({ direction: 'rtl' }));
    expect(titleText(view)).toBe(FROZEN.en.title);
    await view.unmount();
  });

  it('the surface derives neither axis from the other: all four combinations render', async () => {
    for (const language of ['ar', 'en'] as const) {
      for (const direction of ['LTR', 'RTL'] as const) {
        const { view } = await mount({ language, direction });
        expect(titleText(view)).toBe(FROZEN[language].title);
        expect(view.getByTestId(PRODUCT_SIGN_IN_GATEWAY_TEST_ID).props.style).toEqual(
          expect.objectContaining({ direction: direction === 'RTL' ? 'rtl' : 'ltr' }),
        );
        await view.unmount();
      }
    }
  });
});

describe('T14-A5, T14-A6 — what crosses the boundary is exactly what the reader typed', () => {
  it('the email is trimmed at SUBMIT time, and never rewritten in the field', async () => {
    const { view, auth } = await mount();
    auth.answerWith(authFailure('NETWORK'));
    const typed = '  Reader@Example.Test  ';
    await fill(view, typed, 'correct horse');
    // Untouched in the UI: no trim, no lowercase, no normalization of the reader's own value.
    expect(view.getByTestId(SIGN_IN_EMAIL_TEST_ID).props.value).toBe(typed);
    await fireEvent.press(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID));
    expect(auth.calls).toEqual([{ email: 'Reader@Example.Test', password: 'correct horse' }]);
    // Case is preserved: trimming is the ONLY transformation, and it is not a normalization.
    expect(auth.calls[0].email).not.toBe('reader@example.test');
    expect(view.getByTestId(SIGN_IN_EMAIL_TEST_ID).props.value).toBe(typed);
    await view.unmount();
  });

  it('the password crosses character for character — spaces, case and non-ASCII all survive', async () => {
    const { view, auth } = await mount();
    auth.answerWith(authFailure('NETWORK'));
    const password = '  Pä ss wörd 123  ';
    await fill(view, 'reader@example.test', password);
    await fireEvent.press(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID));
    expect(auth.calls[0].password).toBe(password);
    expect(auth.calls[0].password.length).toBe(password.length);
    await view.unmount();
  });
});

describe('T14-A7, T14-A8 — a missing field never reaches the auth authority', () => {
  it('an empty email refuses locally, in the reader’s language, and calls nothing', async () => {
    const { view, auth } = await mount({ language: 'ar' });
    await fill(view, '   ', 'correct horse');
    await fireEvent.press(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID));
    expect(auth.calls).toEqual([]);
    expect(noticeSays(view, FROZEN.ar.missingEmail)).toBe(true);
    await view.unmount();
  });

  it('an empty password refuses locally and calls nothing', async () => {
    const { view, auth } = await mount();
    await fill(view, 'reader@example.test', '');
    await fireEvent.press(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID));
    expect(auth.calls).toEqual([]);
    expect(noticeSays(view, FROZEN.en.missingPassword)).toBe(true);
    await view.unmount();
  });

  it('an email that is only whitespace is empty, and a password that is only whitespace is not', async () => {
    const { view, auth } = await mount();
    auth.answerWith(authFailure('NETWORK'));
    await fill(view, 'reader@example.test', '   ');
    await fireEvent.press(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID));
    // A password is never trimmed, so three spaces is a three-character password and is submitted.
    expect(auth.calls).toEqual([{ email: 'reader@example.test', password: '   ' }]);
    await view.unmount();
  });
});

describe('T14-A9, T14-A10 — one submit is one call, and a second press while pending is ignored', () => {
  it('one press makes exactly one call', async () => {
    const { view, auth } = await mount();
    auth.answerWith(authFailure('NETWORK'));
    await fill(view);
    await fireEvent.press(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID));
    expect(auth.calls).toHaveLength(1);
    await view.unmount();
  });

  it('a second press while the first is in flight makes no second call, and the control says it is busy', async () => {
    const { view, auth } = await mount();
    await fill(view);
    await fireEvent.press(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID));
    expect(auth.calls).toHaveLength(1);
    expect(auth.pending()).toBe(true);

    const submit = view.getByTestId(SIGN_IN_SUBMIT_TEST_ID);
    expect(submit.props.accessibilityState).toEqual(expect.objectContaining({ busy: true, disabled: true }));
    // The live region says what is happening rather than leaving the reader with a silent surface.
    expect(noticeSays(view, FROZEN.en.submitting)).toBe(true);

    // The guard is the handler's, not the renderer's: the press is delivered and refused.
    await fireEvent.press(submit);
    await fireEvent.press(submit);
    expect(auth.calls).toHaveLength(1);

    await act(async () => {
      await auth.settle(authFailure('NETWORK'));
    });
    expect(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID).props.accessibilityState).toEqual(
      expect.objectContaining({ busy: false, disabled: false }),
    );
    await view.unmount();
  });

  it('there is no automatic retry: a refused sign-in issues exactly one call and then waits for the reader', async () => {
    const { view, auth } = await mount();
    auth.answerWith(authFailure('NETWORK'));
    await fill(view);
    await fireEvent.press(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID));
    // Every timer in this environment is real, so an unattended wait is the honest way to ask
    // whether anything is scheduled behind the reader's back.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(auth.calls).toHaveLength(1);
    await view.unmount();
  });
});

describe('T14-A11…A13 — the three typed failures map to frozen Product copy, and leak no detail', () => {
  const CASES = [
    { kind: 'INVALID_CREDENTIALS', copy: 'invalidCredentials' },
    { kind: 'NETWORK', copy: 'network' },
    { kind: 'UNEXPECTED', copy: 'unexpected' },
  ] as const;

  for (const { kind, copy } of CASES) {
    for (const language of ['ar', 'en'] as const) {
      it(`${kind} becomes the frozen ${language} copy and never the provider's words`, async () => {
        const { view, auth } = await mount({ language });
        auth.answerWith(authFailure(kind));
        await fill(view);
        await fireEvent.press(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID));
        expect(noticeSays(view, FROZEN[language][copy])).toBe(true);
        // The detail the port carries is technical, and no Product surface may show it.
        expect(tree(view)).not.toContain('PROVIDER-DETAIL-MUST-NOT-BE-RENDERED');
        expect(tree(view)).not.toContain(kind);
        await view.unmount();
      });
    }
  }

  it('no failure copy claims an account exists separately from the credential being wrong', async () => {
    // One sentence for both halves, in both languages: the surface never distinguishes "no such
    // reader" from "wrong password", because doing so is an account-enumeration oracle.
    for (const language of ['ar', 'en'] as const) {
      for (const absent of ['account', 'exist', 'register', 'حساب', 'مسجل']) {
        expect(FROZEN[language].invalidCredentials).not.toContain(absent);
      }
    }
  });
});

describe('T14-A14, T14-A15 — what happens to the password after a refusal', () => {
  it('INVALID_CREDENTIALS clears the password and keeps the email', async () => {
    const { view, auth } = await mount();
    auth.answerWith(authFailure('INVALID_CREDENTIALS'));
    await fill(view, 'reader@example.test', 'wrong one');
    await fireEvent.press(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID));
    expect(view.getByTestId(SIGN_IN_PASSWORD_TEST_ID).props.value).toBe('');
    expect(view.getByTestId(SIGN_IN_EMAIL_TEST_ID).props.value).toBe('reader@example.test');
    await view.unmount();
  });

  it('UNEXPECTED clears the password', async () => {
    const { view, auth } = await mount();
    auth.answerWith(authFailure('UNEXPECTED'));
    await fill(view, 'reader@example.test', 'wrong one');
    await fireEvent.press(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID));
    expect(view.getByTestId(SIGN_IN_PASSWORD_TEST_ID).props.value).toBe('');
    await view.unmount();
  });

  it('NETWORK preserves the password, so an explicit retry costs no re-entry', async () => {
    const { view, auth } = await mount();
    auth.answerWith(authFailure('NETWORK'));
    await fill(view, 'reader@example.test', 'correct horse');
    await fireEvent.press(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID));
    expect(view.getByTestId(SIGN_IN_PASSWORD_TEST_ID).props.value).toBe('correct horse');
    // And the reader's own second press is a second call — an explicit retry, never an automatic one.
    await fireEvent.press(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID));
    expect(auth.calls).toHaveLength(2);
    await view.unmount();
  });
});

describe('T14-A16 — a late completion after unmount mutates nothing', () => {
  it('settling a sign-in that outlived its surface neither throws nor warns', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const warnings = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const { view, auth } = await mount();
      await fill(view);
      await fireEvent.press(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID));
      expect(auth.pending()).toBe(true);
      await view.unmount();

      // The identical completion on a MOUNTED surface writes the frozen sentence into the live
      // region — the failure-mapping tests above prove exactly that — so this is not vacuous. What
      // is asserted here is that the same completion, arriving after the surface is gone, is inert:
      // it neither throws nor produces the React complaint an unguarded state update would.
      await act(async () => {
        await auth.settle(authFailure('INVALID_CREDENTIALS'));
      });
      expect(errors).not.toHaveBeenCalled();
      expect(warnings).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
      warnings.mockRestore();
    }
  });
});

describe('T14-A17, T14-A18 — input semantics and platform intent', () => {
  it('the password is masked, never trimmed, never auto-capitalized and never autocorrected', async () => {
    const { view } = await mount();
    const password = view.getByTestId(SIGN_IN_PASSWORD_TEST_ID);
    expect(password.props.secureTextEntry).toBe(true);
    expect(password.props.autoCapitalize).toBe('none');
    expect(password.props.autoCorrect).toBe(false);
    expect(password.props.autoComplete).toBe('current-password');
    expect(password.props.textContentType).toBe('password');
    await view.unmount();
  });

  it('the email declares its keyboard and its autofill intent', async () => {
    const { view } = await mount();
    const email = view.getByTestId(SIGN_IN_EMAIL_TEST_ID);
    expect(email.props.keyboardType).toBe('email-address');
    expect(email.props.autoCapitalize).toBe('none');
    expect(email.props.autoCorrect).toBe(false);
    expect(email.props.autoComplete).toBe('email');
    expect(email.props.textContentType).toBe('emailAddress');
    expect(email.props.secureTextEntry).toBeFalsy();
    await view.unmount();
  });

  it('Return moves from the email to the password, and Return from the password submits', async () => {
    const { view, auth } = await mount();
    expect(view.getByTestId(SIGN_IN_EMAIL_TEST_ID).props.returnKeyType).toBe('next');
    expect(view.getByTestId(SIGN_IN_PASSWORD_TEST_ID).props.returnKeyType).toBe('done');
    auth.answerWith(authFailure('NETWORK'));
    await fill(view);
    await fireEvent(view.getByTestId(SIGN_IN_EMAIL_TEST_ID), 'submitEditing');
    // Moving focus is not submitting.
    expect(auth.calls).toHaveLength(0);
    await fireEvent(view.getByTestId(SIGN_IN_PASSWORD_TEST_ID), 'submitEditing');
    expect(auth.calls).toHaveLength(1);
    await view.unmount();
  });

  it('no field disables font scaling, and no label or message does either', async () => {
    const { view } = await mount({ language: 'ar' });
    for (const node of nodes(view.toJSON())) {
      expect(propsOf(node).allowFontScaling).not.toBe(false);
      expect(propsOf(node).maxFontSizeMultiplier).toBeUndefined();
    }
    await view.unmount();
  });
});

describe('T14-A19 — the accessible surface', () => {
  for (const language of ['ar', 'en'] as const) {
    it(`${language}: the title is a header, both fields are labelled, and the submit is a button`, async () => {
      const { view } = await mount({ language });
      const copy = FROZEN[language];
      expect(view.getByTestId(SIGN_IN_TITLE_TEST_ID).props.accessibilityRole).toBe('header');
      expect(titleText(view)).toBe(copy.title);
      expect(view.getByTestId(SIGN_IN_EMAIL_TEST_ID).props.accessibilityLabel).toBe(copy.emailLabel);
      expect(view.getByTestId(SIGN_IN_PASSWORD_TEST_ID).props.accessibilityLabel).toBe(copy.passwordLabel);
      const submit = view.getByTestId(SIGN_IN_SUBMIT_TEST_ID);
      expect(submit.props.accessibilityRole).toBe('button');
      expect(submit.props.accessibilityLabel).toBe(copy.submit);
      // The surface names the language it is actually written in, so a screen reader pronounces it.
      expect(view.getByTestId(PRODUCT_SIGN_IN_GATEWAY_TEST_ID).props.accessibilityLanguage).toBe(language);
      await view.unmount();
    });
  }

  it('the one status surface is a polite live region, present before there is anything to announce', async () => {
    const { view } = await mount();
    const notice = view.getByTestId(SIGN_IN_NOTICE_TEST_ID);
    expect(notice.props.accessibilityLiveRegion).toBe('polite');
    // Present but silent: a live region that appears only with its message cannot announce a change.
    expect(noticeSays(view, FROZEN.en.invalidCredentials)).toBe(false);
    await view.unmount();
  });

  it('the error is visible text, not a colour, and the surface names no colour at all', async () => {
    const { view, auth } = await mount();
    auth.answerWith(authFailure('INVALID_CREDENTIALS'));
    await fill(view);
    await fireEvent.press(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID));
    expect(view.getByText(FROZEN.en.invalidCredentials)).toBeTruthy();
    for (const node of nodes(view.toJSON())) {
      const flat = styleOf(node);
      expect(flat.color).toBeUndefined();
      expect(flat.backgroundColor).toBeUndefined();
    }
    await view.unmount();
  });

  it('the submit target is at least the platform minimum', async () => {
    const { view } = await mount();
    const style = view.getByTestId(SIGN_IN_SUBMIT_TEST_ID).props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : (style ?? {});
    expect(flat.minHeight).toBeGreaterThanOrEqual(44);
    await view.unmount();
  });
});

describe('T14-A20 — the surface offers exactly one action, and it is sign-in', () => {
  it('there is no sign-up, no forgot-password, no social provider and no visibility toggle', async () => {
    for (const language of ['ar', 'en'] as const) {
      const { view } = await mount({ language });
      const text = tree(view);
      for (const absent of [
        'Sign up', 'sign up', 'Create account', 'Register', 'Forgot', 'forgot', 'Reset',
        'Google', 'Apple', 'Facebook', 'Continue with', 'magic link', 'OTP', 'Remember me',
        'Show password', 'Hide password', 'Skip',
        'إنشاء حساب', 'نسيت', 'تسجيل جديد', 'متابعة باستخدام', 'إظهار كلمة المرور', 'تذكرني',
      ]) {
        expect(text).not.toContain(absent);
      }
      // One press target: the submit. A second one would be a second action.
      const targets = nodes(view.toJSON()).filter(isPressTarget);
      expect(targets).toHaveLength(1);
      expect(propsOf(targets[0]).testID).toBe(SIGN_IN_SUBMIT_TEST_ID);
      await view.unmount();
    }
  });

  it('the surface makes no claim about a conversation the reader does not yet have', async () => {
    for (const language of ['ar', 'en'] as const) {
      const { view } = await mount({ language });
      const text = tree(view);
      for (const claim of ['Welcome back', 'Moment', 'Thread', 'Reading', 'conversation', 'مرحبًا بعودتك', 'محادثتك']) {
        expect(text).not.toContain(claim);
      }
      await view.unmount();
    }
  });
});
