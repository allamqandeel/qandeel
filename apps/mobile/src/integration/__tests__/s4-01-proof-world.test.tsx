/**
 * S4-01 — the device-proof world is a signed-in reader's world (VALIDATION fixture guard).
 *
 * The first S4 proof run showed General Settings with NO Account & Identity group: the proof world answered
 * `/account/first-use` but not `/account/identity` or `/account/public-id`, which every signed-in account's production
 * API answers, so the Shared ID row (which lives in that group, P1 §8.1) could never appear. This test renders the
 * PRODUCTION phase surface over a runtime built from the exact S4-01 proof world and proves the group and the Shared ID
 * row are there, and that the world's account answers are what the production decoders accept — so the gap cannot
 * return silently. It also proves the coupling is not a Product defect: for a reader whose account reads answer, the
 * Shared ID row is always drawn.
 */
import { act, cleanup, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createEphemeralAppearancePreferenceStore } from '../../appearance';
import { createEphemeralPushDeviceStore, createInertPushPlatformPort } from '../../push';
import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { AccountApiClient, createManualForegroundSignal } from '../../runtime-entry';
import { RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLanguage } from '../locale/device-locale';
import { createIntegrationRuntime, type IntegrationRuntime } from '../runtime/integration-runtime';
import { S401_PROOF_SHARED_IDS, createS401ProofWorld } from '../__validation__/s401-proof-world';
import { settle } from '../__fixtures__/integration';

jest.mock('expo-status-bar', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { StatusBar: ({ style }: { style: string }) => createElement(View, { testID: 'qandeel-test-status-bar', statusStyle: style } as object) };
});
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(async () => true) }));

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };
let runtime: IntegrationRuntime | null = null;

afterEach(async () => {
  await cleanup();
  runtime?.dispose();
  runtime = null;
});

async function proofApp(): Promise<RenderResult> {
  const world = createS401ProofWorld(deviceProductLanguage(), { entryDelayMs: 0 });
  const built = createIntegrationRuntime({
    config: world.config,
    authPort: world.auth,
    httpFetch: world.fetch,
    foreground: createManualForegroundSignal('INACTIVE'),
    recoveryStorage: createEphemeralProductRecoveryStorage(),
    appearanceStore: createEphemeralAppearancePreferenceStore(),
    nativeAppearance: { apply: () => undefined },
    pushPlatform: createInertPushPlatformPort(),
    pushDeviceStore: createEphemeralPushDeviceStore(),
  });
  if (!built.ok) throw new Error(built.phase.detail);
  runtime = built.runtime;
  await runtime.start();
  await settle();
  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <RuntimePhaseSurface runtime={runtime} />
    </SafeAreaProvider>,
  );
  await act(async () => {
    await settle();
  });
  return view;
}

async function press(view: RenderResult, testID: string): Promise<void> {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => {
    await settle();
  });
}

describe('S4-01 proof world — a signed-in reader', () => {
  it('answers the account reads in exactly the shapes the production account client decodes', async () => {
    const world = createS401ProofWorld('en', { entryDelayMs: 0 });
    // The production account client over the proof world's network — the same read path General Settings takes.
    const account = new AccountApiClient({ baseUrl: world.config.apiBaseUrl, fetch: world.fetch });
    expect((await account.readIdentity()).kind).toBe('READ');
    expect((await account.readPublicId()).kind).toBe('READ');
  });

  it('draws Account & Identity with the Shared ID row, and the row opens the reader\'s Shared ID', async () => {
    const view = await proofApp();
    await press(view, 'qandeel-settings-entry');
    const account = within(view.getByTestId('qandeel-settings-group-account'));
    expect(account.getByTestId('qandeel-shared-id-row')).toBeTruthy();
    await press(view, 'qandeel-shared-id-row');
    expect(view.getByTestId('qandeel-shared-id-value').props.children).toContain(S401_PROOF_SHARED_IDS[0]);
  });
});
