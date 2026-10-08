/**
 * SHARED-VIS-01 — the Shared World's Living Analysis field on the PRODUCTION phase surface over the S4 proof world
 * (VALIDATION guard for the device proof `qandeel://s401-proof/shared-field/seed`).
 *
 * It proves, through the real runtime and the real Shared controllers, before any device runs it:
 *   - an ALLOWed World opens on its field; every served place is one the reader may see in full — a place resting on a
 *     line the reader cannot see is never served (D3);
 *   - the place panel carries its exact sources with the conversation's attribution;
 *   - the conversation is one entry away; deleting one's own line removes every place read from it (D4), and Back
 *     returns to the same World's field;
 *   - World B is its own World (its own places, a fresh FAR camera, no focus of A), and returning to A restores A;
 *   - the Personal world is never touched.
 */
import { act, cleanup, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { createEphemeralAppearancePreferenceStore } from '../../appearance';
import { createEphemeralPushDeviceStore, createInertPushPlatformPort } from '../../push';
import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { createManualForegroundSignal } from '../../runtime-entry';
import { RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLanguage } from '../locale/device-locale';
import { createIntegrationRuntime, type IntegrationRuntime, type IntegrationSessionRuntime } from '../runtime/integration-runtime';
import { createS401ProofWorld, type S401ProofWorld } from '../__validation__/s401-proof-world';
import { SHARED_VIS_WORLD_A, SHARED_VIS_WORLD_B, pick } from '../__validation__/shared-vis-proof-field';
import { settle } from '../__fixtures__/integration';

jest.mock('expo-status-bar', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { StatusBar: ({ style }: { style: string }) => createElement(View, { testID: 'qandeel-test-status-bar', statusStyle: style } as object) };
});

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };
const LANGUAGE = deviceProductLanguage();
let runtime: IntegrationRuntime | null = null;

afterEach(async () => {
  await cleanup();
  runtime?.dispose();
  runtime = null;
});

async function proofApp(world: S401ProofWorld): Promise<{ view: RenderResult; app: IntegrationSessionRuntime }> {
  const built = createIntegrationRuntime({
    config: world.config, authPort: world.auth, httpFetch: world.fetch, foreground: createManualForegroundSignal('INACTIVE'),
    recoveryStorage: createEphemeralProductRecoveryStorage(), appearanceStore: createEphemeralAppearancePreferenceStore(),
    nativeAppearance: { apply: () => undefined }, pushPlatform: createInertPushPlatformPort(), pushDeviceStore: createEphemeralPushDeviceStore({ declined: true }),
  });
  if (!built.ok) throw new Error(built.phase.detail);
  runtime = built.runtime;
  await runtime.start();
  await settle();
  const view = await render(<SafeAreaProvider initialMetrics={METRICS}><RuntimePhaseSurface runtime={runtime} /></SafeAreaProvider>);
  await act(async () => { await settle(); });
  const phase = runtime.getPhase();
  if (phase.kind !== 'READY') throw new Error(`expected READY, reached ${phase.kind}`);
  return { view, app: phase.runtime };
}

async function press(view: RenderResult, testID: string): Promise<void> {
  await fireEvent.press(view.getByTestId(testID));
  await act(async () => { await settle(); });
}
async function openWorld(view: RenderResult, name: string): Promise<void> {
  await fireEvent.press(view.getByLabelText(name));
  await act(async () => { await settle(); });
}

const meanings = (fixture: typeof SHARED_VIS_WORLD_A) => fixture.places.map((p) => pick(p.meaning, LANGUAGE));
const HIDDEN = pick(SHARED_VIS_WORLD_A.places[SHARED_VIS_WORLD_A.places.length - 1].meaning, LANGUAGE);

describe('SHARED-VIS-01 — the Shared World field over the S4 proof world', () => {
  it('opens on the field, serves only what the reader may see, isolates Worlds, and follows deletion', async () => {
    const world = createS401ProofWorld(LANGUAGE);
    world.sharedField();
    const { view, app } = await proofApp(world);
    const storeBefore = app.store.getState();
    await press(view, 'qandeel-switcher-shared_world');
    await openWorld(view, pick(SHARED_VIS_WORLD_A.name, LANGUAGE));
    expect(view.getByTestId('qandeel-shared-world-field')).toBeTruthy();
    const field = app.sharedWorld.field!;

    // D3: every place but the one resting on a line the reader cannot see.
    const servedA = field.getState().entries.map((e) => e.meaning);
    expect(servedA.sort()).toEqual(meanings(SHARED_VIS_WORLD_A).filter((m) => m !== HIDDEN).sort());
    expect(view.queryByText(HIDDEN)).toBeNull();
    expect(field.getState().camera?.depth).toBe('FAR');

    // The panel: the meaning, its themes and its exact sources with the conversation's attribution.
    const postponing = field.getState().entries.find((e) => e.meaning === pick(SHARED_VIS_WORLD_A.places[0].meaning, LANGUAGE))!;
    await act(async () => { field.focus(postponing.id); await settle(); });
    expect(view.getByTestId('qandeel-shared-panel-meaning').props.children).toBe(postponing.meaning);
    const state = field.getState();
    expect(state.focus?.panel.status).toBe('SERVED');
    if (state.focus?.panel.status === 'SERVED') {
      expect(state.focus.panel.place.sources.map((s) => [s.producer, s.text])).toEqual([
        ['SELF', pick(SHARED_VIS_WORLD_A.lines[0].text, LANGUAGE)],
        ['HUMAN', pick(SHARED_VIS_WORLD_A.lines[1].text, LANGUAGE)],
      ]);
    }
    const focusedCamera = field.getState().camera;

    // D7: the conversation, then D4: the reader deletes their own line; every place read from it leaves the field.
    await press(view, 'qandeel-shared-conversation-open');
    expect(view.getByTestId('qandeel-shared-world')).toBeTruthy();
    const own = app.sharedWorld.getState().thread.materials.find((m) => m.text === pick(SHARED_VIS_WORLD_A.lines[2].text, LANGUAGE))!;
    await act(async () => { await app.sharedWorld.deleteMaterial(own.materialId); await settle(); });
    await act(async () => { app.sharedWorld.closeConversation(); await settle(); });
    expect(view.getByTestId('qandeel-shared-world-field')).toBeTruthy();
    const fear = pick(SHARED_VIS_WORLD_A.places[1].meaning, LANGUAGE);
    expect(field.getState().entries.map((e) => e.meaning)).not.toContain(fear);
    // The focused place was not read from the deleted line: the same World, the same camera, the same focus.
    expect(field.getState()).toMatchObject({ camera: focusedCamera, focus: { id: postponing.id } });

    // World B: its own places, a fresh FAR camera, nothing of A.
    // The band's Back leaves the World for the Shared root (the panel's own Back releases a focus).
    await press(view, 'qandeel-shared-back');
    expect(view.getByTestId('qandeel-shared-root')).toBeTruthy();
    await openWorld(view, pick(SHARED_VIS_WORLD_B.name, LANGUAGE));
    expect(field.getState()).toMatchObject({ focus: null, camera: { depth: 'FAR' } });
    expect(field.getState().entries.map((e) => e.meaning).sort()).toEqual(meanings(SHARED_VIS_WORLD_B).sort());
    expect(view.queryByText(postponing.meaning)).toBeNull();

    // Back to A: A's own anchor, restored after A's field was read again.
    await press(view, 'qandeel-shared-back');
    await openWorld(view, pick(SHARED_VIS_WORLD_A.name, LANGUAGE));
    expect(field.getState()).toMatchObject({ camera: focusedCamera, focus: { id: postponing.id } });

    // The Personal world was never touched.
    expect(app.store.getState()).toBe(storeBefore);
  });
});
