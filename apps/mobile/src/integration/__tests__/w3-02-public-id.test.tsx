/**
 * W3-02 — E2E-D-09 (Public ID / one lifetime manual change) on the PRODUCTION phase surface, over a runtime the
 * harness genuinely built: the route's own mapping, the real runtime generation, the real account transport
 * bound to the signed-in identity, the real Public ID controller and the real General Settings.
 *
 * Stood in for: the network and the QANDEEL API, answered here exactly as the account routes and migration
 * 0125 answer (the database's own behaviour is proven by `database/verify-migration-0125.mjs`).
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

/** The server: one account's Public ID, the one lifetime change, and the same-command replay (0125). */
function server(h: IntegrationHarness, options: { loseAnswerOnce?: boolean } = {}) {
  const account = { publicId: 'nightlamp27', changedBy: null as string | null };
  let loseNext = options.loseAnswerOnce === true;
  const view = () => ({ publicId: account.publicId, changeAvailable: account.changedBy === null });
  h.http.on('/account/public-id', () => ({ status: 200, body: view() }));
  h.http.on('/account/public-id/change', (request) => {
    const body = JSON.parse(request.body ?? '{}') as { commandId: string; publicId: string };
    let outcome: string;
    if (account.changedBy === body.commandId) outcome = 'CHANGED';
    else if (body.publicId === account.publicId) outcome = 'UNCHANGED';
    else if (account.changedBy !== null) outcome = 'ALREADY_USED';
    else {
      account.publicId = body.publicId;
      account.changedBy = body.commandId;
      outcome = 'CHANGED';
      if (loseNext) {
        loseNext = false;
        // Committed on the server, and the answer never reaches the device.
        throw new Error('connection reset');
      }
    }
    return { status: 200, body: { outcome, ...view() } };
  });
  return account;
}

async function world(options: { loseAnswerOnce?: boolean } = {}) {
  const h = await harness({ initialSession: { userId: 'alice', accessToken: 'token-a' } });
  h.http.on('/turns', (request) => (request.method === 'GET' ? { status: 200, body: historyBody([exchange('fixture: earlier words', { key: 'fixture-earlier' })]) } : { status: 500, body: {} }));
  const account = server(h, options);
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

describe('E2E-D-09 — the Public ID and its ONE lifetime manual change, end to end', () => {
  it('General Settings → Account & Identity → the one change, committed once; a second edit is not offered; Back returns to the same Personal', async () => {
    const { h, view, account } = await world();
    const before = h.ready();
    // Nothing about the Public ID is asked before Settings is shown.
    expect(h.http.matching('/account/public-id')).toHaveLength(0);

    await press(view, 'qandeel-settings-entry');
    const reads = h.http.matching('/account/public-id');
    expect(reads).toHaveLength(1);
    expect(reads[0]).toMatchObject({ method: 'GET', authorization: 'Bearer token-a' });
    expect(reads[0].url).not.toMatch(/alice|user/u);

    const settings = within(view.getByTestId('qandeel-settings'));
    expect(settings.getAllByRole('header').map((node) => node.props.children)).toEqual([COPY.title, COPY.accountGroup, COPY.appearanceGroup, COPY.supportGroup]);
    expect(view.getByTestId('qandeel-public-id-value').props.children).toBe(`${LRI}@nightlamp27${PDI}`);
    expect(view.getByTestId('qandeel-public-id-allowance').props.children).toBe(COPY.publicId.available);

    await press(view, 'qandeel-public-id-row');
    expect(view.getByText(COPY.publicId.title)).toBeTruthy();
    expect(view.getByText(COPY.publicId.body)).toBeTruthy();
    await fireEvent.changeText(view.getByTestId('qandeel-public-id-change-input'), '@Noor.Writes');
    await press(view, 'qandeel-public-id-confirm');

    const changes = h.http.matching('/account/public-id/change');
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ method: 'POST', authorization: 'Bearer token-a' });
    // The request is the command identity and the requested value, and nothing that names the account.
    const body = JSON.parse(changes[0].body ?? '{}') as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['commandId', 'publicId']);
    expect(body.publicId).toBe('noor.writes');
    expect(account).toMatchObject({ publicId: 'noor.writes' });

    expect(view.queryByTestId('qandeel-public-id-change')).toBeNull();
    expect(view.getByTestId('qandeel-public-id-value').props.children).toBe(`${LRI}@noor.writes${PDI}`);
    expect(view.getByTestId('qandeel-public-id-allowance').props.children).toBe(COPY.publicId.used);
    expect(view.getByTestId('qandeel-public-id-row').props.accessibilityRole).toBeUndefined();
    expect(within(view.getByTestId('qandeel-settings-group-account')).queryAllByRole('button')).toHaveLength(0);

    await press(view, 'qandeel-settings-back');
    expect(view.queryByTestId('qandeel-settings')).toBeNull();
    expect(h.ready()).toBe(before);
    expect(h.ready().generation).toBe(before.generation);

    // Settings again: the canonical state, from the same generation's controller.
    await press(view, 'qandeel-settings-entry');
    expect(view.getByTestId('qandeel-public-id-allowance').props.children).toBe(COPY.publicId.used);
    h.dispose();
  });

  it('a lost answer on a change that committed is reconciled by reading the canonical state — shown done, never a false failure, never sent twice', async () => {
    const { h, view } = await world({ loseAnswerOnce: true });
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-public-id-row');
    await fireEvent.changeText(view.getByTestId('qandeel-public-id-change-input'), 'noor.writes');
    await press(view, 'qandeel-public-id-confirm');
    expect(h.http.matching('/account/public-id/change')).toHaveLength(1);
    // The GET after the lost POST is the reconciliation.
    const gets = h.http.matching('/account/public-id').filter((call) => call.method === 'GET');
    expect(gets).toHaveLength(2);
    expect(view.queryByText(COPY.publicId.network)).toBeNull();
    expect(view.getByTestId('qandeel-public-id-value').props.children).toBe(`${LRI}@noor.writes${PDI}`);
    expect(view.getByTestId('qandeel-public-id-allowance').props.children).toBe(COPY.publicId.used);
    h.dispose();
  });

  it('sign-out retires the Public ID with the generation: nothing is read for the next reader from the old one', async () => {
    const { h, view } = await world();
    await press(view, 'qandeel-settings-entry');
    const first = h.ready().publicId;
    expect(first.getState().status).toBe('READY');
    await press(view, 'qandeel-settings-sign-out');
    expect(view.queryByTestId('qandeel-settings')).toBeNull();
    expect(await first.commit('after.signout')).toBeNull();
    expect(h.http.matching('/account/public-id/change')).toHaveLength(0);
    h.dispose();
  });
});
