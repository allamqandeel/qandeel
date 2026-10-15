/**
 * S6-04 — the private Introduction proposals device-proof stand-in. VALIDATION ONLY: reachable only in the S4-01 proof
 * build (`select-s401-proof-entry.mjs --apply`), never in the production bundle.
 *
 * Until it is seeded nothing answers here, so every earlier proof leg meets the proof world exactly as before. The seed
 * delivers four SYNTHETIC proposals (opaque ids only — there is no person, name, conclusion or date to show):
 *
 *   qandeel://s401-proof/introductions/seed-proposals
 *     A  waiting for this human as the first recipient: allow or decline
 *     B  waiting for this human as the second recipient: decline only
 *     C  in progress after this human's forward approval: withdraw
 *     D  no longer available: nothing to decide
 *
 * It answers in the shapes `apps/api/src/introductions-proposals` returns. A decision is accepted only on the exact view
 * and only when offered, and a command id answers the same way when it is sent again — the server's rules in miniature,
 * enough to walk the screens with TalkBack.
 */
type Json = Record<string, unknown>;
type Status = 'AWAITING_YOU' | 'IN_PROGRESS' | 'CLOSED_BY_YOU' | 'NO_LONGER_AVAILABLE' | 'MATCH_CONCLUDED';
type Action = 'APPROVE_FORWARD' | 'DECLINE' | 'WITHDRAW';
interface Proposal { proposalId: string; viewId: string; status: Status; actions: Action[] }

const ACTION_OF: Readonly<Record<string, Action>> = { 'forward-approval': 'APPROVE_FORWARD', decline: 'DECLINE', withdrawal: 'WITHDRAW' };
const DECISION = /^\/introductions\/proposals\/([0-9a-f-]{36})\/(forward-approval|decline|withdrawal)$/u;

export interface S604ProofProposals {
  route(path: string, method: string, body: Json | undefined): { ok: boolean; status: number; json: () => Promise<unknown> } | undefined;
  seed(): void;
}

export function createS604ProofProposals(): S604ProofProposals {
  let proposals: Proposal[] | null = null;
  const answered = new Map<string, Json>();
  const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
  const out = (p: Proposal): Json => ({ proposalId: p.proposalId, viewId: p.viewId, status: p.status, actions: [...p.actions] });

  return {
    seed() {
      answered.clear();
      proposals = [
        { proposalId: '56040000-0000-4000-8000-00000000000a', viewId: '56040000-0000-4000-8000-0000000000a1', status: 'AWAITING_YOU', actions: ['APPROVE_FORWARD', 'DECLINE'] },
        { proposalId: '56040000-0000-4000-8000-00000000000b', viewId: '56040000-0000-4000-8000-0000000000b1', status: 'AWAITING_YOU', actions: ['DECLINE'] },
        { proposalId: '56040000-0000-4000-8000-00000000000c', viewId: '56040000-0000-4000-8000-0000000000c1', status: 'IN_PROGRESS', actions: ['WITHDRAW'] },
        { proposalId: '56040000-0000-4000-8000-00000000000d', viewId: '56040000-0000-4000-8000-0000000000d1', status: 'NO_LONGER_AVAILABLE', actions: [] },
      ];
    },
    route(path, method, body) {
      if (proposals === null || !path.startsWith('/introductions/proposals')) return undefined;
      if (path === '/introductions/proposals' && method === 'GET') return json(200, { proposals: proposals.map(out), next: null });
      const decision = DECISION.exec(path);
      if (decision === null || method !== 'POST' || body === undefined || typeof body.commandId !== 'string' || typeof body.viewId !== 'string'
        || Object.keys(body).length !== 2) return json(400, { outcome: 'INVALID_REQUEST' });
      const earlier = answered.get(body.commandId);
      if (earlier !== undefined) return json(200, earlier);
      const proposal = proposals.find((p) => p.proposalId === decision[1]);
      const action = ACTION_OF[decision[2]];
      let answer: Json;
      if (proposal === undefined) answer = { outcome: 'UNAVAILABLE', proposal: null };
      else if (proposal.viewId !== body.viewId) answer = { outcome: 'CHANGED', proposal: out(proposal) };
      else if (!proposal.actions.includes(action)) answer = { outcome: 'UNAVAILABLE', proposal: out(proposal) };
      else {
        if (action === 'APPROVE_FORWARD') Object.assign(proposal, { status: 'IN_PROGRESS', actions: ['WITHDRAW'] });
        else Object.assign(proposal, { status: 'CLOSED_BY_YOU', actions: [] });
        answer = { outcome: 'RECORDED', proposal: out(proposal) };
      }
      answered.set(body.commandId, answer);
      return json(200, answer);
    },
  };
}
