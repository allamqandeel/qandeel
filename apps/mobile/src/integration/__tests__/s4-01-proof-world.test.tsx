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
 *
 * It also guards the pre-authority seam Journey C asserts on a device: an entry into the seeded World stays in the neutral
 * shell — no welcome, no member — until `allow()` releases it, however long the reader waits; never a timed delay that a
 * slow emulator can outrun (the S4 proof race of run 37291080371).
 *
 * And the malformed-ID proof Journey B runs on a device: after a successful invite the panel is closed and a FRESH invite
 * session is opened, so the malformed value is typed into a new field, proved present, and only then sent (run
 * 37293961649 showed the field empty after typing into the field the successful submission had just cleared).
 */
import { act, cleanup, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createEphemeralAppearancePreferenceStore } from '../../appearance';
import { createEphemeralPushDeviceStore, createInertPushPlatformPort } from '../../push';
import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { AccountApiClient, createManualForegroundSignal } from '../../runtime-entry';
import { sharedCopy } from '../../shared-world';
import { RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLanguage } from '../locale/device-locale';
import { createIntegrationRuntime, type IntegrationRuntime } from '../runtime/integration-runtime';
import { S401_PROOF_SHARED_IDS, createS401ProofWorld, type S401ProofWorld } from '../__validation__/s401-proof-world';
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

const SEEDED = '54010001-0000-4000-8000-000000000000';

async function proofApp(world: S401ProofWorld = createS401ProofWorld(deviceProductLanguage())): Promise<RenderResult> {
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
    const world = createS401ProofWorld('en');
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

describe('S4-01 proof world — the pre-authority seam is held, never timed', () => {
  const entry = (world: S401ProofWorld, worldId: string) =>
    world.fetch(`${world.config.apiBaseUrl}/shared/worlds/${worldId}`, { method: 'GET' }).then((answer) => answer.json());

  it('holds every entry into the seeded World before ALLOW until allow() releases it, then holds the next one again', async () => {
    jest.useFakeTimers();
    try {
      const world = createS401ProofWorld('en');
      world.seed();
      let first: unknown = null;
      void entry(world, SEEDED).then((body) => { first = body; });
      await act(async () => { jest.advanceTimersByTime(600_000); });
      expect(first).toBeNull();
      world.allow();
      await act(async () => { await Promise.resolve(); });
      expect(first).toMatchObject({ outcome: 'ALLOW' });

      let second: unknown = null;
      void entry(world, SEEDED).then((body) => { second = body; });
      await act(async () => { jest.advanceTimersByTime(600_000); });
      expect(second).toBeNull();
      world.allow();
      await act(async () => { await Promise.resolve(); });
      expect(second).toMatchObject({ outcome: 'ALLOW' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('answers a revoked membership at once with one neutral UNAVAILABLE, and a held entry revoked before release too', async () => {
    const world = createS401ProofWorld('en');
    world.seed();
    let held: unknown = null;
    void entry(world, SEEDED).then((body) => { held = body; });
    await act(async () => { await Promise.resolve(); });
    world.revoke();
    world.allow();
    await act(async () => { await Promise.resolve(); });
    expect(held).toEqual({ outcome: 'UNAVAILABLE' });
    expect(await entry(world, SEEDED)).toEqual({ outcome: 'UNAVAILABLE' });
  });

  it('on the production route, shows only the neutral shell while held, and the World only after release', async () => {
    const world = createS401ProofWorld(deviceProductLanguage());
    world.seed();
    const view = await proofApp(world);
    await press(view, 'qandeel-switcher-shared_world');
    await press(view, `qandeel-shared-world-${SEEDED}`);
    expect(view.getByTestId('qandeel-shared-transition')).toBeTruthy();
    expect(view.queryByTestId('qandeel-shared-welcome')).toBeNull();
    expect(view.queryByTestId('qandeel-shared-members')).toBeNull();
    await act(async () => {
      world.allow();
      await settle();
    });
    // SHARED-VIS-01 re-anchor: the World opens on its Living Analysis field; its conversation is one entry away.
    expect(view.getByTestId('qandeel-shared-world-field')).toBeTruthy();
    await press(view, 'qandeel-shared-conversation-open');
    expect(view.getByTestId('qandeel-shared-welcome')).toBeTruthy();
    expect(view.getByTestId('qandeel-shared-members')).toBeTruthy();
    expect(view.queryByTestId('qandeel-shared-transition')).toBeNull();
  });
});
describe('S4-01 proof world — the malformed Shared ID in its own, fresh invite session (Journey B)', () => {
  it('closes the panel after the sent invite, reopens it empty, holds the typed malformed value, and answers it as malformed', async () => {
    const copy = sharedCopy(deviceProductLanguage());
    const view = await proofApp();
    await press(view, 'qandeel-switcher-shared_world');
    await press(view, 'qandeel-shared-create');
    await fireEvent.changeText(view.getByTestId('qandeel-shared-invite-input'), 'k7qm 4xwd p9tr');
    await press(view, 'qandeel-shared-invite-send');
    expect(within(view.getByTestId('qandeel-shared-invite-message')).getByText(copy.invitationSent)).toBeTruthy();

    await press(view, 'qandeel-shared-invite-cancel');
    expect(view.queryByTestId('qandeel-shared-invite')).toBeNull();
    await press(view, 'qandeel-shared-create');
    expect(view.getByTestId('qandeel-shared-invite-input').props.value).toBe('');
    expect(view.queryByText(copy.invitationSent)).toBeNull();

    await fireEvent.changeText(view.getByTestId('qandeel-shared-invite-input'), 'AB');
    expect(view.getByTestId('qandeel-shared-invite-input').props.value).toBe('AB');
    await press(view, 'qandeel-shared-invite-send');
    expect(within(view.getByTestId('qandeel-shared-invite-message')).getByText(copy.invalidSharedId)).toBeTruthy();
  });
});
