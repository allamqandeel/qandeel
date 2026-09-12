/**
 * T-14 §16.B — which surface the Product root shows for which runtime phase.
 *
 * ONE phase changes meaning: `SIGNED_OUT` stops being an engineering status line and becomes the
 * Product entry the reader actually needs. Every other phase is asserted to be exactly what it was,
 * because a task that quietly converted a technical failure into invented Product reassurance would
 * be doing the thing this contract exists to prevent.
 *
 * The handover is proven end to end through the REAL integration runtime over T-12P's own injection
 * points: a reader types a credential into the real gateway, and the existing phase machinery — not
 * the gateway — carries them to a composed world. Nothing here navigates, and nothing here creates a
 * Session.
 */
import { act, fireEvent, render, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { RESPONSIVE_SURFACE_TEST_ID } from '../../responsive/__fixtures__/composition';
import type { ProductRecoveryStorage } from '../../recovery';
import {
  PRODUCT_SIGN_IN_GATEWAY_TEST_ID,
  SIGN_IN_EMAIL_TEST_ID,
  SIGN_IN_PASSWORD_TEST_ID,
  SIGN_IN_SUBMIT_TEST_ID,
  productSignInCopy,
} from '../auth-gateway';
import { PRODUCT_ROOT_TEST_ID, ProductRoot, RUNTIME_STATE_TEST_ID, RuntimePhaseSurface } from '../composition/ProductRoot';
import type { IntegrationPhase, IntegrationRuntime } from '../runtime/integration-runtime';
import { createIntegrationRuntime } from '../runtime/integration-runtime';
import { TEST_CONFIG, authPortDouble, harness, settle } from '../__fixtures__/integration';
import { createManualForegroundSignal } from '../../runtime-entry';

/**
 * The device metrics the native side supplies at launch.
 *
 * `initialWindowMetrics` is a NATIVE measurement, and under `jest-expo` there is no native side to
 * take it from — it is `null`, so a `SafeAreaProvider` given it renders nothing until an inset event
 * that will never arrive. Both reader-facing surfaces sit inside that provider, so a test must
 * supply what the device supplies. It is done by nesting: a provider inherits its parent's insets
 * when it has none of its own, so the PRODUCTION mapping below is rendered exactly as written, with
 * only the missing platform fact stood in for.
 */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
};

/** The production phase surface, with the device fact `jest-expo` cannot provide. */
function mountPhaseSurface(runtime: IntegrationRuntime): Promise<RenderResult> {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <RuntimePhaseSurface runtime={runtime} />
    </SafeAreaProvider>,
  );
}

/** A recovery storage that records every key it is asked for. Nothing may read it while signed out. */
function recordingRecoveryStorage(reads: string[]): ProductRecoveryStorage {
  return {
    getItem: async (key) => {
      reads.push(key);
      return null;
    },
    setItem: async () => undefined,
    removeItem: async () => undefined,
  };
}

describe('T14-B1, T14-B2 — SIGNED_OUT is the Product entry, and no longer an engineering status line', () => {
  it('the signed-out root renders the sign-in gateway', async () => {
    const h = await harness({ initialSession: null });
    expect(h.phase().kind).toBe('SIGNED_OUT');
    const view = await mountPhaseSurface(h.runtime);
    await act(async () => {
      await settle();
    });
    expect(view.getByTestId(PRODUCT_SIGN_IN_GATEWAY_TEST_ID)).toBeTruthy();
    await view.unmount();
    h.dispose();
  });

  it('and the technical surface it replaced is nowhere in that tree', async () => {
    const h = await harness({ initialSession: null });
    const view = await mountPhaseSurface(h.runtime);
    await act(async () => {
      await settle();
    });
    expect(view.queryByTestId(RUNTIME_STATE_TEST_ID)).toBeNull();
    expect(JSON.stringify(view.toJSON())).not.toContain('runtime: SIGNED_OUT');
    await view.unmount();
    h.dispose();
  });
});

describe('T14-B3…T14-B7 — every other non-READY phase is still technical', () => {
  const TECHNICAL: readonly IntegrationPhase[] = [
    { kind: 'RESTORING' },
    { kind: 'AUTH_ERROR' },
    { kind: 'RECOVERING' },
    { kind: 'BOOTSTRAPPING' },
    // Typed in full rather than cast: a payload-bearing phase that the surface reads only the KIND of
    // must still be a legal value of the union, or this proves nothing about the real mapping.
    { kind: 'RECOVERY_FAILED', failure: { kind: 'SESSION_INVALID', failure: { kind: 'NOT_AUTHENTICATED' } } },
    { kind: 'BOOTSTRAP_FAILED', failure: { kind: 'NOT_AUTHENTICATED' } },
  ];

  for (const phase of TECHNICAL) {
    it(`${phase.kind} renders the technical state, in engineering vocabulary, with no Product surface`, async () => {
      const h = await harness({ initialSession: null });
      const view = await render(<PhaseUnderTest phase={phase} runtime={h.runtime} />);
      await act(async () => {
        await settle();
      });
      const state = view.getByTestId(RUNTIME_STATE_TEST_ID);
      expect(state.props.accessibilityLanguage).toBe('en');
      expect(JSON.stringify(view.toJSON())).toContain(`runtime: ${phase.kind}`);
      // No Product entry, and no Product word of either language.
      expect(view.queryByTestId(PRODUCT_SIGN_IN_GATEWAY_TEST_ID)).toBeNull();
      const tree = JSON.stringify(view.toJSON());
      for (const language of ['ar', 'en'] as const) {
        expect(tree).not.toContain(productSignInCopy(language).title);
        expect(tree).not.toContain(productSignInCopy(language).submit);
      }
      await view.unmount();
      h.dispose();
    });
  }
});

describe('T14-B8 — READY still composes the unchanged Living Analysis Map', () => {
  it('an authenticated, bootstrapped runtime renders the world and not the gateway', async () => {
    const h = await harness();
    expect(h.phase().kind).toBe('READY');
    const view = await mountPhaseSurface(h.runtime);
    await act(async () => {
      await settle();
    });
    expect(view.getByTestId(RESPONSIVE_SURFACE_TEST_ID)).toBeTruthy();
    expect(view.queryByTestId(PRODUCT_SIGN_IN_GATEWAY_TEST_ID)).toBeNull();
    expect(view.queryByTestId(RUNTIME_STATE_TEST_ID)).toBeNull();
    await view.unmount();
    h.dispose();
  });
});

describe('T14-B9 — a successful sign-in hands control to the existing runtime, and the gateway does nothing else', () => {
  it('the reader submits once, and the existing phase machinery carries them to a composed world', async () => {
    const reads: string[] = [];
    const h = await harness({ initialSession: null, recoveryStorage: recordingRecoveryStorage(reads) });
    expect(h.phase().kind).toBe('SIGNED_OUT');
    // T14-B12: nothing has read this identity's Product recovery, because there is no identity yet.
    expect(reads).toEqual([]);
    expect(h.http.calls).toHaveLength(0);

    const view = await mountPhaseSurface(h.runtime);
    await act(async () => {
      await settle();
    });
    expect(view.getByTestId(PRODUCT_SIGN_IN_GATEWAY_TEST_ID)).toBeTruthy();

    await fireEvent.changeText(view.getByTestId(SIGN_IN_EMAIL_TEST_ID), '  reader@example.test  ');
    await fireEvent.changeText(view.getByTestId(SIGN_IN_PASSWORD_TEST_ID), 'correct horse');
    await act(async () => {
      await fireEvent.press(view.getByTestId(SIGN_IN_SUBMIT_TEST_ID));
      await settle();
    });

    // The runtime owns everything after the credential was accepted: recovery, the Session, the store.
    expect(h.phase().kind).toBe('READY');
    expect(view.queryByTestId(PRODUCT_SIGN_IN_GATEWAY_TEST_ID)).toBeNull();
    expect(view.getByTestId(RESPONSIVE_SURFACE_TEST_ID)).toBeTruthy();

    // And the Session was acquired by the existing bootstrap, exactly once — not by the gateway.
    expect(h.http.creates()).toHaveLength(1);
    // The recovery read happened only AFTER authentication, under the authenticated identity, and it
    // is the trimmed email the gateway submitted that the identity was derived from.
    expect(reads.length).toBeGreaterThan(0);
    expect(reads.every((key) => key.includes('user-for-reader@example.test'))).toBe(true);
    await view.unmount();
    h.dispose();
  });
});

describe('T14-B10, T14-B11 — no route, and no second runtime', () => {
  it('the router root is still exactly the one Product route', async () => {
    // The route output is still the integrated root and nothing else; T-14 adds no auth stack.
    const view = await render(<ProductRoot />);
    expect(view.getByTestId(PRODUCT_ROOT_TEST_ID)).toBeTruthy();
    await view.unmount();
  });

  it('one mount is one runtime: the surface consumes the runtime it is given and builds none', async () => {
    const auth = authPortDouble(null);
    const foreground = createManualForegroundSignal('INACTIVE');
    const built = createIntegrationRuntime({ config: TEST_CONFIG, authPort: auth, foreground });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    await built.runtime.start();
    await settle();
    expect(built.runtime.getPhase().kind).toBe('SIGNED_OUT');

    const view = await mountPhaseSurface(built.runtime);
    await act(async () => {
      await settle();
    });
    // The gateway reached the SAME authority the runtime exposes. A second client, a second authority
    // or a second runtime would show up here as a second listener answering a different object.
    expect(view.getByTestId(PRODUCT_SIGN_IN_GATEWAY_TEST_ID)).toBeTruthy();
    expect(auth.listenerCount()).toBe(1);
    await view.unmount();
    built.runtime.dispose();
  });
});

/**
 * Renders one exact phase through the PRODUCTION mapping, without driving a real runtime into it.
 *
 * `RECOVERING` and `BOOTSTRAPPING` are transient by construction — the runtime passes through them
 * inside one awaited chain — so holding one open would mean a second, fake bootstrap owner. What is
 * under test is the mapping, and the mapping is the real one: only `getPhase` is substituted, on a
 * runtime the harness genuinely built.
 */
function PhaseUnderTest({ phase, runtime }: { readonly phase: IntegrationPhase; readonly runtime: IntegrationRuntime }) {
  return <RuntimePhaseSurface runtime={{ ...runtime, getPhase: () => phase, subscribe: () => () => undefined }} />;
}
