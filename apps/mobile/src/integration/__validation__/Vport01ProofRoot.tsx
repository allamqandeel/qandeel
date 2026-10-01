/**
 * VPORT-01 — the visual-proof root. VALIDATION ONLY.
 *
 * It mounts the PRODUCTION phase surface, `RuntimePhaseSurface`, exactly as `ProductRoot` does — the same
 * gesture root, the same root identity and the same status bar — over a runtime built by the production
 * `createIntegrationRuntime`, given the proof world's in-memory identity and scripted network
 * (`vport01-proof-world.ts`). Every Product module the reader sees — the Conversation, the depth door,
 * the Living Analysis Map and its final world, the Timeline and the chrome — is the shipped one.
 *
 * One thing is added, because the device driver cannot pinch: a proof link that asks for ONE Semantic Zoom
 * step through the production executor `zoomSemanticStep` — the very function the pinch gesture's settle
 * and the accessible Map's "zoom-in" / "zoom-out" actions call. It dispatches the reader's own canonical
 * act on the current store; it writes no state of its own, chooses no camera and fakes no projection, and
 * it exists only in this validation entry, never in the Product route.
 *
 *   qandeel://vport01-proof/zoom-in       one rung deeper (WORLD → THREAD → SESSION → …)
 *   qandeel://vport01-proof/zoom-out      one rung shallower
 *   qandeel://vport01-proof/inspect-home  inspect the Thread whose Home is at the world origin, through
 *                                         inspectObject — the executor the pointer tap and the accessible
 *                                         "inspect" action call — against the Map's current disclosed V
 */
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { inspectObject, mapInspectionContext, mapProjectionRequest, zoomSemanticStep } from '../../map';
import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { createManualForegroundSignal } from '../../runtime-entry';
import { PRODUCT_ROOT_TEST_ID, RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLanguage } from '../locale/device-locale';
import { createIntegrationRuntime, type IntegrationRuntime } from '../runtime/integration-runtime';
import { createVport01ProofWorld } from './vport01-proof-world';

const ZOOM_LINK = /^qandeel:\/\/vport01-proof\/zoom-(in|out)$/u;
const INSPECT_LINK = 'qandeel://vport01-proof/inspect-home';
const ORIGIN_THREAD = 'v-thread-0';

function buildProofRuntime(): IntegrationRuntime {
  const world = createVport01ProofWorld(deviceProductLanguage());
  const built = createIntegrationRuntime({
    config: world.config,
    authPort: world.auth,
    httpFetch: world.fetch,
    foreground: createManualForegroundSignal('INACTIVE'),
    recoveryStorage: createEphemeralProductRecoveryStorage(),
  });
  if (!built.ok) throw new Error(`the VPORT-01 proof runtime could not be built: ${built.phase.detail}`);
  return built.runtime;
}

export function Vport01ProofRoot() {
  // Built once for the life of the root; started and disposed by the effect that owns its lifetime.
  const [runtime] = useState<IntegrationRuntime>(buildProofRuntime);
  useEffect(() => {
    const built = runtime;
    void built.start();
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const phase = built.getPhase();
      if (phase.kind !== 'READY') return;
      const { store, bundle } = phase.runtime;
      const match = ZOOM_LINK.exec(url);
      if (match !== null) {
        zoomSemanticStep(store, match[1] === 'in' ? 'IN' : 'OUT');
        return;
      }
      if (url === INSPECT_LINK) {
        // The SAME derivation the Map composes from: the current request, the one projection cache.
        const request = mapProjectionRequest(store.getState());
        if (request === null) return;
        const resolved = mapInspectionContext(bundle.projection.lookup(request.sessionId, request.tc, request.depth), request);
        if (resolved.ok) inspectObject(store, resolved.context, { family: 'THREAD', id: ORIGIN_THREAD });
      }
    });
    return () => {
      subscription.remove();
      built.dispose();
    };
  }, [runtime]);
  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root} testID={PRODUCT_ROOT_TEST_ID}>
        <StatusBar style="auto" />
        <RuntimePhaseSurface runtime={runtime} />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
