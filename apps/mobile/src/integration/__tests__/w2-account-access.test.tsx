/**
 * W2-01 — the account access lifecycle through the REAL integration runtime and the production phase
 * surface, over T-12P's own injection points.
 *
 * What only this level can prove: that recovery authority never reaches the bootstrap — no Session, no
 * Product recovery read, no world — that a retried verification that restores a session resumes with ONE
 * Session, and that the ended-session notice reaches the reader through `ProductRoot` only on evidence.
 */
import { act, fireEvent, render, within, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { ProductRecoveryStorage } from '../../recovery';
import { createManualForegroundSignal } from '../../runtime-entry';
import { productSignInCopy } from '../auth-gateway';
import { RUNTIME_STATE_TEST_ID, RuntimePhaseSurface } from '../composition/ProductRoot';
import { createIntegrationRuntime, type IntegrationRuntime } from '../runtime/integration-runtime';
import { TEST_CONFIG, authPortDouble, httpDouble, serveHappyPath, settle, type AuthPortDouble, type HttpDouble } from '../__fixtures__/integration';

const METRICS: Metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 44, left: 0, right: 0, bottom: 34 } };
const EN = productSignInCopy('en');

function recordingStorage(reads: string[]): ProductRecoveryStorage {
  return {
    getItem: async (key) => {
      reads.push(key);
      return null;
    },
    setItem: async () => undefined,
    removeItem: async () => undefined,
  };
}

async function build(configure?: (port: AuthPortDouble) => void, initial: { userId: string; accessToken: string } | null = null) {
  const port = authPortDouble(initial);
  configure?.(port);
  const http: HttpDouble = httpDouble();
  serveHappyPath(http);
  const reads: string[] = [];
  const built = createIntegrationRuntime({
    config: TEST_CONFIG,
    authPort: port,
    foreground: createManualForegroundSignal('INACTIVE'),
    httpFetch: http.fetch,
    recoveryStorage: recordingStorage(reads),
  });
  if (!built.ok) throw new Error('the runtime could not be built');
  await built.runtime.start();
  await settle();
  return { port, http, reads, runtime: built.runtime };
}

async function surface(runtime: IntegrationRuntime): Promise<RenderResult> {
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

const notice = (view: RenderResult) => within(view.getByTestId('qandeel-sign-in-notice'));

describe('recovery authority never opens the Product', () => {
  it('a verified recovery code and a changed password create no Session, read no recovery record and stay SIGNED_OUT', async () => {
    const { runtime, http, reads, port } = await build();
    const phases: string[] = [];
    runtime.subscribe(() => phases.push(runtime.getPhase().kind));
    expect(runtime.getPhase().kind).toBe('SIGNED_OUT');

    expect(await runtime.auth.requestPasswordRecovery('reader@example.test')).toEqual({ ok: true });
    expect(await runtime.auth.verifyRecoveryCode('reader@example.test', '123456')).toEqual({ ok: true });
    await settle();
    expect(runtime.getPhase().kind).toBe('SIGNED_OUT');
    expect(await runtime.auth.completePasswordRecovery('new secret')).toEqual({ ok: true });
    await settle();

    expect(runtime.getPhase().kind).toBe('SIGNED_OUT');
    expect(phases).toEqual([]);
    expect(http.creates()).toHaveLength(0);
    expect(http.calls).toHaveLength(0);
    expect(reads).toEqual([]);
    expect(port.recovery.retired).toHaveLength(1);
    runtime.dispose();
  });

  it('after recovery the reader signs in explicitly, and only then is ONE Session created', async () => {
    const { runtime, http } = await build();
    await runtime.auth.verifyRecoveryCode('reader@example.test', '123456');
    await runtime.auth.completePasswordRecovery('new secret');
    const view = await surface(runtime);
    await fireEvent.changeText(view.getByTestId('qandeel-sign-in-email'), 'reader@example.test');
    await fireEvent.changeText(view.getByTestId('qandeel-sign-in-password'), 'new secret');
    await act(async () => {
      await fireEvent.press(view.getByTestId('qandeel-sign-in-submit'));
      await settle();
    });
    expect(runtime.getPhase().kind).toBe('READY');
    expect(http.creates()).toHaveLength(1);
    await view.unmount();
    runtime.dispose();
  });
});

describe('the final sign-in by Login ID reaches the world through the existing runtime', () => {
  it('a Login ID typed into the ONE identifier field ends READY with exactly one Session', async () => {
    const { runtime, http, port } = await build();
    const view = await surface(runtime);
    await fireEvent.changeText(view.getByTestId('qandeel-sign-in-email'), 'Mona.Ali');
    await fireEvent.changeText(view.getByTestId('qandeel-sign-in-password'), 'correct horse');
    await act(async () => {
      await fireEvent.press(view.getByTestId('qandeel-sign-in-submit'));
      await settle();
    });
    expect(port.loginIdSignIns).toEqual([{ loginId: 'Mona.Ali', password: 'correct horse' }]);
    expect(runtime.getPhase().kind).toBe('READY');
    expect(http.creates()).toHaveLength(1);
    await view.unmount();
    runtime.dispose();
  });
});

describe('session end versus unknown, as the reader meets it', () => {
  it('a first launch with no session is the ordinary Sign in — no ended-session claim', async () => {
    const { runtime } = await build();
    const view = await surface(runtime);
    expect(view.getByTestId('qandeel-sign-in-gateway')).toBeTruthy();
    expect(notice(view).queryByText(EN.sessionEnded)).toBeNull();
    await view.unmount();
    runtime.dispose();
  });

  it('a session the provider ended at restore reaches Sign in WITH the approved notice', async () => {
    const { runtime, http } = await build((port) => port.restoreWith({ ok: false, failure: { kind: 'SESSION_ENDED', detail: 'refresh refused' } }));
    expect(runtime.getPhase().kind).toBe('SIGNED_OUT');
    const view = await surface(runtime);
    expect(notice(view).getByText(EN.sessionEnded)).toBeTruthy();
    expect(http.calls).toHaveLength(0);
    await view.unmount();
    runtime.dispose();
  });

  it('a live world whose session the provider ended retires it and shows Sign in with the notice', async () => {
    const { runtime, port } = await build(undefined, { userId: 'alice', accessToken: 'token-a' });
    expect(runtime.getPhase().kind).toBe('READY');
    const view = await surface(runtime);
    await act(async () => {
      port.emit(null, 'SIGNED_OUT');
      await settle();
    });
    expect(runtime.getPhase().kind).toBe('SIGNED_OUT');
    expect(notice(view).getByText(EN.sessionEnded)).toBeTruthy();
    await view.unmount();
    runtime.dispose();
  });

  it('an explicit sign-out from the world reaches Sign in WITHOUT the notice', async () => {
    const { runtime, port } = await build(undefined, { userId: 'alice', accessToken: 'token-a' });
    const view = await surface(runtime);
    await act(async () => {
      const signingOut = runtime.auth.signOut();
      port.emit(null, 'SIGNED_OUT');
      await signingOut;
      await settle();
    });
    expect(runtime.getPhase().kind).toBe('SIGNED_OUT');
    expect(view.getByTestId('qandeel-sign-in-gateway')).toBeTruthy();
    expect(notice(view).queryByText(EN.sessionEnded)).toBeNull();
    await view.unmount();
    runtime.dispose();
  });

  it('an unverifiable session is the Product recovery state — never Sign in, never a world, never technical', async () => {
    const { runtime, http } = await build((port) => port.restoreWith({ ok: false, failure: { kind: 'NETWORK', detail: 'offline' } }));
    expect(runtime.getPhase().kind).toBe('AUTH_ERROR');
    const view = await surface(runtime);
    expect(view.getByTestId('qandeel-session-unverified')).toBeTruthy();
    expect(view.queryByTestId('qandeel-sign-in-gateway')).toBeNull();
    expect(view.queryByTestId(RUNTIME_STATE_TEST_ID)).toBeNull();
    expect(http.calls).toHaveLength(0);
    await view.unmount();
    runtime.dispose();
  });

  it('Try again that restores the session resumes canonically with ONE Session and one runtime generation', async () => {
    const { runtime, http, port } = await build((p) => p.restoreWith({ ok: false, failure: { kind: 'NETWORK', detail: 'offline' } }));
    const view = await surface(runtime);
    port.restoreWith({ ok: true, value: { userId: 'alice', accessToken: 'token-a' } });
    await act(async () => {
      await fireEvent.press(view.getByTestId('qandeel-session-unverified-retry'));
      await settle();
    });
    expect(runtime.getPhase().kind).toBe('READY');
    expect(http.creates()).toHaveLength(1);
    const phase = runtime.getPhase();
    expect(phase.kind === 'READY' && phase.runtime.bundle.authGeneration).toBe(1);
    expect(view.getByTestId('qandeel-world-depth')).toBeTruthy();
    await view.unmount();
    runtime.dispose();
  });

  it('Try again that proves the session ended reaches Sign in with the notice', async () => {
    const { runtime, port } = await build((p) => p.restoreWith({ ok: false, failure: { kind: 'NETWORK', detail: 'offline' } }));
    const view = await surface(runtime);
    port.restoreWith({ ok: false, failure: { kind: 'SESSION_ENDED', detail: 'refresh refused' } });
    await act(async () => {
      await fireEvent.press(view.getByTestId('qandeel-session-unverified-retry'));
      await settle();
    });
    expect(runtime.getPhase().kind).toBe('SIGNED_OUT');
    expect(notice(view).getByText(EN.sessionEnded)).toBeTruthy();
    await view.unmount();
    runtime.dispose();
  });
});
