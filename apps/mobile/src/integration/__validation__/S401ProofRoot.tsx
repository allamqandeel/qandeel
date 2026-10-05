/**
 * S4-01 — the Shared World device-proof root. VALIDATION ONLY.
 *
 * It mounts the PRODUCTION phase surface, `RuntimePhaseSurface`, over a runtime built by the production
 * `createIntegrationRuntime`, given the VPORT-01 proof world's in-memory identity and scripted network (reused, not
 * copied). Every module the reader sees — the Conversation, the Global Switcher, the Shared root, the invitation, the
 * World shell, General Settings → Shared ID — is the shipped one, over the real Shared controllers.
 *
 * The one validation seam is an in-memory stand-in for the Shared API that answers `/shared/*` as migration 0138 and
 * `apps/api/src/shared-world` do: the Shared ID is provisioned on its first read and regenerated to a new value; an
 * invitation answers SUBMITTED for every well-formed Shared ID (it names nobody) and INVALID_SHARED_ID only for a
 * malformed one; acceptance births exactly one World with exactly the two humans; decline creates nothing; entry is
 * ALLOW only for a current member and one neutral UNAVAILABLE otherwise. The database proof of those semantics is the
 * real-PostgreSQL verifier (`database/verify-migration-0138.mjs`); this root proves what the reader meets. Every Name is
 * SYNTHETIC test text, never Product copy. It is reachable only through `select-s401-proof-entry.mjs --apply` with
 * `S401_SHARED_PROOF=1`.
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
import { createManualForegroundSignal, type RuntimeHttpFetch } from '../../runtime-entry';
import { PRODUCT_ROOT_TEST_ID, RuntimePhaseSurface } from '../composition/ProductRoot';
import { deviceProductLanguage } from '../locale/device-locale';
import { createIntegrationRuntime, type IntegrationRuntime } from '../runtime/integration-runtime';
import { createVport01ProofWorld } from './vport01-proof-world';

const LINK = /^qandeel:\/\/s401-proof\/(invite|world)\/(arrive|seed|revoke)$/u;
/** SYNTHETIC Names — validation fixtures, never Product copy. */
const INVITER = { ar: 'هدير الاختبار', en: 'Fixture Hadir' };
const SELF = { ar: 'القارئ الاختبار', en: 'Fixture Reader' };
const SHARED_IDS = ['K7QM-4XWD-P9TR', 'AB12-CD34-EF56', 'MN78-PQ90-RS12'];
/** How long the stand-in takes to resolve an entry, so the pre-authority shell is observable on a device. */
const ENTRY_DELAY_MS = 1500;
const COMPACT = /^[0-9A-HJKMNP-TV-Z]{12}$/u;

function createValidationShared(language: 'ar' | 'en') {
  let next = 1;
  const uuid = () => `5401${String(next++).padStart(4, '0')}-0000-4000-8000-000000000000`;
  let issued = -1;
  const invitations: { invitationId: string }[] = [];
  const worlds: { worldId: string; current: boolean }[] = [];
  const members = (worldId: string) => [{ name: SELF[language], self: true }, { name: INVITER[language], self: false }].map((m) => ({ ...m, worldId }));
  const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const wellFormed = (value: string) => COMPACT.test(value.toUpperCase().replace(/[\s-]/gu, '').replace(/O/gu, '0').replace(/[IL]/gu, '1'));
  return {
    arrive() {
      invitations.push({ invitationId: uuid() });
    },
    seed() {
      worlds.push({ worldId: uuid(), current: true });
    },
    revoke() {
      for (const world of worlds) world.current = false;
    },
    async fetch(path: string, method: string, body: Record<string, unknown> | undefined) {
      if (path === '/shared' && method === 'GET') {
        return json(200, {
          capabilities: { invitation: true, birth: true },
          worlds: worlds.filter((w) => w.current).map((w) => ({ worldId: w.worldId, members: members(w.worldId).map(({ name, self }) => ({ name, self })) })),
          invitations: invitations.map((i) => ({ invitationId: i.invitationId, inviterName: INVITER[language] })),
        });
      }
      if (path === '/shared/identity') {
        if (issued < 0) issued = 0;
        return json(200, { status: 'READY', sharedId: SHARED_IDS[issued] });
      }
      if (path === '/shared/identity/regenerate') {
        issued = Math.min(issued + 1, SHARED_IDS.length - 1);
        return json(200, { status: 'READY', sharedId: SHARED_IDS[issued] });
      }
      if (path === '/shared/invitations') {
        const value = typeof body?.sharedId === 'string' ? body.sharedId : '';
        return json(200, { outcome: wellFormed(value) ? 'SUBMITTED' : 'INVALID_SHARED_ID' });
      }
      const act = /^\/shared\/invitations\/([0-9a-f-]+)\/(accept|decline)$/u.exec(path);
      if (act !== null) {
        const index = invitations.findIndex((i) => i.invitationId === act[1]);
        if (index < 0) return json(200, act[2] === 'accept' ? { outcome: 'NOT_ACCEPTABLE' } : { outcome: 'NOT_DECLINABLE' });
        invitations.splice(index, 1);
        if (act[2] === 'decline') return json(200, { outcome: 'DECLINED' });
        const worldId = uuid();
        worlds.push({ worldId, current: true });
        return json(200, { outcome: 'BORN', worldId });
      }
      const entry = /^\/shared\/worlds\/([0-9a-f-]+)$/u.exec(path);
      if (entry !== null) {
        await new Promise((resolve) => setTimeout(resolve, ENTRY_DELAY_MS));
        const world = worlds.find((w) => w.worldId === entry[1] && w.current);
        if (world === undefined) return json(200, { outcome: 'UNAVAILABLE' });
        return json(200, { outcome: 'ALLOW', world: { worldId: world.worldId, bornAt: new Date().toISOString(), members: members(world.worldId).map(({ name, self }) => ({ name, self })) } });
      }
      return json(404, {});
    },
  };
}

function buildProofRuntime(shared: ReturnType<typeof createValidationShared>): IntegrationRuntime {
  const world = createVport01ProofWorld(deviceProductLanguage());
  const fetch: RuntimeHttpFetch = async (input, init) => {
    const path = input.replace(/^https?:\/\/[^/]+/u, '').split('?')[0];
    if (path === '/shared' || path.startsWith('/shared/')) {
      return shared.fetch(path, init?.method ?? 'GET', init?.body === undefined ? undefined : JSON.parse(init.body) as Record<string, unknown>);
    }
    return world.fetch(input, init);
  };
  const built = createIntegrationRuntime({
    config: world.config,
    authPort: world.auth,
    httpFetch: fetch,
    foreground: createManualForegroundSignal('INACTIVE'),
    recoveryStorage: createEphemeralProductRecoveryStorage(),
  });
  if (!built.ok) throw new Error(`the S4-01 proof runtime could not be built: ${built.phase.detail}`);
  return built.runtime;
}

export function S401ProofRoot() {
  const [shared] = useState(() => createValidationShared(deviceProductLanguage()));
  const [runtime] = useState<IntegrationRuntime>(() => buildProofRuntime(shared));
  useEffect(() => {
    void runtime.start();
    const subscription = Linking.addEventListener('url', ({ url }) => {
      const match = LINK.exec(url);
      if (match === null) return;
      if (match[1] === 'invite' && match[2] === 'arrive') shared.arrive();
      if (match[1] === 'world' && match[2] === 'seed') shared.seed();
      if (match[1] === 'world' && match[2] === 'revoke') shared.revoke();
    });
    return () => {
      subscription.remove();
      runtime.dispose();
    };
  }, [runtime, shared]);
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
