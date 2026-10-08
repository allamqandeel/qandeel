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
 *   qandeel://s401-proof/world/allow     releases the held pre-authority entry into the seeded World (Journey C)
 *   qandeel://s401-proof/world/revoke    the reader's membership ends (fail-safe re-entry)
 *
 * S4-02 — the Shared conversation over the same production composition:
 *
 *   qandeel://s401-proof/conversation/seed   the reader shares one World with a conversation already in it
 *   qandeel://s401-proof/conversation/peer   the other person speaks (proved visible only after the reader's refresh)
 *
 * S4-03 — the Shared lifecycle over the same production composition:
 *
 *   qandeel://s401-proof/lifecycle/seed      a World of the reader and one other person, governance and history open
 *   qandeel://s401-proof/lifecycle/approve   every other required member approves every pending proposal / package
 *   qandeel://s401-proof/history/seed        a World of three; the reader joined late; a newcomer joined after the reader
 *   qandeel://s401-proof/history/grant       the other person's approved package shows the reader their earlier words
 *   qandeel://s401-proof/history/delete      the other person deletes their own words (after the World ended)
 *
 * S5-01 — the Public World over the same production composition (its own link, `qandeel://public`, is the PRODUCTION
 * link, taken by the production Linking source — never this hook):
 *
 *   qandeel://s401-proof/public/allow        releases the held Public World entry (the pre-authority shell, then the root)
 *
 * S5-03B — the Product Visual Review of the Public semantic field (off until this link; every earlier leg is unchanged):
 *
 *   qandeel://s401-proof/public/seed         the field answers from the SYNTHETIC fixture `s503b-visual-field.ts`
 *   qandeel://s401-proof/public/relation-accept   S5-03C smoke: the synthetic other side accepts the reader's relation requests
 *   qandeel://s401-proof/public/peer-reply        S5-04 smoke: a synthetic other person replies to the reader's latest own
 *                                                 discussion post, and its Public Activity item appears for the reader
 *
 * SHARED-VIS-01 — the Product Visual Review of the Shared World's Living Analysis field:
 *
 *   qandeel://s401-proof/shared-field/seed   two Worlds of the reader with the places of the SYNTHETIC fixture
 *                                            `shared-vis-proof-field.ts`
 */
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { createEphemeralPushDeviceStore, createInertPushPlatformPort } from '../../push';
import { createEphemeralProductRecoveryStorage } from '../../recovery';
import { createManualForegroundSignal } from '../../runtime-entry';
import { PRODUCT_ROOT_TEST_ID, RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLanguage } from '../locale/device-locale';
import { createIntegrationRuntime, type IntegrationRuntime } from '../runtime/integration-runtime';
import { createS401ProofWorld, type S401ProofWorld } from './s401-proof-world';

const LINK = /^qandeel:\/\/s401-proof\/(invite|world|conversation|lifecycle|history|public|shared-field)\/(arrive|seed|allow|revoke|peer|approve|grant|delete|relation-accept|peer-reply)$/u;

function buildProofRuntime(world: S401ProofWorld): IntegrationRuntime {
  const built = createIntegrationRuntime({
    config: world.config,
    authPort: world.auth,
    httpFetch: world.fetch,
    foreground: createManualForegroundSignal('INACTIVE'),
    recoveryStorage: createEphemeralProductRecoveryStorage(),
    // S4-04: the first legitimate Shared entry offers the notification education (proven deterministically in Jest). These
    // journeys prove Shared navigation, conversation and lifecycle, so the device's notification system is the inert one
    // and "Not now" was already chosen on this proof installation: the education never covers a World here.
    pushPlatform: createInertPushPlatformPort(),
    pushDeviceStore: createEphemeralPushDeviceStore({ declined: true }),
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
      if (match[1] === 'world' && match[2] === 'allow') world.allow();
      if (match[1] === 'world' && match[2] === 'revoke') world.revoke();
      if (match[1] === 'conversation' && match[2] === 'seed') world.converse();
      if (match[1] === 'conversation' && match[2] === 'peer') world.peer();
      if (match[1] === 'lifecycle' && match[2] === 'seed') world.lifecycle();
      if (match[1] === 'lifecycle' && match[2] === 'approve') world.peerApprove();
      if (match[1] === 'history' && match[2] === 'seed') world.history();
      if (match[1] === 'history' && match[2] === 'grant') world.grant();
      if (match[1] === 'history' && match[2] === 'delete') world.peerDelete();
      if (match[1] === 'public' && match[2] === 'allow') world.publicAllow();
      if (match[1] === 'public' && match[2] === 'seed') world.publicSeed();
      if (match[1] === 'public' && match[2] === 'relation-accept') world.relationAccept();
      if (match[1] === 'public' && match[2] === 'peer-reply') world.peerReply();
      if (match[1] === 'shared-field' && match[2] === 'seed') world.sharedField();
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
