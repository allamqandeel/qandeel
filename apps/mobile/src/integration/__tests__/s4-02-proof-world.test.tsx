/**
 * S4-02 — the Shared conversation journeys on the PRODUCTION phase surface over the S4 proof world (VALIDATION guard).
 *
 * The device legs `ar-s402-journey-a` and `en-s402-journey-b` walk exactly these steps on an emulator; this test proves
 * they are deterministic before any device runs them — every state change comes from an explicit deep-link action of the
 * proof world, never from a timer:
 *
 *   Journey A — enter a real World, its history visible with three distinct producers, send text, the committed words
 *               and the deterministic QANDEEL reply visible; no voice control.
 *   Journey B — another person's words are theirs (no Delete); the reader deletes their own; a peer's later words appear
 *               only after the reader's explicit refresh; a revoked membership refuses the send and leaves nothing of
 *               the World on screen.
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createEphemeralAppearancePreferenceStore } from '../../appearance';
import { createEphemeralPushDeviceStore, createInertPushPlatformPort } from '../../push';
import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { createManualForegroundSignal } from '../../runtime-entry';
import { sharedConversationCopy } from '../../shared-world';
import { RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLanguage } from '../locale/device-locale';
import { createIntegrationRuntime, type IntegrationRuntime } from '../runtime/integration-runtime';
import { S402_PROOF_LINES, createS401ProofWorld, type S401ProofWorld } from '../__validation__/s401-proof-world';
import { settle } from '../__fixtures__/integration';

jest.mock('expo-status-bar', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { StatusBar: ({ style }: { style: string }) => createElement(View, { testID: 'qandeel-test-status-bar', statusStyle: style } as object) };
});

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };
let runtime: IntegrationRuntime | null = null;
const LANGUAGE = deviceProductLanguage();
const COPY = sharedConversationCopy(LANGUAGE);
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

async function enterConversation(): Promise<{ world: S401ProofWorld; view: RenderResult }> {
  const world = createS401ProofWorld(LANGUAGE);
  world.converse();
  const view = await proofApp(world);
  await press(view, 'qandeel-switcher-shared_world');
  await press(view, /^qandeel-shared-world-5401/u);
  // SHARED-VIS-01 re-anchor: the World opens on its Living Analysis field; its conversation is one entry away.
  expect(view.getByTestId('qandeel-shared-world-field')).toBeTruthy();
  await press(view, 'qandeel-shared-conversation-open');
  return { world, view };
}

describe('S4-02 Journey A — a real Shared conversation with QANDEEL', () => {
  it('shows the World\'s history, commits the reader\'s words and the deterministic QANDEEL reply, with no voice control', async () => {
    const { view } = await enterConversation();
    expect(view.getAllByTestId(/^qandeel-shared-material-human-/u)).toHaveLength(1);
    expect(view.getAllByTestId(/^qandeel-shared-material-qandeel-/u)).toHaveLength(1);
    expect(view.getAllByTestId(/^qandeel-shared-material-self-/u)).toHaveLength(1);
    expect(view.queryAllByTestId(/mic|voice|record|audio/iu)).toHaveLength(0);
    await fireEvent.changeText(view.getByTestId('qandeel-shared-input'), 'Fixture hello');
    await press(view, 'qandeel-shared-send');
    expect(view.getByText(words('Fixture hello'))).toBeTruthy();
    expect(view.getByText(words(S402_PROOF_LINES.reply[LANGUAGE]))).toBeTruthy();
    expect(view.getAllByTestId(/^qandeel-shared-material-self-/u)).toHaveLength(2);
    expect(view.getAllByTestId(/^qandeel-shared-material-qandeel-/u)).toHaveLength(2);
    expect(view.getByTestId('qandeel-shared-input').props.value).toBe('');
  });
});

describe('S4-02 Journey B — authority-safe mutation and refresh', () => {
  it('deletes only the reader\'s own words, shows a peer only after refresh, and fails safe when membership ends', async () => {
    const { world, view } = await enterConversation();
    await press(view, /^qandeel-shared-material-human-/u);
    expect(view.queryByTestId('qandeel-shared-delete')).toBeNull();
    await press(view, /^qandeel-shared-material-self-/u);
    await press(view, 'qandeel-shared-delete');
    expect(view.getByText(COPY.deleteExplanation)).toBeTruthy();
    await press(view, 'qandeel-shared-delete-confirm-action');
    expect(view.queryAllByTestId(/^qandeel-shared-material-self-/u)).toHaveLength(0);
    expect(view.queryByText(words(S402_PROOF_LINES.mine))).toBeNull();

    world.peer();
    await act(async () => { await settle(); });
    expect(view.queryByText(words(S402_PROOF_LINES.peerLater))).toBeNull();
    await press(view, 'qandeel-shared-refresh');
    expect(view.getByText(words(S402_PROOF_LINES.peerLater))).toBeTruthy();

    world.revoke();
    await fireEvent.changeText(view.getByTestId('qandeel-shared-input'), 'after revoke');
    await press(view, 'qandeel-shared-send');
    expect(view.getByTestId('qandeel-shared-world-unavailable')).toBeTruthy();
    expect(view.queryByTestId('qandeel-shared-thread')).toBeNull();
    expect(view.queryByText(words(S402_PROOF_LINES.peerLater))).toBeNull();
  });
});
