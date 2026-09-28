/**
 * W1B-01 — the visual-proof root. VALIDATION ONLY.
 *
 * It mounts the PRODUCTION phase surface, `RuntimePhaseSurface`, exactly as `ProductRoot` does, over a
 * runtime built by the production `createIntegrationRuntime`. The one difference from the Product
 * binary is what the runtime is given: the W1B proof world's in-memory identity provider and scripted
 * network (`w1b-proof-world.ts`) instead of Supabase and the API. Every Product module the reader sees
 * — the Auth Gateway destination, T-14's Sign-in form, Create account, Verify Email, the first-use gate
 * and Welcome, the Conversation and its opening — is the shipped one. It starts signed out: the proof
 * is "Auth Gateway onward".
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { createManualForegroundSignal } from '../../runtime-entry';
import { PRODUCT_ROOT_TEST_ID, RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLanguage } from '../locale/device-locale';
import { createIntegrationRuntime, type IntegrationRuntime } from '../runtime/integration-runtime';
import { createW1BProofWorld } from './w1b-proof-world';

function buildProofRuntime(): IntegrationRuntime {
  const world = createW1BProofWorld(deviceProductLanguage());
  const built = createIntegrationRuntime({
    config: world.config,
    authPort: world.auth,
    httpFetch: world.fetch,
    // No live polling in the proof: the scripted world has no later deliveries to catch up on.
    foreground: createManualForegroundSignal('INACTIVE'),
    recoveryStorage: createEphemeralProductRecoveryStorage(),
  });
  if (!built.ok) throw new Error(`the W1B-01 proof runtime could not be built: ${built.phase.detail}`);
  return built.runtime;
}

export function W1BProofRoot() {
  const [runtime] = useState<IntegrationRuntime>(() => buildProofRuntime());
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
