/**
 * S7-05 — the real-device proof root. VALIDATION ONLY.
 *
 * Exactly the S7-04 proof root — the PRODUCTION phase surface, `RuntimePhaseSurface`, under the same gesture root, root
 * identity and status bar, over a runtime built by the production `createIntegrationRuntime` — over the S7-05 proof
 * world (`s705-proof-world.ts`), whose scenario a launch link chooses:
 *
 *   qandeel://s705-proof/journey   (the default; also any other launch)
 *   qandeel://s705-proof/faults
 *   qandeel://s705-proof/revoked
 *
 * Every Product module the reader sees is the shipped one. Nothing on screen is drawn by this file.
 */
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { createManualForegroundSignal } from '../../runtime-entry';
import { PRODUCT_ROOT_TEST_ID, RuntimePhaseSurface } from '../composition/ProductRoot';
import { createIntegrationRuntime, type IntegrationRuntime } from '../runtime/integration-runtime';
import { createS705ProofWorld, s705ProofScenario, type S705ProofScenario } from './s705-proof-world';

function buildProofRuntime(scenario: S705ProofScenario): IntegrationRuntime {
  const world = createS705ProofWorld(scenario);
  const built = createIntegrationRuntime({
    config: world.config,
    authPort: world.auth,
    httpFetch: world.fetch,
    // No live polling in the proof: the scripted world has no later deliveries to catch up on.
    foreground: createManualForegroundSignal('INACTIVE'),
    recoveryStorage: createEphemeralProductRecoveryStorage(),
  });
  if (!built.ok) throw new Error(`the S7-05 proof runtime could not be built: ${built.phase.detail}`);
  return built.runtime;
}

function ProofRuntime({ scenario }: { readonly scenario: S705ProofScenario }) {
  const [runtime] = useState<IntegrationRuntime>(() => buildProofRuntime(scenario));
  useEffect(() => {
    void runtime.start();
    return () => runtime.dispose();
  }, [runtime]);
  return <RuntimePhaseSurface runtime={runtime} />;
}

export function S705ProofRoot() {
  const [scenario, setScenario] = useState<S705ProofScenario | null>(null);
  useEffect(() => {
    let live = true;
    Linking.getInitialURL()
      .then((url) => live && setScenario(s705ProofScenario(url)))
      .catch(() => live && setScenario('journey'));
    return () => {
      live = false;
    };
  }, []);
  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root} testID={PRODUCT_ROOT_TEST_ID}>
        <StatusBar style="auto" />
        {scenario === null ? null : <ProofRuntime scenario={scenario} />}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
