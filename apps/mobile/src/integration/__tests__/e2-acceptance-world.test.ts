/**
 * COSMOS-FINAL-01 E-2 — the synthetic-data acceptance world answers wire-legal, populated bodies (validation tooling).
 */
import { decodeHistoricalDisclosure } from '../../projection/historical-projection-wire';
import { otherSpeakerTone, speakerInitials } from '../../attribution';
import { decodeUnderstandingDetail, decodeUnderstandingList } from '../../runtime-entry/understanding-api';
import { E2_UNDERSTANDING_COUNTS, E2_UNDERSTANDING_MARK } from '../__validation__/e2-acceptance-understanding';
import { E2_NAMES, E2_STAND_IN, createE2AcceptanceWorld } from '../__validation__/e2-acceptance-world';

const DEPTHS = ['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE'] as const;

describe.each(['en', 'ar'] as const)('the E-2 acceptance world (%s)', (language) => {
  const world = createE2AcceptanceWorld(language);
  const get = async (path: string, init?: { method?: string; body?: string }) => (await world.fetch(`${world.config.apiBaseUrl}${path}`, init)).json() as Promise<any>;

  test('Personal: every timeline position and depth decodes; 13 topics at the live head, three before the session', async () => {
    for (let tc = 1; tc <= 52; tc += 1) {
      for (const depth of DEPTHS) {
        const decoded = decodeHistoricalDisclosure(await get(`/conversation/sessions/s/historical-projection?tc=${tc}&depth=${depth}`));
        expect([tc, depth, decoded.ok]).toEqual([tc, depth, true]);
      }
    }
    expect((await get('/conversation/sessions/s/historical-projection?tc=52&depth=WORLD')).world.threads).toHaveLength(13);
    expect((await get('/conversation/sessions/s/historical-projection?tc=1&depth=WORLD')).world.threads).toHaveLength(3);
    expect((await get('/conversation/sessions/s/turns')).exchanges).toHaveLength(26);
  });

  test('Personal: a sent message is kept for the session with the labelled stand-in line, never a model reply', async () => {
    const sent = await get('/conversation/sessions/s/turns', { method: 'POST', body: JSON.stringify({ content: 'hello', idempotencyKey: 'k-1' }) });
    expect(sent.assistantTurn.content).toBe(E2_STAND_IN.personal[language]);
    expect((await get('/conversation/sessions/s/turns')).exchanges).toHaveLength(27);
  });

  test('Shared: two Worlds; four people with the same-initials pairs in distinct tones; the field is served', async () => {
    const root = await get('/shared');
    expect(root.worlds).toHaveLength(2);
    const family = root.worlds[0];
    expect(family.members.map((m: { name: string }) => m.name)).toEqual([E2_NAMES.SELF, E2_NAMES.PEER, E2_NAMES.NEWCOMER, E2_NAMES.GUEST].map((n) => n[language]));
    expect(speakerInitials(E2_NAMES.PEER[language])).toBe(speakerInitials(E2_NAMES.NEWCOMER[language]));
    expect(speakerInitials(E2_NAMES.GUEST[language])).toBe(speakerInitials(E2_NAMES.SELF[language]));
    const tones = [E2_NAMES.PEER, E2_NAMES.NEWCOMER, E2_NAMES.GUEST].map((n) => otherSpeakerTone(n[language]));
    expect(new Set(tones).size).toBe(3);
    const materials = (await get(`/shared/worlds/${family.worldId}/materials`)).materials;
    expect(materials).toHaveLength(16);
    expect(materials.filter((m: { producer: string }) => m.producer === 'QANDEEL')).toHaveLength(3);
    expect((await get(`/shared/worlds/${family.worldId}/field`)).places).toHaveLength(9);
  });

  test('Public: the entry answers at once; posts, comments and replies carry their fictional Public IDs', async () => {
    expect(await get('/public/entry')).toEqual({ outcome: 'ALLOW' });
    const discussion = await get('/public/field/experiences/5503b000-0000-4000-8000-000000000001/discussion');
    expect(discussion.posts).toHaveLength(5);
    expect(new Set(discussion.posts.filter((p: { own: boolean }) => !p.own).map((p: { author: { label: string } }) => p.author.label))).toEqual(new Set(['noor.sky.21', 'calm.river.08', 'olive.tree.15']));
    expect(discussion.posts.filter((p: { replyToPostId: string | null }) => p.replyToPostId !== null)).toHaveLength(3);
  });

  // COSMOS E-2 corrections (2026-11-20 §6): the first E-2 build answered no /understanding route, so the surface read
  // UNAVAILABLE — a fixture gap. Now the reads decode strictly and every statement is marked synthetic.
  test('Understanding: the list and every detail decode strictly; each statement carries the synthetic mark', async () => {
    const items = decodeUnderstandingList(await get('/understanding/items'));
    expect(items).not.toBeNull();
    expect(items).toHaveLength(E2_UNDERSTANDING_COUNTS.items);
    expect(E2_UNDERSTANDING_COUNTS.items).toBeGreaterThanOrEqual(8);
    for (const item of items!) {
      if (item.evidenceChange === 'NONE') expect(item.summary!.startsWith(E2_UNDERSTANDING_MARK[language])).toBe(true);
      else expect(item.summary).toBeNull();
      const detail = decodeUnderstandingDetail(await get(`/understanding/items/${item.ref}`));
      expect([item.ref, detail?.ref]).toEqual([item.ref, item.ref]);
      expect(detail!.revision).toBe(item.revision);
    }
    expect(items!.filter((item) => item.evidenceChange !== 'NONE')).toHaveLength(E2_UNDERSTANDING_COUNTS.withheld);
    expect(items!.filter((item) => item.underReview)).toHaveLength(E2_UNDERSTANDING_COUNTS.underReview);
    expect(E2_UNDERSTANDING_COUNTS.withheld).toBe(1);
    expect(E2_UNDERSTANDING_COUNTS.underReview).toBe(1);
    expect(new Set(items!.map((item) => item.theme)).size).toBe(6);
    expect(new Set(items!.map((item) => item.confidence)).size).toBe(4);
  });

  test('Understanding: an unknown ref is 404; no command is pretended — each answers 503, never a success', async () => {
    const unknown = await world.fetch(`${world.config.apiBaseUrl}/understanding/items/E2SYN-00-not-an-item__`);
    expect(unknown.status).toBe(404);
    const [first] = decodeUnderstandingList(await get('/understanding/items'))!;
    const command = { commandId: '11111111-1111-4111-8111-111111111111', revision: first.revision };
    for (const [method, suffix] of [['POST', '/discussion'], ['DELETE', '/discussion'], ['POST', '/disagreement'], ['POST', '/disagreement/resolve']] as const) {
      const answer = await world.fetch(`${world.config.apiBaseUrl}/understanding/items/${first.ref}${suffix}`, { method, body: JSON.stringify(command) });
      expect([method, suffix, answer.status, answer.ok]).toEqual([method, suffix, 503, false]);
    }
  });
});
