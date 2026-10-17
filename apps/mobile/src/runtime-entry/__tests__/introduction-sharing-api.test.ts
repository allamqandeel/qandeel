/**
 * S6-06 (CP2) — the two strict clients of the CP1 routes: exact paths and bodies, fail-closed decoding (an extra field,
 * an unknown word, the other person's series or a type that does not fit its stage makes the answer unusable), and a
 * rendition handed back only as an in-memory `data:` URI, fetched `no-store`.
 */
import {
  IntroductionContinuationApiClient, IntroductionSharingApiClient, type IntroductionSharingFetch,
} from '..';
import { decodeIntroductionDisclosures, decodeIntroductionShares } from '../introduction-sharing-api';
import { decodeIntroductionParticipation } from '../introduction-continuation-api';

const BASE = 'https://api.example.test';
const W = '51111111-1111-4111-8111-111111111111';
const C = 'c0000000-0000-4000-8000-000000000001';
const S = '57777777-7777-4777-8777-777777777777';
const H1 = '58888888-8888-4888-8888-888888888881';
const H2 = '58888888-8888-4888-8888-888888888882';
const M = '56666666-6666-4666-8666-666666666661';
const V = '55555555-5555-4555-8555-555555555551';
const AT = '2026-10-17T10:00:00.123456+00:00';

type Call = { url: string; init?: Parameters<IntroductionSharingFetch>[1] };
function wire(answers: { status?: number; body?: unknown; blob?: Blob; throws?: boolean }[]) {
  const calls: Call[] = [];
  const fetch: IntroductionSharingFetch = async (url, init) => {
    calls.push({ url, init });
    const next = answers.shift() ?? { status: 503 };
    if (next.throws) throw new Error('network');
    const status = next.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => next.body, blob: async () => next.blob ?? ({} as Blob) };
  };
  return { calls, fetch };
}

const text = (over: Record<string, unknown> = {}) => ({
  kind: 'TEXT', mine: true, materialId: M, versionId: V, resourceType: 'FULL_NAME', fieldKey: null, text: 'Sami Fouad', stage: null, handle: null, seriesId: null,
  establishedAt: AT, ...over,
});
const image = (over: Record<string, unknown> = {}) => ({
  kind: 'IMAGE', mine: false, materialId: M, versionId: V, resourceType: 'PARTIAL_IMAGE', fieldKey: null, text: null, stage: 1, handle: H1, seriesId: null,
  establishedAt: AT, ...over,
});
const ready = (over: Record<string, unknown> = {}) => ({
  outcome: 'READY', introductionState: 'ACTIVE', items: [], myPhoto: null, myDisplayedVersionId: null, otherDisplayName: null, ...over,
});

describe('S6-06 — the sharing client', () => {
  it('reads one World\'s disclosures strictly', async () => {
    const { calls, fetch } = wire([{ body: ready({ items: [text(), image({ versionId: '55555555-5555-4555-8555-555555555552', materialId: '56666666-6666-4666-8666-666666666662' })] }) }]);
    const client = new IntroductionSharingApiClient({ baseUrl: BASE, fetch });
    const read = await client.disclosures(W);
    expect(calls[0].url).toBe(`${BASE}/introductions/worlds/${W}/disclosures`);
    expect(calls[0].init?.method).toBe('GET');
    expect(read.kind).toBe('READY');
    if (read.kind !== 'READY') return;
    expect(read.view.items).toHaveLength(2);
    expect(read.view.items[0]).toMatchObject({ kind: 'TEXT', textType: 'FULL_NAME', fieldKey: null, text: 'Sami Fouad' });
  });

  it('refuses a doubtful view: an extra field, the other person\'s series, a stage that does not fit its type, a key without its kind', () => {
    expect(decodeIntroductionDisclosures(ready())).not.toBeNull();
    expect(decodeIntroductionDisclosures({ ...ready(), extra: 1 })).toBeNull();
    expect(decodeIntroductionDisclosures(ready({ items: [image({ seriesId: S })] }))).toBeNull();
    expect(decodeIntroductionDisclosures(ready({ items: [image({ stage: 3 })] }))).toBeNull();
    expect(decodeIntroductionDisclosures(ready({ items: [image({ stage: 3, resourceType: 'FULL_IMAGE' })] }))).not.toBeNull();
    expect(decodeIntroductionDisclosures(ready({ items: [text({ fieldKey: 'work_field' })] }))).toBeNull();
    expect(decodeIntroductionDisclosures(ready({ items: [text({ resourceType: 'DEEPER_PERSONAL_FIELD', fieldKey: 'street' })] }))).toBeNull();
    expect(decodeIntroductionDisclosures(ready({ items: [text({ resourceType: 'DEEPER_PERSONAL_FIELD', fieldKey: 'hometown_city' })] }))).not.toBeNull();
    expect(decodeIntroductionDisclosures(ready({ items: [image({ mine: true })] }))).toBeNull();
    // Unshared stages only while the Introduction lives, and in order.
    const photo = { seriesId: S, state: 'READY', unsharedStages: [{ stage: 1, handle: H1 }, { stage: 2, handle: H2 }] };
    expect(decodeIntroductionDisclosures(ready({ myPhoto: photo }))).not.toBeNull();
    expect(decodeIntroductionDisclosures(ready({ myPhoto: photo, introductionState: 'ENDED' }))).toBeNull();
    expect(decodeIntroductionDisclosures(ready({ myPhoto: { ...photo, unsharedStages: [{ stage: 2, handle: H2 }, { stage: 1, handle: H1 }] } }))).toBeNull();
    expect(decodeIntroductionDisclosures({ outcome: 'UNAVAILABLE' })).toBeNull();
  });

  it('a text share is exactly { commandId, resourceType, fieldKey, text }; each answer word is the server\'s', async () => {
    const { calls, fetch } = wire([
      { body: { outcome: 'DISCLOSED', materialId: M, disclosedAt: AT } },
      { body: { outcome: 'CONTACT_REFUSED' } },
      { body: { outcome: 'NOT_AVAILABLE_NOW' } },
      { status: 400, body: { outcome: 'INVALID_REQUEST' } },
      { status: 503 },
      { throws: true },
      { body: { outcome: 'DISCLOSED' } },
    ]);
    const client = new IntroductionSharingApiClient({ baseUrl: BASE, fetch });
    expect(await client.shareText(W, C, 'DEEPER_PERSONAL_FIELD', 'hometown_city', 'Mansoura')).toEqual({ kind: 'DISCLOSED', materialId: M, disclosedAt: AT });
    expect(calls[0].url).toBe(`${BASE}/introductions/worlds/${W}/disclosures/text`);
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ commandId: C, resourceType: 'DEEPER_PERSONAL_FIELD', fieldKey: 'hometown_city', text: 'Mansoura' });
    expect((await client.shareText(W, C, 'FULL_NAME', null, 'x')).kind).toBe('CONTACT_REFUSED');
    expect((await client.shareText(W, C, 'FULL_NAME', null, 'x')).kind).toBe('NOT_AVAILABLE_NOW');
    expect((await client.shareText(W, C, 'FULL_NAME', null, 'x')).kind).toBe('INVALID');
    expect((await client.shareText(W, C, 'FULL_NAME', null, 'x')).kind).toBe('FAILED');
    expect((await client.shareText(W, C, 'FULL_NAME', null, 'x')).kind).toBe('OFFLINE');
    expect((await client.shareText(W, C, 'FULL_NAME', null, 'x')).kind).toBe('FAILED');
  });

  it('a photo goes as its raw bytes with its own type; the server\'s refusal is one word', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]);
    const { calls, fetch } = wire([
      { body: { outcome: 'READY', seriesId: S } },
      { body: { outcome: 'IMAGE_REFUSED', reason: 'TOO_SMALL' } },
      { body: { outcome: 'IMAGE_REFUSED', reason: 'SOMETHING_NEW' } },
      { body: { outcome: 'NOT_AVAILABLE_NOW' } },
    ]);
    const client = new IntroductionSharingApiClient({ baseUrl: BASE, fetch });
    expect(await client.uploadImage(W, C, bytes, 'image/jpeg')).toEqual({ kind: 'READY', seriesId: S });
    expect(calls[0].url).toBe(`${BASE}/introductions/worlds/${W}/image/${C}`);
    expect(calls[0].init?.body).toBe(bytes);
    expect(calls[0].init?.headers?.['Content-Type']).toBe('image/jpeg');
    expect(await client.uploadImage(W, C, bytes, 'image/jpeg')).toEqual({ kind: 'IMAGE_REFUSED', reason: 'TOO_SMALL' });
    expect(await client.uploadImage(W, C, bytes, 'image/jpeg')).toEqual({ kind: 'IMAGE_REFUSED', reason: 'OTHER' });
    expect((await client.uploadImage(W, C, bytes, 'image/jpeg')).kind).toBe('NOT_AVAILABLE_NOW');
  });

  it('a stage, a removal, a grant and a revoke are exactly their bodies', async () => {
    const { calls, fetch } = wire([
      { body: { outcome: 'RETIRED' } }, { body: { outcome: 'REMOVED' } }, { body: { outcome: 'NOT_SHARED' } }, { body: { outcome: 'REVOKED' } },
    ]);
    const client = new IntroductionSharingApiClient({ baseUrl: BASE, fetch });
    expect((await client.shareStage(W, C, S, 2)).kind).toBe('RETIRED');
    expect((await client.removeImage(W, C, S)).kind).toBe('REMOVED');
    expect((await client.grantDisplayName(W, C, V)).kind).toBe('NOT_SHARED');
    expect((await client.revokeDisplayName(W, C)).kind).toBe('REVOKED');
    expect(calls.map((c) => [c.url.slice(BASE.length), JSON.parse(c.init?.body as string)])).toEqual([
      [`/introductions/worlds/${W}/image-stages`, { commandId: C, seriesId: S, stage: 2 }],
      [`/introductions/worlds/${W}/image-removal`, { commandId: C, seriesId: S }],
      [`/introductions/worlds/${W}/display-name/grant`, { commandId: C, versionId: V }],
      [`/introductions/worlds/${W}/display-name/revoke`, { commandId: C }],
    ]);
  });

  it('a rendition comes back only as an in-memory data: URI, asked for no-store; a refusal is UNAVAILABLE', async () => {
    const { calls, fetch } = wire([{ blob: {} as Blob }, { status: 404 }, { status: 503 }, { throws: true }, { blob: {} as Blob }]);
    const toDataUri = jest.fn(async () => 'data:application/octet-stream;base64,/9j/4AAQ');
    const client = new IntroductionSharingApiClient({ baseUrl: BASE, fetch, toDataUri });
    expect(await client.media(W, H1)).toEqual({ kind: 'DRAWABLE', dataUri: 'data:image/jpeg;base64,/9j/4AAQ' });
    expect(calls[0].url).toBe(`${BASE}/introductions/worlds/${W}/media/${H1}`);
    expect(calls[0].init?.cache).toBe('no-store');
    expect(calls[0].init?.headers).toEqual({ Accept: 'image/jpeg' });
    expect((await client.media(W, H1)).kind).toBe('UNAVAILABLE');
    expect((await client.media(W, H1)).kind).toBe('FAILED');
    expect((await client.media(W, H1)).kind).toBe('OFFLINE');
    toDataUri.mockResolvedValueOnce('https://example.test/not-a-data-uri');
    expect((await client.media(W, H1)).kind).toBe('FAILED');
  });

  it('the reader\'s own shares, per World, strictly', () => {
    const share = { materialId: M, versionId: V, resourceType: 'FULL_NAME', fieldKey: null, text: 'Sami', seriesId: null, stage: null, displayed: true, establishedAt: AT };
    const world = { worldId: W, introductionState: 'ENDED', otherFirstName: 'Reem', shares: [share] };
    expect(decodeIntroductionShares({ outcome: 'READY', worlds: [world] })).toHaveLength(1);
    expect(decodeIntroductionShares({ outcome: 'READY', worlds: [{ ...world, shares: [{ ...share, resourceType: 'CONTACT_METHOD' }] }] })).toBeNull();
    const photo = { ...share, resourceType: 'FULL_IMAGE', text: null, seriesId: S, stage: 3, displayed: false };
    expect(decodeIntroductionShares({ outcome: 'READY', worlds: [{ ...world, shares: [photo] }] })).toHaveLength(1);
    expect(decodeIntroductionShares({ outcome: 'READY', worlds: [{ ...world, shares: [{ ...photo, seriesId: null }] }] })).toBeNull();
    expect(decodeIntroductionShares({ outcome: 'READY', worlds: [world, world] })).toBeNull();
  });
});

describe('S6-06 — the continuation client', () => {
  it('SUCCESS: the reader\'s own state only; approve and withdraw are exactly their bodies', async () => {
    const { calls, fetch } = wire([
      { body: { outcome: 'TRANSITION', versionId: V, myState: 'NONE', expectedEventId: null } },
      { body: { outcome: 'NO_TRANSITION' } },
      { body: { outcome: 'TRANSITION', versionId: V, myState: 'APPROVED', expectedEventId: null } },
      { body: { outcome: 'APPROVED', eventId: M } },
      { body: { outcome: 'COMPLETED' } },
      { body: { outcome: 'WITHDRAWN', eventId: M } },
    ]);
    const client = new IntroductionContinuationApiClient({ baseUrl: BASE, fetch: fetch as never });
    expect(await client.success(W)).toEqual({ kind: 'TRANSITION', versionId: V, myState: 'NONE', expectedEventId: null });
    expect((await client.success(W)).kind).toBe('NO_TRANSITION');
    // An approval always rests on the reader's own act: doubtful without it.
    expect((await client.success(W)).kind).toBe('FAILED');
    expect(await client.approve(W, C, V, null)).toEqual({ kind: 'APPROVED', eventId: M });
    expect((await client.approve(W, C, V, null)).kind).toBe('COMPLETED');
    expect(await client.withdraw(W, C, V, M)).toEqual({ kind: 'WITHDRAWN', eventId: M });
    expect(calls.slice(3).map((c) => [c.url.slice(BASE.length), JSON.parse(c.init?.body as string)])).toEqual([
      [`/introductions/worlds/${W}/success/approval`, { commandId: C, versionId: V, expectedEventId: null }],
      [`/introductions/worlds/${W}/success/approval`, { commandId: C, versionId: V, expectedEventId: null }],
      [`/introductions/worlds/${W}/success/withdrawal`, { commandId: C, versionId: V, expectedEventId: M }],
    ]);
  });

  it('participation is coherent with the frozen lifecycle; a resume is exactly its body', async () => {
    expect(decodeIntroductionParticipation({ outcome: 'READY', state: 'PAUSED', pauseReason: 'POST_INTRODUCTION', expectedEventId: M })).not.toBeNull();
    expect(decodeIntroductionParticipation({ outcome: 'READY', state: 'PAUSED', pauseReason: null, expectedEventId: M })).toBeNull();
    expect(decodeIntroductionParticipation({ outcome: 'READY', state: 'ACTIVE', pauseReason: 'USER_PAUSED', expectedEventId: M })).toBeNull();
    expect(decodeIntroductionParticipation({ outcome: 'READY', state: 'OFF', pauseReason: null, expectedEventId: null })).not.toBeNull();
    expect(decodeIntroductionParticipation({ outcome: 'READY', state: 'GONE', pauseReason: null, expectedEventId: null })).toBeNull();
    const { calls, fetch } = wire([{ body: { outcome: 'NOT_AVAILABLE_NOW' } }, { body: { outcome: 'REACTIVATED', state: 'ACTIVE' } }]);
    const client = new IntroductionContinuationApiClient({ baseUrl: BASE, fetch: fetch as never });
    expect((await client.resume(C, M, null)).kind).toBe('NOT_AVAILABLE_NOW');
    expect((await client.resume(C, M, 'MANUAL_MY_WORLD_ENTRY')).kind).toBe('REACTIVATED');
    expect(calls.map((c) => [c.url.slice(BASE.length), JSON.parse(c.init?.body as string)])).toEqual([
      ['/introductions/participation/resume', { commandId: C, expectedEventId: M, entryChannel: null }],
      ['/introductions/participation/resume', { commandId: C, expectedEventId: M, entryChannel: 'MANUAL_MY_WORLD_ENTRY' }],
    ]);
  });
});
