/**
 * S4-01 — the Shared World device-proof root. VALIDATION ONLY.
 *
 * It mounts the PRODUCTION phase surface, `RuntimePhaseSurface`, over a runtime built by the production
 * `createIntegrationRuntime`, given the S4-01 proof world (`s401-proof-world.ts`): the VPORT-01 in-memory identity and
 * scripted network, a signed-in reader's account identity, and an in-memory stand-in for the Shared API that answers as
 * migration 0138 and `apps/api/src/shared-world` do. Every module the reader sees — the Conversation, the Global
 * Switcher, the Shared root, the invitation, the World shell, General Settings → Shared ID — is the shipped one, over the
 * real Shared controllers. The database proof of the Shared semantics is the real-PostgreSQL verifier
 * (`database/verify-migration-0138.mjs`); this root proves what the reader meets. It is reachable only through
 * `select-s401-proof-entry.mjs --apply` with `S401_SHARED_PROOF=1`.
 *
 *   qandeel://s401-proof/invite/arrive   another person (synthetic) invites the reader
 *   qandeel://s401-proof/world/seed      the reader already shares one World (Journey C)
 *   qandeel://s401-proof/world/revoke    the reader's membership ends (fail-safe re-entry)
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
import { createS401ProofWorld, type S401ProofWorld } from './s401-proof-world';

const LINK = /^qandeel:\/\/s401-proof\/(invite|world)\/(arrive|seed|revoke)$/u;

function buildProofRuntime(world: S401ProofWorld): IntegrationRuntime {
  const built = createIntegrationRuntime({
    config: world.config,
    authPort: world.auth,
    httpFetch: world.fetch,
    foreground: createManualForegroundSignal('INACTIVE'),
    recoveryStorage: createEphemeralProductRecoveryStorage(),
  });
  if (!built.ok) throw new Error(`the S4-01 proof runtime could not be built: ${built.phase.detail}`);
  return built.runtime;
}

export function S401ProofRoot() {
  const [world] = useState(() => createS401ProofWorld(deviceProductLanguage()));
  const [runtime] = useState<IntegrationRuntime>(() => buildProofRuntime(world));
  useEffect(() => {
    void runtime.start();
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const match = LINK.exec(url);
      if (match === null) return;
      if (match[1] === 'invite' && match[2] === 'arrive') world.arrive();
      if (match[1] === 'world' && match[2] === 'seed') world.seed();
      if (match[1] === 'world' && match[2] === 'revoke') world.revoke();
    });
    return () => {
      subscription.remove();
      runtime.dispose();
    };
  }, [runtime, world]);
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
