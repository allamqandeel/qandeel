/**
 * W3-MEGA-A — General Settings → Account & Identity (Name, Login ID, Email, Public ID) and Security & Sign-in (Change
 * password, Sign out from other devices, the Email as recovery method), in Arabic and English: the stable React UI
 * proof states (no frame timing, no raster).
 *
 * The appearance is the REAL authority; both controllers are REAL, over scripted transports that answer exactly what
 * migration 0129 and the provider would.
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { AccessibilityInfo, BackHandler, StyleSheet } from 'react-native';

import { AppearanceProvider, createAppearanceAuthority, createEphemeralAppearancePreferenceStore } from '../../appearance';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { AccountIdentityView } from '../../runtime-entry';
import { SettingsSurface, createAccountIdentityController, createPublicIdController, settingsCopy, type AccountIdentityTransport } from '..';

jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => ({
  ...jest.requireActual<object>('react-native/Libraries/ReactNative/RendererProxy'),
  findNodeHandle: (node: unknown) => (node === null || node === undefined ? null : 4242),
}));
const INSETS = { top: 44, right: 0, bottom: 34, left: 0 };
const LRI = String.fromCodePoint(0x2066);
const PDI = String.fromCodePoint(0x2069);
const FSI = String.fromCodePoint(0x2068);
const flush = () => new Promise((resolve) => setImmediate(resolve));
const style = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;

const IDENTITY: AccountIdentityView = { name: 'Noor Hassan', loginId: 'noor.h', email: 'noor@example.test', emailVerified: true };

function identityServer() {
  let current = { ...IDENTITY };
  const queue: unknown[] = [];
  const next = async () => queue.shift() as never;
  const transport: AccountIdentityTransport = {
    readIdentity: jest.fn(async () => ({ kind: 'READ' as const, view: { ...current } })),
    changeName: jest.fn(next),
    changeLoginId: jest.fn(next),
    requestEmailChange: jest.fn(next),
    confirmEmailChange: jest.fn(next),
    changePassword: jest.fn(next),
    signOutOtherDevices: jest.fn(next),
  };
  return { transport, answer: (...outcomes: unknown[]) => queue.push(...outcomes), commit: (patch: Partial<AccountIdentityView>) => { current = { ...current, ...patch }; } };
}

async function settings(language: ChromeLanguage) {
  const authority = createAppearanceAuthority({
    store: createEphemeralAppearancePreferenceStore({}),
    system: { current: () => 'DARK', subscribe: () => () => undefined },
    native: { apply: () => undefined },
  });
  authority.bindAccount('reader');
  const server = identityServer();
  const timers = { setTimer: () => null, clearTimer: () => undefined };
  const identity = createAccountIdentityController({ transport: server.transport, isCurrent: () => true, ...timers });
  const publicId = createPublicIdController({
    transport: { readPublicId: async () => ({ kind: 'READ', view: { publicId: 'nightlamp27', changeAvailable: true } }), changePublicId: async () => ({ kind: 'NETWORK' }) },
    isCurrent: () => true,
    ...timers,
  });
  const onBack = jest.fn();
  const onSignOut = jest.fn(async () => undefined);
  const view = await render(
    <AppearanceProvider authority={authority}>
      <SettingsSurface language={language} insets={INSETS} onBack={onBack} onSignOut={onSignOut} identity={identity} publicId={publicId} />
    </AppearanceProvider>,
  );
  await act(async () => {
    await flush();
  });
  return { view, server, onBack, onSignOut };
}

async function press(view: RenderResult, testID: string) {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => {
    await flush();
  });
}

const words = (view: RenderResult) => view.getAllByText(/.+/u).map((node) => node.props.children as string);

afterEach(() => jest.restoreAllMocks());

describe.each(['ar', 'en'] as const)('%s — Account & Identity and Security & Sign-in', (language) => {
  const copy = settingsCopy(language);
  const id = copy.identity;
  const sec = copy.security;

  it('draws four REAL groups: Account & Identity (Name, Login ID, Email, Public ID), then Security & Sign-in — nothing else', async () => {
    const { view } = await settings(language);
    expect(words(view)).toEqual([
      copy.title,
      copy.accountGroup,
      id.nameTerm, 'Noor Hassan',
      id.loginIdTerm, `${LRI}noor.h${PDI}`,
      id.emailTerm, `${LRI}noor@example.test${PDI}`,
      copy.publicId.term, `${LRI}@nightlamp27${PDI}`, copy.publicId.available,
      sec.group,
      sec.changePassword,
      sec.signOutOthers,
      id.emailTerm, `${LRI}noor@example.test${PDI}`, id.emailVerified,
      copy.appearanceGroup, copy.appearance.DARK, copy.appearance.LIGHT, copy.appearance.SYSTEM,
      copy.supportGroup, copy.signOut,
    ]);
    // No Photo, Shared ID, Phone, 2FA, Passkeys, device list or activity log — disabled or otherwise.
    expect(view.queryByText(/photo|صورة|shared id|المعرّف المشترك|phone|هاتف|passkey|two-factor|device list/iu)).toBeNull();
    expect(view.getByTestId('qandeel-login-id-row').props.accessibilityLabel).toBe([id.loginIdTerm, 'noor.h'].join(', '));
    expect(view.getByTestId('qandeel-recovery-email').props.accessibilityLabel).toBe([id.emailTerm, 'noor@example.test', id.emailVerified].join(', '));
  });

  it('Name: a state of this destination; the server’s Name comes back to the row, and Back had left nothing behind', async () => {
    const { view, server, onBack } = await settings(language);
    await press(view, 'qandeel-name-row');
    expect(view.getByTestId('qandeel-name-change-title').props.children).toBe(id.nameTerm);
    expect(view.getByTestId('qandeel-name-change-current').props.children).toBe('Noor Hassan');
    await fireEvent.changeText(view.getByTestId('qandeel-name-change-name'), '   ');
    await press(view, 'qandeel-name-change-confirm');
    expect(view.getByText(id.emptyName)).toBeTruthy();
    server.answer({ kind: 'ANSWERED', answer: 'CHANGED', name: 'نور حسن' });
    await fireEvent.changeText(view.getByTestId('qandeel-name-change-name'), ' نور حسن ');
    const focus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
    await press(view, 'qandeel-name-change-confirm');
    expect(view.queryByTestId('qandeel-name-change')).toBeNull();
    expect(view.getByTestId('qandeel-name-row-value').props.children).toBe('نور حسن');
    expect(focus).toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('Login ID: persistent help, the password, and approved answers — never a guessed one', async () => {
    const { view, server } = await settings(language);
    await press(view, 'qandeel-login-id-row');
    expect(view.getByTestId('qandeel-login-id-change-loginId-help').props.children).toBe(id.loginIdHelp);
    expect(style(view.getByTestId('qandeel-login-id-change-loginId'))).toMatchObject({ writingDirection: 'ltr', textAlign: 'left' });
    expect(view.getByTestId('qandeel-login-id-change-password').props.secureTextEntry).toBe(true);
    await fireEvent.changeText(view.getByTestId('qandeel-login-id-change-loginId'), 'no');
    await press(view, 'qandeel-login-id-change-confirm');
    expect(view.getByText(id.malformedLoginId)).toBeTruthy();
    for (const [outcome, sentence] of [[{ kind: 'PASSWORD_REJECTED' }, id.passwordIncorrect], [{ kind: 'ANSWERED', answer: 'UNAVAILABLE', loginId: 'noor.h' }, id.loginIdUnavailable], [{ kind: 'NETWORK' }, id.network]] as const) {
      server.answer(outcome);
      await fireEvent.changeText(view.getByTestId('qandeel-login-id-change-loginId'), 'noor.new');
      await fireEvent.changeText(view.getByTestId('qandeel-login-id-change-password'), 'pw');
      await press(view, 'qandeel-login-id-change-confirm');
      expect(view.getByTestId('qandeel-login-id-change-message').props.children.props.children).toBe(sentence);
    }
    server.answer({ kind: 'ANSWERED', answer: 'CHANGED', loginId: 'noor.new' });
    await press(view, 'qandeel-login-id-change-confirm');
    expect(view.getByTestId('qandeel-login-id-row-value').props.children).toBe(`${LRI}noor.new${PDI}`);
  });

  it('Email: password and new Email, then BOTH codes; only a confirmed change signs this device out, once', async () => {
    const { view, server, onSignOut } = await settings(language);
    await press(view, 'qandeel-email-row');
    server.answer({ kind: 'PASSWORD_REJECTED' });
    await fireEvent.changeText(view.getByTestId('qandeel-email-change-password'), 'bad');
    await fireEvent.changeText(view.getByTestId('qandeel-email-change-email'), 'new@example.test');
    await press(view, 'qandeel-email-change-confirm');
    expect(view.getByText(id.passwordIncorrect)).toBeTruthy();
    server.answer({ kind: 'ACCEPTED' });
    await fireEvent.changeText(view.getByTestId('qandeel-email-change-password'), 'pw');
    await press(view, 'qandeel-email-change-confirm');
    // Two instructions, each naming the address the reader already knows — the W1B-01 sentence, verbatim.
    expect(view.getByTestId('qandeel-email-verify-newCode-instruction').props.children).toBe(id.codeInstruction('new@example.test'));
    expect(view.getByTestId('qandeel-email-verify-currentCode-instruction').props.children).toBe(id.codeInstruction('noor@example.test'));
    expect(id.codeInstruction('x')).toContain(`${FSI}x`);
    // Arabic-Indic digits are the same digits; five digits are not a code.
    await fireEvent.changeText(view.getByTestId('qandeel-email-verify-newCode'), '١٢٣٤٥٦');
    expect(view.getByTestId('qandeel-email-verify-newCode').props.value).toBe('123456');
    await fireEvent.changeText(view.getByTestId('qandeel-email-verify-currentCode'), '65432');
    await press(view, 'qandeel-email-verify-confirm');
    expect(view.getByText(id.codeIncomplete)).toBeTruthy();
    // A resend says nothing of its own (non-enumerating).
    server.answer({ kind: 'ACCEPTED' });
    await press(view, 'qandeel-email-verify-secondary');
    expect(server.transport.requestEmailChange).toHaveBeenLastCalledWith('pw', 'new@example.test');
    expect(view.getByTestId('qandeel-email-verify-message').props.children).toBeNull();
    server.answer({ kind: 'CODE_REJECTED' });
    await fireEvent.changeText(view.getByTestId('qandeel-email-verify-currentCode'), '654321');
    await press(view, 'qandeel-email-verify-confirm');
    expect(view.getByText(id.codeRejected)).toBeTruthy();
    expect(onSignOut).not.toHaveBeenCalled();
    server.answer({ kind: 'CHANGED' });
    await press(view, 'qandeel-email-verify-confirm');
    expect(server.transport.confirmEmailChange).toHaveBeenLastCalledWith('new@example.test', '123456', '654321');
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('Change password: mismatch locally; CHANGED returns to the row with "Password changed."; CHANGED_SIGNED_OUT signs this device out', async () => {
    const { view, server, onSignOut } = await settings(language);
    await press(view, 'qandeel-change-password');
    await fireEvent.changeText(view.getByTestId('qandeel-password-change-password'), 'old');
    await fireEvent.changeText(view.getByTestId('qandeel-password-change-newPassword'), 'new-one');
    await fireEvent.changeText(view.getByTestId('qandeel-password-change-confirmPassword'), 'new-two');
    await press(view, 'qandeel-password-change-confirm');
    expect(view.getByText(sec.mismatch)).toBeTruthy();
    expect(server.transport.changePassword).not.toHaveBeenCalled();
    server.answer({ kind: 'CHANGED' });
    await fireEvent.changeText(view.getByTestId('qandeel-password-change-confirmPassword'), 'new-one');
    await press(view, 'qandeel-password-change-confirm');
    expect(view.queryByTestId('qandeel-password-change')).toBeNull();
    expect(view.getByTestId('qandeel-change-password-notice').props.children.props.children).toBe(sec.passwordChanged);
    expect(onSignOut).not.toHaveBeenCalled();
    await press(view, 'qandeel-change-password');
    server.answer({ kind: 'CHANGED_SIGNED_OUT' });
    for (const [field, value] of [['password', 'new-one'], ['newPassword', 'newer'], ['confirmPassword', 'newer']]) {
      await fireEvent.changeText(view.getByTestId(`qandeel-password-change-${field}`), value);
    }
    await press(view, 'qandeel-password-change-confirm');
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('Sign out from other devices: said only when the server confirmed it; a failure says try again', async () => {
    const { view, server, onSignOut } = await settings(language);
    server.answer({ kind: 'FAILED' }, { kind: 'SIGNED_OUT_OTHERS' });
    await press(view, 'qandeel-sign-out-others');
    expect(view.getByTestId('qandeel-sign-out-others-notice').props.children.props.children).toBe(id.network);
    await press(view, 'qandeel-sign-out-others');
    expect(view.getByTestId('qandeel-sign-out-others-notice').props.children.props.children).toBe(sec.signedOutOthers);
    expect(onSignOut).not.toHaveBeenCalled();
  });

  it('Settings’ Back and Android Back leave a change — not Settings', async () => {
    const { view, onBack } = await settings(language);
    let handler: (() => boolean | null | undefined) | undefined;
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, fn) => {
      handler = fn as () => boolean;
      return { remove: () => undefined };
    });
    await press(view, 'qandeel-login-id-row');
    await press(view, 'qandeel-settings-back');
    expect(view.queryByTestId('qandeel-login-id-change')).toBeNull();
    await press(view, 'qandeel-change-password');
    await act(async () => {
      expect(handler?.()).toBe(true);
      await flush();
    });
    expect(view.queryByTestId('qandeel-password-change')).toBeNull();
    expect(onBack).not.toHaveBeenCalled();
  });
});
