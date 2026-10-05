/**
 * S4-01 — the Shared World device-proof world. VALIDATION ONLY.
 *
 * The VPORT-01 proof world's in-memory identity and scripted network (reused, not copied), completed with exactly what a
 * signed-in reader's production API always answers and the S4-01 journeys reach:
 *
 *   - `/account/identity` and `/account/public-id` — every signed-in account has a Name, a Login ID, a verified Email
 *     (W1B-01 / W3-MEGA-A) and an auto-generated Public ID (W3-02, migration 0125 backfilled every account). General
 *     Settings draws its Account & Identity group — where the Shared ID row lives (P1 §8.1) — from these reads, so a proof
 *     world without them is not a signed-in reader's world (S4-01 proof fixture gap, closed here). The values come from
 *     the test-only `__fixtures__/s401-account-identity.ts`, so this harness carries no Email default (T-12 Phase M);
 *   - `/shared/*` — an in-memory stand-in answering as migration 0138 and `apps/api/src/shared-world` do: the Shared ID
 *     provisioned on its first read and regenerated to a new value; SUBMITTED for every well-formed Shared ID (it names
 *     nobody), INVALID_SHARED_ID only for a malformed one; acceptance births exactly one World with exactly the two humans;
 *     decline creates nothing; entry is ALLOW only for a current member and one neutral UNAVAILABLE otherwise.
 *
 * The pre-authority seam (Journey C): an entry into the World `seed()` made is HELD before its ALLOW answer until
 * `allow()` releases it — deterministic, never a timed delay — so the device proof observes the neutral pre-authority shell
 * for as long as it asserts, then releases authority explicitly. Each `allow()` releases the entries held at that moment;
 * the next entry is held again. A non-member's UNAVAILABLE and every other World's ALLOW answer at once.
 *
 * S4-02 — the Shared conversation, answered as migration 0139 and `apps/api/src/shared-world` do:
 *
 *   - `converse()` seeds one World (entered at once, never held) whose history holds another person's words, QANDEEL's
 *     reply and the reader's own words; ordinary sending is open;
 *   - `/materials` answers the entry verdict first, then the visible material with server-owned attribution and
 *     deletability; a revoked membership answers one neutral UNAVAILABLE;
 *   - `/messages` commits the reader's words once per command and answers QANDEEL's reply from the VALIDATION-ONLY
 *     deterministic reply below — the deterministic provider seam of this proof, reachable only in the proof build;
 *   - `/delete` removes the reader's own words only;
 *   - `peer()` lets the other person speak, so the reader's explicit refresh can be proved to show it — never a timer.
 *
 * Every Name, Login ID, Email, Public ID and conversation line here is SYNTHETIC test text, never Product copy and never
 * a real account.
 */
import type { ChromeLanguage } from '../../orientation-chrome';
import type { MobilePublicConfig, RuntimeHttpFetch, SupabaseAuthPort } from '../../runtime-entry';
import { S401_ACCOUNT_IDENTITY, S401_ACCOUNT_PUBLIC_ID } from '../__fixtures__/s401-account-identity';
import { createVport01ProofWorld } from './vport01-proof-world';

/** SYNTHETIC Names — validation fixtures, never Product copy. */
const INVITER = { ar: 'هدير الاختبار', en: 'Fixture Hadir' };
const SELF = { ar: 'القارئ الاختبار', en: 'Fixture Reader' };
export const S401_PROOF_SHARED_IDS = Object.freeze(['K7QM-4XWD-P9TR', 'AB12-CD34-EF56', 'MN78-PQ90-RS12']);
const COMPACT = /^[0-9A-HJKMNP-TV-Z]{12}$/u;

/** S4-02 — SYNTHETIC conversation lines and the deterministic QANDEEL reply of this proof. Validation text, not copy. */
export const S402_PROOF_LINES = Object.freeze({
  peerOpening: 'Fixture hello from the other side',
  qandeelOpening: 'Fixture QANDEEL line',
  mine: 'Fixture words of mine',
  peerLater: 'Fixture peer words after refresh',
  reply: { ar: 'رد اختباري ثابت من قنديل', en: 'Fixture deterministic QANDEEL reply' },
});

interface ProofMaterial { materialId: string; producer: 'SELF' | 'HUMAN' | 'QANDEEL'; text: string; establishedAt: string }

export interface S401ProofWorld {
  readonly config: MobilePublicConfig;
  readonly auth: SupabaseAuthPort;
  readonly fetch: RuntimeHttpFetch;
  /** Another person (synthetic) invites the reader. */
  arrive(): void;
  /** The reader already shares one World, whose entries are held before ALLOW until `allow()`. */
  seed(): void;
  /** Releases the entries held at this moment (each is then answered as the membership stands). */
  allow(): void;
  /** The reader's membership ends. */
  revoke(): void;
  /** S4-02: the reader shares one World with a conversation already in it; it is entered at once. */
  converse(): void;
  /** S4-02: the other person speaks in every conversation World. */
  peer(): void;
}

export function createS401ProofWorld(language: ChromeLanguage): S401ProofWorld {
  const base = createVport01ProofWorld(language);
  const held = new Set<string>();
  let releases: (() => void)[] = [];
  let next = 1;
  const uuid = () => `5401${String(next++).padStart(4, '0')}-0000-4000-8000-000000000000`;
  let issued = -1;
  const invitations: { invitationId: string }[] = [];
  const worlds: { worldId: string; current: boolean }[] = [];
  const members = () => [{ name: SELF[language], self: true }, { name: INVITER[language], self: false }];
  const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  // S4-02: each conversation World's material, oldest first; and each committed send command's material.
  const threads = new Map<string, ProofMaterial[]>();
  const sent = new Map<string, string>();
  let clock = 0;
  const at = () => new Date(Date.UTC(2026, 9, 5, 10, 0, clock++)).toISOString();
  const say = (worldId: string, producer: ProofMaterial['producer'], text: string): ProofMaterial => {
    const line: ProofMaterial = { materialId: uuid(), producer, text, establishedAt: at() };
    threads.get(worldId)?.push(line);
    return line;
  };
  const isCurrent = (worldId: string) => worldId !== '' && worlds.some((w) => w.worldId === worldId && w.current);
  const view = (line: ProofMaterial) => ({
    materialId: line.materialId, producer: line.producer, authorName: line.producer === 'HUMAN' ? INVITER[language] : null,
    text: line.text, establishedAt: line.establishedAt, canDelete: line.producer === 'SELF',
  });

  async function conversation(path: string, method: string, body: Record<string, unknown> | undefined) {
    const read = /^\/shared\/worlds\/([0-9a-f-]+)\/materials$/u.exec(path);
    if (read !== null && method === 'GET') {
      // Every current World answers ALLOW (a World born in an S4-01 journey simply has no conversation yet).
      if (!isCurrent(read[1])) return json(200, { outcome: 'UNAVAILABLE' });
      return json(200, { outcome: 'ALLOW', conversation: true, materials: (threads.get(read[1]) ?? []).map(view) });
    }
    const message = /^\/shared\/worlds\/([0-9a-f-]+)\/messages$/u.exec(path);
    if (message !== null && method === 'POST') {
      const worldId = message[1];
      if (!isCurrent(worldId)) return json(200, { outcome: 'UNAVAILABLE' });
      if (!threads.has(worldId)) threads.set(worldId, []);
      const commandId = typeof body?.commandId === 'string' ? body.commandId : '';
      const content = typeof body?.content === 'string' ? body.content : '';
      const already = sent.get(commandId);
      if (already !== undefined) return json(200, { outcome: 'COMMITTED', materialId: already, qandeel: 'COMMITTED' });
      const mine = say(worldId, 'SELF', content);
      sent.set(commandId, mine.materialId);
      // VALIDATION-ONLY deterministic provider seam: one fixed reply per human command.
      say(worldId, 'QANDEEL', S402_PROOF_LINES.reply[language]);
      return json(200, { outcome: 'COMMITTED', materialId: mine.materialId, qandeel: 'COMMITTED' });
    }
    const removal = /^\/shared\/worlds\/([0-9a-f-]+)\/materials\/([0-9a-f-]+)\/delete$/u.exec(path);
    if (removal !== null && method === 'POST') {
      const lines = threads.get(removal[1]);
      const index = lines?.findIndex((line) => line.materialId === removal[2] && line.producer === 'SELF') ?? -1;
      if (lines === undefined || index < 0) return json(200, { outcome: 'UNAVAILABLE' });
      lines.splice(index, 1);
      return json(200, { outcome: 'DELETED' });
    }
    return null;
  }
  const wellFormed = (value: string) => COMPACT.test(value.toUpperCase().replace(/[\s-]/gu, '').replace(/O/gu, '0').replace(/[IL]/gu, '1'));

  async function shared(path: string, method: string, body: Record<string, unknown> | undefined) {
    const answered = await conversation(path, method, body);
    if (answered !== null) return answered;
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
      if (held.has(entry[1]) && worlds.some((w) => w.worldId === entry[1] && w.current)) {
        await new Promise<void>((resolve) => { releases.push(resolve); });
      }
      const world = worlds.find((w) => w.worldId === entry[1] && w.current);
      if (world === undefined) return json(200, { outcome: 'UNAVAILABLE' });
      return json(200, { outcome: 'ALLOW', world: { worldId: world.worldId, bornAt: new Date().toISOString(), members: members() } });
    }
    return json(404, {});
  }

  const fetch: RuntimeHttpFetch = async (input, init) => {
    const path = input.replace(/^https?:\/\/[^/]+/u, '').split('?')[0];
    const method = init?.method ?? 'GET';
    if (path === '/account/identity' && method === 'GET') return json(200, { name: SELF[language], ...S401_ACCOUNT_IDENTITY });
    if (path === '/account/public-id' && method === 'GET') return json(200, S401_ACCOUNT_PUBLIC_ID);
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
    seed: () => {
      const worldId = uuid();
      worlds.push({ worldId, current: true });
      held.add(worldId);
    },
    allow: () => {
      const pending = releases;
      releases = [];
      for (const release of pending) release();
    },
    revoke: () => { for (const world of worlds) world.current = false; },
    converse: () => {
      const worldId = uuid();
      worlds.push({ worldId, current: true });
      threads.set(worldId, []);
      say(worldId, 'HUMAN', S402_PROOF_LINES.peerOpening);
      say(worldId, 'QANDEEL', S402_PROOF_LINES.qandeelOpening);
      say(worldId, 'SELF', S402_PROOF_LINES.mine);
    },
    peer: () => { for (const worldId of threads.keys()) say(worldId, 'HUMAN', S402_PROOF_LINES.peerLater); },
  };
}
