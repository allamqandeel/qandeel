/**
 * S5-04 — the native-proof fixture of the Public discussion, @qandeel and Public Activity Direct Entry (VALIDATION fixture
 * guard).
 *
 * The S4-01 proof world answers the discussion and the reader's `/activity/*` only after `publicSeed()` (so every earlier
 * device leg meets exactly what it met before), and what it answers is what the production strict clients accept — so a
 * device run of the S5-04 journey cannot silently fall back to an unavailable or empty state. The semantics themselves are
 * the real-PostgreSQL verifier's (database/verify-migration-0147.mjs) and the API spec's; this guards the stand-in.
 */
import { ActivityApiClient, PublicWorldApiClient } from '../../runtime-entry';
import { createS401ProofWorld, S504_PROOF_LINES } from '../__validation__/s401-proof-world';
import { FIXTURE_OWN_EXPERIENCE_ID } from '../__validation__/s503b-visual-field';

const OTHER = '5503b000-0000-4000-8000-000000000012';
const command = (n: number) => `5504c000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function clients() {
  const world = createS401ProofWorld('en');
  const transport = { baseUrl: world.config.apiBaseUrl, fetch: world.fetch };
  return { world, discussion: new PublicWorldApiClient(transport).discussion, field: new PublicWorldApiClient(transport).field, activity: new ActivityApiClient(transport) };
}

describe('S5-04 — the native-proof fixture of the proof world', () => {
  it('is off until public/seed: the discussion and Activity meet exactly the answers they met before', async () => {
    const { discussion, activity } = clients();
    expect(await discussion.read(OTHER, null)).toEqual({ kind: 'NO_ANSWER' });
    expect(await activity.readPage({ category: null, before: null, limit: 20 })).toEqual({ kind: 'UNAVAILABLE' });
  });

  it('post → reply → @qandeel → response, one visible depth, idempotent, the human count on the panel', async () => {
    const { world, discussion, field } = clients();
    world.publicSeed();
    const empty = await discussion.read(OTHER, null);
    expect(empty).toEqual({ kind: 'ANSWER', value: { kind: 'SERVED', canContribute: true, posts: [], nextAfter: null } });

    const top = await discussion.post(OTHER, command(1), 'Fixture top-level words', null);
    expect(top.kind === 'ANSWER' && top.value.kind).toBe('COMMITTED');
    const topId = top.kind === 'ANSWER' && top.value.kind === 'COMMITTED' ? top.value.postId : '';
    expect(await discussion.post(OTHER, command(1), 'Fixture top-level words', null)).toEqual(top);

    const reply = await discussion.post(OTHER, command(2), 'Fixture reply words', topId);
    const replyId = reply.kind === 'ANSWER' && reply.value.kind === 'COMMITTED' ? reply.value.postId : '';
    expect(reply.kind === 'ANSWER' && reply.value.kind === 'COMMITTED' && [reply.value.threadRootId, reply.value.qandeel]).toEqual([topId, 'NONE']);
    // A reply to a reply joins the same root (D2), and may invoke QANDEEL (D1).
    const asked = await discussion.post(OTHER, command(3), 'What do you see here, @QANDEEL?', replyId);
    expect(asked.kind === 'ANSWER' && asked.value.kind === 'COMMITTED' && [asked.value.threadRootId, asked.value.qandeel]).toEqual([topId, 'RESPONDED']);

    const read = await discussion.read(OTHER, null);
    const posts = read.kind === 'ANSWER' && read.value.kind === 'SERVED' ? read.value.posts : [];
    expect(posts.map((p) => p.ordinal)).toEqual([1, 2, 3]);
    expect(posts.every((p) => p.own && p.author.mode === 'PSEUDONYM' && p.threadRootId === topId)).toBe(true);
    expect(posts[2].text).toBe('What do you see here, @QANDEEL?');
    expect(posts[2].qandeel).toEqual({ state: 'RESPONDED', text: S504_PROOF_LINES.qandeel.en, respondedAt: expect.any(String) });
    expect(posts[0].qandeel).toEqual({ state: 'NONE' });

    const panel = await field.experience(OTHER);
    expect(panel.kind === 'ANSWER' && panel.value.kind === 'SERVED' && panel.value.experience.discussionCount).toBe(3);
  });

  it('@qandeel is the standalone token 0147 detects, nothing else', async () => {
    const { world, discussion } = clients();
    world.publicSeed();
    const cases: [string, string][] = [
      ['write to mail@qandeel.com', 'NONE'], ['visit @qandeel.com', 'NONE'], ['not @qandeelish', 'NONE'], ['the @@qandeel', 'NONE'],
      ['@qandeel, look', 'RESPONDED'], ['tell me, @qandeel.', 'RESPONDED'], ['(@qandeel)', 'RESPONDED'], ['ما رأيك @qandeel؟', 'RESPONDED'],
    ];
    for (const [index, [text, expected]] of cases.entries()) {
      const answer = await discussion.post(OTHER, command(10 + index), text, null);
      expect([text, answer.kind === 'ANSWER' && answer.value.kind === 'COMMITTED' ? answer.value.qandeel : null]).toEqual([text, expected]);
    }
  });

  it('a peer reply to the reader’s post yields ONE Public Activity item whose open enters exactly that Experience’s discussion', async () => {
    const { world, discussion, activity } = clients();
    world.publicSeed();
    world.peerReply();
    expect(await activity.readPage({ category: null, before: null, limit: 20 })).toEqual({ kind: 'READ', items: [], before: null });

    await discussion.post(OTHER, command(1), 'Fixture words of mine', null);
    world.peerReply();
    const read = await discussion.read(OTHER, null);
    const posts = read.kind === 'ANSWER' && read.value.kind === 'SERVED' ? read.value.posts : [];
    expect(posts.map((p) => [p.own, p.threadRootId === posts[0].id, p.author.label])).toEqual([[true, true, 's401.proof.public'], [false, true, S504_PROOF_LINES.peerPublicId]]);

    const page = await activity.readPage({ category: 'PUBLIC', before: null, limit: 20 });
    const items = page.kind === 'READ' ? page.items : [];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ category: 'PUBLIC', speaker: 'PRODUCT', attention: 'NEW', entry: 'AVAILABLE', actionable: false, body: S504_PROOF_LINES.activity });
    const attention = await activity.readAttention('UTC');
    expect(attention.kind === 'READ' && [attention.snapshot.categories.PUBLIC.present, attention.snapshot.interruptions.map((c) => [c.interruptionClass, c.contextKind])])
      .toEqual([true, [[3, 'PUBLIC_WORLD']]]);

    expect(await activity.open(items[0].id)).toEqual({ kind: 'ENTER', destination: { kind: 'PUBLIC_WORLD', target: { kind: 'DISCUSSION', experienceId: OTHER } } });
    expect(OTHER).not.toBe(FIXTURE_OWN_EXPERIENCE_ID);
    expect(await activity.open('5504ffff-0000-4000-8000-000000000000')).toEqual({ kind: 'GONE' });
  });
});
