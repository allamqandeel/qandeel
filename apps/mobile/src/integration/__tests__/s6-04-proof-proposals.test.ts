/**
 * S6-04 — VALIDATION guard for the device proof stand-in `qandeel://s401-proof/introductions/seed-proposals`: until it
 * is seeded it answers nothing (every earlier proof leg is unchanged); every proposal it serves passes the strict client
 * decoder (no person, name, conclusion or date); a decision is accepted only on the exact view, only when offered, and
 * a command id answers the same way when sent again.
 */
import { IntroductionProposalsApiClient } from '../../runtime-entry';
import { createS604ProofProposals } from '../__validation__/s604-proof-proposals';

const body = async (answer: { json: () => Promise<unknown> } | undefined) => (answer === undefined ? undefined : await answer.json()) as Record<string, any>;
const A = '56040000-0000-4000-8000-00000000000a';
const B = '56040000-0000-4000-8000-00000000000b';

describe('S6-04 proof stand-in', () => {
  it('answers nothing until seeded', () => {
    expect(createS604ProofProposals().route('/introductions/proposals', 'GET', undefined)).toBeUndefined();
  });

  it('serves four synthetic proposals the strict decoder accepts: allow + decline, decline only, withdraw, nothing', async () => {
    const proof = createS604ProofProposals();
    proof.seed();
    // Read through the shipped client, so its strict decoder judges every row.
    const client = new IntroductionProposalsApiClient({
      baseUrl: 'https://proof',
      fetch: async (input, init) => proof.route(input.replace('https://proof', '').split('?')[0], init?.method ?? 'GET', undefined)!,
    });
    const read = await client.list(null);
    if (read.kind !== 'READ') throw new Error(`the strict decoder refused the stand-in: ${read.kind}`);
    expect(read.next).toBeNull();
    expect(read.proposals.map((p) => [p.status, p.actions])).toEqual([
      ['AWAITING_YOU', ['APPROVE_FORWARD', 'DECLINE']], ['AWAITING_YOU', ['DECLINE']], ['IN_PROGRESS', ['WITHDRAW']], ['NO_LONGER_AVAILABLE', []],
    ]);
  });

  it('decides on the exact view only, refuses what is not offered, and replays a command id', async () => {
    const proof = createS604ProofProposals();
    proof.seed();
    const page = await body(proof.route('/introductions/proposals', 'GET', undefined));
    const viewA = page.proposals[0].viewId as string;
    const viewB = page.proposals[1].viewId as string;
    expect((await body(proof.route(`/introductions/proposals/${A}/forward-approval`, 'POST', { commandId: 'c0', viewId: viewB }))).outcome).toBe('CHANGED');
    expect((await body(proof.route(`/introductions/proposals/${B}/forward-approval`, 'POST', { commandId: 'c1', viewId: viewB }))).outcome).toBe('UNAVAILABLE');
    const allowed = await body(proof.route(`/introductions/proposals/${A}/forward-approval`, 'POST', { commandId: 'c2', viewId: viewA }));
    expect(allowed).toEqual({ outcome: 'RECORDED', proposal: { proposalId: A, viewId: viewA, status: 'IN_PROGRESS', actions: ['WITHDRAW'] } });
    expect(await body(proof.route(`/introductions/proposals/${A}/forward-approval`, 'POST', { commandId: 'c2', viewId: viewA }))).toEqual(allowed);
    expect((await body(proof.route(`/introductions/proposals/${A}/withdrawal`, 'POST', { commandId: 'c3', viewId: viewA }))).proposal.status).toBe('CLOSED_BY_YOU');
    expect(proof.route(`/introductions/proposals/${A}/decline`, 'POST', { commandId: 'c4', viewId: viewA, userId: 'x' })?.status).toBe(400);
  });
});
