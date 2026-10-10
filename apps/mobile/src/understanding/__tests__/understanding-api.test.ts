/**
 * W3-MEGA-U — the Understanding transport decodes STRICTLY: nothing the Product view model does not name reaches a
 * surface — no number, score, band, id, status or reasoning field — and it never sends a user id.
 */
import { UnderstandingApiClient, type RuntimeHttpFetch } from '../../runtime-entry';

const REF = 'AAAAAAAAAAAAAAAAAAAAAA';
const REV = 'rrrrrrrrrrrrrrrrrrrrr1';
const summary = { ref: REF, revision: REV, theme: 'WORK', summary: 'You prepare early.', evidenceChange: 'NONE', confidence: 'CLEAR', underReview: false };
// INTEL-TM-01: the withheld shapes — no statement, no text, never Clear or Taking shape.
const withheld = { ...summary, summary: null, evidenceChange: 'REVIEW_PENDING', confidence: 'NEEDS_MORE' };
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

  it('INTEL-TM-01 — accepts a withheld item only without its statement and without any text', async () => {
    const unsupported = { ...withheld, ref: 'BBBBBBBBBBBBBBBBBBBBBB', evidenceChange: 'NO_REMAINING_SUPPORT' };
    const contested = { ...withheld, ref: 'CCCCCCCCCCCCCCCCCCCCCC', confidence: 'MIXED', underReview: true };
    await expect(client({ status: 200, body: { items: [withheld, unsupported, contested] } }).api.readItems()).resolves.toEqual({ kind: 'READ', items: [withheld, unsupported, contested] });
    const withheldDetail = { ...withheld, evidence: [], contradictions: [], alternatives: [], unresolved: [], evolution: detail.evolution };
    await expect(client({ status: 200, body: withheldDetail }).api.readItem(REF)).resolves.toEqual({ kind: 'READ', view: withheldDetail });
    for (const leaked of [{ evidence: ['x'] }, { contradictions: ['x'] }, { alternatives: ['x'] }, { unresolved: ['x'] }, { summary: 'You prepare early.' }]) {
      await expect(client({ status: 200, body: { ...withheldDetail, ...leaked } }).api.readItem(REF)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    }
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
    ['an item under review that is not Mixed', { items: [{ ...summary, underReview: true }] }],
    ['a missing evidence change', { items: [{ ref: REF, revision: REV, theme: 'WORK', summary: 'x', confidence: 'CLEAR', underReview: false }] }],
    ['an invented evidence change', { items: [{ ...summary, evidenceChange: 'RESTORED' }] }],
    ['a relied-on item without a statement', { items: [{ ...summary, summary: null }] }],
    ['a withheld item carrying its statement', { items: [{ ...withheld, summary: 'You prepare early.' }] }],
    ['a withheld item shown as Clear', { items: [{ ...withheld, confidence: 'CLEAR' }] }],
    ['a withheld item shown as Taking shape', { items: [{ ...withheld, confidence: 'TAKING_SHAPE' }] }],
    ['an empty withheld statement instead of null', { items: [{ ...withheld, summary: '' }] }],
  ])('refuses %s as unavailable', async (_name, body) => {
    await expect(client({ status: 200, body }).api.readItems()).resolves.toEqual({ kind: 'UNAVAILABLE' });
  });

  it('refuses a widened detail, and one answering for another item', async () => {
    await expect(client({ status: 200, body: { ...detail, rationale: 'x' } }).api.readItem(REF)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    await expect(client({ status: 200, body: { ...detail, evidence: [{ text: 'x', weight: 1 }] } }).api.readItem(REF)).resolves.toEqual({ kind: 'UNAVAILABLE' });
    await expect(client({ status: 200, body: detail }).api.readItem('BBBBBBBBBBBBBBBBBBBBBB')).resolves.toEqual({ kind: 'UNAVAILABLE' });
    await expect(client({ status: 404, body: {} }).api.readItem(REF)).resolves.toEqual({ kind: 'GONE' });
  });

  it('U3 — a disagreement sends the command and the revision seen, and NO words; its answers are typed', async () => {
    const COMMAND = '5b2f6c3e-7a1d-4c2e-9f00-1234567890ab';
    const REV_2 = 'rrrrrrrrrrrrrrrrrrrrr2';
    const recorded = client({ status: 200, body: { underReview: true, revision: REV_2 } });
    await expect(recorded.api.disagree(REF, COMMAND, REV)).resolves.toEqual({ kind: 'UNDER_REVIEW', revision: REV_2 });
    expect(recorded.requests).toEqual([{ url: `https://api.example.test/v1/understanding/items/${REF}/disagreement`, method: 'POST', body: JSON.stringify({ commandId: COMMAND, revision: REV }) }]);
    await expect(client({ status: 409, body: { code: 'UNDERSTANDING_ITEM_CHANGED' } }).api.disagree(REF, COMMAND, REV)).resolves.toEqual({ kind: 'CHANGED' });
    await expect(client({ status: 409, body: { code: 'UNDERSTANDING_COMMAND_CONFLICT' } }).api.disagree(REF, COMMAND, REV)).resolves.toEqual({ kind: 'CONFLICT' });
    await expect(client({ status: 404, body: {} }).api.disagree(REF, COMMAND, REV)).resolves.toEqual({ kind: 'GONE' });
    await expect(client({ status: 503, body: {} }).api.disagree(REF, COMMAND, REV)).resolves.toEqual({ kind: 'FAILED' });
    await expect(client({ status: 200, body: { underReview: true, revision: REV_2, score: 1 } }).api.disagree(REF, COMMAND, REV)).resolves.toEqual({ kind: 'FAILED' });
    const refused = client({ status: 200 });
    await expect(refused.api.disagree(REF, 'not-a-command', REV)).resolves.toEqual({ kind: 'GONE' });
    expect(refused.requests).toEqual([]);
  });

  it('W3-CORR-U — a resolution sends the command and the revision seen, and NO reason; its answers are typed', async () => {
    const COMMAND = '6c3f7d4e-8b2e-4d3f-a011-234567890abc';
    const resolved = client({ status: 200, body: { underReview: false, revision: REV } });
    await expect(resolved.api.resolveDisagreement(REF, COMMAND, REV)).resolves.toEqual({ kind: 'RESOLVED', revision: REV });
    expect(resolved.requests).toEqual([{ url: `https://api.example.test/v1/understanding/items/${REF}/disagreement/resolve`, method: 'POST', body: JSON.stringify({ commandId: COMMAND, revision: REV }) }]);
    await expect(client({ status: 409, body: { message: { code: 'UNDERSTANDING_ITEM_CHANGED' } } }).api.resolveDisagreement(REF, COMMAND, REV)).resolves.toEqual({ kind: 'CHANGED' });
    await expect(client({ status: 409, body: { code: 'UNDERSTANDING_NOT_UNDER_REVIEW' } }).api.resolveDisagreement(REF, COMMAND, REV)).resolves.toEqual({ kind: 'NOT_UNDER_REVIEW' });
    await expect(client({ status: 409, body: { code: 'UNDERSTANDING_COMMAND_CONFLICT' } }).api.resolveDisagreement(REF, COMMAND, REV)).resolves.toEqual({ kind: 'CONFLICT' });
    await expect(client({ status: 409, body: { code: 'SOMETHING_ELSE' } }).api.resolveDisagreement(REF, COMMAND, REV)).resolves.toEqual({ kind: 'FAILED' });
    await expect(client({ status: 404, body: {} }).api.resolveDisagreement(REF, COMMAND, REV)).resolves.toEqual({ kind: 'GONE' });
    await expect(client({ status: 503, body: {} }).api.resolveDisagreement(REF, COMMAND, REV)).resolves.toEqual({ kind: 'FAILED' });
    // Only the exact answer: still under review, a widened body or a reason is not a resolution.
    await expect(client({ status: 200, body: { underReview: true, revision: REV } }).api.resolveDisagreement(REF, COMMAND, REV)).resolves.toEqual({ kind: 'FAILED' });
    await expect(client({ status: 200, body: { underReview: false, revision: REV, reason: 'USER_CONFIRMED_CURRENT_INTERPRETATION' } }).api.resolveDisagreement(REF, COMMAND, REV)).resolves.toEqual({ kind: 'FAILED' });
    const refused = client({ status: 200 });
    await expect(refused.api.resolveDisagreement(REF, 'not-a-command', REV)).resolves.toEqual({ kind: 'GONE' });
    expect(refused.requests).toEqual([]);
  });

  it('W3-CORR-U — the later agreement is a known evolution fact', async () => {
    const resolved = { ...detail, evolution: [{ kind: 'YOU_RESOLVED_DISAGREEMENT', at: '2026-10-01T10:00:00Z' }, { kind: 'YOU_DISAGREED', at: '2026-09-30T10:00:00Z' }] };
    await expect(client({ status: 200, body: resolved }).api.readItem(REF)).resolves.toEqual({ kind: 'READ', view: resolved });
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
