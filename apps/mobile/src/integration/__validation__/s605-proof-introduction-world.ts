/**
 * S6-05 — the Mutual Match acceptance and Introduction World device-proof stand-in. VALIDATION ONLY: reachable only in
 * the S4-01 proof build (`select-s401-proof-entry.mjs --apply`), never in the production bundle. It exists so the V-1
 * screens can be photographed on a device and compared with the approved package; it proves NOTHING about the server,
 * whose truth is verify-migration-0159 / 0160 / 0161 and their PostgREST proofs.
 *
 * Until it is seeded nothing answers here, so every earlier proof leg meets the proof world exactly as before.
 *
 *   qandeel://s401-proof/introductions/seed-match   SYNTHETIC data for one reader:
 *       a proposal waiting for this reader as the second recipient, with ACCEPT offered (as only a CLEARED CW2-08 seam
 *       would offer it — in production it never is yet); a MATCH_CONCLUDED proposal joined to a live Introduction World
 *       with «ريم» / Reem (the first party's later arrival); an ended Introduction with «سامي» / Sami
 *   qandeel://s401-proof/introductions/peer-end     the other person ends the live Introduction (the next send answers ENDED)
 *   qandeel://s401-proof/introductions/offline      the next message gets no answer at all (a network failure)
 *
 * It answers in the exact shapes `apps/api/src/introductions-proposals`, `apps/api/src/introductions-world`,
 * `apps/api/src/introductions-lifecycle` and the Shared owner deletion return; a command id answers the same way when it
 * is sent again — the server's rules in miniature, enough to walk S1–S15b.
 */
import type { ChromeLanguage } from '../../orientation-chrome';

type Json = Record<string, unknown>;
type Answer = { ok: boolean; status: number; json: () => Promise<unknown> };
interface Line { materialId: string; self: boolean; text: string; establishedAt: string }
interface World { worldId: string; proposalId: string; name: string; ended: boolean; lines: Line[]; frozen: string[] | null }
interface Proposal { proposalId: string; viewId: string; status: 'AWAITING_YOU' | 'MATCH_CONCLUDED' | 'CLOSED_BY_YOU'; actions: string[] }

const TEXT = {
  ar: {
    reem: 'ريم', sami: 'سامي', layla: 'ليلى',
    hello: 'مرحبًا، سعيدة بالتعرّف إليك.', mine: 'أهلًا ريم، وأنا كذلك. ما الذي تحبين القيام به في عطلة الأسبوع؟', reading: 'القراءة والمشي غالبًا. وأنت؟',
    samiHello: 'سعدت بالحديث معك.', samiMine: 'وأنا كذلك، شكرًا لك.',
  },
  en: {
    reem: 'Reem', sami: 'Sami', layla: 'Layla',
    hello: 'Hi, nice to meet you.', mine: 'Hi Reem, likewise. What do you like to do at the weekend?', reading: 'Reading and walking, mostly. And you?',
    samiHello: 'It was good talking with you.', samiMine: 'Likewise, thank you.',
  },
} as const;

const ID = (n: number) => `56050000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const P_ACCEPT = ID(1);
const P_CONCLUDED = ID(2);
const W_LIVE = ID(11);
const W_ENDED = ID(12);
const W_NEW = ID(13);

export interface S605ProofIntroductionWorld {
  /** An answer for one of its routes, `undefined` for anything else; throws for a message sent while "offline". */
  route(path: string, method: string, body: Json | undefined): Answer | undefined;
  seed(): void;
  peerEnd(): void;
  offline(): void;
}

export function createS605ProofIntroductionWorld(language: ChromeLanguage): S605ProofIntroductionWorld {
  const t = TEXT[language];
  let proposals: Proposal[] | null = null;
  let worlds: World[] = [];
  let failNextSend = false;
  let clock = 0;
  let next = 100;
  const at = () => new Date(Date.UTC(2026, 9, 16, 10, 0, clock++)).toISOString().replace('Z', '+00:00');
  const answered = new Map<string, Json>();
  const json = (status: number, body: unknown): Answer => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const out = (p: Proposal): Json => ({ proposalId: p.proposalId, viewId: p.viewId, status: p.status, actions: [...p.actions] });
  const line = (self: boolean, text: string): Line => ({ materialId: ID(next++), self, text, establishedAt: at() });
  const message = (l: Line): Json => ({ materialId: l.materialId, producer: l.self ? 'SELF' : 'HUMAN', text: l.text, establishedAt: l.establishedAt, canDelete: l.self });
  /** Newest page, oldest first, of `lines`; the before-cursor keeps strictly older ones. */
  const page = (outcome: 'ACTIVE' | 'ENDED', lines: Line[], before: string | null) => {
    const older = before === null ? lines : lines.filter((l) => l.materialId < before);
    const slice = older.slice(-50);
    return { outcome, messages: slice.map(message), hasOlder: older.length > slice.length };
  };
  const end = (world: World) => {
    world.ended = true;
    world.frozen = world.lines.map((l) => l.materialId);
  };

  return {
    seed() {
      answered.clear();
      clock = 0;
      failNextSend = false;
      proposals = [
        { proposalId: P_ACCEPT, viewId: ID(3), status: 'AWAITING_YOU', actions: ['ACCEPT', 'DECLINE'] },
        { proposalId: P_CONCLUDED, viewId: ID(4), status: 'MATCH_CONCLUDED', actions: [] },
      ];
      const live: World = { worldId: W_LIVE, proposalId: P_CONCLUDED, name: t.reem, ended: false, frozen: null, lines: [] };
      live.lines.push(line(false, t.hello), line(true, t.mine), line(false, t.reading));
      const ended: World = { worldId: W_ENDED, proposalId: ID(5), name: t.sami, ended: false, frozen: null, lines: [] };
      ended.lines.push(line(false, t.samiHello), line(true, t.samiMine));
      end(ended);
      worlds = [live, ended];
    },
    peerEnd() {
      const live = worlds.find((w) => w.worldId === W_LIVE);
      if (live !== undefined && !live.ended) end(live);
    },
    offline() {
      failNextSend = true;
    },
    route(path, method, body) {
      if (proposals === null) return undefined;
      if (path === '/introductions/proposals' && method === 'GET') return json(200, { proposals: proposals.map(out), next: null });
      const decision = /^\/introductions\/proposals\/([0-9a-f-]{36})\/(acceptance|decline)$/u.exec(path);
      if (decision !== null && method === 'POST') {
        if (body === undefined || typeof body.commandId !== 'string' || typeof body.viewId !== 'string' || Object.keys(body).length !== 2) return json(400, { outcome: 'INVALID_REQUEST' });
        const earlier = answered.get(body.commandId);
        if (earlier !== undefined) return json(200, earlier);
        const proposal = proposals.find((p) => p.proposalId === decision[1]);
        const accept = decision[2] === 'acceptance';
        let answer: Json;
        if (proposal === undefined) answer = accept ? { outcome: 'UNAVAILABLE', worldId: null, proposal: null } : { outcome: 'UNAVAILABLE', proposal: null };
        else if (proposal.viewId !== body.viewId) answer = accept ? { outcome: 'CHANGED', worldId: null, proposal: out(proposal) } : { outcome: 'CHANGED', proposal: out(proposal) };
        else if (!proposal.actions.includes(accept ? 'ACCEPT' : 'DECLINE')) answer = accept ? { outcome: 'UNAVAILABLE', worldId: null, proposal: out(proposal) } : { outcome: 'UNAVAILABLE', proposal: out(proposal) };
        else if (accept) {
          Object.assign(proposal, { status: 'MATCH_CONCLUDED', actions: [] });
          worlds.push({ worldId: W_NEW, proposalId: proposal.proposalId, name: t.layla, ended: false, frozen: null, lines: [] });
          answer = { outcome: 'MATCHED', worldId: W_NEW, proposal: out(proposal) };
        } else {
          Object.assign(proposal, { status: 'CLOSED_BY_YOU', actions: [] });
          answer = { outcome: 'RECORDED', proposal: out(proposal) };
        }
        answered.set(body.commandId, answer);
        return json(200, answer);
      }
      if (path === '/introductions/worlds' && method === 'GET') {
        return json(200, { worlds: worlds.map((w) => ({ worldId: w.worldId, proposalId: w.proposalId, state: w.ended ? 'ENDED' : 'ACTIVE', otherFirstName: w.name })) });
      }
      const read = /^\/introductions\/worlds\/([0-9a-f-]{36})\/(messages|history)(?:\/before\/([0-9a-f-]{36})\/[^/]+)?$/u.exec(path);
      if (read !== null && method === 'GET') {
        const world = worlds.find((w) => w.worldId === read[1]);
        if (world === undefined) return json(200, { outcome: 'UNAVAILABLE' });
        const before = read[3] ?? null;
        if (read[2] === 'messages') return json(200, world.ended ? { outcome: 'ENDED' } : page('ACTIVE', world.lines, before));
        if (!world.ended) return json(200, { outcome: 'UNAVAILABLE' });
        return json(200, page('ENDED', world.lines.filter((l) => world.frozen!.includes(l.materialId)), before));
      }
      const send = /^\/introductions\/worlds\/([0-9a-f-]{36})\/messages$/u.exec(path);
      if (send !== null && method === 'POST') {
        if (body === undefined || typeof body.commandId !== 'string' || typeof body.content !== 'string' || body.content.trim().length === 0) return json(400, { outcome: 'INVALID_REQUEST' });
        const earlier = answered.get(body.commandId);
        if (earlier !== undefined) return json(200, earlier);
        if (failNextSend) {
          failNextSend = false;
          throw new Error('S6-05 proof: no answer');
        }
        const world = worlds.find((w) => w.worldId === send[1]);
        let answer: Json;
        // A refusal is exactly { outcome } (apps/api/src/introductions-world).
        if (world === undefined) answer = { outcome: 'UNAVAILABLE' };
        else if (world.ended) answer = { outcome: 'ENDED' };
        else {
          const committed = line(true, body.content);
          world.lines.push(committed);
          answer = { outcome: 'COMMITTED', materialId: committed.materialId, establishedAt: committed.establishedAt };
        }
        answered.set(body.commandId, answer);
        return json(200, answer);
      }
      const ending = /^\/introductions\/worlds\/([0-9a-f-]{36})\/end$/u.exec(path);
      if (ending !== null && method === 'POST') {
        if (body === undefined || typeof body.commandId !== 'string' || Object.keys(body).length !== 1) return json(400, { outcome: 'INVALID_REQUEST' });
        const earlier = answered.get(body.commandId);
        if (earlier !== undefined) return json(200, earlier);
        const world = worlds.find((w) => w.worldId === ending[1]);
        const answer = world === undefined ? { outcome: 'UNAVAILABLE' } : world.ended ? { outcome: 'ALREADY_SETTLED' } : (end(world), { outcome: 'ENDED' });
        answered.set(body.commandId, answer);
        return json(200, answer);
      }
      const deletion = /^\/shared\/worlds\/([0-9a-f-]{36})\/materials\/([0-9a-f-]{36})\/delete$/u.exec(path);
      if (deletion !== null && method === 'POST') {
        const world = worlds.find((w) => w.worldId === deletion[1]);
        if (world === undefined) return undefined;
        const target = world.lines.find((l) => l.materialId === deletion[2]);
        if (target === undefined || !target.self) return json(200, { outcome: 'UNAVAILABLE' });
        // Gone for both humans, before or after END (availability dominates the frozen set).
        world.lines = world.lines.filter((l) => l !== target);
        return json(200, { outcome: 'DELETED' });
      }
      return undefined;
    },
  };
}
