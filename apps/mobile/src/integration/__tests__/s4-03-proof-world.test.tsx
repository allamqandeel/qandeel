/**
 * S4-03 — the Shared lifecycle journeys on the PRODUCTION phase surface over the S4 proof world (VALIDATION guard).
 *
 * The device legs `ar-s403-journey-a` and `en-s403-journey-b` walk exactly these steps on an emulator; this test proves
 * they are deterministic before any device runs them — every state change comes from an explicit deep-link action of the
 * proof world, never from a timer:
 *
 *   Journey A — a current World; Manage World; one governed settings change reaching its committed state through
 *               unanimity (the reader's own approval completes it); voluntary leave back to the root, the World gone;
 *               the Personal world untouched; the reader's own former words through Privacy & Data, no World browsing.
 *   Journey B — earlier history hidden from the reader until a granted package shows it; the reader shares their own
 *               earlier words with a newcomer through the exact preview; the unanimous World end; the ended World
 *               read-only (no input, no Manage World); the other person's later deletion is no longer served.
 */
import { act, cleanup, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createEphemeralAppearancePreferenceStore } from '../../appearance';
import { createEphemeralPushDeviceStore, createInertPushPlatformPort } from '../../push';
import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { createManualForegroundSignal } from '../../runtime-entry';
import { sharedLifecycleCopy } from '../../shared-world';
import { RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLanguage } from '../locale/device-locale';
import { createIntegrationRuntime, type IntegrationRuntime } from '../runtime/integration-runtime';
import { S403_PROOF_LINES, createS401ProofWorld, type S401ProofWorld } from '../__validation__/s401-proof-world';
import { settle } from '../__fixtures__/integration';

jest.mock('expo-status-bar', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { StatusBar: ({ style }: { style: string }) => createElement(View, { testID: 'qandeel-test-status-bar', statusStyle: style } as object) };
});

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };
let runtime: IntegrationRuntime | null = null;
const LANGUAGE = deviceProductLanguage();
const COPY = sharedLifecycleCopy(LANGUAGE);
/** A line as drawn: each paragraph opens with its invisible direction mark (G1.1 bidi). */
const MARKS = `[${String.fromCodePoint(0x200e)}${String.fromCodePoint(0x200f)}]?`;
const escaped = (text: string) => text.replace(/[.*+?^$(){}|[\]\\]/gu, (c) => `\\${c}`);
const words = (text: string) => new RegExp('^' + MARKS + escaped(text) + '$', 'u');

afterEach(async () => {
  await cleanup();
  runtime?.dispose();
  runtime = null;
});

async function proofApp(world: S401ProofWorld): Promise<RenderResult> {
  const built = createIntegrationRuntime({
    config: world.config, authPort: world.auth, httpFetch: world.fetch, foreground: createManualForegroundSignal('INACTIVE'),
    recoveryStorage: createEphemeralProductRecoveryStorage(), appearanceStore: createEphemeralAppearancePreferenceStore(),
    nativeAppearance: { apply: () => undefined }, pushPlatform: createInertPushPlatformPort(), pushDeviceStore: createEphemeralPushDeviceStore(),
  });
  if (!built.ok) throw new Error(built.phase.detail);
  runtime = built.runtime;
  await runtime.start();
  await settle();
  const view = await render(<SafeAreaProvider initialMetrics={METRICS}><RuntimePhaseSurface runtime={runtime} /></SafeAreaProvider>);
  await act(async () => { await settle(); });
  return view;
}

async function press(view: RenderResult, testID: string | RegExp): Promise<void> {
  await fireEvent.press(typeof testID === 'string' ? view.getByTestId(testID) : view.getAllByTestId(testID)[0]);
  await act(async () => { await settle(); });
}

async function enterWorld(seed: (world: S401ProofWorld) => void): Promise<{ world: S401ProofWorld; view: RenderResult }> {
  const world = createS401ProofWorld(LANGUAGE);
  seed(world);
  const view = await proofApp(world);
  await press(view, 'qandeel-switcher-shared_world');
  await press(view, /^qandeel-shared-world-5401/u);
  return { world, view };
}

describe('S4-03 Journey A — lifecycle and governance', () => {
  it('a unanimous settings change, voluntary leave, the Personal world untouched, own former words through Privacy & Data', async () => {
    const { world, view } = await enterWorld((w) => w.lifecycle());
    await press(view, 'qandeel-shared-manage-open');
    expect(view.getByTestId('qandeel-shared-manage')).toBeTruthy();
    await press(view, 'qandeel-shared-propose-settings');
    await fireEvent.changeText(view.getByTestId('qandeel-shared-settings-name'), 'Fixture Lantern');
    await press(view, 'qandeel-shared-settings-send');
    expect(view.getByText(COPY.proposalSent)).toBeTruthy();
    // A proposal is no approval: the reader is asked like everyone else.
    expect(view.getByTestId('qandeel-shared-proposal-settings')).toBeTruthy();
    world.peerApprove();
    await press(view, 'qandeel-shared-approve');
    expect(view.getByTestId('qandeel-shared-setting-name').props.accessibilityLabel).toBe(`${COPY.nameLabel}: Fixture Lantern`);
    expect(view.queryByTestId('qandeel-shared-proposal-settings')).toBeNull();

    await press(view, 'qandeel-shared-leave');
    expect(view.getByText(COPY.leaveExplain)).toBeTruthy();
    await press(view, 'qandeel-shared-leave-confirm-action');
    expect(view.getByText(COPY.left)).toBeTruthy();
    expect(view.queryAllByTestId(/^qandeel-shared-world-5401/u)).toHaveLength(0);
    expect(view.queryByTestId('qandeel-shared-manage')).toBeNull();

    await press(view, 'qandeel-switcher-my_world');
    expect(view.getByTestId('qandeel-conversation-thread')).toBeTruthy();
    await press(view, 'qandeel-settings-entry');
    await press(view, 'qandeel-former-shared-material-row');
    const page = view.getByTestId('qandeel-former-shared-material');
    expect(within(page).getByText(words(S403_PROOF_LINES.leftBehind))).toBeTruthy();
    expect(within(page).queryByText(/Fixture hello from the other side|Fixture Lantern/u)).toBeNull();
  });
});

describe('S4-03 Journey B — historical access and closure', () => {
  it('hidden earlier history until granted; sharing through the exact preview; the unanimous end; the ended World read-only', async () => {
    const { world, view } = await enterWorld((w) => w.history());
    expect(view.queryByText(words(S403_PROOF_LINES.hiddenEarlier))).toBeNull();
    world.grant();
    await press(view, 'qandeel-shared-refresh');
    expect(view.getByText(words(S403_PROOF_LINES.hiddenEarlier))).toBeTruthy();

    await press(view, 'qandeel-shared-manage-open');
    await press(view, 'qandeel-shared-share-with-2');
    const mine = view.getAllByTestId('qandeel-shared-share-candidate').find((c) => String(c.props.accessibilityLabel).includes(S403_PROOF_LINES.mineBeforeNewcomer));
    expect(mine).toBeDefined();
    await fireEvent.press(mine!);
    expect(within(view.getByTestId('qandeel-shared-share-preview')).getByText(S403_PROOF_LINES.mineBeforeNewcomer)).toBeTruthy();
    await press(view, 'qandeel-shared-share-propose');
    await press(view, 'qandeel-shared-share-approve');
    expect(view.getByText(COPY.granted)).toBeTruthy();

    await press(view, 'qandeel-shared-end');
    expect(view.getByText(COPY.endExplain)).toBeTruthy();
    await press(view, 'qandeel-shared-end-confirm-action');
    world.peerApprove();
    await press(view, 'qandeel-shared-approve');
    // The World ended: nothing active of it remains; it is listed apart and opens read-only.
    expect(view.getByTestId('qandeel-shared-ended-worlds')).toBeTruthy();
    await press(view, /^qandeel-shared-ended-5401/u);
    expect(view.getByText(COPY.endedNotice)).toBeTruthy();
    expect(view.queryByTestId('qandeel-shared-input')).toBeNull();
    expect(view.queryByTestId('qandeel-shared-manage-open')).toBeNull();
    expect(view.getByText(words(S403_PROOF_LINES.peerToDelete))).toBeTruthy();

    world.peerDelete();
    await press(view, 'qandeel-shared-back');
    await press(view, /^qandeel-shared-ended-5401/u);
    expect(view.queryByText(words(S403_PROOF_LINES.peerToDelete))).toBeNull();
    expect(view.getByText(words(S403_PROOF_LINES.hiddenEarlier))).toBeTruthy();
  });
});
