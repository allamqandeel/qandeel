/**
 * S8B-06 CP3 — the integrated device proof's world. VALIDATION ONLY.
 *
 * The PRODUCTION runtime (`createIntegrationRuntime`) over a REAL local S8B-05 server (`apps/api/scripts/
 * s8b-06-cp3-device-proof-server.ts`), reached on the phone's loopback through `adb reverse tcp:8806 tcp:8806`. Every
 * call route, the call truth, the voice capability and the conversation's history and written turns are the server's;
 * only what the proof server does not compose is answered here from fixtures, as the S7-04 proof world answers it: the
 * Session's creation (the server's ONE synthetic Session), the first-use read and the temporal / historical-projection
 * reads behind the Analysis (fixture threads). So the Living Map's CONTENT on the device is a fixture; what the device
 * proves of the Analysis is that the call keeps it open and that every committed call turn asks it again (the catch-up),
 * which the proof server records (its `history` evidence). This world logs nothing (S8B-06 CP2: nothing in voice-call/ is
 * logged); the APK 1 – 3 builds of the device proof carried a request counter here, archived with their exact sources in
 * the CP3 evidence (`apk3-source/`).
 *
 * The identity is in memory: the proof server's ONE synthetic bearer for its ONE synthetic person. Nothing here is
 * reachable from the Product route: this directory is outside the production import closure, and the proof build selects
 * it through one recorded change of the manifest's `main`.
 */
import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import type { HistoricalSemanticDepth } from '@qandeel/runtime';
import type { MobilePublicConfig, RuntimeHttpFetch, SupabaseAuthPort } from '../../runtime-entry';

/** The proof server's synthetic person and Session (s8b-06-cp3-device-proof-server.ts). */
export const S806CP3_PROOF_SESSION = 'a8060000-0000-4000-8000-000000000003';
const PROOF_USER = 'a8060000-0000-4000-8000-0000000000a1';
const PROOF_BEARER = 's806cp3-proof-bearer';
const LIVE_HEAD = 6;

/** The phone's loopback, forwarded by `adb reverse` to the proof server on the host. Never a hosted origin. */
export const S806CP3_PROOF_CONFIG: MobilePublicConfig = Object.freeze({
  apiBaseUrl: 'http://127.0.0.1:8806',
  supabaseUrl: 'https://s806cp3-proof.invalid',
  supabasePublishableKey: 'sb_publishable_s806cp3proofs806cp3pr_proofkey',
});

const THREADS = [
  { id: 's806cp3-proof-thread-1', x: '0', y: '0' },
  { id: 's806cp3-proof-thread-2', x: '880000', y: '-400000' },
  { id: 's806cp3-proof-thread-3', x: '-720000', y: '580000' },
];

const respond = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** The routes the proof server answers: the call, its truth, the voice capability, the history and written turns. */
function served(path: string, method: string): boolean {
  if (path.startsWith('/voice/')) return true;
  return path === `/conversation/sessions/${S806CP3_PROOF_SESSION}/turns` && (method === 'GET' || method === 'POST');
}

export interface S806Cp3ProofWorld {
  readonly config: MobilePublicConfig;
  readonly auth: SupabaseAuthPort;
  readonly fetch: RuntimeHttpFetch;
}

export function createS806Cp3ProofWorld(): S806Cp3ProofWorld {
  const fetch: RuntimeHttpFetch = async (input, init) => {
    const method = init?.method ?? 'GET';
    const base = S806CP3_PROOF_CONFIG.apiBaseUrl;
    if (!input.startsWith(base)) return respond(404, {});
    const [path, query = ''] = input.slice(base.length).split('?');
    if (served(path, method)) {
      const response = await globalThis.fetch(input, {
        method, ...(init?.headers ? { headers: init.headers } : {}), ...(init?.body === undefined ? {} : { body: init.body }), ...(init?.signal ? { signal: init.signal } : {}),
      });
      return { ok: response.ok, status: response.status, json: () => response.json() as Promise<unknown> };
    }
    if (path.endsWith('/historical-projection')) {
      const params = Object.fromEntries(query.split('&').filter(Boolean).map((pair) => pair.split('=') as [string, string]));
      const tc = Number(params.tc ?? LIVE_HEAD);
      const depth = (params.depth ?? 'WORLD') as HistoricalSemanticDepth;
      return respond(200, disclosureFixture({ depth, sessionId: S806CP3_PROOF_SESSION, tc, liveHead: LIVE_HEAD, threads: THREADS }));
    }
    if (path.endsWith('/temporal/events')) {
      return respond(200, { sessionId: S806CP3_PROOF_SESSION, events: [] });
    }
    if (path.endsWith('/temporal/live-focus-events')) return respond(200, { sessionId: S806CP3_PROOF_SESSION, events: [] });
    if (path.endsWith('/temporal')) {
      return respond(200, { sessionId: S806CP3_PROOF_SESSION, liveHead: LIVE_HEAD, liveFocus: { kind: 'NONE' }, liveFocusAtSp: null });
    }
    if (method === 'POST' && path === '/conversation/sessions') {
      return respond(201, { id: S806CP3_PROOF_SESSION, status: 'ACTIVE', channel: 'TEXT', created_at: 'now', updated_at: 'now', last_activity_at: 'now', closed_at: null });
    }
    if (path.endsWith('/account/first-use')) {
      return respond(200, { displayName: null, welcomePending: false, firstConversationOpening: false });
    }
    return respond(404, {});
  };

  // Already authenticated, in memory only. It never signs in, never stores and never refreshes.
  const reader = { userId: PROOF_USER, accessToken: PROOF_BEARER };
  const auth: SupabaseAuthPort = {
    restoreSession: async () => ({ ok: true, value: reader }),
    signInWithPassword: async () => ({ ok: true, value: reader }),
    signUp: async () => ({ ok: false, failure: { kind: 'REFUSED', detail: 'the S8B-06 CP3 proof creates no account' } }),
    verifyEmailCode: async () => ({ ok: false, failure: { kind: 'UNEXPECTED', detail: 'the S8B-06 CP3 proof verifies nothing' } }),
    resendEmailCode: async () => ({ ok: false, failure: { kind: 'REFUSED', detail: 'the S8B-06 CP3 proof sends nothing' } }),
    verifyLoginIdEmailCode: async () => ({ ok: false, failure: { kind: 'UNEXPECTED', detail: 'the S8B-06 CP3 proof has no Login ID' } }),
    resendLoginIdEmailCode: async () => ({ ok: false, failure: { kind: 'REFUSED', detail: 'the S8B-06 CP3 proof has no Login ID' } }),
    signInWithLoginId: async () => ({ ok: false, failure: { kind: 'INVALID_CREDENTIALS', detail: 'the S8B-06 CP3 proof has no Login ID' } }),
    requestPasswordRecovery: async () => ({ ok: true }),
    verifyRecoveryCode: async () => ({ ok: false, failure: { kind: 'UNEXPECTED', detail: 'the S8B-06 CP3 proof recovers nothing' } }),
    updateRecoveredPassword: async () => ({ ok: false, failure: { kind: 'UNEXPECTED', detail: 'the S8B-06 CP3 proof recovers nothing' } }),
    retireRecoveryGrant: async () => undefined,
    signOut: async () => ({ ok: true, value: null }),
    onSessionChange: () => () => undefined,
    startAutoRefresh: () => undefined,
    stopAutoRefresh: () => undefined,
  };

  return { config: S806CP3_PROOF_CONFIG, auth, fetch };
}
