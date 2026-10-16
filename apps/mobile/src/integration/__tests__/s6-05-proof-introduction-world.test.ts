/**
 * S6-05 — VALIDATION guard for the device proof stand-in `qandeel://s401-proof/introductions/seed-match`: until it is
 * seeded it answers nothing (every earlier proof leg is unchanged); every answer it serves passes the shipped strict
 * clients; a command id answers the same way when sent again; ENDED reaches a send only after the other person ended
 * it; a network failure is a thrown request, never an ending; the reader deletes only their own words.
 */
import { IntroductionProposalsApiClient, IntroductionWorldsApiClient, SharedWorldApiClient } from '../../runtime-entry';
import { createS605ProofIntroductionWorld } from '../__validation__/s605-proof-introduction-world';

function clients() {
  const proof = createS605ProofIntroductionWorld('ar');
  const fetch = async (input: string, init?: { method?: string; body?: string }) => {
    const answer = proof.route(input.replace('https://proof', '').split('?')[0], init?.method ?? 'GET', init?.body === undefined ? undefined : JSON.parse(init.body));
    if (answer === undefined) throw new Error('not served');
    return answer;
  };
  const config = { baseUrl: 'https://proof', fetch: fetch as never };
  return { proof, worlds: new IntroductionWorldsApiClient(config), proposals: new IntroductionProposalsApiClient(config), shared: new SharedWorldApiClient(config) };
}

describe('S6-05 proof stand-in', () => {
  it('answers nothing until seeded', async () => {
    const { proof, worlds } = clients();
    expect(proof.route('/introductions/proposals', 'GET', undefined)).toBeUndefined();
    expect((await worlds.list()).kind).toBe('OFFLINE');
  });

  it('serves what the strict clients accept: ACCEPT offered, a MATCH_CONCLUDED joined to a live World, an ended one', async () => {
    const { proof, worlds, proposals } = clients();
    proof.seed();
    const read = await proposals.list(null);
    if (read.kind !== 'READ') throw new Error(read.kind);
    expect(read.proposals.map((p) => [p.status, p.actions])).toEqual([['AWAITING_YOU', ['ACCEPT', 'DECLINE']], ['MATCH_CONCLUDED', []]]);
    const list = await worlds.list();
    if (list.kind !== 'READ') throw new Error(list.kind);
    expect(list.worlds.map((w) => [w.state, w.otherFirstName, w.proposalId === read.proposals[1].proposalId])).toEqual([['ACTIVE', 'ريم', true], ['ENDED', 'سامي', false]]);
    const live = await worlds.messages(list.worlds[0].worldId, null);
    expect(live.kind === 'PAGE' && live.messages.map((m) => m.producer)).toEqual(['HUMAN', 'SELF', 'HUMAN']);
    expect((await worlds.messages(list.worlds[1].worldId, null)).kind).toBe('ENDED');
    const closed = await worlds.history(list.worlds[1].worldId, null);
    expect(closed.kind === 'PAGE' && closed.messages).toHaveLength(2);
  });

  it('the acceptance binds a new World and replays by command id; END, ALREADY_SETTLED, ENDED on send, deletion of one\'s own only', async () => {
    const { proof, worlds, proposals, shared } = clients();
    proof.seed();
    const read = await proposals.list(null);
    if (read.kind !== 'READ') throw new Error(read.kind);
    const first = await proposals.accept(read.proposals[0].proposalId, 'c1', read.proposals[0].viewId);
    expect(first).toMatchObject({ kind: 'ANSWERED', outcome: 'MATCHED', proposal: { status: 'MATCH_CONCLUDED' } });
    expect(await proposals.accept(read.proposals[0].proposalId, 'c1', read.proposals[0].viewId)).toEqual(first);
    const list = await worlds.list();
    if (list.kind !== 'READ') throw new Error(list.kind);
    const live = list.worlds[0].worldId;
    expect((await worlds.send(live, 's1', 'hello')).kind).toBe('COMMITTED');
    proof.offline();
    expect((await worlds.send(live, 's2', 'lost')).kind).toBe('OFFLINE');
    proof.peerEnd();
    expect((await worlds.send(live, 's3', 'late')).kind).toBe('ENDED');
    expect((await worlds.end(live, 'e1')).kind).toBe('ALREADY_SETTLED');
    const closed = await worlds.history(live, null);
    if (closed.kind !== 'PAGE') throw new Error(closed.kind);
    const mine = closed.messages.find((m) => m.producer === 'SELF')!;
    const theirs = closed.messages.find((m) => m.producer === 'HUMAN')!;
    expect((await shared.deleteMaterial(live, theirs.materialId, 'd1')).kind).toBe('NOT_DELETABLE');
    expect((await shared.deleteMaterial(live, mine.materialId, 'd2')).kind).toBe('DELETED');
    const after = await worlds.history(live, null);
    expect(after.kind === 'PAGE' && after.messages.some((m) => m.materialId === mine.materialId)).toBe(false);
  });
});
