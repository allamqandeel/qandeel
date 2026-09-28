/**
 * W1A-01 — the visual-proof world. VALIDATION ONLY, FIXTURE ONLY.
 *
 * The W1A-01 visual proof renders the PRODUCTION phase surface (`RuntimePhaseSurface`) over a runtime
 * built by the production `createIntegrationRuntime`. Two things cannot exist in a proof build, and
 * this file stands in for exactly those two through T-12P's own public injection points:
 *
 *   - the identity: an in-memory `SupabaseAuthPort` that is already authenticated, so no credential is
 *     entered, stored or sent anywhere;
 *   - the network: a scripted HTTP implementation that answers the routes the production transports
 *     call, with wire-legal bodies the production decoders actually decode.
 *
 * Every conversational sentence below is FIXTURE TEXT written for the proof. No model generated it, it
 * is not Product copy, and nothing here is reachable from the Product route: this directory is outside
 * the production import closure the T-12 contract walks, and the proof build selects it through one
 * recorded change of the manifest's `main`.
 *
 * The script, in order (one per POST):
 *   1st send — answered after a hold, so the waiting state can be seen and captured;
 *   2nd send — answered 503 with nothing committed, so reading finds no turn and the unconfirmed state
 *              shows; its "Try again" is the 3rd send, under the same key, which is then answered.
 */
import type { HistoricalSemanticDepth } from '@qandeel/runtime';

import { exchange, historyBody, submitBody } from '../../conversation/__fixtures__/conversation';
import { disclosureFixture } from '../../map/__fixtures__/disclosure';
import type { ChromeLanguage } from '../../orientation-chrome';
import type { ConversationExchangeView, MobilePublicConfig, RuntimeHttpFetch, SupabaseAuthPort } from '../../runtime-entry';

const SESSION = 'a1a01000-0000-4000-8000-000000000001';
const LIVE_HEAD = 6;
const FIRST_SEND_HOLD_MS = 6000;
const RETRY_HOLD_MS = 1500;

/** Proof-only config. The origin is a reserved `.invalid` name: nothing can ever be reached through it. */
export const W1A_PROOF_CONFIG: MobilePublicConfig = Object.freeze({
  apiBaseUrl: 'https://w1a-proof.invalid',
  supabaseUrl: 'https://w1a-proof.invalid',
  supabasePublishableKey: 'sb_publishable_w1aproofw1aproofw1apro_proofkey',
});

const THREADS = [
  { id: 'w1a-proof-thread-1', x: '0', y: '0' },
  { id: 'w1a-proof-thread-2', x: '900000', y: '-420000' },
  { id: 'w1a-proof-thread-3', x: '-760000', y: '610000' },
  { id: 'w1a-proof-thread-4', x: '350000', y: '1120000' },
];

/** The fixture conversation, per reader language. Mixed-script turns are deliberate. */
function fixtureHistory(language: ChromeLanguage): ConversationExchangeView[] {
  if (language === 'ar') {
    return [
      exchange('اليوم كان طويل ومش قادر أركّز', { reply: 'واضح إن اليوم كان تقيل. إيه أكتر حاجة شدّت انتباهك؟', order: 1 }),
      exchange('الـdeadline بتاع الـproject اتقدّم يومين\nThe client asked for it on Thursday.', { reply: 'ده تغيير كبير في وقت قصير. إيه اللي لسه ناقص؟', order: 2 }),
      exchange('ممكن نرتّب أولوياتي لبكرة؟', { replyState: 'FAILED', order: 3 }),
    ];
  }
  return [
    exchange("Work ran long today and I can't focus.", { reply: 'Sounds like a heavy day. What pulled at your attention most?', order: 1 }),
    exchange('The deadline moved up two days.\nالعميل طلبه يوم الخميس.', { reply: "That's a big change in a short time. What's still open?", order: 2 }),
    exchange('Can we sort out my priorities for tomorrow?', { replyState: 'FAILED', order: 3 }),
  ];
}

const fixtureReply = (language: ChromeLanguage): string =>
  language === 'ar' ? 'خلّينا نبدأ بأهم حاجة لازم تخلص بكرة.' : "Let's start with the one thing that has to be done tomorrow.";

const respond = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const hold = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface W1AProofWorld {
  readonly config: MobilePublicConfig;
  readonly auth: SupabaseAuthPort;
  readonly fetch: RuntimeHttpFetch;
}

export function createW1AProofWorld(
  language: ChromeLanguage,
  holds: { readonly firstSendMs: number; readonly retryMs: number } = { firstSendMs: FIRST_SEND_HOLD_MS, retryMs: RETRY_HOLD_MS },
  /**
   * `false` starts the proof signed out, so the production Sign-in gateway is what renders (the
   * keyboard proof). Its identity still exists only in memory, and the proof never submits the form.
   */
  signedIn = true,
): W1AProofWorld {
  const history = fixtureHistory(language);
  let posts = 0;
  let order = history.length;

  const fetch: RuntimeHttpFetch = async (input, init) => {
    const method = init?.method ?? 'GET';
    const [path, query = ''] = input.split('?');
    if (path.endsWith('/turns')) {
      if (method === 'GET') return respond(200, historyBody(history));
      posts += 1;
      const body = JSON.parse(init?.body ?? '{}') as { content: string; idempotencyKey: string };
      if (posts === 2) return respond(503, { statusCode: 503 });
      order += 1;
      const answered = exchange(body.content, { key: body.idempotencyKey, reply: fixtureReply(language), order });
      if (posts === 1) await hold(holds.firstSendMs);
      if (posts === 3) await hold(holds.retryMs);
      history.push(answered);
      return respond(201, submitBody(answered, SESSION));
    }
    if (path.endsWith('/historical-projection')) {
      const params = Object.fromEntries(query.split('&').filter(Boolean).map((pair) => pair.split('=') as [string, string]));
      const tc = Number(params.tc ?? LIVE_HEAD);
      const depth = (params.depth ?? 'WORLD') as HistoricalSemanticDepth;
      return respond(200, disclosureFixture({ depth, sessionId: SESSION, tc, liveHead: LIVE_HEAD, threads: THREADS }));
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
    return respond(404, {});
  };

  // Already authenticated, in memory only. It never signs in, never stores and never refreshes.
  const reader = { userId: 'w1a-proof-reader', accessToken: 'w1a-proof-bearer' };
  const auth: SupabaseAuthPort = {
    restoreSession: async () => ({ ok: true, value: signedIn ? reader : null }),
    signInWithPassword: async () => ({ ok: true, value: reader }),
    signUp: async () => ({ ok: false, failure: { kind: 'REFUSED', detail: 'the W1A proof creates no account' } }),
    verifyEmailCode: async () => ({ ok: false, failure: { kind: 'UNEXPECTED', detail: 'the W1A proof verifies nothing' } }),
    resendEmailCode: async () => ({ ok: false, failure: { kind: 'REFUSED', detail: 'the W1A proof sends nothing' } }),
    signOut: async () => ({ ok: true, value: null }),
    onSessionChange: () => () => undefined,
    startAutoRefresh: () => undefined,
    stopAutoRefresh: () => undefined,
  };

  return { config: W1A_PROOF_CONFIG, auth, fetch };
}
