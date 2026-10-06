/**
 * S4-01 — the Shared World device-proof world. VALIDATION ONLY.
 *
 * The VPORT-01 proof world's in-memory identity and scripted network (reused, not copied), completed with exactly what a
 * signed-in reader's production API always answers and the S4 journeys reach:
 *
 *   - `/account/identity`, `/account/public-id` and `/account/privacy` — every signed-in account has a Name, a Login ID,
 *     a verified Email (W1B-01 / W3-MEGA-A), an auto-generated Public ID (W3-02, migration 0125 backfilled every account)
 *     and a Privacy & Data state (W3-MEGA-S: nothing requested). General Settings draws its Account & Identity group —
 *     where the Shared ID row lives (P1 §8.1) — and its Privacy & Data group — where the S4-03 former-member row lives —
 *     from these reads. The values come from the test-only `__fixtures__/s401-account-identity.ts`, so this harness
 *     carries no Email default (T-12 Phase M);
 *   - `/shared/*` — an in-memory stand-in answering as migrations 0138–0140 and `apps/api/src/shared-world` do: the
 *     Shared ID provisioned on its first read and regenerated to a new value; SUBMITTED for every well-formed Shared ID
 *     (it names nobody), INVALID_SHARED_ID only for a malformed one; acceptance births exactly one World with exactly the
 *     two humans; decline creates nothing; entry is ALLOW only for a current member and one neutral UNAVAILABLE otherwise.
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
 * S4-03 — the Shared lifecycle, answered as migration 0140 does (the unanimity, staleness, cross-World and concurrency
 * semantics themselves are the real-PostgreSQL verifier's; this stand-in answers what the reader's screens read):
 *
 *   - `lifecycle()` seeds a World of the reader and one other person, with governance and history sharing open;
 *   - `history()` seeds a World of three — the reader, the other person and a NEWCOMER who joined after the reader's
 *     earlier words — in which the reader themselves joined after the other person's earliest words: those stay hidden
 *     from the reader (FROM_JOIN_FORWARD) until `grant()` stands in for the other person's approved package;
 *   - `/manage` answers only a current member of a live World: the committed settings, the members (opaque handles), the
 *     CURRENT proposals that wait on the reader, and the requests to share the reader's own words; a proposal is never an
 *     approval; `peerApprove()` stands in for every other required member approving (the frozen unanimity rule, so the
 *     reader's own approval is the one that completes it on the device);
 *   - `/leave` ends the reader's membership at once; `/history-shares` offer exactly the reader-visible human words the
 *     grantee cannot see, one by one, and grant on the authors' approval; an ended World is answered only by
 *     `/shared/closed/:worldId` to the members at closure, read-only, re-checked for availability — `peerDelete()`
 *     stands in for the other person deleting their own words after the end;
 *   - `/own-material` lists the reader's own words in Worlds they no longer belong to, and nothing else.
 *
 * S5-01 — the Public World, answered as migration 0142 and `apps/api/src/public-world` do:
 *
 *   - `/public/entry` — the entry verdict, HELD before its ALLOW answer until `publicAllow()` releases it (the same
 *     deterministic seam as Journey C), so the device proof observes the neutral pre-authority shell for as long as it
 *     asserts; every entry is held again, because a previous ALLOW is never authority;
 *   - `/public/display` — the reader's Public display MODE (PSEUDONYM by default, rendering the account's CURRENT Public
 *     ID; REAL_NAME rendering the account's CURRENT Name); a PUT carries the mode and nothing else.
 *
 * S5-02 — Public authoring, answered as migration 0143 and `apps/api/src/public-world/public-authoring.*` do, for the
 * publisher-facing journey on ONE device: one Draft at a time from the reader's own EXISTING (synthetic) words; the
 * package's one rightsholder is the reader, so the reader's own approval completes it and READY_FOR_REVIEW is reached
 * (never anything public). Multi-human authority — other rightsholders, members who are not, withdrawal under races — is
 * the real-PostgreSQL verifier's (database/verify-migration-0143.mjs), not this fixture's.
 *
 * Every Name, Login ID, Email, Public ID and conversation line here is SYNTHETIC test text, never Product copy and never
 * a real account.
 */
import type { ChromeLanguage } from '../../orientation-chrome';
import type { MobilePublicConfig, RuntimeHttpFetch, SupabaseAuthPort } from '../../runtime-entry';
import { S401_ACCOUNT_IDENTITY, S401_ACCOUNT_PUBLIC_ID } from '../__fixtures__/s401-account-identity';
import { createVport01ProofWorld } from './vport01-proof-world';

/** SYNTHETIC Names — validation fixtures, never Product copy. */
/** S5-02: the reader's own SYNTHETIC earlier words offered as existing material — a validation fixture, never Product copy. */
const OWN_WORDS = { ar: 'كلام القارئ الاختباري السابق', en: 'The fixture reader earlier words' };
const INVITER = { ar: 'هدير الاختبار', en: 'Fixture Hadir' };
const SELF = { ar: 'القارئ الاختبار', en: 'Fixture Reader' };
const NEWCOMER = { ar: 'رنا الاختبار', en: 'Fixture Rana' };
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

/** S4-03 — SYNTHETIC lines of the lifecycle proof. Validation text, not copy. */
export const S403_PROOF_LINES = Object.freeze({
  leftBehind: 'Fixture words I leave behind',
  hiddenEarlier: 'Fixture words from before I joined',
  mineBeforeNewcomer: 'Fixture words before Rana joined',
  peerToDelete: 'Fixture peer words deleted after the end',
});

type Person = 'SELF' | 'PEER' | 'NEWCOMER';
interface ProofMaterial {
  materialId: string;
  producer: 'SELF' | 'HUMAN' | 'QANDEEL';
  text: string;
  establishedAt: string;
  /** Who among the World's people may see it now (the reader is 'SELF'). */
  visibleTo: Person[];
  author: Person | null;
}
interface ProofWorld {
  worldId: string;
  current: boolean;
  people: Person[];
  name: string | null;
  description: string | null;
  topic: string | null;
  ended: boolean;
  entitled: boolean;
}
interface ProofProposal {
  proposalId: string;
  worldId: string;
  kind: 'SETTINGS' | 'REMOVAL' | 'END';
  settings: { name: string | null; description: string | null; topic: string | null } | null;
  target: Person | null;
  self: boolean;
  others: boolean;
  committed: boolean;
}
interface ProofPackage { packageId: string; worldId: string; grantee: Person; materialIds: string[]; self: boolean; others: boolean; granted: boolean }

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
  /** S4-03: a World of the reader and one other person, governance and history sharing open. */
  lifecycle(): void;
  /** S4-03: every other required member approves every pending proposal and package. */
  peerApprove(): void;
  /** S4-03: a World of three in which the reader joined late and a newcomer joined after the reader's words. */
  history(): void;
  /** S4-03: the other person's approved package makes their earlier words visible to the reader. */
  grant(): void;
  /** S4-03: the other person deletes their own words (after the World ended). */
  peerDelete(): void;
  /** S5-01: releases the Public World entries held at this moment (each answers ALLOW). */
  publicAllow(): void;
}

export function createS401ProofWorld(language: ChromeLanguage): S401ProofWorld {
  const base = createVport01ProofWorld(language);
  const held = new Set<string>();
  let releases: (() => void)[] = [];
  // S5-01: the held Public World entries, and the reader's Public display mode.
  let publicReleases: (() => void)[] = [];
  let publicMode: 'PSEUDONYM' | 'REAL_NAME' = 'PSEUDONYM';
  // S5-02: the reader's Drafts — the chosen source, the reader's own approval, the lifecycle (never past READY_FOR_REVIEW).
  const drafts: { experienceId: string; manifestId: string | null; lifecycle: 'DRAFT' | 'READY_FOR_REVIEW'; approval: 'MISSING' | 'EFFECTIVE' | 'WITHDRAWN' }[] = [];
  const ownSourceId = '54020000-0000-4000-8000-000000000001';
  let next = 1;
  const uuid = () => `5401${String(next++).padStart(4, '0')}-0000-4000-8000-000000000000`;
  let issued = -1;
  const invitations: { invitationId: string }[] = [];
  const worlds: ProofWorld[] = [];
  const nameOf = (person: Person) => (person === 'SELF' ? SELF[language] : person === 'PEER' ? INVITER[language] : NEWCOMER[language]);
  const membersOf = (world: ProofWorld) => world.people.map((person) => ({ name: nameOf(person), self: person === 'SELF' }));
  const handleOf = (world: ProofWorld, person: Person) => `5403000${['SELF', 'PEER', 'NEWCOMER'].indexOf(person)}-0000-4000-8000-${world.worldId.slice(0, 8)}0000`;
  const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  // S4-02: each conversation World's material, oldest first; and each committed send command's material.
  const threads = new Map<string, ProofMaterial[]>();
  const sent = new Map<string, string>();
  // S4-03: proposals and history packages.
  const proposals: ProofProposal[] = [];
  const packages: ProofPackage[] = [];
  let clock = 0;
  const at = () => new Date(Date.UTC(2026, 9, 5, 10, 0, clock++)).toISOString();
  const worldOf = (worldId: string) => worlds.find((w) => w.worldId === worldId);
  const say = (worldId: string, producer: ProofMaterial['producer'], text: string, author: Person | null = producer === 'SELF' ? 'SELF' : producer === 'HUMAN' ? 'PEER' : null,
    visibleTo?: Person[]): ProofMaterial => {
    const line: ProofMaterial = { materialId: uuid(), producer, text, establishedAt: at(), author, visibleTo: visibleTo ?? [...(worldOf(worldId)?.people ?? ['SELF', 'PEER'])] };
    threads.get(worldId)?.push(line);
    return line;
  };
  const live = (world: ProofWorld | undefined): world is ProofWorld => world !== undefined && world.current && !world.ended;
  const isCurrent = (worldId: string) => worldId !== '' && live(worldOf(worldId));
  const view = (line: ProofMaterial) => ({
    materialId: line.materialId, producer: line.producer, authorName: line.producer === 'HUMAN' && line.author !== null ? nameOf(line.author) : null,
    text: line.text, establishedAt: line.establishedAt, canDelete: line.producer === 'SELF',
  });
  const readerSees = (worldId: string) => (threads.get(worldId) ?? []).filter((line) => line.visibleTo.includes('SELF'));

  function commit(proposal: ProofProposal): void {
    const world = worldOf(proposal.worldId);
    if (world === undefined || proposal.committed) return;
    proposal.committed = true;
    if (proposal.kind === 'SETTINGS' && proposal.settings !== null) Object.assign(world, proposal.settings);
    if (proposal.kind === 'REMOVAL' && proposal.target !== null) world.people = world.people.filter((p) => p !== proposal.target);
    if (proposal.kind === 'END') {
      world.ended = true;
      world.entitled = world.current;
    }
  }
  function grantIfComplete(pack: ProofPackage): void {
    const authors = new Set((threads.get(pack.worldId) ?? []).filter((m) => pack.materialIds.includes(m.materialId)).map((m) => m.author));
    if ((authors.has('SELF') && !pack.self) || ((authors.has('PEER') || authors.has('NEWCOMER')) && !pack.others)) return;
    pack.granted = true;
    for (const line of threads.get(pack.worldId) ?? []) if (pack.materialIds.includes(line.materialId) && !line.visibleTo.includes(pack.grantee)) line.visibleTo.push(pack.grantee);
  }

  async function lifecycleRoutes(path: string, method: string, body: Record<string, unknown> | undefined) {
    const manage = /^\/shared\/worlds\/([0-9a-f-]+)\/manage$/u.exec(path);
    if (manage !== null && method === 'GET') {
      const world = worldOf(manage[1]);
      if (!live(world)) return json(200, { outcome: 'UNAVAILABLE' });
      const lines = threads.get(world.worldId) ?? [];
      return json(200, {
        outcome: 'ALLOW',
        capabilities: { governance: true, history: true },
        settings: { name: world.name, description: world.description, topic: world.topic },
        members: world.people.map((person) => ({ handle: handleOf(world, person), name: nameOf(person), self: person === 'SELF' })),
        proposals: proposals.filter((p) => p.worldId === world.worldId && !p.committed && p.target !== 'SELF').map((p) => {
          // The reader proposed every proof proposal; the neutral progress counts approvals, never names them.
          const required = world.people.filter((person) => person !== p.target).length;
          return {
            proposalId: p.proposalId, kind: p.kind, proposer: { name: null, self: true }, targetName: p.target === null ? null : nameOf(p.target), settings: p.settings,
            approvedBySelf: p.self, progress: { approved: (p.self ? 1 : 0) + (p.others ? required - 1 : 0), required },
          };
        }),
        historyRequests: packages.filter((k) => k.worldId === world.worldId && !k.granted).flatMap((k) => {
          const mine = lines.filter((m) => k.materialIds.includes(m.materialId) && m.author === 'SELF');
          return mine.length === 0 ? [] : [{ packageId: k.packageId, granteeName: nameOf(k.grantee), approvedBySelf: k.self,
            items: mine.map((m) => ({ materialId: m.materialId, text: m.text, establishedAt: m.establishedAt })) }];
        }),
      });
    }
    const leave = /^\/shared\/worlds\/([0-9a-f-]+)\/leave$/u.exec(path);
    if (leave !== null && method === 'POST') {
      const world = worldOf(leave[1]);
      if (!live(world)) return json(200, { outcome: 'UNAVAILABLE' });
      world.current = false;
      return json(200, { outcome: 'LEFT' });
    }
    const propose = /^\/shared\/worlds\/([0-9a-f-]+)\/proposals\/(settings|removal|end)$/u.exec(path);
    if (propose !== null && method === 'POST') {
      const world = worldOf(propose[1]);
      if (!live(world)) return json(200, { outcome: 'UNAVAILABLE' });
      const clean = (value: unknown) => (typeof value === 'string' && value.trim().length > 0 ? value.trim() : null);
      if (propose[2] === 'settings') {
        const settings = { name: clean(body?.name), description: clean(body?.description), topic: clean(body?.topic) };
        if (settings.name === world.name && settings.description === world.description && settings.topic === world.topic) return json(200, { outcome: 'UNCHANGED' });
        proposals.push({ proposalId: uuid(), worldId: world.worldId, kind: 'SETTINGS', settings, target: null, self: false, others: false, committed: false });
      } else if (propose[2] === 'removal') {
        const target = world.people.find((person) => person !== 'SELF' && handleOf(world, person) === body?.memberHandle);
        if (target === undefined) return json(200, { outcome: 'UNAVAILABLE' });
        proposals.push({ proposalId: uuid(), worldId: world.worldId, kind: 'REMOVAL', settings: null, target, self: false, others: false, committed: false });
      } else {
        proposals.push({ proposalId: uuid(), worldId: world.worldId, kind: 'END', settings: null, target: null, self: false, others: false, committed: false });
      }
      return json(200, { outcome: 'PROPOSED' });
    }
    const approve = /^\/shared\/worlds\/([0-9a-f-]+)\/proposals\/([0-9a-f-]+)\/approve$/u.exec(path);
    if (approve !== null && method === 'POST') {
      const world = worldOf(approve[1]);
      const proposal = proposals.find((p) => p.proposalId === approve[2] && p.worldId === approve[1]);
      if (!live(world) || proposal === undefined) return json(200, { outcome: 'UNAVAILABLE' });
      proposal.self = true;
      // The unanimity rule: every other required member (the removal target excepted) must have approved too.
      const othersRequired = world.people.some((person) => person !== 'SELF' && person !== proposal.target);
      if (!othersRequired || proposal.others) commit(proposal);
      return json(200, { outcome: proposal.committed ? 'COMMITTED' : 'APPROVED' });
    }
    const candidates = /^\/shared\/worlds\/([0-9a-f-]+)\/history-shares\/candidates\/([0-9a-f-]+)$/u.exec(path);
    if (candidates !== null && method === 'GET') {
      const world = worldOf(candidates[1]);
      if (!live(world)) return json(200, { outcome: 'UNAVAILABLE' });
      const grantee = world.people.find((person) => person !== 'SELF' && handleOf(world, person) === candidates[2]);
      const offered = grantee === undefined ? [] : readerSees(world.worldId).filter((m) => m.producer !== 'QANDEEL' && !m.visibleTo.includes(grantee));
      return json(200, { outcome: 'ALLOW', hasOlder: false, candidates: offered.map((m) => ({
        materialId: m.materialId, self: m.author === 'SELF', authorName: m.author === 'SELF' || m.author === null ? null : nameOf(m.author), text: m.text, establishedAt: m.establishedAt,
      })) });
    }
    const share = /^\/shared\/worlds\/([0-9a-f-]+)\/history-shares$/u.exec(path);
    if (share !== null && method === 'POST') {
      const world = worldOf(share[1]);
      if (!live(world)) return json(200, { outcome: 'UNAVAILABLE' });
      const grantee = world.people.find((person) => person !== 'SELF' && handleOf(world, person) === body?.memberHandle);
      const ids = Array.isArray(body?.materialIds) ? (body.materialIds as string[]) : [];
      if (grantee === undefined || ids.length === 0) return json(200, { outcome: 'UNAVAILABLE' });
      packages.push({ packageId: uuid(), worldId: world.worldId, grantee, materialIds: ids, self: false, others: false, granted: false });
      return json(200, { outcome: 'PROPOSED' });
    }
    const shareApprove = /^\/shared\/worlds\/([0-9a-f-]+)\/history-shares\/([0-9a-f-]+)\/approve$/u.exec(path);
    if (shareApprove !== null && method === 'POST') {
      const pack = packages.find((k) => k.packageId === shareApprove[2] && k.worldId === shareApprove[1]);
      if (!live(worldOf(shareApprove[1])) || pack === undefined) return json(200, { outcome: 'UNAVAILABLE' });
      pack.self = true;
      grantIfComplete(pack);
      return json(200, { outcome: pack.granted ? 'GRANTED' : 'APPROVED' });
    }
    const closed = /^\/shared\/closed\/([0-9a-f-]+)$/u.exec(path);
    if (closed !== null && method === 'GET') {
      const world = worldOf(closed[1]);
      if (world === undefined || !world.ended || !world.entitled) return json(200, { outcome: 'UNAVAILABLE' });
      return json(200, { outcome: 'ALLOW', world: { worldId: world.worldId, name: world.name, members: membersOf(world) },
        materials: readerSees(world.worldId).map((line) => {
          const { materialId, producer, authorName, text, establishedAt } = view(line);
          return { materialId, producer, authorName, text, establishedAt };
        }), hasOlder: false });
    }
    // No proof package waits on a former member's authority (the device legs prove the reader's own former words).
    if (path === '/shared/own-material/history-shares' && method === 'GET') return json(200, { requests: [] });
    if (path === '/shared/own-material' && method === 'GET') {
      const mine = worlds.filter((w) => !w.current || w.ended).flatMap((w) => (threads.get(w.worldId) ?? []).filter((m) => m.author === 'SELF')
        .map((m) => ({ materialId: m.materialId, worldId: w.worldId, text: m.text, establishedAt: m.establishedAt })));
      return json(200, { materials: mine.reverse(), hasOlder: false });
    }
    const ownDelete = /^\/shared\/own-material\/([0-9a-f-]+)\/([0-9a-f-]+)\/delete$/u.exec(path);
    if (ownDelete !== null && method === 'POST') {
      const lines = threads.get(ownDelete[1]);
      const index = lines?.findIndex((line) => line.materialId === ownDelete[2] && line.author === 'SELF') ?? -1;
      if (lines === undefined || index < 0) return json(200, { outcome: 'UNAVAILABLE' });
      lines.splice(index, 1);
      return json(200, { outcome: 'DELETED' });
    }
    return null;
  }

  async function conversation(path: string, method: string, body: Record<string, unknown> | undefined) {
    const read = /^\/shared\/worlds\/([0-9a-f-]+)\/materials$/u.exec(path);
    if (read !== null && method === 'GET') {
      // Every current World answers ALLOW (a World born in an S4-01 journey simply has no conversation yet).
      if (!isCurrent(read[1])) return json(200, { outcome: 'UNAVAILABLE' });
      return json(200, { outcome: 'ALLOW', conversation: true, materials: readerSees(read[1]).map(view), hasOlder: false });
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
    const lifecycleAnswer = await lifecycleRoutes(path, method, body);
    if (lifecycleAnswer !== null) return lifecycleAnswer;
    const answered = await conversation(path, method, body);
    if (answered !== null) return answered;
    if (path === '/shared' && method === 'GET') {
      return json(200, {
        capabilities: { invitation: true, birth: true },
        worlds: worlds.filter(live).map((w) => ({ worldId: w.worldId, name: w.name, members: membersOf(w) })),
        invitations: invitations.map((i) => ({ invitationId: i.invitationId, inviterName: INVITER[language] })),
        closedWorlds: worlds.filter((w) => w.ended && w.entitled).map((w) => ({ worldId: w.worldId, name: w.name, members: membersOf(w) })),
        memberRequests: [],
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
      worlds.push(newWorld(worldId));
      return json(200, { outcome: 'BORN', worldId });
    }
    const entry = /^\/shared\/worlds\/([0-9a-f-]+)$/u.exec(path);
    if (entry !== null) {
      if (held.has(entry[1]) && isCurrent(entry[1])) {
        await new Promise<void>((resolve) => { releases.push(resolve); });
      }
      const world = worldOf(entry[1]);
      if (!live(world)) return json(200, { outcome: 'UNAVAILABLE' });
      return json(200, { outcome: 'ALLOW', world: { worldId: world.worldId, bornAt: new Date().toISOString(), name: world.name, members: membersOf(world) } });
    }
    return json(404, {});
  }

  function authoring(path: string, method: string) {
    const publisher = { mode: publicMode, label: publicMode === 'REAL_NAME' ? SELF[language] : S401_ACCOUNT_PUBLIC_ID.publicId };
    const draft = (id: string | undefined) => drafts.find((d) => d.experienceId === id);
    const reviewOf = (d: (typeof drafts)[number]) => (d.manifestId === null
      ? { state: 'NO_PACKAGE', lifecycle: d.lifecycle, publisher }
      : { state: 'CURRENT', lifecycle: d.lifecycle, manifestId: d.manifestId, publisher, itemCount: 1, requiredApprovals: 1,
        effectiveApprovals: d.approval === 'EFFECTIVE' ? 1 : 0, ownApproval: d.approval,
        readyAllowed: d.lifecycle === 'DRAFT' && d.approval === 'EFFECTIVE', items: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: OWN_WORDS[language] }] });
    if (path === '/public/authoring' && method === 'GET') {
      return json(200, { drafts: drafts.map((d) => ({ experienceId: d.experienceId, lifecycle: d.lifecycle, hasPackage: d.manifestId !== null, itemCount: d.manifestId === null ? 0 : 1 })) });
    }
    if (path === '/public/authoring/sources' && method === 'GET') {
      return json(200, { personal: [{ sourceId: ownSourceId, text: OWN_WORDS[language], at: at() }], shared: [] });
    }
    if (path === '/public/authoring/drafts' && method === 'POST') {
      const experienceId = uuid();
      drafts.unshift({ experienceId, manifestId: null, lifecycle: 'DRAFT', approval: 'MISSING' });
      return json(200, { outcome: 'CREATED', experienceId });
    }
    if (path === '/public/authoring/approvals' && method === 'GET') {
      return json(200, { requests: drafts.filter((d) => d.manifestId !== null).map((d) => ({
        manifestId: d.manifestId, state: 'CURRENT', lifecycle: d.lifecycle, publisher, itemCount: 1, ownItemCount: 1, requiredApprovals: 1,
        effectiveApprovals: d.approval === 'EFFECTIVE' ? 1 : 0, ownApproval: d.approval, ownItems: [{ ordinal: 1, text: OWN_WORDS[language] }] })) });
    }
    const drafted = /^\/public\/authoring\/drafts\/([^/]+)\/(package|review|ready)$/u.exec(path);
    if (drafted) {
      const d = draft(drafted[1]);
      if (!d) return drafted[2] === 'review' ? json(200, { state: 'UNAVAILABLE', lifecycle: null, publisher: null }) : json(200, { outcome: 'UNAVAILABLE' });
      if (drafted[2] === 'review' && method === 'GET') return json(200, reviewOf(d));
      if (drafted[2] === 'package' && method === 'POST') {
        if (d.lifecycle !== 'DRAFT') return json(200, { outcome: 'NOT_DRAFT' });
        d.manifestId = uuid();
        d.approval = 'MISSING';
        return json(200, { outcome: 'PREPARED' });
      }
      if (drafted[2] === 'ready' && method === 'POST') {
        if (d.lifecycle === 'READY_FOR_REVIEW') return json(200, { outcome: 'ALREADY_READY' });
        if (d.manifestId === null || d.approval !== 'EFFECTIVE') return json(200, { outcome: 'APPROVALS_INCOMPLETE' });
        d.lifecycle = 'READY_FOR_REVIEW';
        return json(200, { outcome: 'READY_FOR_REVIEW' });
      }
    }
    const decided = /^\/public\/authoring\/approvals\/([^/]+)\/(approve|withdraw)$/u.exec(path);
    if (decided && method === 'POST') {
      const d = drafts.find((x) => x.manifestId === decided[1]);
      if (!d) return json(200, { outcome: 'UNAVAILABLE' });
      if (decided[2] === 'approve') {
        if (d.approval !== 'MISSING') return json(200, { outcome: 'ALREADY_DECIDED' });
        d.approval = 'EFFECTIVE';
        return json(200, { outcome: 'APPROVED' });
      }
      if (d.approval !== 'EFFECTIVE') return json(200, { outcome: 'ALREADY_WITHDRAWN' });
      d.approval = 'WITHDRAWN';
      return json(200, { outcome: 'WITHDRAWN' });
    }
    return json(404, {});
  }

  function newWorld(worldId: string, people: Person[] = ['SELF', 'PEER']): ProofWorld {
    return { worldId, current: true, people, name: null, description: null, topic: null, ended: false, entitled: false };
  }

  const fetch: RuntimeHttpFetch = async (input, init) => {
    const path = input.replace(/^https?:\/\/[^/]+/u, '').split('?')[0];
    const method = init?.method ?? 'GET';
    if (path === '/account/identity' && method === 'GET') return json(200, { name: SELF[language], ...S401_ACCOUNT_IDENTITY });
    if (path === '/account/public-id' && method === 'GET') return json(200, S401_ACCOUNT_PUBLIC_ID);
    if (path === '/account/privacy' && method === 'GET') {
      return json(200, { export: { status: 'NONE', availableUntil: null }, deletion: { status: 'NONE', finalAt: null } });
    }
    if (path === '/public/entry' && method === 'GET') {
      await new Promise<void>((resolve) => { publicReleases.push(resolve); });
      return json(200, { outcome: 'ALLOW' });
    }
    if (path === '/public/display') {
      if (method === 'PUT') {
        const mode = (JSON.parse(init?.body ?? '{}') as { mode?: unknown }).mode;
        if (mode !== 'PSEUDONYM' && mode !== 'REAL_NAME') return json(400, { outcome: 'INVALID_REQUEST' });
        const outcome = mode === publicMode ? 'UNCHANGED' : 'UPDATED';
        publicMode = mode;
        return json(200, { outcome, mode, label: mode === 'REAL_NAME' ? SELF[language] : S401_ACCOUNT_PUBLIC_ID.publicId });
      }
      return json(200, { mode: publicMode, label: publicMode === 'REAL_NAME' ? SELF[language] : S401_ACCOUNT_PUBLIC_ID.publicId, realNameAvailable: true });
    }
    if (path === '/public/authoring' || path.startsWith('/public/authoring/')) return authoring(path, method);
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
      worlds.push(newWorld(worldId));
      held.add(worldId);
    },
    allow: () => {
      const pending = releases;
      releases = [];
      for (const release of pending) release();
    },
    revoke: () => { for (const world of worlds) world.current = false; },
    publicAllow: () => {
      const pending = publicReleases;
      publicReleases = [];
      for (const release of pending) release();
    },
    converse: () => {
      const worldId = uuid();
      worlds.push(newWorld(worldId));
      threads.set(worldId, []);
      say(worldId, 'HUMAN', S402_PROOF_LINES.peerOpening);
      say(worldId, 'QANDEEL', S402_PROOF_LINES.qandeelOpening);
      say(worldId, 'SELF', S402_PROOF_LINES.mine);
    },
    peer: () => { for (const worldId of threads.keys()) if (isCurrent(worldId)) say(worldId, 'HUMAN', S402_PROOF_LINES.peerLater); },
    lifecycle: () => {
      const worldId = uuid();
      worlds.push(newWorld(worldId));
      threads.set(worldId, []);
      say(worldId, 'HUMAN', S402_PROOF_LINES.peerOpening);
      say(worldId, 'SELF', S403_PROOF_LINES.leftBehind);
    },
    peerApprove: () => {
      for (const proposal of proposals) {
        if (proposal.committed) continue;
        proposal.others = true;
        if (proposal.self) commit(proposal);
      }
      for (const pack of packages) {
        if (pack.granted) continue;
        pack.others = true;
        if (pack.self) grantIfComplete(pack);
      }
    },
    history: () => {
      const worldId = uuid();
      worlds.push(newWorld(worldId, ['SELF', 'PEER', 'NEWCOMER']));
      threads.set(worldId, []);
      // Before the reader joined: hidden from the reader (FROM_JOIN_FORWARD).
      say(worldId, 'HUMAN', S403_PROOF_LINES.hiddenEarlier, 'PEER', ['PEER']);
      // Before the newcomer joined: the reader's own words, and the other person's.
      say(worldId, 'SELF', S403_PROOF_LINES.mineBeforeNewcomer, 'SELF', ['SELF', 'PEER']);
      say(worldId, 'HUMAN', S403_PROOF_LINES.peerToDelete, 'PEER', ['SELF', 'PEER']);
    },
    grant: () => {
      for (const lines of threads.values()) for (const line of lines) if (line.text === S403_PROOF_LINES.hiddenEarlier && !line.visibleTo.includes('SELF')) line.visibleTo.push('SELF');
    },
    peerDelete: () => {
      for (const lines of threads.values()) {
        const index = lines.findIndex((line) => line.text === S403_PROOF_LINES.peerToDelete);
        if (index >= 0) lines.splice(index, 1);
      }
    },
  };
}
