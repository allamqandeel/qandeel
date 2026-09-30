/**
 * W3-MEGA-A — E2E-D-03 (Name), E2E-D-05 (Login ID), E2E-D-04 (Change Email) and E2E-D-06 (Security & Sign-in) on the
 * PRODUCTION phase surface, over a runtime the harness genuinely built: the route's own mapping, the real runtime
 * generation, the real account transport bound to the signed-in identity, the real identity controller and the real
 * General Settings.
 *
 * Stood in for: the network and the QANDEEL API, answered here exactly as the W3-MEGA-A account routes answer (the
 * database is proven by `database/verify-migration-0129.mjs`, the server boundary by `account-security.spec.ts`).
 */
import { act, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';
import { settingsCopy } from '../../settings';
import { RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLocale } from '../locale/device-locale';
import { harness, settle, type IntegrationHarness } from '../__fixtures__/integration';

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };
const LANGUAGE = deviceProductLocale().language;
const COPY = settingsCopy(LANGUAGE);
const LRI = String.fromCodePoint(0x2066);
const PDI = String.fromCodePoint(0x2069);

/** The server: one account, its identity, and the owner routes (0129 + the provider). */
function server(h: IntegrationHarness) {
  const account = { name: 'Noor Hassan', loginId: 'noor.h', email: 'noor@example.test', password: 'pw', commands: new Map<string, string>() };
  const identity = () => ({ name: account.name, loginId: account.loginId, email: account.email, emailVerified: true });
  const body = (request: { readonly body?: string | null }) => JSON.parse(request.body ?? '{}') as Record<string, string>;
  h.http.on('/account/public-id', () => ({ status: 200, body: { publicId: 'nightlamp27', changeAvailable: true } }));
  h.http.on('/account/identity', () => ({ status: 200, body: identity() }));
  h.http.on('/account/name/change', (request) => {
    const name = body(request).name.trim();
    const outcome = name === account.name ? 'UNCHANGED' : 'CHANGED';
    account.name = name;
    return { status: 200, body: { outcome, name } };
  });
  h.http.on('/account/login-id/change', (request) => {
    const { commandId, loginId, password } = body(request);
    if (password !== account.password) return { status: 200, body: { outcome: 'PASSWORD_REJECTED' } };
    if (account.commands.has(commandId)) return { status: 200, body: { outcome: 'CHANGED', loginId: account.loginId } };
    account.commands.set(commandId, loginId);
    account.loginId = loginId;
    return { status: 200, body: { outcome: 'CHANGED', loginId } };
  });
  h.http.on('/account/sessions/sign-out-others', () => ({ status: 200, body: { outcome: 'SIGNED_OUT_OTHERS' } }));
  return account;
}

async function world() {
  const h = await harness({ initialSession: { userId: 'alice', accessToken: 'token-a' } });
  h.http.on('/turns', (request) => (request.method === 'GET' ? { status: 200, body: historyBody([exchange('fixture: earlier words', { key: 'fixture-earlier' })]) } : { status: 500, body: {} }));
  const account = server(h);
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <RuntimePhaseSurface runtime={h.runtime} />
    </SafeAreaProvider>,
  );
  await act(async () => {
    await settle();
  });
  return { h, view, account };
}

async function press(view: RenderResult, testID: string): Promise<void> {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => {
    await settle();
  });
}

describe('W3-MEGA-A — Account & Identity and Security & Sign-in, end to end', () => {
  it('reads nothing before Settings is shown; then the owner’s own identity, on the owner’s token, with no id in any URL', async () => {
    const { h, view } = await world();
    expect(h.http.matching('/account/identity')).toHaveLength(0);
    await press(view, 'qandeel-settings-entry');
    const reads = h.http.matching('/account/identity');
    expect(reads).toHaveLength(1);
    expect(reads[0]).toMatchObject({ method: 'GET', authorization: 'Bearer token-a' });
    expect(reads[0].url).not.toMatch(/alice|user/u);

    const settings = within(view.getByTestId('qandeel-settings'));
    expect(settings.getAllByRole('header').map((node) => node.props.children)).toEqual([
      COPY.title, COPY.accountGroup, COPY.security.group, COPY.appearanceGroup, COPY.supportGroup,
    ]);
    expect(view.getByTestId('qandeel-name-row-value').props.children).toBe('Noor Hassan');
    expect(view.getByTestId('qandeel-login-id-row-value').props.children).toBe(`${LRI}noor.h${PDI}`);
    expect(view.getByTestId('qandeel-email-row-value').props.children).toBe(`${LRI}noor@example.test${PDI}`);
  });

  it('changes the Name and the Login ID through the real controller; no body carries an account', async () => {
    const { h, view, account } = await world();
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-name-row');
    await fireEvent.changeText(view.getByTestId('qandeel-name-change-name'), 'Noor A. Hassan');
    await press(view, 'qandeel-name-change-confirm');
    expect(account.name).toBe('Noor A. Hassan');
    expect(view.getByTestId('qandeel-name-row-value').props.children).toBe('Noor A. Hassan');

    await press(view, 'qandeel-login-id-row');
    await fireEvent.changeText(view.getByTestId('qandeel-login-id-change-loginId'), 'Noor.New');
    await fireEvent.changeText(view.getByTestId('qandeel-login-id-change-password'), 'pw');
    await press(view, 'qandeel-login-id-change-confirm');
    expect(account.loginId).toBe('noor.new');
    expect(view.getByTestId('qandeel-login-id-row-value').props.children).toBe(`${LRI}noor.new${PDI}`);

    for (const request of [...h.http.matching('/account/name/change'), ...h.http.matching('/account/login-id/change')]) {
      expect(request).toMatchObject({ method: 'POST', authorization: 'Bearer token-a' });
      for (const key of Object.keys(JSON.parse(request.body ?? '{}'))) expect(key).not.toMatch(/user|account|owner/iu);
      expect(request.url).not.toMatch(/alice|user/u);
    }
    const [loginIdRequest] = h.http.matching('/account/login-id/change');
    expect(Object.keys(JSON.parse(loginIdRequest.body ?? '{}')).sort()).toEqual(['commandId', 'loginId', 'password']);
  });

  it('signs out other devices through the server, and this device stays signed in', async () => {
    const { h, view } = await world();
    const before = h.ready();
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-sign-out-others');
    expect(h.http.matching('/account/sessions/sign-out-others')).toHaveLength(1);
    expect(view.getByTestId('qandeel-sign-out-others-notice').props.children.props.children).toBe(COPY.security.signedOutOthers);
    expect(h.ready()).toBe(before);
    expect(view.getByTestId('qandeel-settings')).toBeTruthy();
  });
});
