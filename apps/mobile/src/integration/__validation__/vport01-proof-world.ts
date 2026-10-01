/**
 * VPORT-01 — the visual-proof world. VALIDATION ONLY, FIXTURE ONLY.
 *
 * The VPORT-01 proof renders the PRODUCTION phase surface over a runtime built by the production
 * `createIntegrationRuntime`, exactly as the W1A-01 proof does, and stands in for the same two things a
 * proof build cannot have — the identity (in memory, already authenticated) and the network (a scripted
 * HTTP implementation answering the routes the production transports call with wire-legal bodies the
 * production decoders decode). Nothing else differs from the Product binary.
 *
 * The world it serves is shaped to exercise every fact the production Map can express, at every rung:
 *
 *   eight Established Threads, their Homes on the canonical Home step (1,000,000 world units), so the
 *   WORLD rung shows a world of places and the deeper rungs show one place and its context;
 *   contextual Reading appearances hosted by those Homes (the hosting relation — the one relation the
 *   Map holds);
 *   Emerging Focuses (SESSION rung) and ungrounded Readings (ANALYTICAL_OBJECT rung), which are
 *   ungeographic and must never be given a Home.
 *
 * Every id is a fixture id and never reaches a label: the accessible Map names objects by type and
 * placement only. No text here is Product copy.
 */
import type { HistoricalSemanticDepth } from '@qandeel/runtime';

import { exchange, historyBody } from '../../conversation/__fixtures__/conversation';
import { disclosureFixture, type AppearanceFixture } from '../../map/__fixtures__/disclosure';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { ConversationExchangeView, MobilePublicConfig, RuntimeHttpFetch, SupabaseAuthPort } from '../../runtime-entry';

const SESSION = 'b0b01000-0000-4000-8000-000000000001';
const LIVE_HEAD = 12;

/** Proof-only config. The origin is a reserved `.invalid` name: nothing can ever be reached through it. */
export const VPORT01_PROOF_CONFIG: MobilePublicConfig = Object.freeze({
  apiBaseUrl: 'https://vport01-proof.invalid',
  supabaseUrl: 'https://vport01-proof.invalid',
  supabasePublishableKey: 'sb_publishable_vport01proofvport01pr_proofkey',
});

const STEP = 1_000_000;
const THREADS = [
  { id: 'v-thread-0', x: '0', y: '0' },
  { id: 'v-thread-1', x: String(STEP), y: '0' },
  { id: 'v-thread-2', x: String(-STEP), y: String(STEP) },
  { id: 'v-thread-3', x: String(STEP), y: String(-STEP) },
  { id: 'v-thread-4', x: '0', y: String(-2 * STEP) },
  { id: 'v-thread-5', x: String(-2 * STEP), y: '0' },
  { id: 'v-thread-6', x: String(2 * STEP), y: String(STEP) },
  { id: 'v-thread-7', x: String(-STEP), y: String(-STEP) },
];

/** Hosted Readings per Thread. The Home at the origin hosts the most, so the closer rungs have context. */
const HOSTED: Readonly<Record<string, number>> = {
  'v-thread-0': 5,
  'v-thread-1': 2,
  'v-thread-2': 3,
  'v-thread-3': 1,
  'v-thread-4': 2,
  'v-thread-5': 1,
  'v-thread-6': 2,
  'v-thread-7': 1,
};

const APPEARANCES: AppearanceFixture[] = Object.entries(HOSTED).flatMap(([threadId, count], t) =>
  Array.from({ length: count }, (_unused, index) => ({
    bindingId: `v-binding-${t}-${index}`,
    threadId,
    readingId: `v-reading-${t}-${index}`,
    boundSp: 1 + ((t + index) % LIVE_HEAD),
  })),
);
const READINGS = [...APPEARANCES.map((a) => ({ id: a.readingId })), { id: 'v-reading-ungrounded-1' }, { id: 'v-reading-ungrounded-2' }];
const FOCUSES = [
  { id: 'v-focus-1', startedSp: 3 },
  { id: 'v-focus-2', startedSp: 9 },
];

/** A short neutral conversation, so the Conversation depth the proof opens on is a real one. */
function fixtureHistory(language: ChromeLanguage): ConversationExchangeView[] {
  return language === 'ar'
    ? [
        exchange('خلّينا نرتّب الأسبوع ده.', { reply: 'تمام. نبدأ بإيه؟', order: 1 }),
        exchange('الشغل أولاً، وبعدين البيت.', { reply: 'واضح.', order: 2 }),
      ]
    : [
        exchange("Let's sort out this week.", { reply: 'Sure. Where do we start?', order: 1 }),
        exchange('Work first, then home.', { reply: 'Clear.', order: 2 }),
      ];
}

const respond = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

export interface Vport01ProofWorld {
  readonly config: MobilePublicConfig;
  readonly auth: SupabaseAuthPort;
  readonly fetch: RuntimeHttpFetch;
}

export function createVport01ProofWorld(language: ChromeLanguage): Vport01ProofWorld {
  const history = fixtureHistory(language);

  const fetch: RuntimeHttpFetch = async (input, init) => {
    const method = init?.method ?? 'GET';
    const [path, query = ''] = input.split('?');
    if (path.endsWith('/turns')) {
      if (method === 'GET') return respond(200, historyBody(history));
      return respond(503, { statusCode: 503 }); // the proof sends nothing
    }
    if (path.endsWith('/historical-projection')) {
      const params = Object.fromEntries(query.split('&').filter(Boolean).map((pair) => pair.split('=') as [string, string]));
      const tc = Number(params.tc ?? LIVE_HEAD);
      const depth = (params.depth ?? 'WORLD') as HistoricalSemanticDepth;
      return respond(
        200,
        disclosureFixture({ depth, sessionId: SESSION, tc, liveHead: LIVE_HEAD, threads: THREADS, appearances: APPEARANCES, readings: READINGS, focuses: FOCUSES }),
      );
    }
    if (path.endsWith('/temporal/events') || path.endsWith('/temporal/live-focus-events')) {
      return respond(200, { sessionId: SESSION, events: [] });
    }
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
  const reader = { userId: 'vport01-proof-reader', accessToken: 'vport01-proof-bearer' };
  const refuse = async () => ({ ok: false as const, failure: { kind: 'REFUSED' as const, detail: 'the VPORT-01 proof does nothing here' } });
  const unexpected = async () => ({ ok: false as const, failure: { kind: 'UNEXPECTED' as const, detail: 'the VPORT-01 proof does nothing here' } });
  const auth: SupabaseAuthPort = {
    restoreSession: async () => ({ ok: true, value: reader }),
    signInWithPassword: async () => ({ ok: true, value: reader }),
    signUp: refuse,
    verifyEmailCode: unexpected,
    resendEmailCode: refuse,
    verifyLoginIdEmailCode: unexpected,
    resendLoginIdEmailCode: refuse,
    signInWithLoginId: async () => ({ ok: false, failure: { kind: 'INVALID_CREDENTIALS', detail: 'the VPORT-01 proof has no Login ID' } }),
    requestPasswordRecovery: async () => ({ ok: true }),
    verifyRecoveryCode: unexpected,
    updateRecoveredPassword: unexpected,
    retireRecoveryGrant: async () => undefined,
    signOut: async () => ({ ok: true, value: null }),
    onSessionChange: () => () => undefined,
    startAutoRefresh: () => undefined,
    stopAutoRefresh: () => undefined,
  };

  return { config: VPORT01_PROOF_CONFIG, auth, fetch };
}
