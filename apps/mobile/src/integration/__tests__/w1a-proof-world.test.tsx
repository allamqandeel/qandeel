/**
 * W1A-01 — the visual-proof world runs the production route end to end, before any device does.
 *
 * The cloud proof costs a Release build and an emulator; a proof world that could not bootstrap, or
 * whose script did not produce the states the flow captures, would cost that and prove nothing. This
 * drives the SAME production `RuntimePhaseSurface` over the SAME runtime and script the proof build
 * uses, through every state the Maestro flow photographs, in both languages.
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { createManualForegroundSignal } from '../../runtime-entry';
import { RuntimePhaseSurface } from '../composition/ProductRoot';
import { createIntegrationRuntime } from '../runtime/integration-runtime';
import { createW1AProofWorld } from '../__validation__/w1a-proof-world';
import { settle } from '../__fixtures__/integration';
import { resize } from '../../responsive/__fixtures__/composition';
import type { ChromeLanguage } from '../../orientation-chrome';

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 412, height: 915 }, insets: { top: 24, left: 0, right: 0, bottom: 24 } };

async function step(view: RenderResult, testID: string): Promise<void> {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => {
    await settle();
  });
}

it.each(['en', 'ar'] as const)('%s: the proof world walks through every captured state on the production surface', async (language: ChromeLanguage) => {
  const world = createW1AProofWorld(language, { firstSendMs: 0, retryMs: 0 });
  const built = createIntegrationRuntime({
    config: world.config,
    authPort: world.auth,
    httpFetch: world.fetch,
    foreground: createManualForegroundSignal('INACTIVE'),
    recoveryStorage: createEphemeralProductRecoveryStorage(),
  });
  if (!built.ok) throw new Error(built.phase.detail);
  const runtime = built.runtime;
  await runtime.start();
  await settle();
  expect(runtime.getPhase().kind).toBe('READY');

  const view = await render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <RuntimePhaseSurface runtime={runtime} />
    </SafeAreaProvider>,
  );
  await act(async () => {
    await settle();
  });

  // 01 — the conversation-so-far, including the committed turn whose reply failed.
  expect(view.getByTestId('qandeel-conversation-thread')).toBeTruthy();
  expect(view.queryAllByTestId(/^qandeel-utterance-/u)).toHaveLength(3);
  expect(view.queryAllByTestId(/^qandeel-reply-failed-/u)).toHaveLength(1);

  // 02–04 — send-ready, then answered.
  await fireEvent.changeText(view.getByTestId('qandeel-conversation-input'), 'fixture: first words');
  expect(view.getByTestId('qandeel-conversation-send')).toBeTruthy();
  await step(view, 'qandeel-conversation-send');
  expect(view.queryAllByTestId(/^qandeel-utterance-/u)).toHaveLength(4);
  expect(view.queryByTestId('qandeel-conversation-awaiting')).toBeNull();

  // 05–06 — the scripted 503 is unconfirmed; Try again resolves it to ONE new exchange.
  await fireEvent.changeText(view.getByTestId('qandeel-conversation-input'), 'fixture: second words');
  await step(view, 'qandeel-conversation-send');
  expect(view.getByTestId('qandeel-conversation-send-retry')).toBeTruthy();
  await step(view, 'qandeel-conversation-send-retry');
  expect(view.queryByTestId('qandeel-conversation-send-retry')).toBeNull();
  expect(view.queryAllByTestId(/^qandeel-utterance-/u)).toHaveLength(5);

  // 07–09 — Analysis and back, on the same runtime.
  const session = runtime.getPhase();
  await step(view, 'qandeel-depth-to-analysis');
  await resize(view, 412, 915, { insetTop: 104, insetBottom: 24 });
  expect(view.getByTestId('qandeel-depth-to-conversation')).toBeTruthy();
  expect(view.getByTestId('qandeel-map-surface')).toBeTruthy();
  await step(view, 'qandeel-depth-to-conversation');
  expect(view.getByTestId('qandeel-conversation-thread')).toBeTruthy();
  expect(runtime.getPhase()).toBe(session);

  view.unmount();
  runtime.dispose();
});
