/**
 * S7-04 — the visual-proof root. VALIDATION ONLY.
 *
 * It mounts the PRODUCTION phase surface, `RuntimePhaseSurface`, exactly as `ProductRoot` does — the same gesture
 * root, the same root identity and the same status bar — over a runtime built by the production
 * `createIntegrationRuntime`. The one difference from the Product binary is what the runtime is given: the proof
 * world's in-memory identity and scripted network (`s704-proof-world.ts`), whose Replay routes answer with the
 * REAL-PATH captured Replay wire. Every Product module the reader sees — the depth composition, the Conversation and
 * its Replay entry, the Replay player, the S7-03 composite, the Living Analysis surface and its Map — is the shipped one.
 * Nothing on screen is drawn by this file.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { createManualForegroundSignal } from '../../runtime-entry';
import { PRODUCT_ROOT_TEST_ID, RuntimePhaseSurface } from '../composition/ProductRoot';
import { createIntegrationRuntime, type IntegrationRuntime } from '../runtime/integration-runtime';
import { createS704ProofWorld } from './s704-proof-world';

function buildProofRuntime(): IntegrationRuntime {
  const world = createS704ProofWorld();
  const built = createIntegrationRuntime({
    config: world.config,
    authPort: world.auth,
    httpFetch: world.fetch,
    // No live polling in the proof: the scripted world has no later deliveries to catch up on.
    foreground: createManualForegroundSignal('INACTIVE'),
    recoveryStorage: createEphemeralProductRecoveryStorage(),
  });
  if (!built.ok) throw new Error(`the S7-04 proof runtime could not be built: ${built.phase.detail}`);
  return built.runtime;
}

export function S704ProofRoot() {
  const [runtime] = useState<IntegrationRuntime>(buildProofRuntime);
  useEffect(() => {
    void runtime.start();
    return () => runtime.dispose();
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
