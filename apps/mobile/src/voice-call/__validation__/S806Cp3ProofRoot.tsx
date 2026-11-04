/**
 * S8B-06 CP3 — the integrated device proof root. VALIDATION ONLY.
 *
 * The S7-05 proof root's shape — the PRODUCTION phase surface, `RuntimePhaseSurface`, under the same gesture root, root
 * identity and status bar, over a runtime built by the production `createIntegrationRuntime` — over the CP3 proof world
 * (`s806cp3-proof-world.ts`) and the REAL call device (the native platform and engine), allowed to reach the proof
 * server's plain `ws://` on the phone's loopback only. Every Product module the reader sees is the shipped one. Nothing on
 * screen is drawn by this file.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { loadCallDevice } from '../../call';
import { PRODUCT_ROOT_TEST_ID, RuntimePhaseSurface } from '../../integration/composition/ProductRoot';
import { createIntegrationRuntime, type IntegrationRuntime } from '../../integration/runtime/integration-runtime';
import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { createS806Cp3ProofWorld } from './s806cp3-proof-world';

function buildProofRuntime(): IntegrationRuntime {
  const world = createS806Cp3ProofWorld();
  const built = createIntegrationRuntime({
    config: world.config,
    authPort: world.auth,
    httpFetch: world.fetch,
    recoveryStorage: createEphemeralProductRecoveryStorage(),
    callDevice: { ...loadCallDevice(), insecureLoopbackForProof: true },
  });
  if (!built.ok) throw new Error(`the S8B-06 CP3 proof runtime could not be built: ${built.phase.detail}`);
  return built.runtime;
}

function ProofRuntime() {
  const [runtime] = useState<IntegrationRuntime>(() => buildProofRuntime());
  useEffect(() => {
    void runtime.start();
    return () => runtime.dispose();
  }, [runtime]);
  return <RuntimePhaseSurface runtime={runtime} />;
}

export function S806Cp3ProofRoot() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root} testID={PRODUCT_ROOT_TEST_ID}>
        <StatusBar style="auto" />
        <ProofRuntime />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
