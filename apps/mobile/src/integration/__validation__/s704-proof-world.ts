/**
 * S7-04 — the visual-proof world. VALIDATION ONLY, FIXTURE ONLY.
 *
 * The S7-04 visual proof renders the PRODUCTION phase surface (`RuntimePhaseSurface`) over a runtime built by the
 * production `createIntegrationRuntime`, exactly as the W1A-01 proof does, so the Replay player is seen where it lives:
 * over the Personal depth composition, entered from the Conversation's saved line and from the Analysis, and closed
 * back to the depth it came from. Two things cannot exist in a proof build, and this file stands in for exactly those:
 *
 *   - the identity: an in-memory `SupabaseAuthPort` that is already authenticated, so no credential is entered,
 *     stored or sent anywhere;
 *   - the network: a scripted HTTP implementation. The Replay routes are answered by the REAL-PATH captured Replay
 *     wire (`replay-player/__fixtures__/replay-player-wire.json`, what the real `ReplayService` answered over a real
 *     PostgreSQL database), through `playerServer` in its composition mode (the composition mints its own random
 *     command ids, so a request is matched without its `commandId` and `sessionId`; every other field must be exactly
 *     the captured one). The conversation, its committed units and the live Analysis are fixtures.
 *
 * Every conversational sentence below is FIXTURE TEXT written for the proof. No model generated it, it is not Product
 * copy, and nothing here is reachable from the Product route: this directory is outside the production import closure,
 * and the proof build selects it through one recorded change of the manifest's `main`.
 */
import type { ConversationalUnitsCommittedWireEvent, HistoricalSemanticDepth } from '@qandeel/runtime';

import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';
import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import { playerServer } from '../../replay-player/__fixtures__/player-wire';
import type { MobilePublicConfig, RuntimeHttpFetch, SupabaseAuthPort } from '../../runtime-entry';
import { CONVERSATIONAL_UNITS_COMMITTED } from '../../temporal';

const SESSION = 'a7040000-0000-4000-8000-000000000001';
const LIVE_HEAD = 8;

/** Proof-only config. The origin is a reserved `.invalid` name: nothing can ever be reached through it. */
export const S704_PROOF_CONFIG: MobilePublicConfig = Object.freeze({
  apiBaseUrl: 'https://s704-proof.invalid',
  supabaseUrl: 'https://s704-proof.invalid',
  supabasePublishableKey: 'sb_publishable_s704proofs704proofs704p_proofkey',
});

const THREADS = [
  { id: 's704-proof-thread-1', x: '0', y: '0' },
  { id: 's704-proof-thread-2', x: '900000', y: '-420000' },
  { id: 's704-proof-thread-3', x: '-760000', y: '610000' },
];

/** The fixture conversation (fixture words). Its first four committed messages are the captured draft's range. */
const HISTORY = [
  exchange('اليوم كان طويل ومش قادر أركّز', { reply: 'واضح إن اليوم كان تقيل. إيه أكتر حاجة شدّت انتباهك؟', order: 1 }),
  exchange('الـdeadline بتاع الـproject اتقدّم يومين', { reply: 'ده تغيير كبير في وقت قصير. إيه اللي لسه ناقص؟', order: 2 }),
  exchange('ممكن نرتّب أولوياتي لبكرة؟', { reply: 'خلّينا نبدأ بأهم حاجة لازم تخلص بكرة.', order: 3 }),
];
/** One committed-unit event for one message (the 0065 shape the Replay entry maps messages through). */
const turnEvent = (turnId: string, firstSp: number, lastSp: number, sessionId: string): ConversationalUnitsCommittedWireEvent => ({
  type: CONVERSATIONAL_UNITS_COMMITTED, version: 1, sessionId, batchId: `batch-${firstSp}-${lastSp}`, sourceTurnId: turnId, firstSp, lastSp,
  unitCount: lastSp - firstSp + 1,
});
/** The committed units, so the part [first message .. second reply] is SP 1 .. 6 — the captured draft's range. */
const EVENTS = [
  turnEvent(HISTORY[0].userTurn.id, 1, 2, SESSION), turnEvent(HISTORY[0].reply!.id, 3, 3, SESSION),
  turnEvent(HISTORY[1].userTurn.id, 4, 4, SESSION), turnEvent(HISTORY[1].reply!.id, 5, 6, SESSION),
  turnEvent(HISTORY[2].userTurn.id, 7, 7, SESSION), turnEvent(HISTORY[2].reply!.id, 8, 8, SESSION),
];

const respond = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

export interface S704ProofWorld {
  readonly config: MobilePublicConfig;
  readonly auth: SupabaseAuthPort;
  readonly fetch: RuntimeHttpFetch;
}

export function createS704ProofWorld(): S704ProofWorld {
  const replay = playerServer({ base: S704_PROOF_CONFIG.apiBaseUrl, composition: true });

  const fetch: RuntimeHttpFetch = async (input, init) => {
    const method = init?.method ?? 'GET';
    const [path, query = ''] = input.split('?');
    // The Replay routes (the first path segment), answered from the captured wire.
    if (path.startsWith(S704_PROOF_CONFIG.apiBaseUrl) && path.slice(S704_PROOF_CONFIG.apiBaseUrl.length).split('/')[1] === 'replay') {
      return replay.fetch(input, { method, ...(init?.body === undefined ? {} : { body: init.body }) });
    }
    if (path.endsWith('/turns') && method === 'GET') return respond(200, historyBody(HISTORY));
    if (path.endsWith('/historical-projection')) {
      const params = Object.fromEntries(query.split('&').filter(Boolean).map((pair) => pair.split('=') as [string, string]));
      const tc = Number(params.tc ?? LIVE_HEAD);
      const depth = (params.depth ?? 'WORLD') as HistoricalSemanticDepth;
      return respond(200, disclosureFixture({ depth, sessionId: SESSION, tc, liveHead: LIVE_HEAD, threads: THREADS }));
    }
    if (path.endsWith('/temporal/events')) return respond(200, { sessionId: SESSION, events: EVENTS });
    if (path.endsWith('/temporal/live-focus-events')) return respond(200, { sessionId: SESSION, events: [] });
    if (path.endsWith('/temporal')) {
      return respond(200, { sessionId: SESSION, liveHead: LIVE_HEAD, liveFocus: { kind: 'NONE' }, liveFocusAtSp: null });
    }
    if (method === 'POST' && path.endsWith('/conversation/sessions')) {
      return respond(201, { id: SESSION, status: 'ACTIVE', channel: 'TEXT', created_at: 'now', updated_at: 'now', last_activity_at: 'now', closed_at: null });
    }
    if (path.endsWith('/account/first-use')) {
      return respond(200, { displayName: null, welcomePending: false, firstConversationOpening: false });
    }
    return respond(404, {});
  };

  // Already authenticated, in memory only. It never signs in, never stores and never refreshes.
  const reader = { userId: 's704-proof-reader', accessToken: 's704-proof-bearer' };
  const auth: SupabaseAuthPort = {
    restoreSession: async () => ({ ok: true, value: reader }),
    signInWithPassword: async () => ({ ok: true, value: reader }),
    signUp: async () => ({ ok: false, failure: { kind: 'REFUSED', detail: 'the S7-04 proof creates no account' } }),
    verifyEmailCode: async () => ({ ok: false, failure: { kind: 'UNEXPECTED', detail: 'the S7-04 proof verifies nothing' } }),
    resendEmailCode: async () => ({ ok: false, failure: { kind: 'REFUSED', detail: 'the S7-04 proof sends nothing' } }),
    verifyLoginIdEmailCode: async () => ({ ok: false, failure: { kind: 'UNEXPECTED', detail: 'the S7-04 proof has no Login ID' } }),
    resendLoginIdEmailCode: async () => ({ ok: false, failure: { kind: 'REFUSED', detail: 'the S7-04 proof has no Login ID' } }),
    signInWithLoginId: async () => ({ ok: false, failure: { kind: 'INVALID_CREDENTIALS', detail: 'the S7-04 proof has no Login ID' } }),
    requestPasswordRecovery: async () => ({ ok: true }),
    verifyRecoveryCode: async () => ({ ok: false, failure: { kind: 'UNEXPECTED', detail: 'the S7-04 proof recovers nothing' } }),
    updateRecoveredPassword: async () => ({ ok: false, failure: { kind: 'UNEXPECTED', detail: 'the S7-04 proof recovers nothing' } }),
    retireRecoveryGrant: async () => undefined,
    signOut: async () => ({ ok: true, value: null }),
    onSessionChange: () => () => undefined,
    startAutoRefresh: () => undefined,
    stopAutoRefresh: () => undefined,
  };

  return { config: S704_PROOF_CONFIG, auth, fetch };
}
