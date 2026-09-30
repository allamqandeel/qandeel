/**
 * W3-MEGA-U — the Understanding transport decodes STRICTLY: nothing the Product view model does not name reaches a
 * surface — no number, score, band, id, status or reasoning field — and it never sends a user id.
 */
import { UnderstandingApiClient, type RuntimeHttpFetch } from '../../runtime-entry';

const REF = 'AAAAAAAAAAAAAAAAAAAAAA';
const REV = 'rrrrrrrrrrrrrrrrrrrrr1';
const summary = { ref: REF, revision: REV, theme: 'WORK', summary: 'You prepare early.', confidence: 'CLEAR' };
const detail = { ...summary, evidence: ['x'], contradictions: [], alternatives: [], unresolved: [], evolution: [{ kind: 'FIRST_SEEN', at: '2026-09-30T10:00:00.123+00:00' }] };

function client(answer: { status: number; body?: unknown }) {
  const requests: { url: string; method?: string; body?: string }[] = [];
  const fetch: RuntimeHttpFetch = async (url, init) => {
    requests.push({ url, method: init?.method, body: init?.body });
    return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, json: async () => answer.body };
  };
  return { requests, api: new UnderstandingApiClient({ baseUrl: 'https://api.example.test/v1', fetch }) };
}

describe('UnderstandingApiClient', () => {
  it('reads the exact Product shapes', async () => {
    await expect(client({ status: 200, body: { items: [summary] } }).api.readItems()).resolves.toEqual({ kind: 'READ', items: [summary] });
    await expect(client({ status: 200, body: detail }).api.readItem(REF)).resolves.toEqual({ kind: 'READ', view: detail });
  });

  it.each([
    ['a numeric confidence', { items: [{ ...summary, confidence: 0.8 }] }],
    ['an added score', { items: [{ ...summary, score: 80 }] }],
    ['an internal id', { items: [{ ...summary, id: '4f1c9a70-0b7a-4f55-9d3e-2a8f6b1c0d11' }] }],
    ['a raw status', { items: [{ ...summary, status: 'SUPPORTED' }] }],
    ['a reasoning field', { items: [{ ...summary, reasoning: 'because' }] }],
    ['an invented state', { items: [{ ...summary, confidence: 'CERTAIN' }] }],
    ['a raw id as the ref', { items: [{ ...summary, ref: '4f1c9a70-0b7a-4f55-9d3e-2a8f6b1c0d11' }] }],
    ['category tabs', { items: [], tabs: ['WORK'] }],
    ['a duplicated item', { items: [summary, summary] }],
  ])('refuses %s as unavailable', async (_name, body) => {
    await expect(client({ status: 200, body }).api.readItems()).resolves.toEqual({ kind: 'UNAVAILABLE' });
  });

  it('refuses a widened detail, and one answering for another item', async () => {
    await expect(client({ status: 200, body: { ...detail, rationale: 'x' } }).api.readItem(REF)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    await expect(client({ status: 200, body: { ...detail, evidence: [{ text: 'x', weight: 1 }] } }).api.readItem(REF)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    await expect(client({ status: 200, body: detail }).api.readItem('BBBBBBBBBBBBBBBBBBBBBB')).resolves.toEqual({ kind: 'UNAVAILABLE' });
    await expect(client({ status: 404, body: {} }).api.readItem(REF)).resolves.toEqual({ kind: 'GONE' });
  });

  it('talk sends the revision seen and nothing else; the answer is typed, never interpreted', async () => {
    const opened = client({ status: 204 });
    await expect(opened.api.openDiscussion(REF, REV)).resolves.toEqual({ kind: 'OPENED' });
    expect(opened.requests).toEqual([{ url: `https://api.example.test/v1/understanding/items/${REF}/discussion`, method: 'POST', body: JSON.stringify({ revision: REV }) }]);
    await expect(client({ status: 409 }).api.openDiscussion(REF, REV)).resolves.toEqual({ kind: 'CHANGED' });
    await expect(client({ status: 404 }).api.openDiscussion(REF, REV)).resolves.toEqual({ kind: 'GONE' });
    await expect(client({ status: 503 }).api.openDiscussion(REF, REV)).resolves.toEqual({ kind: 'FAILED' });
    const refused = client({ status: 204 });
    await expect(refused.api.openDiscussion('not-a-ref', REV)).resolves.toEqual({ kind: 'GONE' });
    expect(refused.requests).toEqual([]);
  });
});
