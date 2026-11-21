/**
 * COSMOS-FINAL-01 E-2 — the synthetic-data acceptance world answers wire-legal, populated bodies (validation tooling).
 */
import { decodeHistoricalDisclosure } from '../../projection/historical-projection-wire';
import { otherSpeakerTone, speakerInitials } from '../../attribution';
import { UnderstandingApiClient } from '../../runtime-entry';
import { E2_UNDERSTANDING_COUNTS, E2_UNDERSTANDING_MARK } from '../__validation__/e2-acceptance-understanding';
import { E2_NAMES, E2_PERSONAL_COUNTS, E2_SESSION_IDS, E2_STAND_IN, createE2AcceptanceWorld } from '../__validation__/e2-acceptance-world';

const DEPTHS = ['WORLD', 'THREAD', 'SESSION', 'ANALYTICAL_OBJECT', 'SOURCE_PROVENANCE'] as const;

describe.each(['en', 'ar'] as const)('the E-2 acceptance world (%s)', (language) => {
  const world = createE2AcceptanceWorld(language);
  const get = async (path: string, init?: { method?: string; body?: string }) => (await world.fetch(`${world.config.apiBaseUrl}${path}`, init)).json() as Promise<any>;

  test('Personal: every timeline position and depth decodes; 13 topics at the live head, three before the session', async () => {
    for (let tc = 1; tc <= 52; tc += 1) {
      for (const depth of DEPTHS) {
        const decoded = decodeHistoricalDisclosure(await get(`/conversation/sessions/${E2_SESSION_IDS.current}/historical-projection?tc=${tc}&depth=${depth}`));
        expect([tc, depth, decoded.ok]).toEqual([tc, depth, true]);
      }
    }
    expect((await get(`/conversation/sessions/${E2_SESSION_IDS.current}/historical-projection?tc=52&depth=WORLD`)).world.threads).toHaveLength(13);
    expect((await get(`/conversation/sessions/${E2_SESSION_IDS.current}/historical-projection?tc=1&depth=WORLD`)).world.threads).toHaveLength(3);
    expect((await get(`/conversation/sessions/${E2_SESSION_IDS.current}/turns`)).exchanges).toHaveLength(26);
  });

  test('Personal: a sent message is kept for the session with the labelled stand-in line, never a model reply', async () => {
    const sent = await get(`/conversation/sessions/${E2_SESSION_IDS.current}/turns`, { method: 'POST', body: JSON.stringify({ content: 'hello', idempotencyKey: 'k-1' }) });
    expect(sent.assistantTurn.content).toBe(E2_STAND_IN.personal[language]);
    expect((await get(`/conversation/sessions/${E2_SESSION_IDS.current}/turns`)).exchanges).toHaveLength(27);
  });

  test('Personal (E-2 corrections): two seeded conversations in the catalog, newest first; an unknown conversation is 404; the earlier one holds the first three topics where they began', async () => {
    const list = await get('/conversation/sessions');
    expect(list.map((row: { id: string }) => row.id)).toEqual([E2_SESSION_IDS.current, E2_SESSION_IDS.earlier]);
    // (One shared world per language: the send test above may already have added an exchange here.)
    expect(list[0]).toMatchObject({ status: 'ACTIVE', title: null });
    expect(list[0].turn_count).toBeGreaterThanOrEqual(52);
    expect(list[1]).toMatchObject({ status: 'ACTIVE', title: null, turn_count: E2_PERSONAL_COUNTS.earlierExchanges * 2 });
    expect(typeof list[0].opening).toBe('string');
    expect((await world.fetch(`${world.config.apiBaseUrl}/conversation/sessions/not-a-conversation/turns`)).status).toBe(404);
    const earlier = await get(`/conversation/sessions/${E2_SESSION_IDS.earlier}/temporal`);
    expect(earlier).toMatchObject({ sessionId: E2_SESSION_IDS.earlier, liveHead: 6 });
    const world6 = await get(`/conversation/sessions/${E2_SESSION_IDS.earlier}/historical-projection?tc=6&depth=WORLD`);
    expect(decodeHistoricalDisclosure(world6).ok).toBe(true);
    expect(world6.world.threads.map((t: { id: string }) => t.id)).toEqual(['e2-topic-01', 'e2-topic-02', 'e2-topic-03']);
    expect(world6.world.threads.map((t: { origin: { sp: number } }) => t.origin.sp)).toEqual([1, 3, 5]);
    expect((await get(`/conversation/sessions/${E2_SESSION_IDS.earlier}/historical-projection?tc=2&depth=WORLD`)).world.threads).toHaveLength(1);
    // In the current conversation those three carry their EARLIER origin; the others began here.
    const here = await get(`/conversation/sessions/${E2_SESSION_IDS.current}/historical-projection?tc=52&depth=WORLD`);
    expect(here.world.threads[0].origin).toEqual({ sessionId: E2_SESSION_IDS.earlier, sp: 1 });
    expect(here.world.threads[3].origin).toEqual({ sessionId: E2_SESSION_IDS.current, sp: 13 });
  });

  test('Personal (E-2 corrections): every topic is named by its first words (grounding wording) until the reader names it; the alias is served by every projection and the current world; the current world lists all topics wherever they began', async () => {
    const before = await get(`/conversation/sessions/${E2_SESSION_IDS.current}/historical-projection?tc=52&depth=WORLD`);
    for (const thread of before.world.threads) {
      expect(thread.name.source).toBe('GROUNDING_WORDING');
      expect(typeof thread.name.text).toBe('string');
      expect(thread.name.text.length).toBeGreaterThan(0);
      expect(thread.name.text.length).toBeLessThanOrEqual(80);
    }
    const current = await get('/conversation/personal-world');
    expect(Number.isNaN(Date.parse(current.asOf))).toBe(false);
    expect(current.threads).toHaveLength(13);
    expect(current.threads.map((t: { id: string }) => t.id)).toEqual([...current.threads.map((t: { id: string }) => t.id)].sort());
    expect(current.threads.filter((t: { origin: { sessionId: string } }) => t.origin.sessionId === E2_SESSION_IDS.earlier)).toHaveLength(3);
    expect(Object.keys(current.threads[0]).sort()).toEqual(['home', 'id', 'name', 'origin']);

    expect((await world.fetch(`${world.config.apiBaseUrl}/conversation/threads/e2-topic-01/alias`, { method: 'PATCH', body: JSON.stringify({ alias: '   ' }) })).status).toBe(400);
    expect((await world.fetch(`${world.config.apiBaseUrl}/conversation/threads/e2-topic-99/alias`, { method: 'PATCH', body: JSON.stringify({ alias: 'x' }) })).status).toBe(404);
    const renamed = await get('/conversation/threads/e2-topic-01/alias', { method: 'PATCH', body: JSON.stringify({ alias: '  My   sleep  ' }) });
    expect(renamed).toEqual({ thread_id: 'e2-topic-01', alias: 'My sleep' });
    const after = await get(`/conversation/sessions/${E2_SESSION_IDS.current}/historical-projection?tc=52&depth=WORLD`);
    expect(after.world.threads[0].name).toEqual({ text: 'My sleep', source: 'USER_ALIAS' });
    expect(after.world.threads[1].name.source).toBe('GROUNDING_WORDING');
    expect((await get('/conversation/personal-world')).threads[0].name).toEqual({ text: 'My sleep', source: 'USER_ALIAS' });
    expect((await get(`/conversation/sessions/${E2_SESSION_IDS.earlier}/historical-projection?tc=6&depth=WORLD`)).world.threads[0].name.text).toBe('My sleep');
  });

  test('Personal (E-2 corrections): New Chat mints ONE conversation per client request id; it starts empty, is listed newest, sees the whole world once it has a Moment; rename is bounded', async () => {
    // The launch (no request id) opens the seeded current conversation and mints nothing.
    const launch = await get('/conversation/sessions', { method: 'POST' });
    expect(launch.id).toBe(E2_SESSION_IDS.current);
    expect((await get('/conversation/sessions')).map((row: { id: string }) => row.id).sort()).toEqual([E2_SESSION_IDS.current, E2_SESSION_IDS.earlier].sort());
    const first = await get('/conversation/sessions', { method: 'POST', body: JSON.stringify({ clientRequestId: 'req-1' }) });
    const again = await get('/conversation/sessions', { method: 'POST', body: JSON.stringify({ clientRequestId: 'req-1' }) });
    expect(again.id).toBe(first.id);
    expect(first.id).not.toBe(E2_SESSION_IDS.current);
    expect((await get('/conversation/sessions')).map((row: { id: string }) => row.id)[0]).toBe(first.id);
    expect(await get(`/conversation/sessions/${first.id}/temporal`)).toMatchObject({ sessionId: first.id, liveHead: null });
    expect((await world.fetch(`${world.config.apiBaseUrl}/conversation/sessions/${first.id}/historical-projection?tc=1&depth=WORLD`)).status).toBe(404);
    await get(`/conversation/sessions/${first.id}/turns`, { method: 'POST', body: JSON.stringify({ content: 'a new start', idempotencyKey: 'n-1' }) });
    expect(await get(`/conversation/sessions/${first.id}/temporal`)).toMatchObject({ liveHead: 2 });
    const seen = await get(`/conversation/sessions/${first.id}/historical-projection?tc=2&depth=WORLD`);
    expect(decodeHistoricalDisclosure(seen).ok).toBe(true);
    expect(seen.world.threads).toHaveLength(13);
    expect(seen.world.threads.every((t: { establishedSp: number | null }) => t.establishedSp === null)).toBe(true);
    expect((await world.fetch(`${world.config.apiBaseUrl}/conversation/sessions/${first.id}/title`, { method: 'PATCH', body: JSON.stringify({ title: 'x'.repeat(81) }) })).status).toBe(400);
    expect(await get(`/conversation/sessions/${first.id}/title`, { method: 'PATCH', body: JSON.stringify({ title: ' Fresh  start ' }) })).toEqual({ session_id: first.id, title: 'Fresh start' });
    expect((await get('/conversation/sessions'))[0]).toMatchObject({ id: first.id, title: 'Fresh start', turn_count: 2 });
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
  const understanding = new UnderstandingApiClient({ baseUrl: world.config.apiBaseUrl, fetch: world.fetch });
  const readItems = async () => {
    const outcome = await understanding.readItems();
    expect(outcome.kind).toBe('READ');
    return outcome.kind === 'READ' ? outcome.items : [];
  };

  test('Understanding: the strict client READs the list and every detail; each statement carries the synthetic mark', async () => {
    const items = await readItems();
    expect(items).toHaveLength(E2_UNDERSTANDING_COUNTS.items);
    expect(E2_UNDERSTANDING_COUNTS.items).toBeGreaterThanOrEqual(8);
    for (const item of items!) {
      if (item.evidenceChange === 'NONE') expect(item.summary!.startsWith(E2_UNDERSTANDING_MARK[language])).toBe(true);
      else expect(item.summary).toBeNull();
      const detail = await understanding.readItem(item.ref);
      expect([item.ref, detail.kind]).toEqual([item.ref, 'READ']);
      if (detail.kind === 'READ') expect([detail.view.ref, detail.view.revision]).toEqual([item.ref, item.revision]);
    }
    expect(items.filter((item) => item.evidenceChange !== 'NONE')).toHaveLength(E2_UNDERSTANDING_COUNTS.withheld);
    expect(items.filter((item) => item.underReview)).toHaveLength(E2_UNDERSTANDING_COUNTS.underReview);
    expect(E2_UNDERSTANDING_COUNTS.withheld).toBe(1);
    expect(E2_UNDERSTANDING_COUNTS.underReview).toBe(1);
    expect(new Set(items.map((item) => item.theme)).size).toBe(6);
    expect(new Set(items.map((item) => item.confidence)).size).toBe(4);
  });

  test('Understanding: an unknown ref is GONE; no command is pretended — each answers 503, FAILED, never a success', async () => {
    expect(await understanding.readItem('E2SYN-00-not-an-item__')).toEqual({ kind: 'GONE' });
    const [first] = await readItems();
    const command = { commandId: '11111111-1111-4111-8111-111111111111', revision: first.revision };
    for (const [method, suffix] of [['POST', '/discussion'], ['DELETE', '/discussion'], ['POST', '/disagreement'], ['POST', '/disagreement/resolve']] as const) {
      const answer = await world.fetch(`${world.config.apiBaseUrl}/understanding/items/${first.ref}${suffix}`, { method, body: JSON.stringify(command) });
      expect([method, suffix, answer.status, answer.ok]).toEqual([method, suffix, 503, false]);
    }
    expect(await understanding.openDiscussion(first.ref, first.revision)).toEqual({ kind: 'FAILED' });
    expect(await understanding.disagree(first.ref, command.commandId, first.revision)).toEqual({ kind: 'FAILED' });
  });
});
