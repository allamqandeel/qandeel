/**
 * W3-MEGA-S — E2E-D-11 (the Language row), E2E-D-16 (Export My Data) and the Personal-world E2E-D-17 (Delete Account)
 * on the PRODUCTION phase surface, over a runtime the harness genuinely built: the route's own mapping, the real
 * runtime generation, the real account transport bound to the signed-in identity, the real Privacy & Data controller
 * and the real General Settings.
 *
 * Stood in for: the network and the QANDEEL API, answered here exactly as the W3-MEGA-S routes answer (the database is
 * proven by `database/verify-migration-0130.mjs`, the server boundary by `privacy-data.spec.ts`), and the system
 * folder picker the package is saved through.
 */
import { act, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';
import { settingsCopy } from '../../settings';
import { saveExportDocument } from '../../settings/export-file';
import { RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLocale } from '../locale/device-locale';
import { harness, settle, type IntegrationHarness } from '../__fixtures__/integration';

jest.mock('../../settings/export-file', () => ({ saveExportDocument: jest.fn(async () => 'SAVED'), exportFileName: () => 'qandeel-data.json' }));

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };
const LANGUAGE = deviceProductLocale().language;
const COPY = settingsCopy(LANGUAGE);
const UNTIL = '2026-10-07T09:00:00.000Z';

/** The server: the owner's Privacy & Data state and the routes that change it (0130 + the provider's password check). */
function server(h: IntegrationHarness) {
  const state = {
    password: 'pw',
    export: { status: 'NONE', availableUntil: null as string | null },
    deletion: { status: 'NONE', finalAt: null as string | null },
    commands: new Set<string>(),
  };
  const body = (request: { readonly body?: string | null }) => JSON.parse(request.body ?? '{}') as Record<string, string>;
  const view = () => ({ export: { ...state.export }, deletion: { ...state.deletion } });
  h.http.on('/account/privacy', () => ({ status: 200, body: view() }));
  h.http.on('/account/privacy/export', (request) => {
    const { commandId, password } = body(request);
    if (password !== state.password) return { status: 200, body: { outcome: 'PASSWORD_REJECTED' } };
    state.commands.add(commandId);
    if (state.export.status !== 'READY') state.export = { status: 'PREPARING', availableUntil: null };
    return { status: 200, body: { outcome: 'ACCEPTED', export: { ...state.export } } };
  });
  h.http.on('/account/privacy/export/download', () => (state.export.status === 'READY'
    ? { status: 200, body: { status: 'READY', availableUntil: state.export.availableUntil, package: { format: 'qandeel.personal-data-export.v1', account: { name: 'Noor', email: 'noor@example.test' } } } }
    : { status: 200, body: { status: state.export.status, availableUntil: null, package: null } }));
  h.http.on('/account/privacy/deletion', (request) => {
    const { commandId, password } = body(request);
    if (password !== state.password) return { status: 200, body: { outcome: 'PASSWORD_REJECTED' } };
    state.commands.add(commandId);
    state.deletion = { status: 'SCHEDULED', finalAt: UNTIL };
    return { status: 200, body: { outcome: 'ACCEPTED', deletion: { ...state.deletion } } };
  });
  h.http.on('/account/privacy/deletion/cancel', () => {
    const had = state.deletion.status === 'SCHEDULED';
    state.deletion = { status: 'NONE', finalAt: null };
    return { status: 200, body: { outcome: had ? 'CANCELLED' : 'NONE', deletion: { ...state.deletion } } };
  });
  return state;
}

async function world() {
  const h = await harness({ initialSession: { userId: 'alice', accessToken: 'token-a' } });
  h.http.on('/turns', (request) => (request.method === 'GET' ? { status: 200, body: historyBody([exchange('fixture: earlier words', { key: 'fixture-earlier' })]) } : { status: 500, body: {} }));
  h.http.on('/account/public-id', () => ({ status: 200, body: { publicId: 'nightlamp27', changeAvailable: true } }));
  const state = server(h);
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <RuntimePhaseSurface runtime={h.runtime} />
    </SafeAreaProvider>,
  );
  await act(async () => {
    await settle();
  });
  return { h, view, state };
}

async function press(view: RenderResult, testID: string): Promise<void> {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => {
    await settle();
  });
}

describe('W3-MEGA-S — Privacy & Data, end to end', () => {
  it('reads nothing before Settings is shown; then the owner’s own state, on the owner’s token, with no id in any URL', async () => {
    const { h, view } = await world();
    expect(h.http.matching('/account/privacy')).toHaveLength(0);
    await press(view, 'qandeel-settings-entry');
    const reads = h.http.matching('/account/privacy');
    expect(reads).toHaveLength(1);
    expect(reads[0]).toMatchObject({ method: 'GET', authorization: 'Bearer token-a' });
    expect(reads[0].url).not.toMatch(/alice|user/u);
    const settings = within(view.getByTestId('qandeel-settings'));
    expect(settings.getAllByRole('header').map((node) => node.props.children)).toEqual([
      COPY.title, COPY.accountGroup, COPY.qandeelGroup, COPY.appearanceGroup, COPY.privacyGroup, COPY.supportGroup,
    ]);
  });

  it('exports: the password, then the server prepares; the ready package is saved; no body carries an account', async () => {
    const { h, view, state } = await world();
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-export-request');
    await fireEvent.changeText(view.getByTestId('qandeel-export-request-form-password'), 'pw');
    await press(view, 'qandeel-export-request-form-confirm');
    expect(view.getByTestId('qandeel-export-status-status').props.children).toBe(COPY.privacy.exportPreparing);

    state.export = { status: 'READY', availableUntil: UNTIL };
    await press(view, 'qandeel-settings-back');
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-export-download');
    expect(saveExportDocument).toHaveBeenCalledWith({ format: 'qandeel.personal-data-export.v1', account: { name: 'Noor', email: 'noor@example.test' } });
    expect(view.getByTestId('qandeel-export-download-notice')).toBeTruthy();

    for (const request of [...h.http.matching('/account/privacy/export'), ...h.http.matching('/account/privacy/deletion')]) {
      expect(request).toMatchObject({ authorization: 'Bearer token-a' });
      expect(request.url).not.toMatch(/alice|user/u);
      if (request.method === 'POST') {
        expect(Object.keys(JSON.parse(request.body ?? '{}')).sort()).toEqual(['commandId', 'password']);
      }
    }
  });

  it('deletes (Personal world): the password, then the date it becomes final; Cancel keeps the account', async () => {
    const { h, view, state } = await world();
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-deletion-request');
    await fireEvent.changeText(view.getByTestId('qandeel-deletion-request-form-password'), 'nope');
    await press(view, 'qandeel-deletion-request-form-confirm');
    expect(state.deletion.status).toBe('NONE');
    await fireEvent.changeText(view.getByTestId('qandeel-deletion-request-form-password'), 'pw');
    await press(view, 'qandeel-deletion-request-form-confirm');
    expect(state.deletion.status).toBe('SCHEDULED');
    expect(view.getByTestId('qandeel-deletion-cancel')).toBeTruthy();
    // The reader stays signed in during the grace period: nothing here signs out.
    expect(view.getByTestId('qandeel-settings')).toBeTruthy();

    await press(view, 'qandeel-deletion-cancel');
    expect(state.deletion.status).toBe('NONE');
    expect(view.getByTestId('qandeel-deletion-request')).toBeTruthy();
    const cancels = h.http.matching('/account/privacy/deletion/cancel');
    expect(cancels).toHaveLength(1);
    expect(JSON.parse(cancels[0].body ?? 'null')).toEqual({});
  });
});
