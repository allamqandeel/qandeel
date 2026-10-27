/**
 * S8A-05 CP2 — the strict clients of «انشر من قنديل»: the source is sent by reference only (positions, never text,
 * speaker or order) to its own route; a «فهم قنديل» item goes to the Understanding module by its opaque ref at the
 * revision shown (409 → CHANGED, 404 → ABSENT); every answer is decoded exactly (an extra key, a foreign outcome or a
 * malformed item is NO answer); and a reader's page of a served topic carries no position in the author's conversation.
 */
import type { PublicAuthoringAnswer } from '..';
import { PublicWorldApiClient } from '..';

const id = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const yes = <T>(value: T): PublicAuthoringAnswer<T> => ({ kind: 'ANSWER', value });
const NO = { kind: 'NO_ANSWER' };
const REF = 'a'.repeat(22);
const REV = 'b'.repeat(22);

function client(body: unknown, status = 200) {
  const fetch = jest.fn(async (_url: string, _init?: { method?: string; body?: string }) => ({ ok: status >= 200 && status < 300, status, json: async () => body }));
  const api = new PublicWorldApiClient({ baseUrl: 'https://api', fetch: fetch as never });
  return { compose: api.compose, field: api.field, fetch };
}
const sent = (fetch: jest.Mock) => ({ url: fetch.mock.calls[0][0] as string, method: fetch.mock.calls[0][1]?.method, body: JSON.parse(fetch.mock.calls[0][1]?.body ?? 'null') });

const item = (position: number, over: Record<string, unknown> = {}) => ({
  position, role: 'YOUR_MESSAGE', sessionPosition: position, message: 1, emphasized: false, gapBefore: false, text: `t${position}`, ...over,
});
const page = (items: unknown[], over: Record<string, unknown> = {}) => ({
  state: 'EDITING', revision: 3, outcome: 'RESOLVED', itemCount: items.length, page: 1, pageCount: 1, items, ...over,
});

describe('S8A-05 CP2 — the source, by reference only', () => {
  const choice = { sessionId: id(9), firstPosition: 1, lastPosition: 12, includeQandeelReplies: true, excludedMessagePositions: [7], emphasizedMessagePositions: [3] };

  it('sends positions to its own route, and nothing else', async () => {
    const { compose, fetch } = client({ outcome: 'CREATED', revision: 1 });
    await expect(compose!.setConversationSource(id(1), 0, choice)).resolves.toEqual(yes({ outcome: 'CREATED', revision: 1 }));
    expect(sent(fetch)).toEqual({ url: `https://api/public/compose/drafts/${id(1)}/source/conversation`, method: 'PUT',
      body: { expectedRevision: 0, ...choice } });
  });

  it('a source refusal is a definite answer; an unknown outcome or an extra key is not', async () => {
    await expect(client({ outcome: 'TOO_LARGE', revision: null }).compose!.setConversationSource(id(1), 0, choice)).resolves.toEqual(yes({ outcome: 'TOO_LARGE', revision: null }));
    await expect(client({ outcome: 'PUBLISHED', revision: 1 }).compose!.setConversationSource(id(1), 0, choice)).resolves.toEqual(NO);
    await expect(client({ outcome: 'SAVED', revision: 1, text: 'x' }).compose!.setConversationSource(id(1), 0, choice)).resolves.toEqual(NO);
    await expect(client({}, 503).compose!.setConversationSource(id(1), 0, choice)).resolves.toEqual(NO);
  });

  it('a «فهم قنديل» item goes to the Understanding module by its opaque ref at the revision shown', async () => {
    const { compose, fetch } = client({ outcome: 'CREATED', draftRevision: 1 });
    await expect(compose!.setUnderstandingSource(REF, REV, id(2), 0)).resolves.toEqual(yes({ outcome: 'CREATED', revision: 1 }));
    expect(sent(fetch)).toEqual({ url: `https://api/understanding/items/${REF}/public-topic`, method: 'POST', body: { draftId: id(2), expectedRevision: 0, revision: REV } });
    await expect(client({}, 409).compose!.setUnderstandingSource(REF, REV, id(2), 0)).resolves.toEqual(yes({ outcome: 'CHANGED', revision: null }));
    await expect(client({}, 404).compose!.setUnderstandingSource(REF, REV, id(2), 0)).resolves.toEqual(yes({ outcome: 'ABSENT', revision: null }));
    await expect(client({ outcome: 'CREATED', revision: 1 }).compose!.setUnderstandingSource(REF, REV, id(2), 0)).resolves.toEqual(NO);
  });

  it('clear and acknowledge are their own commands', async () => {
    const cleared = client({ outcome: 'SAVED', revision: 4 });
    await expect(cleared.compose!.clearSource(id(1), 3)).resolves.toEqual(yes({ outcome: 'SAVED', revision: 4 }));
    expect(sent(cleared.fetch)).toEqual({ url: `https://api/public/compose/drafts/${id(1)}/source/clear`, method: 'POST', body: { expectedRevision: 3 } });
    const acknowledged = client({ outcome: 'ACKNOWLEDGED', revision: 4 });
    await expect(acknowledged.compose!.acknowledgeSource(id(1), 4)).resolves.toEqual(yes('ACKNOWLEDGED'));
    expect(sent(acknowledged.fetch)).toEqual({ url: `https://api/public/compose/drafts/${id(1)}/source/acknowledge`, method: 'POST', body: { revision: 4 } });
    await expect(client({ outcome: 'ACKNOWLEDGED' }).compose!.acknowledgeSource(id(1), 4)).resolves.toEqual(NO);
  });
});

describe('S8A-05 CP2 — reading a draft’s source and items, strictly', () => {
  it('reads each source kind exactly, and refuses anything else', async () => {
    const conversation = { kind: 'CONVERSATION', sessionId: id(9), firstPosition: 1, lastPosition: 4, includeQandeelReplies: false,
      excludedMessagePositions: [], emphasizedMessagePositions: [1] };
    await expect(client({ state: 'CURRENT', revision: 2, source: conversation, acknowledged: false }).compose!.source(id(1)))
      .resolves.toEqual(yes({ kind: 'SOURCE', revision: 2, source: conversation, acknowledged: false }));
    await expect(client({ state: 'CURRENT', revision: 2, source: { kind: 'UNDERSTANDING', ref: REF, revision: REV }, acknowledged: true }).compose!.source(id(1)))
      .resolves.toEqual(yes({ kind: 'SOURCE', revision: 2, source: { kind: 'UNDERSTANDING', ref: REF, revision: REV }, acknowledged: true }));
    await expect(client({ state: 'UNAVAILABLE' }).compose!.source(id(1))).resolves.toEqual(yes({ kind: 'ABSENT' }));
    // A hypothesis id, a text or a speaker never reaches the device as a source.
    await expect(client({ state: 'CURRENT', revision: 2, source: { kind: 'UNDERSTANDING', ref: id(5), revision: REV }, acknowledged: true }).compose!.source(id(1))).resolves.toEqual(NO);
    await expect(client({ state: 'CURRENT', revision: 2, source: { ...conversation, text: 'x' }, acknowledged: false }).compose!.source(id(1))).resolves.toEqual(NO);
  });

  it('reads one page of at most 50 items, in ascending order, with their exact keys', async () => {
    const { compose, fetch } = client(page([item(1), item(2, { role: 'QANDEEL_REPLY', message: 2, gapBefore: true })], { page: 2, pageCount: 2, itemCount: 52 }));
    const read = await compose!.items(id(1), 2);
    expect(sent(fetch).url).toBe(`https://api/public/compose/drafts/${id(1)}/items?page=2`);
    expect(read).toEqual(yes({ kind: 'PAGE', page: expect.objectContaining({ page: 2, pageCount: 2, itemCount: 52 }) }));
    expect(read.kind === 'ANSWER' && read.value.kind === 'PAGE' ? read.value.page.items.map((i) => [i.role, i.gapBefore]) : null)
      .toEqual([['YOUR_MESSAGE', false], ['QANDEEL_REPLY', true]]);
    await expect(client(page([item(2), item(1)])).compose!.items(id(1), 1)).resolves.toEqual(NO);
    await expect(client(page([item(1, { role: 'MEMORY' })])).compose!.items(id(1), 1)).resolves.toEqual(NO);
    await expect(client(page([item(1, { score: 1 })])).compose!.items(id(1), 1)).resolves.toEqual(NO);
    await expect(client(page(Array.from({ length: 51 }, (_, n) => item(n + 1)))).compose!.items(id(1), 1)).resolves.toEqual(NO);
    await expect(client(page([item(1)])).compose!.items(id(1), 2)).resolves.toEqual(NO);
    await expect(client(page([])).compose!.items(id(1), 1001)).resolves.toEqual(NO);
  });
});

describe('S8A-05 CP2 — a reader’s page of a served topic', () => {
  const served = (items: unknown[], over: Record<string, unknown> = {}) => ({ state: 'SERVED', itemCount: items.length, page: 1, pageCount: 1, items, ...over });
  const reader = (ordinal: number, over: Record<string, unknown> = {}) => ({
    ordinal, kind: 'SOURCE_CONTENT', text: `t${ordinal}`, role: 'YOUR_MESSAGE', message: 1, emphasized: false, gapBefore: false, ...over,
  });

  it('reads its sealed speakers, and refuses a position in the author’s conversation', async () => {
    const { field, fetch } = client(served([reader(1), reader(2, { kind: 'ANALYSIS', role: 'QANDEEL_REPLY', message: 2 })]));
    await expect(field!.items(id(7), 1)).resolves.toEqual(yes({ kind: 'PAGE', page: { itemCount: 2, page: 1, pageCount: 1, items: [
      { ordinal: 1, kind: 'SOURCE_CONTENT', text: 't1', role: 'YOUR_MESSAGE', message: 1, emphasized: false, gapBefore: false },
      { ordinal: 2, kind: 'ANALYSIS', text: 't2', role: 'QANDEEL_REPLY', message: 2, emphasized: false, gapBefore: false },
    ] } }));
    expect(sent(fetch)).toMatchObject({ url: `https://api/public/compose/topics/${id(7)}/items?page=1`, method: 'GET' });
    await expect(client(served([reader(1, { sessionPosition: 4 })])).field!.items(id(7), 1)).resolves.toEqual(NO);
    await expect(client(served([{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'x' }])).field!.items(id(7), 1)).resolves.toEqual(yes({ kind: 'PAGE',
      page: { itemCount: 1, page: 1, pageCount: 1, items: [{ ordinal: 1, kind: 'SOURCE_CONTENT', text: 'x' }] } }));
    await expect(client({ state: 'UNAVAILABLE' }).field!.items(id(7), 1)).resolves.toEqual(yes({ kind: 'ABSENT' }));
  });
});
