/**
 * S4-01 — the Shared World device-proof world. VALIDATION ONLY.
 *
 * The VPORT-01 proof world's in-memory identity and scripted network (reused, not copied), completed with exactly what a
 * signed-in reader's production API always answers and the S4-01 journeys reach:
 *
 *   - `/account/identity` and `/account/public-id` — every signed-in account has a Name, a Login ID, a verified Email
 *     (W1B-01 / W3-MEGA-A) and an auto-generated Public ID (W3-02, migration 0125 backfilled every account). General
 *     Settings draws its Account & Identity group — where the Shared ID row lives (P1 §8.1) — from these reads, so a proof
 *     world without them is not a signed-in reader's world (S4-01 proof fixture gap, closed here);
 *   - `/shared/*` — an in-memory stand-in answering as migration 0138 and `apps/api/src/shared-world` do: the Shared ID
 *     provisioned on its first read and regenerated to a new value; SUBMITTED for every well-formed Shared ID (it names
 *     nobody), INVALID_SHARED_ID only for a malformed one; acceptance births exactly one World with exactly the two humans;
 *     decline creates nothing; entry is ALLOW only for a current member and one neutral UNAVAILABLE otherwise.
 *
 * Every Name, Login ID, Email and Public ID here is SYNTHETIC test text, never Product copy and never a real account.
 */
import type { ChromeLanguage } from '../../orientation-chrome';
import type { MobilePublicConfig, RuntimeHttpFetch, SupabaseAuthPort } from '../../runtime-entry';
import { createVport01ProofWorld } from './vport01-proof-world';

/** SYNTHETIC Names — validation fixtures, never Product copy. */
const INVITER = { ar: 'هدير الاختبار', en: 'Fixture Hadir' };
const SELF = { ar: 'القارئ الاختبار', en: 'Fixture Reader' };
/** The signed-in reader's account identity, in exactly the shapes the production account client decodes. */
export const S401_PROOF_IDENTITY = Object.freeze({ loginId: 's401.proof.reader', email: 's401-proof-reader@example.test', emailVerified: true });
export const S401_PROOF_PUBLIC_ID = Object.freeze({ publicId: 's401.proof.public', changeAvailable: false });
export const S401_PROOF_SHARED_IDS = Object.freeze(['K7QM-4XWD-P9TR', 'AB12-CD34-EF56', 'MN78-PQ90-RS12']);
/** How long the stand-in takes to resolve an entry, so the pre-authority shell is observable on a device. */
export const S401_ENTRY_DELAY_MS = 1500;
const COMPACT = /^[0-9A-HJKMNP-TV-Z]{12}$/u;

export interface S401ProofWorld {
  readonly config: MobilePublicConfig;
  readonly auth: SupabaseAuthPort;
  readonly fetch: RuntimeHttpFetch;
  /** Another person (synthetic) invites the reader. */
  arrive(): void;
  /** The reader already shares one World. */
  seed(): void;
  /** The reader's membership ends. */
  revoke(): void;
}

export function createS401ProofWorld(language: ChromeLanguage, options: { readonly entryDelayMs?: number } = {}): S401ProofWorld {
  const base = createVport01ProofWorld(language);
  const entryDelayMs = options.entryDelayMs ?? S401_ENTRY_DELAY_MS;
  let next = 1;
  const uuid = () => `5401${String(next++).padStart(4, '0')}-0000-4000-8000-000000000000`;
  let issued = -1;
  const invitations: { invitationId: string }[] = [];
  const worlds: { worldId: string; current: boolean }[] = [];
  const members = () => [{ name: SELF[language], self: true }, { name: INVITER[language], self: false }];
  const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const wellFormed = (value: string) => COMPACT.test(value.toUpperCase().replace(/[\s-]/gu, '').replace(/O/gu, '0').replace(/[IL]/gu, '1'));

  async function shared(path: string, method: string, body: Record<string, unknown> | undefined) {
    if (path === '/shared' && method === 'GET') {
      return json(200, {
        capabilities: { invitation: true, birth: true },
        worlds: worlds.filter((w) => w.current).map((w) => ({ worldId: w.worldId, members: members() })),
        invitations: invitations.map((i) => ({ invitationId: i.invitationId, inviterName: INVITER[language] })),
      });
    }
    if (path === '/shared/identity') {
      if (issued < 0) issued = 0;
      return json(200, { status: 'READY', sharedId: S401_PROOF_SHARED_IDS[issued] });
    }
    if (path === '/shared/identity/regenerate') {
      issued = Math.min(issued + 1, S401_PROOF_SHARED_IDS.length - 1);
      return json(200, { status: 'READY', sharedId: S401_PROOF_SHARED_IDS[issued] });
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
      if (entryDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, entryDelayMs));
      const world = worlds.find((w) => w.worldId === entry[1] && w.current);
      if (world === undefined) return json(200, { outcome: 'UNAVAILABLE' });
      return json(200, { outcome: 'ALLOW', world: { worldId: world.worldId, bornAt: new Date().toISOString(), members: members() } });
    }
    return json(404, {});
  }

  const fetch: RuntimeHttpFetch = async (input, init) => {
    const path = input.replace(/^https?:\/\/[^/]+/u, '').split('?')[0];
    const method = init?.method ?? 'GET';
    if (path === '/account/identity' && method === 'GET') return json(200, { name: SELF[language], ...S401_PROOF_IDENTITY });
    if (path === '/account/public-id' && method === 'GET') return json(200, S401_PROOF_PUBLIC_ID);
    if (path === '/shared' || path.startsWith('/shared/')) {
      return shared(path, method, init?.body === undefined ? undefined : JSON.parse(init.body) as Record<string, unknown>);
    }
    return base.fetch(input, init);
  };

  return {
    config: base.config,
    auth: base.auth,
    fetch,
    arrive: () => { invitations.push({ invitationId: uuid() }); },
    seed: () => { worlds.push({ worldId: uuid(), current: true }); },
    revoke: () => { for (const world of worlds) world.current = false; },
  };
}
