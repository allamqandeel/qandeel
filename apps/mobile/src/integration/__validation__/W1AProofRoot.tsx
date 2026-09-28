/**
 * W1A-01 — the visual-proof root. VALIDATION ONLY.
 *
 * It mounts the PRODUCTION phase surface, `RuntimePhaseSurface`, exactly as `ProductRoot` does — the
 * same gesture root, the same root identity and the same status bar — over a runtime built by the
 * production `createIntegrationRuntime`. The one difference from the Product binary is what the
 * runtime is given: the proof world's in-memory identity and scripted network (`w1a-proof-world.ts`)
 * instead of Supabase and the API. Every Product module the reader sees — the depth composition, the
 * Conversation, the Living Analysis Map, the controller and the transport — is the shipped one.
 */
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { createManualForegroundSignal } from '../../runtime-entry';
import { PRODUCT_ROOT_TEST_ID, RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLanguage } from '../locale/device-locale';
import { createIntegrationRuntime, type IntegrationRuntime } from '../runtime/integration-runtime';
import { createW1AProofWorld } from './w1a-proof-world';

/** Opening the proof through this link starts it signed out, on the Sign-in gateway (keyboard proof). */
export const W1A_PROOF_SIGN_IN_LINK = 'qandeel://w1a-proof/sign-in';

function buildProofRuntime(signedIn: boolean): IntegrationRuntime {
  const world = createW1AProofWorld(deviceProductLanguage(), undefined, signedIn);
  const built = createIntegrationRuntime({
    config: world.config,
    authPort: world.auth,
    httpFetch: world.fetch,
    // No live polling in the proof: the scripted world has no later deliveries to catch up on.
    foreground: createManualForegroundSignal('INACTIVE'),
    recoveryStorage: createEphemeralProductRecoveryStorage(),
  });
  if (!built.ok) throw new Error(`the W1A-01 proof runtime could not be built: ${built.phase.detail}`);
  return built.runtime;
}

export function W1AProofRoot() {
  const [runtime, setRuntime] = useState<IntegrationRuntime | null>(null);
  useEffect(() => {
    let built: IntegrationRuntime | null = null;
    let cancelled = false;
    void Linking.getInitialURL()
      .catch(() => null)
      .then((url) => {
        if (cancelled) return;
        built = buildProofRuntime(url !== W1A_PROOF_SIGN_IN_LINK);
        setRuntime(built);
        void built.start();
      });
    return () => {
      cancelled = true;
      built?.dispose();
    };
  }, []);
  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root} testID={PRODUCT_ROOT_TEST_ID}>
        <StatusBar style="auto" />
        {runtime === null ? null : <RuntimePhaseSurface runtime={runtime} />}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
