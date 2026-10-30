import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { DataApiError } from '../conversation/supabase-data-api.service';
import { IntroductionDisclosureRepository } from '../introductions-disclosure/introduction-disclosure.repository';
import {
  ExportMediaIntegrityError, IntroductionDisclosureService, type OwnExportMedia, type OwnExportRendition,
} from '../introductions-disclosure/introduction-disclosure.service';
import type { IntroductionMediaObjectStore } from '../introductions-disclosure/introduction-media.store';
import type { TelemetryService } from '../observability/telemetry.service';
import { PrivacyDataRepository } from './privacy-data.repository';
import {
  EXPORT_BUNDLE_INLINE_MAX_BYTES, EXPORT_PHOTO_MANIFEST_FORMAT, PrivacyDataService,
} from './privacy-data.service';
import { SupabasePasswordGrantService } from './supabase-password-grant.service';

// S6-07 (CP4) — Export My Data's bundle: the package unchanged, the reader's OWN photos beside it (QAN-BL-PRIV-04, Q7′ /
// Q7″). Every photo is re-authorized on the reader's token by the media route's own decision; the 32 MiB guard bounds one
// answer and never the export; nothing partial is ever answered; no identifier ever leaves.

const TOKEN = 'caller-token';
const IP = '203.0.113.7';
const OWNER = { email: 'noor@example.test', emailVerified: true };
const LATER = '2026-10-25T10:00:00.000Z';
const W1 = '0b9b2a52-6a5c-4c3e-9d4a-1f2e3d4c5b6a';
const W2 = '1c8c3b63-7b6d-4d4f-8e5b-2a3f4e5d6c7b';
const H = (n: number) => `3e6e5d85-9d8f-4f6b-8a7d-4c5b6a7f8e${String(n).padStart(2, '0')}`;
const STARTED1 = '2026-10-10T08:00:00.123456+00:00';
const STARTED2 = '2026-10-14T09:30:00.654321+00:00';
const PACKAGE = { format: 'qandeel.personal-data-export.v1', account: { name: 'Noor' }, matchingAndIntroductions: { introductions: [] } };
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;

type Photos = jest.Mocked<Pick<IntroductionDisclosureService, 'ownRenditionsForExport' | 'authorizedForExport' | 'ownMediaForExport'>>;
const rendition = (worldId: string, startedAt: string, stage: 1 | 2 | 3, handle: string, shared = false): OwnExportRendition =>
  ({ worldId, introductionStartedAt: startedAt, stage, handle, shared });

function harness(renditions: OwnExportRendition[], { bytes = (h: string) => Buffer.from(`jpeg:${h}`) as Buffer | null, refused = [] as string[] } = {}) {
  const repository = { readExport: jest.fn().mockResolvedValue({ export_status: 'READY', available_until: LATER, content: PACKAGE }) } as unknown as jest.Mocked<PrivacyDataRepository>;
  const provider = { isConfigured: jest.fn().mockReturnValue(true), readOwnUser: jest.fn().mockResolvedValue(OWNER) } as unknown as jest.Mocked<SupabasePasswordGrantService>;
  const photos: Photos = {
    ownRenditionsForExport: jest.fn().mockResolvedValue(renditions),
    authorizedForExport: jest.fn(async (_t: string, _w: string, handle: string): Promise<boolean> => !refused.includes(handle)),
    ownMediaForExport: jest.fn(async (_t: string, _w: string, handle: string, _s: AbortSignal): Promise<OwnExportMedia> => {
      if (refused.includes(handle)) return { kind: 'NOT_AVAILABLE' };
      const b = bytes(handle);
      if (b === null) throw new ExportMediaIntegrityError();
      return { kind: 'BYTES', bytes: b };
    }),
  };
  const recordOperationalOutcome = jest.fn();
  const telemetry = { recordOperationalOutcome } as unknown as TelemetryService;
  const service = new PrivacyDataService(repository, provider, photos as unknown as IntroductionDisclosureService, telemetry);
  const signals = () => recordOperationalOutcome.mock.calls.map((c) => c.join(':'));
  return { repository, provider, photos, service, signals };
}

describe('S6-07 PrivacyDataService — the export bundle', () => {
  it('answers exactly the package the existing download answers, and the photos only beside it', async () => {
    const h = harness([rendition(W1, STARTED1, 1, H(1), true)]);
    const old = await h.service.downloadExport(TOKEN, IP);
    const bundle = await h.service.downloadExportBundle(TOKEN, IP);
    expect(old).not.toHaveProperty('photoManifest');
    expect(old).not.toHaveProperty('photoFiles');
    expect(bundle.package).toEqual(old.package);
    expect(bundle.package).not.toHaveProperty('photoManifest');
    // RE-ANCHORED by S8B-02 (CP2, B9): one more key BESIDE the photo manifest, `voiceManifest` (null here: no voice source is
    // composed in this harness); the package and every photo key are unchanged.
    expect(Object.keys(bundle).sort()).toEqual(['availableUntil', 'package', 'photoFiles', 'photoManifest', 'photoManifestToken', 'status', 'voiceManifest']);
    expect(bundle.voiceManifest).toBeNull();
  });

  it('names each own rendition by its Introduction and stage, joined to the package by the start instant, all files inline', async () => {
    const h = harness([rendition(W2, STARTED2, 3, H(4)), rendition(W1, STARTED1, 1, H(1), true), rendition(W1, STARTED1, 2, H(2))]);
    const bundle = await h.service.downloadExportBundle(TOKEN, IP);
    expect(bundle.photoManifest).toEqual({
      format: EXPORT_PHOTO_MANIFEST_FORMAT,
      files: [
        { fileName: 'qandeel-photo-01-stage-1.jpg', mimeType: 'image/jpeg', stage: 1, shared: true, introductionStartedAt: STARTED1, derivedRendition: true },
        { fileName: 'qandeel-photo-01-stage-2.jpg', mimeType: 'image/jpeg', stage: 2, shared: false, introductionStartedAt: STARTED1, derivedRendition: true },
        { fileName: 'qandeel-photo-02-stage-3.jpg', mimeType: 'image/jpeg', stage: 3, shared: false, introductionStartedAt: STARTED2, derivedRendition: true },
      ],
      notIncluded: [],
    });
    expect(bundle.photoFiles?.map((f) => [f.fileName, f.bytes, Buffer.from(f.bytesBase64, 'base64').toString()])).toEqual([
      ['qandeel-photo-01-stage-1.jpg', `jpeg:${H(1)}`.length, `jpeg:${H(1)}`],
      ['qandeel-photo-01-stage-2.jpg', `jpeg:${H(2)}`.length, `jpeg:${H(2)}`],
      ['qandeel-photo-02-stage-3.jpg', `jpeg:${H(4)}`.length, `jpeg:${H(4)}`],
    ]);
    expect(bundle.photoManifestToken).toMatch(/^[0-9a-f]{64}$/u);
    expect(h.signals()).toEqual(['PRIVACY_EXPORT:bundle:success']);
  });

  it('a rendition the reader may no longer download is listed as not included, never silently missing', async () => {
    const h = harness([rendition(W1, STARTED1, 1, H(1), true), rendition(W1, STARTED1, 2, H(2))], { refused: [H(2)] });
    const bundle = await h.service.downloadExportBundle(TOKEN, IP);
    expect(bundle.photoManifest?.files.map((f) => f.fileName)).toEqual(['qandeel-photo-01-stage-1.jpg']);
    expect(bundle.photoManifest?.notIncluded).toEqual([{ introductionStartedAt: STARTED1, stage: 2, reason: 'NO_LONGER_AVAILABLE' }]);
    expect(bundle.photoFiles?.map((f) => f.fileName)).toEqual(['qandeel-photo-01-stage-1.jpg']);
    // Every photo is asked for through the reader's own authorization, and only own renditions are ever asked for.
    for (const call of [...h.photos.authorizedForExport.mock.calls, ...h.photos.ownMediaForExport.mock.calls]) expect(call[0]).toBe(TOKEN);
    expect(h.photos.ownMediaForExport.mock.calls.map((c) => c[2])).toEqual([H(1)]);
  });

  it('the 32 MiB guard bounds one answer, never the export: the rest travels by the file route, each file re-authorized', async () => {
    const big = (handle: string) => Buffer.alloc(13 * 1024 * 1024, handle.slice(-2));
    const renditions = [rendition(W1, STARTED1, 1, H(1), true), rendition(W1, STARTED1, 2, H(2)), rendition(W1, STARTED1, 3, H(3)),
      rendition(W2, STARTED2, 3, H(4))];
    const h = harness(renditions, { bytes: big });
    const bundle = await h.service.downloadExportBundle(TOKEN, IP);
    expect(bundle.photoManifest?.files).toHaveLength(4);
    expect(bundle.photoFiles?.map((f) => f.fileName)).toEqual(['qandeel-photo-01-stage-1.jpg', 'qandeel-photo-01-stage-2.jpg']);
    expect(bundle.photoFiles?.reduce((n, f) => n + f.bytes, 0)).toBeLessThanOrEqual(EXPORT_BUNDLE_INLINE_MAX_BYTES);
    const total = renditions.length * 13 * 1024 * 1024;
    expect(total).toBeGreaterThan(EXPORT_BUNDLE_INLINE_MAX_BYTES);
    h.photos.ownMediaForExport.mockClear();
    const rest = [];
    for (const name of ['qandeel-photo-01-stage-3.jpg', 'qandeel-photo-02-stage-3.jpg']) {
      rest.push(await h.service.downloadExportPhoto(TOKEN, name, bundle.photoManifestToken));
    }
    expect(rest.map((f) => [f.fileName, f.bytes])).toEqual([['qandeel-photo-01-stage-3.jpg', 13 * 1024 * 1024], ['qandeel-photo-02-stage-3.jpg', 13 * 1024 * 1024]]);
    expect(Buffer.from(rest[1].bytesBase64, 'base64').equals(big(H(4)))).toBe(true);
    expect(h.photos.ownMediaForExport.mock.calls.map((c) => [c[0], c[1], c[2]])).toEqual([[TOKEN, W1, H(3)], [TOKEN, W2, H(4)]]);
    expect(h.signals()).toEqual(['PRIVACY_EXPORT:bundle:success', 'PRIVACY_EXPORT:bundle_file:success', 'PRIVACY_EXPORT:bundle_file:success']);
  });

  it('a single photo larger than the guard is still exported, by the file route', async () => {
    const h = harness([rendition(W1, STARTED1, 3, H(3))], { bytes: () => Buffer.alloc(EXPORT_BUNDLE_INLINE_MAX_BYTES + 1, 1) });
    const bundle = await h.service.downloadExportBundle(TOKEN, IP);
    expect(bundle.photoFiles).toEqual([]);
    const file = await h.service.downloadExportPhoto(TOKEN, 'qandeel-photo-01-stage-3.jpg', bundle.photoManifestToken);
    expect(file.bytes).toBe(EXPORT_BUNDLE_INLINE_MAX_BYTES + 1);
  });

  it('the file route answers CHANGED when the photos moved, the export is no longer ready, or the file is no longer authorized', async () => {
    const renditions = [rendition(W1, STARTED1, 1, H(1), true), rendition(W1, STARTED1, 2, H(2))];
    const h = harness(renditions);
    const { photoManifestToken: token } = await h.service.downloadExportBundle(TOKEN, IP);
    // another photo removed since the manifest
    h.photos.ownRenditionsForExport.mockResolvedValueOnce([renditions[0]]);
    await expect(h.service.downloadExportPhoto(TOKEN, 'qandeel-photo-01-stage-1.jpg', token)).rejects.toBeInstanceOf(ConflictException);
    // a token that is not this manifest's
    await expect(h.service.downloadExportPhoto(TOKEN, 'qandeel-photo-01-stage-1.jpg', 'f'.repeat(64))).rejects.toBeInstanceOf(ConflictException);
    // a name the manifest does not list
    await expect(h.service.downloadExportPhoto(TOKEN, 'qandeel-photo-09-stage-1.jpg', token)).rejects.toBeInstanceOf(ConflictException);
    // the photo is no longer the reader's to download
    h.photos.ownMediaForExport.mockResolvedValueOnce({ kind: 'NOT_AVAILABLE' });
    await expect(h.service.downloadExportPhoto(TOKEN, 'qandeel-photo-01-stage-2.jpg', token)).rejects.toBeInstanceOf(ConflictException);
    // a new export replaced the ready one (its availability is in the token), or none is ready
    h.repository.readExport.mockResolvedValueOnce({ export_status: 'READY', available_until: '2026-10-30T10:00:00.000Z', content: PACKAGE });
    await expect(h.service.downloadExportPhoto(TOKEN, 'qandeel-photo-01-stage-1.jpg', token)).rejects.toBeInstanceOf(ConflictException);
    h.repository.readExport.mockResolvedValueOnce({ export_status: 'EXPIRED', available_until: null, content: null });
    await expect(h.service.downloadExportPhoto(TOKEN, 'qandeel-photo-01-stage-1.jpg', token)).rejects.toBeInstanceOf(ConflictException);
    expect(h.signals().slice(1)).toEqual(Array(6).fill('PRIVACY_EXPORT:bundle_file:superseded_expected'));
    // and an unchanged request still answers
    await expect(h.service.downloadExportPhoto(TOKEN, 'qandeel-photo-01-stage-2.jpg', token)).resolves.toMatchObject({ fileName: 'qandeel-photo-01-stage-2.jpg' });
  });

  it('never a partial answer: a store with no object for a live key, or any transport failure, is 503', async () => {
    const integrity = harness([rendition(W1, STARTED1, 1, H(1))], { bytes: () => null });
    await expect(integrity.service.downloadExportBundle(TOKEN, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(integrity.signals()).toEqual(['PRIVACY_EXPORT:bundle:integrity_failure']);
    const reader = harness([]);
    reader.photos.ownRenditionsForExport.mockRejectedValueOnce(new DataApiError(500));
    await expect(reader.service.downloadExportBundle(TOKEN, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
    const auth = harness([rendition(W1, STARTED1, 1, H(1))]);
    auth.photos.authorizedForExport.mockRejectedValueOnce(new DataApiError(503));
    await expect(auth.service.downloadExportBundle(TOKEN, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(auth.signals()).toEqual(['PRIVACY_EXPORT:bundle:transport_failure']);
    const file = harness([rendition(W1, STARTED1, 1, H(1))]);
    const { photoManifestToken: token } = await file.service.downloadExportBundle(TOKEN, IP);
    file.photos.ownMediaForExport.mockRejectedValueOnce(new ExportMediaIntegrityError());
    await expect(file.service.downloadExportPhoto(TOKEN, 'qandeel-photo-01-stage-1.jpg', token)).rejects.toBeInstanceOf(ServiceUnavailableException);
    file.photos.ownMediaForExport.mockRejectedValueOnce(Object.assign(new Error('timeout'), { name: 'TimeoutError' }));
    await expect(file.service.downloadExportPhoto(TOKEN, 'qandeel-photo-01-stage-1.jpg', token)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(file.signals().slice(1)).toEqual(['PRIVACY_EXPORT:bundle_file:integrity_failure', 'PRIVACY_EXPORT:bundle_file:transport_failure']);
    // not composed with a photo source: no guess, no package without its photos
    const bare = new PrivacyDataService(file.repository, file.provider);
    await expect(bare.downloadExportBundle(TOKEN, IP)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('not ready: the null shape, and no photo is ever asked for', async () => {
    for (const status of ['NONE', 'PREPARING', 'EXPIRED', 'FAILED']) {
      const h = harness([rendition(W1, STARTED1, 1, H(1))]);
      h.repository.readExport.mockResolvedValue({ export_status: status, available_until: null, content: null });
      await expect(h.service.downloadExportBundle(TOKEN, IP)).resolves.toEqual({
        // RE-ANCHORED by S8B-02 (CP2): the voice manifest is null with the photo manifest while the export is not READY.
        status, availableUntil: null, package: null, photoManifest: null, photoFiles: null, photoManifestToken: null, voiceManifest: null,
      });
      expect(h.photos.ownRenditionsForExport).not.toHaveBeenCalled();
      expect(h.signals()).toEqual(['PRIVACY_EXPORT:bundle:not_ready']);
    }
  });

  it('carries no handle, World id, key or URL anywhere; the file route takes only a bounded name and token', async () => {
    const h = harness([rendition(W1, STARTED1, 1, H(1), true), rendition(W2, STARTED2, 2, H(5))]);
    const bundle = await h.service.downloadExportBundle(TOKEN, IP);
    const text = JSON.stringify({ photoManifest: bundle.photoManifest, photoFiles: bundle.photoFiles, token: bundle.photoManifestToken });
    expect(text).not.toMatch(UUID);
    expect(text).not.toMatch(/intro-media\/|qmedia:|https?:/u);
    for (const [name, token] of [['../etc/passwd', bundle.photoManifestToken], ['qandeel-photo-01-stage-4.jpg', bundle.photoManifestToken],
      ['qandeel-photo-01-stage-1.png', bundle.photoManifestToken], ['qandeel-photo-01-stage-1.jpg', undefined], ['qandeel-photo-01-stage-1.jpg', 'xyz']]) {
      await expect(h.service.downloadExportPhoto(TOKEN, name, token)).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});

// The disclosure service's three export methods: the media route's own decisions, nothing wider.
function disclosure(over: Partial<Record<'listOwnPhotoRenditions' | 'authorizeMedia' | 'mediaKey', jest.Mock>> = {}, store: Partial<IntroductionMediaObjectStore> = {}) {
  const repository = {
    listOwnPhotoRenditions: jest.fn().mockResolvedValue([{ world_id: W1, introduction_started_at: STARTED1, stage: 1, media_handle: H(1), is_shared: true }]),
    authorizeMedia: jest.fn().mockResolvedValue([{ outcome: 'AUTHORIZED' }]),
    mediaKey: jest.fn().mockResolvedValue([{ storage_key: 'intro-media/aaaaaaaa-0000-4000-8000-000000000000' }]),
    ...over,
  } as unknown as IntroductionDisclosureRepository;
  const s: IntroductionMediaObjectStore = {
    isConfigured: () => true, put: async () => undefined, get: async () => Buffer.from([0xff, 0xd8]), exists: async () => true,
    remove: async () => undefined, listOlderThan: async () => ({ keys: [], next: null }), ...store,
  };
  return { repository, service: new IntroductionDisclosureService(repository, s) };
}

describe('S6-07 IntroductionDisclosureService — the export reads', () => {
  it('decodes the owner-only reader strictly and keeps the start instant exactly as the database wrote it', async () => {
    const { service } = disclosure();
    await expect(service.ownRenditionsForExport(TOKEN)).resolves.toEqual([rendition(W1, STARTED1, 1, H(1), true)]);
    for (const bad of [[{ world_id: 'x', introduction_started_at: STARTED1, stage: 1, media_handle: H(1), is_shared: true }],
      [{ world_id: W1, introduction_started_at: STARTED1, stage: 4, media_handle: H(1), is_shared: true }],
      [{ world_id: W1, introduction_started_at: 'never', stage: 1, media_handle: H(1), is_shared: true }],
      [{ world_id: W1, introduction_started_at: STARTED1, stage: 1, media_handle: H(1), is_shared: true, owner_user_id: W2 }], {}]) {
      const { service: s } = disclosure({ listOwnPhotoRenditions: jest.fn().mockResolvedValue(bad) });
      await expect(s.ownRenditionsForExport(TOKEN)).rejects.toThrow();
    }
  });

  it('authorizes on the caller\'s own token before any key is read; no key or a refusal is NOT_AVAILABLE; a missing object is integrity', async () => {
    const { repository, service } = disclosure();
    await expect(service.ownMediaForExport(TOKEN, W1, H(1), AbortSignal.timeout(1000))).resolves.toEqual({ kind: 'BYTES', bytes: Buffer.from([0xff, 0xd8]) });
    expect((repository.authorizeMedia as jest.Mock).mock.calls[0]).toEqual([TOKEN, W1, H(1)]);
    expect((repository.authorizeMedia as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan((repository.mediaKey as jest.Mock).mock.invocationCallOrder[0]);
    const refused = disclosure({ authorizeMedia: jest.fn().mockResolvedValue([{ outcome: 'UNAVAILABLE' }]) });
    await expect(refused.service.ownMediaForExport(TOKEN, W1, H(1), AbortSignal.timeout(1000))).resolves.toEqual({ kind: 'NOT_AVAILABLE' });
    expect(refused.repository.mediaKey).not.toHaveBeenCalled();
    const gone = disclosure({ mediaKey: jest.fn().mockResolvedValue([]) });
    await expect(gone.service.ownMediaForExport(TOKEN, W1, H(1), AbortSignal.timeout(1000))).resolves.toEqual({ kind: 'NOT_AVAILABLE' });
    const missing = disclosure({}, { get: async () => null });
    await expect(missing.service.ownMediaForExport(TOKEN, W1, H(1), AbortSignal.timeout(1000))).rejects.toBeInstanceOf(ExportMediaIntegrityError);
    const unconfigured = disclosure({}, { isConfigured: () => false });
    await expect(unconfigured.service.ownMediaForExport(TOKEN, W1, H(1), AbortSignal.timeout(1000))).rejects.toThrow();
    const odd = disclosure({ authorizeMedia: jest.fn().mockResolvedValue([{ outcome: 'MAYBE' }]) });
    await expect(odd.service.authorizedForExport(TOKEN, W1, H(1))).rejects.toThrow();
  });
});
