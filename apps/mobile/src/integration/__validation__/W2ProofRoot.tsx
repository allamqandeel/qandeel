/**
 * W2-01 — the visual-proof root. VALIDATION ONLY.
 *
 * It first shows a bare scenario chooser — engineering vocabulary, never Product copy — because the
 * three launches the proof must show (a first launch, a session the provider ended, an unverifiable
 * session) differ BEFORE the Product appears. Once one is chosen it mounts the PRODUCTION phase surface,
 * `RuntimePhaseSurface`, exactly as `ProductRoot` does, over a runtime built by the production
 * `createIntegrationRuntime` given the W2 proof world (`w2-proof-world.ts`). Every Product module the
 * reader then sees — the final Sign in, password recovery, the session-ended notice, the
 * unable-to-verify-session state, the world — is the shipped one.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { createManualForegroundSignal } from '../../runtime-entry';
import { PRODUCT_ROOT_TEST_ID, RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLanguage } from '../locale/device-locale';
import { createIntegrationRuntime, type IntegrationRuntime } from '../runtime/integration-runtime';
import { createW2ProofWorld, type W2ProofScenario } from './w2-proof-world';

function buildProofRuntime(scenario: W2ProofScenario): IntegrationRuntime {
  const world = createW2ProofWorld(deviceProductLanguage(), scenario);
  const built = createIntegrationRuntime({
    config: world.config,
    authPort: world.auth,
    httpFetch: world.fetch,
    foreground: createManualForegroundSignal('INACTIVE'),
    recoveryStorage: createEphemeralProductRecoveryStorage(),
  });
  if (!built.ok) throw new Error(`the W2-01 proof runtime could not be built: ${built.phase.detail}`);
  return built.runtime;
}

const SCENARIOS: readonly { readonly scenario: W2ProofScenario; readonly testID: string }[] = [
  { scenario: 'SIGNED_OUT', testID: 'w2-proof-scenario-signed-out' },
  { scenario: 'SESSION_ENDED', testID: 'w2-proof-scenario-session-ended' },
  { scenario: 'UNKNOWN', testID: 'w2-proof-scenario-unknown' },
];

function ProofRuntime({ scenario }: { readonly scenario: W2ProofScenario }) {
  const [runtime] = useState<IntegrationRuntime>(() => buildProofRuntime(scenario));
  useEffect(() => {
    void runtime.start();
    return () => runtime.dispose();
  }, [runtime]);
  return <RuntimePhaseSurface runtime={runtime} />;
}

export function W2ProofRoot() {
  const [scenario, setScenario] = useState<W2ProofScenario | null>(null);
  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.root} testID={PRODUCT_ROOT_TEST_ID}>
        <StatusBar style="auto" />
        {scenario === null ? (
          <View style={styles.chooser} accessibilityLanguage="en">
            {SCENARIOS.map((entry) => (
              <Pressable key={entry.scenario} testID={entry.testID} onPress={() => setScenario(entry.scenario)} style={styles.choice}>
                <Text>{`proof scenario: ${entry.scenario}`}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <ProofRuntime scenario={scenario} />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  chooser: { flex: 1, justifyContent: 'center', padding: 24, rowGap: 16 },
  choice: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1 },
});
