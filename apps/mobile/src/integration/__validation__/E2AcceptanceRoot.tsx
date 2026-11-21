/**
 * COSMOS-FINAL-01 E-2 — the SYNTHETIC-DATA ACCEPTANCE root. VALIDATION ONLY.
 *
 * It mounts the PRODUCTION phase surface, `RuntimePhaseSurface`, over a runtime built by the production
 * `createIntegrationRuntime`, exactly as `S401ProofRoot` does, given the populated E-2 world (`e2-acceptance-world.ts`).
 * Every screen, control, gesture and controller is the shipped one; only the identity and the network are synthetic,
 * in memory, and seeded at launch (no proof link is needed). It is reachable only through the E-2 build's entry
 * (`e2-acceptance-entry.tsx`), never from the Product binary.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { createEphemeralPushDeviceStore, createInertPushPlatformPort } from '../../push';
import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { createManualForegroundSignal } from '../../runtime-entry';
import { PRODUCT_ROOT_TEST_ID, RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLanguage } from '../locale/device-locale';
import { createIntegrationRuntime, type IntegrationRuntime } from '../runtime/integration-runtime';
import { createE2AcceptanceWorld, type E2AcceptanceWorld } from './e2-acceptance-world';

function buildRuntime(world: E2AcceptanceWorld): IntegrationRuntime {
  const built = createIntegrationRuntime({
    config: world.config,
    authPort: world.auth,
    httpFetch: world.fetch,
    foreground: createManualForegroundSignal('INACTIVE'),
    recoveryStorage: createEphemeralProductRecoveryStorage(),
    // No notification system in a synthetic build: the education is already declined, so it never covers a World.
    pushPlatform: createInertPushPlatformPort(),
    pushDeviceStore: createEphemeralPushDeviceStore({ declined: true }),
  });
  if (!built.ok) throw new Error(`the E-2 acceptance runtime could not be built: ${built.phase.detail}`);
  return built.runtime;
}

export function E2AcceptanceRoot() {
  const [world] = useState(() => createE2AcceptanceWorld(deviceProductLanguage()));
  const [runtime] = useState<IntegrationRuntime>(() => buildRuntime(world));
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

const styles = StyleSheet.create({
  root: { flex: 1 },
});
