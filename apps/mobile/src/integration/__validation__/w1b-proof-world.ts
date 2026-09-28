/**
 * W1B-01 — the visual-proof world. VALIDATION ONLY, FIXTURE ONLY.
 *
 * The W1B-01 proof renders the PRODUCTION phase surface over a runtime built by the production
 * `createIntegrationRuntime`, from "Auth Gateway onward" — it is not the cold-start journey, and it
 * shows no Lantern moment. Two things cannot exist in a proof build, and this file stands in for
 * exactly those two through T-12P's public injection points:
 *
 *   - the identity provider: an in-memory `SupabaseAuthPort` that starts SIGNED OUT, accepts a sign-up,
 *     and verifies ANY six-digit code. No Email is sent, no credential leaves the device, and the typed
 *     password is dropped at once. It emits SIGNED_IN before resolving a verification, exactly as the
 *     SDK does, so the production authority's explicit-completion barrier is what establishes the reader;
 *   - the network: the W1A-01 proof world's scripted HTTP (Session, temporal, projection), plus the
 *     W1B-01 account routes, answering with wire-legal bodies the production decoders decode. The new
 *     account's Conversation starts EMPTY, and its first-use state is kept in memory for the proof run.
 *
 * Every conversational sentence below is FIXTURE TEXT. Nothing here is reachable from the Product route.
 */
import { exchange, historyBody, submitBody } from '../../conversation/__fixtures__/conversation';
import type { ChromeLanguage } from '../../orientation-chrome';
import type {
  AuthSessionSnapshot,
  ConversationExchangeView,
  MobilePublicConfig,
  RuntimeHttpFetch,
  SupabaseAuthPort,
} from '../../runtime-entry';
import { createW1AProofWorld } from './w1a-proof-world';

const respond = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const hold = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** How long the first reply takes, so the waiting state after the first send can be seen. */
const REPLY_HOLD_MS = 1500;

const fixtureReply = (language: ChromeLanguage): string =>
  language === 'ar' ? 'أنا سامعك. إيه أكتر حاجة شاغلاك دلوقتي؟' : "I'm listening. What's on your mind most right now?";

export interface W1BProofWorld {
  readonly config: MobilePublicConfig;
  readonly auth: SupabaseAuthPort;
  readonly fetch: RuntimeHttpFetch;
}

export function createW1BProofWorld(language: ChromeLanguage): W1BProofWorld {
  const base = createW1AProofWorld(language);
  const reader: AuthSessionSnapshot = { userId: 'w1b-proof-reader', accessToken: 'w1b-proof-bearer' };
  const listeners = new Set<Parameters<SupabaseAuthPort['onSessionChange']>[0]>();
  const account = { name: null as string | null, welcomeCompleted: false, conversed: false };
  const history: ConversationExchangeView[] = [];

  const auth: SupabaseAuthPort = {
    restoreSession: async () => ({ ok: true, value: null }),
    signInWithPassword: async () => ({ ok: false, failure: { kind: 'INVALID_CREDENTIALS', detail: 'the W1B proof signs in only through verification' } }),
    signUp: async (_email, _password, identity) => {
      // The password is not kept; the Name is what the account read will return, as migration 0123 stores it.
      account.name = identity.name;
      return { ok: true };
    },
    verifyEmailCode: async (_email, code) => {
      if (!/^\d{6}$/u.test(code)) return { ok: false, failure: { kind: 'CODE_REJECTED', detail: 'fixture: not six digits' } };
      for (const listener of Array.from(listeners)) listener({ kind: 'SIGNED_IN', session: reader });
      return { ok: true, value: reader };
    },
    resendEmailCode: async () => ({ ok: true }),
    signOut: async () => ({ ok: true, value: null }),
    onSessionChange: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    startAutoRefresh: () => undefined,
    stopAutoRefresh: () => undefined,
  };

  const fetch: RuntimeHttpFetch = async (input, init) => {
    const method = init?.method ?? 'GET';
    const [path] = input.split('?');
    if (path.endsWith('/account/login-id-availability')) return respond(200, { available: true });
    if (path.endsWith('/account/first-use/welcome')) {
      account.welcomeCompleted = true;
      return respond(204, null);
    }
    if (path.endsWith('/account/first-use')) {
      return respond(200, {
        displayName: account.name,
        welcomePending: account.name !== null && !account.welcomeCompleted && !account.conversed,
        firstConversationOpening: !account.conversed,
      });
    }
    if (path.endsWith('/turns')) {
      if (method === 'GET') return respond(200, historyBody(history));
      const body = JSON.parse(init?.body ?? '{}') as { content: string; idempotencyKey: string };
      await hold(REPLY_HOLD_MS);
      const answered = exchange(body.content, { key: body.idempotencyKey, reply: fixtureReply(language), order: history.length + 1 });
      history.push(answered);
      account.conversed = true;
      return respond(201, submitBody(answered, 'a1a01000-0000-4000-8000-000000000001'));
    }
    return base.fetch(input, init);
  };

  return { config: base.config, auth, fetch };
}
