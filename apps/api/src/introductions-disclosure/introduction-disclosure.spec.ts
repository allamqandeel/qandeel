import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { IntroductionDisclosureRepository } from './introduction-disclosure.repository';
import { IntroductionDisclosureService } from './introduction-disclosure.service';
import { IntroductionMediaErasureWorker } from './introduction-media-erasure.worker';
import type { IntroductionMediaObjectStore } from './introduction-media.store';

jest.setTimeout(60_000);

const W = '0b9b2a52-6a5c-4c3e-9d4a-1f2e3d4c5b6a';
const C = '1c8c3b63-7b6d-4d4f-8e5b-2a3f4e5d6c7b';
const S = '2d7d4c74-8c7e-4e5a-9f6c-3b4a5f6e7d8c';
const H = '3e6e5d85-9d8f-4f6b-8a7d-4c5b6a7f8e9d';
const V = '4f5f6e96-ae90-4a7c-9b8e-5d6c7b8a9fae';
const TOKEN = 'user-token';
const KEYS = [1, 2, 3].map((stage) => ({ stage, storage_key: `intro-media/${['a', 'b', 'c'][stage - 1].repeat(8)}-0000-4000-8000-000000000000` }));

function fakeStore(over: Partial<IntroductionMediaObjectStore> = {}): IntroductionMediaObjectStore & { puts: string[]; removed: string[] } {
  const puts: string[] = [];
  const removed: string[] = [];
  return {
    puts, removed,
    isConfigured: () => true,
    put: async (key) => { puts.push(key); },
    get: async () => Buffer.from([0xff, 0xd8, 0xff]),
    exists: async () => false,
    remove: async (key) => { removed.push(key); },
    listOlderThan: async () => ({ keys: [], next: null }),
    ...over,
  };
}
function repo(over: Partial<Record<keyof IntroductionDisclosureRepository, jest.Mock>> = {}): IntroductionDisclosureRepository & Record<string, jest.Mock> {
  const base: Record<string, jest.Mock> = {
    readDisclosures: jest.fn(), readDisplayNames: jest.fn(), listShares: jest.fn(), shareText: jest.fn(), beginImage: jest.fn(),
    shareStage: jest.fn(), removeImage: jest.fn().mockResolvedValue([{ outcome: 'REMOVED' }]), authorizeMedia: jest.fn(),
    grantDisplayName: jest.fn(), revokeDisplayName: jest.fn(), uploadKeys: jest.fn(), completeImage: jest.fn(), mediaKey: jest.fn(),
    sweep: jest.fn().mockResolvedValue([{ swept_series: 0, released_renditions: 0 }]), claimErasures: jest.fn().mockResolvedValue([]),
    confirmErased: jest.fn().mockResolvedValue([{ outcome: 'CONFIRMED' }]), deferErasure: jest.fn().mockResolvedValue([{ outcome: 'DEFERRED' }]),
    enqueueUnknown: jest.fn().mockResolvedValue([{ enqueued: 0 }]),
    ...over,
  };
  return base as unknown as IntroductionDisclosureRepository & Record<string, jest.Mock>;
}
const photo = () => sharp({ create: { width: 600, height: 800, channels: 3, background: '#7a6a5a' } }).jpeg().toBuffer();
const row = (over: Record<string, unknown> = {}) => ({
  introduction_state: 'ACTIVE', item_kind: 'TEXT', is_mine: true, disclosure_material_id: S, disclosure_version_id: V,
  resource_type: 'FULL_NAME', field_key: null, text_value: 'Mona Adel', image_series_id: null, image_stage: null,
  media_handle: null, series_state: null, established_at: '2026-10-16T10:00:00.000Z', ...over,
});
const names = (over: Record<string, unknown> = {}) => [{ introduction_state: 'ACTIVE', my_displayed_version_id: null, other_display_name: null, ...over }];

describe('S6-06 IntroductionDisclosureService — reading', () => {
  it('decodes the bounded rows and never returns a user id or a storage key', async () => {
    const r = repo({
      readDisclosures: jest.fn().mockResolvedValue([
        row(),
        row({ item_kind: 'IMAGE', is_mine: false, resource_type: 'PARTIAL_IMAGE', text_value: null, image_stage: 1, media_handle: H }),
        row({ item_kind: 'MY_IMAGE_STAGE', is_mine: true, disclosure_material_id: null, disclosure_version_id: null, resource_type: null,
          text_value: null, image_series_id: S, image_stage: 2, media_handle: H, series_state: 'DISCLOSING', established_at: null }),
      ]),
      readDisplayNames: jest.fn().mockResolvedValue(names({ other_display_name: 'Omar Fathy' })),
    });
    const view = await new IntroductionDisclosureService(r, fakeStore()).read(TOKEN, W);
    expect(view).toMatchObject({ outcome: 'READY', introductionState: 'ACTIVE', otherDisplayName: 'Omar Fathy' });
    if (view.outcome !== 'READY') return;
    expect(view.items).toHaveLength(2);
    expect(view.myPhoto).toEqual({ seriesId: S, state: 'DISCLOSING', unsharedStages: [{ stage: 2, handle: H }] });
    expect(JSON.stringify(view)).not.toMatch(/user|storage|intro-media/iu);
  });

  it('fails closed on an extra column, a counterpart row naming a series, or disagreeing states', async () => {
    const service = (rows: unknown[]) => new IntroductionDisclosureService(repo({
      readDisclosures: jest.fn().mockResolvedValue(rows), readDisplayNames: jest.fn().mockResolvedValue(names()),
    }), fakeStore());
    await expect(service([{ ...row(), owner_user_id: W }]).read(TOKEN, W)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service([row({ item_kind: 'IMAGE', is_mine: false, image_stage: 1, media_handle: H, image_series_id: S })]).read(TOKEN, W))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service([row({ introduction_state: 'ENDED' })]).read(TOKEN, W)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('answers UNAVAILABLE for a non-member (no row) and for a malformed World id, without a call', async () => {
    const r = repo({ readDisclosures: jest.fn().mockResolvedValue([]), readDisplayNames: jest.fn().mockResolvedValue([]) });
    expect(await new IntroductionDisclosureService(r, fakeStore()).read(TOKEN, W)).toEqual({ outcome: 'UNAVAILABLE' });
    const none = repo();
    expect(await new IntroductionDisclosureService(none, fakeStore()).read(TOKEN, 'not-a-uuid')).toEqual({ outcome: 'UNAVAILABLE' });
    expect(none.readDisclosures).not.toHaveBeenCalled();
  });
});

describe('S6-06 IntroductionDisclosureService — text shares (D-10, D-11)', () => {
  const ok = () => repo({ shareText: jest.fn().mockResolvedValue([{ outcome: 'DISCLOSED', disclosed_material_id: S, disclosed_at: '2026-10-16T10:00:00Z' }]) });

  it('passes exactly the bounded request and maps DISCLOSED', async () => {
    const r = ok();
    const answer = await new IntroductionDisclosureService(r, fakeStore()).shareText(TOKEN, W, { commandId: C, resourceType: 'DEEPER_PERSONAL_FIELD', fieldKey: 'hometown_city', text: 'Mansoura' });
    expect(answer).toEqual({ outcome: 'DISCLOSED', materialId: S, disclosedAt: '2026-10-16T10:00:00Z' });
    expect(r.shareText).toHaveBeenCalledWith(TOKEN, C, W, 'DEEPER_PERSONAL_FIELD', 'hometown_city', 'Mansoura');
  });

  it.each([
    [{ commandId: C, resourceType: 'FULL_NAME', text: 'x', userId: W }],
    [{ commandId: C, resourceType: 'PARTIAL_IMAGE', text: 'x' }],
    [{ commandId: C, resourceType: 'DEEPER_PERSONAL_FIELD', fieldKey: 'favourite_food', text: 'x' }],
    [{ commandId: C, resourceType: 'DEEPER_PERSONAL_FIELD', text: 'x' }],
    [{ commandId: C, resourceType: 'FULL_NAME', fieldKey: 'work_field', text: 'x' }],
    [{ commandId: C, resourceType: 'DEEPER_PERSONAL_FIELD', fieldKey: 'hometown_city', text: 'x'.repeat(65) }],
    [{ commandId: C, resourceType: 'FULL_NAME', text: 'two\nlines' }],
    [{ commandId: C, resourceType: 'FULL_NAME', text: ' ' }],
    [{ commandId: C, resourceType: 'CONTACT_METHOD', text: 'x'.repeat(513) }],
    [{ commandId: 'nope', resourceType: 'FULL_NAME', text: 'x' }],
  ])('refuses %j before any call', async (body) => {
    const r = ok();
    await expect(new IntroductionDisclosureService(r, fakeStore()).shareText(TOKEN, W, body)).rejects.toBeInstanceOf(BadRequestException);
    expect(r.shareText).not.toHaveBeenCalled();
  });

  it.each(['CONTACT_REFUSED', 'NOT_AVAILABLE_NOW', 'DELETED', 'COMMAND_CONFLICT', 'UNAVAILABLE'])('carries %s', async (outcome) => {
    const r = repo({ shareText: jest.fn().mockResolvedValue([{ outcome, disclosed_material_id: null, disclosed_at: null }]) });
    expect(await new IntroductionDisclosureService(r, fakeStore()).shareText(TOKEN, W, { commandId: C, resourceType: 'FULL_NAME', text: 'Mona' })).toEqual({ outcome });
  });

  it('maps the database 22023 to 400 and anything else upstream to 503', async () => {
    const invalid = repo({ shareText: jest.fn().mockRejectedValue(new DataApiError(400, { databaseCode: '22023' })) });
    await expect(new IntroductionDisclosureService(invalid, fakeStore()).shareText(TOKEN, W, { commandId: C, resourceType: 'FULL_NAME', text: 'M' }))
      .rejects.toBeInstanceOf(BadRequestException);
    const down = repo({ shareText: jest.fn().mockRejectedValue(new DataApiError(500)) });
    await expect(new IntroductionDisclosureService(down, fakeStore()).shareText(TOKEN, W, { commandId: C, resourceType: 'FULL_NAME', text: 'M' }))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('S6-06 IntroductionDisclosureService — the photo upload (D-06, condition 1)', () => {
  it('asks the gated intent FIRST: with the gate closed nothing is decoded, stored or keyed', async () => {
    const r = repo({ beginImage: jest.fn().mockResolvedValue([{ outcome: 'NOT_AVAILABLE_NOW', image_series_id: null }]) });
    const store = fakeStore();
    expect(await new IntroductionDisclosureService(r, store).uploadImage(TOKEN, W, C, Buffer.from('not even an image'))).toEqual({ outcome: 'NOT_AVAILABLE_NOW' });
    expect(r.uploadKeys).not.toHaveBeenCalled();
    expect(store.puts).toEqual([]);
  });

  it('stores exactly three renditions under the database\'s keys, then completes', async () => {
    const r = repo({
      beginImage: jest.fn().mockResolvedValue([{ outcome: 'BEGUN', image_series_id: S }]),
      uploadKeys: jest.fn().mockResolvedValue(KEYS), completeImage: jest.fn().mockResolvedValue([{ outcome: 'READY' }]),
    });
    const store = fakeStore();
    expect(await new IntroductionDisclosureService(r, store).uploadImage(TOKEN, W, C, await photo())).toEqual({ outcome: 'READY', seriesId: S });
    expect(store.puts).toEqual(KEYS.map((k) => k.storage_key));
    expect(r.completeImage).toHaveBeenCalledWith(S);
    expect(r.removeImage).not.toHaveBeenCalled();
  });

  it('writes the renditions one at a time in stage order, and a failure stops before the next object', async () => {
    const r = repo({ beginImage: jest.fn().mockResolvedValue([{ outcome: 'BEGUN', image_series_id: S }]), uploadKeys: jest.fn().mockResolvedValue(KEYS) });
    let open = 0;
    let widest = 0;
    const attempted: string[] = [];
    const store = fakeStore({
      put: async (key) => {
        attempted.push(key);
        open += 1;
        widest = Math.max(widest, open);
        await new Promise((resolve) => { setTimeout(resolve, 5); });
        open -= 1;
        if (attempted.length === 2) throw new Error('store down');
      },
    });
    expect(await new IntroductionDisclosureService(r, store).uploadImage(TOKEN, W, C, await photo())).toEqual({ outcome: 'UNAVAILABLE' });
    expect(widest).toBe(1);
    expect(attempted).toEqual([KEYS[0].storage_key, KEYS[1].storage_key]);
    expect(r.completeImage).not.toHaveBeenCalled();
    expect(r.removeImage).toHaveBeenCalledTimes(1);
  });

  it('a refused photo, a storage failure or a late completion each remove the series (its keys go to the erasure queue)', async () => {
    const begun = () => ({ beginImage: jest.fn().mockResolvedValue([{ outcome: 'BEGUN', image_series_id: S }]), uploadKeys: jest.fn().mockResolvedValue(KEYS) });
    const refused = repo(begun());
    expect(await new IntroductionDisclosureService(refused, fakeStore()).uploadImage(TOKEN, W, C, Buffer.from('GIF89a....')))
      .toEqual({ outcome: 'IMAGE_REFUSED', reason: 'UNSUPPORTED' });
    expect(refused.removeImage).toHaveBeenCalledTimes(1);
    const failing = repo(begun());
    expect(await new IntroductionDisclosureService(failing, fakeStore({ put: async () => { throw new Error('store down'); } }))
      .uploadImage(TOKEN, W, C, await photo())).toEqual({ outcome: 'UNAVAILABLE' });
    expect(failing.removeImage).toHaveBeenCalledTimes(1);
    const late = repo({ ...begun(), completeImage: jest.fn().mockResolvedValue([{ outcome: 'UNAVAILABLE' }]) });
    expect(await new IntroductionDisclosureService(late, fakeStore()).uploadImage(TOKEN, W, C, await photo())).toEqual({ outcome: 'UNAVAILABLE' });
    expect(late.removeImage).toHaveBeenCalledTimes(1);
  });

  it('a retry of a completed upload stores nothing again', async () => {
    const r = repo({
      beginImage: jest.fn().mockResolvedValue([{ outcome: 'BEGUN', image_series_id: S }]), uploadKeys: jest.fn().mockResolvedValue([]),
      completeImage: jest.fn().mockResolvedValue([{ outcome: 'READY' }]),
    });
    const store = fakeStore();
    expect(await new IntroductionDisclosureService(r, store).uploadImage(TOKEN, W, C, await photo())).toEqual({ outcome: 'READY', seriesId: S });
    expect(store.puts).toEqual([]);
  });

  it('an oversized body is refused before any call; an unconfigured store answers UNAVAILABLE', async () => {
    const r = repo();
    expect(await new IntroductionDisclosureService(r, fakeStore()).uploadImage(TOKEN, W, C, null)).toEqual({ outcome: 'IMAGE_REFUSED', reason: 'TOO_LARGE' });
    expect(await new IntroductionDisclosureService(r, fakeStore({ isConfigured: () => false })).uploadImage(TOKEN, W, C, await photo())).toEqual({ outcome: 'UNAVAILABLE' });
    expect(r.beginImage).not.toHaveBeenCalled();
  });
});

describe('S6-06 IntroductionDisclosureService — the bytes, re-authorized on every request', () => {
  it('serves bytes only after the database authorizes THIS reader now', async () => {
    const r = repo({ authorizeMedia: jest.fn().mockResolvedValue([{ outcome: 'AUTHORIZED' }]), mediaKey: jest.fn().mockResolvedValue([{ storage_key: KEYS[0].storage_key }]) });
    const bytes = await new IntroductionDisclosureService(r, fakeStore()).media(TOKEN, W, H);
    expect(bytes.equals(Buffer.from([0xff, 0xd8, 0xff]))).toBe(true);
    expect(r.authorizeMedia).toHaveBeenCalledWith(TOKEN, W, H);
  });

  it('refuses at once after a deletion: no authorization, no key lookup, no read', async () => {
    const get = jest.fn();
    const r = repo({ authorizeMedia: jest.fn().mockResolvedValue([{ outcome: 'UNAVAILABLE' }]) });
    await expect(new IntroductionDisclosureService(r, fakeStore({ get })).media(TOKEN, W, H)).rejects.toBeInstanceOf(NotFoundException);
    expect(r.mediaKey).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    const gone = repo({ authorizeMedia: jest.fn().mockResolvedValue([{ outcome: 'AUTHORIZED' }]), mediaKey: jest.fn().mockResolvedValue([]) });
    await expect(new IntroductionDisclosureService(gone, fakeStore()).media(TOKEN, W, H)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('S6-06 IntroductionMediaErasureWorker (correction 2, conditions 1 and 2)', () => {
  const claim = { storage_key: KEYS[0].storage_key, lease_id: C };

  it('DELETE then HEAD: only a proven absence confirms', async () => {
    const r = repo({ claimErasures: jest.fn().mockResolvedValue([claim]) });
    const store = fakeStore();
    expect(await new IntroductionMediaErasureWorker(r, store).runOnce()).toMatchObject({ erased: 1, deferred: 0 });
    expect(store.removed).toEqual([claim.storage_key]);
    expect(r.confirmErased).toHaveBeenCalledWith(claim.storage_key, C);
    expect(r.deferErasure).not.toHaveBeenCalled();
  });

  it('an object still present after the delete, or a store failure, defers - never confirms, never drops', async () => {
    for (const store of [fakeStore({ exists: async () => true }), fakeStore({ remove: async () => { throw new Error('down'); } }),
      fakeStore({ exists: async () => { throw new Error('timeout'); } })]) {
      const r = repo({ claimErasures: jest.fn().mockResolvedValue([claim]) });
      expect(await new IntroductionMediaErasureWorker(r, store).runOnce()).toMatchObject({ erased: 0, deferred: 1 });
      expect(r.confirmErased).not.toHaveBeenCalled();
      expect(r.deferErasure).toHaveBeenCalledWith(claim.storage_key, C);
    }
  });

  it('the listing reconciliation enqueues the stored keys the database no longer knows, page by page', async () => {
    const pages = [{ keys: [KEYS[0].storage_key], next: 'p2' }, { keys: [KEYS[1].storage_key], next: null }];
    const r = repo({ enqueueUnknown: jest.fn().mockResolvedValue([{ enqueued: 1 }]) });
    const store = fakeStore({ listOlderThan: jest.fn().mockImplementation(async () => pages.shift()) });
    expect(await new IntroductionMediaErasureWorker(r, store).reconcile(new Date('2026-10-16T12:00:00Z'))).toBe(2);
    expect(r.enqueueUnknown).toHaveBeenCalledTimes(2);
  });

  it('is off under tests', () => {
    expect(new IntroductionMediaErasureWorker(repo(), fakeStore()).enabled).toBe(false);
  });
});

describe('S6-06 isolation of the sharing module', () => {
  const dir = __dirname;
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
  const code = (f: string) => readFileSync(join(dir, f), 'utf8').replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');

  it('reaches no AI, Activity, Push, memory or account Name, and logs nothing', () => {
    for (const f of files) {
      expect(code(f)).not.toMatch(/model-router|anthropic|openai|activity|push[-_/]|PushModule|memory|users\.name|public\.users/iu);
      expect(code(f)).not.toMatch(/console\.|Logger|captureException|Sentry/u);
    }
  });

  it('the controller takes no human identity and no query', () => {
    const controller = code('introduction-disclosure.controller.ts');
    expect(controller).not.toMatch(/@Query|userId|recipient|counterpart|audience|ownerId/iu);
    expect(controller).toMatch(/@UseGuards\(SupabaseAuthGuard\)/u);
  });

  it('only the repository talks to the database, and only the storage boundary uses the server channel', () => {
    for (const f of files.filter((x) => x !== 'introduction-disclosure.repository.ts' && x !== 'introductions-disclosure.module.ts')) {
      expect(code(f)).not.toMatch(/SupabaseServiceRoleApiService|rpc\//u);
    }
    const repository = code('introduction-disclosure.repository.ts');
    const server = [...repository.matchAll(/serverApi\.rpc\('([a-z0-9_]+)'/gu)].map((m) => m[1]);
    expect(server.every((name) => name.startsWith('server_'))).toBe(true);
    const human = [...repository.matchAll(/this\.rpc\(token, '([a-z0-9_]+)'/gu)].map((m) => m[1]);
    expect(human.some((name) => name.startsWith('server_'))).toBe(false);
  });
});
